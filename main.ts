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
  formatActivitySessionLabel,
  foodEntryToIntakeEntry,
  formatDateKey,
  formatDateTimeKey,
  formatFileTimestamp,
  formatPreciseDateTimeKey,
  getHabitWeightedCompletion,
  getEntryRecencyKey,
  getIndexedFolderList,
  getRelevantIndexedNotes,
  isHabitDueOnDate,
  normalizeFoodEntry,
  normalizeFolderPath,
  normalizeActivitySession,
  normalizeExerciseEntry,
  normalizeIntakeEntry,
  normalizeNextUpFocusItems,
  normalizeWeightGoalMode,
  normalizeSymptomEntry,
  normalizeTodayFocusItems,
  normalizeNoteIndexCache,
  normalizeDayState,
  parseAiPromptTemplates,
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
  buildPersonalTrendSummary,
  buildGamificationSummary,
  buildSleepInsights,
  closeOpenActivitySessions,
  closeOpenBreakSessions,
  closeOpenNapSessions,
  closeOpenPoopSessions,
  closeOpenRelaxSessions,
  closeOpenWorkSessions,
  getTrackedBreakMinutes,
  getTrackedActivityMinutes,
  getTrackedMinutes,
  getTrackedNapMinutes,
  getTrackedPoopCount,
  getTrackedPoopMinutes,
  getTrackedRelaxMinutes,
  getSleepMinutesForDay,
  getTrackedWorkMinutes,
  parseDailyLogEntry,
  renderRecurringFrictionPatternsNote,
  renderDailyLog,
  renderGamificationReport,
  renderGamificationSectionLines,
  renderPersonalTrendSectionLines,
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
  repairMasterHubStructure,
  repairProjectNoteStructure,
  reconcileCompletedTasks,
  renderExistingProjectNoteTemplate,
  renderProjectNoteTemplate,
  renderTodoProjectBlock,
  sanitizeFileName,
  trimLeadingBlankLines,
  trimTrailingBlankLines,
  stripMarkdownExtension
} from "./src/dashboard-todo";
import {
  AddHabitModal,
  AskAiModal,
  AskResearchQuestionModal,
  CreateProjectModal,
  DailyDashboardSettingTab,
  DailyDashboardView,
  FirstRunSetupWizardModal,
  FocusCaptureModal,
  LogicalDayRepairModal,
  ProjectReviewModal,
  PromoteTaskModal
} from "./src/dashboard-ui";
import {
  ACTIVITY_SESSION_KIND_OPTIONS,
  CORE_SESSION_TRACKER_OPTIONS,
  DEFAULT_BUDGET_CATEGORIES,
  DEFAULT_SETTINGS,
  IMAGE_EXTENSIONS,
  VIEW_TYPE_DAILY_DASHBOARD,
  type AiArtifact,
  type AiRelevantNote,
  type AiStatus,
  type AiStructuredPayload,
  type ActivitySession,
  type ActivitySessionKind,
  type ArchivedTaskSnapshot,
  type ArchiveMaintenanceResult,
  type CalendarDocumentPayload,
  type CalendarEventCategory,
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
  type DashboardNotificationItem,
  type DashboardNotificationSound,
  type DashboardSettings,
  type DayLifecycleState,
  type DashboardUiState,
  type AnxietyCheckIn,
  type EnergyCheckIn,
  type ExerciseEntry,
  type FinanceData,
  type FinanceSubscriptionEntry,
  type FoodEntry,
  type GamificationSummary,
  type HabitDefinition,
  type IntakeEntry,
  type LogicalDayInsights,
  type LogicalDayPrompt,
  type NoteIndexEntry,
  type NextUpFocusItem,
  type ProjectReviewOption,
  type RepairTimelineSession,
  type RepairTimelineSessionKind,
  type ResearchGroundingMode,
  type BudgetCategory,
  type SessionTrackerDefinition,
  type RetrievalIndexStatus,
  type RoutineTemplateDefinition,
  type SleepInsights,
  type SuggestedTop3Candidate,
  type SymptomEntry,
  type TimeAllocationBucket,
  type TimeAllocationInsights,
  type TodoSnapshot,
  type TodayFocusItem,
  type WeeklyAgendaDay,
  type WallpaperOption,
  type WeightGoalMode,
  type MoodCheckIn,
  type WorkSession
} from "./src/dashboard-types";

export default class DailyDashboardPlugin extends Plugin {
  private static readonly CALENDAR_ARTIFACT_HORIZON_DAYS = 90;

  private data: DashboardPluginData = {
    settings: { ...DEFAULT_SETTINGS },
    entries: {},
    calendarEvents: [],
    financeData: {
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.map((category) => ({ ...category })),
      subscriptions: []
    },
    dayState: {
      activeDate: formatDateKey(new Date()),
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
  private wallpaperOptions: WallpaperOption[] = [];
  private autoArchiveDebounceId: number | null = null;
  private isAutoArchivingTodo = false;
  private latestAiArtifact: AiArtifact | null = null;
  private isAiBusy = false;
  private isIndexingNotes = false;
  private noteIndexDebounceId: number | null = null;
  private calendarWarningDay = "";
  private warnedCalendarEventKeys = new Set<string>();
  private routineWarningDay = "";
  private warnedRoutineWindowKeys = new Set<string>();
  private activeRoutineNotificationSignature = "";
  private notificationAudioContext: AudioContext | null = null;

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return String(error);
  }

  private showDashboardNotice(message: string, timeout = 4000, playSound = false): void {
    new Notice(message, timeout);
    if (playSound) {
      this.playNotificationSound();
    }
  }

  private playNotificationSound(): void {
    const preset = this.data.settings.notificationSound;
    if (preset === "off") {
      return;
    }

    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.notificationAudioContext || this.notificationAudioContext.state === "closed") {
      this.notificationAudioContext = new AudioContextCtor();
    }

    const context = this.notificationAudioContext;
    const scheduleTone = (): void => {
      const startAt = context.currentTime + 0.02;
      this.getNotificationSoundPattern(preset).forEach((step, index) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const offset = this.getNotificationSoundPattern(preset)
          .slice(0, index)
          .reduce((sum, item) => sum + item.duration + item.gap, 0);
        oscillator.type = step.waveform;
        oscillator.frequency.setValueAtTime(step.frequency, startAt + offset);
        gainNode.gain.setValueAtTime(0.0001, startAt + offset);
        gainNode.gain.exponentialRampToValueAtTime(step.gain, startAt + offset + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + step.duration);
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
        // Ignore audio startup failures and keep notifications functional.
      });
      return;
    }

