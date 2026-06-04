/* ==========================================================================
   GEOLYTIX LANDSLIDE INTELLIGENCE MATRIX — APPLICATION CORE MOTOR
   ========================================================================== */

// 1. DATABASE ROUTING AND ENCRYPTION REGISTRATION KEYS
const firebaseConfig = {
  apiKey: "AIzaSyBz4BdibM1vhvyo9oucAN_WUnxbM5cBcv4",
  authDomain: "esp32-test-63b81.firebaseapp.com",
  databaseURL: "https://esp32-test-63b81-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esp32-test-63b81",
  storageBucket: "esp32-test-63b81.firebasestorage.app",
  messagingSenderId: "1075020330165",
  appId: "1:1075020330165:web:31b0e9e6a4cbc01e59bafc"
};

// Initialize Firebase Core Engine using Compatibility Layer
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. DOM INTERFACE ELEMENTS REGISTRATION
const uiElements = {
  connectionLabel: document.getElementById("connectionLabel"),
  pulseDot:        document.getElementById("pulseDot"),
  lastUpdate:      document.getElementById("lastUpdate"),
  alertBanner:     document.getElementById("alertBanner"),
  alertIcon:       document.getElementById("alertIcon"),
  alertLevel:      document.getElementById("alertLevel"),
  alertMessage:    document.getElementById("alertMessage"),
  alertBadge:      document.getElementById("alertBadge"),
  kalmanX:         document.getElementById("kalmanX"),
  kalmanY:         document.getElementById("kalmanY"),
  gyroZ:           document.getElementById("gyroZ"),
  gaugeArcX:       document.getElementById("gaugeArcX"),
  gaugeArcY:       document.getElementById("gaugeArcY"),
  gaugeArcZ:       document.getElementById("gaugeArcZ"),
  moisturePct:     document.getElementById("moisturePct"),
  moistureRaw:     document.getElementById("moistureRaw"),
  moistureBarFill: document.getElementById("moistureBarFill"),
  gpsLat:          document.getElementById("gpsLat"),
  gpsLon:          document.getElementById("gpsLon"),
  gpsStatus:       document.getElementById("gpsStatus"),
  mapsLink:        document.getElementById("mapsLink"),
  strainTop:       document.getElementById("strainTop"),
  strainBot:       document.getElementById("strainBot"),
  strainTopFill:   document.getElementById("strainTopFill"),
  strainBotFill:   document.getElementById("strainBotFill"),
  pollBtn:         document.getElementById("pollBtn"),
  pollStatusDot:   document.getElementById("pollStatusDot"),
  pollStatusText:  document.getElementById("pollStatusText"),
  pollHistoryList: document.getElementById("pollHistoryList")
};

// 3. TIME-SERIES CONFIGURATION ENGINE (CHART.JS)
const rollingSampleLimit = 30;
let timestampLabels = [];
let datasetKalmanX = [];
let datasetKalmanY = [];
let datasetStrainTop = [];
let datasetStrainBot = [];

// Initialize Orientation Line Graphs
const tiltChartCtx = document.getElementById("tiltChart").getContext("2d");
const tiltChart = new Chart(tiltChartCtx, {
  type: 'line',
  data: {
    labels: timestampLabels,
    datasets: [
      { label: 'Kalman X', data: datasetKalmanX, borderColor: '#00ff66', borderWidth: 2, tension: 0.2, pointRadius: 1, backgroundColor: 'rgba(0, 255, 102, 0.05)', fill: true },
      { label: 'Kalman Y', data: datasetKalmanY, borderColor: '#00e1ff', borderWidth: 2, tension: 0.2, pointRadius: 1, backgroundColor: 'rgba(0, 225, 255, 0.05)', fill: true }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { color: '#1a233a' }, ticks: { color: '#8fa0dd', font: { family: 'Source Code Pro' } } },
      y: { grid: { color: '#1a233a' }, ticks: { color: '#8fa0dd', font: { family: 'Source Code Pro' } }, title: { display: true, text: 'Degrees (°)', color: '#8fa0dd' } }
    },
    plugins: { legend: { labels: { color: '#ffffff', font: { family: 'Rajdhani', size: 14 } } } }
  }
});

