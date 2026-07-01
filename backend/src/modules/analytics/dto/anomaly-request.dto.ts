import { IsArray, ArrayNotEmpty } from 'class-validator';

export class AnomalyRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  vectors!: number[][];
}
