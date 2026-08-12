'use client';

import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../../../components/AppShell';
import { api } from '../../../lib/api';

export default function SuperAdminsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const load = async () => setItems(await api('/superadmins'));
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/superadmins', { method: 'POST', body: JSON.stringify(form) });
      setShow(false); setForm({ name: '', email: '', password: '' }); setNotice('Super Admin créé.'); await load();
    } catch (e: any) { setError(e.message); }
  }

  async function remove(item: any) {
    if (!confirm(`Supprimer définitivement le Super Admin « ${item.email} » ?`)) return;
    try { await api(`/superadmins/${item.id}`, { method: 'DELETE' }); setNotice('Super Admin supprimé.'); await load(); }
    catch (e: any) { setError(e.message); }
  }

  return <AppShell title="Administration commerciale">
    <section className="content">
      <div className="pageTitle"><div><h1>Super Admins</h1><p className="muted">Gérez les comptes autorisés à administrer commercialement Coffria.</p></div><button className="primary" onClick={() => setShow(true)}><UserPlus size={17}/> Ajouter</button></div>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}
      <div className="card"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.id}><td><ShieldCheck size={16}/> {item.name}</td><td>{item.email}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</td><td><button title="Supprimer" onClick={() => remove(item)}><Trash2 size={17}/></button></td></tr>)}
      </tbody></table></div>
    </section>
    {show && <div className="modalBackdrop"><form className="modal" onSubmit={create}><h2>Nouveau Super Admin</h2><label className="field">Nom<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label className="field">Email<input required type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label><label className="field">Mot de passe temporaire<input required type="password" minLength={10} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})}/></label><div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">Créer</button></div></form></div>}
  </AppShell>;
}
