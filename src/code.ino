#include <Wire.h>
#include <LiquidCrystal_I2C_Hangul.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <MFRC522.h>
#include <SPI.h>
#include <SD.h>
#include <PZEM004Tv30.h>
#include <HX711_ADC.h>  // Replace HX711.h
#include "freertos/FreeRTOS.h"
#include "freertos/timers.h"
#include <time.h>
#include <vector>
#include <map>
#include <esp_sleep.h>
#include <ThreeWire.h>  // DS1302 communication
#include <String.h>
#include <RtcDS1302.h>  // DS1302 RTC library
#include <set>

// Add missing variable declarations
bool uidDetailsFetched = false;
std::map<String, bool> uidDetailsPrinted;

// Forward declarations for functions
void initSDCard();
void rfidTask(void * parameter);

// Function Prototypes
void connectWiFi();
void initFirebase();
String getUIDString();
void resetFeedbackAndRestart();
void nonBlockingDelay(unsigned long ms);
void printSDCardInfo();
void accessFeedback();
void deniedFeedback();
void storeLogToSD(String entry);
bool syncOfflineLogs();
void watchdogCheck();
String getFormattedTime();
bool checkResetButton();
void showNeutral();
void logInstructor(String uid, String timestamp, String action);
void logStudentToRTDB(String rfidUid, String timestamp, int sensorIndex, String status, String timeOut = "");
void logPZEMData(String uid, float voltage, float current, float power, float energy, float frequency, float pf);
void logUnregisteredUID(String uid, String timestamp);
void logAdminAccess(String uid, String timestamp);
void logAdminTamperStop(String uid, String timestamp);
void logSystemEvent(String event);
bool isRegisteredUID(String uid);
void fetchRegisteredUIDs();
void fetchFirestoreTeachers();
void fetchFirestoreStudents();
void displayMessage(String line1, String line2, unsigned long duration);
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void resetWeightSensors();
void enterPowerSavingMode();
void exitPowerSavingMode();
void recoverI2C();
void activateRelays();
void deactivateRelays();
void fetchFirestoreRooms();
void assignRoomToInstructor(String uid, String timestamp);
void updateRoomStatus(String roomId, String status, String instructorName, String subject, String sessionStart, String sessionEnd, float startReading, float endReading, float totalUsage);
String getDate();
bool isAdminUID(String uid);
std::map<String, String> fetchUserDetails(String uid);

// Global Objects and Pin Definitions
LiquidCrystal_I2C_Hangul lcd(0x27, 16, 2);

#define WIFI_SSID "CIT-U_SmartEco_Lock"
#define WIFI_PASSWORD "123456789"
#define API_KEY "AIzaSyCnBauXgFmxyWWO5VHcGUNToGy7lulbN6E"
#define DATABASE_URL "https://smartecolock-94f5a-default-rtdb.asia-southeast1.firebasedatabase.app/"
#define FIRESTORE_PROJECT_ID "smartecolock-94f5a"

FirebaseData fbdo;
FirebaseData streamFbdo;
FirebaseData firestoreFbdo;
FirebaseConfig config;
FirebaseAuth auth;

#define MFRC522_SCK 14
#define MFRC522_MISO 13
#define MFRC522_MOSI 11
#define MFRC522_CS 15
#define MFRC522_RST 2
#define MFRC522_IRQ 4
SPIClass hspi(HSPI);
MFRC522 rfid(MFRC522_CS, MFRC522_RST, &hspi);

#define SD_SCK 36
#define SD_MISO 37
#define SD_MOSI 35
#define SD_CS 10
SPIClass fsSPI(FSPI);
const char* OFFLINE_LOG_FILE = "/Offline_Logs_Entry.txt";

HardwareSerial pzemSerial(1);
#define PZEM_RX 18
#define PZEM_TX 17
PZEM004Tv30 pzem(pzemSerial, PZEM_RX, PZEM_TX);

// Define pin pairs for each load cell
const int DT_1 = 38, SCK_1 = 39;
const int DT_2 = 40, SCK_2 = 41;
const int DT_3 = 42, SCK_3 = 45;

// Create instances
HX711_ADC LoadCell1(DT_1, SCK_1);
HX711_ADC LoadCell2(DT_2, SCK_2);
HX711_ADC LoadCell3(DT_3, SCK_3);

// Array for easy access
HX711_ADC* loadCells[] = {&LoadCell1, &LoadCell2, &LoadCell3};
const int NUM_SENSORS = 3;

// Calibration factors - matching working sample code values
float calibrationFactors[] = {999.0, 999.0, 999.0};

#define TAMPER_PIN 22
#define BUZZER_PIN 6
#define LED_R_PIN 16
#define LED_G_PIN 19
#define LED_B_PIN 20
#define RESET_BUTTON_PIN 21
#define RELAY1 7
#define RELAY2 4
#define RELAY3 5
#define RELAY4 12
#define I2C_SDA 8
#define I2C_SCL 9
#define REED_PIN 3

// Define pins for ESP32-S3
#define SCLK_PIN 47  // Serial Clock
#define IO_PIN   48  // Data Input/Output
#define CE_PIN   46  // Chip Enable (Reset)

// Create RTC object
ThreeWire myWire(IO_PIN, SCLK_PIN, CE_PIN);
RtcDS1302<ThreeWire> Rtc(myWire);

// Add this near the top of your .ino file, after includes but before function declarations
struct ScheduleInfo {
  bool isValid;
  String day;
  String startTime;
  String endTime;
  String roomName;
  String subject;
  String subjectCode;
  String section;
};

// Relay pins (adjust these based on your hardware setup)
// Existing constants
const int RELAY1_PIN = 7; // Door relay
const int RELAY2_PIN = 4; // Additional function 1
const int RELAY3_PIN = 5; // Additional function 2
const int RELAY4_PIN = 12; // Additional function 3
const unsigned long finalVerificationTimeout = 30000;
const unsigned long WIFI_TIMEOUT = 10000;
const unsigned long INACTIVITY_TIMEOUT = 300000; // 5 minutes
const unsigned long WEIGHT_CONFIRMATION_TIMEOUT = 20000; // 20 seconds per student
const unsigned long Student_VERIFICATION_WINDOW = 60000; // 1 minutes total
const float voltageThreshold = 200.0;
const unsigned long VERIFICATION_WAIT_DELAY = 3000;
const unsigned long RFID_DEBOUNCE_DELAY = 2000;
const unsigned long I2C_RECOVERY_INTERVAL = 5000;
const unsigned long TAP_OUT_WINDOW = 300000; // 5 minutes for students to tap out
const unsigned long DOOR_OPEN_DURATION = 30000; // 30 seconds
const unsigned long WRONG_SEAT_TIMEOUT = 30000; // 30 seconds timeout for wrong seat
const unsigned long RESET_DEBOUNCE_DELAY = 50; // 50ms debounce delay
const String SUPER_ADMIN_UID = "A466BABA";
// Consolidated global variables (remove duplicates)
bool sdMode = false;
bool isInstructorLogged = false;
String lastInstructorUID = "";
bool classSessionActive = false;
unsigned long classSessionStartTime = 0;
bool waitingForInstructorEnd = false;
bool studentVerificationActive = false;
unsigned long studentVerificationStartTime = 0;
bool adminAccessActive = false;
String lastAdminUID = "";
bool tamperActive = false;
bool tamperAlertTriggered = false;
String tamperStartTime = "";
String currentTamperAlertId = "";  // Global variable to track current tamper alert ID
unsigned long lastActivityTime = 0;
unsigned long lastReadyPrint = 0;
bool readyMessageShown = false;
unsigned long lastSleepMessageTime = 0;
bool relayActive = false;
unsigned long relayActiveTime = 0;
unsigned long lastRFIDTapTime = 0;
unsigned long lastUIDFetchTime = 0;
unsigned long lastDotUpdate = 0;
unsigned long lastPZEMLogTime = 0;
int dotCount = 0;
bool isConnected = false;
bool isVoltageSufficient = false;
bool wasConnected = false;
bool wasVoltageSufficient = false;
bool firstActionOccurred = false;
bool otaUpdateCompleted = false;
bool tamperMessagePrinted = false;
bool instructorTapped = false;
bool displayMessageShown = false;
bool firestoreFetched = false;
float initVoltage = 0.0;
float initCurrent = 0.0;
float initEnergy = 0.0;
unsigned long lastI2cRecovery = 0;
bool reedState = false;
bool tamperResolved = false;
bool powerSavingMode = false;
std::vector<String> registeredUIDs;
std::map<String, std::map<String, String>> firestoreTeachers;
std::map<String, std::map<String, String>> firestoreStudents;
std::map<String, std::map<String, String>> firestoreRooms;
std::vector<String> pendingStudentTaps;
std::map<String, float> studentWeights;
String assignedRoomId = "";
float sessionStartReading = 0.0;
float lastVoltage = 0.0;
float lastCurrent = 0.0;
float lastPower = 0.0;
float lastEnergy = 0.0;
float lastFrequency = 0.0;
float lastPowerFactor = 0.0;
bool tapOutPhase = false;
unsigned long tapOutStartTime = 0;
ScheduleInfo tapOutSchedule = {false, "", "", "", "", "", "", ""}; // Schedule saved for tap-out phase
int presentCount = 0;
String currentSessionId = "";
unsigned long weightConfirmationStartTime = 0;
bool awaitingWeight = false;
bool attendanceFinalized = false;
bool sensorsConnected[NUM_SENSORS] = {false};
unsigned long lastResetDebounceTime = 0;
bool lastResetButtonState = HIGH;
std::map<String, int> studentAssignedSensors;
std::map<String, unsigned long> awaitingWeightStudents;
std::map<String, std::map<String, String>> firestoreUsers;
bool doorOpen = false;
unsigned long doorOpenTime = 0;
bool relaysActive = false;
float totalEnergy = 0.0;
unsigned long lastPZEMUpdate = 0;
String doorOpeningUID = "";
bool sdInitialized = false;
String lastTappedUID = "";
String tamperStartTimestamp = "";
unsigned long lastPowerLogTime = 0;
bool superAdminSessionActive = false;
unsigned long superAdminSessionStartTime = 0;
unsigned long systemStartTime = 0;
int sessionEndTimeInMins = -1;

// Relay state management variables
bool relayTransitionInProgress = false;
unsigned long relayTransitionStartTime = 0;
const unsigned long RELAY_TRANSITION_TIMEOUT = 500; // 500ms timeout for transitions
unsigned long scheduledDeactivationTime = 0;
bool relayOperationPending = false;
bool pendingRelayActivation = false;
bool relayPendingDeactivation = false;
unsigned long relayDeactivationTime = 0;
const unsigned long RELAY_SAFE_DELAY = 250; // 250ms safety delay

#define DEBUG_MODE false  // Set to true for debug output, false for production

// Array to store weight values
float weightValues[3] = {0.0, 0.0, 0.0};

// Student verification system enhancements
int currentStudentQueueIndex = 0;
const unsigned long STUDENT_TAP_TIMEOUT = 60000; // 1 minute timeout for next student tap
unsigned long lastStudentTapTime = 0;

// First, define sensor types at the top with other global variables
const String sensorTypes[NUM_SENSORS] = {"Chair", "Seat", "Floor"};  // Define sensor types

String getFormattedTime() {
  if (sdMode) {
    RtcDateTime now = Rtc.GetDateTime();
    if (!now.IsValid()) {
      Serial.println("RTC time invalid!");
      return "Invalid_RTC_Time";
    }
    char buffer[20];
    snprintf(buffer, 20, "%04u_%02u_%02u_%02u%02u%02u",
             now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second());
    String timestamp = String(buffer);
    return timestamp; // Format: YYYY_MM_DD_HHMMSS
  }

  // Online mode: Use NTP-based time
  time_t now = time(nullptr);
  if (now < 8 * 3600 * 2) { // Check if time is invalid (before 1970 + 16 hours)
    if (isConnected) {
      Serial.println("Time not set. Attempting to fetch time...");
      struct tm timeinfo;
      if (getLocalTime(&timeinfo)) {
        now = mktime(&timeinfo);
        Serial.println("Time fetched successfully.");
      } else {
        Serial.println("Failed to fetch time. Using placeholder timestamp.");
        return "1970_01_01_000000"; // Fallback
      }
    } else {
      Serial.println("Time not set and not in SD mode. Using placeholder timestamp.");
      return "1970_01_01_000000"; // Fallback
    }
  }

  struct tm timeinfo;
  localtime_r(&now, &timeinfo);
  char timeStr[20];
  strftime(timeStr, sizeof(timeStr), "%Y_%m_%d_%H%M%S", &timeinfo);
  String timestamp = String(timeStr);
  return timestamp; // Format: YYYY_MM_DD_HHMMSS
}

String getDate() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    char dateString[11];
    strftime(dateString, sizeof(dateString), "%Y-%m-%d", &timeinfo);
    return String(dateString);
  }
  return "Unknown Date";
}

void nonBlockingDelay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {
    yield();
  }
}

bool nonBlockingDelayWithReset(unsigned long duration) {
  unsigned long startTime = millis();
  while (millis() - startTime < duration) {
    if (checkResetButton()) {
      // Feedback handled by checkResetButton(); avoid duplicating here
      return false; // Signal reset detected (reset already handled)
    }
    yield();
  }
  return true; // Delay completed without reset
}

void showNeutral() {
  digitalWrite(LED_R_PIN, LOW);
  digitalWrite(LED_G_PIN, LOW);
  digitalWrite(LED_B_PIN, HIGH);
  Serial.println("LED State: Neutral (R:LOW, G:LOW, B:HIGH)");
}

void accessFeedback() {
  digitalWrite(LED_R_PIN, LOW);
  digitalWrite(LED_G_PIN, HIGH);
  digitalWrite(LED_B_PIN, LOW);
  Serial.println("LED State: Access (R:LOW, G:HIGH, B:LOW)");
  tone(BUZZER_PIN, 2000, 200);
  nonBlockingDelay(500);
  showNeutral();
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void deniedFeedback() {
  digitalWrite(LED_R_PIN, HIGH);
  digitalWrite(LED_G_PIN, LOW);
  digitalWrite(LED_B_PIN, LOW);
  Serial.println("LED State: Denied (R:HIGH, G:LOW, B:LOW)");
  tone(BUZZER_PIN, 500, 200);
  nonBlockingDelay(200);
  tone(BUZZER_PIN, 300, 200);
  nonBlockingDelay(300);
  showNeutral();
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting");
  lcd.setCursor(0, 1);
  lcd.print("to WiFi...");

  unsigned long startTime = millis();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_TIMEOUT) {
    Serial.print(".");
    nonBlockingDelay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi: " + String(WIFI_SSID));
    Serial.println("IP Address: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    nonBlockingDelay(2000);
    sdMode = false;
    isConnected = true;
    wasConnected = true;
  } else {
    Serial.println("\nWiFi connection failed. Retrying once...");
    WiFi.reconnect(); // Attempt reconnect
    startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 15000) { // Extended retry timeout to 15s
      Serial.print(".");
      nonBlockingDelay(500);
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nReconnected to WiFi: " + String(WIFI_SSID));
      Serial.println("IP Address: " + WiFi.localIP().toString());
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Reconnected!");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.localIP().toString());
      nonBlockingDelay(2000);
      sdMode = false;
      isConnected = true;
      wasConnected = true;
    } else {
      Serial.println("\nWiFi connection failed after retry. Switching to SD mode.");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Failed");
      lcd.setCursor(0, 1);
      lcd.print("SD Mode");
      nonBlockingDelay(2000);
      sdMode = true;
      isConnected = false;
    }
  }
  isVoltageSufficient = (pzem.voltage() >= voltageThreshold);
}

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Increase timeout to handle slow networks
  config.timeout.serverResponse = 15000; // 15 seconds for server response (covers both read and write)
  config.timeout.wifiReconnect = 10000;  // 10 seconds for WiFi reconnect
  
  Serial.println("Initializing Firebase...");
  
  // Check if already signed up or use anonymous sign-up
  if (Firebase.authenticated()) {
    Serial.println("Already authenticated with Firebase.");
  } else {
    if (!Firebase.signUp(&config, &auth, "", "")) { // Anonymous sign-up
      Serial.printf("Firebase signup error: %s\n", config.signer.signupError.message.c_str());
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Firebase Error:");
      lcd.setCursor(0, 1);
      lcd.print(config.signer.signupError.message.c_str());
      nonBlockingDelay(5000);
      ESP.restart();
    } else {
      Serial.println("Firebase anonymous sign-up successful.");
    }
  }
  
  // Token status callback for monitoring and refreshing token
  config.token_status_callback = [](TokenInfo info) {
    String statusStr;
    switch (info.status) {
      case token_status_uninitialized:
        statusStr = "Uninitialized";
        break;
      case token_status_on_signing:
        statusStr = "Signing In";
        break;
      case token_status_on_refresh:
        statusStr = "Refreshing";
        break;
      case token_status_ready:
        statusStr = "Ready";
        break;
      case token_status_error:
        statusStr = "Error";
        break;
      default:
        statusStr = "Unknown";
        break;
    }
    Serial.printf("Token status: %s\n", statusStr.c_str());
    if (info.status == token_status_error) {
      Serial.printf("Token error: %s. Refreshing...\n", info.error.message.c_str());
      Firebase.refreshToken(&config);
    }
  };
  
  // Initialize Firebase with configuration
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Firebase.RTDB.setReadTimeout(&fbdo, 10000);  // Set 10-second timeout for RTDB read operations

  // Wait and verify Firebase is ready
  unsigned long startTime = millis();
  while (!Firebase.ready() && (millis() - startTime < 15000)) {
    Serial.println("Waiting for Firebase to be ready...");
    delay(500);
  }
  
  if (Firebase.ready()) {
    Serial.println("Firebase initialized and authenticated successfully.");
  } else {
    Serial.println("Firebase failed to initialize after timeout.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Firebase Fail");
    lcd.setCursor(0, 1);
    lcd.print("Restarting...");
    nonBlockingDelay(5000);
    ESP.restart();
  }
}

String getUIDString() {
  String uidStr = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10)
      uidStr += "0";
    uidStr += String(rfid.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

bool isRegisteredUID(String uid) {
  // Super Admin UID should be recognized in both SD mode and online mode
  if (uid == SUPER_ADMIN_UID) {
    return true;
  }

  // First, check the firestoreStudents map - which is cached data
  if (firestoreStudents.find(uid) != firestoreStudents.end()) {
    Serial.println("UID " + uid + " is registered as a student (from cached data).");
    return true;
  }

  // Then check firestoreTeachers map - also cached data
  if (firestoreTeachers.find(uid) != firestoreTeachers.end()) {
    Serial.println("UID " + uid + " is registered as a teacher (from cached data).");
    return true;
  }

  // If not found in cache, try direct Firestore query
  if (!sdMode && isConnected) {
    // First check teachers collection
    Serial.println("Checking if UID " + uid + " is registered in Firestore teachers...");
    String firestorePath = "teachers";
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", firestorePath.c_str(), "")) {
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          String rfidUid = "";
          FirebaseJsonData fieldData;
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
            if (rfidUid == uid) {
              Serial.println("UID " + uid + " is registered as a teacher.");
              // Cache this data for future use
              std::map<String, String> teacherData;
              String fullName = "";
              if (doc.get(fieldData, "fields/fullName/stringValue")) {
                fullName = fieldData.stringValue;
              }
              teacherData["fullName"] = fullName;
              firestoreTeachers[uid] = teacherData;
              return true;
            }
          }
        }
      }
    } else {
      Serial.println("Failed to retrieve Firestore teachers: " + firestoreFbdo.errorReason());
    }
    
    // Then check students collection
    Serial.println("Checking if UID " + uid + " is registered in Firestore students...");
    firestorePath = "students";
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", firestorePath.c_str(), "")) {
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          String rfidUid = "";
          FirebaseJsonData fieldData;
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
            if (rfidUid == uid) {
              Serial.println("UID " + uid + " is registered as a student.");
              // Cache this data for future use
              std::map<String, String> studentData;
              String fullName = "";
              if (doc.get(fieldData, "fields/fullName/stringValue")) {
                fullName = fieldData.stringValue;
              }
              studentData["fullName"] = fullName;
              studentData["role"] = "student";
              firestoreStudents[uid] = studentData;
              return true;
            }
          }
        }
      }
    } else {
      Serial.println("Failed to retrieve Firestore students: " + firestoreFbdo.errorReason());
    }
  }
  
  Serial.println("UID " + uid + " is not registered or Firestore unavailable.");
  return false;
}

bool isAdminUID(String uid) {
  if (!sdMode && isConnected) {
    Serial.println("Checking if UID " + uid + " is an admin in Firestore...");
    String firestorePath = "users";
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", firestorePath.c_str(), "")) {
      Serial.println("Firestore documents retrieved successfully for 'users' collection.");
      Serial.println("Firestore payload: " + firestoreFbdo.payload());
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          String rfidUid = "", role = "";
          FirebaseJsonData fieldData;
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
            Serial.println("Found document with rfidUid: " + rfidUid);
          }
          if (doc.get(fieldData, "fields/role/stringValue")) {
            role = fieldData.stringValue;
            Serial.println("Role for rfidUid " + rfidUid + ": " + role);
          }
          if (rfidUid == uid && role == "admin") {
            Serial.println("UID " + uid + " is confirmed as admin.");
            return true;
          }
        }
        Serial.println("No document found with rfidUid " + uid + " and role 'admin'.");
      } else {
        Serial.println("No documents found in 'users' collection.");
      }
    } else {
      Serial.println("Failed to retrieve Firestore documents: " + firestoreFbdo.errorReason());
    }
  } else {
    Serial.println("Cannot check admin UID: sdMode=" + String(sdMode) + ", isConnected=" + String(isConnected));
  }
  return false;
}

std::map<String, String> fetchUserDetails(String uid) {
  std::map<String, String> userData;

  if (!sdMode && isConnected) {
    Serial.println("Fetching user details for UID " + uid + " from Firestore...");
    String firestorePath = "users"; // Fetch the entire users collection

    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", firestorePath.c_str(), "")) {
      Serial.println("Firestore documents retrieved successfully for 'users' collection.");
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload().c_str());
      FirebaseJsonData jsonData;

      if (json.get(jsonData, "documents") && jsonData.type == "array") {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);

        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());

          String rfidUid = "";
          FirebaseJsonData fieldData;
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
          }

          if (rfidUid == uid) {
            Serial.println("Found user with rfidUid " + uid + ". Extracting details...");
            if (doc.get(fieldData, "fields/email/stringValue")) {
              userData["email"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/fullName/stringValue")) {
              userData["fullName"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/idNumber/stringValue")) {
              userData["idNumber"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
              userData["rfidUid"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/role/stringValue")) {
              userData["role"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/createdAt/stringValue")) {
              userData["createdAt"] = fieldData.stringValue;
            }
            if (doc.get(fieldData, "fields/uid/stringValue")) {
              userData["uid"] = fieldData.stringValue;
            }

            Serial.println("User details fetched: fullName=" + userData["fullName"] + 
                           ", email=" + (userData["email"].isEmpty() ? "N/A" : userData["email"]) + 
                           ", role=" + (userData["role"].isEmpty() ? "N/A" : userData["role"]));
            break; // Stop searching once we find the matching user
          }
        }

        if (userData.empty()) {
          Serial.println("No user found with rfidUid " + uid + " in Firestore.");
        }
      } else {
        Serial.println("No documents found in 'users' collection or invalid response format.");
      }
    } else {
      Serial.println("Failed to retrieve Firestore documents: " + firestoreFbdo.errorReason());
    }
  } else {
    Serial.println("Cannot fetch user details: sdMode=" + String(sdMode) + ", isConnected=" + String(isConnected));
  }

  return userData;
}

void fetchRegisteredUIDs() {
  if (!sdMode && (WiFi.status() != WL_CONNECTED || pzem.voltage() < voltageThreshold)) {
    return;
  }
  if (Firebase.RTDB.get(&fbdo, "/RegisteredUIDs")) {
    if (fbdo.dataType() == "json") {
      FirebaseJson* json = fbdo.jsonObjectPtr();
      registeredUIDs.clear();
      size_t count = json->iteratorBegin();
      for (size_t i = 0; i < count; i++) {
        int type;
        String key, value;
        json->iteratorGet(i, type, key, value);
        registeredUIDs.push_back(key);
      }
      json->iteratorEnd();
    }
  }
  lastUIDFetchTime = millis();
}

void fetchFirestoreTeachers() {
  if (!sdMode && isConnected && Firebase.ready()) {
    firestoreTeachers.clear();
    String path = "teachers";
    yield(); // Prevent watchdog reset
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", path.c_str(), "")) {
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        Serial.println("Found " + String(arr.size()) + " teachers in Firestore");

        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          String rfidUid, fullName, email, idNumber, mobileNumber, role, department, createdAt;
          FirebaseJsonData fieldData;

          // Extract basic teacher fields
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
            Serial.println("Fetched rfidUid: " + rfidUid);
          } else {
            Serial.println("No rfidUid found for document " + String(i));
            continue;
          }
          if (doc.get(fieldData, "fields/fullName/stringValue")) fullName = fieldData.stringValue;
          if (doc.get(fieldData, "fields/email/stringValue")) email = fieldData.stringValue;
          if (doc.get(fieldData, "fields/idNumber/stringValue")) idNumber = fieldData.stringValue;
          if (doc.get(fieldData, "fields/mobileNumber/stringValue")) mobileNumber = fieldData.stringValue;
          if (doc.get(fieldData, "fields/role/stringValue")) {
            role = fieldData.stringValue;
            Serial.println("Fetched role for UID " + rfidUid + ": '" + role + "'");
          } else {
            Serial.println("No role found for UID " + rfidUid + ". Defaulting to 'instructor'");
            role = "instructor";
          }
          if (doc.get(fieldData, "fields/department/stringValue")) department = fieldData.stringValue;
          if (doc.get(fieldData, "fields/createdAt/stringValue")) createdAt = fieldData.stringValue;

          // Parse assignedSubjects to extract schedules and sections
          FirebaseJsonArray schedulesArray;
          FirebaseJsonArray sectionsArray;
          if (doc.get(fieldData, "fields/assignedSubjects/arrayValue/values")) {
            FirebaseJsonArray subjectsArr;
            fieldData.getArray(subjectsArr);
            Serial.println("UID " + rfidUid + " has " + String(subjectsArr.size()) + " assigned subjects");

            for (size_t j = 0; j < subjectsArr.size(); j++) {
              FirebaseJsonData subjectData;
              subjectsArr.get(subjectData, j);
              FirebaseJson subject;
              subject.setJsonData(subjectData.to<String>());
              String subjectName, subjectCode;
              FirebaseJsonData subjectField;
              if (subject.get(subjectField, "mapValue/fields/name/stringValue")) subjectName = subjectField.stringValue;
              if (subject.get(subjectField, "mapValue/fields/code/stringValue")) subjectCode = subjectField.stringValue;

              // Parse sections and their schedules
              if (subject.get(subjectField, "mapValue/fields/sections/arrayValue/values")) {
                FirebaseJsonArray sectionsArr;
                subjectField.getArray(sectionsArr);
                Serial.println("Subject '" + subjectName + "' has " + String(sectionsArr.size()) + " sections");

                for (size_t k = 0; k < sectionsArr.size(); k++) {
                  FirebaseJsonData sectionData;
                  sectionsArr.get(sectionData, k);
                  FirebaseJson section;
                  section.setJsonData(sectionData.to<String>());
                  String sectionId, sectionName, sectionCode, capacity, currentEnrollment;
                  FirebaseJsonData sectionField;
                  if (section.get(sectionField, "mapValue/fields/id/stringValue")) sectionId = sectionField.stringValue;
                  if (section.get(sectionField, "mapValue/fields/name/stringValue")) sectionName = sectionField.stringValue;
                  if (section.get(sectionField, "mapValue/fields/code/stringValue")) sectionCode = sectionField.stringValue;
                  if (section.get(sectionField, "mapValue/fields/capacity/integerValue")) capacity = sectionField.stringValue;
                  if (section.get(sectionField, "mapValue/fields/currentEnrollment/integerValue")) currentEnrollment = sectionField.stringValue;

                  Serial.println("Section " + String(k) + ": " + sectionName + ", Code: " + sectionCode + ", Capacity: " + capacity + ", Enrollment: " + currentEnrollment);

                  FirebaseJson sectionEntry;
                  sectionEntry.set("id", sectionId);
                  sectionEntry.set("name", sectionName);
                  sectionEntry.set("code", sectionCode);
                  sectionEntry.set("capacity", capacity);
                  sectionEntry.set("currentEnrollment", currentEnrollment);
                  sectionEntry.set("subject", subjectName);
                  sectionEntry.set("subjectCode", subjectCode);
                  sectionsArray.add(sectionEntry);

                  // Parse schedules within the section
                  if (section.get(sectionField, "mapValue/fields/schedules/arrayValue/values")) {
                    FirebaseJsonArray schedulesArr;
                    sectionField.getArray(schedulesArr);
                    Serial.println("Section '" + sectionName + "' has " + String(schedulesArr.size()) + " schedules");

                    for (size_t m = 0; m < schedulesArr.size(); m++) {
                      FirebaseJsonData scheduleData;
                      schedulesArr.get(scheduleData, m);
                      FirebaseJson schedule;
                      schedule.setJsonData(scheduleData.to<String>());
                      String day, startTime, endTime, roomName;
                      // Define the instructor variables we need for this schedule
                      String instructorUid = rfidUid; // Use the current teacher's UID
                      String instructorName = fullName; // Use the current teacher's name
                      FirebaseJsonData scheduleField;
                      if (schedule.get(scheduleField, "mapValue/fields/day/stringValue")) day = scheduleField.stringValue;
                      if (schedule.get(scheduleField, "mapValue/fields/startTime/stringValue")) startTime = scheduleField.stringValue;
                      if (schedule.get(scheduleField, "mapValue/fields/endTime/stringValue")) endTime = scheduleField.stringValue;
                      if (schedule.get(scheduleField, "mapValue/fields/roomName/stringValue")) roomName = scheduleField.stringValue;

                      Serial.println("Schedule " + String(m) + ": " + day + ", " + startTime + "-" + endTime + ", Room: " + roomName);

                      FirebaseJson scheduleEntry;
                      scheduleEntry.set("day", day);
                      scheduleEntry.set("startTime", startTime);
                      scheduleEntry.set("endTime", endTime);
                      scheduleEntry.set("roomName", roomName);
                      scheduleEntry.set("subject", subjectName);
                      scheduleEntry.set("subjectCode", subjectCode);
                      scheduleEntry.set("section", sectionName);
                      scheduleEntry.set("sectionId", sectionId);
                      scheduleEntry.set("instructorUid", instructorUid);
                      scheduleEntry.set("instructorName", instructorName);

                      schedulesArray.add(scheduleEntry); // Add directly to array
                    }
                  }
                }
              }
            }
          }

          // Store teacher data in firestoreTeachers
          if (rfidUid != "") {
            std::map<String, String> teacherData;
            teacherData["fullName"] = fullName;
            teacherData["email"] = email;
            teacherData["idNumber"] = idNumber;
            teacherData["mobileNumber"] = mobileNumber;
            teacherData["role"] = role;
            teacherData["department"] = department;
            teacherData["createdAt"] = createdAt;

            String schedulesStr = "[]";
            String sectionsStr = "[]";
            if (schedulesArray.size() > 0) {
              schedulesArray.toString(schedulesStr, true);
            }
            if (sectionsArray.size() > 0) {
              sectionsArray.toString(sectionsStr, true);
            }
            Serial.println("Schedules for UID " + rfidUid + ": " + schedulesStr);
            Serial.println("Sections for UID " + rfidUid + ": " + sectionsStr);
            teacherData["schedules"] = schedulesStr;
            teacherData["sections"] = sectionsStr;
            firestoreTeachers[rfidUid] = teacherData;
          }
        }

        // Sync schedules to SD card after fetching
        if (syncSchedulesToSD()) {
          Serial.println("Schedules synced to SD card successfully.");
        } else {
          Serial.println("Failed to sync schedules to SD card.");
        }

        Serial.println("Firestore teachers fetched and cached locally. Total: " + String(firestoreTeachers.size()));
      } else {
        Serial.println("No documents found in Firestore teachers collection");
      }
    } else {
      Serial.println("Failed to fetch Firestore teachers: " + firestoreFbdo.errorReason());
    }
  } else {
    Serial.println("Skipping fetchFirestoreTeachers: sdMode=" + String(sdMode) + 
                   ", WiFi=" + String(WiFi.status()) + 
                   ", FirebaseReady=" + String(Firebase.ready()));
  }
}

