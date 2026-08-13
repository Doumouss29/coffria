'use client';
import { Save } from 'lucide-react';
import { useEffect,useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

export default function ConditionsAdmin(){
 const[form,setForm]=useState<any>({title:'',content:'',version:'1.0'});const[error,setError]=useState('');const[notice,setNotice]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{api('/legal-terms').then(setForm).catch(e=>setError(e.message))},[]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{setForm(await api('/legal-terms',{method:'PATCH',body:JSON.stringify(form)}));setNotice('Conditions mises à jour.')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <AppShell title="Conditions de vente"><section className="content"><div className="pageTitle"><div><h1>Conditions Coffria</h1><p className="muted">Modifiez la version présentée aux clients avant leur souscription.</p></div></div>{error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}<form className="settingsCard termsAdminForm" onSubmit={save}><label className="field">Titre<input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})} required/></label><label className="field">Version<input value={form.version||''} onChange={e=>setForm({...form,version:e.target.value})} required/></label><label className="field">Texte des conditions<textarea rows={32} value={form.content||''} onChange={e=>setForm({...form,content:e.target.value})} required/></label><button className="primary" disabled={busy}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer les conditions'}</button></form></section></AppShell>
}
