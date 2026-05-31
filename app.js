let DATA = [];
let POKEDEX_READY = false;
let LEARNSETS_READY = false;
let MOVES_READY = false;
let SELECTED_MOVES = [];
let MOVE_NAMES_BY_ID = {};
let ACTIVE_STRATEGIC_FILTERS = new Set();

const PS_POKEDEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
const PS_LEARNSETS_URL = "https://play.pokemonshowdown.com/data/learnsets.json";
const PS_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";


const STRATEGIC_FILTERS = {
  setup: {
    label: "Setup",
    moves: [
      "Swords Dance", "Nasty Plot", "Dragon Dance", "Calm Mind", "Quiver Dance",
      "Bulk Up", "Shell Smash", "Shift Gear", "Coil", "Agility", "Rock Polish",
      "Autotomize", "Iron Defense", "Amnesia", "Work Up", "Growth", "Hone Claws",
      "Victory Dance", "Clangorous Soul", "No Retreat", "Tail Glow"
    ],
  },
  hazards: {
    label: "Hazards",
    moves: ["Stealth Rock", "Spikes", "Toxic Spikes", "Sticky Web", "Ceaseless Edge", "Stone Axe"],
  },
  removal: {
    label: "Removal",
    moves: ["Rapid Spin", "Defog", "Mortal Spin", "Tidy Up"],
  },
  pivot: {
    label: "Pivot",
    moves: ["U-turn", "Volt Switch", "Flip Turn", "Parting Shot", "Teleport", "Baton Pass", "Chilly Reception"],
  },
  recovery: {
    label: "Recovery",
    moves: [
      "Recover", "Roost", "Slack Off", "Soft-Boiled", "Wish", "Strength Sap",
      "Synthesis", "Moonlight", "Morning Sun", "Shore Up", "Milk Drink",
      "Heal Order", "Lunar Blessing", "Life Dew", "Jungle Healing", "Rest"
    ],
  },
  priority: {
    label: "Priority",
    moves: [
      "Extreme Speed", "Sucker Punch", "Bullet Punch", "Aqua Jet", "Ice Shard",
      "Mach Punch", "Shadow Sneak", "Vacuum Wave", "First Impression", "Quick Attack",
      "Accelerock", "Jet Punch", "Water Shuriken", "Grassy Glide", "Fake Out",
      "Thunderclap", "Upper Hand", "Feint"
    ],
  },
};

const STRATEGIC_MOVE_IDS = Object.fromEntries(
  Object.entries(STRATEGIC_FILTERS).map(([key, cfg]) => [key, cfg.moves.map(toID)])
);

const statKeys = ["hp", "atk", "def", "spa", "spd", "spe", "bst"];
const els = {
  search: document.querySelector("#search"),
  typeFilterA: document.querySelector("#typeFilterA"),
  typeFilterB: document.querySelector("#typeFilterB"),
  abilityFilter: document.querySelector("#abilityFilter"),
  abilityOptions: document.querySelector("#abilityOptions"),
  moveFilter: document.querySelector("#moveFilter"),
  moveOptions: document.querySelector("#moveOptions"),
  moveChips: document.querySelector("#moveChips"),
  resetFilters: document.querySelector("#resetFilters"),
  strategicFilters: document.querySelector("#strategicFilters"),
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

function pokemonHasStrategicRole(p, role) {
  const requiredMoveIds = STRATEGIC_MOVE_IDS[role] || [];
  if (!requiredMoveIds.length) return true;
  const moveIds = p.moveIds || [];
  return requiredMoveIds.some(moveId => moveIds.includes(moveId));
}

function renderStrategicButtons() {
  if (!els.strategicFilters) return;
  els.strategicFilters.querySelectorAll(".strategic-button").forEach(button => {
    const role = button.dataset.role;
    button.classList.toggle("active", ACTIVE_STRATEGIC_FILTERS.has(role));
    button.setAttribute("aria-pressed", ACTIVE_STRATEGIC_FILTERS.has(role) ? "true" : "false");
  });
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

  if (ACTIVE_STRATEGIC_FILTERS.size) {
    for (const role of ACTIVE_STRATEGIC_FILTERS) {
      if (!pokemonHasStrategicRole(p, role)) return false;
    }
  }

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
    return `<tr>
      <td>${p.number ?? ""}</td>
      <td><span class="name">${escapeHtml(p.name)}</span>${baseLine}</td>
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
      return `<article class="pokemon-card">
        <div class="card-topline">
          <div>
            <span class="number">#${p.number ?? ""}</span>
            <h2>${escapeHtml(p.name)}</h2>
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
  SELECTED_MOVES = [];
  ACTIVE_STRATEGIC_FILTERS.clear();
  renderStrategicButtons();
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

if (els.strategicFilters) {
  els.strategicFilters.addEventListener("click", (event) => {
    const button = event.target.closest(".strategic-button");
    if (!button) return;
    const role = button.dataset.role;
    if (ACTIVE_STRATEGIC_FILTERS.has(role)) ACTIVE_STRATEGIC_FILTERS.delete(role);
    else ACTIVE_STRATEGIC_FILTERS.add(role);
    renderStrategicButtons();
    render();
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
    renderMoveChips();
    renderStrategicButtons();
    els.sortBy.value = "spe";
    els.sortDir.value = "desc";
    render();
    loadShowdownData();
  })
  .catch(err => {
    console.error(err);
    els.count.textContent = "Erreur de chargement";
  });
