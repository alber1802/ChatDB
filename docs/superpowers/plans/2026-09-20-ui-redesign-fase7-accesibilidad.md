# Fase 7 — Accesibilidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el contraste de `--destructive` en dark mode (deuda
técnica anotada desde Fase 3), agregar nombre accesible (`aria-label`) a
los botones de solo-ícono que no lo tienen, dar anillo de foco visible al
`<textarea>` nativo de `note-node.tsx`, y hacer alcanzables por teclado (no
solo por hover) las acciones de tabla/campo del canvas que hoy usan
`hidden .../group-hover:flex`.

**Architecture:** Cuatro tareas independientes entre sí (ningún archivo se
toca en más de una tarea): (1) un solo token en `globals.css`; (2)
`aria-label`/`aria-expanded` en 4 componentes de dashboard/árbol de
objetos, sin cambios de layout; (3) clases de foco en un `<textarea>` de
`note-node.tsx`; (4) reemplazo de `hidden`/`group-hover:flex` por
`opacity-0`/`group-hover:opacity-100`/`has-[:focus-visible]:opacity-100` +
`aria-label` en los 2 archivos del canvas (`table-node.tsx`,
`table-node-field.tsx`).

**Tech Stack:** React, Tailwind 3.4.19 (variante arbitraria `has-*`, envuelve
`:has()`), Radix UI (`DropdownMenu` ya inyecta `aria-haspopup`/`aria-expanded`
en sus triggers), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-20-ui-redesign-fase7-accesibilidad-design.md`

## Global Constraints

- No tocar arquitectura, lógica de negocio, API ni SyncEngine.
- No tocar `--destructive` en light mode.
- No migrar el patrón `hidden .../group-hover:flex` fuera de los 2 archivos
  del canvas listados en Task 4 (los ~10 archivos restantes del side panel
  quedan fuera de alcance, ver spec).
- No agregar herramienta de auditoría automatizada (axe-core, Lighthouse CI).
- No reestructurar `tree-view.tsx` a un patrón ARIA `role="tree"` completo
  — solo agregar `aria-label`/`aria-expanded` al botón existente.
- **Nota sobre testing**: las 4 tareas son correcciones de accesibilidad
  sin lógica de negocio nueva (un valor de token, atributos ARIA, clases
  CSS) — verificación vía `npx tsc -b`/`npx vite build` + inspección manual
  con teclado (Tab/Enter/Escape) y de contraste, igual que Fase 3.

---

## Task 1: Contraste de `--destructive` en dark mode

**Files:**
- Modify: `src/globals.css`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `--destructive`/`--destructive-foreground` en dark mode con
  valores nuevos — consumidos por `Button`/`Badge`/`Alert` (variant
  `destructive`) y los más de una decena de usos directos de
  `text-destructive`/`bg-destructive` listados en el spec §1. Ningún
  consumidor cambia su código — solo cambia el color resuelto.

- [ ] **Step 1: Actualizar el bloque `.dark` de `src/globals.css`**

El bloque actual (líneas 72-73):

```css
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 210 40% 98%;
```

Reemplazarlo por:

```css
        --destructive: 0 91% 71%;
        --destructive-foreground: 222.2 47.4% 11.2%;
```

(El nuevo `--destructive-foreground` es exactamente el mismo valor que
`--background` en ese mismo bloque `.dark` — línea 58 — igual que ya hacen
`--primary-foreground`, `--success-foreground`, `--warning-foreground` e
`--info-foreground` en dark mode, todas las líneas vecinas.)

- [ ] **Step 2: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` — problema de CRLF
documentado en la bitácora de Fase 1, no relacionado a este cambio.)

- [ ] **Step 3: Verificación manual de contraste**

Run: `pnpm dev`, abrir el dashboard o el editor en dark mode. Confirmar
visualmente: (1) el texto "Eliminar" en los menús de tarjeta/lista de
diagramas y el badge de rol "Super Admin" ya no se ven de un rojo casi
invisible sobre el fondo oscuro — se leen con claridad; (2) el botón rojo
de confirmación de borrado (`AlertDialogAction`) sigue viéndose como un
botón sólido rojo con texto legible encima (ahora texto oscuro sobre rojo
claro, en vez de blanco sobre rojo oscuro — el cambio de apariencia es
esperado, ver spec §1); (3) en light mode nada cambió (no se tocó ese
bloque).

