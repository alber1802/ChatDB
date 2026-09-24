import React from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useChartDB } from '@/hooks/use-chartdb';
import { useDialog } from '@/hooks/use-dialog';
import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';

export const ShareButton: React.FC<{ compact?: boolean }> = ({ compact }) => {
    const { currentDiagram } = useChartDB();
    const { openShareDiagramDialog } = useDialog();
    const { user } = useAuth();

    if (!IS_SUPABASE_ENABLED || !user || !currentDiagram.id) return null;

    return (
        <Button
            variant="outline"
            className={
                compact
                    ? 'size-8 p-0'
                    : 'h-7 gap-1.5 rounded-md px-2 text-caption font-medium shadow-none'
            }
            onClick={() =>
                openShareDiagramDialog({
                    diagramId: currentDiagram.id,
                    diagramName: currentDiagram.name,
                })
            }
            title="Compartir diagrama"
            aria-label="Compartir diagrama"
        >
            <Share2 className="size-3.5 shrink-0" />
            {!compact && 'Compartir'}
        </Button>
    );
};
