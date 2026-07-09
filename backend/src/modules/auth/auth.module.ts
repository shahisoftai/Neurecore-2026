import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { PlatformEmailService } from './services/platform-email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { SecretProviderService } from '../security/providers/secret.provider';
import { ObservabilityModule } from '../observability/observability.module';
import { CookieAuthModule } from '../../common/auth/cookie-auth.module';
import { AccountLockoutService } from '../security/services/account-lockout.service';
import { jwtExpiresIn } from '../../common/utils/config-getter';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService, SecretProviderService],
      useFactory: (
        config: ConfigService,
        secrets: SecretProviderService,
      ): JwtModuleOptions => ({
        secret: secrets.getJwtSecret(),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: jwtExpiresIn(config, 'JWT_ACCESS_EXPIRES', '15m'),
        },
        verifyOptions: {
          algorithms: ['HS256'],
        },
      }),
    }),
    ObservabilityModule,
    CookieAuthModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    SecretProviderService,
    PasswordService,
    PlatformEmailService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
    AccountLockoutService,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, AccountLockoutService],
})
export class AuthModule {}
