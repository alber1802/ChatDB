import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import { DIAGRAMS_CHANGED_EVENT } from '@/lib/collaboration/collaboration-api';
import { canManageDiagram } from '@/lib/domain/diagram-access';
import { useStorage } from '@/hooks/use-storage';
import { cloneDiagram } from '@/lib/clone';
import type { Diagram } from '@/lib/domain/diagram';

export const useDashboard = () => {
    const { listDiagrams, deleteDiagram, updateDiagram, addDiagram } =
        useStorage();
    const [diagrams, setDiagrams] = useState<Diagram[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchDiagrams = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listDiagrams({ includeTables: true });
            // Sort by updatedAt descending
            const sorted = [...data].sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() -
                    new Date(a.updatedAt).getTime()
            );
            setDiagrams(sorted);
        } catch (err) {
            console.error('Error fetching diagrams:', err);
            setError(
                err instanceof Error
                    ? err
                    : new Error('Error al listar diagramas')
            );
        } finally {
            setLoading(false);
        }
    }, [listDiagrams]);

    const handleDelete = useCallback(
        async (id: string) => {
            try {
                // Borrar solo lo puede el propietario; para un diagrama
                // compartido la misma acción significa abandonarlo.
                const diagram = diagrams.find((d) => d.id === id);
                if (!diagram || canManageDiagram(diagram)) {
                    await deleteDiagram(id);
                } else {
                    await apiFetch(`/diagrams/${id}/shares/me`, {
                        method: 'DELETE',
                    });
                }
                await fetchDiagrams();
            } catch (err) {
                console.error('Error deleting diagram:', err);
            }
        },
        [deleteDiagram, fetchDiagrams, diagrams]
    );

    const handleRename = useCallback(
        async (id: string, newName: string) => {
            try {
                await updateDiagram({
                    id,
                    attributes: { name: newName },
                });
                await fetchDiagrams();
            } catch (err) {
                console.error('Error renaming diagram:', err);
            }
        },
        [updateDiagram, fetchDiagrams]
    );

    const handleDuplicate = useCallback(
        async (diagram: Diagram) => {
            try {
                const cloned = cloneDiagram(diagram);
                const diagramToAdd = cloned.diagram;
                if (!diagramToAdd) return;

                diagramToAdd.name = `${diagram.name} (Copia)`;
                await addDiagram({ diagram: diagramToAdd });
                await fetchDiagrams();
            } catch (err) {
                console.error('Error duplicating diagram:', err);
            }
        },
        [addDiagram, fetchDiagrams]
    );

    useEffect(() => {
        fetchDiagrams();
    }, [fetchDiagrams]);

    // Invitación aceptada desde la campana u otro componente.
    useEffect(() => {
        const onChanged = () => void fetchDiagrams();
        window.addEventListener(DIAGRAMS_CHANGED_EVENT, onChanged);
        return () =>
            window.removeEventListener(DIAGRAMS_CHANGED_EVENT, onChanged);
    }, [fetchDiagrams]);

    return {
        diagrams,
        loading,
        error,
        refetch: fetchDiagrams,
        handleDelete,
        handleRename,
        handleDuplicate,
    };
};
