import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session"; // Assuming session management is similar
import { cookies } from "next/headers";

// Define the structure of the Instagram credentials as stored in your database
// This is a conceptual type; actual implementation depends on your DB schema
interface UserInstagramCredentials {
  instagramUserId: string;
  longLivedAccessToken: string;
  accessTokenExpiresAt?: Date | number; // Optional: useful for refresh logic
}

// Your application's session data
type SessionData = {
  currentUser?: {
    id: string; // Your application's internal user ID
    // other app-specific user details
  };
  // We will NO LONGER store instagramAccessToken or instagramUserId directly here
  // for a multi-user setup. That data will be fetched from your database.
  [key: string]: unknown;
};

interface PostRequestBody {
  imageUrl: string; // Publicly accessible URL of the JPEG image
  caption?: string;
}

// Conceptual function to fetch Instagram credentials from your database
// You would implement this using your database client (e.g., Prisma, Supabase, etc.)
async function getInstagramCredentialsForUser(
  applicationUserId: string
): Promise<UserInstagramCredentials | null> {
  console.log(
    `Attempting to fetch Instagram credentials for application user ID: ${applicationUserId}`
  );
  // TODO: Replace this with actual database lookup logic
  // Example:
  // const credentials = await db.userInstagramConnections.findUnique({
  //   where: { applicationUserId },
  //   select: { instagramUserId: true, longLivedAccessToken: true, accessTokenExpiresAt: true },
  // });
  // if (credentials && new Date(credentials.accessTokenExpiresAt) > new Date()) { // Check expiry
  //   return credentials;
  // }
  // If token is expired, you might trigger a refresh flow here or return null.
  // For this example, we'll return a placeholder.
  // In a real app, if credentials are not found or expired, the user needs to (re)connect.

  // Placeholder: Simulating fetching credentials.
  // Replace with your actual database logic.
  if (applicationUserId === "user123-from-session") { // Example user ID
    return {
      // These would come from your DB, stored after OAuth
      instagramUserId: process.env.PLACEHOLDER_INSTAGRAM_USER_ID || "default_ig_user_id_from_db",
      longLivedAccessToken: process.env.PLACEHOLDER_INSTAGRAM_GRAPH_API_ACCESS_TOKEN || "default_long_lived_token_from_db",
      // accessTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // e.g., 60 days from now
    };
  }
  return null;
}


export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  console.log("Current session:", JSON.stringify(session, null, 2));

  if (!session.currentUser?.id) {
    return NextResponse.json(
      {
        error:
          "User not authenticated in the application. Please log in.",
      },
      { status: 401 }
    );
  }
  const applicationUserId = session.currentUser.id;

  // Fetch Instagram credentials for the currently logged-in application user
  const userCredentials = await getInstagramCredentialsForUser(applicationUserId);

  if (!userCredentials) {
    return NextResponse.json(
      {
        error:
          "Instagram account not connected or credentials expired for this user. Please connect or re-authorize your Instagram account through your profile settings.",
      },
      { status: 403 } // 403 Forbidden or 401 Unauthorized might be appropriate
    );
  }

  const { longLivedAccessToken: graphApiAccessToken, instagramUserId } = userCredentials;

  console.log(`Using Instagram User ID: ${instagramUserId} for app user: ${applicationUserId}`);

  try {
    const body: PostRequestBody = await req.json();
    const { imageUrl, caption } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required." },
        { status: 400 }
      );
    }

    try {
      new URL(imageUrl);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      return NextResponse.json(
        { error: "Invalid image URL format." },
        { status: 400 }
      );
    }

    // Step 1: Create Media Container
    // Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing#create-a-container
    const createContainerUrl = `https://graph.instagram.com/v19.0/${instagramUserId}/media`; // Use latest stable API version
    
    const containerPayload: { image_url: string; caption?: string; access_token: string } = {
      image_url: imageUrl,
      access_token: graphApiAccessToken, // Token can also be sent as a query param
    };
    if (caption) {
      containerPayload.caption = caption;
    }

    // Note: Instagram API sometimes prefers access_token in the payload for POST media.
    // Alternatively, it can be in the Authorization header. The docs show examples with it in payload for /media.
    // For /media_publish, Authorization header is standard.
    // For consistency and to avoid issues, let's ensure Authorization header is also set correctly if needed,
    // but for /media, the token in payload is a common pattern.

    console.log("Creating media container with payload:", { imageUrl: containerPayload.image_url, caption: containerPayload.caption }); // Don't log token

    const containerResponse = await fetch(createContainerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Authorization header might not be strictly needed if token is in payload for this specific call
        // "Authorization": `Bearer ${graphApiAccessToken}`,
      },
      body: JSON.stringify(containerPayload),
    });

    if (!containerResponse.ok) {
      const errorBody = await containerResponse.json().catch(() => ({
        error: { message: "Failed to create media container and couldn't parse error response." },
      }));
      console.error("Error creating media container:", errorBody);
      // TODO: Implement token refresh logic if error indicates an expired/invalid token
      // e.g., if (errorBody.error?.code === 190 || (errorBody.error?.error_subcode === 463 || errorBody.error?.error_subcode === 467) ) { /* User token expired, needs re-auth or refresh */ }
      return NextResponse.json(
        {
          error: `Failed to create media container. Status: ${containerResponse.status}. Message: ${errorBody.error?.message || JSON.stringify(errorBody)}`,
        },
        { status: containerResponse.status }
      );
    }

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    if (!creationId) {
      console.error("Creation ID not found in container response:", containerData);
      return NextResponse.json(
        { error: "Media container created, but creation ID was not returned." },
        { status: 500 }
      );
    }
    console.log(`Media container created with ID: ${creationId}`);

    // Step 2: Publish Media Container
    // Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing#publish-the-container
    const publishMediaUrl = `https://graph.instagram.com/v19.0/${instagramUserId}/media_publish`;
    
    const publishPayload = {
      creation_id: creationId,
      access_token: graphApiAccessToken, // Token can also be sent as a query param for this call
    };

    console.log("Publishing media with creation ID:", creationId);

    const publishResponse = await fetch(publishMediaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
         // "Authorization": `Bearer ${graphApiAccessToken}`, // Or include access_token in body
      },
      body: JSON.stringify(publishPayload),
    });

    if (!publishResponse.ok) {
      const errorBody = await publishResponse.json().catch(() => ({
        error: { message: "Failed to publish media and couldn't parse error response." },
      }));
      console.error("Error publishing media:", errorBody);
      // TODO: Implement token refresh logic if error indicates an expired/invalid token
      // e.g., if (errorBody.error?.code === 190 || (errorBody.error?.error_subcode === 463 || errorBody.error?.error_subcode === 467) ) { /* User token expired, needs re-auth or refresh */ }
      return NextResponse.json(
        {
          error: `Failed to publish media. Status: ${publishResponse.status}. Message: ${errorBody.error?.message || JSON.stringify(errorBody)}`,
          creationId: creationId, // Return creation_id for potential manual retry or status check
        },
        { status: publishResponse.status }
      );
    }

    const publishData = await publishResponse.json();
    console.log("Media published successfully:", publishData);

    return NextResponse.json(
      {
        message: "Photo posted successfully!",
        postId: publishData.id, // Instagram Media ID
      },
      { status: 200 }
    );
  } catch (error) {
    const e = error as Error;
    console.error("Error in Instagram post API:", e);
    return NextResponse.json(
      { error: e.message || "An unknown error occurred while posting to Instagram." },
      { status: 500 }
    );
  }
} 