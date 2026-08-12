# Déploiement local et production

## Local Windows

```bat
copy .env.example .env
notepad .env
docker compose up --build -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
docker compose ps
```

## Vérification

```text
http://localhost:3000
http://localhost:4000/api/health
```

## Arrêt

```bat
docker compose down
```

Pour supprimer aussi la base locale :

```bat
docker compose down -v
```

## Production
- PostgreSQL OVH managé avec SSL ;
- Redis managé ou haute disponibilité ;
- secrets dans un gestionnaire de secrets ;
- reverse proxy HTTPS ;
- migrations avant démarrage ;
- deux instances API minimum ;
- workers séparés ;
- sauvegarde et restauration testées ;
- logs centralisés et alertes.
