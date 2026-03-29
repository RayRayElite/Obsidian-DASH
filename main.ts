import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
  TFile,
  Vault,
  WorkspaceLeaf,
  normalizePath
} from "obsidian";

const VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
const CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
const PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
const SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
const PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
const NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);

interface HabitDefinition {
  id: string;
  label: string;
  target: number;
}

interface ArchivedTaskSnapshot {
  project: string;
  section: string;
  text: string;
  archivedAt: string;
  note?: string;
}

interface WorkSession {
  start: string;
  end: string | null;
}

interface DailyEntry {
  date: string;
  dayStartedAt: string;
  dayEndedAt: string;
  wakeTime: string;
  sleepTime: string;
  habits: Record<string, number>;
  moodScore: number;
  energyScore: number;
  todayFocus: string[];
  frictionLog: string;
  missedHabits: string[];
  foodLog: string[];
  sleepLog: string;
  notes: string;
  workSessions: WorkSession[];
  napSessions: WorkSession[];
  completedTasks: ArchivedTaskSnapshot[];
}

interface DayLifecycleState {
  activeDate: string;
  status: "not-started" | "in-progress" | "ended";
}

interface DashboardSettings {
  dashboardTitle: string;
  masterTodoPath: string;
  projectNotesFolder: string;
  dailyLogFolder: string;
  weeklyReportFolder: string;
  monthlyReportFolder: string;
  liveStatePath: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiOutputFolder: string;
  aiContextDays: number;
  wallpaperFolder: string;
  selectedWallpaper: string;
  habitDefinitions: HabitDefinition[];
}

interface CreateProjectInput {
  projectName: string;
  categoryName: string;
  status: string;
  focus: string;
  addTasks: string[];
  fixTasks: string[];
}

interface ExistingProjectDefinition {
  projectName: string;
  categoryName: string;
  status: string;
  focus: string;
  addTasks: string[];
  fixTasks: string[];
  noteLinkPath: string;
}

interface DashboardPluginData {
  settings: DashboardSettings;
  entries: Record<string, DailyEntry>;
  dayState: DayLifecycleState;
}

interface WallpaperOption {
  path: string;
  displayName: string;
  url: string;
}

interface TodoProjectRange {
  name: string;
  start: number;
  end: number;
}

interface TodoProjectSummary {
  name: string;
  categoryName: string;
  openCount: number;
  archivedCount: number;
  completionRate: number;
  focus: string;
  noteLinks: string[];
  nowTasks: string[];
  nextTasks: string[];
  laterTasks: string[];
  dueRepeatingTasks: string[];
  breakdownTasks: string[];
  duplicateTasks: string[];
  emptySections: string[];
  lastCompletedAt: string | null;
  staleDays: number | null;
  completionsThisWeek: number;
  completionsPreviousWeek: number;
  completionsThisMonth: number;
  trend: "up" | "down" | "flat";
  healthScore: number;
  healthLabel: string;
  relationships: string[];
}

interface TodoSnapshot {
  totalOpen: number;
  totalArchived: number;
  projects: TodoProjectSummary[];
  staleProjects: TodoProjectSummary[];
  breakdownCandidates: Array<{ project: string; task: string }>;
  cleanupSuggestions: string[];
}

interface WorkLogFilters {
  project: string;
  keyword: string;
  fromDate: string;
  toDate: string;
}

interface QuickAddState {
  projectName: string;
  sectionName: string;
  taskText: string;
}

interface ProjectReviewOption {
  projectName: string;
  notePath: string;
}

type DashboardTone = "focus" | "state" | "capture" | "log" | "health" | "alert" | "done" | "neutral";

interface CardVisualOptions {
  icon: string;
  eyebrow: string;
  tone: DashboardTone;
  tag?: string;
}

interface RepeatingTaskDefinition {
  text: string;
  cadence: string;
}

interface WeeklyReviewInput {
  label: string;
  start: Date;
  end: Date;
  entries: DailyEntry[];
  todoSnapshot: TodoSnapshot | null;
  habits: HabitDefinition[];
}

interface ReferenceOffloadResult {
  updatedContent: string;
  offloadedProjects: string[];
}

interface ArchiveResult {
  content: string;
  archivedTasks: ArchivedTaskSnapshot[];
}

interface LiveDayStateSnapshot {
  updatedAt: string;
  dayState: DayLifecycleState;
  entry: Pick<DailyEntry, "date" | "dayStartedAt" | "dayEndedAt" | "wakeTime" | "sleepTime" | "workSessions" | "napSessions">;
}

interface DashboardSyncStatus {
  lastCheckAt: string;
  lastAppliedAt: string;
  lastWriteAt: string;
  lastSource: string;
  liveStatePath: string;
  liveStateAvailable: boolean;
}

interface AiStructuredPayload {
  suggestedFocus: string[];
  nextActions: string[];
  keyRisks: string[];
  followUpQuestions: string[];
}

interface AiArtifact {
  kind: string;
  title: string;
  generatedAt: string;
  notePath: string;
  summary: string;
  suggestedFocus: string[];
}

interface AiStatus {
  configured: boolean;
  busy: boolean;
  model: string;
  outputFolder: string;
  latestArtifact: AiArtifact | null;
}

