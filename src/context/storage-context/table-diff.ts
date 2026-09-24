import equal from 'fast-deep-equal';
import type { DBTable } from '@/lib/domain/db-table';
import type { SyncOperation } from './sync-engine';

// Convierte "tabla antes → tabla después" en las operaciones mínimas para el
// servidor (docs/collaboration/04-conflicts-and-consistency.md, Fase 4-a).
// Columnas, índices y CHECK viajan como ops de sub-entidad con solo las
// propiedades cambiadas, así dos personas que editan columnas distintas de la
// misma tabla ya no se pisan (antes se reescribía el array JSONB entero).

type Element = { id: string } & Record<string, unknown>;
type Collection = 'fields' | 'indexes' | 'checkConstraints';

const COLLECTIONS: [Collection, SyncOperation['entity']][] = [
    ['fields', 'field'],
    ['indexes', 'index'],
    ['checkConstraints', 'checkConstraint'],
];

const COLLECTION_KEYS = new Set<string>(COLLECTIONS.map(([key]) => key));

/** Propiedades cambiadas; las que desaparecen se envían como null. */
function changedProps(
    prev: Record<string, unknown>,
    next: Record<string, unknown>
): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
        if (key === 'id') continue;
        if (!equal(prev[key], next[key])) {
            patch[key] = next[key] === undefined ? null : next[key];
        }
    }
    return patch;
}

function diffCollection(
    tableId: string,
    entity: SyncOperation['entity'],
    prevItems: Element[],
    nextItems: Element[]
): SyncOperation[] | 'reordered' {
    const prevById = new Map(prevItems.map((item) => [item.id, item]));
    const nextIds = new Set(nextItems.map((item) => item.id));

    // Los elementos que siguen existiendo deben conservar su orden relativo;
    // si no, un reordenamiento no se puede expresar como ops por elemento.
    const keptPrevOrder = prevItems
        .filter((item) => nextIds.has(item.id))
        .map((item) => item.id);
    const keptNextOrder = nextItems
        .filter((item) => prevById.has(item.id))
        .map((item) => item.id);
    if (!equal(keptPrevOrder, keptNextOrder)) return 'reordered';

    const ops: SyncOperation[] = [];
    for (const item of prevItems) {
        if (!nextIds.has(item.id)) {
            ops.push({ entity, op: 'delete', id: item.id, parentId: tableId });
        }
    }
    nextItems.forEach((item, index) => {
        const before = prevById.get(item.id);
        if (!before) {
            ops.push({
                entity,
                op: 'create',
                id: item.id,
                parentId: tableId,
                afterId: index === 0 ? null : nextItems[index - 1].id,
                patch: item,
            });
            return;
        }
        const patch = changedProps(before, item);
        if (Object.keys(patch).length > 0) {
            ops.push({
                entity,
                op: 'update',
                id: item.id,
                parentId: tableId,
                patch,
            });
        }
    });
    return ops;
}

export function diffTable(prev: DBTable, next: DBTable): SyncOperation[] {
    const ops: SyncOperation[] = [];
    const tablePatch: Record<string, unknown> = {};

    for (const [key, entity] of COLLECTIONS) {
        const prevItems = (prev[key] ?? []) as unknown as Element[];
        const nextItems = (next[key] ?? []) as unknown as Element[];
        if (equal(prevItems, nextItems)) continue;
        const result = diffCollection(prev.id, entity, prevItems, nextItems);
        if (result === 'reordered') {
            tablePatch[key] = nextItems;
        } else {
            ops.push(...result);
        }
    }

    const prevScalars = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !COLLECTION_KEYS.has(key))
    );
    const nextScalars = Object.fromEntries(
        Object.entries(next).filter(([key]) => !COLLECTION_KEYS.has(key))
    );
    Object.assign(tablePatch, changedProps(prevScalars, nextScalars));

    if (Object.keys(tablePatch).length > 0) {
        // La op de tabla va primero: si reordena un array, las ops de otras
        // colecciones se aplican después sobre el estado ya reordenado.
        ops.unshift({
            entity: 'table',
            op: 'update',
            id: prev.id,
            patch: tablePatch,
        });
    }
    return ops;
}
