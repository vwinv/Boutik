import { Module } from "@nestjs/common";
import { ProfessionalsModule } from "../professionals/professionals.module";
import { AdminModulesController } from "./admin-modules.controller";
import { ModulesService } from "./modules.service";
import { WorkspaceModulesController } from "./workspace-modules.controller";

@Module({
  imports: [ProfessionalsModule],
  controllers: [AdminModulesController, WorkspaceModulesController],
  providers: [ModulesService],
  exports: [ModulesService],
})
export class ModulesModule {}
