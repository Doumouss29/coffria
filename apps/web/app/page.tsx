'use client';

import Link from 'next/link';
import { Archive, FileText, FolderLock, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';
import { api } from '../lib/api';

const fallbackOffer = {
  id: 'fallback',
  title: 'Découvrez Coffria avec une démonstration personnalisée',
  subtitle: 'Offre du moment',
  description: 'Présentez-nous votre organisation et vos besoins documentaires : nous vous proposerons la formule adaptée.',
  ctaLabel: 'Découvrir l’offre',
  ctaUrl: '/contact',
  placement: 'BOTH',
};

const fallbackPlans = [
  { id:'p', slug:'pro', name:'PRO', subtitle:'Pour les équipes qui collaborent au quotidien', priceLabel:'40 000 FCFA HT / mois', features:['500 Go de stockage','Signature électronique sécurisée','Gestion avancée des droits'], isHighlighted:true, badge:'Recommandée' },
  { id:'c', slug:'corporate', name:'CORPORATE', subtitle:'Pour les organisations et volumes importants', priceLabel:'60 000 FCFA HT / mois', features:['1 To de stockage','Multi-signataires et workflows','Support dédié'], isHighlighted:false, badge:'Corporate' },
  { id:'s', slug:'sur-mesure', name:'SUR MESURE', subtitle:'Pour les besoins supérieurs à 1 To', priceLabel:'À partir de 80 000 FCFA HT / mois', features:['Plus de 1 To','Paliers de +500 Go à 20 000 FCFA','Dimensionnement personnalisé'], isHighlighted:false, badge:'Flexible' },
];

function offerDetailHref(offer:any) {
  return offer?.id && offer.id !== 'fallback' ? `/offres/${offer.id}` : '/offres';
}
function planSlug(p:any){return String(p?.slug||p?.name||'').toLowerCase()}
function normalizePublicPlans(items:any[]){
  const pro=items.find((p:any)=>planSlug(p)==='pro');
  const corporate=items.find((p:any)=>planSlug(p)==='corporate');
  return [
    pro?{...pro,name:'PRO',priceLabel:'40 000 FCFA HT / mois',storageGb:500,features:['500 Go de stockage','Signature électronique sécurisée','Gestion avancée des droits'],isHighlighted:true,badge:pro.badge||'Recommandée'}:fallbackPlans[0],
    corporate?{...corporate,name:'CORPORATE',priceLabel:'60 000 FCFA HT / mois',storageGb:1000,features:['1 To de stockage','Multi-signataires et workflows','Support dédié'],isHighlighted:false,badge:corporate.badge||'Corporate'}:fallbackPlans[1],
    fallbackPlans[2],
  ];
}

export default function HomePage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api('/marketing/public/offers'), api('/marketing/public/plans')])
      .then(([o,p]) => { setOffers(o); setPlans(normalizePublicPlans(p)); })
      .catch(() => { setPlans(fallbackPlans); });
  }, []);

  const topOffer = useMemo(() => offers.find((x)=>['TOP','BOTH'].includes(x.placement)) || fallbackOffer, [offers]);
  const homeOffer = useMemo(() => offers.find((x)=>['HOME','BOTH'].includes(x.placement)) || fallbackOffer, [offers]);
  const displayPlans = plans.length ? plans : fallbackPlans;

  return (
    <main className="publicPage">
      <div className="promoStrip">
        <div className="publicContainer promoStripInner">
          <div><span className="promoPill">OFFRE DU MOMENT</span><strong>{topOffer.title}</strong><span>{topOffer.subtitle}</span></div>
          <Link href={offerDetailHref(topOffer)}>Découvrir l’offre →</Link>
        </div>
      </div>
      <PublicHeader />

      <section className="hero heroRich" style={{paddingTop:38}}>
        <div className="publicContainer heroGrid">
          <div className="heroCopy securityBackdrop">
            <span className="eyebrow">Archivage documentaire professionnel</span>
            <h1>Centralisez, classez et <span>sécurisez vos documents.</span></h1>
            <p className="heroLead">Coffria vous aide à structurer vos dossiers, maîtriser les accès, suivre les versions et retrouver rapidement l'information utile dans un espace documentaire professionnel.</p>
            <div className="heroActions">
              <Link href="/contact" className="publicPrimary">Demander une démonstration</Link>
              <Link href="/souscription" className="publicSecondary">Voir les tarifs</Link>
              <Link href="/connexion" className="textLink">Se connecter</Link>
            </div>
            <div className="heroTrust"><span><ShieldCheck size={17}/> Accès sécurisé</span><span><Archive size={17}/> Versioning</span><span><UsersRound size={17}/> Droits par rôle</span></div>
          </div>

          <div className="securityVisual" aria-label="Illustration de dossiers documentaires sécurisés">
            <div className="visualGlow"/>
            <div className="visualWindow">
              <div className="visualTop"><span/><span/><span/><strong>Coffria</strong></div>
              <div className="visualBody">
                <aside className="visualSide"><div className="miniLogo">C</div><i/><i/><i/><i/></aside>
                <div className="visualContent">
                  <div className="visualTitle"><div><small>Espace documentaire</small><strong>Dossiers sécurisés</strong></div><div className="shieldBubble"><ShieldCheck size={24}/></div></div>
                  <div className="visualSearch"><Search size={16}/><span>Rechercher un document...</span></div>
                  <div className="folderRows">
                    <div className="folderRow featuredFolder"><div className="folderIcon"><FolderLock size={24}/></div><div><strong>Affaires clients</strong><span>Accès restreint · 128 documents</span></div><b>•••</b></div>
                    <div className="folderRow"><div className="folderIcon"><FileText size={24}/></div><div><strong>Documents administratifs</strong><span>Versioning actif · 46 documents</span></div><b>•••</b></div>
                    <div className="folderRow"><div className="folderIcon"><Archive size={24}/></div><div><strong>Archives 2026</strong><span>Traçabilité activée</span></div><b>•••</b></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="floatingCard floatingLock"><ShieldCheck size={20}/><div><strong>Protection active</strong><span>Accès contrôlés</span></div></div>
            <div className="floatingCard floatingUsers"><UsersRound size={20}/><div><strong>Équipe</strong><span>Rôles & permissions</span></div></div>
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="publicContainer">
          <div className="sectionHead"><div><span className="eyebrow">Pourquoi Coffria ?</span><h2>Une gestion documentaire plus simple et plus sûre</h2></div><p>Organisez vos dossiers par entreprise, attribuez les bons droits aux bons utilisateurs et gardez une vision claire de votre patrimoine documentaire.</p></div>
          <div className="featureGrid">
            <article className="featureCard"><div className="featureIcon"><FolderLock size={22}/></div><h3>Classement structuré</h3><p>Dossiers, sous-dossiers et documents dans une arborescence claire.</p></article>
            <article className="featureCard"><div className="featureIcon"><UsersRound size={22}/></div><h3>Droits et rôles</h3><p>Administrateurs, éditeurs, lecteurs, groupes et permissions par dossier.</p></article>
            <article className="featureCard"><div className="featureIcon"><ShieldCheck size={22}/></div><h3>Sécurité et traçabilité</h3><p>Historique, versions, corbeille et stockage objet sécurisé.</p></article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="publicContainer">
          <div className="sectionHead"><div><span className="eyebrow">Nouveautés</span><h2>Ce qui évolue dans Coffria</h2></div><p>Les fonctionnalités s'enrichissent pour simplifier l'administration documentaire et le travail quotidien des équipes.</p></div>
          <div className="newsGrid">
            <article className="newsCard"><span className="newsTag">Nouveau</span><h3>Infrastructure sécurisée</h3><p>HTTPS, base PostgreSQL dédiée, stockage objet privé et sauvegardes structurées.</p></article>
            <article className="newsCard"><span className="newsTag">Produit</span><h3>Gestion avancée des accès</h3><p>Permissions par utilisateurs, groupes et dossiers pour mieux contrôler la diffusion.</p></article>
            <article className="newsCard"><span className="newsTag">À venir</span><h3>Recherche documentaire enrichie</h3><p>Une recherche plus naturelle pour retrouver plus rapidement les dossiers et documents utiles.</p></article>
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="publicContainer">
          <div className="offerBanner promoOfferBanner">
            <div><span className="eyebrow">{homeOffer.subtitle || 'Offre du moment'}</span><h2>{homeOffer.title}</h2><p>{homeOffer.description}</p></div>
            <Link href={offerDetailHref(homeOffer)} className="publicPrimary">Découvrir cette offre</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="publicContainer">
          <div className="sectionHead"><div><span className="eyebrow">Formules</span><h2>Choisissez votre niveau d’accompagnement</h2></div><Link href="/souscription" className="textLink">Voir tous les tarifs →</Link></div>
          <div className="pricingGrid compactPricing">{displayPlans.map((plan:any)=><article key={plan.id || plan.name} className={`priceCard ${plan.isHighlighted?'featured':''}`}>{plan.badge&&<span className="planBadge">{plan.badge}</span>}<div className="priceName">{plan.name}</div><p>{plan.subtitle}</p><div className="priceAmount">{plan.priceLabel || 'Sur devis'}</div><ul className="priceList">{(Array.isArray(plan.features)?plan.features:[]).slice(0,3).map((f:string)=><li key={f}>{f}</li>)}</ul><Link href={`/souscription?plan=${encodeURIComponent(plan.slug||plan.name)}`} className={plan.isHighlighted?'publicPrimary':'publicSecondary'}>Choisir cette offre</Link></article>)}</div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
