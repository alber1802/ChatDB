# Fase 2 — Componentes Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el sistema de Button (color hardcodeado + hack de regex), unificar los 16 archivos de componentes base que todavía usan `@radix-ui/react-icons` sobre `lucide-react`, y reemplazar la ilustración PNG fija de `EmptyState` por un ícono lucide por sección.

**Architecture:** Tres cambios independientes y acotados a `src/components/` (y sus 6 consumidores directos en `side-panel/`): ninguno toca dashboard, canvas, sidebar del editor ni dialogs de negocio.

**Tech Stack:** React, Tailwind (tokens de Fase 1 ya mergeados), `class-variance-authority`, `lucide-react`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-19-ui-redesign-fase2-base-components-design.md`

## Global Constraints

- No tocar arquitectura, lógica de negocio, API ni SyncEngine.
- No tocar `TableNode`, `relationship-edge`, `editor-sidebar`, toolbar del canvas, dashboard — su pink hardcodeado se resuelve en fases posteriores.
- No introducir dependencias nuevas — `lucide-react` ya está instalado.
- Todo ícono migrado debe conservar exactamente las mismas clases (`className`) que tenía en su versión Radix — solo cambia el nombre del componente importado.
- **Nota sobre testing**: las Tareas 1 y 2 son renombres/reemplazos mecánicos de clases e imports sin lógica nueva que testear — su verificación es `pnpm run build` (nota: en este entorno Windows, la etapa `lint` de `pnpm run build` falla por un problema de CRLF/`core.autocrlf` preexistente y no relacionado a este plan, documentado en el ledger de Fase 1 — usar `npx tsc -b` y `npx vite build` directamente como gate real) más inspección visual. La Tarea 3 sí cambia una prop pública (`EmptyStateProps`) consumida por 5 call sites reales, así que lleva un test que renderiza `EmptyState` con un ícono y verifica que se renderiza (no la imagen vieja).

---

## Task 1: Sistema de Button

**Files:**
- Modify: `src/components/button/button-variants.tsx:9`
- Modify: `src/components/button/button-with-alternatives.tsx:82-85`
- Modify: `src/pages/editor-page/side-panel/tables-section/tables-section.tsx:162`

**Interfaces:**
- Consumes: token `--primary`/`--primary-foreground` de `src/globals.css` (ya existen desde Fase 1, sin cambios).
- Produces: ningún cambio de firma pública — `buttonVariants`, `Button` y `ButtonWithAlternatives` mantienen exactamente los mismos props (`variant`, `size`, etc.).

- [ ] **Step 1: Arreglar el color hardcodeado en `button-variants.tsx`**

En `src/components/button/button-variants.tsx:9`, reemplazar:
```diff
-                default:
-                    'bg-pink-600 text-primary-foreground shadow hover:bg-pink-500',
+                default:
+                    'bg-primary text-primary-foreground shadow hover:bg-primary/90',
```

- [ ] **Step 2: Eliminar el hack de regex en `button-with-alternatives.tsx`**

En `src/components/button/button-with-alternatives.tsx`, el bloque actual (líneas 78-89) es:
```tsx
                          <button
                              className={cn(
                                  buttonVariants({ variant, size }),
                                  'rounded-l-none border-l border-l-primary/5 px-2 min-w-0',
                                  className?.includes('h-') &&
                                      className.match(/h-\d+/)?.[0],
                                  className?.includes('text-') &&
                                      className.match(/text-\w+/)?.[0],
                                  dropdownTriggerClassName
                              )}
                              type="button"
                          >
```
Reemplazar por:
```tsx
                          <button
                              className={cn(
                                  buttonVariants({ variant, size }),
                                  'rounded-l-none border-l border-l-primary/5 px-2 min-w-0',
                                  dropdownTriggerClassName
                              )}
                              type="button"
                          >
```
(Se eliminan únicamente las dos líneas que parseaban `className` por regex — `buttonVariants({ variant, size })` ya aplica el mismo `size`/`variant` a ambos botones de forma nativa, así que dejan de hacer falta.)

- [ ] **Step 3: Actualizar el único consumidor real (`tables-section.tsx`)**

En `src/pages/editor-page/side-panel/tables-section/tables-section.tsx`, el JSX actual (alrededor de la línea 160) es:
```tsx
            <ButtonWithAlternatives
                variant="secondary"
                className="h-8 p-2 text-xs"
                onClick={() => handleCreateTable({ view: false })}
