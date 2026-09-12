# Motor de Sincronización Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar las llamadas 1:1 de `ApiStorageProvider` (una request HTTP por cada mutación) por una cola de operaciones que agrupa cambios, los envía en un solo request por diagrama tras un debounce, actualiza la UI de forma optimista, detecta conflictos de versión, y retira Dexie/IndexedDB y `SupabaseStorageProvider` como caminos alternativos de persistencia.

**Architecture:** Un `SyncEngine` (clase TS pura, sin dependencias de React) vive dentro de `ApiStorageProvider`, uno por diagrama activo. Encola operaciones `{entity, op, id, patch}`, las agrupa con debounce (700ms) y las envía como un único `POST /diagrams/:id/sync` transaccional. El backend reutiliza los `*.service.ts` de módulo ya existentes. Un contexto nuevo (`sync-status-context`) expone el estado de guardado a la UI, separado del estado de servidor (`chartdb-context`) y del estado visual (`canvas-context`).

**Tech Stack:** React 18.3 + TypeScript 5.9 + Vite 7 (frontend), Express 4 + `pg` + Postgres/Supabase con RLS (backend), Vitest 5 en ambos paquetes.

**Spec:** `docs/superpowers/specs/2026-09-10-sync-engine-design.md`

## Global Constraints

- Backend obligatorio: no se reintroduce ningún modo de persistencia local sin cuenta.
- Un solo camino de persistencia: todo pasa por la API Express (no llamadas directas a Supabase desde el frontend).
- Sin CRDT ni event-sourcing: conflictos resueltos con last-write-wins por versión de diagrama + reporte al cliente.
- No se toca `src/context/chartdb-context/chartdb-provider.tsx` ni la interfaz pública `StorageContext` — todo el cambio de comportamiento vive dentro de la capa de storage.
- No se introducen migraciones SQL versionadas de framework completo ni cache Redis de lecturas en esta ronda (fase posterior, ya acordada).
- Reutilizar los `*PatchSchema`/`*Schema` de Zod ya existentes en `server/src/lib/schemas.ts` para validar cada operación del batch.

---



### Task 1: Columna `version` en `diagrams` + mappers

**Files:**

- Create: `server/sql/2026-09-10-diagrams-add-version-column.sql`
- Modify: `server/src/lib/mappers.ts:6-19` (`DiagramDto`), `:101-110` (`rowToDiagram`)
- Test: `server/test/mappers.test.ts`

**Interfaces:**

- Produces: `DiagramDto.version: number`, `rowToDiagram(row).version`.

- [ ] **Step 1: Escribir el SQL de la migración suelta**

```sql
-- server/sql/2026-09-10-diagrams-add-version-column.sql
-- Aplicar manualmente contra Supabase (SQL editor o psql) antes de desplegar
-- el backend con el endpoint /diagrams/:id/sync.
ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
```

- [ ] **Step 2: Escribir el test que falla para** `rowToDiagram` **con** `version`

Añadir al final de `server/test/mappers.test.ts`:

