import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { cookies } from "next/headers";
import { getValidInstagramToken } from "@/lib/instagram-refresh";
import { db } from "@/lib/db";
import { instagramConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface PostRequestBody {
  imageUrl: string; // Publicly accessible URL of the JPEG image
  caption?: string;
  instagramUserId?: string; // Optional: specify which Instagram account to use
}

// Get Instagram credentials for the authenticated user
async function getInstagramCredentialsForUser(
  applicationUserId: string,
  specificInstagramUserId?: string
): Promise<{ instagramUserId: string; longLivedAccessToken: string } | null> {
  console.log(
    `Fetching Instagram credentials for app user ID: ${applicationUserId}${
      specificInstagramUserId ? `, Instagram user: ${specificInstagramUserId}` : ''
    }`
  );

  try {
    let whereCondition = eq(instagramConnections.appUserId, applicationUserId);

    if (specificInstagramUserId) {
      whereCondition = and(
        eq(instagramConnections.appUserId, applicationUserId),
        eq(instagramConnections.instagramUserId, specificInstagramUserId)
      );
    }

    const connections = await db
      .select()
      .from(instagramConnections)
      .where(whereCondition)
      .limit(1);

    if (!connections.length) {
      console.log("No Instagram connections found for user");
      return null;
    }

    const connection = connections[0];
    
    // Get valid token (with automatic refresh if needed)
    const tokenResult = await getValidInstagramToken(connection.instagramUserId);
    
    if (tokenResult.error) {
      console.error("Error getting valid Instagram token:", tokenResult.error);
      return null;
    }

    if (!tokenResult.token) {
      console.error("No valid token available");
      return null;
    }

    return {
      instagramUserId: connection.instagramUserId,
      longLivedAccessToken: tokenResult.token
    };

  } catch (error) {
    console.error("Error fetching Instagram credentials:", error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  console.log("Instagram Business post request - session user:", session.appUser?.id);

  if (!session.appUser?.id) {
    return NextResponse.json(
      {
        error: "User not authenticated in the application. Please log in.",
      },
      { status: 401 }
    );
  }
  
  const applicationUserId = session.appUser.id;

  try {
    const body: PostRequestBody = await req.json();
    const { imageUrl, caption, instagramUserId: specificInstagramUserId } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required." },
        { status: 400 }
      );
    }

    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid image URL format." },
        { status: 400 }
      );
    }

    // Fetch Instagram credentials for the currently logged-in application user
    const userCredentials = await getInstagramCredentialsForUser(
      applicationUserId, 
      specificInstagramUserId
    );

    if (!userCredentials) {
      return NextResponse.json(
        {
          error: "Instagram Business account not connected or credentials expired. Please connect your Instagram Business account through your profile settings.",
        },
        { status: 403 }
      );
    }

    const { longLivedAccessToken: graphApiAccessToken, instagramUserId } = userCredentials;

    console.log(`Using Instagram Business Account ID: ${instagramUserId} for app user: ${applicationUserId}`);

    // Step 1: Create Media Container
    // Using Instagram Business API endpoints
    const createContainerUrl = `https://graph.instagram.com/v22.0/${instagramUserId}/media`;
    
    const containerPayload: { image_url: string; caption?: string; access_token: string } = {
      image_url: imageUrl,
      access_token: graphApiAccessToken,
    };
    
    if (caption) {
      containerPayload.caption = caption;
    }

    console.log("Creating Instagram Business media container with payload:", { 
      imageUrl: containerPayload.image_url, 
      caption: containerPayload.caption 
    });

    const containerResponse = await fetch(createContainerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(containerPayload),
    });

    if (!containerResponse.ok) {
      const errorBody = await containerResponse.json().catch(() => ({
        error: { message: "Failed to create media container and couldn't parse error response." },
      }));
      
      console.error("Error creating Instagram Business media container:", errorBody);
      
      // Check for token-related errors
      if (errorBody.error?.code === 190 || 
          errorBody.error?.error_subcode === 463 || 
          errorBody.error?.error_subcode === 467) {
        return NextResponse.json(
          {
            error: "Instagram Business token has expired. Please reconnect your Instagram account.",
            tokenExpired: true
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          error: `Failed to create Instagram Business media container. Status: ${containerResponse.status}. Message: ${errorBody.error?.message || JSON.stringify(errorBody)}`,
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
    
    console.log(`Instagram Business media container created with ID: ${creationId}`);

    // Step 2: Publish Media Container
    const publishMediaUrl = `https://graph.instagram.com/v22.0/${instagramUserId}/media_publish`;
    
    const publishPayload = {
      creation_id: creationId,
      access_token: graphApiAccessToken,
    };

    console.log("Publishing Instagram Business media with creation ID:", creationId);

    const publishResponse = await fetch(publishMediaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishPayload),
    });

    if (!publishResponse.ok) {
      const errorBody = await publishResponse.json().catch(() => ({
        error: { message: "Failed to publish media and couldn't parse error response." },
      }));
      
      console.error("Error publishing Instagram Business media:", errorBody);
      
      // Check for token-related errors
      if (errorBody.error?.code === 190 || 
          errorBody.error?.error_subcode === 463 || 
          errorBody.error?.error_subcode === 467) {
        return NextResponse.json(
          {
            error: "Instagram Business token has expired. Please reconnect your Instagram account.",
            tokenExpired: true,
            creationId: creationId
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        {
          error: `Failed to publish Instagram Business media. Status: ${publishResponse.status}. Message: ${errorBody.error?.message || JSON.stringify(errorBody)}`,
          creationId: creationId,
        },
        { status: publishResponse.status }
      );
    }

    const publishData = await publishResponse.json();
    console.log("Instagram Business media published successfully:", publishData);

    return NextResponse.json(
      {
        message: "Photo posted successfully to Instagram Business account!",
        postId: publishData.id, // Instagram Media ID
        instagramUserId: instagramUserId
      },
      { status: 200 }
    );
    
  } catch (error) {
    const e = error as Error;
    console.error("Error in Instagram Business post API:", e);
    return NextResponse.json(
      { error: e.message || "An unknown error occurred while posting to Instagram Business account." },
      { status: 500 }
    );
  }
} 