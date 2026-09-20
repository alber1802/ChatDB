# Fase 6 — Microinteracciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulir 5 inconsistencias reales de microinteracción encontradas en
la auditoría de código: el indicador de estado del SyncEngine cambia de
golpe entre "Guardando…"/"Sin conexión"/"Error"/"Guardado"; el componente
base `Button` no da ningún feedback de presión mientras 4 sitios de uso lo
agregan a mano con valores distintos; los nodos del canvas (tabla/área/
nota) cambian de borde/sombra sin transición y no dan ninguna señal visual
al arrastrarlos; las filas de "Notas" y "Áreas" del side panel no
transicionan su hover mientras sus 4 pares (Tablas/Relaciones/
Dependencias/Tipos personalizados) sí lo hacen gratis por heredarlo del
componente `AccordionTrigger`; y dos tarjetas de páginas públicas
(`template-card`, `example-card`) escalan al hover de forma inconsistente
con el resto de la app.

**Architecture:** 4 tareas independientes entre sí, cada una tocando un
grupo de archivos sin superposición: (1) `last-saved.tsx` en solitario,
usando `motion/react` para un crossfade de opacidad; (2)
`button-variants.tsx` + 4 sitios de uso que hoy duplican `active:scale` a
mano; (3) los 3 tipos de nodo del canvas (`table-node.tsx`,
`area-node.tsx`, `note-node.tsx`), mismo patrón de cambio en los 3; (4) 4
archivos de CSS puro sin relación funcional entre sí (2 filas de lista del
side panel, 2 tarjetas de páginas públicas) agrupados porque son el mismo
tipo de cambio mecánico (agregar/quitar una clase de Tailwind).

**Tech Stack:** React, Tailwind, `motion` (ya dependencia desde Fase 1,
paquete `motion/react`), Vitest + Testing Library (solo para no romper el
test existente de Task 1).

**Spec:** `docs/superpowers/specs/2026-09-20-ui-redesign-fase6-microinteracciones-design.md`

## Global Constraints

- No tocar color (ya resuelto en Fases 1 y 4) — todos los cambios de este
  plan son de `transition`/`duration`/`ease`/`scale`/`shadow`, nunca de
  `bg-*`/`text-*`/`border-*` con un color distinto al que ya estaba.
- No reintroducir `framer-motion` como dependencia directa — todo lo que
  necesite curvas de animación usa `motion/react` (ya instalado).
- No agregar transición a propiedades que React Flow anima en vivo
  (`transform`, `width`, `height` de nodos durante drag/resize) — solo
  `border-color`/`box-shadow`/`background-color`/`opacity` según cada caso.
- No tocar accesibilidad, responsive ni performance — fases separadas.
- **Nota sobre testing**: Tasks 2, 3 y 4 son cambios de clases CSS/Tailwind
  sin lógica nueva — verificación vía `npx tsc -b`/`npx vite build` +
  inspección visual manual, sin test unitario nuevo (mismo criterio que la
  Task 1 de Fase 3). Task 1 sí reestructura el `return` de un componente
  (aunque sin cambiar su lógica de negocio), así que además de build corre
  el test existente `last-saved.test.tsx` para confirmar que sigue en
  verde.

---

## Task 1: Crossfade del indicador de estado del SyncEngine

**Files:**
- Modify: `src/pages/editor-page/top-navbar/last-saved.tsx`

**Interfaces:**
- Consumes: `motion`/`AnimatePresence` de `motion/react` (ya dependencia,
  mismo patrón de import que `auth-card.tsx:24`,
  `waitlist-modal.tsx:2`, `tree-view.tsx:8`); `useSyncStatus()` (sin
  cambios en su contrato — sigue devolviendo `{ status, errorMessage,
  retry }`).
- Produces: ninguna interfaz nueva — `LastSaved` sigue sin props y sin
  cambiar lo que renderiza en cada estado, solo cómo transiciona entre
  ellos.

- [ ] **Step 1: Agregar el import de `motion/react`**

El bloque actual de imports (líneas 1-14) es:

```tsx
import React, { useEffect, useState } from 'react';
import TimeAgo from 'timeago-react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { Badge } from '@/components/badge/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useTranslation } from 'react-i18next';
import type { LocaleFunc } from 'timeago.js';
import { register as registerLocale } from 'timeago.js';
import { Save, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
```

