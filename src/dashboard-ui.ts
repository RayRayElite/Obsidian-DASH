import { App, ItemView, Modal, Notice, PluginSettingTab, Setting, WorkspaceLeaf, setIcon } from "obsidian";

import type DailyDashboardPlugin from "../main";
import {
  formatDateTimeKey,
  formatSyncTimestamp,
  parseHabitDefinitions,
  renderScore
} from "./dashboard-core";
import { formatMinutesAsHours, getMinutesBetween } from "./dashboard-logs";
import { splitMultilineInput } from "./dashboard-todo";
import {
  DEFAULT_SETTINGS,
  VIEW_TYPE_DAILY_DASHBOARD,
  type ArchivedTaskSnapshot,
  type CardVisualOptions,
  type CreateProjectInput,
  type DashboardTone,
  type ProjectReviewOption,
  type QuickAddState,
  type TodoProjectSummary,
  type WorkLogFilters
} from "./dashboard-types";

export class DailyDashboardView extends ItemView {
  private plugin: DailyDashboardPlugin;
  private workLogFilters: WorkLogFilters = {
    project: "",
    keyword: "",
    fromDate: "",
    toDate: ""
  };
  private quickAddState: QuickAddState = {
    projectName: "",
    sectionName: "Add",
    taskText: ""
  };

  constructor(leaf: WorkspaceLeaf, plugin: DailyDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DAILY_DASHBOARD;
  }

  getDisplayText(): string {
    return "Daily Dashboard";
  }

  getIcon(): string {
    return "check-square";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  private isCompactMode(): boolean {
    return getDashboardCompactMode();
  }

  private async toggleCompactMode(): Promise<void> {
    setDashboardCompactMode(!this.isCompactMode());
    await this.render();
  }

  private isMobileMode(): boolean {
    return getDashboardMobileMode();
  }

  private async toggleMobileMode(): Promise<void> {
    setDashboardMobileMode(!this.isMobileMode());
    await this.render();
  }

  private isSectionExpanded(sectionKey: string): boolean {
    return getDashboardExpandedSections().has(sectionKey);
  }

  private async toggleSectionExpanded(sectionKey: string): Promise<void> {
    const expanded = this.isSectionExpanded(sectionKey);
    setDashboardSectionExpanded(sectionKey, !expanded);
    await this.render();
  }

  async render(): Promise<void> {
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = todoSnapshot?.projects ?? [];
      const staleProjects = todoSnapshot?.staleProjects ?? [];
      const breakdownCandidates = todoSnapshot?.breakdownCandidates ?? [];
      const cleanupSuggestions = todoSnapshot?.cleanupSuggestions ?? [];
      const workLogEntries = this.getFilteredWorkLogEntries();
      const staleProjectCount = staleProjects.length;

      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }

      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");
      contentEl.toggleClass("is-compact", this.isCompactMode());
      contentEl.toggleClass("is-mobile-layout", this.isMobileMode());

      const page = contentEl.createDiv({ cls: "daily-dashboard-page" });

      const hero = page.createDiv({ cls: "daily-dashboard-hero" });
      if (wallpaperUrl) {
        hero.addClass("has-wallpaper");
        hero.style.setProperty("--daily-dashboard-wallpaper", `url("${wallpaperUrl}")`);
      }

      const heroCopy = hero.createDiv({ cls: "daily-dashboard-hero-copy" });
      heroCopy.createEl("span", { cls: "daily-dashboard-kicker", text: "Daily operating dashboard" });
      heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title", text: settings.dashboardTitle });

      const actions = heroCopy.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
      createButton(actions, "Promote to today", async () => this.plugin.openPromoteTaskFlow(), false, "target");
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow(), false, "panel-right-open");
      createButton(actions, this.isCompactMode() ? "Richer mode" : "Compact mode", async () => this.toggleCompactMode(), false, this.isCompactMode() ? "maximize-2" : "minimize-2");
      createButton(actions, this.isMobileMode() ? "Desktop view" : "Mobile view", async () => this.toggleMobileMode(), false, this.isMobileMode() ? "monitor" : "smartphone");

      const heroFooter = hero.createDiv({ cls: "daily-dashboard-hero-footer" });
      const heroMeta = heroFooter.createDiv({ cls: "daily-dashboard-hero-status-row" });
      const datePill = createStatPill(heroMeta, todayEntry.date, "calendar-days", "date");
      datePill.addClass("is-compact");
      const archivedPill = createStatPill(heroMeta, `${todayEntry.completedTasks.length} archived`, "archive", "done");
      archivedPill.addClass("is-compact");
      const stalePill = createStatPill(heroMeta, `${staleProjectCount} stale`, "triangle-alert", staleProjectCount > 0 ? "alert" : "neutral");
      stalePill.addClass("is-compact");
      const statePill = createStatPill(heroMeta, `Mood ${renderScore(todayEntry.moodScore)} • Energy ${renderScore(todayEntry.energyScore)}`, "activity", "state");
      statePill.addClass("is-compact");

