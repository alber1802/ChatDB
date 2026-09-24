import { describe, expect, it, vi } from 'vitest';
import { createMailer } from '../src/lib/mailer.ts';

const invitation = {
    to: 'ana@example.com',
    inviterName: 'Vladimir',
    diagramName: 'Ventas',
    role: 'editor' as const,
    link: 'https://app.example.com/invite/abc',
};

describe('createMailer', () => {
    it('returns null when no provider is configured (UI falls back to copying the link)', () => {
        expect(createMailer({ RESEND_API_KEY: '', MAIL_FROM: '' })).toBeNull();
    });

    it('sends the invitation through Resend when configured', async () => {
        const fetchMock = vi.fn(
            async () => new Response('{}', { status: 200 })
        );
        const mailer = createMailer(
            { RESEND_API_KEY: 'key', MAIL_FROM: 'ChartDB <no-reply@x.com>' },
            fetchMock as unknown as typeof fetch
        )!;

        await mailer.sendInvitation(invitation);

        const [url, init] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe('https://api.resend.com/emails');
        expect((init.headers as Record<string, string>).Authorization).toBe(
            'Bearer key'
        );
        const body = JSON.parse(String(init.body));
        expect(body.to).toEqual(['ana@example.com']);
        expect(body.from).toBe('ChartDB <no-reply@x.com>');
        expect(body.html).toContain(invitation.link);
    });

    it('escapes user-controlled names in the email HTML', async () => {
        const fetchMock = vi.fn(
            async () => new Response('{}', { status: 200 })
        );
        const mailer = createMailer(
            { RESEND_API_KEY: 'key', MAIL_FROM: 'a@x.com' },
            fetchMock as unknown as typeof fetch
        )!;
        await mailer.sendInvitation({
            ...invitation,
            diagramName: '<script>x</script>',
        });
        const body = JSON.parse(
            String(
                (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
                    .body
            )
        );
        expect(body.html).not.toContain('<script>');
        expect(body.html).toContain('&lt;script&gt;');
    });

    it('throws when the provider rejects the message', async () => {
        const fetchMock = vi.fn(
            async () => new Response('bad', { status: 422 })
        );
        const mailer = createMailer(
            { RESEND_API_KEY: 'key', MAIL_FROM: 'a@x.com' },
            fetchMock as unknown as typeof fetch
        )!;
        await expect(mailer.sendInvitation(invitation)).rejects.toThrow();
    });
});
