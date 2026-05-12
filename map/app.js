const data = window.WINE_DATA;
const svgNs = "http://www.w3.org/2000/svg";

const state = {
  mode: "regions",
  query: "",
  selectedState: "",
  selectedRegionId: null,
};

const mapState = {
  width: 1,
  height: 1,
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  dragStart: null,
  world: null,
  countriesLayer: null,
  markerLayer: null,
  graticuleLayer: null,
};

const elements = {
  map: document.querySelector("#map"),
  svg: document.querySelector("#world-svg"),
  search: document.querySelector("#search-input"),
  stateFilter: document.querySelector("#state-filter"),
  statsGrid: document.querySelector("#stats-grid"),
  resultList: document.querySelector("#result-list"),
  detail: document.querySelector("#detail-content"),
  visibleRegions: document.querySelector("#visible-regions"),
  activeDataset: document.querySelector("#active-dataset"),
  selectedStateLabel: document.querySelector("#selected-state-label"),
  flavorCloud: document.querySelector("#flavor-cloud"),
  varietyStrip: document.querySelector("#variety-strip"),
  terroirGrid: document.querySelector("#terroir-grid"),
  flavorCount: document.querySelector("#flavor-count"),
  varietyCount: document.querySelector("#variety-count"),
  terroirCount: document.querySelector("#terroir-count"),
  surpriseButton: document.querySelector("#surprise-button"),
};

async function init() {
  setupSvg();
  renderStats();
  renderStateOptions();
  renderKnowledgeDock();
  renderDetail(null);
  bindEvents();
  await loadWorld();
  resizeMap();
  centerMap(-98, 38, 2.45);
  render();
}

function setupSvg() {
  mapState.graticuleLayer = createSvgElement("g", { class: "graticule-layer" });
  mapState.countriesLayer = createSvgElement("g", { class: "countries-layer" });
  mapState.markerLayer = createSvgElement("g", { class: "marker-layer" });
  elements.svg.append(mapState.graticuleLayer, mapState.countriesLayer, mapState.markerLayer);
}

async function loadWorld() {
  try {
    const response = await fetch("./data/world-countries.geo.json");
    if (!response.ok) throw new Error(`World map request failed: ${response.status}`);
    mapState.world = await response.json();
  } catch (error) {
    mapState.world = { features: [] };
    console.warn(error);
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  elements.stateFilter.addEventListener("change", (event) => {
    state.selectedState = event.target.value;
    const selected = data.states.find((entry) => entry.code === state.selectedState);
    if (selected?.lat && selected?.lng) centerMap(selected.lng, selected.lat, selected.regionCount > 20 ? 7.4 : 6);
    render();
  });

  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll(".mode-button").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      render();
    });
  });

  elements.surpriseButton.addEventListener("click", () => {
    const region = randomItem(data.regions);
    state.mode = "regions";
    state.selectedState = region.state;
    state.selectedRegionId = region.id;
    elements.stateFilter.value = region.state;
    document.querySelectorAll(".mode-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === "regions");
    });
    centerMap(region.lng, region.lat, 8);
    render();
    renderFlight(region);
  });

  elements.map.addEventListener("wheel", onMapWheel, { passive: false });
  elements.map.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  elements.map.addEventListener("dblclick", () => {
    centerMap(-98, 38, 2.45);
    state.selectedState = "";
    elements.stateFilter.value = "";
    render();
  });

  new ResizeObserver(() => {
    const previousCenter = screenToLonLat(mapState.width / 2, mapState.height / 2);
    resizeMap();
    centerMap(previousCenter.lng, previousCenter.lat, mapState.scale);
    render();
  }).observe(elements.map);
}

function render() {
  const filteredRegions = getFilteredRegions();
  renderWorld();
  renderMarkers(filteredRegions);
  renderResults(filteredRegions);
  renderDetail(data.regions.find((region) => region.id === state.selectedRegionId) || null);
  elements.visibleRegions.textContent = filteredRegions.length.toLocaleString();
  elements.activeDataset.textContent = labelForMode(state.mode);
  elements.selectedStateLabel.textContent = state.selectedState ? `${state.selectedState} spotlight` : "All states";
}

function resizeMap() {
  const rect = elements.map.getBoundingClientRect();
  mapState.width = Math.max(1, rect.width);
  mapState.height = Math.max(1, rect.height);
  elements.svg.setAttribute("viewBox", `0 0 ${mapState.width} ${mapState.height}`);
}

