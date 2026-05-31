let DATA = [];
let POKEDEX_READY = false;
let LEARNSETS_READY = false;
let MOVES_READY = false;
let SELECTED_MOVES = [];
let MOVE_NAMES_BY_ID = {};

const PS_POKEDEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
const PS_LEARNSETS_URL = "https://play.pokemonshowdown.com/data/learnsets.json";
const PS_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe", "bst"];

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
  if (MOVE_NAMES_BY_ID[moveId]) return MOVE_NAMES_BY_ID[moveId];
  if (fallback.trim()) return fallback.trim();
  return moveId.replace(/(^|\s)\S/g, c => c.toUpperCase());
}

function activeStrategicLabel() {
  const key = els.strategicFilter?.value || "";
  return STRATEGIC_FILTERS[key]?.label || "";
}

function updateStrategicButtons() {
  if (!els.strategicRoleButtons) return;
  const activeKey = els.strategicFilter?.value || "";
  for (const button of els.strategicRoleButtons.querySelectorAll(".strategic-role-button")) {
    const isActive = button.dataset.strategicFilter === activeKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function setStrategicFilter(key) {
  if (!els.strategicFilter) return;
  const nextKey = els.strategicFilter.value === key ? "" : key;
  els.strategicFilter.value = nextKey;
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
  const key = els.strategicFilter?.value || "";
  if (!key || !STRATEGIC_FILTERS[key]) return [];
  return STRATEGIC_FILTERS[key].moves.map(toID).filter(Boolean);
}

function getMatchedStrategicMoveIds(p) {
  const strategicMoveIds = getActiveStrategicMoveIds();
  if (!strategicMoveIds.length) return [];
  const pokemonMoveIds = new Set(p.moveIds || []);
  return strategicMoveIds.filter(moveId => pokemonMoveIds.has(moveId));
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
    const moveIds = new Set();
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

function populateMoves(movesData) {
  if (!els.moveOptions) return;
  MOVE_NAMES_BY_ID = {};
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

  if (els.strategicFilter?.value && !getMatchedStrategicMoveIds(p).length) return false;

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
    return `<tr>
      <td>${p.number ?? ""}</td>
      <td><span class="name">${escapeHtml(p.name)}</span>${strategicMovesInline}${baseLine}</td>
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
  }).join("");

  if (els.mobileResults) {
    els.mobileResults.innerHTML = visible.map(p => {
      const s = p.scalemonsStats;
      const baseLine = p.baseSpecies && p.baseSpecies !== p.name
        ? `<span class="base">Base : ${escapeHtml(p.baseSpecies)}</span>`
        : "";
      const strategicMovesInline = renderStrategicMovesInline(p);
      return `<article class="pokemon-card">
        <div class="card-topline">
          <div>
            <span class="number">#${p.number ?? ""}</span>
            <h2>${escapeHtml(p.name)}${strategicMovesInline}</h2>
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
    setStrategicFilter(button.dataset.strategicFilter || "");
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

fetch("data/scalemons.json")
  .then(r => r.json())
  .then(json => {
    DATA = json;
    populateTypes();
    populateStrategicFilters();
    renderMoveChips();
    els.sortBy.value = "spe";
    els.sortDir.value = "desc";
    render();
    loadShowdownData();
  })
  .catch(err => {
    console.error(err);
    els.count.textContent = "Erreur de chargement";
  });
