#include <LittleFS.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <map>

// Mock Device Configuration
#define SENSOR_SOIL_MOISTURE "soil_moisture"
#define SENSOR_TEMPERATURE "temperature"
#define SENSOR_LIGHT "light"

// Default values
char api_server[64] = "http://192.168.1.100:8000";
char user_email[64] = "admin@example.com";

// Configuration flags
bool shouldSaveConfig = false;

// Hub State
String deviceId;
String apiKey = "";
bool isApproved = false;

// Mock Data State
int mock_soil_moisture = 50;
float mock_temperature = 22.5;
bool mock_valve_state = false;

// Web Server for Mock UI
ESP8266WebServer server(80);

void saveConfigCallback () {
  Serial.println("Should save config");
  shouldSaveConfig = true;
}

void setupSpiffs() {
  if (LittleFS.begin()) {
    if (LittleFS.exists("/config.json")) {
      File configFile = LittleFS.open("/config.json", "r");
      if (configFile) {
        size_t size = configFile.size();
        std::unique_ptr<char[]> buf(new char[size]);
        configFile.readBytes(buf.get(), size);
        DynamicJsonDocument json(1024);
        if (!deserializeJson(json, buf.get())) {
          strcpy(api_server, json["api_server"]);
          strcpy(user_email, json["user_email"]);
          if (json.containsKey("api_key")) apiKey = json["api_key"].as<String>();
          if (json.containsKey("is_approved")) isApproved = json["is_approved"];
        }
      }
    }
  } else {
    Serial.println("Failed to mount FS");
    LittleFS.format();
  }
}

void saveConfig() {
  DynamicJsonDocument json(1024);
  json["api_server"] = api_server;
  json["user_email"] = user_email;
  json["api_key"] = apiKey;
  json["is_approved"] = isApproved;

  File configFile = LittleFS.open("/config.json", "w");
  if (configFile) {
    serializeJson(json, configFile);
    configFile.close();
  }
}

void handleReset() {
  WiFiManager wm;
  wm.resetSettings();
  LittleFS.format(); // Also clear our config
  server.send(200, "text/plain", "Settings cleared. Rebooting into AP mode...");
  delay(1000);
  ESP.reset();
}

void handleSaveSettings() {
  if (server.hasArg("server") && server.hasArg("email")) {
    String s = server.arg("server");
    String e = server.arg("email");
    
    // Simple validation could go here
    if (s.length() < 64 && e.length() < 64) {
      strcpy(api_server, s.c_str());
      strcpy(user_email, e.c_str());
      saveConfig();
      server.sendHeader("Location", "/");
      server.send(303);
      // Optional: Reset approval if server changes? 
      // For now keeping it simple. User might need to re-approve if key is invalid on new server.
    } else {
      server.send(400, "text/plain", "Input too long");
    }
  } else {
    server.send(400, "text/plain", "Missing arguments");
  }
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>YieldAssist Hub Mock</title>";
  html += "<style>body{font-family:Arial;text-align:center;padding:20px;max-width:600px;margin:0 auto;} .slider{width:80%;} .card{background:#f4f4f4;padding:20px;margin:10px 0;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);} .btn{padding:10px 20px;border:none;border-radius:5px;cursor:pointer;font-size:16px;} .btn-red{background:#ff4444;color:white;}</style></head><body>";
  html += "<h1>YieldAssist Hub</h1>";
  html += "<div class='card'>";
  html += "<p><strong>Device ID:</strong> " + deviceId + "</p>";
  
  if (isApproved) {
    html += "<p style='color:green;font-weight:bold;'>Status: Connected</p>";
  } else {
    html += "<p style='color:orange;font-weight:bold;'>Status: Pending Approval</p>";
  }
  html += "</div>";

  // Configuration Form
  html += "<div class='card'><h3>Configuration</h3>";
  html += "<form action='/save_settings' method='POST'>";
  html += "<p><label>Server URL:</label><br><input type='text' name='server' value='" + String(api_server) + "' style='width:90%;padding:5px;'></p>";
  html += "<p><label>User Email:</label><br><input type='text' name='email' value='" + String(user_email) + "' style='width:90%;padding:5px;'></p>";
  html += "<button type='submit' class='btn' style='background:#2196F3;color:white;'>Update Config</button>";
  html += "</form></div>";

  // Mock Controls
  html += "<div class='card'><h2>Soil Moisture</h2>";
  html += "<input type='range' min='0' max='100' value='" + String(mock_soil_moisture) + "' class='slider' onchange='updateValue(\"moisture\", this.value)'>";
  html += "<p>Value: <span id='moisture_val'>" + String(mock_soil_moisture) + "</span>%</p></div>";

  html += "<div class='card'><h2>Temperature</h2>";
  html += "<input type='range' min='0' max='50' value='" + String(mock_temperature) + "' class='slider' onchange='updateValue(\"temp\", this.value)'>";
  html += "<p>Value: <span id='temp_val'>" + String(mock_temperature) + "</span>&deg;C</p></div>";
  
  html += "<div class='card'><h2>Valve Control</h2>";
  html += "<button onclick='toggleValve()' class='btn' style='background:" + String(mock_valve_state ? "green" : "gray") + ";color:white;'>" + String(mock_valve_state ? "OPEN" : "CLOSED") + "</button></div>";

  html += "<div class='card'><h3>Settings</h3>";
  html += "<button onclick='if(confirm(\"Reset all settings?\")) location.href=\"/reset\"' class='btn btn-red'>Reset WiFi & Config</button>";
  html += "</div>";

  html += "<script>function updateValue(type, val){document.getElementById(type+'_val').innerText = val; fetch('/set?type='+type+'&val='+val);} function toggleValve(){fetch('/toggle'); setTimeout(()=>location.reload(), 500);}</script>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleSet() {
  if (server.hasArg("type") && server.hasArg("val")) {
    String type = server.arg("type");
    float val = server.arg("val").toFloat();
    if (type == "moisture") mock_soil_moisture = (int)val;
    if (type == "temp") mock_temperature = val;
  }
  server.send(200, "text/plain", "OK");
}

