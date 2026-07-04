import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { Sun, Moon, Menu as MenuIcon, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/button/button';
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
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/breadcrumb/breadcrumb';

interface AdminHeaderProps {
    onOpenMobile: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onOpenMobile }) => {
    const { profile, signOut } = useAuth();
    const { effectiveTheme, setTheme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();

    const toggleTheme = () => {
        setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/auth');
    };

    // Breadcrumbs matching
    const getBreadcrumbs = () => {
        const path = location.pathname;
        const items = [
            { label: 'Admin', href: '/admin', isCurrent: path === '/admin' },
        ];

        if (path === '/admin/users') {
            items.push({
                label: 'Usuarios',
                href: '/admin/users',
                isCurrent: true,
            });
        } else if (path === '/admin/audit') {
            items.push({
                label: 'Logs de Auditoría',
                href: '/admin/audit',
                isCurrent: true,
            });
        } else if (path === '/admin') {
            items[0].isCurrent = true;
        }

        return items;
    };

    const breadcrumbs = getBreadcrumbs();

    return (
        <header className="flex h-16 select-none items-center justify-between border-b border-border/40 bg-card px-4 font-primary md:px-6">
            <div className="flex items-center gap-x-4">
                {/* Mobile Toggle Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer hover:bg-muted md:hidden"
                    onClick={onOpenMobile}
                >
                    <MenuIcon className="size-5 text-foreground" />
                </Button>

                {/* Breadcrumbs */}
                <Breadcrumb className="hidden md:block">
                    <BreadcrumbList>
                        {breadcrumbs.map((item, index) => (
                            <React.Fragment key={item.href}>
                                {index > 0 && <BreadcrumbSeparator />}
                                <BreadcrumbItem>
                                    {item.isCurrent ? (
                                        <BreadcrumbPage className="font-semibold text-foreground">
                                            {item.label}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink
                                            onClick={() => navigate(item.href)}
                                            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {item.label}
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </React.Fragment>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>

                {/* Mobile Title */}
                <h1 className="text-base font-semibold tracking-tight text-foreground md:hidden">
                    {breadcrumbs[breadcrumbs.length - 1]?.label || 'Admin'}
                </h1>
            </div>

            {/* Right Side Tools */}
            <div className="flex items-center gap-x-3">
                {/* Theme Toggle Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    title="Cambiar Tema"
                    className="cursor-pointer rounded-full transition-colors hover:bg-muted"
                >
                    {effectiveTheme === 'dark' ? (
                        <Sun className="size-[18px] text-amber-500 duration-300 animate-in fade-in zoom-in" />
                    ) : (
                        <Moon className="size-[18px] text-slate-700 duration-300 animate-in fade-in zoom-in" />
                    )}
                </Button>

                {/* User Dropdown Profile Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative size-9 cursor-pointer rounded-full border border-border/40 p-0 hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <Avatar className="size-full">
                                <AvatarImage src={profile?.avatar_url || ''} />
                                <AvatarFallback className="bg-primary/5 text-xs font-semibold text-primary">
                                    {profile?.display_name
                                        ?.substring(0, 2)
                                        .toUpperCase() || 'AD'}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent className="mt-1.5 w-56" align="end">
                        <DropdownMenuLabel className="py-2.5 font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="truncate text-sm font-semibold leading-none text-foreground">
                                    {profile?.display_name || 'Admin User'}
                                </p>
                                <p className="truncate text-xs leading-none text-muted-foreground">
                                    {profile?.email || 'admin@chartdb.io'}
                                </p>
                            </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => navigate('/')}
                            className="cursor-pointer py-2 focus:bg-accent focus:text-accent-foreground"
                        >
                            <ArrowLeft className="mr-2 size-4 text-muted-foreground" />
                            <span>Volver al Editor</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={handleSignOut}
                            className="cursor-pointer py-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                            <LogOut className="mr-2 size-4" />
                            <span>Cerrar Sesión</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};
