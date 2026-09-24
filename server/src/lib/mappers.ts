/**
 * Domain mappers: Postgres snake_case rows <-> API camelCase payloads.
 * Port of src/lib/supabase-mappers.ts
 */

export type DiagramAccessRole = 'owner' | 'editor' | 'viewer';

export interface DiagramOwnerDto {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
}

export interface DiagramDto {
    id: string;
    name: string;
    databaseType: string;
    databaseEdition?: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    accessRole?: DiagramAccessRole;
    owner?: DiagramOwnerDto;
    tables?: TableDto[];
    relationships?: RelationshipDto[];
    dependencies?: DependencyDto[];
    areas?: AreaDto[];
    customTypes?: CustomTypeDto[];
    notes?: NoteDto[];
}

export interface TableDto {
    id: string;
    name: string;
    schema?: string;
    x: number;
    y: number;
    fields: unknown[];
    indexes: unknown[];
    color?: string;
    width?: number;
    comments?: string;
    isView: boolean;
    isMaterializedView: boolean;
    order?: number;
    checkConstraints?: unknown[] | null;
    expanded?: boolean | null;
    parentAreaId?: string | null;
    createdAt: number;
}

export interface RelationshipDto {
    id: string;
    name: string;
    sourceSchema?: string;
    sourceTableId: string;
    targetSchema?: string;
    targetTableId: string;
    sourceFieldId: string;
    targetFieldId: string;
    sourceCardinality: string;
    targetCardinality: string;
    createdAt: number;
}

export interface DependencyDto {
    id: string;
    schema?: string;
    tableId: string;
    dependentSchema?: string;
    dependentTableId: string;
    createdAt: number;
}

