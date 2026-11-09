import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../auth/auth.types";
import { RequireAudience } from "../auth/decorators/audience.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CreateOrderDto, QuoteOrderDto, StorefrontOrderQueryDto } from "./dto/order.dto";
import { OrdersService } from "./orders.service";

@Controller("storefront")
export class StorefrontOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Get("orders/settings")
  settings(@Query() query: StorefrontOrderQueryDto) {
    return this.orders.publicSettings(query);
  }

  @Public()
  @Post("orders/quote")
  quote(@Query() query: StorefrontOrderQueryDto, @Body() body: QuoteOrderDto) {
    return this.orders.quote(query, body);
  }

  @RequireAudience("storefront")
  @Get("orders/mine")
  mine(@CurrentUser() user: RequestUser, @Query() query: StorefrontOrderQueryDto) {
    return this.orders.listMine(user.id, query);
  }

  @RequireAudience("storefront")
  @Post("orders")
  create(
    @CurrentUser() user: RequestUser,
    @Query() query: StorefrontOrderQueryDto,
    @Body() body: CreateOrderDto,
  ) {
    return this.orders.publicCreate(query, body, user.id);
  }

  /** IPN PayDunya — application/x-www-form-urlencoded (clé `data`). */
  @Public()
  @Post("payments/paydunya/ipn")
  paydunyaIpn(@Req() request: Request, @Body() body: unknown) {
    return this.orders.handlePaydunyaIpn(body ?? request.body);
  }

  /** Callback cashout / PUSH PayDunya (remboursement). */
  @Public()
  @Post("payments/paydunya/cashout-ipn")
  paydunyaCashoutIpn(@Req() request: Request, @Body() body: unknown) {
    return this.orders.handlePaydunyaCashoutIpn(body ?? request.body);
  }
}
