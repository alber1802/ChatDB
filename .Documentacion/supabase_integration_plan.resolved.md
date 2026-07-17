# 📋 Plan Completo: Integración Supabase + Auth en ChatDB

## 🎯 Objetivo
Reemplazar el almacenamiento local (IndexedDB/Dexie) por Supabase para que los
diagramas se sincronicen en la nube, con login por usuario y aislamiento de datos
mediante Row Level Security (RLS).

---

## 🗺️ Visión General de la Arquitectura Final

```
ANTES (actual):
  Browser → IndexedDB (Dexie) ← solo en tu PC

DESPUÉS:
  Browser → Supabase SDK → PostgreSQL en Supabase
               ↓
          Auth (email/password)
          RLS: cada usuario ve solo sus diagramas
```

### Estrategia de storage
El `StorageProvider` actual implementa la interfaz `StorageContext`
(~40 métodos: addDiagram, listDiagrams, addTable, etc.) usando Dexie/IndexedDB.
**Crearemos un segundo provider `SupabaseStorageProvider`** que implementa la
misma interfaz exacta pero usando el SDK de Supabase. El resto del código
(componentes, contextos) no necesita modificarse.

---

## 📦 Fases del Plan

### FASE 0 — Configurar Supabase (15 min, manual)
### FASE 1 — Instalar SDK y configurar cliente (30 min)
### FASE 2 — Auth Context y páginas de Login/Register (2-3 h)
### FASE 3 — Supabase Storage Provider (3-4 h)
### FASE 4 — Integrar en la app y rutas protegidas (1 h)
### FASE 5 — Variables de entorno y redeploy en Heroku (30 min)

---

## FASE 0 — Configurar Supabase (MANUAL — tú lo haces)

### 0.1 Crear proyecto en Supabase

1. Ve a https://supabase.com → **Start your project** → inicia sesión con GitHub
2. Clic en **New project**
3. Elige tu organización, ponle nombre: `chatdb`
4. Elige región: `South America (São Paulo)` o `US East`
5. Crea una contraseña segura para la DB (guárdala)
6. Espera ~2 minutos a que el proyecto se inicialice

### 0.2 Obtener credenciales

En tu proyecto de Supabase → **Settings → API**:
- Copia `Project URL` → será `VITE_SUPABASE_URL`
- Copia `anon public` key → será `VITE_SUPABASE_ANON_KEY`

### 0.3 Crear las tablas en Supabase

Ve a **SQL Editor** en el dashboard de Supabase y ejecuta este SQL:

```sql
-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla principal de diagramas (solo metadata)
CREATE TABLE diagrams (
    id          TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    database_type TEXT NOT NULL DEFAULT 'Generic',
    database_edition TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tablas del diagrama
CREATE TABLE db_tables (
    id          TEXT PRIMARY KEY,
    diagram_id  TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    schema      TEXT,
    x           FLOAT,
    y           FLOAT,
    fields      JSONB DEFAULT '[]',
    indexes     JSONB DEFAULT '[]',
    color       TEXT,
    width       FLOAT,
    comment     TEXT,
    is_view     BOOLEAN DEFAULT FALSE,
    is_materialized_view BOOLEAN DEFAULT FALSE,
    "order"     INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Relaciones entre tablas
CREATE TABLE db_relationships (
    id                  TEXT PRIMARY KEY,
    diagram_id          TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    source_schema       TEXT,
    source_table_id     TEXT,
    target_schema       TEXT,
    target_table_id     TEXT,
    source_field_id     TEXT,
    target_field_id     TEXT,
    source_cardinality  TEXT,
    target_cardinality  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Dependencias
CREATE TABLE db_dependencies (
    id                  TEXT PRIMARY KEY,
    diagram_id          TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schema              TEXT,
    table_id            TEXT,
    dependent_schema    TEXT,
    dependent_table_id  TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Áreas (grupos visuales en el canvas)
CREATE TABLE areas (
    id          TEXT PRIMARY KEY,
    diagram_id  TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    x           FLOAT,
    y           FLOAT,
    width       FLOAT,
    height      FLOAT,
    color       TEXT
);

-- Tipos personalizados (ej: ENUM en PostgreSQL)
CREATE TABLE db_custom_types (
    id          TEXT PRIMARY KEY,
    diagram_id  TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schema      TEXT,
    name        TEXT,
    kind        TEXT,
    values      JSONB,
    fields      JSONB
);

-- Notas en el canvas
CREATE TABLE notes (
    id          TEXT PRIMARY KEY,
    diagram_id  TEXT NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content     TEXT,
    x           FLOAT,
    y           FLOAT,
    width       FLOAT,
    height      FLOAT,
    color       TEXT
);

-- Configuración del usuario
CREATE TABLE user_config (
    user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    default_diagram_id  TEXT,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Filtros de diagrama
CREATE TABLE diagram_filters (
    diagram_id   TEXT PRIMARY KEY REFERENCES diagrams(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_ids    JSONB DEFAULT '[]',
    schemas_ids  JSONB DEFAULT '[]'
);
```

