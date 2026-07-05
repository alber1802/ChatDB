import React, { useState } from 'react';
import { Button } from '@/components/button/button';
import { DiagramIcon } from '@/components/diagram-icon/diagram-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/dropdown-menu/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/alert-dialog/alert-dialog';
import { RenameDiagramDialog } from './rename-diagram-dialog';
import {
    MoreVertical,
    Calendar,
    Table2,
    Trash2,
    Edit,
    Copy,
    ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Diagram } from '@/lib/domain/diagram';

interface DiagramListItemProps {
    diagram: Diagram;
    onDelete: (id: string) => Promise<void>;
    onRename: (id: string, newName: string) => Promise<void>;
    onDuplicate: (diagram: Diagram) => Promise<void>;
}

export const DiagramListItem: React.FC<DiagramListItemProps> = ({
    diagram,
    onDelete,
    onRename,
    onDuplicate,
}) => {
    const navigate = useNavigate();
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const handleOpen = () => {
        navigate(`/diagrams/${diagram.id}`);
    };

    const formattedDate = new Date(diagram.updatedAt).toLocaleDateString(
        undefined,
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }
    );

    const tablesCount = diagram.tables?.length || 0;

    return (
        <>
            <div
                onClick={handleOpen}
                className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-border/40 bg-card/55 p-4 backdrop-blur-md transition-all duration-300 hover:border-primary/30 hover:bg-card/85 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
            >
                {/* Left Section: Icon & Info */}
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 transition-colors duration-200 group-hover:border-primary/15 group-hover:bg-primary/5">
                        <DiagramIcon
                            databaseType={diagram.databaseType}
                            databaseEdition={diagram.databaseEdition}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3
                                className="max-w-[200px] truncate text-sm font-semibold text-foreground transition-colors duration-150 group-hover:text-primary sm:max-w-xs"
                                title={diagram.name}
                            >
                                {diagram.name}
                            </h3>
                            <span className="rounded bg-muted/65 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase text-muted-foreground">
                                {diagram.databaseType}
                            </span>
                        </div>
                        <p
                            className="mt-0.5 max-w-lg truncate text-xs text-muted-foreground"
                            title={diagram.description || ''}
                        >
                            {diagram.description || 'Sin descripción.'}
                        </p>
                    </div>
                </div>

                {/* Right Section: Stats & Date & Actions */}
                <div className="flex items-center justify-between gap-4 border-t border-border/30 pt-3 sm:border-t-0 sm:pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {/* Table count */}
                        <div className="flex items-center gap-1">
                            <Table2 className="size-3.5 text-muted-foreground/60" />
                            <span>
                                {tablesCount}{' '}
                                {tablesCount === 1 ? 'tabla' : 'tablas'}
                            </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1">
                            <Calendar className="size-3.5 text-muted-foreground/60" />
                            <span>{formattedDate}</span>
                        </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 cursor-pointer rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                    onClick={handleOpen}
                                    className="cursor-pointer gap-2"
                                >
                                    <ExternalLink className="size-3.5 text-muted-foreground" />
                                    Abrir Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setIsRenameOpen(true)}
                                    className="cursor-pointer gap-2"
                                >
                                    <Edit className="size-3.5 text-muted-foreground" />
                                    Renombrar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDuplicate(diagram)}
                                    className="cursor-pointer gap-2"
                                >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setIsDeleteOpen(true)}
                                    className="cursor-pointer gap-2 text-red-600 focus:bg-red-500/10 focus:text-red-600"
                                >
                                    <Trash2 className="size-3.5" />
                                    Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Rename Modal */}
            <RenameDiagramDialog
                open={isRenameOpen}
                onClose={() => setIsRenameOpen(false)}
                onConfirm={(newName) => onRename(diagram.id, newName)}
                initialName={diagram.name}
            />

            {/* Delete Confirmation Alert */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Estás seguro de eliminar este diagrama?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará de forma permanente el
                            diagrama "{diagram.name}" y todos sus objetos
                            relacionados (tablas, relaciones y notas). No se
                            puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setIsDeleteOpen(false)}
                        >
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                await onDelete(diagram.id);
                                setIsDeleteOpen(false);
                            }}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
