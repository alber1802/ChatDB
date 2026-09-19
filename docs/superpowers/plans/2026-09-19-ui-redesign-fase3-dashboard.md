# Fase 3 — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el fondo animado hardcodeado del dashboard por una superficie estática basada en tokens, agregar una sección "Recientes" y un atajo Ctrl+K/⌘K para la búsqueda, y tokenizar los colores de estado (destructivo/éxito/rol) que todavía usan clases Tailwind crudas en vez de los tokens de Fase 1.

**Architecture:** Dos tareas independientes: (1) las tres adiciones de UX (fondo, Recientes, atajo de teclado) tocan `dashboard-bg.css`, `diagrams-dashboard.tsx` y `dashboard-toolbar.tsx` respectivamente, sin superposición entre sí; (2) la limpieza de colores toca 4 archivos con el mismo tipo de cambio (reemplazo de clases Tailwind crudas por tokens semánticos).

**Tech Stack:** React, Tailwind (tokens de Fase 1), `react-hotkeys-hook` (ya dependencia, mismo patrón que `KeyboardShortcutsProvider`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-19-ui-redesign-fase3-dashboard-design.md`

## Global Constraints

- No tocar arquitectura, lógica de negocio, API ni SyncEngine.
- No traducir el dashboard a i18n.
- No agregar metadata de colaboradores/dueño a las tarjetas.
- No tocar `admin-layout.tsx` directamente — hereda el fix de `dashboard-bg.css` automáticamente por compartir la clase `.dashboard-animated-bg`.
- Los íconos de sol/luna del toggle de tema (`amber-500`/`slate-700`) no se tocan — no son colores de estado semántico.
- **Nota sobre testing**: Task 1 son cambios visuales/de interacción (CSS estático, una sección nueva de UI, un atajo de teclado) sin lógica de negocio nueva que amerite un test unitario aislado — verificación vía `npx tsc -b`/`npx vite build` + inspección visual manual. Task 2 es un reemplazo mecánico de clases sin lógica nueva — misma verificación.

---

## Task 1: Fondo estático, sección "Recientes" y atajo de búsqueda

**Files:**
- Modify: `src/dashboard-bg.css` (reemplazo completo, 698 → ~15 líneas)
- Modify: `src/pages/diagrams-dashboard/diagrams-dashboard.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/dashboard-toolbar.tsx`

**Interfaces:**
- Consumes: tokens `--background`/`--primary` (ya existen desde Fase 1); `getOperatingSystem()` de `@/lib/utils` (ya existe, usado en `src/context/keyboard-shortcuts-context/keyboard-shortcuts.ts`).
- Produces: ninguna interfaz nueva para otras tareas — `DiagramCard` se reusa tal cual, sin cambios a su API.

- [ ] **Step 1: Reemplazar `src/dashboard-bg.css` completo**

Reemplazar el archivo completo (las 698 líneas actuales: 40 declaraciones
`@property`, ambos bloques `@keyframes`, y ambas clases
`.dashboard-animated-bg`/`.dark .dashboard-animated-bg`) por:

```css
.dashboard-animated-bg {
    background-color: hsl(var(--background));
    background-image: radial-gradient(
        ellipse 80% 50% at 50% -10%,
        hsl(var(--primary) / 0.06),
        transparent 60%
    );
}

.dark .dashboard-animated-bg {
    background-color: hsl(var(--background));
    background-image: radial-gradient(
        ellipse 80% 50% at 50% -10%,
        hsl(var(--primary) / 0.1),
        transparent 60%
    );
}
```

No se cambia el nombre de la clase — `diagrams-dashboard.tsx` y
`admin-layout.tsx` siguen aplicando `dashboard-animated-bg` sin ningún
cambio en esos archivos.

- [ ] **Step 2: Agregar la sección "Recientes" en `diagrams-dashboard.tsx`**

Ubicar este bloque exacto (el cierre de `<DashboardToolbar />` seguido del
comentario `{/* Content Section */}`):

```tsx
                    <DashboardToolbar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedDBType={selectedDBType}
                        onDBTypeChange={setSelectedDBType}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onCreateNew={handleCreateNew}
                    />

                    {/* Content Section */}
                    <div className="mt-6">
```

Reemplazarlo por (se agrega el bloque "Recientes" entre el toolbar y la
sección de contenido, y un encabezado "Todos los diagramas" al principio
del `<div className="mt-6">`):

```tsx
                    <DashboardToolbar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedDBType={selectedDBType}
                        onDBTypeChange={setSelectedDBType}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        onCreateNew={handleCreateNew}
                    />

                    {!loading &&
                        !searchQuery &&
                        selectedDBType === 'all' &&
                        diagrams.length > 4 && (
                            <div className="mb-8 mt-6">
                                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Recientes
                                </h2>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                    {diagrams.slice(0, 4).map((diagram) => (
                                        <DiagramCard
                                            key={diagram.id}
                                            diagram={diagram}
                                            onDelete={handleDelete}
                                            onRename={handleRename}
                                            onDuplicate={handleDuplicate}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                    {/* Content Section */}
                    <div className="mt-6">
                        {!loading && (
                            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                Todos los diagramas
                            </h2>
                        )}
```

Nota: el `mt-6` que antes estaba solo en el `<div>` de "Content Section"
ahora también se necesita en el bloque de "Recientes" (que puede aparecer
antes) — por eso el bloque de "Recientes" lleva `mb-8 mt-6` y el `<div
className="mt-6">` de abajo se mantiene igual (cuando "Recientes" está
visible, el `mt-6` de "Content Section" simplemente se suma al `mb-8` del
bloque de arriba, dando un espaciado consistente en ambos casos).

- [ ] **Step 3: Agregar el atajo Ctrl+K/⌘K en `dashboard-toolbar.tsx`**

Agregar los imports necesarios. El bloque actual de imports es:

```tsx
import React from 'react';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';
import { LayoutGrid, List, Plus, Search, Database, X } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { DatabaseType } from '@/lib/domain/database-type';
```

Reemplazarlo por:

```tsx
import React, { useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Input } from '@/components/input/input';
import { Button } from '@/components/button/button';
import { LayoutGrid, List, Plus, Search, Database, X } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/select/select';
import { DatabaseType } from '@/lib/domain/database-type';
import { getOperatingSystem } from '@/lib/utils';
```

Dentro del componente, justo antes del `return`, agregar el ref y el hook:

```tsx
    const inputRef = useRef<HTMLInputElement>(null);
    const shortcutLabel =
        getOperatingSystem() === 'mac' ? '⌘K' : 'Ctrl+K';

    useHotkeys(
        'mod+k',
        (e) => {
            e.preventDefault();
            inputRef.current?.focus();
        },
        { preventDefault: true },
        []
    );
```

Reemplazar el bloque actual del input de búsqueda:

```tsx
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar diagramas por nombre..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-10 w-full px-9"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>
```

por:

```tsx
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Buscar diagramas por nombre..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="h-10 w-full px-9"
                    />
                    {searchQuery ? (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted"
                        >
                            <X className="size-3" />
                        </button>
                    ) : (
                        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {shortcutLabel}
                        </kbd>
                    )}
                </div>
```

- [ ] **Step 4: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` — su etapa de lint
falla por un problema de CRLF preexistente del entorno, documentado en el
ledger de Fase 1, no relacionado a este cambio.)

- [ ] **Step 5: Verificación visual manual**

Run: `pnpm dev`, abrir el dashboard. Confirmar: (1) el fondo ya no anima —
se ve una superficie sutil con un leve tinte azul arriba, en light y dark
mode; (2) si hay más de 4 diagramas y no hay búsqueda/filtro activo,
aparece "Recientes" con 4 tarjetas arriba de "Todos los diagramas" — si hay
4 o menos, "Recientes" no aparece; (3) al escribir en el buscador o
cambiar el filtro de tipo de BD, "Recientes" desaparece (solo se muestra
sin filtros activos); (4) presionar Ctrl+K (o ⌘K en Mac) enfoca el input
de búsqueda desde cualquier parte de la página; (5) el hint "Ctrl+K"/"⌘K"
dentro del input desaparece y es reemplazado por el botón "x" en cuanto se
escribe algo, y vuelve a aparecer al borrar el texto.

- [ ] **Step 6: Commit**

```bash
git add src/dashboard-bg.css src/pages/diagrams-dashboard/diagrams-dashboard.tsx src/pages/diagrams-dashboard/_components/dashboard-toolbar.tsx
git commit -m "feat(dashboard): replace animated background with static token-based surface, add Recientes section and Ctrl+K search shortcut"
```

---

## Task 2: Tokenizar colores de estado sin tokenizar

**Files:**
- Modify: `src/pages/diagrams-dashboard/_components/dashboard-header.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/diagram-card.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/diagram-list-item.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/profile-settings-dialog.tsx`

**Interfaces:**
- Consumes: tokens `--destructive`/`--info`/`--muted`/`--success` (ya existen desde Fase 1; `--info` y `--success` fueron agregados en esa fase junto con sus `-foreground`).
- Produces: nada que otra tarea consuma — cambio interno de clases, mismo comportamiento visual salvo el color.

- [ ] **Step 1: `dashboard-header.tsx` — badges de rol**

Reemplazar la función `getRoleBadgeInfo`:

```tsx
    const getRoleBadgeInfo = (roleId: string | null | undefined) => {
        switch (roleId) {
            case 'super_admin':
                return {
                    label: 'Super Admin',
                    className:
                        'bg-red-500/10 text-red-500 border border-red-500/20',
                };
            case 'admin':
                return {
                    label: 'Admin',
                    className:
                        'bg-blue-500/10 text-blue-500 border border-blue-500/20',
                };
            default:
                return {
                    label: 'User',
                    className:
                        'bg-green-500/10 text-green-500 border border-green-500/20',
                };
        }
    };
```

por:

```tsx
    const getRoleBadgeInfo = (roleId: string | null | undefined) => {
        switch (roleId) {
            case 'super_admin':
                return {
                    label: 'Super Admin',
                    className:
                        'bg-destructive/10 text-destructive border border-destructive/20',
                };
            case 'admin':
                return {
                    label: 'Admin',
                    className:
                        'bg-info/10 text-info border border-info/20',
                };
            default:
                return {
                    label: 'User',
                    className:
                        'bg-muted text-muted-foreground border border-border',
                };
        }
    };
```

- [ ] **Step 2: `dashboard-header.tsx` — item "Cerrar Sesión"**

```diff
                              <DropdownMenuItem
                                  onClick={handleSignOut}
-                                 className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
+                                 className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                              >
```

- [ ] **Step 3: `diagram-card.tsx` — item "Eliminar" y botón de confirmación**

```diff
                              <DropdownMenuItem
                                  onClick={() => setIsDeleteOpen(true)}
-                                 className="cursor-pointer gap-2 text-red-600 focus:bg-red-500/10 focus:text-red-600"
+                                 className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
```

```diff
                          <AlertDialogAction
                              onClick={async () => {
                                  await onDelete(diagram.id);
                                  setIsDeleteOpen(false);
                              }}
-                             className="bg-red-600 text-white hover:bg-red-700"
+                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
```

- [ ] **Step 4: `diagram-list-item.tsx` — item "Eliminar" y botón de confirmación**

Mismo patrón exacto que el Step 3 (el archivo tiene el mismo código
duplicado):

```diff
                              <DropdownMenuItem
                                  onClick={() => setIsDeleteOpen(true)}
-                                 className="cursor-pointer gap-2 text-red-600 focus:bg-red-500/10 focus:text-red-600"
+                                 className="cursor-pointer gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
```

```diff
                          <AlertDialogAction
                              onClick={async () => {
                                  await onDelete(diagram.id);
                                  setIsDeleteOpen(false);
                              }}
-                             className="bg-red-600 text-white hover:bg-red-700"
+                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
```

- [ ] **Step 5: `profile-settings-dialog.tsx` — mensajes de éxito (2 ocurrencias)**

Primera ocurrencia (pestaña de perfil):

```diff
                          {profileSuccess && (
-                             <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
+                             <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
                                  <CheckCircle2 className="size-4 flex-shrink-0" />
                                  <span>¡Perfil actualizado con éxito!</span>
                              </div>
                          )}
```

Segunda ocurrencia (pestaña de seguridad):

```diff
                          {passwordSuccess && (
-                             <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
+                             <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
                                  <CheckCircle2 className="size-4 flex-shrink-0" />
                                  <span>
                                      ¡Contraseña actualizada con éxito!
                                  </span>
                              </div>
                          )}
```

(Nota para quien ejecute: el bloque de error inmediatamente después de cada
uno de estos ya usa `border-destructive/20 bg-destructive/10
text-destructive` — el cambio de arriba deja el bloque de éxito con la
misma estructura de clases que su par de error, solo que con el token
`success` en vez de `destructive`.)

- [ ] **Step 6: Confirmar que no queda ningún color crudo de este tipo**

Run: `grep -rn "red-[0-9]\|blue-[0-9]\|green-[0-9]\|emerald-[0-9]" src/pages/diagrams-dashboard`
Expected: sin resultados (los íconos sol/luna `amber-500`/`slate-700` de
`dashboard-header.tsx` no matchean este patrón, así que no aparecen — están
fuera de alcance intencionalmente).

- [ ] **Step 7: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 8: Verificación visual manual**

Run: `pnpm dev`. Como admin: confirmar que el badge de rol se ve azul
(`info`) o rojo (`destructive` para super_admin) según corresponda, y que
un usuario normal ve un badge neutro/gris. Abrir el menú "..." de una
tarjeta de diagrama y confirmar que "Eliminar" se ve rojo (`destructive`)
igual que antes. Confirmar el diálogo de confirmación de borrado (botón
rojo). Abrir "Configuración" del perfil, cambiar el nombre y guardar:
confirmar que el mensaje de éxito se ve verde (`success`) en vez del verde
esmeralda anterior — visualmente casi idéntico, ahora usando el token.

- [ ] **Step 9: Commit**

```bash
git add src/pages/diagrams-dashboard/_components/dashboard-header.tsx src/pages/diagrams-dashboard/_components/diagram-card.tsx src/pages/diagrams-dashboard/_components/diagram-list-item.tsx src/pages/diagrams-dashboard/_components/profile-settings-dialog.tsx
git commit -m "fix(dashboard): tokenize remaining raw destructive/info/success colors"
```

---

## Self-Review

**Cobertura del spec:** fondo estático ✅ (Task 1 Step 1), sección
Recientes ✅ (Task 1 Step 2), atajo Ctrl+K/⌘K ✅ (Task 1 Step 3), tabla
completa de colores a tokenizar ✅ (Task 2, cada fila del spec tiene su
propio step). Los íconos sol/luna quedan explícitamente sin tocar, como
pide el spec.

**Placeholders:** ninguno — todo el código de ambas tareas fue leído del
archivo real antes de escribir este plan (incluida la confirmación de que
`bg-destructive/20 bg-destructive/10 text-destructive` ya es el patrón
usado en el bloque de error hermano de `profile-settings-dialog.tsx`, y que
`'mod'` es una palabra clave reservada soportada por la versión instalada
de `react-hotkeys-hook`, verificado contra el código fuente del paquete).

**Consistencia de tipos/nombres:** `DiagramCard` se usa con la misma firma
(`diagram`, `onDelete`, `onRename`, `onDuplicate`) que ya tenía antes de
esta fase, tanto en el bloque "Recientes" como en el bloque existente. El
`inputRef`/`shortcutLabel` de Task 1 Step 3 se usan consistentemente entre
su declaración y el JSX del input.
