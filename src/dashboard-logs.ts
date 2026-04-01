import {
  createEmptyEntry,
  formatDateKey,
  formatDateTimeKey,
  getTodayFocusTexts,
  getEntryRecencyKey,
  normalizeTodayFocusItems,
  renderScore
} from "./dashboard-core";
import type { DailyEntry, HabitDefinition, TodayFocusItem, WeeklyReviewInput, WorkSession } from "./dashboard-types";

export function renderDailyLog(entry: DailyEntry, habits: HabitDefinition[], nextEntry?: DailyEntry): string {
  const payload = JSON.stringify(entry, null, 2);
  const habitLines = habits.map((habit) => {
    const events = entry.habitEvents[habit.id] ?? [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    return `- ${habit.label}: ${entry.habits[habit.id] ?? 0}/${habit.target}${timing}`;
  });
  const foodLines = entry.foodLog.length > 0
    ? entry.foodLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.amount > 1 ? `${item.amount}x ` : ""}${item.text}`)
    : ["- None logged"];
  const completedTaskLines = entry.completedTasks.length > 0
    ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`)
    : ["- No archived tasks today"];
  const focusLines = entry.todayFocus.length > 0
    ? entry.todayFocus.map((item) => renderTodayFocusLine(item))
    : ["- No focus items set"];
  const workSessionLines = entry.workSessions.length > 0
    ? entry.workSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked work sessions"];
  const napSessionLines = entry.napSessions.length > 0
    ? entry.napSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked naps"];
  const relaxSessionLines = entry.relaxSessions.length > 0
    ? entry.relaxSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked relaxing sessions"];
  const breakSessionLines = entry.breakSessions.length > 0
    ? entry.breakSessions.map((session) => `- ${session.start} -> ${session.end ?? "Still active"}`)
    : ["- No tracked breaks"];
  const totalWorkMinutes = getTrackedWorkMinutes(entry);
  const totalSleepMinutes = getSleepMinutesForDay(entry, nextEntry);
  const totalNapMinutes = getTrackedMinutes(entry.napSessions);
  const totalRelaxMinutes = getTrackedRelaxMinutes(entry);
  const totalBreakMinutes = getTrackedBreakMinutes(entry);

  return [
    "---",
    `date: ${entry.date}`,
    `lastEditedAt: ${entry.lastEditedAt || ""}`,
    `updatedAt: ${entry.lastEditedAt || ""}`,
    `dayStartedAt: ${entry.dayStartedAt || ""}`,
    `dayEndedAt: ${entry.dayEndedAt || ""}`,
    `wakeTime: ${entry.wakeTime || ""}`,
    `sleepTime: ${entry.sleepTime || ""}`,
    `sleepMinutesOverride: ${entry.sleepMinutesOverride ?? ""}`,
    `trackedSleepMinutes: ${totalSleepMinutes}`,
    `trackedWorkMinutes: ${totalWorkMinutes}`,
    `trackedNapMinutes: ${totalNapMinutes}`,
    `trackedRelaxMinutes: ${totalRelaxMinutes}`,
    `trackedBreakMinutes: ${totalBreakMinutes}`,
    `workMinutesOverride: ${entry.workMinutesOverride ?? ""}`,
    `napMinutesOverride: ${entry.napMinutesOverride ?? ""}`,
    `relaxMinutesOverride: ${entry.relaxMinutesOverride ?? ""}`,
    `breakMinutesOverride: ${entry.breakMinutesOverride ?? ""}`,
    `workCompleted: ${entry.completedTasks.length}`,
    `foodEntryCount: ${entry.foodLog.length}`,
    `dreamLogged: ${entry.dreamLog.trim().length > 0}`,
    `moodScore: ${entry.moodScore}`,
    `energyScore: ${entry.energyScore}`,
    `anxietyScore: ${entry.anxietyScore}`,
    "---",
    "",
    `# Daily Dashboard Log - ${entry.date}`,
    "",
    "## Day Flow",
    `- Day started: ${entry.dayStartedAt || "Not started"}`,
    `- Wake time: ${entry.wakeTime || "Not logged"}`,
    `- Day ended: ${entry.dayEndedAt || "Not ended"}`,
    `- Sleep time: ${entry.sleepTime || "Not logged"}`,
    `- Tracked sleep: ${formatMinutesAsHours(totalSleepMinutes)}`,
    `- Tracked work: ${formatMinutesAsHours(totalWorkMinutes)}`,
    `- Tracked naps: ${formatMinutesAsHours(totalNapMinutes)}`,
    `- Tracked relaxing: ${formatMinutesAsHours(totalRelaxMinutes)}`,
    `- Tracked breaks: ${formatMinutesAsHours(totalBreakMinutes)}`,
    "",
    "## Habits",
    ...habitLines,
    "",
    "## Top 3 For Today",
    ...focusLines,
    "",
    "## State",
    `- Mood: ${renderScore(entry.moodScore)}`,
    `- Energy: ${renderScore(entry.energyScore)}`,
    `- Anxiety: ${renderScore(entry.anxietyScore)}`,
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
    "## Relax Sessions",
    ...relaxSessionLines,
    "",
    "## Break Sessions",
    ...breakSessionLines,
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

export function parseDailyLogEntry(content: string, fallbackDate: string, habits: HabitDefinition[]): DailyEntry | null {
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

  const date = frontmatter.get("date") ?? fallbackDate;
  if (!date) {
    return null;
  }

  const payloadLines: string[] = [];
  const focusLines: string[] = [];
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

  let parsedEntry: Partial<DailyEntry> = {};
  if (payloadLines.length > 0) {
    try {
      parsedEntry = JSON.parse(payloadLines.join("\n")) as Partial<DailyEntry>;
    } catch (error) {
      console.warn("Daily Dashboard could not parse daily log payload", error);
    }
  }

  const baseEntry = createEmptyEntry(date, habits);
  const todayFocus = Array.isArray(parsedEntry.todayFocus)
    ? normalizeTodayFocusItems(parsedEntry.todayFocus)
    : focusLines
        .map((line) => parseTodayFocusLine(line))
        .filter((item): item is TodayFocusItem => item !== null)
        .slice(0, 3);

  return {
    ...baseEntry,
    ...parsedEntry,
    date,
    lastEditedAt: frontmatter.get("lastEditedAt") ?? frontmatter.get("updatedAt") ?? getEntryRecencyKey(parsedEntry),
    dayStartedAt: frontmatter.get("dayStartedAt") ?? (typeof parsedEntry.dayStartedAt === "string" ? parsedEntry.dayStartedAt : ""),
    dayEndedAt: frontmatter.get("dayEndedAt") ?? (typeof parsedEntry.dayEndedAt === "string" ? parsedEntry.dayEndedAt : ""),
    wakeTime: frontmatter.get("wakeTime") ?? (typeof parsedEntry.wakeTime === "string" ? parsedEntry.wakeTime : ""),
    sleepTime: frontmatter.get("sleepTime") ?? (typeof parsedEntry.sleepTime === "string" ? parsedEntry.sleepTime : ""),
    sleepMinutesOverride: normalizeOptionalMinutes(frontmatter.get("sleepMinutesOverride") ?? parsedEntry.sleepMinutesOverride),
    moodScore: Number(frontmatter.get("moodScore") ?? parsedEntry.moodScore ?? 0),
    energyScore: Number(frontmatter.get("energyScore") ?? parsedEntry.energyScore ?? 0),
    anxietyScore: Number(frontmatter.get("anxietyScore") ?? parsedEntry.anxietyScore ?? 0),
    habits: parsedEntry.habits ?? baseEntry.habits,
    habitEvents: parsedEntry.habitEvents ?? baseEntry.habitEvents,
    todayFocus,
    frictionLog: typeof parsedEntry.frictionLog === "string" ? parsedEntry.frictionLog : baseEntry.frictionLog,
    missedHabits: Array.isArray(parsedEntry.missedHabits) ? parsedEntry.missedHabits : baseEntry.missedHabits,
    foodLog: Array.isArray(parsedEntry.foodLog) ? parsedEntry.foodLog : baseEntry.foodLog,
    sleepLog: typeof parsedEntry.sleepLog === "string" ? parsedEntry.sleepLog : baseEntry.sleepLog,
    dreamLog: typeof parsedEntry.dreamLog === "string" ? parsedEntry.dreamLog : baseEntry.dreamLog,
    notes: typeof parsedEntry.notes === "string" ? parsedEntry.notes : baseEntry.notes,
    workSessions: Array.isArray(parsedEntry.workSessions) ? parsedEntry.workSessions : baseEntry.workSessions,
    workMinutesOverride: normalizeOptionalMinutes(frontmatter.get("workMinutesOverride") ?? parsedEntry.workMinutesOverride),
    napSessions: Array.isArray(parsedEntry.napSessions) ? parsedEntry.napSessions : baseEntry.napSessions,
    napMinutesOverride: normalizeOptionalMinutes(frontmatter.get("napMinutesOverride") ?? parsedEntry.napMinutesOverride),
    relaxSessions: Array.isArray(parsedEntry.relaxSessions) ? parsedEntry.relaxSessions : baseEntry.relaxSessions,
    relaxMinutesOverride: normalizeOptionalMinutes(frontmatter.get("relaxMinutesOverride") ?? parsedEntry.relaxMinutesOverride),
    breakSessions: Array.isArray(parsedEntry.breakSessions) ? parsedEntry.breakSessions : baseEntry.breakSessions,
    breakMinutesOverride: normalizeOptionalMinutes(frontmatter.get("breakMinutesOverride") ?? parsedEntry.breakMinutesOverride),
    completedTasks: Array.isArray(parsedEntry.completedTasks) ? parsedEntry.completedTasks : baseEntry.completedTasks
  };
}

export function renderPeriodReport(input: {
  title: string;
  rangeLabel: string;
  entries: DailyEntry[];
  habitDefinitions: HabitDefinition[];
}): string {
  const workByProject = new Map<string, number>();
  let daysWithFood = 0;
  let daysWithSleep = 0;
  let daysWithDreams = 0;
  let moodTotal = 0;
  let moodDays = 0;
  let energyTotal = 0;
  let energyDays = 0;
  let anxietyTotal = 0;
  let anxietyDays = 0;
  let trackedWorkMinutes = 0;
  let trackedNapMinutes = 0;
  let trackedRelaxMinutes = 0;
  let trackedBreakMinutes = 0;
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

    if (entry.anxietyScore > 0) {
      anxietyTotal += entry.anxietyScore;
      anxietyDays += 1;
    }

    trackedWorkMinutes += getTrackedWorkMinutes(entry);
    trackedNapMinutes += getTrackedMinutes(entry.napSessions);
    trackedRelaxMinutes += getTrackedRelaxMinutes(entry);
    trackedBreakMinutes += getTrackedBreakMinutes(entry);
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
    const trackedNapMinutesForEntry = getTrackedNapMinutes(entry);
    const napSummary = trackedNapMinutesForEntry > 0 ? `${formatMinutesAsHours(trackedNapMinutesForEntry)} naps` : "no naps";
    const dreamSummary = entry.dreamLog.trim().length > 0 ? "dream logged" : "no dream log";
    const relaxSummary = entry.relaxSessions.length > 0 || entry.breakSessions.length > 0
      ? `${formatMinutesAsHours(getTrackedRelaxMinutes(entry) + getTrackedBreakMinutes(entry))} relaxed`
      : "no relax tracked";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, ${napSummary}, ${relaxSummary}, ${dreamSummary}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}, anxiety ${renderScore(entry.anxietyScore)}`;
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
    `- Tracked relaxing time: ${formatMinutesAsHours(trackedRelaxMinutes + trackedBreakMinutes)}`,
    `- Average mood: ${moodDays > 0 ? `${(moodTotal / moodDays).toFixed(1)}/5` : "No mood data"}`,
    `- Average energy: ${energyDays > 0 ? `${(energyTotal / energyDays).toFixed(1)}/5` : "No energy data"}`,
    `- Average anxiety: ${anxietyDays > 0 ? `${(anxietyTotal / anxietyDays).toFixed(1)}/5` : "No anxiety data"}`,
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

export function closeOpenWorkSessions(entry: DailyEntry, timestamp: string): void {
  entry.workSessions = entry.workSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

export function closeOpenNapSessions(entry: DailyEntry, timestamp: string): void {
  entry.napSessions = entry.napSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

export function closeOpenRelaxSessions(entry: DailyEntry, timestamp: string): void {
  entry.relaxSessions = entry.relaxSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

export function closeOpenBreakSessions(entry: DailyEntry, timestamp: string): void {
  entry.breakSessions = entry.breakSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
}

export function getTrackedWorkMinutes(entry: DailyEntry): number {
  return resolveTrackedMinutes(entry.workSessions, entry.workMinutesOverride);
}

export function getTrackedNapMinutes(entry: DailyEntry): number {
  return resolveTrackedMinutes(entry.napSessions, entry.napMinutesOverride);
}

export function getTrackedRelaxMinutes(entry: DailyEntry): number {
  return resolveTrackedMinutes(entry.relaxSessions, entry.relaxMinutesOverride);
}

export function getTrackedBreakMinutes(entry: DailyEntry): number {
  return resolveTrackedMinutes(entry.breakSessions, entry.breakMinutesOverride);
}

function resolveTrackedMinutes(sessions: WorkSession[], override: number | null | undefined): number {
  const trackedMinutes = getTrackedMinutes(sessions);
  if (typeof override === "number" && override >= 0) {
    return override === 0 && trackedMinutes > 0 ? trackedMinutes : override;
  }

  return trackedMinutes;
}

function normalizeOptionalMinutes(value: unknown): number | null {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.round(numericValue);
}

export function getTrackedMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((total, session) => {
    const end = session.end ?? formatDateTimeKey(new Date());
    return total + getMinutesBetween(session.start, end);
  }, 0);
}

export function getMinutesBetween(startValue: string, endValue: string): number {
  const start = parseDateTimeKey(startValue);
  const end = parseDateTimeKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function parseDateTimeKey(value: string): Date | null {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMinutesAsHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

export function renderWeeklyReview(input: WeeklyReviewInput): string {
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const focusItems = Array.from(new Set(input.entries.flatMap((entry) => getTodayFocusTexts(entry.todayFocus)))).slice(0, 10);
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

export function getSleepMinutesForDay(entry: DailyEntry, nextEntry?: DailyEntry): number {
  const napMinutes = getTrackedNapMinutes(entry);
  const derivedSleepMinutes = !entry.sleepTime || !nextEntry?.wakeTime
    ? napMinutes
    : napMinutes + getMinutesBetween(entry.sleepTime, nextEntry.wakeTime);

  if (typeof entry.sleepMinutesOverride === "number" && entry.sleepMinutesOverride >= 0) {
    return entry.sleepMinutesOverride === 0 && derivedSleepMinutes > 0
      ? derivedSleepMinutes
      : entry.sleepMinutesOverride;
  }

  if (!entry.sleepTime || !nextEntry?.wakeTime) {
    return napMinutes;
  }

  return napMinutes + getMinutesBetween(entry.sleepTime, nextEntry.wakeTime);
}

export function getTrackedTodayFocusMinutes(item: TodayFocusItem): number {
  return getTrackedMinutes(item.workSessions);
}

export function isTodayFocusItemActive(item: TodayFocusItem): boolean {
  return item.workSessions.some((session) => session.end === null);
}

function renderTodayFocusLine(item: TodayFocusItem): string {
  const workedMinutes = getTrackedTodayFocusMinutes(item);
  const statusLabel = item.status === "working"
    ? "Working on"
    : item.status === "done"
      ? "Done"
      : "Queued";
  const trackedSuffix = workedMinutes > 0 ? ` (tracked: ${formatMinutesAsHours(workedMinutes)})` : "";
  return `- [${statusLabel}] ${item.text}${trackedSuffix}`;
}

function parseTodayFocusLine(line: string): TodayFocusItem | null {
  const normalized = line.trim();
  if (!normalized || normalized.toLowerCase() === "no focus items set") {
    return null;
  }

  const match = normalized.match(/^\[(?<status>[^\]]+)\]\s+(?<text>.+?)(?:\s+\(tracked:\s+.+\))?$/i);
  const rawStatus = match?.groups?.status?.trim().toLowerCase() ?? "";
  const text = (match?.groups?.text ?? normalized).trim();
  if (!text) {
    return null;
  }

  const status = rawStatus === "working on"
    ? "working"
    : rawStatus === "done"
      ? "done"
      : "pending";

  return {
    text,
    status,
    workSessions: [],
    completedAt: null
  };
}