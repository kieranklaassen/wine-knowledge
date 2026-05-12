#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputPath = path.join(root, "map", "data", "wine-data.js");
const checkOnly = process.argv.includes("--check");

const sources = {
  regions: "Categorization/wine_region_taxonomy.csv",
  varieties: "Categorization/grape_types_taxonomy.csv",
  styles: "Categorization/category_style_taxonomy.csv",
  flavors: "Sensory Analysis/aroma_flavor_taxonomy.csv",
  structures: "Sensory Analysis/structure_taxonomy.csv",
  profiles: "Sensory Analysis/wine_profile_taxonomy.csv",
  soilTypes: "Terroir/soil_type_taxonomy.csv",
  soilTextures: "Terroir/soil_texture_taxonomy.csv",
};

const stateCentroids = {
  AL: [32.8067, -86.7911],
  AK: [61.3707, -152.4044],
  AZ: [33.7298, -111.4312],
  AR: [34.9697, -92.3731],
  CA: [36.1162, -119.6816],
  CO: [39.0598, -105.3111],
  CT: [41.5978, -72.7554],
  DE: [39.3185, -75.5071],
  FL: [27.7663, -81.6868],
  GA: [33.0406, -83.6431],
  HI: [21.0943, -157.4983],
  IA: [42.0115, -93.2105],
  ID: [44.2405, -114.4788],
  IL: [40.3495, -88.9861],
  IN: [39.8494, -86.2583],
  KS: [38.5266, -96.7265],
  KY: [37.6681, -84.6701],
  LA: [31.1695, -91.8678],
  MA: [42.2302, -71.5301],
  MD: [39.0639, -76.8021],
  ME: [44.6939, -69.3819],
  MI: [43.3266, -84.5361],
  MN: [45.6945, -93.9002],
  MO: [38.4561, -92.2884],
  MS: [32.7416, -89.6787],
  MT: [46.9219, -110.4544],
  NC: [35.6301, -79.8064],
  ND: [47.5289, -99.784],
  NE: [41.1254, -98.2681],
  NH: [43.4525, -71.5639],
  NJ: [40.2989, -74.521],
  NM: [34.8405, -106.2485],
  NV: [38.3135, -117.0554],
  NY: [42.1657, -74.9481],
  OH: [40.3888, -82.7649],
  OK: [35.5653, -96.9289],
  OR: [44.572, -122.0709],
  PA: [40.5908, -77.2098],
  RI: [41.6809, -71.5118],
  SC: [33.8569, -80.945],
  SD: [44.2998, -99.4388],
  TN: [35.7478, -86.6923],
  TX: [31.0545, -97.5635],
  UT: [40.15, -111.8624],
  VA: [37.7693, -78.17],
  VI: [18.3358, -64.8963],
  VT: [44.0459, -72.7107],
  WA: [47.4009, -121.4905],
  WI: [44.2685, -89.6165],
  WV: [38.4912, -80.9545],
  WY: [42.756, -107.3025],
};

