#include <LittleFS.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <WiFiManager.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <map>
#include <algorithm>

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
struct SensorData {
  String id;
  String type;
  float value;
};
struct RelayData {
  String id;
  bool state;
};

std::vector<SensorData> pairedSensors;
std::vector<RelayData> pairedRelays;

// Web Server for Mock UI
ESP8266WebServer server(80);

void saveDevices() {
  DynamicJsonDocument doc(2048);
  JsonArray sArr = doc.createNestedArray("sensors");
  for (auto &s : pairedSensors) {
    JsonObject obj = sArr.createNestedObject();
    obj["id"] = s.id;
    obj["type"] = s.type;
    obj["val"] = s.value;
  }
  JsonArray rArr = doc.createNestedArray("relays");
  for (auto &r : pairedRelays) {
    JsonObject obj = rArr.createNestedObject();
    obj["id"] = r.id;
    obj["state"] = r.state;
  }
  File file = LittleFS.open("/devices.json", "w");
  if (file) {
    serializeJson(doc, file);
    file.close();
  }
}

void loadDevices() {
  if (LittleFS.exists("/devices.json")) {
    File file = LittleFS.open("/devices.json", "r");
    if (file) {
      DynamicJsonDocument doc(2048);
      deserializeJson(doc, file);
      JsonArray sArr = doc["sensors"];
      for (JsonObject s : sArr) {
        pairedSensors.push_back({s["id"], s["type"], s["val"]});
      }
      JsonArray rArr = doc["relays"];
      for (JsonObject r : rArr) {
        pairedRelays.push_back({r["id"], r["state"]});
      }
      file.close();
    }
  }
}

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
    
    if (s.length() < 64 && e.length() < 64) {
      strcpy(api_server, s.c_str());
      strcpy(user_email, e.c_str());
      saveConfig();
      server.sendHeader("Location", "/");
      server.send(303);
    } else {
      server.send(400, "text/plain", "Input too long");
    }
  } else {
    server.send(400, "text/plain", "Missing arguments");
  }
}

