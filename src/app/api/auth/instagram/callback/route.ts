import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import { db } from "@/lib/db"; // Your Drizzle client instance
import { instagramConnections } from "@/db/schema"; // Your Drizzle schema for this table
// import { eq } from "drizzle-orm"; // Not strictly needed for upsert with onConflictDoUpdate

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// NEW: Instagram Business Login response format (2025)
interface InstagramBusinessTokenResponse {
  data: [{
    access_token: string;
    user_id: string; // Instagram-scoped user ID
    permissions: string; // Comma-separated permissions
  }];
}

interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Duration in seconds
}

interface InstagramMeResponse {
  id: string; // Instagram Business Account ID
  username: string;
  account_type?: "BUSINESS" | "CREATOR" | "PERSONAL";
}

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const receivedState = searchParams.get("state");

  console.log("Instagram Business Login callback - session before auth processing:", session);

  if (!code || !receivedState) {
    console.error("Missing code or state in Instagram Business Login callback.");
    return NextResponse.json(
      { error: "Invalid OAuth callback parameters." },
      { status: 400 }
    );
  }

  if (receivedState !== session.instagramOAuthState) {
    console.error(
      "Invalid OAuth state (CSRF detected). Stored:",
      session.instagramOAuthState,
      "Received:",
      receivedState
    );
    session.instagramOAuthState = undefined;
    await session.save();
    return NextResponse.json(
      { error: "Invalid OAuth state. CSRF detected." },
      { status: 403 }
    );
  }

  session.instagramOAuthState = undefined; // Clear the state

  try {
    // Step 1: Exchange code for short-lived Instagram Business User Access Token
    const tokenFormData = new URLSearchParams();
    tokenFormData.append("client_id", INSTAGRAM_CLIENT_ID!);
    tokenFormData.append("client_secret", INSTAGRAM_CLIENT_SECRET!);
    tokenFormData.append("grant_type", "authorization_code");
    tokenFormData.append("redirect_uri", INSTAGRAM_REDIRECT_URI!);
    tokenFormData.append("code", code);

    const shortLivedTokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenFormData,
      }
    );

    if (!shortLivedTokenResponse.ok) {
      const errorBody = await shortLivedTokenResponse
        .json()
        .catch(() => ({ message: "Unknown error fetching short-lived token" }));
      console.error(
        "Error fetching Instagram Business short-lived access token:",
        errorBody
      );
      await session.save();
      return NextResponse.json(
        {
          error: `Failed to get short-lived access token: ${
            errorBody.error_message || errorBody.message
          }`,
        },
        { status: shortLivedTokenResponse.status }
      );
    }

    // NEW: Handle Instagram Business Login response format
    const tokenResponseData = await shortLivedTokenResponse.json() as InstagramBusinessTokenResponse;
    const { access_token: shortLivedUserAccessToken, user_id: instagramUserId, permissions } = tokenResponseData.data[0];

    console.log("Instagram Business Login - Permissions granted:", permissions);
    console.log("Instagram Business Login - User ID:", instagramUserId);

    // Step 2: Exchange short-lived token for a long-lived token
    const longLivedTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedUserAccessToken}`
    );

    if (!longLivedTokenRes.ok) {
      const errorBody = await longLivedTokenRes
        .json()
        .catch(() => ({ message: "Unknown error fetching long-lived token" }));
      console.error(
        "Error exchanging for Instagram Business long-lived access token:",
        errorBody
      );
      await session.save();
      return NextResponse.json(
        {
          error: `Failed to get long-lived access token: ${
            errorBody.error?.message || errorBody.message
          }`,
        },
        { status: longLivedTokenRes.status }
      );
    }
    
    const { access_token: longLivedAccessToken, expires_in } =
      (await longLivedTokenRes.json()) as InstagramLongLivedTokenResponse;
    const accessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Step 3: Get the Instagram Business Account details using the long-lived token
    const meResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${longLivedAccessToken}`
    );

    if (!meResponse.ok) {
      const errorBody = await meResponse.json().catch(() => ({
        message: "Unknown error fetching Instagram Business profile (/me)",
      }));
      console.error("Error fetching Instagram Business profile (/me):", errorBody);
      await session.save();
      return NextResponse.json(
        {
          error: `Failed to get Instagram Business profile: ${
            errorBody.error?.message || errorBody.message
          }`,
        },
        { status: meResponse.status }
      );
    }
    
    const meData = (await meResponse.json()) as InstagramMeResponse;
    const instagramBusinessAccountId = meData.id;
    const instagramUsername = meData.username;

    console.log("Instagram Business Account ID:", instagramBusinessAccountId);
    console.log("Instagram Username:", instagramUsername);
    console.log("Account Type:", meData.account_type);

    // Step 4: Determine Application User ID and Store/Update credentials
    const appUserSystemId = session.appUser?.id; 

    if (!appUserSystemId) {
      console.error(
        "No application user ID found in session during Instagram Business callback. Cannot link account."
      );
      await session.save();
      return NextResponse.json(
        {
          error:
            "Application user session not found or incomplete. Please log in to the application first.",
        },
        { status: 401 }
      );
    }

    // Upsert: Insert if no record for this Instagram Business Account, otherwise update existing record
    await db
      .insert(instagramConnections)
      .values({
        appUserId: appUserSystemId,
        instagramUserId: instagramBusinessAccountId, // Use Business Account ID
        instagramUsername: instagramUsername,
        longLivedAccessToken: longLivedAccessToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        updatedAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: instagramConnections.instagramUserId,
        set: {
          appUserId: appUserSystemId,
          instagramUsername: instagramUsername,
          longLivedAccessToken: longLivedAccessToken,
          accessTokenExpiresAt: accessTokenExpiresAt,
          updatedAt: new Date(),
        },
      });

    // Clear any old Instagram-specific tokens from session
    delete session.instagramAccessToken;
    delete session.instagramUserId;

    await session.save();

    const redirectResponse = NextResponse.redirect(
      `${APP_URL}/dashboard?instagram_business_linked=true&user=${appUserSystemId}&account_type=${meData.account_type || 'BUSINESS'}`
    );
    
    return redirectResponse;
  } catch (error) {
    console.error("Error in Instagram Business Login callback processing:", error);
    if (session.instagramOAuthState) {
      session.instagramOAuthState = undefined;
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";

    try {
      await session.save();
      const errorResponse = NextResponse.json(
        { error: `Instagram Business Login callback processing error: ${errorMessage}` },
        { status: 500 }
      );
      return errorResponse;
    } catch (sealError) {
      console.error("Failed to seal session on error path:", sealError);
      return NextResponse.json(
        {
          error: `Instagram Business Login callback processing error: ${errorMessage}`,
        },
        { status: 500 }
      );
    }
  }
}
