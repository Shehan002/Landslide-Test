import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// ---- Firebase config ----
const firebaseConfig = {
  apiKey: "AIzaSyDr7iV1Lcy5N1cT7iE4BK2GEwaLAPT2xlY",
  authDomain: "landslidepilot.firebaseapp.com",
  databaseURL: "https://landslidepilot-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "landslidepilot",
  storageBucket: "landslidepilot.firebasestorage.app",
  messagingSenderId: "222798445648",
  appId: "1:222798445648:web:cc465d81e2051a0a2ea555",
  measurementId: "G-S1PG8CES6Z"
};

// Initialize
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const nodeRef = ref(db, "/landslide_node");

// Constants & State
const STRAIN_THRESHOLD = 200000;
let baseline = null;
let history = { labels: [], pitch: [], roll: [], w1: [], w2: [], w3: [], soil: [], rssi: [] };
const MAX_POINTS = 60;

const $ = (id) => document.getElementById(id);

// --- Helper Functions ---
function strainState(diff) {
  if (Math.abs(diff) < STRAIN_THRESHOLD) return { label: "stable", color: "#5FA777" };
  return diff > 0 ? { label: "tension", color: "#D9A441" } : { label: "compression", color: "#C1543C" };
}

function badgeClassFor(estimate) {
  if (!estimate) return "";
  if (estimate.includes("No significant")) return "ok";
  if (estimate.includes("entire profile") || estimate.includes("Multiple")) return "alert";
  return "warn";
}

// --- Chart Initializations ---
const chartOpts = (yLabel) => ({
  responsive: true, maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: { legend: { labels: { color: "#8B9199", boxWidth: 10, font: { family: "Inter", size: 10.5 } } } },
  scales: {
    x: { ticks: { color: "#5B6368", font: { family: "JetBrains Mono", size: 9 }, maxTicksLimit: 6 }, grid: { color: "#2C3438" } },
    y: { ticks: { color: "#5B6368", font: { family: "JetBrains Mono", size: 9 } }, grid: { color: "#2C3438" }, title: { display: !!yLabel, text: yLabel, color: "#8B9199", font: { size: 10 } } }
  }
});

const chartTilt = new Chart($("chartTilt"), { type: "line", data: { labels: [], datasets: [{ label: "Pitch °", data: [], borderColor: "#B5794A", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }, { label: "Roll °", data: [], borderColor: "#8FB7C9", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }] }, options: chartOpts("degrees") });
const chartStrain = new Chart($("chartStrain"), { type: "line", data: { labels: [], datasets: [{ label: "Bridge 1 (0.5m)", data: [], borderColor: "#5FA777", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }, { label: "Bridge 2 (1.5m)", data: [], borderColor: "#D9A441", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }, { label: "Bridge 3 (2.5m)", data: [], borderColor: "#C1543C", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }] }, options: chartOpts("Δ strain") });
const chartMoisture = new Chart($("chartMoisture"), { type: "line", data: { labels: [], datasets: [{ label: "Soil moisture %", data: [], borderColor: "#5FA777", backgroundColor: "rgba(95,167,119,0.12)", fill: true, tension: 0.3, pointRadius: 0 }] }, options: chartOpts("%") });
const chartSignal = new Chart($("chartSignal"), { type: "line", data: { labels: [], datasets: [{ label: "RSSI dBm", data: [], borderColor: "#8FB7C9", backgroundColor: "transparent", tension: 0.3, pointRadius: 0 }] }, options: chartOpts("dBm") });

