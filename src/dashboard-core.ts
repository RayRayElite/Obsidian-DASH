import { TFile, normalizePath } from "obsidian";

import {
  DEFAULT_SETTINGS,
  type AiRelevantNote,
  type AiStructuredPayload,
  type DailyEntry,
  type DashboardSettings,
  type DayLifecycleState,
  type FoodEntry,
  type HabitAutomation,
  type HabitCadence,
  type HabitDefinition,
  type HabitCompletionWindow,
  type IntakeEntry,
  type IntakeQuickPreset,
  type NextUpFocusItem,
  type NoteIndexCache,
  type NoteIndexChunk,
  type NoteIndexEntry,
  type SymptomEntry,
  type TodayFocusItem,
  type TodayFocusStatus,
  type RoutineTemplateDefinition,
  type TodoSnapshot
} from "./dashboard-types";

export function sanitizeSettings(settings: DashboardSettings): DashboardSettings {
  const parsedHabitDefinitions = Array.isArray(settings.habitDefinitions)
    ? settings.habitDefinitions
        .map((habit) => ({
          id: createHabitId(habit.id || habit.label || "habit"),
          label: typeof habit.label === "string" ? habit.label.trim() : "Habit",
          target: clamp(Number(habit.target ?? 1), 1, 12),
          completionWindow: normalizeHabitWindow(habit.completionWindow),
          cadence: normalizeHabitCadence(habit.cadence),
          anchorDate: typeof habit.anchorDate === "string" ? habit.anchorDate : "",
          difficultyWeight: clamp(Number(habit.difficultyWeight ?? 1), 1, 3)
        }))
        .filter((habit) => habit.label.length > 0)
    : DEFAULT_SETTINGS.habitDefinitions;
  const aiApiKeySource = settings.aiApiKeySource === "env" ? "env" : "settings";
  const calendarLookaheadHours = clamp(Number(settings.calendarLookaheadHours ?? DEFAULT_SETTINGS.calendarLookaheadHours), 1, 336);
  const calendarWarningHours = clamp(Number(settings.calendarWarningHours ?? DEFAULT_SETTINGS.calendarWarningHours), 1, calendarLookaheadHours);
  const measurementSystem = settings.measurementSystem === "metric" ? "metric" : DEFAULT_SETTINGS.measurementSystem;
  const intakeQuickPresets = Array.isArray(settings.intakeQuickPresets)
    ? settings.intakeQuickPresets
        .map((preset, index) => normalizeIntakeQuickPreset(preset, index))
        .filter((preset): preset is IntakeQuickPreset => preset !== null)
    : getDefaultIntakeQuickPresets(measurementSystem);
  const habitAutomations = Array.isArray(settings.habitAutomations)
    ? settings.habitAutomations
        .map((automation, index) => normalizeHabitAutomation(automation, index, parsedHabitDefinitions))
        .filter((automation): automation is HabitAutomation => automation !== null)
    : DEFAULT_SETTINGS.habitAutomations;
  const showUndoNotifications = settings.showUndoNotifications ?? DEFAULT_SETTINGS.showUndoNotifications;

  return {
    dashboardTitle: settings.dashboardTitle?.trim() || DEFAULT_SETTINGS.dashboardTitle,
    masterTodoPath: settings.masterTodoPath?.trim() || DEFAULT_SETTINGS.masterTodoPath,
    projectNotesFolder: normalizeFolderPath(settings.projectNotesFolder?.trim() || DEFAULT_SETTINGS.projectNotesFolder),
    dailyLogFolder: settings.dailyLogFolder?.trim() || DEFAULT_SETTINGS.dailyLogFolder,
    weeklyReportFolder: settings.weeklyReportFolder?.trim() || DEFAULT_SETTINGS.weeklyReportFolder,
    monthlyReportFolder: settings.monthlyReportFolder?.trim() || DEFAULT_SETTINGS.monthlyReportFolder,
    exportFolder: normalizeFolderPath(settings.exportFolder?.trim() || DEFAULT_SETTINGS.exportFolder),
    aiApiKey: settings.aiApiKey?.trim() || DEFAULT_SETTINGS.aiApiKey,
    aiApiKeySource,
    aiApiKeyEnvVar: settings.aiApiKeyEnvVar?.trim() || DEFAULT_SETTINGS.aiApiKeyEnvVar,
    aiModel: settings.aiModel?.trim() || DEFAULT_SETTINGS.aiModel,
    aiBaseUrl: settings.aiBaseUrl?.trim() || DEFAULT_SETTINGS.aiBaseUrl,
    aiOutputFolder: normalizeFolderPath(settings.aiOutputFolder?.trim() || DEFAULT_SETTINGS.aiOutputFolder),
    aiPromptTemplates: typeof settings.aiPromptTemplates === "string" ? settings.aiPromptTemplates : DEFAULT_SETTINGS.aiPromptTemplates,
    aiContextDays: clamp(Number(settings.aiContextDays ?? DEFAULT_SETTINGS.aiContextDays), 3, 60),
    aiRelatedNotesLimit: clamp(Number(settings.aiRelatedNotesLimit ?? DEFAULT_SETTINGS.aiRelatedNotesLimit), 2, 16),
    aiIndexEnabled: settings.aiIndexEnabled ?? DEFAULT_SETTINGS.aiIndexEnabled,
    aiIndexedFolders: typeof settings.aiIndexedFolders === "string" ? settings.aiIndexedFolders : DEFAULT_SETTINGS.aiIndexedFolders,
    aiChunkCharLimit: clamp(Number(settings.aiChunkCharLimit ?? DEFAULT_SETTINGS.aiChunkCharLimit), 300, 3000),
    aiEmbeddingsEnabled: settings.aiEmbeddingsEnabled ?? DEFAULT_SETTINGS.aiEmbeddingsEnabled,
    aiEmbeddingModel: settings.aiEmbeddingModel?.trim() || DEFAULT_SETTINGS.aiEmbeddingModel,
    aiEmbeddingApiUrl: settings.aiEmbeddingApiUrl?.trim() || DEFAULT_SETTINGS.aiEmbeddingApiUrl,
    calendarEnabled: settings.calendarEnabled ?? DEFAULT_SETTINGS.calendarEnabled,
    calendarDocumentPath: settings.calendarDocumentPath?.trim() || DEFAULT_SETTINGS.calendarDocumentPath,
    calendarLookaheadHours,
    calendarWarningHours,
    measurementSystem,
    intakeQuickPresets,
    habitAutomations,
    showUndoNotifications,
    wallpaperFolder: normalizeFolderPath(settings.wallpaperFolder?.trim() || DEFAULT_SETTINGS.wallpaperFolder),
    selectedWallpaper: settings.selectedWallpaper?.trim() || DEFAULT_SETTINGS.selectedWallpaper,
    habitDefinitions: parsedHabitDefinitions.length > 0 ? parsedHabitDefinitions : DEFAULT_SETTINGS.habitDefinitions,
    routineTemplates: typeof settings.routineTemplates === "string" ? settings.routineTemplates : DEFAULT_SETTINGS.routineTemplates
  };
}

