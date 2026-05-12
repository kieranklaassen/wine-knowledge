# Wine Knowledge Repository

This is an open-source repository dedicated to quantifying and sharing taxonomy standards for the world of wine.

## Philosophy

For most people, the world of wine is daunting and shrouded in mystery. How many times have you sat in a restaurant with a wine menu in your hands, only to have absolutely no idea what to choose? How many times have you stood, eyes glazed over, in front of the wine aisle in the supermarket?

We believe that education is the key to empowering people to choose better wine. 

Education begins with common standards around how we talk about wine - a lingua franca for the wine world. This repository contains taxonomies and guidelines for how we can talk about things like wine categorization, sensory analysis, terroir, winemaking techniques and viticulture techniques.

This repository began as a Vinebase project and is now maintained as a personal, open-source reference for wine taxonomy work. It remains a work in progress, and contributions are welcome. Please open an issue or pull request with ideas, corrections, or additions.

## Taxonomies

#### Categorization
- Wine categories & styles
- Grape types (varieties & clones)
- Wine regions

#### Sensory Analysis
- Aromas and flavors
- Structural components
- Wine profiles

#### Terroir
- Soil types
- Soil textures

## Interactive Atlas

The repository includes a static interactive atlas in `map/` that turns the CSV taxonomies into a map-led explorer for wine regions, grape varieties, styles, flavors, structure, and terroir. It uses local country geometry from `map/data/world-countries.geo.json`, sourced from the public-domain `johan/world.geo.json` dataset.

When deployed from `main`, the hosted app is available through GitHub Pages at:

`https://kieranklaassen.github.io/wine-knowledge/`

To install the browser-check tooling, rebuild, and verify the atlas:

```bash
npm install
npm run build:map-data
npm run check:map-data
npm run verify:map
```

To view it locally:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/map/`.

With the local server still running, the browser interaction check can be run with:

```bash
npm run test:browser
```
