import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session"; // Assuming session management is similar
import { cookies } from "next/headers";

// Placeholder for session data structure for Instagram Graph API
// This would ideally store the Graph API access token and IG User ID
interface InstagramGraphApiSessionData {
  graphApiAccessToken?: string;
  instagramUserId?: string; // This is the Instagram Professional Account ID
  // other relevant user details
}

// Adjust SessionData if needed, or use a more specific type for this route
type SessionData = {
  user?: any; // Keep existing user session structure if needed
  instagramGraphApi?: InstagramGraphApiSessionData;
  [key: string]: unknown;
};

interface PostRequestBody {
  imageUrl: string; // Publicly accessible URL of the JPEG image
  caption?: string;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  // TODO: Securely retrieve the Instagram Graph API access token and IG User ID.
  // This might come from the session if a Facebook Login flow for content publishing
  // has been implemented and these details are stored.
  // For now, using placeholders. Replace with actual retrieval logic.
  const graphApiAccessToken = session.instagramGraphApi?.graphApiAccessToken || process.env.PLACEHOLDER_INSTAGRAM_GRAPH_API_ACCESS_TOKEN;
  const instagramUserId = session.instagramGraphApi?.instagramUserId || process.env.PLACEHOLDER_INSTAGRAM_USER_ID;

  if (!graphApiAccessToken || !instagramUserId) {
    return NextResponse.json(
      {
        error:
          "Instagram Graph API credentials not found. Please ensure you have authenticated with Facebook and granted necessary permissions.",
      },
      { status: 401 }
    );
  }

  try {
    const body: PostRequestBody = await req.json();
    const { imageUrl, caption } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required." },
        { status: 400 }
      );
    }

    // Validate imageUrl format (basic check)
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
    const createContainerUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media`; // Use latest stable API version
    
    const containerParams = new URLSearchParams({
      access_token: graphApiAccessToken,
      image_url: imageUrl,
    });
    if (caption) {
      containerParams.append("caption", caption);
    }

    const containerResponse = await fetch(createContainerUrl, {
      method: "POST",
      body: containerParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!containerResponse.ok) {
      const errorBody = await containerResponse.json().catch(() => ({
        error_message: "Failed to create media container and couldn\'t parse error response.",
      }));
      console.error("Error creating media container:", errorBody);
      return NextResponse.json(
        {
          error: `Failed to create media container. Status: ${containerResponse.status}. Message: ${errorBody.error_message || JSON.stringify(errorBody)}`,
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

    // Step 2: Publish Media Container
    // Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing#publish-the-container
    const publishMediaUrl = `https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`;
    
    const publishParams = new URLSearchParams({
      access_token: graphApiAccessToken,
      creation_id: creationId,
    });

    const publishResponse = await fetch(publishMediaUrl, {
      method: "POST",
      body: publishParams,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!publishResponse.ok) {
      const errorBody = await publishResponse.json().catch(() => ({
        error_message: "Failed to publish media and couldn\'t parse error response.",
      }));
      console.error("Error publishing media:", errorBody);
      // It might be useful to check the status of the container if publishing fails
      // GET /{ig-container-id}?fields=status_code
      return NextResponse.json(
        {
          error: `Failed to publish media. Status: ${publishResponse.status}. Message: ${errorBody.error_message || JSON.stringify(errorBody)}`,
          creationId: creationId, // Return creation_id for potential manual retry or status check
        },
        { status: publishResponse.status }
      );
    }

    const publishData = await publishResponse.json();

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