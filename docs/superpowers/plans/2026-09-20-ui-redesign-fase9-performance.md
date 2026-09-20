# Fase 9 — Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el DOM sobre-montado de `TableNode` en diagramas con
60+ tablas (dejando de montar campos simples fuera del cupo de
visualización mientras una tabla está colapsada, sin librería nueva de
virtualización) y evitar que una mutación puntual (editar un campo, crear
una relación) fuerce el re-render de todas las tablas del canvas en vez
de solo la afectada.

**Architecture:** Dos tareas independientes, ambas dentro de
`src/pages/editor-page/canvas/table-node/table-node.tsx`: (1) acotar qué
campos se montan en el DOM según si la tabla está colapsada, reutilizando
el cálculo ya existente de `visibleFields`/`relatedFieldIds`; (2) agregar
un comparador personalizado al `React.memo` de `TableNode` para que dejar
de recibir una prop `data` con nueva identidad (pero mismo contenido
relevante) no dispare un re-render. Ninguna de las dos toca
`canvas.tsx` ni ninguna otra pieza del motor de sync/estado — ambas son
cambios locales a `table-node.tsx`.

**Tech Stack:** React (`useMemo`, `React.memo` con comparador
personalizado), `fast-deep-equal` (ya dependencia del proyecto, ya usada
con el mismo patrón en `canvas.tsx:33`), Vitest + Testing Library, `tsc`,
Vite build.

**Spec:** `docs/superpowers/specs/2026-09-20-ui-redesign-fase9-performance-design.md`

## Global Constraints

- No agregar `react-window` ni `@tanstack/react-virtual` — evaluadas y
  descartadas en el spec (sección 1): `TableNode` no tiene hoy una región
  de altura fija con scroll interno, que es un prerequisito de cualquier
  windowing real; agregarla es un cambio de UX fuera de esta fase.
