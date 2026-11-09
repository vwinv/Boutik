import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  ChangePlanDto,
  DeclarePaymentDto,
  PaymentParamDto,
  ReceiptParamDto,
  WorkspaceIdParamDto,
} from "./dto/billing.dto";
import { BillingService } from "./billing.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get(":id/subscription/overview")
  overview(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.billing.overviewForMember(user.id, params.id);
  }

  @Get(":id/subscription")
  current(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.billing.currentForMember(user.id, params.id);
  }

  @Get(":id/subscriptions")
  history(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.billing.historyForMember(user.id, params.id);
  }

  @Post(":id/subscription/change-plan")
  changePlan(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: ChangePlanDto,
  ) {
    return this.billing.changePlanForMember(user.id, params.id, body);
  }

  @Post(":id/subscription/renew")
  renew(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: DeclarePaymentDto,
  ) {
    return this.billing.renewForMember(user.id, params.id, body);
  }

  @Post(":id/subscription/payments")
  declare(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: DeclarePaymentDto) {
    return this.billing.declarePayment(user.id, params.id, body);
  }

  @Post(":id/subscription/payments/:paymentId/receipt")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }))
  addReceipt(
    @CurrentUser() user: RequestUser,
    @Param() params: PaymentParamDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Un justificatif est requis");
    }
    return this.billing.addReceipt(params.id, params.paymentId, file, "pro", user.id);
  }

  @Get(":id/subscription/payments/:paymentId/receipts/:receiptId/file")
  file(@CurrentUser() user: RequestUser, @Param() params: ReceiptParamDto) {
    return this.billing.downloadReceipt(params.id, params.paymentId, params.receiptId, user.id);
  }
}
