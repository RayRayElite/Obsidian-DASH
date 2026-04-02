import {
  clamp,
  countHabitEventsInWindow,
  createEmptyEntry,
  formatHabitWindowLabel,
  formatDateKey,
  formatDateTimeKey,
  getHabitWeightedCompletion,
  getTodayFocusTexts,
  getEntryRecencyKey,
  normalizeTodayFocusItems,
  renderScore
} from "./dashboard-core";
import { CHECKLIST_REGEX } from "./dashboard-types";
import type { CalendarEventOccurrence, DailyEntry, GamificationCategoryScore, GamificationSnapshot, GamificationSummary, HabitDefinition, NextUpFocusItem, PersonalTrendSummary, SleepInsights, SleepNightSnapshot, TodayFocusItem, TodoSnapshot, WeeklyReviewInput, WorkSession } from "./dashboard-types";

const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60;
const CALENDAR_FOLLOW_THROUGH_MARKER = "daily-dashboard-calendar-follow:";

export function renderDailyLog(entry: DailyEntry, habits: HabitDefinition[], nextEntry?: DailyEntry, calendarEvents: CalendarEventOccurrence[] = []): string {
  const payload = JSON.stringify(entry, null, 2);
  const habitLines = habits.map((habit) => {
    const events = entry.habitEvents[habit.id] ?? [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    const inWindowCount = countHabitEventsInWindow(events, habit.completionWindow);
    return `- ${habit.label}: ${entry.habits[habit.id] ?? 0}/${habit.target}${timing} • ${formatHabitWindowLabel(habit.completionWindow)} • difficulty ${habit.difficultyWeight}/3 • in window ${inWindowCount}/${events.length || 0}`;
  });
  const habitMissNoteLines = habits
    .filter((habit) => (entry.habitMissNotes[habit.id] ?? "").trim().length > 0)
    .map((habit) => `- ${habit.label}: ${entry.habitMissNotes[habit.id]}`);
  const foodLines = entry.foodLog.length > 0
    ? entry.foodLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.amount > 1 ? `${item.amount}x ` : ""}${item.text}`)
    : ["- None logged"];
  const intakeLines = entry.intakeLog.length > 0
    ? entry.intakeLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.kind} • ${item.amount} ${item.unit} ${item.label}${item.note ? ` - ${item.note}` : ""}`)
    : ["- None logged"];
  const symptomLines = entry.symptomLog.length > 0
    ? entry.symptomLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.symptom} • ${item.severity}/5${item.note ? ` - ${item.note}` : ""}`)
    : ["- None logged"];
  const energyCheckInLines = entry.energyCheckIns.length > 0
    ? entry.energyCheckIns.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.score}/5${item.note ? ` - ${item.note}` : ""}`)
    : ["- No energy check-ins logged"];
  const completedTaskLines = entry.completedTasks.length > 0
    ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`)
    : ["- No archived tasks today"];
  const focusLines = entry.todayFocus.length > 0
    ? entry.todayFocus.map((item) => renderTodayFocusLine(item))
    : ["- No focus items set"];
  const nextUpLines = entry.nextUpFocus.length > 0
    ? entry.nextUpFocus.map((item) => renderNextUpFocusLine(item))
    : ["- No queued items"];
  const workSessionLines = entry.workSessions.length > 0
    ? entry.workSessions.map((session) => renderSessionLine(session))
    : ["- No tracked work sessions"];
  const napSessionLines = entry.napSessions.length > 0
    ? entry.napSessions.map((session) => renderSessionLine(session))
    : ["- No tracked naps"];
  const relaxSessionLines = entry.relaxSessions.length > 0
    ? entry.relaxSessions.map((session) => renderSessionLine(session))
    : ["- No tracked relaxing sessions"];
  const breakSessionLines = entry.breakSessions.length > 0
    ? entry.breakSessions.map((session) => renderSessionLine(session))
    : ["- No tracked breaks"];
  const poopSessionLines = entry.poopSessions.length > 0
    ? entry.poopSessions.map((session) => `${renderSessionLine(session)}${entry.poopQualityByStart[session.start] ? ` • quality ${entry.poopQualityByStart[session.start]}` : ""}`)
    : ["- No tracked bowel movement sessions"];
  const calendarEventLines = calendarEvents.length > 0
    ? calendarEvents.map((event) => renderCalendarEventLine(event))
    : ["- No calendar events"];
  const calendarFollowThroughLines = calendarEvents.length > 0
    ? calendarEvents.map((event) => {
        const checked = entry.calendarFollowThroughCompleted.includes(event.id) ? "x" : " ";
        return `- [${checked}] Follow through on ${event.title} ${renderCalendarEventContextLabel(event)} <!-- ${CALENDAR_FOLLOW_THROUGH_MARKER}${event.id} -->`;
      })
    : ["- No follow-through items"];
  const totalWorkMinutes = getTrackedWorkMinutes(entry);
  const totalSleepMinutes = getSleepMinutesForDay(entry, nextEntry);
  const totalNapMinutes = getTrackedMinutes(entry.napSessions);
  const totalRelaxMinutes = getTrackedRelaxMinutes(entry);
  const totalBreakMinutes = getTrackedBreakMinutes(entry);
  const totalPoopMinutes = getTrackedPoopMinutes(entry);
  const totalPoopCount = getTrackedPoopCount(entry);

  return [
    "---",
    `date: ${entry.date}`,
    `lastEditedAt: ${entry.lastEditedAt || ""}`,
    `updatedAt: ${entry.lastEditedAt || ""}`,
    `dayStartedAt: ${entry.dayStartedAt || ""}`,
    `dayEndedAt: ${entry.dayEndedAt || ""}`,
    `wakeTime: ${entry.wakeTime || ""}`,
    `wakeQualityScore: ${entry.wakeQualityScore}`,
    `sleepTime: ${entry.sleepTime || ""}`,
    `sleepMinutesOverride: ${entry.sleepMinutesOverride ?? ""}`,
    `trackedSleepMinutes: ${totalSleepMinutes}`,
    `trackedWorkMinutes: ${totalWorkMinutes}`,
    `trackedNapMinutes: ${totalNapMinutes}`,
    `trackedRelaxMinutes: ${totalRelaxMinutes}`,
    `trackedBreakMinutes: ${totalBreakMinutes}`,
    `trackedPoopMinutes: ${totalPoopMinutes}`,
    `trackedPoopCount: ${totalPoopCount}`,
    `workMinutesOverride: ${entry.workMinutesOverride ?? ""}`,
    `napMinutesOverride: ${entry.napMinutesOverride ?? ""}`,
    `relaxMinutesOverride: ${entry.relaxMinutesOverride ?? ""}`,
    `breakMinutesOverride: ${entry.breakMinutesOverride ?? ""}`,
    `workCompleted: ${entry.completedTasks.length}`,
    `foodEntryCount: ${entry.foodLog.length}`,
    `intakeEntryCount: ${entry.intakeLog.length}`,
    `symptomEntryCount: ${entry.symptomLog.length}`,
    `energyCheckInCount: ${entry.energyCheckIns.length}`,
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
    `- Wake quality: ${renderScore(entry.wakeQualityScore)}`,
    `- Tracked sleep: ${formatMinutesAsHours(totalSleepMinutes)}`,
    `- Tracked work: ${formatMinutesAsHours(totalWorkMinutes)}`,
    `- Tracked naps: ${formatMinutesAsHours(totalNapMinutes)}`,
    `- Tracked relaxing: ${formatMinutesAsHours(totalRelaxMinutes)}`,
    `- Tracked breaks: ${formatMinutesAsHours(totalBreakMinutes)}`,
    `- Tracked poop: ${formatMinutesAsHours(totalPoopMinutes)}`,
    `- Bowel movements: ${totalPoopCount}`,
    "",
    "## Habits",
    ...habitLines,
    "",
    "## Habit Miss Notes",
    ...(habitMissNoteLines.length > 0 ? habitMissNoteLines : ["- No miss notes yet."]),
    "",
    "## Top 3 For Today",
    ...focusLines,
    "",
    "## Next Up",
    ...nextUpLines,
    "",
    "## Calendar Events",
    ...calendarEventLines,
    "",
    "## Calendar Follow-Through",
    ...calendarFollowThroughLines,
    "",
    "## State",
    `- Mood: ${renderScore(entry.moodScore)}`,
    `- Energy: ${renderScore(entry.energyScore)}`,
    `- Anxiety: ${renderScore(entry.anxietyScore)}`,
    "",
    "## Energy Timeline",
    ...energyCheckInLines,
    "",
    "## Food Log",
    ...foodLines,
    "",
    "## Intake Log",
    ...intakeLines,
    "",
    "## Symptoms And Pain",
    ...symptomLines,
    "",
    "## Diet Insight",
    entry.dietInsight || "No AI nutrition summary yet.",
    "",
    "## Sleep Log",
    entry.sleepLog || "No sleep log yet.",
    "",
    "## Dream Log",
    entry.dreamLog || "No dream log yet.",
    "",
    "## Micro Reflections",
    `- What helped today?: ${entry.helpedToday || "Nothing logged yet."}`,
    `- What hurt today?: ${entry.hurtToday || "Nothing logged yet."}`,
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
    "## Poop Sessions",
    ...poopSessionLines,
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
  const nextUpLines: string[] = [];
  const calendarFollowThroughCompleted = new Set<string>();
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

    if (currentSection === "next up" && trimmed.startsWith("- ")) {
      nextUpLines.push(trimmed.slice(2).trim());
      continue;
    }

    if (currentSection === "calendar follow-through") {
      const markerMatch = lines[index].match(new RegExp(`<!--\\s*${CALENDAR_FOLLOW_THROUGH_MARKER}([^\\s]+)\\s*-->`));
      const checklistMatch = lines[index].match(CHECKLIST_REGEX);
      if (markerMatch && checklistMatch && checklistMatch[1].toLowerCase() === "x") {
        calendarFollowThroughCompleted.add(markerMatch[1]);
      }
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
  const nextUpFocus = Array.isArray(parsedEntry.nextUpFocus)
    ? parsedEntry.nextUpFocus
        .map((item) => parseNextUpFocusItem(typeof item === "string" ? item : renderNextUpFocusLine(item as NextUpFocusItem)))
        .filter((item): item is NextUpFocusItem => item !== null)
    : nextUpLines
        .map((line) => parseNextUpFocusItem(line))
        .filter((item): item is NextUpFocusItem => item !== null);

  return {
    ...baseEntry,
    ...parsedEntry,
    date,
    lastEditedAt: frontmatter.get("lastEditedAt") ?? frontmatter.get("updatedAt") ?? getEntryRecencyKey(parsedEntry),
    dayStartedAt: frontmatter.get("dayStartedAt") ?? (typeof parsedEntry.dayStartedAt === "string" ? parsedEntry.dayStartedAt : ""),
    dayEndedAt: frontmatter.get("dayEndedAt") ?? (typeof parsedEntry.dayEndedAt === "string" ? parsedEntry.dayEndedAt : ""),
    wakeTime: frontmatter.get("wakeTime") ?? (typeof parsedEntry.wakeTime === "string" ? parsedEntry.wakeTime : ""),
    wakeQualityScore: Number(frontmatter.get("wakeQualityScore") ?? parsedEntry.wakeQualityScore ?? 0),
    sleepTime: frontmatter.get("sleepTime") ?? (typeof parsedEntry.sleepTime === "string" ? parsedEntry.sleepTime : ""),
    sleepMinutesOverride: normalizeOptionalMinutes(frontmatter.get("sleepMinutesOverride") ?? parsedEntry.sleepMinutesOverride),
    moodScore: Number(frontmatter.get("moodScore") ?? parsedEntry.moodScore ?? 0),
    energyScore: Number(frontmatter.get("energyScore") ?? parsedEntry.energyScore ?? 0),
    anxietyScore: Number(frontmatter.get("anxietyScore") ?? parsedEntry.anxietyScore ?? 0),
    habits: parsedEntry.habits ?? baseEntry.habits,
    habitEvents: parsedEntry.habitEvents ?? baseEntry.habitEvents,
    todayFocus,
    nextUpFocus,
    calendarFollowThroughCompleted: Array.from(new Set([
      ...(Array.isArray(parsedEntry.calendarFollowThroughCompleted)
        ? parsedEntry.calendarFollowThroughCompleted.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : []),
      ...Array.from(calendarFollowThroughCompleted)
    ])).sort(),
    frictionLog: typeof parsedEntry.frictionLog === "string" ? parsedEntry.frictionLog : baseEntry.frictionLog,
    missedHabits: Array.isArray(parsedEntry.missedHabits) ? parsedEntry.missedHabits : baseEntry.missedHabits,
    habitMissNotes: parsedEntry.habitMissNotes && typeof parsedEntry.habitMissNotes === "object" ? parsedEntry.habitMissNotes : baseEntry.habitMissNotes,
    foodLog: Array.isArray(parsedEntry.foodLog) ? parsedEntry.foodLog : baseEntry.foodLog,
    intakeLog: Array.isArray(parsedEntry.intakeLog) ? parsedEntry.intakeLog : baseEntry.intakeLog,
    symptomLog: Array.isArray(parsedEntry.symptomLog) ? parsedEntry.symptomLog : baseEntry.symptomLog,
    energyCheckIns: Array.isArray(parsedEntry.energyCheckIns) ? parsedEntry.energyCheckIns : baseEntry.energyCheckIns,
    dietInsight: typeof parsedEntry.dietInsight === "string" ? parsedEntry.dietInsight : baseEntry.dietInsight,
    sleepLog: typeof parsedEntry.sleepLog === "string" ? parsedEntry.sleepLog : baseEntry.sleepLog,
    dreamLog: typeof parsedEntry.dreamLog === "string" ? parsedEntry.dreamLog : baseEntry.dreamLog,
    helpedToday: typeof parsedEntry.helpedToday === "string" ? parsedEntry.helpedToday : baseEntry.helpedToday,
    hurtToday: typeof parsedEntry.hurtToday === "string" ? parsedEntry.hurtToday : baseEntry.hurtToday,
    notes: typeof parsedEntry.notes === "string" ? parsedEntry.notes : baseEntry.notes,
    workSessions: Array.isArray(parsedEntry.workSessions) ? parsedEntry.workSessions : baseEntry.workSessions,
    workMinutesOverride: normalizeOptionalMinutes(frontmatter.get("workMinutesOverride") ?? parsedEntry.workMinutesOverride),
    napSessions: Array.isArray(parsedEntry.napSessions) ? parsedEntry.napSessions : baseEntry.napSessions,
    napMinutesOverride: normalizeOptionalMinutes(frontmatter.get("napMinutesOverride") ?? parsedEntry.napMinutesOverride),
    relaxSessions: Array.isArray(parsedEntry.relaxSessions) ? parsedEntry.relaxSessions : baseEntry.relaxSessions,
    relaxMinutesOverride: normalizeOptionalMinutes(frontmatter.get("relaxMinutesOverride") ?? parsedEntry.relaxMinutesOverride),
    breakSessions: Array.isArray(parsedEntry.breakSessions) ? parsedEntry.breakSessions : baseEntry.breakSessions,
    breakMinutesOverride: normalizeOptionalMinutes(frontmatter.get("breakMinutesOverride") ?? parsedEntry.breakMinutesOverride),
    poopSessions: Array.isArray(parsedEntry.poopSessions) ? parsedEntry.poopSessions : baseEntry.poopSessions,
    poopQualityByStart: parsedEntry.poopQualityByStart && typeof parsedEntry.poopQualityByStart === "object" ? parsedEntry.poopQualityByStart : baseEntry.poopQualityByStart,
    completedTasks: Array.isArray(parsedEntry.completedTasks) ? parsedEntry.completedTasks : baseEntry.completedTasks
  };
}

export function renderPeriodReport(input: {
  title: string;
  rangeLabel: string;
  entries: DailyEntry[];
  habitDefinitions: HabitDefinition[];
  todoSnapshot?: TodoSnapshot | null;
}): string {
  const sleepInsights = buildSleepInsights(input.entries, undefined, input.habitDefinitions);
  const personalTrends = buildPersonalTrendSummary(input.entries, input.habitDefinitions);
  const gamification = buildGamificationSummary(input.entries, input.habitDefinitions, input.todoSnapshot ?? null);
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
  let wakeQualityTotal = 0;
  let wakeQualityDays = 0;
  let trackedWorkMinutes = 0;
  let trackedNapMinutes = 0;
  let trackedRelaxMinutes = 0;
  let trackedBreakMinutes = 0;
  let trackedPoopMinutes = 0;
  let trackedPoopCount = 0;
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

    if (entry.wakeQualityScore > 0) {
      wakeQualityTotal += entry.wakeQualityScore;
      wakeQualityDays += 1;
    }

    trackedWorkMinutes += getTrackedWorkMinutes(entry);
    trackedNapMinutes += getTrackedMinutes(entry.napSessions);
    trackedRelaxMinutes += getTrackedRelaxMinutes(entry);
    trackedBreakMinutes += getTrackedBreakMinutes(entry);
    trackedPoopMinutes += getTrackedPoopMinutes(entry);
    trackedPoopCount += getTrackedPoopCount(entry);
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
    const trackedSleepMinutesForEntry = getSleepMinutesForDay(entry, input.entries.find((candidate) => candidate.date > entry.date));
    const napSummary = trackedNapMinutesForEntry > 0 ? `${formatMinutesAsHours(trackedNapMinutesForEntry)} naps` : "no naps";
    const sleepSummary = trackedSleepMinutesForEntry > 0 ? `${formatMinutesAsHours(trackedSleepMinutesForEntry)} sleep` : "sleep untracked";
    const dreamSummary = entry.dreamLog.trim().length > 0 ? "dream logged" : "no dream log";
    const relaxSummary = entry.relaxSessions.length > 0 || entry.breakSessions.length > 0
      ? `${formatMinutesAsHours(getTrackedRelaxMinutes(entry) + getTrackedBreakMinutes(entry))} relaxed`
      : "no relax tracked";
    const poopCount = getTrackedPoopCount(entry);
    const poopSummary = poopCount > 0 ? `${poopCount} bowel movement${poopCount === 1 ? "" : "s"}` : "no bowel movements tracked";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, ${sleepSummary}, ${napSummary}, ${relaxSummary}, ${poopSummary}, ${dreamSummary}, wake quality ${renderScore(entry.wakeQualityScore)}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}, anxiety ${renderScore(entry.anxietyScore)}`;
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
    `- Tracked bowel time: ${formatMinutesAsHours(trackedPoopMinutes)}`,
    `- Bowel movements tracked: ${trackedPoopCount}`,
    `- Average sleep: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.averageSleepMinutes) : "No sleep data"}`,
    `- Average recovery: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100 (${sleepInsights.recoveryLabel})` : "No recovery data"}`,
    `- Sleep debt: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.debtMinutes) : "No sleep data"}`,
    `- Sleep consistency: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 (${sleepInsights.consistencyLabel})` : "No sleep data"}`,
    `- Average wake quality: ${wakeQualityDays > 0 ? `${(wakeQualityTotal / wakeQualityDays).toFixed(1)}/5` : "No wake-quality data"}`,
    `- Average mood: ${moodDays > 0 ? `${(moodTotal / moodDays).toFixed(1)}/5` : "No mood data"}`,
    `- Average energy: ${energyDays > 0 ? `${(energyTotal / energyDays).toFixed(1)}/5` : "No energy data"}`,
    `- Average anxiety: ${anxietyDays > 0 ? `${(anxietyTotal / anxietyDays).toFixed(1)}/5` : "No anxiety data"}`,
    "",
    "## Habit Completion",
    "| Habit | Completed | Rate |",
    "| --- | --- | --- |",
    ...habitRows,
    "",
    "## Personal Trends",
    ...renderPersonalTrendSectionLines(personalTrends),
    "",
    "## Gamification Center",
    ...renderGamificationSectionLines(gamification),
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

