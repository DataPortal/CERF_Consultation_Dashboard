let charts = {};
let map, geoLayer;

// ---- CODE → LABEL (à ajuster si tes codes évoluent) ----
const LABELS = {
  service: {
    clinique_72h: "Prise en charge clinique <72h",
    mhpss: "Soutien psychosocial",
    juridique: "Assistance juridique",
    abri: "Hébergement sécurisé",
    ssr: "Services de santé sexuelle et reproductive",
  },
  gravite: {
    faible: "Faible",
    moderee: "Modérée",
    elevee: "Élevée",
    critique: "Critique",
  },
  province: {
    bas_uele: "Bas-Uele",
    equateur: "Équateur",
    haut_katanga: "Haut-Katanga",
    haut_lomami: "Haut-Lomami",
    haut_uele: "Haut-Uele",
    ituri: "Ituri",
    kasai: "Kasaï",
    kasai_central: "Kasaï-Central",
    kasai_oriental: "Kasaï-Oriental",
    kinshasa: "Kinshasa",
    kongo_central: "Kongo Central",
    kwango: "Kwango",
    kwilu: "Kwilu",
    lomami: "Lomami",
    lualaba: "Lualaba",
    mai_ndombe: "Mai-Ndombe",
    maniema: "Maniema",
    mongala: "Mongala",
    nord_kivu: "Nord-Kivu",
    nord_ubangi: "Nord-Ubangi",
    sankuru: "Sankuru",
    sud_kivu: "Sud-Kivu",
    sud_ubangi: "Sud-Ubangi",
    tanganyika: "Tanganyika",
    tshopo: "Tshopo",
    tshuapa: "Tshuapa",
  },
  groupes: {
    adolescentes_10_14: "Adolescentes 10–14 ans",
    adolescentes_15_19: "Adolescentes 15–19 ans",
    deplacees: "Femmes déplacées",
    cheffes_menage: "Femmes cheffes de ménage",
    handicap: "Femmes en situation de handicap",
    survivantes_vbg: "Survivantes de VBG",
    autre: "Autre",
  },
  risques: {
    insecurite: "Insécurité",
    acces_limite: "Accès humanitaire limité",
    ressources_humaines: "Manque de ressources humaines",
    approvisionnement: "Rupture chaîne d’approvisionnement",
    donnees: "Risques liés aux données / confidentialité",
    autre: "Autre",
  },
  digital_advantages: {
    rapidite: "Suivi plus rapide",
    transparence: "Transparence accrue",
    donnees_desag: "Données désagrégées plus rapidement",
    meilleur_ciblage: "Meilleur ciblage des bénéficiaires",
    autre: "Autre",
  },
  digital_limites: {
    connectivite: "Coupures réseau / électricité",
    confidentialite: "Risques de confidentialité",
    exclusion: "Exclusion numérique des plus vulnérables",
    cout: "Coûts de maintenance",
    autre: "Autre",
  },
};

function labelize(domain, code){
  if(code === null || code === undefined) return "";
  return (LABELS[domain] && LABELS[domain][code]) ? LABELS[domain][code] : code;
}

function relabelObject(domain, obj){
  const out = {};
  Object.entries(obj || {}).forEach(([k,v]) => {
    out[labelize(domain, k)] = v;
  });
  return out;
}

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
    data: {
      labels,
      datasets: [{ label: title, data: values }]
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
  const el = document.getElementById(canvasId);
  if(!el) return;

  charts[canvasId] = new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ label: title, data: values }]
    },
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
  return {
    weight: 1,
    color: '#334155',
    opacity: 0.6,
    fillColor: fill,
    fillOpacity: 0.75
  };
}

function renderMap(provinceCountsLabels){
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
          const c = provinceCountsLabels?.[name] || 0;
          return styleFeature(c);
        },
        onEachFeature: (feature, layer) => {
          const name = (feature.properties?.name || feature.properties?.NAME_1 || feature.properties?.province || '').toString();
          const c = provinceCountsLabels?.[name] || 0;
          layer.bindPopup(`<b>${name}</b><br/>Mentions : ${c}`);
        }
      }).addTo(map);

      try { map.fitBounds(geoLayer.getBounds(), { padding: [10,10] }); } catch(e) {}
    })
    .catch(err => console.warn("Carte: ", err.message));
}

// ---------------- PDF EXPORT ----------------
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

// ---------------- APPLY DATA ----------------
function applySimpleSchema(payload){
  // Total + timestamp
  document.getElementById('total').textContent = payload.total_responses ?? '—';
  document.getElementById('generatedAt').textContent = payload.generated_at
    ? `Mis à jour : ${payload.generated_at}`
    : 'Mis à jour : (non renseigné)';

  // Translate codes → labels for display
  const topService = relabelObject('service', payload.top_service || {});
  const gravite = relabelObject('gravite', payload.gravite || {});
  const provinces = relabelObject('province', payload.provinces || {});
  const groupes = relabelObject('groupes', payload.groupes || {});
  const risques = relabelObject('risques', payload.risques || {});
  const digAdv = relabelObject('digital_advantages', payload.digital_avantages || {});
  const digLim = relabelObject('digital_limites', payload.digital_limites || {});

  barChart('chartService', 'Service SSR/VBG (Top 1)', topService);
  doughnutChart('chartGravite', 'Gravité', gravite);
  barChart('chartProvinces', 'Provinces prioritaires', provinces);
  barChart('chartGroupes', 'Groupes sous-desservis', groupes);
  barChart('chartRisques', 'Risques opérationnels', risques);

  // Merge digital adv/lim in one chart
  const digital = {};
  Object.entries(digAdv).forEach(([k,v]) => digital[`+ ${k}`] = v);
  Object.entries(digLim).forEach(([k,v]) => digital[`- ${k}`] = v);
  barChart('chartDigital', 'Digital', digital);

  // Map expects province labels matching GeoJSON names
  renderMap(provinces);
}

function showError(msg){
  console.error(msg);
  document.getElementById('total').textContent = '—';
  document.getElementById('generatedAt').textContent = msg;
}

// Load
fetch(`data.json?v=${Date.now()}`)
  .then(r => {
    if(!r.ok) throw new Error(`data.json introuvable (HTTP ${r.status})`);
    return r.json();
  })
  .then(payload => {
    // Your current schema is "simple"
    applySimpleSchema(payload);
    hookPdf();

    // (Optional) hide orgFilter until you implement by_org_type in data.json
    const orgSel = document.getElementById('orgFilter');
    if(orgSel){
      orgSel.innerHTML = `<option value="__all__">Toutes</option>`;
      orgSel.disabled = true;
      orgSel.title = "Le filtre par type d’organisation nécessite un data.json enrichi (by_org_type).";
    }
  })
  .catch(err => showError(`Erreur chargement data.json : ${err.message}`));
