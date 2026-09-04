import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
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

const MAX_BRANDING_ASSET_BYTES = 5 * 1024 * 1024;
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
  @IsInt() @Min(1) @Max(MAX_BRANDING_ASSET_BYTES) size!: number;
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

  private assetUrl(tenantId: string, kind: 'logo' | 'favicon') {
    return `/api/tenant-branding/assets/${tenantId}/${kind}?v=${Date.now()}`;
  }

  private allowedMime(kind: 'logo' | 'favicon', mime: string) {
    const normalized = String(mime || '').split(';')[0].trim().toLowerCase();
    if (kind === 'favicon') return ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(normalized);
    return ['image/png', 'image/jpeg', 'image/webp'].includes(normalized);
  }

  private privateAddress(address: string) {
    const value = address.toLowerCase();
    if (value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    const ipv4 = mapped || (isIP(value) === 4 ? value : null);
    if (!ipv4) return false;
    const parts = ipv4.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168);
  }

  private async validateRemoteUrl(raw: string) {
    let url: URL;
    try { url = new URL(raw); } catch { throw new BadRequestException('URL d’image invalide.'); }
    if (url.protocol !== 'https:') throw new BadRequestException('L’URL de l’image doit utiliser HTTPS.');
    if (!url.hostname || url.username || url.password) throw new BadRequestException('URL d’image invalide.');
    if (isIP(url.hostname)) {
      if (this.privateAddress(url.hostname)) throw new BadRequestException('Cette adresse d’image n’est pas autorisée.');
    } else {
      const addresses = await lookup(url.hostname, { all: true });
      if (!addresses.length || addresses.some((item) => this.privateAddress(item.address))) {
        throw new BadRequestException('Cette adresse d’image n’est pas autorisée.');
      }
    }
    return url;
  }

  private async importRemoteAsset(tenantId: string, kind: 'logo' | 'favicon', rawUrl: string) {
    let url = await this.validateRemoteUrl(rawUrl);
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Coffria-Branding/1.0', Accept: 'image/*' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new BadRequestException('Trop de redirections pour cette image.');
        url = await this.validateRemoteUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new BadRequestException(`Impossible de récupérer l’image distante (${response.status}).`);
      const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!this.allowedMime(kind, mime)) {
        throw new BadRequestException(kind === 'logo' ? 'L’URL doit pointer vers une image PNG, JPG ou WebP.' : 'L’URL doit pointer vers un favicon PNG ou ICO.');
      }
      const announced = Number(response.headers.get('content-length') || 0);
      if (announced > MAX_BRANDING_ASSET_BYTES) throw new BadRequestException('L’image distante dépasse 5 Mo.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BRANDING_ASSET_BYTES) throw new BadRequestException('L’image distante est vide ou dépasse 5 Mo.');
      await this.storage.putBuffer(this.assetKey(tenantId, kind), bytes, mime);
      return this.assetUrl(tenantId, kind);
    }
    throw new BadRequestException('Impossible de récupérer cette image.');
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

  @Put('asset-upload-proxy/:tenantId/:kind')
  @UseGuards(JwtGuard)
  async uploadAssetProxy(@Req() req: any, @Param('tenantId') tenantId: string, @Param('kind') kindParam: string) {
    this.check(req);
    if (kindParam !== 'logo' && kindParam !== 'favicon') throw new BadRequestException('Type de ressource invalide');
    const kind = kindParam as 'logo' | 'favicon';
    await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!this.allowedMime(kind, mime)) {
      throw new BadRequestException(kind === 'logo' ? 'Le logo doit être au format PNG, JPG ou WebP.' : 'Le favicon doit être au format PNG ou ICO.');
    }
    const announced = Number(req.headers['content-length'] || 0);
    if (announced > MAX_BRANDING_ASSET_BYTES) throw new BadRequestException('Le fichier doit faire moins de 5 Mo.');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_BRANDING_ASSET_BYTES) throw new BadRequestException('Le fichier doit faire moins de 5 Mo.');
      chunks.push(buffer);
    }
    if (!total) throw new BadRequestException('Le fichier est vide.');
    await this.storage.putBuffer(this.assetKey(tenantId, kind), Buffer.concat(chunks), mime);
    return { assetUrl: this.assetUrl(tenantId, kind) };
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
    if (!this.allowedMime(dto.kind, dto.mime)) {
      throw new BadRequestException(dto.kind === 'logo' ? 'Le logo doit être au format PNG, JPG ou WebP.' : 'Le favicon doit être au format PNG ou ICO.');
    }
    return {
      uploadUrl: `/api/tenant-branding/asset-upload-proxy/${tenantId}/${dto.kind}`,
      assetUrl: this.assetUrl(tenantId, dto.kind),
      maxBytes: MAX_BRANDING_ASSET_BYTES,
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

    let logoUrl = dto.logoUrl !== undefined ? this.cleanText(dto.logoUrl) : undefined;
    let faviconUrl = dto.faviconUrl !== undefined ? this.cleanText(dto.faviconUrl) : undefined;
    if (logoUrl && /^https:\/\//i.test(logoUrl)) logoUrl = await this.importRemoteAsset(tenantId, 'logo', logoUrl);
    if (faviconUrl && /^https:\/\//i.test(faviconUrl)) faviconUrl = await this.importRemoteAsset(tenantId, 'favicon', faviconUrl);

    const data: any = {};
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.appName !== undefined) data.appName = this.cleanText(dto.appName);
    if (dto.customDomain !== undefined) data.customDomain = customDomain;
    if (dto.logoUrl !== undefined) data.logoUrl = logoUrl;
    if (dto.faviconUrl !== undefined) data.faviconUrl = faviconUrl;
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
