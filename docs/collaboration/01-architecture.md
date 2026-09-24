# Fase 1 — Arquitectura y modelo de colaboración

## Objetivo

Definir quién puede ver, editar y administrar un diagrama, reutilizando lo que ya
existe en Postgres (`diagram_shares`, `can_view_diagram`, `can_edit_diagram`) y
exponiendo el rol efectivo al frontend. Sin organizaciones ni multi-tenancy.

## Estado actual (verificado en Supabase)

- `diagrams.id` es `text` (id generado por el cliente); `diagrams.user_id` es el
  propietario. Es el identificador que se comparte: la URL del editor
  `/diagrams/:id` ya sirve como "enlace", pero solo funciona si RLS lo permite.
- `diagram_shares`: `id uuid`, `diagram_id`, `owner_id`, `shared_with`, `role`,
  `created_at`. `CHECK (role = 'editor')`, `UNIQUE (diagram_id, shared_with)`,
  FKs con `ON DELETE CASCADE`. Políticas aplicadas al rol `public` (conviene
  restringir a `authenticated`). No hay política UPDATE (no se puede cambiar el
  rol) ni política para que un colaborador se retire.
- Tablas hijas (`db_tables`, `db_relationships`, `db_dependencies`, `areas`,
  `notes`, `db_custom_types`): SELECT con `can_view_diagram`, escritura con
  `can_edit_diagram`. **Ya funciona para editores compartidos**.
- `diagrams`: SELECT dueño o compartido; UPDATE dueño o editor; DELETE solo dueño.
- `diagrams.list` (`SELECT * FROM diagrams`) ya devuelve los compartidos gracias
  a RLS, pero la API no dice qué rol tiene el usuario sobre cada uno.
- Las filas hijas guardan `user_id` = quien las creó (no el dueño). Se mantiene:
  RLS no depende de esa columna.

## Modelo de acceso

| Rol | Origen | Ver | Editar contenido | Gestionar miembros | Renombrar | Borrar diagrama |
| --- | --- | --- | --- | --- | --- | --- |
| `owner` | `diagrams.user_id` (implícito, **no** fila en shares) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `editor` | `diagram_shares.role = 'editor'` | ✅ | ✅ | ❌ (ve la lista) | ✅ | ❌ |
| `viewer` | `diagram_shares.role = 'viewer'` | ✅ | ❌ | ❌ (ve la lista) | ❌ | ❌ |

- Un solo propietario por diagrama. Transferencia de propiedad: fase posterior.
- Cualquier miembro no-owner puede **abandonar** el diagrama (borra su fila).
- El filtro de visibilidad (`diagram_filters`) y `user_config` son por usuario:
  un colaborador nunca pisa el filtro de otro.
- Los admins de la app (`super_admin`/`admin`) **no** obtienen acceso a diagramas
  ajenos por su rol global; eso se mantiene como hoy.

## Entidades

```
auth.users ─1:1─ user_profiles
     │ 1:N (owner)                 │ N:M vía diagram_shares (editor|viewer)
     ▼                             ▼
  diagrams ──1:N── diagram_shares ──N:1── user_profiles
     │  └─1:N── diagram_invitations (email, role, status, token_hash)
     └─1:N── diagram_ops (log corto de lotes, ver Fase 3)
```

Cambios de base de datos (un archivo `server/sql/YYYY-MM-DD-collab-roles.sql`,
siguiendo el patrón de migraciones sueltas):

1. `diagram_shares`: `CHECK (role IN ('editor','viewer'))`, columna
   `updated_at timestamptz`, políticas pasadas a `authenticated`:
   - SELECT: `can_view_diagram(diagram_id, auth.uid())` (todos los miembros ven la lista).
   - INSERT: **ninguna directa**; solo vía `accept_diagram_invitation()` (Fase 2).
   - UPDATE (rol): solo `owner_id = auth.uid()`; `WITH CHECK` igual.
   - DELETE: `owner_id = auth.uid() OR shared_with = auth.uid()` (revocar o abandonar).
2. `can_edit_diagram` sigue igual (solo `editor`); `can_view_diagram` ya incluye
   cualquier fila. Añadir `SET search_path = public` a ambas (hardening).
3. ~~Nueva función `get_diagram_role()`~~ — **implementado distinto:** el rol se
   calcula con la expresión `ACCESS_ROLE_SQL` (`server/src/modules/diagrams/diagrams.service.ts`)
   dentro de las consultas de la API. Así el backend no depende de que la
   migración esté aplicada antes del deploy. El servidor WebSocket (Fase 3)
   reutilizará la misma expresión.
