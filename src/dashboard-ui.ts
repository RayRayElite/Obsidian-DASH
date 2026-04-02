import { App, ItemView, Modal, Notice, PluginSettingTab, Setting, WorkspaceLeaf, setIcon } from "obsidian";

import type DailyDashboardPlugin from "../main";
import {
  formatDateKey,
  formatDateTimeKey,
  formatSyncTimestamp,
  parseHabitDefinitions,
  renderScore
} from "./dashboard-core";
import { formatMinutesAsHours, getMinutesBetween, getSleepMinutesForDay } from "./dashboard-logs";
import { splitMultilineInput } from "./dashboard-todo";
import {
  DEFAULT_SETTINGS,
  SESSION_TAG_OPTIONS,
  VIEW_TYPE_DAILY_DASHBOARD,
  type ArchivedTaskSnapshot,
  type CalendarEventOccurrence,
  type CalendarRepeatCadence,
  type CalendarSnapshot,
  type CardVisualOptions,
  type CreateProjectInput,
  type DayRepairInput,
  type DashboardFocusDisplayItem,
  type DashboardTone,
  type DashboardViewMode,
  type ProjectReviewOption,
  type QuickAddState,
  type TodoProjectSummary,
  type WorkSession,
  type WorkLogFilters
} from "./dashboard-types";

export class DailyDashboardView extends ItemView {
  private static readonly AUTO_REFRESH_MS = 30 * 60 * 1000;

