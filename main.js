console.log("✅ main.js chargé");

let charts = {};
let map, geoLayer;

function destroyChart(id){
  if(charts[id]){
    charts[id].destroy();
    delete charts[id];
  }
}

function barChart(canvasId, title, dataObj){
  destroyChart(canvasId);
  const labels = Object.keys(dataObj || {});
  const values = Object.values(dataObj || {});
  const el = document.getElementById(canvasId);
  if(!el) return;

  charts[canvasId] = new Chart(el, {
    type: 'bar',
    data: { labels, datasets: [{ label: title, data: values }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 0 } },
        y: { beginAtZero: true }
      }
    }
  });
}

function doughnutChart(canvasId, title, dataObj){
  destroyChart(canvasId);
  const labels = Object.keys(dataObj || {});
  const values = Object.values(dataObj || {});
  const el = document.getElementById(canvasId);
  if(!el) return;

  charts[canvasId] = new Chart(el, {
    type: 'doughnut',
    data: { labels, datasets: [{ label: title, data: values }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// ---------------- MAP ----------------
function initMap(){
  map = L.map('map', { scrollWheelZoom: false }).setView([-2.8, 23.6], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}

function styleFeature(count){
  let fill = '#cfe6fb';
  if(count >= 10) fill = '#1f6fb3';
  else if(count >= 7) fill = '#2f7fc2';
  else if(count >= 4) fill = '#5aa1d6';
  else if(count >= 2) fill = '#8cc0ea';
  return { weight: 1, color: '#334155', opacity: 0.6, fillColor: fill, fillOpacity: 0.75 };
}

function renderMap(provinceCounts){
  if(!map) initMap();

  fetch(`rdc_provinces.geojson?v=${Date.now()}`)
    .then(r => {
      if(!r.ok) throw new Error('GeoJSON introuvable');
      return r.json();
    })
    .then(geo => {
      if(geoLayer) geoLayer.remove();

      geoLayer = L.geoJSON(geo, {
        style: (feature) => {
          const name = (feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.province || '').toString();
          const c = provinceCounts?.[name] || 0;
          return styleFeature(c);
        },
        onEachFeature: (feature, layer) => {
          const name = (feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.province || '').toString();
          const c = provinceCounts?.[name] || 0;
          layer.bindPopup(`<b>${name}</b><br/>Mentions : ${c}`);
        }
      }).addTo(map);

      try { map.fitBounds(geoLayer.getBounds(), { padding: [10,10] }); } catch(e) {}
    })
    .catch(err => console.warn("Carte: ", err.message));
}

// ---------------- PDF ----------------
function hookPdf(){
  const btn = document.getElementById('btnPdf');
  if(!btn) return;

  btn.addEventListener('click', async () => {
    const report = document.getElementById('report');
    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(report, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;

    let y = 0;
    let remaining = imgHeight;

    pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight);
    remaining -= pageHeight;

    while (remaining > 0) {
      pdf.addPage();
      y = -(imgHeight - remaining);
      pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    pdf.save(`CERF-dashboard-${ts}.pdf`);
  });
}

// ---------------- FILTER ----------------
function buildOrgFilter(byOrg){
  const sel = document.getElementById('orgFilter');
  if(!sel) return;

  sel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '__all__';
  optAll.textContent = 'Toutes';
  sel.appendChild(optAll);

  const keys = Object.keys(byOrg || {});
  keys.forEach(label => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  sel.disabled = keys.length === 0;
}

// ---------------- TABLE ----------------
function fmtDate(iso){
  if(!iso) return "";
  // iso -> YYYY-MM-DD
  try { return iso.toString().slice(0,10); } catch(e) { return iso; }
}

function joinIfNeeded(v){
  if(v === null || v === undefined) return "";
  // some fields may be multiselect already labelized; keep as-is
  return String(v);
}

function renderTable(records, orgFilterValue){
  const body = document.getElementById('recordsBody');
  const meta = document.getElementById('recordsMeta');
  if(!body) return;

  const filtered = (records || []).filter(r => {
    if(orgFilterValue === '__all__') return true;
    // prefer org_type_label if exists, else org_type
    const label = r.org_type_label || r.org_type || '';
    return label === orgFilterValue;
  });

  body.innerHTML = '';

  if(filtered.length === 0){
    body.innerHTML = `<tr><td colspan="7" class="muted">Aucune ligne à afficher (filtre appliqué).</td></tr>`;
    if(meta) meta.textContent = '';
    return;
  }

  // Show latest first
  const rows = filtered.slice().sort((a,b) => (b.submission_time || '').localeCompare(a.submission_time || ''));

  // Limit display to 30 rows for readability (you can change)
  const maxRows = 30;
  const visible = rows.slice(0, maxRows);

  for(const r of visible){
    const tr = document.createElement('tr');

    const date = fmtDate(r.submission_time);
    const org = r.org_type_label || r.org_type || '';
    const prov = r.province_base_label || r.province_base || '';
    const service = r.service_top1_label || r.service_top1 || '';
    const grav = r.rupture_gravite_label || r.rupture_gravite || '';
    const provPrio = joinIfNeeded(r.provinces_prioritaires || '');
    const groupes = joinIfNeeded(r.groupes_sous_servis || '');

    tr.innerHTML = `
      <td>${date}</td>
      <td>${org}</td>
      <td>${prov}</td>
      <td>${service}</td>
      <td>${grav}</td>
      <td>${provPrio}</td>
      <td>${groupes}</td>
    `;
    body.appendChild(tr);
  }

  if(meta){
    const more = rows.length > maxRows ? ` (affichage ${maxRows}/${rows.length})` : ` (${rows.length})`;
    meta.textContent = `Lignes affichées${more}.`;
  }
}

// ---------------- APPLY DATA ----------------
function applyScope(scope){
  document.getElementById('total').textContent = scope?.total_responses ?? '0';

  barChart('chartService', 'Service (Top 1)', scope?.top_service || {});
  doughnutChart('chartGravite', 'Gravité', scope?.gravite || {});
  barChart('chartProvinces', 'Provinces prioritaires', scope?.provinces_prioritaires || {});
  barChart('chartGroupes', 'Groupes sous-desservis', scope?.groupes_sous_servis || {});
  barChart('chartRisques', 'Risques opérationnels', scope?.risques_operationnels || {});

  const dig = {};
  Object.entries(scope?.digital_avantages || {}).forEach(([k,v]) => dig[`+ ${k}`] = v);
  Object.entries(scope?.digital_limites || {}).forEach(([k,v]) => dig[`- ${k}`] = v);
  barChart('chartDigital', 'Digital', dig);

  renderMap(scope?.provinces_prioritaires || {});
}

function showError(msg){
  console.error(msg);
  document.getElementById('total').textContent = '—';
  document.getElementById('generatedAt').textContent = msg;
}

// ---------------- LOAD BOTH JSON ----------------
Promise.all([
  fetch(`data.json?v=${Date.now()}`).then(r => {
    if(!r.ok) throw new Error(`data.json introuvable (HTTP ${r.status})`);
    return r.json();
  }),
  fetch(`records.json?v=${Date.now()}`).then(r => {
    if(!r.ok) throw new Error(`records.json introuvable (HTTP ${r.status}). Ajoute la génération records.json dans fetch_kobo.py.`);
    return r.json();
  })
]).then(([payload, recPayload]) => {
  document.getElementById('generatedAt').textContent =
    `Mis à jour : ${payload.generated_at || '(non renseigné)'}`;

  buildOrgFilter(payload.by_org_type);

  // default
  applyScope(payload.summary);

  const records = recPayload.records || [];
  renderTable(records, '__all__');

  const sel = document.getElementById('orgFilter');
  if(sel){
    sel.addEventListener('change', () => {
      const v = sel.value;
      if(v === '__all__') applyScope(payload.summary);
      else applyScope(payload.by_org_type?.[v] || payload.summary);

      renderTable(records, v);
    });
  }

  hookPdf();
}).catch(err => {
  showError(`Erreur chargement données : ${err.message}`);
});
