import { timestamp, pgTable, text, primaryKey, integer, uuid, varchar } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";

// Existing instagramAccounts table is removed as NextAuth's `accounts` table will handle this.

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount['type']>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// You can add your application-specific tables below
// For example, if you still need specific Instagram details not covered by the generic account:
// export const userInstagramDetails = pgTable("user_instagram_details", {
//   userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }).primaryKey(),
//   someSpecificIgField: text("specific_ig_field"),
//   // ... other fields
// });

export const instagramConnections = pgTable("instagram_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  appUserId: text("app_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  instagramUserId: varchar("instagram_user_id", { length: 255 }).notNull().unique(),
  instagramUsername: varchar("instagram_username", {length: 255 }).notNull(),
  longLivedAccessToken: varchar("long_lived_access_token", { length: 512 }).notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
}); 