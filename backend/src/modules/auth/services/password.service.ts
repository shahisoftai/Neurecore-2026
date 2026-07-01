import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Single Responsibility: only bcrypt password operations.
@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.SALT_ROUNDS);
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
