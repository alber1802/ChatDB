# Rediseño UI/UX de ChartDB — Fase 8: Responsive

## Contexto

Octava fase del rediseño de UI/UX (ver `.claude/commands/estructura-UI.md`
para la bitácora completa de Fases 1-4, ya mergeadas a `main`). Esta fase
retoma uno de los candidatos ya identificados para "Fase 5+" en esa
bitácora ("dialogs/menús, microinteracciones, accesibilidad, responsive,
performance") y lo aborda en solitario: **responsive**.

Alcance de la auditoría (código real, no de memoria): el layout
mobile/desktop del editor (`src/pages/editor-page/editor-page.tsx`,
`editor-desktop-layout.tsx`, `editor-mobile-layout.tsx`), la barra de
herramientas flotante y los controles del canvas
(`src/pages/editor-page/canvas/canvas.tsx`,
`src/pages/editor-page/canvas/toolbar/toolbar.tsx`), el dashboard
(`src/pages/diagrams-dashboard/`) y sus diálogos, y los diálogos comunes
que muestran contenido tabular/de ancho fijo (`src/dialogs/`,
`src/components/table/table.tsx`).

**Hallazgo general**: la app ya tiene una separación explícita
mobile/desktop bien establecida — el hook `useBreakpoint('md')`
(`src/hooks/use-breakpoint.ts`, basado en `react-responsive`, breakpoint
`768px`) decide entre `EditorDesktopLayoutLazy`/`EditorMobileLayoutLazy` en
`editor-page.tsx:41,95-103`, y esa misma bandera (`isMd`/`isDesktop`) se
reutiliza consistentemente en `SidePanel`, `EditorSidebar`, `canvas.tsx`,
`select-tables.tsx` e `import-database.tsx` para adaptar contenido —, y
varios flujos ya están correctamente resueltos: el diálogo de importación
(`import-database.tsx:576-599`) resuelve un `ResizablePanelGroup`
horizontal en desktop vs. una columna simple en mobile con una rama
explícita por `isDesktop`; `select-tables.tsx` reordena footer/paginación
con `flex-col-reverse`/`sm:`/`md:` de forma prolija; el dashboard
(`diagrams-dashboard.tsx`, `dashboard-toolbar.tsx`) ya usa
`sm:grid-cols-2 lg:grid-cols-3` y `md:flex-row` de forma consistente y no
necesita cambios. Por eso esta fase es de **ajuste dirigido**: 5 hallazgos
reales con impacto genuino, no un rediseño de ningún layout.

**Explícitamente fuera de alcance**: rediseñar la separación
mobile/desktop del editor (`isMd`/`useBreakpoint('md')` se mantiene tal
cual), agregar detección de orientación/tablet como caso nuevo, tocar
`admin-layout.tsx`/páginas de admin (no auditadas en esta fase), i18n,
arquitectura/API/SyncEngine.

## 1. El editor mobile pierde el indicador de estado de guardado del SyncEngine

**Hallazgo**: `TopNavbar` (desktop, `src/pages/editor-page/top-navbar/top-navbar.tsx:42-43`)
renderiza `<LastSaved />` dentro de
`<div className="hidden flex-1 items-center justify-end gap-2 sm:flex">` —
el componente `LastSaved` (`src/pages/editor-page/top-navbar/last-saved.tsx`)
es la única superficie de la UI que muestra "Guardando…", "Sin conexión" o,
crítico, **"Error al guardar"** con un botón de reintento (`last-saved.tsx:119-136`,
usa `useSyncStatus()`). `TopNavbarMobile`
(`src/pages/editor-page/top-navbar/top-navbar-mobile.tsx`, usado por
`EditorMobileLayout`) no importa ni renderiza `LastSaved` en ningún lado —
solo tiene logo, botón de menú, `LanguageNav` y "Cerrar Sesión"
(`top-navbar-mobile.tsx:20-64`). El `AGENTS.md` del proyecto documenta
explícitamente que un fallo de sync (por ejemplo, falta la columna
`version` en la base) hace que "el cliente lo reintenta indefinidamente
mostrando 'Error al guardar'" — en mobile ese mensaje simplemente no
existe: un usuario que edita desde el celular no tiene ninguna señal
visual de que sus cambios no se están guardando.

**Decisión**: agregar `<LastSaved />` a `TopNavbarMobile`, en la misma fila
que `LanguageNav`/"Cerrar Sesión" (`top-navbar-mobile.tsx:41-54`), antes de
`LanguageNav` — es un `Badge` compacto (`whitespace-nowrap`) que ya está
diseñado para caber en una barra angosta (se usa en desktop junto a otros
5 elementos en la misma fila). No se toca `last-saved.tsx` — el componente
ya es responsive por diseño (un solo `Badge`).

**Cambio en `top-navbar-mobile.tsx`**: agregar el import de `LastSaved` y
renderizarlo como primer hijo de la fila de la derecha.

## 2. El clúster de utilidades del canvas (top-left) puede solaparse con la toolbar principal en mobile

**Hallazgo**: en `canvas.tsx` hay dos `<Controls>` (paneles de React Flow)
independientes anclados al borde superior en mobile:

- El clúster de "snap to grid" / resaltado de tipo personalizado /
  aviso de tablas solapadas, siempre en `position="top-left"`
  (`canvas.tsx:1773-1779`), cuyo contenido es
  `<div className="flex flex-col items-center gap-2 md:flex-row">`
  (`canvas.tsx:1780`) — en mobile (`<md`) se apila **verticalmente** en la
  esquina superior izquierda; en desktop se acomoda en fila.
- La toolbar principal (`<Toolbar readonly={readonly} />`,
  `canvas.tsx:1927-1936`), que en desktop está en `bottom-center`
  (`canvas.tsx:1928`) pero en **mobile pasa a `top-center`** — la misma
  franja vertical que el clúster anterior.

En desktop no hay colisión posible: la toolbar principal vive en la parte
inferior del canvas, lejos del clúster superior izquierdo, sin importar
cuán ancha sea. En mobile, ambos paneles quedan anclados al mismo borde
superior sin ningún offset vertical que los coordine entre sí. La toolbar
principal (`src/pages/editor-page/canvas/toolbar/toolbar.tsx`) es una
`Card` de altura fija `h-[44px]` (`toolbar.tsx:92`) que en su variante no
readonly contiene 7 `ToolbarButton` de `w-[36px]` fijo cada uno
(`toolbar-button.tsx:16`) más un botón de zoom de `w-[60px]`
(`toolbar.tsx:156`) — un ancho intrínseco de ~330-340px que, al estar
centrada (`top-center`), en un viewport de 375px arranca a solo ~20px del
borde izquierdo, exactamente donde React Flow ancla por defecto el panel
`top-left`. El resultado es que ambos paneles compiten por la misma franja
de ~20-30px de ancho junto al borde superior izquierdo — el clúster de
utilidades queda parcial o totalmente tapado por la toolbar principal (o
viceversa, según orden de pintado), y sus botones (que sí son
interactivos cuando están visibles, como el aviso de tablas solapadas)
quedan difíciles o imposibles de presionar.

**Decisión**: empujar el clúster `top-left` hacia abajo con un offset
vertical explícito **solo en mobile**, mismo patrón ya usado en el propio
archivo para el botón "mostrar todo" cuando el usuario está perdido en el
canvas (`canvas.tsx:1908-1926`, que ya usa
`style={{ [isDesktop ? 'bottom' : 'top']: '70px' }}` para no pisar la
toolbar principal). Se aplica la misma técnica al `Controls
position="top-left"`, empujándolo por debajo de la toolbar principal
(44px de alto + el offset por defecto de React Flow) solo cuando
`!isDesktop`.

## 3. La toolbar del canvas no tiene margen ni fallback de overflow en viewports muy angostos

**Hallazgo**: continuación del punto 2 — el ancho intrínseco de ~330-340px
de la `Card` de `toolbar.tsx:92` no tiene ningún límite superior ni
mecanismo de overflow. En un viewport de referencia de 375px hay margen de
sobra (~35-45px), pero en dispositivos más angostos (320-360px, todavía
comunes en gamas bajas de Android) la toolbar puede exceder el ancho de
pantalla. La sección raíz del editor
(`src/pages/editor-page/editor-page.tsx:81`,
`className="... overflow-x-hidden"`) recorta cualquier overflow horizontal
en vez de permitir scroll, así que en esos anchos los botones de los
extremos (típicamente "Redo" o el disparador del filtro) quedan
recortados y son imposibles de presionar, sin ningún indicio visual de
que existen.

**Decisión**: en vez de rediseñar la toolbar (fuera de alcance), acotarla
con `max-w-[calc(100vw-2rem)]` (deja 1rem de margen de cada lado como
peor caso) y `overflow-x-auto` en la propia `Card`
(`toolbar.tsx:92`) — así, en el peor caso, la toolbar se vuelve
horizontalmente deslizable en vez de recortar botones sin aviso. No
cambia nada visualmente en ningún viewport ≥ ~360px (el `max-w` nunca se
activa ahí).

## 4. `DashboardHeader` no es responsive para cuentas admin/super_admin en viewports angostos

**Hallazgo**: `dashboard-header.tsx:67`
(`className="... flex h-16 ... items-center justify-between ... px-4 ... md:px-6"`)
es una fila única sin `flex-wrap` ni colapso de contenido. El lado derecho
(`dashboard-header.tsx:87-187`) apila, sin ninguna variante responsive:
botón "Admin Panel" con texto completo (solo si `isAdmin()`,
`dashboard-header.tsx:89-98`, ~116px de ancho por el ícono + texto +
padding), toggle de tema (`size-9`, 36px), `LanguageNav` (`size-6`, 24px
en mobile), y el avatar/dropdown de perfil (`size-9`, 36px). Sumado al
lado izquierdo (logo + badge "Dashboard", `dashboard-header.tsx:68-85`,
~165px) y el padding del header (`px-4` = 32px), el ancho mínimo de
contenido para una cuenta admin es de ~445-460px — por encima de un
viewport de 375px. Como no hay wrap ni scroll, el resultado es que el
botón "Admin Panel" y/o el avatar quedan parcialmente fuera de pantalla o
se aprietan contra el borde. Para cuentas no-admin el ancho total
(~315-330px) sí entra en 375px con margen razonable — el problema es
específico de `isAdmin()`.

**Decisión**: colapsar el botón "Admin Panel" a solo-ícono por debajo de
`sm` (768px no es necesario; alcanza con ocultar el texto), igual que ya
se hace con el toggle de tema y el avatar (ambos ya son ícono-solo por
diseño). Se envuelve el texto "Admin Panel" en un `<span className="hidden
sm:inline">`, dejando el ícono `ShieldCheck` siempre visible — reduce el
botón de ~116px a ~32px en mobile, suficiente para que el header completo
entre en 375px incluso para cuentas admin.

## 5. El componente base `Table` no tiene contenedor de scroll horizontal — afecta `OpenDiagramDialog` en viewports angostos

**Hallazgo**: `src/components/table/table.tsx:8-16` tiene el `<div
className="relative w-full overflow-auto">` que debería envolver el
`<table>` **comentado** (línea 9: `// <div className="relative w-full
overflow-auto">`, línea 15: `// </div>`) — el `<table>` se renderiza sin
ningún contenedor con scroll. Esto afecta a todo consumidor del
componente base `Table`, pero el caso concreto auditado en esta fase es
`OpenDiagramDialog` (`src/dialogs/open-diagram-dialog/open-diagram-dialog.tsx:136`):
su `DialogContent` solo define `md:min-w-[80vw] xl:min-w-[55vw]` — por
debajo de `md` (768px) no hay ningún ancho mínimo/máximo explícito, así
que hereda el `max-w-lg` (32rem/512px) del `DialogContent` base
(`src/components/dialog/dialog.tsx:78`). La tabla interna
(`open-diagram-dialog.tsx:147-243`) tiene 5 columnas visibles en mobile
(ícono, nombre, "última modificación" con `toLocaleString()` completo —
p. ej. "9/20/2026, 3:45:00 PM" —, cantidad de tablas, acciones; la columna
"creado" ya está oculta con `hidden sm:table-cell` en
`open-diagram-dialog.tsx:218`). Sin el wrapper de scroll, si el contenido
de la fila excede el ancho disponible del diálogo (probable en viewports
de 375px, donde el diálogo ocupa casi todo el ancho menos el padding
`p-6` del `DialogContent`), la tabla se desborda visualmente fuera de los
bordes redondeados del diálogo en vez de generar scroll horizontal
contenido — un defecto silencioso porque nada en el diálogo define
`overflow-x` para compensarlo (`DialogContent` de ese diálogo solo tiene
`overflow-y-auto`, `open-diagram-dialog.tsx:136`).

**Decisión**: restaurar el wrapper `overflow-auto` comentado en el
componente base `Table` (afecta a todo `Table` de la app, no solo a este
diálogo — es el fix de mayor apalancamiento y el más chico posible,
consistente con "ajustes puntuales" y no un rediseño de ningún diálogo en
particular). No se toca `open-diagram-dialog.tsx` — hereda el fix
automáticamente por usar el componente base `Table`, mismo patrón que la
sección "Fondo animado" de Fase 3 (un archivo compartido corregido una
vez, sin tocar a cada consumidor).

## Fuera de alcance de esta fase

- Rediseñar la separación mobile/desktop del editor (`useBreakpoint('md')`
  se mantiene, con el mismo breakpoint de `768px`).
- Detección de tablet/orientación como caso nuevo (no existe hoy, no se
  pidió).
- `admin-layout.tsx` y las páginas bajo `/admin` (no fueron parte de la
  auditoría de esta fase).
- i18n, arquitectura, API, SyncEngine.
- Cualquier ajuste puramente cosmético que no cambie una interacción real
  (por ejemplo, el ancho del `MiniMap` ya es `60x60` en mobile vs.
  `100x100` en desktop — `canvas.tsx:1940-1941` — y ya funciona bien, no
  se toca).
- El diálogo de importación de base de datos (`import-database.tsx`) y
  `select-tables.tsx`: auditados, ya manejan mobile correctamente con
  ramas explícitas por `isDesktop`/clases `sm:`/`md:` — no requieren
  cambios en esta fase.
- El grid/list y el toolbar del dashboard (`diagrams-dashboard.tsx`,
  `dashboard-toolbar.tsx`, `diagram-card.tsx`): auditados, ya usan
  breakpoints Tailwind correctamente (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3/4`, `flex-col md:flex-row`) — no requieren cambios.

## Próximos pasos

Este spec pasa a `writing-plans`.