### 0.4 Habilitar Row Level Security (RLS)

En el mismo SQL Editor, ejecuta:

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE diagrams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_dependencies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_custom_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_filters   ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo ve/modifica sus propios datos
CREATE POLICY "users_own_diagrams" ON diagrams
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_tables" ON db_tables
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_relationships" ON db_relationships
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_dependencies" ON db_dependencies
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_areas" ON areas
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_custom_types" ON db_custom_types
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_notes" ON notes
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_config" ON user_config
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_filters" ON diagram_filters
    FOR ALL USING (auth.uid() = user_id);
```

### 0.5 Configurar Auth en Supabase

En el dashboard: **Authentication → Settings**:
- `Site URL`: `https://chatdb-alber-060263da84d8.herokuapp.com`
- En `Email Auth` → habilitar "Confirm email": **DESACTIVAR** (más simple para empezar)
- Guardar cambios

---

## FASE 1 — Instalar SDK y configurar cliente

### 1.1 Instalar dependencia

```bash
pnpm add @supabase/supabase-js
```

### 1.2 Agregar variables de entorno

Crear/actualizar `.env.local` (no se sube al repo):
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.3 Crear cliente Supabase

**Archivo nuevo**: `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 1.4 Actualizar `src/lib/env.ts`

Agregar las nuevas variables al módulo de env existente:
```typescript
// Agregar al final del archivo existente:
export const supabaseUrl = (window.env?.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? '') as string;
export const supabaseAnonKey = (window.env?.SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;
export const isSupabaseEnabled = !!(supabaseUrl && supabaseAnonKey);
```

---

## FASE 2 — Auth Context y páginas de Login/Register

### 2.1 Crear Auth Context

**Archivo nuevo**: `src/context/auth-context/auth-context.tsx`
```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

export const authContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Obtener sesión actual al iniciar
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Escuchar cambios de sesión (login/logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error };
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <authContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
            {children}
        </authContext.Provider>
    );
};

export const useAuth = () => useContext(authContext);
```

### 2.2 Crear página de Login

**Archivo nuevo**: `src/pages/auth-page/auth-page.tsx`

Página con dos tabs: "Iniciar Sesión" y "Registrarse".
Diseño consistente con el resto de la app (usando los componentes de shadcn/ui
que ya tiene el proyecto: `Input`, `Button`, `Card`, etc.)

```tsx
// Estructura básica — implementar con los componentes existentes del proyecto
export const AuthPage = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = mode === 'login'
            ? await signIn(email, password)
            : await signUp(email, password);

        if (error) {
            setError(error.message);
        } else {
            navigate('/');
        }
        setLoading(false);
    };

    // Render: Card centrada con logo, tabs login/register, form, botón
};
```

### 2.3 Agregar ruta de auth al router

En `src/router.tsx`, agregar:
```typescript
{
    path: 'auth',
    async lazy() {
        const { AuthPage } = await import('./pages/auth-page/auth-page');
        return { element: <AuthPage /> };
    },
},
```

### 2.4 Crear componente de ruta protegida

**Archivo nuevo**: `src/components/protected-route/protected-route.tsx`
```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context/auth-context';

export const ProtectedRoute: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) return <FullScreenSpinner />; // componente existente en el proyecto

    if (!user) return <Navigate to="/auth" replace />;

    return <>{children}</>;
};
```

### 2.5 Agregar botón de "Cerrar sesión" en el Navbar

En el componente del top navbar existente, agregar:
```tsx
const { user, signOut } = useAuth();

// Mostrar email del usuario + botón logout en la esquina superior derecha
```

---

## FASE 3 — Supabase Storage Provider

Este es el núcleo del trabajo. Crear un nuevo provider que implementa la
misma interfaz `StorageContext` pero usando Supabase.

### 3.1 Crear el provider

**Archivo nuevo**: `src/context/storage-context/supabase-storage-provider.tsx`

Implementar cada uno de los ~40 métodos de `StorageContext`.
Ejemplo de los más importantes:

```typescript
// addDiagram — guarda en Supabase con user_id automático
const addDiagram: StorageContext['addDiagram'] = useCallback(
    async ({ diagram }) => {
        const { error } = await supabase.from('diagrams').insert({
            id: diagram.id,
            user_id: user!.id,           // ← clave: asociar al usuario
            name: diagram.name,
            database_type: diagram.databaseType,
            database_edition: diagram.databaseEdition,
            created_at: diagram.createdAt,
            updated_at: diagram.updatedAt,
        });
        if (error) throw error;

        // Insertar tablas, relaciones, etc. en paralelo
        if (diagram.tables?.length) {
            await supabase.from('db_tables').insert(
                diagram.tables.map(t => ({ ...tableToRow(t), diagram_id: diagram.id, user_id: user!.id }))
            );
        }
        // ... igual para relationships, areas, notes, etc.
    },
    [user]
);

