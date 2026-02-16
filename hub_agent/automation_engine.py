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
    - Async action execution with real delay support
    - Per-automation cooldown to prevent retriggering
    """

    def __init__(self):
        self._rules = []
        self._device_states = {}  # Cache of last known device states
        self._mqtt_client = None
        self._event_loop = None
        self._running_automations = set()  # IDs of currently executing automations
        
    def set_mqtt_client(self, mqtt_client):
        """Set MQTT client for publishing commands directly."""
        self._mqtt_client = mqtt_client

    def set_event_loop(self, loop):
        """Set the asyncio event loop for scheduling async action execution."""
        self._event_loop = loop
        # Start time trigger monitor task
        loop.create_task(self._monitor_time_triggers())

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
        self._evaluate_on_state_change(ieee_address, state)
    
    def _monitor_time_triggers(self):
        """Check time pattern triggers every second loop."""
        import asyncio
        async def _loop():
            while True:
                try:
                    now = datetime.now()
                    self._check_time_triggers(now)
                    
                    # Calculate sleep time to align with next second
                    to_sleep = 1.0 - (now.microsecond / 1_000_000)
                    await asyncio.sleep(to_sleep)
                except Exception as e:
                    logger.error(f"Error in time trigger monitor: {e}")
                    await asyncio.sleep(1)
        return _loop()

    def _check_time_triggers(self, now: datetime):
        """Evaluate time triggers for all rules against current time."""
        for rule in self._rules:
            rule_id = rule.get("id", rule.get("name", "unknown"))
            
            # Skip if this automation is already running (cooldown)
            if rule_id in self._running_automations:
                continue
                
            # Check if any time-based trigger matches
            if self._matches_time_trigger(rule, now):
                # Check conditions (AND logic)
                if not self._check_conditions(rule):
                    continue
                    
                logger.info(f"Time trigger matched for '{rule.get('name')}' — scheduling execution")
                self._schedule_actions(rule_id, rule.get("name", "?"), rule.get("actions", []))

    def _matches_time_trigger(self, rule: dict, now: datetime) -> bool:
        """Check if any time-based trigger matches 'now'."""
        triggers = rule.get("triggers", [])
        for trigger in triggers:
            t_type = trigger.get("type")
            if t_type == "time_pattern":
                if self._check_single_time_pattern(trigger, now):
                    return True
            elif t_type == "time":
                if self._check_single_time_trigger(trigger, now):
                    return True
        return False

    def _check_single_time_trigger(self, trigger: dict, now: datetime) -> bool:
        """Check if a specific time trigger matches (HH:MM:SS)."""
        at_time = trigger.get("at")
        if not at_time:
            return False
            
        current_time_str = now.strftime("%H:%M:%S")
        
        # Exact match required
        return at_time == current_time_str

    def _check_single_time_pattern(self, trigger: dict, now: datetime) -> bool:
        """Check if a single time_pattern trigger matches."""
        # Check hours, minutes, seconds. Default to wildcards if missing?? 
        # Actually usually if missing it means 0 or *? 
        # Home Assistant defaults: if omitted, it matches '*' for time_pattern? 
        # No, HA docs say: "At least one of hours, minutes or seconds must be specified."
        # If not specified, it matches *? No, HA matches * if specified as *.
        # But here my UI defaults empty strings or numbers. 
        # Let's assume omitted means '*' (match any) for now, or handled by UI sending '*'
        
        return (
            self._match_time_part(trigger.get("hours"), now.hour) and
            self._match_time_part(trigger.get("minutes"), now.minute) and
            self._match_time_part(trigger.get("seconds"), now.second)
        )

    def _match_time_part(self, pattern: Any, current: int) -> bool:
        """Match a time part (hour/minute/second) against a pattern."""
        # Convert explicit int to string for consistent handling, or handle int directly
        if pattern is None or pattern == "":
            return True # Treat empty as wildcard? Or should it be 0? 
                        # In my UI I used placeholders. The store initializes to strings.
                        # If undefined in JSON, assuming wildcard makes sense for 'every' semantically 
                        # but usually 'at 10:00' implies seconds=0 if omitted.
                        # However, 'time_pattern' is powerful. 
                        # Let's treat None/Empty as '*' (Any).
            return True
            
        s_pattern = str(pattern).strip()
        
        if s_pattern == "*":
            return True
            
        if s_pattern.startswith("/"):
            try:
                divisor = int(s_pattern[1:])
                if divisor == 0: return False # Prevent division by zero
                return current % divisor == 0
            except ValueError:
                pass
        
        # Exact match (number)
        try:
            return int(s_pattern) == current
        except ValueError:
            return False

    def _evaluate_on_state_change(self, ieee_address: str, state: dict):
        """
        Evaluate all automations when a device state changes.
        Triggered automations are scheduled for async execution.
        """
        for rule in self._rules:
            try:
                rule_id = rule.get("id", rule.get("name", "unknown"))
                
                # Skip if this automation is already running (cooldown)
                if rule_id in self._running_automations:
                    continue
                
                # Check if any trigger matches this state change (OR logic)
                if not self._check_triggers(rule, ieee_address, state):
                    continue
                
                # Check if all conditions are satisfied (AND logic)
                if not self._check_conditions(rule):
                    logger.debug(f"Automation '{rule.get('name')}' triggered but conditions not met")
                    continue
                
                logger.info(f"Automation '{rule.get('name')}' triggered and conditions met — scheduling execution")
                
                # Schedule async action execution on the event loop
                self._schedule_actions(rule_id, rule.get("name", "?"), rule.get("actions", []))
                
            except Exception as e:
                logger.error(f"Error evaluating automation '{rule.get('name', '?')}': {e}")
    
    def _schedule_actions(self, rule_id: str, rule_name: str, actions: List[dict]):
        """Schedule async action execution on the event loop."""
        if not self._event_loop:
            logger.error("No event loop set — cannot execute actions asynchronously")
            # Fallback: execute synchronously without delays
            self._execute_actions_sync(actions)
            return
        
        self._running_automations.add(rule_id)
        asyncio.run_coroutine_threadsafe(
            self._execute_actions_async(rule_id, rule_name, actions),
            self._event_loop
        )
    
    def _check_triggers(self, rule: dict, ieee_address: str, state: dict) -> bool:
        """Check if any trigger matches (OR logic)."""
        triggers = rule.get("triggers", [])
        
        for trigger in triggers:
            trigger_type = trigger.get("type")
            
            if trigger_type == "state":
                if self._check_state_trigger(trigger, ieee_address, state):
                    return True
            elif trigger_type == "device_state_changed":
                if self._check_device_state_changed_trigger(trigger, ieee_address, state):
                    return True
            # Time triggers handled separately by scheduler
            
        return False
    
    def _check_device_state_changed_trigger(self, trigger: dict, ieee_address: str, state: dict) -> bool:
        """Check if a device state changed trigger matches."""
        if trigger.get("device_id") != ieee_address:
            return False
        
        entity = trigger.get("entity")
        # If entity is specified, it must be present in the state update (meaning it changed/updated)
        if entity and entity not in state:
            return False
            
        return True
    
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
    
    async def _execute_actions_async(self, rule_id: str, rule_name: str, actions: List[dict]):
        """Execute action sequence asynchronously, supporting real delays."""
        try:
            logger.info(f"▶ Starting action sequence for '{rule_name}'")
            await self._run_action_list(actions)
            logger.info(f"✔ Completed action sequence for '{rule_name}'")
        except Exception as e:
            logger.error(f"Error executing actions for '{rule_name}': {e}")
        finally:
            self._running_automations.discard(rule_id)

    async def _run_action_list(self, actions: List[dict]):
        """Run a list of actions sequentially (async)."""
        for action in actions:
            action_type = action.get("type")
            
            if action_type == "device_action":
                self._publish_device_action(action)
            
            elif action_type == "delay":
                seconds = action.get("seconds", 0)
                logger.info(f"⏳ Waiting {seconds}s...")
                await asyncio.sleep(seconds)
                logger.info(f"⏳ Delay complete")
            
            elif action_type == "choose":
                await self._run_choose(action)
            
            elif action_type == "if":
                await self._run_if(action)
            
            elif action_type == "condition":
                if not self._check_condition_action(action):
                    logger.info("Condition action failed, stopping sequence")
                    break
            
            else:
                logger.warning(f"Unknown action type: {action_type}")

    def _execute_actions_sync(self, actions: List[dict]):
        """Fallback synchronous execution (no delay support)."""
        for action in actions:
            action_type = action.get("type")
            if action_type == "device_action":
                self._publish_device_action(action)
            elif action_type == "delay":
                logger.warning(f"Delay skipped (no event loop): {action.get('seconds', 0)}s")
            elif action_type == "condition":
                if not self._check_condition_action(action):
                    break
    
    def _publish_device_action(self, action: dict):
        """Build and publish an MQTT command from a device_action."""
        device_id = action.get("device_id")
        entity = action.get("entity", "state")
        value = action.get("value")
        
        if not device_id or value is None:
            return
        
        if not self._mqtt_client:
            logger.error("No MQTT client set — cannot publish action")
            return
        
        topic = f"zigbee2mqtt/{device_id}/set"
        payload = json.dumps({entity: value})
        logger.info(f"Automation action → {topic}: {payload}")
        self._mqtt_client.publish(topic, payload)
    
    async def _run_choose(self, action: dict):
        """Execute choose block: test conditions and run first matching choice."""
        choices = action.get("choices", [])
        default = action.get("default", [])
        
        for choice in choices:
            choice_conditions = choice.get("conditions", [])
            if self._check_conditions({"conditions": choice_conditions}):
                await self._run_action_list(choice.get("sequence", []))
                return
        
        # No choice matched, execute default
        await self._run_action_list(default)
    
    async def _run_if(self, action: dict):
        """Execute if-then-else block."""
        conditions = action.get("conditions", [])
        then_actions = action.get("then", [])
        else_actions = action.get("else", [])
        
        if self._check_conditions({"conditions": conditions}):
            await self._run_action_list(then_actions)
        else:
            await self._run_action_list(else_actions)
    
    def _check_condition_action(self, action: dict) -> bool:
        """Check if condition action passes."""
        conditions = action.get("conditions", [])
        return self._check_conditions({"conditions": conditions})