export function closeOpenPoopSessions(entry: DailyEntry, timestamp: string): void {
  entry.poopSessions = entry.poopSessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
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

export function getTrackedPoopMinutes(entry: DailyEntry): number {
  return getTrackedMinutes(entry.poopSessions);
}

export function getTrackedPoopCount(entry: DailyEntry): number {
  return entry.poopSessions.length;
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
  const sleepInsights = buildSleepInsights(input.entries, undefined, input.habits);
  const personalTrends = buildPersonalTrendSummary(input.entries, input.habits);
  const gamification = buildGamificationSummary(input.entries, input.habits, input.todoSnapshot);
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const wakeQualityEntries = input.entries.filter((entry) => entry.wakeQualityScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const averageWakeQuality = wakeQualityEntries.length > 0 ? (wakeQualityEntries.reduce((sum, entry) => sum + entry.wakeQualityScore, 0) / wakeQualityEntries.length).toFixed(1) : "n/a";
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
    `- Average wake quality: ${averageWakeQuality === "n/a" ? "No data" : `${averageWakeQuality}/5`}`,
    `- Average sleep: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.averageSleepMinutes) : "No sleep data"}`,
    `- Average recovery: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100 (${sleepInsights.recoveryLabel})` : "No recovery data"}`,
    `- Sleep debt: ${sleepInsights.nightsTracked > 0 ? formatMinutesAsHours(sleepInsights.debtMinutes) : "No sleep data"}`,
    `- Sleep consistency: ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 (${sleepInsights.consistencyLabel})` : "No sleep data"}`,
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
    "## Personal Trends",
    ...renderPersonalTrendSectionLines(personalTrends),
    "",
    "## Gamification Center",
    ...renderGamificationSectionLines(gamification),
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

export function buildPersonalTrendSummary(entries: DailyEntry[], habits: HabitDefinition[]): PersonalTrendSummary {
  if (entries.length === 0) {
    return {
      strongestSignals: [],
      driftSignals: [],
      repeatedMisses: [],
      symptomSignals: [],
      reflectionSignals: []
    };
  }

  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const midpoint = Math.max(1, Math.floor(orderedEntries.length / 2));
  const firstHalf = orderedEntries.slice(0, midpoint);
  const secondHalf = orderedEntries.slice(midpoint);
  const firstEnergy = averageEntryScore(firstHalf, "energyScore");
  const secondEnergy = averageEntryScore(secondHalf, "energyScore");
  const firstMood = averageEntryScore(firstHalf, "moodScore");
  const secondMood = averageEntryScore(secondHalf, "moodScore");
  const firstRecovery = buildSleepInsights(firstHalf, undefined, habits).averageRecoveryScore;
  const secondRecovery = buildSleepInsights(secondHalf, undefined, habits).averageRecoveryScore;
  const waterDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "water")).length;
  const caffeineDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "caffeine")).length;
  const helpedDays = orderedEntries.filter((entry) => entry.helpedToday.trim().length > 0).length;
  const hurtDays = orderedEntries.filter((entry) => entry.hurtToday.trim().length > 0).length;
  const missCounts = new Map<string, number>();
  orderedEntries.forEach((entry) => {
    entry.missedHabits.forEach((item) => missCounts.set(item, (missCounts.get(item) ?? 0) + 1));
  });
  const symptomCounts = new Map<string, number>();
  orderedEntries.forEach((entry) => {
    entry.symptomLog.forEach((item) => symptomCounts.set(item.symptom, (symptomCounts.get(item.symptom) ?? 0) + 1));
  });

  return {
    strongestSignals: [
      secondEnergy > firstEnergy ? `Energy improved from ${firstEnergy.toFixed(1)}/5 to ${secondEnergy.toFixed(1)}/5 across the period.` : "",
      secondMood > firstMood ? `Mood improved from ${firstMood.toFixed(1)}/5 to ${secondMood.toFixed(1)}/5 across the period.` : "",
      secondRecovery > firstRecovery ? `Recovery improved from ${firstRecovery}/100 to ${secondRecovery}/100 across the period.` : "",
      waterDays > 0 ? `Hydration was logged on ${waterDays}/${orderedEntries.length} days.` : "",
      helpedDays > 0 ? `Positive reflections were captured on ${helpedDays}/${orderedEntries.length} days.` : ""
    ].filter((item) => item.length > 0),
    driftSignals: [
      secondEnergy < firstEnergy ? `Energy drifted down from ${firstEnergy.toFixed(1)}/5 to ${secondEnergy.toFixed(1)}/5.` : "",
      secondMood < firstMood ? `Mood drifted down from ${firstMood.toFixed(1)}/5 to ${secondMood.toFixed(1)}/5.` : "",
      secondRecovery < firstRecovery ? `Recovery drifted from ${firstRecovery}/100 to ${secondRecovery}/100.` : "",
      caffeineDays > Math.ceil(orderedEntries.length / 2) ? `Caffeine showed up on ${caffeineDays}/${orderedEntries.length} days.` : "",
      hurtDays > Math.ceil(orderedEntries.length / 2) ? `Negative reflections were logged on ${hurtDays}/${orderedEntries.length} days.` : ""
    ].filter((item) => item.length > 0),
    repeatedMisses: Array.from(missCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => `${label} missed on ${count} day${count === 1 ? "" : "s"}.`),
    symptomSignals: Array.from(symptomCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => `${label} logged on ${count} day${count === 1 ? "" : "s"}.`),
    reflectionSignals: [
      orderedEntries.map((entry) => entry.helpedToday.trim()).filter((item) => item.length > 0).slice(-3).map((item) => `Helped: ${item}`),
      orderedEntries.map((entry) => entry.hurtToday.trim()).filter((item) => item.length > 0).slice(-3).map((item) => `Hurt: ${item}`)
    ].flat()
  };
}

