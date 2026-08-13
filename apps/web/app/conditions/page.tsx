'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

export default function ConditionsPage(){
 const[terms,setTerms]=useState<any>(null);const[accepted,setAccepted]=useState(false);
 useEffect(()=>{api('/legal-terms/public').then(setTerms).catch(()=>{})},[]);
 return <main className="publicPage"><PublicHeader/><section className="pageHero"><div className="publicContainer"><span className="eyebrow">Souscription Coffria</span><h1>Conditions de vente et d’utilisation</h1><p>Veuillez lire et accepter les conditions avant de poursuivre votre souscription.</p></div></section><section className="section"><div className="publicContainer termsLayout"><article className="termsCard"><h2>{terms?.title||'Conditions Générales de Vente et d’Utilisation Coffria'}</h2><small>Version {terms?.version||'1.0'}</small><pre className="termsText">{terms?.content||'Chargement des conditions…'}</pre></article><aside className="termsAccept"><h3>Validation</h3><label className="termsCheck"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>J’ai lu et j’accepte les conditions Coffria.</span></label><Link className={`publicPrimary ${accepted?'':'disabledLink'}`} href={accepted?'/contact?terms=accepted':'#'}>Continuer ma souscription</Link><Link className="publicSecondary" href="/tarifs">Retour aux tarifs</Link></aside></div></section><PublicFooter/></main>
}
