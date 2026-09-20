# Rediseño UI/UX de ChartDB — Fase 4: Migración final de `pink-*`

## Contexto

Cuarto sub-proyecto del rediseño de UI/UX. Consume los tokens de Fase 1
(`--primary` azul, `--success`/`--warning`/`--info`/`--destructive`) y los
componentes base de Fase 2. La bitácora (`estructura-UI.md`) describía el
alcance como "el editor/canvas", estimando "54 usos de `pink-*` en 29
archivos del editor/canvas" — una auditoría del código real (no de
memoria) mostró que esa cifra estaba mal atribuida.

**Hallazgo real**: quedan **53 usos de `pink-*` en 28 archivos**, y solo
29 de esos usos (15 archivos) son del editor/canvas propiamente dicho. Los
otros 24 usos (13 archivos) están en páginas públicas (galería de
templates/examples), diálogos de export/import, componentes compartidos
(`link`, `list-menu`, `code-snippet`) y una pantalla de error de red
totalmente aislada del sistema de diseño.

**Decisión de alcance (confirmada con el usuario)**: esta fase cubre **los
53 usos, en los 28 archivos**, no solo el editor/canvas. Es la limpieza
final de `pink-*` en todo el repo — después de esta fase no debe quedar
ningún uso de la paleta `pink` en `src/`.

Todos los mapeos de color de abajo respetan las reglas ya fijadas en el
spec de Fase 1: **azul sólido** (`--primary`) para selección, estados
activos y acciones frecuentes; **`--info`** (cyan) para contenido
puramente informativo o de estado transitorio (nunca para acciones);
**`--destructive`** (rojo) reservado para error/eliminar. `--success`
(verde) no aparece en ningún mapeo de esta fase — sigue exclusivo del
estado "Guardado" del SyncEngine.

## 1. Selección — bordes, stroke y relleno → `--primary`

Ya decidido en el spec de Fase 1 ("selección con borde azul marcado").
Esta fase lo ejecuta en los nodos y edges que quedaban con `pink-600`
hardcodeado:

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `table-node.tsx:353` | `border-pink-600` (tabla seleccionada) | `border-primary` |
| `area-node.tsx:123` | `selected ? 'border-pink-600' : 'border-transparent'` | `selected ? 'border-primary' : 'border-transparent'` |
| `note-node.tsx:145` | `selected ? 'border-pink-600' : ...` | `selected ? 'border-primary' : ...` |
| `relationship-edge.tsx:385` | `` selected ? '!stroke-pink-600' : '!stroke-slate-400' `` | `selected ? '!stroke-primary' : '!stroke-slate-400'` |
| `dependency-edge.tsx:138` | `` selected ? '!stroke-pink-600' : '!stroke-blue-400' `` | `selected ? '!stroke-primary' : '!stroke-blue-400'` |
| `marker-definitions.tsx:50` | `? 'fill-pink-600'` (flecha del edge seleccionado) | `? 'fill-primary'` |

**Campo destacado por relación seleccionada** (`table-node-field.tsx:355`):
hoy el campo que participa en la relación seleccionada se resalta con
`bg-pink-100 dark:bg-pink-900`. Es la misma selección de arriba, no un
estado aparte — pasa a un tinte de `--primary` en vez de un color propio:

```diff
- 'bg-pink-100 dark:bg-pink-900':
+ 'bg-primary/10 dark:bg-primary/20':
      highlighted && !isCustomTypeHighlighted && visible,
```

(No confundir con `isCustomTypeHighlighted`, que ya usa `--warning`
amarillo, ni con `isDiffFieldChanged`, que ya usa `sky-*`/`--info` — ambos
quedan sin tocar, son estados distintos.)

## 2. Handles de conexión y resize → `--primary`

Los puntos que aparecen al pasar el mouse sobre un campo (para crear una
relación) o sobre el borde de un área/nota (para redimensionar) son
acciones activas, no decoración — mismo criterio que el resto de
"estados activos" de Fase 1.

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `table-node-field.tsx:376,382` | Handle `!bg-pink-600` (source, campo) | `!bg-primary` |
| `table-node-dependency-indicator.tsx:84,90` | Handle `!bg-pink-600` (vista/dependencia) | `!bg-primary` |
| `area-node.tsx:165` | `handleClassName="...!bg-pink-600"` (resize de área) | `!bg-primary` |
| `note-node.tsx:166` | `lineClassName="!border-pink-500"` (resize de nota) | `!border-primary` |
| `note-node.tsx:167` | `handleClassName="...!bg-pink-500..."` (resize de nota) | `!bg-primary` |

