# Fase 1 — Design Tokens y Fundamentos Visuales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el color de marca hardcodeado (pink) y las superficies dark-mode desalineadas por un sistema de tokens CSS coherente (color, radius, tipografía), consolidar la dependencia de motion duplicada, y terminar la migración de notificaciones que ya estaba a medio empezar en el repo.

**Architecture:** Todos los cambios son ediciones de tokens CSS/Tailwind (`src/globals.css`, `tailwind.config.js`, `src/index.css`) más dos limpiezas de dependencias (`framer-motion` duplicado, sistema de toast legado). No se toca ningún componente de producto (Button, TableNode, dashboard, sidebar, etc.) — esos consumen estos tokens en fases posteriores, ya especificadas como fuera de alcance en el spec.

**Tech Stack:** Tailwind CSS 3, CSS custom properties (formato shadcn: tripletes HSL sin la función `hsl()`), `motion` (paquete, ya presente), `sileo` (toast library, ya presente e integrada vía `src/lib/notifications.ts`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-18-ui-redesign-fase1-tokens-design.md`

## Global Constraints

- No tocar arquitectura, lógica de negocio, API ni SyncEngine (instrucción explícita del usuario, ver `AGENTS.md`).
- No traducir el dashboard a i18n en esta fase (decisión explícita del usuario).
- No renombrar ni reestructurar componentes de producto — esta fase es solo tokens + limpieza de dependencias.
- Radius: valores explícitos en píxeles (`sm=6px / md=8px / lg=12px / xl=16px`), prohibido `rounded-[Npx]` arbitrario en código nuevo.
- El degradado azul→cian (`--gradient-cta`) se define como primitivo en esta fase pero **no se conecta a ningún botón todavía** — "Nuevo diagrama" se cablea en la fase del dashboard, que es posterior.
- **Nota sobre testing en esta fase:** los cambios de Tarea 1 y 2 son tokens CSS/config o una relocalización de import sin lógica nueva — no hay unidad de comportamiento que testear con un test unitario, así que su verificación es `pnpm run build` (que ya corre lint + `tsc -b` + `vite build`) más una inspección visual puntual. La Tarea 3 sí introduce un cambio de comportamiento real (qué función se invoca al fallar el clipboard/DBML/relación) y lleva un test de Testing Library siguiendo el patrón ya usado en `src/pages/editor-page/top-navbar/last-saved.test.tsx`.

---

## Task 1: Design tokens — color, radius, tipografía

**Files:**
- Modify: `src/globals.css:6-77` (bloques `:root` y `.dark`)
- Modify: `tailwind.config.js:23-73` (`colors` y `borderRadius`), añadir `fontSize`
- Modify: `src/index.css:7-31` (añadir utilidad `.cta-gradient`)

**Interfaces:**
- Consumes: nada (tarea fundacional).
- Produces: clases Tailwind nuevas que fases posteriores van a consumir:
  - Color: `bg-success`/`text-success`/`border-success` (+ `-foreground`), ídem `warning` e `info`. `bg-primary`/`text-primary`/etc. ya existían pero ahora resuelven a azul en vez de azul-marino oscuro.
  - Radius: `rounded-sm` (6px), `rounded-md` (8px), `rounded-lg` (12px), `rounded-xl` (16px) — antes `sm/md/lg` derivaban todos de una sola variable.
  - Tipografía: `text-display`, `text-heading`, `text-subheading`, `text-body`, `text-caption`, `text-metadata` (nuevas, no reemplazan la escala default de Tailwind — coexisten).
  - Clase de utilidad `.cta-gradient` (usa `var(--gradient-cta)` como `background-image`), sin consumidores todavía.

- [ ] **Step 1: Reemplazar el bloque `:root` en `src/globals.css`**

Reemplazar las líneas 6-41 (todo el contenido de `:root { ... }`) por:

```css
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --card: 0 0% 100%;
        --card-foreground: 222.2 84% 4.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 222.2 84% 4.9%;
        --primary: 221.2 83.2% 53.3%;
        --primary-foreground: 210 40% 98%;
        --secondary: 210 40% 96.1%;
        --secondary-foreground: 222.2 47.4% 11.2%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --accent: 210 40% 96.1%;
        --accent-foreground: 222.2 47.4% 11.2%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 210 40% 98%;
        --success: 142.1 76.2% 36.3%;
        --success-foreground: 210 40% 98%;
        --warning: 32.1 94.6% 43.7%;
        --warning-foreground: 210 40% 98%;
        --info: 191.6 91.4% 36.5%;
        --info-foreground: 210 40% 98%;
        --border: 214.3 31.8% 91.4%;
        --input: 214.3 31.8% 91.4%;
        --ring: 222.2 84% 4.9%;
        --radius-sm: 6px;
        --radius-md: 8px;
        --radius-lg: 12px;
        --radius-xl: 16px;
        --gradient-cta: linear-gradient(
            135deg,
            hsl(221.2 83.2% 53.3%),
            hsl(188.7 94.5% 42.7%)
        );
        --chart-1: 12 76% 61%;
        --chart-2: 173 58% 39%;
        --chart-3: 197 37% 24%;
        --chart-4: 43 74% 66%;
        --chart-5: 27 87% 67%;
        --subtitle: 215.3 19.3% 34.5%;
        --sidebar-background: 0 0% 98%;
        --sidebar-foreground: 240 5.3% 26.1%;
        --sidebar-primary: 240 5.9% 10%;
        --sidebar-primary-foreground: 0 0% 98%;
        --sidebar-accent: 240 4.8% 95.9%;
        --sidebar-accent-foreground: 240 5.9% 10%;
        --sidebar-border: 220 13% 91%;
        --sidebar-ring: 217.2 91.2% 59.8%;
    }
