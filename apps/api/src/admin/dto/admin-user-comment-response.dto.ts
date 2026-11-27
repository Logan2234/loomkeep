import type { AdminUserCommentDto } from "@loomkeep/shared/contracts";

export class AdminUserCommentResponseDto implements AdminUserCommentDto {
  id!: string;
  excerpt!: string;
  href!: string | null;
  createdAt!: string;
}