```
Reemplazar por:
```tsx
            <ButtonWithAlternatives
                variant="secondary"
                size="sm"
                className="p-2"
                onClick={() => handleCreateTable({ view: false })}
```
(`size="sm"` en `buttonVariants` ya equivale a `h-8 rounded-md px-3 text-xs` — se mantiene `className="p-2"` porque el padding horizontal original del call site era `p-2`, distinto del `px-3` que trae `sm`, y no había una razón de diseño documentada para cambiarlo; `cn()` en `buttonVariants({...})` aplica `size` primero y `className` después, así que `p-2` sigue ganando sobre el `px-3` de `sm` exactamente igual que antes.)

- [ ] **Step 4: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` como gate — su etapa de lint falla por un problema de CRLF preexistente del entorno, documentado en el ledger de Fase 1, no relacionado a este cambio.)

- [ ] **Step 5: Verificación visual manual**

Run: `pnpm dev`, abrir cualquier diagrama. Confirmar que los botones con `variant="default"` (ej. "Agregar Tabla" del dashboard, o cualquier CTA principal del editor) ahora se ven azules en vez de pink. En la sección de Tablas del panel lateral, confirmar que el botón "Agregar tabla" con su flecha de alternativas (visible solo si `showDBViews` está activo) se ve y funciona igual que antes (mismo alto, mismo tamaño de texto, el dropdown abre "Agregar vista").

- [ ] **Step 6: Commit**

```bash
git add src/components/button/button-variants.tsx src/components/button/button-with-alternatives.tsx src/pages/editor-page/side-panel/tables-section/tables-section.tsx
git commit -m "fix(ui): use bg-primary instead of hardcoded pink, remove fragile className regex in ButtonWithAlternatives"
```

---

## Task 2: Unificación de iconografía (`@radix-ui/react-icons` → `lucide-react`)

**Files** (16 modificaciones, todas del mismo tipo — swap de import + rename de uso JSX):
- Modify: `src/components/menubar/menubar.tsx`
- Modify: `src/components/select/select.tsx`
- Modify: `src/components/sheet/sheet.tsx`
- Modify: `src/components/sidebar/sidebar.tsx`
- Modify: `src/components/dialog/dialog.tsx`
- Modify: `src/components/button/button-with-alternatives.tsx`
- Modify: `src/components/command/command.tsx`
- Modify: `src/components/command/dialog.tsx`
- Modify: `src/components/context-menu/context-menu.tsx`
- Modify: `src/components/dropdown-menu/dropdown-menu.tsx`
- Modify: `src/components/pagination/pagination.tsx`
- Modify: `src/components/resizable/resizable.tsx`
- Modify: `src/components/select-box/select-box.tsx`
- Modify: `src/components/accordion/accordion.tsx`
- Modify: `src/components/breadcrumb/breadcrumb.tsx`
- Modify: `src/components/checkbox/checkbox.tsx`
- Modify: `package.json` (quitar `@radix-ui/react-icons` al final, Step 18)

**Interfaces:**
- Consumes: nada nuevo — `lucide-react` ya es dependencia (`"lucide-react": "^0.525.0"`).
- Produces: nada que otras tareas consuman — es un cambio interno de cada componente, mismas clases/comportamiento visual.

Para cada archivo: el import de `@radix-ui/react-icons` se reemplaza por el equivalente de `lucide-react`, y **cada uso JSX del ícono cambia de nombre exactamente igual, sin tocar ninguna otra prop/clase**.

- [ ] **Step 1: `src/components/menubar/menubar.tsx`**

Import (líneas 3-6):
```diff
-import {
-    CheckIcon,
-    ChevronRightIcon,
-    DotFilledIcon,
-} from '@radix-ui/react-icons';
+import { Check, ChevronRight, Dot } from 'lucide-react';
```
Usos:
```diff
-        <ChevronRightIcon className="ml-auto size-4" />
+        <ChevronRight className="ml-auto size-4" />
```
(línea 72, dentro de `MenubarSubTrigger`)
```diff
-                <CheckIcon className="size-4" />
+                <Check className="size-4" />
```
(línea 156, dentro de `MenubarCheckboxItem`)
```diff
-                <DotFilledIcon className="size-4 fill-current" />
+                <Dot className="size-4 fill-current" />
```
(línea 178, dentro de `MenubarRadioItem`)

- [ ] **Step 2: `src/components/select/select.tsx`**

