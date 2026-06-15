import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exportJobsTable = pgTable("export_jobs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("queued"),
  downloadUrl: text("download_url"),
  width: integer("width").notNull().default(1080),
  height: integer("height").notNull().default(1920),
  fileSizeBytes: integer("file_size_bytes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExportJobSchema = createInsertSchema(exportJobsTable).omit({ id: true, createdAt: true });
export type InsertExportJob = z.infer<typeof insertExportJobSchema>;
export type ExportJob = typeof exportJobsTable.$inferSelect;
