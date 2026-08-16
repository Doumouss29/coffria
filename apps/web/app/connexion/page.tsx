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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'credentials'|'mfa'|'totp'|'totpSetup'|'email'|'recovery'|'recoveryDisplay'>('credentials');
  const [challenge, setChallenge] = useState<any>(null);
  const [totpSetup, setTotpSetup] = useState<any>(null);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  function completeSession(d: any) {
    localStorage.setItem('coffria_token', d.accessToken);
    localStorage.setItem('coffria_user', JSON.stringify(d.user));
    if (d.trustedDeviceToken) localStorage.setItem('coffria_trusted_device', d.trustedDeviceToken);
    router.push(d.user.role === 'SUPER_ADMIN' ? '/admin/tenants' : '/explorer');
  }

  function handleVerified(d: any) {
    if (d.recoveryCodes?.length) {
      setPendingSession(d);
      setRecoveryCodes(d.recoveryCodes);
      setStage('recoveryDisplay');
      return;
    }
    completeSession(d);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true); setError(''); setMessage('');
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, trustedDeviceToken: localStorage.getItem('coffria_trusted_device') || undefined }),
      });
      if (d.accessToken) { completeSession(d); return; }
      setChallenge(d);
      setStage('mfa');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function chooseTotp() {
    try {
      setBusy(true); setError(''); setMessage(''); setCode('');
      if (challenge?.hasTotp) { setStage('totp'); return; }
      const d = await api('/auth/mfa/totp/setup', { method:'POST', body: JSON.stringify({ challengeToken: challenge.challengeToken }) });
      setTotpSetup(d); setStage('totpSetup');
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function sendEmailCode() {
    try {
      setBusy(true); setError(''); setMessage(''); setCode('');
      const d = await api('/auth/mfa/email/send', { method:'POST', body: JSON.stringify({ challengeToken: challenge.challengeToken }) });
      setMessage(d.message || 'Code envoyé.'); setStage('email');
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true); setError('');
      const d = await api('/auth/mfa/totp/verify', {
        method:'POST',
        body: JSON.stringify({ challengeToken: challenge.challengeToken, code, setupToken: totpSetup?.setupToken, rememberDevice }),
      });
      handleVerified(d);
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function verifyEmail(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true); setError('');
      const d = await api('/auth/mfa/email/verify', { method:'POST', body: JSON.stringify({ challengeToken: challenge.challengeToken, code, rememberDevice }) });
      handleVerified(d);
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function verifyRecovery(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true); setError('');
      const d = await api('/auth/mfa/recovery/verify', { method:'POST', body: JSON.stringify({ challengeToken: challenge.challengeToken, recoveryCode, rememberDevice }) });
      completeSession(d);
    } catch (e:any) { setError(e.message); }
    finally { setBusy(false); }
  }

  function restart() {
    setStage('credentials'); setChallenge(null); setTotpSetup(null); setCode(''); setRecoveryCode(''); setError(''); setMessage('');
  }

  return (
    <main className="login">
      <div className="loginCard mfaLoginCard">
        <div className="brand">Coffr<span>i</span>a</div>
        <div className="sub">Votre espace documentaire sécurisé et intelligent</div>

        {stage === 'credentials' && <form onSubmit={submit}>
          <label className="field">Adresse email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label className="field">Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          {error && <p className="loginError">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Connexion…' : 'Continuer'}</button>
        </form>}

        {stage === 'mfa' && <div className="mfaStep">
          <div className="mfaShield">🔐</div>
          <h2>Double authentification</h2>
          <p>La double authentification est obligatoire sur Coffria. Choisissez votre méthode de vérification.</p>
          <div className="mfaMethodGrid">
            {challenge?.allowedMethods?.includes('TOTP') && <button className="mfaMethod" onClick={chooseTotp} disabled={busy}><b>Application Authenticator</b><span>Google Authenticator, Microsoft Authenticator, Authy…</span></button>}
            {challenge?.allowedMethods?.includes('EMAIL') && <button className="mfaMethod" onClick={sendEmailCode} disabled={busy}><b>Code par email</b><span>Recevoir un code à 6 chiffres sur {challenge.emailHint}</span></button>}
          </div>
          {challenge?.hasRecoveryCodes && <button className="mfaLink" onClick={()=>{setError('');setStage('recovery')}}>Utiliser un code de récupération</button>}
          <button className="mfaLink" onClick={restart}>← Revenir à la connexion</button>
          {error && <p className="loginError">{error}</p>}
        </div>}

        {stage === 'totpSetup' && <form className="mfaStep" onSubmit={verifyTotp}>
          <h2>Configurer Authenticator</h2>
          <p>Scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou une application compatible.</p>
          <img className="mfaQr" src={totpSetup?.qrDataUrl} alt="QR code Authenticator Coffria" />
          <div className="mfaSecret"><span>Clé manuelle</span><code>{totpSetup?.secret}</code></div>
          <label className="field">Code à 6 chiffres<input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required /></label>
          <label className="mfaRemember"><input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)}/> Faire confiance à cet appareil pendant 30 jours</label>
          {error && <p className="loginError">{error}</p>}
          <button className="primary full" disabled={busy}>{busy?'Vérification…':'Activer et continuer'}</button>
          <button type="button" className="mfaLink" onClick={()=>setStage('mfa')}>← Choisir une autre méthode</button>
        </form>}

        {stage === 'totp' && <form className="mfaStep" onSubmit={verifyTotp}>
          <h2>Code Authenticator</h2><p>Entrez le code affiché dans votre application d’authentification.</p>
          <label className="field">Code à 6 chiffres<input className="mfaCodeInput" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required autoFocus /></label>
          <label className="mfaRemember"><input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)}/> Faire confiance à cet appareil pendant 30 jours</label>
          {error && <p className="loginError">{error}</p>}
          <button className="primary full" disabled={busy}>{busy?'Vérification…':'Vérifier'}</button>
          <button type="button" className="mfaLink" onClick={()=>setStage('mfa')}>← Choisir une autre méthode</button>
        </form>}

        {stage === 'email' && <form className="mfaStep" onSubmit={verifyEmail}>
          <h2>Vérifiez votre email</h2><p>Un code à 6 chiffres a été envoyé à votre adresse email. Il reste valable 5 minutes.</p>
          {message && <div className="alert success">{message}</div>}
          <label className="field">Code de sécurité<input className="mfaCodeInput" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} required autoFocus /></label>
          <label className="mfaRemember"><input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)}/> Faire confiance à cet appareil pendant 30 jours</label>
          {error && <p className="loginError">{error}</p>}
          <button className="primary full" disabled={busy}>{busy?'Vérification…':'Vérifier'}</button>
          <button type="button" className="mfaLink" onClick={sendEmailCode} disabled={busy}>Renvoyer un code</button>
          <button type="button" className="mfaLink" onClick={()=>setStage('mfa')}>← Choisir une autre méthode</button>
        </form>}

        {stage === 'recovery' && <form className="mfaStep" onSubmit={verifyRecovery}>
          <h2>Code de récupération</h2><p>Chaque code de récupération ne peut être utilisé qu’une seule fois.</p>
          <label className="field">Code<input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.toUpperCase())} placeholder="ABC123-DEF456" required autoFocus /></label>
          <label className="mfaRemember"><input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)}/> Faire confiance à cet appareil pendant 30 jours</label>
          {error && <p className="loginError">{error}</p>}
          <button className="primary full" disabled={busy}>{busy?'Vérification…':'Utiliser ce code'}</button>
          <button type="button" className="mfaLink" onClick={()=>setStage('mfa')}>← Retour</button>
        </form>}

        {stage === 'recoveryDisplay' && <div className="mfaStep">
          <h2>Enregistrez vos codes de récupération</h2>
          <p>Conservez-les dans un endroit sûr. Chaque code ne peut servir qu’une fois. Ils permettent de récupérer l’accès à votre compte si vous perdez votre téléphone ou votre accès email.</p>
          <div className="recoveryCodes">{recoveryCodes.map(c=><code key={c}>{c}</code>)}</div>
          <button className="secondary full" onClick={()=>navigator.clipboard?.writeText(recoveryCodes.join('\n'))}>Copier les codes</button>
          <button className="primary full" onClick={()=>completeSession(pendingSession)}>J’ai enregistré mes codes — continuer</button>
        </div>}

        <div className="powered">Solution éditée par <strong>LMurbs</strong></div>
        <div className="loginBack"><Link href="/">← Retour au site Coffria</Link></div>
      </div>
    </main>
  );
}