void handleToggle() {
  mock_valve_state = !mock_valve_state;
  server.send(200, "text/plain", "OK");
}

DynamicJsonDocument automationsDoc(4096);
std::map<String, bool> ruleStates;

void loadAutomations() {
  if (LittleFS.exists("/automations.json")) {
    File file = LittleFS.open("/automations.json", "r");
    if (file) {
      deserializeJson(automationsDoc, file);
      file.close();
      Serial.println("Loaded local automations");
    }
  }
}

void saveAutomations() {
  File file = LittleFS.open("/automations.json", "w");
  if (file) {
    serializeJson(automationsDoc, file);
    file.close();
    Serial.println("Saved local automations");
  }
}

bool evaluateBlock(JsonObject block) {
  String type = block["type"];
  if (type == "sensor") {
    String attr = block["attribute"];
    String op = block["operator"];
    float target = block["value"];
    float current = 0;

    if (attr == "soil_moisture") current = mock_soil_moisture;
    else if (attr == "temperature") current = mock_temperature;
    
    if (op == "<") return current < target;
    if (op == ">") return current > target;
    if (op == "==") return current == target;
    if (op == "!=") return current != target;
  }
  return false;
}

void executeAction(JsonObject action) {
  String type = action["type"];
  if (type == "valve" || action.containsKey("action")) {
    String act = action["action"];
    if (act == "open") mock_valve_state = true;
    else if (act == "close") mock_valve_state = false;
    else if (act == "toggle") mock_valve_state = !mock_valve_state;
    Serial.println("Automation triggered action: " + act);
  }
}

void processLocalAutomations() {
  if (!automationsDoc.is<JsonArray>()) return;
  
  JsonArray rules = automationsDoc.as<JsonArray>();
  for (JsonObject rule : rules) {
    String ruleId = rule["id"] | "unknown";
    bool isEnabled = rule["is_enabled"] | true;
    if (!isEnabled) continue;

    // Triggers (When) - At least one must be true
    bool triggered = false;
    JsonArray triggers = rule["triggers"];
    for (JsonObject t : triggers) {
      if (evaluateBlock(t)) {
        triggered = true;
        break;
      }
    }
    
    // Conditions (And If) - All must be true
    bool conditionsMet = true;
    if (triggered) {
      JsonArray conditions = rule["conditions"];
      for (JsonObject c : conditions) {
        if (!evaluateBlock(c)) {
          conditionsMet = false;
          break;
        }
      }
    }

    bool currentlyActive = triggered && conditionsMet;
    bool previouslyActive = ruleStates[ruleId];

    // Edge Trigger: Only execute if transitioning from inactive to active
    if (currentlyActive && !previouslyActive) {
      JsonArray actions = rule["actions"];
      for (JsonObject a : actions) {
        executeAction(a);
      }
    }

    // Store state for next comparison
    ruleStates[ruleId] = currentlyActive;
  }
}

// ISRG Root X1 Certificate (Let's Encrypt)
const char* lets_encrypt_root_ca = \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"-----END CERTIFICATE-----\n";

void registerHub() {
  std::unique_ptr<WiFiClient> client;
  X509List cert(lets_encrypt_root_ca);
  bool isSecure = String(api_server).startsWith("https");

  if (isSecure) {
    WiFiClientSecure *sClient = new WiFiClientSecure();
    sClient->setTrustAnchors(&cert);
    client.reset(sClient);
  } else {
    client.reset(new WiFiClient());
  }

  HTTPClient http;
  String url = String(api_server) + "/api/hubs/register";
  
  Serial.print("Connecting to: ");
  Serial.println(url);
  Serial.print("WiFi Status: ");
  Serial.println(WiFi.status());
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());

  http.begin(*client, url);
  http.addHeader("Content-Type", "application/json");

  DynamicJsonDocument doc(1024);
  doc["device_id"] = deviceId;
  doc["email"] = user_email;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  Serial.printf("Register Hub: %d\n", httpCode);
  http.end();
}