export function normalizeFolderPath(value: string): string {
  const normalized = normalizePath(value.trim());
  return normalized.replace(/\/+$/g, "");
}

export function createEmptyNoteIndexCache(): NoteIndexCache {
  return {
    version: 1,
    indexedAt: "",
    lastIndexedFile: "",
    entries: {}
  };
}

export function normalizeNoteIndexCache(cache: Partial<NoteIndexCache> | undefined): NoteIndexCache {
  const entries = Object.fromEntries(
    Object.entries(cache?.entries ?? {}).reduce<Array<[string, NoteIndexEntry]>>((result, [path, entry]) => {
      if (!entry || typeof entry !== "object") {
        return result;
      }

      const normalizedChunks = Array.isArray(entry.chunks)
        ? entry.chunks
            .filter((chunk): chunk is NoteIndexChunk => Boolean(chunk && typeof chunk === "object" && typeof chunk.text === "string"))
            .map((chunk, index) => ({
              id: typeof chunk.id === "string" ? chunk.id : `${normalizePath(path)}#${index + 1}`,
              heading: typeof chunk.heading === "string" ? chunk.heading : "",
              text: chunk.text,
              keywords: Array.isArray(chunk.keywords) ? chunk.keywords.filter((item): item is string => typeof item === "string") : extractKeywords(chunk.text),
              embedding: Array.isArray(chunk.embedding)
                ? chunk.embedding.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
                : undefined
            }))
        : [];

      result.push([normalizePath(path), {
        path: normalizePath(path),
        mtime: Number(entry.mtime ?? 0),
        size: Number(entry.size ?? 0),
        title: typeof entry.title === "string" ? entry.title : normalizePath(path).split("/").pop() ?? normalizePath(path),
        keywords: Array.isArray(entry.keywords) ? entry.keywords.filter((item): item is string => typeof item === "string") : [],
        chunks: normalizedChunks
      }]);
      return result;
    }, [])
  );

  return {
    version: 1,
    indexedAt: typeof cache?.indexedAt === "string" ? cache.indexedAt : "",
    lastIndexedFile: typeof cache?.lastIndexedFile === "string" ? cache.lastIndexedFile : "",
    entries
  };
}

