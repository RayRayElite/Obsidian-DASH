"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DailyDashboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/dashboard-core.ts
var import_obsidian = require("obsidian");

// src/dashboard-types.ts
var VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
var CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
var PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
var SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
var PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
var NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
var SESSION_TAG_OPTIONS = ["deep work", "admin", "creative", "errands", "recovery"];
var HABIT_WINDOW_OPTIONS = ["anytime", "morning", "afternoon", "evening", "before-bed"];
var HABIT_CADENCE_OPTIONS = ["daily", "every-other-day", "weekly"];
var ACTIVITY_SESSION_KIND_OPTIONS = ["exercise", "reading", "gaming", "hygiene", "cooking", "errand", "commute", "social", "chores", "hobbies"];
var DEFAULT_SETTINGS = {
  dashboardTitle: "Obsidian DASH - Daily Action & System Hub",
  masterTodoPath: "Master Task Hub.md",
  projectNotesFolder: "Project Notes",
  dailyLogFolder: "Dashboard Logs/Daily",
  weeklyReportFolder: "Dashboard Logs/Weekly",
  monthlyReportFolder: "Dashboard Logs/Monthly",
  exportFolder: "Dashboard Logs/Exports",
  generatedDocumentTags: "daily-dashboard",
  aiApiKey: "",
  aiApiKeySource: "settings",
  aiApiKeyEnvVar: "OPENAI_API_KEY",
  aiModel: "gpt-4o-mini",
  aiBaseUrl: "https://api.openai.com/v1/chat/completions",
  aiOutputFolder: "Dashboard Logs/AI",
  basicInfoNotePath: "Dashboard Logs/Profile/Basic Information.md",
  includeBasicInfoInAi: true,
  aiPromptTemplates: [
    "[morning-startup-brief]",
    "Favor direct prioritization, realistic pacing, and explicit first actions.",
    "",
    "[shutdown-summary]",
    "Lean hard on carry-forward decisions, shutdown steps, and what should be set up for tomorrow.",
    "",
    "[weekly-planning-assistant]",
    "Prefer a small realistic priority stack over an aspirational one.",
    "",
    "[project-risk-scanner]",
    "Call out dependency, stale-task, due-date, and blocked-work risks before generic project commentary.",
    "",
    "[anomaly-detection]",
    "Treat unusual mood, sleep, work, and habit changes as hypotheses to test, not certainties.",
    "",
    "[period-comparison-report]",
    "Explain what materially changed between periods and what those changes imply operationally.",
    "",
    "[project-synthesis]",
    "Synthesize project notes, dashboard behavior, calendar pressure, and archived output into one operating picture.",
    "",
    "[why-today-felt-off]",
    "Look for mismatches between plan, energy, mood, interruptions, symptoms, and workload.",
    "",
    "[vault-question]",
    "Answer directly first, then move to signals and actions.",
    "",
    "[active-note-analysis]",
    "Surface the note's practical implications and the next decision it enables."
  ].join("\n"),
  aiContextDays: 14,
  aiRelatedNotesLimit: 6,
  aiIndexEnabled: true,
  aiIndexedFolders: "Project Notes",
  aiChunkCharLimit: 1200,
  aiEmbeddingsEnabled: false,
  aiEmbeddingModel: "text-embedding-3-small",
  aiEmbeddingApiUrl: "https://api.openai.com/v1/embeddings",
  calendarEnabled: false,
  calendarDocumentPath: "Dashboard Logs/Calendar.md",
  calendarLookaheadHours: 48,
  calendarWarningHours: 12,
  measurementSystem: "imperial",
  weightGoalTarget: 0,
  weightGoalMode: "maintain",
  weightGoalWeeklyRate: 0.5,
  intakeQuickPresets: [
    { id: "water-8-oz", kind: "drink", label: "Water", amount: 8, unit: "oz" },
    { id: "coffee-1-cup", kind: "drink", label: "Coffee", amount: 1, unit: "cup" }
  ],
  habitAutomations: [],
  showUndoNotifications: true,
  notificationSound: "chime",
  wallpaperFolder: "Wallpapers",
  selectedWallpaper: "",
  habitDefinitions: [
    { id: "pills", label: "Take pills", target: 1, completionWindow: "morning", cadence: "daily", anchorDate: "", difficultyWeight: 2 },
    { id: "brush-teeth", label: "Brush teeth", target: 2, completionWindow: "anytime", cadence: "daily", anchorDate: "", difficultyWeight: 2 },
    { id: "floss", label: "Floss", target: 2, completionWindow: "before-bed", cadence: "daily", anchorDate: "", difficultyWeight: 2 },
    { id: "shower", label: "Shower", target: 1, completionWindow: "anytime", cadence: "daily", anchorDate: "", difficultyWeight: 1 },
    { id: "sleep-log", label: "Log sleep", target: 1, completionWindow: "before-bed", cadence: "daily", anchorDate: "", difficultyWeight: 2 }
  ],
  routineTemplates: "Morning meds|06:00|09:00\nLunch reset|12:00|14:00\nEvening shutdown|20:00|22:30"
};

// src/dashboard-core.ts
function sanitizeSettings(settings) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C;
  const parsedHabitDefinitions = Array.isArray(settings.habitDefinitions) ? settings.habitDefinitions.map((habit) => {
    var _a2, _b2;
    return {
      id: createHabitId(habit.id || habit.label || "habit"),
      label: typeof habit.label === "string" ? habit.label.trim() : "Habit",
      target: clamp(Number((_a2 = habit.target) != null ? _a2 : 1), 1, 12),
      completionWindow: normalizeHabitWindow(habit.completionWindow),
      cadence: normalizeHabitCadence(habit.cadence),
      anchorDate: typeof habit.anchorDate === "string" ? habit.anchorDate : "",
      difficultyWeight: clamp(Number((_b2 = habit.difficultyWeight) != null ? _b2 : 1), 1, 3)
    };
  }).filter((habit) => habit.label.length > 0) : DEFAULT_SETTINGS.habitDefinitions;
  const aiApiKeySource = settings.aiApiKeySource === "env" ? "env" : "settings";
  const calendarLookaheadHours = clamp(Number((_a = settings.calendarLookaheadHours) != null ? _a : DEFAULT_SETTINGS.calendarLookaheadHours), 1, 336);
  const calendarWarningHours = clamp(Number((_b = settings.calendarWarningHours) != null ? _b : DEFAULT_SETTINGS.calendarWarningHours), 1, calendarLookaheadHours);
  const measurementSystem = settings.measurementSystem === "metric" ? "metric" : DEFAULT_SETTINGS.measurementSystem;
  const weightGoalTarget = Number.isFinite(Number(settings.weightGoalTarget)) ? clamp(Number(settings.weightGoalTarget), 0, 9999) : DEFAULT_SETTINGS.weightGoalTarget;
  const weightGoalMode = normalizeWeightGoalMode(settings.weightGoalMode);
  const weightGoalWeeklyRate = clamp(Number((_c = settings.weightGoalWeeklyRate) != null ? _c : DEFAULT_SETTINGS.weightGoalWeeklyRate), 0, 5);
  const intakeQuickPresets = Array.isArray(settings.intakeQuickPresets) ? settings.intakeQuickPresets.map((preset, index) => normalizeIntakeQuickPreset(preset, index)).filter((preset) => preset !== null) : getDefaultIntakeQuickPresets(measurementSystem);
  const habitAutomations = Array.isArray(settings.habitAutomations) ? settings.habitAutomations.map((automation, index) => normalizeHabitAutomation(automation, index, parsedHabitDefinitions)).filter((automation) => automation !== null) : DEFAULT_SETTINGS.habitAutomations;
  const showUndoNotifications = (_d = settings.showUndoNotifications) != null ? _d : DEFAULT_SETTINGS.showUndoNotifications;
  const notificationSound = settings.notificationSound === "off" || settings.notificationSound === "ping" || settings.notificationSound === "alert" ? settings.notificationSound : DEFAULT_SETTINGS.notificationSound;
  return {
    dashboardTitle: ((_e = settings.dashboardTitle) == null ? void 0 : _e.trim()) || DEFAULT_SETTINGS.dashboardTitle,
    masterTodoPath: ((_f = settings.masterTodoPath) == null ? void 0 : _f.trim()) || DEFAULT_SETTINGS.masterTodoPath,
    projectNotesFolder: normalizeFolderPath(((_g = settings.projectNotesFolder) == null ? void 0 : _g.trim()) || DEFAULT_SETTINGS.projectNotesFolder),
    dailyLogFolder: ((_h = settings.dailyLogFolder) == null ? void 0 : _h.trim()) || DEFAULT_SETTINGS.dailyLogFolder,
    weeklyReportFolder: ((_i = settings.weeklyReportFolder) == null ? void 0 : _i.trim()) || DEFAULT_SETTINGS.weeklyReportFolder,
    monthlyReportFolder: ((_j = settings.monthlyReportFolder) == null ? void 0 : _j.trim()) || DEFAULT_SETTINGS.monthlyReportFolder,
    exportFolder: normalizeFolderPath(((_k = settings.exportFolder) == null ? void 0 : _k.trim()) || DEFAULT_SETTINGS.exportFolder),
    generatedDocumentTags: typeof settings.generatedDocumentTags === "string" ? settings.generatedDocumentTags : DEFAULT_SETTINGS.generatedDocumentTags,
    aiApiKey: ((_l = settings.aiApiKey) == null ? void 0 : _l.trim()) || DEFAULT_SETTINGS.aiApiKey,
    aiApiKeySource,
    aiApiKeyEnvVar: ((_m = settings.aiApiKeyEnvVar) == null ? void 0 : _m.trim()) || DEFAULT_SETTINGS.aiApiKeyEnvVar,
    aiModel: ((_n = settings.aiModel) == null ? void 0 : _n.trim()) || DEFAULT_SETTINGS.aiModel,
    aiBaseUrl: ((_o = settings.aiBaseUrl) == null ? void 0 : _o.trim()) || DEFAULT_SETTINGS.aiBaseUrl,
    aiOutputFolder: normalizeFolderPath(((_p = settings.aiOutputFolder) == null ? void 0 : _p.trim()) || DEFAULT_SETTINGS.aiOutputFolder),
    basicInfoNotePath: ((_q = settings.basicInfoNotePath) == null ? void 0 : _q.trim()) || DEFAULT_SETTINGS.basicInfoNotePath,
    includeBasicInfoInAi: (_r = settings.includeBasicInfoInAi) != null ? _r : DEFAULT_SETTINGS.includeBasicInfoInAi,
    aiPromptTemplates: typeof settings.aiPromptTemplates === "string" ? settings.aiPromptTemplates : DEFAULT_SETTINGS.aiPromptTemplates,
    aiContextDays: clamp(Number((_s = settings.aiContextDays) != null ? _s : DEFAULT_SETTINGS.aiContextDays), 3, 60),
    aiRelatedNotesLimit: clamp(Number((_t = settings.aiRelatedNotesLimit) != null ? _t : DEFAULT_SETTINGS.aiRelatedNotesLimit), 2, 16),
    aiIndexEnabled: (_u = settings.aiIndexEnabled) != null ? _u : DEFAULT_SETTINGS.aiIndexEnabled,
    aiIndexedFolders: typeof settings.aiIndexedFolders === "string" ? settings.aiIndexedFolders : DEFAULT_SETTINGS.aiIndexedFolders,
    aiChunkCharLimit: clamp(Number((_v = settings.aiChunkCharLimit) != null ? _v : DEFAULT_SETTINGS.aiChunkCharLimit), 300, 3e3),
    aiEmbeddingsEnabled: (_w = settings.aiEmbeddingsEnabled) != null ? _w : DEFAULT_SETTINGS.aiEmbeddingsEnabled,
    aiEmbeddingModel: ((_x = settings.aiEmbeddingModel) == null ? void 0 : _x.trim()) || DEFAULT_SETTINGS.aiEmbeddingModel,
    aiEmbeddingApiUrl: ((_y = settings.aiEmbeddingApiUrl) == null ? void 0 : _y.trim()) || DEFAULT_SETTINGS.aiEmbeddingApiUrl,
    calendarEnabled: (_z = settings.calendarEnabled) != null ? _z : DEFAULT_SETTINGS.calendarEnabled,
    calendarDocumentPath: ((_A = settings.calendarDocumentPath) == null ? void 0 : _A.trim()) || DEFAULT_SETTINGS.calendarDocumentPath,
    calendarLookaheadHours,
    calendarWarningHours,
    measurementSystem,
    weightGoalTarget,
    weightGoalMode,
    weightGoalWeeklyRate,
    intakeQuickPresets,
    habitAutomations,
    showUndoNotifications,
    notificationSound,
    wallpaperFolder: normalizeFolderPath(((_B = settings.wallpaperFolder) == null ? void 0 : _B.trim()) || DEFAULT_SETTINGS.wallpaperFolder),
    selectedWallpaper: ((_C = settings.selectedWallpaper) == null ? void 0 : _C.trim()) || DEFAULT_SETTINGS.selectedWallpaper,
    habitDefinitions: parsedHabitDefinitions.length > 0 ? parsedHabitDefinitions : DEFAULT_SETTINGS.habitDefinitions,
    routineTemplates: typeof settings.routineTemplates === "string" ? settings.routineTemplates : DEFAULT_SETTINGS.routineTemplates
  };
}
function normalizeFolderPath(value) {
  const normalized = (0, import_obsidian.normalizePath)(value.trim());
  return normalized.replace(/\/+$/g, "");
}
function createEmptyNoteIndexCache() {
  return {
    version: 1,
    indexedAt: "",
    lastIndexedFile: "",
    entries: {}
  };
}
function normalizeNoteIndexCache(cache) {
  var _a;
  const entries = Object.fromEntries(
    Object.entries((_a = cache == null ? void 0 : cache.entries) != null ? _a : {}).reduce((result, [path, entry]) => {
      var _a2, _b, _c;
      if (!entry || typeof entry !== "object") {
        return result;
      }
      const normalizedChunks = Array.isArray(entry.chunks) ? entry.chunks.filter((chunk) => Boolean(chunk && typeof chunk === "object" && typeof chunk.text === "string")).map((chunk, index) => ({
        id: typeof chunk.id === "string" ? chunk.id : `${(0, import_obsidian.normalizePath)(path)}#${index + 1}`,
        heading: typeof chunk.heading === "string" ? chunk.heading : "",
        text: chunk.text,
        keywords: Array.isArray(chunk.keywords) ? chunk.keywords.filter((item) => typeof item === "string") : extractKeywords(chunk.text),
        embedding: Array.isArray(chunk.embedding) ? chunk.embedding.filter((value) => typeof value === "number" && Number.isFinite(value)) : void 0
      })) : [];
      result.push([(0, import_obsidian.normalizePath)(path), {
        path: (0, import_obsidian.normalizePath)(path),
        mtime: Number((_a2 = entry.mtime) != null ? _a2 : 0),
        size: Number((_b = entry.size) != null ? _b : 0),
        title: typeof entry.title === "string" ? entry.title : (_c = (0, import_obsidian.normalizePath)(path).split("/").pop()) != null ? _c : (0, import_obsidian.normalizePath)(path),
        keywords: Array.isArray(entry.keywords) ? entry.keywords.filter((item) => typeof item === "string") : [],
        chunks: normalizedChunks
      }]);
      return result;
    }, [])
  );
  return {
    version: 1,
    indexedAt: typeof (cache == null ? void 0 : cache.indexedAt) === "string" ? cache.indexedAt : "",
    lastIndexedFile: typeof (cache == null ? void 0 : cache.lastIndexedFile) === "string" ? cache.lastIndexedFile : "",
    entries
  };
}
function getIndexedFolderList(settings) {
  return settings.aiIndexedFolders.split(/\r?\n/).map((item) => normalizeFolderPath(item)).filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}
function shouldRebuildAiIndex(previous, next) {
  return previous.aiIndexEnabled !== next.aiIndexEnabled || previous.aiIndexedFolders !== next.aiIndexedFolders || previous.aiChunkCharLimit !== next.aiChunkCharLimit || previous.aiEmbeddingsEnabled !== next.aiEmbeddingsEnabled || previous.aiEmbeddingModel !== next.aiEmbeddingModel || previous.masterTodoPath !== next.masterTodoPath;
}
function shouldIndexFilePath(path, settings) {
  const normalizedPath = (0, import_obsidian.normalizePath)(path);
  if (!normalizedPath.endsWith(".md")) {
    return false;
  }
  if (shouldExcludeAiContextFile(normalizedPath, settings)) {
    return false;
  }
  if (normalizedPath === (0, import_obsidian.normalizePath)(settings.masterTodoPath)) {
    return true;
  }
  const folders = getIndexedFolderList(settings);
  return folders.some((folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`));
}
function buildNoteIndexEntry(file, content, chunkCharLimit) {
  const normalizedPath = (0, import_obsidian.normalizePath)(file.path);
  const chunks = chunkMarkdownForIndex(content, chunkCharLimit).map((chunk, index) => ({
    id: `${normalizedPath}#${index + 1}`,
    heading: chunk.heading,
    text: chunk.text,
    keywords: extractKeywords(`${chunk.heading}
${chunk.text}`)
  }));
  return {
    path: normalizedPath,
    mtime: file.stat.mtime,
    size: file.stat.size,
    title: file.basename,
    keywords: extractKeywords(`${file.basename}
${content.slice(0, 2e3)}`),
    chunks
  };
}
function chunkMarkdownForIndex(content, chunkCharLimit) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let heading = "";
  let buffer = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    if (!text) {
      buffer = [];
      return;
    }
    if (text.length <= chunkCharLimit) {
      chunks.push({ heading, text });
    } else {
      for (let start = 0; start < text.length; start += chunkCharLimit) {
        chunks.push({ heading, text: text.slice(start, start + chunkCharLimit).trim() });
      }
    }
    buffer = [];
  };
  lines.forEach((line) => {
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      heading = line.replace(/^#{1,6}\s+/, "").trim();
      return;
    }
    buffer.push(line);
    if (buffer.join("\n").length >= chunkCharLimit) {
      flush();
    }
  });
  flush();
  return chunks;
}
function extractKeywords(value) {
  const stopWords = /* @__PURE__ */ new Set(["the", "and", "for", "that", "with", "this", "from", "have", "your", "into", "about", "were", "when", "what", "will", "then", "them", "they", "been", "there", "their", "just", "over", "more", "than", "also", "note", "notes"]);
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !stopWords.has(token));
  return Array.from(new Set(tokens)).slice(0, 80);
}
function getRelevantIndexedNotes(noteIndex, terms, queryEmbedding, settings, activeFilePath, includeActiveNote, limit) {
  const candidates = [];
  Object.values(noteIndex.entries).forEach((entry) => {
    const baseScore = scoreIndexedEntry(entry, terms, settings, activeFilePath, includeActiveNote);
    if (baseScore <= 0 && !(queryEmbedding && entry.chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0))) {
      return;
    }
    entry.chunks.forEach((chunk) => {
      const chunkScore = baseScore + scoreIndexedChunk(chunk, terms, queryEmbedding);
      if (chunkScore <= 0) {
        return;
      }
      candidates.push({
        path: entry.path,
        reason: deriveAiNoteReason(entry.path, settings, activeFilePath, includeActiveNote, terms),
        excerpt: truncateText(`${chunk.heading ? `${chunk.heading}
` : ""}${chunk.text}`, 1200),
        score: chunkScore
      });
    });
  });
  const bestByPath = /* @__PURE__ */ new Map();
  candidates.sort((left, right) => right.score - left.score).forEach((candidate) => {
    if (!bestByPath.has(candidate.path)) {
      bestByPath.set(candidate.path, candidate);
    }
  });
  return Array.from(bestByPath.values()).slice(0, limit);
}
function scoreIndexedEntry(entry, terms, settings, activeFilePath, includeActiveNote) {
  let score = 0;
  const path = entry.path.toLowerCase();
  const projectNotesFolder = normalizeFolderPath(settings.projectNotesFolder).toLowerCase();
  if (includeActiveNote && entry.path === (0, import_obsidian.normalizePath)(activeFilePath)) {
    score += 80;
  }
  if (entry.path === (0, import_obsidian.normalizePath)(settings.masterTodoPath)) {
    score += 30;
  }
  if (projectNotesFolder && path.startsWith(projectNotesFolder)) {
    score += 16;
  }
  score += terms.reduce((sum, term) => sum + (path.includes(term) ? 4 : 0), 0);
  score += terms.reduce((sum, term) => sum + (entry.keywords.includes(term) ? 3 : 0), 0);
  return score;
}
function scoreIndexedChunk(chunk, terms, queryEmbedding) {
  const haystack = `${chunk.heading}
${chunk.text}`.toLowerCase();
  const keywordScore = terms.reduce((score, term) => {
    let next = score;
    if (chunk.keywords.includes(term)) {
      next += 4;
    }
    if (haystack.includes(term)) {
      next += 2;
    }
    return next;
  }, 0);
  const semanticScore = queryEmbedding && Array.isArray(chunk.embedding) && chunk.embedding.length > 0 ? cosineSimilarity(queryEmbedding, chunk.embedding) * 40 : 0;
  return keywordScore + semanticScore;
}
function cosineSimilarity(left, right) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
function createEmptyEntry(date, habits) {
  const habitValues = Object.fromEntries(habits.map((habit) => [habit.id, 0]));
  const habitEvents = Object.fromEntries(habits.map((habit) => [habit.id, []]));
  return {
    date,
    lastEditedAt: "",
    dayStartedAt: "",
    dayEndedAt: "",
    wakeTime: "",
    wakeQualityScore: 0,
    sleepTime: "",
    sleepMinutesOverride: null,
    habits: habitValues,
    habitEvents,
    moodScore: 0,
    energyScore: 0,
    anxietyScore: 0,
    todayFocus: [],
    nextUpFocus: [],
    calendarFollowThroughCompleted: [],
    frictionLog: "",
    missedHabits: computeMissedHabits(habitValues, habits),
    habitMissNotes: {},
    foodLog: [],
    intakeLog: [],
    symptomLog: [],
    bodyWeight: null,
    exerciseLog: [],
    moodCheckIns: [],
    energyCheckIns: [],
    anxietyCheckIns: [],
    dietInsight: "",
    sleepLog: "",
    dreamLog: "",
    helpedToday: "",
    hurtToday: "",
    notes: "",
    workSessions: [],
    workMinutesOverride: null,
    napSessions: [],
    napMinutesOverride: null,
    relaxSessions: [],
    relaxMinutesOverride: null,
    breakSessions: [],
    breakMinutesOverride: null,
    poopSessions: [],
    activitySessions: [],
    poopQualityByStart: {},
    completedTasks: []
  };
}
function formatActivitySessionLabel(kind) {
  switch (kind) {
    case "exercise":
      return "Exercise";
    case "reading":
      return "Reading";
    case "gaming":
      return "Gaming";
    case "hygiene":
      return "Hygiene";
    case "cooking":
      return "Cooking";
    case "errand":
      return "Errand";
    case "commute":
      return "Commute";
    case "social":
      return "Social";
    case "chores":
      return "Chores";
    case "hobbies":
      return "Hobbies";
    default:
      return "Activity";
  }
}
function normalizeWeightGoalMode(value) {
  return value === "lose" || value === "gain" ? value : "maintain";
}
function normalizeExerciseIntensity(value) {
  return value === "easy" || value === "hard" ? value : "moderate";
}
function normalizeActivitySession(input) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  if (typeof candidate.start !== "string" || candidate.start.trim().length === 0) {
    return null;
  }
  const legacyKind = candidate.kind === "study" ? "reading" : candidate.kind;
  const kind = ACTIVITY_SESSION_KIND_OPTIONS.includes(legacyKind) ? legacyKind : candidate.kind === "admin" ? "chores" : "chores";
  const rawLabel = typeof candidate.label === "string" ? candidate.label.trim() : "";
  return {
    kind,
    label: kind === "chores" && rawLabel.toLowerCase() === "admin" ? formatActivitySessionLabel(kind) : rawLabel || formatActivitySessionLabel(kind),
    start: candidate.start,
    end: typeof candidate.end === "string" ? candidate.end : null,
    tag: typeof candidate.tag === "string" ? candidate.tag.trim() : "",
    projectName: typeof candidate.projectName === "string" ? candidate.projectName.trim() : ""
  };
}
function normalizeExerciseEntry(input) {
  var _a;
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  if (!label) {
    return null;
  }
  return {
    label,
    durationMinutes: clamp(Math.round(Number((_a = candidate.durationMinutes) != null ? _a : 0)), 1, 600),
    intensity: normalizeExerciseIntensity(candidate.intensity),
    note: typeof candidate.note === "string" ? candidate.note.trim() : "",
    loggedAt: typeof candidate.loggedAt === "string" && candidate.loggedAt.trim().length > 0 ? candidate.loggedAt : formatDateTimeKey(/* @__PURE__ */ new Date()),
    linkedSessionStart: typeof candidate.linkedSessionStart === "string" ? candidate.linkedSessionStart : ""
  };
}
function normalizeDayState(dayState, entries) {
  var _a;
  const fallbackDate = (_a = Object.keys(entries).sort().slice(-1)[0]) != null ? _a : formatDateKey(/* @__PURE__ */ new Date());
  const activeDate = typeof (dayState == null ? void 0 : dayState.activeDate) === "string" && dayState.activeDate.trim().length > 0 ? dayState.activeDate : fallbackDate;
  const status = (dayState == null ? void 0 : dayState.status) === "in-progress" || (dayState == null ? void 0 : dayState.status) === "ended" ? dayState.status : "not-started";
  return {
    activeDate,
    status,
    lastInactivityPromptActivityAt: typeof (dayState == null ? void 0 : dayState.lastInactivityPromptActivityAt) === "string" ? dayState.lastInactivityPromptActivityAt : "",
    lastLateNightWarningKey: typeof (dayState == null ? void 0 : dayState.lastLateNightWarningKey) === "string" ? dayState.lastLateNightWarningKey : ""
  };
}
function normalizeTodayFocusStatus(value) {
  return value === "working" || value === "done" ? value : "pending";
}
function normalizeTodayFocusItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => normalizeTodayFocusItem(item)).filter((item) => item !== null).slice(0, 3);
}
function normalizeNextUpFocusItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => normalizeNextUpFocusItem(item)).filter((item) => item !== null).slice(0, 9);
}
function getTodayFocusTexts(items) {
  return items.map((item) => item.text);
}
function normalizeTodayFocusItem(value) {
  if (typeof value === "string") {
    const text2 = value.trim();
    return text2.length > 0 ? { text: text2, projectName: "", notes: "", estimateMinutes: null, status: "pending", workSessions: [], completedAt: null } : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const rawItem = value;
  const text = typeof rawItem.text === "string" ? rawItem.text.trim() : "";
  if (!text) {
    return null;
  }
  const workSessions = Array.isArray(rawItem.workSessions) ? rawItem.workSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
    start: item.start,
    end: typeof item.end === "string" ? item.end : null,
    tag: typeof item.tag === "string" ? item.tag.trim() : ""
  })) : [];
  return {
    text,
    projectName: typeof rawItem.projectName === "string" ? rawItem.projectName.trim() : "",
    notes: typeof rawItem.notes === "string" ? rawItem.notes.trim() : "",
    estimateMinutes: Number.isFinite(Number(rawItem.estimateMinutes)) && Number(rawItem.estimateMinutes) > 0 ? Math.round(Number(rawItem.estimateMinutes)) : null,
    status: normalizeTodayFocusStatus(rawItem.status),
    workSessions,
    completedAt: typeof rawItem.completedAt === "string" && rawItem.completedAt.trim().length > 0 ? rawItem.completedAt : null
  };
}
function normalizeNextUpFocusItem(value) {
  if (typeof value === "string") {
    const text2 = value.trim();
    return text2.length > 0 ? { text: text2, projectName: "", notes: "", estimateMinutes: null } : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const rawItem = value;
  const text = typeof rawItem.text === "string" ? rawItem.text.trim() : "";
  if (!text) {
    return null;
  }
  return {
    text,
    projectName: typeof rawItem.projectName === "string" ? rawItem.projectName.trim() : "",
    notes: typeof rawItem.notes === "string" ? rawItem.notes.trim() : "",
    estimateMinutes: Number.isFinite(Number(rawItem.estimateMinutes)) && Number(rawItem.estimateMinutes) > 0 ? Math.round(Number(rawItem.estimateMinutes)) : null
  };
}
function parseHabitDefinitions(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return DEFAULT_SETTINGS.habitDefinitions;
  }
  return lines.map((line) => {
    const [rawLabel, rawTarget, rawWindow, rawCadence, rawWeight, rawAnchorDate] = line.split("|");
    const label = (rawLabel == null ? void 0 : rawLabel.trim()) || "Habit";
    const target = clamp(Number((rawTarget == null ? void 0 : rawTarget.trim()) || 1), 1, 12);
    return {
      id: createHabitId(label),
      label,
      target,
      completionWindow: normalizeHabitWindow(rawWindow),
      cadence: normalizeHabitCadence(rawCadence),
      difficultyWeight: clamp(Number((rawWeight == null ? void 0 : rawWeight.trim()) || 1), 1, 3),
      anchorDate: normalizeHabitAnchorDate(rawAnchorDate)
    };
  });
}
function normalizeHabitCadence(value) {
  return value === "every-other-day" || value === "weekly" ? value : "daily";
}
function normalizeHabitAnchorDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}
function isHabitDueOnDate(habit, date) {
  if (habit.cadence === "daily") {
    return true;
  }
  const anchorDate = normalizeHabitAnchorDate(habit.anchorDate) || date;
  const anchor = /* @__PURE__ */ new Date(`${anchorDate}T00:00:00`);
  const target = /* @__PURE__ */ new Date(`${date}T00:00:00`);
  if (Number.isNaN(anchor.getTime()) || Number.isNaN(target.getTime())) {
    return true;
  }
  const dayDifference = Math.floor((target.getTime() - anchor.getTime()) / 864e5);
  if (dayDifference < 0) {
    return false;
  }
  if (habit.cadence === "every-other-day") {
    return dayDifference % 2 === 0;
  }
  return dayDifference % 7 === 0;
}
function formatHabitCadenceLabel(cadence) {
  if (cadence === "every-other-day") {
    return "Every other day";
  }
  return cadence === "weekly" ? "Weekly" : "Daily";
}
function normalizeHabitWindow(value) {
  return value === "morning" || value === "afternoon" || value === "evening" || value === "before-bed" ? value : "anytime";
}
function formatHabitWindowLabel(window2) {
  return window2 === "before-bed" ? "Before bed" : `${window2.charAt(0).toUpperCase()}${window2.slice(1)}`;
}
function getHabitWeightedCompletion(entry, definitions) {
  const completed = definitions.reduce((sum, definition) => {
    var _a;
    if (!isHabitDueOnDate(definition, entry.date)) {
      return sum;
    }
    const capped = Math.min((_a = entry.habits[definition.id]) != null ? _a : 0, definition.target);
    return sum + capped * definition.difficultyWeight;
  }, 0);
  const target = definitions.reduce((sum, definition) => {
    if (!isHabitDueOnDate(definition, entry.date)) {
      return sum;
    }
    return sum + definition.target * definition.difficultyWeight;
  }, 0);
  return {
    completed,
    target,
    percentage: target > 0 ? Math.round(completed / target * 100) : 0
  };
}
function countHabitEventsInWindow(events, window2) {
  if (window2 === "anytime") {
    return events.length;
  }
  return events.filter((timestamp) => isTimestampInHabitWindow(timestamp, window2)).length;
}
function isTimestampInHabitWindow(timestamp, window2) {
  if (window2 === "anytime") {
    return true;
  }
  const hour = Number(timestamp.slice(11, 13));
  if (!Number.isFinite(hour)) {
    return false;
  }
  if (window2 === "morning") {
    return hour >= 5 && hour < 12;
  }
  if (window2 === "afternoon") {
    return hour >= 12 && hour < 17;
  }
  if (window2 === "evening") {
    return hour >= 17 && hour < 22;
  }
  return hour >= 22 || hour < 3;
}
function createHabitId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "habit";
}
function clamp(value, minimum, maximum) {
  if (Number.isNaN(value)) {
    return minimum;
  }
  return Math.min(Math.max(value, minimum), maximum);
}
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatDateTimeKey(date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}
function formatPreciseDateTimeKey(date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}:${seconds}`;
}
function formatSyncTimestamp(value) {
  return value.trim().length > 0 ? value : "Not yet";
}
function formatFileTimestamp(date) {
  return formatDateTimeKey(date).replace(/[: ]/g, "-");
}
function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 18)).trimEnd()}

[truncated]`;
}
function stripJsonCodeBlocks(value) {
  return value.replace(/```json\s*[\s\S]*?```/gi, "").trim();
}
function extractAiStructuredPayload(value) {
  const match = value.match(/```json\s*([\s\S]*?)```/i);
  if (!match) {
    return {
      suggestedFocus: [],
      nextActions: [],
      keyRisks: [],
      followUpQuestions: []
    };
  }
  try {
    const parsed = JSON.parse(match[1]);
    return {
      suggestedFocus: Array.isArray(parsed.suggestedFocus) ? parsed.suggestedFocus.filter((item) => typeof item === "string").slice(0, 3) : [],
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.filter((item) => typeof item === "string").slice(0, 8) : [],
      keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks.filter((item) => typeof item === "string").slice(0, 8) : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.filter((item) => typeof item === "string").slice(0, 6) : []
    };
  } catch (e) {
    return {
      suggestedFocus: [],
      nextActions: [],
      keyRisks: [],
      followUpQuestions: []
    };
  }
}
function extractAiSummary(value) {
  var _a;
  const lines = value.split(/\r?\n/).map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim()).filter((line) => line.length > 0);
  return (_a = lines[0]) != null ? _a : "AI note generated.";
}
function renderTodoSnapshotForAi(snapshot) {
  if (!snapshot) {
    return "Master task hub snapshot unavailable.";
  }
  const topProjects = [...snapshot.projects].sort((left, right) => right.healthScore - left.healthScore).slice(0, 8).map((project) => [
    `- ${project.name}: health ${project.healthScore}, ${project.openCount} open, ${project.archivedCount} archived, trend ${project.trend}`,
    project.focus ? `  focus: ${project.focus}` : "",
    project.staleDays !== null ? `  stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"}` : "",
    project.overdueTasks.length > 0 ? `  overdue: ${project.overdueTasks.slice(0, 2).map((task) => `${task.text}${task.dueDate ? ` (${task.dueDate})` : ""}`).join(" | ")}` : "",
    project.blockedTasks.length > 0 ? `  blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" | ")}` : "",
    project.nowTasks.length > 0 ? `  now: ${project.nowTasks.slice(0, 3).join(" | ")}` : "",
    project.nextTasks.length > 0 ? `  next: ${project.nextTasks.slice(0, 3).join(" | ")}` : ""
  ].filter((line) => line.length > 0).join("\n"));
  const staleLines = snapshot.staleProjects.slice(0, 6).map((project) => `- ${project.name}: ${project.staleDays} stale days`);
  const cleanupLines = snapshot.cleanupSuggestions.slice(0, 8).map((item) => `- ${item.summary}`);
  const dueLines = snapshot.overdueTasks.slice(0, 6).map((item) => `- ${item.project}: ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`);
  const blockedLines = snapshot.blockedTasks.slice(0, 6).map((item) => `- ${item.project}: ${item.task.text}${item.task.blockedReason ? ` (${item.task.blockedReason})` : ""}`);
  return [
    `Open tasks: ${snapshot.totalOpen}`,
    `Archived tasks: ${snapshot.totalArchived}`,
    "",
    "Top projects:",
    ...topProjects.length > 0 ? topProjects : ["- No project summaries available."],
    "",
    "Stale projects:",
    ...staleLines.length > 0 ? staleLines : ["- None"],
    "",
    "Overdue tasks:",
    ...dueLines.length > 0 ? dueLines : ["- None"],
    "",
    "Blocked tasks:",
    ...blockedLines.length > 0 ? blockedLines : ["- None"],
    "",
    "Cleanup suggestions:",
    ...cleanupLines.length > 0 ? cleanupLines : ["- None"]
  ].join("\n");
}
function renderRoutineSignalsForAi(entries, habits) {
  if (entries.length === 0) {
    return "No recent routine data available.";
  }
  const habitLines = habits.map((habit) => {
    const timestamps = entries.flatMap((entry) => {
      var _a;
      return (_a = entry.habitEvents[habit.id]) != null ? _a : [];
    }).map((item) => item.slice(11));
    const dueEntries = entries.filter((entry) => isHabitDueOnDate(habit, entry.date));
    const averageCount = (dueEntries.reduce((sum, entry) => {
      var _a;
      return sum + ((_a = entry.habits[habit.id]) != null ? _a : 0);
    }, 0) / Math.max(dueEntries.length, 1)).toFixed(1);
    const missNotes = entries.map((entry) => entry.habitMissNotes[habit.id]).filter((item) => typeof item === "string" && item.trim().length > 0);
    return `- ${habit.label}: avg ${averageCount}/${habit.target}, ${formatHabitCadenceLabel(habit.cadence).toLowerCase()}, window ${formatHabitWindowLabel(habit.completionWindow)}, weight ${habit.difficultyWeight}/3, recent times ${timestamps.slice(-8).join(", ") || "none"}, miss notes ${missNotes.slice(-3).join(" | ") || "none"}`;
  });
  const foodTimes = entries.flatMap((entry) => entry.intakeLog.filter((item) => item.kind === "food").map((item) => item.loggedAt.slice(11))).filter((item) => item.length > 0);
  const intakeLines = entries.flatMap((entry) => entry.intakeLog.slice(0, 3).map((item) => `${item.loggedAt.slice(0, 16)} ${item.kind} ${item.amount} ${item.unit} ${item.label}`));
  const symptomLines = entries.flatMap((entry) => entry.symptomLog.slice(0, 3).map((item) => `${item.loggedAt.slice(0, 16)} ${item.symptom} ${item.severity}/5${item.note ? ` ${item.note}` : ""}`));
  const dreamDays = entries.filter((entry) => entry.dreamLog.trim().length > 0).map((entry) => entry.date);
  const wakeQualityValues = entries.filter((entry) => entry.wakeQualityScore > 0).map((entry) => entry.wakeQualityScore);
  const energyCheckInLines = entries.flatMap((entry) => entry.energyCheckIns.slice(0, 3).map((item) => `${item.loggedAt.slice(0, 16)} ${item.score}/5${item.note ? ` ${item.note}` : ""}`));
  const reflectionLines = entries.flatMap((entry) => [entry.helpedToday ? `${entry.date} helped: ${entry.helpedToday}` : "", entry.hurtToday ? `${entry.date} hurt: ${entry.hurtToday}` : ""]).filter((item) => item.length > 0);
  return [
    "Habit timing:",
    ...habitLines,
    "",
    `Recent food times: ${foodTimes.slice(-12).join(", ") || "none"}`,
    `Recent intake log: ${intakeLines.slice(0, 10).join(" | ") || "none"}`,
    `Recent symptoms: ${symptomLines.slice(0, 10).join(" | ") || "none"}`,
    `Dream log days: ${dreamDays.join(", ") || "none"}`,
    `Average wake quality: ${wakeQualityValues.length > 0 ? `${(wakeQualityValues.reduce((sum, value) => sum + value, 0) / wakeQualityValues.length).toFixed(1)}/5` : "none"}`,
    `Recent energy check-ins: ${energyCheckInLines.slice(0, 10).join(" | ") || "none"}`,
    `Recent reflections: ${reflectionLines.slice(-6).join(" | ") || "none"}`
  ].join("\n");
}
function renderAiRelevantNotes(notes) {
  if (notes.length === 0) {
    return "No relevant vault notes were selected.";
  }
  return notes.map((note) => [
    `### ${note.path}`,
    `Reason: ${note.reason}`,
    note.excerpt
  ].join("\n")).join("\n\n");
}
function buildAiSearchTerms(question, todayEntry, snapshot) {
  var _a;
  const rawTerms = [
    ...question ? question.toLowerCase().split(/[^a-z0-9]+/) : [],
    ...getTodayFocusTexts(todayEntry.todayFocus).flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/)),
    ...(_a = snapshot == null ? void 0 : snapshot.projects.slice(0, 8).flatMap((project) => project.name.toLowerCase().split(/[^a-z0-9]+/))) != null ? _a : []
  ];
  return Array.from(new Set(rawTerms.filter((term) => term.length >= 3))).slice(0, 32);
}
function shouldExcludeAiContextFile(path, settings) {
  const normalizedPath = (0, import_obsidian.normalizePath)(path);
  const excludedPrefixes = [
    normalizeFolderPath(settings.aiOutputFolder),
    normalizeFolderPath(settings.dailyLogFolder),
    normalizeFolderPath(settings.weeklyReportFolder),
    normalizeFolderPath(settings.monthlyReportFolder)
  ].filter((prefix) => prefix.length > 0);
  return excludedPrefixes.some((prefix) => normalizedPath.startsWith(`${prefix}/`) || normalizedPath === prefix);
}
function deriveAiNoteReason(path, settings, activeFilePath, includeActiveNote, terms) {
  const normalizedPath = (0, import_obsidian.normalizePath)(path);
  if (includeActiveNote && normalizedPath === (0, import_obsidian.normalizePath)(activeFilePath)) {
    return "Currently active note";
  }
  if (normalizedPath === (0, import_obsidian.normalizePath)(settings.masterTodoPath)) {
    return "Master task hub";
  }
  if (normalizedPath.startsWith(`${normalizeFolderPath(settings.projectNotesFolder)}/`)) {
    return "Project note matched current context";
  }
  const matchedTerms = terms.filter((term) => normalizedPath.toLowerCase().includes(term)).slice(0, 3);
  return matchedTerms.length > 0 ? `Matched terms: ${matchedTerms.join(", ")}` : "Recent relevant vault note";
}
function normalizeFoodEntry(input) {
  var _a;
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? { text: trimmed, amount: 1, loggedAt: "" } : null;
  }
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  if (!text) {
    return null;
  }
  return {
    text,
    amount: clamp(Number((_a = candidate.amount) != null ? _a : 1), 0.1, 9999),
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}
function foodEntryToIntakeEntry(entry) {
  return {
    kind: "food",
    label: entry.text,
    amount: entry.amount,
    unit: entry.amount === 1 ? "serving" : "servings",
    note: "",
    loggedAt: entry.loggedAt,
    loggedAtHistory: entry.loggedAt ? [entry.loggedAt] : []
  };
}
function normalizeIntakeEntry(input) {
  var _a, _b;
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  if (!label) {
    return null;
  }
  const loggedAtHistory = Array.isArray(candidate.loggedAtHistory) ? candidate.loggedAtHistory.filter((item) => typeof item === "string" && item.trim().length > 0) : typeof candidate.loggedAt === "string" && candidate.loggedAt.trim().length > 0 ? [candidate.loggedAt] : [];
  return {
    kind: candidate.kind === "food" || candidate.kind === "medication" || candidate.kind === "supplement" || candidate.kind === "drink" ? candidate.kind : candidate.kind === "caffeine" || candidate.kind === "water" ? "drink" : "drink",
    label,
    amount: clamp(Number((_a = candidate.amount) != null ? _a : 1), 0.1, 9999),
    unit: typeof candidate.unit === "string" && candidate.unit.trim().length > 0 ? candidate.unit.trim() : "serving",
    note: typeof candidate.note === "string" ? candidate.note.trim() : "",
    loggedAt: (_b = loggedAtHistory[loggedAtHistory.length - 1]) != null ? _b : typeof candidate.loggedAt === "string" ? candidate.loggedAt : "",
    loggedAtHistory
  };
}
function normalizeSymptomEntry(input) {
  var _a;
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const symptom = typeof candidate.symptom === "string" ? candidate.symptom.trim() : "";
  if (!symptom) {
    return null;
  }
  return {
    symptom,
    severity: clamp(Math.round(Number((_a = candidate.severity) != null ? _a : 1)), 1, 5),
    note: typeof candidate.note === "string" ? candidate.note.trim() : "",
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}
function getEntryRecencyKey(entry) {
  var _a;
  if (!entry) {
    return "";
  }
  const timestamps = [
    typeof entry.lastEditedAt === "string" ? entry.lastEditedAt : "",
    typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
    typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
    typeof entry.wakeTime === "string" ? entry.wakeTime : "",
    ...Array.isArray(entry.energyCheckIns) ? entry.energyCheckIns.map((item) => item.loggedAt) : [],
    typeof entry.sleepTime === "string" ? entry.sleepTime : "",
    ...Array.isArray(entry.foodLog) ? entry.foodLog.map((item) => item.loggedAt) : [],
    ...Array.isArray(entry.intakeLog) ? entry.intakeLog.map((item) => item.loggedAt) : [],
    ...Array.isArray(entry.symptomLog) ? entry.symptomLog.map((item) => item.loggedAt) : [],
    ...Array.isArray(entry.workSessions) ? entry.workSessions.flatMap((session) => {
      var _a2;
      return [session.start, (_a2 = session.end) != null ? _a2 : ""];
    }) : [],
    ...Array.isArray(entry.napSessions) ? entry.napSessions.flatMap((session) => {
      var _a2;
      return [session.start, (_a2 = session.end) != null ? _a2 : ""];
    }) : [],
    ...Array.isArray(entry.relaxSessions) ? entry.relaxSessions.flatMap((session) => {
      var _a2;
      return [session.start, (_a2 = session.end) != null ? _a2 : ""];
    }) : [],
    ...Array.isArray(entry.breakSessions) ? entry.breakSessions.flatMap((session) => {
      var _a2;
      return [session.start, (_a2 = session.end) != null ? _a2 : ""];
    }) : [],
    ...Array.isArray(entry.poopSessions) ? entry.poopSessions.flatMap((session) => {
      var _a2;
      return [session.start, (_a2 = session.end) != null ? _a2 : ""];
    }) : [],
    ...Array.isArray(entry.todayFocus) ? entry.todayFocus.flatMap((item) => {
      var _a2;
      return [(_a2 = item.completedAt) != null ? _a2 : "", ...item.workSessions.flatMap((session) => {
        var _a3;
        return [session.start, (_a3 = session.end) != null ? _a3 : ""];
      })];
    }) : [],
    ...Array.isArray(entry.completedTasks) ? entry.completedTasks.map((task) => task.archivedAt) : [],
    ...entry.habitEvents ? Object.values(entry.habitEvents).flatMap((items) => items) : []
  ].filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value));
  return (_a = timestamps.sort().slice(-1)[0]) != null ? _a : "";
}
function renderScore(value) {
  return value > 0 ? `${value}/5` : "-";
}
function computeMissedHabits(habits, definitions) {
  return definitions.filter((definition) => {
    var _a;
    return ((_a = habits[definition.id]) != null ? _a : 0) < definition.target;
  }).map((definition) => definition.label);
}
function parseRoutineTemplates(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  return lines.map((line, index) => {
    const [rawLabel, rawStart, rawEnd] = line.split("|").map((item) => {
      var _a;
      return (_a = item == null ? void 0 : item.trim()) != null ? _a : "";
    });
    if (!rawLabel || !/^\d{2}:\d{2}$/.test(rawStart) || !/^\d{2}:\d{2}$/.test(rawEnd) || rawStart >= rawEnd) {
      return null;
    }
    return {
      id: createHabitId(`${rawLabel}-${rawStart}-${rawEnd}-${index}`),
      label: rawLabel,
      startTime: rawStart,
      endTime: rawEnd
    };
  }).filter((item) => item !== null);
}
function parseAiPromptTemplates(value) {
  const templates = {};
  let currentKey = "";
  let buffer = [];
  const flush = () => {
    if (!currentKey) {
      buffer = [];
      return;
    }
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      templates[currentKey] = text;
    }
    buffer = [];
  };
  value.split(/\r?\n/).forEach((line) => {
    const match = line.trim().match(/^\[([a-z0-9-]+)\]$/i);
    if (match) {
      flush();
      currentKey = match[1].toLowerCase();
      return;
    }
    buffer.push(line);
  });
  flush();
  return templates;
}
function getDefaultIntakeQuickPresets(measurementSystem) {
  if (measurementSystem === "metric") {
    return [
      { id: "water-250-ml", kind: "drink", label: "Water", amount: 250, unit: "mL" },
      { id: "coffee-250-ml", kind: "drink", label: "Coffee", amount: 250, unit: "mL" }
    ];
  }
  return [
    { id: "water-8-oz", kind: "drink", label: "Water", amount: 8, unit: "oz" },
    { id: "coffee-1-cup", kind: "drink", label: "Coffee", amount: 1, unit: "cup" }
  ];
}
function normalizeIntakeQuickPreset(input, index) {
  var _a;
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";
  if (!label || !unit) {
    return null;
  }
  const kind = candidate.kind === "food" || candidate.kind === "medication" || candidate.kind === "supplement" || candidate.kind === "drink" ? candidate.kind : candidate.kind === "caffeine" || candidate.kind === "water" ? "drink" : "drink";
  const amount = clamp(Number((_a = candidate.amount) != null ? _a : 1), 0.1, 9999);
  const baseId = typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id.trim() : `${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${amount}-${unit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;
  return {
    id: baseId,
    kind,
    label,
    amount,
    unit
  };
}
function parseHabitAutomations(value, definitions = DEFAULT_SETTINGS.habitDefinitions) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const definitionsById = new Map(definitions.map((definition) => [definition.id.toLowerCase(), definition.id]));
  const definitionsByLabel = new Map(definitions.map((definition) => [definition.label.trim().toLowerCase(), definition.id]));
  return lines.map((line, index) => {
    var _a, _b, _c, _d, _e, _f;
    const [rawHabitLabel, rawKind, rawLabel, rawAmount, rawUnit, rawNote] = line.split("|");
    const habitLabel = (_a = rawHabitLabel == null ? void 0 : rawHabitLabel.trim()) != null ? _a : "";
    const label = (_b = rawLabel == null ? void 0 : rawLabel.trim()) != null ? _b : "";
    const unit = (_c = rawUnit == null ? void 0 : rawUnit.trim()) != null ? _c : "";
    if (!habitLabel || !label || !unit) {
      return null;
    }
    const normalizedHabitKey = habitLabel.trim().toLowerCase();
    const habitId = (_e = (_d = definitionsById.get(normalizedHabitKey)) != null ? _d : definitionsByLabel.get(normalizedHabitKey)) != null ? _e : createHabitId(habitLabel);
    const intakeKind = (rawKind == null ? void 0 : rawKind.trim()) === "food" || (rawKind == null ? void 0 : rawKind.trim()) === "medication" || (rawKind == null ? void 0 : rawKind.trim()) === "supplement" || (rawKind == null ? void 0 : rawKind.trim()) === "drink" ? rawKind.trim() : "drink";
    const amount = clamp(Number((rawAmount == null ? void 0 : rawAmount.trim()) || 1), 0.1, 9999);
    return {
      id: `${habitId}-${intakeKind}-${createHabitId(`${label}-${unit}-${index}`)}`,
      habitId,
      intakeKind,
      label,
      amount,
      unit,
      note: (_f = rawNote == null ? void 0 : rawNote.trim()) != null ? _f : ""
    };
  }).filter((automation) => automation !== null);
}
function normalizeHabitAutomation(input, index, definitions) {
  var _a, _b;
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input;
  const rawHabitId = typeof candidate.habitId === "string" ? candidate.habitId.trim() : "";
  const normalizedHabitKey = rawHabitId.toLowerCase();
  const normalizedHabitSlug = createHabitId(rawHabitId);
  const matchedDefinition = definitions.find((definition) => definition.id.toLowerCase() === normalizedHabitKey || definition.label.trim().toLowerCase() === normalizedHabitKey || createHabitId(definition.label) === normalizedHabitSlug);
  const habitId = (_a = matchedDefinition == null ? void 0 : matchedDefinition.id) != null ? _a : normalizedHabitSlug;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";
  if (!habitId || !label || !unit) {
    return null;
  }
  const intakeKind = candidate.intakeKind === "food" || candidate.intakeKind === "medication" || candidate.intakeKind === "supplement" || candidate.intakeKind === "drink" ? candidate.intakeKind : "drink";
  const amount = clamp(Number((_b = candidate.amount) != null ? _b : 1), 0.1, 9999);
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id.trim() : `${habitId}-${intakeKind}-${createHabitId(`${label}-${unit}-${index}`)}`,
    habitId,
    intakeKind,
    label,
    amount,
    unit,
    note: typeof candidate.note === "string" ? candidate.note.trim() : ""
  };
}

// src/dashboard-logs.ts
var DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60;
var CALENDAR_FOLLOW_THROUGH_MARKER = "daily-dashboard-calendar-follow:";
function renderDailyLog(entry, habits, nextEntry, calendarEvents = []) {
  var _a, _b, _c, _d, _e, _f;
  const payload = JSON.stringify(entry, null, 2);
  const habitLines = habits.map((habit) => {
    var _a2, _b2;
    const events = (_a2 = entry.habitEvents[habit.id]) != null ? _a2 : [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    const inWindowCount = countHabitEventsInWindow(events, habit.completionWindow);
    return `- ${habit.label}: ${(_b2 = entry.habits[habit.id]) != null ? _b2 : 0}/${habit.target}${timing} \u2022 ${formatHabitCadenceLabel(habit.cadence)} \u2022 ${formatHabitWindowLabel(habit.completionWindow)} \u2022 difficulty ${habit.difficultyWeight}/3 \u2022 in window ${inWindowCount}/${events.length || 0}`;
  });
  const habitMissNoteLines = habits.filter((habit) => {
    var _a2;
    return ((_a2 = entry.habitMissNotes[habit.id]) != null ? _a2 : "").trim().length > 0;
  }).map((habit) => `- ${habit.label}: ${entry.habitMissNotes[habit.id]}`);
  const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
  const drinkEntries = entry.intakeLog.filter((item) => item.kind === "drink");
  const intakeLines = entry.intakeLog.length > 0 ? entry.intakeLog.map((item) => {
    const history = item.loggedAtHistory.length > 0 ? item.loggedAtHistory : item.loggedAt ? [item.loggedAt] : [];
    const historySummary = history.length > 1 ? ` \u2022 taps ${history.length} at ${history.map((value) => value.slice(11, 16)).join(", ")}` : "";
    return `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.kind} \u2022 ${item.amount} ${item.unit} ${item.label}${item.note ? ` - ${item.note}` : ""}${historySummary}`;
  }) : ["- None logged"];
  const symptomLines = entry.symptomLog.length > 0 ? entry.symptomLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.symptom} \u2022 ${item.severity}/5${item.note ? ` - ${item.note}` : ""}`) : ["- None logged"];
  const exerciseLines = entry.exerciseLog.length > 0 ? entry.exerciseLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.label} \u2022 ${formatMinutesAsHours(item.durationMinutes)} \u2022 ${item.intensity}${item.note ? ` - ${item.note}` : ""}`) : ["- None logged"];
  const activityLines = entry.activitySessions.length > 0 ? entry.activitySessions.map((session) => {
    var _a2;
    return `- ${session.start.slice(11, 16)}-${((_a2 = session.end) != null ? _a2 : formatDateTimeKey(/* @__PURE__ */ new Date())).slice(11, 16)} \u2022 ${session.label}${session.tag ? ` \u2022 ${session.tag}` : ""}`;
  }) : ["- None logged"];
  const energyCheckInLines = entry.energyCheckIns.length > 0 ? entry.energyCheckIns.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.score}/5${item.note ? ` - ${item.note}` : ""}`) : ["- No energy check-ins logged"];
  const completedTaskLines = entry.completedTasks.length > 0 ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`) : ["- No archived tasks today"];
  const focusLines = entry.todayFocus.length > 0 ? entry.todayFocus.map((item) => renderTodayFocusLine(item)) : ["- No focus items set"];
  const nextUpLines = entry.nextUpFocus.length > 0 ? entry.nextUpFocus.map((item) => renderNextUpFocusLine(item)) : ["- No queued items"];
  const workSessionLines = entry.workSessions.length > 0 ? entry.workSessions.map((session) => renderSessionLine(session)) : ["- No tracked work sessions"];
  const napSessionLines = entry.napSessions.length > 0 ? entry.napSessions.map((session) => renderSessionLine(session)) : ["- No tracked naps"];
  const relaxSessionLines = entry.relaxSessions.length > 0 ? entry.relaxSessions.map((session) => renderSessionLine(session)) : ["- No tracked relaxing sessions"];
  const breakSessionLines = entry.breakSessions.length > 0 ? entry.breakSessions.map((session) => renderSessionLine(session)) : ["- No tracked breaks"];
  const poopSessionLines = entry.poopSessions.length > 0 ? entry.poopSessions.map((session) => `${renderSessionLine(session)}${entry.poopQualityByStart[session.start] ? ` \u2022 quality ${entry.poopQualityByStart[session.start]}` : ""}`) : ["- No tracked bowel movement sessions"];
  const calendarEventLines = calendarEvents.length > 0 ? calendarEvents.map((event) => renderCalendarEventLine(event)) : ["- No calendar events"];
  const calendarFollowThroughLines = calendarEvents.length > 0 ? calendarEvents.map((event) => {
    const checked = entry.calendarFollowThroughCompleted.includes(event.id) ? "x" : " ";
    return `- [${checked}] Follow through on ${event.title} ${renderCalendarEventContextLabel(event)} <!-- ${CALENDAR_FOLLOW_THROUGH_MARKER}${event.id} -->`;
  }) : ["- No follow-through items"];
  const totalWorkMinutes = getTrackedWorkMinutes(entry);
  const totalSleepMinutes = getSleepMinutesForDay(entry, nextEntry);
  const totalNapMinutes = getTrackedMinutes(entry.napSessions);
  const totalRelaxMinutes = getTrackedRelaxMinutes(entry);
  const totalBreakMinutes = getTrackedBreakMinutes(entry);
  const totalPoopMinutes = getTrackedPoopMinutes(entry);
  const totalPoopCount = getTrackedPoopCount(entry);
  return [
    "---",
    `date: ${entry.date}`,
    `lastEditedAt: ${entry.lastEditedAt || ""}`,
    `updatedAt: ${entry.lastEditedAt || ""}`,
    `dayStartedAt: ${entry.dayStartedAt || ""}`,
    `dayEndedAt: ${entry.dayEndedAt || ""}`,
    `wakeTime: ${entry.wakeTime || ""}`,
    `wakeQualityScore: ${entry.wakeQualityScore}`,
    `sleepTime: ${entry.sleepTime || ""}`,
    `sleepMinutesOverride: ${(_a = entry.sleepMinutesOverride) != null ? _a : ""}`,
    `trackedSleepMinutes: ${totalSleepMinutes}`,
    `trackedWorkMinutes: ${totalWorkMinutes}`,
    `trackedNapMinutes: ${totalNapMinutes}`,
    `trackedRelaxMinutes: ${totalRelaxMinutes}`,
    `trackedBreakMinutes: ${totalBreakMinutes}`,
    `trackedPoopMinutes: ${totalPoopMinutes}`,
    `trackedPoopCount: ${totalPoopCount}`,
    `workMinutesOverride: ${(_b = entry.workMinutesOverride) != null ? _b : ""}`,
    `napMinutesOverride: ${(_c = entry.napMinutesOverride) != null ? _c : ""}`,
    `relaxMinutesOverride: ${(_d = entry.relaxMinutesOverride) != null ? _d : ""}`,
    `breakMinutesOverride: ${(_e = entry.breakMinutesOverride) != null ? _e : ""}`,
    `workCompleted: ${entry.completedTasks.length}`,
    `foodEntryCount: ${foodEntries.length}`,
    `intakeEntryCount: ${drinkEntries.length}`,
    `symptomEntryCount: ${entry.symptomLog.length}`,
    `exerciseEntryCount: ${entry.exerciseLog.length}`,
    `activitySessionCount: ${entry.activitySessions.length}`,
    `bodyWeight: ${(_f = entry.bodyWeight) != null ? _f : ""}`,
    `energyCheckInCount: ${entry.energyCheckIns.length}`,
    `dreamLogged: ${entry.dreamLog.trim().length > 0}`,
    `moodScore: ${entry.moodScore}`,
    `energyScore: ${entry.energyScore}`,
    `anxietyScore: ${entry.anxietyScore}`,
    "---",
    "",
    `# Obsidian DASH Log - ${entry.date}`,
    "",
    "## Day Flow",
    `- Day started: ${entry.dayStartedAt || "Not started"}`,
    `- Wake time: ${entry.wakeTime || "Not logged"}`,
    `- Day ended: ${entry.dayEndedAt || "Not ended"}`,
    `- Sleep time: ${entry.sleepTime || "Not logged"}`,
    `- Wake quality: ${renderScore(entry.wakeQualityScore)}`,
    `- Tracked sleep: ${formatMinutesAsHours(totalSleepMinutes)}`,
    `- Tracked work: ${formatMinutesAsHours(totalWorkMinutes)}`,
    `- Tracked naps: ${formatMinutesAsHours(totalNapMinutes)}`,
    `- Tracked relaxing: ${formatMinutesAsHours(totalRelaxMinutes)}`,
    `- Tracked breaks: ${formatMinutesAsHours(totalBreakMinutes)}`,
    `- Tracked poop: ${formatMinutesAsHours(totalPoopMinutes)}`,
    `- Bowel movements: ${totalPoopCount}`,
    "",
    "## Habits",
    ...habitLines,
    "",
    "## Habit Miss Notes",
    ...habitMissNoteLines.length > 0 ? habitMissNoteLines : ["- No miss notes yet."],
    "",
    "## Top 3 For Today",
    ...focusLines,
    "",
    "## Next Up",
    ...nextUpLines,
    "",
    "## Calendar Events",
    ...calendarEventLines,
    "",
    "## Calendar Follow-Through",
    ...calendarFollowThroughLines,
    "",
    "## State, Symptoms And Friction",
    `- Mood: ${renderScore(entry.moodScore)}`,
    `- Energy: ${renderScore(entry.energyScore)}`,
    `- Anxiety: ${renderScore(entry.anxietyScore)}`,
    "",
    "### Symptoms",
    ...symptomLines,
    "",
    "### Friction",
    entry.frictionLog || "No friction log yet.",
    "",
    "### Energy Timeline",
    ...energyCheckInLines,
    "",
    "## Consumables",
    ...intakeLines,
    "",
    "## Exercise",
    `- Body weight: ${typeof entry.bodyWeight === "number" ? `${entry.bodyWeight}` : "Not logged"}`,
    ...exerciseLines,
    "",
    "## Other Activity Sessions",
    ...activityLines,
    "",
    "## Diet Insight",
    entry.dietInsight || "No AI nutrition summary yet.",
    "",
    "## Sleep Log",
    entry.sleepLog || "No sleep log yet.",
    "",
    "## Dream Log",
    entry.dreamLog || "No dream log yet.",
    "",
    "## Micro Reflections",
    `- What helped today?: ${entry.helpedToday || "Nothing logged yet."}`,
    `- What hurt today?: ${entry.hurtToday || "Nothing logged yet."}`,
    "",
    "## Work Sessions",
    ...workSessionLines,
    "",
    "## Nap Sessions",
    ...napSessionLines,
    "",
    "## Relax Sessions",
    ...relaxSessionLines,
    "",
    "## Break Sessions",
    ...breakSessionLines,
    "",
    "## Poop Sessions",
    ...poopSessionLines,
    "",
    "## Work Completed",
    ...completedTaskLines,
    "",
    "## Notes",
    entry.notes || "No notes yet.",
    "",
    "## Entry Payload",
    "```json",
    payload,
    "```",
    ""
  ].join("\n");
}
function parseDailyLogEntry(content, fallbackDate, habits) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return null;
  }
  let index = 1;
  const frontmatter = /* @__PURE__ */ new Map();
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "---") {
      index += 1;
      break;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter.set(key, value);
  }
  const date = (_a = frontmatter.get("date")) != null ? _a : fallbackDate;
  if (!date) {
    return null;
  }
  const payloadLines = [];
  const focusLines = [];
  const nextUpLines = [];
  const calendarFollowThroughCompleted = /* @__PURE__ */ new Set();
  let currentSection = "";
  let inPayload = false;
  for (; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed.slice(3).trim().toLowerCase();
      continue;
    }
    if (currentSection === "top 3 for today" && trimmed.startsWith("- ")) {
      focusLines.push(trimmed.slice(2).trim());
      continue;
    }
    if (currentSection === "next up" && trimmed.startsWith("- ")) {
      nextUpLines.push(trimmed.slice(2).trim());
      continue;
    }
    if (currentSection === "calendar follow-through") {
      const markerMatch = lines[index].match(new RegExp(`<!--\\s*${CALENDAR_FOLLOW_THROUGH_MARKER}([^\\s]+)\\s*-->`));
      const checklistMatch = lines[index].match(CHECKLIST_REGEX);
      if (markerMatch && checklistMatch && checklistMatch[1].toLowerCase() === "x") {
        calendarFollowThroughCompleted.add(markerMatch[1]);
      }
      continue;
    }
    if (currentSection !== "entry payload") {
      continue;
    }
    if (trimmed === "```json") {
      inPayload = true;
      continue;
    }
    if (trimmed === "```" && inPayload) {
      inPayload = false;
      continue;
    }
    if (inPayload) {
      payloadLines.push(lines[index]);
    }
  }
  let parsedEntry = {};
  if (payloadLines.length > 0) {
    try {
      parsedEntry = JSON.parse(payloadLines.join("\n"));
    } catch (error) {
      console.warn("Obsidian DASH - Daily Action & System Hub could not parse daily log payload", error);
    }
  }
  const baseEntry = createEmptyEntry(date, habits);
  const todayFocus = Array.isArray(parsedEntry.todayFocus) ? normalizeTodayFocusItems(parsedEntry.todayFocus) : focusLines.map((line) => parseTodayFocusLine(line)).filter((item) => item !== null).slice(0, 3);
  const nextUpFocus = Array.isArray(parsedEntry.nextUpFocus) ? parsedEntry.nextUpFocus.map((item) => parseNextUpFocusItem(typeof item === "string" ? item : renderNextUpFocusLine(item))).filter((item) => item !== null) : nextUpLines.map((line) => parseNextUpFocusItem(line)).filter((item) => item !== null);
  return {
    ...baseEntry,
    ...parsedEntry,
    date,
    lastEditedAt: (_c = (_b = frontmatter.get("lastEditedAt")) != null ? _b : frontmatter.get("updatedAt")) != null ? _c : getEntryRecencyKey(parsedEntry),
    dayStartedAt: (_d = frontmatter.get("dayStartedAt")) != null ? _d : typeof parsedEntry.dayStartedAt === "string" ? parsedEntry.dayStartedAt : "",
    dayEndedAt: (_e = frontmatter.get("dayEndedAt")) != null ? _e : typeof parsedEntry.dayEndedAt === "string" ? parsedEntry.dayEndedAt : "",
    wakeTime: (_f = frontmatter.get("wakeTime")) != null ? _f : typeof parsedEntry.wakeTime === "string" ? parsedEntry.wakeTime : "",
    wakeQualityScore: Number((_h = (_g = frontmatter.get("wakeQualityScore")) != null ? _g : parsedEntry.wakeQualityScore) != null ? _h : 0),
    sleepTime: (_i = frontmatter.get("sleepTime")) != null ? _i : typeof parsedEntry.sleepTime === "string" ? parsedEntry.sleepTime : "",
    sleepMinutesOverride: normalizeOptionalMinutes((_j = frontmatter.get("sleepMinutesOverride")) != null ? _j : parsedEntry.sleepMinutesOverride),
    moodScore: Number((_l = (_k = frontmatter.get("moodScore")) != null ? _k : parsedEntry.moodScore) != null ? _l : 0),
    energyScore: Number((_n = (_m = frontmatter.get("energyScore")) != null ? _m : parsedEntry.energyScore) != null ? _n : 0),
    anxietyScore: Number((_p = (_o = frontmatter.get("anxietyScore")) != null ? _o : parsedEntry.anxietyScore) != null ? _p : 0),
    habits: (_q = parsedEntry.habits) != null ? _q : baseEntry.habits,
    habitEvents: (_r = parsedEntry.habitEvents) != null ? _r : baseEntry.habitEvents,
    todayFocus,
    nextUpFocus,
    calendarFollowThroughCompleted: Array.from(/* @__PURE__ */ new Set([
      ...Array.isArray(parsedEntry.calendarFollowThroughCompleted) ? parsedEntry.calendarFollowThroughCompleted.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      ...Array.from(calendarFollowThroughCompleted)
    ])).sort(),
    frictionLog: typeof parsedEntry.frictionLog === "string" ? parsedEntry.frictionLog : baseEntry.frictionLog,
    missedHabits: Array.isArray(parsedEntry.missedHabits) ? parsedEntry.missedHabits : baseEntry.missedHabits,
    habitMissNotes: parsedEntry.habitMissNotes && typeof parsedEntry.habitMissNotes === "object" ? parsedEntry.habitMissNotes : baseEntry.habitMissNotes,
    foodLog: Array.isArray(parsedEntry.foodLog) ? parsedEntry.foodLog : baseEntry.foodLog,
    intakeLog: Array.isArray(parsedEntry.intakeLog) ? parsedEntry.intakeLog : baseEntry.intakeLog,
    symptomLog: Array.isArray(parsedEntry.symptomLog) ? parsedEntry.symptomLog : baseEntry.symptomLog,
    energyCheckIns: Array.isArray(parsedEntry.energyCheckIns) ? parsedEntry.energyCheckIns : baseEntry.energyCheckIns,
    dietInsight: typeof parsedEntry.dietInsight === "string" ? parsedEntry.dietInsight : baseEntry.dietInsight,
    sleepLog: typeof parsedEntry.sleepLog === "string" ? parsedEntry.sleepLog : baseEntry.sleepLog,
    dreamLog: typeof parsedEntry.dreamLog === "string" ? parsedEntry.dreamLog : baseEntry.dreamLog,
    helpedToday: typeof parsedEntry.helpedToday === "string" ? parsedEntry.helpedToday : baseEntry.helpedToday,
    hurtToday: typeof parsedEntry.hurtToday === "string" ? parsedEntry.hurtToday : baseEntry.hurtToday,
    notes: typeof parsedEntry.notes === "string" ? parsedEntry.notes : baseEntry.notes,
    workSessions: Array.isArray(parsedEntry.workSessions) ? parsedEntry.workSessions : baseEntry.workSessions,
    workMinutesOverride: normalizeOptionalMinutes((_s = frontmatter.get("workMinutesOverride")) != null ? _s : parsedEntry.workMinutesOverride),
    napSessions: Array.isArray(parsedEntry.napSessions) ? parsedEntry.napSessions : baseEntry.napSessions,
    napMinutesOverride: normalizeOptionalMinutes((_t = frontmatter.get("napMinutesOverride")) != null ? _t : parsedEntry.napMinutesOverride),
    relaxSessions: Array.isArray(parsedEntry.relaxSessions) ? parsedEntry.relaxSessions : baseEntry.relaxSessions,
    relaxMinutesOverride: normalizeOptionalMinutes((_u = frontmatter.get("relaxMinutesOverride")) != null ? _u : parsedEntry.relaxMinutesOverride),
    breakSessions: Array.isArray(parsedEntry.breakSessions) ? parsedEntry.breakSessions : baseEntry.breakSessions,
    breakMinutesOverride: normalizeOptionalMinutes((_v = frontmatter.get("breakMinutesOverride")) != null ? _v : parsedEntry.breakMinutesOverride),
    poopSessions: Array.isArray(parsedEntry.poopSessions) ? parsedEntry.poopSessions : baseEntry.poopSessions,
    poopQualityByStart: parsedEntry.poopQualityByStart && typeof parsedEntry.poopQualityByStart === "object" ? parsedEntry.poopQualityByStart : baseEntry.poopQualityByStart,
    completedTasks: Array.isArray(parsedEntry.completedTasks) ? parsedEntry.completedTasks : baseEntry.completedTasks
  };
}
function renderPeriodReport(input) {
  var _a, _b;
  const sleepInsights = buildSleepInsights(input.entries, void 0, input.habitDefinitions);
  const personalTrends = buildPersonalTrendSummary(input.entries, input.habitDefinitions);
  const gamification = buildGamificationSummary(input.entries, input.habitDefinitions, (_a = input.todoSnapshot) != null ? _a : null);
  const blockerPatterns = buildBlockerPatternLines(input.entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(input.entries);
  const missedHabitPatterns = buildMissedHabitPatternLines(input.entries, input.habitDefinitions);
  const narrativeLines = buildNarrativeSectionLines(input.entries, sleepInsights, personalTrends, gamification, (_b = input.todoSnapshot) != null ? _b : null);
  const workByProject = /* @__PURE__ */ new Map();
  let daysWithFood = 0;
  let daysWithSleep = 0;
  let daysWithDreams = 0;
  let moodTotal = 0;
  let moodDays = 0;
  let energyTotal = 0;
  let energyDays = 0;
  let anxietyTotal = 0;
  let anxietyDays = 0;
  let wakeQualityTotal = 0;
  let wakeQualityDays = 0;
  let trackedWorkMinutes = 0;
  let trackedNapMinutes = 0;
  let trackedRelaxMinutes = 0;
  let trackedBreakMinutes = 0;
  let trackedPoopMinutes = 0;
  let trackedPoopCount = 0;
  let daysWithNaps = 0;
  input.entries.forEach((entry) => {
    if (entry.intakeLog.length > 0) {
      daysWithFood += 1;
    }
    if (entry.sleepLog.trim().length > 0) {
      daysWithSleep += 1;
    }
    if (entry.dreamLog.trim().length > 0) {
      daysWithDreams += 1;
    }
    if (entry.moodScore > 0) {
      moodTotal += entry.moodScore;
      moodDays += 1;
    }
    if (entry.energyScore > 0) {
      energyTotal += entry.energyScore;
      energyDays += 1;
    }
    if (entry.anxietyScore > 0) {
      anxietyTotal += entry.anxietyScore;
      anxietyDays += 1;
    }
    if (entry.wakeQualityScore > 0) {
      wakeQualityTotal += entry.wakeQualityScore;
      wakeQualityDays += 1;
    }
    trackedWorkMinutes += getTrackedWorkMinutes(entry);
    trackedNapMinutes += getTrackedMinutes(entry.napSessions);
    trackedRelaxMinutes += getTrackedRelaxMinutes(entry);
    trackedBreakMinutes += getTrackedBreakMinutes(entry);
    trackedPoopMinutes += getTrackedPoopMinutes(entry);
    trackedPoopCount += getTrackedPoopCount(entry);
    if (entry.napSessions.length > 0) {
      daysWithNaps += 1;
    }
    entry.completedTasks.forEach((task) => {
      var _a2;
      workByProject.set(task.project, ((_a2 = workByProject.get(task.project)) != null ? _a2 : 0) + 1);
    });
  });
  const habitRows = input.habitDefinitions.map((habit) => {
    const completed = input.entries.reduce((sum, entry) => {
      var _a2;
      return sum + Math.min((_a2 = entry.habits[habit.id]) != null ? _a2 : 0, habit.target);
    }, 0);
    const target = input.entries.length * habit.target;
    const percentage = target > 0 ? Math.round(completed / target * 100) : 0;
    return `| ${habit.label} | ${completed}/${target} | ${percentage}% |`;
  });
  const workLines = Array.from(workByProject.entries()).sort((left, right) => right[1] - left[1]).map(([project, count]) => `- ${project}: ${count}`);
  const dayLines = input.entries.map((entry) => {
    const foodSummary = entry.intakeLog.length > 0 ? `${entry.intakeLog.length} consumables` : "no consumables";
    const trackedNapMinutesForEntry = getTrackedNapMinutes(entry);
    const trackedSleepMinutesForEntry = getSleepMinutesForDay(entry, input.entries.find((candidate) => candidate.date > entry.date));
    const napSummary = trackedNapMinutesForEntry > 0 ? `${formatMinutesAsHours(trackedNapMinutesForEntry)} naps` : "no naps";
    const sleepSummary = trackedSleepMinutesForEntry > 0 ? `${formatMinutesAsHours(trackedSleepMinutesForEntry)} sleep` : "sleep untracked";
    const dreamSummary = entry.dreamLog.trim().length > 0 ? "dream logged" : "no dream log";
    const relaxSummary = entry.relaxSessions.length > 0 || entry.breakSessions.length > 0 ? `${formatMinutesAsHours(getTrackedRelaxMinutes(entry) + getTrackedBreakMinutes(entry))} relaxed` : "no relax tracked";
    const poopCount = getTrackedPoopCount(entry);
    const poopSummary = poopCount > 0 ? `${poopCount} bowel movement${poopCount === 1 ? "" : "s"}` : "no bowel movements tracked";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, ${sleepSummary}, ${napSummary}, ${relaxSummary}, ${poopSummary}, ${dreamSummary}, wake quality ${renderScore(entry.wakeQualityScore)}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}, anxiety ${renderScore(entry.anxietyScore)}`;
  });
  return [
    `# ${input.title}`,
    "",
    `Range: ${input.rangeLabel}`,
    "",
    "## Overview",
    `- Days captured: ${input.entries.length}`,
    `- Archived tasks completed: ${input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0)}`,
    `- Days with consumables logged: ${daysWithFood}`,
    `- Days with sleep logged: ${daysWithSleep}`,
    `- Days with dream logs: ${daysWithDreams}`,
    `- Tracked work time: ${formatMinutesAsHours(trackedWorkMinutes)}`,
    `- Days with naps tracked: ${daysWithNaps}`,
    `- Tracked nap time: ${formatMinutesAsHours(trackedNapMinutes)}`,
    `- Tracked relaxing time: ${formatMinutesAsHours(trackedRelaxMinutes + trackedBreakMinutes)}`,
    `- Tracked bowel time: ${formatMinutesAsHours(trackedPoopMinutes)}`,
    `- Bowel movements tracked: ${trackedPoopCount}`,
    `- Average sleep: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.averageSleepMinutes) : "No sleep data"}`,
    `- Average recovery: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100 (${sleepInsights.recoveryLabel})` : "No recovery data"}`,
    `- Sleep debt: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.debtMinutes) : "No sleep data"}`,
    `- Sleep consistency: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 (${sleepInsights.consistencyLabel})` : "No sleep data"}`,
    `- Average wake quality: ${wakeQualityDays > 0 ? `${(wakeQualityTotal / wakeQualityDays).toFixed(1)}/5` : "No wake-quality data"}`,
    `- Average mood: ${moodDays > 0 ? `${(moodTotal / moodDays).toFixed(1)}/5` : "No mood data"}`,
    `- Average energy: ${energyDays > 0 ? `${(energyTotal / energyDays).toFixed(1)}/5` : "No energy data"}`,
    `- Average anxiety: ${anxietyDays > 0 ? `${(anxietyTotal / anxietyDays).toFixed(1)}/5` : "No anxiety data"}`,
    "",
    "## Habit Completion",
    "| Habit | Completed | Rate |",
    "| --- | --- | --- |",
    ...habitRows,
    "",
    "## Personal Trends",
    ...renderPersonalTrendSectionLines(personalTrends),
    "",
    "## Gamification Center",
    ...renderGamificationSectionLines(gamification),
    "",
    "## Blocker Patterns",
    ...blockerPatterns.length > 0 ? blockerPatterns : ["- No repeated blockers stood out in this period."],
    "",
    "## Accomplishments By Project",
    ...accomplishmentLines.length > 0 ? accomplishmentLines : ["- No project accomplishments were archived in this period."],
    "",
    "## Missed Habit Patterns",
    ...missedHabitPatterns.length > 0 ? missedHabitPatterns : ["- No repeated habit misses stood out in this period."],
    "",
    ...input.entries.length >= 20 ? ["## Month-End Narrative", ...narrativeLines, ""] : [],
    "## Work By Project",
    ...workLines.length > 0 ? workLines : ["- No archived tasks recorded in this period"],
    "",
    "## Daily Breakdown",
    ...dayLines.length > 0 ? dayLines : ["- No daily entries recorded in this period"],
    ""
  ].join("\n");
}
function closeOpenWorkSessions(entry, timestamp) {
  entry.workSessions = entry.workSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function closeOpenNapSessions(entry, timestamp) {
  entry.napSessions = entry.napSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function closeOpenRelaxSessions(entry, timestamp) {
  entry.relaxSessions = entry.relaxSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function closeOpenBreakSessions(entry, timestamp) {
  entry.breakSessions = entry.breakSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function closeOpenPoopSessions(entry, timestamp) {
  entry.poopSessions = entry.poopSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function closeOpenActivitySessions(entry, timestamp) {
  entry.activitySessions = entry.activitySessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}
function getTrackedWorkMinutes(entry) {
  return resolveTrackedMinutes(entry.workSessions, entry.workMinutesOverride);
}
function getTrackedNapMinutes(entry) {
  return resolveTrackedMinutes(entry.napSessions, entry.napMinutesOverride);
}
function getTrackedRelaxMinutes(entry) {
  return resolveTrackedMinutes(entry.relaxSessions, entry.relaxMinutesOverride);
}
function getTrackedBreakMinutes(entry) {
  return resolveTrackedMinutes(entry.breakSessions, entry.breakMinutesOverride);
}
function getTrackedPoopMinutes(entry) {
  return getTrackedMinutes(entry.poopSessions);
}
function getTrackedActivityMinutes(entry, kind) {
  return getTrackedMinutes(kind ? entry.activitySessions.filter((session) => session.kind === kind) : entry.activitySessions);
}
function getTrackedPoopCount(entry) {
  return entry.poopSessions.length;
}
function resolveTrackedMinutes(sessions, override) {
  const trackedMinutes = getTrackedMinutes(sessions);
  if (typeof override === "number" && override >= 0) {
    return override === 0 && trackedMinutes > 0 ? trackedMinutes : override;
  }
  return trackedMinutes;
}
function normalizeOptionalMinutes(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }
  return Math.round(numericValue);
}
function getTrackedMinutes(sessions) {
  return sessions.reduce((total, session) => {
    var _a;
    const end = (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date());
    return total + getMinutesBetween(session.start, end);
  }, 0);
}
function getMinutesBetween(startValue, endValue) {
  const start = parseDateTimeKey(startValue);
  const end = parseDateTimeKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 6e4));
}
function parseDateTimeKey(value) {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatMinutesAsHours(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
function renderWeeklyReview(input) {
  var _a, _b, _c, _d;
  const sleepInsights = buildSleepInsights(input.entries, void 0, input.habits);
  const personalTrends = buildPersonalTrendSummary(input.entries, input.habits);
  const gamification = buildGamificationSummary(input.entries, input.habits, input.todoSnapshot);
  const blockerPatterns = buildBlockerPatternLines(input.entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(input.entries);
  const missedHabitPatterns = buildMissedHabitPatternLines(input.entries, input.habits);
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const wakeQualityEntries = input.entries.filter((entry) => entry.wakeQualityScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const averageWakeQuality = wakeQualityEntries.length > 0 ? (wakeQualityEntries.reduce((sum, entry) => sum + entry.wakeQualityScore, 0) / wakeQualityEntries.length).toFixed(1) : "n/a";
  const focusItems = Array.from(new Set(input.entries.flatMap((entry) => getTodayFocusTexts(entry.todayFocus)))).slice(0, 10);
  const frictionItems = input.entries.map((entry) => entry.frictionLog).filter(Boolean);
  const missedHabits = Array.from(new Set(input.entries.flatMap((entry) => entry.missedHabits)));
  const strongestProjects = [...(_b = (_a = input.todoSnapshot) == null ? void 0 : _a.projects) != null ? _b : []].sort((left, right) => right.completionsThisWeek - left.completionsThisWeek).slice(0, 5);
  const staleProjects = (_d = (_c = input.todoSnapshot) == null ? void 0 : _c.staleProjects.slice(0, 5)) != null ? _d : [];
  return [
    `# Weekly Review - ${input.label}`,
    "",
    `Range: ${formatDateKey(input.start)} to ${formatDateKey(input.end)}`,
    "",
    "## Executive Summary",
    `- Archived tasks completed: ${totalTasks}`,
    `- Average mood: ${averageMood === "n/a" ? "No data" : `${averageMood}/5`}`,
    `- Average energy: ${averageEnergy === "n/a" ? "No data" : `${averageEnergy}/5`}`,
    `- Average wake quality: ${averageWakeQuality === "n/a" ? "No data" : `${averageWakeQuality}/5`}`,
    `- Average sleep: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.averageSleepMinutes) : "No sleep data"}`,
    `- Average recovery: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100 (${sleepInsights.recoveryLabel})` : "No recovery data"}`,
    `- Sleep debt: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.debtMinutes) : "No sleep data"}`,
    `- Sleep consistency: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 (${sleepInsights.consistencyLabel})` : "No sleep data"}`,
    `- Days captured: ${input.entries.length}`,
    "",
    "## Top Focus",
    ...focusItems.length > 0 ? focusItems.map((item) => `- ${item}`) : ["- No focus items recorded."],
    "",
    "## Friction Log",
    ...frictionItems.length > 0 ? frictionItems.map((item) => `- ${item}`) : ["- No friction logged."],
    "",
    "## Missed Habits",
    ...missedHabits.length > 0 ? missedHabits.map((item) => `- ${item}`) : ["- No recurring misses."],
    "",
    "## Personal Trends",
    ...renderPersonalTrendSectionLines(personalTrends),
    "",
    "## Gamification Center",
    ...renderGamificationSectionLines(gamification),
    "",
    "## Blocker Patterns",
    ...blockerPatterns.length > 0 ? blockerPatterns : ["- No repeated blockers stood out this week."],
    "",
    "## Accomplishments By Project",
    ...accomplishmentLines.length > 0 ? accomplishmentLines : ["- No project accomplishments were archived this week."],
    "",
    "## Missed Habit Patterns",
    ...missedHabitPatterns.length > 0 ? missedHabitPatterns : ["- No repeated habit misses stood out this week."],
    "",
    "## Strongest Projects",
    ...strongestProjects.length > 0 ? strongestProjects.map((project) => `- ${project.name}: ${project.completionsThisWeek} completions this week, ${project.healthLabel.toLowerCase()} health`) : ["- No project output recorded."],
    "",
    "## Projects Needing Attention",
    ...staleProjects.length > 0 ? staleProjects.map((project) => `- ${project.name}: stale for ${project.staleDays} days, ${project.openCount} open tasks`) : ["- No stale projects detected."],
    "",
    "## Daily Notes",
    ...input.entries.length > 0 ? input.entries.map((entry) => `- ${entry.date}: ${entry.completedTasks.length} archived, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`) : ["- No daily entries recorded."],
    ""
  ].join("\n");
}
function buildPersonalTrendSummary(entries, habits) {
  if (entries.length === 0) {
    return {
      strongestSignals: [],
      driftSignals: [],
      repeatedMisses: [],
      symptomSignals: [],
      reflectionSignals: []
    };
  }
  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const midpoint = Math.max(1, Math.floor(orderedEntries.length / 2));
  const firstHalf = orderedEntries.slice(0, midpoint);
  const secondHalf = orderedEntries.slice(midpoint);
  const firstEnergy = averageEntryScore(firstHalf, "energyScore");
  const secondEnergy = averageEntryScore(secondHalf, "energyScore");
  const firstMood = averageEntryScore(firstHalf, "moodScore");
  const secondMood = averageEntryScore(secondHalf, "moodScore");
  const firstRecovery = buildSleepInsights(firstHalf, void 0, habits).averageRecoveryScore;
  const secondRecovery = buildSleepInsights(secondHalf, void 0, habits).averageRecoveryScore;
  const waterDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "drink" && /water/i.test(item.label))).length;
  const caffeineDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "drink" && /coffee|tea|cola|caffeine|energy/i.test(item.label))).length;
  const helpedDays = orderedEntries.filter((entry) => entry.helpedToday.trim().length > 0).length;
  const hurtDays = orderedEntries.filter((entry) => entry.hurtToday.trim().length > 0).length;
  const missCounts = /* @__PURE__ */ new Map();
  orderedEntries.forEach((entry) => {
    entry.missedHabits.forEach((item) => {
      var _a;
      return missCounts.set(item, ((_a = missCounts.get(item)) != null ? _a : 0) + 1);
    });
  });
  const symptomCounts = /* @__PURE__ */ new Map();
  orderedEntries.forEach((entry) => {
    entry.symptomLog.forEach((item) => {
      var _a;
      return symptomCounts.set(item.symptom, ((_a = symptomCounts.get(item.symptom)) != null ? _a : 0) + 1);
    });
  });
  return {
    strongestSignals: [
      secondEnergy > firstEnergy ? `Energy improved from ${firstEnergy.toFixed(1)}/5 to ${secondEnergy.toFixed(1)}/5 across the period.` : "",
      secondMood > firstMood ? `Mood improved from ${firstMood.toFixed(1)}/5 to ${secondMood.toFixed(1)}/5 across the period.` : "",
      secondRecovery > firstRecovery ? `Recovery improved from ${firstRecovery}/100 to ${secondRecovery}/100 across the period.` : "",
      waterDays > 0 ? `Hydration was logged on ${waterDays}/${orderedEntries.length} days.` : "",
      helpedDays > 0 ? `Positive reflections were captured on ${helpedDays}/${orderedEntries.length} days.` : ""
    ].filter((item) => item.length > 0),
    driftSignals: [
      secondEnergy < firstEnergy ? `Energy drifted down from ${firstEnergy.toFixed(1)}/5 to ${secondEnergy.toFixed(1)}/5.` : "",
      secondMood < firstMood ? `Mood drifted down from ${firstMood.toFixed(1)}/5 to ${secondMood.toFixed(1)}/5.` : "",
      secondRecovery < firstRecovery ? `Recovery drifted from ${firstRecovery}/100 to ${secondRecovery}/100.` : "",
      caffeineDays > Math.ceil(orderedEntries.length / 2) ? `Caffeine showed up on ${caffeineDays}/${orderedEntries.length} days.` : "",
      hurtDays > Math.ceil(orderedEntries.length / 2) ? `Negative reflections were logged on ${hurtDays}/${orderedEntries.length} days.` : ""
    ].filter((item) => item.length > 0),
    repeatedMisses: Array.from(missCounts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 4).map(([label, count]) => `${label} missed on ${count} day${count === 1 ? "" : "s"}.`),
    symptomSignals: Array.from(symptomCounts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 4).map(([label, count]) => `${label} logged on ${count} day${count === 1 ? "" : "s"}.`),
    reflectionSignals: [
      orderedEntries.map((entry) => entry.helpedToday.trim()).filter((item) => item.length > 0).slice(-3).map((item) => `Helped: ${item}`),
      orderedEntries.map((entry) => entry.hurtToday.trim()).filter((item) => item.length > 0).slice(-3).map((item) => `Hurt: ${item}`)
    ].flat()
  };
}
function renderPersonalTrendSectionLines(summary) {
  return [
    "Strongest signals:",
    ...summary.strongestSignals.length > 0 ? summary.strongestSignals.map((item) => `- ${item}`) : ["- No strong positive trend stood out in this range."],
    "",
    "Drift signals:",
    ...summary.driftSignals.length > 0 ? summary.driftSignals.map((item) => `- ${item}`) : ["- No major negative drift stood out in this range."],
    "",
    "Repeated misses:",
    ...summary.repeatedMisses.length > 0 ? summary.repeatedMisses.map((item) => `- ${item}`) : ["- No repeated habit misses stood out."],
    "",
    "Symptoms and reflections:",
    ...summary.symptomSignals.length > 0 || summary.reflectionSignals.length > 0 ? [...summary.symptomSignals, ...summary.reflectionSignals].map((item) => `- ${item}`) : ["- No persistent symptom or reflection pattern stood out."]
  ];
}
function buildGamificationSummary(entries, habits, todoSnapshot) {
  var _a, _b, _c, _d;
  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const daySnapshots = orderedEntries.map((entry, index) => buildGamificationSnapshot(
    entry.date,
    [entry],
    habits,
    todoSnapshot,
    orderedEntries[index - 1] ? buildGamificationSnapshot(orderedEntries[index - 1].date, [orderedEntries[index - 1]], habits, todoSnapshot) : null
  ));
  const todayEntries = orderedEntries.slice(-1);
  const previousDayEntries = orderedEntries.slice(-2, -1);
  const weekEntries = orderedEntries.slice(-7);
  const previousWeekEntries = orderedEntries.slice(-14, -7);
  const monthEntries = orderedEntries.slice(-30);
  const previousMonthEntries = orderedEntries.slice(-60, -30);
  const today = buildGamificationSnapshot((_b = (_a = todayEntries[0]) == null ? void 0 : _a.date) != null ? _b : "Today", todayEntries, habits, todoSnapshot, previousDayEntries.length > 0 ? buildGamificationSnapshot(previousDayEntries[0].date, previousDayEntries, habits, todoSnapshot) : null);
  const week = buildGamificationSnapshot("Last 7 days", weekEntries, habits, todoSnapshot, previousWeekEntries.length > 0 ? buildGamificationSnapshot("Previous 7 days", previousWeekEntries, habits, todoSnapshot) : null);
  const month = buildGamificationSnapshot("Last 30 days", monthEntries, habits, todoSnapshot, previousMonthEntries.length > 0 ? buildGamificationSnapshot("Previous 30 days", previousMonthEntries, habits, todoSnapshot) : null);
  const successThreshold = 70;
  let currentStreak = 0;
  for (let index = daySnapshots.length - 1; index >= 0; index -= 1) {
    if (daySnapshots[index].score >= successThreshold) {
      currentStreak += 1;
    } else {
      break;
    }
  }
  let bestStreak = 0;
  let streak = 0;
  daySnapshots.forEach((snapshot) => {
    if (snapshot.score >= successThreshold) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  });
  const personalBest = daySnapshots.reduce((best, snapshot) => snapshot.score > best.score ? { label: snapshot.label, score: snapshot.score } : best, { label: (_d = (_c = orderedEntries[0]) == null ? void 0 : _c.date) != null ? _d : "No data", score: 0 });
  const lowScoreThreshold = 45;
  let recoveryFromLowScoreDays = 0;
  for (let index = daySnapshots.length - 2; index >= 0; index -= 1) {
    if (daySnapshots[index].score < lowScoreThreshold) {
      recoveryFromLowScoreDays = daySnapshots.length - 1 - index;
      break;
    }
    if (index === 0) {
      recoveryFromLowScoreDays = daySnapshots.length > 0 ? daySnapshots.length - 1 : 0;
    }
  }
  return {
    model: "deterministic",
    today,
    week,
    month,
    currentStreak,
    bestStreak,
    personalBestDayLabel: personalBest.label,
    personalBestDayScore: personalBest.score,
    recoveryFromLowScoreDays,
    lowScoreThreshold
  };
}
function renderGamificationSectionLines(summary) {
  return [
    `- Model: ${summary.model}`,
    `- Today: ${summary.today.score}/${summary.today.maxScore} (${summary.today.grade}) \u2022 ${summary.today.comparisonText}`,
    `- Week: ${summary.week.score}/${summary.week.maxScore} (${summary.week.grade}) \u2022 ${summary.week.comparisonText}`,
    `- Month: ${summary.month.score}/${summary.month.maxScore} (${summary.month.grade}) \u2022 ${summary.month.comparisonText}`,
    `- Current streak: ${summary.currentStreak} day${summary.currentStreak === 1 ? "" : "s"}`,
    `- Best streak: ${summary.bestStreak} day${summary.bestStreak === 1 ? "" : "s"}`,
    `- Personal best day: ${summary.personalBestDayLabel} (${summary.personalBestDayScore}/100)`,
    `- Recovery from low-score days: ${summary.recoveryFromLowScoreDays} day${summary.recoveryFromLowScoreDays === 1 ? "" : "s"} since the last day under ${summary.lowScoreThreshold}`,
    "",
    ...renderGamificationSnapshotLines(summary.today)
  ];
}
function renderGamificationReport(input) {
  const summary = buildGamificationSummary(input.entries, input.habits, input.todoSnapshot);
  return [
    `# ${input.title}`,
    "",
    ...renderGamificationSectionLines(summary),
    "",
    "## Weekly Snapshot Details",
    ...renderGamificationSnapshotLines(summary.week),
    "",
    "## Monthly Snapshot Details",
    ...renderGamificationSnapshotLines(summary.month),
    ""
  ].join("\n");
}
function renderGamificationSnapshotLines(snapshot) {
  return [
    `### ${snapshot.label}`,
    `- Score: ${snapshot.score}/${snapshot.maxScore} (${snapshot.grade})`,
    `- Comparison: ${snapshot.comparisonText}`,
    `- Highlights: ${snapshot.highlights.join(" \u2022 ") || "None"}`,
    `- Cautions: ${snapshot.cautions.join(" \u2022 ") || "None"}`,
    ...snapshot.categories.flatMap((category) => [
      `- ${category.label}: ${category.score}/${category.maxScore} - ${category.summary}`,
      ...category.details.map((detail) => `  - ${detail}`)
    ])
  ];
}
function buildGamificationSnapshot(label, entries, habits, todoSnapshot, previous = null) {
  const categories = buildGamificationCategories(entries, habits, todoSnapshot);
  const score = Math.round(categories.reduce((sum, category) => sum + category.score, 0) / Math.max(categories.length, 1));
  const percentage = score;
  return {
    label,
    score,
    maxScore: 100,
    percentage,
    grade: score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F",
    comparisonText: previous ? `${score >= previous.score ? "+" : ""}${score - previous.score} vs previous window` : `${100 - score} points from a perfect run`,
    categories,
    highlights: categories.filter((category) => category.score >= 75).map((category) => `${category.label} strong`),
    cautions: categories.filter((category) => category.score < 55).map((category) => `${category.label} lagging`)
  };
}
function buildGamificationCategories(entries, habits, todoSnapshot) {
  const days = Math.max(entries.length, 1);
  const totalTasks = entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const totalWorkMinutes = entries.reduce((sum, entry) => sum + getTrackedWorkMinutes(entry), 0);
  const totalFocus = entries.reduce((sum, entry) => sum + entry.todayFocus.length, 0);
  const completedFocus = entries.reduce((sum, entry) => sum + entry.todayFocus.filter((item) => item.status === "done").length, 0);
  const focusCompletionRate = totalFocus > 0 ? completedFocus / totalFocus : 0;
  const activeDays = entries.filter((entry) => entry.completedTasks.length > 0 || getTrackedWorkMinutes(entry) > 0).length;
  const executionScore = clamp(Math.round(
    Math.min(35, totalTasks / days * 12) + Math.min(35, totalWorkMinutes / days / 8) + focusCompletionRate * 20 + activeDays / days * 10
  ), 0, 100);
  const weightedHabitAverage = entries.length > 0 ? Math.round(entries.reduce((sum, entry) => sum + getHabitWeightedCompletion(entry, habits).percentage, 0) / entries.length) : 0;
  const sleepInsights = buildSleepInsights(entries, void 0, habits);
  const averageMood = averageEntryScore(entries, "moodScore");
  const averageEnergy = averageEntryScore(entries, "energyScore");
  const averageAnxiety = averageEntryScore(entries, "anxietyScore");
  const symptomBurden = entries.reduce((sum, entry) => sum + entry.symptomLog.reduce((inner, symptom) => inner + symptom.severity, 0), 0) / days;
  const healthScore = clamp(Math.round(
    weightedHabitAverage * 0.35 + sleepInsights.averageRecoveryScore * 0.25 + averageMood * 8 + averageEnergy * 9 + (5 - averageAnxiety) * 6 - symptomBurden * 4
  ), 0, 100);
  const loggedEnergyDays = entries.filter((entry) => entry.energyCheckIns.length > 0).length;
  const loggedReflectionDays = entries.filter((entry) => entry.helpedToday.trim().length > 0 || entry.hurtToday.trim().length > 0).length;
  const loggedFoodDays = entries.filter((entry) => entry.foodLog.length > 0 || entry.intakeLog.length > 0).length;
  const consistencyScore = clamp(Math.round(
    sleepInsights.consistencyScore * 0.45 + weightedHabitAverage * 0.3 + loggedEnergyDays / days * 12 + loggedReflectionDays / days * 8 + loggedFoodDays / days * 5
  ), 0, 100);
  const totalRelaxMinutes = entries.reduce((sum, entry) => sum + getTrackedRelaxMinutes(entry) + getTrackedBreakMinutes(entry), 0);
  const totalNapMinutes = entries.reduce((sum, entry) => sum + getTrackedNapMinutes(entry), 0);
  const recoveryFriendlyDays = entries.filter((entry) => entry.helpedToday.trim().length > 0).length;
  const recoveryScore = clamp(Math.round(
    sleepInsights.averageRecoveryScore * 0.65 + Math.min(15, totalRelaxMinutes / days / 8) + Math.min(10, totalNapMinutes / days / 10) + recoveryFriendlyDays / days * 10
  ), 0, 100);
  const nextUpCoverage = entries.filter((entry) => entry.nextUpFocus.length > 0).length;
  const followThroughCount = entries.reduce((sum, entry) => sum + entry.calendarFollowThroughCompleted.length, 0);
  const averageProjectHealth = todoSnapshot && todoSnapshot.projects.length > 0 ? Math.round(todoSnapshot.projects.reduce((sum, project) => sum + project.healthScore, 0) / todoSnapshot.projects.length) : 0;
  const planningScore = clamp(Math.round(
    (totalFocus > 0 ? 1 : 0) * 20 + nextUpCoverage / days * 20 + Math.min(20, followThroughCount * 4) + averageProjectHealth * 0.4
  ), 0, 100);
  return [
    buildCategory("execution", "Execution", executionScore, `Tasks, work time, and focus completion`, [
      `${totalTasks} archived tasks across ${days} day${days === 1 ? "" : "s"}`,
      `${formatMinutesAsHours(totalWorkMinutes)} tracked work`,
      `${completedFocus}/${totalFocus || 0} focus items completed`
    ]),
    buildCategory("health", "Health", healthScore, `Habits, mood, energy, symptoms, and recovery`, [
      `Weighted habit completion averaged ${weightedHabitAverage}%`,
      `Average mood ${averageMood.toFixed(1)}/5 \u2022 energy ${averageEnergy.toFixed(1)}/5 \u2022 anxiety ${averageAnxiety.toFixed(1)}/5`,
      `Symptom burden averaged ${symptomBurden.toFixed(1)} severity points per day`
    ]),
    buildCategory("consistency", "Consistency", consistencyScore, `Routine steadiness and logging coverage`, [
      `Sleep consistency ${sleepInsights.consistencyScore}/100`,
      `${loggedEnergyDays}/${days} days with energy check-ins`,
      `${loggedReflectionDays}/${days} days with reflections`
    ]),
    buildCategory("recovery", "Recovery", recoveryScore, `Sleep, rest, and rebound capacity`, [
      `Average recovery ${sleepInsights.averageRecoveryScore}/100`,
      `${formatMinutesAsHours(totalRelaxMinutes)} relax/break time`,
      `${formatMinutesAsHours(totalNapMinutes)} naps`
    ]),
    buildCategory("planning", "Planning", planningScore, `Focus shaping, follow-through, and project health`, [
      `${totalFocus} focus items set across the window`,
      `${nextUpCoverage}/${days} days had Next Up coverage`,
      `Average project health ${averageProjectHealth}/100`
    ])
  ];
}
function buildCategory(key, label, score, summary, details) {
  return {
    key,
    label,
    score,
    maxScore: 100,
    tone: score >= 75 ? "done" : score >= 55 ? "state" : "alert",
    summary,
    details
  };
}
function averageEntryScore(entries, key) {
  const values = entries.map((entry) => entry[key]).filter((value) => value > 0);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function buildBlockerPatternLines(entries) {
  const counts = /* @__PURE__ */ new Map();
  entries.forEach((entry) => {
    splitPatternItems(entry.frictionLog).forEach((item) => {
      var _a, _b;
      const key = normalizePatternKey(item);
      if (!key) {
        return;
      }
      const current = counts.get(key);
      counts.set(key, {
        label: (_a = current == null ? void 0 : current.label) != null ? _a : item,
        count: ((_b = current == null ? void 0 : current.count) != null ? _b : 0) + 1
      });
    });
  });
  return Array.from(counts.values()).sort((left, right) => right.count - left.count).slice(0, 6).map((item) => `- ${item.label}: showed up on ${item.count} day${item.count === 1 ? "" : "s"}.`);
}
function buildAccomplishmentSectionLines(entries) {
  const workByProject = /* @__PURE__ */ new Map();
  entries.forEach((entry) => {
    entry.completedTasks.forEach((task) => {
      var _a;
      const current = (_a = workByProject.get(task.project)) != null ? _a : { count: 0, tasks: [] };
      current.count += 1;
      if (current.tasks.length < 4) {
        current.tasks.push(task.text);
      }
      workByProject.set(task.project, current);
    });
  });
  return Array.from(workByProject.entries()).sort((left, right) => right[1].count - left[1].count).map(([project, summary]) => `- ${project}: ${summary.count} win${summary.count === 1 ? "" : "s"}${summary.tasks.length > 0 ? ` \u2022 ${summary.tasks.join(" | ")}` : ""}`);
}
function buildMissedHabitPatternLines(entries, habits) {
  const lines = habits.map((habit) => {
    const missedCount = entries.filter((entry) => entry.missedHabits.includes(habit.label)).length;
    const notes = entries.map((entry) => {
      var _a, _b;
      return (_b = (_a = entry.habitMissNotes[habit.id]) == null ? void 0 : _a.trim()) != null ? _b : "";
    }).filter((item) => item.length > 0).slice(-3);
    if (missedCount === 0 && notes.length === 0) {
      return "";
    }
    return `- ${habit.label}: missed on ${missedCount} day${missedCount === 1 ? "" : "s"}${notes.length > 0 ? ` \u2022 recent notes: ${notes.join(" | ")}` : ""}`;
  }).filter((item) => item.length > 0);
  return lines;
}
function buildNarrativeSectionLines(entries, sleepInsights, personalTrends, gamification, todoSnapshot) {
  var _a, _b, _c, _d, _e;
  const totalTasks = entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const blockerPatterns = buildBlockerPatternLines(entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(entries);
  const topProject = (_b = (_a = accomplishmentLines[0]) == null ? void 0 : _a.replace(/^-\s*/, "")) != null ? _b : "No project wins stood out.";
  const staleProjectCount = (_c = todoSnapshot == null ? void 0 : todoSnapshot.staleProjects.length) != null ? _c : 0;
  return [
    `- Execution closed ${totalTasks} archived task${totalTasks === 1 ? "" : "s"} across the period, with ${gamification.week.score}/100 weekly-style execution momentum and ${gamification.month.score}/100 monthly momentum.`,
    `- Recovery averaged ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100` : "no scored recovery yet"}, while sleep consistency landed at ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100` : "no consistency score"}.`,
    `- The strongest visible accomplishment pattern was ${topProject}`,
    `- The loudest drag signals were ${blockerPatterns.length > 0 ? blockerPatterns.slice(0, 2).map((item) => item.replace(/^-\s*/, "")).join(" and ") : "not repeated often enough to form a pattern"}.`,
    `- Trend read: ${(_d = personalTrends.strongestSignals[0]) != null ? _d : "No strong positive signal clearly dominated."} ${(_e = personalTrends.driftSignals[0]) != null ? _e : "No single drift signal dominated the period."}`,
    `- Portfolio pressure: ${staleProjectCount} stale project${staleProjectCount === 1 ? "" : "s"} remain visible at period end.`
  ];
}
function splitPatternItems(value) {
  return value.split(/\r?\n|[.;]/).map((item) => item.replace(/^[-*]\s*/, "").trim()).filter((item) => item.length >= 4);
}
function normalizePatternKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function getSleepMinutesForDay(entry, nextEntry) {
  const napMinutes = getTrackedNapMinutes(entry);
  const derivedSleepMinutes = !entry.sleepTime || !(nextEntry == null ? void 0 : nextEntry.wakeTime) ? napMinutes : napMinutes + getMinutesBetween(entry.sleepTime, nextEntry.wakeTime);
  if (typeof entry.sleepMinutesOverride === "number" && entry.sleepMinutesOverride >= 0) {
    return entry.sleepMinutesOverride === 0 && derivedSleepMinutes > 0 ? derivedSleepMinutes : entry.sleepMinutesOverride;
  }
  if (!entry.sleepTime || !(nextEntry == null ? void 0 : nextEntry.wakeTime)) {
    return napMinutes;
  }
  return napMinutes + getMinutesBetween(entry.sleepTime, nextEntry.wakeTime);
}
function buildSleepInsights(entries, targetMinutes = DEFAULT_SLEEP_TARGET_MINUTES, habits = []) {
  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const recentNights = orderedEntries.map((entry, index) => buildSleepNightSnapshot(entry, orderedEntries[index + 1], targetMinutes, habits)).filter((item) => item !== null).slice(-7);
  if (recentNights.length === 0) {
    return {
      targetMinutes,
      nightsTracked: 0,
      averageSleepMinutes: 0,
      debtMinutes: 0,
      consistencyScore: 0,
      consistencyLabel: "No data",
      averageRecoveryScore: 0,
      recoveryLabel: "No data",
      averageBedtime: "",
      averageWakeTime: "",
      recentNights: []
    };
  }
  const averageSleepMinutes = Math.round(recentNights.reduce((sum, item) => sum + item.sleepMinutes, 0) / recentNights.length);
  const averageRecoveryScore = Math.round(recentNights.reduce((sum, item) => sum + item.recoveryScore, 0) / recentNights.length);
  const debtMinutes = Math.max(0, recentNights.reduce((sum, item) => sum + Math.max(0, targetMinutes - item.sleepMinutes), 0));
  const bedtimeValues = recentNights.map((item) => normalizeBedtimeMinutes(item.bedtime)).filter((value) => value !== null);
  const wakeValues = recentNights.map((item) => parseClockMinutes(item.wakeTime)).filter((value) => value !== null);
  const bedtimeDeviation = getAverageDeviation(bedtimeValues);
  const wakeDeviation = getAverageDeviation(wakeValues);
  const consistencyScore = Math.max(0, 100 - Math.round((bedtimeDeviation + wakeDeviation) / 3));
  return {
    targetMinutes,
    nightsTracked: recentNights.length,
    averageSleepMinutes,
    debtMinutes,
    consistencyScore,
    consistencyLabel: consistencyScore >= 85 ? "Very steady" : consistencyScore >= 70 ? "Stable" : consistencyScore >= 50 ? "Drifting" : "Irregular",
    averageRecoveryScore,
    recoveryLabel: averageRecoveryScore >= 80 ? "Recovered" : averageRecoveryScore >= 65 ? "Holding" : averageRecoveryScore >= 45 ? "Strained" : "Depleted",
    averageBedtime: formatAverageClock(bedtimeValues, true),
    averageWakeTime: formatAverageClock(wakeValues, false),
    recentNights
  };
}
function buildSleepNightSnapshot(entry, nextEntry, targetMinutes, habits) {
  var _a;
  const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
  if (sleepMinutes <= 0) {
    return null;
  }
  const recoveryScore = computeRecoveryScore(entry, sleepMinutes, targetMinutes, habits);
  return {
    date: entry.date,
    sleepMinutes,
    bedtime: entry.sleepTime ? entry.sleepTime.slice(11, 16) : "",
    wakeTime: (nextEntry == null ? void 0 : nextEntry.wakeTime) ? nextEntry.wakeTime.slice(11, 16) : "",
    wakeQualityScore: (_a = nextEntry == null ? void 0 : nextEntry.wakeQualityScore) != null ? _a : 0,
    recoveryScore,
    recoveryLabel: recoveryScore >= 80 ? "Recovered" : recoveryScore >= 65 ? "Holding" : recoveryScore >= 45 ? "Strained" : "Depleted"
  };
}
function computeRecoveryScore(entry, sleepMinutes, targetMinutes, habits) {
  const sleepComponent = Math.min(50, Math.round(sleepMinutes / targetMinutes * 50));
  const napMinutes = getTrackedNapMinutes(entry);
  const relaxMinutes = getTrackedRelaxMinutes(entry);
  const wakeQualityComponent = Math.round(entry.wakeQualityScore / 5 * 15);
  const anxietyComponent = Math.round((5 - entry.anxietyScore) / 5 * 15);
  const relaxComponent = Math.min(10, Math.round(relaxMinutes / 60 * 10));
  const napComponent = napMinutes === 0 ? 5 : napMinutes <= 90 ? 10 : napMinutes <= 150 ? 7 : 4;
  const missedWeight = habits.reduce((sum, habit) => {
    var _a;
    const remaining = Math.max(0, habit.target - ((_a = entry.habits[habit.id]) != null ? _a : 0));
    return sum + remaining * habit.difficultyWeight;
  }, 0);
  const missPenalty = Math.min(20, missedWeight * 2);
  return clamp(sleepComponent + wakeQualityComponent + anxietyComponent + relaxComponent + napComponent - missPenalty, 0, 100);
}
function parseClockMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value.trim())) {
    return null;
  }
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}
function normalizeBedtimeMinutes(value) {
  const minutes = parseClockMinutes(value);
  if (minutes === null) {
    return null;
  }
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}
function getAverageDeviation(values) {
  if (values.length <= 1) {
    return 0;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + Math.abs(value - average), 0) / values.length;
}
function formatAverageClock(values, bedtime) {
  if (values.length === 0) {
    return "";
  }
  let average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (bedtime && average >= 24 * 60) {
    average -= 24 * 60;
  }
  const hours = Math.floor(average / 60) % 24;
  const minutes = average % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}
function getTrackedTodayFocusMinutes(item) {
  return getTrackedMinutes(item.workSessions);
}
function renderTodayFocusLine(item) {
  var _a, _b;
  const workedMinutes = getTrackedTodayFocusMinutes(item);
  const sessionTag = (_b = (_a = [...item.workSessions].reverse().find((session) => session.tag.trim().length > 0)) == null ? void 0 : _a.tag) != null ? _b : "";
  const statusLabel = item.status === "working" ? "Working on" : item.status === "done" ? "Done" : "Queued";
  const detailParts = [
    sessionTag ? `tag: ${sessionTag}` : "",
    item.estimateMinutes && item.estimateMinutes > 0 ? `estimate: ${formatMinutesAsHours(item.estimateMinutes)}` : "",
    workedMinutes > 0 ? `tracked: ${formatMinutesAsHours(workedMinutes)}` : "",
    item.notes ? `notes: ${item.notes}` : ""
  ].filter((value) => value.length > 0);
  return `- [${statusLabel}] ${item.text}${detailParts.length > 0 ? ` (${detailParts.join(" | ")})` : ""}`;
}
function parseTodayFocusLine(line) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i;
  const normalized = line.trim();
  if (!normalized || normalized.toLowerCase() === "no focus items set") {
    return null;
  }
  const match = normalized.match(/^\[(?<status>[^\]]+)\]\s+(?<text>.+?)(?:\s+\((?<details>.+)\))?$/i);
  const rawStatus = (_c = (_b = (_a = match == null ? void 0 : match.groups) == null ? void 0 : _a.status) == null ? void 0 : _b.trim().toLowerCase()) != null ? _c : "";
  const text = ((_e = (_d = match == null ? void 0 : match.groups) == null ? void 0 : _d.text) != null ? _e : normalized).trim();
  const details = (_h = (_g = (_f = match == null ? void 0 : match.groups) == null ? void 0 : _f.details) == null ? void 0 : _g.trim()) != null ? _h : "";
  if (!text) {
    return null;
  }
  const status = rawStatus === "working on" ? "working" : rawStatus === "done" ? "done" : "pending";
  return {
    text,
    notes: (_i = extractFocusDetail(details, "notes")) != null ? _i : "",
    estimateMinutes: parseDurationLabel(extractFocusDetail(details, "estimate")),
    status,
    workSessions: (() => {
      var _a2;
      const tag = (_a2 = extractFocusDetail(details, "tag")) != null ? _a2 : "";
      return tag ? [{ start: "", end: null, tag }] : [];
    })(),
    completedAt: null
  };
}
function renderSessionLine(session) {
  var _a;
  const tagSuffix = session.tag.trim().length > 0 ? ` [${session.tag.trim()}]` : "";
  return `- ${session.start} -> ${(_a = session.end) != null ? _a : "Still active"}${tagSuffix}`;
}
function renderNextUpFocusLine(item) {
  const details = [
    item.estimateMinutes && item.estimateMinutes > 0 ? `estimate: ${formatMinutesAsHours(item.estimateMinutes)}` : "",
    item.notes ? `notes: ${item.notes}` : ""
  ].filter((value) => value.length > 0);
  return `- ${item.text}${details.length > 0 ? ` (${details.join(" | ")})` : ""}`;
}
function parseNextUpFocusItem(line) {
  var _a, _b, _c, _d, _e, _f, _g;
  const normalized = line.trim();
  if (!normalized || normalized.toLowerCase() === "no queued items") {
    return null;
  }
  const match = normalized.match(/^(?<text>.+?)(?:\s+\((?<details>.+)\))?$/i);
  const text = (_c = (_b = (_a = match == null ? void 0 : match.groups) == null ? void 0 : _a.text) == null ? void 0 : _b.trim()) != null ? _c : normalized;
  const details = (_f = (_e = (_d = match == null ? void 0 : match.groups) == null ? void 0 : _d.details) == null ? void 0 : _e.trim()) != null ? _f : "";
  if (!text) {
    return null;
  }
  return {
    text,
    notes: (_g = extractFocusDetail(details, "notes")) != null ? _g : "",
    estimateMinutes: parseDurationLabel(extractFocusDetail(details, "estimate"))
  };
}
function extractFocusDetail(details, label) {
  if (!details) {
    return null;
  }
  const segment = details.split("|").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!segment) {
    return null;
  }
  return segment.slice(label.length + 1).trim();
}
function parseDurationLabel(value) {
  var _a, _b;
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  const hourMatch = normalized.match(/^(?<hours>\d+(?:\.\d+)?)h$/);
  if ((_a = hourMatch == null ? void 0 : hourMatch.groups) == null ? void 0 : _a.hours) {
    return Math.round(Number(hourMatch.groups.hours) * 60);
  }
  const minuteMatch = normalized.match(/^(?<minutes>\d+)m$/);
  if ((_b = minuteMatch == null ? void 0 : minuteMatch.groups) == null ? void 0 : _b.minutes) {
    return Number(minuteMatch.groups.minutes);
  }
  const plainNumber = Number(normalized);
  return Number.isFinite(plainNumber) ? Math.round(plainNumber) : null;
}
function renderCalendarEventLine(event) {
  const repeatLabel = event.repeatCadence !== "none" ? ` (${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""})` : "";
  const contextParts = [`${event.category}`];
  const leadSummary = renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
  if (leadSummary) {
    contextParts.push(leadSummary);
  }
  const projectLabel = renderCalendarProjectLabel(event.projectName, event.projectNotePath);
  if (projectLabel) {
    contextParts.push(`project ${projectLabel}`);
  }
  const noteLinks = extractWikiLinks(event.notes);
  if (noteLinks.length > 0) {
    contextParts.push(`links ${noteLinks.join(", ")}`);
  }
  if (event.notes.trim().length > 0) {
    contextParts.push(event.notes.trim());
  }
  return `- ${renderCalendarEventWindowLabel(event)}: ${event.title}${repeatLabel}${contextParts.length > 0 ? ` - ${contextParts.join(" \u2022 ")}` : ""}`;
}
function renderCalendarEventContextLabel(event) {
  const windowLabel = renderCalendarEventWindowLabel(event);
  const projectLabel = renderCalendarProjectLabel(event.projectName, event.projectNotePath);
  return `(${[windowLabel, projectLabel].filter((value) => value.length > 0).join(" \u2022 ")})`;
}
function renderCalendarEventWindowLabel(event) {
  const sameDay = event.date === event.endDate;
  if (!event.startTime) {
    return sameDay ? "All day" : `All day ${event.date} -> ${event.endDate}`;
  }
  if (sameDay) {
    return `${event.startTime}${event.endTime ? ` -> ${event.endTime}` : ""}`;
  }
  return `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`;
}
function renderCalendarLeadSummary(prepMinutes, travelMinutes) {
  const parts = [];
  if (prepMinutes > 0) {
    parts.push(`prep ${prepMinutes}m`);
  }
  if (travelMinutes > 0) {
    parts.push(`travel ${travelMinutes}m`);
  }
  return parts.join(" + ");
}
function extractWikiLinks(value) {
  const matches = value.match(/\[\[[^\]]+\]\]/g);
  return matches ? Array.from(new Set(matches)) : [];
}
function renderCalendarProjectLabel(projectName, projectNotePath) {
  const safeName = projectName.trim();
  if (!safeName) {
    return "";
  }
  const safePath = projectNotePath.trim().replace(/\.md$/i, "");
  return safePath ? `[[${safePath}|${safeName}]]` : safeName;
}

// src/dashboard-todo.ts
var import_obsidian2 = require("obsidian");
function parseTodoSnapshot(content) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const now = /* @__PURE__ */ new Date();
  const thisWeekStart = getIsoWeekRange(now).start;
  const previousWeekStart = new Date(thisWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(thisWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const monthKey = formatDateKey(now).slice(0, 7);
  const projects = findProjectRanges(lines).map((project) => {
    var _a, _b;
    let openCount = 0;
    let archivedCount = 0;
    let currentSection = "General";
    let focus = "";
    let status = "";
    let categoryName = "Projects";
    let lastCompletedAt = null;
    let completionsThisWeek = 0;
    let completionsPreviousWeek = 0;
    let completionsThisMonth = 0;
    const noteLinks = /* @__PURE__ */ new Set();
    const nowTasks = [];
    const nextTasks = [];
    const laterTasks = [];
    const dueRepeatingTasks = [];
    const nowTaskDetails = [];
    const nextTaskDetails = [];
    const laterTaskDetails = [];
    const dueRepeatingTaskDetails = [];
    const dueSoonTasks2 = [];
    const overdueTasks2 = [];
    const blockedTasks2 = [];
    const breakdownTasks = [];
    const emptySections = /* @__PURE__ */ new Set();
    const relationships = /* @__PURE__ */ new Set();
    const seenTasks = /* @__PURE__ */ new Map();
    const duplicateTasks = /* @__PURE__ */ new Set();
    const category = categories.find((candidate) => project.start >= candidate.start && project.start <= candidate.end);
    if (category) {
      categoryName = category.name;
    }
    for (let index = project.start; index <= project.end; index += 1) {
      const line = lines[index];
      const meta = parseProjectMeta(line);
      if (meta) {
        if (meta.key === "focus") {
          focus = meta.value;
        }
        if (meta.key === "status") {
          status = meta.value;
        }
        if (meta.key === "relationships") {
          meta.value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean).forEach((item) => relationships.add(item));
        }
        extractNoteLinks(meta.value).forEach((link) => noteLinks.add(link));
      }
      const sectionName = getSectionName(line);
      if (sectionName) {
        currentSection = sectionName;
        emptySections.add(sectionName);
      }
      const taskMatch = line.match(CHECKLIST_REGEX);
      if (!taskMatch) {
        continue;
      }
      const taskText = taskMatch[2].trim();
      const taskSummary = parseTodoTaskSummary(taskText, currentSection, now);
      const normalizedTask = taskSummary.text.toLowerCase();
      const sectionKey = currentSection.toLowerCase();
      const isComplete = taskMatch[1].toLowerCase() === "x";
      emptySections.delete(currentSection);
      seenTasks.set(normalizedTask, ((_a = seenTasks.get(normalizedTask)) != null ? _a : 0) + 1);
      if (((_b = seenTasks.get(normalizedTask)) != null ? _b : 0) > 1) {
        duplicateTasks.add(taskText);
      }
      if (sectionKey === "completed archive" || isComplete) {
        archivedCount += 1;
        const completedAt = extractArchivedDate(taskText);
        if (completedAt) {
          if (!lastCompletedAt || completedAt > lastCompletedAt) {
            lastCompletedAt = completedAt;
          }
          if (completedAt >= formatDateKey(thisWeekStart)) {
            completionsThisWeek += 1;
          } else if (completedAt >= formatDateKey(previousWeekStart) && completedAt <= formatDateKey(previousWeekEnd)) {
            completionsPreviousWeek += 1;
          }
          if (completedAt.slice(0, 7) === monthKey) {
            completionsThisMonth += 1;
          }
        }
        continue;
      }
      openCount += 1;
      if (sectionKey === "now") {
        nowTasks.push(taskSummary.text);
        nowTaskDetails.push(taskSummary);
      }
      if (sectionKey === "next") {
        nextTasks.push(taskSummary.text);
        nextTaskDetails.push(taskSummary);
      }
      if (sectionKey === "later") {
        laterTasks.push(taskSummary.text);
        laterTaskDetails.push(taskSummary);
      }
      if (sectionKey === "repeating") {
        dueRepeatingTasks.push(taskSummary.text);
        dueRepeatingTaskDetails.push(taskSummary);
      }
      if (taskSummary.isBlocked) {
        blockedTasks2.push(taskSummary);
      }
      if (taskSummary.isOverdue) {
        overdueTasks2.push(taskSummary);
      } else if (taskSummary.isDueSoon) {
        dueSoonTasks2.push(taskSummary);
      }
      if (looksLikeBreakdownTask(taskSummary.text)) {
        breakdownTasks.push(taskSummary.text);
      }
    }
    const staleDays = lastCompletedAt ? daysBetween(lastCompletedAt, formatDateKey(now)) : null;
    const trend = completionsThisWeek > completionsPreviousWeek ? "up" : completionsThisWeek < completionsPreviousWeek ? "down" : "flat";
    const projectState = inferProjectState(status);
    const nextAction = selectProjectNextAction({
      projectName: project.name,
      projectState,
      overdueTasks: overdueTasks2,
      dueSoonTasks: dueSoonTasks2,
      nowTaskDetails,
      nextTaskDetails,
      dueRepeatingTaskDetails,
      laterTaskDetails
    });
    const healthReasons = buildProjectHealthReasons({
      projectName: project.name,
      projectState,
      staleDays,
      overdueTasks: overdueTasks2,
      dueSoonTasks: dueSoonTasks2,
      blockedTasks: blockedTasks2,
      duplicateTasks,
      breakdownTasks,
      emptySections,
      nowTaskDetails,
      nextTaskDetails,
      nextAction
    });
    const healthScore = computeHealthScore({
      projectState,
      openCount,
      staleDays,
      completionsThisWeek,
      nowCount: nowTasks.length,
      nextCount: nextTasks.length,
      dueSoonCount: dueSoonTasks2.length,
      overdueCount: overdueTasks2.length,
      blockedCount: blockedTasks2.length,
      breakdownCount: breakdownTasks.length,
      duplicateCount: duplicateTasks.size
    });
    return {
      name: project.name,
      categoryName,
      status: status || (projectState === "someday" ? "Someday" : projectState === "incubating" ? "Incubating" : "Active"),
      projectState,
      openCount,
      archivedCount,
      completionRate: openCount + archivedCount > 0 ? Math.round(archivedCount / (openCount + archivedCount) * 100) : 0,
      focus,
      noteLinks: Array.from(noteLinks),
      nowTasks,
      nextTasks,
      laterTasks,
      dueRepeatingTasks,
      breakdownTasks,
      duplicateTasks: Array.from(duplicateTasks),
      emptySections: Array.from(emptySections),
      lastCompletedAt,
      staleDays,
      completionsThisWeek,
      completionsPreviousWeek,
      completionsThisMonth,
      trend,
      nextAction,
      healthScore,
      healthLabel: describeHealthScore(healthScore),
      healthReasons,
      relationships: Array.from(relationships),
      nowTaskDetails,
      nextTaskDetails,
      laterTaskDetails,
      dueRepeatingTaskDetails,
      dueSoonTasks: dueSoonTasks2,
      overdueTasks: overdueTasks2,
      blockedTasks: blockedTasks2
    };
  });
  const breakdownCandidates = projects.flatMap((project) => project.breakdownTasks.map((task) => ({ project: project.name, task })));
  const staleProjects = projects.filter((project) => project.projectState === "active" && project.staleDays !== null && project.staleDays >= 7).sort((left, right) => {
    var _a, _b;
    return ((_a = right.staleDays) != null ? _a : 0) - ((_b = left.staleDays) != null ? _b : 0);
  });
  const cleanupSuggestions = projects.flatMap((project) => buildCleanupSuggestions(project));
  const dueSoonTasks = projects.flatMap((project) => project.dueSoonTasks.map((task) => ({ project: project.name, task })));
  const overdueTasks = projects.flatMap((project) => project.overdueTasks.map((task) => ({ project: project.name, task })));
  const blockedTasks = projects.flatMap((project) => project.blockedTasks.map((task) => ({ project: project.name, task })));
  return {
    totalOpen: projects.reduce((sum, project) => sum + project.openCount, 0),
    totalArchived: projects.reduce((sum, project) => sum + project.archivedCount, 0),
    projects,
    staleProjects,
    breakdownCandidates,
    cleanupSuggestions,
    dueSoonTasks,
    overdueTasks,
    blockedTasks
  };
}
function reconcileCompletedTasks(content, archivedAt) {
  const restoredResult = restoreUncheckedArchivedTasks(content);
  const archiveResult = archiveCompletedTasks(restoredResult.content, archivedAt);
  return {
    content: archiveResult.content,
    archivedTasks: archiveResult.archivedTasks,
    restoredTasks: restoredResult.restoredTasks
  };
}
function archiveCompletedTasks(content, archivedAt) {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, archivedTasks: [] };
  }
  const output = [];
  const archivedTasks = [];
  let cursor = 0;
  projectRanges.forEach((project) => {
    output.push(...lines.slice(cursor, project.start));
    const result = archiveCompletedTasksFromProjectLines(
      lines.slice(project.start, project.end + 1),
      project.name,
      archivedAt
    );
    output.push(...result.lines);
    archivedTasks.push(...result.archivedTasks);
    cursor = project.end + 1;
  });
  output.push(...lines.slice(cursor));
  return {
    content: output.join("\n"),
    archivedTasks
  };
}
function restoreUncheckedArchivedTasks(content) {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, restoredTasks: [] };
  }
  const output = [];
  const restoredTasks = [];
  let cursor = 0;
  projectRanges.forEach((project) => {
    output.push(...lines.slice(cursor, project.start));
    const result = restoreUncheckedArchivedTasksFromProjectLines(
      lines.slice(project.start, project.end + 1),
      project.name
    );
    output.push(...result.lines);
    restoredTasks.push(...result.restoredTasks);
    cursor = project.end + 1;
  });
  output.push(...lines.slice(cursor));
  return {
    content: output.join("\n"),
    restoredTasks
  };
}
function restoreUncheckedArchivedTasksFromProjectLines(projectLines, projectName) {
  const keptLines = [];
  const restoredTasks = [];
  let currentSection = "General";
  projectLines.forEach((line) => {
    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName;
      keptLines.push(line);
      return;
    }
    const taskMatch = line.match(CHECKLIST_REGEX);
    if (taskMatch && currentSection.trim().toLowerCase() === "completed archive" && taskMatch[1] === " ") {
      const archivedTask = parseArchivedArchiveTask(taskMatch[2].trim(), projectName);
      if (archivedTask) {
        restoredTasks.push(archivedTask);
        return;
      }
    }
    keptLines.push(line);
  });
  if (restoredTasks.length === 0) {
    return { lines: projectLines, restoredTasks: [] };
  }
  let nextContent = keptLines.join("\n");
  restoredTasks.forEach((task) => {
    nextContent = insertTaskIntoProjectSection(nextContent, projectName, task.section, task.text);
  });
  return {
    lines: nextContent.split(/\r?\n/),
    restoredTasks
  };
}
function parseArchivedArchiveTask(value, projectName) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?)\s+-\s+\[([^\]]+)\]\s+(.*)$/);
  if (!match) {
    return null;
  }
  const [, archivedAt, section, text] = match;
  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }
  return {
    project: projectName,
    section: section.trim() || "General",
    text: trimmedText,
    archivedAt
  };
}
function archiveCompletedTasksFromProjectLines(projectLines, projectName, archivedAt) {
  const keptLines = [];
  const archivedTasks = [];
  let currentSection = "General";
  const usesHeadingSections = projectLines.some((line) => /^###\s+/.test(line.trim()));
  projectLines.forEach((line) => {
    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName;
      keptLines.push(line);
      return;
    }
    const taskMatch = line.match(CHECKLIST_REGEX);
    if (taskMatch && !isNonArchivableSection(currentSection) && taskMatch[1].toLowerCase() === "x") {
      archivedTasks.push({
        project: projectName,
        section: currentSection,
        text: taskMatch[2].trim(),
        archivedAt
      });
      return;
    }
    keptLines.push(line);
  });
  if (archivedTasks.length === 0) {
    return { lines: projectLines, archivedTasks: [] };
  }
  const archiveHeaderIndex = keptLines.findIndex((line) => isCompletedArchiveHeader(line));
  const archiveLines = archivedTasks.map((task) => `- [x] ${task.archivedAt} - [${task.section}] ${task.text}`);
  if (archiveHeaderIndex >= 0) {
    let insertIndex = archiveHeaderIndex + 1;
    while (insertIndex < keptLines.length && keptLines[insertIndex].trim() === "") {
      insertIndex += 1;
    }
    keptLines.splice(insertIndex, 0, ...archiveLines);
  } else {
    while (keptLines.length > 0 && keptLines[keptLines.length - 1].trim() === "") {
      keptLines.pop();
    }
    keptLines.push("", usesHeadingSections ? "### Completed Archive" : "Completed Archive:", ...archiveLines, "");
  }
  return { lines: keptLines, archivedTasks };
}
function findProjectRanges(lines) {
  const ranges = [];
  for (let index = 0; index < lines.length; index += 1) {
    const projectName = getProjectHeaderName(lines, index);
    if (!projectName) {
      continue;
    }
    const start = index;
    let end = lines.length - 1;
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      if (getProjectHeaderName(lines, lookahead)) {
        end = lookahead - 1;
        break;
      }
    }
    ranges.push({ name: projectName, start, end });
  }
  return ranges;
}
function getProjectHeaderName(lines, index) {
  var _a, _b, _c, _d;
  const line = (_b = (_a = lines[index]) == null ? void 0 : _a.trim()) != null ? _b : "";
  const nextLine = (_d = (_c = lines[index + 1]) == null ? void 0 : _c.trim()) != null ? _d : "";
  if (!line) {
    return null;
  }
  if (/^##\s+/.test(line) && !/^###\s+/.test(line)) {
    return line.replace(/^##\s+/, "").trim();
  }
  if (line.startsWith("#")) {
    return null;
  }
  if (PROJECT_SEPARATOR_REGEX.test(nextLine)) {
    return line.replace(/^Project:\s*/i, "").trim();
  }
  return null;
}
function getSectionName(line) {
  const trimmed = line.trim();
  if (/^###\s+/.test(trimmed)) {
    return trimmed.replace(/^###\s+/, "").trim();
  }
  const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
  return sectionMatch ? sectionMatch[1] : null;
}
function isCompletedArchiveHeader(line) {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "completed archive:" || trimmed === "### completed archive";
}
function isNonArchivableSection(sectionName) {
  const normalized = sectionName.trim().toLowerCase();
  return normalized === "completed archive" || normalized === "reference" || normalized === "resources";
}
function parseProjectMeta(line) {
  const match = line.trim().match(PROJECT_META_REGEX);
  if (!match) {
    return null;
  }
  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim()
  };
}
function extractNoteLinks(value) {
  const links = [];
  let match = NOTE_LINK_REGEX.exec(value);
  while (match) {
    links.push(match[1]);
    match = NOTE_LINK_REGEX.exec(value);
  }
  NOTE_LINK_REGEX.lastIndex = 0;
  return links;
}
function getIsoWeekRange(referenceDate) {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  const start = new Date(date);
  start.setDate(date.getDate() - 3);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start,
    end,
    label: `${date.getFullYear()}-W${`${weekNumber}`.padStart(2, "0")}`
  };
}
function findTodoCategoryRanges(lines) {
  const ranges = [];
  for (let index = 0; index < lines.length; index += 1) {
    const categoryName = getTodoCategoryName(lines[index]);
    if (!categoryName) {
      continue;
    }
    const start = index;
    let end = lines.length - 1;
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
      if (getTodoCategoryName(lines[lookahead])) {
        end = lookahead - 1;
        break;
      }
    }
    ranges.push({ name: categoryName, start, end });
  }
  return ranges;
}
function getTodoCategoryName(line) {
  var _a;
  const trimmed = (_a = line == null ? void 0 : line.trim()) != null ? _a : "";
  if (!/^#\s+/.test(trimmed) || /^##\s+/.test(trimmed)) {
    return null;
  }
  const name = trimmed.replace(/^#\s+/, "").trim();
  return name.toLowerCase() === "master task hub" ? null : name;
}
function insertProjectIntoTodo(content, categoryName, projectBlock) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const targetCategory = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  const blockLines = projectBlock.split("\n");
  if (!targetCategory) {
    const result2 = trimTrailingBlankLines(lines);
    if (result2.length > 0) {
      result2.push("");
    }
    result2.push(`# ${categoryName}`, "", ...blockLines, "");
    return result2.join("\n");
  }
  const before = trimTrailingBlankLines(lines.slice(0, targetCategory.end + 1));
  const after = trimLeadingBlankLines(lines.slice(targetCategory.end + 1));
  const result = [...before];
  if (result.length > 0) {
    result.push("");
  }
  result.push("---", "", ...blockLines, "");
  if (after.length > 0) {
    result.push(...after);
  }
  return result.join("\n");
}
function trimTrailingBlankLines(lines) {
  const output = [...lines];
  while (output.length > 0 && output[output.length - 1].trim() === "") {
    output.pop();
  }
  return output;
}
function trimLeadingBlankLines(lines) {
  const output = [...lines];
  while (output.length > 0 && output[0].trim() === "") {
    output.shift();
  }
  return output;
}
function renderTodoProjectBlock(input) {
  const addTasks = input.addTasks.length > 0 ? input.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixTasks = input.fixTasks.length > 0 ? input.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  return [
    `## ${input.projectName}`,
    `Project Note:: ${input.projectNoteLink}`,
    `Status:: ${input.status}`,
    `Focus:: ${input.focus || "Define the current focus for this project."}`,
    "",
    "### Add",
    ...addTasks,
    "",
    "### Fix",
    ...fixTasks,
    "",
    "### Now",
    "- [ ]",
    "",
    "### Next",
    "- [ ]",
    "",
    "### Later",
    "- [ ]",
    "",
    "### Repeating",
    "- [ ]",
    "",
    "Relationships::",
    "",
    "### Completed Archive",
    "",
    "### Reference"
  ].join("\n");
}
function renderProjectNoteTemplate(input, masterTodoPath) {
  return [
    `# ${input.projectName}`,
    "",
    "## Snapshot",
    `- Status: ${input.status || "Planning"}`,
    `- Category: ${input.categoryName}`,
    `- Focus: ${input.focus || "Define the current focus for this project."}`,
    `- Master Task Hub: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]]`,
    "",
    "## Current Focus",
    input.focus || "Add the current objective here.",
    "",
    "## Repeating Tasks",
    "- [ ] Weekly review [weekly]",
    "",
    "## Priority Lanes",
    "### Now",
    "- [ ]",
    "",
    "### Next",
    "- [ ]",
    "",
    "### Later",
    "- [ ]",
    "",
    "## Relationships",
    "- Related projects, dependencies, and blockers.",
    "",
    "## Active Notes",
    "- Add project-specific notes here.",
    "",
    "## Decisions",
    "- Capture important decisions and tradeoffs here.",
    "",
    "## References",
    "- Add links, assets, commands, or supporting notes here.",
    ""
  ].join("\n");
}
function renderExistingProjectNoteTemplate(project, masterTodoPath) {
  const addLines = project.addTasks.length > 0 ? project.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixLines = project.fixTasks.length > 0 ? project.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  return [
    `# ${project.projectName}`,
    "",
    "## Snapshot",
    `- Status: ${project.status || "Planning"}`,
    `- Category: ${project.categoryName}`,
    `- Focus: ${project.focus || "Define the current focus for this project."}`,
    `- Master Task Hub: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]]`,
    `- Project Entry: [[${project.noteLinkPath}|${project.projectName}]]`,
    "",
    "## Add Queue",
    ...addLines,
    "",
    "## Fix Queue",
    ...fixLines,
    "",
    "## Repeating Tasks",
    "- [ ] Weekly review [weekly]",
    "",
    "## Priority Lanes",
    "### Now",
    "- [ ]",
    "",
    "### Next",
    "- [ ]",
    "",
    "### Later",
    "- [ ]",
    "",
    "## Notes",
    "- Add working notes, ideas, and decisions here.",
    "",
    "## References",
    "- Move or summarize project-specific references here over time.",
    ""
  ].join("\n");
}
function createWikiLink(filePath, label) {
  return `[[${stripMarkdownExtension((0, import_obsidian2.normalizePath)(filePath))}|${label}]]`;
}
function stripMarkdownExtension(path) {
  return path.replace(/\.md$/i, "");
}
function sanitizeFileName(value) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "-").trim();
  return cleaned || "New Project";
}
function splitMultilineInput(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}
function extractProjectDefinitionsFromTodo(content) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const definitions = [];
  categories.forEach((category) => {
    const categoryLines = lines.slice(category.start, category.end + 1);
    const projectRanges = findProjectRanges(categoryLines);
    projectRanges.forEach((projectRange) => {
      const absoluteStart = category.start + projectRange.start;
      const absoluteEnd = category.start + projectRange.end;
      const projectLines = lines.slice(absoluteStart, absoluteEnd + 1);
      const definition = extractProjectDefinition(projectLines, category.name);
      if (definition) {
        definitions.push(definition);
      }
    });
  });
  return definitions;
}
function extractProjectDefinition(projectLines, categoryName) {
  var _a, _b, _c;
  const firstLine = (_b = (_a = projectLines[0]) == null ? void 0 : _a.trim()) != null ? _b : "";
  if (!firstLine.startsWith("## ")) {
    return null;
  }
  const projectName = firstLine.replace(/^##\s+/, "").trim();
  let status = "Planning";
  let focus = "";
  let noteLinkPath = `Project Notes/${projectName}`;
  let currentSection = "";
  const addTasks = [];
  const fixTasks = [];
  for (let index = 1; index < projectLines.length; index += 1) {
    const line = projectLines[index];
    const meta = parseProjectMeta(line);
    if (meta) {
      if (meta.key === "status") {
        status = meta.value;
      }
      if (meta.key === "focus") {
        focus = meta.value;
      }
      if (meta.key === "project note") {
        noteLinkPath = (_c = extractFirstNoteLinkPath(meta.value)) != null ? _c : noteLinkPath;
      }
    }
    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName.toLowerCase();
      continue;
    }
    const taskMatch = line.match(CHECKLIST_REGEX);
    if (!taskMatch) {
      continue;
    }
    if (currentSection === "add") {
      addTasks.push(taskMatch[2].trim());
    }
    if (currentSection === "fix") {
      fixTasks.push(taskMatch[2].trim());
    }
  }
  return {
    projectName,
    categoryName,
    status,
    focus,
    addTasks,
    fixTasks,
    noteLinkPath
  };
}
function extractFirstNoteLinkPath(value) {
  const match = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(value);
  return match ? match[1] : null;
}
function insertTaskIntoProjectSection(content, projectName, sectionName, taskText) {
  var _a;
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  const project = projectRanges.find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return content;
  }
  const output = [...lines];
  const normalizedSection = sectionName.trim();
  const taskLine = `- [ ] ${taskText.trim()}`;
  let sectionStart = -1;
  let sectionEnd = project.end;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const currentSection = getSectionName(output[index]);
    if (!currentSection) {
      continue;
    }
    if (currentSection.toLowerCase() === normalizedSection.toLowerCase()) {
      sectionStart = index;
      sectionEnd = project.end;
      for (let lookahead = index + 1; lookahead <= project.end; lookahead += 1) {
        if (getSectionName(output[lookahead])) {
          sectionEnd = lookahead - 1;
          break;
        }
      }
      break;
    }
  }
  if (sectionStart >= 0) {
    const existingTasks = output.slice(sectionStart + 1, sectionEnd + 1).map((line) => {
      var _a2;
      return (_a2 = line.match(CHECKLIST_REGEX)) == null ? void 0 : _a2[2].trim().toLowerCase();
    }).filter((line) => Boolean(line));
    if (existingTasks.includes(taskText.trim().toLowerCase())) {
      return content;
    }
    let insertIndex2 = sectionEnd + 1;
    while (insertIndex2 > sectionStart + 1 && output[insertIndex2 - 1].trim() === "") {
      insertIndex2 -= 1;
    }
    output.splice(insertIndex2, 0, taskLine);
    return output.join("\n");
  }
  let insertIndex = project.end + 1;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const currentSection = (_a = getSectionName(output[index])) == null ? void 0 : _a.toLowerCase();
    if (currentSection === "completed archive" || currentSection === "reference") {
      insertIndex = index;
      break;
    }
  }
  output.splice(insertIndex, 0, "", `### ${normalizedSection}`, taskLine);
  return output.join("\n");
}
function extractRepeatingTasks(noteContent) {
  const lines = noteContent.split(/\r?\n/);
  const tasks = [];
  let inRepeatingSection = false;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^##+\s+/.test(trimmed)) {
      inRepeatingSection = /repeating/i.test(trimmed);
      return;
    }
    if (!inRepeatingSection) {
      return;
    }
    const taskMatch = trimmed.match(/^[-*]\s+(?:\[(?: |x|X)\]\s+)?(.*)$/);
    if (!taskMatch) {
      return;
    }
    const rawText = taskMatch[1].trim();
    const parsed = parseRepeatingTaskLine(rawText);
    if (!parsed) {
      return;
    }
    const { text, ruleText, rule } = parsed;
    if (text) {
      tasks.push({
        text,
        cadence: rule.kind,
        ruleText,
        rule
      });
    }
  });
  return tasks;
}
function isRepeatingTaskDue(task, content, projectName) {
  return isRepeatingTaskDueOnDate(task, content, projectName, formatDateKey(/* @__PURE__ */ new Date()));
}
function isRepeatingTaskDueOnDate(task, content, projectName, todayKey) {
  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return false;
  }
  const projectText = lines.slice(project.start, project.end + 1).join("\n").toLowerCase();
  if (projectText.includes(`- [ ] ${task.text}`.toLowerCase())) {
    return false;
  }
  const archivedDates = [];
  lines.slice(project.start, project.end + 1).forEach((line) => {
    if (!line.toLowerCase().includes(task.text.toLowerCase())) {
      return;
    }
    const archivedDate = extractArchivedDate(line);
    if (archivedDate) {
      archivedDates.push(archivedDate);
    }
  });
  if (archivedDates.length === 0) {
    return isRepeatingRuleEligibleWithoutHistory(task.rule, todayKey);
  }
  const latest = archivedDates.sort().reverse()[0];
  return isRepeatingRuleDueSince(task.rule, latest, todayKey);
}
function parseRepeatingTaskLine(rawText) {
  var _a, _b, _c, _d;
  const explicitRepeatMatch = rawText.match(/\[(?:repeat|repeats)\s*:\s*([^\]]+)\]\s*$/i);
  const parenRepeatMatch = rawText.match(/\((?:repeat|repeats)\s*:\s*([^\)]+)\)\s*$/i);
  const legacyMatch = rawText.match(/\[(daily|weekly|monthly|yearly)\]\s*$|\((daily|weekly|monthly|yearly)\)\s*$/i);
  const extractedRuleText = ((_d = (_c = (_b = (_a = explicitRepeatMatch == null ? void 0 : explicitRepeatMatch[1]) != null ? _a : parenRepeatMatch == null ? void 0 : parenRepeatMatch[1]) != null ? _b : legacyMatch == null ? void 0 : legacyMatch[1]) != null ? _c : legacyMatch == null ? void 0 : legacyMatch[2]) != null ? _d : "weekly").trim();
  const text = rawText.replace(/\s*\[(?:repeat|repeats)\s*:[^\]]+\]\s*$/i, "").replace(/\s*\((?:repeat|repeats)\s*:[^\)]+\)\s*$/i, "").replace(/\s*(\[(daily|weekly|monthly|yearly)\]|\((daily|weekly|monthly|yearly)\))\s*$/i, "").trim();
  const rule = parseRepeatingRule(extractedRuleText);
  if (!text || !rule) {
    return null;
  }
  return {
    text,
    ruleText: normalizeRepeatingRuleText(rule),
    rule
  };
}
function parseRepeatingRule(value) {
  var _a;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) {
    return { kind: "weekly", interval: 1, unit: "week" };
  }
  if (normalized === "daily") {
    return { kind: "daily", interval: 1, unit: "day" };
  }
  if (normalized === "weekly") {
    return { kind: "weekly", interval: 1, unit: "week" };
  }
  if (normalized === "monthly") {
    return { kind: "monthly", interval: 1, unit: "month" };
  }
  if (normalized === "yearly" || normalized === "annual" || normalized === "annually") {
    return { kind: "yearly", interval: 1, unit: "year" };
  }
  const everyMatch = (_a = normalized.match(/^every\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i)) != null ? _a : normalized.match(/^interval\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i);
  if (everyMatch) {
    const interval = Math.max(1, Number(everyMatch[1]));
    const unit = normalizeRepeatingIntervalUnit(everyMatch[2]);
    return {
      kind: "interval",
      interval,
      unit
    };
  }
  const monthlyDayMatch = normalized.match(/^monthly\s+(?:day\s+)?(last|[1-9]|[12]\d|3[01])$/i);
  if (monthlyDayMatch) {
    return {
      kind: "monthly",
      interval: 1,
      unit: "month",
      monthlyDay: monthlyDayMatch[1].toLowerCase() === "last" ? "last" : Number(monthlyDayMatch[1])
    };
  }
  const weekdayMatch = normalized.match(/^(?:weekdays?|weekly\s+on)\s+(.+)$/i);
  if (weekdayMatch) {
    const weekdays = weekdayMatch[1].split(/[\s,\/|]+/).map((token) => normalizeWeekdayToken(token)).filter((token) => token !== null).filter((token, index, array) => array.indexOf(token) === index).sort((left, right) => left - right);
    if (weekdays.length > 0) {
      return {
        kind: "weekday-list",
        interval: 1,
        unit: "week",
        weekdays
      };
    }
  }
  return null;
}
function normalizeRepeatingRuleText(rule) {
  var _a, _b;
  if (rule.kind === "daily") {
    return "daily";
  }
  if (rule.kind === "weekly") {
    return "weekly";
  }
  if (rule.kind === "monthly") {
    if (rule.monthlyDay === "last") {
      return "monthly day last";
    }
    if (typeof rule.monthlyDay === "number") {
      return `monthly day ${rule.monthlyDay}`;
    }
    return "monthly";
  }
  if (rule.kind === "yearly") {
    return "yearly";
  }
  if (rule.kind === "weekday-list") {
    return `weekdays ${formatWeekdayList((_a = rule.weekdays) != null ? _a : [])}`;
  }
  return `every ${rule.interval} ${(_b = rule.unit) != null ? _b : "day"}${rule.interval === 1 ? "" : "s"}`;
}
function normalizeRepeatingIntervalUnit(value) {
  if (/^day/i.test(value)) {
    return "day";
  }
  if (/^week/i.test(value)) {
    return "week";
  }
  if (/^month/i.test(value)) {
    return "month";
  }
  return "year";
}
function normalizeWeekdayToken(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const map = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };
  return normalized in map ? map[normalized] : null;
}
function formatWeekdayList(weekdays) {
  const labels = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return weekdays.map((weekday) => {
    var _a;
    return (_a = labels[weekday]) != null ? _a : `${weekday}`;
  }).join(" ");
}
function isRepeatingRuleEligibleWithoutHistory(rule, todayKey) {
  var _a;
  const today = /* @__PURE__ */ new Date(`${todayKey}T00:00:00`);
  if (rule.kind === "weekday-list") {
    return ((_a = rule.weekdays) != null ? _a : []).includes(today.getDay());
  }
  if (rule.kind === "monthly" && typeof rule.monthlyDay !== "undefined") {
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const targetDay = rule.monthlyDay === "last" ? lastDayOfMonth : Math.min(rule.monthlyDay, lastDayOfMonth);
    return today.getDate() >= targetDay;
  }
  return true;
}
function isRepeatingRuleDueSince(rule, latestCompletedKey, todayKey) {
  var _a;
  const latest = /* @__PURE__ */ new Date(`${latestCompletedKey}T00:00:00`);
  const today = /* @__PURE__ */ new Date(`${todayKey}T00:00:00`);
  if (today.getTime() < latest.getTime()) {
    return false;
  }
  if (rule.kind === "daily") {
    return latestCompletedKey < todayKey;
  }
  if (rule.kind === "weekly") {
    return daysBetween(latestCompletedKey, todayKey) >= 7;
  }
  if (rule.kind === "yearly") {
    return addMonthsToDateKey(latestCompletedKey, 12) <= todayKey;
  }
  if (rule.kind === "interval") {
    if (rule.unit === "day") {
      return daysBetween(latestCompletedKey, todayKey) >= rule.interval;
    }
    if (rule.unit === "week") {
      return daysBetween(latestCompletedKey, todayKey) >= rule.interval * 7;
    }
    if (rule.unit === "month") {
      return addMonthsToDateKey(latestCompletedKey, rule.interval) <= todayKey;
    }
    return addMonthsToDateKey(latestCompletedKey, rule.interval * 12) <= todayKey;
  }
  if (rule.kind === "weekday-list") {
    return ((_a = rule.weekdays) != null ? _a : []).includes(today.getDay()) && latestCompletedKey < todayKey;
  }
  if (rule.kind === "monthly") {
    if (typeof rule.monthlyDay === "number" || rule.monthlyDay === "last") {
      const currentPeriodKey = `${todayKey.slice(0, 7)}-${`${resolveMonthlyTargetDay(today, rule.monthlyDay)}`.padStart(2, "0")}`;
      return todayKey >= currentPeriodKey && latestCompletedKey < currentPeriodKey;
    }
    return addMonthsToDateKey(latestCompletedKey, 1) <= todayKey;
  }
  return false;
}
function resolveMonthlyTargetDay(date, day) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return day === "last" ? lastDay : Math.min(day, lastDay);
}
function addMonthsToDateKey(dateKey, months) {
  const date = /* @__PURE__ */ new Date(`${dateKey}T00:00:00`);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return formatDateKey(date);
}
async function offloadReferencesFromMasterHub(content, vault, masterTodoPath) {
  const lines = content.split(/\r?\n/);
  const projectDefinitions = extractProjectDefinitionsFromTodo(content);
  const output = [...lines];
  const offloadedProjects = [];
  for (let index = projectDefinitions.length - 1; index >= 0; index -= 1) {
    const projectDefinition = projectDefinitions[index];
    const ranges = findProjectRanges(output);
    const project = ranges.find((candidate) => candidate.name === projectDefinition.projectName);
    if (!project) {
      continue;
    }
    let referenceStart = -1;
    let referenceEnd = -1;
    for (let lineIndex = project.start + 1; lineIndex <= project.end; lineIndex += 1) {
      const sectionName = getSectionName(output[lineIndex]);
      if ((sectionName == null ? void 0 : sectionName.toLowerCase()) === "reference") {
        referenceStart = lineIndex;
        referenceEnd = project.end;
        for (let lookahead = lineIndex + 1; lookahead <= project.end; lookahead += 1) {
          if (getSectionName(output[lookahead])) {
            referenceEnd = lookahead - 1;
            break;
          }
        }
        break;
      }
    }
    if (referenceStart < 0) {
      continue;
    }
    const referenceLines = output.slice(referenceStart + 1, referenceEnd + 1).map((line) => line.trim()).filter((line) => line.length > 0);
    if (referenceLines.length === 0) {
      continue;
    }
    const notePath = (0, import_obsidian2.normalizePath)(`${stripMarkdownExtension(projectDefinition.noteLinkPath)}.md`);
    const noteFile = vault.getAbstractFileByPath(notePath);
    if (!(noteFile instanceof import_obsidian2.TFile)) {
      continue;
    }
    const noteContent = await vault.read(noteFile);
    const updatedNoteContent = appendLinesToSection(noteContent, "References", [
      `- Offloaded from [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]] on ${formatDateKey(/* @__PURE__ */ new Date())}`,
      ...referenceLines
    ]);
    await vault.modify(noteFile, updatedNoteContent);
    output.splice(referenceStart + 1, referenceEnd - referenceStart);
    offloadedProjects.push(projectDefinition.projectName);
  }
  return {
    updatedContent: output.join("\n"),
    offloadedProjects
  };
}
function looksLikeBreakdownTask(taskText) {
  return taskText.length >= 80 || /\band\b|\bthen\b|\bcleanup\b|\brefactor\b/i.test(taskText);
}
function extractArchivedDate(value) {
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
function daysBetween(startDateKey, endDateKey) {
  const start = /* @__PURE__ */ new Date(`${startDateKey}T00:00:00`);
  const end = /* @__PURE__ */ new Date(`${endDateKey}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 864e5));
}
function computeHealthScore(input) {
  var _a;
  let score = input.projectState === "active" ? 100 : input.projectState === "incubating" ? 82 : 78;
  if (input.projectState === "active") {
    score -= Math.min(input.openCount * 2, 30);
    score -= Math.min((_a = input.staleDays) != null ? _a : 0, 25);
    score += Math.min(input.completionsThisWeek * 4, 16);
    score += Math.min(input.nowCount * 3, 9);
    score += Math.min(input.nextCount * 1, 4);
  } else {
    score += Math.min(input.completionsThisWeek * 2, 8);
    score += input.nowCount > 0 ? 2 : 0;
    score += input.nextCount > 0 ? 1 : 0;
  }
  score -= input.dueSoonCount * 2;
  score -= input.overdueCount * 7;
  score -= input.blockedCount * 5;
  score -= input.breakdownCount * 5;
  score -= input.duplicateCount * 6;
  return clamp(score, 0, 100);
}
function describeHealthScore(score) {
  if (score >= 75) {
    return "Healthy";
  }
  if (score >= 50) {
    return "Watch";
  }
  if (score >= 30) {
    return "At Risk";
  }
  return "Critical";
}
function buildCleanupSuggestions(project) {
  const suggestions = [];
  if (project.projectState === "active" && project.staleDays !== null && project.staleDays >= 14) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "stale-project"),
      projectName: project.name,
      kind: "stale-project",
      summary: `${project.name}: review stale backlog or re-scope the project.`,
      detail: `${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since the last archived completion.`,
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.duplicateTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "duplicate-tasks"),
      projectName: project.name,
      kind: "duplicate-tasks",
      summary: `${project.name}: merge duplicate tasks (${project.duplicateTasks.slice(0, 3).join(", ")}).`,
      detail: `${project.duplicateTasks.length} duplicate task${project.duplicateTasks.length === 1 ? "" : "s"} detected in the project hub.`,
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.breakdownTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "breakdown-tasks"),
      projectName: project.name,
      kind: "breakdown-tasks",
      summary: `${project.name}: break down ${project.breakdownTasks.length} oversized task${project.breakdownTasks.length === 1 ? "" : "s"}.`,
      detail: project.breakdownTasks.slice(0, 3).join(" \u2022 "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.overdueTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "overdue-tasks"),
      projectName: project.name,
      kind: "overdue-tasks",
      summary: `${project.name}: clear ${project.overdueTasks.length} overdue task${project.overdueTasks.length === 1 ? "" : "s"}.`,
      detail: project.overdueTasks.slice(0, 3).map((task) => task.dueDate ? `${task.text} (${task.dueDate})` : task.text).join(" \u2022 "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.blockedTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "blocked-tasks"),
      projectName: project.name,
      kind: "blocked-tasks",
      summary: `${project.name}: review ${project.blockedTasks.length} blocked task${project.blockedTasks.length === 1 ? "" : "s"}.`,
      detail: project.blockedTasks.slice(0, 3).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" \u2022 "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.emptySections.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "empty-sections"),
      projectName: project.name,
      kind: "empty-sections",
      summary: `${project.name}: prune empty sections (${project.emptySections.join(", ")}).`,
      detail: `Empty sections: ${project.emptySections.join(", ")}`,
      action: "open-cleanup-note",
      actionLabel: "Cleanup note"
    });
  }
  return suggestions;
}
function buildCleanupSuggestionId(projectName, kind) {
  const normalizedProject = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `cleanup:${kind}:${normalizedProject}`;
}
function inferProjectState(status) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("someday")) {
    return "someday";
  }
  if (normalized.includes("incubat")) {
    return "incubating";
  }
  return "active";
}
function selectProjectNextAction(input) {
  const actionableTask = [
    ...input.overdueTasks,
    ...input.dueSoonTasks,
    ...input.nowTaskDetails,
    ...input.nextTaskDetails,
    ...input.dueRepeatingTaskDetails,
    ...input.laterTaskDetails
  ].find((task) => !task.isBlocked && task.text.trim().length > 0);
  if (actionableTask) {
    return actionableTask.text;
  }
  if (input.projectState === "someday") {
    return "Incubating in someday. Promote one concrete task when ready.";
  }
  if (input.projectState === "incubating") {
    return "Define the first real next step before activating this project.";
  }
  return `Define the next action for ${input.projectName}.`;
}
function buildProjectHealthReasons(input) {
  const reasons = [];
  if (input.projectState !== "active") {
    reasons.push(input.projectState === "someday" ? "Parked as someday work." : "Marked incubating until it is ready for active execution.");
  }
  if (input.overdueTasks.length > 0) {
    reasons.push(`${input.overdueTasks.length} overdue task${input.overdueTasks.length === 1 ? "" : "s"}.`);
  }
  if (input.dueSoonTasks.length > 0) {
    reasons.push(`${input.dueSoonTasks.length} due soon.`);
  }
  if (input.blockedTasks.length > 0) {
    reasons.push(`${input.blockedTasks.length} blocked task${input.blockedTasks.length === 1 ? "" : "s"}.`);
  }
  if (input.projectState === "active" && input.staleDays !== null && input.staleDays >= 7) {
    reasons.push(`No completion for ${input.staleDays} day${input.staleDays === 1 ? "" : "s"}.`);
  }
  if (input.nowTaskDetails.length === 0 && input.projectState === "active") {
    reasons.push("No task in Now.");
  }
  if (input.nextTaskDetails.length === 0 && input.projectState === "active") {
    reasons.push("No task in Next.");
  }
  if (input.breakdownTasks.length > 0) {
    reasons.push(`${input.breakdownTasks.length} task${input.breakdownTasks.length === 1 ? " looks" : "s look"} too large.`);
  }
  if (input.duplicateTasks.size > 0) {
    reasons.push(`${input.duplicateTasks.size} duplicate task${input.duplicateTasks.size === 1 ? "" : "s"}.`);
  }
  if (input.emptySections.size > 0) {
    reasons.push(`Empty sections: ${Array.from(input.emptySections).join(", ")}.`);
  }
  reasons.push(`Next action: ${input.nextAction}`);
  return reasons.slice(0, 6);
}
function parseTodoTaskSummary(rawText, section, now) {
  const dueDate = extractTaskAnnotation(rawText, "due");
  const blockedReason = extractTaskAnnotation(rawText, "blocked");
  const unblockDate = extractTaskAnnotation(rawText, "unblock") || extractTaskAnnotation(rawText, "blocked-until");
  const text = stripTaskAnnotations(rawText).trim();
  const todayKey = formatDateKey(now);
  const isOverdue = Boolean(dueDate && dueDate < todayKey);
  const isDueSoon = Boolean(dueDate && !isOverdue && daysBetween(todayKey, dueDate) <= 3);
  return {
    text: text || rawText,
    rawText,
    section,
    dueDate: dueDate != null ? dueDate : "",
    blockedReason: blockedReason != null ? blockedReason : "",
    unblockDate: unblockDate != null ? unblockDate : "",
    isBlocked: Boolean(blockedReason),
    isDueSoon,
    isOverdue
  };
}
function extractTaskAnnotation(value, key) {
  var _a;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`\\[${escapedKey}:\\s*([^]]+)\\]`, "i"));
  return ((_a = match == null ? void 0 : match[1]) == null ? void 0 : _a.trim()) || null;
}
function stripTaskAnnotations(value) {
  return value.replace(/\s*\[(?:due|blocked|unblock|blocked-until):\s*[^\]]+\]/gi, "").replace(/\s{2,}/g, " ").trim();
}
function appendLinesToSection(content, sectionName, linesToAppend) {
  const lines = content.split(/\r?\n/);
  let sectionIndex = -1;
  let sectionEnd = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.toLowerCase() === `## ${sectionName}`.toLowerCase()) {
      sectionIndex = index;
      sectionEnd = lines.length;
      for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) {
        if (/^##\s+/.test(lines[lookahead].trim())) {
          sectionEnd = lookahead;
          break;
        }
      }
      break;
    }
  }
  if (sectionIndex < 0) {
    const output2 = trimTrailingBlankLines(lines);
    output2.push("", `## ${sectionName}`, ...linesToAppend, "");
    return output2.join("\n");
  }
  const output = [...lines];
  let insertIndex = sectionEnd;
  while (insertIndex > sectionIndex + 1 && output[insertIndex - 1].trim() === "") {
    insertIndex -= 1;
  }
  output.splice(insertIndex, 0, ...linesToAppend);
  return output.join("\n");
}

// src/dashboard-ui.ts
var import_obsidian3 = require("obsidian");
var DASHBOARD_ACTIVITY_TRACKERS = [
  { kind: "exercise", label: "Exercise", icon: "dumbbell", tone: "health" },
  { kind: "reading", label: "Reading", icon: "book-open", tone: "focus" },
  { kind: "gaming", label: "Gaming", icon: "gamepad-2", tone: "focus" },
  { kind: "hobbies", label: "Hobbies", icon: "shapes", tone: "neutral" },
  { kind: "hygiene", label: "Hygiene", icon: "shower-head", tone: "health" },
  { kind: "cooking", label: "Cooking", icon: "chef-hat", tone: "alert" },
  { kind: "errand", label: "Errand", icon: "shopping-bag", tone: "alert" },
  { kind: "commute", label: "Commute", icon: "car-front", tone: "neutral" },
  { kind: "social", label: "Social", icon: "users", tone: "focus" },
  { kind: "chores", label: "Chores", icon: "house", tone: "log" }
];
var WEEK_AT_A_GLANCE_SEGMENTS = [
  { kind: "sleep", label: "Sleep" },
  { kind: "work", label: "Work" },
  { kind: "nap", label: "Nap" },
  { kind: "relax", label: "Relax" },
  { kind: "break", label: "Break" },
  { kind: "poop", label: "Poop" },
  ...DASHBOARD_ACTIVITY_TRACKERS,
  { kind: "unknown", label: "Unknown" }
];
var _DailyDashboardView = class _DailyDashboardView extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.hasDeferredRefreshListeners = false;
    this.hasKeyboardShortcutListener = false;
    this.pendingRefresh = false;
    this.timelineFilters = {
      keyword: "",
      project: "",
      tag: "",
      kinds: ["task", "session", "calendar", "log"],
      fromDate: "",
      toDate: "",
      onlyWithNotes: false
    };
    this.autoRefreshHandle = null;
    this.lastRenderAt = 0;
    this.quickAddState = {
      projectName: "",
      sectionName: "Add",
      taskText: ""
    };
    this.editingFocusIndex = null;
    this.editingFocusText = "";
    this.draggedFocusIndex = null;
    this.draggedLayoutCardKey = null;
    this.suppressNextCardToggle = false;
    this.selectedFocusProjectName = "";
    this.selectedSessionProjectName = "";
    this.selectedSavedFilterName = getDashboardSelectedFilterName();
    this.calendarCursorDate = /* @__PURE__ */ new Date();
    this.selectedCalendarDate = formatDateKey(/* @__PURE__ */ new Date());
    this.pendingUndoActions = [];
    this.notificationPanelOpen = false;
    this.quickAddPanelOpen = false;
    this.handleDocumentPointerDown = (event) => {
      if (!this.notificationPanelOpen && !this.quickAddPanelOpen || !this.contentEl.isConnected) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const notificationShell = this.contentEl.querySelector(".daily-dashboard-notification-shell");
      const quickAddShell = this.contentEl.querySelector(".daily-dashboard-quick-add-shell");
      if ((notificationShell == null ? void 0 : notificationShell.contains(target)) || (quickAddShell == null ? void 0 : quickAddShell.contains(target))) {
        return;
      }
      this.notificationPanelOpen = false;
      this.quickAddPanelOpen = false;
      void this.render();
    };
    this.handleDashboardKeydown = (event) => {
      if (!this.contentEl.isConnected || !this.hasKeyboardShortcutListener) {
        return;
      }
      if (event.key === "Escape" && (this.notificationPanelOpen || this.quickAddPanelOpen)) {
        event.preventDefault();
        this.notificationPanelOpen = false;
        this.quickAddPanelOpen = false;
        void this.render();
        return;
      }
      if (!this.contentEl.contains(event.target) && event.target !== this.contentEl) {
        return;
      }
      if (this.shouldIgnoreShortcutEvent(event)) {
        return;
      }
      const action = this.getShortcutAction(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      void action();
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_DAILY_DASHBOARD;
  }
  getDisplayText() {
    return "Obsidian DASH - Daily Action & System Hub";
  }
  getIcon() {
    return "check-square";
  }
  async onOpen() {
    await this.render();
    this.attachDeferredRefreshListeners();
    this.attachKeyboardShortcutListener();
    document.addEventListener("mousedown", this.handleDocumentPointerDown, true);
    this.startAutoRefresh();
  }
  async onClose() {
    this.detachKeyboardShortcutListener();
    document.removeEventListener("mousedown", this.handleDocumentPointerDown, true);
    this.stopAutoRefresh();
    this.pendingRefresh = false;
  }
  async requestRefresh() {
    if (this.isEditingTextField()) {
      this.pendingRefresh = true;
      return;
    }
    this.pendingRefresh = false;
    await this.render();
  }
  isSectionExpanded(sectionKey) {
    return getDashboardExpandedSections().has(sectionKey);
  }
  async toggleSectionExpanded(sectionKey) {
    const expanded = this.isSectionExpanded(sectionKey);
    setDashboardSectionExpanded(sectionKey, !expanded);
    await this.render();
  }
  attachDeferredRefreshListeners() {
    if (this.hasDeferredRefreshListeners) {
      return;
    }
    this.hasDeferredRefreshListeners = true;
    this.contentEl.addEventListener("focusout", () => {
      window.setTimeout(() => {
        void this.flushPendingRefresh();
      }, 0);
    });
  }
  attachKeyboardShortcutListener() {
    if (this.hasKeyboardShortcutListener) {
      return;
    }
    this.hasKeyboardShortcutListener = true;
    this.contentEl.addEventListener("keydown", this.handleDashboardKeydown);
  }
  detachKeyboardShortcutListener() {
    if (!this.hasKeyboardShortcutListener) {
      return;
    }
    this.hasKeyboardShortcutListener = false;
    this.contentEl.removeEventListener("keydown", this.handleDashboardKeydown);
  }
  isEditingTextField() {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
      return false;
    }
    if (!this.contentEl.contains(activeElement)) {
      return false;
    }
    return activeElement instanceof HTMLTextAreaElement || ["text", "search", "number"].includes(activeElement.type);
  }
  shouldIgnoreShortcutEvent(event) {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
      return true;
    }
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    return target instanceof HTMLElement && target.isContentEditable;
  }
  getShortcutAction(event) {
    const key = event.key.toLowerCase();
    switch (key) {
      case "v":
        return async () => this.cycleViewMode();
      case "l":
        return async () => this.openLayoutCustomizationFlow();
      case "n":
        return async () => this.plugin.openCreateProjectFlow();
      case "w":
        return async () => this.plugin.generateWeeklyReview();
      case "r":
        return async () => this.requestRefresh();
      case "f":
        return async () => this.plugin.openQuickCaptureFocusFlow();
      case "a":
        return async () => this.plugin.openAskAiFlow();
      case "s":
        return async () => this.plugin.syncRepeatingProjectTasks(true);
      case "z":
        return async () => this.undoPendingAction();
      case "/":
      case "?":
        return async () => this.openShortcutHelpFlow();
      default:
        return null;
    }
  }
  async flushPendingRefresh() {
    if (!this.pendingRefresh || this.isEditingTextField()) {
      return;
    }
    this.pendingRefresh = false;
    await this.render();
  }
  getViewMode() {
    return getDashboardViewMode();
  }
  async cycleViewMode() {
    const current = this.getViewMode();
    const next = current === "mobile" ? "compact" : current === "compact" ? "widescreen" : "mobile";
    setDashboardViewMode(next);
    await this.render();
  }
  getViewModeMeta(mode) {
    if (mode === "compact") {
      return { label: "Compact", icon: "minimize-2", nextLabel: "Widescreen" };
    }
    if (mode === "widescreen") {
      return { label: "Widescreen", icon: "monitor", nextLabel: "Mobile" };
    }
    return { label: "Mobile", icon: "smartphone", nextLabel: "Compact" };
  }
  openLayoutCustomizationFlow() {
    new DashboardLayoutModal(this.app, {
      cards: getDashboardCardLayoutState(),
      onApply: async (cards) => {
        setDashboardCardLayoutState(cards);
        await this.render();
      }
    }).open();
  }
  openShortcutHelpFlow() {
    new DashboardShortcutHelpModal(this.app).open();
  }
  async toggleNotificationPanel() {
    this.notificationPanelOpen = !this.notificationPanelOpen;
    if (this.notificationPanelOpen) {
      this.quickAddPanelOpen = false;
    }
    await this.render();
  }
  async toggleQuickAddPanel() {
    this.quickAddPanelOpen = !this.quickAddPanelOpen;
    if (this.quickAddPanelOpen) {
      this.notificationPanelOpen = false;
    }
    await this.render();
  }
  async submitQuickAddTask() {
    const text = this.quickAddState.taskText.trim();
    if (!text || !this.quickAddState.projectName) {
      return;
    }
    await this.plugin.addTaskToProject(this.quickAddState.projectName, this.quickAddState.sectionName, text);
    this.quickAddState.taskText = "";
    this.quickAddPanelOpen = false;
    await this.render();
  }
  async handleNotificationAction(notification) {
    this.notificationPanelOpen = false;
    const action = notification.action;
    if (!action) {
      return;
    }
    switch (action.kind) {
      case "open-setup":
        await this.plugin.openFirstRunSetupWizard();
        return;
      case "open-master-todo":
        await this.plugin.openMasterTodo();
        return;
      case "open-cleanup-note":
        await this.plugin.showCleanupSuggestions();
        return;
      case "end-day":
        await this.plugin.endLogicalDay();
        return;
      case "repair-day":
        await this.plugin.openLogicalDayRepairFlow();
        return;
      default:
        return;
    }
  }
  async dismissNotification(notificationId) {
    this.notificationPanelOpen = false;
    await this.plugin.dismissDashboardNotification(notificationId);
  }
  async runDestructiveAction(label, action, undo) {
    await action();
    this.pendingUndoActions = [...this.pendingUndoActions, { label, undo }].slice(-5);
    await this.render();
  }
  async undoPendingAction() {
    if (this.pendingUndoActions.length === 0) {
      return;
    }
    const action = this.pendingUndoActions[this.pendingUndoActions.length - 1];
    this.pendingUndoActions = this.pendingUndoActions.slice(0, -1);
    await action.undo();
    await this.render();
  }
  async dismissPendingUndo() {
    this.pendingUndoActions = this.pendingUndoActions.slice(0, -1);
    await this.render();
  }
  async handleCleanupSuggestionAction(action) {
    if (action === "open-cleanup-note") {
      await this.plugin.showCleanupSuggestions();
      return;
    }
    await this.plugin.openMasterTodo();
  }
  registerGridCard(card, title, bindings, layoutByKey) {
    const key = getDashboardCardLayoutKey(title);
    const config = layoutByKey.get(key);
    card.dataset.layoutKey = key;
    if (config == null ? void 0 : config.pinned) {
      card.addClass("is-layout-pinned");
      const controls = card.querySelector(".daily-dashboard-card-header-controls");
      if (controls) {
        createSemanticChip(controls, "Pinned", "focus");
      }
    }
    if (config == null ? void 0 : config.hidden) {
      card.addClass("is-layout-hidden");
    }
    const header = card.querySelector(".daily-dashboard-card-header");
    if (header && !(config == null ? void 0 : config.hidden)) {
      header.addClass("is-layout-draggable");
      header.draggable = true;
      header.addEventListener("click", (event) => {
        if (!this.suppressNextCardToggle) {
          return;
        }
        this.suppressNextCardToggle = false;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      header.addEventListener("dragstart", (event) => {
        this.draggedLayoutCardKey = key;
        this.suppressNextCardToggle = false;
        card.addClass("is-layout-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", key);
        }
      });
      header.addEventListener("dragend", () => {
        this.draggedLayoutCardKey = null;
        card.removeClass("is-layout-dragging");
        this.clearDashboardCardDropTargets();
      });
      card.addEventListener("dragover", (event) => {
        if (!this.draggedLayoutCardKey || this.draggedLayoutCardKey === key) {
          return;
        }
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        card.toggleClass("is-layout-drop-before", position === "before");
        card.toggleClass("is-layout-drop-after", position === "after");
      });
      card.addEventListener("dragleave", (event) => {
        if (!(event.relatedTarget instanceof Node) || !card.contains(event.relatedTarget)) {
          card.removeClass("is-layout-drop-before");
          card.removeClass("is-layout-drop-after");
        }
      });
      card.addEventListener("drop", (event) => {
        const sourceKey = this.draggedLayoutCardKey;
        if (!sourceKey || sourceKey === key) {
          return;
        }
        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        this.clearDashboardCardDropTargets();
        this.suppressNextCardToggle = true;
        void this.reorderDashboardCards(sourceKey, key, position);
      });
    }
    bindings.push({ key, card });
    return card;
  }
  clearDashboardCardDropTargets() {
    this.contentEl.querySelectorAll(".daily-dashboard-card.is-layout-drop-before, .daily-dashboard-card.is-layout-drop-after").forEach((element) => {
      element.removeClass("is-layout-drop-before");
      element.removeClass("is-layout-drop-after");
    });
  }
  async reorderDashboardCards(sourceKey, targetKey, position) {
    const cards = sortDashboardLayoutCardsByOrder(getDashboardCardLayoutState());
    const sourceIndex = cards.findIndex((card) => card.key === sourceKey);
    const targetIndex = cards.findIndex((card) => card.key === targetKey);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return;
    }
    const nextCards = [...cards];
    const [movedCard] = nextCards.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertionIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
    nextCards.splice(Math.max(0, Math.min(insertionIndex, nextCards.length)), 0, movedCard);
    setDashboardCardLayoutState(nextCards.map((card, index) => ({ ...card, order: index })));
    await this.render();
  }
  applyGridLayout(grid, bindings, layoutByKey) {
    const visible = bindings.filter((binding) => {
      var _a;
      return !((_a = layoutByKey.get(binding.key)) == null ? void 0 : _a.hidden);
    }).sort((left, right) => {
      var _a, _b;
      const leftConfig = layoutByKey.get(left.key);
      const rightConfig = layoutByKey.get(right.key);
      const pinDelta = Number(Boolean(rightConfig == null ? void 0 : rightConfig.pinned)) - Number(Boolean(leftConfig == null ? void 0 : leftConfig.pinned));
      if (pinDelta !== 0) {
        return pinDelta;
      }
      const orderDelta = ((_a = leftConfig == null ? void 0 : leftConfig.order) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = rightConfig == null ? void 0 : rightConfig.order) != null ? _b : Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }
      return left.key.localeCompare(right.key);
    });
    const hidden = bindings.filter((binding) => {
      var _a;
      return (_a = layoutByKey.get(binding.key)) == null ? void 0 : _a.hidden;
    });
    [...visible, ...hidden].forEach((binding) => {
      var _a;
      const config = layoutByKey.get(binding.key);
      binding.card.style.order = `${(_a = config == null ? void 0 : config.order) != null ? _a : 0}`;
      binding.card.style.gridColumn = getDashboardCardGridColumn(binding.key, config, this.getViewMode());
      grid.appendChild(binding.card);
    });
  }
  getSessionTagTone(tag) {
    const normalized = tag.trim().toLowerCase();
    if (normalized === "deep work") {
      return "capture";
    }
    if (normalized === "creative") {
      return "focus";
    }
    if (normalized === "recovery") {
      return "health";
    }
    if (normalized === "admin") {
      return "log";
    }
    return "neutral";
  }
  formatTodoTaskMeta(task) {
    return [
      task.section,
      task.dueDate ? `Due ${task.dueDate}` : "",
      task.isOverdue ? "Overdue" : task.isDueSoon ? "Due soon" : "",
      task.blockedReason ? `Blocked: ${task.blockedReason}` : "",
      task.unblockDate ? `Unblock ${task.unblockDate}` : ""
    ].filter((value) => value.length > 0).join(" \u2022 ");
  }
  getSessionTagSummary(sessions) {
    const nowKey = formatDateTimeKey(/* @__PURE__ */ new Date());
    const totals = /* @__PURE__ */ new Map();
    sessions.forEach((session) => {
      var _a, _b;
      const tag = session.tag.trim();
      if (!tag) {
        return;
      }
      const end = (_a = session.end) != null ? _a : nowKey;
      const minutes = Math.max(0, getMinutesBetween(session.start, end));
      if (minutes <= 0) {
        return;
      }
      totals.set(tag, ((_b = totals.get(tag)) != null ? _b : 0) + minutes);
    });
    return [...totals.entries()].map(([tag, minutes]) => ({ tag, minutes })).sort((left, right) => right.minutes - left.minutes);
  }
  createCollapsibleSubsection(parent, sectionKey, title, description) {
    const section = parent.createDiv({ cls: "daily-dashboard-subsection" });
    const collapsed = getCollapsedSubsectionState().has(sectionKey);
    section.toggleClass("is-collapsed", collapsed);
    const header = section.createDiv({ cls: "daily-dashboard-subsection-header" });
    header.role = "button";
    header.tabIndex = 0;
    header.ariaExpanded = collapsed ? "false" : "true";
    const copy = header.createDiv({ cls: "daily-dashboard-subsection-copy" });
    copy.createEl("strong", { text: title });
    if (description) {
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: description });
    }
    const toggle = header.createSpan({ cls: "daily-dashboard-subsection-toggle" });
    (0, import_obsidian3.setIcon)(toggle, collapsed ? "chevron-down" : "chevron-up");
    const toggleCollapsed = () => {
      const nextCollapsed = !section.hasClass("is-collapsed");
      section.toggleClass("is-collapsed", nextCollapsed);
      header.ariaExpanded = nextCollapsed ? "false" : "true";
      (0, import_obsidian3.setIcon)(toggle, nextCollapsed ? "chevron-down" : "chevron-up");
      setCollapsedSubsectionState(sectionKey, nextCollapsed);
    };
    header.addEventListener("click", () => {
      toggleCollapsed();
    });
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCollapsed();
      }
    });
    return section.createDiv({ cls: "daily-dashboard-subsection-body" });
  }
  startEditingFocusItem(index, value) {
    this.editingFocusIndex = index;
    this.editingFocusText = value;
  }
  stopEditingFocusItem() {
    this.editingFocusIndex = null;
    this.editingFocusText = "";
  }
  async render() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const calendarSnapshot = await this.plugin.getUpcomingCalendarSnapshot();
      const dashboardNotifications = this.plugin.getDashboardNotifications(todoSnapshot, calendarSnapshot);
      const weeklyAgenda = this.plugin.getWeeklyAgenda(todayEntry.date);
      const suggestedTop3 = this.plugin.getSuggestedTop3Candidates(todoSnapshot, calendarSnapshot);
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = (_a = todoSnapshot == null ? void 0 : todoSnapshot.projects) != null ? _a : [];
      const staleProjects = (_b = todoSnapshot == null ? void 0 : todoSnapshot.staleProjects) != null ? _b : [];
      const breakdownCandidates = (_c = todoSnapshot == null ? void 0 : todoSnapshot.breakdownCandidates) != null ? _c : [];
      const cleanupSuggestions = this.plugin.getVisibleCleanupSuggestions(todoSnapshot);
      const dueSoonTasks = (_d = todoSnapshot == null ? void 0 : todoSnapshot.dueSoonTasks) != null ? _d : [];
      const overdueTasks = (_e = todoSnapshot == null ? void 0 : todoSnapshot.overdueTasks) != null ? _e : [];
      const blockedTasks = (_f = todoSnapshot == null ? void 0 : todoSnapshot.blockedTasks) != null ? _f : [];
      const cleanupProjects = projects.filter((project) => project.staleDays !== null || project.duplicateTasks.length > 0 || project.emptySections.length > 0 || project.breakdownTasks.length > 0);
      const gamificationSummary = this.plugin.getGamificationSummary(todoSnapshot);
      const timelineResults = this.getTimelineSearchResults();
      const savedDashboardFilters = getSavedDashboardFilters();
      const layoutCards = getDashboardCardLayoutState();
      const layoutByKey = new Map(layoutCards.map((card) => [card.key, card]));
      const hiddenLayoutCardCount = layoutCards.filter((card) => card.hidden).length;
      const gridCardBindings = [];
      const staleProjectCount = staleProjects.length;
      const viewMode = this.getViewMode();
      const viewModeMeta = this.getViewModeMeta(viewMode);
      const latestMoodCheckIn = (_g = todayEntry.moodCheckIns[0]) != null ? _g : null;
      const latestEnergyCheckIn = (_h = todayEntry.energyCheckIns[0]) != null ? _h : null;
      const latestAnxietyCheckIn = (_i = todayEntry.anxietyCheckIns[0]) != null ? _i : null;
      const energyCheckInAverage = todayEntry.energyCheckIns.length > 0 ? (todayEntry.energyCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.energyCheckIns.length).toFixed(1) : "";
      const moodCheckInAverage = todayEntry.moodCheckIns.length > 0 ? (todayEntry.moodCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.moodCheckIns.length).toFixed(1) : "";
      const anxietyCheckInAverage = todayEntry.anxietyCheckIns.length > 0 ? (todayEntry.anxietyCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.anxietyCheckIns.length).toFixed(1) : "";
      if (!this.selectedCalendarDate) {
        this.selectedCalendarDate = todayEntry.date;
      }
      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }
      if (!projects.some((project) => project.name === this.selectedFocusProjectName)) {
        this.selectedFocusProjectName = "";
      }
      if (!this.selectedSessionProjectName && projects.length > 0) {
        this.selectedSessionProjectName = projects[0].name;
      }
      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");
      contentEl.removeClass("is-view-mobile", "is-view-compact", "is-view-widescreen");
      contentEl.addClass(`is-view-${viewMode}`);
      const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
      const hero = page.createDiv({ cls: "daily-dashboard-hero" });
      if (wallpaperUrl) {
        hero.addClass("has-wallpaper");
        hero.style.setProperty("--daily-dashboard-wallpaper", `url("${wallpaperUrl}")`);
      }
      const heroHeader = hero.createDiv({ cls: "daily-dashboard-hero-header" });
      const heroCopy = heroHeader.createDiv({ cls: "daily-dashboard-hero-copy" });
      heroCopy.createEl("span", { cls: "daily-dashboard-kicker", text: "Daily operating dashboard" });
      heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title", text: settings.dashboardTitle });
      const heroHeaderControls = heroHeader.createDiv({ cls: "daily-dashboard-hero-header-controls" });
      const actions = heroHeaderControls.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
      const quickAddShell = actions.createDiv({ cls: "daily-dashboard-quick-add-shell" });
      const quickAddTrigger = quickAddShell.createEl("button", { cls: "daily-dashboard-hero-popover-trigger" });
      quickAddTrigger.type = "button";
      quickAddTrigger.ariaLabel = "Add a task to a project";
      quickAddTrigger.ariaExpanded = this.quickAddPanelOpen ? "true" : "false";
      quickAddTrigger.toggleClass("is-active", this.quickAddPanelOpen);
      const quickAddIcon = quickAddTrigger.createSpan({ cls: "daily-dashboard-button-icon" });
      (0, import_obsidian3.setIcon)(quickAddIcon, "plus-circle");
      quickAddTrigger.createSpan({ cls: "daily-dashboard-button-label", text: "Add to project" });
      quickAddTrigger.addEventListener("click", () => {
        void this.toggleQuickAddPanel();
      });
      if (this.quickAddPanelOpen) {
        const quickAddPopover = quickAddShell.createDiv({ cls: "daily-dashboard-hero-popover daily-dashboard-quick-add-popover" });
        const popoverHeader = quickAddPopover.createDiv({ cls: "daily-dashboard-notification-popover-header" });
        const popoverCopy = popoverHeader.createDiv({ cls: "daily-dashboard-stack" });
        popoverCopy.createEl("strong", { text: "Add to project" });
        popoverCopy.createEl("span", {
          cls: "daily-dashboard-row-meta",
          text: projects.length > 0 ? "Capture a task straight into Add, Fix, Now, Next, or Later." : "Create a project first so there is somewhere to send the task."
        });
        if (projects.length === 0) {
          const emptyState = quickAddPopover.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
          emptyState.createEl("span", { text: "No projects are available yet." });
          const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(emptyActions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
        } else {
          const quickAddForm = quickAddPopover.createDiv({ cls: "daily-dashboard-stacked-form" });
          const projectSelect = quickAddForm.createEl("select", { cls: "daily-dashboard-input" });
          projects.forEach((project) => {
            const option = projectSelect.createEl("option", { text: project.name });
            option.value = project.name;
            option.selected = project.name === this.quickAddState.projectName;
          });
          projectSelect.addEventListener("change", () => {
            this.quickAddState.projectName = projectSelect.value;
          });
          const sectionSelect = quickAddForm.createEl("select", { cls: "daily-dashboard-input" });
          ["Add", "Fix", "Now", "Next", "Later"].forEach((section) => {
            const option = sectionSelect.createEl("option", { text: section });
            option.value = section;
            option.selected = section === this.quickAddState.sectionName;
          });
          sectionSelect.addEventListener("change", () => {
            this.quickAddState.sectionName = sectionSelect.value;
          });
          const taskInput = quickAddForm.createEl("input", {
            cls: "daily-dashboard-input",
            attr: { type: "text", placeholder: "Add a task to the selected project" }
          });
          taskInput.value = this.quickAddState.taskText;
          taskInput.addEventListener("input", () => {
            this.quickAddState.taskText = taskInput.value;
          });
          taskInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void this.submitQuickAddTask();
            }
          });
          const quickAddActions = quickAddPopover.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(quickAddActions, "Add task", async () => this.submitQuickAddTask(), true, "plus-circle");
          createButton(quickAddActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");
        }
      }
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow(), false, "panel-right-open");
      createButton(actions, "Repair day", async () => this.plugin.openLogicalDayRepairFlow(), false, "wrench");
      const notificationShell = heroHeaderControls.createDiv({ cls: "daily-dashboard-notification-shell" });
      const notificationTrigger = notificationShell.createEl("button", { cls: "daily-dashboard-notification-trigger" });
      notificationTrigger.type = "button";
      notificationTrigger.ariaLabel = dashboardNotifications.length > 0 ? `${dashboardNotifications.length} active notifications` : "No active notifications";
      notificationTrigger.ariaExpanded = this.notificationPanelOpen ? "true" : "false";
      notificationTrigger.toggleClass("is-alert", dashboardNotifications.some((item) => item.tone === "alert"));
      notificationTrigger.toggleClass("is-active", this.notificationPanelOpen);
      const notificationIcon = notificationTrigger.createSpan({ cls: "daily-dashboard-button-icon" });
      (0, import_obsidian3.setIcon)(notificationIcon, "bell-ring");
      notificationTrigger.createSpan({ cls: "daily-dashboard-notification-label", text: "Notifications" });
      notificationTrigger.createSpan({ cls: "daily-dashboard-notification-badge", text: `${dashboardNotifications.length}` });
      notificationTrigger.addEventListener("click", () => {
        void this.toggleNotificationPanel();
      });
      if (this.notificationPanelOpen) {
        const notificationPopover = notificationShell.createDiv({ cls: "daily-dashboard-notification-popover" });
        const popoverHeader = notificationPopover.createDiv({ cls: "daily-dashboard-notification-popover-header" });
        const popoverCopy = popoverHeader.createDiv({ cls: "daily-dashboard-stack" });
        popoverCopy.createEl("strong", { text: "Notifications" });
        popoverCopy.createEl("span", {
          cls: "daily-dashboard-row-meta",
          text: dashboardNotifications.length > 0 ? `${dashboardNotifications.length} active items` : "Everything is clear right now."
        });
        const popoverSummary = notificationPopover.createDiv({ cls: "daily-dashboard-chip-row" });
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "calendar").length} reminders`, dashboardNotifications.some((item) => item.source === "calendar") ? "focus" : "neutral");
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "system").length} system`, dashboardNotifications.some((item) => item.source === "system") ? "state" : "neutral");
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "tasks").length} task`, dashboardNotifications.some((item) => item.source === "tasks") ? "alert" : "neutral");
        const notificationList = notificationPopover.createDiv({ cls: "daily-dashboard-project-list daily-dashboard-notification-popover-list" });
        if (dashboardNotifications.length === 0) {
          notificationList.createDiv({ cls: "daily-dashboard-empty-state", text: "No active reminders or system notices right now." });
        } else {
          dashboardNotifications.slice(0, 10).forEach((notification) => {
            const row = notificationList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-notification-row" });
            row.addClass(`is-${notification.tone}`);
            const copy = row.createDiv({ cls: "daily-dashboard-stack" });
            const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, notification.source === "logical-day" ? "Day flow" : notification.source, notification.tone);
            copy.createEl("strong", { text: notification.title });
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: notification.description });
            const actions2 = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
            if (notification.action) {
              createButton(actions2, notification.action.label, async () => this.handleNotificationAction(notification), false, "arrow-right-circle");
            }
            if (notification.dismissible) {
              createButton(actions2, "Dismiss", async () => this.dismissNotification(notification.id), false, "x");
            }
          });
        }
      }
      const heroFooter = hero.createDiv({ cls: "daily-dashboard-hero-footer" });
      const heroMeta = heroFooter.createDiv({ cls: "daily-dashboard-hero-status-row" });
      const datePill = createStatPill(heroMeta, todayEntry.date, "calendar-days", "date");
      datePill.addClass("is-compact");
      const archivedPill = createStatPill(heroMeta, `${todayEntry.completedTasks.length} archived`, "archive", "done");
      archivedPill.addClass("is-compact");
      const stalePill = createStatPill(heroMeta, `${staleProjectCount} stale`, "triangle-alert", staleProjectCount > 0 ? "alert" : "neutral");
      stalePill.addClass("is-compact");
      const statePill = createStatPill(
        heroMeta,
        `Mood ${latestMoodCheckIn ? `${latestMoodCheckIn.score}/5${latestMoodCheckIn.feeling ? ` ${latestMoodCheckIn.feeling}` : ""}` : renderScore(todayEntry.moodScore)} \u2022 Energy ${latestEnergyCheckIn ? `${latestEnergyCheckIn.score}/5` : renderScore(todayEntry.energyScore)}`,
        "activity",
        "state"
      );
      statePill.addClass("is-compact");
      if (hiddenLayoutCardCount > 0) {
        const hiddenPill = createStatPill(heroMeta, `${hiddenLayoutCardCount} hidden`, "layout-dashboard", "log");
        hiddenPill.addClass("is-compact");
      }
      const utilityActions = heroFooter.createDiv({ cls: "daily-dashboard-hero-utility-actions" });
      createIconButton(utilityActions, viewModeMeta.icon, `View mode ${viewModeMeta.label}. Switch to ${viewModeMeta.nextLabel}.`, async () => this.cycleViewMode());
      createIconButton(utilityActions, "keyboard", "Show dashboard keyboard shortcuts", async () => {
        this.openShortcutHelpFlow();
      });
      createIconButton(utilityActions, "sliders-horizontal", "Customize dashboard layout", async () => {
        this.openLayoutCustomizationFlow();
      });
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "bar-chart-3", "Weekly report", async () => this.plugin.generateWeeklyReport());
      createIconButton(utilityActions, "line-chart", "Monthly report", async () => this.plugin.generateMonthlyReport());
      createIconButton(utilityActions, "trophy", "Gamification report", async () => this.plugin.generateGamificationReport());
      createIconButton(utilityActions, "refresh-cw", "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));
      const latestUndoAction = (_j = this.pendingUndoActions[this.pendingUndoActions.length - 1]) != null ? _j : null;
      if (latestUndoAction && settings.showUndoNotifications) {
        const undoBanner = page.createDiv({ cls: "daily-dashboard-undo-banner" });
        const undoCopy = undoBanner.createDiv({ cls: "daily-dashboard-stack" });
        undoCopy.createEl("strong", { text: "Undo last dashboard action" });
        undoCopy.createEl("span", { cls: "daily-dashboard-row-meta", text: latestUndoAction.label });
        if (this.pendingUndoActions.length > 1) {
          undoCopy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `${this.pendingUndoActions.length - 1} earlier undo action${this.pendingUndoActions.length - 1 === 1 ? "" : "s"} still available.`
          });
        }
        const undoActions = undoBanner.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(undoActions, "Undo", async () => this.undoPendingAction(), true, "rotate-ccw");
        createButton(undoActions, "Dismiss", async () => this.dismissPendingUndo(), false, "x");
      }
      const grid = page.createDiv({ cls: "daily-dashboard-grid" });
      const createGridCard = (title, description, options) => this.registerGridCard(
        createCard(grid, title, description, options),
        title,
        gridCardBindings,
        layoutByKey
      );
      const weekBoardCard = createGridCard("Week At A Glance", "See the week as stacked tracked time instead of relying on memory and rough impressions.", {
        icon: "calendar-range",
        eyebrow: "Week",
        tone: "health",
        tag: "Visual"
      });
      const weekBoard = weekBoardCard.createDiv({ cls: "daily-dashboard-week-strip" });
      const weekStage = weekBoard.createDiv({ cls: "daily-dashboard-week-stage" });
      weekStage.createDiv({ cls: "daily-dashboard-week-platform" });
      const weekBars = weekStage.createDiv({ cls: "daily-dashboard-week-bars" });
      this.getCurrentWeekTimeBoard().forEach((day) => {
        const column = weekBars.createDiv({ cls: "daily-dashboard-week-column" });
        if (day.isToday) {
          column.addClass("is-today");
        }
        if (day.isActiveLogicalDay) {
          column.addClass("is-active-logical-day");
          column.createDiv({ cls: "daily-dashboard-week-active-indicator", text: "Active" });
        }
        const cylinder = column.createDiv({ cls: "daily-dashboard-week-cylinder" });
        WEEK_AT_A_GLANCE_SEGMENTS.forEach((segment) => {
          var _a2;
          this.renderWeekBarSegment(cylinder, segment.kind, (_a2 = day.minutesByKind[segment.kind]) != null ? _a2 : 0);
        });
        cylinder.createDiv({ cls: "daily-dashboard-week-cylinder-overlay" });
        const labels = column.createDiv({ cls: "daily-dashboard-week-labels" });
        labels.createEl("strong", { text: day.label.toUpperCase() });
        labels.createEl("span", { text: `${Number.parseInt(day.date.slice(-2), 10)}` });
      });
      const weekLegend = weekBoardCard.createDiv({ cls: "daily-dashboard-week-legend" });
      WEEK_AT_A_GLANCE_SEGMENTS.forEach((segment) => {
        this.renderWeekLegendItem(weekLegend, segment.label, segment.kind);
      });
      const weeklyAgendaCard = createGridCard("Weekly Agenda", "See the actual week load instead of guessing from one day at a time.", {
        icon: "calendar-days",
        eyebrow: "Planning",
        tone: "capture",
        tag: weeklyAgenda.reduce((sum, day) => sum + day.events.length, 0) > 0 ? "Live" : "Clear"
      });
      const weeklyAgendaSummary = weeklyAgendaCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(weeklyAgendaSummary, `${weeklyAgenda.reduce((sum, day) => sum + day.events.length, 0)} events`, weeklyAgenda.some((day) => day.events.length > 0) ? "capture" : "neutral");
      createSemanticChip(weeklyAgendaSummary, `${weeklyAgenda.filter((day) => day.events.length > 0).length} busy days`, weeklyAgenda.filter((day) => day.events.length > 0).length >= 4 ? "alert" : "neutral");
      const weeklyAgendaList = weeklyAgendaCard.createDiv({ cls: "daily-dashboard-project-list" });
      weeklyAgenda.forEach((day) => {
        const row = weeklyAgendaList.createDiv({ cls: "daily-dashboard-project-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-stack" });
        const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
        createSemanticChip(chipRow, day.shortLabel, day.isToday ? "focus" : "neutral");
        createSemanticChip(chipRow, day.events.length > 0 ? `${day.events.length} item${day.events.length === 1 ? "" : "s"}` : "Open", day.events.length > 0 ? "capture" : "done");
        copy.createEl("strong", { text: day.label });
        if (day.events.length === 0) {
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: "No calendar blocks or reminders on this day yet." });
        } else {
          day.events.slice(0, 3).forEach((event) => {
            copy.createEl("span", {
              cls: "daily-dashboard-row-meta",
              text: `${event.allDay ? event.date === event.endDate ? "All day" : `${event.date} -> ${event.endDate} all day` : event.date === event.endDate ? `${event.startTime}${event.endTime ? `-${event.endTime}` : ""}` : `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`} \u2022 ${event.title}${event.projectName ? ` \u2022 ${event.projectName}` : ""}${event.notes ? ` \u2022 ${event.notes}` : ""}`
            });
          });
          if (day.events.length > 3) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `+${day.events.length - 3} more item${day.events.length - 3 === 1 ? "" : "s"}` });
          }
        }
        const actions2 = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(actions2, "Add", async () => {
          new CalendarEventModal(this.app, this.plugin, day.date).open();
        }, false, "plus-circle");
      });
      const dayState = this.plugin.getDayState();
      const logicalDayInsights = this.plugin.getLogicalDayInsights();
      const sleepInsights = this.plugin.getSleepInsights();
      const aiStatus = this.plugin.getAiStatus();
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const trackedRelaxMinutes = this.plugin.getTrackedRelaxMinutes(todayEntry);
      const trackedBreakMinutes = this.plugin.getTrackedBreakMinutes(todayEntry);
      const trackedPoopMinutes = this.plugin.getTrackedPoopMinutes(todayEntry);
      const trackedActivityMinutes = this.plugin.getTrackedActivityMinutes(todayEntry);
      const trackedPoopCount = this.plugin.getTrackedPoopCount(todayEntry);
      const activeWorkSession = (_k = todayEntry.workSessions.find((session) => session.end === null)) != null ? _k : null;
      const activeNapSession = (_l = todayEntry.napSessions.find((session) => session.end === null)) != null ? _l : null;
      const activeRelaxSession = (_m = todayEntry.relaxSessions.find((session) => session.end === null)) != null ? _m : null;
      const activeBreakSession = (_n = todayEntry.breakSessions.find((session) => session.end === null)) != null ? _n : null;
      const activePoopSession = (_o = todayEntry.poopSessions.find((session) => session.end === null)) != null ? _o : null;
      const activeActivitySession = this.plugin.getActiveActivitySession(void 0, todayEntry);
      const activeModeLabel = activePoopSession ? "Pooping" : activeBreakSession ? "On break" : activeNapSession ? "Napping" : activeWorkSession ? "Working" : activeRelaxSession ? "Relaxing" : activeActivitySession ? activeActivitySession.label : dayState.status === "in-progress" ? "Idle" : "Offline";
      const dayToggleLabel = dayState.status === "in-progress" ? "End day" : "Begin day";
      const dayToggleIcon = dayState.status === "in-progress" ? "moon-star" : "sunrise";
      const dayToggleAction = dayState.status === "in-progress" ? async () => this.plugin.endLogicalDay() : async () => this.plugin.beginLogicalDay();
      const sessionDeckCard = createCard(page, "Session Deck", "Keep timers visible and one click away so session tracking stays practical during the day.", {
        icon: "timer-reset",
        eyebrow: "Live",
        tone: "capture",
        tag: activeModeLabel
      });
      const sessionDeckSummary = sessionDeckCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(sessionDeckSummary, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(sessionDeckSummary, activeModeLabel, activeActivitySession ? (_q = (_p = DASHBOARD_ACTIVITY_TRACKERS.find((item) => item.kind === activeActivitySession.kind)) == null ? void 0 : _p.tone) != null ? _q : "neutral" : activePoopSession ? "log" : activeBreakSession ? "alert" : activeWorkSession ? "capture" : activeNapSession ? "alert" : activeRelaxSession ? "health" : "neutral");
      createSemanticChip(sessionDeckSummary, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(sessionDeckSummary, logicalDayInsights.isRollover ? "Past midnight" : "Same calendar day", logicalDayInsights.isRollover ? "alert" : "neutral");
      createSemanticChip(
        sessionDeckSummary,
        logicalDayInsights.hasActiveSession ? "Session active" : logicalDayInsights.inactiveMinutes !== null ? `Inactive ${formatMinutesAsHours(logicalDayInsights.inactiveMinutes)}` : "No activity yet",
        logicalDayInsights.hasActiveSession ? "capture" : logicalDayInsights.inactiveMinutes !== null && logicalDayInsights.inactiveMinutes >= 120 ? "alert" : "neutral"
      );
      createSemanticChip(sessionDeckSummary, `Tracked ${formatMinutesAsHours(trackedWorkMinutes + trackedNapMinutes + trackedRelaxMinutes + trackedBreakMinutes + trackedPoopMinutes + trackedActivityMinutes)}`, "capture");
      const sessionDeckToolbar = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const sessionProjectSelect = sessionDeckToolbar.createEl("select", { cls: "daily-dashboard-input" });
      const emptyProjectOption = sessionProjectSelect.createEl("option", { text: "Work project" });
      emptyProjectOption.value = "";
      projects.forEach((project) => {
        const option = sessionProjectSelect.createEl("option", { text: project.name });
        option.value = project.name;
      });
      if (!projects.some((project) => project.name === this.selectedSessionProjectName)) {
        this.selectedSessionProjectName = "";
      }
      sessionProjectSelect.value = this.selectedSessionProjectName;
      sessionProjectSelect.addEventListener("change", () => {
        this.selectedSessionProjectName = sessionProjectSelect.value;
      });
      const sessionDeckActions = sessionDeckToolbar.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(sessionDeckActions, dayToggleLabel, dayToggleAction, dayState.status !== "in-progress", dayToggleIcon);
      createButton(sessionDeckActions, "Pause into break", async () => this.plugin.pauseAllAndStartBreak(), false, "pause");
      const sessionDeckGrid = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-deck-grid" });
      const createSessionDeckButton = (label, detail, icon, tone, isActive, onClick) => {
        const button = sessionDeckGrid.createEl("button", { cls: "daily-dashboard-session-button" });
        button.type = "button";
        button.toggleClass("is-active", isActive);
        button.addClass(`is-${tone}`);
        const iconEl = button.createSpan({ cls: "daily-dashboard-session-button-icon" });
        (0, import_obsidian3.setIcon)(iconEl, icon);
        const copy = button.createSpan({ cls: "daily-dashboard-session-button-copy" });
        copy.createEl("strong", { text: label });
        copy.createEl("span", { cls: "daily-dashboard-row-meta", text: detail });
        button.addEventListener("click", () => {
          void onClick();
        });
      };
      createSessionDeckButton(activeWorkSession ? "Stop Work" : "Start Work", activeWorkSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${formatMinutesAsHours(trackedWorkMinutes)} today${this.selectedSessionProjectName ? ` \u2022 ${this.selectedSessionProjectName}` : ""}`, activeWorkSession ? "square" : "play", "capture", Boolean(activeWorkSession), async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession("", this.selectedSessionProjectName));
      createSessionDeckButton(activeNapSession ? "Stop Nap" : "Start Nap", activeNapSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${formatMinutesAsHours(trackedNapMinutes)} today`, activeNapSession ? "alarm-clock-off" : "bed-single", "alert", Boolean(activeNapSession), async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(""));
      createSessionDeckButton(activeRelaxSession ? "Stop Relax" : "Start Relax", activeRelaxSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeRelaxSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${formatMinutesAsHours(trackedRelaxMinutes)} today`, activeRelaxSession ? "square" : "coffee", "health", Boolean(activeRelaxSession), async () => activeRelaxSession ? this.plugin.stopRelaxSession() : this.plugin.startRelaxSession(""));
      createSessionDeckButton(activeBreakSession ? "Stop Break" : "Start Break", activeBreakSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeBreakSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${formatMinutesAsHours(trackedBreakMinutes)} today`, activeBreakSession ? "square" : "pause", "alert", Boolean(activeBreakSession), async () => activeBreakSession ? this.plugin.stopBreakSession() : this.plugin.startBreakSession(""));
      createSessionDeckButton(activePoopSession ? "Stop Poop" : "Start Poop", activePoopSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${trackedPoopCount}x \u2022 ${formatMinutesAsHours(trackedPoopMinutes)}`, activePoopSession ? "square" : "bath", "log", Boolean(activePoopSession), async () => activePoopSession ? this.plugin.stopPoopSession() : this.plugin.startPoopSession(""));
      DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
        const activeTrackerSession = (activeActivitySession == null ? void 0 : activeActivitySession.kind) === tracker.kind ? activeActivitySession : null;
        createSessionDeckButton(activeTrackerSession ? `Stop ${tracker.label}` : `Start ${tracker.label}`, activeTrackerSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeTrackerSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : `${formatMinutesAsHours(this.plugin.getTrackedActivityMinutes(todayEntry, tracker.kind))} today`, activeTrackerSession ? "square" : tracker.icon, tracker.tone, Boolean(activeTrackerSession), async () => activeTrackerSession ? this.plugin.stopActivitySession(tracker.kind) : this.plugin.startActivitySession(tracker.kind));
      });
      const focusCard = createGridCard("Execution Hub", "Run today from one place: active focus, queued work, routine cues, suggestions, and calendar context.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const routineSection = this.createCollapsibleSubsection(focusCard, "focus-routines", "Routine cues", "Keep active or upcoming routine windows beside the rest of the execution stack.");
      const routineTemplates = this.plugin.getRoutineTemplates();
      const dismissedRoutineIds = getDismissedRoutineState(todayEntry.date);
      const currentMinutes = getClockMinutes(/* @__PURE__ */ new Date());
      const visibleRoutines = routineTemplates.filter((template) => !dismissedRoutineIds.has(template.id));
      const pendingRoutines = visibleRoutines.map((template) => ({
        template,
        startMinutes: getClockMinutes(template.startTime),
        endMinutes: getClockMinutes(template.endTime)
      })).filter(({ endMinutes }) => currentMinutes <= endMinutes).sort((left, right) => left.startMinutes - right.startMinutes);
      if (pendingRoutines.length === 0) {
        routineSection.createDiv({ cls: "daily-dashboard-row-meta", text: visibleRoutines.length === 0 ? "No routine templates left for this day. Add definitions in settings or clear daily dismissals tomorrow." : "No active or upcoming routine windows left for today." });
      } else {
        const routineList = routineSection.createDiv({ cls: "daily-dashboard-project-list" });
        pendingRoutines.forEach(({ template, startMinutes, endMinutes }) => {
          const isActiveWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
          const isUpcoming = currentMinutes < startMinutes;
          const row = routineList.createDiv({ cls: "daily-dashboard-project-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, `${template.startTime}-${template.endTime}`, isActiveWindow ? "focus" : isUpcoming ? "neutral" : "done");
          createSemanticChip(chipRow, isActiveWindow ? "Due now" : isUpcoming ? "Later today" : "Window passed", isActiveWindow ? "alert" : isUpcoming ? "neutral" : "done");
          row.createEl("strong", { text: template.label });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: isActiveWindow ? "Inside the active time window." : isUpcoming ? `Starts in ${formatMinutesAsHours(Math.max(0, startMinutes - currentMinutes))}.` : "Still available as a reference, but the target window has already passed." });
          const actions2 = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(actions2, "Queue next up", async () => this.plugin.addNextUpFocusItem({ text: template.label }), false, "plus-circle");
          createButton(actions2, "Done today", async () => {
            setDismissedRoutine(todayEntry.date, template.id);
            await this.render();
          }, false, "check");
        });
      }
      const dismissedReminderIds = getDismissedReminderState(todayEntry.date);
      const focusDisplayItems = this.plugin.getFocusDisplayItems(calendarSnapshot).filter((item) => item.kind !== "reminder" || !dismissedReminderIds.has(item.id));
      const activeFocusCount = todayEntry.todayFocus.filter((item) => item.status !== "done").length;
      if (suggestedTop3.length > 0) {
        const suggestedSection = this.createCollapsibleSubsection(focusCard, "focus-suggestions", "Suggested Top 3", "Generate today from calendar commitments, stale projects, and due work instead of staring at a blank list.");
        const suggestionActions = suggestedSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(suggestionActions, "Use best fit", async () => {
          const openSlots = Math.max(0, 3 - activeFocusCount);
          for (const candidate of suggestedTop3.slice(0, openSlots)) {
            await this.plugin.addTodayFocusItemWithDetails({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
          }
          await this.render();
        }, activeFocusCount >= 3, "sparkles");
        const suggestionList = suggestedSection.createDiv({ cls: "daily-dashboard-project-list" });
        suggestedTop3.forEach((candidate) => {
          const row = suggestionList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, this.getSuggestedTop3SourceLabel(candidate), this.getSuggestedTop3Tone(candidate));
          if (candidate.estimateMinutes) {
            createSemanticChip(chipRow, formatMinutesAsHours(candidate.estimateMinutes), "neutral");
          }
          copy.createEl("strong", { text: candidate.text });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: candidate.reason });
          if (candidate.notes) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: candidate.notes });
          }
          const controls = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(controls, "Top 3", async () => {
            await this.plugin.addTodayFocusItemWithDetails({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
            await this.render();
          }, activeFocusCount >= 3, "plus-circle");
          createButton(controls, "Next Up", async () => {
            await this.plugin.addNextUpFocusItem({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
            await this.render();
          }, false, "list-plus");
          createButton(controls, "Block", async () => {
            var _a2;
            await this.plugin.addFocusBlockToCalendar({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes,
              date: (_a2 = candidate.calendarDate) != null ? _a2 : todayEntry.date
            });
            await this.render();
          }, false, "calendar-plus");
        });
      }
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      focusCard.createEl("span", { cls: "daily-dashboard-row-meta", text: "Drag Top 3 rows to reprioritize them without deleting and recreating items." });
      if (focusDisplayItems.length === 0) {
        const emptyState = focusList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No focus items yet. Pull one from a project or let AI draft your starting plan." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "AI morning brief", async () => this.plugin.generateAiMorningStartupBrief(), false, "sparkles");
      } else {
        focusDisplayItems.forEach((item) => {
          const row = focusList.createDiv({ cls: `daily-dashboard-focus-row is-${item.status}` });
          if (item.kind === "reminder") {
            row.addClass("is-reminder");
            if (item.warningLevel) {
              row.addClass(`is-${item.warningLevel}`);
            }
          }
          const copy = row.createDiv({ cls: "daily-dashboard-focus-copy" });
          const isEditingFocus = item.kind === "focus" && this.editingFocusIndex === todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
          if (isEditingFocus) {
            const editInput = copy.createEl("input", {
              cls: "daily-dashboard-input",
              attr: { type: "text", placeholder: "Edit focus item" }
            });
            editInput.value = this.editingFocusText;
            editInput.addEventListener("input", () => {
              this.editingFocusText = editInput.value;
            });
            editInput.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const focusIndex = todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
                if (focusIndex >= 0) {
                  void this.plugin.updateTodayFocusItem(focusIndex, this.editingFocusText).then((saved) => {
                    if (!saved) {
                      return;
                    }
                    this.stopEditingFocusItem();
                    void this.render();
                  });
                }
              }
            });
            window.setTimeout(() => editInput.focus(), 0);
          } else {
            copy.createEl("strong", { text: item.text });
            copy.createEl("span", {
              cls: "daily-dashboard-habit-meta",
              text: this.getFocusDisplayMeta(item)
            });
            if (item.notes) {
              copy.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: item.notes
              });
            }
          }
          const controls = row.createDiv({ cls: "daily-dashboard-focus-controls" });
          if (item.kind === "focus") {
            const focusIndex = todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
            if (focusIndex < 0) {
              return;
            }
            if (!isEditingFocus) {
              row.draggable = true;
              row.addClass("is-draggable");
              row.addEventListener("dragstart", (event) => {
                this.draggedFocusIndex = focusIndex;
                row.addClass("is-dragging");
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `${focusIndex}`);
                }
              });
              row.addEventListener("dragover", (event) => {
                if (this.draggedFocusIndex === null || this.draggedFocusIndex === focusIndex) {
                  return;
                }
                event.preventDefault();
                row.addClass("is-drop-target");
              });
              row.addEventListener("dragleave", () => {
                row.removeClass("is-drop-target");
              });
              row.addEventListener("drop", (event) => {
                event.preventDefault();
                row.removeClass("is-drop-target");
                const draggedIndex = this.draggedFocusIndex;
                this.draggedFocusIndex = null;
                if (draggedIndex === null || draggedIndex === focusIndex) {
                  return;
                }
                void this.plugin.reorderTodayFocusItems(draggedIndex, focusIndex).then(async (changed) => {
                  if (changed) {
                    await this.render();
                  }
                });
              });
              row.addEventListener("dragend", () => {
                this.draggedFocusIndex = null;
                row.removeClass("is-dragging");
                row.removeClass("is-drop-target");
              });
            }
            if (isEditingFocus) {
              createButton(controls, "Save", async () => {
                const saved = await this.plugin.updateTodayFocusItem(focusIndex, this.editingFocusText);
                if (!saved) {
                  return;
                }
                this.stopEditingFocusItem();
                await this.render();
              }, true, "check");
              createButton(controls, "Cancel", async () => {
                this.stopEditingFocusItem();
                await this.render();
              }, false, "x");
            } else if (item.status === "done") {
              createButton(controls, "Reopen", async () => this.plugin.reopenTodayFocusItem(focusIndex), false, "rotate-ccw");
            } else if (item.isActive) {
              createButton(controls, "Pause", async () => this.plugin.stopTodayFocusItem(focusIndex), false, "pause");
            } else {
              const relatedProjectName = item.projectName || this.selectedSessionProjectName;
              createButton(controls, `Start${relatedProjectName ? ` \u2022 ${relatedProjectName}` : ""}`, async () => this.plugin.startTodayFocusItem(focusIndex, "", relatedProjectName), false, "play");
            }
            if (!isEditingFocus) {
              createButton(controls, "Details", async () => {
                var _a2, _b2;
                new FocusCaptureModal(this.app, {
                  mode: "edit",
                  todayHasTop3Capacity: true,
                  availableProjectNames: projects.map((project) => project.name),
                  initialText: item.text,
                  initialProjectName: item.projectName,
                  initialNotes: (_a2 = item.notes) != null ? _a2 : "",
                  initialEstimateMinutes: (_b2 = item.estimateMinutes) != null ? _b2 : null,
                  initialDestination: "top3",
                  onSubmit: async (payload) => {
                    const saved = await this.plugin.updateTodayFocusDetails(focusIndex, payload);
                    if (saved) {
                      await this.render();
                    }
                  }
                }).open();
              }, false, "notebook-pen");
              createButton(controls, "Block", async () => {
                await this.plugin.addFocusBlockToCalendar({
                  text: item.text,
                  notes: item.notes,
                  estimateMinutes: item.estimateMinutes,
                  date: todayEntry.date
                });
                await this.render();
              }, item.status === "done", "calendar-plus");
              createButton(controls, "Edit", async () => {
                this.startEditingFocusItem(focusIndex, item.text);
                await this.render();
              }, false, "pencil");
              createButton(controls, "Done", async () => this.plugin.completeTodayFocusItem(focusIndex), item.status === "done", "check");
              const removeButton = controls.createEl("button", { cls: "daily-dashboard-remove-button" });
              removeButton.type = "button";
              removeButton.ariaLabel = `Remove focus item ${item.text}`;
              removeButton.title = `Remove ${item.text}`;
              (0, import_obsidian3.setIcon)(removeButton, "x");
              removeButton.addEventListener("click", () => {
                const removedItem = cloneTodayFocusItem(item);
                void this.runDestructiveAction(
                  `Removed Top 3 item "${item.text}".`,
                  async () => this.plugin.removeTodayFocusItem(focusIndex),
                  async () => this.plugin.restoreTodayFocusItem(removedItem, focusIndex)
                );
              });
            }
          } else {
            createButton(controls, "Accept", async () => {
              await this.plugin.addTodayFocusItem(item.text);
              clearDismissedReminder(todayEntry.date, item.id);
              await this.render();
            }, true, "plus-circle");
            createButton(controls, "Dismiss", async () => {
              setDismissedReminder(todayEntry.date, item.id);
              await this.render();
            }, false, "bell-off");
            createButton(controls, "Calendar", async () => {
              var _a2, _b2;
              new CalendarEventModal(this.app, this.plugin, (_a2 = item.calendarDate) != null ? _a2 : todayEntry.date, (_b2 = item.sourceEventId) != null ? _b2 : null).open();
            }, false, "calendar-days");
          }
        });
      }
      const focusAddRow = focusCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const focusInput = focusAddRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a focus item" }
      });
      const focusProjectSelect = focusAddRow.createEl("select", { cls: "daily-dashboard-input" });
      const focusNoProjectOption = focusProjectSelect.createEl("option", { text: "No project" });
      focusNoProjectOption.value = "";
      projects.forEach((project) => {
        const option = focusProjectSelect.createEl("option", { text: project.name });
        option.value = project.name;
      });
      focusProjectSelect.value = this.selectedFocusProjectName;
      focusProjectSelect.addEventListener("change", () => {
        this.selectedFocusProjectName = focusProjectSelect.value;
      });
      const focusButton = focusAddRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      focusButton.type = "button";
      const submitFocus = async () => {
        const value = focusInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addTodayFocusItemWithDetails({ text: value, projectName: this.selectedFocusProjectName });
        focusInput.value = "";
      };
      focusInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitFocus();
        }
      });
      focusButton.addEventListener("click", () => {
        void submitFocus();
      });
      const focusUtilityActions = focusCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(focusUtilityActions, "Quick capture", async () => this.plugin.openQuickCaptureFocusFlow(), false, "rocket");
      createButton(focusUtilityActions, "Pause all -> break", async () => this.plugin.pauseAllAndStartBreak(), false, "pause-circle");
      const focusCalendarSection = this.createCollapsibleSubsection(focusCard, "focus-calendar", "Calendar", "Keep the monthly planner nearby without making Execution too tall.");
      const carryForwardCandidates = this.plugin.getCarryForwardFocusCandidates(todayEntry.date);
      if (carryForwardCandidates.length > 0) {
        const carryForwardSection = this.createCollapsibleSubsection(focusCard, "focus-carry-forward", "Carry forward", "Bring unfinished Top 3 items from the previous logical day into today only when you want them.");
        const carryForwardMeta = carryForwardSection.createDiv({ cls: "daily-dashboard-row-meta" });
        carryForwardMeta.setText(carryForwardCandidates.join(" \u2022 "));
        const carryForwardActions = carryForwardSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(carryForwardActions, "Carry unfinished", async () => {
          await this.plugin.carryForwardUnfinishedFocusItems();
          await this.render();
        }, false, "arrow-down-to-line");
      }
      const nextUpItems = this.plugin.getNextUpFocusItems(todayEntry.date);
      const nextUpSection = this.createCollapsibleSubsection(focusCard, "focus-next-up", "Next Up", "Keep overflow queued without overfilling the Top 3.");
      if (nextUpItems.length === 0) {
        nextUpSection.createDiv({
          cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
          text: "No queued follow-up items yet."
        });
      } else {
        const nextUpList = nextUpSection.createDiv({ cls: "daily-dashboard-focus-list" });
        nextUpItems.forEach((item, index) => {
          const row = nextUpList.createDiv({ cls: "daily-dashboard-focus-row is-pending" });
          const copy = row.createDiv({ cls: "daily-dashboard-focus-copy" });
          copy.createEl("strong", { text: item.text });
          copy.createEl("span", {
            cls: "daily-dashboard-habit-meta",
            text: [
              item.projectName ? `Project ${item.projectName}` : "No project",
              item.estimateMinutes ? `Estimate ${formatMinutesAsHours(item.estimateMinutes)}` : "No estimate",
              item.notes ? "Queued note" : "Queued"
            ].join(" \u2022 ")
          });
          if (item.notes) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.notes });
          }
          const controls = row.createDiv({ cls: "daily-dashboard-focus-controls" });
          createButton(controls, "Promote", async () => {
            const promoted = await this.plugin.promoteNextUpFocusItem(index);
            if (promoted) {
              await this.render();
            }
          }, false, "arrow-up-circle");
          createButton(controls, "Block", async () => {
            await this.plugin.addFocusBlockToCalendar({
              text: item.text,
              notes: item.notes,
              estimateMinutes: item.estimateMinutes,
              date: todayEntry.date
            });
            await this.render();
          }, false, "calendar-plus");
          createButton(controls, "Edit", async () => {
            new FocusCaptureModal(this.app, {
              mode: "capture",
              todayHasTop3Capacity: true,
              availableProjectNames: projects.map((project) => project.name),
              initialText: item.text,
              initialProjectName: item.projectName,
              initialNotes: item.notes,
              initialEstimateMinutes: item.estimateMinutes,
              initialDestination: "next-up",
              submitLabel: "Save queued item",
              onSubmit: async (payload) => {
                await this.plugin.removeNextUpFocusItem(index);
                await this.plugin.addNextUpFocusItem(payload);
                await this.render();
              }
            }).open();
          }, false, "pencil");
          createButton(controls, "Remove", async () => {
            const removedItem = cloneNextUpFocusItem(item);
            await this.runDestructiveAction(
              `Removed queued item "${item.text}".`,
              async () => this.plugin.removeNextUpFocusItem(index),
              async () => this.plugin.restoreNextUpFocusItem(removedItem, index)
            );
          }, false, "x");
        });
      }
      const nextUpActions = nextUpSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(nextUpActions, "Add next up", async () => {
        new FocusCaptureModal(this.app, {
          mode: "capture",
          todayHasTop3Capacity: true,
          availableProjectNames: projects.map((project) => project.name),
          initialDestination: "next-up",
          submitLabel: "Queue item",
          onSubmit: async (payload) => {
            await this.plugin.addNextUpFocusItem(payload);
            await this.render();
          }
        }).open();
      }, false, "list-plus");
      this.renderMonthlyCalendar(focusCalendarSection, todayEntry.date, settings.calendarEnabled);
      const stateCard = createGridCard("Vitals", "Log mood, energy, symptoms, and friction while the day is still readable.", {
        icon: "activity",
        eyebrow: "State",
        tone: "state",
        tag: "Context"
      });
      const moodTimelineSection = this.createCollapsibleSubsection(stateCard, "state-mood-timeline", "Mood timeline", "Track mood as it changes through the day and label the feeling instead of relying on one final score.");
      const moodSummary = moodTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(moodSummary, todayEntry.moodCheckIns.length > 0 ? `${todayEntry.moodCheckIns.length} check-ins` : "No check-ins", todayEntry.moodCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(moodSummary, moodCheckInAverage ? `Avg ${moodCheckInAverage}/5` : "No average yet", moodCheckInAverage ? "health" : "neutral");
      createSemanticChip(moodSummary, (latestMoodCheckIn == null ? void 0 : latestMoodCheckIn.feeling) ? latestMoodCheckIn.feeling : "No feeling logged", (latestMoodCheckIn == null ? void 0 : latestMoodCheckIn.feeling) ? "focus" : "neutral");
      const moodInputRow = moodTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--state-checkin" });
      const moodFeelingInput = moodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Feeling label, e.g. calm, flat, wired" }
      });
      const moodNoteInput = moodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note for this mood check-in" }
      });
      const moodButtons = moodTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = moodButtons.createEl("button", { cls: "daily-dashboard-step", text: `${score}` });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addMoodCheckIn(score, moodFeelingInput.value, moodNoteInput.value).then(async () => {
            moodFeelingInput.value = "";
            moodNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.moodCheckIns.length === 0) {
        moodTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: todayEntry.moodScore > 0 ? `Legacy mood summary: ${todayEntry.moodScore}/5. Start timeline check-ins to replace single-score tracking.` : "No mood timeline yet. Use a feeling label and a 1-5 score to log how the day actually felt." });
      } else {
        const moodList = moodTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.moodCheckIns.slice(0, 6).forEach((item, index) => {
          const row = moodList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 mood${item.feeling ? ` \u2022 ${item.feeling}` : ""}` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeMoodCheckIn(index);
          });
        });
      }
      const energyTimelineSection = this.createCollapsibleSubsection(stateCard, "state-energy-timeline", "Energy timeline", "Drop quick energy check-ins through the day instead of relying on one end-of-day memory.");
      const energySummary = energyTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(energySummary, todayEntry.energyCheckIns.length > 0 ? `${todayEntry.energyCheckIns.length} check-ins` : "No check-ins", todayEntry.energyCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(energySummary, energyCheckInAverage ? `Avg ${energyCheckInAverage}/5` : "No average yet", energyCheckInAverage ? "health" : "neutral");
      createSemanticChip(energySummary, latestEnergyCheckIn ? `Latest ${latestEnergyCheckIn.score}/5` : "No latest yet", latestEnergyCheckIn ? "focus" : "neutral");
      const energyInputRow = energyTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--energy" });
      const energyNoteInput = energyInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note for this check-in" }
      });
      const energyButtons = energyTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = energyButtons.createEl("button", {
          cls: "daily-dashboard-step",
          text: `${score}`
        });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addEnergyCheckIn(score, energyNoteInput.value).then(async () => {
            energyNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.energyCheckIns.length === 0) {
        energyTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No energy timeline yet. Use the 1-5 buttons to log the current state with an optional note." });
      } else {
        const energyList = energyTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.energyCheckIns.slice(0, 6).forEach((item, index) => {
          const row = energyList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 energy` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeEnergyCheckIn(index);
          });
        });
      }
      const anxietyTimelineSection = this.createCollapsibleSubsection(stateCard, "state-anxiety-timeline", "Anxiety timeline", "Log anxiety spikes or calm resets as they happen instead of compressing the whole day into one number.");
      const anxietySummary = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(anxietySummary, todayEntry.anxietyCheckIns.length > 0 ? `${todayEntry.anxietyCheckIns.length} check-ins` : "No check-ins", todayEntry.anxietyCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(anxietySummary, anxietyCheckInAverage ? `Avg ${anxietyCheckInAverage}/5` : "No average yet", anxietyCheckInAverage ? "alert" : "neutral");
      createSemanticChip(anxietySummary, latestAnxietyCheckIn ? `Latest ${latestAnxietyCheckIn.score}/5` : "No latest yet", latestAnxietyCheckIn ? "alert" : "neutral");
      const anxietyInputRow = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--energy" });
      const anxietyNoteInput = anxietyInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note about what is driving this level" }
      });
      const anxietyButtons = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = anxietyButtons.createEl("button", { cls: "daily-dashboard-step", text: `${score}` });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addAnxietyCheckIn(score, anxietyNoteInput.value).then(async () => {
            anxietyNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.anxietyCheckIns.length === 0) {
        anxietyTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: todayEntry.anxietyScore > 0 ? `Legacy anxiety summary: ${todayEntry.anxietyScore}/5. Start timeline check-ins to replace single-score tracking.` : "No anxiety timeline yet. Use the 1-5 buttons with an optional note when anxiety changes." });
      } else {
        const anxietyList = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.anxietyCheckIns.slice(0, 6).forEach((item, index) => {
          const row = anxietyList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 anxiety` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeAnxietyCheckIn(index);
          });
        });
      }
      const symptomsSection = this.createCollapsibleSubsection(stateCard, "state-symptoms", "Symptoms", "Track pain, symptoms, and likely triggers before the context gets flattened later.");
      const symptomSummary = symptomsSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(symptomSummary, todayEntry.symptomLog.length > 0 ? `${todayEntry.symptomLog.length} logged` : "No symptoms", todayEntry.symptomLog.length > 0 ? "health" : "neutral");
      createSemanticChip(symptomSummary, todayEntry.symptomLog[0] ? `${todayEntry.symptomLog[0].severity}/5 latest` : "No severity yet", todayEntry.symptomLog[0] ? "alert" : "neutral");
      const symptomForm = symptomsSection.createDiv({ cls: "daily-dashboard-stacked-form" });
      const symptomInput = symptomForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Headache, nausea, back pain..." } });
      const symptomMeta = symptomForm.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
      const symptomSeverity = symptomMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", max: "5", value: "3" } });
      const symptomNote = symptomMeta.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional trigger or context" } });
      const symptomButtons = symptomsSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(symptomButtons, "Log symptom", async () => {
        await this.plugin.addSymptomEntry(symptomInput.value, Number(symptomSeverity.value), symptomNote.value);
        symptomInput.value = "";
        symptomSeverity.value = "3";
        symptomNote.value = "";
      }, false, "heart-pulse");
      const symptomList = symptomsSection.createDiv({ cls: "daily-dashboard-project-list" });
      if (todayEntry.symptomLog.length === 0) {
        symptomList.createDiv({ cls: "daily-dashboard-empty-state", text: "No symptoms or pain logged today." });
      } else {
        todayEntry.symptomLog.slice(0, 10).forEach((item, index) => {
          const row = symptomList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `${item.symptom} \u2022 ${item.severity}/5` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: `${item.loggedAt}${item.note ? ` \u2022 ${item.note}` : ""}` });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            const removedItem = { ...item };
            void this.runDestructiveAction(
              `Removed symptom entry "${item.symptom}".`,
              async () => this.plugin.removeSymptomEntry(index),
              async () => this.plugin.restoreSymptomEntry(removedItem, index)
            );
          });
        });
      }
      const bowelSection = this.createCollapsibleSubsection(stateCard, "state-bowel", "Bowel tracking", "Keep bowel sessions, duration, and quality tags with the rest of the body-state logging.");
      const bowelSummary = bowelSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(bowelSummary, `${trackedPoopCount} session${trackedPoopCount === 1 ? "" : "s"}`, trackedPoopCount > 0 ? "alert" : "neutral");
      createSemanticChip(bowelSummary, `Tracked ${formatMinutesAsHours(trackedPoopMinutes)}`, trackedPoopMinutes > 0 ? "alert" : "neutral");
      createSemanticChip(bowelSummary, activePoopSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : "No live session", activePoopSession ? "alert" : "neutral");
      if (todayEntry.poopSessions.length === 0) {
        bowelSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No bowel sessions tracked for this logical day yet." });
      } else {
        const bowelQualityList = bowelSection.createDiv({ cls: "daily-dashboard-project-list" });
        todayEntry.poopSessions.slice().reverse().slice(0, 5).forEach((session) => {
          const row = bowelQualityList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `Bowel session ${session.start.slice(11, 16)}${session.end ? `-${session.end.slice(11, 16)}` : ""}` });
          row.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Duration ${session.end ? formatMinutesAsHours(getMinutesBetween(session.start, session.end)) : "In progress"} \u2022 Quality: ${todayEntry.poopQualityByStart[session.start] || "Not tagged"}`
          });
          const controls = row.createDiv({ cls: "daily-dashboard-habit-controls" });
          ["easy", "normal", "strained", "urgent", "loose"].forEach((quality) => {
            const button = controls.createEl("button", {
              cls: todayEntry.poopQualityByStart[session.start] === quality ? "daily-dashboard-step is-active" : "daily-dashboard-step",
              text: quality
            });
            button.type = "button";
            button.addEventListener("click", () => {
              void this.plugin.updatePoopQuality(session.start, todayEntry.poopQualityByStart[session.start] === quality ? "" : quality);
            });
          });
        });
      }
      stateCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Friction log" });
      const frictionInput = stateCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      frictionInput.value = todayEntry.frictionLog;
      frictionInput.placeholder = "Blockers, pain points, context switching, or anything that made the day harder.";
      frictionInput.addEventListener("change", () => {
        void this.plugin.updateFrictionLog(frictionInput.value);
      });
      const gamificationCard = createGridCard("Gamification Center", "Turn execution, health, consistency, recovery, and planning into auditable scores instead of vague impressions.", {
        icon: "trophy",
        eyebrow: "Scores",
        tone: "done",
        tag: gamificationSummary.model === "deterministic" ? "Deterministic" : "Scored"
      });
      const gamificationSummaryRow = gamificationCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(gamificationSummaryRow, `Today ${gamificationSummary.today.score}/100 ${gamificationSummary.today.grade}`, gamificationSummary.today.score >= 80 ? "done" : gamificationSummary.today.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Week ${gamificationSummary.week.score}/100 ${gamificationSummary.week.grade}`, gamificationSummary.week.score >= 80 ? "done" : gamificationSummary.week.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Month ${gamificationSummary.month.score}/100 ${gamificationSummary.month.grade}`, gamificationSummary.month.score >= 80 ? "done" : gamificationSummary.month.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Streak ${gamificationSummary.currentStreak}`, gamificationSummary.currentStreak >= 3 ? "focus" : "neutral");
      createSemanticChip(gamificationSummaryRow, `Best ${gamificationSummary.bestStreak}`, gamificationSummary.bestStreak >= 5 ? "done" : "neutral");
      const gamificationStats = gamificationCard.createDiv({ cls: "daily-dashboard-dayflow-grid daily-dashboard-dayflow-grid--recovery" });
      this.renderDayMetric(gamificationStats, "Personal best", `${gamificationSummary.personalBestDayScore}/100`);
      this.renderDayMetric(gamificationStats, "Best day", gamificationSummary.personalBestDayLabel);
      this.renderDayMetric(gamificationStats, "Recovery run", `${gamificationSummary.recoveryFromLowScoreDays} days`);
      this.renderDayMetric(gamificationStats, "Low-score line", `${gamificationSummary.lowScoreThreshold}/100`);
      const gamificationSnapshots = gamificationCard.createDiv({ cls: "daily-dashboard-gamification-snapshots" });
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.today);
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.week);
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.month);
      const gamificationActions = gamificationCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(gamificationActions, "Gamification report", async () => this.plugin.generateGamificationReport(), false, "trophy");
      createButton(gamificationActions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");
      const habitsCard = createGridCard("Habits", "Repeatables with misses and timing kept visible.", {
        icon: "check-square",
        eyebrow: "Routines",
        tone: "state",
        tag: "Track"
      });
      const habitActions = habitsCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(habitActions, "Add habit", async () => this.plugin.openAddHabitFlow(), false, "plus-circle");
      const habitSummary = getHabitWeightedCompletion(todayEntry, this.plugin.getHabitDefinitions());
      const habitSummaryChips = habitsCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(habitSummaryChips, `${habitSummary.percentage}% weighted completion`, habitSummary.percentage >= 80 ? "done" : habitSummary.percentage >= 55 ? "state" : "alert");
      createSemanticChip(habitSummaryChips, `${todayEntry.missedHabits.length} misses`, todayEntry.missedHabits.length === 0 ? "done" : "alert");
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit, habitIndex) => {
        var _a2, _b2, _c2, _d2;
        const currentValue = (_a2 = todayEntry.habits[habit.id]) != null ? _a2 : 0;
        const habitEvents = (_b2 = todayEntry.habitEvents[habit.id]) != null ? _b2 : [];
        const inWindowCount = countHabitEventsInWindow(habitEvents, habit.completionWindow);
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done \u2022 ${this.plugin.getHabitStreak(habit.id)} due-day streak \u2022 best ${this.plugin.getHabitBestStreak(habit.id)} \u2022 ${formatHabitCadenceLabel(habit.cadence)} \u2022 ${formatHabitWindowLabel(habit.completionWindow)} \u2022 difficulty ${habit.difficultyWeight}/3${isHabitDueOnDate(habit, todayEntry.date) ? "" : " \u2022 not due today"}`
        });
        if (habitEvents.length > 0) {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Today at ${habitEvents.map((item) => item.slice(11)).join(", ")} \u2022 in-window ${inWindowCount}/${habitEvents.length}`
          });
        } else {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `${formatHabitCadenceLabel(habit.cadence)} \u2022 Window ${formatHabitWindowLabel(habit.completionWindow)} \u2022 no completions yet${isHabitDueOnDate(habit, todayEntry.date) ? "" : " \u2022 not due today"}`
          });
        }
        const controls = row.createDiv({ cls: "daily-dashboard-habit-controls" });
        for (let index = 1; index <= habit.target; index += 1) {
          const stepButton = controls.createEl("button", {
            cls: index <= currentValue ? "daily-dashboard-step is-active" : "daily-dashboard-step",
            text: `${index}`
          });
          stepButton.type = "button";
          stepButton.addEventListener("click", () => {
            const nextValue = currentValue === index ? index - 1 : index;
            void this.plugin.updateHabitValue(habit.id, nextValue);
          });
        }
        const removeButton = controls.createEl("button", { cls: "daily-dashboard-remove-button" });
        removeButton.type = "button";
        removeButton.ariaLabel = `Remove habit ${habit.label}`;
        removeButton.title = `Remove ${habit.label}`;
        (0, import_obsidian3.setIcon)(removeButton, "x");
        removeButton.addEventListener("click", () => {
          const removedHabit = { ...habit };
          if (this.plugin.getHabitDefinitions().length <= 1) {
            void this.plugin.removeHabitDefinition(habit.id);
            return;
          }
          void this.runDestructiveAction(
            `Removed habit "${habit.label}".`,
            async () => this.plugin.removeHabitDefinition(habit.id),
            async () => this.plugin.restoreHabitDefinition(removedHabit, habitIndex)
          );
        });
        if (currentValue < habit.target || ((_c2 = todayEntry.habitMissNotes[habit.id]) != null ? _c2 : "").length > 0) {
          const missNote = row.createEl("input", {
            cls: "daily-dashboard-input",
            attr: { type: "text", placeholder: `Miss note for ${habit.label}` }
          });
          missNote.value = (_d2 = todayEntry.habitMissNotes[habit.id]) != null ? _d2 : "";
          missNote.addEventListener("change", () => {
            void this.plugin.updateHabitMissNote(habit.id, missNote.value);
          });
        }
      });
      const foodCard = createGridCard("Consumables", "Track drinks, food, medication, and supplements in one place with usable amounts and timestamps.", {
        icon: "utensils-crossed",
        eyebrow: "Body",
        tone: "log",
        tag: "Log"
      });
      const measurementSystem = settings.measurementSystem;
      const intakeEntries = todayEntry.intakeLog;
      const consumableSummary = Array.from(
        intakeEntries.reduce((groups, item) => {
          var _a2;
          const key = `${item.kind}::${item.label.toLowerCase()}::${item.unit.toLowerCase()}`;
          const current = (_a2 = groups.get(key)) != null ? _a2 : { ...item, totalAmount: 0, count: 0 };
          current.totalAmount += item.amount;
          current.count += 1;
          current.loggedAt = current.loggedAt > item.loggedAt ? current.loggedAt : item.loggedAt;
          groups.set(key, current);
          return groups;
        }, /* @__PURE__ */ new Map()).values()
      );
      const intakeForm = foodCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const intakeKind = intakeForm.createEl("select", { cls: "daily-dashboard-input" });
      [["drink", "Drink"], ["food", "Food"], ["medication", "Medication"], ["supplement", "Supplement"]].forEach(([value, label]) => {
        const option = intakeKind.createEl("option", { text: label });
        option.value = value;
      });
      const intakeLabel = intakeForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "What did you have?" } });
      const intakeMeta = intakeForm.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
      const intakeAmount = intakeMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0.1", step: "0.1", value: "1" } });
      const intakeUnit = intakeMeta.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "mL, can, slice, pill, serving" } });
      const syncDefaultIntakeUnit = () => {
        const defaultUnit = getDefaultIntakeUnit(intakeKind.value, measurementSystem);
        intakeUnit.value = defaultUnit;
        intakeUnit.dataset.defaultUnit = defaultUnit;
      };
      const getResolvedIntakeUnit = () => {
        return resolveIntakeUnitValue(intakeUnit.value || intakeUnit.dataset.defaultUnit || "", intakeKind.value, measurementSystem);
      };
      syncDefaultIntakeUnit();
      intakeKind.addEventListener("change", () => {
        syncDefaultIntakeUnit();
      });
      const intakeNote = intakeForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional note" } });
      const intakeButtons = foodCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(intakeButtons, "Add entry", async () => {
        const resolvedUnit = getResolvedIntakeUnit();
        await this.plugin.addIntakeEntry(intakeKind.value, intakeLabel.value, Number(intakeAmount.value), resolvedUnit, intakeNote.value);
        intakeLabel.value = "";
        intakeAmount.value = "1";
        syncDefaultIntakeUnit();
        intakeNote.value = "";
      }, false, "plus-circle");
      createButton(intakeButtons, aiStatus.busy ? "Analyzing..." : "Analyze diet", async () => this.plugin.generateDailyDietInsight(), true, "sparkles");
      createButton(intakeButtons, "Save preset", async () => {
        const trimmedLabel = intakeLabel.value.trim();
        const trimmedUnit = getResolvedIntakeUnit();
        if (!trimmedLabel || !trimmedUnit) {
          return;
        }
        const nextPreset = buildIntakeQuickPreset({
          kind: intakeKind.value,
          label: trimmedLabel,
          amount: Number(intakeAmount.value),
          unit: trimmedUnit
        });
        const nextPresets = [...settings.intakeQuickPresets.filter((preset) => preset.id !== nextPreset.id), nextPreset];
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          intakeQuickPresets: nextPresets
        });
        await this.render();
      }, false, "bookmark-plus");
      const foodInsight = foodCard.createDiv({ cls: "daily-dashboard-row-meta" });
      foodInsight.setText(todayEntry.dietInsight || "Run Analyze diet when you want a quick AI pass on calories and nutrition signals for today.");
      if (settings.intakeQuickPresets.length > 0) {
        const intakePresetSection = this.createCollapsibleSubsection(foodCard, "consumables-presets", "Presets", "Keep one-tap consumables nearby without leaving them expanded all the time.");
        const intakePresetRow = intakePresetSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-intake-presets" });
        settings.intakeQuickPresets.forEach((preset) => {
          const presetWrap = intakePresetRow.createDiv({ cls: "daily-dashboard-inline-action-pair" });
          createButton(presetWrap, formatIntakeQuickPresetButtonLabel(preset), async () => {
            await this.plugin.addIntakeEntry(preset.kind, preset.label, preset.amount, preset.unit);
          }, false, getIntakePresetIcon(preset.kind));
          const removeButton = presetWrap.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-inline-remove-button daily-dashboard-consumable-remove-button" });
          removeButton.type = "button";
          removeButton.ariaLabel = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          removeButton.title = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          removeButton.setText("\xD7");
          removeButton.addEventListener("click", () => {
            void this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              intakeQuickPresets: this.plugin.getSettings().intakeQuickPresets.filter((item) => item.id !== preset.id)
            }).then(async () => this.render());
          });
        });
      }
      const intakeLogSection = this.createCollapsibleSubsection(foodCard, "consumables-entry-log", "Entry log", "Review, edit, and remove the consumables already logged for today.");
      const intakeList = intakeLogSection.createDiv({ cls: "daily-dashboard-food-list" });
      if (intakeEntries.length === 0) {
        const emptyState = intakeList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No consumables logged yet today. Use one flow for drinks, food, meds, and supplements so totals stay analyzable." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Water", async () => this.plugin.addIntakeEntry("drink", "Water", measurementSystem === "metric" ? 250 : 8, getDefaultIntakeUnit("drink", measurementSystem)), false, "glass-water");
        createButton(emptyActions, "Meal", async () => this.plugin.addIntakeEntry("food", "Meal", 1, "serving"), false, "utensils-crossed");
        createButton(emptyActions, "Medication", async () => this.plugin.addIntakeEntry("medication", "Medication", 1, "pill"), false, "pill");
      } else {
        intakeEntries.slice(0, 18).forEach((item, index) => {
          const row = intakeList.createDiv({ cls: "daily-dashboard-food-row" });
          row.addClass("daily-dashboard-food-row--compact");
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.kind} \u2022 ${item.label}` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `${item.amount} ${item.unit} \u2022 ${item.loggedAt || "Time unknown"}${item.note ? ` \u2022 ${item.note}` : ""}` });
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          const amountInput = amountSlot.createEl("input", {
            cls: "daily-dashboard-amount-input",
            attr: { type: "number", min: "0.1", step: "0.1", value: `${item.amount}`, ariaLabel: `Amount for ${item.label}` }
          });
          amountInput.addEventListener("change", () => {
            void this.plugin.updateIntakeEntryAmount(index, Number(amountInput.value));
          });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-consumable-remove-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          removeButton.setText("\xD7");
          removeButton.addEventListener("click", () => {
            const removedItem = { ...item };
            void this.runDestructiveAction(
              `Removed ${item.kind} entry "${item.label}".`,
              async () => this.plugin.removeIntakeEntry(index),
              async () => this.plugin.restoreIntakeEntry(removedItem, index)
            );
          });
        });
      }
      const weightUnitLabel = settings.measurementSystem === "metric" ? "kg" : "lb";
      const weightHistory = this.plugin.getAllEntries().filter((entry) => typeof entry.bodyWeight === "number");
      const latestLoggedWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].bodyWeight : null;
      const earliestWeightForTrend = weightHistory.length > 1 ? weightHistory[Math.max(0, weightHistory.length - 7)].bodyWeight : null;
      const currentWeight = (_r = todayEntry.bodyWeight) != null ? _r : latestLoggedWeight;
      const targetWeight = settings.weightGoalTarget > 0 ? settings.weightGoalTarget : null;
      const weightDelta = currentWeight !== null && targetWeight !== null ? Number((targetWeight - currentWeight).toFixed(1)) : null;
      const weightTrendDelta = currentWeight !== null && earliestWeightForTrend !== null ? Number((currentWeight - earliestWeightForTrend).toFixed(1)) : null;
      const todayExerciseMinutes = todayEntry.exerciseLog.reduce((sum, item) => sum + item.durationMinutes, 0) + this.plugin.getTrackedActivityMinutes(todayEntry, "exercise");
      const latestExerciseSession = this.plugin.getActiveActivitySession("exercise", todayEntry);
      const exerciseSuggestions = [];
      if (todayExerciseMinutes > 0 && todayEntry.intakeLog.filter((item) => item.kind === "drink").length === 0) {
        exerciseSuggestions.push("Hydration is missing relative to today's training load.");
      }
      if (todayExerciseMinutes >= 45 && todayEntry.intakeLog.filter((item) => item.kind === "food").length === 0) {
        exerciseSuggestions.push("No recovery meal is logged after a meaningful training block.");
      }
      if (todayExerciseMinutes >= 30 && sleepInsights.debtMinutes >= 180) {
        exerciseSuggestions.push("Sleep debt is high, so recovery work matters more than adding intensity.");
      }
      if (todayExerciseMinutes >= 30 && getHabitWeightedCompletion(todayEntry, this.plugin.getHabitDefinitions()).percentage < 55) {
        exerciseSuggestions.push("Training happened, but the rest of the habit stack is lagging behind recovery-wise.");
      }
      if (weightDelta !== null) {
        if (settings.weightGoalMode === "lose" && weightDelta < 0) {
          exerciseSuggestions.push(`You are ${Math.abs(weightDelta)} ${weightUnitLabel} above the target. Favor consistent training plus logged intake over bigger swings.`);
        } else if (settings.weightGoalMode === "gain" && weightDelta > 0) {
          exerciseSuggestions.push(`You are ${weightDelta} ${weightUnitLabel} below the target. Recovery meals and consistent lifting matter more than random volume.`);
        } else if (settings.weightGoalMode === "maintain" && Math.abs(weightDelta) >= 3) {
          exerciseSuggestions.push(`Weight is drifting ${Math.abs(weightDelta)} ${weightUnitLabel} away from the maintenance target.`);
        }
      }
      const exerciseCard = createGridCard("Exercise & Weight", "Keep training organized and line it up with body-weight goals, recovery, and intake signals.", {
        icon: "dumbbell",
        eyebrow: "Training",
        tone: "health",
        tag: latestExerciseSession ? "Live" : "Recovery"
      });
      const exerciseSummary = exerciseCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(exerciseSummary, `${formatMinutesAsHours(todayExerciseMinutes)} today`, todayExerciseMinutes >= 30 ? "done" : todayExerciseMinutes > 0 ? "health" : "neutral");
      createSemanticChip(exerciseSummary, currentWeight !== null ? `${currentWeight} ${weightUnitLabel}` : "No weight logged", currentWeight !== null ? "focus" : "neutral");
      createSemanticChip(exerciseSummary, targetWeight !== null ? `${settings.weightGoalMode} to ${targetWeight} ${weightUnitLabel}` : "No target", targetWeight !== null ? "capture" : "neutral");
      createSemanticChip(exerciseSummary, weightTrendDelta !== null ? `${weightTrendDelta > 0 ? "+" : ""}${weightTrendDelta} ${weightUnitLabel} / 7 entries` : "No trend yet", weightTrendDelta !== null ? "log" : "neutral");
      const exerciseGoalForm = exerciseCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const exerciseGoalRow = exerciseGoalForm.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const bodyWeightInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", step: "0.1", placeholder: `Today's ${weightUnitLabel}` } });
      bodyWeightInput.value = todayEntry.bodyWeight !== null ? `${todayEntry.bodyWeight}` : "";
      const targetWeightInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0", step: "0.1", placeholder: `Target ${weightUnitLabel}` } });
      targetWeightInput.value = targetWeight !== null ? `${targetWeight}` : "";
      const goalModeSelect = exerciseGoalRow.createEl("select", { cls: "daily-dashboard-input" });
      [["lose", "Lose"], ["maintain", "Maintain"], ["gain", "Gain"]].forEach(([value, label]) => {
        const option = goalModeSelect.createEl("option", { text: label });
        option.value = value;
      });
      goalModeSelect.value = settings.weightGoalMode;
      const weeklyRateInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0", step: "0.1", placeholder: `Weekly ${weightUnitLabel}` } });
      weeklyRateInput.value = `${settings.weightGoalWeeklyRate}`;
      const goalActions = exerciseCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(goalActions, "Save weight goal", async () => {
        await this.plugin.updateBodyWeight(bodyWeightInput.value.trim().length > 0 ? Number(bodyWeightInput.value) : null);
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weightGoalTarget: Number(targetWeightInput.value || 0),
          weightGoalMode: goalModeSelect.value === "lose" || goalModeSelect.value === "gain" ? goalModeSelect.value : "maintain",
          weightGoalWeeklyRate: Number(weeklyRateInput.value || DEFAULT_SETTINGS.weightGoalWeeklyRate)
        });
        await this.render();
      }, false, "scale");
      createButton(goalActions, latestExerciseSession ? "Stop live exercise" : "Start live exercise", async () => latestExerciseSession ? this.plugin.stopActivitySession("exercise") : this.plugin.startActivitySession("exercise"), latestExerciseSession !== null, latestExerciseSession ? "square" : "play");
      const exerciseForm = exerciseCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const exerciseLabelInput = exerciseForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Lift, run, walk, mobility, intervals..." } });
      const exerciseMeta = exerciseForm.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const exerciseDurationInput = exerciseMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", step: "5", value: latestExerciseSession ? `${Math.max(5, getMinutesBetween(latestExerciseSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : "30" } });
      const exerciseIntensitySelect = exerciseMeta.createEl("select", { cls: "daily-dashboard-input" });
      [["easy", "Easy"], ["moderate", "Moderate"], ["hard", "Hard"]].forEach(([value, label]) => {
        const option = exerciseIntensitySelect.createEl("option", { text: label });
        option.value = value;
      });
      const exerciseNoteInput = exerciseForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional note about focus, volume, pain, or effort" } });
      const exerciseActions = exerciseCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(exerciseActions, "Log exercise", async () => {
        var _a2;
        await this.plugin.addExerciseEntry(
          exerciseLabelInput.value,
          Number(exerciseDurationInput.value || 0),
          exerciseIntensitySelect.value === "easy" || exerciseIntensitySelect.value === "hard" ? exerciseIntensitySelect.value : "moderate",
          exerciseNoteInput.value,
          (_a2 = latestExerciseSession == null ? void 0 : latestExerciseSession.start) != null ? _a2 : ""
        );
        exerciseLabelInput.value = "";
        exerciseDurationInput.value = latestExerciseSession ? `${Math.max(5, getMinutesBetween(latestExerciseSession.start, formatDateTimeKey(/* @__PURE__ */ new Date())))}` : "30";
        exerciseIntensitySelect.value = "moderate";
        exerciseNoteInput.value = "";
      }, false, "plus-circle");
      const exerciseGuidance = exerciseCard.createDiv({ cls: "daily-dashboard-project-list" });
      if (exerciseSuggestions.length === 0) {
        exerciseGuidance.createDiv({ cls: "daily-dashboard-empty-state", text: "No immediate recovery warnings. Keep training and intake consistent enough to make the trend readable." });
      } else {
        exerciseSuggestions.forEach((item) => {
          const row = exerciseGuidance.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: item });
        });
      }
      const exerciseList = exerciseCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (todayEntry.exerciseLog.length === 0) {
        exerciseList.createDiv({ cls: "daily-dashboard-empty-state", text: "No exercise logged today." });
      } else {
        todayEntry.exerciseLog.slice(0, 10).forEach((item, index) => {
          const row = exerciseList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--compact" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: item.label });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `${formatMinutesAsHours(item.durationMinutes)} \u2022 ${item.intensity} \u2022 ${item.loggedAt}${item.note ? ` \u2022 ${item.note}` : ""}` });
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: item.linkedSessionStart ? "Timed" : "Manual" });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-consumable-remove-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          removeButton.setText("\xD7");
          removeButton.addEventListener("click", () => {
            void this.plugin.removeExerciseEntry(index);
          });
        });
      }
      const notesCard = createGridCard("Sleep And Notes", "Sleep, dreams, and daily notes in one recovery block.", {
        icon: "moon-star",
        eyebrow: "Recovery",
        tone: "log",
        tag: "Journal"
      });
      this.renderScoreControl(notesCard, "Wake quality", todayEntry.wakeQualityScore, (value) => this.plugin.updateWakeQualityScore(value));
      const recoverySection = this.createCollapsibleSubsection(notesCard, "sleep-recovery-summary", "Recovery summary", "Track whether sleep quantity and timing are holding steady over the last week.");
      const recoveryChips = recoverySection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Debt ${formatMinutesAsHours(sleepInsights.debtMinutes)}` : "No debt data", sleepInsights.debtMinutes >= 180 ? "alert" : sleepInsights.nightsTracked > 0 ? "health" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 ${sleepInsights.consistencyLabel}` : "No consistency data", sleepInsights.consistencyScore >= 70 ? "done" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Avg ${formatMinutesAsHours(sleepInsights.averageSleepMinutes)}` : "No average sleep yet", sleepInsights.averageSleepMinutes >= 420 ? "health" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Recovery ${sleepInsights.averageRecoveryScore}/100 ${sleepInsights.recoveryLabel}` : "No recovery data", sleepInsights.averageRecoveryScore >= 70 ? "done" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      const recoveryGrid = recoverySection.createDiv({ cls: "daily-dashboard-dayflow-grid daily-dashboard-dayflow-grid--recovery" });
      this.renderDayMetric(recoveryGrid, "Nights tracked", `${sleepInsights.nightsTracked}`);
      this.renderDayMetric(recoveryGrid, "Sleep target", formatMinutesAsHours(sleepInsights.targetMinutes));
      this.renderDayMetric(recoveryGrid, "Avg bedtime", sleepInsights.averageBedtime || "Not enough data");
      this.renderDayMetric(recoveryGrid, "Avg wake", sleepInsights.averageWakeTime || "Not enough data");
      this.renderDayMetric(recoveryGrid, "Avg recovery", sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100` : "No data");
      if (sleepInsights.recentNights.length > 0) {
        const recentNights = recoverySection.createDiv({ cls: "daily-dashboard-project-list" });
        sleepInsights.recentNights.slice().reverse().forEach((night) => {
          const row = recentNights.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `${night.date} \u2022 ${formatMinutesAsHours(night.sleepMinutes)}` });
          row.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Bed ${night.bedtime || "unknown"} \u2022 Wake ${night.wakeTime || "unknown"} \u2022 Wake quality ${night.wakeQualityScore > 0 ? `${night.wakeQualityScore}/5` : "not logged"} \u2022 Recovery ${night.recoveryScore}/100 ${night.recoveryLabel}`
          });
        });
      }
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Sleep log" });
      const sleepInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      sleepInput.value = todayEntry.sleepLog;
      sleepInput.placeholder = "Bedtime, wake time, sleep quality, naps, anything worth tracking.";
      this.initializePersistentTextarea(sleepInput, "sleep-log");
      sleepInput.addEventListener("change", () => {
        void this.plugin.updateSleepLog(sleepInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Dream log" });
      const dreamInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      dreamInput.value = todayEntry.dreamLog;
      dreamInput.placeholder = "Dream fragments, themes, symbols, emotions, or recurring patterns you want the AI to analyze later.";
      this.initializePersistentTextarea(dreamInput, "dream-log");
      dreamInput.addEventListener("change", () => {
        void this.plugin.updateDreamLog(dreamInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
      const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      notesInput.value = todayEntry.notes;
      notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
      this.initializePersistentTextarea(notesInput, "daily-notes");
      notesInput.addEventListener("change", () => {
        void this.plugin.updateDailyNotes(notesInput.value);
      });
      const adaptivePrompts = this.plugin.getAdaptiveReflectionPrompts(todayEntry.date);
      if (adaptivePrompts.length > 0) {
        notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Adaptive reflection prompts" });
        const promptList = notesCard.createDiv({ cls: "daily-dashboard-ai-suggestions" });
        adaptivePrompts.forEach((prompt) => {
          const row = promptList.createDiv({ cls: "daily-dashboard-project-row" });
          row.createEl("span", { text: prompt });
        });
      }
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "What helped today?" });
      const helpedInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      helpedInput.value = todayEntry.helpedToday;
      helpedInput.placeholder = "Small things that improved the day, energy, focus, or recovery.";
      this.initializePersistentTextarea(helpedInput, "helped-today");
      helpedInput.addEventListener("change", () => {
        void this.plugin.updateReflection("helped", helpedInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "What hurt today?" });
      const hurtInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      hurtInput.value = todayEntry.hurtToday;
      hurtInput.placeholder = "Stressors, pain, missed habits, interruptions, or anything that dragged the day down.";
      this.initializePersistentTextarea(hurtInput, "hurt-today");
      hurtInput.addEventListener("change", () => {
        void this.plugin.updateReflection("hurt", hurtInput.value);
      });
      const timelineCard = createGridCard("Timeline Search", "Search across tasks, sessions, logs, and calendar events from one place instead of hopping between cards.", {
        icon: "scan-search",
        eyebrow: "History",
        tone: "log",
        tag: `${timelineResults.length} matches`
      });
      const timelinePresetRow = timelineCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      const presetSelect = timelinePresetRow.createEl("select", { cls: "daily-dashboard-input" });
      const defaultPresetOption = presetSelect.createEl("option", { text: "Saved dashboard filters" });
      defaultPresetOption.value = "";
      savedDashboardFilters.forEach((filter) => {
        const option = presetSelect.createEl("option", { text: filter.name });
        option.value = filter.name;
        option.selected = filter.name === this.selectedSavedFilterName;
      });
      presetSelect.addEventListener("change", () => {
        if (!presetSelect.value) {
          this.selectedSavedFilterName = "";
          setDashboardSelectedFilterName("");
          return;
        }
        this.applySavedDashboardFilter(presetSelect.value);
        void this.render();
      });
      createButton(timelinePresetRow, "Save current", async () => {
        this.saveCurrentDashboardFilter();
        await this.render();
      }, false, "save");
      createButton(timelinePresetRow, "Delete saved", async () => {
        this.deleteSelectedDashboardFilter();
        await this.render();
      }, false, "trash-2");
      createButton(timelinePresetRow, "Reset", async () => {
        this.resetDashboardFilters();
        await this.render();
      }, false, "rotate-ccw");
      const timelineFilterGrid = timelineCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      this.createFilterInput(timelineFilterGrid, "Keyword", this.timelineFilters.keyword, (value) => {
        this.timelineFilters.keyword = value;
        void this.render();
      });
      const timelineProjectFilter = timelineFilterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allTimelineProjectsOption = timelineProjectFilter.createEl("option", { text: "All projects" });
      allTimelineProjectsOption.value = "";
      projects.forEach((project) => {
        const option = timelineProjectFilter.createEl("option", { text: project.name });
        option.value = project.name;
        option.selected = project.name === this.timelineFilters.project;
      });
      timelineProjectFilter.addEventListener("change", () => {
        this.timelineFilters.project = timelineProjectFilter.value;
        void this.render();
      });
      const timelineTagFilter = timelineFilterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allTimelineTagsOption = timelineTagFilter.createEl("option", { text: "All tags" });
      allTimelineTagsOption.value = "";
      SESSION_TAG_OPTIONS.forEach((tag) => {
        const option = timelineTagFilter.createEl("option", { text: tag });
        option.value = tag;
        option.selected = tag === this.timelineFilters.tag;
      });
      timelineTagFilter.addEventListener("change", () => {
        this.timelineFilters.tag = timelineTagFilter.value;
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "From date (YYYY-MM-DD)", this.timelineFilters.fromDate, (value) => {
        this.timelineFilters.fromDate = value;
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "To date (YYYY-MM-DD)", this.timelineFilters.toDate, (value) => {
        this.timelineFilters.toDate = value;
        void this.render();
      });
      const notesOnlyLabel = timelineFilterGrid.createEl("label", { cls: "daily-dashboard-row-meta" });
      const notesOnlyCheckbox = notesOnlyLabel.createEl("input", { attr: { type: "checkbox" } });
      notesOnlyCheckbox.checked = this.timelineFilters.onlyWithNotes;
      notesOnlyCheckbox.addEventListener("change", () => {
        this.timelineFilters.onlyWithNotes = notesOnlyCheckbox.checked;
        void this.render();
      });
      notesOnlyLabel.appendText(" Only show items with notes or descriptive detail");
      const timelineKindRow = timelineCard.createDiv({ cls: "daily-dashboard-chip-row" });
      [
        { key: "task", label: "Tasks" },
        { key: "session", label: "Sessions" },
        { key: "calendar", label: "Calendar" },
        { key: "log", label: "Logs" }
      ].forEach((item) => {
        const button = timelineKindRow.createEl("button", {
          cls: this.timelineFilters.kinds.includes(item.key) ? "daily-dashboard-filter-chip is-active" : "daily-dashboard-filter-chip",
          text: item.label
        });
        button.type = "button";
        button.addEventListener("click", () => {
          if (this.timelineFilters.kinds.includes(item.key)) {
            this.timelineFilters.kinds = this.timelineFilters.kinds.filter((candidate) => candidate !== item.key);
          } else {
            this.timelineFilters.kinds = [...this.timelineFilters.kinds, item.key];
          }
          if (this.timelineFilters.kinds.length === 0) {
            this.timelineFilters.kinds = ["task", "session", "calendar", "log"];
          }
          void this.render();
        });
      });
      const timelineSummary = timelineCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "task").length} tasks`, timelineResults.some((item) => item.kind === "task") ? "done" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "session").length} sessions`, timelineResults.some((item) => item.kind === "session") ? "capture" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "calendar").length} calendar`, timelineResults.some((item) => item.kind === "calendar") ? "focus" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "log").length} logs`, timelineResults.some((item) => item.kind === "log") ? "log" : "neutral");
      const timelineActions = timelineCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(timelineActions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");
      createButton(timelineActions, "Monthly report", async () => this.plugin.generateMonthlyReport(), false, "line-chart");
      const timelineList = timelineCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (timelineResults.length === 0) {
        timelineList.createDiv({ cls: "daily-dashboard-empty-state", text: "No timeline entries match the current filters." });
      } else {
        timelineResults.slice(0, 60).forEach((result) => {
          const row = timelineList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, result.kind, result.tone);
          createSemanticChip(chipRow, result.date, "log");
          if (result.project) {
            createSemanticChip(chipRow, result.project, "neutral");
          }
          if (result.tag) {
            createSemanticChip(chipRow, result.tag, this.getSessionTagTone(result.tag));
          }
          copy.createEl("strong", { text: result.title });
          copy.createEl("span", { text: result.summary });
          if (result.detail) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: result.detail });
          }
        });
      }
      const heatmapCard = createGridCard("Heatmaps", "See work, sleep, and habit density across recent days instead of inferring patterns from memory.", {
        icon: "layout-grid",
        eyebrow: "Patterns",
        tone: "capture",
        tag: "84 days"
      });
      const heatmapShell = heatmapCard.createDiv({ cls: "daily-dashboard-heatmap-stack" });
      this.renderHeatmapMetric(heatmapShell, "Work", "Tracked work minutes per day", this.buildHeatmapSeries("work"));
      this.renderHeatmapMetric(heatmapShell, "Sleep", "Tracked sleep minutes per day", this.buildHeatmapSeries("sleep"));
      this.renderHeatmapMetric(heatmapShell, "Habits", "Weighted habit completion percentage per day", this.buildHeatmapSeries("habits"));
      const aiCard = createGridCard("AI Workspace", "Plan, review, and ask grounded questions against your dashboard and vault without leaving the page.", {
        icon: "sparkles",
        eyebrow: "AI",
        tone: "capture",
        tag: aiStatus.busy ? "Running" : "Ready"
      });
      const aiShell = aiCard.createDiv({ cls: "daily-dashboard-ai-shell" });
      const aiChipRow = aiShell.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(aiChipRow, aiStatus.configured ? "API key configured" : "API key missing", aiStatus.configured ? "done" : "alert");
      createSemanticChip(aiChipRow, aiStatus.model || "No model", "neutral");
      createSemanticChip(aiChipRow, aiStatus.busy ? "Request in progress" : "Idle", aiStatus.busy ? "focus" : "neutral");
      createSemanticChip(aiChipRow, aiStatus.indexStatus.embeddingsEnabled ? `Embeddings ${aiStatus.indexStatus.embeddingModel}` : "Keyword retrieval", aiStatus.indexStatus.embeddingsEnabled ? "focus" : "neutral");
      const aiOverviewSection = this.createCollapsibleSubsection(aiShell, "ai-workspace-overview", "Plan and retrieve", "Workflow shortcuts and retrieval-index status for the current vault.");
      const aiOverview = aiOverviewSection.createDiv({ cls: "daily-dashboard-ai-overview" });
      const aiActionsPanel = aiOverview.createDiv({ cls: "daily-dashboard-ai-panel" });
      aiActionsPanel.createEl("strong", { text: "Workflows" });
      aiActionsPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Run focused planning, diagnostic, synthesis, and comparison workflows without leaving the dashboard." });
      const aiActions = aiActionsPanel.createDiv({ cls: "daily-dashboard-ai-action-grid" });
      createButton(aiActions, "Morning brief", async () => this.plugin.generateAiMorningStartupBrief(), false, "sunrise");
      createButton(aiActions, "Shutdown summary", async () => this.plugin.generateAiShutdownSummary(), false, "moon-star");
      createButton(aiActions, "Weekly planning", async () => this.plugin.generateAiWeeklyPlanningAssistant(), false, "bar-chart-3");
      createButton(aiActions, "Risk scan", async () => this.plugin.generateAiProjectRiskScanner(), false, "triangle-alert");
      createButton(aiActions, "Anomalies", async () => this.plugin.generateAiAnomalyDetectionReport(), false, "activity");
      createButton(aiActions, "Compare periods", async () => this.plugin.generateAiPeriodComparisonReport(), false, "git-compare-arrows");
      createButton(aiActions, "Project synthesis", async () => this.plugin.generateAiProjectSynthesis(), false, "network");
      createButton(aiActions, "Why felt off", async () => this.plugin.generateAiWhyTodayFeltOff(), false, "brain-circuit");
      createButton(aiActions, "Analyze active note", async () => this.plugin.generateAiActiveNoteAnalysis(), false, "file-search");
      createButton(aiActions, "Basic info", async () => this.plugin.openBasicInformationNote(), false, "id-card");
      const aiIndexPanel = aiOverview.createDiv({ cls: "daily-dashboard-ai-panel" });
      aiIndexPanel.createEl("strong", { text: "Retrieval Index" });
      aiIndexPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Cached note chunks that keep answers grounded without rescanning the vault on every request." });
      const aiIndexMetrics = aiIndexPanel.createDiv({ cls: "daily-dashboard-ai-metric-grid" });
      this.renderDayMetric(aiIndexMetrics, "Notes", `${aiStatus.indexStatus.indexedNotes}`);
      this.renderDayMetric(aiIndexMetrics, "Chunks", `${aiStatus.indexStatus.indexedChunks}`);
      const embeddingsMetric = this.renderDayMetric(aiIndexMetrics, "Embeddings", `${aiStatus.indexStatus.embeddedChunks}`);
      embeddingsMetric.addClass("daily-dashboard-ai-metric--wide");
      const aiIndexDetails = aiIndexPanel.createDiv({ cls: "daily-dashboard-ai-index-details" });
      const aiUpdatedRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
      aiUpdatedRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Updated" });
      aiUpdatedRow.createEl("strong", { text: formatSyncTimestamp(aiStatus.indexStatus.indexedAt).replace(" ", " \u2022 ") });
      if (aiStatus.indexStatus.lastIndexedFile) {
        const aiFileRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
        aiFileRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Last file" });
        aiFileRow.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.indexStatus.lastIndexedFile });
      }
      if (aiStatus.indexStatus.indexedFolders.length > 0) {
        const aiFoldersRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
        aiFoldersRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Folders" });
        aiFoldersRow.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.indexStatus.indexedFolders.join(" \u2022 ") });
      }
      const aiLowerSection = this.createCollapsibleSubsection(aiShell, "ai-workspace-ask", "Ask and latest output", "Direct questions plus the newest AI artifact and suggested focus items.");
      const aiLower = aiLowerSection.createDiv({ cls: "daily-dashboard-ai-lower" });
      const aiAskPanel = aiLower.createDiv({ cls: "daily-dashboard-ai-panel daily-dashboard-ai-panel--ask" });
      aiAskPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Ask AI about your vault" });
      const aiQuestion = aiAskPanel.createEl("textarea", { cls: "daily-dashboard-textarea daily-dashboard-ai-question" });
      aiQuestion.placeholder = "What needs attention first? Which project is dragging hardest? What am I underestimating right now?";
      aiQuestion.rows = 4;
      const aiQuestionActions = aiAskPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
      createButton(aiQuestionActions, "Ask AI", async () => this.plugin.askAiQuestion(aiQuestion.value), true, "message-square");
      createButton(aiQuestionActions, "Open ask modal", async () => this.plugin.openAskAiFlow(), false, "panel-top-open");
      createButton(aiQuestionActions, "Rebuild index", async () => this.plugin.rebuildAiNoteIndex(true), false, "database-zap");
      const latestPanel = aiLower.createDiv({ cls: "daily-dashboard-ai-panel daily-dashboard-ai-panel--latest" });
      latestPanel.createEl("strong", { text: "Latest output" });
      if (aiStatus.latestArtifact) {
        const latestArtifact = aiStatus.latestArtifact;
        const latest = latestPanel.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-ai-output" });
        latest.createEl("strong", { text: `${latestArtifact.kind} \u2022 ${latestArtifact.generatedAt}` });
        latest.createEl("span", { text: latestArtifact.summary || "AI note generated." });
        latest.createEl("span", { cls: "daily-dashboard-row-meta", text: latestArtifact.notePath });
        const latestActions = latestPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
        createButton(latestActions, "Open latest AI note", async () => this.plugin.openAiArtifact(latestArtifact), false, "file-text");
        if (latestArtifact.nextActions.length > 0) {
          latestPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Concrete actions" });
          const nextActionList = latestPanel.createDiv({ cls: "daily-dashboard-ai-suggestions" });
          latestArtifact.nextActions.forEach((item) => {
            const row = nextActionList.createDiv({ cls: "daily-dashboard-project-row" });
            row.createEl("span", { text: item });
          });
        }
        if (latestArtifact.suggestedFocus.length > 0) {
          latestPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Suggested focus items" });
          const suggestionList = latestPanel.createDiv({ cls: "daily-dashboard-ai-suggestions" });
          latestArtifact.suggestedFocus.forEach((item) => {
            const row = suggestionList.createDiv({ cls: "daily-dashboard-project-row" });
            row.createEl("span", { text: item });
            const addButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Add to Top 3" });
            addButton.type = "button";
            addButton.addEventListener("click", () => {
              void this.plugin.addTodayFocusItem(item);
            });
          });
        }
      } else {
        latestPanel.createDiv({ cls: "daily-dashboard-ai-empty-state", text: "No AI notes yet. Run a workflow or ask a question to create the first output." });
      }
      const projectsCard = createGridCard("Project Health", "Score projects by backlog, staleness, output, and momentum.", {
        icon: "shield-check",
        eyebrow: "Portfolio",
        tone: "health",
        tag: "Health"
      });
      const projectsExpanded = this.isSectionExpanded("project-health-details");
      const projectList = projectsCard.createDiv({ cls: "daily-dashboard-project-list" });
      if (!todoSnapshot || todoSnapshot.projects.length === 0) {
        projectList.createDiv({ cls: "daily-dashboard-empty-state", text: "No project data found in the configured master task hub." });
      } else {
        [...todoSnapshot.projects].sort((left, right) => {
          const recencyDelta = getProjectLastWorkedSortKey(right).localeCompare(getProjectLastWorkedSortKey(left));
          if (recencyDelta !== 0) {
            return recencyDelta;
          }
          return right.healthScore - left.healthScore;
        }).slice(0, projectsExpanded ? 10 : 6).forEach((project) => {
          var _a2;
          const row = projectList.createDiv({ cls: projectsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 75 ? "focus" : project.healthScore >= 50 ? "state" : "alert");
          createSemanticChip(chipRow, project.trend, project.trend === "up" ? "done" : project.trend === "down" ? "alert" : "neutral");
          createSemanticChip(chipRow, project.projectState === "active" ? "Active" : project.projectState === "incubating" ? "Incubating" : "Someday", project.projectState === "active" ? "neutral" : "log");
          row.createEl("strong", { text: `${project.name} \u2022 ${project.healthScore}` });
          row.createEl("span", { text: `${project.healthLabel} \u2022 ${project.openCount} open \u2022 ${project.completionsThisWeek} this week \u2022 ${project.completionsThisMonth} this month \u2022 ${project.trend} \u2022 ${project.status}` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Last worked: ${(_a2 = project.lastCompletedAt) != null ? _a2 : "No archived activity yet"}` });
          renderProjectMomentum(row, project);
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Next action: ${project.nextAction}` });
          if (projectsExpanded && project.healthReasons.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Why: ${project.healthReasons.join(" \u2022 ")}` });
          }
          if (projectsExpanded && project.overdueTasks.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue: ${project.overdueTasks.slice(0, 2).map((task) => task.text).join(" \u2022 ")}` });
          }
          if (projectsExpanded && project.dueSoonTasks.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Due soon: ${project.dueSoonTasks.slice(0, 2).map((task) => `${task.text} (${task.dueDate})`).join(" \u2022 ")}` });
          }
          if (projectsExpanded && project.blockedTasks.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" \u2022 ")}` });
          }
          if (projectsExpanded && project.staleDays !== null) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
          }
          if (projectsExpanded && project.focus) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Focus: ${project.focus}` });
          }
          if (projectsExpanded && project.relationships.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Relationships: ${project.relationships.join(", ")}` });
          }
        });
      }
      const projectActions = projectsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(projectActions, projectsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("project-health-details"), false, projectsExpanded ? "chevrons-up" : "chevrons-down");
      createButton(projectActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");
      const alertsCard = createGridCard("Stale Work And Cleanup", "Catch stale projects, vague tasks, duplicates, and empty sections.", {
        icon: "triangle-alert",
        eyebrow: "Triage",
        tone: "alert",
        tag: "Attention"
      });
      const alertsExpanded = this.isSectionExpanded("cleanup-details");
      const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
      const alertLines = [
        ...overdueTasks.slice(0, 5).map((item) => `Overdue: ${item.project} -> ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`),
        ...dueSoonTasks.slice(0, 5).map((item) => `Due soon: ${item.project} -> ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`),
        ...blockedTasks.slice(0, 5).map((item) => `Blocked: ${item.project} -> ${item.task.text}${item.task.blockedReason ? ` (${item.task.blockedReason})` : ""}`),
        ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
        ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`)
      ];
      if (alertLines.length === 0 && cleanupProjects.length === 0 && cleanupSuggestions.length === 0) {
        alertsList.createDiv({ cls: "daily-dashboard-empty-state", text: "No stale-work or cleanup issues detected right now." });
      } else {
        cleanupSuggestions.slice(0, alertsExpanded ? cleanupSuggestions.length : 3).forEach((item) => {
          const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, item.projectName, "neutral");
          createSemanticChip(chipRow, item.kind.replace(/-/g, " "), item.kind === "stale-project" || item.kind === "overdue-tasks" ? "alert" : "state");
          copy.createEl("strong", { text: item.summary });
          if (item.detail) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.detail });
          }
          const actions2 = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(actions2, item.actionLabel, async () => this.handleCleanupSuggestionAction(item.action), false, item.action === "open-cleanup-note" ? "sparkles" : "file-text");
          createButton(actions2, "Dismiss", async () => this.plugin.dismissCleanupSuggestion(item.id), false, "x");
        });
        if (alertsExpanded && cleanupProjects.length > 0) {
          cleanupProjects.sort((left, right) => getProjectIssueCount(right) - getProjectIssueCount(left)).slice(0, 10).forEach((project) => {
            const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
            const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, `${getProjectIssueCount(project)} issue${getProjectIssueCount(project) === 1 ? "" : "s"}`, getProjectIssueCount(project) >= 4 ? "alert" : "state");
            createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 50 ? "state" : "alert");
            createSemanticChip(chipRow, project.projectState === "active" ? "Active" : project.projectState === "incubating" ? "Incubating" : "Someday", project.projectState === "active" ? "neutral" : "log");
            row.createEl("strong", { text: project.name });
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Next action: ${project.nextAction}` });
            if (project.staleDays !== null) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
            }
            if (project.breakdownTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Needs breakdown: ${project.breakdownTasks.slice(0, 3).join(" \u2022 ")}` });
            }
            if (project.duplicateTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Duplicates: ${project.duplicateTasks.slice(0, 3).join(" \u2022 ")}` });
            }
            if (project.emptySections.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Empty sections: ${project.emptySections.join(" \u2022 ")}` });
            }
            if (project.overdueTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue: ${project.overdueTasks.slice(0, 2).map((task) => task.text).join(" \u2022 ")}` });
            }
            if (project.blockedTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" \u2022 ")}` });
            }
          });
        } else {
          alertLines.slice(0, alertsExpanded ? alertLines.length : 6).forEach((line) => {
            const row = alertsList.createDiv({ cls: alertsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
            row.createEl("span", { text: line });
          });
        }
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      if (alertLines.length > 6 || cleanupSuggestions.length > 3 || cleanupProjects.length > 0) {
        createButton(alertActions, alertsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("cleanup-details"), false, alertsExpanded ? "chevrons-up" : "chevrons-down");
      }
      createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions(), false, "sparkles");
      createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true), false, "move-right");
      this.applyGridLayout(grid, gridCardBindings, layoutByKey);
      this.lastRenderAt = Date.now();
    } catch (error) {
      console.error("Daily dashboard render failed", error);
      this.renderErrorState(error);
      this.lastRenderAt = Date.now();
    }
  }
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshHandle = window.setInterval(() => {
      void this.maybeAutoRefresh();
    }, _DailyDashboardView.AUTO_REFRESH_MS);
  }
  stopAutoRefresh() {
    if (this.autoRefreshHandle !== null) {
      window.clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }
  async maybeAutoRefresh() {
    if (!this.leaf || !this.contentEl.isConnected) {
      return;
    }
    if (Date.now() - this.lastRenderAt < _DailyDashboardView.AUTO_REFRESH_MS) {
      return;
    }
    await this.requestRefresh();
  }
  renderErrorState(error) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("daily-dashboard-view");
    const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
    const card = createCard(page, "Dashboard Failed To Render", "The dashboard hit a runtime error, so this fallback view is shown instead of a blank page.", {
      icon: "bug",
      eyebrow: "Fallback",
      tone: "alert",
      tag: "Error"
    });
    const message = error instanceof Error ? `${error.name}: ${error.message}` : `${error}`;
    card.createEl("p", { text: message || "Unknown error" });
    const actions = card.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(actions, "Open master todo", async () => this.plugin.openMasterTodo(), true, "file-text");
    createButton(actions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");
    createButton(actions, "Monthly report", async () => this.plugin.generateMonthlyReport(), false, "line-chart");
  }
  createFilterInput(parent, placeholder, value, onChange) {
    const input = parent.createEl("input", {
      cls: "daily-dashboard-input",
      attr: { type: "text", placeholder }
    });
    input.value = value;
    input.addEventListener("change", () => {
      onChange(input.value.trim());
    });
  }
  renderReminderBlock(parent, snapshot, lookaheadHours) {
    const block = parent.createDiv({ cls: "daily-dashboard-calendar-block" });
    const header = block.createDiv({ cls: "daily-dashboard-calendar-header" });
    header.createEl("strong", { text: "Upcoming reminders" });
    header.createEl("span", {
      cls: "daily-dashboard-row-meta",
      text: snapshot.enabled ? `Next ${lookaheadHours}h from your dashboard calendar` : "Enable calendar reminders in settings to surface upcoming events here."
    });
    if (!snapshot.enabled) {
      block.createDiv({
        cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
        text: "Calendar reminders are off. Turn them on in settings to push upcoming events into the Execution card."
      });
      return;
    }
    if (snapshot.reminders.length === 0) {
      block.createDiv({
        cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
        text: `No upcoming calendar reminders in the next ${lookaheadHours} hours.`
      });
      return;
    }
    const list = block.createDiv({ cls: "daily-dashboard-calendar-list" });
    snapshot.reminders.forEach((event) => {
      const row = list.createDiv({ cls: `daily-dashboard-calendar-row is-${event.warningLevel}` });
      const time = row.createDiv({ cls: "daily-dashboard-calendar-time" });
      time.createEl("strong", { text: this.formatCalendarDayLabel(new Date(event.start), event.allDay, new Date(event.end)) });
      time.createEl("span", { text: this.formatCalendarTimeLabel(new Date(event.start), new Date(event.end), event.allDay) });
      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [event.projectName || "", event.leadSummary, event.notes || (event.warningLevel === "warning" ? "Within warning window" : "Scheduled")].filter((value) => value.length > 0).join(" \u2022 ")
      });
      const chips = row.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(chips, event.warningLevel === "warning" ? "Soon" : "Later", event.warningLevel === "warning" ? "alert" : "neutral");
      if (event.leadSummary) {
        createSemanticChip(chips, event.leadSummary, "focus");
      }
      if (event.allDay) {
        createSemanticChip(chips, "All day", "log");
      }
    });
  }
  getFocusDisplayMeta(item) {
    if (item.kind === "reminder") {
      const timeLabel = item.calendarStart && item.calendarEnd ? this.formatCalendarTimeLabel(new Date(item.calendarStart), new Date(item.calendarEnd), Boolean(item.allDay)) : "Scheduled";
      return [
        item.warningLevel === "warning" ? "Upcoming soon" : "Reminder",
        timeLabel,
        item.calendarLeadSummary || "",
        item.calendarNotes || "From calendar"
      ].filter((value) => value.length > 0).join(" \u2022 ");
    }
    return [
      item.projectName ? `Project ${item.projectName}` : "No project",
      item.status === "done" ? "Done" : item.isActive ? "Working on" : "Queued",
      `${formatMinutesAsHours(item.trackedMinutes)} tracked`,
      item.completedAt ? `completed ${item.completedAt.slice(11)}` : ""
    ].filter((value) => value.length > 0).join(" \u2022 ");
  }
  getSuggestedTop3SourceLabel(candidate) {
    switch (candidate.source) {
      case "calendar":
        return "Calendar";
      case "overdue":
        return "Overdue";
      case "due-soon":
        return "Due soon";
      case "repeating":
        return "Repeating";
      case "stale":
        return "Stale work";
      default:
        return "Suggested";
    }
  }
  getSuggestedTop3Tone(candidate) {
    switch (candidate.source) {
      case "calendar":
        return "capture";
      case "overdue":
        return "alert";
      case "due-soon":
        return "focus";
      case "repeating":
        return "log";
      case "stale":
        return "health";
      default:
        return "neutral";
    }
  }
  renderMonthlyCalendar(parent, todayKey, remindersEnabled) {
    const shell = parent.createDiv({ cls: "daily-dashboard-calendar-panel" });
    const shellHeader = shell.createDiv({ cls: "daily-dashboard-calendar-panel-header" });
    shellHeader.createEl("strong", { text: "Calendar" });
    shellHeader.createEl("span", {
      cls: "daily-dashboard-row-meta",
      text: remindersEnabled ? "Auto-reminders above" : "Reminders off"
    });
    const header = shell.createDiv({ cls: "daily-dashboard-calendar-toolbar" });
    const currentMonth = new Date(this.calendarCursorDate.getFullYear(), this.calendarCursorDate.getMonth(), 1);
    const title = header.createDiv({ cls: "daily-dashboard-calendar-toolbar-copy" });
    title.createEl("strong", { text: currentMonth.toLocaleDateString([], { month: "long", year: "numeric" }) });
    const controls = header.createDiv({ cls: "daily-dashboard-calendar-nav" });
    createButton(controls, "Prev", async () => {
      this.calendarCursorDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      await this.render();
    }, false, "chevron-left");
    createButton(controls, "Today", async () => {
      this.calendarCursorDate = /* @__PURE__ */ new Date();
      this.selectedCalendarDate = todayKey;
      await this.render();
    }, false, "calendar-days");
    createButton(controls, "Next", async () => {
      this.calendarCursorDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      await this.render();
    }, false, "chevron-right");
    const weekHeader = shell.createDiv({ cls: "daily-dashboard-calendar-weekdays" });
    ["M", "T", "W", "T", "F", "S", "S"].forEach((label) => {
      weekHeader.createEl("span", { text: label });
    });
    const grid = shell.createDiv({ cls: "daily-dashboard-calendar-grid" });
    this.getCalendarMonthDays(currentMonth).forEach((date) => {
      const dateKey = formatDateKey(date);
      const events = this.plugin.getCalendarEventsForDate(dateKey);
      const cell = grid.createEl("button", { cls: "daily-dashboard-calendar-day" });
      cell.type = "button";
      if (date.getMonth() !== currentMonth.getMonth()) {
        cell.addClass("is-outside-month");
      }
      if (dateKey === todayKey) {
        cell.addClass("is-today");
      }
      if (dateKey === this.selectedCalendarDate) {
        cell.addClass("is-selected");
      }
      if (events.length > 0) {
        cell.addClass("has-events");
      }
      cell.ariaLabel = `${dateKey}${events.length > 0 ? `, ${events.length} event${events.length === 1 ? "" : "s"}` : ", no events"}`;
      const top = cell.createDiv({ cls: "daily-dashboard-calendar-day-top" });
      top.createEl("strong", { text: `${date.getDate()}` });
      const dotRow = cell.createDiv({ cls: "daily-dashboard-calendar-day-dots" });
      if (events.length > 0) {
        events.slice(0, 3).forEach(() => {
          dotRow.createSpan({ cls: "daily-dashboard-calendar-day-dot" });
        });
        if (events.length > 3) {
          dotRow.createEl("span", { cls: "daily-dashboard-calendar-day-more", text: `+${events.length - 3}` });
        }
      }
      cell.addEventListener("click", () => {
        this.selectedCalendarDate = dateKey;
        new CalendarEventModal(this.app, this.plugin, dateKey).open();
        void this.render();
      });
    });
    const selectedDate = this.selectedCalendarDate || todayKey;
    const selectedEvents = this.plugin.getCalendarEventsForDate(selectedDate);
    const detail = shell.createDiv({ cls: "daily-dashboard-calendar-detail" });
    const detailHeader = detail.createDiv({ cls: "daily-dashboard-calendar-detail-header" });
    detailHeader.createEl("strong", { text: selectedDate });
    const detailActions = detailHeader.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(detailActions, "Add event", async () => {
      new CalendarEventModal(this.app, this.plugin, selectedDate).open();
    }, false, "plus-circle");
    if (selectedEvents.length === 0) {
      detail.createDiv({ cls: "daily-dashboard-calendar-empty", text: "No events" });
      return;
    }
    const list = detail.createDiv({ cls: "daily-dashboard-calendar-list" });
    selectedEvents.forEach((event) => {
      const row = list.createDiv({ cls: "daily-dashboard-calendar-row" });
      const time = row.createDiv({ cls: "daily-dashboard-calendar-time" });
      time.createEl("strong", { text: event.date === event.endDate ? event.startTime || "All day" : `${event.date} -> ${event.endDate}` });
      time.createEl("span", { text: event.endTime || (event.startTime ? event.date === event.endDate ? "No end" : `ends ${event.endDate}` : event.date === event.endDate ? "Runs all day" : "Runs all day across multiple days") });
      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [
          `Category ${event.category}`,
          event.prepMinutes > 0 ? `Prep ${event.prepMinutes}m` : "",
          event.travelMinutes > 0 ? `Travel ${event.travelMinutes}m` : "",
          event.notes || "No notes",
          event.isException ? `${event.exceptionKind === "move" ? "Moved once" : event.exceptionKind === "cancel" ? "Cancelled once" : "Skipped once"} from ${event.originalDate}` : ""
        ].filter((value) => value.length > 0).join(" \u2022 ")
      });
      const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      if (event.isRecurring) {
        createButton(actions, "Edit once", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId, event.originalDate).open(), false, "pencil");
        createButton(actions, "Edit series", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId).open(), false, "notebook-pen");
        createButton(actions, event.isException ? "Restore once" : "Skip once", async () => {
          if (event.isException) {
            await this.plugin.clearCalendarOccurrenceException(event.sourceEventId, event.originalDate);
          } else {
            await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "skip");
          }
          await this.render();
        }, false, event.isException ? "rotate-ccw" : "skip-forward");
        createButton(actions, "Cancel once", async () => {
          await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "cancel");
          await this.render();
        }, false, "circle-off");
        createButton(actions, "Delete series", async () => this.plugin.removeCalendarEvent(event.sourceEventId), false, "trash-2");
      } else {
        createButton(actions, "Edit", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId).open(), false, "pencil");
        createButton(actions, "Delete", async () => this.plugin.removeCalendarEvent(event.sourceEventId), false, "trash-2");
      }
    });
  }
  getCalendarMonthDays(currentMonth) {
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });
  }
  formatCalendarDayLabel(date, allDay, endDate) {
    if (allDay) {
      if (endDate && formatDateKey(date) !== formatDateKey(endDate)) {
        return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} -> ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;
      }
      return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }
    const todayKey = formatDateKey(/* @__PURE__ */ new Date());
    const dateKey = formatDateKey(date);
    if (dateKey === todayKey) {
      return "Today";
    }
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateKey === formatDateKey(tomorrow)) {
      return "Tomorrow";
    }
    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }
  formatCalendarTimeLabel(start, end, allDay) {
    if (allDay) {
      return formatDateKey(start) === formatDateKey(end) ? "All day" : `All day \u2022 ${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }
    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) {
      return `${startLabel} - ${endLabel}`;
    }
    return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} ${startLabel} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })} ${endLabel}`;
  }
  renderDayMetric(parent, label, value) {
    const metric = parent.createDiv({ cls: "daily-dashboard-day-metric" });
    metric.createEl("span", { cls: "daily-dashboard-habit-meta", text: label });
    metric.createEl("strong", { text: value });
    return metric;
  }
  buildTimelineSessions(entry) {
    return [
      ...entry.workSessions.map((session, index) => {
        var _a;
        return { id: `work-${index}-${session.start}`, kind: "work", start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      }),
      ...entry.napSessions.map((session, index) => {
        var _a;
        return { id: `nap-${index}-${session.start}`, kind: "nap", start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      }),
      ...entry.relaxSessions.map((session, index) => {
        var _a;
        return { id: `relax-${index}-${session.start}`, kind: "relax", start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      }),
      ...entry.breakSessions.map((session, index) => {
        var _a;
        return { id: `break-${index}-${session.start}`, kind: "break", start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      }),
      ...entry.poopSessions.map((session, index) => {
        var _a;
        return { id: `poop-${index}-${session.start}`, kind: "poop", start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      }),
      ...entry.activitySessions.map((session, index) => {
        var _a;
        return { id: `${session.kind}-${index}-${session.start}`, kind: session.kind, start: session.start, end: (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date()), tag: session.tag };
      })
    ].sort((left, right) => left.start.localeCompare(right.start));
  }
  renderTimelineStrip(parent, sessions, date, fallbackEnd, emptyText) {
    if (sessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }
    const parsedSessions = sessions.map((session) => ({
      ...session,
      startDate: new Date(session.start.replace(" ", "T")),
      endDate: new Date((session.end || fallbackEnd).replace(" ", "T"))
    })).filter((session) => !Number.isNaN(session.startDate.getTime()) && !Number.isNaN(session.endDate.getTime()) && session.endDate.getTime() > session.startDate.getTime());
    if (parsedSessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }
    const startBoundary = /* @__PURE__ */ new Date(`${date}T00:00:00`);
    const endBoundary = /* @__PURE__ */ new Date(`${date}T23:59:00`);
    const totalSpan = endBoundary.getTime() - startBoundary.getTime();
    const legend = parent.createDiv({ cls: "daily-dashboard-chip-row" });
    [
      { kind: "work", label: "Work", tone: "capture" },
      { kind: "nap", label: "Nap", tone: "health" },
      { kind: "relax", label: "Relax", tone: "health" },
      { kind: "break", label: "Break", tone: "alert" },
      { kind: "poop", label: "Poop", tone: "log" },
      ...DASHBOARD_ACTIVITY_TRACKERS
    ].forEach((item) => {
      if (parsedSessions.some((session) => session.kind === item.kind)) {
        createSemanticChip(legend, item.label, item.tone);
      }
    });
    const strip = parent.createDiv({ cls: "daily-dashboard-timeline-strip" });
    parsedSessions.forEach((session) => {
      const segment = strip.createDiv({ cls: `daily-dashboard-timeline-segment is-${session.kind}` });
      const left = (session.startDate.getTime() - startBoundary.getTime()) / totalSpan * 100;
      const width = (session.endDate.getTime() - session.startDate.getTime()) / totalSpan * 100;
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${session.end.slice(11, 16)}${session.tag ? ` \u2022 ${session.tag}` : ""}`;
    });
    const scale = parent.createDiv({ cls: "daily-dashboard-timeline-scale" });
    ["00:00", "06:00", "12:00", "18:00", "24:00"].forEach((label) => {
      scale.createEl("span", { text: label });
    });
  }
  getTimelineSearchResults() {
    var _a, _b, _c, _d;
    const entries = this.plugin.getAllEntries();
    const todayKey = formatDateKey(/* @__PURE__ */ new Date());
    const lastEntryKey = (_b = (_a = entries[entries.length - 1]) == null ? void 0 : _a.date) != null ? _b : todayKey;
    const defaultStart = (_d = (_c = entries[0]) == null ? void 0 : _c.date) != null ? _d : formatDateKey(new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3));
    const defaultEnd = formatDateKey(new Date(Math.max((/* @__PURE__ */ new Date(`${lastEntryKey}T00:00:00`)).getTime(), Date.now() + 180 * 24 * 60 * 60 * 1e3)));
    const fromDate = this.timelineFilters.fromDate || defaultStart;
    const toDate = this.timelineFilters.toDate || defaultEnd;
    const entryMap = new Map(entries.map((entry) => [entry.date, entry]));
    const nextEntryMap = new Map(entries.map((entry, index) => [entry.date, entries[index + 1]]));
    const keyword = this.timelineFilters.keyword.trim().toLowerCase();
    const results = [];
    entries.filter((entry) => entry.date >= fromDate && entry.date <= toDate).forEach((entry) => {
      entry.completedTasks.forEach((task, index) => {
        var _a2, _b2;
        results.push({
          id: `task-${entry.date}-${index}-${task.archivedAt}`,
          date: task.archivedAt.slice(0, 10),
          sortKey: task.archivedAt,
          kind: "task",
          title: task.text,
          summary: `${task.project} \u2022 ${task.section}`,
          detail: (_b2 = (_a2 = task.note) == null ? void 0 : _a2.trim()) != null ? _b2 : "",
          tone: "done",
          project: task.project,
          tag: ""
        });
      });
      this.pushTimelineSessionResults(results, entry.date, "work", entry.workSessions);
      this.pushTimelineSessionResults(results, entry.date, "nap", entry.napSessions);
      this.pushTimelineSessionResults(results, entry.date, "relax", entry.relaxSessions);
      this.pushTimelineSessionResults(results, entry.date, "break", entry.breakSessions);
      this.pushTimelineSessionResults(results, entry.date, "poop", entry.poopSessions);
      DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
        this.pushTimelineSessionResults(results, entry.date, tracker.kind, entry.activitySessions.filter((session) => session.kind === tracker.kind));
      });
      entry.moodCheckIns.forEach((item, index) => {
        results.push({
          id: `mood-${entry.date}-${index}-${item.loggedAt}`,
          date: entry.date,
          sortKey: item.loggedAt || `${entry.date} 23:59`,
          kind: "log",
          title: `Mood \u2022 ${item.feeling || `${item.score}/5`}`,
          summary: `Mood ${item.score}/5`,
          detail: item.note.trim(),
          tone: item.score >= 4 ? "done" : item.score >= 3 ? "state" : "alert",
          project: "",
          tag: ""
        });
      });
      entry.energyCheckIns.forEach((item, index) => {
        results.push({
          id: `energy-${entry.date}-${index}-${item.loggedAt}`,
          date: entry.date,
          sortKey: item.loggedAt || `${entry.date} 23:59`,
          kind: "log",
          title: `Energy \u2022 ${item.score}/5`,
          summary: "Energy check-in",
          detail: item.note.trim(),
          tone: item.score >= 4 ? "done" : item.score >= 3 ? "state" : "alert",
          project: "",
          tag: ""
        });
      });
      entry.anxietyCheckIns.forEach((item, index) => {
        results.push({
          id: `anxiety-${entry.date}-${index}-${item.loggedAt}`,
          date: entry.date,
          sortKey: item.loggedAt || `${entry.date} 23:59`,
          kind: "log",
          title: `Anxiety \u2022 ${item.score}/5`,
          summary: "Anxiety check-in",
          detail: item.note.trim(),
          tone: item.score >= 4 ? "alert" : "state",
          project: "",
          tag: ""
        });
      });
      this.pushTimelineLogResult(results, entry.date, "friction", "Friction log", entry.frictionLog, "alert");
      this.pushTimelineLogResult(results, entry.date, "sleep", "Sleep log", entry.sleepLog, "health");
      this.pushTimelineLogResult(results, entry.date, "dream", "Dream log", entry.dreamLog, "log");
      this.pushTimelineLogResult(results, entry.date, "notes", "Daily notes", entry.notes, "neutral");
      this.pushTimelineLogResult(results, entry.date, "helped", "What helped today", entry.helpedToday, "done");
      this.pushTimelineLogResult(results, entry.date, "hurt", "What hurt today", entry.hurtToday, "alert");
      entry.symptomLog.forEach((item, index) => {
        results.push({
          id: `symptom-${entry.date}-${index}-${item.loggedAt}`,
          date: entry.date,
          sortKey: item.loggedAt || `${entry.date} 23:59`,
          kind: "log",
          title: `Symptom \u2022 ${item.symptom}`,
          summary: `Severity ${item.severity}/5`,
          detail: item.note.trim(),
          tone: item.severity >= 4 ? "alert" : "log",
          project: "",
          tag: ""
        });
      });
      entry.intakeLog.forEach((item, index) => {
        results.push({
          id: `intake-${entry.date}-${index}-${item.loggedAt}`,
          date: entry.date,
          sortKey: item.loggedAt || `${entry.date} 23:59`,
          kind: "log",
          title: `${item.kind === "food" ? "Food" : "Consumable"} \u2022 ${item.label}`,
          summary: `${item.kind} \u2022 ${item.amount} ${item.unit}`,
          detail: item.note.trim(),
          tone: item.kind === "medication" ? "alert" : "health",
          project: "",
          tag: ""
        });
      });
      const nextEntry = nextEntryMap.get(entry.date);
      const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
      if (sleepMinutes > 0) {
        results.push({
          id: `sleep-metric-${entry.date}`,
          date: entry.date,
          sortKey: `${entry.date} 23:58`,
          kind: "log",
          title: "Sleep metric",
          summary: `${formatMinutesAsHours(sleepMinutes)} tracked sleep`,
          detail: entry.wakeTime || entry.sleepTime ? `Bed ${entry.sleepTime || "unknown"} \u2022 Wake ${(nextEntry == null ? void 0 : nextEntry.wakeTime) || entry.wakeTime || "unknown"}` : "",
          tone: "health",
          project: "",
          tag: ""
        });
      }
    });
    this.plugin.getCalendarOccurrencesBetween(fromDate, toDate).forEach((event) => {
      results.push({
        id: `calendar-${event.id}`,
        date: event.date,
        sortKey: `${event.date} ${event.startTime || "00:00"}`,
        kind: "calendar",
        title: event.title,
        summary: [event.category, event.projectName, event.startTime ? `${event.startTime}${event.endTime ? `-${event.endTime}` : ""}` : "All day"].filter((value) => value.length > 0).join(" \u2022 "),
        detail: event.notes.trim(),
        tone: event.category === "work" ? "capture" : event.category === "health" ? "health" : "focus",
        project: event.projectName,
        tag: ""
      });
    });
    return results.filter((result) => this.timelineFilters.kinds.includes(result.kind)).filter((result) => !this.timelineFilters.project || result.project === this.timelineFilters.project).filter((result) => !this.timelineFilters.tag || result.tag.toLowerCase() === this.timelineFilters.tag.toLowerCase()).filter((result) => !this.timelineFilters.onlyWithNotes || result.detail.trim().length > 0).filter((result) => !keyword || `${result.title} ${result.summary} ${result.detail} ${result.project} ${result.tag}`.toLowerCase().includes(keyword)).sort((left, right) => right.sortKey.localeCompare(left.sortKey));
  }
  pushTimelineSessionResults(results, date, kind, sessions) {
    sessions.forEach((session, index) => {
      var _a, _b, _c;
      const start = session.start.slice(11, 16);
      const endRaw = (_a = session.end) != null ? _a : formatDateTimeKey(/* @__PURE__ */ new Date());
      const end = endRaw.slice(11, 16);
      const minutes = Math.max(0, getMinutesBetween(session.start, endRaw));
      const trackerMeta = DASHBOARD_ACTIVITY_TRACKERS.find((item) => item.kind === kind);
      const label = (_b = trackerMeta == null ? void 0 : trackerMeta.label) != null ? _b : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
      results.push({
        id: `${kind}-${date}-${index}-${session.start}`,
        date,
        sortKey: session.start,
        kind: "session",
        title: `${label} session`,
        summary: `${start}-${end} \u2022 ${formatMinutesAsHours(minutes)}`,
        detail: session.tag.trim() ? `Tag ${session.tag.trim()}` : "",
        tone: (_c = trackerMeta == null ? void 0 : trackerMeta.tone) != null ? _c : kind === "work" ? "capture" : kind === "poop" ? "log" : kind === "break" ? "alert" : "health",
        project: "",
        tag: session.tag.trim()
      });
    });
  }
  pushTimelineLogResult(results, date, suffix, title, value, tone) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    results.push({
      id: `${suffix}-${date}`,
      date,
      sortKey: `${date} 23:59`,
      kind: "log",
      title,
      summary: this.truncateTimelineText(trimmed, 120),
      detail: trimmed,
      tone,
      project: "",
      tag: ""
    });
  }
  truncateTimelineText(value, limit) {
    return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}\u2026`;
  }
  buildHeatmapSeries(kind) {
    const entries = this.plugin.getAllEntries();
    const today = /* @__PURE__ */ new Date();
    const days = 84;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const entryMap = new Map(entries.map((entry) => [entry.date, entry]));
    const nextEntryMap = new Map(entries.map((entry, index) => [entry.date, entries[index + 1]]));
    const habitDefinitions = this.plugin.getHabitDefinitions();
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const entry = entryMap.get(dateKey);
      if (!entry) {
        return { date: dateKey, value: 0, label: "No data" };
      }
      if (kind === "work") {
        const minutes = getTrackedWorkMinutes(entry);
        return { date: dateKey, value: Math.min(1, minutes / 240), label: `${formatMinutesAsHours(minutes)} work` };
      }
      if (kind === "sleep") {
        const minutes = getSleepMinutesForDay(entry, nextEntryMap.get(dateKey));
        return { date: dateKey, value: Math.min(1, minutes / 540), label: `${formatMinutesAsHours(minutes)} sleep` };
      }
      const completion = getHabitWeightedCompletion(entry, habitDefinitions).percentage;
      return { date: dateKey, value: Math.min(1, completion / 100), label: `${completion}% habits` };
    });
  }
  renderHeatmapMetric(parent, title, description, values) {
    var _a;
    const section = parent.createDiv({ cls: "daily-dashboard-heatmap-metric" });
    const header = section.createDiv({ cls: "daily-dashboard-score-header" });
    header.createEl("strong", { text: title });
    header.createEl("span", { cls: "daily-dashboard-row-meta", text: description });
    const grid = section.createDiv({ cls: "daily-dashboard-heatmap-grid" });
    values.forEach((item) => {
      const cell = grid.createDiv({ cls: this.getHeatmapCellClass(item.value) });
      cell.title = `${item.date} \u2022 ${item.label}`;
    });
    const summary = section.createDiv({ cls: "daily-dashboard-chip-row" });
    const average = values.length > 0 ? Math.round(values.reduce((sum, item) => sum + item.value, 0) / values.length * 100) : 0;
    const strongest = values.reduce((best, item) => item.value > best.value ? item : best, (_a = values[0]) != null ? _a : { date: "", value: 0, label: "No data" });
    createSemanticChip(summary, `Average ${average}%`, average >= 60 ? "done" : average >= 35 ? "focus" : "neutral");
    createSemanticChip(summary, strongest.date ? `Peak ${strongest.date}` : "No peak", strongest.value >= 0.7 ? "capture" : "neutral");
  }
  getHeatmapCellClass(value) {
    if (value >= 0.8) {
      return "daily-dashboard-heatmap-cell is-4";
    }
    if (value >= 0.6) {
      return "daily-dashboard-heatmap-cell is-3";
    }
    if (value >= 0.35) {
      return "daily-dashboard-heatmap-cell is-2";
    }
    if (value > 0) {
      return "daily-dashboard-heatmap-cell is-1";
    }
    return "daily-dashboard-heatmap-cell is-0";
  }
  resetDashboardFilters() {
    this.timelineFilters = {
      keyword: "",
      project: "",
      tag: "",
      kinds: ["task", "session", "calendar", "log"],
      fromDate: "",
      toDate: "",
      onlyWithNotes: false
    };
    this.selectedSavedFilterName = "";
    setDashboardSelectedFilterName("");
  }
  saveCurrentDashboardFilter() {
    var _a, _b;
    const suggestedName = this.selectedSavedFilterName || `Filter ${formatDateKey(/* @__PURE__ */ new Date())}`;
    const name = (_b = (_a = window.prompt("Name this dashboard filter preset:", suggestedName)) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (!name) {
      return;
    }
    const filters = getSavedDashboardFilters().filter((item) => item.name !== name);
    filters.push({
      name,
      workLogFilters: {
        project: this.timelineFilters.project,
        keyword: this.timelineFilters.keyword,
        fromDate: this.timelineFilters.fromDate,
        toDate: this.timelineFilters.toDate
      },
      timelineFilters: {
        ...this.timelineFilters,
        kinds: [...this.timelineFilters.kinds]
      }
    });
    setSavedDashboardFilters(filters.sort((left, right) => left.name.localeCompare(right.name)));
    this.selectedSavedFilterName = name;
    setDashboardSelectedFilterName(name);
  }
  applySavedDashboardFilter(name) {
    const filter = getSavedDashboardFilters().find((item) => item.name === name);
    if (!filter) {
      return;
    }
    this.timelineFilters = {
      ...filter.timelineFilters,
      keyword: filter.timelineFilters.keyword || filter.workLogFilters.keyword,
      project: filter.timelineFilters.project || filter.workLogFilters.project,
      fromDate: filter.timelineFilters.fromDate || filter.workLogFilters.fromDate,
      toDate: filter.timelineFilters.toDate || filter.workLogFilters.toDate,
      kinds: filter.timelineFilters.kinds.length > 0 ? [...filter.timelineFilters.kinds] : ["task", "session", "calendar", "log"]
    };
    this.selectedSavedFilterName = filter.name;
    setDashboardSelectedFilterName(filter.name);
  }
  deleteSelectedDashboardFilter() {
    if (!this.selectedSavedFilterName) {
      return;
    }
    const nextFilters = getSavedDashboardFilters().filter((item) => item.name !== this.selectedSavedFilterName);
    setSavedDashboardFilters(nextFilters);
    this.selectedSavedFilterName = "";
    setDashboardSelectedFilterName("");
  }
  renderScoreControl(parent, label, currentValue, onSelect) {
    const wrapper = parent.createDiv({ cls: "daily-dashboard-score-block" });
    const header = wrapper.createDiv({ cls: "daily-dashboard-score-header" });
    header.createEl("strong", { text: label });
    header.createEl("span", { cls: "daily-dashboard-habit-meta", text: currentValue > 0 ? `${currentValue}/5` : "Not logged" });
    const controls = wrapper.createDiv({ cls: "daily-dashboard-habit-controls" });
    for (let score = 1; score <= 5; score += 1) {
      const button = controls.createEl("button", {
        cls: score === currentValue ? "daily-dashboard-step is-active" : "daily-dashboard-step",
        text: `${score}`
      });
      button.type = "button";
      button.addEventListener("click", () => {
        void onSelect(currentValue === score ? 0 : score);
      });
    }
  }
  initializePersistentTextarea(textarea, storageKey) {
    const storedHeight = getDashboardTextareaHeight(storageKey);
    if (storedHeight) {
      textarea.style.height = storedHeight;
    }
    const persistHeight = () => {
      setDashboardTextareaHeight(storageKey, `${textarea.offsetHeight}px`);
    };
    textarea.addEventListener("mouseup", persistHeight);
    textarea.addEventListener("touchend", persistHeight);
  }
  getCurrentWeekTimeBoard() {
    const today = /* @__PURE__ */ new Date();
    const currentDayIndex = (today.getDay() + 6) % 7;
    const dayState = this.plugin.getDayState();
    const activeLogicalDate = dayState.status === "in-progress" ? dayState.activeDate : "";
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - currentDayIndex);
    const allEntries = this.plugin.getAllEntries();
    const entryMap = new Map(allEntries.map((entry) => [entry.date, entry]));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return labels.map((label, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const entry = entryMap.get(dateKey);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      const nextEntry = entryMap.get(formatDateKey(nextDate));
      const sleepMinutes = entry ? getSleepMinutesForDay(entry, nextEntry) : 0;
      const minutesByKind = {
        sleep: sleepMinutes,
        work: entry ? this.plugin.getTrackedWorkMinutes(entry) : 0,
        nap: entry ? this.plugin.getTrackedNapMinutes(entry) : 0,
        relax: entry ? this.plugin.getTrackedRelaxMinutes(entry) : 0,
        break: entry ? this.plugin.getTrackedBreakMinutes(entry) : 0,
        poop: entry ? this.plugin.getTrackedPoopMinutes(entry) : 0,
        unknown: entry ? this.plugin.getTimeAllocationInsights(entry.date).fullDayUnknownMinutes : Math.max(0, 1440 - sleepMinutes)
      };
      DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
        minutesByKind[tracker.kind] = entry ? this.plugin.getTrackedActivityMinutes(entry, tracker.kind) : 0;
      });
      return {
        label,
        date: dateKey,
        minutesByKind,
        isToday: dateKey === formatDateKey(today),
        isActiveLogicalDay: dateKey === activeLogicalDate
      };
    });
  }
  renderWeekBarSegment(parent, tone, minutes) {
    if (minutes <= 0) {
      return;
    }
    const segment = parent.createDiv({ cls: `daily-dashboard-week-segment is-${tone}` });
    segment.style.height = `${minutes / 1440 * 100}%`;
    segment.ariaLabel = `${tone} ${this.formatWeekBarValue(minutes)}`;
    const label = segment.createEl("span", { text: this.formatWeekBarValue(minutes) });
    if (minutes < 120) {
      label.addClass("is-compact");
    }
  }
  renderWeekLegendItem(parent, label, tone) {
    const item = parent.createDiv({ cls: "daily-dashboard-week-legend-item" });
    item.createDiv({ cls: `daily-dashboard-week-legend-dot is-${tone}` });
    item.createEl("span", { text: label });
  }
  formatWeekBarValue(minutes) {
    if (minutes <= 0) {
      return "0m";
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = minutes / 60;
    return `${hours.toFixed(minutes % 60 === 0 ? 0 : 1).replace(/\.0$/, "")}h`;
  }
};
_DailyDashboardView.AUTO_REFRESH_MS = 30 * 60 * 1e3;
var DailyDashboardView = _DailyDashboardView;
var CalendarEventModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, date, editingEventId = null, editingOccurrenceOriginalDate = null) {
    super(app);
    this.titleValue = "";
    this.endDateValue = "";
    this.startTimeValue = "";
    this.endTimeValue = "";
    this.prepMinutesValue = "0";
    this.travelMinutesValue = "0";
    this.categoryValue = "personal";
    this.projectNameValue = "";
    this.projectNotePathValue = "";
    this.notesValue = "";
    this.repeatCadenceValue = "none";
    this.repeatUntilValue = "";
    this.plugin = plugin;
    this.date = date;
    this.initialDate = date;
    this.editingEventId = editingEventId;
    this.editingOccurrenceOriginalDate = editingOccurrenceOriginalDate;
  }
  onOpen() {
    this.hydrateEditingState();
    this.setTitle(`Calendar Events \u2022 ${this.date}`);
    void this.renderContent();
  }
  onClose() {
    this.contentEl.empty();
  }
  async renderContent() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    const projectChoices = await this.plugin.getCalendarProjectOptions();
    const existingEvents = this.plugin.getCalendarEventsForDate(this.date);
    if (existingEvents.length > 0) {
      contentEl.createEl("h3", { text: "Existing events" });
      existingEvents.forEach((event) => {
        new import_obsidian3.Setting(contentEl).setName(event.title).setDesc([
          event.date === event.endDate ? event.startTime || "All day" : `${event.date} -> ${event.endDate}`,
          event.endTime ? `to ${event.endTime}` : "",
          event.prepMinutes > 0 ? `prep ${event.prepMinutes}m` : "",
          event.travelMinutes > 0 ? `travel ${event.travelMinutes}m` : "",
          `category ${event.category}`,
          event.projectName ? `project ${event.projectName}` : "",
          event.isRecurring ? `repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}` : "",
          event.isException ? `${event.exceptionKind === "move" ? "moved" : event.exceptionKind} once from ${event.originalDate}` : "",
          event.notes
        ].filter((value) => value.length > 0).join(" \u2022 ")).addButton((button) => {
          button.setButtonText(event.isRecurring ? "Edit once" : "Edit").onClick(() => {
            this.editingEventId = event.sourceEventId;
            this.editingOccurrenceOriginalDate = event.isRecurring ? event.originalDate : null;
            this.date = event.date;
            this.endDateValue = event.endDate;
            this.titleValue = event.title;
            this.startTimeValue = event.startTime;
            this.endTimeValue = event.endTime;
            this.prepMinutesValue = `${event.prepMinutes}`;
            this.travelMinutesValue = `${event.travelMinutes}`;
            this.categoryValue = event.category;
            this.projectNameValue = event.projectName;
            this.projectNotePathValue = event.projectNotePath;
            this.notesValue = event.notes;
            if (!event.isRecurring) {
              this.repeatCadenceValue = "none";
              this.repeatUntilValue = "";
            }
            void this.renderContent();
          });
        });
        if (event.isRecurring) {
          new import_obsidian3.Setting(contentEl).setName("").addButton((button) => {
            button.setButtonText("Edit series").onClick(() => {
              const sourceEvent = this.plugin.getCalendarEventEntry(event.sourceEventId);
              if (!sourceEvent) {
                return;
              }
              this.editingEventId = sourceEvent.id;
              this.editingOccurrenceOriginalDate = null;
              this.date = sourceEvent.date;
              this.endDateValue = sourceEvent.endDate;
              this.titleValue = sourceEvent.title;
              this.startTimeValue = sourceEvent.startTime;
              this.endTimeValue = sourceEvent.endTime;
              this.prepMinutesValue = `${sourceEvent.prepMinutes}`;
              this.travelMinutesValue = `${sourceEvent.travelMinutes}`;
              this.categoryValue = sourceEvent.category;
              this.projectNameValue = sourceEvent.projectName;
              this.projectNotePathValue = sourceEvent.projectNotePath;
              this.notesValue = sourceEvent.notes;
              this.repeatCadenceValue = sourceEvent.repeatCadence;
              this.repeatUntilValue = sourceEvent.repeatUntil;
              void this.renderContent();
            });
          }).addButton((button) => {
            button.setButtonText(event.isException ? "Restore once" : "Skip once").onClick(async () => {
              if (event.isException) {
                await this.plugin.clearCalendarOccurrenceException(event.sourceEventId, event.originalDate);
              } else {
                await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "skip");
              }
              if (this.editingOccurrenceOriginalDate === event.originalDate) {
                this.clearEditingState();
              }
              await this.renderContent();
            });
          }).addButton((button) => {
            button.setButtonText("Cancel once").onClick(async () => {
              await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "cancel");
              if (this.editingOccurrenceOriginalDate === event.originalDate) {
                this.clearEditingState();
              }
              await this.renderContent();
            });
          }).addButton((button) => {
            button.setButtonText("Delete series").onClick(async () => {
              await this.plugin.removeCalendarEvent(event.sourceEventId);
              if (this.editingEventId === event.sourceEventId) {
                this.clearEditingState();
              }
              await this.renderContent();
            });
          });
        } else {
          new import_obsidian3.Setting(contentEl).setName("").addButton((button) => {
            button.setButtonText("Delete").onClick(async () => {
              await this.plugin.removeCalendarEvent(event.sourceEventId);
              if (this.editingEventId === event.sourceEventId) {
                this.clearEditingState();
              }
              await this.renderContent();
            });
          });
        }
      });
    }
    contentEl.createEl("h3", { text: this.editingOccurrenceOriginalDate ? `Edit occurrence from ${this.editingOccurrenceOriginalDate}` : this.editingEventId ? "Edit event" : "Add event" });
    new import_obsidian3.Setting(contentEl).setName("Title").setDesc("Required").addText((text) => {
      text.setPlaceholder("Appointment, reminder, call, errand").setValue(this.titleValue).onChange((value) => {
        this.titleValue = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian3.Setting(contentEl).setName("Date").setDesc("YYYY-MM-DD").addText((text) => {
      text.setPlaceholder("2026-04-01").setValue(this.date).onChange((value) => {
        this.date = value.trim();
      });
      text.inputEl.type = "date";
    });
    new import_obsidian3.Setting(contentEl).setName("End date").setDesc("Same day unless this spans multiple days.").addText((text) => {
      text.setPlaceholder("2026-04-01").setValue(this.endDateValue || this.date).onChange((value) => {
        this.endDateValue = value.trim();
      });
      text.inputEl.type = "date";
    });
    new import_obsidian3.Setting(contentEl).setName("Start time").setDesc("Leave blank for all-day events.").addText((text) => {
      text.setPlaceholder("09:30").setValue(this.startTimeValue).onChange((value) => {
        this.startTimeValue = value.trim();
      });
      text.inputEl.type = "time";
    });
    new import_obsidian3.Setting(contentEl).setName("End time").setDesc("Optional").addText((text) => {
      text.setPlaceholder("10:15").setValue(this.endTimeValue).onChange((value) => {
        this.endTimeValue = value.trim();
      });
      text.inputEl.type = "time";
    });
    new import_obsidian3.Setting(contentEl).setName("Category").setDesc("Used to group calendar context across the dashboard.").addDropdown((dropdown) => {
      dropdown.addOption("work", "Work");
      dropdown.addOption("health", "Health");
      dropdown.addOption("errands", "Errands");
      dropdown.addOption("social", "Social");
      dropdown.addOption("personal", "Personal");
      dropdown.setValue(this.categoryValue);
      dropdown.onChange((value) => {
        this.categoryValue = value === "work" || value === "health" || value === "errands" || value === "social" ? value : "personal";
      });
    });
    const projectChoiceListId = `daily-dashboard-calendar-projects-${this.initialDate.replace(/[^a-z0-9]/gi, "-")}-${(_a = this.editingEventId) != null ? _a : "new"}`;
    const projectChoiceList = contentEl.createEl("datalist", { attr: { id: projectChoiceListId } });
    projectChoices.forEach((project) => {
      const option = projectChoiceList.createEl("option");
      option.value = project.name;
      option.label = project.wikiLink;
    });
    new import_obsidian3.Setting(contentEl).setName("Project").setDesc(this.projectNotePathValue ? `Linked to ${this.projectNotePathValue.replace(/\.md$/i, "")}.` : "Optional. Pick a known project or type a custom project name.").addText((text) => {
      text.setPlaceholder("Optional project link").setValue(this.projectNameValue).onChange((value) => {
        this.setProjectSelection(value, projectChoices);
      });
      text.inputEl.setAttribute("list", projectChoiceListId);
    });
    new import_obsidian3.Setting(contentEl).setName("Notes").setDesc("Optional context shown in reminders and the calendar detail list.").addTextArea((textArea) => {
      textArea.setPlaceholder("Location, prep, what to bring, who it is with").setValue(this.notesValue).onChange((value) => {
        this.notesValue = value;
      });
      textArea.inputEl.rows = 3;
    });
    new import_obsidian3.Setting(contentEl).setName("Prep minutes").setDesc("How early prep should start before the event begins.").addText((text) => {
      text.setPlaceholder("0").setValue(this.prepMinutesValue).onChange((value) => {
        this.prepMinutesValue = value.trim();
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
    });
    new import_obsidian3.Setting(contentEl).setName("Travel minutes").setDesc("Extra lead time before the event for travel.").addText((text) => {
      text.setPlaceholder("0").setValue(this.travelMinutesValue).onChange((value) => {
        this.travelMinutesValue = value.trim();
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
    });
    if (!this.editingOccurrenceOriginalDate) {
      new import_obsidian3.Setting(contentEl).setName("Repeat").setDesc("Make this event recurring.").addDropdown((dropdown) => {
        dropdown.addOption("none", "Does not repeat");
        dropdown.addOption("daily", "Daily");
        dropdown.addOption("weekly", "Weekly");
        dropdown.addOption("monthly", "Monthly");
        dropdown.addOption("yearly", "Yearly");
        dropdown.setValue(this.repeatCadenceValue);
        dropdown.onChange((value) => {
          this.repeatCadenceValue = value === "daily" || value === "weekly" || value === "monthly" || value === "yearly" ? value : "none";
          void this.renderContent();
        });
      });
      if (this.repeatCadenceValue !== "none") {
        new import_obsidian3.Setting(contentEl).setName("Repeat until").setDesc("Optional end date for the recurring series.").addText((text) => {
          text.setPlaceholder("2026-12-31").setValue(this.repeatUntilValue).onChange((value) => {
            this.repeatUntilValue = value.trim();
          });
          text.inputEl.type = "date";
        });
      }
    } else {
      contentEl.createEl("p", {
        cls: "daily-dashboard-row-meta",
        text: "This edits only the selected occurrence. Series recurrence rules stay unchanged."
      });
    }
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText(this.editingEventId ? "Save changes" : "Add event").setCta().onClick(async () => {
        const input = {
          title: this.titleValue,
          date: this.date,
          endDate: this.endDateValue || this.date,
          startTime: this.startTimeValue,
          endTime: this.endTimeValue,
          prepMinutes: Number(this.prepMinutesValue || 0),
          travelMinutes: Number(this.travelMinutesValue || 0),
          category: this.categoryValue,
          projectName: this.projectNameValue,
          projectNotePath: this.projectNotePathValue,
          notes: this.notesValue,
          repeatCadence: this.repeatCadenceValue,
          repeatUntil: this.repeatUntilValue
        };
        if (this.editingEventId && this.editingOccurrenceOriginalDate) {
          await this.plugin.updateCalendarOccurrence(this.editingEventId, this.editingOccurrenceOriginalDate, input);
        } else if (this.editingEventId) {
          await this.plugin.updateCalendarEvent(this.editingEventId, input);
        } else {
          await this.plugin.addCalendarEvent(input);
        }
        this.clearEditingState();
        await this.renderContent();
      });
    }).addExtraButton((button) => {
      button.setIcon("rotate-ccw").setTooltip("Reset form").onClick(() => {
        this.clearEditingState();
        void this.renderContent();
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Close").onClick(() => {
        this.close();
      });
    });
  }
  setProjectSelection(value, projectChoices) {
    this.projectNameValue = value.trim();
    const match = projectChoices.find((project) => project.name.toLowerCase() === this.projectNameValue.toLowerCase());
    this.projectNotePathValue = this.projectNameValue && match ? match.notePath : "";
  }
  hydrateEditingState() {
    if (!this.editingEventId) {
      return;
    }
    if (this.editingOccurrenceOriginalDate) {
      const occurrence = this.plugin.getCalendarEventsForDate(this.date).find((event2) => event2.sourceEventId === this.editingEventId && event2.originalDate === this.editingOccurrenceOriginalDate);
      if (!occurrence) {
        this.clearEditingState();
        return;
      }
      this.date = occurrence.date;
      this.endDateValue = occurrence.endDate;
      this.titleValue = occurrence.title;
      this.startTimeValue = occurrence.startTime;
      this.endTimeValue = occurrence.endTime;
      this.prepMinutesValue = `${occurrence.prepMinutes}`;
      this.travelMinutesValue = `${occurrence.travelMinutes}`;
      this.categoryValue = occurrence.category;
      this.projectNameValue = occurrence.projectName;
      this.projectNotePathValue = occurrence.projectNotePath;
      this.notesValue = occurrence.notes;
      return;
    }
    const event = this.plugin.getCalendarEventEntry(this.editingEventId);
    if (!event) {
      this.clearEditingState();
      return;
    }
    this.date = event.date;
    this.endDateValue = event.endDate;
    this.titleValue = event.title;
    this.startTimeValue = event.startTime;
    this.endTimeValue = event.endTime;
    this.prepMinutesValue = `${event.prepMinutes}`;
    this.travelMinutesValue = `${event.travelMinutes}`;
    this.categoryValue = event.category;
    this.projectNameValue = event.projectName;
    this.projectNotePathValue = event.projectNotePath;
    this.notesValue = event.notes;
    this.repeatCadenceValue = event.repeatCadence;
    this.repeatUntilValue = event.repeatUntil;
  }
  clearEditingState() {
    this.editingEventId = null;
    this.editingOccurrenceOriginalDate = null;
    this.date = this.initialDate;
    this.titleValue = "";
    this.endDateValue = this.initialDate;
    this.startTimeValue = "";
    this.endTimeValue = "";
    this.prepMinutesValue = "0";
    this.travelMinutesValue = "0";
    this.categoryValue = "personal";
    this.projectNameValue = "";
    this.projectNotePathValue = "";
    this.notesValue = "";
    this.repeatCadenceValue = "none";
    this.repeatUntilValue = "";
  }
};
var DashboardLayoutModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    super(app);
    this.draggedCardKey = null;
    this.options = options;
    this.cards = normalizeDashboardCardLayoutState(options.cards);
  }
  onOpen() {
    this.modalEl.addClass("daily-dashboard-layout-modal");
    this.setTitle("Customize Dashboard Layout");
    this.renderContent();
  }
  onClose() {
    this.modalEl.removeClass("daily-dashboard-layout-modal");
    this.contentEl.empty();
  }
  renderContent() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Reorder cards, hide sections you do not use, and pin the few cards that should always rise to the top. Pinned cards still respect their relative order."
    });
    const list = contentEl.createDiv({ cls: "daily-dashboard-layout-list" });
    sortDashboardLayoutCardsByOrder(this.cards).forEach((card, index, orderedCards) => {
      const row = list.createDiv({ cls: "daily-dashboard-layout-row" });
      row.draggable = true;
      if (card.hidden) {
        row.addClass("is-hidden");
      }
      if (card.pinned) {
        row.addClass("is-pinned");
      }
      row.addEventListener("dragstart", (event) => {
        var _a;
        this.draggedCardKey = card.key;
        row.addClass("is-dragging");
        (_a = event.dataTransfer) == null ? void 0 : _a.setData("text/plain", card.key);
      });
      row.addEventListener("dragover", (event) => {
        if (!this.draggedCardKey || this.draggedCardKey === card.key) {
          return;
        }
        event.preventDefault();
        row.addClass("is-drop-target");
      });
      row.addEventListener("dragleave", () => {
        row.removeClass("is-drop-target");
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        row.removeClass("is-drop-target");
        if (!this.draggedCardKey || this.draggedCardKey === card.key) {
          return;
        }
        this.moveCardToIndex(this.draggedCardKey, index);
        this.draggedCardKey = null;
        this.renderContent();
      });
      row.addEventListener("dragend", () => {
        this.draggedCardKey = null;
        row.removeClass("is-dragging");
        row.removeClass("is-drop-target");
      });
      const copy = row.createDiv({ cls: "daily-dashboard-stack" });
      copy.createEl("strong", { text: `${index + 1}. ${card.title}` });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [card.pinned ? "Pinned" : "Standard order", card.hidden ? "Hidden" : "Visible", card.width === "full" ? "Full width" : card.width === "half" ? "Half width" : "Default width"].join(" \u2022 ")
      });
      const controls = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      const widthSelect = controls.createEl("select", { cls: "daily-dashboard-input" });
      [["default", "Default width"], ["half", "Half width"], ["full", "Full width"]].forEach(([value, label]) => {
        const option = widthSelect.createEl("option", { text: label });
        option.value = value;
      });
      widthSelect.value = card.width;
      widthSelect.addEventListener("change", () => {
        this.cards = this.cards.map((candidate) => candidate.key === card.key ? { ...candidate, width: widthSelect.value === "half" || widthSelect.value === "full" ? widthSelect.value : "default" } : candidate);
      });
      createButton(controls, card.pinned ? "Unpin" : "Pin", async () => {
        this.togglePinned(card.key);
        this.renderContent();
      }, false, "pin");
      createButton(controls, card.hidden ? "Show" : "Hide", async () => {
        this.toggleHidden(card.key);
        this.renderContent();
      }, false, card.hidden ? "eye" : "eye-off");
    });
    const preview = contentEl.createDiv({ cls: "daily-dashboard-chip-row" });
    const orderedPreview = sortDashboardLayoutCards(this.cards).filter((card) => !card.hidden);
    createSemanticChip(preview, `${orderedPreview.length} visible`, orderedPreview.length > 0 ? "done" : "alert");
    createSemanticChip(preview, `${this.cards.filter((card) => card.pinned).length} pinned`, this.cards.some((card) => card.pinned) ? "focus" : "neutral");
    createSemanticChip(preview, `${this.cards.filter((card) => card.hidden).length} hidden`, this.cards.some((card) => card.hidden) ? "log" : "neutral");
    const footer = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(footer, "Reset defaults", async () => {
      this.cards = DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
      this.renderContent();
    }, false, "rotate-ccw");
    createButton(footer, "Apply layout", async () => {
      const normalized = normalizeDashboardCardLayoutState(this.cards);
      await this.options.onApply(normalized);
      this.close();
    }, true, "check");
    createButton(footer, "Cancel", async () => {
      this.close();
    }, false, "x");
  }
  moveCardToIndex(cardKey, targetIndex) {
    const ordered = sortDashboardLayoutCardsByOrder(this.cards);
    const index = ordered.findIndex((card) => card.key === cardKey);
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }
    const next = ordered.map((card) => ({ ...card }));
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    this.cards = normalizeDashboardCardLayoutState(next.map((card, orderedIndex) => ({ ...card, order: orderedIndex })));
  }
  togglePinned(cardKey) {
    this.cards = this.cards.map((card) => card.key === cardKey ? { ...card, pinned: !card.pinned } : card);
  }
  toggleHidden(cardKey) {
    this.cards = this.cards.map((card) => card.key === cardKey ? { ...card, hidden: !card.hidden } : card);
  }
};
var DashboardShortcutHelpModal = class extends import_obsidian3.Modal {
  onOpen() {
    this.setTitle("Dashboard Keyboard Shortcuts");
    const { contentEl } = this;
    contentEl.empty();
    DASHBOARD_SHORTCUTS.forEach((shortcut) => {
      new import_obsidian3.Setting(contentEl).setName(shortcut.label).setDesc(`${shortcut.keys} \u2022 ${shortcut.description}`);
    });
    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Shortcuts only fire while focus is inside the dashboard and never while you are typing in an input, textarea, or select field."
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var FirstRunSetupWizardModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.stepIndex = 0;
    this.plugin = plugin;
    this.settingsValue = { ...plugin.getSettings() };
  }
  onOpen() {
    this.modalEl.addClass("daily-dashboard-setup-modal");
    this.renderContent();
  }
  onClose() {
    this.modalEl.removeClass("daily-dashboard-setup-modal");
    this.contentEl.empty();
  }
  renderContent() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(`First-Run Setup \u2022 Step ${this.stepIndex + 1} of 4`);
    const intro = contentEl.createDiv({ cls: "daily-dashboard-setup-intro" });
    intro.createEl("strong", { text: FIRST_RUN_SETUP_STEPS[this.stepIndex].title });
    intro.createEl("span", { cls: "daily-dashboard-row-meta", text: FIRST_RUN_SETUP_STEPS[this.stepIndex].description });
    const progress = contentEl.createDiv({ cls: "daily-dashboard-chip-row" });
    FIRST_RUN_SETUP_STEPS.forEach((step, index) => {
      createSemanticChip(progress, `${index + 1}. ${step.shortLabel}`, index === this.stepIndex ? "focus" : index < this.stepIndex ? "done" : "neutral");
    });
    switch (this.stepIndex) {
      case 0:
        this.renderIdentityStep(contentEl);
        break;
      case 1:
        this.renderProjectWorkflowStep(contentEl);
        break;
      case 2:
        this.renderTrackingStep(contentEl);
        break;
      default:
        this.renderAiStep(contentEl);
        break;
    }
    const footer = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(footer, "Close for now", async () => {
      await this.plugin.snoozeFirstRunSetupWizard(12);
      this.close();
    }, false, "x");
    if (this.stepIndex > 0) {
      createButton(footer, "Back", async () => {
        this.stepIndex -= 1;
        this.renderContent();
      }, false, "arrow-left");
    }
    if (this.stepIndex < FIRST_RUN_SETUP_STEPS.length - 1) {
      createButton(footer, "Next", async () => {
        this.stepIndex += 1;
        this.renderContent();
      }, true, "arrow-right");
    } else {
      createButton(footer, "Save and open dashboard", async () => {
        await this.plugin.updateSettings(this.settingsValue);
        await this.plugin.ensureBasicInformationNoteExists();
        await this.plugin.completeFirstRunSetupWizard();
        await this.plugin.activateDashboardView();
        this.close();
      }, true, "check");
    }
  }
  renderIdentityStep(parent) {
    new import_obsidian3.Setting(parent).setName("Dashboard title").setDesc("Shown in the hero area at the top of the dashboard.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dashboardTitle).setValue(this.settingsValue.dashboardTitle).onChange((value) => {
        this.settingsValue.dashboardTitle = value.trim() || DEFAULT_SETTINGS.dashboardTitle;
      });
    });
    new import_obsidian3.Setting(parent).setName("Daily log folder").setDesc("Where readable per-day markdown logs are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder).setValue(this.settingsValue.dailyLogFolder).onChange((value) => {
        this.settingsValue.dailyLogFolder = value.trim() || DEFAULT_SETTINGS.dailyLogFolder;
      });
    });
  }
  renderProjectWorkflowStep(parent) {
    new import_obsidian3.Setting(parent).setName("Master task hub path").setDesc("The markdown note used for project health, quick add, promotion, and cleanup workflows.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.masterTodoPath).setValue(this.settingsValue.masterTodoPath).onChange((value) => {
        this.settingsValue.masterTodoPath = value.trim() || DEFAULT_SETTINGS.masterTodoPath;
      });
    });
    new import_obsidian3.Setting(parent).setName("Project notes folder").setDesc("Where new project notes will be created by the dashboard intake flow.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder).setValue(this.settingsValue.projectNotesFolder).onChange((value) => {
        this.settingsValue.projectNotesFolder = value.trim() || DEFAULT_SETTINGS.projectNotesFolder;
      });
    });
    const tips = parent.createDiv({ cls: "daily-dashboard-ai-suggestions" });
    [
      "Point the plugin at the same master task hub you already use for active project checklists.",
      "If you do not have one yet, keep the default path and create the note later from the dashboard flows."
    ].forEach((tip) => {
      const row = tips.createDiv({ cls: "daily-dashboard-project-row" });
      row.createEl("span", { text: tip });
    });
  }
  renderTrackingStep(parent) {
    new import_obsidian3.Setting(parent).setName("Weekly report folder").setDesc("Where generated weekly summaries should be written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder).setValue(this.settingsValue.weeklyReportFolder).onChange((value) => {
        this.settingsValue.weeklyReportFolder = value.trim() || DEFAULT_SETTINGS.weeklyReportFolder;
      });
    });
    new import_obsidian3.Setting(parent).setName("Monthly report folder").setDesc("Where generated monthly summaries should be written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder).setValue(this.settingsValue.monthlyReportFolder).onChange((value) => {
        this.settingsValue.monthlyReportFolder = value.trim() || DEFAULT_SETTINGS.monthlyReportFolder;
      });
    });
    new import_obsidian3.Setting(parent).setName("Export folder").setDesc("Where markdown and CSV dashboard exports should land.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.exportFolder).setValue(this.settingsValue.exportFolder).onChange((value) => {
        this.settingsValue.exportFolder = value.trim() || DEFAULT_SETTINGS.exportFolder;
      });
    });
    new import_obsidian3.Setting(parent).setName("Enable calendar").setDesc("Turns on recurring events, reminders, and agenda cards.").addToggle((toggle) => {
      toggle.setValue(this.settingsValue.calendarEnabled).onChange((value) => {
        this.settingsValue.calendarEnabled = value;
      });
    });
    new import_obsidian3.Setting(parent).setName("Calendar document path").setDesc("Markdown file used to mirror dashboard calendar data for review and AI context.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.calendarDocumentPath).setValue(this.settingsValue.calendarDocumentPath).onChange((value) => {
        this.settingsValue.calendarDocumentPath = value.trim() || DEFAULT_SETTINGS.calendarDocumentPath;
      });
    });
  }
  renderAiStep(parent) {
    new import_obsidian3.Setting(parent).setName("Basic information note path").setDesc("This note is created automatically and gives AI a durable place for age, height, interests, preferences, and other stable context.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.basicInfoNotePath).setValue(this.settingsValue.basicInfoNotePath).onChange((value) => {
        this.settingsValue.basicInfoNotePath = value.trim() || DEFAULT_SETTINGS.basicInfoNotePath;
      });
    });
    new import_obsidian3.Setting(parent).setName("Include basic information in AI").setDesc("Keep this on if you want AI workflows to automatically read the Basic Information note when it exists.").addToggle((toggle) => {
      toggle.setValue(this.settingsValue.includeBasicInfoInAi).onChange((value) => {
        this.settingsValue.includeBasicInfoInAi = value;
      });
    });
    new import_obsidian3.Setting(parent).setName("AI output folder").setDesc("Where AI-generated markdown notes should be written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder).setValue(this.settingsValue.aiOutputFolder).onChange((value) => {
        this.settingsValue.aiOutputFolder = value.trim() || DEFAULT_SETTINGS.aiOutputFolder;
      });
    });
    new import_obsidian3.Setting(parent).setName("AI key source").setDesc("Environment variable is safer if you already keep the key outside plugin data.").addDropdown((dropdown) => {
      dropdown.addOption("settings", "Stored in plugin settings");
      dropdown.addOption("env", "Environment variable");
      dropdown.setValue(this.settingsValue.aiApiKeySource);
      dropdown.onChange((value) => {
        this.settingsValue.aiApiKeySource = value === "env" ? "env" : "settings";
        this.renderContent();
      });
    });
    if (this.settingsValue.aiApiKeySource === "env") {
      new import_obsidian3.Setting(parent).setName("Environment variable name").setDesc("The environment variable the plugin will read for the API key.").addText((text) => {
        text.setPlaceholder(DEFAULT_SETTINGS.aiApiKeyEnvVar).setValue(this.settingsValue.aiApiKeyEnvVar).onChange((value) => {
          this.settingsValue.aiApiKeyEnvVar = value.trim() || DEFAULT_SETTINGS.aiApiKeyEnvVar;
        });
      });
    } else {
      new import_obsidian3.Setting(parent).setName("AI API key").setDesc("Optional. Leave blank if you want to configure AI later.").addText((text) => {
        text.setPlaceholder("sk-...").setValue(this.settingsValue.aiApiKey).onChange((value) => {
          this.settingsValue.aiApiKey = value.trim();
        });
        text.inputEl.type = "password";
      });
    }
    new import_obsidian3.Setting(parent).setName("AI model").setDesc("Default chat model for dashboard AI workflows.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiModel).setValue(this.settingsValue.aiModel).onChange((value) => {
        this.settingsValue.aiModel = value.trim() || DEFAULT_SETTINGS.aiModel;
      });
    });
  }
};
var CreateProjectModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, categories) {
    var _a;
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.state = {
      projectName: "",
      categoryName: (_a = categories[0]) != null ? _a : "Projects",
      status: "Planning",
      focus: "",
      addTasks: [],
      fixTasks: []
    };
  }
  onOpen() {
    this.setTitle("Create Project And Project Note");
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian3.Setting(contentEl).setName("Project name").setDesc("Used for the master todo section and the new project note name.").addText((text) => {
      text.setPlaceholder("New Project").onChange((value) => {
        this.state.projectName = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian3.Setting(contentEl).setName("Category").setDesc("Top-level section in the master todo where this project should be added.").addDropdown((dropdown) => {
      const options = [...this.categories];
      if (!options.includes(this.state.categoryName)) {
        options.unshift(this.state.categoryName);
      }
      options.forEach((category) => dropdown.addOption(category, category));
      dropdown.setValue(this.state.categoryName);
      dropdown.onChange((value) => {
        this.state.categoryName = value;
      });
    }).addText((text) => {
      text.setPlaceholder("Or type a new category name").onChange((value) => {
        if (value.trim()) {
          this.state.categoryName = value.trim();
        }
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Status").setDesc("Initial status written to the master todo and project note.").addDropdown((dropdown) => {
      ["Planning", "Active", "Parked", "Blocked", "Incubating", "Someday"].forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(this.state.status);
      dropdown.onChange((value) => {
        this.state.status = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Focus").setDesc("Short description of the current objective for this project.").addTextArea((textArea) => {
      textArea.setPlaceholder("What matters most right now for this project?").onChange((value) => {
        this.state.focus = value;
      });
      textArea.inputEl.rows = 3;
    });
    new import_obsidian3.Setting(contentEl).setName("Add tasks").setDesc("Optional. One task per line; these seed the Add section.").addTextArea((textArea) => {
      textArea.setPlaceholder("First task\nSecond task").onChange((value) => {
        this.state.addTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian3.Setting(contentEl).setName("Fix tasks").setDesc("Optional. One task per line; these seed the Fix section.").addTextArea((textArea) => {
      textArea.setPlaceholder("Known bug\nAnother bug").onChange((value) => {
        this.state.fixTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText("Create project").setCta().onClick(async () => {
        if (!this.state.projectName.trim()) {
          new import_obsidian3.Notice("Project name is required.");
          return;
        }
        if (!this.state.categoryName.trim()) {
          new import_obsidian3.Notice("Category is required.");
          return;
        }
        await this.plugin.createProjectAndNote(this.state);
        this.close();
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Cancel").onClick(() => {
        this.close();
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var LogicalDayRepairModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.state = this.plugin.getDayRepairInput();
  }
  onOpen() {
    this.setTitle("Repair Logical Day");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Use this when the day flow needs correction. You can fix the logical date, key timestamps, and tracked totals so reports and the weekly board stay accurate."
    });
    new import_obsidian3.Setting(contentEl).setName("Logical date").setDesc("Enter the date the dashboard should use in YYYY-MM-DD format, then load that date if you want its existing values.").addText((text) => {
      text.setPlaceholder("2026-04-01").setValue(this.state.date).onChange((value) => {
        this.state.date = value.trim();
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    }).addButton((button) => {
      button.setButtonText("Load date").onClick(() => {
        this.state = this.plugin.getDayRepairInput(this.state.date.trim() || formatDateKey(/* @__PURE__ */ new Date()));
        this.onOpen();
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Day status").setDesc("Choose whether the logical day should be idle, active, or already ended.").addDropdown((dropdown) => {
      dropdown.addOption("not-started", "Not started");
      dropdown.addOption("in-progress", "In progress");
      dropdown.addOption("ended", "Ended");
      dropdown.setValue(this.state.status);
      dropdown.onChange((value) => {
        this.state.status = value === "in-progress" || value === "ended" ? value : "not-started";
      });
    });
    this.addDateTimeSetting(contentEl, "Day start", "When the day began.", this.state.dayStartedAt, (value) => {
      this.state.dayStartedAt = value;
    });
    this.addDateTimeSetting(contentEl, "Day end", "When the day ended.", this.state.dayEndedAt, (value) => {
      this.state.dayEndedAt = value;
    });
    this.addDateTimeSetting(contentEl, "Wake time", "Useful for sleep calculations and daily context.", this.state.wakeTime, (value) => {
      this.state.wakeTime = value;
    });
    this.addDateTimeSetting(contentEl, "Sleep time", "When you actually went to sleep.", this.state.sleepTime, (value) => {
      this.state.sleepTime = value;
    });
    this.addMinutesSetting(contentEl, "Hours slept", "Total sleep minutes used by the weekly tracker and reports.", this.state.sleepMinutesOverride, (value) => {
      this.state.sleepMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Work minutes", "Correct tracked work if you missed a timer or ended it late.", this.state.workMinutesOverride, (value) => {
      this.state.workMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Nap minutes", "Correct nap totals for the day.", this.state.napMinutesOverride, (value) => {
      this.state.napMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Relax minutes", "Correct relaxing time totals.", this.state.relaxMinutesOverride, (value) => {
      this.state.relaxMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Break minutes", "Correct break totals without editing raw sessions.", this.state.breakMinutesOverride, (value) => {
      this.state.breakMinutesOverride = value;
    });
    this.addScoreSetting(contentEl, "Mood", this.state.moodScore, (value) => {
      this.state.moodScore = value;
    });
    this.addScoreSetting(contentEl, "Energy", this.state.energyScore, (value) => {
      this.state.energyScore = value;
    });
    this.addScoreSetting(contentEl, "Anxiety", this.state.anxietyScore, (value) => {
      this.state.anxietyScore = value;
    });
    const timelineSection = contentEl.createDiv({ cls: "daily-dashboard-repair-timeline" });
    timelineSection.createEl("h3", { text: "Manual timeline editor" });
    timelineSection.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Edit the actual tracked sessions for work, naps, relax, breaks, and bowel tracking. When a session exists here, its minute override is cleared on apply so reports use the repaired timeline."
    });
    this.renderRepairTimelineEditor(timelineSection);
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText("Reset to today").onClick(async () => {
        this.state = this.plugin.getDayRepairInput(formatDateKey(/* @__PURE__ */ new Date()));
        this.state.status = "not-started";
        this.onOpen();
      });
    }).addButton((button) => {
      button.setButtonText("Reload current").onClick(() => {
        this.state = this.plugin.getDayRepairInput(this.state.date.trim() || this.plugin.getDayRepairInput().date);
        this.onOpen();
      });
    }).addButton((button) => {
      button.setButtonText("Apply").setCta().onClick(async () => {
        const didApply = await this.plugin.applyDayRepair(this.state);
        if (didApply) {
          this.close();
        }
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Cancel").onClick(() => {
        this.close();
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
  addDateTimeSetting(parent, name, description, value, onChange) {
    new import_obsidian3.Setting(parent).setName(name).setDesc(description).addText((text) => {
      text.setValue(this.toDateTimeLocalValue(value)).onChange((nextValue) => {
        onChange(nextValue.trim());
      });
      text.inputEl.type = "datetime-local";
    });
  }
  addMinutesSetting(parent, name, description, value, onChange) {
    new import_obsidian3.Setting(parent).setName(name).setDesc(description).addText((text) => {
      text.setValue(`${value}`).onChange((nextValue) => {
        onChange(Math.max(0, Math.round(Number(nextValue) || 0)));
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "1440";
    });
  }
  addScoreSetting(parent, name, value, onChange) {
    new import_obsidian3.Setting(parent).setName(name).setDesc("0 to 5").addText((text) => {
      text.setValue(`${value}`).onChange((nextValue) => {
        onChange(Math.max(0, Math.min(5, Math.round(Number(nextValue) || 0))));
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "5";
    });
  }
  toDateTimeLocalValue(value) {
    if (!value.trim()) {
      return "";
    }
    return value.replace(" ", "T").slice(0, 16);
  }
  renderTimelineStrip(parent, sessions, date, fallbackEnd, emptyText) {
    if (sessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }
    const parsedSessions = sessions.map((session) => ({
      ...session,
      startDate: new Date(session.start.replace(" ", "T")),
      endDate: new Date((session.end || fallbackEnd).replace(" ", "T"))
    })).filter((session) => !Number.isNaN(session.startDate.getTime()) && !Number.isNaN(session.endDate.getTime()) && session.endDate.getTime() > session.startDate.getTime());
    if (parsedSessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }
    const startBoundary = /* @__PURE__ */ new Date(`${date}T00:00:00`);
    const endBoundary = /* @__PURE__ */ new Date(`${date}T23:59:00`);
    const totalSpan = endBoundary.getTime() - startBoundary.getTime();
    const strip = parent.createDiv({ cls: "daily-dashboard-timeline-strip" });
    parsedSessions.forEach((session) => {
      const segment = strip.createDiv({ cls: `daily-dashboard-timeline-segment is-${session.kind}` });
      const left = (session.startDate.getTime() - startBoundary.getTime()) / totalSpan * 100;
      const width = (session.endDate.getTime() - session.startDate.getTime()) / totalSpan * 100;
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${session.end.slice(11, 16)}${session.tag ? ` \u2022 ${session.tag}` : ""}`;
    });
    const scale = parent.createDiv({ cls: "daily-dashboard-timeline-scale" });
    ["00:00", "06:00", "12:00", "18:00", "24:00"].forEach((label) => {
      scale.createEl("span", { text: label });
    });
  }
  renderRepairTimelineEditor(parent) {
    const sessionKinds = [
      { kind: "work", label: "Work", tone: "capture" },
      { kind: "nap", label: "Nap", tone: "health" },
      { kind: "relax", label: "Relax", tone: "health" },
      { kind: "break", label: "Break", tone: "alert" },
      { kind: "poop", label: "Poop", tone: "log" }
    ];
    const groupedSessions = sessionKinds.map((config) => ({
      ...config,
      sessions: this.state.timelineSessions.filter((session) => session.kind === config.kind)
    }));
    this.renderTimelineStrip(
      parent,
      this.state.timelineSessions.map((session) => ({ ...session, end: session.end || session.start })),
      this.state.date,
      this.state.dayEndedAt || this.state.sleepTime || this.state.dayStartedAt || this.state.wakeTime,
      "No timeline sessions in this repair draft yet."
    );
    groupedSessions.forEach((group) => {
      const block = parent.createDiv({ cls: "daily-dashboard-score-block" });
      const header = block.createDiv({ cls: "daily-dashboard-score-header" });
      header.createEl("strong", { text: group.label });
      createSemanticChip(header, `${group.sessions.length} session${group.sessions.length === 1 ? "" : "s"}`, group.tone);
      if (group.sessions.length === 0) {
        block.createDiv({ cls: "daily-dashboard-row-meta", text: `No ${group.label.toLowerCase()} sessions in this repair draft.` });
      }
      group.sessions.forEach((session) => {
        const row = block.createDiv({ cls: "daily-dashboard-repair-session-row" });
        const startInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "datetime-local" }
        });
        startInput.value = this.toDateTimeLocalValue(session.start);
        startInput.addEventListener("change", () => {
          session.start = startInput.value.trim();
        });
        const endInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "datetime-local" }
        });
        endInput.value = this.toDateTimeLocalValue(session.end);
        endInput.addEventListener("change", () => {
          session.end = endInput.value.trim();
        });
        const tagInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "text", placeholder: "Optional tag" }
        });
        tagInput.value = session.tag;
        tagInput.addEventListener("change", () => {
          session.tag = tagInput.value.trim();
        });
        const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
        removeButton.type = "button";
        removeButton.addEventListener("click", () => {
          this.state.timelineSessions = this.state.timelineSessions.filter((candidate) => candidate.id !== session.id);
          this.onOpen();
        });
      });
      const addButtonRow = block.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(addButtonRow, `Add ${group.label}`, async () => {
        this.state.timelineSessions = [
          ...this.state.timelineSessions,
          this.createRepairTimelineSession(group.kind)
        ];
        this.onOpen();
      }, false, "plus");
    });
  }
  createRepairTimelineSession(kind) {
    const baseStart = this.state.dayStartedAt || this.state.wakeTime || `${this.state.date} 09:00`;
    const [datePart, timePart = "09:00"] = baseStart.split(" ");
    const [hourText, minuteText] = timePart.split(":");
    const nextHour = `${Math.min(23, Number(hourText) + 1)}`.padStart(2, "0");
    return {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      start: `${datePart} ${`${hourText != null ? hourText : "09"}`.padStart(2, "0")}:${`${minuteText != null ? minuteText : "00"}`.padStart(2, "0")}`,
      end: `${datePart} ${nextHour}:${`${minuteText != null ? minuteText : "00"}`.padStart(2, "0")}`,
      tag: ""
    };
  }
};
var PromoteTaskModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, projects) {
    var _a, _b;
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = (_b = (_a = projects[0]) == null ? void 0 : _a.name) != null ? _b : "";
  }
  formatTodoTaskMeta(task) {
    return [
      task.section,
      task.dueDate ? `Due ${task.dueDate}` : "",
      task.isOverdue ? "Overdue" : task.isDueSoon ? "Due soon" : "",
      task.blockedReason ? `Blocked: ${task.blockedReason}` : "",
      task.unblockDate ? `Unblock ${task.unblockDate}` : ""
    ].filter((value) => value.length > 0).join(" \u2022 ");
  }
  onOpen() {
    var _a, _b, _c;
    this.setTitle("Promote Project Task To Today");
    const { contentEl } = this;
    contentEl.empty();
    const projectSetting = new import_obsidian3.Setting(contentEl).setName("Project");
    projectSetting.addDropdown((dropdown) => {
      this.projects.forEach((project) => dropdown.addOption(project.name, project.name));
      dropdown.setValue(this.selectedProjectName);
      dropdown.onChange((value) => {
        this.selectedProjectName = value;
        this.onOpen();
      });
    });
    const selectedProject = this.projects.find((project) => project.name === this.selectedProjectName);
    const candidateTasks = [
      ...(_a = selectedProject == null ? void 0 : selectedProject.nowTaskDetails) != null ? _a : [],
      ...(_b = selectedProject == null ? void 0 : selectedProject.nextTaskDetails) != null ? _b : [],
      ...((_c = selectedProject == null ? void 0 : selectedProject.breakdownTasks) != null ? _c : []).map((task) => ({
        text: task,
        rawText: task,
        section: "Breakdown",
        dueDate: "",
        blockedReason: "",
        unblockDate: "",
        isBlocked: false,
        isDueSoon: false,
        isOverdue: false
      }))
    ].slice(0, 20);
    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new import_obsidian3.Setting(contentEl).setName(task.text).setDesc(this.formatTodoTaskMeta(task)).addButton((button) => {
          button.setButtonText("Promote").setCta().onClick(async () => {
            await this.plugin.promoteTaskToToday(this.selectedProjectName, task.text);
            this.close();
          });
        });
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ProjectReviewModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, options) {
    var _a, _b;
    super(app);
    this.plugin = plugin;
    this.options = options;
    this.selectedProjectName = (_b = (_a = options[0]) == null ? void 0 : _a.projectName) != null ? _b : "";
  }
  onOpen() {
    var _a;
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();
    if (this.options.length > 1) {
      new import_obsidian3.Setting(contentEl).setName("Project").setDesc("Choose which project to open in review mode.").addDropdown((dropdown) => {
        this.options.forEach((option) => dropdown.addOption(option.projectName, option.projectName));
        dropdown.setValue(this.selectedProjectName);
        dropdown.onChange((value) => {
          this.selectedProjectName = value;
          this.onOpen();
        });
      });
    }
    const selectedOption = (_a = this.options.find((option) => option.projectName === this.selectedProjectName)) != null ? _a : this.options[0];
    if (!selectedOption) {
      contentEl.createEl("p", { text: "No project notes found for review mode." });
      return;
    }
    const hero = contentEl.createDiv({ cls: "daily-dashboard-project-review-panel" });
    hero.createEl("h3", { text: selectedOption.projectName });
    const chipRow = hero.createDiv({ cls: "daily-dashboard-chip-row" });
    createSemanticChip(chipRow, selectedOption.healthLabel, selectedOption.healthScore >= 75 ? "focus" : selectedOption.healthScore >= 50 ? "state" : "alert");
    createSemanticChip(chipRow, selectedOption.projectState === "active" ? "Active" : selectedOption.projectState === "incubating" ? "Incubating" : "Someday", selectedOption.projectState === "active" ? "neutral" : "log");
    createSemanticChip(chipRow, selectedOption.status, "capture");
    hero.createEl("p", { cls: "daily-dashboard-row-meta", text: selectedOption.notePath });
    hero.createEl("p", { cls: "daily-dashboard-row-meta", text: `Next action: ${selectedOption.nextAction}` });
    renderProjectMomentum(hero, selectedOption);
    const details = contentEl.createDiv({ cls: "daily-dashboard-project-list" });
    if (selectedOption.healthReasons.length > 0) {
      const row = details.createDiv({ cls: "daily-dashboard-project-row" });
      row.createEl("strong", { text: "Health signals" });
      row.createEl("span", { cls: "daily-dashboard-row-meta", text: selectedOption.healthReasons.join(" \u2022 ") });
    }
    const pressureRow = details.createDiv({ cls: "daily-dashboard-project-row" });
    pressureRow.createEl("strong", { text: "Task pressure" });
    pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue ${selectedOption.overdueTasks.length} \u2022 Due soon ${selectedOption.dueSoonTasks.length} \u2022 Blocked ${selectedOption.blockedTasks.length}` });
    if (selectedOption.overdueTasks.length > 0) {
      pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue tasks: ${selectedOption.overdueTasks.slice(0, 3).map((task) => task.text).join(" \u2022 ")}` });
    }
    if (selectedOption.blockedTasks.length > 0) {
      pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked tasks: ${selectedOption.blockedTasks.slice(0, 3).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" \u2022 ")}` });
    }
    if (selectedOption.duplicateTasks.length > 0 || selectedOption.emptySections.length > 0) {
      const cleanupRow = details.createDiv({ cls: "daily-dashboard-project-row" });
      cleanupRow.createEl("strong", { text: "Cleanup signals" });
      if (selectedOption.duplicateTasks.length > 0) {
        cleanupRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Duplicates: ${selectedOption.duplicateTasks.slice(0, 5).join(" \u2022 ")}` });
      }
      if (selectedOption.emptySections.length > 0) {
        cleanupRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Empty sections: ${selectedOption.emptySections.join(" \u2022 ")}` });
      }
    }
    const actions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(actions, "Open split view", async () => {
      await this.plugin.openProjectReviewMode(selectedOption);
      this.close();
    }, true, "layout-panel-left");
    createButton(actions, "Structured review", async () => {
      await this.plugin.openStructuredProjectReview(selectedOption);
      this.close();
    }, false, "clipboard-list");
    const list = contentEl.createDiv({ cls: "daily-dashboard-project-list" });
    this.options.forEach((option) => {
      new import_obsidian3.Setting(list).setName(option.projectName).setDesc(`${option.healthLabel} \u2022 ${option.completionsThisWeek} this week \u2022 ${option.status}`).addButton((button) => {
        button.setButtonText(option.projectName === selectedOption.projectName ? "Selected" : "Select").setCta().onClick(() => {
          this.selectedProjectName = option.projectName;
          this.onOpen();
        });
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AskAiModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.question = "";
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Ask AI About Your Dashboard");
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian3.Setting(contentEl).setName("Question").setDesc("Ask about priorities, stalled projects, habit drift, workload balance, or anything else grounded in the dashboard context.").addTextArea((textArea) => {
      textArea.setPlaceholder("What should I focus on next? Which project is costing me the most attention? What pattern am I missing?").setValue(this.question).onChange((value) => {
        this.question = value;
      });
      textArea.inputEl.rows = 6;
      window.setTimeout(() => textArea.inputEl.focus(), 0);
    });
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText("Ask AI").setCta().onClick(async () => {
        if (!this.question.trim()) {
          new import_obsidian3.Notice("Enter a question first.");
          return;
        }
        await this.plugin.askAiQuestion(this.question);
        this.close();
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Cancel").onClick(() => {
        this.close();
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DailyDashboardSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();
    containerEl.empty();
    containerEl.addClass("daily-dashboard-settings-tab");
    containerEl.createEl("h2", { text: "Obsidian DASH - Daily Action & System Hub" });
    new import_obsidian3.Setting(containerEl).setName("Setup wizard").setDesc("Launch the guided setup flow again if you want to re-walk the initial dashboard configuration.").addButton((button) => {
      button.setButtonText("Open wizard").setCta().onClick(() => {
        void this.plugin.openFirstRunSetupWizard();
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Dashboard title").setDesc("Displayed at the top of the custom dashboard tab.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dashboardTitle).setValue(settings.dashboardTitle).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dashboardTitle: value.trim() || DEFAULT_SETTINGS.dashboardTitle
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Master Task Hub note path").setDesc("The note used for project task counts, project creation, and archive automation.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.masterTodoPath).setValue(settings.masterTodoPath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          masterTodoPath: value.trim() || DEFAULT_SETTINGS.masterTodoPath
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Project notes folder").setDesc("New project notes created by the intake flow are written here.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder).setValue(settings.projectNotesFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          projectNotesFolder: value.trim() || DEFAULT_SETTINGS.projectNotesFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Daily log folder").setDesc("Markdown logs written once per day.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder).setValue(settings.dailyLogFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dailyLogFolder: value.trim() || DEFAULT_SETTINGS.dailyLogFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Weekly report folder").setDesc("Where generated weekly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder).setValue(settings.weeklyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weeklyReportFolder: value.trim() || DEFAULT_SETTINGS.weeklyReportFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Monthly report folder").setDesc("Where generated monthly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder).setValue(settings.monthlyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          monthlyReportFolder: value.trim() || DEFAULT_SETTINGS.monthlyReportFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Export folder").setDesc("Where markdown summaries and CSV metric dumps are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.exportFolder).setValue(settings.exportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          exportFolder: value.trim() || DEFAULT_SETTINGS.exportFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Generated document tags").setDesc("Comma or line-separated tags added to plugin-created markdown files so logs, reports, AI notes, and exports are easier to filter and graph.").addTextArea((textArea) => {
      textArea.setPlaceholder("daily-dashboard\ndaily-dashboard/generated").setValue(settings.generatedDocumentTags).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          generatedDocumentTags: value
        });
      });
      textArea.inputEl.rows = 3;
      textArea.inputEl.cols = 36;
    });
    containerEl.createEl("h3", { text: "Calendar" });
    new import_obsidian3.Setting(containerEl).setName("Enable calendar reminders").setDesc("Show upcoming calendar events below Top 3 and raise notices inside the warning window.").addToggle((toggle) => {
      toggle.setValue(settings.calendarEnabled).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          calendarEnabled: value
        });
        this.display();
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Calendar behavior").setDesc("Events are stored in plugin data, synced to a calendar markdown note, and rendered into daily logs when those days are written.");
    new import_obsidian3.Setting(containerEl).setName("Calendar document path").setDesc("Markdown note that stores the full calendar event list and upcoming occurrences for AI and manual review.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.calendarDocumentPath).setValue(settings.calendarDocumentPath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          calendarDocumentPath: value.trim() || DEFAULT_SETTINGS.calendarDocumentPath
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Calendar lookahead hours").setDesc("How far ahead the Execution card should look when listing upcoming reminders.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.calendarLookaheadHours}`).setValue(`${settings.calendarLookaheadHours}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          calendarLookaheadHours: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.calendarLookaheadHours), 1), 336)
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Calendar warning hours").setDesc("Events inside this window trigger a dashboard notice and get marked as soon.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.calendarWarningHours}`).setValue(`${settings.calendarWarningHours}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          calendarWarningHours: Math.min(
            Math.max(Number(value.trim() || DEFAULT_SETTINGS.calendarWarningHours), 1),
            this.plugin.getSettings().calendarLookaheadHours
          )
        });
      });
    });
    containerEl.createEl("h3", { text: "Tracking" });
    new import_obsidian3.Setting(containerEl).setName("Measurement system").setDesc("Controls default liquid units and quick-add presets for hydration or similar tracked amounts.").addDropdown((dropdown) => {
      dropdown.addOption("imperial", "Imperial (oz, cup)");
      dropdown.addOption("metric", "Metric (mL)");
      dropdown.setValue(settings.measurementSystem);
      dropdown.onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          measurementSystem: value === "metric" ? "metric" : "imperial"
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Weight goal target").setDesc("Used by the exercise card to compare logged body weight against the current goal.").addText((text) => {
      text.setPlaceholder("0").setValue(`${settings.weightGoalTarget}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weightGoalTarget: Math.max(Number(value.trim() || 0), 0)
        });
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.step = "0.1";
    });
    new import_obsidian3.Setting(containerEl).setName("Weight goal mode").setDesc("Choose whether current training should bias toward losing, maintaining, or gaining weight.").addDropdown((dropdown) => {
      dropdown.addOption("lose", "Lose");
      dropdown.addOption("maintain", "Maintain");
      dropdown.addOption("gain", "Gain");
      dropdown.setValue(settings.weightGoalMode);
      dropdown.onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weightGoalMode: value === "lose" || value === "gain" ? value : "maintain"
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Weekly weight pace").setDesc("Target rate of change per week for the current goal, using the active measurement system.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.weightGoalWeeklyRate}`).setValue(`${settings.weightGoalWeeklyRate}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weightGoalWeeklyRate: Math.max(Number(value.trim() || DEFAULT_SETTINGS.weightGoalWeeklyRate), 0)
        });
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.step = "0.1";
    });
    new import_obsidian3.Setting(containerEl).setName("Show undo notifications").setDesc("Keep the undo stack active while choosing whether the dashboard shows the undo banner after destructive actions.").addToggle((toggle) => {
      toggle.setValue(settings.showUndoNotifications).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          showUndoNotifications: value
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Notification sound").setDesc("Play a short sound when the dashboard raises a new reminder or logical-day notice. Turn it off here if you only want visual notices.").addDropdown((dropdown) => {
      dropdown.addOption("off", "Off");
      dropdown.addOption("chime", "Chime");
      dropdown.addOption("ping", "Ping");
      dropdown.addOption("alert", "Alert");
      dropdown.setValue(settings.notificationSound);
      dropdown.onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          notificationSound: value === "off" || value === "ping" || value === "alert" ? value : "chime"
        });
      });
    });
    containerEl.createEl("h3", { text: "AI" });
    new import_obsidian3.Setting(containerEl).setName("AI API key source").setDesc("Environment variables are safer because the raw key is not persisted in plugin data.").addDropdown((dropdown) => {
      dropdown.addOption("settings", "Stored in plugin settings");
      dropdown.addOption("env", "Environment variable");
      dropdown.setValue(settings.aiApiKeySource);
      dropdown.onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiApiKeySource: value === "env" ? "env" : "settings"
        });
        this.display();
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI environment variable").setDesc("Only used when the key source is Environment variable.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiApiKeyEnvVar).setValue(settings.aiApiKeyEnvVar).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiApiKeyEnvVar: value.trim() || DEFAULT_SETTINGS.aiApiKeyEnvVar
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Stored OpenAI API key").setDesc(settings.aiApiKeySource === "env" ? "Ignored while environment-variable mode is active. Clear it if you do not want a fallback key saved in plugin data." : "Used for AI planning, reflection, triage, and question answering when stored-key mode is active.").addText((text) => {
      text.setPlaceholder("sk-...").setValue(settings.aiApiKey).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiApiKey: value.trim()
        });
      });
      text.inputEl.type = "password";
    }).addButton((button) => {
      button.setButtonText("Clear").onClick(async () => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiApiKey: ""
        });
        this.display();
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI model").setDesc("Recommended default: gpt-4o-mini for strong cost-to-quality balance. You can enter any compatible OpenAI chat-completions model.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiModel).setValue(settings.aiModel).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiModel: value.trim() || DEFAULT_SETTINGS.aiModel
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI API URL").setDesc("Defaults to OpenAI chat completions. Change this only if you know you need a different compatible endpoint.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiBaseUrl).setValue(settings.aiBaseUrl).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiBaseUrl: value.trim() || DEFAULT_SETTINGS.aiBaseUrl
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI output folder").setDesc("Generated AI planning and analysis notes are written here.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder).setValue(settings.aiOutputFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiOutputFolder: value.trim() || DEFAULT_SETTINGS.aiOutputFolder
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Basic information note path").setDesc("Reusable personal context note for AI. The command palette can create or open this template, and AI requests can include it automatically.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.basicInfoNotePath).setValue(settings.basicInfoNotePath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          basicInfoNotePath: value.trim() || DEFAULT_SETTINGS.basicInfoNotePath
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Include basic information in AI").setDesc("Inject the Basic Information note into AI context when it exists, so long-term facts do not need to be repeated in each prompt.").addToggle((toggle) => {
      toggle.setValue(settings.includeBasicInfoInAi).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          includeBasicInfoInAi: value
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI prompt templates").setDesc("Optional local workflow instructions. Use [workflow-key] headings such as [morning-startup-brief] or [project-risk-scanner], then write the extra instructions below each heading.").addTextArea((textArea) => {
      textArea.setPlaceholder(DEFAULT_SETTINGS.aiPromptTemplates).setValue(settings.aiPromptTemplates).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiPromptTemplates: value
        });
      });
      textArea.inputEl.rows = 14;
      textArea.inputEl.cols = 36;
    });
    new import_obsidian3.Setting(containerEl).setName("AI context days").setDesc("How many recent daily entries are summarized into AI prompts by default.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiContextDays}`).setValue(`${settings.aiContextDays}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiContextDays: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiContextDays), 3), 60)
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI related note limit").setDesc("How many relevant vault notes are pulled into AI context for deeper analysis.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiRelatedNotesLimit}`).setValue(`${settings.aiRelatedNotesLimit}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiRelatedNotesLimit: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiRelatedNotesLimit), 2), 16)
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Enable AI note index").setDesc("Cache scoped markdown notes so AI retrieval does not rescan the whole vault on every request.").addToggle((toggle) => {
      toggle.setValue(settings.aiIndexEnabled).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiIndexEnabled: value
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI indexed folders").setDesc("One folder per line. Only these folders are cached for AI retrieval, plus the master task hub and active note when applicable.").addTextArea((textArea) => {
      textArea.setPlaceholder("Project Notes\nReference\nJournal").setValue(settings.aiIndexedFolders).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiIndexedFolders: value
        });
      });
      textArea.inputEl.rows = 4;
      textArea.inputEl.cols = 36;
    });
    new import_obsidian3.Setting(containerEl).setName("AI chunk character limit").setDesc("Approximate maximum size for cached note chunks used during retrieval.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiChunkCharLimit}`).setValue(`${settings.aiChunkCharLimit}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiChunkCharLimit: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiChunkCharLimit), 300), 3e3)
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Enable AI embeddings").setDesc("Optionally generate embeddings for indexed note chunks so retrieval can rank by semantic similarity, not just keywords.").addToggle((toggle) => {
      toggle.setValue(settings.aiEmbeddingsEnabled).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingsEnabled: value
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI embedding model").setDesc("Recommended default: text-embedding-3-small for strong cost efficiency on scoped note indexing.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingModel).setValue(settings.aiEmbeddingModel).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingModel: value.trim() || DEFAULT_SETTINGS.aiEmbeddingModel
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("AI embedding API URL").setDesc("Defaults to OpenAI embeddings. Change only if you are intentionally targeting a compatible embeddings endpoint.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingApiUrl).setValue(settings.aiEmbeddingApiUrl).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingApiUrl: value.trim() || DEFAULT_SETTINGS.aiEmbeddingApiUrl
        });
      });
    });
    containerEl.createEl("h3", { text: "Appearance" });
    new import_obsidian3.Setting(containerEl).setName("Wallpaper folder").setDesc("Image folder used for dashboard hero wallpapers.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.wallpaperFolder).setValue(settings.wallpaperFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          wallpaperFolder: value.trim() || DEFAULT_SETTINGS.wallpaperFolder,
          selectedWallpaper: ""
        });
        this.display();
      });
    });
    const wallpaperFiles = this.plugin.getWallpaperFiles();
    new import_obsidian3.Setting(containerEl).setName("Selected wallpaper").setDesc(wallpaperFiles.length > 0 ? "Choose the image shown in the top section of the dashboard." : "No image files were found in the configured wallpaper folder.").addDropdown((dropdown) => {
      dropdown.addOption("", "Default / first image");
      wallpaperFiles.forEach((file) => {
        dropdown.addOption(file.path, file.displayName);
      });
      dropdown.setValue(this.plugin.getSelectedWallpaperPath());
      dropdown.onChange(async (value) => {
        var _a;
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          selectedWallpaper: value ? (_a = value.split("/").pop()) != null ? _a : value : value
        });
      });
    });
    new import_obsidian3.Setting(containerEl).setName("Habit definitions").setDesc("One habit per line using Habit Name|Target Count|Window|Cadence|Weight|Anchor Date. Older shorter lines still work.").addTextArea((textArea) => {
      textArea.setPlaceholder("Take pills|1|morning|daily|2\nWater plants|1|anytime|every-other-day|1\nTrash night|1|evening|weekly|1|2026-04-01").setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}|${habit.completionWindow}|${habit.cadence}|${habit.difficultyWeight}|${habit.anchorDate}`).join("\n")).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          habitDefinitions: parseHabitDefinitions(value)
        });
      });
      textArea.inputEl.rows = 8;
      textArea.inputEl.cols = 36;
    });
    new import_obsidian3.Setting(containerEl).setName("Habit automations").setDesc("One automation per line using Habit Name|Kind|Label|Amount|Unit|Optional Note. Each time the habit count increases, matching consumables are logged at that timestamp.").addTextArea((textArea) => {
      const habitLabelById = new Map(settings.habitDefinitions.map((habit) => [habit.id, habit.label]));
      textArea.setPlaceholder("Take pills|medication|Vyvanse|1|capsule\nTake pills|supplement|Vitamin D|1|softgel").setValue(settings.habitAutomations.map((automation) => {
        var _a;
        return `${(_a = habitLabelById.get(automation.habitId)) != null ? _a : automation.habitId}|${automation.intakeKind}|${automation.label}|${automation.amount}|${automation.unit}|${automation.note}`;
      }).join("\n")).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          habitAutomations: parseHabitAutomations(value, this.plugin.getHabitDefinitions())
        });
      });
      textArea.inputEl.rows = 6;
      textArea.inputEl.cols = 36;
    });
    new import_obsidian3.Setting(containerEl).setName("Routine templates").setDesc("One routine per line using Label|HH:MM|HH:MM. These drive notifications and compact routine cues in Session Deck when their time window is due or coming up.").addTextArea((textArea) => {
      textArea.setPlaceholder("Morning meds|06:00|09:00\nLunch reset|12:00|14:00\nEvening shutdown|20:00|22:30").setValue(settings.routineTemplates).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          routineTemplates: value
        });
      });
      textArea.inputEl.rows = 6;
      textArea.inputEl.cols = 36;
    });
  }
};
var DASHBOARD_CARD_COLLAPSE_STORAGE_KEY = "daily-dashboard-collapsed-cards";
var DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY = "daily-dashboard-expanded-sections";
var DASHBOARD_VIEW_MODE_STORAGE_KEY = "daily-dashboard-view-mode";
var DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY = "daily-dashboard-collapsed-subsections";
var DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY = "daily-dashboard-dismissed-reminders";
var DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY = "daily-dashboard-dismissed-routines";
var DASHBOARD_SAVED_FILTERS_STORAGE_KEY = "daily-dashboard-saved-filters";
var DASHBOARD_SELECTED_FILTER_STORAGE_KEY = "daily-dashboard-selected-filter";
var DASHBOARD_CARD_LAYOUT_STORAGE_KEY = "daily-dashboard-card-layout";
var DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY = "daily-dashboard-textarea-heights";
var DEFAULT_DASHBOARD_LAYOUT_CARDS = [
  { key: "week-at-a-glance", title: "Week At A Glance", order: 0, hidden: false, pinned: false, width: "full" },
  { key: "weekly-agenda", title: "Weekly Agenda", order: 1, hidden: false, pinned: false, width: "full" },
  { key: "top-3-for-today", title: "Execution Hub", order: 2, hidden: false, pinned: false, width: "default" },
  { key: "state-and-friction", title: "Vitals", order: 3, hidden: false, pinned: false, width: "default" },
  { key: "gamification-center", title: "Gamification Center", order: 4, hidden: false, pinned: false, width: "default" },
  { key: "habits", title: "Habits", order: 5, hidden: false, pinned: false, width: "default" },
  { key: "food-log", title: "Consumables", order: 6, hidden: false, pinned: false, width: "default" },
  { key: "exercise-weight", title: "Exercise & Weight", order: 7, hidden: false, pinned: false, width: "default" },
  { key: "sleep-and-notes", title: "Sleep And Notes", order: 8, hidden: false, pinned: false, width: "default" },
  { key: "timeline-search", title: "Timeline Search", order: 9, hidden: false, pinned: false, width: "default" },
  { key: "heatmaps", title: "Heatmaps", order: 10, hidden: false, pinned: false, width: "default" },
  { key: "ai-workspace", title: "AI Workspace", order: 11, hidden: false, pinned: false, width: "full" },
  { key: "project-health", title: "Project Health", order: 12, hidden: false, pinned: false, width: "default" },
  { key: "stale-work-and-cleanup", title: "Stale Work And Cleanup", order: 13, hidden: false, pinned: false, width: "default" }
];
var DASHBOARD_SHORTCUTS = [
  { keys: "Alt+Shift+V", label: "Cycle view mode", description: "Switch between mobile, compact, and widescreen modes." },
  { keys: "Alt+Shift+L", label: "Open layout editor", description: "Customize card order, pinned cards, and hidden cards." },
  { keys: "Alt+Shift+N", label: "Create project", description: "Open the new-project flow from anywhere inside the dashboard." },
  { keys: "Alt+Shift+W", label: "Weekly review", description: "Generate the weekly review note." },
  { keys: "Alt+Shift+R", label: "Refresh dashboard", description: "Rerender the dashboard with the latest state." },
  { keys: "Alt+Shift+F", label: "Quick capture focus", description: "Open the fast focus-capture flow." },
  { keys: "Alt+Shift+A", label: "Ask AI", description: "Open the dashboard ask-AI modal." },
  { keys: "Alt+Shift+S", label: "Sync repeating tasks", description: "Run repeating-task sync against the project hub." },
  { keys: "Alt+Shift+Z", label: "Undo last action", description: "Undo the most recent dashboard destructive action even if the banner is hidden." },
  { keys: "Alt+Shift+?", label: "Show shortcut help", description: "Open this shortcut list." }
];
var FIRST_RUN_SETUP_STEPS = [
  {
    shortLabel: "Identity",
    title: "Name the dashboard and log destination",
    description: "Start with the title and daily-log location so the dashboard writes somewhere intentional from day one."
  },
  {
    shortLabel: "Projects",
    title: "Connect the project workflow",
    description: "Point the plugin at the master task hub and project-notes folder used for health, quick add, and cleanup flows."
  },
  {
    shortLabel: "Tracking",
    title: "Confirm reporting and calendar paths",
    description: "Set the output folders for weekly, monthly, and export files, then decide whether the calendar should be active immediately."
  },
  {
    shortLabel: "AI",
    title: "Choose the AI defaults",
    description: "Pick where AI notes go and whether the plugin should read its key from settings or an environment variable."
  }
];
function createCard(parent, title, description, options) {
  const cardKey = toClassSlug(title);
  const card = parent.createDiv({ cls: "daily-dashboard-card" });
  card.addClass(`daily-dashboard-card--${cardKey}`);
  const startCollapsed = getCollapsedCardState().has(cardKey);
  if (startCollapsed) {
    card.addClass("is-collapsed");
  }
  const header = card.createDiv({ cls: "daily-dashboard-card-header" });
  header.role = "button";
  header.tabIndex = 0;
  header.ariaExpanded = startCollapsed ? "false" : "true";
  if (options) {
    card.addClass(`is-tone-${options.tone}`);
    header.addClass(`is-${options.tone}`);
    const top = header.createDiv({ cls: "daily-dashboard-card-header-top" });
    const lead = top.createDiv({ cls: "daily-dashboard-card-lead" });
    const iconEl = lead.createSpan({ cls: "daily-dashboard-card-icon" });
    (0, import_obsidian3.setIcon)(iconEl, options.icon);
    lead.createEl("span", { cls: "daily-dashboard-card-eyebrow", text: options.eyebrow });
    const controls = top.createDiv({ cls: "daily-dashboard-card-header-controls" });
    if (options.tag) {
      createSemanticChip(controls, options.tag, options.tone);
    }
    const toggle = controls.createSpan({ cls: "daily-dashboard-card-toggle" });
    toggle.ariaHidden = "true";
    (0, import_obsidian3.setIcon)(toggle, "chevron-down");
  }
  header.createEl("h2", { text: title });
  header.createEl("p", { text: description });
  const toggleCollapsed = () => {
    const nextCollapsed = !card.hasClass("is-collapsed");
    card.toggleClass("is-collapsed", nextCollapsed);
    header.ariaExpanded = nextCollapsed ? "false" : "true";
    setCollapsedCardState(cardKey, nextCollapsed);
  };
  header.addEventListener("click", () => {
    toggleCollapsed();
  });
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapsed();
    }
  });
  return card;
}
function createButton(parent, text, onClick, isPrimary = false, iconName) {
  const button = parent.createEl("button", {
    cls: isPrimary ? "daily-dashboard-primary-button" : "daily-dashboard-secondary-button"
  });
  if (iconName) {
    const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
    (0, import_obsidian3.setIcon)(iconEl, iconName);
  }
  button.createSpan({ cls: "daily-dashboard-button-label", text });
  button.type = "button";
  button.addEventListener("click", () => {
    void onClick();
  });
}
function createIconButton(parent, iconName, label, onClick) {
  const button = parent.createEl("button", { cls: "daily-dashboard-icon-button" });
  button.type = "button";
  button.ariaLabel = label;
  button.title = label;
  const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
  (0, import_obsidian3.setIcon)(iconEl, iconName);
  button.addEventListener("click", () => {
    void onClick();
  });
}
function createSemanticChip(parent, text, tone) {
  const chip = parent.createSpan({ cls: "daily-dashboard-semantic-chip" });
  chip.addClass(`is-${tone}`);
  chip.setText(text);
  return chip;
}
function createStatPill(parent, text, iconName, tone) {
  const pill = parent.createDiv({ cls: tone === "date" ? "daily-dashboard-date-pill" : "daily-dashboard-stat-pill" });
  pill.addClass(`is-${tone}`);
  const iconEl = pill.createSpan({ cls: "daily-dashboard-pill-icon" });
  (0, import_obsidian3.setIcon)(iconEl, iconName);
  pill.createSpan({ cls: "daily-dashboard-pill-label", text });
  return pill;
}
function renderGamificationSnapshotCard(parent, snapshot) {
  const card = parent.createDiv({ cls: "daily-dashboard-score-block daily-dashboard-gamification-card" });
  const header = card.createDiv({ cls: "daily-dashboard-score-header" });
  header.createEl("strong", { text: `${snapshot.label} \u2022 ${snapshot.score}/100 ${snapshot.grade}` });
  header.createEl("span", { cls: "daily-dashboard-row-meta", text: snapshot.comparisonText });
  const chipRow = card.createDiv({ cls: "daily-dashboard-chip-row" });
  snapshot.highlights.slice(0, 3).forEach((item) => createSemanticChip(chipRow, item, "done"));
  snapshot.cautions.slice(0, 3).forEach((item) => createSemanticChip(chipRow, item, "alert"));
  const categoryList = card.createDiv({ cls: "daily-dashboard-momentum" });
  snapshot.categories.forEach((category) => {
    const row = categoryList.createDiv({ cls: "daily-dashboard-gamification-row" });
    const copy = row.createDiv({ cls: "daily-dashboard-stack" });
    copy.createEl("strong", { text: `${category.label} \u2022 ${category.score}/100` });
    copy.createEl("span", { cls: "daily-dashboard-row-meta", text: category.summary });
    if (category.details.length > 0) {
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: category.details.join(" \u2022 ") });
    }
    const trackRow = row.createDiv({ cls: "daily-dashboard-momentum-row" });
    trackRow.createSpan({ cls: "daily-dashboard-momentum-label", text: "Score" });
    const track = trackRow.createDiv({ cls: "daily-dashboard-momentum-track" });
    const fill = track.createDiv({ cls: "daily-dashboard-momentum-fill" });
    fill.addClass(`is-${category.tone === "done" ? "done" : category.tone === "alert" ? "alert" : category.tone === "log" ? "log" : "focus"}`);
    fill.style.width = `${Math.max(category.score / category.maxScore * 100, category.score > 0 ? 10 : 0)}%`;
    trackRow.createSpan({ cls: "daily-dashboard-momentum-value", text: `${category.score}` });
  });
}
function renderProjectMomentum(parent, project) {
  const maxValue = Math.max(project.completionsPreviousWeek, project.completionsThisWeek, project.completionsThisMonth, 1);
  const wrap = parent.createDiv({ cls: "daily-dashboard-momentum" });
  renderMomentumBar(wrap, "Prev week", project.completionsPreviousWeek, maxValue, "log");
  renderMomentumBar(wrap, "This week", project.completionsThisWeek, maxValue, project.completionsThisWeek >= project.completionsPreviousWeek ? "done" : "alert");
  renderMomentumBar(wrap, "Month", project.completionsThisMonth, maxValue, "focus");
}
function renderMomentumBar(parent, label, value, maxValue, tone) {
  const row = parent.createDiv({ cls: "daily-dashboard-momentum-row" });
  row.createSpan({ cls: "daily-dashboard-momentum-label", text: label });
  const track = row.createDiv({ cls: "daily-dashboard-momentum-track" });
  const fill = track.createDiv({ cls: "daily-dashboard-momentum-fill" });
  fill.addClass(`is-${tone}`);
  fill.style.width = `${Math.max(value / maxValue * 100, value > 0 ? 10 : 0)}%`;
  row.createSpan({ cls: "daily-dashboard-momentum-value", text: `${value}` });
}
function getProjectIssueCount(project) {
  return (project.staleDays !== null ? 1 : 0) + project.duplicateTasks.length + project.emptySections.length + project.breakdownTasks.length + project.overdueTasks.length + project.blockedTasks.length;
}
function getProjectLastWorkedSortKey(project) {
  var _a;
  return (_a = project.lastCompletedAt) != null ? _a : "";
}
function getCollapsedCardState() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_CARD_COLLAPSE_STORAGE_KEY);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === "string")) : /* @__PURE__ */ new Set();
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
}
function setCollapsedCardState(cardKey, collapsed) {
  try {
    const current = getCollapsedCardState();
    if (collapsed) {
      current.add(cardKey);
    } else {
      current.delete(cardKey);
    }
    window.localStorage.setItem(DASHBOARD_CARD_COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
  }
}
function getDashboardExpandedSections() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === "string")) : /* @__PURE__ */ new Set();
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
}
function setDashboardSectionExpanded(sectionKey, expanded) {
  try {
    const current = getDashboardExpandedSections();
    if (expanded) {
      current.add(sectionKey);
    } else {
      current.delete(sectionKey);
    }
    window.localStorage.setItem(DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
  }
}
function getDashboardViewMode() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY);
    return stored === "compact" || stored === "widescreen" ? stored : "mobile";
  } catch (e) {
    return "mobile";
  }
}
function setDashboardViewMode(mode) {
  try {
    window.localStorage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, mode);
  } catch (e) {
  }
}
function getDashboardSelectedFilterName() {
  var _a, _b;
  try {
    return (_b = (_a = window.localStorage.getItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY)) == null ? void 0 : _a.trim()) != null ? _b : "";
  } catch (e) {
    return "";
  }
}
function setDashboardSelectedFilterName(name) {
  try {
    if (!name.trim()) {
      window.localStorage.removeItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY, name.trim());
  } catch (e) {
  }
}
function getSavedDashboardFilters() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_SAVED_FILTERS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item) => Boolean(item && typeof item === "object" && typeof item.name === "string")).map((item) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L;
      return {
        name: item.name.trim(),
        workLogFilters: {
          project: (_d = (_c = (_b = (_a = item.workLogFilters) == null ? void 0 : _a.project) == null ? void 0 : _b.trim) == null ? void 0 : _c.call(_b)) != null ? _d : "",
          keyword: (_h = (_g = (_f = (_e = item.workLogFilters) == null ? void 0 : _e.keyword) == null ? void 0 : _f.trim) == null ? void 0 : _g.call(_f)) != null ? _h : "",
          fromDate: (_l = (_k = (_j = (_i = item.workLogFilters) == null ? void 0 : _i.fromDate) == null ? void 0 : _j.trim) == null ? void 0 : _k.call(_j)) != null ? _l : "",
          toDate: (_p = (_o = (_n = (_m = item.workLogFilters) == null ? void 0 : _m.toDate) == null ? void 0 : _n.trim) == null ? void 0 : _o.call(_n)) != null ? _p : ""
        },
        timelineFilters: {
          keyword: (_t = (_s = (_r = (_q = item.timelineFilters) == null ? void 0 : _q.keyword) == null ? void 0 : _r.trim) == null ? void 0 : _s.call(_r)) != null ? _t : "",
          project: (_x = (_w = (_v = (_u = item.timelineFilters) == null ? void 0 : _u.project) == null ? void 0 : _v.trim) == null ? void 0 : _w.call(_v)) != null ? _x : "",
          tag: (_B = (_A = (_z = (_y = item.timelineFilters) == null ? void 0 : _y.tag) == null ? void 0 : _z.trim) == null ? void 0 : _A.call(_z)) != null ? _B : "",
          kinds: Array.isArray((_C = item.timelineFilters) == null ? void 0 : _C.kinds) ? item.timelineFilters.kinds.filter((kind) => kind === "task" || kind === "session" || kind === "calendar" || kind === "log") : ["task", "session", "calendar", "log"],
          fromDate: (_G = (_F = (_E = (_D = item.timelineFilters) == null ? void 0 : _D.fromDate) == null ? void 0 : _E.trim) == null ? void 0 : _F.call(_E)) != null ? _G : "",
          toDate: (_K = (_J = (_I = (_H = item.timelineFilters) == null ? void 0 : _H.toDate) == null ? void 0 : _I.trim) == null ? void 0 : _J.call(_I)) != null ? _K : "",
          onlyWithNotes: Boolean((_L = item.timelineFilters) == null ? void 0 : _L.onlyWithNotes)
        }
      };
    }).filter((item) => item.name.length > 0);
  } catch (e) {
    return [];
  }
}
function setSavedDashboardFilters(filters) {
  try {
    window.localStorage.setItem(DASHBOARD_SAVED_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
  }
}
function getDashboardCardLayoutState() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_CARD_LAYOUT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
    }
    const parsed = JSON.parse(stored);
    return normalizeDashboardCardLayoutState(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
  }
}
function setDashboardCardLayoutState(cards) {
  try {
    window.localStorage.setItem(DASHBOARD_CARD_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeDashboardCardLayoutState(cards)));
  } catch (e) {
  }
}
function normalizeDashboardCardLayoutState(cards) {
  const storedByKey = /* @__PURE__ */ new Map();
  cards.forEach((card) => {
    if (!card || typeof card !== "object") {
      return;
    }
    const candidate = card;
    if (typeof candidate.key !== "string") {
      return;
    }
    storedByKey.set(candidate.key, candidate);
  });
  return DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => {
    const stored = storedByKey.get(card.key);
    return {
      key: card.key,
      title: card.title,
      order: typeof (stored == null ? void 0 : stored.order) === "number" && Number.isFinite(stored.order) ? stored.order : card.order,
      hidden: Boolean(stored == null ? void 0 : stored.hidden),
      pinned: typeof (stored == null ? void 0 : stored.pinned) === "boolean" ? stored.pinned : card.pinned,
      width: (stored == null ? void 0 : stored.width) === "half" || (stored == null ? void 0 : stored.width) === "full" ? stored.width : card.width
    };
  }).sort((left, right) => left.order - right.order).map((card, index) => ({ ...card, order: index }));
}
function getDashboardTextareaHeights() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    return Object.fromEntries(
      Object.entries(parsed).filter((item) => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0)
    );
  } catch (e) {
    return {};
  }
}
function getDashboardTextareaHeight(key) {
  var _a;
  return (_a = getDashboardTextareaHeights()[key]) != null ? _a : "";
}
function setDashboardTextareaHeight(key, height) {
  try {
    const current = getDashboardTextareaHeights();
    if (height.trim().length === 0) {
      delete current[key];
    } else {
      current[key] = height.trim();
    }
    window.localStorage.setItem(DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
  }
}
function getDefaultIntakeUnit(kind, measurementSystem) {
  if (kind === "drink") {
    return measurementSystem === "metric" ? "mL" : "oz";
  }
  if (kind === "medication") {
    return "pill";
  }
  return "serving";
}
function resolveIntakeUnitValue(unit, kind, measurementSystem) {
  const trimmedUnit = unit.trim();
  return trimmedUnit.length > 0 ? trimmedUnit : getDefaultIntakeUnit(kind, measurementSystem);
}
function buildIntakeQuickPreset(input) {
  const label = input.label.trim();
  const unit = input.unit.trim();
  const amount = Math.min(Math.max(Number(input.amount) || 1, 0.1), 9999);
  const kind = input.kind === "food" || input.kind === "supplement" || input.kind === "medication" || input.kind === "drink" ? input.kind : "drink";
  const slug = `${kind}-${label.toLowerCase()}-${amount}-${unit.toLowerCase()}`.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    id: slug,
    kind,
    label,
    amount,
    unit
  };
}
function formatIntakeQuickPresetButtonLabel(preset) {
  return `${preset.label} ${preset.amount} ${preset.unit}`;
}
function getIntakePresetIcon(kind) {
  if (kind === "food") {
    return "utensils-crossed";
  }
  if (kind === "supplement" || kind === "medication") {
    return "pill";
  }
  return "glass-water";
}
function sortDashboardLayoutCards(cards) {
  return [...cards].sort((left, right) => {
    const pinDelta = Number(right.pinned) - Number(left.pinned);
    if (pinDelta !== 0) {
      return pinDelta;
    }
    const orderDelta = left.order - right.order;
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return left.title.localeCompare(right.title);
  });
}
function sortDashboardLayoutCardsByOrder(cards) {
  return [...cards].sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}
function cloneTodayFocusItem(item) {
  return {
    ...item,
    workSessions: item.workSessions.map((session) => ({ ...session }))
  };
}
function cloneNextUpFocusItem(item) {
  return {
    ...item
  };
}
function getCollapsedSubsectionState() {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === "string")) : /* @__PURE__ */ new Set();
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
}
function setCollapsedSubsectionState(sectionKey, collapsed) {
  try {
    const current = getCollapsedSubsectionState();
    if (collapsed) {
      current.add(sectionKey);
    } else {
      current.delete(sectionKey);
    }
    window.localStorage.setItem(DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
  }
}
function toClassSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
var FocusCaptureModal = class extends import_obsidian3.Modal {
  constructor(app, options) {
    var _a, _b, _c, _d;
    super(app);
    this.options = options;
    this.textValue = (_a = options.initialText) != null ? _a : "";
    this.projectNameValue = (_b = options.initialProjectName) != null ? _b : "";
    this.notesValue = (_c = options.initialNotes) != null ? _c : "";
    this.estimateValue = options.initialEstimateMinutes && options.initialEstimateMinutes > 0 ? `${options.initialEstimateMinutes}` : "";
    this.destinationValue = (_d = options.initialDestination) != null ? _d : options.todayHasTop3Capacity ? "top3" : "next-up";
  }
  onOpen() {
    this.setTitle(this.options.mode === "edit" ? "Edit Focus Item" : "Quick Capture Focus Item");
    this.renderContent();
  }
  onClose() {
    this.contentEl.empty();
  }
  renderContent() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian3.Setting(contentEl).setName("Title").setDesc("The concrete task or outcome you want to track.").addText((text) => {
      text.setPlaceholder("Ship dashboard notes UI").setValue(this.textValue).onChange((value) => {
        this.textValue = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Estimate minutes").setDesc("Optional rough effort estimate for comparing plan versus actual.").addText((text) => {
      text.setPlaceholder("45").setValue(this.estimateValue).onChange((value) => {
        this.estimateValue = value;
      });
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.step = "5";
    });
    new import_obsidian3.Setting(contentEl).setName("Related project").setDesc("Optional project link for this focus item. Leave blank if it stands on its own.").addDropdown((dropdown) => {
      var _a2;
      dropdown.addOption("", "No project");
      [...new Set(((_a2 = this.options.availableProjectNames) != null ? _a2 : []).filter((name) => name.trim().length > 0))].sort((left, right) => left.localeCompare(right)).forEach((name) => {
        dropdown.addOption(name, name);
      });
      dropdown.setValue(this.projectNameValue);
      dropdown.onChange((value) => {
        this.projectNameValue = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Destination").setDesc(this.options.todayHasTop3Capacity ? "Choose whether this belongs in the active Top 3 or the Next Up queue." : "Top 3 is full, so new captures will usually go to Next Up.").addDropdown((dropdown) => {
      dropdown.addOption("top3", "Top 3");
      dropdown.addOption("next-up", "Next Up");
      dropdown.setValue(this.destinationValue);
      if (!this.options.todayHasTop3Capacity && this.destinationValue === "top3") {
        dropdown.setValue("next-up");
        this.destinationValue = "next-up";
      }
      dropdown.onChange((value) => {
        this.destinationValue = value === "top3" ? "top3" : "next-up";
      });
    });
    contentEl.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes" });
    const notesArea = contentEl.createEl("textarea", { cls: "daily-dashboard-textarea" });
    notesArea.rows = 5;
    notesArea.placeholder = "Context, definition of done, blockers, or follow-up details.";
    notesArea.value = this.notesValue;
    notesArea.addEventListener("input", () => {
      this.notesValue = notesArea.value;
    });
    const actions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    const submitButton = actions.createEl("button", {
      cls: "daily-dashboard-primary-button",
      text: (_a = this.options.submitLabel) != null ? _a : this.options.mode === "edit" ? "Save changes" : "Capture"
    });
    submitButton.type = "button";
    submitButton.addEventListener("click", () => {
      void this.submit();
    });
    const cancelButton = actions.createEl("button", { cls: "daily-dashboard-secondary-button", text: "Cancel" });
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => this.close());
  }
  async submit() {
    const text = this.textValue.trim();
    if (!text) {
      new import_obsidian3.Notice("Focus item text is required.");
      return;
    }
    const estimateMinutes = this.estimateValue.trim().length > 0 ? Number(this.estimateValue) : null;
    if (estimateMinutes !== null && (!Number.isFinite(estimateMinutes) || estimateMinutes < 0)) {
      new import_obsidian3.Notice("Estimate minutes must be a valid non-negative number.");
      return;
    }
    if (this.destinationValue === "top3" && !this.options.todayHasTop3Capacity && this.options.mode !== "edit") {
      new import_obsidian3.Notice("Top 3 is full. Capture this into Next Up instead.");
      return;
    }
    await this.options.onSubmit({
      text,
      projectName: this.projectNameValue.trim(),
      notes: this.notesValue.trim(),
      estimateMinutes: estimateMinutes === null ? null : Math.round(estimateMinutes),
      destination: this.destinationValue
    });
    this.close();
  }
};
var AddHabitModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.habitName = "";
    this.targetCount = "1";
    this.completionWindow = "anytime";
    this.cadence = "daily";
    this.difficultyWeight = "1";
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Add Habit");
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian3.Setting(contentEl).setName("Habit name").setDesc("Shown in the dashboard and saved in habit definitions.").addText((text) => {
      text.setPlaceholder("Drink water").onChange((value) => {
        this.habitName = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian3.Setting(contentEl).setName("Target count").setDesc("How many times per day counts as complete.").addText((text) => {
      text.setPlaceholder("1").setValue(this.targetCount).onChange((value) => {
        this.targetCount = value;
      });
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "12";
    });
    new import_obsidian3.Setting(contentEl).setName("Completion window").setDesc("Optional preferred time of day for the habit.").addDropdown((dropdown) => {
      HABIT_WINDOW_OPTIONS.forEach((window2) => dropdown.addOption(window2, window2 === "before-bed" ? "Before bed" : `${window2.charAt(0).toUpperCase()}${window2.slice(1)}`));
      dropdown.setValue(this.completionWindow);
      dropdown.onChange((value) => {
        this.completionWindow = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Cadence").setDesc("Choose whether this habit is due daily, every other day, or weekly.").addDropdown((dropdown) => {
      HABIT_CADENCE_OPTIONS.forEach((cadence) => dropdown.addOption(cadence, formatHabitCadenceLabel(cadence)));
      dropdown.setValue(this.cadence);
      dropdown.onChange((value) => {
        this.cadence = value;
      });
    });
    new import_obsidian3.Setting(contentEl).setName("Difficulty weight").setDesc("Higher weights make the habit count more in weighted completion and recovery scoring.").addText((text) => {
      text.setPlaceholder("1").setValue(this.difficultyWeight).onChange((value) => {
        this.difficultyWeight = value;
      });
      text.inputEl.type = "number";
      text.inputEl.min = "1";
      text.inputEl.max = "3";
    });
    new import_obsidian3.Setting(contentEl).addButton((button) => {
      button.setButtonText("Add habit").setCta().onClick(async () => {
        await this.plugin.addHabitDefinition(this.habitName, Number(this.targetCount), this.completionWindow, Number(this.difficultyWeight), this.cadence);
        this.close();
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Cancel").onClick(() => {
        this.close();
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
function getDismissedReminderState(date) {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    const parsed = JSON.parse(stored);
    const values = Array.isArray(parsed == null ? void 0 : parsed[date]) ? parsed[date] : [];
    return new Set(values.filter((item) => typeof item === "string"));
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
}
function setDismissedReminder(date, reminderId) {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.add(reminderId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
  }
}
function clearDismissedReminder(date, reminderId) {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    if (!stored) {
      return;
    }
    const parsed = JSON.parse(stored);
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.delete(reminderId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
  }
}
function getDismissedRoutineState(date) {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY);
    if (!stored) {
      return /* @__PURE__ */ new Set();
    }
    const parsed = JSON.parse(stored);
    const values = Array.isArray(parsed == null ? void 0 : parsed[date]) ? parsed[date] : [];
    return new Set(values.filter((item) => typeof item === "string"));
  } catch (e) {
    return /* @__PURE__ */ new Set();
  }
}
function setDismissedRoutine(date, routineId) {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.add(routineId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
  }
}
function getClockMinutes(value) {
  if (value instanceof Date) {
    return value.getHours() * 60 + value.getMinutes();
  }
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
function getDashboardCardLayoutKey(title) {
  const normalized = toClassSlug(title);
  if (normalized === "execution-hub") {
    return "top-3-for-today";
  }
  if (normalized === "consumables") {
    return "food-log";
  }
  if (normalized === "state-symptoms-and-friction" || normalized === "vitals") {
    return "state-and-friction";
  }
  if (normalized === "patterns" || normalized === "heatmaps") {
    return "heatmaps";
  }
  return normalized;
}
function getDashboardCardGridColumn(key, config, viewMode) {
  if (viewMode === "mobile") {
    return "1 / -1";
  }
  if ((config == null ? void 0 : config.width) === "full") {
    return "1 / -1";
  }
  if ((config == null ? void 0 : config.width) === "half") {
    return viewMode === "widescreen" ? "span 9" : "span 6";
  }
  if (viewMode === "widescreen") {
    if (key === "weekly-agenda" || key === "ai-workspace") {
      return "span 18";
    }
    if (key === "weekly-agenda" || key === "gamification-center" || key === "timeline-search" || key === "heatmaps") {
      return "span 9";
    }
    return "span 6";
  }
  if (key === "weekly-agenda" || key === "ai-workspace") {
    return "1 / -1";
  }
  return "span 6";
}

// main.ts
var _DailyDashboardPlugin = class _DailyDashboardPlugin extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.data = {
      settings: { ...DEFAULT_SETTINGS },
      entries: {},
      calendarEvents: [],
      dayState: {
        activeDate: formatDateKey(/* @__PURE__ */ new Date()),
        status: "not-started",
        lastInactivityPromptActivityAt: "",
        lastLateNightWarningKey: ""
      },
      noteIndex: createEmptyNoteIndexCache(),
      uiState: {
        onboardingCompleted: false,
        onboardingDeferredUntil: "",
        dismissedNotificationIds: [],
        dismissedCleanupSuggestionIds: []
      }
    };
    this.wallpaperOptions = [];
    this.autoArchiveDebounceId = null;
    this.isAutoArchivingTodo = false;
    this.latestAiArtifact = null;
    this.isAiBusy = false;
    this.isIndexingNotes = false;
    this.noteIndexDebounceId = null;
    this.calendarWarningDay = "";
    this.warnedCalendarEventKeys = /* @__PURE__ */ new Set();
    this.routineWarningDay = "";
    this.warnedRoutineWindowKeys = /* @__PURE__ */ new Set();
    this.activeRoutineNotificationSignature = "";
    this.notificationAudioContext = null;
  }
  getErrorMessage(error) {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return String(error);
  }
  showDashboardNotice(message, timeout = 4e3, playSound = false) {
    new import_obsidian4.Notice(message, timeout);
    if (playSound) {
      this.playNotificationSound();
    }
  }
  playNotificationSound() {
    var _a;
    const preset = this.data.settings.notificationSound;
    if (preset === "off") {
      return;
    }
    const audioWindow = window;
    const AudioContextCtor = (_a = audioWindow.AudioContext) != null ? _a : audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    if (!this.notificationAudioContext || this.notificationAudioContext.state === "closed") {
      this.notificationAudioContext = new AudioContextCtor();
    }
    const context = this.notificationAudioContext;
    const scheduleTone = () => {
      const startAt = context.currentTime + 0.02;
      this.getNotificationSoundPattern(preset).forEach((step, index) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const offset = this.getNotificationSoundPattern(preset).slice(0, index).reduce((sum, item) => sum + item.duration + item.gap, 0);
        oscillator.type = step.waveform;
        oscillator.frequency.setValueAtTime(step.frequency, startAt + offset);
        gainNode.gain.setValueAtTime(1e-4, startAt + offset);
        gainNode.gain.exponentialRampToValueAtTime(step.gain, startAt + offset + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(1e-4, startAt + offset + step.duration);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(startAt + offset);
        oscillator.stop(startAt + offset + step.duration + 0.02);
      });
    };
    if (context.state === "suspended") {
      void context.resume().then(() => {
        scheduleTone();
      }).catch(() => {
      });
      return;
    }
    scheduleTone();
  }
  getNotificationSoundPattern(preset) {
    switch (preset) {
      case "ping":
        return [
          { frequency: 1046.5, duration: 0.11, gap: 0, gain: 0.05, waveform: "sine" }
        ];
      case "alert":
        return [
          { frequency: 740, duration: 0.09, gap: 0.04, gain: 0.06, waveform: "square" },
          { frequency: 620, duration: 0.12, gap: 0, gain: 0.05, waveform: "square" }
        ];
      case "chime":
      default:
        return [
          { frequency: 880, duration: 0.1, gap: 0.03, gain: 0.045, waveform: "triangle" },
          { frequency: 1318.5, duration: 0.16, gap: 0, gain: 0.04, waveform: "sine" }
        ];
    }
  }
  async initializeWorkspaceArtifacts() {
    await this.importCalendarEventsFromMarkdown();
    await this.ensureTodayEntry();
    await this.ensureBasicInformationNoteExists();
    await this.backfillDailyLogsFromEntries();
    await this.syncCalendarArtifacts();
    await this.refreshWallpaperOptions();
  }
  async onload() {
    await this.loadPluginData();
    try {
      await this.initializeWorkspaceArtifacts();
    } catch (error) {
      console.error("Obsidian DASH - Daily Action & System Hub startup initialization failed", error);
      new import_obsidian4.Notice(`Obsidian DASH - Daily Action & System Hub could not prepare its startup files. ${this.getErrorMessage(error)}`);
    }
    this.registerView(VIEW_TYPE_DAILY_DASHBOARD, (leaf) => new DailyDashboardView(leaf, this));
    this.addRibbonIcon("check-square", "Open Obsidian DASH - Daily Action & System Hub", () => {
      void this.activateDashboardView();
    });
    this.addCommand({
      id: "open-daily-dashboard",
      name: "Open dashboard",
      callback: () => {
        void this.activateDashboardView();
      }
    });
    this.addCommand({
      id: "open-first-run-setup-wizard",
      name: "Open first-run setup wizard",
      callback: () => {
        void this.openFirstRunSetupWizard();
      }
    });
    this.addCommand({
      id: "archive-completed-master-tasks",
      name: "Archive completed tasks from master todo",
      callback: () => {
        void this.archiveCompletedTasksFromTodo();
      }
    });
    this.addCommand({
      id: "generate-weekly-dashboard-report",
      name: "Generate weekly dashboard report",
      callback: () => {
        void this.generateWeeklyReport();
      }
    });
    this.addCommand({
      id: "generate-monthly-dashboard-report",
      name: "Generate monthly dashboard report",
      callback: () => {
        void this.generateMonthlyReport();
      }
    });
    this.addCommand({
      id: "generate-gamification-report",
      name: "Generate gamification report",
      callback: () => {
        void this.generateGamificationReport();
      }
    });
    this.addCommand({
      id: "export-dashboard-metrics",
      name: "Export dashboard metrics as markdown and CSV",
      callback: () => {
        void this.exportDashboardMetrics();
      }
    });
    this.addCommand({
      id: "open-basic-information-note",
      name: "Open basic information note",
      callback: () => {
        void this.openBasicInformationNote();
      }
    });
    this.addCommand({
      id: "open-master-todo",
      name: "Open master todo",
      callback: () => {
        void this.openMasterTodo();
      }
    });
    this.addCommand({
      id: "create-project-and-note",
      name: "Create project and project note",
      callback: () => {
        void this.openCreateProjectFlow();
      }
    });
    this.addCommand({
      id: "create-missing-project-notes-from-master-hub",
      name: "Create missing project notes from master task hub",
      callback: () => {
        void this.createMissingProjectNotesFromTodo(true);
      }
    });
    this.addCommand({
      id: "generate-weekly-review-note",
      name: "Generate weekly review note",
      callback: () => {
        void this.generateWeeklyReview();
      }
    });
    this.addCommand({
      id: "sync-repeating-project-tasks",
      name: "Sync repeating project tasks",
      callback: () => {
        void this.syncRepeatingProjectTasks(true);
      }
    });
    this.addCommand({
      id: "offload-project-references",
      name: "Offload project references to project notes",
      callback: () => {
        void this.offloadProjectReferences(true);
      }
    });
    this.addCommand({
      id: "show-master-hub-cleanup-suggestions",
      name: "Show master task hub cleanup suggestions",
      callback: () => {
        void this.showCleanupSuggestions();
      }
    });
    this.addCommand({
      id: "promote-project-task-to-today",
      name: "Promote project task to today",
      callback: () => {
        void this.openPromoteTaskFlow();
      }
    });
    this.addCommand({
      id: "open-project-review-mode",
      name: "Open project review mode",
      callback: () => {
        void this.openProjectReviewModeFlow();
      }
    });
    this.addCommand({
      id: "add-dashboard-habit",
      name: "Add habit",
      callback: () => {
        void this.openAddHabitFlow();
      }
    });
    this.addCommand({
      id: "begin-logical-day",
      name: "Begin logical day",
      callback: () => {
        void this.beginLogicalDay();
      }
    });
    this.addCommand({
      id: "end-logical-day",
      name: "End logical day",
      callback: () => {
        void this.endLogicalDay();
      }
    });
    this.addCommand({
      id: "repair-logical-day",
      name: "Repair logical day",
      callback: () => {
        void this.openLogicalDayRepairFlow();
      }
    });
    this.addCommand({
      id: "start-work-session",
      name: "Start work session",
      callback: () => {
        void this.startWorkSession();
      }
    });
    this.addCommand({
      id: "stop-work-session",
      name: "Stop work session",
      callback: () => {
        void this.stopWorkSession();
      }
    });
    this.addCommand({
      id: "start-nap-session",
      name: "Start nap",
      callback: () => {
        void this.startNapSession();
      }
    });
    this.addCommand({
      id: "stop-nap-session",
      name: "Stop nap",
      callback: () => {
        void this.stopNapSession();
      }
    });
    this.addCommand({
      id: "start-relax-session",
      name: "Start relaxing",
      callback: () => {
        void this.startRelaxSession();
      }
    });
    this.addCommand({
      id: "stop-relax-session",
      name: "End relaxing",
      callback: () => {
        void this.stopRelaxSession();
      }
    });
    this.addCommand({
      id: "start-break-session",
      name: "Start break",
      callback: () => {
        void this.startBreakSession();
      }
    });
    this.addCommand({
      id: "stop-break-session",
      name: "End break",
      callback: () => {
        void this.stopBreakSession();
      }
    });
    this.addCommand({
      id: "pause-all-and-start-break",
      name: "Pause everything and start break",
      callback: () => {
        void this.pauseAllAndStartBreak();
      }
    });
    this.addCommand({
      id: "quick-capture-focus-item",
      name: "Quick capture focus item",
      callback: () => {
        void this.openQuickCaptureFocusFlow();
      }
    });
    this.addCommand({
      id: "generate-ai-today-plan",
      name: "Generate AI morning startup brief",
      callback: () => {
        void this.generateAiMorningStartupBrief();
      }
    });
    this.addCommand({
      id: "generate-ai-end-of-day-review",
      name: "Generate AI shutdown summary",
      callback: () => {
        void this.generateAiShutdownSummary();
      }
    });
    this.addCommand({
      id: "generate-ai-project-triage",
      name: "Generate AI project risk scanner",
      callback: () => {
        void this.generateAiProjectRiskScanner();
      }
    });
    this.addCommand({
      id: "generate-ai-weekly-coach-note",
      name: "Generate AI weekly planning assistant",
      callback: () => {
        void this.generateAiWeeklyPlanningAssistant();
      }
    });
    this.addCommand({
      id: "generate-ai-anomaly-detection",
      name: "Generate AI anomaly detection report",
      callback: () => {
        void this.generateAiAnomalyDetectionReport();
      }
    });
    this.addCommand({
      id: "generate-ai-period-comparison-report",
      name: "Generate AI period comparison report",
      callback: () => {
        void this.generateAiPeriodComparisonReport();
      }
    });
    this.addCommand({
      id: "generate-ai-project-synthesis",
      name: "Generate AI project synthesis",
      callback: () => {
        void this.generateAiProjectSynthesis();
      }
    });
    this.addCommand({
      id: "generate-ai-why-today-felt-off",
      name: "Generate AI why today felt off analysis",
      callback: () => {
        void this.generateAiWhyTodayFeltOff();
      }
    });
    this.addCommand({
      id: "ask-ai-about-dashboard",
      name: "Ask AI about dashboard and vault",
      callback: () => {
        void this.openAskAiFlow();
      }
    });
    this.addCommand({
      id: "analyze-active-note-with-ai",
      name: "Analyze active note with AI",
      callback: () => {
        void this.generateAiActiveNoteAnalysis();
      }
    });
    this.addCommand({
      id: "rebuild-ai-note-index",
      name: "Rebuild AI note index",
      callback: () => {
        void this.rebuildAiNoteIndex(true);
      }
    });
    this.addSettingTab(new DailyDashboardSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (!(file instanceof import_obsidian4.TFile)) {
        return;
      }
      const normalizedPath = (0, import_obsidian4.normalizePath)(file.path);
      if (normalizedPath === (0, import_obsidian4.normalizePath)(this.data.settings.masterTodoPath)) {
        this.scheduleAutomaticTodoArchive();
        this.refreshDashboardViews();
        return;
      }
      if (normalizedPath === (0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath)) {
        void this.reloadCalendarDocumentFile(file);
        return;
      }
      if (this.isDailyLogPath(normalizedPath)) {
        void this.reloadDailyLogFile(file);
        return;
      }
      if (file.extension === "md") {
        this.scheduleNoteIndexRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
        return;
      }
      if ((0, import_obsidian4.normalizePath)(file.path) === (0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath)) {
        void this.reloadCalendarDocumentFile(file);
      }
      if (this.isDailyLogPath(file.path)) {
        void this.reloadDailyLogFile(file);
      }
      this.scheduleNoteIndexRefresh();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
        return;
      }
      if (this.isDailyLogPath(file.path)) {
        this.removeDailyLogEntry(file.path);
      }
      delete this.data.noteIndex.entries[(0, import_obsidian4.normalizePath)(file.path)];
      this.scheduleNoteIndexRefresh();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof import_obsidian4.TFile) || file.extension !== "md") {
        return;
      }
      const normalizedPath = (0, import_obsidian4.normalizePath)(file.path);
      const normalizedOldPath = (0, import_obsidian4.normalizePath)(oldPath);
      const normalizedCalendarPath = (0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath);
      if (normalizedPath === normalizedCalendarPath || normalizedOldPath === normalizedCalendarPath) {
        void this.reloadCalendarDocumentFile(file);
      }
      if (this.isDailyLogPath(oldPath) || this.isDailyLogPath(file.path)) {
        this.removeDailyLogEntry(oldPath);
        if (this.isDailyLogPath(file.path)) {
          void this.reloadDailyLogFile(file);
        }
      }
      delete this.data.noteIndex.entries[(0, import_obsidian4.normalizePath)(oldPath)];
      this.scheduleNoteIndexRefresh();
    }));
    this.registerInterval(window.setInterval(() => {
      void this.refreshForNewDay();
    }, 6e4));
    window.setTimeout(() => {
      void this.rebuildAiNoteIndex(false);
    }, 2500);
    this.app.workspace.onLayoutReady(() => {
      if (!this.shouldAutoOpenFirstRunSetupWizard()) {
        return;
      }
      window.setTimeout(() => {
        void this.activateDashboardView();
        void this.openFirstRunSetupWizard();
      }, 500);
    });
  }
  async onunload() {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
  }
  getSettings() {
    return this.data.settings;
  }
  getHabitDefinitions() {
    return this.data.settings.habitDefinitions;
  }
  getTodayKey() {
    return this.data.dayState.status === "not-started" ? formatDateKey(/* @__PURE__ */ new Date()) : this.data.dayState.activeDate || formatDateKey(/* @__PURE__ */ new Date());
  }
  getTodayEntry() {
    return this.getOrCreateEntry(this.getTodayKey());
  }
  getDayState() {
    return this.data.dayState;
  }
  getLogicalDayInsights(referenceDate = /* @__PURE__ */ new Date()) {
    if (this.data.dayState.status !== "in-progress") {
      return {
        lastActivityAt: "",
        inactiveMinutes: null,
        hasActiveSession: false,
        isRollover: false,
        prompts: []
      };
    }
    const entry = this.getTodayEntry();
    const lastActivityAt = this.getLogicalDayLastActivityAt(entry);
    const lastActivityDate = this.parseDashboardDateTime(lastActivityAt);
    const inactiveMinutes = lastActivityDate ? Math.max(0, Math.round((referenceDate.getTime() - lastActivityDate.getTime()) / 6e4)) : null;
    const hasActiveSession = this.hasActiveLogicalDaySessions(entry);
    const calendarDate = formatDateKey(referenceDate);
    const isRollover = calendarDate !== entry.date;
    return {
      lastActivityAt,
      inactiveMinutes,
      hasActiveSession,
      isRollover,
      prompts: this.buildLogicalDayPrompts(entry, referenceDate, lastActivityAt, inactiveMinutes, hasActiveSession, isRollover)
    };
  }
  isWorkSessionActive() {
    return this.getTodayEntry().workSessions.some((session) => session.end === null);
  }
  isNapSessionActive() {
    return this.getTodayEntry().napSessions.some((session) => session.end === null);
  }
  isRelaxSessionActive() {
    return this.getTodayEntry().relaxSessions.some((session) => session.end === null);
  }
  isBreakSessionActive() {
    return this.getTodayEntry().breakSessions.some((session) => session.end === null);
  }
  getActiveActivitySession(kind, entry = this.getTodayEntry()) {
    var _a;
    return (_a = [...entry.activitySessions].reverse().find((session) => session.end === null && (!kind || session.kind === kind))) != null ? _a : null;
  }
  getTrackedWorkMinutes(entry = this.getTodayEntry()) {
    return getTrackedWorkMinutes(this.getEffectiveTrackedEntry(entry));
  }
  getTrackedNapMinutes(entry = this.getTodayEntry()) {
    return getTrackedNapMinutes(this.getEffectiveTrackedEntry(entry));
  }
  getTrackedRelaxMinutes(entry = this.getTodayEntry()) {
    return getTrackedRelaxMinutes(this.getEffectiveTrackedEntry(entry));
  }
  getTrackedBreakMinutes(entry = this.getTodayEntry()) {
    return getTrackedBreakMinutes(this.getEffectiveTrackedEntry(entry));
  }
  getTrackedPoopMinutes(entry = this.getTodayEntry()) {
    return getTrackedPoopMinutes(entry);
  }
  getTrackedPoopCount(entry = this.getTodayEntry()) {
    return getTrackedPoopCount(entry);
  }
  getTrackedActivityMinutes(entry = this.getTodayEntry(), kind) {
    return getTrackedActivityMinutes(this.getEffectiveTrackedEntry(entry), kind);
  }
  getTrackedSleepMinutes(entry = this.getTodayEntry()) {
    return getSleepMinutesForDay(entry, this.getNextEntry(entry.date));
  }
  getSleepInsights() {
    return buildSleepInsights(this.getAllEntries(), void 0, this.getHabitDefinitions());
  }
  getGamificationSummary(todoSnapshot) {
    return buildGamificationSummary(this.getAllEntries(), this.getHabitDefinitions(), todoSnapshot);
  }
  getAdaptiveReflectionPrompts(date = this.getTodayKey()) {
    const entry = this.getOrCreateEntry(date);
    const prompts = [];
    const trackedWorkMinutes = getTrackedWorkMinutes(entry);
    if (entry.completedTasks.length > 0 || trackedWorkMinutes >= 90) {
      prompts.push("Which completion or work block mattered most today, and why did it land when other things did not?");
    }
    if (entry.frictionLog.trim().length > 0) {
      prompts.push("Which blocker actually changed the shape of the day, and what would have reduced it earlier?");
    } else {
      prompts.push("What slowed the day down even if it never made it into the friction log?");
    }
    if (entry.missedHabits.length > 0) {
      prompts.push(`Which missed habit had the biggest downstream cost today: ${entry.missedHabits.slice(0, 3).join(", ")}?`);
    }
    if (entry.energyScore > 0 && entry.energyScore <= 2) {
      prompts.push("What drained energy earlier than expected, and what warning signs showed up before the drop?");
    }
    if (entry.anxietyScore >= 4) {
      prompts.push("What increased pressure today, and what actually lowered it even a little?");
    }
    if (entry.helpedToday.trim().length === 0) {
      prompts.push("What helped more than expected today, even if it was small or easy to overlook?");
    }
    if (entry.hurtToday.trim().length === 0) {
      prompts.push("What made the day harder than it needed to be?");
    }
    if (entry.completedTasks.length === 0 && trackedWorkMinutes < 60) {
      prompts.push("If the day felt scattered, where did the first real drift start: plan, energy, interruptions, or avoidance?");
    }
    return Array.from(new Set(prompts)).slice(0, 4);
  }
  getTimeAllocationInsights(date = this.getTodayKey(), referenceDate = /* @__PURE__ */ new Date()) {
    const entry = this.getOrCreateEntry(date);
    const nextEntry = this.getNextEntry(date);
    const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
    const workMinutes = this.getTrackedWorkMinutes(entry);
    const napMinutes = this.getTrackedNapMinutes(entry);
    const relaxMinutes = this.getTrackedRelaxMinutes(entry);
    const breakMinutes = this.getTrackedBreakMinutes(entry);
    const poopMinutes = this.getTrackedPoopMinutes(entry);
    const activityMinutes = this.getTrackedActivityMinutes(entry);
    const trackedAwakeMinutes = workMinutes + napMinutes + relaxMinutes + breakMinutes + poopMinutes + activityMinutes;
    const activeDate = this.data.dayState.status === "in-progress" ? this.data.dayState.activeDate : "";
    const wakeWindowEnd = entry.dayEndedAt || entry.sleepTime || (date === activeDate ? formatDateTimeKey(referenceDate) : entry.lastEditedAt);
    const awakeWindowMinutes = entry.wakeTime && wakeWindowEnd && wakeWindowEnd >= entry.wakeTime ? getTrackedMinutes([{ start: entry.wakeTime, end: wakeWindowEnd, tag: "" }]) : null;
    const awakeUnknownMinutes = awakeWindowMinutes === null ? null : Math.max(0, awakeWindowMinutes - trackedAwakeMinutes);
    const fullDayUnknownMinutes = Math.max(0, 1440 - sleepMinutes - workMinutes - (relaxMinutes + breakMinutes) - poopMinutes);
    const diagnostics = [];
    if (!entry.wakeTime) {
      diagnostics.push("Wake time is missing, so awake-time coverage is estimated loosely instead of measured.");
    }
    if (!entry.dayEndedAt && !entry.sleepTime && date !== activeDate) {
      diagnostics.push("This day has no recorded end marker, so untracked time may include the tail end of the day.");
    }
    if (date === activeDate) {
      diagnostics.push("The logical day is still active, so untracked awake time includes whatever part of today has not been logged yet.");
    }
    if ((awakeUnknownMinutes != null ? awakeUnknownMinutes : 0) >= 180) {
      diagnostics.push("There are at least 3 hours of awake time with no timer coverage. Meals, chores, commuting, or missed session starts are likely hiding there.");
    }
    if (trackedAwakeMinutes === 0 && (entry.intakeLog.length > 0 || entry.completedTasks.length > 0 || Object.values(entry.habitEvents).some((items) => items.length > 0))) {
      diagnostics.push("You recorded real activity, but none of it was tied to a session timer. Consider using work, break, relax, or nap timers more aggressively.");
    }
    if (!entry.sleepTime && !(nextEntry == null ? void 0 : nextEntry.wakeTime)) {
      diagnostics.push("Overnight sleep is incomplete until sleep time and the next wake time are both present.");
    }
    const buckets = [
      { label: "Sleep", minutes: sleepMinutes, tone: "health" },
      { label: "Work", minutes: workMinutes, tone: "capture" },
      { label: "Naps", minutes: napMinutes, tone: "health" },
      { label: "Relax", minutes: relaxMinutes, tone: "health" },
      { label: "Breaks", minutes: breakMinutes, tone: "alert" },
      { label: "Poop", minutes: poopMinutes, tone: "log" },
      { label: "Unknown", minutes: fullDayUnknownMinutes, tone: fullDayUnknownMinutes >= 360 ? "alert" : "neutral" }
    ].filter((bucket) => bucket.minutes > 0);
    if (awakeUnknownMinutes !== null) {
      buckets.push({
        label: "Untracked awake",
        minutes: awakeUnknownMinutes,
        tone: awakeUnknownMinutes >= 180 ? "alert" : "neutral"
      });
    }
    return {
      date,
      sleepMinutes,
      workMinutes,
      napMinutes,
      relaxMinutes,
      breakMinutes,
      poopMinutes,
      activityMinutes,
      trackedAwakeMinutes,
      awakeWindowMinutes,
      awakeUnknownMinutes,
      fullDayUnknownMinutes,
      diagnostics,
      buckets
    };
  }
  getAllEntries() {
    return Object.values(this.data.entries).map((entry) => this.normalizeEntry(entry, entry.date || this.getTodayKey())).sort((left, right) => left.date.localeCompare(right.date));
  }
  getWallpaperFiles() {
    return this.wallpaperOptions;
  }
  getRoutineTemplates() {
    return parseRoutineTemplates(this.data.settings.routineTemplates);
  }
  getSelectedWallpaperPath() {
    var _a, _b, _c, _d;
    const files = this.getWallpaperFiles();
    const selected = (0, import_obsidian4.normalizePath)(this.data.settings.selectedWallpaper);
    if (selected && files.some((file) => (0, import_obsidian4.normalizePath)(file.path) === selected)) {
      return selected;
    }
    if (selected) {
      const selectedFileName = (_b = (_a = selected.split("/").pop()) == null ? void 0 : _a.toLowerCase()) != null ? _b : "";
      const matchingByName = files.find((file) => {
        var _a2, _b2;
        return ((_b2 = (_a2 = file.path.split("/").pop()) == null ? void 0 : _a2.toLowerCase()) != null ? _b2 : "") === selectedFileName;
      });
      if (matchingByName) {
        return matchingByName.path;
      }
    }
    return (_d = (_c = files[0]) == null ? void 0 : _c.path) != null ? _d : "";
  }
  getSelectedWallpaperUrl() {
    var _a;
    const path = this.getSelectedWallpaperPath();
    if (!path) {
      return null;
    }
    const option = this.wallpaperOptions.find((candidate) => (0, import_obsidian4.normalizePath)(candidate.path) === (0, import_obsidian4.normalizePath)(path));
    return (_a = option == null ? void 0 : option.url) != null ? _a : null;
  }
  getResolvedAiApiKey() {
    var _a, _b;
    if (this.data.settings.aiApiKeySource === "env") {
      const envVar = this.data.settings.aiApiKeyEnvVar.trim();
      if (!envVar) {
        return "";
      }
      return (_b = (_a = process.env[envVar]) == null ? void 0 : _a.trim()) != null ? _b : "";
    }
    return this.data.settings.aiApiKey.trim();
  }
  getAiConfigurationMessage() {
    if (this.data.settings.aiApiKeySource === "env") {
      const envVar = this.data.settings.aiApiKeyEnvVar.trim() || "OPENAI_API_KEY";
      return `Set the ${envVar} environment variable before using AI features.`;
    }
    return "Add your OpenAI API key in Obsidian DASH - Daily Action & System Hub settings before using AI features.";
  }
  async getUpcomingCalendarSnapshot(now = /* @__PURE__ */ new Date()) {
    if (!this.data.settings.calendarEnabled) {
      return {
        reminders: [],
        enabled: false
      };
    }
    const reminders = this.getCalendarOccurrencesInRange(now, new Date(now.getTime() + this.data.settings.calendarLookaheadHours * 60 * 60 * 1e3)).map((event) => this.toCalendarReminderItem(event)).filter((item) => this.isCalendarReminderVisible(item, now)).map((item) => ({
      ...item,
      warningLevel: this.getCalendarReminderWarningLevel(item, now)
    })).sort((left, right) => left.start.localeCompare(right.start));
    const snapshot = {
      reminders,
      enabled: true
    };
    this.maybeWarnUpcomingCalendarEvents(snapshot.reminders, now);
    return snapshot;
  }
  getWeeklyAgenda(anchorDate = formatDateKey(/* @__PURE__ */ new Date())) {
    const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ? /* @__PURE__ */ new Date(`${anchorDate}T00:00:00`) : /* @__PURE__ */ new Date();
    const { start } = getIsoWeekRange(baseDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const occurrences = this.getCalendarOccurrencesInRange(start, end);
    const byDate = /* @__PURE__ */ new Map();
    occurrences.forEach((event) => {
      this.getDateKeysInSpan(event.date, event.endDate).filter((dateKey) => dateKey >= formatDateKey(start) && dateKey <= formatDateKey(end)).forEach((dateKey) => {
        var _a;
        const bucket = (_a = byDate.get(dateKey)) != null ? _a : [];
        bucket.push(event);
        byDate.set(dateKey, bucket);
      });
    });
    return Array.from({ length: 7 }, (_, index) => {
      var _a;
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      return {
        date: dateKey,
        label: date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
        shortLabel: date.toLocaleDateString([], { weekday: "short" }),
        isToday: dateKey === formatDateKey(/* @__PURE__ */ new Date()),
        events: ((_a = byDate.get(dateKey)) != null ? _a : []).map((event) => ({
          id: event.id,
          title: event.title,
          date: event.date,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: !event.startTime,
          category: event.category,
          projectName: event.projectName,
          projectNotePath: event.projectNotePath,
          notes: event.notes,
          isRecurring: event.isRecurring
        }))
      };
    });
  }
  getSuggestedTop3Candidates(todoSnapshot, calendarSnapshot) {
    var _a, _b, _c, _d, _e;
    const entry = this.getTodayEntry();
    const existing = /* @__PURE__ */ new Set([
      ...entry.todayFocus.map((item) => item.text.toLowerCase()),
      ...entry.nextUpFocus.map((item) => item.text.toLowerCase())
    ]);
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    const pushCandidate = (candidate) => {
      const key = candidate.text.trim().toLowerCase();
      if (!key || existing.has(key) || seen.has(key)) {
        return;
      }
      seen.add(key);
      candidates.push(candidate);
    };
    ((_a = calendarSnapshot == null ? void 0 : calendarSnapshot.reminders) != null ? _a : []).slice(0, 3).forEach((reminder) => {
      pushCandidate({
        id: `calendar-${reminder.id}`,
        text: reminder.title,
        notes: reminder.notes,
        estimateMinutes: this.getCalendarReminderEstimateMinutes(reminder.start, reminder.end, reminder.allDay),
        reason: `${reminder.warningLevel === "warning" ? "Calendar soon" : "Calendar"} \u2022 ${reminder.date}${reminder.allDay ? " all day" : ` ${reminder.start.slice(11, 16)}`}`,
        source: "calendar",
        calendarDate: reminder.date
      });
    });
    ((_b = todoSnapshot == null ? void 0 : todoSnapshot.overdueTasks) != null ? _b : []).slice(0, 3).forEach(({ project, task }) => {
      pushCandidate({
        id: `overdue-${project}-${task.text}`,
        text: task.text,
        notes: `Project ${project}${task.blockedReason ? ` \u2022 blocked ${task.blockedReason}` : ""}`,
        estimateMinutes: null,
        reason: `Overdue in ${project}${task.dueDate ? ` \u2022 due ${task.dueDate}` : ""}`,
        source: "overdue"
      });
    });
    ((_c = todoSnapshot == null ? void 0 : todoSnapshot.projects) != null ? _c : []).flatMap((project) => project.dueRepeatingTaskDetails.map((task) => ({ project, task }))).sort((left, right) => {
      var _a2, _b2;
      return ((_a2 = right.project.staleDays) != null ? _a2 : 0) - ((_b2 = left.project.staleDays) != null ? _b2 : 0);
    }).slice(0, 3).forEach(({ project, task }) => {
      pushCandidate({
        id: `repeating-${project.name}-${task.text}`,
        text: task.text,
        notes: `Project ${project.name} \u2022 repeating task`,
        estimateMinutes: null,
        reason: `Due repeating task${project.staleDays !== null ? ` \u2022 ${project.staleDays}d stale` : ""}`,
        source: "repeating"
      });
    });
    ((_d = todoSnapshot == null ? void 0 : todoSnapshot.staleProjects) != null ? _d : []).slice(0, 3).forEach((project) => {
      var _a2, _b2, _c2, _d2;
      const task = (_c2 = (_b2 = (_a2 = project.nowTaskDetails[0]) != null ? _a2 : project.nextTaskDetails[0]) != null ? _b2 : project.laterTaskDetails[0]) != null ? _c2 : project.dueRepeatingTaskDetails[0];
      if (!task) {
        return;
      }
      pushCandidate({
        id: `stale-${project.name}-${task.text}`,
        text: task.text,
        notes: `Project ${project.name} \u2022 ${project.focus || "stale project"}`,
        estimateMinutes: null,
        reason: `${project.name} has been stale for ${(_d2 = project.staleDays) != null ? _d2 : 0}d`,
        source: "stale"
      });
    });
    ((_e = todoSnapshot == null ? void 0 : todoSnapshot.dueSoonTasks) != null ? _e : []).slice(0, 2).forEach(({ project, task }) => {
      pushCandidate({
        id: `due-soon-${project}-${task.text}`,
        text: task.text,
        notes: `Project ${project}`,
        estimateMinutes: null,
        reason: `Due soon${task.dueDate ? ` \u2022 ${task.dueDate}` : ""}`,
        source: "due-soon"
      });
    });
    return candidates.slice(0, 6);
  }
  async addFocusBlockToCalendar(input) {
    const title = input.text.trim();
    if (!title) {
      new import_obsidian4.Notice("Focus block title is required.");
      return;
    }
    const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) ? input.date.trim() : this.getTodayEntry().date;
    const durationMinutes = Number.isFinite(Number(input.estimateMinutes)) ? clamp(Math.round(Number(input.estimateMinutes)), 15, 480) : 30;
    const slot = this.getSuggestedCalendarBlockSlot(date, durationMinutes);
    await this.addCalendarEvent({
      title,
      date,
      endDate: date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      prepMinutes: 0,
      travelMinutes: 0,
      category: "work",
      notes: typeof input.notes === "string" && input.notes.trim().length > 0 ? input.notes.trim() : "Blocked from dashboard focus planning.",
      repeatCadence: "none",
      repeatUntil: ""
    });
  }
  getCalendarEvents() {
    return [...this.data.calendarEvents].sort((left, right) => {
      const leftKey = `${left.date} ${left.startTime || "00:00"} ${left.title.toLowerCase()}`;
      const rightKey = `${right.date} ${right.startTime || "00:00"} ${right.title.toLowerCase()}`;
      return leftKey.localeCompare(rightKey);
    });
  }
  getCalendarEventsForDate(date) {
    return this.getCalendarOccurrencesForDate(date);
  }
  getCalendarOccurrencesBetween(startDate, endDate) {
    const normalizedStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : formatDateKey(/* @__PURE__ */ new Date());
    const normalizedEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : normalizedStart;
    const start = /* @__PURE__ */ new Date(`${normalizedStart}T00:00:00`);
    const end = /* @__PURE__ */ new Date(`${normalizedEnd}T00:00:00`);
    return this.getCalendarOccurrencesInRange(start.getTime() <= end.getTime() ? start : end, start.getTime() <= end.getTime() ? end : start);
  }
  getCalendarEventEntry(eventId) {
    var _a;
    return (_a = this.data.calendarEvents.find((event) => event.id === eventId)) != null ? _a : null;
  }
  async updateCalendarEvent(eventId, input) {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new import_obsidian4.Notice("That calendar event could not be found.");
      return;
    }
    const normalized = this.validateCalendarEventInput(input);
    if (!normalized) {
      return;
    }
    this.data.calendarEvents = this.data.calendarEvents.map((event) => event.id === eventId ? {
      ...event,
      title: normalized.title,
      date: normalized.date,
      endDate: normalized.endDate,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      prepMinutes: normalized.prepMinutes,
      travelMinutes: normalized.travelMinutes,
      category: normalized.category,
      projectName: normalized.projectName,
      projectNotePath: normalized.projectNotePath,
      notes: normalized.notes,
      repeatCadence: normalized.repeatCadence,
      repeatUntil: normalized.repeatUntil,
      updatedAt: formatPreciseDateTimeKey(/* @__PURE__ */ new Date())
    } : event).sort((left, right) => `${left.date} ${left.startTime || "00:00"}`.localeCompare(`${right.date} ${right.startTime || "00:00"}`));
    await this.syncCalendarArtifacts([existingEvent.date, existingEvent.endDate, normalized.date, normalized.endDate]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Updated calendar event for ${normalized.date}.`);
  }
  async updateCalendarOccurrence(eventId, originalDate, input) {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new import_obsidian4.Notice("That calendar series could not be found.");
      return;
    }
    const normalized = this.validateCalendarEventInput({
      ...input,
      repeatCadence: existingEvent.repeatCadence,
      repeatUntil: existingEvent.repeatUntil
    });
    if (!normalized) {
      return;
    }
    const timestamp = formatPreciseDateTimeKey(/* @__PURE__ */ new Date());
    this.data.calendarEvents = this.data.calendarEvents.map((event) => {
      if (event.id !== eventId) {
        return event;
      }
      const nextExceptions = [
        ...event.occurrenceExceptions.filter((exception) => exception.originalDate !== originalDate),
        {
          originalDate,
          kind: normalized.date === originalDate && normalized.title === event.title && normalized.startTime === event.startTime && normalized.endTime === event.endTime && normalized.endDate === event.endDate && normalized.prepMinutes === event.prepMinutes && normalized.travelMinutes === event.travelMinutes && normalized.projectName === event.projectName && normalized.projectNotePath === event.projectNotePath && normalized.notes === event.notes ? "move" : "move",
          date: normalized.date,
          endDate: normalized.endDate,
          startTime: normalized.startTime,
          endTime: normalized.endTime,
          prepMinutes: normalized.prepMinutes,
          travelMinutes: normalized.travelMinutes,
          title: normalized.title,
          projectName: normalized.projectName,
          projectNotePath: normalized.projectNotePath,
          notes: normalized.notes,
          category: normalized.category,
          updatedAt: timestamp
        }
      ].sort((left, right) => left.originalDate.localeCompare(right.originalDate));
      return {
        ...event,
        occurrenceExceptions: nextExceptions,
        updatedAt: timestamp
      };
    });
    await this.syncCalendarArtifacts([originalDate, normalized.date, normalized.endDate, existingEvent.date, existingEvent.endDate]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Updated occurrence for ${originalDate}.`);
  }
  async applyCalendarOccurrenceException(eventId, originalDate, kind) {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new import_obsidian4.Notice("That calendar series could not be found.");
      return;
    }
    const timestamp = formatPreciseDateTimeKey(/* @__PURE__ */ new Date());
    this.data.calendarEvents = this.data.calendarEvents.map((event) => {
      if (event.id !== eventId) {
        return event;
      }
      const nextExceptions = [
        ...event.occurrenceExceptions.filter((exception) => exception.originalDate !== originalDate),
        {
          originalDate,
          kind,
          date: originalDate,
          endDate: this.shiftDateKey(originalDate, this.getDateSpanDays(event.date, event.endDate)),
          startTime: event.startTime,
          endTime: event.endTime,
          prepMinutes: event.prepMinutes,
          travelMinutes: event.travelMinutes,
          category: event.category,
          title: event.title,
          projectName: event.projectName,
          projectNotePath: event.projectNotePath,
          notes: event.notes,
          updatedAt: timestamp
        }
      ].sort((left, right) => left.originalDate.localeCompare(right.originalDate));
      return {
        ...event,
        occurrenceExceptions: nextExceptions,
        updatedAt: timestamp
      };
    });
    await this.syncCalendarArtifacts([originalDate, existingEvent.date, existingEvent.endDate]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`${kind === "skip" ? "Skipped" : "Cancelled"} occurrence on ${originalDate}.`);
  }
  async clearCalendarOccurrenceException(eventId, originalDate) {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      return;
    }
    const nextEvents = this.data.calendarEvents.map((event) => {
      if (event.id !== eventId) {
        return event;
      }
      return {
        ...event,
        occurrenceExceptions: event.occurrenceExceptions.filter((exception) => exception.originalDate !== originalDate),
        updatedAt: formatPreciseDateTimeKey(/* @__PURE__ */ new Date())
      };
    });
    this.data.calendarEvents = nextEvents;
    await this.syncCalendarArtifacts([originalDate, existingEvent.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Restored occurrence on ${originalDate} to its series defaults.`);
  }
  async addCalendarEvent(input) {
    const normalized = this.validateCalendarEventInput(input);
    if (!normalized) {
      return;
    }
    const timestamp = formatPreciseDateTimeKey(/* @__PURE__ */ new Date());
    this.data.calendarEvents = [
      ...this.data.calendarEvents,
      {
        id: `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...normalized,
        occurrenceExceptions: [],
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ].sort((left, right) => `${left.date} ${left.startTime || "00:00"}`.localeCompare(`${right.date} ${right.startTime || "00:00"}`));
    await this.syncCalendarArtifacts([normalized.date, normalized.endDate]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Added calendar event for ${normalized.date}.`);
  }
  async removeCalendarEvent(eventId) {
    const nextEvents = this.data.calendarEvents.filter((event) => event.id !== eventId);
    if (nextEvents.length === this.data.calendarEvents.length) {
      return;
    }
    this.data.calendarEvents = nextEvents;
    await this.syncCalendarArtifacts();
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  getFocusDisplayItems(snapshot = null) {
    var _a;
    const entry = this.getTodayEntry();
    const focusItems = entry.todayFocus.map((item, index) => ({
      kind: "focus",
      id: `focus-${index}-${item.text.toLowerCase()}`,
      text: item.text,
      projectName: item.projectName,
      notes: item.notes,
      estimateMinutes: item.estimateMinutes,
      status: item.status,
      workSessions: item.workSessions,
      completedAt: item.completedAt,
      trackedMinutes: getTrackedMinutes(item.workSessions),
      isActive: item.status === "working" && item.workSessions.some((session) => session.end === null)
    }));
    const reminderItems = ((_a = snapshot == null ? void 0 : snapshot.reminders) != null ? _a : []).filter((reminder) => !entry.todayFocus.some((item) => item.text.trim().toLowerCase() === reminder.title.trim().toLowerCase())).map((reminder) => ({
      kind: "reminder",
      id: `reminder-${reminder.id}-${reminder.start}`,
      sourceEventId: reminder.id,
      text: reminder.title,
      status: "reminder",
      workSessions: [],
      completedAt: null,
      trackedMinutes: 0,
      isActive: false,
      calendarDate: reminder.date,
      calendarStart: reminder.start,
      calendarEnd: reminder.end,
      calendarLeadSummary: reminder.leadSummary,
      allDay: reminder.allDay,
      calendarNotes: [this.renderCalendarProjectLink(reminder.projectName, reminder.projectNotePath), reminder.notes].filter((value) => value.trim().length > 0).join(" \u2022 "),
      repeatCadence: reminder.repeatCadence,
      warningLevel: reminder.warningLevel
    }));
    return [...focusItems, ...reminderItems];
  }
  getNextUpFocusItems(date = this.getTodayEntry().date) {
    const entry = this.getOrCreateEntry(date);
    return [...entry.nextUpFocus];
  }
  getCarryForwardFocusCandidates(date = this.getTodayEntry().date) {
    const entry = this.getOrCreateEntry(date);
    const previousEntry = this.getPreviousEntry(date);
    if (!previousEntry) {
      return [];
    }
    const existingTexts = new Set(entry.todayFocus.map((item) => item.text.trim().toLowerCase()));
    return previousEntry.todayFocus.filter((item) => item.status !== "done").map((item) => item.text.trim()).filter((text) => text.length > 0).filter((text) => !existingTexts.has(text.toLowerCase()));
  }
  async carryForwardUnfinishedFocusItems() {
    const entry = this.getTodayEntry();
    const candidates = this.getCarryForwardFocusCandidates(entry.date);
    const availableSlots = Math.max(0, 3 - entry.todayFocus.filter((item) => item.status !== "done").length);
    const accepted = candidates.slice(0, availableSlots);
    if (accepted.length === 0) {
      new import_obsidian4.Notice(candidates.length > 0 ? "No Top 3 slots are available for carry-forward items." : "No unfinished Top 3 items were found on the previous logical day.");
      return 0;
    }
    entry.todayFocus = [...entry.todayFocus, ...accepted.map((text) => this.createTodayFocusItem(text))];
    await this.persistEntry(entry);
    new import_obsidian4.Notice(`Carried forward ${accepted.length} unfinished Top 3 item${accepted.length === 1 ? "" : "s"}.`);
    return accepted.length;
  }
  toCalendarReminderItem(event) {
    const startDate = this.getCalendarOccurrenceStartDate(event);
    const endDate = this.getCalendarOccurrenceEndDate(event);
    const leadMinutes = Math.max(0, event.prepMinutes + event.travelMinutes);
    const reminderAt = new Date(startDate.getTime() - leadMinutes * 60 * 1e3);
    return {
      id: event.sourceEventId,
      title: event.title,
      date: event.date,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      reminderAt: reminderAt.toISOString(),
      projectName: event.projectName,
      projectNotePath: event.projectNotePath,
      notes: event.notes,
      leadMinutes,
      leadSummary: this.renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes),
      repeatCadence: event.repeatCadence,
      allDay: event.startTime.length === 0,
      warningLevel: "upcoming"
    };
  }
  getCalendarOccurrencesForDate(date) {
    const target = /* @__PURE__ */ new Date(`${date}T00:00:00`);
    return this.getCalendarOccurrencesInRange(target, target).filter((event) => this.isDateWithinEventSpan(date, event.date, event.endDate)).sort((left, right) => `${left.startTime || "00:00"} ${left.title.toLowerCase()}`.localeCompare(`${right.startTime || "00:00"} ${right.title.toLowerCase()}`));
  }
  getCalendarOccurrencesInRange(start, end) {
    const safeStart = this.startOfToday(start);
    const safeEnd = this.startOfToday(end);
    const occurrences = [];
    const seenOccurrenceIds = /* @__PURE__ */ new Set();
    this.getCalendarEvents().forEach((event) => {
      let cursor = /* @__PURE__ */ new Date(`${event.date}T00:00:00`);
      const repeatUntil = event.repeatUntil ? /* @__PURE__ */ new Date(`${event.repeatUntil}T00:00:00`) : null;
      const hardLimit = repeatUntil != null ? repeatUntil : new Date(Math.min(safeEnd.getTime(), new Date(safeStart.getFullYear() + 2, safeStart.getMonth(), safeStart.getDate()).getTime()));
      const exceptionMap = new Map(event.occurrenceExceptions.map((exception) => [exception.originalDate, exception]));
      const spanDays = this.getDateSpanDays(event.date, event.endDate);
      while (cursor.getTime() <= hardLimit.getTime()) {
        const originalDate = formatDateKey(cursor);
        const exception = exceptionMap.get(originalDate);
        const occurrenceDate = (exception == null ? void 0 : exception.kind) === "move" ? exception.date : originalDate;
        const occurrenceEndDate = (exception == null ? void 0 : exception.kind) === "move" ? exception.endDate : this.shiftDateKey(originalDate, spanDays);
        if ((!exception || exception.kind === "move") && this.doesEventSpanOverlapRange(occurrenceDate, occurrenceEndDate, safeStart, safeEnd)) {
          const occurrenceId = `${event.id}:${originalDate}`;
          occurrences.push({
            id: occurrenceId,
            sourceEventId: event.id,
            originalDate,
            title: (exception == null ? void 0 : exception.kind) === "move" ? exception.title : event.title,
            date: occurrenceDate,
            endDate: occurrenceEndDate,
            startTime: (exception == null ? void 0 : exception.kind) === "move" ? exception.startTime : event.startTime,
            endTime: (exception == null ? void 0 : exception.kind) === "move" ? exception.endTime : event.endTime,
            prepMinutes: (exception == null ? void 0 : exception.kind) === "move" ? exception.prepMinutes : event.prepMinutes,
            travelMinutes: (exception == null ? void 0 : exception.kind) === "move" ? exception.travelMinutes : event.travelMinutes,
            category: (exception == null ? void 0 : exception.kind) === "move" ? exception.category : event.category,
            projectName: (exception == null ? void 0 : exception.kind) === "move" ? exception.projectName : event.projectName,
            projectNotePath: (exception == null ? void 0 : exception.kind) === "move" ? exception.projectNotePath : event.projectNotePath,
            notes: (exception == null ? void 0 : exception.kind) === "move" ? exception.notes : event.notes,
            repeatCadence: event.repeatCadence,
            repeatUntil: event.repeatUntil,
            isRecurring: event.repeatCadence !== "none",
            isException: Boolean(exception),
            exceptionKind: exception == null ? void 0 : exception.kind
          });
          seenOccurrenceIds.add(occurrenceId);
        }
        if (event.repeatCadence === "none") {
          break;
        }
        cursor = this.advanceCalendarOccurrence(cursor, event.repeatCadence);
        if (repeatUntil && cursor.getTime() > repeatUntil.getTime()) {
          break;
        }
      }
      event.occurrenceExceptions.filter((exception) => exception.kind === "move").forEach((exception) => {
        const occurrenceId = `${event.id}:${exception.originalDate}`;
        if (seenOccurrenceIds.has(occurrenceId) || !this.doesEventSpanOverlapRange(exception.date, exception.endDate, safeStart, safeEnd)) {
          return;
        }
        occurrences.push({
          id: occurrenceId,
          sourceEventId: event.id,
          originalDate: exception.originalDate,
          title: exception.title,
          date: exception.date,
          endDate: exception.endDate,
          startTime: exception.startTime,
          endTime: exception.endTime,
          prepMinutes: exception.prepMinutes,
          travelMinutes: exception.travelMinutes,
          category: exception.category,
          projectName: exception.projectName,
          projectNotePath: exception.projectNotePath,
          notes: exception.notes,
          repeatCadence: event.repeatCadence,
          repeatUntil: event.repeatUntil,
          isRecurring: event.repeatCadence !== "none",
          isException: true,
          exceptionKind: "move"
        });
        seenOccurrenceIds.add(occurrenceId);
      });
    });
    return occurrences.sort((left, right) => `${left.date} ${left.startTime || "00:00"} ${left.title.toLowerCase()}`.localeCompare(`${right.date} ${right.startTime || "00:00"} ${right.title.toLowerCase()}`));
  }
  getCalendarReminderEstimateMinutes(start, end, allDay) {
    if (allDay) {
      return null;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 6e4);
    return minutes > 0 && minutes <= 240 ? minutes : null;
  }
  getSuggestedCalendarBlockSlot(date, durationMinutes) {
    const targetDate = formatDateKey(/* @__PURE__ */ new Date()) === date ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(`${date}T09:00:00`);
    let candidateMinutes = formatDateKey(/* @__PURE__ */ new Date()) === date ? Math.max(this.roundUpMinutes(targetDate.getHours() * 60 + targetDate.getMinutes(), 30), 6 * 60) : 9 * 60;
    const timedEvents = this.getCalendarEventsForDate(date).filter((event) => event.startTime).map((event) => ({
      start: this.getClockMinutes(event.startTime),
      end: this.getClockMinutes(event.endTime || event.startTime) + (event.endTime ? 0 : 30)
    })).sort((left, right) => left.start - right.start);
    timedEvents.forEach((event) => {
      if (candidateMinutes + durationMinutes <= event.start) {
        return;
      }
      if (candidateMinutes < event.end) {
        candidateMinutes = this.roundUpMinutes(event.end, 30);
      }
    });
    if (candidateMinutes + durationMinutes > 24 * 60) {
      candidateMinutes = Math.max(6 * 60, 24 * 60 - durationMinutes);
    }
    return {
      startTime: this.formatClockMinutes(candidateMinutes),
      endTime: this.formatClockMinutes(Math.min(candidateMinutes + durationMinutes, 24 * 60 - 1))
    };
  }
  getClockMinutes(value) {
    if (value instanceof Date) {
      return value.getHours() * 60 + value.getMinutes();
    }
    const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  }
  formatClockMinutes(totalMinutes) {
    const normalized = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
  }
  roundUpMinutes(totalMinutes, stepMinutes) {
    return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
  }
  isDateWithinRange(dateKey, start, end) {
    const date = /* @__PURE__ */ new Date(`${dateKey}T00:00:00`);
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }
  isDateWithinEventSpan(dateKey, startDateKey, endDateKey) {
    return dateKey >= startDateKey && dateKey <= endDateKey;
  }
  doesEventSpanOverlapRange(startDateKey, endDateKey, start, end) {
    const spanStart = /* @__PURE__ */ new Date(`${startDateKey}T00:00:00`);
    const spanEnd = /* @__PURE__ */ new Date(`${endDateKey}T23:59:59`);
    return spanEnd.getTime() >= start.getTime() && spanStart.getTime() <= end.getTime();
  }
  getDateSpanDays(startDateKey, endDateKey) {
    const start = /* @__PURE__ */ new Date(`${startDateKey}T00:00:00`);
    const end = /* @__PURE__ */ new Date(`${endDateKey}T00:00:00`);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1e3)));
  }
  shiftDateKey(dateKey, days) {
    const date = /* @__PURE__ */ new Date(`${dateKey}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
  }
  getDateKeysInSpan(startDateKey, endDateKey) {
    const keys = [];
    let cursor = startDateKey;
    while (cursor <= endDateKey) {
      keys.push(cursor);
      cursor = this.shiftDateKey(cursor, 1);
    }
    return keys;
  }
  advanceCalendarOccurrence(date, cadence) {
    const next = new Date(date);
    if (cadence === "daily") {
      next.setDate(next.getDate() + 1);
    } else if (cadence === "weekly") {
      next.setDate(next.getDate() + 7);
    } else if (cadence === "monthly") {
      const originalDate = next.getDate();
      next.setMonth(next.getMonth() + 1, 1);
      next.setDate(Math.min(originalDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    } else if (cadence === "yearly") {
      const month = next.getMonth();
      const day = next.getDate();
      next.setFullYear(next.getFullYear() + 1, month, 1);
      next.setDate(Math.min(day, new Date(next.getFullYear(), month + 1, 0).getDate()));
    }
    return next;
  }
  isCalendarReminderVisible(item, now) {
    const start = new Date(item.start);
    const end = new Date(item.end);
    const reminderAt = new Date(item.reminderAt);
    const lookaheadMs = this.data.settings.calendarLookaheadHours * 60 * 60 * 1e3;
    if (item.allDay) {
      const endOfDay = this.startOfToday(end);
      return endOfDay.getTime() >= this.startOfToday(now).getTime() && reminderAt.getTime() <= now.getTime() + lookaheadMs;
    }
    return end.getTime() >= now.getTime() && reminderAt.getTime() <= now.getTime() + lookaheadMs;
  }
  maybeWarnUpcomingCalendarEvents(reminders, now) {
    const currentDay = formatDateKey(now);
    if (this.calendarWarningDay !== currentDay) {
      this.calendarWarningDay = currentDay;
      this.warnedCalendarEventKeys.clear();
    }
    const warningWindowMs = this.data.settings.calendarWarningHours * 60 * 60 * 1e3;
    reminders.map((reminder) => ({
      ...reminder,
      warningLevel: this.getCalendarReminderWarningLevel(reminder, now)
    })).filter((event) => {
      const reminderTime = new Date(event.reminderAt).getTime();
      if (event.allDay) {
        const reminderDay = this.startOfToday(new Date(event.reminderAt));
        return reminderDay.getTime() >= this.startOfToday(now).getTime() && reminderDay.getTime() - this.startOfToday(now).getTime() <= warningWindowMs;
      }
      return reminderTime >= now.getTime() && reminderTime - now.getTime() <= warningWindowMs;
    }).forEach((event) => {
      const eventKey = `${currentDay}|${event.id}|${event.reminderAt}`;
      if (this.warnedCalendarEventKeys.has(eventKey)) {
        return;
      }
      this.warnedCalendarEventKeys.add(eventKey);
      const timeLabel = this.formatCalendarEventWindow(new Date(event.start), new Date(event.end), event.allDay);
      this.showDashboardNotice(`Upcoming activity: ${event.title} \u2022 ${timeLabel}${event.leadSummary ? ` \u2022 ${event.leadSummary}` : ""}`, 1e4, true);
    });
  }
  getActiveRoutineNotifications(referenceDate = /* @__PURE__ */ new Date()) {
    const todayKey = formatDateKey(referenceDate);
    const currentMinutes = this.getClockMinutes(referenceDate);
    return this.getRoutineTemplates().filter((template) => {
      const startMinutes = this.getClockMinutes(template.startTime);
      const endMinutes = this.getClockMinutes(template.endTime);
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }).map((template) => ({
      id: `routine:${todayKey}:${template.id}`,
      source: "routine",
      title: `${template.label} is due now`,
      description: `${template.startTime}-${template.endTime} \u2022 Inside the active routine window right now.`,
      tone: "alert",
      dismissible: true
    }));
  }
  maybeWarnRoutineWindows(referenceDate = /* @__PURE__ */ new Date()) {
    const currentDay = formatDateKey(referenceDate);
    if (this.routineWarningDay !== currentDay) {
      this.routineWarningDay = currentDay;
      this.warnedRoutineWindowKeys.clear();
    }
    const activeNotifications = this.getActiveRoutineNotifications(referenceDate);
    activeNotifications.forEach((notification) => {
      const warningKey = `${currentDay}|${notification.id}`;
      if (this.warnedRoutineWindowKeys.has(warningKey)) {
        return;
      }
      this.warnedRoutineWindowKeys.add(warningKey);
      this.showDashboardNotice(`Routine window due now: ${notification.title.replace(/ is due now$/, "")} \u2022 ${notification.description.split(" \u2022 ")[0]}`, 1e4, true);
    });
    const nextSignature = activeNotifications.map((item) => item.id).sort().join("|");
    if (nextSignature !== this.activeRoutineNotificationSignature) {
      this.activeRoutineNotificationSignature = nextSignature;
      this.refreshDashboardViews();
    }
  }
  getCalendarReminderWarningLevel(reminder, now) {
    const warningWindowMs = this.data.settings.calendarWarningHours * 60 * 60 * 1e3;
    const start = new Date(reminder.reminderAt);
    if (reminder.allDay) {
      const dayOffset = this.startOfToday(start).getTime() - this.startOfToday(now).getTime();
      return dayOffset <= warningWindowMs ? "warning" : "upcoming";
    }
    return start.getTime() - now.getTime() <= warningWindowMs ? "warning" : "upcoming";
  }
  getCalendarOccurrenceStartDate(event) {
    if (!event.startTime) {
      return /* @__PURE__ */ new Date(`${event.date}T00:00:00`);
    }
    return /* @__PURE__ */ new Date(`${event.date}T${event.startTime}:00`);
  }
  getCalendarOccurrenceEndDate(event) {
    if (!event.endTime) {
      return event.startTime ? /* @__PURE__ */ new Date(`${event.endDate}T${event.startTime}:00`) : /* @__PURE__ */ new Date(`${event.endDate}T23:59:00`);
    }
    return /* @__PURE__ */ new Date(`${event.endDate}T${event.endTime}:00`);
  }
  startOfToday(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }
  formatCalendarEventWindow(start, end, allDay) {
    if (allDay) {
      return formatDateKey(start) === formatDateKey(end) ? "All day" : `All day \u2022 ${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }
    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleString([], sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleString([], sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${startLabel} - ${endLabel}`;
  }
  renderCalendarLeadSummary(prepMinutes, travelMinutes) {
    const parts = [];
    if (prepMinutes > 0) {
      parts.push(`prep ${prepMinutes}m`);
    }
    if (travelMinutes > 0) {
      parts.push(`travel ${travelMinutes}m`);
    }
    return parts.join(" + ");
  }
  getAiStatus() {
    return {
      configured: this.getResolvedAiApiKey().length > 0,
      busy: this.isAiBusy,
      model: this.data.settings.aiModel,
      outputFolder: this.data.settings.aiOutputFolder,
      keySource: this.data.settings.aiApiKeySource,
      latestArtifact: this.latestAiArtifact,
      indexStatus: this.getRetrievalIndexStatus()
    };
  }
  getRetrievalIndexStatus() {
    const entries = Object.values(this.data.noteIndex.entries);
    const embeddedChunks = entries.reduce((sum, entry) => sum + entry.chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length, 0);
    return {
      enabled: this.data.settings.aiIndexEnabled,
      indexing: this.isIndexingNotes,
      indexedNotes: entries.length,
      indexedChunks: entries.reduce((sum, entry) => sum + entry.chunks.length, 0),
      embeddedChunks,
      indexedAt: this.data.noteIndex.indexedAt,
      lastIndexedFile: this.data.noteIndex.lastIndexedFile,
      indexedFolders: getIndexedFolderList(this.data.settings),
      embeddingsEnabled: this.data.settings.aiEmbeddingsEnabled,
      embeddingModel: this.data.settings.aiEmbeddingModel
    };
  }
  async activateDashboardView() {
    var _a;
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    const leaf = (_a = existingLeaves[0]) != null ? _a : this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_DAILY_DASHBOARD,
      active: true
    });
    this.app.workspace.revealLeaf(leaf);
  }
  async updateSettings(settings) {
    const previousSettings = this.data.settings;
    this.data.settings = sanitizeSettings(settings);
    await this.refreshWallpaperOptions();
    for (const date of Object.keys(this.data.entries)) {
      this.data.entries[date] = this.normalizeEntry(this.data.entries[date], date);
      await this.syncDailyLog(this.data.entries[date]);
    }
    await this.syncCalendarArtifacts();
    await this.savePluginData();
    if (shouldRebuildAiIndex(previousSettings, this.data.settings)) {
      this.scheduleNoteIndexRefresh();
    }
    this.refreshDashboardViews();
  }
  async updateMoodScore(value) {
    const entry = this.getTodayEntry();
    entry.moodScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateEnergyScore(value) {
    const entry = this.getTodayEntry();
    entry.energyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateWakeQualityScore(value) {
    const entry = this.getTodayEntry();
    entry.wakeQualityScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateAnxietyScore(value) {
    const entry = this.getTodayEntry();
    entry.anxietyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async addMoodCheckIn(score, feeling = "", note = "") {
    const entry = this.getTodayEntry();
    entry.moodCheckIns = [{
      loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
      score: clamp(Math.round(score), 1, 5),
      feeling: feeling.trim(),
      note: note.trim()
    }, ...entry.moodCheckIns].slice(0, 24);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async removeMoodCheckIn(index) {
    const entry = this.getTodayEntry();
    entry.moodCheckIns = entry.moodCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async updateHabitValue(habitId, value) {
    var _a, _b;
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }
    const entry = this.getTodayEntry();
    const previousValue = (_a = entry.habits[habitId]) != null ? _a : 0;
    const nextValue = clamp(value, 0, definition.target);
    const currentEvents = [...(_b = entry.habitEvents[habitId]) != null ? _b : []];
    const addedTimestamps = [];
    if (nextValue > currentEvents.length) {
      for (let index = currentEvents.length; index < nextValue; index += 1) {
        const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
        currentEvents.push(timestamp);
        addedTimestamps.push(timestamp);
      }
    } else if (nextValue < currentEvents.length) {
      currentEvents.length = nextValue;
    }
    entry.habitEvents[habitId] = currentEvents;
    entry.habits[habitId] = nextValue;
    if (nextValue > previousValue && addedTimestamps.length > 0) {
      const definitionLabelKey = definition.label.trim().toLowerCase();
      const definitionSlug = createHabitId(definition.label);
      const automations = this.getSettings().habitAutomations.filter((automation) => {
        const automationKey = automation.habitId.trim().toLowerCase();
        const automationSlug = createHabitId(automation.habitId);
        return automationKey === habitId.toLowerCase() || automationKey === definitionLabelKey || automationSlug === habitId.toLowerCase() || automationSlug === definitionSlug;
      });
      if (automations.length > 0) {
        addedTimestamps.forEach((timestamp) => {
          automations.forEach((automation) => {
            this.upsertIntakeLogEntry(entry, {
              kind: automation.intakeKind,
              label: automation.label,
              amount: automation.amount,
              unit: automation.unit,
              note: automation.note,
              loggedAt: timestamp,
              loggedAtHistory: [timestamp]
            });
          });
        });
      }
    }
    await this.persistEntry(entry);
  }
  async updateHabitMissNote(habitId, value) {
    const entry = this.getTodayEntry();
    const trimmedValue = value.trim();
    if (trimmedValue) {
      entry.habitMissNotes[habitId] = trimmedValue;
    } else {
      delete entry.habitMissNotes[habitId];
    }
    await this.persistEntry(entry);
  }
  async addHabitDefinition(label, target, completionWindow = "anytime", difficultyWeight = 1, cadence = "daily") {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      new import_obsidian4.Notice("Habit name is required.");
      return;
    }
    const nextHabitId = createHabitId(normalizedLabel);
    if (this.data.settings.habitDefinitions.some((habit) => habit.id === nextHabitId)) {
      new import_obsidian4.Notice(`A habit named ${normalizedLabel} already exists.`);
      return;
    }
    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: [
        ...this.getHabitDefinitions(),
        {
          id: nextHabitId,
          label: normalizedLabel,
          target: clamp(Math.round(target), 1, 12),
          completionWindow: completionWindow === "morning" || completionWindow === "afternoon" || completionWindow === "evening" || completionWindow === "before-bed" ? completionWindow : "anytime",
          cadence: cadence === "every-other-day" || cadence === "weekly" ? cadence : "daily",
          anchorDate: this.getTodayKey(),
          difficultyWeight: clamp(Math.round(difficultyWeight), 1, 3)
        }
      ]
    });
  }
  async removeHabitDefinition(habitId) {
    if (this.getHabitDefinitions().length <= 1) {
      new import_obsidian4.Notice("Keep at least one habit defined.");
      return;
    }
    const nextDefinitions = this.getHabitDefinitions().filter((habit) => habit.id !== habitId);
    if (nextDefinitions.length === this.getHabitDefinitions().length) {
      return;
    }
    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: nextDefinitions
    });
  }
  async restoreHabitDefinition(habit, index) {
    if (this.getHabitDefinitions().some((candidate) => candidate.id === habit.id)) {
      return;
    }
    const nextDefinitions = [...this.getHabitDefinitions()];
    nextDefinitions.splice(clamp(index, 0, nextDefinitions.length), 0, { ...habit });
    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: nextDefinitions
    });
  }
  async addFoodEntry(value, amount = 1) {
    await this.addIntakeEntry("food", value, amount, amount === 1 ? "serving" : "servings");
  }
  upsertIntakeLogEntry(entry, input) {
    var _a;
    const history = (input.loggedAtHistory && input.loggedAtHistory.length > 0 ? input.loggedAtHistory : [input.loggedAt]).filter((item) => item.trim().length > 0);
    const existingIndex = entry.intakeLog.findIndex((item) => item.kind === input.kind && item.label.trim().toLowerCase() === input.label.trim().toLowerCase() && item.unit.trim().toLowerCase() === input.unit.trim().toLowerCase() && item.note.trim() === input.note.trim());
    if (existingIndex >= 0) {
      const existingItem = entry.intakeLog[existingIndex];
      existingItem.amount = clamp(existingItem.amount + input.amount, 0.1, 9999);
      existingItem.loggedAtHistory = [...existingItem.loggedAtHistory, ...history].filter((value) => value.trim().length > 0);
      existingItem.loggedAt = (_a = existingItem.loggedAtHistory[existingItem.loggedAtHistory.length - 1]) != null ? _a : input.loggedAt;
      entry.intakeLog.splice(existingIndex, 1);
      entry.intakeLog.unshift(existingItem);
      entry.intakeLog = entry.intakeLog.slice(0, 40);
      return;
    }
    entry.intakeLog = [{
      ...input,
      loggedAtHistory: history
    }, ...entry.intakeLog].slice(0, 40);
  }
  async addIntakeEntry(kind, label, amount = 1, unit = "serving", note = "") {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }
    const entry = this.getTodayEntry();
    const normalizedKind = kind === "food" || kind === "medication" || kind === "supplement" || kind === "drink" ? kind : kind === "caffeine" || kind === "water" ? "drink" : "drink";
    const normalizedAmount = clamp(Number(amount), 0.1, 9999);
    const normalizedUnit = unit.trim() || "serving";
    const normalizedNote = note.trim();
    const loggedAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.upsertIntakeLogEntry(entry, {
      kind: normalizedKind,
      label: trimmedLabel,
      amount: normalizedAmount,
      unit: normalizedUnit,
      note: normalizedNote,
      loggedAt,
      loggedAtHistory: [loggedAt]
    });
    await this.persistEntry(entry);
  }
  async removeIntakeEntry(index) {
    const entry = this.getTodayEntry();
    entry.intakeLog = entry.intakeLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateIntakeEntryAmount(index, amount) {
    const entry = this.getTodayEntry();
    const nextEntry = entry.intakeLog[index];
    if (!nextEntry) {
      return;
    }
    nextEntry.amount = clamp(Number(amount), 0.1, 9999);
    await this.persistEntry(entry);
  }
  async updateIntakeEntryUnit(index, unit) {
    const entry = this.getTodayEntry();
    const nextEntry = entry.intakeLog[index];
    const trimmedUnit = unit.trim();
    if (!nextEntry || !trimmedUnit) {
      return;
    }
    nextEntry.unit = trimmedUnit;
    await this.persistEntry(entry);
  }
  async updateIntakeGroupUnit(kind, label, unit, nextUnit) {
    const trimmedUnit = unit.trim().toLowerCase();
    const trimmedNextUnit = nextUnit.trim();
    if (!trimmedNextUnit) {
      return;
    }
    const entry = this.getTodayEntry();
    let changed = false;
    entry.intakeLog.forEach((item) => {
      if (item.kind === kind && item.label.trim().toLowerCase() === label.trim().toLowerCase() && item.unit.trim().toLowerCase() === trimmedUnit) {
        item.unit = trimmedNextUnit;
        changed = true;
      }
    });
    if (changed) {
      await this.persistEntry(entry);
    }
  }
  async removeLatestMatchingIntakeEntry(kind, label, unit) {
    const entry = this.getTodayEntry();
    const targetIndex = entry.intakeLog.findIndex((item) => item.kind === kind && item.label.trim().toLowerCase() === label.trim().toLowerCase() && item.unit.trim().toLowerCase() === unit.trim().toLowerCase());
    if (targetIndex === -1) {
      return;
    }
    entry.intakeLog.splice(targetIndex, 1);
    await this.persistEntry(entry);
  }
  async restoreIntakeEntry(item, index) {
    const entry = this.getTodayEntry();
    const nextLog = [...entry.intakeLog];
    nextLog.splice(clamp(index, 0, nextLog.length), 0, { ...item });
    entry.intakeLog = nextLog.slice(0, 40);
    await this.persistEntry(entry);
  }
  async addSymptomEntry(symptom, severity, note = "") {
    const trimmedSymptom = symptom.trim();
    if (!trimmedSymptom) {
      return;
    }
    const entry = this.getTodayEntry();
    entry.symptomLog = [{
      symptom: trimmedSymptom,
      severity: clamp(Math.round(severity), 1, 5),
      note: note.trim(),
      loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date())
    }, ...entry.symptomLog].slice(0, 30);
    await this.persistEntry(entry);
  }
  async removeSymptomEntry(index) {
    const entry = this.getTodayEntry();
    entry.symptomLog = entry.symptomLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async restoreSymptomEntry(item, index) {
    const entry = this.getTodayEntry();
    const nextLog = [...entry.symptomLog];
    nextLog.splice(clamp(index, 0, nextLog.length), 0, { ...item });
    entry.symptomLog = nextLog.slice(0, 30);
    await this.persistEntry(entry);
  }
  async updateFoodEntryAmount(index, amount) {
    const entry = this.getTodayEntry();
    const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
    const nextEntry = foodEntries[index];
    if (!nextEntry) {
      return;
    }
    nextEntry.amount = clamp(Number(amount), 0.1, 9999);
    await this.persistEntry(entry);
  }
  async removeFoodEntry(index) {
    const entry = this.getTodayEntry();
    let foodIndex = -1;
    entry.intakeLog = entry.intakeLog.filter((item) => {
      if (item.kind !== "food") {
        return true;
      }
      foodIndex += 1;
      return foodIndex !== index;
    });
    await this.persistEntry(entry);
  }
  async restoreFoodEntry(item, index) {
    await this.restoreIntakeEntry(foodEntryToIntakeEntry(item), index);
  }
  async addEnergyCheckIn(score, note = "") {
    const entry = this.getTodayEntry();
    entry.energyCheckIns = [
      {
        loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
        score: clamp(Math.round(score), 1, 5),
        note: note.trim()
      },
      ...entry.energyCheckIns
    ].slice(0, 24);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async removeEnergyCheckIn(index) {
    const entry = this.getTodayEntry();
    entry.energyCheckIns = entry.energyCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async addAnxietyCheckIn(score, note = "") {
    const entry = this.getTodayEntry();
    entry.anxietyCheckIns = [{
      loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
      score: clamp(Math.round(score), 1, 5),
      note: note.trim()
    }, ...entry.anxietyCheckIns].slice(0, 24);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async removeAnxietyCheckIn(index) {
    const entry = this.getTodayEntry();
    entry.anxietyCheckIns = entry.anxietyCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }
  async updateSleepLog(value) {
    const entry = this.getTodayEntry();
    entry.sleepLog = value.trim();
    await this.persistEntry(entry);
  }
  async updateDreamLog(value) {
    const entry = this.getTodayEntry();
    entry.dreamLog = value.trim();
    await this.persistEntry(entry);
  }
  async updateReflection(kind, value) {
    const entry = this.getTodayEntry();
    if (kind === "helped") {
      entry.helpedToday = value.trim();
    } else {
      entry.hurtToday = value.trim();
    }
    await this.persistEntry(entry);
  }
  async updatePoopQuality(sessionStart, quality) {
    const entry = this.getTodayEntry();
    const trimmedQuality = quality.trim();
    if (trimmedQuality) {
      entry.poopQualityByStart[sessionStart] = trimmedQuality;
    } else {
      delete entry.poopQualityByStart[sessionStart];
    }
    await this.persistEntry(entry);
  }
  async generateDailyDietInsight() {
    const entry = this.getTodayEntry();
    const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
    if (foodEntries.length === 0) {
      new import_obsidian4.Notice("Log at least one food entry before asking for a diet summary.");
      return;
    }
    if (!this.getResolvedAiApiKey()) {
      new import_obsidian4.Notice(this.getAiConfigurationMessage());
      return;
    }
    if (this.isAiBusy) {
      new import_obsidian4.Notice("An AI request is already running.");
      return;
    }
    this.isAiBusy = true;
    this.refreshDashboardViews();
    try {
      const foodLines = foodEntries.map((item) => `${item.loggedAt}: ${item.amount} ${item.unit} ${item.label}${item.note ? ` - ${item.note}` : ""}`).join("\n");
      const response = await this.requestAiCompletion(
        [
          "You are a concise nutrition estimation assistant for a personal dashboard.",
          "Estimate likely calories and 2-4 useful nutrition signals from a rough food log.",
          "Be practical, brief, and uncertainty-aware.",
          "Return only markdown bullet points, at most 4 bullets, no heading or preamble."
        ].join(" "),
        [
          `Date: ${entry.date}`,
          "Food log:",
          foodLines,
          "Give an estimated calorie range and a few high-value observations like protein coverage, fiber, sodium, processed-food load, or likely gaps."
        ].join("\n\n")
      );
      entry.dietInsight = stripJsonCodeBlocks(response).trim();
      await this.persistEntry(entry);
      new import_obsidian4.Notice("Diet summary updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new import_obsidian4.Notice(`Diet summary failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }
  async beginLogicalDay() {
    if (this.data.dayState.status === "in-progress") {
      new import_obsidian4.Notice(`Your logical day ${this.data.dayState.activeDate} is already in progress.`);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const nextDate = this.getNextLogicalDayKey(now);
    const timestamp = formatDateTimeKey(now);
    this.data.dayState = {
      activeDate: nextDate,
      status: "in-progress",
      lastInactivityPromptActivityAt: "",
      lastLateNightWarningKey: ""
    };
    const entry = this.getOrCreateEntry(nextDate);
    if (!entry.dayStartedAt) {
      entry.dayStartedAt = timestamp;
    }
    if (!entry.wakeTime) {
      entry.wakeTime = timestamp;
    }
    entry.dayEndedAt = "";
    entry.sleepTime = "";
    await this.persistEntry(entry);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Began logical day ${nextDate}.`);
  }
  async endLogicalDay() {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("No logical day is currently in progress.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    const entry = this.getTodayEntry();
    entry.dayEndedAt = timestamp;
    if (!entry.sleepTime) {
      entry.sleepTime = timestamp;
    }
    this.closeOpenTodayFocusSessions(entry, timestamp);
    closeOpenWorkSessions(entry, timestamp);
    closeOpenNapSessions(entry, timestamp);
    closeOpenRelaxSessions(entry, timestamp);
    closeOpenBreakSessions(entry, timestamp);
    closeOpenPoopSessions(entry, timestamp);
    this.data.dayState = {
      activeDate: entry.date,
      status: "ended",
      lastInactivityPromptActivityAt: "",
      lastLateNightWarningKey: ""
    };
    await this.persistEntry(entry);
    await this.savePluginData();
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Ended logical day ${entry.date}.`);
  }
  async openLogicalDayRepairFlow() {
    new LogicalDayRepairModal(this.app, this).open();
  }
  getDayRepairInput(date = this.getTodayKey()) {
    const entry = this.getOrCreateEntry(date);
    return {
      date,
      status: this.data.dayState.activeDate === date ? this.data.dayState.status : "ended",
      dayStartedAt: entry.dayStartedAt,
      dayEndedAt: entry.dayEndedAt,
      wakeTime: entry.wakeTime,
      sleepTime: entry.sleepTime,
      sleepMinutesOverride: getSleepMinutesForDay(entry, this.getNextEntry(date)),
      workMinutesOverride: getTrackedWorkMinutes(entry),
      napMinutesOverride: getTrackedNapMinutes(entry),
      relaxMinutesOverride: getTrackedRelaxMinutes(entry),
      breakMinutesOverride: getTrackedBreakMinutes(entry),
      moodScore: entry.moodScore,
      energyScore: entry.energyScore,
      anxietyScore: entry.anxietyScore,
      timelineSessions: this.getRepairTimelineSessionsForEntry(entry)
    };
  }
  async repairLogicalDay(date, status) {
    const currentDraft = this.getDayRepairInput(date);
    return await this.applyDayRepair({
      ...currentDraft,
      date,
      status
    });
  }
  async applyDayRepair(input) {
    const normalizedDate = input.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      new import_obsidian4.Notice("Logical day must use YYYY-MM-DD.");
      return false;
    }
    const parsedDate = /* @__PURE__ */ new Date(`${normalizedDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || formatDateKey(parsedDate) !== normalizedDate) {
      new import_obsidian4.Notice("Enter a valid calendar date.");
      return false;
    }
    const dayStartedAt = this.normalizeRepairTimestamp(input.dayStartedAt, "Day start");
    const dayEndedAt = this.normalizeRepairTimestamp(input.dayEndedAt, "Day end");
    const wakeTime = this.normalizeRepairTimestamp(input.wakeTime, "Wake time");
    const sleepTime = this.normalizeRepairTimestamp(input.sleepTime, "Sleep time");
    if (dayStartedAt === null || dayEndedAt === null || wakeTime === null || sleepTime === null) {
      return false;
    }
    this.data.dayState = {
      activeDate: normalizedDate,
      status: input.status,
      lastInactivityPromptActivityAt: "",
      lastLateNightWarningKey: ""
    };
    const normalizedTimelineSessions = this.normalizeRepairTimelineSessions(input.timelineSessions, normalizedDate);
    if (normalizedTimelineSessions === null) {
      return false;
    }
    const entry = this.getOrCreateEntry(normalizedDate);
    entry.dayStartedAt = dayStartedAt;
    entry.dayEndedAt = dayEndedAt;
    entry.wakeTime = wakeTime;
    entry.sleepTime = sleepTime;
    entry.sleepMinutesOverride = clamp(Math.round(input.sleepMinutesOverride), 0, 1440);
    entry.workSessions = this.extractRepairTimelineSessions(normalizedTimelineSessions, "work");
    entry.napSessions = this.extractRepairTimelineSessions(normalizedTimelineSessions, "nap");
    entry.relaxSessions = this.extractRepairTimelineSessions(normalizedTimelineSessions, "relax");
    entry.breakSessions = this.extractRepairTimelineSessions(normalizedTimelineSessions, "break");
    entry.poopSessions = this.extractRepairTimelineSessions(normalizedTimelineSessions, "poop");
    entry.workMinutesOverride = entry.workSessions.length > 0 ? null : clamp(Math.round(input.workMinutesOverride), 0, 1440);
    entry.napMinutesOverride = entry.napSessions.length > 0 ? null : clamp(Math.round(input.napMinutesOverride), 0, 1440);
    entry.relaxMinutesOverride = entry.relaxSessions.length > 0 ? null : clamp(Math.round(input.relaxMinutesOverride), 0, 1440);
    entry.breakMinutesOverride = entry.breakSessions.length > 0 ? null : clamp(Math.round(input.breakMinutesOverride), 0, 1440);
    entry.moodScore = clamp(Math.round(input.moodScore), 0, 5);
    entry.energyScore = clamp(Math.round(input.energyScore), 0, 5);
    entry.anxietyScore = clamp(Math.round(input.anxietyScore), 0, 5);
    await this.persistEntry(entry);
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Updated repair data for ${normalizedDate}.`);
    return true;
  }
  async startWorkSession(tag = "", projectName = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before starting work tracking.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.workSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A work session is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "work");
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.workSessions = [...entry.workSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: projectName.trim() }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Work session started.");
  }
  async stopWorkSession() {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.workSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian4.Notice("No work session is currently active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    activeSession.end = timestamp;
    this.closeOpenTodayFocusSessions(entry, timestamp);
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Work session stopped.");
  }
  async startNapSession(tag = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before starting a nap session.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.napSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A nap session is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "nap");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.napSessions = [...entry.napSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Nap started.");
  }
  async stopNapSession() {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.napSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian4.Notice("No nap session is currently active.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Nap stopped.");
  }
  async startRelaxSession(tag = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before tracking relaxing time.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.relaxSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A relaxing session is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "relax");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.relaxSessions = [...entry.relaxSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Relaxing started.");
  }
  async stopRelaxSession() {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.relaxSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian4.Notice("No relaxing session is currently active.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Relaxing stopped.");
  }
  async startBreakSession(tag = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before starting a break.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.breakSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A break is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "break");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Break started.");
  }
  async pauseAllAndStartBreak() {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before starting a break.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.breakSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A break is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "break");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: "recovery", projectName: "" }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Paused active sessions and started a break.");
  }
  async stopBreakSession() {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.breakSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian4.Notice("No break is currently active.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Break ended.");
  }
  async startPoopSession(tag = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before tracking a bowel movement.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.poopSessions.some((session) => session.end === null)) {
      new import_obsidian4.Notice("A bowel movement session is already active.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "poop");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.poopSessions = [...entry.poopSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Bowel movement tracking started.");
  }
  async stopPoopSession() {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.poopSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian4.Notice("No bowel movement session is currently active.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian4.Notice("Bowel movement tracking stopped.");
  }
  async startActivitySession(kind, tag = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before starting another activity timer.");
      return;
    }
    const entry = this.getTodayEntry();
    const label = formatActivitySessionLabel(kind);
    if (entry.activitySessions.some((session) => session.end === null && session.kind === kind)) {
      new import_obsidian4.Notice(`A ${label.toLowerCase()} session is already active.`);
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeCompetingSessions(entry, timestamp, "activity");
    closeOpenActivitySessions(entry, timestamp);
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.activitySessions = [...entry.activitySessions, {
      kind,
      label,
      start: timestamp,
      end: null,
      tag: tag.trim(),
      projectName: ""
    }];
    await this.persistEntry(entry);
    new import_obsidian4.Notice(`${label} started.`);
  }
  async stopActivitySession(kind) {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.activitySessions].reverse().find((session) => session.end === null && (!kind || session.kind === kind));
    if (!activeSession) {
      new import_obsidian4.Notice("No matching activity session is currently active.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian4.Notice(`${activeSession.label} stopped.`);
  }
  async addExerciseEntry(label, durationMinutes, intensity, note = "", linkedSessionStart = "") {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }
    const entry = this.getTodayEntry();
    entry.exerciseLog = [{
      label: trimmedLabel,
      durationMinutes: clamp(Math.round(durationMinutes), 1, 600),
      intensity,
      note: note.trim(),
      loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
      linkedSessionStart
    }, ...entry.exerciseLog].slice(0, 30);
    await this.persistEntry(entry);
  }
  async removeExerciseEntry(index) {
    const entry = this.getTodayEntry();
    entry.exerciseLog = entry.exerciseLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateBodyWeight(value) {
    const entry = this.getTodayEntry();
    entry.bodyWeight = typeof value === "number" && Number.isFinite(value) && value > 0 ? clamp(value, 1, 9999) : null;
    await this.persistEntry(entry);
  }
  async updateDailyNotes(value) {
    const entry = this.getTodayEntry();
    entry.notes = value.trim();
    await this.persistEntry(entry);
  }
  async resetToday() {
    const freshEntry = this.createEmptyEntry(this.getTodayKey());
    this.data.entries[freshEntry.date] = freshEntry;
    await this.persistEntry(freshEntry);
  }
  async archiveCompletedTasksFromTodo() {
    await this.archiveCompletedTasksFromTodoInternal(true);
  }
  async archiveCompletedTasksFromTodoInternal(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian4.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const archivedAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    const archiveResult = reconcileCompletedTasks(content, archivedAt);
    if (archiveResult.archivedTasks.length === 0 && archiveResult.restoredTasks.length === 0) {
      if (showNotice) {
        new import_obsidian4.Notice("No archive changes were needed.");
      }
      return;
    }
    this.isAutoArchivingTodo = true;
    try {
      if (archiveResult.content !== content) {
        await this.app.vault.modify(todoFile, archiveResult.content);
      }
    } finally {
      window.setTimeout(() => {
        this.isAutoArchivingTodo = false;
      }, 50);
    }
    if (archiveResult.archivedTasks.length > 0) {
      const entry = this.getOrCreateEntry(archivedAt.slice(0, 10));
      entry.completedTasks = [...archiveResult.archivedTasks, ...entry.completedTasks];
      await this.persistEntry(entry);
    }
    if (archiveResult.restoredTasks.length > 0) {
      await this.removeArchivedTaskSnapshots(archiveResult.restoredTasks);
    }
    if (showNotice) {
      const noticeParts = [];
      if (archiveResult.archivedTasks.length > 0) {
        noticeParts.push(`archived ${archiveResult.archivedTasks.length} task${archiveResult.archivedTasks.length === 1 ? "" : "s"}`);
      }
      if (archiveResult.restoredTasks.length > 0) {
        noticeParts.push(`restored ${archiveResult.restoredTasks.length} task${archiveResult.restoredTasks.length === 1 ? "" : "s"}`);
      }
      new import_obsidian4.Notice(`Master task hub ${noticeParts.join(" and ")}.`);
    }
  }
  async generateWeeklyReport() {
    const today = /* @__PURE__ */ new Date();
    const range = getIsoWeekRange(today);
    const entries = this.getEntriesInRange(range.start, range.end);
    const todoSnapshot = await this.getTodoSnapshot();
    const content = renderPeriodReport({
      title: `Weekly Dashboard Report - ${range.label}`,
      rangeLabel: `${formatDateKey(range.start)} to ${formatDateKey(range.end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions(),
      todoSnapshot
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.weeklyReportFolder}/${range.label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian4.Notice("Weekly dashboard report generated.");
  }
  async generateMonthlyReport() {
    const today = /* @__PURE__ */ new Date();
    const label = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const entries = this.getEntriesInRange(start, end);
    const todoSnapshot = await this.getTodoSnapshot();
    const content = renderPeriodReport({
      title: `Monthly Dashboard Report - ${label}`,
      rangeLabel: `${formatDateKey(start)} to ${formatDateKey(end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions(),
      todoSnapshot
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.monthlyReportFolder}/${label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian4.Notice("Monthly dashboard report generated.");
  }
  async generateGamificationReport() {
    const today = /* @__PURE__ */ new Date();
    const label = formatDateKey(today);
    const entries = this.getAllEntries();
    const todoSnapshot = await this.getTodoSnapshot();
    const content = renderGamificationReport({
      title: `Gamification Report - ${label}`,
      entries,
      habits: this.getHabitDefinitions(),
      todoSnapshot
    });
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Gamification/${label}.md`, content);
    await this.openFile(file);
    new import_obsidian4.Notice("Gamification report generated.");
  }
  async exportDashboardMetrics() {
    var _a, _b, _c, _d;
    const entries = this.getAllEntries();
    const today = /* @__PURE__ */ new Date();
    const earliestDate = (_b = (_a = entries[0]) == null ? void 0 : _a.date) != null ? _b : formatDateKey(today);
    const latestDate = (_d = (_c = entries[entries.length - 1]) == null ? void 0 : _c.date) != null ? _d : formatDateKey(today);
    const occurrences = this.getCalendarOccurrencesBetween(earliestDate, latestDate);
    const todoSnapshot = await this.getTodoSnapshot();
    const habits = this.getHabitDefinitions();
    const exportStamp = `${formatDateKey(today)} ${formatFileTimestamp(today)}`;
    const folder = normalizeFolderPath(`${this.data.settings.exportFolder}/${exportStamp}`);
    const summaryContent = this.renderDashboardExportSummary({
      generatedAt: today,
      entries,
      occurrences,
      todoSnapshot,
      habits,
      folder
    });
    const summaryFile = await this.upsertMarkdownFile(`${folder}/summary.md`, summaryContent);
    await this.upsertTextFile(`${folder}/daily-metrics.csv`, this.renderDailyMetricsCsv(entries, habits, occurrences));
    await this.upsertTextFile(`${folder}/habit-metrics.csv`, this.renderHabitMetricsCsv(entries, habits));
    await this.upsertTextFile(`${folder}/completed-tasks.csv`, this.renderCompletedTasksCsv(entries));
    await this.upsertTextFile(`${folder}/calendar-events.csv`, this.renderCalendarOccurrencesCsv(occurrences));
    await this.openFile(summaryFile);
    new import_obsidian4.Notice(`Dashboard export generated in ${folder}.`);
  }
  async openBasicInformationNote() {
    const path = (0, import_obsidian4.normalizePath)(this.data.settings.basicInfoNotePath);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const file = existing instanceof import_obsidian4.TFile ? existing : await this.upsertMarkdownFile(path, this.renderBasicInformationTemplate());
    await this.openFile(file);
  }
  async ensureBasicInformationNoteExists() {
    const path = (0, import_obsidian4.normalizePath)(this.data.settings.basicInfoNotePath);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian4.TFile) {
      return existing;
    }
    return this.upsertMarkdownFile(path, this.renderBasicInformationTemplate());
  }
  async getTodoSnapshot() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return null;
    }
    const content = await this.app.vault.read(todoFile);
    return parseTodoSnapshot(content);
  }
  isFirstRunSetupPending() {
    return !this.data.uiState.onboardingCompleted;
  }
  shouldAutoOpenFirstRunSetupWizard(referenceDate = /* @__PURE__ */ new Date()) {
    if (!this.isFirstRunSetupPending()) {
      return false;
    }
    const deferredUntil = this.data.uiState.onboardingDeferredUntil.trim();
    if (!deferredUntil) {
      return true;
    }
    const deferredDate = new Date(deferredUntil.replace(" ", "T"));
    return Number.isNaN(deferredDate.getTime()) || deferredDate.getTime() <= referenceDate.getTime();
  }
  async openFirstRunSetupWizard() {
    new FirstRunSetupWizardModal(this.app, this).open();
  }
  async snoozeFirstRunSetupWizard(hours = 12) {
    const nextTime = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1e3);
    this.data.uiState.onboardingDeferredUntil = formatDateTimeKey(nextTime);
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async completeFirstRunSetupWizard() {
    if (this.data.uiState.onboardingCompleted) {
      return;
    }
    this.data.uiState.onboardingCompleted = true;
    this.data.uiState.onboardingDeferredUntil = "";
    this.data.uiState.dismissedNotificationIds = this.data.uiState.dismissedNotificationIds.filter((id) => id !== "system:onboarding");
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async dismissDashboardNotification(id) {
    if (!id.trim() || this.data.uiState.dismissedNotificationIds.includes(id)) {
      return;
    }
    this.data.uiState.dismissedNotificationIds = [...this.data.uiState.dismissedNotificationIds, id].slice(-200);
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async dismissCleanupSuggestion(id) {
    if (!id.trim() || this.data.uiState.dismissedCleanupSuggestionIds.includes(id)) {
      return;
    }
    this.data.uiState.dismissedCleanupSuggestionIds = [...this.data.uiState.dismissedCleanupSuggestionIds, id].slice(-200);
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  reconcileDismissedNotificationIds(activeDismissibleIds) {
    const allowed = new Set(activeDismissibleIds);
    const nextDismissed = this.data.uiState.dismissedNotificationIds.filter((id) => allowed.has(id));
    if (nextDismissed.length === this.data.uiState.dismissedNotificationIds.length) {
      return;
    }
    this.data.uiState.dismissedNotificationIds = nextDismissed;
    void this.savePluginData();
  }
  reconcileDismissedCleanupSuggestionIds(activeSuggestionIds) {
    const allowed = new Set(activeSuggestionIds);
    const nextDismissed = this.data.uiState.dismissedCleanupSuggestionIds.filter((id) => allowed.has(id));
    if (nextDismissed.length === this.data.uiState.dismissedCleanupSuggestionIds.length) {
      return;
    }
    this.data.uiState.dismissedCleanupSuggestionIds = nextDismissed;
    void this.savePluginData();
  }
  getVisibleCleanupSuggestions(todoSnapshot) {
    if (!todoSnapshot) {
      this.reconcileDismissedCleanupSuggestionIds([]);
      return [];
    }
    const activeIds = todoSnapshot.cleanupSuggestions.map((item) => item.id);
    this.reconcileDismissedCleanupSuggestionIds(activeIds);
    const dismissed = new Set(this.data.uiState.dismissedCleanupSuggestionIds);
    return todoSnapshot.cleanupSuggestions.filter((item) => !dismissed.has(item.id));
  }
  buildDashboardNotificationId(prefix, values, todayKey) {
    const normalized = values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0).map((value) => value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).join("~").slice(0, 180);
    return normalized.length > 0 ? `${prefix}:${todayKey}:${normalized}` : `${prefix}:${todayKey}`;
  }
  getDashboardNotifications(todoSnapshot, calendarSnapshot, referenceDate = /* @__PURE__ */ new Date()) {
    var _a, _b;
    const items = [];
    const todayKey = formatDateKey(referenceDate);
    const visibleCleanupSuggestions = this.getVisibleCleanupSuggestions(todoSnapshot);
    if (this.isFirstRunSetupPending()) {
      items.push({
        id: "system:onboarding",
        source: "system",
        title: "Finish first-run setup",
        description: "Use the guided setup wizard to confirm your dashboard title, task hub, logs, calendar, and AI defaults before you start relying on the dashboard.",
        tone: "focus",
        action: { kind: "open-setup", label: "Open wizard" },
        dismissible: false
      });
    }
    if (!this.getMasterTodoFile()) {
      items.push({
        id: "system:master-todo-missing",
        source: "system",
        title: "Master task hub is not configured",
        description: `The configured master todo path "${this.data.settings.masterTodoPath}" is missing. Project health, task promotion, and cleanup workflows will stay limited until you point the plugin at a real hub note.`,
        tone: "alert",
        action: { kind: "open-setup", label: "Fix setup" },
        dismissible: false
      });
    }
    if (!this.data.settings.calendarEnabled) {
      items.push({
        id: "system:calendar-disabled",
        source: "system",
        title: "Calendar reminders are disabled",
        description: "Enable the dashboard calendar if you want upcoming events and lead-time reminders to land in the notification center and execution flow.",
        tone: "neutral",
        action: { kind: "open-setup", label: "Review setup" },
        dismissible: true
      });
    }
    calendarSnapshot.reminders.slice(0, 4).forEach((reminder) => {
      items.push({
        id: `calendar:${reminder.id}:${reminder.reminderAt}`,
        source: "calendar",
        title: reminder.title,
        description: [reminder.date, reminder.leadSummary, reminder.projectName || "", reminder.notes].filter((value) => value.length > 0).join(" \u2022 "),
        tone: reminder.warningLevel === "warning" ? "alert" : "focus",
        dismissible: true
      });
    });
    items.push(...this.getActiveRoutineNotifications(referenceDate));
    this.getLogicalDayInsights(referenceDate).prompts.forEach((prompt) => {
      items.push({
        id: `logical-day:${prompt.id}`,
        source: "logical-day",
        title: prompt.title,
        description: prompt.description,
        tone: prompt.tone,
        action: { kind: prompt.kind === "end-day-suggestion" ? "end-day" : "repair-day", label: prompt.kind === "end-day-suggestion" ? "End day" : "Repair day" },
        dismissible: true
      });
    });
    if (todoSnapshot && todoSnapshot.overdueTasks.length > 0) {
      items.push({
        id: this.buildDashboardNotificationId(
          "tasks:overdue",
          todoSnapshot.overdueTasks.slice(0, 5).map(({ project, task }) => `${project}|${task.text}|${task.dueDate}`),
          todayKey
        ),
        source: "tasks",
        title: `${todoSnapshot.overdueTasks.length} overdue task${todoSnapshot.overdueTasks.length === 1 ? "" : "s"}`,
        description: todoSnapshot.overdueTasks.slice(0, 2).map(({ project, task }) => `${project} \u2022 ${task.text}`).join(" \u2022 "),
        tone: "alert",
        action: { kind: "open-master-todo", label: "Open hub" },
        dismissible: true
      });
    }
    if (todoSnapshot && todoSnapshot.blockedTasks.length > 0) {
      items.push({
        id: this.buildDashboardNotificationId(
          "tasks:blocked",
          todoSnapshot.blockedTasks.slice(0, 5).map(({ project, task }) => `${project}|${task.text}|${task.blockedReason}|${task.unblockDate}`),
          todayKey
        ),
        source: "tasks",
        title: `${todoSnapshot.blockedTasks.length} blocked task${todoSnapshot.blockedTasks.length === 1 ? "" : "s"}`,
        description: todoSnapshot.blockedTasks.slice(0, 2).map(({ project, task }) => `${project} \u2022 ${task.text}${task.blockedReason ? ` (${task.blockedReason})` : ""}`).join(" \u2022 "),
        tone: "state",
        action: { kind: "open-master-todo", label: "Open hub" },
        dismissible: true
      });
    }
    if (todoSnapshot && (visibleCleanupSuggestions.length > 0 || todoSnapshot.staleProjects.length > 0)) {
      items.push({
        id: this.buildDashboardNotificationId(
          "tasks:cleanup",
          [
            ...todoSnapshot.staleProjects.slice(0, 5).map((project) => project.name),
            ...visibleCleanupSuggestions.slice(0, 5).map((item) => item.summary)
          ],
          todayKey
        ),
        source: "tasks",
        title: "Cleanup and stale work need review",
        description: [
          todoSnapshot.staleProjects.length > 0 ? `${todoSnapshot.staleProjects.length} stale project${todoSnapshot.staleProjects.length === 1 ? "" : "s"}` : "",
          (_b = (_a = visibleCleanupSuggestions[0]) == null ? void 0 : _a.summary) != null ? _b : ""
        ].filter((value) => value.length > 0).join(" \u2022 "),
        tone: "alert",
        action: { kind: "open-cleanup-note", label: "Open cleanup note" },
        dismissible: true
      });
    }
    const activeDismissibleIds = items.filter((item) => item.dismissible).map((item) => item.id);
    this.reconcileDismissedNotificationIds(activeDismissibleIds);
    const dismissed = new Set(this.data.uiState.dismissedNotificationIds);
    return items.filter((item) => !item.dismissible || !dismissed.has(item.id));
  }
  async getCalendarProjectOptions() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      return [];
    }
    return snapshot.projects.map((project) => {
      const notePath = this.getProjectNotePath(project.name, project.noteLinks);
      return {
        name: project.name,
        notePath,
        wikiLink: this.renderCalendarProjectLink(project.name, notePath)
      };
    }).filter((project, index, array) => array.findIndex((candidate) => candidate.name.toLowerCase() === project.name.toLowerCase()) === index).sort((left, right) => left.name.localeCompare(right.name));
  }
  async getTodoCategories() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return [];
    }
    const content = await this.app.vault.read(todoFile);
    return findTodoCategoryRanges(content.split(/\r?\n/)).map((category) => category.name);
  }
  async openCreateProjectFlow() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian4.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const categories = await this.getTodoCategories();
    new CreateProjectModal(this.app, this, categories).open();
  }
  async openAddHabitFlow() {
    new AddHabitModal(this.app, this).open();
  }
  async createProjectAndNote(input) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian4.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const projectName = input.projectName.trim();
    const categoryName = input.categoryName.trim();
    if (!projectName || !categoryName) {
      new import_obsidian4.Notice("Project name and category are required.");
      return;
    }
    const todoContent = await this.app.vault.read(todoFile);
    const existingProject = findProjectRanges(todoContent.split(/\r?\n/)).some((project) => project.name.toLowerCase() === projectName.toLowerCase());
    if (existingProject) {
      new import_obsidian4.Notice(`A project named ${projectName} already exists in the master todo.`);
      return;
    }
    const projectNote = await this.createProjectNote(input);
    const projectBlock = renderTodoProjectBlock({
      ...input,
      projectName,
      categoryName,
      status: input.status.trim() || "Planning",
      focus: input.focus.trim(),
      addTasks: input.addTasks,
      fixTasks: input.fixTasks,
      projectNoteLink: createWikiLink(projectNote.path, projectName)
    });
    const updatedContent = insertProjectIntoTodo(todoContent, categoryName, projectBlock);
    await this.app.vault.modify(todoFile, updatedContent);
    await this.openFile(projectNote);
    this.refreshDashboardViews();
    new import_obsidian4.Notice(`Created ${projectName} in the master todo and generated its project note.`);
  }
  async createMissingProjectNotesFromTodo(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian4.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projects = extractProjectDefinitionsFromTodo(content);
    if (projects.length === 0) {
      if (showNotice) {
        new import_obsidian4.Notice("No projects were found in the master task hub.");
      }
      return;
    }
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    if (noteFolder) {
      await this.ensureFolder(noteFolder);
    }
    let createdCount = 0;
    for (const project of projects) {
      const expectedPath = this.getPreferredProjectNotePath(project.projectName);
      if (this.app.vault.getAbstractFileByPath(expectedPath)) {
        continue;
      }
      await this.app.vault.create(expectedPath, renderExistingProjectNoteTemplate(project, this.data.settings.masterTodoPath));
      createdCount += 1;
    }
    if (showNotice) {
      new import_obsidian4.Notice(createdCount > 0 ? `Created ${createdCount} missing project note${createdCount === 1 ? "" : "s"}.` : "All project notes already exist.");
    }
  }
  async addTodayFocusItem(value) {
    await this.addTodayFocusItemWithDetails({ text: value });
  }
  async addTodayFocusItemWithDetails(input) {
    const trimmedValue = input.text.trim();
    if (!trimmedValue) {
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.todayFocus.some((item) => item.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new import_obsidian4.Notice("That Top 3 item is already listed.");
      return;
    }
    const activeFocusCount = entry.todayFocus.filter((item) => item.status !== "done").length;
    if (activeFocusCount >= 3) {
      new import_obsidian4.Notice("Top 3 already has three active items. Finish or remove one before adding another.");
      return;
    }
    const normalizedEstimate = Number.isFinite(Number(input.estimateMinutes)) ? clamp(Math.round(Number(input.estimateMinutes)), 0, 1440) : null;
    entry.todayFocus = [
      ...entry.todayFocus,
      this.createTodayFocusItem(
        trimmedValue,
        typeof input.projectName === "string" ? input.projectName.trim() : "",
        typeof input.notes === "string" ? input.notes.trim() : "",
        normalizedEstimate
      )
    ];
    await this.persistEntry(entry);
  }
  async updateTodayFocusItem(index, value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      new import_obsidian4.Notice("Top 3 item text is required.");
      return false;
    }
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }
    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new import_obsidian4.Notice("That Top 3 item is already listed.");
      return false;
    }
    item.text = trimmedValue;
    await this.persistEntry(entry);
    return true;
  }
  async updateTodayFocusDetails(index, updates) {
    const trimmedValue = updates.text.trim();
    if (!trimmedValue) {
      new import_obsidian4.Notice("Top 3 item text is required.");
      return false;
    }
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }
    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new import_obsidian4.Notice("That Top 3 item is already listed.");
      return false;
    }
    item.text = trimmedValue;
    item.projectName = typeof updates.projectName === "string" ? updates.projectName.trim() : "";
    item.notes = typeof updates.notes === "string" ? updates.notes.trim() : "";
    item.estimateMinutes = Number.isFinite(Number(updates.estimateMinutes)) ? clamp(Math.round(Number(updates.estimateMinutes)), 0, 1440) : null;
    await this.persistEntry(entry);
    return true;
  }
  async reorderTodayFocusItems(fromIndex, toIndex) {
    const entry = this.getTodayEntry();
    if (fromIndex === toIndex) {
      return false;
    }
    const item = entry.todayFocus[fromIndex];
    if (!item || toIndex < 0 || toIndex >= entry.todayFocus.length) {
      return false;
    }
    const reordered = [...entry.todayFocus];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);
    entry.todayFocus = reordered;
    await this.persistEntry(entry);
    return true;
  }
  async startTodayFocusItem(index, tag = "", projectName = "") {
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian4.Notice("Begin your logical day before tracking a Top 3 item.");
      return;
    }
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.closeOpenTodayFocusSessions(entry, timestamp, index);
    item.status = "working";
    item.completedAt = null;
    if (!item.workSessions.some((session) => session.end === null)) {
      item.workSessions = [...item.workSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: projectName.trim() }];
    }
    await this.persistEntry(entry);
  }
  async stopTodayFocusItem(index) {
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }
    const activeSession = [...item.workSessions].reverse().find((session) => session.end === null);
    if (!activeSession && item.status !== "working") {
      return;
    }
    if (activeSession) {
      activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    }
    if (item.status === "working") {
      item.status = "pending";
    }
    await this.persistEntry(entry);
  }
  async completeTodayFocusItem(index) {
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    const activeSession = [...item.workSessions].reverse().find((session) => session.end === null);
    if (activeSession) {
      activeSession.end = timestamp;
    }
    item.status = "done";
    item.completedAt = timestamp;
    await this.persistEntry(entry);
  }
  async reopenTodayFocusItem(index) {
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }
    item.status = "pending";
    item.completedAt = null;
    await this.persistEntry(entry);
  }
  async removeTodayFocusItem(index) {
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async restoreTodayFocusItem(item, index) {
    const entry = this.getTodayEntry();
    const nextFocus = [...entry.todayFocus];
    nextFocus.splice(clamp(index, 0, nextFocus.length), 0, {
      ...item,
      workSessions: item.workSessions.map((session) => ({ ...session }))
    });
    entry.todayFocus = nextFocus;
    await this.persistEntry(entry);
  }
  async addNextUpFocusItem(input) {
    const text = input.text.trim();
    if (!text) {
      return false;
    }
    const entry = this.getTodayEntry();
    const alreadyExists = [...entry.todayFocus.map((item) => item.text), ...entry.nextUpFocus.map((item) => item.text)].some((candidate) => candidate.toLowerCase() === text.toLowerCase());
    if (alreadyExists) {
      new import_obsidian4.Notice("That item is already listed in Top 3 or Next Up.");
      return false;
    }
    entry.nextUpFocus = [
      ...entry.nextUpFocus,
      {
        text,
        projectName: typeof input.projectName === "string" ? input.projectName.trim() : "",
        notes: typeof input.notes === "string" ? input.notes.trim() : "",
        estimateMinutes: Number.isFinite(Number(input.estimateMinutes)) ? clamp(Math.round(Number(input.estimateMinutes)), 0, 1440) : null
      }
    ];
    await this.persistEntry(entry);
    return true;
  }
  async promoteNextUpFocusItem(index) {
    const entry = this.getTodayEntry();
    const item = entry.nextUpFocus[index];
    if (!item) {
      return false;
    }
    const activeFocusCount = entry.todayFocus.filter((candidate) => candidate.status !== "done").length;
    if (activeFocusCount >= 3) {
      new import_obsidian4.Notice("Top 3 already has three active items. Finish or remove one before promoting Next Up.");
      return false;
    }
    if (!entry.todayFocus.some((candidate) => candidate.text.toLowerCase() === item.text.toLowerCase())) {
      entry.todayFocus = [...entry.todayFocus, this.createTodayFocusItem(item.text, item.projectName, item.notes, item.estimateMinutes)];
    }
    entry.nextUpFocus = entry.nextUpFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
    return true;
  }
  async removeNextUpFocusItem(index) {
    const entry = this.getTodayEntry();
    entry.nextUpFocus = entry.nextUpFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async restoreNextUpFocusItem(item, index) {
    const entry = this.getTodayEntry();
    const nextFocus = [...entry.nextUpFocus];
    nextFocus.splice(clamp(index, 0, nextFocus.length), 0, { ...item });
    entry.nextUpFocus = nextFocus;
    await this.persistEntry(entry);
  }
  async updateFrictionLog(value) {
    const entry = this.getTodayEntry();
    entry.frictionLog = value.trim();
    await this.persistEntry(entry);
  }
  async promoteTaskToToday(projectName, taskText) {
    await this.addTodayFocusItem(`${projectName}: ${taskText}`);
  }
  async addTaskToProject(projectName, sectionName, taskText) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian4.Notice("Master task hub not found. Set the path in plugin settings.");
      return;
    }
    const trimmedTask = taskText.trim();
    if (!trimmedTask) {
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const updatedContent = insertTaskIntoProjectSection(content, projectName, sectionName, trimmedTask);
    await this.app.vault.modify(todoFile, updatedContent);
    this.refreshDashboardViews();
  }
  async generateWeeklyReview() {
    const today = /* @__PURE__ */ new Date();
    const range = getIsoWeekRange(today);
    const entries = this.getEntriesInRange(range.start, range.end);
    const todoSnapshot = await this.getTodoSnapshot();
    const content = renderWeeklyReview({
      label: range.label,
      start: range.start,
      end: range.end,
      entries,
      todoSnapshot,
      habits: this.getHabitDefinitions()
    });
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Weekly Reviews/${range.label}.md`, content);
    await this.openFile(file);
    new import_obsidian4.Notice("Weekly review note generated.");
  }
  async syncRepeatingProjectTasks(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian4.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projectDefinitions = extractProjectDefinitionsFromTodo(content);
    let updatedContent = content;
    let insertedCount = 0;
    for (const project of projectDefinitions) {
      const notePath = (0, import_obsidian4.normalizePath)(`${stripMarkdownExtension(project.noteLinkPath)}.md`);
      const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
      if (!(abstractFile instanceof import_obsidian4.TFile)) {
        continue;
      }
      const noteContent = await this.app.vault.read(abstractFile);
      const repeatingTasks = extractRepeatingTasks(noteContent);
      repeatingTasks.forEach((task) => {
        if (!isRepeatingTaskDue(task, content, project.projectName)) {
          return;
        }
        updatedContent = insertTaskIntoProjectSection(updatedContent, project.projectName, "Next", `${task.text} [repeat: ${task.ruleText}]`);
        insertedCount += 1;
      });
    }
    if (updatedContent !== content) {
      await this.app.vault.modify(todoFile, updatedContent);
    }
    if (showNotice) {
      new import_obsidian4.Notice(insertedCount > 0 ? `Added ${insertedCount} repeating task${insertedCount === 1 ? "" : "s"}.` : "No repeating tasks were due.");
    }
  }
  async offloadProjectReferences(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian4.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const result = await offloadReferencesFromMasterHub(content, this.app.vault, this.data.settings.masterTodoPath);
    if (result.updatedContent !== content) {
      await this.app.vault.modify(todoFile, result.updatedContent);
    }
    if (showNotice) {
      new import_obsidian4.Notice(result.offloadedProjects.length > 0 ? `Offloaded references for ${result.offloadedProjects.length} project${result.offloadedProjects.length === 1 ? "" : "s"}.` : "No project references needed offloading.");
    }
  }
  async showCleanupSuggestions() {
    var _a;
    const snapshot = await this.getTodoSnapshot();
    const suggestions = this.getVisibleCleanupSuggestions(snapshot);
    const projectSections = ((_a = snapshot == null ? void 0 : snapshot.projects) != null ? _a : []).filter((project) => project.projectState === "active" && (project.staleDays !== null || project.duplicateTasks.length > 0 || project.emptySections.length > 0 || project.breakdownTasks.length > 0)).map((project) => {
      const lines = [
        `## ${project.name}`,
        `- Health: ${project.healthLabel} (${project.healthScore})`,
        `- Next action: ${project.nextAction}`,
        project.staleDays !== null ? `- Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"}` : "",
        project.duplicateTasks.length > 0 ? `- Duplicates: ${project.duplicateTasks.slice(0, 5).join(", ")}` : "",
        project.emptySections.length > 0 ? `- Empty sections: ${project.emptySections.join(", ")}` : "",
        project.breakdownTasks.length > 0 ? `- Needs breakdown: ${project.breakdownTasks.slice(0, 5).join(" \u2022 ")}` : "",
        project.healthReasons.length > 0 ? `- Reasons: ${project.healthReasons.join(" \u2022 ")}` : ""
      ].filter((line) => line.length > 0);
      return [...lines, ""].join("\n");
    });
    const content = [
      `# Master Task Hub Cleanup Suggestions - ${formatDateKey(/* @__PURE__ */ new Date())}`,
      "",
      "## Portfolio Summary",
      ...suggestions.length > 0 ? suggestions.map((item) => `- ${item.summary}`) : ["- No cleanup issues detected."],
      "",
      ...projectSections.length > 0 ? projectSections : ["## Projects", "- No project-level cleanup issues detected.", ""],
      ""
    ].join("\n");
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Cleanup Suggestions/${formatDateKey(/* @__PURE__ */ new Date())}.md`, content);
    await this.openFile(file);
  }
  async generateAiTodayPlan() {
    await this.generateAiMorningStartupBrief();
  }
  async generateAiMorningStartupBrief() {
    await this.runAiWorkflow({
      kind: "Morning Startup Brief",
      templateKey: "morning-startup-brief",
      fileLabel: `AI Morning Startup Brief ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are an operational planning assistant for a personal Obsidian dashboard.",
        "Prioritize practical decision support over motivational writing.",
        "Respond in markdown with these headings: Situation Snapshot, Suggested Top 3, Recommended Sequencing, Risks And Drift, Energy And Recovery, Concrete Actions.",
        "Under Suggested Top 3, provide exactly three concise bullet points that can stand alone as focus items.",
        "End the markdown response with a final heading called Concrete Actions containing immediately executable bullet points.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Create a sharp morning startup brief for today using the dashboard, calendar, and project context below.",
        "Favor leverage, unfinished momentum, stale-risk projects, and realistic energy management.",
        "Do not repeat raw data back unless it matters to the recommendation."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiEndOfDayReview() {
    await this.generateAiShutdownSummary();
  }
  async generateAiShutdownSummary() {
    await this.runAiWorkflow({
      kind: "Shutdown Summary",
      templateKey: "shutdown-summary",
      fileLabel: `AI Shutdown Summary ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are an analytical daily review assistant for an Obsidian dashboard.",
        "Respond in markdown with headings: Wins, Drag And Friction, Behavioral Patterns, Carry Forward Recommendations, Shutdown Recommendation, Concrete Actions.",
        "End the markdown response with a final heading called Concrete Actions containing short shutdown or carry-forward moves.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Review the current logical day.",
        "Explain where output came from, where time or energy leaked, what should seed tomorrow, and which tasks or plans should be carried forward without guilt-language or generic coaching."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiProjectTriage() {
    await this.generateAiProjectRiskScanner();
  }
  async generateAiProjectRiskScanner() {
    await this.runAiWorkflow({
      kind: "Project Risk Scanner",
      templateKey: "project-risk-scanner",
      fileLabel: `AI Project Risk Scanner ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a ruthless but useful project triage assistant.",
        "Respond in markdown with headings: Highest Risk Projects, Immediate Interventions, Hidden Dependencies, Projects To Park Or Reduce, Breakdown Targets, Concrete Actions.",
        "End the markdown response with a final heading called Concrete Actions containing decisions or interventions that can be made now.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Analyze the project landscape from the master task hub and recent logs.",
        "Highlight stale work, overdue pressure, blocked work, overloaded areas, hidden leverage, and what should be deprioritized."
      ].join(" "),
      includeMasterTodoRaw: true
    });
  }
  async generateAiWeeklyCoachNote() {
    await this.generateAiWeeklyPlanningAssistant();
  }
  async generateAiWeeklyPlanningAssistant() {
    await this.runAiWorkflow({
      kind: "Weekly Planning Assistant",
      templateKey: "weekly-planning-assistant",
      fileLabel: `AI Weekly Planning Assistant ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a weekly planning and reflection assistant.",
        "Respond in markdown with headings: Weekly Pattern Read, Habit And Health Drift, Priority Stack, Scheduling Guidance, Guardrails For The Next 7 Days, Concrete Actions.",
        "End the markdown response with a final heading called Concrete Actions containing the next 3 to 6 moves for the coming week.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Use the recent dashboard data to plan the next week.",
        "Prefer concrete prioritization, pacing advice, and risk spotting over abstract encouragement."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiAnomalyDetectionReport() {
    await this.runAiWorkflow({
      kind: "Anomaly Detection",
      templateKey: "anomaly-detection",
      fileLabel: `AI Anomaly Detection ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are an anomaly-detection assistant for a personal Obsidian dashboard.",
        "Respond in markdown with headings: Unusual Shifts, Most Likely Drivers, Evidence Against Each Theory, Stabilizers, Concrete Actions.",
        "Treat anomalies as evidence-backed hypotheses, not hard conclusions.",
        "End the markdown response with a final heading called Concrete Actions containing the shortest useful interventions.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Scan recent mood, sleep, work time, habits, symptoms, and recovery data for anomalies.",
        "Explain what looks unusual, what probably caused it, and what should be tested next."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiPeriodComparisonReport() {
    const todoSnapshot = await this.getTodoSnapshot();
    await this.runAiWorkflow({
      kind: "Period Comparison Report",
      templateKey: "period-comparison-report",
      fileLabel: `AI Period Comparison ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a period-comparison analyst for a personal Obsidian dashboard.",
        "Respond in markdown with headings: Biggest Changes, Improvements, Regressions, Project Shifts, Schedule And Energy Implications, Concrete Actions.",
        "Explain what materially changed between recent periods and why it matters.",
        "End the markdown response with a final heading called Concrete Actions containing clear adjustments for the next period.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Compare the most recent week and month against the immediately preceding periods.",
        "Call out changes that matter operationally rather than merely describing every metric."
      ].join(" "),
      includeMasterTodoRaw: false,
      extraContextSections: [this.buildAiPeriodComparisonContext(todoSnapshot)]
    });
  }
  async generateAiProjectSynthesis() {
    await this.runAiWorkflow({
      kind: "Project Synthesis",
      templateKey: "project-synthesis",
      fileLabel: `AI Project Synthesis ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a synthesis assistant combining dashboard behavior, calendar pressure, project status, archived output, and related notes.",
        "Respond in markdown with headings: Portfolio Picture, Key Project Narratives, Calendar Pressure, Cross-Project Dependencies, Concrete Actions.",
        "Prefer synthesis and implications over raw summarization.",
        "End the markdown response with a final heading called Concrete Actions containing the few moves that reshape the portfolio most. ",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Synthesize the current project landscape from dashboard data, recent logs, calendar commitments, and retrieved notes.",
        "Show how the pieces interact instead of treating each project as isolated."
      ].join(" "),
      includeMasterTodoRaw: true
    });
  }
  async generateAiWhyTodayFeltOff() {
    await this.runAiWorkflow({
      kind: "Why Today Felt Off",
      templateKey: "why-today-felt-off",
      fileLabel: `AI Why Today Felt Off ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are a grounded diagnostic assistant for a personal dashboard.",
        "Respond in markdown with headings: Mismatch Scan, Likely Drivers, Evidence Against Each Driver, Reset Moves, Tomorrow Guardrails, Concrete Actions.",
        "Do not moralize. Prefer operational explanations that can be tested tomorrow.",
        "End the markdown response with a final heading called Concrete Actions containing the shortest useful reset moves.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Analyze why the current logical day may have felt off.",
        "Look for mismatches between plan, energy, mood, sleep, symptoms, interruptions, workload, and follow-through."
      ].join(" "),
      includeMasterTodoRaw: false,
      question: "Why did today feel off?"
    });
  }
  async generateAiActiveNoteAnalysis() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!(activeFile instanceof import_obsidian4.TFile) || !activeFile.path.endsWith(".md")) {
      new import_obsidian4.Notice("Open a markdown note before using active note analysis.");
      return;
    }
    await this.runAiWorkflow({
      kind: "Active Note Analysis",
      templateKey: "active-note-analysis",
      fileLabel: `AI Active Note Analysis ${stripMarkdownExtension(activeFile.name)}`,
      systemPrompt: [
        "You are an analytical assistant reading the user's active Obsidian note in the context of their dashboard and related vault notes.",
        "Respond in markdown with headings: Note Summary, Hidden Implications, Connections To Other Work, Recommended Next Moves, Questions Worth Answering, Concrete Actions.",
        "End the markdown response with a final heading called Concrete Actions containing immediate decisions or edits enabled by the note.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Analyze the active note ${activeFile.path} in the broader context of the dashboard, projects, routines, and related notes.`,
      includeMasterTodoRaw: false,
      includeActiveNote: true,
      question: `Active note analysis for ${activeFile.path}`
    });
  }
  async askAiQuestion(question) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      new import_obsidian4.Notice("Enter a question for the AI first.");
      return;
    }
    await this.runAiWorkflow({
      kind: "Vault Question",
      templateKey: "vault-question",
      fileLabel: `AI Vault Question ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are an analytical assistant for an Obsidian dashboard and task hub.",
        "Answer the user's question using only the provided context.",
        "Respond in markdown with headings: Direct Answer, Supporting Signals, Recommended Actions, Open Questions, Concrete Actions.",
        "End the markdown response with a final heading called Concrete Actions containing the next useful moves implied by the answer.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Answer this question about the dashboard and vault context: ${trimmedQuestion}`,
      includeMasterTodoRaw: true,
      question: trimmedQuestion
    });
  }
  async openAskAiFlow() {
    new AskAiModal(this.app, this).open();
  }
  async runAiWorkflow(input) {
    var _a, _b, _c;
    if (!this.getResolvedAiApiKey()) {
      new import_obsidian4.Notice(this.getAiConfigurationMessage());
      return;
    }
    if (this.isAiBusy) {
      new import_obsidian4.Notice("An AI request is already running.");
      return;
    }
    this.isAiBusy = true;
    this.refreshDashboardViews();
    try {
      await this.ensureAiNoteIndexReady();
      const retrievalQuery = [input.kind, input.userPrompt, (_a = input.question) != null ? _a : ""].filter((item) => item.trim().length > 0).join("\n\n");
      const context = await this.buildAiContext(input.includeMasterTodoRaw, input.question, (_b = input.includeActiveNote) != null ? _b : false, retrievalQuery, (_c = input.extraContextSections) != null ? _c : []);
      const rawResponse = await this.requestAiCompletion(this.applyAiPromptTemplate(input.systemPrompt, input.templateKey), `${input.userPrompt}

${context}`);
      const payload = extractAiStructuredPayload(rawResponse);
      const cleanedMarkdown = stripJsonCodeBlocks(rawResponse).trim();
      const file = await this.createAiOutputNote({
        kind: input.kind,
        fileLabel: input.fileLabel,
        question: input.question,
        markdown: cleanedMarkdown,
        payload
      });
      this.latestAiArtifact = {
        kind: input.kind,
        title: input.fileLabel,
        generatedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
        notePath: file.path,
        summary: extractAiSummary(cleanedMarkdown),
        suggestedFocus: payload.suggestedFocus.slice(0, 3),
        nextActions: (payload.nextActions.length > 0 ? payload.nextActions : payload.suggestedFocus).slice(0, 5)
      };
      this.refreshDashboardViews();
      await this.openFile(file);
      new import_obsidian4.Notice(`${input.kind} note generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new import_obsidian4.Notice(`AI request failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }
  async buildAiContext(includeMasterTodoRaw, question = "", includeActiveNote = false, retrievalQuery = question, extraContextSections = []) {
    const todayEntry = this.getTodayEntry();
    const allEntries = this.getAllEntries();
    const recentEntries = allEntries.slice(-this.data.settings.aiContextDays);
    const todoSnapshot = await this.getTodoSnapshot();
    const calendarSnapshot = await this.getUpcomingCalendarSnapshot();
    const weeklyAgenda = this.getWeeklyAgenda(todayEntry.date);
    const relevantNotes = await this.collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery);
    const recentRange = recentEntries.length > 0 ? `${recentEntries[0].date} to ${recentEntries[recentEntries.length - 1].date}` : "No recent entries";
    const recentReport = recentEntries.length > 0 ? renderPeriodReport({
      title: "Recent Dashboard Context",
      rangeLabel: recentRange,
      entries: recentEntries,
      habitDefinitions: this.getHabitDefinitions(),
      todoSnapshot
    }) : "No recent dashboard entries available.";
    const masterTodoFile = this.getMasterTodoFile();
    const masterTodoRaw = includeMasterTodoRaw && masterTodoFile ? truncateText(await this.app.vault.read(masterTodoFile), 12e3) : "Master task hub raw content not included for this request.";
    const activeFile = includeActiveNote ? this.app.workspace.getActiveFile() : null;
    const basicInfoSection = await this.buildBasicInformationAiContext();
    const activeNoteSection = activeFile instanceof import_obsidian4.TFile ? `## Active Note
Path: ${activeFile.path}

${truncateText(await this.app.vault.read(activeFile), 8e3)}` : "";
    return [
      `Current logical day: ${this.data.dayState.activeDate} (${this.data.dayState.status})`,
      question ? `User question: ${question}` : "",
      "## Today Entry",
      renderDailyLog(todayEntry, this.getHabitDefinitions(), this.getNextEntry(todayEntry.date), this.getCalendarOccurrencesForDate(todayEntry.date)),
      "",
      "## Routine Signals",
      renderRoutineSignalsForAi(recentEntries, this.getHabitDefinitions()),
      "",
      "## Recent Report",
      recentReport,
      "",
      "## Calendar Snapshot",
      this.renderAiCalendarContext(calendarSnapshot, weeklyAgenda),
      "",
      "## Master Task Hub Snapshot",
      renderTodoSnapshotForAi(todoSnapshot),
      "",
      "## Relevant Vault Notes",
      renderAiRelevantNotes(relevantNotes),
      "",
      basicInfoSection,
      "",
      ...extraContextSections.flatMap((section) => section.trim().length > 0 ? [section, ""] : []),
      activeNoteSection,
      "",
      "## Master Task Hub Raw Excerpt",
      masterTodoRaw
    ].filter((section) => section.trim().length > 0).join("\n\n");
  }
  async buildBasicInformationAiContext() {
    if (!this.data.settings.includeBasicInfoInAi) {
      return "";
    }
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian4.normalizePath)(this.data.settings.basicInfoNotePath));
    if (!(file instanceof import_obsidian4.TFile)) {
      return "";
    }
    const content = truncateText(await this.app.vault.read(file), 6e3);
    return [
      "## Basic Information",
      `Path: ${file.path}`,
      content
    ].join("\n\n");
  }
  renderBasicInformationTemplate() {
    const weightUnit = this.data.settings.measurementSystem === "metric" ? "kg" : "lb";
    const latestWeight = this.getLatestRecordedBodyWeight();
    return [
      "# Basic Information",
      "",
      `- Last updated: ${formatDateTimeKey(/* @__PURE__ */ new Date())}`,
      `- Measurement system: ${this.data.settings.measurementSystem}`,
      `- Latest dashboard weight: ${latestWeight !== null ? `${latestWeight} ${weightUnit}` : "Not pulled from dashboard yet"}`,
      "",
      "## Identity",
      "- Preferred name:",
      "- Pronouns:",
      "- Age:",
      "- Birthday or birth year:",
      "- Height:",
      "- Time zone:",
      "- Location context:",
      "",
      "## Body Metrics",
      `- Current weight (${weightUnit}): ${latestWeight !== null ? `${latestWeight}` : ""}`,
      "- Goal weight or range:",
      "- Baseline energy or fatigue notes:",
      "- Important health context:",
      "- Medications or supplements worth remembering:",
      "",
      "## Lifestyle And Interests",
      "- Work or study situation:",
      "- Main interests:",
      "- Hobbies or recurring activities:",
      "- Typical daily schedule:",
      "- Current season of life or major responsibilities:",
      "",
      "## Preferences And Constraints",
      "- Food preferences or restrictions:",
      "- Exercise limitations or priorities:",
      "- Sensory or environment preferences:",
      "- Planning style that usually works best:",
      "- Social preferences or recovery needs:",
      "",
      "## Tools And Systems",
      "- Core apps, trackers, or routines you rely on:",
      "- Important projects or domains that come up often:",
      "- Terms, abbreviations, or names the AI should recognize:",
      "",
      "## AI Guidance",
      "- Helpful context for planning and coaching:",
      "- Suggestions to avoid:",
      "- What a good day looks like:",
      "- Long-term goals the AI should keep in mind:",
      "",
      "## Notes",
      "- Update stable personal facts here when they change.",
      "- Use recent dashboard logs for short-term changes like weight drift, symptoms, or sleep changes.",
      ""
    ].join("\n");
  }
  getLatestRecordedBodyWeight() {
    const weightedEntries = this.getAllEntries().filter((entry) => typeof entry.bodyWeight === "number");
    return weightedEntries.length > 0 ? weightedEntries[weightedEntries.length - 1].bodyWeight : null;
  }
  applyAiPromptTemplate(systemPrompt, templateKey) {
    const templates = parseAiPromptTemplates(this.data.settings.aiPromptTemplates);
    const template = templates[templateKey.toLowerCase()];
    if (!template) {
      return systemPrompt;
    }
    return [systemPrompt, `Additional local workflow instructions for ${templateKey}: ${template}`].join(" ");
  }
  renderAiCalendarContext(snapshot, agenda) {
    const reminders = snapshot.reminders.slice(0, 8).map((item) => {
      const lead = item.leadSummary ? ` (${item.leadSummary})` : "";
      return `- ${item.date} ${item.start}-${item.end} ${item.title}${lead}${item.notes ? ` :: ${truncateText(item.notes, 120)}` : ""}`;
    });
    const agendaLines = agenda.filter((day) => day.events.length > 0).slice(0, 7).map((day) => `- ${day.label}: ${day.events.slice(0, 3).map((event) => `${event.title}${event.allDay ? " (all day)" : ` ${event.startTime}-${event.endTime}`}`).join(" | ")}`);
    return [
      "Upcoming reminders:",
      ...reminders.length > 0 ? reminders : ["- No upcoming reminders in range."],
      "",
      "Weekly agenda:",
      ...agendaLines.length > 0 ? agendaLines : ["- No upcoming calendar events this week."]
    ].join("\n");
  }
  buildAiPeriodComparisonContext(todoSnapshot) {
    const entries = this.getAllEntries();
    const habits = this.getHabitDefinitions();
    const last7 = entries.slice(-7);
    const previous7 = entries.slice(-14, -7);
    const last30 = entries.slice(-30);
    const previous30 = entries.slice(-60, -30);
    const recentTrends = buildPersonalTrendSummary(last30, habits);
    const recentGamification = buildGamificationSummary(last30, habits, todoSnapshot);
    const renderWindow = (title, windowEntries) => {
      if (windowEntries.length === 0) {
        return `${title}
No entries available.`;
      }
      return renderPeriodReport({
        title,
        rangeLabel: `${windowEntries[0].date} to ${windowEntries[windowEntries.length - 1].date}`,
        entries: windowEntries,
        habitDefinitions: habits,
        todoSnapshot
      });
    };
    return [
      "## Explicit Period Comparisons",
      renderWindow("Last 7 Days", last7),
      "",
      renderWindow("Previous 7 Days", previous7),
      "",
      renderWindow("Last 30 Days", last30),
      "",
      renderWindow("Previous 30 Days", previous30),
      "",
      "## Recent Trend Snapshot",
      ...renderPersonalTrendSectionLines(recentTrends),
      "",
      "## Recent Gamification Snapshot",
      ...renderGamificationSectionLines(recentGamification)
    ].join("\n");
  }
  async collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery) {
    if (!this.data.settings.aiIndexEnabled) {
      return [];
    }
    const activeFile = this.app.workspace.getActiveFile();
    const terms = buildAiSearchTerms(question, this.getTodayEntry(), todoSnapshot);
    const activeFilePath = activeFile instanceof import_obsidian4.TFile ? activeFile.path : "";
    const queryEmbedding = this.data.settings.aiEmbeddingsEnabled && retrievalQuery.trim().length > 0 ? await this.requestQueryEmbedding(retrievalQuery) : null;
    return getRelevantIndexedNotes(
      this.data.noteIndex,
      terms,
      queryEmbedding,
      this.data.settings,
      activeFilePath,
      includeActiveNote,
      this.data.settings.aiRelatedNotesLimit
    );
  }
  async requestAiCompletion(systemPrompt, userPrompt) {
    var _a, _b, _c, _d;
    const apiKey = this.getResolvedAiApiKey();
    if (!apiKey) {
      throw new Error(this.getAiConfigurationMessage());
    }
    const response = await fetch(this.data.settings.aiBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.data.settings.aiModel,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    if ((_a = data.error) == null ? void 0 : _a.message) {
      throw new Error(data.error.message);
    }
    const content = (_d = (_c = (_b = data.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
    if (Array.isArray(content)) {
      const text = content.filter((item) => item.type === "text" && typeof item.text === "string").map((item) => {
        var _a2;
        return (_a2 = item.text) != null ? _a2 : "";
      }).join("\n").trim();
      if (text.length > 0) {
        return text;
      }
    }
    throw new Error("OpenAI returned an empty response.");
  }
  async requestQueryEmbedding(text) {
    var _a;
    if (!this.data.settings.aiEmbeddingsEnabled || !this.getResolvedAiApiKey()) {
      return null;
    }
    const embeddings = await this.requestChunkEmbeddings([{ id: "query", text }]);
    return (_a = embeddings.get("query")) != null ? _a : null;
  }
  async requestChunkEmbeddings(chunks) {
    var _a, _b;
    if (!this.data.settings.aiEmbeddingsEnabled) {
      return /* @__PURE__ */ new Map();
    }
    const apiKey = this.getResolvedAiApiKey();
    if (!apiKey) {
      throw new Error(this.getAiConfigurationMessage());
    }
    if (chunks.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const response = await fetch(this.data.settings.aiEmbeddingApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.data.settings.aiEmbeddingModel,
        input: chunks.map((chunk) => chunk.text)
      })
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    if ((_a = data.error) == null ? void 0 : _a.message) {
      throw new Error(data.error.message);
    }
    const result = /* @__PURE__ */ new Map();
    (_b = data.data) == null ? void 0 : _b.forEach((item, index) => {
      var _a2;
      const vector = Array.isArray(item.embedding) ? item.embedding.filter((value) => typeof value === "number" && Number.isFinite(value)) : [];
      if (vector.length > 0) {
        const chunk = chunks[(_a2 = item.index) != null ? _a2 : index];
        if (chunk) {
          result.set(chunk.id, vector);
        }
      }
    });
    return result;
  }
  async createAiOutputNote(input) {
    const dateKey = formatDateKey(/* @__PURE__ */ new Date());
    const timestamp = formatFileTimestamp(/* @__PURE__ */ new Date());
    const folder = normalizeFolderPath(`${this.data.settings.aiOutputFolder}/${dateKey}`);
    const basePath = `${folder}/${timestamp} ${sanitizeFileName(input.fileLabel)}.md`;
    const filePath = this.getAvailableMarkdownPath(basePath);
    const concreteActions = (input.payload.nextActions.length > 0 ? input.payload.nextActions : input.payload.suggestedFocus).slice(0, 6);
    const content = [
      `# ${input.fileLabel}`,
      "",
      `- Generated: ${formatDateTimeKey(/* @__PURE__ */ new Date())}`,
      `- Model: ${this.data.settings.aiModel}`,
      `- Workflow: ${input.kind}`,
      input.question ? `- Question: ${input.question}` : "",
      "",
      "## Response",
      input.markdown,
      "",
      "## Structured Payload",
      "```json",
      JSON.stringify(input.payload, null, 2),
      "```",
      "",
      "## Concrete Actions",
      ...concreteActions.length > 0 ? concreteActions.map((item) => `- ${item}`) : ["- No concrete actions were extracted from this response."],
      ""
    ].filter((line) => line !== "").join("\n");
    return this.upsertMarkdownFile(filePath, content);
  }
  async openPromoteTaskFlow() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot || snapshot.projects.length === 0) {
      new import_obsidian4.Notice("No projects found in the master task hub.");
      return;
    }
    new PromoteTaskModal(this.app, this, snapshot.projects).open();
  }
  async openProjectReviewModeFlow() {
    const options = await this.getProjectReviewOptions();
    if (options.length === 0) {
      new import_obsidian4.Notice("No project notes found for review mode.");
      return;
    }
    new ProjectReviewModal(this.app, this, options).open();
  }
  async openProjectReviewMode(option) {
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof import_obsidian4.TFile) || !todoFile) {
      new import_obsidian4.Notice("Could not open project review mode for that project.");
      return;
    }
    const leftLeaf = this.app.workspace.getLeaf(true);
    await leftLeaf.openFile(todoFile);
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(noteFile);
    this.app.workspace.revealLeaf(rightLeaf);
  }
  async openStructuredProjectReview(option) {
    const checklistFile = await this.generateProjectReviewChecklist(option);
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof import_obsidian4.TFile) || !(checklistFile instanceof import_obsidian4.TFile) || !todoFile) {
      new import_obsidian4.Notice("Could not open structured project review mode for that project.");
      return;
    }
    const leftLeaf = this.app.workspace.getLeaf(true);
    await leftLeaf.openFile(todoFile);
    const middleLeaf = this.app.workspace.getLeaf("split", "vertical");
    await middleLeaf.openFile(noteFile);
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(checklistFile);
    this.app.workspace.revealLeaf(rightLeaf);
  }
  async openAiArtifact(artifact) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian4.normalizePath)(artifact.notePath));
    if (!(file instanceof import_obsidian4.TFile)) {
      new import_obsidian4.Notice("That AI note could not be found in the vault.");
      return;
    }
    await this.openFile(file);
  }
  async getProjectReviewOptions() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      return [];
    }
    return snapshot.projects.map((project) => ({
      projectName: project.name,
      notePath: `${project.noteLinks[0] ? stripMarkdownExtension(project.noteLinks[0]) : `${this.data.settings.projectNotesFolder}/${project.name}`}.md`,
      status: project.status,
      projectState: project.projectState,
      nextAction: project.nextAction,
      healthScore: project.healthScore,
      healthLabel: project.healthLabel,
      healthReasons: project.healthReasons,
      completionsThisWeek: project.completionsThisWeek,
      completionsPreviousWeek: project.completionsPreviousWeek,
      completionsThisMonth: project.completionsThisMonth,
      overdueTasks: project.overdueTasks,
      dueSoonTasks: project.dueSoonTasks,
      blockedTasks: project.blockedTasks,
      duplicateTasks: project.duplicateTasks,
      emptySections: project.emptySections
    })).filter((project) => this.app.vault.getAbstractFileByPath((0, import_obsidian4.normalizePath)(project.notePath)) instanceof import_obsidian4.TFile);
  }
  async generateProjectReviewChecklist(option) {
    const safeName = sanitizeFileName(option.projectName);
    const folder = "Dashboard Logs/Project Reviews";
    const content = [
      `# Project Review - ${option.projectName}`,
      "",
      `- Generated: ${formatDateTimeKey(/* @__PURE__ */ new Date())}`,
      `- Status: ${option.status}`,
      `- State: ${option.projectState}`,
      `- Health: ${option.healthLabel} (${option.healthScore})`,
      `- Next action: ${option.nextAction}`,
      "",
      "## Review Checklist",
      "- [ ] Confirm the current project status still matches reality.",
      `- [ ] Validate or rewrite the next action: ${option.nextAction}`,
      "- [ ] Prune stale or duplicate tasks.",
      "- [ ] Move one real task into Now if the project is active.",
      "- [ ] Decide whether anything should be blocked, parked, incubating, or someday.",
      "- [ ] Capture one decision or note in the project note before closing review.",
      "",
      "## Momentum",
      `- Previous week completions: ${option.completionsPreviousWeek}`,
      `- This week completions: ${option.completionsThisWeek}`,
      `- This month completions: ${option.completionsThisMonth}`,
      "",
      "## Risk Signals",
      ...option.healthReasons.length > 0 ? option.healthReasons.map((reason) => `- ${reason}`) : ["- No extra risk signals recorded."],
      "",
      "## Task Pressure",
      `- Overdue: ${option.overdueTasks.length}`,
      `- Due soon: ${option.dueSoonTasks.length}`,
      `- Blocked: ${option.blockedTasks.length}`,
      `- Duplicate tasks: ${option.duplicateTasks.length}`,
      `- Empty sections: ${option.emptySections.length > 0 ? option.emptySections.join(", ") : "None"}`,
      "",
      "## References",
      `- Master Task Hub: [[${stripMarkdownExtension(this.data.settings.masterTodoPath)}|Master Task Hub]]`,
      `- Project Note: [[${stripMarkdownExtension(option.notePath)}|${option.projectName}]]`,
      ""
    ].join("\n");
    return this.upsertMarkdownFile(`${folder}/${formatDateKey(/* @__PURE__ */ new Date())} ${safeName}.md`, content);
  }
  getHabitStreak(habitId) {
    var _a;
    const habitDefinition = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habitDefinition) {
      return 0;
    }
    const dates = Object.keys(this.data.entries).sort().reverse();
    let streak = 0;
    for (const date of dates) {
      if (!isHabitDueOnDate(habitDefinition, date)) {
        continue;
      }
      const entry = this.data.entries[date];
      const value = (_a = entry.habits[habitId]) != null ? _a : 0;
      if (value >= habitDefinition.target) {
        streak += 1;
        continue;
      }
      break;
    }
    return streak;
  }
  getHabitBestStreak(habitId) {
    var _a;
    const habitDefinition = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habitDefinition) {
      return 0;
    }
    const dates = Object.keys(this.data.entries).sort();
    let bestStreak = 0;
    let currentStreak = 0;
    for (const date of dates) {
      if (!isHabitDueOnDate(habitDefinition, date)) {
        continue;
      }
      const entry = this.data.entries[date];
      const value = (_a = entry.habits[habitId]) != null ? _a : 0;
      if (value >= habitDefinition.target) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        continue;
      }
      currentStreak = 0;
    }
    return bestStreak;
  }
  refreshDashboardViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DailyDashboardView) {
        void view.requestRefresh();
      }
    });
  }
  async openMasterTodo() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian4.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    await this.openFile(todoFile);
  }
  getMasterTodoFile() {
    const target = this.app.vault.getAbstractFileByPath((0, import_obsidian4.normalizePath)(this.data.settings.masterTodoPath));
    return target instanceof import_obsidian4.TFile ? target : null;
  }
  async openFile(file) {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }
  async createProjectNote(input) {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    if (noteFolder) {
      await this.ensureFolder(noteFolder);
    }
    const basePath = this.getPreferredProjectNotePath(input.projectName.trim());
    const uniquePath = this.getAvailableMarkdownPath(basePath);
    return await this.app.vault.create(uniquePath, renderProjectNoteTemplate(input, this.data.settings.masterTodoPath));
  }
  getPreferredProjectNotePath(projectName) {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    const safeProjectName = sanitizeFileName(projectName.trim());
    return noteFolder ? `${noteFolder}/${safeProjectName}.md` : `${safeProjectName}.md`;
  }
  getAvailableMarkdownPath(basePath) {
    const normalizedBasePath = (0, import_obsidian4.normalizePath)(basePath);
    if (!this.app.vault.getAbstractFileByPath(normalizedBasePath)) {
      return normalizedBasePath;
    }
    const extensionIndex = normalizedBasePath.lastIndexOf(".md");
    const prefix = extensionIndex >= 0 ? normalizedBasePath.slice(0, extensionIndex) : normalizedBasePath;
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(`${prefix} ${counter}.md`)) {
      counter += 1;
    }
    return `${prefix} ${counter}.md`;
  }
  getNextLogicalDayKey(referenceDate) {
    return formatDateKey(referenceDate);
  }
  hydratePluginData(loaded) {
    var _a, _b;
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      ...(_a = loaded == null ? void 0 : loaded.settings) != null ? _a : {}
    });
    const rawEntries = (_b = loaded == null ? void 0 : loaded.entries) != null ? _b : {};
    const entries = {};
    Object.entries(rawEntries).forEach(([date, entry]) => {
      entries[date] = this.normalizeEntry(entry, date, settings);
    });
    const calendarEvents = Array.isArray(loaded == null ? void 0 : loaded.calendarEvents) ? loaded.calendarEvents.map((event) => this.normalizeCalendarEvent(event)).filter((event) => event !== null) : [];
    const dayState = normalizeDayState(loaded == null ? void 0 : loaded.dayState, entries);
    return {
      settings,
      entries,
      calendarEvents,
      dayState,
      noteIndex: normalizeNoteIndexCache(loaded == null ? void 0 : loaded.noteIndex),
      uiState: this.normalizeUiState(loaded == null ? void 0 : loaded.uiState)
    };
  }
  normalizeUiState(state) {
    return {
      onboardingCompleted: Boolean(state == null ? void 0 : state.onboardingCompleted),
      onboardingDeferredUntil: typeof (state == null ? void 0 : state.onboardingDeferredUntil) === "string" ? state.onboardingDeferredUntil : "",
      dismissedNotificationIds: Array.isArray(state == null ? void 0 : state.dismissedNotificationIds) ? state.dismissedNotificationIds.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 200) : [],
      dismissedCleanupSuggestionIds: Array.isArray(state == null ? void 0 : state.dismissedCleanupSuggestionIds) ? state.dismissedCleanupSuggestionIds.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 200) : []
    };
  }
  async loadPluginData() {
    this.data = await this.buildDataFromStorage();
    await this.cleanupStaleTrackedMinuteOverrides();
  }
  normalizeEntry(entry, date, settings = this.data.settings) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const baseEntry = createEmptyEntry(date, settings.habitDefinitions);
    if (!entry) {
      return baseEntry;
    }
    const normalizedHabits = {};
    const normalizedHabitEvents = {};
    settings.habitDefinitions.forEach((habit) => {
      var _a2, _b2, _c2, _d2, _e2, _f2;
      const rawEvents = Array.isArray((_a2 = entry.habitEvents) == null ? void 0 : _a2[habit.id]) ? (_d2 = (_c2 = (_b2 = entry.habitEvents) == null ? void 0 : _b2[habit.id]) == null ? void 0 : _c2.filter((item) => typeof item === "string" && item.trim().length > 0)) != null ? _d2 : [] : [];
      const normalizedCount = clamp(Number((_f2 = (_e2 = entry.habits) == null ? void 0 : _e2[habit.id]) != null ? _f2 : rawEvents.length), 0, habit.target);
      normalizedHabits[habit.id] = normalizedCount;
      normalizedHabitEvents[habit.id] = rawEvents.slice(0, normalizedCount);
    });
    const legacyFoodEntries = Array.isArray(entry.foodLog) ? entry.foodLog.map((item) => normalizeFoodEntry(item)).filter((item) => item !== null) : [];
    const normalizedIntakeEntries = Array.isArray(entry.intakeLog) ? entry.intakeLog.map((item) => normalizeIntakeEntry(item)).filter((item) => item !== null) : [];
    const mergedIntakeLog = [...normalizedIntakeEntries, ...legacyFoodEntries.map((item) => foodEntryToIntakeEntry(item))].sort((left, right) => right.loggedAt.localeCompare(left.loggedAt));
    const normalizedMoodCheckIns = Array.isArray(entry.moodCheckIns) ? entry.moodCheckIns.filter((item) => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string")).map((item) => {
      var _a2;
      return {
        loggedAt: item.loggedAt,
        score: clamp(Number((_a2 = item.score) != null ? _a2 : 0), 1, 5),
        feeling: typeof item.feeling === "string" ? item.feeling.trim() : "",
        note: typeof item.note === "string" ? item.note.trim() : ""
      };
    }) : [];
    const normalizedEnergyCheckIns = Array.isArray(entry.energyCheckIns) ? entry.energyCheckIns.filter((item) => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string")).map((item) => {
      var _a2;
      return {
        loggedAt: item.loggedAt,
        score: clamp(Number((_a2 = item.score) != null ? _a2 : 0), 1, 5),
        note: typeof item.note === "string" ? item.note.trim() : ""
      };
    }) : [];
    const normalizedAnxietyCheckIns = Array.isArray(entry.anxietyCheckIns) ? entry.anxietyCheckIns.filter((item) => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string")).map((item) => {
      var _a2;
      return {
        loggedAt: item.loggedAt,
        score: clamp(Number((_a2 = item.score) != null ? _a2 : 0), 1, 5),
        note: typeof item.note === "string" ? item.note.trim() : ""
      };
    }) : [];
    return {
      date,
      lastEditedAt: getEntryRecencyKey(entry),
      dayStartedAt: typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
      dayEndedAt: typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
      wakeTime: typeof entry.wakeTime === "string" ? entry.wakeTime : "",
      wakeQualityScore: clamp(Number((_a = entry.wakeQualityScore) != null ? _a : 0), 0, 5),
      sleepTime: typeof entry.sleepTime === "string" ? entry.sleepTime : "",
      sleepMinutesOverride: Number.isFinite(Number(entry.sleepMinutesOverride)) ? clamp(Number(entry.sleepMinutesOverride), 0, 1440) : null,
      habits: normalizedHabits,
      habitEvents: normalizedHabitEvents,
      moodScore: (_d = (_b = normalizedMoodCheckIns[0]) == null ? void 0 : _b.score) != null ? _d : clamp(Number((_c = entry.moodScore) != null ? _c : 0), 0, 5),
      energyScore: (_g = (_e = normalizedEnergyCheckIns[0]) == null ? void 0 : _e.score) != null ? _g : clamp(Number((_f = entry.energyScore) != null ? _f : 0), 0, 5),
      anxietyScore: (_j = (_h = normalizedAnxietyCheckIns[0]) == null ? void 0 : _h.score) != null ? _j : clamp(Number((_i = entry.anxietyScore) != null ? _i : 0), 0, 5),
      todayFocus: normalizeTodayFocusItems(entry.todayFocus),
      nextUpFocus: normalizeNextUpFocusItems(entry.nextUpFocus),
      calendarFollowThroughCompleted: Array.isArray(entry.calendarFollowThroughCompleted) ? entry.calendarFollowThroughCompleted.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(
        Object.fromEntries(
          settings.habitDefinitions.filter((habit) => isHabitDueOnDate(habit, date)).map((habit) => {
            var _a2;
            return [habit.id, (_a2 = normalizedHabits[habit.id]) != null ? _a2 : 0];
          })
        ),
        settings.habitDefinitions.filter((habit) => isHabitDueOnDate(habit, date))
      ),
      habitMissNotes: entry.habitMissNotes && typeof entry.habitMissNotes === "object" ? Object.fromEntries(Object.entries(entry.habitMissNotes).filter((item) => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0).map(([key, value]) => [key, value.trim()])) : {},
      foodLog: [],
      intakeLog: mergedIntakeLog,
      symptomLog: Array.isArray(entry.symptomLog) ? entry.symptomLog.map((item) => normalizeSymptomEntry(item)).filter((item) => item !== null) : [],
      bodyWeight: Number.isFinite(Number(entry.bodyWeight)) && Number(entry.bodyWeight) > 0 ? clamp(Number(entry.bodyWeight), 1, 9999) : null,
      exerciseLog: Array.isArray(entry.exerciseLog) ? entry.exerciseLog.map((item) => normalizeExerciseEntry(item)).filter((item) => item !== null) : [],
      moodCheckIns: normalizedMoodCheckIns,
      energyCheckIns: normalizedEnergyCheckIns,
      anxietyCheckIns: normalizedAnxietyCheckIns,
      dietInsight: typeof entry.dietInsight === "string" ? entry.dietInsight : "",
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      dreamLog: typeof entry.dreamLog === "string" ? entry.dreamLog : "",
      helpedToday: typeof entry.helpedToday === "string" ? entry.helpedToday : "",
      hurtToday: typeof entry.hurtToday === "string" ? entry.hurtToday : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions) ? entry.workSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null,
        tag: typeof item.tag === "string" ? item.tag.trim() : "",
        projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
      })) : [],
      workMinutesOverride: Number.isFinite(Number(entry.workMinutesOverride)) ? clamp(Number(entry.workMinutesOverride), 0, 1440) : null,
      napSessions: Array.isArray(entry.napSessions) ? entry.napSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null,
        tag: typeof item.tag === "string" ? item.tag.trim() : "",
        projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
      })) : [],
      napMinutesOverride: Number.isFinite(Number(entry.napMinutesOverride)) ? clamp(Number(entry.napMinutesOverride), 0, 1440) : null,
      relaxSessions: Array.isArray(entry.relaxSessions) ? entry.relaxSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null,
        tag: typeof item.tag === "string" ? item.tag.trim() : "",
        projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
      })) : [],
      relaxMinutesOverride: Number.isFinite(Number(entry.relaxMinutesOverride)) ? clamp(Number(entry.relaxMinutesOverride), 0, 1440) : null,
      breakSessions: Array.isArray(entry.breakSessions) ? entry.breakSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null,
        tag: typeof item.tag === "string" ? item.tag.trim() : "",
        projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
      })) : [],
      breakMinutesOverride: Number.isFinite(Number(entry.breakMinutesOverride)) ? clamp(Number(entry.breakMinutesOverride), 0, 1440) : null,
      poopSessions: Array.isArray(entry.poopSessions) ? entry.poopSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null,
        tag: typeof item.tag === "string" ? item.tag.trim() : "",
        projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
      })) : [],
      activitySessions: Array.isArray(entry.activitySessions) ? entry.activitySessions.map((item) => normalizeActivitySession(item)).filter((item) => item !== null) : [],
      poopQualityByStart: entry.poopQualityByStart && typeof entry.poopQualityByStart === "object" ? Object.fromEntries(Object.entries(entry.poopQualityByStart).filter((item) => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0).map(([key, value]) => [key, value.trim()])) : {},
      completedTasks: Array.isArray(entry.completedTasks) ? entry.completedTasks.filter((item) => Boolean(item && typeof item === "object")).map((item) => ({
        project: typeof item.project === "string" ? item.project : "Unknown Project",
        section: typeof item.section === "string" ? item.section : "General",
        text: typeof item.text === "string" ? item.text : "",
        archivedAt: typeof item.archivedAt === "string" ? item.archivedAt : date,
        note: typeof item.note === "string" ? item.note : ""
      })).filter((item) => item.text.trim().length > 0) : []
    };
  }
  getOrCreateEntry(date) {
    if (!this.data.entries[date]) {
      this.data.entries[date] = this.createEmptyEntry(date);
    }
    return this.data.entries[date];
  }
  getEffectiveTrackedEntry(entry) {
    return this.withCleanTrackedMinuteOverrides(entry);
  }
  withCleanTrackedMinuteOverrides(entry) {
    const normalizedEntry = {
      ...entry,
      workSessions: [...entry.workSessions],
      napSessions: [...entry.napSessions],
      relaxSessions: [...entry.relaxSessions],
      breakSessions: [...entry.breakSessions]
    };
    return this.cleanTrackedMinuteOverrides(normalizedEntry) ? normalizedEntry : entry;
  }
  cleanTrackedMinuteOverrides(entry) {
    let changed = false;
    const isActiveDay = this.data.dayState.status === "in-progress" && entry.date === this.data.dayState.activeDate;
    const clearOverride = (key, sessions) => {
      const hasTrackedSessions = getTrackedMinutes(sessions) > 0;
      if (!isActiveDay && !(entry[key] === 0 && hasTrackedSessions)) {
        return;
      }
      if (entry[key] !== null) {
        entry[key] = null;
        changed = true;
      }
    };
    clearOverride("workMinutesOverride", entry.workSessions);
    clearOverride("napMinutesOverride", entry.napSessions);
    clearOverride("relaxMinutesOverride", entry.relaxSessions);
    clearOverride("breakMinutesOverride", entry.breakSessions);
    return changed;
  }
  cleanSleepTiming(entry) {
    var _a, _b;
    let changed = false;
    const previousEntry = this.getPreviousEntry(entry.date);
    const previousSleepTime = (_a = previousEntry == null ? void 0 : previousEntry.sleepTime) != null ? _a : "";
    const inferredWakeTime = this.getEarliestActivityTimestamp(entry, previousSleepTime);
    if (previousSleepTime) {
      if (entry.wakeTime && entry.wakeTime < previousSleepTime) {
        const nextWakeTime = inferredWakeTime != null ? inferredWakeTime : "";
        if (entry.wakeTime !== nextWakeTime) {
          entry.wakeTime = nextWakeTime;
          changed = true;
        }
      }
      if (entry.dayStartedAt && entry.dayStartedAt < previousSleepTime) {
        const nextDayStart = (_b = inferredWakeTime != null ? inferredWakeTime : entry.wakeTime) != null ? _b : "";
        if (entry.dayStartedAt !== nextDayStart) {
          entry.dayStartedAt = nextDayStart;
          changed = true;
        }
      }
    }
    const derivedSleepMinutes = getSleepMinutesForDay({
      ...entry,
      sleepMinutesOverride: null
    }, this.getNextEntry(entry.date));
    if (entry.sleepMinutesOverride === 0 && derivedSleepMinutes > 0) {
      entry.sleepMinutesOverride = null;
      changed = true;
    }
    return changed;
  }
  getEarliestActivityTimestamp(entry, minimumTimestamp = "") {
    var _a;
    const timestamps = [
      ...entry.workSessions.map((session) => session.start),
      ...entry.napSessions.map((session) => session.start),
      ...entry.relaxSessions.map((session) => session.start),
      ...entry.breakSessions.map((session) => session.start),
      ...entry.poopSessions.map((session) => session.start),
      ...entry.activitySessions.map((session) => session.start),
      ...entry.todayFocus.flatMap((item) => item.workSessions.map((session) => session.start)),
      ...entry.foodLog.map((item) => {
        var _a2;
        return (_a2 = item.loggedAt) != null ? _a2 : "";
      }),
      ...entry.exerciseLog.map((item) => {
        var _a2;
        return (_a2 = item.loggedAt) != null ? _a2 : "";
      }),
      ...entry.moodCheckIns.map((item) => {
        var _a2;
        return (_a2 = item.loggedAt) != null ? _a2 : "";
      }),
      ...entry.energyCheckIns.map((item) => {
        var _a2;
        return (_a2 = item.loggedAt) != null ? _a2 : "";
      }),
      ...entry.anxietyCheckIns.map((item) => {
        var _a2;
        return (_a2 = item.loggedAt) != null ? _a2 : "";
      }),
      ...Object.values(entry.habitEvents).flat(),
      entry.dayEndedAt,
      entry.sleepTime
    ].filter((value) => Boolean(value) && (!minimumTimestamp || value >= minimumTimestamp));
    return (_a = timestamps.sort()[0]) != null ? _a : null;
  }
  getRepairTimelineSessionsForEntry(entry) {
    return [
      ...this.buildRepairTimelineSessions(entry.workSessions, "work"),
      ...this.buildRepairTimelineSessions(entry.napSessions, "nap"),
      ...this.buildRepairTimelineSessions(entry.relaxSessions, "relax"),
      ...this.buildRepairTimelineSessions(entry.breakSessions, "break"),
      ...this.buildRepairTimelineSessions(entry.poopSessions, "poop")
    ].sort((left, right) => `${left.start}|${left.kind}`.localeCompare(`${right.start}|${right.kind}`));
  }
  buildRepairTimelineSessions(sessions, kind) {
    return sessions.map((session, index) => {
      var _a, _b;
      return {
        id: `${kind}-${index}-${session.start}-${(_a = session.end) != null ? _a : "open"}`,
        kind,
        start: session.start,
        end: (_b = session.end) != null ? _b : "",
        tag: session.tag
      };
    });
  }
  syncStateRollups(entry) {
    var _a, _b, _c, _d, _e, _f;
    entry.moodScore = (_b = (_a = entry.moodCheckIns[0]) == null ? void 0 : _a.score) != null ? _b : 0;
    entry.energyScore = (_d = (_c = entry.energyCheckIns[0]) == null ? void 0 : _c.score) != null ? _d : 0;
    entry.anxietyScore = (_f = (_e = entry.anxietyCheckIns[0]) == null ? void 0 : _e.score) != null ? _f : 0;
  }
  normalizeRepairTimelineSessions(sessions, date) {
    const normalized = [];
    for (const [index, session] of sessions.entries()) {
      const label = `${session.kind} session ${index + 1}`;
      const start = this.normalizeRepairTimestamp(session.start, `${label} start`);
      const end = this.normalizeRepairTimestamp(session.end, `${label} end`);
      if (start === null || end === null) {
        return null;
      }
      if (!start || !end) {
        new import_obsidian4.Notice(`${label} needs both a start and end time.`);
        return null;
      }
      if (start.slice(0, 10) !== date || end.slice(0, 10) !== date) {
        new import_obsidian4.Notice(`${label} must stay on ${date}. Use the correct logical date before applying the repair.`);
        return null;
      }
      if (end <= start) {
        new import_obsidian4.Notice(`${label} must end after it starts.`);
        return null;
      }
      normalized.push({
        id: session.id || `${session.kind}-${index}-${start}`,
        kind: session.kind,
        start,
        end,
        tag: session.tag.trim()
      });
    }
    return normalized.sort((left, right) => `${left.start}|${left.kind}`.localeCompare(`${right.start}|${right.kind}`));
  }
  extractRepairTimelineSessions(sessions, kind) {
    return sessions.filter((session) => session.kind === kind).map((session) => ({
      start: session.start,
      end: session.end,
      tag: session.tag.trim()
    }));
  }
  ensureWakeAndDayStartFromActivity(entry, timestamp) {
    var _a, _b;
    const previousSleepTime = (_b = (_a = this.getPreviousEntry(entry.date)) == null ? void 0 : _a.sleepTime) != null ? _b : "";
    if (!previousSleepTime) {
      return;
    }
    if (!entry.wakeTime || entry.wakeTime < previousSleepTime) {
      entry.wakeTime = timestamp;
    }
    if (!entry.dayStartedAt || entry.dayStartedAt < previousSleepTime) {
      entry.dayStartedAt = timestamp;
    }
  }
  async cleanupStaleTrackedMinuteOverrides() {
    let changed = false;
    for (const [date, entry] of Object.entries(this.data.entries)) {
      const entryChanged = this.cleanTrackedMinuteOverrides(entry) || this.cleanSleepTiming(entry);
      if (!entryChanged) {
        continue;
      }
      this.data.entries[date] = this.normalizeEntry(entry, date, this.data.settings);
      await this.syncDailyLog(this.data.entries[date]);
      changed = true;
    }
    if (!changed) {
      return;
    }
    await this.savePluginData();
  }
  createEmptyEntry(date) {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }
  normalizeCalendarEvent(event) {
    if (!event || typeof event !== "object") {
      return null;
    }
    const title = typeof event.title === "string" ? event.title.trim() : "";
    const date = typeof event.date === "string" ? event.date.trim() : "";
    const endDate = typeof event.endDate === "string" && event.endDate.trim().length > 0 ? event.endDate.trim() : date;
    const startTime = typeof event.startTime === "string" ? event.startTime.trim() : "";
    const endTime = typeof event.endTime === "string" ? event.endTime.trim() : "";
    const prepMinutes = Number.isFinite(Number(event.prepMinutes)) ? clamp(Number(event.prepMinutes), 0, 720) : 0;
    const travelMinutes = Number.isFinite(Number(event.travelMinutes)) ? clamp(Number(event.travelMinutes), 0, 720) : 0;
    const category = event.category === "work" || event.category === "health" || event.category === "errands" || event.category === "social" ? event.category : "personal";
    const projectName = typeof event.projectName === "string" ? event.projectName.trim() : "";
    const projectNotePath = typeof event.projectNotePath === "string" && event.projectNotePath.trim().length > 0 ? (0, import_obsidian4.normalizePath)(event.projectNotePath.trim()) : "";
    const repeatCadence = event.repeatCadence === "daily" || event.repeatCadence === "weekly" || event.repeatCadence === "monthly" || event.repeatCadence === "yearly" ? event.repeatCadence : "none";
    const repeatUntil = typeof event.repeatUntil === "string" ? event.repeatUntil.trim() : "";
    const occurrenceExceptions = Array.isArray(event.occurrenceExceptions) ? event.occurrenceExceptions.filter((item) => Boolean(item && typeof item === "object" && typeof item.originalDate === "string")).map((item) => ({
      originalDate: item.originalDate.trim(),
      kind: item.kind === "skip" || item.kind === "cancel" ? item.kind : "move",
      date: typeof item.date === "string" ? item.date.trim() : item.originalDate.trim(),
      endDate: typeof item.endDate === "string" && item.endDate.trim().length > 0 ? item.endDate.trim() : typeof item.date === "string" ? item.date.trim() : item.originalDate.trim(),
      startTime: typeof item.startTime === "string" ? item.startTime.trim() : "",
      endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
      prepMinutes: Number.isFinite(Number(item.prepMinutes)) ? clamp(Number(item.prepMinutes), 0, 720) : prepMinutes,
      travelMinutes: Number.isFinite(Number(item.travelMinutes)) ? clamp(Number(item.travelMinutes), 0, 720) : travelMinutes,
      category: item.category === "work" || item.category === "health" || item.category === "errands" || item.category === "social" ? item.category : category,
      title: typeof item.title === "string" ? item.title : title,
      projectName: typeof item.projectName === "string" ? item.projectName.trim() : projectName,
      projectNotePath: typeof item.projectNotePath === "string" && item.projectNotePath.trim().length > 0 ? (0, import_obsidian4.normalizePath)(item.projectNotePath.trim()) : projectNotePath,
      notes: typeof item.notes === "string" ? item.notes : "",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
    })).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.originalDate) && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate)) : [];
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < date) {
      return null;
    }
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      return null;
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      return null;
    }
    return {
      id: typeof event.id === "string" && event.id.trim().length > 0 ? event.id : `calendar-${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      date,
      endDate,
      startTime,
      endTime,
      prepMinutes,
      travelMinutes,
      category,
      projectName,
      projectNotePath: projectName ? projectNotePath : "",
      notes: typeof event.notes === "string" ? event.notes : "",
      repeatCadence,
      repeatUntil,
      occurrenceExceptions,
      createdAt: typeof event.createdAt === "string" ? event.createdAt : "",
      updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : ""
    };
  }
  validateCalendarEventInput(input) {
    const title = input.title.trim();
    const date = input.date.trim();
    const endDate = input.endDate.trim() || date;
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    const prepMinutes = Number.isFinite(Number(input.prepMinutes)) ? clamp(Number(input.prepMinutes), 0, 720) : 0;
    const travelMinutes = Number.isFinite(Number(input.travelMinutes)) ? clamp(Number(input.travelMinutes), 0, 720) : 0;
    const category = input.category;
    const projectName = input.projectName.trim();
    const projectNotePath = input.projectNotePath.trim() ? (0, import_obsidian4.normalizePath)(input.projectNotePath.trim()) : "";
    const notes = input.notes.trim();
    const repeatCadence = input.repeatCadence;
    const repeatUntil = input.repeatUntil.trim();
    if (!title) {
      new import_obsidian4.Notice("Calendar event title is required.");
      return null;
    }
    if (!["work", "health", "errands", "social", "personal"].includes(category)) {
      new import_obsidian4.Notice("Calendar event category is invalid.");
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      new import_obsidian4.Notice("Calendar event date must use YYYY-MM-DD.");
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      new import_obsidian4.Notice("Calendar event end date must use YYYY-MM-DD.");
      return null;
    }
    if (endDate < date) {
      new import_obsidian4.Notice("Calendar event end date must be on or after the start date.");
      return null;
    }
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      new import_obsidian4.Notice("Start time must use HH:MM.");
      return null;
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      new import_obsidian4.Notice("End time must use HH:MM.");
      return null;
    }
    if (startTime && endTime && endDate === date && endTime < startTime) {
      new import_obsidian4.Notice("End time must be after start time.");
      return null;
    }
    if (!["none", "daily", "weekly", "monthly", "yearly"].includes(repeatCadence)) {
      new import_obsidian4.Notice("Unsupported repeat cadence.");
      return null;
    }
    if (repeatUntil && !/^\d{4}-\d{2}-\d{2}$/.test(repeatUntil)) {
      new import_obsidian4.Notice("Repeat-until must use YYYY-MM-DD.");
      return null;
    }
    if (repeatUntil && repeatUntil < date) {
      new import_obsidian4.Notice("Repeat-until must be on or after the event date.");
      return null;
    }
    return {
      title,
      date,
      endDate,
      startTime,
      endTime,
      prepMinutes,
      travelMinutes,
      category,
      projectName,
      projectNotePath: projectName ? projectNotePath : "",
      notes,
      repeatCadence,
      repeatUntil,
      occurrenceExceptions: []
    };
  }
  createTodayFocusItem(text, projectName = "", notes = "", estimateMinutes = null) {
    return {
      text,
      projectName,
      notes,
      estimateMinutes,
      status: "pending",
      workSessions: [],
      completedAt: null
    };
  }
  async openQuickCaptureFocusFlow() {
    var _a;
    const todoSnapshot = await this.getTodoSnapshot();
    new FocusCaptureModal(this.app, {
      mode: "capture",
      todayHasTop3Capacity: this.getTodayEntry().todayFocus.filter((item) => item.status !== "done").length < 3,
      availableProjectNames: ((_a = todoSnapshot == null ? void 0 : todoSnapshot.projects) != null ? _a : []).map((project) => project.name),
      onSubmit: async (payload) => {
        if (payload.destination === "top3") {
          await this.addTodayFocusItemWithDetails(payload);
          return;
        }
        await this.addNextUpFocusItem(payload);
      }
    }).open();
  }
  closeOpenTodayFocusSessions(entry, timestamp, activeIndex = -1) {
    let changed = false;
    entry.todayFocus.forEach((item, index) => {
      if (index === activeIndex || item.status === "done") {
        return;
      }
      const activeSession = [...item.workSessions].reverse().find((session) => session.end === null);
      if (activeSession) {
        activeSession.end = timestamp;
        changed = true;
      }
      if (item.status === "working") {
        item.status = "pending";
        changed = true;
      }
    });
    return changed;
  }
  closeCompetingSessions(entry, timestamp, keepOpen) {
    if (keepOpen !== "work") {
      closeOpenWorkSessions(entry, timestamp);
    }
    if (keepOpen !== "nap") {
      closeOpenNapSessions(entry, timestamp);
    }
    if (keepOpen !== "relax") {
      closeOpenRelaxSessions(entry, timestamp);
    }
    if (keepOpen !== "break") {
      closeOpenBreakSessions(entry, timestamp);
    }
    if (keepOpen !== "poop") {
      closeOpenPoopSessions(entry, timestamp);
    }
    if (keepOpen !== "activity") {
      closeOpenActivitySessions(entry, timestamp);
    }
  }
  getPreviousEntry(date) {
    const dates = Object.keys(this.data.entries).filter((entryDate) => entryDate < date).sort();
    const previousDate = dates.slice(-1)[0];
    return previousDate ? this.data.entries[previousDate] : void 0;
  }
  getNextEntry(date) {
    const dates = Object.keys(this.data.entries).filter((entryDate) => entryDate > date).sort();
    const nextDate = dates[0];
    return nextDate ? this.data.entries[nextDate] : void 0;
  }
  normalizeRepairTimestamp(value, label) {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const parsed = new Date(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) {
      new import_obsidian4.Notice(`${label} must be a valid date and time.`);
      return null;
    }
    return formatDateTimeKey(parsed);
  }
  async removeArchivedTaskSnapshots(tasks) {
    const updatedDates = /* @__PURE__ */ new Set();
    tasks.forEach((task) => {
      const dateKey = task.archivedAt.slice(0, 10);
      const entry = this.data.entries[dateKey];
      if (!entry) {
        return;
      }
      const index = entry.completedTasks.findIndex((candidate) => candidate.project === task.project && candidate.section === task.section && candidate.text === task.text && candidate.archivedAt === task.archivedAt);
      if (index < 0) {
        return;
      }
      entry.completedTasks.splice(index, 1);
      updatedDates.add(dateKey);
    });
    for (const dateKey of updatedDates) {
      await this.persistEntry(this.data.entries[dateKey]);
    }
  }
  getDailyLogPath(date, settings = this.data.settings) {
    return (0, import_obsidian4.normalizePath)(`${normalizeFolderPath(settings.dailyLogFolder)}/${date}.md`);
  }
  isDailyLogPath(path, settings = this.data.settings) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path);
    const dailyLogFolder = normalizeFolderPath(settings.dailyLogFolder);
    return dailyLogFolder.length > 0 && normalizedPath.startsWith(`${dailyLogFolder}/`) && normalizedPath.endsWith(".md");
  }
  async loadDailyEntriesFromVault(settings) {
    const entries = {};
    const dailyLogFolder = normalizeFolderPath(settings.dailyLogFolder);
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      const normalizedPath = (0, import_obsidian4.normalizePath)(file.path);
      return normalizedPath.startsWith(`${dailyLogFolder}/`) && normalizedPath.endsWith(".md");
    });
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const dateFromPath = file.basename;
      const parsed = parseDailyLogEntry(content, dateFromPath, settings.habitDefinitions);
      if (parsed) {
        entries[parsed.date] = this.normalizeEntry(parsed, parsed.date, settings);
      }
    }
    return entries;
  }
  async reloadDailyLogFile(file) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(file.path);
    if (!this.isDailyLogPath(normalizedPath)) {
      return;
    }
    const content = await this.app.vault.read(file);
    const parsed = parseDailyLogEntry(content, file.basename, this.data.settings.habitDefinitions);
    if (!parsed) {
      this.removeDailyLogEntry(normalizedPath);
      return;
    }
    const normalizedEntry = this.normalizeEntry(parsed, parsed.date, this.data.settings);
    this.cleanTrackedMinuteOverrides(normalizedEntry);
    this.cleanSleepTiming(normalizedEntry);
    this.data.entries[parsed.date] = normalizedEntry;
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  removeDailyLogEntry(path) {
    var _a, _b;
    if (!this.isDailyLogPath(path)) {
      return;
    }
    const date = (_b = (_a = path.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/i, "")) != null ? _b : "";
    if (!date || !this.data.entries[date]) {
      return;
    }
    delete this.data.entries[date];
    void this.savePluginData();
    this.refreshDashboardViews();
  }
  async buildDataFromStorage() {
    const loaded = await this.loadData();
    const hydrated = this.hydratePluginData(loaded);
    const importedEntries = { ...hydrated.entries };
    const dailyLogEntries = await this.loadDailyEntriesFromVault(hydrated.settings);
    Object.entries(dailyLogEntries).forEach(([date, entry]) => {
      if (!importedEntries[date]) {
        importedEntries[date] = entry;
      }
    });
    return {
      ...hydrated,
      entries: importedEntries,
      dayState: normalizeDayState(hydrated.dayState, importedEntries)
    };
  }
  scheduleNoteIndexRefresh() {
    if (!this.data.settings.aiIndexEnabled) {
      return;
    }
    if (this.noteIndexDebounceId !== null) {
      window.clearTimeout(this.noteIndexDebounceId);
    }
    this.noteIndexDebounceId = window.setTimeout(() => {
      this.noteIndexDebounceId = null;
      void this.rebuildAiNoteIndex(false);
    }, 2e3);
  }
  async rebuildAiNoteIndex(showNotice) {
    var _a;
    if (!this.data.settings.aiIndexEnabled) {
      if (showNotice) {
        new import_obsidian4.Notice("AI note indexing is disabled in settings.");
      }
      return;
    }
    if (this.isIndexingNotes) {
      if (showNotice) {
        new import_obsidian4.Notice("AI note indexing is already in progress.");
      }
      return;
    }
    this.isIndexingNotes = true;
    this.refreshDashboardViews();
    try {
      const allFiles = this.app.vault.getMarkdownFiles();
      const nextEntries = {};
      const chunksForEmbedding = [];
      for (const file of allFiles) {
        if (!shouldIndexFilePath(file.path, this.data.settings)) {
          continue;
        }
        const content = await this.app.vault.read(file);
        const entry = buildNoteIndexEntry(file, content, this.data.settings.aiChunkCharLimit);
        nextEntries[(0, import_obsidian4.normalizePath)(file.path)] = entry;
        entry.chunks.forEach((chunk) => {
          chunksForEmbedding.push({
            path: entry.path,
            chunkId: chunk.id,
            text: `${chunk.heading ? `${chunk.heading}
` : ""}${chunk.text}`
          });
        });
      }
      if (this.data.settings.aiEmbeddingsEnabled && chunksForEmbedding.length > 0) {
        const embeddingMap = await this.requestChunkEmbeddings(chunksForEmbedding.map((chunk) => ({
          id: chunk.chunkId,
          text: chunk.text
        })));
        Object.values(nextEntries).forEach((entry) => {
          entry.chunks = entry.chunks.map((chunk) => ({
            ...chunk,
            embedding: embeddingMap.get(chunk.id)
          }));
        });
      }
      this.data.noteIndex = {
        version: 1,
        indexedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
        lastIndexedFile: (_a = Object.keys(nextEntries).sort().slice(-1)[0]) != null ? _a : "",
        entries: nextEntries
      };
      await this.persistNoteIndex();
      this.refreshDashboardViews();
      if (showNotice) {
        const embeddedChunkCount = Object.values(nextEntries).reduce((sum, entry) => sum + entry.chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length, 0);
        new import_obsidian4.Notice(`Indexed ${Object.keys(nextEntries).length} markdown note${Object.keys(nextEntries).length === 1 ? "" : "s"} for AI retrieval${this.data.settings.aiEmbeddingsEnabled ? ` with ${embeddedChunkCount} embedded chunk${embeddedChunkCount === 1 ? "" : "s"}` : ""}.`);
      }
    } finally {
      this.isIndexingNotes = false;
      this.refreshDashboardViews();
    }
  }
  async ensureAiNoteIndexReady() {
    if (!this.data.settings.aiIndexEnabled) {
      return;
    }
    if (Object.keys(this.data.noteIndex.entries).length > 0) {
      return;
    }
    await this.rebuildAiNoteIndex(false);
  }
  async savePluginData() {
    await this.saveData({
      settings: this.data.settings,
      entries: this.data.entries,
      calendarEvents: this.data.calendarEvents,
      dayState: this.data.dayState,
      noteIndex: this.data.noteIndex,
      uiState: this.data.uiState
    });
  }
  async persistNoteIndex() {
    await this.savePluginData();
  }
  async persistEntry(entry) {
    this.cleanTrackedMinuteOverrides(entry);
    this.cleanSleepTiming(entry);
    this.data.entries[entry.date] = this.normalizeEntry({
      ...entry,
      lastEditedAt: formatPreciseDateTimeKey(/* @__PURE__ */ new Date())
    }, entry.date);
    await this.syncDailyLog(this.data.entries[entry.date]);
    const previousEntry = this.getPreviousEntry(entry.date);
    if (previousEntry) {
      await this.syncDailyLog(previousEntry);
    }
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async backfillDailyLogsFromEntries() {
    const dates = Object.keys(this.data.entries).sort();
    for (const date of dates) {
      await this.syncDailyLog(this.data.entries[date]);
    }
  }
  async ensureTodayEntry() {
    const today = this.getTodayKey();
    const exists = Boolean(this.data.entries[today]);
    const entry = this.getOrCreateEntry(today);
    if (!exists) {
      await this.persistEntry(entry);
      return;
    }
    await this.syncDailyLog(entry);
  }
  async refreshForNewDay() {
    if (this.data.dayState.status === "not-started") {
      const calendarKey = formatDateKey(/* @__PURE__ */ new Date());
      if (calendarKey !== this.data.dayState.activeDate) {
        this.data.dayState.activeDate = calendarKey;
        await this.savePluginData();
        this.refreshDashboardViews();
      }
    }
    await this.ensureTodayEntry();
    await this.maybeNotifyLogicalDayPrompts();
    this.maybeWarnRoutineWindows();
    if (this.data.dayState.status === "in-progress") {
      const calendarKey = formatDateKey(/* @__PURE__ */ new Date());
      if (calendarKey !== this.data.dayState.activeDate) {
        this.refreshDashboardViews();
      }
    }
  }
  scheduleAutomaticTodoArchive() {
    if (this.isAutoArchivingTodo) {
      return;
    }
    if (this.autoArchiveDebounceId !== null) {
      window.clearTimeout(this.autoArchiveDebounceId);
    }
    this.autoArchiveDebounceId = window.setTimeout(() => {
      this.autoArchiveDebounceId = null;
      void this.archiveCompletedTasksFromTodoInternal(false);
    }, 500);
  }
  getEntriesInRange(start, end) {
    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);
    return Object.keys(this.data.entries).filter((date) => date >= startKey && date <= endKey).sort().map((date) => this.data.entries[date]);
  }
  async syncDailyLog(entry) {
    const content = renderDailyLog(entry, this.getHabitDefinitions(), this.getNextEntry(entry.date), this.getCalendarOccurrencesForDate(entry.date));
    await this.upsertMarkdownFile(`${this.data.settings.dailyLogFolder}/${entry.date}.md`, content);
  }
  buildLogicalDayPrompts(entry, referenceDate, lastActivityAt, inactiveMinutes, hasActiveSession, isRollover) {
    const prompts = [];
    const calendarDate = formatDateKey(referenceDate);
    const thresholdMinutes = isRollover ? 60 : referenceDate.getHours() >= 21 ? 120 : 240;
    if (!hasActiveSession && inactiveMinutes !== null && inactiveMinutes >= thresholdMinutes && !entry.dayEndedAt && lastActivityAt && this.hasMeaningfulLogicalDayActivity(entry)) {
      prompts.push({
        id: `end-day-${entry.date}`,
        kind: "end-day-suggestion",
        title: "Day looks inactive",
        description: `No tracked activity for ${this.formatDurationMinutes(inactiveMinutes)}. If you're done, end ${entry.date} so sleep and tomorrow's work land on the right day.`,
        tone: isRollover ? "alert" : "focus"
      });
    }
    if (isRollover && !entry.dayEndedAt) {
      prompts.push({
        id: `late-night-${entry.date}-${calendarDate}`,
        kind: "late-night-warning",
        title: `Still logging to ${entry.date}`,
        description: `It's ${referenceDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} on ${calendarDate}. New sessions and edits still belong to ${entry.date} until you end the logical day.`,
        tone: "alert"
      });
    }
    return prompts;
  }
  getLogicalDayLastActivityAt(entry) {
    return getEntryRecencyKey(entry);
  }
  hasActiveLogicalDaySessions(entry) {
    return entry.workSessions.some((session) => session.end === null) || entry.napSessions.some((session) => session.end === null) || entry.relaxSessions.some((session) => session.end === null) || entry.breakSessions.some((session) => session.end === null) || entry.poopSessions.some((session) => session.end === null) || entry.activitySessions.some((session) => session.end === null) || entry.todayFocus.some((item) => item.workSessions.some((session) => session.end === null));
  }
  hasMeaningfulLogicalDayActivity(entry) {
    return entry.workSessions.length > 0 || entry.napSessions.length > 0 || entry.relaxSessions.length > 0 || entry.breakSessions.length > 0 || entry.poopSessions.length > 0 || entry.activitySessions.length > 0 || entry.exerciseLog.length > 0 || entry.foodLog.length > 0 || entry.completedTasks.length > 0 || entry.todayFocus.some((item) => item.workSessions.length > 0 || item.status === "done") || Object.values(entry.habitEvents).some((events) => events.length > 0) || entry.notes.trim().length > 0 || entry.frictionLog.trim().length > 0;
  }
  parseDashboardDateTime(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const parsed = new Date(normalized.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  formatDurationMinutes(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  async maybeNotifyLogicalDayPrompts(referenceDate = /* @__PURE__ */ new Date()) {
    var _a;
    if (this.data.dayState.status !== "in-progress") {
      if (this.data.dayState.lastInactivityPromptActivityAt || this.data.dayState.lastLateNightWarningKey) {
        this.data.dayState.lastInactivityPromptActivityAt = "";
        this.data.dayState.lastLateNightWarningKey = "";
        await this.savePluginData();
      }
      return;
    }
    const insights = this.getLogicalDayInsights(referenceDate);
    const entry = this.getTodayEntry();
    let changed = false;
    const hasInactivityPrompt = insights.prompts.some((prompt) => prompt.kind === "end-day-suggestion");
    if (hasInactivityPrompt) {
      if (insights.lastActivityAt && this.data.dayState.lastInactivityPromptActivityAt !== insights.lastActivityAt) {
        this.data.dayState.lastInactivityPromptActivityAt = insights.lastActivityAt;
        changed = true;
        this.showDashboardNotice(`Day-end suggestion: ${entry.date} has been inactive for ${this.formatDurationMinutes((_a = insights.inactiveMinutes) != null ? _a : 0)}. End it when you're done.`, 9e3, true);
      }
    } else if (this.data.dayState.lastInactivityPromptActivityAt) {
      this.data.dayState.lastInactivityPromptActivityAt = "";
      changed = true;
    }
    const calendarDate = formatDateKey(referenceDate);
    const lateNightWarningKey = insights.isRollover ? `${entry.date}|${calendarDate}` : "";
    if (lateNightWarningKey) {
      if (this.data.dayState.lastLateNightWarningKey !== lateNightWarningKey) {
        this.data.dayState.lastLateNightWarningKey = lateNightWarningKey;
        changed = true;
        this.showDashboardNotice(`Late-night rollover: you are still logging to ${entry.date}. End the logical day when you want new activity on ${calendarDate}.`, 1e4, true);
      }
    } else if (this.data.dayState.lastLateNightWarningKey) {
      this.data.dayState.lastLateNightWarningKey = "";
      changed = true;
    }
    if (changed) {
      await this.savePluginData();
      this.refreshDashboardViews();
    }
  }
  async syncCalendarArtifacts(seedDates = []) {
    await this.syncCalendarDocument();
    const dates = new Set(seedDates);
    Object.keys(this.data.entries).forEach((date) => dates.add(date));
    this.getCalendarArtifactDates().forEach((date) => dates.add(date));
    dates.forEach((date) => {
      if (!this.data.entries[date] && this.getCalendarOccurrencesForDate(date).length > 0) {
        this.data.entries[date] = this.createEmptyEntry(date);
      }
    });
    for (const date of Array.from(dates).sort()) {
      const entry = this.data.entries[date];
      if (entry) {
        await this.syncDailyLog(entry);
      }
    }
  }
  getCalendarArtifactDates() {
    const horizonEnd = /* @__PURE__ */ new Date();
    horizonEnd.setDate(horizonEnd.getDate() + _DailyDashboardPlugin.CALENDAR_ARTIFACT_HORIZON_DAYS);
    return Array.from(new Set(
      this.getCalendarOccurrencesInRange(/* @__PURE__ */ new Date(), horizonEnd).flatMap((event) => this.getDateKeysInSpan(event.date, event.endDate))
    )).sort();
  }
  async syncCalendarDocument() {
    const content = this.renderCalendarDocument();
    await this.upsertMarkdownFile(this.data.settings.calendarDocumentPath, content);
  }
  async importCalendarEventsFromMarkdown() {
    const payload = await this.readCalendarDocumentPayload();
    if (!payload) {
      return;
    }
    const mergedEvents = this.mergeCalendarEvents(this.data.calendarEvents, payload.events);
    if (!this.haveCalendarEventsChanged(this.data.calendarEvents, mergedEvents)) {
      return;
    }
    this.data.calendarEvents = mergedEvents;
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async reloadCalendarDocumentFile(file) {
    if ((0, import_obsidian4.normalizePath)(file.path) !== (0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath)) {
      return;
    }
    await this.importCalendarEventsFromMarkdown();
  }
  async readCalendarDocumentPayload() {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath));
    if (!(file instanceof import_obsidian4.TFile)) {
      return null;
    }
    const content = await this.app.vault.read(file);
    const match = content.match(/## Calendar Payload\s+```json\s*([\s\S]*?)\s*```/i);
    if (!match) {
      return null;
    }
    try {
      const parsed = JSON.parse(match[1]);
      const events = Array.isArray(parsed) ? parsed.map((event) => this.normalizeCalendarEvent(event)).filter((event) => event !== null) : [];
      return {
        updatedAt: "",
        eventCount: events.length,
        events
      };
    } catch (error) {
      console.error("Obsidian DASH - Daily Action & System Hub could not parse calendar document payload", error);
      return null;
    }
  }
  mergeCalendarEvents(primary, secondary) {
    const merged = /* @__PURE__ */ new Map();
    [...primary, ...secondary].forEach((event) => {
      const existing = merged.get(event.id);
      if (!existing) {
        merged.set(event.id, event);
        return;
      }
      const existingUpdatedAt = existing.updatedAt || existing.createdAt || "";
      const eventUpdatedAt = event.updatedAt || event.createdAt || "";
      if (eventUpdatedAt >= existingUpdatedAt) {
        merged.set(event.id, event);
      }
    });
    return Array.from(merged.values()).sort((left, right) => `${left.date} ${left.startTime || "00:00"} ${left.title.toLowerCase()}`.localeCompare(`${right.date} ${right.startTime || "00:00"} ${right.title.toLowerCase()}`));
  }
  haveCalendarEventsChanged(left, right) {
    return JSON.stringify(left) !== JSON.stringify(right);
  }
  renderCalendarDocument() {
    const payload = JSON.stringify(this.data.calendarEvents, null, 2);
    const sourceLines = this.getCalendarEvents().length > 0 ? this.getCalendarEvents().map((event) => {
      const timing = event.startTime ? `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}` : event.date === event.endDate ? `${event.date} All day` : `${event.date} -> ${event.endDate} All day`;
      const category = ` \u2022 ${event.category}`;
      const lead = this.renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
      const recurrence = event.repeatCadence !== "none" ? ` \u2022 repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}` : "";
      const exceptions = event.occurrenceExceptions.length > 0 ? ` \u2022 ${event.occurrenceExceptions.length} one-off change${event.occurrenceExceptions.length === 1 ? "" : "s"}` : "";
      const project = event.projectName ? ` \u2022 ${this.renderCalendarProjectLink(event.projectName, event.projectNotePath)}` : "";
      const notes = event.notes ? ` \u2022 ${event.notes}` : "";
      return `- ${timing}: ${event.title}${category}${project}${lead ? ` \u2022 ${lead}` : ""}${recurrence}${exceptions}${notes}`;
    }) : ["- No calendar events yet."];
    const upcomingOccurrences = this.getCalendarOccurrencesInRange(/* @__PURE__ */ new Date(), new Date(Date.now() + 180 * 24 * 60 * 60 * 1e3));
    const upcomingLines = upcomingOccurrences.length > 0 ? upcomingOccurrences.slice(0, 200).map((event) => {
      const timing = event.startTime ? `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}` : event.date === event.endDate ? `${event.date} All day` : `${event.date} -> ${event.endDate} All day`;
      const category = ` \u2022 ${event.category}`;
      const lead = this.renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
      const recurrence = event.isRecurring ? ` \u2022 from ${event.repeatCadence} series` : "";
      const exception = event.isException ? ` \u2022 ${event.exceptionKind === "move" ? `moved from ${event.originalDate}` : `${event.exceptionKind} once on ${event.originalDate}`}` : "";
      const project = event.projectName ? ` \u2022 ${this.renderCalendarProjectLink(event.projectName, event.projectNotePath)}` : "";
      const notes = event.notes ? ` \u2022 ${event.notes}` : "";
      return `- ${timing}: ${event.title}${category}${project}${lead ? ` \u2022 ${lead}` : ""}${recurrence}${exception}${notes}`;
    }) : ["- No upcoming occurrences."];
    return [
      "---",
      `updatedAt: ${formatDateTimeKey(/* @__PURE__ */ new Date())}`,
      `eventCount: ${this.data.calendarEvents.length}`,
      "---",
      "",
      "# Calendar",
      "",
      "## Event Series",
      ...sourceLines,
      "",
      "## Upcoming Occurrences",
      ...upcomingLines,
      "",
      "## Calendar Payload",
      "```json",
      payload,
      "```",
      ""
    ].join("\n");
  }
  async upsertMarkdownFile(path, content) {
    return this.upsertTextFile(path, this.buildGeneratedMarkdownContent(path, content));
  }
  getProjectNotePath(projectName, noteLinks = []) {
    var _a, _b;
    const safeName = projectName.trim();
    if (!safeName) {
      return "";
    }
    const firstLink = (_b = (_a = noteLinks.find((link) => link.trim().length > 0)) == null ? void 0 : _a.trim()) != null ? _b : "";
    const basePath = firstLink ? stripMarkdownExtension(firstLink) : normalizeFolderPath(`${this.data.settings.projectNotesFolder}/${safeName}`);
    return basePath ? `${basePath}.md` : "";
  }
  renderCalendarProjectLink(projectName, projectNotePath) {
    const safeName = projectName.trim();
    if (!safeName) {
      return "";
    }
    return projectNotePath.trim() ? createWikiLink(projectNotePath.trim(), safeName) : safeName;
  }
  renderDashboardExportSummary(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const linkedOccurrences = input.occurrences.filter((event) => event.projectName.trim().length > 0).length;
    const completedTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
    const averageMood = input.entries.length > 0 ? (input.entries.reduce((sum, entry) => sum + entry.moodScore, 0) / input.entries.length).toFixed(1) : "0.0";
    const averageEnergy = input.entries.length > 0 ? (input.entries.reduce((sum, entry) => sum + entry.energyScore, 0) / input.entries.length).toFixed(1) : "0.0";
    const averageWorkMinutes = input.entries.length > 0 ? Math.round(input.entries.reduce((sum, entry) => sum + this.getTrackedWorkMinutes(entry), 0) / input.entries.length) : 0;
    return [
      `# Dashboard Export - ${formatDateKey(input.generatedAt)}`,
      "",
      `- Generated: ${formatDateTimeKey(input.generatedAt)}`,
      `- Export folder: ${input.folder}`,
      `- Entry range: ${(_b = (_a = input.entries[0]) == null ? void 0 : _a.date) != null ? _b : formatDateKey(input.generatedAt)} to ${(_d = (_c = input.entries[input.entries.length - 1]) == null ? void 0 : _c.date) != null ? _d : formatDateKey(input.generatedAt)}`,
      `- Daily entries: ${input.entries.length}`,
      `- Calendar occurrences: ${input.occurrences.length}`,
      `- Calendar occurrences linked to projects: ${linkedOccurrences}`,
      `- Completed tasks exported: ${completedTasks}`,
      `- Average mood: ${averageMood}/5`,
      `- Average energy: ${averageEnergy}/5`,
      `- Average tracked work: ${averageWorkMinutes}m/day`,
      "",
      "## Files",
      "- summary.md",
      "- daily-metrics.csv",
      "- habit-metrics.csv",
      "- completed-tasks.csv",
      "- calendar-events.csv",
      "",
      "## Portfolio Snapshot",
      `- Open tasks: ${(_f = (_e = input.todoSnapshot) == null ? void 0 : _e.totalOpen) != null ? _f : 0}`,
      `- Archived tasks: ${(_h = (_g = input.todoSnapshot) == null ? void 0 : _g.totalArchived) != null ? _h : 0}`,
      `- Active projects tracked: ${(_j = (_i = input.todoSnapshot) == null ? void 0 : _i.projects.length) != null ? _j : 0}`,
      ...input.todoSnapshot && input.todoSnapshot.staleProjects.length > 0 ? input.todoSnapshot.staleProjects.slice(0, 5).map((project) => {
        var _a2;
        return `- Stale: ${project.name} (${(_a2 = project.staleDays) != null ? _a2 : 0} days, ${project.openCount} open tasks)`;
      }) : ["- No stale projects in the current snapshot."],
      "",
      "## Habit Definitions",
      ...input.habits.length > 0 ? input.habits.map((habit) => `- ${habit.label}: target ${habit.target}, ${habit.cadence}, ${habit.completionWindow}, difficulty ${habit.difficultyWeight}/3`) : ["- No habits configured."],
      ""
    ].join("\n");
  }
  buildGeneratedMarkdownContent(path, content) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path);
    const tags = this.getGeneratedDocumentTagsForPath(normalizedPath);
    if (tags.length === 0) {
      return content;
    }
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const tagBlock = ["tags:", ...tags.map((tag) => `  - ${tag}`)].join("\n");
    if (!frontmatterMatch) {
      return `---
${tagBlock}
---

${content.replace(/^\s+/, "")}`;
    }
    const existingFrontmatter = frontmatterMatch[1].replace(/^tags:\s*\[[^\]]*\]\s*$/m, "").replace(/^tags:\s*\r?\n(?:  - .*\r?\n?)*/m, "").trimEnd();
    const body = content.slice(frontmatterMatch[0].length).replace(/^\s+/, "");
    const nextFrontmatter = [existingFrontmatter, tagBlock].filter((section) => section.trim().length > 0).join("\n");
    return `---
${nextFrontmatter}
---

${body}`;
  }
  getGeneratedDocumentTagsForPath(path) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path).toLowerCase();
    const configuredTags = this.data.settings.generatedDocumentTags.split(/[\r\n,]+/).map((tag) => tag.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase()).filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
    const autoTags = ["daily-dashboard"];
    const prefixMatches = (folderPath) => {
      const normalizedFolder = (0, import_obsidian4.normalizePath)(folderPath).toLowerCase();
      return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
    };
    if (normalizedPath === (0, import_obsidian4.normalizePath)(this.data.settings.basicInfoNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile");
    } else if (prefixMatches(this.data.settings.dailyLogFolder)) {
      autoTags.push("daily-dashboard/daily-log");
    } else if (prefixMatches(this.data.settings.weeklyReportFolder)) {
      autoTags.push("daily-dashboard/weekly-report");
    } else if (prefixMatches(this.data.settings.monthlyReportFolder)) {
      autoTags.push("daily-dashboard/monthly-report");
    } else if (prefixMatches(this.data.settings.aiOutputFolder)) {
      autoTags.push("daily-dashboard/ai");
    } else if (prefixMatches(this.data.settings.exportFolder)) {
      autoTags.push("daily-dashboard/export");
    } else if (normalizedPath === (0, import_obsidian4.normalizePath)(this.data.settings.calendarDocumentPath).toLowerCase()) {
      autoTags.push("daily-dashboard/calendar");
    } else if (normalizedPath.startsWith("dashboard logs/gamification/")) {
      autoTags.push("daily-dashboard/gamification");
    } else if (normalizedPath.startsWith("dashboard logs/weekly reviews/")) {
      autoTags.push("daily-dashboard/weekly-review");
    } else if (normalizedPath.startsWith("dashboard logs/project reviews/")) {
      autoTags.push("daily-dashboard/project-review");
    } else if (normalizedPath.startsWith("dashboard logs/cleanup suggestions/")) {
      autoTags.push("daily-dashboard/cleanup");
    }
    return [.../* @__PURE__ */ new Set([...configuredTags, ...autoTags])];
  }
  renderDailyMetricsCsv(entries, habits, occurrences) {
    const calendarCountsByDate = /* @__PURE__ */ new Map();
    occurrences.forEach((event) => {
      var _a;
      calendarCountsByDate.set(event.date, ((_a = calendarCountsByDate.get(event.date)) != null ? _a : 0) + 1);
    });
    const rows = entries.map((entry) => {
      var _a;
      const nextEntry = this.getNextEntry(entry.date);
      const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
      const foodEntryCount = entry.intakeLog.filter((item) => item.kind === "food").length;
      const drinkEntryCount = entry.intakeLog.filter((item) => item.kind === "drink").length;
      return [
        entry.date,
        `${entry.moodScore}`,
        `${entry.energyScore}`,
        `${entry.anxietyScore}`,
        `${entry.wakeQualityScore}`,
        `${sleepMinutes}`,
        `${this.getTrackedWorkMinutes(entry)}`,
        `${this.getTrackedNapMinutes(entry)}`,
        `${this.getTrackedRelaxMinutes(entry)}`,
        `${this.getTrackedBreakMinutes(entry)}`,
        `${this.getTrackedPoopMinutes(entry)}`,
        `${this.getTrackedPoopCount(entry)}`,
        `${getHabitWeightedCompletion(entry, habits)}`,
        `${entry.todayFocus.length}`,
        `${entry.completedTasks.length}`,
        `${foodEntryCount}`,
        `${drinkEntryCount}`,
        `${entry.symptomLog.length}`,
        `${entry.energyCheckIns.length}`,
        `${(_a = calendarCountsByDate.get(entry.date)) != null ? _a : 0}`,
        `${entry.calendarFollowThroughCompleted.length}`
      ];
    });
    return this.renderCsv([
      [
        "date",
        "moodScore",
        "energyScore",
        "anxietyScore",
        "wakeQualityScore",
        "trackedSleepMinutes",
        "trackedWorkMinutes",
        "trackedNapMinutes",
        "trackedRelaxMinutes",
        "trackedBreakMinutes",
        "trackedPoopMinutes",
        "trackedPoopCount",
        "habitWeightedCompletion",
        "todayFocusCount",
        "completedTaskCount",
        "foodEntryCount",
        "intakeEntryCount",
        "symptomEntryCount",
        "energyCheckInCount",
        "calendarEventCount",
        "calendarFollowThroughCount"
      ],
      ...rows
    ]);
  }
  renderHabitMetricsCsv(entries, habits) {
    const rows = entries.flatMap((entry) => habits.map((habit) => {
      var _a, _b, _c, _d;
      return [
        entry.date,
        habit.id,
        habit.label,
        `${habit.target}`,
        habit.completionWindow,
        `${habit.difficultyWeight}`,
        `${(_a = entry.habits[habit.id]) != null ? _a : 0}`,
        `${((_b = entry.habitEvents[habit.id]) != null ? _b : []).length}`,
        ((_c = entry.habitEvents[habit.id]) != null ? _c : []).join(" | "),
        (_d = entry.habitMissNotes[habit.id]) != null ? _d : ""
      ];
    }));
    return this.renderCsv([
      ["date", "habitId", "habitLabel", "target", "completionWindow", "difficultyWeight", "completionCount", "eventCount", "eventTimestamps", "missNote"],
      ...rows
    ]);
  }
  renderCompletedTasksCsv(entries) {
    const rows = entries.flatMap((entry) => entry.completedTasks.map((task) => {
      var _a;
      return [
        entry.date,
        task.project,
        task.section,
        task.text,
        task.archivedAt,
        (_a = task.note) != null ? _a : ""
      ];
    }));
    return this.renderCsv([
      ["date", "project", "section", "text", "archivedAt", "note"],
      ...rows
    ]);
  }
  renderCalendarOccurrencesCsv(occurrences) {
    const rows = occurrences.map((event) => {
      var _a;
      return [
        event.date,
        event.endDate,
        event.startTime,
        event.endTime,
        event.title,
        event.category,
        event.projectName,
        event.projectNotePath,
        event.originalDate,
        event.repeatCadence,
        `${event.isRecurring}`,
        `${event.isException}`,
        (_a = event.exceptionKind) != null ? _a : "",
        `${event.prepMinutes}`,
        `${event.travelMinutes}`,
        event.notes
      ];
    });
    return this.renderCsv([
      ["date", "endDate", "startTime", "endTime", "title", "category", "projectName", "projectNotePath", "originalDate", "repeatCadence", "isRecurring", "isException", "exceptionKind", "prepMinutes", "travelMinutes", "notes"],
      ...rows
    ]);
  }
  renderCsv(rows) {
    return rows.map((row) => row.map((value) => this.escapeCsvValue(value)).join(",")).join("\n");
  }
  escapeCsvValue(value) {
    const safeValue = value.replace(/\r?\n/g, " ");
    if (!/[",\n]/.test(safeValue)) {
      return safeValue;
    }
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  async upsertTextFile(path, content) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(path);
    const directory = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
    if (directory) {
      await this.ensureFolder(directory);
    }
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof import_obsidian4.TFile) {
      const current = await this.app.vault.read(existing);
      if (current !== content) {
        await this.app.vault.modify(existing, content);
      }
      return existing;
    }
    if (existing) {
      throw new Error(`Path conflict at ${normalizedPath}: a folder exists where the plugin expects a markdown file.`);
    }
    return await this.app.vault.create(normalizedPath, content);
  }
  async ensureFolder(folderPath) {
    const normalizedPath = (0, import_obsidian4.normalizePath)(folderPath);
    if (!normalizedPath) {
      return;
    }
    const parts = normalizedPath.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing && !(existing instanceof import_obsidian4.TFolder)) {
        throw new Error(`Path conflict at ${currentPath}: a file exists where the plugin expects a folder.`);
      }
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
  async refreshWallpaperOptions() {
    this.wallpaperOptions = await this.loadWallpaperOptions();
  }
  async loadWallpaperOptions() {
    const adapter = this.app.vault.adapter;
    const candidateFolders = this.getWallpaperFolderCandidates();
    const seenPaths = /* @__PURE__ */ new Set();
    const options = [];
    for (const folderPath of candidateFolders) {
      const exists = await adapter.exists(folderPath, false);
      if (!exists) {
        continue;
      }
      let listed;
      try {
        listed = await adapter.list(folderPath);
      } catch (error) {
        console.warn(`Obsidian DASH - Daily Action & System Hub skipped wallpaper path ${folderPath}`, error);
        continue;
      }
      listed.files.forEach((filePath) => {
        var _a, _b, _c;
        const normalizedFilePath = (0, import_obsidian4.normalizePath)(filePath);
        const extension = (_b = (_a = normalizedFilePath.split(".").pop()) == null ? void 0 : _a.toLowerCase()) != null ? _b : "";
        if (!IMAGE_EXTENSIONS.has(extension) || seenPaths.has(normalizedFilePath)) {
          return;
        }
        seenPaths.add(normalizedFilePath);
        options.push({
          path: normalizedFilePath,
          displayName: (_c = normalizedFilePath.split("/").pop()) != null ? _c : normalizedFilePath,
          url: adapter.getResourcePath(normalizedFilePath)
        });
      });
    }
    options.sort((left, right) => left.displayName.localeCompare(right.displayName));
    return options;
  }
  getWallpaperFolderCandidates() {
    var _a;
    const configuredFolder = normalizeFolderPath(this.data.settings.wallpaperFolder);
    const pluginDir = normalizeFolderPath((_a = this.manifest.dir) != null ? _a : "");
    const candidates = /* @__PURE__ */ new Set();
    if (!configuredFolder) {
      if (pluginDir) {
        candidates.add(pluginDir);
      }
    } else {
      candidates.add(configuredFolder);
      if (pluginDir) {
        const pluginRelativeFolder = configuredFolder.toLowerCase().startsWith(pluginDir.toLowerCase()) ? configuredFolder : normalizeFolderPath(`${pluginDir}/${configuredFolder}`);
        candidates.add(pluginRelativeFolder);
      }
    }
    return Array.from(candidates);
  }
};
_DailyDashboardPlugin.CALENDAR_ARTIFACT_HORIZON_DAYS = 90;
var DailyDashboardPlugin = _DailyDashboardPlugin;
