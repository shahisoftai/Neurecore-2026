import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class ForecastRequestDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  periods?: number = 30;
}
