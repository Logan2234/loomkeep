import type { GameTimeToBeatDto } from "@loomkeep/shared/contracts";

export class GameTimeToBeatResponseDto implements GameTimeToBeatDto {
  hastilyMin!: number | null;
  normallyMin!: number | null;
  completelyMin!: number | null;
  submissions!: number;
}
