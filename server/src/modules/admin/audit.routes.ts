import { Router } from 'express';
import { withUserContext } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(authenticate);

auditRouter.get('/audit-logs', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const [{ rows: users }, { rows: logs }] = await Promise.all([
                client.query(`SELECT * FROM get_admin_users()`),
                client.query(
                    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`
                ),
            ]);

            const emailById = new Map<string, string>();
            for (const u of users) {
                emailById.set(String(u.id), String(u.email));
            }

            return logs.map((log) => ({
                ...log,
                user_email: log.user_id
                    ? (emailById.get(String(log.user_id)) ??
                      'Usuario Desconocido')
                    : 'Sistema',
            }));
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});

auditRouter.get('/dashboard', async (req, res, next) => {
    try {
        const data = await withUserContext(req.user!.id, async (client) => {
            const { rows: users } = await client.query(
                `SELECT * FROM get_admin_users()`
            );
            const { rows: diagramCount } = await client.query(
                `SELECT COUNT(*)::int AS count FROM diagrams`
            );
            const { rows: tablesCount } = await client.query(
                `SELECT COUNT(*)::int AS count FROM db_tables`
            );
            const { rows: logsCount } = await client.query(
                `SELECT COUNT(*)::int AS count FROM audit_logs`
            );
            const { rows: recentDiagrams } = await client.query(
                `SELECT id, name, updated_at, user_id
                 FROM diagrams
                 ORDER BY updated_at DESC
                 LIMIT 5`
            );
            return {
                usersTotal: users.length,
                confirmedUsers: users.filter(
                    (u: { email_confirmed_at: string | null }) =>
                        u.email_confirmed_at !== null
                ).length,
                diagramsTotal: diagramCount[0]?.count ?? 0,
                tablesTotal: tablesCount[0]?.count ?? 0,
                auditTotal: logsCount[0]?.count ?? 0,
                users,
                recentDiagrams,
            };
        });
        res.json(data);
    } catch (err) {
        next(err);
    }
});