// --- Update Logic ---
function pushHistory(d, timeLabel) {
  history.labels.push(timeLabel);
  history.pitch.push(d.P); history.roll.push(d.R);
  history.w1.push(d.W1); history.w2.push(d.W2); history.w3.push(d.W3);
  history.soil.push(d.SM); history.rssi.push(d.RSSI);
  for (const k of Object.keys(history)) if (history[k].length > MAX_POINTS) history[k].shift();

  chartTilt.data.labels = history.labels;
  chartTilt.data.datasets[0].data = history.pitch;
  chartTilt.data.datasets[1].data = history.roll;
  chartTilt.update("none");

  chartStrain.data.labels = history.labels;
  const b = baseline || { w1: d.W1, w2: d.W2, w3: d.W3 };
  chartStrain.data.datasets[0].data = history.w1.map(v => v - b.w1);
  chartStrain.data.datasets[1].data = history.w2.map(v => v - b.w2);
  chartStrain.data.datasets[2].data = history.w3.map(v => v - b.w3);
  chartStrain.update("none");

  chartMoisture.data.labels = history.labels;
  chartMoisture.data.datasets[0].data = history.soil;
  chartMoisture.update("none");

  chartSignal.data.labels = history.labels;
  chartSignal.data.datasets[0].data = history.rssi;
  chartSignal.update("none");
}

function addLogRow(d, timeLabel) {
  const body = $("logBody");
  if (body.children.length === 1 && body.children[0].querySelector(".empty-state")) body.innerHTML = "";
  const row = document.createElement("tr");
  row.innerHTML = `<td>${d.C ?? "—"}</td><td>${timeLabel}</td><td>${(d.P ?? 0).toFixed(2)}</td><td>${(d.R ?? 0).toFixed(2)}</td><td>${d.W1 ?? "—"}</td><td>${d.W2 ?? "—"}</td><td>${d.W3 ?? "—"}</td><td>${(d.SM ?? 0).toFixed(1)}</td><td>${d.RSSI ?? "—"}</td><td>${d.Estimate ?? "—"}</td>`;
  body.prepend(row);
  while (body.children.length > 40) body.removeChild(body.lastChild);
}

// --- Firebase Listener ---
onValue(nodeRef, (snapshot) => {
  const d = snapshot.val();
  if (!d) { $("statusText").textContent = "Connected — no data found"; return; }
  
  // Update status UI
  $("statusDot").classList.add("live");
  $("statusText").textContent = "Live · last sync " + new Date().toLocaleTimeString();
  
  // Logic to render data to dashboard
  if (!baseline) baseline = { w1: d.W1, w2: d.W2, w3: d.W3 };
  const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  
  pushHistory(d, timeLabel);
  addLogRow(d, timeLabel);
  
  // Render specific UI elements
  $("packetNo").textContent = d.C ?? "—";
  $("estimateValue").textContent = d.Estimate || "—";
  $("attitudeValue").innerHTML = (d.P ?? 0).toFixed(2) + "° <small>pitch</small>";
  $("attitudeValue2").innerHTML = (d.R ?? 0).toFixed(2) + "° <small>roll</small>";
  $("moistureValue").innerHTML = (d.SM ?? 0).toFixed(1) + "<small>%</small>";

  // Coordinate strip
  $("coordLat").textContent = "lat " + (d.LT != null ? d.LT.toFixed(6) : "—");
  $("coordLon").textContent = "lon " + (d.LN != null ? d.LN.toFixed(6) : "—");
  $("coordAlt").textContent = "alt " + (d.AL != null ? d.AL.toFixed(1) + "m" : "—");
  $("coordSat").textContent = "sats " + (d.ST ?? "—");

  // Google Maps link (built straight from the GNSS fix, no API key needed)
  if (d.LT != null && d.LN != null && (d.LT !== 0 || d.LN !== 0)) {
    const mapsUrl = `https://www.google.com/maps?q=${d.LT},${d.LN}`;
    const mapBtn = $("mapLinkBtn");
    mapBtn.href = mapsUrl;
    mapBtn.removeAttribute("aria-disabled");
    $("mapLinkTitle").textContent = "Fixed GNSS lock acquired";
    $("mapLinkSub").textContent = `${d.LT.toFixed(6)}, ${d.LN.toFixed(6)} · ${d.ST ?? "—"} sats`;
  }
}, (error) => {
  console.error("Firebase connection error:", error);
  $("statusText").textContent = "Connection error";
});