```ts
it('reads version from a diagram row, defaulting to 1', () => {
    const row = {
        id: 'd1',
        name: 'Demo',
        database_type: 'postgresql',
        database_edition: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        version: 3,
    };
    const diagram = rowToDiagram(row);
    expect(diagram.version).toBe(3);

    const rowNoVersion = { ...row, version: undefined };
    expect(rowToDiagram(rowNoVersion).version).toBe(1);
});
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `cd server && pnpm test -- mappers.test.ts`
Expected: FAIL — `diagram.version` es `undefined`, no `3`.

- [ ] **Step 4: Añadir** `version` **a** `DiagramDto` **y a** `rowToDiagram`

En `server/src/lib/mappers.ts:6-19`, añadir el campo:

```ts
export interface DiagramDto {
    id: string;
    name: string;
    databaseType: string;
    databaseEdition?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    tables?: TableDto[];
    relationships?: RelationshipDto[];
    dependencies?: DependencyDto[];
    areas?: AreaDto[];
    customTypes?: CustomTypeDto[];
    notes?: NoteDto[];
}
```

En `rowToDiagram` (línea 101-110):

```ts
export function rowToDiagram(row: Record<string, unknown>): DiagramDto {
    return {
        id: String(row.id),
        name: String(row.name),
        databaseType: String(row.database_type),
        databaseEdition: (row.database_edition as string) || undefined,
        version: row.version != null ? Number(row.version) : 1,
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
}
```

No modificar `diagramToRow`: al no incluir `version` en el objeto insertado, el `INSERT ... ON CONFLICT DO UPDATE SET` generado por `upsertSql` no la toca, y el `DEFAULT 1` de la columna aplica en la creación.

- [ ] **Step 5: Ejecutar el test y verificar que pasa**

Run: `cd server && pnpm test -- mappers.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/sql/2026-09-10-diagrams-add-version-column.sql server/src/lib/mappers.ts server/test/mappers.test.ts
git commit -m "feat(server): add diagrams.version column and mapper support"
```

---



### Task 2: Esquemas Zod del batch de sincronización

**Files:**

- Modify: `server/src/lib/schemas.ts`
- Test: `server/test/schemas.test.ts` (crear)

**Interfaces:**

- Produces: `syncOperationSchema`, `syncRequestSchema` (usados por Task 3 y Task 4).

- [ ] **Step 1: Escribir el test que falla**

```ts
// server/test/schemas.test.ts
import { describe, expect, it } from 'vitest';
import { syncRequestSchema } from '../src/lib/schemas.ts';

describe('syncRequestSchema', () => {
    it('accepts a valid batch', () => {
        const result = syncRequestSchema.parse({
            baseVersion: 1,
            operations: [
                { entity: 'table', op: 'update', id: 't1', patch: { x: 10 } },
                { entity: 'relationship', op: 'delete', id: 'r1' },
            ],
        });
        expect(result.operations).toHaveLength(2);
    });

    it('rejects an empty operations array', () => {
        expect(() =>
            syncRequestSchema.parse({ baseVersion: 1, operations: [] })
        ).toThrow();
    });

    it('rejects an unknown entity', () => {
        expect(() =>
            syncRequestSchema.parse({
                baseVersion: 1,
                operations: [{ entity: 'bogus', op: 'update', id: 'x' }],
            })
        ).toThrow();
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd server && pnpm test -- schemas.test.ts`
Expected: FAIL — `syncRequestSchema` no existe todavía.

- [ ] **Step 3: Añadir los esquemas**

Al final de `server/src/lib/schemas.ts`:

```ts
export const syncOperationSchema = z.object({
    entity: z.enum([
        'diagram',
        'table',
        'relationship',
        'dependency',
        'area',
        'customType',
        'note',
    ]),
    op: z.enum(['create', 'update', 'delete']),
    id: z.string().min(1),
    patch: z.record(z.string(), z.any()).optional(),
});

export const syncRequestSchema = z.object({
    baseVersion: z.number().int().nonnegative(),
    operations: z.array(syncOperationSchema).min(1).max(500),
});
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `cd server && pnpm test -- schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/schemas.ts server/test/schemas.test.ts
git commit -m "feat(server): add zod schemas for the sync batch endpoint"
```

---



### Task 3: `syncService` — lógica pura de colapso de operaciones

**Files:**

- Create: `server/src/modules/sync/sync.service.ts`
- Test: `server/test/sync.service.test.ts`

**Interfaces:**

- Consumes: `diagramsService` de `server/src/modules/diagrams/diagrams.service.ts` (Task 4 lo usa vía `applyOperation`, definido en este mismo archivo).
- Produces: `collapseOperations(operations: SyncOperation[]): SyncOperation[]`, tipos `SyncEntity`, `SyncOp`, `SyncOperation`, `SyncRequest`, `SyncConflict`, `SyncResult`, y `syncService.apply(client, diagramId, userId, request)` (usado por Task 4).

- [ ] **Step 1: Escribir el test que falla para** `collapseOperations`

```ts
// server/test/sync.service.test.ts
import { describe, expect, it } from 'vitest';
import { collapseOperations } from '../src/modules/sync/sync.service.ts';

describe('collapseOperations', () => {
    it('merges sequential updates to the same entity into one', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'update', id: 't1', patch: { y: 2 } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1, y: 2 } },
        ]);
    });

    it('a delete after any op wins and drops the patch', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'delete', id: 't1' },
        ]);
        expect(result).toEqual([{ entity: 'table', op: 'delete', id: 't1' }]);
    });

    it('a create after a delete for the same id is treated as a fresh create', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'delete', id: 't1' },
            { entity: 'table', op: 'create', id: 't1', patch: { name: 'x' } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'create', id: 't1', patch: { name: 'x' } },
        ]);
    });

    it('keeps unrelated entities separate', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'area', op: 'update', id: 'a1', patch: { x: 2 } },
        ]);
        expect(result).toHaveLength(2);
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `cd server && pnpm test -- sync.service.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar** `sync.service.ts` **(tipos + colapso + aplicación transaccional)**

```ts
// server/src/modules/sync/sync.service.ts
import type { PoolClient } from 'pg';
import { AppError } from '../../lib/types.js';
import {
    areaPatchSchema,
    areaSchema,
    customTypePatchSchema,
    customTypeSchema,
    dependencyPatchSchema,
    dependencySchema,
    diagramPatchSchema,
    notePatchSchema,
    noteSchema,
    relationshipPatchSchema,
    relationshipSchema,
    tablePatchSchema,
    tableSchema,
} from '../../lib/schemas.js';
import { diagramsService } from '../diagrams/diagrams.service.js';
import type {
    AreaDto,
    CustomTypeDto,
    DependencyDto,
    NoteDto,
    RelationshipDto,
    TableDto,
} from '../../lib/mappers.js';

export type SyncEntity =
    | 'diagram'
    | 'table'
    | 'relationship'
    | 'dependency'
    | 'area'
    | 'customType'
    | 'note';

export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncOperation {
    entity: SyncEntity;
    op: SyncOp;
    id: string;
    patch?: Record<string, unknown>;
}

export interface SyncRequest {
    baseVersion: number;
    operations: SyncOperation[];
}

export interface SyncConflict {
    entity: SyncEntity;
    id: string;
}

export interface SyncResult {
    version: number;
    conflicts: SyncConflict[];
}

export function collapseOperations(
    operations: SyncOperation[]
): SyncOperation[] {
    const byKey = new Map<string, SyncOperation>();
    for (const op of operations) {
        const key = `${op.entity}:${op.id}`;
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, op);
            continue;
        }
        if (op.op === 'delete') {
            byKey.set(key, { entity: op.entity, op: 'delete', id: op.id });
            continue;
        }
        if (prev.op === 'delete') {
            byKey.set(key, op);
            continue;
        }
        byKey.set(key, {
            entity: op.entity,
            op: prev.op === 'create' ? 'create' : 'update',
            id: op.id,
            patch: { ...prev.patch, ...op.patch },
        });
    }
    return [...byKey.values()];
}

async function applyOperation(
    client: PoolClient,
    diagramId: string,
    userId: string,
    op: SyncOperation
): Promise<void> {
    switch (op.entity) {
        case 'diagram': {
            if (op.op !== 'update') return;
            const patch = diagramPatchSchema.parse(op.patch ?? {});
            await diagramsService.update(client, diagramId, patch);
            return;
        }
        case 'table': {
            if (op.op === 'delete') {
                await diagramsService.deleteTable(client, diagramId, op.id);
                return;
            }
            const schema = op.op === 'create' ? tableSchema : tablePatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertTable(
                client,
                diagramId,
                { id: op.id, ...parsed } as TableDto,
                userId
            );
            return;
        }
        case 'relationship': {
            if (op.op === 'delete') {
                await diagramsService.deleteRelationship(
                    client,
                    diagramId,
                    op.id
                );
                return;
            }
            const schema =
                op.op === 'create' ? relationshipSchema : relationshipPatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertRelationship(
                client,
                diagramId,
                { id: op.id, ...parsed } as RelationshipDto,
                userId
            );
            return;
        }
        case 'dependency': {
            if (op.op === 'delete') {
                await diagramsService.deleteDependency(client, diagramId, op.id);
                return;
            }
            const schema =
                op.op === 'create' ? dependencySchema : dependencyPatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertDependency(
                client,
                diagramId,
                { id: op.id, ...parsed } as DependencyDto,
                userId
            );
            return;
        }
        case 'area': {
            if (op.op === 'delete') {
                await diagramsService.deleteArea(client, diagramId, op.id);
                return;
            }
            const schema = op.op === 'create' ? areaSchema : areaPatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertArea(
                client,
                diagramId,
                { id: op.id, ...parsed } as AreaDto,
                userId
            );
            return;
        }
        case 'customType': {
            if (op.op === 'delete') {
                await diagramsService.deleteCustomType(client, diagramId, op.id);
                return;
            }
            const schema =
                op.op === 'create' ? customTypeSchema : customTypePatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertCustomType(
                client,
                diagramId,
                { id: op.id, ...parsed } as CustomTypeDto,
                userId
            );
            return;
        }
        case 'note': {
            if (op.op === 'delete') {
                await diagramsService.deleteNote(client, diagramId, op.id);
                return;
            }
            const schema = op.op === 'create' ? noteSchema : notePatchSchema;
            const parsed = schema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertNote(
                client,
                diagramId,
                { id: op.id, ...parsed } as NoteDto,
                userId
            );
            return;
        }
    }
}

export const syncService = {
    collapseOperations,

    async apply(
        client: PoolClient,
        diagramId: string,
        userId: string,
        request: SyncRequest
    ): Promise<SyncResult> {
        const { rows } = await client.query(
            `SELECT version FROM diagrams WHERE id = $1 FOR UPDATE`,
            [diagramId]
        );
        if (!rows[0]) {
            throw new AppError(404, 'Diagram not found', 'not_found');
        }
        const currentVersion = Number(rows[0].version ?? 1);
        const isConflict = currentVersion !== request.baseVersion;

        const ops = collapseOperations(request.operations);
        for (const op of ops) {
            await applyOperation(client, diagramId, userId, op);
        }

        const nextVersion = currentVersion + 1;
        await client.query(
            `UPDATE diagrams SET version = $1, updated_at = now() WHERE id = $2`,
            [nextVersion, diagramId]
        );

        return {
            version: nextVersion,
            conflicts: isConflict
                ? ops.map((o) => ({ entity: o.entity, id: o.id }))
                : [],
        };
    },
};
```

- [ ] **Step 4: Ejecutar y verificar que pasa**



Run: `cd server && pnpm test -- sync.service.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `cd server && pnpm typecheck`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add server/src/modules/sync/sync.service.ts server/test/sync.service.test.ts
git commit -m "feat(server): add transactional sync batch service"
```

---



### Task 4: Endpoint `POST /diagrams/:id/sync`

**Files:**

- Modify: `server/src/modules/diagrams/diagrams.routes.ts`
- Test: `server/test/integration/sync.test.ts` (crear, gateado por `INTEGRATION=1`, mismo patrón que `server/test/integration/isolation.test.ts`)

**Interfaces:**

- Consumes: `syncRequestSchema` (Task 2), `syncService.apply` (Task 3), `withUserContext` (`server/src/config/db.ts:28`).
- Produces: ruta `POST /diagrams/:id/sync` — consumida por el frontend en Task 6.

- [ ] **Step 1: Añadir la ruta**

En `server/src/modules/diagrams/diagrams.routes.ts`, añadir el import y la ruta antes del `diagramsRouter.delete('/:id', ...)`:

```ts
import { syncRequestSchema } from '../../lib/schemas.js';
import { syncService } from '../sync/sync.service.js';
```

```ts
diagramsRouter.post('/:id/sync', async (req, res, next) => {
    try {
        const body = syncRequestSchema.parse(req.body);
        const result = await withUserContext(req.user!.id, (client) =>
            syncService.apply(client, req.params.id, req.user!.id, body)
        );
        res.json(result);
    } catch (err) {
        next(err);
    }
});
```

- [ ] **Step 2: Escribir el test de integración (gateado)**

```ts
// server/test/integration/sync.test.ts
/**
 * Requiere INTEGRATION=1 y las mismas variables que isolation.test.ts,
 * más TEST_USER_B_TABLE_ID (una fila existente en TEST_USER_B_DIAGRAM_ID).
 */
import { describe, expect, it } from 'vitest';

const enabled = process.env.INTEGRATION === '1';
const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';

async function api(
    path: string,
    token: string,
    init: RequestInit = {}
): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
}

describe.skipIf(!enabled)('sync endpoint', () => {
    const tokenB = process.env.TEST_USER_B_JWT!;
    const diagramB = process.env.TEST_USER_B_DIAGRAM_ID!;
    const tableId = process.env.TEST_USER_B_TABLE_ID!;

    it('applies a batch and bumps the version', async () => {
        const before = await api(`/diagrams/${diagramB}`, tokenB);
        const { version } = (await before.json()) as { version: number };

        const res = await api(`/diagrams/${diagramB}/sync`, tokenB, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: version,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 999 } },
                ],
            }),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            version: number;
            conflicts: unknown[];
        };
        expect(body.version).toBe(version + 1);
        expect(body.conflicts).toEqual([]);
    });

    it('reports a conflict when baseVersion is stale', async () => {
        const res = await api(`/diagrams/${diagramB}/sync`, tokenB, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: 1,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 1 } },
                ],
            }),
        });
        const body = (await res.json()) as { conflicts: unknown[] };
        expect(body.conflicts.length).toBeGreaterThan(0);
    });

    it('rejects a batch for another user\'s diagram', async () => {
        const tokenA = process.env.TEST_USER_A_JWT!;
        const res = await api(`/diagrams/${diagramB}/sync`, tokenA, {
            method: 'POST',
            body: JSON.stringify({
                baseVersion: 1,
                operations: [
                    { entity: 'table', op: 'update', id: tableId, patch: { x: 1 } },
                ],
            }),
        });
        expect([403, 404]).toContain(res.status);
    });
});
```

- [ ] **Step 3: Typecheck y build**

Run: `cd server && pnpm typecheck && pnpm build`
Expected: sin errores

- [ ] **Step 4: (Si hay entorno de integración configurado) ejecutar el test gateado**

Run: `cd server && INTEGRATION=1 pnpm test -- integration/sync.test.ts`
Expected: PASS (si no hay entorno de integración configurado, se omite — documentar en el PR que queda pendiente de correr contra Supabase real antes de desplegar)

- [ ] **Step 5: Commit**

```bash
git add server/src/modules/diagrams/diagrams.routes.ts server/test/integration/sync.test.ts
git commit -m "feat(server): expose POST /diagrams/:id/sync"
```

---



### Task 5: `Diagram.version` en el dominio del frontend

**Files:**

- Modify: `src/lib/domain/diagram.ts`

**Interfaces:**

- Produces: `Diagram.version: number` (consumido por Task 6/7).

- [ ] **Step 1: Añadir el campo al tipo y al esquema**

```ts
export interface Diagram {
    id: string;
    name: string;
    description?: string;
    databaseType: DatabaseType;
    databaseEdition?: DatabaseEdition;
    version: number;
    tables?: DBTable[];
    relationships?: DBRelationship[];
    dependencies?: DBDependency[];
    areas?: Area[];
    customTypes?: DBCustomType[];
    notes?: Note[];
    createdAt: Date;
    updatedAt: Date;
}

export const diagramSchema: z.ZodType<Diagram> = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    databaseType: z.nativeEnum(DatabaseType),
    databaseEdition: z.nativeEnum(DatabaseEdition).optional(),
    version: z.number().default(1),
    tables: z.array(dbTableSchema).optional(),
    relationships: z.array(dbRelationshipSchema).optional(),
    dependencies: z.array(dbDependencySchema).optional(),
    areas: z.array(areaSchema).optional(),
    customTypes: z.array(dbCustomTypeSchema).optional(),
    notes: z.array(noteSchema).optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run lint && tsc -b --noEmit`
Expected: sin errores nuevos (puede haber errores preexistentes no relacionados; confirmar que no aumentan)

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain/diagram.ts
git commit -m "feat: add version field to the Diagram domain type"
```

---



### Task 6: `SyncEngine` — cola, debounce y colapso (frontend)

**Files:**

- Create: `src/context/storage-context/sync-engine.ts`
- Test: `src/context/storage-context/sync-engine.test.ts`

**Interfaces:**

- Consumes: `apiFetch` de `src/lib/api-client.ts`.
- Produces: `SyncEngine` class, `SyncEntity`, `SyncOp`, `SyncOperation`, `SyncStatus` (usados por Task 7, 8, 9).

- [ ] **Step 1: Escribir el test que falla (enqueue + debounce + flush)**

```ts
// src/context/storage-context/sync-engine.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine, collapseOperations } from './sync-engine';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
    apiFetch: vi.fn(),
}));

describe('collapseOperations', () => {
    it('merges patches for the same entity', () => {
        const result = collapseOperations([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1 } },
            { entity: 'table', op: 'update', id: 't1', patch: { y: 2 } },
        ]);
        expect(result).toEqual([
            { entity: 'table', op: 'update', id: 't1', patch: { x: 1, y: 2 } },
        ]);
    });
});