Reemplazarlo por (una sola línea nueva, después de `React`):

```tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TimeAgo from 'timeago-react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { Badge } from '@/components/badge/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/tooltip/tooltip';
import { useTranslation } from 'react-i18next';
import type { LocaleFunc } from 'timeago.js';
import { register as registerLocale } from 'timeago.js';
import { Save, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
```

- [ ] **Step 2: Reemplazar los 4 `return` tempranos por un `content` + un único `return` con `AnimatePresence`**

El bloque actual (líneas 95-157, desde el primer `if (status === 'saving')`
hasta el cierre del componente) es:

```tsx
    if (status === 'saving') {
        return (
            <Badge
                variant="secondary"
                className="flex gap-1.5 whitespace-nowrap"
            >
                <Loader2 size={16} className="animate-spin" />
                <span>Guardando…</span>
            </Badge>
        );
    }

    if (status === 'offline') {
        return (
            <Badge
                variant="secondary"
                className="flex gap-1.5 whitespace-nowrap"
            >
                <WifiOff size={16} />
                <span>Sin conexión</span>
            </Badge>
        );
    }

    if (status === 'error') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button onClick={retry} type="button">
                        <Badge
                            variant="destructive"
                            className="flex gap-1.5 whitespace-nowrap"
                        >
                            <AlertTriangle size={16} />
                            <span>Error al guardar</span>
                        </Badge>
                    </button>
                </TooltipTrigger>
                <TooltipContent>{errorMessage ?? 'Reintentar'}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger>
                <Badge
                    variant="secondary"
                    className="flex gap-1.5 whitespace-nowrap"
                >
                    <Save size={16} />
                    <TimeAgo
                        datetime={currentDiagram.updatedAt}
                        locale={language}
                    />
                </Badge>
            </TooltipTrigger>
            <TooltipContent>
                {currentDiagram.updatedAt.toLocaleString()}
            </TooltipContent>
        </Tooltip>
    );
};
```

Reemplazarlo por:

```tsx
    let content: React.ReactNode;

    if (status === 'saving') {
        content = (
            <Badge
                variant="secondary"
                className="flex gap-1.5 whitespace-nowrap"
            >
                <Loader2 size={16} className="animate-spin" />
                <span>Guardando…</span>
            </Badge>
        );
    } else if (status === 'offline') {
        content = (
            <Badge
                variant="secondary"
                className="flex gap-1.5 whitespace-nowrap"
            >
                <WifiOff size={16} />
                <span>Sin conexión</span>
            </Badge>
        );
    } else if (status === 'error') {
        content = (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button onClick={retry} type="button">
                        <Badge
                            variant="destructive"
                            className="flex gap-1.5 whitespace-nowrap"
                        >
                            <AlertTriangle size={16} />
                            <span>Error al guardar</span>
                        </Badge>
                    </button>
                </TooltipTrigger>
                <TooltipContent>{errorMessage ?? 'Reintentar'}</TooltipContent>
            </Tooltip>
        );
    } else {
        content = (
            <Tooltip>
                <TooltipTrigger>
                    <Badge
                        variant="secondary"
                        className="flex gap-1.5 whitespace-nowrap"
                    >
                        <Save size={16} />
                        <TimeAgo
                            datetime={currentDiagram.updatedAt}
                            locale={language}
                        />
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    {currentDiagram.updatedAt.toLocaleString()}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={status}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
            >
                {content}
            </motion.div>
        </AnimatePresence>
    );
};
```

Nota: `mode="wait"` espera a que el badge saliente termine su `exit` antes
de montar el entrante — necesario porque el ancho del badge cambia entre
estados (p. ej. "Guardando…" vs. la fecha relativa) y ambos badges están en
flujo normal (`flex`, sin `position: absolute`), así que tenerlos montados
a la vez produciría un salto de layout visible. `initial={false}` evita que
el primer render de la página (montaje inicial de `LastSaved`) también
haga un fade-in — solo transicionan los cambios de estado posteriores.

