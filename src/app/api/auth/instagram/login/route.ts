import { NextRequest, NextResponse } from "next/server";
// passport import might be removed if not used elsewhere in this file or subsequent logic
// import passport from "@/lib/passport";
// AuthenticateOptions will be removed as passport.authenticate is not called this way anymore
// import type { AuthenticateOptions } from "passport";
import {
  getIronSession,
  type IronSessionData as SessionData,
} from "iron-session";
import { sessionOptions } from "@/lib/session";
import { cookies } from "next/headers";

// The MockResAdapter interface is no longer needed
// interface MockResAdapter { ... }

// Keeping _req as it is standard for Next.js route handlers, even if unused.
export async function GET(req: NextRequest) {
  const scopes = [
    "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights",
  ];

  // Ensure these environment variable names match your setup
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  // This is the common endpoint for Instagram Graph API. Verify if your specific setup or scopes require a different one (e.g., Facebook\'s).\
  const instagramAuthEndpoint = "https://api.instagram.com/oauth/authorize";

  if (!clientId || !redirectUri) {
    console.error(
      "Instagram OAuth environment variables (INSTAGRAM_CLIENT_ID, INSTAGRAM_CALLBACK_URL) are not set."
    );
    return NextResponse.json(
      { message: "Server configuration error for Instagram OAuth." },
      { status: 500 }
    );
  }

  // Using intersection type for session to include instagramOAuthState locally.
  // The definitive solution is to update the global SessionData type.
  const session = await getIronSession<
    SessionData & { instagramOAuthState?: string }
  >(await cookies(), sessionOptions);

  // Generate state for CSRF protection
  const state = globalThis.crypto.randomUUID();
  session.instagramOAuthState = state;
  await session.save();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(","), // Instagram Graph API uses comma-separated scopes
    response_type: "code",
    state: state,
  });

  const authorizationUrl = new URL(
    `${instagramAuthEndpoint}?${params.toString()}`
  );

  console.log({ authorizationUrl });
  return NextResponse.redirect(authorizationUrl);
}

// The original complex Promise-based structure with mockResAdapter and passportMiddleware is removed.
// ... existing code ...
// Note: The `withSessionRoute` HOC from the original code was for Pages API routes.
// In App Router, session handling is typically done using `getIronSession` (or similar)
// directly within the route handler, as shown with `getIronSession<SessionData>(req, sessionOptions)`.
// If `withSessionRoute` has been adapted for App Router, you might wrap the export:
// export const GET = withSessionRoute(GET_handler_function);
// But the example above integrates session handling directly.
// For passport, it\'s crucial that `req.session` is available if the strategy uses it,
// even if `AuthenticateOptions.session` is false for the initial redirect.
// The `sessionOptions` should be correctly configured for App Router\'s `NextRequest`.
