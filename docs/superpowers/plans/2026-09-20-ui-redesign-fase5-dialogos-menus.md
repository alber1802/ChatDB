# Fase 5 — Diálogos y Menús Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la copy hardcodeada en inglés que rompe la
internacionalización del editor en 3 menús contextuales del canvas, 1
nodo del canvas y 2 diálogos de formulario; y unificar los íconos
usados para las mismas dos acciones ("abrir"/"duplicar" un diagrama)
entre el menú de acciones de diagrama del editor y los del dashboard.
Ningún cambio de esta fase toca color, arquitectura, ni el sistema de
sync.

**Architecture:** Cuatro tareas independientes entre sí (no hay
dependencias de código entre ellas, solo comparten dos archivos de
datos de i18n que cada tarea edita en secciones distintas): (1) los
menús contextuales del canvas (`area-node-context-menu.tsx`,
`canvas-context-menu.tsx`) ganan `t()` donde faltaba, reusando claves
del sidebar donde ya existen; (2) `note-node.tsx` gana `t()` y
`aria-label` en su barra flotante de acciones; (3) `table-schema-dialog
.tsx` y `select-tables.tsx` ganan `t()` en las strings que se lo habían
saltado; (4) `diagram-row-actions-menu.tsx` cambia 2 íconos para
coincidir con el resto de la app. Las tareas 1-3 agregan claves nuevas a
`src/i18n/locales/en.ts` y `src/i18n/locales/es.ts` únicamente (las
otras 20 locales caen a inglés vía `fallbackLng`, ver spec).

**Tech Stack:** React, TypeScript, `react-i18next` (ya dependencia,
patrón ya usado en los mismos archivos), Radix `ContextMenu`/
`DropdownMenu` (sin cambios de API), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-20-ui-redesign-fase5-dialogos-menus-design.md`

## Global Constraints

- No tocar color (`text-red-700`, `bg-amber-50`, etc. quedan igual —
  deuda anotada, no de esta fase).
- No traducir el dashboard (`diagram-card.tsx`, `diagram-list-item.tsx`,
  `dashboard-header.tsx` no se tocan).
- No agregar la acción "Renombrar" a `diagram-row-actions-menu.tsx`.
- No agregar un `ContextMenu` de clic derecho a `NoteNode` — solo copy y
  `aria-label` en la barra flotante que ya existe.
- No agregar claves nuevas a ningún locale salvo `en.ts` y `es.ts`.
- No tocar `select-tables.tsx:365` ni `:510` (deuda técnica anotada en
  el spec, fuera de alcance de esta fase).
- **Nota sobre testing**: las 4 tareas son cambios de copy/i18n e ícono
  sin lógica de negocio nueva — verificación vía `npx tsc -b`/`npx vite
  build` (nunca `pnpm run build`, ver nota de CRLF en `estructura-UI.md`)
  + inspección visual manual cambiando el idioma de la app entre inglés
  y español desde el selector de idioma existente.

---

## Task 1: i18n en los menús contextuales del canvas (Área y Canvas)

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/es.ts`
- Modify: `src/pages/editor-page/canvas/area-node/area-node-context-menu.tsx`
- Modify: `src/pages/editor-page/canvas/canvas-context-menu.tsx`

**Interfaces:**
- Consumes: claves i18n existentes `side_panel.areas_section.area.area_actions.edit_name` y `.delete_area` (ya existen en las 22 locales, usadas hoy solo por `area-list-item.tsx`).
- Produces: 2 claves i18n nuevas (`canvas_context_menu.import_sql_dbml`, `canvas_context_menu.auto_arrange_area`) que ninguna otra tarea de este plan consume.

- [ ] **Step 1: Agregar las 2 claves nuevas a `en.ts`**

Ubicar este bloque exacto (`en.ts:511-517`):

```ts
        canvas_context_menu: {
            new_table: 'New Table',
            new_view: 'New View',
            new_relationship: 'New Relationship',
            new_area: 'New Area',
            new_note: 'New Note',
        },
```

Reemplazarlo por:

```ts
        canvas_context_menu: {
            new_table: 'New Table',
            new_view: 'New View',
            new_relationship: 'New Relationship',
            new_area: 'New Area',
            new_note: 'New Note',
            import_sql_dbml: 'Import SQL/DBML',
            auto_arrange_area: 'Auto Arrange',
        },
```

