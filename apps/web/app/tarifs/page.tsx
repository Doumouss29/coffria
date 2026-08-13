'use client';

import Link from 'next/link';
import { Check, Gift } from 'lucide-react';
import { useEffect, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

const fallbackPlans = [
  { id:'essentiel', slug:'essentiel', name:'ESSENTIEL', subtitle:'La référence pour numériser et sécuriser vos archives prioritaires.', monthlyPriceCents:3500000, yearlyPriceCents:38500000, storageGb:100, features:['100 Go de stockage documentaire','Recherche intelligente et indexation documentaire','Empreinte SHA-256 et traçabilité','Gestion des dossiers, versions et corbeille','Accès ordinateur, tablette et smartphone','Support standard','Signature graphique : non incluse','Assistant IA : non inclus'], isHighlighted:false },
  { id:'pro', slug:'pro', name:'PRO', subtitle:'La formule tout-en-un pour accélérer vos processus documentaires et de validation.', monthlyPriceCents:9500000, yearlyPriceCents:104500000, storageGb:500, features:['Tout le Pack ESSENTIEL','500 Go de stockage documentaire','Signature graphique par e-mail','Dossier de preuve : e-mail, date, heure, IP et traçabilité','Gestion avancée des droits et groupes','Fonctions IA de masquage/anonymisation selon disponibilité','Support prioritaire'], badge:'Bestseller', isHighlighted:true },
  { id:'corporate', slug:'corporate', name:'CORPORATE', subtitle:'L’expérience sur-mesure pour les grandes organisations et les volumes importants.', monthlyPriceCents:18000000, yearlyPriceCents:180000000, storageGb:1000, features:['Tout le Pack PRO','1 To de stockage documentaire','Signature graphique multi-signataires et workflows','Quota de signature configurable ou illimité selon contrat','Assistant IA Chat avec vos documents','Accès API et intégrations selon périmètre contractuel','Accompagnement et support dédiés'], badge:'Corporate', isHighlighted:false },
];

function fcfa(cents?:number|null){ if(cents==null) return 'Sur devis'; return `${Math.round(cents/100).toLocaleString('fr-FR')} FCFA HT`; }
function freeMonths(plan:any){ return String(plan.slug||plan.name).toLowerCase().includes('corporate') ? 2 : 1; }

export default function PricingPage() {
  const [plans,setPlans]=useState<any[]>([]);
  const [billing,setBilling]=useState<'monthly'|'yearly'>('monthly');
  useEffect(()=>{api('/marketing/public/plans').then(setPlans).catch(()=>{})},[]);
  const displayPlans=plans.length?plans:fallbackPlans;

  return <main className="publicPage"><PublicHeader/>
    <section className="pageHero pricingHero"><div className="publicContainer"><span className="eyebrow">Tarifs Coffria</span><h1>Archivage intelligent, sécurisé et évolutif</h1><p>Choisissez votre pack, puis votre périodicité. Le paiement annuel inclut un avantage tarifaire immédiat.</p>
      <div className="billingToggle"><button className={billing==='monthly'?'active':''} onClick={()=>setBilling('monthly')}>Mensuel</button><button className={billing==='yearly'?'active':''} onClick={()=>setBilling('yearly')}>Annuel <span>Économisez</span></button></div>
    </div></section>
    <section className="section"><div className="publicContainer pricingGrid">{displayPlans.map((plan:any)=>{
      const annual=billing==='yearly'; const free=freeMonths(plan); const price=annual?plan.yearlyPriceCents:plan.monthlyPriceCents;
      return <article key={plan.id||plan.name} className={`priceCard ${plan.isHighlighted?'featured':''}`}>
        {plan.badge&&<span className="planBadge">{plan.badge}</span>}<div className="priceName">{plan.name}</div><p>{plan.subtitle}</p>
        <div className="priceAmount">{fcfa(price)}<small> / {annual?'an':'mois'}</small></div>
        {annual&&<div className="annualGift"><Gift size={16}/> {free} mois offert{free>1?'s':''} sur l’année</div>}
        {plan.storageGb&&<div className="planMeta">{plan.storageGb>=1000?'1 To':`${plan.storageGb} Go`} de stockage</div>}
        <ul className="priceList">{(Array.isArray(plan.features)?plan.features:[]).map((item:string)=><li key={item}><Check size={15}/>{item}</li>)}</ul>
        <Link href={`/conditions?plan=${encodeURIComponent(plan.slug||plan.name)}&billing=${billing}`} className={plan.isHighlighted?'publicPrimary':'publicSecondary'}>Choisir ce pack</Link>
      </article>})}</div></section>
    <section className="section sectionAlt"><div className="publicContainer pricingContact"><div><span className="eyebrow">Besoin spécifique ?</span><h2>Nous adaptons les quotas et options à votre organisation.</h2><p>Volumes, utilisateurs, quotas de signature ou intégrations : les limites peuvent être ajustées contractuellement.</p></div><Link href="/contact" className="publicPrimary">Parler à LMurbs</Link></div></section>
    <PublicFooter/></main>;
}
