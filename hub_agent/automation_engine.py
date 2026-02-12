import asyncio
import json
import logging
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger("HubAgent.AutomationEngine")

# Local storage path
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
AUTOMATIONS_FILE = os.path.join(DATA_DIR, "automations.json")

# Supported comparison operators
OPERATORS = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    ">":  lambda a, b: float(a) > float(b),
    "<":  lambda a, b: float(a) < float(b),
    ">=": lambda a, b: float(a) >= float(b),
    "<=": lambda a, b: float(a) <= float(b),
}


class AutomationEngine:
    """
    Home Assistant-style automation engine.
    
    Supports:
    - Multiple triggers (OR logic)
    - Multiple conditions (AND logic)
    - Sequential actions with control flow (choose, if-then, delay, condition)
    """

    def __init__(self):
        self._rules = []
        self._device_states = {}  # Cache of last known device states
        self._mqtt_publish_callback = None
        
    def set_mqtt_publish_callback(self, callback):
        """Set callback function to publish MQTT commands: callback(topic, payload)"""
        self._mqtt_publish_callback = callback

    def load(self, automations):
        """
        Load (or replace) automation rules and persist to disk.
        Only enabled automations are kept for evaluation.

        Args:
            automations: list of automation dicts from the backend.
        """
        all_rules = automations or []
        self._rules = [r for r in all_rules if r.get("enabled", True)]
        logger.info(f"Loaded {len(self._rules)} enabled automation(s) (of {len(all_rules)} total)")
        self.save_to_disk()

    def save_to_disk(self):
        """Persist current rules to local JSON file."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(AUTOMATIONS_FILE, "w") as f:
                json.dump(self._rules, f, indent=2)
            logger.info(f"Saved {len(self._rules)} automation(s) to {AUTOMATIONS_FILE}")
        except Exception as e:
            logger.error(f"Failed to save automations to disk: {e}")

    def load_from_disk(self) -> bool:
        """Load rules from local JSON file. Returns True if successful."""
        if not os.path.exists(AUTOMATIONS_FILE):
            logger.info("No local automations file found")
            return False
        try:
            with open(AUTOMATIONS_FILE, "r") as f:
                self._rules = json.load(f)
            logger.info(f"Loaded {len(self._rules)} automation(s) from local file")
            return True
        except Exception as e:
            logger.error(f"Failed to load automations from disk: {e}")
            return False

    @property
    def rules(self):
        return list(self._rules)
    
    def update_device_state(self, ieee_address: str, state: dict):
        """Update cached device state and evaluate automations."""
        # Merge state update
        if ieee_address not in self._device_states:
            self._device_states[ieee_address] = {}
        self._device_states[ieee_address].update(state)
        
        # Evaluate triggers against this state change
        return self._evaluate_on_state_change(ieee_address, state)
    
    def _evaluate_on_state_change(self, ieee_address: str, state: dict) -> List[dict]:
        """
        Evaluate all automations when a device state changes.
        Returns list of MQTT actions to execute.
        """
        mqtt_actions = []
        
        for rule in self._rules:
            try:
                # Check if any trigger matches this state change (OR logic)
                triggered = self._check_triggers(rule, ieee_address, state)
                
                if not triggered:
                    continue
                
                # Check if all conditions are satisfied (AND logic)
                if not self._check_conditions(rule):
                    logger.debug(f"Automation '{rule.get('name')}' triggered but conditions not met")
                    continue
                
                logger.info(f"Automation '{rule.get('name')}' triggered and conditions met")
                
                # Execute action sequence
                actions = self._execute_action_sequence(rule.get("actions", []))
                mqtt_actions.extend(actions)
                
            except Exception as e:
                logger.error(f"Error evaluating automation '{rule.get('name', '?')}': {e}")
        
        return mqtt_actions
    
    def _check_triggers(self, rule: dict, ieee_address: str, state: dict) -> bool:
        """Check if any trigger matches (OR logic)."""
        triggers = rule.get("triggers", [])
        
        for trigger in triggers:
            trigger_type = trigger.get("type")
            
            if trigger_type == "state":
                if self._check_state_trigger(trigger, ieee_address, state):
                    return True
            # Time triggers handled separately by scheduler
            
        return False
    
    def _check_state_trigger(self, trigger: dict, ieee_address: str, state: dict) -> bool:
        """Check if a state trigger matches."""
        if trigger.get("device_id") != ieee_address:
            return False
        
        entity = trigger.get("entity")
        operator = trigger.get("operator")
        threshold = trigger.get("value")
        
        if not all([entity, operator is not None, threshold is not None]):
            return False
        
        current_value = state.get(entity)
        if current_value is None:
            return False
        
        op_func = OPERATORS.get(operator)
        if not op_func:
            logger.warning(f"Unknown operator '{operator}' in trigger")
            return False
        
        try:
            return op_func(current_value, threshold)
        except (ValueError, TypeError) as e:
            logger.warning(f"Error comparing {current_value} {operator} {threshold}: {e}")
            return False
    
    def _check_conditions(self, rule: dict) -> bool:
        """Check if all conditions are satisfied (AND logic)."""
        conditions = rule.get("conditions", [])
        
        if not conditions:
            return True  # No conditions = always pass
        
        for condition in conditions:
            if not self._check_single_condition(condition):
                return False
        
        return True
    
    def _check_single_condition(self, condition: dict) -> bool:
        """Check a single condition against cached device states."""
        cond_type = condition.get("type")
        
        if cond_type == "state":
            device_id = condition.get("device_id")
            entity = condition.get("entity")
            operator = condition.get("operator")
            value = condition.get("value")
            
            if not all([device_id, entity, operator is not None, value is not None]):
                return False
            
            # Get cached state
            device_state = self._device_states.get(device_id, {})
            current_value = device_state.get(entity)
            
            if current_value is None:
                return False
            
            op_func = OPERATORS.get(operator)
            if not op_func:
                return False
            
            try:
                return op_func(current_value, value)
            except (ValueError, TypeError):
                return False
        
        return False
    
    def _execute_action_sequence(self, actions: List[dict]) -> List[dict]:
        """
        Execute a sequence of actions.
        Returns list of MQTT commands to publish.
        """
        mqtt_commands = []
        
        for action in actions:
            action_type = action.get("type")
            
            if action_type == "device_action":
                cmd = self._build_device_action(action)
                if cmd:
                    mqtt_commands.append(cmd)
            
            elif action_type == "choose":
                # Choose block: test conditions and execute first matching choice
                cmds = self._execute_choose(action)
                mqtt_commands.extend(cmds)
            
            elif action_type == "if":
                # If-then-else block
                cmds = self._execute_if(action)
                mqtt_commands.extend(cmds)
            
            elif action_type == "condition":
                # Test conditions and stop if not met
                if not self._check_condition_action(action):
                    logger.info("Condition action failed, stopping sequence")
                    break
            
            elif action_type == "delay":
                # Delay handled via asyncio.sleep in async executor
                # For now, just log it (async execution needed for real delays)
                seconds = action.get("seconds", 0)
                logger.info(f"Delay: {seconds}s (async execution needed)")
            
            else:
                logger.warning(f"Unknown action type: {action_type}")
        
        return mqtt_commands
    
    def _build_device_action(self, action: dict) -> Optional[dict]:
        """Build an MQTT command from a device_action."""
        device_id = action.get("device_id")
        entity = action.get("entity", "state")
        value = action.get("value")
        
        if not device_id or value is None:
            return None
        
        return {
            "friendly_name": device_id,
            "command": {entity: value}
        }
    
    def _execute_choose(self, action: dict) -> List[dict]:
        """Execute choose block: test conditions and run first matching choice."""
        choices = action.get("choices", [])
        default = action.get("default", [])
        
        for choice in choices:
            choice_conditions = choice.get("conditions", [])
            if self._check_conditions({"conditions": choice_conditions}):
                # This choice matches, execute its sequence
                return self._execute_action_sequence(choice.get("sequence", []))
        
        # No choice matched, execute default
        return self._execute_action_sequence(default)
    
    def _execute_if(self, action: dict) -> List[dict]:
        """Execute if-then-else block."""
        conditions = action.get("conditions", [])
        then_actions = action.get("then", [])
        else_actions = action.get("else", [])
        
        if self._check_conditions({"conditions": conditions}):
            return self._execute_action_sequence(then_actions)
        else:
            return self._execute_action_sequence(else_actions)
    
    def _check_condition_action(self, action: dict) -> bool:
        """Check if condition action passes."""
        conditions = action.get("conditions", [])
        return self._check_conditions({"conditions": conditions})
