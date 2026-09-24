import type { PoolClient } from 'pg';
import { ZodError } from 'zod';
import { AppError } from '../../lib/types.js';
import { logger } from '../../lib/logger.js';
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
import {
    ACCESS_ROLE_SQL,
    diagramsService,
} from '../diagrams/diagrams.service.js';
import type {
    AreaDto,
    CustomTypeDto,
    DependencyDto,
    NoteDto,
    RelationshipDto,
    TableDto,
} from '../../lib/mappers.js';

export type SubEntity = 'field' | 'index' | 'checkConstraint';

export type SyncEntity =
    | 'diagram'
    | 'table'
    | SubEntity
    | 'relationship'
    | 'dependency'
    | 'area'
    | 'customType'
    | 'note';

export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncOperation {
    /** Id único de la op (lo genera el cliente); se usa en applied/rejected. */
    opId?: string;
    entity: SyncEntity;
    op: SyncOp;
    id: string;
    /** tableId para field/index/checkConstraint. */
    parentId?: string;
    /** Solo en create de sub-entidad: insertar tras este id (null = al principio). */
    afterId?: string | null;
    patch?: Record<string, unknown>;
}

export interface SyncRequest {
    baseVersion: number;
    sessionId?: string;
    /** Id estable del lote: un reintento con el mismo batchId no se reaplica. */
    batchId?: string;
    operations: SyncOperation[];
}

export interface SyncConflict {
    entity: SyncEntity;
    id: string;
}

export type RejectReason =
    'entity_deleted' | 'validation_failed' | 'invalid_data';

export interface RejectedOperation {
    opId?: string;
    entity: SyncEntity;
    id: string;
    reason: RejectReason;
}

export interface SyncResult {
    version: number;
    conflicts: SyncConflict[];
    applied: string[];
    rejected: RejectedOperation[];
}

const SUB_ENTITY_COLUMN: Record<SubEntity, string> = {
    field: 'fields',
    index: 'indexes',
    checkConstraint: 'check_constraints',
};

const isSubEntity = (entity: SyncEntity): entity is SubEntity =>
    entity in SUB_ENTITY_COLUMN;

const opKey = (op: SyncOperation) =>
    op.parentId
        ? `${op.entity}:${op.parentId}:${op.id}`
        : `${op.entity}:${op.id}`;

export function collapseOperations(
    operations: SyncOperation[]
): SyncOperation[] {
    const byKey = new Map<string, SyncOperation>();
    for (const op of operations) {
        const key = opKey(op);
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, op);
            continue;
        }
        const base = {
            ...(op.opId ? { opId: op.opId } : {}),
            entity: op.entity,
            id: op.id,
            ...(op.parentId ? { parentId: op.parentId } : {}),
        };
        if (op.op === 'delete') {
            byKey.set(key, { ...base, op: 'delete' });
            continue;
        }
        if (prev.op === 'delete') {
            byKey.set(key, op);
            continue;
        }
        const afterId =
            prev.op === 'create' && prev.afterId !== undefined
                ? { afterId: prev.afterId }
                : {};
        byKey.set(key, {
            ...base,
            op: prev.op === 'create' ? 'create' : 'update',
            ...afterId,
            patch: { ...prev.patch, ...op.patch },
        });
    }
    return [...byKey.values()];
}

/**
 * Aplica una op sobre UN elemento de un array JSONB de db_tables (columnas,
 * índices o CHECK). La fila se bloquea con FOR UPDATE para que dos lotes
 * concurrentes sobre la misma tabla se serialicen en vez de pisarse.
 */
async function applySubEntityOperation(
    client: PoolClient,
    diagramId: string,
    op: SyncOperation & { entity: SubEntity }
): Promise<void> {
    if (!op.parentId) {
        throw new AppError(400, 'parentId is required', 'validation_failed');
    }
    const column = SUB_ENTITY_COLUMN[op.entity];
    const { rows } = await client.query(
        `SELECT ${column} FROM db_tables WHERE diagram_id = $1 AND id = $2 FOR UPDATE`,
        [diagramId, op.parentId]
    );
    if (!rows[0]) {
        throw new AppError(404, 'Table not found', 'not_found');
    }
    const items = [
        ...((rows[0][column] as Record<string, unknown>[] | null) ?? []),
    ];
    const index = items.findIndex((item) => item.id === op.id);

    if (op.op === 'delete') {
        if (index === -1) return;
        items.splice(index, 1);
    } else if (op.op === 'update' || index !== -1) {
        // create sobre un id existente = update (reintento o create duplicado)
        if (index === -1) {
            throw new AppError(404, 'Element not found', 'not_found');
        }
        items[index] = { ...items[index], ...op.patch, id: op.id };
    } else {
        const element = { ...op.patch, id: op.id };
        if (op.afterId === null) {
            items.unshift(element);
        } else {
            const after =
                op.afterId !== undefined
                    ? items.findIndex((item) => item.id === op.afterId)
                    : -1;
            if (after === -1) items.push(element);
            else items.splice(after + 1, 0, element);
        }
    }

    await client.query(
        `UPDATE db_tables SET ${column} = $1 WHERE diagram_id = $2 AND id = $3`,
        [JSON.stringify(items), diagramId, op.parentId]
    );
}

