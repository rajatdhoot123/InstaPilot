import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { randomBytes } from "crypto";

export async function GET() {
  // Check if user is authenticated with NextAuth 5
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "User not authenticated. Please log in to the application first." },
      { status: 401 }
    );
  }
  
  // Get necessary environment variables
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

  // Generate CSRF state (simplified - not stored in session)
  // In production, you might want to store this in a database with expiration
  // or use signed tokens for better security
  const state = randomBytes(16).toString("hex");

  // NEW 2025 Instagram Business Login scopes (replacing deprecated ones)
  const scopes = [
    "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights",
  ];

  // Construct the Instagram Business authorization URL
  const params = new URLSearchParams({
    client_id: INSTAGRAM_CLIENT_ID,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: scopes.join(","), // Comma-separated for Instagram Business Login
    response_type: "code",
    state: state,
    // Optional: force authentication for business accounts
    force_authentication: "1",
    enable_fb_login: "0"
  });

  // NEW: Use Instagram Business Login endpoint (not Basic Display API)
  const authorizationUrl = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

  console.log("Redirecting to Instagram Business Login:", authorizationUrl);
  
  return NextResponse.redirect(authorizationUrl);
}