export function renderPersonalTrendSectionLines(summary: PersonalTrendSummary): string[] {
  return [
    "Strongest signals:",
    ...(summary.strongestSignals.length > 0 ? summary.strongestSignals.map((item) => `- ${item}`) : ["- No strong positive trend stood out in this range."]),
    "",
    "Drift signals:",
    ...(summary.driftSignals.length > 0 ? summary.driftSignals.map((item) => `- ${item}`) : ["- No major negative drift stood out in this range."]),
    "",
    "Repeated misses:",
    ...(summary.repeatedMisses.length > 0 ? summary.repeatedMisses.map((item) => `- ${item}`) : ["- No repeated habit misses stood out."]),
    "",
    "Symptoms and reflections:",
    ...(summary.symptomSignals.length > 0 || summary.reflectionSignals.length > 0
      ? [...summary.symptomSignals, ...summary.reflectionSignals].map((item) => `- ${item}`)
      : ["- No persistent symptom or reflection pattern stood out."])
  ];
}

export function buildGamificationSummary(entries: DailyEntry[], habits: HabitDefinition[], todoSnapshot: TodoSnapshot | null): GamificationSummary {
  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const daySnapshots = orderedEntries.map((entry, index) => buildGamificationSnapshot(
    entry.date,
    [entry],
    habits,
    todoSnapshot,
    orderedEntries[index - 1] ? buildGamificationSnapshot(orderedEntries[index - 1].date, [orderedEntries[index - 1]], habits, todoSnapshot) : null
  ));
  const todayEntries = orderedEntries.slice(-1);
  const previousDayEntries = orderedEntries.slice(-2, -1);
  const weekEntries = orderedEntries.slice(-7);
  const previousWeekEntries = orderedEntries.slice(-14, -7);
  const monthEntries = orderedEntries.slice(-30);
  const previousMonthEntries = orderedEntries.slice(-60, -30);
  const today = buildGamificationSnapshot(todayEntries[0]?.date ?? "Today", todayEntries, habits, todoSnapshot, previousDayEntries.length > 0 ? buildGamificationSnapshot(previousDayEntries[0].date, previousDayEntries, habits, todoSnapshot) : null);
  const week = buildGamificationSnapshot("Last 7 days", weekEntries, habits, todoSnapshot, previousWeekEntries.length > 0 ? buildGamificationSnapshot("Previous 7 days", previousWeekEntries, habits, todoSnapshot) : null);
  const month = buildGamificationSnapshot("Last 30 days", monthEntries, habits, todoSnapshot, previousMonthEntries.length > 0 ? buildGamificationSnapshot("Previous 30 days", previousMonthEntries, habits, todoSnapshot) : null);
  const successThreshold = 70;
  let currentStreak = 0;
  for (let index = daySnapshots.length - 1; index >= 0; index -= 1) {
    if (daySnapshots[index].score >= successThreshold) {
      currentStreak += 1;
    } else {
      break;
    }
  }
  let bestStreak = 0;
  let streak = 0;
  daySnapshots.forEach((snapshot) => {
    if (snapshot.score >= successThreshold) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  });
  const personalBest = daySnapshots.reduce<{ label: string; score: number }>((best, snapshot) => snapshot.score > best.score ? { label: snapshot.label, score: snapshot.score } : best, { label: orderedEntries[0]?.date ?? "No data", score: 0 });
  const lowScoreThreshold = 45;
  let recoveryFromLowScoreDays = 0;
  for (let index = daySnapshots.length - 2; index >= 0; index -= 1) {
    if (daySnapshots[index].score < lowScoreThreshold) {
      recoveryFromLowScoreDays = daySnapshots.length - 1 - index;
      break;
    }
    if (index === 0) {
      recoveryFromLowScoreDays = daySnapshots.length > 0 ? daySnapshots.length - 1 : 0;
    }
  }

  return {
    model: "deterministic",
    today,
    week,
    month,
    currentStreak,
    bestStreak,
    personalBestDayLabel: personalBest.label,
    personalBestDayScore: personalBest.score,
    recoveryFromLowScoreDays,
    lowScoreThreshold
  };
}

