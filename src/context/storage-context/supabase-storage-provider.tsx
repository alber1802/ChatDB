/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo } from 'react';
import type { StorageContext } from './storage-context';
import { storageContext } from './storage-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context/auth-context';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { Note } from '@/lib/domain/note';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';
import type { ChartDBConfig } from '@/lib/domain/config';
import {
    rowToDiagram,
    diagramToRow,
    rowToTable,
    tableToRow,
    rowToRelationship,
    relationshipToRow,
    rowToDependency,
    dependencyToRow,
    rowToArea,
    areaToRow,
    rowToCustomType,
    customTypeToRow,
    rowToNote,
    noteToRow,
    rowToFilter,
    filterToRow,
} from '@/lib/supabase-mappers';

export const SupabaseStorageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { user } = useAuth();

    const userId = useMemo(() => user?.id, [user]);

    // Config operations
    const getConfig = useCallback(async (): Promise<
        ChartDBConfig | undefined
    > => {
        if (!userId) return undefined;
        const { data, error } = await supabase
            .from('user_config')
            .select('default_diagram_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching config from Supabase:', error);
            return undefined;
        }

        if (!data) return undefined;
        return {
            defaultDiagramId: data.default_diagram_id || '',
        };
    }, [userId]);

    const updateConfig = useCallback(
        async (config: Partial<ChartDBConfig>): Promise<void> => {
            if (!userId) return;
            const payload: any = {
                user_id: userId,
                updated_at: new Date().toISOString(),
            };
            if (config.defaultDiagramId !== undefined) {
                payload.default_diagram_id = config.defaultDiagramId;
            }

            const { error } = await supabase
                .from('user_config')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) {
                console.error('Error updating config in Supabase:', error);
            }
        },
        [userId]
    );

    // Diagram filter operations
    const getDiagramFilter = useCallback(
        async (diagramId: string): Promise<DiagramFilter | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('diagram_filters')
                .select('*')
                .eq('diagram_id', diagramId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching diagram filter:', error);
                return undefined;
            }
            return data ? rowToFilter(data) : undefined;
        },
        [userId]
    );

    const updateDiagramFilter = useCallback(
        async (diagramId: string, filter: DiagramFilter): Promise<void> => {
            if (!userId) return;
            const row = filterToRow(filter, diagramId, userId);
            const { error } = await supabase
                .from('diagram_filters')
                .upsert(row, { onConflict: 'diagram_id' });

            if (error) {
                console.error('Error updating diagram filter:', error);
            }
        },
        [userId]
    );

    const deleteDiagramFilter = useCallback(
        async (diagramId: string): Promise<void> => {
            if (!userId) return;
            const { error } = await supabase
                .from('diagram_filters')
                .delete()
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error deleting diagram filter:', error);
            }
        },
        [userId]
    );

    // Table operations
    const addTable = useCallback(
        async ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_tables')
                .insert(tableToRow(table, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getTable = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBTable | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('db_tables')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting table:', error);
                return undefined;
            }
            return data ? rowToTable(data) : undefined;
        },
        [userId]
    );

    const updateTable = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBTable>;
        }) => {
            if (!userId) return;

            const mappedAttributes: any = {};
            if (attributes.name !== undefined)
                mappedAttributes.name = attributes.name;
            if (attributes.schema !== undefined)
                mappedAttributes.schema = attributes.schema || null;
            if (attributes.x !== undefined) mappedAttributes.x = attributes.x;
            if (attributes.y !== undefined) mappedAttributes.y = attributes.y;
            if (attributes.fields !== undefined)
                mappedAttributes.fields = attributes.fields;
            if (attributes.indexes !== undefined)
                mappedAttributes.indexes = attributes.indexes;
            if (attributes.color !== undefined)
                mappedAttributes.color = attributes.color || null;
            if (attributes.width !== undefined)
                mappedAttributes.width = attributes.width || null;
            if (attributes.comments !== undefined)
                mappedAttributes.comment = attributes.comments || null;
            if (attributes.isView !== undefined)
                mappedAttributes.is_view = attributes.isView;
            if (attributes.isMaterializedView !== undefined)
                mappedAttributes.is_materialized_view =
                    attributes.isMaterializedView;
            if (attributes.order !== undefined)
                mappedAttributes.order = attributes.order || null;

            const { error } = await supabase
                .from('db_tables')
                .update(mappedAttributes)
                .eq('id', id);

            if (error) throw error;
        },
        [userId]
    );

    const putTable = useCallback(
        async ({ diagramId, table }: { diagramId: string; table: DBTable }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_tables')
                .upsert(tableToRow(table, diagramId, userId), {
                    onConflict: 'id',
                });
            if (error) throw error;
        },
        [userId]
    );

    const deleteTable = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_tables')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listTables = useCallback(
        async (diagramId: string): Promise<DBTable[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('db_tables')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing tables:', error);
                return [];
            }
            return (data || []).map(rowToTable);
        },
        [userId]
    );

    const deleteDiagramTables = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_tables')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Relationships operations
    const addRelationship = useCallback(
        async ({
            diagramId,
            relationship,
        }: {
            diagramId: string;
            relationship: DBRelationship;
        }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_relationships')
                .insert(relationshipToRow(relationship, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getRelationship = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBRelationship | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('db_relationships')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting relationship:', error);
                return undefined;
            }
            return data ? rowToRelationship(data) : undefined;
        },
        [userId]
    );

    const updateRelationship = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBRelationship>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {};
            if (attributes.name !== undefined)
                mappedAttributes.name = attributes.name;
            if (attributes.sourceSchema !== undefined)
                mappedAttributes.source_schema =
                    attributes.sourceSchema || null;
            if (attributes.sourceTableId !== undefined)
                mappedAttributes.source_table_id = attributes.sourceTableId;
            if (attributes.targetSchema !== undefined)
                mappedAttributes.target_schema =
                    attributes.targetSchema || null;
            if (attributes.targetTableId !== undefined)
                mappedAttributes.target_table_id = attributes.targetTableId;
            if (attributes.sourceFieldId !== undefined)
                mappedAttributes.source_field_id = attributes.sourceFieldId;
            if (attributes.targetFieldId !== undefined)
                mappedAttributes.target_field_id = attributes.targetFieldId;
            if (attributes.sourceCardinality !== undefined)
                mappedAttributes.source_cardinality =
                    attributes.sourceCardinality;
            if (attributes.targetCardinality !== undefined)
                mappedAttributes.target_cardinality =
                    attributes.targetCardinality;

            const { error } = await supabase
                .from('db_relationships')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteRelationship = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_relationships')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listRelationships = useCallback(
        async (diagramId: string): Promise<DBRelationship[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('db_relationships')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing relationships:', error);
                return [];
            }

            return (data || [])
                .map(rowToRelationship)
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        [userId]
    );

    const deleteDiagramRelationships = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_relationships')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Dependencies operations
    const addDependency = useCallback(
        async ({
            diagramId,
            dependency,
        }: {
            diagramId: string;
            dependency: DBDependency;
        }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_dependencies')
                .insert(dependencyToRow(dependency, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getDependency = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBDependency | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('db_dependencies')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting dependency:', error);
                return undefined;
            }
            return data ? rowToDependency(data) : undefined;
        },
        [userId]
    );

    const updateDependency = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBDependency>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {};
            if (attributes.schema !== undefined)
                mappedAttributes.schema = attributes.schema || null;
            if (attributes.tableId !== undefined)
                mappedAttributes.table_id = attributes.tableId;
            if (attributes.dependentSchema !== undefined)
                mappedAttributes.dependent_schema =
                    attributes.dependentSchema || null;
            if (attributes.dependentTableId !== undefined)
                mappedAttributes.dependent_table_id =
                    attributes.dependentTableId;

            const { error } = await supabase
                .from('db_dependencies')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteDependency = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_dependencies')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listDependencies = useCallback(
        async (diagramId: string): Promise<DBDependency[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('db_dependencies')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing dependencies:', error);
                return [];
            }
            return (data || []).map(rowToDependency);
        },
        [userId]
    );

    const deleteDiagramDependencies = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_dependencies')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Area operations
    const addArea = useCallback(
        async ({ diagramId, area }: { diagramId: string; area: Area }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('areas')
                .insert(areaToRow(area, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getArea = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<Area | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('areas')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting area:', error);
                return undefined;
            }
            return data ? rowToArea(data) : undefined;
        },
        [userId]
    );

    const updateArea = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Area>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {};
            if (attributes.name !== undefined)
                mappedAttributes.name = attributes.name || null;
            if (attributes.x !== undefined) mappedAttributes.x = attributes.x;
            if (attributes.y !== undefined) mappedAttributes.y = attributes.y;
            if (attributes.width !== undefined)
                mappedAttributes.width = attributes.width;
            if (attributes.height !== undefined)
                mappedAttributes.height = attributes.height;
            if (attributes.color !== undefined)
                mappedAttributes.color = attributes.color;

            const { error } = await supabase
                .from('areas')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteArea = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('areas')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listAreas = useCallback(
        async (diagramId: string): Promise<Area[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('areas')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing areas:', error);
                return [];
            }
            return (data || []).map(rowToArea);
        },
        [userId]
    );

    const deleteDiagramAreas = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('areas')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Custom type operations
    const addCustomType = useCallback(
        async ({
            diagramId,
            customType,
        }: {
            diagramId: string;
            customType: DBCustomType;
        }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_custom_types')
                .insert(customTypeToRow(customType, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getCustomType = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<DBCustomType | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('db_custom_types')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting custom type:', error);
                return undefined;
            }
            return data ? rowToCustomType(data) : undefined;
        },
        [userId]
    );

    const updateCustomType = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<DBCustomType>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {};
            if (attributes.schema !== undefined)
                mappedAttributes.schema = attributes.schema || null;
            if (attributes.name !== undefined)
                mappedAttributes.name = attributes.name;
            if (attributes.kind !== undefined)
                mappedAttributes.kind = attributes.kind;
            if (attributes.values !== undefined)
                mappedAttributes.values = attributes.values;
            if (attributes.fields !== undefined)
                mappedAttributes.fields = attributes.fields;

            const { error } = await supabase
                .from('db_custom_types')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteCustomType = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_custom_types')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listCustomTypes = useCallback(
        async (diagramId: string): Promise<DBCustomType[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('db_custom_types')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing custom types:', error);
                return [];
            }
            return (data || [])
                .map(rowToCustomType)
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        [userId]
    );

    const deleteDiagramCustomTypes = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('db_custom_types')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Note operations
    const addNote = useCallback(
        async ({ diagramId, note }: { diagramId: string; note: Note }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('notes')
                .insert(noteToRow(note, diagramId, userId));
            if (error) throw error;
        },
        [userId]
    );

    const getNote = useCallback(
        async ({
            diagramId,
            id,
        }: {
            diagramId: string;
            id: string;
        }): Promise<Note | undefined> => {
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('diagram_id', diagramId)
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting note:', error);
                return undefined;
            }
            return data ? rowToNote(data) : undefined;
        },
        [userId]
    );

    const updateNote = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Note>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {};
            if (attributes.content !== undefined)
                mappedAttributes.content = attributes.content || null;
            if (attributes.x !== undefined) mappedAttributes.x = attributes.x;
            if (attributes.y !== undefined) mappedAttributes.y = attributes.y;
            if (attributes.width !== undefined)
                mappedAttributes.width = attributes.width;
            if (attributes.height !== undefined)
                mappedAttributes.height = attributes.height;
            if (attributes.color !== undefined)
                mappedAttributes.color = attributes.color;

            const { error } = await supabase
                .from('notes')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteNote = useCallback(
        async ({ diagramId, id }: { diagramId: string; id: string }) => {
            if (!userId) return;
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('diagram_id', diagramId)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const listNotes = useCallback(
        async (diagramId: string): Promise<Note[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('diagram_id', diagramId);

            if (error) {
                console.error('Error listing notes:', error);
                return [];
            }
            return (data || []).map(rowToNote);
        },
        [userId]
    );

    const deleteDiagramNotes = useCallback(
        async (diagramId: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('diagram_id', diagramId);
            if (error) throw error;
        },
        [userId]
    );

    // Diagram operations
    const addDiagram = useCallback(
        async ({ diagram }: { diagram: Diagram }) => {
            if (!userId) return;
            const { error: dErr } = await supabase
                .from('diagrams')
                .insert(diagramToRow(diagram, userId));
            if (dErr) throw dErr;

            const promises: any[] = [];

            if (diagram.tables && diagram.tables.length > 0) {
                const rows = diagram.tables.map((t) =>
                    tableToRow(t, diagram.id, userId)
                );
                promises.push(supabase.from('db_tables').insert(rows));
            }

            if (diagram.relationships && diagram.relationships.length > 0) {
                const rows = diagram.relationships.map((r) =>
                    relationshipToRow(r, diagram.id, userId)
                );
                promises.push(supabase.from('db_relationships').insert(rows));
            }

            if (diagram.dependencies && diagram.dependencies.length > 0) {
                const rows = diagram.dependencies.map((d) =>
                    dependencyToRow(d, diagram.id, userId)
                );
                promises.push(supabase.from('db_dependencies').insert(rows));
            }

            if (diagram.areas && diagram.areas.length > 0) {
                const rows = diagram.areas.map((a) =>
                    areaToRow(a, diagram.id, userId)
                );
                promises.push(supabase.from('areas').insert(rows));
            }

            if (diagram.customTypes && diagram.customTypes.length > 0) {
                const rows = diagram.customTypes.map((c) =>
                    customTypeToRow(c, diagram.id, userId)
                );
                promises.push(supabase.from('db_custom_types').insert(rows));
            }

            if (diagram.notes && diagram.notes.length > 0) {
                const rows = diagram.notes.map((n) =>
                    noteToRow(n, diagram.id, userId)
                );
                promises.push(supabase.from('notes').insert(rows));
            }

            const results = await Promise.all(promises);
            for (const res of results) {
                if (res.error) throw res.error;
            }
        },
        [userId]
    );

    const listDiagrams = useCallback(
        async (options?: {
            includeTables?: boolean;
            includeRelationships?: boolean;
            includeDependencies?: boolean;
            includeAreas?: boolean;
            includeCustomTypes?: boolean;
            includeNotes?: boolean;
        }): Promise<Diagram[]> => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('diagrams')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error listing diagrams:', error);
                return [];
            }

            let list = (data || []).map(rowToDiagram);

            if (options?.includeTables) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.tables = await listTables(d.id);
                        return d;
                    })
                );
            }

            if (options?.includeRelationships) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.relationships = await listRelationships(d.id);
                        return d;
                    })
                );
            }

            if (options?.includeDependencies) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.dependencies = await listDependencies(d.id);
                        return d;
                    })
                );
            }

            if (options?.includeAreas) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.areas = await listAreas(d.id);
                        return d;
                    })
                );
            }

            if (options?.includeCustomTypes) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.customTypes = await listCustomTypes(d.id);
                        return d;
                    })
                );
            }

            if (options?.includeNotes) {
                list = await Promise.all(
                    list.map(async (d) => {
                        d.notes = await listNotes(d.id);
                        return d;
                    })
                );
            }

            return list;
        },
        [
            userId,
            listTables,
            listRelationships,
            listDependencies,
            listAreas,
            listCustomTypes,
            listNotes,
        ]
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
            if (!userId) return undefined;
            const { data, error } = await supabase
                .from('diagrams')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) {
                console.error('Error getting diagram:', error);
                return undefined;
            }
            if (!data) return undefined;

            const diagram = rowToDiagram(data);

            if (options?.includeTables) {
                diagram.tables = await listTables(id);
            }
            if (options?.includeRelationships) {
                diagram.relationships = await listRelationships(id);
            }
            if (options?.includeDependencies) {
                diagram.dependencies = await listDependencies(id);
            }
            if (options?.includeAreas) {
                diagram.areas = await listAreas(id);
            }
            if (options?.includeCustomTypes) {
                diagram.customTypes = await listCustomTypes(id);
            }
            if (options?.includeNotes) {
                diagram.notes = await listNotes(id);
            }

            return diagram;
        },
        [
            userId,
            listTables,
            listRelationships,
            listDependencies,
            listAreas,
            listCustomTypes,
            listNotes,
        ]
    );

    const updateDiagram = useCallback(
        async ({
            id,
            attributes,
        }: {
            id: string;
            attributes: Partial<Diagram>;
        }) => {
            if (!userId) return;
            const mappedAttributes: any = {
                updated_at: new Date().toISOString(),
            };
            if (attributes.name !== undefined)
                mappedAttributes.name = attributes.name;
            if (attributes.databaseType !== undefined)
                mappedAttributes.database_type = attributes.databaseType;
            if (attributes.databaseEdition !== undefined)
                mappedAttributes.database_edition =
                    attributes.databaseEdition || null;

            const { error } = await supabase
                .from('diagrams')
                .update(mappedAttributes)
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

    const deleteDiagram = useCallback(
        async (id: string) => {
            if (!userId) return;
            const { error } = await supabase
                .from('diagrams')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        [userId]
    );

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
