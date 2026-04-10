import { TFile, Vault, normalizePath } from "obsidian";

import { clamp, computeMissedHabits, formatDateKey, formatDateTimeKey, renderScore } from "./dashboard-core";
import {
  type CleanupSuggestion,
  type ArchiveMaintenanceResult,
  CHECKLIST_REGEX,
  type KanbanBoardConfiguration,
  type KanbanBoardTemplate,
  type KanbanLaneDefinition,
  type KanbanLaneOption,
  type KanbanSyncConflict,
  type KanbanTaskRegistryEntry,
  type KanbanMigrationPreview,
  type KanbanMigrationTaskPreview,
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
  type KanbanLane,
  type TodoTaskSummary,
  type TodoProjectRange,
  type TodoProjectSummary,
  type TodoSnapshot,
  type WeeklyReviewInput
} from "./dashboard-types";

const NON_PROJECT_HUB_HEADINGS = new Set(["portfolio snapshot"]);
const TASK_ID_ANNOTATION_KEY = "task-id";
const KANBAN_LANE_ORDER: KanbanLane[] = ["Now", "Next", "Later", "Waiting", "Parking Lot", "Done"];
const KANBAN_CATEGORIES_META_KEY = "kanban categories";

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
    const sectionNames = new Set<string>();
    let kanbanCategoryLabels: Record<string, string> = {};
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
    const openTaskDetails: TodoTaskSummary[] = [];
    const nowTaskDetails: TodoTaskSummary[] = [];
    const nextTaskDetails: TodoTaskSummary[] = [];
    const laterTaskDetails: TodoTaskSummary[] = [];
    const waitingTaskDetails: TodoTaskSummary[] = [];
    const parkingLotTaskDetails: TodoTaskSummary[] = [];
    const completedTaskDetails: TodoTaskSummary[] = [];
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
        if (meta.key === KANBAN_CATEGORIES_META_KEY) {
          kanbanCategoryLabels = parseKanbanCategoryMetadataValue(meta.value);
        }
        extractNoteLinks(meta.value).forEach((link) => noteLinks.add(link));
      }

      const sectionName = getSectionName(line);
      if (sectionName) {
        currentSection = sectionName;
        sectionNames.add(sectionName);
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
      const normalizedKanbanSection = normalizeLegacyKanbanSectionName(currentSection);
      const isComplete = taskMatch[1].toLowerCase() === "x";

      emptySections.delete(currentSection);
      seenTasks.set(normalizedTask, (seenTasks.get(normalizedTask) ?? 0) + 1);
      if ((seenTasks.get(normalizedTask) ?? 0) > 1) {
        duplicateTasks.add(taskText);
      }

      if (sectionKey === "completed archive" || isComplete) {
        archivedCount += 1;
        if (sectionKey === "completed archive") {
          const archivedTask = parseArchivedArchiveTask(taskMatch[2].trim(), project.name);
          if (archivedTask) {
            const completedSummary = parseTodoTaskSummary(archivedTask.text, archivedTask.section, now);
            completedTaskDetails.push({ ...completedSummary, kanbanLane: "Done", completedAt: archivedTask.archivedAt });
          }
        } else {
          completedTaskDetails.push({ ...taskSummary, kanbanLane: "Done" });
        }
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
      openTaskDetails.push(taskSummary);
      if (normalizedKanbanSection === "now") {
        nowTasks.push(taskSummary.text);
        nowTaskDetails.push(taskSummary);
      }
      if (normalizedKanbanSection === "next") {
        nextTasks.push(taskSummary.text);
        nextTaskDetails.push(taskSummary);
      }
      if (normalizedKanbanSection === "later") {
        laterTasks.push(taskSummary.text);
        laterTaskDetails.push(taskSummary);
      }
      if (taskSummary.kanbanLane === "Waiting") {
        waitingTaskDetails.push(taskSummary);
      }
      if (taskSummary.kanbanLane === "Parking Lot") {
        parkingLotTaskDetails.push(taskSummary);
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
      sectionNames: Array.from(sectionNames),
      kanbanCategoryLabels,
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
      openTaskDetails,
      nowTaskDetails,
      nextTaskDetails,
      laterTaskDetails,
      waitingTaskDetails,
      parkingLotTaskDetails,
      completedTaskDetails,
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
    const headingName = line.replace(/^##\s+/, "").trim();
    return NON_PROJECT_HUB_HEADINGS.has(headingName.toLowerCase()) ? null : headingName;
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

export function renderTodoProjectBlock(input: CreateProjectInput & { projectNoteLink: string; workflowSections?: string[]; doneSectionName?: string }): string {
  const today = formatDateKey(new Date());
  const workflowSections = (input.workflowSections ?? ["Now", "Next", "Later", "Waiting", "Parking Lot"])
    .filter((section, index, array) => section.trim().length > 0 && array.indexOf(section) === index);
  const doneSectionName = input.doneSectionName?.trim() || "Done";
  const workflowBlocks = workflowSections.flatMap((section) => [
    `### ${section}`,
    section.toLowerCase() === "parking lot" ? "- Idea:" : "- [ ]",
    ""
  ]);

  return [
    `## ${input.projectName}`,
    `Project Note:: ${input.projectNoteLink}`,
    `Status:: ${input.status}`,
    ...(input.focus.trim() ? [`Focus:: ${input.focus.trim()}`] : []),
    `Project Summary:: ${input.projectName} is an active project inside Obsidian DASH.` ,
    "Why It Matters:: Define why this project deserves attention right now.",
    "Definition Of Done:: Describe what meaningful progress or completion looks like.",
    `Last Review:: ${today}`,
    "Waiting On:: None",
    "Relationships::",
    "",
    ...workflowBlocks,
    `### ${doneSectionName}`,
    "- [ ]",
    "",
    "### Reference",
    "- Add durable support material here."
  ].join("\n");
}

export function renderProjectNoteTemplate(
  input: CreateProjectInput,
  masterTodoPath: string,
  workflowSections: string[] = ["Now", "Next", "Later", "Waiting", "Parking Lot"],
  doneSectionName = "Done"
): string {
  const today = formatDateKey(new Date());
  const normalizedWorkflowSections = workflowSections
    .filter((section, index, array) => section.trim().length > 0 && array.indexOf(section) === index);
  const laneBlocks = normalizedWorkflowSections.flatMap((section) => [
    `### ${section}`,
    section.toLowerCase() === "parking lot" ? "- Idea:" : "- [ ]",
    ""
  ]);
  return [
    `# ${input.projectName}`,
    "",
    `Status:: ${input.status || "Planning"}`,
    ...(input.focus.trim() ? [`Focus:: ${input.focus.trim()}`] : []),
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
    ...laneBlocks,
    `### ${doneSectionName}`,
    "- [ ]",
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
    "## Change Log",
    `- ${today}: Project note created from the DASH project template.`,
    "",
    "## Known Terms / Definitions",
    "- Capture domain-specific language, abbreviations, or naming rules here.",
    "",
    "## References",
    "- Add links, assets, commands, or supporting notes here.",
    "",
    "## Useful Links / Assets",
    "- Add durable repo links, docs, screenshots, files, or commands here.",
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
    "### Waiting",
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
    "## Change Log",
    `- ${today}: Existing project note template generated from the Master Task Hub.`,
    "",
    "## Known Terms / Definitions",
    "- Capture domain-specific language, abbreviations, or naming rules here.",
    "",
    "## Review History",
    `- ${today}: Existing project note template generated from the Master Task Hub.`,
    "",
    "## References",
    "- Move or summarize project-specific references here over time.",
    "",
    "## Useful Links / Assets",
    "- Add durable repo links, docs, screenshots, files, or commands here.",
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

export function backfillMasterHubTaskIds(content: string): { content: string; addedTaskIds: number } {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, addedTaskIds: 0 };
  }

  const output = [...lines];
  let addedTaskIds = 0;

  [...projectRanges].reverse().forEach((project) => {
    const result = ensureTaskIdsInProjectLines(output.slice(project.start, project.end + 1), project.name);
    if (result.addedTaskIds === 0) {
      return;
    }

    output.splice(project.start, project.end - project.start + 1, ...result.lines);
    addedTaskIds += result.addedTaskIds;
  });

  return {
    content: output.join("\n"),
    addedTaskIds
  };
}

export function inspectMasterHubKanbanMigration(content: string): KanbanMigrationPreview {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  const tasksWithVisibleId: KanbanMigrationTaskPreview[] = [];
  const tasksMissingVisibleId: KanbanMigrationTaskPreview[] = [];
  const brokenLegacyTaskLines: KanbanMigrationTaskPreview[] = [];
  let totalTasks = 0;
  let openTasks = 0;
  let archivedTasks = 0;

  projectRanges.forEach((project) => {
    let currentSection = "General";

    for (let index = project.start + 1; index <= project.end; index += 1) {
      const line = lines[index];
      const sectionName = getSectionName(line);
      if (sectionName) {
        currentSection = sectionName;
        continue;
      }

      const taskMatch = line.match(CHECKLIST_REGEX);
      if (!taskMatch) {
        const brokenTask = parseBrokenLegacyKanbanTaskLine(line);
        if (brokenTask) {
          const taskPreview: KanbanMigrationTaskPreview = {
            projectName: project.name,
            sectionName: currentSection,
            taskText: parseTodoTaskSummary(brokenTask.rawText, currentSection, new Date()).text,
            taskId: brokenTask.taskId,
            checked: brokenTask.checked,
            lineNumber: index + 1
          };

          totalTasks += 1;
          if (brokenTask.checked || currentSection.trim().toLowerCase() === "completed archive") {
            archivedTasks += 1;
          } else {
            openTasks += 1;
          }

          brokenLegacyTaskLines.push(taskPreview);
        }
        continue;
      }

      const sectionKey = currentSection.trim().toLowerCase();
      if (sectionKey === "reference" || sectionKey === "resources") {
        continue;
      }

      const rawTaskText = taskMatch[2].trim();
      if (!rawTaskText) {
        continue;
      }

      const checked = taskMatch[1].toLowerCase() === "x";
      const taskId = extractTaskAnnotation(rawTaskText, TASK_ID_ANNOTATION_KEY) ?? "";
      const taskPreview: KanbanMigrationTaskPreview = {
        projectName: project.name,
        sectionName: currentSection,
        taskText: parseTodoTaskSummary(rawTaskText, currentSection, new Date()).text,
        taskId,
        checked,
        lineNumber: index + 1
      };

      totalTasks += 1;
      if (checked || sectionKey === "completed archive") {
        archivedTasks += 1;
      } else {
        openTasks += 1;
      }

      if (taskId) {
        tasksWithVisibleId.push(taskPreview);
      } else if (!checked && sectionKey !== "completed archive") {
        tasksMissingVisibleId.push(taskPreview);
      }
    }
  });

  return {
    totalTasks,
    openTasks,
    archivedTasks,
    tasksWithVisibleId,
    tasksMissingVisibleId,
    brokenLegacyTaskLines
  };
}

export function applyKanbanCleanupMigration(content: string): {
  content: string;
  removedVisibleTaskIds: number;
  remainingBrokenLegacyTaskLines: number;
} {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return {
      content,
      removedVisibleTaskIds: 0,
      remainingBrokenLegacyTaskLines: 0
    };
  }

  const output = [...lines];
  let removedVisibleTaskIds = 0;
  let remainingBrokenLegacyTaskLines = 0;

  projectRanges.forEach((project) => {
    let currentSection = "General";

    for (let index = project.start + 1; index <= project.end; index += 1) {
      const line = output[index];
      const sectionName = getSectionName(line);
      if (sectionName) {
        currentSection = sectionName;
        continue;
      }

      if (parseBrokenLegacyKanbanTaskLine(line, currentSection)) {
        remainingBrokenLegacyTaskLines += 1;
        continue;
      }

      const taskMatch = line.match(CHECKLIST_REGEX);
      if (!taskMatch) {
        continue;
      }

      const rawTaskText = taskMatch[2];
      if (!extractTaskAnnotation(rawTaskText, TASK_ID_ANNOTATION_KEY)) {
        continue;
      }

      const cleanedTaskText = removeTaskAnnotation(rawTaskText, TASK_ID_ANNOTATION_KEY);
      if (cleanedTaskText === rawTaskText.trim()) {
        continue;
      }

      output[index] = line.replace(rawTaskText, cleanedTaskText);
      removedVisibleTaskIds += 1;
    }
  });

  return {
    content: removedVisibleTaskIds > 0 ? output.join("\n") : content,
    removedVisibleTaskIds,
    remainingBrokenLegacyTaskLines
  };
}

export function repairBrokenKanbanMasterHubLines(content: string): { content: string; repairedTasks: number } {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, repairedTasks: 0 };
  }

  const output = [...lines];
  let repairedTasks = 0;

  [...projectRanges].reverse().forEach((project) => {
    const result = repairBrokenKanbanTaskLinesInProject(output.slice(project.start, project.end + 1));
    if (result.repairedTasks === 0) {
      return;
    }

    output.splice(project.start, project.end - project.start + 1, ...result.lines);
    repairedTasks += result.repairedTasks;
  });

  return {
    content: output.join("\n"),
    repairedTasks
  };
}

export function renderKanbanHub(input: {
  snapshot: TodoSnapshot;
  generatedAt: Date;
  masterTodoPath: string;
  compatibilityMode: boolean;
  boardTemplates?: Record<string, KanbanBoardTemplate>;
  boardConfigurations?: Record<string, KanbanBoardConfiguration>;
}): string {
  const activeProjects = input.snapshot.projects.filter((project) => project.projectState !== "someday");
  const visibleProjects = activeProjects.filter((project) => resolveKanbanBoardConfiguration(project, input.boardTemplates, input.boardConfigurations).showInHub);
  const todayCompleted = input.snapshot.projects.reduce((sum, project) => sum + project.completedTaskDetails.length, 0);

  if (input.compatibilityMode) {
    const laneCards = buildKanbanHubLaneCards(visibleProjects);
    return [
      "---",
      "kanban-plugin: board",
      "daily-dashboard-kanban: hub",
      `daily-dashboard-master: ${input.masterTodoPath}`,
      `daily-dashboard-generated: ${formatDateTimeKey(input.generatedAt)}`,
      "---",
      "",
      ...KANBAN_LANE_ORDER.flatMap((lane) => renderKanbanHubBoardLane(lane, laneCards.get(lane) ?? []))
    ].join("\n");
  }

  return [
    "# Kanban Hub",
    "",
    `- Generated: ${formatDateTimeKey(input.generatedAt)}`,
    `- Master Task Hub: [[${stripMarkdownExtension(input.masterTodoPath)}|Master Task Hub]]`,
    `- Project boards: ${visibleProjects.length}`,
    `- Open tracked tasks: ${input.snapshot.totalOpen}`,
    `- Archived tasks visible to Kanban: ${todayCompleted}`,
    `- Editing model: Treat this as a generated board view of the Master Task Hub. Lane moves can be synced back manually; refresh it after direct hub edits or repair flows.`,
    "",
    "## Summary Block",
    `- Main pressure: ${input.snapshot.overdueTasks.length} overdue task${input.snapshot.overdueTasks.length === 1 ? "" : "s"} and ${input.snapshot.blockedTasks.length} waiting task${input.snapshot.blockedTasks.length === 1 ? "" : "s"}.`,
    `- Main renewal: ${input.snapshot.projects.find((project) => project.waitingTaskDetails.length > 0)?.name || "No waiting-heavy project currently stands out."}`,
    `- Biggest drift risk: ${input.snapshot.staleProjects[0] ? `${input.snapshot.staleProjects[0].name} has been stale for ${input.snapshot.staleProjects[0].staleDays} days.` : "No active project currently meets the stale-project threshold."}`,
    `- Most important follow-up: ${input.snapshot.projects.find((project) => project.nextAction.trim().length > 0)?.nextAction || "Refresh the Master Task Hub and define the next real action for active work."}`,
    `- Context links: [[${stripMarkdownExtension(input.masterTodoPath)}|Master Task Hub]]`,
    "",
    ...renderKanbanBoardSummary(input.snapshot),
    ...renderKanbanBoardFilters(visibleProjects),
    ...renderKanbanReviewHelpers(input.snapshot),
    ...visibleProjects.flatMap((project) => renderKanbanProjectBoard(project, input.boardTemplates, input.boardConfigurations)),
    ...(visibleProjects.length === 0
      ? ["## Empty State", "- No active or incubating projects were found in the Master Task Hub.", ""]
      : [])
  ].join("\n");
}

function buildKanbanHubLaneCards(projects: TodoProjectSummary[]): Map<KanbanLane, Array<{ projectName: string; task: TodoTaskSummary }>> {
  const laneCards = new Map<KanbanLane, Array<{ projectName: string; task: TodoTaskSummary }>>(KANBAN_LANE_ORDER.map((lane) => [lane, []]));
  projects.forEach((project) => {
    const laneTasks = buildKanbanLaneTaskMap(project);
    KANBAN_LANE_ORDER.forEach((lane) => {
      (laneTasks.get(lane) ?? []).forEach((task) => {
        laneCards.get(lane)?.push({ projectName: project.name, task });
      });
    });
  });
  return laneCards;
}

function renderKanbanHubBoardLane(lane: KanbanLane, cards: Array<{ projectName: string; task: TodoTaskSummary }>): string[] {
  return [
    `## ${lane}`,
    ...(cards.length > 0
      ? cards.map(({ projectName, task }) => renderKanbanHubBoardTaskLine(projectName, task, lane === "Done"))
      : []),
    ""
  ];
}

function formatKanbanCompatibilityPriorityLabel(priority: string): string {
  const normalized = priority.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} priority`;
}

function getKanbanCompatibilityPriorityTone(priority: string): "urgent" | "high" | "medium" | "low" | "none" {
  const normalized = priority.trim().toLowerCase();
  if (normalized === "urgent" || normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "none";
}

function renderKanbanCompatibilityPill(label: string, value: string, kind: "project" | "priority" | "due" | "effort", tone = "none"): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const dataTone = kind === "priority" ? ` data-priority="${tone}"` : "";
  return `<span class="daily-dashboard-kanban-compat-pill" data-kind="${kind}"${dataTone}><strong>${label}</strong><span>${trimmedValue}</span></span>`;
}

function renderKanbanCompatibilityMetaRow(projectName: string, task: TodoTaskSummary, includeProject: boolean): string {
  const resolvedPriority = task.priority || getTodoTaskAnnotationValue(task.rawText, "priority");
  const resolvedDueDate = task.dueDate || getTodoTaskAnnotationValue(task.rawText, "due");
  const resolvedEffort = task.effort || getTodoTaskAnnotationValue(task.rawText, "effort");
  const pills = [
    includeProject ? renderKanbanCompatibilityPill("Project", projectName, "project") : "",
    resolvedPriority ? renderKanbanCompatibilityPill("Priority", formatKanbanCompatibilityPriorityLabel(resolvedPriority), "priority", getKanbanCompatibilityPriorityTone(resolvedPriority)) : "",
    resolvedDueDate ? renderKanbanCompatibilityPill("Due", resolvedDueDate, "due") : "",
    resolvedEffort ? renderKanbanCompatibilityPill("Effort", resolvedEffort, "effort") : ""
  ].filter((value) => value.length > 0);

  if (pills.length === 0) {
    return "";
  }

  return `<span class="daily-dashboard-kanban-compat-meta">${pills.join("")}</span><br>`;
}

function renderKanbanHubBoardTaskLine(projectName: string, task: TodoTaskSummary, checked: boolean): string {
  const metadata = [
    task.blockedReason ? `blocked ${task.blockedReason}` : "",
    task.unblockDate ? `unblock ${task.unblockDate}` : "",
    task.energy ? `energy ${task.energy}` : "",
    task.executionContext ? `context ${task.executionContext}` : "",
    task.trigger ? `trigger ${task.trigger}` : "",
    task.minimumStep ? `minimum step ${task.minimumStep}` : ""
  ].filter((value) => value.length > 0);

  return `- [${checked ? "x" : " "}] ${renderKanbanCompatibilityMetaRow(projectName, task, true)}${task.text}${metadata.length > 0 ? ` • ${metadata.join(" • ")}` : ""}${renderKanbanTaskIdComment(task.taskId)}`;
}

export function buildKanbanBoardNotePath(folderPath: string, projectName: string): string {
  const normalizedFolder = normalizePath(folderPath.trim());
  const safeName = sanitizeFileName(projectName.trim()) || "Kanban Board";
  return normalizedFolder ? `${normalizedFolder}/${safeName}.md` : `${safeName}.md`;
}

export function renderKanbanProjectBoardNote(input: {
  project: TodoProjectSummary;
  generatedAt: Date;
  masterTodoPath: string;
  compatibilityMode: boolean;
  boardTemplates?: Record<string, KanbanBoardTemplate>;
  boardConfigurations?: Record<string, KanbanBoardConfiguration>;
}): string {
  const laneTasks = buildKanbanLaneTaskMap(input.project);

  if (input.compatibilityMode) {
    return [
      "---",
      "kanban-plugin: board",
      `daily-dashboard-project: ${input.project.name}`,
      `daily-dashboard-master: ${input.masterTodoPath}`,
      "---",
      "",
      ...KANBAN_LANE_ORDER.flatMap((lane) => renderKanbanLane(lane, laneTasks.get(lane) ?? [], { headingLevel: 2, emptyPlaceholder: null }))
    ].join("\n");
  }

  const resolvedBoard = resolveKanbanBoardConfiguration(input.project, input.boardTemplates, input.boardConfigurations);
  const projectNote = input.project.noteLinks[0] ? createWikiLink(input.project.noteLinks[0], input.project.name) : input.project.name;
  const summaryMetrics = [
    `- Generated: ${formatDateTimeKey(input.generatedAt)}`,
    `- Master Task Hub: [[${stripMarkdownExtension(input.masterTodoPath)}|Master Task Hub]]`,
    `- Project note: ${projectNote}`,
    `- Board template: ${resolvedBoard.template.name}`,
    `- Status: ${input.project.status}`,
    `- Health: ${input.project.healthLabel} (${input.project.healthScore})`,
    `- Next action: ${input.project.nextAction || "None recorded."}`,
    `- Waiting on: ${input.project.waitingOn || "None"}`
  ];

  return [
    `# ${input.project.name} Kanban Board`,
    "",
    ...summaryMetrics,
    "",
    ...renderNativeKanbanProjectSections(input.project, resolvedBoard, { headingLevel: 2 })
  ].join("\n");
}

