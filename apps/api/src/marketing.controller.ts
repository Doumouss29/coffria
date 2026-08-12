import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class OfferDto {
  @IsString() title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsString() description!: string;
  @IsOptional() @IsString() ctaLabel?: string;
  @IsOptional() @IsString() ctaUrl?: string;
  @IsOptional() @IsIn(['TOP', 'HOME', 'BOTH']) placement?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class PricingPlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() priceLabel?: string;
  @IsOptional() @IsInt() @Min(0) monthlyPriceCents?: number;
  @IsOptional() @IsInt() @Min(0) yearlyPriceCents?: number;
  @IsOptional() @IsInt() @Min(0) storageGb?: number;
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsArray() @IsString({ each: true }) features!: string[];
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsBoolean() isHighlighted?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

@Controller('marketing')
export class MarketingController {
  constructor(private db: PrismaService) {}

  private check(req: any) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  @Get('public/offers')
  async publicOffers() {
    const now = new Date();
    return this.db.marketingOffer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  @Get('public/plans')
  async publicPlans() {
    return this.db.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  @Get('offers')
  @UseGuards(JwtGuard)
  async offers(@Req() req: any) {
    this.check(req);
    return this.db.marketingOffer.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  @Post('offers')
  @UseGuards(JwtGuard)
  async createOffer(@Req() req: any, @Body() dto: OfferDto) {
    this.check(req);
    return this.db.marketingOffer.create({
      data: {
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        description: dto.description.trim(),
        ctaLabel: dto.ctaLabel?.trim() || "Découvrir l'offre",
        ctaUrl: dto.ctaUrl?.trim() || '/contact',
        placement: dto.placement || 'BOTH',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Patch('offers/:id')
  @UseGuards(JwtGuard)
  async updateOffer(@Req() req: any, @Param('id') id: string, @Body() dto: OfferDto) {
    this.check(req);
    return this.db.marketingOffer.update({
      where: { id },
      data: {
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        description: dto.description.trim(),
        ctaLabel: dto.ctaLabel?.trim() || "Découvrir l'offre",
        ctaUrl: dto.ctaUrl?.trim() || '/contact',
        placement: dto.placement || 'BOTH',
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Delete('offers/:id')
  @UseGuards(JwtGuard)
  async deleteOffer(@Req() req: any, @Param('id') id: string) {
    this.check(req);
    await this.db.marketingOffer.delete({ where: { id } });
    return { success: true };
  }

  @Get('plans')
  @UseGuards(JwtGuard)
  async plans(@Req() req: any) {
    this.check(req);
    return this.db.pricingPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  @Post('plans')
  @UseGuards(JwtGuard)
  async createPlan(@Req() req: any, @Body() dto: PricingPlanDto) {
    this.check(req);
    const slug = this.slugify(dto.slug || dto.name);
    return this.db.pricingPlan.create({
      data: {
        name: dto.name.trim(),
        slug,
        subtitle: dto.subtitle?.trim() || null,
        priceLabel: dto.priceLabel?.trim() || 'Sur devis',
        monthlyPriceCents: dto.monthlyPriceCents ?? null,
        yearlyPriceCents: dto.yearlyPriceCents ?? null,
        storageGb: dto.storageGb ?? null,
        maxUsers: dto.maxUsers ?? null,
        features: dto.features.map((item) => item.trim()).filter(Boolean),
        badge: dto.badge?.trim() || null,
        isHighlighted: dto.isHighlighted ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Patch('plans/:id')
  @UseGuards(JwtGuard)
  async updatePlan(@Req() req: any, @Param('id') id: string, @Body() dto: PricingPlanDto) {
    this.check(req);
    const slug = this.slugify(dto.slug || dto.name);
    return this.db.pricingPlan.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        slug,
        subtitle: dto.subtitle?.trim() || null,
        priceLabel: dto.priceLabel?.trim() || 'Sur devis',
        monthlyPriceCents: dto.monthlyPriceCents ?? null,
        yearlyPriceCents: dto.yearlyPriceCents ?? null,
        storageGb: dto.storageGb ?? null,
        maxUsers: dto.maxUsers ?? null,
        features: dto.features.map((item) => item.trim()).filter(Boolean),
        badge: dto.badge?.trim() || null,
        isHighlighted: dto.isHighlighted ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Delete('plans/:id')
  @UseGuards(JwtGuard)
  async deletePlan(@Req() req: any, @Param('id') id: string) {
    this.check(req);
    await this.db.pricingPlan.delete({ where: { id } });
    return { success: true };
  }
}
