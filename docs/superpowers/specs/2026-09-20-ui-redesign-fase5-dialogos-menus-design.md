# Rediseño UI/UX de ChartDB — Fase 5: Diálogos y Menús

## Contexto

Quinto sub-proyecto del rediseño de UI/UX, y el primero de la lista
"Fase 5+" de `estructura-UI.md` (dialogs/menús — contenido y copy, no
color, el color ya quedó resuelto en Fase 4). A diferencia de las fases
1-4, esta no tuvo una sesión de brainstorming con el usuario (se pidió
avanzar directo); las decisiones de diseño de abajo son conservadoras y
se apoyan en patrones que ya existen en el propio código (reusar copy e
íconos que el proyecto ya usa para la misma acción en otro lugar, en vez
de inventar copy nueva).

**Alcance auditado** (contenido real, no de memoria): los 24 diálogos de
`src/dialogs/`, los menús contextuales del canvas (`table-node`,
`area-node`, `canvas-context-menu`, y el "menú" de facto de `note-node`),
los menús desplegables reusables (`dropdown-menu`, `context-menu`,
`list-menu`, `menubar`), y los tres lugares donde existe un menú de
"acciones sobre un diagrama" (`diagram-row-actions-menu` del editor,
`diagram-card`/`diagram-list-item` del dashboard).

**Hallazgo general**: la app tiene **dos sistemas de copy en paralelo**,
y eso es correcto, no un bug — el editor (heredado del ChartDB open
source) está internacionalizado de punta a punta (`react-i18next`, 22
locales en `src/i18n/locales/`), mientras que el dashboard (construido
desde cero en este fork) usa español hardcodeado a propósito, decisión
ya tomada explícitamente como "fuera de alcance" en el spec de Fase 3.
El problema real no es que existan dos sistemas — es que **dentro del
sistema que sí debería estar internacionalizado (el editor), varios
componentes se saltean `t()` sin razón**, mezclando copy hardcodeada con
copy traducida en el mismo menú o el mismo diálogo. Ese es el foco de
esta fase.

**Explícitamente fuera de alcance de esta fase**: color (ya resuelto en
Fase 4; cualquier `red-*`/`text-red-700` crudo que aparezca abajo se cita
solo como contexto, no se propone tokenizarlo en esta fase), traducir el
dashboard a i18n (decisión ya tomada), arquitectura/API/SyncEngine,
accesibilidad como auditoría completa (queda como candidato propio en
`estructura-UI.md`; esta fase solo agrega `aria-label` puntual donde ya
estamos tocando el archivo por otro motivo).

## 1. Copy hardcodeada e i18n roto en los menús contextuales del canvas

**Hallazgo**: de los tres menús contextuales del canvas (clic derecho
sobre una tabla, un área, o el lienzo vacío), dos están bien
internacionalizados y uno no:

| Menú | Archivo | Usa `t()` |
|---|---|---|
| `TableNodeContextMenu` | `table-node-context-menu.tsx` | Sí, en las 6 líneas de copy |
| `CanvasContextMenu` | `canvas-context-menu.tsx` | Sí, salvo una línea |
| `AreaNodeContextMenu` | `area-node-context-menu.tsx` | **No, ninguna de las 3** |

`area-node-context-menu.tsx:90,98,106` tiene el texto en inglés
hardcodeado directo en el JSX (`<span>Edit Area Name</span>`,
`<span>Auto Arrange</span>`, `<span>Delete Area</span>`), sin
`useTranslation` importado siquiera. Esto es inconsistente no solo con
sus dos hermanos (`TableNodeContextMenu`, `CanvasContextMenu`), sino con
**el propio menú "Acciones del Área" del sidebar**
(`area-list-item.tsx:114-142`), que gestiona la misma entidad `Area` con
las mismas dos acciones (editar nombre, eliminar) y ya tiene sus claves
traducidas a los 22 idiomas: `side_panel.areas_section.area.area_actions
.edit_name` (`'Edit Name'` / es: `'Editar Nombre'`) y `.delete_area`
(`'Delete Area'` / es: `'Eliminar Área'`). Hoy, si abrís el diagrama en
español, el menú del sidebar dice "Editar Nombre" / "Eliminar Área" y el
menú de clic derecho sobre la misma área dice "Edit Area Name" / "Delete
Area" en inglés — dos menús para la misma acción, con **texto distinto
en dos idiomas distintos**, según de cuál de los dos hiciste clic.

