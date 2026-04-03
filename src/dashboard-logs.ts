import {
  clamp,
  countHabitEventsInWindow,
  createEmptyEntry,
  formatActivitySessionLabel,
  formatHabitCadenceLabel,
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
import type { ActivitySessionKind, CalendarEventOccurrence, DailyEntry, GamificationCategoryScore, GamificationSnapshot, GamificationSummary, HabitDefinition, NextUpFocusItem, PersonalTrendSummary, SleepInsights, SleepNightSnapshot, TodayFocusItem, TodoSnapshot, WeeklyReviewInput, WorkSession } from "./dashboard-types";

const DEFAULT_SLEEP_TARGET_MINUTES = 8 * 60;
const CALENDAR_FOLLOW_THROUGH_MARKER = "daily-dashboard-calendar-follow:";

function createContextLink(label: string, path = ""): string {
  const safeLabel = label.trim();
  if (!safeLabel) {
    return "";
  }

  const safePath = path.trim().replace(/\.md$/i, "");
  return safePath ? `[[${safePath}|${safeLabel}]]` : safeLabel;
}

function buildDailySummaryBlock(entry: DailyEntry, totalSleepMinutes: number, calendarEvents: CalendarEventOccurrence[]): string[] {
  const openLoopSummary = buildDailyOpenLoopSummary(entry, calendarEvents);
  const completedWin = entry.completedTasks[0];
  const focusWin = entry.todayFocus.find((item) => item.status === "done") ?? entry.todayFocus.find((item) => item.workSessions.length > 0);
  const mainWin = completedWin
    ? `${completedWin.project} / ${completedWin.section}: ${completedWin.text}`
    : focusWin
      ? focusWin.text
      : "No clear win recorded.";
  const mainBlocker = entry.frictionLog.trim()
    || (entry.missedHabits[0] ? `Missed habit: ${entry.missedHabits[0]}` : "No blocker recorded.");
  const biggestDrift = entry.hurtToday.trim()
    || (entry.missedHabits.length > 0 ? `Missed habits: ${entry.missedHabits.slice(0, 3).join(", ")}` : "No obvious drift logged.");
  const keyHealthSignal = entry.symptomLog[0]
    ? `${entry.symptomLog[0].symptom} at ${entry.symptomLog[0].severity}/5`
    : entry.wakeQualityScore > 0
      ? `Wake quality ${entry.wakeQualityScore}/5 with ${formatMinutesAsHours(totalSleepMinutes)} tracked sleep`
      : totalSleepMinutes > 0
        ? `${formatMinutesAsHours(totalSleepMinutes)} tracked sleep`
        : "No strong health signal logged.";
  const mostImportantFollowUp = entry.nextUpFocus[0]?.text
    || entry.todayFocus.find((item) => item.status !== "done")?.text
    || calendarEvents[0]?.title
    || "No follow-up queued.";
  const contextLinks = Array.from(new Set(
    calendarEvents
      .filter((event) => event.projectName.trim().length > 0)
      .map((event) => createContextLink(event.projectName, event.projectNotePath))
      .filter((value) => value.length > 0)
  ));

  return [
    "## Summary Block",
    `- Main win: ${mainWin}`,
    `- Main blocker: ${mainBlocker}`,
    `- Biggest drift: ${biggestDrift}`,
    `- Key health signal: ${keyHealthSignal}`,
    `- Most important follow-up: ${mostImportantFollowUp}`,
    `- Open loops created today: ${openLoopSummary.created}`,
    `- Open loops closed today: ${openLoopSummary.closed}`,
    `- Context links: ${contextLinks.length > 0 ? contextLinks.join(", ") : "None linked today."}`,
    ""
  ];
}

function buildDailyOpenLoopSummary(entry: DailyEntry, calendarEvents: CalendarEventOccurrence[]): { created: string; closed: string } {
  const unfinishedFocus = entry.todayFocus.filter((item) => item.status !== "done").length;
  const completedFocus = entry.todayFocus.filter((item) => item.status === "done").length;
  const queuedNextUp = entry.nextUpFocus.length;
  const calendarCreated = calendarEvents.length;
  const calendarClosed = entry.calendarFollowThroughCompleted.length;
  const archivedTasks = entry.completedTasks.length;

  const createdCount = unfinishedFocus + queuedNextUp + calendarCreated;
  const closedCount = archivedTasks + completedFocus + calendarClosed;
  const createdParts = [
    unfinishedFocus > 0 ? `${unfinishedFocus} active focus item${unfinishedFocus === 1 ? "" : "s"}` : "",
    queuedNextUp > 0 ? `${queuedNextUp} queued next-up item${queuedNextUp === 1 ? "" : "s"}` : "",
    calendarCreated > 0 ? `${calendarCreated} calendar follow-through item${calendarCreated === 1 ? "" : "s"}` : ""
  ].filter((item) => item.length > 0);
  const closedParts = [
    archivedTasks > 0 ? `${archivedTasks} archived task${archivedTasks === 1 ? "" : "s"}` : "",
    completedFocus > 0 ? `${completedFocus} completed focus item${completedFocus === 1 ? "" : "s"}` : "",
    calendarClosed > 0 ? `${calendarClosed} completed calendar follow-through item${calendarClosed === 1 ? "" : "s"}` : ""
  ].filter((item) => item.length > 0);

  return {
    created: createdCount > 0 ? `${createdCount} total${createdParts.length > 0 ? ` • ${createdParts.join(", ")}` : ""}` : "0 total",
    closed: closedCount > 0 ? `${closedCount} total${closedParts.length > 0 ? ` • ${closedParts.join(", ")}` : ""}` : "0 total"
  };
}

function buildPeriodSummaryBlock(input: {
  accomplishmentLines: string[];
  blockerPatterns: string[];
  driftSignals: string[];
  sleepInsights: SleepInsights;
  strongestProjects?: string[];
  staleProjects?: string[];
}): string[] {
  const contextProjects = [...(input.strongestProjects ?? []), ...(input.staleProjects ?? [])]
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
    .slice(0, 5);

  return [
    "## Summary Block",
    `- Main win: ${input.accomplishmentLines[0]?.replace(/^-\s*/, "") || input.strongestProjects?.[0] || "No clear win stood out in this period."}`,
    `- Main blocker: ${input.blockerPatterns[0]?.replace(/^-\s*/, "") || "No repeated blocker pattern stood out."}`,
    `- Biggest drift: ${input.driftSignals[0] || "No major drift signal stood out."}`,
    `- Key health signal: ${input.sleepInsights.nightsTracked > 0 ? `${formatMinutesAsHours(input.sleepInsights.averageSleepMinutes)} average sleep, recovery ${input.sleepInsights.averageRecoveryScore}/100, debt ${formatMinutesAsHours(input.sleepInsights.debtMinutes)}` : "No strong health signal stood out."}`,
    `- Most important follow-up: ${input.staleProjects?.[0] || input.strongestProjects?.[0] || "No clear follow-up surfaced from this period."}`,
    `- Context links: ${contextProjects.length > 0 ? contextProjects.join(", ") : "No project links stood out."}`,
    ""
  ];
}

export function renderDailyLog(entry: DailyEntry, habits: HabitDefinition[], nextEntry?: DailyEntry, calendarEvents: CalendarEventOccurrence[] = []): string {
  const payload = JSON.stringify(entry, null, 2);
  const habitLines = habits.map((habit) => {
    const events = entry.habitEvents[habit.id] ?? [];
    const timing = events.length > 0 ? ` at ${events.map((item) => item.slice(11)).join(", ")}` : "";
    const inWindowCount = countHabitEventsInWindow(events, habit.completionWindow);
    return `- ${habit.label}: ${entry.habits[habit.id] ?? 0}/${habit.target}${timing} • ${formatHabitCadenceLabel(habit.cadence)} • ${formatHabitWindowLabel(habit.completionWindow)} • difficulty ${habit.difficultyWeight}/3 • in window ${inWindowCount}/${events.length || 0}`;
  });
  const habitMissNoteLines = habits
    .filter((habit) => (entry.habitMissNotes[habit.id] ?? "").trim().length > 0)
    .map((habit) => `- ${habit.label}: ${entry.habitMissNotes[habit.id]}`);
  const foodEntries = entry.intakeLog.filter((item) => item.kind === "food");
  const drinkEntries = entry.intakeLog.filter((item) => item.kind === "drink");
  const intakeLines = entry.intakeLog.length > 0
    ? entry.intakeLog.map((item) => {
      const history = item.loggedAtHistory.length > 0 ? item.loggedAtHistory : (item.loggedAt ? [item.loggedAt] : []);
      const historySummary = history.length > 1 ? ` • taps ${history.length} at ${history.map((value) => value.slice(11, 16)).join(", ")}` : "";
      return `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.kind} • ${item.amount} ${item.unit} ${item.label}${item.note ? ` - ${item.note}` : ""}${historySummary}`;
    })
    : ["- None logged"];
  const symptomLines = entry.symptomLog.length > 0
    ? entry.symptomLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.symptom} • ${item.severity}/5${item.note ? ` - ${item.note}` : ""}`)
    : ["- None logged"];
  const exerciseLines = entry.exerciseLog.length > 0
    ? entry.exerciseLog.map((item) => `- ${item.loggedAt ? `${item.loggedAt}: ` : ""}${item.label} • ${formatMinutesAsHours(item.durationMinutes)} • ${item.intensity}${item.note ? ` - ${item.note}` : ""}`)
    : ["- None logged"];
  const activityLines = entry.activitySessions.length > 0
    ? entry.activitySessions.map((session) => `- ${session.start.slice(11, 16)}-${(session.end ?? formatDateTimeKey(new Date())).slice(11, 16)} • ${session.label}${session.tag ? ` • ${session.tag}` : ""}`)
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
    `foodEntryCount: ${foodEntries.length}`,
    `intakeEntryCount: ${drinkEntries.length}`,
    `symptomEntryCount: ${entry.symptomLog.length}`,
    `exerciseEntryCount: ${entry.exerciseLog.length}`,
    `activitySessionCount: ${entry.activitySessions.length}`,
    `bodyWeight: ${entry.bodyWeight ?? ""}`,
    `energyCheckInCount: ${entry.energyCheckIns.length}`,
    `dreamLogged: ${entry.dreamLog.trim().length > 0}`,
    `moodScore: ${entry.moodScore}`,
    `energyScore: ${entry.energyScore}`,
    `anxietyScore: ${entry.anxietyScore}`,
    "---",
    "",
    `# Obsidian DASH Log - ${entry.date}`,
    "",
    ...buildDailySummaryBlock(entry, totalSleepMinutes, calendarEvents),
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
    "## State, Symptoms And Friction",
    `- Mood: ${renderScore(entry.moodScore)}`,
    `- Energy: ${renderScore(entry.energyScore)}`,
    `- Anxiety: ${renderScore(entry.anxietyScore)}`,
    "",
    "### Symptoms",
    ...symptomLines,
    "",
    "### Friction",
    entry.frictionLog || "No friction log yet.",
    "",
    "### Energy Timeline",
    ...energyCheckInLines,
    "",
    "## Consumables",
    ...intakeLines,
    "",
    "## Exercise",
    `- Body weight: ${typeof entry.bodyWeight === "number" ? `${entry.bodyWeight}` : "Not logged"}`,
    ...exerciseLines,
    "",
    "## Other Activity Sessions",
    ...activityLines,
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
      console.warn("Obsidian DASH - Daily Action & System Hub could not parse daily log payload", error);
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
  const blockerPatterns = buildBlockerPatternLines(input.entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(input.entries);
  const missedHabitPatterns = buildMissedHabitPatternLines(input.entries, input.habitDefinitions);
  const narrativeLines = buildNarrativeSectionLines(input.entries, sleepInsights, personalTrends, gamification, input.todoSnapshot ?? null);
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
    if (entry.intakeLog.length > 0) {
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
  const strongestProjects = workLines
    .slice(0, 5)
    .map((line) => line.replace(/^-\s*/, "").split(":")[0]?.trim() ?? "")
    .filter((item) => item.length > 0);
  const staleProjects = (input.todoSnapshot?.staleProjects ?? []).slice(0, 5).map((project) => project.name);

  const dayLines = input.entries.map((entry) => {
    const foodSummary = entry.intakeLog.length > 0 ? `${entry.intakeLog.length} consumables` : "no consumables";
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
    ...buildPeriodSummaryBlock({
      accomplishmentLines,
      blockerPatterns,
      driftSignals: personalTrends.driftSignals,
      sleepInsights,
      strongestProjects,
      staleProjects
    }),
    "## Overview",
    `- Days captured: ${input.entries.length}`,
    `- Archived tasks completed: ${input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0)}`,
    `- Days with consumables logged: ${daysWithFood}`,
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
    "## Blocker Patterns",
    ...(blockerPatterns.length > 0 ? blockerPatterns : ["- No repeated blockers stood out in this period."]),
    "",
    "## Accomplishments By Project",
    ...(accomplishmentLines.length > 0 ? accomplishmentLines : ["- No project accomplishments were archived in this period."]),
    "",
    "## Missed Habit Patterns",
    ...(missedHabitPatterns.length > 0 ? missedHabitPatterns : ["- No repeated habit misses stood out in this period."]),
    "",
    ...(input.entries.length >= 20 ? ["## Month-End Narrative", ...narrativeLines, ""] : []),
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

export function closeOpenActivitySessions(entry: DailyEntry, timestamp: string): void {
  entry.activitySessions = entry.activitySessions.map((session) => session.end === null ? { ...session, end: timestamp } : session);
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

export function getTrackedActivityMinutes(entry: DailyEntry, kind?: ActivitySessionKind): number {
  return getTrackedMinutes(kind ? entry.activitySessions.filter((session) => session.kind === kind) : entry.activitySessions);
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
  const blockerPatterns = buildBlockerPatternLines(input.entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(input.entries);
  const missedHabitPatterns = buildMissedHabitPatternLines(input.entries, input.habits);
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
  const reviewByExceptionLines = buildWeeklyReviewByExceptionLines(input.todoSnapshot, personalTrends, blockerPatterns, missedHabitPatterns);

  return [
    `# Weekly Review - ${input.label}`,
    "",
    `Range: ${formatDateKey(input.start)} to ${formatDateKey(input.end)}`,
    "",
    ...buildPeriodSummaryBlock({
      accomplishmentLines,
      blockerPatterns,
      driftSignals: personalTrends.driftSignals,
      sleepInsights,
      strongestProjects: strongestProjects.map((project) => project.name),
      staleProjects: staleProjects.map((project) => project.name)
    }),
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
    "## Review By Exception",
    ...(reviewByExceptionLines.length > 0 ? reviewByExceptionLines : ["- No major exception pattern stood out this week."]),
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
    "## Blocker Patterns",
    ...(blockerPatterns.length > 0 ? blockerPatterns : ["- No repeated blockers stood out this week."]),
    "",
    "## Accomplishments By Project",
    ...(accomplishmentLines.length > 0 ? accomplishmentLines : ["- No project accomplishments were archived this week."]),
    "",
    "## Missed Habit Patterns",
    ...(missedHabitPatterns.length > 0 ? missedHabitPatterns : ["- No repeated habit misses stood out this week."]),
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

function buildWeeklyReviewByExceptionLines(
  todoSnapshot: TodoSnapshot | null,
  personalTrends: PersonalTrendSummary,
  blockerPatterns: string[],
  missedHabitPatterns: string[]
): string[] {
  if (!todoSnapshot) {
    return [
      `- Personal drift exception: ${personalTrends.driftSignals[0] ?? "No strong drift signal stood out."}`,
      `- Repeated blocker exception: ${blockerPatterns[0]?.replace(/^[-]\s*/, "") || "No repeated blocker pattern stood out."}`,
      `- Habit exception: ${missedHabitPatterns[0]?.replace(/^[-]\s*/, "") || "No repeated habit-miss pattern stood out."}`
    ];
  }

  const blockedCount = todoSnapshot.blockedTasks.length;
  const overdueCount = todoSnapshot.overdueTasks.length;
  const staleCount = todoSnapshot.staleProjects.length;
  const metadataGapProjects = todoSnapshot.projects.filter((project) => project.projectState === "active" && (
    project.projectSummary.trim().length === 0
    || project.definitionOfDone.trim().length === 0
    || project.lastReview.trim().length === 0
  ));
  const weakReviewProjects = todoSnapshot.projects
    .filter((project) => project.projectState === "active" && project.healthReasons.some((reason) => /last review was|no project review date/i.test(reason)))
    .slice(0, 3);
  const attentionProject = todoSnapshot.projects
    .filter((project) => project.projectState === "active")
    .sort((left, right) => left.healthScore - right.healthScore)[0];

  return [
    blockedCount > 0 || overdueCount > 0 || staleCount > 0
      ? `- Portfolio pressure: ${overdueCount} overdue, ${blockedCount} blocked, ${staleCount} stale project${staleCount === 1 ? "" : "s"}.`
      : "- Portfolio pressure: no overdue, blocked, or stale project pressure stood out this week.",
    metadataGapProjects.length > 0
      ? `- Metadata exception: ${metadataGapProjects.length} active project${metadataGapProjects.length === 1 ? " is" : "s are"} missing summary, done-state, or review metadata (${metadataGapProjects.slice(0, 3).map((project) => project.name).join(", ")}).`
      : "- Metadata exception: active projects are carrying the core summary, done-state, and review fields.",
    weakReviewProjects.length > 0
      ? `- Review hygiene exception: ${weakReviewProjects.map((project) => project.name).join(", ")} need fresher project reviews.`
      : "- Review hygiene exception: no active project review gaps stood out.",
    `- Personal drift exception: ${personalTrends.driftSignals[0] ?? "No strong drift signal stood out."}`,
    `- Repeated blocker exception: ${blockerPatterns[0]?.replace(/^[-]\s*/, "") || "No repeated blocker pattern stood out."}`,
    attentionProject
      ? `- Most important portfolio follow-up: ${attentionProject.name} (${attentionProject.healthLabel.toLowerCase()} health) • ${attentionProject.nextAction}`
      : "- Most important portfolio follow-up: no active project follow-up stood out.",
    `- Habit exception: ${missedHabitPatterns[0]?.replace(/^[-]\s*/, "") || "No repeated habit-miss pattern stood out."}`
  ];
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
  const waterDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "drink" && /water/i.test(item.label))).length;
  const caffeineDays = orderedEntries.filter((entry) => entry.intakeLog.some((item) => item.kind === "drink" && /coffee|tea|cola|caffeine|energy/i.test(item.label))).length;
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

export function buildBlockerPatternLines(entries: DailyEntry[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  entries.forEach((entry) => {
    splitPatternItems(entry.frictionLog).forEach((item) => {
      const key = normalizePatternKey(item);
      if (!key) {
        return;
      }

      const current = counts.get(key);
      counts.set(key, {
        label: current?.label ?? item,
        count: (current?.count ?? 0) + 1
      });
    });
  });

  return Array.from(counts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 6)
    .map((item) => `- ${item.label}: showed up on ${item.count} day${item.count === 1 ? "" : "s"}.`);
}

function buildAccomplishmentSectionLines(entries: DailyEntry[]): string[] {
  const workByProject = new Map<string, { count: number; tasks: string[] }>();
  entries.forEach((entry) => {
    entry.completedTasks.forEach((task) => {
      const current = workByProject.get(task.project) ?? { count: 0, tasks: [] };
      current.count += 1;
      if (current.tasks.length < 4) {
        current.tasks.push(task.text);
      }
      workByProject.set(task.project, current);
    });
  });

  return Array.from(workByProject.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .map(([project, summary]) => `- ${project}: ${summary.count} win${summary.count === 1 ? "" : "s"}${summary.tasks.length > 0 ? ` • ${summary.tasks.join(" | ")}` : ""}`);
}

function buildMissedHabitPatternLines(entries: DailyEntry[], habits: HabitDefinition[]): string[] {
  const lines = habits.map((habit) => {
    const missedCount = entries.filter((entry) => entry.missedHabits.includes(habit.label)).length;
    const notes = entries
      .map((entry) => entry.habitMissNotes[habit.id]?.trim() ?? "")
      .filter((item) => item.length > 0)
      .slice(-3);
    if (missedCount === 0 && notes.length === 0) {
      return "";
    }

    return `- ${habit.label}: missed on ${missedCount} day${missedCount === 1 ? "" : "s"}${notes.length > 0 ? ` • recent notes: ${notes.join(" | ")}` : ""}`;
  }).filter((item) => item.length > 0);

  return lines;
}

function buildNarrativeSectionLines(entries: DailyEntry[], sleepInsights: SleepInsights, personalTrends: PersonalTrendSummary, gamification: GamificationSummary, todoSnapshot: TodoSnapshot | null): string[] {
  const totalTasks = entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const blockerPatterns = buildBlockerPatternLines(entries);
  const accomplishmentLines = buildAccomplishmentSectionLines(entries);
  const topProject = accomplishmentLines[0]?.replace(/^-\s*/, "") ?? "No project wins stood out.";
  const staleProjectCount = todoSnapshot?.staleProjects.length ?? 0;

  return [
    `- Execution closed ${totalTasks} archived task${totalTasks === 1 ? "" : "s"} across the period, with ${gamification.week.score}/100 weekly-style execution momentum and ${gamification.month.score}/100 monthly momentum.`,
    `- Recovery averaged ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100` : "no scored recovery yet"}, while sleep consistency landed at ${sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100` : "no consistency score"}.`,
    `- The strongest visible accomplishment pattern was ${topProject}`,
    `- The loudest drag signals were ${blockerPatterns.length > 0 ? blockerPatterns.slice(0, 2).map((item) => item.replace(/^-\s*/, "")).join(" and ") : "not repeated often enough to form a pattern"}.`,
    `- Trend read: ${personalTrends.strongestSignals[0] ?? "No strong positive signal clearly dominated."} ${personalTrends.driftSignals[0] ?? "No single drift signal dominated the period."}`,
    `- Portfolio pressure: ${staleProjectCount} stale project${staleProjectCount === 1 ? "" : "s"} remain visible at period end.`
  ];
}

export function renderRecurringFrictionPatternsNote(input: {
  label: string;
  start: Date;
  end: Date;
  entries: DailyEntry[];
  habits: HabitDefinition[];
  todoSnapshot: TodoSnapshot | null;
}): string {
  const blockerPatterns = buildBlockerPatternLines(input.entries);
  const personalTrends = buildPersonalTrendSummary(input.entries, input.habits);
  const missedHabitPatterns = buildMissedHabitPatternLines(input.entries, input.habits);
  const reflectionSignals = personalTrends.reflectionSignals.slice(0, 6);
  const rawSignalLines = input.entries
    .filter((entry) => entry.frictionLog.trim().length > 0 || entry.hurtToday.trim().length > 0)
    .slice(-10)
    .map((entry) => {
      const parts = [
        entry.frictionLog.trim().length > 0 ? `friction: ${entry.frictionLog.trim()}` : "",
        entry.hurtToday.trim().length > 0 ? `hurt: ${entry.hurtToday.trim()}` : ""
      ].filter((item) => item.length > 0);
      return `- ${entry.date}: ${parts.join(" • ")}`;
    });
  const pressuredProjects = [...(input.todoSnapshot?.projects ?? [])]
    .filter((project) => project.projectState === "active" && (project.blockedTasks.length > 0 || project.overdueTasks.length > 0 || project.staleDays !== null))
    .sort((left, right) => left.healthScore - right.healthScore)
    .slice(0, 6);
  const strongestBlocker = blockerPatterns[0]?.replace(/^[-]\s*/, "") || "No repeated blocker pattern stood out.";
  const strongestDrift = personalTrends.driftSignals[0] || "No clear drift signal stood out.";
  const followUp = pressuredProjects[0]?.nextAction || blockerPatterns[0]?.replace(/^[-]\s*/, "") || "No clear follow-up surfaced.";

  return [
    `# Recurring Friction Patterns - ${input.label}`,
    "",
    `- Generated: ${formatDateTimeKey(new Date())}`,
    `- Window: ${formatDateKey(input.start)} to ${formatDateKey(input.end)}`,
    `- Days analyzed: ${input.entries.length}`,
    "",
    "## Summary Block",
    `- Main blocker: ${strongestBlocker}`,
    `- Biggest drift: ${strongestDrift}`,
    `- Key health signal: ${personalTrends.symptomSignals[0] || personalTrends.reflectionSignals[0] || "No dominant health or reflection signal stood out."}`,
    `- Most important follow-up: ${followUp}`,
    `- Context links: ${pressuredProjects.length > 0 ? pressuredProjects.map((project) => createContextLink(project.name, project.noteLinks[0] ?? project.name)).join(", ") : "No project links stood out."}`,
    "",
    "## Repeated Friction Patterns",
    ...(blockerPatterns.length > 0 ? blockerPatterns : ["- No repeated blocker pattern stood out."]),
    "",
    "## Reflection Drift",
    ...(reflectionSignals.length > 0 ? reflectionSignals.map((item) => `- ${item}`) : ["- No repeated reflection drift stood out."]),
    "",
    "## Habit And Recovery Correlates",
    ...(missedHabitPatterns.length > 0 ? missedHabitPatterns.slice(0, 6) : ["- No repeated habit misses stood out alongside friction."]),
    "",
    "## Project Pressure Likely Feeding Friction",
    ...(pressuredProjects.length > 0
      ? pressuredProjects.map((project) => `- ${project.name}: ${project.healthLabel.toLowerCase()} health • ${project.nextAction}${project.waitingOn && project.waitingOn.toLowerCase() !== "none" ? ` • waiting on ${project.waitingOn}` : ""}`)
      : ["- No clear project-pressure driver stood out."]),
    "",
    "## Recent Raw Signals",
    ...(rawSignalLines.length > 0 ? rawSignalLines : ["- No recent friction or hurt signals were logged."]),
    ""
  ].join("\n");
}

function splitPatternItems(value: string): string[] {
  return value
    .split(/\r?\n|[.;]/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter((item) => item.length >= 4);
}

function normalizePatternKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  const projectLabel = renderCalendarProjectLabel(event.projectName, event.projectNotePath);
  if (projectLabel) {
    contextParts.push(`project ${projectLabel}`);
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
  const projectLabel = renderCalendarProjectLabel(event.projectName, event.projectNotePath);
  return `(${[windowLabel, projectLabel].filter((value) => value.length > 0).join(" • ")})`;
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

function renderCalendarProjectLabel(projectName: string, projectNotePath: string): string {
  const safeName = projectName.trim();
  if (!safeName) {
    return "";
  }

  const safePath = projectNotePath.trim().replace(/\.md$/i, "");
  return safePath ? `[[${safePath}|${safeName}]]` : safeName;
}