export function syncKanbanHubToMasterHub(input: {
  masterContent: string;
  kanbanContent: string;
  archivedAt: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
  boardTemplates?: Record<string, KanbanBoardTemplate>;
  boardConfigurations?: Record<string, KanbanBoardConfiguration>;
}): { content: string; movedTasks: number; completedTasks: number; missingTasks: number; conflictedTasks: number; conflicts: KanbanSyncConflict[] } {
  return syncKanbanCardsToMasterHub(
    input.masterContent,
    parseKanbanHubCards(input.kanbanContent, input.boardTemplates, input.boardConfigurations),
    input.archivedAt,
    input.taskRegistry
  );
}

export function syncKanbanBoardNoteToMasterHub(input: {
  masterContent: string;
  boardContent: string;
  archivedAt: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
  boardTemplates?: Record<string, KanbanBoardTemplate>;
  boardConfigurations?: Record<string, KanbanBoardConfiguration>;
}): { content: string; movedTasks: number; completedTasks: number; missingTasks: number; conflictedTasks: number; conflicts: KanbanSyncConflict[]; projectName: string } {
  const projectName = parseKanbanBoardProjectName(input.boardContent);
  if (!projectName) {
    return {
      content: input.masterContent,
      movedTasks: 0,
      completedTasks: 0,
      missingTasks: 0,
      conflictedTasks: 0,
      conflicts: [],
      projectName: ""
    };
  }

  const synced = syncKanbanCardsToMasterHub(
    input.masterContent,
    parseKanbanBoardCards(input.boardContent, projectName, input.boardTemplates, input.boardConfigurations),
    input.archivedAt,
    input.taskRegistry
  );
  return {
    ...synced,
    projectName
  };
}

