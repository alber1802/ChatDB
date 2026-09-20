# Fase 8 — Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir 5 defectos reales de responsive encontrados en la
auditoría de código: (1) el editor en mobile no muestra el estado de
guardado/error del SyncEngine, (2) el clúster de utilidades del canvas
puede solaparse con la toolbar principal en mobile, (3) la toolbar del
canvas no tiene margen ni overflow controlado en viewports muy angostos,
(4) `DashboardHeader` puede desbordarse para cuentas admin en mobile, y
(5) el componente base `Table` no tiene contenedor de scroll horizontal.
Ninguno requiere rediseñar un layout — son ajustes puntuales de
breakpoints, offsets y overflow.

**Architecture:** Cuatro tareas independientes entre sí (no hay
solapamiento de archivos): (1) `top-navbar-mobile.tsx` gana el componente
`LastSaved` ya existente; (2) `canvas.tsx` y `toolbar.tsx` reciben un
offset vertical condicional y un límite de ancho/overflow,
respectivamente; (3) `dashboard-header.tsx` colapsa el texto del botón
"Admin Panel" en mobile; (4) `table.tsx` restaura su wrapper de scroll
horizontal comentado.

**Tech Stack:** React, Tailwind (tokens de Fase 1), React Flow
(`<Controls>`/paneles), Vitest + Testing Library (tests existentes, no se
agregan tests nuevos — ver nota más abajo).

**Spec:** `docs/superpowers/specs/2026-09-20-ui-redesign-fase8-responsive-design.md`

## Global Constraints

- No rediseñar la separación mobile/desktop del editor
  (`useBreakpoint('md')` se mantiene igual, breakpoint `768px`).
- No tocar `admin-layout.tsx` ni páginas bajo `/admin`.
- No tocar i18n, arquitectura, API ni SyncEngine.
- No tocar `import-database.tsx` ni `select-tables.tsx` — ya manejan
  mobile correctamente (auditado en el spec).
- No tocar el grid/list ni el toolbar del dashboard
  (`diagrams-dashboard.tsx`, `dashboard-toolbar.tsx`, `diagram-card.tsx`,
  `diagram-list-item.tsx`) — ya usan breakpoints correctamente.
- **Nota sobre testing**: las 4 tareas son ajustes de clases
  Tailwind/estilos inline y una adición de un componente ya existente sin
  lógica de negocio nueva — verificación vía `npx tsc -b`/`npx vite
  build` + inspección visual manual en varios anchos de viewport, mismo
  criterio que Fase 3. No se agregan tests unitarios nuevos porque no hay
  lógica nueva que testear (ni `LastSaved`, ni los offsets de
  `Controls`, ni el wrapper de `Table` cambian de comportamiento
  funcional, solo de layout).

---

## Task 1: Mostrar el estado de guardado del SyncEngine en el editor mobile

**Files:**
- Modify: `src/pages/editor-page/top-navbar/top-navbar-mobile.tsx`

**Interfaces:**
- Consumes: `LastSaved` (`src/pages/editor-page/top-navbar/last-saved.tsx`,
  ya existe, sin cambios — usa `useSyncStatus()` internamente).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Importar `LastSaved` en `top-navbar-mobile.tsx`**

El bloque de imports actual es:

```tsx
import React from 'react';
import ChartDBLogo from '@/assets/logo-2.png';
import { DiagramName } from './diagram-name';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Button } from '@/components/button/button';
import { useSidebar } from '@/components/sidebar/use-sidebar';
import { MenuIcon, LogOut } from 'lucide-react';

import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';
```

Reemplazarlo por (se agrega el import de `LastSaved`):

```tsx
import React from 'react';
import ChartDBLogo from '@/assets/logo-2.png';
import { DiagramName } from './diagram-name';
import { LastSaved } from './last-saved';
import { LanguageNav } from './language-nav/language-nav';
import { Menu } from './menu/menu';
import { Button } from '@/components/button/button';
import { useSidebar } from '@/components/sidebar/use-sidebar';
import { MenuIcon, LogOut } from 'lucide-react';

import { useAuth } from '@/context/auth-context/auth-context';
import { IS_SUPABASE_ENABLED } from '@/lib/env';
```

