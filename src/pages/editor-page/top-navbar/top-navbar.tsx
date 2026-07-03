import React, { useCallback } from 'react';
import ChartDBLogo from '@/assets/logo-light.png';
import ChartDBDarkLogo from '@/assets/logo-dark.png';
import { useTheme } from '@/hooks/use-theme';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';

import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';
import { LogOut, User, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useNavigate } from 'react-router-dom';

export interface TopNavbarProps { }

export const TopNavbar: React.FC<TopNavbarProps> = () => {
    const { effectiveTheme } = useTheme();
    const { user, signOut, isAdmin } = useAuth();
    const navigate = useNavigate();

    const renderStars = useCallback(() => {
        return (
            <iframe
                src={`https://ghbtns.com/github-btn.html?user=chartdb&repo=chartdb&type=star&size=large&text=false`}
                width="40"
                height="30"
                title="GitHub"
            ></iframe>
        );
    }, []);

    return (
        <nav className="flex flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
            <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                    <a
                        href="#"
                        className="cursor-pointer"
                        rel="noreferrer"
                    >
                        <img
                            src={
                                effectiveTheme === 'light'
                                    ? ChartDBLogo
                                    : ChartDBDarkLogo
                            }
                            alt="chartDB"
                            className="h-4 max-w-fit"
                        />
                    </a>
                </div>
                <Menu />
            </div>
            <DiagramName />
            <div className="hidden flex-1 items-center justify-end gap-2 sm:flex">
                <LastSaved />
                {/* {renderStars()} */}
                <LanguageNav />
                {IS_SUPABASE_ENABLED && user && (
                    <div className="flex items-center gap-2 border-l border-slate-800 pl-2">
                        {isAdmin && isAdmin() && (
                            <Button
                                variant="outline"
                                className="h-7 gap-1.5 border border-primary/25 bg-primary/5 px-2.5 text-[11px] font-semibold text-primary transition-all duration-200 hover:bg-primary/10"
                                onClick={() => navigate('/admin')}
                                title="Panel de Administración"
                            >
                                <ShieldAlert className="size-3.5" />
                                Admin
                            </Button>
                        )}
                        <div
                            className="flex max-w-[150px] items-center gap-1.5 truncate rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-muted-foreground"
                            title={user.email}
                        >
                            <User className="size-3" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-white"
                            onClick={() => signOut()}
                            title="Cerrar Sesión"
                        >
                            <LogOut className="size-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        </nav>
    );
};