Import (líneas 3-7):
```diff
-import {
-    CheckIcon,
-    ChevronDownIcon,
-    ChevronUpIcon,
-} from '@radix-ui/react-icons';
+import { Check, ChevronDown, ChevronUp } from 'lucide-react';
```
Usos:
```diff
-        <ChevronUpIcon />
+        <ChevronUp />
```
(línea 50, `SelectScrollUpButton`)
```diff
-        <ChevronDownIcon />
+        <ChevronDown />
```
(línea 67, `SelectScrollDownButton`)
```diff
-                <CheckIcon className="size-4" />
+                <Check className="size-4" />
```
(línea 131, `SelectItem` — `ItemIndicator`)

- [ ] **Step 3: `src/components/sheet/sheet.tsx`**

Import (línea 5):
```diff
-import { Cross2Icon } from '@radix-ui/react-icons';
+import { X } from 'lucide-react';
```
Uso (línea 64):
```diff
-                <Cross2Icon className="size-4" />
+                <X className="size-4" />
```

- [ ] **Step 4: `src/components/sidebar/sidebar.tsx`**

Import (línea 24):
```diff
-import { ViewVerticalIcon } from '@radix-ui/react-icons';
+import { PanelLeft } from 'lucide-react';
```
Uso (línea 301):
```diff
-            <ViewVerticalIcon />
+            <PanelLeft />
```

- [ ] **Step 5: `src/components/dialog/dialog.tsx`**

Import (línea 3):
```diff
-import { Cross2Icon } from '@radix-ui/react-icons';
+import { X } from 'lucide-react';
```
Uso (línea 97):
```diff
-                        <Cross2Icon className="size-4" />
+                        <X className="size-4" />
```

- [ ] **Step 6: `src/components/button/button-with-alternatives.tsx`**

Import (línea 2):
```diff
-import { ChevronDownIcon } from '@radix-ui/react-icons';
+import { ChevronDown } from 'lucide-react';
```
Uso (dentro del bloque tocado en la Tarea 1 — aplicar este rename también, quedando):
```diff
-                                  <ChevronDownIcon
-                                      className={cn(
-                                          'size-4 shrink-0',
-                                          chevronDownIconClassName
-                                      )}
-                                  />
+                                  <ChevronDown
+                                      className={cn(
+                                          'size-4 shrink-0',
+                                          chevronDownIconClassName
+                                      )}
+                                  />
```

- [ ] **Step 7: `src/components/command/command.tsx`**

Import (línea 3):
```diff
-import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
+import { Search } from 'lucide-react';
```
Uso (línea 43):
```diff
-        <MagnifyingGlassIcon className="mr-2 size-4 shrink-0 opacity-50" />
+        <Search className="mr-2 size-4 shrink-0 opacity-50" />
```

- [ ] **Step 8: `src/components/command/dialog.tsx`**

Import (línea 3):
```diff
-import { Cross2Icon } from '@radix-ui/react-icons';
+import { X } from 'lucide-react';
```
Uso (línea 46):
```diff
-                <Cross2Icon className="size-4" />
+                <X className="size-4" />
```

- [ ] **Step 9: `src/components/context-menu/context-menu.tsx`**

Import (líneas 3-7):
```diff
-import {
-    CheckIcon,
-    ChevronRightIcon,
-    DotFilledIcon,
-} from '@radix-ui/react-icons';
+import { Check, ChevronRight, Dot } from 'lucide-react';
```
Usos:
```diff
-        <ChevronRightIcon className="ml-auto size-4" />
+        <ChevronRight className="ml-auto size-4" />
```
(línea 39)
```diff
-                <CheckIcon className="size-4" />
+                <Check className="size-4" />
```
(línea 109)
```diff
-                <DotFilledIcon className="size-4 fill-current" />
+                <Dot className="size-4 fill-current" />
```
(línea 132)

- [ ] **Step 10: `src/components/dropdown-menu/dropdown-menu.tsx`**

Import (líneas 3-7):
```diff
-import {
-    CheckIcon,
-    ChevronRightIcon,
-    DotFilledIcon,
-} from '@radix-ui/react-icons';
+import { Check, ChevronRight, Dot } from 'lucide-react';
```
Usos:
```diff
-        <ChevronRightIcon className="ml-auto size-4" />
+        <ChevronRight className="ml-auto size-4" />
```
(línea 39)
```diff
-                <CheckIcon className="size-4" />
+                <Check className="size-4" />
```
(línea 113)
```diff
-                <DotFilledIcon className="size-4 fill-current" />
+                <Dot className="size-4 fill-current" />
```
(línea 136)

