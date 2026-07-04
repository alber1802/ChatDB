import React from 'react';
import ChartDBLogo from '@/assets/logo-2.png';
import { DiagramName } from './diagram-name';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Button } from '@/components/button/button';
import { useSidebar } from '@/components/sidebar/use-sidebar';
import { MenuIcon, LogOut } from 'lucide-react';

import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';

export interface TopNavbarMobileProps {}

export const TopNavbarMobile: React.FC<TopNavbarMobileProps> = () => {
    const { user, signOut } = useAuth();

    const { toggleSidebar } = useSidebar();

    return (
        <nav className="flex flex-col justify-between border-b px-3 md:h-12 md:flex-row md:items-center md:px-4">
            <div className="flex flex-1 flex-col justify-between gap-x-1 md:flex-row md:justify-normal">
                <div className="flex items-center justify-between pt-[8px] font-primary md:py-[10px]">
                    <div className="flex items-center gap-2">
                        <Button
                            size={'icon'}
                            variant="ghost"
                            onClick={toggleSidebar}
                        >
                            <MenuIcon className="size-5" />
                        </Button>
                        <a href="#" className="cursor-pointer" rel="noreferrer">
                            <img
                                src={ChartDBLogo}
                                alt="chartDB"
                                className="h-4 max-w-fit"
                            />
                        </a>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageNav />
                        {IS_SUPABASE_ENABLED && user && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground"
                                onClick={() => signOut()}
                                title="Cerrar Sesión"
                            >
                                <LogOut className="size-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
                <Menu />
            </div>

            <div className="flex flex-1 justify-center pb-2 pt-1">
                <DiagramName />
            </div>
        </nav>
    );
};
