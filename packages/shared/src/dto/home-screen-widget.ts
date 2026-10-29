import type { NextEpisodeDto } from "./library";

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

export interface HomeScreenWidgetFeedDto {
  /** Most recently watched first. */
  toWatch: HomeScreenWidgetShowDto[];
  /** Soonest first, from today on. */
  releases: HomeScreenWidgetReleaseDto[];
}

/** Marks a show's next episode watched from the widget's button. */
export interface HomeScreenWidgetWatchNextDto {
  entryId: string;
  /** The episode the widget showed: nothing happens once it's no longer the next one. */
  episodeId: string;
}
