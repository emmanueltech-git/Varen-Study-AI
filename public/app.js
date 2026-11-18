const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  view: "home",
  department: "chw",
  subject: "",
  questions: [],
  quiz: null,
  quizAnswers: [],
  chat: get("chat", []),
  cardIndex: 0,
  cardFlipped: false
};

function get(key, fallback) {
  try { return JSON.parse(localStorage.getItem("vsa_" + key)) ?? fallback; }
  catch (_) { return fallback; }
}
function set(key, value) { localStorage.setItem("vsa_" + key, JSON.stringify(value)); }
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[character]));
}
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2600);
}

const departments = {
  chw: {
    name:"Community Health",
    short:"CHW",
    accent:"#287c75",
    description:"Community-focused health education, prevention and safe care pathways.",
    subjects:[
      "Introduction to Community Health","Primary Health Care","Human Anatomy and Physiology","Basic Nursing Care",
      "Community Diagnosis","Environmental Health","Nutrition and Health Education","Maternal and Child Health",
      "Communicable Diseases","Non-Communicable Diseases","Immunisation","First Aid and Basic Emergency Care",
      "Epidemiology","Health Promotion","Community Mobilisation","Medical Terminology",
      "Health Records and Documentation","Ethics and Professional Conduct"
    ]
  },
  coding: {
    name:"Coding and Technology",
    short:"CODE",
    accent:"#5867d9",
    description:"Structured beginner to advanced software and technology learning paths.",
    subjects:[
      "HTML","CSS","JavaScript","Python","React","TypeScript","Node.js","Git and GitHub",
      "Databases and SQL","Cybersecurity fundamentals","Computer networking","Software development"
    ]
  },
  general: {
    name:"General Studies",
    short:"GENERAL",
    accent:"#b66b35",
    description:"Core academic subjects and transferable learning skills.",
    subjects:["English Language","Mathematics","Biology","Chemistry","Physics","Computer Studies","Study Skills","Examination Preparation"]
  }
};

const titles = {
  home:"Dashboard", chw:"Community Health", coding:"Coding and Technology", general:"General Studies",
  tutor:"AI Tutor", questionbank:"Question Bank", notes:"My Notes", cards:"Flashcards",
  planner:"Study Planner", progress:"Progress and Performance", settings:"Settings"
};

function go(view, department, subject) {
  state.view = view;
  if (department) state.department = department;
  if (subject) state.subject = subject;
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  $("#page-title").textContent = titles[view] || view;
  $(".sidebar").classList.remove("open");
  render();
}

function render() {
  const renderers = {
    home, chw:departmentView, coding:departmentView, general:departmentView,
    tutor, questionbank, notes, cards, planner, progress, settings
  };
  (renderers[state.view] || home)();
}

function tile(icon, title, description, action, meta = "") {
  return `<button class="tile" ${action.startsWith("#") ? `data-action="${action}"` : `data-go="${action}"`}>
    <span class="tile-icon">${icon}</span><span class="tile-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small>${meta ? `<em>${escapeHTML(meta)}</em>` : ""}</span>
  </button>`;
}

function home() {
  const notes = get("notes", []);
  const tasks = get("tasks", []);
  const incomplete = tasks.filter(task => !task.done).length;
  const progress = get("subjectProgress", {});
  const learned = Object.values(progress).filter(value => value > 0).length;
  $("#view").innerHTML = `
    <section class="hero">
      <div><span class="hero-tag">YOUR LEARNING WORKSPACE</span><h2>Learn with a clear direction.</h2><p>Move between Community Health, Coding and Technology, and General Studies in one organised, offline-ready workspace.</p></div>
      <div class="hero-score"><strong>${learned}</strong><span>subjects started</span></div>
    </section>
    <div class="section-head"><h2>Learning departments</h2><span class="muted small">Choose a department</span></div>
    <div class="department-grid">
      ${departmentCard("chw","＋","Community Health","18 focused subjects","CHW")}
      ${departmentCard("coding","⌘","Coding and Technology","12 technology subjects","CODE")}
      ${departmentCard("general","◫","General Studies","8 academic subjects","GENERAL")}
    </div>
    <div class="section-head"><h2>Study toolkit</h2></div>
    <div class="tool-grid">
      ${tile("✦","AI Tutor","Ask, explain or generate revision help.","tutor")}
      ${tile("✓","Question Bank","Timed quizzes, corrections and performance.","questionbank")}
      ${tile("▤","My Notes",`${notes.length} notes saved locally.`,"notes")}
      ${tile("▣","Flashcards","Practise active recall.","cards")}
      ${tile("▦","Study Planner",`${incomplete} task${incomplete === 1 ? "" : "s"} remaining.`,"planner")}
    </div>`;
}

function departmentCard(key, icon, title, description, label) {
  const department = departments[key];
  return `<article class="department-card ${key}" data-department="${key}">
    <span class="department-label">${label}</span><span class="department-icon">${icon}</span>
    <h3>${title}</h3><p>${description}</p><div class="department-action">Explore subjects <span>→</span></div>
  </article>`;
}

