console.log("✅ dashboard main.js chargé");

let charts = {};
let map, geoLayer;

function destroyChart(id){
  if(charts[id]) { charts[id].destroy(); delete charts[id]; }
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
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });
}

// Map
function initMap(){
  map = L.map('map', { scrollWheelZoom: false }).setView([-2.8, 23.6], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 10, attribution: '&copy; OpenStreetMap' })
    .addTo(map);
}

function styleFeature(count){
  // simple scale
  let fill = '#cfe6fb';
  if(count >= 10) fill = '#2b77c3';
  else if(count >= 7) fill = '#448BCA';
  else if(count >= 4) fill = '#6aa7dc';
  else if(count >= 2) fill = '#9ac8ee';
  return { weight: 1, color: '#334155', opacity: 0.6, fillColor: fill, fillOpacity: 0.75 };
}

function renderMap(provinceCounts){
  if(!map) initMap();
  fetch(`rdc_provinces.geojson?v=${Date.now()}`)
    .then(r => { if(!r.ok) throw new Error('GeoJSON introuvable'); return r.json(); })
    .then(geo => {
      if(geoLayer) geoLayer.remove();
      geoLayer = L.geoJSON(geo, {
        style: (f) => {
          const name = (f.properties?.name || f.properties?.NAME_1 || f.properties?.province || '').toString();
          const c = provinceCounts?.[name] || 0;
          return styleFeature(c);
        },
        onEachFeature: (f, layer) => {
          const name = (f.properties?.name || f.properties?.NAME_1 || f.properties?.province || '').toString();
          const c = provinceCounts?.[name] || 0;
          layer.bindPopup(`<b>${name}</b><br/>Mentions : ${c}`);
        }
      }).addTo(map);
      try { map.fitBounds(geoLayer.getBounds(), { padding: [10,10] }); } catch(e) {}
    })
    .catch(err => console.warn("Carte:", err.message));
}

function hookPdf(){
  const btn = document.getElementById('btnPdf');
  if(!btn) return;

  btn.addEventListener('click', async () => {
    const report = document.getElementById('report');
    const { jsPDF } = window.jspdf;

    const canvas = await html2canvas(report, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const imgH = canvas.height * imgW / canvas.width;

    let y = 0;
    let remaining = imgH;
    pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH);
    remaining -= pageH;

    while(remaining > 0){
      pdf.addPage();
      y = -(imgH - remaining);
      pdf.addImage(imgData, 'PNG', 0, y, imgW, imgH);
      remaining -= pageH;
    }

    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    pdf.save(`CERF-dashboard-${ts}.pdf`);
  });
}

// Filter
function buildOrgFilter(byOrg){
  const sel = document.getElementById('orgFilter');
  if(!sel) return;

  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = '__all__';
  all.textContent = 'Toutes';
  sel.appendChild(all);

  const keys = Object.keys(byOrg || {});
  keys.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = k;
    sel.appendChild(opt);
  });

  sel.disabled = keys.length === 0;
}

function applyScope(scope){
  document.getElementById('total').textContent = scope?.total_responses ?? '0';

  const provincesObj = scope?.provinces_prioritaires || {};
  document.getElementById('provinceCount').textContent = Object.keys(provincesObj).length.toString();

  barChart('chartService', 'Service (Top 1)', scope?.top_service || {});
  doughnutChart('chartGravite', 'Gravité', scope?.gravite || {});
  barChart('chartProvinces', 'Provinces prioritaires', provincesObj);
  barChart('chartGroupes', 'Groupes sous-desservis', scope?.groupes_sous_servis || {});
  barChart('chartRisques', 'Risques opérationnels', scope?.risques_operationnels || {});

  const dig = {};
  Object.entries(scope?.digital_avantages || {}).forEach(([k,v]) => dig[`+ ${k}`] = v);
  Object.entries(scope?.digital_limites || {}).forEach(([k,v]) => dig[`- ${k}`] = v);
  barChart('chartDigital', 'Digital', dig);

  renderMap(provincesObj);
}

function showError(msg){
  console.error(msg);
  document.getElementById('total').textContent = '—';
  document.getElementById('generatedAt').textContent = msg;
}

fetch(`data.json?v=${Date.now()}`)
  .then(r => { if(!r.ok) throw new Error(`data.json introuvable (HTTP ${r.status})`); return r.json(); })
  .then(payload => {
    document.getElementById('generatedAt').textContent = `Mis à jour : ${payload.generated_at || '(non renseigné)'}`;
    buildOrgFilter(payload.by_org_type);

    // default
    document.getElementById('scopeLabel').textContent = 'Toutes';
    applyScope(payload.summary);

    const sel = document.getElementById('orgFilter');
    if(sel){
      sel.addEventListener('change', () => {
        const v = sel.value;
        if(v === '__all__'){
          document.getElementById('scopeLabel').textContent = 'Toutes';
          applyScope(payload.summary);
        } else {
          document.getElementById('scopeLabel').textContent = v;
          applyScope(payload.by_org_type?.[v] || payload.summary);
        }
      });
    }

    hookPdf();
  })
  .catch(err => showError(`Erreur chargement data.json : ${err.message}`));
