import { Suspense } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { SubscriptionPricing } from '../../components/SubscriptionPricing';

export default function Page(){
  return <main className="publicPage"><PublicHeader/><section className="pageHero"><div className="publicContainer"><span className="eyebrow">Tarifs & souscription Coffria</span><h1>Choisissez votre pack puis votre périodicité</h1><p>Sélectionnez d’abord la formule adaptée à votre organisation. Vous choisirez ensuite le règlement mensuel ou annuel avant d’accepter les conditions.</p></div></section><Suspense fallback={<div className="section">Chargement des offres…</div>}><SubscriptionPricing/></Suspense><PublicFooter/></main>;
}
