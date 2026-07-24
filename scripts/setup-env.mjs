#!/usr/bin/env node
// Writes .env.local from .env.example. Values normally arrive pre-collected via
// DATABASE_URL / DIRECT_URL / GROQ_API_KEY env vars (start-nexus-protocol.bat
// gathers those with `set /p`, which is more reliable on Windows than Node's
// readline when stdin isn't a real interactive console). Run directly with
// `npm run setup` for an interactive prompt instead (real terminal only - not
// meant to be piped).
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, ".env.example");
const localPath = join(root, ".env.local");

function setEnvValue(text, key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, line) : `${text}\n${line}\n`;
}

// Neon's pooled hostname has "-pooler" in it; the direct/unpooled host doesn't.
function deriveDirectUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.hostname.includes("-pooler")) {
      url.hostname = url.hostname.replace("-pooler", "");
      return url.toString();
    }
  } catch {
    // Not a parseable URL - fall through and reuse it as-is.
  }
  return databaseUrl;
}

async function promptValues() {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question, fallback = "") => (await rl.question(question)).trim() || fallback;

  console.log("\nNexus Protocol setup. You'll need two things - both free:\n");
  console.log("  1. A Postgres database - https://neon.tech (create a project, copy the");
  console.log("     'Pooled connection' string from the dashboard)");
  console.log("  2. A Groq API key - https://console.groq.com/keys\n");

  const databaseUrl = await ask("Paste your DATABASE_URL (pooled connection string): ");
  const suggestedDirect = deriveDirectUrl(databaseUrl);
  const directUrl = await ask(
    `Paste DIRECT_URL (unpooled - press Enter to use "${suggestedDirect}"): `,
    suggestedDirect,
  );
  const groqApiKey = await ask("Paste your GROQ_API_KEY (starts with gsk_): ");
  rl.close();
  return { databaseUrl, directUrl, groqApiKey };
}

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  let directUrl = process.env.DIRECT_URL;
  let groqApiKey = process.env.GROQ_API_KEY;

  if (!databaseUrl || !groqApiKey) {
    if (existsSync(localPath)) {
      const { createInterface } = await import("node:readline/promises");
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const overwrite = (await rl.question(".env.local already exists. Overwrite it? (y/N): ")).trim();
      rl.close();
      if (overwrite.toLowerCase() !== "y") {
        console.log("Keeping existing .env.local - nothing changed.");
        return;
      }
    }
    ({ databaseUrl, directUrl, groqApiKey } = await promptValues());
  }
  if (!directUrl) directUrl = deriveDirectUrl(databaseUrl);

  const jwtSecret = randomBytes(48).toString("base64url");

  let content = readFileSync(examplePath, "utf8");
  content = setEnvValue(content, "DATABASE_URL", databaseUrl);
  content = setEnvValue(content, "DIRECT_URL", directUrl);
  content = setEnvValue(content, "GROQ_API_KEY", groqApiKey);
  content = setEnvValue(content, "JWT_SECRET", jwtSecret);

  writeFileSync(localPath, content);
  console.log("\nWrote .env.local (generated a random JWT_SECRET for you).");
  console.log("Next: npm run db:push && npm run dev\n");
}

main();
