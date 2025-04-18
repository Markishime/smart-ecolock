#ifndef OPTIMIZATION_HELPERS_H
#define OPTIMIZATION_HELPERS_H

// Generic function to fetch data from Firestore
bool fetchFirestoreCollection(const char* collection, FirebaseJson& jsonResult) {
  if (sdMode || !isConnected || !Firebase.ready()) {
    return false;
  }
  
  feedWatchdog();
  
  if (Firebase.Firestore.getDocument(&firestoreFbdo, FIRESTORE_PROJECT_ID, "", collection, "")) {
    jsonResult.setJsonData(firestoreFbdo.payload());
    return true;
  }
  return false;
}

// Generic function to write to RTDB
bool writeToRTDB(const String& path, FirebaseJson& json, bool logFailure = true) {
  if (sdMode || !isConnected || !Firebase.ready()) {
    return false;
  }
  
  feedWatchdog();
  
  if (Firebase.RTDB.setJSON(&fbdo, path, &json)) {
    return true;
  } else if (logFailure) {
    Serial.println("Failed to write to RTDB: " + fbdo.errorReason());
  }
  return false;
}

// Generic function to update a node in RTDB
bool updateRTDBNode(const String& path, FirebaseJson& json) {
  if (sdMode || !isConnected || !Firebase.ready()) {
    return false;
  }
  
  feedWatchdog();
  
  if (Firebase.RTDB.updateNode(&fbdo, path, &json)) {
    return true;
  } else {
    Serial.println("Failed to update node in RTDB: " + fbdo.errorReason());
    return false;
  }
}

// Function to process Firebase JSON data with fields
bool getFirebaseField(FirebaseJson& json, const char* field, String& result) {
  FirebaseJsonData jsonData;
  if (json.get(jsonData, field)) {
    result = jsonData.stringValue;
    return true;
  }
  return false;
}

// Optimized function to extract teacher/student data from Firestore document
void extractPersonData(FirebaseJson& doc, std::map<String, String>& data) {
  FirebaseJsonData fieldData;
  
  // Extract common fields with default values
  if (doc.get(fieldData, "fields/fullName/stringValue")) {
    data["fullName"] = fieldData.stringValue;
  } else {
    data["fullName"] = "Unknown";
  }
  
  if (doc.get(fieldData, "fields/email/stringValue")) {
    data["email"] = fieldData.stringValue;
  }
  
  if (doc.get(fieldData, "fields/role/stringValue")) {
    data["role"] = fieldData.stringValue;
  }
  
  if (doc.get(fieldData, "fields/schedules/arrayValue")) {
    data["schedules"] = fieldData.stringValue;
  } else {
    data["schedules"] = "[]";
  }
}

// Optimized function to fetch and process teachers/students
void fetchAndProcessCollection(const char* collection, 
                              std::map<String, std::map<String, String>>& resultMap,
                              const char* role = nullptr) {
  if (sdMode || !isConnected || !Firebase.ready()) {
    return;
  }
  
  Serial.println("Fetching " + String(collection) + " from Firestore...");
  
  FirebaseJson json;
  if (!fetchFirestoreCollection(collection, json)) {
    Serial.println("Failed to fetch " + String(collection) + " from Firestore");
    return;
  }
  
  // Process the documents
  FirebaseJsonData jsonData;
  if (json.get(jsonData, "documents") && jsonData.type == "array") {
    FirebaseJsonArray arr;
    jsonData.getArray(arr);
    
    for (size_t i = 0; i < arr.size(); i++) {
      FirebaseJsonData docData;
      arr.get(docData, i);
      FirebaseJson doc;
      doc.setJsonData(docData.to<String>());
      
      FirebaseJsonData fieldData;
      if (doc.get(fieldData, "fields/rfidUid/stringValue")) {
        String uid = fieldData.stringValue;
        if (uid.length() > 0) {
          std::map<String, String> personData;
          extractPersonData(doc, personData);
          
          // Set default role if provided and not already present
          if (role && personData.find("role") == personData.end()) {
            personData["role"] = role;
          }
          
          resultMap[uid] = personData;
        }
      }
      feedWatchdog();
    }
  }
  
  Serial.println("Fetched " + String(resultMap.size()) + " " + String(collection) + " from Firestore");
}

#endif // OPTIMIZATION_HELPERS_H 