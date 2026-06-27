#!/bin/sh

# Heroku assigns a dynamic port via $PORT — default to 80 if not set (local/Docker)
export PORT=${PORT:-80}

# Replace placeholders in nginx config (including $PORT for Heroku compatibility)
envsubst '${PORT} ${OPENAI_API_KEY} ${OPENAI_API_ENDPOINT} ${LLM_MODEL_NAME} ${HIDE_CHARTDB_CLOUD} ${DISABLE_ANALYTICS} ${SUPABASE_URL} ${SUPABASE_ANON_KEY}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start Nginx
nginx -g "daemon off;"
