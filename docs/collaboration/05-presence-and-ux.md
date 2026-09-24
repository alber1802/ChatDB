# Fase 5 — Presencia y experiencia de colaboración

## Objetivo

Saber quién está en el diagrama, quién está editando qué y en qué estado está
la conexión, con un coste de red y de render casi nulo.

## Modelo de presencia

Estado efímero (nunca en Postgres), por sesión (pestaña):

```ts
interface PresenceState {
  sessionId: string;
  userId: string;
  displayName: string;   // de user_profiles, lo pone el SERVIDOR (no el cliente)
  avatarUrl: string | null;
  color: string;         // derivado de hash(userId) sobre una paleta fija accesible
  role: 'owner' | 'editor' | 'viewer';
  focus: { entity: 'table' | 'area' | 'note' | 'relationship'; id: string } | null;
  idle: boolean;         // sin interacción 60 s o pestaña oculta
}
```

- Mensajes WS: `presence_snapshot` (al unirse), `presence_join`,
  `presence_update`, `presence_leave`. El cliente solo envía `focus` e `idle`.
- `focus` se envía al seleccionar/abrir para editar un elemento (panel lateral,
  doble clic, inicio de drag), **throttle 500 ms**, y `null` al perder foco.
- Servidor: mapa en memoria por sala; con Redis, hash `presence:{diagramId}`
  (`sessionId → estado`, TTL 60 s renovado por heartbeat) para ver usuarios de
  otras instancias. Una salida sin `close` limpio caduca por TTL.
- Varias pestañas del mismo usuario se agrupan en la UI (un avatar).

## UI

| Elemento | Ubicación | Detalle |
| --- | --- | --- |
| Pila de avatares | `top-navbar.tsx`, junto a "Compartir" | Máx. 4 + "+N"; iniciales si no hay avatar; borde con `color`; atenuado si `idle`; tooltip "Ana Pérez · Editor · editando `users`" |
| Indicador en el elemento | `TableNode`, área, nota | Borde/anillo de 2 px con el `color` y una etiqueta pequeña con iniciales en la esquina, solo mientras alguien tiene `focus` sobre él. Sin animación permanente |
| Estado de conexión | `last-saved.tsx` (ya muestra saving/error/offline) | Añadir: "En vivo" (punto verde), "Reconectando…" (tras 2 s sin conexión, para no parpadear), "Sin conexión — tus cambios se guardarán al volver" |
| Solo lectura | barra del editor | Chip "Solo lectura" para viewer |
| Autor del cambio | panel lateral de la tabla | Texto "Editado por Ana hace 1 min" (último `userId` recibido para esa entidad, solo en memoria de la sesión). En el canvas: contorno del color del autor durante 1,5 s tras un cambio remoto (transición CSS, respeta `prefers-reduced-motion`) |
| Aviso de conflicto | toast (`sileo`, ya montado en `src/app.tsx`) | Ver Fase 4 |

## Rendimiento

- La presencia vive en un **contexto propio** (`presence-context`), separado de
  `chartdb-context`: un cambio de presencia no re-renderiza el canvas completo.
- `TableNode` recibe solo `focusedBy?: { color, initials } | undefined` calculado
  por id con un selector; añadirlo a `arePropsEqual`
  (`table-node.tsx:76-95`) compara por valor primitivo → solo re-renderiza la
  tabla cuyo foco cambió.
- Actualizaciones de presencia agrupadas por frame; nunca más de 1 render por
  frame por cambio de presencia.

## Fuera de alcance (mejoras futuras)

Cursores compartidos, arrastre en vivo de otros, "seguir a un usuario",
selección múltiple visible, chat. Todas usan el mismo canal WS con mensajes
efímeros, así que se pueden añadir sin cambiar la arquitectura.

## Archivos a revisar

- `src/pages/editor-page/top-navbar/top-navbar.tsx`, `top-navbar-mobile.tsx`, `last-saved.tsx`
- `src/pages/editor-page/canvas/table-node/table-node.tsx` (memo), nodos de área y nota
- `src/pages/editor-page/side-panel/` (selección/edición de tablas → `focus`)
- `src/components/` avatar existente (`@radix-ui/react-avatar` ya es dependencia)

## Riesgos

- Suplantación: nombre/avatar/rol los pone el servidor a partir del JWT; el
  cliente no puede enviarlos.
- Ruido visual con muchos usuarios: máximo de indicadores en canvas = usuarios
  con `focus` no nulo; los `idle` no muestran indicador.

## Criterios de aceptación

- [ ] Al abrir el diagrama en B, A ve el avatar de B en < 1 s; al cerrar la
      pestaña desaparece en < 5 s (close limpio) o < 60 s (caída).
- [ ] Seleccionar una tabla en B muestra el indicador en esa tabla en A y en
      ninguna otra; en el profiler de React solo re-renderiza ese `TableNode`.
- [ ] El estado de conexión pasa por En vivo → Reconectando → En vivo al cortar
      y restaurar la red.
- [ ] Avatares y estados accesibles (texto alternativo, contraste AA, tooltips
      por teclado).