      const utilityActions = heroFooter.createDiv({ cls: "daily-dashboard-hero-utility-actions" });
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "bar-chart-3", "Weekly report", async () => this.plugin.generateWeeklyReport());
      createIconButton(utilityActions, "line-chart", "Monthly report", async () => this.plugin.generateMonthlyReport());
      createIconButton(utilityActions, "refresh-cw", "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));

      const grid = page.createDiv({ cls: "daily-dashboard-grid" });

      const dayState = this.plugin.getDayState();
      const aiStatus = this.plugin.getAiStatus();
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const activeWorkSession = todayEntry.workSessions.find((session) => session.end === null) ?? null;
      const activeNapSession = todayEntry.napSessions.find((session) => session.end === null) ?? null;
      const dayFlowCard = createCard(grid, "Day Flow", "Control when your real day begins and ends so late nights stay on the right log date.", {
        icon: "sun-moon",
        eyebrow: "Cycle",
        tone: "focus",
        tag: dayState.status === "in-progress" ? "In Progress" : dayState.status === "ended" ? "Ended" : "Idle"
      });
      const dayFlowStatus = dayFlowCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(dayFlowStatus, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(dayFlowStatus, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(dayFlowStatus, activeWorkSession ? "Working" : "Not working", activeWorkSession ? "capture" : "neutral");
      createSemanticChip(dayFlowStatus, activeNapSession ? "Napping" : "Awake", activeNapSession ? "alert" : "neutral");

      const dayFlowGrid = dayFlowCard.createDiv({ cls: "daily-dashboard-dayflow-grid" });
      this.renderDayMetric(dayFlowGrid, "Wake", todayEntry.wakeTime || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Sleep", todayEntry.sleepTime || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Day start", todayEntry.dayStartedAt || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Day end", todayEntry.dayEndedAt || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Tracked work", formatMinutesAsHours(trackedWorkMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked naps", formatMinutesAsHours(trackedNapMinutes));
      this.renderDayMetric(dayFlowGrid, "Live session", activeWorkSession ? formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live nap", activeNapSession ? formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Last edited", formatSyncTimestamp(todayEntry.lastEditedAt));
      this.renderDayMetric(dayFlowGrid, "Archived tasks", `${todayEntry.completedTasks.length}`);

      const dayFlowActions = dayFlowCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(dayFlowActions, "Begin day", async () => this.plugin.beginLogicalDay(), dayState.status !== "in-progress", "sunrise");
      createButton(dayFlowActions, "End day", async () => this.plugin.endLogicalDay(), false, "moon-star");
      createButton(dayFlowActions, activeWorkSession ? "Stop work" : "Start work", async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession(), false, activeWorkSession ? "square" : "play");
      createButton(dayFlowActions, activeNapSession ? "Stop nap" : "Start nap", async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(), false, activeNapSession ? "alarm-clock-off" : "bed-single");

      const focusCard = createCard(grid, "Top 3 For Today", "Keep today concrete with just three active focus items.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      if (todayEntry.todayFocus.length === 0) {
        const emptyState = focusList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No focus items yet. Pull one from a project or let AI draft your starting plan." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Promote task", async () => this.plugin.openPromoteTaskFlow(), false, "target");
        createButton(emptyActions, "AI today plan", async () => this.plugin.generateAiTodayPlan(), false, "sparkles");
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
      const submitFocus = async (): Promise<void> => {
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

      const stateCard = createCard(grid, "State And Friction", "Log mood, energy, and friction so weak days have context.", {
        icon: "activity",
        eyebrow: "State",
        tone: "state",
        tag: "Context"
      });
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

      const habitsCard = createCard(grid, "Habits", "Repeatables with misses and timing kept visible.", {
        icon: "check-square",
        eyebrow: "Routines",
        tone: "state",
        tag: "Track"
      });
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit) => {
        const currentValue = todayEntry.habits[habit.id] ?? 0;
        const habitEvents = todayEntry.habitEvents[habit.id] ?? [];
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done • ${this.plugin.getHabitStreak(habit.id)} day streak`
        });
        if (habitEvents.length > 0) {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Today at ${habitEvents.map((item) => item.slice(11)).join(", ")}`
          });
        }
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

      const quickAddCard = createCard(grid, "Quick Add To Project", "Capture work into Add, Fix, Now, Next, or Later.", {
        icon: "plus-circle",
        eyebrow: "Capture",
        tone: "capture",
        tag: "Input"
      });
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

      const foodCard = createCard(grid, "Food Log", "Quick meal capture so routine and energy stay analyzable.", {
        icon: "utensils-crossed",
        eyebrow: "Body",
        tone: "log",
        tag: "Log"
      });
      const foodInputRow = foodCard.createDiv({ cls: "daily-dashboard-inline-form" });
      const foodInput = foodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Add a meal or snack" }
      });
      const foodButton = foodInputRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      foodButton.type = "button";
      const submitFood = async (): Promise<void> => {
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
        const emptyState = foodList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No food entries yet today. Use a quick meal tag instead of leaving the day blank." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Breakfast", async () => this.plugin.addFoodEntry("Breakfast"), false, "sunrise");
        createButton(emptyActions, "Lunch", async () => this.plugin.addFoodEntry("Lunch"), false, "utensils-crossed");
        createButton(emptyActions, "Dinner", async () => this.plugin.addFoodEntry("Dinner"), false, "moon-star");
      } else {
        todayEntry.foodLog.forEach((item, index) => {
          const row = foodList.createDiv({ cls: "daily-dashboard-food-row" });
          row.createEl("span", { text: item.text });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeFoodEntry(index);
          });
        });
      }

      const notesCard = createCard(grid, "Sleep And Notes", "Sleep, dreams, and daily notes in one recovery block.", {
        icon: "moon-star",
        eyebrow: "Recovery",
        tone: "log",
        tag: "Journal"
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Sleep log" });
      const sleepInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      sleepInput.value = todayEntry.sleepLog;
      sleepInput.placeholder = "Bedtime, wake time, sleep quality, naps, anything worth tracking.";
      sleepInput.addEventListener("change", () => {
        void this.plugin.updateSleepLog(sleepInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Dream log" });
      const dreamInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      dreamInput.value = todayEntry.dreamLog;
      dreamInput.placeholder = "Dream fragments, themes, symbols, emotions, or recurring patterns you want the AI to analyze later.";
      dreamInput.addEventListener("change", () => {
        void this.plugin.updateDreamLog(dreamInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
      const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      notesInput.value = todayEntry.notes;
      notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
      notesInput.addEventListener("change", () => {
        void this.plugin.updateDailyNotes(notesInput.value);
      });

      const workLogCard = createCard(grid, "Searchable Work Log", "Filter archived completions by project, date, or keyword.", {
        icon: "search",
        eyebrow: "History",
        tone: "log",
        tag: "Query"
      });
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
        workLogList.createDiv({ cls: "daily-dashboard-empty-state", text: "No archived work matches the current filters." });
      } else {
        workLogEntries.slice(0, 20).forEach((task) => {
          const row = workLogList.createDiv({ cls: "daily-dashboard-completed-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, task.section, "neutral");
          const dateKey = task.archivedAt.slice(0, 10);
          createSemanticChip(chipRow, dateKey, "log");
          row.createEl("strong", { text: task.project });
          row.createEl("span", { text: task.text });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: task.archivedAt });
        });
      }

      const aiCard = createCard(grid, "AI Workspace", "Plan, review, and ask grounded questions against your dashboard and vault without leaving the page.", {
        icon: "sparkles",
        eyebrow: "AI",
        tone: "capture",
        tag: aiStatus.busy ? "Running" : "Ready"
      });
      const aiShell = aiCard.createDiv({ cls: "daily-dashboard-ai-shell" });
      const aiChipRow = aiShell.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(aiChipRow, aiStatus.configured ? "API key configured" : "API key missing", aiStatus.configured ? "done" : "alert");
      createSemanticChip(aiChipRow, aiStatus.model || "No model", "neutral");
      createSemanticChip(aiChipRow, aiStatus.busy ? "Request in progress" : "Idle", aiStatus.busy ? "focus" : "neutral");
      createSemanticChip(aiChipRow, aiStatus.indexStatus.embeddingsEnabled ? `Embeddings ${aiStatus.indexStatus.embeddingModel}` : "Keyword retrieval", aiStatus.indexStatus.embeddingsEnabled ? "focus" : "neutral");

      const aiOverview = aiShell.createDiv({ cls: "daily-dashboard-ai-overview" });
      const aiActionsPanel = aiOverview.createDiv({ cls: "daily-dashboard-ai-panel" });
      aiActionsPanel.createEl("strong", { text: "Workflows" });
      aiActionsPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Run a focused workflow for planning, review, project triage, coaching, or active-note analysis." });
      const aiActions = aiActionsPanel.createDiv({ cls: "daily-dashboard-ai-action-grid" });
      createButton(aiActions, "Today plan", async () => this.plugin.generateAiTodayPlan(), false, "sunrise");
      createButton(aiActions, "End day review", async () => this.plugin.generateAiEndOfDayReview(), false, "moon-star");
      createButton(aiActions, "Project triage", async () => this.plugin.generateAiProjectTriage(), false, "triangle-alert");
      createButton(aiActions, "Weekly coach", async () => this.plugin.generateAiWeeklyCoachNote(), false, "bar-chart-3");
      createButton(aiActions, "Analyze active note", async () => this.plugin.generateAiActiveNoteAnalysis(), false, "file-search");

      const aiIndexPanel = aiOverview.createDiv({ cls: "daily-dashboard-ai-panel" });
      aiIndexPanel.createEl("strong", { text: "Retrieval Index" });
      aiIndexPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Cached note chunks that keep answers grounded without rescanning the vault on every request." });
      const aiIndexMetrics = aiIndexPanel.createDiv({ cls: "daily-dashboard-ai-metric-grid" });
      this.renderDayMetric(aiIndexMetrics, "Notes", `${aiStatus.indexStatus.indexedNotes}`);
      this.renderDayMetric(aiIndexMetrics, "Chunks", `${aiStatus.indexStatus.indexedChunks}`);
      const embeddingsMetric = this.renderDayMetric(aiIndexMetrics, "Embeddings", `${aiStatus.indexStatus.embeddedChunks}`);
      embeddingsMetric.addClass("daily-dashboard-ai-metric--wide");
      const aiIndexDetails = aiIndexPanel.createDiv({ cls: "daily-dashboard-ai-index-details" });
      const aiUpdatedRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
      aiUpdatedRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Updated" });
      aiUpdatedRow.createEl("strong", { text: formatSyncTimestamp(aiStatus.indexStatus.indexedAt).replace(" ", " • ") });
      if (aiStatus.indexStatus.lastIndexedFile) {
        const aiFileRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
        aiFileRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Last file" });
        aiFileRow.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.indexStatus.lastIndexedFile });
      }
      if (aiStatus.indexStatus.indexedFolders.length > 0) {
        const aiFoldersRow = aiIndexDetails.createDiv({ cls: "daily-dashboard-ai-index-detail" });
        aiFoldersRow.createEl("span", { cls: "daily-dashboard-habit-meta", text: "Folders" });
        aiFoldersRow.createEl("span", { cls: "daily-dashboard-row-meta", text: aiStatus.indexStatus.indexedFolders.join(" • ") });
      }

      const aiLower = aiShell.createDiv({ cls: "daily-dashboard-ai-lower" });
      const aiAskPanel = aiLower.createDiv({ cls: "daily-dashboard-ai-panel daily-dashboard-ai-panel--ask" });
      aiAskPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Ask AI about your vault" });
      const aiQuestion = aiAskPanel.createEl("textarea", { cls: "daily-dashboard-textarea daily-dashboard-ai-question" });
      aiQuestion.placeholder = "What needs attention first? Which project is dragging hardest? What am I underestimating right now?";
      aiQuestion.rows = 4;
      const aiQuestionActions = aiAskPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
      createButton(aiQuestionActions, "Ask AI", async () => this.plugin.askAiQuestion(aiQuestion.value), true, "message-square");
      createButton(aiQuestionActions, "Open ask modal", async () => this.plugin.openAskAiFlow(), false, "panel-top-open");
      createButton(aiQuestionActions, "Rebuild index", async () => this.plugin.rebuildAiNoteIndex(true), false, "database-zap");

      const latestPanel = aiLower.createDiv({ cls: "daily-dashboard-ai-panel daily-dashboard-ai-panel--latest" });
      latestPanel.createEl("strong", { text: "Latest output" });
      if (aiStatus.latestArtifact) {
        const latestArtifact = aiStatus.latestArtifact;
        const latest = latestPanel.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-ai-output" });
        latest.createEl("strong", { text: `${latestArtifact.kind} • ${latestArtifact.generatedAt}` });
        latest.createEl("span", { text: latestArtifact.summary || "AI note generated." });
        latest.createEl("span", { cls: "daily-dashboard-row-meta", text: latestArtifact.notePath });

        const latestActions = latestPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
        createButton(latestActions, "Open latest AI note", async () => this.plugin.openAiArtifact(latestArtifact), false, "file-text");

        if (latestArtifact.suggestedFocus.length > 0) {
          latestPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Suggested focus items" });
          const suggestionList = latestPanel.createDiv({ cls: "daily-dashboard-ai-suggestions" });
          latestArtifact.suggestedFocus.forEach((item) => {
            const row = suggestionList.createDiv({ cls: "daily-dashboard-project-row" });
            row.createEl("span", { text: item });
            const addButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Add to Top 3" });
            addButton.type = "button";
            addButton.addEventListener("click", () => {
              void this.plugin.addTodayFocusItem(item);
            });
          });
        }
      } else {
        latestPanel.createDiv({ cls: "daily-dashboard-ai-empty-state", text: "No AI notes yet. Run a workflow or ask a question to create the first output." });
      }

      const projectsCard = createCard(grid, "Project Health", "Score projects by backlog, staleness, output, and momentum.", {
        icon: "shield-check",
        eyebrow: "Portfolio",
        tone: "health",
        tag: "Health"
      });
      const projectsExpanded = this.isSectionExpanded("project-health-details");
      const projectList = projectsCard.createDiv({ cls: "daily-dashboard-project-list" });
      if (!todoSnapshot || todoSnapshot.projects.length === 0) {
        projectList.createDiv({ cls: "daily-dashboard-empty-state", text: "No project data found in the configured master task hub." });
      } else {
        [...todoSnapshot.projects]
          .sort((left, right) => right.healthScore - left.healthScore)
          .slice(0, projectsExpanded ? 10 : 6)
          .forEach((project) => {
            const row = projectList.createDiv({ cls: projectsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
            const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 75 ? "focus" : project.healthScore >= 50 ? "state" : "alert");
            createSemanticChip(chipRow, project.trend, project.trend === "up" ? "done" : project.trend === "down" ? "alert" : "neutral");
            row.createEl("strong", { text: `${project.name} • ${project.healthScore}` });
            row.createEl("span", { text: `${project.healthLabel} • ${project.openCount} open • ${project.completionsThisWeek} this week • ${project.completionsThisMonth} this month • ${project.trend}` });
            if (projectsExpanded && project.staleDays !== null) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
            }
            if (projectsExpanded && project.focus) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Focus: ${project.focus}` });
            }
            if (projectsExpanded && project.relationships.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Relationships: ${project.relationships.join(", ")}` });
            }
          });
      }
      const projectActions = projectsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(projectActions, projectsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("project-health-details"), false, projectsExpanded ? "chevrons-up" : "chevrons-down");
      createButton(projectActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");

      const alertsCard = createCard(grid, "Stale Work And Cleanup", "Catch stale projects, vague tasks, duplicates, and empty sections.", {
        icon: "triangle-alert",
        eyebrow: "Triage",
        tone: "alert",
        tag: "Attention"
      });
      const alertsExpanded = this.isSectionExpanded("cleanup-details");
      const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
      const alertLines = [
        ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
        ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`),
        ...cleanupSuggestions.slice(0, 5)
      ];
      if (alertLines.length === 0) {
        alertsList.createDiv({ cls: "daily-dashboard-empty-state", text: "No stale-work or cleanup issues detected right now." });
      } else {
        alertLines.slice(0, alertsExpanded ? alertLines.length : 6).forEach((line) => {
          const row = alertsList.createDiv({ cls: alertsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: line });
        });
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      if (alertLines.length > 6) {
        createButton(alertActions, alertsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("cleanup-details"), false, alertsExpanded ? "chevrons-up" : "chevrons-down");
      }
      createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions(), false, "sparkles");
      createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true), false, "move-right");

      const completedCard = createCard(grid, "Completed Today", "Keep today's completed work visible for review and reinforcement.", {
        icon: "badge-check",
        eyebrow: "Done",
        tone: "done",
        tag: "Wins"
      });
      const completedList = completedCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (todayEntry.completedTasks.length === 0) {
        const emptyState = completedList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No archived tasks yet today. Pull something into today or open the hub to finish a concrete item." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Promote task", async () => this.plugin.openPromoteTaskFlow(), false, "target");
        createButton(emptyActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");
      } else {
        todayEntry.completedTasks.slice(0, 10).forEach((task) => {
          const row = completedList.createDiv({ cls: "daily-dashboard-completed-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, task.section, "neutral");
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

  private renderErrorState(error: unknown): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("daily-dashboard-view");

    const page = contentEl.createDiv({ cls: "daily-dashboard-page" });
    const card = createCard(page, "Dashboard Failed To Render", "The dashboard hit a runtime error, so this fallback view is shown instead of a blank page.", {
      icon: "bug",
      eyebrow: "Fallback",
      tone: "alert",
      tag: "Error"
    });
    const message = error instanceof Error ? `${error.name}: ${error.message}` : `${error}`;
    card.createEl("p", { text: message || "Unknown error" });

    const actions = card.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(actions, "Open master todo", async () => this.plugin.openMasterTodo(), true, "file-text");
    createButton(actions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");
    createButton(actions, "Monthly report", async () => this.plugin.generateMonthlyReport(), false, "line-chart");
  }

  private createFilterInput(parent: HTMLElement, placeholder: string, value: string, onChange: (value: string) => void): void {
    const input = parent.createEl("input", {
      cls: "daily-dashboard-input",
      attr: { type: "text", placeholder }
    });
    input.value = value;
    input.addEventListener("change", () => {
      onChange(input.value.trim());
    });
  }

  private renderDayMetric(parent: HTMLElement, label: string, value: string): HTMLElement {
    const metric = parent.createDiv({ cls: "daily-dashboard-day-metric" });
    metric.createEl("span", { cls: "daily-dashboard-habit-meta", text: label });
    metric.createEl("strong", { text: value });
    return metric;
  }

  private getFilteredWorkLogEntries(): ArchivedTaskSnapshot[] {
    const entries = this.plugin.getAllEntries()
      .flatMap((entry) => entry.completedTasks)
      .sort((left, right) => right.archivedAt.localeCompare(left.archivedAt));

    return entries.filter((entry) => {
      const matchesProject = !this.workLogFilters.project || entry.project === this.workLogFilters.project;
      const matchesKeyword = !this.workLogFilters.keyword || `${entry.project} ${entry.section} ${entry.text}`.toLowerCase().includes(this.workLogFilters.keyword.toLowerCase());
      const datePart = entry.archivedAt.slice(0, 10);
      const matchesFrom = !this.workLogFilters.fromDate || datePart >= this.workLogFilters.fromDate;
      const matchesTo = !this.workLogFilters.toDate || datePart <= this.workLogFilters.toDate;
      return matchesProject && matchesKeyword && matchesFrom && matchesTo;
    });
  }

  private renderScoreControl(
    parent: HTMLElement,
    label: string,
    currentValue: number,
    onSelect: (value: number) => Promise<void>
  ): void {
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
}

export class CreateProjectModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private categories: string[];
  private state: CreateProjectInput;

  constructor(app: App, plugin: DailyDashboardPlugin, categories: string[]) {
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.state = {
      projectName: "",
      categoryName: categories[0] ?? "Projects",
      status: "Planning",
      focus: "",
      addTasks: [],
      fixTasks: []
    };
  }

  onOpen(): void {
    this.setTitle("Create Project And Project Note");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Project name")
      .setDesc("Used for the master todo section and the new project note name.")
      .addText((text) => {
        text
          .setPlaceholder("New Project")
          .onChange((value) => {
            this.state.projectName = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Category")
      .setDesc("Top-level section in the master todo where this project should be added.")
      .addDropdown((dropdown) => {
        const options = [...this.categories];
        if (!options.includes(this.state.categoryName)) {
          options.unshift(this.state.categoryName);
        }
        options.forEach((category) => dropdown.addOption(category, category));
        dropdown.setValue(this.state.categoryName);
        dropdown.onChange((value) => {
          this.state.categoryName = value;
        });
      })
      .addText((text) => {
        text
          .setPlaceholder("Or type a new category name")
          .onChange((value) => {
            if (value.trim()) {
              this.state.categoryName = value.trim();
            }
          });
      });

    new Setting(contentEl)
      .setName("Status")
      .setDesc("Initial status written to the master todo and project note.")
      .addDropdown((dropdown) => {
        ["Planning", "Active", "Parked", "Blocked"].forEach((status) => dropdown.addOption(status, status));
        dropdown.setValue(this.state.status);
        dropdown.onChange((value) => {
          this.state.status = value;
        });
      });

    new Setting(contentEl)
      .setName("Focus")
      .setDesc("Short description of the current objective for this project.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("What matters most right now for this project?")
          .onChange((value) => {
            this.state.focus = value;
          });
        textArea.inputEl.rows = 3;
      });

    new Setting(contentEl)
      .setName("Add tasks")
      .setDesc("Optional. One task per line; these seed the Add section.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("First task\nSecond task")
          .onChange((value) => {
            this.state.addTasks = splitMultilineInput(value);
          });
        textArea.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .setName("Fix tasks")
      .setDesc("Optional. One task per line; these seed the Fix section.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Known bug\nAnother bug")
          .onChange((value) => {
            this.state.fixTasks = splitMultilineInput(value);
          });
        textArea.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Create project").setCta().onClick(async () => {
          if (!this.state.projectName.trim()) {
            new Notice("Project name is required.");
            return;
          }

          if (!this.state.categoryName.trim()) {
            new Notice("Category is required.");
            return;
          }

          await this.plugin.createProjectAndNote(this.state);
          this.close();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Cancel").onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PromoteTaskModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private projects: TodoProjectSummary[];
  private selectedProjectName: string;

  constructor(app: App, plugin: DailyDashboardPlugin, projects: TodoProjectSummary[]) {
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = projects[0]?.name ?? "";
  }

  onOpen(): void {
    this.setTitle("Promote Project Task To Today");
    const { contentEl } = this;
    contentEl.empty();

    const projectSetting = new Setting(contentEl).setName("Project");
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
      ...selectedProject?.nowTasks ?? [],
      ...selectedProject?.nextTasks ?? [],
      ...selectedProject?.breakdownTasks ?? []
    ].slice(0, 20);

    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new Setting(contentEl)
          .setName(task)
          .addButton((button) => {
            button.setButtonText("Promote").setCta().onClick(async () => {
              await this.plugin.promoteTaskToToday(this.selectedProjectName, task);
              this.close();
            });
          });
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ProjectReviewModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private options: ProjectReviewOption[];

  constructor(app: App, plugin: DailyDashboardPlugin, options: ProjectReviewOption[]) {
    super(app);
    this.plugin = plugin;
    this.options = options;
  }

  onOpen(): void {
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();

    this.options.forEach((option) => {
      new Setting(contentEl)
        .setName(option.projectName)
        .setDesc(option.notePath)
        .addButton((button) => {
          button.setButtonText("Open").setCta().onClick(async () => {
            await this.plugin.openProjectReviewMode(option);
            this.close();
          });
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class AskAiModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private question = "";

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.setTitle("Ask AI About Your Dashboard");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Question")
      .setDesc("Ask about priorities, stalled projects, habit drift, workload balance, or anything else grounded in the dashboard context.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("What should I focus on next? Which project is costing me the most attention? What pattern am I missing?")
          .setValue(this.question)
          .onChange((value) => {
            this.question = value;
          });
        textArea.inputEl.rows = 6;
        window.setTimeout(() => textArea.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Ask AI").setCta().onClick(async () => {
          if (!this.question.trim()) {
            new Notice("Enter a question first.");
            return;
          }

          await this.plugin.askAiQuestion(this.question);
          this.close();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Cancel").onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class DailyDashboardSettingTab extends PluginSettingTab {
  private plugin: DailyDashboardPlugin;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();

    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Dashboard" });

    new Setting(containerEl)
      .setName("Dashboard title")
      .setDesc("Displayed at the top of the custom dashboard tab.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dashboardTitle)
          .setValue(settings.dashboardTitle)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              dashboardTitle: value.trim() || DEFAULT_SETTINGS.dashboardTitle
            });
          });
      });

    new Setting(containerEl)
      .setName("Master Task Hub note path")
      .setDesc("The note used for project task counts, project creation, and archive automation.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.masterTodoPath)
          .setValue(settings.masterTodoPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              masterTodoPath: value.trim() || DEFAULT_SETTINGS.masterTodoPath
            });
          });
      });

    new Setting(containerEl)
      .setName("Project notes folder")
      .setDesc("New project notes created by the intake flow are written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder)
          .setValue(settings.projectNotesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              projectNotesFolder: value.trim() || DEFAULT_SETTINGS.projectNotesFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Daily log folder")
      .setDesc("Markdown logs written once per day.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder)
          .setValue(settings.dailyLogFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              dailyLogFolder: value.trim() || DEFAULT_SETTINGS.dailyLogFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Weekly report folder")
      .setDesc("Where generated weekly summaries are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder)
          .setValue(settings.weeklyReportFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              weeklyReportFolder: value.trim() || DEFAULT_SETTINGS.weeklyReportFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Monthly report folder")
      .setDesc("Where generated monthly summaries are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder)
          .setValue(settings.monthlyReportFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              monthlyReportFolder: value.trim() || DEFAULT_SETTINGS.monthlyReportFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Used for AI planning, reflection, triage, and question answering. Stored in plugin settings.")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(settings.aiApiKey)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiApiKey: value.trim()
            });
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("AI model")
      .setDesc("Recommended default: gpt-4o-mini for strong cost-to-quality balance. You can enter any compatible OpenAI chat-completions model.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiModel)
          .setValue(settings.aiModel)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiModel: value.trim() || DEFAULT_SETTINGS.aiModel
            });
          });
      });

    new Setting(containerEl)
      .setName("AI API URL")
      .setDesc("Defaults to OpenAI chat completions. Change this only if you know you need a different compatible endpoint.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiBaseUrl)
          .setValue(settings.aiBaseUrl)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiBaseUrl: value.trim() || DEFAULT_SETTINGS.aiBaseUrl
            });
          });
      });

    new Setting(containerEl)
      .setName("AI output folder")
      .setDesc("Generated AI planning and analysis notes are written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder)
          .setValue(settings.aiOutputFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiOutputFolder: value.trim() || DEFAULT_SETTINGS.aiOutputFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("AI context days")
      .setDesc("How many recent daily entries are summarized into AI prompts by default.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.aiContextDays}`)
          .setValue(`${settings.aiContextDays}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiContextDays: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiContextDays), 3), 60)
            });
          });
      });

    new Setting(containerEl)
      .setName("AI related note limit")
      .setDesc("How many relevant vault notes are pulled into AI context for deeper analysis.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.aiRelatedNotesLimit}`)
          .setValue(`${settings.aiRelatedNotesLimit}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiRelatedNotesLimit: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiRelatedNotesLimit), 2), 16)
            });
          });
      });

    new Setting(containerEl)
      .setName("Enable AI note index")
      .setDesc("Cache scoped markdown notes so AI retrieval does not rescan the whole vault on every request.")
      .addToggle((toggle) => {
        toggle.setValue(settings.aiIndexEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            aiIndexEnabled: value
          });
        });
      });

    new Setting(containerEl)
      .setName("AI indexed folders")
      .setDesc("One folder per line. Only these folders are cached for AI retrieval, plus the master task hub and active note when applicable.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Project Notes\nReference\nJournal")
          .setValue(settings.aiIndexedFolders)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiIndexedFolders: value
            });
          });

        textArea.inputEl.rows = 4;
        textArea.inputEl.cols = 36;
      });

    new Setting(containerEl)
      .setName("AI chunk character limit")
      .setDesc("Approximate maximum size for cached note chunks used during retrieval.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.aiChunkCharLimit}`)
          .setValue(`${settings.aiChunkCharLimit}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiChunkCharLimit: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.aiChunkCharLimit), 300), 3000)
            });
          });
      });

    new Setting(containerEl)
      .setName("Enable AI embeddings")
      .setDesc("Optionally generate embeddings for indexed note chunks so retrieval can rank by semantic similarity, not just keywords.")
      .addToggle((toggle) => {
        toggle.setValue(settings.aiEmbeddingsEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            aiEmbeddingsEnabled: value
          });
        });
      });

    new Setting(containerEl)
      .setName("AI embedding model")
      .setDesc("Recommended default: text-embedding-3-small for strong cost efficiency on scoped note indexing.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingModel)
          .setValue(settings.aiEmbeddingModel)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiEmbeddingModel: value.trim() || DEFAULT_SETTINGS.aiEmbeddingModel
            });
          });
      });

    new Setting(containerEl)
      .setName("AI embedding API URL")
      .setDesc("Defaults to OpenAI embeddings. Change only if you are intentionally targeting a compatible embeddings endpoint.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiEmbeddingApiUrl)
          .setValue(settings.aiEmbeddingApiUrl)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiEmbeddingApiUrl: value.trim() || DEFAULT_SETTINGS.aiEmbeddingApiUrl
            });
          });
      });

    new Setting(containerEl)
      .setName("Wallpaper folder")
      .setDesc("Image folder used for dashboard hero wallpapers.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.wallpaperFolder)
          .setValue(settings.wallpaperFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              wallpaperFolder: value.trim() || DEFAULT_SETTINGS.wallpaperFolder,
              selectedWallpaper: ""
            });
            this.display();
          });
      });

    const wallpaperFiles = this.plugin.getWallpaperFiles();
    new Setting(containerEl)
      .setName("Selected wallpaper")
      .setDesc(wallpaperFiles.length > 0 ? "Choose the image shown in the top section of the dashboard." : "No image files were found in the configured wallpaper folder.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "Default / first image");
        wallpaperFiles.forEach((file) => {
          dropdown.addOption(file.path, file.displayName);
        });
        dropdown.setValue(this.plugin.getSelectedWallpaperPath());
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            selectedWallpaper: value ? value.split("/").pop() ?? value : value
          });
        });
      });

    new Setting(containerEl)
      .setName("Habit definitions")
      .setDesc("One habit per line using the format Habit Name|Target Count.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Take pills|1\nBrush teeth|2\nFloss|2\nShower|1\nLog sleep|1")
          .setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}`).join("\n"))
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              habitDefinitions: parseHabitDefinitions(value)
            });
          });

        textArea.inputEl.rows = 8;
        textArea.inputEl.cols = 36;
      });
  }
}

