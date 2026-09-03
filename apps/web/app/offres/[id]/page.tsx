'use client';

import Link from 'next/link';
import { ArrowLeft, BadgePercent, CalendarDays, CheckCircle2, Gift, MessageCircle, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import PublicHeader from '../../../components/PublicHeader';
import PublicFooter from '../../../components/PublicFooter';
import { api } from '../../../lib/api';

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}
function normalizeOffer(offer:any){const text=`${offer?.title||''} ${offer?.subtitle||''} ${offer?.description||''} ${offer?.ctaLabel||''}`.toUpperCase();if(!text.includes('ESSENTIEL'))return offer;return {...offer,title:'Pack CORPORATE — 1 To',subtitle:'Offre du moment',description:'1 To de stockage documentaire sécurisé à 60 000 FCFA HT par mois. En paiement annuel, bénéficiez de deux mois offerts, soit 600 000 FCFA HT par an.',ctaLabel:'Choisir le Pack CORPORATE',ctaUrl:'/souscription?plan=corporate'};}

export default function OfferDetailPage() {
  const params = useParams<{ id: string }>();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/marketing/public/offers').then((items:any[])=>setOffers((items||[]).map(normalizeOffer))).finally(() => setLoading(false));
  }, []);

  const offer = useMemo(() => offers.find((item) => item.id === params.id), [offers, params.id]);

  if (loading) return <main className="publicPage"><PublicHeader/><section className="section"><div className="publicContainer"><p>Chargement de l’offre…</p></div></section><PublicFooter/></main>;

  if (!offer) {
    return <main className="publicPage"><PublicHeader/><section className="section"><div className="publicContainer offerDetailEmpty"><span className="eyebrow">Offre indisponible</span><h1>Cette offre n’est plus disponible.</h1><p>Consultez les offres actuellement actives ou contactez-nous pour une proposition adaptée.</p><div className="heroActions"><Link href="/offres" className="publicPrimary">Voir les offres</Link><Link href="/contact" className="publicSecondary">Nous contacter</Link></div></div></section><PublicFooter/></main>;
  }

  const start = formatDate(offer.startAt);
  const end = formatDate(offer.endAt);
  const ctaHref = offer.ctaUrl || '/souscription';

  return (
    <main className="publicPage offerDetailPage">
      <PublicHeader />
      <section className="offerDetailHero"><div className="publicContainer"><Link href="/offres" className="offerBack"><ArrowLeft size={17}/> Retour aux offres</Link><div className="offerDetailHeroGrid"><div><span className="offersEyebrow"><Sparkles size={16}/> {offer.subtitle || 'Offre spéciale Coffria'}</span><h1>{offer.title}</h1><p>{offer.description}</p><div className="offerDetailMeta"><span><BadgePercent size={18}/> Offre promotionnelle</span><span><CalendarDays size={18}/> {start ? `À partir du ${start}` : 'Disponible maintenant'}{end ? ` jusqu’au ${end}` : ''}</span></div></div><div className="offerDetailGift"><Gift size={64}/><strong>OFFRE DU MOMENT</strong><span>Coffria</span></div></div></div></section>
      <section className="section offerDetailSection"><div className="publicContainer offerDetailGrid"><article className="offerDetailCard"><span className="promoBadge"><BadgePercent size={15}/> Offre Coffria</span><h2>{offer.title}</h2><p className="offerDetailDescription">{offer.description}</p><div className="offerDetailBenefits"><div><CheckCircle2 size={20}/><span>Démonstration personnalisée de Coffria</span></div><div><CheckCircle2 size={20}/><span>Analyse de vos besoins documentaires</span></div><div><CheckCircle2 size={20}/><span>Orientation vers la formule la plus adaptée</span></div><div><CheckCircle2 size={20}/><span>Accompagnement au démarrage selon l’offre</span></div></div><div className="offerDetailActionBox"><div><small>Vous souhaitez profiter de cette offre ?</small><strong>Choisissez votre périodicité puis validez les conditions.</strong></div><div className="heroActions"><Link href={ctaHref} className="publicPrimary">{offer.ctaLabel || 'Profiter de l’offre'}</Link><a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer" className="publicSecondary"><MessageCircle size={17}/> WhatsApp</a></div></div></article><aside className="offerDetailAside"><div className="offerSummaryCard"><span>Disponibilité</span><strong>{end ? `Jusqu’au ${end}` : 'Offre en cours'}</strong></div><div className="offerSummaryCard"><span>Contact</span><strong>contact.lmurbs@gmail.com</strong></div><div className="offerSummaryCard highlight"><span>Besoin d’une autre formule ?</span><strong>Consultez nos trois packs.</strong><Link href="/souscription">Voir les tarifs →</Link></div></aside></div></section>
      <PublicFooter />
    </main>
  );
}
