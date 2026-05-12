---
title: Interactive Wine Knowledge World Map
status: completed
created: 2026-05-12
origin: user request
---

# Interactive Wine Knowledge World Map

## Problem Frame

The repository currently exposes wine knowledge as CSV taxonomies. The user wants a "really cool" interactive world map that uses all of this data: wine regions, grape varieties, styles, flavors, structure, and terroir. The data should feel explorable rather than like a static spreadsheet.

The main data constraint is that `Categorization/wine_region_taxonomy.csv` contains U.S. state and AVA-style hierarchy data, not global coordinates or polygon boundaries. The map should be visually global while honestly presenting the current regional coverage as U.S.-centered, and it should connect the rest of the taxonomies through supporting interactive panels rather than inventing unsupported geographic relationships.

## Requirements Traceability

| Request | Plan requirement |
| --- | --- |
| "interactive world map" | Add a browser-based map experience with pan/zoom, state/region selection, region markers, and a detail panel. |
| "with all this data" | Load every CSV taxonomy into a structured app data bundle and surface each dataset in the UI. |
| "all the varieties" | Include searchable grape varieties, clone counts, and variety highlights. |
| "with the flavors" | Include an interactive aroma/flavor explorer grouped by taxonomy levels. |
| "really make it cool" | Use a polished app-style interface with animated map markers, strong visual hierarchy, filters, stats, and connected detail panels. |
| Existing repo shape | Keep this as a static app that can live in the repository without introducing a heavy framework. |

## Scope

In scope:

- Static browser app under `map/`.
- Generated data bundle under `map/data/wine-data.js` built from all CSV files.
- Build script that converts CSV taxonomies into structured JSON-like JavaScript data.
- Browser-friendly map using a proven map library from a CDN.
- U.S. wine-region markers grouped by state with jittered coordinates so dense AVA states remain explorable.
- Search and filtering across regions, varieties, styles, flavors, structures, soil types, and soil textures.
- README link that advertises the interactive atlas.
- Verification script for data completeness and app wiring.

Out of scope for this pass:

- Accurate AVA polygon boundaries.
- Geocoding individual AVAs.
- Backend hosting, deployment automation, or persistent user state.
- Inferred pairings between regions, varieties, flavors, and soils that are not represented in the data.

## Key Decisions

1. **Static app instead of framework setup.** The repository has no app stack today. A plain HTML/CSS/JS app keeps the feature easy to review, host, and open locally.
2. **Generated data bundle instead of client-side CSV fetches.** Browser `file://` and CORS behavior is inconsistent for local CSV fetches. A generated `wine-data.js` bundle makes the app portable.
3. **Leaflet map with CDN assets.** Leaflet provides mature pan/zoom behavior with low implementation weight. The app remains static while still feeling like a real map.
4. **State centroids with deterministic jitter.** The region CSV only gives a state code and hierarchy. Plotting each region near its state centroid is honest and still interactive.
5. **Connected knowledge panels.** Varieties, flavor taxonomy, structures, and terroir are surfaced as explorers and stats that update with search/filter state, not as fabricated map overlays.

## Implementation Units

### Unit 1: Data Builder

Files:

- `scripts/build-map-data.mjs`
- `map/data/wine-data.js`
- `map/data/state-centroids.js` or embedded centroid table inside the builder

Behavior:

- Parse all CSVs using a small quoted-field-safe parser.
- Normalize records into:
  - `regions`
  - `states`
  - `varieties`
  - `styles`
  - `flavors`
  - `structures`
  - `profiles`
  - `soilTypes`
  - `soilTextures`
  - `stats`
- Preserve source row counts so verification can compare generated output against CSV inputs.
- Generate deterministic map coordinates for each region from state centroid plus stable jitter.

Test scenarios:

- `node scripts/build-map-data.mjs --check` verifies generated counts match source CSV row counts.
- Quoted fields in `category_style_taxonomy.csv` parse correctly.
- Region hierarchy levels omit empty fields and preserve `kind` and `includeInName`.
- Every region with a recognized state code receives numeric `lat` and `lng`.

### Unit 2: Interactive Map App

Files:

- `map/index.html`
- `map/styles.css`
- `map/app.js`

Behavior:

- Present a full-page interactive world map with a wine-region marker layer.
- Support region/state search, dataset category filters, and a "spotlight" mode for high-density states.
- Selecting a marker opens a detail panel with the region hierarchy and relevant state summary.
- Show global repo stats: region rows, states, grape varieties, clones, styles, flavor descriptors, structures, profiles, soil types, and soil textures.
- Include explorers for varieties, flavors, styles, and terroir data so all repository datasets are visible.
- Use responsive layout for desktop and mobile.

Test scenarios:

- Opening `map/index.html` through a local static server renders the map and non-empty stats.
- Search filters region markers and list entries.
- Selecting a marker populates the detail panel.
- Flavor and variety explorers contain real generated data.
- Mobile viewport keeps controls usable without overlapping the map.

### Unit 3: Documentation and Verification

Files:

- `README.md`
- `scripts/verify-map-app.mjs`

Behavior:

- Document how to build the data bundle and run the map locally.
- Add a lightweight verifier that checks required app files, generated data globals, dataset counts, and references in `map/index.html`.

Test scenarios:

- `node scripts/build-map-data.mjs --check` exits 0 after generation.
- `node scripts/verify-map-app.mjs` exits 0 and confirms all taxonomies are present.
- A local static server can serve `map/index.html` without missing local assets.

## Visual and Interaction Direction

Visual thesis: a dark, editorial atlas surface with brass/rose accents, dense but readable controls, and a map that feels like a working wine cartography instrument rather than a generic dashboard.

Content plan: map first, left-side search and filters, right-side selected-region inspector, bottom/secondary panels for varieties, flavors, styles, and terroir.

Interaction plan:

- Marker pulses and density rings make heavy states like California visibly active.
- Search and category filters animate the result count and list contents.
- Selecting a marker pans the map, highlights the point, and updates the inspector without navigating away.

## Risks

- CDN map assets require network access when viewing the app. The app should still show fallback data panels if tiles fail.
- The source data has limited geographic precision. The UI must label markers as state-positioned taxonomy entries, not exact AVA coordinates.
- Large marker clusters in California can overwhelm the map. Deterministic jitter and clustering/filtering should keep the interaction usable.

## Verification Plan

- Run `node scripts/build-map-data.mjs`.
- Run `node scripts/build-map-data.mjs --check`.
- Run `node scripts/verify-map-app.mjs`.
- Start a local static server and inspect `map/index.html` in a browser.
- Capture at least one desktop screenshot or browser check if Playwright is available locally.
