import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { StaffRoles } from "../auth/decorators/staff-roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  AssignSubscriptionDto,
  PaymentParamDto,
  ReceiptParamDto,
  RecordPaymentDto,
  RenewSubscriptionDto,
  UpdatePaymentStatusDto,
  UpdateSubscriptionPeriodDto,
  WorkspaceIdParamDto,
} from "./dto/billing.dto";
import { BillingService } from "./billing.service";

@Controller("admin/tenants")
@RequireAudience("staff")
@StaffRoles("SUPPORT")
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get(":id/subscription")
  current(@Param() params: WorkspaceIdParamDto) {
    return this.billing.currentForStaff(params.id);
  }

  @Get(":id/subscriptions")
  history(@Param() params: WorkspaceIdParamDto) {
    return this.billing.historyForStaff(params.id);
  }

  @Post(":id/subscription")
  @StaffRoles("ADMIN")
  assign(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: AssignSubscriptionDto) {
    return this.billing.assign(params.id, body, user.id);
  }

  @Patch(":id/subscription")
  @StaffRoles("ADMIN")
  updatePeriod(@Param() params: WorkspaceIdParamDto, @Body() body: UpdateSubscriptionPeriodDto) {
    return this.billing.updatePeriod(params.id, body);
  }

  @Post(":id/subscription/renew")
  @StaffRoles("ADMIN")
  renew(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: RenewSubscriptionDto) {
    return this.billing.renew(params.id, body, user.id);
  }

  @Post(":id/subscription/payments")
  @StaffRoles("ADMIN")
  recordPayment(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: RecordPaymentDto) {
    return this.billing.recordPayment(params.id, body, user.id);
  }

  @Patch(":id/subscription/payments/:paymentId")
  @StaffRoles("ADMIN")
  setStatus(@Param() params: PaymentParamDto, @Body() body: UpdatePaymentStatusDto) {
    return this.billing.setPaymentStatus(params.id, params.paymentId, body);
  }

  @Post(":id/subscription/payments/:paymentId/receipt")
  @StaffRoles("ADMIN")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  addReceipt(@Param() params: PaymentParamDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Un justificatif est requis");
    }
    return this.billing.addReceipt(params.id, params.paymentId, file, "staff");
  }

  @Get(":id/subscription/payments/:paymentId/receipts/:receiptId/file")
  file(@Param() params: ReceiptParamDto) {
    return this.billing.downloadReceipt(params.id, params.paymentId, params.receiptId);
  }
}
