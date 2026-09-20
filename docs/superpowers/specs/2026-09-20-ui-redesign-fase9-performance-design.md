# Rediseño UI/UX de ChartDB — Fase 9: Performance

## Contexto

Novena fase del rediseño de UI/UX. A diferencia de las fases 1-4 (tokens,
componentes, dashboard, migración de `pink-*`), esta fase no toca diseño
visual — audita rendimiento real del canvas del editor en diagramas
grandes (60+ tablas), siguiendo el hallazgo ya documentado en `AGENTS.md`
("Notas para la próxima sesión"):

> El DOM de diagramas con muchas tablas (60+) sigue siendo grande (~13k
> nodos) porque cada tabla monta todos sus campos aunque estén colapsados
> (solo se ocultan con CSS). Virtualizar las filas de campos dentro de
> `TableNode` es la siguiente optimización de rendimiento pendiente, no
> implementada todavía.

Precede a este spec una auditoría de código real (no de memoria) de
`src/pages/editor-page/canvas/table-node/table-node.tsx`,
`table-node-field.tsx`, `src/pages/editor-page/canvas/canvas.tsx`,
`src/context/chartdb-context/chartdb-provider.tsx` y
`src/lib/graph.ts` — cada hallazgo de abajo cita archivo y línea exactos
del código leído para este spec.

**Dato de contexto que cambia el alcance del problema**: `canvas.tsx:1744`
ya tiene `onlyRenderVisibleElements` activado en el `<ReactFlow>`. Esto
significa que React Flow ya desmonta por completo cualquier `TableNode`
cuya tabla esté fuera del viewport — el problema de DOM no es "todas las
tablas del diagrama siempre montadas", sino "todas las tablas *visibles en
pantalla* sobre-montan sus campos". En un diagrama de 60+ tablas vista
alejada para ver el esquema completo (el caso de uso real que motivó el
hallazgo de `AGENTS.md`), las 60 tablas están en viewport simultáneamente,
así que el problema de campos sigue siendo el cuello de botella real.

## 1. `TableNode` monta todos los campos de una tabla, colapsada o no

**Hallazgo**: `table-node.tsx:617` itera sobre `fields` (la lista completa
de campos de la tabla, sin acotar) para renderizar un `<TableNodeField>`
por cada uno, sin importar si la tabla está colapsada:

```tsx
{fields.map((field: DBField) => {
    const isFieldVisible =
        expanded ||
        visibleFields.some((vf) => vf.id === field.id);
    return (
        <TableNodeField
            key={field.id}
            ...
            visible={isFieldVisible}
            ...
        />
    );
})}
```

`visibleFields` (`table-node.tsx:284-336`) ya calcula cuáles campos
*deberían verse* cuando la tabla está colapsada (como máximo
`TABLE_MINIMIZED_FIELDS = 10`, priorizando primary keys y campos con
relación — ver `db-table.ts:16`), pero ese resultado solo se usa para
decidir la prop `visible`, no para decidir qué se monta.

En `table-node-field.tsx:346-370`, `visible={false}` únicamente cambia
clases CSS (`h-0 max-h-0 border-t-0 py-0 my-0 overflow-hidden opacity-0
pointer-events-none` en vez de `h-8 ... border-t opacity-100`) — el nodo
sigue montado en el DOM, con sus hasta 4 `<Handle>` de React Flow
(`table-node-field.tsx:372-414`), ícono de PK, tooltip de comentario,
badges de diff, etc.

**Resultado medible**: una tabla colapsada con, por ejemplo, 40 columnas
reales (común en tablas de negocio) monta 40 filas de campo aunque solo
10 sean visibles — 30 nodos completamente inútiles en el DOM, multiplicado
por cada una de las 60+ tablas visibles en pantalla. Esto es exactamente
el "~13k nodos DOM" que documenta `AGENTS.md`.

**Alternativas evaluadas para virtualizar**:

- **`react-window` / `@tanstack/react-virtual`** (no son dependencias
  actuales — confirmado contra `package.json`, ninguna de las dos
  aparece). Se descartan por dos razones concretas, no especulativas:
  1. La virtualización de listas por ventana asume una región con altura
     fija y `overflow: auto`/scroll interno, y hoy no existe tal región:
     una tabla expandida simplemente crece de alto sin límite
     (`table-node.tsx:609-615`, `maxHeight` se calcula como
     `fields.length * 2rem`, sin `overflow` ni tope). Adoptar una librería
     de windowing implicaría primero rediseñar el modo expandido para que
     tenga una altura fija con scroll interno — un cambio de UX/alcance
     mayor al de esta fase, no pedido.
  2. Un contenedor con scroll propio *dentro* de un nodo de React Flow
     (que a su vez vive dentro de un canvas con su propio pan/zoom por
     rueda del mouse) es una fuente conocida de conflictos de "qué elemento
     captura el evento de wheel/drag" — React Flow no tiene un patrón
     recomendado para virtualizar contenido *dentro* de un nodo; su propia
     estrategia de rendimiento para nodos pesados es exactamente
     `onlyRenderVisibleElements` (ya activo, ver arriba), no windowing
     interno por nodo.