const DEFAULT_SETTINGS: DashboardSettings = {
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

export default class DailyDashboardPlugin extends Plugin {
  private data: DashboardPluginData = {
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    dayState: {
      activeDate: formatDateKey(new Date()),
      status: "not-started"
    }
  };
  private wallpaperOptions: WallpaperOption[] = [];
  private autoArchiveDebounceId: number | null = null;
  private isAutoArchivingTodo = false;
  private lastSyncCheckAt = "";
  private lastSyncAppliedAt = "";
  private lastLiveStateWriteAt = "";
  private lastSyncSource = "Startup";
  private liveStateAvailable = false;
  private latestAiArtifact: AiArtifact | null = null;
  private isAiBusy = false;

  async onload(): Promise<void> {
    await this.loadPluginData();
    await this.ensureTodayEntry();
    await this.syncLiveStateNote();
    await this.refreshWallpaperOptions();

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

      if (normalizedPath === normalizePath(this.data.settings.liveStatePath)) {
        void this.refreshFromStorageIfChanged();
      }
    }));

    this.registerInterval(window.setInterval(() => {
      void this.refreshForNewDay();
    }, 60_000));

    this.registerInterval(window.setInterval(() => {
      void this.refreshFromStorageIfChanged();
    }, 15_000));
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

  getTrackedWorkMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedWorkMinutes(entry);
  }

  getTrackedNapMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedMinutes(entry.napSessions);
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

  getSyncStatus(): DashboardSyncStatus {
    return {
      lastCheckAt: this.lastSyncCheckAt,
      lastAppliedAt: this.lastSyncAppliedAt,
      lastWriteAt: this.lastLiveStateWriteAt,
      lastSource: this.lastSyncSource,
      liveStatePath: this.data.settings.liveStatePath,
      liveStateAvailable: this.liveStateAvailable
    };
  }

  getAiStatus(): AiStatus {
    return {
      configured: this.data.settings.aiApiKey.trim().length > 0,
      busy: this.isAiBusy,
      model: this.data.settings.aiModel,
      outputFolder: this.data.settings.aiOutputFolder,
      latestArtifact: this.latestAiArtifact
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
    await this.refreshDataFromStorage(false);
    this.data.settings = sanitizeSettings(settings);
    await this.refreshWallpaperOptions();

    for (const date of Object.keys(this.data.entries)) {
      this.data.entries[date] = this.normalizeEntry(this.data.entries[date], date);
      await this.syncDailyLog(this.data.entries[date]);
    }

    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async updateMoodScore(value: number): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.moodScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }

  async updateEnergyScore(value: number): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.energyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }

  async updateHabitValue(habitId: string, value: number): Promise<void> {
    await this.refreshDataFromStorage(false);
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }

    const entry = this.getTodayEntry();
    entry.habits[habitId] = clamp(value, 0, definition.target);
    await this.persistEntry(entry);
  }

  async addFoodEntry(value: string): Promise<void> {
    await this.refreshDataFromStorage(false);
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    const entry = this.getTodayEntry();
    entry.foodLog = [trimmedValue, ...entry.foodLog];
    await this.persistEntry(entry);
  }

  async removeFoodEntry(index: number): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.foodLog = entry.foodLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateSleepLog(value: string): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.sleepLog = value.trim();
    await this.persistEntry(entry);
  }

  async beginLogicalDay(): Promise<void> {
    await this.refreshDataFromStorage(false);
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
    new Notice(`Began logical day ${nextDate}.`);
  }

  async endLogicalDay(): Promise<void> {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new Notice("No logical day is currently in progress. If you started it on another device, wait for sync to finish and try again.");
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
    this.data.dayState = {
      activeDate: entry.date,
      status: "ended"
    };
    await this.persistEntry(entry);
    await this.savePluginData();
    new Notice(`Ended logical day ${entry.date}.`);
  }

  async startWorkSession(): Promise<void> {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting work tracking.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.workSessions.some((session) => session.end === null)) {
      new Notice("A work session is already active.");
      return;
    }

    entry.workSessions = [...entry.workSessions, { start: formatDateTimeKey(new Date()), end: null }];
    await this.persistEntry(entry);
    new Notice("Work session started.");
  }

  async stopWorkSession(): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    const activeSession = [...entry.workSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No work session is currently active. If you started it on another device, wait for sync to finish and try again.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Work session stopped.");
  }

  async startNapSession(): Promise<void> {
    await this.refreshDataFromStorage(false);
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting a nap session.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.napSessions.some((session) => session.end === null)) {
      new Notice("A nap session is already active.");
      return;
    }

    entry.napSessions = [...entry.napSessions, { start: formatDateTimeKey(new Date()), end: null }];
    await this.persistEntry(entry);
    new Notice("Nap started.");
  }

  async stopNapSession(): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    const activeSession = [...entry.napSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No nap session is currently active. If you started it on another device, wait for sync to finish and try again.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Nap stopped.");
  }

  async updateDailyNotes(value: string): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.notes = value.trim();
    await this.persistEntry(entry);
  }

  async resetToday(): Promise<void> {
    await this.refreshDataFromStorage(false);
    const freshEntry = this.createEmptyEntry(this.getTodayKey());
    this.data.entries[freshEntry.date] = freshEntry;
    await this.persistEntry(freshEntry);
  }

  async archiveCompletedTasksFromTodo(): Promise<void> {
    await this.archiveCompletedTasksFromTodoInternal(true);
  }

  async archiveCompletedTasksFromTodoInternal(showNotice: boolean): Promise<void> {
    await this.refreshDataFromStorage(false);
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const archivedAt = formatDateTimeKey(new Date());
    const archiveResult = archiveCompletedTasks(content, archivedAt);

    if (archiveResult.archivedTasks.length === 0) {
      if (showNotice) {
        new Notice("No completed checklist items were found to archive.");
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
      new Notice(`Archived ${archiveResult.archivedTasks.length} completed task${archiveResult.archivedTasks.length === 1 ? "" : "s"}.`);
    }
  }

  async generateWeeklyReport(): Promise<void> {
    await this.refreshDataFromStorage(false);
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
    await this.refreshDataFromStorage(false);
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

  async removeTodayFocusItem(index: number): Promise<void> {
    await this.refreshDataFromStorage(false);
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateFrictionLog(value: string): Promise<void> {
    await this.refreshDataFromStorage(false);
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
    await this.refreshDataFromStorage(false);
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

    await this.refreshDataFromStorage(false);
    this.isAiBusy = true;
    this.refreshDashboardViews();

    try {
      const context = await this.buildAiContext(input.includeMasterTodoRaw, input.question);
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

  private async buildAiContext(includeMasterTodoRaw: boolean, question?: string): Promise<string> {
    const todayEntry = this.getTodayEntry();
    const allEntries = this.getAllEntries();
    const recentEntries = allEntries.slice(-this.data.settings.aiContextDays);
    const todoSnapshot = await this.getTodoSnapshot();
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

    return [
      `Current logical day: ${this.data.dayState.activeDate} (${this.data.dayState.status})`,
      question ? `User question: ${question}` : "",
      "## Today Entry",
      renderDailyLog(todayEntry, this.getHabitDefinitions()),
      "",
      "## Recent Report",
      recentReport,
      "",
      "## Master Task Hub Snapshot",
      renderTodoSnapshotForAi(todoSnapshot),
      "",
      "## Master Task Hub Raw Excerpt",
      masterTodoRaw
    ].filter((section) => section.trim().length > 0).join("\n\n");
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
    const calendarKey = formatDateKey(referenceDate);
    if (this.data.dayState.status === "not-started") {
      return calendarKey;
    }

    const current = this.data.dayState.activeDate || calendarKey;
    const next = new Date(`${current}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const nextKey = formatDateKey(next);
    return nextKey > calendarKey ? nextKey : calendarKey;
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
      dayState
    };
  }

  private async loadPluginData(): Promise<void> {
    const loaded = await this.buildDataFromStorage();
    this.data = loaded.data;
    this.liveStateAvailable = loaded.liveStateAvailable;
    this.lastSyncCheckAt = formatDateTimeKey(new Date());
    this.lastSyncAppliedAt = this.lastSyncCheckAt;
    this.lastSyncSource = loaded.source;
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
    settings.habitDefinitions.forEach((habit) => {
      normalizedHabits[habit.id] = clamp(Number(entry.habits?.[habit.id] ?? 0), 0, habit.target);
    });

    return {
      date,
      dayStartedAt: typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
      dayEndedAt: typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
      wakeTime: typeof entry.wakeTime === "string" ? entry.wakeTime : "",
      sleepTime: typeof entry.sleepTime === "string" ? entry.sleepTime : "",
      habits: normalizedHabits,
      moodScore: clamp(Number(entry.moodScore ?? 0), 0, 5),
      energyScore: clamp(Number(entry.energyScore ?? 0), 0, 5),
      todayFocus: Array.isArray(entry.todayFocus)
        ? entry.todayFocus.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
        : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(normalizedHabits, settings.habitDefinitions),
      foodLog: Array.isArray(entry.foodLog)
        ? entry.foodLog.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions)
        ? entry.workSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
      napSessions: Array.isArray(entry.napSessions)
        ? entry.napSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null
            }))
        : [],
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

  private createEmptyEntry(date: string): DailyEntry {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }

  private getLiveStateEntryDate(data: DashboardPluginData): string {
    return data.dayState.activeDate || Object.keys(data.entries).sort().slice(-1)[0] || formatDateKey(new Date());
  }

  private createLiveStateSnapshot(data: DashboardPluginData = this.data): LiveDayStateSnapshot {
    const date = this.getLiveStateEntryDate(data);
    const baseEntry = data.entries[date] ?? createEmptyEntry(date, data.settings.habitDefinitions);

    return {
      updatedAt: formatDateTimeKey(new Date()),
      dayState: normalizeDayState(data.dayState, data.entries),
      entry: {
        date,
        dayStartedAt: baseEntry.dayStartedAt,
        dayEndedAt: baseEntry.dayEndedAt,
        wakeTime: baseEntry.wakeTime,
        sleepTime: baseEntry.sleepTime,
        workSessions: baseEntry.workSessions.map((session) => ({ ...session })),
        napSessions: baseEntry.napSessions.map((session) => ({ ...session }))
      }
    };
  }

  private async loadLiveStateSnapshotFromVault(path: string): Promise<LiveDayStateSnapshot | null> {
    const target = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(target instanceof TFile)) {
      return null;
    }

    const content = await this.app.vault.read(target);
    return parseLiveDayStateNote(content);
  }

  private applyLiveStateSnapshot(data: DashboardPluginData, snapshot: LiveDayStateSnapshot): DashboardPluginData {
    const date = snapshot.entry.date || snapshot.dayState.activeDate || this.getLiveStateEntryDate(data);
    const baseEntry = data.entries[date] ?? createEmptyEntry(date, data.settings.habitDefinitions);
    const mergedEntry = this.normalizeEntry({
      ...baseEntry,
      date,
      dayStartedAt: snapshot.entry.dayStartedAt,
      dayEndedAt: snapshot.entry.dayEndedAt,
      wakeTime: snapshot.entry.wakeTime,
      sleepTime: snapshot.entry.sleepTime,
      workSessions: snapshot.entry.workSessions,
      napSessions: snapshot.entry.napSessions
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

  private async buildDataFromStorage(): Promise<{ data: DashboardPluginData; source: string; liveStateAvailable: boolean }> {
    const loaded = (await this.loadData()) as Partial<DashboardPluginData> | null;
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

  private getDataSignature(data: DashboardPluginData = this.data): string {
    const orderedEntries = Object.keys(data.entries)
      .sort()
      .reduce<Record<string, DailyEntry>>((result, date) => {
        result[date] = data.entries[date];
        return result;
      }, {});

    return JSON.stringify({
      settings: data.settings,
      entries: orderedEntries,
      dayState: data.dayState
    });
  }

  private async refreshDataFromStorage(refreshViews: boolean): Promise<boolean> {
    const loaded = await this.buildDataFromStorage();
    const hydrated = loaded.data;
    this.lastSyncCheckAt = formatDateTimeKey(new Date());
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

  private async refreshFromStorageIfChanged(): Promise<void> {
    await this.refreshDataFromStorage(true);
  }

  async refreshSyncedStateManually(): Promise<void> {
    const changed = await this.refreshDataFromStorage(true);
    new Notice(changed
      ? `Refreshed dashboard state from ${this.lastSyncSource.toLowerCase()}.`
      : `Dashboard state is already current. Last check: ${this.lastSyncCheckAt || "just now"}.`);
  }

  private async syncLiveStateNote(): Promise<void> {
    const content = renderLiveDayStateNote(this.createLiveStateSnapshot());
    await this.upsertMarkdownFile(this.data.settings.liveStatePath, content);
    this.lastLiveStateWriteAt = formatDateTimeKey(new Date());
    this.liveStateAvailable = true;
  }

  private async savePluginData(): Promise<void> {
    await this.saveData({
      ...this.data,
      dayState: normalizeDayState(this.data.dayState, this.data.entries)
    });
    await this.syncLiveStateNote();
  }

  private async persistEntry(entry: DailyEntry): Promise<void> {
    this.data.entries[entry.date] = this.normalizeEntry(entry, entry.date);
    await this.savePluginData();
    await this.syncDailyLog(this.data.entries[entry.date]);
    this.refreshDashboardViews();
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
    const normalizedPath = normalizePath(path);
    const directory = normalizedPath.includes("/")
      ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/"))
      : "";

    if (directory) {
      await this.ensureFolder(directory);
    }

    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      return existing;
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

      const listed = await adapter.list(folderPath);
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

class DailyDashboardView extends ItemView {
  private plugin: DailyDashboardPlugin;
  private workLogFilters: WorkLogFilters = {
    project: "",
    keyword: "",
    fromDate: "",
    toDate: ""
  };
  private quickAddState: QuickAddState = {
    projectName: "",
    sectionName: "Add",
    taskText: ""
  };

  constructor(leaf: WorkspaceLeaf, plugin: DailyDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DAILY_DASHBOARD;
  }

  getDisplayText(): string {
    return "Daily Dashboard";
  }

  getIcon(): string {
    return "check-square";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = todoSnapshot?.projects ?? [];
      const staleProjects = todoSnapshot?.staleProjects ?? [];
      const breakdownCandidates = todoSnapshot?.breakdownCandidates ?? [];
      const cleanupSuggestions = todoSnapshot?.cleanupSuggestions ?? [];
      const workLogEntries = this.getFilteredWorkLogEntries();
      const staleProjectCount = staleProjects.length;

      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }

      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");

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

      const heroFooter = hero.createDiv({ cls: "daily-dashboard-hero-footer" });
      const heroMeta = heroFooter.createDiv({ cls: "daily-dashboard-hero-status-row" });
      const datePill = createStatPill(heroMeta, todayEntry.date, "calendar-days", "date");
      datePill.addClass("is-compact");
      const archivedPill = createStatPill(heroMeta, `${todayEntry.completedTasks.length} archived`, "archive", "done");
      archivedPill.addClass("is-compact");
      const stalePill = createStatPill(heroMeta, `${staleProjectCount} stale`, "triangle-alert", staleProjectCount > 0 ? "alert" : "neutral");
      stalePill.addClass("is-compact");
      const statePill = createStatPill(heroMeta, `Mood ${renderScore(todayEntry.moodScore)} • Energy ${renderScore(todayEntry.energyScore)}`, "activity", "state");
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
      const activeWorkSession = todayEntry.workSessions.find((session) => session.end === null) ?? null;
      const activeNapSession = todayEntry.napSessions.find((session) => session.end === null) ?? null;
      const dayFlowCard = createCard(grid, "Day Flow", "Control when your real day begins and ends so late nights do not spill into the wrong log date.", {
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
      this.renderDayMetric(dayFlowGrid, "Live session", activeWorkSession ? formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live nap", activeNapSession ? formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(new Date()))) : "Not active");
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

      const focusCard = createCard(grid, "Top 3 For Today", "Keep today concrete. Promote project tasks here or type them directly.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      if (todayEntry.todayFocus.length === 0) {
        focusList.createEl("p", { cls: "daily-dashboard-empty", text: "No focus items yet. Add one below or use Promote to today." });
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
      const submitFocus = async (): Promise<void> => {
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

      const aiCard = createCard(grid, "AI Workspace", "Use your dashboard and vault context for planning, triage, reflection, and direct questions without leaving the dashboard.", {
        icon: "sparkles",
        eyebrow: "AI",
        tone: "capture",
        tag: aiStatus.busy ? "Running" : "Ready"
      });
      const aiChipRow = aiCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(aiChipRow, aiStatus.configured ? "API key configured" : "API key missing", aiStatus.configured ? "done" : "alert");
      createSemanticChip(aiChipRow, aiStatus.model || "No model", "neutral");
      createSemanticChip(aiChipRow, aiStatus.busy ? "Request in progress" : "Idle", aiStatus.busy ? "focus" : "neutral");

      const aiActions = aiCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(aiActions, "Today plan", async () => this.plugin.generateAiTodayPlan(), false, "sunrise");
      createButton(aiActions, "End day review", async () => this.plugin.generateAiEndOfDayReview(), false, "moon-star");
      createButton(aiActions, "Project triage", async () => this.plugin.generateAiProjectTriage(), false, "triangle-alert");
      createButton(aiActions, "Weekly coach", async () => this.plugin.generateAiWeeklyCoachNote(), false, "bar-chart-3");

      aiCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Ask AI about your vault" });
      const aiQuestion = aiCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      aiQuestion.placeholder = "What should I prioritize this week? Which project is actually dragging me down? What am I underestimating?";
      aiQuestion.rows = 4;
      const aiQuestionActions = aiCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(aiQuestionActions, "Ask AI", async () => this.plugin.askAiQuestion(aiQuestion.value), true, "message-square");
      createButton(aiQuestionActions, "Open ask modal", async () => this.plugin.openAskAiFlow(), false, "panel-top-open");

      if (aiStatus.latestArtifact) {
        const latest = aiCard.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-ai-output" });
        latest.createEl("strong", { text: `${aiStatus.latestArtifact.kind} • ${aiStatus.latestArtifact.generatedAt}` });
        latest.createEl("span", { text: aiStatus.latestArtifact.summary || "AI note generated." });
        latest.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.latestArtifact.notePath });

        const latestActions = aiCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(latestActions, "Open latest AI note", async () => this.plugin.openAiArtifact(aiStatus.latestArtifact), false, "file-text");

        if (aiStatus.latestArtifact.suggestedFocus.length > 0) {
          aiCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Suggested focus items" });
          const suggestionList = aiCard.createDiv({ cls: "daily-dashboard-ai-suggestions" });
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
        aiCard.createEl("p", { cls: "daily-dashboard-empty", text: "No AI notes generated yet. Start with Today plan or ask a question." });
      }

      const stateCard = createCard(grid, "State And Friction", "Track the day honestly so weak-output days can be explained, not guessed at later.", {
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

    const habitsCard = createCard(grid, "Habits", "Daily repeats with misses explicitly tracked for weekly and monthly analysis.", {
      icon: "check-square",
      eyebrow: "Routines",
      tone: "state",
      tag: "Track"
    });
    const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
    this.plugin.getHabitDefinitions().forEach((habit) => {
      const currentValue = todayEntry.habits[habit.id] ?? 0;
      const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
      const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
      copy.createEl("strong", { text: habit.label });
      copy.createEl("span", {
        cls: "daily-dashboard-habit-meta",
        text: `${currentValue}/${habit.target} done • ${this.plugin.getHabitStreak(habit.id)} day streak`
      });
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

      const quickAddCard = createCard(grid, "Quick Add To Project", "Capture new work into Add, Fix, Now, Next, or Later without leaving the dashboard.", {
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

    const foodCard = createCard(grid, "Food Log", "Quick capture of what you ate today so the daily note stays analyzable later.", {
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
    const submitFood = async (): Promise<void> => {
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
      foodList.createEl("p", { cls: "daily-dashboard-empty", text: "No food entries yet today." });
    } else {
      todayEntry.foodLog.forEach((item, index) => {
        const row = foodList.createDiv({ cls: "daily-dashboard-food-row" });
        row.createEl("span", { text: item });
        const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
        removeButton.type = "button";
        removeButton.addEventListener("click", () => {
          void this.plugin.removeFoodEntry(index);
        });
      });
    }

    const notesCard = createCard(grid, "Sleep And Notes", "Use sleep logging and a short daily note so reports can connect context to performance.", {
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
    notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
    const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
    notesInput.value = todayEntry.notes;
    notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
    notesInput.addEventListener("change", () => {
      void this.plugin.updateDailyNotes(notesInput.value);
    });

      const workLogCard = createCard(grid, "Searchable Work Log", "Filter archived completions by project, date, or keyword instead of scanning raw history.", {
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
        workLogList.createEl("p", { cls: "daily-dashboard-empty", text: "No archived work matches the current filters." });
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

    const projectsCard = createCard(grid, "Project Health", "Projects are scored by backlog size, stale age, recent output, and momentum so weak areas stay visible.", {
      icon: "shield-check",
      eyebrow: "Portfolio",
      tone: "health",
      tag: "Health"
    });
    const projectList = projectsCard.createDiv({ cls: "daily-dashboard-project-list" });
    if (!todoSnapshot || todoSnapshot.projects.length === 0) {
      projectList.createEl("p", { cls: "daily-dashboard-empty", text: "No project data found in the configured master task hub." });
    } else {
      [...todoSnapshot.projects]
        .sort((left, right) => right.healthScore - left.healthScore)
        .slice(0, 10)
        .forEach((project) => {
          const row = projectList.createDiv({ cls: "daily-dashboard-project-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 75 ? "focus" : project.healthScore >= 50 ? "state" : "alert");
          createSemanticChip(chipRow, project.trend, project.trend === "up" ? "done" : project.trend === "down" ? "alert" : "neutral");
          row.createEl("strong", { text: `${project.name} • ${project.healthScore}` });
          row.createEl("span", { text: `${project.healthLabel} • ${project.openCount} open • ${project.completionsThisWeek} this week • ${project.completionsThisMonth} this month • ${project.trend}` });
          if (project.staleDays !== null) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
          }
          if (project.focus) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Focus: ${project.focus}` });
          }
          if (project.relationships.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Relationships: ${project.relationships.join(", ")}` });
          }
        });
    }

    const alertsCard = createCard(grid, "Stale Work And Cleanup", "Detect stale projects, vague tasks, duplicates, and empty sections before the hub gets mushy.", {
      icon: "triangle-alert",
      eyebrow: "Triage",
      tone: "alert",
      tag: "Attention"
    });
    const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
    const alertLines = [
      ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
      ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`),
      ...cleanupSuggestions.slice(0, 5)
    ];
    if (alertLines.length === 0) {
      alertsList.createEl("p", { cls: "daily-dashboard-empty", text: "No stale-work or cleanup issues detected right now." });
    } else {
      alertLines.forEach((line) => {
        const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
        row.createEl("span", { text: line });
      });
    }
    const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions(), false, "sparkles");
    createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true), false, "move-right");

    const completedCard = createCard(grid, "Completed Today", "Recent completions remain visible for quick review and habit-memory reinforcement.", {
      icon: "badge-check",
      eyebrow: "Done",
      tone: "done",
      tag: "Wins"
    });
    const completedList = completedCard.createDiv({ cls: "daily-dashboard-completed-list" });
    if (todayEntry.completedTasks.length === 0) {
      completedList.createEl("p", { cls: "daily-dashboard-empty", text: "No archived tasks yet today." });
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

  private renderErrorState(error: unknown): void {
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

  private createFilterInput(parent: HTMLElement, placeholder: string, value: string, onChange: (value: string) => void): void {
    const input = parent.createEl("input", {
      cls: "daily-dashboard-input",
      attr: { type: "text", placeholder }
    });
    input.value = value;
    input.addEventListener("change", () => {
      onChange(input.value.trim());
    });
  }

  private renderDayMetric(parent: HTMLElement, label: string, value: string): void {
    const metric = parent.createDiv({ cls: "daily-dashboard-day-metric" });
    metric.createEl("span", { cls: "daily-dashboard-habit-meta", text: label });
    metric.createEl("strong", { text: value });
  }

  private getFilteredWorkLogEntries(): ArchivedTaskSnapshot[] {
    const entries = this.plugin.getAllEntries()
      .flatMap((entry) => entry.completedTasks)
      .sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));

    return entries.filter((entry) => {
      const matchesProject = !this.workLogFilters.project || entry.project === this.workLogFilters.project;
      const matchesKeyword = !this.workLogFilters.keyword || `${entry.project} ${entry.section} ${entry.text}`.toLowerCase().includes(this.workLogFilters.keyword.toLowerCase());
      const datePart = entry.archivedAt.slice(0, 10);
      const matchesFrom = !this.workLogFilters.fromDate || datePart >= this.workLogFilters.fromDate;
      const matchesTo = !this.workLogFilters.toDate || datePart <= this.workLogFilters.toDate;
      return matchesProject && matchesKeyword && matchesFrom && matchesTo;
    });
  }

  private renderScoreControl(
    parent: HTMLElement,
    label: string,
    currentValue: number,
    onSelect: (value: number) => Promise<void>
  ): void {
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
}

class CreateProjectModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private categories: string[];
  private state: CreateProjectInput;

  constructor(app: App, plugin: DailyDashboardPlugin, categories: string[]) {
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.state = {
      projectName: "",
      categoryName: categories[0] ?? "Projects",
      status: "Planning",
      focus: "",
      addTasks: [],
      fixTasks: []
    };
  }

  onOpen(): void {
    this.setTitle("Create Project And Project Note");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Project name")
      .setDesc("Used for the master todo section and the new project note name.")
      .addText((text) => {
        text
          .setPlaceholder("New Project")
          .onChange((value) => {
            this.state.projectName = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Category")
      .setDesc("Top-level section in the master todo where this project should be added.")
      .addDropdown((dropdown) => {
        const options = [...this.categories];
        if (!options.includes(this.state.categoryName)) {
          options.unshift(this.state.categoryName);
        }
        options.forEach((category) => dropdown.addOption(category, category));
        dropdown.setValue(this.state.categoryName);
        dropdown.onChange((value) => {
          this.state.categoryName = value;
        });
      })
      .addText((text) => {
        text
          .setPlaceholder("Or type a new category name")
          .onChange((value) => {
            if (value.trim()) {
              this.state.categoryName = value.trim();
            }
          });
      });

    new Setting(contentEl)
      .setName("Status")
      .setDesc("Initial status written to the master todo and project note.")
      .addDropdown((dropdown) => {
        ["Planning", "Active", "Parked", "Blocked"].forEach((status) => dropdown.addOption(status, status));
        dropdown.setValue(this.state.status);
        dropdown.onChange((value) => {
          this.state.status = value;
        });
      });

    new Setting(contentEl)
      .setName("Focus")
      .setDesc("Short description of the current objective for this project.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("What matters most right now for this project?")
          .onChange((value) => {
            this.state.focus = value;
          });
        textArea.inputEl.rows = 3;
      });

    new Setting(contentEl)
      .setName("Add tasks")
      .setDesc("Optional. One task per line; these seed the Add section.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("First task\nSecond task")
          .onChange((value) => {
            this.state.addTasks = splitMultilineInput(value);
          });
        textArea.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .setName("Fix tasks")
      .setDesc("Optional. One task per line; these seed the Fix section.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Known bug\nAnother bug")
          .onChange((value) => {
            this.state.fixTasks = splitMultilineInput(value);
          });
        textArea.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Create project").setCta().onClick(async () => {
          if (!this.state.projectName.trim()) {
            new Notice("Project name is required.");
            return;
          }

          if (!this.state.categoryName.trim()) {
            new Notice("Category is required.");
            return;
          }

          await this.plugin.createProjectAndNote(this.state);
          this.close();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Cancel").onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class PromoteTaskModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private projects: TodoProjectSummary[];
  private selectedProjectName: string;

  constructor(app: App, plugin: DailyDashboardPlugin, projects: TodoProjectSummary[]) {
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = projects[0]?.name ?? "";
  }

  onOpen(): void {
    this.setTitle("Promote Project Task To Today");
    const { contentEl } = this;
    contentEl.empty();

    const projectSetting = new Setting(contentEl).setName("Project");
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
      ...selectedProject?.nowTasks ?? [],
      ...selectedProject?.nextTasks ?? [],
      ...selectedProject?.breakdownTasks ?? []
    ].slice(0, 20);

    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new Setting(contentEl)
          .setName(task)
          .addButton((button) => {
            button.setButtonText("Promote").setCta().onClick(async () => {
              await this.plugin.promoteTaskToToday(this.selectedProjectName, task);
              this.close();
            });
          });
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class ProjectReviewModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private options: ProjectReviewOption[];

  constructor(app: App, plugin: DailyDashboardPlugin, options: ProjectReviewOption[]) {
    super(app);
    this.plugin = plugin;
    this.options = options;
  }

  onOpen(): void {
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();

    this.options.forEach((option) => {
      new Setting(contentEl)
        .setName(option.projectName)
        .setDesc(option.notePath)
        .addButton((button) => {
          button.setButtonText("Open").setCta().onClick(async () => {
            await this.plugin.openProjectReviewMode(option);
            this.close();
          });
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class AskAiModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private question = "";

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.setTitle("Ask AI About Your Dashboard");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Question")
      .setDesc("Ask about priorities, stalled projects, habit drift, workload balance, or anything else grounded in the dashboard context.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("What should I focus on next? Which project is costing me the most attention? What pattern am I missing?")
          .setValue(this.question)
          .onChange((value) => {
            this.question = value;
          });
        textArea.inputEl.rows = 6;
        window.setTimeout(() => textArea.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Ask AI").setCta().onClick(async () => {
          if (!this.question.trim()) {
            new Notice("Enter a question first.");
            return;
          }

          await this.plugin.askAiQuestion(this.question);
          this.close();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Cancel").onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class DailyDashboardSettingTab extends PluginSettingTab {
  private plugin: DailyDashboardPlugin;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();

    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Dashboard" });

    new Setting(containerEl)
      .setName("Dashboard title")
      .setDesc("Displayed at the top of the custom dashboard tab.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dashboardTitle)
          .setValue(settings.dashboardTitle)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              dashboardTitle: value.trim() || DEFAULT_SETTINGS.dashboardTitle
            });
          });
      });

    new Setting(containerEl)
      .setName("Master Task Hub note path")
      .setDesc("The note used for project task counts, project creation, and archive automation.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.masterTodoPath)
          .setValue(settings.masterTodoPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              masterTodoPath: value.trim() || DEFAULT_SETTINGS.masterTodoPath
            });
          });
      });

    new Setting(containerEl)
      .setName("Project notes folder")
      .setDesc("New project notes created by the intake flow are written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder)
          .setValue(settings.projectNotesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              projectNotesFolder: value.trim() || DEFAULT_SETTINGS.projectNotesFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Daily log folder")
      .setDesc("Markdown logs written once per day.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder)
          .setValue(settings.dailyLogFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              dailyLogFolder: value.trim() || DEFAULT_SETTINGS.dailyLogFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Weekly report folder")
      .setDesc("Where generated weekly summaries are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder)
          .setValue(settings.weeklyReportFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              weeklyReportFolder: value.trim() || DEFAULT_SETTINGS.weeklyReportFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Monthly report folder")
      .setDesc("Where generated monthly summaries are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder)
          .setValue(settings.monthlyReportFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              monthlyReportFolder: value.trim() || DEFAULT_SETTINGS.monthlyReportFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Live day state note path")
      .setDesc("Vault note used to mirror logical day and session state for stronger cross-device sync behavior.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.liveStatePath)
          .setValue(settings.liveStatePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              liveStatePath: value.trim() || DEFAULT_SETTINGS.liveStatePath
            });
          });
      });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Used for AI planning, reflection, triage, and question answering. Stored in plugin settings and will sync with your vault if Obsidian Sync is enabled.")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(settings.aiApiKey)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiApiKey: value.trim()
            });
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("AI model")
      .setDesc("Recommended default: gpt-4o-mini for strong cost-to-quality balance. You can enter any compatible OpenAI chat-completions model.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiModel)
          .setValue(settings.aiModel)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiModel: value.trim() || DEFAULT_SETTINGS.aiModel
            });
          });
      });

    new Setting(containerEl)
      .setName("AI API URL")
      .setDesc("Defaults to OpenAI chat completions. Change this only if you know you need a different compatible endpoint.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiBaseUrl)
          .setValue(settings.aiBaseUrl)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiBaseUrl: value.trim() || DEFAULT_SETTINGS.aiBaseUrl
            });
          });
      });

    new Setting(containerEl)
      .setName("AI output folder")
      .setDesc("Generated AI planning and analysis notes are written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder)
          .setValue(settings.aiOutputFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiOutputFolder: value.trim() || DEFAULT_SETTINGS.aiOutputFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("AI context days")
      .setDesc("How many recent daily entries are summarized into AI prompts by default.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.aiContextDays}`)
          .setValue(`${settings.aiContextDays}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiContextDays: clamp(Number(value.trim() || DEFAULT_SETTINGS.aiContextDays), 3, 60)
            });
          });
      });

    new Setting(containerEl)
      .setName("Wallpaper folder")
      .setDesc("Image folder used for dashboard hero wallpapers.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.wallpaperFolder)
          .setValue(settings.wallpaperFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              wallpaperFolder: value.trim() || DEFAULT_SETTINGS.wallpaperFolder,
              selectedWallpaper: ""
            });
            this.display();
          });
      });

    const wallpaperFiles = this.plugin.getWallpaperFiles();
    new Setting(containerEl)
      .setName("Selected wallpaper")
      .setDesc(wallpaperFiles.length > 0 ? "Choose the image shown in the top section of the dashboard." : "No image files were found in the configured wallpaper folder.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "Default / first image");
        wallpaperFiles.forEach((file) => {
          dropdown.addOption(file.path, file.displayName);
        });
        dropdown.setValue(settings.selectedWallpaper);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            selectedWallpaper: value
          });
        });
      });

    new Setting(containerEl)
      .setName("Habit definitions")
      .setDesc("One habit per line using the format Habit Name|Target Count.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Take pills|1\nBrush teeth|2\nFloss|2\nShower|1\nLog sleep|1")
          .setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}`).join("\n"))
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              habitDefinitions: parseHabitDefinitions(value)
            });
          });

        textArea.inputEl.rows = 8;
        textArea.inputEl.cols = 36;
      });
  }
}