void fetchFirestoreStudents() {
  if (!sdMode && (WiFi.status() != WL_CONNECTED || pzem.voltage() < voltageThreshold)) {
    Serial.println("Skipping fetchFirestoreStudents: Not connected or low voltage (WiFi: " + String(WiFi.status()) + ", Voltage: " + String(pzem.voltage()) + ")");
    return;
  }

  firestoreStudents.clear();
  String path = "students";
  Serial.println("Fetching students from Firestore at path: " + path);

  int retries = 3;
  bool success = false;
  for (int attempt = 1; attempt <= retries && !success; attempt++) {
    Serial.println("Attempt " + String(attempt) + " to fetch Firestore data...");
    yield(); // Prevent watchdog reset before Firebase call
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", path.c_str(), "")) {
      success = true;
      Serial.println("Firestore fetch successful. Raw payload:");
      Serial.println(firestoreFbdo.payload());

      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        Serial.println("Found " + String(arr.size()) + " documents in Firestore response.");

        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          Serial.println("Document[" + String(i) + "] raw data: " + docData.to<String>());

          String rfidUid, fullName, email, idNumber, mobileNumber, role, department;
          FirebaseJsonData fieldData;

          rfidUid = doc.get(fieldData, "fields/rfidUid/stringValue") ? fieldData.stringValue : "";
          fullName = doc.get(fieldData, "fields/fullName/stringValue") ? fieldData.stringValue : "Unknown";
          email = doc.get(fieldData, "fields/email/stringValue") ? fieldData.stringValue : "";
          idNumber = doc.get(fieldData, "fields/idNumber/stringValue") ? fieldData.stringValue : "";
          mobileNumber = doc.get(fieldData, "fields/mobileNumber/stringValue") ? fieldData.stringValue : "";
          role = doc.get(fieldData, "fields/role/stringValue") ? fieldData.stringValue : "student";
          department = doc.get(fieldData, "fields/department/stringValue") ? fieldData.stringValue : "";

          Serial.println("Parsed rfidUid: " + rfidUid + ", fullName: " + fullName);

          String schedulesJsonStr = "[]";
          FirebaseJsonArray schedulesArray; // Use array instead of object

          if (doc.get(fieldData, "fields/enrolledSubjects/arrayValue/values")) {
            FirebaseJsonArray subjectsArr;
            fieldData.getArray(subjectsArr);
            Serial.println("Found " + String(subjectsArr.size()) + " enrolledSubjects for " + rfidUid);

            for (size_t j = 0; j < subjectsArr.size(); j++) {
              FirebaseJsonData subjectData;
              subjectsArr.get(subjectData, j);
              FirebaseJson subject;
              subject.setJsonData(subjectData.to<String>());
              Serial.println("Processing enrolledSubject[" + String(j) + "]: " + subjectData.to<String>());

              String subjectCode = subject.get(fieldData, "mapValue/fields/code/stringValue") ? fieldData.stringValue : "Unknown";
              String subjectName = subject.get(fieldData, "mapValue/fields/name/stringValue") ? fieldData.stringValue : "Unknown";
              String instructorUid = subject.get(fieldData, "mapValue/fields/instructorId/stringValue") ? fieldData.stringValue : "";
              String instructorName = subject.get(fieldData, "mapValue/fields/instructorName/stringValue") ? fieldData.stringValue : "";
              String sectionId = subject.get(fieldData, "mapValue/fields/sectionId/stringValue") ? fieldData.stringValue : "";
              String sectionName = subject.get(fieldData, "mapValue/fields/sectionName/stringValue") ? fieldData.stringValue : "";

              if (subject.get(fieldData, "mapValue/fields/schedules/arrayValue/values")) {
                FirebaseJsonArray schedulesArr;
                fieldData.getArray(schedulesArr);
                Serial.println("Found " + String(schedulesArr.size()) + " schedules for subject " + subjectCode);

                for (size_t k = 0; k < schedulesArr.size(); k++) {
                  FirebaseJsonData scheduleData;
                  schedulesArr.get(scheduleData, k);
                  FirebaseJson schedule;
                  schedule.setJsonData(scheduleData.to<String>());
                  Serial.println("Processing schedule[" + String(k) + "]: " + scheduleData.to<String>());

                  FirebaseJsonData scheduleField;
                  String day = schedule.get(scheduleField, "mapValue/fields/day/stringValue") ? scheduleField.stringValue : "";
                  String startTime = schedule.get(scheduleField, "mapValue/fields/startTime/stringValue") ? scheduleField.stringValue : "";
                  String endTime = schedule.get(scheduleField, "mapValue/fields/endTime/stringValue") ? scheduleField.stringValue : "";
                  String roomName = schedule.get(scheduleField, "mapValue/fields/roomName/stringValue") ? scheduleField.stringValue : "";

                  FirebaseJson scheduleObj;
                  scheduleObj.set("day", day);
                  scheduleObj.set("startTime", startTime);
                  scheduleObj.set("endTime", endTime);
                  scheduleObj.set("roomName", roomName);
                  scheduleObj.set("subjectCode", subjectCode);
                  scheduleObj.set("subject", subjectName);
                  scheduleObj.set("section", sectionName);
                  scheduleObj.set("sectionId", sectionId);
                  scheduleObj.set("instructorUid", instructorUid);
                  scheduleObj.set("instructorName", instructorName);

                  schedulesArray.add(scheduleObj); // Add directly to array
                }
              } else {
                Serial.println("No schedules found in enrolledSubject[" + String(j) + "] for " + rfidUid);
              }
            }
            schedulesArray.toString(schedulesJsonStr, true); // Serialize array
            Serial.println("Combined schedules for " + rfidUid + ": " + schedulesJsonStr);
          } else {
            Serial.println("No enrolledSubjects/values found for " + rfidUid);
          }

          if (rfidUid != "") {
            std::map<String, String> studentData;
            studentData["fullName"] = fullName;
            studentData["email"] = email;
            studentData["idNumber"] = idNumber;
            studentData["mobileNumber"] = mobileNumber;
            studentData["role"] = role;
            studentData["department"] = department;
            studentData["schedules"] = schedulesJsonStr;
            firestoreStudents[rfidUid] = studentData;
            Serial.println("Stored student " + rfidUid + " with schedules: " + schedulesJsonStr);
          }
        }
        Serial.println("Fetched " + String(firestoreStudents.size()) + " students from Firestore.");
      } else {
        Serial.println("No documents found in Firestore response.");
      }
    } else {
      Serial.println("Firestore fetch failed (attempt " + String(attempt) + "): " + firestoreFbdo.errorReason());
      if (attempt < retries) {
        Serial.println("Retrying in 5 seconds...");
        delay(5000);
        Firebase.reconnectWiFi(true);
      }
    }
    yield(); // Prevent watchdog reset after Firebase call
  }

  if (!success) {
    Serial.println("All fetch attempts failed. Switching to SD mode.");
    sdMode = true;
  }

  if (firestoreStudents.find("5464E1BA") != firestoreStudents.end()) {
    Serial.println("Verified: 5464E1BA found with schedules: " + firestoreStudents["5464E1BA"]["schedules"]);
  } else {
    Serial.println("Verified: 5464E1BA NOT found in firestoreStudents.");
  }
}

// Add this function after initFirebase() and before fetchFirestoreRooms()
bool ensureFirebaseAuthenticated() {
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready. Attempting re-initialization...");
    Firebase.reconnectWiFi(true);
    initFirebase();
    delay(1000);
    
    if (!Firebase.ready()) {
      Serial.println("Firebase still not ready after re-init.");
      return false;
    }
  }
  
  if (!Firebase.authenticated()) {
    Serial.println("Firebase not authenticated. Attempting sign-in...");
    // Try to sign in again
    if (!Firebase.signUp(&config, &auth, "", "")) {
      Serial.printf("Firebase re-auth failed: %s\n", config.signer.signupError.message.c_str());
      return false;
    }
    
    delay(1000); // Give it time to process
    if (!Firebase.authenticated()) {
      Serial.println("Firebase still not authenticated after re-auth attempt.");
      return false;
    }
  }
  
  Serial.println("Firebase is ready and authenticated.");
  return true;
}

void fetchFirestoreRooms() {
  if (!ensureFirebaseAuthenticated()) {
    Serial.println("Cannot fetch Firestore rooms, Firebase not authenticated.");
    return;
  }

  Serial.println("Fetching Firestore rooms...");
  if (Firebase.Firestore.getDocument(&fbdo, FIRESTORE_PROJECT_ID, "", "rooms", "")) {
    FirebaseJson roomsJson;
    roomsJson.setJsonData(fbdo.payload().c_str());
    FirebaseJsonData jsonData;

    if (roomsJson.get(jsonData, "documents") && jsonData.type == "array") {
      FirebaseJsonArray arr;
      jsonData.getArray(arr);
      firestoreRooms.clear();

      for (size_t i = 0; i < arr.size(); i++) {
        FirebaseJsonData docData;
        arr.get(docData, i);
        FirebaseJson doc;
        doc.setJsonData(docData.stringValue);

        // Extract room ID from document name
        String docName;
        doc.get(docData, "name");
        docName = docData.stringValue;
        String roomId = docName.substring(docName.lastIndexOf("/") + 1);

        // Extract fields
        FirebaseJson fields;
        doc.get(docData, "fields");
        fields.setJsonData(docData.stringValue);

        std::map<String, String> roomData;
        FirebaseJsonData fieldData;

        // Root-level fields with existence checks
        if (fields.get(fieldData, "building/stringValue")) {
          roomData["building"] = fieldData.stringValue;
        } else {
          roomData["building"] = "Unknown";
          Serial.println("Warning: 'building' missing for room " + roomId);
        }
        if (fields.get(fieldData, "floor/stringValue")) {
          roomData["floor"] = fieldData.stringValue;
        } else {
          roomData["floor"] = "Unknown";
          Serial.println("Warning: 'floor' missing for room " + roomId);
        }
        if (fields.get(fieldData, "name/stringValue")) {
          roomData["name"] = fieldData.stringValue;
        } else {
          roomData["name"] = "Unknown";
          Serial.println("Warning: 'name' missing for room " + roomId);
        }
        if (fields.get(fieldData, "status/stringValue")) {
          roomData["status"] = fieldData.stringValue;
        } else {
          roomData["status"] = "Unknown";
          Serial.println("Warning: 'status' missing for room " + roomId);
        }
        if (fields.get(fieldData, "type/stringValue")) {
          roomData["type"] = fieldData.stringValue;
        } else {
          roomData["type"] = "Unknown";
          Serial.println("Warning: 'type' missing for room " + roomId);
        }

        firestoreRooms[roomId] = roomData;
        Serial.println("Fetched room " + roomId + ": building=" + roomData["building"] + 
                       ", floor=" + roomData["floor"] + ", name=" + roomData["name"] +
                       ", status=" + roomData["status"] + ", type=" + roomData["type"]);
      }
      Serial.println("Fetched " + String(firestoreRooms.size()) + " rooms from Firestore.");
    } else {
      Serial.println("No documents found in rooms collection or invalid format.");
    }
  } else {
    Serial.println("Failed to fetch Firestore rooms: " + fbdo.errorReason());
    
    // Additional debugging for Firestore permissions issue
    Serial.println("Attempting to reconnect and retry...");
    Firebase.reconnectWiFi(true);
    delay(1000);
    
    // Try a second attempt with the firestoreFbdo object
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", "rooms", "")) {
      Serial.println("Second attempt successful with firestoreFbdo!");
      FirebaseJson roomsJson;
      roomsJson.setJsonData(firestoreFbdo.payload().c_str());
      FirebaseJsonData jsonData;
      
      if (roomsJson.get(jsonData, "documents") && jsonData.type == "array") {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        firestoreRooms.clear();
        
        // Process rooms as in the original attempt
        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          
          // Extract room ID from document name
          String docName;
          doc.get(docData, "name");
          docName = docData.stringValue;
          String roomId = docName.substring(docName.lastIndexOf("/") + 1);
          
          // Extract fields
          FirebaseJson fields;
          doc.get(docData, "fields");
          fields.setJsonData(docData.stringValue);
          
          std::map<String, String> roomData;
          FirebaseJsonData fieldData;
          
          // Process fields
          if (fields.get(fieldData, "building/stringValue")) {
            roomData["building"] = fieldData.stringValue;
          } else {
            roomData["building"] = "Unknown";
          }
          if (fields.get(fieldData, "floor/stringValue")) {
            roomData["floor"] = fieldData.stringValue;
          } else {
            roomData["floor"] = "Unknown";
          }
          if (fields.get(fieldData, "name/stringValue")) {
            roomData["name"] = fieldData.stringValue;
          } else {
            roomData["name"] = "Unknown";
          }
          if (fields.get(fieldData, "status/stringValue")) {
            roomData["status"] = fieldData.stringValue;
          } else {
            roomData["status"] = "Unknown";
          }
          if (fields.get(fieldData, "type/stringValue")) {
            roomData["type"] = fieldData.stringValue;
          } else {
            roomData["type"] = "Unknown";
          }
          
          firestoreRooms[roomId] = roomData;
          Serial.println("Fetched room " + roomId + ": building=" + roomData["building"] + 
                        ", floor=" + roomData["floor"] + ", name=" + roomData["name"] +
                        ", status=" + roomData["status"] + ", type=" + roomData["type"]);
        }
        Serial.println("Fetched " + String(firestoreRooms.size()) + " rooms from Firestore on second attempt.");
      } else {
        Serial.println("Second attempt: No documents found in rooms collection or invalid format.");
      }
    } else {
      Serial.println("Second attempt also failed: " + firestoreFbdo.errorReason());
      Serial.println("Firebase auth status: " + String(Firebase.authenticated()));
      Serial.println("Verify Firestore rules and authentication.");
    }
  }
}

String assignRoomToAdmin(String uid) {
  String selectedRoomId = "";

  // Ensure firestoreRooms is populated
  if (firestoreRooms.empty()) {
    Serial.println("firestoreRooms is empty. Cannot assign a room to admin UID: " + uid);
    return selectedRoomId;
  }

  // Filter rooms based on status (e.g., "maintenance" for inspection)
  Serial.println("Assigning room for admin UID: " + uid);
  Serial.println("Searching for rooms with status 'maintenance'...");
  
  // Debug room statuses
  for (const auto& room : firestoreRooms) {
    String roomId = room.first;
    const auto& roomData = room.second;
    
    // Extract room details using at() to avoid const issues
    String roomStatus = roomData.at("status");
    String roomName = roomData.at("name");
    
    Serial.println("Room " + roomId + " (" + roomName + ") has status: '" + roomStatus + "'");
  }
  
  // First try exact match with 'maintenance'
  for (const auto& room : firestoreRooms) {
    String roomId = room.first;
    const auto& roomData = room.second;
    
    String roomStatus = roomData.at("status");
    String roomBuilding = roomData.at("building");
    String roomName = roomData.at("name");
    
    // Primary match: status equals "maintenance"
    if (roomStatus == "maintenance") {
      selectedRoomId = roomId;
      Serial.println("Selected room " + roomId + " with status 'maintenance' for admin UID: " + uid + 
                     " (building: " + roomBuilding + ", name: " + roomName + ")");
      return selectedRoomId;
    }
  }
  
  // If no room found with exactly "maintenance", try case-insensitive or partial match
  for (const auto& room : firestoreRooms) {
    String roomId = room.first;
    const auto& roomData = room.second;
    
    String roomStatus = roomData.at("status");
    String roomStatusLower = roomStatus;
    roomStatusLower.toLowerCase();
    
    String roomBuilding = roomData.at("building");
    String roomName = roomData.at("name");
    
    // Secondary match: status contains "maintenance" (case insensitive)
    if (roomStatusLower.indexOf("maintenance") >= 0) {
      selectedRoomId = roomId;
      Serial.println("Selected room " + roomId + " with status containing 'maintenance' for admin UID: " + uid + 
                     " (actual status: '" + roomStatus + "', building: " + roomBuilding + ", name: " + roomName + ")");
      return selectedRoomId;
    }
  }
  
  // If still no match, assign any room for testing purposes
  if (selectedRoomId == "") {
    Serial.println("No room with status 'maintenance' found. Assigning first available room for testing.");
    if (!firestoreRooms.empty()) {
      selectedRoomId = firestoreRooms.begin()->first;
      const auto& roomData = firestoreRooms.begin()->second;
      String roomStatus = roomData.at("status");
      String roomName = roomData.at("name");
      Serial.println("Assigned room " + selectedRoomId + " (" + roomName + ") with status '" + roomStatus + "' for admin UID: " + uid);
    } else {
      Serial.println("No rooms available to assign to admin UID: " + uid);
    }
  }
  
  return selectedRoomId;
}

void assignRoomToInstructor(String uid, String timestamp) {
  if (firestoreTeachers.find(uid) == firestoreTeachers.end()) {
    return;
  }

  String teacherSchedules = firestoreTeachers[uid]["schedules"];
  FirebaseJson teacherJson;
  teacherJson.setJsonData(teacherSchedules);
  FirebaseJsonData jsonData;

  if (teacherJson.get(jsonData, "/")) {
    FirebaseJsonArray schedulesArray;
    jsonData.getArray(schedulesArray);

    String currentDay, currentTime;
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      char dayStr[10];
      char timeStr[10];
      strftime(dayStr, sizeof(dayStr), "%A", &timeinfo);
      strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
      currentDay = String(dayStr);
      currentTime = String(timeStr);
    } else {
      return;
    }

    String assignedRoom = "";
    String subject = "";
    String sessionStart = timestamp;
    String sessionEnd = "";

    for (size_t i = 0; i < schedulesArray.size(); i++) {
      FirebaseJsonData scheduleData;
      schedulesArray.get(scheduleData, i);
      FirebaseJson schedule;
      schedule.setJsonData(scheduleData.to<String>());
      String day, startTime, endTime, room, subjectSchedule;
      FirebaseJsonData field;
      if (schedule.get(field, "day")) day = field.stringValue;
      if (schedule.get(field, "startTime")) startTime = field.stringValue;
      if (schedule.get(field, "endTime")) endTime = field.stringValue;
      if (schedule.get(field, "room")) room = field.stringValue;
      if (schedule.get(field, "subject")) subjectSchedule = field.stringValue;

      if (day == currentDay) {
        if (currentTime >= startTime && currentTime <= endTime) {
          assignedRoom = room;
          subject = subjectSchedule;
          sessionEnd = endTime;
          break;
        }
      }
    }

    if (assignedRoom != "") {
      for (auto& room : firestoreRooms) {
        String roomId = room.first;
        if (room.second.at("roomName") == assignedRoom && room.second.at("status") == "available") {
          assignedRoomId = roomId;
          sessionStartReading = pzem.energy();
          if (!sdMode && isConnected && isVoltageSufficient) {
            String path = "rooms/" + roomId;
            FirebaseJson content;
            content.set("fields/status/stringValue", "occupied");
            content.set("fields/assignedInstructor/stringValue", firestoreTeachers[uid]["fullName"]);
            if (Firebase.Firestore.patchDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", path.c_str(), content.raw(), "status,assignedInstructor")) {
              firestoreRooms[roomId]["status"] = "occupied";
              firestoreRooms[roomId]["assignedInstructor"] = firestoreTeachers[uid]["fullName"];
            }
          }
          break;
        }
      }
    }
  }
}
void updateRoomStatus(String roomId, String status, String instructorName, String subject, String sessionStart, String sessionEnd, float startReading, float endReading, float totalUsage) {
  if (!sdMode && isConnected && isVoltageSufficient) {
    String path = "rooms/" + roomId;
    FirebaseJson content;
    content.set("fields/status/stringValue", status);
    content.set("fields/assignedInstructor/stringValue", "");
    content.set("fields/lastSession/mapValue/fields/subject/stringValue", subject);
    content.set("fields/lastSession/mapValue/fields/instructorName/stringValue", instructorName);
    content.set("fields/lastSession/mapValue/fields/sessionStart/stringValue", sessionStart);
    content.set("fields/lastSession/mapValue/fields/sessionEnd/stringValue", sessionEnd);
    content.set("fields/lastSession/mapValue/fields/energyUsageStart/doubleValue", startReading);
    content.set("fields/lastSession/mapValue/fields/energyUsageEnd/doubleValue", endReading);
    content.set("fields/lastSession/mapValue/fields/totalUsage/doubleValue", totalUsage);
    if (Firebase.Firestore.patchDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", path.c_str(), content.raw(), "status,assignedInstructor,lastSession")) {
      firestoreRooms[roomId]["status"] = status;
      firestoreRooms[roomId]["assignedInstructor"] = "";
    }
  }
  assignedRoomId = "";
  sessionStartReading = 0.0;
}

void storeLogToSD(String entry) {
  // Only store logs if WiFi is disconnected (offline mode)
  if (isConnected) {
    Serial.println("WiFi is connected. Skipping SD log storage for: " + entry);
    return;
  }

  // Static flag to track if we've already tried reinitializing in this call
  static bool reinitializedInThisCall = false;

  // Check if SD card is initialized; initialize only once during setup or after a known failure
  if (!sdInitialized && !reinitializedInThisCall) {
    if (!SD.begin(SD_CS, fsSPI, 4000000)) {
      Serial.println("SD card initialization failed during setup. Cannot store log: " + entry);
      sdInitialized = false;
      return;
    }
    sdInitialized = true;
    Serial.println("SD card initialized for logging.");
  }

  // Attempt to open the file for appending
  File logFile = SD.open(OFFLINE_LOG_FILE, FILE_APPEND);
  if (logFile) {
    logFile.println(entry);
    logFile.flush();  // Ensure data is written to SD card
    logFile.close();  // Explicitly close to release the handle
    Serial.println("Stored to SD: " + entry);
    reinitializedInThisCall = false;  // Reset flag on success
  } else {
    Serial.println("Failed to open " + String(OFFLINE_LOG_FILE) + " for writing. Diagnosing...");

    // Check if SD card is still responsive without immediately reinitializing
    File root = SD.open("/");
    if (!root) {
      Serial.println("SD card root directory inaccessible. Attempting reinitialization...");
      if (!reinitializedInThisCall && SD.begin(SD_CS, fsSPI, 4000000)) {
        Serial.println("SD card reinitialized successfully.");
        sdInitialized = true;
        reinitializedInThisCall = true;
      } else {
        Serial.println("SD card reinitialization failed. Hardware issue or card removed?");
        sdInitialized = false;
        Serial.println("Falling back to serial-only logging: " + entry);
        return;
      }
    } else {
      root.close();
      Serial.println("SD card root accessible, issue is file-specific.");
    }

    // Check if the file exists and try to recreate it if necessary
    if (SD.exists(OFFLINE_LOG_FILE)) {
      Serial.println(String(OFFLINE_LOG_FILE) + " exists but can't be opened. Attempting to delete...");
      if (SD.remove(OFFLINE_LOG_FILE)) {
        Serial.println("Deleted " + String(OFFLINE_LOG_FILE) + " successfully.");
      } else {
        Serial.println("Failed to delete " + String(OFFLINE_LOG_FILE) + ". Possible write protection or corruption.");
        return;
      }
    } else {
      Serial.println(String(OFFLINE_LOG_FILE) + " does not exist yet. Creating new file...");
    }

    // Retry opening the file after potential deletion or if it didn't exist
    logFile = SD.open(OFFLINE_LOG_FILE, FILE_APPEND);
    if (logFile) {
      logFile.println(entry);
      logFile.flush();  // Ensure data is written
      logFile.close();
      Serial.println("Recreated and stored to SD: " + entry);
      reinitializedInThisCall = false;  // Reset flag on success
    } else {
      Serial.println("Retry failed for " + String(OFFLINE_LOG_FILE) + ". Testing SD card integrity...");
      File testFile = SD.open("/test_log.txt", FILE_WRITE);
      if (testFile) {
        testFile.println("Test entry at " + getFormattedTime() + ": " + entry);
        testFile.flush();
        testFile.close();
        Serial.println("Test write to /test_log.txt succeeded. Issue is specific to " + String(OFFLINE_LOG_FILE));
      } else {
        Serial.println("Test write to /test_log.txt failed. SD card is likely faulty or full.");
        sdInitialized = false;
        Serial.println("Falling back to serial-only logging: " + entry);
      }
    }
  }
}

bool syncOfflineLogs() {
  if (sdMode || !isConnected || !isVoltageSufficient) {
    Serial.println("Cannot sync logs: SD mode or no connection/voltage.");
    return false;
  }
  if (!SD.exists(OFFLINE_LOG_FILE)) {
    Serial.println("No offline logs to sync.");
    return true;
  }
  File file = SD.open(OFFLINE_LOG_FILE, FILE_READ);
  if (!file) {
    Serial.println("⚠️ Could not open SD log file for syncing.");
    return false;
  }
  Serial.println("Syncing offline logs to Firebase...");
  bool allSuccess = true;
  while (file.available()) {
    String entry = file.readStringUntil('\n');
    entry.trim();
    if (entry.length() > 0) {
      Serial.println("Sync log: " + entry);
      nonBlockingDelay(1);
    }
  }
  file.close();
  if (allSuccess) {
    if (SD.remove(OFFLINE_LOG_FILE)) {
      Serial.println("SD log file cleared after sync.");
      return true;
    } else {
      Serial.println("⚠️ Could not remove SD file.");
      return false;
    }
  } else {
    Serial.println("Some logs failed to upload; keeping SD file.");
    return false;
  }
}

void logSuperAdminPZEMToSD(String uid, String timestamp) {
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power = pzem.power();
  float energy = pzem.energy();
  float frequency = pzem.frequency();
  float pf = pzem.pf();

  // Ensure valid readings
  if (isnan(voltage) || voltage < 0) voltage = 0.0;
  if (isnan(current) || current < 0) current = 0.0;
  if (isnan(power) || power < 0) power = 0.0;
  if (isnan(energy) || energy < 0) energy = 0.0;
  if (isnan(frequency) || frequency < 0) frequency = 0.0;
  if (isnan(pf) || pf < 0) pf = 0.0;

  // Calculate total energy since session start
  static float superAdminTotalEnergy = 0.0;
  static unsigned long lastSuperAdminPZEMUpdate = 0;
  if (lastSuperAdminPZEMUpdate != 0) {
    unsigned long elapsed = millis() - lastSuperAdminPZEMUpdate;
    float energyIncrement = (power * (elapsed / 3600000.0)) / 1000.0;
    superAdminTotalEnergy += energyIncrement;
  }
  lastSuperAdminPZEMUpdate = millis();

  // Log to SD card
  String entry = "SuperAdminPZEM:" + uid + " Timestamp:" + timestamp +
                 " Voltage:" + String(voltage, 2) + "V" +
                 " Current:" + String(current, 2) + "A" +
                 " Power:" + String(power, 2) + "W" +
                 " Energy:" + String(energy, 2) + "kWh" +
                 " Frequency:" + String(frequency, 2) + "Hz" +
                 " PowerFactor:" + String(pf, 2) +
                 " TotalConsumption:" + String(superAdminTotalEnergy, 3) + "kWh";
  storeLogToSD(entry);
  Serial.println("Super Admin PZEM logged to SD: " + entry);

  // Reset total energy when session ends
  if (!superAdminSessionActive) {
    superAdminTotalEnergy = 0.0;
    lastSuperAdminPZEMUpdate = 0;
  }
}

