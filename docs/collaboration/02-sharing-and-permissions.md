# Fase 2 — Compartir diagramas e invitaciones

## Objetivo

Que el propietario invite a personas (registradas o no) con rol `editor` o
`viewer`, y que todos gestionen el acceso desde el editor y el Dashboard, sin
invitaciones duplicadas ni accesos sin consentimiento.

## Actualización 2026-09-24 (decisión del usuario)

Hay **dos formas de dar acceso**, ambas desde el modal (pestañas):

1. **Usuarios del sistema** — selector con búsqueda que lista a los usuarios
   registrados (nombre + email completo; sin texto muestra los primeros 50). El
   acceso es **inmediato** (`share_diagram_with_user`, `POST /diagrams/:id/shares`)
   y la persona recibe una **notificación interna** (campana).
2. **Por correo** — la invitación descrita abajo (aceptar/rechazar, 7 días,
   enlace copiable si no hay mailer). Si el correo ya tiene cuenta, además le
   llega una notificación interna con Aceptar/Rechazar.

Notificaciones internas: tabla `user_notifications` alimentada por triggers
(`server/sql/2026-09-24-collab-notifications.sql`): `diagram_shared`,
`invitation_received`, `invitation_accepted`, `role_changed`,
`access_removed`, `member_left`. API `GET /me/notifications`,
`POST /me/notifications/read`. La campana consulta cada 30 s (push por
WebSocket en Fase 3). El email completo y el acceso sin aceptación sustituyen a
las decisiones de privacidad/consentimiento originales de abajo para usuarios
del sistema.

Orden de migraciones: `2026-09-23-collab-roles.sql` →
`2026-09-23-collab-invitations.sql` → `2026-09-24-collab-notifications.sql`.

## Flujo

```
Owner abre "Compartir" ─▶ escribe nombre/correo ─▶ autocompletado (usuarios registrados)
      │                                                     │
      │  selecciona usuario o escribe un correo nuevo        │
      ▼                                                     ▼
 create_diagram_invitation(diagram, email, role)  ── valida: owner, no miembro, sin pendiente activa
      │
      ├─ correo registrado → aparece en "Invitaciones" del invitado (Dashboard) + email si hay mailer
      └─ correo no registrado → email con enlace /invite/:token (o "Copiar enlace")
                                  └─ tras registrarse (waitlist) e iniciar sesión, la ve igual
Invitado: Aceptar → fila en diagram_shares │ Rechazar → declined │ 7 días → expired │ Owner: Revocar → revoked
```

**Decisión:** todas las altas pasan por invitación, también para usuarios ya
registrados. Añadir a alguien directamente (el `POST /shares` actual) comparte
sin consentimiento y rompe el flujo de rechazo.

## Base de datos

`server/sql/YYYY-MM-DD-collab-invitations.sql`:

```sql
CREATE TABLE diagram_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id   text NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  email        text NOT NULL,              -- siempre lower(trim())
  role         text NOT NULL CHECK (role IN ('editor','viewer')),
  invited_by   uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,        -- sha256 del token del enlace; el token nunca se guarda
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','revoked','expired')),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
-- Una sola invitación ACTIVA por (diagrama, email)
CREATE UNIQUE INDEX diagram_invitations_one_pending
  ON diagram_invitations (diagram_id, email) WHERE status = 'pending';
CREATE INDEX diagram_invitations_email_pending
  ON diagram_invitations (email) WHERE status = 'pending';
```

RLS: SELECT para owner del diagrama (`get_diagram_role(...) = 'owner'`) o para el
invitado (`email = lower(auth.email())`). Sin INSERT/UPDATE/DELETE directos:
todo por funciones SECURITY DEFINER (`SET search_path = public`), que además
llaman a `log_activity` para auditoría:

