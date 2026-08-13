'use client';

import Link from 'next/link';
import { Ban, CheckCircle2, Clock3, FileSignature, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const labels:any={PENDING:'En attente',PARTIALLY_SIGNED:'Partiellement signé',COMPLETED:'Signé',REFUSED:'Refusé',EXPIRED:'Expiré',CANCELLED:'Annulé'};

export function SignatureWorkspace({openCreate}:{openCreate:()=>void}){
  const[data,setData]=useState<any>({items:[],entitlement:{used:0,limit:null,remaining:null}});
  const[filter,setFilter]=useState('ALL');
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');

  async function load(){setData(await api('/signature-workspace'))}
  useEffect(()=>{load().catch(e=>setError(e.message))},[]);

  async function cancel(item:any){if(!confirm(`Annuler la demande « ${item.title} » ?`))return;try{await api(`/signature-workspace/${item.id}/cancel`,{method:'POST'});setNotice('Demande annulée.');await load()}catch(e:any){setError(e.message)}}
  async function remove(item:any){if(!confirm(`Retirer « ${item.title} » de l’espace Signature ?`))return;try{await api(`/signature-workspace/${item.id}`,{method:'DELETE'});setNotice('Demande retirée de la vue.');await load()}catch(e:any){setError(e.message)}}

  const items=data.items||[];
  const pending=items.filter((x:any)=>['PENDING','PARTIALLY_SIGNED'].includes(x.status)).length;
  const completed=items.filter((x:any)=>x.status==='COMPLETED').length;
  const myEmail=String(data.currentUserEmail||'').toLowerCase();
  const mine=items.filter((x:any)=>x.recipients?.some((r:any)=>String(r.email).toLowerCase()===myEmail&&['PENDING','VIEWED'].includes(r.status))).length;
  const shown=useMemo(()=>items.filter((x:any)=>filter==='ALL'||(filter==='PENDING'&&['PENDING','PARTIALLY_SIGNED'].includes(x.status))||(filter==='COMPLETED'&&x.status==='COMPLETED')||(filter==='CLOSED'&&['REFUSED','EXPIRED','CANCELLED'].includes(x.status))),[items,filter]);
  const entitlement=data.entitlement||{};
  const canCreate=entitlement.enabled!==false&&(entitlement.limit==null||(entitlement.used||0)<entitlement.limit);

  return <>
    <div className="pageTitle"><div><h1>Espace signature</h1><p className="muted">Suivez vos documents signés, ceux en attente et les circuits de signature.</p></div><button className="primary" disabled={!canCreate} onClick={openCreate}><Plus size={17}/> Nouvelle signature</button></div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
    {!canCreate&&<div className="alert error">Le quota de signatures de l’abonnement est atteint.</div>}
    <div className="stats"><div className="stat"><FileSignature/><b>{items.length}</b><span>Demandes</span></div><div className="stat"><Clock3/><b>{pending}</b><span>En attente</span></div><div className="stat"><CheckCircle2/><b>{completed}</b><span>Signées</span></div><div className="stat"><Send/><b>{mine}</b><span>À signer par moi</span></div><div className="stat"><FileSignature/><b>{entitlement.remaining==null?'∞':entitlement.remaining}</b><span>{entitlement.limit==null?`${entitlement.used||0} utilisées · illimité`:`${entitlement.used||0} / ${entitlement.limit} utilisées`}</span></div></div>
    <div className="toolbar"><button className={filter==='ALL'?'primary':'secondary'} onClick={()=>setFilter('ALL')}>Toutes</button><button className={filter==='PENDING'?'primary':'secondary'} onClick={()=>setFilter('PENDING')}>En attente</button><button className={filter==='COMPLETED'?'primary':'secondary'} onClick={()=>setFilter('COMPLETED')}>Signées</button><button className={filter==='CLOSED'?'primary':'secondary'} onClick={()=>setFilter('CLOSED')}>Clôturées</button></div>
    <div className="card tableCard"><table className="table"><thead><tr><th>Document</th><th>Statut</th><th>Signataires</th><th>Créée le</th><th>Document final</th><th>Actions</th></tr></thead><tbody>{!shown.length&&<tr><td colSpan={6} className="empty">Aucune demande.</td></tr>}{shown.map((item:any)=><tr key={item.id}><td><strong>{item.title}</strong><div className="muted">{item.sourceDocument?.name}</div></td><td><span className={`signatureStatus ${item.status}`}>{labels[item.status]||item.status}</span></td><td>{item.recipients?.map((r:any)=><div className="signatureRecipient" key={r.id}><span>{r.order}. {r.name}</span><small>{r.status==='SIGNED'?'Signé':r.status==='REFUSED'?'Refusé':r.status==='VIEWED'?'Vu':'En attente'}</small></div>)}</td><td>{new Date(item.createdAt).toLocaleString('fr-FR')}</td><td>{item.finalDocument?<Link href={`/viewer/${item.finalDocument.id}`}>Voir le PDF signé</Link>:'—'}</td><td><div className="rowActions">{['PENDING','PARTIALLY_SIGNED'].includes(item.status)&&<button className="secondary" onClick={()=>cancel(item)}><Ban size={15}/> Annuler</button>}<button className="dangerButton" onClick={()=>remove(item)}><Trash2 size={15}/> Retirer</button></div></td></tr>)}</tbody></table></div>
  </>;
}