## 3. Navegación y toggles activos → `--primary`

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `editor-sidebar.tsx:198,223,257` (3 repeticiones idénticas) | `data-[active=true]:text-pink-600 data-[active=true]:hover:bg-pink-100 dark:data-[active=true]:text-pink-400 dark:data-[active=true]:hover:bg-pink-950` | `data-[active=true]:text-primary data-[active=true]:hover:bg-primary/10 dark:data-[active=true]:hover:bg-primary/20` (una sola expresión sirve para light y dark, sin duplicar tonos por separado) |
| `toolbar.tsx:102` | `'bg-pink-500 text-white hover:bg-pink-600 hover:text-white': hasActiveFilter` | `'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground': hasActiveFilter` |
| `canvas.tsx:1792` | `snapToGridEnabled \|\| shiftPressed ? 'bg-pink-600 text-white hover:bg-pink-500 dark:hover:bg-pink-700 hover:text-white' : ''` | `... ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''` |

El badge del footer del sidebar (`editor-sidebar.tsx:252`,
`bg-pink-500`) hoy no tiene ningún consumidor real (`item.badge` nunca se
setea en el código actual) — se tokeniza igual por consistencia, como
`bg-info` (ver sección 6), sin agregarle lógica nueva.

## 4. Botones, íconos de acción, links y checkboxes → `--primary`

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `relationship-edge.tsx:417` | `border-2 border-pink-600 bg-background shadow-lg ... hover:bg-pink-50` (botón flotante editar/eliminar relación) | `border-2 border-primary bg-background shadow-lg ... hover:bg-primary/10` |
| `relationship-edge.tsx:421` | `<EllipsisIcon className="size-4 text-pink-600" />` | `text-primary` |
| `table-node-field.tsx:627` | `<Pencil className="!size-3.5 text-pink-600" />` (editar campo) | `text-primary` |
| `canvas.tsx:1901` | `size-11 bg-pink-600 p-2 hover:bg-pink-500` (botón flotante mobile, abre side panel) | `size-11 bg-primary p-2 hover:bg-primary/90` |
| `list-menu.tsx:24-27` | `text-pink-600 dark:text-white ... hover:bg-pink-100 dark:hover:bg-pink-900`, item seleccionado `bg-pink-100 dark:bg-pink-900`, hover no-seleccionado `hover:bg-pink-50 dark:hover:bg-pink-950 hover:text-pink-600` | `text-primary dark:text-white ... hover:bg-primary/10 dark:hover:bg-primary/20`; seleccionado `bg-primary/10 dark:bg-primary/20`; hover `hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary` |
| `link.tsx:10` | `text-pink-600 hover:underline` (componente `Link` genérico) | `text-primary hover:underline` |
| `export-sql-dialog.tsx:209,224` | `text-pink-600 hover:underline` (links a soporte/GitHub) | `text-primary hover:underline` |
| `export-image-dialog.tsx:108,135` | `data-[state=checked]:border-pink-600 data-[state=checked]:bg-pink-600 data-[state=checked]:text-white` (checkboxes "patrón de fondo" / "transparente") | `data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground` |
| `select-tables.tsx:634` | `<Check className="size-4 text-pink-600" />` (tabla seleccionada en la lista) | `text-primary` |
| `select-tables.tsx:667` | `bg-pink-500 text-white hover:bg-pink-600` (botón "Import") | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `template-card.tsx:24` | `hover:border-pink-600` (tarjeta de template, galería pública) | `hover:border-primary` |
| `example-card.tsx:36` | `hover:border-pink-600` (tarjeta de example, galería pública) | `hover:border-primary` |

## 5. Spinners → `--primary`

Ya hay precedente en el propio código: `protected-route.tsx`,
`admin-route.tsx` y `full-screen-spinner-provider.tsx` usan `text-primary`
en su spinner. Estos tres quedaron afuera de esa migración porque están
en páginas públicas, no en el flujo autenticado:

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `templates-page.tsx:93` | `text-pink-600` | `text-primary` |
| `template-page.tsx:153` | `text-pink-600` | `text-primary` |
| `clone-template-page.tsx:53` | `text-pink-600` | `text-primary` |

## 6. Informativo / estado transitorio → `--info`

Nunca acción, nunca selección — solo comunican "esto es información" o
"esto está en curso". Mismo criterio que ya fija el spec de Fase 1 para
`--info` ("badges informativos").

| Archivo:línea | Actual | Nuevo | Qué es |
|---|---|---|---|
| `show-all-button.tsx:49` | `bg-pink-600` (círculo detrás del ícono `Info`) | `bg-info` | Pill "hay contenido fuera de vista" |
| `ssms-info.tsx:53` | `text-pink-600` (ícono `Info` + label, abre hover-card) | `text-info` | Trigger de ayuda contextual |
| `canvas.tsx:1884` | `<Badge className="bg-pink-600 text-white">` (`{t('loading_diagram')}`) | `bg-info text-info-foreground` | Estado transitorio de carga — no es un éxito, no es una acción |
| `code-snippet.tsx:227` | `animate-blink rounded-full bg-pink-600` (punto parpadeante, `!isComplete`) | `bg-info` | "Generando código todavía" |
| `editor-sidebar.tsx:252` | `bg-pink-500` (badge del footer, sin consumidor hoy) | `bg-info` | Badge genérico, tokenizado por consistencia |
| `table-edit-mode-field.tsx:98` | `border-t-pink-500` (triángulo esquina, campo con comentario) | `border-t-info` | Indicador "este campo tiene un comentario" |
| `table-field.tsx:107` (side-panel) | `border-t-pink-500` | `border-t-info` | Mismo indicador, vista de lista |
| `table-index.tsx:130` (side-panel) | `border-t-pink-500` | `border-t-info` | Mismo indicador, para índices |