- [ ] **Step 11: `src/components/pagination/pagination.tsx`**

Import (líneas 5-9):
```diff
-import {
-    ChevronLeftIcon,
-    ChevronRightIcon,
-    DotsHorizontalIcon,
-} from '@radix-ui/react-icons';
+import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
```
Usos:
```diff
-        <ChevronLeftIcon className="size-4" />
+        <ChevronLeft className="size-4" />
```
(línea 76)
```diff
-        <ChevronRightIcon className="size-4" />
+        <ChevronRight className="size-4" />
```
(línea 93)
```diff
-        <DotsHorizontalIcon className="size-4" />
+        <MoreHorizontal className="size-4" />
```
(línea 107)

- [ ] **Step 12: `src/components/resizable/resizable.tsx`**

Import (línea 2):
```diff
-import { DragHandleDots2Icon } from '@radix-ui/react-icons';
+import { GripVertical } from 'lucide-react';
```
Uso (línea 38):
```diff
-                <DragHandleDots2Icon className="size-2.5" />
+                <GripVertical className="size-2.5" />
```

- [ ] **Step 13: `src/components/select-box/select-box.tsx`**

Import (línea 1):
```diff
-import { CaretSortIcon, CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
+import { ChevronsUpDown, Check, X } from 'lucide-react';
```
Usos:
```diff
-                                    <Cross2Icon />
+                                    <X />
```
(línea 176)
```diff
-                                <CheckIcon />
+                                <Check />
```
(línea 270)
```diff
-                            <CheckIcon
+                            <Check
```
(línea 293, resto del bloque de props sin cambios)
```diff
-                                        <Cross2Icon className="size-3.5" />
+                                        <X className="size-3.5" />
```
(línea 374)
```diff
-                                    <CaretSortIcon className="size-4" />
+                                    <ChevronsUpDown className="size-4" />
```
(línea 379)
```diff
-                                    <Cross2Icon className="size-4" />
+                                    <X className="size-4" />
```
(línea 432)

- [ ] **Step 14: `src/components/accordion/accordion.tsx`**

Import (línea 3):
```diff
-import { ChevronDownIcon } from '@radix-ui/react-icons';
+import { ChevronDown } from 'lucide-react';
```
Uso (línea 28):
```diff
-        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
+        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
```

- [ ] **Step 15: `src/components/breadcrumb/breadcrumb.tsx`**

Import (línea 2):
```diff
-import { ChevronRightIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
+import { ChevronRight, MoreHorizontal } from 'lucide-react';
```
Usos:
```diff
-        {children ?? <ChevronRightIcon />}
+        {children ?? <ChevronRight />}
```
(línea 86)
```diff
-        <DotsHorizontalIcon className="size-4" />
+        <MoreHorizontal className="size-4" />
```
(línea 101)

- [ ] **Step 16: `src/components/checkbox/checkbox.tsx`**

Import (línea 3):
```diff
-import { CheckIcon } from '@radix-ui/react-icons';
+import { Check } from 'lucide-react';
```
Uso (línea 22):
```diff
-            <CheckIcon className="size-4" />
+            <Check className="size-4" />
```

- [ ] **Step 17: Confirmar que no queda ningún import de `@radix-ui/react-icons`**

Run: `grep -rn "@radix-ui/react-icons" src`
Expected: sin resultados.

- [ ] **Step 18: Quitar la dependencia**

Run: `pnpm remove @radix-ui/react-icons`
Expected: `package.json` y `pnpm-lock.yaml` actualizados, sin ninguna otra dependencia afectada.

- [ ] **Step 19: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 20: Verificación visual manual**

Run: `pnpm dev`. Abrir: un `Select` (ej. selector de tipo de dato en una columna), un `DropdownMenu` (menú "..." de una tarjeta de diagrama en el dashboard), un `Dialog` (cualquiera, ej. crear diagrama — botón de cerrar arriba a la derecha), el `Sidebar` del editor (botón de colapsar), un `Accordion` si existe alguno visible, y el `Command`/command palette si tiene atajo. Confirmar que todos los íconos se ven idénticos a como se veían antes (incluyendo tamaño y color) — no debería haber ninguna diferencia visual perceptible, solo un cambio de librería interna.

