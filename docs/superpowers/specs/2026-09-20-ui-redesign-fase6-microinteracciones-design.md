# Rediseño UI/UX de ChartDB — Fase 6: Microinteracciones

## Contexto

Sexta sub-fase del rediseño de UI/UX. No hay sesión de brainstorming previa
con el usuario para esta fase — las decisiones de diseño de abajo las tomé
yo mismo durante la auditoría, documentando la razón de cada una y
manteniéndolas consistentes con los principios ya establecidos en fases
anteriores: sobriedad, ningún gradiente/efecto decorativo fuera de lo ya
acordado (Fase 1), "canvas como superficie liviana, sin animación continua,
sin sobrecargar de motion" (bitácora, sección de convenciones).

**Alcance de esta fase**: pulido de microinteracciones — estados de
hover/press/focus, transiciones de aparición/desaparición, feedback táctil
en botones/tarjetas/nodos del canvas — en toda la app. Explícitamente
**fuera de alcance**: color (ya resuelto en Fases 1 y 4), accesibilidad,
responsive, performance (fases separadas, sin brainstormear todavía).

Precede a este spec una auditoría de código real (no de memoria): grep del
patrón ya usado como precedente en el código (`transition-all
duration-200`, presente hoy en `table-node-field.tsx`,
`canvas/toolbar/toolbar.tsx`, `top-navbar.tsx`, `editor-desktop-layout.tsx`,
`empty-dashboard.tsx`, `dashboard-header.tsx`, `admin/_components/stat-card.tsx`
y `admin-sidebar.tsx`), grep de `hover:scale-*`/`active:scale-*` en todo
`src/`, lectura completa de los componentes de Radix ya envueltos
(`popover`, `dropdown-menu`, `context-menu`, `tooltip`, `hover-card`,
`select`, `sheet`, `dialog`, `menubar`, `command/dialog`, `accordion`) y
lectura de los archivos de canvas (`table-node.tsx`, `area-node.tsx`,
`note-node.tsx`), del contexto de sync (`sync-status-context.tsx`,
`last-saved.tsx`) y de las listas del side panel (`table-list-item.tsx`,
`relationship-list-item.tsx`, `dependency-list-item.tsx`,
`custom-type-list-item.tsx`, `note-list-item.tsx`, `area-list-item.tsx`).

**Hallazgo general positivo (nada que tocar)**: los popovers, dropdowns,
context menus, tooltips, hover cards, sheets, dialogs, menubars y el
command palette **ya tienen** entrada/salida animada consistente —
heredan `data-[state=open]:animate-in data-[state=closed]:animate-out`
(con `fade-in-0`/`zoom-in-95`/`slide-in-from-*` según el componente) del
wrapper compartido de Radix + `tailwindcss-animate`. No hay ningún
popover/dropdown/tooltip "mudo" (sin animación) al lado de otro que sí
anime — la inconsistencia que se buscó explícitamente en la auditoría no
existe en la práctica. `table-node-field.tsx` (filas de campos dentro de
una tabla en el canvas) tampoco necesita cambios: ya usa
`transition-all duration-200 ease-in-out` tanto en el hover del ícono de
colapso como en la altura/opacidad del propio campo — es la referencia que
varios de los hallazgos de abajo buscan igualar.

## 1. Estado del SyncEngine (`Guardando…`/`Sin conexión`/`Error`/`Guardado`) cambia de golpe

**Hallazgo**: `src/pages/editor-page/top-navbar/last-saved.tsx:95-157`.
`LastSaved` tiene **4 `return` tempranos** distintos según `status`
(`saving` → línea 96, `offline` → línea 108, `error` → línea 120, default
`idle`/`saved` → línea 138), cada uno devolviendo un árbol JSX diferente
(`Badge` con o sin `Tooltip` envolvente, ícono distinto). No hay ningún
wrapper compartido entre las 4 ramas, así que cada cambio de estado
(p. ej. `saving` → `saved` al terminar un guardado, o `error` → `saving` al
reintentar) se resuelve como un **desmontaje + montaje instantáneo** de
nodos DOM completamente distintos — el badge "parpadea"/salta en vez de
transicionar, justo en el indicador que el usuario mira para confirmar que
su trabajo se guardó. Es el mismo tipo de problema de UX que ya motivó el
fix #2 de la bitácora de bugs (falsos conflictos de sync) — no corrompe
datos, pero sí comunica mal el estado real.

