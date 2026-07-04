import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useDashboard } from './_hooks/use-dashboard';
import { DashboardHeader } from './_components/dashboard-header';
import { DashboardToolbar } from './_components/dashboard-toolbar';
import { DiagramCard } from './_components/diagram-card';
import { DiagramListItem } from './_components/diagram-list-item';
import { EmptyDashboard } from './_components/empty-dashboard';
import { useDialog } from '@/hooks/use-dialog';
import { Skeleton } from '@/components/skeleton/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/card/card';
import { FullScreenLoaderProvider } from '@/context/full-screen-spinner-context/full-screen-spinner-provider';
import { LayoutProvider } from '@/context/layout-context/layout-provider';
import { StorageProviderSelector } from '@/context/storage-context/storage-provider-selector';
import { ConfigProvider } from '@/context/config-context/config-provider';
import { DialogProvider } from '@/context/dialog-context/dialog-provider';
import { ChartDBProvider } from '@/context/chartdb-context/chartdb-provider';
import { RedoUndoStackProvider } from '@/context/history-context/redo-undo-stack-provider';
import { DiffProvider } from '@/context/diff-context/diff-provider';
import { DiagramFilterProvider } from '@/context/diagram-filter-context/diagram-filter-provider';
import { HistoryProvider } from '@/context/history-context/history-provider';
import { ReactFlowProvider } from '@xyflow/react';
import { CanvasProvider } from '@/context/canvas-context/canvas-provider';
import { ExportImageProvider } from '@/context/export-image-context/export-image-provider';
import { AlertProvider } from '@/context/alert-context/alert-provider';

const DiagramsDashboardPageComponent: React.FC = () => {
    const {
        diagrams,
        loading,
        handleDelete,
        handleRename,
        handleDuplicate,
    } = useDashboard();
    const { openCreateDiagramDialog } = useDialog();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDBType, setSelectedDBType] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const handleCreateNew = () => {
        openCreateDiagramDialog();
    };

    const filteredDiagrams = diagrams.filter((diagram) => {
        const matchesSearch = diagram.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDB = selectedDBType === 'all' || diagram.databaseType === selectedDBType;
        return matchesSearch && matchesDB;
    });

    const renderSkeletons = () => (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4"}>
            {Array.from({ length: 6 }).map((_, idx) => (
                viewMode === 'grid' ? (
                    <Card key={idx} className="flex flex-col h-44 justify-between border border-border/50">
                        <CardHeader className="flex flex-row items-center gap-3 p-5 pb-3">
                            <Skeleton className="size-11 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-2/3" />
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-5 py-2">
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-3 w-3/4" />
                        </CardContent>
                        <CardFooter className="flex justify-between p-5 py-3.5 border-t border-border/30">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-3 w-24" />
                        </CardFooter>
                    </Card>
                ) : (
                    <div key={idx} className="flex items-center justify-between border border-border/40 p-4 rounded-xl">
                        <div className="flex items-center gap-3.5 flex-1">
                            <Skeleton className="size-10 rounded-lg" />
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="size-8 rounded-full" />
                        </div>
                    </div>
                )
            ))}
        </div>
    );

    return (
        <>
            <Helmet>
                <title>ChartDB - Mis Diagramas de Bases de Datos</title>
                <meta name="description" content="Gestiona tus diagramas de base de datos relacionales con ChartDB. Crea, duplica, renombra o visualiza tus esquemas." />
            </Helmet>

            <div className="flex min-h-screen w-screen flex-col bg-background font-primary select-none overflow-x-hidden">
                <DashboardHeader />

                <main className="flex-1 px-4 py-6 md:px-8 max-w-7xl mx-auto w-full">
                    {/* Welcome Banner */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            Mis Diagramas
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Crea y administra tus esquemas de bases de datos de forma interactiva y visual.
                        </p>
                    </div>

                    <DashboardToolbar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedDBType={selectedDBType}
                        onDBTypeChange={setSelectedDBType}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onCreateNew={handleCreateNew}
                    />

                    {/* Content Section */}
                    <div className="mt-6">
                        {loading ? (
                            renderSkeletons()
                        ) : filteredDiagrams.length === 0 ? (
                            searchQuery || selectedDBType !== 'all' ? (
                                <div className="text-center py-12 border border-dashed border-border/60 rounded-xl">
                                    <p className="text-sm text-muted-foreground">
                                        No se encontraron diagramas con los filtros actuales.
                                    </p>
                                </div>
                            ) : (
                                <EmptyDashboard onCreateNew={handleCreateNew} />
                            )
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredDiagrams.map((diagram) => (
                                    <DiagramCard
                                        key={diagram.id}
                                        diagram={diagram}
                                        onDelete={handleDelete}
                                        onRename={handleRename}
                                        onDuplicate={handleDuplicate}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {filteredDiagrams.map((diagram) => (
                                    <DiagramListItem
                                        key={diagram.id}
                                        diagram={diagram}
                                        onDelete={handleDelete}
                                        onRename={handleRename}
                                        onDuplicate={handleDuplicate}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
};

export const DiagramsDashboardPage: React.FC = () => (
    <FullScreenLoaderProvider>
        <LayoutProvider>
            <StorageProviderSelector>
                <ConfigProvider>
                    <RedoUndoStackProvider>
                        <DiffProvider>
                            <ChartDBProvider>
                                <DiagramFilterProvider>
                                    <HistoryProvider>
                                        <ReactFlowProvider>
                                            <CanvasProvider>
                                                <ExportImageProvider>
                                                    <AlertProvider>
                                                        <DialogProvider>
                                                            <DiagramsDashboardPageComponent />
                                                        </DialogProvider>
                                                    </AlertProvider>
                                                </ExportImageProvider>
                                            </CanvasProvider>
                                        </ReactFlowProvider>
                                    </HistoryProvider>
                                </DiagramFilterProvider>
                            </ChartDBProvider>
                        </DiffProvider>
                    </RedoUndoStackProvider>
                </ConfigProvider>
            </StorageProviderSelector>
        </LayoutProvider>
    </FullScreenLoaderProvider>
);