4. **Hueco de seguridad corregido:** la política INSERT anterior de
   `diagram_shares` solo exigía `auth.uid() = owner_id`, sin comprobar que el
   diagrama fuese del llamante: cualquiera que conociera un `diagram_id` podía
   darse acceso de editor. La migración elimina INSERT directo, restringe
   UPDATE a las columnas `(role, updated_at)` y exige ser dueño del diagrama.
   Además `diagramsService.create` (upsert) ya no reescribe `user_id` ni
   `created_at`, para que un editor no pueda apropiarse de un diagrama con
   `POST /diagrams`.
5. `diagram_invitations` se define en Fase 2; `diagram_ops` en Fase 3.

## Reglas de autorización

**Backend (fuente de verdad):**
- HTTP: sigue siendo RLS vía `withUserContext`. No se añade middleware de rol en
  Express para datos; solo validaciones de negocio con mensajes claros (p. ej.
  devolver `403 forbidden_role` en vez de un 404 silencioso cuando un viewer
  intenta `POST /sync`: `syncService.apply` consulta `get_diagram_role` al
  principio del lote y corta antes de aplicar nada).
- WebSocket: al unirse a una sala se consulta `get_diagram_role`; `viewer` recibe
  ops pero cualquier mensaje de escritura se rechaza. Ver Fase 3/6.
- Gestión de miembros e invitaciones: funciones SECURITY DEFINER que comprueban
  `owner` explícitamente (mismo patrón que `assign_user_role`).

**Frontend (solo UX, nunca seguridad):**
- `GET /diagrams` y `GET /diagrams/:id` devuelven `accessRole` y `owner`
  (`{ id, displayName, avatarUrl }`).
- `editor-page.tsx` monta `<ChartDBProvider readonly={accessRole === 'viewer'}>`
  (el prop ya existe). Cuidado: `readonly` cambia `db` a un stub sin escrituras;
  las ops remotas para viewers se aplican con setters (Fase 3), no con mutadores.
- Dashboard: badge "Compartido contigo" / rol; acción "Eliminar" solo para owner,
  "Abandonar" para el resto.

## Revocación y cambio de permisos

| Acción | Quién | Efecto HTTP | Efecto en vivo (Fase 3) |
| --- | --- | --- | --- |
| Cambiar rol editor↔viewer | owner | `PATCH /diagrams/:id/shares/:shareId` | Evento `member_role_changed` a la sala; el servidor actualiza el rol de los sockets del usuario; cliente cambia a/desde `readonly` sin recargar |
| Revocar | owner | `DELETE …/shares/:shareId` | Evento `access_revoked`: el servidor cierra los sockets de ese usuario en esa sala; el cliente muestra aviso y vuelve al dashboard |
| Abandonar | miembro | `DELETE …/shares/me` | Igual que revocar, iniciado por él mismo |
| Borrar diagrama | owner | ya existe (`CASCADE`) | Evento `diagram_deleted` a la sala |

La cola pendiente del `SyncEngine` de un usuario revocado recibe `403` y se
descarta (`clearPersistedQueue()`), igual que hoy con un diagrama borrado.

## Archivos a revisar

- `server/src/modules/shares/shares.routes.ts` (reemplazar POST directo, añadir PATCH y `DELETE /shares/me`)
- `server/src/modules/diagrams/diagrams.service.ts` (`list`/`get`: añadir `accessRole`, `owner`)
- `server/src/modules/sync/sync.service.ts` (chequeo de rol al inicio)
- `server/src/lib/mappers.ts`, `server/src/lib/schemas.ts`
- `src/lib/domain/diagram.ts` (`accessRole?`, `owner?`)
- `src/pages/editor-page/editor-page.tsx` (`readonly` por rol)
- `src/pages/diagrams-dashboard/_components/diagram-card.tsx`, `diagram-list-item.tsx`

## Decisiones

- **Owner implícito en `diagrams.user_id`** (no fila en shares): evita dos fuentes
  de verdad y ya es lo que usan las políticas RLS existentes.
- **Sin organizaciones**: el objetivo es compartir diagramas entre usuarios; un
  modelo de equipos se puede añadir encima de `diagram_shares` más adelante.

## Riesgos

- Políticas actuales en rol `public`: al pasarlas a `authenticated`, probar que
  `app_backend` + `SET LOCAL ROLE authenticated` sigue viéndolas (sí debería).
- `POST /shares` directo actual permite compartir sin consentimiento; se retira
  en esta fase para no dejar un camino que evite las invitaciones.

## Criterios de aceptación

- [ ] Migración aplicada; `viewer` insertado a mano en `diagram_shares` puede leer
      pero cualquier escritura (`/sync`, `/tables`…) devuelve 403.
- [ ] `GET /diagrams` devuelve `accessRole` correcto para owner/editor/viewer.
- [ ] El editor abre en solo lectura para viewer (sin botones de edición).
- [ ] Owner cambia el rol y revoca; editor/viewer puede abandonar; nadie más puede.
- [ ] Tests de aislamiento (`server/test/integration`) cubren las 4 combinaciones
      rol × operación (leer, escribir, gestionar miembros, borrar).
