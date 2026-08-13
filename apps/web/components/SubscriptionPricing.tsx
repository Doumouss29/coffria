'use client';

import Link from 'next/link';
import { Check, Gift } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

const fallbackPlans = [
  { id:'essentiel', slug:'essentiel', name:'ESSENTIEL', subtitle:'La référence pour numériser et sécuriser vos archives prioritaires.', monthlyPriceCents:3500000, yearlyPriceCents:38500000, storageGb:100, features:['100 Go de stockage documentaire','Recherche intelligente et indexation documentaire','Empreinte SHA-256 et traçabilité','Gestion des dossiers, versions et corbeille','Accès ordinateur, tablette et smartphone','Support standard','Signature graphique : non incluse','Assistant IA : non inclus'], isHighlighted:false },
  { id:'pro', slug:'pro', name:'PRO', subtitle:'La formule tout-en-un pour accélérer vos processus documentaires et de validation.', monthlyPriceCents:9500000, yearlyPriceCents:104500000, storageGb:500, features:['Tout le Pack ESSENTIEL','500 Go de stockage documentaire','Signature graphique par e-mail','Dossier de preuve : e-mail, date, heure, IP et traçabilité','Gestion avancée des droits et groupes','Fonctions IA de masquage/anonymisation selon disponibilité','Support prioritaire'], badge:'Bestseller', isHighlighted:true },
  { id:'corporate', slug:'corporate', name:'CORPORATE', subtitle:'L’expérience sur-mesure pour les grandes organisations et les volumes importants.', monthlyPriceCents:18000000, yearlyPriceCents:180000000, storageGb:1000, features:['Tout le Pack PRO','1 To de stockage documentaire','Signature graphique multi-signataires et workflows','Quota de signature configurable ou illimité selon contrat','Assistant IA Chat avec vos documents','Accès API et intégrations selon périmètre contractuel','Accompagnement et support dédiés'], badge:'Corporate', isHighlighted:false },
];

function fcfa(cents?:number|null){if(cents==null)return 'Sur devis';return `${Math.round(cents/100).toLocaleString('fr-FR')} FCFA HT`;}
function freeMonths(plan:any){return String(plan.slug||plan.name).toLowerCase().includes('corporate')?2:1;}

export function SubscriptionPricing(){
  const params=useSearchParams();
  const[plans,setPlans]=useState<any[]>([]);
  const[selectedSlug,setSelectedSlug]=useState(params.get('plan')||'');
  const[billing,setBilling]=useState<'monthly'|'yearly'>(params.get('billing')==='yearly'?'yearly':'monthly');
  const choiceRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{api('/marketing/public/plans').then(setPlans).catch(()=>{})},[]);
  const displayPlans=plans.length?plans:fallbackPlans;
  const selected=useMemo(()=>displayPlans.find((p:any)=>String(p.slug||p.name).toLowerCase()===selectedSlug.toLowerCase()),[displayPlans,selectedSlug]);

  useEffect(()=>{if(params.get('plan')&&selected)setTimeout(()=>choiceRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),150)},[selected,params]);
  function choose(plan:any){setSelectedSlug(plan.slug||plan.name);setBilling('monthly');setTimeout(()=>choiceRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),50)}

  return <>
    <section className="section"><div className="publicContainer"><div className="subscriptionSteps"><span className="active">1. Pack</span><span>2. Périodicité</span><span>3. Conditions</span><span>4. Souscription</span></div><div className="pricingGrid">{displayPlans.map((plan:any)=>{
      const isSelected=selected&&(selected.id===plan.id||selected.slug===plan.slug);
      return <article key={plan.id||plan.name} className={`priceCard ${plan.isHighlighted?'featured':''} ${isSelected?'selectedPlan':''}`}>
        {plan.badge&&<span className="planBadge">{plan.badge}</span>}
        <div className="priceName">{plan.name}</div><p>{plan.subtitle}</p>
        <div className="priceAmount">{fcfa(plan.monthlyPriceCents)}<small> / mois</small></div>
        {plan.storageGb&&<div className="planMeta">{plan.storageGb>=1000?'1 To':`${plan.storageGb} Go`} de stockage</div>}
        <ul className="priceList">{(Array.isArray(plan.features)?plan.features:[]).map((item:string)=><li key={item}><Check size={15}/>{item}</li>)}</ul>
        <button type="button" onClick={()=>choose(plan)} className={plan.isHighlighted?'publicPrimary':'publicSecondary'}>{isSelected?'Pack sélectionné':'Choisir ce pack'}</button>
      </article>})}</div></div></section>

    {selected&&<section className="section sectionAlt" ref={choiceRef}><div className="publicContainer billingChoice">
      <div><span className="eyebrow">Étape 2 sur 4</span><h2>Choisissez la périodicité du Pack {selected.name}</h2><p>Le paiement annuel inclut {freeMonths(selected)} mois offert{freeMonths(selected)>1?'s':''}.</p></div>
      <div className="billingOptions">
        <button type="button" className={billing==='monthly'?'billingOption active':'billingOption'} onClick={()=>setBilling('monthly')}><span>Mensuel</span><strong>{fcfa(selected.monthlyPriceCents)}</strong><small>Facturé chaque mois</small></button>
        <button type="button" className={billing==='yearly'?'billingOption active':'billingOption'} onClick={()=>setBilling('yearly')}><span>Annuel</span><strong>{fcfa(selected.yearlyPriceCents)}</strong><small><Gift size={15}/> {freeMonths(selected)} mois offert{freeMonths(selected)>1?'s':''}</small></button>
      </div>
      <div className="billingContinue"><Link className="publicPrimary" href={`/conditions?plan=${encodeURIComponent(selected.slug||selected.name)}&billing=${billing}`}>Continuer vers les conditions</Link><button type="button" className="publicSecondary" onClick={()=>setSelectedSlug('')}>Changer de pack</button></div>
    </div></section>}
  </>;
}
