# Coffria LMurbs v1.4.0

Correctif de fiabilité et de performance des imports.

## Évolutions

- Import multipart S3 automatique à partir de 64 Mo.
- Blocs de 32 Mo envoyés jusqu'à 4 en parallèle, avec 3 tentatives par bloc.
- Progression calculée sur les octets réellement envoyés.
- Annulation automatique et libération immédiate du quota en cas d'échec.
- Nettoyage automatique toutes les 15 minutes des imports abandonnés depuis plus d'une heure.
- Nettoyage des imports abandonnés avant chaque nouvelle réservation de quota.
- Affichage séparé des documents actifs, imports en cours et espace disponible.
- Menus Actions opérationnels pour dossiers et documents.
- Prévisualisation, téléchargement, renommage et mise à la corbeille.

## Configuration

Mettre `S3_PRESIGNED_TTL_SECONDS=3600` dans `.env` pour les imports volumineux.
Le CORS du bucket doit exposer l'en-tête `ETag` et autoriser `PUT`.

## Déploiement

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec api npx prisma migrate deploy
```

Aucune nouvelle migration de base n'est nécessaire entre les versions 1.3.0 et 1.4.0.
