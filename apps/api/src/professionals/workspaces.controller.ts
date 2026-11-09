import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { API_ERROR_CODES } from "@boutik/domain";
import { ApiException } from "../common/api-exception";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { DocumentParamDto, IdParamDto, NotificationParamDto, SupportTicketParamDto } from "./dto/id.param";
import { CreateSupportTicketDto, ReplySupportTicketDto } from "./dto/support-ticket.dto";
import { UpdateOfferingDto } from "../catalog/dto/admin-catalog.dto";
import { RestockDto, RestockParamDto } from "./dto/restock.dto";
import { WalletWithdrawDto } from "./dto/wallet-withdraw.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.workspaces.listMine(user.id);
  }

  @Get(":id/dashboard")
  dashboard(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.dashboard(user.id, params.id);
  }

  @Get(":id/customers")
  customers(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.listCustomers(user.id, params.id);
  }

  @Get(":id/stock")
  stock(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.listStock(user.id, params.id);
  }

  @Post(":id/stock/:productId/restock")
  restock(
    @CurrentUser() user: RequestUser,
    @Param() params: RestockParamDto,
    @Body() body: RestockDto,
  ) {
    return this.workspaces.restockProduct(user.id, params.id, params.productId, body);
  }

  @Get(":id/wallet")
  wallet(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.getWallet(user.id, params.id);
  }

  @Post(":id/wallet/withdrawals")
  withdraw(
    @CurrentUser() user: RequestUser,
    @Param() params: IdParamDto,
    @Body() body: WalletWithdrawDto,
  ) {
    return this.workspaces.requestWalletWithdrawal(user.id, params.id, body);
  }

  @Get(":id/notifications")
  notifications(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.listNotifications(user.id, params.id);
  }

  @Post(":id/notifications/read-all")
  markAllNotificationsRead(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.markAllNotificationsRead(user.id, params.id);
  }

  @Post(":id/notifications/:notificationId/read")
  markNotificationRead(@CurrentUser() user: RequestUser, @Param() params: NotificationParamDto) {
    return this.workspaces.markNotificationRead(user.id, params.id, params.notificationId);
  }

  @Post(":id/notifications/:notificationId/archive")
  archiveNotification(@CurrentUser() user: RequestUser, @Param() params: NotificationParamDto) {
    return this.workspaces.archiveNotification(user.id, params.id, params.notificationId);
  }

  @Get(":id/support/faq")
  supportFaq(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.supportFaq(user.id, params.id);
  }

  @Get(":id/support/tickets")
  supportTickets(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.listSupportTickets(user.id, params.id);
  }

  @Post(":id/support/tickets")
  createSupportTicket(
    @CurrentUser() user: RequestUser,
    @Param() params: IdParamDto,
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.workspaces.createSupportTicket(user.id, params.id, body);
  }

  @Get(":id/support/tickets/:ticketId")
  getSupportTicket(@CurrentUser() user: RequestUser, @Param() params: SupportTicketParamDto) {
    return this.workspaces.getSupportTicket(user.id, params.id, params.ticketId);
  }

  @Post(":id/support/tickets/:ticketId/replies")
  replySupportTicket(
    @CurrentUser() user: RequestUser,
    @Param() params: SupportTicketParamDto,
    @Body() body: ReplySupportTicketDto,
  ) {
    return this.workspaces.replySupportTicket(user.id, params.id, params.ticketId, body);
  }

  @Post(":id/support/tickets/:ticketId/close")
  closeSupportTicket(@CurrentUser() user: RequestUser, @Param() params: SupportTicketParamDto) {
    return this.workspaces.closeSupportTicket(user.id, params.id, params.ticketId);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.getMine(user.id, params.id);
  }

  @Patch(":id")
  update(@CurrentUser() user: RequestUser, @Param() params: IdParamDto, @Body() body: UpdateWorkspaceDto) {
    return this.workspaces.updateMine(user.id, params.id, body);
  }

  @Post(":id/activate")
  activate(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.activateMine(user.id, params.id);
  }

  @Get(":id/catalog")
  catalog(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.catalogFor(user.id, params.id);
  }

  @Patch(":id/offering")
  offering(@CurrentUser() user: RequestUser, @Param() params: IdParamDto, @Body() body: UpdateOfferingDto) {
    return this.workspaces.applyOffering(user.id, params.id, body);
  }

  @Get(":id/documents")
  listDocuments(@CurrentUser() user: RequestUser, @Param() params: IdParamDto) {
    return this.workspaces.listDocuments(user.id, params.id);
  }

  @Post(":id/documents")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @CurrentUser() user: RequestUser,
    @Param() params: IdParamDto,
    @Body() body: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new ApiException(API_ERROR_CODES.BAD_REQUEST, "Un fichier est requis");
    }
    return this.workspaces.uploadDocument(user.id, params.id, body.kind, file);
  }

  @Get(":id/documents/:documentId/file")
  downloadDocument(@CurrentUser() user: RequestUser, @Param() params: DocumentParamDto) {
    return this.workspaces.downloadDocument(user.id, params.id, params.documentId);
  }

  @Delete(":id/documents/:documentId")
  removeDocument(@CurrentUser() user: RequestUser, @Param() params: DocumentParamDto) {
    return this.workspaces.removeDocument(user.id, params.id, params.documentId);
  }
}
