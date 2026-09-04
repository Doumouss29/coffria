-- Ajoute une clause de révision annuelle des tarifs aux CGV Coffria.
-- La migration est idempotente : elle n'ajoute pas deux fois la clause.

UPDATE "LegalTerms"
SET
  "content" = CASE
    WHEN "content" LIKE '%17. Révision des tarifs%'
      THEN "content"
    ELSE "content" || E'\n\n17. Révision des tarifs\nLes tarifs des abonnements et options Coffria peuvent faire l’objet d’une revalorisation au maximum une fois par année civile, notamment afin de tenir compte de l’évolution des coûts d’hébergement, de stockage, de sécurité, des prestations de tiers, de la fiscalité ou des conditions économiques. Toute revalorisation applicable à un abonnement en cours est portée à la connaissance du client au moins trente (30) jours avant sa prise d’effet. Sauf accord contractuel contraire, le nouveau tarif s’applique à compter de la prochaine échéance de renouvellement. Le client qui n’accepte pas le nouveau tarif demeure libre de ne pas renouveler son abonnement dans les conditions prévues aux présentes CGV.'
  END,
  "version" = CASE
    WHEN "version" = '1.0' THEN '1.1'
    ELSE "version"
  END,
  "updatedAt" = NOW()
WHERE "id" = 'cgv';
