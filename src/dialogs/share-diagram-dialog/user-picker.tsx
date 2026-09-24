import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/button/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/command/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/popover/popover';
import { Spinner } from '@/components/spinner/spinner';
import { cn } from '@/lib/utils';
import {
    collaborationApi,
    type ShareCandidate,
} from '@/lib/collaboration/collaboration-api';
import { PersonAvatar } from './person-avatar';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Select con búsqueda sobre los usuarios del sistema. Al abrirse lista los
 * primeros usuarios sin necesidad de escribir; al escribir filtra en el
 * servidor (nombre o email). Excluye al propio usuario y a quien ya es miembro.
 */
export const UserPicker: React.FC<{
    diagramId: string;
    value?: ShareCandidate;
    onChange: (user: ShareCandidate | undefined) => void;
    disabled?: boolean;
}> = ({ diagramId, value, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<ShareCandidate[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController>();

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(
            async () => {
                abortRef.current?.abort();
                const controller = new AbortController();
                abortRef.current = controller;
                setLoading(true);
                try {
                    setUsers(
                        await collaborationApi.searchCandidates(
                            diagramId,
                            query.trim(),
                            controller.signal
                        )
                    );
                } catch {
                    // abortada o error de red: se mantiene la lista anterior
                } finally {
                    if (!controller.signal.aborted) setLoading(false);
                }
            },
            query ? SEARCH_DEBOUNCE_MS : 0
        );
        return () => clearTimeout(timer);
    }, [open, query, diagramId]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Seleccionar usuario"
                    disabled={disabled}
                    className="h-9 w-full justify-between px-3 font-normal"
                >
                    {value ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <PersonAvatar
                                name={value.displayName}
                                email={value.email}
                                avatarUrl={value.avatarUrl}
                                size="sm"
                            />
                            <span className="truncate">
                                {value.displayName ?? value.email}
                            </span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            Seleccionar usuario…
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] min-w-72 p-0"
                align="start"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar por nombre o correo…"
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && users.length === 0 ? (
                            <div className="flex justify-center py-6">
                                <Spinner size="small" />
                            </div>
                        ) : (
                            <CommandEmpty>
                                No hay usuarios que coincidan.
                            </CommandEmpty>
                        )}
                        <CommandGroup>
                            {users.map((u) => (
                                <CommandItem
                                    key={u.userId}
                                    value={u.userId}
                                    onSelect={() => {
                                        onChange(
                                            value?.userId === u.userId
                                                ? undefined
                                                : u
                                        );
                                        setOpen(false);
                                    }}
                                    className="gap-2"
                                >
                                    <PersonAvatar
                                        name={u.displayName}
                                        email={u.email}
                                        avatarUrl={u.avatarUrl}
                                        size="sm"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm">
                                            {u.displayName ?? u.email}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {u.email}
                                        </span>
                                    </span>
                                    <Check
                                        className={cn(
                                            'size-4',
                                            value?.userId === u.userId
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
