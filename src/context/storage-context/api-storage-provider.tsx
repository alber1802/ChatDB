/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo } from 'react';
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

    const addTable = useCallback(
        async ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            await apiFetch(`/diagrams/${diagramId}/tables`, {
                method: 'POST',
                body: JSON.stringify(table),
            });
        },
        []
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
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBTable>;
        }) => {
            await apiFetch(`/tables/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const putTable = useCallback(
        async ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            await apiFetch(`/diagrams/${diagramId}/tables/${table.id}`, {
                method: 'PUT',
                body: JSON.stringify(table),
            });
        },
        []
    );

    const deleteTable = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/tables/${id}`, {
                method: 'DELETE',
            });
        },
        []
    );

    const listTables = useCallback(async (diagramId: string) => {
        return apiFetch<DBTable[]>(`/diagrams/${diagramId}/tables`);
    }, []);

    const deleteDiagramTables = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/tables`, { method: 'DELETE' });
    }, []);

    const addRelationship = useCallback(
        async ({
            diagramId,
            relationship,
        }: {
            diagramId: string;
            relationship: DBRelationship;
        }) => {
            await apiFetch(`/diagrams/${diagramId}/relationships`, {
                method: 'POST',
                body: JSON.stringify(relationship),
            });
        },
        []
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
                return await apiFetch(
                    `/diagrams/${diagramId}/relationships/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateRelationship = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBRelationship>;
        }) => {
            await apiFetch(`/relationships/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteRelationship = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/relationships/${id}`, {
                method: 'DELETE',
            });
        },
        []
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

    const addDependency = useCallback(
        async ({
            diagramId,
            dependency,
        }: {
            diagramId: string;
            dependency: DBDependency;
        }) => {
            await apiFetch(`/diagrams/${diagramId}/dependencies`, {
                method: 'POST',
                body: JSON.stringify(dependency),
            });
        },
        []
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
                return await apiFetch(
                    `/diagrams/${diagramId}/dependencies/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateDependency = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBDependency>;
        }) => {
            await apiFetch(`/dependencies/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteDependency = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/dependencies/${id}`, {
                method: 'DELETE',
            });
        },
        []
    );

    const listDependencies = useCallback(async (diagramId: string) => {
        return apiFetch<DBDependency[]>(`/diagrams/${diagramId}/dependencies`);
    }, []);

    const deleteDiagramDependencies = useCallback(
        async (diagramId: string) => {
            await apiFetch(`/diagrams/${diagramId}/dependencies`, {
                method: 'DELETE',
            });
        },
        []
    );

    const addArea = useCallback(
        async ({ diagramId, area }: { diagramId: string; area: Area }) => {
            await apiFetch(`/diagrams/${diagramId}/areas`, {
                method: 'POST',
                body: JSON.stringify(area),
            });
        },
        []
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
                return await apiFetch(`/diagrams/${diagramId}/areas/${id}`);
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateArea = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Area>;
        }) => {
            await apiFetch(`/areas/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteArea = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/areas/${id}`, {
                method: 'DELETE',
            });
        },
        []
    );

    const listAreas = useCallback(async (diagramId: string) => {
        return apiFetch<Area[]>(`/diagrams/${diagramId}/areas`);
    }, []);

    const deleteDiagramAreas = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/areas`, { method: 'DELETE' });
    }, []);

    const addCustomType = useCallback(
        async ({
            diagramId,
            customType,
        }: {
            diagramId: string;
            customType: DBCustomType;
        }) => {
            await apiFetch(`/diagrams/${diagramId}/custom-types`, {
                method: 'POST',
                body: JSON.stringify(customType),
            });
        },
        []
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
                return await apiFetch(
                    `/diagrams/${diagramId}/custom-types/${id}`
                );
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateCustomType = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBCustomType>;
        }) => {
            await apiFetch(`/custom-types/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteCustomType = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/custom-types/${id}`, {
                method: 'DELETE',
            });
        },
        []
    );

    const listCustomTypes = useCallback(async (diagramId: string) => {
        return apiFetch<DBCustomType[]>(`/diagrams/${diagramId}/custom-types`);
    }, []);

    const deleteDiagramCustomTypes = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/custom-types`, {
            method: 'DELETE',
        });
    }, []);

    const addNote = useCallback(
        async ({ diagramId, note }: { diagramId: string; note: Note }) => {
            await apiFetch(`/diagrams/${diagramId}/notes`, {
                method: 'POST',
                body: JSON.stringify(note),
            });
        },
        []
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
                return await apiFetch(`/diagrams/${diagramId}/notes/${id}`);
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateNote = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Note>;
        }) => {
            await apiFetch(`/notes/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(attributes),
            });
        },
        []
    );

    const deleteNote = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            await apiFetch(`/diagrams/${diagramId}/notes/${id}`, {
                method: 'DELETE',
            });
        },
        []
    );

    const listNotes = useCallback(async (diagramId: string) => {
        return apiFetch<Note[]>(`/diagrams/${diagramId}/notes`);
    }, []);

    const deleteDiagramNotes = useCallback(async (diagramId: string) => {
        await apiFetch(`/diagrams/${diagramId}/notes`, { method: 'DELETE' });
    }, []);

    const addDiagram = useCallback(async ({ diagram }: { diagram: Diagram }) => {
        await apiFetch('/diagrams', {
            method: 'POST',
            body: JSON.stringify(diagram),
        });
    }, []);

    const listDiagrams = useCallback(
        async (options?: {
            includeTables?: boolean;
            includeRelationships?: boolean;
            includeDependencies?: boolean;
            includeAreas?: boolean;
            includeCustomTypes?: boolean;
            includeNotes?: boolean;
        }): Promise<Diagram[]> => {
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
            options?: {
                includeTables?: boolean;
                includeRelationships?: boolean;
                includeDependencies?: boolean;
                includeAreas?: boolean;
                includeCustomTypes?: boolean;
                includeNotes?: boolean;
            }
        ): Promise<Diagram | undefined> => {
            try {
                const data = await apiFetch<any>(
                    `/diagrams/${id}${buildIncludeQuery(options)}`
                );
                return normalizeDiagram(data);
            } catch {
                return undefined;
            }
        },
        []
    );

    const updateDiagram = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Diagram>;
        }) => {
            await apiFetch(`/diagrams/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: attributes.name,
                    databaseType: attributes.databaseType,
                    databaseEdition: attributes.databaseEdition,
                }),
            });
        },
        []
    );

    const deleteDiagram = useCallback(async (id: string) => {
        await apiFetch(`/diagrams/${id}`, { method: 'DELETE' });
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

    return (
        <storageContext.Provider value={contextValue}>
            {children}
        </storageContext.Provider>
    );
};