function renderWorld() {
  renderGraticule();
  mapState.countriesLayer.innerHTML = "";

  for (const feature of mapState.world?.features || []) {
    const path = createSvgElement("path", {
      class: `country ${feature.id === "USA" ? "us-focus" : ""}`,
      d: geometryToPath(feature.geometry),
    });
    path.append(createSvgElement("title", {}, feature.properties?.name || feature.id || "Country"));
    mapState.countriesLayer.append(path);
  }

  applyTransform();
}

function renderGraticule() {
  mapState.graticuleLayer.innerHTML = "";

  for (let lng = -180; lng <= 180; lng += 30) {
    const start = project(lng, -85);
    const end = project(lng, 85);
    mapState.graticuleLayer.append(createSvgElement("line", {
      class: "graticule-line",
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    }));
  }

  for (let lat = -60; lat <= 60; lat += 20) {
    const start = project(-180, lat);
    const end = project(180, lat);
    mapState.graticuleLayer.append(createSvgElement("line", {
      class: "graticule-line",
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
    }));
  }
}

function renderMarkers(regions) {
  mapState.markerLayer.innerHTML = "";
  const maxStateCount = Math.max(...data.states.map((entry) => entry.regionCount));

  for (const region of regions) {
    const point = project(region.lng, region.lat);
    const stateSummary = data.states.find((entry) => entry.code === region.state);
    const density = stateSummary ? stateSummary.regionCount / maxStateCount : 0;
    const radius = (3.8 + density * 7) / mapState.scale;
    const ringRadius = radius + 8 / mapState.scale;
    const selected = region.id === state.selectedRegionId;
    const hot = density > 0.35;
    const group = createSvgElement("g", {
      class: "marker-hit-area",
      tabindex: "0",
      role: "button",
      "data-region-id": region.id,
      "aria-label": `${region.name}, ${region.state}`,
    });

    const ring = createSvgElement("circle", {
      class: "marker-ring",
      cx: point.x,
      cy: point.y,
      r: ringRadius,
    });
    const marker = createSvgElement("circle", {
      class: `wine-svg-marker ${hot ? "hot" : ""} ${selected ? "selected" : ""}`,
      cx: point.x,
      cy: point.y,
      r: selected ? radius + 3 / mapState.scale : radius,
    });
    marker.append(createSvgElement("title", {}, `${region.name}, ${region.state}`));

    group.append(ring, marker);
    ring.addEventListener("click", () => selectRegion(region));
    marker.addEventListener("click", () => selectRegion(region));
    group.addEventListener("click", () => selectRegion(region));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectRegion(region);
    });
    mapState.markerLayer.append(group);
  }

  applyTransform();
}

function renderStats() {
  const stats = [
    ["Region rows", data.stats.regionRows],
    ["Mapped states", data.stats.states],
    ["Varieties", data.stats.varieties],
    ["FPS clones", data.stats.clones],
    ["Wine styles", data.stats.styles],
    ["Flavor notes", data.stats.flavorDescriptors],
    ["Profiles", data.stats.profiles],
    ["Terroir terms", data.stats.soilTypes + data.stats.soilTextures],
  ];

  elements.statsGrid.innerHTML = stats
    .map(
      ([label, value]) => `
        <div class="stat-tile">
          <strong>${formatNumber(value)}</strong>
          <span>${escapeHtml(label)}</span>
        </div>
      `,
    )
    .join("");
}

function renderStateOptions() {
  const options = data.states
    .map(
      (entry) =>
        `<option value="${entry.code}">${entry.code} - ${entry.regionCount} region${entry.regionCount === 1 ? "" : "s"}</option>`,
    )
    .join("");
  elements.stateFilter.insertAdjacentHTML("beforeend", options);
}

