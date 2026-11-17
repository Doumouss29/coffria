'use client';
import Link from 'next/link';
import { Check, Gift, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

const fallbackPlans=[
{id:'pro',slug:'pro',name:'PRO',subtitle:'La formule tout-en-un pour accélérer vos processus documentaires et de validation.',monthlyPriceCents:7000000,yearlyPriceCents:77000000,storageGb:1000,isHighlighted:false},
{id:'sur-mesure',slug:'sur-mesure',name:'SUR MESURE',subtitle:'Au-delà de 1 To, adaptez la capacité de stockage par paliers de 500 Go.',monthlyPriceCents:8000000,yearlyPriceCents:80000000,storageGb:1500,badge:'Flexible',isHighlighted:true},
];

const CUSTOM_STEP_GB=500;
const CUSTOM_STEP_MONTHLY_CENTS=2000000;

const compare=[
['Recherche intelligente IA et indexation documentaire',true,true],
['Empreinte SHA-256 et traçabilité',true,true],
['Gestion des dossiers, versions et corbeille',true,true],
['Gestion des utilisateurs et des droits',true,true],
['Accès ordinateur, tablette et smartphone',true,true],
['Signature électronique sécurisée par e-mail',true,true],
['Dossier de preuve de signature',true,true],
['Gestion avancée des droits et groupes',true,true],
['Capacité extensible par paliers de 500 Go',false,true],
['Support dédié',false,true],
['Accompagnement au dimensionnement',false,true],
] as const;

function slug(p:any){return String(p.slug||p.name||'').toLowerCase()}
function fcfa(c?:number|null){return c==null?'Sur devis':`${Math.round(c/100).toLocaleString('fr-FR')} FCFA HT`}
function freeMonths(p:any){return slug(p)==='pro'?1:2}
function features(p:any){return Array.isArray(p?.features)?p.features:[]}
function mark(v:boolean|string){return v===true?<Check size={18}/>:v===false?<X size={18}/>:<span>{v}</span>}
function normalizePlans(items:any[]){
  return (items||[])
    .filter((p:any)=>p?.isActive!==false)
    .sort((a:any,b:any)=>Number(a?.sortOrder||0)-Number(b?.sortOrder||0));
}

export function SubscriptionPricing(){
const[plans,setPlans]=useState<any[]>([]);
const[selectedSlug,setSelectedSlug]=useState('');
const[billing,setBilling]=useState<'monthly'|'yearly'>('monthly');
const[initialized,setInitialized]=useState(false);
const[customStorageGb,setCustomStorageGb]=useState(1500);
const choiceRef=useRef<HTMLDivElement|null>(null);

useEffect(()=>{
  api('/marketing/public/plans').then((items:any[])=>setPlans(normalizePlans(items))).catch(()=>setPlans(fallbackPlans));
  const q=new URLSearchParams(window.location.search);
  setSelectedSlug(q.get('plan')||'');
  setBilling(q.get('billing')==='yearly'?'yearly':'monthly');
  const requestedStorage=Number(q.get('storageGb')||1500);
  if(Number.isFinite(requestedStorage)&&requestedStorage>=1500)setCustomStorageGb(Math.ceil(requestedStorage/500)*500);
  setInitialized(true)
},[]);

const displayPlans=plans.length?plans:fallbackPlans;
const selected=useMemo(()=>displayPlans.find((p:any)=>slug(p)===selectedSlug.toLowerCase()),[displayPlans,selectedSlug]);
const customBaseStorageGb=selected&&slug(selected)==='sur-mesure'?Number(selected.storageGb||1500):1500;
const customExtraSteps=Math.max(0,Math.round((customStorageGb-customBaseStorageGb)/CUSTOM_STEP_GB));
const customMonthlyCents=selected&&slug(selected)==='sur-mesure'?Number(selected.monthlyPriceCents||0)+customExtraSteps*CUSTOM_STEP_MONTHLY_CENTS:0;
const customYearlyBase=selected&&slug(selected)==='sur-mesure'?Number(selected.yearlyPriceCents||Number(selected.monthlyPriceCents||0)*10):0;
const customYearlyCents=customYearlyBase+customExtraSteps*CUSTOM_STEP_MONTHLY_CENTS*10;
const selectedMonthlyCents=selected&&slug(selected)==='sur-mesure'?customMonthlyCents:selected?.monthlyPriceCents;
const selectedYearlyCents=selected&&slug(selected)==='sur-mesure'?customYearlyCents:selected?.yearlyPriceCents;

useEffect(()=>{
  if(initialized&&selectedSlug&&selected){
    const t=setTimeout(()=>choiceRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),150);
    return()=>clearTimeout(t)
  }
},[initialized,selectedSlug,selected]);

function choose(p:any){
  setSelectedSlug(p.slug||p.name);
  setBilling('monthly');
  if(slug(p)==='sur-mesure')setCustomStorageGb(Math.max(1500,Number(p.storageGb||1500)));
  setTimeout(()=>choiceRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),50)
}
function storageLabel(gb:number){return gb%1000===0?`${gb/1000} To`:`${(gb/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})} To`}