// Initialize Structural Strain Graphs
const strainChartCtx = document.getElementById("strainChart").getContext("2d");
const strainChart = new Chart(strainChartCtx, {
  type: 'line',
  data: {
    labels: timestampLabels,
    datasets: [
      { label: 'Top Station', data: datasetStrainTop, borderColor: '#ff9900', borderWidth: 2, tension: 0.1, pointRadius: 2, backgroundColor: 'rgba(255, 153, 0, 0.05)', fill: true },
      { label: 'Bottom Station', data: datasetStrainBot, borderColor: '#ff0055', borderWidth: 2, tension: 0.1, pointRadius: 2, backgroundColor: 'rgba(255, 0, 85, 0.05)', fill: true }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { color: '#1a233a' }, ticks: { color: '#8fa0dd', font: { family: 'Source Code Pro' } } },
      y: { grid: { color: '#1a233a' }, ticks: { color: '#8fa0dd', font: { family: 'Source Code Pro' } }, title: { display: true, text: 'Strain Units', color: '#8fa0dd' } }
    },
    plugins: { legend: { labels: { color: '#ffffff', font: { family: 'Rajdhani', size: 14 } } } }
  }
});

// 4. HEARTBEAT SOCKET AND CONNECTION MONITOR
database.ref(".info/connected").on("value", (snapshot) => {
  if (snapshot.val() === true) {
    uiElements.connectionLabel.innerText = "CONNECTED";
    uiElements.connectionLabel.style.color = "#00ff66";
    uiElements.pulseDot.style.backgroundColor = "#00ff66";
    uiElements.pulseDot.style.boxShadow = "0 0 10px #00ff66";
  } else {
    uiElements.connectionLabel.innerText = "DISCONNECTED";
    uiElements.connectionLabel.style.color = "#ff0055";
    uiElements.pulseDot.style.backgroundColor = "#ff0055";
    uiElements.pulseDot.style.boxShadow = "0 0 10px #ff0055";
  }
});

// 5. DATA INGESTION MATRIX AND PARSING INTERACTION
database.ref("telemetry").on("value", (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  // Stamp current device parsing system execution time
  const currentTimeString = new Date().toLocaleTimeString();
  uiElements.lastUpdate.innerText = currentTimeString;

  // Parse Raw Parameters
  const kx = parseFloat(data.kalman_x || 0).toFixed(2);
  const ky = parseFloat(data.kalman_y || 0).toFixed(2);
  const gz = parseFloat(data.gyro_z || 0).toFixed(2);
  const rawMoisture = parseInt(data.moisture_raw || 0);
  const lat = parseFloat(data.gps_lat || 0);
  const lon = parseFloat(data.gps_lon || 0);
  const topStrain = parseInt(data.strain_top || 0);
  const botStrain = parseInt(data.strain_bot || 0);

  // Map to Text Nodes
  uiElements.kalmanX.innerText = kx;
  uiElements.kalmanY.innerText = ky;
  uiElements.gyroZ.innerText = gz;
  uiElements.moistureRaw.innerText = rawMoisture;
  uiElements.strainTop.innerText = topStrain;
  uiElements.strainBot.innerText = botStrain;

  // SVG Gauge Calculations (Max scale mapped to 90 degrees max slope target)
  updateSvgArc(uiElements.gaugeArcX, Math.abs(kx), 90);
  updateSvgArc(uiElements.gaugeArcY, Math.abs(ky), 90);
  updateSvgArc(uiElements.gaugeArcZ, Math.abs(gz), 90);

  // Soil Saturation Scaling Calculations (Assuming raw ADC 12-bit range 4095 dry to 1500 fully wet)
  let saturationPct = Math.round(((4095 - rawMoisture) / (4095 - 1500)) * 100);
  if (saturationPct > 100) saturationPct = 100;
  if (saturationPct < 0) saturationPct = 0;
  
  uiElements.moisturePct.innerText = saturationPct;
  uiElements.moistureBarFill.style.width = `${saturationPct}%`;

  // Scale Vertical Structural Core Strain Bar Gauges
  uiElements.strainTopFill.style.height = `${Math.min(Math.max((topStrain / 1000) * 100, 5), 100)}%`;
  uiElements.strainBotFill.style.height = `${Math.min(Math.max((botStrain / 1000) * 100, 5), 100)}%`;

  // Geolocation Rendering Map Logic
  if (lat !== 0 && lon !== 0) {
    uiElements.gpsLat.innerText = lat.toFixed(6);
    uiElements.gpsLon.innerText = lon.toFixed(6);
    uiElements.gpsStatus.innerText = "3D SATELLITE LOCK FOUND";
    uiElements.gpsStatus.style.color = "#00ff66";
    uiElements.mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    uiElements.mapsLink.style.pointerEvents = "auto";
    uiElements.mapsLink.style.opacity = "1";
  } else {
    uiElements.gpsLat.innerText = "AWAITING LOCK";
    uiElements.gpsLon.innerText = "AWAITING LOCK";
    uiElements.gpsStatus.innerText = "SEARCHING SATELLITES...";
    uiElements.gpsStatus.style.color = "#ff9900";
    uiElements.mapsLink.style.pointerEvents = "none";
    uiElements.mapsLink.style.opacity = "0.3";
  }

  // Landslide Risk Automation Threshold Evaluation Matrix
  evaluateRiskState(kx, ky, saturationPct, topStrain, botStrain);

  // Append Fresh Metrics to Chart Arrays
  pushChartTelemetry(currentTimeString, kx, ky, topStrain, botStrain);
});

