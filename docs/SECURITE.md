# Exigences de sécurité

- Ne jamais publier le bucket.
- Ne jamais exposer les clés S3 au navigateur.
- IAM Coffria limité à l'Object Storage du projet.
- URL signées courtes.
- MFA obligatoire pour les administrateurs.
- Mots de passe hachés en bcrypt/argon2.
- Validation stricte des fichiers et antivirus.
- Refus des extensions exécutables.
- Journalisation des actions sensibles.
- Assistance super-admin visible et auditée.
- Pentest avant ouverture commerciale.
- Politique de conservation et suppression contractualisée.
