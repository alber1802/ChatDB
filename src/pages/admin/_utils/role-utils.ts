export interface RoleBadgeInfo {
    label: string;
    className: string;
}

export const getRoleBadgeInfo = (
    roleId: string | null | undefined
): RoleBadgeInfo => {
    switch (roleId) {
        case 'super_admin':
            return {
                label: 'Super Admin',
                className:
                    'bg-red-500/10 text-red-500 border border-red-500/20',
            };
        case 'admin':
            return {
                label: 'Admin',
                className:
                    'bg-blue-500/10 text-blue-500 border border-blue-500/20',
            };
        default:
            return {
                label: 'User',
                className:
                    'bg-green-500/10 text-green-500 border border-green-500/20',
            };
    }
};

export interface ActionBadgeInfo {
    className: string;
}

export const getActionBadgeInfo = (action: string): ActionBadgeInfo => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('remove')) {
        return {
            className: 'bg-red-500/10 text-red-500 border border-red-500/20',
        };
    }
    if (
        act.includes('update') ||
        act.includes('edit') ||
        act.includes('role') ||
        act.includes('assign')
    ) {
        return {
            className:
                'bg-amber-500/10 text-amber-500 border border-amber-500/20',
        };
    }
    if (act.includes('create') || act.includes('add') || act.includes('save')) {
        return {
            className:
                'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        };
    }
    return {
        className: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    };
};