- [ ] **Step 2: Agregar las 2 claves nuevas a `es.ts`, y arreglar los 2 `// TODO: Translate`**

Ubicar este bloque exacto (`es.ts:524-539`):

```ts
        canvas_context_menu: {
            new_table: 'Nueva Tabla',
            new_view: 'Nueva Vista',
            new_relationship: 'Nueva Relación',
            new_area: 'Nueva Área',
            new_note: 'Nueva Nota',
        },

        table_node_context_menu: {
            edit_table: 'Editar Tabla',
            duplicate_table: 'Duplicate Table', // TODO: Translate
            delete_table: 'Eliminar Tabla',
            add_relationship: 'Add Relationship', // TODO: Translate
            move_to_area: 'Mover a Área',
            no_area: 'Sin Área',
        },
```

Reemplazarlo por:

```ts
        canvas_context_menu: {
            new_table: 'Nueva Tabla',
            new_view: 'Nueva Vista',
            new_relationship: 'Nueva Relación',
            new_area: 'Nueva Área',
            new_note: 'Nueva Nota',
            import_sql_dbml: 'Importar SQL/DBML',
            auto_arrange_area: 'Organizar Automáticamente',
        },

        table_node_context_menu: {
            edit_table: 'Editar Tabla',
            duplicate_table: 'Duplicar Tabla',
            delete_table: 'Eliminar Tabla',
            add_relationship: 'Agregar Relación',
            move_to_area: 'Mover a Área',
            no_area: 'Sin Área',
        },
```

- [ ] **Step 3: Cablear `area-node-context-menu.tsx` a `t()`**

Agregar el import. El bloque actual de imports es (`area-node-context-menu.tsx:1-14`):

```tsx
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/context-menu/context-menu';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useChartDB } from '@/hooks/use-chartdb';
import type { Area } from '@/lib/domain/area';
import { arrangeTablesForArea } from '@/lib/utils/area-utils';
import { LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import React, { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
```

Reemplazarlo por:

```tsx
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/context-menu/context-menu';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useChartDB } from '@/hooks/use-chartdb';
import type { Area } from '@/lib/domain/area';
import { arrangeTablesForArea } from '@/lib/utils/area-utils';
import { LayoutGrid, Pencil, Trash2 } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
```

Agregar el hook. El bloque actual es (`area-node-context-menu.tsx:24-33`):

```tsx
    const {
        removeArea,
        readonly,
        tables,
        relationships,
        updateTablesState,
        updateArea,
    } = useChartDB();
    const { isMd: isDesktop } = useBreakpoint('md');
    const { getNodes } = useReactFlow();
```

Reemplazarlo por:

```tsx
    const {
        removeArea,
        readonly,
        tables,
        relationships,
        updateTablesState,
        updateArea,
    } = useChartDB();
    const { isMd: isDesktop } = useBreakpoint('md');
    const { getNodes } = useReactFlow();
    const { t } = useTranslation();
```

Reemplazar los 3 ítems del menú. El bloque actual es
(`area-node-context-menu.tsx:85-108`):

```tsx
                {onEditName ? (
                    <ContextMenuItem
                        onClick={onEditName}
                        className="flex justify-between gap-3"
                    >
                        <span>Edit Area Name</span>
                        <Pencil className="size-3.5" />
                    </ContextMenuItem>
                ) : null}
                <ContextMenuItem
                    onClick={autoArrangeHandler}
                    className="flex justify-between gap-3"
                >
                    <span>Auto Arrange</span>
                    <LayoutGrid className="size-3.5" />
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={removeAreaHandler}
                    className="flex justify-between gap-3"
                >
                    <span>Delete Area</span>
                    <Trash2 className="size-3.5 text-red-700" />
                </ContextMenuItem>
```

Reemplazarlo por:

```tsx
                {onEditName ? (
                    <ContextMenuItem
                        onClick={onEditName}
                        className="flex justify-between gap-3"
                    >
                        <span>
                            {t(
                                'side_panel.areas_section.area.area_actions.edit_name'
                            )}
                        </span>
                        <Pencil className="size-3.5" />
                    </ContextMenuItem>
                ) : null}
                <ContextMenuItem
                    onClick={autoArrangeHandler}
                    className="flex justify-between gap-3"
                >
                    <span>
                        {t('canvas_context_menu.auto_arrange_area')}
                    </span>
                    <LayoutGrid className="size-3.5" />
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    onClick={removeAreaHandler}
                    className="flex justify-between gap-3"
                >
                    <span>
                        {t(
                            'side_panel.areas_section.area.area_actions.delete_area'
                        )}
                    </span>
                    <Trash2 className="size-3.5 text-red-700" />
                </ContextMenuItem>
```