function syncKanbanCardsToMasterHub(masterContent: string, cards: Array<{ projectName: string; taskId: string; checked: boolean; laneLabel: string; targetSection: string; done: boolean; ambiguous: boolean }>, archivedAt: string, taskRegistry: Record<string, KanbanTaskRegistryEntry> = {}): { content: string; movedTasks: number; completedTasks: number; missingTasks: number; conflictedTasks: number; conflicts: KanbanSyncConflict[] } {
  let content = masterContent;
  let movedTasks = 0;
  let missingTasks = 0;
  let conflictedTasks = 0;
  const conflicts: KanbanSyncConflict[] = [];

  cards.forEach((card) => {
    if (!card.taskId) {
      return;
    }

    if (card.ambiguous || !card.targetSection) {
      conflictedTasks += 1;
      conflicts.push({
        projectName: card.projectName,
        taskId: card.taskId,
        laneLabel: card.laneLabel,
        reason: card.ambiguous ? "ambiguous-match" : "unmapped-lane",
        detail: card.ambiguous
          ? `The lane label ${card.laneLabel} matches more than one mapping for this board.`
          : `The lane label ${card.laneLabel} does not map to a hub section for this board.`
      });
      return;
    }

    if (card.done || card.checked) {
      const completed = markTaskCompleteById(content, card.projectName, card.taskId, taskRegistry);
      if (completed.marked) {
        content = completed.content;
      } else {
        missingTasks += 1;
        conflicts.push({
          projectName: card.projectName,
          taskId: card.taskId,
          laneLabel: card.laneLabel,
          reason: "missing-task",
          detail: "The completed board card could not be matched back to the Master Task Hub."
        });
      }
      return;
    }

    const location = findProjectTaskLocationById(content, card.projectName, card.taskId, taskRegistry);
    if (!location) {
      missingTasks += 1;
      conflicts.push({
        projectName: card.projectName,
        taskId: card.taskId,
        laneLabel: card.laneLabel,
        reason: "missing-task",
        detail: "The board card could not be matched back to the Master Task Hub."
      });
      return;
    }

    const targetSection = card.targetSection;
    if (normalizeLegacyKanbanSectionName(location.section) === targetSection.toLowerCase()) {
      return;
    }

    const removed = removeTaskByIdFromProject(content, card.projectName, card.taskId, taskRegistry);
    if (!removed) {
      missingTasks += 1;
      conflicts.push({
        projectName: card.projectName,
        taskId: card.taskId,
        laneLabel: card.laneLabel,
        reason: "missing-task",
        detail: "The board card location changed before the lane move could be written back."
      });
      return;
    }

    const movedTaskText = targetSection === "Waiting"
      ? removed.taskText
      : stripBlockingTaskAnnotations(removed.taskText);
    content = insertTaskIntoProjectSection(removed.content, card.projectName, targetSection, movedTaskText);
    movedTasks += 1;
  });

  const archived = archiveCompletedTasks(content, archivedAt);
  return {
    content: archived.content,
    movedTasks,
    completedTasks: archived.archivedTasks.length,
    missingTasks,
    conflictedTasks,
    conflicts
  };
}

export function getKanbanLaneOptionsForProject(
  projectName: string,
  boardTemplates: Record<string, KanbanBoardTemplate> = {},
  boardConfigurations: Record<string, KanbanBoardConfiguration> = {}
): KanbanLaneOption[] {
  const laneDefinitions = resolveKanbanLaneDefinitionsForProject(projectName, boardTemplates, boardConfigurations);
  return laneDefinitions.map((lane) => ({
    laneKey: lane.laneKey,
    label: lane.label,
    helperText: lane.helperText,
    columnKey: lane.columnKey,
    categoryKey: lane.categoryKey,
    categoryLabel: lane.categoryLabel,
    categorySubtitle: lane.categorySubtitle,
    categoryColor: lane.categoryColor,
    categoryTag: lane.categoryTag,
    targetSection: lane.done ? "Done" : lane.mappedSections[0] ?? "",
    done: lane.done,
    unmapped: !lane.done && lane.mappedSections.length === 0
  }));
}

export function repairMasterHubStructure(content: string, input: {
  masterTodoPath: string;
  projectNotesFolder: string;
  includeKanbanTaskIds?: boolean;
}): { content: string; updatedProjects: number; addedMetadata: number; addedSections: number; addedTaskIds: number; repairedBrokenTasks: number } {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, updatedProjects: 0, addedMetadata: 0, addedSections: 0, addedTaskIds: 0, repairedBrokenTasks: 0 };
  }

  const output = [...lines];
  let updatedProjects = 0;
  let addedMetadata = 0;
  let addedSections = 0;
  let addedTaskIds = 0;
  let repairedBrokenTasks = 0;

  [...projectRanges].reverse().forEach((project) => {
    const result = repairMasterHubProjectLines(output.slice(project.start, project.end + 1), {
      masterTodoPath: input.masterTodoPath,
      projectNotesFolder: input.projectNotesFolder,
      includeKanbanTaskIds: input.includeKanbanTaskIds ?? false
    });
    if (result.content !== output.slice(project.start, project.end + 1).join("\n")) {
      output.splice(project.start, project.end - project.start + 1, ...result.content.split("\n"));
      updatedProjects += 1;
      addedMetadata += result.addedMetadata;
      addedSections += result.addedSections;
      addedTaskIds += result.addedTaskIds;
      repairedBrokenTasks += result.repairedBrokenTasks;
    }
  });

  return {
    content: output.join("\n"),
    updatedProjects,
    addedMetadata,
    addedSections,
    addedTaskIds,
    repairedBrokenTasks
  };
}

export function repairProjectNoteStructure(content: string, input: {
  projectName: string;
  masterTodoPath: string;
  notePath: string;
}): { content: string; addedMetadata: number; addedSections: number } {
  const originalLines = content.split(/\r?\n/);
  const lines = [...originalLines];
  let addedMetadata = 0;
  let addedSections = 0;

  if (!lines.some((line) => /^#\s+/.test(line.trim()))) {
    lines.unshift(`# ${input.projectName}`, "");
  }

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  const metadataKeys = new Set(lines.map((line) => parseProjectMeta(line)?.key).filter((key): key is string => Boolean(key)));
  const metadataInsertIndex = getProjectNoteMetadataInsertIndex(lines, titleIndex);
  const noteLink = createWikiLink(input.notePath, input.projectName);
  const missingMetaLines = [
    !metadataKeys.has("status") ? "Status:: Planning" : "",
    !metadataKeys.has("focus") ? "Focus:: Define the current focus for this project." : "",
    !metadataKeys.has("project summary") ? `Project Summary:: ${input.projectName} is an active project inside Obsidian DASH.` : "",
    !metadataKeys.has("why it matters") ? "Why It Matters:: Define why this project deserves attention right now." : "",
    !metadataKeys.has("definition of done") ? "Definition Of Done:: Describe what meaningful progress or completion looks like." : "",
    !metadataKeys.has("last review") ? `Last Review:: ${formatDateKey(new Date())}` : "",
    !metadataKeys.has("waiting on") ? "Waiting On:: None" : "",
    !metadataKeys.has("relationships") ? `Relationships:: [[${stripMarkdownExtension(input.masterTodoPath)}|Master Task Hub]], ${noteLink}` : ""
  ].filter((line) => line.length > 0);

  if (missingMetaLines.length > 0) {
    lines.splice(metadataInsertIndex, 0, ...missingMetaLines);
    addedMetadata += missingMetaLines.length;
  }

  const existingSections = new Set(lines
    .map((line) => getMarkdownHeadingName(line))
    .filter((heading): heading is string => Boolean(heading))
    .map((heading) => heading.toLowerCase()));
  const sectionsToAdd: Array<{ heading: string; body: string[] }> = [
    { heading: "Current Bottleneck", body: ["- Capture the main constraint, ambiguity, or drag factor here."] },
    { heading: "Current Focus", body: ["- Add the current objective here."] },
    { heading: "Repeating Tasks", body: ["- [ ] Weekly review [weekly]"] },
    { heading: "Priority Lanes", body: ["### Now", "- [ ]", "", "### Next", "- [ ]", "", "### Later", "- [ ]", "", "### Waiting", "- [ ]", "", "### Parking Lot", "- Idea:"] },
    { heading: "Risks", body: ["- Capture the major failure modes, drift risks, or watch-outs here."] },
    { heading: "Constraints", body: ["- Capture time, energy, dependency, or scope constraints here."] },
    { heading: "Relationships", body: ["- Related projects, dependencies, and blockers."] },
    { heading: "Review History", body: [`- ${formatDateKey(new Date())}: Added by the DASH structure repair workflow.`] },
    { heading: "Decisions", body: ["- Capture important decisions and tradeoffs here."] },
    { heading: "Change Log", body: [`- ${formatDateKey(new Date())}: Added by the DASH structure repair workflow.`] },
    { heading: "Known Terms / Definitions", body: ["- Capture domain-specific language, abbreviations, or naming rules here."] },
    { heading: "References", body: ["- Add links, assets, commands, or supporting notes here."] },
    { heading: "Useful Links / Assets", body: ["- Add durable repo links, docs, screenshots, files, or commands here."] }
  ];

  sectionsToAdd.forEach((section) => {
    if (existingSections.has(section.heading.toLowerCase())) {
      return;
    }
    appendMarkdownSection(lines, `## ${section.heading}`, section.body);
    addedSections += 1;
  });

  return {
    content: lines.join("\n"),
    addedMetadata,
    addedSections
  };
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

export function formatKanbanCategoryMetadataValue(categoryLabels: Record<string, string>): string {
  return Object.entries(categoryLabels)
    .map(([key, value]) => ({ key: key.trim(), value: value.trim() }))
    .filter((entry) => entry.key.length > 0 && entry.value.length > 0)
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((entry) => `${entry.key}=${entry.value}`)
    .join(" | ");
}

export function parseKanbanCategoryMetadataValue(value: string): Record<string, string> {
  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return result;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const label = entry.slice(separatorIndex + 1).trim();
      if (!key || !label) {
        return result;
      }

      result[key] = label;
      return result;
    }, {});
}

