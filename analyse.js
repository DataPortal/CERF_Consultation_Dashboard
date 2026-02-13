console.log("✅ analyse.js chargé");

let PAYLOAD = null;

function topN(obj, n=3){
  const entries = Object.entries(obj || {}).sort((a,b)=> (b[1]||0)-(a[1]||0));
  return entries.slice(0,n);
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
  document.getElementById("kpiProvCount").textContent = Object.keys(scope?.provinces_prioritaires || {}).length.toString();
}

function buildNarratives(scope){
  // ===== Pull tops
  const total = scope?.total_responses ?? 0;

  const topService1 = topN(scope?.top_service_1 || {}, 3).map(([k,v]) => ({k,v}));
  const topService2 = topN(scope?.top_service_2 || {}, 3).map(([k,v]) => ({k,v}));
  const topService3 = topN(scope?.top_service_3 || {}, 3).map(([k,v]) => ({k,v}));

  const grav = scope?.gravite || {};
  const gravTotal = totalCount(grav);
  const gravTop = topN(grav, 2).map(([k,v]) => `${k} (${pct(v, gravTotal)}%)`);

  const provinces = scope?.provinces_prioritaires || {};
  const provTotalMentions = totalCount(provinces); // multiselect mentions
  const provTop = topN(provinces, 5).map(([k,v]) => `${k} (${v} mentions)`);

  const groupes = scope?.groupes_sous_servis || {};
  const grpTotalMentions = totalCount(groupes);
  const grpTop = topN(groupes, 5).map(([k,v]) => `${k} (${v} mentions)`);

  const risques = scope?.risques_operationnels || {};
  const riskTotalMentions = totalCount(risques);
  const riskTop = topN(risques, 5).map(([k,v]) => `${k} (${v} mentions)`);

  const adv = scope?.digital_avantages || {};
  const advTop = topN(adv, 3).map(([k,v]) => `${k} (${v} mentions)`);

  const lim = scope?.digital_limites || {};
  const limTop = topN(lim, 3).map(([k,v]) => `${k} (${v} mentions)`);

  // ===== Build force narrative
  const forcesTxt = [];
  if(total){
    const s1 = topService1.map(x=>`${x.k} (${pct(x.v, total)}%)`);
    forcesTxt.push(`La consultation met en évidence des interruptions prioritaires sur ${sentenceList(s1)} (Top 1), ce qui renforce la clarté du ciblage “life-saving”.`);
  } else {
    forcesTxt.push(`Les données disponibles ne permettent pas encore de dégager des tendances robustes (échantillon insuffisant).`);
  }
  if(gravTop.length){
    forcesTxt.push(`Le niveau de gravité perçu se concentre principalement sur ${sentenceList(gravTop)}.`);
  }
  if(provTop.length){
    forcesTxt.push(`Les provinces les plus citées pour la priorisation sont : ${sentenceList(provTop.slice(0,3))}.`);
  }
  if(advTop.length){
    forcesTxt.push(`Sur le suivi/redevabilité, les avantages les plus attendus du digital sont : ${sentenceList(advTop)}.`);
  }

  // ===== Build gaps narrative
  const gapsTxt = [];
  if(grpTop.length){
    gapsTxt.push(`Les groupes identifiés comme les plus sous-desservis sont : ${sentenceList(grpTop.slice(0,4))}. Cela suggère des lacunes de couverture et/ou de référencement adaptés.`);
  }
  if(topService2.length || topService3.length){
    const s2 = topService2.map(x=>`${x.k}`);
    const s3 = topService3.map(x=>`${x.k}`);
    gapsTxt.push(`Les priorités secondaires confirment des besoins persistants au-delà du Top 1 (Top 2 : ${sentenceList(s2)} ; Top 3 : ${sentenceList(s3)}), indiquant une pression multisectorielle sur l’offre de services.`);
  }
  if(limTop.length){
    gapsTxt.push(`Les limites/risques associés au digital les plus cités sont : ${sentenceList(limTop)} — à intégrer dès la conception (accès, sécurité/confidentialité, maintenance).`);
  }

  // ===== Opportunities CERF narrative (life-saving + additionality + catalytic)
  const oppTxt = [];
  oppTxt.push(`Une opportunité CERF claire se dégage autour du paquet “life-saving” SSR/VBG/Protection, en s’appuyant sur les interruptions les plus fréquentes (Top 1) et sur la gravité rapportée.`);
  if(provTop.length){
    oppTxt.push(`Le ciblage géographique peut être justifié par les provinces les plus mentionnées (${sentenceList(provTop.slice(0,3))}), tout en prévoyant une flexibilité opérationnelle selon l’accès et l’évolution de la crise.`);
  }
  if(advTop.length){
    oppTxt.push(`Le suivi orienté résultats peut être renforcé via un dispositif digital pragmatique (accès bailleur à des indicateurs désagrégés et tableaux de bord), tout en maintenant des alternatives hors-ligne en contexte de coupures.`);
  }
  oppTxt.push(`L’“additionalité” peut être argumentée en montrant ce que le financement débloque rapidement (rétablissement de services critiques, référencement intersectoriel, AAP/feedback sûr, et appui ciblé à la localisation via WLO).`);

  // ===== Risks narrative
  const risksTxt = [];
  if(riskTop.length){
    risksTxt.push(`Les principaux risques opérationnels cités sont : ${sentenceList(riskTop.slice(0,4))}.`);
  } else {
    risksTxt.push(`Les risques opérationnels ne sont pas suffisamment documentés à ce stade.`);
  }
  if(limTop.length){
    risksTxt.push(`Sur la redevabilité digitale : ${sentenceList(limTop)}. Mesures attendues : confidentialité, solutions hors-ligne, procédures d’accès restreint et maintenance minimaliste.`);
  }
  risksTxt.push(`Risque transversal : duplication/chevauchement si l’articulation avec les mécanismes existants (clusters, AoR, fonds genre et humanitaires) n’est pas explicitée dans la gouvernance du projet.`);

  // ===== Recommendations narrative (very actionable)
  const recTxt = [];
  recTxt.push(`1) Prioriser un paquet “life-saving” clairement défini (Top 1 SSR/VBG + référencement), avec des standards de qualité et de délais de rétablissement réalistes.`);
  recTxt.push(`2) Cibler en premier lieu les provinces les plus citées (${provTop.slice(0,3).map(x=>x.split(" (")[0]).join(", ") || "—"}) et définir des critères transparents de sélection (accès, capacité opérationnelle, données disponibles).`);
  recTxt.push(`3) Mettre au centre les groupes sous-desservis (${grpTop.slice(0,3).map(x=>x.split(" (")[0]).join(", ") || "—"}) via un ciblage sexo-âgé-handicap et un mécanisme de référencement sûr.`);
  recTxt.push(`4) Formaliser un dispositif AAP/feedback confidentiel dès le premier mois (canaux communautaires + options digitales + procédures de protection des données).`);
  recTxt.push(`5) Digitaliser le suivi de manière pragmatique : indicateurs désagrégés, tableaux de bord accessibles au bailleur, et modes hors-ligne en cas de coupures (procédures de synchronisation à l’accès).`);
  recTxt.push(`6) Prévoir un plan de mitigation explicitement lié aux risques opérationnels (sécurité, accès, supply, RH, confidentialité) et un mécanisme de coordination évitant les doublons.`);

  document.getElementById("forces").innerHTML = bullets(forcesTxt);
  document.getElementById("gaps").innerHTML = bullets(gapsTxt);
  document.getElementById("opportunites").innerHTML = bullets(oppTxt);
  document.getElementById("risques").innerHTML = bullets(risksTxt);
  document.getElementById("recommandations").innerHTML = bullets(recTxt);
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

    // init
    orgSel.value = "__all__";
    apply();

    hookPdf();
  })
  .catch(err => {
    console.error(err);
    document.getElementById("forces").innerHTML = `<ul><li>Erreur de chargement des données.</li></ul>`;
  });