  private plugin: DailyDashboardPlugin;
  private hasDeferredRefreshListeners = false;
  private pendingRefresh = false;
  private workLogFilters: WorkLogFilters = {
    project: "",
    keyword: "",
    fromDate: "",
    toDate: ""
  };
  private autoRefreshHandle: number | null = null;
  private lastRenderAt = 0;
  private quickAddState: QuickAddState = {
    projectName: "",
    sectionName: "Add",
    taskText: ""
  };
  private editingFocusIndex: number | null = null;
  private editingFocusText = "";
  private draggedFocusIndex: number | null = null;
  private selectedSessionTag = getDashboardSelectedSessionTag();
  private calendarCursorDate = new Date();
  private selectedCalendarDate = formatDateKey(new Date());

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
    this.attachDeferredRefreshListeners();
    this.startAutoRefresh();
  }

  async onClose(): Promise<void> {
    this.stopAutoRefresh();
    this.pendingRefresh = false;
  }

  async requestRefresh(): Promise<void> {
    if (this.isEditingTextField()) {
      this.pendingRefresh = true;
      return;
    }

    this.pendingRefresh = false;
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

  private attachDeferredRefreshListeners(): void {
    if (this.hasDeferredRefreshListeners) {
      return;
    }

    this.hasDeferredRefreshListeners = true;
    this.contentEl.addEventListener("focusout", () => {
      window.setTimeout(() => {
        void this.flushPendingRefresh();
      }, 0);
    });
  }

  private isEditingTextField(): boolean {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (!this.contentEl.contains(activeElement)) {
      return false;
    }

    return activeElement instanceof HTMLTextAreaElement
      || ["text", "search", "number"].includes(activeElement.type);
  }

  private async flushPendingRefresh(): Promise<void> {
    if (!this.pendingRefresh || this.isEditingTextField()) {
      return;
    }

    this.pendingRefresh = false;
    await this.render();
  }

  private getViewMode(): DashboardViewMode {
    return getDashboardViewMode();
  }

  private async cycleViewMode(): Promise<void> {
    const current = this.getViewMode();
    const next = current === "mobile"
      ? "compact"
      : current === "compact"
        ? "widescreen"
        : "mobile";
    setDashboardViewMode(next);
    await this.render();
  }

  private getViewModeMeta(mode: DashboardViewMode): { label: string; icon: string; nextLabel: string } {
    if (mode === "compact") {
      return { label: "Compact", icon: "minimize-2", nextLabel: "Widescreen" };
    }

    if (mode === "widescreen") {
      return { label: "Widescreen", icon: "monitor", nextLabel: "Mobile" };
    }

    return { label: "Mobile", icon: "smartphone", nextLabel: "Compact" };
  }

  private getSessionTagTone(tag: string): DashboardTone {
    const normalized = tag.trim().toLowerCase();
    if (normalized === "deep work") {
      return "capture";
    }

    if (normalized === "creative") {
      return "focus";
    }

    if (normalized === "recovery") {
      return "health";
    }

    if (normalized === "admin") {
      return "log";
    }

    return "neutral";
  }

  private setSelectedSessionTag(tag: string): void {
    this.selectedSessionTag = tag;
    setDashboardSelectedSessionTag(tag);
  }

  private getLatestSessionTag(sessions: WorkSession[]): string {
    return [...sessions]
      .reverse()
      .find((session) => session.tag.trim().length > 0)
      ?.tag ?? "";
  }

  private getSessionTagSummary(sessions: WorkSession[]): Array<{ tag: string; minutes: number }> {
    const nowKey = formatDateTimeKey(new Date());
    const totals = new Map<string, number>();

    sessions.forEach((session) => {
      const tag = session.tag.trim();
      if (!tag) {
        return;
      }

      const end = session.end ?? nowKey;
      const minutes = Math.max(0, getMinutesBetween(session.start, end));
      if (minutes <= 0) {
        return;
      }

      totals.set(tag, (totals.get(tag) ?? 0) + minutes);
    });

    return [...totals.entries()]
      .map(([tag, minutes]) => ({ tag, minutes }))
      .sort((left, right) => right.minutes - left.minutes);
  }

  private createCollapsibleSubsection(parent: HTMLElement, sectionKey: string, title: string, description: string): HTMLElement {
    const section = parent.createDiv({ cls: "daily-dashboard-subsection" });
    const collapsed = getCollapsedSubsectionState().has(sectionKey);
    section.toggleClass("is-collapsed", collapsed);

    const header = section.createDiv({ cls: "daily-dashboard-subsection-header" });
    header.role = "button";
    header.tabIndex = 0;
    header.ariaExpanded = collapsed ? "false" : "true";
    const copy = header.createDiv({ cls: "daily-dashboard-subsection-copy" });
    copy.createEl("strong", { text: title });
    if (description) {
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: description });
    }
    const toggle = header.createSpan({ cls: "daily-dashboard-subsection-toggle" });
    setIcon(toggle, collapsed ? "chevron-down" : "chevron-up");

    const toggleCollapsed = (): void => {
      const nextCollapsed = !section.hasClass("is-collapsed");
      section.toggleClass("is-collapsed", nextCollapsed);
      header.ariaExpanded = nextCollapsed ? "false" : "true";
      setIcon(toggle, nextCollapsed ? "chevron-down" : "chevron-up");
      setCollapsedSubsectionState(sectionKey, nextCollapsed);
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

    return section.createDiv({ cls: "daily-dashboard-subsection-body" });
  }

  private startEditingFocusItem(index: number, value: string): void {
    this.editingFocusIndex = index;
    this.editingFocusText = value;
  }

  private stopEditingFocusItem(): void {
    this.editingFocusIndex = null;
    this.editingFocusText = "";
  }

  async render(): Promise<void> {
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const calendarSnapshot = await this.plugin.getUpcomingCalendarSnapshot();
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = todoSnapshot?.projects ?? [];
      const staleProjects = todoSnapshot?.staleProjects ?? [];
      const breakdownCandidates = todoSnapshot?.breakdownCandidates ?? [];
      const cleanupSuggestions = todoSnapshot?.cleanupSuggestions ?? [];
      const workLogEntries = this.getFilteredWorkLogEntries();
      const staleProjectCount = staleProjects.length;
      const viewMode = this.getViewMode();
      const viewModeMeta = this.getViewModeMeta(viewMode);
      if (!this.selectedCalendarDate) {
        this.selectedCalendarDate = todayEntry.date;
      }

      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }

      contentEl.empty();
      contentEl.addClass("daily-dashboard-view");
      contentEl.removeClass("is-view-mobile", "is-view-compact", "is-view-widescreen");
      contentEl.addClass(`is-view-${viewMode}`);

      const page = contentEl.createDiv({ cls: "daily-dashboard-page" });

      const hero = page.createDiv({ cls: "daily-dashboard-hero" });
      if (wallpaperUrl) {
        hero.addClass("has-wallpaper");
        hero.style.setProperty("--daily-dashboard-wallpaper", `url("${wallpaperUrl}")`);
      }

      const heroHeader = hero.createDiv({ cls: "daily-dashboard-hero-header" });
      const heroCopy = heroHeader.createDiv({ cls: "daily-dashboard-hero-copy" });
      heroCopy.createEl("span", { cls: "daily-dashboard-kicker", text: "Daily operating dashboard" });
      heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title", text: settings.dashboardTitle });

      const actions = heroHeader.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow(), false, "panel-right-open");
      createButton(actions, "Repair day", async () => this.plugin.openLogicalDayRepairFlow(), false, "wrench");

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
      createIconButton(utilityActions, viewModeMeta.icon, `View mode ${viewModeMeta.label}. Switch to ${viewModeMeta.nextLabel}.`, async () => this.cycleViewMode());
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "bar-chart-3", "Weekly report", async () => this.plugin.generateWeeklyReport());
      createIconButton(utilityActions, "line-chart", "Monthly report", async () => this.plugin.generateMonthlyReport());
      createIconButton(utilityActions, "refresh-cw", "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));

      const weekBoardCard = createCard(page, "Week At A Glance", "", {
        icon: "layout-dashboard",
        eyebrow: "Week",
        tone: "health",
        tag: "Visual"
      });
      const weekBoard = weekBoardCard.createDiv({ cls: "daily-dashboard-week-strip" });
      const weekStage = weekBoard.createDiv({ cls: "daily-dashboard-week-stage" });
      weekStage.createDiv({ cls: "daily-dashboard-week-platform" });
      const weekBars = weekStage.createDiv({ cls: "daily-dashboard-week-bars" });
      this.getCurrentWeekTimeBoard().forEach((day) => {
        const column = weekBars.createDiv({ cls: "daily-dashboard-week-column" });
        if (day.isToday) {
          column.addClass("is-today");
        }
        if (day.isActiveLogicalDay) {
          column.addClass("is-active-logical-day");
          column.createDiv({ cls: "daily-dashboard-week-active-indicator", text: "Active" });
        }

        const cylinder = column.createDiv({ cls: "daily-dashboard-week-cylinder" });
        this.renderWeekBarSegment(cylinder, "unknown", day.unknownMinutes);
        this.renderWeekBarSegment(cylinder, "relax", day.relaxMinutes);
        this.renderWeekBarSegment(cylinder, "poop", day.poopMinutes);
        this.renderWeekBarSegment(cylinder, "work", day.workMinutes);
        this.renderWeekBarSegment(cylinder, "sleep", day.sleepMinutes);
        cylinder.createDiv({ cls: "daily-dashboard-week-cylinder-overlay" });

        const labels = column.createDiv({ cls: "daily-dashboard-week-labels" });
        labels.createEl("strong", { text: day.label.toUpperCase() });
        labels.createEl("span", { text: `${Number.parseInt(day.date.slice(-2), 10)}` });
      });

      const weekLegend = weekBoardCard.createDiv({ cls: "daily-dashboard-week-legend" });
      this.renderWeekLegendItem(weekLegend, "Sleep", "sleep");
      this.renderWeekLegendItem(weekLegend, "Work", "work");
      this.renderWeekLegendItem(weekLegend, "Relax", "relax");
      this.renderWeekLegendItem(weekLegend, "Poop", "poop");
      this.renderWeekLegendItem(weekLegend, "Unknown", "unknown");

      const grid = page.createDiv({ cls: "daily-dashboard-grid" });

      const dayState = this.plugin.getDayState();
      const aiStatus = this.plugin.getAiStatus();
      const trackedSleepMinutes = this.plugin.getTrackedSleepMinutes(todayEntry);
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const trackedRelaxMinutes = this.plugin.getTrackedRelaxMinutes(todayEntry);
      const trackedBreakMinutes = this.plugin.getTrackedBreakMinutes(todayEntry);
      const trackedPoopMinutes = this.plugin.getTrackedPoopMinutes(todayEntry);
      const trackedPoopCount = this.plugin.getTrackedPoopCount(todayEntry);
      const activeWorkSession = todayEntry.workSessions.find((session) => session.end === null) ?? null;
      const activeNapSession = todayEntry.napSessions.find((session) => session.end === null) ?? null;
      const activeRelaxSession = todayEntry.relaxSessions.find((session) => session.end === null) ?? null;
      const activeBreakSession = todayEntry.breakSessions.find((session) => session.end === null) ?? null;
      const activePoopSession = todayEntry.poopSessions.find((session) => session.end === null) ?? null;
      const activeSessionTag = activeWorkSession?.tag || activeNapSession?.tag || activeRelaxSession?.tag || activeBreakSession?.tag || activePoopSession?.tag || "";
      const tagSummary = this.getSessionTagSummary([
        ...todayEntry.workSessions,
        ...todayEntry.napSessions,
        ...todayEntry.relaxSessions,
        ...todayEntry.breakSessions,
        ...todayEntry.poopSessions
      ]);
      const activeModeLabel = activePoopSession
        ? "Pooping"
        : activeBreakSession
        ? "On break"
        : activeNapSession
          ? "Napping"
          : activeWorkSession
            ? "Working"
            : activeRelaxSession
              ? "Relaxing"
              : dayState.status === "in-progress"
                ? "Idle"
                : "Offline";
      const dayToggleLabel = dayState.status === "in-progress" ? "End day" : "Begin day";
      const dayToggleIcon = dayState.status === "in-progress" ? "moon-star" : "sunrise";
      const dayToggleAction = dayState.status === "in-progress"
        ? async () => this.plugin.endLogicalDay()
        : async () => this.plugin.beginLogicalDay();
      const dayFlowCard = createCard(grid, "Day Flow", "Control when your real day begins and ends so late nights stay on the right log date.", {
        icon: "sun-moon",
        eyebrow: "Cycle",
        tone: "focus",
        tag: dayState.status === "in-progress" ? "In Progress" : dayState.status === "ended" ? "Ended" : "Idle"
      });
      const dayFlowStatus = dayFlowCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(dayFlowStatus, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(dayFlowStatus, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(dayFlowStatus, activeModeLabel, activePoopSession ? "alert" : activeBreakSession ? "alert" : activeWorkSession ? "capture" : activeNapSession ? "alert" : activeRelaxSession ? "health" : "neutral");
      createSemanticChip(dayFlowStatus, activeSessionTag ? `Tag ${activeSessionTag}` : `Default ${this.selectedSessionTag}`, activeSessionTag ? this.getSessionTagTone(activeSessionTag) : this.getSessionTagTone(this.selectedSessionTag));
      createSemanticChip(dayFlowStatus, activeRelaxSession ? "Relaxing tracked" : "No relax active", activeRelaxSession ? "health" : "neutral");
      createSemanticChip(dayFlowStatus, activeBreakSession ? "Break tracked" : "No break active", activeBreakSession ? "alert" : "neutral");
      createSemanticChip(dayFlowStatus, activePoopSession ? "Poop tracked" : "No poop active", activePoopSession ? "alert" : "neutral");

      const dayFlowMetrics = this.createCollapsibleSubsection(dayFlowCard, "day-flow-metrics", "Tracked metrics", "Wake, sleep, live sessions, and bowel tracking for the active logical day.");
      const dayFlowGrid = dayFlowMetrics.createDiv({ cls: "daily-dashboard-dayflow-grid" });
      this.renderDayMetric(dayFlowGrid, "Wake", todayEntry.wakeTime || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Sleep", todayEntry.sleepTime || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Day start", todayEntry.dayStartedAt || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Day end", todayEntry.dayEndedAt || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Tracked sleep", formatMinutesAsHours(trackedSleepMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked work", formatMinutesAsHours(trackedWorkMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked naps", formatMinutesAsHours(trackedNapMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked relax", formatMinutesAsHours(trackedRelaxMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked breaks", formatMinutesAsHours(trackedBreakMinutes));
      this.renderDayMetric(dayFlowGrid, "Tracked poop", formatMinutesAsHours(trackedPoopMinutes));
      this.renderDayMetric(dayFlowGrid, "Bowel count", `${trackedPoopCount}`);
      this.renderDayMetric(dayFlowGrid, "Live session", activeWorkSession ? formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live nap", activeNapSession ? formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live relax", activeRelaxSession ? formatMinutesAsHours(getMinutesBetween(activeRelaxSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live break", activeBreakSession ? formatMinutesAsHours(getMinutesBetween(activeBreakSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Live poop", activePoopSession ? formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(new Date()))) : "Not active");
      this.renderDayMetric(dayFlowGrid, "Last edited", formatSyncTimestamp(todayEntry.lastEditedAt));
      this.renderDayMetric(dayFlowGrid, "Archived tasks", `${todayEntry.completedTasks.length}`);

      const dayFlowTagSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-tags", "Session tags", "Pick the tag new work, focus, break, relax, nap, and bowel sessions should carry.");
      const tagButtons = dayFlowTagSection.createDiv({ cls: "daily-dashboard-chip-row daily-dashboard-session-tag-picker" });
      SESSION_TAG_OPTIONS.forEach((tag) => {
        const button = tagButtons.createEl("button", {
          cls: "daily-dashboard-session-tag-button",
          text: tag
        });
        button.type = "button";
        button.addClass(`is-${this.getSessionTagTone(tag)}`);
        if (this.selectedSessionTag === tag) {
          button.addClass("is-active");
        }
        button.addEventListener("click", () => {
          this.setSelectedSessionTag(tag);
          void this.render();
        });
      });

      if (tagSummary.length > 0) {
        const tagSummaryList = dayFlowTagSection.createDiv({ cls: "daily-dashboard-chip-row" });
        tagSummary.forEach((item) => {
          createSemanticChip(tagSummaryList, `${item.tag} ${formatMinutesAsHours(item.minutes)}`, this.getSessionTagTone(item.tag));
        });
      } else {
        dayFlowTagSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No tagged sessions recorded yet today." });
      }

      const dayFlowActionsSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-actions", "Session controls", "Start and stop the current day, work, break, relax, nap, and bowel tracking flows.");
      const dayFlowActions = dayFlowActionsSection.createDiv({ cls: "daily-dashboard-dayflow-actions" });
      createButton(dayFlowActions, dayToggleLabel, dayToggleAction, dayState.status !== "in-progress", dayToggleIcon);
      createButton(dayFlowActions, activeWorkSession ? "Stop work" : `Start work • ${this.selectedSessionTag}`, async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession(this.selectedSessionTag), false, activeWorkSession ? "square" : "play");
      createButton(dayFlowActions, activeNapSession ? "Stop nap" : `Start nap • ${this.selectedSessionTag}`, async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(this.selectedSessionTag), false, activeNapSession ? "alarm-clock-off" : "bed-single");
      createButton(dayFlowActions, activeRelaxSession ? "End relaxing" : `Start relaxing • ${this.selectedSessionTag}`, async () => activeRelaxSession ? this.plugin.stopRelaxSession() : this.plugin.startRelaxSession(this.selectedSessionTag), false, activeRelaxSession ? "square" : "coffee");
      createButton(dayFlowActions, activeBreakSession ? "End break" : `Start break • ${this.selectedSessionTag}`, async () => activeBreakSession ? this.plugin.stopBreakSession() : this.plugin.startBreakSession(this.selectedSessionTag), false, activeBreakSession ? "square" : "pause");
      createButton(dayFlowActions, activePoopSession ? "Finish poop" : `Start poop • ${this.selectedSessionTag}`, async () => activePoopSession ? this.plugin.stopPoopSession() : this.plugin.startPoopSession(this.selectedSessionTag), false, activePoopSession ? "square" : "bath");

      const focusCard = createCard(grid, "Top 3 For Today", "Keep today concrete with just three active focus items.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
        const dismissedReminderIds = getDismissedReminderState(todayEntry.date);
        const focusDisplayItems = this.plugin.getFocusDisplayItems(calendarSnapshot)
            .filter((item) => item.kind !== "reminder" || !dismissedReminderIds.has(item.id));
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      focusCard.createEl("span", { cls: "daily-dashboard-row-meta", text: "Drag Top 3 rows to reprioritize them without deleting and recreating items." });
      if (focusDisplayItems.length === 0) {
        const emptyState = focusList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No focus items yet. Pull one from a project or let AI draft your starting plan." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "AI today plan", async () => this.plugin.generateAiTodayPlan(), false, "sparkles");
      } else {
        focusDisplayItems.forEach((item) => {
          const row = focusList.createDiv({ cls: `daily-dashboard-focus-row is-${item.status}` });
          if (item.kind === "reminder") {
            row.addClass("is-reminder");
            if (item.warningLevel) {
              row.addClass(`is-${item.warningLevel}`);
            }
          }
          const copy = row.createDiv({ cls: "daily-dashboard-focus-copy" });
          const isEditingFocus = item.kind === "focus" && this.editingFocusIndex === todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
          if (isEditingFocus) {
            const editInput = copy.createEl("input", {
              cls: "daily-dashboard-input",
              attr: { type: "text", placeholder: "Edit focus item" }
            });
            editInput.value = this.editingFocusText;
            editInput.addEventListener("input", () => {
              this.editingFocusText = editInput.value;
            });
            editInput.addEventListener("keydown", (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const focusIndex = todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
                if (focusIndex >= 0) {
                  void this.plugin.updateTodayFocusItem(focusIndex, this.editingFocusText).then((saved) => {
                    if (!saved) {
                      return;
                    }

                    this.stopEditingFocusItem();
                    void this.render();
                  });
                }
              }
            });
            window.setTimeout(() => editInput.focus(), 0);
          } else {
            copy.createEl("strong", { text: item.text });
            copy.createEl("span", {
              cls: "daily-dashboard-habit-meta",
              text: this.getFocusDisplayMeta(item)
            });
            if (item.notes) {
              copy.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: item.notes
              });
            }
          }

          const controls = row.createDiv({ cls: "daily-dashboard-focus-controls" });
          if (item.kind === "focus") {
            const focusIndex = todayEntry.todayFocus.findIndex((candidate) => candidate.text === item.text);
            if (focusIndex < 0) {
              return;
            }
            const latestTag = this.getLatestSessionTag(item.workSessions);
            if (latestTag && !isEditingFocus) {
              const tagChipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
              createSemanticChip(tagChipRow, latestTag, this.getSessionTagTone(latestTag));
            }
            if (!isEditingFocus) {
              row.draggable = true;
              row.addClass("is-draggable");
              row.addEventListener("dragstart", (event) => {
                this.draggedFocusIndex = focusIndex;
                row.addClass("is-dragging");
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `${focusIndex}`);
                }
              });
              row.addEventListener("dragover", (event) => {
                if (this.draggedFocusIndex === null || this.draggedFocusIndex === focusIndex) {
                  return;
                }

                event.preventDefault();
                row.addClass("is-drop-target");
              });
              row.addEventListener("dragleave", () => {
                row.removeClass("is-drop-target");
              });
              row.addEventListener("drop", (event) => {
                event.preventDefault();
                row.removeClass("is-drop-target");
                const draggedIndex = this.draggedFocusIndex;
                this.draggedFocusIndex = null;
                if (draggedIndex === null || draggedIndex === focusIndex) {
                  return;
                }

                void this.plugin.reorderTodayFocusItems(draggedIndex, focusIndex).then(async (changed) => {
                  if (changed) {
                    await this.render();
                  }
                });
              });
              row.addEventListener("dragend", () => {
                this.draggedFocusIndex = null;
                row.removeClass("is-dragging");
                row.removeClass("is-drop-target");
              });
            }
            if (isEditingFocus) {
              createButton(controls, "Save", async () => {
                const saved = await this.plugin.updateTodayFocusItem(focusIndex, this.editingFocusText);
                if (!saved) {
                  return;
                }

                this.stopEditingFocusItem();
                await this.render();
              }, true, "check");
              createButton(controls, "Cancel", async () => {
                this.stopEditingFocusItem();
                await this.render();
              }, false, "x");
            } else if (item.status === "done") {
              createButton(controls, "Reopen", async () => this.plugin.reopenTodayFocusItem(focusIndex), false, "rotate-ccw");
            } else if (item.isActive) {
              createButton(controls, "Pause", async () => this.plugin.stopTodayFocusItem(focusIndex), false, "pause");
            } else {
              createButton(controls, `Start • ${this.selectedSessionTag}`, async () => this.plugin.startTodayFocusItem(focusIndex, this.selectedSessionTag), false, "play");
            }
            if (!isEditingFocus) {
              createButton(controls, "Details", async () => {
                new FocusCaptureModal(this.app, {
                  mode: "edit",
                  todayHasTop3Capacity: true,
                  initialText: item.text,
                  initialNotes: item.notes ?? "",
                  initialEstimateMinutes: item.estimateMinutes ?? null,
                  initialDestination: "top3",
                  onSubmit: async (payload) => {
                    const saved = await this.plugin.updateTodayFocusDetails(focusIndex, payload);
                    if (saved) {
                      await this.render();
                    }
                  }
                }).open();
              }, false, "notebook-pen");
              createButton(controls, "Edit", async () => {
                this.startEditingFocusItem(focusIndex, item.text);
                await this.render();
              }, false, "pencil");
              createButton(controls, "Done", async () => this.plugin.completeTodayFocusItem(focusIndex), item.status === "done", "check");
              const removeButton = controls.createEl("button", { cls: "daily-dashboard-remove-button" });
              removeButton.type = "button";
              removeButton.ariaLabel = `Remove focus item ${item.text}`;
              removeButton.title = `Remove ${item.text}`;
              setIcon(removeButton, "x");
              removeButton.addEventListener("click", () => {
                void this.plugin.removeTodayFocusItem(focusIndex);
              });
            }
          } else {
            createButton(controls, "Accept", async () => {
                await this.plugin.addTodayFocusItem(item.text);
                clearDismissedReminder(todayEntry.date, item.id);
                await this.render();
            }, true, "plus-circle");
            createButton(controls, "Dismiss", async () => {
                setDismissedReminder(todayEntry.date, item.id);
                await this.render();
            }, false, "bell-off");
            createButton(controls, "Calendar", async () => {
              new CalendarEventModal(this.app, this.plugin, item.calendarDate ?? todayEntry.date, item.sourceEventId ?? null).open();
            }, false, "calendar-days");
          }
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
      const focusUtilityActions = focusCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(focusUtilityActions, "Quick capture", async () => this.plugin.openQuickCaptureFocusFlow(), false, "rocket");
      createButton(focusUtilityActions, "Pause all -> break", async () => this.plugin.pauseAllAndStartBreak(), false, "pause-circle");
      const focusCalendarSection = this.createCollapsibleSubsection(focusCard, "focus-calendar", "Calendar", "Keep the monthly planner nearby without making Execution too tall.");
        const carryForwardCandidates = this.plugin.getCarryForwardFocusCandidates(todayEntry.date);
        if (carryForwardCandidates.length > 0) {
          const carryForwardSection = this.createCollapsibleSubsection(focusCard, "focus-carry-forward", "Carry forward", "Bring unfinished Top 3 items from the previous logical day into today only when you want them.");
          const carryForwardMeta = carryForwardSection.createDiv({ cls: "daily-dashboard-row-meta" });
          carryForwardMeta.setText(carryForwardCandidates.join(" • "));
          const carryForwardActions = carryForwardSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(carryForwardActions, "Carry unfinished", async () => {
            await this.plugin.carryForwardUnfinishedFocusItems();
            await this.render();
          }, false, "arrow-down-to-line");
        }
      const nextUpItems = this.plugin.getNextUpFocusItems(todayEntry.date);
      const nextUpSection = this.createCollapsibleSubsection(focusCard, "focus-next-up", "Next Up", "Keep overflow queued without overfilling the Top 3.");
      if (nextUpItems.length === 0) {
        nextUpSection.createDiv({
          cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
          text: "No queued follow-up items yet."
        });
      } else {
        const nextUpList = nextUpSection.createDiv({ cls: "daily-dashboard-focus-list" });
        nextUpItems.forEach((item, index) => {
          const row = nextUpList.createDiv({ cls: "daily-dashboard-focus-row is-pending" });
          const copy = row.createDiv({ cls: "daily-dashboard-focus-copy" });
          copy.createEl("strong", { text: item.text });
          copy.createEl("span", {
            cls: "daily-dashboard-habit-meta",
            text: [
              item.estimateMinutes ? `Estimate ${formatMinutesAsHours(item.estimateMinutes)}` : "No estimate",
              item.notes ? "Queued note" : "Queued"
            ].join(" • ")
          });
          if (item.notes) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.notes });
          }

          const controls = row.createDiv({ cls: "daily-dashboard-focus-controls" });
          createButton(controls, "Promote", async () => {
            const promoted = await this.plugin.promoteNextUpFocusItem(index);
            if (promoted) {
              await this.render();
            }
          }, false, "arrow-up-circle");
          createButton(controls, "Edit", async () => {
            new FocusCaptureModal(this.app, {
              mode: "capture",
              todayHasTop3Capacity: true,
              initialText: item.text,
              initialNotes: item.notes,
              initialEstimateMinutes: item.estimateMinutes,
              initialDestination: "next-up",
              submitLabel: "Save queued item",
              onSubmit: async (payload) => {
                await this.plugin.removeNextUpFocusItem(index);
                await this.plugin.addNextUpFocusItem(payload);
                await this.render();
              }
            }).open();
          }, false, "pencil");
          createButton(controls, "Remove", async () => {
            await this.plugin.removeNextUpFocusItem(index);
            await this.render();
          }, false, "x");
        });
      }
      const nextUpActions = nextUpSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(nextUpActions, "Add next up", async () => {
        new FocusCaptureModal(this.app, {
          mode: "capture",
          todayHasTop3Capacity: true,
          initialDestination: "next-up",
          submitLabel: "Queue item",
          onSubmit: async (payload) => {
            await this.plugin.addNextUpFocusItem(payload);
            await this.render();
          }
        }).open();
      }, false, "list-plus");
      this.renderMonthlyCalendar(focusCalendarSection, todayEntry.date, settings.calendarEnabled);

      const stateCard = createCard(grid, "State And Friction", "Log mood, energy, and friction so weak days have context.", {
        icon: "activity",
        eyebrow: "State",
        tone: "state",
        tag: "Context"
      });
      this.renderScoreControl(stateCard, "Mood", todayEntry.moodScore, (value) => this.plugin.updateMoodScore(value));
      this.renderScoreControl(stateCard, "Energy", todayEntry.energyScore, (value) => this.plugin.updateEnergyScore(value));
      this.renderScoreControl(stateCard, "Anxiety", todayEntry.anxietyScore, (value) => this.plugin.updateAnxietyScore(value));
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
      const habitActions = habitsCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(habitActions, "Add habit", async () => this.plugin.openAddHabitFlow(), false, "plus-circle");
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit) => {
        const currentValue = todayEntry.habits[habit.id] ?? 0;
        const habitEvents = todayEntry.habitEvents[habit.id] ?? [];
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done • ${this.plugin.getHabitStreak(habit.id)} day streak • best ${this.plugin.getHabitBestStreak(habit.id)}`
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
        const removeButton = controls.createEl("button", { cls: "daily-dashboard-remove-button" });
        removeButton.type = "button";
        removeButton.ariaLabel = `Remove habit ${habit.label}`;
        removeButton.title = `Remove ${habit.label}`;
        setIcon(removeButton, "x");
        removeButton.addEventListener("click", () => {
          void this.plugin.removeHabitDefinition(habit.id);
        });
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
      const foodInputRow = foodCard.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
      const foodAmountInput = foodInputRow.createEl("input", {
        cls: "daily-dashboard-amount-input",
        attr: { type: "number", min: "1", max: "24", value: "1", ariaLabel: "Food amount" }
      });
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
        await this.plugin.addFoodEntry(value, Number(foodAmountInput.value));
        foodInput.value = "";
        foodAmountInput.value = "1";
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
      const foodInsight = foodCard.createDiv({ cls: "daily-dashboard-score-block daily-dashboard-food-insight" });
      foodInsight.createEl("strong", { text: "Diet insight" });
      foodInsight.createEl("span", {
        cls: "daily-dashboard-habit-meta",
        text: todayEntry.dietInsight || "Run a quick AI pass to estimate calories and flag the biggest nutrition signals for today."
      });
      const foodInsightActions = foodInsight.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(foodInsightActions, aiStatus.busy ? "Analyzing..." : "Analyze diet", async () => this.plugin.generateDailyDietInsight(), true, "sparkles");
      const foodList = foodCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (todayEntry.foodLog.length === 0) {
        const emptyState = foodList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No food entries yet today. Use a quick meal tag instead of leaving the day blank." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Breakfast", async () => this.plugin.addFoodEntry("Breakfast", 1), false, "sunrise");
        createButton(emptyActions, "Lunch", async () => this.plugin.addFoodEntry("Lunch", 1), false, "utensils-crossed");
        createButton(emptyActions, "Dinner", async () => this.plugin.addFoodEntry("Dinner", 1), false, "moon-star");
      } else {
        todayEntry.foodLog.forEach((item, index) => {
          const row = foodList.createDiv({ cls: "daily-dashboard-food-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: item.text });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          const amountInput = amountSlot.createEl("input", {
            cls: "daily-dashboard-amount-input",
            attr: { type: "number", min: "1", max: "24", value: `${item.amount}`, ariaLabel: `Amount for ${item.text}` }
          });
          amountInput.addEventListener("change", () => {
            void this.plugin.updateFoodEntryAmount(index, Number(amountInput.value));
          });
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

      const aiOverviewSection = this.createCollapsibleSubsection(aiShell, "ai-workspace-overview", "Plan and retrieve", "Workflow shortcuts and retrieval-index status for the current vault.");
      const aiOverview = aiOverviewSection.createDiv({ cls: "daily-dashboard-ai-overview" });
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

      const aiLowerSection = this.createCollapsibleSubsection(aiShell, "ai-workspace-ask", "Ask and latest output", "Direct questions plus the newest AI artifact and suggested focus items.");
      const aiLower = aiLowerSection.createDiv({ cls: "daily-dashboard-ai-lower" });
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

      this.lastRenderAt = Date.now();
    } catch (error) {
      console.error("Daily dashboard render failed", error);
      this.renderErrorState(error);
      this.lastRenderAt = Date.now();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshHandle = window.setInterval(() => {
      void this.maybeAutoRefresh();
    }, DailyDashboardView.AUTO_REFRESH_MS);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshHandle !== null) {
      window.clearInterval(this.autoRefreshHandle);
      this.autoRefreshHandle = null;
    }
  }

  private async maybeAutoRefresh(): Promise<void> {
    if (!this.leaf || !this.contentEl.isConnected) {
      return;
    }

    if (Date.now() - this.lastRenderAt < DailyDashboardView.AUTO_REFRESH_MS) {
      return;
    }

    await this.requestRefresh();
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

  private renderReminderBlock(parent: HTMLElement, snapshot: CalendarSnapshot, lookaheadHours: number): void {
    const block = parent.createDiv({ cls: "daily-dashboard-calendar-block" });
    const header = block.createDiv({ cls: "daily-dashboard-calendar-header" });
    header.createEl("strong", { text: "Upcoming reminders" });
    header.createEl("span", {
      cls: "daily-dashboard-row-meta",
      text: snapshot.enabled
        ? `Next ${lookaheadHours}h from your dashboard calendar`
        : "Enable calendar reminders in settings to surface upcoming events here."
    });

    if (!snapshot.enabled) {
      block.createDiv({
        cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
        text: "Calendar reminders are off. Turn them on in settings to push upcoming events into the Execution card."
      });
      return;
    }

    if (snapshot.reminders.length === 0) {
      block.createDiv({
        cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact",
        text: `No upcoming calendar reminders in the next ${lookaheadHours} hours.`
      });
      return;
    }

    const list = block.createDiv({ cls: "daily-dashboard-calendar-list" });
    snapshot.reminders.forEach((event) => {
      const row = list.createDiv({ cls: `daily-dashboard-calendar-row is-${event.warningLevel}` });
      const time = row.createDiv({ cls: "daily-dashboard-calendar-time" });
      time.createEl("strong", { text: this.formatCalendarDayLabel(new Date(event.start), event.allDay) });
      time.createEl("span", { text: this.formatCalendarTimeLabel(new Date(event.start), new Date(event.end), event.allDay) });

      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: event.notes || (event.warningLevel === "warning" ? "Within warning window" : "Scheduled")
      });

      const chips = row.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(chips, event.warningLevel === "warning" ? "Soon" : "Later", event.warningLevel === "warning" ? "alert" : "neutral");
      if (event.allDay) {
        createSemanticChip(chips, "All day", "log");
      }
    });
  }

  private getFocusDisplayMeta(item: DashboardFocusDisplayItem): string {
    if (item.kind === "reminder") {
      const timeLabel = item.calendarStart && item.calendarEnd
        ? this.formatCalendarTimeLabel(new Date(item.calendarStart), new Date(item.calendarEnd), Boolean(item.allDay))
        : "Scheduled";
      return [
        item.warningLevel === "warning" ? "Upcoming soon" : "Reminder",
        timeLabel,
        item.calendarNotes || "From calendar"
      ].filter((value) => value.length > 0).join(" • ");
    }

    return [
      item.status === "done" ? "Done" : item.isActive ? "Working on" : "Queued",
      `${formatMinutesAsHours(item.trackedMinutes)} tracked`,
      item.completedAt ? `completed ${item.completedAt.slice(11)}` : ""
    ].filter((value) => value.length > 0).join(" • ");
  }

  private renderMonthlyCalendar(parent: HTMLElement, todayKey: string, remindersEnabled: boolean): void {
    const shell = parent.createDiv({ cls: "daily-dashboard-calendar-panel" });
    const shellHeader = shell.createDiv({ cls: "daily-dashboard-calendar-panel-header" });
    shellHeader.createEl("strong", { text: "Calendar" });
    shellHeader.createEl("span", {
      cls: "daily-dashboard-row-meta",
      text: remindersEnabled
        ? "Auto-reminders above"
        : "Reminders off"
    });

    const header = shell.createDiv({ cls: "daily-dashboard-calendar-toolbar" });
    const currentMonth = new Date(this.calendarCursorDate.getFullYear(), this.calendarCursorDate.getMonth(), 1);
        const sessionTag = this.getLatestSessionTag(item.workSessions);
    const title = header.createDiv({ cls: "daily-dashboard-calendar-toolbar-copy" });
    title.createEl("strong", { text: currentMonth.toLocaleDateString([], { month: "long", year: "numeric" }) });
    const controls = header.createDiv({ cls: "daily-dashboard-calendar-nav" });
          sessionTag ? `Tag ${sessionTag}` : "",
    createButton(controls, "Prev", async () => {
      this.calendarCursorDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      await this.render();
    }, false, "chevron-left");
    createButton(controls, "Today", async () => {
      this.calendarCursorDate = new Date();
      this.selectedCalendarDate = todayKey;
      await this.render();
    }, false, "calendar-days");
    createButton(controls, "Next", async () => {
      this.calendarCursorDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      await this.render();
    }, false, "chevron-right");

    const weekHeader = shell.createDiv({ cls: "daily-dashboard-calendar-weekdays" });
    ["M", "T", "W", "T", "F", "S", "S"].forEach((label) => {
      weekHeader.createEl("span", { text: label });
    });

    const grid = shell.createDiv({ cls: "daily-dashboard-calendar-grid" });
    this.getCalendarMonthDays(currentMonth).forEach((date) => {
      const dateKey = formatDateKey(date);
      const events = this.plugin.getCalendarEventsForDate(dateKey);
      const cell = grid.createEl("button", { cls: "daily-dashboard-calendar-day" });
      cell.type = "button";
      if (date.getMonth() !== currentMonth.getMonth()) {
        cell.addClass("is-outside-month");
      }
      if (dateKey === todayKey) {
        cell.addClass("is-today");
      }
      if (dateKey === this.selectedCalendarDate) {
        cell.addClass("is-selected");
      }
      if (events.length > 0) {
        cell.addClass("has-events");
      }
      cell.ariaLabel = `${dateKey}${events.length > 0 ? `, ${events.length} event${events.length === 1 ? "" : "s"}` : ", no events"}`;

      const top = cell.createDiv({ cls: "daily-dashboard-calendar-day-top" });
      top.createEl("strong", { text: `${date.getDate()}` });
      const dotRow = cell.createDiv({ cls: "daily-dashboard-calendar-day-dots" });
      if (events.length > 0) {
        events.slice(0, 3).forEach(() => {
          dotRow.createSpan({ cls: "daily-dashboard-calendar-day-dot" });
        });
        if (events.length > 3) {
          dotRow.createEl("span", { cls: "daily-dashboard-calendar-day-more", text: `+${events.length - 3}` });
        }
      }

      cell.addEventListener("click", () => {
        this.selectedCalendarDate = dateKey;
        new CalendarEventModal(this.app, this.plugin, dateKey).open();
        void this.render();
      });
    });

    const selectedDate = this.selectedCalendarDate || todayKey;
    const selectedEvents = this.plugin.getCalendarEventsForDate(selectedDate);
    const detail = shell.createDiv({ cls: "daily-dashboard-calendar-detail" });
    const detailHeader = detail.createDiv({ cls: "daily-dashboard-calendar-detail-header" });
    detailHeader.createEl("strong", { text: selectedDate });
    const detailActions = detailHeader.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(detailActions, "Add event", async () => {
      new CalendarEventModal(this.app, this.plugin, selectedDate).open();
    }, false, "plus-circle");

    if (selectedEvents.length === 0) {
      detail.createDiv({ cls: "daily-dashboard-calendar-empty", text: "No events" });
      return;
    }

    const list = detail.createDiv({ cls: "daily-dashboard-calendar-list" });
    selectedEvents.forEach((event) => {
      const row = list.createDiv({ cls: "daily-dashboard-calendar-row" });
      const time = row.createDiv({ cls: "daily-dashboard-calendar-time" });
      time.createEl("strong", { text: event.startTime || "All day" });
      time.createEl("span", { text: event.endTime || (event.startTime ? "No end" : "Runs all day") });

      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: event.notes || "No notes" });

      const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(actions, event.isRecurring ? "Edit series" : "Edit", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId).open(), false, "pencil");
      createButton(actions, event.isRecurring ? "Delete series" : "Delete", async () => this.plugin.removeCalendarEvent(event.sourceEventId), false, "trash-2");
    });
  }

  private getCalendarMonthDays(currentMonth: Date): Date[] {
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const startDate = new Date(firstOfMonth);
    startDate.setDate(firstOfMonth.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return date;
    });
  }

  private formatCalendarDayLabel(date: Date, allDay: boolean): string {
    if (allDay) {
      return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }

    const todayKey = formatDateKey(new Date());
    const dateKey = formatDateKey(date);
    if (dateKey === todayKey) {
      return "Today";
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateKey === formatDateKey(tomorrow)) {
      return "Tomorrow";
    }

    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  private formatCalendarTimeLabel(start: Date, end: Date, allDay: boolean): string {
    if (allDay) {
      return "All day";
    }

    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) {
      return `${startLabel} - ${endLabel}`;
    }

    return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} ${startLabel} - ${endLabel}`;
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

  private getCurrentWeekTimeBoard(): Array<{
    label: string;
    date: string;
    sleepMinutes: number;
    workMinutes: number;
    relaxMinutes: number;
    poopMinutes: number;
    unknownMinutes: number;
    isToday: boolean;
    isActiveLogicalDay: boolean;
  }> {
    const today = new Date();
    const currentDayIndex = (today.getDay() + 6) % 7;
    const dayState = this.plugin.getDayState();
    const activeLogicalDate = dayState.status === "in-progress" ? dayState.activeDate : "";
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - currentDayIndex);
    const allEntries = this.plugin.getAllEntries();
    const entryMap = new Map(allEntries.map((entry) => [entry.date, entry]));
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return labels.map((label, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const entry = entryMap.get(dateKey);
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      const nextEntry = entryMap.get(formatDateKey(nextDate));
      const sleepMinutes = entry ? getSleepMinutesForDay(entry, nextEntry) : 0;
      const workMinutes = entry ? this.plugin.getTrackedWorkMinutes(entry) : 0;
      const relaxMinutes = entry ? this.plugin.getTrackedRelaxMinutes(entry) + this.plugin.getTrackedBreakMinutes(entry) : 0;
      const poopMinutes = entry ? this.plugin.getTrackedPoopMinutes(entry) : 0;
      const unknownMinutes = Math.max(0, 1440 - sleepMinutes - workMinutes - relaxMinutes - poopMinutes);

      return {
        label,
        date: dateKey,
        sleepMinutes,
        workMinutes,
        relaxMinutes,
        poopMinutes,
        unknownMinutes,
        isToday: dateKey === formatDateKey(today),
        isActiveLogicalDay: dateKey === activeLogicalDate
      };
    });
  }

  private renderWeekBarSegment(parent: HTMLElement, tone: "sleep" | "work" | "relax" | "poop" | "unknown", minutes: number): void {
    if (minutes <= 0) {
      return;
    }

    const segment = parent.createDiv({ cls: `daily-dashboard-week-segment is-${tone}` });
    segment.style.height = `${(minutes / 1440) * 100}%`;
    segment.ariaLabel = `${tone} ${this.formatWeekBarValue(minutes)}`;

    const label = segment.createEl("span", { text: this.formatWeekBarValue(minutes) });
    if (minutes < 120) {
      label.addClass("is-compact");
    }
  }

  private renderWeekLegendItem(parent: HTMLElement, label: string, tone: "sleep" | "work" | "relax" | "poop" | "unknown"): void {
    const item = parent.createDiv({ cls: "daily-dashboard-week-legend-item" });
    item.createDiv({ cls: `daily-dashboard-week-legend-dot is-${tone}` });
    item.createEl("span", { text: label });
  }

  private formatWeekBarValue(minutes: number): string {
    if (minutes <= 0) {
      return "0m";
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = minutes / 60;
    return `${hours.toFixed(minutes % 60 === 0 ? 0 : 1).replace(/\.0$/, "")}h`;
  }
}

