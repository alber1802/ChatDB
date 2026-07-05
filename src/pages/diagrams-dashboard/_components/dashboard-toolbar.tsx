import React from 'react';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';
import { LayoutGrid, List, Plus, Search, Database, X } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { DatabaseType } from '@/lib/domain/database-type';

interface DashboardToolbarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedDBType: string;
    onDBTypeChange: (type: string) => void;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
    onCreateNew: () => void;
}

const DB_LABELS: Record<string, string> = {
    all: 'Todas las Bases de Datos',
    [DatabaseType.GENERIC]: 'Generic / SQL',
    [DatabaseType.POSTGRESQL]: 'PostgreSQL',
    [DatabaseType.MYSQL]: 'MySQL',
    [DatabaseType.SQL_SERVER]: 'SQL Server',
    [DatabaseType.MARIADB]: 'MariaDB',
    [DatabaseType.SQLITE]: 'SQLite',
    [DatabaseType.CLICKHOUSE]: 'ClickHouse',
    [DatabaseType.COCKROACHDB]: 'CockroachDB',
    [DatabaseType.ORACLE]: 'Oracle',
};

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
    searchQuery,
    onSearchChange,
    selectedDBType,
    onDBTypeChange,
    viewMode,
    onViewModeChange,
    onCreateNew,
}) => {
    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card/45 p-4 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between">
            {/* Left side: Search & Filter */}
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search Input */}
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar diagramas por nombre..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-10 w-full px-9"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>

                {/* Database Type Filter */}
                <div className="w-full sm:w-56">
                    <Select
                        value={selectedDBType}
                        onValueChange={onDBTypeChange}
                    >
                        <SelectTrigger className="h-10 w-full">
                            <span className="flex items-center gap-2">
                                <Database className="size-4 text-muted-foreground" />
                                <SelectValue placeholder="Filtrar por Base de Datos" />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Todas las Bases de Datos
                            </SelectItem>
                            {Object.values(DatabaseType).map((type) => (
                                <SelectItem key={type} value={type}>
                                    {DB_LABELS[type] || type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Right side: View Mode Toggle & Create Button */}
            <div className="flex items-center justify-end gap-3">
                {/* View toggler */}
                <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-1">
                    <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => onViewModeChange('grid')}
                        className={`size-8 rounded-md p-0 transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'}`}
                        title="Vista Cuadrícula"
                    >
                        <LayoutGrid className="size-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="icon"
                        onClick={() => onViewModeChange('list')}
                        className={`size-8 rounded-md p-0 transition-all ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-muted/50'}`}
                        title="Vista Lista"
                    >
                        <List className="size-4" />
                    </Button>
                </div>

                {/* Create Diagram CTA */}
                <Button
                    onClick={onCreateNew}
                    className="h-10 gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-transform active:scale-95"
                >
                    <Plus className="size-4" />
                    Nuevo Diagrama
                </Button>
            </div>
        </div>
    );
};
