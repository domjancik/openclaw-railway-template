#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");

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
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function run() {
  const env = parseEnvFile(ENV_PATH);
  const token = process.env.RAILWAY_TOKEN || env.RAILWAY_TOKEN;
  if (!token) {
    throw new Error("RAILWAY_TOKEN missing. Add it to .env or environment.");
  }

  const service = process.env.RAILWAY_SERVICE || "openclaw-railway-template";
  const environment = process.env.RAILWAY_ENVIRONMENT || "production";
  const lines = process.env.RAILWAY_LOG_LINES || "300";
  const follow = process.argv.includes("--follow");

  const args = [
    "logs",
    "--service",
    service,
    "--environment",
    environment,
    "-n",
    lines,
  ];
  if (follow) args.push("--follow");

  const railwayCmd = process.platform === "win32" ? "railway" : "railway";
  const child = spawn(railwayCmd, args, {
    stdio: "inherit",
    env: { ...process.env, RAILWAY_TOKEN: token },
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    console.error(String(err?.stack || err));
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code == null ? 1 : code);
  });
}

run();
