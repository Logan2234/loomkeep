import type { CreateSavedViewDto, UpdateSavedViewDto } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getSavedViews = () => typedRequest("/saved-views");

export const createSavedView = (body: CreateSavedViewDto) =>
  typedRequest("/saved-views", { method: "POST", body });

export const updateSavedView = (id: string, body: UpdateSavedViewDto) =>
  typedRequest("/saved-views/{id}", { method: "PATCH", params: { id }, body });

export const deleteSavedView = (id: string): Promise<void> =>
  typedRequest("/saved-views/{id}", { method: "DELETE", params: { id } });
