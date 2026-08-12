'use client';

import { Building2, Pencil, Plus, Save, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

const emptyForm = { name: '', quotaGb: 100, maxUsers: 10, subscriptionExpiresAt: '', adminName: '', adminEmail: '', adminPassword: '' };
const emptyAdmin = { name: '', email: '', password: '', status: 'ACTIVE' };

export default function TenantsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adminTenant, setAdminTenant] = useState<any>(null);
  const [adminForm, setAdminForm] = useState<any>(emptyAdmin);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);

  async function load() { setItems(await api('/tenants')); }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api('/tenants', { method: 'POST', body: JSON.stringify({ ...form, quotaGb: Number(form.quotaGb), maxUsers: Number(form.maxUsers), subscriptionExpiresAt: form.subscriptionExpiresAt || undefined }) });
      setShow(false); setForm(emptyForm); setNotice('Entreprise et administrateur client créés.'); await load();
    } catch (e: any) { setError(e.message); }
  }

  async function save(item: any) {
    try {
      await api(`/tenants/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: item.name, quotaGb: Number(item.quotaGb), maxUsers: Number(item.maxUsers), subscriptionExpiresAt: item.subscriptionExpiresAt ? String(item.subscriptionExpiresAt).slice(0, 10) : '', active: Boolean(item.active) }) });
      setNotice(`Entreprise « ${item.name} » mise à jour.`); await load();
    } catch (e: any) { setError(e.message); }
  }

  async function removeTenant(item: any) {
    if (!confirm(`SUPPRESSION DÉFINITIVE : supprimer « ${item.name} », tous ses utilisateurs, dossiers, documents et fichiers stockés ?`)) return;
    if (!confirm('Cette action est irréversible. Confirmer une seconde fois ?')) return;
    try { const result = await api(`/tenants/${item.id}`, { method: 'DELETE' }); setNotice(result.message); await load(); }
    catch (e: any) { setError(e.message); }
  }

  function patch(index: number, values: any) { setItems((current) => current.map((item, i) => i === index ? { ...item, ...values } : item)); }

  function openAdmins(item: any) { setAdminTenant(item); setEditingAdmin(null); setAdminForm(emptyAdmin); }
  function editAdmin(admin: any) { setEditingAdmin(admin); setAdminForm({ name: admin.name, email: admin.email, password: '', status: admin.status }); }

  async function saveAdmin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const body: any = { ...adminForm };
      if (editingAdmin && !body.password) delete body.password;
      await api(editingAdmin ? `/tenants/${adminTenant.id}/admins/${editingAdmin.id}` : `/tenants/${adminTenant.id}/admins`, { method: editingAdmin ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      await load();
      const refreshed = (await api('/tenants')).find((x: any) => x.id === adminTenant.id);
      setAdminTenant(refreshed); setEditingAdmin(null); setAdminForm(emptyAdmin); setNotice(editingAdmin ? 'Administrateur modifié.' : 'Administrateur ajouté.');
    } catch (e: any) { setError(e.message); }
  }

  async function removeAdmin(admin: any) {
    if (!confirm(`Supprimer l’administrateur « ${admin.email} » ?`)) return;
    try {
      await api(`/tenants/${adminTenant.id}/admins/${admin.id}`, { method: 'DELETE' });
      const refreshed = (await api('/tenants')).find((x: any) => x.id === adminTenant.id);
      setAdminTenant(refreshed); await load(); setNotice('Administrateur supprimé.');
    } catch (e: any) { setError(e.message); }
  }

  return <AppShell title="Administration commerciale">
    <section className="content">
      <div className="pageTitle"><div><h1>Entreprises clientes</h1><p className="muted">Créez les espaces clients, définissez les quotas, les utilisateurs et l’échéance d’abonnement.</p></div><button className="primary" onClick={() => setShow(true)}><Plus size={17}/> Nouvelle entreprise</button></div>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
      <div className="tenantGrid">
        {items.map((item, index) => <article className="card tenantCard" key={item.id}>
          <div className="tenantHeader"><div><Building2 size={22}/><strong>{item.name}</strong></div><label className="switchLabel"><input type="checkbox" checked={item.active} onChange={(e)=>patch(index,{active:e.target.checked})}/> Actif</label></div>
          <div className="formGrid">
            <label className="field">Entreprise<input value={item.name} onChange={(e)=>patch(index,{name:e.target.value})}/></label>
            <label className="field">Quota stockage (Go)<input type="number" min="1" value={item.quotaGb} onChange={(e)=>patch(index,{quotaGb:Number(e.target.value)})}/></label>
            <label className="field">Nombre maximal d’utilisateurs<input type="number" min="1" value={item.maxUsers} onChange={(e)=>patch(index,{maxUsers:Number(e.target.value)})}/></label>
            <label className="field">Expiration abonnement<input type="date" value={item.subscriptionExpiresAt ? String(item.subscriptionExpiresAt).slice(0,10) : ''} onChange={(e)=>patch(index,{subscriptionExpiresAt:e.target.value})}/></label>
          </div>
          <div className="tenantMeta"><span><Users size={15}/> {item._count?.users || 0} / {item.maxUsers} utilisateurs</span><span>Documents : {item._count?.documents || 0}</span><span>Admins : {item.admins?.length || 0}</span></div>
          <div className="rowActions"><button className="secondary" onClick={()=>save(item)}><Save size={16}/> Enregistrer</button><button className="secondary" onClick={()=>openAdmins(item)}><Users size={16}/> Administrateurs</button><button className="dangerButton" onClick={()=>removeTenant(item)}><Trash2 size={16}/> Supprimer</button></div>
        </article>)}
      </div>
    </section>

    {show && <div className="modalBackdrop"><form className="modal wide" onSubmit={create}><h2>Créer une entreprise cliente</h2><div className="formGrid"><label className="field">Nom de l’entreprise<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Quota initial (Go)<input type="number" min="1" value={form.quotaGb} onChange={(e)=>setForm({...form,quotaGb:Number(e.target.value)})} required/></label><label className="field">Utilisateurs maximum<input type="number" min="1" value={form.maxUsers} onChange={(e)=>setForm({...form,maxUsers:Number(e.target.value)})} required/></label><label className="field">Expiration abonnement<input type="date" value={form.subscriptionExpiresAt} onChange={(e)=>setForm({...form,subscriptionExpiresAt:e.target.value})}/></label><label className="field">Nom de l’administrateur<input value={form.adminName} onChange={(e)=>setForm({...form,adminName:e.target.value})} required/></label><label className="field">Email administrateur<input type="email" value={form.adminEmail} onChange={(e)=>setForm({...form,adminEmail:e.target.value})} required/></label><label className="field">Mot de passe temporaire<input type="password" minLength={10} value={form.adminPassword} onChange={(e)=>setForm({...form,adminPassword:e.target.value})} required/></label></div><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">Créer le client</button></div></form></div>}

    {adminTenant && <div className="modalBackdrop"><div className="modal wide"><h2>Administrateurs — {adminTenant.name}</h2><div className="card"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{(adminTenant.admins || []).map((admin:any)=><tr key={admin.id}><td>{admin.name}</td><td>{admin.email}</td><td>{admin.status}</td><td><div className="rowActions"><button onClick={()=>editAdmin(admin)}><Pencil size={16}/></button><button onClick={()=>removeAdmin(admin)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><form onSubmit={saveAdmin}><h3>{editingAdmin?'Modifier un administrateur':'Ajouter un administrateur'}</h3><div className="formGrid"><label className="field">Nom<input required value={adminForm.name} onChange={(e)=>setAdminForm({...adminForm,name:e.target.value})}/></label><label className="field">Email<input required type="email" value={adminForm.email} onChange={(e)=>setAdminForm({...adminForm,email:e.target.value})}/></label><label className="field">{editingAdmin?'Nouveau mot de passe (facultatif)':'Mot de passe temporaire'}<input type="password" required={!editingAdmin} minLength={10} value={adminForm.password} onChange={(e)=>setAdminForm({...adminForm,password:e.target.value})}/></label>{editingAdmin&&<label className="field">Statut<select value={adminForm.status} onChange={(e)=>setAdminForm({...adminForm,status:e.target.value})}><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></label>}</div><div className="modalActions"><button type="button" className="secondary" onClick={()=>{setAdminTenant(null);setEditingAdmin(null)}}>Fermer</button><button className="primary"><UserPlus size={16}/> {editingAdmin?'Enregistrer':'Ajouter'}</button></div></form></div></div>}
  </AppShell>;
}
