import type { SessionOptions } from 'iron-session';
// import type { NextApiRequest, NextApiResponse } from 'next'; // Kept commented for potential Pages Router use
import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers'; // For App Router

// Define your session data structure more concretely
interface InstagramGraphApiSessionData {
  graphApiAccessToken?: string;
  instagramUserId?: string; // This is the Instagram Professional Account ID
  // Potentially store page ID if needed for other operations
  pageId?: string; 
}

export interface SessionData {
  isLoggedIn?: boolean;
  user?: { // Basic user info from your app's perspective if any
    id: string;
    username?: string;
  };
  instagramOAuthState?: string; // For CSRF protection during OAuth flow
  instagramGraphApi?: InstagramGraphApiSessionData;
  [key: string]: unknown; // Allow other session data
}

export const sessionOptions: SessionOptions = {
  password: process.env.APP_SECRET as string,
  cookieName: 'myapp-session', // Choose a unique cookie name
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
};

if (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32) {
  console.warn(
    'APP_SECRET environment variable is not set or is too short (must be at least 32 characters). Session security is compromised.'
  );
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_SECRET is not configured correctly for production.');
  }
}


// Helper for App Router Route Handlers
export async function getAppRouterSession(): Promise<IronSession<SessionData>> {
  // cookies() from next/headers returns the store directly
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions); 
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