Además, dentro de `CanvasContextMenu`, el ítem "Import SQL/DBML"
(`canvas-context-menu.tsx:341`) es el único de los 8 ítems del menú que
no pasa por `t()` — está entre `t('canvas_context_menu.new_note')`
arriba y el ítem traducido de "mover a área" abajo.

Por último, `es.ts` tiene dos claves con el propio comentario `// TODO:
Translate` dejando el valor en inglés dentro de un objeto que es, por lo
demás, 100% español — `table_node_context_menu.duplicate_table`
(`es.ts:534`) y `.add_relationship` (`es.ts:536`) — así que el menú de
clic derecho de **Tabla** (el que ya usa `t()` correctamente) igual
muestra "Duplicate Table" y "Add Relationship" en inglés cuando el resto
del mismo menú está en español.

**Decisión**: cablear las 3 líneas de `AreaNodeContextMenu` a `t()`,
reusando las claves que ya existen en el sidebar para "editar
nombre"/"eliminar" (una sola fuente de verdad para el mismo copy en dos
menús, en vez de duplicarlo) y agregando una clave nueva solo para "Auto
Arrange" (acción que no existe en el menú del sidebar). Traducir
"Import SQL/DBML" con una clave nueva en el mismo namespace
`canvas_context_menu`. Completar las dos traducciones pendientes en
`es.ts`, quitando los comentarios `// TODO`.

**Claves nuevas** (agregadas a `en.ts` y `es.ts`; las otras 20 locales
heredadas del open source original no se tocan — `i18n.ts:85` ya define
`fallbackLng` a inglés, así que cualquier locale sin estas claves nuevas
cae automáticamente al inglés sin romperse, el mismo comportamiento que
ya tenían `duplicate_table`/`add_relationship` en español antes de este
fix):

| Clave | en | es |
|---|---|---|
| `canvas_context_menu.import_sql_dbml` | `Import SQL/DBML` | `Importar SQL/DBML` |
| `canvas_context_menu.auto_arrange_area` | `Auto Arrange` | `Organizar Automáticamente` (mismo texto que `reorder_diagram_alert.reorder`, que ya usa esa traducción para el "auto arrange" de todo el diagrama) |

**Claves reusadas sin cambios** (ya existen, solo se referencian desde
un componente nuevo): `side_panel.areas_section.area.area_actions
.edit_name`, `.delete_area`.

## 2. Menú de Nota sin estructura de menú ni copy traducida

**Hallazgo**: los tres tipos de nodo que se pueden crear desde
`CanvasContextMenu` (`Table`, `Area`, `Note`) deberían tener una
experiencia de "acciones sobre el nodo" comparable, pero solo dos la
tienen. `TableNodeContextMenu` y `AreaNodeContextMenu` son menús
`ContextMenu` de Radix (clic derecho), con label + separador + ícono
final, estructura idéntica entre sí. `NoteNode` (`note-node.tsx`) no
tiene ningún `ContextMenu` — en su lugar, expone una barra flotante de 3
botones solo-ícono que aparece al hacer hover
(`note-node.tsx:346-368`: lápiz para editar, `ColorPicker`, tacho para
eliminar), sin ningún texto visible y **sin `aria-label`** en ninguno de
los dos botones (`Button` en `note-node.tsx:348-355` y `:360-367`) — un
lector de pantalla anuncia "botón" sin decir para qué sirve.

Esto contrasta con el propio sidebar de la app: la lista de notas
(`side_panel/notes-tab`) sí tiene un menú "Note Actions" con clave i18n
completa (`side_panel.notes_section.note.note_actions`: `title: 'Note
Actions'`, `edit_content: 'Edit Content'`, `delete_note: 'Delete Note'`),
que hoy no se reusa en ningún lado del canvas.

