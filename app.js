let DATA = [];
let POKEDEX_READY = false;
let LEARNSETS_READY = false;
let MOVES_READY = false;
let SELECTED_MOVES = [];
let MOVE_NAMES_BY_ID = {};
let MOVES_DATA_BY_ID = {};
let ACTIVE_MOVE_BROWSER_UID = null;
let PS_NATDEX_MOVE_SPLIT = {};

const PS_POKEDEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
const PS_LEARNSETS_URL = "https://play.pokemonshowdown.com/data/learnsets.json";
const PS_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe", "bst"];
const SHOWDOWN_EXPORT_SETS = {};


const SHOWDOWN_EV_PRESETS = [
  { label: "Physique rapide", value: "252 Atk / 4 SpD / 252 Spe" },
  { label: "Spécial rapide", value: "252 SpA / 4 SpD / 252 Spe" },
  { label: "Mixed", value: "252 Atk / 4 SpA / 252 Spe" },
  { label: "Bulky Atk", value: "252 HP / 252 Atk / 4 SpD" },
  { label: "Bulky SpA", value: "252 HP / 252 SpA / 4 SpD" },
  { label: "Défensif phys.", value: "252 HP / 252 Def / 4 SpD" },
  { label: "Défensif spé.", value: "252 HP / 4 Def / 252 SpD" },
];

const SHOWDOWN_NATURES = [
  "Adamant", "Bashful", "Bold", "Brave", "Calm", "Careful", "Docile", "Gentle", "Hardy", "Hasty",
  "Impish", "Jolly", "Lax", "Lonely", "Mild", "Modest", "Naive", "Naughty", "Quiet", "Quirky",
  "Rash", "Relaxed", "Sassy", "Serious", "Timid"
];

const SHOWDOWN_NATURE_EFFECTS = {
  Adamant: "+Atk, -SpA",
  Bashful: "neutre",
  Bold: "+Def, -Atk",
  Brave: "+Atk, -Spe",
  Calm: "+SpD, -Atk",
  Careful: "+SpD, -SpA",
  Docile: "neutre",
  Gentle: "+SpD, -Def",
  Hardy: "neutre",
  Hasty: "+Spe, -Def",
  Impish: "+Def, -SpA",
  Jolly: "+Spe, -SpA",
  Lax: "+Def, -SpD",
  Lonely: "+Atk, -Def",
  Mild: "+SpA, -Def",
  Modest: "+SpA, -Atk",
  Naive: "+Spe, -SpD",
  Naughty: "+Atk, -SpD",
  Quiet: "+SpA, -Spe",
  Quirky: "neutre",
  Rash: "+SpA, -SpD",
  Relaxed: "+Def, -Spe",
  Sassy: "+SpD, -Spe",
  Serious: "neutre",
  Timid: "+Spe, -Atk",
};

function natureSelectLabel(nature) {
  const effect = SHOWDOWN_NATURE_EFFECTS[nature];
  return effect ? `${nature} (${effect})` : nature;
}

const STRATEGIC_FILTERS = {
  setup: {
    label: "Setup",
    moves: [
      "swordsdance", "dragondance", "nastyplot", "calmmind", "bulkup", "curse", "coil",
      "shellsmash", "quiverdance", "agility", "rockpolish", "autotomize", "shiftgear",
      "workup", "growth", "honeclaws", "irondefense", "amnesia", "cosmicpower",
      "tidyup", "victorydance", "tailglow", "bellydrum", "clangoroussoul"
    ]
  },
  hazards: {
    label: "Hazards",
    moves: ["stealthrock", "spikes", "toxicspikes", "stickyweb", "ceaselessedge", "stoneaxe"]
  },
  removal: {
    label: "Removal",
    moves: ["rapidspin", "defog", "mortalspin", "tidyup", "courtchange"]
  },
  pivot: {
    label: "Pivot",
    moves: [
      "uturn", "voltswitch", "flipturn", "partingshot", "chillyreception", "teleport",
      "batonpass", "shedtail"
    ]
  },
  recovery: {
    label: "Recovery",
    moves: [
      "recover", "roost", "softboiled", "slackoff", "synthesis", "morningsun", "moonlight",
      "shoreup", "milkdrink", "healorder", "strengthsap", "wish", "rest", "junglehealing",
      "lifedew", "pollenpuff", "healpulse", "aquaring", "ingrain"
    ]
  },
  priority: {
    label: "Priority",
    moves: [
      "aquajet", "bulletpunch", "extremespeed", "iceshard", "machpunch", "quickattack",
      "shadowsneak", "suckerpunch", "vacuumwave", "watershuriken", "accelerock", "grassyglide",
      "firstimpression", "fakeout", "feint", "upperhand", "thunderclap", "jetpunch", "espeed"
    ]
  }
};


const EXTRA_USEFUL_MOVE_IDS = new Set([
  "knockoff", "rapidspin", "defog", "uturn", "voltswitch", "flipturn", "partingshot",
  "stealthrock", "spikes", "toxicspikes", "stickyweb", "toxic", "willowisp", "thunderwave",
  "glare", "spore", "sleeppowder", "stunspore", "encore", "taunt", "substitute",
  "protect", "trick", "switcheroo", "haze", "roar", "whirlwind", "dragontail", "circlethrow",
  "leechseed", "healbell", "aromatherapy", "wish", "batonpass", "shedtail", "courtchange",
  "trickroom", "tailwind", "lightscreen", "reflect", "auroraveil", "memento", "destinybond",
  "painsplit", "nuzzle", "saltcure", "scald", "partingshot", "mortalspin", "ceaselessedge", "stoneaxe"
]);

const USUALLY_LOW_VALUE_MOVE_IDS = new Set([
  "splash", "celebrate", "holdhands", "happyhour", "bestow", "confide", "spotlight",
  "afteryou", "quash", "rototiller", "flowershield", "gearup", "holdback", "conversion2"
]);

const els = {
  search: document.querySelector("#search"),
  typeFilterA: document.querySelector("#typeFilterA"),
  typeFilterB: document.querySelector("#typeFilterB"),
  abilityFilter: document.querySelector("#abilityFilter"),
  abilityOptions: document.querySelector("#abilityOptions"),
  moveFilter: document.querySelector("#moveFilter"),
  moveOptions: document.querySelector("#moveOptions"),
  moveChips: document.querySelector("#moveChips"),
  strategicFilter: document.querySelector("#strategicFilter"),
  strategicRoleButtons: document.querySelector("#strategicRoleButtons"),
  resetFilters: document.querySelector("#resetFilters"),
  mobileResults: document.querySelector("#mobileResults"),
  sortBy: document.querySelector("#sortBy"),
  sortDir: document.querySelector("#sortDir"),
  count: document.querySelector("#count"),
  results: document.querySelector("#results"),
  moveBrowserRoot: null,
  minHp: document.querySelector("#minHp"),
  minAtk: document.querySelector("#minAtk"),
  minDef: document.querySelector("#minDef"),
  minSpa: document.querySelector("#minSpa"),
  minSpd: document.querySelector("#minSpd"),
  minSpe: document.querySelector("#minSpe"),
  minBst: document.querySelector("#minBst"),
};

