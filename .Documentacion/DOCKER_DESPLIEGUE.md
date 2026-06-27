# 🐳 Guía de Despliegue con Docker — ChatDB + Supabase

Esta guía documenta los pasos exactos que se siguieron para construir y levantar
la imagen Docker del proyecto **ChatDB** con la integración de Supabase funcionando
correctamente en modo producción.

---

## 📋 Requisitos Previos

Antes de comenzar asegúrate de tener instalado en tu máquina:

- **Docker Desktop** (Windows) o Docker Engine (Linux/Mac)
- **Git** (para clonar el repositorio)
- Credenciales activas de tu proyecto **Supabase** (URL y Anon Key)

---

## ⚠️ Punto Clave: Variables de Entorno en Vite/Docker

> **¿Por qué hay que pasar las credenciales en tiempo de BUILD y no solo en RUN?**

El cliente de Supabase en el código (`src/lib/supabase.ts`) usa:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

Las variables `import.meta.env.VITE_*` son **estáticas**: Vite las lee del archivo
`.env` y las **incrusta directamente en el bundle JS** durante la compilación.
Si no se pasan en el `docker build`, el bundle queda con los valores vacíos y
Supabase no puede conectarse, aunque el contenedor corra con las variables de entorno.

**Por eso:**
- Las credenciales se pasan como `--build-arg` al construir la imagen.
- El `Dockerfile` las inyecta en un `.env` antes de ejecutar `vite build`.

---

## 📁 Archivos Involucrados en el Despliegue

| Archivo | Rol |
|---|---|
| `Dockerfile` | Define el build en 2 etapas: Node (compilación) + Nginx (servicio) |
| `entrypoint.sh` | Script de inicio del contenedor: configura Nginx con `envsubst` |
| `default.conf.template` | Plantilla de configuración de Nginx con variables de entorno |
| `.env.local` | Variables locales para desarrollo (`pnpm dev`), **NO se usa en Docker** |

---

## 🛠️ Paso 1 — Verificar el Dockerfile

El `Dockerfile` usa una arquitectura **multi-stage**:

- **Stage 1 (`builder`)**: Imagen Node 24 Alpine. Instala dependencias con `pnpm`,
  inyecta las variables en `.env` y ejecuta `vite build`. El resultado es la
  carpeta `dist/`.
- **Stage 2 (`production`)**: Imagen Nginx Alpine liviana. Solo copia el `dist/`
  del stage anterior y configura el servidor web.

Asegúrate de que el `Dockerfile` declare los `ARG` de Supabase (ya están añadidos):

```dockerfile
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
```

Y que los inyecte en el `.env` antes del build:

```dockerfile
RUN echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env
```

---

## 🔨 Paso 2 — Construir la Imagen Docker

Ejecuta el siguiente comando desde la **raíz del proyecto**, sustituyendo los
valores con los de tu proyecto Supabase:

```bash
docker build `
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" `
  --build-arg VITE_SUPABASE_ANON_KEY="tu-anon-key-aqui" `
  -t chatdb:latest .
```

> **En Linux/Mac** usa `\` en vez de `` ` `` para continuar la línea:
> ```bash
> docker build \
>   --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" \
>   --build-arg VITE_SUPABASE_ANON_KEY="tu-anon-key-aqui" \
>   -t chatdb:latest .
> ```

### ¿Qué sucede durante el build?

1. Docker descarga las imágenes base `node:24-alpine` y `nginx:stable-alpine`.
2. Instala todas las dependencias con `pnpm install --frozen-lockfile`.
3. Crea el archivo `.env` con las credenciales inyectadas.
4. Ejecuta `vite build` (puede tardar ~1-2 minutos — el bundle es grande).
5. Copia el `dist/` a la imagen final de Nginx.
6. Aplica permisos al script `entrypoint.sh`.

### Valores usados en este proyecto

```
VITE_SUPABASE_URL   = https://yburqxpgzcymdyolbiqg.supabase.co
VITE_SUPABASE_ANON_KEY = (ver archivo .env.local en la raíz del proyecto)
```