function departmentView() {
  const department = departments[state.view];
  if (!department) return home();
  $("#view").innerHTML = `
    <section class="department-banner ${state.view}">
      <span class="department-label">${department.short}</span>
      <h2>${department.name}</h2><p>${department.description}</p>
    </section>
    <div class="section-head"><h2>Subjects</h2><label class="search-field"><span>⌕</span><input id="subject-search" type="search" placeholder="Search subjects"></label></div>
    <div class="subject-grid" id="subject-grid">${department.subjects.map(subjectCard).join("")}</div>`;
  $("#subject-search").addEventListener("input", event => {
    const term = event.target.value.toLowerCase();
    $$(".subject-card").forEach(card => card.hidden = !card.textContent.toLowerCase().includes(term));
  });
}

function subjectCard(subject) {
  const department = departments[state.view];
  const progress = get("subjectProgress", {})[`${state.view}:${subject}`] || 0;
  return `<article class="subject-card" data-subject="${escapeHTML(subject)}">
    <div class="subject-top"><span class="subject-code">${escapeHTML(department.short)}</span><span class="progress-ring" style="--progress:${progress * 3.6}deg">${progress}%</span></div>
    <h3>${escapeHTML(subject)}</h3>
    <p>Lessons · notes · flashcards · quizzes</p>
    <div class="progress-bar"><span style="width:${progress}%"></span></div>
    <button class="link-button" data-open-subject="${escapeHTML(subject)}">Open subject →</button>
  </article>`;
}

function openSubject(department, subject) {
  state.department = department;
  state.subject = subject;
  const cards = get("flashcards", []).filter(card => card.department === department && card.subject === subject);
  const key = `${department}:${subject}`;
  const progress = get("subjectProgress", {})[key] || 0;
  $("#view").innerHTML = `
    <div class="breadcrumbs"><button data-go="${department}">${departments[department].name}</button><span>/</span><strong>${escapeHTML(subject)}</strong></div>
    <section class="subject-header"><div><span class="department-label">${departments[department].short}</span><h2>${escapeHTML(subject)}</h2><p>Study resources for this subject.</p></div><div class="subject-progress"><strong>${progress}%</strong><span>progress</span></div></section>
    <div class="resource-grid">
      ${tile("▤","Study notes","Create or review subject notes.","#subject-notes")}
      ${tile("▣","Flashcards",`${cards.length} subject cards saved.`,"#subject-cards")}
      ${tile("✓","Topic quiz","Set difficulty and question count.","#subject-quiz")}
      ${tile("✦","Ask the tutor","Ask a question with this subject selected.","tutor")}
    </div>
    <div class="panel"><h3>Recommended study flow</h3><ol><li>Read a short lesson or course note.</li><li>Summarise the topic in your own words.</li><li>Use flashcards for active recall.</li><li>Complete a quiz and review every explanation.</li></ol></div>`;
}

function tutor() {
  const department = departments[state.department];
  $("#view").innerHTML = `
    <div class="two-col">
      <div class="panel tutor-panel">
        <div class="tutor-context"><div><span class="muted small">CURRENT CONTEXT</span><strong>${escapeHTML(department.name)}${state.subject ? " · " + escapeHTML(state.subject) : ""}</strong></div><button class="btn secondary" id="clear-chat">Clear chat</button></div>
        <div id="chat-log" class="chat-log"></div>
        <textarea id="question" rows="3" placeholder="Ask a question, request revision notes or explain an incorrect answer…"></textarea>
        <div class="row"><button class="btn" id="ask-btn">Send question</button><span class="muted small" id="ai-mode">Checking AI connection…</span></div>
      </div>
      <aside class="panel stack">
        <h3>Study context</h3>
        <label>Department<select id="tutor-department">${Object.entries(departments).map(([key, value]) => `<option value="${key}" ${key === state.department ? "selected" : ""}>${value.name}</option>`).join("")}</select></label>
        <label>Subject<select id="tutor-subject"></select></label>
        <h3>Useful prompts</h3>
        ${["Explain this topic step by step.","Generate 5 revision questions.","Turn these notes into a summary.","Explain why my quiz answer was wrong."].map(prompt => `<button class="prompt-button">${escapeHTML(prompt)}</button>`).join("")}
        <p class="muted small">Health information is educational, not a diagnosis or clinical advice. Coding examples run only in a safe playground, never automatically on the server.</p>
      </aside>
    </div>`;
  const log = $("#chat-log");
  state.chat.forEach(message => addBubble(log, message.role, message.content));
  if (!state.chat.length) addBubble(log, "assistant", "Hello! Tell me what you are studying, and I can explain it step by step or generate revision practice.");
  const departmentSelect = $("#tutor-department");
  const subjectSelect = $("#tutor-subject");
  function loadSubjects() {
    const key = departmentSelect.value;
    subjectSelect.innerHTML = `<option value="">Any subject</option>` + departments[key].subjects.map(subject => `<option ${subject === state.subject ? "selected" : ""}>${subject}</option>`).join("");
  }
  loadSubjects();
  departmentSelect.addEventListener("change", () => {
    state.department = departmentSelect.value;
    state.subject = "";
    loadSubjects();
  });
  subjectSelect.addEventListener("change", () => state.subject = subjectSelect.value);
  $("#ask-btn").addEventListener("click", () => askTutor());
  $("#question").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askTutor(); }
  });
  $("#clear-chat").addEventListener("click", () => { state.chat = []; set("chat", state.chat); log.innerHTML = ""; addBubble(log, "assistant", "Chat cleared. What would you like to learn?"); });
  $$(".prompt-button").forEach(button => button.addEventListener("click", () => { $("#question").value = button.textContent; askTutor(); }));
  updateAiMode();
}

