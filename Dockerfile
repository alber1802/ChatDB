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