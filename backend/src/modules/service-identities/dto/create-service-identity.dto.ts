import { IsString, IsOptional, IsArray, ArrayMinSize, Matches } from 'class-validator';

export class CreateServiceIdentityDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/, {
    message: 'name must be kebab-case, 2-63 chars, starting with alphanumeric',
  })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes!: string[];
}