function addBubble(log, role, text) {
  const bubble = document.createElement("div");
  bubble.className = "bubble " + role;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

async function askTutor() {
  const input = $("#question");
  const text = input.value.trim();
  if (!text) return toast("Write a question first.");
  input.value = "";
  const log = $("#chat-log");
  addBubble(log, "user", text);
  state.chat.push({role:"user", content:text});
  set("chat", state.chat);
  $("#ask-btn").disabled = true;
  $("#ai-mode").textContent = "Thinking…";
  let answer;
  if (navigator.onLine) {
    try {
      const response = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          department:departments[state.department].name,
          subject:state.subject,
          messages:state.chat.slice(-12)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Online AI unavailable");
      answer = data.reply;
      $("#ai-mode").textContent = "Online AI tutor";
    } catch (error) {
      answer = offlineAnswer(text);
      $("#ai-mode").textContent = "Offline helper · " + error.message;
    }
  } else {
    answer = offlineAnswer(text);
    $("#ai-mode").textContent = "Offline study helper";
  }
  addBubble(log, "assistant", answer);
  state.chat.push({role:"assistant", content:answer});
  set("chat", state.chat);
  $("#ask-btn").disabled = false;
}

async function updateAiMode() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    $("#ai-mode").textContent = status.onlineAiConfigured ? "Online AI connected" : "Online AI not configured · offline helper available";
  } catch (_) {
    $("#ai-mode").textContent = navigator.onLine ? "Could not check AI connection" : "Offline study helper";
  }
}

function offlineAnswer(question) {
  const documents = get("documents", []);
  const text = question.toLowerCase();
  const answer = answerFromDocuments(question);
  if (answer) return answer;
  const entries = [
    [/primary health care|\\bphc\\b/, "Primary health care is accessible, essential care at the first point of contact. It includes prevention, health promotion, basic treatment, rehabilitation and community participation."],
    [/health promotion/, "Health promotion enables people to increase control over their health. It combines education, supportive environments and public policy; it is not only information about disease."],
    [/html/, "HTML gives a web page its structure using elements such as headings, paragraphs, links and forms. CSS controls presentation, while JavaScript controls behaviour."],
    [/javascript|\\bjs\\b/, "JavaScript is a programming language used to add behaviour to web pages and applications. A variable stores a value, a function groups actions, and a loop repeats work."],
    [/python/, "Python uses readable statements and indentation to define structure. Example: name = 'Amina'; print(name) stores text and prints it."],
    [/immuni|vaccine/, "Immunisation prepares the immune system to recognise and respond to specific diseases. Keep vaccine schedules and contraindications in line with approved course and public-health guidance."],
    [/epidemiology|incidence|prevalence/, "Epidemiology studies how health conditions are distributed in populations and which factors influence that distribution. Incidence describes new cases; prevalence describes existing cases over a time point or period."]
  ];
  const match = entries.find(([pattern]) => pattern.test(text));
  if (match) return match[1] + "\n\nThis is an offline study explanation, not professional medical advice.";
  if (documents.length) return `No strong passage matched your question in the ${documents.length} saved document${documents.length === 1 ? "" : "s"}. Try more specific terms, or open My Notes and add a clearer excerpt.\n\nThis offline result uses saved-document retrieval, not a local language model.`;
  return "The offline helper can answer a limited set of study concepts and search your saved documents. Try asking about primary health care, health promotion, HTML, JavaScript, Python, immunisation or epidemiology. Connect to an AI provider for broader generated explanations.";
}

function answerFromDocuments(question) {
  const documents = get("documents", []);
  if (!documents.length) return null;
  const terms = question.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(term => term.length > 3);
  if (!terms.length) return null;
  const passages = [];
  documents.forEach(document => {
    const chunks = document.text.split(/(?<=[.!?\n])\s+/).filter(chunk => chunk.trim().length > 30);
    chunks.forEach(chunk => {
      const lower = chunk.toLowerCase();
      const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
      if (hits) passages.push({document:document.name, text:chunk.trim().slice(0,600), hits});
    });
  });
  passages.sort((a,b) => b.hits-a.hits);
  if (!passages.length) return null;
  const top = passages.slice(0,3);
  return "Based on saved study material:\n\n" + top.map(passage => `“${passage.text}”\nSource: ${passage.document}`).join("\n\n") + "\n\nThis is passage retrieval from saved material, not an independently verified clinical or exam answer.";
}

