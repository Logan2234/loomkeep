import { IsString, MinLength } from "class-validator";

export class AddListMemberBody {
  @IsString()
  @MinLength(1)
  username!: string;
}