function createCard(parent: HTMLElement, title: string, description: string, options?: CardVisualOptions): HTMLElement {
  const card = parent.createDiv({ cls: "daily-dashboard-card" });
  card.addClass(`daily-dashboard-card--${toClassSlug(title)}`);
  const header = card.createDiv({ cls: "daily-dashboard-card-header" });
  if (options) {
    header.addClass(`is-${options.tone}`);
    const top = header.createDiv({ cls: "daily-dashboard-card-header-top" });
    const lead = top.createDiv({ cls: "daily-dashboard-card-lead" });
    const iconEl = lead.createSpan({ cls: "daily-dashboard-card-icon" });
    setIcon(iconEl, options.icon);
    lead.createEl("span", { cls: "daily-dashboard-card-eyebrow", text: options.eyebrow });
    if (options.tag) {
      createSemanticChip(top, options.tag, options.tone);
    }
  }
  header.createEl("h2", { text: title });
  header.createEl("p", { text: description });
  return card;
}

function createButton(parent: HTMLElement, text: string, onClick: () => Promise<void>, isPrimary = false, iconName?: string): void {
  const button = parent.createEl("button", {
    cls: isPrimary ? "daily-dashboard-primary-button" : "daily-dashboard-secondary-button"
  });
  if (iconName) {
    const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
    setIcon(iconEl, iconName);
  }
  button.createSpan({ cls: "daily-dashboard-button-label", text });
  button.type = "button";
  button.addEventListener("click", () => {
    void onClick();
  });
}

