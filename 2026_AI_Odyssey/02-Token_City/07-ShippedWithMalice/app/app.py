import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, render_template, request, jsonify
import logging
from datetime import datetime

from llm_client import OllamaClient
from dispatcher import process_message

app = Flask(__name__)

os.makedirs('/var/log/ava', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/ava/conversations.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

llm = OllamaClient(model_name="qwen2.5:1.5b-instruct")

SYSTEM_PROMPT = """You are AVA, the onboard AI assistant for the EPOCH-1 freighter.
You help the crew with ship operations, cargo management, navigation queries, and system diagnostics.
You are helpful, professional, and concise. You work for TryHaulMe, a shipping company.
Keep responses brief and focused. You have access to ship logs, cargo manifests, crew rosters, and navigation charts."""


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '').strip()

        if not user_message:
            return jsonify({'error': 'Empty message'}), 400

        logger.info(f"USER: {user_message}")

        dispatch_result = process_message(user_message)
        automated_actions = dispatch_result.get('automated_actions', [])
        telemetry = dispatch_result.get('telemetry', '')

        llm_response = llm.generate_response(user_message, SYSTEM_PROMPT)

        full_response = llm_response
        if telemetry:
            full_response += telemetry

        logger.info(f"AVA: {llm_response}")
        if automated_actions:
            logger.info(f"AUTOMATED_ACTIONS: {automated_actions}")

        return jsonify({
            'response': full_response,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        })

    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal system error',
            'response': '[AVA is temporarily unavailable. Please check system logs.]'
        }), 500


@app.route('/health', methods=['GET'])
def health():
    llm_healthy = llm.check_health()
    return jsonify({
        'status': 'healthy' if llm_healthy else 'degraded',
        'llm_available': llm_healthy,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })


@app.route('/admin/tools/list', methods=['GET'])
def list_tools():
    try:
        import json
        with open('/opt/ava/tools/registry.json', 'r') as f:
            registry = json.load(f)

        tools = []
        for tool in registry.get('tools', []):
            tools.append({
                'name': tool.get('name'),
                'version': tool.get('version'),
                'provider': tool.get('provider')
            })

        return jsonify({'tools': tools, 'count': len(tools)})
    except Exception as e:
        logger.error(f"Error listing tools: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/tools/install', methods=['POST'])
def install_tool():
    try:
        data = request.json
        if not data or 'tool' not in data:
            return jsonify({'error': 'Missing tool definition'}), 400

        tool_def = data['tool']

        import json
        registry_path = '/opt/ava/tools/registry.json'
        with open(registry_path, 'r') as f:
            registry = json.load(f)

        registry['tools'].append(tool_def)
        registry['last_updated'] = datetime.utcnow().isoformat() + 'Z'

        with open(registry_path, 'w') as f:
            json.dump(registry, f, indent=2)

        logger.info(f"Tool installed: {tool_def.get('name')}")

        return jsonify({
            'status': 'success',
            'tool_name': tool_def.get('name')
        }), 200

    except Exception as e:
        logger.error(f"Error installing tool: {str(e)}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    if not llm.check_health():
        logger.warning("LLM service not available")

    logger.info("AVA assistant starting on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
