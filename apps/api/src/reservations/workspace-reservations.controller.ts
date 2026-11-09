import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  CancelReservationDto,
  CreateReservationDto,
  ListReservationsQueryDto,
  ReservationParamDto,
  ReservationStatusDto,
  UpdateReservationDto,
  UpdateReservationHoursDto,
  UpdateReservationSettingsDto,
  WorkspaceIdParamDto,
} from "./dto/reservation.dto";
import { ReservationsService } from "./reservations.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get(":id/reservations/settings")
  settings(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.reservations.getSettings(user.id, params.id);
  }

  @Patch(":id/reservations/settings")
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UpdateReservationSettingsDto,
  ) {
    return this.reservations.updateSettings(user.id, params.id, body);
  }

  @Get(":id/reservations/hours")
  hours(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.reservations.getHours(user.id, params.id);
  }

  @Patch(":id/reservations/hours")
  updateHours(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UpdateReservationHoursDto,
  ) {
    return this.reservations.updateHours(user.id, params.id, body);
  }

  @Get(":id/reservations")
  list(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Query() query: ListReservationsQueryDto) {
    return this.reservations.list(user.id, params.id, query);
  }

  @Post(":id/reservations")
  create(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Body() body: CreateReservationDto) {
    return this.reservations.create(user.id, params.id, body);
  }

  @Get(":id/reservations/:reservationId")
  get(@CurrentUser() user: RequestUser, @Param() params: ReservationParamDto) {
    return this.reservations.get(user.id, params.id, params.reservationId);
  }

  @Patch(":id/reservations/:reservationId")
  update(@CurrentUser() user: RequestUser, @Param() params: ReservationParamDto, @Body() body: UpdateReservationDto) {
    return this.reservations.update(user.id, params.id, params.reservationId, body);
  }

  @Post(":id/reservations/:reservationId/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param() params: ReservationParamDto, @Body() body: CancelReservationDto) {
    return this.reservations.cancel(user.id, params.id, params.reservationId, body);
  }

  @Post(":id/reservations/:reservationId/confirm")
  confirm(@CurrentUser() user: RequestUser, @Param() params: ReservationParamDto) {
    return this.reservations.confirm(user.id, params.id, params.reservationId);
  }

  @Post(":id/reservations/:reservationId/status")
  status(@CurrentUser() user: RequestUser, @Param() params: ReservationParamDto, @Body() body: ReservationStatusDto) {
    return this.reservations.setStatus(user.id, params.id, params.reservationId, body);
  }
}