void printSDCardInfo() {
  uint64_t cardSize = SD.cardSize() / (1024 * 1024);
  uint64_t cardFree = (SD.totalBytes() - SD.usedBytes()) / (1024 * 1024);
  Serial.println("SD Card Info:");
  Serial.print("Total space: "); Serial.print(cardSize); Serial.println(" MB");
  Serial.print("Free space: "); Serial.print(cardFree); Serial.println(" MB");
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void activateRelays() {
  // If transition already in progress, queue it
  if (relayTransitionInProgress) {
    Serial.println("SAFETY: Relay transition already in progress, queuing activation");
    relayOperationPending = true;
    pendingRelayActivation = true;
    return;
  }
  
  // Start transition
  relayTransitionInProgress = true;
  relayTransitionStartTime = millis();
  
  // RELAY LOGIC:
  // HIGH = Relay OFF/Inactive = Door unlocked
  // LOW = Relay ON/Active = Door locked
  
  // Locking the doors (activating relays)
  digitalWrite(RELAY1, LOW);
  delay(5); // Minimal delay that won't cause system instability
  digitalWrite(RELAY2, LOW);
  delay(5);
  digitalWrite(RELAY3, LOW);
  delay(5);
  digitalWrite(RELAY4, LOW);
  
  // Update state flags
  relayActive = true;
  relayActiveTime = millis();
  relayTransitionInProgress = false;
  
  Serial.println("Relays activated (locked) with safe timing");
  
  // Non-blocking approach to delay PZEM readings
  lastPZEMUpdate = millis() + 1000; // Wait 1 second before next PZEM reading
}

void deactivateRelays() {
  // If transition already in progress, queue it
  if (relayTransitionInProgress) {
    Serial.println("SAFETY: Relay transition already in progress, queuing deactivation");
    relayOperationPending = true;
    pendingRelayActivation = false;
    return;
  }
  
  // If we're in the middle of a critical operation, delay the deactivation
  if ((WiFi.status() == WL_CONNECTED && WiFi.status() != WL_IDLE_STATUS) ||
      (Firebase.ready() && Firebase.isTokenExpired() < 5)) {
    // We're in the middle of a network operation, schedule for later
    Serial.println("SAFETY: Network operation active, scheduling relay deactivation");
    relayPendingDeactivation = true;
    relayDeactivationTime = millis() + RELAY_SAFE_DELAY;
    return;
  }
  
  // Start transition
  relayTransitionInProgress = true;
  relayTransitionStartTime = millis();
  
  // RELAY LOGIC:
  // HIGH = Relay OFF/Inactive = Door unlocked
  // LOW = Relay ON/Active = Door locked
  
  // Unlocking the doors (deactivating relays)
  digitalWrite(RELAY1, HIGH);
  delay(5); // Minimal delay that won't cause system instability
  digitalWrite(RELAY2, HIGH);
  delay(5);
  digitalWrite(RELAY3, HIGH);
  delay(5);
  digitalWrite(RELAY4, HIGH);
  
  // Update state flags
  relayActive = false;
  relayTransitionInProgress = false;
  
  Serial.println("Relays deactivated (unlocked) with safe timing");
}

void checkPendingRelayOperations() {
  // Check for pending relay deactivation
  if (relayPendingDeactivation && millis() >= relayDeactivationTime) {
    Serial.println("Executing delayed relay deactivation");
    relayPendingDeactivation = false;
    
    // Start transition
    relayTransitionInProgress = true;
    relayTransitionStartTime = millis();
    
    // RELAY LOGIC: HIGH = Door unlocked, LOW = Door locked
    digitalWrite(RELAY1, HIGH);
    delay(5);
    digitalWrite(RELAY2, HIGH);
    delay(5);
    digitalWrite(RELAY3, HIGH);
    delay(5);
    digitalWrite(RELAY4, HIGH);
    
    relayActive = false;
    relayTransitionInProgress = false;
    Serial.println("Relays safely deactivated after delay");
  }
  
  // Check for pending operations
  if (relayOperationPending && !relayTransitionInProgress) {
    relayOperationPending = false;
    
    if (pendingRelayActivation) {
      Serial.println("Executing pending relay activation");
      activateRelays();
    } else if (!relayPendingDeactivation) {
      Serial.println("Executing pending relay deactivation");
      deactivateRelays();
    }
  }
  
  // Check for transition timeout (safety mechanism)
  if (relayTransitionInProgress && (millis() - relayTransitionStartTime > RELAY_TRANSITION_TIMEOUT)) {
    Serial.println("WARNING: Relay transition timeout, forcing completion");
    relayTransitionInProgress = false;
  }
}

// Global FirebaseJson objects to reduce stack usage
static FirebaseJson instructorData;
static FirebaseJson accessJson;
static FirebaseJson classStatusJson;
static FirebaseJson pzemJson;
static FirebaseJson matchingSchedule;

void logInstructor(String uid, String timestamp, String action) {
  // Log to SD
  String entry = "Instructor:" + uid + " Action:" + action + " Time:" + timestamp;
  storeLogToSD(entry);
  Serial.println("SD log stored to /Offline_Logs_Entry.txt: " + entry);

  // Voltage check
  float currentVoltage = pzem.voltage();
  if (!isVoltageSufficient || isnan(currentVoltage)) {
    delay(50);
    currentVoltage = pzem.voltage();
    isVoltageSufficient = (currentVoltage >= voltageThreshold && !isnan(currentVoltage));
  }
  Serial.println("Conditions - sdMode: " + String(sdMode) + 
                 ", isConnected: " + String(isConnected) + 
                 ", Voltage: " + (isnan(currentVoltage) ? "NaN" : String(currentVoltage, 2)) + "V" +
                 ", Threshold: " + String(voltageThreshold) + "V");

  // Extract time
  String currentTime = timestamp.substring(11, 13) + ":" + timestamp.substring(13, 15); // HH:MM

  // Schedule check
  static ScheduleInfo currentSchedule = {false, "", "", "", "", "", "", ""};
  if (action == "Access") {
    currentSchedule = isWithinSchedule(uid, timestamp);
    lastInstructorUID = uid;
  } else if (action == "EndSession" && lastInstructorUID == uid) {
    // Always try to revalidate schedule for EndSession, whether or not it's already valid
    currentSchedule = isWithinSchedule(uid, timestamp);
    
    if (currentSchedule.isValid) {
      Serial.println("Schedule valid for EndSession: " + currentSchedule.day + " " + 
                     currentSchedule.startTime + "-" + currentSchedule.endTime + ", Room: " + 
                     currentSchedule.roomName + ", Subject: " + currentSchedule.subject);
    } else {
      // If still not valid, try using current date with the last known schedule times
      Serial.println("Schedule not valid for EndSession. Trying with today's date...");
      // Get instructor schedule for the current day regardless of time
      String dateOnly = timestamp.substring(0, 10); // YYYY_MM_DD
      currentSchedule = getInstructorScheduleForDay(uid, dateOnly);
      
      if (currentSchedule.isValid) {
        Serial.println("Retrieved schedule using today's date: " + currentSchedule.day + 
                      " " + currentSchedule.startTime + "-" + currentSchedule.endTime);
      } else {
        Serial.println("WARNING: Unable to retrieve valid schedule for instructor " + uid + 
                      " during EndSession. PZEM data may not be properly logged.");
      }
    }
  }

  // Fetch instructor data
  String fullName = firestoreTeachers[uid]["fullName"].length() > 0 ? firestoreTeachers[uid]["fullName"] : "Unknown";
  String role = firestoreTeachers[uid]["role"].length() > 0 ? firestoreTeachers[uid]["role"] : "instructor";
  role.trim();
  if (!role.equalsIgnoreCase("instructor")) role = "instructor";

  // Schedule endTime check
  static bool pzemLoggedForSession = false;
  if (relayActive && !tapOutPhase && currentSchedule.isValid && action != "EndSession") {
    if (currentTime >= currentSchedule.endTime) {
      digitalWrite(RELAY2, HIGH);
      digitalWrite(RELAY3, HIGH);
      digitalWrite(RELAY4, HIGH);
      relayActive = false;
      classSessionActive = false;
      tapOutPhase = true;
      tapOutStartTime = millis();
      pzemLoggedForSession = false;
      tapOutSchedule = currentSchedule; // Save current schedule for tap-out phase
      displayMessage("Class Ended", "Tap to Confirm", 3000);
      Serial.println("Schedule endTime " + currentSchedule.endTime + " reached at " + currentTime + ". Transition to tap-out phase.");
    }
  }

  // Firebase logging
  if (!sdMode && isConnected && Firebase.ready()) {
    Serial.println("Firebase conditions met. Logging UID: " + uid + " Action: " + action);

    String instructorPath = "/Instructors/" + uid;

    // Profile data
    FirebaseJson instructorData;
    instructorData.set("fullName", fullName);
    instructorData.set("email", firestoreTeachers[uid]["email"].length() > 0 ? firestoreTeachers[uid]["email"] : "N/A");
    instructorData.set("idNumber", firestoreTeachers[uid]["idNumber"].length() > 0 ? firestoreTeachers[uid]["idNumber"] : "N/A");
    instructorData.set("mobileNumber", firestoreTeachers[uid]["mobileNumber"].length() > 0 ? firestoreTeachers[uid]["mobileNumber"] : "N/A");
    instructorData.set("role", role);
    instructorData.set("department", firestoreTeachers[uid]["department"].length() > 0 ? firestoreTeachers[uid]["department"] : "Unknown");
    instructorData.set("createdAt", firestoreTeachers[uid]["createdAt"].length() > 0 ? firestoreTeachers[uid]["createdAt"] : "N/A");

    // Access log
    FirebaseJson accessJson;
    accessJson.set("action", action);
    accessJson.set("timestamp", timestamp);
    accessJson.set("status", (action == "Access" && currentSchedule.isValid) ? "granted" : (action == "Access" ? "denied" : "completed"));

    // Class status
    FirebaseJson classStatusJson;
    String status = (action == "Access" && currentSchedule.isValid) ? "In Session" : (action == "Access" ? "Denied" : "End Session");
    classStatusJson.set("Status", status);
    classStatusJson.set("dateTime", timestamp);

    // Always include schedule for Access and EndSession to ensure PZEM data is logged
    FirebaseJson scheduleJson;
    scheduleJson.set("day", currentSchedule.day.length() > 0 ? currentSchedule.day : "Unknown");
    scheduleJson.set("startTime", currentSchedule.startTime.length() > 0 ? currentSchedule.startTime : "Unknown");
    scheduleJson.set("endTime", currentSchedule.endTime.length() > 0 ? currentSchedule.endTime : "Unknown");
    scheduleJson.set("subject", currentSchedule.subject.length() > 0 ? currentSchedule.subject : "Unknown");
    scheduleJson.set("subjectCode", currentSchedule.subjectCode.length() > 0 ? currentSchedule.subjectCode : "Unknown");
    scheduleJson.set("section", currentSchedule.section.length() > 0 ? currentSchedule.section : "Unknown");
    FirebaseJson roomNameJson;
    roomNameJson.set("name", currentSchedule.roomName.length() > 0 ? currentSchedule.roomName : "Unknown");

    // PZEM data for EndSession on first tap
    if (action == "EndSession" && uid == lastInstructorUID) {
      // Check if ending early
      String currentTime = timestamp.substring(11, 13) + ":" + timestamp.substring(13, 15); // HH:MM
      if (currentSchedule.isValid && currentTime < currentSchedule.endTime) {
        Serial.println("Instructor UID " + uid + " ended session early before endTime " + currentSchedule.endTime + ".");
      }
      
      float voltage = pzem.voltage();
      float current = pzem.current();
      float power = pzem.power();
      float energy = pzem.energy();
      float frequency = pzem.frequency();
      float powerFactor = pzem.pf();

      if (isnan(voltage) || voltage < 0) voltage = 0.0;
      if (isnan(current) || current < 0) current = 0.0;
      if (isnan(power) || power < 0) power = 0.0;
      if (isnan(energy) || energy < 0) energy = 0.0;
      if (isnan(frequency) || frequency < 0) frequency = 0.0;
      if (isnan(powerFactor) || powerFactor < 0) powerFactor = 0.0;

      FirebaseJson pzemJson;
      pzemJson.set("voltage", String(voltage, 1));
      pzemJson.set("current", String(current, 2));
      pzemJson.set("power", String(power, 1));
      pzemJson.set("energy", String(energy, 2));
      pzemJson.set("frequency", String(frequency, 1));
      pzemJson.set("powerFactor", String(powerFactor, 2));
      pzemJson.set("timestamp", timestamp);
      pzemJson.set("action", "end");
      roomNameJson.set("pzem", pzemJson);
      pzemLoggedForSession = true;
      Serial.println("PZEM logged at session end: Voltage=" + String(voltage, 1) + ", Energy=" + String(energy, 2));

      // Store PZEM data under Rooms node
      if (currentSchedule.roomName.length() > 0) {
        String roomPath = "/Instructors/" + uid + "/Rooms/" + currentSchedule.roomName;
        FirebaseJson roomPzemJson;
        roomPzemJson.set("voltage", String(voltage, 1));
        roomPzemJson.set("current", String(current, 2));
        roomPzemJson.set("power", String(power, 1));
        roomPzemJson.set("energy", String(energy, 2));
        roomPzemJson.set("frequency", String(frequency, 1));
        roomPzemJson.set("powerFactor", String(powerFactor, 2));
        roomPzemJson.set("timestamp", timestamp);
        roomPzemJson.set("sessionId", currentSessionId);
        roomPzemJson.set("subject", currentSchedule.subject);
        roomPzemJson.set("subjectCode", currentSchedule.subjectCode);
        roomPzemJson.set("section", currentSchedule.section);
        roomPzemJson.set("sessionStart", currentSchedule.startTime);
        roomPzemJson.set("sessionEnd", currentSchedule.endTime);
        roomPzemJson.set("date", timestamp.substring(0, 10));

        Serial.print("Storing PZEM data under room: " + roomPath + "... ");
        if (Firebase.RTDB.setJSON(&fbdo, roomPath, &roomPzemJson)) {
          Serial.println("Success");
          Serial.println("PZEM data logged under room " + currentSchedule.roomName);
        } else {
          Serial.println("Failed: " + fbdo.errorReason());
          storeLogToSD("RoomPZEMLogFailed:UID:" + uid + " Room:" + currentSchedule.roomName + " Time:" + timestamp + " Error:" + fbdo.errorReason());
        }
      }
    }

    scheduleJson.set("roomName", roomNameJson);
    classStatusJson.set("schedule", scheduleJson);

    // Perform Firebase operations
    bool success = true;
    if (!Firebase.RTDB.setJSON(&fbdo, instructorPath + "/Profile", &instructorData)) {
      Serial.println("Failed to sync profile: " + fbdo.errorReason());
      success = false;
      storeLogToSD("ProfileFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }
    if (!Firebase.RTDB.pushJSON(&fbdo, instructorPath + "/AccessLogs", &accessJson)) {
      Serial.println("Failed to push access log: " + fbdo.errorReason());
      success = false;
      storeLogToSD("AccessLogFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }
    if (!Firebase.RTDB.setJSON(&fbdo, instructorPath + "/ClassStatus", &classStatusJson)) {
      Serial.println("Failed to update class status: " + fbdo.errorReason());
      success = false;
      storeLogToSD("ClassStatusFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }
    if (!Firebase.RTDB.setString(&fbdo, "/RegisteredUIDs/" + uid, timestamp)) {
      Serial.println("Failed to update RegisteredUIDs: " + fbdo.errorReason());
      success = false;
      storeLogToSD("RegisteredUIDsFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }

    if (!success) {
      sdMode = true;
      Serial.println("Firebase logging failed. Switching to SD mode.");
    } else {
      Serial.println("Instructor " + fullName + " logged to Firebase successfully at path: " + instructorPath);
    }
  } else {
    Serial.println("Firebase conditions not met: sdMode=" + String(sdMode) + 
                   ", isConnected=" + String(isConnected) + 
                   ", isVoltageSufficient=" + String(isVoltageSufficient) + 
                   ", Firebase.ready=" + String(Firebase.ready()));
    if (action == "EndSession" && uid == lastInstructorUID) {
      float voltage = pzem.voltage();
      float current = pzem.current();
      float power = pzem.power();
      float energy = pzem.energy();
      float frequency = pzem.frequency();
      float powerFactor = pzem.pf();
      if (isnan(voltage) || voltage < 0) voltage = 0.0;
      if (isnan(current) || current < 0) current = 0.0;
      if (isnan(power) || power < 0) power = 0.0;
      if (isnan(energy) || energy < 0) energy = 0.0;
      if (isnan(frequency) || frequency < 0) frequency = 0.0;
      if (isnan(powerFactor) || powerFactor < 0) powerFactor = 0.0;
      String pzemEntry = "PZEM:UID:" + uid + " Time:" + timestamp +
                         " Voltage:" + String(voltage, 1) + "V" +
                         " Current:" + String(current, 2) + "A" +
                         " Power:" + String(power, 1) + "W" +
                         " Energy:" + String(energy, 2) + "kWh" +
                         " Frequency:" + String(frequency, 1) + "Hz" +
                         " PowerFactor:" + String(powerFactor, 2);
      storeLogToSD(pzemEntry);
      pzemLoggedForSession = true;
    }
  }

  // Handle actions
  if (action == "Access") {
    if (!currentSchedule.isValid) {
      // Before denying access, try to refresh schedule data from Firestore
      bool scheduleFound = false;
      
      // First log a temporary "pending" status
      if (!sdMode && isConnected && Firebase.ready()) {
        // Log the temporary "pending verification" status
        String tempPath = "/Instructors/" + uid + "/AccessLogs";
        FirebaseJson tempAccessJson;
        tempAccessJson.set("action", "Access");
        tempAccessJson.set("status", "pending_verification");
        tempAccessJson.set("timestamp", timestamp);
        tempAccessJson.set("note", "Checking for schedule updates");
        String tempLogId;
        
        if (Firebase.RTDB.pushJSON(&fbdo, tempPath, &tempAccessJson)) {
          // Save the temporary log ID for potential update later
          tempLogId = fbdo.pushName();
          Serial.println("Temporary pending log created with ID: " + tempLogId);
        }
        
        // Display message indicating schedule check
        displayMessage("Checking for", "Updated Schedule", 2000);
        Serial.println("Instructor UID " + uid + " outside schedule. Checking for updates...");
        
        // Fetch updated teacher and room data from Firestore
        fetchFirestoreTeachers();
        fetchFirestoreRooms();
        
        // Check schedule again with freshly fetched data
        currentSchedule = isWithinSchedule(uid, timestamp);
        
        if (currentSchedule.isValid) {
          Serial.println("Updated schedule found after refresh! Room: " + currentSchedule.roomName);
          scheduleFound = true;
          
          // Update the previously created log to reflect successful verification
          if (tempLogId.length() > 0) {
            String updatePath = "/Instructors/" + uid + "/AccessLogs/" + tempLogId;
            FirebaseJson updateJson;
            updateJson.set("status", "granted");
            updateJson.set("note", "Access granted after schedule refresh");
            
            if (Firebase.RTDB.updateNode(&fbdo, updatePath, &updateJson)) {
              Serial.println("Access log updated to 'granted' after schedule refresh");
            } else {
              Serial.println("Failed to update access log: " + fbdo.errorReason());
            }
          }
          
          // Update instructor ClassStatus to reflect the valid schedule
          String classStatusPath = "/Instructors/" + uid + "/ClassStatus";
          FirebaseJson classStatusJson;
          classStatusJson.set("Status", "In Session");
          classStatusJson.set("dateTime", timestamp);
          classStatusJson.set("schedule/day", currentSchedule.day);
          classStatusJson.set("schedule/startTime", currentSchedule.startTime);
          classStatusJson.set("schedule/endTime", currentSchedule.endTime);
          classStatusJson.set("schedule/subject", currentSchedule.subject);
          classStatusJson.set("schedule/subjectCode", currentSchedule.subjectCode);
          classStatusJson.set("schedule/section", currentSchedule.section);
          classStatusJson.set("schedule/roomName/name", currentSchedule.roomName);
          
          if (Firebase.RTDB.updateNode(&fbdo, classStatusPath, &classStatusJson)) {
            Serial.println("Class status updated to 'In Session' after schedule refresh");
          } else {
            Serial.println("Failed to update class status: " + fbdo.errorReason());
          }
          
          // Continue with access (will be handled below since currentSchedule is now valid)
        } else {
          Serial.println("No valid schedule found even after refresh for UID " + uid);
          
          // Update the temporary log to confirm denial
          if (tempLogId.length() > 0) {
            String updatePath = "/Instructors/" + uid + "/AccessLogs/" + tempLogId;
            FirebaseJson updateJson;
            updateJson.set("status", "denied");
            updateJson.set("note", "No valid schedule found even after refresh");
            
            if (Firebase.RTDB.updateNode(&fbdo, updatePath, &updateJson)) {
              Serial.println("Access log updated to 'denied' after schedule refresh attempt");
            } else {
              Serial.println("Failed to update access log: " + fbdo.errorReason());
            }
          }
        }
      }
      
      if (!scheduleFound) {
        // No valid schedule found even after refresh
        deniedFeedback();
        displayMessage("Outside Schedule", "Access Denied", 6000);
        Serial.println("Instructor UID " + uid + " denied: outside schedule.");
        return;
      }
    }

    if (!relayActive) {
      digitalWrite(RELAY1, LOW);
      digitalWrite(RELAY2, LOW);
      digitalWrite(RELAY3, LOW);
      digitalWrite(RELAY4, LOW);
      relayActive = true;
      studentVerificationActive = true;
      studentVerificationStartTime = millis();
      currentStudentQueueIndex = 0;
      lastStudentTapTime = millis();
      presentCount = 0;
      pzemLoggedForSession = false;

      String subject = currentSchedule.subject.length() > 0 ? currentSchedule.subject : "UNK";
      String subjectCode = currentSchedule.subjectCode.length() > 0 ? currentSchedule.subjectCode : "UNK";
      String section = currentSchedule.section.length() > 0 ? currentSchedule.section : "UNK";
      String roomName = currentSchedule.roomName.length() > 0 ? currentSchedule.roomName : "UNK";
      String startTimeStr = currentSchedule.startTime.length() > 0 ? currentSchedule.startTime : "Unknown";
      String endTimeStr = currentSchedule.endTime.length() > 0 ? currentSchedule.endTime : "Unknown";

      if (section == "UNK" && firestoreTeachers[uid]["sections"] != "[]") {
        FirebaseJson sectionsJson;
        if (sectionsJson.setJsonData(firestoreTeachers[uid]["sections"])) {
          FirebaseJsonData sectionData;
          if (sectionsJson.get(sectionData, "[0]/name") && sectionData.typeNum == FirebaseJson::JSON_STRING) {
            section = sectionData.stringValue;
          }
        }
      }

      String classDate = timestamp.substring(0, 10);
      currentSessionId = classDate + "_" + subjectCode + "_" + section + "_" + roomName;
      studentAssignedSensors.clear();
      studentWeights.clear();
      sessionStartReading = pzem.energy();

      accessFeedback();
      Serial.println("Class session started. Session ID: " + currentSessionId + ", Room: " + roomName);
      displayMessage(subjectCode + " " + section, roomName + " " + startTimeStr + "-" + endTimeStr, 5000);
    } else if (relayActive && uid == lastInstructorUID && !tapOutPhase) {
      digitalWrite(RELAY2, HIGH);
      digitalWrite(RELAY3, HIGH);
      digitalWrite(RELAY4, HIGH);
      relayActive = false;
      classSessionActive = false;
      tapOutPhase = true;
      tapOutStartTime = millis();
      displayMessage("Class Ended", "Tap to Confirm", 3000);
      Serial.println("Instructor UID " + uid + " ended session early before endTime " + currentSchedule.endTime + ".");
    }
  } else if (action == "EndSession" && relayActive && uid == lastInstructorUID && !tapOutPhase) {
    digitalWrite(RELAY2, HIGH);
    digitalWrite(RELAY3, HIGH);
    digitalWrite(RELAY4, HIGH);
    relayActive = false;
    classSessionActive = false;
    tapOutPhase = true;
    tapOutStartTime = millis();
    tapOutSchedule = currentSchedule; // Save current schedule for tap-out phase
    displayMessage("Class Ended", "Tap to Confirm", 3000);
    Serial.println("Instructor UID " + uid + " explicitly ended session early with EndSession action.");
  } else if (action == "EndSession" && tapOutPhase && uid == lastInstructorUID) {
    displayMessage("Session Finalized", "Summary Saved", 3000);
    Serial.println("Final tap by instructor UID " + uid + ". Generating AttendanceSummary.");

    if (!sdMode && isConnected && Firebase.ready()) {
      String classStatusPath = "/Instructors/" + uid + "/ClassStatus";
      FirebaseJson classStatusUpdate;
      classStatusUpdate.set("Status", "End Session");
      classStatusUpdate.set("dateTime", timestamp);

      // Include schedule without PZEM data
      FirebaseJson scheduleJson;
      scheduleJson.set("day", currentSchedule.day.length() > 0 ? currentSchedule.day : "Unknown");
      scheduleJson.set("startTime", currentSchedule.startTime.length() > 0 ? currentSchedule.startTime : "Unknown");
      scheduleJson.set("endTime", currentSchedule.endTime.length() > 0 ? currentSchedule.endTime : "Unknown");
      scheduleJson.set("subject", currentSchedule.subject.length() > 0 ? currentSchedule.subject : "Unknown");
      scheduleJson.set("subjectCode", currentSchedule.subjectCode.length() > 0 ? currentSchedule.subjectCode : "Unknown");
      scheduleJson.set("section", currentSchedule.section.length() > 0 ? currentSchedule.section : "Unknown");
      
      FirebaseJson roomNameJson;
      roomNameJson.set("name", currentSchedule.roomName.length() > 0 ? currentSchedule.roomName : "Unknown");
      scheduleJson.set("roomName", roomNameJson);
      classStatusUpdate.set("schedule", scheduleJson);

      if (!Firebase.RTDB.setJSON(&fbdo, classStatusPath, &classStatusUpdate)) {
        Serial.println("Failed to update ClassStatus: " + fbdo.errorReason());
        storeLogToSD("ClassStatusFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
      } else {
        Serial.println("ClassStatus updated at " + classStatusPath);
      }
    }

    // Generate AttendanceSummary
    String summaryPath = "/AttendanceSummary/" + currentSessionId;
    FirebaseJson summaryJson;
    summaryJson.set("InstructorName", fullName);
    summaryJson.set("StartTime", timestamp); // Note: Consider storing actual start time
    summaryJson.set("EndTime", timestamp);
    summaryJson.set("Status", "Class Ended");
    summaryJson.set("SubjectCode", currentSchedule.subjectCode.length() > 0 ? currentSchedule.subjectCode : "Unknown");
    summaryJson.set("SubjectName", currentSchedule.subject.length() > 0 ? currentSchedule.subject : "Unknown");
    summaryJson.set("Day", currentSchedule.day.length() > 0 ? currentSchedule.day : "Unknown");
    summaryJson.set("Section", currentSchedule.section.length() > 0 ? currentSchedule.section : "Unknown");

    // Fetch students
    FirebaseJson attendeesJson;
    int totalAttendees = 0;
    std::set<String> processedStudents;

    for (const auto& student : firestoreStudents) {
      String studentUid = student.first;
      String studentSection;
      try {
        studentSection = student.second.at("section").length() > 0 ? student.second.at("section") : "";
      } catch (const std::out_of_range&) {
        studentSection = "";
      }
      if (studentSection != currentSchedule.section) continue;

      String studentPath = "/Students/" + studentUid;
      String studentName;
      try {
        studentName = student.second.at("fullName").length() > 0 ? student.second.at("fullName") : "Unknown";
      } catch (const std::out_of_range&) {
        studentName = "Unknown";
      }
      String status = "Absent";
      float weight = 0.0;
      String studentSessionId = "";

      if (Firebase.RTDB.getJSON(&fbdo, studentPath)) {
        FirebaseJsonData data;
        if (fbdo.jsonObjectPtr()->get(data, "Status")) {
          status = data.stringValue;
        }
        if (fbdo.jsonObjectPtr()->get(data, "weight")) {
          weight = data.doubleValue;
        }
        if (fbdo.jsonObjectPtr()->get(data, "sessionId")) {
          studentSessionId = data.stringValue;
        }
      }

      if (studentSessionId == currentSessionId && status == "Present") {
        totalAttendees++;
      }

      FirebaseJson studentJson;
      studentJson.set("StudentName", studentName);
      studentJson.set("Status", status);
      studentJson.set("Weight", weight);
      attendeesJson.set(studentUid, studentJson);
      processedStudents.insert(studentUid);
    }

    // Handle pendingStudentTaps
    for (const String& studentUid : pendingStudentTaps) {
      if (processedStudents.find(studentUid) != processedStudents.end()) continue;
      processedStudents.insert(studentUid);

      String studentPath = "/Students/" + studentUid;
      String studentName;
      try {
        studentName = firestoreStudents.at(studentUid).at("fullName").length() > 0 ? firestoreStudents.at(studentUid).at("fullName") : "Unknown";
      } catch (const std::out_of_range&) {
        studentName = "Unknown";
      }
      String status = "Absent";
      float weight = 0.0;

      if (Firebase.RTDB.getJSON(&fbdo, studentPath)) {
        FirebaseJsonData data;
        if (fbdo.jsonObjectPtr()->get(data, "Status")) {
          status = data.stringValue;
        }
        if (fbdo.jsonObjectPtr()->get(data, "weight")) {
          weight = data.doubleValue;
        }
      }

      FirebaseJson studentJson;
      studentJson.set("StudentName", studentName);
      studentJson.set("Status", status);
      studentJson.set("Weight", weight);
      attendeesJson.set(studentUid, studentJson);
    }

    summaryJson.set("Attendees", attendeesJson);
    summaryJson.set("TotalAttendees", totalAttendees);

    if (Firebase.RTDB.setJSON(&fbdo, summaryPath, &summaryJson)) {
      Serial.println("AttendanceSummary created at " + summaryPath + ", Attendees: " + String(totalAttendees));
    } else {
      Serial.println("Failed to create AttendanceSummary: " + fbdo.errorReason());
      storeLogToSD("AttendanceSummaryFailed:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }

    // SD mode summary (moved here to ensure it's part of final tap)
    if (sdMode || !isConnected || !Firebase.ready()) {
      String summaryEntry = "AttendanceSummary:SessionID:" + currentSessionId + 
                           " Instructor:" + fullName + 
                           " Start:" + timestamp + 
                           " End:" + timestamp + 
                           " Status:Class Ended";
      
      int totalAttendees = 0;
      for (const auto& student : firestoreStudents) {
        String studentUid = student.first;
        String studentSection;
        try {
          studentSection = student.second.at("section").length() > 0 ? student.second.at("section") : "";
        } catch (const std::out_of_range&) {
          studentSection = "";
        }
        if (studentSection != currentSchedule.section) continue;
        String studentName;
        try {
          studentName = student.second.at("fullName").length() > 0 ? student.second.at("fullName") : "Unknown";
        } catch (const std::out_of_range&) {
          studentName = "Unknown";
        }
        if (studentWeights.find(studentUid) != studentWeights.end() && studentWeights[studentUid] >= 15) {
          totalAttendees++;
          summaryEntry += " Student:" + studentUid + ":" + studentName + ":Present";
        } else {
          summaryEntry += " Student:" + studentUid + ":" + studentName + ":Absent";
        }
      }
      for (const String& studentUid : pendingStudentTaps) {
        if (firestoreStudents.find(studentUid) == firestoreStudents.end()) continue;
        String studentName;
        try {
          studentName = firestoreStudents.at(studentUid).at("fullName").length() > 0 ? firestoreStudents.at(studentUid).at("fullName") : "Unknown";
        } catch (const std::out_of_range&) {
          studentName = "Unknown";
        }
        summaryEntry += " Student:" + studentUid + ":" + studentName + ":Absent";
      }
      storeLogToSD(summaryEntry);
      Serial.println("Firebase unavailable. AttendanceSummary logged to SD, Attendees: " + String(totalAttendees));
    }

    // Reset system
    tapOutPhase = false;
    waitingForInstructorEnd = false;
    lastInstructorUID = "";
    currentSessionId = "";
    studentAssignedSensors.clear();
    studentWeights.clear();
    pendingStudentTaps.clear();
    presentCount = 0;
    digitalWrite(RELAY1, HIGH);
    pzemLoggedForSession = false;
    Serial.println("Session fully ended. All relays off, system reset.");
    displayMessage("Ready. Tap your", "RFID Card!", 0);
    readyMessageShown = true;
  }
}

void logStudentToRTDB(String rfidUid, String timestamp, float weight, int sensorIndex, String weightConfirmed, String timeOut) {
  Serial.println("logStudentToRTDB called for UID: " + rfidUid + " at " + timestamp);

  // Default student data
  String studentName = "Unknown";
  String email = "", idNumber = "", mobileNumber = "", role = "", department = "", schedulesJsonStr = "[]";
  bool sensorConfirmed = (weightConfirmed == "true");
  float sensorWeight = sensorConfirmed ? weight : 0.0; // Use provided weight (in kg)
  String sensorType = "Weight Sensor";

  yield(); // Prevent watchdog reset

  // Sensor validation
  if (sensorIndex >= 0 && sensorIndex < NUM_SENSORS) {
    if (sensorConfirmed) {
      Serial.println("Sensor " + String(sensorIndex + 1) + " (" + sensorType + "): Confirmed, Weight: " + String(sensorWeight, 2) + " kg");
    } else {
      Serial.println("No presence confirmed on Sensor " + String(sensorIndex + 1) + " (" + sensorType + ")");
    }
  } else {
    Serial.println("No sensor assigned for UID: " + rfidUid);
  }

  // Fetch student data
  if (firestoreStudents.find(rfidUid) != firestoreStudents.end()) {
    studentName = firestoreStudents[rfidUid]["fullName"].length() > 0 ? firestoreStudents[rfidUid]["fullName"] : "Unknown";
    email = firestoreStudents[rfidUid]["email"];
    idNumber = firestoreStudents[rfidUid]["idNumber"];
    mobileNumber = firestoreStudents[rfidUid]["mobileNumber"];
    role = firestoreStudents[rfidUid]["role"].length() > 0 ? firestoreStudents[rfidUid]["role"] : "student";
    department = firestoreStudents[rfidUid]["department"];
    schedulesJsonStr = firestoreStudents[rfidUid]["schedules"].length() > 0 ? firestoreStudents[rfidUid]["schedules"] : "[]";
    Serial.println("Firestore data found for UID: " + rfidUid + ", Name: " + studentName);
  } else {
    Serial.println("No Firestore data for UID: " + rfidUid + ". Retrying...");
    yield(); // Prevent watchdog reset before fetch
    fetchFirestoreStudents();
    yield(); // Prevent watchdog reset after fetch
    if (firestoreStudents.find(rfidUid) != firestoreStudents.end()) {
      studentName = firestoreStudents[rfidUid]["fullName"].length() > 0 ? firestoreStudents[rfidUid]["fullName"] : "Unknown";
      schedulesJsonStr = firestoreStudents[rfidUid]["schedules"].length() > 0 ? firestoreStudents[rfidUid]["schedules"] : "[]";
      Serial.println("Retry successful for UID: " + rfidUid);
    }
  }

  yield(); // Prevent watchdog reset

  // Determine status and action
  String finalStatus = sensorConfirmed ? "Present" : "Pending";
  String action = sensorConfirmed ? "Confirmed Weight" : "Initial Tap";
  
  // Special case for permanently failed verification (-2 sensorIndex)
  if (sensorIndex == -2) {
    finalStatus = "Pending Recovery";
    action = "Wrong Sensor - Recovery Needed";
    sensorConfirmed = false;
  }
  
  // Special case for permanent absence due to wrong sensor (no recovery attempted before class end)
  if (sensorIndex == -3) {
    finalStatus = "Absent";
    action = "Wrong Sensor - No Recovery";
    sensorConfirmed = false;
  }
  
  String sensorStr = (sensorIndex >= 0) ? "Sensor " + String(sensorIndex + 1) + " (" + sensorType + ")" : "Not Assigned";

  // Log to SD
  String entry = "Student:UID:" + rfidUid +
                 " TimeIn:" + timestamp +
                 " Action:" + action +
                 " Status:" + finalStatus +
                 " Sensor:" + sensorStr +
                 " assignedSensorId:" + String(sensorIndex >= 0 ? sensorIndex : -1) +
                 (timeOut != "" ? " TimeOut:" + timeOut : "");
  storeLogToSD(entry);
  Serial.println("SD log: " + entry);

  yield(); // Prevent watchdog reset before Firebase operations

  // Firebase logging with new structure
  if (!sdMode && isConnected && Firebase.ready()) {
    String path = "/Students/" + rfidUid + "/Attendance/" + currentSessionId;
    
    // Process schedules to identify matched schedule and all schedules
    FirebaseJsonArray allSchedulesArray;
    FirebaseJson matchedSchedule;
    String subjectCode = "Unknown", roomName = "Unknown", sectionName = "Unknown", sectionId = "Unknown";
    String instructorName = "Unknown", subject = "Unknown";
    String scheduleDay = "Unknown", startTime = "Unknown", endTime = "Unknown";
    
    if (schedulesJsonStr != "[]") {
      FirebaseJsonArray tempArray;
      if (tempArray.setJsonArrayData(schedulesJsonStr)) {
        String currentDay = getDayFromTimestamp(timestamp);
        String currentTime = timestamp.substring(11, 16);
        bool foundMatch = false;
        
        yield(); // Prevent watchdog reset before loop
        for (size_t i = 0; i < tempArray.size(); i++) {
          FirebaseJsonData scheduleData;
          if (tempArray.get(scheduleData, i)) {
            FirebaseJson scheduleObj;
            if (scheduleObj.setJsonData(scheduleData.stringValue)) {
              FirebaseJson newScheduleObj;
              FirebaseJsonData fieldData;
              
              // Extract schedule data for allSchedules
              String scheduleDay, scheduleStartTime, scheduleEndTime, scheduleRoom;
              String scheduleSubject, scheduleSubjectCode, scheduleSection, scheduleSectionId, scheduleInstructor;
              
              if (scheduleObj.get(fieldData, "day")) {
                scheduleDay = fieldData.stringValue;
                newScheduleObj.set("day", scheduleDay);
              }
              if (scheduleObj.get(fieldData, "startTime")) {
                scheduleStartTime = fieldData.stringValue;
                newScheduleObj.set("startTime", scheduleStartTime);
              }
              if (scheduleObj.get(fieldData, "endTime")) {
                scheduleEndTime = fieldData.stringValue;
                newScheduleObj.set("endTime", scheduleEndTime);
              }
              if (scheduleObj.get(fieldData, "roomName")) {
                scheduleRoom = fieldData.stringValue;
                newScheduleObj.set("roomName", scheduleRoom);
              }
              if (scheduleObj.get(fieldData, "subjectCode")) {
                scheduleSubjectCode = fieldData.stringValue;
                newScheduleObj.set("subjectCode", scheduleSubjectCode);
              }
              if (scheduleObj.get(fieldData, "subject")) {
                scheduleSubject = fieldData.stringValue;
                newScheduleObj.set("subject", scheduleSubject);
              }
              if (scheduleObj.get(fieldData, "section")) {
                scheduleSection = fieldData.stringValue;
                newScheduleObj.set("section", scheduleSection);
              }
              if (scheduleObj.get(fieldData, "sectionId")) {
                scheduleSectionId = fieldData.stringValue;
                newScheduleObj.set("sectionId", scheduleSectionId);
              }
              if (scheduleObj.get(fieldData, "instructorName")) {
                scheduleInstructor = fieldData.stringValue;
                newScheduleObj.set("instructorName", scheduleInstructor);
              }
              
              // Add to all schedules array
              allSchedulesArray.add(newScheduleObj);
              
              // Check if this is the matching schedule for current time
              if (!foundMatch && scheduleDay == currentDay && isTimeInRange(currentTime, scheduleStartTime, scheduleEndTime)) {
                // Found matching schedule
                foundMatch = true;
                subjectCode = scheduleSubjectCode;
                roomName = scheduleRoom;
                sectionName = scheduleSection;
                sectionId = scheduleSectionId;
                instructorName = scheduleInstructor;
                subject = scheduleSubject;
                scheduleDay = scheduleDay;
                startTime = scheduleStartTime;
                endTime = scheduleEndTime;
                
                // Create matched schedule JSON
                matchedSchedule.set("day", scheduleDay);
                matchedSchedule.set("startTime", startTime);
                matchedSchedule.set("endTime", endTime);
                matchedSchedule.set("roomName", roomName);
                matchedSchedule.set("subjectCode", subjectCode);
                matchedSchedule.set("subject", subject);
                matchedSchedule.set("section", sectionName);
                matchedSchedule.set("sectionId", sectionId);
                matchedSchedule.set("instructorName", instructorName);
              }
            }
          }
          if (i % 5 == 0) yield(); // Prevent watchdog reset during loop (every 5 iterations)
        }
      }
    }
    
    yield(); // Prevent watchdog reset before Firebase write
    
    // Create sessionId using room, subject, section
    String sessionId = timestamp.substring(0, 10) + "_" + subjectCode + "_" + sectionName + "_" + roomName;
    
    // Create personal info JSON
    FirebaseJson personalInfo;
    personalInfo.set("fullName", studentName);
    personalInfo.set("email", email);
    personalInfo.set("idNumber", idNumber);
    personalInfo.set("mobileNumber", mobileNumber);
    personalInfo.set("role", role);
    personalInfo.set("department", department);
    
    // Create attendance info JSON
    FirebaseJson attendanceInfo;
    attendanceInfo.set("sessionId", sessionId);
    attendanceInfo.set("timestamp", timestamp);
    attendanceInfo.set("date", timestamp.substring(0, 10));
    attendanceInfo.set("timeIn", timestamp);
    attendanceInfo.set("timeOut", timeOut);
    attendanceInfo.set("status", finalStatus);
    attendanceInfo.set("action", action);
    attendanceInfo.set("sensor", sensorStr);
    attendanceInfo.set("assignedSensorId", sensorIndex >= 0 ? sensorIndex : -1);
    attendanceInfo.set("weight", sensorWeight);
    attendanceInfo.set("weightUnit", "kg");
    attendanceInfo.set("sensorConfirmed", sensorConfirmed);
    
    // Create main JSON structure
    FirebaseJson json;
    json.set("personalInfo", personalInfo);
    json.set("attendanceInfo", attendanceInfo);
    json.set("scheduleMatched", matchedSchedule);
    json.set("allSchedules", allSchedulesArray);

    if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
      Serial.println("Student " + rfidUid + " logged to Firebase: " + finalStatus);
      
      // Also store the UID directly under the Student node instead of RegisteredUIDs
      if (!Firebase.RTDB.setString(&fbdo, "/Students/" + rfidUid + "/lastSession", currentSessionId)) {
        Serial.println("Failed to update Student node with session ID: " + fbdo.errorReason());
      }
    } else {
      Serial.println("Firebase error: " + fbdo.errorReason());
      storeLogToSD("Student:FirebaseError UID:" + rfidUid + " Error:" + fbdo.errorReason());
    }

    // We no longer update RegisteredUIDs node for student attendance
    // The line below is commented out or removed
    // if (!Firebase.RTDB.setString(&fbdo, "/RegisteredUIDs/" + rfidUid, timestamp)) {
    //  Serial.println("Failed to update RegisteredUIDs: " + fbdo.errorReason());
    // }
  } else {
    Serial.println("Firebase unavailable. SD logged for " + rfidUid);
  }

  firstActionOccurred = true;
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

// Helper functions (add these to your code)
String getDayFromTimestamp(String timestamp) {
  // Convert "2025_04_11_220519" to day of week
  int year = timestamp.substring(0, 4).toInt();
  int month = timestamp.substring(5, 7).toInt();
  int day = timestamp.substring(8, 10).toInt();
  // Simple Zeller's Congruence for day of week
  if (month < 3) {
    month += 12;
    year--;
  }
  int k = day;
  int m = month;
  int D = year % 100;
  int C = year / 100;
  int f = k + ((13 * (m + 1)) / 5) + D + (D / 4) + (C / 4) - (2 * C);
  int dayOfWeek = f % 7;
  if (dayOfWeek < 0) dayOfWeek += 7;

  const char* days[] = {"Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
  return String(days[dayOfWeek]);
}

bool isTimeInRange(String currentTime, String startTime, String endTime) {
  // Convert times to minutes for comparison (e.g., "22:05" -> 1325)
  int currentMins = currentTime.substring(0, 2).toInt() * 60 + currentTime.substring(3, 5).toInt();
  int startMins = startTime.substring(0, 2).toInt() * 60 + startTime.substring(3, 5).toInt();
  int endMins = endTime.substring(0, 2).toInt() * 60 + endTime.substring(3, 5).toInt();
  return currentMins >= startMins && currentMins <= endMins;
}


void logUnregisteredUID(String uid, String timestamp) {
  Serial.println("Updating unregistered UID: " + uid);
  
  // First check if the UID is actually registered but wasn't found on first check
  // by trying a direct fetch from Firestore
  if (!sdMode && isConnected && Firebase.ready()) {
    // Try to check Firestore students collection
    Serial.println("Directly checking Firestore for UID " + uid);
    String firestorePath = "students";
    if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", firestorePath.c_str(), "")) {
      FirebaseJson json;
      json.setJsonData(firestoreFbdo.payload());
      FirebaseJsonData jsonData;
      if (json.get(jsonData, "documents")) {
        FirebaseJsonArray arr;
        jsonData.getArray(arr);
        for (size_t i = 0; i < arr.size(); i++) {
          FirebaseJsonData docData;
          arr.get(docData, i);
          FirebaseJson doc;
          doc.setJsonData(docData.to<String>());
          String rfidUid = "";
          FirebaseJsonData fieldData;
          if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
            rfidUid = fieldData.stringValue;
            if (rfidUid == uid) {
              // Found it! Now cache the student data for future use
              Serial.println("Found student with UID " + uid + " in Firestore. Adding to cache.");
              
              std::map<String, String> studentData;
              if (doc.get(fieldData, "fields/fullName/stringValue")) {
                studentData["fullName"] = fieldData.stringValue;
              } else {
                studentData["fullName"] = "Unknown";
              }
              
              if (doc.get(fieldData, "fields/email/stringValue")) {
                studentData["email"] = fieldData.stringValue;
              }
              
              if (doc.get(fieldData, "fields/role/stringValue")) {
                studentData["role"] = fieldData.stringValue;
              } else {
                studentData["role"] = "student";
              }
              
              firestoreStudents[uid] = studentData;
              
              // Force a full data fetch to get complete student information
              fetchFirestoreStudents();
              return; // Exit without logging as unregistered since it's actually registered
            }
          }
        }
      }
    }
    
    // If we reach here, the UID is not in Firestore, so log it as unregistered
    if (Firebase.RTDB.setString(&fbdo, "Unregistered/" + uid + "/Time", timestamp)) {
      Serial.println("Unregistered UID logged to Firebase RTDB: Unregistered:" + uid + " Time:" + timestamp);
    } else {
      Serial.println("Failed to log unregistered UID to RTDB: " + fbdo.errorReason());
      String entry = "Unregistered:UID:" + uid + " Time:" + timestamp;
      storeLogToSD(entry);
    }
  } else {
    // Offline mode - log to SD
    String entry = "Unregistered:UID:" + uid + " Time:" + timestamp;
    storeLogToSD(entry);
  }
}

void logAdminAccess(String uid, String timestamp) {
  // Heap check to prevent crashes
  uint32_t freeHeap = ESP.getFreeHeap();
  if (freeHeap < 15000) {
    Serial.println("Warning: Low heap (" + String(freeHeap) + " bytes). Skipping Firebase operations.");
    storeLogToSD("LowHeapWarning:UID:" + uid + " Time:" + timestamp);
    deniedFeedback();
    displayMessage("System Busy", "Try Again", 2000);
    return;
  }

  // SD log entry (basic)
  String entry = "Admin:UID:" + uid + " Time:" + timestamp;

  // Validate admin UID
  if (!isAdminUID(uid)) {
    entry += " Action:Denied_NotAdmin";
    storeLogToSD(entry);
    deniedFeedback();
    displayMessage("Not Admin", "Access Denied", 2000);
    return;
  }

  // Fetch user details
  std::map<String, String> userData = fetchUserDetails(uid);
  String fullName = userData.empty() ? "Unknown" : userData["fullName"];
  String role = userData.empty() ? "admin" : userData["role"];

  // Sanitize timestamp for Firebase paths
  String sanitizedTimestamp = timestamp;
  sanitizedTimestamp.replace(" ", "_");
  sanitizedTimestamp.replace(":", "");
  sanitizedTimestamp.replace("/", "_");

  // Determine action
  bool isEntry = !adminAccessActive;
  String action = isEntry ? "entry" : "exit";

  // Assign room before creating the AccessLogs entry
  if (isEntry) {
    assignedRoomId = assignRoomToAdmin(uid);
  }

  // Log PZEM data on exit for SD
  if (!isEntry) {
    float voltage = max(pzem.voltage(), 0.0f);
    float current = max(pzem.current(), 0.0f);
    float power = max(pzem.power(), 0.0f);
    float energy = max(pzem.energy(), 0.0f);
    float frequency = max(pzem.frequency(), 0.0f);
    float powerFactor = max(pzem.pf(), 0.0f);
    entry += " Action:Exit Voltage:" + String(voltage, 2) + "V Current:" + String(current, 2) + "A Power:" + String(power, 2) +
             "W Energy:" + String(energy, 3) + "kWh Frequency:" + String(frequency, 2) + "Hz PowerFactor:" + String(powerFactor, 2);
  } else {
    entry += " Action:Entry";
  }
  storeLogToSD(entry);

  // Firebase logging (/AccessLogs and /AdminPZEM)
  if (!sdMode && isConnected && Firebase.ready()) {
    // /AccessLogs
    String accessPath = "/AccessLogs/" + uid + "/" + sanitizedTimestamp;
    FirebaseJson accessJson;
    accessJson.set("action", action);
    accessJson.set("timestamp", timestamp);
    accessJson.set("fullName", fullName);
    accessJson.set("role", role);

    // For entry, add room details to AccessLogs
    if (isEntry) {
      // Using assignedRoomId set before Firebase operations
      if (assignedRoomId != "" && firestoreRooms.find(assignedRoomId) != firestoreRooms.end()) {
        const auto& roomData = firestoreRooms[assignedRoomId];
        FirebaseJson roomDetails;
        roomDetails.set("building", roomData.count("building") ? roomData.at("building") : "Unknown");
        roomDetails.set("floor", roomData.count("floor") ? roomData.at("floor") : "Unknown");
        roomDetails.set("name", roomData.count("name") ? roomData.at("name") : "Unknown");
        roomDetails.set("status", "maintenance");  // Always set to maintenance for admin inspections
        roomDetails.set("type", roomData.count("type") ? roomData.at("type") : "Unknown");
        accessJson.set("roomDetails", roomDetails);
      }
    }

    // For exit, add PZEM data to AccessLogs
    if (!isEntry && isVoltageSufficient) {
      // Get the entry timestamp to find the entry record
      String entryTimestamp = "";
      if (Firebase.RTDB.getJSON(&fbdo, "/AccessLogs/" + uid)) {
        FirebaseJson json;
        json.setJsonData(fbdo.to<FirebaseJson>().raw());
        
        // Find the most recent "entry" action using Firebase iterators correctly
        size_t count = json.iteratorBegin();
        String latestEntryKey = "";
        
        for (size_t i = 0; i < count; i++) {
          int type = 0;
          String key, value;
          json.iteratorGet(i, type, key, value);
          
          if (type == FirebaseJson::JSON_OBJECT) {
            // This is an entry, check if it has 'action' = 'entry'
            FirebaseJson entryJson;
            FirebaseJsonData actionData;
            
            // Create a new JSON with just this item and check it
            String jsonStr = "{\"" + key + "\":" + value + "}";
            FirebaseJson keyJson;
            keyJson.setJsonData(jsonStr);
            
            // Get action from this entry
            if (keyJson.get(actionData, key + "/action") && 
                actionData.stringValue == "entry") {
              // Found an entry action, check if it's newer
              if (latestEntryKey == "" || key.compareTo(latestEntryKey) > 0) {
                latestEntryKey = key;
              }
            }
          }
        }
        
        json.iteratorEnd();
        
        if (latestEntryKey != "") {
          entryTimestamp = latestEntryKey;
          Serial.println("Found latest entry record timestamp: " + entryTimestamp);
          
          // Update room status back to "available" when admin exits
          FirebaseJson statusUpdate;
          statusUpdate.set("status", "available");
          
          if (Firebase.RTDB.updateNode(&fbdo, "/AccessLogs/" + uid + "/" + entryTimestamp + "/roomDetails", &statusUpdate)) {
            Serial.println("Room status updated to 'available' in entry record: " + entryTimestamp);
          } else {
            Serial.println("Failed to update room status: " + fbdo.errorReason());
          }
        }
      }
      
      // No need to update the roomDetails/exit data since we have a separate exit record
      // We'll only keep the PZEM data in the separate exit record
      
      // Add PZEM data to the current exit record
      FirebaseJson pzemData;
      pzemData.set("voltage", lastVoltage);
      pzemData.set("current", lastCurrent);
      pzemData.set("power", lastPower);
      pzemData.set("energy", lastEnergy);
      pzemData.set("frequency", lastFrequency);
      pzemData.set("powerFactor", lastPowerFactor);
      accessJson.set("pzemData", pzemData);
    }

    Serial.print("Pushing to RTDB: " + accessPath + "... ");
    if (Firebase.RTDB.setJSON(&fbdo, accessPath, &accessJson)) {
      Serial.println("Success");
      Serial.println("Admin " + fullName + " access logged: " + action);
    } else {
      Serial.println("Failed: " + fbdo.errorReason());
      storeLogToSD("AccessLogFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }

    // We no longer log to AdminPZEM, using AccessLogs instead
    yield();

    // Update /Admin/<uid>
    if (!userData.empty()) {
      String adminPath = "/Admin/" + uid;
      FirebaseJson adminJson;
      adminJson.set("fullName", userData["fullName"]);
      adminJson.set("role", userData["role"]);
      adminJson.set("createdAt", userData.count("createdAt") ? userData["createdAt"] : "2025-01-01T00:00:00.000Z");
      adminJson.set("email", userData.count("email") ? userData["email"] : "unknown@gmail.com");
      adminJson.set("idNumber", userData.count("idNumber") ? userData["idNumber"] : "N/A");
      adminJson.set("rfidUid", uid);
      // Only update lastTamperStop if previously set (avoid overwriting tamper resolution)
      if (userData.count("lastTamperStop")) {
        adminJson.set("lastTamperStop", userData["lastTamperStop"]);
      }

      Serial.print("Updating RTDB: " + adminPath + "... ");
      if (Firebase.RTDB.setJSON(&fbdo, adminPath, &adminJson)) {
        Serial.println("Success");
        Serial.println("Admin details updated in RTDB at " + adminPath);
      } else {
        Serial.println("Failed: " + fbdo.errorReason());
        storeLogToSD("AdminUpdateFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
      }
      yield();
    }
  }

  // Handle entry
  if (isEntry) {
    activateRelays();
    adminAccessActive = true;
    lastAdminUID = uid;
    // Room already assigned above
    if (assignedRoomId == "") {
      displayMessage("No Room Available", "For Inspection", 2000);
    } else {
      if (firestoreRooms.find(assignedRoomId) != firestoreRooms.end()) {
        String roomName = firestoreRooms[assignedRoomId].at("name");
        displayMessage("Inspecting Room", roomName, 2000);
      }
    }
    accessFeedback();
    logSystemEvent("Relay Activated for Admin UID: " + uid);
    Serial.println("Admin access granted for UID: " + uid);
    displayMessage("Admin Access", "Granted", 2000);
    displayMessage("Admin Mode", "Active", 0);

  // Handle exit
  } else if (uid == lastAdminUID) {
    deactivateRelays();
    adminAccessActive = false;
    lastAdminUID = "";
    lastPZEMLogTime = 0;
    
    // Also update room status in Firestore if we have a room assigned
    if (assignedRoomId != "" && !sdMode && isConnected && Firebase.ready()) {
      // Update the room status in Firestore back to "available"
      String roomPath = "rooms/" + assignedRoomId;
      FirebaseJson contentJson;
      contentJson.set("fields/status/stringValue", "available");
      
      if (Firebase.Firestore.patchDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", roomPath.c_str(), contentJson.raw(), "status")) {
        Serial.println("Room status updated to 'available' in Firestore: " + assignedRoomId);
      } else {
        Serial.println("Failed to update room status in Firestore: " + firestoreFbdo.errorReason());
      }
    }
    
    assignedRoomId = "";
    accessFeedback();
    logSystemEvent("Relay Deactivated for Admin UID: " + uid);
    Serial.println("Admin access ended for UID: " + uid);
    displayMessage("Admin Access", "Ended", 2000);
    displayMessage("Door Locked", "", 2000);
    displayMessage("Ready. Tap your", "RFID Card!", 0);

  // Handle different UID
  } else {
    entry = "Admin:UID:" + uid + " Time:" + timestamp + " Action:Denied_DifferentUID";
    storeLogToSD(entry);
    deniedFeedback();
    Serial.println("Different admin UID detected: " + uid);
    displayMessage("Session Active", "Use Same UID", 2000);
    displayMessage("Admin Mode", "Active", 0);
  }

  // Update timers
  firstActionOccurred = true;
  lastActivityTime = millis();
  lastReadyPrint = millis();

  // Log heap after operations
  Serial.println("Heap after logAdminAccess: " + String(ESP.getFreeHeap()) + " bytes");
}

void logAdminTamperStop(String uid, String timestamp) {
  String entry = "Admin:" + uid + " TamperStopped:" + timestamp;
  storeLogToSD(entry);

  // Update tamper event in Alerts/Tamper node
  if (!sdMode && isConnected && Firebase.ready()) {
    // Use currentTamperAlertId if available, fallback to tamperStartTime
    String alertId = currentTamperAlertId.length() > 0 ? currentTamperAlertId : tamperStartTime;
    String tamperPath = "/Alerts/Tamper/" + alertId;
    
    // Fetch user details for resolvedByFullName
    std::map<String, String> userData = fetchUserDetails(uid);
    String fullName = userData.empty() ? "Unknown Admin" : userData["fullName"];
    String role = userData.empty() ? "admin" : userData["role"];
    
    FirebaseJson tamperJson;
    tamperJson.set("endTime", timestamp);
    tamperJson.set("status", "resolved");
    tamperJson.set("resolvedBy", uid);
    tamperJson.set("resolverName", fullName);
    tamperJson.set("resolverRole", role);
    tamperJson.set("resolutionTime", timestamp);

    Serial.print("Logging tamper resolution: " + tamperPath + "... ");
    if (Firebase.RTDB.updateNode(&fbdo, tamperPath, &tamperJson)) {
      Serial.println("Success");
      Serial.println("Tamper event resolved at " + tamperPath + " by UID " + uid);
    } else {
      Serial.println("Failed: " + fbdo.errorReason());
      storeLogToSD("TamperStopFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
    }

    // Update /Admin/<uid> with original fields and tamper resolution info
    if (!userData.empty()) {
      String adminPath = "/Admin/" + uid;
      FirebaseJson adminJson;
      adminJson.set("fullName", userData["fullName"]);
      adminJson.set("role", userData["role"]);
      adminJson.set("lastTamperStop", timestamp);
      adminJson.set("lastTamperAlertId", alertId);
      // Restore original fields
      adminJson.set("email", userData["email"].length() > 0 ? userData["email"] : "unknown@gmail.com");
      adminJson.set("idNumber", userData["idNumber"].length() > 0 ? userData["idNumber"] : "N/A");
      adminJson.set("createdAt", userData["createdAt"].length() > 0 ? userData["createdAt"] : "2025-01-01T00:00:00.000Z");
      adminJson.set("rfidUid", uid);

      Serial.print("Updating RTDB: " + adminPath + "... ");
      if (Firebase.RTDB.updateNode(&fbdo, adminPath, &adminJson)) {
        Serial.println("Success");
        Serial.println("Admin node updated for tamper resolution at " + adminPath);
      } else {
        Serial.println("Failed: " + fbdo.errorReason());
        storeLogToSD("AdminUpdateFailed:UID:" + uid + " Time:" + timestamp + " Error:" + fbdo.errorReason());
      }
    } else {
      Serial.println("No Firestore data for UID " + uid + "; logging minimal /Admin update.");
      String adminPath = "/Admin/" + uid;
      FirebaseJson adminJson;
      adminJson.set("fullName", "Unknown Admin");
      adminJson.set("role", "admin");
      adminJson.set("lastTamperStop", timestamp);
      adminJson.set("lastTamperAlertId", alertId);
      adminJson.set("email", "unknown@gmail.com");
      adminJson.set("idNumber", "N/A");
      adminJson.set("createdAt", "2025-01-01T00:00:00.000Z");
      adminJson.set("rfidUid", uid);

      if (Firebase.RTDB.updateNode(&fbdo, adminPath, &adminJson)) {
        Serial.println("Minimal admin node updated at " + adminPath);
      } else {
        Serial.println("Minimal admin update failed: " + fbdo.errorReason());
      }
    }
  } else {
    Serial.println("Firebase unavailable; tamper stop logged to SD.");
    std::map<String, String> userData = fetchUserDetails(uid);
    String fullName = userData.empty() ? "Unknown Admin" : userData["fullName"];
    String detailedEntry = "Admin:" + uid + " TamperStopped:" + timestamp + 
                          " ResolvedByUID:" + uid + " ResolvedByFullName:" + fullName;
    storeLogToSD(detailedEntry);
  }

  firstActionOccurred = true;
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void logSystemEvent(String event) {
  String timestamp = getFormattedTime();
  String entry = "System:" + event + " Time:" + timestamp;
  storeLogToSD(entry);
  if (!sdMode && isConnected && isVoltageSufficient) {
    Firebase.RTDB.pushString(&fbdo, "/SystemLogs", entry);
  }
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void watchdogCheck() {
  if ((millis() - lastReadyPrint > 300000) && !adminAccessActive && !tamperActive) {
    Serial.println("Watchdog timeout. Restarting system.");
    logSystemEvent("Watchdog Reset");
    ESP.restart();
  }
}

bool checkResetButton() {
  static unsigned long pressStart = 0;
  static int lastButtonState = HIGH;
  static unsigned long lastDebounceTime = 0;
  const unsigned long debounceDelay = 50;    // 50ms debounce
  const unsigned long pressDuration = 200;   // 200ms to confirm press

  int currentButtonState = digitalRead(RESET_BUTTON_PIN);

  // Debug: Log state changes
  if (currentButtonState != lastButtonState) {
    Serial.print("Reset button state changed to: ");
    Serial.println(currentButtonState == LOW ? "LOW (pressed)" : "HIGH (released)");
    lastDebounceTime = millis();
  }

  // Debounce: Update state only if stable for debounceDelay
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (currentButtonState == LOW && lastButtonState == HIGH) {
      // Button just pressed
      pressStart = millis();
      Serial.println("Reset button press detected, starting timer...");
      // Immediate feedback
      tone(BUZZER_PIN, 2000, 100);
      digitalWrite(LED_R_PIN, HIGH);
      delay(50); // Brief feedback
      digitalWrite(LED_R_PIN, LOW);
    } else if (currentButtonState == HIGH && lastButtonState == LOW) {
      // Button released
      pressStart = 0;
      Serial.println("Reset button released.");
    }
    lastButtonState = currentButtonState;
  }

  // Check for confirmed press
  if (currentButtonState == LOW && pressStart != 0 && (millis() - pressStart >= pressDuration)) {
    Serial.println("Reset confirmed after 200ms. Initiating restart...");
    // Log to SD if initialized
    if (sdInitialized) {
      String timestamp = getFormattedTime();
      String entry = "System:ResetButton Timestamp:" + timestamp + " Action:UserReset";
      storeLogToSD(entry);
      Serial.println("Reset logged to SD: " + entry);
    }
    // Final feedback
    tone(BUZZER_PIN, 1000, 200);
    digitalWrite(LED_R_PIN, HIGH);
    digitalWrite(LED_G_PIN, HIGH);
    digitalWrite(LED_B_PIN, HIGH);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Resetting...");
    delay(300); // Reduced from 500ms to ensure quick restart
    digitalWrite(LED_R_PIN, LOW);
    digitalWrite(LED_G_PIN, LOW);
    digitalWrite(LED_B_PIN, LOW);
    ESP.restart();
    return true; // Won't be reached
  }

  return false;
}

// Global variables for display state
unsigned long displayStartTime = 0;
String currentLine1 = "";
String currentLine2 = "";
unsigned long displayDuration = 0;
bool displayingMessage = false;

void displayMessage(String line1, String line2, unsigned long duration = 3000) {
  if (ESP.getFreeHeap() < 5000) {
    Serial.println("Low heap memory: " + String(ESP.getFreeHeap()));
    recoverI2C();
    return;
  }

  int retryCount = 0;
  const int maxRetries = 3;
  while (retryCount < maxRetries) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(line2.substring(0, 16));

    Wire.beginTransmission(0x27);
    if (Wire.endTransmission() == 0) break;
    Serial.println("I2C communication failed, retrying... Attempt " + String(retryCount + 1));
    recoverI2C();
    delay(10); // Short blocking delay, safe for I2C recovery
    yield();
    retryCount++;
  }
  if (retryCount >= maxRetries) {
    Serial.println("I2C recovery failed after " + String(maxRetries) + " attempts!");
    lcd.noBacklight();
  } else {
    lcd.backlight();
  }

  // Set state for non-blocking display
  currentLine1 = line1.substring(0, 16);
  currentLine2 = line2.substring(0, 16);
  displayStartTime = millis();
  displayDuration = duration;
  displayingMessage = (duration > 0);

  lastActivityTime = millis();
  lastReadyPrint = millis();
}

void updateDisplay() {
  if (displayingMessage && millis() - displayStartTime >= displayDuration) {
    displayingMessage = false;
    // Optionally clear or update LCD here if needed
    // lcd.clear();
    // lcd.setCursor(0, 0);
    // lcd.print("Ready. Tap your");
    // lcd.setCursor(0, 1);
    // lcd.print("RFID Card!");
  }
}

void recoverI2C() {
  Serial.println("I2C bus error detected. Attempting recovery...");

  // Reset I2C pins
  pinMode(I2C_SDA, OUTPUT);
  pinMode(I2C_SCL, OUTPUT);
  digitalWrite(I2C_SDA, HIGH);
  digitalWrite(I2C_SCL, HIGH);
  delay(10);

  // Generate clock pulses to clear stuck SDA (up to 9 pulses)
  for (int i = 0; i < 9; i++) {
    digitalWrite(I2C_SCL, LOW);
    delayMicroseconds(10);
    digitalWrite(I2C_SCL, HIGH);
    delayMicroseconds(10);
  }

  // Send a STOP condition
  digitalWrite(I2C_SDA, LOW);
  delayMicroseconds(10);
  digitalWrite(I2C_SCL, HIGH);
  delayMicroseconds(10);
  digitalWrite(I2C_SDA, HIGH);
  delayMicroseconds(10);

  // Reinitialize I2C
  Wire.end(); // Fully stop the I2C driver
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000); // Set to 100kHz (standard speed, adjust if needed)
  
  // Test the bus again
  Wire.beginTransmission(0x27);
  int error = Wire.endTransmission();
  if (error == 0) {
    Serial.println("I2C bus recovered successfully.");
    lcd.begin(16, 2); // Reinitialize LCD
    lcd.backlight();
  } else {
    Serial.println("I2C recovery failed. Error code: " + String(error));
  }

  lastI2cRecovery = millis();
}

void streamCallback(FirebaseStream data) {
  if (data.dataPath() == "/door" && !adminAccessActive) {
    String value = data.stringData();
    if (value == "unlock") {
      activateRelays();
      relayActiveTime = millis();
      relayActive = true;
      studentVerificationActive = true;
      studentVerificationStartTime = millis();
      Serial.println("Door unlocked via RTDB!");
      displayMessage("Remote Unlock", "", 2000);
      logSystemEvent("Remote Door Unlock");
      firstActionOccurred = true;
      lastActivityTime = millis();
      lastReadyPrint = millis();
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) Serial.println("RTDB Stream timed out, resuming...");
  if (!streamFbdo.httpConnected()) Serial.println("RTDB Stream error: " + streamFbdo.errorReason());
  lastActivityTime = millis();
  lastReadyPrint = millis();
}

// Power-Saving Mode Functions
void enterPowerSavingMode() {
  Serial.println("Entering power-saving mode...");
  displayMessage("Power Saving", "Mode", 1000);
  
  // Turn off LCD
  lcd.clear();
  lcd.noBacklight();
  
  // Turn off LEDs
  digitalWrite(LED_R_PIN, LOW);
  digitalWrite(LED_G_PIN, LOW);
  digitalWrite(LED_B_PIN, LOW);
  
  // Ensure buzzer is off
  noTone(BUZZER_PIN);
  
  // Disable WiFi to save power
  WiFi.disconnect();
  isConnected = false;
  
  powerSavingMode = true;
  Serial.println("Power-saving mode active. Tap a registered RFID card to wake up.");
}

void exitPowerSavingMode() {
  Serial.println("Exiting power-saving mode...");
  
  // Re-enable LCD
  lcd.backlight();
  displayMessage("Waking Up", "", 1000);
  displayMessage("Ready. Tap your", "RFID Card!", 0);
  
  // Reconnect to WiFi
  WiFi.reconnect();
  unsigned long wifiStartTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStartTime < 10000) {
    delay(100);
  }
  isConnected = (WiFi.status() == WL_CONNECTED);
  if (isConnected) {
    Serial.println("WiFi reconnected.");
    initFirebase();
    fetchRegisteredUIDs();
    fetchFirestoreTeachers();
    fetchFirestoreStudents();
    fetchFirestoreRooms();
  } else {
    Serial.println("Failed to reconnect to WiFi.");
    sdMode = true;
  }
  
  // Reset LEDs to neutral state
  showNeutral();
  
  powerSavingMode = false;
  lastActivityTime = millis();
  lastReadyPrint = millis();
  readyMessageShown = true;
  Serial.println("System resumed normal operation.");
}

// Fetch Firestore users collection
void fetchFirestoreUsers() {
  if (!Firebase.ready()) return;

  if (Firebase.Firestore.getDocument(&fbdo, "smartecolock", "", "users", "")) {
    FirebaseJson usersJson;
    usersJson.setJsonData(fbdo.payload().c_str());
    FirebaseJsonData jsonData;

    if (usersJson.get(jsonData, "documents") && jsonData.type == "array") {
      FirebaseJsonArray arr;
      jsonData.getArray(arr);
      firestoreUsers.clear();

      for (size_t i = 0; i < arr.size(); i++) {
        FirebaseJsonData docData;
        arr.get(docData, i); // Get each document as a JSON object
        FirebaseJson doc;
        doc.setJsonData(docData.stringValue);

        // Extract UID from document name (e.g., "users/<uid>")
        String docName;
        doc.get(docData, "name");
        docName = docData.stringValue;
        String uid = docName.substring(docName.lastIndexOf("/") + 1);

        // Extract fields
        FirebaseJson fields;
        doc.get(docData, "fields");
        fields.setJsonData(docData.stringValue);

        std::map<String, String> userData;
        FirebaseJsonData fieldData;

        // Get fullName
        if (fields.get(fieldData, "fullName/stringValue")) {
          userData["fullName"] = fieldData.stringValue;
        } else {
          userData["fullName"] = "Unknown";
        }

        // Get role
        if (fields.get(fieldData, "role/stringValue")) {
          userData["role"] = fieldData.stringValue;
        } else {
          userData["role"] = "Unknown";
        }

        firestoreUsers[uid] = userData;
      }
      Serial.println("Firestore users collection fetched successfully. Entries: " + String(firestoreUsers.size()));
    } else {
      Serial.println("No documents found in users collection.");
    }
  } else {
    Serial.println("Failed to fetch Firestore users: " + fbdo.errorReason());
  }
}

void checkAndSyncSDData() {
  if (!isConnected) {
    Serial.println("Cannot sync SD data: No WiFi connection.");
    return;
  }

  if (!SD.begin(SD_CS, fsSPI, 4000000)) {
    Serial.println("SD card initialization failed. Cannot sync data.");
    return;
  }

  File logFile = SD.open(OFFLINE_LOG_FILE, FILE_READ);
  if (!logFile) {
    Serial.println("No " + String(OFFLINE_LOG_FILE) + " found on SD card. Skipping sync.");
    SD.end();
    return;
  }

  // Check if the file has data
  if (logFile.size() == 0) {
    Serial.println("SD log file is empty. Skipping sync.");
    logFile.close();
    SD.end();
    return;
  }

  // Sync the data to Firebase
  if (syncOfflineLogsToRTDB()) {
    displayMessage("Data Pushed to", "Database", 2000);
    Serial.println("Offline data successfully pushed to Firebase.");

    // Delete the SD card file after successful sync
    logFile.close();
    SD.remove(OFFLINE_LOG_FILE);
    Serial.println("SD log file deleted after successful sync.");
  } else {
    Serial.println("Failed to sync offline data to Firebase. Retaining SD log file.");
  }

  SD.end();
}


// Synchronize SD logs to Realtime Database and append Firestore data
bool syncOfflineLogsToRTDB() {
  if (!isConnected) {
    Serial.println("Sync failed: No WiFi connection.");
    return false;
  }

  // Check Firebase readiness
  if (!Firebase.ready()) {
    Serial.println("Firebase not ready. Attempting to reinitialize...");
    Firebase.reconnectWiFi(true);
    initFirebase(); // Ensure this function is defined to initialize Firebase
    nonBlockingDelay(1000);
    if (!Firebase.ready()) {
      Serial.println("Firebase still not ready. Sync failed.");
      return false;
    }
  }

  if (!SD.begin(SD_CS, fsSPI, 4000000)) {
    Serial.println("Sync failed: SD card not initialized.");
    return false;
  }

  File logFile = SD.open(OFFLINE_LOG_FILE, FILE_READ);
  if (!logFile) {
    Serial.println("No " + String(OFFLINE_LOG_FILE) + " found on SD card. Nothing to sync.");
    SD.end();
    return true;
  }

  bool syncSuccess = true;
  while (logFile.available()) {
    String logEntry = logFile.readStringUntil('\n');
    logEntry.trim();
    if (logEntry.length() == 0) continue;

    Serial.println("Parsing log entry: " + logEntry);

    // Skip SuperAdminPZEMInitial entries (they should only be on SD card)
    if (logEntry.startsWith("SuperAdminPZEMInitial:")) {
      Serial.println("Skipping SuperAdminPZEMInitial log entry (SD only): " + logEntry);
      continue;
    }

    // Check if this is a TurnedOffRoom log with final PZEM readings
    if (logEntry.startsWith("UID:") && logEntry.indexOf("Action:TurnedOffRoom") != -1) {
      int uidIndex = logEntry.indexOf("UID:") + 4;
      int timestampIndex = logEntry.indexOf("Timestamp:");
      int actionIndex = logEntry.indexOf("Action:");
      int voltageIndex = logEntry.indexOf("Voltage:");
      int currentIndex = logEntry.indexOf("Current:");
      int powerIndex = logEntry.indexOf("Power:");
      int energyIndex = logEntry.indexOf("Energy:");
      int frequencyIndex = logEntry.indexOf("Frequency:");
      int pfIndex = logEntry.indexOf("PowerFactor:");
      int totalConsumptionIndex = logEntry.indexOf("TotalConsumption:");

      if (uidIndex == -1 || timestampIndex == -1 || actionIndex == -1 ||
          voltageIndex == -1 || currentIndex == -1 || powerIndex == -1 ||
          energyIndex == -1 || frequencyIndex == -1 || pfIndex == -1 || totalConsumptionIndex == -1) {
        Serial.println("Invalid TurnedOffRoom log entry format: " + logEntry);
        continue;
      }

      String uid = logEntry.substring(uidIndex, timestampIndex - 1);
      String timestamp = logEntry.substring(timestampIndex + 10, actionIndex - 1);
      if (timestamp == "N/A") {
        timestamp = "1970-01-01 00:00:00";
        Serial.println("Timestamp is N/A. Using placeholder: " + timestamp);
      }
      String voltageStr = logEntry.substring(voltageIndex + 8, logEntry.indexOf("V", voltageIndex));
      String currentStr = logEntry.substring(currentIndex + 8, logEntry.indexOf("A", currentIndex));
      String powerStr = logEntry.substring(powerIndex + 6, logEntry.indexOf("W", powerIndex));
      String energyStr = logEntry.substring(energyIndex + 7, logEntry.indexOf("kWh", energyIndex));
      String frequencyStr = logEntry.substring(frequencyIndex + 10, logEntry.indexOf("Hz", frequencyIndex));
      String pfStr = logEntry.substring(pfIndex + 12, totalConsumptionIndex - 1);
      String totalConsumptionStr = logEntry.substring(totalConsumptionIndex + 16, logEntry.indexOf("kWh", totalConsumptionIndex));

      float voltage = voltageStr.toFloat();
      float current = currentStr.toFloat();
      float power = powerStr.toFloat();
      float energy = energyStr.toFloat();
      float frequency = frequencyStr.toFloat();
      float powerFactor = pfStr.toFloat();
      float totalConsumption = totalConsumptionStr.toFloat();

      // Validate data to prevent NaN or invalid values
      if (isnan(voltage) || voltage < 0) voltage = 0.0;
      if (isnan(current) || current < 0) current = 0.0;
      if (isnan(power) || power < 0) power = 0.0;
      if (isnan(energy) || energy < 0) energy = 0.0;
      if (isnan(frequency) || frequency < 0) frequency = 0.0;
      if (isnan(powerFactor) || powerFactor < 0) powerFactor = 0.0;
      if (isnan(totalConsumption) || totalConsumption < 0) totalConsumption = 0.0;

      FirebaseJson json;
      json.set("uid", uid);
      json.set("timestamp", timestamp);
      json.set("action", "TurnedOffRoom");
      json.set("name", "CIT-U");
      json.set("role", "Super Admin");
      json.set("department", "Computer Engineering");
      json.set("building", "GLE");
      json.set("voltage", voltage);
      json.set("current", current);
      json.set("power", power);
      json.set("energy", energy);
      json.set("frequency", frequency);
      json.set("powerFactor", powerFactor);
      json.set("totalConsumption", String(totalConsumption, 3));
      json.set("powerConsumptionNote", totalConsumption < 0.001 ? "Insufficient Consumption" : "Normal");

      String safeTimestamp = timestamp;
      safeTimestamp.replace(" ", "_");
      String path = "/OfflineDataLogging/" + uid + "_" + safeTimestamp;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Synced TurnedOffRoom log with final PZEM readings: " + logEntry);
      } else {
        Serial.println("Failed to sync TurnedOffRoom log: " + logEntry + " - " + fbdo.errorReason());
        syncSuccess = false;
      }
    }
    // Check if this is a Tamper log
    else if (logEntry.startsWith("Tamper:")) {
      int tamperIndex = logEntry.indexOf("Tamper:") + 7;
      int timestampIndex = logEntry.indexOf("Timestamp:");
      int statusIndex = logEntry.indexOf("Status:");

      if (tamperIndex == -1 || timestampIndex == -1 || statusIndex == -1) {
        Serial.println("Invalid Tamper log entry format: " + logEntry);
        continue;
      }

      String tamperAction = logEntry.substring(tamperIndex, timestampIndex - 1);
      String timestamp = logEntry.substring(timestampIndex + 10, statusIndex - 1);
      if (timestamp == "N/A") {
        timestamp = "1970-01-01 00:00:00";
        Serial.println("Timestamp is N/A. Using placeholder: " + timestamp);
      }
      String statusPart = logEntry.substring(statusIndex + 7);

      String byUid = "";
      if (tamperAction == "Resolved") {
        int byIndex = statusPart.indexOf("By:");
        if (byIndex != -1) {
          byUid = statusPart.substring(byIndex + 3);
          statusPart = statusPart.substring(0, byIndex);
        }
      }

      FirebaseJson json;
      json.set("action", "Tamper" + tamperAction);
      json.set("timestamp", timestamp);
      json.set("status", statusPart);
      if (tamperAction == "Resolved" && byUid != "") {
        json.set("resolvedBy", byUid);
      }
      json.set("name", "System");
      json.set("role", "Super Admin");

      String safeTimestamp = timestamp;
      safeTimestamp.replace(" ", "_");
      String path = "/OfflineDataLogging/Tamper_" + safeTimestamp;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Synced Tamper log: " + logEntry);
      } else {
        Serial.println("Failed to sync Tamper log: " + logEntry + " - " + fbdo.errorReason());
        syncSuccess = false;
      }
    }
    // Handle other log entries (e.g., SuperAdminAccess, Door Opened, etc.)
    else if (logEntry.startsWith("UID:")) {
      int uidIndex = logEntry.indexOf("UID:") + 4;
      int timestampIndex = logEntry.indexOf("Timestamp:");
      int actionIndex = logEntry.indexOf("Action:");

      if (uidIndex == -1 || timestampIndex == -1 || actionIndex == -1) {
        Serial.println("Invalid log entry format: " + logEntry);
        continue;
      }

      String uid = logEntry.substring(uidIndex, timestampIndex - 1);
      String timestamp = logEntry.substring(timestampIndex + 10, actionIndex - 1);
      if (timestamp == "N/A") {
        timestamp = "1970-01-01 00:00:00";
        Serial.println("Timestamp is N/A. Using placeholder: " + timestamp);
      }
      String actionPart = logEntry.substring(actionIndex + 7);
      String action = actionPart;
      float powerConsumption = 0.0;
      float voltage = 0.0;

      FirebaseJson json;
      json.set("uid", uid);
      json.set("timestamp", timestamp);

      if (actionPart.indexOf("Door Opened+Deactivate") != -1) {
        action = "Door Opened+Deactivate";
        json.set("initialAction", "Door Opened");
        json.set("finalAction", "Deactivate");

        int powerIndex = actionPart.indexOf("Power:");
        if (powerIndex != -1) {
          int kwhIndex = actionPart.indexOf("kWh", powerIndex);
          if (kwhIndex != -1) {
            String powerStr = actionPart.substring(powerIndex + 6, kwhIndex);
            powerConsumption = powerStr.toFloat();
            if (isnan(powerConsumption) || powerConsumption < 0) powerConsumption = 0.0;
            Serial.println("Parsed powerConsumption: " + String(powerConsumption, 3) + " kWh");
          }
        }

        int voltageIndex = actionPart.indexOf("Voltage:");
        if (voltageIndex != -1) {
          int vIndex = actionPart.indexOf("V", voltageIndex);
          if (vIndex != -1) {
            String voltageStr = actionPart.substring(voltageIndex + 8, vIndex);
            voltage = voltageStr.toFloat();
            if (isnan(voltage) || voltage < 0) voltage = 0.0;
            Serial.println("Parsed voltage: " + String(voltage, 2) + " V");
          }
        }
      } else {
        json.set("action", actionPart);

        int powerIndex = actionPart.indexOf("Power:");
        if (powerIndex != -1) {
          int kwhIndex = actionPart.indexOf("kWh", powerIndex);
          if (kwhIndex != -1) {
            String powerStr = actionPart.substring(powerIndex + 6, kwhIndex);
            powerConsumption = powerStr.toFloat();
            if (isnan(powerConsumption) || powerConsumption < 0) powerConsumption = 0.0;
            Serial.println("Parsed powerConsumption: " + String(powerConsumption, 3) + " kWh");
          }
        }

        int voltageIndex = logEntry.indexOf("Voltage:");
        if (voltageIndex != -1) {
          int vIndex = logEntry.indexOf("V", voltageIndex);
          if (vIndex != -1) {
            String voltageStr = logEntry.substring(voltageIndex + 8, vIndex);
            voltage = voltageStr.toFloat();
            if (isnan(voltage) || voltage < 0) voltage = 0.0;
            Serial.println("Parsed voltage: " + String(voltage, 2) + " V");
          }
        }
      }

      String name = "Unknown";
      String role = "Unknown";
      if (uid == SUPER_ADMIN_UID) {
        name = "CIT-U";
        role = "Super Admin";
        json.set("department", "Computer Engineering");
        json.set("building", "GLE");
      } else if (firestoreTeachers.find(uid) != firestoreTeachers.end()) {
        name = firestoreTeachers[uid]["fullName"].length() > 0 ? firestoreTeachers[uid]["fullName"] : "Unknown";
        role = firestoreTeachers[uid]["role"].length() > 0 ? firestoreTeachers[uid]["role"] : "Unknown";
      } else if (firestoreStudents.find(uid) != firestoreStudents.end()) {
        name = firestoreStudents[uid]["fullName"].length() > 0 ? firestoreStudents[uid]["fullName"] : "Unknown";
        role = firestoreStudents[uid]["role"].length() > 0 ? firestoreStudents[uid]["role"] : "Unknown";
      } else if (firestoreUsers.find(uid) != firestoreUsers.end()) {
        name = firestoreUsers[uid]["fullName"].length() > 0 ? firestoreUsers[uid]["fullName"] : "Unknown";
        role = firestoreUsers[uid]["role"].length() > 0 ? firestoreUsers[uid]["role"] : "Unknown";
      }
      json.set("name", name);
      json.set("role", role);

      if (action == "Door Opened+Deactivate" || action.indexOf("Power:") != -1) {
        json.set("powerConsumption", String(powerConsumption, 3));
        json.set("powerConsumptionNote", powerConsumption < 0.001 ? "Insufficient Consumption" : "Normal");
        json.set("voltage", voltage);
      }

      String safeTimestamp = timestamp;
      safeTimestamp.replace(" ", "_");
      String path = "/OfflineDataLogging/" + uid + "_" + safeTimestamp;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Synced offline log: " + logEntry);
      } else {
        Serial.println("Failed to sync log: " + logEntry + " - " + fbdo.errorReason());
        syncSuccess = false;
      }
    }
    // Skip malformed entries
    else {
      Serial.println("Skipping malformed log entry: " + logEntry);
      continue;
    }
  }

  logFile.close();
  SD.end();
  return syncSuccess;
}


void clearSDLogs() {
  if (SD.begin(SD_CS, fsSPI, 4000000)) {
    if (SD.remove(OFFLINE_LOG_FILE)) {
      Serial.println(String(OFFLINE_LOG_FILE) + " cleared successfully.");
    } else {
      Serial.println("Failed to clear " + String(OFFLINE_LOG_FILE) + ".");
    }
    SD.end();
  } else {
    Serial.println("Failed to initialize SD card to clear logs.");
  }
}
void scanI2C() {
  Serial.println("Scanning I2C bus...");
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device found at address 0x");
      if (addr < 16) Serial.print("0");
      Serial.println(addr, HEX);
    }
  }
}

bool syncSchedulesToSD() {
  if (!isConnected || !Firebase.ready()) {
    Serial.println("Cannot sync schedules: No WiFi or Firebase not ready.");
    return false;
  }

  // Initialize SD if not already done
  if (!sdInitialized) {
    Serial.println("SD not initialized. Attempting to start SD...");
    if (!SD.begin(SD_CS, fsSPI, 4000000)) {
      Serial.println("SD card initialization failed. Check wiring, CS pin (" + String(SD_CS) + "), or SD card.");
      return false;
    }
    sdInitialized = true;
    Serial.println("SD card initialized successfully.");
  }

  // Check if schedules.json exists and read current content
  String currentJsonStr;
  bool fileExists = SD.exists("/schedules.json");
  if (fileExists) {
    File readFile = SD.open("/schedules.json", FILE_READ);
    if (readFile) {
      while (readFile.available()) {
        currentJsonStr += (char)readFile.read();
      }
      readFile.close();
      Serial.println("Read existing /schedules.json. Size: " + String(currentJsonStr.length()) + " bytes");
    } else {
      Serial.println("Failed to read existing /schedules.json. Proceeding to create new file.");
    }
  } else {
    Serial.println("/schedules.json not found. Will create new file.");
  }

  // Build new schedules JSON
  FirebaseJson schedulesJson;
  for (const auto& teacher : firestoreTeachers) {
    String uid = teacher.first;
    String schedulesStr;
    String sectionsStr;

    try {
      schedulesStr = teacher.second.at("schedules");
      sectionsStr = teacher.second.at("sections");
    } catch (const std::out_of_range& e) {
      Serial.println("UID " + uid + " missing schedules or sections. Skipping.");
      continue;
    }

    if (schedulesStr != "[]" && schedulesStr.length() > 0) {
      FirebaseJson teacherData;
      FirebaseJson schedules;
      if (schedules.setJsonData(schedulesStr)) {
        teacherData.set("schedules", schedules);
      } else {
        Serial.println("Failed to parse schedules JSON for UID " + uid);
        continue;
      }

      if (sectionsStr != "[]" && sectionsStr.length() > 0) {
        FirebaseJson sections;
        if (sections.setJsonData(sectionsStr)) {
          teacherData.set("sections", sections);
        } else {
          Serial.println("Failed to parse sections JSON for UID " + uid);
        }
      }
      schedulesJson.set(uid, teacherData);
    }
  }

  String newJsonStr;
  schedulesJson.toString(newJsonStr, true);

  // Compare and update only if changed or file doesn't exist
  if (!fileExists || currentJsonStr != newJsonStr) {
    File scheduleFile = SD.open("/schedules.json", FILE_WRITE);
    if (!scheduleFile) {
      Serial.println("Failed to open /schedules.json for writing. SD card may be read-only, full, or corrupted.");
      SD.end();
      sdInitialized = false;
      return false;
    }

    if (scheduleFile.print(newJsonStr)) {
      Serial.println("Schedules (and sections) synced to /schedules.json. Size: " + String(newJsonStr.length()) + " bytes");
      scheduleFile.close();
    } else {
      Serial.println("Failed to write schedules to /schedules.json. SD card may be full or corrupted.");
      scheduleFile.close();
      SD.end();
      sdInitialized = false;
      return false;
    }
  } else {
    Serial.println("No changes detected in schedules. Keeping existing /schedules.json.");
  }

  SD.end();
  return true;
}

bool schedulesMatch(const ScheduleInfo& studentSchedule, FirebaseJson& instructorScheduleJson) {
  FirebaseJsonData jsonData;
  String instructorDay, instructorStartTime, instructorEndTime, instructorRoomName, instructorSubjectCode, instructorSection;

  if (instructorScheduleJson.get(jsonData, "day") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorDay = jsonData.stringValue;
  }
  if (instructorScheduleJson.get(jsonData, "startTime") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorStartTime = jsonData.stringValue;
  }
  if (instructorScheduleJson.get(jsonData, "endTime") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorEndTime = jsonData.stringValue;
  }
  if (instructorScheduleJson.get(jsonData, "roomName") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorRoomName = jsonData.stringValue;
  }
  if (instructorScheduleJson.get(jsonData, "subjectCode") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorSubjectCode = jsonData.stringValue;
  }
  if (instructorScheduleJson.get(jsonData, "section") && jsonData.typeNum == FirebaseJson::JSON_STRING) {
    instructorSection = jsonData.stringValue;
  }

  bool match = (studentSchedule.day.equalsIgnoreCase(instructorDay) &&
                studentSchedule.startTime == instructorStartTime &&
                studentSchedule.endTime == instructorEndTime &&
                studentSchedule.roomName == instructorRoomName &&
                studentSchedule.subjectCode == instructorSubjectCode &&
                studentSchedule.section == instructorSection);

  if (!match) {
    Serial.println("Schedule mismatch - Student: " + studentSchedule.day + " " +
                   studentSchedule.startTime + "-" + studentSchedule.endTime + ", " +
                   studentSchedule.roomName + ", " + studentSchedule.subjectCode + ", " +
                   studentSchedule.section + " | Instructor: " + instructorDay + " " +
                   instructorStartTime + "-" + instructorEndTime + ", " +
                   instructorRoomName + ", " + instructorSubjectCode + ", " + instructorSection);
  }

  return match;
}

ScheduleInfo isWithinSchedule(String uidStr, String timestamp) {
  ScheduleInfo result = {false, "", "", "", "", "", "", ""}; // Default: no match

  int currentHour, currentMinute;
  String currentDay;

  if (sdMode) {
    RtcDateTime now = Rtc.GetDateTime();
    if (!now.IsValid()) {
      Serial.println("RTC time invalid in isWithinSchedule");
      return result;
    }
    const char* days[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
    currentDay = days[now.DayOfWeek()];
    currentHour = now.Hour();
    currentMinute = now.Minute();
  } else {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
      Serial.println("Failed to get local time in isWithinSchedule");
      return result;
    }
    char dayStr[10];
    strftime(dayStr, sizeof(dayStr), "%A", &timeinfo);
    currentDay = String(dayStr);
    currentHour = timeinfo.tm_hour;
    currentMinute = timeinfo.tm_min;
  }

  String minuteStr = (currentMinute < 10 ? "0" : "") + String(currentMinute);
  Serial.println("Current day: " + currentDay + ", time: " + String(currentHour) + ":" + minuteStr);

  // Load schedules from SD or Firestore
  FirebaseJson schedulesJson;
  bool loadedFromSD = false;

  if (sdMode) {
    if (SD.begin(SD_CS, fsSPI, 4000000)) {
      File scheduleFile = SD.open("/schedules.json", FILE_READ);
      if (scheduleFile) {
        String jsonStr;
        while (scheduleFile.available()) {
          jsonStr += (char)scheduleFile.read();
        }
        scheduleFile.close();
        schedulesJson.setJsonData(jsonStr);
        loadedFromSD = (jsonStr.length() > 0);
        Serial.println("Loaded schedules from SD: " + String(jsonStr.length()) + " bytes");
      } else {
        Serial.println("Failed to open /schedules.json for reading.");
      }
      SD.end();
    } else {
      Serial.println("SD card init failed in isWithinSchedule.");
    }

    // Check if UID exists in SD-loaded schedules
    FirebaseJsonData uidData;
    if (loadedFromSD && schedulesJson.get(uidData, uidStr)) {
      FirebaseJson teacherSchedules;
      teacherSchedules.setJsonData(uidData.stringValue);
      FirebaseJsonData schedulesData;
      if (teacherSchedules.get(schedulesData, "schedules")) {
        schedulesJson.clear();
        schedulesJson.setJsonData(schedulesData.stringValue);
        Serial.println("Using SD-loaded schedules for UID: " + uidStr);
      } else {
        Serial.println("No 'schedules' field found in SD data for UID: " + uidStr);
        loadedFromSD = false;
      }
    } else if (loadedFromSD) {
      Serial.println("UID " + uidStr + " not found in SD schedules.");
      loadedFromSD = false;
    }
  }

  // Fallback to Firestore data (for students or teachers)
  if (!loadedFromSD) {
    auto student = firestoreStudents.find(uidStr);
    auto teacher = firestoreTeachers.find(uidStr);
    String schedulesStr;

    if (student != firestoreStudents.end()) {
      schedulesStr = student->second["schedules"];
      Serial.println("Checking student schedules for UID: " + uidStr);
    } else if (teacher != firestoreTeachers.end()) {
      schedulesStr = teacher->second["schedules"];
      Serial.println("Checking teacher schedules for UID: " + uidStr);
    } else {
      Serial.println("UID " + uidStr + " not found in firestoreStudents or firestoreTeachers");
      return result;
    }

    if (schedulesStr == "[]" || schedulesStr.length() == 0) {
      Serial.println("No schedules found for UID: " + uidStr);
      return result;
    }

    schedulesJson.setJsonData(schedulesStr);
    Serial.println("Using Firestore schedules for UID: " + uidStr + ": " + schedulesStr);
  }

  // Iterate through schedules
  size_t scheduleCount = 0;
  FirebaseJsonData uidData;
  while (schedulesJson.get(uidData, "[" + String(scheduleCount) + "]")) {
    scheduleCount++;
  }
  Serial.println("Checking " + String(scheduleCount) + " schedules for UID: " + uidStr);

  for (size_t i = 0; i < scheduleCount; i++) {
    String path = "[" + String(i) + "]";
    FirebaseJsonData scheduleData;
    if (schedulesJson.get(scheduleData, path)) {
      FirebaseJson schedule;
      schedule.setJsonData(scheduleData.stringValue);

      FirebaseJsonData fieldData;
      String scheduleDay, startTime, endTime, subject, subjectCode, section, roomName;

      #define GET_FIELD(field, var) \
        if (!schedule.get(fieldData, field) || fieldData.stringValue.length() == 0) { \
          Serial.println("Missing or empty '" field "' in schedule " + String(i)); \
          continue; \
        } else { \
          var = fieldData.stringValue; \
        }

      GET_FIELD("day", scheduleDay);
      GET_FIELD("startTime", startTime);
      GET_FIELD("endTime", endTime);
      GET_FIELD("roomName", roomName);
      GET_FIELD("subject", subject);
      GET_FIELD("subjectCode", subjectCode);
      GET_FIELD("section", section);

      Serial.println("Checking schedule: " + scheduleDay + " " + startTime + "-" + endTime +
                     ", Subject: " + subject + ", Code: " + subjectCode + ", Section: " + section +
                     ", Room: " + roomName);

      if (scheduleDay.equalsIgnoreCase(currentDay)) {
        int startHour = startTime.substring(0, 2).toInt();
        int startMin = startTime.substring(3, 5).toInt();
        int endHour = endTime.substring(0, 2).toInt();
        int endMin = endTime.substring(3, 5).toInt();

        int currentMins = currentHour * 60 + currentMinute;
        int startMins = startHour * 60 + startMin;
        int endMins = endHour * 60 + endMin;

        // Handle overnight schedules
        if (endMins < startMins) {
          if (currentMins >= startMins || currentMins <= endMins) {
            Serial.println("Within overnight schedule: " + scheduleDay + " " + startTime + "-" + endTime);
            result.isValid = true;
            result.day = scheduleDay;
            result.startTime = startTime;
            result.endTime = endTime;
            result.roomName = roomName;
            result.subject = subject;
            result.subjectCode = subjectCode;
            result.section = section;
            return result;
          }
        } else if (currentMins >= startMins && currentMins <= endMins) {
          Serial.println("Within schedule: " + scheduleDay + " " + startTime + "-" + endTime);
          result.isValid = true;
          result.day = scheduleDay;
          result.startTime = startTime;
          result.endTime = endTime;
          result.roomName = roomName;
          result.subject = subject;
          result.subjectCode = subjectCode;
          result.section = section;
          return result;
        }
      }
    } else {
      Serial.println("Failed to parse schedule at index " + String(i));
    }
  }

  Serial.println("No matching schedule for " + currentDay + " at " + String(currentHour) + ":" + minuteStr);
  return result;
}


void customLoopTask(void *pvParameters) {
  Serial.println("customLoopTask started with stack size: 20480 bytes");
  Serial.println("Stack remaining at start: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");

  // Firebase data fetching
  fetchRegisteredUIDs();
  Serial.println("Stack after fetchRegisteredUIDs: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
  fetchFirestoreTeachers();
  Serial.println("Stack after fetchFirestoreTeachers: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
  fetchFirestoreStudents();
  Serial.println("Stack after fetchFirestoreStudents: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
  fetchFirestoreRooms();
  Serial.println("Stack after fetchFirestoreRooms: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
  fetchFirestoreUsers();
  Serial.println("Stack after fetchFirestoreUsers: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
  Serial.println("Firestore data fetched: Teachers=" + String(firestoreTeachers.size()) + 
                 ", Students=" + String(firestoreStudents.size()) + 
                 ", Users=" + String(firestoreUsers.size()));

  if (Firebase.ready()) {
    Firebase.RTDB.setStreamCallback(&streamFbdo, streamCallback, streamTimeoutCallback);
    Serial.println("Firebase stream callback initialized.");
  } else {
    Serial.println("Firebase not ready after init: " + fbdo.errorReason());
  }
  Serial.println("Stack after stream setup: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");

  // Main loop
  for (;;) {
    loop();
    vTaskDelay(1 / portTICK_PERIOD_MS); // Yield to other tasks
  }
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 5000);
  Serial.println("Starting setup...");

  static int bootCount = 0;
  bootCount++;
  Serial.println("Boot detected. Boot count: " + String(bootCount));

  systemStartTime = millis();
  Serial.println("System start time: " + String(systemStartTime) + " ms");
  Serial.println("Free heap memory: " + String(ESP.getFreeHeap()) + " bytes");

  // Initialize relay pins first to prevent unintended triggering
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);
  pinMode(RELAY3, OUTPUT);
  pinMode(RELAY4, OUTPUT);
  
  // Small delay before setting the initial state
  delay(20);
  
  // Set initial relay states to HIGH (inactive/unlocked)
  // For these relay modules:
  // HIGH = Relay OFF/Inactive = Door unlocked
  // LOW = Relay ON/Active = Door locked
  digitalWrite(RELAY1, HIGH);  // Initially unlocked
  digitalWrite(RELAY2, HIGH);
  digitalWrite(RELAY3, HIGH);
  digitalWrite(RELAY4, HIGH);
  relayActive = false;
  Serial.println("Relays initialized to inactive state (HIGH)");
  
  // Initialize other pins
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  pinMode(TAMPER_PIN, INPUT_PULLUP);
  pinMode(MFRC522_IRQ, INPUT_PULLUP);
  pinMode(REED_PIN, INPUT_PULLUP);

  // Begin all sensors
  LoadCell1.begin();
  LoadCell2.begin();
  LoadCell3.begin();
  delay(500);
  Serial.println("Taring all load cells...");
  LoadCell1.start(1000, true);
  LoadCell2.start(1000, true);
  LoadCell3.start(1000, true);
  
  if (!LoadCell1.getTareStatus()) Serial.println("Tare timeout LoadCell1");
  else Serial.println("LoadCell1 tared.");
  
  if (!LoadCell2.getTareStatus()) Serial.println("Tare timeout LoadCell2");
  else Serial.println("LoadCell2 tared.");
  
  if (!LoadCell3.getTareStatus()) Serial.println("Tare timeout LoadCell3");
  else Serial.println("LoadCell3 tared.");

  // Set calibration values
  LoadCell1.setCalFactor(999.0);
  LoadCell2.setCalFactor(999.0);
  LoadCell3.setCalFactor(999.0);

  // Debug reset button state
  Serial.println("Reset button initial state: " + String(digitalRead(RESET_BUTTON_PIN)));
  if (checkResetButton()) {
    Serial.println("Reset button pressed during early setup. Restarting...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Resetting...");
    tone(BUZZER_PIN, 1000, 200);
    delay(300);
    ESP.restart();
  }

  // Initialize I2C and LCD
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(50000);
  Wire.setTimeOut(100);
  scanI2C();
  lcd.begin(16, 2);
  Wire.beginTransmission(0x27);
  if (Wire.endTransmission() != 0) {
    Serial.println("LCD I2C initialization failed at address 0x27!");
    lcd.noBacklight();
    tone(BUZZER_PIN, 500, 1000);
    while (1) {
      if (checkResetButton()) ESP.restart();
      yield();
    }
  }
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Booting");
  delay(1000);
  if (checkResetButton()) ESP.restart();

  // WiFi connection
  int wifiRetries = 3;
  bool wifiConnected = false;
  for (int i = 0; i < wifiRetries && !wifiConnected; i++) {
    connectWiFi();
    if (WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      isConnected = true;
      Serial.println("WiFi connected to: " + String(WiFi.SSID()));
      Serial.println("IP Address: " + WiFi.localIP().toString());
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Connected");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.localIP().toString());
      delay(1500);
      if (checkResetButton()) ESP.restart();
    } else {
      Serial.println("WiFi attempt " + String(i + 1) + " failed. Retrying...");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Retry ");
      lcd.print(i + 1);
      lcd.setCursor(0, 1);
      lcd.print("Wait 2s...");
      delay(2000);
      if (checkResetButton()) ESP.restart();
    }
  }

  if (!wifiConnected) {
    Serial.println("WiFi failed after " + String(wifiRetries) + " attempts. Switching to SD mode.");
    sdMode = true;
    isConnected = false;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    lcd.setCursor(0, 1);
    lcd.print("SD Mode On");
    tone(BUZZER_PIN, 800, 500);
    delay(2000);
    if (checkResetButton()) ESP.restart();
  }

  // Initialize RTC
  Rtc.Begin();
  Serial.println("DS1302 RTC Initialized");
  RtcDateTime compiled = RtcDateTime(__DATE__, __TIME__);
  if (!Rtc.IsDateTimeValid()) {
    Serial.println("RTC lost confidence in DateTime! Setting to compile time.");
    Rtc.SetDateTime(compiled);
  }
  if (Rtc.GetIsWriteProtected()) {
    Serial.println("RTC was write-protected, enabling writing.");
    Rtc.SetIsWriteProtected(false);
  }
  if (!Rtc.GetIsRunning()) {
    Serial.println("RTC was not running, starting now.");
    Rtc.SetIsRunning(true);
  }
  if (checkResetButton()) ESP.restart();

  // NTP and Firebase setup if online
  if (!sdMode) {
    IPAddress ntpIP;
    if (WiFi.hostByName("pool.ntp.org", ntpIP)) {
      Serial.println("pool.ntp.org resolved to " + ntpIP.toString());
    } else {
      Serial.println("Failed to resolve pool.ntp.org");
    }

    configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("NTP configured (UTC+8). Syncing time...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Syncing Time");

    const int ntpRetries = 3;
    const unsigned long syncTimeout = 20000;
    struct tm timeinfo;
    bool timeSynced = false;

    for (int attempt = 0; attempt < ntpRetries && !timeSynced; attempt++) {
      unsigned long startTime = millis();
      Serial.print("NTP sync attempt " + String(attempt + 1) + "...");
      while (millis() - startTime < syncTimeout && !timeSynced) {
        if (getLocalTime(&timeinfo)) timeSynced = true;
        Serial.print(".");
        delay(500);
        if (checkResetButton()) ESP.restart();
      }
      if (timeSynced) {
        char timeString[20];
        strftime(timeString, sizeof(timeString), "%H:%M:%S %Y-%m-%d", &timeinfo);
        Serial.println("\nTime synced: " + String(timeString));
        lcd.setCursor(0, 1);
        lcd.print(timeString);
        delay(1500);
        if (checkResetButton()) ESP.restart();
        Rtc.SetDateTime(RtcDateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                                    timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
        Serial.println("RTC synced with NTP time.");
      } else {
        Serial.println("\nNTP sync attempt " + String(attempt + 1) + " failed.");
        if (attempt < ntpRetries - 1) {
          lcd.setCursor(0, 1);
          lcd.print("Retry " + String(attempt + 2));
          delay(2000);
          if (checkResetButton()) ESP.restart();
        }
      }
    }

    if (!timeSynced) {
      Serial.println("Time sync failed after " + String(ntpRetries) + " attempts. Switching to SD mode.");
      sdMode = true;
      isConnected = false;
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Time Sync Fail");
      lcd.setCursor(0, 1);
      lcd.print("SD Mode");
      tone(BUZZER_PIN, 1000, 500);
      digitalWrite(LED_R_PIN, HIGH);
      delay(3000);
      digitalWrite(LED_R_PIN, LOW);
      if (checkResetButton()) ESP.restart();
    } else {
      initFirebase();
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Firebase Init");
      delay(1500);
      if (checkResetButton()) ESP.restart();

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Fetching Students");
      Serial.println("Calling fetchFirestoreStudents...");
      fetchFirestoreStudents();
      lcd.setCursor(0, 1);
      if (firestoreStudents.find("5464E1BA") != firestoreStudents.end()) {
        lcd.print("Students Loaded");
        Serial.println("fetchFirestoreStudents completed. 5464E1BA found.");
      } else {
        lcd.print("Fetch Failed");
        Serial.println("fetchFirestoreStudents completed. 5464E1BA NOT found.");
      }
      delay(1500);
      if (checkResetButton()) ESP.restart();
    }
  } else {
    Serial.println("SD mode active. Using RTC for time.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SD Mode");
    lcd.setCursor(0, 1);
    lcd.print("RTC Time Active");
    delay(2000);
    if (checkResetButton()) ESP.restart();
  }

  // RFID initialization
  hspi.begin(MFRC522_SCK, MFRC522_MISO, MFRC522_MOSI, MFRC522_CS);
  pinMode(MFRC522_CS, OUTPUT);
  pinMode(MFRC522_RST, OUTPUT);
  
  // Reset the RFID reader completely
  digitalWrite(MFRC522_RST, LOW);
  delay(10);
  digitalWrite(MFRC522_RST, HIGH);
  delay(50);
  
  rfid.PCD_Init();
  delay(50); // Add a small delay after init
  
  // Read version to verify initialization
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.print("MFRC522 Version: 0x");
  Serial.println(version, HEX);
  
  if (version == 0x00 || version == 0xFF) {
    Serial.println("WARNING: RFID reader not responding. Trying again...");
    // Try one more time
    rfid.PCD_Init();
    delay(100);
    version = rfid.PCD_ReadRegister(rfid.VersionReg);
    Serial.print("MFRC522 Version 2nd attempt: 0x");
    Serial.println(version, HEX);
  }
  
  Serial.println("MFRC522 initialized.");
  rfid.PCD_SetAntennaGain(rfid.RxGain_max); // Set maximum gain
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("RFID Ready");
  delay(1500);
  if (checkResetButton()) ESP.restart();

  // SD card initialization
  fsSPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  pinMode(SD_CS, OUTPUT);
  if (!SD.begin(SD_CS, fsSPI, 4000000)) {
    Serial.println("⚠️ SD Card initialization failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SD Card Fail");
    tone(BUZZER_PIN, 700, 1000);
    while (1) {
      if (checkResetButton()) ESP.restart();
      yield();
    }
  }
  Serial.println("✅ SD Card initialized.");
  sdInitialized = true;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SD Card Ready");
  delay(1500);
  if (checkResetButton()) ESP.restart();

  // PZEM initialization
  pzemSerial.begin(9600, SERIAL_8N1, PZEM_RX, PZEM_TX);
  if (!pzem.resetEnergy()) {
    Serial.println("PZEM reset failed!");
  }
  Serial.println("PZEM initialized on UART1 (RX=" + String(PZEM_RX) + ", TX=" + String(PZEM_TX) + ").");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("PZEM Ready");
  delay(1500);
  if (checkResetButton()) ESP.restart();

  // Weight sensors initialization
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Weight Sensors");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  delay(1000);
  if (checkResetButton()) ESP.restart();
  setupWeightSensors();
  delay(1500); // Moved delay here to show "Calibrated"
  if (checkResetButton()) ESP.restart();

  // Sync SD data and schedules
  lastActivityTime = millis();
  checkAndSyncSDData();
  if (isConnected && Firebase.ready()) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Syncing Schedules");
    if (syncSchedulesToSD()) {
      Serial.println("Schedules synced to SD during setup.");
      lcd.setCursor(0, 1);
      lcd.print("Sync Complete");
    } else {
      Serial.println("Failed to sync schedules to SD during setup.");
      lcd.setCursor(0, 1);
      lcd.print("Sync Failed");
    }
    delay(1500);
    if (checkResetButton()) ESP.restart();
  } else {
    Serial.println("Skipping schedule sync: No connection or Firebase not ready.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Offline Mode");
    lcd.setCursor(0, 1);
    lcd.print("Using SD Cache");
    delay(1500);
    if (checkResetButton()) ESP.restart();
  }

  // Final setup message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ready. Tap your");
  lcd.setCursor(0, 1);
  lcd.print("RFID Card!");
  showNeutral();
  Serial.println("Setup complete. System ready.");
  lastReadyPrint = millis();
  readyMessageShown = true;

  Serial.println("Stack remaining at end of setup: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");

  // Create custom loop task
  if (xTaskCreatePinnedToCore(
        customLoopTask, "CustomLoopTask", 32768, NULL, 1, NULL, 1) != pdPASS) {
    Serial.println("Failed to create CustomLoopTask. Insufficient memory?");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Task Fail");
    while (1) {
      if (checkResetButton()) ESP.restart();
      yield();
    }
  }
  Serial.println("CustomLoopTask created with 32 KB stack size.");

  // Prevent setup from returning
  while (1) {
    if (checkResetButton()) ESP.restart();
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }

  // Initialize SD card
  initSDCard();
  uidDetailsFetched = false;

  // Create FreeRTOS tasks
  xTaskCreatePinnedToCore(
    rfidTask,            // Task function
    "RFIDTask",          // Name
    4096,                // Stack size (bytes)
    NULL,                // Parameters
    1,                   // Priority (1 is low)
    NULL,                // Task handle
    1                    // Core (1 = second core)
  );

  Serial.println("Setup complete. Running normal operation.");
  displayMessage("Ready. Tap your", "RFID Card!", 0);
  readyMessageShown = true;
  lastReadyPrint = millis();
  lastActivityTime = millis();
}

bool validateWeightSensor(int index) {
  if (index >= 0 && index < NUM_SENSORS) {
    // Try to update and return true if we get any response (not just status 2)
    int updateResult = loadCells[index]->update();
    return (updateResult >= 0); // Any valid response is acceptable
  }
  return false;
}

void setupWeightSensors() {
  Serial.println("Initializing HX711 Load Cells...");
  const unsigned long stabilizingTime = 1000; // Define the stabilizing time constant (in ms)

  for (int i = 0; i < NUM_SENSORS; i++) {
    Serial.printf("Setting up Load Cell %d...\n", i + 1);
    loadCells[i]->begin();
    delay(10);
    loadCells[i]->start(stabilizingTime, true);
    
    if (loadCells[i]->getTareTimeoutFlag()) {
      Serial.printf("❌ Tare failed for LoadCell%d\n", i + 1);
    } else {
      Serial.printf("✅ LoadCell%d tared successfully.\n", i + 1);
    }

    loadCells[i]->setCalFactor(calibrationFactors[i]);
    Serial.printf("Calibration factor for LoadCell%d: %.1f\n", i + 1, calibrationFactors[i]);
  }

  Serial.println("All load cells initialized.\n");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Weight Sensors");
  lcd.setCursor(0, 1);
  lcd.print("Calibrated");
}

void resetWeightSensors() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    Serial.println("Reset weight sensor " + String(i + 1));
    // Use tareNoDelay instead of tare to avoid blocking
    loadCells[i]->tareNoDelay();
    Serial.println("Sensor " + String(i + 1) + " tare initiated.");
  }
  
  // Give some time for tare operations to take effect but don't wait indefinitely
  unsigned long startTime = millis();
  const unsigned long TARE_TIMEOUT = 3000; // 3 seconds timeout
  
  while (millis() - startTime < TARE_TIMEOUT) {
    for (int i = 0; i < NUM_SENSORS; i++) {
      loadCells[i]->update();
    }
    delay(100);
  }
  
  Serial.println("Weight sensor reset complete.");
}

void updatePZEM() {
  lastVoltage = pzem.voltage();
  lastCurrent = pzem.current();
  lastPower = pzem.power();
  lastEnergy = pzem.energy();
  lastFrequency = pzem.frequency();
  lastPowerFactor = pzem.pf();
  isVoltageSufficient = (lastVoltage >= voltageThreshold && !isnan(lastVoltage));
  if (millis() - lastPZEMLogTime > 5000) { // Log every 5s
    Serial.println("PZEM: V=" + String(lastVoltage, 2) + 
                   ", C=" + String(lastCurrent, 2) + 
                   ", E=" + String(lastEnergy, 2));
    lastPZEMLogTime = millis();
  }
}

void handleOfflineSync() {
  if (!SD.exists("/Offline_Logs_Entry.txt")) {
    Serial.println("No offline logs to sync (/Offline_Logs_Entry.txt not found).");
    return;
  }

  File logFile = SD.open("/Offline_Logs_Entry.txt", FILE_READ);
  if (!logFile) {
    Serial.println("Failed to open /Offline_Logs_Entry.txt for reading");
    return;
  }

  Serial.println("Starting offline log sync to Firebase...");
  while (logFile.available()) {
    String line = logFile.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    // Parse log entry
    if (line.indexOf("SuperAdminPZEMInitial:") == 0) {
      continue; // Skip initial PZEM readings
    } else if (line.indexOf("Tamper:") == 0) {
      // Handle tamper logs
      String timestamp = line.substring(line.indexOf("Timestamp:") + 10, line.indexOf(" Status:"));
      String status = line.substring(line.indexOf("Status:") + 7, line.indexOf(" ", line.indexOf("Status:")) >= 0 ? line.indexOf(" ", line.indexOf("Status:")) : line.length());
      FirebaseJson json;
      timestamp.replace("_", "T");
      json.set("startTime", timestamp);
      json.set("status", status.equalsIgnoreCase("Resolved") ? "resolved" : "active");
      String path = "/Alerts/Tamper/" + timestamp;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Offline tamper log pushed to RTDB: " + path);
      } else {
        Serial.println("Failed to push offline tamper log: " + fbdo.errorReason());
      }
    } else if (line.indexOf("System:") == 0) {
      // Handle system logs (e.g., WiFiLost)
      String timestamp = line.substring(line.indexOf("Timestamp:") + 10, line.indexOf(" Action:"));
      String action = line.substring(line.indexOf("Action:") + 7, line.length());
      FirebaseJson json;
      timestamp.replace("_", "T");
      json.set("timestamp", timestamp);
      json.set("action", action);
      String path = "/SystemEvents/" + timestamp;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Offline system log pushed to RTDB: " + path);
      } else {
        Serial.println("Failed to push offline system log: " + fbdo.errorReason());
      }
    } else if (line.indexOf("Student:") == 0) {
      // Handle student logs
      String uid = line.substring(line.indexOf("UID:") + 4, line.indexOf(" TimeIn:"));
      String timeIn = line.substring(line.indexOf("TimeIn:") + 7, line.indexOf(" Action:"));
      String action = line.substring(line.indexOf("Action:") + 7, line.indexOf(" Status:"));
      String status = line.substring(line.indexOf("Status:") + 7, line.indexOf(" Sensor:"));
      String sensor = line.substring(line.indexOf("Sensor:") + 7, line.indexOf(" assignedSensorId:"));
      String assignedSensorId = line.substring(line.indexOf("assignedSensorId:") + 17, line.indexOf(" TimeOut:") >= 0 ? line.indexOf(" TimeOut:") : line.length());
      String timeOut = "";
      if (line.indexOf("TimeOut:") >= 0) {
        timeOut = line.substring(line.indexOf("TimeOut:") + 8, line.length());
      }

      FirebaseJson json;
      timeIn.replace("_", "T");
      json.set("Time In", timeIn);
      json.set("Action", action);
      json.set("Status", status);
      json.set("Sensor", sensor);
      json.set("assignedSensorId", assignedSensorId.toInt());
      if (timeOut.length() > 0) {
        timeOut.replace("_", "T");
        json.set("Time Out", timeOut);
      }

      // Fetch student data
      String studentName = "Unknown", email = "", idNumber = "", mobileNumber = "", role = "student", department = "";
      String schedulesJsonStr = "[]", subjectCode = "Unknown", roomName = "Unknown", sectionName = "Unknown";
      if (firestoreStudents.find(uid) != firestoreStudents.end()) {
        studentName = firestoreStudents[uid]["fullName"].length() > 0 ? firestoreStudents[uid]["fullName"] : "Unknown";
        email = firestoreStudents[uid]["email"];
        idNumber = firestoreStudents[uid]["idNumber"];
        mobileNumber = firestoreStudents[uid]["mobileNumber"];
        role = firestoreStudents[uid]["role"].length() > 0 ? firestoreStudents[uid]["role"] : "student";
        department = firestoreStudents[uid]["department"];
        schedulesJsonStr = firestoreStudents[uid]["schedules"].length() > 0 ? firestoreStudents[uid]["schedules"] : "[]";
      }

      json.set("fullName", studentName);
      json.set("email", email);
      json.set("idNumber", idNumber);
      json.set("mobileNumber", mobileNumber);
      json.set("role", role);
      json.set("department", department);
      json.set("timestamp", timeIn);
      json.set("date", timeIn.substring(0, 10));

      // Parse schedules
      FirebaseJsonArray schedulesArray;
      if (schedulesJsonStr != "[]") {
        FirebaseJsonArray tempArray;
        if (tempArray.setJsonArrayData(schedulesJsonStr)) {
          String currentDay = getDayFromTimestamp(timeIn);
          String currentTime = timeIn.substring(11, 16);
          for (size_t i = 0; i < tempArray.size(); i++) {
            FirebaseJsonData scheduleData;
            if (tempArray.get(scheduleData, i)) {
              FirebaseJson scheduleObj;
              if (scheduleObj.setJsonData(scheduleData.stringValue)) {
                FirebaseJson newScheduleObj;
                FirebaseJsonData fieldData;
                if (scheduleObj.get(fieldData, "day")) newScheduleObj.set("day", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "startTime")) newScheduleObj.set("startTime", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "endTime")) newScheduleObj.set("endTime", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "roomName")) newScheduleObj.set("roomName", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "subjectCode")) newScheduleObj.set("subjectCode", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "subject")) newScheduleObj.set("subject", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "section")) newScheduleObj.set("section", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "sectionId")) newScheduleObj.set("sectionId", fieldData.stringValue);
                if (scheduleObj.get(fieldData, "instructorName")) newScheduleObj.set("instructorName", fieldData.stringValue);
                schedulesArray.add(newScheduleObj);
                if (scheduleObj.get(fieldData, "day") && fieldData.stringValue == currentDay) {
                  String startTime, endTime;
                  if (scheduleObj.get(fieldData, "startTime")) startTime = fieldData.stringValue;
                  if (scheduleObj.get(fieldData, "endTime")) endTime = fieldData.stringValue;
                  if (isTimeInRange(currentTime, startTime, endTime)) {
                    if (scheduleObj.get(fieldData, "subjectCode")) subjectCode = fieldData.stringValue;
                    if (scheduleObj.get(fieldData, "roomName")) roomName = fieldData.stringValue;
                    if (scheduleObj.get(fieldData, "section")) sectionName = fieldData.stringValue;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      String sessionId = timeIn.substring(0, 10) + "_" + subjectCode + "_" + sectionName + "_" + roomName;
      json.set("sessionId", sessionId);
      json.set("schedules", schedulesArray);

      String path = "/Students/" + uid + "/Attendance/" + sessionId;
      if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
        Serial.println("Offline student log pushed to RTDB: " + path);
      } else {
        Serial.println("Failed to push offline student log: " + fbdo.errorReason());
      }
    } else if (line.indexOf("UID:") == 0) {
      // Handle other UID-based logs (e.g., Super Admin, Instructor)
      String uid = line.substring(line.indexOf("UID:") + 4, line.indexOf(" ", line.indexOf("UID:")));
      String entryTime = line.indexOf("EntryTime:") >= 0 ? line.substring(line.indexOf("EntryTime:") + 10, line.indexOf(" ExitTime:") >= 0 ? line.indexOf(" ExitTime:") : line.indexOf(" Action:")) : "";
      String exitTime = line.indexOf("ExitTime:") >= 0 ? line.substring(line.indexOf("ExitTime:") + 9, line.indexOf(" Action:")) : "";
      String action = line.substring(line.indexOf("Action:") + 7, line.indexOf(" ", line.indexOf("Action:")) >= 0 ? line.indexOf(" ", line.indexOf("Action:")) : line.length());

      FirebaseJson json;
      if (entryTime.length() > 0) {
        entryTime.replace("_", "T");
        json.set("entry_time", entryTime);
      }
      if (exitTime.length() > 0) {
        exitTime.replace("_", "T");
        json.set("exit_time", exitTime);
      }

      // Parse PZEM data
      if (line.indexOf("TotalConsumption:") > 0) {
        String totalConsumption = line.substring(line.indexOf("TotalConsumption:") + 17, line.indexOf("kWh", line.indexOf("TotalConsumption:")));
        FirebaseJson pzemJson;
        pzemJson.set("total_consumption", totalConsumption + "kWh");
        json.set("pzem_data", pzemJson);
      }

      if (uid == SUPER_ADMIN_UID) {
        json.set("uid", uid);
        json.set("name", "CIT-U");
        json.set("role", "Super Admin");
        json.set("department", "Computer Engineering");
        json.set("building", "GLE");
        json.set("action", action);
        String path = "/OfflineDataLogging/" + uid + "_" + entryTime;
        if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
          Serial.println("Offline Super Admin log pushed to RTDB: " + path);
        } else {
          Serial.println("Failed to push offline Super Admin log: " + fbdo.errorReason());
        }
      } else if (firestoreTeachers.find(uid) != firestoreTeachers.end()) {
        json.set("uid", uid);
        json.set("name", firestoreTeachers[uid]["fullName"]);
        json.set("role", "Instructor");
        json.set("department", "Computer Engineering");
        json.set("building", "GLE");
        json.set("action", "FromSD Offline");

        // Extract schedule details
        if (line.indexOf("Schedule:") > 0) {
          String scheduleStr = line.substring(line.indexOf("Schedule:") + 9, line.indexOf(" Room:"));
          String room = line.substring(line.indexOf("Room:") + 5, line.indexOf(" Subject:"));
          String subject = line.substring(line.indexOf("Subject:") + 8, line.indexOf(" Code:"));
          String code = line.substring(line.indexOf("Code:") + 5, line.indexOf(" Section:"));
          String section = line.substring(line.indexOf("Section:") + 8, line.length());

          json.set("subject", subject);
          json.set("room", room);
          json.set("code", code);
          json.set("section", section);
        }

        String path = "/OfflineDataLogging/" + uid + "_" + entryTime;
        if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
          Serial.println("Offline instructor log pushed to RTDB: " + path);
        } else {
          Serial.println("Failed to push offline instructor log: " + fbdo.errorReason());
        }
      } else {
        json.set("uid", uid);
        json.set("name", "Unknown");
        json.set("role", "Unknown");
        json.set("action", "FromSD Offline");
        String path = "/OfflineDataLogging/" + uid + "_" + entryTime;
        if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
          Serial.println("Offline unknown log pushed to RTDB: " + path);
        } else {
          Serial.println("Failed to push offline unknown log: " + fbdo.errorReason());
        }
      }
    }

    yield(); // Allow other tasks during sync
  }

  logFile.close();
  if (SD.remove("/Offline_Logs_Entry.txt")) {
    Serial.println("Offline logs synced and file deleted.");
  } else {
    Serial.println("Failed to delete /Offline_Logs_Entry.txt");
  }
}

void updateAbsentStudents() {
  for (auto& student : firestoreStudents) {
    String rfidUid = student.first;
    String path = "/Students/" + rfidUid + "/Attendance/" + currentSessionId;
    if (Firebase.RTDB.getJSON(&fbdo, path)) {
      FirebaseJson* json = fbdo.jsonObjectPtr();
      FirebaseJsonData jsonData;
      if (json->get(jsonData, "Time Out") && jsonData.stringValue != "") {
        // Student already tapped out, skip
        continue;
      }
      if (json->get(jsonData, "Status") && jsonData.stringValue == "Present") {
        // Student was present but didn't tap out, update to Absent
        String timestamp = getFormattedTime();
        json->set("Status", "Absent");
        json->set("Time Out", "Not Recorded");
        json->set("Sensor", "None");
        if (Firebase.RTDB.setJSON(&fbdo, path, json)) {
          Serial.println("Updated student " + rfidUid + " to Absent due to no tap-out.");
          storeLogToSD("Student:UID:" + rfidUid + " UpdatedToAbsent Time:" + timestamp);
        } else {
          Serial.println("Failed to update student " + rfidUid + " to Absent: " + fbdo.errorReason());
        }
      }
    }
  }
}

// Global map to persist assignedSensorId across sessions for same class
std::map<String, int> persistentSensorAssignments; // Key: uid + sessionId, Value: sensorIndex

void loop() {
  checkPendingRelayOperations();
  watchdogCheck(); // Feed WDT

  if (checkResetButton()) return; // Early reset check
  
  yield(); // Prevent watchdog reset at start of loop

  // Periodic updates
  static unsigned long lastPeriodicUpdate = 0;
  if (millis() - lastPeriodicUpdate >= 100) {
    updatePZEM();
    updateDisplay();
    lastPeriodicUpdate = millis();
    yield(); // Prevent watchdog reset after updates
  }

  // Heap monitoring
  static unsigned long lastHeapCheck = 0;
  if (millis() - lastHeapCheck >= 30000) {
    if (ESP.getFreeHeap() < 10000) {
      logSystemEvent("Low Memory Reset");
      ESP.restart();
    }
    lastHeapCheck = millis();
  }

  isConnected = (WiFi.status() == WL_CONNECTED);

  // SD initialization message
  static bool sdInitializedMessageShown = false;
  static unsigned long sdMessageStart = 0;
  if (sdInitialized && !sdInitializedMessageShown) {
    if (sdMessageStart == 0) {
      displayMessage("Backup Logs", "Activated", 2000);
      Serial.println("SD card initialized. Backup logs activated.");
      sdMessageStart = millis();
      lastActivityTime = millis();
      lastReadyPrint = millis();
    } else if (millis() - sdMessageStart >= 2000) {
      displayMessage("Ready. Tap your", "RFID Card!", 0);
      Serial.println("Transitioned to Ready state.");
      sdInitializedMessageShown = true;
      readyMessageShown = true;
      lastReadyPrint = millis();
    }
    yield(); // Prevent watchdog reset before return
    return;
  }

  yield(); // Prevent watchdog reset before stack monitoring

  // Periodic stack monitoring
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint >= 15000) {
    Serial.println("Stack remaining: " + String(uxTaskGetStackHighWaterMark(NULL)) + " bytes");
    lastPrint = millis();
  }

  // Firestore refresh
  static unsigned long lastFirestoreRefresh = 0;
  static enum { FS_IDLE, FS_TEACHERS, FS_STUDENTS, FS_ROOMS, FS_USERS } firestoreState = FS_IDLE;
  if (!sdMode && isConnected && millis() - lastFirestoreRefresh >= 300000) {
    yield(); // Prevent watchdog reset before Firestore operations
    switch (firestoreState) {
      case FS_IDLE: firestoreState = FS_TEACHERS; break;
      case FS_TEACHERS: fetchFirestoreTeachers(); firestoreState = FS_STUDENTS; break;
      case FS_STUDENTS: fetchFirestoreStudents(); firestoreState = FS_ROOMS; break;
      case FS_ROOMS: fetchFirestoreRooms(); firestoreState = FS_USERS; break;
      case FS_USERS:
        fetchFirestoreUsers();
        Serial.println("Firestore refreshed: Teachers=" + String(firestoreTeachers.size()) +
                       ", Students=" + String(firestoreStudents.size()) +
                       ", Users=" + String(firestoreUsers.size()));
        firestoreState = FS_IDLE;
        lastFirestoreRefresh = millis();
        break;
    }
    yield();
  }

  // Schedule sync
  static unsigned long lastScheduleSync = 0;
  if (!sdMode && isConnected && Firebase.ready() && millis() - lastScheduleSync >= 3600000) {
    yield(); // Prevent watchdog reset before sync
    if (syncSchedulesToSD()) {
      displayMessage("Schedules", "Synced to SD", 1500);
    } else {
      displayMessage("Sync Failed", "Check SD", 1500);
    }
    lastScheduleSync = millis();
    yield(); // Prevent watchdog reset after sync
  }

  yield(); // Prevent watchdog reset before Firebase and WiFi checks

  // Firebase health
  static unsigned long lastFirebaseCheck = 0;
  if (isConnected && !sdMode && millis() - lastFirebaseCheck > 60000) {
    if (WiFi.RSSI() < -80) {
      Serial.println("Weak WiFi signal (" + String(WiFi.RSSI()) + " dBm).");
    } else if (!Firebase.ready()) {
      Firebase.reconnectWiFi(true);
      yield(); // Prevent watchdog reset during reconnect
      initFirebase();
      if (!Firebase.ready()) {
        logSystemEvent("Firebase Failure Reset");
        ESP.restart();
      }
    }
    lastFirebaseCheck = millis();
  }

  // WiFi reconnect
  static unsigned long lastWiFiCheck = 0;
  if (millis() - lastWiFiCheck > 180000 && isConnected && WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    lastWiFiCheck = millis();
    yield(); // Prevent watchdog reset after WiFi reconnect
  }

  // I2C health
  if (millis() - lastI2cRecovery > 30000) {
    Wire.beginTransmission(0x27);
    if (Wire.endTransmission() != 0) {
      recoverI2C();
      Wire.beginTransmission(0x27);
      if (Wire.endTransmission() == 0) displayMessage("I2C Recovered", "System OK", 2000);
    }
    lastI2cRecovery = millis();
  }

  yield(); // Prevent watchdog reset before WiFi state handling

  // WiFi state handling
  if (isConnected && !wasConnected && firstActionOccurred) {
    displayMessage("WiFi Reconnected", "Normal Mode", 2000);
    sdMode = false;
    wasConnected = true;
    if (superAdminSessionActive) {
      digitalWrite(RELAY2, HIGH);
      digitalWrite(RELAY3, HIGH);
      digitalWrite(RELAY4, HIGH);
      superAdminSessionActive = false;
      relayActive = false;
    }
    struct tm timeinfo;
    if (getLocalTime(&timeinfo)) {
      Rtc.SetDateTime(RtcDateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                                  timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
    }
    yield(); // Prevent watchdog reset before Firebase operations
    bool firebaseReady = false;
    for (int retry = 0; retry < 3 && !firebaseReady; retry++) {
      initFirebase();
      if (Firebase.ready()) firebaseReady = true;
      else Firebase.reconnectWiFi(true);
      yield();
    }
    if (firebaseReady) {
      fetchFirestoreTeachers();
      yield(); // Prevent watchdog reset between fetches
      fetchFirestoreStudents();
      yield(); // Prevent watchdog reset between fetches
      fetchFirestoreRooms();
      yield(); // Prevent watchdog reset between fetches
      fetchFirestoreUsers();
      yield(); // Prevent watchdog reset between operations
      syncSchedulesToSD();
      yield(); // Prevent watchdog reset between operations
      handleOfflineSync();
    } else {
      sdMode = true;
    }
    lastActivityTime = millis();
    readyMessageShown = false;
  } else if (!isConnected && wasConnected) {
    displayMessage("WiFi Lost", "Check Network", 2000);
    displayMessage("Backup Logs", "Activated", 2000);
    sdMode = true;
    wasConnected = false;
    String entry = "System:WiFiLost Timestamp:" + getFormattedTime() + " Action:BackupActivated";
    storeLogToSD(entry);
    lastActivityTime = millis();
    readyMessageShown = false;
  }

  yield(); // Prevent watchdog reset before voltage monitoring

  // Voltage monitoring
  static bool voltageLost = false;
  static unsigned long voltageLossStart = 0;
  float currentVoltage = pzem.voltage();
  isVoltageSufficient = (currentVoltage >= voltageThreshold && !isnan(currentVoltage));
  if (!isVoltageSufficient && wasVoltageSufficient) {
    if (currentVoltage <= 0 || isnan(currentVoltage)) {
      if (voltageLossStart == 0) voltageLossStart = millis();
      else if (millis() - voltageLossStart >= 5000) {
        voltageLost = true;
        displayMessage("Low Voltage -", "Check Power", 2000);
        displayMessage("Backup Logs", "Activated", 2000);
        wasVoltageSufficient = false;
        lastActivityTime = millis();
        readyMessageShown = false;
      }
    }
  } else if (isVoltageSufficient && !wasVoltageSufficient && voltageLost) {
    displayMessage("Voltage Restored", "", 2000);
    wasVoltageSufficient = true;
    voltageLost = false;
    voltageLossStart = 0;
    lastActivityTime = millis();
    readyMessageShown = false;
  } else if (isVoltageSufficient) {
    voltageLossStart = 0;
  }

  // Reed switch
  int sensorState = digitalRead(REED_PIN);
  if (sensorState == LOW && !reedState) {
    reedState = true;
    tamperResolved = false;
    lastActivityTime = millis();
  } else if (sensorState == HIGH && reedState) {
    reedState = false;
    lastActivityTime = millis();
  }

  // Power-saving mode
  if (!powerSavingMode && !tamperActive && !adminAccessActive && !classSessionActive &&
      !waitingForInstructorEnd && !studentVerificationActive && !tapOutPhase &&
      millis() - lastActivityTime >= INACTIVITY_TIMEOUT) {
    enterPowerSavingMode();
  }
  if (powerSavingMode) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      String uidStr = getUIDString();
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      if (!isConnected) {
        WiFi.reconnect();
        unsigned long wifiStartTime = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - wifiStartTime < 10000) yield();
        isConnected = (WiFi.status() == WL_CONNECTED);
        if (isConnected) {
          initFirebase();
          fetchRegisteredUIDs();
          fetchFirestoreTeachers();
          fetchFirestoreStudents();
          fetchFirestoreRooms();
          fetchFirestoreUsers();
          syncSchedulesToSD();
          struct tm timeinfo;
          if (getLocalTime(&timeinfo)) {
            Rtc.SetDateTime(RtcDateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                                        timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
          }
        }
      }
      if (isRegisteredUID(uidStr)) exitPowerSavingMode();
    }
    return;
  }

  // Tamper detection
  static bool tamperDetected = false;
  static bool tamperMessageDisplayed = false;
  static bool buzzerActive = false;
  static unsigned long lastBuzzerToggle = 0;

  if (!reedState && !tamperActive && !relayActive && !tamperResolved) {
    tamperDetected = tamperActive = tamperAlertTriggered = true;
    tamperMessagePrinted = tamperMessageDisplayed = false;
    buzzerActive = true;
    tamperStartTime = getFormattedTime();
    
    currentTamperAlertId = tamperStartTime;
    currentTamperAlertId.replace(" ", "_");
    currentTamperAlertId.replace(":", "-");
    currentTamperAlertId.replace("/", "-");
    
    String entry = "Tamper:Detected Timestamp:" + tamperStartTime + " Status:Active";
    storeLogToSD(entry);
    
    if (!sdMode && isConnected && Firebase.ready()) {
      String tamperPath = "/Alerts/Tamper/" + currentTamperAlertId;
      FirebaseJson tamperJson;
      tamperJson.set("startTime", tamperStartTime);
      tamperJson.set("status", "active");
      tamperJson.set("detectedAt", tamperStartTime);
      tamperJson.set("deviceId", WiFi.macAddress());
      tamperJson.set("alertType", "tamper");
      tamperJson.set("resolvedBy", "");
      tamperJson.set("resolverName", "");
      tamperJson.set("endTime", "");
      
      Serial.print("Logging tamper detection: " + tamperPath + "... ");
      if (Firebase.RTDB.setJSON(&fbdo, tamperPath, &tamperJson)) {
        Serial.println("Success");
      } else {
        Serial.println("Failed: " + fbdo.errorReason());
        storeLogToSD("TamperLogFailed:Time:" + tamperStartTime + " Error:" + fbdo.errorReason());
      }
    }
    tone(BUZZER_PIN, 1000);
    digitalWrite(LED_R_PIN, HIGH);
    digitalWrite(LED_G_PIN, LOW);
    digitalWrite(LED_B_PIN, LOW);
    displayMessage("Tamper Detected", "Door Locked", 0);
    tamperMessageDisplayed = true;
    firstActionOccurred = true;
    lastActivityTime = millis();
  }

  if (tamperActive) {
    digitalWrite(LED_R_PIN, HIGH);
    digitalWrite(LED_G_PIN, LOW);
    digitalWrite(LED_B_PIN, LOW);
    
    if (!buzzerActive || millis() - lastBuzzerToggle > 500) {
      tone(BUZZER_PIN, 1000);
      buzzerActive = true;
      lastBuzzerToggle = millis();
    }
    
    if (!tamperMessageDisplayed) {
      displayMessage("Tamper Detected", sdMode ? "Super Admin Req." : "Admin Card Req.", 0);
      tamperMessageDisplayed = true;
    }
  }

  // Tamper resolution
  if (tamperActive && millis() - lastRFIDTapTime >= RFID_DEBOUNCE_DELAY) {
    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      String uidStr = getUIDString();
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      String timestamp = getFormattedTime();
      lastRFIDTapTime = lastActivityTime = millis();
      
      if (uidStr == SUPER_ADMIN_UID) {
        String entry = "Tamper:Resolved Timestamp:" + timestamp + " Status:Resolved By:SuperAdmin:" + uidStr;
        storeLogToSD(entry);
        
        if (!sdMode && isConnected && Firebase.ready() && currentTamperAlertId.length() > 0) {
          String tamperPath = "/Alerts/Tamper/" + currentTamperAlertId;
          
          FirebaseJson updateJson;
          updateJson.set("status", "resolved");
          updateJson.set("resolvedBy", uidStr);
          updateJson.set("resolverName", "CIT-U SUPER ADMIN");
          updateJson.set("endTime", timestamp);
          updateJson.set("resolutionTime", timestamp);
          
          if (Firebase.RTDB.updateNode(&fbdo, tamperPath, &updateJson)) {
            Serial.println("Successfully updated tamper alert status");
          } else {
            Serial.println("Failed to update tamper alert: " + fbdo.errorReason());
          }
        }
        
        tamperActive = tamperDetected = tamperAlertTriggered = false;
        tamperResolved = true;
        tamperMessageDisplayed = buzzerActive = false;
        noTone(BUZZER_PIN);
        digitalWrite(LED_R_PIN, LOW);
        accessFeedback();
        displayMessage("Tamper Resolved", "CIT-U (Super Admin)", 2000);
        logSystemEvent("Tamper Resolved by Super Admin UID: " + uidStr);
        displayMessage("Ready. Tap your", "RFID Card!", 0);
        readyMessageShown = true;
        currentTamperAlertId = "";
      } 
      else if (!sdMode && isAdminUID(uidStr)) {
        std::map<String, String> userData = fetchUserDetails(uidStr);
        String name = userData.empty() ? "Admin" : userData["fullName"];
        String role = userData.empty() ? "admin" : userData["role"];
        
        if (isConnected && Firebase.ready() && currentTamperAlertId.length() > 0) {
          String tamperPath = "/Alerts/Tamper/" + currentTamperAlertId;
          
          FirebaseJson updateJson;
          updateJson.set("status", "resolved");
          updateJson.set("resolvedBy", uidStr);
          updateJson.set("resolverName", name);
          updateJson.set("resolverRole", role);
          updateJson.set("endTime", timestamp);
          updateJson.set("resolutionTime", timestamp);
          
          if (Firebase.RTDB.updateNode(&fbdo, tamperPath, &updateJson)) {
            Serial.println("Successfully updated tamper alert status");
          } else {
            Serial.println("Failed to update tamper alert: " + fbdo.errorReason());
          }
        }
        
        logAdminTamperStop(uidStr, timestamp);
        tamperActive = tamperDetected = tamperAlertTriggered = false;
        tamperResolved = true;
        tamperMessageDisplayed = buzzerActive = false;
        noTone(BUZZER_PIN);
        digitalWrite(LED_R_PIN, LOW);
        accessFeedback();
        displayMessage("Tamper Stopped", name + " (" + role + ")", 2000);
        logSystemEvent("Tamper Resolved by Admin UID: " + uidStr);
        displayMessage("Ready. Tap your", "RFID Card!", 0);
        readyMessageShown = true;
        currentTamperAlertId = "";
      } else {
        deniedFeedback();
        displayMessage("Tamper Detected", sdMode ? "Super Admin Req." : "Admin Card Req.", 2000);
        if (!buzzerActive) tone(BUZZER_PIN, 1000);
        displayMessage("Tamper Detected", "Door Locked", 0);
        tamperMessageDisplayed = true;
      }
    }
    return;
  }

  // Idle state
  if (!studentVerificationActive && !adminAccessActive && !classSessionActive &&
      !waitingForInstructorEnd && !tapOutPhase && !tamperActive) {
    if (!readyMessageShown && millis() - lastActivityTime >= 5000) {
      displayMessage("Ready. Tap your", "RFID Card!", 0);
      readyMessageShown = true;
      lastReadyPrint = millis();
    }
  } else {
    readyMessageShown = false;
  }

  // Admin PZEM logging
  if (adminAccessActive && millis() - lastPZEMLogTime >= 5000) {
    lastVoltage = max(pzem.voltage(), 0.0f);
    lastCurrent = max(pzem.current(), 0.0f);
    lastPower = max(pzem.power(), 0.0f);
    lastEnergy = max(pzem.energy(), 0.0f);
    lastFrequency = max(pzem.frequency(), 0.0f);
    lastPowerFactor = max(pzem.pf(), 0.0f);
    lastPZEMLogTime = millis();
  }

  // Student verification
  if (studentVerificationActive) {
    static unsigned long lastUpdate = 0;
    static int dotCount = 0;
    
    if (millis() - lastUpdate >= 1000) {
      String line1 = "Awaiting Student";
      String line2 = "Attendance";
      for (int i = 0; i < dotCount; i++) line2 += ".";
      displayMessage(line1, line2, 0);
      dotCount = (dotCount + 1) % 4;
      lastUpdate = millis();
    }

    if (millis() - lastRFIDTapTime >= RFID_DEBOUNCE_DELAY) {
      if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
        delay(50); yield();
        String uidStr = getUIDString();
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        String timestamp = getFormattedTime();

        lastRFIDTapTime = millis();
        lastActivityTime = millis();
        Serial.println("Detected UID during student verification: " + uidStr);

        if (firestoreStudents.find(uidStr) != firestoreStudents.end()) {
          logStudentToRTDB(uidStr, timestamp, 0.0, -1, "false", ""); // Initial tap-in
          Serial.println("Student UID " + uidStr + " logged, pending weight verification.");
          accessFeedback();
          presentCount++;

          int assignedSensorId = -1;
          if (!sdMode && isConnected && Firebase.ready()) {
            String path = "/Students/" + uidStr;
            if (Firebase.RTDB.getJSON(&fbdo, path)) {
              FirebaseJson* json = fbdo.jsonObjectPtr();
              FirebaseJsonData jsonData;
              if (json->get(jsonData, "assignedSensorId") && jsonData.typeNum == FirebaseJson::JSON_INT) {
                assignedSensorId = jsonData.intValue;
              }
            }
          }

          if (studentAssignedSensors.find(uidStr) == studentAssignedSensors.end()) {
            studentAssignedSensors[uidStr] = assignedSensorId;
          }

          if (assignedSensorId != -1) {
            displayMessage("Proceed to", "Sensor " + String(assignedSensorId + 1), 2000);
            Serial.println("Student UID " + uidStr + " directed to assigned Sensor " + String(assignedSensorId + 1));
          } else {
            displayMessage("Tap Any Sensor", "To Assign", 2000);
            Serial.println("No sensor assigned for UID " + uidStr + ". Waiting for any available sensor.");
          }

          weightConfirmationStartTime = millis();
          awaitingWeight = true;
        } else {
          deniedFeedback();
          Serial.println("UID " + uidStr + " not a student.");
          logUnregisteredUID(uidStr, timestamp);
        }
      }
    }

    if (millis() - studentVerificationStartTime >= Student_VERIFICATION_WINDOW) {
      studentVerificationActive = false;
      classSessionActive = true;
      classSessionStartTime = millis();
      digitalWrite(RELAY1, HIGH);
      Serial.println("Class session started. Door locked (Relay 1 HIGH).");
      
      // First show "Attendance Closed" message
      displayMessage("Attendance", "Closed", 2000);
      
      // After a short delay, show "Class Session Started" message
      delay(2000);
      displayMessage("Class Session", "Started", 2000);
      
      // Update class status in Firebase if connected
      if (!sdMode && isConnected && Firebase.ready()) {
        String statusPath = "/ClassStatus/" + currentSessionId;
        FirebaseJson statusJson;
        statusJson.set("Status", "In Session");
        statusJson.set("dateTime", getFormattedTime());
        Firebase.RTDB.updateNode(&fbdo, statusPath, &statusJson);
      }
      
      lastActivityTime = millis();
      lastReadyPrint = millis();
      readyMessageShown = false;
    }

    if (awaitingWeight && millis() - weightConfirmationStartTime >= WEIGHT_CONFIRMATION_TIMEOUT) {
      awaitingWeight = false;
      Serial.println("Weight confirmation timeout for pending students.");
    } else if (awaitingWeight) {
      bool sensorConnected = false;
      for (int i = 0; i < NUM_SENSORS; i++) {
        loadCells[i]->update();
        float testReading = loadCells[i]->getData();
        if (testReading >= 0 && testReading < 500) {
          sensorConnected = true;
          break;
        }
      }

      if (sensorConnected) {
        for (int i = 0; i < NUM_SENSORS; i++) {
          // Take multiple readings to improve accuracy and use yield() to prevent WDT timeouts
          loadCells[i]->update();
          yield();
          
          // Get first reading
          float firstWeight = loadCells[i]->getData();
          yield();
          
          // Check if the reading is within reasonable range before continuing
          if (firstWeight >= 30.0 && firstWeight < 500) {
            // Get a second reading for confirmation
            loadCells[i]->update();
            yield();
            float finalWeight = loadCells[i]->getData();
            
            // Only proceed if both readings are close enough (stable weight)
            if (abs(firstWeight - finalWeight) < 0.8) {
              for (auto& student : studentAssignedSensors) {
                String uidStr = student.first;
                int assignedSensorId = student.second;
                
                // Skip students who already had a failed verification attempt
                if (student.second == -2) {
                  // Instead of skipping completely, check if they're now at the correct sensor
                  // Get their originally assigned sensor ID from database or configuration
                  int originalAssignedSensor = -1;
                  if (!sdMode && isConnected && Firebase.ready()) {
                    String path = "/Students/" + uidStr;
                    if (Firebase.RTDB.getJSON(&fbdo, path)) {
                      FirebaseJson* json = fbdo.jsonObjectPtr();
                      FirebaseJsonData jsonData;
                      if (json->get(jsonData, "assignedSensorId") && jsonData.typeNum == FirebaseJson::JSON_INT) {
                        originalAssignedSensor = jsonData.intValue;
                      }
                    }
                  }
                  
                  // If they're now at their correct sensor, allow verification
                  if (originalAssignedSensor == i) {
                    String timestamp = getFormattedTime();
                    studentAssignedSensors[uidStr] = i; // Assign to correct sensor
                    logStudentToRTDB(uidStr, timestamp, finalWeight, i, "true", ""); // Weight confirmed, no timeout
                    accessFeedback();
                    Serial.println("Recovery: Student " + uidStr + " verified at correct Sensor " + String(i + 1) + " after previous failed attempt");
                    displayMessage("Recovery OK", "Sensor " + String(i + 1), 2000);
                    break;
                  }
                  continue; // Still at wrong sensor, skip
                }

                if (assignedSensorId == -1 || assignedSensorId == i) {
                  String timestamp = getFormattedTime();
                  studentAssignedSensors[uidStr] = i; // Assign or confirm sensor
                  logStudentToRTDB(uidStr, timestamp, finalWeight, i, "true", ""); // Weight confirmed, no timeout
                  accessFeedback();
                  Serial.println("Assigned/Verified Sensor " + String(i + 1) + " to UID: " + uidStr + " with weight: " + String(finalWeight, 2) + " kg");
                  displayMessage("Weight Confirmed", "Sensor " + String(i + 1), 2000);
                  break;
                } else if (i != assignedSensorId) {
                  // Mark this student as temporarily failed verification - but can be recovered
                  studentAssignedSensors[uidStr] = -2; // Special code for verification failed but recoverable
                  String timestamp = getFormattedTime();
                  // Log as pending due to wrong sensor
                  logStudentToRTDB(uidStr, timestamp, 0.0, -2, "false", "");
                  deniedFeedback();
                  displayMessage("Wrong Sensor!", "Go to Sensor " + String(assignedSensorId + 1), 2000);
                  Serial.println("UID " + uidStr + " on wrong sensor. Expected Sensor " + String(assignedSensorId + 1) + ". Can still recover.");
                }
              }
            }
          }
        }
      } else {
        Serial.println("No weight sensor connected. Awaiting weight.");
      }

      bool allVerified = true;
      for (auto& student : studentAssignedSensors) {
        if (student.second == -1) {
          allVerified = false;
          break;
        }
      }
      if (allVerified) {
        awaitingWeight = false;
      }
    }
    return;
  }

  // Tap-out phase
  if (tapOutPhase) {
    static bool classEndedShown = false;
    static unsigned long classEndedStart = 0;
    
    if (!classEndedShown) {
      if (classEndedStart == 0) {
        classEndedStart = millis();
        displayMessage("Class Ended", "", 4000);
      } else if (millis() - classEndedStart >= 4000) {
        classEndedShown = true;
        if (!sdMode && isConnected && Firebase.ready()) {
          String summaryPath = "/AttendanceSummary/" + currentSessionId + "/totalAttendees";
          if (Firebase.RTDB.getInt(&fbdo, summaryPath)) {
            presentCount = fbdo.intData();
          }
        }
      }
      return;
    }

    static unsigned long lastAttendeeUpdate = 0;
    if (millis() - lastAttendeeUpdate >= 1000) {
      displayMessage("Remaining:", String(presentCount), 0);
      lastAttendeeUpdate = millis();
    }

    if (millis() - lastRFIDTapTime >= RFID_DEBOUNCE_DELAY && 
        rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      String uidStr = getUIDString();
      rfid.PICC_HaltA();
      rfid.PCD_StopCrypto1();
      String timestamp = getFormattedTime();
      lastRFIDTapTime = lastActivityTime = millis();

      if (firestoreStudents.find(uidStr) != firestoreStudents.end()) {
        // Accept ALL student taps during tap-out phase, regardless of status
        // Update student status in database
        String status = "Absent";
        int sensorId = -1;
        
        // If they were actually present (verified at correct sensor)
        if (studentAssignedSensors.find(uidStr) != studentAssignedSensors.end() && 
            studentAssignedSensors[uidStr] >= 0) {
          status = "Present";
          sensorId = studentAssignedSensors[uidStr];
        }
        
        // Log the tap-out, regardless of verification status
        logStudentToRTDB(uidStr, timestamp, 0.0, sensorId, "true", timestamp);
        
        // Visual/audio feedback (green for all tap-outs during this phase)
        digitalWrite(LED_G_PIN, HIGH);
        tone(BUZZER_PIN, 1000, 200);
        delay(200); yield();
        digitalWrite(LED_G_PIN, LOW);
        
        // Decrease counter for all taps
        presentCount--;
        if (studentAssignedSensors.find(uidStr) != studentAssignedSensors.end()) {
          studentAssignedSensors.erase(uidStr);
        }
        
        // Update totalAttendees in Firebase
        if (!sdMode && isConnected && Firebase.ready()) {
          String summaryPath = "/AttendanceSummary/" + currentSessionId;
          FirebaseJson summaryJson;
          summaryJson.set("totalAttendees", presentCount);
          Firebase.RTDB.updateNode(&fbdo, summaryPath, &summaryJson);
        }
        
        displayMessage("Tapped Out", "Remaining: " + String(presentCount), 2000);
        
        // If no more students remain, transition to instructor tap-out phase
        if (presentCount <= 0) {
          // All students have tapped out, prompt instructor to end session
          digitalWrite(LED_G_PIN, HIGH);
          tone(BUZZER_PIN, 1000, 500);
          delay(500); yield();
          digitalWrite(LED_G_PIN, LOW);
          
          // Update class status in Firebase to indicate pending instructor confirmation
          if (!sdMode && isConnected && Firebase.ready()) {
            String statusPath = "/ClassStatus/" + currentSessionId;
            FirebaseJson statusJson;
            statusJson.set("Status", "Pending Instructor");
            statusJson.set("dateTime", getFormattedTime());
            Firebase.RTDB.updateNode(&fbdo, statusPath, &statusJson);
          }
          
          // Show message prompting for instructor (same UID) to tap to finalize
          displayMessage("All Students Out", "Instructor Tap Now", 3000);
          waitingForInstructorEnd = true;
          tapOutPhase = false;  // Exit tap-out phase properly
        }
      } else if (uidStr == lastInstructorUID) {
        // Instructor is tapping to end the session
        
        // Before ending the session, mark any students with -2 status as absent
        for (auto& student : studentAssignedSensors) {
          // Mark all remaining students as absent regardless of status
          String studentUid = student.first;
          // Update status to permanently absent in database
          logStudentToRTDB(studentUid, timestamp, 0.0, -3, "false", ""); // Special code -3 for permanent absence
          Serial.println("Student " + studentUid + " marked absent - didn't tap out before instructor ended session");
          yield(); // Add yield to prevent watchdog reset during iteration
        }
        
        // Get PZEM data and store it in room node
        if (tapOutSchedule.roomName.length() > 0) {
          float voltage = pzem.voltage();
          float current = pzem.current();
          float power = pzem.power();
          float energy = pzem.energy();
          float frequency = pzem.frequency();
          float powerFactor = pzem.pf();
          
          yield(); // Add yield after PZEM readings
        
          if (isnan(voltage) || voltage < 0) voltage = 0.0;
          if (isnan(current) || current < 0) current = 0.0;
          if (isnan(power) || power < 0) power = 0.0;
          if (isnan(energy) || energy < 0) energy = 0.0;
          if (isnan(frequency) || frequency < 0) frequency = 0.0;
          if (isnan(powerFactor) || powerFactor < 0) powerFactor = 0.0;
          
          // Store PZEM data under the room name
          String roomPath = "/Rooms/" + tapOutSchedule.roomName;
          FirebaseJson roomPzemJson;
          roomPzemJson.set("voltage", String(voltage, 1));
          roomPzemJson.set("current", String(current, 2));
          roomPzemJson.set("power", String(power, 1));
          roomPzemJson.set("energy", String(energy, 2));
          roomPzemJson.set("frequency", String(frequency, 1));
          roomPzemJson.set("powerFactor", String(powerFactor, 2));
          roomPzemJson.set("timestamp", timestamp);
          roomPzemJson.set("sessionId", currentSessionId);
          roomPzemJson.set("instructorUID", uidStr);
          roomPzemJson.set("instructorName", firestoreTeachers[uidStr]["fullName"]);
          roomPzemJson.set("subject", tapOutSchedule.subject);
          roomPzemJson.set("subjectCode", tapOutSchedule.subjectCode);
          roomPzemJson.set("section", tapOutSchedule.section);
          roomPzemJson.set("sessionStart", tapOutSchedule.startTime);
          roomPzemJson.set("sessionEnd", tapOutSchedule.endTime);
          roomPzemJson.set("date", timestamp.substring(0, 10));
          
          yield(); // Add yield after JSON preparation
          
          // Also store in instructor's rooms
          String instructorRoomPath = "/Instructors/" + uidStr + "/Rooms/" + tapOutSchedule.roomName;
          
          if (!sdMode && isConnected && Firebase.ready()) {
            // Store under Rooms node
            Serial.println("Storing PZEM data under room path: " + roomPath);
            if (Firebase.RTDB.setJSON(&fbdo, roomPath, &roomPzemJson)) {
              Serial.println("PZEM data logged to room successfully");
            } else {
              Serial.println("Failed to log PZEM data to room: " + fbdo.errorReason());
              storeLogToSD("RoomPZEMLogFailed:UID:" + uidStr + " Room:" + tapOutSchedule.roomName + " Time:" + timestamp + " Error:" + fbdo.errorReason());
            }
            
            yield(); // Add yield between Firebase operations
            
            // Store under instructor's rooms
            Serial.println("Storing PZEM data under instructor's room path: " + instructorRoomPath);
            if (Firebase.RTDB.setJSON(&fbdo, instructorRoomPath, &roomPzemJson)) {
              Serial.println("PZEM data logged to instructor room successfully");
            } else {
              Serial.println("Failed to log PZEM data to instructor room: " + fbdo.errorReason());
            }
            
            yield(); // Add yield between Firebase operations
            
            // Update class status to indicate session is fully ended
            String instructorPath = "/Instructors/" + uidStr;
            FirebaseJson classStatusJson;
            classStatusJson.set("Status", "Class Ended");
            classStatusJson.set("dateTime", timestamp);
            
            // Store schedule information in ClassStatus
            FirebaseJson scheduleJson;
            scheduleJson.set("day", tapOutSchedule.day);
            scheduleJson.set("startTime", tapOutSchedule.startTime);
            scheduleJson.set("endTime", tapOutSchedule.endTime);
            scheduleJson.set("subject", tapOutSchedule.subject);
            scheduleJson.set("subjectCode", tapOutSchedule.subjectCode);
            scheduleJson.set("section", tapOutSchedule.section);
            
            yield(); // Add yield during JSON preparation
            
            FirebaseJson roomNameJson;
            roomNameJson.set("name", tapOutSchedule.roomName);
            
            classStatusJson.set("schedule/day", tapOutSchedule.day);
            classStatusJson.set("schedule/startTime", tapOutSchedule.startTime);
            classStatusJson.set("schedule/endTime", tapOutSchedule.endTime);
            classStatusJson.set("schedule/subject", tapOutSchedule.subject);
            classStatusJson.set("schedule/subjectCode", tapOutSchedule.subjectCode);
            classStatusJson.set("schedule/section", tapOutSchedule.section);
            classStatusJson.set("schedule/roomName/name", tapOutSchedule.roomName);
            
            yield(); // Add yield after JSON preparation
            
            String statusPath = instructorPath + "/ClassStatus";
            if (Firebase.RTDB.updateNode(&fbdo, statusPath, &classStatusJson)) {
              Serial.println("Class status updated to 'Class Ended'");
            } else {
              Serial.println("Failed to update class status: " + fbdo.errorReason());
            }
            
            yield(); // Add yield after Firebase operation
          } else {
            // Store to SD for later sync
            String pzemEntry = "PZEM:UID:" + uidStr + " Room:" + tapOutSchedule.roomName + 
                              " Time:" + timestamp + " V:" + String(voltage, 1);
            storeLogToSD(pzemEntry);
            yield(); // Add yield after SD write
          }
        }
        
        logInstructor(uidStr, timestamp, "EndSession");
        yield(); // Add yield after logging
        
        // Reset system state and display ready message
        tapOutPhase = false;
        classSessionActive = false;
        waitingForInstructorEnd = false;
        isInstructorLogged = false;
        presentCount = 0;
        
        // Display confirmation and return to ready state
        displayMessage("Session Finalized", "Data Saved", 3000);
        // Instead of a straight delay, use a safer approach with yields
        unsigned long startTime = millis();
        while (millis() - startTime < 3000) {
          delay(100);  // Process in smaller chunks
          yield();     // Give the watchdog timer a chance to reset
        }
        
        displayMessage("Ready. Tap your", "RFID Card!", 0);
        
        return;
      }
    }
  }

  // Offline display
  static unsigned long lastDotUpdateOffline = 0;
  static int dotCountOffline = 0;
  if (sdMode && relaysActive && millis() - doorOpenTime < 30000 && millis() - lastRFIDTapTime >= 1000) {
    if (millis() - lastDotUpdateOffline >= 1000) {
      String line1 = "Tap your ID";
      for (int i = 0; i < dotCountOffline; i++) line1 += ".";
      displayMessage(line1, lastTappedUID.length() > 0 ? "UID: " + lastTappedUID : "No tap yet", 0);
      dotCountOffline = (dotCountOffline + 1) % 4;
      lastDotUpdateOffline = millis();
    }
  }

  if (sdMode && (superAdminSessionActive || (relaysActive && millis() - doorOpenTime >= 30000)) && digitalRead(RELAY1) == LOW) {
    digitalWrite(RELAY1, HIGH);
    relayActive = false;
    displayMessage(superAdminSessionActive ? "Class Session" : "Class In Session", "", 500);
  }
  yield();

  // Standard RFID Card Detection (added back)
  static unsigned long lastRFIDCheckTime = 0;
  
  // Check RFID reader health periodically
  if (millis() - lastRFIDCheckTime >= 10000) { // Every 10 seconds
    byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
    if (version == 0 || version == 0xFF) {
      // Reader may be unresponsive, reinitialize
      Serial.println("RFID reader may be unresponsive. Reinitializing...");
      rfid.PCD_Init();
      delay(50);
      rfid.PCD_SetAntennaGain(rfid.RxGain_max);
    }
    lastRFIDCheckTime = millis();
  }
  
  // Actual card detection
  if (millis() - lastRFIDTapTime >= RFID_DEBOUNCE_DELAY) {
    yield(); // Prevent watchdog reset before RFID operations
    
    // First check if a card is present
    if (rfid.PICC_IsNewCardPresent()) {
      // Small delay to ensure stable reading
      delayMicroseconds(500);
      yield(); // Prevent watchdog reset after delay
      
      // Now try to read the card serial data
      if (rfid.PICC_ReadCardSerial()) {
        String uidStr = getUIDString();
        String timestamp = getFormattedTime();
        lastRFIDTapTime = lastActivityTime = millis();
        
        // Only print UID details the first time we see this card in this session
        if (uidDetailsPrinted.find(uidStr) == uidDetailsPrinted.end() || !uidDetailsPrinted[uidStr]) {
          Serial.println("Card detected: UID = " + uidStr);
          uidDetailsPrinted[uidStr] = true;
        }
        
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        yield(); // Prevent watchdog reset before processing card
        
        // Process the card
        if (isRegisteredUID(uidStr)) {
          if (uidStr == SUPER_ADMIN_UID) {
            // Special handling for the hardcoded Super Admin
            yield(); // Prevent watchdog reset
            logSuperAdmin(uidStr, timestamp);
          } else if (firestoreTeachers.find(uidStr) != firestoreTeachers.end()) {
            // Normal teacher logic
            String role = firestoreTeachers[uidStr]["role"];
            if (role.length() == 0) role = "instructor";
            if (role.equalsIgnoreCase("instructor")) {
              yield(); // Prevent watchdog reset before logging instructor
              logInstructor(uidStr, timestamp, "Access");
            }
          } else if (firestoreStudents.find(uidStr) != firestoreStudents.end()) {
            // Student logic would go here based on your existing code
            yield(); // Prevent watchdog reset for student handling
          }
        } else if (isAdminUID(uidStr)) {
          yield(); // Prevent watchdog reset before admin access
          logAdminAccess(uidStr, timestamp);
        } else {
          yield(); // Prevent watchdog reset before unregistered handling
          logUnregisteredUID(uidStr, timestamp);
        }
        
        yield(); // Final yield after processing card
      }
    }
  }
}