export function renderGamificationSectionLines(summary: GamificationSummary): string[] {
  return [
    `- Model: ${summary.model}`,
    `- Today: ${summary.today.score}/${summary.today.maxScore} (${summary.today.grade}) • ${summary.today.comparisonText}`,
    `- Week: ${summary.week.score}/${summary.week.maxScore} (${summary.week.grade}) • ${summary.week.comparisonText}`,
    `- Month: ${summary.month.score}/${summary.month.maxScore} (${summary.month.grade}) • ${summary.month.comparisonText}`,
    `- Current streak: ${summary.currentStreak} day${summary.currentStreak === 1 ? "" : "s"}`,
    `- Best streak: ${summary.bestStreak} day${summary.bestStreak === 1 ? "" : "s"}`,
    `- Personal best day: ${summary.personalBestDayLabel} (${summary.personalBestDayScore}/100)`,
    `- Recovery from low-score days: ${summary.recoveryFromLowScoreDays} day${summary.recoveryFromLowScoreDays === 1 ? "" : "s"} since the last day under ${summary.lowScoreThreshold}`,
    "",
    ...renderGamificationSnapshotLines(summary.today)
  ];
}

export function renderGamificationReport(input: {
  title: string;
  entries: DailyEntry[];
  habits: HabitDefinition[];
  todoSnapshot: TodoSnapshot | null;
}): string {
  const summary = buildGamificationSummary(input.entries, input.habits, input.todoSnapshot);
  return [
    `# ${input.title}`,
    "",
    ...renderGamificationSectionLines(summary),
    "",
    "## Weekly Snapshot Details",
    ...renderGamificationSnapshotLines(summary.week),
    "",
    "## Monthly Snapshot Details",
    ...renderGamificationSnapshotLines(summary.month),
    ""
  ].join("\n");
}