const statInputs = {
  hp: els.minHp,
  atk: els.minAtk,
  def: els.minDef,
  spa: els.minSpa,
  spd: els.minSpd,
  spe: els.minSpe,
  bst: els.minBst,
};

function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toID(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, "");
}

function parseMoveQueries(text) {
  return String(text || "")
    .split(/[,;\n]+/)
    .map(part => toID(part.trim()))
    .filter(Boolean);
}

function displayMoveName(moveId, fallback = "") {
  const id = toID(moveId);
  if (MOVE_NAMES_BY_ID[id]) return MOVE_NAMES_BY_ID[id];
  if (MOVE_NAMES_BY_ID[moveId]) return MOVE_NAMES_BY_ID[moveId];
  if (String(fallback || "").trim()) return String(fallback || "").trim();
  return String(moveId || "").replace(/(^|\s)\S/g, c => c.toUpperCase());
}

const VARIABLE_BP_MOVE_IDS = new Set([
  "acrobatics", "assurance", "avalanche", "beatup", "brine", "crushgrip", "dragonenergy",
  "echoedvoice", "electroball", "endeavor", "eruption", "facade", "flail", "fling",
  "frustration", "grassknot", "gyroball", "heatcrash", "heavyslam", "hex", "lashout",
  "lowkick", "magnitude", "naturalgift", "payback", "powertrip", "present", "punishment",
  "pursuit", "return", "reversal", "seismictoss", "storedpower", "trumpcard", "venoshock",
  "wake-upslap", "waterspout", "weatherball", "wringout", "nightshade", "psywave",
  "dragonrage", "superfang", "naturepower", "spitup", "counter", "mirrorcoat", "metalburst",
  "bide", "finalgambit", "guillotine", "fissure", "horndrill", "sheercold"
]);

function isVariableBasePowerMove(move) {
  if (!move) return false;
  const id = toID(move.id || move.name);
  if (VARIABLE_BP_MOVE_IDS.has(id)) return true;
  const bp = Number(move.basePower || 0);
  if (!bp) return true;
  const desc = String(move.desc || move.shortDesc || "").toLowerCase();
  return /base power varies|power is equal|more power|less power|depends|varies|double power|damage equal|fixed damage|koes the target|ohko/.test(desc);
}

function moveBasePowerLabel(moveId) {
  const move = getMoveData(moveId);
  if (!move) return "";
  const category = move.category || "";
  if (category === "Status") return "";
  const bp = Number(move.basePower || 0);
  if (!bp || isVariableBasePowerMove(move)) return "— BP";
  return `${bp} BP`;
}

function moveCategoryLabel(moveId) {
  const category = getMoveData(moveId)?.category || "";
  if (category === "Physical") return "Physique";
  if (category === "Special") return "Spécial";
  if (category === "Status") return "Statut";
  return "Catégorie en chargement";
}


function getMoveData(moveId) {
  return MOVES_DATA_BY_ID[toID(moveId)] || null;
}

function getAllStrategicMoveIdsSet() {
  return new Set(Object.values(STRATEGIC_FILTERS).flatMap(filter => filter.moves.map(toID)));
}

function moveHasMeaningfulStatusEffect(move = {}) {
  return Boolean(
    move.status || move.volatileStatus || move.sideCondition || move.slotCondition || move.pseudoWeather ||
    move.weather || move.terrain || move.forceSwitch || move.selfSwitch || move.heal || move.drain ||
    move.boosts || move.self?.boosts || move.secondary || move.secondaries || move.stallingMove ||
    move.flags?.reflectable || move.flags?.heal || move.flags?.protect
  );
}

function usefulMoveReason(moveId, move = {}) {
  const id = toID(moveId);
  if (USUALLY_LOW_VALUE_MOVE_IDS.has(id)) return "";

  const strategicRole = Object.values(STRATEGIC_FILTERS).find(filter => filter.moves.map(toID).includes(id));
  if (strategicRole) return strategicRole.label;
  if (EXTRA_USEFUL_MOVE_IDS.has(id)) return "utilitaire";

  const category = move.category || "";
  const basePower = Number(move.basePower || 0);
  const accuracy = move.accuracy === true ? 100 : Number(move.accuracy || 0);
  const priority = Number(move.priority || 0);

  if (category === "Status" && moveHasMeaningfulStatusEffect(move)) return "status";
  if (priority > 0 && basePower > 0) return "priorité";
  if (basePower >= 75 && (!accuracy || accuracy >= 75)) return "attaque fiable";
  if (basePower >= 60 && (move.secondary || move.secondaries || move.drain || move.selfSwitch || move.forceSwitch)) return "effet utile";
  if (basePower >= 50 && move.multihit) return "multi-hit";

  return "";
}

function isUsefulMove(moveId) {
  return Boolean(usefulMoveReason(moveId, getMoveData(moveId) || {}));
}

function sortMoveIdsForBrowser(moveIds) {
  return [...new Set((moveIds || []).map(toID).filter(Boolean))].sort((a, b) => {
    const au = isUsefulMove(a) ? 1 : 0;
    const bu = isUsefulMove(b) ? 1 : 0;
    if (au !== bu) return bu - au;
    return displayMoveName(a).localeCompare(displayMoveName(b));
  });
}

function getPokemonByUid(uid) {
  return DATA.find(p => String(p.uid) === String(uid)) || null;
}

function getMoveBrowserPayload(p, rawQuery = "") {
  const query = normalize(rawQuery || "");
  const useful = [];
  const other = [];
  const split = p?.psMoveSplit || null;

  if (split) {
    for (const item of split.moves || []) {
      const name = displayMoveName(item.id, item.name);
      if (query && !normalize(name).includes(query) && !toID(name).includes(toID(query))) continue;
      useful.push({ id: item.id, name, categoryLabel: moveCategoryLabel(item.id) });
    }
    for (const item of split.usuallyUselessMoves || []) {
      const name = displayMoveName(item.id, item.name);
      if (query && !normalize(name).includes(query) && !toID(name).includes(toID(query))) continue;
      other.push({ id: item.id, name, categoryLabel: moveCategoryLabel(item.id) });
    }
    return { useful, other };
  }

  // Fallback si une entrée n'est pas trouvée dans l'extraction PS : ancienne logique locale.
  const moveIds = sortMoveIdsForBrowser(p?.moveIds || []);
  for (const moveId of moveIds) {
    const name = displayMoveName(moveId);
    if (query && !normalize(name).includes(query) && !toID(name).includes(toID(query))) continue;
    const reason = usefulMoveReason(moveId, getMoveData(moveId) || {});
    const item = { id: moveId, name, categoryLabel: moveCategoryLabel(moveId) };
    if (reason) useful.push(item);
    else other.push(item);
  }

  return { useful, other };
}

