
"use strict";

/*
 * CAT112 - Motor de telefonia educativa.
 * Respostes deterministes per escenari.
 * No és una IA clínica ni un protocol oficial.
 */

(() => {
  const $ = id => document.getElementById(id);

  const scenarios = {
    medical: {
      name:"Persona inconscient",
      caller:"Dona adulta, testimoni",
      emotion:"Nerviosa i preocupada",
      voice:{rate:1.08,pitch:1.12},
      facts:{
        what:"La persona ha caigut i no respon quan li parlo.",
        where:"Carrer Major, 10, Vic.",
        who:"És una persona adulta. Només hi ha una víctima.",
        risk:"No veig foc ni cap altre perill immediat.",
        condition:"No respon quan li parlo. No sé si respira amb normalitat.",
        actions:"He intentat parlar-li i demanar ajuda."
      },
      answers:[
        {keys:["què","que","passat","succeeix","problema"],slot:"what"},
        {keys:["on","adreça","ubicació","ubicacio","lloc"],slot:"where"},
        {keys:["quantes","persones","víctimes","victimes","afectades"],slot:"who"},
        {keys:["perill","risc","foc","fum","trànsit","transit"],slot:"risk"},
        {keys:["respon","conscient","respira","respiració","respiracio","estat"],slot:"condition"},
        {keys:["fet","intentat","ajuda","maniobra"],slot:"actions"}
      ]
    },
    traffic:{
      name:"Accident de trànsit",
      caller:"Home adult, conductor",
      emotion:"Alterat i nerviós",
      voice:{rate:1.15,pitch:0.91},
      facts:{
        what:"Hi ha hagut una col·lisió entre dos vehicles.",
        where:"Carretera C-17, a l'altura de Vic.",
        who:"Hi ha dues persones afectades, una a cada vehicle.",
        risk:"Els vehicles ocupen part de la calçada. No veig flames.",
        condition:"Una persona es queixa de dolor al coll. L'altra està fora del vehicle.",
        actions:"Hem aturat els vehicles i hem avisat els altres conductors."
      },
      answers:[
        {keys:["què","que","accident","passat","col·lisió","col.lisió"],slot:"what"},
        {keys:["on","carretera","ubicació","ubicacio","punt","quilòmetre","quilometre"],slot:"where"},
        {keys:["quantes","persones","vehicles","víctimes","victimes"],slot:"who"},
        {keys:["perill","risc","foc","fum","calçada","calçada"],slot:"risk"},
        {keys:["lesió","lesio","ferit","ferida","dolor","conscient","estat"],slot:"condition"},
        {keys:["fet","intentat","seguretat","ajuda"],slot:"actions"}
      ]
    },
    fire:{
      name:"Incendi d'habitatge",
      caller:"Veïna, dona adulta",
      emotion:"Molt espantada",
      voice:{rate:1.2,pitch:1.2},
      facts:{
        what:"Surt molt fum d'un habitatge i sembla que hi ha un incendi.",
        where:"Carrer del Nord, 24, Manlleu.",
        who:"No sé quantes persones hi ha a dins.",
        risk:"Hi ha fum al replà i altres veïns estan sortint de l'edifici.",
        condition:"No puc confirmar si hi ha persones ferides.",
        actions:"Hem avisat els veïns i hem sortit de l'edifici."
      },
      answers:[
        {keys:["què","que","passat","foc","incendi","fum"],slot:"what"},
        {keys:["on","adreça","ubicació","ubicacio","edifici"],slot:"where"},
        {keys:["quantes","persones","veïns","veins","habitants"],slot:"who"},
        {keys:["perill","risc","fum","flames","propagació","propagacio"],slot:"risk"},
        {keys:["ferits","ferides","víctimes","victimes","afectats"],slot:"condition"},
        {keys:["fet","intentat","sortit","evacuat","avisat"],slot:"actions"}
      ]
    },
    rescue:{
      name:"Persona accidentada",
      caller:"Home adult, excursionista",
      emotion:"Preocupat",
      voice:{rate:0.96,pitch:0.98},
      facts:{
        what:"Una persona ha caigut en una zona de muntanya i no pot continuar.",
        where:"Camí de la zona del Puig dels Jueus, a Vic.",
        who:"Hi ha una persona accidentada i dues persones acompanyants.",
        risk:"El terreny és irregular i l'accés amb vehicle és difícil.",
        condition:"La persona està conscient però es queixa de dolor intens a una cama.",
        actions:"Hem aturat la marxa i estem al seu costat."
      },
      answers:[
        {keys:["què","que","passat","caigut","accident"],slot:"what"},
        {keys:["on","ubicació","ubicacio","camí","cami","lloc"],slot:"where"},
        {keys:["quantes","persones","acompanyants","víctimes","victimes"],slot:"who"},
        {keys:["perill","risc","terreny","accés","acces"],slot:"risk"},
        {keys:["ferit","ferida","conscient","dolor","lesió","lesio"],slot:"condition"},
        {keys:["fet","intentat","ajuda","moure"],slot:"actions"}
      ]
    }
  };

  const slotLabels = {
    what:"Què ha passat?",
    where:"On ha passat?",
    who:"Persones afectades",
    risk:"Riscos actuals",
    condition:"Estat de la víctima",
    actions:"Mesures realitzades"
  };

  let activeScenario = null;
  let lastAnswer = "";
  let startTime = null;
  let timer = null;
  let questions = 0;
  let relevantQuestions = 0;
  let collected = new Set();
  let recognition = null;

  function normalize(value) {
    return value.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"");
  }

  function elapsed() {
    return startTime ? Math.floor((Date.now()-startTime)/1000) : 0;
  }

  function formatTime(seconds) {
    return String(Math.floor(seconds/60)).padStart(2,"0") +
      ":" + String(seconds%60).padStart(2,"0");
  }

  function addMessage(type,name,message) {
    const log = $("conversationLog");
    if (!log) return;

    const empty = log.querySelector(".empty");
    if (empty) empty.remove();

    const div = document.createElement("div");
    div.className = "chat-message " + type;

    const label = document.createElement("small");
    label.textContent = name;

    const text = document.createElement("div");
    text.textContent = message;

    div.append(label,text);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function speak(message) {
    if (!("speechSynthesis" in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "ca-ES";

    if (activeScenario) {
      utterance.rate = activeScenario.voice.rate;
      utterance.pitch = activeScenario.voice.pitch;
    }

    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase().startsWith("ca")) ||
      voices.find(v => v.lang.toLowerCase().startsWith("es"));

    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
    lastAnswer = message;
  }

  function recordAnswer(slot) {
    if (!activeScenario || collected.has(slot)) return;

    collected.add(slot);

    const element = $("slot" +
      slot.charAt(0).toUpperCase() + slot.slice(1));

    if (element) {
      element.textContent = activeScenario.facts[slot];
      element.style.color = "var(--green)";
    }

    updateEvaluation();
  }

  function findSlot(question) {
    const q = normalize(question);

    for (const item of activeScenario.answers) {
      if (item.keys.some(key => q.includes(normalize(key)))) {
        return item.slot;
      }
    }

    return null;
  }

  function responseFor(question) {
    const q = normalize(question);

    if (q.includes("repete") || q.includes("repetir")) {
      return lastAnswer || "No recordo quina era l'última resposta.";
    }

    if (q.includes("nom") || q.includes("identifi")) {
      return "Em dic " + activeScenario.caller +
        ". Estic trucant perquè necessito ajuda.";
    }

    const slot = findSlot(question);

    if (!slot) {
      return "Estic molt nerviós i no sé ben bé què dir. Em pot fer una pregunta més concreta, si us plau? " +
        activeScenario.facts.what;
    }

    return activeScenario.facts[slot];
  }

  function updateEvaluation() {
    const count = collected.size;
    const quality = questions ?
      Math.round((relevantQuestions/questions)*100) : 0;

    $("questionScore").textContent =
      questions ? quality + "/100" : "—";

    $("informationScore").textContent = count + "/6";
    $("interrogationDuration").textContent = formatTime(elapsed());

    const feedback = [];

    if (count < 6) {
      feedback.push("Informació pendent: " +
        Object.keys(slotLabels)
          .filter(slot => !collected.has(slot))
          .map(slot => slotLabels[slot])
          .join(", "));
    } else {
      feedback.push("S'han recollit els sis blocs d'informació.");
    }

    if (questions >= 3 && quality < 60) {
      feedback.push("Revisa la concreció i pertinència de les preguntes.");
    }

    if (count === 6 && quality >= 75) {
      feedback.push("Bon interrogatori: informació essencial recollida.");
    }

    $("interrogationFeedback").textContent = feedback.join(" ");
  }

  function startScenario() {
    if (!window.speechSynthesis && !window.SpeechSynthesisUtterance) {
      // La conversa per text continua disponible.
    }

    const id = $("scenarioSelect").value;
    activeScenario = scenarios[id];

    if (!activeScenario) return;

    if (!$("systemStatus").textContent.includes("ACTIVA")) {
      $("startBtn").click();
    }

    if ($("callState").textContent === "CAP TRUCADA EN CURS") {
      $("newCallBtn").click();
    }

    $("callerInput").value = activeScenario.caller;
    $("callerName").textContent = activeScenario.caller;
    $("callNotes").value = "";
    $("answerCallBtn").click();

    questions = 0;
    relevantQuestions = 0;
    collected = new Set();
    startTime = Date.now();

    Object.keys(slotLabels).forEach(slot => {
      const element = $("slot" +
        slot.charAt(0).toUpperCase() + slot.slice(1));
      element.textContent = "Pendent";
      element.style.color = "";
    });

    $("callerProfile").textContent = activeScenario.caller;
    $("callerEmotion").textContent = activeScenario.emotion;
    $("conversationLog").replaceChildren();
    $("operatorQuestion").value = "";

    addMessage("caller","ALERTANT",
      "Hola? Si us plau, necessito ajuda! " +
      activeScenario.facts.what);

    speak("Hola? Si us plau, necessito ajuda! " +
      activeScenario.facts.what);

    clearInterval(timer);
    timer = setInterval(() => {
      $("interrogationTimer").textContent = formatTime(elapsed());
      $("interrogationDuration").textContent = formatTime(elapsed());
    },1000);

    updateEvaluation();
  }

  function askQuestion() {
    if (!activeScenario) {
      alert("Primer inicia un escenari d'interrogatori.");
      return;
    }

    const question = $("operatorQuestion").value.trim();

    if (question.length < 3) {
      alert("Escriu una pregunta abans d'enviar-la.");
      return;
    }

    questions++;

    const slot = findSlot(question);

    if (slot) {
      relevantQuestions++;
      recordAnswer(slot);
    }

    addMessage("operator","OPERADOR 01",question);

    const answer = responseFor(question);

    addMessage("caller","ALERTANT",answer);
    speak(answer);

    $("operatorQuestion").value = "";
    updateEvaluation();
  }

  function repeatAnswer() {
    if (!lastAnswer) return;
    speak(lastAnswer);
  }

  function startVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("El navegador no admet dictat de veu. Pots escriure les preguntes.");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ca-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      $("operatorQuestion").value =
        event.results[0][0].transcript;
    };

    recognition.onerror = () => {
      alert("No s'ha pogut reconèixer la veu. Torna-ho a provar o escriu.");
    };

    recognition.start();
  }

  $("startScenarioBtn").addEventListener("click",startScenario);
  $("askQuestionBtn").addEventListener("click",askQuestion);
  $("repeatCallerBtn").addEventListener("click",repeatAnswer);
  $("voiceQuestionBtn").addEventListener("click",startVoiceRecognition);

  $("operatorQuestion").addEventListener("keydown",event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  });

  window.addEventListener("beforeunload",() => {
    clearInterval(timer);
    if (recognition) recognition.stop();
  });
})();