Opcional para verificar el cálculo exacto: en devtools, inspeccionar un
elemento con `text-destructive` en dark mode, copiar el color computado
(debería resolver a `hsl(0, 91%, 71%)` ≈ `#F87272`) y usar el picker de
contraste de Chrome DevTools contra el `background-color` computado de
`--card`/`--background` — debería reportar ≥ 4.5:1 en ambos casos (el
cálculo de este plan dio 5.32:1 y 6.49:1 respectivamente).

- [ ] **Step 4: Commit**

```bash
git add src/globals.css
git commit -m "fix(a11y): raise --destructive dark mode contrast to meet WCAG AA (1.46:1 -> 5.32:1 vs --card)"
```

---

## Task 2: `aria-label`/`aria-expanded` en botones de solo-ícono (dashboard y árbol de objetos)

**Files:**
- Modify: `src/dialogs/open-diagram-dialog/diagram-row-actions-menu/diagram-row-actions-menu.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/diagram-list-item.tsx`
- Modify: `src/pages/diagrams-dashboard/_components/diagram-card.tsx`
- Modify: `src/components/tree-view/tree-view.tsx`

**Interfaces:**
- Consumes: nada nuevo (solo atributos HTML/ARIA sobre `Button` ya
  existente).
- Produces: nada que otra tarea consuma — cambio interno, mismo
  comportamiento visual y de click, solo agrega nombre accesible.

- [ ] **Step 1: `diagram-row-actions-menu.tsx` — trigger "..."**

Bloque actual (líneas 61-68):

```tsx
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Ellipsis className="size-4" />
                </Button>
```

Reemplazarlo por:

```tsx
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Más acciones"
                    className="size-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Ellipsis className="size-4" />
                </Button>
```

- [ ] **Step 2: `diagram-list-item.tsx` — trigger de menú de acciones**

Bloque actual (líneas 123-129):

```tsx
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 cursor-pointer rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
```

Reemplazarlo por:

```tsx
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Más acciones"
                                    className="size-8 cursor-pointer rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
```

- [ ] **Step 3: `diagram-card.tsx` — trigger de menú de acciones**

Bloque actual (líneas 106-112), mismo patrón exacto que Step 2:

```tsx
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 cursor-pointer rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
```

Reemplazarlo por:

```tsx
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Más acciones"
                                    className="size-8 cursor-pointer rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <MoreVertical className="size-4" />
                                </Button>
```

- [ ] **Step 4: `tree-view.tsx` — botón expandir/contraer carpeta**

Bloque actual (líneas 276-295):

```tsx
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-3.5 w-3.5 p-0 hover:bg-transparent flex-none',
                            isExpanded && 'rotate-90',
                            'transition-transform duration-200'
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (node.isFolder) {
                                onToggle(
                                    node.id,
                                    node.type,
                                    node.context,
                                    node.children
                                );
                            }
                        }}
                    >
```

Reemplazarlo por:

```tsx
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-3.5 w-3.5 p-0 hover:bg-transparent flex-none',
                            isExpanded && 'rotate-90',
                            'transition-transform duration-200'
                        )}
                        aria-label={
                            node.isFolder
                                ? isExpanded
                                    ? 'Contraer'
                                    : 'Expandir'
                                : undefined
                        }
                        aria-expanded={node.isFolder ? isExpanded : undefined}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (node.isFolder) {
                                onToggle(
                                    node.id,
                                    node.type,
                                    node.context,
                                    node.children
                                );
                            }
                        }}
                    >
```

(Para nodos que no son carpeta, `node.isFolder` es `false` y el botón no
renderiza ningún ícono adentro — `aria-label`/`aria-expanded` quedan
`undefined`, es decir, no se agregan al DOM, sin cambiar el comportamiento
actual para esos nodos.)

