/**
 * SQLite-backed Express server for Electron desktop app.
 * This is a standalone server that runs inside the Electron main process
 * and mirrors the PostgreSQL-backed server used in the Replit web environment.
 * All data is stored in ~/Library/Application Support/Scribe/scribe.db
 */
import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import fs from "fs";
import Database from "better-sqlite3";
import { app } from "electron";

function getDataDir(): string {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(os.homedir(), "Library", "Application Support", "Scribe");
  }
}

function openDb(): Database.Database {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "scribe.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      raw_text TEXT NOT NULL,
      cleaned_text TEXT,
      summary TEXT,
      duration_seconds INTEGER,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transcript_tags (
      transcript_id INTEGER NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (transcript_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcript_tags_transcript ON transcript_tags(transcript_id);
    CREATE INDEX IF NOT EXISTS idx_transcript_tags_tag ON transcript_tags(tag_id);
  `);
}

function getTranscriptWithTags(db: Database.Database, id: number) {
  const t = db.prepare("SELECT * FROM transcripts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!t) return null;
  const tags = db.prepare(`
    SELECT tags.id, tags.name, tags.color FROM transcript_tags
    JOIN tags ON transcript_tags.tag_id = tags.id
    WHERE transcript_tags.transcript_id = ?
  `).all(id);
  return {
    id: t.id,
    title: t.title,
    rawText: t.raw_text,
    cleanedText: t.cleaned_text ?? null,
    summary: t.summary ?? null,
    durationSeconds: t.duration_seconds ?? null,
    wordCount: t.word_count,
    tags,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function upsertSetting(db: Database.Database, key: string, value: string) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userContent: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content?.trim() ?? "";
}

export function createServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = openDb();
    initSchema(db);

    const expressApp = express();
    expressApp.use(cors());
    expressApp.use(express.json());

    // Health
    expressApp.get("/api/healthz", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Transcripts list
    expressApp.get("/api/transcripts", (req, res) => {
      const { search, tag, limit = "50", offset = "0" } = req.query as Record<string, string>;

      let ids: number[] | null = null;
      if (tag) {
        const tagRow = db.prepare("SELECT id FROM tags WHERE lower(name) = lower(?)").get(tag) as { id: number } | undefined;
        if (!tagRow) return res.json([]);
        const links = db.prepare("SELECT transcript_id FROM transcript_tags WHERE tag_id = ?").all(tagRow.id) as { transcript_id: number }[];
        if (!links.length) return res.json([]);
        ids = links.map((l) => l.transcript_id);
      }

      let sql = "SELECT * FROM transcripts WHERE 1=1";
      const params: unknown[] = [];

      if (search) {
        sql += " AND (raw_text LIKE ? OR title LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
      if (ids) {
        sql += ` AND id IN (${ids.map(() => "?").join(",")})`;
        params.push(...ids);
      }
      sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      const result = rows.map((r) => getTranscriptWithTags(db, r.id as number)).filter(Boolean);
      res.json(result);
    });

    // Create transcript
    expressApp.post("/api/transcripts", (req, res) => {
      const { title, rawText, cleanedText, durationSeconds, tagIds } = req.body;
      if (!rawText) return res.status(400).json({ error: "rawText is required" });
      const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length;
      const autoTitle = title ?? rawText.trim().split(/\s+/).slice(0, 6).join(" ") + (rawText.trim().split(/\s+/).length > 6 ? "..." : "");
      const result = db.prepare(`
        INSERT INTO transcripts (title, raw_text, cleaned_text, duration_seconds, word_count)
        VALUES (?, ?, ?, ?, ?)
      `).run(autoTitle, rawText, cleanedText ?? null, durationSeconds ?? null, wordCount);
      const id = result.lastInsertRowid as number;
      if (tagIds?.length) {
        for (const tid of tagIds) {
          db.prepare("INSERT OR IGNORE INTO transcript_tags (transcript_id, tag_id) VALUES (?, ?)").run(id, tid);
        }
      }
      res.status(201).json(getTranscriptWithTags(db, id));
    });

    // Stats
    expressApp.get("/api/transcripts/stats", (_req, res) => {
      const counts = db.prepare("SELECT COUNT(*) as totalCount, COALESCE(SUM(word_count),0) as totalWords, COALESCE(SUM(duration_seconds),0) as totalDurationSeconds FROM transcripts").get() as Record<string, number>;
      const recentRow = db.prepare("SELECT COUNT(*) as cnt FROM transcripts WHERE created_at >= datetime('now', '-7 days')").get() as { cnt: number };
      const topTags = db.prepare("SELECT tags.name, COUNT(*) as count FROM transcript_tags JOIN tags ON transcript_tags.tag_id = tags.id GROUP BY tags.name ORDER BY count DESC LIMIT 5").all();
      res.json({ totalCount: counts.totalCount, totalWords: counts.totalWords, totalDurationSeconds: counts.totalDurationSeconds, topTags, recentCount: recentRow.cnt });
    });

    // Get transcript
    expressApp.get("/api/transcripts/:id", (req, res) => {
      const t = getTranscriptWithTags(db, parseInt(req.params.id));
      if (!t) return res.status(404).json({ error: "Not found" });
      res.json(t);
    });

    // Update transcript
    expressApp.patch("/api/transcripts/:id", (req, res) => {
      const id = parseInt(req.params.id);
      const { title, rawText, cleanedText, summary, tagIds } = req.body;
      if (title !== undefined) db.prepare("UPDATE transcripts SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
      if (rawText !== undefined) {
        const wc = rawText.trim().split(/\s+/).filter(Boolean).length;
        db.prepare("UPDATE transcripts SET raw_text = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?").run(rawText, wc, id);
      }
      if (cleanedText !== undefined) db.prepare("UPDATE transcripts SET cleaned_text = ?, updated_at = datetime('now') WHERE id = ?").run(cleanedText, id);
      if (summary !== undefined) db.prepare("UPDATE transcripts SET summary = ?, updated_at = datetime('now') WHERE id = ?").run(summary, id);
      if (tagIds !== undefined) {
        db.prepare("DELETE FROM transcript_tags WHERE transcript_id = ?").run(id);
        for (const tid of tagIds) db.prepare("INSERT OR IGNORE INTO transcript_tags (transcript_id, tag_id) VALUES (?, ?)").run(id, tid);
      }
      const t = getTranscriptWithTags(db, id);
      if (!t) return res.status(404).json({ error: "Not found" });
      res.json(t);
    });

    // Delete transcript
    expressApp.delete("/api/transcripts/:id", (req, res) => {
      db.prepare("DELETE FROM transcripts WHERE id = ?").run(parseInt(req.params.id));
      res.status(204).send();
    });

    // Summarize
    expressApp.post("/api/transcripts/:id/summarize", async (req, res) => {
      const id = parseInt(req.params.id);
      const t = getTranscriptWithTags(db, id);
      if (!t) return res.status(404).json({ error: "Not found" });
      const apiKey = getSetting(db, "openaiApiKey");
      if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });
      const model = getSetting(db, "openaiModel") ?? "gpt-4o-mini";
      try {
        const summary = await callOpenAI(apiKey, model, "You are a concise summarizer. Produce a clear, well-structured summary of the transcript in 3-5 sentences. Return only the summary text.", t.cleanedText ?? t.rawText);
        db.prepare("UPDATE transcripts SET summary = ?, updated_at = datetime('now') WHERE id = ?").run(summary, id);
        res.json(getTranscriptWithTags(db, id));
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Cleanup filler words
    expressApp.post("/api/transcripts/:id/cleanup", async (req, res) => {
      const id = parseInt(req.params.id);
      const t = getTranscriptWithTags(db, id);
      if (!t) return res.status(404).json({ error: "Not found" });
      const apiKey = getSetting(db, "openaiApiKey");
      if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });
      const model = getSetting(db, "openaiModel") ?? "gpt-4o-mini";
      try {
        const cleaned = await callOpenAI(apiKey, model,
          "Remove filler words (um, uh, like, you know, basically, literally, actually, right, so, well, I mean, kind of, sort of) and fix minor grammatical issues. Preserve all substantive content and the speaker's tone. Return only the cleaned text.",
          t.rawText);
        db.prepare("UPDATE transcripts SET cleaned_text = ?, updated_at = datetime('now') WHERE id = ?").run(cleaned, id);
        res.json(getTranscriptWithTags(db, id));
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Autotag
    expressApp.post("/api/transcripts/:id/autotag", async (req, res) => {
      const id = parseInt(req.params.id);
      const t = getTranscriptWithTags(db, id);
      if (!t) return res.status(404).json({ error: "Not found" });
      const apiKey = getSetting(db, "openaiApiKey");
      if (!apiKey) return res.status(400).json({ error: "No OpenAI API key configured. Please add it in Settings." });
      const model = getSetting(db, "openaiModel") ?? "gpt-4o-mini";
      try {
        const tagsJson = await callOpenAI(apiKey, model,
          "Return 3-6 relevant tags as a JSON array of short lowercase strings (1-3 words each). Return only valid JSON array, no other text. Example: [\"meeting notes\",\"project planning\"]",
          t.cleanedText ?? t.rawText);
        let tagNames: string[] = JSON.parse(tagsJson.match(/\[.*?\]/s)?.[0] ?? tagsJson);
        const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];
        const tagIds: number[] = [];
        for (const name of tagNames.slice(0, 6)) {
          const existing = db.prepare("SELECT id FROM tags WHERE lower(name) = lower(?)").get(name) as { id: number } | undefined;
          if (existing) { tagIds.push(existing.id); }
          else {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const r = db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)").run(name.toLowerCase(), color);
            tagIds.push(r.lastInsertRowid as number);
          }
        }
        db.prepare("DELETE FROM transcript_tags WHERE transcript_id = ?").run(id);
        for (const tid of tagIds) db.prepare("INSERT OR IGNORE INTO transcript_tags (transcript_id, tag_id) VALUES (?, ?)").run(id, tid);
        res.json(getTranscriptWithTags(db, id));
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // Tags
    expressApp.get("/api/tags", (_req, res) => res.json(db.prepare("SELECT * FROM tags ORDER BY name").all()));
    expressApp.post("/api/tags", (req, res) => {
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const r = db.prepare("INSERT INTO tags (name, color) VALUES (?, ?)").run(name.toLowerCase().trim(), color ?? "#6366f1");
      res.status(201).json(db.prepare("SELECT * FROM tags WHERE id = ?").get(r.lastInsertRowid));
    });
    expressApp.delete("/api/tags/:id", (req, res) => {
      db.prepare("DELETE FROM tags WHERE id = ?").run(parseInt(req.params.id));
      res.status(204).send();
    });

    // Settings
    expressApp.get("/api/settings", (_req, res) => {
      const apiKey = getSetting(db, "openaiApiKey");
      res.json({
        openaiApiKey: apiKey ? "****" + apiKey.slice(-4) : null,
        openaiModel: getSetting(db, "openaiModel") ?? "gpt-4o-mini",
        storageDir: getDataDir(),
      });
    });
    expressApp.patch("/api/settings", (req, res) => {
      const { openaiApiKey, openaiModel, storageDir } = req.body;
      if (openaiApiKey !== undefined) upsertSetting(db, "openaiApiKey", openaiApiKey);
      if (openaiModel !== undefined) upsertSetting(db, "openaiModel", openaiModel);
      if (storageDir !== undefined) upsertSetting(db, "storageDir", storageDir);
      const apiKey = getSetting(db, "openaiApiKey");
      res.json({
        openaiApiKey: apiKey ? "****" + apiKey.slice(-4) : null,
        openaiModel: getSetting(db, "openaiModel") ?? "gpt-4o-mini",
        storageDir: getDataDir(),
      });
    });

    // Find available port and start
    const server = expressApp.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve(addr.port);
    });
    server.on("error", reject);
  });
}
