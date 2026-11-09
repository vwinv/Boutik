import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/auth.types";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "./users.service";

@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: RequestUser) {
    return this.users.me(user);
  }

  @Patch()
  update(@CurrentUser() user: RequestUser, @Body() body: UpdateProfileDto) {
    return this.users.updateProfile(user, body);
  }
}
