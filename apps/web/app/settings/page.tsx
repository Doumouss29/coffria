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
  const [mfa, setMfa] = useState<any>(null);
  const [securityPassword, setSecurityPassword] = useState('');
  const [totpSetup, setTotpSetup] = useState<any>(null);
  const [totpCode, setTotpCode] = useState('');
  const [emailSetupToken, setEmailSetupToken] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [securityBusy, setSecurityBusy] = useState(false);

  function loadMfa() {
    api('/auth/mfa/status').then(setMfa).catch((e:any)=>setError(e.message));
  }

  useEffect(() => {
    const raw = localStorage.getItem('coffria_user');
    if (raw) setUser(JSON.parse(raw));
    api('/settings').then((d) => { setData(d); setName(d.name); }).catch(() => undefined);
    loadMfa();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const d = await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({ name, mfaAllowTotp: data.mfaAllowTotp, mfaAllowEmail: data.mfaAllowEmail }),
      });
      setData(d); setMessage('Paramètres enregistrés.'); setError('');
    } catch (e: any) { setError(e.message); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirm) { setError('Les nouveaux mots de passe ne correspondent pas.'); return; }
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' }); setMessage('Mot de passe modifié. Les appareils de confiance ont été révoqués.'); setError('');
      localStorage.removeItem('coffria_trusted_device');
      loadMfa();
    } catch (e: any) { setError(e.message); }
  }

  async function beginTotp() {
    try {
      setSecurityBusy(true); setError(''); setMessage(''); setRecoveryCodes([]);
      const d = await api('/auth/mfa/account/totp/setup', { method:'POST', body: JSON.stringify({ currentPassword: securityPassword }) });
      setTotpSetup(d); setTotpCode('');
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  async function confirmTotp() {
    try {
      setSecurityBusy(true); setError('');
      const d = await api('/auth/mfa/account/totp/confirm', { method:'POST', body: JSON.stringify({ setupToken: totpSetup.setupToken, code: totpCode }) });
      setRecoveryCodes(d.recoveryCodes || []); setTotpSetup(null); setTotpCode(''); setSecurityPassword(''); setMessage('Authenticator activé. Enregistrez vos nouveaux codes de récupération.');
      localStorage.removeItem('coffria_trusted_device'); loadMfa();
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  async function beginEmail() {
    try {
      setSecurityBusy(true); setError(''); setMessage(''); setRecoveryCodes([]);
      const d = await api('/auth/mfa/account/email/send', { method:'POST', body: JSON.stringify({ currentPassword: securityPassword }) });
      setEmailSetupToken(d.setupToken); setEmailCode(''); setMessage('Un code a été envoyé à votre adresse email.');
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  async function confirmEmail() {
    try {
      setSecurityBusy(true); setError('');
      const d = await api('/auth/mfa/account/email/confirm', { method:'POST', body: JSON.stringify({ setupToken: emailSetupToken, code: emailCode }) });
      setRecoveryCodes(d.recoveryCodes || []); setEmailSetupToken(''); setEmailCode(''); setSecurityPassword(''); setMessage('Vérification par email activée. Enregistrez vos nouveaux codes de récupération.');
      localStorage.removeItem('coffria_trusted_device'); loadMfa();
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  async function regenerateRecovery() {
    try {
      setSecurityBusy(true); setError(''); setMessage('');
      const d = await api('/auth/mfa/recovery/regenerate', { method:'POST', body: JSON.stringify({ currentPassword: securityPassword }) });
      setRecoveryCodes(d.recoveryCodes || []); setSecurityPassword(''); setMessage('De nouveaux codes de récupération ont été générés. Les anciens ne sont plus valables.'); loadMfa();
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  async function revokeTrusted() {
    try {
      setSecurityBusy(true); setError('');
      await api('/auth/mfa/trusted-devices/revoke', { method:'POST' });
      localStorage.removeItem('coffria_trusted_device'); setMessage('Tous les appareils de confiance ont été révoqués.'); loadMfa();
    } catch(e:any){ setError(e.message); }
    finally{ setSecurityBusy(false); }
  }

  return <AppShell title="Paramètres"><section className="content"><h1>Mon compte et paramètres</h1>{message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}
    {data && user?.role === 'TENANT_ADMIN' && <form className="settingsCard" onSubmit={save}><h2>Organisation</h2><label className="field">Nom commercial<input value={name} onChange={e=>setName(e.target.value)} required/></label><div className="infoGrid"><div><span>Identifiant</span><b>{data.slug}</b></div><div><span>Utilisateurs maximum</span><b>{data.maxUsers}</b></div><div><span>Statut</span><b>{data.active?'Actif':'Suspendu'}</b></div></div>
      <div className="mfaPolicy"><h3>Politique de double authentification</h3><p>La double authentification reste obligatoire pour tous les comptes. Vous pouvez choisir les méthodes autorisées dans votre organisation.</p>
        <label><input type="checkbox" checked={data.mfaAllowTotp!==false} onChange={e=>setData({...data,mfaAllowTotp:e.target.checked})}/> Application Authenticator</label>
        <label><input type="checkbox" checked={data.mfaAllowEmail!==false} onChange={e=>setData({...data,mfaAllowEmail:e.target.checked})}/> Code par email</label>
      </div><button className="primary">Enregistrer</button></form>}

    {mfa && <div className="settingsCard securityCard"><h2>🔐 Double authentification</h2><div className="securityStatus"><span className="status">Obligatoire</span><b>{mfa.enabled ? `Active — ${mfa.method === 'TOTP' ? 'Authenticator' : 'Email'}` : 'Configuration requise'}</b></div><p>Votre compte Coffria est protégé par une double authentification obligatoire.</p>
      <div className="securityFacts"><div><span>Méthodes autorisées</span><b>{mfa.allowedMethods.map((m:string)=>m==='TOTP'?'Authenticator':'Email').join(' + ')}</b></div><div><span>Codes de récupération restants</span><b>{mfa.recoveryCodesRemaining}</b></div><div><span>Appareils de confiance</span><b>{mfa.trustedDevices.length}</b></div></div>
      <label className="field">Mot de passe actuel pour modifier la sécurité<input type="password" value={securityPassword} onChange={e=>setSecurityPassword(e.target.value)} placeholder="Votre mot de passe"/></label>
      <div className="securityActions">
        {mfa.allowedMethods.includes('TOTP') && <button type="button" className="secondary" disabled={securityBusy||!securityPassword} onClick={beginTotp}>Configurer Authenticator</button>}
        {mfa.allowedMethods.includes('EMAIL') && <button type="button" className="secondary" disabled={securityBusy||!securityPassword} onClick={beginEmail}>Utiliser le code par email</button>}
        <button type="button" className="secondary" disabled={securityBusy||!securityPassword} onClick={regenerateRecovery}>Régénérer mes codes de récupération</button>
        <button type="button" className="secondary" disabled={securityBusy||mfa.trustedDevices.length===0} onClick={revokeTrusted}>Révoquer les appareils de confiance</button>
      </div>
      {totpSetup && <div className="mfaSetupPanel"><h3>Scannez le QR code</h3><img className="mfaQr" src={totpSetup.qrDataUrl} alt="QR code Authenticator Coffria"/><div className="mfaSecret"><span>Clé manuelle</span><code>{totpSetup.secret}</code></div><label className="field">Code généré par l’application<input inputMode="numeric" maxLength={8} value={totpCode} onChange={e=>setTotpCode(e.target.value.replace(/\D/g,''))}/></label><button type="button" className="primary" onClick={confirmTotp} disabled={securityBusy||totpCode.length<6}>Confirmer Authenticator</button></div>}
      {emailSetupToken && <div className="mfaSetupPanel"><h3>Confirmez le code reçu par email</h3><label className="field">Code à 6 chiffres<input inputMode="numeric" maxLength={6} value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\D/g,''))}/></label><button type="button" className="primary" onClick={confirmEmail} disabled={securityBusy||emailCode.length!==6}>Confirmer le code</button></div>}
      {recoveryCodes.length>0 && <div className="recoveryPanel"><h3>Codes de récupération</h3><p>Enregistrez-les maintenant. Ils ne seront plus affichés ensuite.</p><div className="recoveryCodes">{recoveryCodes.map(c=><code key={c}>{c}</code>)}</div><button type="button" className="secondary" onClick={()=>navigator.clipboard?.writeText(recoveryCodes.join('\n'))}>Copier les codes</button></div>}
      {mfa.trustedDevices.length>0 && <div className="trustedList"><h3>Appareils de confiance</h3>{mfa.trustedDevices.map((d:any)=><div key={d.id}><span>{d.label || 'Appareil'}</span><small>Expire le {new Date(d.expiresAt).toLocaleDateString('fr-FR')}</small></div>)}</div>}
    </div>}

    <form className="settingsCard" onSubmit={changePassword}><h2>Modifier mon mot de passe</h2><label className="field">Mot de passe actuel<input type="password" required value={passwords.currentPassword} onChange={(e)=>setPasswords({...passwords,currentPassword:e.target.value})}/></label><label className="field">Nouveau mot de passe<input type="password" required minLength={10} value={passwords.newPassword} onChange={(e)=>setPasswords({...passwords,newPassword:e.target.value})}/></label><label className="field">Confirmer le nouveau mot de passe<input type="password" required minLength={10} value={passwords.confirm} onChange={(e)=>setPasswords({...passwords,confirm:e.target.value})}/></label><button className="primary">Modifier le mot de passe</button></form>
  </section></AppShell>;
}
