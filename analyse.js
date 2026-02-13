console.log("✅ analyse.js (full) chargé");

let PAYLOAD = null;

function topN(obj, n=3){
  return Object.entries(obj || {}).sort((a,b)=>(b[1]||0)-(a[1]||0)).slice(0,n);
}
function totalCount(obj){
  return Object.values(obj || {}).reduce((a,b)=>a+Number(b||0),0);
}
function pct(part, total){
  if(!total) return 0;
  return Math.round((part*100)/total);
}
function bullets(items){
  if(!items || !items.length) return "<ul><li>—</li></ul>";
  return `<ul>${items.map(x=>`<li>${x}</li>`).join("")}</ul>`;
}
function sentenceList(items){
  if(!items.length) return "";
  if(items.length===1) return items[0];
  if(items.length===2) return `${items[0]} et ${items[1]}`;
  return `${items.slice(0,-1).join(", ")}, et ${items[items.length-1]}`;
}
function buildOrgFilter(byOrg){
  const sel = document.getElementById("orgFilter");
  sel.innerHTML = `<option value="__all__">Toutes</option>`;
  Object.keys(byOrg || {}).forEach(k=>{
    const o=document.createElement("option");
    o.value=k; o.textContent=k;
    sel.appendChild(o);
  });
  sel.disabled = Object.keys(byOrg||{}).length===0;
}
function scopeData(orgLabel){
  if(!PAYLOAD) return null;
  if(orgLabel === "__all__") return PAYLOAD.summary;
  return PAYLOAD.by_org_type?.[orgLabel] || PAYLOAD.summary;
}
function fillKPIs(scope, label){
  document.getElementById("kpiScope").textContent = (label==="__all__") ? "Toutes" : label;
  document.getElementById("kpiTotal").textContent = (scope?.total_responses ?? 0).toString();
  document.getElementById("kpiProvCount").textContent = Object.keys(scope?.priority_areas || {}).length.toString();
}

