import type { NextApiRequest, NextApiResponse } from "next";
import passport from "@/lib/passport";
import type { AuthenticateOptions } from "passport"; // Corrected import for AuthenticateOptions
import { withSessionRoute } from "@/lib/session"; // Your iron-session wrapper

// Define a more specific type for the user object resolved by authenticate
interface AuthenticatedUser {
  id: string;
  // Add other properties if your passport strategy returns them and you need them
}

// Helper function to promisify passport.authenticate
const authenticate = (
  req: NextApiRequest,
  res: NextApiResponse,
  name: string,
  options?: AuthenticateOptions
): Promise<AuthenticatedUser | undefined> =>
  new Promise((resolve, reject) => {
    const cb = (
      err: Error | null,
      user?: AuthenticatedUser | false,
      info?: { message?: string }
    ) => {
      if (err) {
        return reject(err);
      }
      if (!user) {
        return reject(
          new Error(info?.message || "Authentication failed: No user")
        );
      }
      resolve(user);
    };
    // The type for passport.authenticate can be tricky, this is a common way to call it
    const middleware = passport.authenticate(name, options || {}, cb);
    middleware(req, res);
  });

async function loginRoute(req: NextApiRequest, res: NextApiResponse) {
  try {
    // If you need to request specific scopes, add them here:
    const authOptions: AuthenticateOptions = {
      // scope: ['user_profile', 'user_media'], // Basic Display API scopes
      // For posting, you'd need Instagram Graph API scopes like:
      scope: [
        "user_profile",
        "user_media",
        "instagram_basic",
        "pages_show_list",
        "instagram_content_publish",
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
        "instagram_business_manage_insights",
      ],
      // scope: ['instagram_basic', 'pages_show_list', 'instagram_content_publish'],
      // Ensure your app has these permissions and you use the correct Instagram API (Graph API for posting).
      // The passport-instagram strategy might need to be configured for Graph API if it defaults to Basic Display.
    };
    await authenticate(req, res, "instagram", authOptions);
    // `passport.authenticate` for a strategy like Instagram will typically not resolve here directly
    // when initiating the flow; it redirects. The actual user processing happens in the callback.
    // So, we don't expect a user object to be returned here.
  } catch (error) {
    const e = error as Error;
    console.error("Error during Instagram authentication initiation:", e);
    res
      .status(500)
      .json({ message: e.message || "Authentication initiation failed" });
  }
}

export default withSessionRoute(loginRoute);