function createIconButton(parent: HTMLElement, iconName: string, label: string, onClick: () => Promise<void>): void {
  const button = parent.createEl("button", { cls: "daily-dashboard-icon-button" });
  button.type = "button";
  button.ariaLabel = label;
  button.title = label;
  const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
  setIcon(iconEl, iconName);
  button.addEventListener("click", () => {
    void onClick();
  });
}

function createSemanticChip(parent: HTMLElement, text: string, tone: DashboardTone): HTMLElement {
  const chip = parent.createSpan({ cls: "daily-dashboard-semantic-chip" });
  chip.addClass(`is-${tone}`);
  chip.setText(text);
  return chip;
}

function createStatPill(parent: HTMLElement, text: string, iconName: string, tone: DashboardTone | "date"): HTMLElement {
  const pill = parent.createDiv({ cls: tone === "date" ? "daily-dashboard-date-pill" : "daily-dashboard-stat-pill" });
  pill.addClass(`is-${tone}`);
  const iconEl = pill.createSpan({ cls: "daily-dashboard-pill-icon" });
  setIcon(iconEl, iconName);
  pill.createSpan({ cls: "daily-dashboard-pill-label", text });
  return pill;
}

function createHeroMetric(parent: HTMLElement, iconName: string, label: string, value: string, tone: DashboardTone | "date"): HTMLElement {
  const metric = parent.createDiv({ cls: "daily-dashboard-hero-metric" });
  metric.addClass(`is-${tone}`);
  const iconWrap = metric.createDiv({ cls: "daily-dashboard-hero-metric-icon" });
  setIcon(iconWrap, iconName);
  const copy = metric.createDiv({ cls: "daily-dashboard-hero-metric-copy" });
  copy.createEl("span", { cls: "daily-dashboard-hero-metric-label", text: label });
  copy.createEl("strong", { cls: "daily-dashboard-hero-metric-value", text: value });
  return metric;
}

function toClassSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeSettings(settings: DashboardSettings): DashboardSettings {
  const parsedHabitDefinitions = Array.isArray(settings.habitDefinitions)
    ? settings.habitDefinitions
        .map((habit) => ({
          id: createHabitId(habit.id || habit.label || "habit"),
          label: typeof habit.label === "string" ? habit.label.trim() : "Habit",
          target: clamp(Number(habit.target ?? 1), 1, 12)
        }))
        .filter((habit) => habit.label.length > 0)
    : DEFAULT_SETTINGS.habitDefinitions;

  return {
    dashboardTitle: settings.dashboardTitle?.trim() || DEFAULT_SETTINGS.dashboardTitle,
    masterTodoPath: settings.masterTodoPath?.trim() || DEFAULT_SETTINGS.masterTodoPath,
    projectNotesFolder: normalizeFolderPath(settings.projectNotesFolder?.trim() || DEFAULT_SETTINGS.projectNotesFolder),
    dailyLogFolder: settings.dailyLogFolder?.trim() || DEFAULT_SETTINGS.dailyLogFolder,
    weeklyReportFolder: settings.weeklyReportFolder?.trim() || DEFAULT_SETTINGS.weeklyReportFolder,
    monthlyReportFolder: settings.monthlyReportFolder?.trim() || DEFAULT_SETTINGS.monthlyReportFolder,
    liveStatePath: settings.liveStatePath?.trim() || DEFAULT_SETTINGS.liveStatePath,
    aiApiKey: settings.aiApiKey?.trim() || DEFAULT_SETTINGS.aiApiKey,
    aiModel: settings.aiModel?.trim() || DEFAULT_SETTINGS.aiModel,
    aiBaseUrl: settings.aiBaseUrl?.trim() || DEFAULT_SETTINGS.aiBaseUrl,
    aiOutputFolder: normalizeFolderPath(settings.aiOutputFolder?.trim() || DEFAULT_SETTINGS.aiOutputFolder),
    aiContextDays: clamp(Number(settings.aiContextDays ?? DEFAULT_SETTINGS.aiContextDays), 3, 60),
    wallpaperFolder: normalizeFolderPath(settings.wallpaperFolder?.trim() || DEFAULT_SETTINGS.wallpaperFolder),
    selectedWallpaper: settings.selectedWallpaper?.trim() || DEFAULT_SETTINGS.selectedWallpaper,
    habitDefinitions: parsedHabitDefinitions.length > 0 ? parsedHabitDefinitions : DEFAULT_SETTINGS.habitDefinitions
  };
}

function normalizeFolderPath(value: string): string {
  const normalized = normalizePath(value.trim());
  return normalized.replace(/\/+$/g, "");
}

function createEmptyEntry(date: string, habits: HabitDefinition[]): DailyEntry {
  const habitValues = Object.fromEntries(habits.map((habit) => [habit.id, 0]));
  return {
    date,
    dayStartedAt: "",
    dayEndedAt: "",
    wakeTime: "",
    sleepTime: "",
    habits: habitValues,
    moodScore: 0,
    energyScore: 0,
    todayFocus: [],
    frictionLog: "",
    missedHabits: computeMissedHabits(habitValues, habits),
    foodLog: [],
    sleepLog: "",
    notes: "",
    workSessions: [],
    napSessions: [],
    completedTasks: []
  };
}

function normalizeDayState(dayState: Partial<DayLifecycleState> | undefined, entries: Record<string, DailyEntry>): DayLifecycleState {
  const fallbackDate = Object.keys(entries).sort().slice(-1)[0] ?? formatDateKey(new Date());
  const activeDate = typeof dayState?.activeDate === "string" && dayState.activeDate.trim().length > 0
    ? dayState.activeDate
    : fallbackDate;
  const status = dayState?.status === "in-progress" || dayState?.status === "ended"
    ? dayState.status
    : "not-started";

  return {
    activeDate,
    status
  };
}

function parseHabitDefinitions(value: string): HabitDefinition[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return DEFAULT_SETTINGS.habitDefinitions;
  }

  return lines.map((line) => {
    const [rawLabel, rawTarget] = line.split("|");
    const label = rawLabel?.trim() || "Habit";
    const target = clamp(Number(rawTarget?.trim() || 1), 1, 12);
    return {
      id: createHabitId(label),
      label,
      target
    };
  });
}

function createHabitId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "habit";
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTimeKey(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}

function formatSyncTimestamp(value: string): string {
  return value.trim().length > 0 ? value : "Not yet";
}

function formatFileTimestamp(date: Date): string {
  return formatDateTimeKey(date).replace(/[: ]/g, "-");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 18)).trimEnd()}\n\n[truncated]`;
}

function stripJsonCodeBlocks(value: string): string {
  return value.replace(/```json\s*[\s\S]*?```/gi, "").trim();
}

function extractAiStructuredPayload(value: string): AiStructuredPayload {
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
    const parsed = JSON.parse(match[1]) as Partial<AiStructuredPayload>;
    return {
      suggestedFocus: Array.isArray(parsed.suggestedFocus) ? parsed.suggestedFocus.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.filter((item): item is string => typeof item === "string").slice(0, 6) : []
    };
  } catch {
    return {
      suggestedFocus: [],
      nextActions: [],
      keyRisks: [],
      followUpQuestions: []
    };
  }
}

function extractAiSummary(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return lines[0] ?? "AI note generated.";
}

function renderTodoSnapshotForAi(snapshot: TodoSnapshot | null): string {
  if (!snapshot) {
    return "Master task hub snapshot unavailable.";
  }

  const topProjects = [...snapshot.projects]
    .sort((left, right) => right.healthScore - left.healthScore)
    .slice(0, 8)
    .map((project) => [
      `- ${project.name}: health ${project.healthScore}, ${project.openCount} open, ${project.archivedCount} archived, trend ${project.trend}`,
      project.focus ? `  focus: ${project.focus}` : "",
      project.staleDays !== null ? `  stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"}` : "",
      project.nowTasks.length > 0 ? `  now: ${project.nowTasks.slice(0, 3).join(" | ")}` : "",
      project.nextTasks.length > 0 ? `  next: ${project.nextTasks.slice(0, 3).join(" | ")}` : ""
    ].filter((line) => line.length > 0).join("\n"));

  const staleLines = snapshot.staleProjects.slice(0, 6)
    .map((project) => `- ${project.name}: ${project.staleDays} stale days`);

  const cleanupLines = snapshot.cleanupSuggestions.slice(0, 8).map((item) => `- ${item}`);

  return [
    `Open tasks: ${snapshot.totalOpen}`,
    `Archived tasks: ${snapshot.totalArchived}`,
    "",
    "Top projects:",
    ...(topProjects.length > 0 ? topProjects : ["- No project summaries available."]),
    "",
    "Stale projects:",
    ...(staleLines.length > 0 ? staleLines : ["- None"]),
    "",
    "Cleanup suggestions:",
    ...(cleanupLines.length > 0 ? cleanupLines : ["- None"])
  ].join("\n");
}

function renderLiveDayStateNote(snapshot: LiveDayStateSnapshot): string {
  const workSessionLines = snapshot.entry.workSessions.length > 0
    ? snapshot.entry.workSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- None"];
  const napSessionLines = snapshot.entry.napSessions.length > 0
    ? snapshot.entry.napSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- None"];

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
    ""
  ].join("\n");
}

function parseLiveDayStateNote(content: string): LiveDayStateSnapshot | null {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== "---") {
    return null;
  }

  let index = 1;
  const frontmatter = new Map<string, string>();
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

  const activeDate = frontmatter.get("activeDate") ?? "";
  const statusValue = frontmatter.get("status");
  const date = frontmatter.get("date") ?? activeDate;
  if (!activeDate || !date) {
    return null;
  }

  const workSessions: WorkSession[] = [];
  const napSessions: WorkSession[] = [];
  let currentSection = "";

  for (; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) {
      currentSection = line.slice(3).trim().toLowerCase();
      continue;
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

  return {
    updatedAt: frontmatter.get("updatedAt") ?? "",
    dayState: {
      activeDate,
      status: statusValue === "in-progress" || statusValue === "ended" ? statusValue : "not-started"
    },
    entry: {
      date,
      dayStartedAt: frontmatter.get("dayStartedAt") ?? "",
      dayEndedAt: frontmatter.get("dayEndedAt") ?? "",
      wakeTime: frontmatter.get("wakeTime") ?? "",
      sleepTime: frontmatter.get("sleepTime") ?? "",
      workSessions,
      napSessions
    }
  };
}

