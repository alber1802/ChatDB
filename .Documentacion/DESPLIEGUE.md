# 🚀 Guía de Despliegue y Configuración de ChatDB

Esta guía detalla los pasos para configurar, ejecutar y desplegar la aplicación
**ChatDB** (con autenticación y almacenamiento cloud via Supabase) en entorno local
de desarrollo, Docker local y Heroku en producción.

> **App en producción**: https://chatdb-alber-060263da84d8.herokuapp.com/  
> **Repositorio**: https://github.com/alber1802/ChatDB

---

## 🛠️ Requisitos Previos

- **Node.js** v20+
- **pnpm** v9+ (`corepack enable && corepack prepare pnpm@9 --activate`)
- **Docker Desktop**
- **Heroku CLI** v11+
- **Cuenta de Supabase** con proyecto activo

---

## 💻 1. Ejecución en Local (Desarrollo)

### Paso 1.1 — Instalar dependencias
```bash
pnpm install
```

### Paso 1.2 — Configurar Variables de Entorno
Crea `.env.local` en la raíz del proyecto:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

> Para este proyecto los valores reales están en `.env.local` (no commiteado por seguridad).

### Paso 1.3 — Iniciar servidor de desarrollo
```bash
pnpm dev
# → http://localhost:5173
```

---

## 🐳 2. Despliegue con Docker (Producción local)

> ⚠️ **Importante**: Las credenciales de Supabase (`VITE_SUPABASE_*`) son
> variables de Vite que se **incrustan en el bundle en tiempo de compilación**.
> Por eso DEBEN pasarse como `--build-arg` al construir la imagen, no como `-e`
> al ejecutar el contenedor.

### Paso 2.1 — Construir la imagen

```bash
# Windows (PowerShell)
docker build `
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" `
  --build-arg VITE_SUPABASE_ANON_KEY="tu-anon-key" `
  --build-arg VITE_DISABLE_ANALYTICS=true `
  -t chatdb:latest .

# Linux / Mac
docker build \
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" \
  --build-arg VITE_SUPABASE_ANON_KEY="tu-anon-key" \
  --build-arg VITE_DISABLE_ANALYTICS=true \
  -t chatdb:latest .
```

### Paso 2.2 — Ejecutar el contenedor
```bash
docker run -d --name chatdb -p 8080:80 chatdb:latest
```
Accede en: **http://localhost:8080**

### Gestión del contenedor
```bash
docker stop chatdb       # Detener
docker start chatdb      # Reanudar
docker rm chatdb         # Eliminar contenedor
docker rmi chatdb:latest # Eliminar imagen
docker logs -f chatdb    # Ver logs
```

---

## ☁️ 3. Despliegue en Heroku

### App activa
- **URL**: https://chatdb-alber-060263da84d8.herokuapp.com/
- **Nombre app**: `chatdb-alber`
- **Stack**: `container` (Docker)
- **Dyno**: `Basic` (web.1)

### Paso 3.1 — Login en Heroku y Container Registry
```bash
heroku login
heroku container:login
```

### Paso 3.2 — Build y Push de la imagen a Heroku
Heroku construye la imagen localmente y la sube a su registry.
Las credenciales de Supabase se pasan como `--arg`:

```bash
# Windows (PowerShell — una sola línea)
heroku container:push web --app chatdb-alber --arg VITE_SUPABASE_URL=https://tu-proyecto.supabase.co,VITE_SUPABASE_ANON_KEY=tu-anon-key,VITE_DISABLE_ANALYTICS=true

# Linux / Mac
heroku container:push web \
  --app chatdb-alber \
  --arg VITE_SUPABASE_URL=https://tu-proyecto.supabase.co \
  --arg VITE_SUPABASE_ANON_KEY=tu-anon-key \
  --arg VITE_DISABLE_ANALYTICS=true
```

> ⏱️ Este proceso tarda ~3-5 minutos (build local + upload de layers al registry).

### Paso 3.3 — Release (activar la imagen en producción)
```bash
heroku container:release web --app chatdb-alber
```

### Paso 3.4 — Verificar estado del dyno
```bash
heroku ps --app chatdb-alber
# web.1: up (dyno activo)

heroku logs --tail --app chatdb-alber
```

### Paso 3.5 — Abrir la app
```bash
heroku open --app chatdb-alber
```

---

## 🔄 Redeploy tras Cambios en el Código

```bash
# 1. Rebuild y push
heroku container:push web --app chatdb-alber --arg VITE_SUPABASE_URL=https://yburqxpgzcymdyolbiqg.supabase.co,VITE_SUPABASE_ANON_KEY=TU_ANON_KEY,VITE_DISABLE_ANALYTICS=true

# 2. Release
heroku container:release web --app chatdb-alber
```

---

## 💰 Costos Heroku

| Dyno   | Precio/mes | RAM    |
|--------|-----------|--------|
| Basic  | $7        | 512 MB |

El plan Basic es suficiente ya que toda la lógica corre en el navegador del usuario.

---

## 🔒 Notas de Seguridad

- Las variables `VITE_*` son **públicas** una vez compiladas. La `anon key` de Supabase
  es segura por diseño — es una clave pública con permisos limitados por Row Level Security (RLS).
- Nunca subas `.env.local` al repositorio (ya está en `.gitignore`).
