import type { ProfileFiguresDto } from "@loomkeep/shared";
import { FiguresResponseDto, MyYearResponseDto } from "./my-year-response.dto";

export class ProfileFiguresResponseDto implements ProfileFiguresDto {
  thisYear!: MyYearResponseDto;
  allTime!: FiguresResponseDto;
}
