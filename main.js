/* =========================================================
   main.js — CERF Consultation Dashboard (UN Women × UNFPA)
   ✅ Aligne les IDs avec TON index.html
   - Charge data.json (agrégats) + records.json (liste/table)
   - Graphiques: barres horizontales (%). Doughnut possible.
   - Couleurs: --uw-blue / --unfpa-orange
   - Affiche les % sur les graphiques si ChartDataLabels est chargé
   ========================================================= */

console.log("✅ main.js chargé");

/* ----------------------------
   Globals
---------------------------- */
let DATA = null;           // data.json
let CURRENT_SCOPE = null;  // summary ou by_org_type[key]
let RECORDS = [];          // records.json.records
let FILTERED = [];         // records filtrés
let charts = {};           // Chart.js instances

/* ----------------------------
   Theme helpers
---------------------------- */
function cssVar(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
const UW_BLUE = cssVar('--uw-blue', '#448BCA');
const UNFPA_ORANGE = cssVar('--unfpa-orange', '#F58220');

function setText(id, v){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = (v === null || v === undefined || v === "") ? "—" : String(v);
}
function safeNum(x){
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function safe(v){
  if(v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s ? s : "—";
}

function __status(html, ok=true){
  // supporte ton index.html actuel (pas de statusCard obligatoire)
  if(typeof window.__setStatus === "function") {
    window.__setStatus(html, ok);
    return;
  }
  // fallback discret en console
  if(ok) console.log("ℹ️", html);
  else console.warn("⚠️", html);
}

/* ----------------------------
   Chart.js availability
---------------------------- */
function hasChartJs(){ return typeof window.Chart !== "undefined"; }
function hasDataLabels(){ return typeof window.ChartDataLabels !== "undefined"; }

function destroyChart(canvasId){
  const c = charts[canvasId];
  if(c && typeof c.destroy === "function") c.destroy();
  delete charts[canvasId];
}

/* ----------------------------
   Data normalization (object -> labels/values)
---------------------------- */
function normalizeValues(obj){
  const entries = Object.entries(obj || {})
    .map(([k,v]) => [k, safeNum(v)])
    .filter(([,v]) => v > 0)
    .sort((a,b) => b[1] - a[1]);

  return {
    labels: entries.map(([k]) => k),
    values: entries.map(([,v]) => v)
  };
}

/* ----------------------------
   Charts
---------------------------- */
function barChart(canvasId, dataObj){
  if(!hasChartJs()){
    console.warn("Chart.js non chargé → chart ignoré:", canvasId);
    return;
  }
  destroyChart(canvasId);

  const el = document.getElementById(canvasId);
  if(!el) {
    console.warn("Canvas introuvable:", canvasId);
    return;
  }

  const { labels, values } = normalizeValues(dataObj);
  if(!labels.length){
    // si vide, on efface proprement
    const ctx = el.getContext("2d");
    if(ctx){
      ctx.clearRect(0, 0, el.width, el.height);
    }
    return;
  }

  const total = values.reduce((a,b)=>a+b,0);
  const dl = hasDataLabels();
  const pluginsArr = dl ? [ChartDataLabels] : [];

  charts[canvasId] = new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: UW_BLUE,
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.x ?? ctx.parsed ?? 0;
              const pct = total ? (v * 100 / total) : 0;
              return ` ${v} (${pct.toFixed(0)}%)`;
            }
          }
        },
        ...(dl ? {
          datalabels: {
            anchor: 'end',
            align: 'end',
            formatter: (value) => {
              if(!total) return '';
              const pct = (value * 100 / total);
              return `${pct.toFixed(0)}%`;
            },
            color: '#0f172a',
            font: { weight: '800', size: 11 },
            clamp: true
          }
        } : {})
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { autoSkip: false } }
      }
    },
    plugins: pluginsArr
  });
}

