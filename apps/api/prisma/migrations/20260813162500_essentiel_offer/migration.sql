UPDATE "MarketingOffer" SET "isActive" = FALSE;

INSERT INTO "MarketingOffer" ("id","title","subtitle","description","ctaLabel","ctaUrl","placement","startAt","endAt","isActive","sortOrder","createdAt","updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Pack ESSENTIEL — 100 Go',
  'Offre du moment',
  'Démarrez avec 100 Go d’archivage documentaire sécurisé à 35 000 FCFA HT par mois. En paiement annuel, bénéficiez d’un mois offert, soit 385 000 FCFA HT par an.',
  'Choisir le Pack ESSENTIEL',
  '/conditions?plan=essentiel&billing=monthly',
  'BOTH',
  NOW(),
  NULL,
  TRUE,
  0,
  NOW(),
  NOW()
);
