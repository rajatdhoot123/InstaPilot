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

interface InstagramShortLivedTokenResponse {
  access_token: string;
  user_id: number; // This is the basic Instagram User ID
}

interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Duration in seconds
}

interface InstagramMeResponse {
  id: string; // This is the Instagram User ID (can be Professional Account ID)
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

  console.log("session before auth processing:", session); // Log initial session state

  if (!code || !receivedState) {
    console.error("Missing code or state in Instagram OAuth callback.");
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
    // Step 1: Exchange code for a short-lived Instagram User Access Token
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
        "Error fetching Instagram short-lived access token:",
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
    const { access_token: shortLivedUserAccessToken } =
      (await shortLivedTokenResponse.json()) as InstagramShortLivedTokenResponse;

    // Step 2: Exchange short-lived token for a long-lived token
    const longLivedTokenRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_CLIENT_SECRET!}&access_token=${shortLivedUserAccessToken}`
    );
    if (!longLivedTokenRes.ok) {
      const errorBody = await longLivedTokenRes
        .json()
        .catch(() => ({ message: "Unknown error fetching long-lived token" }));
      console.error(
        "Error exchanging for Instagram long-lived access token:",
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

    // Step 3: Get the Instagram User ID (Professional ID) and username using the long-lived token
    const meResponse = await fetch(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${longLivedAccessToken}`
    );

    if (!meResponse.ok) {
      const errorBody = await meResponse.json().catch(() => ({
        message: "Unknown error fetching user profile (/me)",
      }));
      console.error("Error fetching Instagram user profile (/me):", errorBody);
      // Session might have been modified (e.g., CSRF state cleared), so save it.
      await session.save();
      return NextResponse.json(
        {
          error: `Failed to get Instagram user profile: ${
            errorBody.error?.message || errorBody.message
          }`,
        },
        { status: meResponse.status }
      );
    }
    const meData = (await meResponse.json()) as InstagramMeResponse;
    const instagramProfessionalId = meData.id;
    const instagramSourceUsername = meData.username; // Username from Instagram

    // Step 4: Determine Application User ID and Store/Update credentials
    const appUserSystemId = session.appUser?.id; 

    if (!appUserSystemId) {
      // This is a critical point. If there's no appUser in session, or appUser.id is missing,
      // you need a strategy to link this new Instagram connection to an application user.
      // This typically means the user isn't properly logged into your main application.
      console.error(
        "No application user ID found in session during Instagram callback. Cannot link account."
      );
      // Session might have been modified (e.g., CSRF state cleared), so save it.
      await session.save();
      return NextResponse.json(
        {
          error:
            "Application user session not found or incomplete. Please log in to the application first.",
        },
        { status: 401 } // Unauthorized or Bad Request
      );
    }

    // Upsert: Insert if no record for this instagramProfessionalId, otherwise update existing record.
    // This assumes 'instagramUserId' is a UNIQUE column in your 'instagramConnections' table.
    await db
      .insert(instagramConnections)
      .values({
        appUserId: appUserSystemId, // Link to your application user
        instagramUserId: instagramProfessionalId, // Instagram's user identifier
        instagramUsername: instagramSourceUsername, // Store Instagram username
        longLivedAccessToken: longLivedAccessToken,
        accessTokenExpiresAt: accessTokenExpiresAt,
        updatedAt: new Date(),
        createdAt: new Date(), // Explicitly set createdAt on new insert
      })
      .onConflictDoUpdate({
        target: instagramConnections.instagramUserId, // Conflict target is now instagramUserId
        set: {
          appUserId: appUserSystemId, // Ensure appUserId is set/updated on conflict too
          instagramUsername: instagramSourceUsername, // Update username on conflict too
          longLivedAccessToken: longLivedAccessToken,
          accessTokenExpiresAt: accessTokenExpiresAt,
          updatedAt: new Date(),
          // We typically DO NOT update applicationUserId here unless ensuring it IS set.
          // The link, once made, should be to the same application user.
          // If 'applicationUserId' could be NULL before and needs setting on conflict, add it to 'set'.
        },
      });

    // Clear any old Instagram-specific tokens from session if they existed,
    // as primary token storage is now the database.
    delete session.instagramAccessToken;
    delete session.instagramUserId;
    // session.instagramConnected = true; // You might set this flag

    // session.isLoggedIn should now be true, managed by session.appUser being set.
    // session.isLoggedIn = true; // This depends on how your SessionData tracks login

    // Save the session, which now includes appUser reflecting the logged-in state.
    await session.save();

    const redirectResponse = NextResponse.redirect(
      `${APP_URL}/dashboard?instagram_linked=true&user=${appUserSystemId}` // Added user for clarity
    );
    // Cookies are handled by session.save() with iron-session in App Router
    return redirectResponse;
  } catch (error) {
    console.error("Error in Instagram OAuth callback processing:", error);
    if (session.instagramOAuthState) {
      session.instagramOAuthState = undefined;
      // Attempt to save session to clear CSRF state even on error
      // Errors during this save are caught by the outer try-catch's final block if sealError occurs.
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";

    try {
      await session.save(); // Save session to clear CSRF or other states
      const errorResponse = NextResponse.json(
        { error: `Callback processing error: ${errorMessage}` },
        { status: 500 }
      );
      // Cookies handled by session.save()
      return errorResponse;
    } catch (sealError) {
      console.error("Failed to seal session on error path:", sealError);
      return NextResponse.json(
        {
          error: `Callback processing error: ${errorMessage}`,
        },
        { status: 500 }
      );
    }
  }
}
