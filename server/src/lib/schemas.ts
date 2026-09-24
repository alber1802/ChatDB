import { z } from 'zod';

export const diagramSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    databaseType: z.string().min(1),
    databaseEdition: z.string().optional().nullable(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.number(), z.date()]).optional(),
    tables: z.array(z.any()).optional(),
    relationships: z.array(z.any()).optional(),
    dependencies: z.array(z.any()).optional(),
    areas: z.array(z.any()).optional(),
    customTypes: z.array(z.any()).optional(),
    notes: z.array(z.any()).optional(),
});

export const diagramPatchSchema = z
    .object({
        name: z.string().min(1).optional(),
        databaseType: z.string().min(1).optional(),
        databaseEdition: z.string().nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
        message: 'At least one field is required',
    });

export const tableSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    schema: z.string().optional().nullable(),
    x: z.number(),
    y: z.number(),
    fields: z.array(z.any()).default([]),
    indexes: z.array(z.any()).default([]),
    color: z.string().optional().nullable(),
    width: z.number().optional().nullable(),
    comments: z.string().optional().nullable(),
    isView: z.boolean().optional().default(false),
    isMaterializedView: z.boolean().optional().default(false),
    order: z.number().optional().nullable(),
    // Antes no estaban en el esquema y zod los descartaba en silencio: ningún
    // CHECK, área padre ni estado expandido llegaba nunca a la base.
    checkConstraints: z.array(z.any()).nullable().optional(),
    expanded: z.boolean().nullable().optional(),
    parentAreaId: z.string().nullable().optional(),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
});

export const tablePatchSchema = z.object({
    name: z.string().optional(),
    schema: z.string().nullable().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fields: z.array(z.any()).optional(),
    indexes: z.array(z.any()).optional(),
    checkConstraints: z.array(z.any()).nullable().optional(),
    color: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    comments: z.string().nullable().optional(),
    isView: z.boolean().optional(),
    isMaterializedView: z.boolean().optional(),
    order: z.number().nullable().optional(),
    expanded: z.boolean().nullable().optional(),
    parentAreaId: z.string().nullable().optional(),
});

export const relationshipSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    sourceSchema: z.string().optional().nullable(),
    sourceTableId: z.string().min(1),
    targetSchema: z.string().optional().nullable(),
    targetTableId: z.string().min(1),
    sourceFieldId: z.string().min(1),
    targetFieldId: z.string().min(1),
    sourceCardinality: z.string().min(1),
    targetCardinality: z.string().min(1),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
});

export const relationshipPatchSchema = z.object({
    name: z.string().optional(),
    sourceSchema: z.string().nullable().optional(),
    sourceTableId: z.string().optional(),
    targetSchema: z.string().nullable().optional(),
    targetTableId: z.string().optional(),
    sourceFieldId: z.string().optional(),
    targetFieldId: z.string().optional(),
    sourceCardinality: z.string().optional(),
    targetCardinality: z.string().optional(),
});

export const dependencySchema = z.object({
    id: z.string().min(1),
    schema: z.string().optional().nullable(),
    tableId: z.string().min(1),
    dependentSchema: z.string().optional().nullable(),
    dependentTableId: z.string().min(1),
    createdAt: z.union([z.string(), z.number(), z.date()]).optional(),
});

export const dependencyPatchSchema = z.object({
    schema: z.string().nullable().optional(),
    tableId: z.string().optional(),
    dependentSchema: z.string().nullable().optional(),
    dependentTableId: z.string().optional(),
});

export const areaSchema = z.object({
    id: z.string().min(1),
    name: z.string().optional().nullable(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string(),
});

export const areaPatchSchema = z.object({
    name: z.string().nullable().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    color: z.string().optional(),
});

export const customTypeSchema = z.object({
    id: z.string().min(1),
    schema: z.string().optional().nullable(),
    name: z.string().min(1),
    kind: z.string().min(1),
    values: z.array(z.any()).default([]),
    fields: z.array(z.any()).default([]),
});

export const customTypePatchSchema = z.object({
    schema: z.string().nullable().optional(),
    name: z.string().optional(),
    kind: z.string().optional(),
    values: z.array(z.any()).optional(),
    fields: z.array(z.any()).optional(),
});

export const noteSchema = z.object({
    id: z.string().min(1),
    content: z.string().optional().nullable(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string(),
});

export const notePatchSchema = z.object({
    content: z.string().nullable().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    color: z.string().optional(),
});

export const filterSchema = z.object({
    tableIds: z.array(z.string()).default([]),
    schemaIds: z.array(z.string()).default([]),
});

export const configSchema = z.object({
    defaultDiagramId: z.string().optional().nullable(),
});

export const shareRolePatchSchema = z.object({
    role: z.enum(['editor', 'viewer']),
});

export const invitationCreateSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(320),
    role: z.enum(['editor', 'viewer']),
});

export const shareCandidatesQuerySchema = z.object({
    q: z.string().trim().max(100).optional().default(''),
});

export const shareCreateSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['editor', 'viewer']),
});

export const notificationsReadSchema = z.object({
    ids: z.array(z.string().uuid()).max(100).optional(),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const waitlistInsertSchema = z.object({
    email: z.string().email(),
});

export const waitlistPatchSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']),
    notes: z.string().optional().nullable(),
});

export const userPatchSchema = z.object({
    displayName: z.string().optional().nullable(),
    roleId: z.enum(['user', 'admin', 'super_admin']).optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().optional().nullable(),
});

export const includeQuerySchema = z.object({
    includeTables: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    includeRelationships: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    includeDependencies: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    includeAreas: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    includeCustomTypes: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
    includeNotes: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
});

const SUB_ENTITIES = ['field', 'index', 'checkConstraint'] as const;

export const syncOperationSchema = z
    .object({
        opId: z.string().min(1).max(100).optional(),
        entity: z.enum([
            'diagram',
            'table',
            ...SUB_ENTITIES,
            'relationship',
            'dependency',
            'area',
            'customType',
            'note',
        ]),
        op: z.enum(['create', 'update', 'delete']),
        id: z.string().min(1),
        // Tabla contenedora de field/index/checkConstraint.
        parentId: z.string().min(1).optional(),
        afterId: z.string().min(1).nullable().optional(),
        patch: z.record(z.string(), z.any()).optional(),
    })
    .refine(
        (op) =>
            !(SUB_ENTITIES as readonly string[]).includes(op.entity) ||
            Boolean(op.parentId),
        { message: 'parentId is required for field/index/checkConstraint' }
    );

export const syncRequestSchema = z.object({
    baseVersion: z.number().int().nonnegative(),
    sessionId: z.string().min(1).max(100).optional(),
    batchId: z.string().uuid().optional(),
    operations: z.array(syncOperationSchema).min(1).max(500),
});
