import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class EmbedRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  texts!: string[];
}