**Decisión**: crossfade de opacidad puro (sin escala, sin desplazamiento)
entre estados, usando el paquete `motion` ya consolidado en Fase 1
(`import { motion, AnimatePresence } from 'motion/react'`, mismo patrón que
`auth-card.tsx`, `waitlist-modal.tsx`, `tree-view.tsx`). Valores exactos:
`opacity: 0 → 1`, `duration: 0.15`, `ease: 'easeOut'`, `AnimatePresence
mode="wait"` (se prefiere sobre `"sync"`/`"popLayout"` porque el ancho del
badge cambia entre estados — p. ej. "Guardando…" vs. la fecha relativa de
`TimeAgo` — y montar el badge entrante mientras el saliente todavía ocupa
espacio en un `flex` sin posicionamiento absoluto produciría un salto de
layout visible por ~150ms; `mode="wait"` evita ese salto a costa de un
retraso imperceptible de 150ms, que es la contrapartida correcta acá).
150ms (no los 200ms usados en otros lugares del código) porque es un
indicador de estado que debe sentirse inmediato, no una aparición de
contenido nuevo.

**Cambio**: envolver el contenido de las 4 ramas en un único
`<AnimatePresence mode="wait" initial={false}>` +
`<motion.div key={status} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }}>`,
sin cambiar ningún badge/ícono/texto existente. Detalle completo en el plan
de implementación.

## 2. Feedback de "presión" (`active:scale`) inconsistente entre botones

**Hallazgo**: `src/components/button/button-variants.tsx` (el `cva` base
que usa el componente `Button` en toda la app) **no tiene ningún
`active:scale`** — su clase base es solo `transition-colors` (línea 4) y
ninguna de sus 6 variantes (`default`/`destructive`/`outline`/`secondary`/
`ghost`/`link`, líneas 8-17) agrega feedback de presión. Sin embargo, 4
sitios de uso del mismo componente `Button` le agregan `active:scale-*` a
mano, con valores distintos entre sí:
- `dashboard-toolbar.tsx:143` (CTA "Nuevo Diagrama") → `active:scale-95`
- `empty-dashboard.tsx:32` (CTA "Crear tu primer diagrama") →
  `active:scale-95`
- `auth-card.tsx:395` (botón de submit de login/registro) →
  `active:scale-[0.98]`
- `waitlist-modal.tsx:244` (botón "Solicitar Acceso") →
  `active:scale-[0.98]`

El resultado: presionar el CTA del dashboard se siente distinto (más
"blando", -5%) que presionar el botón de submit de login (-2%), y el
99% restante de los usos de `Button` en la app (todos los diálogos, la
toolbar del canvas, los botones de las listas del side panel, los diálogos
de export/import, el panel de admin) no tiene ningún feedback táctil al
soltar el click — la única señal es el cambio de color de `hover`, que
además desaparece en el instante del click porque no hay estado
`:active` propio.

**Decisión**: mover el feedback de presión al componente base
(`buttonVariants`) en vez de dejarlo como una adición ad hoc por sitio de
uso, y estandarizar en **`active:scale-[0.98]`** (el valor menos agresivo
de los dos que ya convivían, más alineado con el principio de sobriedad de
la app) para las variantes que tienen relleno o borde visible —
`default`, `destructive`, `secondary`, `outline`. **Se excluye
deliberadamente `ghost` y `link`**: son las variantes usadas para botones
de ícono chicos y densos (toolbar del canvas, filas de la lista de campos,
menús) donde un 2% de escala es casi imperceptible a ese tamaño y
introduce más costo de repintado que beneficio — para esos casos el cambio
de color de fondo en `hover`/`:active` (que ya tienen) es la señal
correcta, tal como ya lo hace `table-node-field.tsx`. La transición base
pasa de `transition-colors` a `transition-all duration-150` (150ms porque,
igual que el hallazgo #1, es feedback de interacción que debe sentirse
inmediato — y es además el valor que Tailwind ya aplica por default en
cada uso existente sin duration explícita de `hover:scale-110`/
`active:scale-*` en el resto del código, así que no introduce un timing
nuevo, solo lo hace explícito y consistente).

**Cambio**: agregar `active:scale-[0.98]` a las 4 variantes mencionadas en
`button-variants.tsx`, cambiar la clase base a `transition-all
duration-150`, y **quitar** el `active:scale-95`/`active:scale-[0.98]`
duplicado de los 4 sitios de uso (ya lo van a heredar del componente base;
dejarlo en ambos lados no rompe nada funcionalmente pero es una
declaración muerta que además puede quedar sujeta a qué regla generada
por Tailwind gana en la cascada). Detalle completo en el plan.

## 3. Selección/hover/arrastre de nodos del canvas sin transición

**Hallazgo**: los 3 tipos de nodo del canvas (tabla, área, nota) cambian su
`border-color`/`box-shadow`/anillo al seleccionarse, des-seleccionarse o
pasar el mouse por encima, y ninguno de los 3 transiciona ese cambio:

