/*
  Smart EcoLock System
  -------------------
  Features:
  • RFID-based access control with role management (Admin, Instructor, Student)
  • Real-time Firebase integration for user management and access logs
  • Scheduling system for class access control
  • Weight sensor verification for enhanced security
  • Power consumption monitoring via PZEM-004T
  • SD card logging for offline operation
  • OTA updates support
  • Watchdog timer for system stability
*/

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <MFRC522.h>
#include <SPI.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <PZEM004Tv30.h>
#include <SD.h>
#include <HX711_ADC.h>
#include <ArduinoOTA.h>
#include <HTTPClient.h>
#include "FS.h"
#include "addons/TokenHelper.h" 
#include "addons/RTDBHelper.h"  
#include "esp_task_wdt.h"

// ----------------------
// WiFi Configuration
// ----------------------
#define WIFI_SSID       "ACSFinal"
#define WIFI_PASSWORD   "0123456789"

// ----------------------
// Firebase Configuration
// ----------------------
#define API_KEY         "AIzaSyDQIMqO4bJ-k4-pjjGnHGwCbCYUFUQe7Hw"
#define DATABASE_URL    "https://smartecolock-default-rtdb.asia-southeast1.firebasedatabase.app"

// Firebase Variables
FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;

// ----------------------
// RFID Configuration
// ----------------------
#define RST_PIN   16
#define SDA_PIN   5   
MFRC522 rfid(SDA_PIN, RST_PIN);

// Duplicate scan prevention
String lastUID = "";
unsigned long lastScanTime = 0;
const unsigned long duplicateScanInterval = 5000; // 5 seconds

// ----------------------
// GPIO Configuration
// ----------------------
#define LED_R       27  // Red LED
#define LED_G       14  // Green LED
#define LED_B       12  // Blue LED (Neutral)
#define RELAY1      25  // Lock mechanism
#define RELAY2      26  // Secondary systems
#define RELAY3      32  // Auxiliary control
#define RELAY4      35  // Emergency override
#define BUZZER      13  // Audio feedback
#define RESET_BUTTON 33 // System reset

// ----------------------
// SD Card Configuration
// ----------------------
#define SD_CS    4
#define SD_CLK   17   
#define SD_MOSI  21   
#define SD_MISO  22   

File logFile; 
SPIClass sdSPI(HSPI);

// ----------------------
// PZEM-004T Configuration
// ----------------------
HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, 15, 2);

// ----------------------
// HX711 Weight Sensors
// ----------------------
HX711_ADC scale1(34, 20);
HX711_ADC scale2(36, 28);
HX711_ADC scale3(39, 29);

// ----------------------
// Time & NTP
// ----------------------
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 8 * 3600, 60000); // UTC+8

// ----------------------
// Global Variables
// ----------------------
unsigned long lastPZEMRead = 0;
unsigned long lastLogRotation = 0;
unsigned long lastConfigCheck = 0;
bool systemArmed = true;
float weightThreshold = 10.0;
unsigned long accessTimeout = 45000;

// ----------------------
// Helper Functions
// ----------------------
String getTimestamp() {
  timeClient.update();
  unsigned long epochTime = timeClient.getEpochTime();
  time_t rawtime = (time_t)epochTime;
  struct tm* timeinfo = localtime(&rawtime);
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", timeinfo);
  return String(buffer);
}

void logToSD(String message) {
  if (!SD.begin(SD_CS, sdSPI)) {
    Serial.println("SD card initialization failed!");
    return;
  }
  
  File logFile = SD.open("/log.txt", FILE_APPEND);
  if (logFile) {
    String logEntry = getTimestamp() + " - " + message;
    logFile.println(logEntry);
    logFile.close();
    Serial.println("Logged: " + logEntry);
  }
}

void setLEDStatus(int r, int g, int b) {
  digitalWrite(LED_R, r);
  digitalWrite(LED_G, g);
  digitalWrite(LED_B, b);
}