function renderGamificationSnapshotLines(snapshot: GamificationSnapshot): string[] {
  return [
    `### ${snapshot.label}`,
    `- Score: ${snapshot.score}/${snapshot.maxScore} (${snapshot.grade})`,
    `- Comparison: ${snapshot.comparisonText}`,
    `- Highlights: ${snapshot.highlights.join(" • ") || "None"}`,
    `- Cautions: ${snapshot.cautions.join(" • ") || "None"}`,
    ...snapshot.categories.flatMap((category) => [
      `- ${category.label}: ${category.score}/${category.maxScore} - ${category.summary}`,
      ...category.details.map((detail) => `  - ${detail}`)
    ])
  ];
}

function buildGamificationSnapshot(label: string, entries: DailyEntry[], habits: HabitDefinition[], todoSnapshot: TodoSnapshot | null, previous: GamificationSnapshot | null = null): GamificationSnapshot {
  const categories = buildGamificationCategories(entries, habits, todoSnapshot);
  const score = Math.round(categories.reduce((sum, category) => sum + category.score, 0) / Math.max(categories.length, 1));
  const percentage = score;
  return {
    label,
    score,
    maxScore: 100,
    percentage,
    grade: score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F",
    comparisonText: previous ? `${score >= previous.score ? "+" : ""}${score - previous.score} vs previous window` : `${100 - score} points from a perfect run`,
    categories,
    highlights: categories.filter((category) => category.score >= 75).map((category) => `${category.label} strong`),
    cautions: categories.filter((category) => category.score < 55).map((category) => `${category.label} lagging`)
  };
}

