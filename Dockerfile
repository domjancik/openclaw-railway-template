FROM node:22-slim

RUN apt-get update && apt-get install -y git curl procps python3 make g++ cron chromium && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY scripts/patch-alphaclaw-openclaw-version.js /tmp/patch-alphaclaw-openclaw-version.js
RUN npm install --omit=dev --prefer-online && npm cache clean --force
RUN node /tmp/patch-alphaclaw-openclaw-version.js

ENV PATH="/usr/local/bin:/app/node_modules/.bin:$PATH"
ENV ALPHACLAW_ROOT_DIR=/data
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN mkdir -p /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY openclaw-shim.sh /usr/local/bin/openclaw
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/openclaw
RUN if [ -x /app/node_modules/.bin/openclaw ]; then mv /app/node_modules/.bin/openclaw /app/node_modules/.bin/openclaw.real; fi \
  && ln -sf /usr/local/bin/openclaw /app/node_modules/.bin/openclaw

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["alphaclaw", "start"]
