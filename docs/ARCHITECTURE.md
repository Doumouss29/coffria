# Architecture cible

```text
Navigateur
  └─ Next.js
      └─ API NestJS
          ├─ PostgreSQL
          ├─ Redis / workers
          ├─ Scaleway Object Storage
          └─ services OCR / antivirus / IA
```

## Multi-tenant
Toutes les tables métier portent `tenantId`. Les contrôles sont appliqués dans les services. En production, ajouter PostgreSQL Row-Level Security comme seconde barrière.

## Stockage
- bucket privé : `coffria-production` ;
- endpoint SDK : `https://s3.fr-par.scw.cloud` ;
- région : `fr-par` ;
- préfixe : `tenants/{tenant_uuid}/...` ;
- versioning S3 90 jours ;
- multipart incomplets 7 jours.

## Recherche industrielle
Phase cible : extraction Apache Tika/LibreOffice, OCR Tesseract, index plein texte PostgreSQL, pgvector pour similarité, fusion hybride des scores. OpenSearch pourra remplacer l'index lorsque le volume le justifiera.
