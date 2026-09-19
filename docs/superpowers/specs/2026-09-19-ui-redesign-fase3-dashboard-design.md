# Rediseño UI/UX de ChartDB — Fase 3: Dashboard

## Contexto

Tercer sub-proyecto del rediseño de UI/UX. Consume los tokens de Fase 1
(`--primary` azul, `--success`/`--warning`/`--info`/`--destructive`, radius
explícito) y los componentes base ya corregidos en Fase 2 (Button, iconos
lucide, EmptyState). Alcance: `src/pages/diagrams-dashboard/` y
`src/dashboard-bg.css` (compartido con `src/pages/admin/admin-layout.tsx`,
que también se beneficia del cambio sin requerir tocar ese archivo).

Precede a este spec una auditoría de código real (contenido completo de
cada archivo del dashboard) que fundamenta cada decisión de abajo.

**Hallazgo general**: el dashboard actual ya está bastante bien construido
—header/navbar, toolbar con búsqueda+filtro+toggle de vista+CTA, grid/list,
estados vacíos distintos para "sin diagramas" vs "sin resultados de
búsqueda"— así que esta fase es de **ajuste dirigido**, no de reconstrucción:
4 cambios puntuales, no un rediseño completo de la página.

**Explícitamente fuera de alcance**: traducir el dashboard a i18n (decisión
ya tomada en fases anteriores), agregar metadata de colaboradores/dueño a
las tarjetas (no existe en el dominio hoy y no se pidió), tocar
`admin-layout.tsx` más allá de heredar automáticamente el fix de
`dashboard-bg.css`, arquitectura/API/SyncEngine.

## 1. Fondo animado (`src/dashboard-bg.css`)

**Hallazgo**: 698 líneas — 40 declaraciones `@property`, dos animaciones
`@keyframes` (`ani-dashboard-bg-light`/`dark`) de 10 "blobs" de gradiente
moviéndose en loop infinito de 12s, aplicadas vía la clase
`.dashboard-animated-bg` tanto en `diagrams-dashboard.tsx:117` como en
`admin-layout.tsx:13`. **Cero referencias a los tokens de Fase 1** — cada
color es un `hsla(...)` literal. Choca directamente con los principios ya
acordados para este rediseño (evitar gradientes/efectos tipo landing page,
priorizar rendimiento).

**Decisión (confirmada con el usuario)**: reemplazar por una superficie
estática basada en tokens, sin animación. Mismo espíritu que el overlay ya
existente en el banner de bienvenida (`bg-primary/10 blur-3xl`,
`diagrams-dashboard.tsx:118`), pero como CSS plano en vez de un div extra.

**Cambio**: reemplazar el contenido completo de `src/dashboard-bg.css` (las
698 líneas: los 40 `@property`, ambos `@keyframes`, y ambas clases) por:

```css
.dashboard-animated-bg {
    background-color: hsl(var(--background));
    background-image: radial-gradient(
        ellipse 80% 50% at 50% -10%,
        hsl(var(--primary) / 0.06),
        transparent 60%
    );
}

.dark .dashboard-animated-bg {
    background-color: hsl(var(--background));
    background-image: radial-gradient(
        ellipse 80% 50% at 50% -10%,
        hsl(var(--primary) / 0.1),
        transparent 60%
    );
}
```

Se mantiene el nombre de clase `.dashboard-animated-bg` exactamente igual
(aunque ya no anima) para no tener que tocar `diagrams-dashboard.tsx` ni
`admin-layout.tsx` — ambos heredan el fix automáticamente.

## 2. Sección "Recientes"

**Hallazgo**: hoy no existe distinción entre "recientes" y "todos" — una
sola lista/grid ordenada por `updatedAt` descendente (el hook
`use-dashboard.ts:19-24` ya ordena así, así que no hace falta ordenar de
nuevo). El spec original de todo el rediseño pedía explícitamente una
sección de acceso rápido a los últimos diagramas.

**Decisión (confirmada)**: agregar una fila "Recientes" con los primeros 4
diagramas del array ya ordenado (`diagrams.slice(0, 4)`), **solo cuando no
hay búsqueda ni filtro activo y hay más de 4 diagramas en total** (si hay 4
o menos, mostrar "Recientes" sería mostrar la misma lista dos veces
seguidas — redundante). Reusa el componente `DiagramCard` tal cual existe
hoy, sin modificarlo.

**Cambio en `diagrams-dashboard.tsx`**: entre la `DashboardToolbar` y el
bloque de contenido actual, agregar:

```tsx
{!loading &&
    !searchQuery &&
    selectedDBType === 'all' &&
    diagrams.length > 4 && (
        <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recientes
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {diagrams.slice(0, 4).map((diagram) => (
                    <DiagramCard
                        key={diagram.id}
                        diagram={diagram}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onDuplicate={handleDuplicate}
                    />
                ))}
            </div>
        </div>
    )}
```