async function ignoreNotFound(fn: () => Promise<void>): Promise<void> {
    try {
        await fn();
    } catch (err) {
        if (err instanceof AppError && err.statusCode === 404) return;
        throw err;
    }
}

export async function applyOperation(
    client: PoolClient,
    diagramId: string,
    userId: string,
    op: SyncOperation
): Promise<void> {
    if (isSubEntity(op.entity)) {
        return applySubEntityOperation(
            client,
            diagramId,
            op as SyncOperation & { entity: SubEntity }
        );
    }
    switch (op.entity) {
        case 'diagram': {
            if (op.op !== 'update') return;
            // Un patch de diagrama vacío no tiene nada que aplicar, pero
            // `diagramPatchSchema` lo rechaza con ZodError, lo que abortaría
            // la transacción entera del batch (ninguna operación se guardaría
            // y el cliente reintentaría el lote envenenado para siempre). Se
            // trata como no-op: `updated_at`/`version` ya los actualiza
            // syncService.apply al final del batch.
            if (!op.patch || Object.keys(op.patch).length === 0) return;
            const patch = diagramPatchSchema.parse(op.patch);
            await diagramsService.update(client, diagramId, patch);
            return;
        }
        case 'table': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteTable(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = tablePatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateTable(client, op.id, parsed)
                );
                return;
            }
            const parsed = tableSchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertTable(
                client,
                diagramId,
                parsed as TableDto,
                userId
            );
            return;
        }
        case 'relationship': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteRelationship(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = relationshipPatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateRelationship(client, op.id, parsed)
                );
                return;
            }
            const parsed = relationshipSchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertRelationship(
                client,
                diagramId,
                parsed as RelationshipDto,
                userId
            );
            return;
        }
        case 'dependency': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteDependency(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = dependencyPatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateDependency(client, op.id, parsed)
                );
                return;
            }
            const parsed = dependencySchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertDependency(
                client,
                diagramId,
                parsed as DependencyDto,
                userId
            );
            return;
        }
        case 'area': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteArea(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = areaPatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateArea(client, op.id, parsed)
                );
                return;
            }
            const parsed = areaSchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertArea(
                client,
                diagramId,
                parsed as AreaDto,
                userId
            );
            return;
        }
        case 'customType': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteCustomType(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = customTypePatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateCustomType(client, op.id, parsed)
                );
                return;
            }
            const parsed = customTypeSchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertCustomType(
                client,
                diagramId,
                parsed as CustomTypeDto,
                userId
            );
            return;
        }
        case 'note': {
            if (op.op === 'delete') {
                await ignoreNotFound(() =>
                    diagramsService.deleteNote(client, diagramId, op.id)
                );
                return;
            }
            if (op.op === 'update') {
                const parsed = notePatchSchema.parse(op.patch ?? {});
                await ignoreNotFound(() =>
                    diagramsService.updateNote(client, op.id, parsed)
                );
                return;
            }
            const parsed = noteSchema.parse({ id: op.id, ...op.patch });
            await diagramsService.upsertNote(
                client,
                diagramId,
                parsed as NoteDto,
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
        // Se consulta el rol ANTES del `FOR UPDATE`: RLS oculta la fila de
        // `diagrams` a quien no puede actualizarla, así que un viewer
        // recibiría un 404 engañoso en vez de un 403.
        const { rows: roleRows } = await client.query(
            `SELECT ${ACCESS_ROLE_SQL} AS access_role FROM diagrams d WHERE d.id = $1`,
            [diagramId]
        );
        const accessRole = roleRows[0]?.access_role as
            string | null | undefined;
        if (!accessRole) {
            throw new AppError(404, 'Diagram not found', 'not_found');
        }
        if (accessRole === 'viewer') {
            throw new AppError(
                403,
                'Read-only access to this diagram',
                'forbidden_role'
            );
        }

        const { rows } = await client.query(
            `SELECT version, last_sync_session_id FROM diagrams WHERE id = $1 FOR UPDATE`,
            [diagramId]
        );
        if (!rows[0]) {
            throw new AppError(404, 'Diagram not found', 'not_found');
        }
        const currentVersion = Number(rows[0].version ?? 1);
        const lastSyncSessionId = (rows[0].last_sync_session_id ?? null) as
            string | null;
        const versionMoved = currentVersion !== request.baseVersion;
        // `version` is a single diagram-wide counter, not per row, so a
        // mismatch alone doesn't mean another collaborator touched these
        // rows — it also happens when THIS session retries a batch whose
        // earlier ack was lost after the server had already applied it. Only
        // treat it as a real conflict when a *different* session was the one
        // that last moved the counter.
        const isConflict =
            versionMoved &&
            (!request.sessionId || lastSyncSessionId !== request.sessionId);

        // Con la fila de diagrams ya bloqueada, dos reintentos simultáneos del
        // mismo lote no pueden aplicarse ambos.
        const useOpsTable =
            Boolean(request.batchId) && (await hasOpsTable(client));
        if (useOpsTable) {
            const { rows: stored } = await client.query(
                `SELECT result FROM diagram_ops WHERE diagram_id = $1 AND batch_id = $2`,
                [diagramId, request.batchId]
            );
            // Reintento de un lote ya aplicado (el ack se perdió): misma respuesta.
            if (stored[0]) return stored[0].result as SyncResult;
        }

        const ops = collapseOperations(request.operations);
        const applied: string[] = [];
        const rejected: RejectedOperation[] = [];
        const appliedOps: SyncOperation[] = [];
        // Cada op en su SAVEPOINT: una op inválida o sobre algo borrado se
        // rechaza sola en vez de abortar (y envenenar) el lote entero.
        for (const [i, op] of ops.entries()) {
            const savepoint = `sync_op_${i}`;
            await client.query(`SAVEPOINT ${savepoint}`);
            try {
                await applyOperation(client, diagramId, userId, op);
                await client.query(`RELEASE SAVEPOINT ${savepoint}`);
                if (op.opId) applied.push(op.opId);
                appliedOps.push(op);
            } catch (err) {
                const reason = rejectionReason(err);
                if (!reason) throw err;
                await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                logger.info(
                    { diagramId, entity: op.entity, id: op.id, reason },
                    'Sync operation rejected'
                );
                rejected.push({
                    ...(op.opId ? { opId: op.opId } : {}),
                    entity: op.entity,
                    id: op.id,
                    reason,
                });
            }
        }

        const nextVersion = currentVersion + 1;
        await client.query(
            `UPDATE diagrams SET version = $1, updated_at = now(), last_sync_session_id = $2 WHERE id = $3`,
            [nextVersion, request.sessionId ?? null, diagramId]
        );

        const result: SyncResult = {
            version: nextVersion,
            conflicts: isConflict
                ? ops.map((o) => ({ entity: o.entity, id: o.id }))
                : [],
            applied,
            rejected,
        };

        if (useOpsTable) {
            await client.query(
                `INSERT INTO diagram_ops (diagram_id, version, batch_id, session_id, user_id, operations, result)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    diagramId,
                    nextVersion,
                    request.batchId,
                    request.sessionId ?? null,
                    userId,
                    JSON.stringify(appliedOps),
                    JSON.stringify(result),
                ]
            );
            // Retención: el log solo cubre reintentos y reconexiones recientes.
            if (nextVersion % 100 === 0) {
                await client.query(
                    `DELETE FROM diagram_ops
                     WHERE diagram_id = $1
                       AND (version < $2 OR created_at < now() - interval '24 hours')`,
                    [diagramId, nextVersion - 1000]
                );
            }
        }

        return result;
    },
};

/** Traduce el error de UNA op a un motivo de rechazo, o null si debe abortar el lote. */
function rejectionReason(err: unknown): RejectReason | null {
    if (err instanceof ZodError) return 'validation_failed';
    if (err instanceof AppError) {
        if (err.statusCode === 404) return 'entity_deleted';
        if (err.statusCode === 400) return 'validation_failed';
        return null;
    }
    const code = (err as { code?: string })?.code ?? '';
    // Clases 22 (datos inválidos) y 23 (integridad): culpa de la op, no del servidor.
    if (code.startsWith('22') || code.startsWith('23')) return 'invalid_data';
    return null;
}

// diagram_ops (server/sql/2026-09-24-collab-diagram-ops.sql) es opcional
// mientras la migración no esté aplicada: sin ella no hay idempotencia por
// batchId, pero el guardado sigue funcionando. Si no existe, se vuelve a
// comprobar como mucho una vez por minuto.
let opsTableAvailable = false;
let opsTableCheckedAt = 0;

async function hasOpsTable(client: PoolClient): Promise<boolean> {
    if (opsTableAvailable) return true;
    if (Date.now() - opsTableCheckedAt < 60_000) return false;
    opsTableCheckedAt = Date.now();
    const { rows } = await client.query(
        `SELECT to_regclass('public.diagram_ops') IS NOT NULL AS available`
    );
    opsTableAvailable = Boolean(rows[0]?.available);
    return opsTableAvailable;
}

/** Solo para tests: olvida la detección cacheada de diagram_ops. */
export function resetOpsTableDetection() {
    opsTableAvailable = false;
    opsTableCheckedAt = 0;
}
