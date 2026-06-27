/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBRelationship } from '@/lib/domain/db-relationship';
import type { DBDependency } from '@/lib/domain/db-dependency';
import type { Area } from '@/lib/domain/area';
import type { DBCustomType } from '@/lib/domain/db-custom-type';
import type { Note } from '@/lib/domain/note';
import type { DiagramFilter } from '@/lib/domain/diagram-filter/diagram-filter';

export const rowToDiagram = (row: any): Diagram => ({
    id: row.id,
    name: row.name,
    databaseType: row.database_type,
    databaseEdition: row.database_edition || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
});

export const diagramToRow = (diagram: Diagram, userId: string) => ({
    id: diagram.id,
    user_id: userId,
    name: diagram.name,
    database_type: diagram.databaseType,
    database_edition: diagram.databaseEdition || null,
    created_at: diagram.createdAt
        ? new Date(diagram.createdAt).toISOString()
        : new Date().toISOString(),
    updated_at: diagram.updatedAt
        ? new Date(diagram.updatedAt).toISOString()
        : new Date().toISOString(),
});

export const rowToTable = (row: any): DBTable => ({
    id: row.id,
    name: row.name,
    schema: row.schema || undefined,
    x: row.x,
    y: row.y,
    fields: row.fields || [],
    indexes: row.indexes || [],
    color: row.color || undefined,
    width: row.width || undefined,
    comments: row.comment || undefined,
    isView: row.is_view ?? false,
    isMaterializedView: row.is_materialized_view ?? false,
    order: row.order ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
});

export const tableToRow = (
    table: DBTable,
    diagramId: string,
    userId: string
) => ({
    id: table.id,
    diagram_id: diagramId,
    user_id: userId,
    name: table.name,
    schema: table.schema || null,
    x: table.x,
    y: table.y,
    fields: table.fields || [],
    indexes: table.indexes || [],
    color: table.color || null,
    width: table.width || null,
    comment: table.comments || null,
    is_view: table.isView ?? false,
    is_materialized_view: table.isMaterializedView ?? false,
    order: table.order ?? null,
    created_at: table.createdAt
        ? new Date(table.createdAt).toISOString()
        : new Date().toISOString(),
});

export const rowToRelationship = (row: any): DBRelationship => ({
    id: row.id,
    name: row.name,
    sourceSchema: row.source_schema || undefined,
    sourceTableId: row.source_table_id,
    targetSchema: row.target_schema || undefined,
    targetTableId: row.target_table_id,
    sourceFieldId: row.source_field_id,
    targetFieldId: row.target_field_id,
    sourceCardinality: row.source_cardinality,
    targetCardinality: row.target_cardinality,
    createdAt: new Date(row.created_at).getTime(),
});

export const relationshipToRow = (
    rel: DBRelationship,
    diagramId: string,
    userId: string
) => ({
    id: rel.id,
    diagram_id: diagramId,
    user_id: userId,
    name: rel.name,
    source_schema: rel.sourceSchema || null,
    source_table_id: rel.sourceTableId,
    target_schema: rel.targetSchema || null,
    target_table_id: rel.targetTableId,
    source_field_id: rel.sourceFieldId,
    target_field_id: rel.targetFieldId,
    source_cardinality: rel.sourceCardinality,
    target_cardinality: rel.targetCardinality,
    created_at: rel.createdAt
        ? new Date(rel.createdAt).toISOString()
        : new Date().toISOString(),
});

export const rowToDependency = (row: any): DBDependency => ({
    id: row.id,
    schema: row.schema || undefined,
    tableId: row.table_id,
    dependentSchema: row.dependent_schema || undefined,
    dependentTableId: row.dependent_table_id,
    createdAt: new Date(row.created_at).getTime(),
});

export const dependencyToRow = (
    dep: DBDependency,
    diagramId: string,
    userId: string
) => ({
    id: dep.id,
    diagram_id: diagramId,
    user_id: userId,
    schema: dep.schema || null,
    table_id: dep.tableId,
    dependent_schema: dep.dependentSchema || null,
    dependent_table_id: dep.dependentTableId,
    created_at: dep.createdAt
        ? new Date(dep.createdAt).toISOString()
        : new Date().toISOString(),
});

export const rowToArea = (row: any): Area => ({
    id: row.id,
    name: row.name || undefined,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
});

export const areaToRow = (area: Area, diagramId: string, userId: string) => ({
    id: area.id,
    diagram_id: diagramId,
    user_id: userId,
    name: area.name || null,
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    color: area.color,
});

export const rowToCustomType = (row: any): DBCustomType => ({
    id: row.id,
    schema: row.schema || undefined,
    name: row.name,
    kind: row.kind,
    values: row.values || [],
    fields: row.fields || [],
});

export const customTypeToRow = (
    ct: DBCustomType,
    diagramId: string,
    userId: string
) => ({
    id: ct.id,
    diagram_id: diagramId,
    user_id: userId,
    schema: ct.schema || null,
    name: ct.name,
    kind: ct.kind,
    values: ct.values || [],
    fields: ct.fields || [],
});

export const rowToNote = (row: any): Note => ({
    id: row.id,
    content: row.content || undefined,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
});

export const noteToRow = (note: Note, diagramId: string, userId: string) => ({
    id: note.id,
    diagram_id: diagramId,
    user_id: userId,
    content: note.content || null,
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
    color: note.color,
});

export const rowToFilter = (row: any): DiagramFilter => ({
    tableIds: row.table_ids || [],
    schemaIds: row.schemas_ids || [],
});

export const filterToRow = (
    filter: DiagramFilter,
    diagramId: string,
    userId: string
) => ({
    diagram_id: diagramId,
    user_id: userId,
    table_ids: filter.tableIds || [],
    schemas_ids: filter.schemaIds || [],
});
