import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as schema from '../db/schema'; // Assuming schema is in db/schema.ts

dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required.');
}

const connectionString = process.env.DATABASE_URL;


console.log("connectionString", connectionString);
// Disable prefetch as it is not supported for "Transaction" pool mode
// TODO: Use `@neondatabase/serverless` driver for Vercel edge functions
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema }); 