import { db } from "@/lib/db";
import { instagramConnections } from "@/db/schema";
import { eq } from "drizzle-orm";

interface InstagramRefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // Number of seconds until token expires
}

/**
 * Refresh Instagram Business long-lived access token
 * Requirements:
 * - Token must be at least 24 hours old
 * - Token must be valid (not expired)
 * - User must have granted instagram_business_basic permission
 * - Tokens not refreshed in 60 days will expire permanently
 */
export async function refreshInstagramToken(instagramUserId: string): Promise<{
  success: boolean;
  error?: string;
  newToken?: string;
  expiresAt?: Date;
}> {
  try {
    // Get current token from database
    const connection = await db
      .select()
      .from(instagramConnections)
      .where(eq(instagramConnections.instagramUserId, instagramUserId))
      .limit(1);

    if (!connection.length) {
      return {
        success: false,
        error: "Instagram connection not found"
      };
    }

    const { longLivedAccessToken, accessTokenExpiresAt } = connection[0];

    // Check if token is expired
    if (accessTokenExpiresAt && new Date() >= accessTokenExpiresAt) {
      return {
        success: false,
        error: "Token has already expired and cannot be refreshed"
      };
    }

    // Refresh the token
    const refreshResponse = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${longLivedAccessToken}`
    );

    if (!refreshResponse.ok) {
      const errorBody = await refreshResponse.json().catch(() => ({
        message: "Unknown error refreshing token"
      }));
      
      console.error("Error refreshing Instagram Business token:", errorBody);
      
      return {
        success: false,
        error: `Failed to refresh token: ${errorBody.error?.message || errorBody.message}`
      };
    }

    const refreshData = await refreshResponse.json() as InstagramRefreshTokenResponse;
    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

    // Update database with new token
    await db
      .update(instagramConnections)
      .set({
        longLivedAccessToken: refreshData.access_token,
        accessTokenExpiresAt: newExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(instagramConnections.instagramUserId, instagramUserId));

    console.log(`Instagram Business token refreshed for user ${instagramUserId}. New expiry: ${newExpiresAt}`);

    return {
      success: true,
      newToken: refreshData.access_token,
      expiresAt: newExpiresAt
    };

  } catch (error) {
    console.error("Error in refreshInstagramToken:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Check if Instagram token needs refresh (expires within 7 days)
 */
export function shouldRefreshToken(expiresAt: Date): boolean {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return expiresAt <= sevenDaysFromNow;
}

/**
 * Get valid Instagram token, refreshing if necessary
 */
export async function getValidInstagramToken(instagramUserId: string): Promise<{
  token?: string;
  error?: string;
}> {
  try {
    const connection = await db
      .select()
      .from(instagramConnections)
      .where(eq(instagramConnections.instagramUserId, instagramUserId))
      .limit(1);

    if (!connection.length) {
      return { error: "Instagram connection not found" };
    }

    const { longLivedAccessToken, accessTokenExpiresAt } = connection[0];

    // If token is expired, return error
    if (accessTokenExpiresAt && new Date() >= accessTokenExpiresAt) {
      return { error: "Instagram token has expired. Please reconnect your account." };
    }

    // If token expires soon, try to refresh it
    if (accessTokenExpiresAt && shouldRefreshToken(accessTokenExpiresAt)) {
      console.log(`Instagram token for user ${instagramUserId} expires soon, attempting refresh...`);
      
      const refreshResult = await refreshInstagramToken(instagramUserId);
      
      if (refreshResult.success && refreshResult.newToken) {
        return { token: refreshResult.newToken };
      } else {
        console.warn(`Failed to refresh Instagram token: ${refreshResult.error}`);
        // Return current token even if refresh failed, as it might still be valid
        return { token: longLivedAccessToken };
      }
    }

    return { token: longLivedAccessToken };

  } catch (error) {
    console.error("Error in getValidInstagramToken:", error);
    return { error: error instanceof Error ? error.message : "Unknown error occurred" };
  }
} 