function renderKnowledgeDock() {
  elements.flavorCount.textContent = `${data.stats.flavorDescriptors} descriptors`;
  elements.varietyCount.textContent = `${data.stats.varieties} varieties`;
  elements.terroirCount.textContent = `${data.stats.soilTypes + data.stats.soilTextures + data.stats.structures} terms`;

  elements.flavorCloud.innerHTML = Object.entries(data.breakdowns.flavorsByFamily)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([family, count]) => `
        <button class="cloud-button" type="button" data-search="${escapeAttribute(family)}" data-mode-target="flavors">
          ${escapeHtml(family)} <span>${count}</span>
        </button>
      `,
    )
    .join("");

  elements.varietyStrip.innerHTML = data.varieties
    .filter((variety) => variety.cloneCount > 0)
    .sort((a, b) => b.cloneCount - a.cloneCount || a.name.localeCompare(b.name))
    .slice(0, 36)
    .map(
      (variety) => `
        <button class="mini-card" type="button" data-search="${escapeAttribute(variety.name)}" data-mode-target="varieties">
          <strong>${escapeHtml(variety.name)}</strong>
          <span>${variety.cloneCount} clone${variety.cloneCount === 1 ? "" : "s"}</span>
        </button>
      `,
    )
    .join("");

  const soilCards = [
    ...data.soilTypes.map((soil) => ({ title: soil.name, meta: soil.category })),
    ...data.soilTextures.map((texture) => ({ title: texture, meta: "Texture" })),
    ...data.structures.map((structure) => ({ title: structure, meta: "Structure" })),
    ...data.profiles.map((profile) => ({ title: profile, meta: "Profile" })),
  ];

  elements.terroirGrid.innerHTML = soilCards
    .map(
      (item) => `
        <button class="mini-card" type="button" data-search="${escapeAttribute(item.title)}" data-mode-target="terroir">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta)}</span>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll("[data-search]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.modeTarget) {
        state.mode = button.dataset.modeTarget;
        document.querySelectorAll(".mode-button").forEach((candidate) => {
          candidate.classList.toggle("active", candidate.dataset.mode === state.mode);
        });
      }
      elements.search.value = button.dataset.search;
      state.query = button.dataset.search.toLowerCase();
      render();
    });
  });
}

function renderResults(filteredRegions) {
  const items = getModeItems(filteredRegions);

  elements.resultList.innerHTML =
    items.length === 0
      ? `<p class="microcopy">No matching taxonomy entries. Try a broader search.</p>`
      : items
          .slice(0, 80)
          .map((item) => {
            const active = item.type === "region" && item.id === state.selectedRegionId;
            return `
              <button class="result-item ${active ? "active" : ""}" type="button" data-result-type="${item.type}" data-result-id="${escapeAttribute(
                item.id,
              )}">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.meta)}</span>
              </button>
            `;
          })
          .join("");

  elements.resultList.querySelectorAll(".result-item").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.resultType;
      const id = button.dataset.resultId;
      if (type === "region") {
        const region = data.regions.find((candidate) => candidate.id === id);
        if (region) selectRegion(region);
      } else {
        renderTaxonomyDetail(type, id);
      }
    });
  });
}

function renderDetail(region) {
  if (!region) {
    elements.detail.innerHTML = `
      <p class="eyebrow">Inspector</p>
      <h2>Select a marker</h2>
      <p class="detail-meta">
        The map plots each wine-region taxonomy row near its state centroid. Search, spotlight a state, or select a marker to inspect the hierarchy.
      </p>
      <div class="detail-card">
        <p class="section-label">Current coverage</p>
        <div class="chip-row">
          ${data.states
            .slice(0, 12)
            .map((entry) => `<span class="chip">${entry.code}: ${entry.regionCount}</span>`)
            .join("")}
        </div>
      </div>
    `;
    return;
  }

  const stateSummary = data.states.find((entry) => entry.code === region.state);
  elements.detail.innerHTML = `
    <p class="eyebrow">${escapeHtml(region.state)} wine region</p>
    <h2>${escapeHtml(region.name)}</h2>
    <p class="detail-meta">${escapeHtml(region.displayPath)}</p>

    <div class="detail-card">
      <p class="section-label">Hierarchy</p>
      <div class="hierarchy">
        ${region.levels
          .map(
            (level) => `
              <div class="hierarchy-step">
                <span class="level-dot">${level.level}</span>
                <div>
                  <strong>${escapeHtml(level.name)}</strong>
                  <p class="detail-meta">${escapeHtml(level.kind)} - naming: ${escapeHtml(level.includeInName || "not specified")}</p>
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-card">
      <p class="section-label">State density</p>
      <p class="detail-meta">${escapeHtml(region.state)} has ${stateSummary.regionCount} mapped taxonomy rows across ${
        stateSummary.topLevelRegions.length
      } top-level region${stateSummary.topLevelRegions.length === 1 ? "" : "s"}.</p>
      <div class="chip-row">
        ${stateSummary.topLevelRegions
          .slice(0, 14)
          .map((name) => `<span class="chip">${escapeHtml(name)}</span>`)
          .join("")}
      </div>
    </div>

    <div class="detail-card" id="flight-card">
      ${flightHtml(region)}
    </div>
  `;
}

function renderTaxonomyDetail(type, id) {
  const item = getTaxonomyById(type, id);
  if (!item) return;

  elements.detail.innerHTML = `
    <p class="eyebrow">${escapeHtml(labelForType(type))}</p>
    <h2>${escapeHtml(item.title)}</h2>
    <p class="detail-meta">${escapeHtml(item.meta)}</p>
    <div class="detail-card">
      <p class="section-label">Taxonomy entry</p>
      <div class="chip-row">
        ${item.chips.map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join("")}
      </div>
    </div>
    <div class="detail-card">
      <p class="section-label">Map context</p>
      <p class="detail-meta">This entry comes from the repository taxonomy data. It is browsable alongside the map, but no source file links it to a specific mapped AVA yet.</p>
    </div>
  `;
}

function renderFlight(region) {
  const card = document.querySelector("#flight-card");
  if (card) card.innerHTML = flightHtml(region);
}

function flightHtml(region) {
  const seed = hashString(region.id);
  const variety = data.varieties[seed % data.varieties.length];
  const flavor = data.flavors[(seed * 3) % data.flavors.length];
  const style = data.styles[(seed * 5) % data.styles.length];
  const soil = data.soilTypes[(seed * 7) % data.soilTypes.length];
  const texture = data.soilTextures[(seed * 11) % data.soilTextures.length];

  return `
    <p class="section-label">Taxonomy flight</p>
    <p class="detail-meta">A generated cross-section from separate repo taxonomies, for exploration rather than a claimed pairing.</p>
    <div class="flight-grid">
      <span class="chip">${escapeHtml(variety.name)}</span>
      <span class="chip">${escapeHtml(flavor.family)} / ${escapeHtml(flavor.descriptor)}</span>
      <span class="chip">${escapeHtml(style.style)}</span>
      <span class="chip">${escapeHtml(soil.name)}</span>
      <span class="chip">${escapeHtml(texture)}</span>
    </div>
  `;
}

function selectRegion(region) {
  state.selectedRegionId = region.id;
  state.selectedState = region.state;
  elements.stateFilter.value = region.state;
  centerMap(region.lng, region.lat, 8);
  render();
}

function getFilteredRegions() {
  return data.regions.filter((region) => {
    const stateMatch = !state.selectedState || region.state === state.selectedState;
    const queryMatch =
      !state.query ||
      [region.name, region.displayPath, region.state, region.deepestKind].some((value) =>
        value.toLowerCase().includes(state.query),
      );
    return stateMatch && queryMatch;
  });
}

function getModeItems(filteredRegions) {
  const query = state.query;
  if (state.mode === "regions") {
    return filteredRegions.map((region) => ({
      type: "region",
      id: region.id,
      title: `${region.name}, ${region.state}`,
      meta: `${region.deepestKind} - ${region.displayPath}`,
    }));
  }

  if (state.mode === "varieties") {
    return data.varieties
      .filter((variety) => matchesQuery(query, variety.name, variety.clones.join(" ")))
      .map((variety) => ({
        type: "variety",
        id: variety.name,
        title: variety.name,
        meta: `${variety.cloneCount} FPS clone${variety.cloneCount === 1 ? "" : "s"}`,
      }));
  }

  if (state.mode === "flavors") {
    return data.flavors
      .filter((flavor) => matchesQuery(query, flavor.family, flavor.group, flavor.descriptor))
      .map((flavor) => ({
        type: "flavor",
        id: flavor.id,
        title: flavor.descriptor,
        meta: `${flavor.family} / ${flavor.group}`,
      }));
  }

  if (state.mode === "styles") {
    return data.styles
      .filter((style) => matchesQuery(query, style.category, style.varietalType, style.base, style.style, style.description))
      .map((style) => ({
        type: "style",
        id: style.id,
        title: style.style,
        meta: `${style.category} - ${style.base || style.varietalType}`,
      }));
  }

  const terroirItems = [
    ...data.soilTypes.map((soil, index) => ({
      type: "soil",
      id: `soil-${index}`,
      title: soil.name,
      meta: `${soil.category} soil`,
      chips: [soil.category, "Soil type"],
    })),
    ...data.soilTextures.map((texture, index) => ({
      type: "texture",
      id: `texture-${index}`,
      title: texture,
      meta: "Soil texture",
      chips: ["Texture"],
    })),
    ...data.structures.map((structure, index) => ({
      type: "structure",
      id: `structure-${index}`,
      title: structure,
      meta: "Structure component",
      chips: ["Structure"],
    })),
    ...data.profiles.map((profile, index) => ({
      type: "profile",
      id: `profile-${index}`,
      title: profile,
      meta: "Wine profile",
      chips: ["Profile"],
    })),
  ];

  return terroirItems.filter((item) => matchesQuery(query, item.title, item.meta));
}

function getTaxonomyById(type, id) {
  if (type === "variety") {
    const variety = data.varieties.find((candidate) => candidate.name === id);
    if (!variety) return null;
    return {
      title: variety.name,
      meta: `${variety.cloneCount} FPS clone${variety.cloneCount === 1 ? "" : "s"}`,
      chips: variety.clones.length ? variety.clones.slice(0, 30) : ["No clone rows listed"],
    };
  }

  if (type === "flavor") {
    const flavor = data.flavors.find((candidate) => candidate.id === id);
    if (!flavor) return null;
    return {
      title: flavor.descriptor,
      meta: `${flavor.family} / ${flavor.group}`,
      chips: [flavor.family, flavor.group, flavor.descriptor],
    };
  }

  if (type === "style") {
    const style = data.styles.find((candidate) => candidate.id === id);
    if (!style) return null;
    return {
      title: style.style,
      meta: `${style.category} - ${style.varietalType}`,
      chips: [style.category, style.varietalType, style.base, style.description].filter(Boolean),
    };
  }

  return getModeItems(data.regions).find((item) => item.type === type && item.id === id) || null;
}

function geometryToPath(geometry) {
  if (!geometry) return "";
  if (geometry.type === "Polygon") return geometry.coordinates.map(ringToPath).join(" ");
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygon.map(ringToPath).join(" ")).join(" ");
  }
  return "";
}

