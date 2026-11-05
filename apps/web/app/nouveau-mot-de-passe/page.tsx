'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { applyBranding, Branding, DEFAULT_BRANDING, normalizeBranding } from '../../lib/branding';

export default function NewPasswordPage() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
    api(`/tenant-branding/public/resolve?host=${encodeURIComponent(window.location.hostname)}`)
      .then((value) => { const next = normalizeBranding(value); setBranding(next); applyBranding(next); })
      .catch(() => { setBranding(DEFAULT_BRANDING); applyBranding(DEFAULT_BRANDING); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError('Le lien est incomplet ou invalide.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    try {
      setBusy(true); setError(''); setMessage('');
      const result = await api('/auth/set-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
      setMessage(result.message || 'Votre mot de passe a été enregistré.');
      setPassword(''); setConfirm('');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <main className="login"><div className="loginCard">
    <div className="brand">{branding.isEnabled ? branding.appName : <>Coffr<span>i</span>a</>}</div>
    <div className="sub">Créer mon mot de passe</div>
    {message ? <><div className="alert success">{message}</div><Link className="primary full accountLinkButton" href="/connexion">Se connecter</Link></> :
    <form onSubmit={submit}>
      <p className="muted">Choisissez un mot de passe d’au moins 10 caractères. Ce lien ne pourra plus être réutilisé après validation.</p>
      <label className="field">Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required autoFocus/></label>
      <label className="field">Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
      {error&&<p className="loginError">{error}</p>}
      <button className="primary full" disabled={busy}>{busy?'Enregistrement…':'Enregistrer mon mot de passe'}</button>
    </form>}
    <div className="loginBack"><Link href="/connexion">← Retour à la connexion</Link></div>
  </div></main>;
}
