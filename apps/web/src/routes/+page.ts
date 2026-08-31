// Server-rendered on each request rather than prerendered: the head needs
// absolute URLs (canonical, og:url, og:image) and the origin isn't knowable at
// build time — it differs between loomkeep.app, a self-hoster's NAS and
// localhost. `url.origin` at request time is correct everywhere, and rendering
// one static page per hit costs nothing next to shipping a wrong canonical.
// Request-time rendering also negotiates the visitor's preferred language.
export const ssr = true;
export const prerender = false;