```

Cambios respecto al original: `--primary` pasa de `222.2 47.4% 11.2%` (azul-marino) a
`221.2 83.2% 53.3%` (azul, equivalente a `#2563EB`). Se agregan `--success`,
`--warning`, `--info` (con sus `-foreground`) y `--gradient-cta`. Se
reemplaza la variable única `--radius: 0.5rem` por cuatro variables
explícitas en píxeles. Todo lo demás queda igual.

- [ ] **Step 2: Reemplazar el bloque `.dark` en `src/globals.css`**

Reemplazar las líneas 43-77 (todo el contenido de `.dark { ... }`) por:

```css
    .dark {
        --background: 222.2 47.4% 11.2%;
        --foreground: 210 40% 98%;
        --card: 217.2 32.6% 17.5%;
        --card-foreground: 210 40% 98%;
        --popover: 217.2 32.6% 17.5%;
        --popover-foreground: 210 40% 98%;
        --primary: 213.1 93.9% 67.8%;
        --primary-foreground: 222.2 47.4% 11.2%;
        --secondary: 217.2 32.6% 17.5%;
        --secondary-foreground: 210 40% 98%;
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --accent: 217.2 32.6% 17.5%;
        --accent-foreground: 210 40% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
        --success: 141.9 69.2% 58.0%;
        --success-foreground: 222.2 47.4% 11.2%;
        --warning: 43.3 96.4% 56.3%;
        --warning-foreground: 222.2 47.4% 11.2%;
        --info: 187.9 85.7% 53.3%;
        --info-foreground: 222.2 47.4% 11.2%;
        --border: 215.3 25.0% 26.7%;
        --input: 215.3 25.0% 26.7%;
        --ring: 212.7 26.8% 83.9%;
        --gradient-cta: linear-gradient(
            135deg,
            hsl(213.1 93.9% 67.8%),
            hsl(187.9 85.7% 53.3%)
        );
        --chart-1: 220 70% 50%;
        --chart-2: 160 60% 45%;
        --chart-3: 30 80% 55%;
        --chart-4: 280 65% 60%;
        --chart-5: 340 75% 55%;
        --subtitle: 212.7 26.8% 83.9%;
        --sidebar-background: 240 5.9% 10%;
        --sidebar-foreground: 240 4.8% 95.9%;
        --sidebar-primary: 224.3 76.3% 48%;
        --sidebar-primary-foreground: 0 0% 100%;
        --sidebar-accent: 240 3.7% 15.9%;
        --sidebar-accent-foreground: 240 4.8% 95.9%;
        --sidebar-border: 240 3.7% 15.9%;
        --sidebar-ring: 217.2 91.2% 59.8%;
    }
```

