
"use strict";

/*
 CAT112 SIMULATOR
 CAD educatiu no oficial.
 No connectat amb el CAT112 real ni amb xarxes operatives.
*/

const $ = id => document.getElementById(id);

const STORAGE_KEY = "cat112_advanced_v1";

const initialUnits = [
  {id:"SEM-01",type:"SEM",status:"Disponible",incident:null},
  {id:"SEM-02",type:"SEM",status:"Disponible",incident:null},
  {id:"SEM-03",type:"SEM",status:"Disponible",incident:null},
  {id:"BOM-01",type:"Bombers",status:"Disponible",incident:null},
  {id:"BOM-02",type:"Bombers",status:"Disponible",incident:null},
  {id:"MOS-01",type:"Mossos",status:"Disponible",incident:null},
  {id:"MOS-02",type:"Mossos",status:"Disponible",incident:null},
  {id:"POL-01",type:"Policia Local",status:"Disponible",incident:null},
  {id:"PC-01",type:"Protecció Civil",status:"Disponible",incident:null}
];

let data = loadData();
let simulationRunning = false;
let currentCall = null;
let callStartedAt = null;
let callTimer = null;

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.units) &&
        Array.isArray(saved.incidents)) return saved;
  } catch (error) {
    console.warn("No s'han pogut recuperar les dades.", error);
  }

  return {
    calls: [],
    incidents: [],
    units: initialUnits,
    radio: [],
    timeline: [],
    callSequence: 0,
    incidentSequence: 0
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function now() {
  return new Date();
}

function timestamp() {
  return now().toLocaleTimeString("ca-ES", {
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  });
}

function dateTime() {
  return now().toISOString();
}

function addEvent(message) {
  data.timeline.unshift({
    time: timestamp(),
    date: dateTime(),
    message
  });
  data.timeline = data.timeline.slice(0,150);
  saveData();
  renderTimeline();
}

function startSimulation() {
  simulationRunning = true;
  $("systemStatus").textContent = "SIMULACIÓ ACTIVA";
  $("simulationMessage")?.textContent;
  $("systemStatus").style.color = "var(--green)";
  addEvent("Inici de la simulació per l'operador.");
  render();
}

function stopSimulation() {
  simulationRunning = false;
  $("systemStatus").textContent = "SIMULACIÓ ATURADA";
  $("systemStatus").style.color = "var(--red)";
  addEvent("Simulació aturada.");
}

function createCall() {
  if (!simulationRunning) {
    alert("Inicia la simulació abans de rebre una trucada.");
    return;
  }

  if (currentCall) {
    alert("Ja hi ha una trucada en curs.");
    return;
  }

  data.callSequence++;

  currentCall = {
    id:"TRU-" + String(data.callSequence).padStart(4,"0"),
    caller:"",
    location:"",
    notes:"",
    status:"Entrant",
    startedAt:dateTime()
  };

  $("callId").textContent = currentCall.id;
  $("callerName").textContent = "Pendent";
  $("callState").textContent = "TRUCADA ENTRANT";
  $("callerInput").value = "";
  $("locationInput").value = "";
  $("callNotes").value = "";

  callStartedAt = Date.now();
  clearInterval(callTimer);

  callTimer = setInterval(() => {
    if (!callStartedAt) return;
    const seconds = Math.floor((Date.now()-callStartedAt)/1000);
    $("callDuration").textContent =
      String(Math.floor(seconds/60)).padStart(2,"0") + ":" +
      String(seconds%60).padStart(2,"0");
  },1000);

  addEvent("Trucada entrant " + currentCall.id + ".");
}

function answerCall() {
  if (!currentCall) {
    alert("No hi ha cap trucada entrant.");
    return;
  }

  currentCall.status = "En atenció";
  currentCall.caller = $("callerInput").value.trim();
  currentCall.location = $("locationInput").value.trim();
  currentCall.notes = $("callNotes").value.trim();

  $("callState").textContent = "TRUCADA EN ATENCIÓ";
  $("callerName").textContent = currentCall.caller || "No identificat";

  addEvent("L'operador atén la trucada " + currentCall.id + ".");
  saveData();
}

function finishCall() {
  if (!currentCall) {
    alert("No hi ha cap trucada en curs.");
    return;
  }

  currentCall.caller = $("callerInput").value.trim();
  currentCall.location = $("locationInput").value.trim();
  currentCall.notes = $("callNotes").value.trim();
  currentCall.finishedAt = dateTime();
  currentCall.durationSeconds = Math.floor(
    (Date.now()-callStartedAt)/1000
  );
  currentCall.status = "Finalitzada";

  data.calls.unshift({...currentCall});
  data.calls = data.calls.slice(0,100);

  addEvent("Trucada " + currentCall.id + " finalitzada.");
  currentCall = null;
  callStartedAt = null;

  clearInterval(callTimer);
  $("callId").textContent = "—";
  $("callDuration").textContent = "00:00";
  $("callerName").textContent = "—";
  $("callState").textContent = "CAP TRUCADA EN CURS";

  render();
}

function createIncident() {
  if (!simulationRunning) {
    alert("Inicia la simulació abans de crear incidents.");
    return;
  }

  const type = $("incidentType").value;
  const priority = $("priority").value;
  const location = $("incidentLocation").value.trim();
  const description = $("incidentDescription").value.trim();

  if (!location || !description) {
    alert("Cal introduir la localització i la descripció.");
    return;
  }

  data.incidentSequence++;

  const incident = {
    id:"INC-" + String(data.incidentSequence).padStart(4,"0"),
    type,
    priority,
    location,
    description,
    status:"Obert",
    createdAt:dateTime(),
    resources:[],
    closedAt:null
  };

  data.incidents.unshift(incident);

  addEvent("Creat " + incident.id + " · " + type +
    " · Prioritat " + priority + ".");

  $("incidentLocation").value = "";
  $("incidentDescription").value = "";

  render();
}

function assignResource() {
  const incidentId = $("assignIncident").value;
  const unitId = $("assignUnit").value;

  const incident = data.incidents.find(i => i.id === incidentId);
  const unit = data.units.find(u => u.id === unitId);

  if (!incident || !unit) {
    alert("Selecciona un incident i una unitat.");
    return;
  }

  if (unit.status !== "Disponible") {
    alert("Aquesta unitat no està disponible.");
    return;
  }

  if (incident.status === "Tancat") {
    alert("No pots assignar recursos a un incident tancat.");
    return;
  }

  unit.status = "Activat";
  unit.incident = incident.id;
  unit.activatedAt = dateTime();

  incident.resources.push({
    unitId:unit.id,
    activatedAt:dateTime(),
    departedAt:null,
    arrivedAt:null
  });

  incident.status = "En gestió";

  addEvent("Activació de " + unit.id + " per a " + incident.id + ".");
  render();
}

function changeUnitStatus(unitId) {
  const unit = data.units.find(u => u.id === unitId);
  if (!unit) return;

  const stages = ["Disponible","Activat","En ruta","Al lloc","Finalitzat"];
  const next = stages[(stages.indexOf(unit.status)+1)%stages.length];

  if (next === "Activat" && !unit.incident) {
    alert("Assigna primer la unitat a un incident.");
    return;
  }

  unit.status = next;

  const incident = data.incidents.find(i => i.id === unit.incident);
  const assignment = incident?.resources.find(r => r.unitId === unit.id);

  if (assignment) {
    if (next === "En ruta" && !assignment.departedAt) {
      assignment.departedAt = dateTime();
      addEvent(unit.id + " surt cap a " + incident.id + ".");
    } else if (next === "Al lloc" && !assignment.arrivedAt) {
      assignment.arrivedAt = dateTime();
      addEvent(unit.id + " arriba al lloc de " + incident.id + ".");
    } else if (next === "Finalitzat") {
      addEvent(unit.id + " finalitza el servei de " + incident.id + ".");
    }
  } else {
    addEvent(unit.id + " canvia a estat " + next + ".");
  }

  if (next === "Finalitzat") {
    unit.status = "Disponible";
    unit.incident = null;
  }

  render();
}

function closeIncident(incidentId) {
  const incident = data.incidents.find(i => i.id === incidentId);
  if (!incident) return;

  const active = data.units.filter(
    u => u.incident === incidentId && u.status !== "Disponible"
  );

  if (active.length) {
    alert("Encara hi ha unitats assignades. Finalitza els serveis abans de tancar.");
    return;
  }

  incident.status = "Tancat";
  incident.closedAt = dateTime();

  addEvent("Incident " + incidentId + " tancat.");
  render();
}

function sendRadio() {
  const message = $("radioMessage").value.trim();
  const channel = $("radioChannel").value;

  if (!message) return;

  const entry = {
    time:timestamp(),
    channel,
    sender:"OPERADOR 01",
    message
  };

  data.radio.unshift(entry);
  data.radio = data.radio.slice(0,100);

  addEvent("Comunicació de ràdio enviada al canal " + channel + ".");
  $("radioMessage").value = "";
  renderRadio();
  saveData();
}

function renderRadio() {
  const container = $("radioLog");
  container.replaceChildren();

  if (!data.radio.length) {
    container.textContent = "Esperant comunicacions...";
    container.className = "radio-log empty";
    return;
  }

  container.className = "radio-log";

  data.radio.forEach(entry => {
    const div = document.createElement("div");
    div.className = "radio-entry";

    const time = document.createElement("time");
    time.textContent = entry.time;

    const sender = document.createElement("strong");
    sender.textContent = entry.sender + " · " + entry.channel + ": ";

    const message = document.createElement("span");
    message.textContent = entry.message;

    div.append(time,sender,message);
    container.appendChild(div);
  });
}

function renderTimeline() {
  const container = $("timeline");
  container.replaceChildren();

  if (!data.timeline.length) {
    container.textContent = "Encara no hi ha esdeveniments.";
    container.className = "timeline empty";
    return;
  }

  container.className = "timeline";

  data.timeline.forEach(event => {
    const div = document.createElement("div");
    div.className = "timeline-entry";

    const time = document.createElement("time");
    time.textContent = event.time;

    const message = document.createElement("span");
    message.textContent = event.message;

    div.append(time,message);
    container.appendChild(div);
  });
}

function renderCalls() {
  $("callCounter").textContent = data.calls.length +
    (currentCall ? 1 : 0);

  const container = $("callHistory");
  container.replaceChildren();

  if (!data.calls.length) {
    container.textContent = "No hi ha trucades registrades.";
    container.className = "scroll-list empty";
    return;
  }

  container.className = "scroll-list";

  data.calls.forEach(call => {
    const div = document.createElement("div");
    div.className = "incident-card";

    const title = document.createElement("h4");
    title.textContent = call.id + " · " + call.status;

    const details = document.createElement("p");
    details.textContent =
      (call.caller || "Alertant no identificat") + " · " +
      (call.location || "Ubicació pendent");

    const duration = document.createElement("p");
    duration.textContent = "Durada: " +
      (call.durationSeconds ?? 0) + " segons";

    div.append(title,details,duration);
    container.appendChild(div);
  });
}

function renderIncidents() {
  const container = $("incidentList");
  container.replaceChildren();

  const active = data.incidents.filter(i => i.status !== "Tancat");
  $("incidentCounter").textContent = active.length;

  if (!active.length) {
    container.textContent = "No hi ha incidents actius.";
    container.className = "scroll-list empty";
  } else {
    container.className = "scroll-list";

    active.forEach(incident => {
      const card = document.createElement("div");
      card.className = "incident-card";

      const title = document.createElement("h4");
      title.textContent = incident.id + " · " + incident.type;

      const priority = document.createElement("p");
      priority.className = "priority " + incident.priority;
      priority.textContent = "PRIORITAT " + incident.priority.toUpperCase();

      const location = document.createElement("p");
      location.textContent = "LOCALITZACIÓ: " + incident.location;

      const description = document.createElement("p");
      description.textContent = incident.description;

      const status = document.createElement("p");
      status.textContent = "ESTAT: " + incident.status +
        " · RECURSOS: " + incident.resources.length;

      const button = document.createElement("button");
      button.className = "btn btn-dark btn-small";
      button.textContent = "TANCAR INCIDENT";
      button.addEventListener("click",() => closeIncident(incident.id));

      card.append(title,priority,location,description,status,button);
      container.appendChild(card);
    });
  }

  const select = $("assignIncident");
  const selected = select.value;
  select.replaceChildren();

  active.forEach(incident => {
    const option = document.createElement("option");
    option.value = incident.id;
    option.textContent = incident.id + " · " + incident.type;
    select.appendChild(option);
  });

  if (active.some(i => i.id === selected)) select.value = selected;
}

function renderResources() {
  const container = $("resourceList");
  container.replaceChildren();

  const available = data.units.filter(u => u.status === "Disponible").length;
  $("availableCounter").textContent = available + "/" + data.units.length;

  data.units.forEach(unit => {
    const row = document.createElement("div");
    row.className = "resource-row";

    const name = document.createElement("div");
    name.className = "resource-name";

    const strong = document.createElement("strong");
    strong.textContent = unit.id;

    const small = document.createElement("small");
    small.textContent = unit.type +
      (unit.incident ? " · " + unit.incident : "");

    name.append(strong,small);

    const status = document.createElement("button");
    status.className = "btn btn-dark btn-small";
    status.textContent = unit.status;
    status.addEventListener("click",() => changeUnitStatus(unit.id));

    if (unit.status === "Disponible") status.style.color = "var(--green)";
    else if (unit.status === "Al lloc") status.style.color = "var(--red)";
    else status.style.color = "var(--yellow)";

    row.append(name,status);
    container.appendChild(row);
  });

  const select = $("assignUnit");
  const selected = select.value;
  select.replaceChildren();

  data.units.filter(u => u.status === "Disponible").forEach(unit => {
    const option = document.createElement("option");
    option.value = unit.id;
    option.textContent = unit.id + " · " + unit.type;
    select.appendChild(option);
  });

  if (data.units.some(u => u.id === selected && u.status === "Disponible")) {
    select.value = selected;
  }
}

function render() {
  saveData();
  renderCalls();
  renderIncidents();
  renderResources();
  renderRadio();
  renderTimeline();
}

function exportData() {
  const blob = new Blob(
    [JSON.stringify(data,null,2)],
    {type:"application/json"}
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cat112-registre-operatiu.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function updateClock() {
  $("clock").textContent = now().toLocaleTimeString("ca-ES");
}

$("startBtn").addEventListener("click",startSimulation);
$("stopBtn").addEventListener("click",stopSimulation);
$("newCallBtn").addEventListener("click",createCall);
$("answerCallBtn").addEventListener("click",answerCall);
$("finishCallBtn").addEventListener("click",finishCall);
$("createIncidentBtn").addEventListener("click",createIncident);
$("assignBtn").addEventListener("click",assignResource);
$("sendRadioBtn").addEventListener("click",sendRadio);
$("exportBtn").addEventListener("click",exportData);

$("radioMessage").addEventListener("keydown",event => {
  if (event.key === "Enter") sendRadio();
});

$("clearTimelineBtn").addEventListener("click",() => {
  if (!confirm("Vols netejar la cronologia?")) return;
  data.timeline = [];
  saveData();
  renderTimeline();
});

updateClock();
setInterval(updateClock,1000);
render();
