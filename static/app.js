/* ==========================================================================
   QauliRAG frontend
   Talks to the FastAPI backend:
     GET  /api/health  -> { status, service }
     POST /api/chat    -> { answer, source_used, trace, citations, rewritten_query }
     POST /api/ingest  -> { message, file, chunks, ids_created }   (needs X-Admin-Key header)

   Sections:
   1. Settings and constants
   2. Small helpers (escaping, markdown, API requests)
   3. Workflow graph (drawing + highlighting the path a run took)
   4. Inspector (summary, trace, sources)
   5. Chat
   6. Upload dialog
   7. Layout, theme, health check
   ========================================================================== */
"use strict";

/* ---------- 1. Settings and constants ---------- */
const API = {
  health: "/api/health",
  chat: "/api/chat",
  ingest: "/api/ingest",
};

const MIN_CHARS = 2;        // matches ChatRequest min_length
const MAX_CHARS = 3000;     // matches ChatRequest max_length
const CHAT_TIMEOUT_MS = 120000;
const UPLOAD_TIMEOUT_MS = 300000;
const SUPPORTED_TYPES = [".pdf", ".txt", ".md", ".docx"];   // matches SUPPORTED in routes.py
const STEP_MS = 150;        // speed of the path animation in the graph

// The four values workflow.py can return in source_used
const ROUTES = {
  private_kb: {
    label: "Knowledge base",
    cls: "kb",
    summary: "Answered from the Brightwick knowledge base.",
  },
  web_search: {
    label: "Web search",
    cls: "web",
    summary: "The knowledge base didn't cover this, so the answer came from the web.",
  },
  direct: {
    label: "Direct reply",
    cls: "direct",
    summary: "Small talk, so no documents were searched.",
  },
  insufficient_evidence: {
    label: "Not enough evidence",
    cls: "none",
    summary: "Neither the knowledge base nor the web had reliable evidence, so the agent pointed to the service desk.",
  },
};

// Graph nodes. x, y are the centre of each box inside the 372 x 420 viewBox.
const NODES = {
  start:        { x: 186, y: 18,  w: 56,  h: 22, label: "Start", kind: "start" },
  route:        { x: 186, y: 64,  w: 128, h: 34, label: "Route question" },
  retrieve:     { x: 186, y: 128, w: 128, h: 34, label: "Retrieve from KB" },
  grade_kb:     { x: 186, y: 192, w: 128, h: 34, label: "Grade KB evidence" },
  search_web:   { x: 186, y: 256, w: 128, h: 34, label: "Search the web" },
  grade_web:    { x: 186, y: 320, w: 128, h: 34, label: "Grade web evidence" },
  insufficient: { x: 186, y: 392, w: 128, h: 34, label: "Not enough evidence", kind: "end" },
  direct:       { x: 58,  y: 128, w: 104, h: 34, label: "Direct reply", kind: "end" },
  gen_kb:       { x: 58,  y: 256, w: 104, h: 34, label: "Answer from KB", kind: "end" },
  gen_web:      { x: 58,  y: 392, w: 104, h: 34, label: "Answer from web", kind: "end" },
  rewrite:      { x: 314, y: 224, w: 100, h: 34, label: "Rewrite query" },
};

// Graph edges: [from, to, fromSide, toSide, label, labelX, labelY, labelAnchor]
const EDGES = [
  ["start", "route", "bottom", "top"],
  ["route", "direct", "left", "top", "small talk", 96, 57, "middle"],
  ["route", "retrieve", "bottom", "top", "IT question", 192, 100, "start"],
  ["retrieve", "grade_kb", "bottom", "top"],
  ["grade_kb", "gen_kb", "left", "top", "good", 96, 185, "middle"],
  ["grade_kb", "search_web", "bottom", "top", "weak", 192, 228, "start"],
  ["search_web", "grade_web", "bottom", "top"],
  ["grade_web", "gen_web", "left", "top", "good", 96, 313, "middle"],
  ["grade_web", "rewrite", "right", "bottom", "weak, retry", 258, 335, "start"],
  ["grade_web", "insufficient", "bottom", "top", "no retries left", 192, 361, "start"],
  ["rewrite", "retrieve", "top", "right", "new query", 320, 172, "start"],
];

// Maps a trace line from workflow.py to the graph node it came from.
// Order matters: e.g. "Router → DIRECT" must match the router rule before the direct rule.
const TRACE_RULES = [
  [/^\s*router|routed to/i, "route"],
  [/^\s*query rewrite/i, "rewrite"],
  [/answer generation.*(private|kb)/i, "gen_kb"],
  [/answer generation.*web/i, "gen_web"],
  [/^\s*direct/i, "direct"],
  [/insufficient|^\s*stopped/i, "insufficient"],
  [/kb evidence/i, "grade_kb"],
  [/web evidence/i, "grade_web"],
  [/web fallback|tavily/i, "search_web"],
  [/retriev/i, "retrieve"],
];

