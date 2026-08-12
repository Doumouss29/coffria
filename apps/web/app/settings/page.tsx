'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('coffria_user');
    if (raw) setUser(JSON.parse(raw));
    api('/settings').then((d) => { setData(d); setName(d.name); }).catch(() => undefined);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try { const d = await api('/settings', { method: 'PATCH', body: JSON.stringify({ name }) }); setData(d); setMessage('Paramètres enregistrés.'); setError(''); }
    catch (e: any) { setError(e.message); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirm) { setError('Les nouveaux mots de passe ne correspondent pas.'); return; }
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); setMessage('Mot de passe modifié.'); setError('');
    } catch (e: any) { setError(e.message); }
  }

  return <AppShell title="Paramètres"><section className="content"><h1>Mon compte et paramètres</h1>{message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}
    {data && user?.role === 'TENANT_ADMIN' && <form className="settingsCard" onSubmit={save}><h2>Organisation</h2><label className="field">Nom commercial<input value={name} onChange={e=>setName(e.target.value)} required/></label><div className="infoGrid"><div><span>Identifiant</span><b>{data.slug}</b></div><div><span>Utilisateurs maximum</span><b>{data.maxUsers}</b></div><div><span>Statut</span><b>{data.active?'Actif':'Suspendu'}</b></div></div><button className="primary">Enregistrer</button></form>}
    <form className="settingsCard" onSubmit={changePassword}><h2>Modifier mon mot de passe</h2><label className="field">Mot de passe actuel<input type="password" required value={passwords.currentPassword} onChange={(e)=>setPasswords({...passwords,currentPassword:e.target.value})}/></label><label className="field">Nouveau mot de passe<input type="password" required minLength={10} value={passwords.newPassword} onChange={(e)=>setPasswords({...passwords,newPassword:e.target.value})}/></label><label className="field">Confirmer le nouveau mot de passe<input type="password" required minLength={10} value={passwords.confirm} onChange={(e)=>setPasswords({...passwords,confirm:e.target.value})}/></label><button className="primary">Modifier le mot de passe</button></form>
  </section></AppShell>;
}