- **Enfoque elegido — no montar lo que no aporta, en vez de montar-y-ocultar
  con CSS**: cuando la tabla está colapsada, montar únicamente los campos
  que ya se muestran (`visibleFields`) más cualquier campo que sea primary
  key o participe de una relación (`relatedFieldIds`, ya calculado en
  `table-node.tsx:275-282`), sin el tope de `TABLE_MINIMIZED_FIELDS`. Los
  campos simples (ni PK ni relacionados) que quedan fuera del cupo de
  visualización directamente no se montan. Cuando la tabla está expandida,
  se sigue montando todo (comportamiento sin cambios — el usuario pidió
  ver todo).

**Por qué el cupo de campos relacionados/PK debe quedar sin tope**: la
lógica actual de `visibleFields` ya limita los "must-displayed" (PK +
relacionados) a `TABLE_MINIMIZED_FIELDS` cuando decide qué *mostrar*
(`table-node.tsx:307-310`, `mustDisplayedFields.slice(0,
TABLE_MINIMIZED_FIELDS)`). Hoy, aunque una tabla tenga más de 10 campos
con relación, los que exceden ese cupo siguen *montados* (solo invisibles
por CSS), así que sus `<Handle>` existen y las relaciones no se rompen. Si
el nuevo `mountedFields` respetara ese mismo tope de 10, dejaríamos de
montar el `<Handle>` de una relación real cuando una tabla tiene más de 10
campos relacionados — reintroduciendo exactamente la clase de bug
`[React Flow] Couldn't create edge for target handle id` (error#008) que
`AGENTS.md` documenta como ya arreglado (bug #3, sesión 2026-09-12). Por
eso el nuevo cálculo mantiene *todos* los campos PK/relacionados montados,
sin tope — el ahorro de DOM viene exclusivamente de dejar de montar los
campos simples que ya no importan visualmente.

**Trade-off aceptado explícitamente**: el resaltado de campo individual
por tipo personalizado (`isCustomTypeHighlighted` en
`table-node-field.tsx:320-323`, que pinta esa fila de amarillo) es
por-fila. Si el campo resaltado no es PK ni tiene relación y queda fuera
del cupo de visualización mientras la tabla está colapsada, no se monta —
el usuario no verá ese resaltado individual hasta expandir la tabla. Esto
no es una regresión silenciosa: la tabla ya tiene su propio indicador a
nivel tabla (`hasHighlightedCustomType`, anillo/pulso en
`table-node.tsx:364-366`) que sigue funcionando igual y le avisa al
usuario que "algo en esta tabla matchea", sin depender de qué campos
están montados. Ninguna otra función depende de que los campos ocultos de
una tabla colapsada existan en el DOM: la lista de campos del panel
lateral (`src/pages/editor-page/side-panel/tables-section/`) es un árbol
de componentes completamente separado de `TableNodeField`, no se ve
afectada. El resaltado de campo por relación seleccionada/hovereada
(`highlightedFieldIds`, `table-node.tsx:227-240`) tampoco se ve afectado
porque usa el mismo conjunto `relatedFieldIds` que ya queda siempre
montado.

## 2. `canvas.tsx` reconstruye todos los nodos y rompe la memoización de `TableNode` en cada mutación

**Hallazgo**: el `useEffect` en `canvas.tsx:659-751` reconstruye el array
completo de nodos (`tables.map(...)`, `canvas.tsx:671`) cada vez que
cambia cualquiera de sus dependencias — que incluyen `tables`, `areas`,
`notes`, `filter`, `databaseType`, `overlapGraph.lastUpdated`,
`overlapGraph.graph`, `highlightOverlappingTables`, `highlightedCustomType`,
`filterLoading`, `showDBViews`, `shouldForceShowTable` y, en particular,
**`relationships`** (`canvas.tsx:750`) — es decir, agregar o borrar UNA
sola relación en un diagrama de 60 tablas dispara este recálculo completo.

Cada corrida de `tableToTableNode` (`canvas.tsx:157-208`) construye un
objeto `data` nuevo, y además, por cada tabla, `canvas.tsx:676-682`
construye un objeto `tableTargetEdgeCounts = {}` completamente nuevo desde
cero:

```tsx
const tableTargetEdgeCounts: Record<string, number> = {};
table.fields.forEach((field) => {
    if (targetEdgeCountsByField[field.id]) {
        tableTargetEdgeCounts[field.id] =
            targetEdgeCountsByField[field.id];
    }
});
```

...sin importar si esa tabla en particular tiene alguna relación afectada
por el cambio.

El efecto sí protege el `setNodes` final con una comparación profunda
(`canvas.tsx:730-732`, `equal(prevNodes, newNodes)` con `fast-deep-equal`)
para evitar un `setState` cuando nada cambió *de verdad* — pero en cuanto
UNA tabla cambia, `equal()` devuelve `false` para el array completo, y
`setNodes` confirma un array donde **las 60 tablas** tienen objetos
`data`/`targetEdgeCounts` con identidad nueva, no solo la tabla que
cambió, porque el `.map()` de la línea 671 siempre construye objetos
nuevos para todas, hayan cambiado o no.

`TableNode` está envuelto en `React.memo(...)` sin comparador
personalizado (`table-node.tsx:74`, cierre en `table-node.tsx:663`) — el
comparador por defecto es un shallow-compare de props, así que una nueva
referencia de `data` alcanza para forzar un re-render. Verificado contra
el patrón real de actualización de `chartdb-provider.tsx` (`updateTable`,
línea 477-479; `updateField`, línea 681-689): las tablas *no afectadas*
por una mutación conservan su referencia exacta (`tables.map(t => t.id
=== id ? {...t, ...} : t)`), así que el contenido que debería importarle a
59 de 60 `TableNode` casi no cambia — solo los objetos *envoltorio* del
nodo y `targetEdgeCounts` se reconstruyen innecesariamente.

**Consecuencia real**: editar un solo campo, o crear una sola relación, en
un diagrama de 60+ tablas fuerza el re-render de los 60+ `TableNode`
completos (con sus campos montados, handles, labels, etc.), no solo del
que cambió — agravando directamente el costo del punto 1.

**Cambio propuesto**: agregar un comparador personalizado al
`React.memo` de `TableNode`, siguiendo el mismo patrón ya usado un archivo
al lado (`table-node-field.tsx:55-80`, `arePropsEqual`). El comparador
compara `data.table` por referencia (estable para tablas no afectadas,
según el patrón verificado arriba) y `data.targetEdgeCounts` con
`fast-deep-equal` (ya dependencia del proyecto, ya importada igual en
`canvas.tsx:33`) porque ese objeto puntual sí se reconstruye desde cero en
cada corrida del efecto sin importar el contenido.

**Trade-off**: ninguno funcional — el comparador solo cambia *cuándo*
`TableNode` re-renderiza, nunca *qué* renderiza. El único costo agregado
es un `equal()` extra, pequeño, por tabla, por corrida del efecto de
`canvas.tsx` (el objeto `targetEdgeCounts` tiene como mucho una entrada
por campo con relación entrante en esa tabla — nunca todos los campos).

## 3. Ya optimizado — sin hallazgos nuevos

Verificado por lectura directa de código, no se encontraron problemas
adicionales genuinos en las siguientes áreas ya auditadas:

- **`src/lib/graph.ts`**: el bug #4 de `AGENTS.md` (sesión 2026-09-12,
  `lastUpdated: Date.now()` incondicional en cada llamada) ya está
  arreglado — confirmado leyendo `addEdge`/`removeEdge`/`addVertex`/
  `removeVertex` hoy: todas devuelven el mismo objeto `graph` sin bumpear
  `lastUpdated` cuando no hubo cambio real (`graph.ts:25-52`, `:57-69`,
  `:71-93`). Sigue así, no requiere trabajo en esta fase.
- **`chartdb-provider.tsx`, memos de nivel superior** (`schemas`,
  `currentDiagram`, `readonly`, `db`, líneas 100-170): sus arrays de
  dependencias coinciden exactamente con lo que cada uno calcula (p. ej.
  `currentDiagram` depende de todos los campos que efectivamente
  incluye) — no hay dependencias artificialmente amplias que forcé
  recálculo innecesario.
- **`canvas.tsx:1655-1699`, `nodesWithCursor`/`edgesWithFloating`**: son
  memos de solo-append, gateados por `tempFloatingEdge`/`cursorPosition`
  siendo no-nulos; en uso normal del canvas (sin estar arrastrando una
  relación) devuelven la misma referencia de `nodes`/`edges` sin trabajo
  adicional — no son una fuente de costo real.

## Fuera de alcance

- Cualquier librería nueva de virtualización (`react-window`,
  `@tanstack/react-virtual`) — evaluadas y descartadas explícitamente en
  el punto 1.
- Rediseño del modo expandido de `TableNode` para tener scroll interno con
  altura fija (requisito previo de cualquier windowing real) — cambio de
  UX no pedido, fuera de alcance de esta fase.
- Cambios a `src/lib/graph.ts` — ya arreglado en la sesión 2026-09-12, sin
  hallazgos nuevos.
- Cambios de arquitectura al `SyncEngine` o a la forma en que
  `chartdb-provider.tsx` mantiene el estado de tablas/relaciones más allá
  del comparador de memoización de la sección 2.
- Virtualización de la lista de tablas del panel lateral
  (`side-panel/tables-section`) — no auditada en esta fase, no forma
  parte del hallazgo original de `AGENTS.md`.
- Cualquier cambio visual/de tokens — esta fase es puramente de
  rendimiento, no de diseño.

## Próximos pasos

Este spec pasa a `writing-plans`.
