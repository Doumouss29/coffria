'use client';

import { Building2, FileSignature, HardDrive, Palette, Pencil, Plus, RefreshCw, Save, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

type StorageUnit = 'GB' | 'TB';
type BrandingMode = 'COFFRIA' | 'CUSTOM';
type BrandingAssetKind = 'logo' | 'favicon';

const emptyForm = { name: '', quotaValue: 100, quotaUnit: 'GB' as StorageUnit, maxUsers: 10, subscriptionExpiresAt: '', adminName: '', adminEmail: '', adminPassword: '', signatureEnabled: false, signatureUsageLimit: 0, brandingMode: 'COFFRIA' as BrandingMode };
const emptyAdmin = { name: '', email: '', password: '', status: 'ACTIVE' };
const defaultBranding = {
  isEnabled: false,
  appName: 'Coffria',
  customDomain: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#14213D',
  accentColor: '#C97A3D',
  backgroundColor: '#F5F1EA',
  loginTitle: 'Votre patrimoine documentaire, sécurisé et maîtrisé',
  loginSubtitle: '',
  poweredByCoffria: true,
};

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
  const [brandingTenant, setBrandingTenant] = useState<any>(null);
  const [brandingForm, setBrandingForm] = useState<any>(defaultBranding);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const [assetUploading, setAssetUploading] = useState<BrandingAssetKind | null>(null);

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
      if (form.brandingMode === 'CUSTOM') {
        await api(`/tenant-branding/${created.id}`, { method: 'PATCH', body: JSON.stringify({ isEnabled: true, appName: form.name.trim() || 'Coffria', poweredByCoffria: true }) });
      }
      setShow(false);
      setForm(emptyForm);
      await load();
      if (form.brandingMode === 'CUSTOM') {
        setNotice('Entreprise créée en marque personnalisée. Complétez maintenant son identité visuelle.');
        await openBranding({ id: created.id, name: form.name });
      } else {
        setNotice('Entreprise créée avec l’identité Coffria par défaut.');
      }
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

  async function openBranding(item: any) {
    setBrandingTenant(item); setBrandingLoading(true); setError('');
    try {
      const value = await api(`/tenant-branding/${item.id}`);
      setBrandingForm({
        isEnabled: Boolean(value.isEnabled),
        appName: value.appName || 'Coffria',
        customDomain: value.customDomain || '',
        logoUrl: value.logoUrl || '',
        faviconUrl: value.faviconUrl || '',
        primaryColor: value.primaryColor || '#14213D',
        accentColor: value.accentColor || '#C97A3D',
        backgroundColor: value.backgroundColor || '#F5F1EA',
        loginTitle: value.loginTitle || 'Votre patrimoine documentaire, sécurisé et maîtrisé',
        loginSubtitle: value.loginSubtitle || '',
        poweredByCoffria: value.poweredByCoffria !== false,
      });
    } catch (e: any) { setError(e.message); setBrandingTenant(null); }
    finally { setBrandingLoading(false); }
  }

  async function uploadBrandingAsset(kind: BrandingAssetKind, file?: File | null) {
    if (!brandingTenant || !file) return;
    const allowed = kind === 'favicon'
      ? ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']
      : ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(kind === 'favicon' ? 'Le favicon doit être au format PNG ou ICO.' : 'Le logo doit être au format PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier doit faire moins de 5 Mo.');
      return;
    }
    setAssetUploading(kind); setError('');
    try {
      const prepared = await api(`/tenant-branding/${brandingTenant.id}/asset-upload`, {
        method: 'POST',
        body: JSON.stringify({ kind, mime: file.type, size: file.size }),
      });
      const upload = await fetch(prepared.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!upload.ok) throw new Error(`Échec de l’import du fichier (${upload.status})`);
      setBrandingForm((current: any) => ({ ...current, [kind === 'logo' ? 'logoUrl' : 'faviconUrl']: prepared.assetUrl }));
      setNotice(`${kind === 'logo' ? 'Logo' : 'Favicon'} importé. Cliquez sur « Enregistrer » pour appliquer la personnalisation.`);
    } catch (e: any) { setError(e.message || 'Impossible d’importer le fichier.'); }
    finally { setAssetUploading(null); }
  }

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault(); if (!brandingTenant) return; setBrandingLoading(true); setError('');
    try {
      await api(`/tenant-branding/${brandingTenant.id}`, { method: 'PATCH', body: JSON.stringify(brandingForm) });
      setNotice(`Personnalisation de « ${brandingTenant.name} » enregistrée. Coffria reste l’identité par défaut tant que la marque blanche n’est pas activée.`);
      setBrandingTenant(null);
    } catch (e: any) { setError(e.message); }
    finally { setBrandingLoading(false); }
  }

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
      <div className="pageTitle"><div><h1>Entreprises clientes</h1><p className="muted">Définissez stockage, utilisateurs, durée d’abonnement, options commerciales et identité visuelle.</p></div><button className="primary" onClick={() => setShow(true)}><Plus size={17}/> Nouvelle entreprise</button></div>
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
          <div className="rowActions"><button className="secondary" onClick={()=>save(item)}><Save size={16}/> Enregistrer</button><button className="secondary" onClick={()=>openBranding(item)}><Palette size={16}/> Personnalisation</button><button className="secondary" onClick={()=>resetSignatureUsage(item)}><RefreshCw size={16}/> Réinitialiser signatures</button><button className="secondary" onClick={()=>openAdmins(item)}><Users size={16}/> Administrateurs</button><button className="dangerButton" onClick={()=>removeTenant(item)}><Trash2 size={16}/> Supprimer</button></div>
        </article>)}
      </div>
    </section>

    {show && <div className="modalBackdrop"><form className="modal wide responsiveFormModal" onSubmit={create}><h2>Créer une entreprise cliente</h2><div className="brandingModeChoice"><label className={form.brandingMode === 'COFFRIA' ? 'brandingModeCard selected' : 'brandingModeCard'}><input type="radio" name="brandingMode" checked={form.brandingMode === 'COFFRIA'} onChange={()=>setForm({...form,brandingMode:'COFFRIA'})}/><span><strong>Coffria</strong><small>Identité et couleurs Coffria par défaut.</small></span></label><label className={form.brandingMode === 'CUSTOM' ? 'brandingModeCard selected' : 'brandingModeCard'}><input type="radio" name="brandingMode" checked={form.brandingMode === 'CUSTOM'} onChange={()=>setForm({...form,brandingMode:'CUSTOM'})}/><span><strong>Marque personnalisée</strong><small>Interface adaptée au nom, logo et couleurs du client.</small></span></label></div><div className="formGrid formGridScrollable"><label className="field">Nom de l’entreprise<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Quota initial<div className="storageQuotaField"><input type="number" min="1" step={form.quotaUnit === 'TB' ? '0.1' : '1'} value={form.quotaValue} onChange={(e)=>setForm({...form,quotaValue:Number(e.target.value)})} required/><select value={form.quotaUnit} onChange={(e)=>setForm({...form,quotaUnit:e.target.value as StorageUnit})}><option value="GB">Go</option><option value="TB">To</option></select></div><small className="muted">Ex. 500 Go, 1 To, 2 To…</small></label><label className="field">Utilisateurs maximum<input type="number" min="1" value={form.maxUsers} onChange={(e)=>setForm({...form,maxUsers:Number(e.target.value)})} required/></label><label className="field">Expiration abonnement<input type="date" value={form.subscriptionExpiresAt} onChange={(e)=>setForm({...form,subscriptionExpiresAt:e.target.value})}/></label><label className="field"><span>Module Signature</span><span className="switchLabel"><input type="checkbox" checked={form.signatureEnabled} onChange={(e)=>setForm({...form,signatureEnabled:e.target.checked})}/> Inclure dans l’abonnement</span></label><label className="field">Limite de demandes de signature<input type="number" min="0" value={form.signatureUsageLimit} onChange={(e)=>setForm({...form,signatureUsageLimit:Number(e.target.value)})}/><small className="muted">0 = illimité</small></label><label className="field">Nom de l’administrateur<input value={form.adminName} onChange={(e)=>setForm({...form,adminName:e.target.value})} required/></label><label className="field">Email administrateur<input type="email" value={form.adminEmail} onChange={(e)=>setForm({...form,adminEmail:e.target.value})} required/></label><label className="field">Mot de passe temporaire<input type="password" minLength={10} value={form.adminPassword} onChange={(e)=>setForm({...form,adminPassword:e.target.value})} required/></label></div><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">Créer le client</button></div></form></div>}

    {brandingTenant && <div className="modalBackdrop"><form className="modal wide responsiveFormModal" onSubmit={saveBranding}><h2>Personnalisation — {brandingTenant.name}</h2><p className="muted">Coffria reste l’identité par défaut. Activez la marque blanche uniquement lorsque la configuration du client est prête.</p><div className="formGrid formGridScrollable"><label className="field"><span>Marque blanche</span><span className="switchLabel"><input type="checkbox" checked={Boolean(brandingForm.isEnabled)} onChange={(e)=>setBrandingForm({...brandingForm,isEnabled:e.target.checked})}/> {brandingForm.isEnabled?'Activée':'Coffria par défaut'}</span></label><label className="field">Nom de l’application<input maxLength={80} value={brandingForm.appName} onChange={(e)=>setBrandingForm({...brandingForm,appName:e.target.value})} placeholder="Coffria"/></label><label className="field">Domaine personnalisé<input value={brandingForm.customDomain} onChange={(e)=>setBrandingForm({...brandingForm,customDomain:e.target.value})} placeholder="archives.client.com"/><small className="muted">Sans https://. Le DNS sera raccordé dans une étape ultérieure.</small></label><div className="field"><span>Logo</span><input value={brandingForm.logoUrl} onChange={(e)=>setBrandingForm({...brandingForm,logoUrl:e.target.value})} placeholder="https://…/logo.png"/><div className="brandingAssetActions"><span className="muted">URL directe ou import local (PNG, JPG, WebP · 5 Mo max)</span><label className="secondary brandingFileButton"><Upload size={15}/> {assetUploading === 'logo' ? 'Import…' : 'Importer un logo'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={assetUploading !== null} onChange={(e)=>{uploadBrandingAsset('logo',e.target.files?.[0]);e.currentTarget.value='';}}/></label></div>{brandingForm.logoUrl && <div className="brandingAssetPreview"><img src={brandingForm.logoUrl} alt="Aperçu du logo" onError={(e)=>{e.currentTarget.style.display='none';}}/></div>}</div><div className="field"><span>Favicon</span><input value={brandingForm.faviconUrl} onChange={(e)=>setBrandingForm({...brandingForm,faviconUrl:e.target.value})} placeholder="https://…/favicon.ico"/><div className="brandingAssetActions"><span className="muted">URL directe ou import local (PNG, ICO · 5 Mo max)</span><label className="secondary brandingFileButton"><Upload size={15}/> {assetUploading === 'favicon' ? 'Import…' : 'Importer un favicon'}<input type="file" accept="image/png,image/x-icon,.ico" disabled={assetUploading !== null} onChange={(e)=>{uploadBrandingAsset('favicon',e.target.files?.[0]);e.currentTarget.value='';}}/></label></div>{brandingForm.faviconUrl && <div className="brandingAssetPreview faviconPreview"><img src={brandingForm.faviconUrl} alt="Aperçu du favicon" onError={(e)=>{e.currentTarget.style.display='none';}}/></div>}</div><label className="field">Couleur principale<div className="storageQuotaField"><input type="color" value={brandingForm.primaryColor} onChange={(e)=>setBrandingForm({...brandingForm,primaryColor:e.target.value.toUpperCase()})}/><input value={brandingForm.primaryColor} onChange={(e)=>setBrandingForm({...brandingForm,primaryColor:e.target.value})}/></div></label><label className="field">Couleur d’accent<div className="storageQuotaField"><input type="color" value={brandingForm.accentColor} onChange={(e)=>setBrandingForm({...brandingForm,accentColor:e.target.value.toUpperCase()})}/><input value={brandingForm.accentColor} onChange={(e)=>setBrandingForm({...brandingForm,accentColor:e.target.value})}/></div></label><label className="field">Couleur de fond<div className="storageQuotaField"><input type="color" value={brandingForm.backgroundColor} onChange={(e)=>setBrandingForm({...brandingForm,backgroundColor:e.target.value.toUpperCase()})}/><input value={brandingForm.backgroundColor} onChange={(e)=>setBrandingForm({...brandingForm,backgroundColor:e.target.value})}/></div></label><label className="field">Titre de connexion<input maxLength={140} value={brandingForm.loginTitle} onChange={(e)=>setBrandingForm({...brandingForm,loginTitle:e.target.value})}/></label><label className="field">Sous-titre de connexion<textarea maxLength={300} value={brandingForm.loginSubtitle} onChange={(e)=>setBrandingForm({...brandingForm,loginSubtitle:e.target.value})}/></label><label className="field"><span>Signature Coffria</span><span className="switchLabel"><input type="checkbox" checked={Boolean(brandingForm.poweredByCoffria)} onChange={(e)=>setBrandingForm({...brandingForm,poweredByCoffria:e.target.checked})}/> Afficher « Propulsé par Coffria »</span></label></div><div className="card" style={{marginTop:12}}><strong>Aperçu des couleurs</strong><div style={{display:'flex',gap:8,marginTop:10}}><span style={{height:34,flex:1,borderRadius:8,background:brandingForm.primaryColor}}/><span style={{height:34,flex:1,borderRadius:8,background:brandingForm.accentColor}}/><span style={{height:34,flex:1,borderRadius:8,background:brandingForm.backgroundColor,border:'1px solid #ddd'}}/></div></div><div className="modalActions"><button type="button" className="secondary" onClick={()=>setBrandingTenant(null)}>Annuler</button><button className="primary" disabled={brandingLoading || assetUploading !== null}><Save size={16}/> {brandingLoading?'Enregistrement…':'Enregistrer'}</button></div></form></div>}

    {adminTenant && <div className="modalBackdrop"><div className="modal wide responsiveFormModal"><h2>Administrateurs — {adminTenant.name}</h2><div className="card horizontalScroll"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{(adminTenant.admins || []).map((admin:any)=><tr key={admin.id}><td>{admin.name}</td><td>{admin.email}</td><td>{admin.status}</td><td><div className="rowActions"><button onClick={()=>editAdmin(admin)}><Pencil size={16}/></button><button onClick={()=>removeAdmin(admin)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div><form onSubmit={saveAdmin}><h3>{editingAdmin?'Modifier un administrateur':'Ajouter un administrateur'}</h3><div className="formGrid formGridScrollable"><label className="field">Nom<input required value={adminForm.name} onChange={(e)=>setAdminForm({...adminForm,name:e.target.value})}/></label><label className="field">Email<input required type="email" value={adminForm.email} onChange={(e)=>setAdminForm({...adminForm,email:e.target.value})}/></label><label className="field">{editingAdmin?'Nouveau mot de passe (facultatif)':'Mot de passe temporaire'}<input type="password" required={!editingAdmin} minLength={10} value={adminForm.password} onChange={(e)=>setAdminForm({...adminForm,password:e.target.value})}/></label>{editingAdmin&&<label className="field">Statut<select value={adminForm.status} onChange={(e)=>setAdminForm({...adminForm,status:e.target.value})}><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></label>}</div><div className="modalActions"><button type="button" className="secondary" onClick={()=>{setAdminTenant(null);setEditingAdmin(null)}}>Fermer</button><button className="primary"><UserPlus size={16}/> {editingAdmin?'Enregistrer':'Ajouter'}</button></div></form></div></div>}
  </AppShell>;
}
