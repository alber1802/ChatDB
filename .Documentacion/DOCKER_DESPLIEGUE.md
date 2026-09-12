# 🚀 Guía de Despliegue con Docker — Frontend + Backend en Heroku

## Versión 3.0 — Dos apps separadas (frontend + backend)

Desde que se agregó el backend propio (`server/`), **esto ya no es una sola
app**. Son dos servicios independientes, cada uno con su propio Dockerfile,
su propia app de Heroku, y sus propias variables de entorno:

| App | Qué es | Heroku app | Dockerfile |
| :--- | :--- | :--- | :--- |
| **Frontend** | React/Vite compilado, servido por Nginx | `chatdb-alber` | `Dockerfile` (raíz) |
| **Backend** | API Express + Postgres | `chatdb-alber-api` | `server/Dockerfile` |

El frontend le habla al backend **directo, cross-origin**, vía
`VITE_API_URL` (horneado en el bundle en build-time). El backend acepta ese
origen vía `CORS_ORIGIN`. No hay proxy de por medio.

> Existe también un mecanismo de proxy nginx `/api/` → `API_UPSTREAM` en
> `default.conf.template`, pensado originalmente para correr todo en un
> solo dyno (same-origin). **No es el camino usado actualmente** — con
> `VITE_API_URL` seteado, el frontend llama directo al backend y ese proxy
> queda sin uso. Se documenta acá por si en el futuro se decide consolidar
> a un solo dyno.

---

## ⚠️ Gotcha #1: la conexión a Postgres DEBE ser vía el Transaction Pooler

Supabase ofrece dos formas de conectarse a Postgres:

- **Directa** (`db.<ref>.supabase.co:5432`) — **resuelve solo a IPv6**.
  Heroku (y la mayoría de redes Docker) no tiene salida IPv6, así que toda
  query falla con `Network unreachable`. El health check del backend
  (`/health`) devuelve `{"status":"degraded","db":"down"}` sin loggear el
  motivo real (el error se traga a propósito para no filtrar detalles de
  conexión).
- **Transaction pooler** (`aws-<N>-<region>.pooler.supabase.com:6543`) — sí
  tiene IPv4. **Esta es la que hay que usar.**

El número de nodo (`aws-0-`, `aws-1-`, `aws-2-`...) y la región son
**específicos de cada proyecto de Supabase** — no son un valor fijo, y
adivinarlos falla con `FATAL: tenant/user ... not found` aunque el host
resuelva y el puerto esté abierto. Sacá la cadena exacta de:

**Supabase Dashboard → tu proyecto → Project Settings → Database → Connect
→ pestaña "Transaction pooler"**

Esa pantalla te da el usuario `postgres.<ref>` — **cambialo por
`app_backend.<ref>`** (mismo sufijo, mismo password que ya tenías) para
seguir usando el rol de bajo privilegio y no romper la impersonación RLS:

```
postgresql://app_backend.<PROJECT_REF>:<PASSWORD>@aws-<N>-<region>.pooler.supabase.com:6543/postgres
```

## ⚠️ Gotcha #2: `server/.dockerignore` es obligatorio

Sin él, `COPY . .` en `server/Dockerfile` sobreescribe el `node_modules`
recién instalado (Linux, dentro del contenedor) con el `node_modules` local
de tu máquina (Windows) si existe — y los symlinks/junctions de pnpm en
Windows no son válidos en Linux. Resultado: `tsc` falla con decenas de
`Cannot find module 'express'` / `Cannot find name 'process'` aunque los
paquetes estén perfectamente instalados. Ya existe `server/.dockerignore`
en el repo excluyendo `node_modules`, `dist`, `.env*` — si lo borrás sin
querer, el build del backend se rompe así.

---

## 1. Configuración de archivos

### 1.1 Frontend — `.env.docker` (raíz del proyecto, gitignored)

```env
VITE_SUPABASE_URL=https://yburqxpgzcymdyolbiqg.supabase.co
VITE_SUPABASE_ANON_KEY=<tu anon key>
VITE_DISABLE_ANALYTICS=true
VITE_API_URL=https://chatdb-alber-api-XXXXXXXXXXXX.herokuapp.com
```

`VITE_API_URL` debe apuntar a la URL pública de la app de Heroku del
backend (`heroku apps:info --app chatdb-alber-api` la muestra). Se
compila dentro del bundle — cambiarla requiere reconstruir la imagen.

### 1.2 Backend — variables de entorno (Heroku config vars, NO van en git)

