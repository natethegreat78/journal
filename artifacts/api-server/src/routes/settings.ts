import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

async function getAllSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string | null> = {};
  for (const row of rows) {
    map[row.key] = row.value ?? null;
  }
  return {
    groqApiKey: map["groqApiKey"] ? "****" + map["groqApiKey"].slice(-4) : null,
    groqModel: map["groqModel"] ?? "llama-3.3-70b-versatile",
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
    res.json(await getAllSettings());
  } catch (err) {
    logger.error({ err }, "Error fetching settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const body = req.body as { groqApiKey?: string; groqModel?: string; storageDir?: string };
    if (body.groqApiKey !== undefined) await upsertSetting("groqApiKey", body.groqApiKey);
    if (body.groqModel !== undefined) await upsertSetting("groqModel", body.groqModel);
    if (body.storageDir !== undefined) await upsertSetting("storageDir", body.storageDir);
    res.json(await getAllSettings());
  } catch (err) {
    logger.error({ err }, "Error updating settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
