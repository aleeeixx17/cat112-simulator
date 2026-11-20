
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const now = () => new Date().toISOString();
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const scenarios = {
    medical: {
      name: "Emergència mèdica",
      caller: "Marta",
      emotion: "Molt nerviosa",
      opening: "Sisplau, necessito ajuda! El meu pare és a terra i no sé què li passa!",
      facts: {
        what: "El meu pare ha caigut a terra i no respon amb normalitat.",
        where: "Som al carrer Major, número 24, a Tona.",
        who: "És un home d'uns 68 anys. Només hi ha una persona afectada.",
        risk: "No veig cap perill immediat al voltant.",
        condition: "Respira, però no obre els ulls quan li parlo.",
        actions: "He intentat parlar-li i he demanat ajuda a un veí."
      },
      followups: [
        { test: /respir|respira|respirant/, question: "D'acord. Em podeu descriure com respira? Ho fa amb normalitat?" },
        { test: /respon|conscient|despert|ulls/, question: "Quan li parleu o el toqueu suaument, fa algun moviment o respon d'alguna manera?" },
        { test: /caigut|terra|cop|colpejat/, question: "Sabeu si s'ha donat algun cop al cap o si ha caigut de manera sobtada?" }
      ],
      classification: { type: "Emergència mèdica · Alteració de consciència", priority: "Alta" }
    },
    traffic: {
      name: "Accident de trànsit",
      caller: "Jordi",
      emotion: "Alterat i accelerat",
      opening: "Hi ha hagut un accident! Dos cotxes han xocat i hi ha una persona que no surt del vehicle!",
      facts: {
        what: "Col·lisió entre dos turismes.",
        where: "Carretera BV-5303, a prop de l'entrada de Tona.",
        who: "Hi ha tres persones implicades. Una continua dins d'un vehicle.",
        risk: "Els vehicles ocupen part de la calçada. No veig foc.",
        condition: "Una persona es queixa de dolor al coll i una altra està molt espantada.",
        actions: "Hem aturat els vehicles i hem avisat altres conductors."
      },
      followups: [
        { test: /vehicle|cotxe|atrap|sortir/, question: "La persona que és dins del vehicle està atrapada o simplement no vol sortir?" },
        { test: /carretera|via|calçada|trànsit/, question: "El trànsit està completament tallat o encara passen vehicles?" },
        { test: /ferit|lesion|dolor|coll/, question: "Hi ha alguna hemorràgia important o alguna lesió que pugueu veure?" }
      ],
      classification: { type: "Accident de trànsit amb possibles ferits", priority: "Alta" }
    },
    fire: {
      name: "Incendi en habitatge",
      caller: "Núria",
      emotion: "Plorosa i espantada",
      opening: "Ajudeu-me! Surt molt fum del pis del costat i crec que hi ha algú a dins!",
      facts: {
        what: "Hi ha fum abundant que surt d'un habitatge.",
        where: "Carrer de Barcelona, número 12, segon pis, a Tona.",
        who: "No sé quantes persones hi pot haver a dins.",
        risk: "Hi ha fum a l'escala i els veïns estan sortint de l'edifici.",
        condition: "No puc veure l'interior de l'habitatge.",
        actions: "He avisat els veïns i he sortit al carrer."
      },
      followups: [
        { test: /fum|foc|flama|crema/, question: "Veieu flames o només fum? De quin lloc de l'habitatge surt?" },
        { test: /persona|dins|habitatge|pis/, question: "Teniu constància que hi pugui haver algú a l'interior ara mateix?" },
        { test: /escala|veïns|edifici/, question: "El fum afecta les zones comunes o les vies de sortida de l'edifici?" }
      ],
      classification: { type: "Incendi en edifici d'habitatges", priority: "Alta" }
    },
    rescue: {
      name: "Rescat de persona accidentada",
      caller: "Pau",
      emotion: "Nerviós i dubitatiu",
      opening: "Una persona ha caigut per un desnivell mentre caminàvem. No sabem què hem de fer!",
      facts: {
        what: "Una persona ha caigut per un desnivell en una zona de muntanya.",
        where: "Som en un camí forestal a prop del castell de Tona.",
        who: "És una persona adulta. Anàvem dues persones juntes.",
        risk: "El terreny és irregular i hi ha risc de relliscada.",
        condition: "Està conscient, però es queixa molt del turmell.",
        actions: "No l'hem mogut i hem intentat mantenir-la tranquil·la."
      },
      followups: [
        { test: /caigut|desnivell|alçada/, question: "Aproximadament des de quina alçada ha caigut?" },
        { test: /turmell|cama|braç|dolor/, question: "Pot moure les extremitats? Té alguna ferida o deformitat visible?" },
        { test: /camí|bosc|muntanya|ubicació/, question: "Podeu descriure algun punt de referència que faciliti trobar-vos?" }
      ],
      classification: { type: "Rescat terrestre · Persona lesionada", priority: "Mitjana-alta" }
    }
  };

  let state = null;
  let recognition = null;
  let listening = false;
  let speaking = false;
  let interruptionTimer = null;
  let startTime = 0;
  let lastCallerText = "";
  let speechEnabled = true;

  function logEvent(type, detail) {
    if (!state) return;
    state.events.push({ time: now(), elapsedSeconds: elapsed(), type, detail });
    renderMetrics();
  }

  function elapsed() {
    return startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  }

  function addMessage(who, text, kind = "") {
    const log = $("conversationLog");
    if (!log) return;

    const item = document.createElement("div");
    item.className = `chat-message ${who === "Operador" ? "operator-message" : "caller-message"} ${kind}`;
    const heading = document.createElement("strong");
    heading.textContent = who;
    const body = document.createElement("p");
    body.textContent = text;
    item.append(heading, body);
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  function speak(text, emotion = "normal") {
    if (!speechEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.lang = "ca-ES";
    const voice = voices.find(v => v.lang.toLowerCase().startsWith("ca")) ||
                  voices.find(v => v.lang.toLowerCase().startsWith("es"));
    if (voice) utterance.voice = voice;
    utterance.rate = emotion === "nervous" ? 1.08 : 0.94;
    utterance.pitch = emotion === "crying" ? 1.2 : 1;
    speaking = true;
    utterance.onend = () => { speaking = false; };
    utterance.onerror = () => { speaking = false; };
    window.speechSynthesis.speak(utterance);
  }

  function callerReply(text, emotion = "normal", eventType = "Resposta") {
    lastCallerText = text;
    addMessage(state?.scenario.caller || "Alertant", text, emotion);
    logEvent(eventType, text);
    speak(text, emotion);
  }

  function setSlot(slot, value) {
    if (!state || state.slots[slot]) return;
    state.slots[slot] = true;
    const target = $("slot" + slot[0].toUpperCase() + slot.slice(1));
    if (target) {
      target.textContent = "RECOPILAT";
      target.classList.add("completed");
    }
    logEvent("Informació recopilada", slot + ": " + value);
  }

  function slotFromQuestion(q) {
    const s = q.toLowerCase();
    if (/què ha passat|que ha passat|què passa|que passa|accident|incendi|situació|succeeix/.test(s)) return "what";
    if (/on sou|on us trobeu|adreça|ubicació|ubicacio|carrer|lloc exacte|punt de referència/.test(s)) return "where";
    if (/quantes persones|qui està|qui esta|edat|afectad|persones implicad/.test(s)) return "who";
    if (/perill|risc|foc|fum|trànsit|transit|atrap|zona segura/.test(s)) return "risk";
    if (/respira|conscient|respon|ferid|lesió|lesio|estat|sagn|dolor/.test(s)) return "condition";
    if (/què heu fet|que heu fet|què ha fet|que ha fet|ajuda|maniobra|actuació|actuacio/.test(s)) return "actions";
    return null;
  }

  function isVague(q) {
    return q.trim().split(/\s+/).length < 3 ||
      /hola|m'expliques|explica'm|digues|què més|que mes|d'acord/.test(q.toLowerCase());
  }

  function similarityKey(q) {
    return q.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!.,;:]/g, "")
      .replace(/\b(el|la|els|les|un|una|de|del|que|i|a|em|us|heu|ha|hi|es|sou|esteu)\b/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function repeatedQuestion(q) {
    const key = similarityKey(q);
    return state.questions.some(old => similarityKey(old.text) === key);
  }

  function relevantQuestion(q, slot) {
    const covered = slot && state.slots[slot];
    return !!slot && !covered && !isVague(q);
  }

  function updateScore() {
    const total = state.questions.length;
    const useful = state.questions.filter(q => q.useful).length;
    const repeated = state.questions.filter(q => q.repeated).length;
    const vague = state.questions.filter(q => q.vague).length;
    const covered = Object.values(state.slots).filter(Boolean).length;
    const coverage = Math.round(covered / 6 * 100);
    const relevance = total ? Math.round(useful / total * 100) : 0;
    const penalty = repeated * 12 + vague * 6;
    const score = Math.max(0, Math.min(100, Math.round(coverage * 0.55 + relevance * 0.45 - penalty)));

    state.metrics = { total, useful, repeated, vague, covered, coverage, relevance, score };
    if ($("questionScore")) $("questionScore").textContent = `${score}/100`;
    if ($("informationScore")) $("informationScore").textContent = `${coverage}%`;
    if ($("interrogationDuration")) $("interrogationDuration").textContent = `${elapsed()} s`;

    const feedback = $("interrogationFeedback");
    if (feedback) {
      const notes = [];
      if (repeated) notes.push(`${repeated} pregunta/es repetida/es.`);
      if (vague) notes.push(`${vague} pregunta/es poc concretes.`);
      if (coverage < 100) notes.push(`Falta recopilar informació essencial (${coverage}%).`);
      if (!repeated && !vague && coverage === 100) notes.push("Bon interrogatori: informació essencial recopilada.");
      feedback.textContent = notes.join(" ") || "Comenceu l'interrogatori i manteniu una seqüència clara.";
    }
    renderMetrics();
  }

  function renderMetrics() {
    if (!state) return;
    let panel = $("advancedMetrics");
    if (!panel) return;
    panel.innerHTML = "";

    const rows = [
      ["Preguntes formulades", state.metrics?.total ?? 0],
      ["Preguntes pertinents", state.metrics?.useful ?? 0],
      ["Repeticions detectades", state.metrics?.repeated ?? 0],
      ["Preguntes poc útils", state.metrics?.vague ?? 0],
      ["Temps transcorregut", `${elapsed()} s`]
    ];
    rows.forEach(([label, value]) => {
      const line = document.createElement("div");
      line.className = "metric-line";
      const name = document.createElement("span");
      name.textContent = label;
      const number = document.createElement("strong");
      number.textContent = value;
      line.append(name, number);
      panel.appendChild(line);
    });
  }

  function ensureAdvancedPanel() {
    const host = $("interrogationFeedback")?.parentElement || $("conversationLog")?.parentElement;
    if (!host) return;

    if (!$("advancedMetrics")) {
      const metrics = document.createElement("div");
      metrics.id = "advancedMetrics";
      metrics.className = "advanced-metrics";
      host.appendChild(metrics);
    }

    if (!$("classificationProposal")) {
      const section = document.createElement("section");
      section.id = "classificationProposal";
      section.className = "classification-proposal";
      section.innerHTML = `
        <h3>PROPOSTA DE CLASSIFICACIÓ</h3>
        <p id="proposalType">Encara no hi ha cap proposta.</p>
        <p id="proposalPriority"></p>
        <button type="button" id="confirmClassificationBtn">CONFIRMAR CLASSIFICACIÓ</button>
        <p id="classificationStatus">Pendent de confirmació de l'operador.</p>
      `;
      host.appendChild(section);
      $("confirmClassificationBtn").addEventListener("click", confirmClassification);
    }

    if (!$("exportInterrogationBtn")) {
      const button = document.createElement("button");
      button.id = "exportInterrogationBtn";
      button.type = "button";
      button.textContent = "EXPORTAR INFORME D'INTERROGATORI";
      button.addEventListener("click", exportReport);
      host.appendChild(button);
    }

    if (!$("speechStatus")) {
      const status = document.createElement("p");
      status.id = "speechStatus";
      status.textContent = "Veu: preparada quan el navegador ho permeti.";
      host.appendChild(status);
    }
  }

  function proposeClassification() {
    const sc = state.scenario;
    const type = $("proposalType");
    const priority = $("proposalPriority");
    if (type) type.textContent = `Tipologia proposada: ${sc.classification.type}`;
    if (priority) priority.textContent = `Prioritat proposada: ${sc.classification.priority}`;
    state.proposal = { ...sc.classification, proposedAt: now(), confirmed: false };
    logEvent("Proposta de classificació", `${sc.classification.type} / ${sc.classification.priority}`);
  }

  function confirmClassification() {
    if (!state?.proposal) {
      if ($("classificationStatus")) $("classificationStatus").textContent = "No hi ha cap proposta disponible.";
      return;
    }
    state.proposal.confirmed = true;
    state.proposal.confirmedAt = now();
    if ($("classificationStatus")) {
      $("classificationStatus").textContent = "Classificació confirmada per l'operador.";
    }
    logEvent("Classificació confirmada", `${state.proposal.type} / ${state.proposal.priority}`);

    const notes = $("callNotes");
    if (notes) notes.value = `${notes.value ? notes.value + "\n" : ""}Classificació confirmada: ${state.proposal.type}. Prioritat: ${state.proposal.priority}.`;
  }

  function maybeFollowup(q, slot) {
    const followup = state.scenario.followups.find(item => item.test.test(q));
    if (followup && !state.followupsAsked.has(followup.question)) {
      state.followupsAsked.add(followup.question);
      return followup.question;
    }

    if (slot === "condition" && /no respon|inconscient|no respira/i.test(lastCallerText)) {
      return "M'heu dit que no respon. Podeu confirmar si observeu moviments respiratoris?";
    }
    if (slot === "where" && /no sé|no se|crec que|potser/i.test(lastCallerText)) {
      return "Mireu si podeu trobar un número de carrer, rètol o punt de referència proper.";
    }
    return null;
  }

  async function answerOperator(q) {
    if (!state || !q.trim()) return;

    const repeated = repeatedQuestion(q);
    const vague = isVague(q);
    const slot = slotFromQuestion(q);
    const useful = relevantQuestion(q, slot) && !repeated;

    const entry = { time: now(), elapsedSeconds: elapsed(), text: q, slot, useful, repeated, vague };
    state.questions.push(entry);
    addMessage("Operador", q);
    logEvent("Pregunta de l'operador", q);

    if (repeated) {
      callerReply("Això ja m'ho havíeu preguntat... No sé si us ho havia explicat bé.", "confused", "Pregunta repetida");
    } else if (vague) {
      callerReply("Perdó... no sé exactament què em voleu dir. Em podeu concretar la pregunta?", "confused", "Pregunta poc concreta");
    } else if (slot && state.scenario.facts[slot]) {
      const fact = state.scenario.facts[slot];
      setSlot(slot, fact);
      await wait(500 + Math.random() * 900);

      if (Math.random() < 0.22 && !state.interruptionUsed) {
        state.interruptionUsed = true;
        callerReply("Espereu! Perdó, és que estic molt nerviós... Hi ha una altra cosa que no us havia dit.", "nervous", "Interrupció de l'alertant");
        await wait(900);
      }

      callerReply(fact, state.scenario.emotion.includes("Plorosa") ? "crying" : "nervous");
      const next = maybeFollowup(q, slot);
      if (next) {
        await wait(700);
        callerReply(next, "nervous", "Pregunta de seguiment contextual");
      }
    } else {
      callerReply("No ho sé del cert... Estic molt nerviós i em costa explicar-m'ho. Què necessiteu saber exactament?", "confused");
    }

    if (!state.revisionUsed && state.questions.length >= 3) {
      state.revisionUsed = true;
      await wait(500);
      const correction = state.scenarioKey === "traffic"
        ? "Perdó, m'he equivocat abans: no són dues persones ferides, n'hi ha una que sembla que està bé."
        : state.scenarioKey === "medical"
        ? "Ara que m'hi fixo millor, crec que sí que respira, però molt fluix."
        : state.scenarioKey === "fire"
        ? "Un moment, ara veig una mica de flama a una finestra. Abans només veia fum."
        : "Perdó, no és exactament al camí principal. Hem baixat una mica pel marge.";
      callerReply(correction, "confused", "Rectificació de l'alertant");
      state.revisions.push({ time: now(), elapsedSeconds: elapsed(), text: correction });
    }

    updateScore();
    if (Object.values(state.slots).every(Boolean) && !state.proposal) proposeClassification();
  }

  function scheduleInterruption() {
    clearTimeout(interruptionTimer);
    if (!state) return;
    const delay = 22000 + Math.random() * 18000;
    interruptionTimer = setTimeout(() => {
      if (!state || speaking) {
        scheduleInterruption();
        return;
      }
      const lines = [
        "Perdoneu, em sentiu? Estic molt espantat i no sé què fer.",
        "Hi ha més gent al meu costat que també està nerviosa.",
        "Un moment... ara veig una cosa que abans no havia vist.",
        "Sisplau, no em deixeu sol. Què he de fer?"
      ];
      callerReply(lines[Math.floor(Math.random() * lines.length)], "nervous", "Interrupció espontània");
      scheduleInterruption();
    }, delay);
  }

  function resetSlots() {
    ["what", "where", "who", "risk", "condition", "actions"].forEach(slot => {
      const el = $("slot" + slot[0].toUpperCase() + slot.slice(1));
      if (el) {
        el.textContent = "PENDENT";
        el.classList.remove("completed");
      }
    });
  }

  function startScenario() {
    const selected = $("scenarioSelect")?.value || "medical";
    const scenario = scenarios[selected] || scenarios.medical;

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    clearTimeout(interruptionTimer);
    ensureAdvancedPanel();

    state = {
      scenario,
      scenarioKey: selected,
      slots: { what: false, where: false, who: false, risk: false, condition: false, actions: false },
      questions: [],
      events: [],
      revisions: [],
      followupsAsked: new Set(),
      interruptionUsed: false,
      revisionUsed: false,
      proposal: null,
      metrics: { total: 0, useful: 0, repeated: 0, vague: 0, covered: 0, coverage: 0, relevance: 0, score: 0 }
    };

    startTime = Date.now();
    resetSlots();

    if ($("conversationLog")) $("conversationLog").innerHTML = "";
    if ($("callerProfile")) $("callerProfile").textContent = `${scenario.caller} · ${scenario.emotion}`;
    if ($("callerEmotion")) $("callerEmotion").textContent = scenario.emotion;
    if ($("operatorQuestion")) $("operatorQuestion").value = "";
    if ($("classificationStatus")) $("classificationStatus").textContent = "Pendent de confirmació de l'operador.";
    if ($("proposalType")) $("proposalType").textContent = "Encara no hi ha cap proposta.";
    if ($("proposalPriority")) $("proposalPriority").textContent = "";

    logEvent("Inici de l'escenari", scenario.name);
    addMessage(scenario.caller, scenario.opening, "nervous");
    speak(scenario.opening, "nervous");
    scheduleInterruption();
    updateScore();

    if ($("speechStatus")) {
      $("speechStatus").textContent = ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
        ? "Veu: reconeixement disponible. Podeu parlar."
        : "Veu: reconeixement no disponible en aquest navegador. Feu servir el text.";
    }

    // Intenta iniciar la simulació principal si encara no està activa.
    const systemStatus = $("systemStatus")?.textContent || "";
    if (!systemStatus.includes("ACTIVA")) $("startBtn")?.click();
    if ($("newCallBtn")) $("newCallBtn").click();
    if ($("callerInput")) $("callerInput").value = scenario.caller;
    if ($("callerName")) $("callerName").value = scenario.caller;
    if ($("callNotes")) $("callNotes").value = `Escenari formatiu: ${scenario.name}`;
    $("answerCallBtn")?.click();
  }

  function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if ($("speechStatus")) $("speechStatus").textContent = "El navegador no admet dictat. Podeu escriure la pregunta.";
      return;
    }
    if (listening) {
      recognition?.stop();
      listening = false;
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ca-ES";
    recognition.interimResults = true;
    recognition.continuous = false;
    listening = true;

    if ($("speechStatus")) $("speechStatus").textContent = "Escoltant... parleu ara.";
    recognition.onresult = event => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if ($("operatorQuestion")) $("operatorQuestion").value = (finalText || interim).trim();
      if (finalText.trim()) {
        listening = false;
        answerOperator(finalText.trim());
        if ($("operatorQuestion")) $("operatorQuestion").value = "";
        if ($("speechStatus")) $("speechStatus").textContent = "Pregunta reconeguda. Resposta de l'alertant en curs.";
      }
    };
    recognition.onerror = event => {
      listening = false;
      if ($("speechStatus")) $("speechStatus").textContent = `Error de veu: ${event.error}. Podeu escriure la pregunta.`;
    };
    recognition.onend = () => {
      listening = false;
      if ($("speechStatus") && $("speechStatus").textContent.includes("Escoltant")) {
        $("speechStatus").textContent = "Escolta finalitzada.";
      }
    };
    recognition.start();
  }

  function exportReport() {
    if (!state) return;
    const report = {
      simulator: "CAT112 Simulator",
      educationalNotice: "Simulació fictícia no connectada al servei 112 real.",
      scenario: state.scenario.name,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: now(),
      durationSeconds: elapsed(),
      questions: state.questions,
      informationCollected: state.slots,
      revisions: state.revisions,
      classification: state.proposal,
      metrics: state.metrics,
      timeline: state.events
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cat112-informe-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logEvent("Informe exportat", "Informe JSON generat");
  }

  function bind(id, callback) {
    const el = $(id);
    if (el) el.addEventListener("click", callback);
  }

  bind("startScenarioBtn", startScenario);
  bind("askQuestionBtn", () => {
    const q = $("operatorQuestion")?.value || "";
    answerOperator(q);
    if ($("operatorQuestion")) $("operatorQuestion").value = "";
  });
  bind("voiceQuestionBtn", startVoiceRecognition);
  bind("repeatCallerBtn", () => {
    if (lastCallerText) speak(lastCallerText, "normal");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target?.id === "operatorQuestion" && !event.shiftKey) {
      event.preventDefault();
      $("askQuestionBtn")?.click();
    }
  });

  window.addEventListener("beforeunload", () => {
    clearTimeout(interruptionTimer);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  });

  ensureAdvancedPanel();
})();
