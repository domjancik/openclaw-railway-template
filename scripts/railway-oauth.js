#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT = process.cwd();
const SECRETS_DIR = path.join(ROOT, ".secrets");
const KEY_PATH = path.join(SECRETS_DIR, "railway-oauth.key");
const SESSION_PATH = path.join(SECRETS_DIR, "railway-oauth-session.enc.json");
const ENV_PATH = path.join(ROOT, ".env");

const OIDC_CONFIG_URL =
  "https://backboard.railway.com/oauth/.well-known/openid-configuration";
const DEFAULT_SCOPE = "openid email profile offline_access";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

function getenv(key, env) {
  return process.env[key] || env[key] || "";
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFilePrivate(filePath, content) {
  fs.writeFileSync(filePath, content);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (_) {
    // Windows may ignore chmod.
  }
}

function getOrCreateKey() {
  ensureDir(SECRETS_DIR);
  if (fs.existsSync(KEY_PATH)) {
    const raw = fs.readFileSync(KEY_PATH, "utf8").trim();
    return Buffer.from(raw, "base64");
  }
  const key = crypto.randomBytes(32);
  writeFilePrivate(KEY_PATH, key.toString("base64"));
  return key;
}

function encryptSession(payload) {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    createdAt: new Date().toISOString(),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
}

function saveEncryptedSession(payload) {
  ensureDir(SECRETS_DIR);
  const blob = encryptSession(payload);
  writeFilePrivate(SESSION_PATH, `${JSON.stringify(blob, null, 2)}\n`);
}

function randomB64Url(bytes) {
  return crypto
    .randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildPkce() {
  const verifier = randomB64Url(64);
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return { verifier, challenge };
}

async function getOidcConfig() {
  const resp = await fetch(OIDC_CONFIG_URL);
  if (!resp.ok) {
    throw new Error(`OIDC discovery failed: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

function parseRedirect(redirectUri) {
  const u = new URL(redirectUri);
  return {
    host: u.hostname,
    port: Number(u.port || 80),
    pathname: u.pathname || "/callback",
    url: u,
  };
}

async function exchangeCodeForToken({
  tokenEndpoint,
  code,
  redirectUri,
  clientId,
  clientSecret,
  codeVerifier,
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!resp.ok) {
    throw new Error(
      `Token exchange failed: ${resp.status} ${resp.statusText} ${text}`,
    );
  }
  return json;
}

async function runLogin() {
  const env = parseEnvFile(ENV_PATH);
  const clientId = getenv("RAILWAY_CLIENT_ID", env);
  const clientSecret = getenv("RAILWAY_CLIENT_SECRET", env);
  const redirectUri = getenv("RAILWAY_REDIRECT_URI", env);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing env values: RAILWAY_CLIENT_ID, RAILWAY_CLIENT_SECRET, RAILWAY_REDIRECT_URI",
    );
  }

  const redirect = parseRedirect(redirectUri);
  const oidc = await getOidcConfig();
  const state = randomB64Url(24);
  const pkce = buildPkce();

  const authUrl = new URL(oidc.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", DEFAULT_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", pkce.challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log(`OAuth authorize URL:\n${authUrl.toString()}\n`);
  console.log(
    `Waiting for callback on http://${redirect.host}:${redirect.port}${redirect.pathname}`,
  );

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const incoming = new URL(
          req.url || "/",
          `http://${redirect.host}:${redirect.port}`,
        );
        if (incoming.pathname !== redirect.pathname) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const err = incoming.searchParams.get("error");
        if (err) {
          const desc = incoming.searchParams.get("error_description") || "";
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("OAuth error received. Check terminal output.");
          server.close();
          reject(new Error(`OAuth error: ${err} ${desc}`));
          return;
        }

        const callbackState = incoming.searchParams.get("state");
        const callbackCode = incoming.searchParams.get("code");
        if (!callbackCode || callbackState !== state) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid callback state or missing code.");
          server.close();
          reject(new Error("Invalid callback state or missing code."));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Railway OAuth complete. You can close this tab.");
        server.close();
        resolve(callbackCode);
      } catch (err2) {
        server.close();
        reject(err2);
      }
    });

    server.on("error", reject);
    server.listen(redirect.port, redirect.host);
  });

  const token = await exchangeCodeForToken({
    tokenEndpoint: oidc.token_endpoint,
    code,
    redirectUri,
    clientId,
    clientSecret,
    codeVerifier: pkce.verifier,
  });

  saveEncryptedSession({
    provider: "railway",
    oidcIssuer: oidc.issuer,
    redirectUri,
    scopes: DEFAULT_SCOPE,
    token,
  });

  console.log(`OAuth session stored (encrypted): ${SESSION_PATH}`);
}

runLogin().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
