export const VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
export const CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
export const PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
export const SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
export const PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
export const NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
export const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
export const SESSION_TAG_OPTIONS = ["deep work", "admin", "creative", "errands", "recovery"] as const;

export const HABIT_WINDOW_OPTIONS = ["anytime", "morning", "afternoon", "evening", "before-bed"] as const;
export const HABIT_CADENCE_OPTIONS = ["daily", "every-other-day", "weekly"] as const;
export const INTAKE_KIND_OPTIONS = ["drink", "food", "medication", "supplement"] as const;
export const ACTIVITY_SESSION_KIND_OPTIONS = ["exercise", "reading", "gaming", "hygiene", "cooking", "errand", "commute", "social", "chores", "hobbies"] as const;
export const EXERCISE_INTENSITY_OPTIONS = ["easy", "moderate", "hard"] as const;

export type HabitCompletionWindow = (typeof HABIT_WINDOW_OPTIONS)[number];
export type HabitCadence = (typeof HABIT_CADENCE_OPTIONS)[number];
export type IntakeKind = (typeof INTAKE_KIND_OPTIONS)[number];
export type ActivitySessionKind = (typeof ACTIVITY_SESSION_KIND_OPTIONS)[number];
export type ExerciseIntensity = (typeof EXERCISE_INTENSITY_OPTIONS)[number];
export type MeasurementSystem = "imperial" | "metric";
export type WeightGoalMode = "lose" | "maintain" | "gain";
export type DashboardNotificationSound = "off" | "chime" | "ping" | "alert";

export interface HabitDefinition {
  id: string;
  label: string;
  target: number;
  completionWindow: HabitCompletionWindow;
  cadence: HabitCadence;
  anchorDate: string;
  difficultyWeight: number;
}