const ICONS = {
  file: '<svg viewBox="0 0 20 20" class="icon" aria-hidden="true"><path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/></svg>',
  globe: '<svg viewBox="0 0 20 20" class="icon" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5Z"/></svg>',
  path: '<svg viewBox="0 0 20 20" class="icon" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="15" cy="10" r="2"/><circle cx="5" cy="15" r="2"/><path d="M7 5.8 13 9.2M13 10.8 7 14.2"/></svg>',
  copy: '<svg viewBox="0 0 20 20" class="icon" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>',
  retry: '<svg viewBox="0 0 20 20" class="icon" aria-hidden="true"><path d="M3.5 10a6.5 6.5 0 1 0 2-4.7M3.5 3v3.5H7"/></svg>',
  agent: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="10" cy="10" r="3" fill="var(--accent)"/><circle cx="22" cy="16" r="3" fill="var(--accent)"/><circle cx="10" cy="22" r="3" fill="var(--accent)"/><path d="M12.6 11.4 L19.4 14.6 M19.4 17.4 L12.6 20.6" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

/* ---------- DOM references ---------- */
const $ = (id) => document.getElementById(id);

const el = {
  app: $("app"),
  brandName: $("brandName"),
  newChat: $("newChat"),
  openUpload: $("openUpload"),
  uploadHistory: $("uploadHistory"),
  health: $("health"),
  healthText: $("healthText"),
  themeToggle: $("themeToggle"),
  themeLabel: $("themeLabel"),
  openSidebar: $("openSidebar"),
  openInspector: $("openInspector"),
  closeInspector: $("closeInspector"),
  scrim: $("scrim"),

  chat: $("chat"),
  welcome: $("welcome"),
  messages: $("messages"),
  form: $("chatForm"),
  question: $("question"),
  charCount: $("charCount"),
  sendBtn: $("sendBtn"),

  inspectorSubtitle: $("inspectorSubtitle"),
  graph: $("graph"),
  runSummary: $("runSummary"),
  sumSource: $("sumSource"),
  sumRewrites: $("sumRewrites"),
  sumTime: $("sumTime"),
  sumQueryRow: $("sumQueryRow"),
  sumQuery: $("sumQuery"),
  tabTrace: $("tabTrace"),
  tabSources: $("tabSources"),
  panelTrace: $("panelTrace"),
  panelSources: $("panelSources"),
  traceCount: $("traceCount"),
  sourceCount: $("sourceCount"),
  traceList: $("traceList"),
  traceEmpty: $("traceEmpty"),
  sourceList: $("sourceList"),
  sourcesEmpty: $("sourcesEmpty"),

  uploadDialog: $("uploadDialog"),
  uploadForm: $("uploadForm"),
  closeUpload: $("closeUpload"),
  cancelUpload: $("cancelUpload"),
  adminKey: $("adminKey"),
  dropzone: $("dropzone"),
  fileInput: $("fileInput"),
  dropzoneMain: $("dropzoneMain"),
  dropzoneSub: $("dropzoneSub"),
  uploadStatus: $("uploadStatus"),
  uploadBtn: $("uploadBtn"),

  toast: $("toast"),
};

/* ---------- App state ---------- */
const state = {
  busy: false,
  runs: new Map(),        // run id -> run data, so any answer can be re-inspected
  activeRunId: null,
  nextRunId: 1,
  conversation: 0,        // bumps on "New conversation" so late responses are ignored
  controller: null,       // AbortController for the request in flight
  selectedFile: null,
  uploading: false,
};

/* ---------- 2. Helpers ---------- */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[c]);
}

