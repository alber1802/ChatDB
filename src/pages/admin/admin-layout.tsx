import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './_components/admin-sidebar';
import { AdminHeader } from './_components/admin-header';
import { AdminMobileSheet } from './_components/admin-mobile-sheet';
import { AlertProvider } from '@/context/alert-context/alert-provider';

export const AdminLayout: React.FC = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <AlertProvider>
            <div className="dashboard-animated-bg flex min-h-screen w-screen overflow-hidden text-foreground">
                {/* Desktop Sidebar */}
                <aside className="hidden w-64 shrink-0 border-r border-border/30 bg-card/45 backdrop-blur-md md:block">
                    <AdminSidebar />
                </aside>

                {/* Main Area */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Header Navbar */}
                    <AdminHeader
                        onOpenMobile={() => setIsMobileMenuOpen(true)}
                    />

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto bg-transparent p-4 md:p-6">
                        <Outlet />
                    </main>
                </div>

                {/* Mobile Navigation Sheet */}
                <AdminMobileSheet
                    open={isMobileMenuOpen}
                    onOpenChange={setIsMobileMenuOpen}
                />
            </div>
        </AlertProvider>
    );
};

export default AdminLayout;
