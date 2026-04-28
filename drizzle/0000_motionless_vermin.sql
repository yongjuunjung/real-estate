CREATE SCHEMA IF NOT EXISTS "jungnang";
--> statement-breakpoint
CREATE TABLE "jungnang"."apartments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sigungu_code" varchar(5) NOT NULL,
	"dong" varchar(50) NOT NULL,
	"jibun" varchar(30),
	"name" varchar(200) NOT NULL,
	"building_year" integer,
	"lat" numeric(10, 7),
	"lon" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jungnang"."realtors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"registration_number" varchar(50),
	"name" varchar(200) NOT NULL,
	"representative" varchar(100),
	"phone" varchar(30),
	"address" text,
	"dong" varchar(50),
	"lat" numeric(10, 7),
	"lon" numeric(10, 7),
	"status" varchar(20),
	"source_key" varchar(200) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jungnang"."transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"apartment_id" bigint,
	"sigungu_code" varchar(5) NOT NULL,
	"dong" varchar(50) NOT NULL,
	"jibun" varchar(30),
	"apartment_name" varchar(200) NOT NULL,
	"lease_type" varchar(4) NOT NULL,
	"exclusive_area" numeric(10, 4) NOT NULL,
	"floor" integer,
	"contract_date" date NOT NULL,
	"deposit" integer NOT NULL,
	"monthly_rent" integer DEFAULT 0 NOT NULL,
	"contract_term_start" date,
	"contract_term_end" date,
	"contract_type" varchar(4),
	"renewal_right_used" boolean,
	"building_year" integer,
	"source_key" varchar(200) NOT NULL,
	"raw_payload" jsonb,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jungnang"."transactions" ADD CONSTRAINT "transactions_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "jungnang"."apartments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "apartments_dong_jibun_name_uniq" ON "jungnang"."apartments" USING btree ("dong","jibun","name");--> statement-breakpoint
CREATE INDEX "apartments_sigungu_idx" ON "jungnang"."apartments" USING btree ("sigungu_code");--> statement-breakpoint
CREATE UNIQUE INDEX "realtors_source_key_uniq" ON "jungnang"."realtors" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "realtors_dong_idx" ON "jungnang"."realtors" USING btree ("dong");--> statement-breakpoint
CREATE INDEX "realtors_geo_idx" ON "jungnang"."realtors" USING btree ("lat","lon");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_source_key_uniq" ON "jungnang"."transactions" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "transactions_term_end_idx" ON "jungnang"."transactions" USING btree ("contract_term_end");--> statement-breakpoint
CREATE INDEX "transactions_apartment_idx" ON "jungnang"."transactions" USING btree ("apartment_id");--> statement-breakpoint
CREATE INDEX "transactions_dong_idx" ON "jungnang"."transactions" USING btree ("dong");