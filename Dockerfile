# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Enable pnpm via corepack (built-in with Node 24, no extra install needed)
RUN corepack enable && corepack prepare pnpm@9 --activate

ARG VITE_OPENAI_API_KEY
ARG VITE_OPENAI_API_ENDPOINT
ARG VITE_LLM_MODEL_NAME
ARG VITE_HIDE_CHARTDB_CLOUD
ARG VITE_DISABLE_ANALYTICS
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

WORKDIR /usr/src/app

# Copy only manifest files first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies deterministically (equivalent to npm ci)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Inject build-time environment variables
RUN echo "VITE_OPENAI_API_KEY=${VITE_OPENAI_API_KEY}" > .env && \
    echo "VITE_OPENAI_API_ENDPOINT=${VITE_OPENAI_API_ENDPOINT}" >> .env && \
    echo "VITE_LLM_MODEL_NAME=${VITE_LLM_MODEL_NAME}" >> .env && \
    echo "VITE_HIDE_CHARTDB_CLOUD=${VITE_HIDE_CHARTDB_CLOUD}" >> .env && \
    echo "VITE_DISABLE_ANALYTICS=${VITE_DISABLE_ANALYTICS}" >> .env && \
    echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env

# Build the production bundle (type-checking is a dev concern; Vite uses esbuild for transpilation)
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build

# ─── Stage 2: Production (nginx) ──────────────────────────────────────────────
FROM nginx:stable-alpine AS production

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY ./default.conf.template /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]