async function loadQuestions() {
  if (state.questions.length) return state.questions;
  try {
    const response = await fetch("/questions.json");
    if (response.ok) {
      const imported = await response.json();
      if (Array.isArray(imported)) state.questions = imported;
    }
  } catch (_) {}
  if (!state.questions.length) state.questions = get("questions", []);
  return state.questions;
}

function questionbank() {
  const department = state.department;
  $("#view").innerHTML = `
    <div class="question-toolbar panel">
      <label>Department<select id="quiz-department">
        ${Object.entries(departments).map(([key,value]) => `<option value="${key}" ${key === department ? "selected" : ""}>${value.name}</option>`).join("")}
      </select></label>
      <label>Subject<select id="quiz-subject"></select></label>
      <label>Difficulty<select id="quiz-difficulty"><option value="">All</option><option>beginner</option><option>intermediate</option><option>advanced</option></select></label>
      <label>Questions<select id="quiz-count"><option>5</option><option>10</option><option>15</option><option>20</option></select></label>
      <label>Mode<select id="quiz-mode"><option value="untimed">Untimed</option><option value="timed">Timed</option></select></label>
      <button class="btn" id="start-quiz">Start quiz</button>
      <label class="btn secondary file-button">Import JSON<input id="import-questions" type="file" accept=".json,application/json" hidden></label>
    </div>
    <div id="quiz-area" class="quiz-area"></div>`;
  const departmentSelect = $("#quiz-department");
  const subjectSelect = $("#quiz-subject");
  function loadSubjects() {
    const key = departmentSelect.value;
    subjectSelect.innerHTML = `<option value="">All subjects</option>` + departments[key].subjects.map(subject => `<option ${subject === state.subject ? "selected" : ""}>${subject}</option>`).join("");
  }
  loadSubjects();
  departmentSelect.addEventListener("change", () => { state.department = departmentSelect.value; loadSubjects(); });
  subjectSelect.addEventListener("change", () => state.subject = subjectSelect.value);
  $("#start-quiz").addEventListener("click", startQuiz);
  $("#import-questions").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const valid = parsed.filter(question => question.department && question.subject && question.topic && question.type && question.question);
      if (!valid.length) throw new Error("No valid question records found.");
      const custom = get("questions", []);
      set("questions", custom.concat(valid));
      state.questions = state.questions.concat(valid);
      toast(`${valid.length} questions imported.`);
    } catch (error) { toast(error.message); }
  });
  if (state.quiz) renderQuiz();
  else $("#quiz-area").innerHTML = `<div class="panel empty">Select filters, then start a quiz. Correct answers include short explanations.</div>`;
}

