-- Aligne une fois la grille tarifaire historique avec la grille commerciale actuelle.
-- Après cette migration, les pages publiques lisent directement PricingPlan :
-- les futures modifications se font donc depuis Vitrine & Marketing > Tarifs.

UPDATE "PricingPlan"
SET "isActive" = FALSE, "updatedAt" = NOW()
WHERE "slug" = 'essentiel';

INSERT INTO "PricingPlan" (
  "id","name","slug","subtitle","priceLabel","monthlyPriceCents","yearlyPriceCents",
  "storageGb","maxUsers","features","badge","isHighlighted","isActive","sortOrder",
  "createdAt","updatedAt"
)
VALUES
(
  gen_random_uuid()::text,
  'PRO',
  'pro',
  'La formule tout-en-un pour accélérer vos processus documentaires et de validation.',
  '40 000 FCFA HT / mois',
  4000000,
  44000000,
  500,
  NULL,
  '["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature électronique sécurisée par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire"]'::jsonb,
  NULL,
  FALSE,
  TRUE,
  1,
  NOW(),
  NOW()
),
(
  gen_random_uuid()::text,
  'CORPORATE',
  'corporate',
  'L’expérience sur-mesure pour les grandes organisations et les volumes importants.',
  '60 000 FCFA HT / mois',
  6000000,
  60000000,
  1000,
  NULL,
  '["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature électronique sécurisée par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire","Signature électronique sécurisée multi-signataires et workflows","Quota de signature configurable","Accès API et intégrations","Accompagnement et support dédiés"]'::jsonb,
  'Bestseller',
  TRUE,
  TRUE,
  2,
  NOW(),
  NOW()
),
(
  gen_random_uuid()::text,
  'SUR MESURE',
  'sur-mesure',
  'Au-delà de 1 To, adaptez la capacité de stockage par paliers de 500 Go.',
  'À partir de 80 000 FCFA HT / mois',
  8000000,
  80000000,
  1500,
  NULL,
  '["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature électronique sécurisée par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire","Signature électronique sécurisée multi-signataires et workflows","Quota de signature configurable","Accès API et intégrations","Accompagnement et support dédiés","Stockage extensible par paliers de 500 Go","Dimensionnement adapté aux gros volumes","Accompagnement au dimensionnement"]'::jsonb,
  'Flexible',
  FALSE,
  TRUE,
  3,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "subtitle" = EXCLUDED."subtitle",
  "priceLabel" = EXCLUDED."priceLabel",
  "monthlyPriceCents" = EXCLUDED."monthlyPriceCents",
  "yearlyPriceCents" = EXCLUDED."yearlyPriceCents",
  "storageGb" = EXCLUDED."storageGb",
  "maxUsers" = EXCLUDED."maxUsers",
  "features" = EXCLUDED."features",
  "badge" = EXCLUDED."badge",
  "isHighlighted" = EXCLUDED."isHighlighted",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = NOW();
