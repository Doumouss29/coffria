import { Module } from '@nestjs/common';
import { LegalTermsController } from './legal-terms.controller';
import { PrismaService } from './prisma.service';

@Module({ controllers: [LegalTermsController], providers: [PrismaService] })
export class LegalTermsModule {}
