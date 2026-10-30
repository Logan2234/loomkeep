import type { NextEpisodeDto } from "./library";
import type { SessionDomain } from "./session";

/**
 * Lets the Android app's home-screen widgets (MOB-20) read and act without
 * the WebView's session: tied to that session, it stops working once the
 * session ends.
 */
export interface HomeScreenWidgetTokenDto {
  token: string;
}

/** A show in progress, for the « À suivre » widget. */
export interface HomeScreenWidgetShowDto {
  entryId: string;
  title: string;
  posterUrl: string | null;
  /** The app page the widget opens, e.g. `/app/media/tv/95396`. */
  path: string;
  next: NextEpisodeDto;
  watchedEpisodes: number;
  totalEpisodes: number;
}

/** An upcoming release, for the « Sorties » widget. */
export interface HomeScreenWidgetReleaseDto {
  kind: "EPISODE" | "MOVIE" | "GAME";
  title: string;
  posterUrl: string | null;
  path: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /** ISO date; the widget tells today's releases from later ones itself, in the device's time zone. */
  airDate: string;
  /** A game dated to a month sits on its 1st. */
  releasePrecision?: "DAY" | "MONTH";
}

/** The session timer, for the « Chrono » widget. */
export interface HomeScreenWidgetTimerDto {
  domain: SessionDomain;
  entryId: string;
  title: string;
  posterUrl: string | null;
  path: string;
  /** Counted when the feed was built. */
  elapsedSeconds: number;
  paused: boolean;
}

/** A game or book's latest session, which the « Chrono » widget can start again. */
export interface HomeScreenWidgetSessionDto {
  domain: SessionDomain;
  entryId: string;
  title: string;
  posterUrl: string | null;
  path: string;
  durationMinutes: number;
  /** ISO. */
  occurredAt: string;
}

/** An XP gain, for « Série et niveau ». */
export interface HomeScreenWidgetGainDto {
  amount: number;
  /** The work behind it; null for a gain with none (profile, achievement…). */
  title: string | null;
  /** ISO. */
  at: string;
}

/** « Série et niveau »: null when gamification is off on the instance. */
export interface HomeScreenWidgetProgressionDto {
  xp: number;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  /** Consecutive days with a watch, a game session or a reading session. */
  streakDays: number;
  streakSecuredToday: boolean;
  /** "YYYY-MM-DD" in the account's time zone. */
  today: string;
  /** The days among the last seven, today included, with activity: "YYYY-MM-DD". */
  activeDays: string[];
  /** Most recent first. */
  gains: HomeScreenWidgetGainDto[];
}

/** Something just added to the library, for « Recherche ». */
export interface HomeScreenWidgetAddedDto {
  kind: "SERIES" | "MOVIE" | "ANIME" | "GAME" | "BOOK" | "ALBUM";
  title: string;
  posterUrl: string | null;
  path: string;
  /** ISO. */
  addedAt: string;
}

/** What a widget asks the feed for (`?include=`): each only reads its own. */
export const HOME_SCREEN_WIDGET_PARTS = [
  "toWatch",
  "releases",
  "timer",
  "progression",
  "added",
] as const;
export type HomeScreenWidgetPart = (typeof HOME_SCREEN_WIDGET_PARTS)[number];

/** Every part is present; one that wasn't asked for is empty (or null). */
export interface HomeScreenWidgetFeedDto {
  /** Most recently watched first. */
  toWatch: HomeScreenWidgetShowDto[];
  /** Soonest first, from today on. */
  releases: HomeScreenWidgetReleaseDto[];
  timer: HomeScreenWidgetTimerDto | null;
  /** Most recent first, one per game or book, the timer's own left out. */
  sessions: HomeScreenWidgetSessionDto[];
  /** Played and read over the last seven days. */
  weekMinutes: number;
  progression: HomeScreenWidgetProgressionDto | null;
  /** Most recent first, across every domain. */
  added: HomeScreenWidgetAddedDto[];
}

/** Starts the session timer from « Chrono ». */
export interface HomeScreenWidgetStartTimerDto {
  domain: SessionDomain;
  entryId: string;
}

/** Marks a show's next episode watched from the widget's button. */
export interface HomeScreenWidgetWatchNextDto {
  entryId: string;
  /** The episode the widget showed: nothing happens once it's no longer the next one. */
  episodeId: string;
}
