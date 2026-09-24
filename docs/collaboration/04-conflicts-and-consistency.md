# Fase 4 — Conflictos y consistencia

## Objetivo

Que ediciones simultáneas converjan siempre al mismo estado en todos los
clientes, que nunca se pierda un cambio a una propiedad distinta de la que
tocó otro usuario, y que lo que sí requiere intervención se muestre.

## Política (resumen)

1. **El orden lo decide el servidor**: los lotes se serializan con
   `SELECT … FOR UPDATE` sobre `diagrams` (ya existe) y reciben `version` n+1.
2. **Last-writer-wins por propiedad**, no por entidad: un `update` solo contiene
   las propiedades cambiadas y el servidor solo escribe esas columnas/claves.
3. **Los elementos de arrays JSONB son entidades propias** (`field`, `index`,
   `checkConstraint`), con LWW por propiedad del elemento.
4. **Borrar gana a editar**; editar algo borrado se rechaza con motivo explícito.
5. **Cada cliente aplica los lotes remotos en orden de `version`** y re-aplica
   encima sus cambios locales aún no confirmados.

**Por qué no CRDT/OT:** el diagrama es un conjunto de entidades con id estable y
propiedades escalares; los conflictos reales son "misma propiedad a la vez", que
LWW resuelve de forma predecible. CRDT solo aportaría en texto libre concurrente
(notas, comentarios), que en v1 se trata como un valor único (LWW del campo).
Si más adelante se necesita edición simultánea del mismo texto, se puede usar
Yjs **solo** para ese campo, sin cambiar el resto del modelo.

## Problema actual que hay que resolver primero (F4-a)

`db_tables.fields`, `indexes` y `check_constraints` son columnas JSONB completas.
Hoy `updateField`, `addIndex`, etc. en `chartdb-provider.tsx` mandan
`{ fields: [...todo el array] }` como patch de la tabla. Con dos editores:

```
A cambia el tipo de "email"  → patch fields = [id, email(varchar→text), nombre]
B renombra "nombre" → "name" → patch fields = [id, email(varchar),      name]
Servidor aplica A, luego B → el cambio de A se pierde
```

**Solución:** operaciones de sub-entidad aplicadas en el servidor sobre el array:

| Op | Aplicación en `sync.service.ts` (dentro de la transacción, fila de `db_tables` con `FOR UPDATE`) |
| --- | --- |
| `field.create {parentId, id, patch}` | insertar el elemento (si ya existe el id → tratar como update) en la posición `patch.order` o al final |
| `field.update {parentId, id, patch}` | `{...elemento, ...patch}` solo para ese id |
| `field.delete {parentId, id}` | quitar el elemento; borrar también índices/relaciones que lo referencian (ver cascadas) |
| reordenar | `field.update {order}` por elemento, no reescritura del array |

Mismo esquema para `index` y `checkConstraint`. `table.update` deja de aceptar
`fields`/`indexes`/`checkConstraints` salvo en `table.create` y en importaciones
(que siguen siendo reemplazo completo). En el cliente, los mutadores de campo,
índice y constraint encolan la op de sub-entidad con solo las propiedades
cambiadas; ya tienen el estado local (fix nº 5 de `AGENTS.md`), no necesitan leer
del servidor.

Esto también mejora el caso sin tiempo real (dos pestañas, reintentos), por eso
se implementa antes que la Fase 3.

## Casos

| Caso | Resultado |
| --- | --- |
| Cambios en tablas distintas | Ambos se aplican; sin interacción |
| Misma tabla, propiedades distintas (A mueve, B renombra) | Ambos se aplican (patch por columna) |
| Misma tabla, columnas distintas | Ambos se aplican (ops `field` por id) |
| Misma propiedad a la vez (A y B renombran la tabla) | Gana el lote que el servidor ordena último; ambos clientes terminan con ese valor. El perdedor ve un aviso discreto "Ana cambió también el nombre de `users`" |
| A borra tabla mientras B la edita | Si el borrado se ordena primero, el `update` de B se rechaza `entity_deleted`; B recibe el borrado remoto, la tabla desaparece y un toast lo explica con opción **"Restaurar como nueva"** (recrea la tabla con el estado local de B, nuevo id) |
| B edita, luego A borra | Borrado gana; B solo ve la tabla desaparecer (toast informativo) |
| Relación hacia campo/tabla borrado | `relationship.create` valida en el servidor que existan tabla y campo origen/destino; si no → `invalid_reference` y el cliente la quita |
| Borrar campo con relaciones/índices | El servidor borra en cascada, en la misma transacción, las relaciones y entradas de índices que lo referencian, e incluye esas ops en el lote difundido (todos ven lo mismo) |
| Dos creates con el mismo id | Improbable (ids generados en cliente); `create` sobre id existente se trata como `update` |
| Lotes fuera de orden | El cliente aplica estrictamente por `version`; búfer + catch-up si hay hueco; duplicados (`version <= last`) se ignoran |
| Reintento tras respuesta perdida | Mismo `batchId` → el servidor devuelve la respuesta guardada en `diagram_ops`, no reaplica |
| Viewer envía ops (cliente manipulado) | Todo el lote `403 forbidden_role` |