export class CalendarEventModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private date: string;
  private readonly initialDate: string;
  private editingEventId: string | null;
  private titleValue = "";
  private startTimeValue = "";
  private endTimeValue = "";
  private notesValue = "";
  private repeatCadenceValue: CalendarRepeatCadence = "none";
  private repeatUntilValue = "";

  constructor(app: App, plugin: DailyDashboardPlugin, date: string, editingEventId: string | null = null) {
    super(app);
    this.plugin = plugin;
    this.date = date;
    this.initialDate = date;
    this.editingEventId = editingEventId;
  }

  onOpen(): void {
    this.hydrateEditingState();
    this.setTitle(`Calendar Events • ${this.date}`);
    this.renderContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();

    const existingEvents = this.plugin.getCalendarEventsForDate(this.date);
    if (existingEvents.length > 0) {
      contentEl.createEl("h3", { text: "Existing events" });
      existingEvents.forEach((event) => {
        new Setting(contentEl)
          .setName(event.title)
          .setDesc([
            event.startTime || "All day",
            event.endTime ? `to ${event.endTime}` : "",
            event.isRecurring ? `repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}` : "",
            event.notes
          ].filter((value) => value.length > 0).join(" • "))
          .addButton((button) => {
            button.setButtonText(event.isRecurring ? "Edit series" : "Edit").onClick(() => {
              const sourceEvent = this.plugin.getCalendarEventEntry(event.sourceEventId);
              if (!sourceEvent) {
                return;
              }

              this.editingEventId = sourceEvent.id;
              this.date = sourceEvent.date;
              this.titleValue = sourceEvent.title;
              this.startTimeValue = sourceEvent.startTime;
              this.endTimeValue = sourceEvent.endTime;
              this.notesValue = sourceEvent.notes;
              this.repeatCadenceValue = sourceEvent.repeatCadence;
              this.repeatUntilValue = sourceEvent.repeatUntil;
              this.renderContent();
            });
          })
          .addButton((button) => {
            button.setButtonText(event.isRecurring ? "Delete series" : "Delete").onClick(async () => {
              await this.plugin.removeCalendarEvent(event.sourceEventId);
              if (this.editingEventId === event.sourceEventId) {
                this.clearEditingState();
              }
              this.renderContent();
            });
          });
      });
    }

    contentEl.createEl("h3", { text: this.editingEventId ? "Edit event" : "Add event" });

    new Setting(contentEl)
      .setName("Title")
      .setDesc("Required")
      .addText((text) => {
        text
          .setPlaceholder("Appointment, reminder, call, errand")
          .setValue(this.titleValue)
          .onChange((value) => {
            this.titleValue = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Date")
      .setDesc("YYYY-MM-DD")
      .addText((text) => {
        text
          .setPlaceholder("2026-04-01")
          .setValue(this.date)
          .onChange((value) => {
            this.date = value.trim();
          });
        text.inputEl.type = "date";
      });

    new Setting(contentEl)
      .setName("Start time")
      .setDesc("Leave blank for all-day events.")
      .addText((text) => {
        text
          .setPlaceholder("09:30")
          .setValue(this.startTimeValue)
          .onChange((value) => {
            this.startTimeValue = value.trim();
          });
        text.inputEl.type = "time";
      });

    new Setting(contentEl)
      .setName("End time")
      .setDesc("Optional")
      .addText((text) => {
        text
          .setPlaceholder("10:15")
          .setValue(this.endTimeValue)
          .onChange((value) => {
            this.endTimeValue = value.trim();
          });
        text.inputEl.type = "time";
      });

    new Setting(contentEl)
      .setName("Notes")
      .setDesc("Optional context shown in reminders and the calendar detail list.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Location, prep, what to bring, who it is with")
          .setValue(this.notesValue)
          .onChange((value) => {
            this.notesValue = value;
          });
        textArea.inputEl.rows = 3;
      });

    new Setting(contentEl)
      .setName("Repeat")
      .setDesc("Make this event recurring.")
      .addDropdown((dropdown) => {
        dropdown.addOption("none", "Does not repeat");
        dropdown.addOption("daily", "Daily");
        dropdown.addOption("weekly", "Weekly");
        dropdown.addOption("monthly", "Monthly");
        dropdown.addOption("yearly", "Yearly");
        dropdown.setValue(this.repeatCadenceValue);
        dropdown.onChange((value) => {
          this.repeatCadenceValue = value === "daily" || value === "weekly" || value === "monthly" || value === "yearly" ? value : "none";
          this.renderContent();
        });
      });

    if (this.repeatCadenceValue !== "none") {
      new Setting(contentEl)
        .setName("Repeat until")
        .setDesc("Optional end date for the recurring series.")
        .addText((text) => {
          text
            .setPlaceholder("2026-12-31")
            .setValue(this.repeatUntilValue)
            .onChange((value) => {
              this.repeatUntilValue = value.trim();
            });
          text.inputEl.type = "date";
        });
    }

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(this.editingEventId ? "Save changes" : "Add event").setCta().onClick(async () => {
          const input = {
            title: this.titleValue,
            date: this.date,
            startTime: this.startTimeValue,
            endTime: this.endTimeValue,
            notes: this.notesValue,
            repeatCadence: this.repeatCadenceValue,
            repeatUntil: this.repeatUntilValue
          };

          if (this.editingEventId) {
            await this.plugin.updateCalendarEvent(this.editingEventId, input);
          } else {
            await this.plugin.addCalendarEvent(input);
          }
          this.clearEditingState();
          this.renderContent();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("rotate-ccw").setTooltip("Reset form").onClick(() => {
          this.clearEditingState();
          this.renderContent();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Close").onClick(() => {
          this.close();
        });
      });
  }

  private hydrateEditingState(): void {
    if (!this.editingEventId) {
      return;
    }

    const event = this.plugin.getCalendarEventEntry(this.editingEventId);
    if (!event) {
      this.clearEditingState();
      return;
    }

    this.date = event.date;
    this.titleValue = event.title;
    this.startTimeValue = event.startTime;
    this.endTimeValue = event.endTime;
    this.notesValue = event.notes;
    this.repeatCadenceValue = event.repeatCadence;
    this.repeatUntilValue = event.repeatUntil;
  }

  private clearEditingState(): void {
    this.editingEventId = null;
    this.date = this.initialDate;
    this.titleValue = "";
    this.startTimeValue = "";
    this.endTimeValue = "";
    this.notesValue = "";
    this.repeatCadenceValue = "none";
    this.repeatUntilValue = "";
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

export class LogicalDayRepairModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private state: DayRepairInput;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
    this.state = this.plugin.getDayRepairInput();
  }

  onOpen(): void {
    this.setTitle("Repair Logical Day");
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("p", {
      text: "Use this when the day flow needs correction. You can fix the logical date, key timestamps, and tracked totals so reports and the weekly board stay accurate."
    });

    new Setting(contentEl)
      .setName("Logical date")
      .setDesc("Enter the date the dashboard should use in YYYY-MM-DD format, then load that date if you want its existing values.")
      .addText((text) => {
        text
          .setPlaceholder("2026-04-01")
          .setValue(this.state.date)
          .onChange((value) => {
            this.state.date = value.trim();
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      })
      .addButton((button) => {
        button.setButtonText("Load date").onClick(() => {
          this.state = this.plugin.getDayRepairInput(this.state.date.trim() || formatDateKey(new Date()));
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Day status")
      .setDesc("Choose whether the logical day should be idle, active, or already ended.")
      .addDropdown((dropdown) => {
        dropdown.addOption("not-started", "Not started");
        dropdown.addOption("in-progress", "In progress");
        dropdown.addOption("ended", "Ended");
        dropdown.setValue(this.state.status);
        dropdown.onChange((value) => {
          this.state.status = value === "in-progress" || value === "ended" ? value : "not-started";
        });
      });

    this.addDateTimeSetting(contentEl, "Day start", "When the day began.", this.state.dayStartedAt, (value) => {
      this.state.dayStartedAt = value;
    });
    this.addDateTimeSetting(contentEl, "Day end", "When the day ended.", this.state.dayEndedAt, (value) => {
      this.state.dayEndedAt = value;
    });
    this.addDateTimeSetting(contentEl, "Wake time", "Useful for sleep calculations and daily context.", this.state.wakeTime, (value) => {
      this.state.wakeTime = value;
    });
    this.addDateTimeSetting(contentEl, "Sleep time", "When you actually went to sleep.", this.state.sleepTime, (value) => {
      this.state.sleepTime = value;
    });

    this.addMinutesSetting(contentEl, "Hours slept", "Total sleep minutes used by the weekly tracker and reports.", this.state.sleepMinutesOverride, (value) => {
      this.state.sleepMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Work minutes", "Correct tracked work if you missed a timer or ended it late.", this.state.workMinutesOverride, (value) => {
      this.state.workMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Nap minutes", "Correct nap totals for the day.", this.state.napMinutesOverride, (value) => {
      this.state.napMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Relax minutes", "Correct relaxing time totals.", this.state.relaxMinutesOverride, (value) => {
      this.state.relaxMinutesOverride = value;
    });
    this.addMinutesSetting(contentEl, "Break minutes", "Correct break totals without editing raw sessions.", this.state.breakMinutesOverride, (value) => {
      this.state.breakMinutesOverride = value;
    });

    this.addScoreSetting(contentEl, "Mood", this.state.moodScore, (value) => {
      this.state.moodScore = value;
    });
    this.addScoreSetting(contentEl, "Energy", this.state.energyScore, (value) => {
      this.state.energyScore = value;
    });
    this.addScoreSetting(contentEl, "Anxiety", this.state.anxietyScore, (value) => {
      this.state.anxietyScore = value;
    });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Reset to today").onClick(async () => {
          this.state = this.plugin.getDayRepairInput(formatDateKey(new Date()));
          this.state.status = "not-started";
          this.onOpen();
        });
      })
      .addButton((button) => {
        button.setButtonText("Reload current").onClick(() => {
          this.state = this.plugin.getDayRepairInput(this.state.date.trim() || this.plugin.getDayRepairInput().date);
          this.onOpen();
        });
      })
      .addButton((button) => {
        button.setButtonText("Apply").setCta().onClick(async () => {
          const didApply = await this.plugin.applyDayRepair(this.state);
          if (didApply) {
            this.close();
          }
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

  private addDateTimeSetting(parent: HTMLElement, name: string, description: string, value: string, onChange: (value: string) => void): void {
    new Setting(parent)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text
          .setValue(this.toDateTimeLocalValue(value))
          .onChange((nextValue) => {
            onChange(nextValue.trim());
          });
        text.inputEl.type = "datetime-local";
      });
  }

  private addMinutesSetting(parent: HTMLElement, name: string, description: string, value: number, onChange: (value: number) => void): void {
    new Setting(parent)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text
          .setValue(`${value}`)
          .onChange((nextValue) => {
            onChange(Math.max(0, Math.round(Number(nextValue) || 0)));
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "1440";
      });
  }

  private addScoreSetting(parent: HTMLElement, name: string, value: number, onChange: (value: number) => void): void {
    new Setting(parent)
      .setName(name)
      .setDesc("0 to 5")
      .addText((text) => {
        text
          .setValue(`${value}`)
          .onChange((nextValue) => {
            onChange(Math.max(0, Math.min(5, Math.round(Number(nextValue) || 0))));
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "5";
      });
  }

  private toDateTimeLocalValue(value: string): string {
    if (!value.trim()) {
      return "";
    }

    return value.replace(" ", "T").slice(0, 16);
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

    containerEl.createEl("h3", { text: "Calendar" });

    new Setting(containerEl)
      .setName("Enable calendar reminders")
      .setDesc("Show upcoming calendar events below Top 3 and raise notices inside the warning window.")
      .addToggle((toggle) => {
        toggle.setValue(settings.calendarEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            calendarEnabled: value
          });
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Calendar behavior")
      .setDesc("Events are stored in plugin data, synced to a calendar markdown note, and rendered into daily logs when those days are written.");

    new Setting(containerEl)
      .setName("Calendar document path")
      .setDesc("Markdown note that stores the full calendar event list and upcoming occurrences for AI and manual review.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.calendarDocumentPath)
          .setValue(settings.calendarDocumentPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              calendarDocumentPath: value.trim() || DEFAULT_SETTINGS.calendarDocumentPath
            });
          });
      });

    new Setting(containerEl)
      .setName("Calendar lookahead hours")
      .setDesc("How far ahead the Execution card should look when listing upcoming reminders.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.calendarLookaheadHours}`)
          .setValue(`${settings.calendarLookaheadHours}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              calendarLookaheadHours: Math.min(Math.max(Number(value.trim() || DEFAULT_SETTINGS.calendarLookaheadHours), 1), 336)
            });
          });
      });

    new Setting(containerEl)
      .setName("Calendar warning hours")
      .setDesc("Events inside this window trigger a dashboard notice and get marked as soon.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.calendarWarningHours}`)
          .setValue(`${settings.calendarWarningHours}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              calendarWarningHours: Math.min(
                Math.max(Number(value.trim() || DEFAULT_SETTINGS.calendarWarningHours), 1),
                this.plugin.getSettings().calendarLookaheadHours
              )
            });
          });
      });

    containerEl.createEl("h3", { text: "AI" });

    new Setting(containerEl)
      .setName("AI API key source")
      .setDesc("Environment variables are safer because the raw key is not persisted in plugin data.")
      .addDropdown((dropdown) => {
        dropdown.addOption("settings", "Stored in plugin settings");
        dropdown.addOption("env", "Environment variable");
        dropdown.setValue(settings.aiApiKeySource);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            aiApiKeySource: value === "env" ? "env" : "settings"
          });
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("AI environment variable")
      .setDesc("Only used when the key source is Environment variable.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiApiKeyEnvVar)
          .setValue(settings.aiApiKeyEnvVar)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiApiKeyEnvVar: value.trim() || DEFAULT_SETTINGS.aiApiKeyEnvVar
            });
          });
      });

    new Setting(containerEl)
      .setName("Stored OpenAI API key")
      .setDesc(settings.aiApiKeySource === "env"
        ? "Ignored while environment-variable mode is active. Clear it if you do not want a fallback key saved in plugin data."
        : "Used for AI planning, reflection, triage, and question answering when stored-key mode is active.")
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
      })
      .addButton((button) => {
        button.setButtonText("Clear").onClick(async () => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            aiApiKey: ""
          });
          this.display();
        });
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

    containerEl.createEl("h3", { text: "Appearance" });

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
const DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY = "daily-dashboard-expanded-sections";
const DASHBOARD_VIEW_MODE_STORAGE_KEY = "daily-dashboard-view-mode";
const DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY = "daily-dashboard-collapsed-subsections";
const DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY = "daily-dashboard-dismissed-reminders";
const DASHBOARD_SELECTED_SESSION_TAG_STORAGE_KEY = "daily-dashboard-selected-session-tag";

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

function getDashboardViewMode(): DashboardViewMode {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY);
    return stored === "compact" || stored === "widescreen" ? stored : "mobile";
  } catch {
    return "mobile";
  }
}

function setDashboardViewMode(mode: DashboardViewMode): void {
  try {
    window.localStorage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getDashboardSelectedSessionTag(): string {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_SELECTED_SESSION_TAG_STORAGE_KEY)?.trim() ?? "";
    return SESSION_TAG_OPTIONS.includes(stored as typeof SESSION_TAG_OPTIONS[number]) ? stored : SESSION_TAG_OPTIONS[0];
  } catch {
    return SESSION_TAG_OPTIONS[0];
  }
}

function setDashboardSelectedSessionTag(tag: string): void {
  try {
    const normalized = tag.trim();
    window.localStorage.setItem(
      DASHBOARD_SELECTED_SESSION_TAG_STORAGE_KEY,
      SESSION_TAG_OPTIONS.includes(normalized as typeof SESSION_TAG_OPTIONS[number]) ? normalized : SESSION_TAG_OPTIONS[0]
    );
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getCollapsedSubsectionState(): Set<string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY);
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

function setCollapsedSubsectionState(sectionKey: string, collapsed: boolean): void {
  try {
    const current = getCollapsedSubsectionState();
    if (collapsed) {
      current.add(sectionKey);
    } else {
      current.delete(sectionKey);
    }

    window.localStorage.setItem(DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY, JSON.stringify(Array.from(current)));
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

type FocusCaptureDestination = "top3" | "next-up";

type FocusCapturePayload = {
  text: string;
  notes?: string;
  estimateMinutes?: number | null;
  destination: FocusCaptureDestination;
};

type FocusCaptureModalOptions = {
  mode: "capture" | "edit";
  todayHasTop3Capacity: boolean;
  initialText?: string;
  initialNotes?: string;
  initialEstimateMinutes?: number | null;
  initialDestination?: FocusCaptureDestination;
  submitLabel?: string;
  onSubmit: (payload: FocusCapturePayload) => Promise<void>;
};

export class FocusCaptureModal extends Modal {
  private options: FocusCaptureModalOptions;
  private textValue: string;
  private notesValue: string;
  private estimateValue: string;
  private destinationValue: FocusCaptureDestination;

  constructor(app: App, options: FocusCaptureModalOptions) {
    super(app);
    this.options = options;
    this.textValue = options.initialText ?? "";
    this.notesValue = options.initialNotes ?? "";
    this.estimateValue = options.initialEstimateMinutes && options.initialEstimateMinutes > 0
      ? `${options.initialEstimateMinutes}`
      : "";
    this.destinationValue = options.initialDestination ?? (options.todayHasTop3Capacity ? "top3" : "next-up");
  }

  onOpen(): void {
    this.setTitle(this.options.mode === "edit" ? "Edit Focus Item" : "Quick Capture Focus Item");
    this.renderContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Title")
      .setDesc("The concrete task or outcome you want to track.")
      .addText((text) => {
        text
          .setPlaceholder("Ship dashboard notes UI")
          .setValue(this.textValue)
          .onChange((value) => {
            this.textValue = value;
          });
      });

    new Setting(contentEl)
      .setName("Estimate minutes")
      .setDesc("Optional rough effort estimate for comparing plan versus actual.")
      .addText((text) => {
        text
          .setPlaceholder("45")
          .setValue(this.estimateValue)
          .onChange((value) => {
            this.estimateValue = value;
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.step = "5";
      });

    new Setting(contentEl)
      .setName("Destination")
      .setDesc(this.options.todayHasTop3Capacity
        ? "Choose whether this belongs in the active Top 3 or the Next Up queue."
        : "Top 3 is full, so new captures will usually go to Next Up.")
      .addDropdown((dropdown) => {
        dropdown.addOption("top3", "Top 3");
        dropdown.addOption("next-up", "Next Up");
        dropdown.setValue(this.destinationValue);
        if (!this.options.todayHasTop3Capacity && this.destinationValue === "top3") {
          dropdown.setValue("next-up");
          this.destinationValue = "next-up";
        }
        dropdown.onChange((value) => {
          this.destinationValue = value === "top3" ? "top3" : "next-up";
        });
      });

    contentEl.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes" });
    const notesArea = contentEl.createEl("textarea", { cls: "daily-dashboard-textarea" });
    notesArea.rows = 5;
    notesArea.placeholder = "Context, definition of done, blockers, or follow-up details.";
    notesArea.value = this.notesValue;
    notesArea.addEventListener("input", () => {
      this.notesValue = notesArea.value;
    });

    const actions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    const submitButton = actions.createEl("button", {
      cls: "daily-dashboard-primary-button",
      text: this.options.submitLabel ?? (this.options.mode === "edit" ? "Save changes" : "Capture")
    });
    submitButton.type = "button";
    submitButton.addEventListener("click", () => {
      void this.submit();
    });
    const cancelButton = actions.createEl("button", { cls: "daily-dashboard-secondary-button", text: "Cancel" });
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => this.close());
  }

  private async submit(): Promise<void> {
    const text = this.textValue.trim();
    if (!text) {
      new Notice("Focus item text is required.");
      return;
    }

    const estimateMinutes = this.estimateValue.trim().length > 0
      ? Number(this.estimateValue)
      : null;
    if (estimateMinutes !== null && (!Number.isFinite(estimateMinutes) || estimateMinutes < 0)) {
      new Notice("Estimate minutes must be a valid non-negative number.");
      return;
    }

    if (this.destinationValue === "top3" && !this.options.todayHasTop3Capacity && this.options.mode !== "edit") {
      new Notice("Top 3 is full. Capture this into Next Up instead.");
      return;
    }

    await this.options.onSubmit({
      text,
      notes: this.notesValue.trim(),
      estimateMinutes: estimateMinutes === null ? null : Math.round(estimateMinutes),
      destination: this.destinationValue
    });
    this.close();
  }
}

export class AddHabitModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private habitName = "";
  private targetCount = "1";

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.setTitle("Add Habit");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Habit name")
      .setDesc("Shown in the dashboard and saved in habit definitions.")
      .addText((text) => {
        text
          .setPlaceholder("Drink water")
          .onChange((value) => {
            this.habitName = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Target count")
      .setDesc("How many times per day counts as complete.")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue(this.targetCount)
          .onChange((value) => {
            this.targetCount = value;
          });
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "12";
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Add habit").setCta().onClick(async () => {
          await this.plugin.addHabitDefinition(this.habitName, Number(this.targetCount));
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

function getDismissedReminderState(date: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    if (!stored) {
      return new Set<string>();
    }

    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const values = Array.isArray(parsed?.[date]) ? parsed[date] : [];
    return new Set(values.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

function setDismissedReminder(date: string, reminderId: string): void {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) as Record<string, string[]> : {};
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.add(reminderId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function clearDismissedReminder(date: string, reminderId: string): void {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as Record<string, string[]>;
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.delete(reminderId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}