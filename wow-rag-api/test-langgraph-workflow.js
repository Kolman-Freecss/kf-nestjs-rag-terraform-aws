#!/usr/bin/env node

/**
 * LangGraph Workflow Test Script
 * This script tests the LangGraph workflow implementation
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RagService } from '../rag/rag.service';

async function testLangGraphWorkflow() {
  console.log('🚀 Starting LangGraph Workflow Test...\n');

  try {
    // Create NestJS application
    const app = await NestFactory.createApplicationContext(AppModule);
    const ragService = app.get(RagService);

    // Test queries
    const testQueries = [
      "What is World of Warcraft?",
      "Tell me about the realm Stormrage",
      "What are the different races in WoW?",
      "How do I level up quickly?",
      "What is the best class for beginners?"
    ];

    console.log('📋 Test Queries:');
    testQueries.forEach((query, index) => {
      console.log(`${index + 1}. ${query}`);
    });
    console.log('');

    // Get agent info
    console.log('🤖 Agent Information:');
    const agentInfo = await ragService.getAgentInfo();
    console.log(JSON.stringify(agentInfo, null, 2));
    console.log('');

    // Test each query
    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🔍 Testing Query ${i + 1}: ${query}`);
      console.log('─'.repeat(60));

      try {
        const startTime = Date.now();
        const result = await ragService.query(query);
        const endTime = Date.now();

        console.log(`✅ Response (${endTime - startTime}ms):`);
        console.log(result);
        console.log('');

      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log('');
      }
    }

    // Test debug functionality
    console.log('\n🔧 Testing Debug Functionality:');
    console.log('─'.repeat(60));
    
    try {
      const debugResult = await ragService.debugQuery("What is World of Warcraft?");
      console.log('📊 Debug Result:');
      console.log(JSON.stringify(debugResult, null, 2));
    } catch (error) {
      console.log(`❌ Debug Error: ${error.message}`);
    }

    console.log('\n✅ LangGraph Workflow Test Completed!');
    
    await app.close();

  } catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
  }
}

// Run the test
testLangGraphWorkflow().catch(console.error);