// Formatting inside a line: `code`, **bold**, *italic*, [text](https://link)
// The text is already HTML-escaped before this runs, so nothing from the model can inject HTML.
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// A small, safe markdown renderer for answers: headings, bullet lists, numbered lists, paragraphs.
function renderMarkdown(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  let html = "";
  let listType = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html += `<p>${renderInline(paragraph.join("<br>"))}</p>`;
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    let match;

    if (!line.trim()) {
      flushParagraph();
      closeList();
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      closeList();
    } else if ((match = line.match(/^\s*#{1,6}\s+(.*)$/))) {
      flushParagraph();
      closeList();
      html += `<h4>${renderInline(match[1])}</h4>`;
    } else if ((match = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html += "<ul>";
        listType = "ul";
      }
      html += `<li>${renderInline(match[1])}</li>`;
    } else if ((match = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html += `<ol start="${Number(match[1])}">`;
        listType = "ol";
      }
      html += `<li>${renderInline(match[2])}</li>`;
    } else {
      closeList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  return html;
}

function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function normalise(text) {
  return String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function routeInfo(source) {
  return ROUTES[source] || { label: source || "Unknown", cls: "direct", summary: "" };
}

// Turns any FastAPI error body into a readable message
function errorMessage(data, response) {
  const detail = data && data.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    // 422 validation errors come back as a list of { loc, msg, type }
    const text = detail.map((item) => item && item.msg).filter(Boolean).join("; ");
    if (text) return text;
  }
  return `Request failed with status ${response.status}${response.statusText ? ` (${response.statusText})` : ""}.`;
}

// fetch + timeout + JSON parsing + readable errors, used by every API call
async function requestJson(url, options = {}, timeoutMs = 30000, externalSignal = null) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener("abort", onExternalAbort);

  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error("The request took too long and was stopped. Try again.");
    if (externalSignal && externalSignal.aborted) {
      const abortError = new Error("Request cancelled.");
      abortError.name = "AbortError";
      throw abortError;
    }
    throw new Error("Couldn't reach the API. Check that the FastAPI server is running.");
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) throw new Error(errorMessage(data, response));
  if (data === null) throw new Error("The server sent back a response that isn't JSON.");
  return data;
}

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3200);
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const narrowScreen = window.matchMedia("(max-width: 1279px)");

/* ---------- 3. Workflow graph ---------- */
const SVG_NS = "http://www.w3.org/2000/svg";
const graphParts = { nodes: {}, edges: {}, labels: {}, badges: {} };
let graphTimers = [];

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function anchor(id, side) {
  const n = NODES[id];
  if (side === "top") return [n.x, n.y - n.h / 2];
  if (side === "bottom") return [n.x, n.y + n.h / 2];
  if (side === "left") return [n.x - n.w / 2, n.y];
  return [n.x + n.w / 2, n.y];
}

function edgePath(from, to, fromSide, toSide) {
  const [x1, y1] = anchor(from, fromSide);
  const [x2, y2] = anchor(to, toSide);
  if (x1 === x2 || y1 === y2) return `M${x1} ${y1} L${x2} ${y2}`;
  // Curved elbow: leave the first node sideways (or upwards), then turn into the second
  const vertical = fromSide === "top" || fromSide === "bottom";
  const cx = vertical ? x1 : x2;
  const cy = vertical ? y2 : y1;
  return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
}

function buildGraph() {
  const g = el.graph;

  const defs = svg("defs");
  for (const [id, cls] of [["qa-arrow", "g-arrow"], ["qa-arrow-on", "g-arrow-on"]]) {
    const marker = svg("marker", {
      id,
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      markerUnits: "userSpaceOnUse",
      orient: "auto",
    });
    marker.appendChild(svg("path", { d: "M0 0 L10 5 L0 10 z", class: cls }));
    defs.appendChild(marker);
  }
  g.appendChild(defs);

  const edgeLayer = svg("g");
  const labelLayer = svg("g");
  const nodeLayer = svg("g");

  for (const [from, to, fromSide, toSide, label, lx, ly, anchorPos] of EDGES) {
    const key = `${from}>${to}`;
    const path = svg("path", {
      d: edgePath(from, to, fromSide, toSide),
      class: "g-edge",
      "marker-end": "url(#qa-arrow)",
    });
    edgeLayer.appendChild(path);
    graphParts.edges[key] = path;

    if (label) {
      const text = svg("text", { x: lx, y: ly, class: "g-label", "text-anchor": anchorPos });
      text.textContent = label;
      labelLayer.appendChild(text);
      graphParts.labels[key] = text;
    }
  }

  for (const [id, n] of Object.entries(NODES)) {
    const group = svg("g", { class: `g-node${n.kind ? ` is-${n.kind}` : ""}`, "data-node": id });
    group.appendChild(svg("rect", {
      x: n.x - n.w / 2,
      y: n.y - n.h / 2,
      width: n.w,
      height: n.h,
      rx: n.kind === "start" ? n.h / 2 : 8,
    }));
    const text = svg("text", { x: n.x, y: n.y + 4, "text-anchor": "middle" });
    text.textContent = n.label;
    group.appendChild(text);

    // "×2" badge, shown when a node runs more than once (the retry loop)
    const badge = svg("g", { class: "g-badge", visibility: "hidden" });
    const bx = n.x + n.w / 2 - 10;
    const by = n.y - n.h / 2;
    badge.appendChild(svg("rect", { x: bx - 11, y: by - 7, width: 22, height: 14, rx: 7 }));
    const badgeText = svg("text", { x: bx, y: by + 3.5, "text-anchor": "middle" });
    badge.appendChild(badgeText);
    group.appendChild(badge);

    nodeLayer.appendChild(group);
    graphParts.nodes[id] = group;
    graphParts.badges[id] = { badge, text: badgeText };
  }

  g.append(edgeLayer, labelLayer, nodeLayer);
}

