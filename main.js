/* =========================================================
   main.js — CERF Consultation Dashboard (UN Women × UNFPA)
   - Charge data.json (agrégats) + records.json (table)
   - Graphiques: doughnut (binaire) + barres horizontales (%)
   - Couleurs: --uw-blue / --unfpa-orange
   - Affiche les % sur les graphiques si ChartDataLabels est chargé
   ========================================================= */

/* ----------------------------
   Globals
---------------------------- */
console.log("✅ main.js chargé");

let DATA = null;          // contenu de data.json
let SUMMARY = null;       // DATA.summary
let CURRENT_SCOPE = null; // scope courant (summary ou by_org_type[x])
let charts = {};          // instances Chart.js

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

/* ----------------------------
   Chart.js availability
---------------------------- */
function hasChartJs(){
  return typeof window.Chart !== "undefined";
}
function hasDataLabels(){
  return typeof window.ChartDataLabels !== "undefined";
}

function destroyChart(canvasId){
  const c = charts[canvasId];
  if(c && typeof c.destroy === "function"){
    c.destroy();
  }
  delete charts[canvasId];
}

/* ----------------------------
   Data normalization (object -> labels/values)
---------------------------- */
function normalizeValues(obj){
  const entries = Object.entries(obj || {})
    .filter(([,v]) => safeNum(v) > 0)
    .sort((a,b) => safeNum(b[1]) - safeNum(a[1]));

  return {
    labels: entries.map(([k]) => k),
    values: entries.map(([,v]) => safeNum(v))
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

  const { labels, values } = normalizeValues(dataObj);
  const el = document.getElementById(canvasId);
  if(!el) return;

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
      indexAxis: 'y', // ✅ horizontal bars
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
  if(!hasChartJs()){
    console.warn("Chart.js non chargé → doughnut ignoré:", canvasId);
    return;
  }
  destroyChart(canvasId);

  const { labels, values } = normalizeValues(dataObj);
  const el = document.getElementById(canvasId);
  if(!el) return;

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
              return pct >= 8; // évite surcharge
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
   Scope application
---------------------------- */
function getScopeName(){
  const sel = document.getElementById("orgScope");
  if(!sel) return "Toutes";
  return sel.value === "__all__" ? "Toutes" : sel.value;
}

function setScope(scopeKey){
  if(!DATA) return;

  if(!scopeKey || scopeKey === "__all__"){
    CURRENT_SCOPE = DATA.summary || {};
  }else{
    CURRENT_SCOPE = (DATA.by_org_type && DATA.by_org_type[scopeKey]) ? DATA.by_org_type[scopeKey] : (DATA.summary || {});
  }

  // KPIs (adapte les IDs à ton HTML)
  setText("kpiTotal", safeNum((DATA.summary || {}).total_responses));
  setText("kpiVisible", safeNum((CURRENT_SCOPE || {}).total_responses));
  setText("kpiScope", getScopeName());

  applyScopeToCharts(CURRENT_SCOPE || {});
}

/* ----------------------------
   Chart mapping (IDs canvas -> keys data.json)
   ⚠️ IMPORTANT:
   - Les IDs ci-dessous doivent exister dans ton HTML (canvas id="...")
   - Les keys doivent exister dans data.json (summary / by_org_type)
---------------------------- */
function applyScopeToCharts(scope){
  // Si tu utilises d'autres IDs/canvases, ajoute-les ici.
  // Barres (%)
  barChart("chOrgTypes", scope.org_types);
  barChart("chClusters", scope.clusters);
  barChart("chProvinceBase", scope.province_base);

  barChart("chTop1Service", scope.top_service_1);
  barChart("chTop2Service", scope.top_service_2);
  barChart("chTop3Service", scope.top_service_3);

  barChart("chGravity", scope.referral_gravity);
  barChart("chRestoreTime", scope.restore_time);

  barChart("chApproaches", scope.approaches);
  barChart("chAdditionality", scope.additionality);
  barChart("chInnovation", scope.innovation_level);

  barChart("chObstacles", scope.obstacles_wlo);
  barChart("chGovernance", scope.governance_mechanisms);
  barChart("chCapacity", scope.capacity_needs);

  barChart("chPriorityAreas", scope.priority_areas);
  barChart("chUnderserved", scope.underserved_groups);
  barChart("chAAP", scope.accountability_mechanisms);
  barChart("chFeedbackChannel", scope.feedback_channel);

  barChart("chRisks", scope.operational_risks);
  barChart("chFunds", scope.funds_leverage);
  barChart("chCriticalNeed", scope.critical_need);

  barChart("chDigitalAdv", scope.digital_advantages);
  barChart("chDigitalLim", scope.digital_limits);
  barChart("chUNSupport", scope.un_support);

  // Exemples doughnut (si tu as des variables binaires)
  // doughnutChartWithPct("chSomeBinary", scope.some_binary);
}

/* ----------------------------
   UI init: scope selector
---------------------------- */
function initScopeSelector(){
  const sel = document.getElementById("orgScope");
  if(!sel) return;

  // Build options: "__all__" + keys of by_org_type
  sel.innerHTML = `<option value="__all__">Toutes</option>`;

  const keys = Object.keys(DATA.by_org_type || {}).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  keys.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k;
    sel.appendChild(opt);
  });

  sel.addEventListener("change", () => setScope(sel.value));
}

/* ----------------------------
   Load data.json then render
---------------------------- */
function loadData(){
  const url = `data.json?v=${Date.now()}`;
  return fetch(url)
    .then(r => { if(!r.ok) throw new Error("data.json introuvable"); return r.json(); })
    .then(payload => {
      DATA = payload || {};
      SUMMARY = DATA.summary || {};
      console.log("Chart.js loaded:", hasChartJs(), "DataLabels:", hasDataLabels());
      initScopeSelector();
      setScope("__all__");
    });
}

/* ----------------------------
   Boot
---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadData().catch(err => {
    console.error(err);
    // Affiche une erreur dans un bloc si présent
    const el = document.getElementById("errorBox");
    if(el){
      el.textContent = "Erreur de chargement. Vérifie data.json et la console.";
      el.style.display = "block";
    }
  });
});
