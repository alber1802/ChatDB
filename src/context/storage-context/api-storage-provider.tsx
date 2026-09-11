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
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBTable | undefined> => {
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