const DASHBOARD_CARD_COLLAPSE_STORAGE_KEY = "daily-dashboard-collapsed-cards";
const DASHBOARD_COMPACT_MODE_STORAGE_KEY = "daily-dashboard-compact-mode";
const DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY = "daily-dashboard-expanded-sections";
const DASHBOARD_MOBILE_MODE_STORAGE_KEY = "daily-dashboard-mobile-mode";

function createCard(parent: HTMLElement, title: string, description: string, options?: CardVisualOptions): HTMLElement {
  const cardKey = toClassSlug(title);
  const card = parent.createDiv({ cls: "daily-dashboard-card" });
  card.addClass(`daily-dashboard-card--${cardKey}`);
  const startCollapsed = getCollapsedCardState().has(cardKey);
  if (startCollapsed) {
    card.addClass("is-collapsed");
  }

  const header = card.createDiv({ cls: "daily-dashboard-card-header" });
  header.role = "button";
  header.tabIndex = 0;
  header.ariaExpanded = startCollapsed ? "false" : "true";
  if (options) {
    card.addClass(`is-tone-${options.tone}`);
    header.addClass(`is-${options.tone}`);
    const top = header.createDiv({ cls: "daily-dashboard-card-header-top" });
    const lead = top.createDiv({ cls: "daily-dashboard-card-lead" });
    const iconEl = lead.createSpan({ cls: "daily-dashboard-card-icon" });
    setIcon(iconEl, options.icon);
    lead.createEl("span", { cls: "daily-dashboard-card-eyebrow", text: options.eyebrow });
    const controls = top.createDiv({ cls: "daily-dashboard-card-header-controls" });
    if (options.tag) {
      createSemanticChip(controls, options.tag, options.tone);
    }
    const toggle = controls.createSpan({ cls: "daily-dashboard-card-toggle" });
    toggle.ariaHidden = "true";
    setIcon(toggle, "chevron-down");
  }
  header.createEl("h2", { text: title });
  header.createEl("p", { text: description });

  const toggleCollapsed = (): void => {
    const nextCollapsed = !card.hasClass("is-collapsed");
    card.toggleClass("is-collapsed", nextCollapsed);
    header.ariaExpanded = nextCollapsed ? "false" : "true";
    setCollapsedCardState(cardKey, nextCollapsed);
  };

  header.addEventListener("click", () => {
    toggleCollapsed();
  });
  header.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCollapsed();
    }
  });

  return card;
}

