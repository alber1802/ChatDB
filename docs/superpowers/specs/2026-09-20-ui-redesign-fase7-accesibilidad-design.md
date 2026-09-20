# Rediseño UI/UX de ChartDB — Fase 7: Accesibilidad

## Contexto

Séptimo sub-proyecto del rediseño de UI/UX (Fases 5/6 — dialogs/copy y
microinteracciones — quedaron sin brainstormear todavía; se salta
directamente a la deuda de accesibilidad porque ya está documentada y
acotada desde Fase 3). Consume los tokens de Fase 1 (`--destructive`,
`--muted-foreground`, `--ring`, etc.) y los componentes base de Fase 2
(`Button`, `Textarea`).

Precede a este spec una auditoría de código real: se leyó
`src/globals.css` completo, se recalculó a mano el contraste WCAG de cada
par color-de-texto/color-de-fondo relevante (fórmula de luminancia relativa
sRGB → contraste `(L1+0.05)/(L2+0.05)`), y se grepeó el árbol de
componentes (`size="icon"`, `outline-none`, `group-hover:`) para encontrar
botones sin nombre accesible y elementos interactivos sin indicador de foco
o inalcanzables por teclado.

**Hallazgo general**: el sistema de tokens de Fase 1 sigue un patrón
consistente en dark mode para `--primary`/`--success`/`--warning`/`--info`
— color **claro y saturado** (para verse bien como texto sobre el fondo
oscuro) pareado con un `-foreground` **oscuro** (para verse bien como texto
sobre un botón/badge de ese color). `--destructive` es la única excepción:
se dejó igual que en light mode (oscuro, pensado para "fondo de botón +
texto blanco"), lo que la vuelve prácticamente ilegible como texto plano
sobre fondo oscuro — que es exactamente cómo se usa en 15+ lugares del
código (`text-destructive` en menús "Eliminar", "Cerrar Sesión", banners de
error, etc.). El resto de los hallazgos son puntuales: falta de nombre
accesible en botones de solo-ícono, un `<textarea>` nativo que rompe la
convención de foco visible del resto del sistema, y un patrón repetido de
"acción secundaria visible solo al hacer hover" que deja esas acciones
completamente inalcanzables por teclado en dos lugares centrales del
canvas.

**Explícitamente fuera de alcance**: ver sección dedicada al final.

## 1. Contraste de `--destructive` en dark mode (deuda de Fase 3)

**Hallazgo confirmado con cálculo real** (no la estimación previa de la
bitácora, recalculada desde cero para este spec):

`src/globals.css:72-73`, bloque `.dark`:
```css
--destructive: 0 62.8% 30.6%;           /* → #7F1D1D */
--destructive-foreground: 210 40% 98%;  /* → #F8FAFC (casi blanco) */
```

`text-destructive` en dark mode renderiza `#7F1D1D` (un rojo muy oscuro)
como color de **texto**. Contra los dos fondos donde realmente aparece:

| Fondo | Hex | Contraste `#7F1D1D` sobre ese fondo |
|---|---|---|
| `--background` (`#0F172A`) | luminancia 0.00885 | **1.78:1** |
| `--card`/`--popover` (`#1E293B`, dropdowns/diálogos) | luminancia 0.02175 | **1.46:1** |

Ambos muy por debajo del mínimo WCAG AA para texto normal (**4.5:1**) —
confirma y precisa el "~1.45:1" que anotó Fase 3 (esa cifra corresponde al
par contra `--card`, que es donde vive la mayoría de los usos reales:
`DropdownMenuItem`, `AlertDialogAction`, badges — ver
`src/pages/diagrams-dashboard/_components/dashboard-header.tsx:48,180`,
`diagram-card.tsx:139,205`, `diagram-list-item.tsx:156,200`,
`profile-settings-dialog.tsx:187,263`, `admin-sidebar.tsx:147`,
`admin-header.tsx:181`, `users-table.tsx:126`, `user-edit-dialog.tsx:126`,
`route-error-boundary.tsx:22,39`, `waitlist-list.tsx:245`,
`enum-values.tsx:63`, `last-saved.tsx:125` (vía `Badge variant="destructive"`),
más `Alert variant="destructive"` en los diálogos de import/export — al
menos 14 archivos de consumo directo detectados por grep de
`text-destructive`/`bg-destructive`/`destructive-foreground`, más
`last-saved.tsx`, `import-diagram-dialog.tsx` y `export-diagram-dialog.tsx`
que lo consumen indirectamente vía `Badge`/`Alert` `variant="destructive"`).

**Decisión**: alinear `--destructive` en dark mode al mismo patrón que ya
usan `--primary`/`--success`/`--warning`/`--info` — color claro+saturado
para texto, `-foreground` oscuro (= `--background`) para fondo de
botón/badge:

```css
--destructive: 0 91% 71%;                    /* → #F87272, ~Tailwind red-400 */
--destructive-foreground: 222.2 47.4% 11.2%; /* = --background, mismo patrón que primary/success/warning/info-foreground dark */
```

**Contraste después del cambio**:

| Uso | Par | Contraste |
|---|---|---|
| `text-destructive` sobre `--background` | `#F87272` / `#0F172A` | **6.49:1** ✅ (AA normal 4.5:1, casi AAA 7:1) |
| `text-destructive` sobre `--card` | `#F87272` / `#1E293B` | **5.32:1** ✅ (AA) |
| `bg-destructive text-destructive-foreground` (botón/badge) | `#F87272` / `#0F172A` | **6.49:1** ✅ (antes: ~9.64:1 con el rojo oscuro + texto blanco — sigue pasando AA con margen, solo baja de "excelente" a "muy bueno") |
| `border-destructive` (borde de `Alert`, 1.4.11 exige 3:1 para límites de componentes UI) | mismo par | **6.49:1** ✅ (antes 1.78:1, **fallaba** este criterio también) |

No se toca `--destructive` en **light mode** (`0 84.2% 60.2%` /
`210 40% 98%`) — no está señalado como problema (contraste ya verificado
≥4.5:1 en esa combinación) y no forma parte del hallazgo de Fase 3, que es
específicamente sobre dark mode.

Se eligió mantener el matiz `H=0` (rojo puro, igual que el resto de la
paleta destructive) y solo mover `S`/`L` a valores que ya usa el patrón de
esta paleta para los otros 4 tokens de estado en dark — no es una elección
arbitraria de color nuevo, es aplicar la misma fórmula que ya está en el
archivo tres líneas más arriba/abajo.

## 2. Verificación de contraste: `--muted-foreground` y estados como fondo de badge/botón

Pedido explícito de auditoría — se verificó, **no se encontró un segundo
bug**, se documenta el resultado:

| Par | Hex | Contraste | Resultado |
|---|---|---|---|
| `--muted-foreground` light sobre `--background`/`--card` (blanco) | `#64748B` / `#FFFFFF` | **4.76:1** | ✅ pasa AA (justo, con poco margen — no requiere acción) |
| `--muted-foreground` dark sobre `--card` (`#1E293B`) | `#94A3B8` / `#1E293B` | **5.71:1** | ✅ pasa AA |
| `--muted-foreground` dark sobre `--background` (`#0F172A`) | `#94A3B8` / `#0F172A` | **6.96:1** | ✅ pasa AA, casi AAA |
| `text-primary-foreground` sobre `bg-primary` (dark, patrón "claro+oscuro") | `#0F172A` / `#60A5FA` | **7.02:1** | ✅ AAA — confirma que el patrón usado por `--primary`/`--success`/`--warning`/`--info` (y ahora `--destructive`, ver §1) es sólido |
| `text-info-foreground` sobre `bg-info` (light) | `#020817` (aprox.) / `#0891B2` | **5.38:1** | ✅ pasa AA |
| `text-success-foreground` sobre `bg-success` (light) | `#020817` (aprox.) / `#16A34A` | **6.01:1** | ✅ pasa AA |

Conclusión: el único token roto era `--destructive` en dark. El resto de
la paleta de Fase 1 (incluyendo `--muted-foreground`, que no se tocó desde
antes de Fase 1) ya cumple AA. No se propone ningún cambio en esta sección
— queda documentada como verificación, no como hallazgo con fix.

## 3. Botones de solo-ícono sin nombre accesible

**Hallazgo**: varios botones que muestran únicamente un ícono (sin texto
visible) no tienen `aria-label` ni `title` — un lector de pantalla los
anuncia como "botón", sin decir para qué sirven. Confirmado leyendo cada
archivo (no solo grepeando `size="icon"` — varios usos de ese patrón en el
repo sí tienen `title=`, por ejemplo `dashboard-toolbar.tsx:125,134` y
`admin-header.tsx:127`, y quedan fuera de este hallazgo):

| Archivo:línea | Ícono | Contexto | Problema |
|---|---|---|---|
| `src/dialogs/open-diagram-dialog/diagram-row-actions-menu/diagram-row-actions-menu.tsx:61-68` | `Ellipsis` | Trigger de menú "..." por fila de diagrama | Sin `aria-label`/`title` |
| `src/pages/diagrams-dashboard/_components/diagram-list-item.tsx:123-129` | `MoreVertical` | Trigger de menú de acciones (vista lista) | Sin `aria-label`/`title` |
| `src/pages/diagrams-dashboard/_components/diagram-card.tsx:106-112` | `MoreVertical` | Trigger de menú de acciones (vista grid) | Sin `aria-label`/`title` |
| `src/components/tree-view/tree-view.tsx:276-295` | `ChevronRight`/`Loader2` | Botón expandir/contraer carpeta | Sin `aria-label` y sin `aria-expanded` (el estado expandido/contraído no se comunica) |

Los tres primeros son triggers de `DropdownMenuTrigger asChild` — Radix ya
inyecta `aria-haspopup`/`aria-expanded` automáticamente sobre el elemento
hijo, así que lo único que falta es el **nombre** (`aria-label`), no el
estado.

**Cambio propuesto**: agregar `aria-label="Más acciones"` a los tres
triggers de menú, y `aria-label`/`aria-expanded` condicionales (solo cuando
`node.isFolder`) al botón de `tree-view.tsx`.

Nota de alcance: `dashboard-toolbar.tsx` (toggle grid/lista) y
`admin-header.tsx` (toggle de tema, botón mobile) **ya usan `title=`** —
un lector de pantalla moderno sí lo toma como nombre accesible cuando no
hay contenido de texto ni `aria-label`, así que no están rotos, solo usan
un patrón más débil (sin tooltip visible al foco de teclado). No se tocan
en esta fase — no son un hallazgo, son una convención ya aceptable.

## 4. `<textarea>` nativo en `note-node.tsx` sin anillo de foco

**Hallazgo**: `src/pages/editor-page/canvas/note-node/note-node.tsx:178-192`
— el modo de edición de una Nota en el canvas usa un `<textarea>` nativo
(no el componente compartido `Textarea` de `src/components/textarea/textarea.tsx`)
con esta clase:

```
className="nodrag size-full resize-none overflow-auto border-none bg-transparent p-0 text-sm leading-relaxed text-gray-700 outline-none dark:text-gray-300"
```

`outline-none` sin ningún `focus-visible:ring-*` de reemplazo — rompe la
convención que sí sigue el componente `Textarea` compartido
(`src/components/textarea/textarea.tsx:12`):
`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`.
El contenedor de la Nota sí muestra un borde `border-primary` cuando el
**nodo** está `selected` (línea 144-147 de `note-node.tsx`), pero eso es el
estado de selección de React Flow, no el foco del `<textarea>` en sí — si
se entra en modo edición y se navega con Tab, no hay ningún indicador de
que el textarea tiene el foco del teclado más allá del cursor de texto
parpadeante.

**Cambio propuesto**: agregar el mismo par `focus-visible:outline-none
focus-visible:ring-1 focus-visible:ring-ring` que ya usa el componente
compartido, más `rounded-sm` para que el anillo tenga una esquina limpia
(el contenedor de la nota ya usa `rounded-[6px]`).

## 5. Acciones reveladas solo con `hover`, inalcanzables por teclado

**Hallazgo de mayor impacto real de esta fase**: patrón `hidden ...
group-hover:flex` (oculta un botón por completo — `display:none` — y solo
lo muestra cuando el mouse pasa por encima del contenedor `.group`). Un
elemento con `display:none` **no puede recibir foco de teclado bajo
ninguna circunstancia** — no es un problema de "anillo de foco poco
visible", es que la acción no existe para quien no usa mouse.

Se encontraron dos casos en el **canvas** (los de mayor uso/impacto,
alcance de esta fase):

- `src/pages/editor-page/canvas/table-node/table-node.tsx:582` — el
  contenedor de los botones "abrir tabla en el editor"
  (`CircleDotDashed`) y "expandir/contraer tabla" (`ChevronsLeftRight`/
  `ChevronsRightLeft`) del encabezado de cada tabla.
- `src/pages/editor-page/canvas/table-node/table-node-field.tsx:618` — el
  botón "editar campo" (`Pencil`) de cada fila de campo.

En ambos casos el `.group` es el `<div>` de la fila/encabezado en sí
(`table-node.tsx:510`, `table-node-field.tsx:349`) — un `<div>` sin
`tabIndex` ni contenido enfocable propio antes de llegar al botón oculto.
Esto descarta la solución típica de "agregar `group-focus-within:flex`"
sin más: no hay ningún elemento *previo* dentro del mismo `group` que
pueda recibir foco y "armar" la revelación — el propio botón oculto sería
el primer punto de foco posible, y un elemento con `display:none` nunca
llega a ese punto.

**Decisión**: en vez de `hidden`/`group-hover:flex` (que quita el elemento
del layout y del árbol de accesibilidad), usar `opacity-0` (el elemento
sigue presente y es enfocable, solo invisible) combinado con
`group-hover:opacity-100` **y** `has-[:focus-visible]:opacity-100` (variante
arbitraria de Tailwind, soportada desde 3.4 — este repo usa `^3.4.19`, ver
`package.json:117` — que envuelve `:has()`, soportado en Chrome/Firefox/
Safari desde 2023-2024). Así el botón se revela con el mouse (como hoy) o
en cuanto cualquiera de sus hijos recibe foco de teclado, sin depender de
que exista un elemento previo enfocable en el mismo `group`.

**Trade-off consciente**: al pasar de `hidden` a `opacity-0`, el espacio de
esos botones queda siempre reservado en el layout (antes `display:none` no
ocupaba espacio). El impacto visual es mínimo — son íconos de `size-6` en
una fila que ya tiene `justify-between`/espacio de sobra — pero se anota
explícitamente porque es un cambio real de layout, no solo de accesibilidad.

Se agrega además el `aria-label` correspondiente a cada uno de estos 3
botones (mismo hallazgo que §3, mismo archivo — se corrige junto).

**Mismo patrón encontrado en otros ~10 archivos, deliberadamente fuera de
alcance de esta fase** (ver "Fuera de alcance" abajo): `diagram-name.tsx:137`,
`area-node.tsx:261`, `filter-item-actions.tsx:100,160`,
`note-list-item.tsx:142`, `area-list-item.tsx:213`,
`relationship-list-item-header.tsx:149`, `dependency-list-item-header.tsx:136`,
`table-list-item-header.tsx:314`, `custom-type-list-item-header.tsx:239`,
`table-list-item-content.tsx:175,248,324`.

## Lo que ya está bien (verificado, no requiere cambio)

- **Foco de Radix Dialog/AlertDialog** (`src/components/dialog/dialog.tsx`,
  `src/components/alert-dialog/alert-dialog.tsx`, ambos sobre
  `@radix-ui/react-dialog`/`@radix-ui/react-alert-dialog`): Radix ya
  atrapa el foco dentro del modal mientras está abierto, lo devuelve al
  trigger al cerrar, y cierra con `Escape` — sin código propio adicional.
  Todos los diálogos de confirmación de borrado (`diagram-card.tsx`,
  `diagram-list-item.tsx`, etc.) heredan esto gratis.
- **`SidebarTrigger`** (`src/components/sidebar/sidebar.tsx:289-304`): botón
  de solo-ícono (`PanelLeft`) que **sí** tiene nombre accesible correcto —
  `<span className="sr-only">Toggle Sidebar</span>` — es el patrón que
  debería replicarse (y que se replica, con `aria-label` en vez de
  `sr-only`, en los fixes de §3/§5).
- **`--ring` alineado a `--primary`** (ya resuelto en Fase 1): el anillo de
  foco de `Button`/`Input`/`Textarea`/`Select`/etc. (todos vía
  `focus-visible:ring-ring`) es consistente entre light y dark mode.

## Fuera de alcance de esta fase

- Migrar el patrón `hidden .../group-hover:flex` en los ~10 archivos del
  side panel listados en §5 — mismo hallazgo, mismo fix, pero se posterga
  para no inflar el alcance (candidato directo de una fase futura de
  accesibilidad, "parte 2").
- Creación de relaciones/conexiones por teclado en el canvas: los `Handle`
  de `@xyflow/react` (`table-node-field.tsx:374-404`) no son elementos
  nativamente enfocables — hoy una relación solo se puede crear
  arrastrando con mouse. Es un hallazgo real pero de alcance arquitectónico
  mucho mayor (requeriría una interacción de teclado alternativa completa
  para crear conexiones); no se aborda acá.
- Reestructurar `tree-view.tsx` a un patrón ARIA `role="tree"`/`role="treeitem"`
  completo — el fix de esta fase es puntual (`aria-label` + `aria-expanded`
  en el botón existente), no una reescritura del componente.
- Herramienta de auditoría automatizada (axe-core, Lighthouse CI) — esta
  fase es una auditoría manual dirigida, no se agrega tooling nuevo.
- Contraste de `--destructive` en **light mode** — no está roto, no se toca.
- Traducción de los `aria-label` nuevos a inglés — todo el copy visible del
  proyecto está en español (igual que los `title=` ya existentes); los
  `aria-label` nuevos siguen esa misma convención.
- Cambios a arquitectura, API o SyncEngine.

## Próximos pasos

Este spec pasa a `writing-plans`.
