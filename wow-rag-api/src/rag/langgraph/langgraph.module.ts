import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BlizzardModule } from "../../blizzard/blizzard.module";
import { LocalLLMModule } from "../llm/local-llm.module";
import { LangGraphWorkflow } from "./workflow";
import { WorkflowNodes } from "./nodes";
import { WorkflowEdges } from "./edges";

@Module({
  imports: [
    ConfigModule,
    BlizzardModule,
    LocalLLMModule,
  ],
  providers: [
    WorkflowNodes,
    WorkflowEdges,
    LangGraphWorkflow,
  ],
  exports: [
    LangGraphWorkflow,
    WorkflowNodes,
    WorkflowEdges,
  ],
})
export class LangGraphModule {}