Cambios respecto al original: `--background` se aclara de `222.2 84% 4.9%` a
`222.2 47.4% 11.2%` (antes idéntico a `--card`, ahora distinguible). `--card`
y `--popover` pasan de `222.2 84% 4.9%` (igual al fondo, sin separación) a
`217.2 32.6% 17.5%` (superficie elevada real, equivalente a `#1E293B`).
`--primary` pasa a `213.1 93.9% 67.8%` (azul claro, `#60A5FA`). `--border` e
`--input` pasan de `217.2 32.6% 17.5%` (idéntico a `--muted`/`--secondary`,
sin separación) a `215.3 25.0% 26.7%` (`#334155`, ahora distinguible de las
superficies). Se agregan `--success`/`--warning`/`--info` y `--gradient-cta`.

- [ ] **Step 3: Actualizar `tailwind.config.js` — colores de estado y radius**

En el objeto `colors` (dentro de `theme.extend`), agregar después del bloque
`destructive` (que termina en la línea 41 del archivo original):

```js
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				foreground: 'hsl(var(--success-foreground))'
    			},
    			warning: {
    				DEFAULT: 'hsl(var(--warning))',
    				foreground: 'hsl(var(--warning-foreground))'
    			},
    			info: {
    				DEFAULT: 'hsl(var(--info))',
    				foreground: 'hsl(var(--info-foreground))'
    			},
```

Reemplazar el bloque `borderRadius` (líneas 69-73 del original):

```js
    		borderRadius: {
    			xl: 'var(--radius-xl)',
    			lg: 'var(--radius-lg)',
    			md: 'var(--radius-md)',
    			sm: 'var(--radius-sm)'
    		},
```

- [ ] **Step 4: Añadir la escala tipográfica en `tailwind.config.js`**

Dentro de `theme.extend`, agregar un nuevo bloque `fontSize` (por ejemplo
justo después de `fontFamily`, antes de `colors`):

```js
    		fontSize: {
    			display: ['24px', { lineHeight: '32px', fontWeight: '700' }],
    			heading: ['18px', { lineHeight: '26px', fontWeight: '600' }],
    			subheading: ['15px', { lineHeight: '22px', fontWeight: '600' }],
    			body: ['13px', { lineHeight: '20px' }],
    			caption: ['12px', { lineHeight: '16px' }],
    			metadata: ['11px', { lineHeight: '14px' }]
    		},
```

Esto se agrega dentro de `extend`, por lo que la escala default de Tailwind
(`text-sm`, `text-lg`, etc.) sigue disponible sin cambios — no rompe ningún
uso existente.

- [ ] **Step 5: Añadir la utilidad `.cta-gradient` en `src/index.css`**

Dentro del bloque `@layer components { ... }` (línea 7 del archivo
original), agregar:

```css
    .cta-gradient {
        background-image: var(--gradient-cta);
    }
```

- [ ] **Step 6: Verificar con build**

Run: `pnpm run build`
Expected: termina sin errores (lint + `tsc -b` + `vite build` pasan). Esto
detecta cualquier typo en los nombres de variables CSS o en la sintaxis de
`tailwind.config.js`.

- [ ] **Step 7: Verificación visual manual**

Run: `pnpm dev`, abrir `http://localhost:5173`, entrar a cualquier
diagrama existente y alternar light/dark con el toggle del navbar. Confirmar
que elementos que ya usaban `bg-primary`/`text-primary`/`ring-primary` — por
ejemplo el spinner (`src/components/spinner/spinner.tsx`), los tooltips, o
los checkboxes marcados — ahora se ven azules en vez de azul-marino oscuro,
y que en dark mode el panel lateral y los diálogos se distinguen del fondo
del canvas (antes eran del mismo tono). Nota: el botón "Agregar tabla" y los
headers de tabla del canvas **no** cambian de color todavía — siguen
hardcodeados en pink hasta la fase de componentes base, esto es esperado.

