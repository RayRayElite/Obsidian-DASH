"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DailyDashboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_DAILY_DASHBOARD = "daily-dashboard-view";
var CHECKLIST_REGEX = /^\s*-\s\[( |x|X)\]\s+(.*)$/;
var PROJECT_SEPARATOR_REGEX = /^\s*-{3,}\s*$/;
var SECTION_HEADER_REGEX = /^([A-Za-z][A-Za-z0-9 &/()'_-]+):\s*$/;
var PROJECT_META_REGEX = /^([A-Za-z][A-Za-z ]+)::\s*(.+)$/;
var NOTE_LINK_REGEX = /\[\[([^\]]+)\]\]/g;
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
var DEFAULT_SETTINGS = {
  dashboardTitle: "Daily Dashboard",
  masterTodoPath: "Master Task Hub.md",
  projectNotesFolder: "Project Notes",
  dailyLogFolder: "Dashboard Logs/Daily",
  weeklyReportFolder: "Dashboard Logs/Weekly",
  monthlyReportFolder: "Dashboard Logs/Monthly",
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
var DailyDashboardPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.data = {
      settings: { ...DEFAULT_SETTINGS },
      entries: {}
    };
    this.wallpaperOptions = [];
    this.autoArchiveDebounceId = null;
    this.isAutoArchivingTodo = false;
  }
  async onload() {
    await this.loadPluginData();
    await this.ensureTodayEntry();
    await this.refreshWallpaperOptions();
    this.registerView(VIEW_TYPE_DAILY_DASHBOARD, (leaf) => new DailyDashboardView(leaf, this));
    this.addRibbonIcon("check-square", "Open Daily Dashboard", () => {
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
      id: "generate-weekly-review-note",
      name: "Generate weekly review note",
      callback: () => {
        void this.generateWeeklyReview();
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
    this.addSettingTab(new DailyDashboardSettingTab(this.app, this));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian.TFile && (0, import_obsidian.normalizePath)(file.path) === (0, import_obsidian.normalizePath)(this.data.settings.masterTodoPath)) {
        this.scheduleAutomaticTodoArchive();
        this.refreshDashboardViews();
      }
    }));
    this.registerInterval(window.setInterval(() => {
      void this.refreshForNewDay();
    }, 6e4));
  }
  async onunload() {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
  }
  getSettings() {
    return this.data.settings;
  }
  getHabitDefinitions() {
    return this.data.settings.habitDefinitions;
  }
  getTodayKey() {
    return formatDateKey(/* @__PURE__ */ new Date());
  }
  getTodayEntry() {
    return this.getOrCreateEntry(this.getTodayKey());
  }
  getAllEntries() {
    return Object.values(this.data.entries).map((entry) => normalizeEntry(entry, this.data.settings)).sort((left, right) => left.date.localeCompare(right.date));
  }
  getWallpaperFiles() {
    return this.wallpaperOptions;
  }
  getSelectedWallpaperPath() {
    var _a, _b;
    const files = this.getWallpaperFiles();
    const selected = (0, import_obsidian.normalizePath)(this.data.settings.selectedWallpaper);
    if (selected && files.some((file) => (0, import_obsidian.normalizePath)(file.path) === selected)) {
      return selected;
    }
    return (_b = (_a = files[0]) == null ? void 0 : _a.path) != null ? _b : "";
  }
  getSelectedWallpaperUrl() {
    var _a;
    const path = this.getSelectedWallpaperPath();
    if (!path) {
      return null;
    }
    const option = this.wallpaperOptions.find((candidate) => (0, import_obsidian.normalizePath)(candidate.path) === (0, import_obsidian.normalizePath)(path));
    return (_a = option == null ? void 0 : option.url) != null ? _a : null;
  }
  async activateDashboardView() {
    var _a;
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    const leaf = (_a = existingLeaves[0]) != null ? _a : this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_DAILY_DASHBOARD,
      active: true
    });
    this.app.workspace.revealLeaf(leaf);
  }
  async updateSettings(settings) {
    this.data.settings = sanitizeSettings(settings);
    await this.refreshWallpaperOptions();
    for (const date of Object.keys(this.data.entries)) {
      this.data.entries[date] = this.normalizeEntry(this.data.entries[date], date);
      await this.syncDailyLog(this.data.entries[date]);
    }
    await this.savePluginData();
    this.refreshDashboardViews();
  }
  async updateMoodScore(value) {
    const entry = this.getTodayEntry();
    entry.moodScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateEnergyScore(value) {
    const entry = this.getTodayEntry();
    entry.energyScore = clamp(value, 0, 5);
    await this.persistEntry(entry);
  }
  async updateHabitValue(habitId, value) {
    const definitions = this.getHabitDefinitions();
    const definition = definitions.find((candidate) => candidate.id === habitId);
    if (!definition) {
      return;
    }
    const entry = this.getTodayEntry();
    entry.habits[habitId] = clamp(value, 0, definition.target);
    await this.persistEntry(entry);
  }
  async addFoodEntry(value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    const entry = this.getTodayEntry();
    entry.foodLog = [trimmedValue, ...entry.foodLog];
    await this.persistEntry(entry);
  }
  async removeFoodEntry(index) {
    const entry = this.getTodayEntry();
    entry.foodLog = entry.foodLog.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateSleepLog(value) {
    const entry = this.getTodayEntry();
    entry.sleepLog = value.trim();
    await this.persistEntry(entry);
  }
  async updateDailyNotes(value) {
    const entry = this.getTodayEntry();
    entry.notes = value.trim();
    await this.persistEntry(entry);
  }
  async resetToday() {
    const freshEntry = this.createEmptyEntry(this.getTodayKey());
    this.data.entries[freshEntry.date] = freshEntry;
    await this.persistEntry(freshEntry);
  }
  async archiveCompletedTasksFromTodo() {
    await this.archiveCompletedTasksFromTodoInternal(true);
  }
  async archiveCompletedTasksFromTodoInternal(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const archivedAt = formatDateTimeKey(/* @__PURE__ */ new Date());
    const archiveResult = archiveCompletedTasks(content, archivedAt);
    if (archiveResult.archivedTasks.length === 0) {
      if (showNotice) {
        new import_obsidian.Notice("No completed checklist items were found to archive.");
      }
      return;
    }
    this.isAutoArchivingTodo = true;
    try {
      await this.app.vault.modify(todoFile, archiveResult.content);
    } finally {
      window.setTimeout(() => {
        this.isAutoArchivingTodo = false;
      }, 50);
    }
    const entry = this.getOrCreateEntry(archivedAt.slice(0, 10));
    entry.completedTasks = [...archiveResult.archivedTasks, ...entry.completedTasks];
    await this.persistEntry(entry);
    if (showNotice) {
      new import_obsidian.Notice(`Archived ${archiveResult.archivedTasks.length} completed task${archiveResult.archivedTasks.length === 1 ? "" : "s"}.`);
    }
  }
  async generateWeeklyReport() {
    const today = /* @__PURE__ */ new Date();
    const range = getIsoWeekRange(today);
    const entries = this.getEntriesInRange(range.start, range.end);
    const content = renderPeriodReport({
      title: `Weekly Dashboard Report - ${range.label}`,
      rangeLabel: `${formatDateKey(range.start)} to ${formatDateKey(range.end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions()
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.weeklyReportFolder}/${range.label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian.Notice("Weekly dashboard report generated.");
  }
  async generateMonthlyReport() {
    const today = /* @__PURE__ */ new Date();
    const label = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}`;
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const entries = this.getEntriesInRange(start, end);
    const content = renderPeriodReport({
      title: `Monthly Dashboard Report - ${label}`,
      rangeLabel: `${formatDateKey(start)} to ${formatDateKey(end)}`,
      entries,
      habitDefinitions: this.getHabitDefinitions()
    });
    const file = await this.upsertMarkdownFile(
      `${this.data.settings.monthlyReportFolder}/${label}.md`,
      content
    );
    await this.openFile(file);
    new import_obsidian.Notice("Monthly dashboard report generated.");
  }
  async getTodoSnapshot() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return null;
    }
    const content = await this.app.vault.read(todoFile);
    return parseTodoSnapshot(content);
  }
  async getTodoCategories() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      return [];
    }
    const content = await this.app.vault.read(todoFile);
    return findTodoCategoryRanges(content.split(/\r?\n/)).map((category) => category.name);
  }
  async openCreateProjectFlow() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const categories = await this.getTodoCategories();
    new CreateProjectModal(this.app, this, categories).open();
  }
  async createProjectAndNote(input) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    const projectName = input.projectName.trim();
    const categoryName = input.categoryName.trim();
    if (!projectName || !categoryName) {
      new import_obsidian.Notice("Project name and category are required.");
      return;
    }
    const todoContent = await this.app.vault.read(todoFile);
    const existingProject = findProjectRanges(todoContent.split(/\r?\n/)).some((project) => project.name.toLowerCase() === projectName.toLowerCase());
    if (existingProject) {
      new import_obsidian.Notice(`A project named ${projectName} already exists in the master todo.`);
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
    await this.openFile(projectNote);
    this.refreshDashboardViews();
    new import_obsidian.Notice(`Created ${projectName} in the master todo and generated its project note.`);
  }
  async createMissingProjectNotesFromTodo(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projects = extractProjectDefinitionsFromTodo(content);
    if (projects.length === 0) {
      if (showNotice) {
        new import_obsidian.Notice("No projects were found in the master task hub.");
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
      new import_obsidian.Notice(createdCount > 0 ? `Created ${createdCount} missing project note${createdCount === 1 ? "" : "s"}.` : "All project notes already exist.");
    }
  }
  async addTodayFocusItem(value) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }
    const entry = this.getTodayEntry();
    if (entry.todayFocus.includes(trimmedValue)) {
      return;
    }
    entry.todayFocus = [...entry.todayFocus, trimmedValue].slice(0, 3);
    await this.persistEntry(entry);
  }
  async removeTodayFocusItem(index) {
    const entry = this.getTodayEntry();
    entry.todayFocus = entry.todayFocus.filter((_, candidateIndex) => candidateIndex !== index);
    await this.persistEntry(entry);
  }
  async updateFrictionLog(value) {
    const entry = this.getTodayEntry();
    entry.frictionLog = value.trim();
    await this.persistEntry(entry);
  }
  async promoteTaskToToday(projectName, taskText) {
    await this.addTodayFocusItem(`${projectName}: ${taskText}`);
  }
  async addTaskToProject(projectName, sectionName, taskText) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
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
  async generateWeeklyReview() {
    const today = /* @__PURE__ */ new Date();
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
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Weekly Reviews/${range.label}.md`, content);
    await this.openFile(file);
    new import_obsidian.Notice("Weekly review note generated.");
  }
  async syncRepeatingProjectTasks(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const projectDefinitions = extractProjectDefinitionsFromTodo(content);
    let updatedContent = content;
    let insertedCount = 0;
    for (const project of projectDefinitions) {
      const notePath = (0, import_obsidian.normalizePath)(`${stripMarkdownExtension(project.noteLinkPath)}.md`);
      const abstractFile = this.app.vault.getAbstractFileByPath(notePath);
      if (!(abstractFile instanceof import_obsidian.TFile)) {
        continue;
      }
      const noteContent = await this.app.vault.read(abstractFile);
      const repeatingTasks = extractRepeatingTasks(noteContent);
      repeatingTasks.forEach((task) => {
        if (!isRepeatingTaskDue(task, content, project.projectName)) {
          return;
        }
        updatedContent = insertTaskIntoProjectSection(updatedContent, project.projectName, "Next", `${task.text} [${task.cadence}]`);
        insertedCount += 1;
      });
    }
    if (updatedContent !== content) {
      await this.app.vault.modify(todoFile, updatedContent);
    }
    if (showNotice) {
      new import_obsidian.Notice(insertedCount > 0 ? `Added ${insertedCount} repeating task${insertedCount === 1 ? "" : "s"}.` : "No repeating tasks were due.");
    }
  }
  async offloadProjectReferences(showNotice) {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      if (showNotice) {
        new import_obsidian.Notice("Master task hub not found. Set the path in plugin settings.");
      }
      return;
    }
    const content = await this.app.vault.read(todoFile);
    const result = await offloadReferencesFromMasterHub(content, this.app.vault, this.data.settings.masterTodoPath);
    if (result.updatedContent !== content) {
      await this.app.vault.modify(todoFile, result.updatedContent);
    }
    if (showNotice) {
      new import_obsidian.Notice(result.offloadedProjects.length > 0 ? `Offloaded references for ${result.offloadedProjects.length} project${result.offloadedProjects.length === 1 ? "" : "s"}.` : "No project references needed offloading.");
    }
  }
  async showCleanupSuggestions() {
    var _a;
    const snapshot = await this.getTodoSnapshot();
    const suggestions = (_a = snapshot == null ? void 0 : snapshot.cleanupSuggestions) != null ? _a : [];
    const content = [
      `# Master Task Hub Cleanup Suggestions - ${formatDateKey(/* @__PURE__ */ new Date())}`,
      "",
      ...suggestions.length > 0 ? suggestions.map((item) => `- ${item}`) : ["- No cleanup issues detected."],
      ""
    ].join("\n");
    const file = await this.upsertMarkdownFile(`Dashboard Logs/Cleanup Suggestions/${formatDateKey(/* @__PURE__ */ new Date())}.md`, content);
    await this.openFile(file);
  }
  async openPromoteTaskFlow() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot || snapshot.projects.length === 0) {
      new import_obsidian.Notice("No projects found in the master task hub.");
      return;
    }
    new PromoteTaskModal(this.app, this, snapshot.projects).open();
  }
  async openProjectReviewModeFlow() {
    const options = await this.getProjectReviewOptions();
    if (options.length === 0) {
      new import_obsidian.Notice("No project notes found for review mode.");
      return;
    }
    new ProjectReviewModal(this.app, this, options).open();
  }
  async openProjectReviewMode(option) {
    const todoFile = this.getMasterTodoFile();
    const noteFile = this.app.vault.getAbstractFileByPath(option.notePath);
    if (!(noteFile instanceof import_obsidian.TFile) || !todoFile) {
      new import_obsidian.Notice("Could not open project review mode for that project.");
      return;
    }
    const leftLeaf = this.app.workspace.getLeaf(true);
    await leftLeaf.openFile(todoFile);
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(noteFile);
    this.app.workspace.revealLeaf(rightLeaf);
  }
  async getProjectReviewOptions() {
    const snapshot = await this.getTodoSnapshot();
    if (!snapshot) {
      return [];
    }
    return snapshot.projects.map((project) => ({
      projectName: project.name,
      notePath: `${project.noteLinks[0] ? stripMarkdownExtension(project.noteLinks[0]) : `${this.data.settings.projectNotesFolder}/${project.name}`}.md`
    })).filter((project) => this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(project.notePath)) instanceof import_obsidian.TFile);
  }
  getHabitStreak(habitId) {
    var _a;
    const habitDefinition = this.getHabitDefinitions().find((candidate) => candidate.id === habitId);
    if (!habitDefinition) {
      return 0;
    }
    const dates = Object.keys(this.data.entries).sort().reverse();
    let streak = 0;
    for (const date of dates) {
      const entry = this.data.entries[date];
      const value = (_a = entry.habits[habitId]) != null ? _a : 0;
      if (value >= habitDefinition.target) {
        streak += 1;
        continue;
      }
      break;
    }
    return streak;
  }
  refreshDashboardViews() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_DASHBOARD);
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DailyDashboardView) {
        void view.render();
      }
    });
  }
  async openMasterTodo() {
    const todoFile = this.getMasterTodoFile();
    if (!todoFile) {
      new import_obsidian.Notice("Master todo note not found. Set the path in plugin settings.");
      return;
    }
    await this.openFile(todoFile);
  }
  getMasterTodoFile() {
    const target = this.app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(this.data.settings.masterTodoPath));
    return target instanceof import_obsidian.TFile ? target : null;
  }
  async openFile(file) {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }
  async createProjectNote(input) {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    if (noteFolder) {
      await this.ensureFolder(noteFolder);
    }
    const basePath = this.getPreferredProjectNotePath(input.projectName.trim());
    const uniquePath = this.getAvailableMarkdownPath(basePath);
    return await this.app.vault.create(uniquePath, renderProjectNoteTemplate(input, this.data.settings.masterTodoPath));
  }
  getPreferredProjectNotePath(projectName) {
    const noteFolder = normalizeFolderPath(this.data.settings.projectNotesFolder);
    const safeProjectName = sanitizeFileName(projectName.trim());
    return noteFolder ? `${noteFolder}/${safeProjectName}.md` : `${safeProjectName}.md`;
  }
  getAvailableMarkdownPath(basePath) {
    const normalizedBasePath = (0, import_obsidian.normalizePath)(basePath);
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
  async loadPluginData() {
    var _a, _b;
    const loaded = await this.loadData();
    const settings = sanitizeSettings({
      ...DEFAULT_SETTINGS,
      ...(_a = loaded == null ? void 0 : loaded.settings) != null ? _a : {}
    });
    const rawEntries = (_b = loaded == null ? void 0 : loaded.entries) != null ? _b : {};
    const entries = {};
    Object.entries(rawEntries).forEach(([date, entry]) => {
      entries[date] = this.normalizeEntry(entry, date, settings);
    });
    this.data = {
      settings,
      entries
    };
  }
  normalizeEntry(entry, date, settings = this.data.settings) {
    var _a, _b;
    const baseEntry = createEmptyEntry(date, settings.habitDefinitions);
    if (!entry) {
      return baseEntry;
    }
    const normalizedHabits = {};
    settings.habitDefinitions.forEach((habit) => {
      var _a2, _b2;
      normalizedHabits[habit.id] = clamp(Number((_b2 = (_a2 = entry.habits) == null ? void 0 : _a2[habit.id]) != null ? _b2 : 0), 0, habit.target);
    });
    return {
      date,
      habits: normalizedHabits,
      moodScore: clamp(Number((_a = entry.moodScore) != null ? _a : 0), 0, 5),
      energyScore: clamp(Number((_b = entry.energyScore) != null ? _b : 0), 0, 5),
      todayFocus: Array.isArray(entry.todayFocus) ? entry.todayFocus.filter((item) => typeof item === "string" && item.trim().length > 0).slice(0, 3) : [],
      frictionLog: typeof entry.frictionLog === "string" ? entry.frictionLog : "",
      missedHabits: computeMissedHabits(normalizedHabits, settings.habitDefinitions),
      foodLog: Array.isArray(entry.foodLog) ? entry.foodLog.filter((item) => typeof item === "string" && item.trim().length > 0) : [],
      sleepLog: typeof entry.sleepLog === "string" ? entry.sleepLog : "",
      notes: typeof entry.notes === "string" ? entry.notes : "",
      completedTasks: Array.isArray(entry.completedTasks) ? entry.completedTasks.filter((item) => Boolean(item && typeof item === "object")).map((item) => ({
        project: typeof item.project === "string" ? item.project : "Unknown Project",
        section: typeof item.section === "string" ? item.section : "General",
        text: typeof item.text === "string" ? item.text : "",
        archivedAt: typeof item.archivedAt === "string" ? item.archivedAt : date,
        note: typeof item.note === "string" ? item.note : ""
      })).filter((item) => item.text.trim().length > 0) : []
    };
  }
  getOrCreateEntry(date) {
    if (!this.data.entries[date]) {
      this.data.entries[date] = this.createEmptyEntry(date);
    }
    return this.data.entries[date];
  }
  createEmptyEntry(date) {
    return createEmptyEntry(date, this.getHabitDefinitions());
  }
  async savePluginData() {
    await this.saveData(this.data);
  }
  async persistEntry(entry) {
    this.data.entries[entry.date] = this.normalizeEntry(entry, entry.date);
    await this.savePluginData();
    await this.syncDailyLog(this.data.entries[entry.date]);
    this.refreshDashboardViews();
  }
  async ensureTodayEntry() {
    const today = this.getTodayKey();
    const exists = Boolean(this.data.entries[today]);
    const entry = this.getOrCreateEntry(today);
    if (!exists) {
      await this.persistEntry(entry);
      return;
    }
    await this.syncDailyLog(entry);
  }
  async refreshForNewDay() {
    const todayKey = this.getTodayKey();
    const existed = Boolean(this.data.entries[todayKey]);
    await this.ensureTodayEntry();
    if (!existed) {
      this.refreshDashboardViews();
      new import_obsidian.Notice("Daily dashboard advanced to a new day.");
    }
  }
  scheduleAutomaticTodoArchive() {
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
  getEntriesInRange(start, end) {
    const startKey = formatDateKey(start);
    const endKey = formatDateKey(end);
    return Object.keys(this.data.entries).filter((date) => date >= startKey && date <= endKey).sort().map((date) => this.data.entries[date]);
  }
  async syncDailyLog(entry) {
    const content = renderDailyLog(entry, this.getHabitDefinitions());
    await this.upsertMarkdownFile(`${this.data.settings.dailyLogFolder}/${entry.date}.md`, content);
  }
  async upsertMarkdownFile(path, content) {
    const normalizedPath = (0, import_obsidian.normalizePath)(path);
    const directory = normalizedPath.includes("/") ? normalizedPath.slice(0, normalizedPath.lastIndexOf("/")) : "";
    if (directory) {
      await this.ensureFolder(directory);
    }
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof import_obsidian.TFile) {
      await this.app.vault.modify(existing, content);
      return existing;
    }
    return await this.app.vault.create(normalizedPath, content);
  }
  async ensureFolder(folderPath) {
    const normalizedPath = (0, import_obsidian.normalizePath)(folderPath);
    if (!normalizedPath) {
      return;
    }
    const parts = normalizedPath.split("/");
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
  async refreshWallpaperOptions() {
    this.wallpaperOptions = await this.loadWallpaperOptions();
  }
  async loadWallpaperOptions() {
    const adapter = this.app.vault.adapter;
    const candidateFolders = this.getWallpaperFolderCandidates();
    const seenPaths = /* @__PURE__ */ new Set();
    const options = [];
    for (const folderPath of candidateFolders) {
      const exists = await adapter.exists(folderPath, false);
      if (!exists) {
        continue;
      }
      const listed = await adapter.list(folderPath);
      listed.files.forEach((filePath) => {
        var _a, _b, _c;
        const normalizedFilePath = (0, import_obsidian.normalizePath)(filePath);
        const extension = (_b = (_a = normalizedFilePath.split(".").pop()) == null ? void 0 : _a.toLowerCase()) != null ? _b : "";
        if (!IMAGE_EXTENSIONS.has(extension) || seenPaths.has(normalizedFilePath)) {
          return;
        }
        seenPaths.add(normalizedFilePath);
        options.push({
          path: normalizedFilePath,
          displayName: (_c = normalizedFilePath.split("/").pop()) != null ? _c : normalizedFilePath,
          url: adapter.getResourcePath(normalizedFilePath)
        });
      });
    }
    options.sort((left, right) => left.displayName.localeCompare(right.displayName));
    return options;
  }
  getWallpaperFolderCandidates() {
    var _a;
    const configuredFolder = normalizeFolderPath(this.data.settings.wallpaperFolder);
    const pluginDir = normalizeFolderPath((_a = this.manifest.dir) != null ? _a : "");
    const candidates = /* @__PURE__ */ new Set();
    if (!configuredFolder) {
      if (pluginDir) {
        candidates.add(pluginDir);
      }
    } else {
      candidates.add(configuredFolder);
      if (pluginDir) {
        const pluginRelativeFolder = configuredFolder.toLowerCase().startsWith(pluginDir.toLowerCase()) ? configuredFolder : normalizeFolderPath(`${pluginDir}/${configuredFolder}`);
        candidates.add(pluginRelativeFolder);
      }
    }
    return Array.from(candidates);
  }
};
var DailyDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.workLogFilters = {
      project: "",
      keyword: "",
      fromDate: "",
      toDate: ""
    };
    this.quickAddState = {
      projectName: "",
      sectionName: "Add",
      taskText: ""
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_DAILY_DASHBOARD;
  }
  getDisplayText() {
    return "Daily Dashboard";
  }
  getIcon() {
    return "check-square";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    var _a, _b, _c, _d;
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = (_a = todoSnapshot == null ? void 0 : todoSnapshot.projects) != null ? _a : [];
      const staleProjects = (_b = todoSnapshot == null ? void 0 : todoSnapshot.staleProjects) != null ? _b : [];
      const breakdownCandidates = (_c = todoSnapshot == null ? void 0 : todoSnapshot.breakdownCandidates) != null ? _c : [];
      const cleanupSuggestions = (_d = todoSnapshot == null ? void 0 : todoSnapshot.cleanupSuggestions) != null ? _d : [];
      const workLogEntries = this.getFilteredWorkLogEntries();
      const staleProjectCount = staleProjects.length;
      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }
      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");
      const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
      const hero = page.createDiv({ cls: "daily-dashboard-hero" });
      if (wallpaperUrl) {
        hero.addClass("has-wallpaper");
        hero.style.setProperty("--daily-dashboard-wallpaper", `url("${wallpaperUrl}")`);
      }
      const heroCopy = hero.createDiv({ cls: "daily-dashboard-hero-copy" });
      heroCopy.createEl("span", { cls: "daily-dashboard-kicker", text: "Daily operating dashboard" });
      heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title", text: settings.dashboardTitle });
      heroCopy.createEl("p", {
        cls: "daily-dashboard-hero-text",
        text: "Drive the day with a clear Top 3, surface stale projects before they rot, and keep work, habits, friction, and reviews tied together."
      });
      const heroMeta = hero.createDiv({ cls: "daily-dashboard-hero-meta" });
      heroMeta.createEl("span", { cls: "daily-dashboard-date-pill", text: todayEntry.date });
      heroMeta.createEl("span", {
        cls: "daily-dashboard-stat-pill",
        text: `${todayEntry.completedTasks.length} archived today`
      });
      heroMeta.createEl("span", {
        cls: "daily-dashboard-stat-pill",
        text: `${staleProjectCount} stale project${staleProjectCount === 1 ? "" : "s"}`
      });
      heroMeta.createEl("span", {
        cls: "daily-dashboard-stat-pill",
        text: `Mood ${renderScore(todayEntry.moodScore)} \u2022 Energy ${renderScore(todayEntry.energyScore)}`
      });
      const actions = hero.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true);
      createButton(actions, "Promote to today", async () => this.plugin.openPromoteTaskFlow());
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow());
      createButton(actions, "Weekly review", async () => this.plugin.generateWeeklyReview());
      createButton(actions, "Weekly report", async () => this.plugin.generateWeeklyReport());
      createButton(actions, "Monthly report", async () => this.plugin.generateMonthlyReport());
      createButton(actions, "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));
      const grid = page.createDiv({ cls: "daily-dashboard-grid" });
      const focusCard = createCard(grid, "Top 3 For Today", "Keep today concrete. Promote project tasks here or type them directly.");
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      if (todayEntry.todayFocus.length === 0) {
        focusList.createEl("p", { cls: "daily-dashboard-empty", text: "No focus items yet. Add one below or use Promote to today." });
      } else {
        todayEntry.todayFocus.forEach((item, index) => {
          const row = focusList.createDiv({ cls: "daily-dashboard-food-row" });
          row.createEl("span", { text: item });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Done" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeTodayFocusItem(index);
          });
        });
      }
      const focusAddRow = focusCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const focusInput = focusAddRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a focus item" }
      });
      const focusButton = focusAddRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      focusButton.type = "button";
      const submitFocus = async () => {
        const value = focusInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addTodayFocusItem(value);
        focusInput.value = "";
      };
      focusInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitFocus();
        }
      });
      focusButton.addEventListener("click", () => {
        void submitFocus();
      });
      const stateCard = createCard(grid, "State And Friction", "Track the day honestly so weak-output days can be explained, not guessed at later.");
      this.renderScoreControl(stateCard, "Mood", todayEntry.moodScore, (value) => this.plugin.updateMoodScore(value));
      this.renderScoreControl(stateCard, "Energy", todayEntry.energyScore, (value) => this.plugin.updateEnergyScore(value));
      const missedCard = stateCard.createDiv({ cls: "daily-dashboard-score-block" });
      missedCard.createEl("strong", { text: "Habit misses so far" });
      missedCard.createEl("span", {
        cls: "daily-dashboard-habit-meta",
        text: todayEntry.missedHabits.length > 0 ? todayEntry.missedHabits.join(", ") : "No misses recorded yet."
      });
      stateCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Friction log" });
      const frictionInput = stateCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      frictionInput.value = todayEntry.frictionLog;
      frictionInput.placeholder = "Blockers, pain points, context switching, or anything that made the day harder.";
      frictionInput.addEventListener("change", () => {
        void this.plugin.updateFrictionLog(frictionInput.value);
      });
      const habitsCard = createCard(grid, "Habits", "Daily repeats with misses explicitly tracked for weekly and monthly analysis.");
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit) => {
        var _a2;
        const currentValue = (_a2 = todayEntry.habits[habit.id]) != null ? _a2 : 0;
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done \u2022 ${this.plugin.getHabitStreak(habit.id)} day streak`
        });
        const controls = row.createDiv({ cls: "daily-dashboard-habit-controls" });
        for (let index = 1; index <= habit.target; index += 1) {
          const stepButton = controls.createEl("button", {
            cls: index <= currentValue ? "daily-dashboard-step is-active" : "daily-dashboard-step",
            text: `${index}`
          });
          stepButton.type = "button";
          stepButton.addEventListener("click", () => {
            const nextValue = currentValue === index ? index - 1 : index;
            void this.plugin.updateHabitValue(habit.id, nextValue);
          });
        }
      });
      const quickAddCard = createCard(grid, "Quick Add To Project", "Capture new work into Add, Fix, Now, Next, or Later without leaving the dashboard.");
      const quickAddForm = quickAddCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const projectSelect = quickAddForm.createEl("select", { cls: "daily-dashboard-input" });
      projects.forEach((project) => {
        const option = projectSelect.createEl("option", { text: project.name });
        option.value = project.name;
        option.selected = project.name === this.quickAddState.projectName;
      });
      projectSelect.addEventListener("change", () => {
        this.quickAddState.projectName = projectSelect.value;
      });
      const sectionSelect = quickAddForm.createEl("select", { cls: "daily-dashboard-input" });
      ["Add", "Fix", "Now", "Next", "Later"].forEach((section) => {
        const option = sectionSelect.createEl("option", { text: section });
        option.value = section;
        option.selected = section === this.quickAddState.sectionName;
      });
      sectionSelect.addEventListener("change", () => {
        this.quickAddState.sectionName = sectionSelect.value;
      });
      const taskInput = quickAddForm.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a task to the selected project" }
      });
      taskInput.value = this.quickAddState.taskText;
      taskInput.addEventListener("input", () => {
        this.quickAddState.taskText = taskInput.value;
      });
      const quickAddButton = quickAddForm.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add task" });
      quickAddButton.type = "button";
      quickAddButton.addEventListener("click", () => {
        const text = taskInput.value.trim();
        if (!text || !this.quickAddState.projectName) {
          return;
        }
        this.quickAddState.taskText = "";
        void this.plugin.addTaskToProject(this.quickAddState.projectName, this.quickAddState.sectionName, text);
      });
      const foodCard = createCard(grid, "Food Log", "Quick capture of what you ate today so the daily note stays analyzable later.");
      const foodInputRow = foodCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const foodInput = foodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a meal or snack" }
      });
      const foodButton = foodInputRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      foodButton.type = "button";
      const submitFood = async () => {
        const value = foodInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addFoodEntry(value);
        foodInput.value = "";
      };
      foodInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submitFood();
        }
      });
      foodButton.addEventListener("click", () => {
        void submitFood();
      });
      const foodList = foodCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (todayEntry.foodLog.length === 0) {
        foodList.createEl("p", { cls: "daily-dashboard-empty", text: "No food entries yet today." });
      } else {
        todayEntry.foodLog.forEach((item, index) => {
          const row = foodList.createDiv({ cls: "daily-dashboard-food-row" });
          row.createEl("span", { text: item });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeFoodEntry(index);
          });
        });
      }
      const notesCard = createCard(grid, "Sleep And Notes", "Use sleep logging and a short daily note so reports can connect context to performance.");
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Sleep log" });
      const sleepInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      sleepInput.value = todayEntry.sleepLog;
      sleepInput.placeholder = "Bedtime, wake time, sleep quality, naps, anything worth tracking.";
      sleepInput.addEventListener("change", () => {
        void this.plugin.updateSleepLog(sleepInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
      const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      notesInput.value = todayEntry.notes;
      notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
      notesInput.addEventListener("change", () => {
        void this.plugin.updateDailyNotes(notesInput.value);
      });
      const workLogCard = createCard(grid, "Searchable Work Log", "Filter archived completions by project, date, or keyword instead of scanning raw history.");
      const filterGrid = workLogCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const projectFilter = filterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allProjectsOption = projectFilter.createEl("option", { text: "All projects" });
      allProjectsOption.value = "";
      projects.forEach((project) => {
        const option = projectFilter.createEl("option", { text: project.name });
        option.value = project.name;
        option.selected = project.name === this.workLogFilters.project;
      });
      projectFilter.addEventListener("change", () => {
        this.workLogFilters.project = projectFilter.value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "Keyword", this.workLogFilters.keyword, (value) => {
        this.workLogFilters.keyword = value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "From date (YYYY-MM-DD)", this.workLogFilters.fromDate, (value) => {
        this.workLogFilters.fromDate = value;
        void this.render();
      });
      this.createFilterInput(filterGrid, "To date (YYYY-MM-DD)", this.workLogFilters.toDate, (value) => {
        this.workLogFilters.toDate = value;
        void this.render();
      });
      const workLogList = workLogCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (workLogEntries.length === 0) {
        workLogList.createEl("p", { cls: "daily-dashboard-empty", text: "No archived work matches the current filters." });
      } else {
        workLogEntries.slice(0, 20).forEach((task) => {
          const row = workLogList.createDiv({ cls: "daily-dashboard-completed-row" });
          row.createEl("strong", { text: task.project });
          row.createEl("span", { text: `${task.section}: ${task.text}` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: task.archivedAt });
        });
      }
      const projectsCard = createCard(grid, "Project Health", "Projects are scored by backlog size, stale age, recent output, and momentum so weak areas stay visible.");
      const projectList = projectsCard.createDiv({ cls: "daily-dashboard-project-list" });
      if (!todoSnapshot || todoSnapshot.projects.length === 0) {
        projectList.createEl("p", { cls: "daily-dashboard-empty", text: "No project data found in the configured master task hub." });
      } else {
        [...todoSnapshot.projects].sort((left, right) => right.healthScore - left.healthScore).slice(0, 10).forEach((project) => {
          const row = projectList.createDiv({ cls: "daily-dashboard-project-row" });
          row.createEl("strong", { text: `${project.name} \u2022 ${project.healthScore}` });
          row.createEl("span", { text: `${project.healthLabel} \u2022 ${project.openCount} open \u2022 ${project.completionsThisWeek} this week \u2022 ${project.completionsThisMonth} this month \u2022 ${project.trend}` });
          if (project.staleDays !== null) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
          }
          if (project.focus) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Focus: ${project.focus}` });
          }
          if (project.relationships.length > 0) {
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Relationships: ${project.relationships.join(", ")}` });
          }
        });
      }
      const alertsCard = createCard(grid, "Stale Work And Cleanup", "Detect stale projects, vague tasks, duplicates, and empty sections before the hub gets mushy.");
      const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
      const alertLines = [
        ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
        ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`),
        ...cleanupSuggestions.slice(0, 5)
      ];
      if (alertLines.length === 0) {
        alertsList.createEl("p", { cls: "daily-dashboard-empty", text: "No stale-work or cleanup issues detected right now." });
      } else {
        alertLines.forEach((line) => {
          const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
          row.createEl("span", { text: line });
        });
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions());
      createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true));
      const completedCard = createCard(grid, "Completed Today", "Recent completions remain visible for quick review and habit-memory reinforcement.");
      const completedList = completedCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (todayEntry.completedTasks.length === 0) {
        completedList.createEl("p", { cls: "daily-dashboard-empty", text: "No archived tasks yet today." });
      } else {
        todayEntry.completedTasks.slice(0, 10).forEach((task) => {
          const row = completedList.createDiv({ cls: "daily-dashboard-completed-row" });
          row.createEl("strong", { text: task.project });
          row.createEl("span", { text: `${task.section}: ${task.text}` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: task.archivedAt });
        });
      }
    } catch (error) {
      console.error("Daily dashboard render failed", error);
      this.renderErrorState(error);
    }
  }
  renderErrorState(error) {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("daily-dashboard-view");
    const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
    const card = createCard(page, "Dashboard Failed To Render", "The dashboard hit a runtime error, so this fallback view is shown instead of a blank page.");
    const message = error instanceof Error ? `${error.name}: ${error.message}` : `${error}`;
    card.createEl("p", { text: message || "Unknown error" });
    const actions = card.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(actions, "Open master todo", async () => this.plugin.openMasterTodo(), true);
    createButton(actions, "Weekly report", async () => this.plugin.generateWeeklyReport());
    createButton(actions, "Monthly report", async () => this.plugin.generateMonthlyReport());
  }
  createFilterInput(parent, placeholder, value, onChange) {
    const input = parent.createEl("input", {
      cls: "daily-dashboard-input",
      attr: { type: "text", placeholder }
    });
    input.value = value;
    input.addEventListener("change", () => {
      onChange(input.value.trim());
    });
  }
  getFilteredWorkLogEntries() {
    const entries = this.plugin.getAllEntries().flatMap((entry) => entry.completedTasks).sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));
    return entries.filter((entry) => {
      const matchesProject = !this.workLogFilters.project || entry.project === this.workLogFilters.project;
      const matchesKeyword = !this.workLogFilters.keyword || `${entry.project} ${entry.section} ${entry.text}`.toLowerCase().includes(this.workLogFilters.keyword.toLowerCase());
      const datePart = entry.archivedAt.slice(0, 10);
      const matchesFrom = !this.workLogFilters.fromDate || datePart >= this.workLogFilters.fromDate;
      const matchesTo = !this.workLogFilters.toDate || datePart <= this.workLogFilters.toDate;
      return matchesProject && matchesKeyword && matchesFrom && matchesTo;
    });
  }
  renderScoreControl(parent, label, currentValue, onSelect) {
    const wrapper = parent.createDiv({ cls: "daily-dashboard-score-block" });
    const header = wrapper.createDiv({ cls: "daily-dashboard-score-header" });
    header.createEl("strong", { text: label });
    header.createEl("span", { cls: "daily-dashboard-habit-meta", text: currentValue > 0 ? `${currentValue}/5` : "Not logged" });
    const controls = wrapper.createDiv({ cls: "daily-dashboard-habit-controls" });
    for (let score = 1; score <= 5; score += 1) {
      const button = controls.createEl("button", {
        cls: score === currentValue ? "daily-dashboard-step is-active" : "daily-dashboard-step",
        text: `${score}`
      });
      button.type = "button";
      button.addEventListener("click", () => {
        void onSelect(currentValue === score ? 0 : score);
      });
    }
  }
};
var CreateProjectModal = class extends import_obsidian.Modal {
  constructor(app, plugin, categories) {
    var _a;
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.state = {
      projectName: "",
      categoryName: (_a = categories[0]) != null ? _a : "Projects",
      status: "Planning",
      focus: "",
      addTasks: [],
      fixTasks: []
    };
  }
  onOpen() {
    this.setTitle("Create Project And Project Note");
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian.Setting(contentEl).setName("Project name").setDesc("Used for the master todo section and the new project note name.").addText((text) => {
      text.setPlaceholder("New Project").onChange((value) => {
        this.state.projectName = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new import_obsidian.Setting(contentEl).setName("Category").setDesc("Top-level section in the master todo where this project should be added.").addDropdown((dropdown) => {
      const options = [...this.categories];
      if (!options.includes(this.state.categoryName)) {
        options.unshift(this.state.categoryName);
      }
      options.forEach((category) => dropdown.addOption(category, category));
      dropdown.setValue(this.state.categoryName);
      dropdown.onChange((value) => {
        this.state.categoryName = value;
      });
    }).addText((text) => {
      text.setPlaceholder("Or type a new category name").onChange((value) => {
        if (value.trim()) {
          this.state.categoryName = value.trim();
        }
      });
    });
    new import_obsidian.Setting(contentEl).setName("Status").setDesc("Initial status written to the master todo and project note.").addDropdown((dropdown) => {
      ["Planning", "Active", "Parked", "Blocked"].forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(this.state.status);
      dropdown.onChange((value) => {
        this.state.status = value;
      });
    });
    new import_obsidian.Setting(contentEl).setName("Focus").setDesc("Short description of the current objective for this project.").addTextArea((textArea) => {
      textArea.setPlaceholder("What matters most right now for this project?").onChange((value) => {
        this.state.focus = value;
      });
      textArea.inputEl.rows = 3;
    });
    new import_obsidian.Setting(contentEl).setName("Add tasks").setDesc("Optional. One task per line; these seed the Add section.").addTextArea((textArea) => {
      textArea.setPlaceholder("First task\nSecond task").onChange((value) => {
        this.state.addTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian.Setting(contentEl).setName("Fix tasks").setDesc("Optional. One task per line; these seed the Fix section.").addTextArea((textArea) => {
      textArea.setPlaceholder("Known bug\nAnother bug").onChange((value) => {
        this.state.fixTasks = splitMultilineInput(value);
      });
      textArea.inputEl.rows = 5;
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Create project").setCta().onClick(async () => {
        if (!this.state.projectName.trim()) {
          new import_obsidian.Notice("Project name is required.");
          return;
        }
        if (!this.state.categoryName.trim()) {
          new import_obsidian.Notice("Category is required.");
          return;
        }
        await this.plugin.createProjectAndNote(this.state);
        this.close();
      });
    }).addExtraButton((button) => {
      button.setIcon("x").setTooltip("Cancel").onClick(() => {
        this.close();
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PromoteTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, projects) {
    var _a, _b;
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = (_b = (_a = projects[0]) == null ? void 0 : _a.name) != null ? _b : "";
  }
  onOpen() {
    var _a, _b, _c;
    this.setTitle("Promote Project Task To Today");
    const { contentEl } = this;
    contentEl.empty();
    const projectSetting = new import_obsidian.Setting(contentEl).setName("Project");
    projectSetting.addDropdown((dropdown) => {
      this.projects.forEach((project) => dropdown.addOption(project.name, project.name));
      dropdown.setValue(this.selectedProjectName);
      dropdown.onChange((value) => {
        this.selectedProjectName = value;
        this.onOpen();
      });
    });
    const selectedProject = this.projects.find((project) => project.name === this.selectedProjectName);
    const candidateTasks = [
      ...(_a = selectedProject == null ? void 0 : selectedProject.nowTasks) != null ? _a : [],
      ...(_b = selectedProject == null ? void 0 : selectedProject.nextTasks) != null ? _b : [],
      ...(_c = selectedProject == null ? void 0 : selectedProject.breakdownTasks) != null ? _c : []
    ].slice(0, 20);
    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new import_obsidian.Setting(contentEl).setName(task).addButton((button) => {
          button.setButtonText("Promote").setCta().onClick(async () => {
            await this.plugin.promoteTaskToToday(this.selectedProjectName, task);
            this.close();
          });
        });
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ProjectReviewModal = class extends import_obsidian.Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.options = options;
  }
  onOpen() {
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();
    this.options.forEach((option) => {
      new import_obsidian.Setting(contentEl).setName(option.projectName).setDesc(option.notePath).addButton((button) => {
        button.setButtonText("Open").setCta().onClick(async () => {
          await this.plugin.openProjectReviewMode(option);
          this.close();
        });
      });
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DailyDashboardSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Dashboard" });
    new import_obsidian.Setting(containerEl).setName("Dashboard title").setDesc("Displayed at the top of the custom dashboard tab.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dashboardTitle).setValue(settings.dashboardTitle).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dashboardTitle: value.trim() || DEFAULT_SETTINGS.dashboardTitle
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Master Task Hub note path").setDesc("The note used for project task counts, project creation, and archive automation.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.masterTodoPath).setValue(settings.masterTodoPath).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          masterTodoPath: value.trim() || DEFAULT_SETTINGS.masterTodoPath
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Project notes folder").setDesc("New project notes created by the intake flow are written here.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder).setValue(settings.projectNotesFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          projectNotesFolder: value.trim() || DEFAULT_SETTINGS.projectNotesFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Daily log folder").setDesc("Markdown logs written once per day.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder).setValue(settings.dailyLogFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          dailyLogFolder: value.trim() || DEFAULT_SETTINGS.dailyLogFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Weekly report folder").setDesc("Where generated weekly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder).setValue(settings.weeklyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weeklyReportFolder: value.trim() || DEFAULT_SETTINGS.weeklyReportFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Monthly report folder").setDesc("Where generated monthly summaries are written.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder).setValue(settings.monthlyReportFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          monthlyReportFolder: value.trim() || DEFAULT_SETTINGS.monthlyReportFolder
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Wallpaper folder").setDesc("Image folder used for dashboard hero wallpapers.").addText((text) => {
      text.setPlaceholder(DEFAULT_SETTINGS.wallpaperFolder).setValue(settings.wallpaperFolder).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          wallpaperFolder: value.trim() || DEFAULT_SETTINGS.wallpaperFolder,
          selectedWallpaper: ""
        });
        this.display();
      });
    });
    const wallpaperFiles = this.plugin.getWallpaperFiles();
    new import_obsidian.Setting(containerEl).setName("Selected wallpaper").setDesc(wallpaperFiles.length > 0 ? "Choose the image shown in the top section of the dashboard." : "No image files were found in the configured wallpaper folder.").addDropdown((dropdown) => {
      dropdown.addOption("", "Default / first image");
      wallpaperFiles.forEach((file) => {
        dropdown.addOption(file.path, file.displayName);
      });
      dropdown.setValue(settings.selectedWallpaper);
      dropdown.onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          selectedWallpaper: value
        });
      });
    });
    new import_obsidian.Setting(containerEl).setName("Habit definitions").setDesc("One habit per line using the format Habit Name|Target Count.").addTextArea((textArea) => {
      textArea.setPlaceholder("Take pills|1\nBrush teeth|2\nFloss|2\nShower|1\nLog sleep|1").setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}`).join("\n")).onChange(async (value) => {
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          habitDefinitions: parseHabitDefinitions(value)
        });
      });
      textArea.inputEl.rows = 8;
      textArea.inputEl.cols = 36;
    });
  }
};
function createCard(parent, title, description) {
  const card = parent.createDiv({ cls: "daily-dashboard-card" });
  card.addClass(`daily-dashboard-card--${toClassSlug(title)}`);
  const header = card.createDiv({ cls: "daily-dashboard-card-header" });
  header.createEl("h2", { text: title });
  header.createEl("p", { text: description });
  return card;
}
function createButton(parent, text, onClick, isPrimary = false) {
  const button = parent.createEl("button", {
    cls: isPrimary ? "daily-dashboard-primary-button" : "daily-dashboard-secondary-button",
    text
  });
  button.type = "button";
  button.addEventListener("click", () => {
    void onClick();
  });
}
function toClassSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function sanitizeSettings(settings) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const parsedHabitDefinitions = Array.isArray(settings.habitDefinitions) ? settings.habitDefinitions.map((habit) => {
    var _a2;
    return {
      id: createHabitId(habit.id || habit.label || "habit"),
      label: typeof habit.label === "string" ? habit.label.trim() : "Habit",
      target: clamp(Number((_a2 = habit.target) != null ? _a2 : 1), 1, 12)
    };
  }).filter((habit) => habit.label.length > 0) : DEFAULT_SETTINGS.habitDefinitions;
  return {
    dashboardTitle: ((_a = settings.dashboardTitle) == null ? void 0 : _a.trim()) || DEFAULT_SETTINGS.dashboardTitle,
    masterTodoPath: ((_b = settings.masterTodoPath) == null ? void 0 : _b.trim()) || DEFAULT_SETTINGS.masterTodoPath,
    projectNotesFolder: normalizeFolderPath(((_c = settings.projectNotesFolder) == null ? void 0 : _c.trim()) || DEFAULT_SETTINGS.projectNotesFolder),
    dailyLogFolder: ((_d = settings.dailyLogFolder) == null ? void 0 : _d.trim()) || DEFAULT_SETTINGS.dailyLogFolder,
    weeklyReportFolder: ((_e = settings.weeklyReportFolder) == null ? void 0 : _e.trim()) || DEFAULT_SETTINGS.weeklyReportFolder,
    monthlyReportFolder: ((_f = settings.monthlyReportFolder) == null ? void 0 : _f.trim()) || DEFAULT_SETTINGS.monthlyReportFolder,
    wallpaperFolder: normalizeFolderPath(((_g = settings.wallpaperFolder) == null ? void 0 : _g.trim()) || DEFAULT_SETTINGS.wallpaperFolder),
    selectedWallpaper: ((_h = settings.selectedWallpaper) == null ? void 0 : _h.trim()) || DEFAULT_SETTINGS.selectedWallpaper,
    habitDefinitions: parsedHabitDefinitions.length > 0 ? parsedHabitDefinitions : DEFAULT_SETTINGS.habitDefinitions
  };
}
function normalizeFolderPath(value) {
  const normalized = (0, import_obsidian.normalizePath)(value.trim());
  return normalized.replace(/\/+$/g, "");
}
function createEmptyEntry(date, habits) {
  const habitValues = Object.fromEntries(habits.map((habit) => [habit.id, 0]));
  return {
    date,
    habits: habitValues,
    moodScore: 0,
    energyScore: 0,
    todayFocus: [],
    frictionLog: "",
    missedHabits: computeMissedHabits(habitValues, habits),
    foodLog: [],
    sleepLog: "",
    notes: "",
    completedTasks: []
  };
}
function parseHabitDefinitions(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return DEFAULT_SETTINGS.habitDefinitions;
  }
  return lines.map((line) => {
    const [rawLabel, rawTarget] = line.split("|");
    const label = (rawLabel == null ? void 0 : rawLabel.trim()) || "Habit";
    const target = clamp(Number((rawTarget == null ? void 0 : rawTarget.trim()) || 1), 1, 12);
    return {
      id: createHabitId(label),
      label,
      target
    };
  });
}
function createHabitId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "habit";
}
function clamp(value, minimum, maximum) {
  if (Number.isNaN(value)) {
    return minimum;
  }
  return Math.min(Math.max(value, minimum), maximum);
}
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatDateTimeKey(date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${formatDateKey(date)} ${hours}:${minutes}`;
}
function renderScore(value) {
  return value > 0 ? `${value}/5` : "-";
}
function renderDailyLog(entry, habits) {
  const habitLines = habits.map((habit) => {
    var _a;
    return `- ${habit.label}: ${(_a = entry.habits[habit.id]) != null ? _a : 0}/${habit.target}`;
  });
  const foodLines = entry.foodLog.length > 0 ? entry.foodLog.map((item) => `- ${item}`) : ["- None logged"];
  const completedTaskLines = entry.completedTasks.length > 0 ? entry.completedTasks.map((task) => `- ${task.project} / ${task.section}: ${task.text}`) : ["- No archived tasks today"];
  return [
    "---",
    `date: ${entry.date}`,
    `workCompleted: ${entry.completedTasks.length}`,
    `foodEntryCount: ${entry.foodLog.length}`,
    `moodScore: ${entry.moodScore}`,
    `energyScore: ${entry.energyScore}`,
    "---",
    "",
    `# Daily Dashboard Log - ${entry.date}`,
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
    "## Work Completed",
    ...completedTaskLines,
    "",
    "## Notes",
    entry.notes || "No notes yet.",
    ""
  ].join("\n");
}
function renderPeriodReport(input) {
  const workByProject = /* @__PURE__ */ new Map();
  let daysWithFood = 0;
  let daysWithSleep = 0;
  let moodTotal = 0;
  let moodDays = 0;
  let energyTotal = 0;
  let energyDays = 0;
  input.entries.forEach((entry) => {
    if (entry.foodLog.length > 0) {
      daysWithFood += 1;
    }
    if (entry.sleepLog.trim().length > 0) {
      daysWithSleep += 1;
    }
    if (entry.moodScore > 0) {
      moodTotal += entry.moodScore;
      moodDays += 1;
    }
    if (entry.energyScore > 0) {
      energyTotal += entry.energyScore;
      energyDays += 1;
    }
    entry.completedTasks.forEach((task) => {
      var _a;
      workByProject.set(task.project, ((_a = workByProject.get(task.project)) != null ? _a : 0) + 1);
    });
  });
  const habitRows = input.habitDefinitions.map((habit) => {
    const completed = input.entries.reduce((sum, entry) => {
      var _a;
      return sum + Math.min((_a = entry.habits[habit.id]) != null ? _a : 0, habit.target);
    }, 0);
    const target = input.entries.length * habit.target;
    const percentage = target > 0 ? Math.round(completed / target * 100) : 0;
    return `| ${habit.label} | ${completed}/${target} | ${percentage}% |`;
  });
  const workLines = Array.from(workByProject.entries()).sort((left, right) => right[1] - left[1]).map(([project, count]) => `- ${project}: ${count}`);
  const dayLines = input.entries.map((entry) => {
    const foodSummary = entry.foodLog.length > 0 ? `${entry.foodLog.length} food entries` : "no food log";
    return `- ${entry.date}: ${entry.completedTasks.length} archived tasks, ${foodSummary}, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`;
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
    `- Average mood: ${moodDays > 0 ? `${(moodTotal / moodDays).toFixed(1)}/5` : "No mood data"}`,
    `- Average energy: ${energyDays > 0 ? `${(energyTotal / energyDays).toFixed(1)}/5` : "No energy data"}`,
    "",
    "## Habit Completion",
    "| Habit | Completed | Rate |",
    "| --- | --- | --- |",
    ...habitRows,
    "",
    "## Work By Project",
    ...workLines.length > 0 ? workLines : ["- No archived tasks recorded in this period"],
    "",
    "## Daily Breakdown",
    ...dayLines.length > 0 ? dayLines : ["- No daily entries recorded in this period"],
    ""
  ].join("\n");
}
function parseTodoSnapshot(content) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const now = /* @__PURE__ */ new Date();
  const thisWeekStart = getIsoWeekRange(now).start;
  const previousWeekStart = new Date(thisWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(thisWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const monthKey = formatDateKey(now).slice(0, 7);
  const projects = findProjectRanges(lines).map((project) => {
    var _a, _b, _c;
    let openCount = 0;
    let archivedCount = 0;
    let currentSection = "General";
    let focus = "";
    let categoryName = "Projects";
    let lastCompletedAt = null;
    let completionsThisWeek = 0;
    let completionsPreviousWeek = 0;
    let completionsThisMonth = 0;
    const noteLinks = /* @__PURE__ */ new Set();
    const nowTasks = [];
    const nextTasks = [];
    const laterTasks = [];
    const dueRepeatingTasks = [];
    const breakdownTasks = [];
    const emptySections = /* @__PURE__ */ new Set();
    const relationships = /* @__PURE__ */ new Set();
    const seenTasks = /* @__PURE__ */ new Map();
    const duplicateTasks = /* @__PURE__ */ new Set();
    const sectionCounts = /* @__PURE__ */ new Map();
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
      const normalizedTask = taskText.toLowerCase();
      const sectionKey = currentSection.toLowerCase();
      const isComplete = taskMatch[1].toLowerCase() === "x";
      emptySections.delete(currentSection);
      seenTasks.set(normalizedTask, ((_a = seenTasks.get(normalizedTask)) != null ? _a : 0) + 1);
      if (((_b = seenTasks.get(normalizedTask)) != null ? _b : 0) > 1) {
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
      sectionCounts.set(sectionKey, ((_c = sectionCounts.get(sectionKey)) != null ? _c : 0) + 1);
      if (sectionKey === "now") {
        nowTasks.push(taskText);
      }
      if (sectionKey === "next") {
        nextTasks.push(taskText);
      }
      if (sectionKey === "later") {
        laterTasks.push(taskText);
      }
      if (sectionKey === "repeating") {
        dueRepeatingTasks.push(taskText);
      }
      if (looksLikeBreakdownTask(taskText)) {
        breakdownTasks.push(taskText);
      }
    }
    const staleDays = lastCompletedAt ? daysBetween(lastCompletedAt, formatDateKey(now)) : null;
    const trend = completionsThisWeek > completionsPreviousWeek ? "up" : completionsThisWeek < completionsPreviousWeek ? "down" : "flat";
    const healthScore = computeHealthScore({
      openCount,
      staleDays,
      completionsThisWeek,
      nowCount: nowTasks.length,
      nextCount: nextTasks.length,
      breakdownCount: breakdownTasks.length,
      duplicateCount: duplicateTasks.size
    });
    return {
      name: project.name,
      categoryName,
      openCount,
      archivedCount,
      completionRate: openCount + archivedCount > 0 ? Math.round(archivedCount / (openCount + archivedCount) * 100) : 0,
      focus,
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
      healthScore,
      healthLabel: describeHealthScore(healthScore),
      relationships: Array.from(relationships)
    };
  });
  const breakdownCandidates = projects.flatMap((project) => project.breakdownTasks.map((task) => ({ project: project.name, task })));
  const staleProjects = projects.filter((project) => project.staleDays !== null && project.staleDays >= 7).sort((left, right) => {
    var _a, _b;
    return ((_a = right.staleDays) != null ? _a : 0) - ((_b = left.staleDays) != null ? _b : 0);
  });
  const cleanupSuggestions = projects.flatMap((project) => buildCleanupSuggestions(project));
  return {
    totalOpen: projects.reduce((sum, project) => sum + project.openCount, 0),
    totalArchived: projects.reduce((sum, project) => sum + project.archivedCount, 0),
    projects,
    staleProjects,
    breakdownCandidates,
    cleanupSuggestions
  };
}
function archiveCompletedTasks(content, archivedAt) {
  const lines = content.split(/\r?\n/);
  const projectRanges = findProjectRanges(lines);
  if (projectRanges.length === 0) {
    return { content, archivedTasks: [] };
  }
  const output = [];
  const archivedTasks = [];
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
function archiveCompletedTasksFromProjectLines(projectLines, projectName, archivedAt) {
  const keptLines = [];
  const archivedTasks = [];
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
function findProjectRanges(lines) {
  const ranges = [];
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
function getProjectHeaderName(lines, index) {
  var _a, _b, _c, _d;
  const line = (_b = (_a = lines[index]) == null ? void 0 : _a.trim()) != null ? _b : "";
  const nextLine = (_d = (_c = lines[index + 1]) == null ? void 0 : _c.trim()) != null ? _d : "";
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
function getSectionName(line) {
  const trimmed = line.trim();
  if (/^###\s+/.test(trimmed)) {
    return trimmed.replace(/^###\s+/, "").trim();
  }
  const sectionMatch = trimmed.match(SECTION_HEADER_REGEX);
  return sectionMatch ? sectionMatch[1] : null;
}
function isCompletedArchiveHeader(line) {
  const trimmed = line.trim().toLowerCase();
  return trimmed === "completed archive:" || trimmed === "### completed archive";
}
function isNonArchivableSection(sectionName) {
  const normalized = sectionName.trim().toLowerCase();
  return normalized === "completed archive" || normalized === "reference" || normalized === "resources";
}
function parseProjectMeta(line) {
  const match = line.trim().match(PROJECT_META_REGEX);
  if (!match) {
    return null;
  }
  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim()
  };
}
function extractNoteLinks(value) {
  const links = [];
  let match = NOTE_LINK_REGEX.exec(value);
  while (match) {
    links.push(match[1]);
    match = NOTE_LINK_REGEX.exec(value);
  }
  NOTE_LINK_REGEX.lastIndex = 0;
  return links;
}
function getIsoWeekRange(referenceDate) {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
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
function findTodoCategoryRanges(lines) {
  const ranges = [];
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
function getTodoCategoryName(line) {
  var _a;
  const trimmed = (_a = line == null ? void 0 : line.trim()) != null ? _a : "";
  if (!/^#\s+/.test(trimmed) || /^##\s+/.test(trimmed)) {
    return null;
  }
  const name = trimmed.replace(/^#\s+/, "").trim();
  return name.toLowerCase() === "master task hub" ? null : name;
}
function insertProjectIntoTodo(content, categoryName, projectBlock) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const targetCategory = categories.find((category) => category.name.toLowerCase() === categoryName.toLowerCase());
  const blockLines = projectBlock.split("\n");
  if (!targetCategory) {
    const result2 = trimTrailingBlankLines(lines);
    if (result2.length > 0) {
      result2.push("");
    }
    result2.push(`# ${categoryName}`, "", ...blockLines, "");
    return result2.join("\n");
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
function trimTrailingBlankLines(lines) {
  const output = [...lines];
  while (output.length > 0 && output[output.length - 1].trim() === "") {
    output.pop();
  }
  return output;
}
function trimLeadingBlankLines(lines) {
  const output = [...lines];
  while (output.length > 0 && output[0].trim() === "") {
    output.shift();
  }
  return output;
}
function renderTodoProjectBlock(input) {
  const addTasks = input.addTasks.length > 0 ? input.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixTasks = input.fixTasks.length > 0 ? input.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  return [
    `## ${input.projectName}`,
    `Project Note:: ${input.projectNoteLink}`,
    `Status:: ${input.status}`,
    `Focus:: ${input.focus || "Define the current focus for this project."}`,
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
    "### Repeating",
    "- [ ]",
    "",
    "Relationships::",
    "",
    "### Completed Archive",
    "",
    "### Reference"
  ].join("\n");
}
function renderProjectNoteTemplate(input, masterTodoPath) {
  return [
    `# ${input.projectName}`,
    "",
    "## Snapshot",
    `- Status: ${input.status || "Planning"}`,
    `- Category: ${input.categoryName}`,
    `- Focus: ${input.focus || "Define the current focus for this project."}`,
    `- Master Task Hub: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]]`,
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
    "## Relationships",
    "- Related projects, dependencies, and blockers.",
    "",
    "## Active Notes",
    "- Add project-specific notes here.",
    "",
    "## Decisions",
    "- Capture important decisions and tradeoffs here.",
    "",
    "## References",
    "- Add links, assets, commands, or supporting notes here.",
    ""
  ].join("\n");
}
function renderExistingProjectNoteTemplate(project, masterTodoPath) {
  const addLines = project.addTasks.length > 0 ? project.addTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  const fixLines = project.fixTasks.length > 0 ? project.fixTasks.map((task) => `- [ ] ${task}`) : ["- [ ]"];
  return [
    `# ${project.projectName}`,
    "",
    "## Snapshot",
    `- Status: ${project.status || "Planning"}`,
    `- Category: ${project.categoryName}`,
    `- Focus: ${project.focus || "Define the current focus for this project."}`,
    `- Master Task Hub: [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]]`,
    `- Project Entry: [[${project.noteLinkPath}|${project.projectName}]]`,
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
    "## Notes",
    "- Add working notes, ideas, and decisions here.",
    "",
    "## References",
    "- Move or summarize project-specific references here over time.",
    ""
  ].join("\n");
}
function createWikiLink(filePath, label) {
  return `[[${stripMarkdownExtension((0, import_obsidian.normalizePath)(filePath))}|${label}]]`;
}
function stripMarkdownExtension(path) {
  return path.replace(/\.md$/i, "");
}
function sanitizeFileName(value) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "-").trim();
  return cleaned || "New Project";
}
function splitMultilineInput(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}
function extractProjectDefinitionsFromTodo(content) {
  const lines = content.split(/\r?\n/);
  const categories = findTodoCategoryRanges(lines);
  const definitions = [];
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
function extractProjectDefinition(projectLines, categoryName) {
  var _a, _b, _c;
  const firstLine = (_b = (_a = projectLines[0]) == null ? void 0 : _a.trim()) != null ? _b : "";
  if (!firstLine.startsWith("## ")) {
    return null;
  }
  const projectName = firstLine.replace(/^##\s+/, "").trim();
  let status = "Planning";
  let focus = "";
  let noteLinkPath = `Project Notes/${projectName}`;
  let currentSection = "";
  const addTasks = [];
  const fixTasks = [];
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
        noteLinkPath = (_c = extractFirstNoteLinkPath(meta.value)) != null ? _c : noteLinkPath;
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
function extractFirstNoteLinkPath(value) {
  const match = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(value);
  return match ? match[1] : null;
}
function computeMissedHabits(habits, definitions) {
  return definitions.filter((definition) => {
    var _a;
    return ((_a = habits[definition.id]) != null ? _a : 0) < definition.target;
  }).map((definition) => definition.label);
}
function insertTaskIntoProjectSection(content, projectName, sectionName, taskText) {
  var _a;
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
    const existingTasks = output.slice(sectionStart + 1, sectionEnd + 1).map((line) => {
      var _a2;
      return (_a2 = line.match(CHECKLIST_REGEX)) == null ? void 0 : _a2[2].trim().toLowerCase();
    }).filter((line) => Boolean(line));
    if (existingTasks.includes(taskText.trim().toLowerCase())) {
      return content;
    }
    let insertIndex2 = sectionEnd + 1;
    while (insertIndex2 > sectionStart + 1 && output[insertIndex2 - 1].trim() === "") {
      insertIndex2 -= 1;
    }
    output.splice(insertIndex2, 0, taskLine);
    return output.join("\n");
  }
  let insertIndex = project.end + 1;
  for (let index = project.start + 1; index <= project.end; index += 1) {
    const currentSection = (_a = getSectionName(output[index])) == null ? void 0 : _a.toLowerCase();
    if (currentSection === "completed archive" || currentSection === "reference") {
      insertIndex = index;
      break;
    }
  }
  output.splice(insertIndex, 0, "", `### ${normalizedSection}`, taskLine);
  return output.join("\n");
}
function renderWeeklyReview(input) {
  var _a, _b, _c, _d;
  const totalTasks = input.entries.reduce((sum, entry) => sum + entry.completedTasks.length, 0);
  const moodEntries = input.entries.filter((entry) => entry.moodScore > 0);
  const energyEntries = input.entries.filter((entry) => entry.energyScore > 0);
  const averageMood = moodEntries.length > 0 ? (moodEntries.reduce((sum, entry) => sum + entry.moodScore, 0) / moodEntries.length).toFixed(1) : "n/a";
  const averageEnergy = energyEntries.length > 0 ? (energyEntries.reduce((sum, entry) => sum + entry.energyScore, 0) / energyEntries.length).toFixed(1) : "n/a";
  const focusItems = Array.from(new Set(input.entries.flatMap((entry) => entry.todayFocus))).slice(0, 10);
  const frictionItems = input.entries.map((entry) => entry.frictionLog).filter(Boolean);
  const missedHabits = Array.from(new Set(input.entries.flatMap((entry) => entry.missedHabits)));
  const strongestProjects = [...(_b = (_a = input.todoSnapshot) == null ? void 0 : _a.projects) != null ? _b : []].sort((left, right) => right.completionsThisWeek - left.completionsThisWeek).slice(0, 5);
  const staleProjects = (_d = (_c = input.todoSnapshot) == null ? void 0 : _c.staleProjects.slice(0, 5)) != null ? _d : [];
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
    ...focusItems.length > 0 ? focusItems.map((item) => `- ${item}`) : ["- No focus items recorded."],
    "",
    "## Friction Log",
    ...frictionItems.length > 0 ? frictionItems.map((item) => `- ${item}`) : ["- No friction logged."],
    "",
    "## Missed Habits",
    ...missedHabits.length > 0 ? missedHabits.map((item) => `- ${item}`) : ["- No recurring misses."],
    "",
    "## Strongest Projects",
    ...strongestProjects.length > 0 ? strongestProjects.map((project) => `- ${project.name}: ${project.completionsThisWeek} completions this week, ${project.healthLabel.toLowerCase()} health`) : ["- No project output recorded."],
    "",
    "## Projects Needing Attention",
    ...staleProjects.length > 0 ? staleProjects.map((project) => `- ${project.name}: stale for ${project.staleDays} days, ${project.openCount} open tasks`) : ["- No stale projects detected."],
    "",
    "## Daily Notes",
    ...input.entries.length > 0 ? input.entries.map((entry) => `- ${entry.date}: ${entry.completedTasks.length} archived, mood ${renderScore(entry.moodScore)}, energy ${renderScore(entry.energyScore)}`) : ["- No daily entries recorded."],
    ""
  ].join("\n");
}
function extractRepeatingTasks(noteContent) {
  const lines = noteContent.split(/\r?\n/);
  const tasks = [];
  let inRepeatingSection = false;
  lines.forEach((line) => {
    var _a, _b;
    const trimmed = line.trim();
    if (/^##+\s+/.test(trimmed)) {
      inRepeatingSection = /repeating/i.test(trimmed);
      return;
    }
    if (!inRepeatingSection) {
      return;
    }
    const taskMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (!taskMatch) {
      return;
    }
    const rawText = taskMatch[1].trim();
    const cadenceMatch = rawText.match(/\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\)/i);
    const cadence = ((_b = (_a = cadenceMatch == null ? void 0 : cadenceMatch[1]) != null ? _a : cadenceMatch == null ? void 0 : cadenceMatch[2]) != null ? _b : "weekly").toLowerCase();
    const text = rawText.replace(/\s*(\[(daily|weekly|monthly)\]|\((daily|weekly|monthly)\))\s*/i, "").trim();
    if (text) {
      tasks.push({ text, cadence });
    }
  });
  return tasks;
}
function isRepeatingTaskDue(task, content, projectName) {
  const lines = content.split(/\r?\n/);
  const project = findProjectRanges(lines).find((candidate) => candidate.name.toLowerCase() === projectName.toLowerCase());
  if (!project) {
    return false;
  }
  const projectText = lines.slice(project.start, project.end + 1).join("\n").toLowerCase();
  if (projectText.includes(`- [ ] ${task.text}`.toLowerCase())) {
    return false;
  }
  const archivedDates = [];
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
    return true;
  }
  const latest = archivedDates.sort().reverse()[0];
  const daysSince = daysBetween(latest, formatDateKey(/* @__PURE__ */ new Date()));
  if (task.cadence === "daily") {
    return daysSince >= 1;
  }
  if (task.cadence === "weekly") {
    return daysSince >= 7;
  }
  return daysSince >= 28;
}
async function offloadReferencesFromMasterHub(content, vault, masterTodoPath) {
  const lines = content.split(/\r?\n/);
  const projectDefinitions = extractProjectDefinitionsFromTodo(content);
  const output = [...lines];
  const offloadedProjects = [];
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
      if ((sectionName == null ? void 0 : sectionName.toLowerCase()) === "reference") {
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
    const referenceLines = output.slice(referenceStart + 1, referenceEnd + 1).map((line) => line.trim()).filter((line) => line.length > 0);
    if (referenceLines.length === 0) {
      continue;
    }
    const notePath = (0, import_obsidian.normalizePath)(`${stripMarkdownExtension(projectDefinition.noteLinkPath)}.md`);
    const noteFile = vault.getAbstractFileByPath(notePath);
    if (!(noteFile instanceof import_obsidian.TFile)) {
      continue;
    }
    const noteContent = await vault.read(noteFile);
    const updatedNoteContent = appendLinesToSection(noteContent, "References", [
      `- Offloaded from [[${stripMarkdownExtension(masterTodoPath)}|Master Task Hub]] on ${formatDateKey(/* @__PURE__ */ new Date())}`,
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
function looksLikeBreakdownTask(taskText) {
  return taskText.length >= 80 || /\band\b|\bthen\b|\bcleanup\b|\brefactor\b/i.test(taskText);
}
function extractArchivedDate(value) {
  const match = value.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
function daysBetween(startDateKey, endDateKey) {
  const start = /* @__PURE__ */ new Date(`${startDateKey}T00:00:00`);
  const end = /* @__PURE__ */ new Date(`${endDateKey}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 864e5));
}
function computeHealthScore(input) {
  var _a;
  let score = 100;
  score -= Math.min(input.openCount * 2, 30);
  score -= Math.min((_a = input.staleDays) != null ? _a : 0, 25);
  score += Math.min(input.completionsThisWeek * 4, 16);
  score += Math.min(input.nowCount * 3, 9);
  score += Math.min(input.nextCount * 1, 4);
  score -= input.breakdownCount * 5;
  score -= input.duplicateCount * 6;
  return clamp(score, 0, 100);
}
function describeHealthScore(score) {
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
function buildCleanupSuggestions(project) {
  const suggestions = [];
  if (project.staleDays !== null && project.staleDays >= 14) {
    suggestions.push(`${project.name}: review stale backlog or re-scope the project.`);
  }
  if (project.duplicateTasks.length > 0) {
    suggestions.push(`${project.name}: merge duplicate tasks (${project.duplicateTasks.slice(0, 3).join(", ")}).`);
  }
  if (project.breakdownTasks.length > 0) {
    suggestions.push(`${project.name}: break down ${project.breakdownTasks.length} oversized task${project.breakdownTasks.length === 1 ? "" : "s"}.`);
  }
  if (project.emptySections.length > 0) {
    suggestions.push(`${project.name}: prune empty sections (${project.emptySections.join(", ")}).`);
  }
  return suggestions;
}
function appendLinesToSection(content, sectionName, linesToAppend) {
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
    const output2 = trimTrailingBlankLines(lines);
    output2.push("", `## ${sectionName}`, ...linesToAppend, "");
    return output2.join("\n");
  }
  const output = [...lines];
  let insertIndex = sectionEnd;
  while (insertIndex > sectionIndex + 1 && output[insertIndex - 1].trim() === "") {
    insertIndex -= 1;
  }
  output.splice(insertIndex, 0, ...linesToAppend);
  return output.join("\n");
}
