import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { db } from "@/lib/db";
import { instagramConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    // Check if user is authenticated with NextAuth 5
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "User not authenticated. Please log in to the application first." },
        { status: 401 }
      );
    }
    
    const appUserId = session.user.id;

    // Fetch connected Instagram accounts for the authenticated user
    const connectedAccounts = await db
      .select({
        id: instagramConnections.id,
        instagramUserId: instagramConnections.instagramUserId,
        instagramUsername: instagramConnections.instagramUsername,
        accessTokenExpiresAt: instagramConnections.accessTokenExpiresAt,
        createdAt: instagramConnections.createdAt,
      })
      .from(instagramConnections)
      .where(eq(instagramConnections.appUserId, appUserId))
      .orderBy(instagramConnections.createdAt);

    return NextResponse.json(connectedAccounts, { status: 200 });

  } catch (error) {
    console.error("Error fetching connected Instagram accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch connected Instagram accounts" },
      { status: 500 }
    );
  }
} 