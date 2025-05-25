import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db"; // Your Drizzle client instance
import { instagramConnections } from "@/db/schema"; // Your Drizzle schema for this table

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// NEW: Instagram Business Login response format (2025)
interface InstagramBusinessTokenResponse {
  data: [
    {
      access_token: string;
      user_id: string; // Instagram-scoped user ID
      permissions: string; // Comma-separated permissions
    }
  ];
}

// Alternative Instagram token response format (direct format)
interface InstagramDirectTokenResponse {
  access_token: string;
  user_id: string;
  permissions?: string | string[]; // Can be string or array
}

// Union type for all possible Instagram token response formats
type InstagramTokenResponse =
  | InstagramBusinessTokenResponse
  | InstagramDirectTokenResponse;

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
  // Use NextAuth 5 for authentication instead of iron-session
  const session = await auth();

  if (!session?.user?.id) {
    console.error(
      "No authenticated user found during Instagram Business callback"
    );
    return NextResponse.json(
      {
        error:
          "User not authenticated. Please log in to the application first.",
      },
      { status: 401 }
    );
  }

  const appUserSystemId = session.user.id;
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const receivedState = searchParams.get("state");

  console.log(
    "Instagram Business Login callback - authenticated user:",
    appUserSystemId
  );

  if (!code || !receivedState) {
    console.error(
      "Missing code or state in Instagram Business Login callback."
    );
    return NextResponse.json(
      { error: "Invalid OAuth callback parameters." },
      { status: 400 }
    );
  }

  // Simplified state validation - you could store state in database or use signed tokens
  // For now, we'll just check that state exists (basic CSRF protection)
  if (!receivedState || receivedState.length < 16) {
    console.error("Invalid OAuth state received:", receivedState);
    return NextResponse.json(
      { error: "Invalid OAuth state. CSRF detected." },
      { status: 403 }
    );
  }

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
      return NextResponse.json(
        {
          error: `Failed to get short-lived access token: ${
            errorBody.error_message || errorBody.message
          }`,
        },
        { status: shortLivedTokenResponse.status }
      );
    }

    // NEW: Handle Instagram Business Login response format (2025)
    const tokenResponseData =
      (await shortLivedTokenResponse.json()) as InstagramTokenResponse;
    console.log(
      "Instagram Business Login - Token response data:",
      tokenResponseData
    );

    // Handle different response formats from Instagram API
    let shortLivedUserAccessToken: string;
    let instagramUserId: string;
    let permissions: string;

    // Type guard to check if it's the business format
    if (
      "data" in tokenResponseData &&
      Array.isArray(tokenResponseData.data) &&
      tokenResponseData.data.length > 0
    ) {
      // New Instagram Business Login format
      const businessResponse =
        tokenResponseData as InstagramBusinessTokenResponse;
      ({
        access_token: shortLivedUserAccessToken,
        user_id: instagramUserId,
        permissions,
      } = businessResponse.data[0]);
    } else if (
      "access_token" in tokenResponseData &&
      "user_id" in tokenResponseData
    ) {
      // Direct format (fallback)
      const directResponse = tokenResponseData as InstagramDirectTokenResponse;
      shortLivedUserAccessToken = directResponse.access_token;
      instagramUserId = directResponse.user_id;
      // Handle permissions as either string or array
      if (Array.isArray(directResponse.permissions)) {
        permissions = directResponse.permissions.join(",");
      } else {
        permissions = directResponse.permissions || "";
      }
    } else {
      console.error(
        "Unexpected Instagram token response format:",
        tokenResponseData
      );
      return NextResponse.json(
        {
          error: "Unexpected response format from Instagram API",
        },
        { status: 500 }
      );
    }

    console.log("Instagram Business Login - Permissions granted:", permissions);
    console.log("Instagram Business Login - User ID:", instagramUserId);

    // Step 2: Exchange short-lived token for a long-lived token (using GET)
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
      console.error(
        "Error fetching Instagram Business profile (/me):",
        errorBody
      );
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

    // Step 4: Store/Update credentials in database
    console.log("App User System ID:", appUserSystemId);

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

    const redirectResponse = NextResponse.redirect(
      `${APP_URL}/dashboard?instagram_business_linked=true&user=${appUserSystemId}&account_type=${
        meData.account_type || "BUSINESS"
      }`
    );

    return redirectResponse;
  } catch (error) {
    console.error(
      "Error in Instagram Business Login callback processing:",
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";

    return NextResponse.json(
      {
        error: `Instagram Business Login callback processing error: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
