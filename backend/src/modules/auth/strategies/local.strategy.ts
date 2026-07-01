import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services/auth.service';
import { ValidatedUser } from '../interfaces/auth.interface';

// Single Responsibility: validate username/password credentials only.
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<ValidatedUser> {
    return this.authService.validateUser(
      email,
      password,
    ) as Promise<ValidatedUser>;
  }
}
