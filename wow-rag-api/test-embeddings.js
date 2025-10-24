#!/usr/bin/env node

/**
 * Test script for local embeddings integration
 * This script tests the embeddings server and NestJS integration
 */

import fetch from 'node-fetch';

const EMBEDDINGS_URL = 'http://localhost:8000';

async function testEmbeddingsServer() {
  console.log('🧪 Testing Local Embeddings Server...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${EMBEDDINGS_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    if (!healthData.model_loaded) {
      console.log('⚠️  Model not loaded yet, waiting...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Test embeddings endpoint
    console.log('\n2. Testing embeddings endpoint...');
    const testTexts = [
      'Hello world',
      'This is a test',
      'WoW is awesome'
    ];

    const embedResponse = await fetch(`${EMBEDDINGS_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: testTexts,
        model: 'all-MiniLM-L6-v2'
      }),
    });

    if (!embedResponse.ok) {
      throw new Error(`HTTP error! status: ${embedResponse.status}`);
    }

    const embedData = await embedResponse.json();
    console.log('✅ Embeddings generated successfully');
    console.log(`   - Number of texts: ${testTexts.length}`);
    console.log(`   - Embedding dimensions: ${embedData.embeddings[0].length}`);
    console.log(`   - Model used: ${embedData.model}`);

    // Test single query
    console.log('\n3. Testing single query...');
    const queryResponse = await fetch(`${EMBEDDINGS_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: ['Single query test'],
        model: 'all-MiniLM-L6-v2'
      }),
    });

    const queryData = await queryResponse.json();
    console.log('✅ Single query test passed');
    console.log(`   - Embedding dimensions: ${queryData.embeddings[0].length}`);

    console.log('\n🎉 All tests passed! Local embeddings server is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the embeddings server is running:');
    console.log('   docker-compose up -d');
    process.exit(1);
  }
}

async function testNestJSIntegration() {
  console.log('\n🧪 Testing NestJS Integration...\n');

  try {
    // Test if NestJS is running
    const nestResponse = await fetch('http://localhost:3000/health');
    if (!nestResponse.ok) {
      throw new Error('NestJS server is not running on port 3000');
    }
    console.log('✅ NestJS server is running');

    // Test RAG endpoint
    console.log('\n4. Testing RAG endpoint...');
    const ragResponse = await fetch('http://localhost:3000/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What is World of Warcraft?',
        maxDocuments: 3
      }),
    });

    if (!ragResponse.ok) {
      throw new Error(`RAG endpoint failed: ${ragResponse.status}`);
    }

    const ragData = await ragResponse.json();
    console.log('✅ RAG endpoint working with local embeddings');
    console.log(`   - Response length: ${JSON.stringify(ragData).length} characters`);

    console.log('\n🎉 NestJS integration test passed!');

  } catch (error) {
    console.error('❌ NestJS integration test failed:', error.message);
    console.log('\n💡 Make sure NestJS is running:');
    console.log('   pnpm start:dev');
  }
}

async function main() {
  console.log('🚀 Starting Local Embeddings Integration Tests\n');
  
  await testEmbeddingsServer();
  await testNestJSIntegration();
  
  console.log('\n✨ All tests completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Set EMBEDDINGS_PROVIDER=local in your .env file');
  console.log('   2. Start the embeddings server: docker-compose up -d');
  console.log('   3. Start NestJS: pnpm start:dev');
  console.log('   4. Test your RAG queries!');
}

main().catch(console.error);