- [ ] **Step 5: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 6: Verificación manual**

Run: `pnpm dev`. Con un lector de pantalla activo (o el inspector de
accesibilidad de Chrome DevTools — panel "Accessibility" del elemento):
confirmar que el botón "..."/"⋮" de una fila de diagrama (dashboard, vista
grid, vista lista, y el diálogo "Abrir diagrama") ahora reporta el nombre
accesible "Más acciones" en vez de estar vacío. En el árbol de objetos
(sidebar del editor, sección de Tablas/Áreas — el componente que usa
`TreeView`), confirmar que el botón de expandir/contraer una carpeta
reporta "Expandir"/"Contraer" según corresponda y que `aria-expanded`
cambia entre `true`/`false` al hacer click. Navegación por teclado: Tab
hasta el botón "..." de una tarjeta, `Enter` para abrir el menú, `Escape`
para cerrarlo — debe funcionar igual que con click (comportamiento ya
provisto por Radix `DropdownMenu`, no cambia con este fix).

- [ ] **Step 7: Commit**

```bash
git add src/dialogs/open-diagram-dialog/diagram-row-actions-menu/diagram-row-actions-menu.tsx src/pages/diagrams-dashboard/_components/diagram-list-item.tsx src/pages/diagrams-dashboard/_components/diagram-card.tsx src/components/tree-view/tree-view.tsx
git commit -m "fix(a11y): add aria-label to icon-only menu triggers, aria-label/aria-expanded to tree-view toggle"
```

---

## Task 3: Anillo de foco en el `<textarea>` de Notas del canvas

**Files:**
- Modify: `src/pages/editor-page/canvas/note-node/note-node.tsx`

**Interfaces:**
- Consumes: token `--ring` (ya existe desde Fase 1, ya usado por el
  componente compartido `Textarea`).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Agregar clases de foco visible al `<textarea>` de edición**

Bloque actual (líneas 178-192):

```tsx
                    <textarea
                        ref={textareaRef}
                        className="nodrag size-full resize-none overflow-auto border-none bg-transparent p-0 text-sm leading-relaxed text-gray-700 outline-none dark:text-gray-300"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveContent();
                            }
                        }}
                        autoFocus
                        placeholder="Type your note here..."
                    />
```

Reemplazarlo por (mismo par `focus-visible:outline-none focus-visible:ring-1
focus-visible:ring-ring` que ya usa el componente compartido `Textarea` en
`src/components/textarea/textarea.tsx:12`, más `rounded-sm` para que el
anillo tenga una esquina definida):

```tsx
                    <textarea
                        ref={textareaRef}
                        className="nodrag size-full resize-none overflow-auto rounded-sm border-none bg-transparent p-0 text-sm leading-relaxed text-gray-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:text-gray-300"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveContent();
                            }
                        }}
                        autoFocus
                        placeholder="Type your note here..."
                    />
```

- [ ] **Step 2: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 3: Verificación manual**

Run: `pnpm dev`, abrir un diagrama, agregar/doble-click una Nota para
entrar en modo edición. Confirmar: (1) al entrar en modo edición el
`<textarea>` recibe foco automáticamente (`autoFocus`, sin cambios) y se
ve el anillo azul (`--ring`) alrededor del área de texto; (2) hacer
`Tab` afuera y volver a hacer `Tab` hacia el textarea (sin usar mouse)
también muestra el anillo — antes no se veía ningún indicador de foco más
allá del cursor de texto parpadeante; (3) escribir contenido y confirmar
que `Enter` (sin `Shift`) sigue guardando la nota como antes (comportamiento
no tocado).

- [ ] **Step 4: Commit**

```bash
git add src/pages/editor-page/canvas/note-node/note-node.tsx
git commit -m "fix(a11y): visible focus ring on note-node textarea (was outline-none with no replacement)"
```

---

## Task 4: Acciones de tabla/campo del canvas alcanzables por teclado

**Files:**
- Modify: `src/pages/editor-page/canvas/table-node/table-node.tsx`
- Modify: `src/pages/editor-page/canvas/table-node/table-node-field.tsx`

