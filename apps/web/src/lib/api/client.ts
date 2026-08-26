// Barrel for the API client. The implementation is split by domain
// (core/auth/admin/catalog/library/games/books/notifications/import); this file
// re-exports everything so existing `$lib/api/client` imports keep working.

export * from "./activity";
export * from "./admin";
export * from "./auth";
export * from "./books";
export * from "./catalog";
export * from "./comments";
export * from "./config";
export * from "./core";
export * from "./games";
export * from "./import";
export * from "./library";
export * from "./lists";
export * from "./mfa";
export * from "./music";
export * from "./notifications";
export * from "./reviews";
export * from "./social";
