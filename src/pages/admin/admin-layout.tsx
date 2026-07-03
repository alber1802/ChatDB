import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import {
    LayoutDashboard,
    Users,
    FileText,
    ArrowLeft,
    LogOut,
    Sun,
    Moon,
    Menu as MenuIcon,
    X,
} from 'lucide-react';
import { Button } from '@/components/button/button';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';

export const AdminLayout: React.FC = () => {
    const { profile, signOut, role } = useAuth();
    const { effectiveTheme, setTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleTheme = () => {
        setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    };

    const navigationItems = [
        {
            name: 'Dashboard',
            path: '/admin',
            icon: LayoutDashboard,
        },
        {
            name: 'Usuarios',
            path: '/admin/users',
            icon: Users,
        },
        {
            name: 'Logs de Auditoría',
            path: '/admin/audit',
            icon: FileText,
        },
    ];

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const getRoleBadgeColor = (roleName: string | null) => {
        switch (roleName) {
            case 'super_admin':
                return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case 'admin':
                return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            default:
                return 'bg-green-500/10 text-green-500 border border-green-500/20';
        }
    };

    const sidebarContent = (
        <div className="flex h-full flex-col justify-between p-4 font-primary">
            <div className="flex flex-col gap-y-6">
                {/* Logo Section */}
                <div className="flex items-center gap-x-3 p-2">
                    <img
                        src={
                            effectiveTheme === 'light'
                                ? ChartDBLogo
                                : ChartDBDarkLogo
                        }
                        alt="ChartDB Admin"
                        className="h-5 max-w-fit cursor-pointer"
                        onClick={() => navigate('/')}
                    />
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        ADMIN
                    </span>
                </div>

                {/* User Profile Card */}
                <div className="flex items-center gap-x-3 rounded-lg border border-border/40 bg-card p-3 shadow-sm">
                    <Avatar className="size-10 border border-border">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/5 text-sm font-semibold text-primary">
                            {profile?.display_name
                                ?.substring(0, 2)
                                .toUpperCase() || 'AD'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold">
                            {profile?.display_name || 'Admin User'}
                        </span>
                        <span
                            className={`mt-0.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${getRoleBadgeColor(role)}`}
                        >
                            {role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex flex-col gap-y-1.5">
                    {navigationItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.path}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={`flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <Icon className="size-4" />
                                {item.name}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-y-2 border-t border-border/60 pt-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="flex justify-start gap-x-3 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Volver al Editor
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="flex justify-start gap-x-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <LogOut className="size-4" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen w-screen overflow-hidden bg-background text-foreground">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 border-r border-border bg-card md:block">
                {sidebarContent}
            </aside>

            {/* Main Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header Navbar */}
                <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
                    <div className="flex items-center gap-x-3">
                        {/* Mobile Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() =>
                                setIsMobileMenuOpen(!isMobileMenuOpen)
                            }
                        >
                            {isMobileMenuOpen ? (
                                <X className="size-5" />
                            ) : (
                                <MenuIcon className="size-5" />
                            )}
                        </Button>
                        <h1 className="hidden font-primary text-lg font-semibold tracking-tight md:block">
                            Panel Administrativo
                        </h1>
                    </div>

                    {/* Right Tools */}
                    <div className="flex items-center gap-x-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleTheme}
                            title="Cambiar Tema"
                            className="rounded-full hover:bg-muted"
                        >
                            {effectiveTheme === 'dark' ? (
                                <Sun className="size-4 text-amber-500" />
                            ) : (
                                <Moon className="size-4 text-slate-700" />
                            )}
                        </Button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Navigation Drawer */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <aside className="relative flex w-64 flex-col border-r border-border bg-card">
                        {sidebarContent}
                    </aside>
                </div>
            )}
        </div>
    );
};

export default AdminLayout;