`--info-foreground`/`bg-info`/`text-info` ya existen desde la Fase 1
(`src/globals.css:27-28,78-79` y su mapeo en `tailwind.config.js`) — esta
fase no crea ningún token nuevo, solo consume los que ya están.

## 7. `route-error-boundary.tsx` — retinte a `--destructive` y simplificación

**Hallazgo**: es una pantalla completa de error de conexión/carga con su
propio diseño "glass" aislado — gradiente `pink→purple→indigo`, blur,
glow, fondo `slate-950` a mano — que nunca pasó por el sistema de tokens
(Fase 1, 2 ni 3). Semánticamente es un error real (`WifiOff`, "Conexión no
disponible"), no una selección ni una acción, así que el pink actual no
correspondía ni antes ni ahora.

**Decisión (confirmada con el usuario)**: retintar a `--destructive` y
quitar el gradiente/blur/glow decorativo, para que la pantalla use las
mismas superficies que el resto de la app.

**Cambio completo** (`src/components/route-error-boundary/route-error-boundary.tsx`):

```diff
- <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-200 selection:bg-pink-500/30">
-     <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700/80">
-         {/* Decorative top gradient */}
-         <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
-
+ <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-background p-4 font-sans text-foreground selection:bg-destructive/30">
+     <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
-             {/* Icon Container with glowing effect */}
-             <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-slate-800/50 text-pink-500 shadow-inner">
-                 <WifiOff className="size-8 animate-pulse text-pink-400" />
-                 <div className="absolute inset-0 rounded-2xl bg-pink-500/10 blur-xl" />
-             </div>
+             <div className="mb-6 flex size-16 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
+                 <WifiOff className="size-8" />
+             </div>

-             <h1 className="mb-3 text-2xl font-bold tracking-tight text-white">
+             <h1 className="mb-3 text-heading font-bold tracking-tight text-foreground">
                  Conexión no disponible
              </h1>

-             <p className="mb-8 text-sm leading-relaxed text-slate-400">
+             <p className="mb-8 text-body leading-relaxed text-muted-foreground">
                  No se ha podido conectar con el servidor o ha ocurrido
                  un error inesperado al cargar la aplicación. Por favor,
                  verifica tu conexión a Internet o inténtalo de nuevo.
              </p>

              <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
                  <Button
                      onClick={handleReload}
-                     className="flex cursor-pointer items-center justify-center gap-2 border-none bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-500/10 transition-all duration-200 hover:scale-[1.02] hover:from-pink-500 hover:to-purple-500 active:scale-[0.98]"
+                     className="flex cursor-pointer items-center justify-center gap-2 bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                  >
                      <RotateCcw className="size-4" />
                      <span>Reintentar</span>
                  </Button>
                  <Button
                      onClick={handleGoHome}
                      variant="secondary"
-                     className="flex cursor-pointer items-center justify-center gap-2 border border-slate-700 bg-slate-800/40 text-slate-300 transition-all duration-200 hover:scale-[1.02] hover:bg-slate-800 hover:text-white active:scale-[0.98]"
+                     className="flex cursor-pointer items-center justify-center gap-2"
                  >
                      <Home className="size-4" />
                      <span>Ir al inicio</span>
                  </Button>
              </div>
          </div>
      </div>
-
-     {/* Subtle background glow blobs */}
-     <div className="absolute left-1/4 top-1/4 -z-10 size-72 rounded-full bg-pink-600/5 blur-[120px]" />
-     <div className="absolute bottom-1/4 right-1/4 -z-10 size-72 rounded-full bg-purple-600/5 blur-[120px]" />
  </div>
```

El botón "Ir al inicio" pasa a usar el `variant="secondary"` del componente
`Button` tal cual (sin overrides de color) — ya se ve correcto sobre
`--card` sin necesitar clases `slate-*` a mano. Se quitan los `hover:scale`
del botón "Reintentar" y las animaciones de escala de ambos botones:
coherente con el principio ya fijado para esta fase (superficies
livianas, sin microinteracciones tipo landing page en un componente de
error crítico).

## Fuera de alcance de esta fase

- Cualquier `pink-*` que no exista hoy en el código (no se auditó de
  memoria, solo lo encontrado por grep real).
- Rediseño de contenido/copy de `route-error-boundary.tsx` más allá del
  cambio de color y superficies — el texto y la estructura quedan iguales.
- Nueva lógica para `editor-sidebar.tsx`'s `item.badge` (sigue sin
  consumidor; solo se tokeniza el color por si se usa a futuro).
- Dialogs/menús no relacionados con `pink-*` (ej. contenido, copy,
  validaciones) — eso es Fase 5+.
- Accesibilidad, responsive, performance — Fase 5+.

## Próximos pasos

Este spec pasa a `writing-plans`.