export function upsertProjectMetadataLine(content: string, input: {
  projectName: string;
  key: string;
  value: string;
}): { content: string; updated: boolean } {
  const projectName = input.projectName.trim();
  const key = input.key.trim();
  const value = input.value.trim();
  if (!projectName || !key) {
    return { content, updated: false };
  }

  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return { content, updated: false };
  }

  const output = [...lines];
  const normalizedKey = key.toLowerCase();
  let existingIndex = -1;
  let insertIndex = project.end + 1;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const meta = parseProjectMeta(output[index]);
    if (meta) {
      if (meta.key === normalizedKey) {
        existingIndex = index;
      }
      continue;
    }

    if (getSectionName(output[index])) {
      insertIndex = index;
      break;
    }
  }

  if (!value) {
    if (existingIndex === -1) {
      return { content, updated: false };
    }

    output.splice(existingIndex, 1);
    return { content: output.join("\n"), updated: true };
  }

  const nextLine = `${key}:: ${value}`;
  if (existingIndex >= 0) {
    if (output[existingIndex].trim() === nextLine) {
      return { content, updated: false };
    }

    output[existingIndex] = nextLine;
    return { content: output.join("\n"), updated: true };
  }

  output.splice(insertIndex, 0, nextLine);
  return { content: output.join("\n"), updated: true };
}

export function renameProjectSectionHeading(content: string, input: {
  projectName: string;
  currentSectionName: string;
  nextSectionName: string;
}): { content: string; updated: boolean; collision: boolean } {
  const projectName = input.projectName.trim();
  const currentSectionName = input.currentSectionName.trim();
  const nextSectionName = input.nextSectionName.trim();
  if (!projectName || !currentSectionName || !nextSectionName || currentSectionName.toLowerCase() === nextSectionName.toLowerCase()) {
    return { content, updated: false, collision: false };
  }

  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return { content, updated: false, collision: false };
  }

  let currentSectionIndex = -1;
  let targetAlreadyExists = false;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const sectionName = getSectionName(lines[index]);
    if (!sectionName) {
      continue;
    }

    if (sectionName.toLowerCase() === nextSectionName.toLowerCase()) {
      targetAlreadyExists = true;
    }
    if (currentSectionIndex === -1 && sectionName.toLowerCase() === currentSectionName.toLowerCase()) {
      currentSectionIndex = index;
    }
  }

  if (currentSectionIndex === -1) {
    return { content, updated: false, collision: false };
  }

  if (targetAlreadyExists) {
    return { content, updated: false, collision: true };
  }

  const output = [...lines];
  const headingPrefix = output[currentSectionIndex].match(/^\s*#+/)?.[0] ?? "###";
  output[currentSectionIndex] = `${headingPrefix} ${nextSectionName}`;
  return {
    content: output.join("\n"),
    updated: true,
    collision: false
  };
}

function repairMasterHubProjectLines(projectLines: string[], input: {
  masterTodoPath: string;
  projectNotesFolder: string;
  includeKanbanTaskIds: boolean;
}): { content: string; addedMetadata: number; addedSections: number; addedTaskIds: number; repairedBrokenTasks: number } {
  const brokenTaskRepair = repairBrokenKanbanTaskLinesInProject(projectLines);
  const lines = [...brokenTaskRepair.lines];
  const headingLine = lines[0]?.trim() ?? "";
  const projectName = headingLine.replace(/^##\s+/, "").trim();
  const metadataKeys = new Set(lines.map((line) => parseProjectMeta(line)?.key).filter((key): key is string => Boolean(key)));
  const projectNoteMeta = lines.map((line) => parseProjectMeta(line)).find((meta) => meta?.key === "project note")?.value ?? "";
  const notePath = extractFirstNoteLinkPath(projectNoteMeta) ?? buildDefaultProjectNotePath(projectName, input.projectNotesFolder);
  const metadataInsertIndex = getProjectBlockMetadataInsertIndex(lines);
  const missingMetaLines = [
    !metadataKeys.has("project note") ? `Project Note:: ${createWikiLink(notePath, projectName)}` : "",
    !metadataKeys.has("project summary") ? `Project Summary:: ${projectName} is an active project inside Obsidian DASH.` : "",
    !metadataKeys.has("why it matters") ? "Why It Matters:: Define why this project deserves attention right now." : "",
    !metadataKeys.has("definition of done") ? "Definition Of Done:: Describe what meaningful progress or completion looks like." : "",
    !metadataKeys.has("last review") ? `Last Review:: ${formatDateKey(new Date())}` : "",
    !metadataKeys.has("waiting on") ? "Waiting On:: None" : "",
    !metadataKeys.has("relationships") ? `Relationships:: [[${stripMarkdownExtension(input.masterTodoPath)}|Master Task Hub]], ${createWikiLink(notePath, projectName)}` : ""
  ].filter((line) => line.length > 0);

  if (missingMetaLines.length > 0) {
    lines.splice(metadataInsertIndex, 0, ...missingMetaLines);
  }

  const existingSections = new Set(lines
    .map((line) => getSectionName(line))
    .filter((heading): heading is string => Boolean(heading))
    .map((heading) => heading.toLowerCase()));
  const sectionsToAdd: Array<{ heading: string; body: string[] }> = [
    { heading: "Waiting", body: ["- [ ]"] },
    { heading: "Parking Lot", body: ["- Idea:"] },
    { heading: "Risks", body: ["- Capture risks, drift patterns, and failure modes here."] },
    { heading: "Constraints", body: ["- Capture hard limits, dependencies, or health constraints here."] },
    { heading: "Decisions", body: ["- Capture important decisions and tradeoffs here."] },
    { heading: "Assets", body: ["- Add durable links, files, commands, or supporting assets here."] },
    { heading: "Reference", body: ["- Add durable support material here."] },
    { heading: "Completed Archive", body: [] }
  ];

  let addedSections = 0;
  sectionsToAdd.forEach((section) => {
    if (existingSections.has(section.heading.toLowerCase())) {
      return;
    }
    appendHubSection(lines, section.heading, section.body);
    addedSections += 1;
  });

  const taskIdResult = input.includeKanbanTaskIds
    ? ensureTaskIdsInProjectLines(lines, projectName)
    : { lines, addedTaskIds: 0 };

  return {
    content: taskIdResult.lines.join("\n"),
    addedMetadata: missingMetaLines.length,
    addedSections,
    addedTaskIds: taskIdResult.addedTaskIds,
    repairedBrokenTasks: brokenTaskRepair.repairedTasks
  };
}

function repairBrokenKanbanTaskLinesInProject(projectLines: string[]): { lines: string[]; repairedTasks: number } {
  const output = [...projectLines];
  let repairedTasks = 0;
  let currentSection = "General";

  output.forEach((line, index) => {
    if (index === 0) {
      return;
    }

    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName;
      return;
    }

    const brokenTask = parseBrokenLegacyKanbanTaskLine(line, currentSection);
    if (!brokenTask) {
      return;
    }

    output[index] = `- [${brokenTask.checked ? "x" : " "}] ${brokenTask.rawText}`;
    repairedTasks += 1;
  });

  return {
    lines: output,
    repairedTasks
  };
}

function parseBrokenLegacyKanbanTaskLine(line: string, sectionName = "General"): { rawText: string; checked: boolean; taskId: string } | null {
  if (!line.includes(`[${TASK_ID_ANNOTATION_KEY}:`)) {
    return null;
  }

  if (CHECKLIST_REGEX.test(line)) {
    return null;
  }

  const trimmed = line.trim();
  const normalizedSection = sectionName.trim().toLowerCase();
  if (!trimmed || parseProjectMeta(line) || getSectionName(line) || PROJECT_SEPARATOR_REGEX.test(trimmed) || /^##+\s+/.test(trimmed)) {
    return null;
  }

  if (normalizedSection === "completed archive" || normalizedSection.includes("reference")) {
    return null;
  }

  const taskId = extractTaskAnnotation(trimmed, TASK_ID_ANNOTATION_KEY);
  if (!taskId) {
    return null;
  }

  if (/^\s+\S/.test(line)) {
    return {
      rawText: trimmed,
      checked: false,
      taskId
    };
  }

  if (/^[xX]\S/.test(line)) {
    return {
      rawText: line.slice(1).trim(),
      checked: true,
      taskId
    };
  }

  return {
    rawText: trimmed,
    checked: false,
    taskId
  };
}

function ensureTaskIdsInProjectLines(projectLines: string[], projectName: string): { lines: string[]; addedTaskIds: number } {
  const output = [...projectLines];
  let currentSection = "General";
  let addedTaskIds = 0;

  output.forEach((line, index) => {
    const sectionName = getSectionName(line);
    if (sectionName) {
      currentSection = sectionName;
      return;
    }

    const taskMatch = line.match(CHECKLIST_REGEX);
    if (!taskMatch) {
      return;
    }

    const sectionKey = currentSection.trim().toLowerCase();
    if (sectionKey === "completed archive" || sectionKey === "reference" || sectionKey === "resources") {
      return;
    }

    const taskText = taskMatch[2].trim();
    if (!taskText) {
      return;
    }

    if (extractTaskAnnotation(taskText, TASK_ID_ANNOTATION_KEY)) {
      return;
    }

    output[index] = line.replace(taskMatch[2], ensureTaskIdOnTaskText(taskText, `${projectName}-${currentSection}-${taskText}`));
    addedTaskIds += 1;
  });

  return { lines: output, addedTaskIds };
}