function buildNarratives(scope){
  const total = scope?.total_responses ?? 0;

  // Intro
  const orgTypesTop = topN(scope?.org_types || {}, 3).map(([k,v]) => `${k} (${pct(v,total)}%)`);
  const clustersTop = topN(scope?.clusters || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);

  // Bloc A
  const s1 = topN(scope?.top_service_1 || {}, 3).map(([k,v]) => `${k} (${pct(v,total)}%)`);
  const grav = scope?.referral_gravity || {};
  const gravTotal = totalCount(grav);
  const gravTop = topN(grav, 2).map(([k,v]) => `${k} (${pct(v, gravTotal)}%)`);
  const restore = topN(scope?.restore_time || {}, 2).map(([k,v]) => `${k} (${pct(v,total)}%)`);
  const approachesTop = topN(scope?.approaches || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);

  // Bloc B
  const addTop = topN(scope?.additionality || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);
  const innovTop = topN(scope?.innovation_level || {}, 2).map(([k,v]) => `${k} (${pct(v,total)}%)`);

  // Bloc C
  const obstaclesTop = topN(scope?.obstacles_wlo || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);
  const govTop = topN(scope?.governance_mechanisms || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);
  const capTop = topN(scope?.capacity_needs || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);

  // Bloc D
  const areasTop = topN(scope?.priority_areas || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);
  const underTop = topN(scope?.underserved_groups || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);
  const fbTop = topN(scope?.feedback_channel || {}, 2).map(([k,v]) => `${k} (${pct(v,total)}%)`);

  // Bloc E
  const riskTop = topN(scope?.operational_risks || {}, 4).map(([k,v]) => `${k} (${v} mentions)`);
  const fundsTop = topN(scope?.funds_leverage || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);
  const critTop = topN(scope?.critical_need || {}, 2).map(([k,v]) => `${k} (${pct(v,total)}%)`);

  // Bloc F
  const digAdvTop = topN(scope?.digital_advantages || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);
  const digLimTop = topN(scope?.digital_limits || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);
  const unSupTop = topN(scope?.un_support || {}, 3).map(([k,v]) => `${k} (${v} mentions)`);

  // FORCES
  const forces = [];
  if(total){
    forces.push(`Le profil des répondants est diversifié, avec une présence dominante de ${sentenceList(orgTypesTop)}.`);
    if(clustersTop.length) forces.push(`Les domaines les plus représentés sont : ${sentenceList(clustersTop)}.`);
    if(s1.length) forces.push(`Les services life-saving les plus cités (Top 1) sont : ${sentenceList(s1)}.`);
    if(gravTop.length) forces.push(`La gravité des ruptures de référencement est principalement ${sentenceList(gravTop)}.`);
    if(areasTop.length) forces.push(`Les zones prioritaires convergent vers : ${sentenceList(areasTop)}.`);
  } else {
    forces.push(`Échantillon insuffisant pour dégager des tendances robustes.`);
  }

  // GAPS
  const gaps = [];
  if(underTop.length) gaps.push(`Les groupes les plus sous-desservis sont : ${sentenceList(underTop)}, indiquant des lacunes de couverture et/ou d’accès.`);
  if(obstaclesTop.length) gaps.push(`Les obstacles majeurs au leadership des WLO portent sur : ${sentenceList(obstaclesTop)}.`);
  if(digLimTop.length) gaps.push(`Les limites du digital les plus mentionnées sont : ${sentenceList(digLimTop)}.`);

  // OPPORTUNITÉS CERF
  const opp = [];
  opp.push(`Une proposition CERF peut s’appuyer sur une priorisation claire life-saving (SSR/VBG/Protection), soutenue par les tendances sur les services interrompus et la gravité rapportée.`);
  if(addTop.length) opp.push(`Les axes d’additionalité les plus cités sont : ${sentenceList(addTop)} (à valoriser dans le narratif).`);
  if(restore.length) opp.push(`Le calendrier de rétablissement attendu se concentre sur : ${sentenceList(restore)} (à traduire en plan opérationnel réaliste).`);
  if(govTop.length) opp.push(`La gouvernance peut être renforcée via : ${sentenceList(govTop)}, pour consolider la localisation et la participation effective des WLO.`);
  if(digAdvTop.length) opp.push(`Le suivi probant peut être renforcé par un dispositif digital pragmatique : ${sentenceList(digAdvTop)}.`);

  // RISQUES
  const risks = [];
  if(riskTop.length) risks.push(`Les risques opérationnels dominants sont : ${sentenceList(riskTop)}.`);
  if(fundsTop.length) risks.push(`Risque de chevauchement si l’articulation avec ${sentenceList(fundsTop)} n’est pas explicitée.`);
  if(digLimTop.length) risks.push(`Sur le suivi digital : ${sentenceList(digLimTop)} — nécessite des mesures de confidentialité, accessibilité et alternatives hors-ligne.`);

  // RECOMMANDATIONS
  const rec = [];
  rec.push(`1) Consolider un paquet “life-saving” priorisé (Top 1) + référencement intersectoriel, avec des standards de qualité et des délais de rétablissement réalistes.`);
  rec.push(`2) Justifier le ciblage géographique à partir des zones les plus citées et des contraintes d’accès, avec critères transparents.`);
  rec.push(`3) Centrer le ciblage sur les groupes sous-desservis (sexo-âge-handicap) et formaliser le référencement sûr/confidentiel.`);
  rec.push(`4) Renforcer la localisation : mécanismes de gouvernance et financement permettant une participation décisionnelle des WLO.`);
  rec.push(`5) Mettre en place un dispositif AAP/feedback crédible (canaux adaptés) et un suivi digital pragmatique (données désagrégées), avec options hors-ligne.`);
  if(critTop.length) rec.push(`6) Prioriser le besoin critique identifié : ${sentenceList(critTop)} et aligner le plan de mitigation sur les risques opérationnels.`);

  document.getElementById("forces").innerHTML = bullets(forces);
  document.getElementById("gaps").innerHTML = bullets(gaps);
  document.getElementById("opportunites").innerHTML = bullets(opp);
  document.getElementById("risques").innerHTML = bullets(risks);
  document.getElementById("recommandations").innerHTML = bullets(rec);
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

    pdf.save(`CERF_analyse_strategique.pdf`);
  });
}

fetch(`data.json?v=${Date.now()}`)
  .then(r => { if(!r.ok) throw new Error("data.json introuvable"); return r.json(); })
  .then(payload => {
    PAYLOAD = payload;

    buildOrgFilter(payload.by_org_type);

    const orgSel = document.getElementById("orgFilter");
    const apply = () => {
      const org = orgSel.value || "__all__";
      const scope = scopeData(org);
      fillKPIs(scope, org);
      buildNarratives(scope);
    };

    orgSel.addEventListener("change", apply);

    orgSel.value = "__all__";
    apply();

    hookPdf();
  })
  .catch(err => {
    console.error(err);
    document.getElementById("forces").innerHTML = `<ul><li>Erreur de chargement des données.</li></ul>`;
  });