Además, dentro del propio `note-node.tsx` hay dos strings de UI en
inglés hardcodeado sin pasar por `t()`, a pesar de que el archivo no usa
`useTranslation` en absoluto: el placeholder del textarea de edición
(`note-node.tsx:191`, `"Type your note here..."`) y el texto de ayuda que
se muestra cuando la nota está vacía (`note-node.tsx:339`, `"Double-click
to write (Markdown format)"`).

**Decisión (conservadora — no se rediseña la interacción)**: no se
agrega un `ContextMenu` de clic derecho a `NoteNode` en esta fase — sería
un cambio de patrón de interacción (¿debería tener "mover a área" como
Tabla? ¿tiene sentido un clic derecho en un elemento tan chico?) que
amerita su propia sesión de brainstorming, no una decisión unilateral.
Lo que sí se corrige, porque es puro copy/accesibilidad y no cambia la
estructura: (1) las 2 strings hardcodeadas pasan a `t()`, con 2 claves
nuevas; (2) los 2 botones de la barra flotante ganan `aria-label`,
reusando las claves que el sidebar ya tiene para las mismas dos acciones
(`edit_content`, `delete_note`) — mismo criterio de reuso que en el
punto 1.

**Claves nuevas** (agregadas a `en.ts`/`es.ts`, dentro de
`side_panel.notes_section.note`, junto a `empty_note`):

| Clave | en | es |
|---|---|---|
| `content_placeholder` | `Type your note here...` | `Escribe tu nota aquí...` |
| `edit_hint` | `Double-click to write (Markdown format)` | `Doble clic para escribir (formato Markdown)` |

## 3. Copy hardcodeada en inglés dentro de diálogos que ya usan i18n

**Hallazgo**: no es solo un problema de menús — dos diálogos de
formulario que en general están bien traducidos tienen strings
puntuales que se saltean `t()` a pesar de que el propio archivo importa
`useTranslation` y lo usa para el resto del contenido:

`table-schema-dialog.tsx` (título, descripción y botones ya usan `t()`
correctamente) tiene 4 strings hardcodeadas en la sección del cuerpo:

| Línea | Texto hardcodeado |
|---|---|
| `:186` | `Schema Name` (label del input) |
| `:195` | `` `Enter schema name.${defaultSchemaName ? ` e.g. ${defaultSchemaName}.` : ''}` `` (placeholder) |
| `:206` | `or` (separador entre "elegir esquema existente" / "crear uno nuevo") |
| `:219` | `No existing schemas available` (tooltip) |

`select-tables.tsx` (usa `t('new_diagram_dialog.back')` para el botón
"Atrás") tiene, entre otras, estas dos strings hardcodeadas
user-facing de alto tráfico (aparecen siempre que se importa una base de
datos con más de una tabla):

| Línea | Texto hardcodeado |
|---|---|
| `:390` | `Search tables...` (placeholder del buscador) |
| `:380-383` | `Due to performance limitations, you can import a maximum of {MAX_TABLES_IN_DIAGRAM} tables.` (banner de advertencia) |

**Decisión**: traducir estas 6 strings (las 4 de `table-schema-dialog` y
las 2 de más impacto de `select-tables`), con claves nuevas. Para
`table-schema-dialog`, como las 4 strings son idénticas sin importar cuál
de las 3 variantes del diálogo esté activa (`create_table_schema_dialog`
/ `update_table_schema_dialog` / `new_table_schema_dialog`, que sí
difieren en título/descripción/botones), se crea un namespace compartido
nuevo `table_schema_dialog` en vez de triplicar la clave en cada
variante. Para `select-tables`, como el archivo ya reusa
`new_diagram_dialog.back` para el botón "Atrás" (es un paso del wizard
de "nuevo diagrama"), las claves nuevas van al mismo namespace, dentro
de `new_diagram_dialog.import_database` (que ya existe y agrupa el resto
del copy de este mismo paso del wizard).

**Claves nuevas**:

