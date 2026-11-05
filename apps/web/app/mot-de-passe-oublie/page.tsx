'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { applyBranding, Branding, DEFAULT_BRANDING, normalizeBranding } from '../../lib/branding';

export default function ForgotPasswordPage() {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/tenant-branding/public/resolve?host=${encodeURIComponent(window.location.hostname)}`)
      .then((value) => { const next = normalizeBranding(value); setBranding(next); applyBranding(next); })
      .catch(() => { setBranding(DEFAULT_BRANDING); applyBranding(DEFAULT_BRANDING); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true); setError(''); setMessage('');
      const result = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage(result.message || 'Si un compte correspond à cette adresse, un email vient d’être envoyé.');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <main className="login"><div className="loginCard">
    <div className="brand">{branding.isEnabled ? branding.appName : <>Coffr<span>i</span>a</>}</div>
    <div className="sub">Réinitialiser mon mot de passe</div>
    <form onSubmit={submit}>
      <p className="muted">Renseignez l’adresse email de votre compte. Vous recevrez un lien sécurisé pour choisir un nouveau mot de passe.</p>
      <label className="field">Adresse email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></label>
      {message&&<div className="alert success">{message}</div>}
      {error&&<p className="loginError">{error}</p>}
      <button className="primary full" disabled={busy}>{busy?'Envoi…':'Envoyer le lien'}</button>
    </form>
    <div className="loginBack"><Link href="/connexion">← Retour à la connexion</Link></div>
  </div></main>;
}
