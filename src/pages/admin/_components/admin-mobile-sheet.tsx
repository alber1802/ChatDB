import React from 'react';
import { Sheet, SheetContent } from '@/components/sheet/sheet';
import { AdminSidebar } from './admin-sidebar';

interface AdminMobileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AdminMobileSheet: React.FC<AdminMobileSheetProps> = ({
    open,
    onOpenChange,
}) => {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className="w-64 border-r border-border/30 bg-card/85 p-0 backdrop-blur-lg"
            >
                <AdminSidebar onCloseMobile={() => onOpenChange(false)} />
            </SheetContent>
        </Sheet>
    );
};
