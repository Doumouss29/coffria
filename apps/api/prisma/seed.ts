import { PrismaClient, PlatformRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD || 'Coffria!2026';
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const lmurbs = await prisma.tenant.upsert({
    where: { slug: 'lmurbs' },
    update: { name: 'LMurbs' },
    create: {
      name: 'LMurbs',
      slug: 'lmurbs',
      storageQuotaBytes: 107374182400n,
      maxUsers: 10,
    },
  });

  const cabinet = await prisma.tenant.upsert({
    where: { slug: 'cabinet-demo' },
    update: {},
    create: {
      name: 'Cabinet Démonstration',
      slug: 'cabinet-demo',
      storageQuotaBytes: 53687091200n,
      maxUsers: 20,
    },
  });

  const users = [
    ['Super Administrateur', 'superadmin@coffria.local', PlatformRole.SUPER_ADMIN, lmurbs.id, true],
    ['Admin Cabinet', 'admin@cabinet.local', PlatformRole.TENANT_ADMIN, cabinet.id, true],
    ['Utilisateur Modification', 'editor@cabinet.local', PlatformRole.EDITOR, cabinet.id, false],
    ['Utilisateur Consultation', 'viewer@cabinet.local', PlatformRole.VIEWER, cabinet.id, false],
  ] as const;

  for (const [name, email, role, tenantId, mfaEnabled] of users) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, tenantId, passwordHash },
      create: { name, email, role, tenantId, passwordHash, mfaEnabled },
    });
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@cabinet.local' } });
  const root =
    (await prisma.folder.findFirst({ where: { tenantId: cabinet.id, parentId: null, name: 'Affaires 2026' } })) ??
    (await prisma.folder.create({ data: { tenantId: cabinet.id, name: 'Affaires 2026', createdById: admin.id } }));

  for (const name of ['Plans', 'Documents administratifs', 'Dossiers clôturés']) {
    await prisma.folder.upsert({
      where: { tenantId_parentId_name: { tenantId: cabinet.id, parentId: root.id, name } },
      update: {},
      create: { tenantId: cabinet.id, parentId: root.id, name, createdById: admin.id },
    });
  }

  console.log('Seed terminé. Comptes de démonstration créés.');
}

main().finally(() => prisma.$disconnect());
