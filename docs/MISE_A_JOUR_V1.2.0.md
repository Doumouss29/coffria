# Coffria LMurbs v1.2.0

## Nouveautés

- Gestion des comptes Super Admin (création et suppression sécurisée).
- Blocage de connexion et des sessions lorsque l’entreprise est suspendue ou expirée.
- Suppression définitive d’une entreprise, de ses utilisateurs, données et versions S3.
- Gestion de plusieurs administrateurs par entreprise depuis le portail Super Admin.
- Modification, suspension, mot de passe et suppression des utilisateurs par le Tenant Admin.
- Modification du mot de passe par chaque utilisateur depuis Paramètres.
- Masquage et interdiction de la gestion des utilisateurs pour EDITOR et VIEWER.
- Affichage des types de fichiers sous forme PDF, DOCX, XLSX, etc.

## Déploiement

1. Conserver le `.env` de production.
2. Arrêter la version actuelle avec `docker compose down`.
3. Remplacer le dossier applicatif par cette version.
4. Restaurer `.env`.
5. Construire avec `docker compose --progress plain build`.
6. Démarrer avec `docker compose up -d`.
7. Exécuter `docker compose exec api npx prisma migrate deploy`.

Aucune nouvelle migration de schéma n’est requise par la v1.2.0.