- [ ] **Step 3: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` — su etapa de lint
falla por un problema de CRLF preexistente del entorno, documentado en el
ledger de Fase 1, no relacionado a este cambio.)

- [ ] **Step 4: Correr el test existente**

Run: `npx vitest run src/pages/editor-page/top-navbar/last-saved.test.tsx`
Expected: los 3 tests (`shows "Guardando…" while saving`, `shows "Sin
conexión" when offline`, `shows "Error al guardar" on error`) siguen en
verde sin ninguna modificación al archivo de test — cada test hace un
`render()` nuevo con un `status` fijo, así que el texto esperado está en
el DOM en el primer render independientemente de la animación de entrada
de `motion` (jsdom no ejecuta frames de animación, pero el nodo ya está
montado con `opacity: 0` inicial, que sigue siendo parte del DOM y
matcheable por `getByText`).

- [ ] **Step 5: Verificación visual manual**

Run: `pnpm dev`, abrir un diagrama y editar algo (mover una tabla, renombrar
un campo). Confirmar: (1) el badge "Guardando…" con el ícono girando
aparece con un fundido suave (no un salto brusco) al empezar a escribir/
mover algo; (2) al terminar de guardar, el badge "Guardando…" se desvanece
y el badge con la fecha relativa aparece con el mismo fundido, sin que se
vean los dos superpuestos ni un hueco vacío intermedio perceptible; (3)
para probar el estado de error, cortar la conexión de red (DevTools →
Network → Offline) y hacer un cambio: el badge "Sin conexión" debe
aparecer con el mismo fundido; (4) reconectar la red y confirmar que vuelve
a "Guardando…" → estado guardado con la misma transición suave en ambos
sentidos. La sensación esperada: el indicador "respira" entre estados en
vez de parpadear.

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor-page/top-navbar/last-saved.tsx
git commit -m "feat(sync-status): crossfade between saving/offline/error/saved badges instead of an abrupt swap"
```

---

## Task 2: Feedback de presión consistente en el componente base `Button`

**Files:**
- Modify: `src/components/button/button-variants.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/dashboard-toolbar.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/empty-dashboard.tsx`
- Modify: `src/pages/auth-page/auth-card.tsx`
- Modify: `src/pages/auth-page/waitlist-modal.tsx`

**Interfaces:**
- Consumes: `cva` (ya dependencia, sin cambios de API).
- Produces: `buttonVariants` sigue exportando la misma firma
  (`variant`/`size`) — ningún consumidor de `Button` necesita cambiar
  props. `admin-sidebar.tsx:123` usa un `<button>` crudo (no
  `buttonVariants`) y queda explícitamente fuera de este task.

- [ ] **Step 1: `button-variants.tsx` — agregar `active:scale-[0.98]` y `transition-all duration-150`**

El archivo completo actual es:

```tsx
import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow hover:bg-primary/90',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
                outline:
                    'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
                secondary:
                    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-10 rounded-md px-8',
                icon: 'size-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);
```

Reemplazarlo por:

```tsx
import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow hover:bg-primary/90 active:scale-[0.98]',
                destructive:
                    'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]',
                outline:
                    'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
                secondary:
                    'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-10 rounded-md px-8',
                icon: 'size-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);
```

Nota: `ghost` y `link` quedan sin `active:scale` a propósito (ver
justificación en el spec, hallazgo #2) — son las variantes de los botones
de ícono chicos y densos (toolbar del canvas, filas de listas, menús)
donde escalar se sentiría fuera de lugar.

- [ ] **Step 2: `dashboard-toolbar.tsx` — quitar el `active:scale-95` duplicado**

```diff
                 <Button
                     onClick={onCreateNew}
-                    className="h-10 gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-transform active:scale-95"
+                    className="h-10 gap-1.5 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow"
                 >
```

- [ ] **Step 3: `empty-dashboard.tsx` — quitar el `active:scale-95` duplicado**

```diff
             <Button
                 onClick={onCreateNew}
-                className="mt-6 gap-2 bg-primary px-5 font-semibold text-primary-foreground shadow transition-all duration-200 hover:shadow-md active:scale-95"
+                className="mt-6 gap-2 bg-primary px-5 font-semibold text-primary-foreground shadow transition-all duration-200 hover:shadow-md"
             >
```

Nota: se conserva `transition-all duration-200 hover:shadow-md` — es un
efecto de hover distinto (la sombra crece al pasar el mouse), no el
feedback de presión que ahora aporta el componente base.

- [ ] **Step 4: `auth-card.tsx` — quitar el `active:scale-[0.98]` duplicado**

```diff
                                         <Button
                                             type="submit"
                                             disabled={submitting || isLockedOut}