---

## 🚀 Paso 3 — Levantar el Contenedor

Una vez construida la imagen, ejecuta el contenedor con:

```bash
docker run -d `
  --name chatdb `
  -p 8080:80 `
  chatdb:latest
```

> **En Linux/Mac:**
> ```bash
> docker run -d \
>   --name chatdb \
>   -p 8080:80 \
>   chatdb:latest
> ```

La aplicación estará disponible en: **http://localhost:8080**

---

## ✅ Paso 4 — Verificar que Funciona

```bash
# Ver el estado del contenedor (debe decir "Up")
docker ps --filter "name=chatdb"

# Ver los logs de Nginx en tiempo real
docker logs -f chatdb
```

Luego abre el navegador en `http://localhost:8080`. Deberías ver la pantalla de
login de **ChatDB Cloud** y poder iniciar sesión con tu cuenta de Supabase.

---

## 🔄 Comandos de Gestión del Contenedor

```bash
# Detener el contenedor
docker stop chatdb

# Iniciar el contenedor detenido (sin rebuild)
docker start chatdb

# Eliminar el contenedor (la imagen permanece)
docker rm chatdb

# Eliminar también la imagen
docker rmi chatdb:latest

# Ver todos los contenedores (incluyendo detenidos)
docker ps -a

# Reiniciar el contenedor
docker restart chatdb
```

---

## 🔁 Flujo de Actualización de Código

Cuando hagas cambios en el código fuente y quieras actualizarlos en Docker:

```bash
# 1. Eliminar el contenedor actual
docker stop chatdb
docker rm chatdb

# 2. Reconstruir la imagen con los cambios
docker build `
  --build-arg VITE_SUPABASE_URL="https://tu-proyecto.supabase.co" `
  --build-arg VITE_SUPABASE_ANON_KEY="tu-anon-key-aqui" `
  -t chatdb:latest .

# 3. Levantar el nuevo contenedor
docker run -d --name chatdb -p 8080:80 chatdb:latest
```

> **Optimización**: Docker cachea las capas. Si solo cambiaste código fuente
> (no `package.json` o `pnpm-lock.yaml`), el paso de `pnpm install` se reutiliza
> de la caché y el rebuild es más rápido.

---

## 🐛 Solución de Problemas Comunes

### La app carga pero no puede conectarse a Supabase

**Causa**: Las variables `VITE_SUPABASE_*` no se pasaron durante el `docker build`.

**Solución**: Reconstruir la imagen pasando correctamente los `--build-arg`.

---

### Error 409 al crear tablas o relaciones

**Causa**: El código intentaba hacer `.insert()` en Supabase cuando el registro
ya existía (ID duplicado).

**Solución ya aplicada**: Se cambiaron todas las operaciones `addTable`,
`addRelationship`, `addDiagram`, etc. a usar `.upsert()` con `onConflict: 'id'`
en `supabase-storage-provider.tsx`.

---

### Puerto 8080 ya en uso

```bash
# Ver qué proceso usa el puerto 8080
netstat -ano | findstr :8080

# Usar un puerto diferente (ej: 3000)
docker run -d --name chatdb -p 3000:80 chatdb:latest
```

---

### Error al construir: `--frozen-lockfile` falla

**Causa**: El `pnpm-lock.yaml` está desactualizado respecto al `package.json`.

**Solución**: Ejecutar `pnpm install` localmente para actualizar el lockfile,
luego hacer commit y reconstruir la imagen.

---

## 📌 Referencia Rápida

```bash
# === CONSTRUCCIÓN ===
docker build --build-arg VITE_SUPABASE_URL="URL" --build-arg VITE_SUPABASE_ANON_KEY="KEY" -t chatdb:latest .

# === LEVANTAR ===
docker run -d --name chatdb -p 8080:80 chatdb:latest

# === VERIFICAR ===
docker ps --filter "name=chatdb"

# === ACCEDER ===
# http://localhost:8080

# === LIMPIAR ===
docker stop chatdb && docker rm chatdb
```
