# 🚀 Guía de Despliegue — ChatDB

> Editor visual de diagramas de bases de datos, basado en [ChartDB](https://github.com/chartdb/chartdb).  
> Migrado a **pnpm** para mayor seguridad y eficiencia en la gestión de dependencias.

---

## 📋 Requisitos Previos

| Herramienta | Versión mínima | Verificar con |
|---|---|---|
| Node.js | 22+ | `node --version` |
| pnpm | 10+ | `pnpm --version` |
| Docker Desktop | 24+ | `docker --version` |
| Heroku CLI | 11+ | `heroku --version` |
| Git | cualquiera | `git --version` |

### Instalar pnpm (si no lo tienes)
```bash
# Via corepack (recomendado, viene con Node 16+)
corepack enable
corepack prepare pnpm@10 --activate

# O via npm
npm install -g pnpm
```

---

## 1️⃣ Entorno Local (Desarrollo)

### Clonar e instalar dependencias

```bash
git clone https://github.com/alber1802/ChatDB.git
cd ChatDB

# Instalar dependencias con pnpm (usa pnpm-lock.yaml para reproducibilidad)
pnpm install --frozen-lockfile
```

### Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Supabase (requerido para autenticación y cloud sync)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase

# API de OpenAI (opcional — para traducción de SQL entre dialectos)
VITE_OPENAI_API_KEY=sk-...

# O usar un servidor LLM local (Ollama, vLLM, etc.)
VITE_OPENAI_API_ENDPOINT=http://localhost:11434/v1
VITE_LLM_MODEL_NAME=qwen2.5:32b

# Desactivar analytics de Fathom
VITE_DISABLE_ANALYTICS=true
```

> ⚠️ Sin las variables de Supabase la app cae al modo IndexedDB local (sin autenticación ni cloud sync).

### Iniciar el servidor de desarrollo

```bash
pnpm dev
```

La app estará disponible en: **http://localhost:5173**

### Otros comandos útiles

```bash
pnpm lint          # Verificar errores de estilo
pnpm test          # Ejecutar tests unitarios
pnpm build         # Compilar para producción (genera /dist)
pnpm preview       # Previsualizar el build de producción
```

---

## 2️⃣ Despliegue Local con Docker (Producción)

Esta opción ejecuta el app como lo haría en producción real: build optimizado servido por **nginx**.

> ⚠️ **Punto clave**: Las variables `VITE_SUPABASE_*` son **estáticas** — Vite las incrusta
> en el bundle durante la compilación. **Deben pasarse como `--build-arg`**, no como
> variables de entorno en `docker run`.

### Construir la imagen

```bash
# Windows (PowerShell)
docker build `
  --build-arg VITE_SUPABASE_URL=https://tu-proyecto.supabase.co `
  --build-arg VITE_SUPABASE_ANON_KEY=tu-anon-key `
  --build-arg VITE_DISABLE_ANALYTICS=true `
  -t chatdb:latest .

# Linux / Mac
docker build \
  --build-arg VITE_SUPABASE_URL=https://tu-proyecto.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=tu-anon-key \
  --build-arg VITE_DISABLE_ANALYTICS=true \
  -t chatdb:latest .
```

> ⏱️ El primer build tarda ~3-5 minutos. Los siguientes son rápidos por el cache de layers.

### Ejecutar el contenedor

```bash
docker run -d \
  -p 8080:80 \
  --name chatdb \
  chatdb:latest
```

La app estará en: **http://localhost:8080**

### Gestión del contenedor

```bash
docker stop chatdb       # Pausar
docker start chatdb      # Reanudar
docker rm chatdb         # Eliminar contenedor
docker rmi chatdb:latest # Eliminar imagen
docker logs chatdb       # Ver logs de nginx
```

### Limpieza completa

```bash
# Eliminar todo (contenedores + imágenes + volúmenes + cache de build)
docker stop $(docker ps -q)
docker rm $(docker ps -aq)
docker rmi $(docker images -q) --force
docker volume prune -f
docker builder prune -af
```

---

## 3️⃣ Despliegue en Heroku

### Requisitos previos de Heroku

```bash
# Instalar Heroku CLI (si no lo tienes)
# https://devcenter.heroku.com/articles/heroku-cli

# Verificar sesión activa
heroku auth:whoami

# Si no estás logueado
heroku login
```

### Paso 1 — Crear la app en Heroku

```bash
heroku create nombre-de-tu-app --region us
```

> 💡 Elige un nombre único. Heroku lo usa como subdominio: `https://nombre-de-tu-app.herokuapp.com`

### Paso 2 — Configurar el stack como Container

```bash
heroku stack:set container --app nombre-de-tu-app
```

> Esto le indica a Heroku que usaremos Docker en vez del buildpack estándar de Node.js.

### Paso 3 — Login en el Container Registry de Heroku

```bash
heroku container:login
```

### Paso 4 — Build y push de la imagen (Metodología Recomendada)

> ⚠️ **Error de API Key / Heroku Registry**: 
> 1. Puesto que la clave de Supabase (`anon_key`) es un JWT largo con caracteres especiales, el comando `heroku container:push --arg` puede truncar o fallar al parsear la cadena completa en la CLI de Heroku.
> 2. Las versiones modernas de Docker Desktop generan por defecto manifiestos en formato OCI (con procedencia/atestación) que Heroku Registry rechaza con un error `error from registry: unsupported`.
>
> Para solucionar ambos problemas, se debe construir la imagen usando `docker buildx` con el flag `--provenance=false` para la compatibilidad del registro y taggear la imagen para el registro de Heroku directamente.

#### 1. Construir la imagen con compatibilidad para Heroku Registry:
```bash
# Windows (PowerShell)
docker buildx build --provenance=false --load --no-cache `
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" `
  --build-arg "VITE_SUPABASE_ANON_KEY=tu-anon-key" `
  --build-arg VITE_DISABLE_ANALYTICS=true `
  -t registry.heroku.com/nombre-de-tu-app/web .

# Linux / Mac
docker buildx build --provenance=false --load --no-cache \
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" \
  --build-arg "VITE_SUPABASE_ANON_KEY=tu-anon-key" \
  --build-arg VITE_DISABLE_ANALYTICS=true \
  -t registry.heroku.com/nombre-de-tu-app/web .
```

#### 2. Push directo al Container Registry de Heroku:
```bash
docker push registry.heroku.com/nombre-de-tu-app/web
```

### Paso 5 — Release (activar la imagen)

```bash
heroku container:release web --app chatdb-alber
```

### Paso 6 — Verificar que está corriendo

```bash
# Ver estado del dyno
heroku ps --app chatdb-alber
# web.1: up

# Ver logs en tiempo real
heroku logs --tail --app chatdb-alber

# Abrir en el navegador
heroku open --app chatdb-alber
```

### Configurar variables de entorno en runtime (Heroku)

Las variables de runtime (disponibles en `window.env` via `/config.js` de Nginx)
se configuran así — NO afectan las credenciales de Supabase que ya están en el bundle:

```bash
# Desactivar analytics
heroku config:set DISABLE_ANALYTICS=true --app chatdb-alber

# Con servidor LLM externo
heroku config:set OPENAI_API_ENDPOINT=https://tu-servidor/v1 --app chatdb-alber
heroku config:set LLM_MODEL_NAME=tu-modelo --app chatdb-alber

# Ver todas las variables configuradas
heroku config --app chatdb-alber
```

### Redeploy tras cambios en el código

```bash
# 1. Build y push de la nueva imagen
heroku container:push web --app chatdb-alber --arg VITE_SUPABASE_URL=https://tu-proyecto.supabase.co,VITE_SUPABASE_ANON_KEY=tu-anon-key,VITE_DISABLE_ANALYTICS=true

# 2. Activar la nueva versión
heroku container:release web --app chatdb-alber
```

### Gestión del dyno

```bash
# Ver estado del dyno
heroku ps --app nombre-de-tu-app

# Escalar (0 = apagar, 1 = encender)
heroku ps:scale web=0 --app nombre-de-tu-app   # Apagar (evita cobros)
heroku ps:scale web=1 --app nombre-de-tu-app   # Encender

# Ver tipo de dyno y costo
heroku ps:type --app nombre-de-tu-app
```

---

## 💰 Costos en Heroku

| Tipo de Dyno | Precio/mes | RAM | Descripción |
|---|---|---|---|
| Basic | $7 | 512 MB | ✅ Suficiente para ChatDB |
| Standard-1X | $25 | 512 MB | Para tráfico moderado |
| Standard-2X | $50 | 1 GB | Para tráfico alto |

> Para esta app, el **Basic ($7/mes)** es más que suficiente ya que toda la lógica corre en el navegador del usuario.

---

## 🔒 Consideraciones de Seguridad

1. **No subas `.env.local` al repositorio** — está en `.gitignore`
2. **Credenciales Supabase**: son variables `VITE_*` que Vite incrusta en el bundle. La `anon key`
   es segura por diseño — Supabase la trata como clave pública controlada por RLS.
3. **Credenciales de IA**: usa variables de entorno de Heroku (`heroku config:set`)
4. **Analytics**: está desactivado por defecto en los builds de Docker (`VITE_DISABLE_ANALYTICS=true`)
5. **Datos de usuario**: aislados por `user_id` en Supabase mediante Row Level Security (RLS)

---

## 🏗️ Arquitectura del Dockerfile

```
Stage 1: builder (node:24-alpine)
  ├── Habilita pnpm v9 via corepack
  ├── Copia package.json + pnpm-lock.yaml
  ├── pnpm install --frozen-lockfile  ← instalación determinista
  ├── Copia código fuente
  └── pnpm exec vite build            ← bundle de producción

Stage 2: production (nginx:stable-alpine)
  ├── Copia /dist desde builder
  ├── Configura nginx con soporte $PORT (Heroku)
  └── entrypoint.sh → envsubst + nginx
```

> **¿Por qué pnpm en vez de npm?**
> - Instalaciones más rápidas y eficientes (hardlinks en vez de copias)
> - `--frozen-lockfile` garantiza reproducibilidad exacta del build
> - Verificación de integridad de paquetes via `pnpm-lock.yaml`
> - Menor superficie de ataque (store centralizado, sin duplicados)

---

## 🔗 Links Útiles

- **App en Heroku (PRODUCCIÓN)**: https://chatdb-alber-060263da84d8.herokuapp.com/
- **Repositorio GitHub**: https://github.com/alber1802/ChatDB
- **Heroku Dashboard**: https://dashboard.heroku.com/apps/chatdb-alber
- **Supabase Dashboard**: https://supabase.com/dashboard/project/yburqxpgzcymdyolbiqg
- **Documentación pnpm**: https://pnpm.io/
- **Heroku Container Registry docs**: https://devcenter.heroku.com/articles/container-registry-and-runtime