export function getIndexedFolderList(settings: DashboardSettings): string[] {
  return settings.aiIndexedFolders
    .split(/\r?\n/)
    .map((item) => normalizeFolderPath(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

export function shouldRebuildAiIndex(previous: DashboardSettings, next: DashboardSettings): boolean {
  return previous.aiIndexEnabled !== next.aiIndexEnabled
    || previous.aiIndexedFolders !== next.aiIndexedFolders
    || previous.aiChunkCharLimit !== next.aiChunkCharLimit
    || previous.aiEmbeddingsEnabled !== next.aiEmbeddingsEnabled
    || previous.aiEmbeddingModel !== next.aiEmbeddingModel
    || previous.masterTodoPath !== next.masterTodoPath;
}

export function shouldIndexFilePath(path: string, settings: DashboardSettings): boolean {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath.endsWith(".md")) {
    return false;
  }

  if (shouldExcludeAiContextFile(normalizedPath, settings)) {
    return false;
  }

  if (normalizedPath === normalizePath(settings.masterTodoPath)) {
    return true;
  }

  const folders = getIndexedFolderList(settings);
  return folders.some((folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`));
}

export function buildNoteIndexEntry(file: TFile, content: string, chunkCharLimit: number): NoteIndexEntry {
  const normalizedPath = normalizePath(file.path);
  const chunks = chunkMarkdownForIndex(content, chunkCharLimit).map((chunk, index) => ({
    id: `${normalizedPath}#${index + 1}`,
    heading: chunk.heading,
    text: chunk.text,
    keywords: extractKeywords(`${chunk.heading}\n${chunk.text}`)
  }));

  return {
    path: normalizedPath,
    mtime: file.stat.mtime,
    size: file.stat.size,
    title: file.basename,
    keywords: extractKeywords(`${file.basename}\n${content.slice(0, 2000)}`),
    chunks
  };
}

export function chunkMarkdownForIndex(content: string, chunkCharLimit: number): Array<{ heading: string; text: string }> {
  const lines = content.split(/\r?\n/);
  const chunks: Array<{ heading: string; text: string }> = [];
  let heading = "";
  let buffer: string[] = [];

  const flush = (): void => {
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

export function extractKeywords(value: string): string[] {
  const stopWords = new Set(["the", "and", "for", "that", "with", "this", "from", "have", "your", "into", "about", "were", "when", "what", "will", "then", "them", "they", "been", "there", "their", "just", "over", "more", "than", "also", "note", "notes"]);
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  return Array.from(new Set(tokens)).slice(0, 80);
}

export function getRelevantIndexedNotes(
  noteIndex: NoteIndexCache,
  terms: string[],
  queryEmbedding: number[] | null,
  settings: DashboardSettings,
  activeFilePath: string,
  includeActiveNote: boolean,
  limit: number
): AiRelevantNote[] {
  const candidates: AiRelevantNote[] = [];

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
        excerpt: truncateText(`${chunk.heading ? `${chunk.heading}\n` : ""}${chunk.text}`, 1200),
        score: chunkScore
      });
    });
  });

  const bestByPath = new Map<string, AiRelevantNote>();
  candidates
    .sort((left, right) => right.score - left.score)
    .forEach((candidate) => {
      if (!bestByPath.has(candidate.path)) {
        bestByPath.set(candidate.path, candidate);
      }
    });

  return Array.from(bestByPath.values()).slice(0, limit);
}

export function scoreIndexedEntry(entry: NoteIndexEntry, terms: string[], settings: DashboardSettings, activeFilePath: string, includeActiveNote: boolean): number {
  let score = 0;
  const path = entry.path.toLowerCase();
  const projectNotesFolder = normalizeFolderPath(settings.projectNotesFolder).toLowerCase();
  if (includeActiveNote && entry.path === normalizePath(activeFilePath)) {
    score += 80;
  }
  if (entry.path === normalizePath(settings.masterTodoPath)) {
    score += 30;
  }
  if (projectNotesFolder && path.startsWith(projectNotesFolder)) {
    score += 16;
  }
  score += terms.reduce((sum, term) => sum + (path.includes(term) ? 4 : 0), 0);
  score += terms.reduce((sum, term) => sum + (entry.keywords.includes(term) ? 3 : 0), 0);
  return score;
}

export function scoreIndexedChunk(chunk: NoteIndexChunk, terms: string[], queryEmbedding: number[] | null): number {
  const haystack = `${chunk.heading}\n${chunk.text}`.toLowerCase();
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

  const semanticScore = queryEmbedding && Array.isArray(chunk.embedding) && chunk.embedding.length > 0
    ? cosineSimilarity(queryEmbedding, chunk.embedding) * 40
    : 0;

  return keywordScore + semanticScore;
}