(El `text-red-700` del ícono de eliminar queda igual — es color, fuera
de alcance de esta fase.)

- [ ] **Step 4: Traducir "Import SQL/DBML" en `canvas-context-menu.tsx`**

`canvas-context-menu.tsx` ya importa `useTranslation` y declara
`const { t } = useTranslation();` (usado en el resto del menú) — no
hace falta tocar imports. Ubicar este bloque exacto
(`canvas-context-menu.tsx:337-343`):

```tsx
                <ContextMenuItem
                    onClick={importSqlDbmlHandler}
                    className="flex justify-between gap-4"
                >
                    Import SQL/DBML
                    <Import className="size-3.5" />
                </ContextMenuItem>
```

Reemplazarlo por:

```tsx
                <ContextMenuItem
                    onClick={importSqlDbmlHandler}
                    className="flex justify-between gap-4"
                >
                    {t('canvas_context_menu.import_sql_dbml')}
                    <Import className="size-3.5" />
                </ContextMenuItem>
```

- [ ] **Step 5: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 6: Verificación visual manual**

Run: `pnpm dev`, abrir un diagrama. En español (idioma default): clic
derecho sobre un área — confirmar "Editar Nombre" / "Organizar
Automáticamente" / "Eliminar Área", ya no "Edit Area Name"/"Auto
Arrange"/"Delete Area". Clic derecho sobre el lienzo vacío — confirmar
que "Importar SQL/DBML" está en español como el resto del menú. Abrir
el menú "..." de un área en el sidebar y confirmar que dice exactamente
lo mismo que el menú de clic derecho ("Editar Nombre"/"Eliminar Área").
Cambiar el idioma de la app a inglés (selector de idioma existente) y
repetir: confirmar "Edit Name"/"Auto Arrange"/"Delete Area" y "Import
SQL/DBML", y que el menú de clic derecho de Tabla ya no muestra
"Duplicate Table"/"Add Relationship" en inglés cuando el idioma es
español (repetir el chequeo en español).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/es.ts src/pages/editor-page/canvas/area-node/area-node-context-menu.tsx src/pages/editor-page/canvas/canvas-context-menu.tsx
git commit -m "fix(canvas): wire i18n into area context menu and canvas import item, fix es.ts TODO leftovers"
```

---

## Task 2: Copy y `aria-label` en `NoteNode`

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/es.ts`
- Modify: `src/pages/editor-page/canvas/note-node/note-node.tsx`

**Interfaces:**
- Consumes: claves i18n existentes `side_panel.notes_section.note.note_actions.edit_content` y `.delete_note` (ya existen en las 22 locales, usadas hoy solo por el sidebar de notas).
- Produces: 2 claves i18n nuevas (`side_panel.notes_section.note.content_placeholder`, `.edit_hint`) que ninguna otra tarea consume.

- [ ] **Step 1: Agregar las 2 claves nuevas a `en.ts`**

Ubicar este bloque exacto (`en.ts:259-266`):

```ts
                note: {
                    empty_note: 'Empty note',
                    note_actions: {
                        title: 'Note Actions',
                        edit_content: 'Edit Content',
                        delete_note: 'Delete Note',
                    },
                },
```

Reemplazarlo por:

```ts
                note: {
                    empty_note: 'Empty note',
                    content_placeholder: 'Type your note here...',
                    edit_hint: 'Double-click to write (Markdown format)',
                    note_actions: {
                        title: 'Note Actions',
                        edit_content: 'Edit Content',
                        delete_note: 'Delete Note',
                    },
                },
```

- [ ] **Step 2: Agregar las 2 claves nuevas a `es.ts`**

Ubicar este bloque exacto (`es.ts:265-272`):

```ts
                note: {
                    empty_note: 'Nota vacía',
                    note_actions: {
                        title: 'Acciones de Nota',
                        edit_content: 'Editar Contenido',
                        delete_note: 'Eliminar Nota',
                    },
                },
```

Reemplazarlo por:

