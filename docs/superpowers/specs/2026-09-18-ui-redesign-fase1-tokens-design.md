# Rediseño UI/UX de ChartDB — Fase 1: Design Tokens y Fundamentos Visuales

## Contexto

Este spec es el primero de una serie de sub-proyectos que conforman un rediseño
profundo de UI/UX del fork de ChartDB (ver `AGENTS.md` para contexto general
del proyecto). El alcance de esta fase es exclusivamente **fundacional**:
tokens de color, tipografía, spacing, radius, iconografía, motion y
notificaciones. No incluye la implementación componente por componente del
dashboard, editor, canvas, sidebar, toolbar o dialogs — esos son sub-proyectos
posteriores que **consumen** lo que se define acá.

**Explícitamente fuera de alcance de todo el rediseño** (no solo de esta
fase): arquitectura del proyecto, lógica de negocio, API, SyncEngine, modelo
de datos. Este es un rediseño de superficie visual e interacción, no una
reescritura.

**Explícitamente fuera de alcance de esta fase (decidido con el usuario)**:
traducción del dashboard al sistema i18n (se documenta como deuda técnica
conocida, no se aborda ahora).

Precede a este spec una auditoría completa de la UI actual (dashboard,
editor, canvas, sidebar, toolbar, dialogs, dark mode, iconografía, toasts,
sync status) cuyos hallazgos con rutas de archivo exactas motivan cada
decisión de este documento. El hallazgo estructural más importante: existe un
sistema de tokens HSL correcto en `src/globals.css`/`tailwind.config.js`,
pero **el color de marca real visible en toda la app es `pink-600`/`pink-500`
hardcodeado**, desconectado de `--primary`, repetido en decenas de archivos
(botones, toolbar, sidebar activo, tablas seleccionadas, edges). Esta fase
resuelve ese problema estructural, no solo estético.

## Sistema de Color

### Color de marca

Reemplaza el pink hardcodeado. Elegido tras comparación visual con el usuario
(mockups en `.superpowers/brainstorm/`, iterado sobre una captura de
referencia real del editor).

| Token | Light | Dark |
|---|---|---|
| `--primary` | `#2563EB` | `#60A5FA` |

**Regla de uso**: `--primary` sólido para selección, elementos activos,
botones secundarios/frecuentes, bordes de foco, estados interactivos. El
degradado Azul→Cian (`linear-gradient(135deg, #2563EB, #06B6D4)` light /
`linear-gradient(135deg, #60A5FA, #22D3EE)` dark) se reserva **únicamente**
para el CTA "Nuevo diagrama" del dashboard — no para "Agregar tabla" del
editor (acción demasiado frecuente para llevar tratamiento de CTA principal)
ni para ningún otro elemento. Nunca gradiente de fondo ni gradiente
decorativo fuera de ese único botón.

### Colores de estado (nuevos tokens — hoy no existen)

Remapeo deliberado para no colisionar con la semántica del SyncEngine:
"guardado" (verde/success) debe significar exclusivamente que la sincronización
fue exitosa, nunca "elemento recién creado" en una comparación de diff — de
lo contrario un usuario podría confundir ambas señales.

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--success` | `#16A34A` | `#4ADE80` | Exclusivo del estado "Guardado" del SyncEngine. No se usa para diffs. |
| `--warning` | `#D97706` | `#FBBF24` | Resaltado de tipos personalizados, advertencias, anillo de "tablas solapadas" (antes azul — se corrige acá porque azul ya es color de marca/selección y colisionaría). |
| `--info` | `#0891B2` | `#22D3EE` | Estado "Modificado" en diff, indicadores informativos. |
| `--destructive` | *(sin cambios, ya existe)* | *(sin cambios)* | Eliminar, error de sync, tabla eliminada en diff. |

El estado "Creado" en diff **reusa `--primary`** (azul) en vez de un token
nuevo — creación es un evento neutro-positivo, no un "éxito" en el sentido
del sync, y reusar la marca evita inflar el set de tokens.

Resultado consolidado de estados que antes eran ad-hoc:

