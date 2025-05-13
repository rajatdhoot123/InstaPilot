import { NextRequest, NextResponse } from "next/server";
import { getAppRouterSession } from "@/lib/session";

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface FacebookPageAccount {
  access_token: string; // This is the Page Access Token
  category: string;
  name: string;
  id: string; // This is the Page ID
  tasks: string[];
}

interface FacebookAccountsResponse {
  data: FacebookPageAccount[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
  };
}

interface InstagramBusinessAccountResponse {
  instagram_business_account?: {
    id: string; // This is the Instagram Business Account ID (instagramUserId)
  };
  id: string; // Page ID
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
    // Clear the potentially compromised state
    session.instagramOAuthState = undefined;
    await session.save();
    return NextResponse.json({ error: "Invalid OAuth state. CSRF detected." }, { status: 403 });
  }

  // Clear the used state from session
  session.instagramOAuthState = undefined;
  // We will save session later after storing tokens

  try {
    // Step 1: Exchange code for a User Access Token
    const tokenParams = new URLSearchParams({
      client_id: INSTAGRAM_CLIENT_ID,
      client_secret: INSTAGRAM_CLIENT_SECRET,
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code: code,
      grant_type: "authorization_code", // This is for user access token
    });

    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`, {
      method: "POST",
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.json().catch(() => ({ message: "Unknown error fetching user token" }));
      console.error("Error fetching Facebook user access token:", errorBody);
      return NextResponse.json({ error: `Failed to get access token: ${errorBody.error?.message || errorBody.message}` }, { status: tokenResponse.status });
    }

    const { access_token: userAccessToken } = await tokenResponse.json() as FacebookTokenResponse;
    if (!userAccessToken) {
      console.error("User Access Token not found in response from Facebook");
      return NextResponse.json({ error: "Failed to retrieve user access token." }, { status: 500 });
    }

    // Step 2: Get the list of Pages the user manages (this includes Page Access Tokens)
    const accountsResponse = await fetch(`https://graph.facebook.com/me/accounts?access_token=${userAccessToken}`);
    if (!accountsResponse.ok) {
      const errorBody = await accountsResponse.json().catch(() => ({ message: "Unknown error fetching accounts" }));
      console.error("Error fetching Facebook accounts/pages:", errorBody);
      return NextResponse.json({ error: `Failed to get user pages: ${errorBody.error?.message || errorBody.message}` }, { status: accountsResponse.status });
    }
    const accountsData = await accountsResponse.json() as FacebookAccountsResponse;

    if (!accountsData.data || accountsData.data.length === 0) {
      return NextResponse.json({ error: "No Facebook Pages found for this user or insufficient permissions." }, { status: 404 });
    }

    // Step 3: Find a Page with an Instagram Business Account and get its ID and Page Access Token
    let foundPageAccessToken: string | undefined;
    let foundInstagramUserId: string | undefined;
    let foundPageId: string | undefined;

    for (const page of accountsData.data) {
      // Ensure the page permissions allow Instagram posting (usually "CREATE_CONTENT", "MANAGE", "MODERATE" under tasks)
      // For simplicity, we'll try to get the instagram_business_account for the first page that has one.
      // You might want a UI for the user to select which page/IG account if they have multiple.
      const igAccountResponse = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
      
      if (igAccountResponse.ok) {
        const igAccountData = await igAccountResponse.json() as InstagramBusinessAccountResponse;
        if (igAccountData.instagram_business_account?.id) {
          foundPageAccessToken = page.access_token; // This is the Page Access Token for the page connected to IG
          foundInstagramUserId = igAccountData.instagram_business_account.id;
          foundPageId = page.id;
          break; // Found what we need
        }
      } else {
        console.warn(`Could not fetch Instagram account for page ${page.id} (${page.name}), status: ${igAccountResponse.status}`);
      }
    }

    if (!foundPageAccessToken || !foundInstagramUserId) {
      return NextResponse.json({ error: "Could not find an Instagram Business Account connected to any of the user's Facebook Pages, or insufficient permissions." }, { status: 404 });
    }

    // Store the Page Access Token (as graphApiAccessToken) and Instagram User ID in session
    session.instagramGraphApi = {
      graphApiAccessToken: foundPageAccessToken,
      instagramUserId: foundInstagramUserId,
      pageId: foundPageId,
    };
    session.isLoggedIn = true; // Mark user as logged in via Instagram
    await session.save();

    // Redirect to a success page or dashboard
    return NextResponse.redirect(`${APP_URL}/dashboard?instagram_linked=true`); // Adjust redirect as needed
  } catch (error) {
    console.error("Error in Instagram OAuth callback:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: `Callback processing error: ${errorMessage}` }, { status: 500 });
  }
}
