import Link from 'next/link';

export default function PublicHeader() {
  return (
    <header className="publicHeader">
      <div className="publicContainer publicHeaderInner">
        <Link href="/" className="publicBrandWrap">
          <span className="publicBrand">Coffr<span>i</span>a</span>
          <span className="publicBrandTagline">Une solution LMurbs</span>
        </Link>
        <nav className="publicNav">
          <Link href="/">Accueil</Link>
          <Link href="/tarifs">Tarifs</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/connexion" className="publicLoginButton">Connexion</Link>
        </nav>
      </div>
    </header>
  );
}
