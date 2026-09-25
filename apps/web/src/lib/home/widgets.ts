import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type { HomeWidgetType } from "@loomkeep/shared";
import { Domain, HOME_GRID_COLUMNS } from "@loomkeep/shared";

/** What decides whether a widget can show on this deployment, for this user. */
export interface HomeGate {
  isDomainEnabled: (domain: Domain) => boolean;
  socialEnabled: boolean;
  gamificationEnabled: boolean;
  isAdmin: boolean;
}

/** In grid cells: `w` columns out of 12, `h` rows of {@link HOME_ROW_HEIGHT}. */
interface CellSize {
  w: number;
  h: number;
}

interface HomeWidgetDef {
  type: HomeWidgetType;
  icon: IconName;
  title: () => string;
  description: () => string;
  min: CellSize;
  max: CellSize;
  /** Size a widget gets when added from the catalog. */
  initial: CellSize;
  /** Can sit on the page more than once, each copy with its own settings. */
  repeatable?: boolean;
  /** Shown in the catalog as "Bientôt", not addable yet. */
  comingSoon?: boolean;
  /** Has settings beyond its size and place. */
  configurable?: boolean;
  available: (gate: HomeGate) => boolean;
}

// One row is a quick link's height — the smallest thing a widget shows.
export const HOME_ROW_HEIGHT = 40;
export const HOME_GAP = 16;
/**
 * Below this width the page stacks the widgets instead of placing them: 12
 * columns would each be narrower than a poster's caption.
 */
export const HOME_GRID_MIN_WIDTH = 840;

/** A widget's width in pixels on a grid `gridWidth` wide. */
export const columnsToPixels = (w: number, gridWidth: number): number => {
  const column =
    (gridWidth - (HOME_GRID_COLUMNS - 1) * HOME_GAP) / HOME_GRID_COLUMNS;
  return w * column + (w - 1) * HOME_GAP;
};

/** A widget's height in pixels, `h` rows plus the gaps between them. */
export const rowsToPixels = (h: number): number =>
  h * HOME_ROW_HEIGHT + (h - 1) * HOME_GAP;

const always = () => true;
const domain = (d: Domain) => (gate: HomeGate) => gate.isDomainEnabled(d);

export const HOME_WIDGETS: Record<HomeWidgetType, HomeWidgetDef> = {
  toWatch: {
    type: "toWatch",
    icon: "tv",
    title: () => `${m.common_Media()} · ${m.home_media_to_watch()}`,
    description: () => m.home_widget_to_watch_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 9 },
    initial: { w: 9, h: 6 },
    available: domain(Domain.MEDIA),
  },
  thisWeek: {
    type: "thisWeek",
    icon: "calendar",
    title: () => m.home_this_week(),
    description: () => m.home_widget_this_week_description(),
    min: { w: 3, h: 3 },
    max: { w: 8, h: 12 },
    initial: { w: 3, h: 5 },
    available: domain(Domain.MEDIA),
  },
  resume: {
    type: "resume",
    icon: "hourglass",
    title: () => m.home_widget_resume_title(),
    description: () => m.home_widget_resume_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 9 },
    initial: { w: 6, h: 6 },
    available: domain(Domain.MEDIA),
  },
  gamesPlaying: {
    type: "gamesPlaying",
    icon: "gamepad",
    title: () => `${m.common_Games()} · ${m.home_games_playing()}`,
    description: () => m.home_widget_games_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 9 },
    initial: { w: 6, h: 5 },
    available: domain(Domain.GAMES),
  },
  booksReading: {
    type: "booksReading",
    icon: "book",
    title: () => `${m.common_Books()} · ${m.home_books_reading()}`,
    description: () => m.home_widget_books_description(),
    min: { w: 3, h: 3 },
    max: { w: 12, h: 9 },
    initial: { w: 3, h: 5 },
    available: domain(Domain.BOOKS),
  },
  readingGoal: {
    type: "readingGoal",
    icon: "gauge",
    title: () => m.reading_goal_title(),
    description: () => m.home_widget_reading_goal_description(),
    min: { w: 3, h: 3 },
    max: { w: 6, h: 6 },
    initial: { w: 3, h: 3 },
    available: domain(Domain.BOOKS),
  },
  musicToListen: {
    type: "musicToListen",
    icon: "music",
    title: () => `${m.common_Music()} · ${m.home_music_listening()}`,
    description: () => m.home_widget_music_description(),
    min: { w: 3, h: 3 },
    max: { w: 12, h: 8 },
    initial: { w: 3, h: 5 },
    available: domain(Domain.MUSIC),
  },
  activity: {
    type: "activity",
    icon: "activity",
    title: () => m.home_activity_title(),
    description: () => m.home_widget_activity_description(),
    min: { w: 4, h: 4 },
    max: { w: 12, h: 14 },
    initial: { w: 9, h: 6 },
    available: (gate) => gate.socialEnabled,
  },
  quickLinks: {
    type: "quickLinks",
    icon: "link",
    title: () => m.home_widget_quick_links_title(),
    description: () => m.home_widget_quick_links_description(),
    min: { w: 2, h: 2 },
    max: { w: 12, h: 14 },
    initial: { w: 3, h: 6 },
    repeatable: true,
    configurable: true,
    available: always,
  },
  myLists: {
    type: "myLists",
    icon: "list",
    title: () => m.lists_title(),
    description: () => m.home_widget_my_lists_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 10 },
    initial: { w: 6, h: 5 },
    available: always,
  },
  listContent: {
    type: "listContent",
    icon: "list",
    title: () => m.home_widget_list_content_title(),
    description: () => m.home_widget_list_content_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 10 },
    initial: { w: 6, h: 5 },
    repeatable: true,
    configurable: true,
    available: always,
  },
  savedView: {
    type: "savedView",
    icon: "library",
    title: () => m.home_widget_saved_view_title(),
    description: () => m.home_widget_saved_view_description(),
    min: { w: 3, h: 4 },
    max: { w: 12, h: 10 },
    initial: { w: 6, h: 5 },
    comingSoon: true,
    available: always,
  },
};

/** The catalog, in the order the "Ajouter un widget" dialog lists it. */
export const HOME_WIDGET_ORDER: HomeWidgetType[] = [
  "toWatch",
  "thisWeek",
  "resume",
  "gamesPlaying",
  "booksReading",
  "readingGoal",
  "musicToListen",
  "activity",
  "quickLinks",
  "myLists",
  "listContent",
  "savedView",
];

/** Whether a stored widget is shown: a known, shipped kind the gate allows. */
export function isWidgetShown(type: string, gate: HomeGate): boolean {
  const def = HOME_WIDGETS[type as HomeWidgetType];
  return !!def && !def.comingSoon && def.available(gate);
}