function ringToPath(ring) {
  return `${ring
    .map(([lng, lat], index) => {
      const point = project(lng, lat);
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ")} Z`;
}

function project(lng, lat) {
  return {
    x: ((lng + 180) / 360) * mapState.width,
    y: ((90 - lat) / 180) * mapState.height,
  };
}

function centerMap(lng, lat, scale) {
  const point = project(lng, lat);
  mapState.scale = clamp(scale, 1, 10);
  mapState.x = mapState.width / 2 - point.x * mapState.scale;
  mapState.y = mapState.height / 2 - point.y * mapState.scale;
  applyTransform();
}

function screenToLonLat(x, y) {
  const localX = (x - mapState.x) / mapState.scale;
  const localY = (y - mapState.y) / mapState.scale;
  return {
    lng: (localX / mapState.width) * 360 - 180,
    lat: 90 - (localY / mapState.height) * 180,
  };
}

function applyTransform() {
  const transform = `translate(${mapState.x.toFixed(2)} ${mapState.y.toFixed(2)}) scale(${mapState.scale.toFixed(4)})`;
  mapState.graticuleLayer?.setAttribute("transform", transform);
  mapState.countriesLayer?.setAttribute("transform", transform);
  mapState.markerLayer?.setAttribute("transform", transform);
}

