import React from 'react';
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShareDiagramDialog } from './share-diagram-dialog';
import { ApiError } from '@/lib/api-client';

const api = vi.hoisted(() => ({
    getDiagramAccess: vi.fn(),
    listMembers: vi.fn(),
    listInvitations: vi.fn(),
    invite: vi.fn(),
    shareWithUser: vi.fn(),
    searchCandidates: vi.fn(),
    leaveDiagram: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
}));

vi.mock('@/lib/collaboration/collaboration-api', () => ({
    collaborationApi: api,
}));
vi.mock('@/hooks/use-dialog', () => ({
    useDialog: () => ({ closeShareDiagramDialog: vi.fn() }),
}));
vi.mock('@/context/auth-context/auth-context', () => ({
    useAuth: () => ({ user: { id: 'me' } }),
}));
vi.mock('@/lib/notifications', () => ({
    notify: { success: vi.fn(), error: vi.fn() },
}));

beforeAll(() => {
    // cmdk usa APIs de layout que happy-dom no implementa del todo.
    Element.prototype.scrollIntoView ??= vi.fn();
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
});

const renderDialog = () =>
    render(
        <MemoryRouter>
            <ShareDiagramDialog
                dialog={{ open: true }}
                diagramId="d1"
                diagramName="Ventas"
            />
        </MemoryRouter>
    );

const ownerAccess = {
    id: 'd1',
    name: 'Ventas',
    accessRole: 'owner',
    owner: { id: 'me', displayName: 'Vladimir', avatarUrl: null },
};

describe('ShareDiagramDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.listMembers.mockResolvedValue([]);
        api.listInvitations.mockResolvedValue([]);
        api.searchCandidates.mockResolvedValue([]);
    });

    it('shares directly with a user picked from the searchable system user list', async () => {
        api.getDiagramAccess.mockResolvedValue(ownerAccess);
        api.searchCandidates.mockResolvedValue([
            {
                userId: 'u-ana',
                displayName: 'Ana Pérez',
                avatarUrl: null,
                email: 'ana@example.com',
            },
            {
                userId: 'u-juan',
                displayName: 'Juan López',
                avatarUrl: null,
                email: 'juan@example.com',
            },
        ]);
        api.shareWithUser.mockResolvedValue({ id: 's1' });
        const user = userEvent.setup();
        renderDialog();

        await user.click(
            await screen.findByRole('combobox', {
                name: /seleccionar usuario/i,
            })
        );
        // Al abrir, lista usuarios del sistema sin necesidad de escribir.
        await waitFor(() =>
            expect(api.searchCandidates).toHaveBeenCalledWith(
                'd1',
                '',
                expect.anything()
            )
        );
        await user.click(await screen.findByText('Juan López'));

        await user.click(screen.getByRole('button', { name: 'Compartir' }));

        expect(api.shareWithUser).toHaveBeenCalledWith(
            'd1',
            'u-juan',
            'editor'
        );
        await waitFor(() => expect(api.listMembers).toHaveBeenCalledTimes(2));
    });

    it('keeps the email invitation as a second way and shows the link when no email was sent', async () => {
        api.getDiagramAccess.mockResolvedValue(ownerAccess);
        api.invite.mockResolvedValue({
            invitation: {
                id: 'i1',
                email: 'ana@example.com',
                role: 'editor',
                status: 'pending',
                expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString(),
                createdAt: new Date().toISOString(),
            },
            inviteLink: 'https://app/invite/tok',
            emailSent: false,
        });
        const user = userEvent.setup();
        renderDialog();

        await user.click(
            await screen.findByRole('tab', { name: /por correo/i })
        );
        const input = screen.getByRole('textbox', { name: /correo/i });
        const send = screen.getByRole('button', { name: /enviar invitación/i });
        expect(send).toBeDisabled();

        await user.type(input, 'Ana@Example.com');
        await user.click(send);

        expect(api.invite).toHaveBeenCalledWith(
            'd1',
            'ana@example.com',
            'editor'
        );
        expect(
            await screen.findByDisplayValue('https://app/invite/tok')
        ).toBeInTheDocument();
        expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    });

    it('shows a read-only member list and a leave button to non-owners', async () => {
        api.getDiagramAccess.mockResolvedValue({
            id: 'd1',
            name: 'Ventas',
            accessRole: 'viewer',
            owner: { id: 'o1', displayName: 'Ana', avatarUrl: null },
        });
        api.listMembers.mockResolvedValue([
            {
                id: 's1',
                sharedWith: 'me',
                role: 'viewer',
                createdAt: '',
                displayName: 'Yo',
                avatarUrl: null,
            },
        ]);
        renderDialog();

        expect(
            await screen.findByRole('button', { name: /abandonar diagrama/i })
        ).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByText('Lector')).toBeInTheDocument()
        );
        expect(api.listInvitations).not.toHaveBeenCalled();
    });

    it('explains why the user list is empty when the search fails, instead of "no matches"', async () => {
        api.getDiagramAccess.mockResolvedValue(ownerAccess);
        api.searchCandidates.mockRejectedValue(
            new ApiError('x', 503, 'migration_pending')
        );
        const user = userEvent.setup();
        renderDialog();

        await user.click(
            await screen.findByRole('combobox', {
                name: /seleccionar usuario/i,
            })
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(/migraci/i);
        expect(
            screen.queryByText(/no hay usuarios que coincidan/i)
        ).not.toBeInTheDocument();
    });
});
