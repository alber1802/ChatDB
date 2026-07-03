# 🚀 Guía de Despliegue Automatizada y Simplificada con Docker

## Versión 2.0 — Arquitectura Limpia (Sin entrypoint.sh)

Esta documentación detalla el flujo moderno y optimizado para compilar, empaquetar y desplegar la aplicación **ChatDB** tanto en entornos locales de Docker como en la infraestructura de producción de Heroku, integrando de forma segura las variables de entorno de Supabase sin recurrir a scripts intermediarios complejos.

### Resumen del Cambio de Arquitectura
Se eliminó por completo el archivo `entrypoint.sh` y la inyección por consola mediante `--build-arg`. Ahora, Nginx utiliza su motor nativo de plantillas para leer el puerto dinámico de Heroku, y Vite absorbe de forma segura todas las credenciales desde el archivo local estructurado `.env.docker` en tiempo de compilación.

---

## 1. Configuración de Archivos del Sistema

### 1.1 Archivo de Credenciales Seguras (`.env.docker`)
Este archivo se ubica en la raíz del proyecto. Debe contener todas las variables necesarias para el Frontend. Al compilarse dentro de la etapa intermedia de Docker, queda incrustado de manera estática en el bundle sin exponerse en los logs externos.

**Contenido de ejemplo para `.env.docker`:**
```env
VITE_SUPABASE_URL=https://yburqxpgzcymdyolbiqg.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_real_aqui
VITE_DISABLE_ANALYTICS=true
```

> 🔒 **Nota de Seguridad**: Este archivo está incluido en `.gitignore` para prevenir que credenciales reales sean expuestas en repositorios de control de versiones.

### 1.2 Plantilla de Servidor Nginx (`default.conf.template`)
Configuración limpia que permite a las rutas de React funcionar correctamente bajo el enrutador de Vite (SPA) y mapea dinámicamente el puerto asignado.

```nginx
server {
    listen       ${PORT};
    listen  [::]:${PORT};

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        # Esto es vital para que las rutas de React/Vite funcionen
        try_files  $uri $uri/ /index.html;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
}
```

### 1.3 Dockerfile de Producción Optimizado (`Dockerfile`)
Estructura multi-stage que utiliza Node 22 para compilar y Nginx Stable Alpine para servir los archivos estáticos.

```dockerfile
# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Inyectamos las credenciales de forma segura
COPY .env.docker .env

RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build

# ─── Stage 2: Production (nginx) ──────────────────────────────────────────────
FROM nginx:stable-alpine AS production

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# La imagen de Nginx procesará automáticamente los templates puestos en esta carpeta
COPY ./default.conf.template /etc/nginx/templates/default.conf.template

# Puerto por defecto para Docker local (Heroku lo sobrescribirá)
ENV PORT=80
EXPOSE 80

# Usamos el comando nativo de Nginx
CMD ["nginx", "-g", "daemon off;"]
```

---

## 2. Flujo de Automatización del IDE (Git + Despliegue)

Para simplificar las tareas repetitivas, puedes integrar una secuencia única en la terminal integrada de tu IDE (VS Code, Cursor, etc.) o configurar un script personalizado.

### Paso A: Corregir Estilo y Commitear en Git
Antes del commit, ejecuta el linter para corregir de forma automática los detalles de formato y evitar que fallen los hooks de Husky:
```bash
pnpm run lint:fix
git add .
git commit -m "chore: simplificacion de arquitectura docker y remocion de entrypoint"
git push origin main
```

### Paso B: Despliegue en Heroku Container Registry
Al haber unificado las variables dentro de `.env.docker`, ya no es necesario escapar cadenas largas de caracteres especiales de Supabase en la consola.

#### 1. Construir la imagen con compatibilidad para Heroku Registry:
```bash
docker buildx build --provenance=false --load --no-cache -t registry.heroku.com/chatdb-alber/web .
```

#### 2. Subir imagen al registro:
```bash
docker push registry.heroku.com/chatdb-alber/web
```

#### 3. Publicar la versión en Heroku:
```bash
heroku container:release web --app chatdb-alber
```

---

## 3. Comandos de Gestión Rápida

| Entorno Objetivo | Técnico / Acción | Comando Ejecutable |
| :--- | :--- | :--- |
| **Linter** | Corregir estilo automático | `pnpm run lint:fix` |
| **Docker Local** | Construcción limpia | `docker build --no-cache -t chatdb:latest .` |
| **Docker Local** | Levantar contenedor | `docker run -d --name chatdb -p 8080:80 chatdb:latest` |
| **Heroku** | Monitorear logs en vivo | `heroku logs --tail --app chatdb-alber` |
