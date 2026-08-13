'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, FileSignature, Plus, Send, XCircle } from 'lucide-react';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

const labels:any={DRAFT:'Brouillon',PENDING:'En attente',PARTIALLY_SIGNED:'Partiellement signé',COMPLETED:'Signé',REFUSED:'Refusé',EXPIRED:'Expiré',CANCELLED:'Annulé'};

function SignaturesContent(){
  const params=useSearchParams();const initialDocumentId=params.get('documentId')||'';const initialName=params.get('name')||'';
  const[items,setItems]=useState<any[]>([]);const[show,setShow]=useState(Boolean(initialDocumentId));const[error,setError]=useState('');const[notice,setNotice]=useState('');const[busy,setBusy]=useState(false);
  const[documentId,setDocumentId]=useState(initialDocumentId);const[documentName,setDocumentName]=useState(initialName);const[title,setTitle]=useState(initialName?`Signature — ${initialName}`:'');const[message,setMessage]=useState('');const[expiresAt,setExpiresAt]=useState('');const[recipients,setRecipients]=useState([{name:'',email:''}]);
  async function load(){setItems(await api('/signatures'))}useEffect(()=>{load().catch(e=>setError(e.message))},[]);
  function patchRecipient(index:number,key:'name'|'email',value:string){setRecipients(r=>r.map((x,i)=>i===index?{...x,[key]:value}:x))}
  function addRecipient(){setRecipients(r=>[...r,{name:'',email:''}])}function removeRecipient(i:number){setRecipients(r=>r.filter((_,x)=>x!==i))}
  async function create(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/signatures',{method:'POST',body:JSON.stringify({documentId,title,message:message||undefined,expiresAt:expiresAt||undefined,recipients})});setShow(false);setNotice('Demande de signature créée. Le premier signataire a reçu son lien sécurisé.');await load();}catch(e:any){setError(e.message)}finally{setBusy(false)}}
  const completed=useMemo(()=>items.filter(x=>x.status==='COMPLETED').length,[items]);
  return <AppShell title="Signatures Coffria"><section className="content">
    <div className="pageTitle"><div><h1>Signatures</h1><p className="muted">Faites signer vos PDF à une ou plusieurs personnes, dans l’ordre défini, sans quitter Coffria.</p></div><button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Nouvelle signature</button></div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
    <div className="stats"><div className="stat"><FileSignature/><b>{items.length}</b><span>Demandes</span></div><div className="stat"><CheckCircle2/><b>{completed}</b><span>Terminées</span></div><div className="stat"><Send/><b>{items.filter(x=>['PENDING','PARTIALLY_SIGNED'].includes(x.status)).length}</b><span>En cours</span></div></div>
    <div className="card tableCard"><table className="table"><thead><tr><th>Document</th><th>Statut</th><th>Signataires</th><th>Créée le</th><th>Document final</th></tr></thead><tbody>{!items.length&&<tr><td className="empty" colSpan={5}>Aucune demande de signature.</td></tr>}{items.map(item=><tr key={item.id}><td><strong>{item.title}</strong><div className="muted">{item.sourceDocument?.name}</div></td><td><span className={`signatureStatus ${item.status}`}>{labels[item.status]||item.status}</span></td><td>{item.recipients?.map((r:any)=><div key={r.id} className="signatureRecipient"><span>{r.order}. {r.name}</span><small>{r.status}</small></div>)}</td><td>{new Date(item.createdAt).toLocaleString('fr-FR')}</td><td>{item.finalDocument?<Link href={`/viewer/${item.finalDocument.id}`}>Voir le PDF signé</Link>:'—'}</td></tr>)}</tbody></table></div>
    {show&&<div className="modalBackdrop"><form className="modal wide" onSubmit={create}><h2>Nouvelle demande de signature</h2><label className="field">Document PDF<input value={documentName||documentId} onChange={e=>{setDocumentName('');setDocumentId(e.target.value)}} placeholder="Sélectionnez idéalement le document depuis l’Explorateur" required/></label><p className="muted">Astuce : depuis Mes dossiers → Actions → Demander des signatures, le document est sélectionné automatiquement.</p><label className="field">Objet de la signature<input value={title} onChange={e=>setTitle(e.target.value)} required/></label><label className="field">Message aux signataires<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3}/></label><label className="field">Date d’expiration<input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label><h3>Signataires dans l’ordre</h3><div className="signatureRecipientsEditor">{recipients.map((r,i)=><div className="signatureRecipientEditor" key={i}><span>{i+1}</span><input placeholder="Nom" value={r.name} onChange={e=>patchRecipient(i,'name',e.target.value)} required/><input type="email" placeholder="Email" value={r.email} onChange={e=>patchRecipient(i,'email',e.target.value)} required/>{recipients.length>1&&<button type="button" onClick={()=>removeRecipient(i)}><XCircle size={17}/></button>}</div>)}</div><button type="button" className="secondary" onClick={addRecipient}><Plus size={15}/> Ajouter un signataire</button><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary" disabled={busy}>{busy?'Création…':'Envoyer pour signature'}</button></div></form></div>}
  </section></AppShell>;
}

export default function SignaturesPage(){
  return <Suspense fallback={<AppShell title="Signatures Coffria"><section className="content"><p className="muted">Chargement des signatures…</p></section></AppShell>}><SignaturesContent/></Suspense>;
}