describe('SyncEngine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(apiFetch).mockReset();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('groups operations queued within the debounce window into one request', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ version: 2, conflicts: [] });
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });

        engine.enqueue({ entity: 'table', op: 'update', id: 't1', patch: { x: 1 } });
        engine.enqueue({ entity: 'table', op: 'update', id: 't1', patch: { y: 2 } });
        engine.enqueue({ entity: 'area', op: 'create', id: 'a1', patch: { x: 0, y: 0, width: 10, height: 10, color: '#fff' } });

        await vi.advanceTimersByTimeAsync(700);

        expect(apiFetch).toHaveBeenCalledTimes(1);
        const [path, init] = vi.mocked(apiFetch).mock.calls[0];
        expect(path).toBe('/diagrams/d1/sync');
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.baseVersion).toBe(1);
        expect(body.operations).toHaveLength(2);
        engine.destroy();
    });

    it('exposes a pending patch via peek before it is flushed', () => {
        const engine = new SyncEngine({ diagramId: 'd1', initialVersion: 1 });
        engine.enqueue({ entity: 'table', op: 'update', id: 't1', patch: { x: 5 } });
        expect(engine.peek('table', 't1')).toEqual({ x: 5 });
        expect(engine.peek('table', 'unknown')).toBeNull();
        engine.destroy();
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/context/storage-context/sync-engine.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar** `sync-engine.ts`

```ts
// src/context/storage-context/sync-engine.ts
import { apiFetch } from '@/lib/api-client';

export type SyncEntity =
    | 'diagram'
    | 'table'
    | 'relationship'
    | 'dependency'
    | 'area'
    | 'customType'
    | 'note';

export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncOperation {
    entity: SyncEntity;
    op: SyncOp;
    id: string;
    patch?: Record<string, unknown>;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export interface SyncConflictInfo {
    entity: SyncEntity;
    id: string;
}

export interface SyncEngineOptions {
    diagramId: string;
    initialVersion: number;
    flushDelayMs?: number;
    maxRetries?: number;
    onStatusChange?: (status: SyncStatus, message?: string) => void;
    onConflict?: (conflicts: SyncConflictInfo[]) => void;
}

const STORAGE_KEY_PREFIX = 'chartdb:sync-queue:';

export function collapseOperations(
    operations: SyncOperation[]
): SyncOperation[] {
    const byKey = new Map<string, SyncOperation>();
    for (const op of operations) {
        const key = `${op.entity}:${op.id}`;
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, op);
            continue;
        }
        if (op.op === 'delete') {
            byKey.set(key, { entity: op.entity, op: 'delete', id: op.id });
            continue;
        }
        if (prev.op === 'delete') {
            byKey.set(key, op);
            continue;
        }
        byKey.set(key, {
            entity: op.entity,
            op: prev.op === 'create' ? 'create' : 'update',
            id: op.id,
            patch: { ...prev.patch, ...op.patch },
        });
    }
    return [...byKey.values()];
}

export class SyncEngine {
    readonly diagramId: string;
    private queue = new Map<string, SyncOperation>();
    private inFlightSnapshot = new Map<string, SyncOperation>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private inFlight = false;
    private retryCount = 0;
    private version: number;
    private readonly flushDelayMs: number;
    private readonly maxRetries: number;
    private readonly onStatusChange?: SyncEngineOptions['onStatusChange'];
    private readonly onConflict?: SyncEngineOptions['onConflict'];
    private readonly storageKey: string;

    constructor(options: SyncEngineOptions) {
        this.diagramId = options.diagramId;
        this.version = options.initialVersion;
        this.flushDelayMs = options.flushDelayMs ?? 700;
        this.maxRetries = options.maxRetries ?? 5;
        this.onStatusChange = options.onStatusChange;
        this.onConflict = options.onConflict;
        this.storageKey = `${STORAGE_KEY_PREFIX}${this.diagramId}`;
        this.restoreQueue();
        this.attachLifecycleListeners();
    }

    enqueue(operation: SyncOperation): void {
        const key = `${operation.entity}:${operation.id}`;
        const existing = this.queue.get(key);
        const merged = existing
            ? collapseOperations([existing, operation])[0]
            : operation;
        this.queue.set(key, merged);
        this.persistQueue();
        this.scheduleFlush();
    }

    peek(entity: SyncEntity, id: string): Record<string, unknown> | null {
        const key = `${entity}:${id}`;
        const queued = this.queue.get(key) ?? this.inFlightSnapshot.get(key);
        if (!queued || queued.op === 'delete') return null;
        return queued.patch ?? null;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flushNow();
        }, this.flushDelayMs);
    }

    async flushNow(): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.inFlight || this.queue.size === 0) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.onStatusChange?.('offline');
            return;
        }

        this.inFlight = true;
        this.onStatusChange?.('saving');

        this.inFlightSnapshot = new Map(this.queue);
        const batch = [...this.queue.values()];
        this.queue.clear();
        this.persistQueue();

        try {
            const result = await apiFetch<{
                version: number;
                conflicts: SyncConflictInfo[];
            }>(`/diagrams/${this.diagramId}/sync`, {
                method: 'POST',
                body: JSON.stringify({
                    baseVersion: this.version,
                    operations: batch,
                }),
            });
            this.version = result.version;
            this.retryCount = 0;
            this.inFlightSnapshot.clear();
            this.onStatusChange?.(this.queue.size > 0 ? 'saving' : 'saved');
            if (result.conflicts.length > 0) this.onConflict?.(result.conflicts);
        } catch (err) {
            for (const op of batch) {
                const key = `${op.entity}:${op.id}`;
                const existing = this.queue.get(key);
                const merged = existing
                    ? collapseOperations([op, existing])[0]
                    : op;
                this.queue.set(key, merged);
            }
            this.inFlightSnapshot.clear();
            this.persistQueue();
            this.retryCount += 1;
            if (this.retryCount > this.maxRetries) {
                this.onStatusChange?.(
                    'error',
                    err instanceof Error ? err.message : 'Sync failed'
                );
            } else {
                const backoff = Math.min(1000 * 2 ** (this.retryCount - 1), 16000);
                this.onStatusChange?.('offline');
                setTimeout(() => void this.flushNow(), backoff);
            }
        } finally {
            this.inFlight = false;
            if (this.queue.size > 0 && this.retryCount === 0) {
                this.scheduleFlush();
            }
        }
    }

    private persistQueue(): void {
        try {
            const serializable = [...this.queue.values()];
            if (serializable.length === 0) {
                localStorage.removeItem(this.storageKey);
            } else {
                localStorage.setItem(this.storageKey, JSON.stringify(serializable));
            }
        } catch {
            // localStorage no disponible (modo privado, cuota) — la cola sigue solo en memoria
        }
    }

    private restoreQueue(): void {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const stored = JSON.parse(raw) as SyncOperation[];
            for (const op of stored) {
                this.queue.set(`${op.entity}:${op.id}`, op);
            }
        } catch {
            // almacenamiento corrupto o no disponible — se empieza con la cola vacía
        }
    }

    private handleFlushTrigger = (): void => {
        void this.flushNow();
    };

    private handleVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') void this.flushNow();
    };

    private handleOnline = (): void => {
        this.retryCount = 0;
        void this.flushNow();
    };

    private attachLifecycleListeners(): void {
        if (typeof window === 'undefined') return;
        window.addEventListener('beforeunload', this.handleFlushTrigger);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('online', this.handleOnline);
    }

    destroy(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        if (typeof window === 'undefined') return;
        window.removeEventListener('beforeunload', this.handleFlushTrigger);
        document.removeEventListener(
            'visibilitychange',
            this.handleVisibilityChange
        );
        window.removeEventListener('online', this.handleOnline);
    }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**



Run: `pnpm vitest run src/context/storage-context/sync-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Añadir un test de reintento con backoff**

Añadir a `sync-engine.test.ts`:

```ts
it('retries with backoff and eventually reports an error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network down'));
    const onStatusChange = vi.fn();
    const engine = new SyncEngine({
        diagramId: 'd1',
        initialVersion: 1,
        maxRetries: 2,
        onStatusChange,
    });

    engine.enqueue({ entity: 'table', op: 'update', id: 't1', patch: { x: 1 } });
    await vi.advanceTimersByTimeAsync(700); // primer intento falla
    await vi.advanceTimersByTimeAsync(1000); // reintento 1 falla
    await vi.advanceTimersByTimeAsync(2000); // reintento 2 falla -> error

    expect(onStatusChange).toHaveBeenCalledWith('error', 'network down');
    engine.destroy();
});
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/context/storage-context/sync-engine.test.ts`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `tsc -b --noEmit`
Expected: sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add src/context/storage-context/sync-engine.ts src/context/storage-context/sync-engine.test.ts
git commit -m "feat: add SyncEngine with batching, retry and offline queueing"
```

---



### Task 7: `sync-status-context` (estado de UI, separado del estado de servidor)

**Files:**

- Create: `src/context/sync-status-context/sync-status-context.tsx`
- Create: `src/hooks/use-sync-status.ts`

**Interfaces:**

- Consumes: `SyncStatus` de `src/context/storage-context/sync-engine.ts` (Task 6).
- Produces: `syncStatusContext`, `useSyncStatus()` — consumido por Task 8 (para publicar el estado) y Task 11 (para leerlo en la UI).

- [ ] **Step 1: Crear el contexto**

```tsx
// src/context/sync-status-context/sync-status-context.tsx
import { createContext } from 'react';
import type { SyncStatus } from '@/context/storage-context/sync-engine';

export interface SyncStatusContextValue {
    status: SyncStatus;
    errorMessage?: string;
    retry: () => void;
}

export const syncStatusContext = createContext<SyncStatusContextValue>({
    status: 'idle',
    retry: () => {},
});
```

- [ ] **Step 2: Crear el hook**

```ts
// src/hooks/use-sync-status.ts
import { useContext } from 'react';
import { syncStatusContext } from '@/context/sync-status-context/sync-status-context';

export const useSyncStatus = () => useContext(syncStatusContext);
```

- [ ] **Step 3: Typecheck**

Run: `tsc -b --noEmit`
Expected: sin errores (el contexto aún no se consume desde ningún sitio, es esperado)

- [ ] **Step 4: Commit**

```bash
git add src/context/sync-status-context/sync-status-context.tsx src/hooks/use-sync-status.ts
git commit -m "feat: add sync-status-context for UI-level save state"
```

---



### Task 8: Reescribir `ApiStorageProvider` sobre `SyncEngine`

**Files:**

- Modify: `src/context/storage-context/api-storage-provider.tsx`

**Interfaces:**

- Consumes: `SyncEngine`, `collapseOperations` (Task 6); `syncStatusContext` (Task 7); `apiFetch`, `buildIncludeQuery` (`src/lib/api-client.ts`, sin cambios); `StorageContext` (`src/context/storage-context/storage-context.tsx`, sin cambios de tipo).
- Produces: `ApiStorageProvider` ahora envuelve también `syncStatusContext.Provider` — usado por Task 9 (retirar los otros providers) y Task 11 (indicador visual).

Esta tarea reescribe el cuerpo de cada mutador de `ApiStorageProvider` para encolar en vez de llamar a `apiFetch` directamente, y hace que los `get*` de una sola entidad consulten primero la cola antes de ir a red. Los métodos de solo lectura (`listDiagrams`, `getDiagram`, `getConfig`, etc.) y los de ciclo de vida del diagrama (`addDiagram`, `deleteDiagram`, `deleteDiagram*`) no cambian.

- [ ] **Step 1: Escribir el test que falla (comportamiento observable de la reescritura)**

```tsx
// src/context/storage-context/api-storage-provider.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiStorageProvider } from './api-storage-provider';
import { useStorage } from '@/hooks/use-storage';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api-client')>(
        '@/lib/api-client'
    );
    return { ...actual, apiFetch: vi.fn() };
});

