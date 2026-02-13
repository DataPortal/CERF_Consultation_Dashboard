console.log("✅ main.js chargé");

let charts = {};
let PAYLOAD = null;
let ALL = [];
let FILTERED = [];

function destroyChart(id){
  if(charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function barChart(canvasId, dataObj){
  destroyChart(canvasId);
  const labels = Object.keys(dataObj || {});
  const values = Object.values(dataObj || {});
  const el = document.getElementById(canvasId);
  if(!el) return;

  charts[canvasId] = new Chart(el, {
    type: 'bar',
    data: { labels, datasets: [{ data: values }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: false, maxRotation: 55, minRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  });
}

function doughnutChart(canvasId, dataObj){
  destroyChart(canvasId);

  const labels = Object.keys(dataObj || {});
  const values = Object.values(dataObj || {}).map(v => Number(v || 0));
  const el = document.getElementById(canvasId);
  if(!el) return;

  const total = values.reduce((a,b) => a + b, 0);

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
        datalabels: {
          display: (ctx) => {
            const v = ctx.dataset.data[ctx.dataIndex] || 0;
            if(!total) return false;
            const pct = (v * 100 / total);
            return pct >= 8; // évite d'encombrer si très petit
          },
          formatter: (value) => {
            if(!total) return '';
            const pct = (value * 100 / total);
            return `${pct.toFixed(0)}%`;
          },
          color: '#ffffff',
          font: { weight: '800', size: 12 }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
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

function applyScopeToCharts(scope){
  // Services Top 1/2/3
  barChart('chartTop1', scope?.top_service_1 || {});
  barChart('chartTop2', scope?.top_service_2 || {});
  barChart('chartTop3', scope?.top_service_3 || {});

  doughnutChart('chartGravite', scope?.gravite || {});
  barChart('chartProvinces', scope?.provinces_prioritaires || {});
  barChart('chartGroupes', scope?.groupes_sous_servis || {});
  barChart('chartRisques', scope?.risques_operationnels || {});

  const dig = {};
  Object.entries(scope?.digital_avantages || {}).forEach(([k,v]) => dig[`+ ${k}`] = v);
  Object.entries(scope?.digital_limites || {}).forEach(([k,v]) => dig[`- ${k}`] = v);
  barChart('chartDigital', dig);
}

function kv(label, value){
  const v = (value === null || value === undefined || value === "") ? "—" : value;
  return `<div class="k">${label}</div><div class="v">${v}</div>`;
}

function renderList(){
  const list = document.getElementById('list');
  list.innerHTML = '';

  if(FILTERED.length === 0){
    list.innerHTML = `<div class="item"><div class="item-title">Aucune réponse ne correspond aux filtres.</div></div>`;
    return;
  }

  // Latest first if available
  const rows = FILTERED.slice().sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  rows.forEach((r, idx) => {
    const org = r.org_type_label || "—";
    const prov = r.province_base_label || "—";
    const terr = r.territoire_base_label || "—";

    const top1 = r.service_top1_label || "—";
    const top2 = r.service_top2_label || "—";
    const top3 = r.service_top3_label || "—";
    const grav = r.rupture_gravite_label || "—";

    const item = document.createElement('div');
    item.className = 'item';

    item.innerHTML = `
      <div class="item-head">
        <div>
          <div class="item-title">Réponse #${idx+1} — ${org}</div>
          <div class="item-meta">Province: <b>${prov}</b> • Territoire/Commune: ${terr}</div>

          <div class="pills">
            <span class="pill blue">UN Women</span>
            <span class="pill orange">UNFPA</span>
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
          ${kv("Organisation (nom)", r.org_name)}
          ${kv("Type d’organisation", org)}
          ${kv("Province d’intervention", prov)}
          ${kv("Territoire / Commune", terr)}

          ${kv("Service Top 1", top1)}
          ${kv("Service Top 2", top2)}
          ${kv("Service Top 3", top3)}
          ${kv("Gravité des ruptures", grav)}

          ${kv("Approches efficaces (narratif)", r.approches_efficaces)}
          ${kv("Valeur ajoutée (narratif)", r.valeur_ajoutee)}
          ${kv("Effet durable (narratif)", r.effet_systemique)}

          ${kv("Obstacles WLO", r.obstacles_wlo_label || r.obstacles_wlo)}
          ${kv("Mesures pour lever les obstacles (narratif)", r.solutions_wlo)}

          ${kv("Provinces prioritaires", r.provinces_prioritaires_label || r.provinces_prioritaires)}
          ${kv("Groupes sous-desservis", r.groupes_sous_servis_label || r.groupes_sous_servis)}
          ${kv("Mécanisme de feedback (narratif)", r.mecanisme_feedback)}

          ${kv("Risques opérationnels", r.risques_operationnels_label || r.risques_operationnels)}
          ${kv("Mesures de mitigation (narratif)", r.mesures_mitigation)}

          ${kv("Avantages digital", r.avantages_digital_label || r.avantages_digital)}
          ${kv("Limites digital", r.limites_digital_label || r.limites_digital)}
          ${kv("Apport du digital (narratif)", r.apport_digital)}
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
    const okProv = (prov === '__all__') || (r.province_base_label === prov);
    const okQ = matchesQuery(r, q);
    return okOrg && okProv && okQ;
  });

  document.getElementById('kpiRows').textContent = FILTERED.length.toString();
  renderList();
}

function exportCSV(){
  const cols = [
    "org_name","org_type_label","province_base_label","territoire_base_label",
    "service_top1_label","service_top2_label","service_top3_label","rupture_gravite_label",
    "approches_efficaces","valeur_ajoutee","effet_systemique",
    "obstacles_wlo","solutions_wlo",
    "provinces_prioritaires_label","groupes_sous_servis_label","mecanisme_feedback",
    "risques_operationnels_label","mesures_mitigation",
    "avantages_digital_label","limites_digital_label","apport_digital"
  ];

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

function setScopeLabel(label){
  document.getElementById('kpiScope').textContent = label;
}

function getScope(payload, orgLabel){
  if(orgLabel === '__all__') return payload.summary;
  return payload.by_org_type?.[orgLabel] || payload.summary;
}

Promise.all([
  fetch(`data.json?v=${Date.now()}`).then(r => { if(!r.ok) throw new Error("data.json introuvable"); return r.json(); }),
  fetch(`records.json?v=${Date.now()}`).then(r => { if(!r.ok) throw new Error("records.json introuvable"); return r.json(); })
]).then(([payload, rec]) => {
  PAYLOAD = payload;
  ALL = rec.records || [];

  // KPIs
  document.getElementById('kpiTotal').textContent = (payload.summary?.total_responses ?? ALL.length ?? 0).toString();

  // Build filters from records (labels)
  buildSelect('orgFilter', uniq(ALL.map(r => r.org_type_label)));
  buildSelect('provinceFilter', uniq(ALL.map(r => r.province_base_label)));

  // Default scope
  setScopeLabel("Toutes");
  applyScopeToCharts(payload.summary);

  // Default table
  FILTERED = ALL.slice();
  document.getElementById('kpiRows').textContent = FILTERED.length.toString();
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
  document.getElementById('list').innerHTML =
    `<div class="item"><div class="item-title">Erreur de chargement des données. Vérifie data.json et records.json.</div></div>`;
});
