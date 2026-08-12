# Mise à jour d’une installation Coffria

1. Sauvegarder le répertoire actuel et son fichier `.env`.
2. Décompresser la nouvelle version dans un nouveau dossier.
3. Copier uniquement le `.env` de l’ancienne installation.
4. Arrêter l’ancienne stack.
5. Construire et démarrer la nouvelle stack.
6. Appliquer les migrations Prisma.
7. Vérifier `/api/health`, la connexion et l’import S3.

Commandes détaillées fournies avec le package de livraison.
