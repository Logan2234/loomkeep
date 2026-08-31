import type {
  HeatmapDayDto,
  HourCountDto,
  MonthMinutesDto,
  VideoTemporalDto,
  WeekdayCountDto,
  YearMinutesDto,
} from "@loomkeep/shared";

class HeatmapDayResponseDto implements HeatmapDayDto {
  date!: string;
  count!: number;
}

class WeekdayCountResponseDto implements WeekdayCountDto {
  weekday!: number;
  count!: number;
}

class HourCountResponseDto implements HourCountDto {
  hour!: number;
  count!: number;
}

class MonthMinutesResponseDto implements MonthMinutesDto {
  month!: string;
  minutes!: number;
}

class YearMinutesResponseDto implements YearMinutesDto {
  year!: number;
  minutes!: number;
}

export class VideoTemporalResponseDto implements VideoTemporalDto {
  heatmap!: HeatmapDayResponseDto[];
  byWeekday!: WeekdayCountResponseDto[];
  byHour!: HourCountResponseDto[];
  monthlyMinutes!: MonthMinutesResponseDto[];
  yearlyMinutes!: YearMinutesResponseDto[];
  mostActiveYear!: number | null;
}