-                                            className="mt-2 h-10 w-full transform border-none bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:from-blue-500 hover:via-indigo-500 hover:to-emerald-500 hover:shadow-indigo-500/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
+                                            className="mt-2 h-10 w-full transform border-none bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:from-blue-500 hover:via-indigo-500 hover:to-emerald-500 hover:shadow-indigo-500/35 disabled:cursor-not-allowed disabled:opacity-60"
                                         >
```

- [ ] **Step 5: `waitlist-modal.tsx` — quitar el `active:scale-[0.98]` duplicado**

```diff
                                                 <Button
                                                     type="submit"
                                                     disabled={loading}
-                                                    className="h-10 w-full border-none bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 hover:shadow-indigo-500/35 active:scale-[0.98]"
+                                                    className="h-10 w-full border-none bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 hover:shadow-indigo-500/35"
                                                 >
```

- [ ] **Step 6: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 7: Verificación visual manual**

Run: `pnpm dev`. Confirmar, haciendo click y manteniendo presionado (o
usando las devtools para simular `:active`) en al menos 4 botones
distintos que antes no tenían ningún feedback de presión: el botón
"Agregar tabla" de la toolbar del canvas (variant `default`), el botón
"Eliminar" de un diálogo de confirmación (variant `destructive`), un botón
`outline` de cualquier diálogo, y un botón `secondary`. Los 4 deben
achicarse levemente (2%) al mantener presionado el mouse, con una
transición suave (no un salto). Confirmar también que el CTA "Nuevo
Diagrama" del dashboard y el botón de submit de login se siguen sintiendo
igual que antes (ahora al 98% en vez de 95%/98% mezclados, una diferencia
imperceptible a simple vista). Confirmar que los botones de ícono tipo
`ghost` (p. ej. el botón de colapsar el sidebar) **no** escalan al
presionar — solo cambian de color de fondo, como antes.

- [ ] **Step 8: Commit**

```bash
git add src/components/button/button-variants.tsx src/pages/diagrams-dashboard/_components/dashboard-toolbar.tsx src/pages/diagrams-dashboard/_components/empty-dashboard.tsx src/pages/auth-page/auth-card.tsx src/pages/auth-page/waitlist-modal.tsx
git commit -m "feat(button): move press feedback into the base Button component, standardize on active:scale-[0.98]"
```

---

## Task 3: Feedback de selección/hover/arrastre en los nodos del canvas

**Files:**
- Modify: `src/pages/editor-page/canvas/table-node/table-node.tsx`
- Modify: `src/pages/editor-page/canvas/area-node/area-node.tsx`
- Modify: `src/pages/editor-page/canvas/note-node/note-node.tsx`

**Interfaces:**
- Consumes: la prop `dragging` que React Flow ya pasa a los 3 componentes
  (ya desestructurada en los 3 — sin cambios de firma).
- Produces: nada que otra tarea consuma — solo clases CSS y una entrada
  nueva en arrays de dependencias de `useMemo` ya existentes.

- [ ] **Step 1: `table-node.tsx` — transición de borde/sombra + elevación al arrastrar**

El bloque actual (dentro de `tableClassName`) es:

```tsx
        const tableClassName = useMemo(
            () =>
                cn(
                    'flex w-full flex-col border-2 bg-slate-50 dark:bg-slate-950 rounded-lg shadow-sm transition-transform duration-300',
                    table.isView ? 'border-dashed' : '',
                    selected || isTarget || isPartOfCreatingRelationship
                        ? 'border-primary'
                        : 'border-slate-500 dark:border-slate-700',
```

Reemplazarlo por:

```tsx
        const tableClassName = useMemo(
            () =>
                cn(
                    'flex w-full flex-col border-2 bg-slate-50 dark:bg-slate-950 rounded-lg transition-[border-color,box-shadow] duration-150',
                    dragging ? 'shadow-lg' : 'shadow-sm',
                    table.isView ? 'border-dashed' : '',
                    selected || isTarget || isPartOfCreatingRelationship
                        ? 'border-primary'
                        : 'border-slate-500 dark:border-slate-700',
```

(El resto del `cn(...)` — los bloques de `isOverlapping`, `highlightOverlappingTables`,
`hasHighlightedCustomType`, `highlightTable`, `isDiffTableChanged`,
`isDiffNewTable`, `isDiffTableRemoved`/`editTableMode` — no cambia.)

Y el array de dependencias del mismo `useMemo` (la parte final):

```tsx
            [
                selected,
                isOverlapping,
                highlightOverlappingTables,
```

pasa a:

```tsx
            [
                selected,
                dragging,
                isOverlapping,
                highlightOverlappingTables,
```

Nota: se quita `transition-transform duration-300` porque era código
muerto para este propósito — nada en este `div` cambia `transform` vía
clase o estilo inline (las animaciones `animate-scale`/`animate-scale-2`
usadas más abajo en el mismo `cn(...)` son animaciones CSS con su propio
timing en `tailwind.config.js`, no gobernadas por la propiedad
`transition`). El nuevo `transition-[border-color,box-shadow]` cubre el
cambio real que hoy ocurre de golpe: el borde al seleccionar/hacer hover, y
el anillo de "tablas solapadas".

- [ ] **Step 2: `area-node.tsx` — mismo patrón**

El bloque actual (`containerClassName`) es:

```tsx
        const containerClassName = useMemo(
            () =>
                cn(
                    'relative flex h-full flex-col rounded-md border-2 shadow-sm',
                    selected ? 'border-primary' : 'border-transparent',
                    isDiffNewArea
                        ? 'outline outline-[3px] outline-green-500 dark:outline-green-900 outline-offset-[5px]'
                        : '',
                    isDiffAreaRemoved
                        ? 'outline outline-[3px] outline-red-500 dark:outline-red-900 outline-offset-[5px]'
                        : ''
                ),
            [selected, isDiffNewArea, isDiffAreaRemoved]
        );
```

Reemplazarlo por:

```tsx
        const containerClassName = useMemo(
            () =>
                cn(
                    'relative flex h-full flex-col rounded-md border-2 transition-[border-color,box-shadow] duration-150',
                    dragging ? 'shadow-lg' : 'shadow-sm',
                    selected ? 'border-primary' : 'border-transparent',
                    isDiffNewArea
                        ? 'outline outline-[3px] outline-green-500 dark:outline-green-900 outline-offset-[5px]'
                        : '',
                    isDiffAreaRemoved
                        ? 'outline outline-[3px] outline-red-500 dark:outline-red-900 outline-offset-[5px]'
                        : ''
                ),
            [selected, dragging, isDiffNewArea, isDiffAreaRemoved]
        );
```

- [ ] **Step 3: `note-node.tsx` — mismo patrón (sin sombra base previa)**

El bloque actual es:

```tsx
    return (
        <div
            className={cn(
                'flex h-full flex-col overflow-hidden rounded-[6px] border',
                selected
                    ? 'border-primary'
                    : 'border-slate-500 dark:border-slate-600'
            )}
```

Reemplazarlo por:

```tsx
    return (
        <div
            className={cn(
                'flex h-full flex-col overflow-hidden rounded-[6px] border transition-[border-color,box-shadow] duration-150',
                dragging ? 'shadow-lg' : '',
                selected
                    ? 'border-primary'
                    : 'border-slate-500 dark:border-slate-600'
            )}
```

Nota: a diferencia de tabla/área, las notas no tenían ninguna sombra base
(`shadow-sm`) antes de esta fase, así que acá se agrega sombra únicamente
mientras se arrastra, y se desvanece de vuelta a "sin sombra" al soltar —
mismo criterio de elevación, sin alterar la apariencia en reposo de las
notas (fuera de alcance tocar su apariencia estática, que es un tema de
color/diseño de Fase 1, no de esta fase).

- [ ] **Step 4: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 5: Verificación visual manual**

Run: `pnpm dev`, abrir un diagrama con al menos 2 tablas, 1 área y 1 nota.
Confirmar: (1) al seleccionar/deseleccionar una tabla, área o nota (click
en ella / click en el fondo del canvas), el borde cambia de color con un
fundido suave de ~150ms en vez de un salto instantáneo; (2) al empezar a
arrastrar una tabla, la sombra crece levemente (se ve "levantada" de la
superficie) y, al soltarla, la sombra vuelve a su tamaño normal con la
misma suavidad — sin salto brusco en ningún punto del gesto; (3) repetir
el mismo arrastre con un área y con una nota — la nota, que no tiene
sombra en reposo, debe mostrar una sombra sutil solo mientras se arrastra
y perderla por completo al soltar; (4) confirmar que el resize de un área
(arrastrando sus manijas) sigue sintiéndose igual de directo que antes —
sin ningún lag ni "arrastre de goma" nuevo (la transición solo cubre
`border-color`/`box-shadow`, nunca `width`/`height`, así que el resize no
debería verse afectado en absoluto); (5) confirmar que el anillo de
"tablas solapadas" (arrastrar una tabla encima de otra) también aparece
con el mismo fundido en vez de aparecer de golpe.

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor-page/canvas/table-node/table-node.tsx src/pages/editor-page/canvas/area-node/area-node.tsx src/pages/editor-page/canvas/note-node/note-node.tsx
git commit -m "feat(canvas): transition border/shadow on select and hover, add a subtle lift shadow while dragging table/area/note nodes"
```

---

## Task 4: Hover consistente en listas del side panel y limpieza de `hover:scale` en tarjetas públicas

**Files:**
- Modify: `src/pages/editor-page/side-panel/visuals-section/notes-tab/notes-list/note-list-item/note-list-item.tsx`
- Modify: `src/pages/editor-page/side-panel/visuals-section/areas-tab/areas-list/area-list-item/area-list-item.tsx`
- Modify: `src/pages/templates-page/template-card/template-card.tsx`
- Modify: `src/pages/examples-page/example-card.tsx`

**Interfaces:**
- Consumes: ninguna nueva.
- Produces: nada que otra tarea consuma — cambios de clases aislados por
  archivo.

- [ ] **Step 1: `note-list-item.tsx` — agregar transición al hover**

```diff
         return (
             <div
-                className="w-full rounded-md border border-border hover:bg-accent/5"
+                className="w-full rounded-md border border-border transition-colors duration-200 hover:bg-accent/5"
                 ref={combinedRef}
```

- [ ] **Step 2: `area-list-item.tsx` — agregar transición al hover**

```diff
         return (
             <div
-                className="w-full rounded-md border border-border hover:bg-accent/5"
+                className="w-full rounded-md border border-border transition-colors duration-200 hover:bg-accent/5"
                 ref={combinedRef}
```

- [ ] **Step 3: `template-card.tsx` — quitar `hover:scale-[102%]`**

```diff
             <div className="flex h-80 w-full cursor-pointer flex-col rounded-lg border-2 border-slate-500 bg-slate-50 shadow-sm transition duration-300 ease-in-out hover:scale-[102%] hover:border-primary dark:border-slate-700 dark:bg-slate-950">
+            <div className="flex h-80 w-full cursor-pointer flex-col rounded-lg border-2 border-slate-500 bg-slate-50 shadow-sm transition duration-300 ease-in-out hover:border-primary dark:border-slate-700 dark:bg-slate-950">
```

(Diff de una sola línea: se quita únicamente el token `hover:scale-[102%]`
de la cadena de clases; el resto de la línea queda idéntico.)

- [ ] **Step 4: `example-card.tsx` — quitar `hover:scale-[102%]`**

```diff
             className="flex h-96 w-full cursor-pointer flex-col rounded-xl border-2 border-slate-500 bg-slate-50 shadow-sm transition duration-300 ease-in-out hover:scale-[102%] hover:border-primary dark:border-slate-700 dark:bg-slate-950"
+            className="flex h-96 w-full cursor-pointer flex-col rounded-xl border-2 border-slate-500 bg-slate-50 shadow-sm transition duration-300 ease-in-out hover:border-primary dark:border-slate-700 dark:bg-slate-950"
```

- [ ] **Step 5: Confirmar que no queda ningún `hover:scale` fuera de los ya revisados**

Run: `grep -rn "hover:scale-" src`
Expected: solo quedan `editor-desktop-layout.tsx` (botón circular de
colapsar sidebar, `hover:scale-110`) y `relationship-edge.tsx` (botón
circular de eliminar relación, `hover:scale-110`) — ambos son botones de
ícono circulares pequeños fuera de alcance de este hallazgo (no son
tarjetas de un grid de opciones, son controles puntuales, y ya son
consistentes entre sí en el mismo valor `110`). `auth-card.tsx` conserva
`group-hover:scale-110` en un ícono `Sparkles` decorativo dentro de un
botón — tampoco es una tarjeta, fuera de alcance.

- [ ] **Step 6: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 7: Verificación visual manual**

Run: `pnpm dev`. En el editor, abrir el side panel y pasar el mouse sobre
una fila de la lista de Notas y sobre una fila de la lista de Áreas:
confirmar que el fondo aparece con un fundido suave, igual de suave que al
pasar el mouse sobre una fila de Tablas o de Relaciones (comparar una al
lado de la otra cambiando de sección en el side panel). Luego abrir
`/templates` y `/examples` (páginas públicas) y pasar el mouse sobre varias
tarjetas: confirmar que ya no se agrandan al hover, solo cambian el color
del borde — comparar visualmente contra una tarjeta de diagrama en el
dashboard (`/dashboard`) para confirmar que ambas familias de tarjetas
ahora comunican "interactivo" de la misma forma (borde + sombra, sin
movimiento).

- [ ] **Step 8: Commit**

```bash
git add src/pages/editor-page/side-panel/visuals-section/notes-tab/notes-list/note-list-item/note-list-item.tsx src/pages/editor-page/side-panel/visuals-section/areas-tab/areas-list/area-list-item/area-list-item.tsx src/pages/templates-page/template-card/template-card.tsx src/pages/examples-page/example-card.tsx
git commit -m "fix(microinteractions): transition hover on notes/areas list rows, remove inconsistent hover:scale from public template/example cards"
```

---

## Self-Review

**Cobertura del spec:** los 5 hallazgos numerados del spec tienen su tarea
o step correspondiente — #1 → Task 1, #2 → Task 2, #3 → Task 3, #4 → Task 4
Steps 1-2, #5 → Task 4 Steps 3-5. El hallazgo general positivo del spec
(popovers/dropdowns/tooltips ya animados, `table-node-field.tsx` ya bien
pulido) no genera ninguna tarea, como corresponde — no se tocan esos
archivos en ningún step de este plan.

**Placeholders:** ninguno — cada diff de este plan fue tomado del
contenido real leído de cada archivo antes de escribir el plan, incluida
la verificación de que `dragging` ya está desestructurado como prop en
`table-node.tsx`, `area-node.tsx` y `note-node.tsx` (así que Task 3 no
necesita agregar ninguna prop nueva, solo usar la que ya existe), que
`AccordionTrigger` (`src/components/accordion/accordion.tsx:35`) ya trae
`transition-all` de fábrica (por eso Task 4 solo toca `note-list-item.tsx`
y `area-list-item.tsx`, no los otros 4 tipos de lista que ya lo heredan
gratis), y que `animate-scale`/`animate-scale-2`
(`tailwind.config.js:112-131`) son animaciones CSS con `animation`, no con
`transition` — por eso Task 3 puede quitar `transition-transform
duration-300` de `table-node.tsx` sin afectar esas animaciones.

**Consistencia de valores:** 150ms se usa exclusivamente para feedback de
interacción directa (Task 1: cambio de estado del sync; Task 2: presión de
botón; Task 3: selección/hover/arrastre de nodos) — todos casos donde la
respuesta debe sentirse inmediata. 200ms (el precedente ya establecido en
el código, `transition-all duration-200`) se usa en Task 4 para hover de
filas de lista, consistente con el resto de listas del side panel que ya
usan esa cadencia indirectamente vía `AccordionTrigger`. Ningún step de
este plan introduce `scale`/`transform` en propiedades que React Flow
controla en vivo (`width`/`height`/posición), y ningún step reintroduce
`framer-motion` — Task 1 es el único que usa `motion/react`, con el mismo
patrón de import que ya existe en `auth-card.tsx`/`waitlist-modal.tsx`/
`tree-view.tsx`.

**Riesgo conocido, no bloqueante:** Task 4 Steps 1-2 documentan en el spec
que el `style` inline de `useSortable` (`dnd-kit`) en esas mismas filas
podría, en teoría, pisar la propiedad `transition-property` que aporta la
nueva clase `transition-colors` mientras esa fila específica está en medio
de una animación de reordenamiento de `dnd-kit` — en la práctica el valor
de `transition` que aporta `dnd-kit` solo declara `transform`, nunca
`background-color`, así que no hay conflicto real; es el mismo patrón que
ya usa sin problemas `table-list-item.tsx` (también sobre `useSortable`)
desde antes de esta fase.
