import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { getJwtAccessSecret, getJwtAccessTtlSeconds } from "@boutik/config";
import { SubscriptionLifecycleModule } from "../billing/subscription-lifecycle.module";
import { SmsModule } from "../sms/sms.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { AudienceGuard } from "./guards/audience.guard";
import { StaffRolesGuard } from "./guards/staff-roles.guard";
import { CloudinaryMediaStorage } from "../professionals/cloudinary-media.storage";
import { DocumentsStorage } from "../professionals/documents.storage";
import { MailerService } from "./mailer.service";
import { NotificationService } from "./notification.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: getJwtAccessSecret(),
        signOptions: { expiresIn: getJwtAccessTtlSeconds() },
      }),
    }),
    SubscriptionLifecycleModule,
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailerService,
    NotificationService,
    DocumentsStorage,
    CloudinaryMediaStorage,
    AuthGuard,
    AudienceGuard,
    StaffRolesGuard,
  ],
  exports: [AuthService, NotificationService, JwtModule, AuthGuard, AudienceGuard, StaffRolesGuard],
})
export class AuthModule {}
