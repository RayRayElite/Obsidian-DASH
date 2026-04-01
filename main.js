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
var import_obsidian = require("obsidian");
var VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
var CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
var PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
var SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
var PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
var NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
var DEFAULT_SETTINGS = {
  dashboardTitle: "Daily Dashboard",
  masterTodoPath: "Master Task Hub.md",
  projectNotesFolder: "Project Notes",
  dailyLogFolder: "Dashboard Logs/Daily",
  weeklyReportFolder: "Dashboard Logs/Weekly",
  monthlyReportFolder: "Dashboard Logs/Monthly",
  liveStatePath: "Dashboard Logs/State/Live Day State.md",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiBaseUrl: "https://api.openai.com/v1/chat/completions",
  aiOutputFolder: "Dashboard Logs/AI",
  aiContextDays: 14,
  aiRelatedNotesLimit: 6,
  aiIndexEnabled: true,
  aiIndexedFolders: "Project Notes",
  aiChunkCharLimit: 1200,
  aiEmbeddingsEnabled: false,
  aiEmbeddingModel: "text-embedding-3-small",
  aiEmbeddingApiUrl: "https://api.openai.com/v1/embeddings",
  wallpaperFolder: "Wallpapers",
  selectedWallpaper: "",
  habitDefinitions: [
    { id: "pills", label: "Take pills", target: 1 },
    { id: "brush-teeth", label: "Brush teeth", target: 2 },
    { id: "floss", label: "Floss", target: 2 },
    { id: "shower", label: "Shower", target: 1 },
    { id: "sleep-log", label: "Log sleep", target: 1 }
  ]
};
var DailyDashboardPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.data = {
      settings: { ...DEFAULT_SETTINGS },
      entries: {},
      dayState: {
        activeDate: formatDateKey(/* @__PURE__ */ new Date()),
        status: "not-started"
      },
      noteIndex: createEmptyNoteIndexCache()
    };
    this.wallpaperOptions = [];
    this.autoArchiveDebounceId = null;
    this.isAutoArchivingTodo = false;
    this.lastSyncCheckAt = "";
    this.lastSyncAppliedAt = "";
    this.lastLiveStateWriteAt = "";
    this.lastSyncSource = "Startup";
    this.liveStateAvailable = false;
    this.latestAiArtifact = null;
    this.isAiBusy = false;
    this.isIndexingNotes = false;
    this.noteIndexDebounceId = null;
  }
  getErrorMessage(error) {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }
    return String(error);
  }
  async initializeWorkspaceArtifacts() {
    await this.ensureTodayEntry();
    await this.syncLiveStateNote();
    await this.refreshWallpaperOptions();
  }
  async onload() {
    await this.loadPluginData();
    try {
      await this.initializeWorkspaceArtifacts();
    } catch (error) {
      console.error("Daily Dashboard startup initialization failed", error);
      new import_obsidian.Notice(`Daily Dashboard could not sync its files during startup. ${this.getErrorMessage(error)} Check the plugin path settings if you recently moved vault folders.`);
    }
    this.registerView(VIEW_TYPE_DAILY_DASHBOARD, (leaf) => new DailyDashboardView(leaf, this));
    this.addRibbonIcon("check-square", "Open Daily Dashboard", () => {
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
      id: "refresh-synced-dashboard-state",
      name: "Refresh synced dashboard state",
      callback: () => {
        void this.refreshSyncedStateManually();
      }
    });
    this.addCommand({
      id: "generate-ai-today-plan",
      name: "Generate AI today plan",
      callback: () => {
        void this.generateAiTodayPlan();
      }
    });
    this.addCommand({
      id: "generate-ai-end-of-day-review",
      name: "Generate AI end-of-day review",
      callback: () => {
        void this.generateAiEndOfDayReview();
      }
    });
    this.addCommand({
      id: "generate-ai-project-triage",
      name: "Generate AI project triage",
      callback: () => {
        void this.generateAiProjectTriage();
      }
    });
    this.addCommand({
      id: "generate-ai-weekly-coach-note",
      name: "Generate AI weekly coach note",
      callback: () => {
        void this.generateAiWeeklyCoachNote();
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
      if (!(file instanceof import_obsidian.TFile)) {
        return;
      }
      const normalizedPath = (0, import_obsidian.normalizePath)(file.path);
      if (normalizedPath === (0, import_obsidian.normalizePath)(this.data.settings.masterTodoPath)) {
        this.scheduleAutomaticTodoArchive();
        this.refreshDashboardViews();
        return;
      }
      if (normalizedPath === (0, import_obsidian.normalizePath)(this.data.settings.liveStatePath)) {
        void this.refreshFromStorageIfChanged();
        return;
      }
      if (file.extension === "md") {
        this.scheduleNoteIndexRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        this.scheduleNoteIndexRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file instanceof import_obsidian.TFile && file.extension === "md") {
        delete this.data.noteIndex.entries[(0, import_obsidian.normalizePath)(file.path)];
        this.scheduleNoteIndexRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") {
        return;
      }
      delete this.data.noteIndex.entries[(0, import_obsidian.normalizePath)(oldPath)];
      this.scheduleNoteIndexRefresh();
    }));
    this.registerInterval(window.setInterval(() => {
      void this.refreshForNewDay();
    }, 6e4));
    this.registerInterval(window.setInterval(() => {
      void this.refreshFromStorageIfChanged();
    }, 15e3));
    window.setTimeout(() => {
      void this.rebuildAiNoteIndex(false);
    }, 2500);
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
  isWorkSessionActive() {
    return this.getTodayEntry().workSessions.some((session) => session.end === null);
  }
  isNapSessionActive() {
    return this.getTodayEntry().napSessions.some((session) => session.end === null);
  }
  getTrackedWorkMinutes(entry = this.getTodayEntry()) {
    return getTrackedWorkMinutes(entry);
  }
  getTrackedNapMinutes(entry = this.getTodayEntry()) {
    return getTrackedMinutes(entry.napSessions);
  }
  getAllEntries() {
    return Object.values(this.data.entries).map((entry) => this.normalizeEntry(entry, entry.date || this.getTodayKey())).sort((left, right) => left.date.localeCompare(right.date));
  }
  getWallpaperFiles() {
    return this.wallpaperOptions;
  }
  getSelectedWallpaperPath() {
    var _a, _b, _c, _d;
    const files = this.getWallpaperFiles();
    const selected = (0, import_obsidian.normalizePath)(this.data.settings.selectedWallpaper);
    if (selected && files.some((file) => (0, import_obsidian.normalizePath)(file.path) === selected)) {
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
    const option = this.wallpaperOptions.find((candidate) => (0, import_obsidian.normalizePath)(candidate.path) === (0, import_obsidian.normalizePath)(path));
    return (_a = option == null ? void 0 : option.url) != null ? _a : null;
  }
  getSyncStatus() {
    return {
      lastCheckAt: this.lastSyncCheckAt,
      lastAppliedAt: this.lastSyncAppliedAt,
      lastWriteAt: this.lastLiveStateWriteAt,
      lastSource: this.lastSyncSource,
      liveStatePath: this.data.settings.liveStatePath,
      liveStateAvailable: this.liveStateAvailable
    };
  }
  getAiStatus() {
    return {
      configured: this.data.settings.aiApiKey.trim().length > 0,
      busy: this.isAiBusy,
      model: this.data.settings.aiModel,
      outputFolder: this.data.settings.aiOutputFolder,
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
    await this.refreshDataFromStorage(false);
    const previousSettings = this.data.settings;
    this.data.settings = sanitizeSettings(settings);
    await this.refreshWallpaperOptions();
    for (const date of Object.keys(this.data.entries)) {
      this.data.entries[date] = this.normalizeEntry(this.data.entries[date], date);
      await this.syncDailyLog(this.data.entries[date]);
    }
    await this.savePluginData();
    if (shouldRebuildAiIndex(previousSettings, this.data.settings)) {
      this.scheduleNoteIndexRefresh();
    }
    this.refreshDashboardViews();
  }
  async updateMoodScore(value) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.moodScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateEnergyScore(value) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.energyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateHabitValue(habitId, value) {
    var _a;
    await this.refreshDataFromStorage(false);
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }
    const entry = this.getTodayEntry();
    const nextValue = clamp(value, 0, definition.target);
    const currentEvents = [...(_a = entry.habitEvents[habitId]) != null ? _a : []];
    if (nextValue > currentEvents.length) {
      for (let index = currentEvents.length; index < nextValue; index += 1) {
        currentEvents.push(formatDateTimeKey(/* @__PURE__ */ new Date()));
      }
    } else if (nextValue < currentEvents.length) {
      currentEvents.length = nextValue;
    }
    entry.habitEvents[habitId] = currentEvents;
    entry.habits[habitId] = nextValue;
    await this.persistEntry(entry);
  }
  async addFoodEntry(value) {
    await this.refreshDataFromStorage(false);
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    const entry = this.getTodayEntry();
    entry.foodLog = [{ text: trimmedValue, loggedAt: formatDateTimeKey(/* @__PURE__ */ new Date()) }, ...entry.foodLog];
    await this.persistEntry(entry);
  }
  async removeFoodEntry(index) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.foodLog = entry.foodLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateSleepLog(value) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.sleepLog = value.trim();
    await this.persistEntry(entry);
  }
  async updateDreamLog(value) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.dreamLog = value.trim();
    await this.persistEntry(entry);
  }
  async beginLogicalDay() {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status === "in-progress") {
      new import_obsidian.Notice(`Your logical day ${this.data.dayState.activeDate} is already in progress.`);
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const nextDate = this.getNextLogicalDayKey(now);
    const timestamp = formatDateTimeKey(now);
    this.data.dayState = {
      activeDate: nextDate,
      status: "in-progress"
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
    new import_obsidian.Notice(`Began logical day ${nextDate}.`);
  }
  async endLogicalDay() {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian.Notice("No logical day is currently in progress. If you started it on another device, wait for sync to finish and try again.");
      return;
    }
    const timestamp = formatDateTimeKey(/* @__PURE__ */ new Date());
    const entry = this.getTodayEntry();
    entry.dayEndedAt = timestamp;
    if (!entry.sleepTime) {
      entry.sleepTime = timestamp;
    }
    closeOpenWorkSessions(entry, timestamp);
    closeOpenNapSessions(entry, timestamp);
    this.data.dayState = {
      activeDate: entry.date,
      status: "ended"
    };
    await this.persistEntry(entry);
    await this.savePluginData();
    new import_obsidian.Notice(`Ended logical day ${entry.date}.`);
  }
  async startWorkSession() {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian.Notice("Begin your logical day before starting work tracking.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.workSessions.some((session) => session.end === null)) {
      new import_obsidian.Notice("A work session is already active.");
      return;
    }
    entry.workSessions = [...entry.workSessions, { start: formatDateTimeKey(/* @__PURE__ */ new Date()), end: null }];
    await this.persistEntry(entry);
    new import_obsidian.Notice("Work session started.");
  }
  async stopWorkSession() {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    const activeSession = [...entry.workSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian.Notice("No work session is currently active. If you started it on another device, wait for sync to finish and try again.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian.Notice("Work session stopped.");
  }
  async startNapSession() {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new import_obsidian.Notice("Begin your logical day before starting a nap session.");
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.napSessions.some((session) => session.end === null)) {
      new import_obsidian.Notice("A nap session is already active.");
      return;
    }
    entry.napSessions = [...entry.napSessions, { start: formatDateTimeKey(/* @__PURE__ */ new Date()), end: null }];
    await this.persistEntry(entry);
    new import_obsidian.Notice("Nap started.");
  }
  async stopNapSession() {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    const activeSession = [...entry.napSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new import_obsidian.Notice("No nap session is currently active. If you started it on another device, wait for sync to finish and try again.");
      return;
    }
    activeSession.end = formatDateTimeKey(/* @__PURE__ */ new Date());
    await this.persistEntry(entry);
    new import_obsidian.Notice("Nap stopped.");
  }
  async updateDailyNotes(value) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.notes = value.trim();
    await this.persistEntry(entry);
  }
  async resetToday() {
    await this.refreshDataFromStorage(false);
    const freshEntry = this.createEmptyEntry(this.getTodayKey());
    this.data.entries[freshEntry.date] = freshEntry;
    await this.persistEntry(freshEntry);
  }
  async archiveCompletedTasksFromTodo() {
    await this.archiveCompletedTasksFromTodoInternal(true);
  }
  async archiveCompletedTasksFromTodoInternal(showNotice) {
    await this.refreshDataFromStorage(false);
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const archivedAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    const archiveResult = archiveCompletedTasks(content, archivedAt);
    if (archiveResult.archivedTasks.length === 0) {
      if (showNotice) {
        new import_obsidian.Notice("No completed checklist items were found to archive.");
      }
      return;
    }
    this.isAutoArchivingTodo = true;
    try {
      await this.app.vault.modify(todoFile, archiveResult.content);
    } finally {
      window.setTimeout(() => {
        this.isAutoArchivingTodo = false;
      }, 50);
    }
    const entry = this.getOrCreateEntry(archivedAt.slice(0, 10));
    entry.completedTasks = [...archiveResult.archivedTasks, ...entry.completedTasks];
    await this.persistEntry(entry);
    if (showNotice) {
      new import_obsidian.Notice(`Archived ${archiveResult.archivedTasks.length} completed task${archiveResult.archivedTasks.length === 1 ? "" : "s"}.`);
    }
  }
  async generateWeeklyReport() {
    await this.refreshDataFromStorage(false);
    const today = /* @__PURE__ */ new Date();
    const range = getIsoWeekRange(today);
    const entries = this.getEntriesInRange(range.start, range.end);
    const content = renderPeriodReport({
      title: `Weekly Dashboard Report - ${range.label}`,
      rangeLabel: `${formatDateKey(range.start)} to ${formatDateKey(range.end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions()
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.weeklyReportFolder}/${range.label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian.Notice("Weekly dashboard report generated.");
  }
  async generateMonthlyReport() {
    await this.refreshDataFromStorage(false);
    const today = /* @__PURE__ */ new Date();
    const label = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const entries = this.getEntriesInRange(start, end);
    const content = renderPeriodReport({
      title: `Monthly Dashboard Report - ${label}`,
      rangeLabel: `${formatDateKey(start)} to ${formatDateKey(end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions()
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.monthlyReportFolder}/${label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian.Notice("Monthly dashboard report generated.");
  }
  async getTodoSnapshot() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return null;
    }
    const content = await this.app.vault.read(todoFile);
    return parseTodoSnapshot(content);
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
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const categories = await this.getTodoCategories();
    new CreateProjectModal(this.app, this, categories).open();
  }
  async createProjectAndNote(input) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const projectName = input.projectName.trim();
    const categoryName = input.categoryName.trim();
    if (!projectName || !categoryName) {
      new import_obsidian.Notice("Project name and category are required.");
      return;
    }
    const todoContent = await this.app.vault.read(todoFile);
    const existingProject = findProjectRanges(todoContent.split(/\r?\n/)).some((project) => project.name.toLowerCase() === projectName.toLowerCase());
    if (existingProject) {
      new import_obsidian.Notice(`A project named ${projectName} already exists in the master todo.`);
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
    new import_obsidian.Notice(`Created ${projectName} in the master todo and generated its project note.`);
  }
  async createMissingProjectNotesFromTodo(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projects = extractProjectDefinitionsFromTodo(content);
    if (projects.length === 0) {
      if (showNotice) {
        new import_obsidian.Notice("No projects were found in the master task hub.");
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
      new import_obsidian.Notice(createdCount > 0 ? `Created ${createdCount} missing project note${createdCount === 1 ? "" : "s"}.` : "All project notes already exist.");
    }
  }
  async addTodayFocusItem(value) {
    await this.refreshDataFromStorage(false);
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.todayFocus.includes(trimmedValue)) {
      return;
    }
    entry.todayFocus = [...entry.todayFocus, trimmedValue].slice(0, 3);
    await this.persistEntry(entry);
  }
  async removeTodayFocusItem(index) {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateFrictionLog(value) {
    await this.refreshDataFromStorage(false);
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
      new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
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
    await this.refreshDataFromStorage(false);
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
    new import_obsidian.Notice("Weekly review note generated.");
  }
  async syncRepeatingProjectTasks(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projectDefinitions = extractProjectDefinitionsFromTodo(content);
    let updatedContent = content;
    let insertedCount = 0;
    for (const project of projectDefinitions) {
      const notePath = (0, import_obsidian.normalizePath)(`${stripMarkdownExtension(project.noteLinkPath)}.md`);
      const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
      if (!(abstractFile instanceof import_obsidian.TFile)) {
        continue;
      }
      const noteContent = await this.app.vault.read(abstractFile);
      const repeatingTasks = extractRepeatingTasks(noteContent);
      repeatingTasks.forEach((task) => {
        if (!isRepeatingTaskDue(task, content, project.projectName)) {
          return;
        }
        updatedContent = insertTaskIntoProjectSection(updatedContent, project.projectName, "Next", `${task.text} [${task.cadence}]`);
        insertedCount += 1;
      });
    }
    if (updatedContent !== content) {
      await this.app.vault.modify(todoFile, updatedContent);
    }
    if (showNotice) {
      new import_obsidian.Notice(insertedCount > 0 ? `Added ${insertedCount} repeating task${insertedCount === 1 ? "" : "s"}.` : "No repeating tasks were due.");
    }
  }
  async offloadProjectReferences(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const result = await offloadReferencesFromMasterHub(content, this.app.vault, this.data.settings.masterTodoPath);
    if (result.updatedContent !== content) {
      await this.app.vault.modify(todoFile, result.updatedContent);
    }
    if (showNotice) {
      new import_obsidian.Notice(result.offloadedProjects.length > 0 ? `Offloaded references for ${result.offloadedProjects.length} project${result.offloadedProjects.length === 1 ? "" : "s"}.` : "No project references needed offloading.");
    }
  }
  async showCleanupSuggestions() {
    var _a;
    const snapshot = await this.getTodoSnapshot();
    const suggestions = (_a = snapshot == null ? void 0 : snapshot.cleanupSuggestions) != null ? _a : [];
    const content = [
      `# Master Task Hub Cleanup Suggestions - ${formatDateKey(/* @__PURE__ */ new Date())}`,
      "",
      ...suggestions.length > 0 ? suggestions.map((item) => `- ${item}`) : ["- No cleanup issues detected."],
      ""
    ].join("\n");
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Cleanup Suggestions/${formatDateKey(/* @__PURE__ */ new Date())}.md`, content);
    await this.openFile(file);
  }
  async generateAiTodayPlan() {
    await this.runAiWorkflow({
      kind: "Today Plan",
      fileLabel: `AI Today Plan ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are an operational planning assistant for a personal Obsidian dashboard.",
        "Prioritize practical decision support over motivational writing.",
        "Respond in markdown with these headings: Situation Snapshot, Suggested Top 3, Recommended Sequencing, Risks And Drift, Energy And Recovery, Immediate Next Moves.",
        "Under Suggested Top 3, provide exactly three concise bullet points that can stand alone as focus items.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Create a sharp plan for today using the dashboard and project context below.",
        "Favor leverage, unfinished momentum, stale-risk projects, and realistic energy management.",
        "Do not repeat raw data back unless it matters to the recommendation."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiEndOfDayReview() {
    await this.runAiWorkflow({
      kind: "End Of Day Review",
      fileLabel: `AI End Of Day Review ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are an analytical daily review assistant for an Obsidian dashboard.",
        "Respond in markdown with headings: Wins, Drag And Friction, Behavioral Patterns, What To Carry Forward, Shutdown Recommendation.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Review the current logical day.",
        "Explain where output came from, where time or energy leaked, and what should seed tomorrow without guilt-language or generic coaching."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiProjectTriage() {
    await this.runAiWorkflow({
      kind: "Project Triage",
      fileLabel: `AI Project Triage ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a ruthless but useful project triage assistant.",
        "Respond in markdown with headings: Highest Leverage Projects, Immediate Interventions, Projects To Park Or Reduce, Breakdown Targets, Recommended Decisions.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Analyze the project landscape from the master task hub and recent logs.",
        "Highlight stale work, overloaded areas, hidden leverage, and what should be deprioritized."
      ].join(" "),
      includeMasterTodoRaw: true
    });
  }
  async generateAiWeeklyCoachNote() {
    await this.runAiWorkflow({
      kind: "Weekly Coach",
      fileLabel: `AI Weekly Coach ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are a weekly planning and reflection assistant.",
        "Respond in markdown with headings: Weekly Pattern Read, Habit And Health Drift, Priority Stack, Scheduling Guidance, Guardrails For The Next 7 Days.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: [
        "Use the recent dashboard data to coach the next week.",
        "Prefer concrete prioritization, pacing advice, and risk spotting over abstract encouragement."
      ].join(" "),
      includeMasterTodoRaw: false
    });
  }
  async generateAiActiveNoteAnalysis() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!(activeFile instanceof import_obsidian.TFile) || !activeFile.path.endsWith(".md")) {
      new import_obsidian.Notice("Open a markdown note before using active note analysis.");
      return;
    }
    await this.runAiWorkflow({
      kind: "Active Note Analysis",
      fileLabel: `AI Active Note Analysis ${stripMarkdownExtension(activeFile.name)}`,
      systemPrompt: [
        "You are an analytical assistant reading the user's active Obsidian note in the context of their dashboard and related vault notes.",
        "Respond in markdown with headings: Note Summary, Hidden Implications, Connections To Other Work, Recommended Next Moves, Questions Worth Answering.",
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
      new import_obsidian.Notice("Enter a question for the AI first.");
      return;
    }
    await this.runAiWorkflow({
      kind: "Vault Question",
      fileLabel: `AI Vault Question ${formatDateKey(/* @__PURE__ */ new Date())}`,
      systemPrompt: [
        "You are an analytical assistant for an Obsidian dashboard and task hub.",
        "Answer the user's question using only the provided context.",
        "Respond in markdown with headings: Direct Answer, Supporting Signals, Recommended Actions, Open Questions.",
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
    var _a, _b;
    if (!this.data.settings.aiApiKey.trim()) {
      new import_obsidian.Notice("Add your OpenAI API key in Daily Dashboard settings before using AI features.");
      return;
    }
    if (this.isAiBusy) {
      new import_obsidian.Notice("An AI request is already running.");
      return;
    }
    await this.refreshDataFromStorage(false);
    this.isAiBusy = true;
    this.refreshDashboardViews();
    try {
      await this.ensureAiNoteIndexReady();
      const retrievalQuery = [input.kind, input.userPrompt, (_a = input.question) != null ? _a : ""].filter((item) => item.trim().length > 0).join("\n\n");
      const context = await this.buildAiContext(input.includeMasterTodoRaw, input.question, (_b = input.includeActiveNote) != null ? _b : false, retrievalQuery);
      const rawResponse = await this.requestAiCompletion(input.systemPrompt, `${input.userPrompt}

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
        suggestedFocus: payload.suggestedFocus.slice(0, 3)
      };
      this.refreshDashboardViews();
      await this.openFile(file);
      new import_obsidian.Notice(`${input.kind} note generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new import_obsidian.Notice(`AI request failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }
  async buildAiContext(includeMasterTodoRaw, question = "", includeActiveNote = false, retrievalQuery = question) {
    const todayEntry = this.getTodayEntry();
    const allEntries = this.getAllEntries();
    const recentEntries = allEntries.slice(-this.data.settings.aiContextDays);
    const todoSnapshot = await this.getTodoSnapshot();
    const relevantNotes = await this.collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery);
    const recentRange = recentEntries.length > 0 ? `${recentEntries[0].date} to ${recentEntries[recentEntries.length - 1].date}` : "No recent entries";
    const recentReport = recentEntries.length > 0 ? renderPeriodReport({
      title: "Recent Dashboard Context",
      rangeLabel: recentRange,
      entries: recentEntries,
      habitDefinitions: this.getHabitDefinitions()
    }) : "No recent dashboard entries available.";
    const masterTodoFile = this.getMasterTodoFile();
    const masterTodoRaw = includeMasterTodoRaw && masterTodoFile ? truncateText(await this.app.vault.read(masterTodoFile), 12e3) : "Master task hub raw content not included for this request.";
    const activeFile = includeActiveNote ? this.app.workspace.getActiveFile() : null;
    const activeNoteSection = activeFile instanceof import_obsidian.TFile ? `## Active Note
Path: ${activeFile.path}

${truncateText(await this.app.vault.read(activeFile), 8e3)}` : "";
    return [
      `Current logical day: ${this.data.dayState.activeDate} (${this.data.dayState.status})`,
      question ? `User question: ${question}` : "",
      "## Today Entry",
      renderDailyLog(todayEntry, this.getHabitDefinitions()),
      "",
      "## Routine Signals",
      renderRoutineSignalsForAi(recentEntries, this.getHabitDefinitions()),
      "",
      "## Recent Report",
      recentReport,
      "",
      "## Master Task Hub Snapshot",
      renderTodoSnapshotForAi(todoSnapshot),
      "",
      "## Relevant Vault Notes",
      renderAiRelevantNotes(relevantNotes),
      "",
      activeNoteSection,
      "",
      "## Master Task Hub Raw Excerpt",
      masterTodoRaw
    ].filter((section) => section.trim().length > 0).join("\n\n");
  }
  async collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery) {
    if (!this.data.settings.aiIndexEnabled) {
      return [];
    }
    const activeFile = this.app.workspace.getActiveFile();
    const terms = buildAiSearchTerms(question, this.getTodayEntry(), todoSnapshot);
    const activeFilePath = activeFile instanceof import_obsidian.TFile ? activeFile.path : "";
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
    const response = await fetch(this.data.settings.aiBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.settings.aiApiKey}`
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
    if (!this.data.settings.aiEmbeddingsEnabled || !this.data.settings.aiApiKey.trim()) {
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
    if (!this.data.settings.aiApiKey.trim()) {
      throw new Error("Add your OpenAI API key before building embeddings.");
    }
    if (chunks.length === 0) {
      return /* @__PURE__ */ new Map();
    }
    const response = await fetch(this.data.settings.aiEmbeddingApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.data.settings.aiApiKey}`
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
      ""
    ].filter((line) => line !== "").join("\n");
    await this.ensureFolder(folder);
    return await this.app.vault.create(filePath, content);
  }
  async openPromoteTaskFlow() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot || snapshot.projects.length === 0) {
      new import_obsidian.Notice("No projects found in the master task hub.");
      return;
    }
    new PromoteTaskModal(this.app, this, snapshot.projects).open();
  }
  async openProjectReviewModeFlow() {
    const options = await this.getProjectReviewOptions();
    if (options.length === 0) {
      new import_obsidian.Notice("No project notes found for review mode.");
      return;
    }
    new ProjectReviewModal(this.app, this, options).open();
  }
  async openProjectReviewMode(option) {
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof import_obsidian.TFile) || !todoFile) {
      new import_obsidian.Notice("Could not open project review mode for that project.");
      return;
    }
    const leftLeaf = this.app.workspace.getLeaf(true);
    await leftLeaf.openFile(todoFile);
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(noteFile);
    this.app.workspace.revealLeaf(rightLeaf);
  }
  async openAiArtifact(artifact) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(artifact.notePath));
    if (!(file instanceof import_obsidian.TFile)) {
      new import_obsidian.Notice("That AI note could not be found in the vault.");
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
      notePath: `${project.noteLinks[0] ? stripMarkdownExtension(project.noteLinks[0]) : `${this.data.settings.projectNotesFolder}/${project.name}`}.md`
    })).filter((project) => this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(project.notePath)) instanceof import_obsidian.TFile);
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
  refreshDashboardViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DailyDashboardView) {
        void view.render();
      }
    });
  }
  async openMasterTodo() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    await this.openFile(todoFile);
  }
  getMasterTodoFile() {
    const target = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(this.data.settings.masterTodoPath));
    return target instanceof import_obsidian.TFile ? target : null;
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
    const normalizedBasePath = (0, import_obsidian.normalizePath)(basePath);
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
    const calendarKey = formatDateKey(referenceDate);
    if (this.data.dayState.status === "not-started") {
      return calendarKey;
    }
    const current = this.data.dayState.activeDate || calendarKey;
    const next = /* @__PURE__ */ new Date(`${current}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const nextKey = formatDateKey(next);
    return nextKey > calendarKey ? nextKey : calendarKey;
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
    const dayState = normalizeDayState(loaded == null ? void 0 : loaded.dayState, entries);
    return {
      settings,
      entries,
      dayState,
      noteIndex: normalizeNoteIndexCache(loaded == null ? void 0 : loaded.noteIndex)
    };
  }
  async loadPluginData() {
    const loaded = await this.buildDataFromStorage();
    this.data = loaded.data;
    this.liveStateAvailable = loaded.liveStateAvailable;
    this.lastSyncCheckAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.lastSyncAppliedAt = this.lastSyncCheckAt;
    this.lastSyncSource = loaded.source;
  }
  normalizeEntry(entry, date, settings = this.data.settings) {
    var _a, _b;
    const baseEntry = createEmptyEntry(date, settings.habitDefinitions);
    if (!entry) {
      return baseEntry;
    }
    const normalizedHabits = {};
    const normalizedHabitEvents = {};
    settings.habitDefinitions.forEach((habit) => {
      var _a2, _b2, _c, _d, _e, _f;
      const rawEvents = Array.isArray((_a2 = entry.habitEvents) == null ? void 0 : _a2[habit.id]) ? (_d = (_c = (_b2 = entry.habitEvents) == null ? void 0 : _b2[habit.id]) == null ? void 0 : _c.filter((item) => typeof item === "string" && item.trim().length > 0)) != null ? _d : [] : [];
      const normalizedCount = clamp(Number((_f = (_e = entry.habits) == null ? void 0 : _e[habit.id]) != null ? _f : rawEvents.length), 0, habit.target);
      normalizedHabits[habit.id] = normalizedCount;
      normalizedHabitEvents[habit.id] = rawEvents.slice(0, normalizedCount);
    });
    return {
      date,
      dayStartedAt: typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
      dayEndedAt: typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
      wakeTime: typeof entry.wakeTime === "string" ? entry.wakeTime : "",
      sleepTime: typeof entry.sleepTime === "string" ? entry.sleepTime : "",
      habits: normalizedHabits,
      habitEvents: normalizedHabitEvents,
      moodScore: clamp(Number((_a = entry.moodScore) != null ? _a : 0), 0, 5),
      energyScore: clamp(Number((_b = entry.energyScore) != null ? _b : 0), 0, 5),
      todayFocus: Array.isArray(entry.todayFocus) ? entry.todayFocus.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 3) : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(normalizedHabits, settings.habitDefinitions),
      foodLog: Array.isArray(entry.foodLog) ? entry.foodLog.map((item) => normalizeFoodEntry(item)).filter((item) => item !== null) : [],
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      dreamLog: typeof entry.dreamLog === "string" ? entry.dreamLog : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions) ? entry.workSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null
      })) : [],
      napSessions: Array.isArray(entry.napSessions) ? entry.napSessions.filter((item) => Boolean(item && typeof item === "object" && typeof item.start === "string")).map((item) => ({
        start: item.start,
        end: typeof item.end === "string" ? item.end : null
      })) : [],
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
  createEmptyEntry(date) {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }
  getLiveStateEntryDate(data) {
    return data.dayState.activeDate || Object.keys(data.entries).sort().slice(-1)[0] || formatDateKey(/* @__PURE__ */ new Date());
  }
  createLiveStateSnapshot(data = this.data) {
    var _a;
    const date = this.getLiveStateEntryDate(data);
    const baseEntry = this.normalizeEntry((_a = data.entries[date]) != null ? _a : createEmptyEntry(date, data.settings.habitDefinitions), date, data.settings);
    return {
      updatedAt: formatDateTimeKey(/* @__PURE__ */ new Date()),
      dayState: normalizeDayState(data.dayState, data.entries),
      entry: {
        ...baseEntry,
        habits: { ...baseEntry.habits },
        habitEvents: Object.fromEntries(Object.entries(baseEntry.habitEvents).map(([key, value]) => [key, [...value]])),
        todayFocus: [...baseEntry.todayFocus],
        missedHabits: [...baseEntry.missedHabits],
        foodLog: baseEntry.foodLog.map((item) => ({ ...item })),
        workSessions: baseEntry.workSessions.map((session) => ({ ...session })),
        napSessions: baseEntry.napSessions.map((session) => ({ ...session })),
        completedTasks: baseEntry.completedTasks.map((task) => ({ ...task }))
      }
    };
  }
  async loadLiveStateSnapshotFromVault(path) {
    const target = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(path));
    if (!(target instanceof import_obsidian.TFile)) {
      return null;
    }
    const content = await this.app.vault.read(target);
    return parseLiveDayStateNote(content);
  }
  applyLiveStateSnapshot(data, snapshot) {
    var _a;
    const date = snapshot.entry.date || snapshot.dayState.activeDate || this.getLiveStateEntryDate(data);
    const baseEntry = (_a = data.entries[date]) != null ? _a : createEmptyEntry(date, data.settings.habitDefinitions);
    const mergedEntry = this.normalizeEntry({
      ...baseEntry,
      ...snapshot.entry,
      date
    }, date, data.settings);
    const entries = {
      ...data.entries,
      [date]: mergedEntry
    };
    return {
      ...data,
      entries,
      dayState: normalizeDayState(snapshot.dayState, entries)
    };
  }
  async buildDataFromStorage() {
    const loaded = await this.loadData();
    const hydrated = this.hydratePluginData(loaded);
    const snapshot = await this.loadLiveStateSnapshotFromVault(hydrated.settings.liveStatePath);
    if (!snapshot) {
      return {
        data: hydrated,
        source: "Plugin data",
        liveStateAvailable: false
      };
    }
    return {
      data: this.applyLiveStateSnapshot(hydrated, snapshot),
      source: "Live state note",
      liveStateAvailable: true
    };
  }
  getDataSignature(data = this.data) {
    const orderedEntries = Object.keys(data.entries).sort().reduce((result, date) => {
      result[date] = data.entries[date];
      return result;
    }, {});
    return JSON.stringify({
      settings: data.settings,
      entries: orderedEntries,
      dayState: data.dayState
    });
  }
  async refreshDataFromStorage(refreshViews) {
    const loaded = await this.buildDataFromStorage();
    const hydrated = loaded.data;
    this.lastSyncCheckAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.liveStateAvailable = loaded.liveStateAvailable;
    this.lastSyncSource = loaded.source;
    if (this.getDataSignature(hydrated) === this.getDataSignature(this.data)) {
      return false;
    }
    const settingsChanged = JSON.stringify(hydrated.settings) !== JSON.stringify(this.data.settings);
    this.data = hydrated;
    if (settingsChanged) {
      await this.refreshWallpaperOptions();
    }
    this.lastSyncAppliedAt = this.lastSyncCheckAt;
    if (refreshViews) {
      this.refreshDashboardViews();
    }
    return true;
  }
  async refreshFromStorageIfChanged() {
    await this.refreshDataFromStorage(true);
  }
  async refreshSyncedStateManually() {
    const changed = await this.refreshDataFromStorage(true);
    new import_obsidian.Notice(changed ? `Refreshed dashboard state from ${this.lastSyncSource.toLowerCase()}.` : `Dashboard state is already current. Last check: ${this.lastSyncCheckAt || "just now"}.`);
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
        new import_obsidian.Notice("AI note indexing is disabled in settings.");
      }
      return;
    }
    if (this.isIndexingNotes) {
      if (showNotice) {
        new import_obsidian.Notice("AI note indexing is already in progress.");
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
        nextEntries[(0, import_obsidian.normalizePath)(file.path)] = entry;
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
        new import_obsidian.Notice(`Indexed ${Object.keys(nextEntries).length} markdown note${Object.keys(nextEntries).length === 1 ? "" : "s"} for AI retrieval${this.data.settings.aiEmbeddingsEnabled ? ` with ${embeddedChunkCount} embedded chunk${embeddedChunkCount === 1 ? "" : "s"}` : ""}.`);
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
  async syncLiveStateNote() {
    const content = renderLiveDayStateNote(this.createLiveStateSnapshot());
    await this.upsertMarkdownFile(this.data.settings.liveStatePath, content);
    this.lastLiveStateWriteAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    this.liveStateAvailable = true;
  }
  async savePluginData() {
    await this.saveData({
      ...this.data,
      dayState: normalizeDayState(this.data.dayState, this.data.entries)
    });
    await this.syncLiveStateNote();
  }
  async persistNoteIndex() {
    await this.saveData({
      ...this.data,
      dayState: normalizeDayState(this.data.dayState, this.data.entries)
    });
  }
  async persistEntry(entry) {
    this.data.entries[entry.date] = this.normalizeEntry(entry, entry.date);
    await this.savePluginData();
    await this.syncDailyLog(this.data.entries[entry.date]);
    this.refreshDashboardViews();
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
      }
    }
    await this.ensureTodayEntry();
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
    const content = renderDailyLog(entry, this.getHabitDefinitions());
    await this.upsertMarkdownFile(`${this.data.settings.dailyLogFolder}/${entry.date}.md`, content);
  }
  async upsertMarkdownFile(path, content) {
    const normalizedPath = (0, import_obsidian.normalizePath)(path);
    const directory = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
    if (directory) {
      await this.ensureFolder(directory);
    }
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof import_obsidian.TFile) {
      await this.app.vault.modify(existing, content);
      return existing;
    }
    if (existing) {
      throw new Error(`Path conflict at ${normalizedPath}: a folder exists where the plugin expects a markdown file.`);
    }
    return await this.app.vault.create(normalizedPath, content);
  }
  async ensureFolder(folderPath) {
    const normalizedPath = (0, import_obsidian.normalizePath)(folderPath);
    if (!normalizedPath) {
      return;
    }
    const parts = normalizedPath.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing && !(existing instanceof import_obsidian.TFolder)) {
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
        console.warn(`Daily Dashboard skipped wallpaper path ${folderPath}`, error);
        continue;
      }
      listed.files.forEach((filePath) => {
        var _a, _b, _c;
        const normalizedFilePath = (0, import_obsidian.normalizePath)(filePath);
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
var DailyDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.workLogFilters = {
      project: "",
      keyword: "",
      fromDate: "",
      toDate: ""
    };
    this.quickAddState = {
      projectName: "",
      sectionName: "Add",
      taskText: ""
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_DAILY_DASHBOARD;
  }
  getDisplayText() {
    return "Daily Dashboard";
  }
  getIcon() {
    return "check-square";
  }
  async onOpen() {
    await this.render();
  }
  isCompactMode() {
    return getDashboardCompactMode();
  }
  async toggleCompactMode() {
    setDashboardCompactMode(!this.isCompactMode());
    await this.render();
  }
  isMobileMode() {
    return getDashboardMobileMode();
  }
  async toggleMobileMode() {
    setDashboardMobileMode(!this.isMobileMode());
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
  async render() {
    var _a, _b, _c, _d, _e, _f;
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = (_a = todoSnapshot == null ? void 0 : todoSnapshot.projects) != null ? _a : [];
      const staleProjects = (_b = todoSnapshot == null ? void 0 : todoSnapshot.staleProjects) != null ? _b : [];
      const breakdownCandidates = (_c = todoSnapshot == null ? void 0 : todoSnapshot.breakdownCandidates) != null ? _c : [];
      const cleanupSuggestions = (_d = todoSnapshot == null ? void 0 : todoSnapshot.cleanupSuggestions) != null ? _d : [];
      const workLogEntries = this.getFilteredWorkLogEntries();
      const staleProjectCount = staleProjects.length;
      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }
      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");
      contentEl.toggleClass("is-compact", this.isCompactMode());
      contentEl.toggleClass("is-mobile-layout", this.isMobileMode());
      const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
      const hero = page.createDiv({ cls: "daily-dashboard-hero" });
      if (wallpaperUrl) {
        hero.addClass("has-wallpaper");
        hero.style.setProperty("--daily-dashboard-wallpaper", `url("${wallpaperUrl}")`);
      }
      const heroCopy = hero.createDiv({ cls: "daily-dashboard-hero-copy" });
      heroCopy.createEl("span", { cls: "daily-dashboard-kicker", text: "Daily operating dashboard" });
      heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title", text: settings.dashboardTitle });
      const actions = heroCopy.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
      createButton(actions, "Promote to today", async () => this.plugin.openPromoteTaskFlow(), false, "target");
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow(), false, "panel-right-open");
      createButton(actions, this.isCompactMode() ? "Richer mode" : "Compact mode", async () => this.toggleCompactMode(), false, this.isCompactMode() ? "maximize-2" : "minimize-2");
      createButton(actions, this.isMobileMode() ? "Desktop view" : "Mobile view", async () => this.toggleMobileMode(), false, this.isMobileMode() ? "monitor" : "smartphone");
      const heroFooter = hero.createDiv({ cls: "daily-dashboard-hero-footer" });
      const heroMeta = heroFooter.createDiv({ cls: "daily-dashboard-hero-status-row" });
      const datePill = createStatPill(heroMeta, todayEntry.date, "calendar-days", "date");
      datePill.addClass("is-compact");
      const archivedPill = createStatPill(heroMeta, `${todayEntry.completedTasks.length} archived`, "archive", "done");
      archivedPill.addClass("is-compact");
      const stalePill = createStatPill(heroMeta, `${staleProjectCount} stale`, "triangle-alert", staleProjectCount > 0 ? "alert" : "neutral");
      stalePill.addClass("is-compact");
      const statePill = createStatPill(heroMeta, `Mood ${renderScore(todayEntry.moodScore)} \u2022 Energy ${renderScore(todayEntry.energyScore)}`, "activity", "state");
      statePill.addClass("is-compact");
      const utilityActions = heroFooter.createDiv({ cls: "daily-dashboard-hero-utility-actions" });
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "bar-chart-3", "Weekly report", async () => this.plugin.generateWeeklyReport());
      createIconButton(utilityActions, "line-chart", "Monthly report", async () => this.plugin.generateMonthlyReport());
      createIconButton(utilityActions, "refresh-cw", "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));
      const grid = page.createDiv({ cls: "daily-dashboard-grid" });
      const dayState = this.plugin.getDayState();
      const syncStatus = this.plugin.getSyncStatus();
      const aiStatus = this.plugin.getAiStatus();
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const activeWorkSession = (_e = todayEntry.workSessions.find((session) => session.end === null)) != null ? _e : null;
      const activeNapSession = (_f = todayEntry.napSessions.find((session) => session.end === null)) != null ? _f : null;
      const dayFlowCard = createCard(grid, "Day Flow", "Control when your real day begins and ends so late nights stay on the right log date.", {
        icon: "sun-moon",
        eyebrow: "Cycle",
        tone: "focus",
        tag: dayState.status === "in-progress" ? "In Progress" : dayState.status === "ended" ? "Ended" : "Idle"
      });
      const dayFlowStatus = dayFlowCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(dayFlowStatus, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(dayFlowStatus, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(dayFlowStatus, activeWorkSession ? "Working" : "Not working", activeWorkSession ? "capture" : "neutral");
      createSemanticChip(dayFlowStatus, activeNapSession ? "Napping" : "Awake", activeNapSession ? "alert" : "neutral");
      createSemanticChip(dayFlowStatus, syncStatus.liveStateAvailable ? "Live sync note ready" : "Live sync note pending", syncStatus.liveStateAvailable ? "done" : "alert");
      const dayFlowGrid = dayFlowCard.createDiv({ cls: "daily-dashboard-dayflow-grid" });
      this.renderDayMetric(dayFlowGrid, "Wake", todayEntry.wakeTime || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Sleep", todayEntry.sleepTime || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Day start", todayEntry.dayStartedAt || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Day end", todayEntry.dayEndedAt || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Tracked work", formatMinutesAsHours(trackedWorkMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked naps", formatMinutesAsHours(trackedNapMinutes));
      this.renderDayMetric(dayFlowGrid, "Live session", activeWorkSession ? formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(/* @__PURE__ */ new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live nap", activeNapSession ? formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(/* @__PURE__ */ new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Last sync check", formatSyncTimestamp(syncStatus.lastCheckAt));
      this.renderDayMetric(dayFlowGrid, "Last sync apply", formatSyncTimestamp(syncStatus.lastAppliedAt));
      this.renderDayMetric(dayFlowGrid, "Last live write", formatSyncTimestamp(syncStatus.lastWriteAt));
      this.renderDayMetric(dayFlowGrid, "Sync source", syncStatus.lastSource || "Unknown");
      const dayFlowActions = dayFlowCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(dayFlowActions, "Begin day", async () => this.plugin.beginLogicalDay(), dayState.status !== "in-progress", "sunrise");
      createButton(dayFlowActions, "End day", async () => this.plugin.endLogicalDay(), false, "moon-star");
      createButton(dayFlowActions, activeWorkSession ? "Stop work" : "Start work", async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession(), false, activeWorkSession ? "square" : "play");
      createButton(dayFlowActions, activeNapSession ? "Stop nap" : "Start nap", async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(), false, activeNapSession ? "alarm-clock-off" : "bed-single");
      createButton(dayFlowActions, "Refresh sync", async () => this.plugin.refreshSyncedStateManually(), false, "refresh-cw");
      const focusCard = createCard(grid, "Top 3 For Today", "Keep today concrete with just three active focus items.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      if (todayEntry.todayFocus.length === 0) {
        const emptyState = focusList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No focus items yet. Pull one from a project or let AI draft your starting plan." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Promote task", async () => this.plugin.openPromoteTaskFlow(), false, "target");
        createButton(emptyActions, "AI today plan", async () => this.plugin.generateAiTodayPlan(), false, "sparkles");
      } else {
        todayEntry.todayFocus.forEach((item, index) => {
          const row = focusList.createDiv({ cls: "daily-dashboard-food-row" });
          row.createEl("span", { text: item });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Done" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeTodayFocusItem(index);
          });
        });
      }
      const focusAddRow = focusCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const focusInput = focusAddRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a focus item" }
      });
      const focusButton = focusAddRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      focusButton.type = "button";
      const submitFocus = async () => {
        const value = focusInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addTodayFocusItem(value);
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
      const stateCard = createCard(grid, "State And Friction", "Log mood, energy, and friction so weak days have context.", {
        icon: "activity",
        eyebrow: "State",
        tone: "state",
        tag: "Context"
      });
      this.renderScoreControl(stateCard, "Mood", todayEntry.moodScore, (value) => this.plugin.updateMoodScore(value));
      this.renderScoreControl(stateCard, "Energy", todayEntry.energyScore, (value) => this.plugin.updateEnergyScore(value));
      const missedCard = stateCard.createDiv({ cls: "daily-dashboard-score-block" });
      missedCard.createEl("strong", { text: "Habit misses so far" });
      missedCard.createEl("span", {
        cls: "daily-dashboard-habit-meta",
        text: todayEntry.missedHabits.length > 0 ? todayEntry.missedHabits.join(", ") : "No misses recorded yet."
      });
      stateCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Friction log" });
      const frictionInput = stateCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      frictionInput.value = todayEntry.frictionLog;
      frictionInput.placeholder = "Blockers, pain points, context switching, or anything that made the day harder.";
      frictionInput.addEventListener("change", () => {
        void this.plugin.updateFrictionLog(frictionInput.value);
      });
      const habitsCard = createCard(grid, "Habits", "Repeatables with misses and timing kept visible.", {
        icon: "check-square",
        eyebrow: "Routines",
        tone: "state",
        tag: "Track"
      });
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit) => {
        var _a2, _b2;
        const currentValue = (_a2 = todayEntry.habits[habit.id]) != null ? _a2 : 0;
        const habitEvents = (_b2 = todayEntry.habitEvents[habit.id]) != null ? _b2 : [];
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done \u2022 ${this.plugin.getHabitStreak(habit.id)} day streak`
        });
        if (habitEvents.length > 0) {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Today at ${habitEvents.map((item) => item.slice(11)).join(", ")}`
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
      });
      const quickAddCard = createCard(grid, "Quick Add To Project", "Capture work into Add, Fix, Now, Next, or Later.", {
        icon: "plus-circle",
        eyebrow: "Capture",
        tone: "capture",
        tag: "Input"
      });
      const quickAddForm = quickAddCard.createDiv({ cls: "daily-dashboard-stacked-form" });
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
      const quickAddButton = quickAddForm.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add task" });
      quickAddButton.type = "button";
      quickAddButton.addEventListener("click", () => {
        const text = taskInput.value.trim();
        if (!text || !this.quickAddState.projectName) {
          return;
        }
        this.quickAddState.taskText = "";
        void this.plugin.addTaskToProject(this.quickAddState.projectName, this.quickAddState.sectionName, text);
      });
      const foodCard = createCard(grid, "Food Log", "Quick meal capture so routine and energy stay analyzable.", {
        icon: "utensils-crossed",
        eyebrow: "Body",
        tone: "log",
        tag: "Log"
      });
      const foodInputRow = foodCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const foodInput = foodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a meal or snack" }
      });
      const foodButton = foodInputRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      foodButton.type = "button";
      const submitFood = async () => {
        const value = foodInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addFoodEntry(value);
        foodInput.value = "";
      };
      foodInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitFood();
        }
      });
      foodButton.addEventListener("click", () => {
        void submitFood();
      });
      const foodList = foodCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (todayEntry.foodLog.length === 0) {
        const emptyState = foodList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No food entries yet today. Use a quick meal tag instead of leaving the day blank." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Breakfast", async () => this.plugin.addFoodEntry("Breakfast"), false, "sunrise");
        createButton(emptyActions, "Lunch", async () => this.plugin.addFoodEntry("Lunch"), false, "utensils-crossed");
        createButton(emptyActions, "Dinner", async () => this.plugin.addFoodEntry("Dinner"), false, "moon-star");
      } else {
        todayEntry.foodLog.forEach((item, index) => {
          const row = foodList.createDiv({ cls: "daily-dashboard-food-row" });
          row.createEl("span", { text: item.text });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeFoodEntry(index);
          });
        });
      }
      const notesCard = createCard(grid, "Sleep And Notes", "Sleep, dreams, and daily notes in one recovery block.", {
        icon: "moon-star",
        eyebrow: "Recovery",
        tone: "log",
        tag: "Journal"
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Sleep log" });
      const sleepInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      sleepInput.value = todayEntry.sleepLog;
      sleepInput.placeholder = "Bedtime, wake time, sleep quality, naps, anything worth tracking.";
      sleepInput.addEventListener("change", () => {
        void this.plugin.updateSleepLog(sleepInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Dream log" });
      const dreamInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      dreamInput.value = todayEntry.dreamLog;
      dreamInput.placeholder = "Dream fragments, themes, symbols, emotions, or recurring patterns you want the AI to analyze later.";
      dreamInput.addEventListener("change", () => {
        void this.plugin.updateDreamLog(dreamInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
      const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      notesInput.value = todayEntry.notes;
      notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
      notesInput.addEventListener("change", () => {
        void this.plugin.updateDailyNotes(notesInput.value);
      });
      const workLogCard = createCard(grid, "Searchable Work Log", "Filter archived completions by project, date, or keyword.", {
        icon: "search",
        eyebrow: "History",
        tone: "log",
        tag: "Query"
      });
      const filterGrid = workLogCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const projectFilter = filterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allProjectsOption = projectFilter.createEl("option", { text: "All projects" });
      allProjectsOption.value = "";
      projects.forEach((project) => {
        const option = projectFilter.createEl("option", { text: project.name });
        option.value = project.name;
        option.selected = project.name === this.workLogFilters.project;
      });
      projectFilter.addEventListener("change", () => {
        this.workLogFilters.project = projectFilter.value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "Keyword", this.workLogFilters.keyword, (value) => {
        this.workLogFilters.keyword = value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "From date (YYYY-MM-DD)", this.workLogFilters.fromDate, (value) => {
        this.workLogFilters.fromDate = value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "To date (YYYY-MM-DD)", this.workLogFilters.toDate, (value) => {
        this.workLogFilters.toDate = value;
        void this.render();
      });
      const workLogList = workLogCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (workLogEntries.length === 0) {
        workLogList.createDiv({ cls: "daily-dashboard-empty-state", text: "No archived work matches the current filters." });
      } else {
        workLogEntries.slice(0, 20).forEach((task) => {
          const row = workLogList.createDiv({ cls: "daily-dashboard-completed-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, task.section, "neutral");
          const dateKey = task.archivedAt.slice(0, 10);
          createSemanticChip(chipRow, dateKey, "log");
          row.createEl("strong", { text: task.project });
          row.createEl("span", { text: task.text });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: task.archivedAt });
        });
      }
      const aiCard = createCard(grid, "AI Workspace", "Plan, review, and ask grounded questions against your dashboard and vault without leaving the page.", {
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
      const aiOverview = aiShell.createDiv({ cls: "daily-dashboard-ai-overview" });
      const aiActionsPanel = aiOverview.createDiv({ cls: "daily-dashboard-ai-panel" });
      aiActionsPanel.createEl("strong", { text: "Workflows" });
      aiActionsPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Run a focused workflow for planning, review, project triage, coaching, or active-note analysis." });
      const aiActions = aiActionsPanel.createDiv({ cls: "daily-dashboard-ai-action-grid" });
      createButton(aiActions, "Today plan", async () => this.plugin.generateAiTodayPlan(), false, "sunrise");
      createButton(aiActions, "End day review", async () => this.plugin.generateAiEndOfDayReview(), false, "moon-star");
      createButton(aiActions, "Project triage", async () => this.plugin.generateAiProjectTriage(), false, "triangle-alert");
      createButton(aiActions, "Weekly coach", async () => this.plugin.generateAiWeeklyCoachNote(), false, "bar-chart-3");
      createButton(aiActions, "Analyze active note", async () => this.plugin.generateAiActiveNoteAnalysis(), false, "file-search");
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
      const aiLower = aiShell.createDiv({ cls: "daily-dashboard-ai-lower" });
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
        const latest = latestPanel.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-ai-output" });
        latest.createEl("strong", { text: `${aiStatus.latestArtifact.kind} \u2022 ${aiStatus.latestArtifact.generatedAt}` });
        latest.createEl("span", { text: aiStatus.latestArtifact.summary || "AI note generated." });
        latest.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.latestArtifact.notePath });
        const latestActions = latestPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
        createButton(latestActions, "Open latest AI note", async () => this.plugin.openAiArtifact(aiStatus.latestArtifact), false, "file-text");
        if (aiStatus.latestArtifact.suggestedFocus.length > 0) {
          latestPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Suggested focus items" });
          const suggestionList = latestPanel.createDiv({ cls: "daily-dashboard-ai-suggestions" });
          aiStatus.latestArtifact.suggestedFocus.forEach((item) => {
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
      const projectsCard = createCard(grid, "Project Health", "Score projects by backlog, staleness, output, and momentum.", {
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
        [...todoSnapshot.projects].sort((left, right) => right.healthScore - left.healthScore).slice(0, projectsExpanded ? 10 : 6).forEach((project) => {
          const row = projectList.createDiv({ cls: projectsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 75 ? "focus" : project.healthScore >= 50 ? "state" : "alert");
          createSemanticChip(chipRow, project.trend, project.trend === "up" ? "done" : project.trend === "down" ? "alert" : "neutral");
          row.createEl("strong", { text: `${project.name} \u2022 ${project.healthScore}` });
          row.createEl("span", { text: `${project.healthLabel} \u2022 ${project.openCount} open \u2022 ${project.completionsThisWeek} this week \u2022 ${project.completionsThisMonth} this month \u2022 ${project.trend}` });
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
      const alertsCard = createCard(grid, "Stale Work And Cleanup", "Catch stale projects, vague tasks, duplicates, and empty sections.", {
        icon: "triangle-alert",
        eyebrow: "Triage",
        tone: "alert",
        tag: "Attention"
      });
      const alertsExpanded = this.isSectionExpanded("cleanup-details");
      const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
      const alertLines = [
        ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
        ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`),
        ...cleanupSuggestions.slice(0, 5)
      ];
      if (alertLines.length === 0) {
        alertsList.createDiv({ cls: "daily-dashboard-empty-state", text: "No stale-work or cleanup issues detected right now." });
      } else {
        alertLines.slice(0, alertsExpanded ? alertLines.length : 6).forEach((line) => {
          const row = alertsList.createDiv({ cls: alertsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: line });
        });
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      if (alertLines.length > 6) {
        createButton(alertActions, alertsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("cleanup-details"), false, alertsExpanded ? "chevrons-up" : "chevrons-down");
      }
      createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions(), false, "sparkles");
      createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true), false, "move-right");
      const completedCard = createCard(grid, "Completed Today", "Keep today's completed work visible for review and reinforcement.", {
        icon: "badge-check",
        eyebrow: "Done",
        tone: "done",
        tag: "Wins"
      });
      const completedList = completedCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (todayEntry.completedTasks.length === 0) {
        const emptyState = completedList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No archived tasks yet today. Pull something into today or open the hub to finish a concrete item." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Promote task", async () => this.plugin.openPromoteTaskFlow(), false, "target");
        createButton(emptyActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");
      } else {
        todayEntry.completedTasks.slice(0, 10).forEach((task) => {
          const row = completedList.createDiv({ cls: "daily-dashboard-completed-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, task.section, "neutral");
          row.createEl("strong", { text: task.project });
          row.createEl("span", { text: `${task.section}: ${task.text}` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: task.archivedAt });
        });
      }
    } catch (error) {
      console.error("Daily dashboard render failed", error);
      this.renderErrorState(error);
    }
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
  renderDayMetric(parent, label, value) {
    const metric = parent.createDiv({ cls: "daily-dashboard-day-metric" });
    metric.createEl("span", { cls: "daily-dashboard-habit-meta", text: label });
    metric.createEl("strong", { text: value });
    return metric;
  }
  getFilteredWorkLogEntries() {
    const entries = this.plugin.getAllEntries().flatMap((entry) => entry.completedTasks).sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
    return entries.filter((entry) => {
      const matchesProject = !this.workLogFilters.project || entry.project === this.workLogFilters.project;
      const matchesKeyword = !this.workLogFilters.keyword || `${entry.project} ${entry.section} ${entry.text}`.toLowerCase().includes(this.workLogFilters.keyword.toLowerCase());
      const datePart = entry.archivedAt.slice(0, 10);
      const matchesFrom = !this.workLogFilters.fromDate || datePart >= this.workLogFilters.fromDate;
      const matchesTo = !this.workLogFilters.toDate || datePart <= this.workLogFilters.toDate;
      return matchesProject && matchesKeyword && matchesFrom && matchesTo;
    });
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
};
var CreateProjectModal = class extends import_obsidian.Modal {
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
    new import_obsidian.Setting(contentEl).setName("Project name").setDesc("Used for the master todo section and the new project note name.").addText((text) => {
      text.setPlaceholder("New Project").onChange((value) => {
        this.state.projectName = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian.Setting(contentEl).setName("Category").setDesc("Top-level section in the master todo where this project should be added.").addDropdown((dropdown) => {
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
    new import_obsidian.Setting(contentEl).setName("Status").setDesc("Initial status written to the master todo and project note.").addDropdown((dropdown) => {
      ["Planning", "Active", "Parked", "Blocked"].forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(this.state.status);
      dropdown.onChange((value) => {
        this.state.status = value;
      });
    });
    new import_obsidian.Setting(contentEl).setName("Focus").setDesc("Short description of the current objective for this project.").addTextArea((textArea) => {
      textArea.setPlaceholder("What matters most right now for this project?").onChange((value) => {
        this.state.focus = value;
      });
      textArea.inputEl.rows = 3;
    });
    new import_obsidian.Setting(contentEl).setName("Add tasks").setDesc("Optional. One task per line; these seed the Add section.").addTextArea((textArea) => {
      textArea.setPlaceholder("First task\nSecond task").onChange((value) => {
        this.state.addTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian.Setting(contentEl).setName("Fix tasks").setDesc("Optional. One task per line; these seed the Fix section.").addTextArea((textArea) => {
      textArea.setPlaceholder("Known bug\nAnother bug").onChange((value) => {
        this.state.fixTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Create project").setCta().onClick(async () => {
        if (!this.state.projectName.trim()) {
          new import_obsidian.Notice("Project name is required.");
          return;
        }
        if (!this.state.categoryName.trim()) {
          new import_obsidian.Notice("Category is required.");
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
var PromoteTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, projects) {
    var _a, _b;
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = (_b = (_a = projects[0]) == null ? void 0 : _a.name) != null ? _b : "";
  }
  onOpen() {
    var _a, _b, _c;
    this.setTitle("Promote Project Task To Today");
    const { contentEl } = this;
    contentEl.empty();
    const projectSetting = new import_obsidian.Setting(contentEl).setName("Project");
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
      ...(_a = selectedProject == null ? void 0 : selectedProject.nowTasks) != null ? _a : [],
      ...(_b = selectedProject == null ? void 0 : selectedProject.nextTasks) != null ? _b : [],
      ...(_c = selectedProject == null ? void 0 : selectedProject.breakdownTasks) != null ? _c : []
    ].slice(0, 20);
    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new import_obsidian.Setting(contentEl).setName(task).addButton((button) => {
          button.setButtonText("Promote").setCta().onClick(async () => {
            await this.plugin.promoteTaskToToday(this.selectedProjectName, task);
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
var ProjectReviewModal = class extends import_obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options;
  }
  onOpen() {
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();
    this.options.forEach((option) => {
      new import_obsidian.Setting(contentEl).setName(option.projectName).setDesc(option.notePath).addButton((button) => {
        button.setButtonText("Open").setCta().onClick(async () => {
          await this.plugin.openProjectReviewMode(option);
          this.close();
        });
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var AskAiModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.question = "";
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Ask AI About Your Dashboard");
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian.Setting(contentEl).setName("Question").setDesc("Ask about priorities, stalled projects, habit drift, workload balance, or anything else grounded in the dashboard context.").addTextArea((textArea) => {
      textArea.setPlaceholder("What should I focus on next? Which project is costing me the most attention? What pattern am I missing?").setValue(this.question).onChange((value) => {
        this.question = value;
      });
      textArea.inputEl.rows = 6;
      window.setTimeout(() => textArea.inputEl.focus(), 0);
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Ask AI").setCta().onClick(async () => {
        if (!this.question.trim()) {
          new import_obsidian.Notice("Enter a question first.");
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
var DailyDashboardSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Dashboard" });
    new import_obsidian.Setting(containerEl).setName("Dashboard title").setDesc("Displayed at the top of the custom dashboard tab.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dashboardTitle).setValue(settings.dashboardTitle).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dashboardTitle: value.trim() || DEFAULT_SETTINGS.dashboardTitle
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Master Task Hub note path").setDesc("The note used for project task counts, project creation, and archive automation.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.masterTodoPath).setValue(settings.masterTodoPath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          masterTodoPath: value.trim() || DEFAULT_SETTINGS.masterTodoPath
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Project notes folder").setDesc("New project notes created by the intake flow are written here.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder).setValue(settings.projectNotesFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          projectNotesFolder: value.trim() || DEFAULT_SETTINGS.projectNotesFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Daily log folder").setDesc("Markdown logs written once per day.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder).setValue(settings.dailyLogFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dailyLogFolder: value.trim() || DEFAULT_SETTINGS.dailyLogFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Weekly report folder").setDesc("Where generated weekly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder).setValue(settings.weeklyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weeklyReportFolder: value.trim() || DEFAULT_SETTINGS.weeklyReportFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Monthly report folder").setDesc("Where generated monthly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder).setValue(settings.monthlyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          monthlyReportFolder: value.trim() || DEFAULT_SETTINGS.monthlyReportFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Live day state note path").setDesc("Vault note used to mirror logical day and session state for stronger cross-device sync behavior.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.liveStatePath).setValue(settings.liveStatePath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          liveStatePath: value.trim() || DEFAULT_SETTINGS.liveStatePath
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("OpenAI API key").setDesc("Used for AI planning, reflection, triage, and question answering. Stored in plugin settings and will sync with your vault if Obsidian Sync is enabled.").addText((text) => {
      text.setPlaceholder("sk-...").setValue(settings.aiApiKey).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiApiKey: value.trim()
        });
      });
      text.inputEl.type = "password";
    });
    new import_obsidian.Setting(containerEl).setName("AI model").setDesc("Recommended default: gpt-4o-mini for strong cost-to-quality balance. You can enter any compatible OpenAI chat-completions model.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiModel).setValue(settings.aiModel).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiModel: value.trim() || DEFAULT_SETTINGS.aiModel
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI API URL").setDesc("Defaults to OpenAI chat completions. Change this only if you know you need a different compatible endpoint.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiBaseUrl).setValue(settings.aiBaseUrl).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiBaseUrl: value.trim() || DEFAULT_SETTINGS.aiBaseUrl
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI output folder").setDesc("Generated AI planning and analysis notes are written here.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder).setValue(settings.aiOutputFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiOutputFolder: value.trim() || DEFAULT_SETTINGS.aiOutputFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI context days").setDesc("How many recent daily entries are summarized into AI prompts by default.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiContextDays}`).setValue(`${settings.aiContextDays}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiContextDays: clamp(Number(value.trim() || DEFAULT_SETTINGS.aiContextDays), 3, 60)
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI related note limit").setDesc("How many relevant vault notes are pulled into AI context for deeper analysis.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiRelatedNotesLimit}`).setValue(`${settings.aiRelatedNotesLimit}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiRelatedNotesLimit: clamp(Number(value.trim() || DEFAULT_SETTINGS.aiRelatedNotesLimit), 2, 16)
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Enable AI note index").setDesc("Cache scoped markdown notes so AI retrieval does not rescan the whole vault on every request.").addToggle((toggle) => {
      toggle.setValue(settings.aiIndexEnabled).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiIndexEnabled: value
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI indexed folders").setDesc("One folder per line. Only these folders are cached for AI retrieval, plus the master task hub and active note when applicable.").addTextArea((textArea) => {
      textArea.setPlaceholder("Project Notes\nReference\nJournal").setValue(settings.aiIndexedFolders).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiIndexedFolders: value
        });
      });
      textArea.inputEl.rows = 4;
      textArea.inputEl.cols = 36;
    });
    new import_obsidian.Setting(containerEl).setName("AI chunk character limit").setDesc("Approximate maximum size for cached note chunks used during retrieval.").addText((text) => {
      text.setPlaceholder(`${DEFAULT_SETTINGS.aiChunkCharLimit}`).setValue(`${settings.aiChunkCharLimit}`).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiChunkCharLimit: clamp(Number(value.trim() || DEFAULT_SETTINGS.aiChunkCharLimit), 300, 3e3)
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Enable AI embeddings").setDesc("Optionally generate embeddings for indexed note chunks so retrieval can rank by semantic similarity, not just keywords.").addToggle((toggle) => {
      toggle.setValue(settings.aiEmbeddingsEnabled).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingsEnabled: value
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI embedding model").setDesc("Recommended default: text-embedding-3-small for strong cost efficiency on scoped note indexing.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingModel).setValue(settings.aiEmbeddingModel).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingModel: value.trim() || DEFAULT_SETTINGS.aiEmbeddingModel
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("AI embedding API URL").setDesc("Defaults to OpenAI embeddings. Change only if you are intentionally targeting a compatible embeddings endpoint.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingApiUrl).setValue(settings.aiEmbeddingApiUrl).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          aiEmbeddingApiUrl: value.trim() || DEFAULT_SETTINGS.aiEmbeddingApiUrl
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Wallpaper folder").setDesc("Image folder used for dashboard hero wallpapers.").addText((text) => {
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
    new import_obsidian.Setting(containerEl).setName("Selected wallpaper").setDesc(wallpaperFiles.length > 0 ? "Choose the image shown in the top section of the dashboard." : "No image files were found in the configured wallpaper folder.").addDropdown((dropdown) => {
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
    new import_obsidian.Setting(containerEl).setName("Habit definitions").setDesc("One habit per line using the format Habit Name|Target Count.").addTextArea((textArea) => {
      textArea.setPlaceholder("Take pills|1\nBrush teeth|2\nFloss|2\nShower|1\nLog sleep|1").setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}`).join("\n")).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          habitDefinitions: parseHabitDefinitions(value)
        });
      });
      textArea.inputEl.rows = 8;
      textArea.inputEl.cols = 36;
    });
  }
};
var DASHBOARD_CARD_COLLAPSE_STORAGE_KEY = "daily-dashboard-collapsed-cards";
var DASHBOARD_COMPACT_MODE_STORAGE_KEY = "daily-dashboard-compact-mode";
var DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY = "daily-dashboard-expanded-sections";
var DASHBOARD_MOBILE_MODE_STORAGE_KEY = "daily-dashboard-mobile-mode";
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
    (0, import_obsidian.setIcon)(iconEl, options.icon);
    lead.createEl("span", { cls: "daily-dashboard-card-eyebrow", text: options.eyebrow });
    const controls = top.createDiv({ cls: "daily-dashboard-card-header-controls" });
    if (options.tag) {
      createSemanticChip(controls, options.tag, options.tone);
    }
    const toggle = controls.createSpan({ cls: "daily-dashboard-card-toggle" });
    toggle.ariaHidden = "true";
    (0, import_obsidian.setIcon)(toggle, "chevron-down");
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
    (0, import_obsidian.setIcon)(iconEl, iconName);
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
  (0, import_obsidian.setIcon)(iconEl, iconName);
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
  (0, import_obsidian.setIcon)(iconEl, iconName);
  pill.createSpan({ cls: "daily-dashboard-pill-label", text });
  return pill;
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
function getDashboardCompactMode() {
  try {
    return window.localStorage.getItem(DASHBOARD_COMPACT_MODE_STORAGE_KEY) === "true";
  } catch (e) {
    return false;
  }
}
function setDashboardCompactMode(enabled) {
  try {
    window.localStorage.setItem(DASHBOARD_COMPACT_MODE_STORAGE_KEY, enabled ? "true" : "false");
  } catch (e) {
  }
}
function getDashboardMobileMode() {
  try {
    return window.localStorage.getItem(DASHBOARD_MOBILE_MODE_STORAGE_KEY) === "true";
  } catch (e) {
    return false;
  }
}
function setDashboardMobileMode(enabled) {
  try {
    window.localStorage.setItem(DASHBOARD_MOBILE_MODE_STORAGE_KEY, enabled ? "true" : "false");
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
function toClassSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function sanitizeSettings(settings) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t;
  const parsedHabitDefinitions = Array.isArray(settings.habitDefinitions) ? settings.habitDefinitions.map((habit) => {
    var _a2;
    return {
      id: createHabitId(habit.id || habit.label || "habit"),
      label: typeof habit.label === "string" ? habit.label.trim() : "Habit",
      target: clamp(Number((_a2 = habit.target) != null ? _a2 : 1), 1, 12)
    };
  }).filter((habit) => habit.label.length > 0) : DEFAULT_SETTINGS.habitDefinitions;
  return {
    dashboardTitle: ((_a = settings.dashboardTitle) == null ? void 0 : _a.trim()) || DEFAULT_SETTINGS.dashboardTitle,
    masterTodoPath: ((_b = settings.masterTodoPath) == null ? void 0 : _b.trim()) || DEFAULT_SETTINGS.masterTodoPath,
    projectNotesFolder: normalizeFolderPath(((_c = settings.projectNotesFolder) == null ? void 0 : _c.trim()) || DEFAULT_SETTINGS.projectNotesFolder),
    dailyLogFolder: ((_d = settings.dailyLogFolder) == null ? void 0 : _d.trim()) || DEFAULT_SETTINGS.dailyLogFolder,
    weeklyReportFolder: ((_e = settings.weeklyReportFolder) == null ? void 0 : _e.trim()) || DEFAULT_SETTINGS.weeklyReportFolder,
    monthlyReportFolder: ((_f = settings.monthlyReportFolder) == null ? void 0 : _f.trim()) || DEFAULT_SETTINGS.monthlyReportFolder,
    liveStatePath: ((_g = settings.liveStatePath) == null ? void 0 : _g.trim()) || DEFAULT_SETTINGS.liveStatePath,
    aiApiKey: ((_h = settings.aiApiKey) == null ? void 0 : _h.trim()) || DEFAULT_SETTINGS.aiApiKey,
    aiModel: ((_i = settings.aiModel) == null ? void 0 : _i.trim()) || DEFAULT_SETTINGS.aiModel,
    aiBaseUrl: ((_j = settings.aiBaseUrl) == null ? void 0 : _j.trim()) || DEFAULT_SETTINGS.aiBaseUrl,
    aiOutputFolder: normalizeFolderPath(((_k = settings.aiOutputFolder) == null ? void 0 : _k.trim()) || DEFAULT_SETTINGS.aiOutputFolder),
    aiContextDays: clamp(Number((_l = settings.aiContextDays) != null ? _l : DEFAULT_SETTINGS.aiContextDays), 3, 60),
    aiRelatedNotesLimit: clamp(Number((_m = settings.aiRelatedNotesLimit) != null ? _m : DEFAULT_SETTINGS.aiRelatedNotesLimit), 2, 16),
    aiIndexEnabled: (_n = settings.aiIndexEnabled) != null ? _n : DEFAULT_SETTINGS.aiIndexEnabled,
    aiIndexedFolders: typeof settings.aiIndexedFolders === "string" ? settings.aiIndexedFolders : DEFAULT_SETTINGS.aiIndexedFolders,
    aiChunkCharLimit: clamp(Number((_o = settings.aiChunkCharLimit) != null ? _o : DEFAULT_SETTINGS.aiChunkCharLimit), 300, 3e3),
    aiEmbeddingsEnabled: (_p = settings.aiEmbeddingsEnabled) != null ? _p : DEFAULT_SETTINGS.aiEmbeddingsEnabled,
    aiEmbeddingModel: ((_q = settings.aiEmbeddingModel) == null ? void 0 : _q.trim()) || DEFAULT_SETTINGS.aiEmbeddingModel,
    aiEmbeddingApiUrl: ((_r = settings.aiEmbeddingApiUrl) == null ? void 0 : _r.trim()) || DEFAULT_SETTINGS.aiEmbeddingApiUrl,
    wallpaperFolder: normalizeFolderPath(((_s = settings.wallpaperFolder) == null ? void 0 : _s.trim()) || DEFAULT_SETTINGS.wallpaperFolder),
    selectedWallpaper: ((_t = settings.selectedWallpaper) == null ? void 0 : _t.trim()) || DEFAULT_SETTINGS.selectedWallpaper,
    habitDefinitions: parsedHabitDefinitions.length > 0 ? parsedHabitDefinitions : DEFAULT_SETTINGS.habitDefinitions
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
    Object.entries((_a = cache == null ? void 0 : cache.entries) != null ? _a : {}).map(([path, entry]) => {
      var _a2, _b, _c;
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const normalizedChunks = Array.isArray(entry.chunks) ? entry.chunks.filter((chunk) => Boolean(chunk && typeof chunk === "object" && typeof chunk.text === "string")).map((chunk, index) => ({
        id: typeof chunk.id === "string" ? chunk.id : `${(0, import_obsidian.normalizePath)(path)}#${index + 1}`,
        heading: typeof chunk.heading === "string" ? chunk.heading : "",
        text: chunk.text,
        keywords: Array.isArray(chunk.keywords) ? chunk.keywords.filter((item) => typeof item === "string") : extractKeywords(chunk.text),
        embedding: Array.isArray(chunk.embedding) ? chunk.embedding.filter((value) => typeof value === "number" && Number.isFinite(value)) : void 0
      })) : [];
      return [(0, import_obsidian.normalizePath)(path), {
        path: (0, import_obsidian.normalizePath)(path),
        mtime: Number((_a2 = entry.mtime) != null ? _a2 : 0),
        size: Number((_b = entry.size) != null ? _b : 0),
        title: typeof entry.title === "string" ? entry.title : (_c = (0, import_obsidian.normalizePath)(path).split("/").pop()) != null ? _c : (0, import_obsidian.normalizePath)(path),
        keywords: Array.isArray(entry.keywords) ? entry.keywords.filter((item) => typeof item === "string") : [],
        chunks: normalizedChunks
      }];
    }).filter((item) => Boolean(item))
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
    dayStartedAt: "",
    dayEndedAt: "",
    wakeTime: "",
    sleepTime: "",
    habits: habitValues,
    habitEvents,
    moodScore: 0,
    energyScore: 0,
    todayFocus: [],
    frictionLog: "",
    missedHabits: computeMissedHabits(habitValues, habits),
    foodLog: [],
    sleepLog: "",
    dreamLog: "",
    notes: "",
    workSessions: [],
    napSessions: [],
    completedTasks: []
  };
}
function normalizeDayState(dayState, entries) {
  var _a;
  const fallbackDate = (_a = Object.keys(entries).sort().slice(-1)[0]) != null ? _a : formatDateKey(/* @__PURE__ */ new Date());
  const activeDate = typeof (dayState == null ? void 0 : dayState.activeDate) === "string" && dayState.activeDate.trim().length > 0 ? dayState.activeDate : fallbackDate;
  const status = (dayState == null ? void 0 : dayState.status) === "in-progress" || (dayState == null ? void 0 : dayState.status) === "ended" ? dayState.status : "not-started";
  return {
    activeDate,
    status
  };
}
function parseHabitDefinitions(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return DEFAULT_SETTINGS.habitDefinitions;
  }
  return lines.map((line) => {
    const [rawLabel, rawTarget] = line.split("|");
    const label = (rawLabel == null ? void 0 : rawLabel.trim()) || "Habit";
    const target = clamp(Number((rawTarget == null ? void 0 : rawTarget.trim()) || 1), 1, 12);
    return {
      id: createHabitId(label),
      label,
      target
    };
  });
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
    project.nowTasks.length > 0 ? `  now: ${project.nowTasks.slice(0, 3).join(" | ")}` : "",
    project.nextTasks.length > 0 ? `  next: ${project.nextTasks.slice(0, 3).join(" | ")}` : ""
  ].filter((line) => line.length > 0).join("\n"));
  const staleLines = snapshot.staleProjects.slice(0, 6).map((project) => `- ${project.name}: ${project.staleDays} stale days`);
  const cleanupLines = snapshot.cleanupSuggestions.slice(0, 8).map((item) => `- ${item}`);
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
    const averageCount = (entries.reduce((sum, entry) => {
      var _a;
      return sum + ((_a = entry.habits[habit.id]) != null ? _a : 0);
    }, 0) / entries.length).toFixed(1);
    return `- ${habit.label}: avg ${averageCount}/${habit.target}, recent times ${timestamps.slice(-8).join(", ") || "none"}`;
  });
  const foodTimes = entries.flatMap((entry) => entry.foodLog.map((item) => item.loggedAt.slice(11))).filter((item) => item.length > 0);
  const dreamDays = entries.filter((entry) => entry.dreamLog.trim().length > 0).map((entry) => entry.date);
  return [
    "Habit timing:",
    ...habitLines,
    "",
    `Recent food times: ${foodTimes.slice(-12).join(", ") || "none"}`,
    `Dream log days: ${dreamDays.join(", ") || "none"}`
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
    ...todayEntry.todayFocus.flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/)),
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
  return excludedPrefixes.some((prefix) => normalizedPath.startsWith(`${prefix}/`) || normalizedPath === prefix) || normalizedPath === (0, import_obsidian.normalizePath)(settings.liveStatePath);
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
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? { text: trimmed, loggedAt: "" } : null;
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
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}
function renderLiveDayStateNote(snapshot) {
  const workSessionLines = snapshot.entry.workSessions.length > 0 ? snapshot.entry.workSessions.map((session) => {
    var _a;
    return `- ${session.start} -> ${(_a = session.end) != null ? _a : "Still active"}`;
  }) : ["- None"];
  const napSessionLines = snapshot.entry.napSessions.length > 0 ? snapshot.entry.napSessions.map((session) => {
    var _a;
    return `- ${session.start} -> ${(_a = session.end) != null ? _a : "Still active"}`;
  }) : ["- None"];
  const payload = JSON.stringify(snapshot.entry, null, 2);
  return [
    "---",
    `updatedAt: ${snapshot.updatedAt}`,
    `activeDate: ${snapshot.dayState.activeDate}`,
    `status: ${snapshot.dayState.status}`,
    `date: ${snapshot.entry.date}`,
    `dayStartedAt: ${snapshot.entry.dayStartedAt || ""}`,
    `dayEndedAt: ${snapshot.entry.dayEndedAt || ""}`,
    `wakeTime: ${snapshot.entry.wakeTime || ""}`,
    `sleepTime: ${snapshot.entry.sleepTime || ""}`,
    "---",
    "",
    "# Live Day State",
    "",
    "This note is maintained by Daily Dashboard to make logical-day state easier to sync across devices.",
    "",
    "## Work Sessions",
    ...workSessionLines,
    "",
    "## Nap Sessions",
    ...napSessionLines,
    "",
    "## Entry Payload",
    "```json",
    payload,
    "```",
    ""
  ].join("\n");
}
function parseLiveDayStateNote(content) {
  var _a, _b, _c, _d, _e, _f, _g;
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
  const activeDate = (_a = frontmatter.get("activeDate")) != null ? _a : "";
  const statusValue = frontmatter.get("status");
  const date = (_b = frontmatter.get("date")) != null ? _b : activeDate;
  if (!activeDate || !date) {
    return null;
  }
  const workSessions = [];
  const napSessions = [];
  const payloadLines = [];
  let currentSection = "";
  let inPayload = false;
  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) {
      currentSection = line.slice(3).trim().toLowerCase();
      continue;
    }
    if (currentSection === "entry payload") {
      if (line === "```json") {
        inPayload = true;
        continue;
      }
      if (line === "```" && inPayload) {
        inPayload = false;
        continue;
      }
      if (inPayload) {
        payloadLines.push(lines[index]);
        continue;
      }
    }
    if (!line.startsWith("- ")) {
      continue;
    }
    const session = parseWorkSessionLine(line);
    if (!session) {
      continue;
    }
    if (currentSection === "work sessions") {
      workSessions.push(session);
    }
    if (currentSection === "nap sessions") {
      napSessions.push(session);
    }
  }
  let parsedEntry = {};
  if (payloadLines.length > 0) {
    try {
      parsedEntry = JSON.parse(payloadLines.join("\n"));
    } catch (error) {
      console.warn("Daily Dashboard could not parse live state entry payload", error);
    }
  }
  return {
    updatedAt: (_c = frontmatter.get("updatedAt")) != null ? _c : "",
    dayState: {
      activeDate,
      status: statusValue === "in-progress" || statusValue === "ended" ? statusValue : "not-started"
    },
    entry: {
      ...createEmptyEntry(date, DEFAULT_SETTINGS.habitDefinitions),
      ...parsedEntry,
      date,
      dayStartedAt: (_d = frontmatter.get("dayStartedAt")) != null ? _d : "",
      dayEndedAt: (_e = frontmatter.get("dayEndedAt")) != null ? _e : "",
      wakeTime: (_f = frontmatter.get("wakeTime")) != null ? _f : "",
      sleepTime: (_g = frontmatter.get("sleepTime")) != null ? _g : "",
      workSessions,
      napSessions
    }
  };
}
function parseWorkSessionLine(line) {
  const rawValue = line.replace(/^-\s+/, "").trim();
  if (!rawValue || rawValue.toLowerCase() === "none") {
    return null;
  }
  const [startValue, endValue] = rawValue.split("->").map((part) => part.trim());
  if (!startValue) {
    return null;
  }
  return {
    start: startValue,
    end: !endValue || endValue === "Still active" ? null : endValue
  };
}
function renderScore(value) {
  return value > 0 ? `${value}/5` : "-";
}
function renderDailyLog(entry, habits) {
  const habitLines = habits.map((habit) => {
    var _a, _b;
    const events = (_a = entry.habitEvents[habit.id]) != null ? _a : [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    return `- ${habit.label}: ${(_b = entry.habits[habit.id]) != null ? _b : 0}/${habit.target}${timing}`;
  });
  const foodLines = entry.foodLog.length > 0 ? entry.foodLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.text}`) : ["- None logged"];
  const completedTaskLines = entry.completedTasks.length > 0 ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`) : ["- No archived tasks today"];
  const workSessionLines = entry.workSessions.length > 0 ? entry.workSessions.map((session) => {
    var _a;
    return `- ${session.start} -> ${(_a = session.end) != null ? _a : "Still active"}`;
  }) : ["- No tracked work sessions"];
  const napSessionLines = entry.napSessions.length > 0 ? entry.napSessions.map((session) => {
    var _a;
    return `- ${session.start} -> ${(_a = session.end) != null ? _a : "Still active"}`;
  }) : ["- No tracked naps"];
  const totalWorkMinutes = getTrackedWorkMinutes(entry);
  const totalNapMinutes = getTrackedMinutes(entry.napSessions);
  return [
    "---",
    `date: ${entry.date}`,
    `dayStartedAt: ${entry.dayStartedAt || ""}`,
    `dayEndedAt: ${entry.dayEndedAt || ""}`,
    `wakeTime: ${entry.wakeTime || ""}`,
    `sleepTime: ${entry.sleepTime || ""}`,
    `trackedWorkMinutes: ${totalWorkMinutes}`,
    `trackedNapMinutes: ${totalNapMinutes}`,
    `workCompleted: ${entry.completedTasks.length}`,
    `foodEntryCount: ${entry.foodLog.length}`,
    `dreamLogged: ${entry.dreamLog.trim().length > 0}`,
    `moodScore: ${entry.moodScore}`,
    `energyScore: ${entry.energyScore}`,
    "---",
    "",
    `# Daily Dashboard Log - ${entry.date}`,
    "",
    "## Day Flow",
    `- Day started: ${entry.dayStartedAt || "Not started"}`,
    `- Wake time: ${entry.wakeTime || "Not logged"}`,
    `- Day ended: ${entry.dayEndedAt || "Not ended"}`,
    `- Sleep time: ${entry.sleepTime || "Not logged"}`,
    `- Tracked work: ${formatMinutesAsHours(totalWorkMinutes)}`,
    `- Tracked naps: ${formatMinutesAsHours(totalNapMinutes)}`,
    "",
    "## Habits",
    ...habitLines,
    "",
    "## State",
    `- Mood: ${renderScore(entry.moodScore)}`,
    `- Energy: ${renderScore(entry.energyScore)}`,
    "",
    "## Food Log",
    ...foodLines,
    "",
    "## Sleep Log",
    entry.sleepLog || "No sleep log yet.",
    "",
    "## Dream Log",
    entry.dreamLog || "No dream log yet.",
    "",
    "## Work Sessions",
    ...workSessionLines,
    "",
    "## Nap Sessions",
    ...napSessionLines,
    "",
    "## Work Completed",
    ...completedTaskLines,
    "",
    "## Notes",
    entry.notes || "No notes yet.",
    ""
  ].join("\n");
}
function renderPeriodReport(input) {
  const workByProject = /* @__PURE__ */ new Map();
  let daysWithFood = 0;
  let daysWithSleep = 0;
  let daysWithDreams = 0;
  let moodTotal = 0;
  let moodDays = 0;
  let energyTotal = 0;
  let energyDays = 0;
  let trackedWorkMinutes = 0;
  let trackedNapMinutes = 0;
  let daysWithNaps = 0;
  input.entries.forEach((entry) => {
    if (entry.foodLog.length > 0) {
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
    trackedWorkMinutes += getTrackedWorkMinutes(entry);
    trackedNapMinutes += getTrackedMinutes(entry.napSessions);
    if (entry.napSessions.length > 0) {
      daysWithNaps += 1;
    }
    entry.completedTasks.forEach((task) => {
      var _a;
      workByProject.set(task.project, ((_a = workByProject.get(task.project)) != null ? _a : 0) + 1);
    });
  });
  const habitRows = input.habitDefinitions.map((habit) => {
    const completed = input.entries.reduce((sum, entry) => {
      var _a;
      return sum + Math.min((_a = entry.habits[habit.id]) != null ? _a : 0, habit.target);
    }, 0);
    const target = input.entries.length * habit.target;
    const percentage = target > 0 ? Math.round(completed / target * 100) : 0;
    return `| ${habit.label} | ${completed}/${target} | ${percentage}% |`;
  });
  const workLines = Array.from(workByProject.entries()).sort((left, right) => right[1] - left[1]).map(([project, count]) => `- ${project}: ${count}`);
  const dayLines = input.entries.map((entry) => {
    const foodSummary = entry.foodLog.length > 0 ? `${entry.foodLog.length} food entries` : "no food log";
    const napSummary = entry.napSessions.length > 0 ? `${formatMinutesAsHours(getTrackedMinutes(entry.napSessions))} naps` : "no naps";
    const dreamSummary = entry.dreamLog.trim().length > 0 ? "dream logged" : "no dream log";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, ${napSummary}, ${dreamSummary}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`;
  });
  return [
    `# ${input.title}`,
    "",
    `Range: ${input.rangeLabel}`,
    "",
    "## Overview",
    `- Days captured: ${input.entries.length}`,
    `- Archived tasks completed: ${input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0)}`,
    `- Days with food logged: ${daysWithFood}`,
    `- Days with sleep logged: ${daysWithSleep}`,
    `- Days with dream logs: ${daysWithDreams}`,
    `- Tracked work time: ${formatMinutesAsHours(trackedWorkMinutes)}`,
    `- Days with naps tracked: ${daysWithNaps}`,
    `- Tracked nap time: ${formatMinutesAsHours(trackedNapMinutes)}`,
    `- Average mood: ${moodDays > 0 ? `${(moodTotal / moodDays).toFixed(1)}/5` : "No mood data"}`,
    `- Average energy: ${energyDays > 0 ? `${(energyTotal / energyDays).toFixed(1)}/5` : "No energy data"}`,
    "",
    "## Habit Completion",
    "| Habit | Completed | Rate |",
    "| --- | --- | --- |",
    ...habitRows,
    "",
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
function getTrackedWorkMinutes(entry) {
  return getTrackedMinutes(entry.workSessions);
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
    var _a, _b, _c;
    let openCount = 0;
    let archivedCount = 0;
    let currentSection = "General";
    let focus = "";
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
    const breakdownTasks = [];
    const emptySections = /* @__PURE__ */ new Set();
    const relationships = /* @__PURE__ */ new Set();
    const seenTasks = /* @__PURE__ */ new Map();
    const duplicateTasks = /* @__PURE__ */ new Set();
    const sectionCounts = /* @__PURE__ */ new Map();
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
      const normalizedTask = taskText.toLowerCase();
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
      sectionCounts.set(sectionKey, ((_c = sectionCounts.get(sectionKey)) != null ? _c : 0) + 1);
      if (sectionKey === "now") {
        nowTasks.push(taskText);
      }
      if (sectionKey === "next") {
        nextTasks.push(taskText);
      }
      if (sectionKey === "later") {
        laterTasks.push(taskText);
      }
      if (sectionKey === "repeating") {
        dueRepeatingTasks.push(taskText);
      }
      if (looksLikeBreakdownTask(taskText)) {
        breakdownTasks.push(taskText);
      }
    }
    const staleDays = lastCompletedAt ? daysBetween(lastCompletedAt, formatDateKey(now)) : null;
    const trend = completionsThisWeek > completionsPreviousWeek ? "up" : completionsThisWeek < completionsPreviousWeek ? "down" : "flat";
    const healthScore = computeHealthScore({
      openCount,
      staleDays,
      completionsThisWeek,
      nowCount: nowTasks.length,
      nextCount: nextTasks.length,
      breakdownCount: breakdownTasks.length,
      duplicateCount: duplicateTasks.size
    });
    return {
      name: project.name,
      categoryName,
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
      healthScore,
      healthLabel: describeHealthScore(healthScore),
      relationships: Array.from(relationships)
    };
  });
  const breakdownCandidates = projects.flatMap((project) => project.breakdownTasks.map((task) => ({ project: project.name, task })));
  const staleProjects = projects.filter((project) => project.staleDays !== null && project.staleDays >= 7).sort((left, right) => {
    var _a, _b;
    return ((_a = right.staleDays) != null ? _a : 0) - ((_b = left.staleDays) != null ? _b : 0);
  });
  const cleanupSuggestions = projects.flatMap((project) => buildCleanupSuggestions(project));
  return {
    totalOpen: projects.reduce((sum, project) => sum + project.openCount, 0),
    totalArchived: projects.reduce((sum, project) => sum + project.archivedCount, 0),
    projects,
    staleProjects,
    breakdownCandidates,
    cleanupSuggestions
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
  return `[[${stripMarkdownExtension((0, import_obsidian.normalizePath)(filePath))}|${label}]]`;
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
function computeMissedHabits(habits, definitions) {
  return definitions.filter((definition) => {
    var _a;
    return ((_a = habits[definition.id]) != null ? _a : 0) < definition.target;
  }).map((definition) => definition.label);
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
function renderWeeklyReview(input) {
  var _a, _b, _c, _d;
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const focusItems = Array.from(new Set(input.entries.flatMap((entry) => entry.todayFocus))).slice(0, 10);
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
function extractRepeatingTasks(noteContent) {
  const lines = noteContent.split(/\r?\n/);
  const tasks = [];
  let inRepeatingSection = false;
  lines.forEach((line) => {
    var _a, _b;
    const trimmed = line.trim();
    if (/^##+\s+/.test(trimmed)) {
      inRepeatingSection = /repeating/i.test(trimmed);
      return;
    }
    if (!inRepeatingSection) {
      return;
    }
    const taskMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (!taskMatch) {
      return;
    }
    const rawText = taskMatch[1].trim();
    const cadenceMatch = rawText.match(/\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\)/i);
    const cadence = ((_b = (_a = cadenceMatch == null ? void 0 : cadenceMatch[1]) != null ? _a : cadenceMatch == null ? void 0 : cadenceMatch[2]) != null ? _b : "weekly").toLowerCase();
    const text = rawText.replace(/\s*(\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\))\s*/i, "").trim();
    if (text) {
      tasks.push({ text, cadence });
    }
  });
  return tasks;
}
function isRepeatingTaskDue(task, content, projectName) {
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
    return true;
  }
  const latest = archivedDates.sort().reverse()[0];
  const daysSince = daysBetween(latest, formatDateKey(/* @__PURE__ */ new Date()));
  if (task.cadence === "daily") {
    return daysSince >= 1;
  }
  if (task.cadence === "weekly") {
    return daysSince >= 7;
  }
  return daysSince >= 28;
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
    const notePath = (0, import_obsidian.normalizePath)(`${stripMarkdownExtension(projectDefinition.noteLinkPath)}.md`);
    const noteFile = vault.getAbstractFileByPath(notePath);
    if (!(noteFile instanceof import_obsidian.TFile)) {
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
  let score = 100;
  score -= Math.min(input.openCount * 2, 30);
  score -= Math.min((_a = input.staleDays) != null ? _a : 0, 25);
  score += Math.min(input.completionsThisWeek * 4, 16);
  score += Math.min(input.nowCount * 3, 9);
  score += Math.min(input.nextCount * 1, 4);
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
  if (project.staleDays !== null && project.staleDays >= 14) {
    suggestions.push(`${project.name}: review stale backlog or re-scope the project.`);
  }
  if (project.duplicateTasks.length > 0) {
    suggestions.push(`${project.name}: merge duplicate tasks (${project.duplicateTasks.slice(0, 3).join(", ")}).`);
  }
  if (project.breakdownTasks.length > 0) {
    suggestions.push(`${project.name}: break down ${project.breakdownTasks.length} oversized task${project.breakdownTasks.length === 1 ? "" : "s"}.`);
  }
  if (project.emptySections.length > 0) {
    suggestions.push(`${project.name}: prune empty sections (${project.emptySections.join(", ")}).`);
  }
  return suggestions;
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