function Probe() {
    const storage = useStorage();
    const { status } = useSyncStatus();
    return (
        <button
            data-status={status}
            onClick={() =>
                storage.updateTable({ id: 't1', attributes: { name: 'renamed' } })
            }
        >
            update
        </button>
    );
}

describe('ApiStorageProvider + SyncEngine wiring', () => {
    beforeEach(() => {
        vi.mocked(apiFetch).mockReset();
        vi.useFakeTimers();
    });

    it('does not call apiFetch synchronously on updateTable; batches after debounce', async () => {
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.startsWith('/diagrams/') && path.endsWith('/sync')) {
                return { version: 2, conflicts: [] };
            }
            if (path.startsWith('/diagrams/')) {
                return { id: 'd1', version: 1, name: 'x' };
            }
            return undefined;
        });

        render(
            <ApiStorageProvider>
                <Probe />
            </ApiStorageProvider>
        );

        const button = screen.getByRole('button');
        button.click();

        expect(
            vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
        ).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(700);

        await waitFor(() => {
            expect(
                vi.mocked(apiFetch).mock.calls.filter(([p]) => p.includes('/sync'))
            ).toHaveLength(1);
        });
    });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/context/storage-context/api-storage-provider.test.tsx`
Expected: FAIL — hoy `updateTable` llama `apiFetch` directamente y de forma inmediata (`/tables/t1`, no `/sync`).

- [ ] **Step 3: Reescribir** `api-storage-provider.tsx`

Reemplazar el contenido completo del archivo:

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { Note } from '@/lib/domain/note';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { ChartDBConfig } from '@/lib/domain/config';
import { apiFetch, buildIncludeQuery } from '@/lib/api-client';
import type { SyncEntity, SyncStatus } from './sync-engine';
import { SyncEngine } from './sync-engine';
import { syncStatusContext } from '@/context/sync-status-context/sync-status-context';

const toDate = (v: string | number | Date | undefined): Date =>
    v ? new Date(v) : new Date();

const normalizeDiagram = (d: any): Diagram => ({
    ...d,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
});

export const ApiStorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const [status, setStatus] = useState<SyncStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string>();
    const engineRef = useRef<SyncEngine | null>(null);

    const ensureEngine = useCallback(
        (diagramId: string, version: number): SyncEngine => {
            if (engineRef.current?.diagramId === diagramId) {
                return engineRef.current;
            }
            engineRef.current?.destroy();
            const engine = new SyncEngine({
                diagramId,
                initialVersion: version,
                onStatusChange: (nextStatus, message) => {
                    setStatus(nextStatus);
                    setErrorMessage(message);
                },
                onConflict: (conflicts) => {
                    // eslint-disable-next-line no-console
                    console.warn('Sync conflicts overwritten by another session', conflicts);
                },
            });
            engineRef.current = engine;
            return engine;
        },
        []
    );

    const retry = useCallback(() => {
        void engineRef.current?.flushNow();
    }, []);

    const enqueue = useCallback(
        (
            diagramId: string,
            entity: SyncEntity,
            op: 'create' | 'update' | 'delete',
            id: string,
            patch?: Record<string, unknown>
        ) => {
            // En el flujo normal, ensureEngine ya fue llamado por getDiagram/
            // addDiagram antes de que el usuario pueda editar nada, así que
            // engineRef.current ya apunta al diagrama correcto. El fallback a
            // version=1 solo cubre el caso defensivo de un mutador llamado
            // antes de que el diagrama activo se haya resuelto.
            const engine =
                engineRef.current?.diagramId === diagramId
                    ? engineRef.current
                    : ensureEngine(diagramId, 1);
            engine.enqueue({ entity, op, id, patch });
        },
        [ensureEngine]
    );

    const peekOrFetch = useCallback(
        async <T,>(
            entity: SyncEntity,
            id: string,
            path: string
        ): Promise<T | undefined> => {
            const cached = engineRef.current?.peek(entity, id);
            if (cached) return { id, ...cached } as unknown as T;
            try {
                return await apiFetch<T>(path);
            } catch {
                return undefined;
            }
        },
        []
    );

    // ─── Config / filter (baja frecuencia, sin batching) ──────────────────
    const getConfig = useCallback(async (): Promise<
        ChartDBConfig | undefined
    > => {
        const data = await apiFetch<{ defaultDiagramId: string } | null>(
            '/me/config'
        );
        if (!data) return undefined;
        return { defaultDiagramId: data.defaultDiagramId || '' };
    }, []);

    const updateConfig = useCallback(
        async (config: Partial<ChartDBConfig>): Promise<void> => {
            await apiFetch('/me/config', {
                method: 'PUT',
                body: JSON.stringify({
                    defaultDiagramId: config.defaultDiagramId ?? null,
                }),
            });
        },
        []
    );

    const getDiagramFilter = useCallback(
        async (diagramId: string): Promise<DiagramFilter | undefined> => {
            const data = await apiFetch<DiagramFilter | null>(
                `/diagrams/${diagramId}/filter`
            );
            return data ?? undefined;
        },
        []
    );

    const updateDiagramFilter = useCallback(
        async (diagramId: string, filter: DiagramFilter): Promise<void> => {
            await apiFetch(`/diagrams/${diagramId}/filter`, {
                method: 'PUT',
                body: JSON.stringify(filter),
            });
        },
        []
    );

    const deleteDiagramFilter = useCallback(
        async (diagramId: string): Promise<void> => {
            await apiFetch(`/diagrams/${diagramId}/filter`, { method: 'DELETE' });
        },
        []
    );

    // ─── Diagram lifecycle (sin batching: creación/borrado/listado) ───────
    const addDiagram = useCallback(
        async ({ diagram }: { diagram: Diagram }) => {
            await apiFetch('/diagrams', {
                method: 'POST',
                body: JSON.stringify(diagram),
            });
            ensureEngine(diagram.id, diagram.version ?? 1);
        },
        [ensureEngine]
    );

    const listDiagrams = useCallback(
        async (options?: Parameters<StorageContext['listDiagrams']>[0]) => {
            const data = await apiFetch<any[]>(
                `/diagrams${buildIncludeQuery(options)}`
            );
            return data.map(normalizeDiagram);
        },
        []
    );

    const getDiagram = useCallback(
        async (
            id: string,
            options?: Parameters<StorageContext['getDiagram']>[1]
        ): Promise<Diagram | undefined> => {
            try {
                const data = await apiFetch<any>(
                    `/diagrams/${id}${buildIncludeQuery(options)}`
                );
                const diagram = normalizeDiagram(data);
                ensureEngine(id, diagram.version ?? 1);
                return diagram;
            } catch {
                return undefined;
            }
        },
        [ensureEngine]
    );

    const updateDiagram = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Diagram>;
        }) => {
            enqueue(id, 'diagram', 'update', id, {
                name: attributes.name,
                databaseType: attributes.databaseType,
                databaseEdition: attributes.databaseEdition,
            });
        },
        [enqueue]
    );

    const deleteDiagram = useCallback(async (id: string) => {
        await apiFetch(`/diagrams/${id}`, { method: 'DELETE' });
    }, []);

    // ─── Tables ─────────────────────────────────────────────────────────
    const addTable = useCallback(
        ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            enqueue(diagramId, 'table', 'create', table.id, table as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getTable = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<DBTable>('table', id, `/diagrams/${diagramId}/tables/${id}`),
        [peekOrFetch]
    );

    const updateTable = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<DBTable> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId) enqueue(diagramId, 'table', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const putTable = useCallback(
        ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            enqueue(diagramId, 'table', 'update', table.id, table as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteTable = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'table', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listTables = useCallback(async (diagramId: string) => {
        return apiFetch<DBTable[]>(`/diagrams/${diagramId}/tables`);
    }, []);

    const deleteDiagramTables = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/tables`, { method: 'DELETE' });
    }, []);

    // ─── Relationships ──────────────────────────────────────────────────
    const addRelationship = useCallback(
        ({
            diagramId,
            relationship,
        }: {
            diagramId: string;
            relationship: DBRelationship;
        }) => {
            enqueue(diagramId, 'relationship', 'create', relationship.id, relationship as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getRelationship = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<DBRelationship>(
                'relationship',
                id,
                `/diagrams/${diagramId}/relationships/${id}`
            ),
        [peekOrFetch]
    );

    const updateRelationship = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<DBRelationship> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'relationship', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteRelationship = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'relationship', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listRelationships = useCallback(async (diagramId: string) => {
        return apiFetch<DBRelationship[]>(`/diagrams/${diagramId}/relationships`);
    }, []);

    const deleteDiagramRelationships = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/relationships`, {
            method: 'DELETE',
        });
    }, []);

    // ─── Dependencies ───────────────────────────────────────────────────
    const addDependency = useCallback(
        ({ diagramId, dependency }: { diagramId: string; dependency: DBDependency }) => {
            enqueue(diagramId, 'dependency', 'create', dependency.id, dependency as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getDependency = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<DBDependency>(
                'dependency',
                id,
                `/diagrams/${diagramId}/dependencies/${id}`
            ),
        [peekOrFetch]
    );

    const updateDependency = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<DBDependency> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'dependency', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteDependency = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'dependency', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listDependencies = useCallback(async (diagramId: string) => {
        return apiFetch<DBDependency[]>(`/diagrams/${diagramId}/dependencies`);
    }, []);

    const deleteDiagramDependencies = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/dependencies`, {
            method: 'DELETE',
        });
    }, []);

    // ─── Areas ──────────────────────────────────────────────────────────
    const addArea = useCallback(
        ({ diagramId, area }: { diagramId: string; area: Area }) => {
            enqueue(diagramId, 'area', 'create', area.id, area as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getArea = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<Area>('area', id, `/diagrams/${diagramId}/areas/${id}`),
        [peekOrFetch]
    );

    const updateArea = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<Area> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId) enqueue(diagramId, 'area', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteArea = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'area', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listAreas = useCallback(async (diagramId: string) => {
        return apiFetch<Area[]>(`/diagrams/${diagramId}/areas`);
    }, []);

    const deleteDiagramAreas = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/areas`, { method: 'DELETE' });
    }, []);

    // ─── Custom types ───────────────────────────────────────────────────
    const addCustomType = useCallback(
        ({
            diagramId,
            customType,
        }: {
            diagramId: string;
            customType: DBCustomType;
        }) => {
            enqueue(diagramId, 'customType', 'create', customType.id, customType as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getCustomType = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<DBCustomType>(
                'customType',
                id,
                `/diagrams/${diagramId}/custom-types/${id}`
            ),
        [peekOrFetch]
    );

    const updateCustomType = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<DBCustomType> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'customType', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteCustomType = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'customType', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listCustomTypes = useCallback(async (diagramId: string) => {
        return apiFetch<DBCustomType[]>(`/diagrams/${diagramId}/custom-types`);
    }, []);

    const deleteDiagramCustomTypes = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/custom-types`, {
            method: 'DELETE',
        });
    }, []);

    // ─── Notes ──────────────────────────────────────────────────────────
    const addNote = useCallback(
        ({ diagramId, note }: { diagramId: string; note: Note }) => {
            enqueue(diagramId, 'note', 'create', note.id, note as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const getNote = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) =>
            peekOrFetch<Note>('note', id, `/diagrams/${diagramId}/notes/${id}`),
        [peekOrFetch]
    );

    const updateNote = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<Note> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId) enqueue(diagramId, 'note', 'update', id, attributes as any);
            return Promise.resolve();
        },
        [enqueue]
    );

    const deleteNote = useCallback(
        ({ diagramId, id }: { diagramId: string; id: string }) => {
            enqueue(diagramId, 'note', 'delete', id);
            return Promise.resolve();
        },
        [enqueue]
    );

    const listNotes = useCallback(async (diagramId: string) => {
        return apiFetch<Note[]>(`/diagrams/${diagramId}/notes`);
    }, []);

    const deleteDiagramNotes = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/notes`, { method: 'DELETE' });
    }, []);

    const contextValue = useMemo<StorageContext>(
        () => ({
            getConfig,
            updateConfig,
            getDiagramFilter,
            updateDiagramFilter,
            deleteDiagramFilter,
            addDiagram,
            listDiagrams,
            getDiagram,
            updateDiagram,
            deleteDiagram,
            addTable,
            getTable,
            updateTable,
            putTable,
            deleteTable,
            listTables,
            deleteDiagramTables,
            addRelationship,
            getRelationship,
            updateRelationship,
            deleteRelationship,
            listRelationships,
            deleteDiagramRelationships,
            addDependency,
            getDependency,
            updateDependency,
            deleteDependency,
            listDependencies,
            deleteDiagramDependencies,
            addArea,
            getArea,
            updateArea,
            deleteArea,
            listAreas,
            deleteDiagramAreas,
            addCustomType,
            getCustomType,
            updateCustomType,
            deleteCustomType,
            listCustomTypes,
            deleteDiagramCustomTypes,
            addNote,
            getNote,
            updateNote,
            deleteNote,
            listNotes,
            deleteDiagramNotes,
        }),
        [
            getConfig,
            updateConfig,
            getDiagramFilter,
            updateDiagramFilter,
            deleteDiagramFilter,
            addDiagram,
            listDiagrams,
            getDiagram,
            updateDiagram,
            deleteDiagram,
            addTable,
            getTable,
            updateTable,
            putTable,
            deleteTable,
            listTables,
            deleteDiagramTables,
            addRelationship,
            getRelationship,
            updateRelationship,
            deleteRelationship,
            listRelationships,
            deleteDiagramRelationships,
            addDependency,
            getDependency,
            updateDependency,
            deleteDependency,
            listDependencies,
            deleteDiagramDependencies,
            addArea,
            getArea,
            updateArea,
            deleteArea,
            listAreas,
            deleteDiagramAreas,
            addCustomType,
            getCustomType,
            updateCustomType,
            deleteCustomType,
            listCustomTypes,
            deleteDiagramCustomTypes,
            addNote,
            getNote,
            updateNote,
            deleteNote,
            listNotes,
            deleteDiagramNotes,
        ]
    );

    const syncStatusValue = useMemo(
        () => ({ status, errorMessage, retry }),
        [status, errorMessage, retry]
    );

    return (
        <storageContext.Provider value={contextValue}>
            <syncStatusContext.Provider value={syncStatusValue}>
                {children}
            </syncStatusContext.Provider>
        </storageContext.Provider>
    );
};
```



