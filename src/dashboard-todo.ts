import { TFile, Vault, normalizePath } from "obsidian";

import { clamp, computeMissedHabits, formatDateKey, renderScore } from "./dashboard-core";
import {
  type CleanupSuggestion,
  type ArchiveMaintenanceResult,
  CHECKLIST_REGEX,
  NOTE_LINK_REGEX,
  PROJECT_META_REGEX,
  PROJECT_SEPARATOR_REGEX,
  SECTION_HEADER_REGEX,
  type ArchiveResult,
  type ArchivedTaskSnapshot,
  type CreateProjectInput,
  type ExistingProjectDefinition,
  type HabitDefinition,
  type ReferenceOffloadResult,
  type RepeatingTaskDefinition,
  type RepeatingTaskIntervalUnit,
  type RepeatingTaskRule,
  type TodoTaskSummary,
  type TodoProjectRange,
  type TodoProjectSummary,
  type TodoSnapshot,
  type WeeklyReviewInput
} from "./dashboard-types";

export function parseTodoSnapshot(content: string): TodoSnapshot {
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
    let status = "";
    let projectSummary = "";
    let whyItMatters = "";
    let definitionOfDone = "";
    let lastReview = "";
    let waitingOn = "";
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
    const nowTaskDetails: TodoTaskSummary[] = [];
    const nextTaskDetails: TodoTaskSummary[] = [];
    const laterTaskDetails: TodoTaskSummary[] = [];
    const dueRepeatingTaskDetails: TodoTaskSummary[] = [];
    const dueSoonTasks: TodoTaskSummary[] = [];
    const overdueTasks: TodoTaskSummary[] = [];
    const blockedTasks: TodoTaskSummary[] = [];
    const breakdownTasks: string[] = [];
    const emptySections = new Set<string>();
    const relationships = new Set<string>();
    const seenTasks = new Map<string, number>();
    const duplicateTasks = new Set<string>();

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
        if (meta.key === "status") {
          status = meta.value;
        }
        if (meta.key === "project summary") {
          projectSummary = meta.value;
        }
        if (meta.key === "why it matters") {
          whyItMatters = meta.value;
        }
        if (meta.key === "definition of done") {
          definitionOfDone = meta.value;
        }
        if (meta.key === "last review") {
          lastReview = meta.value;
        }
        if (meta.key === "waiting on") {
          waitingOn = meta.value;
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
  const taskSummary = parseTodoTaskSummary(taskText, currentSection, now);
  const normalizedTask = taskSummary.text.toLowerCase();
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
      if (sectionKey === "now") {
        nowTasks.push(taskSummary.text);
        nowTaskDetails.push(taskSummary);
      }
      if (sectionKey === "next") {
        nextTasks.push(taskSummary.text);
        nextTaskDetails.push(taskSummary);
      }
      if (sectionKey === "later") {
        laterTasks.push(taskSummary.text);
        laterTaskDetails.push(taskSummary);
      }
      if (sectionKey === "repeating") {
        dueRepeatingTasks.push(taskSummary.text);
        dueRepeatingTaskDetails.push(taskSummary);
      }
      if (taskSummary.isBlocked) {
        blockedTasks.push(taskSummary);
      }
      if (taskSummary.isOverdue) {
        overdueTasks.push(taskSummary);
      } else if (taskSummary.isDueSoon) {
        dueSoonTasks.push(taskSummary);
      }
      if (looksLikeBreakdownTask(taskSummary.text)) {
        breakdownTasks.push(taskSummary.text);
      }
    }

    const staleDays = lastCompletedAt ? daysBetween(lastCompletedAt, formatDateKey(now)) : null;
    const reviewDate = extractTrackedDate(lastReview);
    const reviewStaleDays = reviewDate ? daysBetween(reviewDate, formatDateKey(now)) : null;
    const trend: TodoProjectSummary["trend"] = completionsThisWeek > completionsPreviousWeek ? "up" : completionsThisWeek < completionsPreviousWeek ? "down" : "flat";
    const projectState = inferProjectState(status);
    const nextAction = selectProjectNextAction({
      projectName: project.name,
      projectState,
      lastReview,
      reviewStaleDays,
      waitingOn,
      definitionOfDone,
      overdueTasks,
      dueSoonTasks,
      nowTaskDetails,
      nextTaskDetails,
      dueRepeatingTaskDetails,
      laterTaskDetails
    });
    const healthReasons = buildProjectHealthReasons({
      projectName: project.name,
      projectState,
      staleDays,
      lastReview,
      reviewStaleDays,
      waitingOn,
      definitionOfDone,
      projectSummary,
      overdueTasks,
      dueSoonTasks,
      blockedTasks,
      duplicateTasks,
      breakdownTasks,
      emptySections,
      nowTaskDetails,
      nextTaskDetails,
      nextAction
    });
    const healthScore = computeHealthScore({
      projectState,
      openCount,
      staleDays,
      reviewStaleDays,
      completionsThisWeek,
      nowCount: nowTasks.length,
      nextCount: nextTasks.length,
      dueSoonCount: dueSoonTasks.length,
      overdueCount: overdueTasks.length,
      blockedCount: blockedTasks.length,
      breakdownCount: breakdownTasks.length,
      duplicateCount: duplicateTasks.size,
      hasProjectSummary: projectSummary.trim().length > 0,
      hasDefinitionOfDone: definitionOfDone.trim().length > 0,
      hasWaitingOn: waitingOn.trim().length > 0
    });

    return {
      name: project.name,
      categoryName,
      status: status || (projectState === "someday" ? "Someday" : projectState === "incubating" ? "Incubating" : "Active"),
      projectState,
      openCount,
      archivedCount,
      completionRate: openCount + archivedCount > 0 ? Math.round((archivedCount / (openCount + archivedCount)) * 100) : 0,
      focus,
      projectSummary,
      whyItMatters,
      definitionOfDone,
      lastReview,
      waitingOn,
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
      nextAction,
      healthScore,
      healthLabel: describeHealthScore(healthScore),
      healthReasons,
      relationships: Array.from(relationships),
      nowTaskDetails,
      nextTaskDetails,
      laterTaskDetails,
      dueRepeatingTaskDetails,
      dueSoonTasks,
      overdueTasks,
      blockedTasks
    };
  });

  const breakdownCandidates = projects.flatMap((project) => project.breakdownTasks.map((task) => ({ project: project.name, task })));
  const staleProjects = projects
    .filter((project) => project.projectState === "active" && project.staleDays !== null && project.staleDays >= 7)
    .sort((left, right) => (right.staleDays ?? 0) - (left.staleDays ?? 0));
  const cleanupSuggestions = projects.flatMap((project) => buildCleanupSuggestions(project));
  const dueSoonTasks = projects.flatMap((project) => project.dueSoonTasks.map((task) => ({ project: project.name, task })));
  const overdueTasks = projects.flatMap((project) => project.overdueTasks.map((task) => ({ project: project.name, task })));
  const blockedTasks = projects.flatMap((project) => project.blockedTasks.map((task) => ({ project: project.name, task })));

  return {
    totalOpen: projects.reduce((sum, project) => sum + project.openCount, 0),
    totalArchived: projects.reduce((sum, project) => sum + project.archivedCount, 0),
    projects,
    staleProjects,
    breakdownCandidates,
    cleanupSuggestions,
    dueSoonTasks,
    overdueTasks,
    blockedTasks
  };
}

