import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppleTokenVerifier } from './apple-token-verifier.service';
import { AuthRepository } from './repositories/auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AppleTokenVerifier,
    AuthRepository,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    AuthRepository,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
