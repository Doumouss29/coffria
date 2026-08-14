import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

type GeoInfo = {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

@Controller('analytics')
export class AnalyticsController {
  constructor(private db: PrismaService) {}

  private publicPath(path: string) {
    if (path === '/') return true;
    return ['/offres', '/souscription', '/tarifs', '/contact', '/conditions', '/connexion'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  }

  private clientIp(req: any) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const real = String(req.headers['x-real-ip'] || '').trim();
    return forwarded || real || req.ip || '';
  }

  private isPublicIp(ip: string) {
    if (!ip) return false;
    const clean = ip.replace(/^::ffff:/, '');
    return !(
      clean === '::1' || clean === '127.0.0.1' || clean.startsWith('10.') || clean.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(clean) || clean.startsWith('fc') || clean.startsWith('fd')
    );
  }

  private emptyGeo(): GeoInfo {
    return { country: null, countryCode: null, region: null, city: null, timezone: null, latitude: null, longitude: null };
  }

  private async geoFor(visitorId: string, ip: string): Promise<GeoInfo> {
    const existing = await this.db.$queryRaw<any[]>(Prisma.sql`
      SELECT country, country_code AS "countryCode", region, city, timezone, latitude, longitude
      FROM site_analytics_events
      WHERE visitor_id = ${visitorId} AND country IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `);
    if (existing[0]) return existing[0];
    if (!this.isPublicIp(ip)) return this.emptyGeo();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?lang=fr`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error('geo lookup failed');
      const data: any = await response.json();
      if (!data?.success) throw new Error('geo lookup unavailable');
      return {
        country: data.country || null,
        countryCode: data.country_code || null,
        region: data.region || null,
        city: data.city || null,
        timezone: data.timezone?.id || null,
        latitude: Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
        longitude: Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
      };
    } catch {
      return this.emptyGeo();
    }
  }

  @Post('track')
  async track(@Req() req: any, @Body() body: any) {
    const eventType = String(body?.eventType || '').toUpperCase();
    const visitorId = String(body?.visitorId || '').slice(0, 100);
    const sessionId = String(body?.sessionId || '').slice(0, 100);
    const path = String(body?.path || '').split('?')[0].slice(0, 500);
    if (!['PAGE_VIEW', 'CLICK'].includes(eventType) || !visitorId || !sessionId || !this.publicPath(path)) return { tracked: false };

    const target = body?.target ? String(body.target).slice(0, 500) : null;
    const label = body?.label ? String(body.label).trim().replace(/\s+/g, ' ').slice(0, 300) : null;
    const referrer = body?.referrer ? String(body.referrer).slice(0, 2000) : null;
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000) || null;
    const ip = this.clientIp(req).replace(/^::ffff:/, '');
    const salt = process.env.ANALYTICS_IP_SALT || process.env.JWT_SECRET || 'coffria-analytics';
    const ipHash = ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex') : null;
    const geo = await this.geoFor(visitorId, ip);

    await this.db.$executeRaw(Prisma.sql`
      INSERT INTO site_analytics_events
        (event_type, visitor_id, session_id, path, target, label, referrer, country, country_code, region, city, timezone, latitude, longitude, ip_hash, user_agent)
      VALUES
        (${eventType}, ${visitorId}, ${sessionId}, ${path}, ${target}, ${label}, ${referrer}, ${geo.country}, ${geo.countryCode}, ${geo.region}, ${geo.city}, ${geo.timezone}, ${geo.latitude}, ${geo.longitude}, ${ipHash}, ${userAgent})
    `);
    return { tracked: true };
  }

  private parseRange(from?: string, to?: string) {
    const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 6 * 86400000);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error('Période invalide');
    return { start, end };
  }

  @Get('summary')
  @UseGuards(JwtGuard)
  async summary(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('country') country?: string,
    @Query('region') region?: string,
    @Query('city') city?: string,
  ) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    const { start, end } = this.parseRange(from, to);
    const selectedCountry = String(country || '').slice(0, 120);
    const selectedRegion = String(region || '').slice(0, 160);
    const selectedCity = String(city || '').slice(0, 160);
    const days = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    const bucket = days <= 2 ? 'hour' : days <= 120 ? 'day' : 'month';
    const bucketSql = Prisma.raw(`date_trunc('${bucket}', created_at)`);
    const filter = Prisma.sql`
      created_at BETWEEN ${start} AND ${end}
      ${selectedCountry ? Prisma.sql`AND country = ${selectedCountry}` : Prisma.empty}
      ${selectedRegion ? Prisma.sql`AND region = ${selectedRegion}` : Prisma.empty}
      ${selectedCity ? Prisma.sql`AND city = ${selectedCity}` : Prisma.empty}
    `;

    const [totals, pages, clicks, countries, cities, series, hours, recentVisits, locationOptions] = await Promise.all([
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS "pageViews",
          COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS "uniqueVisitors",
          COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS sessions,
          COUNT(*) FILTER (WHERE event_type = 'CLICK')::int AS clicks
        FROM site_analytics_events WHERE ${filter}
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM site_analytics_events WHERE event_type = 'PAGE_VIEW' AND ${filter}
        GROUP BY path ORDER BY views DESC LIMIT 15
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT COALESCE(NULLIF(label,''), target, path) AS label, target, path, COUNT(*)::int AS clicks
        FROM site_analytics_events WHERE event_type = 'CLICK' AND ${filter}
        GROUP BY COALESCE(NULLIF(label,''), target, path), target, path ORDER BY clicks DESC LIMIT 15
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT COALESCE(country,'Inconnu') AS country, country_code AS "countryCode", COUNT(DISTINCT visitor_id)::int AS visitors,
          AVG(latitude) AS latitude, AVG(longitude) AS longitude
        FROM site_analytics_events WHERE event_type = 'PAGE_VIEW' AND ${filter}
        GROUP BY country, country_code ORDER BY visitors DESC LIMIT 20
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT COALESCE(city,'Inconnue') AS city, COALESCE(country,'Inconnu') AS country, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM site_analytics_events WHERE event_type = 'PAGE_VIEW' AND ${filter}
        GROUP BY city, country ORDER BY visitors DESC LIMIT 20
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT ${bucketSql} AS bucket,
          COUNT(*) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS views,
          COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS visitors,
          COUNT(*) FILTER (WHERE event_type = 'CLICK')::int AS clicks
        FROM site_analytics_events WHERE ${filter}
        GROUP BY ${bucketSql} ORDER BY bucket ASC
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE COALESCE(NULLIF(timezone,''),'UTC')))::int AS hour,
          COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM site_analytics_events WHERE event_type = 'PAGE_VIEW' AND ${filter}
        GROUP BY hour ORDER BY hour ASC
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT path, country, region, city, COALESCE(timezone,'UTC') AS timezone, created_at AS "createdAt",
          to_char(created_at AT TIME ZONE COALESCE(NULLIF(timezone,''),'UTC'), 'DD/MM/YYYY HH24:MI:SS') AS "localTime"
        FROM site_analytics_events WHERE event_type = 'PAGE_VIEW' AND ${filter}
        ORDER BY created_at DESC LIMIT 30
      `),
      this.db.$queryRaw<any[]>(Prisma.sql`
        SELECT country, region, city, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM site_analytics_events
        WHERE event_type = 'PAGE_VIEW' AND created_at BETWEEN ${start} AND ${end} AND country IS NOT NULL
        GROUP BY country, region, city ORDER BY country, region, city
      `),
    ]);

    return {
      range: { from: start.toISOString(), to: end.toISOString(), bucket },
      filters: { country: selectedCountry, region: selectedRegion, city: selectedCity },
      totals: totals[0] || { pageViews: 0, uniqueVisitors: 0, sessions: 0, clicks: 0 },
      pages,
      clicks,
      geography: { countries, cities },
      series,
      hours,
      recentVisits,
      locationOptions,
    };
  }
}