function onMapWheel(event) {
  event.preventDefault();
  const rect = elements.map.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const localX = (pointerX - mapState.x) / mapState.scale;
  const localY = (pointerY - mapState.y) / mapState.scale;
  const nextScale = clamp(mapState.scale * (event.deltaY < 0 ? 1.18 : 0.85), 1, 10);

  mapState.scale = nextScale;
  mapState.x = pointerX - localX * nextScale;
  mapState.y = pointerY - localY * nextScale;
  applyTransform();
}

function onPointerDown(event) {
  const markerTarget = event.target.closest?.(".marker-hit-area");
  if (markerTarget) {
    const region = data.regions.find((candidate) => candidate.id === markerTarget.dataset.regionId);
    if (region) selectRegion(region);
    return;
  }

  elements.map.setPointerCapture?.(event.pointerId);
  mapState.dragging = true;
  mapState.dragStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    x: mapState.x,
    y: mapState.y,
  };
}

function onPointerMove(event) {
  if (!mapState.dragging || !mapState.dragStart) return;
  mapState.x = mapState.dragStart.x + event.clientX - mapState.dragStart.clientX;
  mapState.y = mapState.dragStart.y + event.clientY - mapState.dragStart.clientY;
  applyTransform();
}

function onPointerUp() {
  mapState.dragging = false;
  mapState.dragStart = null;
}

function createSvgElement(tag, attributes = {}, text = "") {
  const element = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  if (text) element.textContent = text;
  return element;
}

function matchesQuery(query, ...values) {
  return !query || values.filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
}

function labelForMode(mode) {
  return {
    regions: "Regions",
    varieties: "Varieties",
    flavors: "Flavors",
    styles: "Styles",
    terroir: "Terroir",
  }[mode];
}

function labelForType(type) {
  return {
    variety: "Grape variety",
    flavor: "Flavor descriptor",
    style: "Wine style",
    soil: "Soil type",
    texture: "Soil texture",
    structure: "Structure",
    profile: "Profile",
  }[type] || "Taxonomy";
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return value.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

init();
