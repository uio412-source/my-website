import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const catalogCards = sqliteTable("catalog_cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  issuer: text("issuer").notNull(),
  type: text("type").notNull(),
  annualFeeMin: integer("annual_fee_min"),
  minimumSpend: integer("minimum_spend"),
  issuanceStatus: text("issuance_status").notNull(),
  payload: text("payload").notNull(),
  summaryPayload: text("summary_payload").notNull().default("{}"),
  verifiedAt: text("verified_at").notNull(),
}, t => [index("idx_catalog_cards_issuer_type").on(t.issuer, t.type)]);
export const catalogEvents = sqliteTable("catalog_events", {
  id: text("id").primaryKey(), kind: text("kind").notNull(),
  issuer: text("issuer").notNull(), status: text("status").notNull(),
  payload: text("payload").notNull(), verifiedAt: text("verified_at").notNull(),
}, t => [index("idx_catalog_events_kind_status").on(t.kind,t.status)]);
export const catalogTags = sqliteTable("catalog_tags", {
  id: text("id").primaryKey(), recordId: text("record_id").notNull(),
  kind: text("kind").notNull(), tag: text("tag").notNull(),
}, t => [index("idx_catalog_tags_tag_kind").on(t.tag,t.kind)]);
export const catalogMeta = sqliteTable("catalog_meta", {key:text("key").primaryKey(),value:text("value").notNull()});
export const communityPosts=sqliteTable('community_posts',{
 id:text('id').primaryKey(),topic:text('topic').notNull(),title:text('title').notNull(),body:text('body').notNull(),authorId:text('author_id').notNull(),authorName:text('author_name').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('idx_community_topic_created').on(t.topic,t.createdAt)]);
export const discussionComments=sqliteTable('discussion_comments',{
 id:text('id').primaryKey(),targetKind:text('target_kind').notNull(),targetId:text('target_id').notNull(),body:text('body').notNull(),authorId:text('author_id').notNull(),authorName:text('author_name').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('idx_comments_target_created').on(t.targetKind,t.targetId,t.createdAt)]);