return <>
<section className="section">
  <div className="publicContainer">
    <div className="subscriptionSteps">
      <span className="active">1. Pack</span><span>2. Périodicité</span><span>3. Conditions</span><span>4. Souscription</span>
    </div>

    <div className="pricingWorkspace">
      <div className="pricingOffersColumn">
        {displayPlans.map((p:any)=>{
          const s=slug(p);
          const chosen=selected&&slug(selected)===s;
          const storage=s==='sur-mesure'
            ? <>{p.storageGb>=1000?(p.storageGb/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' To':p.storageGb+' Go'} de stockage · <span className="nowrap">paliers de 500 Go</span></>
            : <>{p.storageGb>=1000?(p.storageGb/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' To':p.storageGb+' Go'} de stockage</>;

          return <article key={p.id||p.name} className={`priceCard subscriptionPriceCard ${p.isHighlighted?'featured':''} ${chosen?'selectedPlan':''}`}>
            {p.badge&&<span className="planBadge">{p.badge}</span>}
            <div className="priceName">{p.name}</div>
            <p>{p.subtitle}</p>

            <div className={`priceAmount priceAmountInline ${s==='sur-mesure'?'priceAmountCustom':''}`}>
              <span>{s==='sur-mesure'?'À partir de ':''}{fcfa(p.monthlyPriceCents)}</span>
              <small className="pricePeriod">/ mois</small>
            </div>

            <div className="planMeta pricingStorageMeta">{storage}</div>
            <div className="annualOfferBadge"><Gift size={18}/><strong>{freeMonths(p)} mois offert{freeMonths(p)>1?'s':''}</strong><span>en paiement annuel</span></div>

            {s==='sur-mesure'
              ? <div className="planInheritance">Tout PRO + capacité extensible, support dédié et accompagnement</div>
              : <ul className="priceList subscriptionFeatureList" style={{listStyle:'none',paddingLeft:0}}>
                  {features(p).slice(0,7).map((x:string)=><li key={x}><Check size={17}/>{x}</li>)}
                </ul>}

            <button type="button" onClick={()=>choose(p)} className={p.isHighlighted?'publicPrimary':'publicSecondary'}>
              {chosen?'Pack sélectionné':`Choisir ${p.name}`}
            </button>
          </article>
        })}
      </div>

      <aside className="packCompositionPanel">
        <div className="packCompositionHead">
          <span className="eyebrow">Composition du pack</span>
          <h2>Comparez en un coup d’œil</h2>
          <p>Les fonctions essentielles sont incluses dans les deux offres. SUR MESURE ajoute les services adaptés aux volumes importants.</p>
        </div>
        <div className="packCompositionTable">
          <div className="packCompositionRow packCompositionHeader"><span>Fonctionnalités</span><b>PRO</b><b>SUR MESURE</b></div>
          {compare.map((r:any)=><div className={`packCompositionRow ${r[1]===false?'exclusive':''}`} key={r[0]}>
            <span>{r[0]}</span><b>{mark(r[1])}</b><b>{mark(r[2])}</b>
          </div>)}
        </div>
      </aside>
    </div>
  </div>
</section>

{selected&&<section className="section sectionAlt" ref={choiceRef}>
  <div className="publicContainer billingChoice">
    <div>
      <span className="eyebrow">Étape 2 sur 4</span>
      <h2>Configurez le Pack {selected.name}</h2>
      {slug(selected)==='sur-mesure'
        ? <>
            <p>Le tarif de base est celui configuré dans l’administration pour {storageLabel(Number(selected.storageGb||1500))}, puis ajoute 20 000 FCFA HT par palier supplémentaire de 500 Go.</p>
            <div className="customStorageConfigurator">
              <button type="button" className="publicSecondary" aria-label="Retirer 500 Go" disabled={customStorageGb<=Math.max(1500,Number(selected.storageGb||1500))} onClick={()=>setCustomStorageGb(v=>Math.max(Math.max(1500,Number(selected.storageGb||1500)),v-500))}><Minus size={17}/></button>
              <div className="customStorageBox"><strong>{storageLabel(customStorageGb)}</strong><span className="muted">Stockage choisi</span></div>
              <button type="button" className="publicSecondary" aria-label="Ajouter 500 Go" onClick={()=>setCustomStorageGb(v=>v+500)}><Plus size={17}/></button>
              <div className="customStoragePrice">{fcfa(customMonthlyCents)} <span>/ mois</span></div>
            </div>
          </>
        : <p>Le paiement annuel inclut {freeMonths(selected)} mois offert{freeMonths(selected)>1?'s':''}.</p>}
    </div>

    <div className="billingOptions">
      <button type="button" className={billing==='monthly'?'billingOption active':'billingOption'} onClick={()=>setBilling('monthly')}>
        <span>Mensuel</span><strong>{fcfa(selectedMonthlyCents)}</strong><small>Facturé chaque mois</small>
      </button>
      <button type="button" className={billing==='yearly'?'billingOption active':'billingOption'} onClick={()=>setBilling('yearly')}>
        <span>Annuel</span><strong>{fcfa(selectedYearlyCents)}</strong><small><Gift size={15}/> {freeMonths(selected)} mois offert{freeMonths(selected)>1?'s':''}</small>
      </button>
    </div>

    <div className="billingContinue">
      <Link className="publicPrimary" href={`/conditions?plan=${encodeURIComponent(selected.slug||selected.name)}&billing=${billing}${slug(selected)==='sur-mesure'?`&storageGb=${customStorageGb}&price=${billing==='yearly'?Math.round(customYearlyCents/100):Math.round(customMonthlyCents/100)}`:''}`}>Continuer vers les conditions</Link>
      <button type="button" className="publicSecondary" onClick={()=>setSelectedSlug('')}>Changer de pack</button>
    </div>
  </div>
</section>}
</>
}
