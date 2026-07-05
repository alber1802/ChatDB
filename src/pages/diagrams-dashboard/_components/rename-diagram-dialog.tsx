import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import { useTranslation } from 'react-i18next';

interface RenameDiagramDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (newName: string) => void;
    initialName: string;
}

export const RenameDiagramDialog: React.FC<RenameDiagramDialogProps> = ({
    open,
    onClose,
    onConfirm,
    initialName,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(initialName);

    useEffect(() => {
        if (open) {
            setName(initialName);
        }
    }, [open, initialName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onConfirm(name.trim());
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (!val) onClose();
            }}
        >
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Renombrar Diagrama</DialogTitle>
                        <DialogDescription>
                            Escribe el nuevo nombre para tu diagrama de base de
                            datos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Nombre
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {t('open_diagram_dialog.cancel')}
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
