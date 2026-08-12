# Coffria 1.0.0 — édition LMurbs

Coffria est une plateforme d’archivage documentaire multi-organisation éditée et commercialisée par **LMurbs**.

## Fonctions livrées

- authentification JWT et gestion des rôles ;
- navigation réelle dans les dossiers et sous-dossiers ;
- création de dossiers ;
- import direct vers un stockage S3 compatible Scaleway ;
- prévisualisation et téléchargement par URL signée ;
- recherche documentaire ;
- tableau de bord ;
- gestion des utilisateurs ;
- corbeille, restauration et suppression définitive ;
- paramètres de l’organisation ;
- interface responsive avec navigation LMurbs ;
- déploiement Docker avec PostgreSQL managé et Redis.

## Installation rapide

```bash
cp .env.example .env
# compléter .env
docker compose build
docker compose up -d
docker compose exec api npx prisma migrate deploy
```

Pour créer les comptes de démonstration :

```bash
docker compose exec api npm run seed
```

## URLs

- Interface : `http://SERVEUR:3000`
- API : `http://SERVEUR:4000/api`
- Santé : `http://SERVEUR:4000/api/health`

## Production

Utilisez une base PostgreSQL managée avec SSL, un bucket S3 privé, des clés dédiées et un reverse proxy HTTPS. Le fichier `.env` ne doit jamais être versionné ni transmis dans une archive client.

## Version 1.1.0
- Portail Super Admin `/admin/tenants`
- Création d'une entreprise cliente avec administrateur initial
- Quota de stockage, nombre maximal d'utilisateurs, activation et expiration d'abonnement
- Script `scripts/configure-s3-cors.sh` pour autoriser les imports directs depuis le navigateur


## Correctif 1.4.1
- Menu Actions rendu hors du conteneur de tableau (suppression du clipping CSS).
- URLs multipart pré-signées en lot.
- Blocs de 64 Mio et jusqu’à 6 envois parallèles.
- Affichage du débit moyen et du temps restant estimé.