// listDiagrams — solo devuelve los del usuario autenticado (RLS lo filtra automáticamente)
const listDiagrams: StorageContext['listDiagrams'] = useCallback(
    async (options) => {
        const { data, error } = await supabase
            .from('diagrams')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data.map(rowToDiagram);  // función de mapeo snake_case → camelCase
    },
    []
);
```

### 3.2 Funciones de mapeo (snake_case ↔ camelCase)

Los nombres de columnas en PostgreSQL usan `snake_case` pero el código
TypeScript usa `camelCase`. Crear helpers de conversión:

**Archivo nuevo**: `src/lib/supabase-mappers.ts`
```typescript
// Convierte fila de DB → objeto TypeScript
export const rowToDiagram = (row: any): Diagram => ({
    id: row.id,
    name: row.name,
    databaseType: row.database_type,
    databaseEdition: row.database_edition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

export const rowToTable = (row: any): DBTable => ({
    id: row.id,
    name: row.name,
    schema: row.schema,
    x: row.x,
    y: row.y,
    fields: row.fields ?? [],
    indexes: row.indexes ?? [],
    color: row.color,
    width: row.width,
    comment: row.comment,
    isView: row.is_view,
    isMaterializedView: row.is_materialized_view,
    order: row.order,
    createdAt: row.created_at,
});

export const tableToRow = (table: DBTable, diagramId: string, userId: string) => ({
    id: table.id,
    diagram_id: diagramId,
    user_id: userId,
    name: table.name,
    schema: table.schema,
    x: table.x,
    y: table.y,
    fields: table.fields,
    indexes: table.indexes,
    color: table.color,
    width: table.width,
    comment: table.comment,
    is_view: table.isView,
    is_materialized_view: table.isMaterializedView,
    order: table.order,
    created_at: table.createdAt,
});

// ... mappers para relationships, areas, notes, dependencies, customTypes
```

---

## FASE 4 — Integrar en la app y rutas protegidas

### 4.1 Actualizar `src/app.tsx`

```tsx
import { AuthProvider } from '@/context/auth-context/auth-context';

export const App = () => {
    return (
        <HelmetProvider>
            <HelmetData />
            <TooltipProvider>
                <AuthProvider>                    {/* ← NUEVO */}
                    <RouterProvider router={router} />
                </AuthProvider>
            </TooltipProvider>
        </HelmetProvider>
    );
};
```

### 4.2 Actualizar `src/router.tsx`

Envolver las rutas del editor en `<ProtectedRoute>`:

```typescript
// Rutas que requieren login:
// - '/' (editor principal)
// - 'diagrams/:diagramId'

// Ruta pública:
// - 'auth'
// - 'templates/*'
// - 'examples'
```

### 4.3 Actualizar el StorageProvider selector

Crear un componente que decide qué provider usar:

**Archivo nuevo**: `src/context/storage-context/storage-provider-selector.tsx`
```tsx
import { isSupabaseEnabled } from '@/lib/env';
import { useAuth } from '@/context/auth-context/auth-context';
import { SupabaseStorageProvider } from './supabase-storage-provider';
import { StorageProvider } from './storage-provider'; // el original de Dexie

export const StorageProviderSelector: React.FC<React.PropsWithChildren> = ({ children }) => {
    const { user } = useAuth();

    // Si Supabase está configurado Y el usuario está logueado → usar Supabase
    // Si no → usar IndexedDB local (compatibilidad hacia atrás)
    if (isSupabaseEnabled && user) {
        return <SupabaseStorageProvider>{children}</SupabaseStorageProvider>;
    }

    return <StorageProvider>{children}</StorageProvider>;
};
```

### 4.4 Actualizar el editor page

En `src/pages/editor-page/editor-page.tsx` — envolver con el selector:
```tsx
// Cambiar StorageProvider por StorageProviderSelector
```

---

## FASE 5 — Variables de entorno y redeploy

### 5.1 Variables en Heroku

```bash
heroku config:set SUPABASE_URL=https://xxxx.supabase.co --app chatdb-alber
heroku config:set SUPABASE_ANON_KEY=eyJhbGci... --app chatdb-alber
```

### 5.2 Actualizar default.conf.template

Agregar las nuevas variables al template de nginx:
```nginx
# Agregar en location /config.js:
SUPABASE_URL: \"$SUPABASE_URL\",
SUPABASE_ANON_KEY: \"$SUPABASE_ANON_KEY\",
```

### 5.3 Actualizar entrypoint.sh

Agregar las variables al `envsubst`:
```bash
envsubst '${PORT} ${OPENAI_API_KEY} ... ${SUPABASE_URL} ${SUPABASE_ANON_KEY}' ...
```

### 5.4 Redeploy

```bash
# Rebuild con las nuevas variables de build
heroku container:push web --app chatdb-alber \
    --arg VITE_SUPABASE_URL=https://xxx.supabase.co \
    --arg VITE_SUPABASE_ANON_KEY=eyJhbGci... \
    --arg VITE_DISABLE_ANALYTICS=true

heroku container:release web --app chatdb-alber
```

### 5.5 Commit y push al repo

```bash
git add .
git commit -m "feat: supabase auth + cloud storage integration"
git push origin main
```

---

## 🗂️ Archivos a crear/modificar — Resumen

| Archivo | Acción | Descripción |
|---|---|---|
| `src/lib/supabase.ts` | **CREAR** | Cliente Supabase singleton |
| `src/lib/env.ts` | **MODIFICAR** | Agregar vars de Supabase |
| `src/lib/supabase-mappers.ts` | **CREAR** | Funciones de mapeo snake↔camel |
| `src/context/auth-context/auth-context.tsx` | **CREAR** | Context de autenticación |
| `src/context/storage-context/supabase-storage-provider.tsx` | **CREAR** | Provider con Supabase (~400 líneas) |
| `src/context/storage-context/storage-provider-selector.tsx` | **CREAR** | Selector Supabase vs Dexie |
| `src/pages/auth-page/auth-page.tsx` | **CREAR** | Página Login/Register |
| `src/components/protected-route/protected-route.tsx` | **CREAR** | HOC de ruta protegida |
| `src/router.tsx` | **MODIFICAR** | Agregar ruta `/auth` |
| `src/app.tsx` | **MODIFICAR** | Envolver con `<AuthProvider>` |
| `default.conf.template` | **MODIFICAR** | Agregar vars Supabase en config.js |
| `entrypoint.sh` | **MODIFICAR** | Agregar vars al envsubst |
| `.env.local` | **CREAR** (no al repo) | Credenciales locales |

---

## ⚠️ Decisiones de Diseño Importantes

### Modo dual (Supabase + IndexedDB)
El sistema funcionará en **dos modos**:
- **Sin Supabase configurado** → funciona igual que hoy con IndexedDB (nadie pierde nada)
- **Con Supabase configurado** → usa Supabase si el usuario está logueado

### Los IDs existentes de Dexie
Los diagramas en Dexie tienen IDs tipo `nanoid`. En Supabase también los
guardaremos como `TEXT PRIMARY KEY` (no UUID) para mantener compatibilidad.

### No migración automática de datos locales
Los diagramas que ya tienes en IndexedDB **no se migrarán automáticamente**.
Pero la app puede ofrecer un botón "Migrar mis datos a la nube" que:
1. Lee todos los diagramas del IndexedDB local
2. Los sube a Supabase
3. Borra los locales (opcional)

Esto se puede agregar como mejora posterior.

---

## ✅ Orden de Ejecución para el Agente

```
1. [MANUAL - tú] Crear proyecto Supabase → obtener URL y ANON_KEY
2. [MANUAL - tú] Ejecutar SQL de tablas y RLS en Supabase SQL Editor
3. [MANUAL - tú] Configurar Auth en Supabase (desactivar confirm email)
4. [AGENTE] pnpm add @supabase/supabase-js
5. [AGENTE] Crear src/lib/supabase.ts
6. [AGENTE] Modificar src/lib/env.ts
7. [AGENTE] Crear src/lib/supabase-mappers.ts
8. [AGENTE] Crear src/context/auth-context/auth-context.tsx
9. [AGENTE] Crear src/context/storage-context/supabase-storage-provider.tsx
10. [AGENTE] Crear src/context/storage-context/storage-provider-selector.tsx
11. [AGENTE] Crear src/pages/auth-page/auth-page.tsx
12. [AGENTE] Crear src/components/protected-route/protected-route.tsx
13. [AGENTE] Modificar src/router.tsx
14. [AGENTE] Modificar src/app.tsx
15. [AGENTE] Modificar default.conf.template + entrypoint.sh
16. [MANUAL - tú] Agregar vars a .env.local y probar en local con pnpm dev
17. [AGENTE] Redeploy en Heroku con las nuevas vars de build
18. [AGENTE] git commit + push
```
