'use client';
import { Suspense } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { SubscriptionPricing } from '../../components/SubscriptionPricing';

export default function Page(){
  return <main className="publicPage"><PublicHeader/><section className="pageHero"><div className="publicContainer"><span className="eyebrow">Souscription Coffria</span><h1>Choisissez votre périodicité</h1><p>Confirmez votre pack puis choisissez le règlement mensuel ou annuel.</p></div></section><Suspense fallback={<div className="section">Chargement…</div>}><SubscriptionPricing/></Suspense><PublicFooter/></main>;
}
