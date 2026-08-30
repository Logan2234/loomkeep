import type {
  AddListMemberDto,
  CreateListDto,
  ListDetailDto,
  ListDto,
  ListItemDto,
  ListItemTargetType,
  ListMemberDto,
  ListMembershipDto,
  MyListDto,
  UpdateListDto,
} from "@loomkeep/shared";
import { request } from "./core";

/** Lists the user can add items to — owned, or edit access via a collaborator grant. */
export const getEditableLists = (): Promise<MyListDto[]> =>
  request("/lists/editable");

export const getMyList = (id: string): Promise<ListDetailDto> =>
  request(`/lists/me/${id}`);

export const getListMembership = (
  targetType: ListItemTargetType,
  targetId: string,
): Promise<ListMembershipDto> =>
  request(
    `/lists/me/membership?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
  );

export const createList = (body: CreateListDto): Promise<ListDto> =>
  request("/lists", { method: "POST", body });

export const updateList = (id: string, body: UpdateListDto): Promise<ListDto> =>
  request(`/lists/${id}`, { method: "PUT", body });

export const deleteList = (id: string): Promise<void> =>
  request(`/lists/${id}`, { method: "DELETE" });

export const addListItem = (
  listId: string,
  targetType: ListItemTargetType,
  targetId: string,
): Promise<ListItemDto> =>
  request(`/lists/${listId}/items`, {
    method: "POST",
    body: { targetType, targetId },
  });

export const removeListItem = (listId: string, itemId: string): Promise<void> =>
  request(`/lists/${listId}/items/${itemId}`, { method: "DELETE" });

export const reorderListItems = (
  listId: string,
  orderedItemIds: string[],
  expectedUpdatedAt: string,
): Promise<void> =>
  request(`/lists/${listId}/items/order`, {
    method: "PUT",
    body: { orderedItemIds, expectedUpdatedAt },
  });

export const getListMembers = (listId: string): Promise<ListMemberDto[]> =>
  request(`/lists/${listId}/members`);

export const addListMember = (
  listId: string,
  body: AddListMemberDto,
): Promise<ListMemberDto> =>
  request(`/lists/${listId}/members`, { method: "POST", body });

export const removeListMember = (
  listId: string,
  memberUserId: string,
): Promise<void> =>
  request(`/lists/${listId}/members/${memberUserId}`, {
    method: "DELETE",
  });

/**
 * A list as seen by the viewer — own list or a shared one, resolved server-
 * side either way. Social-gated when it isn't the viewer's own list.
 */
export const getList = (id: string): Promise<ListDetailDto> =>
  request(`/lists/${id}`);

/** A user's lists visible to the viewer (social-gated). */
export const getUserLists = (username: string): Promise<MyListDto[]> =>
  request(`/lists/user/${encodeURIComponent(username)}`);