// Get instructor's schedule for a specific day, regardless of time
ScheduleInfo getInstructorScheduleForDay(String uid, String dateStr) {
  ScheduleInfo schedule = {false, "", "", "", "", "", "", ""};
  
  yield(); // Add yield at start of function
  
  if (firestoreTeachers.find(uid) == firestoreTeachers.end()) {
    Serial.println("Instructor UID not found in firestoreTeachers: " + uid);
    return schedule;
  }
  
  // Get day of the week from date (dateStr format: YYYY_MM_DD)
  int year = dateStr.substring(0, 4).toInt();
  int month = dateStr.substring(5, 7).toInt();
  int day = dateStr.substring(8, 10).toInt();
  
  // Calculate day of week using Zeller's Congruence
  if (month < 3) {
    month += 12;
    year--;
  }
  int h = (day + (13 * (month + 1)) / 5 + year + year / 4 - year / 100 + year / 400) % 7;
  
  yield(); // Add yield before array access
  
  // Convert h to day name (h=0 is Saturday in Zeller's)
  const String dayNames[7] = {"Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"};
  String dayOfWeek = dayNames[h];
  
  // Get schedule for this day regardless of time
  if (firestoreTeachers[uid].count("schedules") > 0) {
    String schedulesStr = firestoreTeachers[uid]["schedules"];
    FirebaseJsonArray schedulesArray;
    
    yield(); // Add yield before JSON parsing
    
    if (schedulesArray.setJsonArrayData(schedulesStr)) {
      // Check if this is a valid schedule day
      for (size_t i = 0; i < schedulesArray.size(); i++) {
        // Add yield every few iterations to prevent watchdog timeout
        if (i % 3 == 0) yield();
        
        FirebaseJsonData jsonData;
        if (schedulesArray.get(jsonData, i)) {
          FirebaseJson scheduleJson;
          if (scheduleJson.setJsonData(jsonData.stringValue)) {
            FirebaseJsonData dayData, startData, endData, roomData, subjectData, codeData, sectionData;
            
            if (scheduleJson.get(dayData, "day") && dayData.stringValue.equalsIgnoreCase(dayOfWeek)) {
              schedule.day = dayData.stringValue;
              
              if (scheduleJson.get(startData, "startTime")) {
                schedule.startTime = startData.stringValue;
              }
              
              if (scheduleJson.get(endData, "endTime")) {
                schedule.endTime = endData.stringValue;
              }
              
              if (scheduleJson.get(roomData, "roomName")) {
                schedule.roomName = roomData.stringValue;
              }
              
              if (scheduleJson.get(subjectData, "subject")) {
                schedule.subject = subjectData.stringValue;
              }
              
              if (scheduleJson.get(codeData, "subjectCode")) {
                schedule.subjectCode = codeData.stringValue;
              }
              
              if (scheduleJson.get(sectionData, "section")) {
                schedule.section = sectionData.stringValue;
              }
              
              schedule.isValid = true;
              Serial.println("Found instructor schedule for " + dayOfWeek + ": " + 
                            schedule.startTime + "-" + schedule.endTime + 
                            " in room " + schedule.roomName);
              
              // Take the latest class on this day (if multiple)
              // This is especially relevant for instructors ending class early
              continue;
            }
          }
        }
      }
    }
  }
  
  yield(); // Add yield before return
  return schedule;
}

