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

  const ctx = document.getElementById(canvasId);
  if(!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: title,
        data: values
      }]
    },
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

  const ctx = document.getElementById(canvasId);
  if(!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: title,
        data: values
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function initMap(){
  map = L.map('map', { scrollWheelZoom: false }).setView([-2.8, 23.6], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}

function styleFeature(count){
  // simple 5-class scale
  let fill = '#cfe6fb';
  if(count >= 10) fill = '#1f6fb3';
  else if(count >= 7) fill = '#2f7fc2';
  else if(count >= 4) fill = '#5aa1d6';
  else if(count >= 2) fill = '#8cc0ea';
  return {
    weight: 1,
    color: '#334155',
    opacity: 0.6,
    fillColor: fill,
    fillOpacity: 0.75
  };
}

function renderMap(provinceCounts){
  if(!map) initMap();

  fetch('rdc_provinces.geojson')
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

      try {
        map.fitBounds(geoLayer.getBounds(), { padding: [10,10] });
      } catch(e) {}
    })
    .catch(() => {
      console.warn("GeoJSON provinces RDC manquant : ajoute rdc_provinces.geojson à la racine du repo.");
    });
}

function normalizeProvinceKeys(obj){
  // obj keys already labels like "Nord-Kivu". Ensure exact matches with geojson "name".
  return obj || {};
}

function buildOrgFilter(byOrg){
  const sel = document.getElementById('orgFilter');
  if(!sel) return;
  // keep default option
  const existing = new Set(Array.from(sel.options).map(o => o.value));
  Object.keys(byOrg || {}).forEach(label => {
    if(existing.has(label)) return;
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    sel.appendChild(opt);
  });
}

function applyData(payload, scope){
  // scope is either payload.summary or payload.by_org_type[label]
  document.getElementById('total').textContent = scope.total_responses ?? '—';

  barChart('chartService', 'Service top', scope.top_service || {});
  doughnutChart('chartGravite', 'Gravité', scope.gravite || {});
  barChart('chartProvinces', 'Provinces prioritaires', scope.provinces_prioritaires || {});
  barChart('chartGroupes', 'Groupes', scope.groupes_sous_servis || {});
  barChart('chartRisques', 'Risques', scope.risques_operationnels || {});

  // digital as stacked-like view: show advantages & limits in one chart
  const dig = {};
  Object.entries(scope.digital_avantages || {}).forEach(([k,v]) => dig[`+ ${k}`] = v);
  Object.entries(scope.digital_limites || {}).forEach(([k,v]) => dig[`- ${k}`] = v);
  barChart('chartDigital', 'Digital', dig);

  renderMap(normalizeProvinceKeys(scope.provinces_prioritaires || {}));
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
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Fit image to page
    const imgWidth = pageWidth;
    const imgHeight = canvas.height * imgWidth / canvas.width;

    let y = 0;
    let remaining = imgHeight;

    // First page
    pdf.addImage(imgData, 'PNG', 0, y, imgWidth, imgHeight);
    remaining -= pageHeight;

    // Additional pages if needed
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

fetch('data.json')
  .then(r => r.json())
  .then(payload => {
    document.getElementById('generatedAt').textContent = `Mis à jour : ${payload.generated_at}`;
    buildOrgFilter(payload.by_org_type);
    applyData(payload, payload.summary);

    const sel = document.getElementById('orgFilter');
    sel.addEventListener('change', () => {
      const v = sel.value;
      if(v === '__all__') applyData(payload, payload.summary);
      else applyData(payload, payload.by_org_type[v] || payload.summary);
    });

    hookPdf();
  })
  .catch(err => {
    console.error(err);
    document.getElementById('total').textContent = 'Erreur chargement data.json';
  });