- `table-node.tsx:350`: la clase base es `'... rounded-lg shadow-sm
  transition-transform duration-300'`. La `transition-transform` es
  **código muerto** para este propósito — nada en este `div` cambia su
  `transform` vía clase o estilo inline; los únicos `transform: scale(...)`
  del nodo vienen de las animaciones `animate-scale`/`animate-scale-2`
  (`tailwind.config.js:112-131`, `1s ease-in-out`), que son animaciones CSS
  con su propio timing, no gobernadas por la propiedad `transition`. El
  cambio real y visible — `border-slate-500` ⇄ `border-primary` al
  seleccionar/hover (línea 352-354), el anillo azul de `isOverlapping`
  (línea 355-357) — ocurre sin ninguna transición: aparece/cambia de golpe.
- `area-node.tsx:122`: `'relative flex h-full flex-col rounded-md border-2
  shadow-sm'` — **cero** clases de `transition` en todo el contenedor. El
  cambio `border-transparent` ⇄ `border-primary` al seleccionar (línea 123)
  es instantáneo.
- `note-node.tsx:143`: `'flex h-full flex-col overflow-hidden rounded-[6px]
  border'` — también sin ninguna clase de `transition`. Mismo problema con
  `border-slate-500` ⇄ `border-primary` (líneas 144-146).

Además, ninguno de los 3 usa la prop `dragging` (ya recibida de React Flow
y ya desestructurada en los 3 componentes — `table-node.tsx:77`,
`area-node.tsx:43`, `note-node.tsx` en la desestructuración de props del
componente) para dar ningún indicio visual de que el nodo está "levantado"
mientras se arrastra: hoy `dragging` solo se usa para *apagar* el anillo de
foco mientras se arrastra (`table-node.tsx:243`, patrón espejado en
`area-node.tsx:52` y `note-node.tsx:39`), nunca para *agregar* feedback. El
resultado es que arrastrar una tabla o un área se siente rígido: no hay
ninguna señal de "esto se despegó de la superficie" al tomarlo ni "esto se
asentó" al soltarlo.