Nota sobre `putTable`: en el flujo actual, `putTable` reemplaza la tabla entera (usado al restaurar un estado); se trata igual que un `update` de cara al motor de sync (el backend hace upsert en ambos casos).

Nota sobre `updateTable`/`updateRelationship`/`updateDependency`/`updateArea`/`updateCustomType`/`updateNote`: estas firmas de `StorageContext` no reciben `diagramId` (ver `src/context/storage-context/storage-context.tsx:59-63` y equivalentes). Se resuelven contra `engineRef.current?.diagramId`, que siempre corresponde al único diagrama abierto en el editor en un momento dado — esto es seguro porque `getDiagram`/`addDiagram` inicializan el motor antes de que el usuario pueda editar nada.

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `pnpm vitest run src/context/storage-context/api-storage-provider.test.tsx`
Expected: PASS

- [ ] **Step 5: Ejecutar toda la suite de storage-context para detectar regresiones**

Run: `pnpm vitest run src/context/storage-context`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `tsc -b --noEmit`
Expected: sin errores

- [ ] **Step 7: Commit**

```bash
git add src/context/storage-context/api-storage-provider.tsx src/context/storage-context/api-storage-provider.test.tsx
git commit -m "feat: route ApiStorageProvider mutations through SyncEngine"
```

