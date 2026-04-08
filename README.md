**⚠️ This project is still under development, use at your own risk ⚠️**

# AlphaClaw Railway Template

Deploy OpenClaw to Railway in one click. Get a 24/7 AI agent connected to Telegram or Discord, with your entire config and workspace backed up to GitHub. No CLI required.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/openclaw-fast-start?referralCode=jcFhp_&utm_medium=integration&utm_source=template&utm_campaign=generic)

## The AlphaClaw Advantage

- **OpenClaw Gateway** running 24/7
- **Everything version controlled** — config, cron jobs, workspace, and memory backed up to GitHub automatically
- **Telegram or Discord** configured out of the box (add/remove channels anytime via the UI)
- **Google Workspace integration** — connect Gmail, Calendar, Drive, Contacts, and Sheets with a few clicks via built-in OAuth flow
- **Secrets never committed** — raw API keys are replaced with `${ENV_VAR}` references before pushing to GitHub
- **Prompt hardening** — improve change visibility and reduce silent/partial edits so your OpenClaw project stays stable over time
- **Setup UI** — web-based onboarding, env var management, channel pairing, and gateway control
- **Webhook proxy** — single exposed port handles both the setup UI and gateway webhooks

## Convenient Setup UI

<img width="5594" height="3646" alt="image" src="https://github.com/user-attachments/assets/6aa18214-5870-4e01-9ff4-b23e0353179e" />

## Deploy

Only one variable is needed at deploy time:

| Variable                 | Required    | Description                               |
| ------------------------ | ----------- | ----------------------------------------- |
| `SETUP_PASSWORD`         | ✅ Required | Password for the setup UI                 |
| `OPENCLAW_GATEWAY_TOKEN` | 🔒 Auto     | Auto-generated, secures your gateway      |
| `PORT`                   | 🔒 Auto     | Set by Railway                            |
| `WEBHOOK_TOKEN`          | 🔒 Auto     | Auto-generated, secures webhook endpoints |

Click the button to deploy:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/openclaw-fast-start?referralCode=jcFhp_&utm_medium=integration&utm_source=template&utm_campaign=generic)

Everything else — AI keys, GitHub credentials, channel tokens — is configured through the setup UI after your first login.

## First-time setup

After deploying, visit your Railway app URL (e.g. `https://your-app.up.railway.app`).

### 1. Log in with your setup password

### 2. Complete the welcome screen

The welcome screen walks you through selecting your default model and entering the minimum required variables:

- **Model** (required): Pulled dynamically from your installed OpenClaw model catalog
- **AI Provider auth** (required for selected model): Anthropic API Key/Setup Token, OpenAI API Key, Gemini API Key, or OpenAI Codex OAuth
- **GitHub**: Personal access token + a repo (`owner/repo`) for backing up your agent's state
- **Channel** (at least one): Telegram Bot Token or Discord Bot Token

Each field includes instructions and links for how to get the value. Optional fields (like Brave Search API Key) can be filled in later from the Envars tab.

> **Model catalog note:** Models are discovered at runtime via `openclaw models list --all --json`. This keeps the setup UI aligned with the OpenClaw version installed in your deployment.
>
> **Versioning note:** Template builds intentionally install `openclaw@latest` during Docker build, so new Railway deploys pick up the newest OpenClaw release automatically.
>
> **Codex OAuth note:** OpenClaw onboarding runs in non-interactive mode here. For OAuth-only Codex setups, the wrapper uses `--auth-choice skip` and then applies your selected `openai-codex/*` model after onboarding.

Click **Complete Setup** — the server runs onboarding, configures channels, and pushes an initial commit to your GitHub repo. This takes 10–15 seconds.

### 3. Approve channel pairing

DM your bot on Telegram (or Discord). The setup UI shows "Send a message to your bot on Telegram or Discord" with pending pairings polling every second. Click **Approve** to connect.

### 4. Connect Google Workspace (optional)

Once at least one channel is paired, the Google Workspace section appears:

1. Click **Set up Google** and enter your OAuth client credentials (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))
2. Select which permissions to grant
3. Click **Sign in with Google** to complete the OAuth flow
4. The UI shows API status for each service — click **Enable API** links for any that need enabling

### 5. Start chatting

DM your bot again — you're live!

