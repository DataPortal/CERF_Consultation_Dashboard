console.log("✅ main.js (full) chargé");

let charts = {};
let PAYLOAD = null;
let ALL = [];
let FILTERED = [];

/* -----------------------------
   Helpers Chart.js safety
------------------------------ */
function hasChartJs(){ return typeof window.Chart !== "undefined"; }
function hasDataLabels(){ return typeof window.ChartDataLabels !== "undefined"; }

function destroyChart(id){
  if(charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function normalizeValues(dataObj){
  const o = dataObj || {};
  const labels = Object.keys(o);
  const values = Object.values(o).map(v => Number(v || 0));
  return { labels, values };
}

function barChart(canvasId, dataObj){
  if(!hasChartJs()){
    console.warn("Chart.js non chargé → chart ignoré:", canvasId);
    return;
  }

  destroyChart(canvasId);

  const { labels, values } = normalizeValues(dataObj);
  const el = document.getElementById(canvasId);
  if(!el) return;

  charts[canvasId] = new Chart(el, {
    type: 'bar',
    data: { labels, datasets: [{ data: values }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
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

  if(!dl){
    console.warn("ChartDataLabels non chargé → % désactivés:", canvasId);
  }

  const pluginsArr = dl ? [ChartDataLabels] : [];

  charts[canvasId] = new Chart(el, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values }] },
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

/* -----------------------------
   Filters helpers
------------------------------ */
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

function setScopeLabel(label){
  const el = document.getElementById('kpiScope');
  if(el) el.textContent = label;
}

function getScope(payload, orgLabel){
  if(orgLabel === '__all__') return payload.summary;
  return payload.by_org_type?.[orgLabel] || payload.summary;
}

function applyScopeToCharts(scope){
  if(!hasChartJs()){
    console.warn("Chart.js non chargé → aucun graphique ne peut s'afficher.");
    return;
  }

  // Intro
  barChart('chartOrgTypes', scope?.org_types || {});
  barChart('chartClusters', scope?.clusters || {});
  barChart('chartProvinceBase', scope?.province_base || {});
  barChart('chartOtherProvinces', scope?.other_provinces || {});

  // Bloc A
  barChart('chartTop1', scope?.top_service_1 || {});
  barChart('chartTop2', scope?.top_service_2 || {});
  barChart('chartTop3', scope?.top_service_3 || {});
  doughnutChartWithPct('chartGravite', scope?.referral_gravity || {});
  barChart('chartRestoreTime', scope?.restore_time || {});
  barChart('chartApproaches', scope?.approaches || {});

  // Bloc B
  barChart('chartAdditionality', scope?.additionality || {});
  doughnutChartWithPct('chartInnovation', scope?.innovation_level || {});

  // Bloc C
  barChart('chartObstacles', scope?.obstacles_wlo || {});
  barChart('chartGovernance', scope?.governance_mechanisms || {});
  barChart('chartCapacity', scope?.capacity_needs || {});

  // Bloc D
  barChart('chartPriorityAreas', scope?.priority_areas || {});
  barChart('chartUnderserved', scope?.underserved_groups || {});
  doughnutChartWithPct('chartFeedback', scope?.feedback_channel || {});
  barChart('chartMeca', scope?.accountability_mechanisms || {});

  // Bloc E
  barChart('chartRisks', scope?.operational_risks || {});
  barChart('chartFunds', scope?.funds_leverage || {});
  doughnutChartWithPct('chartCriticalNeed', scope?.critical_need || {});

  // Bloc F
  barChart('chartDigitalAdv', scope?.digital_advantages || {});
  barChart('chartDigitalLim', scope?.digital_limits || {});
  barChart('chartUNSupport', scope?.un_support || {});
}

/* -----------------------------
   List rendering (cards)
------------------------------ */
function kv(label, value){
  const v = (value === null || value === undefined || value === "") ? "—" : value;
  return `<div class="k">${label}</div><div class="v">${v}</div>`;
}

function renderList(){
  const list = document.getElementById('list');
  if(!list) return;

  list.innerHTML = '';

  if(FILTERED.length === 0){
    list.innerHTML = `<div class="item"><div class="item-title">Aucune réponse ne correspond aux filtres.</div></div>`;
    return;
  }

  const rows = FILTERED.slice().sort((a,b) => (b.date_interview || '').localeCompare(a.date_interview || ''));

  rows.forEach((r, idx) => {
    const org = r.org_type_label || "—";
    const prov = r.province_label || "—";
    const cluster = r.cluster_label || "—";

    const top1 = r.service_top1_label || "—";
    const grav = r.referral_gravity_label || "—";

    const item = document.createElement('div');
    item.className = 'item';

    item.innerHTML = `
      <div class="item-head">
        <div>
          <div class="item-title">Réponse #${idx+1} — ${org}</div>
          <div class="item-meta">Organisation: <b>${r.organisation || "—"}</b> • Province: <b>${prov}</b></div>

          <div class="pills">
            <span class="pill blue">UN Women</span>
            <span class="pill orange">UNFPA</span>
            <span class="pill">Cluster(s): ${cluster}</span>
            <span class="pill">Top1: ${top1}</span>
            <span class="pill">Gravité: ${grav}</span>
          </div>
        </div>

        <div style="text-align:right">
          <button class="btn btn-orange" data-toggle="1">Détails</button>
        </div>
      </div>

      <div class="details">
        <div class="kv">
          ${kv("Date interview", r.date_interview)}
          ${kv("Organisation", r.organisation)}
          ${kv("Type d’organisation", org)}
          ${kv("Cluster(s)", cluster)}
          ${kv("Province base", prov)}
          ${kv("Territoire / admin2", r.admin2)}
          ${kv("Autres provinces", r.other_provinces_label)}
          ${kv("Consentement", r.consent_label)}

          ${kv("A – Service Top 1", r.service_top1_label)}
          ${kv("A – Service Top 2", r.service_top2_label)}
          ${kv("A – Service Top 3", r.service_top3_label)}
          ${kv("A – Où (service)", r.a1_where)}
          ${kv("A – Gravité référencement", r.referral_gravity_label)}
          ${kv("A – Où (référencement)", r.a2_where)}
          ${kv("A – Délai rétablissement", r.restore_time_label)}
          ${kv("A – Approches efficaces", r.approaches_label)}

          ${kv("B – Additionalité (axes)", r.additionality_label)}
          ${kv("B – Explication additionalité", r.b1_explain)}
          ${kv("B – Niveau innovation", r.innovation_level_label)}
          ${kv("B – Explication innovation", r.b2_explain)}
          ${kv("B – Théorie du changement", r.toc)}

          ${kv("C – Obstacles", r.obstacles_label)}
          ${kv("C – Solutions", r.c1_solutions)}
          ${kv("C – Gouvernance", r.governance_label)}
          ${kv("C – Besoins capacités", r.capacity_label)}
          ${kv("C – Coordination (narratif)", r.c4_coordination)}

          ${kv("D – Zones prioritaires", r.priority_areas_label)}
          ${kv("D – Groupes sous-desservis", r.underserved_label)}
          ${kv("D – Indicateurs SADDD", r.saddd)}
          ${kv("D – Mécanismes AAP", r.meca_label)}
          ${kv("D – Confiance (renforce)", r.trust_plus)}
          ${kv("D – Confiance (fragilise)", r.trust_minus)}
          ${kv("D – Canal feedback", r.feedback_channel_label)}

          ${kv("E – Risques", r.risks_label)}
          ${kv("E – Mitigation", r.e1_mitigation)}
          ${kv("E – Fonds à articuler", r.funds_label)}
          ${kv("E – Résultats 3/6/12 mois", r.e3_results)}
          ${kv("E – Besoin le plus critique", r.critical_need_label)}

          ${kv("F – Avantages digital", r.digital_adv_label)}
          ${kv("F – Limites digital", r.digital_lim_label)}
          ${kv("F – Comment renforcer via digital", r.f1_strengthen)}
          ${kv("F – Appui attendu agences UN", r.un_support_label)}
          ${kv("F – Détails appui", r.f2_details)}
        </div>
      </div>
    `;

    item.querySelector('button[data-toggle]')?.addEventListener('click', () => {
      item.classList.toggle('open');
    });

    list.appendChild(item);
  });
}

function applyFilters(){
  const org = document.getElementById('orgFilter')?.value || '__all__';
  const prov = document.getElementById('provinceFilter')?.value || '__all__';
  const q = document.getElementById('q')?.value || '';

  FILTERED = ALL.filter(r => {
    const okOrg = (org === '__all__') || (r.org_type_label === org);
    const okProv = (prov === '__all__') || (r.province_label === prov);
    const okQ = matchesQuery(r, q);
    return okOrg && okProv && okQ;
  });

  const kpiRows = document.getElementById('kpiRows');
  if(kpiRows) kpiRows.textContent = FILTERED.length.toString();

  renderList();
}

/* -----------------------------
   Export
------------------------------ */
function exportCSV(){
  const cols = Object.keys((ALL[0] || {}));
  const esc = (v) => `"${(v ?? "").toString().replace(/"/g,'""')}"`;
  const lines = [cols.join(",")];
  FILTERED.forEach(r => lines.push(cols.map(c => esc(r[c])).join(",")));

  const blob = new Blob([lines.join("\n")], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CERF_reponses.csv`;
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

    pdf.save(`CERF_dashboard.pdf`);
  });
}

/* -----------------------------
   Load payload + records
------------------------------ */
Promise.all([
  fetch(`data.json?v=${Date.now()}`).then(r => { if(!r.ok) throw new Error("data.json introuvable"); return r.json(); }),
  fetch(`records.json?v=${Date.now()}`).then(r => { if(!r.ok) throw new Error("records.json introuvable"); return r.json(); })
]).then(([payload, rec]) => {
  PAYLOAD = payload;
  ALL = rec.records || [];

  // Debug quick visibility
  console.log("payload.summary keys:", Object.keys(payload?.summary || {}));
  console.log("Chart.js loaded:", hasChartJs(), "DataLabels loaded:", hasDataLabels());

  // KPIs
  const total = payload.summary?.total_responses ?? ALL.length ?? 0;
  const kpiTotal = document.getElementById('kpiTotal');
  if(kpiTotal) kpiTotal.textContent = total.toString();

  // Filters (from clean records)
  buildSelect('orgFilter', uniq(ALL.map(r => r.org_type_label)));
  buildSelect('provinceFilter', uniq(ALL.map(r => r.province_label)));

  // Default scope + charts
  setScopeLabel("Toutes");
  applyScopeToCharts(payload.summary);

  // Default table
  FILTERED = ALL.slice();
  const kpiRows = document.getElementById('kpiRows');
  if(kpiRows) kpiRows.textContent = FILTERED.length.toString();
  renderList();

  // Events
  document.getElementById('orgFilter')?.addEventListener('change', () => {
    const org = document.getElementById('orgFilter').value;
    setScopeLabel(org === '__all__' ? "Toutes" : org);
    applyScopeToCharts(getScope(payload, org));
    applyFilters();
  });

  document.getElementById('provinceFilter')?.addEventListener('change', applyFilters);
  document.getElementById('q')?.addEventListener('input', applyFilters);
  document.getElementById('btnCsv')?.addEventListener('click', exportCSV);

  exportPDF();
}).catch(err => {
  console.error(err);
  const list = document.getElementById('list');
  if(list){
    list.innerHTML = `<div class="item"><div class="item-title">Erreur de chargement. Vérifie data.json et records.json.</div></div>`;
  }
});
