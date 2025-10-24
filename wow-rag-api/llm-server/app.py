import os
import json
from typing import Dict, List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for model
model = None
tokenizer = None
pipe = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the DeepSeek model on startup"""
    global model, tokenizer, pipe
    
    try:
        model_name = os.getenv("MODEL_NAME", "microsoft/DialoGPT-medium")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        logger.info(f"Loading model: {model_name} on device: {device}")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            trust_remote_code=True,
            cache_dir="/root/.cache/huggingface"
        )
        
        # Load model with memory optimizations
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=True,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None,
            cache_dir="/root/.cache/huggingface",
            low_cpu_mem_usage=True,
            use_safetensors=True
        )
        
        if device == "cpu":
            model = model.to(device)
        
        # Create pipeline
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            device=device,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        )
        
        logger.info("Model loaded successfully!")
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise e
    
    yield
    
    # Cleanup on shutdown (if needed)
    logger.info("Shutting down LLM server")

app = FastAPI(title="Local LLM Server", version="1.0.0", lifespan=lifespan)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 1000
    model: str = "deepseek-coder"

class ChatResponse(BaseModel):
    choices: List[Dict]
    usage: Dict


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}

@app.post("/v1/chat/completions", response_model=ChatResponse)
async def chat_completions(request: ChatRequest):
    """OpenAI-compatible chat completions endpoint"""
    global pipe, tokenizer
    
    if not pipe or not tokenizer:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Log the incoming request
        logger.info(f"Received chat request with {len(request.messages)} messages")
        logger.info(f"Request parameters: temperature={request.temperature}, max_tokens={request.max_tokens}")
        
        # Convert messages to prompt format
        prompt = format_messages_to_prompt(request.messages)
        logger.info(f"Generated prompt: {prompt[:200]}...")  # Log first 200 chars
        
        # Generate response
        logger.info("Generating response...")
        response = pipe(
            prompt,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
            return_full_text=False
        )
        
        # Extract generated text
        generated_text = response[0]["generated_text"]
        logger.info(f"Raw generated text: '{generated_text}'")
        
        # Clean up the response (remove any remaining prompt)
        if prompt in generated_text:
            generated_text = generated_text.replace(prompt, "").strip()
            logger.info(f"Cleaned text after prompt removal: '{generated_text}'")
        
        # Additional cleanup for common issues
        generated_text = generated_text.strip()
        
        # Validate response quality
        if not generated_text or len(generated_text.strip()) < 2:
            logger.warning(f"Generated empty or very short response: '{generated_text}'")
            generated_text = "I apologize, but I couldn't generate a proper response. Please try again with a different question."
        
        # Check for common problematic responses
        if generated_text in [".", "!", "?", "...", "ok", "yes", "no"]:
            logger.warning(f"Generated minimal response: '{generated_text}' - replacing with more helpful message")
            generated_text = "I understand your question, but I need more context to provide a helpful answer. Could you please provide more details?"
        
        logger.info(f"Final response: '{generated_text}'")
        
        # Format response in OpenAI style
        return ChatResponse(
            choices=[{
                "message": {
                    "role": "assistant",
                    "content": generated_text
                },
                "finish_reason": "stop",
                "index": 0
            }],
            usage={
                "prompt_tokens": len(tokenizer.encode(prompt)),
                "completion_tokens": len(tokenizer.encode(generated_text)),
                "total_tokens": len(tokenizer.encode(prompt)) + len(tokenizer.encode(generated_text))
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def format_messages_to_prompt(messages: List[ChatMessage]) -> str:
    """Convert chat messages to appropriate prompt format"""
    prompt = ""
    
    # Get the model name to determine format
    model_name = os.getenv("MODEL_NAME", "microsoft/DialoGPT-medium")
    
    if "deepseek" in model_name.lower():
        # DeepSeek format
        for message in messages:
            if message.role == "system":
                prompt += f"<|im_start|>system\n{message.content}<|im_end|>\n"
            elif message.role == "user":
                prompt += f"<|im_start|>user\n{message.content}<|im_end|>\n"
            elif message.role == "assistant":
                prompt += f"<|im_start|>assistant\n{message.content}<|im_end|>\n"
        
        # Add assistant start token for generation
        prompt += "<|im_start|>assistant\n"
    elif "distilgpt2" in model_name.lower():
        # DistilGPT-2 format (simple continuation)
        for message in messages:
            if message.role == "user":
                prompt += f"User: {message.content}\n"
            elif message.role == "assistant":
                prompt += f"Assistant: {message.content}\n"
        
        # Add assistant start for generation
        prompt += "Assistant: "
    else:
        # DialoGPT format (simpler)
        for message in messages:
            if message.role == "user":
                prompt += f"Human: {message.content}\n"
            elif message.role == "assistant":
                prompt += f"AI: {message.content}\n"
        
        # Add AI start for generation
        prompt += "AI: "
    
    return prompt

@app.get("/models")
async def list_models():
    """List available models"""
    return {
        "data": [{
            "id": "deepseek-coder",
            "object": "model",
            "created": 1677610602,
            "owned_by": "deepseek"
        }]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
