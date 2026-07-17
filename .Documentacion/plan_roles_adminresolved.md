# 🏗️ Plan de Implementación: Sistema de Roles, Permisos y Panel de Administración

## Versión 1.0 — ChatDB RBAC + Admin Dashboard

---

## 📊 Estado Actual del Proyecto

### Base de Datos (Supabase `yburqxpgzcymdyolbiqg`)
| Tabla | RLS | Registros | Política |
|---|---|---|---|
| `diagrams` | ✅ | 2 | `auth.uid() = user_id` |
| `db_tables` | ✅ | 87 | `auth.uid() = user_id` |
| `db_relationships` | ✅ | 97 | `auth.uid() = user_id` |
| `areas` | ✅ | 10 | `auth.uid() = user_id` |
| `db_dependencies` | ✅ | 0 | `auth.uid() = user_id` |
| `db_custom_types` | ✅ | 0 | `auth.uid() = user_id` |
| `notes` | ✅ | 0 | `auth.uid() = user_id` |
| `user_config` | ✅ | 1 | `auth.uid() = user_id` |
| `diagram_filters` | ✅ | 2 | `auth.uid() = user_id` |

### Usuarios Registrados (4 activos + 2 sin confirmar)
| Email | Confirmado | Rol Deseado |
|---|---|---|
| `alber73004102@gmail.com` | ✅ | **super_admin** |
| `albertoparedes1802@gmail.com` | ✅ | user |
| `dm319636@gmail.com` | ✅ | user |
| `cuentauni2022daniel@gmail.com` | ✅ | user |

### Frontend (React + Vite + TypeScript)
- **Router:** `react-router-dom` v7 con lazy loading
- **Auth Context:** `src/context/auth-context/` (signIn, signUp, signOut)
- **Protected Route:** `src/components/protected-route/` (solo valida user != null)
- **Tema:** Sistema de temas light/dark con CSS variables (`globals.css`)
- **Componentes UI:** shadcn/ui (Card, Button, Input, Table, Tabs, Dialog, etc.)

---

## 🎯 Objetivos

1. **Sistema RBAC** (Role-Based Access Control) con 3 roles: `super_admin`, `admin`, `user`
2. **Panel de Administración** aislado en `/admin/*` con dashboard, gestión de usuarios y logs
3. **Cero impacto en datos existentes** — Nuevas tablas y políticas, sin alterar tablas actuales
4. **Desarrollo en branch de Supabase** para proteger producción durante la implementación
5. **Soporte completo de tema oscuro/claro** en todo el admin

---

## 🏛️ Arquitectura de la Solución

### Modelo de Roles (inspirado en Spatie/Laravel Permission)

```mermaid
erDiagram
    auth_users ||--o{ user_profiles : "1:1"
    user_profiles }o--|| roles : "tiene"
    roles ||--o{ role_permissions : "tiene"
    permissions ||--o{ role_permissions : "tiene"
    auth_users ||--o{ audit_logs : "genera"

    user_profiles {
        uuid user_id PK
        text display_name
        text avatar_url
        text role_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    roles {
        text id PK
        text name
        text description
        int level
        timestamptz created_at
    }

    permissions {
        text id PK
        text name
        text description
        text group_name
    }

    role_permissions {
        text role_id FK
        text permission_id FK
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        text action
        text resource_type
        text resource_id
        jsonb metadata
        text ip_address
        timestamptz created_at
    }
```

### Roles por Defecto

| Rol | Level | Permisos |
|---|---|---|
| `super_admin` | 100 | Todo. Gestión de roles, usuarios, ver logs, CRUD global. |
| `admin` | 50 | Gestión de usuarios (excepto super_admins). Ver logs. |
| `user` | 10 | CRUD de sus propios diagramas. Sin acceso al panel admin. |

### Permisos Iniciales

