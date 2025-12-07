import { db } from "./db";
import { sql } from "drizzle-orm";

async function fixUpdatedAt() {
  await db.execute(sql`
    ALTER TABLE rooms 
    ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL;
  `);
  // Create function for update
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  // Add trigger
  await db.execute(sql`
    DROP TRIGGER IF EXISTS rooms_update_trigger ON rooms;
    CREATE TRIGGER rooms_update_trigger
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  `);
  console.log("Added updated_at column and trigger!");
}

fixUpdatedAt().catch(console.error);