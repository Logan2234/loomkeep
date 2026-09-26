import type { MediaType } from "../enums";

/** The domains a view can be saved on: those with a library page. */
export const SAVED_VIEW_DOMAINS = ["MEDIA", "GAMES", "BOOKS", "MUSIC"] as const;
export type SavedViewDomain = (typeof SAVED_VIEW_DOMAINS)[number];

export const SAVED_VIEW_LIMITS = {
  /** Views a free account keeps, all libraries together. */
  free: 3,
  /** Views any account keeps: each one is a chip above the library filters. */
  max: 24,
  nameLength: 60,
  queryLength: 200,
} as const;

/** A library page's filters and order, as its address carries them. */
export interface SavedViewFiltersDto {
  q?: string;
  statuses?: string[];
  favorite?: boolean;
  /** MEDIA only. */
  types?: MediaType[];
  sort?: string;
  order?: "asc" | "desc";
}

export interface SavedViewDto {
  id: string;
  name: string;
  domain: SavedViewDomain;
  filters: SavedViewFiltersDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedViewDto {
  name: string;
  domain: SavedViewDomain;
  filters: SavedViewFiltersDto;
}

export interface UpdateSavedViewDto {
  name?: string;
  filters?: SavedViewFiltersDto;
}
