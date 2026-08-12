import Link from 'next/link';

export default function PublicHeader() {
  return (
    <header className="publicHeader">
      <div className="publicContainer publicHeaderInner">
        <Link href="/" className="publicBrandWrap">
          <span className="publicBrand">Coffr<span>i</span>a</span>
          <small>Une solution LMurbs</small>
        </Link>
        <nav className="publicNav">
          <Link href="/">Accueil</Link>
          <Link href="/offres">Offres</Link>
          <Link href="/tarifs">Tarifs</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/connexion" className="publicLoginButton">Connexion</Link>
        </nav>
      </div>
    </header>
  );
}
