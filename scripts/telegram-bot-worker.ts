import path from "node:path";

import { env } from "@/lib/env";
import {
  createFilePendingActivationDeliveryStore,
  createTelegramOnboardingRepository,
  processTelegramBindingMessage,
  type TelegramMessageTransport,
} from "@/modules/telegram";

type TelegramApiResponse<Result> = {
  description?: string;
  ok: boolean;
  result: Result;
};

type TelegramUpdate = {
  message?: {
    chat?: {
      id?: number | string;
    };
    text?: string;
  };
  update_id: number;
};

type TelegramGetMeResult = {
  username?: string;
  id: number;
};

type Logger = Pick<Console, "error" | "info" | "warn">;

const POLL_TIMEOUT_SECONDS = 30;
const RETRY_DELAY_MS = 5_000;
const pendingDeliveries = createFilePendingActivationDeliveryStore(
  path.join(env.runtimePaths.updateStateDir, "telegram-pending-deliveries.json"),
);

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function requireEnvironmentValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} must be set for the Telegram bot worker.`);
  }

  return value;
}

class TelegramApiClient implements TelegramMessageTransport {
  constructor(
    private readonly botToken: string,
    private readonly logger: Logger,
  ) {}

  async getMe() {
    return this.callTelegram<TelegramGetMeResult>("getMe", {});
  }

  async getUpdates(offset?: number) {
    return this.callTelegram<TelegramUpdate[]>("getUpdates", {
      allowed_updates: ["message"],
      offset,
      timeout: POLL_TIMEOUT_SECONDS,
    });
  }

  async sendMessage(chatId: string, text: string) {
    await this.callTelegram("sendMessage", {
      chat_id: chatId,
      text,
    });
  }

  private async callTelegram<Result>(
    method: string,
    body: Record<string, unknown>,
  ) {
    const response = await fetch(
      `https://api.telegram.org/bot${this.botToken}/${method}`,
      {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(`Telegram ${method} failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as TelegramApiResponse<Result>;
    if (!payload.ok) {
      throw new Error(
        payload.description
          ? `Telegram ${method} failed: ${payload.description}`
          : `Telegram ${method} failed.`,
      );
    }

    return payload.result;
  }
}

async function processUpdate(
  update: TelegramUpdate,
  appBaseUrl: string,
  client: TelegramApiClient,
  logger: Logger,
) {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined) {
    return;
  }

  const result = await processTelegramBindingMessage(
    text,
    String(chatId),
    appBaseUrl,
    client,
    createTelegramOnboardingRepository(),
    pendingDeliveries,
  );

  if (result.status === "bound") {
    const boundUsername = "username" in result ? result.username : "bound user";
    logger.info(
      `[bot-worker] Bound Telegram chat ${result.telegramChatId} to ${boundUsername} and sent activation link.`,
    );
    return;
  }

  logger.warn(
    `[bot-worker] Rejected onboarding code from chat ${String(chatId)} with status ${result.status}.`,
  );
}

async function main(logger: Logger = console) {
  const appBaseUrl = requireEnvironmentValue(process.env.APP_BASE_URL, "APP_BASE_URL");
  const botToken = requireEnvironmentValue(
    process.env.TELEGRAM_BOT_TOKEN,
    "TELEGRAM_BOT_TOKEN",
  );

  logger.info(`[bot-worker] Runtime configured for ${env.appName} at ${appBaseUrl}`);

  const client = new TelegramApiClient(botToken, logger);
  const me = await client.getMe();
  logger.info(
    `[bot-worker] Polling Telegram as @${me.username ?? process.env.TELEGRAM_BOT_USERNAME ?? me.id}.`,
  );

  let nextOffset: number | undefined;

  while (true) {
    try {
      const updates = await client.getUpdates(nextOffset);
      for (const update of updates) {
        await processUpdate(update, appBaseUrl, client, logger);
        nextOffset = update.update_id + 1;
      }
    } catch (error) {
      logger.error("[bot-worker] Polling failed.", error);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

void main().catch((error) => {
  console.error("[bot-worker] Startup failed.", error);
  process.exit(1);
});
