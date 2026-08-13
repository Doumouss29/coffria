'use client';

import { useSearchParams } from 'next/navigation';
import { Plus, XCircle } from 'lucide-react';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { SignatureWorkspace } from '../../components/SignatureWorkspace';
import { api } from '../../lib/api';

function SignaturesContent(){
  const params=useSearchParams();
  const initialDocumentId=params.get('documentId')||'';
  const initialName=params.get('name')||'';
  const[show,setShow]=useState(Boolean(initialDocumentId));
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[documentId,setDocumentId]=useState(initialDocumentId);
  const[documentName,setDocumentName]=useState(initialName);
  const[title,setTitle]=useState(initialName?`Signature — ${initialName}`:'');
  const[message,setMessage]=useState('');
  const[expiresAt,setExpiresAt]=useState('');
  const[recipients,setRecipients]=useState([{name:'',email:''}]);
  const[reloadKey,setReloadKey]=useState(0);
  const[subscription,setSubscription]=useState<any>({signatureEnabled:true,signatureUsageLimit:null,signatureUsageUsed:0});

  useEffect(()=>{api('/signature-subscription').then(setSubscription).catch(e=>setError(e.message))},[]);
  function patchRecipient(index:number,key:'name'|'email',value:string){setRecipients(r=>r.map((x,i)=>i===index?{...x,[key]:value}:x))}
  function addRecipient(){setRecipients(r=>[...r,{name:'',email:''}])}
  function removeRecipient(i:number){setRecipients(r=>r.filter((_,x)=>x!==i))}

  async function create(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      await api('/signatures',{method:'POST',body:JSON.stringify({documentId,title,message:message||undefined,expiresAt:expiresAt||undefined,recipients})});
      setShow(false);setDocumentId('');setDocumentName('');setTitle('');setMessage('');setExpiresAt('');setRecipients([{name:'',email:''}]);setReloadKey(v=>v+1);
      setSubscription(await api('/signature-subscription'));
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  const quotaReached=subscription.signatureUsageLimit!=null&&subscription.signatureUsageUsed>=subscription.signatureUsageLimit;

  return <AppShell title="Espace signature"><section className="content">
    {error&&<div className="alert error">{error}</div>}
    <div key={reloadKey}><SignatureWorkspace openCreate={()=>setShow(true)}/></div>
    {show&&<div className="modalBackdrop"><form className="modal wide" onSubmit={create}><h2>Nouvelle demande de signature</h2>{quotaReached&&<div className="alert error">Quota de signatures atteint.</div>}<label className="field">Document PDF<input value={documentName||documentId} onChange={e=>{setDocumentName('');setDocumentId(e.target.value)}} placeholder="Sélectionnez idéalement le document depuis l’Explorateur" required/></label><p className="muted">Depuis Mes dossiers → Actions → Demander des signatures, le document est sélectionné automatiquement.</p><label className="field">Objet de la signature<input value={title} onChange={e=>setTitle(e.target.value)} required/></label><label className="field">Message aux signataires<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3}/></label><label className="field">Date d’expiration<input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label><h3>Signataires dans l’ordre</h3><div className="signatureRecipientsEditor">{recipients.map((r,i)=><div className="signatureRecipientEditor" key={i}><span>{i+1}</span><input placeholder="Nom" value={r.name} onChange={e=>patchRecipient(i,'name',e.target.value)} required/><input type="email" placeholder="Email" value={r.email} onChange={e=>patchRecipient(i,'email',e.target.value)} required/>{recipients.length>1&&<button type="button" onClick={()=>removeRecipient(i)}><XCircle size={17}/></button>}</div>)}</div><button type="button" className="secondary" onClick={addRecipient}><Plus size={15}/> Ajouter un signataire</button><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary" disabled={busy||quotaReached}>{busy?'Création…':'Envoyer pour signature'}</button></div></form></div>}
  </section></AppShell>;
}

export default function SignaturesPage(){
  return <Suspense fallback={<AppShell title="Espace signature"><section className="content"><p className="muted">Chargement…</p></section></AppShell>}><SignaturesContent/></Suspense>;
}
