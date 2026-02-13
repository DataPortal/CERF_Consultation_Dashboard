console.log("✅ table.js chargé");

let ALL = [];
let FILTERED = [];

function fmtDate(iso){
  if(!iso) return "";
  try { return iso.toString().slice(0,19).replace('T',' '); } catch(e) { return iso; }
}

function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
}

function buildSelect(id, values){
  const sel = document.getElementById(id);
  if(!sel) return;
  const current = sel.value || '__all__';
  sel.innerHTML = `<option value="__all__">Toutes</option>`;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  sel.value = values.includes(current) ? current : '__all__';
}

function matchesQuery(obj, q){
  if(!q) return true;
  const s = JSON.stringify(obj).toLowerCase();
  return s.includes(q.toLowerCase());
}

function applyFilters(){
  const org = document.getElementById('orgFilter')?.value || '__all__';
  const prov = document.getElementById('provinceFilter')?.value || '__all__';
  const q = document.getElementById('q')?.value || '';

  FILTERED = ALL.filter(r => {
    const okOrg = (org === '__all__') || (r.org_type_label === org || r.org_type === org);
    const okProv = (prov === '__all__') || (r.province_base_label === prov || r.province_base === prov);
    const okQ = matchesQuery(r, q);
    return okOrg && okProv && okQ;
  });

  renderList();
}

function kv(label, value){
  const v = (value === null || value === undefined || value === "") ? "—" : value;
  return `<div class="k">${label}</div><div class="v">${v}</div>`;
}

function renderList(){
  document.getElementById('rowsCount').textContent = FILTERED.length.toString();
  document.getElementById('rowsMeta').textContent = `Filtré sur ${ALL.length} contributions`;

  const list = document.getElementById('list');
  list.innerHTML = '';

  if(FILTERED.length === 0){
    list.innerHTML = `<div class="item"><div class="item-title">Aucune réponse ne correspond aux filtres.</div></div>`;
    return;
  }

  // latest first
  const rows = FILTERED.slice().sort((a,b) => (b.submission_time||'').localeCompare(a.submission_time||''));

  rows.forEach((r, idx) => {
    const org = r.org_type_label || r.org_type || "—";
    const prov = r.province_base_label || r.province_base || "—";
    const terr = r.territoire_base_label || r.territoire_base || "—";

    const top1 = r.service_top1_label || r.service_top1 || "—";
    const top2 = r.service_top2_label || r.service_top2 || "—";
    const top3 = r.service_top3_label || r.service_top3 || "—";
    const grav = r.rupture_gravite_label || r.rupture_gravite || "—";

    const item = document.createElement('div');
    item.className = 'item';

    item.innerHTML = `
      <div class="item-head">
        <div>
          <span class="badge uw">UN Women</span>
          <span class="badge unfpa">UNFPA</span>
        </div>
        <div>
          <div class="item-title">Réponse #${idx+1} — ${org}</div>
          <div class="item-meta">${fmtDate(r.submission_time)} • Province base: <b>${prov}</b> • Territoire: ${terr}</div>
        </div>
        <div>
          <div class="item-meta"><b>Top services</b>: ${top1} / ${top2} / ${top3}</div>
          <div class="item-meta"><b>Gravité</b>: ${grav}</div>
        </div>
        <div style="text-align:right">
          <button class="btn btn-ghost" data-toggle="1">Détails</button>
        </div>
      </div>

      <div class="details">
        <div class="kv">
          ${kv("Nom de l’organisation", r.org_name || "—")}
          ${kv("Type d’organisation", org)}
          ${kv("Province base", prov)}
          ${kv("Territoire / Commune", terr)}
          ${kv("Consentement", r.consent_label || r.consent || "—")}

          ${kv("Service Top 1", top1)}
          ${kv("Service Top 2", top2)}
          ${kv("Service Top 3", top3)}
          ${kv("Rupture – gravité", grav)}

          ${kv("Approches efficaces (narratif)", r.approches_efficaces || "—")}
          ${kv("Valeur ajoutée (narratif)", r.valeur_ajoutee || "—")}
          ${kv("Effet systémique (narratif)", r.effet_systemique || "—")}

          ${kv("Obstacles WLO", r.obstacles_wlo_label || r.obstacles_wlo || "—")}
          ${kv("Solutions WLO (narratif)", r.solutions_wlo || "—")}

          ${kv("Provinces prioritaires", r.provinces_prioritaires_label || r.provinces_prioritaires || "—")}
          ${kv("Groupes sous-desservis", r.groupes_sous_servis_label || r.groupes_sous_servis || "—")}
          ${kv("Mécanisme feedback (narratif)", r.mecanisme_feedback || "—")}

          ${kv("Risques opérationnels", r.risques_operationnels_label || r.risques_operationnels || "—")}
          ${kv("Mesures de mitigation (narratif)", r.mesures_mitigation || "—")}

          ${kv("Avantages digital", r.avantages_digital_label || r.avantages_digital || "—")}
          ${kv("Limites digital", r.limites_digital_label || r.limites_digital || "—")}
          ${kv("Apport digital (narratif)", r.apport_digital || "—")}
        </div>
      </div>
    `;

    item.querySelector('button[data-toggle]')?.addEventListener('click', () => {
      item.classList.toggle('open');
    });

    list.appendChild(item);
  });
}

function exportCSV(){
  // Flatten minimal CSV with main columns + narratives (safe)
  const cols = [
    "submission_time","org_name","org_type_label","province_base_label","territoire_base_label","consent",
    "service_top1_label","service_top2_label","service_top3_label","rupture_gravite_label",
    "approches_efficaces","valeur_ajoutee","effet_systemique",
    "obstacles_wlo","solutions_wlo",
    "provinces_prioritaires","groupes_sous_servis","mecanisme_feedback",
    "risques_operationnels","mesures_mitigation",
    "avantages_digital","limites_digital","apport_digital"
  ];

  const esc = (v) => {
    const s = (v === null || v === undefined) ? "" : String(v);
    return `"${s.replace(/"/g,'""')}"`;
  };

  const lines = [];
  lines.push(cols.join(","));
  FILTERED.forEach(r => {
    lines.push(cols.map(c => esc(r[c])).join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.download = `CERF_reponses_${ts}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

fetch(`records.json?v=${Date.now()}`)
  .then(r => {
    if(!r.ok) throw new Error(`records.json introuvable (HTTP ${r.status}).`);
    return r.json();
  })
  .then(payload => {
    ALL = payload.records || [];
    FILTERED = ALL.slice();

    document.getElementById('lastUpdate').textContent = fmtDate(payload.generated_at || "");

    buildSelect('orgFilter', uniq(ALL.map(r => r.org_type_label).filter(Boolean)));
    buildSelect('provinceFilter', uniq(ALL.map(r => r.province_base_label).filter(Boolean)));

    document.getElementById('orgFilter')?.addEventListener('change', applyFilters);
    document.getElementById('provinceFilter')?.addEventListener('change', applyFilters);
    document.getElementById('q')?.addEventListener('input', applyFilters);
    document.getElementById('btnCsv')?.addEventListener('click', exportCSV);

    applyFilters();
  })
  .catch(err => {
    document.getElementById('list').innerHTML = `<div class="item"><div class="item-title">Erreur : ${err.message}</div></div>`;
  });