function readCsv(relativePath) {
  const text = fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const headers = rows.shift() || [];

  return rows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header.trim(), (row[index] || "").trim()])),
    );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item) || "Unknown";
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function countBy(items, keyFn) {
  return Object.fromEntries(
    Object.entries(groupBy(items, keyFn))
      .map(([key, values]) => [key, values.length])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function jitteredCoordinate(state, seed) {
  const centroid = stateCentroids[state];
  if (!centroid) return null;

  const hash = hashString(`${state}:${seed}`);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 0.18 + ((hash % 90) / 90) * 1.55;
  const lat = centroid[0] + Math.sin(angle) * radius;
  const lng = centroid[1] + Math.cos(angle) * radius;

  return [Number(lat.toFixed(4)), Number(lng.toFixed(4))];
}

function regionName(row) {
  const parts = [];

  for (let level = 1; level <= 5; level += 1) {
    const name = row[`level_${level}`];
    const include = row[`level_${level}_include_in_name`];
    if (!name) continue;
    if (include === "yes" || include === "only-if-closest" || level === 5) {
      parts.push(name);
    }
  }

  return parts.at(-1) || row.level_4 || row.level_3 || row.level_2 || row.level_1 || row.state;
}

function normalizeRegions(rows) {
  return rows.map((row, index) => {
    const levels = [];

    for (let level = 1; level <= 5; level += 1) {
      const name = row[`level_${level}`];
      if (!name) continue;

      levels.push({
        level,
        name,
        kind: row[`level_${level}_kind`] || "Region",
        includeInName: row[`level_${level}_include_in_name`] || "",
      });
    }

    const name = regionName(row);
    const coordinate = jitteredCoordinate(row.state, `${index}:${name}`);

    return {
      id: `region-${index + 1}`,
      state: row.state,
      name,
      displayPath: levels.map((level) => level.name).join(" / "),
      deepestKind: levels.at(-1)?.kind || "Region",
      depth: levels.length,
      levels,
      lat: coordinate?.[0] ?? null,
      lng: coordinate?.[1] ?? null,
    };
  });
}

function normalizeVarieties(rows) {
  const grouped = groupBy(rows, (row) => row.variety);

  return Object.entries(grouped)
    .map(([name, cloneRows]) => {
      const clones = [...new Set(cloneRows.map((row) => row["FPS clone number"]).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true }),
      );

      return {
        name,
        cloneCount: clones.length,
        clones,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeStyles(rows) {
  return rows.map((row, index) => ({
    id: `style-${index + 1}`,
    category: row.Category,
    varietalType: row["Varietal or Blend"],
    base: row["Varietal/Blend"],
    style: row["Wine Style"],
    description: row["Description (mainly intended for self-onboarding instructions)"],
  }));
}

function normalizeFlavors(rows) {
  return rows.map((row, index) => ({
    id: `flavor-${index + 1}`,
    family: row.Level_1,
    group: row.Level_2,
    descriptor: row.Level_3,
  }));
}

function normalizeSingleName(rows) {
  return rows.map((row) => row.Name || row["Structure Component"]).filter(Boolean).sort();
}

function normalizeSoilTypes(rows) {
  return rows.map((row) => ({ category: row.Category, name: row.Name })).sort((a, b) => {
    const categorySort = a.category.localeCompare(b.category);
    return categorySort || a.name.localeCompare(b.name);
  });
}

function buildData() {
  const raw = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, readCsv(source)]));
  const regions = normalizeRegions(raw.regions);
  const varieties = normalizeVarieties(raw.varieties);
  const styles = normalizeStyles(raw.styles);
  const flavors = normalizeFlavors(raw.flavors);
  const structures = normalizeSingleName(raw.structures);
  const profiles = normalizeSingleName(raw.profiles);
  const soilTypes = normalizeSoilTypes(raw.soilTypes);
  const soilTextures = normalizeSingleName(raw.soilTextures);
  const states = Object.entries(groupBy(regions, (region) => region.state))
    .map(([code, stateRegions]) => ({
      code,
      lat: stateCentroids[code]?.[0] ?? null,
      lng: stateCentroids[code]?.[1] ?? null,
      regionCount: stateRegions.length,
      depthMax: Math.max(...stateRegions.map((region) => region.depth)),
      topLevelRegions: [...new Set(stateRegions.map((region) => region.levels[0]?.name).filter(Boolean))].sort(),
    }))
    .sort((a, b) => b.regionCount - a.regionCount || a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    sources,
    sourceRows: Object.fromEntries(Object.entries(raw).map(([key, rows]) => [key, rows.length])),
    stats: {
      regionRows: regions.length,
      states: states.length,
      varieties: varieties.length,
      clones: varieties.reduce((sum, variety) => sum + variety.cloneCount, 0),
      styles: styles.length,
      flavorDescriptors: flavors.length,
      flavorFamilies: new Set(flavors.map((flavor) => flavor.family)).size,
      structures: structures.length,
      profiles: profiles.length,
      soilTypes: soilTypes.length,
      soilTextures: soilTextures.length,
    },
    states,
    regions,
    varieties,
    styles,
    flavors,
    structures,
    profiles,
    soilTypes,
    soilTextures,
    breakdowns: {
      stylesByCategory: countBy(styles, (style) => style.category),
      flavorsByFamily: countBy(flavors, (flavor) => flavor.family),
      soilTypesByCategory: countBy(soilTypes, (soil) => soil.category),
      regionsByState: countBy(regions, (region) => region.state),
    },
  };
}

function renderDataFile(data) {
  return `/* Generated by scripts/build-map-data.mjs. Do not edit by hand. */\nwindow.WINE_DATA = ${JSON.stringify(
    data,
    null,
    2,
  )};\n`;
}

function verifyData(data) {
  const failures = [];

  for (const [key, source] of Object.entries(sources)) {
    const sourceCount = readCsv(source).length;
    if (data.sourceRows[key] !== sourceCount) {
      failures.push(`${key}: generated ${data.sourceRows[key]} rows, source has ${sourceCount}`);
    }
  }

  const missingCoordinates = data.regions.filter(
    (region) => !Number.isFinite(region.lat) || !Number.isFinite(region.lng),
  );
  if (missingCoordinates.length > 0) {
    failures.push(`${missingCoordinates.length} regions are missing coordinates`);
  }

  const requiredCollections = [
    "regions",
    "states",
    "varieties",
    "styles",
    "flavors",
    "structures",
    "profiles",
    "soilTypes",
    "soilTextures",
  ];
  for (const collection of requiredCollections) {
    if (!Array.isArray(data[collection]) || data[collection].length === 0) {
      failures.push(`${collection} is empty or missing`);
    }
  }

  return failures;
}

const data = buildData();
const rendered = renderDataFile(data);
const failures = verifyData(data);

if (checkOnly) {
  if (!fs.existsSync(outputPath)) {
    failures.push(`${path.relative(root, outputPath)} does not exist`);
  } else {
    const current = fs.readFileSync(outputPath, "utf8");
    const currentStatic = current.replace(/"generatedAt": ".*?"/, '"generatedAt": "<timestamp>"');
    const renderedStatic = rendered.replace(/"generatedAt": ".*?"/, '"generatedAt": "<timestamp>"');
    if (currentStatic !== renderedStatic) {
      failures.push(`${path.relative(root, outputPath)} is stale; run node scripts/build-map-data.mjs`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

if (!checkOnly) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Wrote ${path.relative(root, outputPath)} with ${data.stats.regionRows} region rows.`);
} else {
  console.log("Map data checks passed.");
}
