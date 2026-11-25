import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const listings = sqliteTable("listings", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  purdue: integer("purdue", { mode: "boolean" }).notNull().default(false),
  nearCityBus: integer("near_citybus", { mode: "boolean" }).notNull().default(false),
  kind: text("kind", { enum: ["carpool", "oneoff", "carshare"] }).notNull(),
  role: text("role", { enum: ["offer", "request"] }).notNull(),
  title: text("title").notNull(),
  area: text("area").notNull(),
  destination: text("destination").notNull(),
  days: text("days", { mode: "json" }).$type<string[]>().notNull(),
  date: text("date").notNull().default(""),
  start: text("start").notNull(),
  end: text("end").notNull(),
  note: text("note").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expires: integer("expires").notNull(),
  removedAt: integer("removed_at"),
  hiddenAt: integer("hidden_at"),
}, table => [
  index("listing_owner").on(table.ownerId, table.createdAt),
  index("listing_public").on(table.removedAt, table.hiddenAt, table.expires),
]);

export const intros = sqliteTable("intros", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  title: text("title").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  recipientId: text("recipient_id").notNull(),
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull(),
  note: text("note").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [
  unique("intro_sender_listing").on(table.senderId, table.listingId),
  index("intro_sender").on(table.senderId, table.updatedAt),
  index("intro_recipient").on(table.recipientId, table.updatedAt),
]);

export const reports = sqliteTable("reports", {
  listingId: text("listing_id").notNull().references(() => listings.id),
  reporterId: text("reporter_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [
  unique("report_once").on(table.listingId, table.reporterId),
  index("report_reporter").on(table.reporterId, table.createdAt),
]);

export const termsReceipts = sqliteTable("terms_receipts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  version: text("version").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [
  index("terms_user").on(table.userId, table.createdAt),
]);