- [ ] **Step 2: Renderizar `<LastSaved />` en la fila derecha del header mobile**

El bloque actual es:

```tsx
                    <div className="flex items-center gap-2">
                        <LanguageNav />
                        {IS_SUPABASE_ENABLED && user && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground"
                                onClick={() => signOut()}
                                title="Cerrar Sesión"
                            >
                                <LogOut className="size-3.5" />
                            </Button>
                        )}
                    </div>
```

Reemplazarlo por (se agrega `<LastSaved />` como primer elemento de la
fila, antes de `LanguageNav`):

```tsx
                    <div className="flex items-center gap-2">
                        <LastSaved />
                        <LanguageNav />
                        {IS_SUPABASE_ENABLED && user && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground"
                                onClick={() => signOut()}
                                title="Cerrar Sesión"
                            >
                                <LogOut className="size-3.5" />
                            </Button>
                        )}
                    </div>
```

Nota para quien ejecute: `LastSaved` ya es un `Badge` autocontenido con
`whitespace-nowrap` (`last-saved.tsx:99,111,126,143`) — no necesita
ningún wrapper ni clase adicional para caber en esta fila, es el mismo
componente que ya convive con otros 5 elementos en la fila del
`TopNavbar` de desktop.

- [ ] **Step 3: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` para esta
verificación — su etapa de lint tuvo un problema de CRLF documentado en
la bitácora de Fase 1/infraestructura; aunque quedó resuelto para el
repo, `npx tsc -b && npx vite build` sigue siendo el gate más rápido y
suficiente para este cambio.)

- [ ] **Step 4: Verificación visual manual — anchos 375px / 768px / 1024px**

Run: `pnpm dev`, abrir un diagrama existente. Con las DevTools del
navegador en modo responsive:

- **375px** (mobile): confirmar que aparece un `Badge` de estado
  ("Guardado hace X", "Guardando…", "Sin conexión" o "Error al guardar")
  a la izquierda de los íconos de idioma/cerrar sesión, en la esquina
  superior derecha del header mobile. Editar un campo cualquiera y
  confirmar que el badge cambia a "Guardando…" y luego vuelve a
  "Guardado hace unos segundos".
- **768px** y **1024px**: confirmar que no cambió nada — a partir de
  `768px` (`isMd`) se usa `EditorDesktopLayout`/`TopNavbar`, no
  `TopNavbarMobile`, así que este cambio no es visible ahí.

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor-page/top-navbar/top-navbar-mobile.tsx
git commit -m "fix(editor): show SyncEngine save status in the mobile top navbar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Evitar el solapamiento del clúster de utilidades del canvas y acotar el ancho de la toolbar en mobile

**Files:**
- Modify: `src/pages/editor-page/canvas/canvas.tsx`
- Modify: `src/pages/editor-page/canvas/toolbar/toolbar.tsx`

**Interfaces:**
- Consumes: `isDesktop` (ya derivado de `useBreakpoint('md')` en
  `canvas.tsx:308`, sin cambios en su definición).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Empujar el clúster `top-left` hacia abajo en mobile (`canvas.tsx`)**

Ubicar este bloque exacto (clúster de snap-to-grid / resaltado de tipo /
aviso de solapamiento):

```tsx
                    <Controls
                        position="top-left"
                        showZoom={false}
                        showFitView={false}
                        showInteractive={false}
                        className="!shadow-none"
                    >
                        <div className="flex flex-col items-center gap-2 md:flex-row">
```

Reemplazarlo por (se agrega `style` con un offset condicional, mismo
patrón que el bloque `isLostInCanvas` de más abajo en el propio archivo):

```tsx
                    <Controls
                        position="top-left"
                        showZoom={false}
                        showFitView={false}
                        showInteractive={false}
                        className="!shadow-none"
                        style={{ top: isDesktop ? undefined : '64px' }}
                    >
                        <div className="flex flex-col items-center gap-2 md:flex-row">
