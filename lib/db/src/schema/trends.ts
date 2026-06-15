import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trendsTable = pgTable("trends", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  platform: text("platform").notNull(),
  score: integer("score").notNull().default(0),
  category: text("category").notNull(),
  emoji: text("emoji"),
  momentum: text("momentum").default("rising"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrendSchema = createInsertSchema(trendsTable).omit({ id: true, createdAt: true });
export type InsertTrend = z.infer<typeof insertTrendSchema>;
export type Trend = typeof trendsTable.$inferSelect;
