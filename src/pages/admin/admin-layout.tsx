import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminHeader } from './_components/admin-header';
import { AdminMobileSheet } from './_components/admin-mobile-sheet';

export const AdminLayout: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex min-h-screen w-screen overflow-hidden bg-background text-foreground">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 shrink-0 md:block">
                <AdminSidebar />
            </aside>

            {/* Main Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header Navbar */}
                <AdminHeader onOpenMobile={() => setIsMobileMenuOpen(true)} />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-slate-50/40 p-4 dark:bg-background/20 md:p-6">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Navigation Sheet */}
            <AdminMobileSheet
                open={isMobileMenuOpen}
                onOpenChange={setIsMobileMenuOpen}
            />
        </div>
    );
};

export default AdminLayout;
