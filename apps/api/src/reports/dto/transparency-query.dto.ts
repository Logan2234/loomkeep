import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class TransparencyQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;
}
