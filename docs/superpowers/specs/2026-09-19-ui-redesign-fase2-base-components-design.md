# Rediseño UI/UX de ChartDB — Fase 2: Componentes Base

## Contexto

Segundo sub-proyecto del rediseño de UI/UX (ver `docs/superpowers/specs/2026-09-18-ui-redesign-fase1-tokens-design.md`
para los tokens que esta fase consume, ya mergeados a `main`). Esta fase
corrige los componentes base (`src/components/`) que la auditoría original
identificó como desconectados del sistema de tokens o duplicados, sin tocar
dashboard, canvas, sidebar del editor ni dialogs específicos de negocio —
esos son sub-proyectos posteriores.

Precede a este spec una auditoría de código real (rutas, líneas, contenido
exacto de archivos) que fundamenta cada decisión de abajo.

**Explícitamente fuera de alcance**: arquitectura, lógica de negocio, API,
SyncEngine (igual que en toda fase de este rediseño). Tampoco se tocan
`TableNode`, `relationship-edge`, `editor-sidebar`, toolbar del canvas, ni
el dashboard — su pink hardcodeado y su propio uso de estos componentes
base se resuelve en fases posteriores que consumen lo que se arregla acá.

## 1. Sistema de Button

**Hallazgo**: `src/components/button/button-variants.tsx:9` hardcodea el
variant `default` en `bg-pink-600 ... hover:bg-pink-500`, el único punto
del sistema de botones que ignora el token `--primary` (azul, desde Fase
1). `button.tsx` no tiene colores hardcodeados — solo consume
`buttonVariants`.

**Cambio**: reemplazar la línea 9 de `button-variants.tsx` por una clase
basada en `bg-primary` (ej. `bg-primary text-primary-foreground shadow
hover:bg-primary/90`), manteniendo el resto del archivo intacto.

### `button-with-alternatives.tsx`

**Hallazgo**: líneas 82-85 extraen las clases `h-*` y `text-*` del
`className` del botón principal vía regex (`className.match(/h-\d+/)`) para
replicarlas en el botón del dropdown-trigger — un hack frágil, dependiente
del orden de las clases en el string. Tiene un único consumidor real en
todo el repo: `src/pages/editor-page/side-panel/tables-section/tables-section.tsx:160-184`,
que hoy pasa `className="h-8 p-2 text-xs"` en vez de usar la prop `size`
del propio componente (que ya soporta `sm: 'h-8 rounded-md px-3 text-xs'`
— coincide exactamente).

**Cambio**: eliminar las líneas 82-85 (el parsing por regex) de
`button-with-alternatives.tsx`. Actualizar el único consumidor
(`tables-section.tsx`) para pasar `size="sm"` en vez de
`className="h-8 p-2 text-xs"`. Con esto, ambos botones (principal y
dropdown-trigger) ya comparten `size`/`variant` de forma nativa vía
`buttonVariants({ variant, size })`, sin necesidad de leer el className del
otro.

## 2. Unificación de iconografía

**Hallazgo**: 16 archivos de componentes base todavía importan de
`@radix-ui/react-icons` en vez de `lucide-react` (que ya es la librería
dominante, usada en 95+ archivos). Cada uso confirmado es puramente
decorativo (solo `className` para tamaño/color), sin ninguna prop
específica de Radix — el swap es mecánico en los 16 casos.

**Mapeo verificado** (radix → lucide):

| Radix | Lucide | Archivos |
|---|---|---|
| `CheckIcon` | `Check` | menubar, select, context-menu, dropdown-menu, select-box, checkbox |
| `ChevronDownIcon` | `ChevronDown` | select, button-with-alternatives, accordion |
| `ChevronUpIcon` | `ChevronUp` | select |
| `ChevronRightIcon` | `ChevronRight` | menubar, context-menu, dropdown-menu, pagination, breadcrumb |
| `ChevronLeftIcon` | `ChevronLeft` | pagination |
| `DotFilledIcon` | `Dot` | menubar, context-menu, dropdown-menu |
| `DotsHorizontalIcon` | `MoreHorizontal` | pagination, breadcrumb |
| `Cross2Icon` | `X` | sheet, dialog, command/dialog, select-box |
| `CaretSortIcon` | `ChevronsUpDown` | select, select-box |
| `ViewVerticalIcon` | `PanelLeft` | sidebar |
| `MagnifyingGlassIcon` | `Search` | command |
| `DragHandleDots2Icon` | `GripVertical` | resizable |

