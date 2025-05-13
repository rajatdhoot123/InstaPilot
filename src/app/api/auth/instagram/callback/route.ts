import { NextRequest, NextResponse } from "next/server";
import { getAppRouterSession, sessionOptions } from "@/lib/session";
import { sealData } from "iron-session";

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Changed: Interface for the Instagram Basic Display API token response
interface InstagramTokenResponse {
  access_token: string;
  user_id: number; // This is the Instagram User ID
}

export async function GET(req: NextRequest) {
  if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET || !INSTAGRAM_REDIRECT_URI) {
    console.error("Missing Instagram OAuth environment variables for callback.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const session = await getAppRouterSession();
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    console.error("Missing code or state in Instagram OAuth callback.");
    return NextResponse.json({ error: "Invalid OAuth callback parameters." }, { status: 400 });
  }

  if (state !== session.instagramOAuthState) {
    console.error("Invalid OAuth state (CSRF potential), stored:", session.instagramOAuthState, "received:", state);
    session.instagramOAuthState = undefined;

    // Manually seal and set cookie
    const sealed = await sealData(session, {
      password: sessionOptions.password,
      ttl: sessionOptions.ttl,
    });
    const response = NextResponse.json({ error: "Invalid OAuth state. CSRF detected." }, { status: 403 });
    response.cookies.set(sessionOptions.cookieName, sealed, sessionOptions.cookieOptions);
    return response;
  }

  session.instagramOAuthState = undefined;

  try {
    // Step 1: Exchange code for an Instagram User Access Token
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('client_id', INSTAGRAM_CLIENT_ID);
    tokenFormData.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    tokenFormData.append('grant_type', 'authorization_code');
    tokenFormData.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
    tokenFormData.append('code', code);

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
      const errorBody = await tokenResponse.json().catch(() => ({ message: "Unknown error fetching user token" }));
      console.error("Error fetching Instagram user access token:", errorBody);
      // Instagram API often returns error details in errorBody.error_type, errorBody.code, errorBody.error_message
      const errorMessage = errorBody.error_message || errorBody.message || "Failed to get access token";
      return NextResponse.json({ error: `Failed to get access token: ${errorMessage}` }, { status: tokenResponse.status });
    }

    const { access_token: userAccessToken, user_id: instagramUserId } = await tokenResponse.json() as InstagramTokenResponse;

    if (!userAccessToken || !instagramUserId) {
      console.error("User Access Token or User ID not found in response from Instagram");
      return NextResponse.json({ error: "Failed to retrieve user access token or user ID." }, { status: 500 });
    }

    // Store the Instagram User Access Token and Instagram User ID in session
    // Ensure session object structure is updated accordingly in your session library if needed
    session.instagramAccessToken = userAccessToken;
    session.instagramUserId = instagramUserId.toString(); // Store as string for consistency
    
    session.isLoggedIn = true;

    // Manually seal and set cookie for success path
    const sealedFinalSession = await sealData(session, {
      password: sessionOptions.password,
      ttl: sessionOptions.ttl,
    });

    const redirectResponse = NextResponse.redirect(`${APP_URL}/dashboard?instagram_linked=true`);
    redirectResponse.cookies.set(sessionOptions.cookieName, sealedFinalSession, sessionOptions.cookieOptions);
    return redirectResponse;
  } catch (error) {
    console.error("Error in Instagram OAuth callback:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: `Callback processing error: ${errorMessage}` }, { status: 500 });
  }
}
