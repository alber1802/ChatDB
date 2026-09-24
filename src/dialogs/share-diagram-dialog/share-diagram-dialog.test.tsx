import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShareDiagramDialog } from './share-diagram-dialog';

const api = vi.hoisted(() => ({
    getDiagramAccess: vi.fn(),
    listMembers: vi.fn(),
    listInvitations: vi.fn(),
    invite: vi.fn(),
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

describe('ShareDiagramDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.listMembers.mockResolvedValue([]);
        api.listInvitations.mockResolvedValue([]);
        api.searchCandidates.mockResolvedValue([]);
    });

    it('lets the owner invite a typed email and shows the link when no email was sent', async () => {
        api.getDiagramAccess.mockResolvedValue({
            id: 'd1',
            name: 'Ventas',
            accessRole: 'owner',
            owner: { id: 'me', displayName: 'Vladimir', avatarUrl: null },
        });
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

        const input = await screen.findByRole('combobox', {
            name: /nombre o correo/i,
        });
        const inviteButton = screen.getByRole('button', { name: 'Invitar' });
        expect(inviteButton).toBeDisabled();

        await user.type(input, 'Ana@Example.com');
        expect(inviteButton).toBeEnabled();
        await user.click(inviteButton);

        expect(api.invite).toHaveBeenCalledWith(
            'd1',
            'ana@example.com',
            'editor'
        );
        expect(
            await screen.findByDisplayValue('https://app/invite/tok')
        ).toBeInTheDocument();
        expect(screen.getByText('ana@example.com')).toBeInTheDocument();
        expect(screen.getByText(/Vladimir/)).toBeInTheDocument();
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
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.getByText('Lector')).toBeInTheDocument()
        );
        expect(api.listInvitations).not.toHaveBeenCalled();
    });
});
