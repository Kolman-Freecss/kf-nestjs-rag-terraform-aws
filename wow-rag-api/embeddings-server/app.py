from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
import logging
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model variable
model = None

def load_model():
    global model
    if model is None:
        model_name = os.getenv('MODEL_NAME', 'all-MiniLM-L6-v2')
        logger.info(f"Loading model: {model_name}")
        model = SentenceTransformer(model_name)
        logger.info("Model loaded successfully")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

@app.route('/embed', methods=['POST'])
def embed():
    try:
        data = request.get_json()
        if not data or 'texts' not in data:
            return jsonify({"error": "Missing 'texts' field"}), 400
        
        texts = data['texts']
        if not isinstance(texts, list):
            return jsonify({"error": "'texts' must be a list"}), 400
        
        # Load model if not already loaded
        load_model()
        
        # Generate embeddings
        embeddings = model.encode(texts)
        
        return jsonify({
            "embeddings": embeddings.tolist(),
            "model": os.getenv('MODEL_NAME', 'all-MiniLM-L6-v2')
        })
        
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    logger.info(f"Starting embeddings server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