function doughnutChartWithPct(canvasId, dataObj){
  if(!hasChartJs()) return;
  destroyChart(canvasId);

  const el = document.getElementById(canvasId);
  if(!el) return;

  const { labels, values } = normalizeValues(dataObj);
  if(!labels.length) return;

  const total = values.reduce((a,b)=>a+b,0);
  const dl = hasDataLabels();
  const pluginsArr = dl ? [ChartDataLabels] : [];
  const colors = labels.map((_,i)=> (i % 2 === 0 ? UW_BLUE : UNFPA_ORANGE));

  charts[canvasId] = new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed || 0;
              const pct = total ? (v * 100 / total) : 0;
              return ` ${ctx.label}: ${v} (${pct.toFixed(0)}%)`;
            }
          }
        },
        ...(dl ? {
          datalabels: {
            display: (ctx) => {
              const v = ctx.dataset.data[ctx.dataIndex] || 0;
              if(!total) return false;
              const pct = (v * 100 / total);
              return pct >= 8;
            },
            formatter: (value) => {
              if(!total) return '';
              const pct = (value * 100 / total);
              return `${pct.toFixed(0)}%`;
            },
            color: '#ffffff',
            font: { weight: '800', size: 12 }
          }
        } : {})
      }
    },
    plugins: pluginsArr
  });
}

/* ----------------------------
   Charts mapping (✅ IDs = TON index.html)
---------------------------- */
function applyScopeToCharts(scope){
  // INTRO
  barChart("chartOrgTypes", scope.org_types);
  barChart("chartClusters", scope.clusters);
  barChart("chartProvinceBase", scope.province_base);

  // BLOC A
  barChart("chartTop1", scope.top_service_1);
  barChart("chartTop2", scope.top_service_2);
  barChart("chartTop3", scope.top_service_3);
  barChart("chartGravite", scope.referral_gravity);
  barChart("chartRestoreTime", scope.restore_time);
  barChart("chartApproaches", scope.approaches);

  // BLOC B
  barChart("chartAdditionality", scope.additionality);
  barChart("chartInnovation", scope.innovation_level);

  // BLOC C
  barChart("chartObstacles", scope.obstacles_wlo);
  barChart("chartGovernance", scope.governance_mechanisms);
  barChart("chartCapacity", scope.capacity_needs);

  // BLOC D
  barChart("chartPriorityAreas", scope.priority_areas);
  barChart("chartUnderserved", scope.underserved_groups);
  barChart("chartMeca", scope.accountability_mechanisms);
  barChart("chartFeedback", scope.feedback_channel);
  barChart("chartOtherProvinces", scope.other_provinces);

  // BLOC E
  barChart("chartRisks", scope.operational_risks);
  barChart("chartFunds", scope.funds_leverage);
  barChart("chartCriticalNeed", scope.critical_need);

  // BLOC F
  barChart("chartDigitalAdv", scope.digital_advantages);
  barChart("chartDigitalLim", scope.digital_limits);
  barChart("chartUNSupport", scope.un_support);

  // Exemple (si tu as un champ binaire dans data.json)
  // doughnutChartWithPct("someCanvasId", scope.some_binary);
}

/* ----------------------------
   Scope (type d’organisation) — utilise orgFilter (TON HTML)
---------------------------- */
function setScopeFromOrgFilter(){
  if(!DATA) return;

  const org = document.getElementById("orgFilter")?.value || "__all__";
  if(org === "__all__"){
    CURRENT_SCOPE = DATA.summary || {};
  } else {
    CURRENT_SCOPE = (DATA.by_org_type && DATA.by_org_type[org]) ? DATA.by_org_type[org] : (DATA.summary || {});
  }
  applyScopeToCharts(CURRENT_SCOPE || {});
}

/* ----------------------------
   Records UI (liste + filtres)
   - Filtre org/province + recherche libre
---------------------------- */
function matchesQuery(obj, q){
  if(!q) return true;
  const s = JSON.stringify(obj).toLowerCase();
  return s.includes(q.toLowerCase());
}

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
  // tente de conserver le choix courant
  if(values.includes(current)) sel.value = current;
}

