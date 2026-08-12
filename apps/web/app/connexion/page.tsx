'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      setError('');
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('coffria_token', d.accessToken);
      localStorage.setItem('coffria_user', JSON.stringify(d.user));
      router.push(d.user.role === 'SUPER_ADMIN' ? '/admin/tenants' : '/explorer');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="loginCard" onSubmit={submit}>
        <div className="brand">Coffr<span>i</span>a</div>
        <div className="sub">Votre espace documentaire sécurisé et intelligent</div>
        <label className="field">Adresse email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label className="field">Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p className="loginError">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? 'Connexion…' : 'Ouvrir une session'}</button>
        <div className="powered">Solution éditée par <strong>LMurbs</strong></div>
        <div className="loginBack"><Link href="/">← Retour au site Coffria</Link></div>
      </form>
    </main>
  );
}