```

Nota para quien ejecute: en desktop la toolbar principal vive en
`bottom-center` (`canvas.tsx:1928`), así que este clúster nunca colisiona
ahí — por eso `top: undefined` en desktop preserva el offset por defecto
de React Flow sin cambios. En mobile, la toolbar principal pasa a
`top-center` con una altura de `44px` (`toolbar.tsx:92`) más el offset
por defecto del panel (~`10px`-`16px` según la versión de React Flow) —
`64px` deja un margen visible sin acercarse demasiado al borde superior.

- [ ] **Step 2: Acotar el ancho de la toolbar y volverla deslizable en el peor caso (`toolbar.tsx`)**

Ubicar:

```tsx
    return (
        <div className="px-1">
            <Card className="h-[44px] bg-secondary p-0 shadow-none">
```

Reemplazarlo por:

```tsx
    return (
        <div className="px-1">
            <Card className="h-[44px] max-w-[calc(100vw-2rem)] overflow-x-auto bg-secondary p-0 shadow-none">
```

Nota para quien ejecute: en cualquier viewport ≥ ~360px este cambio no
tiene efecto visible — el ancho intrínseco de la toolbar (~330-340px con
todos los botones) es menor que `100vw - 2rem` a partir de ahí. Solo se
activa en dispositivos más angostos, donde antes los botones de los
extremos quedaban recortados por el `overflow-x-hidden` de
`editor-page.tsx:81` sin ningún indicio visual; ahora la toolbar completa
sigue siendo alcanzable con un swipe horizontal dentro de sí misma.

- [ ] **Step 3: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 4: Verificación visual manual — anchos 320px / 375px / 768px / 1024px**

Run: `pnpm dev`, abrir un diagrama con al menos dos tablas superpuestas
(para que aparezca el botón de aviso "tablas solapadas") y con "snap to
grid" visible (modo no-readonly). Con las DevTools en modo responsive:

- **320px** (peor caso, Android de gama baja): confirmar que la toolbar
  principal (centrada, arriba) ya no recorta ningún botón — debe poder
  hacerse scroll horizontal dentro de la propia toolbar para llegar a
  "Redo" si no entra todo. Confirmar que el clúster de utilidades
  (esquina superior izquierda) queda **debajo** de la toolbar principal,
  sin superposición visual ni de área clickeable.
- **375px**: misma verificación — a este ancho la toolbar ya entra
  completa sin necesidad de scroll, pero el offset del clúster
  top-left debe seguir evitando la superposición.
- **768px** y **1024px** (desktop, `EditorDesktopLayout`): confirmar que
  no cambió nada — la toolbar principal sigue en la parte inferior del
  canvas y el clúster de utilidades en la esquina superior izquierda, sin
  offset adicional (`isDesktop` = true → `top: undefined`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor-page/canvas/canvas.tsx src/pages/editor-page/canvas/toolbar/toolbar.tsx
git commit -m "fix(canvas): prevent mobile toolbar/utility-cluster overlap and clip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Colapsar el texto del botón "Admin Panel" en `DashboardHeader` para viewports angostos

**Files:**
- Modify: `src/pages/diagrams-dashboard/_components/dashboard-header.tsx`

**Interfaces:**
- Consumes: ninguna interfaz nueva.
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Envolver el texto del botón "Admin Panel" en un `<span>` oculto en mobile**

Ubicar:

```tsx
                {/* Admin Quick Action */}
                {isAdmin && isAdmin() && (
                    <Button
                        variant="outline"
                        className="h-8 gap-1.5 border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/10"
                        onClick={() => navigate('/admin')}
                    >
                        <ShieldCheck className="size-4" />
                        Admin Panel
                    </Button>
                )}
```

Reemplazarlo por:

```tsx
                {/* Admin Quick Action */}
                {isAdmin && isAdmin() && (
                    <Button
                        variant="outline"
                        className="h-8 gap-1.5 border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/30 hover:bg-primary/10"
                        onClick={() => navigate('/admin')}
                        title="Admin Panel"
                    >
                        <ShieldCheck className="size-4" />
                        <span className="hidden sm:inline">Admin Panel</span>
                    </Button>
                )}
```

Nota para quien ejecute: se agrega `title="Admin Panel"` para que el
botón siga siendo identificable (tooltip nativo del navegador) cuando
queda solo-ícono en mobile. El ícono `ShieldCheck` es el mismo que ya usa
la entrada equivalente del menú de perfil
(`dashboard-header.tsx:168-176`), así que el usuario ya lo asocia con
"administración".

- [ ] **Step 2: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 3: Verificación visual manual — anchos 375px / 768px / 1024px**

Run: `pnpm dev`, iniciar sesión con una cuenta con rol `admin` o
`super_admin`, ir al dashboard (`/`). Con las DevTools en modo
responsive:

- **375px**: confirmar que el header (`h-16`, una sola fila) ya no se
  desborda — el botón de admin debe verse como un ícono `ShieldCheck`
  solo (sin el texto "Admin Panel"), y el avatar/dropdown de perfil debe
  quedar completamente visible y clickeable dentro del viewport, sin
  recortarse contra el borde derecho.
- **768px** y **1024px**: confirmar que el botón vuelve a mostrar el
  texto completo "Admin Panel" junto al ícono (el `sm:inline` se activa a
  partir de `640px`, por debajo de ambos anchos de prueba).
- Repetir la prueba a 375px con una cuenta sin rol admin: confirmar que
  el header ya entraba bien antes de este cambio y sigue igual (este
  hallazgo era específico de cuentas admin/super_admin).

- [ ] **Step 4: Commit**

```bash
git add src/pages/diagrams-dashboard/_components/dashboard-header.tsx
git commit -m "fix(dashboard): collapse Admin Panel button to icon-only on narrow viewports

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Restaurar el contenedor de scroll horizontal del componente base `Table`

**Files:**
- Modify: `src/components/table/table.tsx`

**Interfaces:**
- Consumes: ninguna interfaz nueva.
- Produces: fix heredado automáticamente por todo consumidor de `Table`
  (auditado en este spec: `OpenDiagramDialog`,
  `src/dialogs/open-diagram-dialog/open-diagram-dialog.tsx:147-243`), sin
  que esos archivos necesiten cambios.

- [ ] **Step 1: Descomentar el wrapper `overflow-auto` alrededor de `<table>`**

Ubicar:

```tsx
const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    // <div className="relative w-full overflow-auto">
    <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
    />
    // </div>
));
```

Reemplazarlo por:

```tsx
const Table = React.forwardRef<
    HTMLTableElement,
    React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
        <table
            ref={ref}
            className={cn('w-full caption-bottom text-sm', className)}
            {...props}
        />
    </div>
));
```

Nota para quien ejecute: este wrapper es el patrón estándar de
shadcn/ui para `Table` — en algún momento quedó comentado en este fork
(posiblemente para depurar un layout puntual) y nunca se restauró. No
cambia nada en desktop (donde el contenido siempre entraba sin necesidad
de scroll); en mobile, si el contenido de una fila excede el ancho
disponible, ahora se genera scroll horizontal contenido dentro del
`<div>` en vez de que la tabla se desborde visualmente fuera de su
contenedor (por ejemplo, fuera de los bordes redondeados de un
`DialogContent`).

- [ ] **Step 2: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 3: Ejecutar la suite de tests existente**

Run: `pnpm test:ci` (o `pnpm test` si se prefiere modo watch)
Expected: sin regresiones — este es un cambio de layout puro (agrega un
`<div>` contenedor), no debería afectar ningún test que dependa de la
estructura de `TableHeader`/`TableBody`/`TableRow`/`TableCell` (esos
subcomponentes no cambian).

- [ ] **Step 4: Verificación visual manual — anchos 375px / 768px / 1024px**

Run: `pnpm dev`, abrir el diálogo "Abrir diagrama" (`OpenDiagramDialog`,
accesible desde `EditorSidebar` → "Browse" o el menú del editor) con al
menos 3-4 diagramas guardados. Con las DevTools en modo responsive:

- **375px**: confirmar que la tabla de diagramas ya no se desborda
  visualmente fuera del diálogo — si el contenido de las filas (nombre +
  fecha completa + cantidad de tablas + menú de acciones) no entra en el
  ancho disponible, debe aparecer scroll horizontal dentro de la tabla,
  contenido dentro de los bordes del diálogo, en vez de que las columnas
  de la derecha queden cortadas o superpuestas al borde del diálogo.
- **768px** y **1024px**: confirmar que no cambió nada — a estos anchos
  el diálogo ya usa `md:min-w-[80vw]`/`xl:min-w-[55vw]`
  (`open-diagram-dialog.tsx:136`) y el contenido siempre entró sin
  necesidad de scroll.
- Repetir la prueba abriendo cualquier otra pantalla que use el
  componente `Table` base, si hay alguna disponible en el entorno (por
  ejemplo, tablas de administración), para confirmar que heredan el fix
  sin haber sido tocadas directamente.

- [ ] **Step 5: Commit**

```bash
git add src/components/table/table.tsx
git commit -m "fix(table): restore horizontal scroll container for the base Table component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Cobertura del spec:** los 5 hallazgos del spec están cubiertos —
hallazgo 1 → Task 1; hallazgos 2 y 3 (mismo archivo/área, la toolbar y su
clúster vecino) → Task 2 en dos steps separados; hallazgo 4 → Task 3;
hallazgo 5 → Task 4. Ninguna tarea toca archivos fuera de la lista de
"Files" declarada, y ninguna tarea se superpone con otra (4 archivos
distintos en total: `top-navbar-mobile.tsx`, `canvas.tsx` +
`toolbar.tsx`, `dashboard-header.tsx`, `table.tsx`).

**Placeholders:** ninguno — todo el código citado en los diffs (imports
actuales de `top-navbar-mobile.tsx`, el bloque `Controls
position="top-left"` y la firma de `Toolbar` en `canvas.tsx`/`toolbar.tsx`,
el botón "Admin Panel" de `dashboard-header.tsx`, y el `Table` comentado
en `table.tsx`) fue leído del archivo real antes de escribir este plan,
línea por línea, no reconstruido de memoria.

**Consistencia de patrones:** el offset condicional de Task 2 Step 1
(`style={{ top: isDesktop ? undefined : '64px' }}`) reutiliza
literalmente el mismo patrón que ya existe en el propio `canvas.tsx` para
el botón "mostrar todo" cuando el usuario está perdido en el canvas
(`style={{ [isDesktop ? 'bottom' : 'top']: '70px' }}`), en vez de
introducir un mecanismo nuevo. El fix de Task 4 reutiliza el patrón
estándar de shadcn/ui para `Table` (el mismo que está comentado en el
archivo, no uno inventado). El colapso a ícono-solo de Task 3 reutiliza
el mismo patrón visual que ya usan el toggle de tema y el avatar en el
propio `DashboardHeader` (ambos ya eran ícono-solo antes de esta fase).

**Riesgo de regresión:** bajo en las 4 tareas — Task 1 agrega un
componente ya probado en otro contexto (desktop) sin modificarlo; Task 2
solo agrega un `style` condicional que es `undefined` en desktop (sin
efecto) y clases de `max-width`/`overflow` que no se activan por encima
de ~360px; Task 3 es un `<span className="hidden sm:inline">` que no
cambia el DOM en desktop; Task 4 agrega un `<div>` contenedor sin tocar
ningún subcomponente de `Table`, por lo que ningún selector CSS existente
que apunte a `table`/`thead`/`tbody`/`tr`/`td` se ve afectado.