---



### Task 9: Retirar Dexie y `SupabaseStorageProvider`

**Files:**

- Modify: `src/context/storage-context/storage-provider-selector.tsx`
- Delete: `src/context/storage-context/storage-provider.tsx`
- Delete: `src/context/storage-context/supabase-storage-provider.tsx`
- Modify: `package.json` (quitar `dexie` de `dependencies`)

**Interfaces:**

- Consumes: `ApiStorageProvider` (Task 8).
- Produces: `StorageProviderSelector` ahora renderiza siempre `ApiStorageProvider`.

- [ ] **Step 1: Verificar que nada más importa los archivos a borrar**

Run: `grep -rn "from '.*storage-provider'" src --include=*.tsx --include=*.ts | grep -v api-storage-provider | grep -v storage-provider-selector`
Expected: solo la línea de `storage-provider-selector.tsx` que se va a modificar en el siguiente paso.

- [ ] **Step 2: Simplificar** `storage-provider-selector.tsx`

```tsx
import React from 'react';
import { ApiStorageProvider } from './api-storage-provider';

export const StorageProviderSelector: React.FC<React.PropsWithChildren> = ({
    children,
}) => <ApiStorageProvider>{children}</ApiStorageProvider>;

export default StorageProviderSelector;
```

- [ ] **Step 3: Borrar los proveedores retirados**

