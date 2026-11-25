// Turns Natural Earth's 1:110m countries (public domain) into the SVG paths
// of the stats page's world map, one per ISO 3166-1 alpha-2 code, in the
// Patterson cylindrical projection: straight meridians read as an upright
// map, where Equal Earth's curved edges looked tilted at this size. Run once by hand when the map needs refreshing:
//
//   curl -sSLo /tmp/ne.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
//   node scripts/generate-world-map.mjs /tmp/ne.geojson
//
// No dependency: the projection and the simplification are a few lines each.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUTPUT = fileURLToPath(
  new URL("../src/lib/components/stats/world-map.json", import.meta.url),
);
const WIDTH = 1000;
// Points closer than this to the line through their neighbours are dropped.
const TOLERANCE = 0.35;

// Natural Earth leaves a few territories without a code of their own: they
// join the country TMDB would name. Antarctica has no film industry to map.
const CODE_BY_NAME = { "N. Cyprus": "CY", Somaliland: "SO" };
const SKIPPED = new Set(["AQ"]);
// French Guiana is drawn within France's shape: lit up with Paris, it reads
// as France in South America. It gets its own code instead, as TMDB gives it.
const OVERSEAS = { FR: { code: "GF", within: ([lon]) => lon < -20 } };

const [input] = process.argv.slice(2);

if (!input) {
  console.error(
    "Usage: node scripts/generate-world-map.mjs <countries.geojson>",
  );
  process.exit(1);
}

// Patterson, Šavrič, Jenny (2014).
function project([lon, lat]) {
  const phi = (lat * Math.PI) / 180;
  const p4 = phi ** 4;
  return [
    (lon * Math.PI) / 180,
    phi * (1.0148 + p4 * (0.23185 + p4 * (-0.14499 + p4 * 0.02406))),
  ];
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Douglas-Peucker.
function simplify(points) {
  if (points.length < 3) return points;
  let index = 0;
  let farthest = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], points[0], points.at(-1));

    if (d > farthest) {
      farthest = d;
      index = i;
    }
  }

  if (farthest <= TOLERANCE) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, index + 1)).slice(0, -1),
    ...simplify(points.slice(index)),
  ];
}

const round = (n) => Math.round(n * 10) / 10;

const ringCentroid = (ring) => [
  ring.reduce((sum, [lon]) => sum + lon, 0) / ring.length,
  ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length,
];

const geojson = JSON.parse(readFileSync(input, "utf8"));
const projected = {};

for (const feature of geojson.features) {
  const props = feature.properties;
  const code =
    CODE_BY_NAME[props.NAME] ??
    (props.ISO_A2_EH !== "-99" ? props.ISO_A2_EH : props.ISO_A2);

  if (!/^[A-Z]{2}$/.test(code) || SKIPPED.has(code)) {
    console.warn(`Skipped ${props.NAME} (${code})`);
    continue;
  }

  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

  for (const polygon of polygons) {
    const overseas = OVERSEAS[code];
    const owner = overseas?.within(ringCentroid(polygon[0]))
      ? overseas.code
      : code;
    projected[owner] = [
      ...(projected[owner] ?? []),
      ...polygon.map((ring) => ring.map(project)),
    ];
  }
}

// Cropped to the land actually drawn, so no band of empty ocean is left
// above Greenland or below Tierra del Fuego.
const points = Object.values(projected).flat(2);
const minX = Math.min(...points.map(([x]) => x));
const maxX = Math.max(...points.map(([x]) => x));
const minY = Math.min(...points.map(([, y]) => y));
const maxY = Math.max(...points.map(([, y]) => y));
const scale = WIDTH / (maxX - minX);
const height = Math.round((maxY - minY) * scale);
const toView = ([x, y]) => [(x - minX) * scale, (maxY - y) * scale];

function ringPath(ring) {
  const points = simplify(ring.map(toView)).map(([x, y]) => [
    round(x),
    round(y),
  ]);
  const unique = points.filter(
    (p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
  );
  if (unique.length < 4) return "";
  return `M${unique
    .slice(0, -1)
    .map(([x, y]) => `${x} ${y}`)
    .join("L")}Z`;
}

const countries = Object.fromEntries(
  Object.entries(projected)
    .map(([code, rings]) => [code, rings.map(ringPath).join("")])
    .filter(([, d]) => d)
    .sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(
  OUTPUT,
  `${JSON.stringify({ width: WIDTH, height, countries }, null, 2)}
`,
);
process.stdout.write(
  `${Object.keys(countries).length} countries, ${WIDTH}×${height}, written to ${OUTPUT}
`,
);
