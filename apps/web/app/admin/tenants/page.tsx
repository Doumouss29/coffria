'use client';

import { Building2, FileSignature, HardDrive, Pencil, Plus, RefreshCw, Save, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

type StorageUnit = 'GB' | 'TB';

const emptyForm = { name: '', quotaValue: 100, quotaUnit: 'GB' as StorageUnit, maxUsers: 10, subscriptionExpiresAt: '', adminName: '', adminEmail: '', adminPassword: '', signatureEnabled: false, signatureUsageLimit: 0 };
const emptyAdmin = { name: '', email: '', password: '', status: 'ACTIVE' };

function quotaGb(value: any, unit: StorageUnit) {
  const amount = Math.max(1, Number(value || 0));
  return Math.round(unit === 'TB' ? amount * 1024 : amount);
}

function quotaParts(gb: any): { quotaValue: number; quotaUnit: StorageUnit } {
  const value = Math.max(1, Number(gb || 1));
  if (value >= 1024) return { quotaValue: Number((value / 1024).toFixed(2)), quotaUnit: 'TB' };
  return { quotaValue: value, quotaUnit: 'GB' };
}

function formatQuota(gb: any) {
  const value = Number(gb || 0);
  if (value >= 1024) {
    const tb = value / 1024;
    return `${Number.isInteger(tb) ? tb.toFixed(0) : tb.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} To`;
  }
  return `${value} Go`;
}

export default function TenantsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adminTenant, setAdminTenant] = useState<any>(null);
  const [adminForm, setAdminForm] = useState<any>(emptyAdmin);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);

  async function load() {
    const tenants = await api('/tenants');
    setItems(tenants.map((item: any) => ({ ...item, ...quotaParts(item.quotaGb) })));
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await api('/tenants', { method: 'POST', body: JSON.stringify({ name: form.name, quotaGb: quotaGb(form.quotaValue, form.quotaUnit), maxUsers: Number(form.maxUsers), subscriptionExpiresAt: form.subscriptionExpiresAt || undefined, adminName: form.adminName, adminEmail: form.adminEmail, adminPassword: form.adminPassword }) });
      await api(`/signature-subscription/admin/${created.id}`, { method: 'PATCH', body: JSON.stringify({ signatureEnabled: Boolean(form.signatureEnabled), signatureUsageLimit: Number(form.signatureUsageLimit || 0) }) });
      setShow(false); setForm(emptyForm); setNotice('Entreprise et options d’abonnement créées.'); await load();
    } catch (e: any) { setError(e.message); }
  }

  async function save(item: any) {
    try {
      await api(`/tenants/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name: item.name, quotaGb: quotaGb(item.quotaValue, item.quotaUnit), maxUsers: Number(item.maxUsers), subscriptionExpiresAt: item.subscriptionExpiresAt ? String(item.subscriptionExpiresAt).slice(0, 10) : '', active: Boolean(item.active) }) });
      await api(`/signature-subscription/admin/${item.id}`, { method: 'PATCH', body: JSON.stringify({ signatureEnabled: Boolean(item.signatureEnabled), signatureUsageLimit: Number(item.signatureUsageLimit || 0) }) });
      setNotice(`Entreprise « ${item.name} » mise à jour.`); await load();
    } catch (e: any) { setError(e.message); }
  }

  async function resetSignatureUsage(item: any) {
    if (!confirm(`Réinitialiser le compteur de signatures utilisées pour « ${item.name} » ?`)) return;
    try {
      await api(`/signature-subscription/admin/${item.id}/reset`, { method: 'POST' });
      setNotice(`Compteur Signature de « ${item.name} » réinitialisé.`); await load();
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
      const body: any = editingAdmin
        ? { name: adminForm.name, email: adminForm.email, password: adminForm.password, status: adminForm.status }
        : { name: adminForm.name, email: adminForm.email, password: adminForm.password };
      if (editingAdmin && !body.password) delete body.password;
      await api(editingAdmin ? `/tenants/${adminTenant.id}/admins/${editingAdmin.id}` : `/tenants/${adminTenant.id}/admins`, { method: editingAdmin ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      const all = await api('/tenants');
      setItems(all.map((item: any) => ({ ...item, ...quotaParts(item.quotaGb) })));
      const refreshed = all.find((x: any) => x.id === adminTenant.id);
      setAdminTenant(refreshed); setEditingAdmin(null); setAdminForm(emptyAdmin); setNotice(editingAdmin ? 'Administrateur modifié.' : 'Administrateur ajouté.');
    } catch (e: any) { setError(e.message); }
  }

  async function removeAdmin(admin: any) {
    if (!confirm(`Supprimer l’administrateur « ${admin.email} » ?`)) return;
    try {
      await api(`/tenants/${adminTenant.id}/admins/${admin.id}`, { method: 'DELETE' });
      const all = await api('/tenants');
      setItems(all.map((item: any) => ({ ...item, ...quotaParts(item.quotaGb) })));
      const refreshed = all.find((x: any) => x.id === adminTenant.id);
      setAdminTenant(refreshed); setNotice('Administrateur supprimé.');
    } catch (e: any) { setError(e.message); }
  }

  return <AppShell title="Administration commerciale">
    <section className="content">
      <div className="pageTitle"><div><h1>Entreprises clientes</h1><p className="muted">Définissez stockage, utilisateurs, durée d’abonnement et options commerciales.</p></div><button className="primary" onClick={() => setShow(true)}><Plus size={17}/> Nouvelle entreprise</button></div>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
      <div className="tenantGrid">
        {items.map((item, index) => <article className="card tenantCard" key={item.id}>
          <div className="tenantHeader"><div><Building2 size={22}/><strong>{item.name}</strong></div><label className="switchLabel"><input type="checkbox" checked={item.active} onChange={(e)=>patch(index,{active:e.target.checked})}/> Actif</label></div>
          <div className="formGrid">
            <label className="field">Entreprise<input value={item.name} onChange={(e)=>patch(index,{name:e.target.value})}/></label>
            <label className="field">Quota stockage<div className="storageQuotaField"><input type="number" min="1" step={item.quotaUnit === 'TB' ? '0.1' : '1'} value={item.quotaValue} onChange={(e)=>patch(index,{quotaValue:Number(e.target.value)})}/><select value={item.quotaUnit} onChange={(e)=>patch(index,{quotaUnit:e.target.value as StorageUnit})}><option value="GB">Go</option><option value="TB">To</option></select></div><small className="muted">Alloué : {formatQuota(quotaGb(item.quotaValue, item.quotaUnit))}</small></label>
            <label className="field">Nombre maximal d’utilisateurs<input type="number" min="1" value={item.maxUsers} onChange={(e)=>patch(index,{maxUsers:Number(e.target.value)})}/></label>
            <label className="field">Expiration abonnement<input type="date" value={item.subscriptionExpiresAt ? String(item.subscriptionExpiresAt).slice(0,10) : ''} onChange={(e)=>patch(index,{subscriptionExpiresAt:e.target.value})}/></label>
            <label className="field"><span>Module Signature</span><span className="switchLabel"><input type="checkbox" checked={Boolean(item.signatureEnabled)} onChange={(e)=>patch(index,{signatureEnabled:e.target.checked})}/> {item.signatureEnabled?'Activé':'Non inclus'}</span></label>
            <label className="field">Limite de demandes de signature <input type="number" min="0" value={item.signatureUsageLimit || 0} onChange={(e)=>patch(index,{signatureUsageLimit:Number(e.target.value)})}/><small className="muted">0 = illimité</small></label>
          </div>
          <div className="tenantMeta"><span><HardDrive size={15}/> Stockage : {formatQuota(quotaGb(item.quotaValue, item.quotaUnit))}</span><span><Users size={15}/> {item._count?.users || 0} / {item.maxUsers} utilisateurs</span><span>Documents : {item._count?.documents || 0}</span><span><FileSignature size={15}/> Signatures : {item.signatureUsageUsed || 0}{item.signatureUsageLimit ? ` / ${item.signatureUsageLimit}` : ' / illimité'}</span><span>Admins : {item.admins?.length || 0}</span></div>
          <div className="rowActions"><button className="secondary" onClick={()=>save(item)}><Save size={16}/> Enregistrer</button><button className="secondary" onClick={()=>resetSignatureUsage(item)}><RefreshCw size={16}/> Réinitialiser signatures</button><button className="secondary" onClick={()=>openAdmins(item)}><Users size={16}/> Administrateurs</button><button className="dangerButton" onClick={()=>removeTenant(item)}><Trash2 size={16}/> Supprimer</button></div>
        </article>)}
      </div>
    </section>

    {show && <div className="modalBackdrop"><form className="modal wide" onSubmit={create}><h2>Créer une entreprise cliente</h2><div className="formGrid"><label className="field">Nom de l’entreprise<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Quota initial<div className="storageQuotaField"><input type="number" min="1" step={form.quotaUnit === 'TB' ? '0.1' : '1'} value={form.quotaValue} onChange={(e)=>setForm({...form,quotaValue:Number(e.target.value)})} required/><select value={form.quotaUnit} onChange={(e)=>setForm({...form,quotaUnit:e.target.value as StorageUnit})}><option value="GB">Go</option><option value="TB">To</option></select></div><small className="muted">Ex. 500 Go, 1 To, 2 To…</small></label><label className="field">Utilisateurs maximum<input type="number" min="1" value={form.maxUsers} onChange={(e)=>setForm({...form,maxUsers:Number(e.target.value)})} required/></label><label className="field">Expiration abonnement<input type="date" value={form.subscriptionExpiresAt} onChange={(e)=>setForm({...form,subscriptionExpiresAt:e.target.value})}/></label><label className="field"><span>Module Signature</span><span className="switchLabel"><input type="checkbox" checked={form.signatureEnabled} onChange={(e)=>setForm({...form,signatureEnabled:e.target.checked})}/> Inclure dans l’abonnement</span></label><label className="field">Limite de demandes de signature<input type="number" min="0" value={form.signatureUsageLimit} onChange={(e)=>setForm({...form,signatureUsageLimit:Number(e.target.value)})}/><small className="muted">0 = illimité</small></label><label className="field">Nom de l’administrateur<input value={form.adminName} onChange={(e)=>setForm({...form,adminName:e.target.value})} required/></label><label className="field">Email administrateur<input type="email" value={form.adminEmail} onChange={(e)=>setForm({...form,adminEmail:e.target.value})} required/></label><label className="field">Mot de passe temporaire<input type="password" minLength={10} value={form.adminPassword} onChange={(e)=>setForm({...form,adminPassword:e.target.value})} required/></label></div><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">Créer le client</button></div></form></div>}

    {adminTenant && <div className="modalBackdrop"><div className="modal wide"><h2>Administrateurs — {adminTenant.name}</h2><div className="card"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{(adminTenant.admins || []).map((admin:any)=><tr key={admin.id}><td>{admin.name}</td><td>{admin.email}</td><td>{admin.status}</td><td><div className="rowActions"><button onClick={()=>editAdmin(admin)}><Pencil size={16}/></button><button onClick={()=>removeAdmin(admin)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><form onSubmit={saveAdmin}><h3>{editingAdmin?'Modifier un administrateur':'Ajouter un administrateur'}</h3><div className="formGrid"><label className="field">Nom<input required value={adminForm.name} onChange={(e)=>setAdminForm({...adminForm,name:e.target.value})}/></label><label className="field">Email<input required type="email" value={adminForm.email} onChange={(e)=>setAdminForm({...adminForm,email:e.target.value})}/></label><label className="field">{editingAdmin?'Nouveau mot de passe (facultatif)':'Mot de passe temporaire'}<input type="password" required={!editingAdmin} minLength={10} value={adminForm.password} onChange={(e)=>setAdminForm({...adminForm,password:e.target.value})}/></label>{editingAdmin&&<label className="field">Statut<select value={adminForm.status} onChange={(e)=>setAdminForm({...adminForm,status:e.target.value})}><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></label>}</div><div className="modalActions"><button type="button" className="secondary" onClick={()=>{setAdminTenant(null);setEditingAdmin(null)}}>Fermer</button><button className="primary"><UserPlus size={16}/> {editingAdmin?'Enregistrer':'Ajouter'}</button></div></form></div></div>}
  </AppShell>;
}
