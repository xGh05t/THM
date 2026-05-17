#!/bin/bash
# Preload Ollama model into memory for immediate availability
# This ensures the model is ready even after VM cloning

curl -s http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:1.5b-instruct",
  "prompt": "warmup",
  "stream": false,
  "keep_alive": -1
}' > /dev/null 2>&1

exit 0