function ensureTaskIdOnTaskText(taskText: string, seed: string): string {
  const trimmed = taskText.trim();
  if (!trimmed) {
    return "";
  }

  const existingTaskId = extractTaskAnnotation(trimmed, TASK_ID_ANNOTATION_KEY);
  if (existingTaskId) {
    return trimmed;
  }

  return `${trimmed} [${TASK_ID_ANNOTATION_KEY}: ${createTaskId(seed)}]`;
}

function createTaskId(seed: string): string {
  const normalizedSeed = seed.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "task";
  return `${normalizedSeed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function renderKanbanProjectBoard(
  project: TodoProjectSummary,
  boardTemplates?: Record<string, KanbanBoardTemplate>,
  boardConfigurations?: Record<string, KanbanBoardConfiguration>
): string[] {
  const projectNote = project.noteLinks[0] ? createWikiLink(project.noteLinks[0], project.name) : project.name;
  const resolvedBoard = resolveKanbanBoardConfiguration(project, boardTemplates, boardConfigurations);
  const laneEntries = buildNativeKanbanLaneEntries(project, resolvedBoard.laneDefinitions);
  const summaryMetrics = [
    `${project.name}`,
    `Template ${resolvedBoard.template.name}`,
    `Open ${project.openCount}`,
    ...laneEntries.map((entry) => `${entry.label} ${entry.tasks.length}`).slice(0, 4),
    ...(project.blockedTasks.length > 0 ? [`Blocked ${project.blockedTasks.length}`] : []),
    ...(project.staleDays !== null && project.staleDays >= 7 ? [`Stale ${project.staleDays}d`] : [])
  ];
  const contextLines = [
    project.focus.trim() ? `> Focus: ${project.focus.trim()}` : "> Focus: No explicit focus recorded.",
    project.projectSummary.trim() ? `> Summary: ${project.projectSummary.trim()}` : "> Summary: No project summary recorded.",
    project.nextAction.trim() ? `> Next action: ${project.nextAction.trim()}` : "> Next action: No next action recorded.",
    project.waitingOn.trim() ? `> Waiting on: ${project.waitingOn.trim()}` : "> Waiting on: None",
    `> Template: ${resolvedBoard.template.name}`
  ];

  return [
    `## ${project.name}`,
    "",
    "<details open>",
    `<summary>${summaryMetrics.join(" • ")}</summary>`,
    "",
    `- Project note: ${projectNote}`,
    `- Status: ${project.status}`,
    `- Health: ${project.healthLabel} (${project.healthScore})`,
    `- Lane layout: ${resolvedBoard.laneDefinitions.map((lane) => lane.label).join(" | ")}`,
    "",
    "> [!info]- Project Context",
    ...contextLines,
    "",
    "> [!summary]- Board Strip",
    ...laneEntries.map((entry) => `> ${entry.label}: ${entry.tasks.length} task${entry.tasks.length === 1 ? "" : "s"}${entry.lane.helperText ? ` | ${entry.lane.helperText}` : ""}`),
    "",
    ...renderNativeKanbanProjectSections(project, resolvedBoard),
    "</details>",
    ""
  ];
}

function resolveKanbanBoardConfiguration(
  project: TodoProjectSummary,
  boardTemplates: Record<string, KanbanBoardTemplate> = {},
  boardConfigurations: Record<string, KanbanBoardConfiguration> = {}
): { template: KanbanBoardTemplate; configuration: KanbanBoardConfiguration; laneDefinitions: KanbanLaneDefinition[]; showInHub: boolean } {
  const configuration = boardConfigurations[project.name] ?? {
    projectName: project.name,
    templateId: "execution-default",
    showInHub: project.projectState !== "someday",
    laneDefinitions: [],
    updatedAt: ""
  };
  const template = boardTemplates[configuration.templateId] ?? Object.values(boardTemplates)[0] ?? {
    templateId: "execution-default",
    name: "Execution Default",
    description: "Default DASH execution board",
    laneDefinitions: buildFallbackExecutionLaneDefinitions(),
    builtIn: true,
    updatedAt: ""
  };
  const laneDefinitions = configuration.laneDefinitions.length > 0 ? configuration.laneDefinitions : template.laneDefinitions;

  return {
    template,
    configuration,
    laneDefinitions,
    showInHub: configuration.showInHub !== false
  };
}

function renderNativeKanbanProjectSections(
  project: TodoProjectSummary,
  resolvedBoard: { laneDefinitions: KanbanLaneDefinition[] },
  options?: { headingLevel?: 2 | 3 }
): string[] {
  const laneEntries = buildNativeKanbanLaneEntries(project, resolvedBoard.laneDefinitions);
  return laneEntries.flatMap((entry) => renderNativeKanbanLane(entry.lane, entry.tasks, options));
}

function buildNativeKanbanLaneEntries(project: TodoProjectSummary, laneDefinitions: KanbanLaneDefinition[]): Array<{ lane: KanbanLaneDefinition; label: string; tasks: TodoTaskSummary[] }> {
  const allTasks = [
    ...project.nowTaskDetails,
    ...project.nextTaskDetails,
    ...project.laterTaskDetails,
    ...project.waitingTaskDetails,
    ...project.parkingLotTaskDetails,
    ...project.completedTaskDetails
  ];

  const tasksByLane = new Map(laneDefinitions.map((lane) => [lane.laneKey, [] as TodoTaskSummary[]]));
  allTasks.forEach((task) => {
    const matchedLane = findBestMatchingKanbanLaneDefinition(laneDefinitions, task);
    if (!matchedLane) {
      return;
    }

    tasksByLane.get(matchedLane.laneKey)?.push(task);
  });

  return laneDefinitions.map((lane) => ({
    lane,
    label: lane.label,
    tasks: tasksByLane.get(lane.laneKey) ?? []
  }));
}

function findBestMatchingKanbanLaneDefinition(laneDefinitions: KanbanLaneDefinition[], task: TodoTaskSummary): KanbanLaneDefinition | null {
  const candidates = laneDefinitions.filter((lane) => doesKanbanLaneDefinitionBaseMatchTask(lane, task));
  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  const scoredCandidates = candidates.map((lane, index) => ({
    lane,
    index,
    score: scoreKanbanLaneDefinitionForTask(lane, task)
  }));
  scoredCandidates.sort((left, right) => right.score - left.score || left.index - right.index);
  return scoredCandidates[0]?.lane ?? null;
}

function doesKanbanLaneDefinitionBaseMatchTask(lane: KanbanLaneDefinition, task: TodoTaskSummary): boolean {
  if (lane.done) {
    return task.kanbanLane === "Done" || task.section.trim().toLowerCase() === "completed archive";
  }

  if (lane.ruleType === "custom" && lane.mappedSections.length === 0) {
    return false;
  }

  const normalizedTaskSection = normalizeLegacyKanbanSectionName(task.section);
  const normalizedTaskLane = task.kanbanLane ? task.kanbanLane.trim().toLowerCase() : "";

  return lane.mappedSections.some((section) => {
    const normalizedSection = normalizeLegacyKanbanSectionName(section);
    return normalizedSection === normalizedTaskSection || normalizedSection === normalizedTaskLane;
  });
}

function scoreKanbanLaneDefinitionForTask(lane: KanbanLaneDefinition, task: TodoTaskSummary): number {
  const laneCategoryTag = lane.categoryTag.trim().toLowerCase();
  const laneCategoryLabel = lane.categoryLabel.trim().toLowerCase();
  const taskTags = extractTodoTaskTags(task.rawText);
  const taskHints = getTodoTaskCategoryHints(task.rawText, task.section, task.kanbanLane);
  let score = 0;

  if (laneCategoryTag && taskTags.includes(laneCategoryTag)) {
    score += 100;
  }
  if (laneCategoryTag && taskHints.includes(laneCategoryTag)) {
    score += 60;
  }
  if (laneCategoryLabel && taskHints.some((hint) => laneCategoryLabel.includes(hint))) {
    score += 24;
  }

  return score;
}

function renderNativeKanbanLane(lane: KanbanLaneDefinition, tasks: TodoTaskSummary[], options?: { headingLevel?: 2 | 3 }): string[] {
  const headingPrefix = options?.headingLevel === 2 ? "##" : "###";
  const laneHeader = lane.helperText.trim().length > 0 ? `${headingPrefix} ${lane.label} (${lane.helperText.trim()})` : `${headingPrefix} ${lane.label}`;
  const emptyLine = lane.ruleType === "custom" && lane.mappedSections.length === 0
    ? "- No hub mapping yet. This lane is reserved for a future custom workflow state."
    : "- None";

  return [
    laneHeader,
    ...(tasks.length > 0 ? tasks.map((task) => renderKanbanTaskLine(task, lane.done)) : [emptyLine]),
    ""
  ];
}

function buildFallbackExecutionLaneDefinitions(): KanbanLaneDefinition[] {
  return [
    { laneKey: "now", label: "Now", helperText: "Current execution", ruleType: "hub-section", mappedSections: ["Now"], done: false },
    { laneKey: "next", label: "Next", helperText: "Queued next actions", ruleType: "hub-section", mappedSections: ["Next", "Add", "Fix"], done: false },
    { laneKey: "later", label: "Later", helperText: "Deferred but active", ruleType: "hub-section", mappedSections: ["Later"], done: false },
    { laneKey: "waiting", label: "Waiting", helperText: "Dependencies or unblockers", ruleType: "hub-section", mappedSections: ["Waiting"], done: false },
    { laneKey: "parking-lot", label: "Parking Lot", helperText: "Ideas and parked work", ruleType: "hub-section", mappedSections: ["Parking Lot"], done: false },
    { laneKey: "done", label: "Done", helperText: "Recently completed", ruleType: "completion-state", mappedSections: ["Done", "Completed Archive"], done: true }
  ];
}

function buildKanbanLaneTaskMap(project: TodoProjectSummary): Map<KanbanLane, TodoTaskSummary[]> {
  const laneTasks = new Map<KanbanLane, TodoTaskSummary[]>(KANBAN_LANE_ORDER.map((lane) => [lane, []]));
  [...project.nowTaskDetails, ...project.nextTaskDetails, ...project.laterTaskDetails, ...project.waitingTaskDetails, ...project.parkingLotTaskDetails]
    .forEach((task) => {
      if (task.kanbanLane) {
        laneTasks.get(task.kanbanLane as KanbanLane)?.push(task);
      }
    });
  laneTasks.set("Done", project.completedTaskDetails.slice(0, 12));
  return laneTasks;
}