function createButton(parent: HTMLElement, text: string, onClick: () => Promise<void>, isPrimary = false, iconName?: string): void {
  const button = parent.createEl("button", {
    cls: isPrimary ? "daily-dashboard-primary-button" : "daily-dashboard-secondary-button"
  });
  if (iconName) {
    const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
    setIcon(iconEl, iconName);
  }
  button.createSpan({ cls: "daily-dashboard-button-label", text });
  button.type = "button";
  button.addEventListener("click", () => {
    void onClick();
  });
}

function createIconButton(parent: HTMLElement, iconName: string, label: string, onClick: () => Promise<void>): void {
  const button = parent.createEl("button", { cls: "daily-dashboard-icon-button" });
  button.type = "button";
  button.ariaLabel = label;
  button.title = label;
  const iconEl = button.createSpan({ cls: "daily-dashboard-button-icon" });
  setIcon(iconEl, iconName);
  button.addEventListener("click", () => {
    void onClick();
  });
}

function createSemanticChip(parent: HTMLElement, text: string, tone: DashboardTone): HTMLElement {
  const chip = parent.createSpan({ cls: "daily-dashboard-semantic-chip" });
  chip.addClass(`is-${tone}`);
  chip.setText(text);
  return chip;
}

function createStatPill(parent: HTMLElement, text: string, iconName: string, tone: DashboardTone | "date"): HTMLElement {
  const pill = parent.createDiv({ cls: tone === "date" ? "daily-dashboard-date-pill" : "daily-dashboard-stat-pill" });
  pill.addClass(`is-${tone}`);
  const iconEl = pill.createSpan({ cls: "daily-dashboard-pill-icon" });
  setIcon(iconEl, iconName);
  pill.createSpan({ cls: "daily-dashboard-pill-label", text });
  return pill;
}

