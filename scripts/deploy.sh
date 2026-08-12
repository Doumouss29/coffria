#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[1/5] Vérification de l'environnement"
test -f .env || { echo "Fichier .env manquant"; exit 1; }

echo "[2/5] Construction des images"
docker compose build

echo "[3/5] Démarrage des services"
docker compose up -d

echo "[4/5] Migrations Prisma"
docker compose exec -T api npx prisma migrate deploy

echo "[5/5] Etat des services"
docker compose ps
