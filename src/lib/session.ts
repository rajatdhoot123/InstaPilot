import type { SessionOptions } from 'iron-session';
// import { withIronSessionApiRoute, withIronSessionSsr } from 'iron-session'; // Already removed
// Remove unused imports from next
// import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiHandler } from 'next';

// This is the secret used to encrypt the session cookie.
// It should be a string of at least 32 characters.
// You should store this in an environment variable.
const sessionPassword = process.env.SESSION_PASSWORD;

if (!sessionPassword) {
  console.warn(
    'SESSION_PASSWORD environment variable is not set. Session will not be secure. Please set it in your .env.local file. Using a default insecure password for development.'
  );
  // Consider uncommenting the throw for stricter local development or CI environments:
  // throw new Error('Missing SESSION_PASSWORD environment variable. Please set it in .env.local');
} else if (sessionPassword.length < 32) {
  // Throw an error if SESSION_PASSWORD is set but is shorter than 32 characters
  throw new Error(
    'SESSION_PASSWORD environment variable is set but is shorter than 32 characters. Please ensure it is at least 32 characters long.'
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword || 'fallback_insecure_password_for_dev_at_least_32_chars_long', // IMPORTANT: SET A REAL SECRET FOR PRODUCTION!
  cookieName: 'myapp-instagram-session', // More specific cookie name
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // Session duration: 7 days
  },
};

// Define and export SessionData interface directly
export interface SessionData {
  user?: {
    id: string; // Your application's user ID
    // You might also store the Instagram user ID if needed frequently, or the access token for client-side calls (with caution)
    // instagramId?: string;
    // username?: string; // Your app username or Instagram username
  };
  // Passport.js can also add its own data to the session if `passport.session()` is used.
  // If you use `passport.initialize()` and `passport.session()` middlewares for API routes (which is common with Express, less so with direct iron-session management),
  // you might need to declare `passport: { user: any }` or similar, depending on what passport.serializeUser puts into the session.
  // For our approach, we will manually save to req.session.user, so this might not be strictly needed if we don't use passport.session().
}

// This is where we specify the typings of req.session.*
declare module 'iron-session' {
  interface IronSessionData extends SessionData {} // Extend with our defined SessionData
}

// Helper to wrap API routes with iron-session
// export function withSessionRoute(handler: NextApiHandler) {
//   return withIronSessionApiRoute(handler, sessionOptions);
// }

// Helper to wrap SSR pages with iron-session
// export function withSessionSsr<P extends { [key: string]: unknown } = { [key: string]: unknown }>(
//   handler: (
//     context: GetServerSidePropsContext,
//   ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>,
// ) {
//   return withIronSessionSsr(handler, sessionOptions);
// } 