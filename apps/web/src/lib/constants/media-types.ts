import { m } from "#lib/paraglide/messages.js";
import { MediaType } from "@loomkeep/shared";
export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  get MOVIE() {
    return m.media_movie();
  },
  get SERIES() {
    return m.media_series();
  },
  get ANIME() {
    return m.media_anime_label();
  },
};
export const MEDIA_TYPE_PLURAL_LABEL: Record<MediaType, string> = {
  get MOVIE() {
    return m.media_movies();
  },
  get SERIES() {
    return m.media_series_plural();
  },
  get ANIME() {
    return m.media_anime();
  },
};
export const MEDIA_TYPE_OPTIONS = Object.values(MediaType).map((value) => ({
  value,
  get label() {
    return MEDIA_TYPE_PLURAL_LABEL[value];
  },
}));
