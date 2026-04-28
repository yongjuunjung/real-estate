import {
  pgSchema,
  bigserial,
  varchar,
  text,
  integer,
  bigint,
  numeric,
  date,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// 같은 Supabase DB를 다른 앱과 공유하기 때문에 별도 schema에 격리한다.
// drizzle-kit이 public을 건드리지 않게 drizzle.config.ts의 schemaFilter도 함께 설정.
export const jungnangSchema = pgSchema("jungnang");

export const apartments = jungnangSchema.table(
  "apartments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sigunguCode: varchar("sigungu_code", { length: 5 }).notNull(),
    dong: varchar("dong", { length: 50 }).notNull(),
    jibun: varchar("jibun", { length: 30 }),
    name: varchar("name", { length: 200 }).notNull(),
    buildingYear: integer("building_year"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lon: numeric("lon", { precision: 10, scale: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("apartments_dong_jibun_name_uniq").on(t.dong, t.jibun, t.name),
    index("apartments_sigungu_idx").on(t.sigunguCode),
  ],
);

export const transactions = jungnangSchema.table(
  "transactions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    apartmentId: bigint("apartment_id", { mode: "number" }).references(() => apartments.id),

    sigunguCode: varchar("sigungu_code", { length: 5 }).notNull(),
    dong: varchar("dong", { length: 50 }).notNull(),
    jibun: varchar("jibun", { length: 30 }),
    apartmentName: varchar("apartment_name", { length: 200 }).notNull(),

    leaseType: varchar("lease_type", { length: 4 }).notNull(),
    exclusiveArea: numeric("exclusive_area", { precision: 10, scale: 4 }).notNull(),
    floor: integer("floor"),

    contractDate: date("contract_date").notNull(),
    deposit: integer("deposit").notNull(),
    monthlyRent: integer("monthly_rent").notNull().default(0),

    contractTermStart: date("contract_term_start"),
    contractTermEnd: date("contract_term_end"),
    contractType: varchar("contract_type", { length: 4 }),
    renewalRightUsed: boolean("renewal_right_used"),

    buildingYear: integer("building_year"),
    sourceKey: varchar("source_key", { length: 200 }).notNull(),
    rawPayload: jsonb("raw_payload"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("transactions_source_key_uniq").on(t.sourceKey),
    index("transactions_term_end_idx").on(t.contractTermEnd),
    index("transactions_apartment_idx").on(t.apartmentId),
    index("transactions_dong_idx").on(t.dong),
  ],
);

export const realtors = jungnangSchema.table(
  "realtors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    registrationNumber: varchar("registration_number", { length: 50 }),
    name: varchar("name", { length: 200 }).notNull(),
    representative: varchar("representative", { length: 100 }),
    phone: varchar("phone", { length: 30 }),
    address: text("address"),
    dong: varchar("dong", { length: 50 }),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lon: numeric("lon", { precision: 10, scale: 7 }),
    status: varchar("status", { length: 20 }),
    sourceKey: varchar("source_key", { length: 200 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("realtors_source_key_uniq").on(t.sourceKey),
    index("realtors_dong_idx").on(t.dong),
    index("realtors_geo_idx").on(t.lat, t.lon),
  ],
);

export type Apartment = typeof apartments.$inferSelect;
export type NewApartment = typeof apartments.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Realtor = typeof realtors.$inferSelect;
export type NewRealtor = typeof realtors.$inferInsert;