## Rebase de cambios locales pendientes (cliente)

Estado mostrado = estado confirmado + ops locales en cola o en vuelo. Al recibir
un lote remoto `v`:

1. Para cada propiedad tocada por el lote remoto:
   - si hay un cambio local **en cola (no enviado)** sobre la misma
     `entity:parentId:id.propiedad` → no se pisa en pantalla: el local se enviará
     después y el servidor lo ordenará último (ganará).
   - si hay un cambio local **en vuelo** sobre la misma propiedad → se retiene
     el lote remoto hasta el ack; si `ack.version > v` el local ganó y se descarta
     esa propiedad del remoto; si no, se aplica el remoto.
   - si no hay nada local → se aplica.
2. `delete` remoto siempre se aplica y **elimina de la cola** las ops locales
   sobre esa entidad (y sus hijas) para no enviar updates condenados.

Así la pantalla no "parpadea" al valor remoto y de vuelta al local.

## Deshacer (undo) con colaboradores

El historial guarda snapshots completos (`undoData.prevTable`, …): deshacer tras
un cambio remoto restauraría datos viejos y pisaría al otro. Política v1:
- Undo solo contiene acciones propias (las remotas no se registran, ver Fase 3).
- Cuando llega una op remota sobre una entidad presente en una entrada de undo,
  esa entrada (y las anteriores que dependan de ella) **se invalida** y se quita
  de la pila. Se muestra en el tooltip del botón deshacer: "Algunos pasos ya no
  se pueden deshacer porque otra persona editó esos elementos".
- Undo por propiedad (restaurar solo lo que uno cambió) es mejora futura.

## Errores visibles al usuario

| Motivo (`rejected.reason`) | UI |
| --- | --- |
| `entity_deleted` | Toast: "Ana eliminó la tabla `users` mientras la editabas" + Restaurar como nueva |
| `invalid_reference` | Toast: "La relación no se pudo crear: el campo ya no existe" |
| `forbidden_role` | Banner: "Ahora tienes acceso de solo lectura"; cambia a `readonly` |
| `validation_failed` | Toast con el detalle; la op se revierte localmente |
| Lote rechazado entero (500 tras reintentos) | Estado "Error al guardar" actual de `LastSaved` con reintentar |

Los rechazos parciales ya no abortan el lote completo: cada op se aplica en un
`SAVEPOINT`; si falla, `ROLLBACK TO SAVEPOINT` y se marca rechazada. Evita el
"lote envenenado que se reintenta para siempre" que el código actual ya tuvo
que parchear (patch de diagrama vacío).

## Archivos a revisar

- `server/src/modules/sync/sync.service.ts` (`applyOperation`, `collapseOperations`, savepoints)
- `server/src/modules/diagrams/diagrams.service.ts` (helpers de array JSONB)
- `server/src/lib/schemas.ts` (`fieldPatchSchema`, `indexPatchSchema`, …)
- `src/context/chartdb-context/chartdb-provider.tsx` (mutadores de campo/índice/constraint L648-1213)
- `src/context/storage-context/api-storage-provider.tsx`, `sync-engine.ts`
- `src/context/history-context/*` (invalidación de entradas)

## Riesgos

- Orden de elementos de `fields` depende de la posición en el array: usar la
  propiedad `order` del campo (si no existe en todos, normalizar al crear la op).
- Cascadas servidor/cliente divergentes → el cliente nunca calcula cascadas de
  un borrado remoto por su cuenta; solo aplica lo que el servidor difunde.

## Criterios de aceptación

- [ ] Test de servidor: dos lotes concurrentes que editan columnas distintas de
      la misma tabla → ambas ediciones persisten.
- [ ] Test de servidor: misma propiedad → queda el valor del lote con mayor `version`.
- [ ] Edición sobre entidad borrada → `rejected: entity_deleted`, resto del lote aplicado.
- [ ] Test de cliente: lotes remotos desordenados (v3, v2) se aplican como v2, v3.
- [ ] Test de cliente: cambio local en cola no se pisa visualmente por un remoto
      a la misma propiedad y termina ganando en el servidor.
- [ ] Tras cualquier secuencia de los casos de la tabla, `GET /diagrams/:id` en
      ambos clientes devuelve estados idénticos al del canvas.
