import type { CastMemberDto } from "@loomkeep/shared";

export class CastMemberResponseDto implements CastMemberDto {
  id!: string | null;
  name!: string;
  role!: string | null;
  photoUrl!: string | null;
  characterPhotoUrl!: string | null;
}