// Process RFID card detection
void processRFIDCard(String uidStr) {
  // Only print details the first time we see this card in a session
  if (uidDetailsPrinted.find(uidStr) == uidDetailsPrinted.end() || !uidDetailsPrinted[uidStr]) {
    Serial.println("Card detected: UID = " + uidStr);
    // Mark as printed to avoid repeated logging
    uidDetailsPrinted[uidStr] = true;
  }
  
  String timestamp = getFormattedTime();
  lastRFIDTapTime = lastActivityTime = millis();
  
  // Example: Check if this is a registered UID
  if (isRegisteredUID(uidStr)) {
    // Handle based on whether this is a teacher or student
    if (uidStr == SUPER_ADMIN_UID) {
      // Special handling for the hardcoded Super Admin
      yield(); // Prevent watchdog reset
      logSuperAdmin(uidStr, timestamp);
    } else if (firestoreTeachers.find(uidStr) != firestoreTeachers.end()) {
      // Normal teacher logic
      String role = firestoreTeachers[uidStr]["role"];
      if (role.length() == 0) role = "instructor";
      if (role.equalsIgnoreCase("instructor")) {
        yield(); // Prevent watchdog reset
        logInstructor(uidStr, timestamp, "Access");
      }
    } else if (firestoreStudents.find(uidStr) != firestoreStudents.end()) {
      // Student logic would go here based on your existing code
      yield(); // Prevent watchdog reset
    }
  } else if (isAdminUID(uidStr)) {
    yield(); // Prevent watchdog reset
    logAdminAccess(uidStr, timestamp);
  } else {
    yield(); // Prevent watchdog reset
    logUnregisteredUID(uidStr, timestamp);
  }
}

