'use client';
import { useEffect, useState } from 'react';
import { HardDrive, Pencil, Save, Trash2, UserPlus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

const blank = { name: '', email: '', password: '', role: 'EDITOR', status: 'ACTIVE' };
type StorageUnit = 'GB' | 'TB';
type QuotaInput = { value: number; unit: StorageUnit };

function size(value:any){let n=Number(value||0);for(const unit of ['o','Ko','Mo','Go','To']){if(n<1024)return `${n.toFixed(n<10&&unit!=='o'?1:0)} ${unit}`;n/=1024;}return `${n.toFixed(1)} Po`;}
function bytesToInput(bytes:any):QuotaInput{const gb=Number(bytes||0)/1073741824;if(gb>=1024)return{value:Number((gb/1024).toFixed(2)),unit:'TB'};return{value:Number(gb.toFixed(2)),unit:'GB'};}
function inputToGb(input:QuotaInput){return Math.round(Math.max(0,Number(input.value||0))*(input.unit==='TB'?1024:1));}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [allocation, setAllocation] = useState<any>(null);
  const [companyQuota, setCompanyQuota] = useState<QuotaInput>({value:0,unit:'GB'});
  const [userQuotas, setUserQuotas] = useState<Record<string,QuotaInput>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);

  async function load(){
    const [userRows, storage] = await Promise.all([api('/users'), api('/storage-allocation')]);
    setUsers(userRows); setAllocation(storage); setCompanyQuota(bytesToInput(storage.company.quotaBytes));
    const quotas:Record<string,QuotaInput>={}; for(const row of storage.users||[]) quotas[row.id]=bytesToInput(row.quotaBytes); setUserQuotas(quotas);
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (!editing) delete payload.status;
      await api(editing ? `/users/${editing.id}` : '/users', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setShow(false); setEditing(null); setForm(blank); setNotice(editing ? 'Utilisateur modifié.' : 'Utilisateur créé. Vous pouvez maintenant lui allouer un espace personnel.'); await load();
    } catch (e: any) { setError(e.message); }
  }

  function edit(user: any) {
    setEditing(user); setForm({ name: user.name, email: user.email, password: '', role: user.role, status: user.status }); setShow(true);
  }

  async function remove(user: any) {
    if (!confirm(`Supprimer définitivement l’utilisateur « ${user.email} » ?`)) return;
    try { await api(`/users/${user.id}`, { method: 'DELETE' }); setNotice('Utilisateur supprimé.'); await load(); }
    catch (e: any) { setError(e.message); }
  }

  async function saveCompanyQuota(){
    try{await api('/storage-allocation/company',{method:'PATCH',body:JSON.stringify({quotaGb:inputToGb(companyQuota)})});setNotice('Volume de l’espace entreprise mis à jour.');await load();}
    catch(e:any){setError(e.message)}
  }
  async function saveUserQuota(userId:string){
    try{const input=userQuotas[userId]||{value:0,unit:'GB'};await api(`/storage-allocation/users/${userId}`,{method:'PATCH',body:JSON.stringify({quotaGb:inputToGb(input)})});setNotice('Volume personnel mis à jour.');await load();}
    catch(e:any){setError(e.message)}
  }

  const storageUsers=new Map((allocation?.users||[]).map((u:any)=>[u.id,u]));
  return <AppShell title="Gestion des utilisateurs"><section className="content"><div className="pageTitle"><div><h1>Utilisateurs</h1><p className="muted">Gérez les accès et répartissez le stockage payé par votre organisation.</p></div><button className="primary" onClick={()=>{setEditing(null);setForm(blank);setShow(true)}}><UserPlus size={17}/> Ajouter</button></div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
    {allocation&&<div className="card" style={{marginBottom:18}}><div className="pageTitle"><div><h2 style={{margin:0}}>Répartition du stockage</h2><p className="muted">Le volume entreprise et les espaces personnels sont prélevés sur le quota total de votre abonnement.</p></div><HardDrive size={24}/></div><div className="tenantMeta"><span>Total payé : <strong>{size(allocation.totalBytes)}</strong></span><span>Alloué : <strong>{size(allocation.allocatedBytes)}</strong></span><span>Encore disponible : <strong>{size(allocation.unallocatedBytes)}</strong></span></div><div className="formGrid" style={{marginTop:16}}><label className="field">Espace entreprise<div className="storageQuotaField"><input type="number" min="0" step={companyQuota.unit==='TB'?'0.1':'1'} value={companyQuota.value} onChange={e=>setCompanyQuota({...companyQuota,value:Number(e.target.value)})}/><select value={companyQuota.unit} onChange={e=>setCompanyQuota({...companyQuota,unit:e.target.value as StorageUnit})}><option value="GB">Go</option><option value="TB">To</option></select></div><small className="muted">Consommé : {size(allocation.company.usedBytes)}</small></label><div className="field" style={{justifyContent:'flex-end'}}><button className="secondary" type="button" onClick={saveCompanyQuota}><Save size={16}/> Enregistrer le volume entreprise</button></div></div></div>}
    <div className="card"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Espace personnel</th><th>Consommé</th><th>Actions</th></tr></thead><tbody>{users.map((u)=>{const storage:any=storageUsers.get(u.id);const quota=userQuotas[u.id]||{value:0,unit:'GB'};return <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><span className="status">{u.status}</span></td><td><div className="storageQuotaField" style={{minWidth:180}}><input type="number" min="0" step={quota.unit==='TB'?'0.1':'1'} value={quota.value} onChange={e=>setUserQuotas({...userQuotas,[u.id]:{...quota,value:Number(e.target.value)}})}/><select value={quota.unit} onChange={e=>setUserQuotas({...userQuotas,[u.id]:{...quota,unit:e.target.value as StorageUnit}})}><option value="GB">Go</option><option value="TB">To</option></select><button title="Enregistrer le quota" onClick={()=>saveUserQuota(u.id)}><Save size={16}/></button></div></td><td>{size(storage?.usedBytes||0)}</td><td><div className="rowActions"><button title="Modifier" onClick={()=>edit(u)}><Pencil size={17}/></button><button title="Supprimer" onClick={()=>remove(u)}><Trash2 size={17}/></button></div></td></tr>})}</tbody></table></div>
  </section>
  {show&&<div className="modalBackdrop"><form className="modal" onSubmit={submit}><h2>{editing?'Modifier l’utilisateur':'Nouvel utilisateur'}</h2><label className="field">Nom<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required/></label><label className="field">{editing?'Nouveau mot de passe (facultatif)':'Mot de passe temporaire'}<input type="password" minLength={10} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required={!editing}/></label><label className="field">Rôle<select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}><option value="TENANT_ADMIN">Administrateur</option><option value="EDITOR">Modification</option><option value="VIEWER">Consultation</option></select></label>{editing&&<label className="field">Statut<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></label>}<div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">{editing?'Enregistrer':'Créer'}</button></div></form></div>}
  </AppShell>;
}
