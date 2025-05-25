# Instagram Business Login 2025 Update

## Overview

This document outlines the updates made to implement the new Instagram Business Login flow for 2025, replacing the deprecated Instagram Basic Display API approach.

## Key Changes

### 1. **Critical Scope Updates (Deadline: January 27, 2025)**

The old scope values are being deprecated and **must** be updated before January 27, 2025:

#### Old Scopes (DEPRECATED)
```typescript
const scopes = [
  'business_basic',
  'business_content_publish', 
  'business_manage_comments',
  'business_manage_messages'
];
```

#### New Scopes (REQUIRED)
```typescript
const scopes = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_comments', 
  'instagram_business_manage_messages'
];
```

### 2. **Authorization Endpoint Change**

- **Old**: `https://api.instagram.com/oauth/authorize` (Instagram Basic Display)
- **New**: `https://www.instagram.com/oauth/authorize` (Instagram Business Login)

### 3. **Updated Response Format**

The token exchange response format has changed:

#### New Response Format
```typescript
interface InstagramBusinessTokenResponse {
  data: [{
    access_token: string;
    user_id: string; // Instagram-scoped user ID
    permissions: string; // Comma-separated permissions
  }];
}
```

## Files Updated

### 1. `/src/app/api/auth/instagram/login/route.ts`
- Updated authorization URL to use Instagram Business Login endpoint
- Changed scope format from space-separated to comma-separated
- Added new 2025 scope values
- Added optional parameters for business account authentication

### 2. `/src/app/api/auth/instagram/callback/route.ts`
- Updated to handle new Instagram Business Login response format
- Enhanced error handling and logging
- Updated token exchange flow for business accounts
- Improved database integration

### 3. `/src/app/api/instagram/post/route.ts`
- Integrated automatic token refresh functionality
- Updated to use Instagram Business API endpoints (v22.0)
- Enhanced error handling for token expiration
- Added support for multiple Instagram accounts per user

### 4. `/src/lib/instagram-refresh.ts` (NEW)
- Utility functions for token refresh management
- Automatic token validation and refresh
- Token expiration monitoring

### 5. `/src/app/api/instagram/refresh-token/route.ts` (NEW)
- API endpoint for manual token refresh
- Token status checking functionality
- User authentication and authorization

## New Features

### 1. **Automatic Token Refresh**
- Tokens are automatically refreshed when they expire within 7 days
- Background refresh functionality to maintain valid tokens
- Error handling for expired tokens

### 2. **Token Management**
- `refreshInstagramToken()` - Refresh a specific token
- `getValidInstagramToken()` - Get valid token with auto-refresh
- `shouldRefreshToken()` - Check if token needs refresh

### 3. **Enhanced Error Handling**
- Specific error codes for token expiration (190, 463, 467)
- User-friendly error messages
- Automatic retry mechanisms

## API Endpoints

### Token Refresh
- **POST** `/api/instagram/refresh-token` - Manually refresh token
- **GET** `/api/instagram/refresh-token?instagramUserId=<id>` - Check token status

### Authentication
- **GET** `/api/auth/instagram/login` - Initiate Instagram Business Login
- **GET** `/api/auth/instagram/callback` - Handle OAuth callback

### Content Publishing
- **POST** `/api/instagram/post` - Post content to Instagram Business account

## Environment Variables Required

```env
INSTAGRAM_CLIENT_ID=your_instagram_app_id
INSTAGRAM_CLIENT_SECRET=your_instagram_app_secret
INSTAGRAM_REDIRECT_URI=your_redirect_uri
NEXT_PUBLIC_APP_URL=your_app_url
```

## Database Schema

The `instagramConnections` table should include:
- `appUserId` - Your application user ID
- `instagramUserId` - Instagram Business Account ID
- `instagramUsername` - Instagram username
- `longLivedAccessToken` - 60-day access token
- `accessTokenExpiresAt` - Token expiration timestamp
- `createdAt` / `updatedAt` - Timestamps

## Migration Steps

1. **Update Environment Variables**
   - Ensure Instagram App is configured for Business Login
   - Update redirect URIs in Facebook App Dashboard

2. **Deploy Code Changes**
   - Deploy all updated files before January 27, 2025
   - Test the new authentication flow

3. **User Re-authentication**
   - Existing users may need to re-authenticate
   - Implement user notification system for token expiration

4. **Monitor Token Health**
   - Set up monitoring for token expiration
   - Implement automated refresh jobs if needed

## Testing

### Test the New Flow
1. Clear existing Instagram connections
2. Initiate new Instagram Business Login
3. Verify token refresh functionality
4. Test content posting with new tokens

### Verify Scopes
Ensure your app requests the correct new scope values and that users grant the necessary permissions.

## Important Notes

- **Deadline**: January 27, 2025 - Old scopes will stop working
- **Token Lifespan**: Instagram Business tokens last 60 days
- **Refresh Requirements**: Tokens must be at least 24 hours old to refresh
- **Account Types**: Only works with Instagram Professional (Business/Creator) accounts

## Troubleshooting

### Common Issues
1. **Token Expired**: User needs to re-authenticate
2. **Invalid Scopes**: Ensure using new 2025 scope values
3. **Account Type**: Verify user has Instagram Business/Creator account
4. **Permissions**: Check app has necessary permissions in Facebook App Dashboard

### Error Codes
- `190`: Access token expired
- `463`: User token expired
- `467`: User token invalid

## References

- [Instagram Business Login Documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Instagram Platform Overview](https://developers.facebook.com/docs/instagram-platform)
- [Token Refresh Documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#refresh-a-long-lived-token) 