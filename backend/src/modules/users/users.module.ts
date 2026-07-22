import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MeSecurityController } from './me-security.controller';
import { MeProfileController } from './me-profile.controller';
import { TwoFactorService } from './services/two-factor.service';
import { PasswordService } from '../auth/services/password.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Module({
  controllers: [UsersController, MeSecurityController, MeProfileController],
  providers: [UsersService, TwoFactorService, PasswordService, PrismaService],
  exports: [UsersService, TwoFactorService],
})
export class UsersModule {}