- [ ] **Step 8: Commit**

```bash
git add src/globals.css tailwind.config.js src/index.css
git commit -m "feat(ui): add blue brand color, status tokens, explicit radius scale and typography scale"
```

---

## Task 2: Consolidar la dependencia de motion (`framer-motion` → `motion`)

**Files:**
- Modify: `src/pages/auth-page/waitlist-modal.tsx:2`
- Modify: `src/pages/auth-page/auth-card.tsx:24`
- Modify: `src/pages/auth-page/showcase-section.tsx:2`
- Modify: `src/pages/auth-page/email-sent-view.tsx:2`
- Modify: `src/components/tree-view/tree-view.tsx:8`
- Modify: `package.json` (quitar `framer-motion` de `dependencies`)

**Interfaces:**
- Consumes: nada nuevo — el paquete `motion` ya está instalado
  (`"motion": "^12.43.0"` en `package.json`) y expone el submódulo
  `motion/react` con la misma API que `framer-motion` (`motion`,
  `AnimatePresence`, etc.).
- Produces: mismo API de siempre, solo cambia el specifier del import. Nada
  más en el codebase debe seguir importando desde `'framer-motion'` después
  de esta tarea.

- [ ] **Step 1: Actualizar los 5 imports**

En cada uno de estos 5 archivos, cambiar el import de `framer-motion` a
`motion/react` sin tocar el resto de la línea:

`src/pages/auth-page/waitlist-modal.tsx:2`
```diff
-import { motion, AnimatePresence } from 'framer-motion';
+import { motion, AnimatePresence } from 'motion/react';
```

`src/pages/auth-page/auth-card.tsx:24`
```diff
-import { motion, AnimatePresence } from 'framer-motion';
+import { motion, AnimatePresence } from 'motion/react';
```

`src/pages/auth-page/showcase-section.tsx:2`
```diff
-import { motion } from 'framer-motion';
+import { motion } from 'motion/react';
```

`src/pages/auth-page/email-sent-view.tsx:2`
```diff
-import { motion } from 'framer-motion';
+import { motion } from 'motion/react';
```

`src/components/tree-view/tree-view.tsx:8`
```diff
-import { motion, AnimatePresence } from 'framer-motion';
+import { motion, AnimatePresence } from 'motion/react';
```

- [ ] **Step 2: Quitar la dependencia duplicada**

Run: `pnpm remove framer-motion`
Expected: `package.json` pierde la línea `"framer-motion": "^12.43.0"` y
`pnpm-lock.yaml` se actualiza. `motion` queda como única dependencia de
animación.

- [ ] **Step 3: Verificar con build**

Run: `pnpm run build`
Expected: termina sin errores. Si `tsc`/`vite` fallan por un import
faltante, revisar que los 5 archivos quedaron con `motion/react` y no
`motion` a secas (el paquete `motion` no reexporta los componentes de React
desde su entrada raíz, solo desde `./react`).

- [ ] **Step 4: Verificación visual manual**

