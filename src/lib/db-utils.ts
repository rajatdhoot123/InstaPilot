import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Checks the database connection by executing a simple query.
 * @returns {Promise<boolean>} True if the connection is successful, false otherwise.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    // Performing a simple query to check the database connection
    await db.execute(sql`SELECT 1`);
    console.log("Database connection successful.");
    return true;
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    return false;
  }
}

// Example of how you might call this, e.g., during app startup or a health check
// (async () => {
//   const isConnected = await checkDbConnection();
//   if (isConnected) {
//     console.log("Successfully verified database connection.");
//   } else {
//     console.log("Database connection verification failed.");
//   }
// })(); 