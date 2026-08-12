# Cahier des charges fonctionnel — Coffria

## 1. Objet
Plateforme SaaS multi-cabinets pour classer, sécuriser, rechercher, partager et tracer les documents professionnels.

## 2. Profils
- Super administrateur : cabinets, quotas, supervision, assistance auditée.
- Administrateur cabinet : utilisateurs, groupes, droits, corbeille, partages.
- Modification : création, dépôt, modification et mise en corbeille.
- Viewer : consultation et prévisualisation, sans téléchargement.

## 3. Explorateur documentaire
- vue liste de type Windows et vue grille ;
- colonnes : nom, type, taille, création, modification, auteur, version, statut ;
- tri ascendant/descendant ;
- dossiers en premier ;
- sélection multiple, glisser-déposer et menu contextuel ;
- fil d'Ariane ;
- favoris, récents et éléments partagés.

## 4. Documents
- upload multipart direct S3 ;
- formats bureautiques, images, PDF, archives, CAO/SIG ;
- blocage des exécutables ;
- versions métier ;
- corbeille de 30 jours ;
- prévisualisation PDF/image ;
- ZIP asynchrone ;
- numéro `COF-AAAA-NNNNNN`.

## 5. Recherche
- formulaire avancé ;
- plein texte ;
- OCR ;
- recherche sémantique ;
- langage naturel ;
- réponses sourcées ;
- aucune génération SQL directe par le modèle IA.

## 6. Quotas
Quota de stockage, nombre d'utilisateurs et taille maximale définis par cabinet. Alertes à 80 et 95 %, blocage des nouveaux dépôts à 100 %.

## 7. Sécurité
Tenant obligatoire sur toutes les ressources, contrôle backend systématique, MFA administrateurs, liens signés temporaires, journal d'audit, chiffrement S3, politique de moindre privilège.
