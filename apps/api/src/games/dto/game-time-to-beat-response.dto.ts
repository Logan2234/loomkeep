import type { GameTimeToBeatDto } from "@loomkeep/shared";

export class GameTimeToBeatResponseDto implements GameTimeToBeatDto {
  hastilyMin!: number | null;
  normallyMin!: number | null;
  completelyMin!: number | null;
  submissions!: number;
}
