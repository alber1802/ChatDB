import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/button/button';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';
import { RoleBadge } from './role-badge';
import { Separator } from '@/components/separator/separator';

interface AdminSidebarProps {
    onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    onCloseMobile,
}) => {
    const { profile, signOut, role } = useAuth();
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

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
            name: 'Lista de Espera',
            path: '/admin/waitlist',
            icon: ClipboardList,
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

    return (
        <div className="flex h-full select-none flex-col justify-between p-4 font-primary">
            <div className="flex flex-col gap-y-6">
                {/* Logo Section */}
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-x-3">
                        <img
                            src={
                                effectiveTheme === 'light'
                                    ? ChartDBLogo
                                    : ChartDBDarkLogo
                            }
                            alt="ChartDB Admin"
                            className="h-5 max-w-fit cursor-pointer transition-opacity hover:opacity-85"
                            onClick={() => navigate('/')}
                        />
                        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            ADMIN
                        </span>
                    </div>
                </div>

                {/* User Profile Card */}
                <div className="flex items-center gap-x-3 rounded-xl border border-border/30 bg-card/65 p-3.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-card/85">
                    <Avatar className="size-10 border border-border/40 shadow-inner">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/5 text-sm font-semibold text-primary">
                            {profile?.display_name
                                ?.substring(0, 2)
                                .toUpperCase() || 'AD'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-semibold text-foreground">
                            {profile?.display_name || 'Admin User'}
                        </span>
                        <div className="mt-1">
                            <RoleBadge roleId={role} />
                        </div>
                    </div>
                </div>

                <Separator className="bg-border/30" />

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
                                    if (onCloseMobile) onCloseMobile();
                                }}
                                className={`flex cursor-pointer items-center gap-x-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'scale-[1.01] border-primary/25 bg-primary/15 text-primary shadow-inner shadow-primary/5 backdrop-blur-sm'
                                        : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground active:scale-[0.99]'
                                }`}
                            >
                                <Icon className="size-4 shrink-0" />
                                <span>{item.name}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col gap-y-2 border-t border-border/30 pt-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="flex w-full cursor-pointer justify-start gap-x-3 rounded-lg py-2.5 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                    <ArrowLeft className="size-4 shrink-0" />
                    <span>Volver al Dashboard</span>
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="flex w-full cursor-pointer justify-start gap-x-3 rounded-lg py-2.5 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <LogOut className="size-4 shrink-0" />
                    <span>Cerrar Sesión</span>
                </Button>
            </div>
        </div>
    );
};
