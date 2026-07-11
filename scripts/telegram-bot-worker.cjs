#!/usr/bin/env node

const requiredVariables = ["APP_BASE_URL", "DATABASE_URL", "TELEGRAM_BOT_TOKEN"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(
    `[bot-worker] Missing required environment variables: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

const username = process.env.TELEGRAM_BOT_USERNAME || "unknown-bot";

console.log(`[bot-worker] Runtime configured for ${process.env.APP_BASE_URL}`);
console.log(`[bot-worker] Ready to run as @${username}`);
console.log("[bot-worker] Polling handlers are added by issue #96; this task provides the runtime foundation.");

setInterval(() => {
  console.log("[bot-worker] Waiting for Telegram onboarding handlers.");
}, 300_000);
