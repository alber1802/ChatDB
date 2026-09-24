import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationsBell } from './notifications-bell';

const api = vi.hoisted(() => ({
    listNotifications: vi.fn(),
    markNotificationsRead: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
}));

vi.mock('@/lib/collaboration/collaboration-api', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    collaborationApi: api,
}));
vi.mock('@/lib/notifications', () => ({
    notify: { success: vi.fn(), error: vi.fn() },
}));

const notifications = [
    {
        id: 'n1',
        type: 'invitation_received',
        diagramId: 'd1',
        payload: {
            by_name: 'Ana',
            diagram_name: 'Ventas',
            role: 'editor',
            invitation_id: 'i1',
        },
        readAt: null,
        createdAt: new Date().toISOString(),
    },
    {
        id: 'n2',
        type: 'diagram_shared',
        diagramId: 'd2',
        payload: { by_name: 'Juan', diagram_name: 'Stock', role: 'viewer' },
        readAt: null,
        createdAt: new Date().toISOString(),
    },
];

const renderBell = () =>
    render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route path="/" element={<NotificationsBell />} />
                <Route path="/diagrams/:id" element={<p>editor abierto</p>} />
            </Routes>
        </MemoryRouter>
    );

describe('NotificationsBell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.listNotifications.mockResolvedValue({
            items: notifications,
            unreadCount: 2,
        });
        api.markNotificationsRead.mockResolvedValue(undefined);
    });

    it('shows the unread count', async () => {
        renderBell();
        expect(
            await screen.findByRole('button', {
                name: /notificaciones \(2 sin leer\)/i,
            })
        ).toBeInTheDocument();
    });

    it('lists notifications and marks them as read when opened', async () => {
        const user = userEvent.setup();
        renderBell();
        await user.click(
            await screen.findByRole('button', { name: /2 sin leer/i })
        );
        expect(
            await screen.findByText(/Juan compartió “Stock” contigo/)
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(api.markNotificationsRead).toHaveBeenCalledWith(['n1', 'n2'])
        );
    });

    it('accepts an email invitation from the notification and opens the diagram', async () => {
        api.acceptInvitation.mockResolvedValue({ diagramId: 'd1' });
        const user = userEvent.setup();
        renderBell();
        await user.click(
            await screen.findByRole('button', { name: /2 sin leer/i })
        );
        await user.click(
            await screen.findByRole('button', { name: 'Aceptar' })
        );
        expect(api.acceptInvitation).toHaveBeenCalledWith('i1');
        expect(await screen.findByText('editor abierto')).toBeInTheDocument();
    });

    it('keeps accept/decline on a read but still pending invitation, and hides them once resolved', async () => {
        api.listNotifications.mockResolvedValue({
            unreadCount: 0,
            items: [
                { ...notifications[0], readAt: new Date().toISOString() },
                {
                    ...notifications[0],
                    id: 'n3',
                    readAt: new Date().toISOString(),
                    payload: {
                        ...notifications[0].payload,
                        invitation_id: 'i3',
                        resolved: true,
                    },
                },
            ],
        });
        const user = userEvent.setup();
        renderBell();
        await user.click(
            await screen.findByRole('button', { name: 'Notificaciones' })
        );
        expect(
            await screen.findAllByRole('button', { name: 'Aceptar' })
        ).toHaveLength(1);
    });
});
