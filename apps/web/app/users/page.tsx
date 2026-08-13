'use client';
import { useEffect, useState } from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

const blank = { name: '', email: '', password: '', role: 'EDITOR', status: 'ACTIVE' };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);
  const load = async () => setUsers(await api('/users'));
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (!editing) delete payload.status;
      await api(editing ? `/users/${editing.id}` : '/users', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setShow(false); setEditing(null); setForm(blank); setNotice(editing ? 'Utilisateur modifié.' : 'Utilisateur créé.'); await load();
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

  return <AppShell title="Gestion des utilisateurs"><section className="content"><div className="pageTitle"><div><h1>Utilisateurs</h1><p className="muted">Gérez les accès de votre organisation.</p></div><button className="primary" onClick={()=>{setEditing(null);setForm(blank);setShow(true)}}><UserPlus size={17}/> Ajouter</button></div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
    <div className="card"><table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead><tbody>{users.map((u)=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><span className="status">{u.status}</span></td><td>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td><td><div className="rowActions"><button title="Modifier" onClick={()=>edit(u)}><Pencil size={17}/></button><button title="Supprimer" onClick={()=>remove(u)}><Trash2 size={17}/></button></div></td></tr>)}</tbody></table></div>
  </section>
  {show&&<div className="modalBackdrop"><form className="modal" onSubmit={submit}><h2>{editing?'Modifier l’utilisateur':'Nouvel utilisateur'}</h2><label className="field">Nom<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="field">Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required/></label><label className="field">{editing?'Nouveau mot de passe (facultatif)':'Mot de passe temporaire'}<input type="password" minLength={10} value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required={!editing}/></label><label className="field">Rôle<select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})}><option value="TENANT_ADMIN">Administrateur</option><option value="EDITOR">Modification</option><option value="VIEWER">Consultation</option></select></label>{editing&&<label className="field">Statut<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></select></label>}<div className="modalActions"><button type="button" className="secondary" onClick={()=>setShow(false)}>Annuler</button><button className="primary">{editing?'Enregistrer':'Créer'}</button></div></form></div>}
  </AppShell>;
}
