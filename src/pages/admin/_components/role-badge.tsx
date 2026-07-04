import React from 'react';
import { Badge } from '@/components/badge/badge';
import { getRoleBadgeInfo } from '../_utils/role-utils';

interface RoleBadgeProps {
    roleId: string | null | undefined;
    className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ roleId, className }) => {
    const { label, className: badgeClass } = getRoleBadgeInfo(roleId);

    return (
        <Badge
            variant="outline"
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badgeClass} ${className || ''}`}
        >
            {label}
        </Badge>
    );
};
