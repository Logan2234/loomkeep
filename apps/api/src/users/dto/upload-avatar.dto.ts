import { AVATAR_MIME_TYPES, type AvatarMimeType } from "@loomkeep/shared";
import { IsIn, IsString, MaxLength } from "class-validator";

// 3MB of base64 text decodes to ~2.2MB of bytes — comfortably above what a
// client-side canvas resize (see ProfileSection.svelte) produces, but still
// bounded so a user can't stash arbitrary large blobs in the database.
const MAX_AVATAR_BASE64_LENGTH = 3 * 1024 * 1024;

export class UploadAvatarDto implements UploadAvatarRequestDto {
  @IsIn(AVATAR_MIME_TYPES)
  mimeType!: AvatarMimeType;

  // Base64, no `data:...;base64,` prefix — the client strips it before sending.
  @IsString()
  @MaxLength(MAX_AVATAR_BASE64_LENGTH)
  data!: string;
}