```ts
                note: {
                    empty_note: 'Nota vacía',
                    content_placeholder: 'Escribe tu nota aquí...',
                    edit_hint: 'Doble clic para escribir (formato Markdown)',
                    note_actions: {
                        title: 'Acciones de Nota',
                        edit_content: 'Editar Contenido',
                        delete_note: 'Eliminar Nota',
                    },
                },
```

- [ ] **Step 3: Agregar `useTranslation` a `note-node.tsx`**

El bloque actual de imports es (`note-node.tsx:1-16`):

```tsx
import React, { useCallback, useState, useRef } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Note } from '@/lib/domain/note';
import { useChartDB } from '@/hooks/use-chartdb';
import { useClickAway, useKeyPressEvent } from 'react-use';
import { ColorPicker } from '@/components/color-picker/color-picker';
import { Button } from '@/components/button/button';
import { cn } from '@/lib/utils';
import { useCanvas } from '@/hooks/use-canvas';
import type { CanvasEvent } from '@/context/canvas-context/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { getIsOldSafari } from '@/safari-compat';
```

Reemplazarlo por:

```tsx
import React, { useCallback, useState, useRef } from 'react';
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Note } from '@/lib/domain/note';
import { useChartDB } from '@/hooks/use-chartdb';
import { useClickAway, useKeyPressEvent } from 'react-use';
import { ColorPicker } from '@/components/color-picker/color-picker';
import { Button } from '@/components/button/button';
import { cn } from '@/lib/utils';
import { useCanvas } from '@/hooks/use-canvas';
import type { CanvasEvent } from '@/context/canvas-context/canvas-context';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { getIsOldSafari } from '@/safari-compat';
```

Agregar el hook. El bloque actual es (`note-node.tsx:32-37`):

```tsx
    const { note } = data;
    const { updateNote, removeNote, readonly } = useChartDB();
    const [editMode, setEditMode] = useState(false);
    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { events } = useCanvas();
    const { effectiveTheme } = useTheme();
```

Reemplazarlo por:

```tsx
    const { note } = data;
    const { updateNote, removeNote, readonly } = useChartDB();
    const [editMode, setEditMode] = useState(false);
    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { events } = useCanvas();
    const { effectiveTheme } = useTheme();
    const { t } = useTranslation();
```

- [ ] **Step 4: Traducir el placeholder del textarea**

Ubicar (`note-node.tsx:178-192`):

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

Reemplazarlo por:

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
                        placeholder={t(
                            'side_panel.notes_section.note.content_placeholder'
                        )}
                    />
```

- [ ] **Step 5: Traducir el texto de ayuda de nota vacía**

Ubicar (`note-node.tsx:337-341`):

```tsx
                        ) : (
                            <div className="italic text-gray-500 dark:text-gray-400">
                                Double-click to write (Markdown format)
                            </div>
                        )}
```

Reemplazarlo por:

```tsx
                        ) : (
                            <div className="italic text-gray-500 dark:text-gray-400">
                                {t(
                                    'side_panel.notes_section.note.edit_hint'
                                )}
                            </div>
                        )}
```

- [ ] **Step 6: Agregar `aria-label` a los 2 botones de la barra flotante**

Ubicar el bloque del botón de editar (`note-node.tsx:348-355`):

```tsx
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={enterEditMode}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
```

Reemplazarlo por:

```tsx
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={enterEditMode}
                            aria-label={t(
                                'side_panel.notes_section.note.note_actions.edit_content'
                            )}
                        >
                            <Pencil className="size-3.5" />
                        </Button>
```

Ubicar el bloque del botón de eliminar (`note-node.tsx:360-367`):

```tsx
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-red-500 hover:text-red-700"
                            onClick={handleDelete}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
```

Reemplazarlo por:

```tsx
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-red-500 hover:text-red-700"
                            onClick={handleDelete}
                            aria-label={t(
                                'side_panel.notes_section.note.note_actions.delete_note'
                            )}
                        >
                            <Trash2 className="size-3.5" />
                        </Button>
