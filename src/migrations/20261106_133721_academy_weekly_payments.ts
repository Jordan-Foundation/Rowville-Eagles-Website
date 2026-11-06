import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_academy_bookings_payments_status" AS ENUM('paid', 'failed');
  CREATE TABLE "academy_bookings_payments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"invoice_id" varchar NOT NULL,
  	"status" "enum_academy_bookings_payments_status" NOT NULL,
  	"amount" numeric,
  	"at" timestamp(3) with time zone,
  	"pay_url" varchar
  );
  
  ALTER TABLE "academy_bookings" ADD COLUMN "next_charge_at" timestamp(3) with time zone;
  ALTER TABLE "academy_bookings" ADD COLUMN "charge_anchor_at" timestamp(3) with time zone;
  ALTER TABLE "academy_bookings" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "academy_bookings_payments" ADD CONSTRAINT "academy_bookings_payments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."academy_bookings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "academy_bookings_payments_order_idx" ON "academy_bookings_payments" USING btree ("_order");
  CREATE INDEX "academy_bookings_payments_parent_id_idx" ON "academy_bookings_payments" USING btree ("_parent_id");
  CREATE INDEX "academy_bookings_stripe_subscription_id_idx" ON "academy_bookings" USING btree ("stripe_subscription_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "academy_bookings_payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "academy_bookings_payments" CASCADE;
  DROP INDEX "academy_bookings_stripe_subscription_id_idx";
  ALTER TABLE "academy_bookings" DROP COLUMN "next_charge_at";
  ALTER TABLE "academy_bookings" DROP COLUMN "charge_anchor_at";
  ALTER TABLE "academy_bookings" DROP COLUMN "stripe_customer_id";
  DROP TYPE "public"."enum_academy_bookings_payments_status";`)
}
