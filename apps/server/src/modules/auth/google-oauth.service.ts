// apps/server/src/modules/auth/google-oauth.service.ts
import { OAuth2Client } from 'google-auth-library';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../config/env.js';
import { ValidationError } from './auth.errors.js';

const logger = createLogger({ name: 'google-oauth-service' });

export interface GoogleUserProfile {
  sub: string; // Stable Google Account ID
  email: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export class GoogleOAuthService {
  private getClient(): OAuth2Client {
    if (!serverEnv.GOOGLE_CLIENT_ID || !serverEnv.GOOGLE_CLIENT_SECRET) {
      throw new ValidationError(
        'Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables.',
      );
    }

    return new OAuth2Client({
      clientId: serverEnv.GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
      redirectUri: serverEnv.GOOGLE_CALLBACK_URL,
    });
  }

  /**
   * Generates the Google OAuth 2.0 authorization URL for user consent.
   */
  getAuthorizationUrl(): string {
    const client = this.getClient();

    return client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'openid',
      ],
      prompt: 'select_account',
    });
  }

  /**
   * Exchanges authorization code for tokens and verifies/decodes the user profile from Google.
   */
  async getGoogleUserFromCode(code: string): Promise<GoogleUserProfile> {
    const client = this.getClient();

    logger.debug('Exchanging authorization code for Google OAuth tokens');
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: serverEnv.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload && payload.sub && payload.email) {
        return {
          sub: payload.sub,
          email: payload.email,
          email_verified: payload.email_verified,
          given_name: payload.given_name,
          family_name: payload.family_name,
          picture: payload.picture,
        };
      }
    }

    // Fall back to UserInfo endpoint if id_token payload is incomplete
    logger.debug('Fetching Google user profile from userinfo API');
    const userinfoResponse = await client.request<GoogleUserProfile>({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
    });

    const user = userinfoResponse.data;
    if (!user.sub || !user.email) {
      throw new ValidationError('Google OAuth failed: Missing user ID or email from Google profile');
    }

    return user;
  }
}

export const googleOAuthService = new GoogleOAuthService();
