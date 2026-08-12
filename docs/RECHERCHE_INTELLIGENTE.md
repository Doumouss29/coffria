# Recherche intelligente

## Modes
1. Recherche classique : noms, dossiers, types, tailles, dates, métadonnées.
2. Plein texte : PDF et bureautique.
3. OCR : scans et images.
4. Sémantique : proximité de sens.
5. Langage naturel : transformation en filtres JSON validés.

## Principe de sûreté
Le moteur IA produit seulement une structure de filtres. Le backend applique le tenant, les permissions et la liste blanche des champs. Il ne reçoit ni n'exécute du SQL libre.

## Exemples
- « fichiers PDF dont le nom contient bornage »
- « documents de plus de 50 Mo créés cette année »
- « procès-verbaux concernant la parcelle BK 458 »
- « dossiers parlant d'un conflit de limites »

## Actions
Les actions massives proposées par l'assistant doivent toujours afficher un aperçu et nécessiter une confirmation humaine.
