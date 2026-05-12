#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  "map/index.html",
  "map/styles.css",
  "map/app.js",
  "map/data/wine-data.js",
  "map/data/world-countries.geo.json",
  "scripts/build-map-data.mjs",
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`${relativePath} is missing`);
  }
}

const indexHtml = read("map/index.html");
const appJs = read("map/app.js");
const dataJs = read("map/data/wine-data.js");
const worldGeoJson = JSON.parse(read("map/data/world-countries.geo.json") || "{}");

[
  "./styles.css",
  "./data/wine-data.js",
  "./app.js",
  'id="map"',
  'id="world-svg"',
  'id="search-input"',
  'data-mode="regions"',
  'data-mode="varieties"',
  'data-mode="flavors"',
  'data-mode="styles"',
  'data-mode="terroir"',
].forEach((needle) => {
  if (!indexHtml.includes(needle)) failures.push(`map/index.html does not reference ${needle}`);
});

[
  "window.WINE_DATA",
  "regions",
  "varieties",
  "styles",
  "flavors",
  "structures",
  "profiles",
  "soilTypes",
  "soilTextures",
].forEach((needle) => {
  if (!dataJs.includes(needle)) failures.push(`map/data/wine-data.js does not include ${needle}`);
});

[
  "world-countries.geo.json",
  "renderWorld",
  "renderMarkers",
  "renderKnowledgeDock",
  "surpriseButton",
  "state-filter",
  "flavor-cloud",
  "variety-strip",
  "terroir-grid",
].forEach((needle) => {
  if (!appJs.includes(needle)) failures.push(`map/app.js does not include ${needle}`);
});

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dataJs, sandbox, { filename: "wine-data.js" });
const data = sandbox.window.WINE_DATA;

if (!Array.isArray(worldGeoJson.features) || worldGeoJson.features.length < 100) {
  failures.push("world country GeoJSON is missing or too small");
}

if (!data) {
  failures.push("window.WINE_DATA did not load");
} else {
  const expectations = {
    regions: sourceRowCount("Categorization/wine_region_taxonomy.csv"),
    styles: sourceRowCount("Categorization/category_style_taxonomy.csv"),
    flavors: sourceRowCount("Sensory Analysis/aroma_flavor_taxonomy.csv"),
    structures: sourceRowCount("Sensory Analysis/structure_taxonomy.csv"),
    profiles: sourceRowCount("Sensory Analysis/wine_profile_taxonomy.csv"),
    soilTypes: sourceRowCount("Terroir/soil_type_taxonomy.csv"),
    soilTextures: sourceRowCount("Terroir/soil_texture_taxonomy.csv"),
  };

  for (const [collection, expected] of Object.entries(expectations)) {
    if (data[collection]?.length !== expected) {
      failures.push(`${collection} expected ${expected} rows, found ${data[collection]?.length ?? "missing"}`);
    }
  }

  if (data.sourceRows.varieties !== sourceRowCount("Categorization/grape_types_taxonomy.csv")) {
    failures.push("variety source row count is not preserved");
  }

  if (!Array.isArray(data.varieties) || data.varieties.length < 300) {
    failures.push("variety aggregation looks too small");
  }

  const missingCoordinates = data.regions.filter(
    (region) => !Number.isFinite(region.lat) || !Number.isFinite(region.lng),
  );
  if (missingCoordinates.length > 0) {
    failures.push(`${missingCoordinates.length} regions have missing coordinates`);
  }

  const requiredStats = [
    "regionRows",
    "states",
    "varieties",
    "clones",
    "styles",
    "flavorDescriptors",
    "structures",
    "profiles",
    "soilTypes",
    "soilTextures",
  ];
  for (const stat of requiredStats) {
    if (!Number.isFinite(data.stats?.[stat])) failures.push(`stats.${stat} is missing`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Map app verification passed.");

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function sourceRowCount(relativePath) {
  return read(relativePath)
    .split(/\r?\n/)
    .filter((line, index) => index > 0 && line.trim() !== "").length;
}
