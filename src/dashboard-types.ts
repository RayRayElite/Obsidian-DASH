export const VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
export const CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
export const PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
export const SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
export const PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
export const NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
export const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);

export interface HabitDefinition {
  id: string;
  label: string;
  target: number;
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
}

export interface FoodEntry {
  text: string;
  loggedAt: string;
}

export interface DailyEntry {
  date: string;
  lastEditedAt: string;
  dayStartedAt: string;
  dayEndedAt: string;
  wakeTime: string;
  sleepTime: string;
  habits: Record<string, number>;
  habitEvents: Record<string, string[]>;
  moodScore: number;
  energyScore: number;
  todayFocus: string[];
  frictionLog: string;
  missedHabits: string[];
  foodLog: FoodEntry[];
  sleepLog: string;
  dreamLog: string;
  notes: string;
  workSessions: WorkSession[];
  napSessions: WorkSession[];
  completedTasks: ArchivedTaskSnapshot[];
}

export interface DayLifecycleState {
  activeDate: string;
  status: "not-started" | "in-progress" | "ended";
}

export interface DashboardSettings {
  dashboardTitle: string;
  masterTodoPath: string;
  projectNotesFolder: string;
  dailyLogFolder: string;
  weeklyReportFolder: string;
  monthlyReportFolder: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiOutputFolder: string;
  aiContextDays: number;
  aiRelatedNotesLimit: number;
  aiIndexEnabled: boolean;
  aiIndexedFolders: string;
  aiChunkCharLimit: number;
  aiEmbeddingsEnabled: boolean;
  aiEmbeddingModel: string;
  aiEmbeddingApiUrl: string;
  wallpaperFolder: string;
  selectedWallpaper: string;
  habitDefinitions: HabitDefinition[];
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
  dayState: DayLifecycleState;
  noteIndex: NoteIndexCache;
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

export interface TodoSnapshot {
  totalOpen: number;
  totalArchived: number;
  projects: TodoProjectSummary[];
  staleProjects: TodoProjectSummary[];
  breakdownCandidates: Array<{ project: string; task: string }>;
  cleanupSuggestions: string[];
}

export interface WorkLogFilters {
  project: string;
  keyword: string;
  fromDate: string;
  toDate: string;
}

export interface QuickAddState {
  projectName: string;
  sectionName: string;
  taskText: string;
}

export interface ProjectReviewOption {
  projectName: string;
  notePath: string;
}

export type DashboardTone = "focus" | "state" | "capture" | "log" | "health" | "alert" | "done" | "neutral";

export interface CardVisualOptions {
  icon: string;
  eyebrow: string;
  tone: DashboardTone;
  tag?: string;
}

export interface RepeatingTaskDefinition {
  text: string;
  cadence: string;
}

export interface WeeklyReviewInput {
  label: string;
  start: Date;
  end: Date;
  entries: DailyEntry[];
  todoSnapshot: TodoSnapshot | null;
  habits: HabitDefinition[];
}

export interface ReferenceOffloadResult {
  updatedContent: string;
  offloadedProjects: string[];
}

export interface ArchiveResult {
  content: string;
  archivedTasks: ArchivedTaskSnapshot[];
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
}

export interface AiStatus {
  configured: boolean;
  busy: boolean;
  model: string;
  outputFolder: string;
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
  dashboardTitle: "Daily Dashboard",
  masterTodoPath: "Master Task Hub.md",
  projectNotesFolder: "Project Notes",
  dailyLogFolder: "Dashboard Logs/Daily",
  weeklyReportFolder: "Dashboard Logs/Weekly",
  monthlyReportFolder: "Dashboard Logs/Monthly",
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