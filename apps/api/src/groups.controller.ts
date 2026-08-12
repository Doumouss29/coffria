import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class GroupDto {
  @IsString() name!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
}

@Controller('groups')
@UseGuards(JwtGuard)
export class GroupsController {
  constructor(private db: PrismaService) {}
  private tenant(req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }
  private canManage(req: any) {
    if (!['TENANT_ADMIN', 'EDITOR'].includes(req.user.role)) throw new ForbiddenException('Action réservée aux administrateurs et éditeurs');
  }

  @Get()
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    return this.db.group.findMany({
      where: { tenantId }, orderBy: { name: 'asc' },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } } } },
    });
  }

  @Get('options')
  async options(@Req() req: any) {
    this.canManage(req);
    const tenantId = this.tenant(req);
    const [users, groups] = await Promise.all([
      this.db.user.findMany({ where: { tenantId, status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true } }),
      this.db.group.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, _count: { select: { members: true } } } }),
    ]);
    return { users, groups };
  }

  @Post()
  async create(@Req() req: any, @Body() dto: GroupDto) {
    this.canManage(req); const tenantId = this.tenant(req); const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nom du groupe requis');
    const ids = [...new Set(dto.userIds || [])];
    if (ids.length) {
      const count = await this.db.user.count({ where: { id: { in: ids }, tenantId } });
      if (count !== ids.length) throw new BadRequestException('Un utilisateur sélectionné est invalide');
    }
    return this.db.group.create({ data: { tenantId, name, members: { create: ids.map(userId => ({ userId })) } }, include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } } } } });
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: GroupDto) {
    this.canManage(req); const tenantId = this.tenant(req);
    const group = await this.db.group.findFirst({ where: { id, tenantId } });
    if (!group) throw new BadRequestException('Groupe introuvable');
    const ids = [...new Set(dto.userIds || [])];
    const count = ids.length ? await this.db.user.count({ where: { id: { in: ids }, tenantId } }) : 0;
    if (count !== ids.length) throw new BadRequestException('Un utilisateur sélectionné est invalide');
    return this.db.$transaction(async tx => {
      await tx.groupMember.deleteMany({ where: { groupId: id } });
      return tx.group.update({ where: { id }, data: { name: dto.name.trim(), members: { create: ids.map(userId => ({ userId })) } }, include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } } } } });
    });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    this.canManage(req); const tenantId = this.tenant(req);
    const group = await this.db.group.findFirst({ where: { id, tenantId } });
    if (!group) throw new BadRequestException('Groupe introuvable');
    await this.db.group.delete({ where: { id } }); return { success: true };
  }
}
