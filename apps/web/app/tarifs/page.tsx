'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

const fallbackPlans = [
  { id:'e', name:'Essentiel', subtitle:'Pour démarrer simplement', priceLabel:'Sur devis', features:['Espace documentaire sécurisé','Gestion des dossiers et sous-dossiers','Comptes utilisateurs','Versioning et corbeille','Support standard'], isHighlighted:false },
  { id:'p', name:'Professionnel', subtitle:'Pour les équipes qui collaborent au quotidien', priceLabel:'Sur devis', features:['Toutes les fonctions Essentiel','Gestion avancée des droits','Groupes utilisateurs','Quotas et administration entreprise','Accompagnement au déploiement'], badge:'Recommandée', isHighlighted:true },
  { id:'x', name:'Entreprise', subtitle:'Pour les besoins avancés et volumes importants', priceLabel:'Sur devis', features:['Toutes les fonctions Professionnel','Capacité de stockage adaptée','Paramétrage et accompagnement dédié','Support prioritaire','Options et évolutions sur mesure'], isHighlighted:false },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(()=>{ api('/marketing/public/plans').then(setPlans).catch(()=>{}); },[]);
  const displayPlans = plans.length ? plans : fallbackPlans;

  return (
    <main className="publicPage">
      <PublicHeader />
      <section className="pageHero pricingHero">
        <div className="publicContainer">
          <span className="eyebrow">Tarifs Coffria</span>
          <h1>Une formule adaptée à votre organisation</h1>
          <p>Choisissez une formule selon vos besoins de stockage, le nombre d’utilisateurs et le niveau d’accompagnement. Les offres affichées ici sont pilotées directement depuis l’espace Super Admin.</p>
        </div>
      </section>
      <section className="section">
        <div className="publicContainer pricingGrid">
          {displayPlans.map((plan:any) => (
            <article key={plan.id || plan.name} className={`priceCard ${plan.isHighlighted ? 'featured' : ''}`}>
              {plan.badge && <span className="planBadge">{plan.badge}</span>}
              <div className="priceName">{plan.name}</div>
              <p>{plan.subtitle}</p>
              <div className="priceAmount">{plan.priceLabel || 'Sur devis'}</div>
              {(plan.storageGb || plan.maxUsers) && <div className="planMeta">{plan.storageGb ? `${plan.storageGb} Go` : 'Stockage adapté'}{plan.maxUsers ? ` · jusqu’à ${plan.maxUsers} utilisateurs` : ''}</div>}
              <ul className="priceList">{(Array.isArray(plan.features) ? plan.features : []).map((item:string) => <li key={item}>{item}</li>)}</ul>
              <Link href="/contact" className={plan.isHighlighted ? 'publicPrimary' : 'publicSecondary'}>Demander une offre</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="section sectionAlt"><div className="publicContainer pricingContact"><div><span className="eyebrow">Besoin spécifique ?</span><h2>Construisons une formule adaptée à votre organisation.</h2><p>Volumes importants, accompagnement, nombre d’utilisateurs ou besoins spécifiques : nous pouvons établir une offre personnalisée.</p></div><Link href="/contact" className="publicPrimary">Parler à LMurbs</Link></div></section>
      <PublicFooter />
    </main>
  );
}