- No tocar `src/lib/graph.ts` — ya arreglado en la sesión 2026-09-12
  (bug #4 de `AGENTS.md`), verificado sin hallazgos nuevos en el spec.
- No tocar `canvas.tsx` — el fix de la Tarea 2 es enteramente local al
  comparador de `React.memo` en `table-node.tsx`, no a cómo `canvas.tsx`
  reconstruye el array de nodos (ver spec, sección 2, para el porqué: el
  comparador ya neutraliza el problema sin necesidad de tocar el efecto).
- No cambiar comportamiento visual/de tokens — esta fase es puramente de
  rendimiento. Cualquier diferencia observable debe limitarse al
  trade-off ya documentado y aceptado en el spec (resaltado de tipo
  personalizado en un campo fuera del cupo, mientras la tabla está
  colapsada).
- **Nota sobre testing**: no hay tests unitarios existentes para
  `table-node.tsx` (verificar antes de empezar — si aparecieran, deben
  seguir pasando). La verificación de esta fase es build + verificación
  manual de performance (conteo de nodos DOM y React Profiler), no tests
  nuevos, porque el cambio es sobre *cuántos* nodos se montan/re-renderizan,
  no sobre lógica de negocio nueva.

---

## Task 1: Acotar qué campos monta `TableNode` cuando la tabla está colapsada

**Files:**
- Modify: `src/pages/editor-page/canvas/table-node/table-node.tsx`

**Interfaces:**
- Consumes: `visibleFields` y `relatedFieldIds` (ya existen en el mismo
  archivo, sin cambios a su cálculo).
- Produces: un nuevo memo local `mountedFields`, consumido únicamente
  dentro de este mismo componente — no cambia la firma de `TableNode` ni
  la de `TableNodeField` (`table-node-field.tsx` no se toca en esta
  tarea).

- [ ] **Step 1: Agregar el memo `mountedFields`**

Ubicar el cierre del memo `visibleFields` en `table-node.tsx` (líneas
284-336 del archivo actual):

```tsx
        }, [
            expanded,
            fields,
            relatedFieldIds,
            editTableMode,
            editModeInitialFieldCount,
        ]);

        const isPartOfCreatingRelationship = useMemo(
```

Insertar el nuevo memo entre el cierre de `visibleFields` y
`isPartOfCreatingRelationship`:

```tsx
        }, [
            expanded,
            fields,
            relatedFieldIds,
            editTableMode,
            editModeInitialFieldCount,
        ]);

        // Fields that must actually mount in the DOM. While collapsed,
        // only the fields already shown (`visibleFields`) plus any field
        // that is a primary key or participates in a relationship are
        // mounted — a relationship's Handle must never disappear just
        // because the field is past the display cap (that would
        // reintroduce error#008, "Couldn't create edge for target handle
        // id"). Plain fields beyond the cap are not mounted at all —
        // previously they were mounted and only CSS-hidden via the
        // `visible` prop, which is the DOM bloat documented for 60+
        // table diagrams (AGENTS.md).
        const mountedFields = useMemo(() => {
            const fieldsToConsider =
                editTableMode && editModeInitialFieldCount !== null
                    ? fields.slice(0, editModeInitialFieldCount)
                    : fields;

            if (
                expanded ||
                fieldsToConsider.length <= TABLE_MINIMIZED_FIELDS
            ) {
                return fieldsToConsider;
            }

            const visibleIds = new Set(visibleFields.map((f) => f.id));
            return fieldsToConsider.filter(
                (field) =>
                    visibleIds.has(field.id) ||
                    relatedFieldIds.has(field.id) ||
                    field.primaryKey
            );
        }, [
            expanded,
            fields,
            visibleFields,
            relatedFieldIds,
            editTableMode,
            editModeInitialFieldCount,
        ]);

        const isPartOfCreatingRelationship = useMemo(
```

- [ ] **Step 2: Usar `mountedFields` en vez de `fields` al renderizar**

Ubicar el bloque de render de campos (línea 617 del archivo actual):

```tsx
                        {fields.map((field: DBField) => {
                            const isFieldVisible =
                                expanded ||
                                visibleFields.some((vf) => vf.id === field.id);
                            return (
                                <TableNodeField
                                    key={field.id}
                                    focused={focused}
                                    tableNodeId={id}
                                    field={field}
                                    highlighted={highlightedFieldIds.has(
                                        field.id
                                    )}
                                    visible={isFieldVisible}
                                    isConnectable={!table.isView}
                                    targetEdgeCount={
                                        targetEdgeCounts?.[field.id]
                                    }
                                />
                            );
                        })}
```

Reemplazar solo `fields.map` por `mountedFields.map` (el resto del bloque
queda idéntico — `isFieldVisible` sigue calculándose contra `visibleFields`
exactamente igual que antes, así que qué se ve no cambia, solo qué se
monta):

```tsx
                        {mountedFields.map((field: DBField) => {
                            const isFieldVisible =
                                expanded ||
                                visibleFields.some((vf) => vf.id === field.id);
                            return (
                                <TableNodeField
                                    key={field.id}
                                    focused={focused}
                                    tableNodeId={id}
                                    field={field}
                                    highlighted={highlightedFieldIds.has(
                                        field.id
                                    )}
                                    visible={isFieldVisible}
                                    isConnectable={!table.isView}
                                    targetEdgeCount={
                                        targetEdgeCounts?.[field.id]
                                    }
                                />
                            );
                        })}
```

Nota: el cálculo de `maxHeight` del contenedor (unas líneas arriba del
bloque de arriba, sin cambios) sigue usando `fields.length`/
`visibleFields.length` — es aritmética de layout basada en *cantidad* de
campos, no en cuáles están montados, así que no se ve afectado por este
cambio y no hace falta tocarlo.

- [ ] **Step 3: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores. (No usar `pnpm run build` — su etapa de lint
puede fallar por el problema de CRLF preexistente si la config global de
git de la máquina vuelve a escribir CRLF en disco; ver ledger de Fase 1 en
`.claude/commands/estructura-UI.md`.)

- [ ] **Step 4: Verificación manual de performance**

Run: `pnpm dev`, abrir un diagrama con muchas tablas y varias con 15+
columnas (usar uno real de prueba, o el diagrama "SQL Import" mencionado
en `AGENTS.md` si está disponible). Con las tablas colapsadas (estado por
defecto):

1. Abrir DevTools → Elements, ejecutar en la consola:
   `document.querySelectorAll('.react-flow__renderer *').length`
   Anotar el número.
2. Confirmar visualmente que ninguna tabla colapsada muestra menos
   columnas que antes (la cantidad de filas *visibles* no cambió, solo
   las montadas-pero-invisibles).
3. Expandir una tabla con más de 10 columnas ("Mostrar más"): confirmar
   que aparecen TODAS sus columnas, en el mismo orden que antes.
4. Crear una relación hacia un campo que estaba fuera del cupo de
   visualización mientras la tabla de destino está colapsada (si el
   diagrama de prueba lo permite): confirmar que la relación se dibuja
   sin el error de consola `[React Flow] Couldn't create edge for target
   handle id` — esto verifica específicamente que el fix no rompe el
   caso que motivó mantener `relatedFieldIds`/PK sin tope en
   `mountedFields`.
5. Repetir la medición del punto 1 contra el número anotado antes de este
   cambio (en la misma sesión de `pnpm dev`, revirtiendo temporalmente el
   cambio con `git stash` si hace falta un "antes" real) — se espera una
   reducción notable en diagramas con tablas de muchas columnas.

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor-page/canvas/table-node/table-node.tsx
git commit -m "perf(canvas): stop mounting non-key/non-relationship fields past the display cap on collapsed tables"
```

---

## Task 2: Comparador personalizado para el `React.memo` de `TableNode`

**Files:**
- Modify: `src/pages/editor-page/canvas/table-node/table-node.tsx`

**Interfaces:**
- Consumes: `fast-deep-equal` (ya dependencia declarada en
  `package.json`, ya usada con el mismo import en `canvas.tsx:33`).
- Produces: ninguna interfaz nueva — el comparador es interno al archivo,
  no cambia la firma pública de `TableNode`.

- [ ] **Step 1: Importar `fast-deep-equal`**

Ubicar el último import del archivo:

```tsx
import { useCanvas } from '@/hooks/use-canvas';
```

Agregar debajo:

```tsx
import { useCanvas } from '@/hooks/use-canvas';
import equal from 'fast-deep-equal';
```

- [ ] **Step 2: Agregar la función comparadora antes del componente**

Ubicar el inicio de la declaración del componente:

```tsx
export const TableNode: React.FC<NodeProps<TableNodeType>> = React.memo(
    ({
```

Insertar el comparador justo antes, siguiendo el mismo patrón que ya usa
`table-node-field.tsx:55-80` (`arePropsEqual`):

```tsx
const arePropsEqual = (
    prevProps: NodeProps<TableNodeType>,
    nextProps: NodeProps<TableNodeType>
) => {
    return (
        prevProps.id === nextProps.id &&
        prevProps.selected === nextProps.selected &&
        prevProps.dragging === nextProps.dragging &&
        prevProps.data.table === nextProps.data.table &&
        prevProps.data.isOverlapping === nextProps.data.isOverlapping &&
        prevProps.data.highlightOverlappingTables ===
            nextProps.data.highlightOverlappingTables &&
        prevProps.data.hasHighlightedCustomType ===
            nextProps.data.hasHighlightedCustomType &&
        prevProps.data.highlightTable === nextProps.data.highlightTable &&
        prevProps.data.isRelationshipCreatingTarget ===
            nextProps.data.isRelationshipCreatingTarget &&
        equal(
            prevProps.data.targetEdgeCounts,
            nextProps.data.targetEdgeCounts
        )
    );
};

export const TableNode: React.FC<NodeProps<TableNodeType>> = React.memo(
    ({
```

Nota para quien ejecute: `data.table` se compara por referencia (`===`),
no por contenido — esto es intencional y depende de que
`chartdb-provider.tsx` mantenga la referencia de las tablas no afectadas
sin cambios en sus setters (`updateTable`, `updateField`, etc., patrón
`tables.map(t => t.id === id ? {...t, ...} : t)`, ya verificado contra el
código real al escribir el spec). Solo `targetEdgeCounts` necesita
`equal()` profundo porque `canvas.tsx` reconstruye ese objeto puntual
desde cero en cada corrida de su efecto, sin importar si cambió.

- [ ] **Step 3: Pasar el comparador al `React.memo`**

Ubicar el cierre del componente (línea 663 del archivo actual, antes del
cambio de la Tarea 1 — el número de línea puede haberse corrido si la
Tarea 1 ya se aplicó; ubicar por contenido, no por número):

```tsx
        );
    }
);

TableNode.displayName = 'TableNode';
```

Reemplazar por:

```tsx
        );
    },
    arePropsEqual
);

TableNode.displayName = 'TableNode';
```

- [ ] **Step 4: Verificar con build**

Run: `npx tsc -b && npx vite build`
Expected: ambos sin errores.

- [ ] **Step 5: Verificación manual de performance (React Profiler)**

Run: `pnpm dev`, abrir un diagrama con 10+ tablas (cuantas más, más claro
se ve el efecto). Con React DevTools instalado en el navegador:

1. Abrir la pestaña "Profiler" de React DevTools, iniciar una grabación.
2. Editar el nombre de un campo en UNA sola tabla (doble click → editar →
   guardar) y detener la grabación.
3. Antes de este cambio (Task 2 sin aplicar): se espera ver un commit
   donde **todas** las `TableNode` visibles aparecen como renderizadas.
   Después de este cambio: se espera ver un commit donde solo la
   `TableNode` editada (y, si corresponde, las conectadas por una
   relación resaltada) aparece renderizada — las demás no deberían listar
   ningún tiempo de render en ese commit.
4. Repetir creando una relación nueva entre dos tablas: confirmar que solo
   esas dos `TableNode` (más las aristas afectadas) aparecen en el
   commit, no las 60.

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor-page/canvas/table-node/table-node.tsx
git commit -m "perf(canvas): memoize TableNode against stable table reference instead of the rebuilt node wrapper"
```

---

## Self-Review

**Cobertura del spec:** hallazgo obligatorio de `AGENTS.md`
(virtualización/sobre-montaje de campos) ✅ Task 1, único hallazgo con el
mayor detalle como pidió el encargo. Segundo hallazgo confirmado por
lectura real (`canvas.tsx:659-751` rompiendo la memoización de
`TableNode`) ✅ Task 2. Áreas ya optimizadas (`graph.ts`,
`chartdb-provider.tsx` top-level memos, `nodesWithCursor`/
`edgesWithFloating`) documentadas explícitamente en el spec como
revisadas sin hallazgos nuevos — no se inventaron problemas ahí para
inflar el plan.

**Placeholders:** ninguno — ambos diffs citan el contenido exacto leído
del archivo real (`table-node.tsx`, confirmado línea por línea al
escribir el spec) antes de proponer el reemplazo. `fast-deep-equal` no es
una dependencia nueva: está en `package.json` (`"fast-deep-equal":
"^3.1.3"`) y ya se usa con el mismo nombre de import (`equal`) en
`canvas.tsx:33`.

**Viabilidad técnica del enfoque de virtualización:** confirmada contra
la restricción real de que `TableNode` es un nodo de React Flow, no un
elemento de lista independiente en un viewport de scroll — por eso el
plan descarta explícitamente `react-window`/`@tanstack/react-virtual`
(sin contenedor de altura fija con scroll interno que virtualizar, y sin
patrón de React Flow para virtualización *dentro* de un nodo) y en su
lugar usa el mecanismo de culling que React Flow sí ofrece de fábrica
(`onlyRenderVisibleElements`, ya activo en `canvas.tsx:1744`) combinado
con un cambio local de "qué se monta por tabla" que no requiere scroll
interno ni nueva dependencia.

**Riesgo de regresión evaluado:** el caso de borde que motivaría un
`error#008` (relación hacia un campo fuera del cupo de visualización en
una tabla colapsada) está cubierto por diseño — `mountedFields` mantiene
sin tope todo campo en `relatedFieldIds` o `primaryKey`, así que su
`<Handle>` nunca deja de existir. El Step 4 de la Tarea 1 incluye una
verificación manual específica para este caso.

**Orden de las tareas:** Task 1 y Task 2 son independientes entre sí (no
hay overlap de líneas si se aplican en el orden de este plan — Task 1
toca las líneas 284-336 y ~617, Task 2 toca los imports al inicio del
archivo y las líneas 74/663 del cierre del componente) y pueden
ejecutarse en cualquier orden o en paralelo por subagentes distintos si
se prefiere, aunque este plan las presenta en el orden en que se
descubrieron en el spec.