Y agregar un encabezado equivalente arriba del bloque de contenido
existente (grid/list de `filteredDiagrams`), para que la jerarquía quede
clara:

```tsx
<h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
    Todos los diagramas
</h2>
```

(Este segundo encabezado se muestra siempre que haya contenido que
renderizar — no solo cuando "Recientes" está visible — para que la sección
principal esté siempre rotulada, con o sin "Recientes" arriba.)

## 3. Atajo de teclado para la búsqueda (Ctrl+K / ⌘K)

**Hallazgo**: la búsqueda (`dashboard-toolbar.tsx`) no tiene atajo de
teclado — solo se puede hacer click en el input.

**Decisión (confirmada)**: agregar `Ctrl+K`/`⌘K` para enfocar el input de
búsqueda, con un hint visual `<kbd>` dentro del input (patrón estándar:
GitHub, Linear, Vercel). El proyecto ya tiene `react-hotkeys-hook` como
dependencia (usado en el editor vía `KeyboardShortcutsProvider`) y ya tiene
`getOperatingSystem()` en `@/lib/utils` para elegir la etiqueta correcta
según el SO — no hace falta agregar el atajo al `keyboardShortcuts` enum
del editor (es un sistema aparte, específico del editor, montado en una
rama de rutas distinta a la del dashboard); esto se implementa de forma
autocontenida dentro de `DashboardToolbar`.

**Cambio en `dashboard-toolbar.tsx`**:
- Agregar `useRef<HTMLInputElement>(null)` para el input de búsqueda y
  pasarlo como `ref` al componente `Input`.
- Agregar `useHotkeys('mod+k', (e) => { e.preventDefault();
  inputRef.current?.focus(); })` de `react-hotkeys-hook`.
- Mostrar un `<kbd>` con la etiqueta (`⌘K` en mac, `Ctrl+K` en el resto,
  vía `getOperatingSystem()`) alineado a la derecha del input, **solo
  cuando `!searchQuery`** (cuando hay texto, ese mismo lugar ya lo ocupa el
  botón de limpiar "X" que existe hoy — son mutuamente excluyentes, nunca
  se muestran los dos a la vez).

## 4. Colores de estado sin tokenizar

**Hallazgo**: no queda ningún `pink-*` en el dashboard (ya resuelto en
fases anteriores), pero sí quedan varios colores Tailwind crudos que
deberían ser tokens semánticos de Fase 1:

| Archivo:línea | Actual | Nuevo |
|---|---|---|
| `dashboard-header.tsx:48` (badge rol `super_admin`) | `bg-red-500/10 text-red-500 border border-red-500/20` | `bg-destructive/10 text-destructive border border-destructive/20` |
| `dashboard-header.tsx:54` (badge rol `admin`) | `bg-blue-500/10 text-blue-500 border border-blue-500/20` | `bg-info/10 text-info border border-info/20` |
| `dashboard-header.tsx:60` (badge rol default/`user`) | `bg-green-500/10 text-green-500 border border-green-500/20` | `bg-muted text-muted-foreground border border-border` (un usuario normal no es un "éxito" — `--success` queda reservado para el estado de guardado del SyncEngine, por eso se usa neutro acá) |
| `dashboard-header.tsx:181` (item "Cerrar Sesión") | `text-red-600 focus:text-red-600` | `text-destructive focus:text-destructive` |
| `diagram-card.tsx:139` (item "Eliminar") | `text-red-600 focus:bg-red-500/10 focus:text-red-600` | `text-destructive focus:bg-destructive/10 focus:text-destructive` |
| `diagram-card.tsx:205` (botón confirmar eliminar) | `bg-red-600 text-white hover:bg-red-700` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `diagram-list-item.tsx:156` (item "Eliminar") | `text-red-600 focus:bg-red-500/10 focus:text-red-600` | `text-destructive focus:bg-destructive/10 focus:text-destructive` |
| `diagram-list-item.tsx:200` (botón confirmar eliminar) | `bg-red-600 text-white hover:bg-red-700` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `profile-settings-dialog.tsx:180` y `:254` (mensaje de éxito) | `border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400` | `border-success/20 bg-success/10 text-success` |

Los íconos de sol/luna del toggle de tema (`amber-500`/`slate-700`,
`dashboard-header.tsx:110,112`) **no se tocan** — son una representación
literal de sol/luna, no un color de estado semántico, y no forman parte del
sistema de tokens de marca/estado.

## Fuera de alcance de esta fase

- Traducción i18n del dashboard.
- Metadata de colaboradores/dueño en las tarjetas (no existe en el dominio).
- `admin-layout.tsx` — solo hereda el fix del punto 1 sin que se lo toque
  directamente.
- Cualquier cambio a `TableNode`, canvas, sidebar del editor, dialogs de
  negocio.

## Próximos pasos

Este spec pasa a `writing-plans`.
