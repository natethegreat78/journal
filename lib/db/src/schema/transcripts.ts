import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transcriptsTable = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Untitled"),
  rawText: text("raw_text").notNull(),
  cleanedText: text("cleaned_text"),
  summary: text("summary"),
  durationSeconds: integer("duration_seconds"),
  wordCount: integer("word_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTranscriptSchema = createInsertSchema(transcriptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcriptsTable.$inferSelect;
