import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { refreshInstagramToken } from "@/lib/instagram-refresh";
import { db } from "@/lib/db";
import { instagramConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    // Use NextAuth 5 for authentication instead of iron-session
    const session = await auth();

    const appUserSystemId = session?.user?.id;

    if (!appUserSystemId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { instagramUserId } = body;

    if (!instagramUserId) {
      return NextResponse.json(
        { error: "Instagram User ID is required" },
        { status: 400 }
      );
    }

    // Verify that the Instagram account belongs to the authenticated user
    const connection = await db
      .select()
      .from(instagramConnections)
      .where(eq(instagramConnections.instagramUserId, instagramUserId))
      .limit(1);

    if (!connection.length) {
      return NextResponse.json(
        { error: "Instagram connection not found" },
        { status: 404 }
      );
    }

    if (connection[0].appUserId !== appUserSystemId) {
      return NextResponse.json(
        { error: "Unauthorized access to Instagram account" },
        { status: 403 }
      );
    }

    // Refresh the token
    const refreshResult = await refreshInstagramToken(instagramUserId);

    if (refreshResult.success) {
      return NextResponse.json({
        success: true,
        message: "Instagram Business token refreshed successfully",
        expiresAt: refreshResult.expiresAt
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: refreshResult.error
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Error in Instagram token refresh endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check token status
export async function GET(req: NextRequest) {
  try {
    // Use NextAuth 5 for authentication instead of iron-session
    const session = await auth();

    const appUserSystemId = session?.user?.id;

    if (!appUserSystemId) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const instagramUserId = searchParams.get("instagramUserId");

    if (!instagramUserId) {
      return NextResponse.json(
        { error: "Instagram User ID is required" },
        { status: 400 }
      );
    }

    // Get connection info
    const connection = await db
      .select()
      .from(instagramConnections)
      .where(eq(instagramConnections.instagramUserId, instagramUserId))
      .limit(1);

    if (!connection.length) {
      return NextResponse.json(
        { error: "Instagram connection not found" },
        { status: 404 }
      );
    }

    if (connection[0].appUserId !== appUserSystemId) {
      return NextResponse.json(
        { error: "Unauthorized access to Instagram account" },
        { status: 403 }
      );
    }

    const { accessTokenExpiresAt, instagramUsername } = connection[0];
    const now = new Date();
    const isExpired = accessTokenExpiresAt ? now >= accessTokenExpiresAt : false;
    const daysUntilExpiry = accessTokenExpiresAt 
      ? Math.ceil((accessTokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return NextResponse.json({
      instagramUserId,
      instagramUsername,
      expiresAt: accessTokenExpiresAt,
      isExpired,
      daysUntilExpiry,
      needsRefresh: daysUntilExpiry !== null && daysUntilExpiry <= 7
    });

  } catch (error) {
    console.error("Error in Instagram token status endpoint:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
} 