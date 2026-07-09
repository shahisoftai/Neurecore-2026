import { UserRole } from '@prisma/client';
import { TokenPair } from './token.interface';

// Dependency Inversion: controllers/guards depend on this abstraction
export interface IAuthService {
  register(data: RegisterInput): Promise<AuthResult>;
  login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthResult>;
  googleSignIn(
    data: GoogleSignInInput,
    options?: { intent?: 'signin' | 'link' },
  ): Promise<GoogleSignInResult>;
  refresh(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, jti: string): Promise<void>;
  validateUser(email: string, password: string): Promise<ValidatedUser | null>;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId?: string;
}

export interface GoogleSignInInput {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  googlePicture?: string;
}

export interface AuthResult {
  user: ValidatedUser;
  tokens: TokenPair;
}

export type GoogleSignInResult =
  | { status: 'ok'; user: ValidatedUser; tokens: TokenPair }
  | {
      status: 'existing_unlinked';
      email: string;
      firstName: string;
      lastName: string;
      googlePicture?: string;
      googleId: string;
    }
  | { status: 'conflict'; email: string; message: string };

export interface ValidatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
  passwordChangedAt?: Date | null;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}