function renderKanbanBoardSummary(snapshot: TodoSnapshot): string[] {
  const activeProjects = snapshot.projects.filter((project) => project.projectState !== "someday");
  const readyNowCount = activeProjects.filter((project) => project.nowTaskDetails.length > 0).length;
  const waitingCount = activeProjects.filter((project) => project.waitingTaskDetails.length > 0).length;
  const overdueCount = activeProjects.filter((project) => project.overdueTasks.length > 0).length;
  const staleCount = activeProjects.filter((project) => (project.staleDays ?? 0) >= 7).length;
  const doneVisibleCount = activeProjects.reduce((sum, project) => sum + project.completedTaskDetails.length, 0);

  return [
    "## Board Summary",
    `- Ready now boards: ${readyNowCount}`,
    `- Waiting-heavy boards: ${waitingCount}`,
    `- Overdue boards: ${overdueCount}`,
    `- Stale boards: ${staleCount}`,
    `- Visible done cards: ${doneVisibleCount}`,
    ""
  ];
}

function renderKanbanBoardFilters(projects: TodoProjectSummary[]): string[] {
  return [
    "## Board Filters",
    `- Ready now: ${renderKanbanProjectAnchorList(projects.filter((project) => project.nowTaskDetails.length > 0))}`,
    `- Waiting-heavy: ${renderKanbanProjectAnchorList(projects.filter((project) => project.waitingTaskDetails.length > 0 || project.blockedTasks.length > 0))}`,
    `- Overdue: ${renderKanbanProjectAnchorList(projects.filter((project) => project.overdueTasks.length > 0))}`,
    `- Stale: ${renderKanbanProjectAnchorList(projects.filter((project) => (project.staleDays ?? 0) >= 7))}`,
    ""
  ];
}

function renderKanbanProjectAnchorList(projects: TodoProjectSummary[]): string {
  if (projects.length === 0) {
    return "None";
  }

  return projects
    .slice(0, 8)
    .map((project) => `[${project.name}](${createKanbanBoardAnchor(project.name)})`)
    .join(", ");
}

function createKanbanBoardAnchor(projectName: string): string {
  const anchor = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `#${anchor || "project"}`;
}

function renderKanbanReviewHelpers(snapshot: TodoSnapshot): string[] {
  const projectMap = new Map(snapshot.projects.map((project) => [project.name.toLowerCase(), project]));
  const blockedTaskLines = snapshot.blockedTasks.slice(0, 8).map(({ project, task }) => {
    const projectSummary = projectMap.get(project.toLowerCase());
    const projectLabel = projectSummary?.noteLinks[0]
      ? createWikiLink(projectSummary.noteLinks[0], projectSummary.name)
      : project;
    const details = [
      task.blockedReason ? `blocked ${task.blockedReason}` : "",
      task.unblockDate ? `unblock ${task.unblockDate}` : "",
      projectSummary?.waitingOn.trim() && projectSummary.waitingOn.trim().toLowerCase() !== "none" ? `waiting on ${projectSummary.waitingOn.trim()}` : "",
      projectSummary?.nextAction.trim() ? `next ${projectSummary.nextAction.trim()}` : ""
    ].filter((value) => value.length > 0);

    return `- ${projectLabel}: ${task.text}${details.length > 0 ? ` | ${details.join(" | ")}` : ""}`;
  });
  const staleProjectLines = snapshot.staleProjects.slice(0, 8).map((project) => {
    const projectLabel = project.noteLinks[0] ? createWikiLink(project.noteLinks[0], project.name) : project.name;
    const details = [
      `${project.staleDays} stale day${project.staleDays === 1 ? "" : "s"}`,
      `${project.openCount} open task${project.openCount === 1 ? "" : "s"}`,
      project.waitingOn.trim().length > 0 && project.waitingOn.trim().toLowerCase() !== "none" ? `waiting on ${project.waitingOn.trim()}` : "",
      project.nextAction.trim() ? `next ${project.nextAction.trim()}` : ""
    ].filter((value) => value.length > 0);

    return `- ${projectLabel}: ${details.join(" | ")}`;
  });

  return [
    "## Review Helpers",
    "- Review blocked tasks first, then stale projects, before spending time reorganizing lanes.",
    "",
    "### Blocked Tasks",
    ...(blockedTaskLines.length > 0 ? blockedTaskLines : ["- No blocked tasks are currently visible in the Kanban snapshot."]),
    "",
    "### Stale Projects",
    ...(staleProjectLines.length > 0 ? staleProjectLines : ["- No active project currently crosses the stale threshold."]),
    ""
  ];
}

function renderKanbanLane(lane: KanbanLane, tasks: TodoTaskSummary[], options?: { headingLevel?: 2 | 3; emptyPlaceholder?: string | null }): string[] {
  const headingPrefix = options?.headingLevel === 2 ? "##" : "###";
  const emptyPlaceholder = options?.emptyPlaceholder === undefined ? "- None" : options.emptyPlaceholder;
  return [
    `${headingPrefix} ${lane}`,
    ...(tasks.length > 0
      ? tasks.map((task) => renderKanbanTaskLine(task, lane === "Done"))
      : emptyPlaceholder ? [emptyPlaceholder] : []),
    ""
  ];
}

function renderKanbanTaskLine(task: TodoTaskSummary, checked: boolean): string {
  const metadata = [
    task.blockedReason ? `blocked ${task.blockedReason}` : "",
    task.unblockDate ? `unblock ${task.unblockDate}` : "",
    task.energy ? `energy ${task.energy}` : "",
    task.executionContext ? `context ${task.executionContext}` : "",
    task.trigger ? `trigger ${task.trigger}` : "",
    task.minimumStep ? `minimum step ${task.minimumStep}` : ""
  ].filter((value) => value.length > 0);

  return `- [${checked ? "x" : " "}] ${renderKanbanCompatibilityMetaRow("", task, false)}${task.text}${metadata.length > 0 ? ` • ${metadata.join(" • ")}` : ""}${renderKanbanTaskIdComment(task.taskId)}`;
}

