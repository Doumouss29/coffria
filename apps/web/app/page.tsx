import Link from 'next/link';
import PublicHeader from '../components/PublicHeader';
import PublicFooter from '../components/PublicFooter';

export default function HomePage() {
  return (
    <main className="publicPage">
      <PublicHeader />

      <section className="hero">
        <div className="publicContainer heroGrid">
          <div>
            <span className="eyebrow">Archivage documentaire professionnel</span>
            <h1>Vos documents. <span>Centralisés, classés et sécurisés.</span></h1>
            <p className="heroLead">
              Coffria est une plateforme d'archivage documentaire conçue pour permettre aux organisations de structurer leurs dossiers, gérer les accès, suivre les versions et retrouver rapidement l'information utile.
            </p>
            <div className="heroActions">
              <Link href="/contact" className="publicPrimary">Demander une démonstration</Link>
              <Link href="/connexion" className="publicSecondary">Accéder à mon espace</Link>
            </div>
          </div>

          <div className="heroPanel">
            <div className="heroPanelTop">
              <strong>Aperçu Coffria</strong>
              <span className="heroPanelBadge">Espace sécurisé</span>
            </div>
            <div className="mockGrid">
              <div className="mockCard"><span>Documents</span><strong>Centralisés</strong></div>
              <div className="mockCard"><span>Droits d'accès</span><strong>Maîtrisés</strong></div>
              <div className="mockCard"><span>Versions</span><strong>Traçables</strong></div>
              <div className="mockCard"><span>Recherche</span><strong>Rapide</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="publicContainer">
          <div className="sectionHead">
            <div><span className="eyebrow">Pourquoi Coffria ?</span><h2>Une gestion documentaire plus simple</h2></div>
            <p>Organisez vos dossiers par entreprise, attribuez les bons droits aux bons utilisateurs et gardez une vision claire de vos documents.</p>
          </div>
          <div className="featureGrid">
            <article className="featureCard"><div className="featureIcon">01</div><h3>Classement structuré</h3><p>Dossiers, sous-dossiers, documents et métadonnées organisés dans une arborescence claire.</p></article>
            <article className="featureCard"><div className="featureIcon">02</div><h3>Droits et rôles</h3><p>Administrateurs, utilisateurs en modification et consultation avec des permissions adaptées.</p></article>
            <article className="featureCard"><div className="featureIcon">03</div><h3>Sécurité et traçabilité</h3><p>Historique, versions, corbeille et stockage objet sécurisé pour mieux protéger le patrimoine documentaire.</p></article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="publicContainer">
          <div className="sectionHead">
            <div><span className="eyebrow">Nouveautés</span><h2>Ce qui évolue dans Coffria</h2></div>
            <p>Cette zone peut être mise à jour au fil des nouvelles fonctionnalités, améliorations et annonces produit.</p>
          </div>
          <div className="newsGrid">
            <article className="newsCard"><span className="newsTag">Nouveau</span><h3>Nouvelle infrastructure Coffria</h3><p>La plateforme bénéficie désormais d'un déploiement sécurisé en HTTPS avec base PostgreSQL dédiée et stockage objet.</p></article>
            <article className="newsCard"><span className="newsTag">Produit</span><h3>Gestion avancée des accès</h3><p>Les droits peuvent être organisés par utilisateurs, groupes et dossiers afin de mieux contrôler la diffusion des documents.</p></article>
            <article className="newsCard"><span className="newsTag">À venir</span><h3>Recherche documentaire enrichie</h3><p>Coffria évolue vers une recherche plus naturelle pour retrouver plus facilement les dossiers et documents utiles.</p></article>
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="publicContainer">
          <div className="offerBanner">
            <div><span className="eyebrow">Offre du moment</span><h2>Découvrez Coffria avec une démonstration personnalisée</h2><p>Présentez-nous votre organisation et vos besoins documentaires : nous vous proposerons la formule adaptée.</p></div>
            <Link href="/contact" className="publicPrimary">Nous contacter</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
