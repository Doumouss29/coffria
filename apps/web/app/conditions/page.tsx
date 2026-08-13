'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

export default function ConditionsPage(){
 const[terms,setTerms]=useState<any>(null);const[accepted,setAccepted]=useState(false);const[plan,setPlan]=useState('essentiel');const[billing,setBilling]=useState<'monthly'|'yearly'>('monthly');
 useEffect(()=>{api('/legal-terms/public').then(setTerms).catch(()=>{});const params=new URLSearchParams(window.location.search);setPlan(params.get('plan')||'essentiel');setBilling(params.get('billing')==='yearly'?'yearly':'monthly')},[]);
 const version=terms?.version||'1.0';
 const content=String(terms?.content||'Chargement des conditions…').replace(/\\n/g,'\n');
 return <main className="publicPage"><PublicHeader/><section className="pageHero"><div className="publicContainer"><span className="eyebrow">Étape 3 sur 4</span><h1>Conditions de vente et d’utilisation</h1><p>Pack <strong>{plan.toUpperCase()}</strong> · paiement <strong>{billing==='yearly'?'annuel':'mensuel'}</strong>. Veuillez lire et accepter les conditions avant de poursuivre.</p><div className="subscriptionSteps"><span>1. Pack ✓</span><span>2. Périodicité ✓</span><span className="active">3. Conditions</span><span>4. Souscription</span></div></div></section><section className="section"><div className="publicContainer termsLayout"><article className="termsCard"><h2>{terms?.title||'Conditions Générales de Vente et d’Utilisation Coffria'}</h2><small>Version {version}</small><pre className="termsText">{content}</pre></article><aside className="termsAccept"><h3>Validation</h3><p><strong>Pack :</strong> {plan.toUpperCase()}</p><p><strong>Facturation :</strong> {billing==='yearly'?'Annuelle':'Mensuelle'}</p><label className="termsCheck"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>J’ai lu et j’accepte les conditions Coffria, version {version}.</span></label>{accepted?<Link className="publicPrimary" href={`/contact?subscription=1&plan=${encodeURIComponent(plan)}&billing=${billing}&termsVersion=${encodeURIComponent(version)}`}>Poursuivre la souscription</Link>:<button type="button" className="publicPrimary" disabled>Acceptez les conditions pour continuer</button>}<Link className="publicSecondary" href={`/souscription?plan=${encodeURIComponent(plan)}&billing=${billing}`}>Modifier mon choix</Link></aside></div></section><PublicFooter/></main>
}