**Decisión**: dos cambios puntuales, ambos solo con CSS/Tailwind (sin
`motion`, porque son transiciones de propiedades CSS simples, no
animaciones con curvas custom — coherente con "canvas como superficie
liviana"):
1. Transicionar específicamente `border-color` y `box-shadow` (no todas
   las propiedades, y explícitamente **no** `width`/`height`/`transform` —
   esas las gobierna React Flow en vivo durante el resize/drag, y
   agregarles una transición CSS competiría con esa animación cuadro a
   cuadro y se sentiría con lag). Valor: `transition-[border-color,box-shadow]
   duration-150` (150ms — selección es feedback de interacción directa,
   mismo criterio que #1 y #2, no 200ms).
2. Mientras `dragging` es `true`, subir la sombra de `shadow-sm` (o nada,
   en el caso de notas) a `shadow-lg` — una elevación sutil, ya usada en
   otras partes de la app como máximo de énfasis en hover
   (`diagram-card.tsx:75` usa hasta `shadow-2xl` en hover de tarjeta, así
   que `shadow-lg` para un nodo "levantado" en el canvas es conservador en
   comparación). Al soltar, `dragging` vuelve a `false` y la transición del
   punto 1 se encarga de que la sombra vuelva a su tamaño normal con
   suavidad en vez de un salto — es la señal de "esto se asentó" al soltar
   que hoy falta.

**Cambio**: en los 3 archivos, agregar la clase de transición a la base y
un condicional sobre `dragging` para la sombra, y agregar `dragging` a los
arrays de dependencias de los `useMemo` que ya existían (`table-node.tsx`,
`area-node.tsx`) donde corresponda. Detalle completo (diffs exactos) en el
plan.

## 4. Filas de "Notas" y "Áreas" en el side panel no transicionan el hover, a diferencia de sus pares

**Hallazgo**: en el side panel del editor hay 6 tipos de lista colapsable/
reordenable (Tablas, Relaciones, Dependencias, Tipos personalizados, Notas,
Áreas). Las primeras 4 están implementadas sobre `AccordionTrigger`
(`src/components/accordion/accordion.tsx:35`), cuya clase base **ya**
incluye `transition-all` — así que aunque el `hover:bg-accent` se agregue
en el sitio de uso (`table-list-item.tsx:38`, `relationship-list-item.tsx:23`,
`dependency-list-item.tsx:23`, `custom-type-list-item.tsx:38`), el fundido
de color sí ocurre, heredado gratis del componente base. Notas y Áreas, en
cambio, **no** son acordeones (son filas simples, arrastrables con
`dnd-kit` pero sin contenido colapsable) y su `hover:bg-accent/5` está en
un `<div>` plano sin ningún componente base que aporte `transition`:
- `note-list-item.tsx:103`: `className="w-full rounded-md border
  border-border hover:bg-accent/5"`
- `area-list-item.tsx:152`: exactamente la misma clase, `className="w-full
  rounded-md border border-border hover:bg-accent/5"`

El efecto práctico: pasar el mouse por una tabla o una relación en la lista
del sidebar se ve suave; pasar el mouse por una nota o un área se ve un
"parpadeo" de fondo instantáneo — inconsistencia real y visible entre
secciones que viven una al lado de la otra en el mismo panel.

**Decisión**: agregar `transition-colors duration-200` (200ms, no 150 —
esto es aparición/desaparición de un fondo de hover al pasar el mouse, no
feedback de presión inmediato; sigue el precedente ya establecido de
`transition-all duration-200` para este tipo de interacción). Se usa
`transition-colors` (no `transition-all`) porque lo único que cambia es
`background-color` — no hay razón para pagar el costo de transicionar
propiedades que no cambian. Nota técnica menor documentada pero no
bloqueante: ambas filas reciben también un `style` inline de `useSortable`
(`dnd-kit`) que puede incluir su propio `transition: transform …` mientras
el usuario reordena *otra* fila de la misma lista; como ese estilo inline
solo declara `transform`, no pisa la propiedad `background-color` que
gobierna esta clase — coexisten sin conflicto. Es el mismo patrón que ya
usa `table-list-item.tsx` (también con `useSortable`) sin que nadie lo haya
reportado como un problema.

**Cambio**: agregar `transition-colors duration-200` a la clase de ambos
`div`. Detalle en el plan.

## 5. `hover:scale-[102%]` en tarjetas públicas de templates/ejemplos, inconsistente con el resto de la app

**Hallazgo**: `template-card.tsx:24` y `example-card.tsx:36` (páginas
públicas `/templates` y `/examples`, fuera del dashboard/editor) escalan al
110%... perdón, al 102% en hover (`hover:scale-[102%]`), sumado a
`hover:border-primary`. Es la **única** tarjeta de tipo "grid de opciones
para elegir" en toda la app que escala al hover — la tarjeta análoga y más
reciente del dashboard, `diagram-card.tsx:75` (implementada en Fase 3,
`transition-all duration-300 hover:border-primary/30 hover:bg-card/85
hover:shadow-2xl`), deliberadamente **no** escala: comunica "seleccionable"
con borde + fondo + sombra, no con movimiento. `template-card.tsx` y
`example-card.tsx` no fueron tocadas en la migración de colores de Fase 4
(esa fase solo tocó clases de color, no de transform), así que llegaron a
esta fase con el efecto de escala pre-existente sin que nadie lo hubiera
revisado bajo el principio de "sin animaciones vistosas tipo landing page"
que ya rige el resto del rediseño.

**Decisión**: quitar `hover:scale-[102%]` de ambos archivos, dejando el
resto de la transición (`transition duration-300 ease-in-out
hover:border-primary`) intacta — el borde ya comunica "esto es
seleccionable/interactivo" sin necesidad de mover la tarjeta, alineando
estas dos páginas públicas con el criterio ya aplicado al dashboard.

**Cambio**: quitar únicamente la clase `hover:scale-[102%]` de la cadena de
clases en ambos archivos (una sola clase por archivo, sin tocar nada más
de esa línea). Detalle en el plan.

## Fuera de alcance de esta fase

- Cualquier cambio de color (ya resuelto en Fases 1 y 4).
- Accesibilidad (`prefers-reduced-motion`, contraste, foco de teclado más
  allá del `focus-visible:ring` que ya existe) — fase separada, sin
  brainstormear.
- Responsive/mobile — fase separada, sin brainstormear.
- Performance (virtualización de `TableNode`, tamaño de bundle) — fase
  separada, deuda técnica ya anotada en `AGENTS.md`.
- Cualquier animación decorativa nueva (parallax, animaciones de fondo,
  ilustraciones animadas) — contradice el principio ya establecido.
- Popovers/dropdowns/tooltips/context menus/dialogs: ya están bien
  resueltos (ver hallazgo general arriba), no se toca ninguno.
- `admin-sidebar.tsx:123` (su propio `active:scale-[0.99]` en un `<button>`
  crudo, no el componente `Button`): queda como está — no usa
  `buttonVariants`, así que el cambio del hallazgo #2 no lo afecta ni
  requiere tocarlo, y no forma parte de ninguna lista de tarjetas del
  hallazgo #5.
- Contenido/copy de dialogs y menús (candidato ya anotado como "Fase 5+" en
  la bitácora, distinto de esta fase de microinteracciones).

## Próximos pasos

Este spec pasa a `writing-plans`.
