import { doublePrecision, integer, pgTable, timestamp } from 'drizzle-orm/pg-core'

export const domainVertices = pgTable('domain_vertices', {
  idx: integer('idx').primaryKey(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type DomainVertex = typeof domainVertices.$inferSelect