| Clave | en | es |
|---|---|---|
| `table_schema_dialog.schema_name_label` | `Schema Name` | `Nombre del Esquema` |
| `table_schema_dialog.schema_name_placeholder` | `Enter schema name.` | `Ingresa el nombre del esquema.` |
| `table_schema_dialog.schema_name_example` | `e.g. {{schema}}.` | `ej. {{schema}}.` |
| `table_schema_dialog.or_separator` | `or` | `o` |
| `table_schema_dialog.no_schemas_tooltip` | `No existing schemas available` | `No hay esquemas existentes disponibles` |
| `new_diagram_dialog.import_database.search_tables_placeholder` | `Search tables...` | `Buscar tablas...` |
| `new_diagram_dialog.import_database.max_tables_warning` | `Due to performance limitations, you can import a maximum of {{max}} tables.` | `Por limitaciones de rendimiento, podés importar un máximo de {{max}} tablas.` |

**Deuda técnica anotada, no resuelta en esta fase**: `select-tables.tsx`
tiene más strings hardcodeadas del mismo tipo, atadas al mismo límite
`MAX_TABLES_IN_DIAGRAM` pero en mensajes secundarios/de borde —
`:365` (`` `Select up to ${MAX_TABLES_IN_DIAGRAM} to import.` ``) y
`:510` (`` `Can only select ${remainingCapacity} more tables
(${MAX_TABLES_IN_DIAGRAM} max limit)` ``, que además necesitaría
pluralización real). Se dejan sin tocar en esta fase para no convertir
"Fase 5: diálogos y menús" en una auditoría completa de i18n de un solo
diálogo — quedan documentadas para una pasada de i18n futura.

## 4. Iconografía inconsistente entre el menú de "acciones de diagrama" del editor y los del dashboard

**Hallazgo**: existen tres menús de "..." que operan sobre la misma
entidad `Diagram` con acciones equivalentes — dos en el dashboard
(`diagram-card.tsx:114-144`, `diagram-list-item.tsx:131-161`) y uno en el
editor (`diagram-row-actions-menu.tsx`, usado desde el diálogo "Abrir
Diagrama" del editor — `open-diagram-dialog`, alcanzable solo desde
dentro del editor vía `top-navbar/menu`, `editor-sidebar` y el atajo de
teclado correspondiente).

La diferencia de idioma entre ambos (dashboard en español hardcodeado,
editor con `t()`) **no es un bug** — es la misma separación
arquitectónica de siempre (dashboard fuera del alcance de i18n, decisión
de Fase 3). Lo que sí es un hallazgo real es que, para las mismas dos
acciones, cada lado eligió un ícono distinto sin motivo:

| Acción | Dashboard (`diagram-card.tsx`/`diagram-list-item.tsx`) | Editor (`diagram-row-actions-menu.tsx`) |
|---|---|---|
| Abrir | `ExternalLink` | `SquareArrowOutUpRight` |
| Duplicar | `Copy` | `Layers2` |

El ícono `Copy` para "duplicar" ya es, además, el que usa el propio
editor en otro menú hermano — `TableNodeContextMenu` usa exactamente
`Copy` para `duplicate_table` (`table-node-context-menu.tsx:242`). Es
decir, `Layers2` en `diagram-row-actions-menu.tsx` no solo no coincide
con el dashboard: tampoco coincide con la convención que el propio
editor ya usa para "duplicar" en otro lado.

**Decisión**: unificar el ícono de estas dos acciones a los que ya son
mayoría (`ExternalLink` para abrir, `Copy` para duplicar), cambiando
únicamente `diagram-row-actions-menu.tsx` (2 archivos del dashboard ya
usan el ícono "correcto", no se tocan). No se agrega la acción
"Renombrar" a `diagram-row-actions-menu.tsx` aunque el dashboard sí la
tiene — ver "Fuera de alcance".

## 5. Ya está bien: anchos de diálogo y orden de los botones de acción

Se auditaron los 24 diálogos de `src/dialogs/` buscando específicamente
los dos problemas que pide el brief (anchos sin razón, orden de botones
inconsistente) y en ambos casos el resultado es que **ya está bien,
no se propone ningún cambio**:

