import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class TermsDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(100) content!: string;
  @IsString() @MinLength(1) version!: string;
}

@Controller('legal-terms')
export class LegalTermsController {
  constructor(private db: PrismaService) {}

  private async readTerms() {
    const rows = await this.db.$queryRaw<Array<{id:string;title:string;content:string;version:string;updatedAt:Date}>>`
      SELECT "id", "title", "content", "version", "updatedAt"
      FROM "LegalTerms"
      WHERE "id" = 'cgv'
      LIMIT 1
    `;
    return rows[0] || null;
  }

  @Get('public')
  publicTerms() { return this.readTerms(); }

  @Get()
  @UseGuards(JwtGuard)
  terms(@Req() req:any) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.readTerms();
  }

  @Patch()
  @UseGuards(JwtGuard)
  async update(@Req() req:any, @Body() dto:TermsDto) {
    if (req.user?.role !== 'SUPER_ADMIN') throw new ForbiddenException();
    await this.db.$executeRaw`
      INSERT INTO "LegalTerms" ("id", "title", "content", "version", "updatedAt")
      VALUES ('cgv', ${dto.title.trim()}, ${dto.content.trim()}, ${dto.version.trim()}, NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "title" = EXCLUDED."title",
        "content" = EXCLUDED."content",
        "version" = EXCLUDED."version",
        "updatedAt" = NOW()
    `;
    return this.readTerms();
  }
}
