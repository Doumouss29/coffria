import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class CreateSuperAdminDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
}

@Controller('superadmins')
@UseGuards(JwtGuard)
export class SuperAdminsController {
  constructor(private db: PrismaService) {}
  private check(req: any) { if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException(); }

  @Get()
  list(@Req() req: any) {
    this.check(req);
    return this.db.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateSuperAdminDto) {
    this.check(req);
    return this.db.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    this.check(req);
    if (id === req.user.sub) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    const count = await this.db.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    if (count <= 1) throw new BadRequestException('Au moins un Super Admin doit rester actif.');
    await this.db.user.delete({ where: { id } });
    return { success: true };
  }
}