export function reconcileCompletedTasks(content: string, archivedAt: string): ArchiveMaintenanceResult {
  const restoredResult = restoreUncheckedArchivedTasks(content);
  const archiveResult = archiveCompletedTasks(restoredResult.content, archivedAt);

  return {
    content: archiveResult.content,
    archivedTasks: archiveResult.archivedTasks,
    restoredTasks: restoredResult.restoredTasks
  };
}

export function archiveCompletedTasks(content: string, archivedAt: string): ArchiveResult {
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

export function restoreUncheckedArchivedTasks(content: string): { content: string; restoredTasks: ArchivedTaskSnapshot[] } {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);

  if (projectRanges.length === 0) {
    return { content, restoredTasks: [] };
  }

  const output: string[] = [];
  const restoredTasks: ArchivedTaskSnapshot[] = [];
  let cursor = 0;

  projectRanges.forEach((project) => {
    output.push(...lines.slice(cursor, project.start));
    const result = restoreUncheckedArchivedTasksFromProjectLines(
      lines.slice(project.start, project.end + 1),
      project.name
    );
    output.push(...result.lines);
    restoredTasks.push(...result.restoredTasks);
    cursor = project.end + 1;
  });

  output.push(...lines.slice(cursor));

  return {
    content: output.join("\n"),
    restoredTasks
  };
}

export function restoreUncheckedArchivedTasksFromProjectLines(
  projectLines: string[],
  projectName: string
): { lines: string[]; restoredTasks: ArchivedTaskSnapshot[] } {
  const keptLines: string[] = [];
  const restoredTasks: ArchivedTaskSnapshot[] = [];
  let currentSection = "General";

  projectLines.forEach((line) => {
    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName;
      keptLines.push(line);
      return;
    }

    const taskMatch = line.match(CHECKLIST_REGEX);
    if (taskMatch && currentSection.trim().toLowerCase() === "completed archive" && taskMatch[1] === " ") {
      const archivedTask = parseArchivedArchiveTask(taskMatch[2].trim(), projectName);
      if (archivedTask) {
        restoredTasks.push(archivedTask);
        return;
      }
    }

    keptLines.push(line);
  });

  if (restoredTasks.length === 0) {
    return { lines: projectLines, restoredTasks: [] };
  }

  let nextContent = keptLines.join("\n");
  restoredTasks.forEach((task) => {
    nextContent = insertTaskIntoProjectSection(nextContent, projectName, task.section, task.text);
  });

  return {
    lines: nextContent.split(/\r?\n/),
    restoredTasks
  };
}

