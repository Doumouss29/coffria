'use client';
import { FormEvent, useState } from 'react';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Demande Coffria - ${company || name}`);
    const body = encodeURIComponent(`Nom : ${name}\nEmail : ${email}\nOrganisation : ${company}\n\nMessage :\n${message}`);
    window.location.href = `mailto:contact.lmurbs@gmail.com?subject=${subject}&body=${body}`;
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
            <div className="contactActions">
              <button type="submit" className="publicPrimary">Envoyer par email</button>
              <button type="button" className="publicSecondary" onClick={openWhatsApp}>Envoyer par WhatsApp</button>
            </div>
          </form>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
