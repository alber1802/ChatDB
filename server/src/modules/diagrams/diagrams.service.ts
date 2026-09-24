import type { PoolClient } from 'pg';
import {
    areaToRow,
    customTypeToRow,
    dependencyToRow,
    diagramToRow,
    noteToRow,
    relationshipToRow,
    rowToArea,
    rowToCustomType,
    rowToDependency,
    rowToDiagram,
    rowToNote,
    rowToRelationship,
    rowToTable,
    tableToRow,
    type AreaDto,
    type CustomTypeDto,
    type DependencyDto,
    type DiagramDto,
    type NoteDto,
    type RelationshipDto,
    type TableDto,
} from '../../lib/mappers.js';
import { AppError } from '../../lib/types.js';

export type IncludeOptions = {
    includeTables?: boolean;
    includeRelationships?: boolean;
    includeDependencies?: boolean;
    includeAreas?: boolean;
    includeCustomTypes?: boolean;
    includeNotes?: boolean;
};

async function listTables(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM db_tables WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows.map((r) => rowToTable(r));
}

async function listRelationships(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM db_relationships WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows
        .map((r) => rowToRelationship(r))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function listDependencies(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM db_dependencies WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows.map((r) => rowToDependency(r));
}

async function listAreas(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM areas WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows.map((r) => rowToArea(r));
}

async function listCustomTypes(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM db_custom_types WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows
        .map((r) => rowToCustomType(r))
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function listNotes(client: PoolClient, diagramId: string) {
    const { rows } = await client.query(
        `SELECT * FROM notes WHERE diagram_id = $1`,
        [diagramId]
    );
    return rows.map((r) => rowToNote(r));
}

async function hydrate(
    client: PoolClient,
    diagram: DiagramDto,
    options?: IncludeOptions
): Promise<DiagramDto> {
    if (options?.includeTables)
        diagram.tables = await listTables(client, diagram.id);
    if (options?.includeRelationships)
        diagram.relationships = await listRelationships(client, diagram.id);
    if (options?.includeDependencies)
        diagram.dependencies = await listDependencies(client, diagram.id);
    if (options?.includeAreas)
        diagram.areas = await listAreas(client, diagram.id);
    if (options?.includeCustomTypes)
        diagram.customTypes = await listCustomTypes(client, diagram.id);
    if (options?.includeNotes)
        diagram.notes = await listNotes(client, diagram.id);
    return diagram;
}

/**
 * Rol del usuario actual (auth.uid(), fijado por withUserContext) sobre la
 * fila `d` de diagrams: 'owner' | 'editor' | 'viewer', o NULL sin acceso.
 * El propietario es implícito (diagrams.user_id), no una fila de shares.
 */
export const ACCESS_ROLE_SQL = `CASE WHEN d.user_id = auth.uid() THEN 'owner'
    ELSE (SELECT ds.role FROM diagram_shares ds
          WHERE ds.diagram_id = d.id AND ds.shared_with = auth.uid())
    END`;

const DIAGRAM_SELECT = `SELECT d.*, ${ACCESS_ROLE_SQL} AS access_role,
        up.display_name AS owner_display_name,
        up.avatar_url AS owner_avatar_url
    FROM diagrams d
    LEFT JOIN user_profiles up ON up.user_id = d.user_id`;

function upsertSql(
    table: string,
    row: Record<string, unknown>,
    conflict: string,
    immutable: string[] = []
) {
    const keys = Object.keys(row);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updates = keys
        .filter((k) => k !== conflict && k !== 'id' && !immutable.includes(k))
        .map((k) => `"${k}" = EXCLUDED."${k}"`)
        .join(', ');
    return {
        text: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})
               ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`,
        values: keys.map((k) => row[k]),
    };
}

export const diagramsService = {
    listTables,
    listRelationships,
    listDependencies,
    listAreas,
    listCustomTypes,
    listNotes,

    async list(client: PoolClient, options?: IncludeOptions) {
        const { rows } = await client.query(
            `${DIAGRAM_SELECT} ORDER BY d.created_at DESC`
        );
        const diagrams = rows.map((r) => rowToDiagram(r));
        return Promise.all(diagrams.map((d) => hydrate(client, d, options)));
    },

    async get(client: PoolClient, id: string, options?: IncludeOptions) {
        const { rows } = await client.query(
            `${DIAGRAM_SELECT} WHERE d.id = $1`,
            [id]
        );
        if (!rows[0]) return undefined;
        return hydrate(client, rowToDiagram(rows[0]), options);
    },

    async create(client: PoolClient, diagram: DiagramDto, userId: string) {
        const row = diagramToRow(diagram, userId);
        // Un upsert sobre un diagrama existente (p.ej. un editor compartido
        // re-subiendo el diagrama) nunca puede cambiar de propietario.
        const q = upsertSql('diagrams', row, 'id', ['user_id', 'created_at']);
        await client.query(q.text, q.values);

        const children: Array<Promise<unknown>> = [];

        for (const t of diagram.tables ?? []) {
            const r = tableToRow(t as TableDto, diagram.id, userId);
            const uq = upsertSql('db_tables', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }
        for (const rel of diagram.relationships ?? []) {
            const r = relationshipToRow(
                rel as RelationshipDto,
                diagram.id,
                userId
            );
            const uq = upsertSql('db_relationships', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }
        for (const dep of diagram.dependencies ?? []) {
            const r = dependencyToRow(dep as DependencyDto, diagram.id, userId);
            const uq = upsertSql('db_dependencies', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }
        for (const area of diagram.areas ?? []) {
            const r = areaToRow(area as AreaDto, diagram.id, userId);
            const uq = upsertSql('areas', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }
        for (const ct of diagram.customTypes ?? []) {
            const r = customTypeToRow(ct as CustomTypeDto, diagram.id, userId);
            const uq = upsertSql('db_custom_types', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }
        for (const note of diagram.notes ?? []) {
            const r = noteToRow(note as NoteDto, diagram.id, userId);
            const uq = upsertSql('notes', r, 'id');
            children.push(client.query(uq.text, uq.values));
        }

        await Promise.all(children);
    },

    async update(
        client: PoolClient,
        id: string,
        attributes: {
            name?: string;
            databaseType?: string;
            databaseEdition?: string | null;
        }
    ) {
        const mapped: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (attributes.name !== undefined) mapped.name = attributes.name;
        if (attributes.databaseType !== undefined)
            mapped.database_type = attributes.databaseType;
        if (attributes.databaseEdition !== undefined)
            mapped.database_edition = attributes.databaseEdition;

        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE diagrams SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount)
            throw new AppError(404, 'Diagram not found', 'not_found');
    },

    async remove(client: PoolClient, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM diagrams WHERE id = $1`,
            [id]
        );
        if (!rowCount)
            throw new AppError(404, 'Diagram not found', 'not_found');
    },

    async upsertTable(
        client: PoolClient,
        diagramId: string,
        table: TableDto,
        userId: string
    ) {
        const r = tableToRow(table, diagramId, userId);
        const q = upsertSql('db_tables', r, 'id');
        await client.query(q.text, q.values);
    },

    async getTable(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM db_tables WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToTable(rows[0]) : undefined;
    },

    async updateTable(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.name !== undefined) mapped.name = attributes.name;
        if (attributes.schema !== undefined)
            mapped.schema = attributes.schema ?? null;
        if (attributes.x !== undefined) mapped.x = attributes.x;
        if (attributes.y !== undefined) mapped.y = attributes.y;
        if (attributes.fields !== undefined)
            mapped.fields = JSON.stringify(attributes.fields);
        if (attributes.indexes !== undefined)
            mapped.indexes = JSON.stringify(attributes.indexes);
        if (attributes.color !== undefined)
            mapped.color = attributes.color ?? null;
        if (attributes.width !== undefined)
            mapped.width = attributes.width ?? null;
        if (attributes.comments !== undefined)
            mapped.comment = attributes.comments ?? null;
        if (attributes.isView !== undefined) mapped.is_view = attributes.isView;
        if (attributes.isMaterializedView !== undefined)
            mapped.is_materialized_view = attributes.isMaterializedView;
        if (attributes.order !== undefined)
            mapped.order = attributes.order ?? null;
        if (attributes.checkConstraints !== undefined)
            mapped.check_constraints = JSON.stringify(
                attributes.checkConstraints ?? []
            );
        if (attributes.expanded !== undefined)
            mapped.expanded = attributes.expanded ?? null;
        if (attributes.parentAreaId !== undefined)
            mapped.parent_area_id = attributes.parentAreaId ?? null;

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE db_tables SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount) throw new AppError(404, 'Table not found', 'not_found');
    },

    async deleteTable(client: PoolClient, diagramId: string, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM db_tables WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount) throw new AppError(404, 'Table not found', 'not_found');
    },

    async deleteDiagramTables(client: PoolClient, diagramId: string) {
        await client.query(`DELETE FROM db_tables WHERE diagram_id = $1`, [
            diagramId,
        ]);
    },

    async upsertRelationship(
        client: PoolClient,
        diagramId: string,
        rel: RelationshipDto,
        userId: string
    ) {
        const r = relationshipToRow(rel, diagramId, userId);
        const q = upsertSql('db_relationships', r, 'id');
        await client.query(q.text, q.values);
    },

    async getRelationship(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM db_relationships WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToRelationship(rows[0]) : undefined;
    },

    async updateRelationship(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.name !== undefined) mapped.name = attributes.name;
        if (attributes.sourceSchema !== undefined)
            mapped.source_schema = attributes.sourceSchema ?? null;
        if (attributes.sourceTableId !== undefined)
            mapped.source_table_id = attributes.sourceTableId;
        if (attributes.targetSchema !== undefined)
            mapped.target_schema = attributes.targetSchema ?? null;
        if (attributes.targetTableId !== undefined)
            mapped.target_table_id = attributes.targetTableId;
        if (attributes.sourceFieldId !== undefined)
            mapped.source_field_id = attributes.sourceFieldId;
        if (attributes.targetFieldId !== undefined)
            mapped.target_field_id = attributes.targetFieldId;
        if (attributes.sourceCardinality !== undefined)
            mapped.source_cardinality = attributes.sourceCardinality;
        if (attributes.targetCardinality !== undefined)
            mapped.target_cardinality = attributes.targetCardinality;

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE db_relationships SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount)
            throw new AppError(404, 'Relationship not found', 'not_found');
    },

    async deleteRelationship(
        client: PoolClient,
        diagramId: string,
        id: string
    ) {
        const { rowCount } = await client.query(
            `DELETE FROM db_relationships WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount)
            throw new AppError(404, 'Relationship not found', 'not_found');
    },

    async deleteDiagramRelationships(client: PoolClient, diagramId: string) {
        await client.query(
            `DELETE FROM db_relationships WHERE diagram_id = $1`,
            [diagramId]
        );
    },

    async upsertDependency(
        client: PoolClient,
        diagramId: string,
        dep: DependencyDto,
        userId: string
    ) {
        const r = dependencyToRow(dep, diagramId, userId);
        const q = upsertSql('db_dependencies', r, 'id');
        await client.query(q.text, q.values);
    },

    async getDependency(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM db_dependencies WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToDependency(rows[0]) : undefined;
    },

    async updateDependency(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.schema !== undefined)
            mapped.schema = attributes.schema ?? null;
        if (attributes.tableId !== undefined)
            mapped.table_id = attributes.tableId;
        if (attributes.dependentSchema !== undefined)
            mapped.dependent_schema = attributes.dependentSchema ?? null;
        if (attributes.dependentTableId !== undefined)
            mapped.dependent_table_id = attributes.dependentTableId;

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE db_dependencies SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount)
            throw new AppError(404, 'Dependency not found', 'not_found');
    },

    async deleteDependency(client: PoolClient, diagramId: string, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM db_dependencies WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount)
            throw new AppError(404, 'Dependency not found', 'not_found');
    },

    async deleteDiagramDependencies(client: PoolClient, diagramId: string) {
        await client.query(
            `DELETE FROM db_dependencies WHERE diagram_id = $1`,
            [diagramId]
        );
    },

    async upsertArea(
        client: PoolClient,
        diagramId: string,
        area: AreaDto,
        userId: string
    ) {
        const r = areaToRow(area, diagramId, userId);
        const q = upsertSql('areas', r, 'id');
        await client.query(q.text, q.values);
    },

    async getArea(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM areas WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToArea(rows[0]) : undefined;
    },

    async updateArea(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.name !== undefined)
            mapped.name = attributes.name ?? null;
        if (attributes.x !== undefined) mapped.x = attributes.x;
        if (attributes.y !== undefined) mapped.y = attributes.y;
        if (attributes.width !== undefined) mapped.width = attributes.width;
        if (attributes.height !== undefined) mapped.height = attributes.height;
        if (attributes.color !== undefined) mapped.color = attributes.color;

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE areas SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount) throw new AppError(404, 'Area not found', 'not_found');
    },

    async deleteArea(client: PoolClient, diagramId: string, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM areas WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount) throw new AppError(404, 'Area not found', 'not_found');
    },

    async deleteDiagramAreas(client: PoolClient, diagramId: string) {
        await client.query(`DELETE FROM areas WHERE diagram_id = $1`, [
            diagramId,
        ]);
    },

    async upsertCustomType(
        client: PoolClient,
        diagramId: string,
        ct: CustomTypeDto,
        userId: string
    ) {
        const r = customTypeToRow(ct, diagramId, userId);
        const q = upsertSql('db_custom_types', r, 'id');
        await client.query(q.text, q.values);
    },

    async getCustomType(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM db_custom_types WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToCustomType(rows[0]) : undefined;
    },

    async updateCustomType(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.schema !== undefined)
            mapped.schema = attributes.schema ?? null;
        if (attributes.name !== undefined) mapped.name = attributes.name;
        if (attributes.kind !== undefined) mapped.kind = attributes.kind;
        if (attributes.values !== undefined)
            mapped.values = JSON.stringify(attributes.values);
        if (attributes.fields !== undefined)
            mapped.fields = JSON.stringify(attributes.fields);

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE db_custom_types SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount)
            throw new AppError(404, 'Custom type not found', 'not_found');
    },

    async deleteCustomType(client: PoolClient, diagramId: string, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM db_custom_types WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount)
            throw new AppError(404, 'Custom type not found', 'not_found');
    },

    async deleteDiagramCustomTypes(client: PoolClient, diagramId: string) {
        await client.query(
            `DELETE FROM db_custom_types WHERE diagram_id = $1`,
            [diagramId]
        );
    },

    async upsertNote(
        client: PoolClient,
        diagramId: string,
        note: NoteDto,
        userId: string
    ) {
        const r = noteToRow(note, diagramId, userId);
        const q = upsertSql('notes', r, 'id');
        await client.query(q.text, q.values);
    },

    async getNote(client: PoolClient, diagramId: string, id: string) {
        const { rows } = await client.query(
            `SELECT * FROM notes WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        return rows[0] ? rowToNote(rows[0]) : undefined;
    },

    async updateNote(
        client: PoolClient,
        id: string,
        attributes: Record<string, unknown>
    ) {
        const mapped: Record<string, unknown> = {};
        if (attributes.content !== undefined)
            mapped.content = attributes.content ?? null;
        if (attributes.x !== undefined) mapped.x = attributes.x;
        if (attributes.y !== undefined) mapped.y = attributes.y;
        if (attributes.width !== undefined) mapped.width = attributes.width;
        if (attributes.height !== undefined) mapped.height = attributes.height;
        if (attributes.color !== undefined) mapped.color = attributes.color;

        if (Object.keys(mapped).length === 0) return;
        const keys = Object.keys(mapped);
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const { rowCount } = await client.query(
            `UPDATE notes SET ${sets} WHERE id = $${keys.length + 1}`,
            [...keys.map((k) => mapped[k]), id]
        );
        if (!rowCount) throw new AppError(404, 'Note not found', 'not_found');
    },

    async deleteNote(client: PoolClient, diagramId: string, id: string) {
        const { rowCount } = await client.query(
            `DELETE FROM notes WHERE diagram_id = $1 AND id = $2`,
            [diagramId, id]
        );
        if (!rowCount) throw new AppError(404, 'Note not found', 'not_found');
    },

    async deleteDiagramNotes(client: PoolClient, diagramId: string) {
        await client.query(`DELETE FROM notes WHERE diagram_id = $1`, [
            diagramId,
        ]);
    },
};
