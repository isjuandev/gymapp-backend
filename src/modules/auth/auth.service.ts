import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './repositories/auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AppleLoginDto } from './dto/apple-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AppleTokenVerifier } from './apple-token-verifier.service';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly saltRounds = 12;

  // Token life-times
  private readonly ACCESS_TOKEN_EXPIRATION = '15m';
  private readonly REFRESH_TOKEN_DAYS = 30;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly appleTokenVerifier: AppleTokenVerifier,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', '');
    this.jwtRefreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      '',
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const newUser = await this.authRepository.createUser({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      passwordHash,
      role: UserRole.MEMBER,
    });

    const tokens = await this.generateTokens(newUser);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: UserResponseDto.fromEntity(newUser),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async appleLogin(dto: AppleLoginDto): Promise<AuthResponseDto> {
    const userIdentifier = dto.userIdentifier?.trim();
    if (!userIdentifier) {
      throw new BadRequestException('userIdentifier is required');
    }

    // 1. Verify the Apple identity token: RS256 signature against Apple's JWKS,
    //    issuer, audience (APPLE_BUNDLE_ID) and expiration.
    const appleClaims = await this.appleTokenVerifier.verify(
      dto.identityToken,
    );
    if (appleClaims.sub !== userIdentifier) {
      throw new UnauthorizedException(
        'Apple identity token does not match the provided user identifier',
      );
    }

    // 2. Resolve email: explicit client value > verified token claim > deterministic fallback
    let email = dto.email?.trim().toLowerCase() || appleClaims.email;
    if (!email) {
      email = `apple_${userIdentifier}@privaterelay.appleid.com`;
    }

    const name = dto.fullName?.trim() || 'Usuario Apple';

    // 3. Find existing user by appleId OR by email
    let user = await this.authRepository.findUserByAppleId(userIdentifier);
    if (!user) {
      user = await this.authRepository.findUserByEmail(email);
    }

    if (user) {
      // If user exists, ensure appleId is linked and name is updated if placeholder
      const needsAppleId = !user.appleId;
      const needsNameUpdate =
        (user.name === 'Usuario Apple' || !user.name) &&
        name !== 'Usuario Apple';

      if (needsAppleId || needsNameUpdate) {
        user = await this.authRepository.updateUser(user.id, {
          appleId: user.appleId ?? userIdentifier,
          name: needsNameUpdate ? name : undefined,
        });
      }
    } else {
      // Create new user for Apple Sign In
      const dummyPasswordHash = await bcrypt.hash(
        crypto.randomUUID(),
        this.saltRounds,
      );
      user = await this.authRepository.createUser({
        name,
        email,
        passwordHash: dummyPasswordHash,
        role: UserRole.MEMBER,
        appleId: userIdentifier,
      });
    }

    // 3. Issue fresh tokens
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async refreshTokens(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.authRepository.findRefreshToken(tokenHash);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revoked) {
      // Possible token reuse detected: revoke all tokens for this user
      this.logger.warn(
        `Revoked refresh token reuse attempted for user ${storedToken.userId}. Revoking all active tokens.`,
      );
      await this.authRepository.revokeAllUserRefreshTokens(storedToken.userId);
      throw new UnauthorizedException('Refresh token has already been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Refresh token rotation: invalidate the used refresh token
    await this.authRepository.revokeRefreshToken(storedToken.id);

    // Issue a fresh token pair
    const tokens = await this.generateTokens(storedToken.user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: UserResponseDto.fromEntity(storedToken.user),
    };
  }

  async logout(dto: RefreshTokenDto): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.authRepository.findRefreshToken(tokenHash);
    if (storedToken && !storedToken.revoked) {
      await this.authRepository.revokeRefreshToken(storedToken.id);
    }

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Access token payload contains ONLY { sub: userId, role }
    const payload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION,
    });

    // Generate random 40-byte cryptographically secure refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_DAYS);

    await this.authRepository.saveRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
