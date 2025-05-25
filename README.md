# Instagram Integrations

A modern Next.js application that enables users to connect their Instagram Business accounts and manage content publishing through a streamlined dashboard interface.

## 🚀 Features

- **Instagram Business Login Integration** - Connect Instagram Business/Creator accounts using the latest 2025 Instagram Business Login API
- **Google Authentication** - Secure user authentication via Google OAuth
- **Content Publishing** - Post content directly to connected Instagram accounts
- **Multi-Account Management** - Support for multiple Instagram accounts per user
- **Automatic Token Refresh** - Intelligent token management with automatic refresh capabilities
- **Modern UI** - Clean, responsive interface built with Tailwind CSS
- **Database Integration** - PostgreSQL with Drizzle ORM for reliable data persistence

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js 5
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js with Google Provider
- **Instagram API**: Instagram Business Login (2025 compliant)

## 📋 Prerequisites

Before running this application, ensure you have:

- Node.js 18+ installed
- PostgreSQL database
- Instagram App configured for Business Login
- Google OAuth credentials
- Supabase account (optional, for hosted database)

## ⚙️ Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Instagram Business API
INSTAGRAM_CLIENT_ID="your-instagram-app-id"
INSTAGRAM_CLIENT_SECRET="your-instagram-app-secret"
INSTAGRAM_REDIRECT_URI="http://localhost:3000/api/auth/instagram/callback"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd insta-integrations
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Set up the database**
   ```bash
   # Generate and run migrations
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

4. **Configure Instagram App**
   - Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
   - Add Instagram Business Login product
   - Configure redirect URIs and permissions
   - Update scopes to use 2025 compliant values:
     - `instagram_business_basic`
     - `instagram_business_content_publish`
     - `instagram_business_manage_comments`
     - `instagram_business_manage_messages`

5. **Run the development server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Usage

1. **Sign In**: Use Google authentication to create an account
2. **Connect Instagram**: Link your Instagram Business or Creator account
3. **Manage Accounts**: View and manage multiple connected Instagram accounts
4. **Create Posts**: Publish content directly to your Instagram accounts
5. **Monitor Tokens**: Automatic token refresh ensures continuous connectivity

## 🔧 API Endpoints

### Authentication
- `GET /api/auth/instagram/login` - Initiate Instagram Business Login
- `GET /api/auth/instagram/callback` - Handle OAuth callback

### Instagram Management
- `POST /api/instagram/post` - Publish content to Instagram
- `POST /api/instagram/refresh-token` - Manually refresh access tokens
- `GET /api/instagram/refresh-token?instagramUserId=<id>` - Check token status

### Health Check
- `GET /api/health` - Application health status

## 📊 Database Schema

The application uses the following main tables:

- **users** - User account information
- **accounts** - OAuth provider accounts (NextAuth.js)
- **sessions** - User sessions
- **instagram_connections** - Instagram account connections with tokens

## 🔄 Instagram Business Login 2025 Compliance

This application is fully compliant with Instagram's 2025 Business Login requirements:

- ✅ Updated to new scope format (`instagram_business_*`)
- ✅ Uses correct authorization endpoint
- ✅ Handles new response format
- ✅ Automatic token refresh (60-day tokens)
- ✅ Supports only Business/Creator accounts

## 🛡️ Security Features

- Secure token storage with encryption
- Automatic token expiration handling
- CSRF protection via NextAuth.js
- Environment variable validation
- Database connection security

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the [Instagram Business Login Documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login)
2. Review the `INSTAGRAM_BUSINESS_LOGIN_2025_UPDATE.md` file for migration details
3. Open an issue in this repository

## ⚠️ Important Notes

- **Deadline**: Ensure compliance with Instagram's January 27, 2025 scope update deadline
- **Account Types**: Only Instagram Business and Creator accounts are supported
- **Token Lifespan**: Instagram Business tokens last 60 days and are automatically refreshed
- **Permissions**: Users must grant necessary permissions during the OAuth flow
