#!/usr/bin/env node

/**
 * Test script for Local LLM integration
 * Tests the DeepSeek model running in Docker
 */

const BASE_URL = 'http://localhost:8001';

async function testHealth() {
  console.log('🔍 Testing LLM server health...');
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'healthy' && data.model_loaded) {
      console.log('✅ LLM server is healthy and model is loaded');
      return true;
    } else {
      console.log('❌ LLM server is not ready:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot connect to LLM server:', error.message);
    return false;
  }
}

async function testChatCompletion() {
  console.log('\n💬 Testing chat completion...');
  
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Hello! Can you tell me what World of Warcraft is in one sentence?'
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content;
    
    if (answer) {
      console.log('✅ Chat completion successful!');
      console.log('🤖 Response:', answer);
      console.log('📊 Tokens used:', data.usage?.total_tokens || 'unknown');
      return true;
    } else {
      console.log('❌ No response content received');
      return false;
    }
  } catch (error) {
    console.log('❌ Chat completion failed:', error.message);
    return false;
  }
}

async function testModels() {
  console.log('\n📋 Testing models endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/models`);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      console.log('✅ Models endpoint working');
      console.log('🤖 Available models:', data.data.map(m => m.id).join(', '));
      return true;
    } else {
      console.log('❌ No models returned');
      return false;
    }
  } catch (error) {
    console.log('❌ Models endpoint failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Local LLM Server (DeepSeek)');
  console.log('=====================================\n');

  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n❌ LLM server is not available. Please start it with:');
    console.log('   docker-compose up llm-server');
    process.exit(1);
  }

  const chatOk = await testChatCompletion();
  const modelsOk = await testModels();

  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Health Check: ${healthOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Chat Completion: ${chatOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Models Endpoint: ${modelsOk ? '✅ PASS' : '❌ FAIL'}`);

  if (healthOk && chatOk && modelsOk) {
    console.log('\n🎉 All tests passed! Local LLM is ready to use.');
    console.log('\n💡 Next steps:');
    console.log('   1. Start the RAG API: pnpm start:dev');
    console.log('   2. Test RAG endpoint: curl -X POST http://localhost:3000/rag/query \\');
    console.log('      -H "Content-Type: application/json" \\');
    console.log('      -d \'{"query": "What is World of Warcraft?"}\'');
  } else {
    console.log('\n❌ Some tests failed. Check the LLM server logs:');
    console.log('   docker-compose logs llm-server');
    process.exit(1);
  }
}

// Run the tests
main().catch(console.error);
