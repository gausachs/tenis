import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  state: text('state').notNull(),
  revision: integer('revision').notNull().default(0),
  mode: text('mode').notNull().default('shared'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const members = sqliteTable('members', {
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  lastSeen: integer('last_seen').notNull(),
}, (table) => [primaryKey({ columns: [table.roomId, table.tokenHash] }), index('members_presence').on(table.roomId, table.lastSeen)]);
