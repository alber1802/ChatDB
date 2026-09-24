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
import type { SyncEntity, SyncOperation, SyncStatus } from './sync-engine';
import { diffTable } from './table-diff';
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
            // Attempt to send whatever was still pending on the diagram we're
            // leaving before tearing it down — destroy() only clears timers/
            // listeners, it does not flush the queue.
            void engineRef.current?.flushNow();
            engineRef.current?.destroy();
            // The old engine's status no longer describes the diagram we're
            // about to open; reset so stale "saving"/"error" state doesn't
            // linger until the new engine's first onStatusChange fires.
            setStatus('idle');
            setErrorMessage(undefined);
            const engine = new SyncEngine({
                diagramId,
                initialVersion: version,
                onStatusChange: (nextStatus, message) => {
                    setStatus(nextStatus);
                    setErrorMessage(message);
                },
                onConflict: (conflicts) => {
                    console.warn(
                        'Sync conflicts overwritten by another session',
                        conflicts
                    );
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

    const enqueueOperations = useCallback(
        (diagramId: string, operations: SyncOperation[]) => {
            const engine =
                engineRef.current?.diagramId === diagramId
                    ? engineRef.current
                    : ensureEngine(diagramId, 1);
            for (const operation of operations) engine.enqueue(operation);
        },
        [ensureEngine]
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
            await apiFetch(`/diagrams/${diagramId}/filter`, {
                method: 'DELETE',
            });
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
            // Solo se envían las claves realmente presentes: la mayoría de
            // llamadas (`updateDiagram({id, attributes: {updatedAt}})`) no
            // traen ninguno de estos campos y, tras JSON.stringify, las claves
            // undefined desaparecen dejando `patch: {}`. El backend rechaza un
            // patch de diagrama vacío con ZodError, lo que abortaba la
            // transacción completa del batch (nada se guardaba y la operación
            // envenenada se reintentaba para siempre). `updatedAt` ya lo pone
            // el servidor en cada /sync, así que no hay nada que enviar.
            const patch = Object.fromEntries(
                Object.entries({
                    name: attributes.name,
                    databaseType: attributes.databaseType,
                    databaseEdition: attributes.databaseEdition,
                }).filter(([, value]) => value !== undefined)
            );
            if (Object.keys(patch).length === 0) return;
            enqueue(id, 'diagram', 'update', id, patch);
        },
        [enqueue]
    );

    const deleteDiagram = useCallback(async (id: string) => {
        await apiFetch(`/diagrams/${id}`, { method: 'DELETE' });
        // El diagrama ya no existe: cualquier operación aún encolada para él
        // solo puede producir 404s, backoff y un "Error al guardar" espurio.
        if (engineRef.current?.diagramId === id) {
            engineRef.current.clearPersistedQueue();
            engineRef.current.destroy();
            engineRef.current = null;
        }
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
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBTable | undefined> => {
            // ─ read-your-own-writes ─────────────────────────────────────
            // Los mutadores de chartdb-provider son read-modify-write sobre
            // arrays completos (`fields`/`indexes` son columnas JSON enteras,
            // así que cada escritura reemplaza el array entero). Antes del
            // batching, `updateTable` esperaba al PATCH real, por lo que cada
            // escritura era durable antes de la siguiente lectura. Ahora
            // `updateTable` encola y resuelve al instante, así que una lectura
            // dentro de la ventana de debounce podría traer una copia del
            // servidor sin la edición aún encolada y descartarla en silencio
            // al reescribir el array. Vaciar la cola antes de leer restaura la
            // garantía anterior. (Mismo motivo en los otros cinco getters de
            // entidad individual.)
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<DBTable>(
                    `/diagrams/${diagramId}/tables/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateTable = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<DBTable> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'table', 'update', id, attributes as any);
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

    const applyTableChanges = useCallback(
        ({
            diagramId,
            prev,
            next,
        }: {
            diagramId: string;
            prev: DBTable;
            next: DBTable;
        }) => {
            enqueueOperations(diagramId, diffTable(prev, next));
            return Promise.resolve();
        },
        [enqueueOperations]
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
        // Un create/update aún encolado para una de estas filas se enviaría
        // DESPUÉS del DELETE masivo y resucitaría lo recién borrado. Vaciar la
        // cola antes garantiza el orden correcto: primero las pendientes,
        // luego el borrado que las supera. (Igual en los otros cinco borrados
        // masivos.)
        await engineRef.current?.flushNow();
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
            enqueue(
                diagramId,
                'relationship',
                'create',
                relationship.id,
                relationship as any
            );
            return Promise.resolve();
        },
        [enqueue]
    );

    const getRelationship = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBRelationship | undefined> => {
            // read-your-own-writes: ver la nota en getTable.
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<DBRelationship>(
                    `/diagrams/${diagramId}/relationships/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateRelationship = useCallback(
        ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBRelationship>;
        }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(
                    diagramId,
                    'relationship',
                    'update',
                    id,
                    attributes as any
                );
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
        return apiFetch<DBRelationship[]>(
            `/diagrams/${diagramId}/relationships`
        );
    }, []);

    const deleteDiagramRelationships = useCallback(
        async (diagramId: string) => {
            // Ver la nota en deleteDiagramTables.
            await engineRef.current?.flushNow();
            await apiFetch(`/diagrams/${diagramId}/relationships`, {
                method: 'DELETE',
            });
        },
        []
    );

    // ─── Dependencies ───────────────────────────────────────────────────
    const addDependency = useCallback(
        ({
            diagramId,
            dependency,
        }: {
            diagramId: string;
            dependency: DBDependency;
        }) => {
            enqueue(
                diagramId,
                'dependency',
                'create',
                dependency.id,
                dependency as any
            );
            return Promise.resolve();
        },
        [enqueue]
    );

    const getDependency = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBDependency | undefined> => {
            // read-your-own-writes: ver la nota en getTable.
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<DBDependency>(
                    `/diagrams/${diagramId}/dependencies/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateDependency = useCallback(
        ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBDependency>;
        }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(
                    diagramId,
                    'dependency',
                    'update',
                    id,
                    attributes as any
                );
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
        // Ver la nota en deleteDiagramTables.
        await engineRef.current?.flushNow();
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
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<Area | undefined> => {
            // read-your-own-writes: ver la nota en getTable.
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<Area>(
                    `/diagrams/${diagramId}/areas/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateArea = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<Area> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'area', 'update', id, attributes as any);
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
        // Ver la nota en deleteDiagramTables.
        await engineRef.current?.flushNow();
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
            enqueue(
                diagramId,
                'customType',
                'create',
                customType.id,
                customType as any
            );
            return Promise.resolve();
        },
        [enqueue]
    );

    const getCustomType = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBCustomType | undefined> => {
            // read-your-own-writes: ver la nota en getTable.
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<DBCustomType>(
                    `/diagrams/${diagramId}/custom-types/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateCustomType = useCallback(
        ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBCustomType>;
        }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(
                    diagramId,
                    'customType',
                    'update',
                    id,
                    attributes as any
                );
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
        // Ver la nota en deleteDiagramTables.
        await engineRef.current?.flushNow();
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
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<Note | undefined> => {
            // read-your-own-writes: ver la nota en getTable.
            await engineRef.current?.flushNow();
            try {
                return await apiFetch<Note>(
                    `/diagrams/${diagramId}/notes/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateNote = useCallback(
        ({ id, attributes }: { id: string; attributes: Partial<Note> }) => {
            const diagramId = engineRef.current?.diagramId;
            if (diagramId)
                enqueue(diagramId, 'note', 'update', id, attributes as any);
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
        // Ver la nota en deleteDiagramTables.
        await engineRef.current?.flushNow();
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
            applyTableChanges,
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
            applyTableChanges,
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