export function cosineSimilarity(left: number[], right: number[]): number {
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

export function createEmptyEntry(date: string, habits: HabitDefinition[]): DailyEntry {
  const habitValues = Object.fromEntries(habits.map((habit) => [habit.id, 0]));
  const habitEvents = Object.fromEntries(habits.map((habit) => [habit.id, [] as string[]]));
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
    poopQualityByStart: {},
    completedTasks: []
  };
}

export function normalizeDayState(dayState: Partial<DayLifecycleState> | undefined, entries: Record<string, DailyEntry>): DayLifecycleState {
  const fallbackDate = Object.keys(entries).sort().slice(-1)[0] ?? formatDateKey(new Date());
  const activeDate = typeof dayState?.activeDate === "string" && dayState.activeDate.trim().length > 0
    ? dayState.activeDate
    : fallbackDate;
  const status = dayState?.status === "in-progress" || dayState?.status === "ended"
    ? dayState.status
    : "not-started";

  return {
    activeDate,
    status,
    lastInactivityPromptActivityAt: typeof dayState?.lastInactivityPromptActivityAt === "string" ? dayState.lastInactivityPromptActivityAt : "",
    lastLateNightWarningKey: typeof dayState?.lastLateNightWarningKey === "string" ? dayState.lastLateNightWarningKey : ""
  };
}

export function normalizeTodayFocusStatus(value: unknown): TodayFocusStatus {
  return value === "working" || value === "done" ? value : "pending";
}

export function normalizeTodayFocusItems(value: unknown): TodayFocusItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeTodayFocusItem(item))
    .filter((item): item is TodayFocusItem => item !== null)
    .slice(0, 3);
}

export function normalizeNextUpFocusItems(value: unknown): NextUpFocusItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeNextUpFocusItem(item))
    .filter((item): item is NextUpFocusItem => item !== null)
    .slice(0, 9);
}

export function getTodayFocusTexts(items: TodayFocusItem[]): string[] {
  return items.map((item) => item.text);
}

function normalizeTodayFocusItem(value: unknown): TodayFocusItem | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0
      ? { text, notes: "", estimateMinutes: null, status: "pending", workSessions: [], completedAt: null }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const rawItem = value as Partial<TodayFocusItem> & { text?: unknown; workSessions?: unknown };
  const text = typeof rawItem.text === "string" ? rawItem.text.trim() : "";
  if (!text) {
    return null;
  }

  const workSessions = Array.isArray(rawItem.workSessions)
    ? rawItem.workSessions
        .filter((item): item is { start: string; end?: string | null; tag?: string } => Boolean(item && typeof item === "object" && typeof item.start === "string"))
        .map((item) => ({
          start: item.start,
          end: typeof item.end === "string" ? item.end : null,
          tag: typeof item.tag === "string" ? item.tag.trim() : ""
        }))
    : [];

  return {
    text,
    notes: typeof rawItem.notes === "string" ? rawItem.notes.trim() : "",
    estimateMinutes: Number.isFinite(Number(rawItem.estimateMinutes)) && Number(rawItem.estimateMinutes) > 0 ? Math.round(Number(rawItem.estimateMinutes)) : null,
    status: normalizeTodayFocusStatus(rawItem.status),
    workSessions,
    completedAt: typeof rawItem.completedAt === "string" && rawItem.completedAt.trim().length > 0 ? rawItem.completedAt : null
  };
}

function normalizeNextUpFocusItem(value: unknown): NextUpFocusItem | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text.length > 0
      ? { text, notes: "", estimateMinutes: null }
      : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const rawItem = value as Partial<NextUpFocusItem> & { text?: unknown };
  const text = typeof rawItem.text === "string" ? rawItem.text.trim() : "";
  if (!text) {
    return null;
  }

  return {
    text,
    notes: typeof rawItem.notes === "string" ? rawItem.notes.trim() : "",
    estimateMinutes: Number.isFinite(Number(rawItem.estimateMinutes)) && Number(rawItem.estimateMinutes) > 0 ? Math.round(Number(rawItem.estimateMinutes)) : null
  };
}

export function parseHabitDefinitions(value: string): HabitDefinition[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return DEFAULT_SETTINGS.habitDefinitions;
  }

  return lines.map((line) => {
    const [rawLabel, rawTarget, rawWindow, rawCadence, rawWeight, rawAnchorDate] = line.split("|");
    const label = rawLabel?.trim() || "Habit";
    const target = clamp(Number(rawTarget?.trim() || 1), 1, 12);
    return {
      id: createHabitId(label),
      label,
      target,
      completionWindow: normalizeHabitWindow(rawWindow),
      cadence: normalizeHabitCadence(rawCadence),
      difficultyWeight: clamp(Number(rawWeight?.trim() || 1), 1, 3),
      anchorDate: normalizeHabitAnchorDate(rawAnchorDate)
    };
  });
}

