/** The public avatar route, versioned so a new picture isn't served from a cache. */
export const avatarPath = (userId: string, updatedAt: Date): string =>
  `/api/users/${userId}/avatar?v=${updatedAt.getTime()}`;
