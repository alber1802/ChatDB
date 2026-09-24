export interface InvitationEmail {
    to: string;
    inviterName: string;
    diagramName: string;
    role: 'editor' | 'viewer';
    link: string;
}

export interface Mailer {
    sendInvitation(email: InvitationEmail): Promise<void>;
}

interface MailerEnv {
    RESEND_API_KEY: string;
    MAIL_FROM: string;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const ROLE_LABEL = { editor: 'editar', viewer: 'ver' } as const;

function renderInvitation(email: InvitationEmail) {
    const inviter = escapeHtml(email.inviterName);
    const diagram = escapeHtml(email.diagramName);
    const link = escapeHtml(email.link);
    return {
        subject: `${email.inviterName} te invitó a "${email.diagramName}" en ChartDB`,
        html: `<p>${inviter} te invitó a ${ROLE_LABEL[email.role]} el diagrama <strong>${diagram}</strong> en ChartDB.</p>
<p><a href="${link}">Abrir la invitación</a></p>
<p>El enlace caduca en 7 días y solo funciona con esta dirección de correo.</p>`,
        text: `${email.inviterName} te invitó a ${ROLE_LABEL[email.role]} el diagrama "${email.diagramName}" en ChartDB.\n\n${email.link}\n\nEl enlace caduca en 7 días y solo funciona con esta dirección de correo.`,
    };
}

/**
 * Proveedor de correo opcional (docs/collaboration/02-sharing-and-permissions.md).
 * Sin RESEND_API_KEY/MAIL_FROM devuelve null y la invitación sigue
 * funcionando: el owner copia el enlace desde el modal de compartir.
 */
export function createMailer(
    env: MailerEnv,
    fetchImpl: typeof fetch = fetch
): Mailer | null {
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return null;
    return {
        async sendInvitation(email) {
            const { subject, html, text } = renderInvitation(email);
            const res = await fetchImpl('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: env.MAIL_FROM,
                    to: [email.to],
                    subject,
                    html,
                    text,
                }),
            });
            if (!res.ok) {
                throw new Error(`Mail provider responded ${res.status}`);
            }
        },
    };
}
