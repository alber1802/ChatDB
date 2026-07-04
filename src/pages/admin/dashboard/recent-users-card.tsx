import React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/card/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';
import { Skeleton } from '@/components/skeleton/skeleton';
import { RoleBadge } from '../_components/role-badge';
import type { AdminUserProfile } from '../_types/admin.types';

interface RecentUsersCardProps {
    users: AdminUserProfile[];
    loading: boolean;
}

export const RecentUsersCard: React.FC<RecentUsersCardProps> = ({
    users,
    loading,
}) => {
    return (
        <Card className="flex h-full flex-col border border-border/40 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                    Usuarios Recientes
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                    Los últimos 5 usuarios que se han registrado en el sistema.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-6 text-xs font-semibold">
                                    Email / Nombre
                                </TableHead>
                                <TableHead className="text-xs font-semibold">
                                    Rol
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow
                                        key={i}
                                        className="hover:bg-transparent"
                                    >
                                        <TableCell className="py-3 pl-6">
                                            <div className="flex items-center gap-x-3">
                                                <Skeleton className="size-9 rounded-full bg-muted" />
                                                <div className="space-y-1.5">
                                                    <Skeleton className="h-4 w-28 bg-muted" />
                                                    <Skeleton className="h-3 w-20 bg-muted" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={2}
                                        className="py-8 text-center text-xs text-muted-foreground"
                                    >
                                        No hay usuarios registrados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow
                                        key={user.id}
                                        className="transition-colors hover:bg-muted/30"
                                    >
                                        <TableCell className="py-3 pl-6">
                                            <div className="flex items-center gap-x-3">
                                                <Avatar className="size-9 border border-border shadow-inner">
                                                    <AvatarImage
                                                        src={
                                                            user.avatar_url ||
                                                            ''
                                                        }
                                                    />
                                                    <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
                                                        {user.display_name
                                                            ?.substring(0, 2)
                                                            .toUpperCase() ||
                                                            'AD'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span
                                                        className="max-w-[180px] truncate text-sm font-medium text-foreground"
                                                        title={user.email}
                                                    >
                                                        {user.email}
                                                    </span>
                                                    <span className="max-w-[150px] truncate text-xs text-muted-foreground">
                                                        {user.display_name ||
                                                            '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <RoleBadge roleId={user.role_id} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
