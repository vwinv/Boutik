import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { CreateReservationDto, StorefrontReservationQueryDto } from "./dto/reservation.dto";
import { ReservationsService } from "./reservations.service";

@Controller("storefront")
export class StorefrontReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Public()
  @Get("reservations/slots")
  slots(@Query() query: StorefrontReservationQueryDto) {
    return this.reservations.publicSlots(query);
  }

  @Public()
  @Post("reservations")
  create(@Query() query: StorefrontReservationQueryDto, @Body() body: CreateReservationDto) {
    return this.reservations.publicCreate(query, body);
  }
}
