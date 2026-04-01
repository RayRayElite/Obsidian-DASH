import { Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";

import {
  buildAiSearchTerms,
  buildNoteIndexEntry,
  clamp,
  computeMissedHabits,
  createHabitId,
  createEmptyEntry,
  createEmptyNoteIndexCache,
  extractAiStructuredPayload,
  extractAiSummary,
  formatDateKey,
  formatDateTimeKey,
  formatFileTimestamp,
  formatPreciseDateTimeKey,
  getEntryRecencyKey,
  getIndexedFolderList,
  getRelevantIndexedNotes,
  normalizeFoodEntry,
  normalizeFolderPath,
  normalizeNoteIndexCache,
  normalizeDayState,
  renderAiRelevantNotes,
  renderRoutineSignalsForAi,
  renderTodoSnapshotForAi,
  sanitizeSettings,
  shouldIndexFilePath,
  shouldRebuildAiIndex,
  stripJsonCodeBlocks,
  truncateText
} from "./src/dashboard-core";
import {
  closeOpenBreakSessions,
  closeOpenNapSessions,
  closeOpenRelaxSessions,
  closeOpenWorkSessions,
  getTrackedBreakMinutes,
  getTrackedMinutes,
  getTrackedNapMinutes,
  getTrackedRelaxMinutes,
  getSleepMinutesForDay,
  getTrackedWorkMinutes,
  parseDailyLogEntry,
  renderDailyLog,
  renderPeriodReport,
  renderWeeklyReview
} from "./src/dashboard-logs";
import {
  archiveCompletedTasks,
  createWikiLink,
  extractProjectDefinitionsFromTodo,
  extractRepeatingTasks,
  findProjectRanges,
  findTodoCategoryRanges,
  getIsoWeekRange,
  insertProjectIntoTodo,
  insertTaskIntoProjectSection,
  isRepeatingTaskDue,
  offloadReferencesFromMasterHub,
  parseTodoSnapshot,
  reconcileCompletedTasks,
  renderExistingProjectNoteTemplate,
  renderProjectNoteTemplate,
  renderTodoProjectBlock,
  sanitizeFileName,
  stripMarkdownExtension
} from "./src/dashboard-todo";
import {
  AddHabitModal,
  AskAiModal,
  CreateProjectModal,
  DailyDashboardSettingTab,
  DailyDashboardView,
  LogicalDayRepairModal,
  ProjectReviewModal,
  PromoteTaskModal
} from "./src/dashboard-ui";
import {
  DEFAULT_SETTINGS,
  IMAGE_EXTENSIONS,
  VIEW_TYPE_DAILY_DASHBOARD,
  type AiArtifact,
  type AiRelevantNote,
  type AiStatus,
  type AiStructuredPayload,
  type ArchivedTaskSnapshot,
  type ArchiveMaintenanceResult,
  type CreateProjectInput,
  type DayRepairInput,
  type DailyEntry,
  type DashboardPluginData,
  type DashboardSettings,
  type DayLifecycleState,
  type FoodEntry,
  type HabitDefinition,
  type NoteIndexEntry,
  type ProjectReviewOption,
  type RetrievalIndexStatus,
  type TodoSnapshot,
  type WallpaperOption,
  type WorkSession
} from "./src/dashboard-types";

export default class DailyDashboardPlugin extends Plugin {
  private data: DashboardPluginData = {
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    dayState: {
      activeDate: formatDateKey(new Date()),
      status: "not-started"
    },
    noteIndex: createEmptyNoteIndexCache()
  };
  private wallpaperOptions: WallpaperOption[] = [];
  private autoArchiveDebounceId: number | null = null;
  private isAutoArchivingTodo = false;
  private latestAiArtifact: AiArtifact | null = null;
  private isAiBusy = false;
  private isIndexingNotes = false;
  private noteIndexDebounceId: number | null = null;

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return String(error);
  }

  private async initializeWorkspaceArtifacts(): Promise<void> {
    await this.ensureTodayEntry();
    await this.backfillDailyLogsFromEntries();
    await this.refreshWallpaperOptions();
  }

  async onload(): Promise<void> {
    await this.loadPluginData();

    try {
      await this.initializeWorkspaceArtifacts();
    } catch (error) {
      console.error("Daily Dashboard startup initialization failed", error);
      new Notice(`Daily Dashboard could not prepare its startup files. ${this.getErrorMessage(error)}`);
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
      if (!(file instanceof TFile)) {
        return;
      }

      const normalizedPath = normalizePath(file.path);
      if (normalizedPath === normalizePath(this.data.settings.masterTodoPath)) {
        this.scheduleAutomaticTodoArchive();
        this.refreshDashboardViews();
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
      if (!(file instanceof TFile) || file.extension !== "md") {
        return;
      }

      if (this.isDailyLogPath(file.path)) {
        void this.reloadDailyLogFile(file);
      }

      this.scheduleNoteIndexRefresh();
    }));

    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md") {
        return;
      }

      if (this.isDailyLogPath(file.path)) {
        this.removeDailyLogEntry(file.path);
      }

      delete this.data.noteIndex.entries[normalizePath(file.path)];
      this.scheduleNoteIndexRefresh();
    }));

    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!(file instanceof TFile) || file.extension !== "md") {
        return;
      }

      if (this.isDailyLogPath(oldPath) || this.isDailyLogPath(file.path)) {
        this.removeDailyLogEntry(oldPath);
        if (this.isDailyLogPath(file.path)) {
          void this.reloadDailyLogFile(file);
        }
      }

      delete this.data.noteIndex.entries[normalizePath(oldPath)];
      this.scheduleNoteIndexRefresh();
    }));

    this.registerInterval(window.setInterval(() => {
      void this.refreshForNewDay();
    }, 60_000));

    window.setTimeout(() => {
      void this.rebuildAiNoteIndex(false);
    }, 2500);
  }

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
  }

  getSettings(): DashboardSettings {
    return this.data.settings;
  }

  getHabitDefinitions(): HabitDefinition[] {
    return this.data.settings.habitDefinitions;
  }

  getTodayKey(): string {
    return this.data.dayState.status === "not-started"
      ? formatDateKey(new Date())
      : this.data.dayState.activeDate || formatDateKey(new Date());
  }

  getTodayEntry(): DailyEntry {
    return this.getOrCreateEntry(this.getTodayKey());
  }

  getDayState(): DayLifecycleState {
    return this.data.dayState;
  }

  isWorkSessionActive(): boolean {
    return this.getTodayEntry().workSessions.some((session) => session.end === null);
  }

  isNapSessionActive(): boolean {
    return this.getTodayEntry().napSessions.some((session) => session.end === null);
  }

  isRelaxSessionActive(): boolean {
    return this.getTodayEntry().relaxSessions.some((session) => session.end === null);
  }

  isBreakSessionActive(): boolean {
    return this.getTodayEntry().breakSessions.some((session) => session.end === null);
  }

  getTrackedWorkMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedWorkMinutes(this.getEffectiveTrackedEntry(entry));
  }

  getTrackedNapMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedNapMinutes(this.getEffectiveTrackedEntry(entry));
  }

  getTrackedRelaxMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedRelaxMinutes(this.getEffectiveTrackedEntry(entry));
  }

  getTrackedBreakMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedBreakMinutes(this.getEffectiveTrackedEntry(entry));
  }

  getAllEntries(): DailyEntry[] {
    return Object.values(this.data.entries)
      .map((entry) => this.normalizeEntry(entry, entry.date || this.getTodayKey()))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  getWallpaperFiles(): WallpaperOption[] {
    return this.wallpaperOptions;
  }

  getSelectedWallpaperPath(): string {
    const files = this.getWallpaperFiles();
    const selected = normalizePath(this.data.settings.selectedWallpaper);
    if (selected && files.some((file) => normalizePath(file.path) === selected)) {
      return selected;
    }

    if (selected) {
      const selectedFileName = selected.split("/").pop()?.toLowerCase() ?? "";
      const matchingByName = files.find((file) => (file.path.split("/").pop()?.toLowerCase() ?? "") === selectedFileName);
      if (matchingByName) {
        return matchingByName.path;
      }
    }

    return files[0]?.path ?? "";
  }

  getSelectedWallpaperUrl(): string | null {
    const path = this.getSelectedWallpaperPath();
    if (!path) {
      return null;
    }

    const option = this.wallpaperOptions.find((candidate) => normalizePath(candidate.path) === normalizePath(path));
    return option?.url ?? null;
  }

  getAiStatus(): AiStatus {
    return {
      configured: this.data.settings.aiApiKey.trim().length > 0,
      busy: this.isAiBusy,
      model: this.data.settings.aiModel,
      outputFolder: this.data.settings.aiOutputFolder,
      latestArtifact: this.latestAiArtifact,
      indexStatus: this.getRetrievalIndexStatus()
    };
  }

  getRetrievalIndexStatus(): RetrievalIndexStatus {
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

  async activateDashboardView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    const leaf = existingLeaves[0] ?? this.app.workspace.getLeaf(true);

    await leaf.setViewState({
      type: VIEW_TYPE_DAILY_DASHBOARD,
      active: true
    });

    this.app.workspace.revealLeaf(leaf);
  }

  async updateSettings(settings: DashboardSettings): Promise<void> {
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

  async updateMoodScore(value: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.moodScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }

  async updateEnergyScore(value: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.energyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }

  async updateAnxietyScore(value: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.anxietyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }

  async updateHabitValue(habitId: string, value: number): Promise<void> {
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }

    const entry = this.getTodayEntry();
    const nextValue = clamp(value, 0, definition.target);
    const currentEvents = [...(entry.habitEvents[habitId] ?? [])];
    if (nextValue > currentEvents.length) {
      for (let index = currentEvents.length; index < nextValue; index += 1) {
        currentEvents.push(formatDateTimeKey(new Date()));
      }
    } else if (nextValue < currentEvents.length) {
      currentEvents.length = nextValue;
    }

    entry.habitEvents[habitId] = currentEvents;
    entry.habits[habitId] = nextValue;
    await this.persistEntry(entry);
  }

  async addHabitDefinition(label: string, target: number): Promise<void> {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      new Notice("Habit name is required.");
      return;
    }

    const nextHabitId = createHabitId(normalizedLabel);
    if (this.data.settings.habitDefinitions.some((habit) => habit.id === nextHabitId)) {
      new Notice(`A habit named ${normalizedLabel} already exists.`);
      return;
    }

    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: [
        ...this.getHabitDefinitions(),
        {
          id: nextHabitId,
          label: normalizedLabel,
          target: clamp(Math.round(target), 1, 12)
        }
      ]
    });
  }

  async removeHabitDefinition(habitId: string): Promise<void> {
    if (this.getHabitDefinitions().length <= 1) {
      new Notice("Keep at least one habit defined.");
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

  async addFoodEntry(value: string, amount = 1): Promise<void> {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    const entry = this.getTodayEntry();
    entry.foodLog = [{ text: trimmedValue, amount: clamp(Math.round(amount), 1, 24), loggedAt: formatDateTimeKey(new Date()) }, ...entry.foodLog];
    await this.persistEntry(entry);
  }

  async updateFoodEntryAmount(index: number, amount: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextEntry = entry.foodLog[index];
    if (!nextEntry) {
      return;
    }

    nextEntry.amount = clamp(Math.round(amount), 1, 24);
    await this.persistEntry(entry);
  }

  async removeFoodEntry(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.foodLog = entry.foodLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateSleepLog(value: string): Promise<void> {
    const entry = this.getTodayEntry();
    entry.sleepLog = value.trim();
    await this.persistEntry(entry);
  }

  async updateDreamLog(value: string): Promise<void> {
    const entry = this.getTodayEntry();
    entry.dreamLog = value.trim();
    await this.persistEntry(entry);
  }

  async beginLogicalDay(): Promise<void> {
    if (this.data.dayState.status === "in-progress") {
      new Notice(`Your logical day ${this.data.dayState.activeDate} is already in progress.`);
      return;
    }

    const now = new Date();
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
    this.refreshDashboardViews();
    new Notice(`Began logical day ${nextDate}.`);
  }

  async endLogicalDay(): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("No logical day is currently in progress.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    const entry = this.getTodayEntry();
    entry.dayEndedAt = timestamp;
    if (!entry.sleepTime) {
      entry.sleepTime = timestamp;
    }
    closeOpenWorkSessions(entry, timestamp);
    closeOpenNapSessions(entry, timestamp);
    closeOpenRelaxSessions(entry, timestamp);
    closeOpenBreakSessions(entry, timestamp);
    this.data.dayState = {
      activeDate: entry.date,
      status: "ended"
    };
    await this.persistEntry(entry);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Ended logical day ${entry.date}.`);
  }

  async openLogicalDayRepairFlow(): Promise<void> {
    new LogicalDayRepairModal(this.app, this).open();
  }

  getDayRepairInput(date: string = this.getTodayKey()): DayRepairInput {
    const entry = this.getOrCreateEntry(date);
    const previousEntry = this.getPreviousEntry(date);

    return {
      date,
      status: this.data.dayState.activeDate === date ? this.data.dayState.status : "ended",
      dayStartedAt: entry.dayStartedAt,
      dayEndedAt: entry.dayEndedAt,
      wakeTime: entry.wakeTime,
      sleepTime: entry.sleepTime,
      sleepMinutesOverride: getSleepMinutesForDay(entry, previousEntry),
      workMinutesOverride: getTrackedWorkMinutes(entry),
      napMinutesOverride: getTrackedNapMinutes(entry),
      relaxMinutesOverride: getTrackedRelaxMinutes(entry),
      breakMinutesOverride: getTrackedBreakMinutes(entry),
      moodScore: entry.moodScore,
      energyScore: entry.energyScore,
      anxietyScore: entry.anxietyScore
    };
  }

  async repairLogicalDay(date: string, status: DayLifecycleState["status"]): Promise<boolean> {
    const currentDraft = this.getDayRepairInput(date);
    return await this.applyDayRepair({
      ...currentDraft,
      date,
      status
    });
  }

  async applyDayRepair(input: DayRepairInput): Promise<boolean> {
    const normalizedDate = input.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      new Notice("Logical day must use YYYY-MM-DD.");
      return false;
    }

    const parsedDate = new Date(`${normalizedDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || formatDateKey(parsedDate) !== normalizedDate) {
      new Notice("Enter a valid calendar date.");
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
      status: input.status
    };

    const entry = this.getOrCreateEntry(normalizedDate);
    entry.dayStartedAt = dayStartedAt;
    entry.dayEndedAt = dayEndedAt;
    entry.wakeTime = wakeTime;
    entry.sleepTime = sleepTime;
    entry.sleepMinutesOverride = clamp(Math.round(input.sleepMinutesOverride), 0, 1440);
    entry.workMinutesOverride = clamp(Math.round(input.workMinutesOverride), 0, 1440);
    entry.napMinutesOverride = clamp(Math.round(input.napMinutesOverride), 0, 1440);
    entry.relaxMinutesOverride = clamp(Math.round(input.relaxMinutesOverride), 0, 1440);
    entry.breakMinutesOverride = clamp(Math.round(input.breakMinutesOverride), 0, 1440);
    entry.moodScore = clamp(Math.round(input.moodScore), 0, 5);
    entry.energyScore = clamp(Math.round(input.energyScore), 0, 5);
    entry.anxietyScore = clamp(Math.round(input.anxietyScore), 0, 5);

    await this.persistEntry(entry);
    this.refreshDashboardViews();
    new Notice(`Updated repair data for ${normalizedDate}.`);
    return true;
  }

  async startWorkSession(): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting work tracking.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.workSessions.some((session) => session.end === null)) {
      new Notice("A work session is already active.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeCompetingSessions(entry, timestamp, "work");
    entry.workSessions = [...entry.workSessions, { start: timestamp, end: null }];
    await this.persistEntry(entry);
    new Notice("Work session started.");
  }

  async stopWorkSession(): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.workSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No work session is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Work session stopped.");
  }

  async startNapSession(): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting a nap session.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.napSessions.some((session) => session.end === null)) {
      new Notice("A nap session is already active.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeCompetingSessions(entry, timestamp, "nap");
    entry.napSessions = [...entry.napSessions, { start: timestamp, end: null }];
    await this.persistEntry(entry);
    new Notice("Nap started.");
  }

  async stopNapSession(): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.napSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No nap session is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Nap stopped.");
  }

  async startRelaxSession(): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before tracking relaxing time.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.relaxSessions.some((session) => session.end === null)) {
      new Notice("A relaxing session is already active.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeCompetingSessions(entry, timestamp, "relax");
    entry.relaxSessions = [...entry.relaxSessions, { start: timestamp, end: null }];
    await this.persistEntry(entry);
    new Notice("Relaxing started.");
  }

  async stopRelaxSession(): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.relaxSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No relaxing session is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Relaxing stopped.");
  }

  async startBreakSession(): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting a break.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.breakSessions.some((session) => session.end === null)) {
      new Notice("A break is already active.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeCompetingSessions(entry, timestamp, "break");
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null }];
    await this.persistEntry(entry);
    new Notice("Break started.");
  }

  async stopBreakSession(): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.breakSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No break is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Break ended.");
  }

  async updateDailyNotes(value: string): Promise<void> {
    const entry = this.getTodayEntry();
    entry.notes = value.trim();
    await this.persistEntry(entry);
  }

  async resetToday(): Promise<void> {
    const freshEntry = this.createEmptyEntry(this.getTodayKey());
    this.data.entries[freshEntry.date] = freshEntry;
    await this.persistEntry(freshEntry);
  }

  async archiveCompletedTasksFromTodo(): Promise<void> {
    await this.archiveCompletedTasksFromTodoInternal(true);
  }

  async archiveCompletedTasksFromTodoInternal(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const archivedAt = formatDateTimeKey(new Date());
    const archiveResult = reconcileCompletedTasks(content, archivedAt);

    if (archiveResult.archivedTasks.length === 0 && archiveResult.restoredTasks.length === 0) {
      if (showNotice) {
        new Notice("No archive changes were needed.");
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
      const noticeParts: string[] = [];
      if (archiveResult.archivedTasks.length > 0) {
        noticeParts.push(`archived ${archiveResult.archivedTasks.length} task${archiveResult.archivedTasks.length === 1 ? "" : "s"}`);
      }
      if (archiveResult.restoredTasks.length > 0) {
        noticeParts.push(`restored ${archiveResult.restoredTasks.length} task${archiveResult.restoredTasks.length === 1 ? "" : "s"}`);
      }
      new Notice(`Master task hub ${noticeParts.join(" and ")}.`);
    }
  }

  async generateWeeklyReport(): Promise<void> {
    const today = new Date();
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
    new Notice("Weekly dashboard report generated.");
  }

  async generateMonthlyReport(): Promise<void> {
    const today = new Date();
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
    new Notice("Monthly dashboard report generated.");
  }

  async getTodoSnapshot(): Promise<TodoSnapshot | null> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return null;
    }

    const content = await this.app.vault.read(todoFile);
    return parseTodoSnapshot(content);
  }

  async getTodoCategories(): Promise<string[]> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return [];
    }

    const content = await this.app.vault.read(todoFile);
    return findTodoCategoryRanges(content.split(/\r?\n/)).map((category) => category.name);
  }

  async openCreateProjectFlow(): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }

    const categories = await this.getTodoCategories();
    new CreateProjectModal(this.app, this, categories).open();
  }

  async openAddHabitFlow(): Promise<void> {
    new AddHabitModal(this.app, this).open();
  }

  async createProjectAndNote(input: CreateProjectInput): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }

    const projectName = input.projectName.trim();
    const categoryName = input.categoryName.trim();
    if (!projectName || !categoryName) {
      new Notice("Project name and category are required.");
      return;
    }

    const todoContent = await this.app.vault.read(todoFile);
    const existingProject = findProjectRanges(todoContent.split(/\r?\n/))
      .some((project) => project.name.toLowerCase() === projectName.toLowerCase());
    if (existingProject) {
      new Notice(`A project named ${projectName} already exists in the master todo.`);
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
    new Notice(`Created ${projectName} in the master todo and generated its project note.`);
  }

  async createMissingProjectNotesFromTodo(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const projects = extractProjectDefinitionsFromTodo(content);
    if (projects.length === 0) {
      if (showNotice) {
        new Notice("No projects were found in the master task hub.");
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
      new Notice(createdCount > 0
        ? `Created ${createdCount} missing project note${createdCount === 1 ? "" : "s"}.`
        : "All project notes already exist.");
    }
  }

  async addTodayFocusItem(value: string): Promise<void> {
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

  async removeTodayFocusItem(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateFrictionLog(value: string): Promise<void> {
    const entry = this.getTodayEntry();
    entry.frictionLog = value.trim();
    await this.persistEntry(entry);
  }

  async promoteTaskToToday(projectName: string, taskText: string): Promise<void> {
    await this.addTodayFocusItem(`${projectName}: ${taskText}`);
  }

  async addTaskToProject(projectName: string, sectionName: string, taskText: string): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new Notice("Master task hub not found. Set the path in plugin settings.");
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

  async generateWeeklyReview(): Promise<void> {
    const today = new Date();
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
    new Notice("Weekly review note generated.");
  }

  async syncRepeatingProjectTasks(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const projectDefinitions = extractProjectDefinitionsFromTodo(content);
    let updatedContent = content;
    let insertedCount = 0;

    for (const project of projectDefinitions) {
      const notePath = normalizePath(`${stripMarkdownExtension(project.noteLinkPath)}.md`);
      const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
      if (!(abstractFile instanceof TFile)) {
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
      new Notice(insertedCount > 0 ? `Added ${insertedCount} repeating task${insertedCount === 1 ? "" : "s"}.` : "No repeating tasks were due.");
    }
  }

  async offloadProjectReferences(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const result = await offloadReferencesFromMasterHub(content, this.app.vault, this.data.settings.masterTodoPath);
    if (result.updatedContent !== content) {
      await this.app.vault.modify(todoFile, result.updatedContent);
    }

    if (showNotice) {
      new Notice(result.offloadedProjects.length > 0
        ? `Offloaded references for ${result.offloadedProjects.length} project${result.offloadedProjects.length === 1 ? "" : "s"}.`
        : "No project references needed offloading.");
    }
  }

  async showCleanupSuggestions(): Promise<void> {
    const snapshot = await this.getTodoSnapshot();
    const suggestions = snapshot?.cleanupSuggestions ?? [];
    const content = [
      `# Master Task Hub Cleanup Suggestions - ${formatDateKey(new Date())}`,
      "",
      ...(suggestions.length > 0 ? suggestions.map((item) => `- ${item}`) : ["- No cleanup issues detected."]),
      ""
    ].join("\n");
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Cleanup Suggestions/${formatDateKey(new Date())}.md`, content);
    await this.openFile(file);
  }

  async generateAiTodayPlan(): Promise<void> {
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

  async generateAiEndOfDayReview(): Promise<void> {
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

  async generateAiProjectTriage(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Project Triage",
      fileLabel: `AI Project Triage ${formatDateKey(new Date())}`,
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

  async generateAiWeeklyCoachNote(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Weekly Coach",
      fileLabel: `AI Weekly Coach ${formatDateKey(new Date())}`,
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

  async generateAiActiveNoteAnalysis(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!(activeFile instanceof TFile) || !activeFile.path.endsWith(".md")) {
      new Notice("Open a markdown note before using active note analysis.");
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

  async askAiQuestion(question: string): Promise<void> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      new Notice("Enter a question for the AI first.");
      return;
    }

    await this.runAiWorkflow({
      kind: "Vault Question",
      fileLabel: `AI Vault Question ${formatDateKey(new Date())}`,
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

  async openAskAiFlow(): Promise<void> {
    new AskAiModal(this.app, this).open();
  }

  private async runAiWorkflow(input: {
    kind: string;
    fileLabel: string;
    systemPrompt: string;
    userPrompt: string;
    includeMasterTodoRaw: boolean;
    includeActiveNote?: boolean;
    question?: string;
  }): Promise<void> {
    if (!this.data.settings.aiApiKey.trim()) {
      new Notice("Add your OpenAI API key in Daily Dashboard settings before using AI features.");
      return;
    }

    if (this.isAiBusy) {
      new Notice("An AI request is already running.");
      return;
    }

    this.isAiBusy = true;
    this.refreshDashboardViews();

    try {
      await this.ensureAiNoteIndexReady();
      const retrievalQuery = [input.kind, input.userPrompt, input.question ?? ""].filter((item) => item.trim().length > 0).join("\n\n");
      const context = await this.buildAiContext(input.includeMasterTodoRaw, input.question, input.includeActiveNote ?? false, retrievalQuery);
      const rawResponse = await this.requestAiCompletion(input.systemPrompt, `${input.userPrompt}\n\n${context}`);
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
        generatedAt: formatDateTimeKey(new Date()),
        notePath: file.path,
        summary: extractAiSummary(cleanedMarkdown),
        suggestedFocus: payload.suggestedFocus.slice(0, 3)
      };

      this.refreshDashboardViews();
      await this.openFile(file);
      new Notice(`${input.kind} note generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new Notice(`AI request failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }

  private async buildAiContext(includeMasterTodoRaw: boolean, question = "", includeActiveNote = false, retrievalQuery = question): Promise<string> {
    const todayEntry = this.getTodayEntry();
    const allEntries = this.getAllEntries();
    const recentEntries = allEntries.slice(-this.data.settings.aiContextDays);
    const todoSnapshot = await this.getTodoSnapshot();
    const relevantNotes = await this.collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery);
    const recentRange = recentEntries.length > 0
      ? `${recentEntries[0].date} to ${recentEntries[recentEntries.length - 1].date}`
      : "No recent entries";
    const recentReport = recentEntries.length > 0
      ? renderPeriodReport({
          title: "Recent Dashboard Context",
          rangeLabel: recentRange,
          entries: recentEntries,
          habitDefinitions: this.getHabitDefinitions()
        })
      : "No recent dashboard entries available.";

    const masterTodoFile = this.getMasterTodoFile();
    const masterTodoRaw = includeMasterTodoRaw && masterTodoFile
      ? truncateText(await this.app.vault.read(masterTodoFile), 12000)
      : "Master task hub raw content not included for this request.";
    const activeFile = includeActiveNote ? this.app.workspace.getActiveFile() : null;
    const activeNoteSection = activeFile instanceof TFile
      ? `## Active Note\nPath: ${activeFile.path}\n\n${truncateText(await this.app.vault.read(activeFile), 8000)}`
      : "";

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

  private async collectAiRelevantNotes(question: string | undefined, todoSnapshot: TodoSnapshot | null, includeActiveNote: boolean, retrievalQuery: string): Promise<AiRelevantNote[]> {
    if (!this.data.settings.aiIndexEnabled) {
      return [];
    }

    const activeFile = this.app.workspace.getActiveFile();
    const terms = buildAiSearchTerms(question, this.getTodayEntry(), todoSnapshot);
    const activeFilePath = activeFile instanceof TFile ? activeFile.path : "";
    const queryEmbedding = this.data.settings.aiEmbeddingsEnabled && retrievalQuery.trim().length > 0
      ? await this.requestQueryEmbedding(retrievalQuery)
      : null;

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

  private async requestAiCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
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

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }

    if (Array.isArray(content)) {
      const text = content
        .filter((item) => item.type === "text" && typeof item.text === "string")
        .map((item) => item.text ?? "")
        .join("\n")
        .trim();
      if (text.length > 0) {
        return text;
      }
    }

    throw new Error("OpenAI returned an empty response.");
  }

  private async requestQueryEmbedding(text: string): Promise<number[] | null> {
    if (!this.data.settings.aiEmbeddingsEnabled || !this.data.settings.aiApiKey.trim()) {
      return null;
    }

    const embeddings = await this.requestChunkEmbeddings([{ id: "query", text }]);
    return embeddings.get("query") ?? null;
  }

  private async requestChunkEmbeddings(chunks: Array<{ id: string; text: string }>): Promise<Map<string, number[]>> {
    if (!this.data.settings.aiEmbeddingsEnabled) {
      return new Map();
    }

    if (!this.data.settings.aiApiKey.trim()) {
      throw new Error("Add your OpenAI API key before building embeddings.");
    }

    if (chunks.length === 0) {
      return new Map();
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

    const data = await response.json() as {
      data?: Array<{ embedding?: number[]; index?: number }>;
      error?: { message?: string };
    };

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    const result = new Map<string, number[]>();
    data.data?.forEach((item, index) => {
      const vector = Array.isArray(item.embedding)
        ? item.embedding.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        : [];
      if (vector.length > 0) {
        const chunk = chunks[item.index ?? index];
        if (chunk) {
          result.set(chunk.id, vector);
        }
      }
    });

    return result;
  }

  private async createAiOutputNote(input: {
    kind: string;
    fileLabel: string;
    question?: string;
    markdown: string;
    payload: AiStructuredPayload;
  }): Promise<TFile> {
    const dateKey = formatDateKey(new Date());
    const timestamp = formatFileTimestamp(new Date());
    const folder = normalizeFolderPath(`${this.data.settings.aiOutputFolder}/${dateKey}`);
    const basePath = `${folder}/${timestamp} ${sanitizeFileName(input.fileLabel)}.md`;
    const filePath = this.getAvailableMarkdownPath(basePath);
    const content = [
      `# ${input.fileLabel}`,
      "",
      `- Generated: ${formatDateTimeKey(new Date())}`,
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

  async openPromoteTaskFlow(): Promise<void> {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot || snapshot.projects.length === 0) {
      new Notice("No projects found in the master task hub.");
      return;
    }
    new PromoteTaskModal(this.app, this, snapshot.projects).open();
  }

  async openProjectReviewModeFlow(): Promise<void> {
    const options = await this.getProjectReviewOptions();
    if (options.length === 0) {
      new Notice("No project notes found for review mode.");
      return;
    }
    new ProjectReviewModal(this.app, this, options).open();
  }

  async openProjectReviewMode(option: ProjectReviewOption): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof TFile) || !todoFile) {
      new Notice("Could not open project review mode for that project.");
      return;
    }

    const leftLeaf = this.app.workspace.getLeaf(true);
    await leftLeaf.openFile(todoFile);
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(noteFile);
    this.app.workspace.revealLeaf(rightLeaf);
  }

  async openAiArtifact(artifact: AiArtifact): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(artifact.notePath));
    if (!(file instanceof TFile)) {
      new Notice("That AI note could not be found in the vault.");
      return;
    }

    await this.openFile(file);
  }

  async getProjectReviewOptions(): Promise<ProjectReviewOption[]> {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      return [];
    }

    return snapshot.projects
      .map((project) => ({
        projectName: project.name,
        notePath: `${project.noteLinks[0] ? stripMarkdownExtension(project.noteLinks[0]) : `${this.data.settings.projectNotesFolder}/${project.name}`}.md`
      }))
      .filter((project) => this.app.vault.getAbstractFileByPath(normalizePath(project.notePath)) instanceof TFile);
  }

  getHabitStreak(habitId: string): number {
    const habitDefinition = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habitDefinition) {
      return 0;
    }

    const dates = Object.keys(this.data.entries).sort().reverse();
    let streak = 0;

    for (const date of dates) {
      const entry = this.data.entries[date];
      const value = entry.habits[habitId] ?? 0;
      if (value >= habitDefinition.target) {
        streak += 1;
        continue;
      }

      break;
    }

    return streak;
  }

  refreshDashboardViews(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DailyDashboardView) {
        void view.render();
      }
    });
  }

  async openMasterTodo(): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }

    await this.openFile(todoFile);
  }

  private getMasterTodoFile(): TFile | null {
    const target = this.app.vault.getAbstractFileByPath(normalizePath(this.data.settings.masterTodoPath));
    return target instanceof TFile ? target : null;
  }

  private async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }

  private async createProjectNote(input: CreateProjectInput): Promise<TFile> {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    if (noteFolder) {
      await this.ensureFolder(noteFolder);
    }

    const basePath = this.getPreferredProjectNotePath(input.projectName.trim());
    const uniquePath = this.getAvailableMarkdownPath(basePath);
    return await this.app.vault.create(uniquePath, renderProjectNoteTemplate(input, this.data.settings.masterTodoPath));
  }

  private getPreferredProjectNotePath(projectName: string): string {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    const safeProjectName = sanitizeFileName(projectName.trim());
    return noteFolder ? `${noteFolder}/${safeProjectName}.md` : `${safeProjectName}.md`;
  }

  private getAvailableMarkdownPath(basePath: string): string {
    const normalizedBasePath = normalizePath(basePath);
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

  private getNextLogicalDayKey(referenceDate: Date): string {
    return formatDateKey(referenceDate);
  }

  private hydratePluginData(loaded: Partial<DashboardPluginData> | null | undefined): DashboardPluginData {
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      ...(loaded?.settings ?? {})
    });

    const rawEntries = loaded?.entries ?? {};
    const entries: Record<string, DailyEntry> = {};
    Object.entries(rawEntries).forEach(([date, entry]) => {
      entries[date] = this.normalizeEntry(entry as Partial<DailyEntry>, date, settings);
    });

    const dayState = normalizeDayState(loaded?.dayState, entries);

    return {
      settings,
      entries,
      dayState,
      noteIndex: normalizeNoteIndexCache(loaded?.noteIndex)
    };
  }

  private async loadPluginData(): Promise<void> {
    this.data = await this.buildDataFromStorage();
  }

  private normalizeEntry(
    entry: Partial<DailyEntry> | undefined,
    date: string,
    settings: DashboardSettings = this.data.settings
  ): DailyEntry {
    const baseEntry = createEmptyEntry(date, settings.habitDefinitions);

    if (!entry) {
      return baseEntry;
    }

    const normalizedHabits: Record<string, number> = {};
    const normalizedHabitEvents: Record<string, string[]> = {};
    settings.habitDefinitions.forEach((habit) => {
      const rawEvents = Array.isArray(entry.habitEvents?.[habit.id])
        ? entry.habitEvents?.[habit.id]?.filter((item): item is string => typeof item === "string" && item.trim().length > 0) ?? []
        : [];
      const normalizedCount = clamp(Number(entry.habits?.[habit.id] ?? rawEvents.length), 0, habit.target);
      normalizedHabits[habit.id] = normalizedCount;
      normalizedHabitEvents[habit.id] = rawEvents.slice(0, normalizedCount);
    });

    return {
      date,
      lastEditedAt: getEntryRecencyKey(entry),
      dayStartedAt: typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
      dayEndedAt: typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
      wakeTime: typeof entry.wakeTime === "string" ? entry.wakeTime : "",
      sleepTime: typeof entry.sleepTime === "string" ? entry.sleepTime : "",
      sleepMinutesOverride: Number.isFinite(Number(entry.sleepMinutesOverride)) ? clamp(Number(entry.sleepMinutesOverride), 0, 1440) : null,
      habits: normalizedHabits,
      habitEvents: normalizedHabitEvents,
      moodScore: clamp(Number(entry.moodScore ?? 0), 0, 5),
      energyScore: clamp(Number(entry.energyScore ?? 0), 0, 5),
      anxietyScore: clamp(Number(entry.anxietyScore ?? 0), 0, 5),
      todayFocus: Array.isArray(entry.todayFocus)
        ? entry.todayFocus.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
        : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(normalizedHabits, settings.habitDefinitions),
      foodLog: Array.isArray(entry.foodLog)
        ? entry.foodLog
            .map((item) => normalizeFoodEntry(item))
            .filter((item): item is FoodEntry => item !== null)
        : [],
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      dreamLog: typeof entry.dreamLog === "string" ? entry.dreamLog : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions)
        ? entry.workSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
      workMinutesOverride: Number.isFinite(Number(entry.workMinutesOverride)) ? clamp(Number(entry.workMinutesOverride), 0, 1440) : null,
      napSessions: Array.isArray(entry.napSessions)
        ? entry.napSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
      napMinutesOverride: Number.isFinite(Number(entry.napMinutesOverride)) ? clamp(Number(entry.napMinutesOverride), 0, 1440) : null,
      relaxSessions: Array.isArray(entry.relaxSessions)
        ? entry.relaxSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
      relaxMinutesOverride: Number.isFinite(Number(entry.relaxMinutesOverride)) ? clamp(Number(entry.relaxMinutesOverride), 0, 1440) : null,
      breakSessions: Array.isArray(entry.breakSessions)
        ? entry.breakSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
      breakMinutesOverride: Number.isFinite(Number(entry.breakMinutesOverride)) ? clamp(Number(entry.breakMinutesOverride), 0, 1440) : null,
      completedTasks: Array.isArray(entry.completedTasks)
        ? entry.completedTasks
            .filter((item): item is ArchivedTaskSnapshot => Boolean(item && typeof item === "object"))
            .map((item) => ({
              project: typeof item.project === "string" ? item.project : "Unknown Project",
              section: typeof item.section === "string" ? item.section : "General",
              text: typeof item.text === "string" ? item.text : "",
              archivedAt: typeof item.archivedAt === "string" ? item.archivedAt : date,
              note: typeof item.note === "string" ? item.note : ""
            }))
            .filter((item) => item.text.trim().length > 0)
        : []
    };
  }

  private getOrCreateEntry(date: string): DailyEntry {
    if (!this.data.entries[date]) {
      this.data.entries[date] = this.createEmptyEntry(date);
    }

    return this.data.entries[date];
  }

  private getEffectiveTrackedEntry(entry: DailyEntry): DailyEntry {
    if (this.data.dayState.status !== "in-progress" || entry.date !== this.data.dayState.activeDate) {
      return entry;
    }

    return {
      ...entry,
      workMinutesOverride: null,
      napMinutesOverride: null,
      relaxMinutesOverride: null,
      breakMinutesOverride: null
    };
  }

  private clearLiveSessionOverrides(entry: DailyEntry): void {
    if (this.data.dayState.status !== "in-progress" || entry.date !== this.data.dayState.activeDate) {
      return;
    }

    entry.workMinutesOverride = null;
    entry.napMinutesOverride = null;
    entry.relaxMinutesOverride = null;
    entry.breakMinutesOverride = null;
  }

  private createEmptyEntry(date: string): DailyEntry {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }

  private closeCompetingSessions(entry: DailyEntry, timestamp: string, keepOpen: "work" | "nap" | "relax" | "break"): void {
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
  }

  private getPreviousEntry(date: string): DailyEntry | undefined {
    const dates = Object.keys(this.data.entries).filter((entryDate) => entryDate < date).sort();
    const previousDate = dates.slice(-1)[0];
    return previousDate ? this.data.entries[previousDate] : undefined;
  }

  private normalizeRepairTimestamp(value: string, label: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    const parsed = new Date(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T"));
    if (Number.isNaN(parsed.getTime())) {
      new Notice(`${label} must be a valid date and time.`);
      return null;
    }

    return formatDateTimeKey(parsed);
  }

  private async removeArchivedTaskSnapshots(tasks: ArchivedTaskSnapshot[]): Promise<void> {
    const updatedDates = new Set<string>();

    tasks.forEach((task) => {
      const dateKey = task.archivedAt.slice(0, 10);
      const entry = this.data.entries[dateKey];
      if (!entry) {
        return;
      }

      const index = entry.completedTasks.findIndex((candidate) => candidate.project === task.project
        && candidate.section === task.section
        && candidate.text === task.text
        && candidate.archivedAt === task.archivedAt);
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

  private getDailyLogPath(date: string, settings: DashboardSettings = this.data.settings): string {
    return normalizePath(`${normalizeFolderPath(settings.dailyLogFolder)}/${date}.md`);
  }

  private isDailyLogPath(path: string, settings: DashboardSettings = this.data.settings): boolean {
    const normalizedPath = normalizePath(path);
    const dailyLogFolder = normalizeFolderPath(settings.dailyLogFolder);
    return dailyLogFolder.length > 0
      && normalizedPath.startsWith(`${dailyLogFolder}/`)
      && normalizedPath.endsWith(".md");
  }

  private async loadDailyEntriesFromVault(settings: DashboardSettings): Promise<Record<string, DailyEntry>> {
    const entries: Record<string, DailyEntry> = {};

    const dailyLogFolder = normalizeFolderPath(settings.dailyLogFolder);
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      const normalizedPath = normalizePath(file.path);
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

  private async reloadDailyLogFile(file: TFile): Promise<void> {
    const normalizedPath = normalizePath(file.path);
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
    this.clearLiveSessionOverrides(normalizedEntry);
    this.data.entries[parsed.date] = normalizedEntry;
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  private removeDailyLogEntry(path: string): void {
    if (!this.isDailyLogPath(path)) {
      return;
    }

    const date = path.split("/").pop()?.replace(/\.md$/i, "") ?? "";
    if (!date || !this.data.entries[date]) {
      return;
    }

    delete this.data.entries[date];
    void this.savePluginData();
    this.refreshDashboardViews();
  }

  private async buildDataFromStorage(): Promise<DashboardPluginData> {
    const loaded = (await this.loadData()) as Partial<DashboardPluginData> | null;
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

  private scheduleNoteIndexRefresh(): void {
    if (!this.data.settings.aiIndexEnabled) {
      return;
    }

    if (this.noteIndexDebounceId !== null) {
      window.clearTimeout(this.noteIndexDebounceId);
    }

    this.noteIndexDebounceId = window.setTimeout(() => {
      this.noteIndexDebounceId = null;
      void this.rebuildAiNoteIndex(false);
    }, 2000);
  }

  async rebuildAiNoteIndex(showNotice: boolean): Promise<void> {
    if (!this.data.settings.aiIndexEnabled) {
      if (showNotice) {
        new Notice("AI note indexing is disabled in settings.");
      }
      return;
    }

    if (this.isIndexingNotes) {
      if (showNotice) {
        new Notice("AI note indexing is already in progress.");
      }
      return;
    }

    this.isIndexingNotes = true;
    this.refreshDashboardViews();

    try {
      const allFiles = this.app.vault.getMarkdownFiles();
      const nextEntries: Record<string, NoteIndexEntry> = {};
      const chunksForEmbedding: Array<{ path: string; chunkId: string; text: string }> = [];

      for (const file of allFiles) {
        if (!shouldIndexFilePath(file.path, this.data.settings)) {
          continue;
        }

        const content = await this.app.vault.read(file);
        const entry = buildNoteIndexEntry(file, content, this.data.settings.aiChunkCharLimit);
        nextEntries[normalizePath(file.path)] = entry;
        entry.chunks.forEach((chunk) => {
          chunksForEmbedding.push({
            path: entry.path,
            chunkId: chunk.id,
            text: `${chunk.heading ? `${chunk.heading}\n` : ""}${chunk.text}`
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
        indexedAt: formatDateTimeKey(new Date()),
        lastIndexedFile: Object.keys(nextEntries).sort().slice(-1)[0] ?? "",
        entries: nextEntries
      };

      await this.persistNoteIndex();
      this.refreshDashboardViews();

      if (showNotice) {
        const embeddedChunkCount = Object.values(nextEntries).reduce((sum, entry) => sum + entry.chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length, 0);
        new Notice(`Indexed ${Object.keys(nextEntries).length} markdown note${Object.keys(nextEntries).length === 1 ? "" : "s"} for AI retrieval${this.data.settings.aiEmbeddingsEnabled ? ` with ${embeddedChunkCount} embedded chunk${embeddedChunkCount === 1 ? "" : "s"}` : ""}.`);
      }
    } finally {
      this.isIndexingNotes = false;
      this.refreshDashboardViews();
    }
  }

  private async ensureAiNoteIndexReady(): Promise<void> {
    if (!this.data.settings.aiIndexEnabled) {
      return;
    }

    if (Object.keys(this.data.noteIndex.entries).length > 0) {
      return;
    }

    await this.rebuildAiNoteIndex(false);
  }

  private async savePluginData(): Promise<void> {
    await this.saveData({
      settings: this.data.settings,
      entries: this.data.entries,
      dayState: this.data.dayState,
      noteIndex: this.data.noteIndex
    });
  }

  private async persistNoteIndex(): Promise<void> {
    await this.saveData({
      settings: this.data.settings,
      noteIndex: this.data.noteIndex
    });
  }

  private async persistEntry(entry: DailyEntry): Promise<void> {
    this.clearLiveSessionOverrides(entry);
    this.data.entries[entry.date] = this.normalizeEntry({
      ...entry,
      lastEditedAt: formatPreciseDateTimeKey(new Date())
    }, entry.date);
    await this.syncDailyLog(this.data.entries[entry.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  private async backfillDailyLogsFromEntries(): Promise<void> {
    const dates = Object.keys(this.data.entries).sort();
    for (const date of dates) {
      await this.syncDailyLog(this.data.entries[date]);
    }
  }

  private async ensureTodayEntry(): Promise<void> {
    const today = this.getTodayKey();
    const exists = Boolean(this.data.entries[today]);
    const entry = this.getOrCreateEntry(today);

    if (!exists) {
      await this.persistEntry(entry);
      return;
    }

    await this.syncDailyLog(entry);
  }

  private async refreshForNewDay(): Promise<void> {
    if (this.data.dayState.status === "not-started") {
      const calendarKey = formatDateKey(new Date());
      if (calendarKey !== this.data.dayState.activeDate) {
        this.data.dayState.activeDate = calendarKey;
        await this.savePluginData();
        this.refreshDashboardViews();
      }
    }

    await this.ensureTodayEntry();

    if (this.data.dayState.status === "in-progress") {
      const calendarKey = formatDateKey(new Date());
      if (calendarKey !== this.data.dayState.activeDate) {
        this.refreshDashboardViews();
      }
    }
  }

  private scheduleAutomaticTodoArchive(): void {
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

  private getEntriesInRange(start: Date, end: Date): DailyEntry[] {
    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);

    return Object.keys(this.data.entries)
      .filter((date) => date >= startKey && date <= endKey)
      .sort()
      .map((date) => this.data.entries[date]);
  }

  private async syncDailyLog(entry: DailyEntry): Promise<void> {
    const content = renderDailyLog(entry, this.getHabitDefinitions());
    await this.upsertMarkdownFile(`${this.data.settings.dailyLogFolder}/${entry.date}.md`, content);
  }

  private async upsertMarkdownFile(path: string, content: string): Promise<TFile> {
    return this.upsertTextFile(path, content);
  }

  private async upsertTextFile(path: string, content: string): Promise<TFile> {
    const normalizedPath = normalizePath(path);
    const directory = normalizedPath.includes("/")
      ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
      : "";

    if (directory) {
      await this.ensureFolder(directory);
    }

    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof TFile) {
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

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalizedPath = normalizePath(folderPath);
    if (!normalizedPath) {
      return;
    }

    const parts = normalizedPath.split("/");
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (existing && !(existing instanceof TFolder)) {
        throw new Error(`Path conflict at ${currentPath}: a file exists where the plugin expects a folder.`);
      }

      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  private async refreshWallpaperOptions(): Promise<void> {
    this.wallpaperOptions = await this.loadWallpaperOptions();
  }

  private async loadWallpaperOptions(): Promise<WallpaperOption[]> {
    const adapter = this.app.vault.adapter;
    const candidateFolders = this.getWallpaperFolderCandidates();
    const seenPaths = new Set<string>();
    const options: WallpaperOption[] = [];

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
        const normalizedFilePath = normalizePath(filePath);
        const extension = normalizedFilePath.split(".").pop()?.toLowerCase() ?? "";
        if (!IMAGE_EXTENSIONS.has(extension) || seenPaths.has(normalizedFilePath)) {
          return;
        }

        seenPaths.add(normalizedFilePath);
        options.push({
          path: normalizedFilePath,
          displayName: normalizedFilePath.split("/").pop() ?? normalizedFilePath,
          url: adapter.getResourcePath(normalizedFilePath)
        });
      });
    }

    options.sort((left, right) => left.displayName.localeCompare(right.displayName));
    return options;
  }

  private getWallpaperFolderCandidates(): string[] {
    const configuredFolder = normalizeFolderPath(this.data.settings.wallpaperFolder);
    const pluginDir = normalizeFolderPath(this.manifest.dir ?? "");
    const candidates = new Set<string>();

    if (!configuredFolder) {
      if (pluginDir) {
        candidates.add(pluginDir);
      }
    } else {
      candidates.add(configuredFolder);
      if (pluginDir) {
        const pluginRelativeFolder = configuredFolder.toLowerCase().startsWith(pluginDir.toLowerCase())
          ? configuredFolder
          : normalizeFolderPath(`${pluginDir}/${configuredFolder}`);
        candidates.add(pluginRelativeFolder);
      }
    }

    return Array.from(candidates);
  }
}
