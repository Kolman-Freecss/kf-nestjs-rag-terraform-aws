import { DynamicTool } from "@langchain/core/tools";
import { Injectable } from "@nestjs/common";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { BlizzardService } from "../../../blizzard/blizzard.service";

@Injectable()
export class AgentTools {
  constructor(private readonly blizzardService: BlizzardService) {}

  /**
   * Tool to search knowledge base
   */
  createKnowledgeSearchTool(vectorStore: MemoryVectorStore): DynamicTool {
    return new DynamicTool({
      name: "knowledge_search",
      description: "Search the knowledge base for information. Input should be a search query string.",
      func: async (input: string) => {
        try {
          const results = await vectorStore.similaritySearch(input, 5);
          if (results.length === 0) {
            return "No relevant information found in the knowledge base.";
          }
          
          return results.map((doc, idx) => {
            const source = doc.metadata?.source || 'unknown';
            const topic = doc.metadata?.topic || 'general';
            return `[${idx + 1}] Source: ${source} | Topic: ${topic}\n${doc.pageContent}`;
          }).join('\n\n');
        } catch (error) {
          return `Error searching knowledge: ${error.message}`;
        }
      }
    });
  }

  /**
   * Tool to get realm information from Blizzard API
   */
  createRealmInfoTool(): DynamicTool {
    return new DynamicTool({
      name: "get_realm_info",
      description: "Get information about a specific World of Warcraft realm from the Blizzard API. Input should be a realm slug (e.g., 'stormrage', 'area-52').",
      func: async (realmSlug: string) => {
        try {
          const realmData = await this.blizzardService.getRealmData(realmSlug);
          return JSON.stringify(realmData, null, 2);
        } catch (error) {
          return `Error fetching realm data for ${realmSlug}: ${error.message}`;
        }
      }
    });
  }

  /**
   * Tool to get character information from Blizzard API
   */
  createCharacterInfoTool(): DynamicTool {
    return new DynamicTool({
      name: "get_character_info",
      description: "Get information about a specific character from the Blizzard API. Input should be in format 'realmSlug:characterName'.",
      func: async (input: string) => {
        try {
          const [realmSlug, characterName] = input.split(':');
          if (!realmSlug || !characterName) {
            return "Input should be in format 'realmSlug:characterName'";
          }
          const characterData = await this.blizzardService.getCharacterData(realmSlug, characterName);
          return JSON.stringify(characterData, null, 2);
        } catch (error) {
          return `Error fetching character data: ${error.message}`;
        }
      }
    });
  }

  /**
   * Get all tools
   */
  getAllTools(vectorStore: MemoryVectorStore): DynamicTool[] {
    return [
      this.createKnowledgeSearchTool(vectorStore),
      this.createRealmInfoTool(),
      this.createCharacterInfoTool()
    ];
  }
}
