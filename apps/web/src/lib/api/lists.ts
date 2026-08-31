import type {
  AddListMemberDto,
  CreateListDto,
  ListItemTargetType,
  ListMembershipDto,
  UpdateListDto,
} from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

/** Lists the user can add items to — owned, or edit access via a collaborator grant. */
export const getEditableLists = () => typedRequest("/lists/editable");

export const getMyList = (id: string) =>
  typedRequest("/lists/me/{id}", { params: { id } });

// Not migrated: query-string params aren't supported by typedRequest yet.
export const getListMembership = (
  targetType: ListItemTargetType,
  targetId: string,
): Promise<ListMembershipDto> =>
  request(
    `/lists/me/membership?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`,
  );

export const createList = (body: CreateListDto) =>
  typedRequest("/lists", { method: "POST", body });

export const updateList = (id: string, body: UpdateListDto) =>
  typedRequest("/lists/{id}", { method: "PUT", params: { id }, body });

export const deleteList = (id: string): Promise<void> =>
  typedRequest("/lists/{id}", { method: "DELETE", params: { id } });

export const addListItem = (
  listId: string,
  targetType: ListItemTargetType,
  targetId: string,
) =>
  typedRequest("/lists/{id}/items", {
    method: "POST",
    params: { id: listId },
    body: { targetType, targetId },
  });

export const removeListItem = (listId: string, itemId: string): Promise<void> =>
  typedRequest("/lists/{id}/items/{itemId}", {
    method: "DELETE",
    params: { id: listId, itemId },
  });

export const reorderListItems = (
  listId: string,
  orderedItemIds: string[],
  expectedUpdatedAt: string,
): Promise<void> =>
  typedRequest("/lists/{id}/items/order", {
    method: "PUT",
    params: { id: listId },
    body: { orderedItemIds, expectedUpdatedAt },
  });

export const getListMembers = (listId: string) =>
  typedRequest("/lists/{id}/members", { params: { id: listId } });

export const addListMember = (listId: string, body: AddListMemberDto) =>
  typedRequest("/lists/{id}/members", {
    method: "POST",
    params: { id: listId },
    body,
  });

export const removeListMember = (
  listId: string,
  memberUserId: string,
): Promise<void> =>
  typedRequest("/lists/{id}/members/{memberUserId}", {
    method: "DELETE",
    params: { id: listId, memberUserId },
  });

/**
 * A list as seen by the viewer — own list or a shared one, resolved server-
 * side either way. Social-gated when it isn't the viewer's own list.
 */
export const getList = (id: string) =>
  typedRequest("/lists/{id}", { params: { id } });

/** A user's lists visible to the viewer (social-gated). */
export const getUserLists = (username: string) =>
  typedRequest("/lists/user/{username}", { params: { username } });