function parseKanbanHubCards(
  content: string,
  boardTemplates: Record<string, KanbanBoardTemplate> = {},
  boardConfigurations: Record<string, KanbanBoardConfiguration> = {}
): Array<{ projectName: string; taskId: string; checked: boolean; laneLabel: string; targetSection: string; done: boolean; ambiguous: boolean }> {
  if (/^---\r?\n[\s\S]*?kanban-plugin:\s*board[\s\S]*?---/i.test(content)) {
    return parseKanbanHubBoardCards(content);
  }

  const lines = content.split(/\r?\n/);
  const cards: Array<{ projectName: string; taskId: string; checked: boolean; laneLabel: string; targetSection: string; done: boolean; ambiguous: boolean }> = [];
  let currentProjectName = "";
  let currentLane: KanbanLaneOption | null = null;

  lines.forEach((line) => {
    const summaryMatch = line.trim().match(/^<summary>([^•<]+?)\s+• /);
    if (summaryMatch) {
      currentProjectName = summaryMatch[1].trim();
      currentLane = null;
      return;
    }

    if (line.trim() === "</details>") {
      currentProjectName = "";
      currentLane = null;
      return;
    }

    const laneMatch = line.trim().match(/^###\s+(.+?)(?:\s+\([^)]*\))?$/);
    if (laneMatch) {
      currentLane = resolveKanbanLaneOptionByLabel(currentProjectName, laneMatch[1].trim(), boardTemplates, boardConfigurations);
      return;
    }

    if (!currentProjectName || !currentLane) {
      return;
    }

    const taskMatch = line.match(CHECKLIST_REGEX);
    if (!taskMatch) {
      return;
    }

    const taskId = extractRenderedKanbanTaskId(taskMatch[2]);
    if (!taskId) {
      return;
    }

    cards.push({
      projectName: currentProjectName,
      taskId,
      checked: taskMatch[1].toLowerCase() === "x",
      laneLabel: currentLane.label,
      targetSection: currentLane.targetSection,
      done: currentLane.done,
      ambiguous: currentLane.unmapped
    });
  });

  return cards;
}

function parseKanbanHubBoardCards(content: string): Array<{ projectName: string; lane: KanbanLane; taskId: string; checked: boolean }> {
  const lines = content.split(/\r?\n/);
  const cards: Array<{ projectName: string; lane: KanbanLane; taskId: string; checked: boolean }> = [];
  let currentLane: KanbanLane | null = null;

  lines.forEach((line) => {
    const laneMatch = line.trim().match(/^## (Now|Next|Later|Waiting|Parking Lot|Done)$/);
    if (laneMatch) {
      currentLane = laneMatch[1] as KanbanLane;
      return;
    }

    if (!currentLane) {
      return;
    }

    const taskMatch = line.match(CHECKLIST_REGEX);
    if (!taskMatch) {
      return;
    }

    const taskId = extractRenderedKanbanTaskId(taskMatch[2]);
    const projectMetaMatch = taskMatch[2].match(/(?:^| • )project (.+?)(?: •|$)/i);
    const projectPrefixMatch = taskMatch[2].match(/^\[([^\]]+)\]\s+/);
    if (!taskId) {
      return;
    }

    const projectName = projectMetaMatch?.[1]?.trim() || projectPrefixMatch?.[1]?.trim() || "";
    if (!projectName) {
      return;
    }

    cards.push({
      projectName,
      lane: currentLane,
      taskId,
      checked: taskMatch[1].toLowerCase() === "x"
    });
  });

  return cards;
}

function parseKanbanBoardProjectName(content: string): string {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (frontmatterMatch) {
    const projectMatch = frontmatterMatch[1].match(/^daily-dashboard-project:\s*(.+)$/m);
    if (projectMatch?.[1]?.trim()) {
      return projectMatch[1].trim();
    }
  }

  const titleMatch = content.match(/^#\s+(.+?)\s+Kanban Board\s*$/m);
  return titleMatch?.[1]?.trim() ?? "";
}

function parseKanbanBoardCards(
  content: string,
  projectName: string,
  boardTemplates: Record<string, KanbanBoardTemplate> = {},
  boardConfigurations: Record<string, KanbanBoardConfiguration> = {}
): Array<{ projectName: string; taskId: string; checked: boolean; laneLabel: string; targetSection: string; done: boolean; ambiguous: boolean }> {
  const lines = content.split(/\r?\n/);
  const cards: Array<{ projectName: string; taskId: string; checked: boolean; laneLabel: string; targetSection: string; done: boolean; ambiguous: boolean }> = [];
  let currentLane: KanbanLaneOption | null = null;

  lines.forEach((line) => {
    const laneMatch = line.trim().match(/^##?\s+(.+?)(?:\s+\([^)]*\))?$/);
    if (laneMatch) {
      currentLane = resolveKanbanLaneOptionByLabel(projectName, laneMatch[1].trim(), boardTemplates, boardConfigurations);
      return;
    }

    if (!currentLane) {
      return;
    }

    const taskMatch = line.match(CHECKLIST_REGEX);
    if (!taskMatch) {
      return;
    }

    const taskId = extractRenderedKanbanTaskId(taskMatch[2]);
    if (!taskId) {
      return;
    }

    cards.push({
      projectName,
      taskId,
      checked: taskMatch[1].toLowerCase() === "x",
      laneLabel: currentLane.label,
      targetSection: currentLane.targetSection,
      done: currentLane.done,
      ambiguous: currentLane.unmapped
    });
  });

  return cards;
}

function resolveKanbanLaneOptionByLabel(
  projectName: string,
  laneLabel: string,
  boardTemplates: Record<string, KanbanBoardTemplate>,
  boardConfigurations: Record<string, KanbanBoardConfiguration>
): KanbanLaneOption {
  const laneOptions = getKanbanLaneOptionsForProject(projectName, boardTemplates, boardConfigurations);
  const normalizedLabel = laneLabel.trim().toLowerCase();
  const matches = laneOptions.filter((option) => option.label.trim().toLowerCase() === normalizedLabel);
  if (matches.length === 1) {
    return matches[0];
  }

  return {
    laneKey: normalizedLabel || "unknown",
    label: laneLabel.trim() || "Unknown Lane",
    helperText: matches.length > 1 ? "Ambiguous lane mapping" : "Unmapped lane",
    targetSection: "",
    done: false,
    unmapped: true
  };
}

function resolveKanbanLaneDefinitionsForProject(
  projectName: string,
  boardTemplates: Record<string, KanbanBoardTemplate>,
  boardConfigurations: Record<string, KanbanBoardConfiguration>
): KanbanLaneDefinition[] {
  const configuration = boardConfigurations[projectName];
  if (configuration?.laneDefinitions.length) {
    return configuration.laneDefinitions;
  }

  const templateId = configuration?.templateId || "execution-default";
  const template = boardTemplates[templateId] ?? Object.values(boardTemplates)[0];
  return template?.laneDefinitions.length ? template.laneDefinitions : buildFallbackExecutionLaneDefinitions();
}

function findProjectTaskLocationById(content: string, projectName: string, taskId: string, taskRegistry: Record<string, KanbanTaskRegistryEntry> = {}): { section: string; checked: boolean } | null {
  const match = findProjectTaskMatch(content, projectName, taskId, taskRegistry, true);
  return match
    ? {
      section: match.section,
      checked: match.checked
    }
    : null;
}

function removeTaskByIdFromProject(content: string, projectName: string, taskId: string, taskRegistry: Record<string, KanbanTaskRegistryEntry> = {}): { content: string; taskText: string } | null {
  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return null;
  }

  const output = [...lines];
  const match = findProjectTaskMatch(content, projectName, taskId, taskRegistry, true);
  if (!match) {
    return null;
  }

  output.splice(match.index, 1);
  return {
    content: output.join("\n"),
    taskText: match.taskText
  };
}

export function updateTaskByIdInProject(content: string, input: {
  projectName: string;
  taskId: string;
  taskText: string;
  sectionName: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean } {
  const taskRegistry = input.taskRegistry ?? {};
  const location = findProjectTaskLocationById(content, input.projectName, input.taskId, taskRegistry);
  if (!location) {
    return { content, updated: false };
  }

  const removed = removeTaskByIdFromProject(content, input.projectName, input.taskId, taskRegistry);
  if (!removed) {
    return { content, updated: false };
  }

  const nextTaskText = replaceTaskDisplayText(removed.taskText, input.taskText);
  const normalizedTaskText = input.sectionName.trim().toLowerCase() === "waiting"
    ? nextTaskText
    : stripBlockingTaskAnnotations(nextTaskText);
  const nextContent = insertTaskIntoProjectSection(removed.content, input.projectName, input.sectionName, normalizedTaskText);

  return {
    content: nextContent,
    updated: nextContent !== content || location.section.toLowerCase() !== input.sectionName.trim().toLowerCase()
  };
}

export function updateTaskByIdInProjectWithMetadata(content: string, input: {
  projectName: string;
  taskId: string;
  taskText: string;
  sectionName: string;
  priority?: string;
  dueDate?: string;
  blockedReason?: string;
  effort?: string;
  executionContext?: string;
  photoPaths?: string[];
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean; taskText: string } {
  const taskRegistry = input.taskRegistry ?? {};
  const location = findProjectTaskLocationById(content, input.projectName, input.taskId, taskRegistry);
  if (!location) {
    return { content, updated: false, taskText: "" };
  }

  const removed = removeTaskByIdFromProject(content, input.projectName, input.taskId, taskRegistry);
  if (!removed) {
    return { content, updated: false, taskText: "" };
  }

  const nextTaskText = replaceTaskDisplayText(removed.taskText, input.taskText);
  const annotatedTaskText = applyTaskAnnotationOverrides(nextTaskText, {
    priority: input.priority,
    dueDate: input.dueDate,
    blockedReason: input.blockedReason,
    effort: input.effort,
    executionContext: input.executionContext,
    photoPaths: input.photoPaths
  });
  const normalizedTaskText = input.sectionName.trim().toLowerCase() === "waiting"
    ? annotatedTaskText
    : stripBlockingTaskAnnotations(annotatedTaskText);
  const nextContent = insertTaskIntoProjectSection(removed.content, input.projectName, input.sectionName, normalizedTaskText);

  return {
    content: nextContent,
    updated: nextContent !== content || location.section.toLowerCase() !== input.sectionName.trim().toLowerCase() || normalizedTaskText !== removed.taskText,
    taskText: normalizedTaskText
  };
}

export function moveTaskByIdInProject(content: string, input: {
  projectName: string;
  taskId: string;
  sectionName: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean } {
  const taskRegistry = input.taskRegistry ?? {};
  const location = findProjectTaskLocationById(content, input.projectName, input.taskId, taskRegistry);
  if (!location) {
    return { content, updated: false };
  }

  const removed = removeTaskByIdFromProject(content, input.projectName, input.taskId, taskRegistry);
  if (!removed) {
    return { content, updated: false };
  }

  const targetSection = input.sectionName.trim() || location.section;
  const movedTaskText = targetSection.toLowerCase() === "waiting"
    ? removed.taskText
    : stripBlockingTaskAnnotations(removed.taskText);
  const nextContent = insertTaskIntoProjectSection(removed.content, input.projectName, targetSection, movedTaskText);

  return {
    content: nextContent,
    updated: nextContent !== content || location.section.toLowerCase() !== targetSection.toLowerCase()
  };
}

export function transferTaskByIdBetweenProjects(content: string, input: {
  fromProjectName: string;
  toProjectName: string;
  taskId: string;
  sectionName: string;
  taskText?: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean; taskText: string } {
  const taskRegistry = input.taskRegistry ?? {};
  const removed = removeTaskByIdFromProject(content, input.fromProjectName, input.taskId, taskRegistry);
  if (!removed) {
    return { content, updated: false, taskText: "" };
  }

  const targetSection = input.sectionName.trim() || "General";
  const nextTaskText = input.taskText?.trim().length ? input.taskText.trim() : removed.taskText;
  const movedTaskText = targetSection.toLowerCase() === "waiting"
    ? nextTaskText
    : stripBlockingTaskAnnotations(nextTaskText);
  const nextContent = insertTaskIntoProjectSection(removed.content, input.toProjectName, targetSection, movedTaskText);

  return {
    content: nextContent,
    updated: nextContent !== content,
    taskText: movedTaskText
  };
}

export function deleteTaskByIdInProject(content: string, input: {
  projectName: string;
  taskId: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean; taskText: string } {
  const taskRegistry = input.taskRegistry ?? {};
  const removed = removeTaskByIdFromProject(content, input.projectName, input.taskId, taskRegistry);
  if (!removed) {
    return { content, updated: false, taskText: "" };
  }

  return {
    content: removed.content,
    updated: removed.content !== content,
    taskText: removed.taskText
  };
}

export function completeTaskByIdInProject(content: string, input: {
  projectName: string;
  taskId: string;
  archivedAt: string;
  taskRegistry?: Record<string, KanbanTaskRegistryEntry>;
}): { content: string; updated: boolean } {
  const taskRegistry = input.taskRegistry ?? {};
  const completed = markTaskCompleteById(content, input.projectName, input.taskId, taskRegistry);
  if (!completed.marked) {
    return { content, updated: false };
  }

  const archived = archiveCompletedTasks(completed.content, input.archivedAt);
  return {
    content: archived.content,
    updated: archived.content !== content
  };
}

function markTaskCompleteById(content: string, projectName: string, taskId: string, taskRegistry: Record<string, KanbanTaskRegistryEntry> = {}): { content: string; marked: boolean } {
  const lines = content.split(/\r?\n/);
  const match = findProjectTaskMatch(content, projectName, taskId, taskRegistry, false);
  if (!match) {
    return { content, marked: false };
  }

  const output = [...lines];
  output[match.index] = output[match.index].replace(/^(\t| )*- \[ \]/, (value) => value.replace("[ ]", "[x]"));
  return { content: output.join("\n"), marked: true };
}

function findProjectTaskMatch(
  content: string,
  projectName: string,
  taskId: string,
  taskRegistry: Record<string, KanbanTaskRegistryEntry>,
  allowCompleted: boolean
): { index: number; section: string; checked: boolean; taskText: string } | null {
  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return null;
  }

  let currentSection = "General";
  const fallbackCandidates: Array<{ index: number; section: string; checked: boolean; taskText: string; sectionMatches: boolean; checkedMatches: boolean }> = [];
  const registryEntry = taskRegistry[taskId];
  const normalizedRegistryText = registryEntry ? normalizeKanbanTaskMatchText(registryEntry.taskText) : "";
  const normalizedRegistrySection = registryEntry ? normalizeLegacyKanbanSectionName(registryEntry.sectionName) : "";

  for (let index = project.start + 1; index <= project.end; index += 1) {
    const sectionName = getSectionName(lines[index]);
    if (sectionName) {
      currentSection = sectionName;
      continue;
    }

    const taskMatch = lines[index].match(CHECKLIST_REGEX);
    if (!taskMatch) {
      continue;
    }

    const checked = taskMatch[1].toLowerCase() === "x";
    if (!allowCompleted && (checked || currentSection.trim().toLowerCase() === "completed archive")) {
      continue;
    }

    if (extractTaskAnnotation(taskMatch[2].trim(), TASK_ID_ANNOTATION_KEY) === taskId) {
      return {
        index,
        section: currentSection,
        checked,
        taskText: taskMatch[2].trim()
      };
    }

    if (!registryEntry || registryEntry.projectName.trim().toLowerCase() !== projectName.trim().toLowerCase()) {
      continue;
    }

    const parsedText = parseTodoTaskSummary(taskMatch[2].trim(), currentSection, new Date()).text;
    if (normalizeKanbanTaskMatchText(parsedText) !== normalizedRegistryText) {
      continue;
    }

    fallbackCandidates.push({
      index,
      section: currentSection,
      checked,
      taskText: taskMatch[2].trim(),
      sectionMatches: normalizeLegacyKanbanSectionName(currentSection) === normalizedRegistrySection,
      checkedMatches: checked === registryEntry.checked
    });
  }

  const exactMatches = fallbackCandidates.filter((candidate) => candidate.sectionMatches && candidate.checkedMatches);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const sectionMatches = fallbackCandidates.filter((candidate) => candidate.sectionMatches);
  if (sectionMatches.length === 1) {
    return sectionMatches[0];
  }

  const checkedMatches = fallbackCandidates.filter((candidate) => candidate.checkedMatches);
  if (checkedMatches.length === 1) {
    return checkedMatches[0];
  }

  if (fallbackCandidates.length === 1) {
    return fallbackCandidates[0];
  }

  return null;
}

function normalizeKanbanTaskMatchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function extractRenderedKanbanTaskId(value: string): string {
  const hiddenMatch = value.match(/<!--\s*daily-dashboard-task-id:\s*([a-z0-9-]+)\s*-->/i);
  if (hiddenMatch?.[1]?.trim()) {
    return hiddenMatch[1].trim();
  }

  const visibleMatch = value.match(/(?:^| • )id ([a-z0-9-]+)(?: •|$)/i);
  return visibleMatch?.[1]?.trim() ?? "";
}

function renderKanbanTaskIdComment(taskId: string): string {
  return taskId.trim().length > 0 ? ` <!-- daily-dashboard-task-id: ${taskId.trim()} -->` : "";
}

function replaceTaskDisplayText(taskText: string, nextText: string): string {
  const trimmedTaskText = taskText.trim();
  const trimmedNextText = nextText.trim();
  if (!trimmedTaskText || !trimmedNextText) {
    return trimmedNextText || trimmedTaskText;
  }

  const annotationMatch = trimmedTaskText.match(/\s\[(?:task-id|priority|due|blocked|unblock|blocked-until|effort|energy|context|mode|trigger|minimum-step|minimum step|min-step|min step|photos):/i);
  if (!annotationMatch || typeof annotationMatch.index !== "number") {
    return trimmedNextText;
  }

  return `${trimmedNextText}${trimmedTaskText.slice(annotationMatch.index)}`;
}

function upsertTaskAnnotation(value: string, key: string, nextValue: string | undefined): string {
  const trimmedValue = value.trim();
  const withoutAnnotation = removeTaskAnnotation(trimmedValue, key);
  const normalizedNextValue = nextValue?.trim() ?? "";
  if (!normalizedNextValue) {
    return withoutAnnotation;
  }
  return `${withoutAnnotation} [${key}: ${normalizedNextValue}]`.trim();
}

function applyTaskAnnotationOverrides(taskText: string, input: {
  priority?: string;
  dueDate?: string;
  blockedReason?: string;
  effort?: string;
  executionContext?: string;
  photoPaths?: string[];
}): string {
  let nextText = taskText.trim();
  nextText = upsertTaskAnnotation(nextText, "priority", input.priority);
  nextText = upsertTaskAnnotation(nextText, "due", input.dueDate);
  nextText = upsertTaskAnnotation(nextText, "blocked", input.blockedReason);
  nextText = upsertTaskAnnotation(nextText, "effort", input.effort);
  nextText = upsertTaskAnnotation(nextText, "context", input.executionContext);
  nextText = upsertTaskAnnotation(nextText, "photos", (input.photoPaths ?? []).map((path) => path.trim()).filter(Boolean).join(" | "));
  nextText = removeTaskAnnotation(nextText, "mode");
  return nextText.replace(/\s{2,}/g, " ").trim();
}

function stripBlockingTaskAnnotations(value: string): string {
  return value
    .replace(/\s*\[(?:blocked|unblock|blocked-until):\s*[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getProjectBlockMetadataInsertIndex(lines: string[]): number {
  let index = 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "" || parseProjectMeta(line)) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function getProjectNoteMetadataInsertIndex(lines: string[], titleIndex: number): number {
  let index = Math.max(titleIndex + 1, 1);
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "" || parseProjectMeta(line)) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

function appendHubSection(lines: string[], heading: string, body: string[]): void {
  const completedArchiveIndex = lines.findIndex((line) => getSectionName(line)?.toLowerCase() === "completed archive");
  const insertIndex = completedArchiveIndex >= 0 && heading.toLowerCase() !== "completed archive" ? completedArchiveIndex : lines.length;
  const block = ["", `### ${heading}`, ...body];
  if (heading.toLowerCase() !== "completed archive") {
    block.push("");
  }
  lines.splice(insertIndex, 0, ...block);
}

function appendMarkdownSection(lines: string[], heading: string, body: string[]): void {
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  lines.push("", heading, ...body, "");
}

function getMarkdownHeadingName(line: string): string | null {
  const trimmed = line.trim();
  if (!/^##+\s+/.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/^##+\s+/, "").trim();
}

function buildDefaultProjectNotePath(projectName: string, projectNotesFolder: string): string {
  const noteFolder = normalizeFolderPath(projectNotesFolder);
  const safeProjectName = sanitizeFileName(projectName);
  return noteFolder ? `${noteFolder}/${safeProjectName}.md` : `${safeProjectName}.md`;
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
    return actionableTask.minimumStep.trim().length > 0
      ? `${actionableTask.minimumStep} (minimum step for ${actionableTask.text})`
      : actionableTask.text;
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

function normalizeTodoDueDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!slashMatch) {
    return null;
  }

  const [, month, day, year] = slashMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseTodoTaskSummary(rawText: string, section: string, now: Date): TodoTaskSummary {
  const taskId = extractTaskAnnotation(rawText, TASK_ID_ANNOTATION_KEY);
  const priority = extractTaskAnnotation(rawText, "priority");
  const dueDate = extractTaskAnnotation(rawText, "due");
  const blockedReason = extractTaskAnnotation(rawText, "blocked");
  const unblockDate = extractTaskAnnotation(rawText, "unblock") || extractTaskAnnotation(rawText, "blocked-until");
  const effort = extractTaskAnnotation(rawText, "effort");
  const energy = extractTaskAnnotation(rawText, "energy");
  const executionContext = extractTaskAnnotation(rawText, "context") || extractTaskAnnotation(rawText, "mode");
  const trigger = extractTaskAnnotation(rawText, "trigger");
  const minimumStep = extractTaskAnnotation(rawText, "minimum-step") || extractTaskAnnotation(rawText, "minimum step") || extractTaskAnnotation(rawText, "min-step") || extractTaskAnnotation(rawText, "min step");
  const text = stripTaskAnnotations(rawText).trim();
  const todayKey = formatDateKey(now);
  const dueDateKey = dueDate ? normalizeTodoDueDateKey(dueDate) : null;
  const isOverdue = Boolean(dueDateKey && dueDateKey < todayKey);
  const isDueSoon = Boolean(dueDateKey && !isOverdue && daysBetween(todayKey, dueDateKey) <= 3);
  const isBlocked = Boolean(blockedReason);

  return {
    taskId: taskId ?? "",
    text: text || rawText,
    rawText,
    section,
    kanbanLane: resolveKanbanLane(section, isBlocked),
    completedAt: "",
    priority: priority ?? "",
    dueDate: dueDate ?? "",
    blockedReason: blockedReason ?? "",
    unblockDate: unblockDate ?? "",
    effort: effort ?? "",
    energy: energy ?? "",
    executionContext: executionContext ?? "",
    trigger: trigger ?? "",
    minimumStep: minimumStep ?? "",
    isBlocked,
    isDueSoon,
    isOverdue
  };
}

export function getTodoTaskDisplayText(rawText: string, section: string): string {
  return parseTodoTaskSummary(rawText, section, new Date()).text;
}

export function getTodoTaskAnnotationValue(rawText: string, key: "priority" | "due" | "effort"): string {
  return extractTaskAnnotation(rawText, key) ?? "";
}

export function getTodoTaskPhotoPaths(rawText: string): string[] {
  return (extractTaskAnnotation(rawText, "photos") ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter((item, index, values) => item.length > 0 && values.indexOf(item) === index);
}

export function getTodoTaskCategoryHints(rawText: string, section: string, kanbanLane = ""): string[] {
  const hints = new Set<string>();
  const loweredValues = [section, kanbanLane, rawText].map((value) => value.trim().toLowerCase());
  const taskTags = extractTodoTaskTags(rawText);

  taskTags.forEach((tag) => hints.add(tag));
  loweredValues.forEach((value) => {
    if (!value) {
      return;
    }
    if (/(^|\b)(fix|bug|bugs|defect|defects|issue|issues|hotfix)(\b|$)/.test(value)) {
      hints.add("bug");
    }
    if (/(^|\b)(feature|features|add|idea|ideas|request|requests)(\b|$)/.test(value)) {
      hints.add("feature");
    }
    if (/(^|\b)(expedite|expedited|urgent|interrupt|interrupts)(\b|$)/.test(value)) {
      hints.add("expedite");
    }
  });

  return Array.from(hints);
}

function resolveKanbanLane(section: string, isBlocked: boolean): KanbanLane | "" {
  if (isBlocked) {
    return "Waiting";
  }

  const normalized = normalizeLegacyKanbanSectionName(section);
  if (normalized === "now") {
    return "Now";
  }
  if (normalized === "next") {
    return "Next";
  }
  if (normalized === "later") {
    return "Later";
  }
  if (normalized === "waiting") {
    return "Waiting";
  }
  if (normalized === "parking lot") {
    return "Parking Lot";
  }
  if (normalized === "completed archive") {
    return "Done";
  }
  return "";
}

function normalizeLegacyKanbanSectionName(section: string): string {
  const normalized = section.trim().toLowerCase();
  if (normalized === "add" || normalized === "fix") {
    return "next";
  }
  return normalized;
}

function extractTaskAnnotation(value: string, key: string): string | null {
  const normalizedValue = value;
  const lowerValue = normalizedValue.toLowerCase();
  const lowerKey = key.trim().toLowerCase();
  if (!lowerKey) {
    return null;
  }

  const marker = `[${lowerKey}:`;
  let searchIndex = 0;
  while (searchIndex < lowerValue.length) {
    const start = lowerValue.indexOf(marker, searchIndex);
    if (start === -1) {
      return null;
    }

    const valueStart = start + marker.length;
    const end = normalizedValue.indexOf("]", valueStart);
    if (end === -1) {
      return null;
    }

    const extracted = normalizedValue.slice(valueStart, end).trim();
    if (extracted.length > 0) {
      return extracted;
    }

    searchIndex = end + 1;
  }

  return null;
}

function removeTaskAnnotation(value: string, key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(new RegExp(`\\s*\\[${escapedKey}:\\s*[^\]]+\\]`, "ig"), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripTaskAnnotations(value: string): string {
  return value
    .replace(/\s*\[(?:task-id|priority|due|blocked|unblock|blocked-until|effort|energy|context|mode|trigger|minimum-step|minimum step|min-step|min step|photos):\s*[^\]]+\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractTodoTaskTags(rawText: string): string[] {
  return Array.from(rawText.matchAll(/(?:^|\s)#([A-Za-z0-9/_-]+)/g))
    .map((match) => match[1].trim().toLowerCase())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
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