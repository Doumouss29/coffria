'use client';
import { FormEvent, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';
import { api } from '../../lib/api';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      setNotice('');
      setError('');
      await api('/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, company, message }),
      });
      setNotice('Votre message a bien été envoyé. Nous vous répondrons rapidement.');
      setName('');
      setEmail('');
      setCompany('');
      setMessage('');
    } catch (e: any) {
      setError(e.message || 'Impossible d’envoyer votre message pour le moment.');
    } finally {
      setBusy(false);
    }
  }

  function openWhatsApp() {
    const text = encodeURIComponent(`Bonjour, je souhaite en savoir plus sur Coffria.\nNom : ${name}\nOrganisation : ${company}\nMessage : ${message}`);
    window.open(`https://wa.me/2250711124359?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="publicPage">
      <PublicHeader />
      <section className="pageHero">
        <div className="publicContainer">
          <span className="eyebrow">Contact</span>
          <h1>Parlons de vos besoins documentaires</h1>
          <p>Demandez une démonstration, une proposition commerciale ou des informations complémentaires sur Coffria.</p>
        </div>
      </section>
      <section className="section">
        <div className="publicContainer contactGrid">
          <aside className="contactInfo">
            <h2>Nous contacter</h2>
            <p>Notre équipe vous accompagne pour définir la formule et le niveau de stockage adaptés à votre organisation.</p>
            <div><strong>Email</strong><br/><a href="mailto:contact.lmurbs@gmail.com">contact.lmurbs@gmail.com</a></div>
            <div><strong>WhatsApp</strong><br/><a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer">+225 07 11 12 43 59</a></div>
            <div><strong>Éditeur</strong><br/><span>LMurbs</span></div>
          </aside>
          <form className="contactForm" onSubmit={submit}>
            <label>Nom et prénom<input value={name} onChange={e => setName(e.target.value)} required /></label>
            <label>Adresse email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label>Organisation<input value={company} onChange={e => setCompany(e.target.value)} /></label>
            <label>Votre message<textarea value={message} onChange={e => setMessage(e.target.value)} required /></label>
            {notice && <div className="alert success">{notice}</div>}
            {error && <div className="alert error">{error}</div>}
            <div className="contactActions">
              <button type="submit" className="publicPrimary" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le message'}</button>
              <button type="button" className="publicSecondary" onClick={openWhatsApp}>Envoyer par WhatsApp</button>
            </div>
          </form>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