void checkApproval() {
  std::unique_ptr<WiFiClient> client;
  X509List cert(lets_encrypt_root_ca);
  bool isSecure = String(api_server).startsWith("https");

  if (isSecure) {
    WiFiClientSecure *sClient = new WiFiClientSecure();
    sClient->setTrustAnchors(&cert);
    client.reset(sClient);
  } else {
    client.reset(new WiFiClient());
  }

  HTTPClient http;
  String url = String(api_server) + "/api/hubs/check-status";
  
  http.begin(*client, url);
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["device_id"] = deviceId;
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument res(1024);
    deserializeJson(res, payload);
    
    bool approved = res["is_approved"];
    if (approved) {
      apiKey = res["api_key"].as<String>();
      isApproved = true;
      saveConfig();
      Serial.println("Hub Approved! API Key saved.");
    }
  }
  http.end();
}

void sendSensorData() {
  if (!isApproved) return;
  
  std::unique_ptr<WiFiClient> client;
  X509List cert(lets_encrypt_root_ca);
  bool isSecure = String(api_server).startsWith("https");

  if (isSecure) {
    WiFiClientSecure *sClient = new WiFiClientSecure();
    sClient->setTrustAnchors(&cert);
    client.reset(sClient);
  } else {
    client.reset(new WiFiClient());
  }

  HTTPClient http;
  String url = String(api_server) + "/api/hubs/data";
  
  http.begin(*client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hub-Api-Key", apiKey);
  
  DynamicJsonDocument doc(2048);
  JsonArray readings = doc.createNestedArray("readings");
  
  JsonObject r1 = readings.createNestedObject();
  r1["sensor_id"] = "moisture";
  r1["sensor_type"] = "soil_moisture";
  r1["value"] = mock_soil_moisture;
  
  JsonObject r2 = readings.createNestedObject();
  r2["sensor_id"] = "temp";
  r2["sensor_type"] = "temperature";
  r2["value"] = mock_temperature;

  JsonArray valves = doc.createNestedArray("valves");
  JsonObject v1 = valves.createNestedObject();
  v1["valve_id"] = "main_valve";
  v1["is_open"] = mock_valve_state;
  
  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  Serial.printf("Send Data: %d\n", httpCode);

  if (httpCode == 200) {
      String payload = http.getString();
      DynamicJsonDocument res(4096);
      DeserializationError error = deserializeJson(res, payload);
      
      if (!error) {
           // Process Sync Commands
           if (res.containsKey("sync")) {
               JsonObject sync = res["sync"];
               if (sync.containsKey("valves")) {
                   JsonArray valvesArr = sync["valves"];
                   for (JsonObject v : valvesArr) {
                       String vid = v["valve_id"];
                       if (vid == "main_valve") {
                           mock_valve_state = v["is_open"];
                           Serial.printf("Synced valve state: %d\n", mock_valve_state);
                       }
                   }
               }
           }
           
           // Process/Update Automations
           if (res.containsKey("automations")) {
               automationsDoc = res["automations"];
               saveAutomations();
               Serial.println("Updated local automations from server");
           }
      }
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  setupSpiffs();
  loadAutomations();

  WiFiManager wifiManager;
  wifiManager.setSaveConfigCallback(saveConfigCallback);
  
  WiFiManagerParameter custom_api_server("server", "API Server", api_server, 64);
  WiFiManagerParameter custom_user_email("email", "User Email", user_email, 64);
  
  wifiManager.addParameter(&custom_api_server);
  wifiManager.addParameter(&custom_user_email);

  if (!wifiManager.autoConnect("YieldAssist-Hub")) {
    delay(3000);
    ESP.reset();
  }

  strcpy(api_server, custom_api_server.getValue());
  strcpy(user_email, custom_user_email.getValue());

  if (shouldSaveConfig) saveConfig();

  deviceId = WiFi.macAddress();
  Serial.println("Device ID: " + deviceId);

  server.on("/", handleRoot);
  server.on("/set", handleSet);
  server.on("/toggle", handleToggle);
  server.on("/save_settings", handleSaveSettings);
  server.on("/reset", handleReset);
  server.begin();
}

unsigned long lastPoll = 0;
unsigned long lastData = 0;

void loop() {
  server.handleClient();
  
  if (millis() - lastPoll > 10000) {
    lastPoll = millis();
    if (!isApproved) {
      registerHub(); // Keep trying to register/ensure registered
      checkApproval();
    }
  }
  
  if (isApproved && millis() - lastData > 5000) {
     lastData = millis();
     sendSensorData();
  }

  processLocalAutomations();
}
