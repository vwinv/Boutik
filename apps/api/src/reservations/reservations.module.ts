import { Module } from "@nestjs/common";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { ReservationsService } from "./reservations.service";
import { StorefrontReservationsController } from "./storefront-reservations.controller";
import { WorkspaceReservationsController } from "./workspace-reservations.controller";

@Module({
  imports: [ProfessionalsModule],
  controllers: [StorefrontReservationsController, WorkspaceReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