Run: `pnpm dev`, navegar a la página de auth/waitlist (`waitlist-modal`,
`auth-card`, `showcase-section`, `email-sent-view` — la ruta pública de
login/registro) y expandir/colapsar un nodo en cualquier `tree-view` (por
ejemplo, el árbol de tablas al importar una base de datos). Confirmar que
las animaciones (fade, expand/collapse) se ven exactamente igual que antes.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/pages/auth-page/waitlist-modal.tsx src/pages/auth-page/auth-card.tsx src/pages/auth-page/showcase-section.tsx src/pages/auth-page/email-sent-view.tsx src/components/tree-view/tree-view.tsx
git commit -m "chore(deps): consolidate on motion package, drop duplicate framer-motion"
```

---

## Task 3: Migrar de toast legado (Radix) al sistema `sileo`/`notify` ya integrado

**Contexto para quien ejecute esta tarea:** el repo ya tiene un sistema de
notificaciones moderno y completamente funcional —`src/lib/notifications.ts`
(wrapper `notify.success/error/warning/info/promise` sobre la librería
`sileo`, ya temuzado para light/dark)— montado globalmente en
`src/app.tsx:20` (`<Toaster position="top-center" />` de `'sileo'`) y usado
hoy en 4 archivos (`waitlist-modal.tsx`, `auth-card.tsx`,
`waitlist-list.tsx`, `users-list.tsx`). En paralelo sigue vivo un sistema
viejo basado en Radix Toast (`src/components/toast/{toast.tsx,
toaster.tsx, use-toast.ts}`), montado por separado en
`src/pages/editor-page/editor-page.tsx:107` y usado en exactamente 3 sitios
del editor. Esta tarea elimina el sistema viejo y mueve esos 3 sitios al
sistema ya existente — no se agrega ninguna dependencia nueva.

**Files:**
- Modify: `src/pages/editor-page/canvas/canvas.tsx:48` (import), `:281`
  (destructuring), `:917-922` (call site)
- Modify: `src/components/code-snippet/code-snippet.tsx:6` (import), `:68`
  (destructuring), `:99-105` (call site), `:114-120` (call site), `:122`
  (dependencia del `useCallback`)
- Modify: `src/pages/editor-page/side-panel/dbml-section/table-dbml/table-dbml.tsx:14`
  (import), `:53` (destructuring), `:185-189` (call site)
- Modify: `src/pages/editor-page/editor-page.tsx:4` (import), `:107` (mount)
- Delete: `src/components/toast/toast.tsx`
- Delete: `src/components/toast/toaster.tsx`
- Delete: `src/components/toast/use-toast.ts`
- Modify: `package.json` (quitar `@radix-ui/react-toast`)
- Test: `src/pages/editor-page/canvas/canvas.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `notify` de `@/lib/notifications` — API ya existente:
  `notify.error(title: string, description?: string): string`.
- Produces: nada nuevo. Después de esta tarea, ningún archivo del repo debe
  importar de `@/components/toast/*` (verificado en Step 6).

- [ ] **Step 1: Migrar `canvas.tsx`**

En `src/pages/editor-page/canvas/canvas.tsx:48`, reemplazar:
```diff
-import { useToast } from '@/components/toast/use-toast';
+import { notify } from '@/lib/notifications';
```

En la línea `:281`, quitar la línea `const { toast } = useToast();` por
completo (no hace falta declarar nada, `notify` es un import directo, no un
hook).

En las líneas `:917-922`, reemplazar:
```diff
-                toast({
-                    title: 'Field types are not compatible',
-                    variant: 'destructive',
-                    description:
-                        'Relationships can only be created between compatible field types',
-                });
+                notify.error(
+                    'Field types are not compatible',
+                    'Relationships can only be created between compatible field types'
+                );
```

- [ ] **Step 2: Escribir el test de `canvas.tsx` para este flujo (antes de tocar nada más)**

Este componente es grande y con muchos providers; en vez de renderizar todo
`Canvas`, este test cubre el flujo mínimo relevante extrayendo la función
helper. Primero, comprobar que **no existe todavía**
`src/pages/editor-page/canvas/canvas.test.tsx` (no debería, es un archivo
nuevo). Crear el test mockeando `@/lib/notifications` para verificar que la
migración invoca `notify.error` con los textos correctos cuando dos tipos de
campo son incompatibles. Como `Canvas` requiere el árbol completo de
providers de ReactFlow/ChartDB para montar, este test apunta directamente a
`areFieldTypesCompatible` + el mensaje esperado, documentando el contrato
que `canvas.tsx:910-922` debe cumplir:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { areFieldTypesCompatible } from '@/lib/data/data-types/data-types';
import { DatabaseType } from '@/lib/domain/database-type';

vi.mock('@/lib/notifications', () => ({
    notify: { error: vi.fn() },
}));

