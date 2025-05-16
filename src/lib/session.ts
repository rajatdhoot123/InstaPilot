import type { SessionOptions, IronSession } from 'iron-session';
// import type { NextApiRequest, NextApiResponse } from 'next'; // Kept commented for potential Pages Router use
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers'; // For App Router

// 1. Define the structure of your application user's identity within the session
// This is the user logged into YOUR application.
export interface AppUser {
  id: string; // Your application's unique user ID
  username?: string; // Example: if you store username in session
  // Add other app-specific user details you want in the session
}

// 2. Define the overall session data structure
export interface SessionData {
  appUser?: AppUser; // Renamed from 'user' to 'appUser' for clarity
                     // This object will exist if the user is logged into your application

  instagramOAuthState?: string; // For CSRF protection during the Instagram OAuth flow

  // Note: Instagram access tokens, Instagram User IDs, etc., for connected accounts
  // will be stored in your database (e.g., 'instagram_connections' table),
  // linked to the appUser.id. They are NOT stored directly in the session for multi-user connections.

  [key: string]: unknown; // Allows for other dynamic top-level session properties
}

// 3. Define your iron-session options
export const sessionOptions: SessionOptions = {
  password: process.env.APP_SECRET as string,
  cookieName: 'myapp-session-v2', // Consider versioning or a new name if structure changes significantly
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // Good for OAuth redirects
    path: "/",
    // maxAge: undefined, // Session cookie (deleted when browser closes), or set a value in seconds
  },
};

// 4. Security check for the session password
if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) {
  const message =
    'APP_SECRET environment variable is not set or is too short (must be at least 32 characters). Session security is compromised.';
  console.warn(`\x1b[33mWarning: ${message}\x1b[0m`); // Yellow warning
  if (process.env.NODE_ENV === 'production') {
    // In production, this should be a fatal error to prevent insecure deployment
    throw new Error(
      'CRITICAL: APP_SECRET is not configured correctly for production. Application will not start.'
    );
  }
}

// 5. Helper function to get the session in App Router Route Handlers
export async function getAppRouterSession(): Promise<IronSession<SessionData>> {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions); 
  return session;
}

// If you still have Pages Router API routes, you might use a wrapper like this:
// import type { NextApiRequest, NextApiResponse } from 'next';
// export function withSessionRoute(handler: (req: NextApiRequest & { session: IronSession<SessionData> }, res: NextApiResponse) => unknown | Promise<unknown>) {
//   return async function (req: NextApiRequest, res: NextApiResponse) {
//     const session = await getIronSession<SessionData>(req, res, sessionOptions);
//     return handler({ ...req, session }, res);
//   };
// } 