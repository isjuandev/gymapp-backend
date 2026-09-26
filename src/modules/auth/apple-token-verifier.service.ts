import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyIdToken } from 'apple-signin-auth';

export interface AppleTokenClaims {
  /** Apple's unique, stable identifier for the user (the `sub` claim). */
  sub: string;
  /** Email claim from the verified token, if Apple provided one. */
  email?: string;
  /** Whether Apple marked the email as verified. */
  emailVerified?: boolean;
}

/**
 * Verifies Apple Sign In identity tokens against Apple's public JWKS.
 *
 * Checks performed by `apple-signin-auth`:
 * - RS256 signature against https://appleid.apple.com/auth/keys (with caching)
 * - Issuer: must be https://appleid.apple.com
 * - Audience: must match APPLE_BUNDLE_ID (this app's bundle identifier)
 * - Expiration and issued-at times
 */
@Injectable()
export class AppleTokenVerifier {
  private readonly logger = new Logger(AppleTokenVerifier.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(identityToken: string): Promise<AppleTokenClaims> {
    try {
      const clientId = this.configService.get<string>('APPLE_BUNDLE_ID');
      const claims = await verifyIdToken(identityToken, {
        clientId: clientId || undefined,
      });

      return {
        sub: String(claims.sub),
        email: claims.email ? String(claims.email).trim().toLowerCase() : undefined,
        emailVerified:
          claims.email_verified === true || claims.email_verified === 'true',
      };
    } catch (error) {
      this.logger.warn(
        `Apple identity token verification failed: ${(error as Error).message}`,
      );
      throw new UnauthorizedException('Invalid Apple identity token');
    }
  }
}
