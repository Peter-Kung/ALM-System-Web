import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  bindTelegramAccountByCode,
  formatTelegramBindingFailureMessage,
  sendTelegramActivationLink,
  type TelegramMessageTransport,
  type TelegramOnboardingRepository,
} from "@/modules/telegram/service";

type PendingActivationDelivery = {
  expiresAt: Date;
  token: string;
};

type StoredPendingActivationDelivery = {
  expiresAt: string;
  token: string;
};

export type PendingActivationDeliveryStore = {
  delete(key: string): Promise<void>;
  get(key: string): Promise<PendingActivationDelivery | null>;
  set(key: string, value: PendingActivationDelivery): Promise<void>;
};

export function createPendingActivationDeliveryKey(chatId: string, code: string) {
  return `${chatId}:${code.trim()}`;
}

export function createPendingActivationDeliveryStore(): PendingActivationDeliveryStore {
  const deliveries = new Map<string, PendingActivationDelivery>();

  return {
    async delete(key: string) {
      deliveries.delete(key);
    },
    async get(key: string) {
      return deliveries.get(key) ?? null;
    },
    async set(key: string, value: PendingActivationDelivery) {
      deliveries.set(key, value);
    },
  };
}

async function readPendingActivationDeliveries(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, StoredPendingActivationDelivery>;
    const deliveries = new Map<string, PendingActivationDelivery>();

    for (const [key, value] of Object.entries(parsed)) {
      deliveries.set(key, {
        expiresAt: new Date(value.expiresAt),
        token: value.token,
      });
    }

    return deliveries;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Map<string, PendingActivationDelivery>();
    }

    throw error;
  }
}

async function writePendingActivationDeliveries(
  filePath: string,
  deliveries: Map<string, PendingActivationDelivery>,
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serializedEntries = Object.fromEntries(
    Array.from(deliveries.entries()).map(([key, value]) => [
      key,
      {
        expiresAt: value.expiresAt.toISOString(),
        token: value.token,
      } satisfies StoredPendingActivationDelivery,
    ]),
  );
  const tempFilePath = `${filePath}.tmp`;

  await writeFile(
    tempFilePath,
    JSON.stringify(serializedEntries, null, 2),
    "utf8",
  );
  await rename(tempFilePath, filePath);
}

export function createFilePendingActivationDeliveryStore(
  filePath: string,
): PendingActivationDeliveryStore {
  return {
    async delete(key: string) {
      const deliveries = await readPendingActivationDeliveries(filePath);
      deliveries.delete(key);
      await writePendingActivationDeliveries(filePath, deliveries);
    },
    async get(key: string) {
      const deliveries = await readPendingActivationDeliveries(filePath);
      return deliveries.get(key) ?? null;
    },
    async set(key: string, value: PendingActivationDelivery) {
      const deliveries = await readPendingActivationDeliveries(filePath);
      deliveries.set(key, value);
      await writePendingActivationDeliveries(filePath, deliveries);
    },
  };
}

export async function processTelegramBindingMessage(
  code: string,
  chatId: string,
  appBaseUrl: string,
  transport: TelegramMessageTransport,
  repository: TelegramOnboardingRepository,
  pendingDeliveries: PendingActivationDeliveryStore,
  now: Date = new Date(),
) {
  const deliveryKey = createPendingActivationDeliveryKey(chatId, code);
  const pendingDelivery = await pendingDeliveries.get(deliveryKey);

  if (pendingDelivery && pendingDelivery.expiresAt.getTime() > now.getTime()) {
    await sendTelegramActivationLink(
      chatId,
      pendingDelivery.token,
      appBaseUrl,
      transport,
    );
    await pendingDeliveries.delete(deliveryKey);

    return {
      expiresAt: pendingDelivery.expiresAt,
      status: "bound" as const,
      telegramChatId: chatId,
    };
  }

  const bindingResult = await bindTelegramAccountByCode(
    code,
    chatId,
    repository,
    now,
  );

  if (bindingResult.status !== "bound") {
    await transport.sendMessage(
      chatId,
      formatTelegramBindingFailureMessage(bindingResult.status),
    );
    return bindingResult;
  }

  await pendingDeliveries.set(deliveryKey, {
    expiresAt: bindingResult.expiresAt,
    token: bindingResult.activationToken,
  });

  await sendTelegramActivationLink(
    bindingResult.telegramChatId,
    bindingResult.activationToken,
    appBaseUrl,
    transport,
  );
  await pendingDeliveries.delete(deliveryKey);

  return bindingResult;
}