function parseArchivedArchiveTask(value: string, projectName: string): ArchivedTaskSnapshot | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?)\s+-\s+\[([^\]]+)\]\s+(.*)$/);
  if (!match) {
    return null;
  }

  const [, archivedAt, section, text] = match;
  const trimmedText = text.trim();
  if (!trimmedText) {
    return null;
  }

  return {
    project: projectName,
    section: section.trim() || "General",
    text: trimmedText,
    archivedAt
  };
}

export function archiveCompletedTasksFromProjectLines(
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

export function findProjectRanges(lines: string[]): TodoProjectRange[] {
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

export function getProjectHeaderName(lines: string[], index: number): string | null {
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

export function getSectionName(line: string): string | null {
  const trimmed = line.trim();
  if (/^###\s+/.test(trimmed)) {
    return trimmed.replace(/^###\s+/, "").trim();
  }

  const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
  return sectionMatch ? sectionMatch[1] : null;
}

export function isCompletedArchiveHeader(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "completed archive:" || trimmed === "### completed archive";
}

export function isNonArchivableSection(sectionName: string): boolean {
  const normalized = sectionName.trim().toLowerCase();
  return normalized === "completed archive" || normalized === "reference" || normalized === "resources";
}

export function parseProjectMeta(line: string): { key: string; value: string } | null {
  const match = line.trim().match(PROJECT_META_REGEX);
  if (!match) {
    return null;
  }

  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim()
  };
}

export function extractNoteLinks(value: string): string[] {
  const links: string[] = [];
  let match = NOTE_LINK_REGEX.exec(value);
  while (match) {
    links.push(match[1]);
    match = NOTE_LINK_REGEX.exec(value);
  }
  NOTE_LINK_REGEX.lastIndex = 0;
  return links;
}

export function getIsoWeekRange(referenceDate: Date): { start: Date; end: Date; label: string } {
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

export function findTodoCategoryRanges(lines: string[]): Array<{ name: string; start: number; end: number }> {
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

export function getTodoCategoryName(line: string | undefined): string | null {
  const trimmed = line?.trim() ?? "";
  if (!/^#\s+/.test(trimmed) || /^##\s+/.test(trimmed)) {
    return null;
  }

  const name = trimmed.replace(/^#\s+/, "").trim();
  return name.toLowerCase() === "master task hub" ? null : name;
}

export function insertProjectIntoTodo(content: string, categoryName: string, projectBlock: string): string {
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

export function trimTrailingBlankLines(lines: string[]): string[] {
  const output = [...lines];
  while (output.length > 0 && output[output.length - 1].trim() === "") {
    output.pop();
  }
  return output;
}

export function trimLeadingBlankLines(lines: string[]): string[] {
  const output = [...lines];
  while (output.length > 0 && output[0].trim() === "") {
    output.shift();
  }
  return output;
}

export function renderTodoProjectBlock(input: CreateProjectInput & { projectNoteLink: string }): string {
  const today = formatDateKey(new Date());
  const addTasks = input.addTasks.length > 0 ? input.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixTasks = input.fixTasks.length > 0 ? input.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];

  return [
    `## ${input.projectName}`,
    `Project Note:: ${input.projectNoteLink}`,
    `Status:: ${input.status}`,
    `Focus:: ${input.focus || "Define the current focus for this project."}`,
    `Project Summary:: ${input.projectName} is an active project inside Obsidian DASH.` ,
    "Why It Matters:: Define why this project deserves attention right now.",
    "Definition Of Done:: Describe what meaningful progress or completion looks like.",
    `Last Review:: ${today}`,
    "Waiting On:: None",
    "Relationships::",
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
    "### Parking Lot",
    "- Idea:",
    "",
    "### Repeating",
    "- [ ] Weekly review [repeat: weekly fri]",
    "",
    "### Risks",
    "- Capture risks, drift patterns, and failure modes here.",
    "",
    "### Constraints",
    "- Capture hard limits, dependencies, or health constraints here.",
    "",
    "### Decisions",
    "- Capture important decisions and tradeoffs here.",
    "",
    "### Reference",
    "- Add durable support material here.",
    "",
    "### Completed Archive"
  ].join("\n");
}

export function renderProjectNoteTemplate(input: CreateProjectInput, masterTodoPath: string): string {
  const today = formatDateKey(new Date());
  return [
    `# ${input.projectName}`,
    "",
    `Status:: ${input.status || "Planning"}`,
    `Focus:: ${input.focus || "Define the current focus for this project."}`,
    `Project Summary:: ${input.projectName} is an active project inside Obsidian DASH.` ,
    "Why It Matters:: Define why this project deserves attention right now.",
    "Definition Of Done:: Describe what meaningful progress or completion looks like.",
    `Last Review:: ${today}`,
    "Waiting On:: None",
    `Relationships:: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]]`,
    "",
    "## Current Bottleneck",
    "- Capture the main constraint, ambiguity, or drag factor here.",
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
    "### Parking Lot",
    "- Idea:",
    "",
    "## Risks",
    "- Capture the major failure modes, drift risks, or watch-outs here.",
    "",
    "## Constraints",
    "- Capture time, energy, dependency, or scope constraints here.",
    "",
    "## Relationships",
    "- Related projects, dependencies, and blockers.",
    "",
    "## Review History",
    `- ${today}: Project note created from the DASH project template.`,
    "",
    "## Decisions",
    "- Capture important decisions and tradeoffs here.",
    "",
    "## References",
    "- Add links, assets, commands, or supporting notes here.",
    ""
  ].join("\n");
}

export function renderExistingProjectNoteTemplate(project: ExistingProjectDefinition, masterTodoPath: string): string {
  const today = formatDateKey(new Date());
  const addLines = project.addTasks.length > 0 ? project.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixLines = project.fixTasks.length > 0 ? project.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];

  return [
    `# ${project.projectName}`,
    "",
    `Status:: ${project.status || "Planning"}`,
    `Focus:: ${project.focus || "Define the current focus for this project."}`,
    `Project Summary:: ${project.projectName} is an active project inside Obsidian DASH.` ,
    "Why It Matters:: Define why this project deserves attention right now.",
    "Definition Of Done:: Describe what meaningful progress or completion looks like.",
    `Last Review:: ${today}`,
    "Waiting On:: None",
    `Relationships:: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]], [[${project.noteLinkPath}|${project.projectName}]]`,
    "",
    "## Current Bottleneck",
    "- Capture the main constraint, ambiguity, or drag factor here.",
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
    "### Parking Lot",
    "- Idea:",
    "",
    "## Risks",
    "- Capture the major failure modes, drift risks, or watch-outs here.",
    "",
    "## Constraints",
    "- Capture time, energy, dependency, or scope constraints here.",
    "",
    "## Decisions",
    "- Capture important decisions and tradeoffs here.",
    "",
    "## Review History",
    `- ${today}: Existing project note template generated from the Master Task Hub.`,
    "",
    "## References",
    "- Move or summarize project-specific references here over time.",
    ""
  ].join("\n");
}

export function createWikiLink(filePath: string, label: string): string {
  return `[[${stripMarkdownExtension(normalizePath(filePath))}|${label}]]`;
}

export function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

export function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "-").trim();
  return cleaned || "New Project";
}

export function splitMultilineInput(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function extractProjectDefinitionsFromTodo(content: string): ExistingProjectDefinition[] {
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

export function extractProjectDefinition(projectLines: string[], categoryName: string): ExistingProjectDefinition | null {
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

export function extractFirstNoteLinkPath(value: string): string | null {
  const match = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(value);
  return match ? match[1] : null;
}

export function insertTaskIntoProjectSection(content: string, projectName: string, sectionName: string, taskText: string): string {
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

export function extractRepeatingTasks(noteContent: string): RepeatingTaskDefinition[] {
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
    const taskMatch = trimmed.match(/^[-*]\s+(?:\[(?: |x|X)\]\s+)?(.*)$/);
    if (!taskMatch) {
      return;
    }
    const rawText = taskMatch[1].trim();
    const parsed = parseRepeatingTaskLine(rawText);
    if (!parsed) {
      return;
    }
    const { text, ruleText, rule } = parsed;
    if (text) {
      tasks.push({
        text,
        cadence: rule.kind,
        ruleText,
        rule
      });
    }
  });

  return tasks;
}

export function isRepeatingTaskDue(task: RepeatingTaskDefinition, content: string, projectName: string): boolean {
  return isRepeatingTaskDueOnDate(task, content, projectName, formatDateKey(new Date()));
}

export function isRepeatingTaskDueOnDate(task: RepeatingTaskDefinition, content: string, projectName: string, todayKey: string): boolean {
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
    return isRepeatingRuleEligibleWithoutHistory(task.rule, todayKey);
  }

  const latest = archivedDates.sort().reverse()[0];
  return isRepeatingRuleDueSince(task.rule, latest, todayKey);
}

function parseRepeatingTaskLine(rawText: string): { text: string; ruleText: string; rule: RepeatingTaskRule } | null {
  const explicitRepeatMatch = rawText.match(/\[(?:repeat|repeats)\s*:\s*([^\]]+)\]\s*$/i);
  const parenRepeatMatch = rawText.match(/\((?:repeat|repeats)\s*:\s*([^\)]+)\)\s*$/i);
  const legacyMatch = rawText.match(/\[(daily|weekly|monthly|yearly)\]\s*$|\((daily|weekly|monthly|yearly)\)\s*$/i);
  const extractedRuleText = (explicitRepeatMatch?.[1] ?? parenRepeatMatch?.[1] ?? legacyMatch?.[1] ?? legacyMatch?.[2] ?? "weekly").trim();
  const text = rawText
    .replace(/\s*\[(?:repeat|repeats)\s*:[^\]]+\]\s*$/i, "")
    .replace(/\s*\((?:repeat|repeats)\s*:[^\)]+\)\s*$/i, "")
    .replace(/\s*(\[(daily|weekly|monthly|yearly)\]|\((daily|weekly|monthly|yearly)\))\s*$/i, "")
    .trim();
  const rule = parseRepeatingRule(extractedRuleText);
  if (!text || !rule) {
    return null;
  }

  return {
    text,
    ruleText: normalizeRepeatingRuleText(rule),
    rule
  };
}

