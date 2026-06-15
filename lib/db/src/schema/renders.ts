import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const renderJobsTable = pgTable("render_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  stage: text("stage"),
  outputUrl: text("output_url"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  platform: text("platform").notNull(),
  durationSec: integer("duration_sec").notNull().default(0),
  fileSizeBytes: integer("file_size_bytes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRenderJobSchema = createInsertSchema(renderJobsTable).omit({ id: true, createdAt: true });
export type InsertRenderJob = z.infer<typeof insertRenderJobSchema>;
export type RenderJob = typeof renderJobsTable.$inferSelect;
