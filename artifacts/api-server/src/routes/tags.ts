import { Router } from "express";
import { db, tagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/tags", async (_req, res) => {
  try {
    const tags = await db.select().from(tagsTable).orderBy(tagsTable.name);
    res.json(tags);
  } catch (err) {
    logger.error({ err }, "Error listing tags");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tags", async (req, res) => {
  try {
    const { name, color } = req.body as { name: string; color?: string };
    if (!name) return res.status(400).json({ error: "name is required" });

    const inserted = await db.insert(tagsTable).values({
      name: name.toLowerCase().trim(),
      color: color ?? "#6366f1",
    }).returning();

    res.status(201).json(inserted[0]);
  } catch (err) {
    logger.error({ err }, "Error creating tag");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tags/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tagsTable).where(eq(tagsTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Error deleting tag");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
