#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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

function runRailway(args, env) {
  const res = spawnSync("railway", args, {
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "railway command failed").trim());
  }
  return (res.stdout || "").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDeploymentStatus(statusJson, serviceName, envName) {
  const envEdges = statusJson?.environments?.edges || [];
  const envNode = envEdges
    .map((e) => e?.node)
    .find((n) => n && n.name === envName);
  if (!envNode) return null;
  const svcEdges = envNode?.serviceInstances?.edges || [];
  const svcNode = svcEdges
    .map((e) => e?.node)
    .find((n) => n && n.serviceName === serviceName);
  if (!svcNode) return null;
  const dep = svcNode.latestDeployment;
  return {
    id: dep?.id || "",
    status: dep?.status || "UNKNOWN",
    commit: dep?.meta?.commitHash || "",
    message: dep?.meta?.commitMessage || "",
    createdAt: dep?.createdAt || "",
  };
}

async function main() {
  const envFile = parseEnvFile(ENV_PATH);
  const token = process.env.RAILWAY_TOKEN || envFile.RAILWAY_TOKEN;
  if (!token) throw new Error("RAILWAY_TOKEN missing. Add it to .env or environment.");

  const service = process.env.RAILWAY_SERVICE || "openclaw-railway-template";
  const environment = process.env.RAILWAY_ENVIRONMENT || "production";
  const timeoutMs = Number(process.env.RAILWAY_WAIT_TIMEOUT_MS || 15 * 60 * 1000);
  const pollMs = Number(process.env.RAILWAY_WAIT_POLL_MS || 10000);
  const logLines = process.env.RAILWAY_LOG_LINES || "300";

  const cliEnv = { ...process.env, RAILWAY_TOKEN: token };
  const started = Date.now();

  console.log(
    `Waiting for deployment: service=${service} environment=${environment} timeoutMs=${timeoutMs}`,
  );

  let last = null;
  while (Date.now() - started < timeoutMs) {
    const raw = runRailway(["status", "--json"], cliEnv);
    const parsed = JSON.parse(raw);
    const dep = getDeploymentStatus(parsed, service, environment);
    if (!dep) {
      throw new Error(
        `Could not locate service '${service}' in environment '${environment}' from railway status.`,
      );
    }
    if (!last || last.id !== dep.id || last.status !== dep.status) {
      console.log(
        `[deploy] id=${dep.id} status=${dep.status} commit=${dep.commit.slice(0, 7)} createdAt=${dep.createdAt}`,
      );
      if (dep.message) console.log(`[deploy] message=${dep.message}`);
      last = dep;
    }

    if (dep.status !== "BUILDING" && dep.status !== "DEPLOYING") {
      console.log(`[deploy] terminal status: ${dep.status}`);
      console.log("[deploy] fetching latest logs");
      const logs = runRailway(
        [
          "logs",
          "--service",
          service,
          "--environment",
          environment,
          "-n",
          logLines,
        ],
        cliEnv,
      );
      process.stdout.write(`${logs}\n`);
      process.exit(dep.status === "SUCCESS" ? 0 : 1);
    }

    await sleep(pollMs);
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for deployment to finish.`);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
