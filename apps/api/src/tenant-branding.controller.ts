import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

const DEFAULT_BRANDING = {
  isEnabled: false,
  appName: 'Coffria',
  customDomain: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#14213D',
  accentColor: '#C97A3D',
  backgroundColor: '#F5F1EA',
  loginTitle: 'Votre patrimoine documentaire, sécurisé et maîtrisé',
  loginSubtitle: 'Votre espace documentaire sécurisé et intelligent',
  poweredByCoffria: true,
};

const BRANDING_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'] as const;

class UpdateTenantBrandingDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsString() @MaxLength(80) appName?: string;
  @IsOptional() @IsString() @MaxLength(255) customDomain?: string;
  @IsOptional() @IsString() @MaxLength(2000) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) faviconUrl?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) primaryColor?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) accentColor?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) backgroundColor?: string;
  @IsOptional() @IsString() @MaxLength(140) loginTitle?: string;
  @IsOptional() @IsString() @MaxLength(300) loginSubtitle?: string;
  @IsOptional() @IsBoolean() poweredByCoffria?: boolean;
}

class BrandingAssetUploadDto {
  @IsIn(['logo', 'favicon']) kind!: 'logo' | 'favicon';
  @IsIn(BRANDING_MIMES as unknown as string[]) mime!: string;
  @IsInt() @Min(1) @Max(5 * 1024 * 1024) size!: number;
}

@Controller('tenant-branding')
export class TenantBrandingController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private check(req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
  }

  private cleanText(value?: string | null) {
    const clean = value?.trim();
    return clean ? clean : null;
  }

  private normalizeDomain(value?: string | null) {
    const clean = this.cleanText(value);
    if (!clean) return null;
    const domain = clean.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
    if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      throw new BadRequestException('Domaine personnalisé invalide. Exemple : archives.client.com');
    }
    return domain;
  }

  private effective(row: any | null, tenantId?: string | null) {
    const enabled = Boolean(row?.isEnabled);
    const custom = enabled ? row : null;
    return {
      tenantId: tenantId || null,
      ...DEFAULT_BRANDING,
      ...(custom || {}),
      isEnabled: enabled,
      effective: enabled ? 'CUSTOM' : 'COFFRIA',
    };
  }

  private assetKey(tenantId: string, kind: 'logo' | 'favicon') {
    return `branding/${tenantId}/${kind}`;
  }

  @Get('public/resolve')
  async resolvePublic(@Query('host') host?: string) {
    const cleanHost = String(host || '').trim().toLowerCase().split(':')[0].replace(/\.$/, '');
    if (!cleanHost) return this.effective(null, null);
    const row = await this.db.tenantBranding.findFirst({
      where: { customDomain: cleanHost, isEnabled: true },
    });
    return this.effective(row, row?.tenantId || null);
  }

  @Get('assets/:tenantId/:kind')
  async asset(@Param('tenantId') tenantId: string, @Param('kind') kind: string, @Res() res: any) {
    if (kind !== 'logo' && kind !== 'favicon') throw new BadRequestException('Type de ressource invalide');
    const row = await this.db.tenantBranding.findUnique({ where: { tenantId }, select: { isEnabled: true } });
    if (!row?.isEnabled) return res.status(404).send('Ressource introuvable');
    try {
      await this.storage.head(this.assetKey(tenantId, kind));
      const url = await this.storage.downloadUrl(this.assetKey(tenantId, kind), 'inline');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.redirect(302, url);
    } catch {
      return res.status(404).send('Ressource introuvable');
    }
  }

  @Get('current')
  @UseGuards(JwtGuard)
  async current(@Req() req: any) {
    if (req.user?.role === 'SUPER_ADMIN' || !req.user?.tenantId) return this.effective(null, null);
    const row = await this.db.tenantBranding.findUnique({ where: { tenantId: req.user.tenantId } });
    return this.effective(row, req.user.tenantId);
  }

  @Get(':tenantId')
  @UseGuards(JwtGuard)
  async get(@Req() req: any, @Param('tenantId') tenantId: string) {
    this.check(req);
    await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });
    const row = await this.db.tenantBranding.findUnique({ where: { tenantId } });
    return this.effective(row, tenantId);
  }

  @Post(':tenantId/asset-upload')
  @UseGuards(JwtGuard)
  async prepareAssetUpload(@Req() req: any, @Param('tenantId') tenantId: string, @Body() dto: BrandingAssetUploadDto) {
    this.check(req);
    await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });
    if (dto.kind === 'favicon' && !['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(dto.mime)) {
      throw new BadRequestException('Le favicon doit être un fichier PNG ou ICO.');
    }
    const key = this.assetKey(tenantId, dto.kind);
    const uploadUrl = await this.storage.uploadUrl(key, dto.mime);
    return {
      uploadUrl,
      assetUrl: `/api/tenant-branding/assets/${tenantId}/${dto.kind}?v=${Date.now()}`,
      maxBytes: 5 * 1024 * 1024,
    };
  }

  @Patch(':tenantId')
  @UseGuards(JwtGuard)
  async update(@Req() req: any, @Param('tenantId') tenantId: string, @Body() dto: UpdateTenantBrandingDto) {
    this.check(req);
    await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });
    const customDomain = dto.customDomain !== undefined ? this.normalizeDomain(dto.customDomain) : undefined;
    if (customDomain) {
      const existing = await this.db.tenantBranding.findFirst({ where: { customDomain, tenantId: { not: tenantId } }, select: { tenantId: true } });
      if (existing) throw new BadRequestException('Ce domaine personnalisé est déjà affecté à une autre entreprise.');
    }
    const data: any = {};
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.appName !== undefined) data.appName = this.cleanText(dto.appName);
    if (dto.customDomain !== undefined) data.customDomain = customDomain;
    if (dto.logoUrl !== undefined) data.logoUrl = this.cleanText(dto.logoUrl);
    if (dto.faviconUrl !== undefined) data.faviconUrl = this.cleanText(dto.faviconUrl);
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor.toUpperCase();
    if (dto.accentColor !== undefined) data.accentColor = dto.accentColor.toUpperCase();
    if (dto.backgroundColor !== undefined) data.backgroundColor = dto.backgroundColor.toUpperCase();
    if (dto.loginTitle !== undefined) data.loginTitle = this.cleanText(dto.loginTitle);
    if (dto.loginSubtitle !== undefined) data.loginSubtitle = this.cleanText(dto.loginSubtitle);
    if (dto.poweredByCoffria !== undefined) data.poweredByCoffria = dto.poweredByCoffria;

    const row = await this.db.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    return this.effective(row, tenantId);
  }
}
