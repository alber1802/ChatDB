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