- [ ] **Step 21: Commit**

```bash
git add -A src/components package.json pnpm-lock.yaml
git commit -m "refactor(ui): unify remaining base components on lucide-react, drop @radix-ui/react-icons"
```

---

## Task 3: `EmptyState` — ícono por sección en vez de ilustración PNG

**Files:**
- Modify: `src/components/empty/empty.tsx` (fix `EmptyDescription` → `<p>`)
- Modify: `src/components/empty-state/empty-state.tsx`
- Modify: `src/pages/editor-page/side-panel/tables-section/tables-section.tsx`
- Modify: `src/pages/editor-page/side-panel/visuals-section/areas-tab/areas-tab.tsx`
- Modify: `src/pages/editor-page/side-panel/visuals-section/notes-tab/notes-tab.tsx`
- Modify: `src/pages/editor-page/side-panel/custom-types-section/custom-types-section.tsx`
- Modify: `src/pages/editor-page/side-panel/refs-section/refs-section.tsx`
- Delete: `src/assets/empty_state.png`
- Delete: `src/assets/empty_state_dark.png`
- Test: `src/components/empty-state/empty-state.test.tsx` (nuevo)

**Interfaces:**
- Consumes: ningún ícono nuevo — usa íconos de `lucide-react`, ya dependencia del proyecto.
- Produces: `EmptyStateProps` gana una prop nueva y **obligatoria** `icon: LucideIcon` (tipo ya usado en el codebase, ver `src/pages/editor-page/editor-sidebar/editor-sidebar.tsx:37` — `icon: React.FC`, o el tipo `LucideIcon` exportado por `lucide-react`). Las props existentes (`title`, `description`, `primaryAction`, `secondaryAction`, `footerAction`, etc.) no cambian.

- [ ] **Step 1: Corregir la semántica de `EmptyDescription` en `empty.tsx`**

En `src/components/empty/empty.tsx`, la función actual (líneas 72-83) es:
```tsx
function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <div
            data-slot="empty-description"
            className={cn(
                'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
                className
            )}
            {...props}
        />
    );
}
```
Reemplazar el elemento `<div>` por `<p>` (el tipo de sus props ya declara `React.ComponentProps<'p'>`, así que esto solo corrige un desajuste, no cambia ninguna prop pública):
```tsx
function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="empty-description"
            className={cn(
                'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
                className
            )}
            {...props}
        />
    );
}
```

- [ ] **Step 2: Escribir el test de `EmptyState` con ícono (antes de cambiar el componente)**