function clearGraph() {
  graphTimers.forEach(clearTimeout);
  graphTimers = [];
  el.graph.classList.remove("has-run", "running", "route-kb", "route-web", "route-direct", "route-none");

  for (const node of Object.values(graphParts.nodes)) {
    node.classList.remove("on", "is-hover");
    node.style.transitionDelay = "";
    node.querySelectorAll("rect, text").forEach((part) => (part.style.transitionDelay = ""));
  }
  for (const edge of Object.values(graphParts.edges)) {
    edge.classList.remove("on");
    edge.setAttribute("marker-end", "url(#qa-arrow)");
    edge.style.strokeDasharray = "";
    edge.style.strokeDashoffset = "";
    edge.style.transition = "";
  }
  for (const label of Object.values(graphParts.labels)) label.classList.remove("on");
  for (const { badge } of Object.values(graphParts.badges)) badge.setAttribute("visibility", "hidden");
}

function setGraphRunning() {
  clearGraph();
  el.graph.classList.add("running");
}

// Highlights the nodes and edges a run went through, in order, and animates the path being drawn
function paintGraph(path, routeCls, animate) {
  clearGraph();
  if (!path.length) return;

  el.graph.classList.add("has-run", `route-${routeCls}`);
  const shouldAnimate = animate && !reducedMotion.matches;

  // Count visits so looped nodes get a "×2" badge
  const visits = {};
  path.forEach((id) => (visits[id] = (visits[id] || 0) + 1));

  const seenNodes = new Set();
  const seenEdges = new Set();

  path.forEach((id, step) => {
    const node = graphParts.nodes[id];
    if (node && !seenNodes.has(id)) {
      seenNodes.add(id);
      if (shouldAnimate) {
        node.querySelectorAll("rect, text").forEach((part) => (part.style.transitionDelay = `${step * STEP_MS}ms`));
      }
      node.classList.add("on");
      if (visits[id] > 1) {
        const { badge, text } = graphParts.badges[id];
        text.textContent = `×${visits[id]}`;
        badge.setAttribute("visibility", "visible");
      }
    }

    const nextId = path[step + 1];
    if (!nextId) return;
    const key = `${id}>${nextId}`;
    const edge = graphParts.edges[key];
    if (!edge || seenEdges.has(key)) return;
    seenEdges.add(key);

    edge.classList.add("on");
    if (graphParts.labels[key]) graphParts.labels[key].classList.add("on");

    if (shouldAnimate) {
      const length = edge.getTotalLength();
      const delay = step * STEP_MS + STEP_MS / 2;
      edge.style.strokeDasharray = `${length}`;
      edge.style.strokeDashoffset = `${length}`;
      graphTimers.push(setTimeout(() => {
        edge.style.transition = `stroke-dashoffset ${STEP_MS}ms ease-out`;
        edge.style.strokeDashoffset = "0";
      }, delay));
      // Show the arrowhead once the line has reached it
      graphTimers.push(setTimeout(() => edge.setAttribute("marker-end", "url(#qa-arrow-on)"), delay + STEP_MS));
    } else {
      edge.setAttribute("marker-end", "url(#qa-arrow-on)");
    }
  });
}

// Rebuilds the path through the graph from source_used and the number of query rewrites.
// The graph always goes: route -> retrieve -> grade KB, and each rewrite adds one
// web search -> grade web -> rewrite -> retrieve -> grade KB loop.
function inferPath(run) {
  if (run.source === "direct") return ["start", "route", "direct"];
  if (!["private_kb", "web_search", "insufficient_evidence"].includes(run.source)) return [];

  const path = ["start", "route"];
  for (let i = 0; i < run.rewrites; i++) {
    path.push("retrieve", "grade_kb", "search_web", "grade_web", "rewrite");
  }
  path.push("retrieve", "grade_kb");

  if (run.source === "private_kb") {
    path.push("gen_kb");
  } else {
    path.push("search_web", "grade_web", run.source === "web_search" ? "gen_web" : "insufficient");
  }
  return path;
}

function countRewrites(trace, question, rewrittenQuery) {
  const fromTrace = trace.filter((line) => /^\s*query rewrite/i.test(line)).length;
  if (fromTrace) return fromTrace;
  if (rewrittenQuery && normalise(rewrittenQuery) !== normalise(question)) return 1;
  return 0;
}

function nodeForTrace(line) {
  for (const [pattern, node] of TRACE_RULES) {
    if (pattern.test(line)) return node;
  }
  return null;
}

/* ---------- 4. Inspector ---------- */
function selectTab(name) {
  const traceSelected = name === "trace";
  el.tabTrace.setAttribute("aria-selected", String(traceSelected));
  el.tabSources.setAttribute("aria-selected", String(!traceSelected));
  el.tabTrace.tabIndex = traceSelected ? 0 : -1;
  el.tabSources.tabIndex = traceSelected ? -1 : 0;
  el.panelTrace.hidden = !traceSelected;
  el.panelSources.hidden = traceSelected;
}

