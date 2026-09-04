import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { ExplorerController } from './explorer.controller';
import { StorageService } from './storage.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { TenantsController } from './tenants.controller';
import { HealthController } from './health.controller';
import { TrashController } from './trash.controller';
import { UsersController } from './users.controller';
import { DashboardController } from './dashboard.controller';
import { SettingsController } from './settings.controller';
import { SuperAdminsController } from './superadmins.controller';
import { GroupsController } from './groups.controller';
import { MarketingController } from './marketing.controller';
import { LegalTermsModule } from './legal-terms.module';
import { ContactController } from './contact.controller';
import { PreviewController } from './preview.controller';
import { BulkController } from './bulk.controller';
import { SignaturesController } from './signatures.controller';
import { DirectSignatureController } from './direct-signature.controller';
import { SignatureSubscriptionController } from './signature-subscription.controller';
import { SignatureWorkspaceController } from './signature-workspace.controller';
import { AiController } from './ai.controller';
import { AnalyticsController } from './analytics.controller';
import { StorageAllocationController } from './storage-allocation.controller';
import { WorkspaceActionsController } from './workspace-actions.controller';
import { TenantBrandingController } from './tenant-branding.controller';
import { ArchiveAiService } from './archive-ai.service';
import { DocumentConversionService } from './document-conversion.service';
import { UploadCleanupService } from './upload-cleanup.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any },
    }),
    LegalTermsModule,
  ],
  controllers: [
    AuthController,
    ExplorerController,
    SearchController,
    TenantsController,
    HealthController,
    TrashController,
    UsersController,
    DashboardController,
    SettingsController,
    SuperAdminsController,
    GroupsController,
    MarketingController,
    ContactController,
    PreviewController,
    BulkController,
    SignaturesController,
    DirectSignatureController,
    SignatureSubscriptionController,
    SignatureWorkspaceController,
    AiController,
    AnalyticsController,
    StorageAllocationController,
    WorkspaceActionsController,
    TenantBrandingController,
  ],
  providers: [
    PrismaService,
    AuthService,
    JwtGuard,
    StorageService,
    SearchService,
    ArchiveAiService,
    DocumentConversionService,
    UploadCleanupService,
  ],
})
export class AppModule {}
