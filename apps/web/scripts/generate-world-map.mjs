// Turns Natural Earth's 1:110m countries (public domain) into the SVG paths
// of the stats page's world map, one per ISO 3166-1 alpha-2 code, in the
// Equal Earth projection. Run once by hand when the map needs refreshing:
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

const [input] = process.argv.slice(2);

if (!input) {
  console.error(
    "Usage: node scripts/generate-world-map.mjs <countries.geojson>",
  );
  process.exit(1);
}

// Equal Earth (Šavrič, Patterson, Jenny, 2018).
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function project([lon, lat]) {
  const lambda = (lon * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin((lat * Math.PI) / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const x =
    (2 * Math.sqrt(3) * lambda * Math.cos(theta)) /
    (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, y];
}

// The projection's own bounds: lon ±180 at the equator, lat ±90.
const maxX = project([180, 0])[0];
const maxY = project([0, 90])[1];
const scale = WIDTH / (2 * maxX);
const height = Math.round(2 * maxY * scale);

const toView = (point) => {
  const [x, y] = project(point);
  return [(x + maxX) * scale, (maxY - y) * scale];
};

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

const geojson = JSON.parse(readFileSync(input, "utf8"));
const paths = {};

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
  const d = polygons
    .flatMap((polygon) => polygon.map(ringPath))
    .filter(Boolean)
    .join("");
  if (d) paths[code] = (paths[code] ?? "") + d;
}

const countries = Object.fromEntries(
  Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(
  OUTPUT,
  `${JSON.stringify({ width: WIDTH, height, countries }, null, 2)}\n`,
);
process.stdout.write(
  `${Object.keys(countries).length} countries, ${WIDTH}×${height}, written to ${OUTPUT}
`,
);
