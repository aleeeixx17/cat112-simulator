
"use strict";

// CAT112 Simulator - Entorn educatiu
// No connectat amb serveis reals d'emergències.

const state = {
  running: false,
  calls: 0,
  incidents: [],
  units: [
    { id: "SEM-01", type: "SEM", status: "Disponible" },
    { id: "SEM-02", type: "SEM", status: "Disponible" },
    { id: "BOM-01", type: "Bombers", status: "Disponible" },
    { id: "MOS-01", type: "Mossos", status: "Disponible" },
    { id: "POL-01", type: "Policia Local", status: "Disponible" },
    { id: "PC-01", type: "Protecció Civil", status: "Disponible" }
  ]
};

const $ = id => document.getElementById(id);

function startSimulation() {
  state.running = true;
  $("systemStatus").textContent = "SIMULACIÓ ACTIVA";
  $("systemStatus").style.color = "#37c98b";
  $("simulationMessage").textContent =
    "Central preparada. Esperant trucades simulades.";
}

function stopSimulation() {
  state.running = false;
  $("systemStatus").textContent = "SIMULACIÓ ATURADA";
  $("simulationMessage").textContent =
    "La simulació està aturada.";
}

function createIncident() {
  if (!state.running) {
    alert("Primer has d'iniciar la simulació.");
    return;
  }

  const type = $("emergencyType").value;
  const location = $("location").value.trim();
  const description = $("description").value.trim();

  if (!location || !description) {
    alert("Introdueix una ubicació i una descripció.");
    return;
  }

  const incident = {
    id: "INC-" + String(++state.calls).padStart(3, "0"),
    type,
    location,
    description,
    createdAt: new Date().toISOString(),
    status: "Obert",
    resources: []
  };

  state.incidents.unshift(incident);
  render();
  $("location").value = "";
  $("description").value = "";
}

function render() {
  $("incidentCount").textContent = state.incidents.length;
  $("callCount").textContent = state.calls;

  $("incidentList").innerHTML = "";

  state.incidents.forEach(incident => {
    const div = document.createElement("div");
    div.className = "incident";

    const title = document.createElement("strong");
    title.textContent = `${incident.id} · ${incident.type}`;

    const place = document.createElement("p");
    place.textContent = incident.location;

    const description = document.createElement("p");
    description.textContent = incident.description;

    const status = document.createElement("small");
    status.textContent = "Estat: " + incident.status;

    div.append(title, place, description, status);
    $("incidentList").appendChild(div);
  });

  $("unitList").innerHTML = "";

  state.units.forEach(unit => {
    const div = document.createElement("div");
    div.className = "unit";

    const name = document.createElement("strong");
    name.textContent = unit.id;

    const status = document.createElement("span");
    status.textContent = unit.status;

    div.append(name, status);
    $("unitList").appendChild(div);
  });
}

function exportData() {
  const blob = new Blob(
    [JSON.stringify(state, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cat112-simulacio.json";
  link.click();
  URL.revokeObjectURL(url);
}

render();
