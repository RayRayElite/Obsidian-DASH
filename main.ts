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
  normalizeNextUpFocusItems,
  normalizeTodayFocusItems,
  normalizeNoteIndexCache,
  normalizeDayState,
  parseRoutineTemplates,
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
  buildSleepInsights,
  closeOpenBreakSessions,
  closeOpenNapSessions,
  closeOpenPoopSessions,
  closeOpenRelaxSessions,
  closeOpenWorkSessions,
  getTrackedBreakMinutes,
  getTrackedMinutes,
  getTrackedNapMinutes,
  getTrackedPoopCount,
  getTrackedPoopMinutes,
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
  FocusCaptureModal,
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
  type CalendarDocumentPayload,
  type CalendarEventEntry,
  type CalendarEventOccurrence,
  type CalendarOccurrenceException,
  type CalendarOccurrenceExceptionKind,
  type CalendarRepeatCadence,
  type CalendarSnapshot,
  type CreateProjectInput,
  type DayRepairInput,
  type DailyEntry,
  type DashboardPluginData,
  type DashboardFocusDisplayItem,
  type DashboardSettings,
  type DayLifecycleState,
  type EnergyCheckIn,
  type FoodEntry,
  type HabitDefinition,
  type LogicalDayInsights,
  type LogicalDayPrompt,
  type NoteIndexEntry,
  type NextUpFocusItem,
  type ProjectReviewOption,
  type RepairTimelineSession,
  type RepairTimelineSessionKind,
  type RetrievalIndexStatus,
  type RoutineTemplateDefinition,
  type SleepInsights,
  type SuggestedTop3Candidate,
  type TimeAllocationBucket,
  type TimeAllocationInsights,
  type TodoSnapshot,
  type TodayFocusItem,
  type WeeklyAgendaDay,
  type WallpaperOption,
  type WorkSession
} from "./src/dashboard-types";

export default class DailyDashboardPlugin extends Plugin {
  private static readonly CALENDAR_ARTIFACT_HORIZON_DAYS = 90;