function buildGamificationCategories(entries: DailyEntry[], habits: HabitDefinition[], todoSnapshot: TodoSnapshot | null): GamificationCategoryScore[] {
  const days = Math.max(entries.length, 1);
  const totalTasks = entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const totalWorkMinutes = entries.reduce((sum, entry) => sum + getTrackedWorkMinutes(entry), 0);
  const totalFocus = entries.reduce((sum, entry) => sum + entry.todayFocus.length, 0);
  const completedFocus = entries.reduce((sum, entry) => sum + entry.todayFocus.filter((item) => item.status === "done").length, 0);
  const focusCompletionRate = totalFocus > 0 ? completedFocus / totalFocus : 0;
  const activeDays = entries.filter((entry) => entry.completedTasks.length > 0 || getTrackedWorkMinutes(entry) > 0).length;
  const executionScore = clamp(Math.round(
    Math.min(35, (totalTasks / days) * 12)
    + Math.min(35, (totalWorkMinutes / days) / 8)
    + (focusCompletionRate * 20)
    + ((activeDays / days) * 10)
  ), 0, 100);

  const weightedHabitAverage = entries.length > 0
    ? Math.round(entries.reduce((sum, entry) => sum + getHabitWeightedCompletion(entry, habits).percentage, 0) / entries.length)
    : 0;
  const sleepInsights = buildSleepInsights(entries, undefined, habits);
  const averageMood = averageEntryScore(entries, "moodScore");
  const averageEnergy = averageEntryScore(entries, "energyScore");
  const averageAnxiety = averageEntryScore(entries, "anxietyScore");
  const symptomBurden = entries.reduce((sum, entry) => sum + entry.symptomLog.reduce((inner, symptom) => inner + symptom.severity, 0), 0) / days;
  const healthScore = clamp(Math.round(
    (weightedHabitAverage * 0.35)
    + (sleepInsights.averageRecoveryScore * 0.25)
    + (averageMood * 8)
    + (averageEnergy * 9)
    + ((5 - averageAnxiety) * 6)
    - (symptomBurden * 4)
  ), 0, 100);

  const loggedEnergyDays = entries.filter((entry) => entry.energyCheckIns.length > 0).length;
  const loggedReflectionDays = entries.filter((entry) => entry.helpedToday.trim().length > 0 || entry.hurtToday.trim().length > 0).length;
  const loggedFoodDays = entries.filter((entry) => entry.foodLog.length > 0 || entry.intakeLog.length > 0).length;
  const consistencyScore = clamp(Math.round(
    (sleepInsights.consistencyScore * 0.45)
    + ((weightedHabitAverage) * 0.3)
    + ((loggedEnergyDays / days) * 12)
    + ((loggedReflectionDays / days) * 8)
    + ((loggedFoodDays / days) * 5)
  ), 0, 100);

  const totalRelaxMinutes = entries.reduce((sum, entry) => sum + getTrackedRelaxMinutes(entry) + getTrackedBreakMinutes(entry), 0);
  const totalNapMinutes = entries.reduce((sum, entry) => sum + getTrackedNapMinutes(entry), 0);
  const recoveryFriendlyDays = entries.filter((entry) => entry.helpedToday.trim().length > 0).length;
  const recoveryScore = clamp(Math.round(
    (sleepInsights.averageRecoveryScore * 0.65)
    + Math.min(15, (totalRelaxMinutes / days) / 8)
    + Math.min(10, (totalNapMinutes / days) / 10)
    + ((recoveryFriendlyDays / days) * 10)
  ), 0, 100);

  const nextUpCoverage = entries.filter((entry) => entry.nextUpFocus.length > 0).length;
  const followThroughCount = entries.reduce((sum, entry) => sum + entry.calendarFollowThroughCompleted.length, 0);
  const averageProjectHealth = todoSnapshot && todoSnapshot.projects.length > 0
    ? Math.round(todoSnapshot.projects.reduce((sum, project) => sum + project.healthScore, 0) / todoSnapshot.projects.length)
    : 0;
  const planningScore = clamp(Math.round(
    ((totalFocus > 0 ? 1 : 0) * 20)
    + ((nextUpCoverage / days) * 20)
    + Math.min(20, followThroughCount * 4)
    + (averageProjectHealth * 0.4)
  ), 0, 100);

  return [
    buildCategory("execution", "Execution", executionScore, `Tasks, work time, and focus completion`, [
      `${totalTasks} archived tasks across ${days} day${days === 1 ? "" : "s"}`,
      `${formatMinutesAsHours(totalWorkMinutes)} tracked work`,
      `${completedFocus}/${totalFocus || 0} focus items completed`
    ]),
    buildCategory("health", "Health", healthScore, `Habits, mood, energy, symptoms, and recovery`, [
      `Weighted habit completion averaged ${weightedHabitAverage}%`,
      `Average mood ${averageMood.toFixed(1)}/5 • energy ${averageEnergy.toFixed(1)}/5 • anxiety ${averageAnxiety.toFixed(1)}/5`,
      `Symptom burden averaged ${symptomBurden.toFixed(1)} severity points per day`
    ]),
    buildCategory("consistency", "Consistency", consistencyScore, `Routine steadiness and logging coverage`, [
      `Sleep consistency ${sleepInsights.consistencyScore}/100`,
      `${loggedEnergyDays}/${days} days with energy check-ins`,
      `${loggedReflectionDays}/${days} days with reflections`
    ]),
    buildCategory("recovery", "Recovery", recoveryScore, `Sleep, rest, and rebound capacity`, [
      `Average recovery ${sleepInsights.averageRecoveryScore}/100`,
      `${formatMinutesAsHours(totalRelaxMinutes)} relax/break time`,
      `${formatMinutesAsHours(totalNapMinutes)} naps`
    ]),
    buildCategory("planning", "Planning", planningScore, `Focus shaping, follow-through, and project health`, [
      `${totalFocus} focus items set across the window`,
      `${nextUpCoverage}/${days} days had Next Up coverage`,
      `Average project health ${averageProjectHealth}/100`
    ])
  ];
}

