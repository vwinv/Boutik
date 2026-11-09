import { Body, Controller, Get, Post, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { AuthService } from "./auth.service";
import { RequireAudience } from "./decorators/audience.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { CustomerLoginDto, CustomerRegisterDto } from "./dto/customer-auth.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { SwitchTenantDto } from "./dto/switch-tenant.dto";
import {
  ForgotPasswordDto,
  LogoutDto,
  RefreshDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
  OnboardingActivityDto,
  OnboardingBusinessDto,
  OnboardingContentDto,
  OnboardingContractDto,
  OnboardingPreviewDto,
  OnboardingPublishDto,
  OnboardingTemplateDto,
  VerifyPhoneCodeDto,
  VerifyPhoneDto,
} from "./dto/token.dto";
import type { RequestUser } from "./auth.types";
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("pro/register")
  registerPro(@Body() body: RegisterDto) {
    return this.auth.registerPro(body);
  }

  @Public()
  @Post("pro/login")
  loginPro(@Body() body: LoginDto) {
    return this.auth.loginPro(body.email, body.password, body.tenantSlug);
  }

  @RequireAudience("pro")
  @Post("pro/switch")
  switchPro(@CurrentUser() user: RequestUser, @Body() body: SwitchTenantDto) {
    return this.auth.switchPro(user.id, body.tenantId);
  }

  @Public()
  @Post("staff/login")
  loginStaff(@Body() body: LoginDto) {
    return this.auth.loginStaff(body.email, body.password);
  }

  @Public()
  @Post("customers/register")
  registerCustomer(@Body() body: CustomerRegisterDto) {
    return this.auth.registerCustomer(body);
  }

  @Public()
  @Post("customers/login")
  loginCustomer(@Body() body: CustomerLoginDto) {
    return this.auth.loginCustomer(body.email, body.password, body.tenantSlug);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post("logout")
  logout(@Body() body: LogoutDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Post("logout-all")
  logoutAll(@CurrentUser() user: RequestUser) {
    return this.auth.logoutAll(user.id);
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Public()
  @Post("verify-email")
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @Post("resend-verification")
  resendVerification(@Body() body: ResendVerificationDto) {
    return this.auth.resendEmailVerification(body.email);
  }

  @Public()
  @Post("resend-phone")
  resendPhone(@Body() body: ResendVerificationDto) {
    return this.auth.resendPhoneCode(body.email);
  }

  @Public()
  @Post("phone-code-email")
  phoneCodeEmail(@Body() body: ResendVerificationDto) {
    return this.auth.sendPhoneCodeByEmail(body.email);
  }

  @Public()
  @Post("verify-phone-code")
  verifyPhoneCode(@Body() body: VerifyPhoneCodeDto) {
    return this.auth.verifyPhoneByEmail(body.email, body.code);
  }

  @Public()
  @Post("onboarding/activity")
  saveActivity(@Body() body: OnboardingActivityDto) {
    return this.auth.saveOnboardingActivity(body.email, body.category);
  }

  @Public()
  @Post("onboarding/business")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "logo", maxCount: 1 },
        { name: "cover", maxCount: 1 },
      ],
      { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } },
    ),
  )
  saveBusiness(
    @Body() body: OnboardingBusinessDto,
    @UploadedFiles() files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ) {
    return this.auth.saveOnboardingBusiness(body, {
      logo: files?.logo?.[0],
      cover: files?.cover?.[0],
    });
  }

  @Public()
  @Post("onboarding/contract")
  @UseInterceptors(FileInterceptor("signature", { storage: memoryStorage(), limits: { fileSize: 512 * 1024 } }))
  saveContract(@Body() body: OnboardingContractDto, @UploadedFile() signature: Express.Multer.File) {
    return this.auth.saveOnboardingContract(body.email, signature);
  }

  @Public()
  @Post("onboarding/template")
  saveTemplate(@Body() body: OnboardingTemplateDto) {
    return this.auth.saveOnboardingTemplate(body);
  }

  @Public()
  @Post("onboarding/content")
  saveContent(@Body() body: OnboardingContentDto) {
    return this.auth.saveOnboardingContent(body);
  }

  @Public()
  @Post("onboarding/preview")
  savePreview(@Body() body: OnboardingPreviewDto) {
    return this.auth.saveOnboardingPreview(body.email);
  }

  @Public()
  @Post("onboarding/publish")
  publish(@Body() body: OnboardingPublishDto) {
    return this.auth.publishOnboarding(body.email);
  }

  @Post("verify-phone")
  verifyPhone(@CurrentUser() user: RequestUser, @Body() body: VerifyPhoneDto) {
    if (!user.phone) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Aucun téléphone à vérifier");
    }
    return this.auth.verifyPhone(user.id, body.code);
  }
}