  private data: DashboardPluginData = {
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    calendarEvents: [],
    dayState: {
      activeDate: formatDateKey(new Date()),
      status: "not-started",
      lastInactivityPromptActivityAt: "",
      lastLateNightWarningKey: ""
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
  private calendarWarningDay = "";
  private warnedCalendarEventKeys = new Set<string>();

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return String(error);
  }

  private async initializeWorkspaceArtifacts(): Promise<void> {
    await this.importCalendarEventsFromMarkdown();
    await this.ensureTodayEntry();
    await this.backfillDailyLogsFromEntries();
    await this.syncCalendarArtifacts();
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

      if (normalizedPath === normalizePath(this.data.settings.calendarDocumentPath)) {
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
      if (!(file instanceof TFile) || file.extension !== "md") {
        return;
      }

      if (normalizePath(file.path) === normalizePath(this.data.settings.calendarDocumentPath)) {
        void this.reloadCalendarDocumentFile(file);
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

      const normalizedPath = normalizePath(file.path);
      const normalizedOldPath = normalizePath(oldPath);
      const normalizedCalendarPath = normalizePath(this.data.settings.calendarDocumentPath);
      if (normalizedPath === normalizedCalendarPath || normalizedOldPath === normalizedCalendarPath) {
        void this.reloadCalendarDocumentFile(file);
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

  getLogicalDayInsights(referenceDate: Date = new Date()): LogicalDayInsights {
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
    const inactiveMinutes = lastActivityDate
      ? Math.max(0, Math.round((referenceDate.getTime() - lastActivityDate.getTime()) / 60000))
      : null;
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

  getTrackedPoopMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedPoopMinutes(entry);
  }

  getTrackedPoopCount(entry: DailyEntry = this.getTodayEntry()): number {
    return getTrackedPoopCount(entry);
  }

  getTrackedSleepMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getSleepMinutesForDay(entry, this.getNextEntry(entry.date));
  }

  getSleepInsights(): SleepInsights {
    return buildSleepInsights(this.getAllEntries());
  }

  getTimeAllocationInsights(date: string = this.getTodayKey(), referenceDate: Date = new Date()): TimeAllocationInsights {
    const entry = this.getOrCreateEntry(date);
    const nextEntry = this.getNextEntry(date);
    const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
    const workMinutes = this.getTrackedWorkMinutes(entry);
    const napMinutes = this.getTrackedNapMinutes(entry);
    const relaxMinutes = this.getTrackedRelaxMinutes(entry);
    const breakMinutes = this.getTrackedBreakMinutes(entry);
    const poopMinutes = this.getTrackedPoopMinutes(entry);
    const trackedAwakeMinutes = workMinutes + napMinutes + relaxMinutes + breakMinutes + poopMinutes;
    const activeDate = this.data.dayState.status === "in-progress" ? this.data.dayState.activeDate : "";
    const wakeWindowEnd = entry.dayEndedAt
      || entry.sleepTime
      || (date === activeDate ? formatDateTimeKey(referenceDate) : entry.lastEditedAt);
    const awakeWindowMinutes = entry.wakeTime && wakeWindowEnd && wakeWindowEnd >= entry.wakeTime
      ? getTrackedMinutes([{ start: entry.wakeTime, end: wakeWindowEnd, tag: "" }])
      : null;
    const awakeUnknownMinutes = awakeWindowMinutes === null ? null : Math.max(0, awakeWindowMinutes - trackedAwakeMinutes);
    const fullDayUnknownMinutes = Math.max(0, 1440 - sleepMinutes - workMinutes - (relaxMinutes + breakMinutes) - poopMinutes);
    const diagnostics: string[] = [];

    if (!entry.wakeTime) {
      diagnostics.push("Wake time is missing, so awake-time coverage is estimated loosely instead of measured.");
    }
    if (!entry.dayEndedAt && !entry.sleepTime && date !== activeDate) {
      diagnostics.push("This day has no recorded end marker, so untracked time may include the tail end of the day.");
    }
    if (date === activeDate) {
      diagnostics.push("The logical day is still active, so untracked awake time includes whatever part of today has not been logged yet.");
    }
    if ((awakeUnknownMinutes ?? 0) >= 180) {
      diagnostics.push("There are at least 3 hours of awake time with no timer coverage. Meals, chores, commuting, or missed session starts are likely hiding there.");
    }
    if (trackedAwakeMinutes === 0 && (entry.foodLog.length > 0 || entry.completedTasks.length > 0 || Object.values(entry.habitEvents).some((items) => items.length > 0))) {
      diagnostics.push("You recorded real activity, but none of it was tied to a session timer. Consider using work, break, relax, or nap timers more aggressively.");
    }
    if (!entry.sleepTime && !nextEntry?.wakeTime) {
      diagnostics.push("Overnight sleep is incomplete until sleep time and the next wake time are both present.");
    }

    const buckets: TimeAllocationBucket[] = [
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
      trackedAwakeMinutes,
      awakeWindowMinutes,
      awakeUnknownMinutes,
      fullDayUnknownMinutes,
      diagnostics,
      buckets
    };
  }

  getAllEntries(): DailyEntry[] {
    return Object.values(this.data.entries)
      .map((entry) => this.normalizeEntry(entry, entry.date || this.getTodayKey()))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  getWallpaperFiles(): WallpaperOption[] {
    return this.wallpaperOptions;
  }

  getRoutineTemplates(): RoutineTemplateDefinition[] {
    return parseRoutineTemplates(this.data.settings.routineTemplates);
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

  private getResolvedAiApiKey(): string {
    if (this.data.settings.aiApiKeySource === "env") {
      const envVar = this.data.settings.aiApiKeyEnvVar.trim();
      if (!envVar) {
        return "";
      }

      return process.env[envVar]?.trim() ?? "";
    }

    return this.data.settings.aiApiKey.trim();
  }

  private getAiConfigurationMessage(): string {
    if (this.data.settings.aiApiKeySource === "env") {
      const envVar = this.data.settings.aiApiKeyEnvVar.trim() || "OPENAI_API_KEY";
      return `Set the ${envVar} environment variable before using AI features.`;
    }

    return "Add your OpenAI API key in Daily Dashboard settings before using AI features.";
  }

  async getUpcomingCalendarSnapshot(now: Date = new Date()): Promise<CalendarSnapshot> {
    if (!this.data.settings.calendarEnabled) {
      return {
        reminders: [],
        enabled: false
      };
    }

    const reminders = this.getCalendarOccurrencesInRange(now, new Date(now.getTime() + this.data.settings.calendarLookaheadHours * 60 * 60 * 1000))
      .map((event) => this.toCalendarReminderItem(event))
      .filter((item) => this.isCalendarReminderVisible(item, now))
      .map((item) => ({
        ...item,
        warningLevel: this.getCalendarReminderWarningLevel(item, now)
      }))
      .sort((left, right) => left.start.localeCompare(right.start));

    const snapshot: CalendarSnapshot = {
      reminders,
      enabled: true
    };
    this.maybeWarnUpcomingCalendarEvents(snapshot.reminders, now);
    return snapshot;
  }

  getWeeklyAgenda(anchorDate: string = formatDateKey(new Date())): WeeklyAgendaDay[] {
    const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(anchorDate) ? new Date(`${anchorDate}T00:00:00`) : new Date();
    const { start } = getIsoWeekRange(baseDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const occurrences = this.getCalendarOccurrencesInRange(start, end);
    const byDate = new Map<string, CalendarEventOccurrence[]>();

    occurrences.forEach((event) => {
      const bucket = byDate.get(event.date) ?? [];
      bucket.push(event);
      byDate.set(event.date, bucket);
    });

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      return {
        date: dateKey,
        label: date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }),
        shortLabel: date.toLocaleDateString([], { weekday: "short" }),
        isToday: dateKey === formatDateKey(new Date()),
        events: (byDate.get(dateKey) ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: !event.startTime,
          category: event.category,
          notes: event.notes,
          isRecurring: event.isRecurring
        }))
      };
    });
  }

  getSuggestedTop3Candidates(todoSnapshot: TodoSnapshot | null, calendarSnapshot: CalendarSnapshot | null): SuggestedTop3Candidate[] {
    const entry = this.getTodayEntry();
    const existing = new Set([
      ...entry.todayFocus.map((item) => item.text.toLowerCase()),
      ...entry.nextUpFocus.map((item) => item.text.toLowerCase())
    ]);
    const seen = new Set<string>();
    const candidates: SuggestedTop3Candidate[] = [];
    const pushCandidate = (candidate: SuggestedTop3Candidate): void => {
      const key = candidate.text.trim().toLowerCase();
      if (!key || existing.has(key) || seen.has(key)) {
        return;
      }

      seen.add(key);
      candidates.push(candidate);
    };

    (calendarSnapshot?.reminders ?? []).slice(0, 3).forEach((reminder) => {
      pushCandidate({
        id: `calendar-${reminder.id}`,
        text: reminder.title,
        notes: reminder.notes,
        estimateMinutes: this.getCalendarReminderEstimateMinutes(reminder.start, reminder.end, reminder.allDay),
        reason: `${reminder.warningLevel === "warning" ? "Calendar soon" : "Calendar"} • ${reminder.date}${reminder.allDay ? " all day" : ` ${reminder.start.slice(11, 16)}`}`,
        source: "calendar",
        calendarDate: reminder.date
      });
    });

    (todoSnapshot?.overdueTasks ?? []).slice(0, 3).forEach(({ project, task }) => {
      pushCandidate({
        id: `overdue-${project}-${task.text}`,
        text: task.text,
        notes: `Project ${project}${task.blockedReason ? ` • blocked ${task.blockedReason}` : ""}`,
        estimateMinutes: null,
        reason: `Overdue in ${project}${task.dueDate ? ` • due ${task.dueDate}` : ""}`,
        source: "overdue"
      });
    });

    (todoSnapshot?.projects ?? [])
      .flatMap((project) => project.dueRepeatingTaskDetails.map((task) => ({ project, task })))
      .sort((left, right) => (right.project.staleDays ?? 0) - (left.project.staleDays ?? 0))
      .slice(0, 3)
      .forEach(({ project, task }) => {
        pushCandidate({
          id: `repeating-${project.name}-${task.text}`,
          text: task.text,
          notes: `Project ${project.name} • repeating task`,
          estimateMinutes: null,
          reason: `Due repeating task${project.staleDays !== null ? ` • ${project.staleDays}d stale` : ""}`,
          source: "repeating"
        });
      });

    (todoSnapshot?.staleProjects ?? []).slice(0, 3).forEach((project) => {
      const task = project.nowTaskDetails[0] ?? project.nextTaskDetails[0] ?? project.laterTaskDetails[0] ?? project.dueRepeatingTaskDetails[0];
      if (!task) {
        return;
      }

      pushCandidate({
        id: `stale-${project.name}-${task.text}`,
        text: task.text,
        notes: `Project ${project.name} • ${project.focus || "stale project"}`,
        estimateMinutes: null,
        reason: `${project.name} has been stale for ${project.staleDays ?? 0}d`,
        source: "stale"
      });
    });

    (todoSnapshot?.dueSoonTasks ?? []).slice(0, 2).forEach(({ project, task }) => {
      pushCandidate({
        id: `due-soon-${project}-${task.text}`,
        text: task.text,
        notes: `Project ${project}`,
        estimateMinutes: null,
        reason: `Due soon${task.dueDate ? ` • ${task.dueDate}` : ""}`,
        source: "due-soon"
      });
    });

    return candidates.slice(0, 6);
  }

  async addFocusBlockToCalendar(input: {
    text: string;
    notes?: string;
    estimateMinutes?: number | null;
    date?: string;
  }): Promise<void> {
    const title = input.text.trim();
    if (!title) {
      new Notice("Focus block title is required.");
      return;
    }

    const date = typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())
      ? input.date.trim()
      : this.getTodayEntry().date;
    const durationMinutes = Number.isFinite(Number(input.estimateMinutes))
      ? clamp(Math.round(Number(input.estimateMinutes)), 15, 480)
      : 30;
    const slot = this.getSuggestedCalendarBlockSlot(date, durationMinutes);
    await this.addCalendarEvent({
      title,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      category: "work",
      notes: typeof input.notes === "string" && input.notes.trim().length > 0
        ? input.notes.trim()
        : "Blocked from dashboard focus planning.",
      repeatCadence: "none",
      repeatUntil: ""
    });
  }

  getCalendarEvents(): CalendarEventEntry[] {
    return [...this.data.calendarEvents].sort((left, right) => {
      const leftKey = `${left.date} ${left.startTime || "00:00"} ${left.title.toLowerCase()}`;
      const rightKey = `${right.date} ${right.startTime || "00:00"} ${right.title.toLowerCase()}`;
      return leftKey.localeCompare(rightKey);
    });
  }

  getCalendarEventsForDate(date: string): CalendarEventOccurrence[] {
    return this.getCalendarOccurrencesForDate(date);
  }

  getCalendarEventEntry(eventId: string): CalendarEventEntry | null {
    return this.data.calendarEvents.find((event) => event.id === eventId) ?? null;
  }