function buildCategory(key: GamificationCategoryScore["key"], label: string, score: number, summary: string, details: string[]): GamificationCategoryScore {
  return {
    key,
    label,
    score,
    maxScore: 100,
    tone: score >= 75 ? "done" : score >= 55 ? "state" : "alert",
    summary,
    details
  };
}

function averageEntryScore(entries: DailyEntry[], key: "moodScore" | "energyScore" | "anxietyScore"): number {
  const values = entries.map((entry) => entry[key]).filter((value) => value > 0);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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

export function buildSleepInsights(entries: DailyEntry[], targetMinutes = DEFAULT_SLEEP_TARGET_MINUTES, habits: HabitDefinition[] = []): SleepInsights {
  const orderedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const recentNights = orderedEntries
    .map((entry, index) => buildSleepNightSnapshot(entry, orderedEntries[index + 1], targetMinutes, habits))
    .filter((item): item is SleepNightSnapshot => item !== null)
    .slice(-7);

  if (recentNights.length === 0) {
    return {
      targetMinutes,
      nightsTracked: 0,
      averageSleepMinutes: 0,
      debtMinutes: 0,
      consistencyScore: 0,
      consistencyLabel: "No data",
      averageRecoveryScore: 0,
      recoveryLabel: "No data",
      averageBedtime: "",
      averageWakeTime: "",
      recentNights: []
    };
  }

  const averageSleepMinutes = Math.round(recentNights.reduce((sum, item) => sum + item.sleepMinutes, 0) / recentNights.length);
  const averageRecoveryScore = Math.round(recentNights.reduce((sum, item) => sum + item.recoveryScore, 0) / recentNights.length);
  const debtMinutes = Math.max(0, recentNights.reduce((sum, item) => sum + Math.max(0, targetMinutes - item.sleepMinutes), 0));
  const bedtimeValues = recentNights.map((item) => normalizeBedtimeMinutes(item.bedtime)).filter((value): value is number => value !== null);
  const wakeValues = recentNights.map((item) => parseClockMinutes(item.wakeTime)).filter((value): value is number => value !== null);
  const bedtimeDeviation = getAverageDeviation(bedtimeValues);
  const wakeDeviation = getAverageDeviation(wakeValues);
  const consistencyScore = Math.max(0, 100 - Math.round((bedtimeDeviation + wakeDeviation) / 3));

  return {
    targetMinutes,
    nightsTracked: recentNights.length,
    averageSleepMinutes,
    debtMinutes,
    consistencyScore,
    consistencyLabel: consistencyScore >= 85 ? "Very steady" : consistencyScore >= 70 ? "Stable" : consistencyScore >= 50 ? "Drifting" : "Irregular",
    averageRecoveryScore,
    recoveryLabel: averageRecoveryScore >= 80 ? "Recovered" : averageRecoveryScore >= 65 ? "Holding" : averageRecoveryScore >= 45 ? "Strained" : "Depleted",
    averageBedtime: formatAverageClock(bedtimeValues, true),
    averageWakeTime: formatAverageClock(wakeValues, false),
    recentNights
  };
}

function buildSleepNightSnapshot(entry: DailyEntry, nextEntry: DailyEntry | undefined, targetMinutes: number, habits: HabitDefinition[]): SleepNightSnapshot | null {
  const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
  if (sleepMinutes <= 0) {
    return null;
  }

  const recoveryScore = computeRecoveryScore(entry, sleepMinutes, targetMinutes, habits);

  return {
    date: entry.date,
    sleepMinutes,
    bedtime: entry.sleepTime ? entry.sleepTime.slice(11, 16) : "",
    wakeTime: nextEntry?.wakeTime ? nextEntry.wakeTime.slice(11, 16) : "",
    wakeQualityScore: nextEntry?.wakeQualityScore ?? 0,
    recoveryScore,
    recoveryLabel: recoveryScore >= 80 ? "Recovered" : recoveryScore >= 65 ? "Holding" : recoveryScore >= 45 ? "Strained" : "Depleted"
  };
}

function computeRecoveryScore(entry: DailyEntry, sleepMinutes: number, targetMinutes: number, habits: HabitDefinition[]): number {
  const sleepComponent = Math.min(50, Math.round((sleepMinutes / targetMinutes) * 50));
  const napMinutes = getTrackedNapMinutes(entry);
  const relaxMinutes = getTrackedRelaxMinutes(entry);
  const wakeQualityComponent = Math.round((entry.wakeQualityScore / 5) * 15);
  const anxietyComponent = Math.round(((5 - entry.anxietyScore) / 5) * 15);
  const relaxComponent = Math.min(10, Math.round((relaxMinutes / 60) * 10));
  const napComponent = napMinutes === 0 ? 5 : napMinutes <= 90 ? 10 : napMinutes <= 150 ? 7 : 4;
  const missedWeight = habits.reduce((sum, habit) => {
    const remaining = Math.max(0, habit.target - (entry.habits[habit.id] ?? 0));
    return sum + (remaining * habit.difficultyWeight);
  }, 0);
  const missPenalty = Math.min(20, missedWeight * 2);
  return clamp(sleepComponent + wakeQualityComponent + anxietyComponent + relaxComponent + napComponent - missPenalty, 0, 100);
}

function parseClockMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value.trim())) {
    return null;
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function normalizeBedtimeMinutes(value: string): number | null {
  const minutes = parseClockMinutes(value);
  if (minutes === null) {
    return null;
  }

  return minutes < 12 * 60 ? minutes + (24 * 60) : minutes;
}

function getAverageDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + Math.abs(value - average), 0) / values.length;
}

