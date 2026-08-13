'use client';
import { FormEvent, useEffect, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

export default function ContactPage() {
  const [name,setName]=useState('');const[email,setEmail]=useState('');const[company,setCompany]=useState('');const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);const[notice,setNotice]=useState('');const[error,setError]=useState('');const[selection,setSelection]=useState<any>(null);

  useEffect(()=>{
    const current=new URLSearchParams(window.location.search);
    let plan=current.get('plan');let billing=current.get('billing');const terms=current.get('terms');
    if(!plan&&document.referrer.includes('/conditions')){try{const ref=new URL(document.referrer);plan=ref.searchParams.get('plan');billing=ref.searchParams.get('billing')}catch{}}
    if(plan){const period=billing==='yearly'?'annuel':'mensuel';setSelection({plan,billing:period,terms:terms==='accepted'});setMessage(`Je souhaite souscrire au Pack ${plan.toUpperCase()} avec paiement ${period}.${terms==='accepted'?' J’ai accepté les Conditions Générales de Vente et d’Utilisation Coffria.':''}`)}
  },[]);

  async function submit(e:FormEvent){e.preventDefault();try{setBusy(true);setNotice('');setError('');await api('/contact',{method:'POST',body:JSON.stringify({name,email,company,message})});setNotice('Votre demande a bien été envoyée. Nous vous répondrons rapidement.');setName('');setEmail('');setCompany('');setMessage('')}catch(e:any){setError(e.message||'Impossible d’envoyer votre message pour le moment.')}finally{setBusy(false)}}
  function openWhatsApp(){const text=encodeURIComponent(`Bonjour, je souhaite en savoir plus sur Coffria.\nNom : ${name}\nOrganisation : ${company}\nMessage : ${message}`);window.open(`https://wa.me/2250711124359?text=${text}`,'_blank','noopener,noreferrer')}

  return <main className="publicPage"><PublicHeader/><section className="pageHero"><div className="publicContainer"><span className="eyebrow">Contact</span><h1>{selection?'Finaliser votre demande Coffria':'Parlons de vos besoins documentaires'}</h1><p>{selection?`Pack ${selection.plan.toUpperCase()} · paiement ${selection.billing}. Notre équipe vous recontacte pour finaliser l’activation et le règlement.`:'Demandez une démonstration, une proposition commerciale ou des informations complémentaires sur Coffria.'}</p></div></section><section className="section"><div className="publicContainer contactGrid"><aside className="contactInfo"><h2>Nous contacter</h2><p>Notre équipe vous accompagne pour définir la formule et les quotas adaptés à votre organisation.</p>{selection&&<div className="checkoutSummary"><strong>Votre choix</strong><br/><span>Pack {selection.plan.toUpperCase()} · {selection.billing}</span></div>}<div><strong>Email</strong><br/><a href="mailto:contact.lmurbs@gmail.com">contact.lmurbs@gmail.com</a></div><div><strong>WhatsApp</strong><br/><a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer">+225 07 11 12 43 59</a></div><div><strong>Éditeur</strong><br/><span>LMurbs</span></div></aside><form className="contactForm" onSubmit={submit}><label>Nom et prénom<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Adresse email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Organisation<input value={company} onChange={e=>setCompany(e.target.value)}/></label><label>Votre message<textarea value={message} onChange={e=>setMessage(e.target.value)} required/></label>{notice&&<div className="alert success">{notice}</div>}{error&&<div className="alert error">{error}</div>}<div className="contactActions"><button type="submit" className="publicPrimary" disabled={busy}>{busy?'Envoi…':'Envoyer la demande'}</button><button type="button" className="publicSecondary" onClick={openWhatsApp}>Envoyer par WhatsApp</button></div></form></div></section><PublicFooter/></main>
}