function applyRecordFilters(){
  const org = document.getElementById("orgFilter")?.value || "__all__";
  const prov = document.getElementById("provinceFilter")?.value || "__all__";
  const q = document.getElementById("q")?.value || "";

  FILTERED = RECORDS.filter(r=>{
    const okOrg = (org === "__all__") || (r.org_type_label === org);
    const okProv = (prov === "__all__") || (r.province_label === prov);
    const okQ = matchesQuery(r, q);
    return okOrg && okProv && okQ;
  });

  // KPIs (TON HTML)
  setText("kpiTotal", RECORDS.length);
  setText("kpiRows", FILTERED.length);

  // Scope label (TON HTML) : combine org + province
  const scopeLabel = [
    (org === "__all__" ? "Toutes" : org),
    (prov === "__all__" ? null : prov)
  ].filter(Boolean).join(" • ");
  setText("kpiScope", scopeLabel || "Toutes");

  renderList();
}

function renderList(){
  const wrap = document.getElementById("list");
  if(!wrap) return;

  if(!FILTERED.length){
    wrap.innerHTML = `<div class="item"><div class="item-title">Aucune réponse ne correspond aux filtres.</div></div>`;
    return;
  }

  // Liste style “accordéon” (comme ton style.css)
  wrap.innerHTML = FILTERED
    .slice()
    .sort((a,b)=> String(b.date_interview||"").localeCompare(String(a.date_interview||"")))
    .map((r, idx)=> {
      const title = `${safe(r.organisation)} — ${safe(r.province_label)}`;
      const meta = [
        safe(r.date_interview),
        safe(r.org_type_label),
        safe(r.cluster_label),
        safe(r.admin2)
      ].filter(x=>x!=="—").join(" • ");

      const pills = [
        r.service_top1_label ? `<span class="pill blue">Top1: ${safe(r.service_top1_label)}</span>` : "",
        r.service_top2_label ? `<span class="pill blue">Top2: ${safe(r.service_top2_label)}</span>` : "",
        r.service_top3_label ? `<span class="pill blue">Top3: ${safe(r.service_top3_label)}</span>` : "",
        r.critical_need_label ? `<span class="pill orange">Critique: ${safe(r.critical_need_label)}</span>` : ""
      ].filter(Boolean).join("");

      // Champs narratifs principaux (adaptés à tes clés)
      const narratives = [
        ["Où (service)", r.a1_where],
        ["Où (référencement)", r.a2_where],
        ["Théorie du changement", r.toc],
        ["Solutions obstacles WLO", r.c1_solutions],
        ["Coordination", r.c4_coordination],
        ["SADDD", r.saddd],
        ["Confiance (renforce)", r.trust_plus],
        ["Confiance (fragilise)", r.trust_minus],
        ["Mitigation", r.e1_mitigation],
        ["Résultats 3/6/12 mois", r.e3_results],
        ["Digital – amélioration", r.f1_strengthen],
        ["Appui UN – détails", r.f2_details],
      ].filter(([,v]) => v && String(v).trim());

      const kv = [
        ["Territoire/adm2", r.admin2],
        ["Autres provinces", r.other_provinces_label],
        ["Gravité rupture", r.referral_gravity_label],
        ["Délai rétablissement", r.restore_time_label],
        ["Approches efficaces", r.approaches_label],
        ["Additionalité (axes)", r.additionality_label],
        ["Niveau innovation", r.innovation_level_label],
        ["Obstacles WLO", r.obstacles_label],
        ["Gouvernance", r.governance_label],
        ["Besoins capacités", r.capacity_label],
        ["Zones prioritaires", r.priority_areas_label],
        ["Groupes sous-desservis", r.underserved_label],
        ["Mécanismes AAP", r.meca_label],
        ["Canal feedback", r.feedback_channel_label],
        ["Risques opérationnels", r.risks_label],
        ["Fonds à articuler", r.funds_label],
        ["Besoin critique", r.critical_need_label],
        ["Avantages digital", r.digital_adv_label],
        ["Limites digital", r.digital_lim_label],
        ["Appui UN attendu", r.un_support_label],
      ].filter(([,v]) => v && String(v).trim());

      return `
        <div class="item" data-i="${idx}">
          <div class="item-head">
            <div>
              <div class="item-title">${title}</div>
              <div class="item-meta">${meta}</div>
              <div class="pills">${pills}</div>
            </div>
            <div style="display:flex; justify-content:flex-end;">
              <button class="btn" type="button" data-toggle="${idx}">Détails</button>
            </div>
          </div>
          <div class="details">
            <div class="kv">
              ${kv.map(([k,v])=>`
                <div class="k">${k}</div>
                <div class="v">${safe(v)}</div>
              `).join("")}
            </div>
            ${narratives.length ? `
              <div class="narrative" style="margin-top:12px;">
                <div class="k" style="margin-bottom:6px;">Narratifs</div>
                <ul>
                  ${narratives.map(([k,v])=>`<li><b>${k} :</b> ${safe(v)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

  // toggle
  wrap.querySelectorAll("[data-toggle]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = btn.getAttribute("data-toggle");
      const card = wrap.querySelector(`.item[data-i="${i}"]`);
      if(card) card.classList.toggle("open");
    });
  });
}

/* ----------------------------
   Export (CSV / PDF) — utilise FILTERED
---------------------------- */
function exportCSV(){
  if(!FILTERED.length) return;

  const cols = Object.keys(FILTERED[0] || {});
  const esc = (v) => `"${(v ?? "").toString().replace(/"/g,'""')}"`;

  const lines = [cols.join(",")];
  FILTERED.forEach(r => lines.push(cols.map(c => esc(r[c])).join(",")));

  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "CERF_dashboard_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(){
  const btn = document.getElementById('btnPdf');
  btn?.addEventListener('click', async () => {
    const report = document.getElementById('report');
    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(report, { scale: 2, useCORS:true });
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

    pdf.save("CERF_dashboard.pdf");
  });
}

/* ----------------------------
   Loaders
---------------------------- */
function loadDataJson(){
  const url = `data.json?v=${Date.now()}`;
  return fetch(url)
    .then(r => { if(!r.ok) throw new Error("data.json introuvable"); return r.json(); })
    .then(payload => {
      DATA = payload || {};
      CURRENT_SCOPE = DATA.summary || {};
      __status(`✅ data.json chargé. Chart.js=${hasChartJs()} / DataLabels=${hasDataLabels()}`, true);
      applyScopeToCharts(CURRENT_SCOPE);
    });
}

function loadRecordsJson(){
  const url = `records.json?v=${Date.now()}`;
  return fetch(url)
    .then(r => { if(!r.ok) throw new Error("records.json introuvable"); return r.json(); })
    .then(payload => {
      RECORDS = payload.records || [];
      FILTERED = RECORDS.slice();

      // build filter lists
      buildSelect("orgFilter", uniq(RECORDS.map(r => r.org_type_label)));
      buildSelect("provinceFilter", uniq(RECORDS.map(r => r.province_label)));

      applyRecordFilters();

      // listeners
      document.getElementById("orgFilter")?.addEventListener("change", ()=>{
        // orgFilter impacte la liste + scope charts (by_org_type)
        applyRecordFilters();
        setScopeFromOrgFilter();
      });
      document.getElementById("provinceFilter")?.addEventListener("change", applyRecordFilters);
      document.getElementById("q")?.addEventListener("input", applyRecordFilters);

      // exports
      document.getElementById("btnCsv")?.addEventListener("click", exportCSV);
      exportPDF();
      document.getElementById("btnPdf")?.disabled = false;

      __status(`✅ records.json chargé (${RECORDS.length} réponses).`, true);
    });
}

/* ----------------------------
   Boot
---------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Important: si plugin datalabels existe, on l’enregistre (sinon % peuvent ne pas s’afficher)
    try {
      if(window.Chart && window.ChartDataLabels) Chart.register(ChartDataLabels);
    } catch(e){
      console.warn("ChartDataLabels register failed:", e);
    }

    await loadDataJson();
    await loadRecordsJson();

    // set scope (orgFilter) après chargement records
    setScopeFromOrgFilter();

  } catch (err) {
    console.error(err);
    __status(`❌ Erreur de chargement: ${err.message || err}`, false);

    // fallback visuel simple si tu ajoutes un bloc plus tard
    const list = document.getElementById("list");
    if(list){
      list.innerHTML = `<div class="item"><div class="item-title">Erreur de chargement. Vérifie data.json / records.json et la console.</div></div>`;
    }
  }
});