function formatAverageClock(values: number[], bedtime: boolean): string {
  if (values.length === 0) {
    return "";
  }

  let average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (bedtime && average >= 24 * 60) {
    average -= 24 * 60;
  }

  const hours = Math.floor(average / 60) % 24;
  const minutes = average % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

export function getTrackedTodayFocusMinutes(item: TodayFocusItem): number {
  return getTrackedMinutes(item.workSessions);
}

export function isTodayFocusItemActive(item: TodayFocusItem): boolean {
  return item.workSessions.some((session) => session.end === null);
}

function renderTodayFocusLine(item: TodayFocusItem): string {
  const workedMinutes = getTrackedTodayFocusMinutes(item);
  const sessionTag = [...item.workSessions].reverse().find((session) => session.tag.trim().length > 0)?.tag ?? "";
  const statusLabel = item.status === "working"
    ? "Working on"
    : item.status === "done"
      ? "Done"
      : "Queued";
  const detailParts = [
    sessionTag ? `tag: ${sessionTag}` : "",
    item.estimateMinutes && item.estimateMinutes > 0 ? `estimate: ${formatMinutesAsHours(item.estimateMinutes)}` : "",
    workedMinutes > 0 ? `tracked: ${formatMinutesAsHours(workedMinutes)}` : "",
    item.notes ? `notes: ${item.notes}` : ""
  ].filter((value) => value.length > 0);
  return `- [${statusLabel}] ${item.text}${detailParts.length > 0 ? ` (${detailParts.join(" | ")})` : ""}`;
}

function parseTodayFocusLine(line: string): TodayFocusItem | null {
  const normalized = line.trim();
  if (!normalized || normalized.toLowerCase() === "no focus items set") {
    return null;
  }

  const match = normalized.match(/^\[(?<status>[^\]]+)\]\s+(?<text>.+?)(?:\s+\((?<details>.+)\))?$/i);
  const rawStatus = match?.groups?.status?.trim().toLowerCase() ?? "";
  const text = (match?.groups?.text ?? normalized).trim();
  const details = match?.groups?.details?.trim() ?? "";
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
    notes: extractFocusDetail(details, "notes") ?? "",
    estimateMinutes: parseDurationLabel(extractFocusDetail(details, "estimate")),
    status,
    workSessions: (() => {
      const tag = extractFocusDetail(details, "tag") ?? "";
      return tag ? [{ start: "", end: null, tag }] : [];
    })(),
    completedAt: null
  };
}

function renderSessionLine(session: WorkSession): string {
  const tagSuffix = session.tag.trim().length > 0 ? ` [${session.tag.trim()}]` : "";
  return `- ${session.start} -> ${session.end ?? "Still active"}${tagSuffix}`;
}

function renderNextUpFocusLine(item: NextUpFocusItem): string {
  const details = [
    item.estimateMinutes && item.estimateMinutes > 0 ? `estimate: ${formatMinutesAsHours(item.estimateMinutes)}` : "",
    item.notes ? `notes: ${item.notes}` : ""
  ].filter((value) => value.length > 0);
  return `- ${item.text}${details.length > 0 ? ` (${details.join(" | ")})` : ""}`;
}

function parseNextUpFocusItem(line: string): NextUpFocusItem | null {
  const normalized = line.trim();
  if (!normalized || normalized.toLowerCase() === "no queued items") {
    return null;
  }

  const match = normalized.match(/^(?<text>.+?)(?:\s+\((?<details>.+)\))?$/i);
  const text = match?.groups?.text?.trim() ?? normalized;
  const details = match?.groups?.details?.trim() ?? "";
  if (!text) {
    return null;
  }

  return {
    text,
    notes: extractFocusDetail(details, "notes") ?? "",
    estimateMinutes: parseDurationLabel(extractFocusDetail(details, "estimate"))
  };
}

function extractFocusDetail(details: string, label: string): string | null {
  if (!details) {
    return null;
  }

  const segment = details
    .split("|")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!segment) {
    return null;
  }

  return segment.slice(label.length + 1).trim();
}

function parseDurationLabel(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const hourMatch = normalized.match(/^(?<hours>\d+(?:\.\d+)?)h$/);
  if (hourMatch?.groups?.hours) {
    return Math.round(Number(hourMatch.groups.hours) * 60);
  }

  const minuteMatch = normalized.match(/^(?<minutes>\d+)m$/);
  if (minuteMatch?.groups?.minutes) {
    return Number(minuteMatch.groups.minutes);
  }

  const plainNumber = Number(normalized);
  return Number.isFinite(plainNumber) ? Math.round(plainNumber) : null;
}

function renderCalendarEventLine(event: CalendarEventOccurrence): string {
  const repeatLabel = event.repeatCadence !== "none"
    ? ` (${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""})`
    : "";
  const contextParts = [`${event.category}`];
  const leadSummary = renderCalendarLeadSummary(event.prepMinutes, event.travelMinutes);
  if (leadSummary) {
    contextParts.push(leadSummary);
  }
  const noteLinks = extractWikiLinks(event.notes);
  if (noteLinks.length > 0) {
    contextParts.push(`links ${noteLinks.join(", ")}`);
  }
  if (event.notes.trim().length > 0) {
    contextParts.push(event.notes.trim());
  }

  return `- ${renderCalendarEventWindowLabel(event)}: ${event.title}${repeatLabel}${contextParts.length > 0 ? ` - ${contextParts.join(" • ")}` : ""}`;
}

function renderCalendarEventContextLabel(event: CalendarEventOccurrence): string {
  const windowLabel = renderCalendarEventWindowLabel(event);
  return `(${windowLabel})`;
}

function renderCalendarEventWindowLabel(event: Pick<CalendarEventOccurrence, "date" | "endDate" | "startTime" | "endTime">): string {
  const sameDay = event.date === event.endDate;
  if (!event.startTime) {
    return sameDay ? "All day" : `All day ${event.date} -> ${event.endDate}`;
  }

  if (sameDay) {
    return `${event.startTime}${event.endTime ? ` -> ${event.endTime}` : ""}`;
  }

  return `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`;
}

function renderCalendarLeadSummary(prepMinutes: number, travelMinutes: number): string {
  const parts: string[] = [];
  if (prepMinutes > 0) {
    parts.push(`prep ${prepMinutes}m`);
  }
  if (travelMinutes > 0) {
    parts.push(`travel ${travelMinutes}m`);
  }
  return parts.join(" + ");
}

function extractWikiLinks(value: string): string[] {
  const matches = value.match(/\[\[[^\]]+\]\]/g);
  return matches ? Array.from(new Set(matches)) : [];
}