| Función | Valida | Hace |
| --- | --- | --- |
| `create_diagram_invitation(diagram_id, email, role, token_hash)` | caller es owner; email ≠ el suyo; email no pertenece a un miembro actual (`diagram_shares` ⋈ `auth.users`); no hay `pending` vigente (índice parcial → error `invitation_exists`) | inserta `pending` |
| `accept_diagram_invitation(id \| token_hash)` | `pending`, no expirada, `email = auth.email()` del caller | inserta `diagram_shares` (`ON CONFLICT DO NOTHING`) y marca `accepted` |
| `decline_diagram_invitation(id)` | invitado | `declined` |
| `revoke_diagram_invitation(id)` | owner | `revoked` |
| `search_users_for_share(diagram_id, q)` | caller es owner; `length(q) >= 3`; `LIMIT 8` | ver abajo |

Expiración: se evalúa en lectura (`status='pending' AND expires_at > now()`) y una
limpieza perezosa marca `expired` al crear/listar; no hace falta un cron.

Reenviar = revocar la pendiente + crear otra (nuevo token), en una sola función
`resend_diagram_invitation(id)`.

## Búsqueda / autocompletado

`search_users_for_share` busca por prefijo en `user_profiles.display_name` y en
`auth.users.email`, excluye al propio caller y a los miembros actuales, y
devuelve `user_id, display_name, avatar_url, email_masked`
(`j***@dominio.com`); el email completo solo si `q` coincide exactamente con él.
Motivo: `user_profiles` ya es legible por cualquier autenticado, pero los emails
no deben poder enumerarse. Reemplaza el uso de `get_user_by_email` en este flujo.

Backend: `GET /diagrams/:id/share-candidates?q=` con rate limit propio
(30/min por usuario) y debounce de 250 ms en el cliente.

## Envío de correo

No hay proveedor de correo en el backend hoy. **Decisión recomendada:** interfaz
`Mailer` en `server/src/lib/mailer.ts` con implementación Resend (o SMTP) activada
por `MAIL_PROVIDER_API_KEY`; si no está configurado, la API devuelve el enlace
`/invite/:token` y el modal muestra **"Copiar enlace de invitación"**. La
invitación funciona igual en ambos casos.

Usuarios sin cuenta: el registro sigue pasando por la **waitlist** (no se salta).
El enlace lleva a la página de auth con `?invite=token`; al pedir acceso se crea
la entrada de waitlist con nota "Invitado por X". Tras la aprobación y primer
login, sus invitaciones pendientes aparecen por coincidencia de email.
*(Decisión a confirmar por el producto: si una invitación debe auto-aprobar la
waitlist. Por defecto: no.)*

## API

| Método | Ruta | Quién |
| --- | --- | --- |
| GET | `/diagrams/:id/members` | miembros — owner + shares + invitaciones pendientes (estas solo para owner) |
| POST | `/diagrams/:id/invitations` `{email, role}` | owner — genera token (32 bytes aleatorios), guarda hash |
| POST | `/diagrams/:id/invitations/:invId/resend` · DELETE `/…/:invId` | owner |
| PATCH | `/diagrams/:id/shares/:shareId` `{role}` | owner |
| DELETE | `/diagrams/:id/shares/:shareId` · `/diagrams/:id/shares/me` | owner · miembro |
| GET | `/me/invitations` | invitado (pendientes y vigentes) |
| POST | `/invitations/:id/accept` · `/invitations/:id/decline` · `/invitations/by-token/:token/accept` | invitado |

Errores tipados (`AppError` code): `invitation_exists`, `already_member`,
`cannot_invite_self`, `invitation_expired`, `invitation_email_mismatch`,
`forbidden_role`.

## Frontend

**Modal `ShareDiagramDialog`** (`src/dialogs/share-diagram-dialog/`, registrado en
`dialog-context` con `openShareDiagramDialog({ diagramId })`, mismo patrón que los
diálogos existentes, componentes shadcn/Radix ya usados en el proyecto):

