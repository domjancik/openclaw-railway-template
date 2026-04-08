#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  process.cwd(),
  "node_modules",
  "@chrysb",
  "alphaclaw",
  "lib",
  "server",
  "openclaw-version.js",
);

if (!fs.existsSync(target)) {
  console.log(`[patch] target not found, skipping: ${target}`);
  process.exit(0);
}

let src = fs.readFileSync(target, "utf8");
if (src.includes("kOpenclawUpdateStatusCache.latestVersion")) {
  console.log("[patch] openclaw-version.js already patched");
  process.exit(0);
}

const before = `      throw new Error(err.message || "Failed to read OpenClaw update status");`;
const after = `      const message = err.message || "Failed to read OpenClaw update status";
      if (message.includes("ETIMEDOUT") || message.includes("timed out")) {
        return {
          latestVersion: kOpenclawUpdateStatusCache.latestVersion,
          hasUpdate: kOpenclawUpdateStatusCache.hasUpdate,
        };
      }
      throw new Error(message);`;

if (!src.includes(before)) {
  console.log("[patch] expected pattern not found; no changes applied");
  process.exit(0);
}

src = src.replace(before, after);
fs.writeFileSync(target, src, "utf8");
console.log("[patch] patched openclaw-version.js timeout handling");