// SD card initialization function
void initSDCard() {
  Serial.println("Initializing SD card...");
  fsSPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  pinMode(SD_CS, OUTPUT);
  
  if (!SD.begin(SD_CS, fsSPI, 4000000)) {
    Serial.println("⚠️ SD Card initialization failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SD Card Fail");
    tone(BUZZER_PIN, 700, 1000);
    // Not entering an infinite loop here to allow caller to handle the failure
    return;
  }
  
  Serial.println("✅ SD Card initialized.");
  sdInitialized = true;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SD Card Ready");
}

// Add the new logSuperAdmin function
void logSuperAdmin(String uid, String timestamp) {
  Serial.println("Processing Super Admin UID: " + uid);
  
  // SD log entry
  String entry = "SuperAdmin:UID:" + uid + " Time:" + timestamp + " Action:Access";
  storeLogToSD(entry);
  
  // Admin-like behavior
  bool isEntry = !adminAccessActive;
  
  // Assign room ID BEFORE creating the AccessLogs entry
  if (isEntry) {
    assignedRoomId = assignRoomToAdmin(uid);
  }
  
  // Sanitize timestamp for Firebase paths
  String sanitizedTimestamp = timestamp;
  sanitizedTimestamp.replace(" ", "_");
  sanitizedTimestamp.replace(":", "");
  
  // Firebase logging
  if (!sdMode && isConnected && Firebase.ready()) {
    // Update Admin node with Super Admin details
    String adminPath = "/Admin/" + uid;
    FirebaseJson adminJson;
    
    // Use hardcoded data for Super Admin
    adminJson.set("fullName", "CIT-U SUPER ADMIN");
    adminJson.set("role", "superadmin");  // Note the special role
    adminJson.set("email", "superadmin@cit-u.edu");
    adminJson.set("department", "Administration");
    adminJson.set("createdAt", "2023-01-01T00:00:00.000Z");
    adminJson.set("rfidUid", uid);
    
    // Create access log in the separate AccessLogs node structure
    String accessLogPath = "/AccessLogs/" + uid + "/" + sanitizedTimestamp;
    
    FirebaseJson accessJson;
    accessJson.set("action", isEntry ? "entry" : "exit");
    accessJson.set("fullName", "CIT-U SUPER ADMIN");
    accessJson.set("role", "superadmin");
    accessJson.set("timestamp", sanitizedTimestamp);
    
    // Add room details if available - add for both entry and exit
    if (assignedRoomId != "" && firestoreRooms.find(assignedRoomId) != firestoreRooms.end()) {
      FirebaseJson roomJson;
      roomJson.set("name", firestoreRooms[assignedRoomId].at("name"));
      
      // Fix: Check if map contains the key, otherwise use default value
      String building = "CIT-U Building";
      if (firestoreRooms[assignedRoomId].find("building") != firestoreRooms[assignedRoomId].end()) {
        building = firestoreRooms[assignedRoomId].at("building");
      }
      roomJson.set("building", building);
      
      String floor = "1st";
      if (firestoreRooms[assignedRoomId].find("floor") != firestoreRooms[assignedRoomId].end()) {
        floor = firestoreRooms[assignedRoomId].at("floor");
      }
      roomJson.set("floor", floor);
      
      roomJson.set("status", isEntry ? "occupied" : "available");
      
      String type = "classroom";
      if (firestoreRooms[assignedRoomId].find("type") != firestoreRooms[assignedRoomId].end()) {
        type = firestoreRooms[assignedRoomId].at("type");
      }
      roomJson.set("type", type);
      
      accessJson.set("roomDetails", roomJson);
    }
    
    // If this is an exit tap, add PZEM data if available
    if (!isEntry) {
      // Add PZEM data for exit logs
      float voltage = pzem.voltage();
      float current = pzem.current();
      float power = pzem.power();
      float energy = pzem.energy();
      float frequency = pzem.frequency();
      float pf = pzem.pf();
      
      if (voltage > 0) {
        FirebaseJson pzemJson;
        pzemJson.set("voltage", voltage);
        pzemJson.set("current", current);
        pzemJson.set("power", power);
        pzemJson.set("energy", energy);
        pzemJson.set("frequency", frequency);
        pzemJson.set("powerFactor", pf);
        
        accessJson.set("pzemData", pzemJson);
      }
    }
    
    // Update the Admin node
    if (Firebase.RTDB.setJSON(&fbdo, adminPath, &adminJson)) {
      Serial.println("Super Admin details updated in RTDB at " + adminPath);
    } else {
      Serial.println("Failed to update Super Admin details: " + fbdo.errorReason());
    }
    
    // Update the AccessLogs node
    if (Firebase.RTDB.setJSON(&fbdo, accessLogPath, &accessJson)) {
      Serial.println("Super Admin access log created at " + accessLogPath);
    } else {
      Serial.println("Failed to create Super Admin access log: " + fbdo.errorReason());
    }
  }
  
  // Handle entry/exit behavior similar to admin
  if (isEntry) {
    activateRelays();
    adminAccessActive = true;
    lastAdminUID = uid;
    
    if (assignedRoomId == "") {
      displayMessage("No Room Available", "For Super Admin", 2000);
    } else {
      if (firestoreRooms.find(assignedRoomId) != firestoreRooms.end()) {
        String roomName = firestoreRooms[assignedRoomId].at("name");
        displayMessage("Inspecting Room", roomName, 2000);
      }
    }
    
    accessFeedback();
    logSystemEvent("Relay Activated for Super Admin: " + uid);
    displayMessage("Super Admin", "Access Granted", 2000);
    displayMessage("Super Admin Mode", "Active", 0);
  } else if (uid == lastAdminUID) {
    // This is an exit tap
    deactivateRelays();
    adminAccessActive = false;
    lastAdminUID = "";
    
    // Update room status if needed
    if (assignedRoomId != "" && !sdMode && isConnected && Firebase.ready()) {
      String roomPath = "rooms/" + assignedRoomId;
      FirebaseJson contentJson;
      contentJson.set("fields/status/stringValue", "available");
      
      if (Firebase.Firestore.patchDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", roomPath.c_str(), contentJson.raw(), "status")) {
        Serial.println("Room status updated to 'available' in Firestore: " + assignedRoomId);
      } else {
        Serial.println("Failed to update room status in Firestore: " + firestoreFbdo.errorReason());
      }
    }
    
    assignedRoomId = "";
    accessFeedback();
    logSystemEvent("Relay Deactivated for Super Admin: " + uid);
    displayMessage("Super Admin", "Exit Processed", 2000);
    displayMessage("Ready. Tap your", "RFID Card!", 0);
  } else {
    // Different admin is already active
    deniedFeedback();
    displayMessage("Another Admin", "Session Active", 2000);
  }
  
  // Update timers
  firstActionOccurred = true;
  lastActivityTime = millis();
  lastReadyPrint = millis();
}