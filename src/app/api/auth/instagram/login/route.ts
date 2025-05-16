import { NextResponse, type NextRequest } from "next/server";
// passport import might be removed if not used elsewhere in this file or subsequent logic
// import passport from "@/lib/passport";
// AuthenticateOptions will be removed as passport.authenticate is not called this way anymore
// import type { AuthenticateOptions } from "passport";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session"; // Ensure SessionData is correctly typed here
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

// The MockResAdapter interface is no longer needed
// interface MockResAdapter { ... }

// Keeping _req as it is standard for Next.js route handlers, even if unused.
export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  // 2. Get necessary environment variables
  const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
  const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;

  if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_REDIRECT_URI) {
    console.error(
      "Missing Instagram OAuth environment variables: INSTAGRAM_CLIENT_ID or INSTAGRAM_REDIRECT_URI"
    );
    return NextResponse.json(
      { error: "Server configuration error for Instagram OAuth." },
      { status: 500 }
    );
  }

  // 3. Generate and store CSRF state
  const state = randomBytes(16).toString("hex");
  session.instagramOAuthState = state;
  await session.save();

  const scopes = [
    "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights",
  ];

  // 5. Construct the Instagram authorization URL
  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: scopes.join(" "), // Scopes are space-separated for Instagram Basic Display API
    response_type: "code",
    state: state,
  });

  const authorizationUrl = `https://api.instagram.com/oauth/authorize?${params.toString()}`;

  // 6. Redirect to Instagram
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
