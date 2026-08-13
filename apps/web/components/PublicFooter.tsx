import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer className="publicFooter">
      <div className="publicContainer publicFooterGrid">
        <div>
          <div className="publicBrand publicBrandFooter">Coffr<span>i</span>a</div>
          <p>Centralisez, classez et sécurisez vos documents dans un espace professionnel pensé pour les organisations.</p>
        </div>
        <div>
          <strong>Navigation</strong>
          <Link href="/">Accueil</Link>
          <Link href="/souscription">Tarifs</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/connexion">Connexion</Link>
        </div>
        <div>
          <strong>Contact</strong>
          <a href="mailto:contact.lmurbs@gmail.com">contact.lmurbs@gmail.com</a>
          <a href="https://wa.me/2250711124359" target="_blank" rel="noreferrer">WhatsApp : +225 07 11 12 43 59</a>
          <span>Solution éditée par LMurbs</span>
        </div>
      </div>
      <div className="publicFooterBottom">© {new Date().getFullYear()} Coffria — Tous droits réservés.</div>
    </footer>
  );
}