function resetInspector() {
  clearGraph();
  el.inspectorSubtitle.textContent = "Ask a question to see which steps the agent took.";
  el.runSummary.hidden = true;
  el.traceList.innerHTML = "";
  el.traceEmpty.textContent = "Each step the agent takes will be listed here.";
  el.traceEmpty.hidden = false;
  el.sourceList.innerHTML = "";
  el.sourcesEmpty.textContent = "Documents and web pages used in the answer will be listed here.";
  el.sourcesEmpty.hidden = false;
  el.traceCount.textContent = "0";
  el.sourceCount.textContent = "0";
}

function showRunningInInspector(question) {
  setGraphRunning();
  el.inspectorSubtitle.textContent = `Working on: "${question.length > 90 ? `${question.slice(0, 90)}…` : question}"`;
  el.runSummary.hidden = true;
  el.traceList.innerHTML = "";
  el.traceEmpty.textContent = "The steps will appear here when the agent finishes.";
  el.traceEmpty.hidden = false;
  el.sourceList.innerHTML = "";
  el.sourcesEmpty.hidden = false;
  el.traceCount.textContent = "0";
  el.sourceCount.textContent = "0";
}

function renderTrace(run) {
  el.traceList.innerHTML = run.trace.map((line) => {
    const node = nodeForTrace(line);
    const nodeLabel = node ? NODES[node].label : "Step";
    let grade = "";
    if (node === "grade_kb" || node === "grade_web") {
      if (/\bgood\b/i.test(line)) grade = '<span class="grade good">good</span>';
      else if (/\bweak\b/i.test(line)) grade = '<span class="grade weak">weak</span>';
    }
    return `<li class="trace-item"${node ? ` data-node="${node}"` : ""}>
        <div>
          <div class="trace-node">${escapeHtml(nodeLabel)} ${grade}</div>
          <div class="trace-text">${escapeHtml(line)}</div>
        </div>
      </li>`;
  }).join("");
  el.traceEmpty.textContent = "The agent didn't return any trace steps.";
  el.traceEmpty.hidden = run.trace.length > 0;
  el.traceCount.textContent = String(run.trace.length);
}

function splitCitations(citations) {
  const kb = [];
  const web = [];
  for (const c of citations) {
    if (c.type === "web" || isHttpUrl(c.url)) web.push(c);
    else kb.push(c);
  }
  return { kb, web };
}

function renderSources(run) {
  const { kb, web } = splitCitations(run.citations);
  let html = "";

  if (kb.length) {
    html += `<div class="source-group"><h3>Knowledge base documents</h3>${kb.map((c) => `
      <div class="source-row">
        ${ICONS.file}
        <span>
          <span class="source-row-title">${escapeHtml(c.title || "Untitled document")}</span>
          <span class="source-row-sub">Brightwick knowledge base</span>
        </span>
      </div>`).join("")}</div>`;
  }

  if (web.length) {
    html += `<div class="source-group"><h3>Web pages</h3>${web.map((c) => {
      const title = escapeHtml(c.title || hostnameOf(c.url));
      const host = escapeHtml(hostnameOf(c.url));
      return isHttpUrl(c.url)
        ? `<a class="source-row" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer">
            ${ICONS.globe}
            <span><span class="source-row-title">${title}</span><span class="source-row-sub">${host}</span></span>
          </a>`
        : `<div class="source-row">${ICONS.globe}<span><span class="source-row-title">${title}</span></span></div>`;
    }).join("")}</div>`;
  }

  el.sourceList.innerHTML = html;
  el.sourcesEmpty.textContent = run.source === "direct" || run.source === "insufficient_evidence"
    ? "This answer doesn't cite any documents."
    : "No sources were returned for this answer.";
  el.sourcesEmpty.hidden = run.citations.length > 0;
  el.sourceCount.textContent = String(run.citations.length);
}

function showRunInInspector(run, animate) {
  const route = routeInfo(run.source);

  el.inspectorSubtitle.textContent = route.summary || "Finished.";
  paintGraph(inferPath(run), route.cls, animate);

  el.runSummary.hidden = false;
  el.sumSource.textContent = route.label;
  el.sumSource.className = `badge route-${route.cls}`;
  el.sumRewrites.textContent = String(run.rewrites);
  el.sumTime.textContent = formatDuration(run.ms);
  el.sumQueryRow.hidden = run.rewrites === 0;
  el.sumQuery.textContent = run.rewrittenQuery;

  renderTrace(run);
  renderSources(run);
}

function setActiveRun(runId, animate = false) {
  const run = state.runs.get(runId);
  if (!run) return;
  state.activeRunId = runId;
  document.querySelectorAll(".msg-agent.is-active").forEach((m) => m.classList.remove("is-active"));
  const message = el.messages.querySelector(`[data-run-id="${runId}"]`);
  if (message) message.classList.add("is-active");
  showRunInInspector(run, animate);
}

