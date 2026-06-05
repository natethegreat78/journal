import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const SETTING_KEYS = ["openaiApiKey", "openaiModel", "storageDir"] as const;

async function getAllSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string | null> = {};
  for (const row of rows) {
    map[row.key] = row.value ?? null;
  }
  return {
    openaiApiKey: map["openaiApiKey"] ? "****" + map["openaiApiKey"].slice(-4) : null,
    openaiModel: map["openaiModel"] ?? "gpt-4o-mini",
    storageDir: map["storageDir"] ?? "local",
  };
}

async function upsertSetting(key: string, value: string) {
  await db.insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

router.get("/settings", async (_req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "Error fetching settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const body = req.body as { openaiApiKey?: string; openaiModel?: string; storageDir?: string };

    if (body.openaiApiKey !== undefined) {
      await upsertSetting("openaiApiKey", body.openaiApiKey);
    }
    if (body.openaiModel !== undefined) {
      await upsertSetting("openaiModel", body.openaiModel);
    }
    if (body.storageDir !== undefined) {
      await upsertSetting("storageDir", body.storageDir);
    }

    const settings = await getAllSettings();
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "Error updating settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