```
┌ Compartir "Nombre del diagrama" ─────────────────────── ✕ ┐
│ [ Nombre o correo…             ] [Editor ▾] [Invitar]      │
│   ↳ Ana Pérez · a***@capital.com                           │
│   ↳ Invitar a nuevo@correo.com (sin cuenta)                │
│                                                            │
│ Personas con acceso                                        │
│ (AV) Vladimir (tú) ......................... Propietario    │
│ (AP) Ana Pérez ............................. [Editor ▾] 🗑  │
│ (JL) Juan López ............................ [Lector ▾] 🗑  │
│ Invitaciones pendientes                                    │
│ ✉ nuevo@correo.com · Editor · expira en 6 días  Reenviar ✕ │
│ [Copiar enlace de invitación]  (solo si no hay mailer)     │
└────────────────────────────────────────────────────────────┘
```

- Accesible: combobox con `cmdk` (ya dependencia), `aria-live` para el resultado,
  foco devuelto al botón "Compartir", todo operable con teclado.
- Editor/viewer abren el mismo modal en modo lectura (lista sin controles) y con
  botón "Abandonar diagrama".
- Validación local de email y de duplicados antes de llamar a la API; la API es
  la que decide.

**Puntos de entrada:**
- Editor: botón "Compartir" en `top-navbar.tsx` junto a `<LastSaved/>` (y en el
  menú de `top-navbar-mobile.tsx`).
- Dashboard: acción "Compartir…" en el menú de `diagram-card.tsx` /
  `diagram-list-item.tsx`; badge de rol ("Editor", "Lector", "Compartido por X").
- Dashboard: sección/banner **"Invitaciones (n)"** con Aceptar/Rechazar
  (`GET /me/invitations`); al aceptar, el diagrama aparece en la lista.
- Ruta `/invite/:token`: si hay sesión, acepta y redirige al editor; si no, lleva
  a login con el token preservado.

**Estados visuales:** propietario / editor / lector; invitación pendiente,
expirada, rechazada (esta última solo visible para el owner en el historial
reciente); "Solo lectura" en la barra del editor para viewer.

## Archivos a revisar

- `server/src/modules/shares/shares.routes.ts` (rehacer), nuevo `server/src/modules/invitations/`
- `server/src/app.ts` (montar rutas), `server/src/middleware/rateLimit.ts`
- `src/context/dialog-context/dialog-context.tsx`, `dialog-provider.tsx`
- `src/pages/editor-page/top-navbar/top-navbar.tsx`, `top-navbar-mobile.tsx`
- `src/pages/diagrams-dashboard/diagrams-dashboard.tsx`, `_components/*`, `_hooks/use-dashboard.ts`
- `src/pages/auth-page/auth-card.tsx`, `waitlist-modal.tsx`, `src/router.tsx`
- `src/i18n/` (textos nuevos en los idiomas existentes)

## Riesgos

- Enumeración de usuarios por el autocompletado → prefijo mínimo, máscara, rate limit.
- Tokens de invitación filtrados → solo hash en BD, expiración 7 días, el token
  solo sirve para el email invitado (se compara con `auth.email()` al aceptar).
- Email con mayúsculas/espacios → normalizar siempre en la función SQL, no en el cliente.

## Criterios de aceptación

- [ ] Owner invita a un usuario registrado; este ve la invitación, acepta y abre
      el diagrama con el rol correcto.
- [ ] Invitar dos veces al mismo email con una pendiente → `invitation_exists`;
      invitar a un miembro → `already_member`; a sí mismo → `cannot_invite_self`.
- [ ] Invitación a email sin cuenta: enlace funciona tras registrarse con ese
      email y no funciona con otra cuenta.
- [ ] Rechazar, revocar y expirar dejan la invitación inutilizable.
- [ ] Owner cambia rol y quita miembros desde el editor y desde el Dashboard.
- [ ] El modal es operable solo con teclado y pasa axe sin violaciones serias.