export function normalizeHabitCadence(value: unknown): HabitCadence {
  return value === "every-other-day" || value === "weekly"
    ? value
    : "daily";
}

export function normalizeHabitAnchorDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim()
    : "";
}

export function isHabitDueOnDate(habit: HabitDefinition, date: string): boolean {
  if (habit.cadence === "daily") {
    return true;
  }

  const anchorDate = normalizeHabitAnchorDate(habit.anchorDate) || date;
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(anchor.getTime()) || Number.isNaN(target.getTime())) {
    return true;
  }

  const dayDifference = Math.floor((target.getTime() - anchor.getTime()) / 86_400_000);
  if (dayDifference < 0) {
    return false;
  }

  if (habit.cadence === "every-other-day") {
    return dayDifference % 2 === 0;
  }

  return dayDifference % 7 === 0;
}

export function formatHabitCadenceLabel(cadence: HabitCadence): string {
  if (cadence === "every-other-day") {
    return "Every other day";
  }

  return cadence === "weekly" ? "Weekly" : "Daily";
}

export function normalizeHabitWindow(value: unknown): HabitCompletionWindow {
  return value === "morning" || value === "afternoon" || value === "evening" || value === "before-bed"
    ? value
    : "anytime";
}

export function formatHabitWindowLabel(window: HabitCompletionWindow): string {
  return window === "before-bed"
    ? "Before bed"
    : `${window.charAt(0).toUpperCase()}${window.slice(1)}`;
}

export function getHabitWeightedCompletion(entry: DailyEntry, definitions: HabitDefinition[]): { completed: number; target: number; percentage: number } {
  const completed = definitions.reduce((sum, definition) => {
    if (!isHabitDueOnDate(definition, entry.date)) {
      return sum;
    }

    const capped = Math.min(entry.habits[definition.id] ?? 0, definition.target);
    return sum + (capped * definition.difficultyWeight);
  }, 0);
  const target = definitions.reduce((sum, definition) => {
    if (!isHabitDueOnDate(definition, entry.date)) {
      return sum;
    }

    return sum + (definition.target * definition.difficultyWeight);
  }, 0);
  return {
    completed,
    target,
    percentage: target > 0 ? Math.round((completed / target) * 100) : 0
  };
}

export function countHabitEventsInWindow(events: string[], window: HabitCompletionWindow): number {
  if (window === "anytime") {
    return events.length;
  }

  return events.filter((timestamp) => isTimestampInHabitWindow(timestamp, window)).length;
}

export function isTimestampInHabitWindow(timestamp: string, window: HabitCompletionWindow): boolean {
  if (window === "anytime") {
    return true;
  }

  const hour = Number(timestamp.slice(11, 13));
  if (!Number.isFinite(hour)) {
    return false;
  }

  if (window === "morning") {
    return hour >= 5 && hour < 12;
  }
  if (window === "afternoon") {
    return hour >= 12 && hour < 17;
  }
  if (window === "evening") {
    return hour >= 17 && hour < 22;
  }

  return hour >= 22 || hour < 3;
}

export function createHabitId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "habit";
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (Number.isNaN(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTimeKey(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}

export function formatPreciseDateTimeKey(date: Date): string {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}:${seconds}`;
}

export function formatSyncTimestamp(value: string): string {
  return value.trim().length > 0 ? value : "Not yet";
}

export function formatFileTimestamp(date: Date): string {
  return formatDateTimeKey(date).replace(/[: ]/g, "-");
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 18)).trimEnd()}\n\n[truncated]`;
}

export function stripJsonCodeBlocks(value: string): string {
  return value.replace(/```json\s*[\s\S]*?```/gi, "").trim();
}

export function extractAiStructuredPayload(value: string): AiStructuredPayload {
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

export function extractAiSummary(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return lines[0] ?? "AI note generated.";
}

export function renderTodoSnapshotForAi(snapshot: TodoSnapshot | null): string {
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
      project.overdueTasks.length > 0 ? `  overdue: ${project.overdueTasks.slice(0, 2).map((task) => `${task.text}${task.dueDate ? ` (${task.dueDate})` : ""}`).join(" | ")}` : "",
      project.blockedTasks.length > 0 ? `  blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" | ")}` : "",
      project.nowTasks.length > 0 ? `  now: ${project.nowTasks.slice(0, 3).join(" | ")}` : "",
      project.nextTasks.length > 0 ? `  next: ${project.nextTasks.slice(0, 3).join(" | ")}` : ""
    ].filter((line) => line.length > 0).join("\n"));

  const staleLines = snapshot.staleProjects.slice(0, 6)
    .map((project) => `- ${project.name}: ${project.staleDays} stale days`);

  const cleanupLines = snapshot.cleanupSuggestions.slice(0, 8).map((item) => `- ${item.summary}`);
  const dueLines = snapshot.overdueTasks.slice(0, 6)
    .map((item) => `- ${item.project}: ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`);
  const blockedLines = snapshot.blockedTasks.slice(0, 6)
    .map((item) => `- ${item.project}: ${item.task.text}${item.task.blockedReason ? ` (${item.task.blockedReason})` : ""}`);

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
    "Overdue tasks:",
    ...(dueLines.length > 0 ? dueLines : ["- None"]),
    "",
    "Blocked tasks:",
    ...(blockedLines.length > 0 ? blockedLines : ["- None"]),
    "",
    "Cleanup suggestions:",
    ...(cleanupLines.length > 0 ? cleanupLines : ["- None"])
  ].join("\n");
}

