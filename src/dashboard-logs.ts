import {
  createEmptyEntry,
  formatDateKey,
  formatDateTimeKey,
  getEntryRecencyKey,
  renderScore
} from "./dashboard-core";
import type { DailyEntry, HabitDefinition, WeeklyReviewInput, WorkSession } from "./dashboard-types";

export function renderDailyLog(entry: DailyEntry, habits: HabitDefinition[]): string {
  const payload = JSON.stringify(entry, null, 2);
  const habitLines = habits.map((habit) => {
    const events = entry.habitEvents[habit.id] ?? [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    return `- ${habit.label}: ${entry.habits[habit.id] ?? 0}/${habit.target}${timing}`;
  });
  const foodLines = entry.foodLog.length > 0
    ? entry.foodLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.text}`)
    : ["- None logged"];
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
    `lastEditedAt: ${entry.lastEditedAt || ""}`,
    `updatedAt: ${entry.lastEditedAt || ""}`,
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
  let currentSection = "";
  let inPayload = false;

  for (; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed.startsWith("## ")) {
      currentSection = trimmed.slice(3).trim().toLowerCase();
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
  return {
    ...baseEntry,
    ...parsedEntry,
    date,
    lastEditedAt: frontmatter.get("lastEditedAt") ?? frontmatter.get("updatedAt") ?? getEntryRecencyKey(parsedEntry),
    dayStartedAt: frontmatter.get("dayStartedAt") ?? (typeof parsedEntry.dayStartedAt === "string" ? parsedEntry.dayStartedAt : ""),
    dayEndedAt: frontmatter.get("dayEndedAt") ?? (typeof parsedEntry.dayEndedAt === "string" ? parsedEntry.dayEndedAt : ""),
    wakeTime: frontmatter.get("wakeTime") ?? (typeof parsedEntry.wakeTime === "string" ? parsedEntry.wakeTime : ""),
    sleepTime: frontmatter.get("sleepTime") ?? (typeof parsedEntry.sleepTime === "string" ? parsedEntry.sleepTime : ""),
    moodScore: Number(frontmatter.get("moodScore") ?? parsedEntry.moodScore ?? 0),
    energyScore: Number(frontmatter.get("energyScore") ?? parsedEntry.energyScore ?? 0),
    habits: parsedEntry.habits ?? baseEntry.habits,
    habitEvents: parsedEntry.habitEvents ?? baseEntry.habitEvents,
    todayFocus: Array.isArray(parsedEntry.todayFocus) ? parsedEntry.todayFocus : baseEntry.todayFocus,
    frictionLog: typeof parsedEntry.frictionLog === "string" ? parsedEntry.frictionLog : baseEntry.frictionLog,
    missedHabits: Array.isArray(parsedEntry.missedHabits) ? parsedEntry.missedHabits : baseEntry.missedHabits,
    foodLog: Array.isArray(parsedEntry.foodLog) ? parsedEntry.foodLog : baseEntry.foodLog,
    sleepLog: typeof parsedEntry.sleepLog === "string" ? parsedEntry.sleepLog : baseEntry.sleepLog,
    dreamLog: typeof parsedEntry.dreamLog === "string" ? parsedEntry.dreamLog : baseEntry.dreamLog,
    notes: typeof parsedEntry.notes === "string" ? parsedEntry.notes : baseEntry.notes,
    workSessions: Array.isArray(parsedEntry.workSessions) ? parsedEntry.workSessions : baseEntry.workSessions,
    napSessions: Array.isArray(parsedEntry.napSessions) ? parsedEntry.napSessions : baseEntry.napSessions,
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

export function getTrackedWorkMinutes(entry: DailyEntry): number {
  return getTrackedMinutes(entry.workSessions);
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