  async updateCalendarEvent(eventId: string, input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category: CalendarEventCategory;
    notes: string;
    repeatCadence: CalendarRepeatCadence;
    repeatUntil: string;
  }): Promise<void> {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new Notice("That calendar event could not be found.");
      return;
    }

    const normalized = this.validateCalendarEventInput(input);
    if (!normalized) {
      return;
    }

    this.data.calendarEvents = this.data.calendarEvents
      .map((event) => event.id === eventId
        ? {
            ...event,
            title: normalized.title,
            date: normalized.date,
            startTime: normalized.startTime,
            endTime: normalized.endTime,
            category: normalized.category,
            notes: normalized.notes,
            repeatCadence: normalized.repeatCadence,
            repeatUntil: normalized.repeatUntil,
            updatedAt: formatPreciseDateTimeKey(new Date())
          }
        : event)
      .sort((left, right) => `${left.date} ${left.startTime || "00:00"}`.localeCompare(`${right.date} ${right.startTime || "00:00"}`));
    await this.syncCalendarArtifacts([existingEvent.date, normalized.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Updated calendar event for ${normalized.date}.`);
  }

  async updateCalendarOccurrence(eventId: string, originalDate: string, input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category: CalendarEventCategory;
    notes: string;
  }): Promise<void> {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new Notice("That calendar series could not be found.");
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

    const timestamp = formatPreciseDateTimeKey(new Date());
    this.data.calendarEvents = this.data.calendarEvents.map((event) => {
      if (event.id !== eventId) {
        return event;
      }

      const nextExceptions = [
        ...event.occurrenceExceptions.filter((exception) => exception.originalDate !== originalDate),
        {
          originalDate,
          kind: normalized.date === originalDate
            && normalized.title === event.title
            && normalized.startTime === event.startTime
            && normalized.endTime === event.endTime
            && normalized.notes === event.notes
            ? "move"
            : "move",
          date: normalized.date,
          startTime: normalized.startTime,
          endTime: normalized.endTime,
          title: normalized.title,
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

    await this.syncCalendarArtifacts([originalDate, normalized.date, existingEvent.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Updated occurrence for ${originalDate}.`);
  }

  async applyCalendarOccurrenceException(eventId: string, originalDate: string, kind: Exclude<CalendarOccurrenceExceptionKind, "move">): Promise<void> {
    const existingEvent = this.data.calendarEvents.find((event) => event.id === eventId);
    if (!existingEvent) {
      new Notice("That calendar series could not be found.");
      return;
    }

    const timestamp = formatPreciseDateTimeKey(new Date());
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
          startTime: event.startTime,
          endTime: event.endTime,
          category: event.category,
          title: event.title,
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

    await this.syncCalendarArtifacts([originalDate, existingEvent.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`${kind === "skip" ? "Skipped" : "Cancelled"} occurrence on ${originalDate}.`);
  }

  async clearCalendarOccurrenceException(eventId: string, originalDate: string): Promise<void> {
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
        updatedAt: formatPreciseDateTimeKey(new Date())
      };
    });

    this.data.calendarEvents = nextEvents;
    await this.syncCalendarArtifacts([originalDate, existingEvent.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Restored occurrence on ${originalDate} to its series defaults.`);
  }

  async addCalendarEvent(input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category: CalendarEventCategory;
    notes: string;
    repeatCadence: CalendarRepeatCadence;
    repeatUntil: string;
  }): Promise<void> {
    const normalized = this.validateCalendarEventInput(input);
    if (!normalized) {
      return;
    }

    const timestamp = formatPreciseDateTimeKey(new Date());
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
    await this.syncCalendarArtifacts([normalized.date]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Added calendar event for ${normalized.date}.`);
  }

  async removeCalendarEvent(eventId: string): Promise<void> {
    const nextEvents = this.data.calendarEvents.filter((event) => event.id !== eventId);
    if (nextEvents.length === this.data.calendarEvents.length) {
      return;
    }

    this.data.calendarEvents = nextEvents;
    await this.syncCalendarArtifacts();
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  getFocusDisplayItems(snapshot: CalendarSnapshot | null = null): DashboardFocusDisplayItem[] {
    const entry = this.getTodayEntry();
    const focusItems: DashboardFocusDisplayItem[] = entry.todayFocus.map((item, index) => ({
      kind: "focus",
      id: `focus-${index}-${item.text.toLowerCase()}`,
      text: item.text,
      notes: item.notes,
      estimateMinutes: item.estimateMinutes,
      status: item.status,
      workSessions: item.workSessions,
      completedAt: item.completedAt,
      trackedMinutes: getTrackedMinutes(item.workSessions),
      isActive: item.status === "working" && item.workSessions.some((session) => session.end === null)
    }));

    const reminderItems = (snapshot?.reminders ?? [])
      .filter((reminder) => !entry.todayFocus.some((item) => item.text.trim().toLowerCase() === reminder.title.trim().toLowerCase()))
      .map((reminder) => ({
        kind: "reminder" as const,
        id: `reminder-${reminder.id}-${reminder.start}`,
        sourceEventId: reminder.id,
        text: reminder.title,
        status: "reminder" as const,
        workSessions: [],
        completedAt: null,
        trackedMinutes: 0,
        isActive: false,
        calendarDate: reminder.date,
        calendarStart: reminder.start,
        calendarEnd: reminder.end,
        allDay: reminder.allDay,
        calendarNotes: reminder.notes,
        repeatCadence: reminder.repeatCadence,
        warningLevel: reminder.warningLevel
      }));

    return [...focusItems, ...reminderItems];
  }

  getNextUpFocusItems(date: string = this.getTodayEntry().date): NextUpFocusItem[] {
    const entry = this.getOrCreateEntry(date);
    return [...entry.nextUpFocus];
  }

  getCarryForwardFocusCandidates(date: string = this.getTodayEntry().date): string[] {
    const entry = this.getOrCreateEntry(date);
    const previousEntry = this.getPreviousEntry(date);
    if (!previousEntry) {
      return [];
    }

    const existingTexts = new Set(entry.todayFocus.map((item) => item.text.trim().toLowerCase()));
    return previousEntry.todayFocus
      .filter((item) => item.status !== "done")
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0)
      .filter((text) => !existingTexts.has(text.toLowerCase()));
  }

  async carryForwardUnfinishedFocusItems(): Promise<number> {
    const entry = this.getTodayEntry();
    const candidates = this.getCarryForwardFocusCandidates(entry.date);
    const availableSlots = Math.max(0, 3 - entry.todayFocus.filter((item) => item.status !== "done").length);
    const accepted = candidates.slice(0, availableSlots);

    if (accepted.length === 0) {
      new Notice(candidates.length > 0
        ? "No Top 3 slots are available for carry-forward items."
        : "No unfinished Top 3 items were found on the previous logical day.");
      return 0;
    }

    entry.todayFocus = [...entry.todayFocus, ...accepted.map((text) => this.createTodayFocusItem(text))];
    await this.persistEntry(entry);
    new Notice(`Carried forward ${accepted.length} unfinished Top 3 item${accepted.length === 1 ? "" : "s"}.`);
    return accepted.length;
  }

  private toCalendarReminderItem(event: CalendarEventOccurrence): CalendarSnapshot["reminders"][number] {
    const startDate = this.getCalendarOccurrenceStartDate(event);
    const endDate = this.getCalendarOccurrenceEndDate(event);
    return {
      id: event.sourceEventId,
      title: event.title,
      date: event.date,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      notes: event.notes,
      repeatCadence: event.repeatCadence,
      allDay: event.startTime.length === 0,
      warningLevel: "upcoming"
    };
  }

  getCalendarOccurrencesForDate(date: string): CalendarEventOccurrence[] {
    const target = new Date(`${date}T00:00:00`);
    return this.getCalendarOccurrencesInRange(target, target)
      .filter((event) => event.date === date)
      .sort((left, right) => `${left.startTime || "00:00"} ${left.title.toLowerCase()}`.localeCompare(`${right.startTime || "00:00"} ${right.title.toLowerCase()}`));
  }

  private getCalendarOccurrencesInRange(start: Date, end: Date): CalendarEventOccurrence[] {
    const safeStart = this.startOfToday(start);
    const safeEnd = this.startOfToday(end);
    const occurrences: CalendarEventOccurrence[] = [];
    const seenOccurrenceIds = new Set<string>();

    this.getCalendarEvents().forEach((event) => {
      let cursor = new Date(`${event.date}T00:00:00`);
      const repeatUntil = event.repeatUntil ? new Date(`${event.repeatUntil}T00:00:00`) : null;
      const hardLimit = repeatUntil ?? new Date(Math.min(safeEnd.getTime(), new Date(safeStart.getFullYear() + 2, safeStart.getMonth(), safeStart.getDate()).getTime()));
      const exceptionMap = new Map(event.occurrenceExceptions.map((exception) => [exception.originalDate, exception]));

      while (cursor.getTime() <= hardLimit.getTime()) {
        const originalDate = formatDateKey(cursor);
        const exception = exceptionMap.get(originalDate);
        const occurrenceDate = exception?.kind === "move" ? exception.date : originalDate;
        if ((!exception || exception.kind === "move") && this.isDateWithinRange(occurrenceDate, safeStart, safeEnd)) {
          const occurrenceId = `${event.id}:${originalDate}`;
          occurrences.push({
            id: occurrenceId,
            sourceEventId: event.id,
            originalDate,
            title: exception?.kind === "move" ? exception.title : event.title,
            date: occurrenceDate,
            startTime: exception?.kind === "move" ? exception.startTime : event.startTime,
            endTime: exception?.kind === "move" ? exception.endTime : event.endTime,
            category: exception?.kind === "move" ? exception.category : event.category,
            notes: exception?.kind === "move" ? exception.notes : event.notes,
            repeatCadence: event.repeatCadence,
            repeatUntil: event.repeatUntil,
            isRecurring: event.repeatCadence !== "none",
            isException: Boolean(exception),
            exceptionKind: exception?.kind
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

      event.occurrenceExceptions
        .filter((exception) => exception.kind === "move")
        .forEach((exception) => {
          const occurrenceId = `${event.id}:${exception.originalDate}`;
          if (seenOccurrenceIds.has(occurrenceId) || !this.isDateWithinRange(exception.date, safeStart, safeEnd)) {
            return;
          }

          occurrences.push({
            id: occurrenceId,
            sourceEventId: event.id,
            originalDate: exception.originalDate,
            title: exception.title,
            date: exception.date,
            startTime: exception.startTime,
            endTime: exception.endTime,
            category: exception.category,
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

  private getCalendarReminderEstimateMinutes(start: string, end: string, allDay: boolean): number | null {
    if (allDay) {
      return null;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    return minutes > 0 && minutes <= 240 ? minutes : null;
  }

  private getSuggestedCalendarBlockSlot(date: string, durationMinutes: number): { startTime: string; endTime: string } {
    const targetDate = formatDateKey(new Date()) === date ? new Date() : new Date(`${date}T09:00:00`);
    let candidateMinutes = formatDateKey(new Date()) === date
      ? Math.max(this.roundUpMinutes(targetDate.getHours() * 60 + targetDate.getMinutes(), 30), 6 * 60)
      : 9 * 60;
    const timedEvents = this.getCalendarEventsForDate(date)
      .filter((event) => event.startTime)
      .map((event) => ({
        start: this.getClockMinutes(event.startTime),
        end: this.getClockMinutes(event.endTime || event.startTime) + (event.endTime ? 0 : 30)
      }))
      .sort((left, right) => left.start - right.start);

    timedEvents.forEach((event) => {
      if (candidateMinutes + durationMinutes <= event.start) {
        return;
      }

      if (candidateMinutes < event.end) {
        candidateMinutes = this.roundUpMinutes(event.end, 30);
      }
    });

    if (candidateMinutes + durationMinutes > 24 * 60) {
      candidateMinutes = Math.max(6 * 60, (24 * 60) - durationMinutes);
    }

    return {
      startTime: this.formatClockMinutes(candidateMinutes),
      endTime: this.formatClockMinutes(Math.min(candidateMinutes + durationMinutes, (24 * 60) - 1))
    };
  }

  private getClockMinutes(value: string): number {
    const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
    return ((Number.isFinite(hours) ? hours : 0) * 60) + (Number.isFinite(minutes) ? minutes : 0);
  }

  private formatClockMinutes(totalMinutes: number): string {
    const normalized = Math.max(0, Math.min((24 * 60) - 1, totalMinutes));
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
  }

  private roundUpMinutes(totalMinutes: number, stepMinutes: number): number {
    return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
  }

  private isDateWithinRange(dateKey: string, start: Date, end: Date): boolean {
    const date = new Date(`${dateKey}T00:00:00`);
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
  }

  private advanceCalendarOccurrence(date: Date, cadence: CalendarRepeatCadence): Date {
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

  private isCalendarReminderVisible(item: CalendarSnapshot["reminders"][number], now: Date): boolean {
    const start = new Date(item.start);
    const end = new Date(item.end);
    const lookaheadMs = this.data.settings.calendarLookaheadHours * 60 * 60 * 1000;
    if (item.allDay) {
      const startOfDay = new Date(start);
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay.getTime() >= this.startOfToday(now).getTime()
        && startOfDay.getTime() <= this.startOfToday(new Date(now.getTime() + lookaheadMs)).getTime();
    }

    return end.getTime() >= now.getTime() && start.getTime() <= now.getTime() + lookaheadMs;
  }

  private maybeWarnUpcomingCalendarEvents(reminders: CalendarSnapshot["reminders"], now: Date): void {
    const currentDay = formatDateKey(now);
    if (this.calendarWarningDay !== currentDay) {
      this.calendarWarningDay = currentDay;
      this.warnedCalendarEventKeys.clear();
    }

    const warningWindowMs = this.data.settings.calendarWarningHours * 60 * 60 * 1000;
    reminders
      .map((reminder) => ({
        ...reminder,
        warningLevel: this.getCalendarReminderWarningLevel(reminder, now)
      }))
      .filter((event) => {
        const startTime = new Date(event.start).getTime();
        if (event.allDay) {
          const startOfDay = this.startOfToday(new Date(event.start));
          return startOfDay.getTime() >= this.startOfToday(now).getTime()
            && startOfDay.getTime() - this.startOfToday(now).getTime() <= warningWindowMs;
        }

        return startTime >= now.getTime() && startTime - now.getTime() <= warningWindowMs;
      })
      .forEach((event) => {
        const eventKey = `${currentDay}|${event.id}|${event.start}`;
        if (this.warnedCalendarEventKeys.has(eventKey)) {
          return;
        }

        this.warnedCalendarEventKeys.add(eventKey);
        const timeLabel = this.formatCalendarEventWindow(new Date(event.start), new Date(event.end), event.allDay);
        new Notice(`Upcoming activity: ${event.title} • ${timeLabel}`, 10000);
      });
  }

  private getCalendarReminderWarningLevel(reminder: CalendarSnapshot["reminders"][number], now: Date): "warning" | "upcoming" {
    const warningWindowMs = this.data.settings.calendarWarningHours * 60 * 60 * 1000;
    const start = new Date(reminder.start);
    if (reminder.allDay) {
      const dayOffset = this.startOfToday(start).getTime() - this.startOfToday(now).getTime();
      return dayOffset <= warningWindowMs ? "warning" : "upcoming";
    }

    return start.getTime() - now.getTime() <= warningWindowMs ? "warning" : "upcoming";
  }

  private getCalendarOccurrenceStartDate(event: Pick<CalendarEventOccurrence, "date" | "startTime">): Date {
    if (!event.startTime) {
      return new Date(`${event.date}T00:00:00`);
    }

    return new Date(`${event.date}T${event.startTime}:00`);
  }

  private getCalendarOccurrenceEndDate(event: Pick<CalendarEventOccurrence, "date" | "startTime" | "endTime">): Date {
    if (!event.endTime) {
      return event.startTime
        ? new Date(`${event.date}T${event.startTime}:00`)
        : new Date(`${event.date}T23:59:00`);
    }

    return new Date(`${event.date}T${event.endTime}:00`);
  }

  private startOfToday(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private formatCalendarEventWindow(start: Date, end: Date, allDay: boolean): string {
    if (allDay) {
      return "All day";
    }

    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleString([], sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleString([], { hour: "numeric", minute: "2-digit" });
    return `${startLabel} - ${endLabel}`;
  }

  getAiStatus(): AiStatus {
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

    await this.syncCalendarArtifacts();

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

  async updateWakeQualityScore(value: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.wakeQualityScore = clamp(value, 0, 5);
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

  async addEnergyCheckIn(score: number, note = ""): Promise<void> {
    const entry = this.getTodayEntry();
    entry.energyCheckIns = [
      {
        loggedAt: formatDateTimeKey(new Date()),
        score: clamp(Math.round(score), 1, 5),
        note: note.trim()
      },
      ...entry.energyCheckIns
    ].slice(0, 24);
    await this.persistEntry(entry);
  }

  async removeEnergyCheckIn(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.energyCheckIns = entry.energyCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
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

  async generateDailyDietInsight(): Promise<void> {
    const entry = this.getTodayEntry();
    if (entry.foodLog.length === 0) {
      new Notice("Log at least one food entry before asking for a diet summary.");
      return;
    }

    if (!this.getResolvedAiApiKey()) {
      new Notice(this.getAiConfigurationMessage());
      return;
    }

    if (this.isAiBusy) {
      new Notice("An AI request is already running.");
      return;
    }

    this.isAiBusy = true;
    this.refreshDashboardViews();

    try {
      const foodLines = entry.foodLog.map((item) => `${item.loggedAt}: ${item.amount}x ${item.text}`).join("\n");
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
      new Notice("Diet summary updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new Notice(`Diet summary failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
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
    new Notice(`Ended logical day ${entry.date}.`);
  }

  async openLogicalDayRepairFlow(): Promise<void> {
    new LogicalDayRepairModal(this.app, this).open();
  }

  getDayRepairInput(date: string = this.getTodayKey()): DayRepairInput {
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
    new Notice(`Updated repair data for ${normalizedDate}.`);
    return true;
  }

  async startWorkSession(tag = ""): Promise<void> {
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
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.workSessions = [...entry.workSessions, { start: timestamp, end: null, tag: tag.trim() }];
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

    const timestamp = formatDateTimeKey(new Date());
    activeSession.end = timestamp;
    this.closeOpenTodayFocusSessions(entry, timestamp);
    await this.persistEntry(entry);
    new Notice("Work session stopped.");
  }

  async startNapSession(tag = ""): Promise<void> {
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
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.napSessions = [...entry.napSessions, { start: timestamp, end: null, tag: tag.trim() }];
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

  async startRelaxSession(tag = ""): Promise<void> {
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
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.relaxSessions = [...entry.relaxSessions, { start: timestamp, end: null, tag: tag.trim() }];
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

  async startBreakSession(tag = ""): Promise<void> {
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
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: tag.trim() }];
    await this.persistEntry(entry);
    new Notice("Break started.");
  }

  async pauseAllAndStartBreak(): Promise<void> {
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
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: "recovery" }];
    await this.persistEntry(entry);
    new Notice("Paused active sessions and started a break.");
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

  async startPoopSession(tag = ""): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before tracking a bowel movement.");
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.poopSessions.some((session) => session.end === null)) {
      new Notice("A bowel movement session is already active.");
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeCompetingSessions(entry, timestamp, "poop");
    this.closeOpenTodayFocusSessions(entry, timestamp);
    this.ensureWakeAndDayStartFromActivity(entry, timestamp);
    entry.poopSessions = [...entry.poopSessions, { start: timestamp, end: null, tag: tag.trim() }];
    await this.persistEntry(entry);
    new Notice("Bowel movement tracking started.");
  }

  async stopPoopSession(): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.poopSessions].reverse().find((session) => session.end === null);
    if (!activeSession) {
      new Notice("No bowel movement session is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice("Bowel movement tracking stopped.");
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
    await this.addTodayFocusItemWithDetails({ text: value });
  }

  async addTodayFocusItemWithDetails(input: {
    text: string;
    notes?: string;
    estimateMinutes?: number | null;
  }): Promise<void> {
    const trimmedValue = input.text.trim();
    if (!trimmedValue) {
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.todayFocus.some((item) => item.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That Top 3 item is already listed.");
      return;
    }

    const activeFocusCount = entry.todayFocus.filter((item) => item.status !== "done").length;
    if (activeFocusCount >= 3) {
      new Notice("Top 3 already has three active items. Finish or remove one before adding another.");
      return;
    }

    const normalizedEstimate = Number.isFinite(Number(input.estimateMinutes))
      ? clamp(Math.round(Number(input.estimateMinutes)), 0, 1440)
      : null;
    entry.todayFocus = [
      ...entry.todayFocus,
      this.createTodayFocusItem(
        trimmedValue,
        typeof input.notes === "string" ? input.notes.trim() : "",
        normalizedEstimate
      )
    ];
    await this.persistEntry(entry);
  }

  async updateTodayFocusItem(index: number, value: string): Promise<boolean> {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      new Notice("Top 3 item text is required.");
      return false;
    }

    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }

    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That Top 3 item is already listed.");
      return false;
    }

    item.text = trimmedValue;
    await this.persistEntry(entry);
    return true;
  }

  async updateTodayFocusDetails(index: number, updates: {
    text: string;
    notes?: string;
    estimateMinutes?: number | null;
  }): Promise<boolean> {
    const trimmedValue = updates.text.trim();
    if (!trimmedValue) {
      new Notice("Top 3 item text is required.");
      return false;
    }

    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }

    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That Top 3 item is already listed.");
      return false;
    }

    item.text = trimmedValue;
    item.notes = typeof updates.notes === "string" ? updates.notes.trim() : "";
    item.estimateMinutes = Number.isFinite(Number(updates.estimateMinutes))
      ? clamp(Math.round(Number(updates.estimateMinutes)), 0, 1440)
      : null;
    await this.persistEntry(entry);
    return true;
  }

  async reorderTodayFocusItems(fromIndex: number, toIndex: number): Promise<boolean> {
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

  async startTodayFocusItem(index: number, tag = ""): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before tracking a Top 3 item.");
      return;
    }

    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    this.closeOpenTodayFocusSessions(entry, timestamp, index);
    item.status = "working";
    item.completedAt = null;
    if (!item.workSessions.some((session) => session.end === null)) {
      item.workSessions = [...item.workSessions, { start: timestamp, end: null, tag: tag.trim() }];
    }
    await this.persistEntry(entry);
  }

  async stopTodayFocusItem(index: number): Promise<void> {
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
      activeSession.end = formatDateTimeKey(new Date());
    }
    if (item.status === "working") {
      item.status = "pending";
    }
    await this.persistEntry(entry);
  }

  async completeTodayFocusItem(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
    const activeSession = [...item.workSessions].reverse().find((session) => session.end === null);
    if (activeSession) {
      activeSession.end = timestamp;
    }
    item.status = "done";
    item.completedAt = timestamp;
    await this.persistEntry(entry);
  }

  async reopenTodayFocusItem(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return;
    }

    item.status = "pending";
    item.completedAt = null;
    await this.persistEntry(entry);
  }

  async removeTodayFocusItem(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async addNextUpFocusItem(input: {
    text: string;
    notes?: string;
    estimateMinutes?: number | null;
  }): Promise<boolean> {
    const text = input.text.trim();
    if (!text) {
      return false;
    }

    const entry = this.getTodayEntry();
    const alreadyExists = [...entry.todayFocus.map((item) => item.text), ...entry.nextUpFocus.map((item) => item.text)]
      .some((candidate) => candidate.toLowerCase() === text.toLowerCase());
    if (alreadyExists) {
      new Notice("That item is already listed in Top 3 or Next Up.");
      return false;
    }

    entry.nextUpFocus = [
      ...entry.nextUpFocus,
      {
        text,
        notes: typeof input.notes === "string" ? input.notes.trim() : "",
        estimateMinutes: Number.isFinite(Number(input.estimateMinutes))
          ? clamp(Math.round(Number(input.estimateMinutes)), 0, 1440)
          : null
      }
    ];
    await this.persistEntry(entry);
    return true;
  }

  async promoteNextUpFocusItem(index: number): Promise<boolean> {
    const entry = this.getTodayEntry();
    const item = entry.nextUpFocus[index];
    if (!item) {
      return false;
    }

    const activeFocusCount = entry.todayFocus.filter((candidate) => candidate.status !== "done").length;
    if (activeFocusCount >= 3) {
      new Notice("Top 3 already has three active items. Finish or remove one before promoting Next Up.");
      return false;
    }

    if (!entry.todayFocus.some((candidate) => candidate.text.toLowerCase() === item.text.toLowerCase())) {
      entry.todayFocus = [...entry.todayFocus, this.createTodayFocusItem(item.text, item.notes, item.estimateMinutes)];
    }
    entry.nextUpFocus = entry.nextUpFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
    return true;
  }

  async removeNextUpFocusItem(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.nextUpFocus = entry.nextUpFocus.filter((_, candidateIndex) => candidateIndex !== index);
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
    if (!this.getResolvedAiApiKey()) {
      new Notice(this.getAiConfigurationMessage());
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
      renderDailyLog(todayEntry, this.getHabitDefinitions(), this.getNextEntry(todayEntry.date), this.getCalendarOccurrencesForDate(todayEntry.date)),
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
    if (!this.data.settings.aiEmbeddingsEnabled || !this.getResolvedAiApiKey()) {
      return null;
    }

    const embeddings = await this.requestChunkEmbeddings([{ id: "query", text }]);
    return embeddings.get("query") ?? null;
  }

  private async requestChunkEmbeddings(chunks: Array<{ id: string; text: string }>): Promise<Map<string, number[]>> {
    if (!this.data.settings.aiEmbeddingsEnabled) {
      return new Map();
    }

    const apiKey = this.getResolvedAiApiKey();
    if (!apiKey) {
      throw new Error(this.getAiConfigurationMessage());
    }

    if (chunks.length === 0) {
      return new Map();
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

  getHabitBestStreak(habitId: string): number {
    const habitDefinition = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habitDefinition) {
      return 0;
    }

    const dates = Object.keys(this.data.entries).sort();
    let bestStreak = 0;
    let currentStreak = 0;

    for (const date of dates) {
      const entry = this.data.entries[date];
      const value = entry.habits[habitId] ?? 0;
      if (value >= habitDefinition.target) {
        currentStreak += 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        continue;
      }

      currentStreak = 0;
    }

    return bestStreak;
  }

  refreshDashboardViews(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DailyDashboardView) {
        void view.requestRefresh();
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
    const calendarEvents = Array.isArray(loaded?.calendarEvents)
      ? loaded.calendarEvents
          .map((event) => this.normalizeCalendarEvent(event))
          .filter((event): event is CalendarEventEntry => event !== null)
      : [];

    const dayState = normalizeDayState(loaded?.dayState, entries);

    return {
      settings,
      entries,
      calendarEvents,
      dayState,
      noteIndex: normalizeNoteIndexCache(loaded?.noteIndex)
    };
  }

  private async loadPluginData(): Promise<void> {
    this.data = await this.buildDataFromStorage();
    await this.cleanupStaleTrackedMinuteOverrides();
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
      wakeQualityScore: clamp(Number(entry.wakeQualityScore ?? 0), 0, 5),
      sleepTime: typeof entry.sleepTime === "string" ? entry.sleepTime : "",
      sleepMinutesOverride: Number.isFinite(Number(entry.sleepMinutesOverride)) ? clamp(Number(entry.sleepMinutesOverride), 0, 1440) : null,
      habits: normalizedHabits,
      habitEvents: normalizedHabitEvents,
      moodScore: clamp(Number(entry.moodScore ?? 0), 0, 5),
      energyScore: clamp(Number(entry.energyScore ?? 0), 0, 5),
      anxietyScore: clamp(Number(entry.anxietyScore ?? 0), 0, 5),
      todayFocus: normalizeTodayFocusItems(entry.todayFocus),
      nextUpFocus: normalizeNextUpFocusItems(entry.nextUpFocus),
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(normalizedHabits, settings.habitDefinitions),
      foodLog: Array.isArray(entry.foodLog)
        ? entry.foodLog
            .map((item) => normalizeFoodEntry(item))
            .filter((item): item is FoodEntry => item !== null)
        : [],
      energyCheckIns: Array.isArray(entry.energyCheckIns)
        ? entry.energyCheckIns
            .filter((item): item is EnergyCheckIn => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string"))
            .map((item) => ({
              loggedAt: item.loggedAt,
              score: clamp(Number(item.score ?? 0), 1, 5),
              note: typeof item.note === "string" ? item.note.trim() : ""
            }))
        : [],
      dietInsight: typeof entry.dietInsight === "string" ? entry.dietInsight : "",
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      dreamLog: typeof entry.dreamLog === "string" ? entry.dreamLog : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions)
        ? entry.workSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : ""
            }))
        : [],
      workMinutesOverride: Number.isFinite(Number(entry.workMinutesOverride)) ? clamp(Number(entry.workMinutesOverride), 0, 1440) : null,
      napSessions: Array.isArray(entry.napSessions)
        ? entry.napSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : ""
            }))
        : [],
      napMinutesOverride: Number.isFinite(Number(entry.napMinutesOverride)) ? clamp(Number(entry.napMinutesOverride), 0, 1440) : null,
      relaxSessions: Array.isArray(entry.relaxSessions)
        ? entry.relaxSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : ""
            }))
        : [],
      relaxMinutesOverride: Number.isFinite(Number(entry.relaxMinutesOverride)) ? clamp(Number(entry.relaxMinutesOverride), 0, 1440) : null,
      breakSessions: Array.isArray(entry.breakSessions)
        ? entry.breakSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : ""
            }))
        : [],
      breakMinutesOverride: Number.isFinite(Number(entry.breakMinutesOverride)) ? clamp(Number(entry.breakMinutesOverride), 0, 1440) : null,
      poopSessions: Array.isArray(entry.poopSessions)
        ? entry.poopSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : ""
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

  private getEffectiveTrackedEntry(entry: DailyEntry): DailyEntry {
    return this.withCleanTrackedMinuteOverrides(entry);
  }

  private withCleanTrackedMinuteOverrides(entry: DailyEntry): DailyEntry {
    const normalizedEntry = {
      ...entry,
      workSessions: [...entry.workSessions],
      napSessions: [...entry.napSessions],
      relaxSessions: [...entry.relaxSessions],
      breakSessions: [...entry.breakSessions]
    };
    return this.cleanTrackedMinuteOverrides(normalizedEntry) ? normalizedEntry : entry;
  }

  private cleanTrackedMinuteOverrides(entry: DailyEntry): boolean {
    let changed = false;
    const isActiveDay = this.data.dayState.status === "in-progress" && entry.date === this.data.dayState.activeDate;

    const clearOverride = (key: "workMinutesOverride" | "napMinutesOverride" | "relaxMinutesOverride" | "breakMinutesOverride", sessions: WorkSession[]): void => {
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

  private cleanSleepTiming(entry: DailyEntry): boolean {
    let changed = false;
    const previousEntry = this.getPreviousEntry(entry.date);
    const previousSleepTime = previousEntry?.sleepTime ?? "";
    const inferredWakeTime = this.getEarliestActivityTimestamp(entry, previousSleepTime);

    if (previousSleepTime) {
      if (entry.wakeTime && entry.wakeTime < previousSleepTime) {
        const nextWakeTime = inferredWakeTime ?? "";
        if (entry.wakeTime !== nextWakeTime) {
          entry.wakeTime = nextWakeTime;
          changed = true;
        }
      }

      if (entry.dayStartedAt && entry.dayStartedAt < previousSleepTime) {
        const nextDayStart = inferredWakeTime ?? entry.wakeTime ?? "";
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

  private getEarliestActivityTimestamp(entry: DailyEntry, minimumTimestamp = ""): string | null {
    const timestamps = [
      ...entry.workSessions.map((session) => session.start),
      ...entry.napSessions.map((session) => session.start),
      ...entry.relaxSessions.map((session) => session.start),
      ...entry.breakSessions.map((session) => session.start),
      ...entry.poopSessions.map((session) => session.start),
      ...entry.todayFocus.flatMap((item) => item.workSessions.map((session) => session.start)),
      ...entry.foodLog.map((item) => item.loggedAt ?? ""),
      ...entry.energyCheckIns.map((item) => item.loggedAt ?? ""),
      ...Object.values(entry.habitEvents).flat(),
      entry.dayEndedAt,
      entry.sleepTime
    ].filter((value): value is string => Boolean(value) && (!minimumTimestamp || value >= minimumTimestamp));

    return timestamps.sort()[0] ?? null;
  }

  private getRepairTimelineSessionsForEntry(entry: DailyEntry): RepairTimelineSession[] {
    return [
      ...this.buildRepairTimelineSessions(entry.workSessions, "work"),
      ...this.buildRepairTimelineSessions(entry.napSessions, "nap"),
      ...this.buildRepairTimelineSessions(entry.relaxSessions, "relax"),
      ...this.buildRepairTimelineSessions(entry.breakSessions, "break"),
      ...this.buildRepairTimelineSessions(entry.poopSessions, "poop")
    ].sort((left, right) => `${left.start}|${left.kind}`.localeCompare(`${right.start}|${right.kind}`));
  }

  private buildRepairTimelineSessions(sessions: WorkSession[], kind: RepairTimelineSessionKind): RepairTimelineSession[] {
    return sessions.map((session, index) => ({
      id: `${kind}-${index}-${session.start}-${session.end ?? "open"}`,
      kind,
      start: session.start,
      end: session.end ?? "",
      tag: session.tag
    }));
  }

  private normalizeRepairTimelineSessions(sessions: RepairTimelineSession[], date: string): RepairTimelineSession[] | null {
    const normalized: RepairTimelineSession[] = [];

    for (const [index, session] of sessions.entries()) {
      const label = `${session.kind} session ${index + 1}`;
      const start = this.normalizeRepairTimestamp(session.start, `${label} start`);
      const end = this.normalizeRepairTimestamp(session.end, `${label} end`);
      if (start === null || end === null) {
        return null;
      }
      if (!start || !end) {
        new Notice(`${label} needs both a start and end time.`);
        return null;
      }
      if (start.slice(0, 10) !== date || end.slice(0, 10) !== date) {
        new Notice(`${label} must stay on ${date}. Use the correct logical date before applying the repair.`);
        return null;
      }
      if (end <= start) {
        new Notice(`${label} must end after it starts.`);
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

  private extractRepairTimelineSessions(sessions: RepairTimelineSession[], kind: RepairTimelineSessionKind): WorkSession[] {
    return sessions
      .filter((session) => session.kind === kind)
      .map((session) => ({
        start: session.start,
        end: session.end,
        tag: session.tag.trim()
      }));
  }

  private ensureWakeAndDayStartFromActivity(entry: DailyEntry, timestamp: string): void {
    const previousSleepTime = this.getPreviousEntry(entry.date)?.sleepTime ?? "";
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

  private async cleanupStaleTrackedMinuteOverrides(): Promise<void> {
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

  private createEmptyEntry(date: string): DailyEntry {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }

  private normalizeCalendarEvent(event: Partial<CalendarEventEntry> | undefined): CalendarEventEntry | null {
    if (!event || typeof event !== "object") {
      return null;
    }

    const title = typeof event.title === "string" ? event.title.trim() : "";
    const date = typeof event.date === "string" ? event.date.trim() : "";
    const startTime = typeof event.startTime === "string" ? event.startTime.trim() : "";
    const endTime = typeof event.endTime === "string" ? event.endTime.trim() : "";
    const category = event.category === "work"
      || event.category === "health"
      || event.category === "errands"
      || event.category === "social"
      ? event.category
      : "personal";
    const repeatCadence = event.repeatCadence === "daily"
      || event.repeatCadence === "weekly"
      || event.repeatCadence === "monthly"
      || event.repeatCadence === "yearly"
      ? event.repeatCadence
      : "none";
    const repeatUntil = typeof event.repeatUntil === "string" ? event.repeatUntil.trim() : "";
    const occurrenceExceptions = Array.isArray(event.occurrenceExceptions)
      ? event.occurrenceExceptions
          .filter((item): item is CalendarOccurrenceException => Boolean(item && typeof item === "object" && typeof item.originalDate === "string"))
          .map((item) => ({
            originalDate: item.originalDate.trim(),
            kind: item.kind === "skip" || item.kind === "cancel" ? item.kind : "move",
            date: typeof item.date === "string" ? item.date.trim() : item.originalDate.trim(),
            startTime: typeof item.startTime === "string" ? item.startTime.trim() : "",
            endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
            category: item.category === "work"
              || item.category === "health"
              || item.category === "errands"
              || item.category === "social"
              ? item.category
              : category,
            title: typeof item.title === "string" ? item.title : title,
            notes: typeof item.notes === "string" ? item.notes : "",
            updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
          }))
          .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.originalDate) && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
      : [];
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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
      startTime,
      endTime,
      category,
      notes: typeof event.notes === "string" ? event.notes : "",
      repeatCadence,
      repeatUntil,
      occurrenceExceptions,
      createdAt: typeof event.createdAt === "string" ? event.createdAt : "",
      updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : ""
    };
  }

  private validateCalendarEventInput(input: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    category: CalendarEventCategory;
    notes: string;
    repeatCadence: CalendarRepeatCadence;
    repeatUntil: string;
  }): Omit<CalendarEventEntry, "id" | "createdAt" | "updatedAt"> | null {
    const title = input.title.trim();
    const date = input.date.trim();
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    const category = input.category;
    const notes = input.notes.trim();
    const repeatCadence = input.repeatCadence;
    const repeatUntil = input.repeatUntil.trim();

    if (!title) {
      new Notice("Calendar event title is required.");
      return null;
    }

    if (!["work", "health", "errands", "social", "personal"].includes(category)) {
      new Notice("Calendar event category is invalid.");
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      new Notice("Calendar event date must use YYYY-MM-DD.");
      return null;
    }

    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      new Notice("Start time must use HH:MM.");
      return null;
    }

    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      new Notice("End time must use HH:MM.");
      return null;
    }

    if (startTime && endTime && endTime < startTime) {
      new Notice("End time must be after start time.");
      return null;
    }

    if (!["none", "daily", "weekly", "monthly", "yearly"].includes(repeatCadence)) {
      new Notice("Unsupported repeat cadence.");
      return null;
    }

    if (repeatUntil && !/^\d{4}-\d{2}-\d{2}$/.test(repeatUntil)) {
      new Notice("Repeat-until must use YYYY-MM-DD.");
      return null;
    }

    if (repeatUntil && repeatUntil < date) {
      new Notice("Repeat-until must be on or after the event date.");
      return null;
    }

    return {
      title,
      date,
      startTime,
      endTime,
      category,
      notes,
      repeatCadence,
      repeatUntil,
      occurrenceExceptions: []
    };
  }

  private createTodayFocusItem(text: string, notes = "", estimateMinutes: number | null = null): TodayFocusItem {
    return {
      text,
      notes,
      estimateMinutes,
      status: "pending",
      workSessions: [],
      completedAt: null
    };
  }

  async openQuickCaptureFocusFlow(): Promise<void> {
    new FocusCaptureModal(this.app, {
      mode: "capture",
      todayHasTop3Capacity: this.getTodayEntry().todayFocus.filter((item) => item.status !== "done").length < 3,
      onSubmit: async (payload) => {
        if (payload.destination === "top3") {
          await this.addTodayFocusItemWithDetails(payload);
          return;
        }

        await this.addNextUpFocusItem(payload);
      }
    }).open();
  }

  private closeOpenTodayFocusSessions(entry: DailyEntry, timestamp: string, activeIndex = -1): boolean {
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

  private closeCompetingSessions(entry: DailyEntry, timestamp: string, keepOpen: "work" | "nap" | "relax" | "break" | "poop"): void {
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
  }

  private getPreviousEntry(date: string): DailyEntry | undefined {
    const dates = Object.keys(this.data.entries).filter((entryDate) => entryDate < date).sort();
    const previousDate = dates.slice(-1)[0];
    return previousDate ? this.data.entries[previousDate] : undefined;
  }

  private getNextEntry(date: string): DailyEntry | undefined {
    const dates = Object.keys(this.data.entries).filter((entryDate) => entryDate > date).sort();
    const nextDate = dates[0];
    return nextDate ? this.data.entries[nextDate] : undefined;
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
    this.cleanTrackedMinuteOverrides(normalizedEntry);
    this.cleanSleepTiming(normalizedEntry);
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
      calendarEvents: this.data.calendarEvents,
      dayState: this.data.dayState,
      noteIndex: this.data.noteIndex
    });
  }

  private async persistNoteIndex(): Promise<void> {
    await this.savePluginData();
  }

  private async persistEntry(entry: DailyEntry): Promise<void> {
    this.cleanTrackedMinuteOverrides(entry);
    this.cleanSleepTiming(entry);
    this.data.entries[entry.date] = this.normalizeEntry({
      ...entry,
      lastEditedAt: formatPreciseDateTimeKey(new Date())
    }, entry.date);
    await this.syncDailyLog(this.data.entries[entry.date]);
    const previousEntry = this.getPreviousEntry(entry.date);
    if (previousEntry) {
      await this.syncDailyLog(previousEntry);
    }
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
    await this.maybeNotifyLogicalDayPrompts();

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
    const content = renderDailyLog(entry, this.getHabitDefinitions(), this.getNextEntry(entry.date), this.getCalendarOccurrencesForDate(entry.date));
    await this.upsertMarkdownFile(`${this.data.settings.dailyLogFolder}/${entry.date}.md`, content);
  }

  private buildLogicalDayPrompts(
    entry: DailyEntry,
    referenceDate: Date,
    lastActivityAt: string,
    inactiveMinutes: number | null,
    hasActiveSession: boolean,
    isRollover: boolean
  ): LogicalDayPrompt[] {
    const prompts: LogicalDayPrompt[] = [];
    const calendarDate = formatDateKey(referenceDate);
    const thresholdMinutes = isRollover ? 60 : referenceDate.getHours() >= 21 ? 120 : 240;

    if (
      !hasActiveSession
      && inactiveMinutes !== null
      && inactiveMinutes >= thresholdMinutes
      && !entry.dayEndedAt
      && lastActivityAt
      && this.hasMeaningfulLogicalDayActivity(entry)
    ) {
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

  private getLogicalDayLastActivityAt(entry: DailyEntry): string {
    return getEntryRecencyKey(entry);
  }

  private hasActiveLogicalDaySessions(entry: DailyEntry): boolean {
    return entry.workSessions.some((session) => session.end === null)
      || entry.napSessions.some((session) => session.end === null)
      || entry.relaxSessions.some((session) => session.end === null)
      || entry.breakSessions.some((session) => session.end === null)
      || entry.poopSessions.some((session) => session.end === null)
      || entry.todayFocus.some((item) => item.workSessions.some((session) => session.end === null));
  }

  private hasMeaningfulLogicalDayActivity(entry: DailyEntry): boolean {
    return entry.workSessions.length > 0
      || entry.napSessions.length > 0
      || entry.relaxSessions.length > 0
      || entry.breakSessions.length > 0
      || entry.poopSessions.length > 0
      || entry.foodLog.length > 0
      || entry.completedTasks.length > 0
      || entry.todayFocus.some((item) => item.workSessions.length > 0 || item.status === "done")
      || Object.values(entry.habitEvents).some((events) => events.length > 0)
      || entry.notes.trim().length > 0
      || entry.frictionLog.trim().length > 0;
  }

  private parseDashboardDateTime(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const parsed = new Date(normalized.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatDurationMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  private async maybeNotifyLogicalDayPrompts(referenceDate: Date = new Date()): Promise<void> {
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
        new Notice(`Day-end suggestion: ${entry.date} has been inactive for ${this.formatDurationMinutes(insights.inactiveMinutes ?? 0)}. End it when you're done.`, 9000);
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
        new Notice(`Late-night rollover: you are still logging to ${entry.date}. End the logical day when you want new activity on ${calendarDate}.`, 10000);
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

  private async syncCalendarArtifacts(seedDates: string[] = []): Promise<void> {
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

  private getCalendarArtifactDates(): string[] {
    const horizonEnd = new Date();
    horizonEnd.setDate(horizonEnd.getDate() + DailyDashboardPlugin.CALENDAR_ARTIFACT_HORIZON_DAYS);
    return Array.from(new Set(this.getCalendarOccurrencesInRange(new Date(), horizonEnd).map((event) => event.date))).sort();
  }

  private async syncCalendarDocument(): Promise<void> {
    const content = this.renderCalendarDocument();
    await this.upsertMarkdownFile(this.data.settings.calendarDocumentPath, content);
  }

  private async importCalendarEventsFromMarkdown(): Promise<void> {
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

  private async reloadCalendarDocumentFile(file: TFile): Promise<void> {
    if (normalizePath(file.path) !== normalizePath(this.data.settings.calendarDocumentPath)) {
      return;
    }

    await this.importCalendarEventsFromMarkdown();
  }

  private async readCalendarDocumentPayload(): Promise<CalendarDocumentPayload | null> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(this.data.settings.calendarDocumentPath));
    if (!(file instanceof TFile)) {
      return null;
    }

    const content = await this.app.vault.read(file);
    const match = content.match(/## Calendar Payload\s+```json\s*([\s\S]*?)\s*```/i);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[1]) as Partial<CalendarEventEntry>[];
      const events = Array.isArray(parsed)
        ? parsed
            .map((event) => this.normalizeCalendarEvent(event))
            .filter((event): event is CalendarEventEntry => event !== null)
        : [];
      return {
        updatedAt: "",
        eventCount: events.length,
        events
      };
    } catch (error) {
      console.error("Daily Dashboard could not parse calendar document payload", error);
      return null;
    }
  }

  private mergeCalendarEvents(primary: CalendarEventEntry[], secondary: CalendarEventEntry[]): CalendarEventEntry[] {
    const merged = new Map<string, CalendarEventEntry>();
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

  private haveCalendarEventsChanged(left: CalendarEventEntry[], right: CalendarEventEntry[]): boolean {
    return JSON.stringify(left) !== JSON.stringify(right);
  }

  private renderCalendarDocument(): string {
    const payload = JSON.stringify(this.data.calendarEvents, null, 2);
    const sourceLines = this.getCalendarEvents().length > 0
      ? this.getCalendarEvents().map((event) => {
          const timing = event.startTime
            ? `${event.date} ${event.startTime}${event.endTime ? ` -> ${event.endTime}` : ""}`
            : `${event.date} All day`;
          const category = ` • ${event.category}`;
          const recurrence = event.repeatCadence !== "none"
            ? ` • repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}`
            : "";
          const exceptions = event.occurrenceExceptions.length > 0
            ? ` • ${event.occurrenceExceptions.length} one-off change${event.occurrenceExceptions.length === 1 ? "" : "s"}`
            : "";
          const notes = event.notes ? ` • ${event.notes}` : "";
          return `- ${timing}: ${event.title}${category}${recurrence}${exceptions}${notes}`;
        })
      : ["- No calendar events yet."];
    const upcomingOccurrences = this.getCalendarOccurrencesInRange(new Date(), new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
      
    const upcomingLines = upcomingOccurrences.length > 0
      ? upcomingOccurrences.slice(0, 200).map((event) => {
          const timing = event.startTime
            ? `${event.date} ${event.startTime}${event.endTime ? ` -> ${event.endTime}` : ""}`
            : `${event.date} All day`;
          const category = ` • ${event.category}`;
          const recurrence = event.isRecurring ? ` • from ${event.repeatCadence} series` : "";
          const exception = event.isException
            ? ` • ${event.exceptionKind === "move" ? `moved from ${event.originalDate}` : `${event.exceptionKind} once on ${event.originalDate}`}`
            : "";
          const notes = event.notes ? ` • ${event.notes}` : "";
          return `- ${timing}: ${event.title}${category}${recurrence}${exception}${notes}`;
        })
      : ["- No upcoming occurrences."];

    return [
      "---",
      `updatedAt: ${formatDateTimeKey(new Date())}`,
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