function parseRepeatingRule(value: string): RepeatingTaskRule | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) {
    return { kind: "weekly", interval: 1, unit: "week" };
  }

  if (normalized === "daily") {
    return { kind: "daily", interval: 1, unit: "day" };
  }
  if (normalized === "weekly") {
    return { kind: "weekly", interval: 1, unit: "week" };
  }
  if (normalized === "monthly") {
    return { kind: "monthly", interval: 1, unit: "month" };
  }
  if (normalized === "yearly" || normalized === "annual" || normalized === "annually") {
    return { kind: "yearly", interval: 1, unit: "year" };
  }

  const everyMatch = normalized.match(/^every\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i)
    ?? normalized.match(/^interval\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i);
  if (everyMatch) {
    const interval = Math.max(1, Number(everyMatch[1]));
    const unit = normalizeRepeatingIntervalUnit(everyMatch[2]);
    return {
      kind: "interval",
      interval,
      unit
    };
  }

  const monthlyDayMatch = normalized.match(/^monthly\s+(?:day\s+)?(last|[1-9]|[12]\d|3[01])$/i);
  if (monthlyDayMatch) {
    return {
      kind: "monthly",
      interval: 1,
      unit: "month",
      monthlyDay: monthlyDayMatch[1].toLowerCase() === "last" ? "last" : Number(monthlyDayMatch[1])
    };
  }

  const weekdayMatch = normalized.match(/^(?:weekdays?|weekly\s+on)\s+(.+)$/i);
  if (weekdayMatch) {
    const weekdays = weekdayMatch[1]
      .split(/[\s,\/|]+/)
      .map((token) => normalizeWeekdayToken(token))
      .filter((token): token is number => token !== null)
      .filter((token, index, array) => array.indexOf(token) === index)
      .sort((left, right) => left - right);
    if (weekdays.length > 0) {
      return {
        kind: "weekday-list",
        interval: 1,
        unit: "week",
        weekdays
      };
    }
  }

  return null;
}

