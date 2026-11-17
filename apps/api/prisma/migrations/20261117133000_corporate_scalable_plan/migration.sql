-- Corporate devient l'offre évolutive au-delà de 1 To.
-- Base : 1,5 To à 80 000 FCFA HT/mois, puis +20 000 FCFA HT par palier de 500 Go.
-- L'ancienne offre SUR MESURE est désactivée pour éviter le doublon.

UPDATE "PricingPlan"
SET
  "name"='CORPORATE',
  "subtitle"='Au-delà de 1 To, adaptez la capacité de stockage par paliers de 500 Go.',
  "priceLabel"='À partir de 80 000 FCFA HT / mois',
  "monthlyPriceCents"=8000000,
  "yearlyPriceCents"=80000000,
  "storageGb"=1500,
  "features"='["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature électronique sécurisée par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire","Signature électronique sécurisée multi-signataires et workflows","Quota de signature configurable","Accès API et intégrations","Accompagnement et support dédiés","Stockage extensible par paliers de 500 Go","Dimensionnement adapté aux gros volumes","Accompagnement au dimensionnement"]'::jsonb,
  "badge"='Flexible',
  "isHighlighted"=TRUE,
  "isActive"=TRUE,
  "sortOrder"=2,
  "updatedAt"=NOW()
WHERE "slug"='corporate';

UPDATE "PricingPlan"
SET "isActive"=FALSE, "updatedAt"=NOW()
WHERE "slug"='sur-mesure';

UPDATE "MarketingOffer"
SET
  "title"='Pack CORPORATE — à partir de 1,5 To',
  "description"='À partir de 1,5 To de stockage documentaire sécurisé à 80 000 FCFA HT par mois, puis +20 000 FCFA HT par palier supplémentaire de 500 Go.',
  "ctaLabel"='Choisir le Pack CORPORATE',
  "ctaUrl"='/souscription?plan=corporate',
  "updatedAt"=NOW()
WHERE "isActive"=TRUE
  AND (
    UPPER("title") LIKE '%CORPORATE%'
    OR UPPER("title") LIKE '%ESSENTIEL%'
  );
