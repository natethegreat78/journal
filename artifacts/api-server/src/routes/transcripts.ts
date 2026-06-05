import { Router } from "express";
import { db, transcriptsTable, tagsTable, transcriptTagsTable, settingsTable } from "@workspace/db";
import { eq, ilike, or, inArray, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

async function getTranscriptWithTags(id: number) {
  const transcript = await db.select().from(transcriptsTable).where(eq(transcriptsTable.id, id)).limit(1);
  if (!transcript[0]) return null;
  const tagRows = await db
    .select({ id: tagsTable.id, name: tagsTable.name, color: tagsTable.color })
    .from(transcriptTagsTable)
    .innerJoin(tagsTable, eq(transcriptTagsTable.tagId, tagsTable.id))
    .where(eq(transcriptTagsTable.transcriptId, id));
  return { ...transcript[0], tags: tagRows };
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userContent: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content?.trim() ?? "";
}

router.get("/transcripts", async (req, res) => {
  try {
    const { search, tag, limit = "50", offset = "0" } = req.query as Record<string, string>;
    let transcriptIds: number[] | null = null;

    if (tag) {
      const tagRow = await db.select().from(tagsTable).where(ilike(tagsTable.name, tag)).limit(1);
      if (tagRow[0]) {
        const links = await db.select({ transcriptId: transcriptTagsTable.transcriptId })
          .from(transcriptTagsTable)
          .where(eq(transcriptTagsTable.tagId, tagRow[0].id));
        transcriptIds = links.map((l) => l.transcriptId);
        if (transcriptIds.length === 0) {
          return res.json([]);
        }
      } else {
        return res.json([]);
      }
    }

    let query = db.select().from(transcriptsTable).orderBy(desc(transcriptsTable.createdAt));

    const conditions = [];
    if (search) {
      conditions.push(or(ilike(transcriptsTable.rawText, `%${search}%`), ilike(transcriptsTable.title, `%${search}%`)));
    }
    if (transcriptIds !== null) {
      conditions.push(inArray(transcriptsTable.id, transcriptIds));
    }

    let rows;
    if (conditions.length > 0) {
      rows = await db.select().from(transcriptsTable)
        .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
        .orderBy(desc(transcriptsTable.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));
    } else {
      rows = await db.select().from(transcriptsTable)
        .orderBy(desc(transcriptsTable.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset));
    }

    const withTags = await Promise.all(rows.map((r) => getTranscriptWithTags(r.id)));
    res.json(withTags.filter(Boolean));
  } catch (err) {
    logger.error({ err }, "Error listing transcripts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transcripts", async (req, res) => {
  try {
    const { title, rawText, cleanedText, durationSeconds, tagIds } = req.body as {
      title?: string;
      rawText: string;
      cleanedText?: string;
      durationSeconds?: number;
      tagIds?: number[];
    };

    if (!rawText) return res.status(400).json({ error: "rawText is required" });

    const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    const autoTitle = title ?? rawText.trim().split(/\s+/).slice(0, 6).join(" ") + (rawText.trim().split(/\s+/).length > 6 ? "..." : "");

    const inserted = await db.insert(transcriptsTable).values({
      title: autoTitle,
      rawText,
      cleanedText: cleanedText ?? null,
      durationSeconds: durationSeconds ?? null,
      wordCount,
    }).returning();

    const t = inserted[0];

    if (tagIds && tagIds.length > 0) {
      await db.insert(transcriptTagsTable).values(tagIds.map((tid) => ({ transcriptId: t.id, tagId: tid }))).onConflictDoNothing();
    }

    const result = await getTranscriptWithTags(t.id);
    res.status(201).json(result);
  } catch (err) {
    logger.error({ err }, "Error creating transcript");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/transcripts/stats", async (_req, res) => {
  try {
    const counts = await db.select({
      totalCount: sql<number>`count(*)::int`,
      totalWords: sql<number>`coalesce(sum(${transcriptsTable.wordCount}), 0)::int`,
      totalDurationSeconds: sql<number>`coalesce(sum(${transcriptsTable.durationSeconds}), 0)::int`,
    }).from(transcriptsTable);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentRows = await db.select({ cnt: sql<number>`count(*)::int` })
      .from(transcriptsTable)
      .where(sql`${transcriptsTable.createdAt} >= ${sevenDaysAgo}`);

    const topTagRows = await db
      .select({ name: tagsTable.name, count: sql<number>`count(*)::int` })
      .from(transcriptTagsTable)
      .innerJoin(tagsTable, eq(transcriptTagsTable.tagId, tagsTable.id))
      .groupBy(tagsTable.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    res.json({
      totalCount: counts[0]?.totalCount ?? 0,
      totalWords: counts[0]?.totalWords ?? 0,
      totalDurationSeconds: counts[0]?.totalDurationSeconds ?? 0,
      topTags: topTagRows,
      recentCount: recentRows[0]?.cnt ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/transcripts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await getTranscriptWithTags(id);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error fetching transcript");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/transcripts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, rawText, cleanedText, summary, tagIds } = req.body as {
      title?: string;
      rawText?: string;
      cleanedText?: string;
      summary?: string;
      tagIds?: number[];
    };

    const updates: Partial<typeof transcriptsTable.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (rawText !== undefined) {
      updates.rawText = rawText;
      updates.wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
    }
    if (cleanedText !== undefined) updates.cleanedText = cleanedText;
    if (summary !== undefined) updates.summary = summary;

    if (Object.keys(updates).length > 0) {
      await db.update(transcriptsTable).set(updates).where(eq(transcriptsTable.id, id));
    }

    if (tagIds !== undefined) {
      await db.delete(transcriptTagsTable).where(eq(transcriptTagsTable.transcriptId, id));
      if (tagIds.length > 0) {
        await db.insert(transcriptTagsTable).values(tagIds.map((tid) => ({ transcriptId: id, tagId: tid }))).onConflictDoNothing();
      }
    }

    const result = await getTranscriptWithTags(id);
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error updating transcript");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/transcripts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(transcriptsTable).where(eq(transcriptsTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Error deleting transcript");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transcripts/:id/summarize", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const transcript = await getTranscriptWithTags(id);
    if (!transcript) return res.status(404).json({ error: "Not found" });

    const apiKey = await getSetting("openaiApiKey");
    if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });

    const model = (await getSetting("openaiModel")) ?? "gpt-4o-mini";
    const text = transcript.cleanedText ?? transcript.rawText;

    const summary = await callOpenAI(
      apiKey,
      model,
      "You are a concise summarizer. Produce a clear, well-structured summary of the transcript provided. Keep it to 3-5 sentences. Do not include filler commentary.",
      text,
    );

    await db.update(transcriptsTable).set({ summary }).where(eq(transcriptsTable.id, id));
    const result = await getTranscriptWithTags(id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error summarizing transcript");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/transcripts/:id/cleanup", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const transcript = await getTranscriptWithTags(id);
    if (!transcript) return res.status(404).json({ error: "Not found" });

    const apiKey = await getSetting("openaiApiKey");
    if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });

    const model = (await getSetting("openaiModel")) ?? "gpt-4o-mini";

    const cleanedText = await callOpenAI(
      apiKey,
      model,
      `You are a transcript editor. Remove filler words and verbal tics (um, uh, like, you know, basically, literally, actually, right, so, well, I mean, kind of, sort of) and fix minor grammatical issues caused by speaking. Preserve the speaker's original meaning, tone, and all substantive content. Return only the cleaned transcript text — no commentary, no preamble.`,
      transcript.rawText,
    );

    await db.update(transcriptsTable).set({ cleanedText }).where(eq(transcriptsTable.id, id));
    const result = await getTranscriptWithTags(id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error cleaning transcript");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/transcripts/:id/autotag", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const transcript = await getTranscriptWithTags(id);
    if (!transcript) return res.status(404).json({ error: "Not found" });

    const apiKey = await getSetting("openaiApiKey");
    if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });

    const model = (await getSetting("openaiModel")) ?? "gpt-4o-mini";
    const text = transcript.cleanedText ?? transcript.rawText;

    const tagsJson = await callOpenAI(
      apiKey,
      model,
      `You are a tagging assistant. Analyze the transcript and return 3-6 relevant tags as a JSON array of strings. Tags should be short (1-3 words), lowercase, and capture the main topics, themes, or context of the transcript. Return only valid JSON array, no other text. Example: ["meeting notes", "project planning", "budget"]`,
      text,
    );

    let tagNames: string[] = [];
    try {
      tagNames = JSON.parse(tagsJson);
    } catch {
      const match = tagsJson.match(/\[.*?\]/s);
      if (match) tagNames = JSON.parse(match[0]);
    }

    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];
    const tagIds: number[] = [];

    for (const name of tagNames.slice(0, 6)) {
      const existing = await db.select().from(tagsTable).where(ilike(tagsTable.name, name)).limit(1);
      if (existing[0]) {
        tagIds.push(existing[0].id);
      } else {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const inserted = await db.insert(tagsTable).values({ name: name.toLowerCase(), color }).returning();
        tagIds.push(inserted[0].id);
      }
    }

    await db.delete(transcriptTagsTable).where(eq(transcriptTagsTable.transcriptId, id));
    if (tagIds.length > 0) {
      await db.insert(transcriptTagsTable).values(tagIds.map((tid) => ({ transcriptId: id, tagId: tid }))).onConflictDoNothing();
    }

    const result = await getTranscriptWithTags(id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error autotagging transcript");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
