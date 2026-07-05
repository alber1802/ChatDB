import React from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { LanguageNav } from '@/pages/editor-page/top-navbar/language-nav/language-nav';
import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';
import { LogOut, ShieldCheck, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useNavigate } from 'react-router-dom';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from '@/components/avatar/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/dropdown-menu/dropdown-menu';
import { Badge } from '@/components/badge/badge';

export const DashboardHeader: React.FC = () => {
    const { effectiveTheme, setTheme } = useTheme();
    const { user, signOut, isAdmin, role, profile } = useAuth();
    const navigate = useNavigate();

    const toggleTheme = () => {
        setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    const getRoleBadgeInfo = (roleId: string | null | undefined) => {
        switch (roleId) {
            case 'super_admin':
                return {
                    label: 'Super Admin',
                    className:
                        'bg-red-500/10 text-red-500 border border-red-500/20',
                };
            case 'admin':
                return {
                    label: 'Admin',
                    className:
                        'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                };
            default:
                return {
                    label: 'User',
                    className:
                        'bg-green-500/10 text-green-500 border border-green-500/20',
                };
        }
    };

    const roleInfo = getRoleBadgeInfo(role);

    return (
        <header className="sticky top-0 z-50 flex h-16 select-none items-center justify-between border-b border-border/30 bg-card/65 px-4 font-primary backdrop-blur-md md:px-6">
            <div className="flex items-center gap-x-4">
                <img
                    src={
                        effectiveTheme === 'light'
                            ? ChartDBLogo
                            : ChartDBDarkLogo
                    }
                    alt="chartDB"
                    className="h-5 max-w-fit cursor-pointer"
                    onClick={() => navigate('/')}
                />
                <Badge
                    variant="secondary"
                    className="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    Dashboard
                </Badge>
            </div>

            <div className="flex items-center gap-x-3">
                {/* Admin Quick Action */}
                {isAdmin && isAdmin() && (
                    <Button
                        variant="outline"
                        className="h-8 gap-1.5 border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/10"
                        onClick={() => navigate('/admin')}
                    >
                        <ShieldCheck className="size-4" />
                        Admin Panel
                    </Button>
                )}

                {/* Theme Selector */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    title="Cambiar Tema"
                    className="size-9 cursor-pointer rounded-full transition-colors hover:bg-muted"
                >
                    {effectiveTheme === 'dark' ? (
                        <Sun className="size-[18px] text-amber-500 duration-300 animate-in fade-in zoom-in" />
                    ) : (
                        <Moon className="size-[18px] text-slate-700 duration-300 animate-in fade-in zoom-in" />
                    )}
                </Button>

                {/* Language Select */}
                <LanguageNav />

                {/* Profile menu */}
                {IS_SUPABASE_ENABLED && user && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="relative size-9 cursor-pointer rounded-full border border-border/40 p-0 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <Avatar className="size-full">
                                    <AvatarImage
                                        src={profile?.avatar_url || ''}
                                    />
                                    <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
                                        {profile?.display_name
                                            ?.substring(0, 2)
                                            .toUpperCase() ||
                                            user.email
                                                ?.substring(0, 2)
                                                .toUpperCase() ||
                                            'US'}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="truncate text-sm font-semibold leading-none text-foreground">
                                        {profile?.display_name || user.email}
                                    </p>
                                    <p className="truncate text-xs leading-none text-muted-foreground">
                                        {user.email}
                                    </p>
                                    <div className="pt-1">
                                        <span
                                            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${roleInfo.className}`}
                                        >
                                            {roleInfo.label}
                                        </span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {isAdmin && isAdmin() && (
                                <DropdownMenuItem
                                    onClick={() => navigate('/admin')}
                                    className="cursor-pointer gap-2"
                                >
                                    <ShieldCheck className="size-4 text-muted-foreground" />
                                    Panel de Administración
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={handleSignOut}
                                className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                            >
                                <LogOut className="size-4" />
                                Cerrar Sesión
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    );
};
