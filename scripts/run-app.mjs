import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const flags = new Set(process.argv.slice(2));
const demo = flags.has("--demo");
const port = process.env.PORT || "3100";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("PORT must be 1-65535");
const env = { ...process.env, PORT: port };
if (demo) Object.assign(env, {
  ENABLE_NIM: "false", ENABLE_GROQ: "false", ENABLE_LLM: "false",
  CONGRESS_API_KEY: "", DATABASE_URL: "", DIRECT_URL: "",
  CENSUS_GEOCODER_ENABLED: "false", STORE_ANALYSES: "false", STORE_RAW_INPUTS: "false",
});

const cli = resolve("node_modules/next/dist/bin/next");
if (!existsSync(cli)) throw new Error("Install dependencies first: pnpm install --frozen-lockfile");
const action = flags.has("--build") ? "build" : flags.has("--dev") ? "dev" : "start";
if (action === "start" && !existsSync(".next/BUILD_ID")) throw new Error("Build first with pnpm build (or pnpm demo:build)");
const proxyFlags = env.HTTPS_PROXY || env.HTTP_PROXY ? ["--use-env-proxy"] : [];
const child = spawn(process.execPath, [...proxyFlags, cli, action, ...(action === "build" ? [] : ["--hostname", "0.0.0.0", "--port", port])], { env, stdio: "inherit" });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