| Permiso | Grupo | Descripción |
|---|---|---|
| `users.list` | Usuarios | Ver lista de usuarios |
| `users.edit` | Usuarios | Editar perfil de otros usuarios |
| `users.delete` | Usuarios | Eliminar usuarios |
| `users.assign_role` | Usuarios | Cambiar rol de un usuario |
| `diagrams.list_all` | Diagramas | Ver todos los diagramas del sistema |
| `diagrams.delete_any` | Diagramas | Eliminar diagramas de otros usuarios |
| `audit.view` | Auditoría | Ver logs de auditoría |
| `admin.access` | Admin | Acceder al panel de administración |
| `admin.settings` | Admin | Modificar configuraciones del sistema |

---

## 📋 Fases de Implementación

### Fase 1: Esquema de Base de Datos (Branch de Supabase)
> **Objetivo:** Crear todas las tablas nuevas en un branch sin tocar producción.

**Acciones:**
1. Crear branch de desarrollo en Supabase
2. Crear tablas: `roles`, `permissions`, `role_permissions`, `user_profiles`, `audit_logs`
3. Seed data: insertar roles y permisos por defecto
4. Crear función SQL `get_user_role(uid)` para uso en RLS
5. Crear función SQL `user_has_permission(uid, permission_name)` para uso en RLS
6. Configurar RLS en las tablas nuevas:
   - `user_profiles`: lectura del propio perfil + admins leen todo
   - `roles` y `permissions`: lectura pública, escritura solo super_admin
   - `audit_logs`: solo lectura para admins, inserción automática via trigger
7. Crear trigger `on_auth_user_created` que auto-cree `user_profiles` con rol `user`
8. **Actualizar políticas RLS existentes** para permitir que super_admin y admin lean datos de otros usuarios (sin romper la política actual de `auth.uid() = user_id` para usuarios normales)

**Archivos modificados:** Ninguno (todo en SQL via MCP de Supabase)

---

### Fase 2: Auth Context y Middleware de Roles (Frontend)
> **Objetivo:** Extender el contexto de autenticación para incluir rol y permisos.

**Archivos nuevos:**
- `src/lib/rbac.ts` — Tipos y helpers de roles/permisos
- `src/context/auth-context/auth-context.tsx` — Modificar para cargar perfil + rol
- `src/components/protected-route/admin-route.tsx` — Guard para rutas `/admin/*`

**Cambios clave:**
```typescript
// Nuevo AuthContextType
interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;   // NUEVO
    role: string | null;           // NUEVO  
    loading: boolean;
    signIn: (...) => Promise<...>;
    signUp: (...) => Promise<...>;
    signOut: () => Promise<void>;
    hasPermission: (perm: string) => boolean;  // NUEVO
    isAdmin: () => boolean;        // NUEVO
}
```

---

### Fase 3: Panel de Administración (Frontend)
> **Objetivo:** Dashboard completo con sidebar, gestión de usuarios y auditoría.

**Estructura de archivos:**
```
src/pages/admin/
├── admin-layout.tsx          ← Layout con sidebar + topbar
├── admin-sidebar.tsx         ← Navegación lateral
├── dashboard/
│   └── admin-dashboard.tsx   ← Métricas: usuarios, diagramas, actividad
├── users/
│   ├── users-list.tsx        ← Tabla de usuarios con búsqueda y paginación
│   └── user-edit-dialog.tsx  ← Modal para editar rol/perfil de un usuario
└── audit/
    └── audit-logs.tsx        ← Tabla de logs de actividad
```

**Componentes UI reutilizados del proyecto:**
- `Card`, `Button`, `Input`, `Label` → Formularios
- `Table` (`src/components/table/table.tsx`) → Tablas de datos
- `Tabs` → Navegación entre secciones
- `Dialog` → Modales de edición
- `Badge` → Etiquetas de roles
- `Spinner` → Estados de carga
- `Select` → Selectores de roles
- `Avatar` → Foto del usuario en la lista
- `DropdownMenu` → Acciones por fila

**Rutas nuevas en `router.tsx`:**
```typescript
{
    path: 'admin',
    element: <AdminRoute><AdminLayout /></AdminRoute>,
    children: [
        { index: true, element: <AdminDashboard /> },
        { path: 'users', element: <UsersList /> },
        { path: 'audit', element: <AuditLogs /> },
    ]
}
```

---

### Fase 4: Dashboard de Métricas
> **Objetivo:** Vista principal del admin con indicadores en tiempo real.