function normalizeRepeatingRuleText(rule: RepeatingTaskRule): string {
  if (rule.kind === "daily") {
    return "daily";
  }
  if (rule.kind === "weekly") {
    return "weekly";
  }
  if (rule.kind === "monthly") {
    if (rule.monthlyDay === "last") {
      return "monthly day last";
    }
    if (typeof rule.monthlyDay === "number") {
      return `monthly day ${rule.monthlyDay}`;
    }
    return "monthly";
  }
  if (rule.kind === "yearly") {
    return "yearly";
  }
  if (rule.kind === "weekday-list") {
    return `weekdays ${formatWeekdayList(rule.weekdays ?? [])}`;
  }
  return `every ${rule.interval} ${(rule.unit ?? "day")}${rule.interval === 1 ? "" : "s"}`;
}

function normalizeRepeatingIntervalUnit(value: string): RepeatingTaskIntervalUnit {
  if (/^day/i.test(value)) {
    return "day";
  }
  if (/^week/i.test(value)) {
    return "week";
  }
  if (/^month/i.test(value)) {
    return "month";
  }
  return "year";
}

function normalizeWeekdayToken(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };

  return normalized in map ? map[normalized] : null;
}

function formatWeekdayList(weekdays: number[]): string {
  const labels = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return weekdays.map((weekday) => labels[weekday] ?? `${weekday}`).join(" ");
}

