import { useState, useEffect, useCallback } from 'react';
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
                await deleteDiagram(id);
                await fetchDiagrams();
            } catch (err) {
                console.error('Error deleting diagram:', err);
            }
        },
        [deleteDiagram, fetchDiagrams]
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
