import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import { Skeleton } from '@/components/skeleton/skeleton';

export interface AdminColumn<T> {
    header: React.ReactNode;
    className?: string;
    cellClassName?: string;
    render: (item: T) => React.ReactNode;
}

interface AdminTableProps<T> {
    columns: AdminColumn<T>[];
    data: T[];
    loading: boolean;
    emptyMessage?: string;
    skeletonRowsCount?: number;
}

export function AdminTable<T>({
    columns,
    data,
    loading,
    emptyMessage = 'No se encontraron resultados',
    skeletonRowsCount = 5,
}: AdminTableProps<T>) {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-border/30 hover:bg-transparent">
                        {columns.map((col, idx) => (
                            <TableHead key={idx} className={col.className}>
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: skeletonRowsCount }).map(
                            (_, rowIndex) => (
                                <TableRow
                                    key={rowIndex}
                                    className="border-b border-border/20 hover:bg-transparent"
                                >
                                    {columns.map((col, colIndex) => (
                                        <TableCell
                                            key={colIndex}
                                            className={col.cellClassName}
                                        >
                                            <Skeleton className="h-4 w-4/5 max-w-[120px] bg-muted/60" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            )
                        )
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="py-12 text-center text-sm text-muted-foreground"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item, rowIndex) => (
                            <TableRow
                                key={rowIndex}
                                className="border-b border-border/20 transition-colors last:border-0 hover:bg-muted/30"
                            >
                                {columns.map((col, colIndex) => (
                                    <TableCell
                                        key={colIndex}
                                        className={col.cellClassName}
                                    >
                                        {col.render(item)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
