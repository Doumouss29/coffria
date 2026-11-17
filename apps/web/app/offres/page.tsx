'use client';

import Link from 'next/link';
import { BadgePercent, CalendarDays, Check, Gift, Sparkles, TimerReset } from 'lucide-react';
import { useEffect, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

const fallbackOffers=[{
  id:'sur-mesure',
  title:'Pack SUR MESURE — à partir de 1,5 To',
  subtitle:'Offre du moment',
  description:'À partir de 1,5 To de stockage documentaire sécurisé à 80 000 FCFA HT par mois, puis +20 000 FCFA HT par palier supplémentaire de 500 Go.',
  ctaLabel:'Choisir le Pack SUR MESURE',
  ctaUrl:'/souscription?plan=sur-mesure',
  startAt:null,
  endAt:null
}];

const included=[
  'Extensible par paliers de 500 Go',
  'Recherche intelligente IA et indexation documentaire',
  'Signature électronique sécurisée',
  'Traçabilité SHA-256',
  'Support dédié',
];

function formatDate(value?:string|null){
  if(!value)return null;
  return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(value))
}

function normalizeOffer(offer:any){
  return {
    ...offer,
    title:'Pack SUR MESURE — à partir de 1,5 To',
    subtitle:'Offre du moment',
    description:'À partir de 1,5 To de stockage documentaire sécurisé à 80 000 FCFA HT par mois, puis +20 000 FCFA HT par palier supplémentaire de 500 Go.',
    ctaLabel:'Choisir le Pack SUR MESURE',
    ctaUrl:'/souscription?plan=sur-mesure'
  };
}

export default function OffersPage(){
  const[offers,setOffers]=useState<any[]>([]);
  useEffect(()=>{api('/marketing/public/offers').then((items:any[])=>setOffers((items||[]).map(normalizeOffer))).catch(()=>{})},[]);
  const displayOffers=offers.length?offers:fallbackOffers;

  return <main className="publicPage offersPage">
    <PublicHeader/>

    <section className="offersHero">
      <div className="publicContainer offersHeroInner">
        <div>
          <span className="offersEyebrow"><Sparkles size={16}/> Promotions & avantages Coffria</span>
          <h1>Les offres du moment</h1>
          <p>Profitez des offres commerciales Coffria actuellement disponibles pour lancer ou faire évoluer votre espace documentaire.</p>
          <div className="heroActions">
            <Link href="/contact" className="offersWhiteButton">Demander une démonstration</Link>
            <Link href="/souscription" className="offersGhostButton">Voir les tarifs</Link>
          </div>
        </div>
        <div className="offersHeroArt" aria-hidden="true">
          <div className="giftDisc"><Gift size={52}/></div>
          <div className="saleBadge"><BadgePercent size={23}/> OFFRE ACTIVE</div>
          <div className="spark sparkOne">✦</div>
          <div className="spark sparkTwo">✦</div>
        </div>
      </div>
    </section>

    <section className="section offersSection">
      <div className="publicContainer">
        <div className="sectionHead">
          <div>
            <span className="eyebrow">À saisir maintenant</span>
            <h2>Choisissez l’offre adaptée à votre projet</h2>
          </div>
        </div>

        <div className="featuredOfferGrid">
          {displayOffers.slice(0,1).map((offer:any,index:number)=>{
            const start=formatDate(offer.startAt),end=formatDate(offer.endAt);
            return <article key={offer.id||index} className="featuredOfferCard">
              <div className="featuredOfferMain">
                <div className="offerCardTop">
                  <span className="promoBadge"><BadgePercent size={15}/> Offre du moment</span>
                  <span className="featuredPromo">Flexible</span>
                </div>

                <h3>{offer.title}</h3>
                <p>{offer.description}</p>

                <div className="featuredAnnualDeal">
                  <Gift size={22}/>
                  <strong>2 mois offerts en paiement annuel</strong>
                </div>

                <div className="featuredOfferMeta">
                  <span><CalendarDays size={17}/>{start ? 'Du '+start : 'Disponible maintenant'}</span>
                  <span><TimerReset size={17}/>{end ? 'Jusqu’au '+end : 'Offre disponible actuellement'}</span>
                </div>

                <div className="offerCardAction">
                  <Link href={offer.ctaUrl||'/souscription?plan=sur-mesure'}>{offer.ctaLabel||'Choisir le Pack SUR MESURE'} →</Link>
                </div>
              </div>

              <aside className="featuredOfferIncluded">
                <h3>Ce pack inclut</h3>
                <ul>
                  {included.map(item=><li key={item}><span><Check size={18}/></span>{item}</li>)}
                </ul>
              </aside>
            </article>
          })}
        </div>

        <div className="offersBottomCta">
          <div><span>Besoin d’un conseil ?</span><h2>Nous vous aidons à choisir la meilleure formule Coffria.</h2></div>
          <div className="heroActions"><Link href="/contact" className="publicPrimary">Nous contacter</Link><a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer" className="publicSecondary">WhatsApp</a></div>
        </div>
      </div>
    </section>

    <PublicFooter/>
  </main>
}
