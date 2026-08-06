import type {
  CreateListDto,
  ListDetailDto,
  ListDto,
  ListItemDto,
  ListItemTargetType,
  ListMembershipDto,
  MyListDto,
  UpdateListDto,
} from "@loomkeep/shared";
import { request } from "./core";

export function getMyLists(): Promise<MyListDto[]> {
  return request("/lists/me");
}

export function getMyList(id: string): Promise<ListDetailDto> {
  return request(`/lists/me/${id}`);
}

/** Which of the user's own lists already contain a target, keyed by list id. */
export function getListMembership(
  targetType: ListItemTargetType,
  targetId: string,
): Promise<ListMembershipDto> {
  return request(
    `/lists/me/membership?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
  );
}

export function createList(body: CreateListDto): Promise<ListDto> {
  return request("/lists", { method: "POST", body });
}

export function updateList(id: string, body: UpdateListDto): Promise<ListDto> {
  return request(`/lists/${id}`, { method: "PUT", body });
}

export function deleteList(id: string): Promise<void> {
  return request(`/lists/${id}`, { method: "DELETE" });
}

export function addListItem(
  listId: string,
  targetType: ListItemTargetType,
  targetId: string,
): Promise<ListItemDto> {
  return request(`/lists/${listId}/items`, {
    method: "POST",
    body: { targetType, targetId },
  });
}

export function removeListItem(listId: string, itemId: string): Promise<void> {
  return request(`/lists/${listId}/items/${itemId}`, { method: "DELETE" });
}

export function reorderListItems(
  listId: string,
  orderedItemIds: string[],
): Promise<void> {
  return request(`/lists/${listId}/items/order`, {
    method: "PUT",
    body: { orderedItemIds },
  });
}

/**
 * A list as seen by the viewer — own list or a shared one, resolved server-
 * side either way. Social-gated when it isn't the viewer's own list.
 */
export function getList(id: string): Promise<ListDetailDto> {
  return request(`/lists/${id}`);
}

/** A user's lists visible to the viewer (social-gated). */
export function getUserLists(username: string): Promise<MyListDto[]> {
  return request(`/lists/user/${encodeURIComponent(username)}`);
}