Crear `src/components/empty-state/empty-state.test.tsx`:
```tsx
import type {} from '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Table } from 'lucide-react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
    it('renders the given icon instead of the old illustration image', () => {
        render(
            <EmptyState
                icon={Table}
                title="No tables yet"
                description="Create a table to get started"
            />
        );
        expect(screen.getByText('No tables yet')).toBeInTheDocument();
        expect(
            screen.getByText('Create a table to get started')
        ).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Ejecutar el test y confirmar que falla**

Run: `pnpm test empty-state.test.tsx`
Expected: FAIL — `EmptyState` todavía no acepta una prop `icon` (error de tipo de TypeScript al compilar el test, o el test pasa por casualidad pero `screen.queryByRole('img')` encuentra la imagen vieja y falla el último `expect`).

- [ ] **Step 4: Reescribir `empty-state.tsx` para usar `icon` en vez de la imagen PNG**

Reemplazar el archivo completo `src/components/empty-state/empty-state.tsx` por:
```tsx
import React, { forwardRef, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../empty/empty';
import { Button } from '../button/button';

export interface EmptyStateActionButton {
    label: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface EmptyStateFooterAction {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    imageClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
    primaryAction?: EmptyStateActionButton;
    secondaryAction?: EmptyStateActionButton;
    footerAction?: EmptyStateFooterAction;
}

export const EmptyState = forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & EmptyStateProps
>(
    (
        {
            icon: Icon,
            title,
            description,
            className,
            titleClassName,
            descriptionClassName,
            imageClassName,
            primaryAction,
            secondaryAction,
            footerAction,
        },
        ref
    ) => {
        // Determine if we have any actions to show
        const hasActions = useMemo(
            () => !!(primaryAction || secondaryAction),
            [primaryAction, secondaryAction]
        );
        const hasFooterAction = useMemo(() => !!footerAction, [footerAction]);

        return (
            <div
                ref={ref}
                className={cn(
                    'flex flex-1 flex-col items-center justify-center space-y-1',
                    className
                )}
            >
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className={imageClassName}>
                            <Icon className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle className={titleClassName}>
                            {title}
                        </EmptyTitle>
                        <EmptyDescription className={descriptionClassName}>
                            {description}
                        </EmptyDescription>
                    </EmptyHeader>

                    {/* Action buttons section */}
                    {hasActions && (
                        <EmptyContent>
                            <div className="flex gap-2">
                                {primaryAction && (
                                    <Button
                                        onClick={primaryAction.onClick}
                                        disabled={primaryAction.disabled}
                                        className="h-8 font-normal"
                                    >
                                        {primaryAction.label}
                                        {primaryAction.icon}
                                    </Button>
                                )}
                                {secondaryAction && (
                                    <Button
                                        variant="outline"
                                        onClick={secondaryAction.onClick}
                                        disabled={secondaryAction.disabled}
                                        className="h-8 font-normal"
                                    >
                                        {secondaryAction.label}
                                        {secondaryAction.icon}
                                    </Button>
                                )}
                            </div>
                        </EmptyContent>
                    )}

                    {/* Footer action link */}
                    {hasFooterAction && footerAction && (
                        <Button
                            variant="link"
                            asChild={!!footerAction.href}
                            className="text-muted-foreground"
                            size="sm"
                            disabled={footerAction.disabled}
                            onClick={
                                !footerAction.href
                                    ? footerAction.onClick
                                    : undefined
                            }
                        >
                            {footerAction.href ? (
                                <a href={footerAction.href}>
                                    {footerAction.label}
                                    {footerAction.icon}
                                </a>
                            ) : (
                                <span>
                                    {footerAction.label}
                                    {footerAction.icon}
                                </span>
                            )}
                        </Button>
                    )}

                    {/* Render empty content if no actions */}
                    {!hasActions && !hasFooterAction && <EmptyContent />}
                </Empty>
            </div>
        );
    }
);

EmptyState.displayName = 'EmptyState';
```
(Se quitaron los imports de `EmptyStateImage`/`EmptyStateImageDark` y `useTheme` — ya no hacen falta. `icon: Icon` se desestructura y renombra en la misma línea, patrón estándar de React para renderizar un componente recibido por prop con mayúscula inicial. `imageClassName` se reutiliza como className de `EmptyMedia` en vez de la imagen, para no romper a quien ya lo pasaba.)

- [ ] **Step 5: Ejecutar el test y confirmar que pasa**

Run: `pnpm test empty-state.test.tsx`
Expected: PASS.

- [ ] **Step 6: Actualizar los 5 consumidores con su ícono**

Los 4 archivos siguientes ya importan de `lucide-react` el ícono exacto que necesitan para otro uso en el mismo archivo (confirmado leyendo cada uno) — **no agregar un import nuevo, reusar el existente**:
- `tables-section.tsx` línea 4: `import { Table, View, X, EyeOff } from 'lucide-react';` — ya trae `Table`.
- `visuals-section/areas-tab/areas-tab.tsx` línea 3: `import { Group, X } from 'lucide-react';` — ya trae `Group` (usado en el botón "crear área" de la línea 79; se reusa acá en vez de introducir un ícono nuevo tipo `Shapes`, porque ya representa "Áreas" en este mismo archivo y en el nav del sidebar).
- `visuals-section/notes-tab/notes-tab.tsx` línea 3: `import { StickyNote, X } from 'lucide-react';` — ya trae `StickyNote`.
- `refs-section/refs-section.tsx` línea 3: `import { ListCollapse, Workflow } from 'lucide-react';` — ya trae `Workflow`.

Solo `custom-types-section.tsx` necesita un import nuevo: línea 3 actual es
`import { X, Plus } from 'lucide-react';` → cambiar a
`import { FileType, X, Plus } from 'lucide-react';`.

En cada uno de los 5 archivos, ubicar el JSX `<EmptyState` (tables-section.tsx ~línea 207, areas-tab.tsx línea 87, notes-tab.tsx línea 87, custom-types-section.tsx línea 68, refs-section.tsx línea 211) y agregar únicamente la prop `icon`, sin tocar `title`/`description`/ninguna otra prop existente:
```diff
 <EmptyState
+    icon={Table}
     title={t('side_panel.tables_section.empty_state.title')}
```
(mismo patrón para los otros 4: `icon={Group}` en areas-tab.tsx, `icon={StickyNote}` en notes-tab.tsx, `icon={FileType}` en custom-types-section.tsx, `icon={Workflow}` en refs-section.tsx — cada uno agregado como primera prop de su propio `<EmptyState>` ya existente, con las mismas claves `t(...)` de `title`/`description` que el archivo ya tiene hoy).

**Nota para quien ejecute este step**: no inventar ni transcribir de memoria las claves `t(...)` de título/descripción — leer cada archivo antes de editarlo y agregar solo la línea `icon={...}` a la llamada `<EmptyState>` que ya está ahí, sin modificar ninguna otra línea del JSX.

- [ ] **Step 7: Borrar los assets PNG que ya no se usan**

```bash
git rm src/assets/empty_state.png src/assets/empty_state_dark.png
```

- [ ] **Step 8: Confirmar que no queda ninguna referencia a los PNG borrados**

Run: `grep -rn "empty_state.png\|empty_state_dark.png\|EmptyStateImage" src`
Expected: sin resultados.

- [ ] **Step 9: Build y suite completa**

Run: `npx tsc -b && npx vite build && pnpm test:ci`
Expected: los tres sin errores nuevos (la suite de tests puede seguir mostrando el fallo pre-existente de `export-sql-dbml-cases.test.ts` por CRLF, documentado en Fase 1 — no relacionado a este cambio; cualquier otro fallo sí debe investigarse).

- [ ] **Step 10: Verificación visual manual**

Run: `pnpm dev`, abrir un diagrama, y vaciar (o abrir uno que ya esté vacío en) cada una de las 5 secciones: Tablas, Áreas, Notas, Tipos personalizados, Referencias. Confirmar que cada una muestra su ícono correspondiente (tabla, formas, nota adhesiva, tipo de archivo, flujo) en vez de la ilustración PNG anterior, en light y dark mode.

- [ ] **Step 11: Commit**

```bash
git add src/components/empty/empty.tsx src/components/empty-state/empty-state.tsx src/components/empty-state/empty-state.test.tsx src/pages/editor-page/side-panel/tables-section/tables-section.tsx src/pages/editor-page/side-panel/visuals-section/areas-tab/areas-tab.tsx src/pages/editor-page/side-panel/visuals-section/notes-tab/notes-tab.tsx src/pages/editor-page/side-panel/custom-types-section/custom-types-section.tsx src/pages/editor-page/side-panel/refs-section/refs-section.tsx
git commit -m "feat(ui): replace EmptyState's fixed PNG illustration with a per-section lucide icon"
```

---

## Self-Review

**Cobertura del spec:** Button color hardcodeado ✅ (Task 1 Step 1), hack de regex en `ButtonWithAlternatives` ✅ (Task 1 Step 2-3), unificación de los 16 archivos de íconos ✅ (Task 2, uno por uno con línea exacta), remoción de la dependencia `@radix-ui/react-icons` ✅ (Task 2 Step 18), reemplazo de PNG por ícono en `EmptyState` ✅ (Task 3), fix de semántica `EmptyDescription` ✅ (Task 3 Step 1), borrado de los 2 assets PNG ✅ (Task 3 Step 7). `scroll-area.tsx`'s `rounded-[inherit]` está correctamente excluido del plan (el spec lo marca como no-issue).

**Placeholders:** ninguno — cada diff de la Tarea 2 tiene el import y cada uso JSX exactos verificados contra el archivo real antes de escribir este plan. La única instrucción no-literal es el Step 6 de la Tarea 3 (no reproducir las claves i18n de memoria) — es una instrucción explícita de verificación, no un placeholder de "hacer algo sin decir cómo": el "cómo" (agregar la prop `icon` a la llamada `<EmptyState>` ya existente, sin tocar nada más) está completamente especificado.

**Consistencia de tipos/nombres:** `EmptyStateProps.icon: LucideIcon` se usa igual en la definición (Task 3 Step 4) y en el test (Task 3 Step 2, `icon={Table}`) y en los 5 call sites (Task 3 Step 6). Los nombres de íconos lucide (`Check`, `ChevronRight`, `Dot`, `ChevronDown`, `ChevronUp`, `X`, `PanelLeft`, `Search`, `ChevronLeft`, `MoreHorizontal`, `GripVertical`, `ChevronsUpDown`) son consistentes entre el spec y cada paso de la Tarea 2.