Check your GitHub repo — you should see the initial commit with your agent's full config and workspace.

> **Memory search:** For your agent to semantically search its own memory, you need either `OPENAI_API_KEY` or `GEMINI_API_KEY` set. OpenClaw uses these to generate embeddings. Without one, memory recall won't work.

## Managing environment variables

The **Envars** tab lets you:

- View and edit all configured environment variables
- See which vars are set (values masked by default, click Show to reveal)
- Add custom variables — supports pasting multiple `KEY=VALUE` lines at once
- Delete custom variables with the ✕ button
- Save changes to the persistent `/data/.env` file
- Apply saved changes to bot runtime by clicking **Restart Gateway** after saving changes

The **Models** tab lets you:

- Set your primary model after onboarding
- Manage AI provider keys and Codex OAuth connection

Adding or removing a channel token (e.g. `DISCORD_BOT_TOKEN`) automatically enables/disables that channel in the OpenClaw config using `openclaw channels add/remove`.

The server watches `/data/.env` for changes — including ones written by the OpenClaw agent itself. When the agent needs an API key for a tool, it adds a placeholder to `/data/.env` and tells you to visit the Envars tab to fill it in.

### All configurable variables

| Variable                   | Group       | Description                                                                                                                    |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`        | AI Provider | From [console.anthropic.com](https://console.anthropic.com/) (recommended)                                                     |
| `ANTHROPIC_TOKEN`          | AI Provider | From `claude setup-token`                                                                                                      |
| `OPENAI_API_KEY`           | AI Provider | From [platform.openai.com](https://platform.openai.com/)                                                                       |
| `(no env var) Codex OAuth` | AI Provider | Connected via setup UI OAuth flow (ChatGPT subscription/Codex); stored in OpenClaw auth profiles                               |
| `GEMINI_API_KEY`           | AI Provider | From [aistudio.google.com](https://aistudio.google.com/)                                                                       |
| `GITHUB_TOKEN`             | GitHub      | Personal access token with `repo` scope from [github.com/settings/tokens](https://github.com/settings/tokens)                  |
| `GITHUB_WORKSPACE_REPO`    | GitHub      | `owner/repo` (or `https://github.com/owner/repo`)                                                                              |
| `TELEGRAM_BOT_TOKEN`       | Channels    | From [@BotFather](https://t.me/BotFather) · [full guide](https://docs.openclaw.ai/channels/telegram)                           |
| `DISCORD_BOT_TOKEN`        | Channels    | From [Developer Portal](https://discord.com/developers/applications) · [full guide](https://docs.openclaw.ai/channels/discord) |
| `BRAVE_API_KEY`            | Tools       | From [brave.com/search/api](https://brave.com/search/api/) — free tier available                                               |
| `TAILSCALE_AUTH_KEY`       | Networking  | Enables optional Tailscale startup when set (`tskey-auth-...`)                                                                  |
| `TAILSCALE_HOSTNAME`       | Networking  | Optional hostname for this node in your tailnet                                                                                  |
| `TAILSCALE_ACCEPT_ROUTES`  | Networking  | `true`/`false` (default `false`)                                                                                                 |
| `TAILSCALE_ACCEPT_DNS`     | Networking  | `true`/`false` (default `false`)                                                                                                 |
| `TAILSCALE_INSTALL_ON_BOOT`| Networking  | `true`/`false` (default `true`) install Tailscale if binary is missing                                                           |
| `TAILSCALE_ENABLE_PROXY_ENV`| Networking | `true`/`false` (default `true`) exports `ALL_PROXY`/`HTTP_PROXY`/`HTTPS_PROXY`                                                  |
| `TAILSCALE_SOCKS_ADDR`     | Networking  | Proxy listen address (default `127.0.0.1:1055`)                                                                                  |
| `TAILSCALE_HTTP_PROXY_ADDR`| Networking  | HTTP proxy listen address (default `127.0.0.1:1056`)                                                                              |
| `TAILSCALE_STATE_DIR`      | Networking  | State dir persisted on volume (default `/data/.tailscale`)                                                                       |
| `TAILSCALE_LOG_FILE`       | Networking  | Tailscaled log file path (default `/data/.tailscale/tailscaled.log`)                                                             |
| `TAILSCALE_FATAL_ON_FAILURE`| Networking | `true`/`false` (default `false`) fail container if Tailscale setup fails                                                         |
| `OPENCLAW_UPDATE_STATUS_TIMEOUT` | Runtime | Seconds for `openclaw update status` in shim (default `5`)                                                                    |

## Architecture

```
Internet → Railway :3000 (Express)
├── /                          → Setup UI (auth required)
├── /setup                     → Setup UI (auth required)
├── /api/status, /api/env ...  → Express handles (setup endpoints)
├── /api/* (everything else)   → proxy → gateway :18789
├── /webhook/*                 → proxy → gateway :18789 (token → Bearer header)
├── /openclaw                  → proxy → gateway :18789 (gateway control UI)
├── /assets/*                  → proxy → gateway :18789 (gateway UI assets)
└── WebSocket upgrade          → proxy → gateway :18789
```

### File layout

```
/data/.openclaw/           ← Railway volume + git repo
├── openclaw.json          ← Config (secrets → ${ENV_VAR} references)
├── skills/                ← Agent skills (control-ui installed on onboard)
├── cron/jobs.json         ← Scheduled tasks
├── .gitignore             ← Excludes keys, logs, caches
├── agents/                ← Session state
└── workspace/             ← Agent workspace
    ├── hooks/bootstrap/   ← Deploy-synced prompt templates
    │   ├── AGENTS.md      ← Injected by bootstrap-extra-files
    │   └── TOOLS.md       ← Injected by bootstrap-extra-files
    ├── HEARTBEAT.md       ← Periodic check instructions
    └── memory/            ← Agent memory

/data/.env                 ← Persistent env vars (managed via Setup UI)
```

### First boot

1. Container starts, installs dependencies
2. Server starts and serves the setup UI at `/`
3. User completes the welcome screen with required variables
4. Server runs `openclaw onboard`, configures channels, sanitizes secrets, and enables `bootstrap-extra-files` with `hooks/bootstrap/*`
5. Everything committed and pushed to your GitHub repo
6. Gateway starts

### Subsequent boots

1. `/data/.env` is loaded, bootstrap prompt templates are synced into `workspace/hooks/bootstrap`, and channel config is synced to match available tokens
2. Gateway starts
3. Setup UI available at `/` for managing env vars, channels, and pairings

## Optional Tailscale Networking

You can connect this Railway node to your tailnet to reach private LLM workloads (Ollama, vLLM, LM Studio, or OpenAI-compatible endpoints running on other machines in your tailnet).

How it works in this template:

1. At container startup, if `TAILSCALE_AUTH_KEY` is set, the entrypoint starts `tailscaled` in userspace mode.
2. It runs `tailscale up` with your auth key (and optional hostname/routes flags).
3. It exports proxy env vars so app egress can use Tailscale (`ALL_PROXY`, `HTTP_PROXY`, `HTTPS_PROXY`).

Minimal Railway variables:

```env
TAILSCALE_AUTH_KEY=tskey-auth-xxxxxxxx
TAILSCALE_HOSTNAME=openclaw-railway
```

Recommended (explicit):

```env
TAILSCALE_ACCEPT_ROUTES=false
TAILSCALE_ACCEPT_DNS=false
TAILSCALE_ENABLE_PROXY_ENV=true
TAILSCALE_STATE_DIR=/data/.tailscale
TAILSCALE_SOCKS_ADDR=127.0.0.1:1055
TAILSCALE_HTTP_PROXY_ADDR=127.0.0.1:1056
```

After deploy, point your OpenAI-compatible base URL to the tailnet host, for example:

```text
http://my-ollama-node.tailnet-name.ts.net:11434/v1
```

Notes:

- If `TAILSCALE_AUTH_KEY` is unset, startup behavior is unchanged.
- If Tailscale setup fails, container now continues by default (`TAILSCALE_FATAL_ON_FAILURE=false`) and prints `tailscaled` log tail to deploy logs.
- `TAILSCALE_ACCEPT_ROUTES` defaults to `false` to avoid unexpected route hijacking.
- `TAILSCALE_ACCEPT_DNS` defaults to `false` to avoid DNS side effects in managed runtimes.
- Tailscale state persists in the Railway volume under `/data/.tailscale`.
- `OPENCLAW_UPDATE_STATUS_TIMEOUT` lets you tune the wrapper timeout for update-status checks without changing other OpenClaw commands.

## Browser Runtime

This template now installs Chromium in the container for browser-capable OpenClaw tools.

- Chromium binary: `/usr/bin/chromium`
- Exported env vars: `CHROME_BIN` and `PUPPETEER_EXECUTABLE_PATH`

## Stability patch

This template applies a build-time patch to `@chrysb/alphaclaw`:

- File: `lib/server/openclaw-version.js`
- Behavior: `openclaw update status --json` timeouts (`ETIMEDOUT`) are treated as non-fatal cached-status responses instead of throwing and crashing the launcher.

The patch is applied in Docker build via:

- `scripts/patch-alphaclaw-openclaw-version.js`

### Gateway management

- **Status**: The setup UI checks if the gateway is listening on its port in real-time
- **Restart**: Click "Restart" in the General tab — runs `openclaw gateway install --force` then `openclaw gateway restart`
- **Channel sync**: Adding/removing channel tokens in the Envars tab automatically runs `openclaw channels add/remove`

## Troubleshooting

### Pairing

First time you DM the bot, it sends a pairing request. Approve it in the setup UI. Pairings poll every second when pending — if nothing appears, check that the channel token is correct in the Envars tab.

### Bot doesn't respond

- Check deploy logs for errors
- Verify your channel token is correct (Envars tab)
- Try clicking Restart in the General tab
- Check gateway status — should show green "running"

### Gateway won't start

- Ensure the Railway volume is mounted at `/data`
- Check that AI provider credentials are valid
- Check deploy logs for the specific error — common cause is a missing env var referenced in `openclaw.json`

### Channel shows "Add token"

The channel's env var is empty or missing. Go to the Envars tab, add the token, and save. The channel will be automatically enabled in the config.

### Railway OAuth local auth helper

To authenticate a local Railway OAuth session (for debugging and API access from this workspace):

1. Ensure `.env` contains:
   - `RAILWAY_CLIENT_ID`
   - `RAILWAY_CLIENT_SECRET`
   - `RAILWAY_REDIRECT_URI=http://127.0.0.1:4444/callback`
   - optional `RAILWAY_OAUTH_SCOPE` (defaults to `openid email profile offline_access workspace:viewer project:viewer`)
2. Run:

```bash
npm run railway:oauth
```

3. Open the printed authorize URL in your browser and complete Railway login/consent.
4. After callback completes, the encrypted session is stored at:
   - `.secrets/railway-oauth-session.enc.json`
   - encryption key: `.secrets/railway-oauth.key`

Notes:
- `.secrets/` is gitignored.
- Keep `.secrets/railway-oauth.key` private; it decrypts your local session file.

### Railway logs helper

To stream project logs using `RAILWAY_TOKEN` from `.env`:

```bash
npm run railway:logs
npm run railway:logs -- --follow
```

Optional overrides:
- `RAILWAY_SERVICE` (default `openclaw-railway-template`)
- `RAILWAY_ENVIRONMENT` (default `production`)
- `RAILWAY_LOG_LINES` (default `300`)

### Optional railtail sidecar (local/dev)

`docker-compose` includes an optional `railtail` service profile for tailnet forwarding:

```bash
docker compose --profile railtail up --build
```

Set these env vars:

- `RAILTAIL_TARGET_ADDR` (example: `http://desktop-a8tmsu2.tail65b2b7.ts.net:11434`)
- `RAILTAIL_TS_HOSTNAME`
- `RAILTAIL_TS_AUTH_KEY`
- `RAILTAIL_LISTEN_PORT` (default `11434`)

Then point OpenAI-compatible base URL to:

- `http://railtail:${RAILTAIL_LISTEN_PORT}/v1` (from within compose network)

### Railway wait helper

To wait for the current deployment to finish and then print fresh logs automatically:

```bash
npm run railway:wait
```

Optional overrides:
- `RAILWAY_WAIT_TIMEOUT_MS` (default `900000` = 15 minutes)
- `RAILWAY_WAIT_POLL_MS` (default `10000`)
- `RAILWAY_SERVICE` (default `openclaw-railway-template`)
- `RAILWAY_ENVIRONMENT` (default `production`)
- `RAILWAY_LOG_LINES` (default `300`)

## Links

- [OpenClaw docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Community Discord](https://discord.com/invite/clawd)
