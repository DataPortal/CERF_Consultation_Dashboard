console.log("✅ table.js (fix) chargé");

let ALL = [];
let FILTERED = [];

function uniq(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
}
function buildSelect(id, values){
  const sel = document.getElementById(id);
  if(!sel) return;
  const current = sel.value || "__all__";
  sel.innerHTML = `<option value="__all__">Toutes</option>`;
  values.forEach(v=>{
    const o=document.createElement("option");
    o.value=v; o.textContent=v;
    sel.appendChild(o);
  });
  sel.value = values.includes(current) ? current : "__all__";
}
function matchesQuery(obj, q){
  if(!q) return true;
  const s = JSON.stringify(obj).toLowerCase();
  return s.includes(q.toLowerCase());
}
function safe(v){
  if(v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

function sortRows(rows, mode){
  const r = rows.slice();
  const getDate = (x)=> (x.date_interview || "").toString();
  const getOrg = (x)=> (x.organisation || "").toString().toLowerCase();
  const getProv = (x)=> (x.province_label || "").toString().toLowerCase();

  if(mode === "date_asc") r.sort((a,b)=> getDate(a).localeCompare(getDate(b)));
  if(mode === "date_desc") r.sort((a,b)=> getDate(b).localeCompare(getDate(a)));
  if(mode === "org_asc") r.sort((a,b)=> getOrg(a).localeCompare(getOrg(b)));
  if(mode === "prov_asc") r.sort((a,b)=> getProv(a).localeCompare(getProv(b)));
  return r;
}

function applyFilters(){
  const org = document.getElementById("orgFilter")?.value || "__all__";
  const prov = document.getElementById("provFilter")?.value || "__all__";
  const q = document.getElementById("q")?.value || "";
  const sortBy = document.getElementById("sortBy")?.value || "date_desc";

  FILTERED = ALL.filter(r=>{
    const okOrg = (org === "__all__") || (r.org_type_label === org);
    const okProv = (prov === "__all__") || (r.province_label === prov);
    const okQ = matchesQuery(r, q);
    return okOrg && okProv && okQ;
  });

  FILTERED = sortRows(FILTERED, sortBy);

  const kpiVisible = document.getElementById("kpiVisible");
  if(kpiVisible) kpiVisible.textContent = FILTERED.length.toString();

  const kpiScope = document.getElementById("kpiScope");
  if(kpiScope) kpiScope.textContent = (org === "__all__" ? "Toutes" : org);

  renderTable();
}

function renderTable(){
  const wrap = document.getElementById("tableWrap");
  if(!wrap) return;

  if(!FILTERED.length){
    wrap.innerHTML = `<div class="item"><div class="item-title">Aucune réponse ne correspond aux filtres.</div></div>`;
    return;
  }

  const COLS = [
    ["date_interview", "Date"],
    ["organisation", "Organisation"],
    ["org_type_label", "Type org."],
    ["cluster_label", "Clusters"],
    ["province_label", "Province (base)"],
    ["admin2", "Territoire/adm2"],
    ["other_provinces_label", "Autres provinces"],
    ["service_top1_label", "Top1 service"],
    ["service_top2_label", "Top2 service"],
    ["service_top3_label", "Top3 service"],
    ["referral_gravity_label", "Gravité rupture"],
    ["restore_time_label", "Délai rétablissement"],
    ["approaches_label", "Approches efficaces"],
    ["additionality_label", "Additionalité (axes)"],
    ["innovation_level_label", "Niveau innovation"],
    ["obstacles_label", "Obstacles WLO"],
    ["governance_label", "Gouvernance"],
    ["capacity_label", "Besoins capacités"],
    ["priority_areas_label", "Zones prioritaires"],
    ["underserved_label", "Groupes sous-desservis"],
    ["meca_label", "Mécanismes AAP"],
    ["feedback_channel_label", "Canal feedback"],
    ["risks_label", "Risques opérationnels"],
    ["funds_label", "Fonds à articuler"],
    ["critical_need_label", "Besoin critique"],
    ["digital_adv_label", "Avantages digital"],
    ["digital_lim_label", "Limites digital"],
    ["un_support_label", "Appui UN attendu"],

    ["a1_where", "Où (service)"],
    ["a2_where", "Où (référencement)"],
    ["b1_explain", "Explication additionalité"],
    ["b2_explain", "Explication innovation"],
    ["toc", "Théorie du changement"],
    ["c1_solutions", "Solutions obstacles WLO"],
    ["c4_coordination", "Coordination (narratif)"],
    ["saddd", "SADDD (narratif)"],
    ["trust_plus", "Confiance (renforce)"],
    ["trust_minus", "Confiance (fragilise)"],
    ["e1_mitigation", "Mitigation (narratif)"],
    ["e3_results", "Résultats 3/6/12 mois (narratif)"],
    ["f1_strengthen", "Digital – amélioration (narratif)"],
    ["f2_details", "Appui UN – détails (narratif)"],
  ];

  const thead = `
    <thead>
      <tr>
        ${COLS.map(([,label]) => `<th>${label}</th>`).join("")}
      </tr>
    </thead>`;

  const tbody = `
    <tbody>
      ${FILTERED.map(r => `
        <tr>
          ${COLS.map(([k]) => `<td>${safe(r[k])}</td>`).join("")}
        </tr>
      `).join("")}
    </tbody>`;

  wrap.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        ${thead}
        ${tbody}
      </table>
    </div>
  `;
}

function exportCSV(){
  if(!FILTERED.length) return;

  const cols = Object.keys(FILTERED[0]);
  const esc = (v) => `"${(v ?? "").toString().replace(/"/g,'""')}"`;

  const lines = [cols.join(",")];
  FILTERED.forEach(r => lines.push(cols.map(c => esc(r[c])).join(",")));

  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "CERF_table_complete.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(){
  const btn = document.getElementById('btnPdf');
  btn?.addEventListener('click', async () => {
    const report = document.getElementById('report');
    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(report, { scale: 2, useCORS:true, backgroundColor:"#ffffff" });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p','mm','a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();

    const imgW = w;
    const imgH = canvas.height * imgW / canvas.width;

    let y = 0;
    let remaining = imgH;

    pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH);
    remaining -= h;

    while(remaining > 0){
      pdf.addPage();
      y = -(imgH - remaining);
      pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH);
      remaining -= h;
    }

    pdf.save("CERF_table_complete.pdf");
  });
}

fetch(`records.json?v=${Date.now()}`)
  .then(r => { if(!r.ok) throw new Error("records.json introuvable"); return r.json(); })
  .then(payload => {
    ALL = payload.records || [];

    const kpiTotal = document.getElementById("kpiTotal");
    if(kpiTotal) kpiTotal.textContent = ALL.length.toString();

    buildSelect("orgFilter", uniq(ALL.map(r => r.org_type_label)));
    buildSelect("provFilter", uniq(ALL.map(r => r.province_label)));

    FILTERED = ALL.slice();
    const kpiVisible = document.getElementById("kpiVisible");
    if(kpiVisible) kpiVisible.textContent = FILTERED.length.toString();

    ["orgFilter","provFilter","sortBy"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
    document.getElementById("q")?.addEventListener("input", applyFilters);

    document.getElementById("btnCsv")?.addEventListener("click", exportCSV);
    exportPDF();

    applyFilters();
  })
  .catch(err => {
    console.error(err);
    const wrap = document.getElementById("tableWrap");
    if(wrap){
      wrap.innerHTML = `<div class="item"><div class="item-title">Erreur de chargement. Vérifie records.json.</div></div>`;
    }
  });