// Helper function to dynamically rotate and draw path lengths inside SVG Gauges
function updateSvgArc(element, value, maxVal) {
  const maxArcLength = 172.8; 
  let percentage = value / maxVal;
  if (percentage > 1) percentage = 1;
  const fillLength = percentage * maxArcLength;
  element.setAttribute("stroke-dasharray", `${fillLength} ${maxArcLength}`);
}

// 6. MULTI-VARIABLE RISK EVALUATION ENGINE
function evaluateRiskState(x, y, moisture, sTop, sBot) {
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  
  let riskLevel = "SAFE";
  let msg = "All parameters within normal structural operational thresholds.";
  let badge = "NOMINAL";
  let cssClass = "alert-banner--safe";

  // Check Criteria for EMERGENCY (Immediate Landslide or Shear In Progress)
  if (absX >= 15.0 || absY >= 15.0 || sTop >= 750 || sBot >= 750) {
    riskLevel = "EMERGENCY CRITICAL";
    msg = "HIGH ROTATION DETECTION DETECTED! SHEAR STRAIN IN CORING INFRASTRUCTURE IMMINENT.";
    badge = "EVACUATE AREA";
    cssClass = "alert-banner--crit";
  } 
  // Check Criteria for WARNING (Geological Slip/Creep Detected, Saturation Rising)
  else if (absX >= 5.0 || absY >= 5.0 || moisture >= 85 || sTop >= 400 || sBot >= 400) {
    riskLevel = "WARNING ADVISORY";
    msg = "Slope instability patterns verified. Soil moisture and tilt structural strain exceeding limits.";
    badge = "STABILITY FLAGGED";
    cssClass = "alert-banner--warn";
  }

  // Apply Changes to DOM Element Class Strings
  uiElements.alertBanner.className = `alert-banner ${cssClass}`;
  uiElements.alertLevel.innerText = riskLevel;
  uiElements.alertMessage.innerText = msg;
  uiElements.alertBadge.innerText = badge;
}

// Helper to push values and cycle old array points out of memory charts
function pushChartTelemetry(time, x, y, topS, botS) {
  timestampLabels.push(time);
  datasetKalmanX.push(x);
  datasetKalmanY.push(y);
  datasetStrainTop.push(topS);
  datasetStrainBot.push(botS);

  if (timestampLabels.length > rollingSampleLimit) {
    timestampLabels.shift();
    datasetKalmanX.shift();
    datasetKalmanY.shift();
    datasetStrainTop.shift();
    datasetStrainBot.shift();
  }
  tiltChart.update();
  strainChart.update();
}

// 7. FIREBASE REVERSE TRIGGER INTERFACE CONTROL FLOW (REMOTE POLL)
uiElements.pollBtn.addEventListener("click", () => {
  // Visually lock the command interface down during deployment phase
  uiElements.pollBtn.disabled = true;
  uiElements.pollStatusDot.style.backgroundColor = "#ff9900";
  uiElements.pollStatusText.innerText = "COMMAND TRANSMITTED — Waiting for Gateway ESP32 Check-In...";

  // Inject Command Request Signal Flag into Cloud Root Path Directory Node
  database.ref("control/web_poll_trigger").set(true)
    .then(() => {
      logCommandHistory("FORCE POLL ISSUED");
    })
    .catch((err) => {
      console.error("Firebase Command Error: ", err);
      resetControlUi();
    });
});

// Watch Database Control Variable for System Reset Loop Feedback Trigger Pings
database.ref("control/web_poll_trigger").on("value", (snapshot) => {
  const triggerActive = snapshot.val();
  // When Master reads flag and sets it back to false, release dashboard lock
  if (triggerActive === false) {
    resetControlUi();
  }
});

function resetControlUi() {
  uiElements.pollBtn.disabled = false;
  uiElements.pollStatusDot.style.backgroundColor = "#00e1ff";
  uiElements.pollStatusText.innerText = "IDLE — No command pending";
}

function logCommandHistory(actionText) {
  const timestamp = new Date().toLocaleTimeString();
  const emptyPlaceholder = uiElements.pollHistoryList.querySelector(".poll-history-empty");
  if (emptyPlaceholder) emptyPlaceholder.remove();

  const newLogEntry = document.createElement("li");
  newLogEntry.innerHTML = `<span class="mono" style="color: #8fa0dd">[${timestamp}]</span> ${actionText} <span style="color: #00ff66; float: right">✔ SENT</span>`;
  uiElements.pollHistoryList.insertBefore(newLogEntry, uiElements.pollHistoryList.firstChild);
}