-- Grille commerciale simplifiée : uniquement PRO et SUR MESURE.
-- PRO : 70 000 FCFA HT/mois, 1 mois offert en annuel = 770 000 FCFA HT/an.
-- SUR MESURE : à partir de 1,5 To / 80 000 FCFA HT/mois, paliers de 500 Go à +20 000 FCFA HT/mois.

UPDATE "PricingPlan"
SET
  "name"='PRO',
  "subtitle"='La formule tout-en-un pour accélérer vos processus documentaires et de validation.',
  "priceLabel"='70 000 FCFA HT / mois',
  "monthlyPriceCents"=7000000,
  "yearlyPriceCents"=77000000,
  "storageGb"=500,
  "badge"=NULL,
  "isHighlighted"=FALSE,
  "isActive"=TRUE,
  "sortOrder"=1,
  "updatedAt"=NOW()
WHERE "slug"='pro';

UPDATE "PricingPlan"
SET
  "name"='SUR MESURE',
  "subtitle"='Au-delà de 1 To, adaptez la capacité de stockage par paliers de 500 Go.',
  "priceLabel"='À partir de 80 000 FCFA HT / mois',
  "monthlyPriceCents"=8000000,
  "yearlyPriceCents"=80000000,
  "storageGb"=1500,
  "badge"='Flexible',
  "isHighlighted"=TRUE,
  "isActive"=TRUE,
  "sortOrder"=2,
  "updatedAt"=NOW()
WHERE "slug"='sur-mesure';

UPDATE "PricingPlan"
SET "isActive"=FALSE, "updatedAt"=NOW()
WHERE "slug" NOT IN ('pro','sur-mesure');

UPDATE "MarketingOffer"
SET
  "title"='Pack SUR MESURE — à partir de 1,5 To',
  "description"='À partir de 1,5 To de stockage documentaire sécurisé à 80 000 FCFA HT par mois, puis +20 000 FCFA HT par palier supplémentaire de 500 Go.',
  "ctaLabel"='Choisir le Pack SUR MESURE',
  "ctaUrl"='/souscription?plan=sur-mesure',
  "updatedAt"=NOW()
WHERE "isActive"=TRUE;
