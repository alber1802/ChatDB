import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { Note } from '@/lib/domain/note';
import type { Diagram } from '@/lib/domain/diagram';
import type { SyncOperation } from '@/context/storage-context/sync-engine';

// Aplica un lote remoto (otro colaborador) al estado local del diagrama
// (docs/collaboration/03-realtime-synchronization.md). Es puro: devuelve un
// estado nuevo que CONSERVA la referencia de todo lo que no cambió, porque
// TableNode está memoizado por referencia de su tabla: así solo se vuelven a
// pintar las tablas tocadas, no el canvas entero.

export interface RemoteDiagramState {
    diagram: Pick<Diagram, 'name' | 'databaseType' | 'databaseEdition'>;
    tables: DBTable[];
    relationships: DBRelationship[];
    dependencies: DBDependency[];
    areas: Area[];
    customTypes: DBCustomType[];
    notes: Note[];
}

type WithId = { id: string };
type Collection = Exclude<keyof RemoteDiagramState, 'diagram'>;

const TOP_LEVEL: Partial<Record<SyncOperation['entity'], Collection>> = {
    table: 'tables',
    relationship: 'relationships',
    dependency: 'dependencies',
    area: 'areas',
    customType: 'customTypes',
    note: 'notes',
};

const SUB_ENTITY: Partial<
    Record<SyncOperation['entity'], 'fields' | 'indexes' | 'checkConstraints'>
> = {
    field: 'fields',
    index: 'indexes',
    checkConstraint: 'checkConstraints',
};

/** Aplica create/update/delete por id sobre una lista; misma referencia si no cambia. */
function applyToList<T extends WithId>(list: T[], op: SyncOperation): T[] {
    const index = list.findIndex((item) => item.id === op.id);
    if (op.op === 'delete') {
        return index === -1 ? list : list.filter((_, i) => i !== index);
    }
    if (index !== -1) {
        // update, o create de algo que ya existe (reintento): se fusiona
        const next = [...list];
        next[index] = { ...list[index], ...op.patch, id: op.id } as T;
        return next;
    }
    if (op.op === 'update') return list; // ya no existe: nada que actualizar
    const created = { ...op.patch, id: op.id } as unknown as T;
    if (op.afterId === null) return [created, ...list];
    const after =
        op.afterId !== undefined
            ? list.findIndex((item) => item.id === op.afterId)
            : -1;
    if (after === -1) return [...list, created];
    return [...list.slice(0, after + 1), created, ...list.slice(after + 1)];
}

export function applyRemoteOperations(
    state: RemoteDiagramState,
    operations: SyncOperation[]
): RemoteDiagramState {
    let next = state;
    const set = <K extends keyof RemoteDiagramState>(
        key: K,
        value: RemoteDiagramState[K]
    ) => {
        if (next[key] === value) return;
        next = next === state ? { ...state } : next;
        next[key] = value;
    };

    for (const op of operations) {
        if (op.entity === 'diagram') {
            if (op.op === 'update' && op.patch) {
                set('diagram', { ...next.diagram, ...op.patch });
            }
            continue;
        }

        const subKey = SUB_ENTITY[op.entity];
        if (subKey) {
            const tableIndex = next.tables.findIndex(
                (t) => t.id === op.parentId
            );
            if (tableIndex === -1) continue;
            const table = next.tables[tableIndex];
            const items = (table[subKey] ?? []) as unknown as WithId[];
            const updated = applyToList(items, op);
            if (updated === items) continue;
            const tables = [...next.tables];
            tables[tableIndex] = { ...table, [subKey]: updated } as DBTable;
            set('tables', tables);
            continue;
        }

        const key = TOP_LEVEL[op.entity];
        if (!key) continue;
        const list = next[key] as unknown as WithId[];
        const updated = applyToList(list, op);
        if (updated !== list) {
            set(key, updated as unknown as RemoteDiagramState[typeof key]);
        }
    }
    return next;
}