void playTone(bool success) {
  if (success) {
    tone(BUZZER, 1000, 200);
    delay(200);
    tone(BUZZER, 1200, 200);
  } else {
    tone(BUZZER, 400, 400);
  }
  delay(200);
  noTone(BUZZER);
}

// ----------------------
// Firebase Functions
// ----------------------
void sendToFirebase(String path, String value) {
  if (WiFi.status() == WL_CONNECTED && Firebase.ready()) {
    if (Firebase.RTDB.setString(&fbdo, path, value)) {
      Serial.println("Firebase update successful: " + path);
    } else {
      Serial.println("Firebase update failed: " + fbdo.errorReason());
      logToSD("Firebase Error: " + path + " - " + fbdo.errorReason());
    }
  }
}

void uploadOfflineLogs() {
  if (!SD.exists("/log.txt")) return;
  
  File logFile = SD.open("/log.txt", FILE_READ);
  if (logFile) {
    while (logFile.available()) {
      String logEntry = logFile.readStringUntil('\n');
      if (Firebase.RTDB.pushString(&fbdo, "/OfflineLogs", logEntry)) {
        Serial.println("Uploaded offline log: " + logEntry);
      }
    }
    logFile.close();
    SD.remove("/log.txt"); // Clear processed logs
  }
}

// ----------------------
// Access Control Functions
// ----------------------
bool checkSchedule() {
  if (!Firebase.RTDB.getJSON(&fbdo, "/ClassSchedule")) {
    return true; // Allow access if can't check schedule
  }
  
  FirebaseJson &json = fbdo.jsonObject();
  FirebaseJsonData startData, endData;
  if (json.get(startData, "start") && json.get(endData, "end")) {
    String currentTime = getTimestamp().substring(11, 16); // HH:MM
    String startTime = startData.stringValue;
    String endTime = endData.stringValue;
    
    return (currentTime >= startTime && currentTime <= endTime);
  }
  return true;
}

void handleAccess(String uid, String role) {
  String timestamp = getTimestamp();
  sendToFirebase("/" + role + "/" + uid + "/LastAccess", timestamp);
  sendToFirebase("/" + role + "/" + uid + "/AccessLogs/" + String(random(0xFFFFFFFF)), timestamp);
  
  // Activate relays
  digitalWrite(RELAY1, LOW);
  digitalWrite(RELAY2, LOW);
  delay(1000);
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  
  setLEDStatus(0, 1, 0); // Green
  playTone(true);
}

void denyAccess(String reason) {
  setLEDStatus(1, 0, 0); // Red
  playTone(false);
  logToSD("Access Denied: " + reason);
}

bool verifyWeight() {
  unsigned long startTime = millis();
  while (millis() - startTime < 10000) { // 10-second window
    scale1.update();
    scale2.update();
    scale3.update();
    
    float w1 = scale1.getData();
    float w2 = scale2.getData();
    float w3 = scale3.getData();
    
    if (w1 >= weightThreshold || w2 >= weightThreshold || w3 >= weightThreshold) {
      return true;
    }
    delay(100);
  }
  return false;
}

// ----------------------
// RFID Processing
// ----------------------
void processRFIDCard(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    logToSD("Offline Access Attempt - UID: " + uid);
    denyAccess("No connection");
    return;
  }

  // Check Admin
  if (Firebase.RTDB.getJSON(&fbdo, "/Admin/" + uid)) {
    handleAccess(uid, "Admin");
    return;
  }

  // Check Instructor
  if (Firebase.RTDB.getJSON(&fbdo, "/Instructors/" + uid)) {
    if (!checkSchedule()) {
      denyAccess("Outside schedule");
      return;
    }
    handleAccess(uid, "Instructors");
    return;
  }

  // Check Student
  if (Firebase.RTDB.getJSON(&fbdo, "/Students/" + uid)) {
    if (!checkSchedule()) {
      denyAccess("Outside schedule");
      return;
    }
    if (!verifyWeight()) {
      denyAccess("Weight verification failed");
      return;
    }
    handleAccess(uid, "Students");
    return;
  }

  // Unregistered card
  sendToFirebase("/NewRFIDTag", uid);
  denyAccess("Unregistered card");
}