**Tarjetas de métricas:**
| Métrica | Fuente |
|---|---|
| Total de Usuarios | `SELECT count(*) FROM auth.users` (via `user_profiles`) |
| Usuarios Activos (últimos 7 días) | `last_sign_in_at > now() - interval '7 days'` |
| Diagramas Totales | `SELECT count(*) FROM diagrams` |
| Registros Hoy | `created_at >= today` en `user_profiles` |

**Gráfico de actividad:** Registros por día (últimos 30 días) con un chart simple.

---

### Fase 5: Integración de Tema Oscuro/Claro
> **Objetivo:** Que todo el admin use el mismo sistema de temas que el editor.

**Estrategia:**
- Usar las mismas CSS variables de `globals.css` (`:root` para light, `.dark` para dark)
- El `AdminLayout` consume `useTheme()` para el toggle
- Todos los componentes del admin usan clases Tailwind con `dark:` prefix
- Sidebar: `bg-card` / `dark:bg-card` con bordes sutiles
- Tablas: `bg-background` / hover con `bg-muted`

---

### Fase 6: Migración a Producción
> **Objetivo:** Merge del branch de Supabase + despliegue del frontend.

**Pasos:**
1. Verificar que todo funciona en el branch de Supabase
2. `heroku container:release` del merge a Supabase con el frontend actualizado
3. Ejecutar seed SQL en producción para:
   - Crear roles y permisos
   - Asignar `alber73004102@gmail.com` como `super_admin`
   - Crear `user_profiles` para usuarios existentes con rol `user`
4. Deploy Docker a Heroku

---

## ⚠️ Preguntas Antes de Empezar

> [!IMPORTANT]
> Necesito que confirmes lo siguiente antes de proceder:

### 1. ¿Qué usuarios serán admin además del super_admin?
- `alber73004102@gmail.com` → **super_admin** ✅
- ¿Algún otro usuario debería ser `admin` desde el inicio? ¿O todos los demás son `user`?

### 2. ¿Quieres un sistema de invitación de usuarios?
- ¿El super_admin debería poder **invitar** nuevos usuarios directamente desde el panel (sin que se registren manualmente)?
- ¿O prefieres que todos pasen por el flujo de registro + verificación de email?

### 3. ¿Quieres poder ver los diagramas de otros usuarios desde el admin?
- Esto requiere ampliar las políticas RLS de `diagrams`, `db_tables`, etc. para permitir lectura a admins.
- Si solo quieres **ver estadísticas** (conteo, nombres) pero NO abrir/editar los diagramas, la implementación es más simple y segura.

### 4. ¿El admin debería poder **eliminar** usuarios?
- Esto implica eliminar en cascada todos sus diagramas, tablas, relaciones, etc.
- ¿O prefieres solo **desactivar** (ban) al usuario sin borrar datos?

### 5. ¿Branch de Supabase o directo en producción?
- Puedo crear un branch de desarrollo en Supabase para hacer todo allí primero.
- Pero esto tiene un costo adicional en tu plan de Supabase. ¿Prefieres que trabaje directamente en producción con cuidado (sin alterar tablas existentes)?

---

## 📅 Estimación de Trabajo

| Fase | Descripción | Complejidad |
|---|---|---|
| 1 | Esquema de BD + RLS + Funciones SQL | Media |
| 2 | Auth Context + RBAC Frontend | Media |
| 3 | Panel Admin (Layout + Páginas) | Alta |
| 4 | Dashboard de Métricas | Baja |
| 5 | Tema Oscuro/Claro en Admin | Baja |
| 6 | Migración + Deploy | Baja |

---

## 🔒 Principios de Seguridad Aplicados

1. **RLS siempre activo** — Ninguna tabla sin Row Level Security
2. **Principio de menor privilegio** — Usuarios solo ven sus propios datos
3. **Roles en BD, no en frontend** — El frontend lee el rol, pero la BD lo enforce
4. **Auditoría completa** — Cada acción administrativa queda registrada
5. **Funciones SQL `SECURITY DEFINER`** — Para consultas de permisos que necesiten acceso elevado
6. **Verificación de email obligatoria** — Sin auto-confirmación