/* ---------- 5. Chat ---------- */
function scrollChatToBottom() {
  el.chat.scrollTop = el.chat.scrollHeight;
}

function hideWelcome() {
  el.welcome.hidden = true;
}

function addUserMessage(text) {
  const bubble = document.createElement("div");
  bubble.className = "msg-user";
  bubble.textContent = text;
  el.messages.appendChild(bubble);
  scrollChatToBottom();
}

function addThinkingMessage() {
  const wrap = document.createElement("div");
  wrap.className = "msg-agent";
  wrap.innerHTML = `
    <div class="msg-avatar">${ICONS.agent}</div>
    <div class="msg-card">
      <div class="thinking">
        <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="thinking-text">Working through the agent graph…</span>
      </div>
    </div>`;
  el.messages.appendChild(wrap);
  scrollChatToBottom();

  const label = wrap.querySelector(".thinking-text");
  const started = performance.now();
  const timer = setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    label.textContent = `Working through the agent graph… ${seconds}s`;
  }, 1000);

  return { element: wrap, stop: () => clearInterval(timer) };
}

function citationChips(citations) {
  if (!citations.length) return "";
  const chips = citations.map((c) => {
    const title = escapeHtml(c.title || hostnameOf(c.url) || "Source");
    if (isHttpUrl(c.url)) {
      return `<a class="source-chip" href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(c.url)}">${ICONS.globe}<span>${title}</span></a>`;
    }
    return `<span class="source-chip" title="Brightwick knowledge base">${ICONS.file}<span>${title}</span></span>`;
  }).join("");
  return `<div class="msg-sources" aria-label="Sources">${chips}</div>`;
}

function fillAnswerMessage(wrap, run) {
  const route = routeInfo(run.source);
  wrap.className = `msg-agent route-${route.cls}`;
  wrap.dataset.runId = String(run.id);

  const rewriteNote = run.rewrites > 0
    ? `<p class="msg-rewrite">Searched again with a rewritten query: <q>${escapeHtml(run.rewrittenQuery)}</q></p>`
    : "";

  wrap.innerHTML = `
    <div class="msg-avatar">${ICONS.agent}</div>
    <div class="msg-card">
      <div class="msg-head">
        <span class="msg-name">QauliRAG</span>
        <span class="badge">${escapeHtml(route.label)}</span>
        <span class="msg-time">${formatDuration(run.ms)}</span>
      </div>
      <div class="msg-body">${renderMarkdown(run.answer)}</div>
      ${rewriteNote}
      ${citationChips(run.citations)}
      <div class="msg-actions">
        <button type="button" class="link-btn" data-action="inspect">${ICONS.path}Show agent path</button>
        <button type="button" class="link-btn" data-action="copy">${ICONS.copy}Copy answer</button>
      </div>
    </div>`;

  wrap.querySelector('[data-action="inspect"]').addEventListener("click", () => {
    setActiveRun(run.id, true);
    if (narrowScreen.matches) openDrawer("inspector");
  });
  wrap.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(run.answer);
      showToast("Answer copied");
    } catch {
      showToast("Couldn't copy. Select the text and copy it instead.");
    }
  });
}

function fillErrorMessage(wrap, question, message) {
  wrap.className = "msg-agent route-error";
  wrap.innerHTML = `
    <div class="msg-avatar">${ICONS.agent}</div>
    <div class="msg-card">
      <div class="msg-head">
        <span class="msg-name">QauliRAG</span>
        <span class="badge">Request failed</span>
      </div>
      <p class="msg-error-text">${escapeHtml(message)}</p>
      <div class="msg-actions">
        <button type="button" class="link-btn" data-action="retry">${ICONS.retry}Try again</button>
      </div>
    </div>`;
  wrap.querySelector('[data-action="retry"]').addEventListener("click", () => {
    if (state.busy) return;
    wrap.remove();
    askAgent(question, { echo: false });
  });
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll(".example").forEach((button) => (button.disabled = busy));
  updateComposer();
}

function updateComposer() {
  const length = el.question.value.length;
  el.charCount.textContent = `${length} / ${MAX_CHARS}`;
  el.charCount.classList.toggle("is-near", length > MAX_CHARS * 0.9);
  el.sendBtn.disabled = state.busy || el.question.value.trim().length < MIN_CHARS;

  // Grow the textarea with its content, up to the CSS max-height
  el.question.style.height = "auto";
  el.question.style.height = `${Math.min(el.question.scrollHeight, 180)}px`;
}