```

(Los colores `text-red-500`/`hover:text-red-700` quedan igual — fuera de
alcance de esta fase.)

- [ ] **Step 7: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 8: Verificación visual manual**

Run: `pnpm dev`. Crear una nota vacía en el canvas: confirmar que el
texto de ayuda dice "Doble clic para escribir (formato Markdown)" en
español. Doble clic para entrar en modo edición: confirmar que el
placeholder del textarea (con el contenido vacío) dice "Escribe tu nota
aquí...". Pasar el mouse sobre una nota para que aparezca la barra
flotante, e inspeccionar con las herramientas de accesibilidad del
navegador (o el árbol de accesibilidad de DevTools) que el botón de
lápiz y el de tacho ahora tienen nombre accesible ("Editar Contenido" /
"Eliminar Nota") en vez de aparecer sin nombre. Cambiar el idioma a
inglés y repetir: "Double-click to write (Markdown format)", "Type your
note here...", "Edit Content"/"Delete Note".

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/es.ts src/pages/editor-page/canvas/note-node/note-node.tsx
git commit -m "fix(canvas): translate NoteNode copy and add aria-label to its floating action buttons"
```

---

## Task 3: Copy hardcodeada dentro de `table-schema-dialog.tsx` y `select-tables.tsx`

**Files:**
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/es.ts`
- Modify: `src/dialogs/table-schema-dialog/table-schema-dialog.tsx`
- Modify: `src/dialogs/common/select-tables/select-tables.tsx`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: namespace nuevo `table_schema_dialog` (5 claves) y 2 claves nuevas dentro de `new_diagram_dialog.import_database`, que ninguna otra tarea de este plan consume.

- [ ] **Step 1: Agregar el namespace `table_schema_dialog` a `en.ts`**

Ubicar este bloque exacto (`en.ts:451-458`, el final de
`create_table_schema_dialog` y la línea en blanco antes de
`star_us_dialog`):

```ts
        create_table_schema_dialog: {
            title: 'Create New Schema',
            description:
                'No schemas exist yet. Create your first schema to organize your tables.',
            create: 'Create',
            cancel: 'Cancel',
        },

        star_us_dialog: {
```

Reemplazarlo por:

```ts
        create_table_schema_dialog: {
            title: 'Create New Schema',
            description:
                'No schemas exist yet. Create your first schema to organize your tables.',
            create: 'Create',
            cancel: 'Cancel',
        },

        table_schema_dialog: {
            schema_name_label: 'Schema Name',
            schema_name_placeholder: 'Enter schema name.',
            schema_name_example: 'e.g. {{schema}}.',
            or_separator: 'or',
            no_schemas_tooltip: 'No existing schemas available',
        },

        star_us_dialog: {
```

- [ ] **Step 2: Agregar el namespace `table_schema_dialog` a `es.ts`**

Ubicar este bloque exacto (`es.ts:462-470`):

```ts
        create_table_schema_dialog: {
            title: 'Crear Nuevo Esquema',
            description:
                'Aún no existen esquemas. Crea tu primer esquema para organizar tus tablas.',
            create: 'Crear',
            cancel: 'Cancelar',
        },

        star_us_dialog: {
```

Reemplazarlo por:

```ts
        create_table_schema_dialog: {
            title: 'Crear Nuevo Esquema',
            description:
                'Aún no existen esquemas. Crea tu primer esquema para organizar tus tablas.',
            create: 'Crear',
            cancel: 'Cancelar',
        },

        table_schema_dialog: {
            schema_name_label: 'Nombre del Esquema',
            schema_name_placeholder: 'Ingresa el nombre del esquema.',
            schema_name_example: 'ej. {{schema}}.',
            or_separator: 'o',
            no_schemas_tooltip: 'No hay esquemas existentes disponibles',
        },

        star_us_dialog: {
```

- [ ] **Step 3: Agregar las 2 claves nuevas a `en.ts` dentro de `new_diagram_dialog.import_database`**

Ubicar este bloque exacto (`en.ts:325-339`):

```ts
            import_database: {
                title: 'Import your Database',
                database_edition: 'Database Edition:',
                step_1: 'Run this script in your database:',
                step_2: 'Paste the script result into this modal →',
                script_results_placeholder: 'Script results here...',
                ssms_instructions: {
                    button_text: 'SSMS Instructions',
                    title: 'Instructions',
                    step_1: 'Go to Tools > Options > Query Results > SQL Server.',
                    step_2: 'If you\'re using "Results to Grid," change the Maximum Characters Retrieved for Non-XML data (set to 9999999).',
                },
                instructions_link: 'Need help? Watch how',
                check_script_result: 'Check Script Result',
            },
```

Reemplazarlo por:

```ts
            import_database: {
                title: 'Import your Database',
                database_edition: 'Database Edition:',
                step_1: 'Run this script in your database:',
                step_2: 'Paste the script result into this modal →',
                script_results_placeholder: 'Script results here...',
                ssms_instructions: {
                    button_text: 'SSMS Instructions',
                    title: 'Instructions',
                    step_1: 'Go to Tools > Options > Query Results > SQL Server.',
                    step_2: 'If you\'re using "Results to Grid," change the Maximum Characters Retrieved for Non-XML data (set to 9999999).',
                },
                instructions_link: 'Need help? Watch how',
                check_script_result: 'Check Script Result',
                search_tables_placeholder: 'Search tables...',
                max_tables_warning:
                    'Due to performance limitations, you can import a maximum of {{max}} tables.',
            },
```

- [ ] **Step 4: Agregar las 2 claves nuevas a `es.ts` dentro de `new_diagram_dialog.import_database`**

Ubicar este bloque exacto (`es.ts:334-348`):

```ts
            import_database: {
                title: 'Importa tu Base de Datos',
                database_edition: 'Edición de Base de Datos:',
                step_1: 'Ejecuta este script en tu base de datos:',
                step_2: 'Pega el resultado del script aquí →',
                script_results_placeholder: 'Resultados del script aquí...',
                ssms_instructions: {
                    button_text: 'Instrucciones SSMS',
                    title: 'Instrucciones',
                    step_1: 'Ve a Herramientas > Opciones > Resultados de Consulta > SQL Server.',
                    step_2: 'Si estás usando "Resultados en Cuadrícula", cambia el Máximo de Caracteres Recuperados para Datos No XML (configúralo en 9999999).',
                },
                instructions_link: '¿Necesitas ayuda? mira cómo',
                check_script_result: 'Revisa el resultado del script',
            },
```

Reemplazarlo por:

```ts
            import_database: {
                title: 'Importa tu Base de Datos',
                database_edition: 'Edición de Base de Datos:',
                step_1: 'Ejecuta este script en tu base de datos:',
                step_2: 'Pega el resultado del script aquí →',
                script_results_placeholder: 'Resultados del script aquí...',
                ssms_instructions: {
                    button_text: 'Instrucciones SSMS',
                    title: 'Instrucciones',
                    step_1: 'Ve a Herramientas > Opciones > Resultados de Consulta > SQL Server.',
                    step_2: 'Si estás usando "Resultados en Cuadrícula", cambia el Máximo de Caracteres Recuperados para Datos No XML (configúralo en 9999999).',
                },
                instructions_link: '¿Necesitas ayuda? mira cómo',
                check_script_result: 'Revisa el resultado del script',
                search_tables_placeholder: 'Buscar tablas...',
                max_tables_warning:
                    'Por limitaciones de rendimiento, podés importar un máximo de {{max}} tablas.',
            },
```

- [ ] **Step 5: Traducir las 4 strings de `table-schema-dialog.tsx`**

`table-schema-dialog.tsx` ya importa `useTranslation` y declara
`const { t } = useTranslation();` — no hace falta tocar imports.

Ubicar el bloque del label + placeholder (`table-schema-dialog.tsx:182-199`):

```tsx
                            <div className="flex flex-col gap-2">
                                {allowSchemaCreation &&
                                !allowSchemaSelection ? (
                                    <Label htmlFor="new-schema-name">
                                        Schema Name
                                    </Label>
                                ) : null}
                                <Input
                                    id="new-schema-name"
                                    value={newSchemaName}
                                    onChange={(e) =>
                                        setNewSchemaName(e.target.value)
                                    }
                                    placeholder={`Enter schema name.${defaultSchemaName ? ` e.g. ${defaultSchemaName}.` : ''}`}
                                    autoFocus
                                />
                            </div>
```

Reemplazarlo por:

```tsx
                            <div className="flex flex-col gap-2">
                                {allowSchemaCreation &&
                                !allowSchemaSelection ? (
                                    <Label htmlFor="new-schema-name">
                                        {t(
                                            'table_schema_dialog.schema_name_label'
                                        )}
                                    </Label>
                                ) : null}
                                <Input
                                    id="new-schema-name"
                                    value={newSchemaName}
                                    onChange={(e) =>
                                        setNewSchemaName(e.target.value)
                                    }
                                    placeholder={`${t('table_schema_dialog.schema_name_placeholder')}${defaultSchemaName ? ` ${t('table_schema_dialog.schema_name_example', { schema: defaultSchemaName })}` : ''}`}
                                    autoFocus
                                />
                            </div>
```

Ubicar el separador "or" (`table-schema-dialog.tsx:203-208`):

```tsx
                                <div className="relative">
                                    <Separator className="my-2" />
                                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                                        or
                                    </span>
                                </div>
```

Reemplazarlo por:

```tsx
                                <div className="relative">
                                    <Separator className="my-2" />
                                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                                        {t('table_schema_dialog.or_separator')}
                                    </span>
                                </div>
```

Ubicar el tooltip (`table-schema-dialog.tsx:218-220`):

```tsx
                                        <TooltipContent>
                                            <p>No existing schemas available</p>
                                        </TooltipContent>
```

Reemplazarlo por:

```tsx
                                        <TooltipContent>
                                            <p>
                                                {t(
                                                    'table_schema_dialog.no_schemas_tooltip'
                                                )}
                                            </p>
                                        </TooltipContent>
```

- [ ] **Step 6: Traducir las 2 strings de `select-tables.tsx`**

`select-tables.tsx` ya importa `useTranslation` y declara
`const { t } = useTranslation();` — no hace falta tocar imports.

Ubicar el banner de advertencia (`select-tables.tsx:373-384`):

```tsx
                            className={cn(
                                'flex items-center gap-2 rounded-lg p-3 text-sm',
                                'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            )}
                        >
                            <AlertCircle className="size-4 shrink-0" />
                            <span>
                                Due to performance limitations, you can import a
                                maximum of {MAX_TABLES_IN_DIAGRAM} tables.
                            </span>
                        </div>
```

Reemplazarlo por:

```tsx
                            className={cn(
                                'flex items-center gap-2 rounded-lg p-3 text-sm',
                                'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            )}
                        >
                            <AlertCircle className="size-4 shrink-0" />
                            <span>
                                {t(
                                    'new_diagram_dialog.import_database.max_tables_warning',
                                    { max: MAX_TABLES_IN_DIAGRAM }
                                )}
                            </span>
                        </div>
```

Ubicar el placeholder del buscador (`select-tables.tsx:387-394`):

```tsx
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search tables..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-9"
                        />
```

Reemplazarlo por:

```tsx
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={t(
                                'new_diagram_dialog.import_database.search_tables_placeholder'
                            )}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-9"
                        />
```

- [ ] **Step 7: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 8: Verificación visual manual**

Run: `pnpm dev`. En español: abrir el diálogo de esquema al crear una
tabla en un diagrama sin esquemas — confirmar "Nombre del Esquema" como
label, el placeholder "Ingresa el nombre del esquema." (con el ejemplo
"ej. ..." si corresponde), el separador "o", y el tooltip "No hay
esquemas existentes disponibles" cuando no hay esquemas para elegir.
Iniciar un import de base de datos con más tablas que
`MAX_TABLES_IN_DIAGRAM` — confirmar el placeholder "Buscar tablas..." y
el banner "Por limitaciones de rendimiento, podés importar un máximo de
N tablas." con el número correcto interpolado. Repetir ambos flujos con
el idioma en inglés y confirmar el texto en inglés equivalente.

- [ ] **Step 9: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/es.ts src/dialogs/table-schema-dialog/table-schema-dialog.tsx src/dialogs/common/select-tables/select-tables.tsx
git commit -m "fix(dialogs): translate remaining hardcoded strings in table-schema-dialog and select-tables"
```

---

## Task 4: Unificar íconos del menú de acciones de diagrama del editor

**Files:**
- Modify: `src/dialogs/open-diagram-dialog/diagram-row-actions-menu/diagram-row-actions-menu.tsx`

**Interfaces:**
- Consumes: nada de otras tareas.
- Produces: nada que otra tarea consuma — cambio interno de 2 íconos, mismo comportamiento y mismas claves i18n de antes.

- [ ] **Step 1: Cambiar los íconos importados**

Ubicar (`diagram-row-actions-menu.tsx:10`):

```tsx
import { Ellipsis, Layers2, SquareArrowOutUpRight, Trash2 } from 'lucide-react';
```

Reemplazarlo por:

```tsx
import { Copy, Ellipsis, ExternalLink, Trash2 } from 'lucide-react';
```

- [ ] **Step 2: Usar `ExternalLink` en el ítem "Open"**

Ubicar (`diagram-row-actions-menu.tsx:71-77`):

```tsx
                <DropdownMenuItem
                    onClick={onOpen}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.open')}
                    <SquareArrowOutUpRight className="size-3.5" />
                </DropdownMenuItem>
```

Reemplazarlo por:

```tsx
                <DropdownMenuItem
                    onClick={onOpen}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.open')}
                    <ExternalLink className="size-3.5" />
                </DropdownMenuItem>
```

- [ ] **Step 3: Usar `Copy` en el ítem "Duplicate"**

Ubicar (`diagram-row-actions-menu.tsx:79-85`):

```tsx
                <DropdownMenuItem
                    onClick={onDuplicate}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.duplicate')}
                    <Layers2 className="size-3.5" />
                </DropdownMenuItem>
```

Reemplazarlo por:

```tsx
                <DropdownMenuItem
                    onClick={onDuplicate}
                    className="flex justify-between gap-4"
                >
                    {t('open_diagram_dialog.diagram_actions.duplicate')}
                    <Copy className="size-3.5" />
                </DropdownMenuItem>
```

- [ ] **Step 4: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores (confirmar en particular que no queda
ningún import sin usar de `Layers2`/`SquareArrowOutUpRight` — el
reemplazo del Step 1 ya los quita del import).

- [ ] **Step 5: Verificación visual manual**

Run: `pnpm dev`, abrir un diagrama, ir a "Archivo > Abrir Diagrama" (o el
atajo de teclado equivalente) para abrir `open-diagram-dialog`. Abrir el
menú "..." de una fila: confirmar que "Open"/"Abrir" usa el mismo ícono
de flecha-hacia-afuera-de-un-cuadrado (`ExternalLink`) que usan las
tarjetas del dashboard, y que "Duplicate"/"Duplicar" usa el mismo ícono
de dos hojas superpuestas (`Copy`) que usa tanto el dashboard como el
menú de clic derecho de una tabla en el canvas.

- [ ] **Step 6: Commit**

```bash
git add src/dialogs/open-diagram-dialog/diagram-row-actions-menu/diagram-row-actions-menu.tsx
git commit -m "fix(editor): align diagram-row-actions-menu icons with dashboard and table context menu"
```

---

## Self-Review

**Cobertura del spec:** hallazgo 1 (menús contextuales del canvas) ✅
Task 1, hallazgo 2 (`NoteNode`) ✅ Task 2, hallazgo 3 (diálogos con copy
mixta) ✅ Task 3, hallazgo 4 (íconos del menú de diagrama) ✅ Task 4. El
hallazgo 5 ("ya está bien") no genera tarea, como corresponde — el spec
lo documenta como confirmación, no como cambio.

**Placeholders:** ninguno — cada bloque "ubicar"/"reemplazar" de las 4
tareas fue transcripto del contenido real de los archivos leídos durante
la auditoría (incluyendo los números de línea exactos citados en el
spec), no inventado ni aproximado. Las claves i18n nuevas tienen su
traducción en inglés y en español ya escritas en el plan, no quedan
como `TODO`.

**Consistencia de tipos/nombres:** los nombres de clave nuevos siguen el
`snake_case` que ya usan sus namespaces vecinos en el mismo archivo
(`canvas_context_menu.*`, `side_panel.notes_section.note.*`,
`table_schema_dialog.*`, `new_diagram_dialog.import_database.*`). Las
claves reusadas (`side_panel.areas_section.area.area_actions.*`,
`side_panel.notes_section.note.note_actions.*`) se referencian con la
ruta exacta que ya usan sus consumidores actuales (`area-list-item.tsx`,
el sidebar de notas) — no se les cambió el nombre ni el valor, solo se
les agregó un segundo consumidor. La interpolación `{{schema}}`/`{{max}}`
usa la sintaxis de `i18next` ya usada en otras claves del mismo archivo
(ej. `update_table_schema_dialog.description: 'Update table
"{{tableName}}" schema'`).

**Riesgo de conflicto entre tareas:** las Tasks 1, 2 y 3 tocan
`en.ts`/`es.ts`, pero cada una en una sección distinta del archivo
(`canvas_context_menu`/`table_node_context_menu` en Task 1,
`side_panel.notes_section.note` en Task 2, `table_schema_dialog`/
`new_diagram_dialog.import_database` en Task 3) — sin solapamiento de
líneas, así que pueden ejecutarse en cualquier orden o en paralelo por
subagentes distintos sin pisarse.