function parseWorkSessionLine(line: string): WorkSession | null {
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

function renderScore(value: number): string {
  return value > 0 ? `${value}/5` : "-";
}

function renderDailyLog(entry: DailyEntry, habits: HabitDefinition[]): string {
  const habitLines = habits.map((habit) => `- ${habit.label}: ${entry.habits[habit.id] ?? 0}/${habit.target}`);
  const foodLines = entry.foodLog.length > 0 ? entry.foodLog.map((item) => `- ${item}`) : ["- None logged"];
  const completedTaskLines = entry.completedTasks.length > 0
    ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`)
    : ["- No archived tasks today"];
  const workSessionLines = entry.workSessions.length > 0
    ? entry.workSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked work sessions"];
  const napSessionLines = entry.napSessions.length > 0
    ? entry.napSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked naps"];
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

function renderPeriodReport(input: {
  title: string;
  rangeLabel: string;
  entries: DailyEntry[];
  habitDefinitions: HabitDefinition[];
}): string {
  const workByProject = new Map<string, number>();
  let daysWithFood = 0;
  let daysWithSleep = 0;
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
      workByProject.set(task.project, (workByProject.get(task.project) ?? 0) + 1);
    });
  });

  const habitRows = input.habitDefinitions.map((habit) => {
    const completed = input.entries.reduce((sum, entry) => sum + Math.min(entry.habits[habit.id] ?? 0, habit.target), 0);
    const target = input.entries.length * habit.target;
    const percentage = target > 0 ? Math.round((completed / target) * 100) : 0;
    return `| ${habit.label} | ${completed}/${target} | ${percentage}% |`;
  });

  const workLines = Array.from(workByProject.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([project, count]) => `- ${project}: ${count}`);

  const dayLines = input.entries.map((entry) => {
    const foodSummary = entry.foodLog.length > 0 ? `${entry.foodLog.length} food entries` : "no food log";
    const napSummary = entry.napSessions.length > 0 ? `${formatMinutesAsHours(getTrackedMinutes(entry.napSessions))} naps` : "no naps";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, ${napSummary}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`;
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
    ...(workLines.length > 0 ? workLines : ["- No archived tasks recorded in this period"]),
    "",
    "## Daily Breakdown",
    ...(dayLines.length > 0 ? dayLines : ["- No daily entries recorded in this period"]),
    ""
  ].join("\n");
}

