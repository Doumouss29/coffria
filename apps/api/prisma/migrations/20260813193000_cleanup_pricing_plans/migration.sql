DELETE FROM "PricingPlan" WHERE "slug" IN ('professionnel','entreprise');

UPDATE "PricingPlan" SET
  "features"='["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Support standard","Signature graphique : non incluse"]'::jsonb,
  "isActive"=TRUE,
  "sortOrder"=1,
  "updatedAt"=NOW()
WHERE "slug"='essentiel';

UPDATE "PricingPlan" SET
  "features"='["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature graphique par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire"]'::jsonb,
  "isActive"=TRUE,
  "sortOrder"=2,
  "updatedAt"=NOW()
WHERE "slug"='pro';

UPDATE "PricingPlan" SET
  "features"='["Recherche intelligente IA et indexation documentaire","Empreinte SHA-256 et traçabilité","Gestion des dossiers, versions et corbeille","Gestion des utilisateurs et des droits","Accès ordinateur, tablette et smartphone","Signature graphique par e-mail","Dossier de preuve de signature","Gestion avancée des droits et groupes","Support prioritaire","Signature graphique multi-signataires et workflows","Quota de signature configurable","Accès API et intégrations","Accompagnement et support dédiés"]'::jsonb,
  "isActive"=TRUE,
  "sortOrder"=3,
  "updatedAt"=NOW()
WHERE "slug"='corporate';