function isRepeatingRuleEligibleWithoutHistory(rule: RepeatingTaskRule, todayKey: string): boolean {
  const today = new Date(`${todayKey}T00:00:00`);
  if (rule.kind === "weekday-list") {
    return (rule.weekdays ?? []).includes(today.getDay());
  }
  if (rule.kind === "monthly" && typeof rule.monthlyDay !== "undefined") {
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const targetDay = rule.monthlyDay === "last" ? lastDayOfMonth : Math.min(rule.monthlyDay, lastDayOfMonth);
    return today.getDate() >= targetDay;
  }
  return true;
}

function isRepeatingRuleDueSince(rule: RepeatingTaskRule, latestCompletedKey: string, todayKey: string): boolean {
  const latest = new Date(`${latestCompletedKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  if (today.getTime() < latest.getTime()) {
    return false;
  }

  if (rule.kind === "daily") {
    return latestCompletedKey < todayKey;
  }

  if (rule.kind === "weekly") {
    return daysBetween(latestCompletedKey, todayKey) >= 7;
  }

  if (rule.kind === "yearly") {
    return addMonthsToDateKey(latestCompletedKey, 12) <= todayKey;
  }

  if (rule.kind === "interval") {
    if (rule.unit === "day") {
      return daysBetween(latestCompletedKey, todayKey) >= rule.interval;
    }
    if (rule.unit === "week") {
      return daysBetween(latestCompletedKey, todayKey) >= rule.interval * 7;
    }
    if (rule.unit === "month") {
      return addMonthsToDateKey(latestCompletedKey, rule.interval) <= todayKey;
    }
    return addMonthsToDateKey(latestCompletedKey, rule.interval * 12) <= todayKey;
  }

  if (rule.kind === "weekday-list") {
    return (rule.weekdays ?? []).includes(today.getDay()) && latestCompletedKey < todayKey;
  }

  if (rule.kind === "monthly") {
    if (typeof rule.monthlyDay === "number" || rule.monthlyDay === "last") {
      const currentPeriodKey = `${todayKey.slice(0, 7)}-${`${resolveMonthlyTargetDay(today, rule.monthlyDay)}`.padStart(2, "0")}`;
      return todayKey >= currentPeriodKey && latestCompletedKey < currentPeriodKey;
    }
    return addMonthsToDateKey(latestCompletedKey, 1) <= todayKey;
  }

  return false;
}

function resolveMonthlyTargetDay(date: Date, day: number | "last"): number {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return day === "last" ? lastDay : Math.min(day, lastDay);
}

function addMonthsToDateKey(dateKey: string, months: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return formatDateKey(date);
}

export async function offloadReferencesFromMasterHub(content: string, vault: Vault, masterTodoPath: string): Promise<ReferenceOffloadResult> {
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

export function looksLikeBreakdownTask(taskText: string): boolean {
  return taskText.length >= 80 || /\band\b|\bthen\b|\bcleanup\b|\brefactor\b/i.test(taskText);
}

export function extractArchivedDate(value: string): string | null {
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function daysBetween(startDateKey: string, endDateKey: string): number {
  const start = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

export function computeHealthScore(input: {
  projectState: "active" | "incubating" | "someday";
  openCount: number;
  staleDays: number | null;
  reviewStaleDays: number | null;
  completionsThisWeek: number;
  nowCount: number;
  nextCount: number;
  dueSoonCount: number;
  overdueCount: number;
  blockedCount: number;
  breakdownCount: number;
  duplicateCount: number;
  hasProjectSummary: boolean;
  hasDefinitionOfDone: boolean;
  hasWaitingOn: boolean;
}): number {
  let score = input.projectState === "active" ? 100 : input.projectState === "incubating" ? 82 : 78;
  if (input.projectState === "active") {
    score -= Math.min(input.openCount * 2, 30);
    score -= Math.min((input.staleDays ?? 0), 25);
    score -= Math.min(Math.max((input.reviewStaleDays ?? 14) - 7, 0), 18);
    score += Math.min(input.completionsThisWeek * 4, 16);
    score += Math.min(input.nowCount * 3, 9);
    score += Math.min(input.nextCount * 1, 4);
    score += input.hasProjectSummary ? 0 : -4;
    score += input.hasDefinitionOfDone ? 0 : -6;
  } else {
    score += Math.min(input.completionsThisWeek * 2, 8);
    score += input.nowCount > 0 ? 2 : 0;
    score += input.nextCount > 0 ? 1 : 0;
  }

  score -= input.dueSoonCount * 2;
  score -= input.overdueCount * 7;
  score -= input.blockedCount * 5;
  score += input.blockedCount > 0 && input.hasWaitingOn ? 3 : 0;
  score -= input.blockedCount > 0 && !input.hasWaitingOn ? 4 : 0;
  score -= input.breakdownCount * 5;
  score -= input.duplicateCount * 6;
  return clamp(score, 0, 100);
}

export function describeHealthScore(score: number): string {
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

export function buildCleanupSuggestions(project: TodoProjectSummary): CleanupSuggestion[] {
  const suggestions: CleanupSuggestion[] = [];
  if (project.projectState === "active" && project.staleDays !== null && project.staleDays >= 14) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "stale-project"),
      projectName: project.name,
      kind: "stale-project",
      summary: `${project.name}: review stale backlog or re-scope the project.`,
      detail: `${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since the last archived completion.`,
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.duplicateTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "duplicate-tasks"),
      projectName: project.name,
      kind: "duplicate-tasks",
      summary: `${project.name}: merge duplicate tasks (${project.duplicateTasks.slice(0, 3).join(", ")}).`,
      detail: `${project.duplicateTasks.length} duplicate task${project.duplicateTasks.length === 1 ? "" : "s"} detected in the project hub.`,
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.breakdownTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "breakdown-tasks"),
      projectName: project.name,
      kind: "breakdown-tasks",
      summary: `${project.name}: break down ${project.breakdownTasks.length} oversized task${project.breakdownTasks.length === 1 ? "" : "s"}.`,
      detail: project.breakdownTasks.slice(0, 3).join(" • "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.overdueTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "overdue-tasks"),
      projectName: project.name,
      kind: "overdue-tasks",
      summary: `${project.name}: clear ${project.overdueTasks.length} overdue task${project.overdueTasks.length === 1 ? "" : "s"}.`,
      detail: project.overdueTasks.slice(0, 3).map((task) => task.dueDate ? `${task.text} (${task.dueDate})` : task.text).join(" • "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.blockedTasks.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "blocked-tasks"),
      projectName: project.name,
      kind: "blocked-tasks",
      summary: `${project.name}: review ${project.blockedTasks.length} blocked task${project.blockedTasks.length === 1 ? "" : "s"}.`,
      detail: project.blockedTasks.slice(0, 3).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" • "),
      action: "open-master-todo",
      actionLabel: "Open hub"
    });
  }
  if (project.emptySections.length > 0) {
    suggestions.push({
      id: buildCleanupSuggestionId(project.name, "empty-sections"),
      projectName: project.name,
      kind: "empty-sections",
      summary: `${project.name}: prune empty sections (${project.emptySections.join(", ")}).`,
      detail: `Empty sections: ${project.emptySections.join(", ")}`,
      action: "open-cleanup-note",
      actionLabel: "Cleanup note"
    });
  }
  return suggestions;
}

function buildCleanupSuggestionId(projectName: string, kind: CleanupSuggestion["kind"]): string {
  const normalizedProject = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `cleanup:${kind}:${normalizedProject}`;
}

function inferProjectState(status: string): TodoProjectSummary["projectState"] {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("someday")) {
    return "someday";
  }
  if (normalized.includes("incubat")) {
    return "incubating";
  }
  return "active";
}

function selectProjectNextAction(input: {
  projectName: string;
  projectState: TodoProjectSummary["projectState"];
  lastReview: string;
  reviewStaleDays: number | null;
  waitingOn: string;
  definitionOfDone: string;
  overdueTasks: TodoTaskSummary[];
  dueSoonTasks: TodoTaskSummary[];
  nowTaskDetails: TodoTaskSummary[];
  nextTaskDetails: TodoTaskSummary[];
  dueRepeatingTaskDetails: TodoTaskSummary[];
  laterTaskDetails: TodoTaskSummary[];
}): string {
  const actionableTask = [
    ...input.overdueTasks,
    ...input.dueSoonTasks,
    ...input.nowTaskDetails,
    ...input.nextTaskDetails,
    ...input.dueRepeatingTaskDetails,
    ...input.laterTaskDetails
  ].find((task) => !task.isBlocked && task.text.trim().length > 0);

  if (actionableTask) {
    return actionableTask.text;
  }

  if (input.waitingOn.trim().length > 0) {
    return `Follow up on waiting on: ${input.waitingOn.trim()}`;
  }

  if (input.projectState === "active" && input.definitionOfDone.trim().length === 0) {
    return `Define what done means for ${input.projectName}.`;
  }

  if (input.projectState === "active" && (input.reviewStaleDays ?? 999) >= 14) {
    const reviewLabel = input.lastReview.trim().length > 0 ? input.lastReview.trim() : "not recorded";
    return `Review ${input.projectName} and refresh Now/Next (last review: ${reviewLabel}).`;
  }

  if (input.projectState === "someday") {
    return "Incubating in someday. Promote one concrete task when ready.";
  }

  if (input.projectState === "incubating") {
    return "Define the first real next step before activating this project.";
  }

  return `Define the next action for ${input.projectName}.`;
}

function buildProjectHealthReasons(input: {
  projectName: string;
  projectState: TodoProjectSummary["projectState"];
  staleDays: number | null;
  lastReview: string;
  reviewStaleDays: number | null;
  waitingOn: string;
  definitionOfDone: string;
  projectSummary: string;
  overdueTasks: TodoTaskSummary[];
  dueSoonTasks: TodoTaskSummary[];
  blockedTasks: TodoTaskSummary[];
  duplicateTasks: Set<string>;
  breakdownTasks: string[];
  emptySections: Set<string>;
  nowTaskDetails: TodoTaskSummary[];
  nextTaskDetails: TodoTaskSummary[];
  nextAction: string;
}): string[] {
  const reasons: string[] = [];
  if (input.projectState !== "active") {
    reasons.push(input.projectState === "someday" ? "Parked as someday work." : "Marked incubating until it is ready for active execution.");
  }
  if (input.projectState === "active" && input.projectSummary.trim().length === 0) {
    reasons.push("Project summary is missing.");
  }
  if (input.projectState === "active" && input.definitionOfDone.trim().length === 0) {
    reasons.push("Definition of done is missing.");
  }
  if (input.projectState === "active" && input.reviewStaleDays === null) {
    reasons.push("No project review date recorded.");
  } else if ((input.reviewStaleDays ?? 0) >= 14) {
    reasons.push(`Last review was ${input.reviewStaleDays} day${input.reviewStaleDays === 1 ? "" : "s"} ago.`);
  }
  if (input.waitingOn.trim().length > 0) {
    reasons.push(`Waiting on: ${input.waitingOn.trim()}.`);
  }
  if (input.overdueTasks.length > 0) {
    reasons.push(`${input.overdueTasks.length} overdue task${input.overdueTasks.length === 1 ? "" : "s"}.`);
  }
  if (input.dueSoonTasks.length > 0) {
    reasons.push(`${input.dueSoonTasks.length} due soon.`);
  }
  if (input.blockedTasks.length > 0) {
    reasons.push(`${input.blockedTasks.length} blocked task${input.blockedTasks.length === 1 ? "" : "s"}.`);
  }
  if (input.projectState === "active" && input.staleDays !== null && input.staleDays >= 7) {
    reasons.push(`No completion for ${input.staleDays} day${input.staleDays === 1 ? "" : "s"}.`);
  }
  if (input.nowTaskDetails.length === 0 && input.projectState === "active") {
    reasons.push("No task in Now.");
  }
  if (input.nextTaskDetails.length === 0 && input.projectState === "active") {
    reasons.push("No task in Next.");
  }
  if (input.breakdownTasks.length > 0) {
    reasons.push(`${input.breakdownTasks.length} task${input.breakdownTasks.length === 1 ? " looks" : "s look"} too large.`);
  }
  if (input.duplicateTasks.size > 0) {
    reasons.push(`${input.duplicateTasks.size} duplicate task${input.duplicateTasks.size === 1 ? "" : "s"}.`);
  }
  if (input.emptySections.size > 0) {
    reasons.push(`Empty sections: ${Array.from(input.emptySections).join(", ")}.`);
  }
  reasons.push(`Next action: ${input.nextAction}`);
  return reasons.slice(0, 6);
}

function extractTrackedDate(value: string): string | null {
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseTodoTaskSummary(rawText: string, section: string, now: Date): TodoTaskSummary {
  const dueDate = extractTaskAnnotation(rawText, "due");
  const blockedReason = extractTaskAnnotation(rawText, "blocked");
  const unblockDate = extractTaskAnnotation(rawText, "unblock") || extractTaskAnnotation(rawText, "blocked-until");
  const text = stripTaskAnnotations(rawText).trim();
  const todayKey = formatDateKey(now);
  const isOverdue = Boolean(dueDate && dueDate < todayKey);
  const isDueSoon = Boolean(dueDate && !isOverdue && daysBetween(todayKey, dueDate) <= 3);

  return {
    text: text || rawText,
    rawText,
    section,
    dueDate: dueDate ?? "",
    blockedReason: blockedReason ?? "",
    unblockDate: unblockDate ?? "",
    isBlocked: Boolean(blockedReason),
    isDueSoon,
    isOverdue
  };
}

function extractTaskAnnotation(value: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`\\[${escapedKey}:\\s*([^\]]+)\\]`, "i"));
  return match?.[1]?.trim() || null;
}

function stripTaskAnnotations(value: string): string {
  return value
    .replace(/\s*\[(?:due|blocked|unblock|blocked-until):\s*[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function appendLinesToSection(content: string, sectionName: string, linesToAppend: string[]): string {
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