export interface RoutineTemplateDefinition {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

export interface ArchivedTaskSnapshot {
  project: string;
  section: string;
  text: string;
  archivedAt: string;
  note?: string;
}

export interface WorkSession {
  start: string;
  end: string | null;
  tag: string;
  projectName: string;
}

export interface ActivitySession extends WorkSession {
  kind: ActivitySessionKind;
  label: string;
}

export interface ExerciseEntry {
  label: string;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  note: string;
  loggedAt: string;
  linkedSessionStart: string;
}

export type AiApiKeySource = "settings" | "env";
export type DashboardViewMode = "mobile" | "compact" | "widescreen";

export type TodayFocusStatus = "pending" | "working" | "done";

export type CalendarRepeatCadence = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type CalendarOccurrenceExceptionKind = "skip" | "cancel" | "move";
export type CalendarEventCategory = "work" | "health" | "errands" | "social" | "personal";

export interface CalendarOccurrenceException {
  originalDate: string;
  kind: CalendarOccurrenceExceptionKind;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  prepMinutes: number;
  travelMinutes: number;
  category: CalendarEventCategory;
  title: string;
  projectName: string;
  projectNotePath: string;
  notes: string;
  updatedAt: string;
}

export interface CalendarEventEntry {
  id: string;
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
  occurrenceExceptions: CalendarOccurrenceException[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventOccurrence {
  id: string;
  sourceEventId: string;
  originalDate: string;
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
  isRecurring: boolean;
  isException: boolean;
  exceptionKind?: CalendarOccurrenceExceptionKind;
}

export interface CalendarDocumentPayload {
  updatedAt: string;
  eventCount: number;
  events: CalendarEventEntry[];
}

export interface DashboardFocusDisplayItem {
  kind: "focus" | "reminder";
  id: string;
  sourceEventId?: string;
  text: string;
  projectName?: string;
  notes?: string;
  estimateMinutes?: number | null;
  status: TodayFocusStatus | "reminder";
  workSessions: WorkSession[];
  completedAt: string | null;
  trackedMinutes: number;
  isActive: boolean;
  calendarDate?: string;
  calendarStart?: string;
  calendarEnd?: string;
  calendarLeadSummary?: string;
  allDay?: boolean;
  calendarNotes?: string;
  repeatCadence?: CalendarRepeatCadence;
  warningLevel?: "warning" | "upcoming";
}

export interface TodayFocusItem {
  text: string;
  projectName: string;
  notes: string;
  estimateMinutes: number | null;
  status: TodayFocusStatus;
  workSessions: WorkSession[];
  completedAt: string | null;
}

export interface NextUpFocusItem {
  text: string;
  projectName: string;
  notes: string;
  estimateMinutes: number | null;
}

export interface FoodEntry {
  text: string;
  amount: number;
  loggedAt: string;
}

export interface IntakeEntry {
  kind: IntakeKind;
  label: string;
  amount: number;
  unit: string;
  note: string;
  loggedAt: string;
  loggedAtHistory: string[];
}

export interface IntakeQuickPreset {
  id: string;
  kind: IntakeKind;
  label: string;
  amount: number;
  unit: string;
}

export interface HabitAutomation {
  id: string;
  habitId: string;
  intakeKind: IntakeKind;
  label: string;
  amount: number;
  unit: string;
  note: string;
}

export interface SymptomEntry {
  symptom: string;
  severity: number;
  note: string;
  loggedAt: string;
}

export interface EnergyCheckIn {
  loggedAt: string;
  score: number;
  note: string;
}

export interface MoodCheckIn {
  loggedAt: string;
  score: number;
  feeling: string;
  note: string;
}

export interface AnxietyCheckIn {
  loggedAt: string;
  score: number;
  note: string;
}

export interface DailyEntry {
  date: string;
  lastEditedAt: string;
  dayStartedAt: string;
  dayEndedAt: string;
  wakeTime: string;
  wakeQualityScore: number;
  sleepTime: string;
  sleepMinutesOverride: number | null;
  habits: Record<string, number>;
  habitEvents: Record<string, string[]>;
  moodScore: number;
  energyScore: number;
  anxietyScore: number;
  todayFocus: TodayFocusItem[];
  nextUpFocus: NextUpFocusItem[];
  calendarFollowThroughCompleted: string[];
  frictionLog: string;
  missedHabits: string[];
  habitMissNotes: Record<string, string>;
  foodLog: FoodEntry[];
  intakeLog: IntakeEntry[];
  symptomLog: SymptomEntry[];
  bodyWeight: number | null;
  exerciseLog: ExerciseEntry[];
  moodCheckIns: MoodCheckIn[];
  energyCheckIns: EnergyCheckIn[];
  anxietyCheckIns: AnxietyCheckIn[];
  dietInsight: string;
  sleepLog: string;
  dreamLog: string;
  helpedToday: string;
  hurtToday: string;
  notes: string;
  workSessions: WorkSession[];
  workMinutesOverride: number | null;
  napSessions: WorkSession[];
  napMinutesOverride: number | null;
  relaxSessions: WorkSession[];
  relaxMinutesOverride: number | null;
  breakSessions: WorkSession[];
  breakMinutesOverride: number | null;
  poopSessions: WorkSession[];
  activitySessions: ActivitySession[];
  poopQualityByStart: Record<string, string>;
  completedTasks: ArchivedTaskSnapshot[];
}

export interface DayRepairInput {
  date: string;
  status: "not-started" | "in-progress" | "ended";
  dayStartedAt: string;
  dayEndedAt: string;
  wakeTime: string;
  sleepTime: string;
  sleepMinutesOverride: number;
  workMinutesOverride: number;
  napMinutesOverride: number;
  relaxMinutesOverride: number;
  breakMinutesOverride: number;
  moodScore: number;
  energyScore: number;
  anxietyScore: number;
  timelineSessions: RepairTimelineSession[];
}

export type RepairTimelineSessionKind = "work" | "nap" | "relax" | "break" | "poop";

export interface RepairTimelineSession {
  id: string;
  kind: RepairTimelineSessionKind;
  start: string;
  end: string;
  tag: string;
}

export interface DayLifecycleState {
  activeDate: string;
  status: "not-started" | "in-progress" | "ended";
  lastInactivityPromptActivityAt: string;
  lastLateNightWarningKey: string;
}

export interface LogicalDayPrompt {
  id: string;
  kind: "end-day-suggestion" | "late-night-warning";
  title: string;
  description: string;
  tone: DashboardTone;
}

export interface LogicalDayInsights {
  lastActivityAt: string;
  inactiveMinutes: number | null;
  hasActiveSession: boolean;
  isRollover: boolean;
  prompts: LogicalDayPrompt[];
}

export interface SleepNightSnapshot {
  date: string;
  sleepMinutes: number;
  bedtime: string;
  wakeTime: string;
  wakeQualityScore: number;
  recoveryScore: number;
  recoveryLabel: string;
}

export interface SleepInsights {
  targetMinutes: number;
  nightsTracked: number;
  averageSleepMinutes: number;
  debtMinutes: number;
  consistencyScore: number;
  consistencyLabel: string;
  averageRecoveryScore: number;
  recoveryLabel: string;
  averageBedtime: string;
  averageWakeTime: string;
  recentNights: SleepNightSnapshot[];
}

export interface TimeAllocationBucket {
  label: string;
  minutes: number;
  tone: DashboardTone;
}

export interface TimeAllocationInsights {
  date: string;
  sleepMinutes: number;
  workMinutes: number;
  napMinutes: number;
  relaxMinutes: number;
  breakMinutes: number;
  poopMinutes: number;
  activityMinutes: number;
  trackedAwakeMinutes: number;
  awakeWindowMinutes: number | null;
  awakeUnknownMinutes: number | null;
  fullDayUnknownMinutes: number;
  diagnostics: string[];
  buckets: TimeAllocationBucket[];
}

export interface DashboardSettings {
  dashboardTitle: string;
  masterTodoPath: string;
  projectNotesFolder: string;
  dailyLogFolder: string;
  weeklyReportFolder: string;
  monthlyReportFolder: string;
  exportFolder: string;
  generatedDocumentTags: string;
  aiApiKey: string;
  aiApiKeySource: AiApiKeySource;
  aiApiKeyEnvVar: string;
  aiModel: string;
  aiBaseUrl: string;
  aiOutputFolder: string;
  basicInfoNotePath: string;
  includeBasicInfoInAi: boolean;
  aiPromptTemplates: string;
  aiContextDays: number;
  aiRelatedNotesLimit: number;
  aiIndexEnabled: boolean;
  aiIndexedFolders: string;
  aiChunkCharLimit: number;
  aiEmbeddingsEnabled: boolean;
  aiEmbeddingModel: string;
  aiEmbeddingApiUrl: string;
  calendarEnabled: boolean;
  calendarDocumentPath: string;
  calendarLookaheadHours: number;
  calendarWarningHours: number;
  measurementSystem: MeasurementSystem;
  weightGoalTarget: number;
  weightGoalMode: WeightGoalMode;
  weightGoalWeeklyRate: number;
  intakeQuickPresets: IntakeQuickPreset[];
  habitAutomations: HabitAutomation[];
  showUndoNotifications: boolean;
  notificationSound: DashboardNotificationSound;
  wallpaperFolder: string;
  selectedWallpaper: string;
  habitDefinitions: HabitDefinition[];
  routineTemplates: string;
}

export interface CalendarReminderItem {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  reminderAt: string;
  projectName: string;
  projectNotePath: string;
  notes: string;
  leadMinutes: number;
  leadSummary: string;
  repeatCadence: CalendarRepeatCadence;
  allDay: boolean;
  warningLevel: "warning" | "upcoming";
}

export interface CalendarSnapshot {
  reminders: CalendarReminderItem[];
  enabled: boolean;
}

export interface WeeklyAgendaEvent {
  id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  category: CalendarEventCategory;
  projectName: string;
  projectNotePath: string;
  notes: string;
  isRecurring: boolean;
}

export interface WeeklyAgendaDay {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
  events: WeeklyAgendaEvent[];
}

export interface SuggestedTop3Candidate {
  id: string;
  text: string;
  notes: string;
  estimateMinutes: number | null;
  reason: string;
  source: "calendar" | "overdue" | "due-soon" | "repeating" | "stale";
  calendarDate?: string;
}

export interface CreateProjectInput {
  projectName: string;
  categoryName: string;
  status: string;
  focus: string;
  addTasks: string[];
  fixTasks: string[];
}

export interface ExistingProjectDefinition {
  projectName: string;
  categoryName: string;
  status: string;
  focus: string;
  addTasks: string[];
  fixTasks: string[];
  noteLinkPath: string;
}

export interface DashboardPluginData {
  settings: DashboardSettings;
  entries: Record<string, DailyEntry>;
  calendarEvents: CalendarEventEntry[];
  dayState: DayLifecycleState;
  noteIndex: NoteIndexCache;
  uiState: DashboardUiState;
}

export interface NoteIndexChunk {
  id: string;
  heading: string;
  text: string;
  keywords: string[];
  embedding?: number[];
}

export interface NoteIndexEntry {
  path: string;
  mtime: number;
  size: number;
  title: string;
  keywords: string[];
  chunks: NoteIndexChunk[];
}

export interface NoteIndexCache {
  version: number;
  indexedAt: string;
  lastIndexedFile: string;
  entries: Record<string, NoteIndexEntry>;
}

export interface WallpaperOption {
  path: string;
  displayName: string;
  url: string;
}

export interface TodoProjectRange {
  name: string;
  start: number;
  end: number;
}

export interface TodoProjectSummary {
  name: string;
  categoryName: string;
  status: string;
  projectState: "active" | "incubating" | "someday";
  openCount: number;
  archivedCount: number;
  completionRate: number;
  focus: string;
  projectSummary: string;
  whyItMatters: string;
  definitionOfDone: string;
  lastReview: string;
  waitingOn: string;
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
  nextAction: string;
  healthScore: number;
  healthLabel: string;
  healthReasons: string[];
  relationships: string[];
  nowTaskDetails: TodoTaskSummary[];
  nextTaskDetails: TodoTaskSummary[];
  laterTaskDetails: TodoTaskSummary[];
  dueRepeatingTaskDetails: TodoTaskSummary[];
  dueSoonTasks: TodoTaskSummary[];
  overdueTasks: TodoTaskSummary[];
  blockedTasks: TodoTaskSummary[];
}

export interface TodoSnapshot {
  totalOpen: number;
  totalArchived: number;
  projects: TodoProjectSummary[];
  staleProjects: TodoProjectSummary[];
  breakdownCandidates: Array<{ project: string; task: string }>;
  cleanupSuggestions: CleanupSuggestion[];
  dueSoonTasks: Array<{ project: string; task: TodoTaskSummary }>;
  overdueTasks: Array<{ project: string; task: TodoTaskSummary }>;
  blockedTasks: Array<{ project: string; task: TodoTaskSummary }>;
}

export type CleanupSuggestionKind =
  | "stale-project"
  | "duplicate-tasks"
  | "breakdown-tasks"
  | "overdue-tasks"
  | "blocked-tasks"
  | "empty-sections";

export type CleanupSuggestionAction = "open-master-todo" | "open-cleanup-note";

export interface CleanupSuggestion {
  id: string;
  projectName: string;
  kind: CleanupSuggestionKind;
  summary: string;
  detail: string;
  action: CleanupSuggestionAction;
  actionLabel: string;
}

export interface TodoTaskSummary {
  text: string;
  rawText: string;
  section: string;
  dueDate: string;
  blockedReason: string;
  unblockDate: string;
  isBlocked: boolean;
  isDueSoon: boolean;
  isOverdue: boolean;
}

export interface WorkLogFilters {
  project: string;
  keyword: string;
  fromDate: string;
  toDate: string;
}

export type TimelineSearchKind = "task" | "session" | "calendar" | "log";

export interface TimelineSearchFilters {
  keyword: string;
  project: string;
  tag: string;
  kinds: TimelineSearchKind[];
  fromDate: string;
  toDate: string;
  onlyWithNotes: boolean;
}

export interface TimelineSearchResult {
  id: string;
  date: string;
  sortKey: string;
  kind: TimelineSearchKind;
  title: string;
  summary: string;
  detail: string;
  tone: DashboardTone;
  project: string;
  tag: string;
}

export interface SavedDashboardFilter {
  name: string;
  workLogFilters: WorkLogFilters;
  timelineFilters: TimelineSearchFilters;
}

export interface DashboardUiState {
  onboardingCompleted: boolean;
  onboardingDeferredUntil: string;
  dismissedNotificationIds: string[];
  dismissedCleanupSuggestionIds: string[];
}

export type DashboardNotificationActionKind = "open-setup" | "open-master-todo" | "open-cleanup-note" | "end-day" | "repair-day";

export interface DashboardNotificationAction {
  kind: DashboardNotificationActionKind;
  label: string;
}

export interface DashboardNotificationItem {
  id: string;
  source: "calendar" | "logical-day" | "routine" | "tasks" | "system";
  title: string;
  description: string;
  tone: DashboardTone;
  action?: DashboardNotificationAction;
  dismissible: boolean;
}

export interface QuickAddState {
  projectName: string;
  sectionName: string;
  taskText: string;
}

export interface ProjectReviewOption {
  projectName: string;
  notePath: string;
  status: string;
  projectState: "active" | "incubating" | "someday";
  nextAction: string;
  healthScore: number;
  healthLabel: string;
  healthReasons: string[];
  completionsThisWeek: number;
  completionsPreviousWeek: number;
  completionsThisMonth: number;
  overdueTasks: TodoTaskSummary[];
  dueSoonTasks: TodoTaskSummary[];
  blockedTasks: TodoTaskSummary[];
  duplicateTasks: string[];
  emptySections: string[];
}

export type DashboardTone = "focus" | "state" | "capture" | "log" | "health" | "alert" | "done" | "neutral" | "hobby";

export interface CardVisualOptions {
  icon: string;
  eyebrow: string;
  tone: DashboardTone;
  tag?: string;
}

export interface RepeatingTaskDefinition {
  text: string;
  cadence: string;
  ruleText: string;
  rule: RepeatingTaskRule;
}

export type RepeatingTaskRuleKind = "daily" | "weekly" | "monthly" | "yearly" | "interval" | "weekday-list";
export type RepeatingTaskIntervalUnit = "day" | "week" | "month" | "year";

export interface RepeatingTaskRule {
  kind: RepeatingTaskRuleKind;
  interval: number;
  unit?: RepeatingTaskIntervalUnit;
  weekdays?: number[];
  monthlyDay?: number | "last";
}

export interface WeeklyReviewInput {
  label: string;
  start: Date;
  end: Date;
  entries: DailyEntry[];
  todoSnapshot: TodoSnapshot | null;
  habits: HabitDefinition[];
}

export interface PersonalTrendSummary {
  strongestSignals: string[];
  driftSignals: string[];
  repeatedMisses: string[];
  symptomSignals: string[];
  reflectionSignals: string[];
}

export interface GamificationCategoryScore {
  key: "execution" | "health" | "consistency" | "recovery" | "planning";
  label: string;
  score: number;
  maxScore: number;
  tone: DashboardTone;
  summary: string;
  details: string[];
}

export interface GamificationSnapshot {
  label: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  comparisonText: string;
  categories: GamificationCategoryScore[];
  highlights: string[];
  cautions: string[];
}

export interface GamificationSummary {
  model: "deterministic";
  today: GamificationSnapshot;
  week: GamificationSnapshot;
  month: GamificationSnapshot;
  currentStreak: number;
  bestStreak: number;
  personalBestDayLabel: string;
  personalBestDayScore: number;
  recoveryFromLowScoreDays: number;
  lowScoreThreshold: number;
}

export interface ReferenceOffloadResult {
  updatedContent: string;
  offloadedProjects: string[];
}

export interface ArchiveResult {
  content: string;
  archivedTasks: ArchivedTaskSnapshot[];
}

export interface ArchiveMaintenanceResult {
  content: string;
  archivedTasks: ArchivedTaskSnapshot[];
  restoredTasks: ArchivedTaskSnapshot[];
}

export interface AiStructuredPayload {
  suggestedFocus: string[];
  nextActions: string[];
  keyRisks: string[];
  followUpQuestions: string[];
}

export interface AiArtifact {
  kind: string;
  title: string;
  generatedAt: string;
  notePath: string;
  summary: string;
  suggestedFocus: string[];
  nextActions: string[];
}

export interface AiStatus {
  configured: boolean;
  busy: boolean;
  model: string;
  outputFolder: string;
  keySource: AiApiKeySource;
  latestArtifact: AiArtifact | null;
  indexStatus: RetrievalIndexStatus;
}

export interface RetrievalIndexStatus {
  enabled: boolean;
  indexing: boolean;
  indexedNotes: number;
  indexedChunks: number;
  embeddedChunks: number;
  indexedAt: string;
  lastIndexedFile: string;
  indexedFolders: string[];
  embeddingsEnabled: boolean;
  embeddingModel: string;
}

export interface AiRelevantNote {
  path: string;
  reason: string;
  excerpt: string;
  score: number;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
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