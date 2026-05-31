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
const els = {
  search: document.querySelector("#search"),
  typeFilterA: document.querySelector("#typeFilterA"),
  typeFilterB: document.querySelector("#typeFilterB"),
  abilityFilter: document.querySelector("#abilityFilter"),
  abilityOptions: document.querySelector("#abilityOptions"),
  moveFilter: document.querySelector("#moveFilter"),
  moveOptions: document.querySelector("#moveOptions"),
  moveChips: document.querySelector("#moveChips"),
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
  const ids = new Set();
  const name = p.name || "";
  const base = p.baseSpecies || name;
  ids.add(toID(name));
  ids.add(toID(p.rawName));
  ids.add(toID(base));

  const prefixes = [
    ["Alolan ", "alola"],
    ["Galarian ", "galar"],
    ["Hisuian ", "hisui"],
    ["Paldean ", "paldea"],
  ];
  for (const [prefix, suffix] of prefixes) {
    if (name.startsWith(prefix)) ids.add(toID(name.slice(prefix.length)) + suffix);
  }

  if (name.startsWith("Mega ")) {
    const rest = name.slice(5);
    const restId = toID(rest.replace(/ X$/, "").replace(/ Y$/, ""));
    if (name.endsWith(" X")) ids.add(restId + "megax");
    else if (name.endsWith(" Y")) ids.add(restId + "megay");
    else ids.add(restId + "mega");
  }
  if (name.startsWith("Primal ")) ids.add(toID(name.slice(7)) + "primal");

  return [...ids].filter(Boolean);
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
      p.psid = "";
      continue;
    }
    p.psid = match.id;
    p.abilities = [...new Set(Object.values(match.entry.abilities || {}).filter(Boolean))];
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
  const abilities = [...new Set(DATA.flatMap(p => p.abilities || []))].sort();
  els.abilityOptions.innerHTML = abilities.map(a => `<option value="${escapeHtml(a)}"></option>`).join("");
}

function passesFilters(p) {
  const q = normalize(els.search.value);
  const abilityBlob = (p.abilities || []).join(" ");
  // La recherche générale reste volontairement légère : nom, forme, numéro, talents.
  // Les attaques sont filtrées par les bulles pour éviter de ralentir toute la page à chaque frappe.
  const nameBlob = normalize([p.name, p.baseSpecies, p.rawName, p.number, abilityBlob].join(" "));
  if (q && !nameBlob.includes(q)) return false;

  const typeA = els.typeFilterA.value;
  const typeB = els.typeFilterB.value;
  const pokemonTypes = p.types || [];

  if (typeA && !pokemonTypes.includes(typeA)) return false;
  if (typeB && !pokemonTypes.includes(typeB)) return false;
  if (typeA && typeB && typeA === typeB && pokemonTypes.length !== 1) return false;

  const abilityQ = normalize(els.abilityFilter?.value || "");
  if (abilityQ) {
    const abilities = normalize((p.abilities || []).join(" "));
    if (!abilities.includes(abilityQ)) return false;
  }

  if (SELECTED_MOVES.length) {
    const moveIds = p.moveIds || [];
    if (!SELECTED_MOVES.every(move => moveIds.includes(move.id))) return false;
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

function render() {
  const filtered = DATA.filter(passesFilters).sort(sortResults);
  els.count.textContent = `${filtered.length} / ${DATA.length} résultats — ${statusLabel()}`;

  els.results.innerHTML = filtered.slice(0, 500).map(p => {
    const s = p.scalemonsStats;
    const baseLine = p.baseSpecies && p.baseSpecies !== p.name
      ? `<span class="base">Base : ${escapeHtml(p.baseSpecies)}</span>`
      : "";
    const abilities = (p.abilities && p.abilities.length)
      ? p.abilities.map(a => `<span class="ability">${escapeHtml(a)}</span>`).join("")
      : `<span class="muted">—</span>`;
    return `<tr>
      <td>${p.number ?? ""}</td>
      <td><span class="name">${escapeHtml(p.name)}</span>${baseLine}</td>
      <td>${(p.types || []).map(t => `<span class="type">${escapeHtml(t)}</span>`).join("")}</td>
      <td>${abilities}</td>
      <td class="stat">${s.bst ?? ""}</td>
      <td class="stat">${s.hp ?? ""}</td>
      <td class="stat">${s.atk ?? ""}</td>
      <td class="stat">${s.def ?? ""}</td>
      <td class="stat">${s.spa ?? ""}</td>
      <td class="stat">${s.spd ?? ""}</td>
      <td class="stat">${s.spe ?? ""}</td>
    </tr>`;
  }).join("");

  if (filtered.length > 500) {
    els.results.insertAdjacentHTML("beforeend",
      `<tr><td colspan="11">Affichage limité aux 500 premiers résultats. Ajoute un filtre pour réduire la liste.</td></tr>`
    );
  }
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
    els.sortBy.value = "spe";
    els.sortDir.value = "desc";
    render();
    loadShowdownData();
  })
  .catch(err => {
    console.error(err);
    els.count.textContent = "Erreur de chargement";
  });
