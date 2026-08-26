// Barrel for the API client. The implementation is split by domain
// (core/auth/admin/catalog/library/games/books/notifications/import); this file
// re-exports everything so existing `$lib/api/client` imports keep working.

export * from "./core";
export * from "./auth";
export * from "./mfa";
export * from "./config";
export * from "./admin";
export * from "./catalog";
export * from "./library";
export * from "./games";
export * from "./books";
export * from "./music";
export * from "./notifications";
export * from "./import";
export * from "./social";
export * from "./reviews";
export * from "./activity";
export * from "./comments";
export * from "./lists";
