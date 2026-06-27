# 🚀 Guía de Despliegue y Configuración de ChartDB

Esta guía detalla los pasos para configurar, ejecutar y desplegar la aplicación **ChartDB** (con soporte dual-storage Supabase/IndexedDB) tanto en un entorno local de desarrollo como en producción en Heroku usando contenedores Docker.

---

## 🛠️ Requisitos Previos

Asegúrate de tener instalados los siguientes componentes antes de comenzar:

- **Node.js** (v18 o superior)
- **pnpm** (gestor de paquetes recomendado)
- **Heroku CLI** (para el despliegue en la nube)
- **Docker** (para empaquetado de producción)
- **Cuenta de Supabase** con un proyecto activo

---

## 💻 1. Ejecución en Entorno Local (Desarrollo)

### Paso 1.1: Clonar e instalar dependencias
Clona el repositorio e instala los paquetes necesarios usando `pnpm`:
```bash
pnpm install
```

### Paso 1.2: Configurar las Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto y agrega tus claves del proyecto Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-de-supabase
```

### Paso 1.3: Iniciar el Servidor de Desarrollo
Para arrancar el entorno interactivo de desarrollo local con recarga rápida (HMR):
```bash
pnpm dev
```
La aplicación estará disponible en `http://localhost:5173`.

---

## 🐳 2. Despliegue en Producción (Docker Local)

El proyecto utiliza un contenedor Docker basado en Nginx que sirve los archivos estáticos compilados e inyecta dinámicamente las variables de entorno en tiempo de ejecución.

### Paso 2.1: Construir la Imagen Docker
Ejecuta el siguiente comando para compilar la aplicación y construir la imagen:
```bash
docker build -t chartdb-prod .
```

### Paso 2.2: Ejecutar el Contenedor
Arranca el contenedor pasando las variables de Supabase como variables de entorno de Docker:
```bash
docker run -d -p 8080:80 \
  -e VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" \
  -e VITE_SUPABASE_ANON_KEY="tu-clave-anonima-de-supabase" \
  chartdb-prod
```
La aplicación de producción estará accesible en `http://localhost:8080`.

---

## ☁️ 3. Despliegue en Heroku (Producción)

Dado que este proyecto está empaquetado con Docker mediante un archivo `Dockerfile`, utilizaremos el stack **Heroku Container Registry** para desplegarlo.

### Paso 3.1: Iniciar Sesión en Heroku y en el Container Registry
Abre tu terminal y autentícate en Heroku y su registro de contenedores Docker:
```bash
heroku login
heroku container:login
```

### Paso 3.2: Configurar la Aplicación en Heroku
Si aún no has creado la aplicación en Heroku, créala con el siguiente comando (sustituye `nombre-de-tu-app` por el nombre de tu aplicación):
```bash
heroku create nombre-de-tu-app
```

### Paso 3.3: Configurar las Variables de Entorno en Heroku
Es crucial definir las variables de configuración en Heroku para que Nginx pueda inyectarlas dinámicamente en el frontend en ejecución:
```bash
heroku config:set VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" -a nombre-de-tu-app
heroku config:set VITE_SUPABASE_ANON_KEY="tu-clave-anonima-de-supabase" -a nombre-de-tu-app
```

### Paso 3.4: Construir y Subir el Contenedor a Heroku
Compila la imagen de Docker localmente y súbela directamente a los servidores de Heroku:
```bash
heroku container:push web -a nombre-de-tu-app
```

### Paso 3.5: Publicar la Aplicación (Liberar el contenedor)
Una vez subida la imagen, activa el contenedor para poner la aplicación en línea:
```bash
heroku container:release web -a nombre-de-tu-app
```

### Paso 3.6: Abrir la Aplicación
Para acceder a tu sitio web recién desplegado:
```bash
heroku open -a nombre-de-tu-app
```

---

## 🔄 Flujo de Trabajo Posterior
Cada vez que realices cambios en el código y quieras subirlos a Heroku:
1. Realiza el push a GitHub para mantener tu repositorio de control de versiones sincronizado.
2. Ejecuta `heroku container:push web -a nombre-de-tu-app` y `heroku container:release web -a nombre-de-tu-app` para actualizar la versión en producción.
