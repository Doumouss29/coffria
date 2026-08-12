import Link from 'next/link';
import PublicHeader from '../../components/PublicHeader';
import PublicFooter from '../../components/PublicFooter';

const plans = [
  {
    name: 'Essentiel',
    subtitle: 'Pour démarrer simplement',
    items: ['Espace documentaire sécurisé', 'Gestion des dossiers et sous-dossiers', 'Comptes utilisateurs', 'Versioning et corbeille', 'Support standard'],
  },
  {
    name: 'Professionnel',
    subtitle: 'Pour les équipes qui collaborent au quotidien',
    featured: true,
    items: ['Toutes les fonctions Essentiel', 'Gestion avancée des droits', 'Groupes utilisateurs', 'Quotas et administration entreprise', 'Accompagnement au déploiement'],
  },
  {
    name: 'Entreprise',
    subtitle: 'Pour les besoins avancés et volumes importants',
    items: ['Toutes les fonctions Professionnel', 'Capacité de stockage adaptée', 'Paramétrage et accompagnement dédié', 'Support prioritaire', 'Options et évolutions sur mesure'],
  },
];

export default function PricingPage() {
  return (
    <main className="publicPage">
      <PublicHeader />
      <section className="pageHero">
        <div className="publicContainer">
          <span className="eyebrow">Tarifs Coffria</span>
          <h1>Une formule adaptée à votre organisation</h1>
          <p>Les tarifs seront définis selon le nombre d'utilisateurs, le volume de stockage et le niveau d'accompagnement souhaité. Nous pouvons faire évoluer ces formules au fur et à mesure de votre offre commerciale.</p>
        </div>
      </section>
      <section className="section">
        <div className="publicContainer pricingGrid">
          {plans.map(plan => (
            <article key={plan.name} className={`priceCard ${plan.featured ? 'featured' : ''}`}>
              <div className="priceName">{plan.name}</div>
              <p>{plan.subtitle}</p>
              <div className="priceAmount">Sur devis <small>/ selon besoins</small></div>
              <ul className="priceList">{plan.items.map(item => <li key={item}>{item}</li>)}</ul>
              <Link href="/contact" className={plan.featured ? 'publicPrimary' : 'publicSecondary'}>Demander une offre</Link>
            </article>
          ))}
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
