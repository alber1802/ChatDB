Estilismo
Sileo está diseñado para lucir genial desde el primer momento. Cuando necesitas personalizarlo, hay algunas trampillas de escape.

Relleno de color
Elfill accesorio establece el color de fondo SVG de la tostada. El valor predeterminado es"#FFFFFF" . Configúrelo en un color oscuro como o para crear un brindis oscuro — solo asegúrese de emparejarlo con texto claro a través de ."#171717""black"styles

Vista previa
Código
sileo.success({
  title: "Saved",
  fill: "#171717",
});

sileo.success({
  title: "Booking confirmed",
  fill: "black",
  styles: {
    title: "text-white!",
    description: "text-white/75!",
  },
});
Anulaciones de estilo
stylesEl accesorio le permite anular clases en subelementos individuales. Utilice el modificador de Tailwind! para garantizar la especificidad.

Vista previa
Código
sileo.action({
  title: "New Sale",
  fill: "black",
  styles: {
    title: "text-white!",
    description: "text-white/75!",
    badge: "bg-white/20!",
    button: "bg-white/10! hover:bg-white/15!",
  },
});
Llaves disponibles
Clave	Elemento	Selector
título	El texto del título	[data-sileo-title]
descripción	El cuerpo/área de descripción	[data-sileo-description]
badge	El círculo de insignias de iconos	[data-sileo-badge]
botón	El botón de acción	[botón de sileo de datos]
Iconos personalizados
Pase cualquier nodo React comoicon accesorio para reemplazar el ícono de estado predeterminado.

Vista previa
Código
import { Rocket } from "lucide-react";

sileo.success({
  title: "Deployed",
  icon: <Rocket className="size-3.5" />,
});
Descripción personalizada
descriptionEl accesorio acepta JSX, por lo que puedes crear contenido tostado enriquecido.

Vista previa
Código
sileo.success({
  title: "Payment received",
  description: (
    <span className="text-green-500/50! font-medium!">
      We received your payment of $49.00.
    </span>
  ),
});
Puede utilizar cualquier diseño — apilar varios elementos, agregar íconos o usar sus propios componentes.

Vista previa
Código
sileo.info({
  title: "Team update",
  description: (
    <div className="flex flex-col gap-2">
      <div className="flex -space-x-2">
        <img src="/memojis/Rectangle.png" className="size-7 rounded-full ring-2 ring-white" />
        <img src="/memojis/Rectangle-1.png" className="size-7 rounded-full ring-2 ring-white" />
        <img src="/memojis/Rectangle-2.png" className="size-7 rounded-full ring-2 ring-white" />
      </div>
      <span className="text-xs! text-muted-foreground!">
        3 new members joined the project.
      </span>
    </div>
  ),
});
Redondez
Controle el radio del borde con elroundness accesorio (predeterminado16). Colóquelo más abajo para obtener esquinas más afiladas o más arriba para obtener una forma de pastilla más redonda.

Vista previa
Código
sileo.success({
  title: "Sharp corners",
  roundness: 12,
});

sileo.success({
  title: "Fully round",
  roundness: 16,
});
Nota de rendimiento:roundness Los valores más altos aumentan el radio de desenfoque SVG utilizado para el efecto de transformación pegajoso, que es más costoso de renderizar. El valor recomendado es16 para un buen equilibrio entre estética y rendimiento.

Piloto automático
De forma predeterminada, los brindis se expanden automáticamente después de un breve retraso y colapsan antes de descartarse. Controla esto con elautopilot accesorio.

autopilot: false— deshabilita la expansión/colapso automático por completo (coloque el cursor para expandir)
autopilot: { expand: ms, collapse: ms }— sincronización personalizada para cada fase
Vista previa
Código
sileo.success({
  title: "Manual only",
  description: "Expand and collapse are disabled.",
  autopilot: false,
});

sileo.success({
  title: "Custom timing",
  description: "Expand after 500ms, collapse after 3s.",
  autopilot: {
    expand: 500,
    collapse: 3000,
  },
});
Descartando tostadas
Úselosileo.dismiss(id) para eliminar una tostada específica osileo.clear() para eliminarlas todas. También puedes realizar únicamente brindis en una posición específica.

Vista previa
Código
const id = sileo.success({ title: "Dismissable" });

// Dismiss a single toast
sileo.dismiss(id);

// Clear all toasts
sileo.clear();

// Clear toasts at a specific position
sileo.clear("top-right");
Valores predeterminados globales
Utilice la propiedad 's para establecer valores predeterminados para cada brindis. Esto es útil para aplicar un tema oscuro consistente en toda su aplicación.Toasteroptions

<Toaster
  position="top-right"
  options={{
    fill: "#171717",
    roundness: 16,
    styles: {
      title: "text-white!",
      description: "text-white/75!",
      badge: "bg-white/10!",
      button: "bg-white/10! hover:bg-white/15!",
    },
  }}
/>
Variables CSS
Sileo expone propiedades personalizadas de CSS que puedes anular globalmente para cambiar los colores de estado, las dimensiones o el tiempo de animación.

:root {
  /* State colors (oklch) */
  --sileo-state-success: oklch(0.723 0.219 142.136);
  --sileo-state-loading: oklch(0.556 0 0);
  --sileo-state-error: oklch(0.637 0.237 25.331);
  --sileo-state-warning: oklch(0.795 0.184 86.047);
  --sileo-state-info: oklch(0.685 0.169 237.323);
  --sileo-state-action: oklch(0.623 0.214 259.815);

  /* Dimensions */
  --sileo-width: 350px;
  --sileo-height: 40px;

  /* Animation */
  --sileo-duration: 600ms;
}
Por ejemplo, para que todos los brindis tengan éxito, utilice un color de marca personalizado:

:root {
  --sileo-state-success: oklch(0.7 0.2 200);