# Fase 7 — Pruebas e implementación progresiva

## Herramientas

| Nivel | Herramienta | Estado |
| --- | --- | --- |
| Unitarias frontend | Vitest + Testing Library | ya existe (`pnpm test`) |
| Unitarias/integración backend | Vitest + supertest; integración con Postgres real vía `INTEGRATION=1` | ya existe (`server/test/`, `server/test/integration/`) |
| WebSocket | cliente `ws` dentro de Vitest contra `createApp()` + servidor en puerto efímero | nuevo |
| Multiusuario E2E | **Playwright** con dos `browserContext` (dos sesiones aisladas) | nuevo (`pnpm add -D @playwright/test`); el MCP chrome-devtools sirve para exploración manual, no para CI |
| Carga | script Node con N clientes `ws` + `fetch` simulando editores | nuevo (`server/scripts/load-collab.ts`) |

Usuarios de prueba: dos o tres cuentas dedicadas en el proyecto Supabase de
desarrollo (nunca datos reales). Cada suite crea y borra sus propios diagramas.

## Pruebas por fase

| Fase | Unitarias | Integración / autorización | E2E |
| --- | --- | --- | --- |
| **F1** Roles | mapper `accessRole`; `readonly` según rol en `editor-page` | Matriz rol × acción en Postgres real: owner/editor/viewer/ajeno × leer/escribir/gestionar/borrar; `POST /sync` de viewer → 403 sin aplicar nada | Viewer abre el diagrama sin controles de edición |
| **F2** Invitaciones | normalización de email; estados del modal; combobox accesible | Funciones SQL: duplicada, miembro existente, a sí mismo, expirada, email distinto al aceptar, revocar; enumeración limitada en búsqueda | Owner invita → invitado acepta desde Dashboard → ve el diagrama; rechazo; enlace por token |
| **F4-a** Sub-entidades | `collapseOperations` con `entity:parentId:id`; mutadores de campo encolan op `field` con patch mínimo | Dos lotes concurrentes sobre columnas distintas de la misma tabla → ambas persisten; `batchId` repetido no reaplica; savepoint: una op inválida no aborta el lote | — |
| **F3** Tiempo real | `SyncEngine`: orden por versión, búfer de huecos, duplicados, `version = max`; `applyRemoteOperations` conserva referencias (test de identidad de objetos) | WS: auth por primer mensaje, token inválido/expirado, `join` sin acceso → 4003, catch-up desde `diagram_ops`, `resync` con hueco > retención; dos instancias + Redis | A crea/edita/borra tabla, columna, relación, área, nota → B lo ve sin recargar |
| **F4-b** Conflictos | rebase: local en cola vs remoto misma propiedad; en vuelo con ack mayor/menor; delete remoto purga cola; invalidación de undo | Borrar vs editar → `entity_deleted`; relación a campo borrado → `invalid_reference`; cascada de borrado de campo difundida | Dos usuarios renombran la misma tabla a la vez → ambos convergen al mismo nombre; toast al perdedor |
| **F5** Presencia | reducer de presencia; agrupación por usuario; `focusedBy` en memo de `TableNode` | TTL de presencia en Redis; nombre/rol puestos por el servidor | Avatares aparecen/desaparecen; indicador de foco en la tabla correcta |
| **F6** Seguridad / rendimiento | token bucket; backoff con jitter | Límites: payload WS, mensajes/s, conexiones por usuario, ráfaga `/sync`; `parentId` de otro diagrama rechazado; re-verificación periódica de rol | Traza de rendimiento: 100 tablas, drag local + 5 lotes/s remotos |

## Escenarios transversales obligatorios

1. **Dos o más usuarios:** 3 contextos Playwright editan en paralelo durante 60 s
   con acciones aleatorias sobre entidades distintas y compartidas; al final,
   `GET /diagrams/:id` == estado del canvas en los tres.
2. **Desconexión/reconexión:** `context.setOffline(true)` 60 s en B mientras A
   edita y B también edita offline; al volver, convergencia sin duplicados.
3. **Reinicio del servidor** con clientes conectados (integración): reconexión y catch-up.
4. **Respuesta perdida:** interceptar la respuesta de `/sync` (Playwright
   `route.abort` tras el envío) → reintento con el mismo `batchId` sin duplicar.
5. **Revocación en vivo:** owner revoca a B con el editor abierto → B sale en < 5 s
   y su cola pendiente recibe 403 y se descarta.
6. **Rendimiento con diagramas grandes:** plantilla de 100+ tablas (hay
   plantillas en `src/templates-data/`), 5 clientes de carga enviando 2 lotes/s;
   medir p95 commit→broadcast < 200 ms en servidor y fps del cliente observado.

## Criterios de finalización por fase

Una fase está terminada cuando:
- [ ] Sus criterios de aceptación (en su documento) están verificados.
- [ ] Sus pruebas unitarias e integración pasan en `pnpm test:ci` y `cd server && pnpm test` (con `INTEGRATION=1` donde aplique).
- [ ] `pnpm lint` y `tsc -b` sin errores; `server` `pnpm typecheck` limpio.
- [ ] La migración SQL está en `server/sql/` con cabecera explicativa y aplicada en desarrollo.
- [ ] `AGENTS.md` actualizado si cambia algo estructural (nuevo módulo, tabla, variable de entorno).
- [ ] Sin regresiones en el guardado individual (un solo usuario) — la suite
      existente de `sync-engine.test.ts` y `api-storage-provider.test.tsx` pasa.

## Implementación progresiva y despliegue

- Cada fase en su propia rama desde `develop` (`feature/collab-f1-roles`, …) y
  PR a `develop`; `develop` → `main` cuando F1+F2 estén completas (compartir sin
  tiempo real ya es útil por sí solo).
- **Feature flag** `VITE_COLLAB_REALTIME` (frontend) y `REALTIME_ENABLED`
  (backend): con el flag apagado el editor funciona exactamente como hoy; permite
  desplegar F3 sin activarla.
- Compatibilidad hacia atrás del contrato `/sync` (campos nuevos opcionales;
  `conflicts` vacío mantenido) para no romper pestañas con el bundle anterior.
- Orden recomendado (ver `README.md`): **F1 → F2 → F4-a → F3 → F4-b → F5 → F6 → F7**.
