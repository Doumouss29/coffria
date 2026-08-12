# Coffria v1.3.0

- Sélection et import simultané de plusieurs fichiers.
- Progression individuelle moderne pour chaque fichier.
- Message vert uniquement après finalisation réelle de l'import.
- Visibilité des dossiers : toute l'entreprise, créateur uniquement, personnes/groupes spécifiques.
- Gestion des groupes par les administrateurs et éditeurs.
- Contrôle des accès lors de la navigation, de la recherche, du téléchargement et de l'import.

## Déploiement

```bash
cd ~/apps/coffria-industrial-starter
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
```