**Interfaces:**
- Consumes: variante arbitraria `has-[:focus-visible]` de Tailwind (soportada
  desde 3.4, este repo usa `^3.4.19` — no requiere configuración adicional
  ni plugin nuevo).
- Produces: nada que otra tarea consuma. `openTableInEditor`/
  `expandTable`/`shrinkTable`/`openEditTableOnField` se siguen invocando
  exactamente igual — solo cambia cuándo el botón es visible/enfocable, no
  qué hace al activarlo.

- [ ] **Step 1: `table-node.tsx` — botones de encabezado de tabla**

Bloque actual (líneas 582-607):

```tsx
                        <div className="hidden shrink-0 flex-row group-hover:flex">
                            {readonly ? null : (
                                <Button
                                    variant="ghost"
                                    className="size-6 p-0 text-slate-500 hover:bg-primary-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    onClick={openTableInEditor}
                                >
                                    <CircleDotDashed className="size-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                className="size-6 p-0 text-slate-500 hover:bg-primary-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                onClick={
                                    table.width !== MAX_TABLE_SIZE
                                        ? expandTable
                                        : shrinkTable
                                }
                            >
                                {table.width !== MAX_TABLE_SIZE ? (
                                    <ChevronsLeftRight className="size-4" />
                                ) : (
                                    <ChevronsRightLeft className="size-4" />
                                )}
                            </Button>
                        </div>
```

Reemplazarlo por:

```tsx
                        <div className="flex shrink-0 flex-row opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100">
                            {readonly ? null : (
                                <Button
                                    variant="ghost"
                                    aria-label="Abrir tabla en el editor"
                                    className="size-6 p-0 text-slate-500 hover:bg-primary-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    onClick={openTableInEditor}
                                >
                                    <CircleDotDashed className="size-4" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                aria-label={
                                    table.width !== MAX_TABLE_SIZE
                                        ? 'Expandir tabla'
                                        : 'Contraer tabla'
                                }
                                className="size-6 p-0 text-slate-500 hover:bg-primary-foreground hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                onClick={
                                    table.width !== MAX_TABLE_SIZE
                                        ? expandTable
                                        : shrinkTable
                                }
                            >
                                {table.width !== MAX_TABLE_SIZE ? (
                                    <ChevronsLeftRight className="size-4" />
                                ) : (
                                    <ChevronsRightLeft className="size-4" />
                                )}
                            </Button>
                        </div>
```

Nota: `hidden` (`display:none`) se reemplaza por `flex` fijo +
`opacity-0` — el contenedor pasa a ocupar espacio en el layout siempre
(antes no ocupaba nada mientras estaba oculto). Es un trade-off consciente
documentado en el spec §5: sin él, un elemento con `display:none` nunca
puede recibir foco de teclado, sin importar qué variante de foco se le
agregue.

- [ ] **Step 2: `table-node-field.tsx` — botón "editar campo"**

Bloque actual (líneas 617-629):

```tsx
                {readonly ? null : (
                    <div className="ml-2 hidden shrink-0 flex-row group-hover:flex">
                        <Button
                            variant="ghost"
                            className="size-6 p-0 hover:bg-primary-foreground"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEditTableOnField();
                            }}
                        >
                            <Pencil className="!size-3.5 text-primary" />
                        </Button>
                    </div>
                )}
```

Reemplazarlo por:

```tsx
                {readonly ? null : (
                    <div className="ml-2 flex shrink-0 flex-row opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100">
                        <Button
                            variant="ghost"
                            aria-label="Editar campo"
                            className="size-6 p-0 hover:bg-primary-foreground"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEditTableOnField();
                            }}
                        >
                            <Pencil className="!size-3.5 text-primary" />
                        </Button>
                    </div>
                )}
```

- [ ] **Step 3: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 4: Verificación visual y de teclado manual**

Run: `pnpm dev`, abrir un diagrama con al menos una tabla.