// ----------------------
// Setup
// ----------------------
void setup() {
  Serial.begin(115200);
  
  // Initialize watchdog
  esp_task_wdt_init(10, true);
  esp_task_wdt_add(NULL);

  // Initialize GPIOs
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  
  digitalWrite(RELAY1, HIGH);
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);
  setLEDStatus(0, 0, 1); // Blue - Starting up
  
  // Initialize RFID
  SPI.begin(18, 19, 23, SDA_PIN);
  rfid.PCD_Init(SDA_PIN, RST_PIN);
  
  // Initialize SD Card
  sdSPI.begin(SD_CLK, SD_MISO, SD_MOSI, SD_CS);
  if (SD.begin(SD_CS, sdSPI)) {
    Serial.println("SD card initialized");
  }
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Initialize Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.signUp(&config, &auth, "", "");
  Firebase.begin(&config, &auth);
  
  // Initialize NTP
  timeClient.begin();
  
  // Initialize Weight Sensors
  scale1.begin();
  scale2.begin();
  scale3.begin();
  scale1.start(2000);
  scale2.start(2000);
  scale3.start(2000);
  scale1.setCalFactor(1100.0);
  scale2.setCalFactor(1100.0);
  scale3.setCalFactor(1100.0);
  
  // Initialize PZEM
  pzemSerial.begin(9600, SERIAL_8N1, 2, 15);
  
  // Initialize OTA
  ArduinoOTA.begin();
  
  Serial.println("System Ready");
  setLEDStatus(0, 0, 1); // Blue - Ready
}

// ----------------------
// Main Loop
// ----------------------
void loop() {
  esp_task_wdt_reset();
  ArduinoOTA.handle();
  
  // Check WiFi and reconnect if needed
  if (WiFi.status() != WL_CONNECTED) {
    setLEDStatus(1, 0, 1); // Purple - No connection
    WiFi.reconnect();
    delay(500);
    return;
  }
  
  // Process RFID Cards
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    
    // Prevent duplicate scans
    if (uid != lastUID || (millis() - lastScanTime >= duplicateScanInterval)) {
      lastUID = uid;
      lastScanTime = millis();
      processRFIDCard(uid);
    }
    
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
  
  // Read PZEM sensor every 10 seconds
  if (millis() - lastPZEMRead >= 10000) {
    lastPZEMRead = millis();
    float voltage = pzem.voltage();
    float current = pzem.current();
    float power = pzem.power();
    float energy = pzem.energy();
    
    if (voltage > 0) {
      FirebaseJson sensorData;
      sensorData.add("voltage", voltage);
      sensorData.add("current", current);
      sensorData.add("power", power);
      sensorData.add("energy", energy);
      sensorData.add("timestamp", getTimestamp());
      
      if (Firebase.RTDB.setJSON(&fbdo, "/SensorData", &sensorData)) {
        Serial.println("Power data uploaded");
      }
    }
  }
  
  // Check for system reset
  if (digitalRead(RESET_BUTTON) == LOW) {
    delay(3000); // Hold for 3 seconds
    if (digitalRead(RESET_BUTTON) == LOW) {
      Serial.println("System reset triggered");
      setLEDStatus(1, 1, 1); // White - Resetting
      tone(BUZZER, 1000, 1000);
      delay(1000);
      ESP.restart();
    }
  }
  
  // Rotate logs if needed
  if (millis() - lastLogRotation >= 3600000) { // Every hour
    lastLogRotation = millis();
    uploadOfflineLogs();
  }
  
  delay(50); // Small delay to prevent tight looping
}