function openMoveBrowser(uid) {
  const cleanUid = String(uid || "");
  ACTIVE_MOVE_BROWSER_UID = ACTIVE_MOVE_BROWSER_UID === cleanUid ? null : cleanUid;
  render();
}

function closeMoveBrowser() {
  ACTIVE_MOVE_BROWSER_UID = null;
  render();
}

function getPokemonExportKey(p) {
  return String(p?.uid || p?.id || p?.name || "");
}

function getDefaultAbility(p) {
  return (p?.abilities || [])[0] || (p?.baseAbilities || [])[0] || "";
}

function getExportSet(p) {
  const key = getPokemonExportKey(p);
  if (!SHOWDOWN_EXPORT_SETS[key]) {
    SHOWDOWN_EXPORT_SETS[key] = {
      ability: getDefaultAbility(p),
      evs: "252 Atk / 4 SpA / 252 Spe",
      nature: "Hasty",
      moves: [],
    };
  }
  const set = SHOWDOWN_EXPORT_SETS[key];
  if (!set.ability && getDefaultAbility(p)) set.ability = getDefaultAbility(p);
  set.moves = [...new Set((set.moves || []).map(toID).filter(Boolean))].slice(0, 4);
  return set;
}

function buildShowdownExport(p) {
  const set = getExportSet(p);
  const lines = [p?.name || "Pokémon"];
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  if (set.evs) lines.push(`EVs: ${set.evs}`);
  if (set.nature) lines.push(`${set.nature} Nature`);
  for (const moveId of set.moves.slice(0, 4)) lines.push(`- ${displayMoveName(moveId)}`);
  return lines.join("\n");
}

function renderAbilityOptionsForExport(p, selectedAbility) {
  const abilities = [...new Set([...(p?.abilities || []), ...(p?.baseAbilities || [])].filter(Boolean))];
  if (!abilities.length && selectedAbility) abilities.push(selectedAbility);
  if (!abilities.length) return `<option value="">—</option>`;
  return abilities.map(ability => `<option value="${escapeHtml(ability)}"${ability === selectedAbility ? " selected" : ""}>${escapeHtml(ability)}</option>`).join("");
}


function renderEvPresetButtons(selectedEvs) {
  const current = String(selectedEvs || "").trim();
  return `<div class="showdown-ev-presets" aria-label="Presets EVs rapides">${SHOWDOWN_EV_PRESETS.map(preset => {
    const active = preset.value === current ? " is-active" : "";
    return `<button type="button" class="showdown-ev-preset-button${active}" data-evs-preset="${escapeHtml(preset.value)}" title="${escapeHtml(preset.value)}">${escapeHtml(preset.label)}</button>`;
  }).join("")}</div>`;
}

