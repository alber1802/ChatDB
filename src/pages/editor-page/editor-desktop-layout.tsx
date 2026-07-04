import React from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/resizable/resizable';
import { SidePanel } from './side-panel/side-panel';
import { Canvas } from './canvas/canvas';
import { useLayout } from '@/hooks/use-layout';
import type { Diagram } from '@/lib/domain/diagram';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/sidebar/sidebar';
import { EditorSidebar } from './editor-sidebar/editor-sidebar';
import { TopNavbar } from './top-navbar/top-navbar';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface EditorDesktopLayoutProps {
    initialDiagram?: Diagram;
}
export const EditorDesktopLayout: React.FC<EditorDesktopLayoutProps> = ({
    initialDiagram,
}) => {
    const { isSidePanelShowed, toggleSidePanel } = useLayout();

    return (
        <>
            <TopNavbar />
            <SidebarProvider
                defaultOpen={false}
                open={false}
                className="h-full min-h-0"
            >
                <EditorSidebar />
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel
                        defaultSize={isSidePanelShowed ? 25 : 0}
                        minSize={isSidePanelShowed ? 25 : 0}
                        maxSize={isSidePanelShowed ? 99 : 0}
                        className={cn('transition-[flex-grow] duration-200', {
                            'min-w-[350px]': isSidePanelShowed,
                        })}
                    >
                        <SidePanel />
                    </ResizablePanel>
                    <ResizableHandle
                        disabled={!isSidePanelShowed}
                        className={!isSidePanelShowed ? 'hidden' : ''}
                    />
                    <ResizablePanel defaultSize={75}>
                        <div className="relative size-full">
                            <button
                                onClick={toggleSidePanel}
                                className={cn(
                                    'absolute left-3 top-1/2 z-50 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md hover:bg-accent hover:text-accent-foreground transition-all duration-200 focus:outline-none cursor-pointer hover:scale-110',
                                    {
                                        'opacity-80 hover:opacity-100':
                                            isSidePanelShowed,
                                        'opacity-100': !isSidePanelShowed,
                                    }
                                )}
                                title={
                                    isSidePanelShowed
                                        ? 'Ocultar panel lateral'
                                        : 'Mostrar panel lateral'
                                }
                            >
                                {isSidePanelShowed ? (
                                    <ChevronLeft className="size-3.5" />
                                ) : (
                                    <ChevronRight className="size-3.5" />
                                )}
                            </button>
                            <Canvas
                                initialTables={initialDiagram?.tables ?? []}
                            />
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </SidebarProvider>
        </>
    );
};

export default EditorDesktopLayout;