async function startQuiz() {
  await loadQuestions();
  const departmentKey = $("#quiz-department").value;
  const subject = $("#quiz-subject").value;
  const difficulty = $("#quiz-difficulty").value;
  const count = Number($("#quiz-count").value);
  let pool = state.questions.filter(question =>
    (!subject || question.subject === subject) &&
    (!difficulty || question.difficulty === difficulty) &&
    (!departmentKey || question.department === departmentKey)
  );
  if (!pool.length) pool = state.questions.filter(question => question.department === departmentKey);
  if (!pool.length) {
    $("#quiz-area").innerHTML = `<div class="panel empty">No questions are available for these filters yet. Import a JSON question bank or choose another subject.</div>`;
    return;
  }
  pool = shuffle(pool).slice(0, count);
  pool = pool.map(question => {
    if (question.type === "mcq") {
      const entries = question.options.map((text,index) => ({text,index}));
      const shuffled = shuffle(entries);
      return {...question, options:shuffled.map(entry => entry.text), correctIndex:shuffled.findIndex(entry => entry.index === question.correctIndex)};
    }
    return {...question};
  });
  state.quiz = {
    index:0, score:0, answers:[], questions:pool,
    mode:$("#quiz-mode").value, seconds:count * 60, timer:null
  };
  renderQuiz();
  if (state.quiz.mode === "timed") {
    state.quiz.timer = setInterval(() => {
      state.quiz.seconds--;
      const timer = $("#quiz-timer");
      if (timer) timer.textContent = formatTime(state.quiz.seconds);
      if (state.quiz.seconds <= 0) finishQuiz();
    },1000);
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2,"0")}`;
}

function renderQuiz() {
  if (!state.quiz) return;
  if (state.quiz.index >= state.quiz.questions.length) return finishQuiz();
  const quiz = state.quiz;
  const question = quiz.questions[quiz.index];
  $("#quiz-area").innerHTML = `
    <div class="panel quiz-panel">
      <div class="quiz-meta"><span>Question ${quiz.index + 1} of ${quiz.questions.length}</span>${quiz.mode === "timed" ? `<strong id="quiz-timer">${formatTime(quiz.seconds)}</strong>` : `<span>Untimed</span>`}</div>
      <div class="progress-bar"><span style="width:${quiz.index / quiz.questions.length * 100}%"></span></div>
      <span class="question-tags">${escapeHTML(question.topic)} · ${escapeHTML(question.difficulty || "general")}${question.generated ? " · AI-generated" : ""}</span>
      <h2>${escapeHTML(question.question)}</h2>
      <div id="quiz-answer-area">${renderAnswerControls(question)}</div>
      <div id="quiz-feedback" class="quiz-feedback"></div>
      <div class="row"><button class="btn" id="check-answer">Check answer</button><button class="btn secondary" id="next-answer" disabled>${quiz.index === quiz.questions.length - 1 ? "View results" : "Next question"}</button><button class="btn danger" id="quit-quiz">End quiz</button></div>
    </div>`;
  $("#check-answer").addEventListener("click", checkAnswer);
  $("#next-answer").addEventListener("click", () => {
    quiz.index++;
    renderQuiz();
  });
  $("#quit-quiz").addEventListener("click", finishQuiz);
  if (question.type === "truefalse") $$("#quiz-answer-area .answer").forEach(label => label.addEventListener("change", () => {
    $$(".answer").forEach(item => item.classList.remove("selected"));
    label.classList.add("selected");
  }));
}

function renderAnswerControls(question) {
  if (question.type === "mcq") return question.options.map((option,index) => `<label class="answer"><input type="radio" name="answer" value="${index}"><span>${escapeHTML(option)}</span></label>`).join("");
  if (question.type === "truefalse") return ["True","False"].map((option,index) => `<label class="answer"><input type="radio" name="answer" value="${index === 0 ? "true" : "false"}"><span>${option}</span></label>`).join("");
  return `<input class="field" id="short-answer" placeholder="Type a short answer">`;
}

function checkAnswer() {
  const quiz = state.quiz;
  const question = quiz.questions[quiz.index];
  let chosen = null;
  if (question.type === "short") {
    chosen = $("#short-answer").value.trim();
  } else {
    const selected = $('input[name="answer"]:checked');
    if (!selected) return toast("Choose an answer first.");
    chosen = selected.value;
  }
  let correct = false;
  if (question.type === "mcq") correct = Number(chosen) === question.correctIndex;
  if (question.type === "truefalse") correct = String(chosen).toLowerCase() === String(question.correctAnswer).toLowerCase();
  if (question.type === "short") {
    const accepted = [question.correctAnswer, ...(question.acceptedAnswers || [])].map(value => String(value).toLowerCase().trim());
    correct = accepted.includes(chosen.toLowerCase());
  }
  if (correct) quiz.score++;
  quiz.answers.push({question, chosen, correct});
  const result = correct ? "Correct." : "Not quite.";
  $("#quiz-feedback").innerHTML = `<strong>${result}</strong> ${escapeHTML(question.explanation)}${question.generated ? "<div><button class=\"link-button report-question\">Report an error</button></div>" : ""}`;
  $("#check-answer").disabled = true;
  $("#next-answer").disabled = false;
  if ($(".report-question")) $(".report-question").addEventListener("click", () => toast("Error report saved for review on this device."));
  const progress = get("subjectProgress", {});
  const key = `${question.department}:${question.subject}`;
  progress[key] = Math.min(100, (progress[key] || 0) + 2);
  set("subjectProgress", progress);
  recordPerformance(question, correct);
}

function recordPerformance(question, correct) {
  const performance = get("performance", []);
  performance.unshift({department:question.department, subject:question.subject, topic:question.topic, correct, date:new Date().toISOString()});
  set("performance", performance.slice(0,500));
}

function finishQuiz() {
  if (!state.quiz) return;
  if (state.quiz.timer) clearInterval(state.quiz.timer);
  const quiz = state.quiz;
  const incorrect = quiz.answers.filter(answer => !answer.correct);
  const total = quiz.answers.length;
  const score = quiz.score;
  $("#quiz-area").innerHTML = `
    <div class="panel results-panel">
      <span class="eyebrow">QUIZ RESULTS</span><h2>${total ? Math.round(score / total * 100) : 0}%</h2>
      <p>You answered <strong>${score}</strong> of <strong>${total}</strong> answered questions correctly.</p>
      <div class="progress-bar"><span style="width:${total ? score / total * 100 : 0}%"></span></div>
      ${incorrect.length ? `<h3>Review incorrect answers</h3><div class="review-list">${incorrect.map((item,index) => `<article><strong>${index + 1}. ${escapeHTML(item.question.question)}</strong><p>${escapeHTML(item.question.explanation)}</p><button class="link-button" data-revisit="${incorrect.indexOf(item)}">Revisit this answer</button></article>`).join("")}</div>` : `<div class="panel success-panel">Excellent work. Review all explanations to reinforce retention.</div>`}
      <div class="row"><button class="btn" id="try-again">Try another quiz</button></div>
    </div>`;
  $("#try-again").addEventListener("click", () => startQuiz());
  $$(".review-list [data-revisit]").forEach(button => button.addEventListener("click", () => toast("Review the question and explanation above, then retry when ready.")));
  state.quiz = null;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function notes() {
  const notes = get("notes", []);
  const documents = get("documents", []);
  $("#view").innerHTML = `
    <div class="two-col">
      <div class="panel stack">
        <h2>Create a study note</h2>
        <input class="field" id="note-title" placeholder="Note title">
        <textarea id="note-body" rows="8" placeholder="Write your notes here…"></textarea>
        <div class="row"><button class="btn" id="save-note">Save note</button><label class="btn secondary file-button">Upload study material<input id="document-upload" type="file" accept=".pdf,.txt,.md,.csv" hidden></label></div>
        <p class="muted small">PDF and text documents are saved only in this browser. PDF extraction is text-based and may miss images, scans or complex layouts.</p>
      </div>
      <div class="panel">
        <div class="row" style="justify-content:space-between"><h2>Saved notes and documents</h2><label class="search-field"><input id="document-search" type="search" placeholder="Search text"></label></div>
        <div id="saved-search-results" class="stack"></div>
        <h3>Notes (${notes.length})</h3>
        <div class="stack">${notes.length ? notes.map((note,index) => `<article class="note-item"><div><strong>${escapeHTML(note.title)}</strong><p>${escapeHTML(note.body.slice(0,140))}</p></div><button class="btn secondary" data-delete-note="${index}">Delete</button></article>`).join("") : `<div class="empty">No notes yet.</div>`}</div>
        <h3>Study documents (${documents.length})</h3>
        <div class="stack">${documents.length ? documents.map((document,index) => `<article class="note-item"><div><strong>${escapeHTML(document.name)}</strong><p>${escapeHTML(document.text.slice(0,140))}</p></div><button class="btn secondary" data-delete-document="${index}">Delete</button></article>`).join("") : `<div class="empty">No study documents uploaded.</div>`}</div>
      </div>
    </div>`;
  $("#save-note").addEventListener("click", () => {
    const title = $("#note-title").value.trim();
    const body = $("#note-body").value.trim();
    if (!title || !body) return toast("Add a title and note content.");
    notes.unshift({title,body,department:state.department,subject:state.subject,date:new Date().toISOString()});
    set("notes", notes);
    toast("Note saved locally.");
    notes();
  });
  $$("[data-delete-note]").forEach(button => button.addEventListener("click", () => {
    notes.splice(Number(button.dataset.deleteNote),1); set("notes",notes); notes();
  }));
  $$("[data-delete-document]").forEach(button => button.addEventListener("click", () => {
    documents.splice(Number(button.dataset.deleteDocument),1); set("documents",documents); notes();
  }));
  $("#document-upload").addEventListener("change", uploadDocument);
  $("#document-search").addEventListener("input", searchDocuments);
  searchDocuments();
}

async function uploadDocument(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) return toast("The file exceeds the 12 MB limit.");
  let documentData;
  try {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      const bytes = await file.arrayBuffer();
      let binary = "";
      const bytesArray = new Uint8Array(bytes);
      for (let index = 0; index < bytesArray.length; index += 8192) binary += String.fromCharCode(...bytesArray.subarray(index,index + 8192));
      const response = await fetch("/api/documents", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:file.name,base64:btoa(binary)})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read PDF.");
      documentData = data;
    } else {
      documentData = {name:file.name,text:await file.text(),extraction:"text"};
    }
  } catch (error) { return toast(error.message); }
  const documents = get("documents", []);
  documents.unshift({...documentData, uploaded:new Date().toISOString()});
  set("documents", documents);
  toast("Study document saved.");
  notes();
}

function searchDocuments() {
  const input = $("#document-search");
  if (!input) return;
  const term = input.value.trim().toLowerCase();
  const container = $("#saved-search-results");
  if (!container) return;
  if (!term) { container.innerHTML = ""; return; }
  const documents = get("documents", []);
  const results = [];
  documents.forEach(document => {
    const lower = document.text.toLowerCase();
    let start = lower.indexOf(term);
    if (start >= 0) {
      const passage = document.text.slice(Math.max(0,start-100), Math.min(document.text.length,start+300)).replace(/\s+/g," ").trim();
      results.push({name:document.name, passage});
    }
  });
  container.innerHTML = results.length ? results.map(result => `<article class="passage"><strong>${escapeHTML(result.name)}</strong><p>${escapeHTML(result.passage)}</p></article>`).join("") : `<div class="empty">No matching passage found.</div>`;
}

function cards() {
  const cards = get("flashcards", []);
  $("#view").innerHTML = `
    <div class="two-col">
      <div class="panel stack">
        <h2>Create a flashcard</h2>
        <select id="card-department" class="field">${Object.entries(departments).map(([key,value]) => `<option value="${key}" ${key === state.department ? "selected" : ""}>${value.name}</option>`).join("")}</select>
        <select id="card-subject" class="field"></select>
        <input class="field" id="card-front" placeholder="Question or term">
        <textarea id="card-back" rows="4" placeholder="Answer or explanation"></textarea>
        <button class="btn" id="save-card">Save flashcard</button>
      </div>
      <div class="panel"><h2>Flashcard study</h2><div id="card-study-area"></div></div>
    </div>`;
  const departmentSelect = $("#card-department");
  const subjectSelect = $("#card-subject");
  function loadSubjects() {
    subjectSelect.innerHTML = departments[departmentSelect.value].subjects.map(subject => `<option ${subject === state.subject ? "selected" : ""}>${subject}</option>`).join("");
  }
  loadSubjects();
  departmentSelect.addEventListener("change", loadSubjects);
  $("#save-card").addEventListener("click", () => {
    const front = $("#card-front").value.trim();
    const back = $("#card-back").value.trim();
    if (!front || !back) return toast("Enter both sides of the flashcard.");
    cards.unshift({front,back,department:departmentSelect.value,subject:subjectSelect.value});
    set("flashcards",cards);
    toast("Flashcard saved.");
    cards();
  });
  renderCardsStudy(cards);
}

function renderCardsStudy(cards) {
  if (!cards.length) {
    $("#card-study-area").innerHTML = `<div class="empty">No flashcards yet. Create one beside this panel.</div>`;
    return;
  }
  const card = cards[Math.min(state.cardIndex,cards.length-1)];
  $("#card-study-area").innerHTML = `
    <span class="muted small">${escapeHTML(card.subject)}</span>
    <button class="flashcard" id="flashcard">${escapeHTML(state.cardFlipped ? card.back : card.front)}</button>
    <div class="row" style="justify-content:center"><button class="btn secondary" id="card-prev">Previous</button><button class="btn" id="card-flip">Flip</button><button class="btn secondary" id="card-next">Next</button></div>`;
  $("#flashcard").addEventListener("click", () => { state.cardFlipped = !state.cardFlipped; renderCardsStudy(cards); });
  $("#card-flip").addEventListener("click", () => { state.cardFlipped = !state.cardFlipped; renderCardsStudy(cards); });
  $("#card-prev").addEventListener("click", () => { state.cardIndex=(state.cardIndex-1+cards.length)%cards.length; state.cardFlipped=false; renderCardsStudy(cards); });
  $("#card-next").addEventListener("click", () => { state.cardIndex=(state.cardIndex+1)%cards.length; state.cardFlipped=false; renderCardsStudy(cards); });
}

function planner() {
  const tasks = get("tasks", []);
  $("#view").innerHTML = `
    <div class="two-col">
      <div class="panel stack"><h2>Add a study task</h2><input class="field" id="task-name" placeholder="Study task"><input class="field" id="task-date" type="date"><select id="task-subject" class="field">${Object.entries(departments).map(([key,department]) => `<optgroup label="${department.name}">${department.subjects.map(subject => `<option value="${key}:${subject}">${subject}</option>`).join("")}</optgroup>`).join("")}</select><button class="btn" id="add-task">Add task</button></div>
      <div class="panel"><h2>Your plan</h2><div class="stack" id="task-list">${tasks.length ? tasks.map((task,index) => `<article class="task-item"><label><input type="checkbox" data-task-done="${index}" ${task.done ? "checked" : ""}><span ${task.done ? 'style="text-decoration:line-through;opacity:.65"' : ""}>${escapeHTML(task.name)}</span><small>${escapeHTML(task.subject)} · ${escapeHTML(task.date || "No date")}</small></label><button class="btn secondary" data-task-delete="${index}">×</button></article>`).join("") : `<div class="empty">No tasks planned.</div>`}</div></div>
    </div>`;
  $("#add-task").addEventListener("click", () => {
    const name = $("#task-name").value.trim();
    if (!name) return toast("Enter a study task.");
    tasks.push({name,date:$("#task-date").value,subject:$("#task-subject").selectedOptions[0].text,done:false});
    set("tasks",tasks); planner();
  });
  $$("[data-task-done]").forEach(input => input.addEventListener("change", () => {
    tasks[Number(input.dataset.taskDone)].done = input.checked; set("tasks",tasks); planner();
  }));
  $$("[data-task-delete]").forEach(button => button.addEventListener("click", () => {
    tasks.splice(Number(button.dataset.taskDelete),1); set("tasks",tasks); planner();
  }));
}

function progress() {
  const performance = get("performance", []);
  const progress = get("subjectProgress", {});
  const correct = performance.filter(item => item.correct).length;
  const attempts = performance.length;
  const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
  const bySubject = {};
  performance.forEach(item => {
    const key = `${item.department} · ${item.subject}`;
    bySubject[key] ||= {correct:0,total:0};
    bySubject[key].total++;
    if (item.correct) bySubject[key].correct++;
  });
  $("#view").innerHTML = `
    <div class="metric-grid">
      <article class="metric"><span>Quiz attempts</span><strong>${attempts}</strong></article>
      <article class="metric"><span>Overall accuracy</span><strong>${accuracy}%</strong></article>
      <article class="metric"><span>Subjects started</span><strong>${Object.keys(progress).filter(key => progress[key] > 0).length}</strong></article>
    </div>
    <div class="two-col">
      <div class="panel"><h2>Performance by subject</h2>${Object.keys(bySubject).length ? `<div class="stack">${Object.entries(bySubject).map(([subject,item]) => `<article><div class="row" style="justify-content:space-between"><strong>${escapeHTML(subject)}</strong><span>${item.correct}/${item.total}</span></div><div class="progress-bar"><span style="width:${Math.round(item.correct/item.total*100)}%"></span></div></article>`).join("")}</div>` : `<div class="empty">Complete quizzes to build performance data.</div>`}</div>
      <div class="panel"><h2>Recent activity</h2>${performance.length ? `<div class="stack">${performance.slice(0,12).map(item => `<article class="activity-item"><span class="${item.correct ? "good" : "retry"}">${item.correct ? "Correct" : "Review"}</span><div><strong>${escapeHTML(item.subject)}</strong><p>${escapeHTML(item.topic)}</p></div></article>`).join("")}</div>` : `<div class="empty">No quiz activity yet.</div>`}</div>
    </div>`;
}

function settings() {
  const theme = document.documentElement.dataset.theme || "light";
  $("#view").innerHTML = `
    <div class="settings-grid">
      <div class="panel stack"><h2>Appearance</h2><p class="muted">Choose the display theme.</p><div class="row"><button class="btn ${theme === "light" ? "" : "secondary"}" id="set-light">Light mode</button><button class="btn ${theme === "dark" ? "" : "secondary"}" id="set-dark">Dark mode</button></div></div>
      <div class="panel stack"><h2>Study data</h2><p class="muted">Export notes, documents and performance for a backup.</p><button class="btn" id="export-data">Export JSON backup</button><button class="btn secondary" id="clear-data">Clear local study data</button></div>
      <div class="panel stack"><h2>AI provider status</h2><div id="settings-ai-status" class="muted">Checking…</div><p class="muted small">API keys are configured only on the server. See README.md for setup variables.</p></div>
      <div class="panel stack"><h2>Offline mode</h2><p class="muted">Previously cached lessons and question data are available from the PWA cache. Saved documents remain in browser storage.</p><button class="btn secondary" id="check-offline">Check cache status</button></div>
    </div>`;
  $("#set-light").addEventListener("click", () => setTheme("light"));
  $("#set-dark").addEventListener("click", () => setTheme("dark"));
  $("#export-data").addEventListener("click", exportData);
  $("#clear-data").addEventListener("click", () => {
    if (!confirm("Clear all Varen Study AI notes, documents, planner tasks and progress?")) return;
    Object.keys(localStorage).filter(key => key.startsWith("vsa_")).forEach(key => localStorage.removeItem(key));
    toast("Local study data cleared.");
  });
  $("#check-offline").addEventListener("click", async () => {
    const keys = await caches.keys();
    toast(keys.some(key => key.startsWith("varen-study-ai")) ? "PWA cache available." : "PWA cache is not ready.");
  });
  updateSettingsAiStatus();
}

async function updateSettingsAiStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    $("#settings-ai-status").textContent = status.onlineAiConfigured
      ? `Connected provider configuration: ${status.provider} · ${status.model}`
      : "Online AI is not configured. Offline tools remain available.";
  } catch (_) {
    $("#settings-ai-status").textContent = navigator.onLine ? "Could not contact the server status endpoint." : "Offline mode: server status unavailable.";
  }
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("vsa_theme",theme);
  settings();
  toast(`${theme === "dark" ? "Dark" : "Light"} mode enabled.`);
}

function exportData() {
  const backup = {};
  Object.keys(localStorage).filter(key => key.startsWith("vsa_")).forEach(key => {
    try { backup[key.slice(4)] = JSON.parse(localStorage.getItem(key)); }
    catch (_) { backup[key.slice(4)] = localStorage.getItem(key); }
  });
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "varen-study-ai-backup.json";
  link.click();
  URL.revokeObjectURL(url);
  toast("Backup downloaded.");
}

$("#nav").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (button) go(button.dataset.view);
});
$("#menu-btn").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$("#theme-btn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
document.documentElement.dataset.theme = localStorage.getItem("vsa_theme") || "light";

window.addEventListener("online", () => $("#connection-label").textContent = "Online · offline-ready");
window.addEventListener("offline", () => $("#connection-label").textContent = "Offline-ready");
$("#connection-label").textContent = navigator.onLine ? "Online · offline-ready" : "Offline-ready";

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", event => {
  event.preventEvent?.();
  event.preventDefault();
  deferredInstall = event;
  $("#install-btn").hidden = false;
});
$("#install-btn").addEventListener("click", async () => {
  if (!deferredInstall) return toast("Use your browser menu to install Varen Study AI.");
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("#install-btn").hidden = true;
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

$("#view").addEventListener("click", event => {
  const departmentCard = event.target.closest("[data-department]");
  if (departmentCard) return go(departmentCard.dataset.department);
  const tile = event.target.closest("[data-go]");
  if (tile) return go(tile.dataset.go);
  const subject = event.target.closest("[data-open-subject]");
  if (subject) return openSubject(state.department, subject.dataset.openSubject);
  const subjectCard = event.target.closest("[data-subject]");
  if (subjectCard) return openSubject(state.view, subjectCard.dataset.subject);
  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "#subject-notes") return notes();
    if (action.dataset.action === "#subject-cards") return cards();
    if (action.dataset.action === "#subject-quiz") return questionbank();
  }
});

render();