Ver `server/.env.example` para la lista completa. Las críticas para
producción: `DATABASE_URL` (pooler, ver Gotcha #1), `SUPABASE_JWT_SECRET`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CORS_ORIGIN` (la URL del frontend).

### 1.3 Dockerfiles

Ambos son multi-stage y ya están en el repo tal cual — no deberían
necesitar tocarse para un deploy normal:

- **`Dockerfile`** (raíz): `node:22-alpine` compila con Vite → copia
  `dist/` a `nginx:stable-alpine`, sirviendo estático + template de
  `default.conf.template`.
- **`server/Dockerfile`**: `node:22-alpine` compila con `tsc` → stage de
  producción reinstala solo `dependencies` (`--prod`) y corre
  `node dist/server.js`. Heroku inyecta `$PORT` en runtime, el server ya
  lo respeta (`env.PORT`).

---

## 2. Primera vez: crear la app de backend en Heroku

Si `chatdb-alber-api` no existe todavía:

```bash
heroku create chatdb-alber-api
heroku stack:set container --app chatdb-alber-api
```

Configurar sus variables (nunca las pegues literales en el historial de
la shell si podés evitarlo — mejor cargarlas desde tu `.env` local):

```bash
cd server
set -a && source .env && set +a
heroku config:set --app chatdb-alber-api \
  NODE_ENV=production \
  CORS_ORIGIN=https://chatdb-alber-XXXXXXXXXXXX.herokuapp.com \
  DATABASE_URL="$DATABASE_URL" \
  SUPABASE_JWT_SECRET="$SUPABASE_JWT_SECRET" \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
cd ..
```

Y en el frontend, apuntar al backend recién creado:

```bash
heroku config:set --app chatdb-alber \
  API_UPSTREAM=https://chatdb-alber-api-XXXXXXXXXXXX.herokuapp.com
```

(`API_UPSTREAM` es para el proxy nginx opcional del Gotcha de arriba — no
hace falta si usás `VITE_API_URL`, pero no molesta dejarlo seteado.)

---

## 3. Flujo de despliegue

### Paso A: build local de verificación (recomendado antes de cada release)

```bash
# Frontend
docker build -t chatdb-frontend:local .

# Backend
cd server && docker build -t chatdb-backend:local . && cd ..
```

Si alguno falla, revisá los dos Gotchas de arriba antes que nada.

### Paso B: Git

```bash
pnpm run lint:fix
git add .
git commit -m "chore: deploy"
git push origin main
```

### Paso C: build + push + release — Frontend

```bash
docker buildx build --provenance=false --load --no-cache -t registry.heroku.com/chatdb-alber/web .
docker push registry.heroku.com/chatdb-alber/web
heroku container:release web --app chatdb-alber
```

### Paso D: build + push + release — Backend

```bash
cd server
docker buildx build --provenance=false --load --no-cache -t registry.heroku.com/chatdb-alber-api/web .
docker push registry.heroku.com/chatdb-alber-api/web
heroku container:release web --app chatdb-alber-api
cd ..
```

> El backend no tiene por qué desplegarse cada vez que cambia el frontend
> (y viceversa) — son releases independientes. Solo hace falta reconstruir
> y subir el que realmente cambió.

---

## 4. Verificación post-deploy

```bash
curl https://chatdb-alber-api-XXXXXXXXXXXX.herokuapp.com/health
# Esperado: {"status":"ok","db":"up"}
# Si sale {"status":"degraded","db":"down"}: revisar Gotcha #1 (DATABASE_URL)

curl -I https://chatdb-alber-XXXXXXXXXXXX.herokuapp.com/
# Esperado: 200, sirviendo el index.html del SPA
```

Abrí el frontend en el navegador, iniciá sesión, y confirmá en la pestaña
Network que las requests a `/diagrams`, `/auth/login`, etc. van al dominio
del backend (no 404 contra el dominio del frontend).

---

## 5. Comandos de gestión rápida

| Entorno Objetivo | Acción | Comando |
| :--- | :--- | :--- |
| **Linter** | Corregir estilo automático | `pnpm run lint:fix` |
| **Frontend local** | Build limpio | `docker build --no-cache -t chatdb-frontend:latest .` |
| **Frontend local** | Levantar contenedor | `docker run -d --name chatdb-frontend -p 8080:80 chatdb-frontend:latest` |
| **Backend local** | Build limpio | `cd server && docker build --no-cache -t chatdb-backend:latest .` |
| **Backend local** | Levantar contenedor | `docker run -d --name chatdb-backend --env-file server/.env -p 3001:3001 chatdb-backend:latest` |
| **Heroku** | Logs del frontend | `heroku logs --tail --app chatdb-alber` |
| **Heroku** | Logs del backend | `heroku logs --tail --app chatdb-alber-api` |
| **Heroku** | Ver config vars | `heroku config --app chatdb-alber-api` |
