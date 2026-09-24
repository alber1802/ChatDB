// Rol del usuario actual sobre un diagrama (docs/collaboration/01-architecture.md).
// Solo sirve para la UX: la autorización real vive en el backend (RLS +
// syncService). Un diagrama sin `accessRole` (respuesta de una API anterior)
// se trata como propio, que es lo único que existía antes de compartir.
export type DiagramAccessRole = 'owner' | 'editor' | 'viewer';

export interface DiagramOwner {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
}

interface WithAccessRole {
    accessRole?: DiagramAccessRole;
}

export const canEditDiagram = (diagram: WithAccessRole): boolean =>
    diagram.accessRole !== 'viewer';

export const canManageDiagram = (diagram: WithAccessRole): boolean =>
    (diagram.accessRole ?? 'owner') === 'owner';

const ROLE_LABELS: Record<DiagramAccessRole, string> = {
    owner: 'Propietario',
    editor: 'Editor',
    viewer: 'Lector',
};

export const accessRoleLabel = (role: DiagramAccessRole): string =>
    ROLE_LABELS[role];

export const resolveReadonly = ({
    readonlyProp,
    hasDiff,
    accessRole,
}: {
    readonlyProp?: boolean;
    hasDiff: boolean;
    accessRole?: DiagramAccessRole;
}): boolean => readonlyProp ?? (hasDiff || accessRole === 'viewer');
