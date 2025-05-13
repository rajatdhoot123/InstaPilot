import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { cookies } from "next/headers";

// Define a more specific SessionData type
interface InstagramUserSessionData {
  id: string;
  username?: string; // Optional: if you plan to store it
  // Add any other app-specific user properties
}

type SessionData = {
  user?: InstagramUserSessionData;
  // You can add other session properties here, Record<string,any> is removed for better type safety
  [key: string]: unknown; // Retain flexibility for other non-user session data if needed, but be specific if possible
};

// Define interfaces for Instagram API responses
interface InstagramTokenResponse {
  access_token: string;
  user_id: number; // Instagram Basic Display API returns user_id as number
}

interface InstagramUserResponse {
  id: string; // This is the user_id as a string
  username: string;
  // Add other fields you might request, e.g., account_type, media_count
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );
  const forcedBaseUrl = "https://ski-instrumental-related-peer.trycloudflare.com";

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _state = searchParams.get("state"); // For CSRF protection
  // const storedState = session.oauthState; // Example: if you stored state in session

  // TODO: Verify the 'state' parameter against a stored value to prevent CSRF attacks.
  // if (!state || state !== storedState) {
  //   throw new Error("Invalid state parameter for CSRF protection.");
  // }
  // delete session.oauthState; // Clean up state from session

  if (!code) {
    const errorRedirectUrl = new URL("/login", forcedBaseUrl);
    errorRedirectUrl.searchParams.set(
      "error",
      encodeURIComponent("Authorization code not found in callback.")
    );
    return NextResponse.redirect(errorRedirectUrl);
  }

  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error(
      "Instagram API credentials are not configured in environment variables."
    );
    const configErrorRedirectUrl = new URL("/login", forcedBaseUrl);
    configErrorRedirectUrl.searchParams.set(
      "error",
      encodeURIComponent("Server configuration error for Instagram login.")
    );
    return NextResponse.redirect(configErrorRedirectUrl);
  }

  try {
    // 1. Exchange authorization code for an access token
    const tokenFormData = new URLSearchParams();
    tokenFormData.append("client_id", clientId);
    tokenFormData.append("client_secret", clientSecret);
    tokenFormData.append("grant_type", "authorization_code");
    tokenFormData.append("redirect_uri", redirectUri);
    tokenFormData.append("code", code);

    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenFormData,
      }
    );

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.json().catch(() => ({
        error_message:
          "Failed to exchange token and couldn't parse error response.",
      }));
      throw new Error(
        `Failed to exchange authorization code for token. Status: ${
          tokenResponse.status
        }. Message: ${errorBody.error_message || JSON.stringify(errorBody)}`
      );
    }

    const tokenData = (await tokenResponse.json()) as InstagramTokenResponse;

    // 2. Fetch user profile from Instagram Graph API (Basic Display API)
    // Note: Instagram Basic Display API uses user_id (number) with the access_token to get user profile.
    // The /me endpoint uses the access token directly for the authenticated user.
    const userProfileUrl = `https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`;
    const userProfileResponse = await fetch(userProfileUrl);

    if (!userProfileResponse.ok) {
      const errorBody = await userProfileResponse.json().catch(() => ({
        error_message:
          "Failed to fetch user profile and couldn't parse error response.",
      }));
      throw new Error(
        `Failed to fetch user profile. Status: ${
          userProfileResponse.status
        }. Message: ${errorBody.error_message || JSON.stringify(errorBody)}`
      );
    }

    const userData =
      (await userProfileResponse.json()) as InstagramUserResponse;

    // 3. Store user information in the session
    session.user = {
      id: userData.id, // Instagram returns ID as string from graph.instagram.com/me
      username: userData.username,
    };
    await session.save();

    // Successful authentication, redirect to dashboard
    const successRedirectUrl = new URL("/dashboard", forcedBaseUrl);
    return NextResponse.redirect(successRedirectUrl);
  } catch (error) {
    const e = error as Error;
    console.error("Error in Instagram callback:", e.message);

    const catchErrorRedirectUrl = new URL("/login", forcedBaseUrl);
    catchErrorRedirectUrl.searchParams.set(
      "error",
      encodeURIComponent(e.message || "Instagram login failed")
    );
    return NextResponse.redirect(catchErrorRedirectUrl);
  }
}