    scheduleTone();
  }

  private getNotificationSoundPattern(preset: DashboardNotificationSound): Array<{ frequency: number; duration: number; gap: number; gain: number; waveform: OscillatorType }> {
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

  private async initializeWorkspaceArtifacts(): Promise<void> {
    await this.importCalendarEventsFromMarkdown();
    await this.ensureTodayEntry();
    await this.ensureCoreSupportNotesExist();
    await this.backfillDailyLogsFromEntries();
    await this.syncCalendarArtifacts();
    await this.refreshWallpaperOptions();
  }

  async onload(): Promise<void> {
    await this.loadPluginData();

    try {
      await this.initializeWorkspaceArtifacts();
    } catch (error) {
      console.error("Obsidian DASH - Daily Action & System Hub startup initialization failed", error);
      new Notice(`Obsidian DASH - Daily Action & System Hub could not prepare its startup files. ${this.getErrorMessage(error)}`);
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
      id: "open-ai-guardrails-note",
      name: "Open AI Guardrails note",
      callback: () => {
        void this.openAiGuardrailsNote();
      }
    });

    this.addCommand({
      id: "open-current-season-note",
      name: "Open Current Season note",
      callback: () => {
        void this.openCurrentSeasonNote();
      }
    });

    this.addCommand({
      id: "open-people-dependencies-note",
      name: "Open People / External Dependencies note",
      callback: () => {
        void this.openPeopleDependenciesNote();
      }
    });

    this.addCommand({
      id: "open-decision-journal-note",
      name: "Open Decision Journal note",
      callback: () => {
        void this.openDecisionJournalNote();
      }
    });

    this.addCommand({
      id: "open-system-map-note",
      name: "Open System Map note",
      callback: () => {
        void this.openSystemMapNote();
      }
    });

    this.addCommand({
      id: "initialize-compiled-research-wiki",
      name: "Initialize compiled research wiki",
      callback: () => {
        void this.initializeCompiledResearchWiki();
      }
    });

    this.addCommand({
      id: "generate-compiled-research-wiki-health-check",
      name: "Generate compiled research wiki health check",
      callback: () => {
        void this.generateCompiledResearchWikiHealthCheck();
      }
    });

    this.addCommand({
      id: "compile-active-note-into-research-source-summary",
      name: "Compile active note into research source summary",
      callback: () => {
        void this.compileActiveNoteIntoResearchSourceSummary();
      }
    });

    this.addCommand({
      id: "generate-concept-note-from-active-research-note",
      name: "Generate concept note from active research note",
      callback: () => {
        void this.generateConceptNoteFromActiveResearchNote();
      }
    });

    this.addCommand({
      id: "generate-research-answer-note-from-active-note",
      name: "Generate research answer note from active note",
      callback: () => {
        void this.generateResearchAnswerNoteFromActiveNote();
      }
    });

    this.addCommand({
      id: "generate-research-brief-from-active-note",
      name: "Generate research brief from active note",
      callback: () => {
        void this.generateResearchBriefFromActiveNote();
      }
    });

    this.addCommand({
      id: "generate-research-marp-slide-deck-from-active-note",
      name: "Generate research Marp slide deck from active note",
      callback: () => {
        void this.generateResearchMarpSlideDeckFromActiveNote();
      }
    });

    this.addCommand({
      id: "promote-active-research-output-to-concept-note",
      name: "Promote active research output to concept note",
      callback: () => {
        void this.promoteActiveResearchOutputToConceptNote();
      }
    });

    this.addCommand({
      id: "promote-follow-up-questions-from-active-research-note",
      name: "Promote follow-up questions from active research note",
      callback: () => {
        void this.promoteFollowUpQuestionsFromActiveResearchNote();
      }
    });

    this.addCommand({
      id: "generate-compiled-research-retrieval-tuning-note",
      name: "Generate compiled research retrieval tuning note",
      callback: () => {
        void this.generateCompiledResearchRetrievalTuningNote();
      }
    });

    this.addCommand({
      id: "regenerate-compiled-research-topic-index",
      name: "Regenerate compiled research topic index",
      callback: () => {
        void this.regenerateCompiledResearchTopicIndex();
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
      id: "repair-master-hub-and-project-notes",
      name: "Repair master task hub and project notes",
      callback: () => {
        void this.repairMasterHubAndProjectNotes(true);
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
      id: "generate-dependency-review-note",
      name: "Generate dependency review note",
      callback: () => {
        void this.generateDependencyReviewNote(true);
      }
    });

    this.addCommand({
      id: "generate-recurring-friction-patterns-note",
      name: "Generate recurring friction patterns note",
      callback: () => {
        void this.generateRecurringFrictionPatternsNote(true);
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
      id: "refresh-master-hub-portfolio-snapshot",
      name: "Refresh master task hub portfolio snapshot",
      callback: () => {
        void this.refreshMasterHubPortfolioSnapshot(true);
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
      id: "ask-research-question-and-write-wiki-notes",
      name: "Ask research question and write wiki notes",
      callback: () => {
        void this.openAskResearchQuestionFlow();
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

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
  }

  getSettings(): DashboardSettings {
    return this.data.settings;
  }

  getFinanceData(): FinanceData {
    return this.data.financeData;
  }

  async addBudgetCategory(label: string): Promise<boolean> {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return false;
    }

    const existing = this.data.financeData.budgetCategories.find((category) => category.label.toLowerCase() === trimmedLabel.toLowerCase());
    if (existing) {
      new Notice("That budget category already exists.");
      return false;
    }

    const nextCategory: BudgetCategory = {
      id: this.normalizeFinanceId(trimmedLabel, `budget-category-${Date.now()}`),
      label: trimmedLabel,
      monthlyTarget: 0,
      color: DEFAULT_BUDGET_CATEGORIES[this.data.financeData.budgetCategories.length % DEFAULT_BUDGET_CATEGORIES.length]?.color ?? "#abb2bf"
    };
    this.data.financeData.budgetCategories = [...this.data.financeData.budgetCategories, nextCategory];
    await this.savePluginData();
    this.refreshDashboardViews();
    return true;
  }

  async saveBudgetCategory(category: BudgetCategory): Promise<void> {
    const normalized = this.normalizeBudgetCategory(category, this.data.financeData.budgetCategories.length);
    if (!normalized) {
      new Notice("Budget category label is required.");
      return;
    }

    const nextCategories = this.data.financeData.budgetCategories.filter((item) => item.id !== normalized.id);
    nextCategories.push(normalized);
    this.data.financeData.budgetCategories = nextCategories.sort((left, right) => left.label.localeCompare(right.label));
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async updateBudgetCategoryTarget(categoryId: string, monthlyTarget: number): Promise<void> {
    this.data.financeData.budgetCategories = this.data.financeData.budgetCategories.map((category) => category.id === categoryId
      ? { ...category, monthlyTarget: clamp(Number(monthlyTarget) || 0, 0, 1_000_000) }
      : category);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async removeBudgetCategory(categoryId: string): Promise<void> {
    if (this.data.financeData.budgetCategories.length <= 1) {
      new Notice("Keep at least one budget category available.");
      return;
    }

    const fallbackCategoryId = this.data.financeData.budgetCategories.find((category) => category.id !== categoryId)?.id;
    if (!fallbackCategoryId) {
      return;
    }

    this.data.financeData.budgetCategories = this.data.financeData.budgetCategories.filter((category) => category.id !== categoryId);
    this.data.financeData.subscriptions = this.data.financeData.subscriptions.map((subscription) => subscription.categoryId === categoryId
      ? { ...subscription, categoryId: fallbackCategoryId }
      : subscription);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async saveFinanceSubscription(subscription: FinanceSubscriptionEntry): Promise<void> {
    const rawSubscription = subscription.id.trim().length > 0
      ? subscription
      : {
          ...subscription,
          id: `subscription-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        };
    const normalized = this.normalizeFinanceSubscription(
      rawSubscription,
      0,
      new Set(this.data.financeData.budgetCategories.map((category) => category.id)),
      this.data.financeData.budgetCategories[0]?.id ?? "other"
    );
    if (!normalized) {
      new Notice("Subscription name is required.");
      return;
    }

    const nextSubscriptions = this.data.financeData.subscriptions.filter((item) => item.id !== normalized.id);
    nextSubscriptions.push(normalized);
    this.data.financeData.subscriptions = nextSubscriptions.sort((left, right) => {
      const leftKey = left.renewalDate || "9999-99-99";
      const rightKey = right.renewalDate || "9999-99-99";
      return leftKey.localeCompare(rightKey) || left.name.localeCompare(right.name);
    });
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async removeFinanceSubscription(subscriptionId: string): Promise<void> {
    this.data.financeData.subscriptions = this.data.financeData.subscriptions.filter((subscription) => subscription.id !== subscriptionId);
    await this.savePluginData();
    this.refreshDashboardViews();
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

  getSessionTrackers(): SessionTrackerDefinition[] {
    return this.getSettings().sessionTrackers;
  }

  getVisibleSessionTrackers(): SessionTrackerDefinition[] {
    return this.getSessionTrackers().filter((tracker) => tracker.visible);
  }

  getActivitySessionTrackers(): SessionTrackerDefinition[] {
    return this.getSessionTrackers().filter((tracker) => !CORE_SESSION_TRACKER_OPTIONS.includes(tracker.id as typeof CORE_SESSION_TRACKER_OPTIONS[number]));
  }

  getVisibleActivitySessionTrackers(): SessionTrackerDefinition[] {
    return this.getVisibleSessionTrackers().filter((tracker) => !CORE_SESSION_TRACKER_OPTIONS.includes(tracker.id as typeof CORE_SESSION_TRACKER_OPTIONS[number]));
  }

  getSessionTracker(id: string): SessionTrackerDefinition | null {
    const normalizedId = id.trim().toLowerCase();
    return this.getSessionTrackers().find((tracker) => tracker.id === normalizedId) ?? null;
  }

  getActiveActivitySession(kind?: ActivitySessionKind, entry: DailyEntry = this.getTodayEntry()): ActivitySession | null {
    return [...entry.activitySessions]
      .reverse()
      .find((session) => session.end === null && (!kind || session.kind === kind)) ?? null;
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

  getTrackedActivityMinutes(entry: DailyEntry = this.getTodayEntry(), kind?: ActivitySessionKind): number {
    return getTrackedActivityMinutes(this.getEffectiveTrackedEntry(entry), kind);
  }

  async updateSessionTrackers(trackers: SessionTrackerDefinition[]): Promise<void> {
    await this.updateSettings({
      ...this.getSettings(),
      sessionTrackers: trackers
    });
  }

  getTrackedSleepMinutes(entry: DailyEntry = this.getTodayEntry()): number {
    return getSleepMinutesForDay(entry, this.getNextEntry(entry.date));
  }

  getSleepInsights(): SleepInsights {
    return buildSleepInsights(this.getAllEntries(), undefined, this.getHabitDefinitions());
  }

  getGamificationSummary(todoSnapshot: TodoSnapshot | null): GamificationSummary {
    return buildGamificationSummary(this.getAllEntries(), this.getHabitDefinitions(), todoSnapshot);
  }

  getAdaptiveReflectionPrompts(date: string = this.getTodayKey()): string[] {
    const entry = this.getOrCreateEntry(date);
    const prompts: string[] = [];
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

  getTimeAllocationInsights(date: string = this.getTodayKey(), referenceDate: Date = new Date()): TimeAllocationInsights {
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
    if (trackedAwakeMinutes === 0 && (entry.intakeLog.length > 0 || entry.completedTasks.length > 0 || Object.values(entry.habitEvents).some((items) => items.length > 0))) {
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
      activityMinutes,
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

    return "Add your OpenAI API key in Obsidian DASH - Daily Action & System Hub settings before using AI features.";
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
      this.getDateKeysInSpan(event.date, event.endDate)
        .filter((dateKey) => dateKey >= formatDateKey(start) && dateKey <= formatDateKey(end))
        .forEach((dateKey) => {
          const bucket = byDate.get(dateKey) ?? [];
          bucket.push(event);
          byDate.set(dateKey, bucket);
        });
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
        text: task.minimumStep.trim().length > 0 ? task.minimumStep : task.text,
        notes: [
          `Project ${project}`,
          task.text !== task.minimumStep && task.minimumStep.trim().length > 0 ? `from ${task.text}` : "",
          task.executionContext ? `context ${task.executionContext}` : "",
          task.effort ? `effort ${task.effort}` : "",
          task.energy ? `energy ${task.energy}` : "",
          task.blockedReason ? `blocked ${task.blockedReason}` : ""
        ].filter((value) => value.length > 0).join(" • "),
        estimateMinutes: null,
        reason: `Overdue in ${project}${task.dueDate ? ` • due ${task.dueDate}` : ""}${task.trigger ? ` • trigger ${task.trigger}` : ""}`,
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
          text: task.minimumStep.trim().length > 0 ? task.minimumStep : task.text,
          notes: [
            `Project ${project.name}`,
            "repeating task",
            task.executionContext ? `context ${task.executionContext}` : "",
            task.effort ? `effort ${task.effort}` : "",
            task.energy ? `energy ${task.energy}` : ""
          ].filter((value) => value.length > 0).join(" • "),
          estimateMinutes: null,
          reason: `Due repeating task${project.staleDays !== null ? ` • ${project.staleDays}d stale` : ""}${task.trigger ? ` • trigger ${task.trigger}` : ""}`,
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
        text: task.minimumStep.trim().length > 0 ? task.minimumStep : task.text,
        notes: [
          `Project ${project.name}`,
          project.focus || "stale project",
          task.executionContext ? `context ${task.executionContext}` : "",
          task.effort ? `effort ${task.effort}` : "",
          task.energy ? `energy ${task.energy}` : ""
        ].filter((value) => value.length > 0).join(" • "),
        estimateMinutes: null,
        reason: `${project.name} has been stale for ${project.staleDays ?? 0}d${task.trigger ? ` • trigger ${task.trigger}` : ""}`,
        source: "stale"
      });
    });

    (todoSnapshot?.dueSoonTasks ?? []).slice(0, 2).forEach(({ project, task }) => {
      pushCandidate({
        id: `due-soon-${project}-${task.text}`,
        text: task.minimumStep.trim().length > 0 ? task.minimumStep : task.text,
        notes: [
          `Project ${project}`,
          task.executionContext ? `context ${task.executionContext}` : "",
          task.effort ? `effort ${task.effort}` : "",
          task.energy ? `energy ${task.energy}` : ""
        ].filter((value) => value.length > 0).join(" • "),
        estimateMinutes: null,
        reason: `Due soon${task.dueDate ? ` • ${task.dueDate}` : ""}${task.trigger ? ` • trigger ${task.trigger}` : ""}`,
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
      endDate: date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      prepMinutes: 0,
      travelMinutes: 0,
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

  getCalendarOccurrencesBetween(startDate: string, endDate: string): CalendarEventOccurrence[] {
    const normalizedStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : formatDateKey(new Date());
    const normalizedEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : normalizedStart;
    const start = new Date(`${normalizedStart}T00:00:00`);
    const end = new Date(`${normalizedEnd}T00:00:00`);
    return this.getCalendarOccurrencesInRange(start.getTime() <= end.getTime() ? start : end, start.getTime() <= end.getTime() ? end : start);
  }

  getCalendarEventEntry(eventId: string): CalendarEventEntry | null {
    return this.data.calendarEvents.find((event) => event.id === eventId) ?? null;
  }

  async updateCalendarEvent(eventId: string, input: {
    title: string;
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
    prepMinutes: number;
    travelMinutes: number;
    category: CalendarEventCategory;
    projectName: string;
    projectNotePath: string;
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
            updatedAt: formatPreciseDateTimeKey(new Date())
          }
        : event)
      .sort((left, right) => `${left.date} ${left.startTime || "00:00"}`.localeCompare(`${right.date} ${right.startTime || "00:00"}`));
    await this.syncCalendarArtifacts([existingEvent.date, existingEvent.endDate, normalized.date, normalized.endDate]);
    await this.savePluginData();
    this.refreshDashboardViews();
    new Notice(`Updated calendar event for ${normalized.date}.`);
  }

  async updateCalendarOccurrence(eventId: string, originalDate: string, input: {
    title: string;
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
    prepMinutes: number;
    travelMinutes: number;
    category: CalendarEventCategory;
    projectName: string;
    projectNotePath: string;
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
            && normalized.endDate === event.endDate
            && normalized.prepMinutes === event.prepMinutes
            && normalized.travelMinutes === event.travelMinutes
            && normalized.projectName === event.projectName
            && normalized.projectNotePath === event.projectNotePath
            && normalized.notes === event.notes
            ? "move"
            : "move",
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
    endDate: string;
    startTime: string;
    endTime: string;
    prepMinutes: number;
    travelMinutes: number;
    category: CalendarEventCategory;
    projectName: string;
    projectNotePath: string;
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
    await this.syncCalendarArtifacts([normalized.date, normalized.endDate]);
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
      projectName: item.projectName,
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
        calendarLeadSummary: reminder.leadSummary,
        allDay: reminder.allDay,
        calendarNotes: [this.renderCalendarProjectLink(reminder.projectName, reminder.projectNotePath), reminder.notes]
          .filter((value) => value.trim().length > 0)
          .join(" • "),
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
    const accepted = candidates;

    if (accepted.length === 0) {
      new Notice("No unfinished active focus items were found on the previous logical day.");
      return 0;
    }

    entry.todayFocus = [...entry.todayFocus, ...accepted.map((text) => this.createTodayFocusItem(text))];
    await this.persistEntry(entry);
    new Notice(`Carried forward ${accepted.length} unfinished focus item${accepted.length === 1 ? "" : "s"}.`);
    return accepted.length;
  }

  private toCalendarReminderItem(event: CalendarEventOccurrence): CalendarSnapshot["reminders"][number] {
    const startDate = this.getCalendarOccurrenceStartDate(event);
    const endDate = this.getCalendarOccurrenceEndDate(event);
    const leadMinutes = Math.max(0, event.prepMinutes + event.travelMinutes);
    const reminderAt = new Date(startDate.getTime() - (leadMinutes * 60 * 1000));
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

  getCalendarOccurrencesForDate(date: string): CalendarEventOccurrence[] {
    const target = new Date(`${date}T00:00:00`);
    return this.getCalendarOccurrencesInRange(target, target)
      .filter((event) => this.isDateWithinEventSpan(date, event.date, event.endDate))
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
      const spanDays = this.getDateSpanDays(event.date, event.endDate);

      while (cursor.getTime() <= hardLimit.getTime()) {
        const originalDate = formatDateKey(cursor);
        const exception = exceptionMap.get(originalDate);
        const occurrenceDate = exception?.kind === "move" ? exception.date : originalDate;
        const occurrenceEndDate = exception?.kind === "move"
          ? exception.endDate
          : this.shiftDateKey(originalDate, spanDays);
        if ((!exception || exception.kind === "move") && this.doesEventSpanOverlapRange(occurrenceDate, occurrenceEndDate, safeStart, safeEnd)) {
          const occurrenceId = `${event.id}:${originalDate}`;
          occurrences.push({
            id: occurrenceId,
            sourceEventId: event.id,
            originalDate,
            title: exception?.kind === "move" ? exception.title : event.title,
            date: occurrenceDate,
            endDate: occurrenceEndDate,
            startTime: exception?.kind === "move" ? exception.startTime : event.startTime,
            endTime: exception?.kind === "move" ? exception.endTime : event.endTime,
            prepMinutes: exception?.kind === "move" ? exception.prepMinutes : event.prepMinutes,
            travelMinutes: exception?.kind === "move" ? exception.travelMinutes : event.travelMinutes,
            category: exception?.kind === "move" ? exception.category : event.category,
            projectName: exception?.kind === "move" ? exception.projectName : event.projectName,
            projectNotePath: exception?.kind === "move" ? exception.projectNotePath : event.projectNotePath,
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

  private getClockMinutes(value: string | Date): number {
    if (value instanceof Date) {
      return (value.getHours() * 60) + value.getMinutes();
    }

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

  private isDateWithinEventSpan(dateKey: string, startDateKey: string, endDateKey: string): boolean {
    return dateKey >= startDateKey && dateKey <= endDateKey;
  }

  private doesEventSpanOverlapRange(startDateKey: string, endDateKey: string, start: Date, end: Date): boolean {
    const spanStart = new Date(`${startDateKey}T00:00:00`);
    const spanEnd = new Date(`${endDateKey}T23:59:59`);
    return spanEnd.getTime() >= start.getTime() && spanStart.getTime() <= end.getTime();
  }

  private getDateSpanDays(startDateKey: string, endDateKey: string): number {
    const start = new Date(`${startDateKey}T00:00:00`);
    const end = new Date(`${endDateKey}T00:00:00`);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }

  private shiftDateKey(dateKey: string, days: number): string {
    const date = new Date(`${dateKey}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
  }

  private getDateKeysInSpan(startDateKey: string, endDateKey: string): string[] {
    const keys: string[] = [];
    let cursor = startDateKey;
    while (cursor <= endDateKey) {
      keys.push(cursor);
      cursor = this.shiftDateKey(cursor, 1);
    }
    return keys;
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
    const reminderAt = new Date(item.reminderAt);
    const lookaheadMs = this.data.settings.calendarLookaheadHours * 60 * 60 * 1000;
    if (item.allDay) {
      const endOfDay = this.startOfToday(end);
      return endOfDay.getTime() >= this.startOfToday(now).getTime()
        && reminderAt.getTime() <= now.getTime() + lookaheadMs;
    }

    return end.getTime() >= now.getTime() && reminderAt.getTime() <= now.getTime() + lookaheadMs;
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
        const reminderTime = new Date(event.reminderAt).getTime();
        if (event.allDay) {
          const reminderDay = this.startOfToday(new Date(event.reminderAt));
          return reminderDay.getTime() >= this.startOfToday(now).getTime()
            && reminderDay.getTime() - this.startOfToday(now).getTime() <= warningWindowMs;
        }

        return reminderTime >= now.getTime() && reminderTime - now.getTime() <= warningWindowMs;
      })
      .forEach((event) => {
        const eventKey = `${currentDay}|${event.id}|${event.reminderAt}`;
        if (this.warnedCalendarEventKeys.has(eventKey)) {
          return;
        }

        this.warnedCalendarEventKeys.add(eventKey);
        const timeLabel = this.formatCalendarEventWindow(new Date(event.start), new Date(event.end), event.allDay);
        this.showDashboardNotice(`Upcoming activity: ${event.title} • ${timeLabel}${event.leadSummary ? ` • ${event.leadSummary}` : ""}`, 10000, true);
      });
  }

  private getActiveRoutineNotifications(referenceDate: Date = new Date()): DashboardNotificationItem[] {
    const todayKey = formatDateKey(referenceDate);
    const currentMinutes = this.getClockMinutes(referenceDate);

    return this.getRoutineTemplates()
      .filter((template) => {
        const startMinutes = this.getClockMinutes(template.startTime);
        const endMinutes = this.getClockMinutes(template.endTime);
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      })
      .map((template) => ({
        id: `routine:${todayKey}:${template.id}`,
        source: "routine" as const,
        title: `${template.label} is due now`,
        description: `${template.startTime}-${template.endTime} • Inside the active routine window right now.`,
        tone: "alert" as const,
        dismissible: true
      }));
  }

  private maybeWarnRoutineWindows(referenceDate: Date = new Date()): void {
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
      this.showDashboardNotice(`Routine window due now: ${notification.title.replace(/ is due now$/, "")} • ${notification.description.split(" • ")[0]}`, 10000, true);
    });

    const nextSignature = activeNotifications.map((item) => item.id).sort().join("|");
    if (nextSignature !== this.activeRoutineNotificationSignature) {
      this.activeRoutineNotificationSignature = nextSignature;
      this.refreshDashboardViews();
    }
  }

  private getCalendarReminderWarningLevel(reminder: CalendarSnapshot["reminders"][number], now: Date): "warning" | "upcoming" {
    const warningWindowMs = this.data.settings.calendarWarningHours * 60 * 60 * 1000;
    const start = new Date(reminder.reminderAt);
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

  private getCalendarOccurrenceEndDate(event: Pick<CalendarEventOccurrence, "date" | "endDate" | "startTime" | "endTime">): Date {
    if (!event.endTime) {
      return event.startTime
        ? new Date(`${event.endDate}T${event.startTime}:00`)
        : new Date(`${event.endDate}T23:59:00`);
    }

    return new Date(`${event.endDate}T${event.endTime}:00`);
  }

  private startOfToday(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private formatCalendarEventWindow(start: Date, end: Date, allDay: boolean): string {
    if (allDay) {
      return formatDateKey(start) === formatDateKey(end)
        ? "All day"
        : `All day • ${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }

    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleString([], sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleString([], sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `${startLabel} - ${endLabel}`;
  }

  private renderCalendarLeadSummary(prepMinutes: number, travelMinutes: number): string {
    const parts: string[] = [];
    if (prepMinutes > 0) {
      parts.push(`prep ${prepMinutes}m`);
    }
    if (travelMinutes > 0) {
      parts.push(`travel ${travelMinutes}m`);
    }
    return parts.join(" + ");
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

  async addMoodCheckIn(score: number, feeling = "", note = ""): Promise<void> {
    const entry = this.getTodayEntry();
    entry.moodCheckIns = [{
      loggedAt: formatDateTimeKey(new Date()),
      score: clamp(Math.round(score), 1, 5),
      feeling: feeling.trim(),
      note: note.trim()
    }, ...entry.moodCheckIns].slice(0, 24);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }

  async removeMoodCheckIn(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.moodCheckIns = entry.moodCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }

  async updateHabitValue(habitId: string, value: number): Promise<void> {
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }

    const entry = this.getTodayEntry();
    const previousValue = entry.habits[habitId] ?? 0;
    const nextValue = clamp(value, 0, definition.target);
    const currentEvents = [...(entry.habitEvents[habitId] ?? [])];
    const addedTimestamps: string[] = [];
    if (nextValue > currentEvents.length) {
      for (let index = currentEvents.length; index < nextValue; index += 1) {
        const timestamp = formatDateTimeKey(new Date());
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
        return automationKey === habitId.toLowerCase()
          || automationKey === definitionLabelKey
          || automationSlug === habitId.toLowerCase()
          || automationSlug === definitionSlug;
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

  async updateHabitMissNote(habitId: string, value: string): Promise<void> {
    const entry = this.getTodayEntry();
    const trimmedValue = value.trim();
    if (trimmedValue) {
      entry.habitMissNotes[habitId] = trimmedValue;
    } else {
      delete entry.habitMissNotes[habitId];
    }
    await this.persistEntry(entry);
  }

  async addHabitDefinition(label: string, target: number, completionWindow = "anytime", difficultyWeight = 1, cadence = "daily"): Promise<void> {
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
          target: clamp(Math.round(target), 1, 12),
          completionWindow: completionWindow === "morning" || completionWindow === "afternoon" || completionWindow === "evening" || completionWindow === "before-bed"
            ? completionWindow
            : "anytime",
          cadence: cadence === "every-other-day" || cadence === "weekly" ? cadence : "daily",
          anchorDate: this.getTodayKey(),
          difficultyWeight: clamp(Math.round(difficultyWeight), 1, 3)
        }
      ]
    });
  }

  async updateHabitDefinition(habitId: string, updates: {
    label: string;
    target: number;
    completionWindow: string;
    difficultyWeight: number;
    cadence: string;
  }): Promise<void> {
    const normalizedLabel = updates.label.trim();
    if (!normalizedLabel) {
      new Notice("Habit name is required.");
      return;
    }

    const definitions = [...this.getHabitDefinitions()];
    const index = definitions.findIndex((habit) => habit.id === habitId);
    if (index < 0) {
      return;
    }

    if (definitions.some((habit, habitIndex) => habitIndex !== index && habit.label.trim().toLowerCase() === normalizedLabel.toLowerCase())) {
      new Notice(`A habit named ${normalizedLabel} already exists.`);
      return;
    }

    definitions[index] = {
      ...definitions[index],
      label: normalizedLabel,
      target: clamp(Math.round(updates.target), 1, 12),
      completionWindow: updates.completionWindow === "morning" || updates.completionWindow === "afternoon" || updates.completionWindow === "evening" || updates.completionWindow === "before-bed"
        ? updates.completionWindow
        : "anytime",
      cadence: updates.cadence === "every-other-day" || updates.cadence === "weekly" ? updates.cadence : "daily",
      difficultyWeight: clamp(Math.round(updates.difficultyWeight), 1, 3)
    };

    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: definitions
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

  async restoreHabitDefinition(habit: HabitDefinition, index: number): Promise<void> {
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

  async reorderHabitDefinitions(fromIndex: number, toIndex: number): Promise<boolean> {
    const definitions = [...this.getHabitDefinitions()];
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= definitions.length || toIndex >= definitions.length || fromIndex === toIndex) {
      return false;
    }

    const [movedHabit] = definitions.splice(fromIndex, 1);
    definitions.splice(toIndex, 0, movedHabit);
    await this.updateSettings({
      ...this.getSettings(),
      habitDefinitions: definitions
    });
    return true;
  }

  async addFoodEntry(value: string, amount = 1): Promise<void> {
    await this.addIntakeEntry("food", value, amount, amount === 1 ? "serving" : "servings");
  }

  private upsertIntakeLogEntry(entry: DailyEntry, input: Omit<IntakeEntry, "loggedAtHistory"> & { loggedAtHistory?: string[] }): void {
    const history = (input.loggedAtHistory && input.loggedAtHistory.length > 0 ? input.loggedAtHistory : [input.loggedAt])
      .filter((item) => item.trim().length > 0);
    const existingIndex = entry.intakeLog.findIndex((item) => item.kind === input.kind
      && item.label.trim().toLowerCase() === input.label.trim().toLowerCase()
      && item.unit.trim().toLowerCase() === input.unit.trim().toLowerCase()
      && item.note.trim() === input.note.trim());

    if (existingIndex >= 0) {
      const existingItem = entry.intakeLog[existingIndex];
      existingItem.amount = clamp(existingItem.amount + input.amount, 0.1, 9999);
      existingItem.loggedAtHistory = [...existingItem.loggedAtHistory, ...history].filter((value) => value.trim().length > 0);
      existingItem.loggedAt = existingItem.loggedAtHistory[existingItem.loggedAtHistory.length - 1] ?? input.loggedAt;
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

  async addIntakeEntry(kind: string, label: string, amount = 1, unit = "serving", note = ""): Promise<void> {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return;
    }

    const entry = this.getTodayEntry();
    const normalizedKind = kind === "food" || kind === "medication" || kind === "supplement" || kind === "drink"
      ? kind
      : kind === "caffeine" || kind === "water"
        ? "drink"
        : "drink";
    const normalizedAmount = clamp(Number(amount), 0.1, 9999);
    const normalizedUnit = unit.trim() || "serving";
    const normalizedNote = note.trim();
    const loggedAt = formatDateTimeKey(new Date());
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

  async removeIntakeEntry(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.intakeLog = entry.intakeLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateIntakeEntryAmount(index: number, amount: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextEntry = entry.intakeLog[index];
    if (!nextEntry) {
      return;
    }

    nextEntry.amount = clamp(Number(amount), 0.1, 9999);
    await this.persistEntry(entry);
  }

  async updateIntakeEntryUnit(index: number, unit: string): Promise<void> {
    const entry = this.getTodayEntry();
    const nextEntry = entry.intakeLog[index];
    const trimmedUnit = unit.trim();
    if (!nextEntry || !trimmedUnit) {
      return;
    }

    nextEntry.unit = trimmedUnit;
    await this.persistEntry(entry);
  }

  async updateIntakeGroupUnit(kind: string, label: string, unit: string, nextUnit: string): Promise<void> {
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

  async removeLatestMatchingIntakeEntry(kind: string, label: string, unit: string): Promise<void> {
    const entry = this.getTodayEntry();
    const targetIndex = entry.intakeLog.findIndex((item) => item.kind === kind && item.label.trim().toLowerCase() === label.trim().toLowerCase() && item.unit.trim().toLowerCase() === unit.trim().toLowerCase());
    if (targetIndex === -1) {
      return;
    }

    entry.intakeLog.splice(targetIndex, 1);
    await this.persistEntry(entry);
  }

  async restoreIntakeEntry(item: IntakeEntry, index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextLog = [...entry.intakeLog];
    nextLog.splice(clamp(index, 0, nextLog.length), 0, { ...item });
    entry.intakeLog = nextLog.slice(0, 40);
    await this.persistEntry(entry);
  }

  async addSymptomEntry(symptom: string, severity: number, note = ""): Promise<void> {
    const trimmedSymptom = symptom.trim();
    if (!trimmedSymptom) {
      return;
    }

    const entry = this.getTodayEntry();
    entry.symptomLog = [{
      symptom: trimmedSymptom,
      severity: clamp(Math.round(severity), 1, 5),
      note: note.trim(),
      loggedAt: formatDateTimeKey(new Date())
    }, ...entry.symptomLog].slice(0, 30);
    await this.persistEntry(entry);
  }

  async removeSymptomEntry(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.symptomLog = entry.symptomLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async restoreSymptomEntry(item: SymptomEntry, index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextLog = [...entry.symptomLog];
    nextLog.splice(clamp(index, 0, nextLog.length), 0, { ...item });
    entry.symptomLog = nextLog.slice(0, 30);
    await this.persistEntry(entry);
  }

  async updateFoodEntryAmount(index: number, amount: number): Promise<void> {
    const entry = this.getTodayEntry();
    const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
    const nextEntry = foodEntries[index];
    if (!nextEntry) {
      return;
    }

    nextEntry.amount = clamp(Number(amount), 0.1, 9999);
    await this.persistEntry(entry);
  }

  async removeFoodEntry(index: number): Promise<void> {
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

  async restoreFoodEntry(item: FoodEntry, index: number): Promise<void> {
    await this.restoreIntakeEntry(foodEntryToIntakeEntry(item), index);
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
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }

  async removeEnergyCheckIn(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.energyCheckIns = entry.energyCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }

  async addAnxietyCheckIn(score: number, note = ""): Promise<void> {
    const entry = this.getTodayEntry();
    entry.anxietyCheckIns = [{
      loggedAt: formatDateTimeKey(new Date()),
      score: clamp(Math.round(score), 1, 5),
      note: note.trim()
    }, ...entry.anxietyCheckIns].slice(0, 24);
    this.syncStateRollups(entry);
    await this.persistEntry(entry);
  }

  async removeAnxietyCheckIn(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.anxietyCheckIns = entry.anxietyCheckIns.filter((_, candidateIndex) => candidateIndex !== index);
    this.syncStateRollups(entry);
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

  async updateReflection(kind: "helped" | "hurt", value: string): Promise<void> {
    const entry = this.getTodayEntry();
    if (kind === "helped") {
      entry.helpedToday = value.trim();
    } else {
      entry.hurtToday = value.trim();
    }
    await this.persistEntry(entry);
  }

  async updatePoopQuality(sessionStart: string, quality: string): Promise<void> {
    const entry = this.getTodayEntry();
    const trimmedQuality = quality.trim();
    if (trimmedQuality) {
      entry.poopQualityByStart[sessionStart] = trimmedQuality;
    } else {
      delete entry.poopQualityByStart[sessionStart];
    }
    await this.persistEntry(entry);
  }

  async generateDailyDietInsight(): Promise<void> {
    const entry = this.getTodayEntry();
    const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
    if (foodEntries.length === 0) {
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

  async startWorkSession(tag = "", projectName = ""): Promise<void> {
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
    entry.workSessions = [...entry.workSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: projectName.trim() }];
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
    entry.napSessions = [...entry.napSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
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
    entry.relaxSessions = [...entry.relaxSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
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
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
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
    entry.breakSessions = [...entry.breakSessions, { start: timestamp, end: null, tag: "recovery", projectName: "" }];
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
    entry.poopSessions = [...entry.poopSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: "" }];
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

  async startActivitySession(kind: ActivitySessionKind, tag = ""): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before starting another activity timer.");
      return;
    }

    const entry = this.getTodayEntry();
    const label = this.getSessionTracker(kind)?.label || formatActivitySessionLabel(kind);
    if (entry.activitySessions.some((session) => session.end === null && session.kind === kind)) {
      new Notice(`A ${label.toLowerCase()} session is already active.`);
      return;
    }

    const timestamp = formatDateTimeKey(new Date());
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
    new Notice(`${label} started.`);
  }

  async stopActivitySession(kind?: ActivitySessionKind): Promise<void> {
    const entry = this.getTodayEntry();
    const activeSession = [...entry.activitySessions]
      .reverse()
      .find((session) => session.end === null && (!kind || session.kind === kind));
    if (!activeSession) {
      new Notice("No matching activity session is currently active.");
      return;
    }

    activeSession.end = formatDateTimeKey(new Date());
    await this.persistEntry(entry);
    new Notice(`${activeSession.label} stopped.`);
  }

  async addExerciseEntry(label: string, durationMinutes: number, intensity: ExerciseEntry["intensity"], note = "", linkedSessionStart = ""): Promise<void> {
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
      loggedAt: formatDateTimeKey(new Date()),
      linkedSessionStart
    }, ...entry.exerciseLog].slice(0, 30);
    await this.persistEntry(entry);
  }

  async removeExerciseEntry(index: number): Promise<void> {
    const entry = this.getTodayEntry();
    entry.exerciseLog = entry.exerciseLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }

  async updateBodyWeight(value: number | null): Promise<void> {
    const entry = this.getTodayEntry();
    entry.bodyWeight = typeof value === "number" && Number.isFinite(value) && value > 0 ? clamp(value, 1, 9999) : null;
    await this.persistEntry(entry);
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
        await this.refreshMasterHubPortfolioSnapshot(false);
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
    new Notice("Weekly dashboard report generated.");
  }

  async generateMonthlyReport(): Promise<void> {
    const today = new Date();
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
    new Notice("Monthly dashboard report generated.");
  }

  async generateGamificationReport(): Promise<void> {
    const today = new Date();
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
    new Notice("Gamification report generated.");
  }

  async exportDashboardMetrics(): Promise<void> {
    const entries = this.getAllEntries();
    const today = new Date();
    const earliestDate = entries[0]?.date ?? formatDateKey(today);
    const latestDate = entries[entries.length - 1]?.date ?? formatDateKey(today);
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
    new Notice(`Dashboard export generated in ${folder}.`);
  }

  async openBasicInformationNote(): Promise<void> {
    const file = await this.ensureBasicInformationNoteExists();
    await this.openFile(file);
  }

  async ensureBasicInformationNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.basicInfoNotePath, () => this.renderBasicInformationTemplate());
  }

  async openAiGuardrailsNote(): Promise<void> {
    const file = await this.ensureAiGuardrailsNoteExists();
    await this.openFile(file);
  }

  async ensureAiGuardrailsNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.aiGuardrailsNotePath, () => this.renderAiGuardrailsTemplate());
  }

  async openCurrentSeasonNote(): Promise<void> {
    const file = await this.ensureCurrentSeasonNoteExists();
    await this.openFile(file);
  }

  async ensureCurrentSeasonNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.currentSeasonNotePath, () => this.renderCurrentSeasonTemplate());
  }

  async openPeopleDependenciesNote(): Promise<void> {
    const file = await this.ensurePeopleDependenciesNoteExists();
    await this.openFile(file);
  }

  async ensurePeopleDependenciesNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.peopleDependenciesNotePath, () => this.renderPeopleDependenciesTemplate());
  }

  async openDecisionJournalNote(): Promise<void> {
    const file = await this.ensureDecisionJournalNoteExists();
    await this.openFile(file);
  }

  async ensureDecisionJournalNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.decisionJournalNotePath, () => this.renderDecisionJournalTemplate());
  }

  async openSystemMapNote(): Promise<void> {
    const file = await this.ensureSystemMapNoteExists();
    await this.openFile(file);
  }

  async ensureSystemMapNoteExists(): Promise<TFile> {
    return this.ensureSupportNote(this.data.settings.systemMapNotePath, () => this.renderSystemMapTemplate());
  }

  async ensureCoreSupportNotesExist(): Promise<void> {
    await this.ensureBasicInformationNoteExists();
    await this.ensureAiGuardrailsNoteExists();
    await this.ensureCurrentSeasonNoteExists();
    await this.ensureDecisionJournalNoteExists();
    await this.ensureSystemMapNoteExists();
  }

  async initializeCompiledResearchWiki(): Promise<void> {
    const { createdCount, homeFile } = await this.ensureCompiledResearchWikiScaffold();

    if (homeFile) {
      await this.openFile(homeFile);
    }

    new Notice(createdCount > 0
      ? `Compiled research wiki initialized. Created ${createdCount} starter note${createdCount === 1 ? "" : "s"}.`
      : "Compiled research wiki folders and starter notes already exist.");
  }

  async generateCompiledResearchWikiHealthCheck(): Promise<void> {
    const file = await this.createCompiledResearchWikiHealthCheck();
    await this.openFile(file);
    new Notice("Compiled research wiki health check generated.");
  }

  async compileActiveNoteIntoResearchSourceSummary(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a markdown source note before compiling it into a research summary.");
    if (!activeFile) {
      return;
    }

    await this.runKnowledgeBaseAiWorkflow({
      kind: "Research Source Summary",
      templateKey: "source-summary-compiler",
      activeFile,
      query: `Compile source note ${activeFile.path}`,
      outputFolder: this.data.settings.knowledgeBaseSourcesFolder,
      defaultFileLabel: `${stripMarkdownExtension(activeFile.name)} Source Summary`,
      fixedPath: `${normalizeFolderPath(this.data.settings.knowledgeBaseSourcesFolder)}/${sanitizeFileName(stripMarkdownExtension(activeFile.name))}.md`,
      systemPrompt: [
        "You are compiling one raw research note into a structured markdown source summary for an Obsidian wiki.",
        "Return markdown that starts with a single H1 title naming the source succinctly.",
        "Then use headings: Source Metadata, Core Claims, Methods Or Framing, Linked Concepts, Open Questions, Reusable Quotes Or Data.",
        "In Source Metadata include the raw note path and explain why the source matters.",
        "Keep claims evidence-aware and uncertainty-aware. Use concise markdown bullets. When useful, suggest wiki-link-ready concept names in Linked Concepts.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Compile the active source note ${activeFile.path} into a structured source summary that can live in the compiled research wiki.`
    });
  }

  async generateConceptNoteFromActiveResearchNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a markdown research note before generating a concept note.");
    if (!activeFile) {
      return;
    }

    await this.runKnowledgeBaseAiWorkflow({
      kind: "Research Concept Note",
      templateKey: "concept-note-generator",
      activeFile,
      query: `Generate concept note from ${activeFile.path}`,
      outputFolder: this.data.settings.knowledgeBaseConceptsFolder,
      defaultFileLabel: `${stripMarkdownExtension(activeFile.name)} Concept`,
      systemPrompt: [
        "You are turning a research note into a reusable concept note for an Obsidian compiled wiki.",
        "Return markdown that starts with a single H1 title containing the best short concept name.",
        "Then use headings: Working Definition, Why It Matters, Core Claims, Related Concepts, Source Summaries, Output Hooks.",
        "Use wiki-link-ready note names where appropriate. Distinguish durable claims from tentative inferences.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Generate a concept note from the active research note ${activeFile.path}. Focus on the durable idea rather than merely restating the source.`
    });
  }

  async generateResearchAnswerNoteFromActiveNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a markdown note with the question or topic before generating a research answer note.");
    if (!activeFile) {
      return;
    }

    await this.runKnowledgeBaseAiWorkflow({
      kind: "Research Answer Note",
      templateKey: "research-answer-note",
      activeFile,
      query: `Answer research question from ${activeFile.path}`,
      outputFolder: this.data.settings.knowledgeBaseOutputsFolder,
      defaultFileLabel: `${stripMarkdownExtension(activeFile.name)} Answer`,
      systemPrompt: [
        "You are writing a research answer note from compiled wiki material.",
        "Return markdown that starts with a single H1 title suitable for a standalone answer note.",
        "Then use headings: Direct Answer, Supporting Evidence, Counterpoints And Caveats, Source Notes Used, Promotion Targets.",
        "Answer directly first. Prefer cited note paths or wiki-link-ready note names over vague references.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Use the active note ${activeFile.path} as the question or topic seed and write a direct research answer note grounded in the compiled research wiki.`,
      question: `Research answer for ${activeFile.path}`
    });
  }

  async generateResearchBriefFromActiveNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a markdown note with the topic before generating a research brief.");
    if (!activeFile) {
      return;
    }

    await this.runKnowledgeBaseAiWorkflow({
      kind: "Research Brief",
      templateKey: "research-brief",
      activeFile,
      query: `Generate research brief from ${activeFile.path}`,
      outputFolder: this.data.settings.knowledgeBaseOutputsFolder,
      defaultFileLabel: `${stripMarkdownExtension(activeFile.name)} Brief`,
      systemPrompt: [
        "You are writing a concise research brief from compiled wiki material.",
        "Return markdown that starts with a single H1 title suitable for a standalone brief.",
        "Then use headings: Executive Summary, Key Evidence, Implications, Recommended Next Steps, Promotion Targets.",
        "Keep it concise, practical, and reusable for future synthesis work.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Use the active note ${activeFile.path} as the brief topic and generate a concise research brief grounded in the compiled research wiki.`,
      question: `Research brief for ${activeFile.path}`
    });
  }

  async askResearchQuestionAndWriteWikiNotes(input: {
    question: string;
    additionalContext?: string;
    generateBrief?: boolean;
    generateAnswer?: boolean;
    groundingMode?: ResearchGroundingMode;
  }): Promise<void> {
    const trimmedQuestion = input.question.trim();
    const trimmedContext = input.additionalContext?.trim() ?? "";
    const generateBrief = input.generateBrief ?? true;
    const generateAnswer = input.generateAnswer ?? true;
    const groundingMode = input.groundingMode ?? "vault-plus-web";

    if (!trimmedQuestion) {
      new Notice("Enter a research question first.");
      return;
    }

    if (!generateBrief && !generateAnswer) {
      new Notice("Choose at least one research output to generate.");
      return;
    }

    try {
      const scaffold = await this.ensureCompiledResearchWikiScaffold();
      if (scaffold.createdCount > 0) {
        new Notice(`Compiled research wiki scaffold created automatically (${scaffold.createdCount} starter note${scaffold.createdCount === 1 ? "" : "s"}).`);
      }

      const seedFile = await this.createKnowledgeBaseQuestionSeedNote({
        question: trimmedQuestion,
        additionalContext: trimmedContext,
        generateBrief,
        generateAnswer,
        groundingMode
      });
      await this.openFile(seedFile);
      new Notice("Research question seed note created. Generating requested wiki notes...");

      if (!this.getResolvedAiApiKey()) {
        new Notice(`Research question seed note created. ${this.getAiConfigurationMessage()}`);
        return;
      }

      const additionalSections = trimmedContext.length > 0
        ? [
            [
              "## User Context And Constraints",
              trimmedContext
            ].join("\n\n")
          ]
        : [];
      const queryBasis = [trimmedQuestion, trimmedContext].filter((value) => value.trim().length > 0).join("\n\n");
      const generatedFiles: TFile[] = [];

      if (generateBrief) {
        const briefFile = await this.runKnowledgeBaseAiWorkflow({
          kind: "Research Question Brief",
          templateKey: "research-question-brief",
          activeFile: seedFile,
          query: `Brief research answer for ${queryBasis || seedFile.path}`,
          outputFolder: this.data.settings.knowledgeBaseOutputsFolder,
          defaultFileLabel: `${stripMarkdownExtension(seedFile.name)} Brief`,
          systemPrompt: [
            "You are writing a concise research brief from a user-authored question seed note.",
            ...this.getResearchGroundingInstructions(groundingMode),
            "For health, safety, legal, or other sensitive questions, stay educational, avoid presenting a diagnosis or certainty, and call out obvious reasons to seek qualified help.",
            "Return markdown that starts with a single H1 title suitable for a standalone brief.",
            "Then use headings: Direct Takeaway, Most Likely Explanation, What To Watch Or Verify, Related Wiki Hooks, Promotion Targets.",
            "Keep it concise, practical, and durable for later review.",
            "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
          ].join(" "),
          userPrompt: `Use the active note ${seedFile.path} as the research-question seed. Write a concise brief that answers the question directly and follow the configured grounding mode exactly.`,
          question: trimmedQuestion,
          additionalSections,
          modelOverride: this.getResearchModel(),
          requestMode: groundingMode === "vault-plus-web" ? "responses-web-search" : "chat",
          groundingModeLabel: groundingMode
        });
        if (briefFile) {
          generatedFiles.push(briefFile);
        }
      }

      if (generateAnswer) {
        const answerFile = await this.runKnowledgeBaseAiWorkflow({
          kind: "Research Question Answer",
          templateKey: "research-question-answer",
          activeFile: seedFile,
          query: `Detailed research answer for ${queryBasis || seedFile.path}`,
          outputFolder: this.data.settings.knowledgeBaseOutputsFolder,
          defaultFileLabel: `${stripMarkdownExtension(seedFile.name)} Answer`,
          systemPrompt: [
            "You are writing a detailed teaching-oriented research answer from a user-authored question seed note.",
            ...this.getResearchGroundingInstructions(groundingMode),
            "For health, safety, legal, or other sensitive questions, stay educational, avoid presenting a diagnosis or certainty, and call out obvious reasons to seek qualified help.",
            "Return markdown that starts with a single H1 title suitable for a standalone answer note.",
            "Then use headings: Plain-English Answer, Mechanisms Or Concepts, Variations And Caveats, Source Basis And Confidence, Related Wiki Hooks, Promotion Targets.",
            "Teach clearly, explain why, and make the note useful to revisit later.",
            "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
          ].join(" "),
          userPrompt: `Use the active note ${seedFile.path} as the research-question seed. Write a detailed answer note that teaches the topic clearly and follow the configured grounding mode exactly.`,
          question: trimmedQuestion,
          additionalSections,
          modelOverride: this.getResearchModel(),
          requestMode: groundingMode === "vault-plus-web" ? "responses-web-search" : "chat",
          groundingModeLabel: groundingMode
        });
        if (answerFile) {
          generatedFiles.push(answerFile);
        }
      }

      if (generatedFiles.length > 0) {
        new Notice(`Research question workflow generated ${generatedFiles.length} wiki note${generatedFiles.length === 1 ? "" : "s"}.`);
        return;
      }

      new Notice("Research question seed note was created, but no wiki notes were generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new Notice(`Research question workflow failed: ${message}`);
    }
  }

  async generateResearchMarpSlideDeckFromActiveNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a markdown note with the topic before generating a research slide deck.");
    if (!activeFile) {
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
      const context = await this.buildKnowledgeBaseAiContext({
        activeFile,
        query: `Marp slide deck for ${activeFile.path}`,
        additionalSections: []
      });
      const rawResponse = await this.requestAiCompletion(
        this.applyAiPromptTemplate([
          "You are writing a Marp slide deck from compiled research wiki material.",
          "Return markdown only, with no surrounding code fences and no JSON block.",
          "The response should start with a title slide using an H1 heading.",
          "Use '---' separators between slides.",
          "Create 6 to 10 concise slides optimized for explanation, not dense paragraphs.",
          "Prefer short bullets, clear sequencing, and one idea per slide."
        ].join(" "), "research-slide-deck"),
        `Use the active note ${activeFile.path} as the topic seed and generate a Marp slide deck grounded in the compiled research wiki.\n\n${context}`
      );
      const cleanedMarkdown = stripJsonCodeBlocks(rawResponse).trim();
      const fileLabel = this.getLeadingMarkdownTitle(cleanedMarkdown) || `${stripMarkdownExtension(activeFile.name)} Slide Deck`;
      const file = await this.createKnowledgeBaseSlideDeckNote({
        folder: `${normalizeFolderPath(this.data.settings.knowledgeBaseOutputsFolder)}/Slides`,
        fileLabel,
        deckMarkdown: cleanedMarkdown,
        sourceFile: activeFile
      });

      this.latestAiArtifact = {
        kind: "Research Marp Slide Deck",
        title: fileLabel,
        generatedAt: formatDateTimeKey(new Date()),
        notePath: file.path,
        summary: extractAiSummary(cleanedMarkdown),
        suggestedFocus: [],
        nextActions: []
      };

      this.refreshDashboardViews();
      await this.openFile(file);
      new Notice("Research Marp slide deck generated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new Notice(`AI request failed: ${message}`);
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }

  async promoteActiveResearchOutputToConceptNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a research output note before promoting it into a concept note.");
    if (!activeFile) {
      return;
    }

    await this.runKnowledgeBaseAiWorkflow({
      kind: "Research Output Promotion",
      templateKey: "research-output-promotion",
      activeFile,
      query: `Promote research output ${activeFile.path} into a concept note`,
      outputFolder: this.data.settings.knowledgeBaseConceptsFolder,
      defaultFileLabel: `${stripMarkdownExtension(activeFile.name)} Promoted Concept`,
      systemPrompt: [
        "You are promoting a research output note back into the compiled wiki as a durable concept note.",
        "Return markdown that starts with a single H1 title containing the best concept name.",
        "Then use headings: Working Definition, Why It Matters, Core Claims, Related Concepts, Source Summaries, Output Hooks.",
        "Preserve durable insights, strip presentation fluff, and keep the note grounded in the output's evidence.",
        "End with one fenced json block containing keys suggestedFocus, nextActions, keyRisks, followUpQuestions."
      ].join(" "),
      userPrompt: `Promote the active research output note ${activeFile.path} into a reusable concept note for the compiled research wiki.`
    });
  }

  async promoteFollowUpQuestionsFromActiveResearchNote(): Promise<void> {
    const activeFile = this.getActiveMarkdownFile("Open a research note before promoting its follow-up questions into the index.");
    if (!activeFile) {
      return;
    }

    const questions = this.extractSectionBulletLines(await this.app.vault.read(activeFile), "Follow-Up Questions")
      .map((item) => item.replace(/^\[[ xX]\]\s+/, "").trim())
      .filter((item) => item.length > 0);
    if (questions.length === 0) {
      new Notice("No follow-up questions section was found in the active research note.");
      return;
    }

    const openQuestionsPath = this.getKnowledgeBaseStarterNoteDefinitions().find((note) => note.key === "questions")?.path;
    if (!openQuestionsPath) {
      new Notice("Open Questions note path is not configured.");
      return;
    }

    const openQuestionsFile = await this.ensureSupportNote(openQuestionsPath, () => this.renderKnowledgeBaseOpenQuestionsTemplate());
    const updated = await this.appendUniqueBulletsToSection(openQuestionsFile, "Active Questions", questions);
    new Notice(updated > 0
      ? `Added ${updated} follow-up question${updated === 1 ? "" : "s"} to Open Questions.`
      : "No new follow-up questions needed to be added.");
    await this.openFile(openQuestionsFile);
  }

  async regenerateCompiledResearchTopicIndex(): Promise<void> {
    const file = await this.createCompiledResearchTopicIndex();
    await this.openFile(file);
    new Notice("Compiled research topic index regenerated.");
  }

  async generateCompiledResearchRetrievalTuningNote(): Promise<void> {
    const file = await this.createCompiledResearchRetrievalTuningNote();
    await this.openFile(file);
    new Notice("Compiled research retrieval tuning note generated.");
  }

  private getKnowledgeBaseFolders(): string[] {
    return [
      this.data.settings.knowledgeBaseRawFolder,
      this.data.settings.knowledgeBaseSourcesFolder,
      this.data.settings.knowledgeBaseConceptsFolder,
      this.data.settings.knowledgeBaseIndexesFolder,
      this.data.settings.knowledgeBaseOutputsFolder,
      this.data.settings.knowledgeBaseAssetsFolder
    ]
      .map((folder) => normalizeFolderPath(folder))
      .filter((folder, index, folders) => folder.length > 0 && folders.indexOf(folder) === index);
  }

  private getKnowledgeBaseStarterNoteDefinitions(): Array<{ key: string; path: string; render: () => string }> {
    const indexesFolder = normalizeFolderPath(this.data.settings.knowledgeBaseIndexesFolder);
    const sourcesFolder = normalizeFolderPath(this.data.settings.knowledgeBaseSourcesFolder);
    const conceptsFolder = normalizeFolderPath(this.data.settings.knowledgeBaseConceptsFolder);
    const outputsFolder = normalizeFolderPath(this.data.settings.knowledgeBaseOutputsFolder);

    return [
      {
        key: "home",
        path: normalizePath(`${indexesFolder}/Research Home.md`),
        render: () => this.renderKnowledgeBaseHomeTemplate()
      },
      {
        key: "questions",
        path: normalizePath(`${indexesFolder}/Open Questions.md`),
        render: () => this.renderKnowledgeBaseOpenQuestionsTemplate()
      },
      {
        key: "source-template",
        path: normalizePath(`${sourcesFolder}/Source Summary Template.md`),
        render: () => this.renderKnowledgeBaseSourceSummaryTemplate()
      },
      {
        key: "concept-template",
        path: normalizePath(`${conceptsFolder}/Concept Note Template.md`),
        render: () => this.renderKnowledgeBaseConceptTemplate()
      },
      {
        key: "output-template",
        path: normalizePath(`${outputsFolder}/Answer Note Template.md`),
        render: () => this.renderKnowledgeBaseOutputTemplate()
      }
    ].filter((note) => note.path.length > 0);
  }

  private getKnowledgeBaseRecommendedIndexedFolders(): string[] {
    return [
      this.data.settings.knowledgeBaseSourcesFolder,
      this.data.settings.knowledgeBaseConceptsFolder,
      this.data.settings.knowledgeBaseIndexesFolder
    ]
      .map((folder) => normalizeFolderPath(folder))
      .filter((folder, index, folders) => folder.length > 0 && folders.indexOf(folder) === index);
  }

  private getMarkdownFilesInFolder(folderPath: string): TFile[] {
    const normalizedFolder = normalizeFolderPath(folderPath);
    if (!normalizedFolder) {
      return [];
    }

    return this.app.vault.getMarkdownFiles().filter((file) => normalizePath(file.path).startsWith(`${normalizedFolder}/`));
  }

  private getFilesInFolder(folderPath: string): TFile[] {
    const normalizedFolder = normalizeFolderPath(folderPath);
    if (!normalizedFolder) {
      return [];
    }

    return this.app.vault.getFiles().filter((file) => normalizePath(file.path).startsWith(`${normalizedFolder}/`));
  }

  private async createCompiledResearchWikiHealthCheck(): Promise<TFile> {
    const generatedAt = new Date();
    const starterNotes = this.getKnowledgeBaseStarterNoteDefinitions();
    const starterPathSet = new Set(starterNotes.map((note) => normalizePath(note.path).toLowerCase()));
    const rawFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseRawFolder);
    const sourceFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseSourcesFolder)
      .filter((file) => !starterPathSet.has(normalizePath(file.path).toLowerCase()));
    const conceptFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseConceptsFolder)
      .filter((file) => !starterPathSet.has(normalizePath(file.path).toLowerCase()));
    const indexFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseIndexesFolder)
      .filter((file) => !starterPathSet.has(normalizePath(file.path).toLowerCase()));
    const healthCheckFolder = normalizeFolderPath(`${this.data.settings.knowledgeBaseOutputsFolder}/Health Checks`);
    const healthCheckFiles = this.getMarkdownFilesInFolder(healthCheckFolder);
    const outputFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseOutputsFolder)
      .filter((file) => !starterPathSet.has(normalizePath(file.path).toLowerCase()))
      .filter((file) => !normalizePath(file.path).startsWith(`${healthCheckFolder}/`));
    const missingStarterNotes = starterNotes
      .map((note) => note.path)
      .filter((path) => !(this.app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFile));
    const sourceSummaryNames = new Set(sourceFiles.map((file) => file.basename.trim().toLowerCase()));
    const rawWithoutSummary = rawFiles.filter((file) => !sourceSummaryNames.has(file.basename.trim().toLowerCase()));
    const conceptLinkCounts = await Promise.all(conceptFiles.map(async (file) => ({
      file,
      linkCount: (await this.app.vault.read(file)).match(/\[\[[^\]]+\]\]/g)?.length ?? 0
    })));
    const lowLinkConceptFiles = conceptLinkCounts.filter((item) => item.linkCount < 2).map((item) => item.file);
    const staleIndexFiles = indexFiles.filter((file) => generatedAt.getTime() - file.stat.mtime > 30 * 24 * 60 * 60 * 1000);
    const duplicateConceptGroups = this.getDuplicateConceptCandidateGroups(conceptFiles);
    const assetCount = this.getFilesInFolder(this.data.settings.knowledgeBaseAssetsFolder).length;
    const filePath = this.getAvailableMarkdownPath(`${healthCheckFolder}/${formatDateKey(generatedAt)} Compiled Research Wiki Health Check.md`);
    const content = this.renderCompiledResearchWikiHealthCheck({
      generatedAt,
      rawFiles,
      sourceFiles,
      conceptFiles,
      indexFiles,
      outputFiles,
      healthCheckFiles,
      missingStarterNotes,
      rawWithoutSummary,
      lowLinkConceptFiles,
      staleIndexFiles,
      duplicateConceptGroups,
      assetCount,
      recommendedIndexedFolders: this.getKnowledgeBaseRecommendedIndexedFolders()
    });
    return this.upsertMarkdownFile(filePath, content);
  }

  private async createCompiledResearchRetrievalTuningNote(): Promise<TFile> {
    const generatedAt = new Date();
    await this.ensureAiNoteIndexReady();
    const recommendedFolders = this.getKnowledgeBaseRecommendedIndexedFolders();
    const indexedFolders = getIndexedFolderList(this.data.settings);
    const indexedKnowledgeBaseFolders = indexedFolders.filter((folder) => recommendedFolders.includes(folder));
    const rawIndexed = indexedFolders.includes(normalizeFolderPath(this.data.settings.knowledgeBaseRawFolder));
    const knowledgeBaseEntries = Object.values(this.data.noteIndex.entries)
      .filter((entry) => recommendedFolders.some((folder) => entry.path === folder || entry.path.startsWith(`${folder}/`)));
    const noteCount = knowledgeBaseEntries.length;
    const chunkCount = knowledgeBaseEntries.reduce((sum, entry) => sum + entry.chunks.length, 0);
    const embeddedChunkCount = knowledgeBaseEntries.reduce((sum, entry) => sum + entry.chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0).length, 0);
    const averageChunksPerNote = noteCount > 0 ? (chunkCount / noteCount).toFixed(1) : "0.0";
    const missingRecommendedFolders = recommendedFolders.filter((folder) => !indexedFolders.includes(folder));
    const guidance = [
      noteCount < 25
        ? "Current wiki volume is still small enough that folder-scoped keyword retrieval should stay effective without extra tuning."
        : noteCount < 75
          ? "Wiki volume is entering the range where chunk quality and note naming matter more than adding complex retrieval layers."
          : "Wiki volume is large enough that embeddings or stricter retrieval scoping may now be worth the added cost.",
      rawIndexed
        ? `Raw sources are currently included in AI indexed folders. Consider removing ${this.data.settings.knowledgeBaseRawFolder} unless direct raw-source retrieval is worth the noise.`
        : "Raw-source indexing is still optional, which keeps retrieval cleaner for synthesized answers.",
      this.data.settings.aiEmbeddingsEnabled
        ? `Embeddings are enabled with ${embeddedChunkCount} embedded knowledge-base chunk${embeddedChunkCount === 1 ? "" : "s"}. Reassess only if semantic matches still feel noisy or shallow.`
        : noteCount >= 75
          ? "Embeddings are currently off. At this note volume, enabling them may improve concept-level retrieval across differently worded notes."
          : "Embeddings are currently off, which is still a reasonable default at the current wiki size.",
      missingRecommendedFolders.length === 0
        ? "All recommended compiled wiki folders are in AI indexed folders."
        : `Recommended compiled folders missing from AI indexed folders: ${missingRecommendedFolders.join(", ")}.`
    ];
    const filePath = this.getAvailableMarkdownPath(`${normalizeFolderPath(this.data.settings.knowledgeBaseOutputsFolder)}/Health Checks/${formatDateKey(generatedAt)} Retrieval Tuning.md`);
    const content = [
      `# Compiled Research Retrieval Tuning - ${formatDateKey(generatedAt)}`,
      "",
      `- Generated: ${formatDateTimeKey(generatedAt)}`,
      `- Knowledge-base indexed notes: ${noteCount}`,
      `- Knowledge-base indexed chunks: ${chunkCount}`,
      `- Average chunks per note: ${averageChunksPerNote}`,
      `- Knowledge-base embedded chunks: ${embeddedChunkCount}`,
      `- Embeddings enabled: ${this.data.settings.aiEmbeddingsEnabled ? "yes" : "no"}`,
      `- AI related note limit: ${this.data.settings.aiRelatedNotesLimit}`,
      `- AI chunk character limit: ${this.data.settings.aiChunkCharLimit}`,
      "",
      "## Recommended Compiled Wiki Scope",
      ...recommendedFolders.map((folder) => `- ${folder}`),
      `- Optional only: ${this.data.settings.knowledgeBaseRawFolder}`,
      "",
      "## Current Indexed Folders",
      ...(indexedFolders.length > 0 ? indexedFolders.map((folder) => `- ${folder}`) : ["- No AI indexed folders are configured."]),
      "",
      "## Knowledge Base Indexed Folders In Use",
      ...(indexedKnowledgeBaseFolders.length > 0 ? indexedKnowledgeBaseFolders.map((folder) => `- ${folder}`) : ["- None of the compiled wiki folders are currently indexed."]),
      "",
      "## Guidance",
      ...guidance.map((item) => `- ${item}`),
      "",
      "## Reassess Triggers",
      "- Revisit chunk size if source summaries become much denser or more heavily quoted.",
      "- Revisit embeddings when note volume rises enough that filename and heading matching stop being reliable.",
      "- Revisit indexed folders when raw captures start crowding out concept and source-summary matches.",
      ""
    ].join("\n");

    return this.upsertMarkdownFile(filePath, content);
  }

  private getActiveMarkdownFile(missingNoteMessage: string): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (!(activeFile instanceof TFile) || !activeFile.path.endsWith(".md")) {
      new Notice(missingNoteMessage);
      return null;
    }

    return activeFile;
  }

  private async runKnowledgeBaseAiWorkflow(input: {
    kind: string;
    templateKey: string;
    activeFile: TFile;
    query: string;
    outputFolder: string;
    defaultFileLabel: string;
    systemPrompt: string;
    userPrompt: string;
    question?: string;
    fixedPath?: string;
    additionalSections?: string[];
    modelOverride?: string;
    requestMode?: "chat" | "responses-web-search";
    groundingModeLabel?: ResearchGroundingMode;
  }): Promise<TFile | null> {
    if (!this.getResolvedAiApiKey()) {
      new Notice(this.getAiConfigurationMessage());
      return null;
    }

    if (this.isAiBusy) {
      new Notice("An AI request is already running.");
      return null;
    }

    this.isAiBusy = true;
    this.refreshDashboardViews();

    try {
      const context = await this.buildKnowledgeBaseAiContext({
        activeFile: input.activeFile,
        query: input.query,
        additionalSections: input.additionalSections ?? []
      });
      const resolvedModel = input.modelOverride?.trim() || this.data.settings.aiModel;
      const resolvedPrompt = this.applyAiPromptTemplate(input.systemPrompt, input.templateKey);
      const rawResponse = input.requestMode === "responses-web-search"
        ? await this.requestAiCompletionWithWebSearch(resolvedPrompt, `${input.userPrompt}\n\n${context}`, resolvedModel)
        : await this.requestAiCompletion(resolvedPrompt, `${input.userPrompt}\n\n${context}`, resolvedModel);
      const payload = extractAiStructuredPayload(rawResponse);
      const cleanedMarkdown = stripJsonCodeBlocks(rawResponse).trim();
      const derivedTitle = this.getLeadingMarkdownTitle(cleanedMarkdown) || input.defaultFileLabel;
      const file = await this.createKnowledgeBaseGeneratedNote({
        kind: input.kind,
        folder: input.outputFolder,
        fileLabel: derivedTitle,
        markdown: this.stripLeadingMarkdownTitle(cleanedMarkdown),
        payload,
        question: input.question,
        sourceFile: input.activeFile,
        fixedPath: input.fixedPath,
        modelName: resolvedModel,
        groundingMode: input.groundingModeLabel
      });

      this.latestAiArtifact = {
        kind: input.kind,
        title: derivedTitle,
        generatedAt: formatDateTimeKey(new Date()),
        notePath: file.path,
        summary: extractAiSummary(cleanedMarkdown),
        suggestedFocus: payload.suggestedFocus.slice(0, 3),
        nextActions: (payload.nextActions.length > 0 ? payload.nextActions : payload.suggestedFocus).slice(0, 5)
      };

      this.refreshDashboardViews();
      await this.openFile(file);
      new Notice(`${input.kind} generated.`);
      return file;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      new Notice(`AI request failed: ${message}`);
      return null;
    } finally {
      this.isAiBusy = false;
      this.refreshDashboardViews();
    }
  }

  private async ensureCompiledResearchWikiScaffold(): Promise<{ createdCount: number; homeFile: TFile | null }> {
    for (const folder of this.getKnowledgeBaseFolders()) {
      await this.ensureFolder(folder);
    }

    let createdCount = 0;
    let homeFile: TFile | null = null;
    for (const starterNote of this.getKnowledgeBaseStarterNoteDefinitions()) {
      const result = await this.ensureSupportNoteWithStatus(starterNote.path, starterNote.render);
      if (starterNote.key === "home") {
        homeFile = result.file;
      }
      if (result.created) {
        createdCount += 1;
      }
    }

    return { createdCount, homeFile };
  }

  private async createKnowledgeBaseQuestionSeedNote(input: {
    question: string;
    additionalContext: string;
    generateBrief: boolean;
    generateAnswer: boolean;
    groundingMode: ResearchGroundingMode;
  }): Promise<TFile> {
    const timestamp = formatFileTimestamp(new Date());
    const folder = normalizeFolderPath(`${this.data.settings.knowledgeBaseRawFolder}/Questions`);
    const requestedOutputs = [
      input.generateBrief ? "Research brief" : "",
      input.generateAnswer ? "Detailed answer note" : ""
    ].filter((value) => value.length > 0);
    const baseQuestion = input.question.replace(/[?!.]+$/g, "").trim() || "Research Question";
    const fileLabel = baseQuestion.length > 90 ? `${baseQuestion.slice(0, 87).trim()}...` : baseQuestion;
    const filePath = this.getAvailableMarkdownPath(`${folder}/${timestamp} ${sanitizeFileName(fileLabel)}.md`);
    const content = [
      `# ${input.question}`,
      "",
      `- Captured: ${formatDateTimeKey(new Date())}`,
      "- Workflow: Research Question Seed",
      `- Requested outputs: ${requestedOutputs.length > 0 ? requestedOutputs.join(", ") : "None specified"}`,
      `- Grounding mode: ${input.groundingMode}`,
      `- Grounding rule: ${this.getResearchGroundingSummary(input.groundingMode)}`,
      "",
      "## Question",
      input.question,
      "",
      "## Context And Constraints",
      input.additionalContext || "- No extra context provided.",
      "",
      "## Existing Knowledge Base Hooks",
      "- Add likely source summaries, concept notes, or index notes here if you already know what the question should connect to.",
      "",
      "## Follow-Up Directions",
      "- Promote durable explanations into concept notes if the answer becomes evergreen.",
      "- Promote any unresolved threads into Open Questions if the answer exposes real gaps.",
      ""
    ].join("\n");

    return this.upsertMarkdownFile(filePath, content);
  }

  private getResearchModel(): string {
    return this.data.settings.researchAiModel.trim() || this.data.settings.aiModel;
  }

  private getResearchGroundingSummary(mode: ResearchGroundingMode): string {
    switch (mode) {
      case "vault-only":
        return "Use only the seed note plus compiled wiki notes. If coverage is weak, say that clearly instead of filling gaps.";
      case "vault-plus-model":
        return "Use compiled wiki notes first and then clearly labeled model prior knowledge when the wiki is thin.";
      case "vault-plus-web":
        return "Use compiled wiki notes, model prior knowledge, and live web search results, while labeling what came from each source of grounding.";
      default:
        return "Prefer compiled wiki notes first and clearly label anything that comes from outside the current wiki.";
    }
  }

  private getResearchGroundingInstructions(mode: ResearchGroundingMode): string[] {
    switch (mode) {
      case "vault-only":
        return [
          "Use only the compiled wiki material and the seed note.",
          "Do not fill missing gaps with general model knowledge or web claims.",
          "If the wiki does not support a confident answer, say that directly and explain what is missing."
        ];
      case "vault-plus-model":
        return [
          "Use compiled wiki material when it exists, but if the wiki lacks direct coverage you may use well-established model prior knowledge.",
          "Do not imply live web browsing, external verification, or source access you do not actually have.",
          "When you rely on model prior knowledge or inference, label that clearly in the markdown."
        ];
      case "vault-plus-web":
        return [
          "Use compiled wiki material first, but you may also use live web search results and well-established model prior knowledge to answer the question.",
          "Do not pretend every claim came from the wiki. Distinguish wiki grounding, web findings, and model prior knowledge clearly.",
          "When web search results conflict or are weak, say so instead of smoothing over the uncertainty."
        ];
      default:
        return [];
    }
  }

  private async buildKnowledgeBaseAiContext(input: {
    activeFile: TFile;
    query: string;
    additionalSections: string[];
  }): Promise<string> {
    const homeNote = this.getKnowledgeBaseStarterNoteDefinitions().find((note) => note.key === "home")?.path ?? "";
    const openQuestionsNote = this.getKnowledgeBaseStarterNoteDefinitions().find((note) => note.key === "questions")?.path ?? "";
    const relatedSections = await this.collectKnowledgeBaseContextSections(input.query, [input.activeFile.path], 5);
    const homeSection = await this.buildVaultNoteContext("Knowledge Base Home", homeNote, 3000);
    const openQuestionsSection = await this.buildVaultNoteContext("Knowledge Base Open Questions", openQuestionsNote, 3000);
    const aiGuardrailsSection = await this.buildAiGuardrailsAiContext();

    return [
      homeSection,
      openQuestionsSection,
      aiGuardrailsSection,
      await this.buildActiveNoteSection(input.activeFile, 12000),
      ...input.additionalSections.filter((section) => section.trim().length > 0),
      ...relatedSections
    ].filter((section) => section.trim().length > 0).join("\n\n");
  }

  private async buildActiveNoteSection(file: TFile, charLimit: number): Promise<string> {
    return [
      "## Active Research Note",
      `Path: ${file.path}`,
      truncateText(await this.app.vault.read(file), charLimit)
    ].join("\n\n");
  }

  private async buildVaultNoteContext(title: string, pathValue: string, charLimit: number): Promise<string> {
    const path = normalizePath(pathValue);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return "";
    }

    return [
      `## ${title}`,
      `Path: ${file.path}`,
      truncateText(await this.app.vault.read(file), charLimit)
    ].join("\n\n");
  }

  private async collectKnowledgeBaseContextSections(query: string, excludePaths: string[] = [], limit = 5): Promise<string[]> {
    const templatePaths = new Set(this.getKnowledgeBaseStarterNoteDefinitions()
      .filter((note) => note.key.includes("template"))
      .map((note) => normalizePath(note.path).toLowerCase()));
    const excludePathSet = new Set(excludePaths.map((path) => normalizePath(path).toLowerCase()));
    const terms = this.getKnowledgeBaseSearchTerms(query);
    const candidates = this.getKnowledgeBaseRecommendedIndexedFolders()
      .flatMap((folder) => this.getMarkdownFilesInFolder(folder))
      .filter((file, index, files) => files.findIndex((candidate) => normalizePath(candidate.path) === normalizePath(file.path)) === index)
      .filter((file) => !templatePaths.has(normalizePath(file.path).toLowerCase()))
      .filter((file) => !excludePathSet.has(normalizePath(file.path).toLowerCase()))
      .map((file) => ({
        file,
        score: this.scoreKnowledgeBaseContextFile(file, terms)
      }))
      .filter((item) => terms.length === 0 || item.score > 0)
      .sort((left, right) => right.score - left.score || right.file.stat.mtime - left.file.stat.mtime)
      .slice(0, limit);

    return await Promise.all(candidates.map(async ({ file }) => [
      `## Related Research Note`,
      `Path: ${file.path}`,
      truncateText(await this.app.vault.read(file), 5000)
    ].join("\n\n")));
  }

  private getKnowledgeBaseSearchTerms(value: string): string[] {
    return Array.from(new Set(value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3))).slice(0, 24);
  }

  private scoreKnowledgeBaseContextFile(file: TFile, terms: string[]): number {
    const path = normalizePath(file.path).toLowerCase();
    const name = file.basename.toLowerCase();
    const recencyScore = Math.max(0, 10 - Math.floor((Date.now() - file.stat.mtime) / 86_400_000));
    if (terms.length === 0) {
      return recencyScore;
    }

    return terms.reduce((score, term) => score
      + (name.includes(term) ? 6 : 0)
      + (path.includes(term) ? 2 : 0), recencyScore);
  }

  private getLeadingMarkdownTitle(value: string): string {
    const match = value.trimStart().match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() ?? "";
  }

  private stripLeadingMarkdownTitle(value: string): string {
    return value.replace(/^\s*#\s+.+?(?:\r?\n)+/, "").trim();
  }

  private async createKnowledgeBaseGeneratedNote(input: {
    kind: string;
    folder: string;
    fileLabel: string;
    markdown: string;
    payload: AiStructuredPayload;
    question?: string;
    sourceFile?: TFile;
    fixedPath?: string;
    modelName?: string;
    groundingMode?: ResearchGroundingMode;
  }): Promise<TFile> {
    const timestamp = formatFileTimestamp(new Date());
    const folder = normalizeFolderPath(input.folder);
    const basePath = input.fixedPath && input.fixedPath.trim().length > 0
      ? normalizePath(input.fixedPath)
      : `${folder}/${timestamp} ${sanitizeFileName(input.fileLabel)}.md`;
    const filePath = input.fixedPath && input.fixedPath.trim().length > 0
      ? basePath
      : this.getAvailableMarkdownPath(basePath);
    const concreteActions = (input.payload.nextActions.length > 0 ? input.payload.nextActions : input.payload.suggestedFocus).slice(0, 6);
    const followUpQuestions = input.payload.followUpQuestions.slice(0, 6);
    const content = [
      `# ${input.fileLabel}`,
      "",
      `- Generated: ${formatDateTimeKey(new Date())}`,
      `- Model: ${input.modelName ?? this.data.settings.aiModel}`,
      `- Workflow: ${input.kind}`,
      input.groundingMode ? `- Grounding mode: ${input.groundingMode}` : "",
      input.sourceFile ? `- Source note: ${createWikiLink(input.sourceFile.path, input.sourceFile.basename)}` : "",
      input.question ? `- Prompt basis: ${input.question}` : "",
      "",
      "## Response",
      input.markdown,
      "",
      "## Structured Payload",
      "```json",
      JSON.stringify(input.payload, null, 2),
      "```",
      "",
      "## Follow-Up Questions",
      ...(followUpQuestions.length > 0 ? followUpQuestions.map((item) => `- ${item}`) : ["- No follow-up questions were extracted from this response."]),
      "",
      "## Concrete Actions",
      ...(concreteActions.length > 0 ? concreteActions.map((item) => `- ${item}`) : ["- No concrete actions were extracted from this response."]),
      ""
    ].filter((line) => line !== "").join("\n");

    return this.upsertMarkdownFile(filePath, content);
  }

  private async createKnowledgeBaseSlideDeckNote(input: {
    folder: string;
    fileLabel: string;
    deckMarkdown: string;
    sourceFile?: TFile;
  }): Promise<TFile> {
    const timestamp = formatFileTimestamp(new Date());
    const folder = normalizeFolderPath(input.folder);
    const filePath = this.getAvailableMarkdownPath(`${folder}/${timestamp} ${sanitizeFileName(input.fileLabel)}.md`);
    const content = [
      "---",
      "marp: true",
      "paginate: true",
      "theme: default",
      `title: ${input.fileLabel.replace(/:/g, " -")}`,
      input.sourceFile ? `description: Generated from ${input.sourceFile.path.replace(/:/g, " -")}` : "",
      "---",
      "",
      input.deckMarkdown.trim(),
      ""
    ].filter((line) => line !== "").join("\n");

    return this.upsertMarkdownFile(filePath, content);
  }

  private async appendUniqueBulletsToSection(file: TFile, heading: string, bullets: string[]): Promise<number> {
    const content = await this.app.vault.read(file);
    const lines = content.split(/\r?\n/);
    const targetHeading = heading.trim().toLowerCase();
    const normalizedBullets = bullets
      .map((bullet) => bullet.trim())
      .filter((bullet, index, items) => bullet.length > 0 && items.indexOf(bullet) === index);
    if (normalizedBullets.length === 0) {
      return 0;
    }

    let headingIndex = -1;
    let sectionLevel = 0;
    let sectionEndIndex = lines.length;
    for (let index = 0; index < lines.length; index += 1) {
      const headingMatch = lines[index].match(/^(#{1,6})\s+(.+)$/);
      if (!headingMatch) {
        continue;
      }

      const currentHeading = headingMatch[2].trim().toLowerCase();
      const currentLevel = headingMatch[1].length;
      if (headingIndex === -1 && currentHeading === targetHeading) {
        headingIndex = index;
        sectionLevel = currentLevel;
        continue;
      }

      if (headingIndex !== -1 && currentLevel <= sectionLevel) {
        sectionEndIndex = index;
        break;
      }
    }

    if (headingIndex === -1) {
      return 0;
    }

    const existingBullets = new Set(lines.slice(headingIndex + 1, sectionEndIndex)
      .map((line) => line.match(/^\s*-\s+(.*)$/)?.[1]?.trim() ?? "")
      .filter((line) => line.length > 0)
      .map((line) => line.toLowerCase()));
    const additions = normalizedBullets.filter((bullet) => !existingBullets.has(bullet.toLowerCase()));
    if (additions.length === 0) {
      return 0;
    }

    lines.splice(sectionEndIndex, 0, ...additions.map((bullet) => `- ${bullet}`));
    await this.app.vault.modify(file, lines.join("\n"));
    return additions.length;
  }

  private extractSectionBulletLines(content: string, heading: string): string[] {
    const lines = content.split(/\r?\n/);
    const targetHeading = heading.trim().toLowerCase();
    let insideSection = false;
    let sectionLevel = 0;
    const results: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const currentLevel = headingMatch[1].length;
        const currentHeading = headingMatch[2].trim().toLowerCase();
        if (insideSection && currentLevel <= sectionLevel) {
          break;
        }
        if (currentHeading === targetHeading) {
          insideSection = true;
          sectionLevel = currentLevel;
          continue;
        }
      }

      if (!insideSection) {
        continue;
      }

      const bulletMatch = line.match(/^\s*-\s+(.*)$/);
      if (bulletMatch) {
        const value = bulletMatch[1].trim();
        if (value.length > 0) {
          results.push(value);
        }
      }
    }

    return results;
  }

  private getDuplicateConceptCandidateGroups(files: TFile[]): TFile[][] {
    const groups = new Map<string, TFile[]>();

    files.forEach((file) => {
      const normalizedKey = file.basename
        .toLowerCase()
        .replace(/\s+\d+$/, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      if (!normalizedKey) {
        return;
      }

      groups.set(normalizedKey, [...(groups.get(normalizedKey) ?? []), file]);
    });

    return [...groups.values()].filter((group) => group.length > 1);
  }

  private async createCompiledResearchTopicIndex(): Promise<TFile> {
    const starterNotes = this.getKnowledgeBaseStarterNoteDefinitions();
    const templatePathSet = new Set(starterNotes
      .filter((note) => note.key.includes("template"))
      .map((note) => normalizePath(note.path).toLowerCase()));
    const rawFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseRawFolder);
    const sourceFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseSourcesFolder)
      .filter((file) => !templatePathSet.has(normalizePath(file.path).toLowerCase()));
    const conceptFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseConceptsFolder)
      .filter((file) => !templatePathSet.has(normalizePath(file.path).toLowerCase()));
    const outputFiles = this.getMarkdownFilesInFolder(this.data.settings.knowledgeBaseOutputsFolder)
      .filter((file) => !normalizePath(file.path).startsWith(`${normalizeFolderPath(this.data.settings.knowledgeBaseOutputsFolder)}/Health Checks/`));
    const rawWithoutSummary = rawFiles.filter((file) => !sourceFiles.some((summary) => summary.basename.trim().toLowerCase() === file.basename.trim().toLowerCase()));
    const duplicateConceptGroups = this.getDuplicateConceptCandidateGroups(conceptFiles);
    const conceptLinkCounts = await Promise.all(conceptFiles.map(async (file) => ({
      file,
      linkCount: (await this.app.vault.read(file)).match(/\[\[[^\]]+\]\]/g)?.length ?? 0,
      openQuestions: this.extractSectionBulletLines(await this.app.vault.read(file), "Open Questions")
    })));
    const lowLinkConceptFiles = conceptLinkCounts.filter((item) => item.linkCount < 2).map((item) => item.file);
    const sourceQuestionEntries = await Promise.all(sourceFiles.map(async (file) => ({
      file,
      openQuestions: this.extractSectionBulletLines(await this.app.vault.read(file), "Open Questions")
    })));
    const unansweredQuestions = [...new Set([
      ...sourceQuestionEntries.flatMap((item) => item.openQuestions),
      ...conceptLinkCounts.flatMap((item) => item.openQuestions)
    ].filter((item) => item.length > 0))].slice(0, 20);
    const candidateArticleIdeas = [
      ...unansweredQuestions.map((question) => `Answer note: ${question}`),
      ...rawWithoutSummary.slice(0, 6).map((file) => `Source summary still needed: ${file.basename}`),
      ...duplicateConceptGroups.slice(0, 6).map((group) => `Merge or disambiguate concept notes: ${group.map((file) => file.basename).join(" / ")}`)
    ].slice(0, 16);
    const filePath = normalizePath(`${normalizeFolderPath(this.data.settings.knowledgeBaseIndexesFolder)}/Topic Index.md`);
    const content = [
      "# Topic Index",
      "",
      `- Last regenerated: ${formatDateTimeKey(new Date())}`,
      `- Raw captures: ${rawFiles.length}`,
      `- Source summaries: ${sourceFiles.length}`,
      `- Concept notes: ${conceptFiles.length}`,
      `- Output notes: ${outputFiles.length}`,
      "",
      "## Retrieval Guidance",
      ...this.getKnowledgeBaseRecommendedIndexedFolders().map((folder) => `- Index for AI retrieval: ${folder}`),
      `- Keep ${this.data.settings.knowledgeBaseRawFolder} optional so raw captures do not dominate retrieval noise.`,
      "",
      "## Sources",
      ...(sourceFiles.length > 0
        ? sourceFiles
            .sort((left, right) => left.basename.localeCompare(right.basename))
            .map((file) => `- ${createWikiLink(file.path, file.basename)}`)
        : ["- No source summaries yet."]),
      "",
      "## Concepts",
      ...(conceptFiles.length > 0
        ? conceptFiles
            .sort((left, right) => left.basename.localeCompare(right.basename))
            .map((file) => `- ${createWikiLink(file.path, file.basename)}`)
        : ["- No concept notes yet."]),
      "",
      "## Recent Outputs",
      ...(outputFiles.length > 0
        ? [...outputFiles]
            .sort((left, right) => right.stat.mtime - left.stat.mtime)
            .slice(0, 12)
            .map((file) => `- ${createWikiLink(file.path, file.basename)}`)
        : ["- No research output notes yet."]),
      "",
      "## Coverage Gaps",
      ...(rawWithoutSummary.length > 0
        ? rawWithoutSummary.map((file) => `- Raw without matching summary filename: ${createWikiLink(file.path, file.basename)}`)
        : ["- Every raw note currently has a matching summary filename."]),
      ...(lowLinkConceptFiles.length > 0
        ? lowLinkConceptFiles.map((file) => `- Weakly linked concept candidate: ${createWikiLink(file.path, file.basename)}`)
        : ["- No weakly linked concept candidates detected."]),
      ...(duplicateConceptGroups.length > 0
        ? duplicateConceptGroups.map((group) => `- Possible duplicate concept cluster: ${group.map((file) => createWikiLink(file.path, file.basename)).join(" | ")}`)
        : ["- No duplicate concept candidates detected."]),
      "",
      "## Unanswered Questions",
      ...(unansweredQuestions.length > 0
        ? unansweredQuestions.map((question) => `- ${question}`)
        : ["- No explicit open-question bullets were found in source or concept notes yet."]),
      "",
      "## Candidate Article Ideas",
      ...(candidateArticleIdeas.length > 0
        ? candidateArticleIdeas.map((idea) => `- ${idea}`)
        : ["- No candidate article ideas were surfaced yet."]),
      "",
      "## Review Guidance",
      "- Refresh this index after adding several source summaries or concept notes.",
      "- Promote repeated findings from outputs back into concept notes or indexes.",
      "- Merge concept notes that stay semantically overlapping after a few source additions.",
      "- Archive or park raw captures that no longer justify compilation effort.",
      ""
    ].join("\n");

    return this.upsertMarkdownFile(filePath, content);
  }

  private async ensureSupportNote(pathValue: string, renderTemplate: () => string): Promise<TFile> {
    return (await this.ensureSupportNoteWithStatus(pathValue, renderTemplate)).file;
  }

  private async ensureSupportNoteWithStatus(pathValue: string, renderTemplate: () => string): Promise<{ file: TFile; created: boolean }> {
    const path = normalizePath(pathValue);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      return { file: existing, created: false };
    }

    return {
      file: await this.upsertMarkdownFile(path, renderTemplate()),
      created: true
    };
  }

  async getTodoSnapshot(): Promise<TodoSnapshot | null> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return null;
    }

    const content = await this.app.vault.read(todoFile);
    return parseTodoSnapshot(content);
  }

  isFirstRunSetupPending(): boolean {
    return !this.data.uiState.onboardingCompleted;
  }

  shouldAutoOpenFirstRunSetupWizard(referenceDate: Date = new Date()): boolean {
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

  async openFirstRunSetupWizard(): Promise<void> {
    new FirstRunSetupWizardModal(this.app, this).open();
  }

  async snoozeFirstRunSetupWizard(hours = 12): Promise<void> {
    const nextTime = new Date(Date.now() + Math.max(1, hours) * 60 * 60 * 1000);
    this.data.uiState.onboardingDeferredUntil = formatDateTimeKey(nextTime);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async completeFirstRunSetupWizard(): Promise<void> {
    if (this.data.uiState.onboardingCompleted) {
      return;
    }

    this.data.uiState.onboardingCompleted = true;
    this.data.uiState.onboardingDeferredUntil = "";
    this.data.uiState.dismissedNotificationIds = this.data.uiState.dismissedNotificationIds.filter((id) => id !== "system:onboarding");
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async dismissDashboardNotification(id: string): Promise<void> {
    if (!id.trim() || this.data.uiState.dismissedNotificationIds.includes(id)) {
      return;
    }

    this.data.uiState.dismissedNotificationIds = [...this.data.uiState.dismissedNotificationIds, id].slice(-200);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  async dismissCleanupSuggestion(id: string): Promise<void> {
    if (!id.trim() || this.data.uiState.dismissedCleanupSuggestionIds.includes(id)) {
      return;
    }

    this.data.uiState.dismissedCleanupSuggestionIds = [...this.data.uiState.dismissedCleanupSuggestionIds, id].slice(-200);
    await this.savePluginData();
    this.refreshDashboardViews();
  }

  private reconcileDismissedNotificationIds(activeDismissibleIds: string[]): void {
    const allowed = new Set(activeDismissibleIds);
    const nextDismissed = this.data.uiState.dismissedNotificationIds.filter((id) => allowed.has(id));
    if (nextDismissed.length === this.data.uiState.dismissedNotificationIds.length) {
      return;
    }

    this.data.uiState.dismissedNotificationIds = nextDismissed;
    void this.savePluginData();
  }

  private reconcileDismissedCleanupSuggestionIds(activeSuggestionIds: string[]): void {
    const allowed = new Set(activeSuggestionIds);
    const nextDismissed = this.data.uiState.dismissedCleanupSuggestionIds.filter((id) => allowed.has(id));
    if (nextDismissed.length === this.data.uiState.dismissedCleanupSuggestionIds.length) {
      return;
    }

    this.data.uiState.dismissedCleanupSuggestionIds = nextDismissed;
    void this.savePluginData();
  }

  getVisibleCleanupSuggestions(todoSnapshot: TodoSnapshot | null): TodoSnapshot["cleanupSuggestions"] {
    if (!todoSnapshot) {
      this.reconcileDismissedCleanupSuggestionIds([]);
      return [];
    }

    const activeIds = todoSnapshot.cleanupSuggestions.map((item) => item.id);
    this.reconcileDismissedCleanupSuggestionIds(activeIds);
    const dismissed = new Set(this.data.uiState.dismissedCleanupSuggestionIds);
    return todoSnapshot.cleanupSuggestions.filter((item) => !dismissed.has(item.id));
  }

  private buildDashboardNotificationId(prefix: string, values: string[], todayKey: string): string {
    const normalized = values
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
      .map((value) => value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
      .join("~")
      .slice(0, 180);
    return normalized.length > 0 ? `${prefix}:${todayKey}:${normalized}` : `${prefix}:${todayKey}`;
  }

  getDashboardNotifications(todoSnapshot: TodoSnapshot | null, calendarSnapshot: CalendarSnapshot, referenceDate: Date = new Date()): DashboardNotificationItem[] {
    const items: DashboardNotificationItem[] = [];
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
        description: `The configured master todo path \"${this.data.settings.masterTodoPath}\" is missing. Project health, task promotion, and cleanup workflows will stay limited until you point the plugin at a real hub note.`,
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
        description: [reminder.date, reminder.leadSummary, reminder.projectName || "", reminder.notes].filter((value) => value.length > 0).join(" • "),
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
        description: todoSnapshot.overdueTasks.slice(0, 2).map(({ project, task }) => `${project} • ${task.text}`).join(" • "),
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
        description: todoSnapshot.blockedTasks.slice(0, 2).map(({ project, task }) => `${project} • ${task.text}${task.blockedReason ? ` (${task.blockedReason})` : ""}`).join(" • "),
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
          visibleCleanupSuggestions[0]?.summary ?? ""
        ].filter((value) => value.length > 0).join(" • "),
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

  async getCalendarProjectOptions(): Promise<Array<{ name: string; notePath: string; wikiLink: string }>> {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      return [];
    }

    return snapshot.projects
      .map((project) => {
        const notePath = this.getProjectNotePath(project.name, project.noteLinks);
        return {
          name: project.name,
          notePath,
          wikiLink: this.renderCalendarProjectLink(project.name, notePath)
        };
      })
      .filter((project, index, array) => array.findIndex((candidate) => candidate.name.toLowerCase() === project.name.toLowerCase()) === index)
      .sort((left, right) => left.name.localeCompare(right.name));
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

  async openEditHabitFlow(habitId: string): Promise<void> {
    const habit = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habit) {
      return;
    }

    new AddHabitModal(this.app, this, habit).open();
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
    await this.refreshMasterHubPortfolioSnapshot(false);
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

  async repairMasterHubAndProjectNotes(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }

    const originalHubContent = await this.app.vault.read(todoFile);
    const repairedHub = repairMasterHubStructure(originalHubContent, {
      masterTodoPath: this.data.settings.masterTodoPath,
      projectNotesFolder: this.data.settings.projectNotesFolder
    });

    let activeHubContent = originalHubContent;
    if (repairedHub.content !== originalHubContent) {
      await this.app.vault.modify(todoFile, repairedHub.content);
      activeHubContent = repairedHub.content;
    }

    await this.createMissingProjectNotesFromTodo(false);

    const snapshot = parseTodoSnapshot(activeHubContent);
    let repairedNotes = 0;
    let noteMetadataAdded = 0;
    let noteSectionsAdded = 0;

    for (const project of snapshot.projects) {
      const notePath = this.getProjectNotePath(project.name, project.noteLinks);
      const target = this.app.vault.getAbstractFileByPath(normalizePath(notePath));
      if (!(target instanceof TFile)) {
        continue;
      }

      const noteContent = await this.app.vault.read(target);
      const repairedNote = repairProjectNoteStructure(noteContent, {
        projectName: project.name,
        masterTodoPath: this.data.settings.masterTodoPath,
        notePath: target.path
      });
      if (repairedNote.content === noteContent) {
        continue;
      }

      await this.app.vault.modify(target, repairedNote.content);
      repairedNotes += 1;
      noteMetadataAdded += repairedNote.addedMetadata;
      noteSectionsAdded += repairedNote.addedSections;
    }

    await this.refreshMasterHubPortfolioSnapshot(false);
    this.refreshDashboardViews();

    if (showNotice) {
      const changedHubProjects = repairedHub.updatedProjects;
      if (changedHubProjects === 0 && repairedNotes === 0) {
        new Notice("Master task hub and project notes already match the current structure.");
      } else {
        new Notice(`Repaired ${changedHubProjects} hub project${changedHubProjects === 1 ? "" : "s"} and ${repairedNotes} project note${repairedNotes === 1 ? "" : "s"}; added ${repairedHub.addedMetadata + noteMetadataAdded} metadata line${repairedHub.addedMetadata + noteMetadataAdded === 1 ? "" : "s"} and ${repairedHub.addedSections + noteSectionsAdded} section${repairedHub.addedSections + noteSectionsAdded === 1 ? "" : "s"}.`);
      }
    }
  }

  async addTodayFocusItem(value: string): Promise<void> {
    await this.addTodayFocusItemWithDetails({ text: value });
  }

  async addTodayFocusItemWithDetails(input: {
    text: string;
    projectName?: string;
    notes?: string;
    estimateMinutes?: number | null;
  }): Promise<void> {
    const trimmedValue = input.text.trim();
    if (!trimmedValue) {
      return;
    }

    const entry = this.getTodayEntry();
    if (entry.todayFocus.some((item) => item.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That focus item is already listed.");
      return;
    }

    const normalizedEstimate = Number.isFinite(Number(input.estimateMinutes))
      ? clamp(Math.round(Number(input.estimateMinutes)), 0, 1440)
      : null;
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

  async updateTodayFocusItem(index: number, value: string): Promise<boolean> {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      new Notice("Focus item text is required.");
      return false;
    }

    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }

    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That focus item is already listed.");
      return false;
    }

    item.text = trimmedValue;
    await this.persistEntry(entry);
    return true;
  }

  async updateTodayFocusDetails(index: number, updates: {
    text: string;
    projectName?: string;
    notes?: string;
    estimateMinutes?: number | null;
  }): Promise<boolean> {
    const trimmedValue = updates.text.trim();
    if (!trimmedValue) {
      new Notice("Focus item text is required.");
      return false;
    }

    const entry = this.getTodayEntry();
    const item = entry.todayFocus[index];
    if (!item) {
      return false;
    }

    if (entry.todayFocus.some((candidate, candidateIndex) => candidateIndex !== index && candidate.text.toLowerCase() === trimmedValue.toLowerCase())) {
      new Notice("That focus item is already listed.");
      return false;
    }

    item.text = trimmedValue;
    item.projectName = typeof updates.projectName === "string" ? updates.projectName.trim() : "";
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

  async startTodayFocusItem(index: number, tag = "", projectName = ""): Promise<void> {
    if (this.data.dayState.status !== "in-progress") {
      new Notice("Begin your logical day before tracking a focus item.");
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
      item.workSessions = [...item.workSessions, { start: timestamp, end: null, tag: tag.trim(), projectName: projectName.trim() }];
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

  async restoreTodayFocusItem(item: TodayFocusItem, index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextFocus = [...entry.todayFocus];
    nextFocus.splice(clamp(index, 0, nextFocus.length), 0, {
      ...item,
      workSessions: item.workSessions.map((session) => ({ ...session }))
    });
    entry.todayFocus = nextFocus;
    await this.persistEntry(entry);
  }

  async addNextUpFocusItem(input: {
    text: string;
    projectName?: string;
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
      new Notice("That item is already listed in active focus or Next Up.");
      return false;
    }

    entry.nextUpFocus = [
      ...entry.nextUpFocus,
      {
        text,
        projectName: typeof input.projectName === "string" ? input.projectName.trim() : "",
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

    if (!entry.todayFocus.some((candidate) => candidate.text.toLowerCase() === item.text.toLowerCase())) {
      entry.todayFocus = [...entry.todayFocus, this.createTodayFocusItem(item.text, item.projectName, item.notes, item.estimateMinutes)];
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

  async restoreNextUpFocusItem(item: NextUpFocusItem, index: number): Promise<void> {
    const entry = this.getTodayEntry();
    const nextFocus = [...entry.nextUpFocus];
    nextFocus.splice(clamp(index, 0, nextFocus.length), 0, { ...item });
    entry.nextUpFocus = nextFocus;
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
    const reviewArchiveCount = await this.generateWeeklyProjectReviewArchive(range.label);
    await this.generateRecurringFrictionPatternsNote(false);
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Weekly Reviews/${range.label}.md`, content);
    await this.openFile(file);
    new Notice(`Weekly review note generated${reviewArchiveCount > 0 ? ` with ${reviewArchiveCount} project review archive note${reviewArchiveCount === 1 ? "" : "s"}` : ""}.`);
  }

  async generateRecurringFrictionPatternsNote(openAfterGenerate: boolean): Promise<TFile | null> {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const entries = this.getEntriesInRange(start, end);
    const todoSnapshot = await this.getTodoSnapshot();
    const content = renderRecurringFrictionPatternsNote({
      label: `${formatDateKey(start)} to ${formatDateKey(end)}`,
      start,
      end,
      entries,
      habits: this.getHabitDefinitions(),
      todoSnapshot
    });
    const file = await this.upsertMarkdownFile(this.getRecurringFrictionPatternsNotePath(), content);
    if (openAfterGenerate) {
      await this.openFile(file);
      new Notice("Recurring friction patterns note generated.");
    }
    return file;
  }

  async generateDependencyReviewNote(openAfterGenerate: boolean): Promise<TFile | null> {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      if (openAfterGenerate) {
        new Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return null;
    }

    const activeWaitingProjects = snapshot.projects
      .filter((project) => project.projectState === "active" && project.waitingOn.trim().length > 0 && project.waitingOn.trim().toLowerCase() !== "none");
    const blockedWithOwners = snapshot.blockedTasks.filter(({ task }) => task.blockedReason.trim().length > 0);
    const content = [
      `# Dependency Review - ${formatDateKey(new Date())}`,
      "",
      `- Generated: ${formatDateTimeKey(new Date())}`,
      `- Projects with Waiting On:: ${activeWaitingProjects.length}`,
      `- Blocked tasks: ${snapshot.blockedTasks.length}`,
      `- People / External Dependencies note: [[${stripMarkdownExtension(this.data.settings.peopleDependenciesNotePath)}|People and External Dependencies]]`,
      `- Master Task Hub: [[${stripMarkdownExtension(this.data.settings.masterTodoPath)}|Master Task Hub]]`,
      "",
      "## Projects Waiting On",
      ...(activeWaitingProjects.length > 0
        ? activeWaitingProjects.map((project) => `- ${project.name}: ${project.waitingOn}${project.nextAction ? ` | Next action: ${project.nextAction}` : ""}`)
        : ["- No active projects currently list Waiting On::." ]),
      "",
      "## Blocked Task Pressure",
      ...(blockedWithOwners.length > 0
        ? blockedWithOwners.slice(0, 12).map(({ project, task }) => `- ${project}: ${[task.text, task.blockedReason ? `blocked ${task.blockedReason}` : "", task.unblockDate ? `unblock ${task.unblockDate}` : "", task.minimumStep ? `minimum step ${task.minimumStep}` : ""].filter((value) => value.length > 0).join(" • ")}`)
        : ["- No blocked tasks currently include a blocker reason."]),
      "",
      "## Follow-Up Checklist",
      "- [ ] Update the People / External Dependencies note with any blocker that affects more than one project.",
      "- [ ] Add a concrete next follow-up date or owner where Waiting On:: is still vague.",
      "- [ ] Decide whether any blocked task needs escalation, fallback, or scope reduction.",
      "- [ ] Remove or rewrite stale Waiting On:: lines that no longer reflect reality.",
      "",
      "## Review Questions",
      "- Which outside dependency is slowing more than one project right now?",
      "- Which blocker is actually unclear ownership rather than lack of effort?",
      "- Which dependency should be parked in the dedicated support note instead of staying scattered across project notes?",
      ""
    ].join("\n");

    const file = await this.upsertMarkdownFile(`Dashboard Logs/Dependency Reviews/${formatDateKey(new Date())}.md`, content);
    if (openAfterGenerate) {
      await this.openFile(file);
      new Notice("Dependency review note generated.");
    }
    return file;
  }

  private async generateWeeklyProjectReviewArchive(label: string): Promise<number> {
    const options = await this.getProjectReviewOptions();
    const activeOptions = options.filter((option) => option.projectState === "active");
    if (activeOptions.length === 0) {
      return 0;
    }

    const folder = `Dashboard Logs/Project Reviews/${label}`;
    for (const option of activeOptions) {
      const safeName = sanitizeFileName(option.projectName);
      await this.generateProjectReviewChecklist(option, {
        folder,
        fileName: `${safeName}.md`,
        reviewCycleLabel: label,
        generatedAt: new Date()
      });
    }

    return activeOptions.length;
  }

  private getRecurringFrictionPatternsNotePath(): string {
    return "Dashboard Logs/Profile/Recurring Friction Patterns.md";
  }

  async refreshMasterHubPortfolioSnapshot(showNotice: boolean): Promise<void> {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }

    const content = await this.app.vault.read(todoFile);
    const snapshot = parseTodoSnapshot(content);
    const updatedContent = this.upsertMasterHubPortfolioSnapshot(content, snapshot, new Date());

    if (updatedContent === content) {
      if (showNotice) {
        new Notice("Master task hub portfolio snapshot is already up to date.");
      }
      return;
    }

    await this.app.vault.modify(todoFile, updatedContent);
    this.refreshDashboardViews();
    if (showNotice) {
      new Notice("Master task hub portfolio snapshot refreshed.");
    }
  }

  private upsertMasterHubPortfolioSnapshot(content: string, snapshot: TodoSnapshot, refreshedAt: Date): string {
    const lines = content.split(/\r?\n/);
    const sectionLines = this.renderMasterHubPortfolioSnapshotSection(snapshot, refreshedAt).split("\n");
    const existingSectionRange = this.findHubSectionRange(lines, "Portfolio Snapshot");

    if (existingSectionRange) {
      const before = trimTrailingBlankLines(lines.slice(0, existingSectionRange.start));
      const after = trimLeadingBlankLines(lines.slice(existingSectionRange.end + 1));
      const result: string[] = [];
      if (before.length > 0) {
        result.push(...before, "");
      }
      result.push(...sectionLines);
      if (after.length > 0) {
        result.push("", ...after);
      }
      return result.join("\n");
    }

    const categories = findTodoCategoryRanges(lines);
    const projects = findProjectRanges(lines);
    const insertIndex = categories[0]?.start ?? projects[0]?.start ?? this.getMasterHubInsertIndex(lines);
    const before = trimTrailingBlankLines(lines.slice(0, insertIndex));
    const after = trimLeadingBlankLines(lines.slice(insertIndex));
    const result: string[] = [];
    if (before.length > 0) {
      result.push(...before, "");
    }
    result.push(...sectionLines);
    if (after.length > 0) {
      result.push("", ...after);
    }
    return result.join("\n");
  }

  private renderMasterHubPortfolioSnapshotSection(snapshot: TodoSnapshot, refreshedAt: Date): string {
    const activeProjects = snapshot.projects.filter((project) => project.projectState === "active");
    const incubatingProjects = snapshot.projects.filter((project) => project.projectState === "incubating");
    const somedayProjects = snapshot.projects.filter((project) => project.projectState === "someday");
    const waitingProjects = activeProjects
      .filter((project) => project.waitingOn.trim().length > 0 && project.waitingOn.trim().toLowerCase() !== "none")
      .slice(0, 4);
    const attentionProjects = activeProjects
      .slice()
      .sort((left, right) => {
        if (left.healthScore !== right.healthScore) {
          return left.healthScore - right.healthScore;
        }
        const leftPressure = left.overdueTasks.length + left.blockedTasks.length;
        const rightPressure = right.overdueTasks.length + right.blockedTasks.length;
        if (leftPressure !== rightPressure) {
          return rightPressure - leftPressure;
        }
        return (right.staleDays ?? 0) - (left.staleDays ?? 0);
      })
      .slice(0, 4);
    const momentumProjects = activeProjects
      .filter((project) => project.completionsThisWeek > 0)
      .slice()
      .sort((left, right) => right.completionsThisWeek - left.completionsThisWeek)
      .slice(0, 3);

    return [
      "## Portfolio Snapshot",
      `> Auto-generated by Obsidian DASH on ${formatDateTimeKey(refreshedAt)}. Refresh this section after major hub changes if you want a current portfolio view.`,
      "",
      `- Projects: ${activeProjects.length} active, ${incubatingProjects.length} incubating, ${somedayProjects.length} someday`,
      `- Tasks: ${snapshot.totalOpen} open, ${snapshot.totalArchived} archived`,
      `- Pressure: ${snapshot.overdueTasks.length} overdue, ${snapshot.blockedTasks.length} blocked, ${snapshot.staleProjects.length} stale project${snapshot.staleProjects.length === 1 ? "" : "s"}`,
      waitingProjects.length > 0
        ? `- Waiting On: ${waitingProjects.length} active project${waitingProjects.length === 1 ? "" : "s"} currently depend on outside input`
        : "- Waiting On: no active project currently has an external blocker recorded",
      "",
      "### Needs Attention",
      ...(attentionProjects.length > 0
        ? attentionProjects.map((project) => `- ${project.name}: ${project.nextAction}${project.staleDays !== null && project.staleDays >= 7 ? ` | ${project.staleDays} stale days` : ""}${project.overdueTasks.length > 0 ? ` | ${project.overdueTasks.length} overdue` : ""}${project.blockedTasks.length > 0 ? ` | ${project.blockedTasks.length} blocked` : ""}`)
        : ["- No active projects currently stand out as portfolio risks."]),
      "",
      "### Waiting On",
      ...(waitingProjects.length > 0
        ? waitingProjects.map((project) => `- ${project.name}: ${project.waitingOn}`)
        : ["- No active projects currently list an external dependency."]),
      "",
      "### Momentum",
      ...(momentumProjects.length > 0
        ? momentumProjects.map((project) => `- ${project.name}: ${project.completionsThisWeek} completed this week${project.focus ? ` | Focus: ${project.focus}` : ""}`)
        : ["- No active project has recorded completed work this week yet."])
    ].join("\n");
  }

  private findHubSectionRange(lines: string[], heading: string): { start: number; end: number } | null {
    const normalizedHeading = `## ${heading}`.toLowerCase();
    const start = lines.findIndex((line) => line.trim().toLowerCase() === normalizedHeading);
    if (start < 0) {
      return null;
    }

    let end = lines.length - 1;
    for (let index = start + 1; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if ((/^##\s+/.test(trimmed) && !/^###\s+/.test(trimmed)) || (/^#\s+/.test(trimmed) && !/^##\s+/.test(trimmed))) {
        end = index - 1;
        break;
      }
    }

    return { start, end };
  }

  private getMasterHubInsertIndex(lines: string[]): number {
    let index = 0;
    if (lines[index]?.trim() === "---") {
      index += 1;
      while (index < lines.length && lines[index].trim() !== "---") {
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
    }

    while (index < lines.length && lines[index].trim() === "") {
      index += 1;
    }

    if (index < lines.length && /^#\s+/.test(lines[index].trim()) && !/^##\s+/.test(lines[index].trim())) {
      index += 1;
    }

    while (index < lines.length && lines[index].trim() === "") {
      index += 1;
    }

    return index;
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
        updatedContent = insertTaskIntoProjectSection(updatedContent, project.projectName, "Next", `${task.text} [repeat: ${task.ruleText}]`);
        insertedCount += 1;
      });
    }

    if (updatedContent !== content) {
      await this.app.vault.modify(todoFile, updatedContent);
      await this.refreshMasterHubPortfolioSnapshot(false);
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
      await this.refreshMasterHubPortfolioSnapshot(false);
    }

    if (showNotice) {
      new Notice(result.offloadedProjects.length > 0
        ? `Offloaded references for ${result.offloadedProjects.length} project${result.offloadedProjects.length === 1 ? "" : "s"}.`
        : "No project references needed offloading.");
    }
  }

  async showCleanupSuggestions(): Promise<void> {
    const snapshot = await this.getTodoSnapshot();
    const suggestions = this.getVisibleCleanupSuggestions(snapshot);
    const projectSections = (snapshot?.projects ?? [])
      .filter((project) => project.projectState === "active" && (project.staleDays !== null || project.duplicateTasks.length > 0 || project.emptySections.length > 0 || project.breakdownTasks.length > 0))
      .map((project) => {
        const lines = [
          `## ${project.name}`,
          `- Health: ${project.healthLabel} (${project.healthScore})`,
          `- Next action: ${project.nextAction}`,
          project.projectSummary ? `- Summary: ${project.projectSummary}` : "",
          project.whyItMatters ? `- Why it matters: ${project.whyItMatters}` : "",
          project.definitionOfDone ? `- Definition of done: ${project.definitionOfDone}` : "",
          project.lastReview ? `- Last review: ${project.lastReview}` : "",
          project.waitingOn && project.waitingOn.toLowerCase() !== "none" ? `- Waiting on: ${project.waitingOn}` : "",
          project.staleDays !== null ? `- Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"}` : "",
          project.duplicateTasks.length > 0 ? `- Duplicates: ${project.duplicateTasks.slice(0, 5).join(", ")}` : "",
          project.emptySections.length > 0 ? `- Empty sections: ${project.emptySections.join(", ")}` : "",
          project.breakdownTasks.length > 0 ? `- Needs breakdown: ${project.breakdownTasks.slice(0, 5).join(" • ")}` : "",
          project.healthReasons.length > 0 ? `- Reasons: ${project.healthReasons.join(" • ")}` : ""
        ].filter((line) => line.length > 0);
        return [...lines, ""].join("\n");
      });
    const content = [
      `# Master Task Hub Cleanup Suggestions - ${formatDateKey(new Date())}`,
      "",
      "## Portfolio Summary",
      ...(suggestions.length > 0 ? suggestions.map((item) => `- ${item.summary}`) : ["- No cleanup issues detected."]),
      "",
      ...(projectSections.length > 0 ? projectSections : ["## Projects", "- No project-level cleanup issues detected.", ""]),
      ""
    ].join("\n");
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Cleanup Suggestions/${formatDateKey(new Date())}.md`, content);
    await this.openFile(file);
  }

  async generateAiTodayPlan(): Promise<void> {
    await this.generateAiMorningStartupBrief();
  }

  async generateAiMorningStartupBrief(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Morning Startup Brief",
      templateKey: "morning-startup-brief",
      fileLabel: `AI Morning Startup Brief ${this.getTodayEntry().date}`,
      systemPrompt: [
        "You are an operational planning assistant for a personal Obsidian dashboard.",
        "Prioritize practical decision support over motivational writing.",
        "Respond in markdown with these headings: Situation Snapshot, Suggested Focus, Recommended Sequencing, Risks And Drift, Energy And Recovery, Concrete Actions.",
        "Under Suggested Focus, provide the few concise bullet points that best deserve active attention right now.",
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

  async generateAiEndOfDayReview(): Promise<void> {
    await this.generateAiShutdownSummary();
  }

  async generateAiShutdownSummary(): Promise<void> {
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

  async generateAiProjectTriage(): Promise<void> {
    await this.generateAiProjectRiskScanner();
  }

  async generateAiProjectRiskScanner(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Project Risk Scanner",
      templateKey: "project-risk-scanner",
      fileLabel: `AI Project Risk Scanner ${formatDateKey(new Date())}`,
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

  async generateAiWeeklyCoachNote(): Promise<void> {
    await this.generateAiWeeklyPlanningAssistant();
  }

  async generateAiWeeklyPlanningAssistant(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Weekly Planning Assistant",
      templateKey: "weekly-planning-assistant",
      fileLabel: `AI Weekly Planning Assistant ${formatDateKey(new Date())}`,
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

  async generateAiAnomalyDetectionReport(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Anomaly Detection",
      templateKey: "anomaly-detection",
      fileLabel: `AI Anomaly Detection ${formatDateKey(new Date())}`,
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

  async generateAiPeriodComparisonReport(): Promise<void> {
    const todoSnapshot = await this.getTodoSnapshot();
    await this.runAiWorkflow({
      kind: "Period Comparison Report",
      templateKey: "period-comparison-report",
      fileLabel: `AI Period Comparison ${formatDateKey(new Date())}`,
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

  async generateAiProjectSynthesis(): Promise<void> {
    await this.runAiWorkflow({
      kind: "Project Synthesis",
      templateKey: "project-synthesis",
      fileLabel: `AI Project Synthesis ${formatDateKey(new Date())}`,
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

  async generateAiWhyTodayFeltOff(): Promise<void> {
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

  async generateAiActiveNoteAnalysis(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!(activeFile instanceof TFile) || !activeFile.path.endsWith(".md")) {
      new Notice("Open a markdown note before using active note analysis.");
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

  async askAiQuestion(question: string): Promise<void> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      new Notice("Enter a question for the AI first.");
      return;
    }

    await this.runAiWorkflow({
      kind: "Vault Question",
      templateKey: "vault-question",
      fileLabel: `AI Vault Question ${formatDateKey(new Date())}`,
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

  async openAskAiFlow(): Promise<void> {
    new AskAiModal(this.app, this).open();
  }

  async openAskResearchQuestionFlow(initialQuestion = ""): Promise<void> {
    new AskResearchQuestionModal(this.app, this, initialQuestion).open();
  }

  private async runAiWorkflow(input: {
    kind: string;
    templateKey: string;
    fileLabel: string;
    systemPrompt: string;
    userPrompt: string;
    includeMasterTodoRaw: boolean;
    includeActiveNote?: boolean;
    question?: string;
    extraContextSections?: string[];
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
      const context = await this.buildAiContext(input.includeMasterTodoRaw, input.question, input.includeActiveNote ?? false, retrievalQuery, input.extraContextSections ?? []);
      const rawResponse = await this.requestAiCompletion(this.applyAiPromptTemplate(input.systemPrompt, input.templateKey), `${input.userPrompt}\n\n${context}`);
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
        suggestedFocus: payload.suggestedFocus.slice(0, 3),
        nextActions: (payload.nextActions.length > 0 ? payload.nextActions : payload.suggestedFocus).slice(0, 5)
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

  private async buildAiContext(includeMasterTodoRaw: boolean, question = "", includeActiveNote = false, retrievalQuery = question, extraContextSections: string[] = []): Promise<string> {
    const todayEntry = this.getTodayEntry();
    const allEntries = this.getAllEntries();
    const recentEntries = allEntries.slice(-this.data.settings.aiContextDays);
    const todoSnapshot = await this.getTodoSnapshot();
    const calendarSnapshot = await this.getUpcomingCalendarSnapshot();
    const weeklyAgenda = this.getWeeklyAgenda(todayEntry.date);
    const relevantNotes = await this.collectAiRelevantNotes(question, todoSnapshot, includeActiveNote, retrievalQuery);
    const recentRange = recentEntries.length > 0
      ? `${recentEntries[0].date} to ${recentEntries[recentEntries.length - 1].date}`
      : "No recent entries";
    const recentReport = recentEntries.length > 0
      ? renderPeriodReport({
          title: "Recent Dashboard Context",
          rangeLabel: recentRange,
          entries: recentEntries,
          habitDefinitions: this.getHabitDefinitions(),
          todoSnapshot
        })
      : "No recent dashboard entries available.";

    const masterTodoFile = this.getMasterTodoFile();
    const masterTodoRaw = includeMasterTodoRaw && masterTodoFile
      ? truncateText(await this.app.vault.read(masterTodoFile), 12000)
      : "Master task hub raw content not included for this request.";
    const activeFile = includeActiveNote ? this.app.workspace.getActiveFile() : null;
    const basicInfoSection = await this.buildBasicInformationAiContext();
    const aiGuardrailsSection = await this.buildAiGuardrailsAiContext();
    const currentSeasonSection = await this.buildCurrentSeasonAiContext();
    const peopleDependenciesSection = await this.buildPeopleDependenciesAiContext();
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
      aiGuardrailsSection,
      "",
      currentSeasonSection,
      "",
      peopleDependenciesSection,
      "",
      ...extraContextSections.flatMap((section) => section.trim().length > 0 ? [section, ""] : []),
      activeNoteSection,
      "",
      "## Master Task Hub Raw Excerpt",
      masterTodoRaw
    ].filter((section) => section.trim().length > 0).join("\n\n");
  }

  private async buildBasicInformationAiContext(): Promise<string> {
    return this.buildSupportNoteAiContext("Basic Information", this.data.settings.basicInfoNotePath, this.data.settings.includeBasicInfoInAi, 6000);
  }

  private async buildAiGuardrailsAiContext(): Promise<string> {
    return this.buildSupportNoteAiContext("AI Guardrails", this.data.settings.aiGuardrailsNotePath, this.data.settings.includeAiGuardrailsInAi, 5000);
  }

  private async buildCurrentSeasonAiContext(): Promise<string> {
    return this.buildSupportNoteAiContext("Current Season", this.data.settings.currentSeasonNotePath, this.data.settings.includeCurrentSeasonInAi, 5000);
  }

  private async buildPeopleDependenciesAiContext(): Promise<string> {
    return this.buildSupportNoteAiContext("People / External Dependencies", this.data.settings.peopleDependenciesNotePath, this.data.settings.includePeopleDependenciesInAi, 5000);
  }

  private async buildSupportNoteAiContext(title: string, pathValue: string, enabled: boolean, charLimit: number): Promise<string> {
    if (!enabled) {
      return "";
    }

    const file = this.app.vault.getAbstractFileByPath(normalizePath(pathValue));
    if (!(file instanceof TFile)) {
      return "";
    }

    const content = truncateText(await this.app.vault.read(file), charLimit);
    return [
      `## ${title}`,
      `Path: ${file.path}`,
      content
    ].join("\n\n");
  }

  private renderBasicInformationTemplate(): string {
    const weightUnit = this.data.settings.measurementSystem === "metric" ? "kg" : "lb";
    const latestWeight = this.getLatestRecordedBodyWeight();

    return [
      "# Basic Information",
      "",
      `- Last updated: ${formatDateTimeKey(new Date())}`,
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

  private renderAiGuardrailsTemplate(): string {
    return [
      "# AI Guardrails",
      "",
      "## Tone",
      "- Prefer direct, practical language over motivational writing.",
      "- Explain tradeoffs clearly when suggesting changes.",
      "- Prioritize clarity over flourish.",
      "",
      "## Planning Behavior",
      "- Optimize for operational clarity, not maximal ambition.",
      "- Prefer the smallest viable next step when a task is vague.",
      "- Separate evidence from inference when interpreting trends.",
      "- Treat friction and recovery data as planning signals, not noise.",
      "",
      "## Avoid",
      "- Do not overstate certainty from weak signals.",
      "- Do not recommend unnecessary system complexity.",
      "- Do not confuse reference material with actionable work.",
      "- Do not turn reflection into vague commentary with no next step.",
      "",
      "## Recovery And Health",
      "- Treat low energy, poor sleep, pain, or high friction as real constraints.",
      "- When recovery signals are bad, reduce load before increasing pressure.",
      "- Do not frame recovery issues as moral failure.",
      "",
      "## Review Behavior",
      "- Surface the main win, blocker, drift, and follow-up before secondary detail.",
      "- Prefer review by exception over exhaustive repetition.",
      "- Preserve historical context when it affects planning quality."
    ].join("\n");
  }

  private renderCurrentSeasonTemplate(): string {
    return [
      "# Current Season",
      "",
      "## Main Priorities",
      "- Keep Obsidian DASH practical to use every day.",
      "- Improve note structure so AI and reviews have cleaner context.",
      "- Reduce system drift by making document roles explicit.",
      "",
      "## Current Constraints",
      "- Avoid unnecessary workflow complexity.",
      "- Keep generated notes readable and searchable.",
      "- Prefer systems that are sustainable, not just clever.",
      "",
      "## Current Review Questions",
      "- Which note types are still carrying too many roles at once?",
      "- What context should be stable but still only exists in logs?",
      "- What system friction is recurring often enough to deserve its own note?",
      "",
      "## What Success Looks Like This Season",
      "- The Master Task Hub is cleaner to scan.",
      "- Project notes hold more durable context.",
      "- Generated notes surface the important context earlier.",
      "- AI outputs rely less on scattered implicit context."
    ].join("\n");
  }

  private renderPeopleDependenciesTemplate(): string {
    return [
      "# People and External Dependencies",
      "",
      "## Active Relationships",
      "- Name / team:",
      "  - Role:",
      "  - What they affect:",
      "  - Normal response speed or cadence:",
      "  - Best contact method:",
      "  - Current status:",
      "",
      "## Current Waiting Ons",
      "- Dependency:",
      "  - Project:",
      "  - Owner:",
      "  - Needed by:",
      "  - Next follow-up:",
      "  - Risk if delayed:",
      "",
      "## External Systems",
      "- Vendor, service, or external tool:",
      "  - What it blocks or enables:",
      "  - Renewal / review cadence:",
      "  - Failure mode to watch:",
      "",
      "## Communication Notes",
      "- Capture stable preferences, recurring friction, or coordination constraints here.",
      "",
      "## Review Prompts",
      "- Which waiting-ons are now old enough to deserve escalation or a fallback path?",
      "- Which projects depend on the same outside person or system?",
      "- Which blocker is actually ambiguous ownership rather than slow execution?",
      ""
    ].join("\n");
  }

  private renderDecisionJournalTemplate(): string {
    return [
      "# Decision Journal",
      "",
      `## ${formatDateKey(new Date())} - Formalize the document system`,
      "- Decision: strengthen document structure before adding more workflow complexity.",
      "- Why: the plugin already has enough depth that loose note structure is now a real bottleneck.",
      "- Expected outcome: better AI context, cleaner reviews, and less long-term drift.",
      "- Revisit when: the core documentation and note templates are in active use."
    ].join("\n");
  }

  private renderSystemMapTemplate(): string {
    return [
      "# System Map",
      "",
      "## Core Operational Notes",
      "- [[Master Task Hub]]: cross-project action inventory and status view.",
      "- Project notes folder: per-project context, risks, constraints, decisions, and support material.",
      "",
      "## Personal Context Notes",
      "- [[Basic Information]]: stable personal context and enduring constraints.",
      "- [[AI Guardrails]]: instructions for how AI should behave.",
      "- [[Current Season]]: temporary priorities and constraints for the present phase.",
      "- [[People and External Dependencies]]: stable relationship context, outside blockers, and dependency review points.",
      "- [[Decision Journal]]: preserved reasoning behind important choices.",
      "",
      "## Generated Artifacts",
      "- Dashboard Logs/Daily: human-readable daily history.",
      "- Dashboard Logs/AI: AI outputs and suggested actions.",
      "- Dashboard Logs/Cleanup Suggestions: grouped cleanup review artifacts.",
      "- Dashboard Logs/Gamification: score breakdown reports.",
      "- Dashboard Logs/Wins Archive: searchable success summaries.",
      "- Weekly and monthly report folders: period-level review artifacts.",
      "",
      "## Review Notes",
      "- Weekly review notes: regular reflection and planning checkpoints.",
      "- Project review notes: focused review by exception.",
      "- Cleanup notes: grouped stale, blocked, duplicate, and vague-work review surfaces.",
      "",
      "## Working Rule",
      "- Action lives in the hub.",
      "- Explanation lives in project notes.",
      "- History lives in logs and reviews.",
      "- Stable context lives in evergreen notes.",
      "- AI behavior rules live in AI Guardrails."
    ].join("\n");
  }

  private renderKnowledgeBaseHomeTemplate(): string {
    const recommendedIndexedFolders = this.getKnowledgeBaseRecommendedIndexedFolders();

    return [
      "# Compiled Research Wiki",
      "",
      `- Last updated: ${formatDateTimeKey(new Date())}`,
      "- Purpose: separate raw captures, compiled wiki notes, and derived outputs so research stays useful to both humans and AI.",
      "",
      "## Folder Model",
      `- Raw captures: ${this.data.settings.knowledgeBaseRawFolder}`,
      `- Source summaries: ${this.data.settings.knowledgeBaseSourcesFolder}`,
      `- Concept notes: ${this.data.settings.knowledgeBaseConceptsFolder}`,
      `- Index notes: ${this.data.settings.knowledgeBaseIndexesFolder}`,
      `- Outputs: ${this.data.settings.knowledgeBaseOutputsFolder}`,
      `- Assets: ${this.data.settings.knowledgeBaseAssetsFolder}`,
      "",
      "## Note Roles",
      "- Raw: keep the original article, paper notes, repo captures, or clip with minimal transformation.",
      "- Source summaries: one structured note per source with provenance, claims, and open questions.",
      "- Concept notes: merge recurring ideas across many sources into one durable note.",
      "- Index notes: topic maps, glossaries, question lists, and navigation pages for the wiki.",
      "- Outputs: answers, syntheses, briefs, and health checks that may later be promoted back into the wiki.",
      "",
      "## Recommended Retrieval Scope",
      ...(recommendedIndexedFolders.length > 0
        ? recommendedIndexedFolders.map((folder) => `- Index for AI retrieval: ${folder}`)
        : ["- No recommended wiki folders are configured yet."]),
      `- Leave ${this.data.settings.knowledgeBaseRawFolder} out of AI retrieval unless you explicitly want direct raw-source matching.`,
      "",
      "## Starter Workflow",
      "1. Capture a source into the raw folder without worrying about polish.",
      "2. Write or generate a source summary into the source summaries folder.",
      "3. Merge repeated ideas into concept notes and keep indexes current.",
      "4. Write outputs into the outputs folder, then promote durable conclusions back into the wiki.",
      "5. Run the health-check command periodically to spot missing summaries and stale navigation.",
      ""
    ].join("\n");
  }

  private renderKnowledgeBaseOpenQuestionsTemplate(): string {
    return [
      "# Open Questions",
      "",
      `- Last updated: ${formatDateTimeKey(new Date())}`,
      "",
      "## Active Questions",
      "- Question:",
      "  - Why it matters:",
      "  - Where the answer should live:",
      "  - Next source to check:",
      "",
      "## Candidate Outputs",
      "- Brief or answer note to generate:",
      "  - Audience:",
      "  - What evidence is still missing:",
      "",
      "## Promotion Triggers",
      "- Move a question into a concept note once multiple sources start saying the same thing.",
      "- Move a question into an output note once you can answer it clearly for a real audience.",
      ""
    ].join("\n");
  }

  private renderKnowledgeBaseSourceSummaryTemplate(): string {
    return [
      "# Source Summary Template",
      "",
      "## Source Metadata",
      "- Title:",
      "- Author or source:",
      "- Date:",
      "- URL or locator:",
      "- Raw capture:",
      "- Why this source matters:",
      "",
      "## Core Claims",
      "- Claim:",
      "  - Evidence quoted or summarized:",
      "  - Confidence:",
      "",
      "## Methods Or Framing",
      "- Study design, framing, or perspective:",
      "- What this source can and cannot support:",
      "",
      "## Linked Concepts",
      "- [[Concept Note]]",
      "",
      "## Open Questions",
      "- What still needs follow-up or contradiction checking:",
      "",
      "## Reusable Quotes Or Data",
      "- Quote or datapoint:",
      "  - Why it matters:",
      ""
    ].join("\n");
  }

  private renderKnowledgeBaseConceptTemplate(): string {
    return [
      "# Concept Note Template",
      "",
      "## Working Definition",
      "- Define the concept in plain language:",
      "",
      "## Why It Matters",
      "- Operational importance:",
      "- Questions this concept helps answer:",
      "",
      "## Core Claims",
      "- Claim:",
      "  - Supporting source summaries:",
      "  - Counterpoints or uncertainty:",
      "",
      "## Related Concepts",
      "- [[Related Concept]]",
      "",
      "## Source Summaries",
      "- [[Source Summary]]",
      "",
      "## Output Hooks",
      "- Which answer notes, briefs, or slide decks should reuse this concept:",
      ""
    ].join("\n");
  }

  private renderKnowledgeBaseOutputTemplate(): string {
    return [
      "# Answer Note Template",
      "",
      "## Audience",
      "- Who this output is for:",
      "- What decision or question it should resolve:",
      "",
      "## Direct Answer",
      "- State the answer first:",
      "",
      "## Supporting Points",
      "- Point:",
      "  - Evidence or linked note:",
      "",
      "## Caveats",
      "- What is uncertain, contested, or still missing:",
      "",
      "## Promote Back Into The Wiki",
      "- Concept notes to update:",
      "- Index notes to refresh:",
      "- New questions created by this output:",
      ""
    ].join("\n");
  }

  private renderCompiledResearchWikiHealthCheck(input: {
    generatedAt: Date;
    rawFiles: TFile[];
    sourceFiles: TFile[];
    conceptFiles: TFile[];
    indexFiles: TFile[];
    outputFiles: TFile[];
    healthCheckFiles: TFile[];
    missingStarterNotes: string[];
    rawWithoutSummary: TFile[];
    lowLinkConceptFiles: TFile[];
    staleIndexFiles: TFile[];
    duplicateConceptGroups: TFile[][];
    assetCount: number;
    recommendedIndexedFolders: string[];
  }): string {
    const renderLinkedFileList = (files: TFile[], emptyMessage: string): string[] => {
      if (files.length === 0) {
        return [`- ${emptyMessage}`];
      }

      const lines = files.slice(0, 12).map((file) => `- ${createWikiLink(file.path, file.basename)}`);
      if (files.length > 12) {
        lines.push(`- ${files.length - 12} more note${files.length - 12 === 1 ? "" : "s"} not shown.`);
      }
      return lines;
    };
    const nextActions = [
      input.missingStarterNotes.length > 0 ? "Run Initialize compiled research wiki to restore missing starter notes." : "Starter notes are present.",
      input.rawWithoutSummary.length > 0 ? "Compile or write summaries for the oldest raw captures so the raw folder does not become a dead inbox." : "Raw captures currently have matching summary coverage by filename.",
      input.lowLinkConceptFiles.length > 0 ? "Add source-summary and concept-note links to weakly connected concept pages." : "Concept notes have at least minimal link density.",
      input.duplicateConceptGroups.length > 0 ? "Merge or disambiguate duplicate concept-note clusters before they drift further apart." : "No duplicate concept clusters were detected from concept-note filenames.",
      input.staleIndexFiles.length > 0 ? "Refresh stale index notes so the wiki remains navigable as it grows." : "Index notes were updated recently enough to act as live navigation.",
      input.recommendedIndexedFolders.length > 0 ? `For AI retrieval, prefer ${input.recommendedIndexedFolders.join(", ")}.` : "No recommended AI retrieval scope is configured yet."
    ];

    return [
      `# Compiled Research Wiki Health Check - ${formatDateKey(input.generatedAt)}`,
      "",
      `- Generated: ${formatDateTimeKey(input.generatedAt)}`,
      `- Raw captures: ${input.rawFiles.length}`,
      `- Source summaries: ${input.sourceFiles.length}`,
      `- Concept notes: ${input.conceptFiles.length}`,
      `- Index notes: ${input.indexFiles.length}`,
      `- Output notes: ${input.outputFiles.length}`,
      `- Prior health checks: ${input.healthCheckFiles.length}`,
      `- Asset files: ${input.assetCount}`,
      "",
      "## Recommended AI Retrieval Scope",
      ...(input.recommendedIndexedFolders.length > 0
        ? input.recommendedIndexedFolders.map((folder) => `- ${folder}`)
        : ["- No recommended wiki retrieval folders are configured."]),
      `- Optional only: ${this.data.settings.knowledgeBaseRawFolder}`,
      "",
      "## Missing Starter Notes",
      ...(input.missingStarterNotes.length > 0
        ? input.missingStarterNotes.map((path) => `- ${path}`)
        : ["- None."]),
      "",
      "## Raw Sources Without Matching Summary Filename",
      ...renderLinkedFileList(input.rawWithoutSummary, "None."),
      "",
      "## Low-Link Concept Candidates",
      ...renderLinkedFileList(input.lowLinkConceptFiles, "None."),
      "",
      "## Duplicate Concept Candidates",
      ...(input.duplicateConceptGroups.length > 0
        ? input.duplicateConceptGroups.map((group) => `- ${group.map((file) => createWikiLink(file.path, file.basename)).join(" | ")}`)
        : ["- None."]),
      "",
      "## Stale Index Candidates",
      ...renderLinkedFileList(input.staleIndexFiles, "None older than 30 days."),
      "",
      "## Recent Outputs",
      ...renderLinkedFileList(input.outputFiles, "No output notes yet."),
      "",
      "## Next Actions",
      ...nextActions.map((action) => `- ${action}`),
      ""
    ].join("\n");
  }

  private getLatestRecordedBodyWeight(): number | null {
    const weightedEntries = this.getAllEntries().filter((entry) => typeof entry.bodyWeight === "number");
    return weightedEntries.length > 0 ? weightedEntries[weightedEntries.length - 1].bodyWeight : null;
  }

  private applyAiPromptTemplate(systemPrompt: string, templateKey: string): string {
    const templates = parseAiPromptTemplates(this.data.settings.aiPromptTemplates);
    const template = templates[templateKey.toLowerCase()];
    if (!template) {
      return systemPrompt;
    }

    return [systemPrompt, `Additional local workflow instructions for ${templateKey}: ${template}`].join(" ");
  }

  private renderAiCalendarContext(snapshot: CalendarSnapshot, agenda: WeeklyAgendaDay[]): string {
    const reminders = snapshot.reminders.slice(0, 8).map((item) => {
      const lead = item.leadSummary ? ` (${item.leadSummary})` : "";
      return `- ${item.date} ${item.start}-${item.end} ${item.title}${lead}${item.notes ? ` :: ${truncateText(item.notes, 120)}` : ""}`;
    });
    const agendaLines = agenda
      .filter((day) => day.events.length > 0)
      .slice(0, 7)
      .map((day) => `- ${day.label}: ${day.events.slice(0, 3).map((event) => `${event.title}${event.allDay ? " (all day)" : ` ${event.startTime}-${event.endTime}`}`).join(" | ")}`);

    return [
      "Upcoming reminders:",
      ...(reminders.length > 0 ? reminders : ["- No upcoming reminders in range."]),
      "",
      "Weekly agenda:",
      ...(agendaLines.length > 0 ? agendaLines : ["- No upcoming calendar events this week."])
    ].join("\n");
  }

  private buildAiPeriodComparisonContext(todoSnapshot: TodoSnapshot | null): string {
    const entries = this.getAllEntries();
    const habits = this.getHabitDefinitions();
    const last7 = entries.slice(-7);
    const previous7 = entries.slice(-14, -7);
    const last30 = entries.slice(-30);
    const previous30 = entries.slice(-60, -30);
    const recentTrends = buildPersonalTrendSummary(last30, habits);
    const recentGamification = buildGamificationSummary(last30, habits, todoSnapshot);

    const renderWindow = (title: string, windowEntries: DailyEntry[]): string => {
      if (windowEntries.length === 0) {
        return `${title}\nNo entries available.`;
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

  private async requestAiCompletion(systemPrompt: string, userPrompt: string, modelOverride?: string): Promise<string> {
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
        model: modelOverride?.trim() || this.data.settings.aiModel,
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

  private async requestAiCompletionWithWebSearch(systemPrompt: string, userPrompt: string, modelName: string): Promise<string> {
    const apiKey = this.getResolvedAiApiKey();
    if (!apiKey) {
      throw new Error(this.getAiConfigurationMessage());
    }

    const response = await fetch(this.data.settings.researchResponsesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.4,
        tools: [{ type: "web_search_preview" }],
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json() as {
      output_text?: string;
      error?: { message?: string };
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };

    if (data.error?.message) {
      throw new Error(data.error.message);
    }

    if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
      return data.output_text.trim();
    }

    const text = (data.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((item) => (item.type === "output_text" || item.type === "text") && typeof item.text === "string")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim();
    if (text.length > 0) {
      return text;
    }

    throw new Error("OpenAI web search response was empty.");
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
    const concreteActions = (input.payload.nextActions.length > 0 ? input.payload.nextActions : input.payload.suggestedFocus).slice(0, 6);
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
      "",
      "## Concrete Actions",
      ...(concreteActions.length > 0 ? concreteActions.map((item) => `- ${item}`) : ["- No concrete actions were extracted from this response."]),
      ""
    ].filter((line) => line !== "").join("\n");

    return this.upsertMarkdownFile(filePath, content);
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

  async openStructuredProjectReview(option: ProjectReviewOption): Promise<void> {
    const checklistFile = await this.generateProjectReviewChecklist(option);
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof TFile) || !(checklistFile instanceof TFile) || !todoFile) {
      new Notice("Could not open structured project review mode for that project.");
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
        notePath: `${project.noteLinks[0] ? stripMarkdownExtension(project.noteLinks[0]) : `${this.data.settings.projectNotesFolder}/${project.name}`}.md`,
        status: project.status,
        projectState: project.projectState,
        projectSummary: project.projectSummary,
        whyItMatters: project.whyItMatters,
        definitionOfDone: project.definitionOfDone,
        lastReview: project.lastReview,
        waitingOn: project.waitingOn,
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
      }))
      .filter((project) => this.app.vault.getAbstractFileByPath(normalizePath(project.notePath)) instanceof TFile);
  }

  async generateProjectReviewChecklist(option: ProjectReviewOption, config?: {
    folder?: string;
    fileName?: string;
    reviewCycleLabel?: string;
    generatedAt?: Date;
  }): Promise<TFile> {
    const generatedAt = config?.generatedAt ?? new Date();
    const safeName = sanitizeFileName(option.projectName);
    const folder = config?.folder ?? "Dashboard Logs/Project Reviews";
    const fileName = config?.fileName ?? `${formatDateKey(generatedAt)} ${safeName}.md`;
    const content = [
      `# Project Review - ${option.projectName}`,
      "",
      `- Generated: ${formatDateTimeKey(generatedAt)}`,
      config?.reviewCycleLabel ? `- Review cycle: ${config.reviewCycleLabel}` : "",
      `- Status: ${option.status}`,
      `- State: ${option.projectState}`,
      `- Health: ${option.healthLabel} (${option.healthScore})`,
      `- Next action: ${option.nextAction}`,
      option.projectSummary ? `- Summary: ${option.projectSummary}` : "",
      option.whyItMatters ? `- Why it matters: ${option.whyItMatters}` : "",
      option.definitionOfDone ? `- Definition of done: ${option.definitionOfDone}` : "",
      option.lastReview ? `- Last review: ${option.lastReview}` : "",
      option.waitingOn && option.waitingOn.toLowerCase() !== "none" ? `- Waiting on: ${option.waitingOn}` : "",
      "",
      "## Review By Exception",
      ...(option.healthReasons.length > 0 ? option.healthReasons.map((reason) => `- ${reason}`) : ["- No extra risk signals recorded."]),
      option.overdueTasks.length > 0 ? `- Overdue work needs attention: ${option.overdueTasks.slice(0, 3).map((task) => [task.text, task.minimumStep ? `minimum step ${task.minimumStep}` : "", task.executionContext ? `context ${task.executionContext}` : ""].filter((value) => value.length > 0).join(" • ")).join(" | ")}` : "- No overdue tasks are currently attached to this project.",
      option.blockedTasks.length > 0 ? `- Blocked work: ${option.blockedTasks.slice(0, 3).map((task) => [task.text, task.blockedReason ? `blocked ${task.blockedReason}` : "", task.minimumStep ? `minimum step ${task.minimumStep}` : ""].filter((value) => value.length > 0).join(" • ")).join(" | ")}` : "- No blocked tasks are currently attached to this project.",
      option.duplicateTasks.length > 0 ? `- Duplicate pressure: ${option.duplicateTasks.slice(0, 3).join(" | ")}` : "- No duplicate-task pressure recorded.",
      option.emptySections.length > 0 ? `- Empty sections: ${option.emptySections.join(", ")}` : "- No empty sections stood out.",
      "",
      "## Review Checklist",
      "- [ ] Confirm the current project status still matches reality.",
      `- [ ] Validate or rewrite the next action: ${option.nextAction}`,
      `- [ ] Refresh Last Review:: to ${formatDateKey(generatedAt)} if this review is still valid.`,
      option.definitionOfDone ? "- [ ] Confirm the current definition of done still matches the real target." : "- [ ] Write a Definition Of Done:: line before closing review.",
      option.waitingOn && option.waitingOn.toLowerCase() !== "none" ? `- [ ] Resolve or update Waiting On:: ${option.waitingOn}` : "- [ ] Confirm Waiting On:: is accurate or still None.",
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
      "## Task Pressure",
      `- Overdue: ${option.overdueTasks.length}`,
      `- Due soon: ${option.dueSoonTasks.length}`,
      `- Blocked: ${option.blockedTasks.length}`,
      `- Duplicate tasks: ${option.duplicateTasks.length}`,
      `- Empty sections: ${option.emptySections.length > 0 ? option.emptySections.join(", ") : "None"}`,
      ...(option.overdueTasks.length > 0 ? option.overdueTasks.slice(0, 5).map((task) => `- Overdue task: ${[task.text, task.dueDate ? `due ${task.dueDate}` : "", task.executionContext ? `context ${task.executionContext}` : "", task.minimumStep ? `minimum step ${task.minimumStep}` : ""].filter((value) => value.length > 0).join(" • ")}`) : []),
      ...(option.dueSoonTasks.length > 0 ? option.dueSoonTasks.slice(0, 5).map((task) => `- Due soon: ${[task.text, task.dueDate ? `due ${task.dueDate}` : "", task.executionContext ? `context ${task.executionContext}` : "", task.minimumStep ? `minimum step ${task.minimumStep}` : ""].filter((value) => value.length > 0).join(" • ")}`) : []),
      "",
      "## References",
      `- Master Task Hub: [[${stripMarkdownExtension(this.data.settings.masterTodoPath)}|Master Task Hub]]`,
      `- Project Note: [[${stripMarkdownExtension(option.notePath)}|${option.projectName}]]`,
      ""
    ].filter((line) => line.length > 0).join("\n");

    return this.upsertMarkdownFile(`${folder}/${fileName}`, content);
  }

  getHabitStreak(habitId: string): number {
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
      if (!isHabitDueOnDate(habitDefinition, date)) {
        continue;
      }

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
      financeData: this.normalizeFinanceData(loaded?.financeData),
      dayState,
      noteIndex: normalizeNoteIndexCache(loaded?.noteIndex),
      uiState: this.normalizeUiState(loaded?.uiState)
    };
  }

  private normalizeUiState(state: Partial<DashboardUiState> | null | undefined): DashboardUiState {
    return {
      onboardingCompleted: Boolean(state?.onboardingCompleted),
      onboardingDeferredUntil: typeof state?.onboardingDeferredUntil === "string" ? state.onboardingDeferredUntil : "",
      dismissedNotificationIds: Array.isArray(state?.dismissedNotificationIds)
        ? state.dismissedNotificationIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 200)
        : [],
      dismissedCleanupSuggestionIds: Array.isArray(state?.dismissedCleanupSuggestionIds)
        ? state.dismissedCleanupSuggestionIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 200)
        : []
    };
  }

  private normalizeFinanceData(finance: Partial<FinanceData> | null | undefined): FinanceData {
    const categories = Array.isArray(finance?.budgetCategories)
      ? finance.budgetCategories
          .map((category, index) => this.normalizeBudgetCategory(category, index))
          .filter((category): category is BudgetCategory => category !== null)
      : [];
    const normalizedCategories = categories.length > 0
      ? categories
      : DEFAULT_BUDGET_CATEGORIES.map((category) => ({ ...category }));
    const categoryIds = new Set(normalizedCategories.map((category) => category.id));
    const defaultCategoryId = normalizedCategories[0]?.id ?? "other";
    const subscriptions = Array.isArray(finance?.subscriptions)
      ? finance.subscriptions
          .map((subscription, index) => this.normalizeFinanceSubscription(subscription, index, categoryIds, defaultCategoryId))
          .filter((subscription): subscription is FinanceSubscriptionEntry => subscription !== null)
          .sort((left, right) => {
            const leftKey = left.renewalDate || "9999-99-99";
            const rightKey = right.renewalDate || "9999-99-99";
            return leftKey.localeCompare(rightKey) || left.name.localeCompare(right.name);
          })
      : [];

    return {
      budgetCategories: normalizedCategories,
      subscriptions
    };
  }

  private normalizeBudgetCategory(category: Partial<BudgetCategory> | undefined, index: number): BudgetCategory | null {
    if (!category || typeof category !== "object") {
      return null;
    }

    const label = typeof category.label === "string" ? category.label.trim() : "";
    if (!label) {
      return null;
    }

    const id = this.normalizeFinanceId(typeof category.id === "string" ? category.id : label, `budget-category-${index + 1}`);
    const monthlyTarget = Number.isFinite(Number(category.monthlyTarget)) ? clamp(Number(category.monthlyTarget), 0, 1_000_000) : 0;
    const color = typeof category.color === "string" && /^#[0-9a-fA-F]{6}$/.test(category.color.trim())
      ? category.color.trim()
      : DEFAULT_BUDGET_CATEGORIES[index % DEFAULT_BUDGET_CATEGORIES.length]?.color ?? "#abb2bf";

    return {
      id,
      label,
      monthlyTarget,
      color
    };
  }

  private normalizeFinanceSubscription(
    subscription: Partial<FinanceSubscriptionEntry> | undefined,
    index: number,
    categoryIds: Set<string>,
    defaultCategoryId: string
  ): FinanceSubscriptionEntry | null {
    if (!subscription || typeof subscription !== "object") {
      return null;
    }

    const name = typeof subscription.name === "string" ? subscription.name.trim() : "";
    if (!name) {
      return null;
    }

    const status = subscription.status === "trial"
      || subscription.status === "paused"
      || subscription.status === "canceled"
      || subscription.status === "archived"
      ? subscription.status
      : "active";
    const kind = subscription.kind === "one-time" ? "one-time" : "recurring";
    const categoryId = typeof subscription.categoryId === "string" && categoryIds.has(subscription.categoryId)
      ? subscription.categoryId
      : defaultCategoryId;

    return {
      id: this.normalizeFinanceId(typeof subscription.id === "string" ? subscription.id : name, `subscription-${index + 1}`),
      name,
      cost: Number.isFinite(Number(subscription.cost)) ? clamp(Number(subscription.cost), 0, 1_000_000) : 0,
      currency: typeof subscription.currency === "string" && subscription.currency.trim().length > 0 ? subscription.currency.trim().toUpperCase().slice(0, 8) : "USD",
      intervalMonths: Number.isFinite(Number(subscription.intervalMonths)) ? clamp(Number(subscription.intervalMonths), 1, 120) : 1,
      paymentMethod: typeof subscription.paymentMethod === "string" ? subscription.paymentMethod.trim() : "",
      startedOn: typeof subscription.startedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(subscription.startedOn.trim()) ? subscription.startedOn.trim() : "",
      renewalDate: typeof subscription.renewalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(subscription.renewalDate.trim()) ? subscription.renewalDate.trim() : "",
      status,
      kind,
      categoryId,
      notes: typeof subscription.notes === "string" ? subscription.notes.trim() : "",
      cancelUrl: typeof subscription.cancelUrl === "string" ? subscription.cancelUrl.trim() : ""
    };
  }

  private normalizeFinanceId(value: string, fallback: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
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
    const legacyFoodEntries = Array.isArray(entry.foodLog)
      ? entry.foodLog
          .map((item) => normalizeFoodEntry(item))
          .filter((item): item is FoodEntry => item !== null)
      : [];
    const normalizedIntakeEntries = Array.isArray(entry.intakeLog)
      ? entry.intakeLog
          .map((item) => normalizeIntakeEntry(item))
          .filter((item): item is IntakeEntry => item !== null)
      : [];
    const mergedIntakeLog = [...normalizedIntakeEntries, ...legacyFoodEntries.map((item) => foodEntryToIntakeEntry(item))]
      .sort((left, right) => right.loggedAt.localeCompare(left.loggedAt));

    const normalizedMoodCheckIns = Array.isArray(entry.moodCheckIns)
      ? entry.moodCheckIns
          .filter((item): item is MoodCheckIn => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string"))
          .map((item) => ({
            loggedAt: item.loggedAt,
            score: clamp(Number(item.score ?? 0), 1, 5),
            feeling: typeof item.feeling === "string" ? item.feeling.trim() : "",
            note: typeof item.note === "string" ? item.note.trim() : ""
          }))
      : [];
    const normalizedEnergyCheckIns = Array.isArray(entry.energyCheckIns)
      ? entry.energyCheckIns
          .filter((item): item is EnergyCheckIn => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string"))
          .map((item) => ({
            loggedAt: item.loggedAt,
            score: clamp(Number(item.score ?? 0), 1, 5),
            note: typeof item.note === "string" ? item.note.trim() : ""
          }))
      : [];
    const normalizedAnxietyCheckIns = Array.isArray(entry.anxietyCheckIns)
      ? entry.anxietyCheckIns
          .filter((item): item is AnxietyCheckIn => Boolean(item && typeof item === "object" && typeof item.loggedAt === "string"))
          .map((item) => ({
            loggedAt: item.loggedAt,
            score: clamp(Number(item.score ?? 0), 1, 5),
            note: typeof item.note === "string" ? item.note.trim() : ""
          }))
      : [];

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
      moodScore: normalizedMoodCheckIns[0]?.score ?? clamp(Number(entry.moodScore ?? 0), 0, 5),
      energyScore: normalizedEnergyCheckIns[0]?.score ?? clamp(Number(entry.energyScore ?? 0), 0, 5),
      anxietyScore: normalizedAnxietyCheckIns[0]?.score ?? clamp(Number(entry.anxietyScore ?? 0), 0, 5),
      todayFocus: normalizeTodayFocusItems(entry.todayFocus),
      nextUpFocus: normalizeNextUpFocusItems(entry.nextUpFocus),
      calendarFollowThroughCompleted: Array.isArray(entry.calendarFollowThroughCompleted)
        ? entry.calendarFollowThroughCompleted.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(
        Object.fromEntries(
          settings.habitDefinitions
            .filter((habit) => isHabitDueOnDate(habit, date))
            .map((habit) => [habit.id, normalizedHabits[habit.id] ?? 0])
        ),
        settings.habitDefinitions.filter((habit) => isHabitDueOnDate(habit, date))
      ),
      habitMissNotes: entry.habitMissNotes && typeof entry.habitMissNotes === "object"
        ? Object.fromEntries(Object.entries(entry.habitMissNotes).filter((item): item is [string, string] => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0).map(([key, value]) => [key, value.trim()]))
        : {},
      foodLog: [],
      intakeLog: mergedIntakeLog,
      symptomLog: Array.isArray(entry.symptomLog)
        ? entry.symptomLog
            .map((item) => normalizeSymptomEntry(item))
            .filter((item): item is SymptomEntry => item !== null)
        : [],
      bodyWeight: Number.isFinite(Number(entry.bodyWeight)) && Number(entry.bodyWeight) > 0 ? clamp(Number(entry.bodyWeight), 1, 9999) : null,
      exerciseLog: Array.isArray(entry.exerciseLog)
        ? entry.exerciseLog
            .map((item) => normalizeExerciseEntry(item))
            .filter((item): item is ExerciseEntry => item !== null)
        : [],
      moodCheckIns: normalizedMoodCheckIns,
      energyCheckIns: normalizedEnergyCheckIns,
      anxietyCheckIns: normalizedAnxietyCheckIns,
      dietInsight: typeof entry.dietInsight === "string" ? entry.dietInsight : "",
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      dreamLog: typeof entry.dreamLog === "string" ? entry.dreamLog : "",
      helpedToday: typeof entry.helpedToday === "string" ? entry.helpedToday : "",
      hurtToday: typeof entry.hurtToday === "string" ? entry.hurtToday : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      workSessions: Array.isArray(entry.workSessions)
        ? entry.workSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : "",
              projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
            }))
        : [],
      workMinutesOverride: Number.isFinite(Number(entry.workMinutesOverride)) ? clamp(Number(entry.workMinutesOverride), 0, 1440) : null,
      napSessions: Array.isArray(entry.napSessions)
        ? entry.napSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : "",
              projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
            }))
        : [],
      napMinutesOverride: Number.isFinite(Number(entry.napMinutesOverride)) ? clamp(Number(entry.napMinutesOverride), 0, 1440) : null,
      relaxSessions: Array.isArray(entry.relaxSessions)
        ? entry.relaxSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : "",
              projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
            }))
        : [],
      relaxMinutesOverride: Number.isFinite(Number(entry.relaxMinutesOverride)) ? clamp(Number(entry.relaxMinutesOverride), 0, 1440) : null,
      breakSessions: Array.isArray(entry.breakSessions)
        ? entry.breakSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : "",
              projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
            }))
        : [],
      breakMinutesOverride: Number.isFinite(Number(entry.breakMinutesOverride)) ? clamp(Number(entry.breakMinutesOverride), 0, 1440) : null,
      poopSessions: Array.isArray(entry.poopSessions)
        ? entry.poopSessions
            .filter((item): item is WorkSession => Boolean(item && typeof item === "object" && typeof item.start === "string"))
            .map((item) => ({
              start: item.start,
              end: typeof item.end === "string" ? item.end : null,
              tag: typeof item.tag === "string" ? item.tag.trim() : "",
              projectName: typeof item.projectName === "string" ? item.projectName.trim() : ""
            }))
        : [],
      activitySessions: Array.isArray(entry.activitySessions)
        ? entry.activitySessions
            .map((item) => normalizeActivitySession(item))
            .filter((item): item is ActivitySession => item !== null)
        : [],
      poopQualityByStart: entry.poopQualityByStart && typeof entry.poopQualityByStart === "object"
        ? Object.fromEntries(Object.entries(entry.poopQualityByStart).filter((item): item is [string, string] => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0).map(([key, value]) => [key, value.trim()]))
        : {},
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
      ...entry.activitySessions.map((session) => session.start),
      ...entry.todayFocus.flatMap((item) => item.workSessions.map((session) => session.start)),
      ...entry.foodLog.map((item) => item.loggedAt ?? ""),
      ...entry.exerciseLog.map((item) => item.loggedAt ?? ""),
      ...entry.moodCheckIns.map((item) => item.loggedAt ?? ""),
      ...entry.energyCheckIns.map((item) => item.loggedAt ?? ""),
      ...entry.anxietyCheckIns.map((item) => item.loggedAt ?? ""),
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

  private syncStateRollups(entry: DailyEntry): void {
    entry.moodScore = entry.moodCheckIns[0]?.score ?? 0;
    entry.energyScore = entry.energyCheckIns[0]?.score ?? 0;
    entry.anxietyScore = entry.anxietyCheckIns[0]?.score ?? 0;
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
    const endDate = typeof event.endDate === "string" && event.endDate.trim().length > 0 ? event.endDate.trim() : date;
    const startTime = typeof event.startTime === "string" ? event.startTime.trim() : "";
    const endTime = typeof event.endTime === "string" ? event.endTime.trim() : "";
    const prepMinutes = Number.isFinite(Number(event.prepMinutes)) ? clamp(Number(event.prepMinutes), 0, 720) : 0;
    const travelMinutes = Number.isFinite(Number(event.travelMinutes)) ? clamp(Number(event.travelMinutes), 0, 720) : 0;
    const category = event.category === "work"
      || event.category === "health"
      || event.category === "errands"
      || event.category === "social"
      ? event.category
      : "personal";
    const projectName = typeof event.projectName === "string" ? event.projectName.trim() : "";
    const projectNotePath = typeof event.projectNotePath === "string" && event.projectNotePath.trim().length > 0
      ? normalizePath(event.projectNotePath.trim())
      : "";
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
            endDate: typeof item.endDate === "string" && item.endDate.trim().length > 0 ? item.endDate.trim() : (typeof item.date === "string" ? item.date.trim() : item.originalDate.trim()),
            startTime: typeof item.startTime === "string" ? item.startTime.trim() : "",
            endTime: typeof item.endTime === "string" ? item.endTime.trim() : "",
            prepMinutes: Number.isFinite(Number(item.prepMinutes)) ? clamp(Number(item.prepMinutes), 0, 720) : prepMinutes,
            travelMinutes: Number.isFinite(Number(item.travelMinutes)) ? clamp(Number(item.travelMinutes), 0, 720) : travelMinutes,
            category: item.category === "work"
              || item.category === "health"
              || item.category === "errands"
              || item.category === "social"
              ? item.category
              : category,
            title: typeof item.title === "string" ? item.title : title,
            projectName: typeof item.projectName === "string" ? item.projectName.trim() : projectName,
            projectNotePath: typeof item.projectNotePath === "string" && item.projectNotePath.trim().length > 0
              ? normalizePath(item.projectNotePath.trim())
              : projectNotePath,
            notes: typeof item.notes === "string" ? item.notes : "",
            updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : ""
          }))
          .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.originalDate) && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && /^\d{4}-\d{2}-\d{2}$/.test(item.endDate))
      : [];
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

  private validateCalendarEventInput(input: {
    title: string;
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
    prepMinutes: number;
    travelMinutes: number;
    category: CalendarEventCategory;
    projectName: string;
    projectNotePath: string;
    notes: string;
    repeatCadence: CalendarRepeatCadence;
    repeatUntil: string;
  }): Omit<CalendarEventEntry, "id" | "createdAt" | "updatedAt"> | null {
    const title = input.title.trim();
    const date = input.date.trim();
    const endDate = input.endDate.trim() || date;
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    const prepMinutes = Number.isFinite(Number(input.prepMinutes)) ? clamp(Number(input.prepMinutes), 0, 720) : 0;
    const travelMinutes = Number.isFinite(Number(input.travelMinutes)) ? clamp(Number(input.travelMinutes), 0, 720) : 0;
    const category = input.category;
    const projectName = input.projectName.trim();
    const projectNotePath = input.projectNotePath.trim() ? normalizePath(input.projectNotePath.trim()) : "";
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      new Notice("Calendar event end date must use YYYY-MM-DD.");
      return null;
    }

    if (endDate < date) {
      new Notice("Calendar event end date must be on or after the start date.");
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

    if (startTime && endTime && endDate === date && endTime < startTime) {
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

  private createTodayFocusItem(text: string, projectName = "", notes = "", estimateMinutes: number | null = null): TodayFocusItem {
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

  async openQuickCaptureFocusFlow(): Promise<void> {
    const todoSnapshot = await this.getTodoSnapshot();
    new FocusCaptureModal(this.app, {
      mode: "capture",
      availableProjectNames: (todoSnapshot?.projects ?? []).map((project) => project.name),
      onSubmit: async (payload) => {
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

  private closeCompetingSessions(entry: DailyEntry, timestamp: string, keepOpen: "work" | "nap" | "relax" | "break" | "poop" | "activity"): void {
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
      financeData: this.data.financeData,
      dayState: this.data.dayState,
      noteIndex: this.data.noteIndex,
      uiState: this.data.uiState
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
    this.maybeWarnRoutineWindows();

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
      || entry.activitySessions.some((session) => session.end === null)
      || entry.todayFocus.some((item) => item.workSessions.some((session) => session.end === null));
  }

  private hasMeaningfulLogicalDayActivity(entry: DailyEntry): boolean {
    return entry.workSessions.length > 0
      || entry.napSessions.length > 0
      || entry.relaxSessions.length > 0
      || entry.breakSessions.length > 0
      || entry.poopSessions.length > 0
      || entry.activitySessions.length > 0
      || entry.exerciseLog.length > 0
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
        this.showDashboardNotice(`Day-end suggestion: ${entry.date} has been inactive for ${this.formatDurationMinutes(insights.inactiveMinutes ?? 0)}. End it when you're done.`, 9000, true);
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
        this.showDashboardNotice(`Late-night rollover: you are still logging to ${entry.date}. End the logical day when you want new activity on ${calendarDate}.`, 10000, true);
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
    return Array.from(new Set(
      this.getCalendarOccurrencesInRange(new Date(), horizonEnd)
        .flatMap((event) => this.getDateKeysInSpan(event.date, event.endDate))
    )).sort();
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
      console.error("Obsidian DASH - Daily Action & System Hub could not parse calendar document payload", error);
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
            ? `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`
            : event.date === event.endDate ? `${event.date} All day` : `${event.date} -> ${event.endDate} All day`;
          const category = ` • ${event.category}`;
          const lead = this.renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
          const recurrence = event.repeatCadence !== "none"
            ? ` • repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}`
            : "";
          const exceptions = event.occurrenceExceptions.length > 0
            ? ` • ${event.occurrenceExceptions.length} one-off change${event.occurrenceExceptions.length === 1 ? "" : "s"}`
            : "";
          const project = event.projectName ? ` • ${this.renderCalendarProjectLink(event.projectName, event.projectNotePath)}` : "";
          const notes = event.notes ? ` • ${event.notes}` : "";
          return `- ${timing}: ${event.title}${category}${project}${lead ? ` • ${lead}` : ""}${recurrence}${exceptions}${notes}`;
        })
      : ["- No calendar events yet."];
    const upcomingOccurrences = this.getCalendarOccurrencesInRange(new Date(), new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
      
    const upcomingLines = upcomingOccurrences.length > 0
      ? upcomingOccurrences.slice(0, 200).map((event) => {
          const timing = event.startTime
            ? `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`
            : event.date === event.endDate ? `${event.date} All day` : `${event.date} -> ${event.endDate} All day`;
          const category = ` • ${event.category}`;
          const lead = this.renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
          const recurrence = event.isRecurring ? ` • from ${event.repeatCadence} series` : "";
          const exception = event.isException
            ? ` • ${event.exceptionKind === "move" ? `moved from ${event.originalDate}` : `${event.exceptionKind} once on ${event.originalDate}`}`
            : "";
          const project = event.projectName ? ` • ${this.renderCalendarProjectLink(event.projectName, event.projectNotePath)}` : "";
          const notes = event.notes ? ` • ${event.notes}` : "";
          return `- ${timing}: ${event.title}${category}${project}${lead ? ` • ${lead}` : ""}${recurrence}${exception}${notes}`;
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
    return this.upsertTextFile(path, this.buildGeneratedMarkdownContent(path, content));
  }

  private getProjectNotePath(projectName: string, noteLinks: string[] = []): string {
    const safeName = projectName.trim();
    if (!safeName) {
      return "";
    }

    const firstLink = noteLinks.find((link) => link.trim().length > 0)?.trim() ?? "";
    const basePath = firstLink
      ? stripMarkdownExtension(firstLink)
      : normalizeFolderPath(`${this.data.settings.projectNotesFolder}/${safeName}`);
    return basePath ? `${basePath}.md` : "";
  }

  private renderCalendarProjectLink(projectName: string, projectNotePath: string): string {
    const safeName = projectName.trim();
    if (!safeName) {
      return "";
    }

    return projectNotePath.trim() ? createWikiLink(projectNotePath.trim(), safeName) : safeName;
  }

  private renderDashboardExportSummary(input: {
    generatedAt: Date;
    entries: DailyEntry[];
    occurrences: CalendarEventOccurrence[];
    todoSnapshot: TodoSnapshot | null;
    habits: HabitDefinition[];
    folder: string;
  }): string {
    const linkedOccurrences = input.occurrences.filter((event) => event.projectName.trim().length > 0).length;
    const completedTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
    const averageMood = input.entries.length > 0
      ? (input.entries.reduce((sum, entry) => sum + entry.moodScore, 0) / input.entries.length).toFixed(1)
      : "0.0";
    const averageEnergy = input.entries.length > 0
      ? (input.entries.reduce((sum, entry) => sum + entry.energyScore, 0) / input.entries.length).toFixed(1)
      : "0.0";
    const averageWorkMinutes = input.entries.length > 0
      ? Math.round(input.entries.reduce((sum, entry) => sum + this.getTrackedWorkMinutes(entry), 0) / input.entries.length)
      : 0;

    return [
      `# Dashboard Export - ${formatDateKey(input.generatedAt)}`,
      "",
      `- Generated: ${formatDateTimeKey(input.generatedAt)}`,
      `- Export folder: ${input.folder}`,
      `- Entry range: ${input.entries[0]?.date ?? formatDateKey(input.generatedAt)} to ${input.entries[input.entries.length - 1]?.date ?? formatDateKey(input.generatedAt)}`,
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
      `- Open tasks: ${input.todoSnapshot?.totalOpen ?? 0}`,
      `- Archived tasks: ${input.todoSnapshot?.totalArchived ?? 0}`,
      `- Active projects tracked: ${input.todoSnapshot?.projects.length ?? 0}`,
      ...(input.todoSnapshot && input.todoSnapshot.staleProjects.length > 0
        ? input.todoSnapshot.staleProjects.slice(0, 5).map((project) => `- Stale: ${project.name} (${project.staleDays ?? 0} days, ${project.openCount} open tasks)`)
        : ["- No stale projects in the current snapshot."]),
      "",
      "## Habit Definitions",
      ...(input.habits.length > 0
        ? input.habits.map((habit) => `- ${habit.label}: target ${habit.target}, ${habit.cadence}, ${habit.completionWindow}, difficulty ${habit.difficultyWeight}/3`)
        : ["- No habits configured."]),
      ""
    ].join("\n");
  }

  private buildGeneratedMarkdownContent(path: string, content: string): string {
    const normalizedPath = normalizePath(path);
    const tags = this.getGeneratedDocumentTagsForPath(normalizedPath);
    const artifactType = this.getGeneratedDocumentArtifactTypeForPath(normalizedPath);
    const metadataLines = [
      "source: obsidian-dash",
      artifactType ? `artifact-type: ${artifactType}` : ""
    ].filter((line) => line.length > 0);
    if (tags.length === 0 && metadataLines.length === 0) {
      return content;
    }

    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    const tagBlock = ["tags:", ...tags.map((tag) => `  - ${tag}`)].join("\n");
    if (!frontmatterMatch) {
      const frontmatterLines = [...metadataLines, ...(tags.length > 0 ? [tagBlock] : [])].join("\n");
      return `---\n${frontmatterLines}\n---\n\n${content.replace(/^\s+/, "")}`;
    }

    const existingFrontmatter = frontmatterMatch[1]
      .replace(/^source:\s*.*$/m, "")
      .replace(/^artifact-type:\s*.*$/m, "")
      .replace(/^tags:\s*\[[^\]]*\]\s*$/m, "")
      .replace(/^tags:\s*\r?\n(?:  - .*\r?\n?)*/m, "")
      .trimEnd();
    const body = content.slice(frontmatterMatch[0].length).replace(/^\s+/, "");
    const nextFrontmatter = [existingFrontmatter, ...metadataLines, ...(tags.length > 0 ? [tagBlock] : [])]
      .filter((section) => section.trim().length > 0)
      .join("\n");
    return `---\n${nextFrontmatter}\n---\n\n${body}`;
  }

  private getGeneratedDocumentArtifactTypeForPath(path: string): string {
    const normalizedPath = normalizePath(path).toLowerCase();
    const prefixMatches = (folderPath: string): boolean => {
      const normalizedFolder = normalizePath(folderPath).toLowerCase();
      return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
    };

    if (normalizedPath === normalizePath(this.data.settings.basicInfoNotePath).toLowerCase()) {
      return "profile-note";
    }
    if (normalizedPath === this.getRecurringFrictionPatternsNotePath().toLowerCase()) {
      return "friction-patterns";
    }
    if (normalizedPath === normalizePath(this.data.settings.aiGuardrailsNotePath).toLowerCase()) {
      return "ai-guardrails";
    }
    if (normalizedPath === normalizePath(this.data.settings.currentSeasonNotePath).toLowerCase()) {
      return "current-season";
    }
    if (normalizedPath === normalizePath(this.data.settings.peopleDependenciesNotePath).toLowerCase()) {
      return "people-dependencies";
    }
    if (normalizedPath === normalizePath(this.data.settings.decisionJournalNotePath).toLowerCase()) {
      return "decision-journal";
    }
    if (normalizedPath === normalizePath(this.data.settings.systemMapNotePath).toLowerCase()) {
      return "system-map";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseRawFolder)) {
      return "knowledge-base-raw";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseSourcesFolder)) {
      return "knowledge-base-source";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseConceptsFolder)) {
      return "knowledge-base-concept";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseIndexesFolder)) {
      return "knowledge-base-index";
    }
    if (prefixMatches(`${this.data.settings.knowledgeBaseOutputsFolder}/Slides`)) {
      return "knowledge-base-slide-deck";
    }
    if (prefixMatches(`${this.data.settings.knowledgeBaseOutputsFolder}/Health Checks`)) {
      return "knowledge-base-health-check";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseOutputsFolder)) {
      return "knowledge-base-output";
    }
    if (prefixMatches(this.data.settings.knowledgeBaseAssetsFolder)) {
      return "knowledge-base-asset";
    }
    if (prefixMatches(this.data.settings.dailyLogFolder)) {
      return "daily-log";
    }
    if (prefixMatches(this.data.settings.weeklyReportFolder)) {
      return "weekly-report";
    }
    if (prefixMatches(this.data.settings.monthlyReportFolder)) {
      return "monthly-report";
    }
    if (prefixMatches(this.data.settings.aiOutputFolder)) {
      return "ai-note";
    }
    if (prefixMatches(this.data.settings.exportFolder)) {
      return normalizedPath.endsWith("/summary.md") ? "export-summary" : "export-note";
    }
    if (normalizedPath === normalizePath(this.data.settings.calendarDocumentPath).toLowerCase()) {
      return "calendar-note";
    }
    if (normalizedPath.startsWith("dashboard logs/gamification/")) {
      return "gamification-report";
    }
    if (normalizedPath.startsWith("dashboard logs/weekly reviews/")) {
      return "weekly-review";
    }
    if (normalizedPath.startsWith("dashboard logs/project reviews/")) {
      return "project-review";
    }
    if (normalizedPath.startsWith("dashboard logs/dependency reviews/")) {
      return "dependency-review";
    }
    if (normalizedPath.startsWith("dashboard logs/cleanup suggestions/")) {
      return "cleanup-note";
    }

    return "generated-note";
  }

  private getGeneratedDocumentTagsForPath(path: string): string[] {
    const normalizedPath = normalizePath(path).toLowerCase();
    const configuredTags = this.data.settings.generatedDocumentTags
      .split(/[\r\n,]+/)
      .map((tag) => tag.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase())
      .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
    const autoTags = ["daily-dashboard"];
    const prefixMatches = (folderPath: string): boolean => {
      const normalizedFolder = normalizePath(folderPath).toLowerCase();
      return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
    };

    if (normalizedPath === normalizePath(this.data.settings.basicInfoNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile");
    } else if (normalizedPath === this.getRecurringFrictionPatternsNotePath().toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/friction-patterns");
    } else if (normalizedPath === normalizePath(this.data.settings.aiGuardrailsNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/ai-guardrails");
    } else if (normalizedPath === normalizePath(this.data.settings.currentSeasonNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/current-season");
    } else if (normalizedPath === normalizePath(this.data.settings.peopleDependenciesNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/people-dependencies");
    } else if (normalizedPath === normalizePath(this.data.settings.decisionJournalNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/decision-journal");
    } else if (normalizedPath === normalizePath(this.data.settings.systemMapNotePath).toLowerCase()) {
      autoTags.push("daily-dashboard/profile", "daily-dashboard/system-map");
    } else if (prefixMatches(this.data.settings.knowledgeBaseRawFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/raw");
    } else if (prefixMatches(this.data.settings.knowledgeBaseSourcesFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/source");
    } else if (prefixMatches(this.data.settings.knowledgeBaseConceptsFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/concept");
    } else if (prefixMatches(this.data.settings.knowledgeBaseIndexesFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/index");
    } else if (prefixMatches(`${this.data.settings.knowledgeBaseOutputsFolder}/Slides`)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/output", "daily-dashboard/knowledge-base/slide-deck");
    } else if (prefixMatches(`${this.data.settings.knowledgeBaseOutputsFolder}/Health Checks`)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/output", "daily-dashboard/knowledge-base/health-check");
    } else if (prefixMatches(this.data.settings.knowledgeBaseOutputsFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/output");
    } else if (prefixMatches(this.data.settings.knowledgeBaseAssetsFolder)) {
      autoTags.push("daily-dashboard/knowledge-base", "daily-dashboard/knowledge-base/asset");
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
    } else if (normalizedPath === normalizePath(this.data.settings.calendarDocumentPath).toLowerCase()) {
      autoTags.push("daily-dashboard/calendar");
    } else if (normalizedPath.startsWith("dashboard logs/gamification/")) {
      autoTags.push("daily-dashboard/gamification");
    } else if (normalizedPath.startsWith("dashboard logs/weekly reviews/")) {
      autoTags.push("daily-dashboard/weekly-review");
    } else if (normalizedPath.startsWith("dashboard logs/project reviews/")) {
      autoTags.push("daily-dashboard/project-review");
    } else if (normalizedPath.startsWith("dashboard logs/dependency reviews/")) {
      autoTags.push("daily-dashboard/dependency-review");
    } else if (normalizedPath.startsWith("dashboard logs/cleanup suggestions/")) {
      autoTags.push("daily-dashboard/cleanup");
    }

    return [...new Set([...configuredTags, ...autoTags])];
  }

  private renderDailyMetricsCsv(entries: DailyEntry[], habits: HabitDefinition[], occurrences: CalendarEventOccurrence[]): string {
    const calendarCountsByDate = new Map<string, number>();
    occurrences.forEach((event) => {
      calendarCountsByDate.set(event.date, (calendarCountsByDate.get(event.date) ?? 0) + 1);
    });

    const rows = entries.map((entry) => {
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
        `${calendarCountsByDate.get(entry.date) ?? 0}`,
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

  private renderHabitMetricsCsv(entries: DailyEntry[], habits: HabitDefinition[]): string {
    const rows = entries.flatMap((entry) => habits.map((habit) => [
      entry.date,
      habit.id,
      habit.label,
      `${habit.target}`,
      habit.completionWindow,
      `${habit.difficultyWeight}`,
      `${entry.habits[habit.id] ?? 0}`,
      `${(entry.habitEvents[habit.id] ?? []).length}`,
      (entry.habitEvents[habit.id] ?? []).join(" | "),
      entry.habitMissNotes[habit.id] ?? ""
    ]));

    return this.renderCsv([
      ["date", "habitId", "habitLabel", "target", "completionWindow", "difficultyWeight", "completionCount", "eventCount", "eventTimestamps", "missNote"],
      ...rows
    ]);
  }

  private renderCompletedTasksCsv(entries: DailyEntry[]): string {
    const rows = entries.flatMap((entry) => entry.completedTasks.map((task) => [
      entry.date,
      task.project,
      task.section,
      task.text,
      task.archivedAt,
      task.note ?? ""
    ]));

    return this.renderCsv([
      ["date", "project", "section", "text", "archivedAt", "note"],
      ...rows
    ]);
  }

  private renderCalendarOccurrencesCsv(occurrences: CalendarEventOccurrence[]): string {
    const rows = occurrences.map((event) => [
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
      event.exceptionKind ?? "",
      `${event.prepMinutes}`,
      `${event.travelMinutes}`,
      event.notes
    ]);

    return this.renderCsv([
      ["date", "endDate", "startTime", "endTime", "title", "category", "projectName", "projectNotePath", "originalDate", "repeatCadence", "isRecurring", "isException", "exceptionKind", "prepMinutes", "travelMinutes", "notes"],
      ...rows
    ]);
  }

  private renderCsv(rows: string[][]): string {
    return rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(","))
      .join("\n");
  }

  private escapeCsvValue(value: string): string {
    const safeValue = value.replace(/\r?\n/g, " ");
    if (!/[",\n]/.test(safeValue)) {
      return safeValue;
    }

    return `"${safeValue.replace(/"/g, '""')}"`;
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
        console.warn(`Obsidian DASH - Daily Action & System Hub skipped wallpaper path ${folderPath}`, error);
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