**Archivos a migrar** (16): `menubar.tsx`, `select.tsx`, `sheet.tsx`,
`sidebar.tsx`, `dialog.tsx`, `button-with-alternatives.tsx`,
`command/command.tsx`, `command/dialog.tsx`, `context-menu.tsx`,
`dropdown-menu.tsx`, `pagination.tsx`, `resizable.tsx`, `select-box.tsx`,
`accordion.tsx`, `breadcrumb.tsx`, `checkbox.tsx`.

**Cambio**: en cada archivo, reemplazar el import de
`@radix-ui/react-icons` por el/los ícono(s) equivalente(s) de
`lucide-react` según la tabla, sin cambiar ninguna otra línea (mismas
clases, mismo uso). Una vez migrados los 16, quitar la dependencia
`@radix-ui/react-icons` de `package.json` (confirmar primero que no queda
ningún import fuera de estos 16 archivos).

## 3. Empty / EmptyState

**Hallazgo**: `EmptyState` (`src/components/empty-state/empty-state.tsx`)
ya está bien construido — es un wrapper delgado sobre los primitivos
`Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`
(`src/components/empty/empty.tsx`), que a su vez ya usan tokens
correctamente (`bg-muted`, `text-foreground`, `text-muted-foreground`,
`text-primary`). No hay una duplicación real de arquitectura que resolver
— el problema es puramente de contenido visual: `EmptyState` siempre
renderiza una ilustración PNG fija (`empty_state.png`/`empty_state_dark.png`)
en vez de un ícono, lo cual no encaja con la identidad "herramienta técnica
profesional" que persigue el rediseño. `EmptyState` tiene exactamente 5
consumidores reales, todos en `side-panel/`, todos con la misma forma
(ícono + título + descripción, a veces un botón de acción):

| Consumidor | Ícono nuevo | Justificación |
|---|---|---|
| `tables-section/tables-section.tsx` | `Table` | Coincide con el ícono de "Tablas" en `editor-sidebar.tsx` |
| `visuals-section/areas-tab/areas-tab.tsx` | `Group` | Áreas = agrupación visual de tablas; se usa `Group` (no `Shapes`) porque ya está importado en este mismo archivo para el botón "crear área" y coincide con el ícono de "Visuales" del sidebar — decisión tomada durante la implementación, ver plan. |
| `visuals-section/notes-tab/notes-tab.tsx` | `StickyNote` | Literal y claro |
| `custom-types-section/custom-types-section.tsx` | `FileType` | Coincide con el ícono de "Tipos personalizados" en `editor-sidebar.tsx` |
| `refs-section/refs-section.tsx` | `Workflow` | Coincide con el ícono de "Referencias" en `editor-sidebar.tsx` |

**Cambio**:
1. `EmptyStateProps` gana una prop nueva `icon: LucideIcon` (reemplaza el
   uso fijo de `EmptyStateImage`/`EmptyStateImageDark`). `EmptyState`
   renderiza `<EmptyMedia variant="icon"><Icon className="size-6" /></EmptyMedia>`
   en vez de la etiqueta `<img>`.
2. Quitar los imports de `EmptyStateImage`/`EmptyStateImageDark` y el hook
   `useTheme` si deja de usarse en el archivo tras el cambio (`effectiveTheme`
   solo se usaba para elegir la imagen light/dark — ya no hace falta).
3. Los 5 consumidores pasan su ícono correspondiente según la tabla de
   arriba.
4. Borrar `src/assets/empty_state.png` y `src/assets/empty_state_dark.png`
   (sin otros consumidores confirmados — la única referencia en todo `src/`
   es `empty-state.tsx`).
5. Corregir `EmptyDescription` en `empty.tsx`: hoy renderiza un `<div>`
   pese a tipar sus props como `React.ComponentProps<'p'>` y llamarse
   "Description" — cambiar el elemento a `<p>` para que coincida con su
   propio tipo y sea semánticamente correcto.

## Fuera de alcance de esta fase

- `empty-dashboard.tsx` (estado vacío del dashboard) — es un componente
  completamente distinto, no usa `Empty`/`EmptyState`; se aborda en la
  fase de Dashboard.
- Cualquier pink hardcodeado fuera de `button-variants.tsx` (TableNode,
  toolbar, sidebar del editor, relationship-edge, etc.) — fases
  posteriores (Editor/Canvas, Sidebar/Toolbar).
- `src/components/scroll-area/scroll-area.tsx:15` usa `rounded-[inherit]`
  — es una palabra clave CSS legítima (hereda el radius del padre), no un
  valor arbitrario a normalizar; no se toca.

## Próximos pasos

Este spec pasa a `writing-plans`. Las fases siguientes (Dashboard,
Editor/Canvas, Sidebar/Toolbar, Dialogs, microinteracciones,
accesibilidad/responsive/performance) se brainstorman por separado.
