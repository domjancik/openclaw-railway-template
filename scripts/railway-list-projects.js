#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const SECRETS_DIR = path.join(ROOT, ".secrets");
const KEY_PATH = path.join(SECRETS_DIR, "railway-oauth.key");
const SESSION_PATH = path.join(SECRETS_DIR, "railway-oauth-session.enc.json");
const GRAPHQL_ENDPOINT =
  process.env.RAILWAY_GRAPHQL_ENDPOINT ||
  "https://backboard.railway.com/graphql/v2";

function loadKey() {
  if (!fs.existsSync(KEY_PATH)) {
    throw new Error(`Missing key file: ${KEY_PATH}`);
  }
  return Buffer.from(fs.readFileSync(KEY_PATH, "utf8").trim(), "base64");
}

function loadEncryptedSession() {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error(`Missing encrypted session file: ${SESSION_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
}

function decryptSession() {
  const key = loadKey();
  const enc = loadEncryptedSession();
  if (enc.alg !== "aes-256-gcm") {
    throw new Error(`Unsupported session encryption algorithm: ${enc.alg}`);
  }
  const iv = Buffer.from(enc.iv, "base64");
  const tag = Buffer.from(enc.tag, "base64");
  const data = Buffer.from(enc.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

async function graphqlRequest(token, query, variables = {}) {
  const resp = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${resp.status}): ${text}`);
  }
  if (!resp.ok) {
    throw new Error(
      `GraphQL HTTP ${resp.status}: ${json.errors ? JSON.stringify(json.errors) : text}`,
    );
  }
  return json;
}

function pickProjects(data) {
  if (data?.projects?.edges) {
    return data.projects.edges.map((e) => e.node).filter(Boolean);
  }
  if (data?.me?.projects?.edges) {
    return data.me.projects.edges.map((e) => e.node).filter(Boolean);
  }
  return [];
}

async function main() {
  const session = decryptSession();
  const token = session?.token?.access_token;
  if (!token) {
    throw new Error("No access_token found in decrypted OAuth session.");
  }

  const meQuery = `
    query Me {
      me {
        id
        name
        email
      }
    }
  `;

  const projectQueries = [
    `
      query Projects {
        projects {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
    `
      query MeProjects {
        me {
          projects {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `,
  ];

  const meRes = await graphqlRequest(token, meQuery);
  const me = meRes?.data?.me;
  console.log(
    `Authenticated as: ${me?.name || "unknown"} <${me?.email || "unknown"}>`,
  );

  let projects = [];
  let lastErr = null;
  for (const q of projectQueries) {
    try {
      const res = await graphqlRequest(token, q);
      projects = pickProjects(res?.data);
      if (projects.length >= 0) {
        lastErr = null;
        break;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    throw lastErr;
  }

  console.log(`Projects found: ${projects.length}`);
  for (const p of projects) {
    console.log(`- ${p.name} (${p.id})`);
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
