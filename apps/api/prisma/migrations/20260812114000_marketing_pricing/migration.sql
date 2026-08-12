CREATE TABLE "MarketingOffer" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "description" TEXT NOT NULL,
  "ctaLabel" TEXT NOT NULL DEFAULT 'Découvrir l''offre',
  "ctaUrl" TEXT NOT NULL DEFAULT '/contact',
  "placement" TEXT NOT NULL DEFAULT 'BOTH',
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MarketingOffer_isActive_sortOrder_idx" ON "MarketingOffer"("isActive", "sortOrder");

CREATE TABLE "PricingPlan" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "subtitle" TEXT,
  "priceLabel" TEXT NOT NULL DEFAULT 'Sur devis',
  "monthlyPriceCents" INTEGER,
  "yearlyPriceCents" INTEGER,
  "storageGb" INTEGER,
  "maxUsers" INTEGER,
  "features" JSONB NOT NULL DEFAULT '[]',
  "badge" TEXT,
  "isHighlighted" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PricingPlan_isActive_sortOrder_idx" ON "PricingPlan"("isActive", "sortOrder");

INSERT INTO "MarketingOffer" ("id","title","subtitle","description","ctaLabel","ctaUrl","placement","isActive","sortOrder") VALUES
('offer-launch-2026','Offre de lancement Coffria','Démarrez votre archivage documentaire dans de bonnes conditions','Profitez d’une démonstration personnalisée et d’un accompagnement au démarrage pour identifier la formule la plus adaptée à votre organisation.','Découvrir l’offre','/contact','BOTH',TRUE,0);

INSERT INTO "PricingPlan" ("id","name","slug","subtitle","priceLabel","features","badge","isHighlighted","isActive","sortOrder") VALUES
('plan-essential','Essentiel','essentiel','Pour démarrer simplement','Sur devis','["Espace documentaire sécurisé","Gestion des dossiers et sous-dossiers","Comptes utilisateurs","Versioning et corbeille","Support standard"]',NULL,FALSE,TRUE,0),
('plan-pro','Professionnel','professionnel','Pour les équipes qui collaborent au quotidien','Sur devis','["Toutes les fonctions Essentiel","Gestion avancée des droits","Groupes utilisateurs","Quotas et administration entreprise","Accompagnement au déploiement"]','Recommandée',TRUE,TRUE,1),
('plan-enterprise','Entreprise','entreprise','Pour les besoins avancés et volumes importants','Sur devis','["Toutes les fonctions Professionnel","Capacité de stockage adaptée","Paramétrage et accompagnement dédié","Support prioritaire","Options et évolutions sur mesure"]',NULL,FALSE,TRUE,2);