| Situación | Antes (hardcoded) | Ahora (token) |
|---|---|---|
| Tabla/campo creado (diff) | `green-500` | `primary` (azul) |
| Tabla/campo modificado (diff) | `sky-500` | `info` (cyan) |
| Tabla/campo eliminado (diff) | `red-500` | `destructive` |
| Guardado exitoso (sync) | *(badge sin color semántico fuerte)* | `success` (verde) |
| Advertencia / tipo personalizado resaltado | `yellow-200/400/700/800` | `warning` |
| Tablas solapadas (anillo) | `blue-500` (ring) | `warning` (ámbar) |

### Superficies y jerarquía (dark mode)

El hallazgo de auditoría #7 mostró dos jerarquías de superficie paralelas:
tokens HSL correctos en dashboard/dialogs, pero paleta Tailwind cruda
(`slate-*`/`gray-*` con `dark:` manual) en canvas/sidebar/table-node. Esta
fase unifica ambas bajo una sola jerarquía, recalibrada para no caer en
contraste "gaming":

| Token | Dark | Uso |
|---|---|---|
| `--background` | `#0F172A` | Fondo del canvas y del shell general |
| `--card` / `--surface` | `#1E293B` | Paneles, sidebar, header de tabla, dialogs |
| `--border` | `#334155` | Bordes por defecto |
| `--foreground` | `#F8FAFC` | Texto principal |
| `--muted-foreground` | `#94A3B8` | Texto secundario |
| `--primary` | `#60A5FA` | Marca/selección (ver arriba) |

La jerarquía debe leerse en degradé claro: fondo → panel → tabla → tabla
seleccionada, cada paso con un salto de contraste perceptible pero suave. En
light mode se mantiene la estructura de tokens ya existente en
`globals.css`, sin necesidad de recalibrar (el problema de contraste
excesivo es específico de dark mode).

### Tratamiento de TableNode (principio, no implementación detallada)