Mouse (regresión — debe seguir igual que antes): pasar el mouse sobre el
encabezado de una tabla — deben aparecer los botones "abrir en editor" y
"expandir/contraer"; pasar el mouse sobre una fila de campo — debe
aparecer el botón de lápiz "editar campo". Ambos deben desaparecer
(volver a opacidad 0) al sacar el mouse, igual que antes.

Teclado (el fix de esta tarea — antes era imposible): con el mouse fuera
de la tabla, usar `Tab` para navegar por la página hasta llegar a los
controles de esa tabla (React Flow permite foco de teclado sobre el nodo
y, dependiendo del flujo de tabs del navegador, sobre los botones internos
una vez visibles); confirmar que en cuanto el foco de teclado entra a
cualquiera de estos botones (aunque el mouse esté lejos), el botón se
vuelve visible (`opacity-100` vía `has-[:focus-visible]`) y se puede
activar con `Enter`/`Space`. Confirmar además (inspector de accesibilidad
de DevTools) que cada botón ahora reporta su `aria-label`
("Abrir tabla en el editor", "Expandir tabla"/"Contraer tabla",
"Editar campo").

- [ ] **Step 5: Confirmar que no se rompió el resto del layout de la fila**

Run: `grep -n "hidden shrink-0 flex-row group-hover:flex\|ml-2 hidden shrink-0 flex-row group-hover:flex" src/pages/editor-page/canvas/table-node/table-node.tsx src/pages/editor-page/canvas/table-node/table-node-field.tsx`
Expected: sin resultados (ambos reemplazados).

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor-page/canvas/table-node/table-node.tsx src/pages/editor-page/canvas/table-node/table-node-field.tsx
git commit -m "fix(a11y): make table header/field actions keyboard-focusable, not hover-only; add aria-label"
```

---

## Self-Review

**Cobertura del spec:** contraste de `--destructive` dark ✅ (Task 1,
único hallazgo obligatorio del brief), verificación de `--muted-foreground`
y colores de estado como fondo (§2 del spec) ✅ — sin cambio de código
porque no se encontró un problema real, documentado como verificación en
el spec, no requiere tarea de implementación. Botones de solo-ícono sin
nombre accesible ✅ (Task 2 cubre los 4 del dashboard/árbol; Task 4 cubre
los 3 del canvas que además tenían el problema de §5). Foco visible en
`note-node` ✅ (Task 3). Acciones inalcanzables por teclado ✅ (Task 4,
los 2 casos de mayor impacto real; el resto queda explícitamente fuera de
alcance en el spec, no se inventó una Task 5 para "completar" algo que el
propio spec descarta a propósito).

**Placeholders:** ninguno — cada bloque "actual" de este plan fue leído
del archivo real (`table-node.tsx`, `table-node-field.tsx`,
`note-node.tsx`, `tree-view.tsx`, `diagram-row-actions-menu.tsx`,
`diagram-list-item.tsx`, `diagram-card.tsx`, `globals.css`) antes de
escribir el "nuevo", incluyendo los números de línea citados. El valor
`0 91% 71%` de Task 1 fue verificado por cálculo de contraste WCAG contra
`--background` (6.49:1) y `--card` (5.32:1) en el spec, no elegido por
apariencia. La sintaxis `has-[:focus-visible]:opacity-100` fue verificada
contra la versión instalada de Tailwind (`^3.4.19` en `package.json:117`,
la variante `has-*` existe desde 3.4).

**Consistencia de tipos/nombres:** ningún cambio de firma de función ni de
prop — todas las tareas agregan atributos JSX (`aria-label`,
`aria-expanded`) o cambian valores de `className`/tokens CSS, sin tocar
`onClick`/handlers ni el árbol de props que otros componentes consumen.
`node.isFolder`/`isExpanded` en Task 2 Step 4 se usan con el mismo tipo y
nombre que ya tenían en el resto del componente `tree-view.tsx`.

**Independencia de tareas:** las 4 tareas tocan conjuntos de archivos
disjuntos (`globals.css` / 4 archivos de dashboard-y-árbol / `note-node.tsx`
/ 2 archivos de canvas) — se pueden implementar y commitear en cualquier
orden, o en paralelo con subagentes, sin conflictos de merge.