function closeOpenWorkSessions(entry: DailyEntry, timestamp: string): void {
  entry.workSessions = entry.workSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

function closeOpenNapSessions(entry: DailyEntry, timestamp: string): void {
  entry.napSessions = entry.napSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

function getTrackedWorkMinutes(entry: DailyEntry): number {
  return getTrackedMinutes(entry.workSessions);
}

function getTrackedMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((total, session) => {
    const end = session.end ?? formatDateTimeKey(new Date());
    return total + getMinutesBetween(session.start, end);
  }, 0);
}

function getMinutesBetween(startValue: string, endValue: string): number {
  const start = parseDateTimeKey(startValue);
  const end = parseDateTimeKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function parseDateTimeKey(value: string): Date | null {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMinutesAsHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

function parseTodoSnapshot(content: string): TodoSnapshot {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const now = new Date();
  const thisWeekStart = getIsoWeekRange(now).start;
  const previousWeekStart = new Date(thisWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(thisWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const monthKey = formatDateKey(now).slice(0, 7);

  const projects = findProjectRanges(lines).map((project) => {
    let openCount = 0;
    let archivedCount = 0;
    let currentSection = "General";
    let focus = "";
    let categoryName = "Projects";
    let lastCompletedAt: string | null = null;
    let completionsThisWeek = 0;
    let completionsPreviousWeek = 0;
    let completionsThisMonth = 0;
    const noteLinks = new Set<string>();
    const nowTasks: string[] = [];
    const nextTasks: string[] = [];
    const laterTasks: string[] = [];
    const dueRepeatingTasks: string[] = [];
    const breakdownTasks: string[] = [];
    const emptySections = new Set<string>();
    const relationships = new Set<string>();
    const seenTasks = new Map<string, number>();
    const duplicateTasks = new Set<string>();
    const sectionCounts = new Map<string, number>();

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
      seenTasks.set(normalizedTask, (seenTasks.get(normalizedTask) ?? 0) + 1);
      if ((seenTasks.get(normalizedTask) ?? 0) > 1) {
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
      sectionCounts.set(sectionKey, (sectionCounts.get(sectionKey) ?? 0) + 1);
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
      completionRate: openCount + archivedCount > 0 ? Math.round((archivedCount / (openCount + archivedCount)) * 100) : 0,
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
  const staleProjects = projects
    .filter((project) => project.staleDays !== null && project.staleDays >= 7)
    .sort((left, right) => (right.staleDays ?? 0) - (left.staleDays ?? 0));
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

function archiveCompletedTasks(content: string, archivedAt: string): ArchiveResult {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);

  if (projectRanges.length === 0) {
    return { content, archivedTasks: [] };
  }

  const output: string[] = [];
  const archivedTasks: ArchivedTaskSnapshot[] = [];
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

function archiveCompletedTasksFromProjectLines(
  projectLines: string[],
  projectName: string,
  archivedAt: string
): { lines: string[]; archivedTasks: ArchivedTaskSnapshot[] } {
  const keptLines: string[] = [];
  const archivedTasks: ArchivedTaskSnapshot[] = [];
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

function findProjectRanges(lines: string[]): TodoProjectRange[] {
  const ranges: TodoProjectRange[] = [];

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

function getProjectHeaderName(lines: string[], index: number): string | null {
  const line = lines[index]?.trim() ?? "";
  const nextLine = lines[index + 1]?.trim() ?? "";

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

function getSectionName(line: string): string | null {
  const trimmed = line.trim();
  if (/^###\s+/.test(trimmed)) {
    return trimmed.replace(/^###\s+/, "").trim();
  }

  const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
  return sectionMatch ? sectionMatch[1] : null;
}

function isCompletedArchiveHeader(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "completed archive:" || trimmed === "### completed archive";
}

function isNonArchivableSection(sectionName: string): boolean {
  const normalized = sectionName.trim().toLowerCase();
  return normalized === "completed archive" || normalized === "reference" || normalized === "resources";
}

function parseProjectMeta(line: string): { key: string; value: string } | null {
  const match = line.trim().match(PROJECT_META_REGEX);
  if (!match) {
    return null;
  }

  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim()
  };
}

function extractNoteLinks(value: string): string[] {
  const links: string[] = [];
  let match = NOTE_LINK_REGEX.exec(value);
  while (match) {
    links.push(match[1]);
    match = NOTE_LINK_REGEX.exec(value);
  }
  NOTE_LINK_REGEX.lastIndex = 0;
  return links;
}

function getIsoWeekRange(referenceDate: Date): { start: Date; end: Date; label: string } {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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

function findTodoCategoryRanges(lines: string[]): Array<{ name: string; start: number; end: number }> {
  const ranges: Array<{ name: string; start: number; end: number }> = [];

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

function getTodoCategoryName(line: string | undefined): string | null {
  const trimmed = line?.trim() ?? "";
  if (!/^#\s+/.test(trimmed) || /^##\s+/.test(trimmed)) {
    return null;
  }

  const name = trimmed.replace(/^#\s+/, "").trim();
  return name.toLowerCase() === "master task hub" ? null : name;
}

function insertProjectIntoTodo(content: string, categoryName: string, projectBlock: string): string {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const targetCategory = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  const blockLines = projectBlock.split("\n");

  if (!targetCategory) {
    const result = trimTrailingBlankLines(lines);
    if (result.length > 0) {
      result.push("");
    }
    result.push(`# ${categoryName}`, "", ...blockLines, "");
    return result.join("\n");
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

function trimTrailingBlankLines(lines: string[]): string[] {
  const output = [...lines];
  while (output.length > 0 && output[output.length - 1].trim() === "") {
    output.pop();
  }
  return output;
}

function trimLeadingBlankLines(lines: string[]): string[] {
  const output = [...lines];
  while (output.length > 0 && output[0].trim() === "") {
    output.shift();
  }
  return output;
}

function renderTodoProjectBlock(input: CreateProjectInput & { projectNoteLink: string }): string {
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

function renderProjectNoteTemplate(input: CreateProjectInput, masterTodoPath: string): string {
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

function renderExistingProjectNoteTemplate(project: ExistingProjectDefinition, masterTodoPath: string): string {
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

function createWikiLink(filePath: string, label: string): string {
  return `[[${stripMarkdownExtension(normalizePath(filePath))}|${label}]]`;
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "-").trim();
  return cleaned || "New Project";
}

function splitMultilineInput(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function extractProjectDefinitionsFromTodo(content: string): ExistingProjectDefinition[] {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const definitions: ExistingProjectDefinition[] = [];

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

function extractProjectDefinition(projectLines: string[], categoryName: string): ExistingProjectDefinition | null {
  const firstLine = projectLines[0]?.trim() ?? "";
  if (!firstLine.startsWith("## ")) {
    return null;
  }

  const projectName = firstLine.replace(/^##\s+/, "").trim();
  let status = "Planning";
  let focus = "";
  let noteLinkPath = `Project Notes/${projectName}`;
  let currentSection = "";
  const addTasks: string[] = [];
  const fixTasks: string[] = [];

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
        noteLinkPath = extractFirstNoteLinkPath(meta.value) ?? noteLinkPath;
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

function extractFirstNoteLinkPath(value: string): string | null {
  const match = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(value);
  return match ? match[1] : null;
}

function computeMissedHabits(habits: Record<string, number>, definitions: HabitDefinition[]): string[] {
  return definitions
    .filter((definition) => (habits[definition.id] ?? 0) < definition.target)
    .map((definition) => definition.label);
}

function insertTaskIntoProjectSection(content: string, projectName: string, sectionName: string, taskText: string): string {
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
    const existingTasks = output.slice(sectionStart + 1, sectionEnd + 1)
      .map((line) => line.match(CHECKLIST_REGEX)?.[2].trim().toLowerCase())
      .filter((line): line is string => Boolean(line));
    if (existingTasks.includes(taskText.trim().toLowerCase())) {
      return content;
    }
    let insertIndex = sectionEnd + 1;
    while (insertIndex > sectionStart + 1 && output[insertIndex - 1].trim() === "") {
      insertIndex -= 1;
    }
    output.splice(insertIndex, 0, taskLine);
    return output.join("\n");
  }

  let insertIndex = project.end + 1;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const currentSection = getSectionName(output[index])?.toLowerCase();
    if (currentSection === "completed archive" || currentSection === "reference") {
      insertIndex = index;
      break;
    }
  }

  output.splice(insertIndex, 0, "", `### ${normalizedSection}`, taskLine);
  return output.join("\n");
}

function renderWeeklyReview(input: WeeklyReviewInput): string {
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const focusItems = Array.from(new Set(input.entries.flatMap((entry) => entry.todayFocus))).slice(0, 10);
  const frictionItems = input.entries.map((entry) => entry.frictionLog).filter(Boolean);
  const missedHabits = Array.from(new Set(input.entries.flatMap((entry) => entry.missedHabits)));
  const strongestProjects = [...(input.todoSnapshot?.projects ?? [])]
    .sort((left, right) => right.completionsThisWeek - left.completionsThisWeek)
    .slice(0, 5);
  const staleProjects = input.todoSnapshot?.staleProjects.slice(0, 5) ?? [];

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
    ...(focusItems.length > 0 ? focusItems.map((item) => `- ${item}`) : ["- No focus items recorded."]),
    "",
    "## Friction Log",
    ...(frictionItems.length > 0 ? frictionItems.map((item) => `- ${item}`) : ["- No friction logged."]),
    "",
    "## Missed Habits",
    ...(missedHabits.length > 0 ? missedHabits.map((item) => `- ${item}`) : ["- No recurring misses."]),
    "",
    "## Strongest Projects",
    ...(strongestProjects.length > 0
      ? strongestProjects.map((project) => `- ${project.name}: ${project.completionsThisWeek} completions this week, ${project.healthLabel.toLowerCase()} health`)
      : ["- No project output recorded."]),
    "",
    "## Projects Needing Attention",
    ...(staleProjects.length > 0
      ? staleProjects.map((project) => `- ${project.name}: stale for ${project.staleDays} days, ${project.openCount} open tasks`)
      : ["- No stale projects detected."]),
    "",
    "## Daily Notes",
    ...(input.entries.length > 0
      ? input.entries.map((entry) => `- ${entry.date}: ${entry.completedTasks.length} archived, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`)
      : ["- No daily entries recorded."]),
    ""
  ].join("\n");
}

function extractRepeatingTasks(noteContent: string): RepeatingTaskDefinition[] {
  const lines = noteContent.split(/\r?\n/);
  const tasks: RepeatingTaskDefinition[] = [];
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
    const taskMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (!taskMatch) {
      return;
    }
    const rawText = taskMatch[1].trim();
    const cadenceMatch = rawText.match(/\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\)/i);
    const cadence = (cadenceMatch?.[1] ?? cadenceMatch?.[2] ?? "weekly").toLowerCase();
    const text = rawText.replace(/\s*(\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\))\s*/i, "").trim();
    if (text) {
      tasks.push({ text, cadence });
    }
  });

  return tasks;
}

function isRepeatingTaskDue(task: RepeatingTaskDefinition, content: string, projectName: string): boolean {
  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return false;
  }

  const projectText = lines.slice(project.start, project.end + 1).join("\n").toLowerCase();
  if (projectText.includes(`- [ ] ${task.text}`.toLowerCase())) {
    return false;
  }

  const archivedDates: string[] = [];
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
  const daysSince = daysBetween(latest, formatDateKey(new Date()));
  if (task.cadence === "daily") {
    return daysSince >= 1;
  }
  if (task.cadence === "weekly") {
    return daysSince >= 7;
  }
  return daysSince >= 28;
}

async function offloadReferencesFromMasterHub(content: string, vault: Vault, masterTodoPath: string): Promise<ReferenceOffloadResult> {
  const lines = content.split(/\r?\n/);
  const projectDefinitions = extractProjectDefinitionsFromTodo(content);
  const output = [...lines];
  const offloadedProjects: string[] = [];

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
      if (sectionName?.toLowerCase() === "reference") {
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

    const referenceLines = output.slice(referenceStart + 1, referenceEnd + 1)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (referenceLines.length === 0) {
      continue;
    }

    const notePath = normalizePath(`${stripMarkdownExtension(projectDefinition.noteLinkPath)}.md`);
    const noteFile = vault.getAbstractFileByPath(notePath);
    if (!(noteFile instanceof TFile)) {
      continue;
    }

    const noteContent = await vault.read(noteFile);
    const updatedNoteContent = appendLinesToSection(noteContent, "References", [
      `- Offloaded from [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]] on ${formatDateKey(new Date())}`,
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

function looksLikeBreakdownTask(taskText: string): boolean {
  return taskText.length >= 80 || /\band\b|\bthen\b|\bcleanup\b|\brefactor\b/i.test(taskText);
}

function extractArchivedDate(value: string): string | null {
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function daysBetween(startDateKey: string, endDateKey: string): number {
  const start = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function computeHealthScore(input: {
  openCount: number;
  staleDays: number | null;
  completionsThisWeek: number;
  nowCount: number;
  nextCount: number;
  breakdownCount: number;
  duplicateCount: number;
}): number {
  let score = 100;
  score -= Math.min(input.openCount * 2, 30);
  score -= Math.min((input.staleDays ?? 0), 25);
  score += Math.min(input.completionsThisWeek * 4, 16);
  score += Math.min(input.nowCount * 3, 9);
  score += Math.min(input.nextCount * 1, 4);
  score -= input.breakdownCount * 5;
  score -= input.duplicateCount * 6;
  return clamp(score, 0, 100);
}

function describeHealthScore(score: number): string {
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

function buildCleanupSuggestions(project: TodoProjectSummary): string[] {
  const suggestions: string[] = [];
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

function appendLinesToSection(content: string, sectionName: string, linesToAppend: string[]): string {
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
    const output = trimTrailingBlankLines(lines);
    output.push("", `## ${sectionName}`, ...linesToAppend, "");
    return output.join("\n");
  }

  const output = [...lines];
  let insertIndex = sectionEnd;
  while (insertIndex > sectionIndex + 1 && output[insertIndex - 1].trim() === "") {
    insertIndex -= 1;
  }
  output.splice(insertIndex, 0, ...linesToAppend);
  return output.join("\n");
}