Corrige el defecto del mockup inicial (headers en azul intenso, "parece que
todas las tablas están seleccionadas"):

- Fondo del header: superficie con tinte azul muy sutil (mezcla de `--card`
  con una fracción baja de `--primary`), no azul sólido.
- Borde superior/línea de acento: azul sólido, delgado.
- Nombre de tabla: color de texto fuerte neutro (`--foreground`), no azul.
- Iconos PK/FK: azul (`--primary`).
- Selección completa de la tabla: borde azul más marcado que el estado
  normal — debe ser la señal visual dominante de "esto está seleccionado",
  reservando el tinte del header para todas las tablas por igual.

### Tratamiento de Áreas

- Borde: 1–1.5px, azul/violeta muy sutil (opacidad baja sobre `--primary`).
- Fondo: apenas diferenciado del canvas (no un bloque de color visible).
- Radius: 12px (`--radius-lg`).
- Título: etiqueta pequeña integrada al borde, no un header pesado.
- Seleccionada: aumenta contraste de borde y opacidad de fondo.

### Restricción de performance del canvas

Principio rector, aplica a todo lo que se construya sobre el canvas en fases
posteriores: **el canvas debe ser la superficie más liviana visualmente de
toda la aplicación**, porque debe seguir siendo fluido con 250–1000+ tablas.
Prohibido en el canvas (nodos, edges, controles flotantes): `backdrop-filter`/
blur pesado, glassmorphism, sombras grandes (`shadow-xl`/`shadow-2xl`),
gradientes decorativos, animación continua/permanente. El resto de la
aplicación (dashboard, dialogs) puede permitirse más matiz visual porque no
compite con el mismo presupuesto de rendimiento por frame.

## Tipografía

Se mantiene Raleway (`fontFamily.primary` en `tailwind.config.js`). Se
reemplaza el uso disperso de tamaños Tailwind sueltos por una escala fija de
6 pasos:

| Nivel | Tamaño | Uso |
|---|---|---|
| Display | 24px | Títulos de página (dashboard) |
| Heading | 18px | Títulos de sección/dialog |
| Subheading | 15px | Subtítulos, nombres de tabla en canvas |
| Body | 13px | Texto de UI general, campos de tabla |
| Caption | 12px | Metadatos secundarios, labels de sidebar |
| Metadata | 11px | Timestamps, contadores, badges |

## Spacing y Radius

**Spacing**: se adopta la escala default de Tailwind (4/8/12/16/20/24/32)
como única fuente permitida. No requiere tokens nuevos — el problema
detectado en la auditoría es de disciplina (valores arbitrarios dispersos),
no de falta de sistema.

**Radius**: se reemplazan los 3 pasos ambiguos derivados de una sola
variable (`sm/md/lg` desde `--radius: 0.5rem`) por valores explícitos en
píxeles:

| Token | Valor |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 12px |
| `--radius-xl` | 16px |

Prohibido `rounded-[Npx]` arbitrario en código nuevo salvo justificación
explícita en comentario. El código existente con radios arbitrarios se
normaliza al valor de la escala más cercano en las fases de implementación
por componente.

## Iconografía

Unificar en `lucide-react` como única librería. Los primitivos de
componentes base que quedaron con `@radix-ui/react-icons` (`toast.tsx`,
`menubar.tsx`, `select.tsx`, `sheet.tsx`, `sidebar.tsx`, `dialog.tsx`,
`button-with-alternatives.tsx`) migran sus íconos a los equivalentes de
`lucide-react` en la fase de implementación de componentes base (fase
posterior a esta).

## Motion

Se consolida en el paquete `motion` (eliminando la dependencia duplicada
`framer-motion` — mismo proyecto, nombre legado). Principios (framework de
decisión de Emil Kowalski, ver skill `emil-design-eng`), aplicados con
criterio moderado explícito del usuario:

- Nunca animar acciones iniciadas por teclado (atajos, toggles frecuentes).
- `ease-out` para entradas, `ease-in-out` para movimiento en pantalla, nunca
  `ease-in`.
- Duraciones UI por debajo de 300ms; feedback de botón 100–160ms.
- Nada de animación continua/permanente en el canvas o en la toolbar
  flotante — esta última debe atenuarse/aparecer de forma sutil cuando no se
  usa, sin loop de animación.
- El motion se usa para jerarquía, feedback de estado y continuidad
  espacial — nunca como decoración por sí misma.

## Notificaciones

Migrar de `src/components/toast/*` (Radix Toast con bug de
`TOAST_REMOVE_DELAY` en ~16 minutos) a **Sonner**. Uso actual es mínimo (3
sitios en toda la app, sin spam), por lo que la migración es de bajo riesgo.
Detalle de mapeo de los 3 call-sites existentes queda para el plan de
implementación de esta fase.

## Principio transversal de identidad

ChartDB es una herramienta profesional de diseño y administración de
esquemas de bases de datos, no un dashboard SaaS genérico. En todas las
fases posteriores: el canvas, las tablas, las relaciones, la navegación y la
productividad tienen prioridad sobre el efecto visual. Los principios de
Emil Kowalski se aplican para jerarquía, interacción, feedback y
accesibilidad — no como licencia para agregar animación o decoración donde
no aporta.

Consecuencias concretas ya fijadas para fases posteriores (documentadas acá
para que no se pierdan al planificar esas fases):
- Sidebar del editor: se mantiene compacto (icono + nombre + contador), sin
  agregar badges/subtítulos/información secundaria adicional — la densidad
  es un requisito, no un defecto a corregir.
- Toolbar flotante del canvas: mantiene el set de acciones actual (zoom,
  fit, zoom%, grid, undo/redo); se ajusta su presencia visual (atenuar/mostrar
  sutilmente) pero no su contenido ni con animación continua.

## Fuera de alcance de esta fase

- Traducción i18n del dashboard (decisión explícita del usuario: se deja en
  español, documentado como deuda conocida).
- Implementación componente por componente (Button, Empty/EmptyState,
  dialogs, TableNode, edges, sidebar, toolbar, dashboard cards) — cada uno es
  un sub-proyecto posterior que consume estos tokens.
- Cualquier cambio de arquitectura, lógica de negocio, API o SyncEngine.

## Próximos pasos

Este spec pasa a `writing-plans` para generar el plan de implementación de
esta Fase 1 (tokens en `globals.css`/`tailwind.config.js`, consolidación de
dependencias de motion, migración a Sonner). Las fases siguientes
(componentes base, dashboard, editor/canvas, sidebar/toolbar, dialogs,
microinteracciones, accesibilidad/responsive/performance) se brainstorman
por separado, cada una como su propio spec, consumiendo los tokens
definidos acá.
