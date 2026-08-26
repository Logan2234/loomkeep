import type { UploadAvatarRequestDto } from "@loomkeep/shared";
import { IsIn, IsString, MaxLength } from "class-validator";

/** Restricted to formats a browser <img> renders natively. */
export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

// 3MB of base64 text decodes to ~2.2MB of bytes — comfortably above what a
// client-side canvas resize (see ProfileSection.svelte) produces, but still
// bounded so a user can't stash arbitrary large blobs in the database.
const MAX_AVATAR_BASE64_LENGTH = 3 * 1024 * 1024;

export class UploadAvatarDto implements UploadAvatarRequestDto {
  @IsIn(ALLOWED_AVATAR_MIME_TYPES)
  mimeType!: (typeof ALLOWED_AVATAR_MIME_TYPES)[number];

  // Base64, no `data:...;base64,` prefix — the client strips it before sending.
  @IsString()
  @MaxLength(MAX_AVATAR_BASE64_LENGTH)
  data!: string;
}