void handlePair() {
  String type = server.arg("type");
  String unitId = "dev_" + String(random(1000, 9999)); // More robust semi-unique ID
  
  if (type == "sensor") {
    // Add 4 sensors
    pairedSensors.push_back({unitId + ":moisture", "soil_moisture", 30.0});
    pairedSensors.push_back({unitId + ":temp", "temperature", 22.5});
    pairedSensors.push_back({unitId + ":humidity", "humidity", 45.0});
    pairedSensors.push_back({unitId + ":light", "light", 500.0});
  } else if (type == "relay") {
    // Add 1 relay
    pairedRelays.push_back({unitId + ":relay_1", false});
  }

  saveDevices();
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleRemove() {
  if (server.hasArg("id")) {
    String prefix = server.arg("id");
    if (!prefix.endsWith(":")) prefix += ":";
    
    // Remove all entities belonging to this unit
    pairedSensors.erase(std::remove_if(pairedSensors.begin(), pairedSensors.end(), [&](SensorData &s){ return s.id.startsWith(prefix); }), pairedSensors.end());
    pairedRelays.erase(std::remove_if(pairedRelays.begin(), pairedRelays.end(), [&](RelayData &r){ return r.id.startsWith(prefix); }), pairedRelays.end());
    
    saveDevices();
  }
  server.sendHeader("Location", "/");
  server.send(303);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>YieldAssist Hub Mock</title>";
  html += "<style>body{font-family:Arial;text-align:center;padding:10px;max-width:800px;margin:0 auto;background:#f0f2f5;} .card{background:white;padding:20px;margin:10px 0;border-radius:15px;box-shadow:0 4px 6px rgba(0,0,0,0.05);} .btn{padding:10px 20px;border:none;border-radius:8px;cursor:pointer;font-weight:bold;transition:all 0.2s;} .btn-primary{background:#007bff;color:white;} .btn-danger{background:#dc3545;color:white;padding:5px 10px;} .btn-success{background:#28a745;color:white;} .btn-gray{background:#6c757d;color:white;} .slider{width:100%;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{padding:12px;text-align:left;border-bottom:1px solid #eee;} .badge{padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;text-transform:uppercase;} .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;} @media(max-width:600px){.grid{grid-template-columns:1fr;}}</style></head><body>";
  html += "<h1>YieldAssist Hub</h1>";
  
  html += "<div class='grid'>";
  
  // Status & Config
  html += "<div><div class='card'>";
  html += "<p><strong>ID:</strong> " + deviceId + "</p>";
  html += isApproved ? "<p style='color:green;'>● Connected</p>" : "<p style='color:orange;'>● Pending Approval</p>";
  html += "</div>";

  html += "<div class='card'><h3>System Setup</h3>";
  html += "<form action='/save_settings' method='POST'>";
  html += "<input type='text' name='server' value='" + String(api_server) + "' placeholder='Server' style='width:90%;margin-bottom:10px;'><br>";
  html += "<input type='text' name='email' value='" + String(user_email) + "' placeholder='Email' style='width:90%;margin-bottom:10px;'><br>";
  html += "<button type='submit' class='btn btn-primary'>Apply Config</button>";
  html += "</form></div></div>";

  // Pairing Actions
  html += "<div class='card'><h3>Add Hardware</h3>";
  html += "<div style='display:flex;gap:10px;justify-content:center;'>";
  html += "<form action='/pair' method='GET'><input type='hidden' name='type' value='sensor'><button type='submit' class='btn btn-success'>Pair Sensor (4 In 1)</button></form>";
  html += "<form action='/pair' method='GET'><input type='hidden' name='type' value='relay'><button type='submit' class='btn btn-success'>Pair Relay (1 Ch)</button></form>";
  html += "</div></div>";

  html += "</div>"; // end grid

  // Grouped Devices List
  std::map<String, std::vector<SensorData>> groupedSensors;
  for(auto &s : pairedSensors) {
    int colonPos = s.id.indexOf(':');
    String unit = (colonPos != -1) ? s.id.substring(0, colonPos) : "Standalone";
    groupedSensors[unit].push_back(s);
  }

  std::map<String, std::vector<RelayData>> groupedRelays;
  for(auto &r : pairedRelays) {
    int colonPos = r.id.indexOf(':');
    String unit = (colonPos != -1) ? r.id.substring(0, colonPos) : "Standalone";
    groupedRelays[unit].push_back(r);
  }

  // Get unique units
  std::vector<String> units;
  for(auto const& it : groupedSensors) units.push_back(it.first);
  for(auto const& it : groupedRelays) {
    if (std::find(units.begin(), units.end(), it.first) == units.end()) units.push_back(it.first);
  }

  for (String unit : units) {
    html += "<div class='card'><h2>Unit: " + unit + " <button onclick='removeDev(\"" + unit + "\")' class='btn btn-danger' style='float:right;'>Remove Unit</button></h2>";
    html += "<table><tr><th>Entity</th><th>Type</th><th>Control / Status</th></tr>";
    
    if (groupedSensors.count(unit)) {
      for (auto &s : groupedSensors[unit]) {
        html += "<tr><td><code>" + s.id + "</code></td>";
        html += "<td><span class='badge' style='background:#e7f3ff;color:#007bff;'>" + s.type + "</span></td>";
        html += "<td><input type='range' min='0' max='1000' value='" + String((int)s.value) + "' class='slider' onchange='updateVal(\"" + s.id + "\", this.value)'><br>" + String(s.value) + "</td></tr>";
      }
    }

    if (groupedRelays.count(unit)) {
      for (auto &r : groupedRelays[unit]) {
        html += "<tr><td><code>" + r.id + "</code></td>";
        html += "<td><span class='badge' style='background:#fef1f2;color:#dc3545;'>RELAY</span></td>";
        html += "<td><button onclick='toggleRelay(\"" + r.id + "\")' class='btn " + String(r.state ? "btn-success" : "btn-gray") + "'>" + String(r.state ? "ON" : "OFF") + "</button></td></tr>";
      }
    }
    html += "</table></div>";
  }

  html += "<div class='card'><button onclick='if(confirm(\"Reset?\"))location.href=\"/reset\"' class='btn btn-danger'>Factory Reset</button></div>";

  html += "<script>function updateVal(id,val){fetch('/set?id='+id+'&val='+val);} function toggleRelay(id){fetch('/toggle?id='+id); setTimeout(()=>location.reload(), 200);} function removeDev(id){if(confirm(\"Remove \"+id+\"?\")) {fetch('/remove?id='+id); setTimeout(()=>location.reload(), 200);}}</script>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleSet() {
  if (server.hasArg("id") && server.hasArg("val")) {
    String id = server.arg("id");
    float val = server.arg("val").toFloat();
    for (auto &s : pairedSensors) {
      if (s.id == id) s.value = val;
    }
  }
  server.send(200, "text/plain", "OK");
}

void handleToggle() {
  if (server.hasArg("id")) {
    String id = server.arg("id");
    for (auto &r : pairedRelays) {
      if (r.id == id) r.state = !r.state;
    }
  }
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
    String devId = block["device_id"];
    String op = block["operator"];
    float target = block["value"];
    float current = -1;

    for (auto &s : pairedSensors) {
      if (s.id == devId) {
        current = s.value;
        break;
      }
    }
    
    if (current == -1) return false;
    
    if (op == "<") return current < target;
    if (op == ">") return current > target;
    if (op == "==") return current == target;
    if (op == "!=") return current != target;
  }
  return false;
}

void executeAction(JsonObject action) {
  String devId = action["device_id"];
  String act = action["action"];
  
  for (auto &r : pairedRelays) {
    if (r.id == devId) {
      if (act == "open") r.state = true;
      else if (act == "close") r.state = false;
      else if (act == "toggle") r.state = !r.state;
      Serial.println("Automation triggered " + devId + ": " + act);
      break;
    }
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
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n" \
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n" \
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n" \
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n" \
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n" \
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n" \
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n" \
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n" \
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n" \
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n" \
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n" \
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n" \
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n" \
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n" \
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n" \
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n" \
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n" \
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n" \
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n" \
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n" \
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n" \
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n" \
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n" \
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n" \
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
  
  DynamicJsonDocument doc(4096);
  JsonArray readings = doc.createNestedArray("readings");
  for (auto &s : pairedSensors) {
    JsonObject obj = readings.createNestedObject();
    obj["sensor_id"] = s.id;
    obj["sensor_type"] = s.type;
    obj["value"] = s.value;
  }

  JsonArray valves = doc.createNestedArray("valves");
  for (auto &r : pairedRelays) {
    JsonObject obj = valves.createNestedObject();
    obj["valve_id"] = r.id;
    obj["is_open"] = r.state;
  }
  
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
                       for (auto &r : pairedRelays) {
                           if (r.id == vid) {
                               r.state = v["is_open"];
                               Serial.println("Synced relay " + vid + ": " + String(r.state));
                           }
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
  loadDevices();
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
  server.on("/pair", handlePair);
  server.on("/remove", handleRemove);
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