describe('canvas relationship creation — incompatible field types', () => {
    it('flags varchar -> integer as incompatible so the toast path is reachable', () => {
        const compatible = areFieldTypesCompatible(
            { id: 'varchar', name: 'varchar' },
            { id: 'integer', name: 'integer' },
            DatabaseType.GENERIC
        );
        expect(compatible).toBeFalsy();
    });
});
```

`areFieldTypesCompatible` está definida en
`src/lib/data/data-types/data-types.ts:118` con la firma
`(type1: DataType, type2: DataType, databaseType: DatabaseType): boolean`,
donde `DataType` es `{ id: string; name: string }` — los objetos literales
de arriba ya cumplen ese shape sin necesidad de cast. **Importante:** para
`DatabaseType.GENERIC` el mapa de tipos compatibles está vacío
(`compatibleTypes[DatabaseType.GENERIC] = {}`), así que la función devuelve
literalmente `undefined` en este caso (no `false` — es una peculiaridad de
cómo está encadenado el `||` en la implementación original, fuera de
alcance arreglar acá). Por eso el assert es `toBeFalsy()` y no `toBe(false)`
— coincide con el uso real en `canvas.tsx:910` (`if (!areFieldTypesCompatible(...))`),
que solo necesita un valor falsy, no específicamente `false`. Verificado
ejecutando la lógica antes de escribir este plan.

- [ ] **Step 3: Ejecutar el test y confirmar que pasa**

Run: `pnpm test canvas.test.tsx`
Expected: PASS. Este test no verifica la migración de `notify` en sí (eso
lo cubre el build de TypeScript, ya que `notify.error` tiene una firma
distinta a `toast({...})` y cualquier desalineación no compila), sino que
documenta el contrato de negocio que dispara el toast, para que una
regresión futura en `areFieldTypesCompatible` se note aquí.

- [ ] **Step 4: Migrar `code-snippet.tsx`**

En `src/components/code-snippet/code-snippet.tsx:6`, reemplazar:
```diff
-import { useToast } from '@/components/toast/use-toast';
+import { notify } from '@/lib/notifications';
```

En la línea `:68`, quitar `const { toast } = useToast();`.

En las líneas `:99-105`, reemplazar:
```diff
-                toast({
-                    title: t('copy_to_clipboard_toast.unsupported.title'),
-                    variant: 'destructive',
-                    description: t(
-                        'copy_to_clipboard_toast.unsupported.description'
-                    ),
-                });
+                notify.error(
+                    t('copy_to_clipboard_toast.unsupported.title'),
+                    t('copy_to_clipboard_toast.unsupported.description')
+                );
```

En las líneas `:114-120`, reemplazar:
```diff
-                toast({
-                    title: t('copy_to_clipboard_toast.failed.title'),
-                    variant: 'destructive',
-                    description: t(
-                        'copy_to_clipboard_toast.failed.description'
-                    ),
-                });
+                notify.error(
+                    t('copy_to_clipboard_toast.failed.title'),
+                    t('copy_to_clipboard_toast.failed.description')
+                );
```

En la línea `:122`, el array de dependencias del `useCallback` referencia
`toast` — cambiarlo a `notify` no es necesario porque `notify` es un import
de módulo, no una variable de scope del componente: quitar `toast` del
array de dependencias `[code, codeToCopy, t, toast]` dejando
`[code, codeToCopy, t]`.

- [ ] **Step 5: Migrar `table-dbml.tsx`**

En `src/pages/editor-page/side-panel/dbml-section/table-dbml/table-dbml.tsx:14`,
reemplazar:
```diff
-import { useToast } from '@/components/toast/use-toast';
+import { notify } from '@/lib/notifications';
```

En la línea `:53`, quitar `const { toast } = useToast();`.

En las líneas `:185-189`, reemplazar:
```diff
-                toast({
-                    title: 'DBML Export Error',
-                    description: `Could not generate DBML: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`,
-                    variant: 'destructive',
-                });
+                notify.error(
+                    'DBML Export Error',
+                    `Could not generate DBML: ${result.error.substring(0, 100)}${result.error.length > 100 ? '...' : ''}`
+                );
```

- [ ] **Step 6: Quitar el montaje del `Toaster` legado**

En `src/pages/editor-page/editor-page.tsx:4`, borrar la línea:
```diff
-import { Toaster } from '@/components/toast/toaster';
```

En la línea `:107`, borrar la línea `<Toaster />` (el `<Toaster
position="top-center" />` de `sileo` ya montado en `src/app.tsx:20` cubre
toda la app, incluido el editor — no hace falta un segundo montaje).

- [ ] **Step 7: Borrar los archivos del sistema de toast legado**

```bash
git rm src/components/toast/toast.tsx src/components/toast/toaster.tsx src/components/toast/use-toast.ts
```

- [ ] **Step 8: Confirmar que no quedan referencias colgantes**

Run: `grep -rn "components/toast" src --include="*.tsx" --include="*.ts"`
Expected: sin resultados (ningún import apunta ya a la carpeta borrada).

- [ ] **Step 9: Quitar la dependencia `@radix-ui/react-toast`**

Run: `pnpm remove @radix-ui/react-toast`
Expected: `package.json` y `pnpm-lock.yaml` actualizados. Ninguna otra
dependencia de Radix se toca.

- [ ] **Step 10: Build y suite completa**

Run: `pnpm run build && pnpm run test:ci`
Expected: ambos pasan. `test:ci` corre con `--bail=1`, así que cualquier
test existente que dependiera indirectamente del sistema de toast viejo
(no se encontró ninguno al auditar, pero esto lo confirma) fallaría rápido
y visiblemente.

- [ ] **Step 11: Verificación manual de los 3 flujos**

Run: `pnpm dev`, y para cada uno de los 3 sitios, confirmar que ahora
aparece un toast de `sileo` (esquina superior centro, estilo físico/con
spring) en vez del toast Radix anterior:
1. En el editor, crear una relación entre dos campos de tipos incompatibles
   (ej. `varchar` y un tipo numérico) → debe aparecer "Field types are not
   compatible".
2. En la sección DBML del panel lateral, forzar un error de generación (si
   no es reproducible fácilmente a mano, confirmar al menos que el import y
   el build son correctos — este caso de error es difícil de disparar
   manualmente sin datos corruptos).
3. En cualquier vista con `CodeSnippet` y botón de copiar, con las
   DevTools abiertas, ejecutar `Object.defineProperty(navigator, 'clipboard', {value: undefined})`
   en la consola y luego clickear "copiar" → debe aparecer el toast de
   "Copy failed".

- [ ] **Step 12: Commit**

```bash
git add src/pages/editor-page/canvas/canvas.tsx src/pages/editor-page/canvas/canvas.test.tsx src/components/code-snippet/code-snippet.tsx src/pages/editor-page/side-panel/dbml-section/table-dbml/table-dbml.tsx src/pages/editor-page/editor-page.tsx package.json pnpm-lock.yaml
git commit -m "refactor(notifications): finish migration off legacy Radix toast onto existing sileo/notify system"
```

---

## Self-Review

**Cobertura del spec:** color de marca ✅ (Step 1/3 Task 1), gradiente CTA
✅ (Step 1/5 Task 1, primitivo sin conectar — correcto, está fuera de
alcance conectarlo), colores de estado ✅ (Step 1/2/3 Task 1), superficies
dark recalibradas ✅ (Step 2 Task 1), radius explícito ✅ (Step 3 Task 1),
tipografía ✅ (Step 4 Task 1), consolidación de motion ✅ (Task 2), migración
de toasts ✅ (Task 3). Iconografía (lucide unificado) y el tratamiento
detallado de TableNode/Áreas/toolbar/sidebar quedan explícitamente fuera de
esta fase por el spec — no les corresponde tarea acá.

**Placeholders:** ninguno — todos los bloques de código son el contenido
final exacto a escribir, no descripciones.

**Consistencia de tipos/nombres:** `notify.error(title, description?)` se
usa con la misma firma en los 3 call sites de la Tarea 3. Los nombres de
variables CSS (`--success`, `--warning`, `--info`, `--gradient-cta`,
`--radius-sm/md/lg/xl`) son idénticos entre `globals.css` y
`tailwind.config.js`.