- **Anchos**: los diálogos simples de un paso (`table-schema-dialog`,
  `export-diagram-dialog`, `export-image-dialog`, `star-us-dialog`,
  `import-diagram-dialog`, `create-relationship-dialog`) se quedan en el
  ancho por default de `DialogContent` (`max-w-lg`, definido una sola vez
  en `dialog.tsx:78`). Los que lo overridean tienen una razón de
  contenido clara y consistente entre sí: los dos wizards de creación
  (`create-diagram-dialog.tsx:240`, `import-database-dialog.tsx:163`)
  comparten exactamente `md:max-w-[900px]` porque ambos muestran grillas
  de tarjetas de selección; los dos diálogos que muestran contenido
  denso/tabular (`open-diagram-dialog.tsx:136`, con una tabla de
  diagramas, y `export-sql-dialog.tsx:267`, con un visor de código SQL)
  usan anchos basados en `vw` en vez de `px` porque necesitan
  aprovechar el ancho de pantalla disponible, no un tamaño fijo. No hay
  dos diálogos de complejidad de contenido comparable con anchos
  distintos sin razón.
- **Orden de botones**: en los 13 diálogos con un footer de
  confirmar/cancelar (`table-schema-dialog`, `star-us-dialog`,
  `export-image-dialog`, `export-diagram-dialog`, `select-database`,
  `create-relationship-dialog`, `select-tables`, `base-alert-dialog`,
  entre otros), la acción secundaria (`Cancel`/`Cancelar`/`Back`) va
  siempre primero en el DOM (izquierda en LTR) y la acción primaria
  siempre al final (derecha) — sin ninguna excepción. Los diálogos de
  formulario usan `DialogFooter className="... md:justify-between"` para
  separarlos a los extremos; los `AlertDialog` (confirmaciones
  destructivas) los agrupan juntos a la derecha vía el `sm:justify-end`
  que trae `alert-dialog.tsx` por default — son dos variantes de layout
  legítimas para dos tipos de diálogo distintos (formulario vs.
  confirmación), no una inconsistencia: dentro de cada variante, el
  orden es 100% consistente.

## Fuera de alcance de esta fase

- Cualquier cambio de color (`text-red-700`, `text-red-500`,
  `bg-amber-50` citados arriba como contexto en `area-node-context-menu
  .tsx`, `table-node-context-menu.tsx`, `note-node.tsx`,
  `diagram-row-actions-menu.tsx` y `select-tables.tsx`) — Fase 4 ya
  resolvió el color de marca y de estado; estos son casos puntuales de
  rojo crudo sin tokenizar que quedan como deuda técnica para una futura
  pasada de color, no para esta fase de contenido/estructura.
- Traducir el dashboard a i18n (`diagram-card.tsx`, `diagram-list-item
  .tsx`, `dashboard-header.tsx` seguirán con copy en español hardcodeado
  — decisión ya tomada en Fase 3).
- Agregar la acción "Renombrar" a `diagram-row-actions-menu.tsx`. Ese
  menú es deliberadamente más chico (Abrir/Duplicar/Eliminar) porque
  vive dentro del flujo de "cambiar de diagrama abierto" del editor, no
  de gestión completa; renombrar el diagrama actual ya es posible desde
  el nombre editable del `top-navbar` (`diagram-name.tsx`). Igualar el
  set de acciones a los del dashboard sería una decisión de producto
  (¿debería poder renombrarse un diagrama que no es el actual, desde
  este diálogo?), no una corrección de copy/ícono.
- Rediseñar `NoteNode` para que tenga un `ContextMenu` de clic derecho
  igual a Tabla/Área (ver punto 2) — cambio de patrón de interacción,
  candidato para una sesión de brainstorming propia.
- Auditoría de accesibilidad completa (foco, navegación por teclado en
  menús, contraste, `aria-label` en componentes compartidos como
  `ColorPicker`) — ya está listada como fase propia candidata en
  `estructura-UI.md` ("Fase 5+... accesibilidad"); esta fase solo agrega
  `aria-label` puntual en `note-node.tsx` porque ya se está tocando ese
  archivo por el punto 2, no como barrido general.
- Las strings de `select-tables.tsx:365` y `:510` (ver nota de deuda
  técnica en el punto 3).
- Los 20 locales de `src/i18n/locales/` distintos de `en.ts`/`es.ts` —
  quedan sin las claves nuevas de esta fase y caen al inglés vía
  `fallbackLng` (mismo comportamiento que ya tenían las claves con
  `// TODO: Translate`), consistente con que este fork solo mantiene
  activamente inglés (base) y español (idioma real de uso).

## Próximos pasos

Este spec pasa a `writing-plans`.