```bash
git rm src/context/storage-context/storage-provider.tsx
git rm src/context/storage-context/supabase-storage-provider.tsx
```

- [ ] **Step 4: Quitar** `dexie` **de** `package.json` **y reinstalar**

En `package.json`, eliminar la línea `"dexie": "^4.4.5",` de `dependencies`.

Run: `pnpm install`
Expected: lockfile actualizado sin `dexie`

- [ ] **Step 5: Build completo para detectar imports rotos**

Run: `pnpm run lint && tsc -b && pnpm build`
Expected: sin errores. Si aparece algún import roto a `storage-provider`/`supabase-storage-provider` fuera de `storage-context`, resolverlo antes de continuar (debería ser un archivo que hoy usa `useStorage()` normalmente y no necesita cambios, pero confirmar).

- [ ] **Step 6: Ejecutar toda la suite de tests**

Run: `pnpm test -- run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/context/storage-context/storage-provider-selector.tsx
git commit -m "chore: retire Dexie/IndexedDB and direct-Supabase storage providers"
```

---



### Task 10: Indicador visual de guardado en `LastSaved`

**Files:**

- Modify: `src/pages/editor-page/top-navbar/last-saved.tsx`

**Interfaces:**

- Consumes: `useSyncStatus()` (Task 7).

- [ ] **Step 1: Reescribir el componente**

```tsx
import React, { useEffect, useState } from 'react';
import TimeAgo from 'timeago-react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { Badge } from '@/components/badge/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useTranslation } from 'react-i18next';
import type { LocaleFunc } from 'timeago.js';
import { register as registerLocale } from 'timeago.js';
import { Save, Loader2, AlertTriangle, WifiOff } from 'lucide-react';

export interface LastSavedProps {}

const timeAgolocaleFromLanguage = async (
    language: string
): Promise<{ locale: LocaleFunc; lang: string }> => {
    let locale: LocaleFunc;
    let lang: string;
    switch (language) {
        case 'es':
            locale = (await import('timeago.js/lib/lang/es')).default;
            lang = 'es';
            break;
        default:
            locale = (await import('timeago.js/lib/lang/en_US')).default;
            lang = 'en_US';
            break;
    }
    return { locale, lang };
};

export const LastSaved: React.FC<LastSavedProps> = () => {
    const { currentDiagram } = useChartDB();
    const { status, errorMessage, retry } = useSyncStatus();
    const { i18n } = useTranslation();
    const [language, setLanguage] = useState<string>('en_US');

    useEffect(() => {
        const updateLocale = async () => {
            const { locale, lang } = await timeAgolocaleFromLanguage(
                i18n.language
            );
            registerLocale(i18n.language, locale);
            setLanguage(lang);
        };
        updateLocale();
    }, [i18n.language]);

    if (status === 'saving') {
        return (
            <Badge variant="secondary" className="flex gap-1.5 whitespace-nowrap">
                <Loader2 size={16} className="animate-spin" />
                <span>Guardando…</span>
            </Badge>
        );
    }

    if (status === 'offline') {
        return (
            <Badge variant="secondary" className="flex gap-1.5 whitespace-nowrap">
                <WifiOff size={16} />
                <span>Sin conexión</span>
            </Badge>
        );
    }

    if (status === 'error') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button onClick={retry} type="button">
                        <Badge
                            variant="destructive"
                            className="flex gap-1.5 whitespace-nowrap"
                        >
                            <AlertTriangle size={16} />
                            <span>Error al guardar</span>
                        </Badge>
                    </button>
                </TooltipTrigger>
                <TooltipContent>{errorMessage ?? 'Reintentar'}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger>
                <Badge
                    variant="secondary"
                    className="flex gap-1.5 whitespace-nowrap"
                >
                    <Save size={16} />
                    <TimeAgo
                        datetime={currentDiagram.updatedAt}
                        locale={language}
                    />
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                {currentDiagram.updatedAt.toLocaleString()}
            </TooltipContent>
        </Tooltip>
    );
};
```

Se recortan los locales de `timeago.js` a `es`/`en_US` en este snippet por brevedad — mantener en el archivo real la lista completa de idiomas ya existente (no se retira soporte de idiomas, solo se muestra el diff relevante al indicador de estado).

