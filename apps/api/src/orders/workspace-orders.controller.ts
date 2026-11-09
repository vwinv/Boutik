import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import {
  CancelOrderDto,
  ListOrdersQueryDto,
  OrderParamDto,
  OrderStatusDto,
  UpdateOrderSettingsDto,
  WorkspaceIdParamDto,
} from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@Controller("workspaces")
@RequireAudience("pro")
export class WorkspaceOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(":id/orders/settings")
  settings(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto) {
    return this.orders.getSettings(user.id, params.id);
  }

  @Patch(":id/orders/settings")
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Param() params: WorkspaceIdParamDto,
    @Body() body: UpdateOrderSettingsDto,
  ) {
    return this.orders.updateSettings(user.id, params.id, body);
  }

  @Get(":id/orders")
  list(@CurrentUser() user: RequestUser, @Param() params: WorkspaceIdParamDto, @Query() query: ListOrdersQueryDto) {
    return this.orders.list(user.id, params.id, query);
  }

  @Get(":id/orders/:orderId")
  get(@CurrentUser() user: RequestUser, @Param() params: OrderParamDto) {
    return this.orders.get(user.id, params.id, params.orderId);
  }

  @Post(":id/orders/:orderId/status")
  status(@CurrentUser() user: RequestUser, @Param() params: OrderParamDto, @Body() body: OrderStatusDto) {
    return this.orders.setStatus(user.id, params.id, params.orderId, body);
  }

  @Post(":id/orders/:orderId/cancel")
  cancel(@CurrentUser() user: RequestUser, @Param() params: OrderParamDto, @Body() body: CancelOrderDto) {
    return this.orders.cancel(user.id, params.id, params.orderId, body);
  }

  @Post(":id/orders/:orderId/refund")
  refund(@CurrentUser() user: RequestUser, @Param() params: OrderParamDto) {
    return this.orders.refund(user.id, params.id, params.orderId);
  }
}
