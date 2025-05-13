import passport from 'passport';
import { Strategy as InstagramStrategy } from 'passport-instagram';
import { db } from '@/lib/db'; // Assuming your Drizzle instance is exported from here
import { users, accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto'; // Added for UUID generation

const instagramClientId = process.env.AUTH_INSTAGRAM_ID;
const instagramClientSecret = process.env.AUTH_INSTAGRAM_SECRET;
const callbackURL = process.env.INSTAGRAM_CALLBACK_URL || '/api/auth/instagram/callback'; // Default, can be overridden by env var

if (!instagramClientId || !instagramClientSecret) {
  console.error('AUTH_INSTAGRAM_ID or AUTH_INSTAGRAM_SECRET environment variables are not set.');
  // In a real app, you might prevent startup or throw an error
  // For now, Passport strategy will likely fail to initialize properly.
}

passport.use(
  new InstagramStrategy(
    {
      clientID: instagramClientId!,
      clientSecret: instagramClientSecret!,
      callbackURL: callbackURL,
      // passReqToCallback: true, // Set to true if you need access to req in the verify callback
    },
    async (accessToken, refreshToken, profile, done) => {
      // `profile` typically contains id, username, displayName, photos etc.
      // `accessToken` is what you want to store to make API calls on behalf of the user.
      // `refreshToken` might be provided by some strategies for long-term access.

      if (!profile || !profile.id) {
        return done(new Error('Instagram profile data is missing or invalid'), false);
      }

      try {
        // Check if an account with this Instagram ID already exists
        const existingAccount = await db.query.accounts.findFirst({
          where: eq(accounts.providerAccountId, profile.id),
        });

        let appUser;

        if (existingAccount) {
          // Account exists, fetch the associated user
          appUser = await db.query.users.findFirst({
            where: eq(users.id, existingAccount.userId),
          });

          if (!appUser) {
            console.error(`Account found for Instagram ID ${profile.id} but user ${existingAccount.userId} not found. Creating a new user.`);
            const newUserId = crypto.randomUUID();
            const newUser = await db
              .insert(users)
              .values({
                id: newUserId,
                name: profile.displayName || profile.username || 'Instagram User',
                email: `temp_${newUserId}@example.com`, // Placeholder email - VERY IMPORTANT: Review this logic
              })
              .returning();
            appUser = newUser[0];
            if (!appUser) throw new Error('Failed to create a new user after finding orphaned account.');
            
            await db.update(accounts).set({ userId: appUser.id }).where(eq(accounts.providerAccountId, profile.id));
          } else {
            await db
              .update(accounts)
              .set({ access_token: accessToken, refresh_token: refreshToken || undefined })
              .where(eq(accounts.providerAccountId, profile.id));
          }
        } else {
          const newUserId = crypto.randomUUID();
          const newUserResult = await db
            .insert(users)
            .values({
              id: newUserId,
              name: profile.displayName || profile.username || 'Instagram User',
              email: `temp_${newUserId}@example.com`, // Placeholder email - VERY IMPORTANT: Review this logic
              // image: profile.photos?.[0]?.value,
            })
            .returning();
          
          appUser = newUserResult[0];

          if (!appUser || !appUser.id) {
            return done(new Error('Failed to create a new user.'), false);
          }

          await db.insert(accounts).values({
            userId: appUser.id,
            type: 'oauth',
            provider: 'instagram',
            providerAccountId: profile.id,
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        if (!appUser) {
          return done(new Error('User could not be found or created.'), false);
        }
        
        return done(null, { id: appUser.id });

      } catch (err) {
        console.error('Error in Instagram Passport strategy:', err);
        return done(err, false);
      }
    }
  )
);

// If you were using passport.session() (traditional Express setup), you'd need these.
// For iron-session, we manually manage what goes into req.session.user.
// passport.serializeUser((user: any, done) => {
//   done(null, user.id); // Or whatever unique identifier your user has
// });

// passport.deserializeUser(async (id: string, done) => {
//   try {
//     const user = await db.query.users.findFirst({ where: eq(users.id, id) });
//     done(null, user);
//   } catch (err) {
//     done(err, null);
//   }
// });

export default passport; 