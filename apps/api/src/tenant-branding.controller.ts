import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

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
  loginSubtitle: null,
  poweredByCoffria: true,
};

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

@Controller('tenant-branding')
@UseGuards(JwtGuard)
export class TenantBrandingController {
  constructor(private db: PrismaService) {}

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

  private effective(row: any | null, tenantId: string) {
    return {
      tenantId,
      ...DEFAULT_BRANDING,
      ...(row || {}),
      effective: row?.isEnabled ? 'CUSTOM' : 'COFFRIA',
    };
  }

  @Get(':tenantId')
  async get(@Req() req: any, @Param('tenantId') tenantId: string) {
    this.check(req);
    await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });
    const row = await this.db.tenantBranding.findUnique({ where: { tenantId } });
    return this.effective(row, tenantId);
  }

  @Patch(':tenantId')
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