function getCollapsedCardState(): Set<string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_CARD_COLLAPSE_STORAGE_KEY);
    if (!stored) {
      return new Set<string>();
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === "string"))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function setCollapsedCardState(cardKey: string, collapsed: boolean): void {
  try {
    const current = getCollapsedCardState();
    if (collapsed) {
      current.add(cardKey);
    } else {
      current.delete(cardKey);
    }

    window.localStorage.setItem(DASHBOARD_CARD_COLLAPSE_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // Ignore storage failures and keep cards interactive.
  }
}

function getDashboardCompactMode(): boolean {
  try {
    return window.localStorage.getItem(DASHBOARD_COMPACT_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setDashboardCompactMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(DASHBOARD_COMPACT_MODE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getDashboardMobileMode(): boolean {
  try {
    return window.localStorage.getItem(DASHBOARD_MOBILE_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setDashboardMobileMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(DASHBOARD_MOBILE_MODE_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getDashboardExpandedSections(): Set<string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY);
    if (!stored) {
      return new Set<string>();
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((item): item is string => typeof item === "string"))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function setDashboardSectionExpanded(sectionKey: string, expanded: boolean): void {
  try {
    const current = getDashboardExpandedSections();
    if (expanded) {
      current.add(sectionKey);
    } else {
      current.delete(sectionKey);
    }

    window.localStorage.setItem(DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function toClassSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}