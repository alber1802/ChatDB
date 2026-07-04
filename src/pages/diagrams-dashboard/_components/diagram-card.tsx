import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/card/card';
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
import { MoreVertical, Calendar, Table2, Trash2, Edit, Copy, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Diagram } from '@/lib/domain/diagram';

interface DiagramCardProps {
    diagram: Diagram;
    onDelete: (id: string) => Promise<void>;
    onRename: (id: string, newName: string) => Promise<void>;
    onDuplicate: (diagram: Diagram) => Promise<void>;
}

export const DiagramCard: React.FC<DiagramCardProps> = ({
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

    const formattedDate = new Date(diagram.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    const tablesCount = diagram.tables?.length || 0;

    return (
        <>
            <Card className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/50 bg-card hover:bg-accent/10 transition-all duration-300 hover:shadow-lg hover:border-primary/20 cursor-pointer" onClick={handleOpen}>
                {/* Visual Glassmorphic Accent */}
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-lg border border-border/60 bg-muted/30 group-hover:bg-primary/5 group-hover:border-primary/15 transition-colors duration-300">
                            <DiagramIcon
                                databaseType={diagram.databaseType}
                                databaseEdition={diagram.databaseEdition}
                            />
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="font-semibold text-sm tracking-tight text-foreground group-hover:text-primary transition-colors duration-200 truncate max-w-[150px] sm:max-w-[200px]" title={diagram.name}>
                                {diagram.name}
                            </h3>
                            <span className="inline-block rounded bg-muted/65 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground uppercase">
                                {diagram.databaseType}
                            </span>
                        </div>
                    </div>

                    {/* Actions Menu Dropdown */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 cursor-pointer rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={handleOpen} className="gap-2 cursor-pointer">
                                    <ExternalLink className="size-3.5 text-muted-foreground" />
                                    Abrir Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsRenameOpen(true)} className="gap-2 cursor-pointer">
                                    <Edit className="size-3.5 text-muted-foreground" />
                                    Renombrar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDuplicate(diagram)} className="gap-2 cursor-pointer">
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    Duplicar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setIsDeleteOpen(true)}
                                    className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                >
                                    <Trash2 className="size-3.5" />
                                    Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent className="p-5 pt-2 pb-4">
                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                        {diagram.description || 'Sin descripción. Modifica este diagrama para añadir tablas y configurar tu base de datos.'}
                    </p>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t border-border/30 bg-muted/10 p-5 py-3.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <Table2 className="size-3.5 text-muted-foreground/70" />
                        <span>
                            {tablesCount === 1 ? '1 tabla' : `${tablesCount} tablas`}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground/70" />
                        <span>Modificado {formattedDate}</span>
                    </div>
                </CardFooter>
            </Card>

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
                        <AlertDialogTitle>¿Estás seguro de eliminar este diagrama?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará de forma permanente el diagrama "{diagram.name}" y todos sus objetos relacionados (tablas, relaciones y notas). No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>
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