export interface AreaDto {
    id: string;
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface CustomTypeDto {
    id: string;
    schema?: string;
    name: string;
    kind: string;
    values: unknown[];
    fields: unknown[];
}

export interface NoteDto {
    id: string;
    content?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface DiagramFilterDto {
    tableIds: string[];
    schemaIds: string[];
}

export interface ConfigDto {
    defaultDiagramId: string;
}

// ─── Diagrams ────────────────────────────────────────────────────────────────

export function rowToDiagram(row: Record<string, unknown>): DiagramDto {
    return {
        id: String(row.id),
        name: String(row.name),
        databaseType: String(row.database_type),
        databaseEdition: (row.database_edition as string) || undefined,
        version: row.version != null ? Number(row.version) : 1,
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        ...(row.access_role
            ? { accessRole: row.access_role as DiagramAccessRole }
            : {}),
        ...('owner_display_name' in row
            ? {
                  owner: {
                      id: String(row.user_id),
                      displayName: (row.owner_display_name as string) ?? null,
                      avatarUrl: (row.owner_avatar_url as string) ?? null,
                  },
              }
            : {}),
    };
}

export function diagramToRow(diagram: DiagramDto, userId: string) {
    return {
        id: diagram.id,
        user_id: userId,
        name: diagram.name,
        database_type: diagram.databaseType,
        database_edition: diagram.databaseEdition ?? null,
        created_at: diagram.createdAt
            ? new Date(diagram.createdAt).toISOString()
            : new Date().toISOString(),
        updated_at: diagram.updatedAt
            ? new Date(diagram.updatedAt).toISOString()
            : new Date().toISOString(),
    };
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export function rowToTable(row: Record<string, unknown>): TableDto {
    return {
        id: String(row.id),
        name: String(row.name),
        schema: (row.schema as string) || undefined,
        x: Number(row.x),
        y: Number(row.y),
        fields: (row.fields as unknown[]) || [],
        indexes: (row.indexes as unknown[]) || [],
        color: (row.color as string) || undefined,
        width: row.width != null ? Number(row.width) : undefined,
        comments: (row.comment as string) || undefined,
        isView: Boolean(row.is_view ?? false),
        isMaterializedView: Boolean(row.is_materialized_view ?? false),
        order: row.order != null ? Number(row.order) : undefined,
        checkConstraints: (row.check_constraints as unknown[]) || [],
        expanded: row.expanded != null ? Boolean(row.expanded) : undefined,
        parentAreaId: (row.parent_area_id as string) || null,
        createdAt: new Date(String(row.created_at)).getTime(),
    };
}

export function tableToRow(table: TableDto, diagramId: string, userId: string) {
    return {
        id: table.id,
        diagram_id: diagramId,
        user_id: userId,
        name: table.name,
        schema: table.schema ?? null,
        x: table.x,
        y: table.y,
        fields: JSON.stringify(table.fields ?? []),
        indexes: JSON.stringify(table.indexes ?? []),
        color: table.color ?? null,
        width: table.width ?? null,
        comment: table.comments ?? null,
        is_view: table.isView ?? false,
        is_materialized_view: table.isMaterializedView ?? false,
        order: table.order ?? null,
        check_constraints: JSON.stringify(table.checkConstraints ?? []),
        expanded: table.expanded ?? null,
        parent_area_id: table.parentAreaId ?? null,
        created_at: table.createdAt
            ? new Date(table.createdAt).toISOString()
            : new Date().toISOString(),
    };
}

// ─── Relationships ───────────────────────────────────────────────────────────

export function rowToRelationship(
    row: Record<string, unknown>
): RelationshipDto {
    return {
        id: String(row.id),
        name: String(row.name),
        sourceSchema: (row.source_schema as string) || undefined,
        sourceTableId: String(row.source_table_id),
        targetSchema: (row.target_schema as string) || undefined,
        targetTableId: String(row.target_table_id),
        sourceFieldId: String(row.source_field_id),
        targetFieldId: String(row.target_field_id),
        sourceCardinality: String(row.source_cardinality),
        targetCardinality: String(row.target_cardinality),
        createdAt: new Date(String(row.created_at)).getTime(),
    };
}

export function relationshipToRow(
    rel: RelationshipDto,
    diagramId: string,
    userId: string
) {
    return {
        id: rel.id,
        diagram_id: diagramId,
        user_id: userId,
        name: rel.name,
        source_schema: rel.sourceSchema ?? null,
        source_table_id: rel.sourceTableId,
        target_schema: rel.targetSchema ?? null,
        target_table_id: rel.targetTableId,
        source_field_id: rel.sourceFieldId,
        target_field_id: rel.targetFieldId,
        source_cardinality: rel.sourceCardinality,
        target_cardinality: rel.targetCardinality,
        created_at: rel.createdAt
            ? new Date(rel.createdAt).toISOString()
            : new Date().toISOString(),
    };
}

// ─── Dependencies ────────────────────────────────────────────────────────────

export function rowToDependency(row: Record<string, unknown>): DependencyDto {
    return {
        id: String(row.id),
        schema: (row.schema as string) || undefined,
        tableId: String(row.table_id),
        dependentSchema: (row.dependent_schema as string) || undefined,
        dependentTableId: String(row.dependent_table_id),
        createdAt: new Date(String(row.created_at)).getTime(),
    };
}

export function dependencyToRow(
    dep: DependencyDto,
    diagramId: string,
    userId: string
) {
    return {
        id: dep.id,
        diagram_id: diagramId,
        user_id: userId,
        schema: dep.schema ?? null,
        table_id: dep.tableId,
        dependent_schema: dep.dependentSchema ?? null,
        dependent_table_id: dep.dependentTableId,
        created_at: dep.createdAt
            ? new Date(dep.createdAt).toISOString()
            : new Date().toISOString(),
    };
}

// ─── Areas ───────────────────────────────────────────────────────────────────

export function rowToArea(row: Record<string, unknown>): AreaDto {
    return {
        id: String(row.id),
        name: (row.name as string) || undefined,
        x: Number(row.x),
        y: Number(row.y),
        width: Number(row.width),
        height: Number(row.height),
        color: String(row.color),
    };
}

export function areaToRow(area: AreaDto, diagramId: string, userId: string) {
    return {
        id: area.id,
        diagram_id: diagramId,
        user_id: userId,
        name: area.name ?? null,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        color: area.color,
    };
}

// ─── Custom types ────────────────────────────────────────────────────────────

export function rowToCustomType(row: Record<string, unknown>): CustomTypeDto {
    return {
        id: String(row.id),
        schema: (row.schema as string) || undefined,
        name: String(row.name),
        kind: String(row.kind),
        values: (row.values as unknown[]) || [],
        fields: (row.fields as unknown[]) || [],
    };
}

export function customTypeToRow(
    ct: CustomTypeDto,
    diagramId: string,
    userId: string
) {
    return {
        id: ct.id,
        diagram_id: diagramId,
        user_id: userId,
        schema: ct.schema ?? null,
        name: ct.name,
        kind: ct.kind,
        values: JSON.stringify(ct.values ?? []),
        fields: JSON.stringify(ct.fields ?? []),
    };
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function rowToNote(row: Record<string, unknown>): NoteDto {
    return {
        id: String(row.id),
        content: (row.content as string) || undefined,
        x: Number(row.x),
        y: Number(row.y),
        width: Number(row.width),
        height: Number(row.height),
        color: String(row.color),
    };
}

export function noteToRow(note: NoteDto, diagramId: string, userId: string) {
    return {
        id: note.id,
        diagram_id: diagramId,
        user_id: userId,
        content: note.content ?? null,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        color: note.color,
    };
}

// ─── Filters / config ────────────────────────────────────────────────────────

export function rowToFilter(row: Record<string, unknown>): DiagramFilterDto {
    return {
        tableIds: (row.table_ids as string[]) || [],
        schemaIds: (row.schemas_ids as string[]) || [],
    };
}

export function filterToRow(
    filter: DiagramFilterDto,
    diagramId: string,
    userId: string
) {
    return {
        diagram_id: diagramId,
        user_id: userId,
        table_ids: JSON.stringify(filter.tableIds ?? []),
        schemas_ids: JSON.stringify(filter.schemaIds ?? []),
    };
}
