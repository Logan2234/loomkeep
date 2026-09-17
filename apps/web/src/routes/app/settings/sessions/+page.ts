import { redirect } from "@sveltejs/kit";

// "Appareils connectés" moved under its own slug when settings gained one
// route per section. The old path is linked from the security screen of
// every build still in a service worker cache.
export function load(): never {
  redirect(308, "/app/settings/appareils");
}