function renderShowdownExportBuilder(p) {
  const set = getExportSet(p);
  const selected = new Set(set.moves || []);
  const selectedMovesHtml = selected.size
    ? [...selected].map(moveId => `<button type="button" class="showdown-selected-move" data-export-remove-move-id="${escapeHtml(moveId)}" title="Retirer ${escapeHtml(displayMoveName(moveId))}">${escapeHtml(displayMoveName(moveId))}</button>`).join("")
    : `<span class="muted">Clique sur des attaques ci-dessous pour construire le set. Maximum 4 moves.</span>`;
  return `<section class="showdown-export-builder">
    <h3>Export Pokémon Showdown</h3>
    <div class="showdown-export-controls">
      <label>Talent
        <select class="showdown-export-ability">${renderAbilityOptionsForExport(p, set.ability)}</select>
      </label>
      <label>EVs
        <input class="showdown-export-evs" type="text" value="${escapeHtml(set.evs || "")}" placeholder="252 Atk / 4 SpA / 252 Spe" />
        ${renderEvPresetButtons(set.evs)}
      </label>
      <label>Nature
        <select class="showdown-export-nature">
          ${SHOWDOWN_NATURES.map(nature => `<option value="${escapeHtml(nature)}"${nature === set.nature ? " selected" : ""}>${escapeHtml(natureSelectLabel(nature))}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="showdown-selected-moves" aria-label="Moves sélectionnés">${selectedMovesHtml}</div>
    <textarea class="showdown-export-output" readonly>${escapeHtml(buildShowdownExport(p))}</textarea>
    <div class="showdown-export-actions">
      <button type="button" class="showdown-copy-button">Copier l'export</button>
      <button type="button" class="showdown-clear-button">Vider les moves</button>
      <span class="showdown-copy-status" aria-live="polite"></span>
    </div>
  </section>`;
}

function refreshShowdownExportBuilder(root) {
  const browserRoot = root?.closest?.(".inline-move-browser") || root || document;
  const uid = browserRoot.querySelector(".inline-move-browser")?.dataset.pokemonUid || browserRoot.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID;
  const p = getPokemonByUid(uid);
  const builder = browserRoot.querySelector(".showdown-export-builder");
  if (!p || !builder) return;
  builder.outerHTML = renderShowdownExportBuilder(p);
}

function toggleExportMove(p, moveId) {
  const id = toID(moveId);
  if (!p || !id) return;
  const set = getExportSet(p);
  const moves = [...new Set(set.moves || [])];
  const existingIndex = moves.indexOf(id);
  if (existingIndex >= 0) moves.splice(existingIndex, 1);
  else if (moves.length < 4) moves.push(id);
  set.moves = moves;
}

function removeExportMove(p, moveId) {
  if (!p) return;
  const id = toID(moveId);
  const set = getExportSet(p);
  set.moves = (set.moves || []).filter(m => m !== id);
}

function updateExportSetFromControls(root) {
  const browserRoot = root?.closest?.(".inline-move-browser") || root;
  const uid = browserRoot?.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID;
  const p = getPokemonByUid(uid);
  if (!p || !browserRoot) return;
  const set = getExportSet(p);
  const ability = browserRoot.querySelector(".showdown-export-ability");
  const evs = browserRoot.querySelector(".showdown-export-evs");
  const nature = browserRoot.querySelector(".showdown-export-nature");
  if (ability) set.ability = ability.value;
  if (evs) set.evs = evs.value.trim();
  if (nature) set.nature = nature.value;
  const output = browserRoot.querySelector(".showdown-export-output");
  const status = browserRoot.querySelector(".showdown-copy-status");
  if (output) output.value = buildShowdownExport(p);
  if (status) status.textContent = "";
}

async function copyShowdownExport(root) {
  const browserRoot = root?.closest?.(".inline-move-browser") || root;
  const output = browserRoot.querySelector(".showdown-export-output");
  const status = browserRoot.querySelector(".showdown-copy-status");
  if (!output) return;
  try {
    await navigator.clipboard.writeText(output.value);
    if (status) status.textContent = "Copié.";
  } catch (err) {
    output.focus();
    output.select();
    if (status) status.textContent = "Sélectionné : Ctrl+C.";
  }
}

function renderMoveBrowserContent(root) {
  const browserRoot = root || document;
  const uid = browserRoot.querySelector(".inline-move-browser")?.dataset.pokemonUid || browserRoot.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID;
  const p = getPokemonByUid(uid);
  const content = browserRoot.querySelector(".inline-move-browser-content");
  const subtitle = browserRoot.querySelector(".inline-move-browser-subtitle");
  const search = browserRoot.querySelector(".inline-move-browser-search");
  if (!content || !subtitle) return;
  if (!p) {
    content.innerHTML = `<p class="muted">Aucun Pokémon sélectionné.</p>`;
    return;
  }

  refreshShowdownExportBuilder(browserRoot);
  const { useful, other } = getMoveBrowserPayload(p, search?.value || "");
  subtitle.textContent = `${useful.length} moves PS · ${other.length} usually useless moves${MOVES_READY ? "" : " · catégories en chargement"}`;
  content.innerHTML = `
    <div class="inline-move-browser-grid">
      ${renderMoveBrowserSection("Moves", useful, true, p)}
      ${renderMoveBrowserSection("Usually useless moves", other, false, p)}
    </div>
  `;
}

function renderInlineMoveBrowser(p, mobile = false) {
  const { useful, other } = getMoveBrowserPayload(p, "");
  const body = `
    <div class="inline-move-browser" data-pokemon-uid="${escapeHtml(p.uid)}">
      <div class="inline-move-browser-header">
        <div>
          <p class="inline-move-browser-title">Attaques de ${escapeHtml(p.name || "Pokémon")}</p>
          <p class="inline-move-browser-subtitle">${useful.length} moves PS · ${other.length} usually useless moves${MOVES_READY ? "" : " · catégories en chargement"}</p>
        </div>
        <button type="button" class="inline-move-browser-close" aria-label="Fermer">×</button>
      </div>
      ${renderShowdownExportBuilder(p)}
      <label class="inline-move-browser-search-label">
        Rechercher une attaque
        <input class="inline-move-browser-search" type="search" placeholder="Ex. Knock Off, U-turn, Recover..." autocomplete="off" />
      </label>
      <div class="inline-move-browser-content">
        <div class="inline-move-browser-grid">
          ${renderMoveBrowserSection("Moves", useful, true, p)}
          ${renderMoveBrowserSection("Usually useless moves", other, false, p)}
        </div>
      </div>
    </div>
  `;
  return mobile ? `<div class="mobile-inline-move-browser">${body}</div>` : body;
}

function renderMoveBrowserSection(title, moves, useful, p = null) {
  if (!moves.length) {
    return `<section class="inline-move-browser-section"><h3>${escapeHtml(title)}</h3><p class="muted">Aucune attaque à afficher.</p></section>`;
  }
  const selected = new Set(p ? getExportSet(p).moves : []);
  return `<section class="inline-move-browser-section">
    <h3>${escapeHtml(title)} <span>${moves.length}</span></h3>
    <div class="inline-move-browser-list" data-useful="${useful ? "true" : "false"}">
      ${moves.map(move => `<button type="button" class="inline-move-browser-move${selected.has(toID(move.id)) ? " is-selected" : ""}" title="Ajouter/retirer ${escapeHtml(move.name)} dans l'export Showdown" data-browser-move-id="${escapeHtml(move.id)}">
        <span class="inline-move-browser-move-name">${escapeHtml(move.name)}</span>
        <span class="inline-move-browser-move-meta"><em class="inline-move-browser-move-bp">${escapeHtml(moveBasePowerLabel(move.id))}</em><small>${escapeHtml(move.categoryLabel || moveCategoryLabel(move.id))}</small></span>
      </button>`).join("")}
    </div>
  </section>`;
}

function getActiveStrategicKeys() {
  const raw = els.strategicFilter?.value || "";
  return raw.split(",").map(toID).filter(key => STRATEGIC_FILTERS[key]);
}

function setActiveStrategicKeys(keys) {
  if (!els.strategicFilter) return;
  const cleanKeys = [...new Set((keys || []).map(toID).filter(key => STRATEGIC_FILTERS[key]))];
  els.strategicFilter.value = cleanKeys.join(",");
}

function activeStrategicLabel() {
  return getActiveStrategicKeys()
    .map(key => STRATEGIC_FILTERS[key]?.label)
    .filter(Boolean)
    .join(" + ");
}

function updateStrategicButtons() {
  if (!els.strategicRoleButtons) return;
  const activeKeys = new Set(getActiveStrategicKeys());
  for (const button of els.strategicRoleButtons.querySelectorAll(".strategic-role-button")) {
    const isActive = activeKeys.has(button.dataset.strategicFilter);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function toggleStrategicFilter(key) {
  if (!els.strategicFilter) return;
  const activeKeys = new Set(getActiveStrategicKeys());
  if (activeKeys.has(key)) activeKeys.delete(key);
  else activeKeys.add(key);
  setActiveStrategicKeys([...activeKeys]);
  updateStrategicButtons();
  render();
}

function populateStrategicFilters() {
  if (!els.strategicRoleButtons) return;
  els.strategicRoleButtons.innerHTML = Object.entries(STRATEGIC_FILTERS)
    .map(([key, filter]) => `<button type="button" class="strategic-role-button" data-strategic-filter="${escapeHtml(key)}" aria-pressed="false">${escapeHtml(filter.label)}</button>`)
    .join("");
  updateStrategicButtons();
}

function getActiveStrategicMoveIds() {
  return [...new Set(getActiveStrategicKeys()
    .flatMap(key => STRATEGIC_FILTERS[key].moves)
    .map(toID)
    .filter(Boolean))];
}

function getStrategicMoveIdsByActiveRole() {
  return getActiveStrategicKeys().map(key => ({
    key,
    label: STRATEGIC_FILTERS[key].label,
    moveIds: [...new Set(STRATEGIC_FILTERS[key].moves.map(toID).filter(Boolean))],
  }));
}

function getMatchedStrategicMoveIds(p) {
  const pokemonMoveIds = new Set(p.moveIds || []);
  return getActiveStrategicMoveIds().filter(moveId => pokemonMoveIds.has(moveId));
}

function passesStrategicFilters(p) {
  const roleFilters = getStrategicMoveIdsByActiveRole();
  if (!roleFilters.length) return true;
  const pokemonMoveIds = new Set(p.moveIds || []);

  // ET entre rôles : le Pokémon doit avoir au moins une attaque pour chaque rôle actif.
  return roleFilters.every(role => role.moveIds.some(moveId => pokemonMoveIds.has(moveId)));
}

function renderStrategicMovesInline(p) {
  const matchedMoveIds = getMatchedStrategicMoveIds(p);
  if (!matchedMoveIds.length) return "";
  return `<span class="strategic-move-list"> — ${matchedMoveIds
    .map(moveId => `<span class="strategic-move">${escapeHtml(displayMoveName(moveId))}</span>`)
    .join(" ")}</span>`;
}

function isSpecialFormWithBaseAbilities(p) {
  const name = String(p?.name || "");
  return name.startsWith("Mega ") || name.startsWith("Primal ");
}

function getBaseAbilitiesForDisplay(p, psData) {
  if (!isSpecialFormWithBaseAbilities(p) || !p?.baseSpecies) return [];
  const baseEntry = psData?.[toID(p.baseSpecies)];
  const actual = new Set(p.abilities || []);
  return [...new Set(Object.values(baseEntry?.abilities || {}).filter(Boolean))]
    .filter(a => !actual.has(a));
}

function getSearchAliases(p) {
  const aliases = [p.name, p.baseSpecies, p.rawName, p.number, p.psid];
  const name = String(p?.name || "");
  const formPrefixes = ["Mega", "Primal", "Alolan", "Galarian", "Hisuian", "Paldean"];

  for (const prefix of formPrefixes) {
    const marker = `${prefix} `;
    if (name.startsWith(marker)) {
      const rest = name.slice(marker.length).trim();
      aliases.push(`${rest} ${prefix}`);
      aliases.push(`${prefix}-${rest}`);
      aliases.push(`${rest}-${prefix}`);

      // Useful for forms such as Mega Charizard X / Mega Charizard Y.
      const parts = rest.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        const suffix = parts.at(-1);
        const species = parts.slice(0, -1).join(" ");
        aliases.push(`${species} ${prefix} ${suffix}`);
        aliases.push(`${species}-${prefix}-${suffix}`);
        aliases.push(`${prefix}-${species}-${suffix}`);
      }
    }
  }

  return aliases.filter(Boolean);
}

function matchesSearchQuery(p, rawQuery) {
  const raw = String(rawQuery || "").trim();
  if (!raw) return true;

  const aliases = getSearchAliases(p);
  const abilityBlob = (p.abilities || []).join(" ");
  const baseAbilityBlob = (p.baseAbilities || []).join(" ");
  const normalBlob = normalize([...aliases, abilityBlob, baseAbilityBlob].join(" "));
  const idBlob = [...aliases, abilityBlob, baseAbilityBlob, ...candidateShowdownIds(p)]
    .map(x => toID(x))
    .filter(Boolean)
    .join(" ");

  const qNormal = normalize(raw);
  const qId = toID(raw);
  const qTokens = qNormal.split(/[^a-z0-9]+/).filter(Boolean);

  if (qNormal && normalBlob.includes(qNormal)) return true;
  if (qId && idBlob.includes(qId)) return true;

  // Allows order-insensitive searches such as:
  // mega-venusaur, venusaur-mega, mega venusaur, venusaur mega.
  return qTokens.length > 1 && qTokens.every(token => normalBlob.includes(token) || idBlob.includes(token));
}

function addMoveChip(rawMove) {
  const moveId = toID(rawMove);
  if (!moveId || SELECTED_MOVES.some(m => m.id === moveId)) return;
  SELECTED_MOVES.push({ id: moveId, name: displayMoveName(moveId, rawMove) });
  els.moveFilter.value = "";
  renderMoveChips();
  render();
}

function removeMoveChip(moveId) {
  SELECTED_MOVES = SELECTED_MOVES.filter(m => m.id !== moveId);
  renderMoveChips();
  render();
}

function renderMoveChips() {
  if (!els.moveChips) return;
  if (!SELECTED_MOVES.length) {
    els.moveChips.innerHTML = `<span class="muted">Aucune attaque sélectionnée</span>`;
    return;
  }
  els.moveChips.innerHTML = SELECTED_MOVES
    .map(m => `<button type="button" class="chip" data-move-id="${escapeHtml(m.id)}" title="Retirer ${escapeHtml(m.name)}">${escapeHtml(m.name)} ×</button>`)
    .join("");
}

function sameTypes(a = [], b = []) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function sameBaseStats(a = {}, b = {}) {
  return ["hp", "atk", "def", "spa", "spd", "spe"].every(k => Number(a[k]) === Number(b[k]));
}

function candidateShowdownIds(p) {
  const formIds = [];
  const baseIds = [];
  const name = p.name || "";
  const rawName = p.rawName || "";
  const base = p.baseSpecies || name;
  const baseId = toID(base);
  const dataId = toID(p.id || "");

  // Règle importante : on teste toujours les identifiants de formes AVANT l'espèce de base.
  // Sinon Galarian Zapdos pouvait récupérer les talents de Zapdos, et Mega Venusaur ceux de Venusaur.
  const regionalPrefixes = [
    ["Alolan ", "alola"],
    ["Galarian ", "galar"],
    ["Hisuian ", "hisui"],
    ["Paldean ", "paldea"],
  ];

  for (const [prefix, suffix] of regionalPrefixes) {
    if (name.startsWith(prefix)) {
      formIds.push(toID(name.slice(prefix.length)) + suffix);
      formIds.push(baseId + suffix);
    }
    if (rawName.includes(prefix)) {
      formIds.push(baseId + suffix);
    }
  }

  if (name.startsWith("Mega ")) {
    const rest = name.slice(5);
    const restId = toID(rest.replace(/ X$/, "").replace(/ Y$/, ""));
    if (name.endsWith(" X")) formIds.push(restId + "megax");
    else if (name.endsWith(" Y")) formIds.push(restId + "megay");
    else formIds.push(restId + "mega");
  }

  if (name.startsWith("Primal ")) {
    formIds.push(toID(name.slice(7)) + "primal");
  }

  // Cas où le fichier Scalemons nomme seulement la forme, sans répéter l'espèce.
  // Ex. "Galarian Standard Mode" / "Combat Breed".
  if (baseId === "darmanitan" && dataId.includes("galarianstandardmode")) formIds.push("darmanitangalar");
  if (baseId === "darmanitan" && dataId.includes("galarianzenmode")) formIds.push("darmanitangalarzen");
  if (baseId === "tauros" && dataId.includes("combatbreed")) formIds.push("taurospaldeacombat");
  if (baseId === "tauros" && dataId.includes("blazebreed")) formIds.push("taurospaldeablaze");
  if (baseId === "tauros" && dataId.includes("aquabreed")) formIds.push("taurospaldeaaqua");

  // Identifiants directs potentiels, moins prioritaires que les formes Showdown canoniques.
  formIds.push(toID(name));
  formIds.push(toID(rawName));

  // Fallback final seulement : espèce de base.
  baseIds.push(baseId);

  return [...new Set([...formIds, ...baseIds].filter(Boolean))];
}

function findShowdownEntry(p, psData, psEntries) {
  for (const id of candidateShowdownIds(p)) {
    if (psData[id]) return {id, entry: psData[id]};
  }

  const sameNum = psEntries.filter(([id, e]) => Number(e.num) === Number(p.number));
  const exact = sameNum.filter(([id, e]) => sameTypes(e.types || [], p.types || []) && sameBaseStats(e.baseStats || {}, p.baseStats || {}));
  if (exact.length === 1) return {id: exact[0][0], entry: exact[0][1]};

  const exactStats = sameNum.filter(([id, e]) => sameBaseStats(e.baseStats || {}, p.baseStats || {}));
  if (exactStats.length === 1) return {id: exactStats[0][0], entry: exactStats[0][1]};

  return null;
}

function mergePokedexData(psData) {
  const psEntries = Object.entries(psData || {});
  let matched = 0;
  for (const p of DATA) {
    const match = findShowdownEntry(p, psData, psEntries);
    if (!match) {
      p.abilities = [];
      p.baseAbilities = [];
      p.psid = "";
      continue;
    }
    p.psid = match.id;
    p.abilities = [...new Set(Object.values(match.entry.abilities || {}).filter(Boolean))];
    p.baseAbilities = getBaseAbilitiesForDisplay(p, psData);
    if (p.abilities.length) matched += 1;
  }
  POKEDEX_READY = true;
  populateAbilities();
  console.log(`Données Pokédex Showdown chargées pour ${matched}/${DATA.length} entrées.`);
}

function candidateLearnsetIds(p) {
  const ids = new Set(candidateShowdownIds(p));
  if (p.psid) ids.add(p.psid);
  if (p.baseSpecies) ids.add(toID(p.baseSpecies));

  // Certaines formes héritent en pratique du learnset de l'espèce de base dans le Dex National.
  // On inclut donc l'espèce de base comme fallback, utile notamment pour les Méga/Primales.
  return [...ids].filter(Boolean);
}

function mergeLearnsets(learnsets) {
  let matched = 0;
  for (const p of DATA) {
    const moveIds = new Set(p.moveIds || []);
    for (const id of candidateLearnsetIds(p)) {
      const learnset = learnsets?.[id]?.learnset;
      if (!learnset) continue;
      Object.keys(learnset).forEach(m => moveIds.add(m));
    }
    p.moveIds = [...moveIds].sort();
    if (p.moveIds.length) matched += 1;
  }
  LEARNSETS_READY = true;
  console.log(`Learnsets NatDex chargés pour ${matched}/${DATA.length} entrées.`);
}

function mergeMoveSplitData(splitData) {
  PS_NATDEX_MOVE_SPLIT = splitData || {};
  let matched = 0;
  for (const p of DATA) {
    let split = null;
    for (const id of candidateLearnsetIds(p)) {
      if (PS_NATDEX_MOVE_SPLIT[id]) {
        split = PS_NATDEX_MOVE_SPLIT[id];
        break;
      }
    }
    if (!split) continue;

    const useful = (split.moves || []).map(name => ({ id: toID(name), name })).filter(x => x.id);
    const useless = (split.usuallyUselessMoves || []).map(name => ({ id: toID(name), name })).filter(x => x.id);
    p.psMoveSplit = { moves: useful, usuallyUselessMoves: useless };
    p.moveIds = [...new Set([...useful, ...useless].map(x => x.id))].sort();
    for (const move of [...useful, ...useless]) MOVE_NAMES_BY_ID[move.id] = move.name;
    matched += 1;
  }
  LEARNSETS_READY = matched > 0;
  console.log(`Séparation PS NatDex moves/useless chargée pour ${matched}/${DATA.length} entrées.`);
}

function populateMoves(movesData) {
  MOVES_DATA_BY_ID = {};
  for (const [id, move] of Object.entries(movesData || {})) {
    MOVES_DATA_BY_ID[toID(id)] = move || {};
    if (move?.name) MOVES_DATA_BY_ID[toID(move.name)] = move || {};
  }
  if (!els.moveOptions) return;
  const extractedNames = {...MOVE_NAMES_BY_ID};
  MOVE_NAMES_BY_ID = {...extractedNames};
  const moveNames = Object.entries(movesData || {})
    .map(([id, m]) => {
      const name = m?.name || id;
      MOVE_NAMES_BY_ID[toID(name)] = name;
      MOVE_NAMES_BY_ID[id] = name;
      return name;
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  els.moveOptions.innerHTML = moveNames.map(m => `<option value="${escapeHtml(m)}"></option>`).join("");
  SELECTED_MOVES = SELECTED_MOVES.map(m => ({ ...m, name: displayMoveName(m.id, m.name) }));
  renderMoveChips();
  MOVES_READY = true;
}

function populateTypes() {
  const types = [...new Set(DATA.flatMap(p => p.types || []))].sort();
  for (const select of [els.typeFilterA, els.typeFilterB]) {
    for (const type of types) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    }
  }
}

function populateAbilities() {
  if (!els.abilityOptions) return;
  const abilities = [...new Set(DATA.flatMap(p => [...(p.abilities || []), ...(p.baseAbilities || [])]))].sort();
  els.abilityOptions.innerHTML = abilities.map(a => `<option value="${escapeHtml(a)}"></option>`).join("");
}

function passesFilters(p) {
  // Recherche tolérante : tirets/espaces acceptés et ordre des mots flexible pour
  // formes régionales, Méga et Primales. Les attaques restent filtrées par les bulles.
  if (!matchesSearchQuery(p, els.search.value)) return false;

  const typeA = els.typeFilterA.value;
  const typeB = els.typeFilterB.value;
  const pokemonTypes = p.types || [];

  if (typeA && !pokemonTypes.includes(typeA)) return false;
  if (typeB && !pokemonTypes.includes(typeB)) return false;
  if (typeA && typeB && typeA === typeB && pokemonTypes.length !== 1) return false;

  const abilityQ = normalize(els.abilityFilter?.value || "");
  if (abilityQ) {
    // Shared Power : pour les Méga/Primal, on veut aussi retrouver la forme
    // via les talents de base affichés entre parenthèses.
    // Exemple : Talent = Overgrow doit aussi sortir Mega Venusaur,
    // même si son talent actif une fois méga-évolué est Thick Fat.
    const abilities = normalize([...(p.abilities || []), ...(p.baseAbilities || [])].join(" "));
    if (!abilities.includes(abilityQ)) return false;
  }

  if (SELECTED_MOVES.length) {
    const moveIds = p.moveIds || [];
    if (!SELECTED_MOVES.every(move => moveIds.includes(move.id))) return false;
  }

  if (!passesStrategicFilters(p)) return false;

  for (const key of statKeys) {
    const min = Number(statInputs[key].value || 0);
    if (min && Number(p.scalemonsStats[key] || 0) < min) return false;
  }
  return true;
}

function sortResults(a, b) {
  const key = els.sortBy.value;
  const dir = els.sortDir.value === "asc" ? 1 : -1;

  let av, bv;
  if (key === "name") {
    av = a.name;
    bv = b.name;
    return dir * av.localeCompare(bv);
  }
  if (key === "number") {
    av = a.number || 0;
    bv = b.number || 0;
    return dir * (av - bv);
  }
  av = a.scalemonsStats[key] || 0;
  bv = b.scalemonsStats[key] || 0;
  return dir * (av - bv);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusLabel() {
  const dex = POKEDEX_READY ? "talents OK" : "talents en chargement/indisponibles";
  const ls = LEARNSETS_READY ? "attaques NatDex OK" : "attaques en chargement/indisponibles";
  return `${dex} · ${ls}`;
}

function renderTypes(p) {
  return (p.types || []).map(t => `<span class="type">${escapeHtml(t)}</span>`).join("");
}

function renderAbilities(p) {
  let abilities = (p.abilities && p.abilities.length)
    ? p.abilities.map(a => `<span class="ability">${escapeHtml(a)}</span>`).join("")
    : `<span class="muted">—</span>`;
  if (p.baseAbilities && p.baseAbilities.length) {
    abilities += `<span class="base-abilities">(${p.baseAbilities.map(a => `${escapeHtml(a)}<sup class="pre-transform-star">*</sup>`).join(", ")})</span>`;
  }
  return abilities;
}

function renderResultCount(filteredLength) {
  const ratio = DATA.length ? Math.round((filteredLength / DATA.length) * 100) : 0;
  els.count.innerHTML = `
    <strong>${filteredLength}</strong>
    <span>résultats sur ${DATA.length}</span>
    <small>${ratio}% · ${statusLabel()}</small>
  `;
}

function render() {
  const filtered = DATA.filter(passesFilters).sort(sortResults);
  renderResultCount(filtered.length);

  const visible = filtered.slice(0, 500);

  els.results.innerHTML = visible.map(p => {
    const s = p.scalemonsStats;
    const baseLine = p.baseSpecies && p.baseSpecies !== p.name
      ? `<span class="base">Base : ${escapeHtml(p.baseSpecies)}</span>`
      : "";
    const strategicMovesInline = renderStrategicMovesInline(p);
    const isOpen = String(ACTIVE_MOVE_BROWSER_UID || "") === String(p.uid);
    const mainRow = `<tr>
      <td>${p.number ?? ""}</td>
      <td><button type="button" class="name pokemon-name-button${isOpen ? " is-open" : ""}" data-pokemon-uid="${escapeHtml(p.uid)}" title="Voir les attaques de ${escapeHtml(p.name)}" aria-expanded="${isOpen ? "true" : "false"}">${escapeHtml(p.name)}</button>${strategicMovesInline}${baseLine}</td>
      <td>${renderTypes(p)}</td>
      <td>${renderAbilities(p)}</td>
      <td class="stat">${s.bst ?? ""}</td>
      <td class="stat">${s.hp ?? ""}</td>
      <td class="stat">${s.atk ?? ""}</td>
      <td class="stat">${s.def ?? ""}</td>
      <td class="stat">${s.spa ?? ""}</td>
      <td class="stat">${s.spd ?? ""}</td>
      <td class="stat">${s.spe ?? ""}</td>
    </tr>`;
    const browserRow = isOpen ? `<tr class="inline-move-browser-row"><td colspan="11">${renderInlineMoveBrowser(p)}</td></tr>` : "";
    return mainRow + browserRow;
  }).join("");

  if (els.mobileResults) {
    els.mobileResults.innerHTML = visible.map(p => {
      const s = p.scalemonsStats;
      const baseLine = p.baseSpecies && p.baseSpecies !== p.name
        ? `<span class="base">Base : ${escapeHtml(p.baseSpecies)}</span>`
        : "";
      const strategicMovesInline = renderStrategicMovesInline(p);
      const isOpen = String(ACTIVE_MOVE_BROWSER_UID || "") === String(p.uid);
      return `<article class="pokemon-card">
        <div class="card-topline">
          <div>
            <span class="number">#${p.number ?? ""}</span>
            <h2><button type="button" class="name pokemon-name-button${isOpen ? " is-open" : ""}" data-pokemon-uid="${escapeHtml(p.uid)}" title="Voir les attaques de ${escapeHtml(p.name)}" aria-expanded="${isOpen ? "true" : "false"}">${escapeHtml(p.name)}</button>${strategicMovesInline}</h2>
            ${baseLine}
          </div>
          <div class="card-types">${renderTypes(p)}</div>
        </div>
        <div class="card-abilities">${renderAbilities(p)}</div>
        <div class="card-stats">
          <span><b>BST</b>${s.bst ?? ""}</span>
          <span><b>PV</b>${s.hp ?? ""}</span>
          <span><b>ATQ</b>${s.atk ?? ""}</span>
          <span><b>DEF</b>${s.def ?? ""}</span>
          <span><b>SpA</b>${s.spa ?? ""}</span>
          <span><b>SpD</b>${s.spd ?? ""}</span>
          <span><b>VIT</b>${s.spe ?? ""}</span>
        </div>
        ${isOpen ? renderInlineMoveBrowser(p, true) : ""}
      </article>`;
    }).join("");
  }

  if (filtered.length > 500) {
    els.results.insertAdjacentHTML("beforeend",
      `<tr><td colspan="11">Affichage limité aux 500 premiers résultats. Ajoute un filtre pour réduire la liste.</td></tr>`
    );
    if (els.mobileResults) {
      els.mobileResults.insertAdjacentHTML("beforeend", `<p class="limit-note">Affichage limité aux 500 premiers résultats. Ajoute un filtre pour réduire la liste.</p>`);
    }
  }
}

function resetFilters() {
  els.search.value = "";
  els.typeFilterA.value = "";
  els.typeFilterB.value = "";
  els.abilityFilter.value = "";
  els.moveFilter.value = "";
  if (els.strategicFilter) els.strategicFilter.value = "";
  updateStrategicButtons();
  SELECTED_MOVES = [];
  for (const key of statKeys) statInputs[key].value = "";
  els.sortBy.value = "spe";
  els.sortDir.value = "desc";
  renderMoveChips();
  render();
}

const liveFilterInputs = [
  els.search, els.typeFilterA, els.typeFilterB, els.abilityFilter,
  els.sortBy, els.sortDir,
  els.minHp, els.minAtk, els.minDef, els.minSpa, els.minSpd, els.minSpe, els.minBst,
];

for (const el of liveFilterInputs) {
  if (!el) continue;
  el.addEventListener("input", render);
  el.addEventListener("change", render);
}

if (els.resetFilters) {
  els.resetFilters.addEventListener("click", resetFilters);
}

if (els.strategicRoleButtons) {
  els.strategicRoleButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".strategic-role-button");
    if (!button) return;
    toggleStrategicFilter(button.dataset.strategicFilter || "");
  });
}

if (els.moveFilter) {
  els.moveFilter.addEventListener("keydown", (event) => {
    if (["Enter", ",", ";"].includes(event.key)) {
      event.preventDefault();
      const parts = String(els.moveFilter.value || "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
      for (const part of parts) addMoveChip(part);
    }
  });

  els.moveFilter.addEventListener("blur", () => {
    const value = els.moveFilter.value.trim();
    if (!value) return;
    if (value.includes(",") || value.includes(";")) {
      value.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean).forEach(addMoveChip);
    }
  });
}

if (els.moveChips) {
  els.moveChips.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    removeMoveChip(chip.dataset.moveId);
  });
}


function handlePokemonNameClick(event) {
  const button = event.target.closest(".pokemon-name-button");
  if (!button) return;
  openMoveBrowser(button.dataset.pokemonUid || "");
}

function handleInlineMoveBrowserClick(event) {
  const root = event.target.closest(".inline-move-browser");

  const closeButton = event.target.closest(".inline-move-browser-close");
  if (closeButton) {
    closeMoveBrowser();
    return;
  }

  if (event.target.closest(".showdown-copy-button")) {
    copyShowdownExport(root);
    return;
  }

  if (event.target.closest(".showdown-clear-button")) {
    const p = getPokemonByUid(root?.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID);
    if (p) getExportSet(p).moves = [];
    renderMoveBrowserContent(root);
    return;
  }


  const evPresetButton = event.target.closest(".showdown-ev-preset-button");
  if (evPresetButton) {
    const p = getPokemonByUid(root?.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID);
    if (p) {
      const set = getExportSet(p);
      set.evs = evPresetButton.dataset.evsPreset || set.evs || "";
    }
    renderMoveBrowserContent(root);
    return;
  }

  const removeMoveButton = event.target.closest(".showdown-selected-move");
  if (removeMoveButton) {
    const p = getPokemonByUid(root?.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID);
    removeExportMove(p, removeMoveButton.dataset.exportRemoveMoveId || "");
    renderMoveBrowserContent(root);
    return;
  }

  const moveButton = event.target.closest(".inline-move-browser-move");
  if (!moveButton) return;
  const p = getPokemonByUid(root?.dataset?.pokemonUid || ACTIVE_MOVE_BROWSER_UID);
  toggleExportMove(p, moveButton.dataset.browserMoveId || "");
  renderMoveBrowserContent(root);
}

function handleInlineMoveBrowserInput(event) {
  const input = event.target.closest(".inline-move-browser-search");
  if (input) {
    const root = input.closest(".inline-move-browser");
    if (!root) return;
    renderMoveBrowserContent(root);
    return;
  }

  const exportInput = event.target.closest(".showdown-export-ability, .showdown-export-evs, .showdown-export-nature");
  if (exportInput) {
    const root = exportInput.closest(".inline-move-browser");
    updateExportSetFromControls(root);
  }
}

for (const root of [els.results, els.mobileResults]) {
  if (!root) continue;
  root.addEventListener("click", handlePokemonNameClick);
  root.addEventListener("click", handleInlineMoveBrowserClick);
  root.addEventListener("input", handleInlineMoveBrowserInput);
  root.addEventListener("change", handleInlineMoveBrowserInput);
}

function loadShowdownData() {
  return Promise.all([
    fetch(PS_POKEDEX_URL).then(r => r.json()),
    fetch(PS_LEARNSETS_URL).then(r => r.json()),
    fetch(PS_MOVES_URL).then(r => r.json()),
  ])
    .then(([pokedex, learnsets, moves]) => {
      mergePokedexData(pokedex);
      mergeLearnsets(learnsets);
      populateMoves(moves);
      populateAbilities();
      render();
    })
    .catch(err => {
      console.warn("Impossible de charger les données Pokémon Showdown.", err);
      POKEDEX_READY = false;
      LEARNSETS_READY = false;
      render();
    });
}

function bootWithScalemonsData(json) {
  DATA = json.map((p, index) => ({ ...p, uid: `${index}-${toID(p.name || p.rawName || p.id || index)}` }));
  const splitNode = document.getElementById("embeddedPsNatdexMoveSplit");
  if (splitNode?.textContent?.trim()) {
    try { mergeMoveSplitData(JSON.parse(splitNode.textContent)); }
    catch (err) { console.warn("Impossible de lire la séparation PS NatDex intégrée.", err); }
  }
  populateTypes();
  populateStrategicFilters();
  renderMoveChips();
  els.sortBy.value = "spe";
  els.sortDir.value = "desc";
  render();
  loadShowdownData();
}

try {
  const embedded = document.getElementById("embeddedScalemonsData");
  const json = JSON.parse(embedded.textContent);
  bootWithScalemonsData(json);
} catch (err) {
  console.error(err);
  els.count.textContent = "Erreur de chargement des données intégrées";
}
