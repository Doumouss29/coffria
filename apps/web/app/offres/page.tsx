'use client';

import Link from 'next/link';
import { BadgePercent, CalendarDays, Gift, Sparkles, TimerReset } from 'lucide-react';
import { useEffect, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

const fallbackOffers = [
  {
    id: 'launch',
    title: 'Offre de lancement Coffria',
    subtitle: 'Lancement',
    description: 'Démarrez votre archivage documentaire dans de bonnes conditions avec un accompagnement personnalisé.',
    ctaLabel: 'Profiter de l’offre',
    ctaUrl: '/contact',
    startAt: null,
    endAt: null,
  },
];

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}

export default function OffersPage() {
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    api('/marketing/public/offers').then(setOffers).catch(() => {});
  }, []);

  const displayOffers = offers.length ? offers : fallbackOffers;

  return (
    <main className="publicPage offersPage">
      <PublicHeader />

      <section className="offersHero">
        <div className="publicContainer offersHeroInner">
          <div>
            <span className="offersEyebrow"><Sparkles size={16}/> Promotions & avantages Coffria</span>
            <h1>Les offres du moment</h1>
            <p>Profitez des offres commerciales Coffria actuellement disponibles pour lancer ou faire évoluer votre espace documentaire.</p>
            <div className="heroActions">
              <Link href="/contact" className="offersWhiteButton">Demander une démonstration</Link>
              <Link href="/tarifs" className="offersGhostButton">Voir les tarifs</Link>
            </div>
          </div>
          <div className="offersHeroArt" aria-hidden="true">
            <div className="giftDisc"><Gift size={52}/></div>
            <div className="saleBadge"><BadgePercent size={23}/> OFFRES ACTIVES</div>
            <div className="spark sparkOne">✦</div>
            <div className="spark sparkTwo">✦</div>
          </div>
        </div>
      </section>

      <section className="section offersSection">
        <div className="publicContainer">
          <div className="sectionHead">
            <div><span className="eyebrow">À saisir maintenant</span><h2>Choisissez l’offre adaptée à votre projet</h2></div>
            <p>Les offres actives sont gérées directement depuis l’espace Super Admin Coffria.</p>
          </div>

          <div className="offersGrid">
            {displayOffers.map((offer:any, index:number) => {
              const start = formatDate(offer.startAt);
              const end = formatDate(offer.endAt);
              return (
                <article key={offer.id || index} className={`offerCardPromo promoTone${index % 4}`}>
                  <div className="offerCardTop">
                    <span className="promoBadge"><BadgePercent size={15}/> {offer.subtitle || 'Offre spéciale'}</span>
                    {index === 0 && <span className="featuredPromo">À LA UNE</span>}
                  </div>
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  {(start || end) && <div className="offerDates"><CalendarDays size={17}/><span>{start ? `Du ${start}` : 'Disponible maintenant'}{end ? ` au ${end}` : ''}</span></div>}
                  {!end && <div className="offerDates"><TimerReset size={17}/><span>Offre disponible actuellement</span></div>}
                  <div className="offerCardAction">
                    <Link href={offer.ctaUrl || '/contact'}>{offer.ctaLabel || "Découvrir l'offre"} →</Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="offersBottomCta">
            <div><span>Besoin d’un conseil ?</span><h2>Nous vous aidons à choisir la meilleure formule Coffria.</h2></div>
            <div className="heroActions">
              <Link href="/contact" className="publicPrimary">Nous contacter</Link>
              <a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer" className="publicSecondary">WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