export function renderRoutineSignalsForAi(entries: DailyEntry[], habits: HabitDefinition[]): string {
  if (entries.length === 0) {
    return "No recent routine data available.";
  }

  const habitLines = habits.map((habit) => {
    const timestamps = entries.flatMap((entry) => entry.habitEvents[habit.id] ?? []).map((item) => item.slice(11));
    const dueEntries = entries.filter((entry) => isHabitDueOnDate(habit, entry.date));
    const averageCount = ((dueEntries.reduce((sum, entry) => sum + (entry.habits[habit.id] ?? 0), 0)) / Math.max(dueEntries.length, 1)).toFixed(1);
    const missNotes = entries.map((entry) => entry.habitMissNotes[habit.id]).filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

export function renderAiRelevantNotes(notes: AiRelevantNote[]): string {
  if (notes.length === 0) {
    return "No relevant vault notes were selected.";
  }

  return notes.map((note) => [
    `### ${note.path}`,
    `Reason: ${note.reason}`,
    note.excerpt
  ].join("\n")).join("\n\n");
}

export function buildAiSearchTerms(question: string | undefined, todayEntry: DailyEntry, snapshot: TodoSnapshot | null): string[] {
  const rawTerms = [
    ...(question ? question.toLowerCase().split(/[^a-z0-9]+/) : []),
    ...getTodayFocusTexts(todayEntry.todayFocus).flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/)),
    ...(snapshot?.projects.slice(0, 8).flatMap((project) => project.name.toLowerCase().split(/[^a-z0-9]+/)) ?? [])
  ];

  return Array.from(new Set(rawTerms.filter((term) => term.length >= 3))).slice(0, 32);
}

export function shouldExcludeAiContextFile(path: string, settings: DashboardSettings): boolean {
  const normalizedPath = normalizePath(path);
  const excludedPrefixes = [
    normalizeFolderPath(settings.aiOutputFolder),
    normalizeFolderPath(settings.dailyLogFolder),
    normalizeFolderPath(settings.weeklyReportFolder),
    normalizeFolderPath(settings.monthlyReportFolder)
  ].filter((prefix) => prefix.length > 0);

  return excludedPrefixes.some((prefix) => normalizedPath.startsWith(`${prefix}/`) || normalizedPath === prefix);
}

export function scoreNotePathForAi(file: TFile, terms: string[], settings: DashboardSettings, activeFilePath: string): number {
  let score = 0;
  const path = normalizePath(file.path).toLowerCase();
  const projectNotesFolder = normalizeFolderPath(settings.projectNotesFolder).toLowerCase();
  if (normalizePath(file.path) === normalizePath(activeFilePath)) {
    score += 80;
  }
  if (projectNotesFolder && path.startsWith(projectNotesFolder)) {
    score += 18;
  }
  if (path === normalizePath(settings.masterTodoPath).toLowerCase()) {
    score += 28;
  }
  score += scoreTextForAi(path, terms) * 3;
  score += Math.max(0, 10 - Math.floor((Date.now() - file.stat.mtime) / 86_400_000));
  return score;
}

export function scoreTextForAi(value: string, terms: string[]): number {
  const normalized = value.toLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

export function deriveAiNoteReason(path: string, settings: DashboardSettings, activeFilePath: string, includeActiveNote: boolean, terms: string[]): string {
  const normalizedPath = normalizePath(path);
  if (includeActiveNote && normalizedPath === normalizePath(activeFilePath)) {
    return "Currently active note";
  }
  if (normalizedPath === normalizePath(settings.masterTodoPath)) {
    return "Master task hub";
  }
  if (normalizedPath.startsWith(`${normalizeFolderPath(settings.projectNotesFolder)}/`)) {
    return "Project note matched current context";
  }
  const matchedTerms = terms.filter((term) => normalizedPath.toLowerCase().includes(term)).slice(0, 3);
  return matchedTerms.length > 0 ? `Matched terms: ${matchedTerms.join(", ")}` : "Recent relevant vault note";
}

export function normalizeFoodEntry(input: unknown): FoodEntry | null {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? { text: trimmed, amount: 1, loggedAt: "" } : null;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<FoodEntry>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  if (!text) {
    return null;
  }

  return {
    text,
    amount: clamp(Number(candidate.amount ?? 1), 0.1, 9999),
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}

export function foodEntryToIntakeEntry(entry: FoodEntry): IntakeEntry {
  return {
    kind: "food",
    label: entry.text,
    amount: entry.amount,
    unit: entry.amount === 1 ? "serving" : "servings",
    note: "",
    loggedAt: entry.loggedAt
  };
}

export function normalizeIntakeEntry(input: unknown): IntakeEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<IntakeEntry>;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  if (!label) {
    return null;
  }

  return {
    kind: candidate.kind === "food" || candidate.kind === "medication" || candidate.kind === "supplement" || candidate.kind === "drink"
      ? candidate.kind
      : candidate.kind === "caffeine" || candidate.kind === "water"
        ? "drink"
        : "drink",
    label,
    amount: clamp(Number(candidate.amount ?? 1), 0.1, 9999),
    unit: typeof candidate.unit === "string" && candidate.unit.trim().length > 0 ? candidate.unit.trim() : "serving",
    note: typeof candidate.note === "string" ? candidate.note.trim() : "",
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}

export function normalizeSymptomEntry(input: unknown): SymptomEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<SymptomEntry>;
  const symptom = typeof candidate.symptom === "string" ? candidate.symptom.trim() : "";
  if (!symptom) {
    return null;
  }

  return {
    symptom,
    severity: clamp(Math.round(Number(candidate.severity ?? 1)), 1, 5),
    note: typeof candidate.note === "string" ? candidate.note.trim() : "",
    loggedAt: typeof candidate.loggedAt === "string" ? candidate.loggedAt : ""
  };
}

export function getEntryRecencyKey(entry: Partial<DailyEntry> | undefined): string {
  if (!entry) {
    return "";
  }

  const timestamps = [
    typeof entry.lastEditedAt === "string" ? entry.lastEditedAt : "",
    typeof entry.dayStartedAt === "string" ? entry.dayStartedAt : "",
    typeof entry.dayEndedAt === "string" ? entry.dayEndedAt : "",
    typeof entry.wakeTime === "string" ? entry.wakeTime : "",
    ...(Array.isArray(entry.energyCheckIns) ? entry.energyCheckIns.map((item) => item.loggedAt) : []),
    typeof entry.sleepTime === "string" ? entry.sleepTime : "",
    ...(Array.isArray(entry.foodLog) ? entry.foodLog.map((item) => item.loggedAt) : []),
    ...(Array.isArray(entry.intakeLog) ? entry.intakeLog.map((item) => item.loggedAt) : []),
    ...(Array.isArray(entry.symptomLog) ? entry.symptomLog.map((item) => item.loggedAt) : []),
    ...(Array.isArray(entry.workSessions) ? entry.workSessions.flatMap((session) => [session.start, session.end ?? ""]) : []),
    ...(Array.isArray(entry.napSessions) ? entry.napSessions.flatMap((session) => [session.start, session.end ?? ""]) : []),
    ...(Array.isArray(entry.relaxSessions) ? entry.relaxSessions.flatMap((session) => [session.start, session.end ?? ""]) : []),
    ...(Array.isArray(entry.breakSessions) ? entry.breakSessions.flatMap((session) => [session.start, session.end ?? ""]) : []),
    ...(Array.isArray(entry.poopSessions) ? entry.poopSessions.flatMap((session) => [session.start, session.end ?? ""]) : []),
    ...(Array.isArray(entry.todayFocus) ? entry.todayFocus.flatMap((item) => [item.completedAt ?? "", ...item.workSessions.flatMap((session) => [session.start, session.end ?? ""])]) : []),
    ...(Array.isArray(entry.completedTasks) ? entry.completedTasks.map((task) => task.archivedAt) : []),
    ...(entry.habitEvents ? Object.values(entry.habitEvents).flatMap((items) => items) : [])
  ].filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value));

  return timestamps.sort().slice(-1)[0] ?? "";
}

