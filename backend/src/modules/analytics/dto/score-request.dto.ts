import { IsObject } from 'class-validator';

export class ScoreRequestDto {
  @IsObject()
  features!: Record<string, unknown>;
}