- [ ] **Step 2: Escribir un test de render por estado**

```tsx
// src/pages/editor-page/top-navbar/last-saved.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LastSaved } from './last-saved';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import { syncStatusContext } from '@/context/sync-status-context/sync-status-context';

function renderWithStatus(status: 'idle' | 'saving' | 'saved' | 'error' | 'offline') {
    return render(
        <chartDBContext.Provider
            value={
                {
                    currentDiagram: { updatedAt: new Date() },
                } as any
            }
        >
            <syncStatusContext.Provider
                value={{ status, retry: () => {} }}
            >
                <LastSaved />
            </syncStatusContext.Provider>
        </chartDBContext.Provider>
    );
}

describe('LastSaved', () => {
    it('shows "Guardando…" while saving', () => {
        renderWithStatus('saving');
        expect(screen.getByText('Guardando…')).toBeInTheDocument();
    });

    it('shows "Sin conexión" when offline', () => {
        renderWithStatus('offline');
        expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });

    it('shows "Error al guardar" on error', () => {
        renderWithStatus('error');
        expect(screen.getByText('Error al guardar')).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/pages/editor-page/top-navbar/last-saved.test.tsx`
Expected: PASS

- [ ] **Step 4: Typecheck y lint**

Run: `pnpm run lint && tsc -b --noEmit`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor-page/top-navbar/last-saved.tsx src/pages/editor-page/top-navbar/last-saved.test.tsx
git commit -m "feat: reflect live sync status in the LastSaved indicator"
```

---



### Task 11: Documentación de rollout

**Files:**

- Modify: `server/README.md`

- [ ] **Step 1: Actualizar la sección "Rollout gradual"**

Reemplazar la sección final de `server/README.md`:

```markdown
## Rollout

El backend es ahora la única fuente de persistencia: no existen ya
`SupabaseStorageProvider` ni almacenamiento local (Dexie/IndexedDB) como
alternativas. Antes de desplegar:

1. Aplicar `server/sql/2026-09-10-diagrams-add-version-column.sql` contra la
   base de datos de producción.
2. Desplegar la API con el endpoint `POST /diagrams/:id/sync`.
3. Desplegar el frontend con `VITE_API_URL` apuntando a la API.
4. Confirmar en el indicador de la barra superior ("Guardando…/Guardado/Error/
   Sin conexión") que la sincronización funciona antes de anunciar el cambio
   a los usuarios.
```

- [ ] **Step 2: Commit**

```bash
git add server/README.md
git commit -m "docs: update rollout notes for the sync engine and API-only persistence"
```

---



### Task 12: Benchmark de requests HTTP antes/después

**Files:**

- Create: `src/context/storage-context/api-storage-provider.benchmark.test.tsx`
- Modify: `docs/superpowers/specs/2026-09-10-sync-engine-design.md` (añadir los resultados al final)

**Interfaces:**

- Consumes: `ApiStorageProvider` (Task 8), `useStorage` (`src/hooks/use-storage.ts`).

El código anterior a este plan ya no existe tras la Task 8, así que el "antes" se documenta con los números ya confirmados durante la auditoría (Sección "El problema real" de la spec: 3 requests por edición de campo — 1 GET + 2 PATCH — sin agrupar). El "después" se mide con un test que reproduce las mismas ráfagas y cuenta las llamadas de red reales.

- [ ] **Step 1: Escribir el test de benchmark**

```tsx
// src/context/storage-context/api-storage-provider.benchmark.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiStorageProvider } from './api-storage-provider';
import { useStorage } from '@/hooks/use-storage';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api-client')>(
        '@/lib/api-client'
    );
    return { ...actual, apiFetch: vi.fn() };
});

function EditBurst({ count }: { count: number }) {
    const storage = useStorage();
    return (
        <button
            onClick={() => {
                for (let i = 0; i < count; i++) {
                    storage.updateTable({
                        id: `t${i % 10}`,
                        attributes: { name: `name-${i}` },
                    });
                }
            }}
        >
            burst
        </button>
    );
}

describe('sync engine benchmark: requests per edit burst', () => {
    beforeEach(() => {
        vi.mocked(apiFetch).mockReset();
        vi.useFakeTimers();
        vi.mocked(apiFetch).mockImplementation(async (path: string) => {
            if (path.endsWith('/sync')) return { version: 2, conflicts: [] };
            if (path.startsWith('/diagrams/')) return { id: 'd1', version: 1 };
            return undefined;
        });
    });

    it('20 field edits across 10 tables produce exactly 1 request (vs. 60 before)', async () => {
        render(
            <ApiStorageProvider>
                <EditBurst count={20} />
            </ApiStorageProvider>
        );
        screen.getByRole('button').click();
        await vi.advanceTimersByTimeAsync(700);
        await waitFor(() => {
            const syncCalls = vi
                .mocked(apiFetch)
                .mock.calls.filter(([p]) => p.includes('/sync'));
            expect(syncCalls).toHaveLength(1);
        });
    });

    it('100 table creates (large import) still produce exactly 1 request', async () => {
        function ImportBurst() {
            const storage = useStorage();
            return (
                <button
                    onClick={() => {
                        for (let i = 0; i < 100; i++) {
                            storage.addTable({
                                diagramId: 'd1',
                                table: { id: `t${i}`, name: `table_${i}` } as any,
                            });
                        }
                    }}
                >
                    import
                </button>
            );
        }
        render(
            <ApiStorageProvider>
                <ImportBurst />
            </ApiStorageProvider>
        );
        screen.getByRole('button').click();
        await vi.advanceTimersByTimeAsync(700);
        await waitFor(() => {
            const syncCalls = vi
                .mocked(apiFetch)
                .mock.calls.filter(([p]) => p.includes('/sync'));
            expect(syncCalls).toHaveLength(1);
        });
    });
});
```

- [ ] **Step 2: Ejecutar y registrar el resultado**

Run: `pnpm vitest run src/context/storage-context/api-storage-provider.benchmark.test.tsx`
Expected: PASS — confirma 1 request en ambos escenarios.

- [ ] **Step 3: Añadir los números a la spec**

Añadir al final de `docs/superpowers/specs/2026-09-10-sync-engine-design.md`:

```markdown
## Resultado del benchmark (Task 12 del plan de implementación)

ANTES (ApiStorageProvider previo a este plan, confirmado por lectura de
código en `chartdb-provider.tsx:654-719`):
- 20 ediciones de campo: 60 requests HTTP (20× GET + 20× PATCH diagrama + 20× PATCH tabla)
- Importar 100 tablas: 100 requests HTTP (uno por tabla)

DESPUÉS (SyncEngine, Task 6-8):
- 20 ediciones de campo: 1 request HTTP
- Importar 100 tablas: 1 request HTTP

DIFERENCIA: -98% a -99% en número de requests para ambos escenarios.
```

- [ ] **Step 4: Commit**

```bash
git add src/context/storage-context/api-storage-provider.benchmark.test.tsx docs/superpowers/specs/2026-09-10-sync-engine-design.md
git commit -m "test: benchmark request count before/after the sync engine"
```

---



### Task 13: Verificación final

**Files:** ninguno (solo comandos)

- [ ] **Step 1: Lint, typecheck, build y tests del frontend**

Run: `pnpm run lint && tsc -b && pnpm build && pnpm test -- run`
Expected: todo en verde

- [ ] **Step 2: Lint, typecheck, build y tests del backend**

Run: `cd server && pnpm typecheck && pnpm build && pnpm test`
Expected: todo en verde

- [ ] **Step 3: Confirmar que no queda ninguna referencia a Dexie/IndexedDB/Supabase-directo**

Run: `grep -rniE "dexie|indexeddb" src server --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: sin resultados

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "chore: final verification pass for the sync engine rollout"
```

