import type {} from '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LastSaved } from './last-saved';
import { chartDBContext } from '@/context/chartdb-context/chartdb-context';
import type { ChartDBContext } from '@/context/chartdb-context/chartdb-context';
import { syncStatusContext } from '@/context/sync-status-context/sync-status-context';
import type { SyncStatus } from '@/context/storage-context/sync-engine';
import { TooltipProvider } from '@/components/tooltip/tooltip';

function renderWithStatus(status: SyncStatus) {
    return render(
        <TooltipProvider>
            <chartDBContext.Provider
                value={
                    {
                        currentDiagram: { updatedAt: new Date() },
                    } as unknown as ChartDBContext
                }
            >
                <syncStatusContext.Provider value={{ status, retry: () => {} }}>
                    <LastSaved />
                </syncStatusContext.Provider>
            </chartDBContext.Provider>
        </TooltipProvider>
    );
}

describe('LastSaved', () => {
    it('shows "Guardando…" while saving', () => {
        renderWithStatus('saving');
        expect(screen.getByText('Guardando…')).toBeInTheDocument();
    });

    it('shows "Sin conexión" when offline', () => {
        renderWithStatus('offline');
        expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    });

    it('shows "Error al guardar" on error', () => {
        renderWithStatus('error');
        expect(screen.getByText('Error al guardar')).toBeInTheDocument();
    });
});
