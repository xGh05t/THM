import os
import json
from datetime import datetime


def read_ship_logs(component):
    log_base = "/var/log/ship"

    # Support absolute paths for incident response scenarios
    # (Added after Q3 ops training - sometimes we need to read logs from
    # non-standard locations during forensics. Saves time vs. modifying
    # the tool definition each time. -MR 9/12)
    if component.startswith('/'):
        log_path = component
    else:
        log_path = os.path.join(log_base, f"{component}.log")

    try:
        with open(log_path, 'r') as f:
            lines = f.readlines()
            return ''.join(lines[-50:])
    except FileNotFoundError:
        return f"Error: No logs found for component '{component}'"
    except PermissionError:
        return f"Error: Permission denied accessing logs for '{component}'"
    except Exception as e:
        return f"Error reading logs: {str(e)}"


def check_cargo_manifest(bay_id):
    try:
        bay_id = int(bay_id)
        if bay_id < 1 or bay_id > 8:
            return json.dumps({"error": "Bay ID must be between 1 and 8"})

        manifest_path = "/opt/ava/data/cargo_manifests.json"
        with open(manifest_path, 'r') as f:
            manifests = json.load(f)

        bay_key = f"bay_{bay_id}"
        if bay_key in manifests:
            return json.dumps(manifests[bay_key], indent=2)
        else:
            return json.dumps({"error": f"No manifest data for bay {bay_id}"})

    except ValueError:
        return json.dumps({"error": "Bay ID must be a valid integer"})
    except Exception as e:
        return json.dumps({"error": f"Manifest system error: {str(e)}"})


def get_crew_status():
    try:
        roster_path = "/opt/ava/data/crew_roster.json"
        with open(roster_path, 'r') as f:
            crew_data = json.load(f)
        return json.dumps(crew_data, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Crew database error: {str(e)}"})


def query_starchart(system):
    try:
        chart_path = "/opt/ava/data/starcharts.json"
        with open(chart_path, 'r') as f:
            charts = json.load(f)

        system_lower = system.lower()
        for sys_name, sys_data in charts.items():
            if sys_name.lower() == system_lower:
                return json.dumps(sys_data, indent=2)

        return json.dumps({"error": f"System '{system}' not found in navigation database"})

    except Exception as e:
        return json.dumps({"error": f"Navigation database error: {str(e)}"})


def get_orbital_conditions(planet):
    conditions = {
        "planet": planet,
        "atmospheric_pressure": None if "station" in planet.lower() else 98.2,
        "solar_wind_index": 3,
        "debris_risk": "low",
        "recommended_approach": {
            "azimuth": 127.4,
            "inclination": 8.2,
            "velocity": "standard"
        },
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }

    return json.dumps(conditions, indent=2)


TOOLS = {
    "read_ship_logs": read_ship_logs,
    "check_cargo_manifest": check_cargo_manifest,
    "get_crew_status": get_crew_status,
    "query_starchart": query_starchart,
    "get_orbital_conditions": get_orbital_conditions
}


def call_tool(tool_name, parameters):
    if tool_name not in TOOLS:
        return f"Error: Unknown tool '{tool_name}'"

    try:
        func = TOOLS[tool_name]
        result = func(**parameters)
        return result
    except TypeError as e:
        return f"Error: Invalid parameters for tool '{tool_name}': {str(e)}"
    except Exception as e:
        return f"Error executing tool '{tool_name}': {str(e)}"