async function askAgent(question, { echo = true } = {}) {
  if (state.busy) return;
  const text = question.trim();
  if (text.length < MIN_CHARS) return;

  const conversation = state.conversation;
  hideWelcome();
  if (echo) addUserMessage(text);
  setBusy(true);
  showRunningInInspector(text);

  const thinking = addThinkingMessage();
  state.controller = new AbortController();
  const started = performance.now();

  try {
    const data = await requestJson(
      API.chat,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      },
      CHAT_TIMEOUT_MS,
      state.controller.signal,
    );
    if (conversation !== state.conversation) return;   // user started a new conversation meanwhile

    const trace = Array.isArray(data.trace) ? data.trace.map(String) : [];
    const citations = Array.isArray(data.citations) ? data.citations.filter((c) => c && typeof c === "object") : [];
    const rewrittenQuery = typeof data.rewritten_query === "string" ? data.rewritten_query : text;

    const run = {
      id: state.nextRunId++,
      question: text,
      answer: typeof data.answer === "string" && data.answer.trim() ? data.answer : "The agent returned an empty answer.",
      source: data.source_used || "",
      trace,
      citations,
      rewrittenQuery,
      rewrites: countRewrites(trace, text, rewrittenQuery),
      ms: performance.now() - started,
    };
    state.runs.set(run.id, run);

    thinking.stop();
    fillAnswerMessage(thinking.element, run);
    setActiveRun(run.id, true);
  } catch (error) {
    if (conversation !== state.conversation || error.name === "AbortError") return;
    thinking.stop();
    fillErrorMessage(thinking.element, text, error.message);
    clearGraph();
    el.inspectorSubtitle.textContent = "The last request failed, so there's no path to show.";
    el.traceEmpty.textContent = "No steps, because the request failed.";
  } finally {
    thinking.stop();
    if (conversation === state.conversation) {
      state.controller = null;
      setBusy(false);
      scrollChatToBottom();
    }
  }
}

function newConversation() {
  if (state.controller) state.controller.abort();
  state.controller = null;
  state.conversation += 1;
  state.runs.clear();
  state.activeRunId = null;
  el.messages.innerHTML = "";
  el.welcome.hidden = false;
  el.question.value = "";
  setBusy(false);
  resetInspector();
  closeDrawers();
  el.question.focus();
}

el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = el.question.value.trim();
  if (state.busy || text.length < MIN_CHARS) return;
  el.question.value = "";
  updateComposer();
  askAgent(text);
});

el.question.addEventListener("input", updateComposer);
el.question.addEventListener("keydown", (event) => {
  // Enter sends, Shift+Enter adds a new line. isComposing protects IME input (e.g. Hindi, Japanese keyboards).
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    el.form.requestSubmit();
  }
});

document.querySelectorAll(".example").forEach((button) => {
  button.addEventListener("click", () => {
    closeDrawers();
    askAgent(button.textContent);
  });
});

el.newChat.addEventListener("click", newConversation);

// Hovering a trace step highlights its node in the graph
el.traceList.addEventListener("mouseover", (event) => {
  const item = event.target.closest(".trace-item");
  const nodeId = item && item.dataset.node;
  Object.values(graphParts.nodes).forEach((n) => n.classList.toggle("is-hover", n.dataset.node === nodeId));
});
el.traceList.addEventListener("mouseleave", () => {
  Object.values(graphParts.nodes).forEach((n) => n.classList.remove("is-hover"));
});

el.tabTrace.addEventListener("click", () => selectTab("trace"));
el.tabSources.addEventListener("click", () => selectTab("sources"));
[el.tabTrace, el.tabSources].forEach((tab) => {
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const next = tab === el.tabTrace ? el.tabSources : el.tabTrace;
      selectTab(next === el.tabTrace ? "trace" : "sources");
      next.focus();
    }
  });
});