export function renderScore(value: number): string {
  return value > 0 ? `${value}/5` : "-";
}

export function computeMissedHabits(habits: Record<string, number>, definitions: HabitDefinition[]): string[] {
  return definitions
    .filter((definition) => (habits[definition.id] ?? 0) < definition.target)
    .map((definition) => definition.label);
}

export function parseRoutineTemplates(value: string): RoutineTemplateDefinition[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines
    .map((line, index) => {
      const [rawLabel, rawStart, rawEnd] = line.split("|").map((item) => item?.trim() ?? "");
      if (!rawLabel || !/^\d{2}:\d{2}$/.test(rawStart) || !/^\d{2}:\d{2}$/.test(rawEnd) || rawStart >= rawEnd) {
        return null;
      }

      return {
        id: createHabitId(`${rawLabel}-${rawStart}-${rawEnd}-${index}`),
        label: rawLabel,
        startTime: rawStart,
        endTime: rawEnd
      };
    })
    .filter((item): item is RoutineTemplateDefinition => item !== null);
}

export function parseAiPromptTemplates(value: string): Record<string, string> {
  const templates: Record<string, string> = {};
  let currentKey = "";
  let buffer: string[] = [];

  const flush = (): void => {
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

export function getDefaultIntakeQuickPresets(measurementSystem: DashboardSettings["measurementSystem"]): IntakeQuickPreset[] {
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

function normalizeIntakeQuickPreset(input: unknown, index: number): IntakeQuickPreset | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<IntakeQuickPreset>;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";
  if (!label || !unit) {
    return null;
  }

  const kind = candidate.kind === "food" || candidate.kind === "medication" || candidate.kind === "supplement" || candidate.kind === "drink"
    ? candidate.kind
    : candidate.kind === "caffeine" || candidate.kind === "water"
      ? "drink"
      : "drink";
  const amount = clamp(Number(candidate.amount ?? 1), 0.1, 9999);
  const baseId = typeof candidate.id === "string" && candidate.id.trim().length > 0
    ? candidate.id.trim()
    : `${kind}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${amount}-${unit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;

  return {
    id: baseId,
    kind,
    label,
    amount,
    unit
  };
}

export function parseHabitAutomations(value: string, definitions: HabitDefinition[] = DEFAULT_SETTINGS.habitDefinitions): HabitAutomation[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const definitionsById = new Map(definitions.map((definition) => [definition.id.toLowerCase(), definition.id]));
  const definitionsByLabel = new Map(definitions.map((definition) => [definition.label.trim().toLowerCase(), definition.id]));

  return lines
    .map((line, index) => {
      const [rawHabitLabel, rawKind, rawLabel, rawAmount, rawUnit, rawNote] = line.split("|");
      const habitLabel = rawHabitLabel?.trim() ?? "";
      const label = rawLabel?.trim() ?? "";
      const unit = rawUnit?.trim() ?? "";
      if (!habitLabel || !label || !unit) {
        return null;
      }

      const normalizedHabitKey = habitLabel.trim().toLowerCase();
      const habitId = definitionsById.get(normalizedHabitKey)
        ?? definitionsByLabel.get(normalizedHabitKey)
        ?? createHabitId(habitLabel);
      const intakeKind = rawKind?.trim() === "food" || rawKind?.trim() === "medication" || rawKind?.trim() === "supplement" || rawKind?.trim() === "drink"
        ? rawKind.trim()
        : "drink";
      const amount = clamp(Number(rawAmount?.trim() || 1), 0.1, 9999);
      return {
        id: `${habitId}-${intakeKind}-${createHabitId(`${label}-${unit}-${index}`)}`,
        habitId,
        intakeKind,
        label,
        amount,
        unit,
        note: rawNote?.trim() ?? ""
      } satisfies HabitAutomation;
    })
    .filter((automation): automation is HabitAutomation => automation !== null);
}

function normalizeHabitAutomation(input: unknown, index: number, definitions: HabitDefinition[]): HabitAutomation | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<HabitAutomation>;
  const rawHabitId = typeof candidate.habitId === "string" ? candidate.habitId.trim() : "";
  const normalizedHabitKey = rawHabitId.toLowerCase();
  const normalizedHabitSlug = createHabitId(rawHabitId);
  const matchedDefinition = definitions.find((definition) => definition.id.toLowerCase() === normalizedHabitKey
    || definition.label.trim().toLowerCase() === normalizedHabitKey
    || createHabitId(definition.label) === normalizedHabitSlug);
  const habitId = matchedDefinition?.id ?? normalizedHabitSlug;
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";
  if (!habitId || !label || !unit) {
    return null;
  }

  const intakeKind = candidate.intakeKind === "food" || candidate.intakeKind === "medication" || candidate.intakeKind === "supplement" || candidate.intakeKind === "drink"
    ? candidate.intakeKind
    : "drink";
  const amount = clamp(Number(candidate.amount ?? 1), 0.1, 9999);
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : `${habitId}-${intakeKind}-${createHabitId(`${label}-${unit}-${index}`)}`,
    habitId,
    intakeKind,
    label,
    amount,
    unit,
    note: typeof candidate.note === "string" ? candidate.note.trim() : ""
  };
}