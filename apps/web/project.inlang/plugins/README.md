# Vendored inlang plugins

The two plugins listed in `../settings.json` (`modules`), copied unchanged from
npm (`dist/index.js` of each package), so compiling the catalogs — dev, build,
Docker image, CI — never fetches code from a CDN.

| File                                | Package                                    | sha256 (first 12) |
| ----------------------------------- | ------------------------------------------ | ----------------- |
| `plugin-message-format@4.4.0.js`    | `@inlang/plugin-message-format@4.4.0`      | `9486558801c0`    |
| `plugin-m-function-matcher@2.2.6.js`| `@inlang/plugin-m-function-matcher@2.2.6`  | `85862f630579`    |

To upgrade one, download the new `dist/index.js`, rename it with its version,
point `settings.json` at it and delete the old file:

```sh
curl -fL -o plugin-message-format@X.Y.Z.js https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@X.Y.Z/dist/index.js
```