/* ---------- 6. Upload dialog ---------- */
function setUploadStatus(message, kind = "") {
  el.uploadStatus.textContent = message;
  el.uploadStatus.className = `upload-status${kind ? ` is-${kind}` : ""}`;
  el.uploadStatus.hidden = !message;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function setSelectedFile(file) {
  if (!file) return;
  const ext = fileExtension(file.name);
  if (!SUPPORTED_TYPES.includes(ext)) {
    state.selectedFile = null;
    el.fileInput.value = "";
    el.dropzone.classList.remove("has-file");
    el.dropzoneMain.textContent = "Drop a file here or click to choose";
    el.dropzoneSub.textContent = "PDF, DOCX, TXT or Markdown";
    setUploadStatus(`${ext || "Files without an extension"} isn't supported. Choose a PDF, DOCX, TXT or Markdown file.`, "error");
    return;
  }
  state.selectedFile = file;
  el.dropzone.classList.add("has-file");
  el.dropzoneMain.textContent = file.name;
  el.dropzoneSub.textContent = `${formatBytes(file.size)}. Click to choose a different file.`;
  setUploadStatus("");
}

function resetUploadForm() {
  state.selectedFile = null;
  el.fileInput.value = "";
  el.dropzone.classList.remove("has-file", "is-dragover");
  el.dropzoneMain.textContent = "Drop a file here or click to choose";
  el.dropzoneSub.textContent = "PDF, DOCX, TXT or Markdown";
}

function openUploadDialog() {
  closeDrawers();
  if (!state.uploading) {
    resetUploadForm();
    setUploadStatus("");
  }
  el.uploadDialog.showModal();
  (el.adminKey.value ? el.dropzone : el.adminKey).focus();
}

function addToUploadHistory(fileName, chunks) {
  const item = document.createElement("li");
  item.innerHTML = `<span class="file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span><span class="file-chunks">${escapeHtml(chunks)} chunks</span>`;
  el.uploadHistory.prepend(item);
}

el.openUpload.addEventListener("click", openUploadDialog);
el.closeUpload.addEventListener("click", () => el.uploadDialog.close());
el.cancelUpload.addEventListener("click", () => el.uploadDialog.close());

// Clicking the dark backdrop outside the dialog closes it
el.uploadDialog.addEventListener("click", (event) => {
  if (event.target === el.uploadDialog) el.uploadDialog.close();
});

el.fileInput.addEventListener("change", () => setSelectedFile(el.fileInput.files[0]));

["dragenter", "dragover"].forEach((type) => {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.add("is-dragover");
  });
});
["dragleave", "drop"].forEach((type) => {
  el.dropzone.addEventListener(type, () => el.dropzone.classList.remove("is-dragover"));
});
el.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer && event.dataTransfer.files[0];
  setSelectedFile(file);
});

// Stop the browser from opening a file that's dropped outside the drop zone
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

el.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.uploading) return;

  const key = el.adminKey.value.trim();
  if (!key) {
    setUploadStatus("Enter the admin key to add documents.", "error");
    el.adminKey.focus();
    return;
  }
  if (!state.selectedFile) {
    setUploadStatus("Choose a file to add.", "error");
    return;
  }

  const file = state.selectedFile;
  const formData = new FormData();
  formData.append("file", file);

  state.uploading = true;
  el.uploadBtn.disabled = true;
  el.uploadBtn.textContent = "Adding…";
  setUploadStatus(`Splitting, embedding and storing ${file.name}. Large files can take a minute.`);

  try {
    const data = await requestJson(
      API.ingest,
      { method: "POST", headers: { "X-Admin-Key": key }, body: formData },
      UPLOAD_TIMEOUT_MS,
    );
    const name = data.file || file.name;
    const chunks = Number.isFinite(data.chunks) ? data.chunks : "?";
    setUploadStatus(`Added ${name} to the knowledge base as ${chunks} chunks. You can ask about it now.`, "success");
    addToUploadHistory(name, chunks);
    resetUploadForm();
    showToast(`Added ${name} to the knowledge base`);
  } catch (error) {
    setUploadStatus(error.message, "error");
  } finally {
    state.uploading = false;
    el.uploadBtn.disabled = false;
    el.uploadBtn.textContent = "Add to knowledge base";
  }
});

/* ---------- 7. Layout, theme, health check ---------- */
function openDrawer(name) {
  el.app.classList.add(name === "sidebar" ? "sidebar-open" : "inspector-open");
}

function closeDrawers() {
  el.app.classList.remove("sidebar-open", "inspector-open");
}

el.openSidebar.addEventListener("click", () => openDrawer("sidebar"));
el.openInspector.addEventListener("click", () => openDrawer("inspector"));
el.closeInspector.addEventListener("click", closeDrawers);
el.scrim.addEventListener("click", closeDrawers);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.uploadDialog.open) closeDrawers();
});

// Theme: follows the system setting until the user picks one
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "light" || chosen === "dark") return chosen;
  return systemDark.matches ? "dark" : "light";
}

function updateThemeLabel() {
  el.themeLabel.textContent = currentTheme() === "dark" ? "Light theme" : "Dark theme";
}

el.themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("qaulirag-theme", next);
  } catch {
    /* storage can be blocked; the theme still applies for this visit */
  }
  updateThemeLabel();
});
systemDark.addEventListener("change", updateThemeLabel);

async function checkHealth() {
  try {
    const data = await requestJson(API.health, {}, 8000);
    el.health.dataset.state = "online";
    el.healthText.textContent = "API connected";
    if (data.service) {
      el.brandName.textContent = data.service;
      document.title = `${data.service} – IT support copilot`;
    }
  } catch {
    el.health.dataset.state = "offline";
    el.healthText.textContent = "API not reachable";
  }
}

/* ---------- Start ---------- */
buildGraph();
resetInspector();
selectTab("trace");
updateComposer();
updateThemeLabel();
checkHealth();
setInterval(checkHealth, 60000);