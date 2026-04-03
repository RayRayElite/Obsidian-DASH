import { App, ItemView, Modal, Notice, PluginSettingTab, Setting, WorkspaceLeaf, setIcon } from "obsidian";

import type DailyDashboardPlugin from "../main";
import {
  countHabitEventsInWindow,
  formatActivitySessionLabel,
  formatHabitCadenceLabel,
  formatHabitWindowLabel,
  formatDateKey,
  formatDateTimeKey,
  getHabitWeightedCompletion,
  isHabitDueOnDate,
  formatSyncTimestamp,
  parseHabitAutomations,
  parseHabitDefinitions,
  renderScore
} from "./dashboard-core";
import { formatMinutesAsHours, getMinutesBetween, getSleepMinutesForDay, getTrackedWorkMinutes } from "./dashboard-logs";
import { splitMultilineInput } from "./dashboard-todo";
import {
  ACTIVITY_SESSION_KIND_OPTIONS,
  DEFAULT_SETTINGS,
  HABIT_CADENCE_OPTIONS,
  HABIT_WINDOW_OPTIONS,
  SESSION_TAG_OPTIONS,
  VIEW_TYPE_DAILY_DASHBOARD,
  type CalendarEventOccurrence,
  type CalendarEventCategory,
  type CalendarRepeatCadence,
  type CalendarSnapshot,
  type CardVisualOptions,
  type CreateProjectInput,
  type DayRepairInput,
  type ActivitySessionKind,
  type DashboardFocusDisplayItem,
  type DashboardNotificationItem,
  type DashboardSettings,
  type DashboardTone,
  type DashboardViewMode,
  type ExerciseIntensity,
  type GamificationSummary,
  type HabitDefinition,
  type IntakeEntry,
  type IntakeQuickPreset,
  type NextUpFocusItem,
  type ProjectReviewOption,
  type QuickAddState,
  type RepairTimelineSession,
  type RepairTimelineSessionKind,
  type SavedDashboardFilter,
  type SuggestedTop3Candidate,
  type SymptomEntry,
  type TodoTaskSummary,
  type TodoProjectSummary,
  type TimelineSearchFilters,
  type TimelineSearchKind,
  type TimelineSearchResult,
  type TodayFocusItem,
  type WeeklyAgendaDay,
  type WorkSession
} from "./dashboard-types";

const DASHBOARD_ACTIVITY_TRACKERS = [
  { kind: "exercise", label: "Exercise", icon: "dumbbell", tone: "health" },
  { kind: "study", label: "Study", icon: "book-open", tone: "focus" },
  { kind: "gaming", label: "Gaming", icon: "gamepad-2", tone: "focus" },
  { kind: "hygiene", label: "Hygiene", icon: "shower-head", tone: "health" },
  { kind: "cooking", label: "Cooking", icon: "chef-hat", tone: "alert" },
  { kind: "errand", label: "Errand", icon: "shopping-bag", tone: "alert" },
  { kind: "commute", label: "Commute", icon: "car-front", tone: "neutral" },
  { kind: "social", label: "Social", icon: "users", tone: "focus" },
  { kind: "chores", label: "Chores", icon: "house", tone: "log" }
] satisfies Array<{ kind: ActivitySessionKind; label: string; icon: string; tone: DashboardTone }>;

const WEEK_AT_A_GLANCE_SEGMENTS = [
  { kind: "sleep", label: "Sleep" },
  { kind: "work", label: "Work" },
  { kind: "nap", label: "Nap" },
  { kind: "relax", label: "Relax" },
  { kind: "break", label: "Break" },
  { kind: "poop", label: "Poop" },
  ...DASHBOARD_ACTIVITY_TRACKERS,
  { kind: "unknown", label: "Unknown" }
] as const;

export class DailyDashboardView extends ItemView {
  private static readonly AUTO_REFRESH_MS = 30 * 60 * 1000;

  private plugin: DailyDashboardPlugin;
  private hasDeferredRefreshListeners = false;
  private hasKeyboardShortcutListener = false;
  private pendingRefresh = false;
  private timelineFilters: TimelineSearchFilters = {
    keyword: "",
    project: "",
    tag: "",
    kinds: ["task", "session", "calendar", "log"],
    fromDate: "",
    toDate: "",
    onlyWithNotes: false
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
  private draggedLayoutCardKey: string | null = null;
  private suppressNextCardToggle = false;
  private selectedFocusProjectName = "";
  private selectedSessionProjectName = "";
  private selectedSavedFilterName = getDashboardSelectedFilterName();
  private calendarCursorDate = new Date();
  private selectedCalendarDate = formatDateKey(new Date());
  private pendingUndoActions: DashboardUndoAction[] = [];
  private notificationPanelOpen = false;
  private quickAddPanelOpen = false;
  private readonly handleDocumentPointerDown = (event: MouseEvent): void => {
    if ((!this.notificationPanelOpen && !this.quickAddPanelOpen) || !this.contentEl.isConnected) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const notificationShell = this.contentEl.querySelector<HTMLElement>(".daily-dashboard-notification-shell");
    const quickAddShell = this.contentEl.querySelector<HTMLElement>(".daily-dashboard-quick-add-shell");
    if (notificationShell?.contains(target) || quickAddShell?.contains(target)) {
      return;
    }

    this.notificationPanelOpen = false;
    this.quickAddPanelOpen = false;
    void this.render();
  };
  private readonly handleDashboardKeydown = (event: KeyboardEvent): void => {
    if (!this.contentEl.isConnected || !this.hasKeyboardShortcutListener) {
      return;
    }

    if (event.key === "Escape" && (this.notificationPanelOpen || this.quickAddPanelOpen)) {
      event.preventDefault();
      this.notificationPanelOpen = false;
      this.quickAddPanelOpen = false;
      void this.render();
      return;
    }

    if (!this.contentEl.contains(event.target as Node) && event.target !== this.contentEl) {
      return;
    }

    if (this.shouldIgnoreShortcutEvent(event)) {
      return;
    }

    const action = this.getShortcutAction(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    void action();
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
    this.attachDeferredRefreshListeners();
    this.attachKeyboardShortcutListener();
    document.addEventListener("mousedown", this.handleDocumentPointerDown, true);
    this.startAutoRefresh();
  }

  async onClose(): Promise<void> {
    this.detachKeyboardShortcutListener();
    document.removeEventListener("mousedown", this.handleDocumentPointerDown, true);
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

  private attachKeyboardShortcutListener(): void {
    if (this.hasKeyboardShortcutListener) {
      return;
    }

    this.hasKeyboardShortcutListener = true;
    this.contentEl.addEventListener("keydown", this.handleDashboardKeydown);
  }

  private detachKeyboardShortcutListener(): void {
    if (!this.hasKeyboardShortcutListener) {
      return;
    }

    this.hasKeyboardShortcutListener = false;
    this.contentEl.removeEventListener("keydown", this.handleDashboardKeydown);
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

  private shouldIgnoreShortcutEvent(event: KeyboardEvent): boolean {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) {
      return true;
    }

    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }

    return target instanceof HTMLElement && target.isContentEditable;
  }

  private getShortcutAction(event: KeyboardEvent): (() => Promise<void>) | null {
    const key = event.key.toLowerCase();
    switch (key) {
      case "v":
        return async () => this.cycleViewMode();
      case "l":
        return async () => this.openLayoutCustomizationFlow();
      case "n":
        return async () => this.plugin.openCreateProjectFlow();
      case "w":
        return async () => this.plugin.generateWeeklyReview();
      case "r":
        return async () => this.requestRefresh();
      case "f":
        return async () => this.plugin.openQuickCaptureFocusFlow();
      case "a":
        return async () => this.plugin.openAskAiFlow();
      case "s":
        return async () => this.plugin.syncRepeatingProjectTasks(true);
      case "z":
        return async () => this.undoPendingAction();
      case "/":
      case "?":
        return async () => this.openShortcutHelpFlow();
      default:
        return null;
    }
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

  private openLayoutCustomizationFlow(): void {
    new DashboardLayoutModal(this.app, {
      cards: getDashboardCardLayoutState(),
      onApply: async (cards) => {
        setDashboardCardLayoutState(cards);
        await this.render();
      }
    }).open();
  }

  private openShortcutHelpFlow(): void {
    new DashboardShortcutHelpModal(this.app).open();
  }

  private async toggleNotificationPanel(): Promise<void> {
    this.notificationPanelOpen = !this.notificationPanelOpen;
    if (this.notificationPanelOpen) {
      this.quickAddPanelOpen = false;
    }
    await this.render();
  }

  private async toggleQuickAddPanel(): Promise<void> {
    this.quickAddPanelOpen = !this.quickAddPanelOpen;
    if (this.quickAddPanelOpen) {
      this.notificationPanelOpen = false;
    }
    await this.render();
  }

  private async submitQuickAddTask(): Promise<void> {
    const text = this.quickAddState.taskText.trim();
    if (!text || !this.quickAddState.projectName) {
      return;
    }

    await this.plugin.addTaskToProject(this.quickAddState.projectName, this.quickAddState.sectionName, text);
    this.quickAddState.taskText = "";
    this.quickAddPanelOpen = false;
    await this.render();
  }

  private async handleNotificationAction(notification: DashboardNotificationItem): Promise<void> {
    this.notificationPanelOpen = false;
    const action = notification.action;
    if (!action) {
      return;
    }

    switch (action.kind) {
      case "open-setup":
        await this.plugin.openFirstRunSetupWizard();
        return;
      case "open-master-todo":
        await this.plugin.openMasterTodo();
        return;
      case "open-cleanup-note":
        await this.plugin.showCleanupSuggestions();
        return;
      case "end-day":
        await this.plugin.endLogicalDay();
        return;
      case "repair-day":
        await this.plugin.openLogicalDayRepairFlow();
        return;
      default:
        return;
    }
  }

  private async dismissNotification(notificationId: string): Promise<void> {
    this.notificationPanelOpen = false;
    await this.plugin.dismissDashboardNotification(notificationId);
  }

  private async runDestructiveAction(label: string, action: () => Promise<void>, undo: () => Promise<void>): Promise<void> {
    await action();
    this.pendingUndoActions = [...this.pendingUndoActions, { label, undo }].slice(-5);
    await this.render();
  }

  private async undoPendingAction(): Promise<void> {
    if (this.pendingUndoActions.length === 0) {
      return;
    }

    const action = this.pendingUndoActions[this.pendingUndoActions.length - 1];
    this.pendingUndoActions = this.pendingUndoActions.slice(0, -1);
    await action.undo();
    await this.render();
  }

  private async dismissPendingUndo(): Promise<void> {
    this.pendingUndoActions = this.pendingUndoActions.slice(0, -1);
    await this.render();
  }

  private async handleCleanupSuggestionAction(action: "open-master-todo" | "open-cleanup-note"): Promise<void> {
    if (action === "open-cleanup-note") {
      await this.plugin.showCleanupSuggestions();
      return;
    }

    await this.plugin.openMasterTodo();
  }

  private registerGridCard(
    card: HTMLElement,
    title: string,
    bindings: DashboardLayoutCardBinding[],
    layoutByKey: Map<string, DashboardLayoutCardState>
  ): HTMLElement {
    const key = getDashboardCardLayoutKey(title);
    const config = layoutByKey.get(key);
    card.dataset.layoutKey = key;
    if (config?.pinned) {
      card.addClass("is-layout-pinned");
      const controls = card.querySelector<HTMLElement>(".daily-dashboard-card-header-controls");
      if (controls) {
        createSemanticChip(controls, "Pinned", "focus");
      }
    }
    if (config?.hidden) {
      card.addClass("is-layout-hidden");
    }

    const header = card.querySelector<HTMLElement>(".daily-dashboard-card-header");
    if (header && !config?.hidden) {
      header.addClass("is-layout-draggable");
      header.draggable = true;
      header.addEventListener("click", (event) => {
        if (!this.suppressNextCardToggle) {
          return;
        }

        this.suppressNextCardToggle = false;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      header.addEventListener("dragstart", (event) => {
        this.draggedLayoutCardKey = key;
        this.suppressNextCardToggle = false;
        card.addClass("is-layout-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", key);
        }
      });
      header.addEventListener("dragend", () => {
        this.draggedLayoutCardKey = null;
        card.removeClass("is-layout-dragging");
        this.clearDashboardCardDropTargets();
      });
      card.addEventListener("dragover", (event) => {
        if (!this.draggedLayoutCardKey || this.draggedLayoutCardKey === key) {
          return;
        }

        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const position: DashboardCardDropPosition = event.clientY < rect.top + (rect.height / 2) ? "before" : "after";
        card.toggleClass("is-layout-drop-before", position === "before");
        card.toggleClass("is-layout-drop-after", position === "after");
      });
      card.addEventListener("dragleave", (event) => {
        if (!(event.relatedTarget instanceof Node) || !card.contains(event.relatedTarget)) {
          card.removeClass("is-layout-drop-before");
          card.removeClass("is-layout-drop-after");
        }
      });
      card.addEventListener("drop", (event) => {
        const sourceKey = this.draggedLayoutCardKey;
        if (!sourceKey || sourceKey === key) {
          return;
        }

        event.preventDefault();
        const rect = card.getBoundingClientRect();
        const position: DashboardCardDropPosition = event.clientY < rect.top + (rect.height / 2) ? "before" : "after";
        this.clearDashboardCardDropTargets();
        this.suppressNextCardToggle = true;
        void this.reorderDashboardCards(sourceKey, key, position);
      });
    }

    bindings.push({ key, card });
    return card;
  }

  private clearDashboardCardDropTargets(): void {
    this.contentEl.querySelectorAll(".daily-dashboard-card.is-layout-drop-before, .daily-dashboard-card.is-layout-drop-after").forEach((element) => {
      element.removeClass("is-layout-drop-before");
      element.removeClass("is-layout-drop-after");
    });
  }

  private async reorderDashboardCards(sourceKey: string, targetKey: string, position: DashboardCardDropPosition): Promise<void> {
    const cards = sortDashboardLayoutCardsByOrder(getDashboardCardLayoutState());
    const sourceIndex = cards.findIndex((card) => card.key === sourceKey);
    const targetIndex = cards.findIndex((card) => card.key === targetKey);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return;
    }

    const nextCards = [...cards];
    const [movedCard] = nextCards.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertionIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
    nextCards.splice(Math.max(0, Math.min(insertionIndex, nextCards.length)), 0, movedCard);
    setDashboardCardLayoutState(nextCards.map((card, index) => ({ ...card, order: index })));
    await this.render();
  }

  private applyGridLayout(grid: HTMLElement, bindings: DashboardLayoutCardBinding[], layoutByKey: Map<string, DashboardLayoutCardState>): void {
    const visible = bindings
      .filter((binding) => !layoutByKey.get(binding.key)?.hidden)
      .sort((left, right) => {
        const leftConfig = layoutByKey.get(left.key);
        const rightConfig = layoutByKey.get(right.key);
        const pinDelta = Number(Boolean(rightConfig?.pinned)) - Number(Boolean(leftConfig?.pinned));
        if (pinDelta !== 0) {
          return pinDelta;
        }

        const orderDelta = (leftConfig?.order ?? Number.MAX_SAFE_INTEGER) - (rightConfig?.order ?? Number.MAX_SAFE_INTEGER);
        if (orderDelta !== 0) {
          return orderDelta;
        }

        return left.key.localeCompare(right.key);
      });

    const hidden = bindings.filter((binding) => layoutByKey.get(binding.key)?.hidden);
    [...visible, ...hidden].forEach((binding) => {
      const config = layoutByKey.get(binding.key);
      binding.card.style.order = `${config?.order ?? 0}`;
      binding.card.style.gridColumn = getDashboardCardGridColumn(binding.key, config, this.getViewMode());
      grid.appendChild(binding.card);
    });
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

  private formatTodoTaskMeta(task: TodoTaskSummary): string {
    return [
      task.section,
      task.dueDate ? `Due ${task.dueDate}` : "",
      task.isOverdue ? "Overdue" : task.isDueSoon ? "Due soon" : "",
      task.blockedReason ? `Blocked: ${task.blockedReason}` : "",
      task.unblockDate ? `Unblock ${task.unblockDate}` : ""
    ].filter((value) => value.length > 0).join(" • ");
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
      const dashboardNotifications = this.plugin.getDashboardNotifications(todoSnapshot, calendarSnapshot);
      const weeklyAgenda = this.plugin.getWeeklyAgenda(todayEntry.date);
      const suggestedTop3 = this.plugin.getSuggestedTop3Candidates(todoSnapshot, calendarSnapshot);
      const wallpaperUrl = this.plugin.getSelectedWallpaperUrl();
      const projects = todoSnapshot?.projects ?? [];
      const staleProjects = todoSnapshot?.staleProjects ?? [];
      const breakdownCandidates = todoSnapshot?.breakdownCandidates ?? [];
      const cleanupSuggestions = this.plugin.getVisibleCleanupSuggestions(todoSnapshot);
      const dueSoonTasks = todoSnapshot?.dueSoonTasks ?? [];
      const overdueTasks = todoSnapshot?.overdueTasks ?? [];
      const blockedTasks = todoSnapshot?.blockedTasks ?? [];
      const cleanupProjects = projects.filter((project) => project.staleDays !== null || project.duplicateTasks.length > 0 || project.emptySections.length > 0 || project.breakdownTasks.length > 0);
      const gamificationSummary = this.plugin.getGamificationSummary(todoSnapshot);
      const timelineResults = this.getTimelineSearchResults();
      const savedDashboardFilters = getSavedDashboardFilters();
      const layoutCards = getDashboardCardLayoutState();
      const layoutByKey = new Map(layoutCards.map((card) => [card.key, card]));
      const hiddenLayoutCardCount = layoutCards.filter((card) => card.hidden).length;
      const gridCardBindings: DashboardLayoutCardBinding[] = [];
      const staleProjectCount = staleProjects.length;
      const viewMode = this.getViewMode();
      const viewModeMeta = this.getViewModeMeta(viewMode);
      const latestMoodCheckIn = todayEntry.moodCheckIns[0] ?? null;
      const latestEnergyCheckIn = todayEntry.energyCheckIns[0] ?? null;
      const latestAnxietyCheckIn = todayEntry.anxietyCheckIns[0] ?? null;
      const energyCheckInAverage = todayEntry.energyCheckIns.length > 0
        ? (todayEntry.energyCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.energyCheckIns.length).toFixed(1)
        : "";
      const moodCheckInAverage = todayEntry.moodCheckIns.length > 0
        ? (todayEntry.moodCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.moodCheckIns.length).toFixed(1)
        : "";
      const anxietyCheckInAverage = todayEntry.anxietyCheckIns.length > 0
        ? (todayEntry.anxietyCheckIns.reduce((sum, item) => sum + item.score, 0) / todayEntry.anxietyCheckIns.length).toFixed(1)
        : "";
      if (!this.selectedCalendarDate) {
        this.selectedCalendarDate = todayEntry.date;
      }

      if (!this.quickAddState.projectName && projects.length > 0) {
        this.quickAddState.projectName = projects[0].name;
      }
      if (!projects.some((project) => project.name === this.selectedFocusProjectName)) {
        this.selectedFocusProjectName = "";
      }
      if (!this.selectedSessionProjectName && projects.length > 0) {
        this.selectedSessionProjectName = projects[0].name;
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

      const heroHeaderControls = heroHeader.createDiv({ cls: "daily-dashboard-hero-header-controls" });
      const actions = heroHeaderControls.createDiv({ cls: "daily-dashboard-actions" });
      createButton(actions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
      const quickAddShell = actions.createDiv({ cls: "daily-dashboard-quick-add-shell" });
      const quickAddTrigger = quickAddShell.createEl("button", { cls: "daily-dashboard-hero-popover-trigger" });
      quickAddTrigger.type = "button";
      quickAddTrigger.ariaLabel = "Add a task to a project";
      quickAddTrigger.ariaExpanded = this.quickAddPanelOpen ? "true" : "false";
      quickAddTrigger.toggleClass("is-active", this.quickAddPanelOpen);
      const quickAddIcon = quickAddTrigger.createSpan({ cls: "daily-dashboard-button-icon" });
      setIcon(quickAddIcon, "plus-circle");
      quickAddTrigger.createSpan({ cls: "daily-dashboard-button-label", text: "Add to project" });
      quickAddTrigger.addEventListener("click", () => {
        void this.toggleQuickAddPanel();
      });
      if (this.quickAddPanelOpen) {
        const quickAddPopover = quickAddShell.createDiv({ cls: "daily-dashboard-hero-popover daily-dashboard-quick-add-popover" });
        const popoverHeader = quickAddPopover.createDiv({ cls: "daily-dashboard-notification-popover-header" });
        const popoverCopy = popoverHeader.createDiv({ cls: "daily-dashboard-stack" });
        popoverCopy.createEl("strong", { text: "Add to project" });
        popoverCopy.createEl("span", {
          cls: "daily-dashboard-row-meta",
          text: projects.length > 0 ? "Capture a task straight into Add, Fix, Now, Next, or Later." : "Create a project first so there is somewhere to send the task."
        });
        if (projects.length === 0) {
          const emptyState = quickAddPopover.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
          emptyState.createEl("span", { text: "No projects are available yet." });
          const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(emptyActions, "New project", async () => this.plugin.openCreateProjectFlow(), true, "folder-plus");
        } else {
          const quickAddForm = quickAddPopover.createDiv({ cls: "daily-dashboard-stacked-form" });
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
          taskInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void this.submitQuickAddTask();
            }
          });
          const quickAddActions = quickAddPopover.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(quickAddActions, "Add task", async () => this.submitQuickAddTask(), true, "plus-circle");
          createButton(quickAddActions, "Open hub", async () => this.plugin.openMasterTodo(), false, "file-text");
        }
      }
      createButton(actions, "Review mode", async () => this.plugin.openProjectReviewModeFlow(), false, "panel-right-open");
      createButton(actions, "Repair day", async () => this.plugin.openLogicalDayRepairFlow(), false, "wrench");
      const notificationShell = heroHeaderControls.createDiv({ cls: "daily-dashboard-notification-shell" });
      const notificationTrigger = notificationShell.createEl("button", { cls: "daily-dashboard-notification-trigger" });
      notificationTrigger.type = "button";
      notificationTrigger.ariaLabel = dashboardNotifications.length > 0
        ? `${dashboardNotifications.length} active notifications`
        : "No active notifications";
      notificationTrigger.ariaExpanded = this.notificationPanelOpen ? "true" : "false";
      notificationTrigger.toggleClass("is-alert", dashboardNotifications.some((item) => item.tone === "alert"));
      notificationTrigger.toggleClass("is-active", this.notificationPanelOpen);
      const notificationIcon = notificationTrigger.createSpan({ cls: "daily-dashboard-button-icon" });
      setIcon(notificationIcon, "bell-ring");
      notificationTrigger.createSpan({ cls: "daily-dashboard-notification-label", text: "Notifications" });
      notificationTrigger.createSpan({ cls: "daily-dashboard-notification-badge", text: `${dashboardNotifications.length}` });
      notificationTrigger.addEventListener("click", () => {
        void this.toggleNotificationPanel();
      });
      if (this.notificationPanelOpen) {
        const notificationPopover = notificationShell.createDiv({ cls: "daily-dashboard-notification-popover" });
        const popoverHeader = notificationPopover.createDiv({ cls: "daily-dashboard-notification-popover-header" });
        const popoverCopy = popoverHeader.createDiv({ cls: "daily-dashboard-stack" });
        popoverCopy.createEl("strong", { text: "Notifications" });
        popoverCopy.createEl("span", {
          cls: "daily-dashboard-row-meta",
          text: dashboardNotifications.length > 0 ? `${dashboardNotifications.length} active items` : "Everything is clear right now."
        });
        const popoverSummary = notificationPopover.createDiv({ cls: "daily-dashboard-chip-row" });
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "calendar").length} reminders`, dashboardNotifications.some((item) => item.source === "calendar") ? "focus" : "neutral");
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "system").length} system`, dashboardNotifications.some((item) => item.source === "system") ? "state" : "neutral");
        createSemanticChip(popoverSummary, `${dashboardNotifications.filter((item) => item.source === "tasks").length} task`, dashboardNotifications.some((item) => item.source === "tasks") ? "alert" : "neutral");
        const notificationList = notificationPopover.createDiv({ cls: "daily-dashboard-project-list daily-dashboard-notification-popover-list" });
        if (dashboardNotifications.length === 0) {
          notificationList.createDiv({ cls: "daily-dashboard-empty-state", text: "No active reminders or system notices right now." });
        } else {
          dashboardNotifications.slice(0, 10).forEach((notification) => {
            const row = notificationList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-notification-row" });
            row.addClass(`is-${notification.tone}`);
            const copy = row.createDiv({ cls: "daily-dashboard-stack" });
            const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, notification.source === "logical-day" ? "Day flow" : notification.source, notification.tone);
            copy.createEl("strong", { text: notification.title });
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: notification.description });
            const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
            if (notification.action) {
              createButton(actions, notification.action.label, async () => this.handleNotificationAction(notification), false, "arrow-right-circle");
            }
            if (notification.dismissible) {
              createButton(actions, "Dismiss", async () => this.dismissNotification(notification.id), false, "x");
            }
          });
        }
      }

      const heroFooter = hero.createDiv({ cls: "daily-dashboard-hero-footer" });
      const heroMeta = heroFooter.createDiv({ cls: "daily-dashboard-hero-status-row" });
      const datePill = createStatPill(heroMeta, todayEntry.date, "calendar-days", "date");
      datePill.addClass("is-compact");
      const archivedPill = createStatPill(heroMeta, `${todayEntry.completedTasks.length} archived`, "archive", "done");
      archivedPill.addClass("is-compact");
      const stalePill = createStatPill(heroMeta, `${staleProjectCount} stale`, "triangle-alert", staleProjectCount > 0 ? "alert" : "neutral");
      stalePill.addClass("is-compact");
      const statePill = createStatPill(
        heroMeta,
        `Mood ${latestMoodCheckIn ? `${latestMoodCheckIn.score}/5${latestMoodCheckIn.feeling ? ` ${latestMoodCheckIn.feeling}` : ""}` : renderScore(todayEntry.moodScore)} • Energy ${latestEnergyCheckIn ? `${latestEnergyCheckIn.score}/5` : renderScore(todayEntry.energyScore)}`,
        "activity",
        "state"
      );
      statePill.addClass("is-compact");
      if (hiddenLayoutCardCount > 0) {
        const hiddenPill = createStatPill(heroMeta, `${hiddenLayoutCardCount} hidden`, "layout-dashboard", "log");
        hiddenPill.addClass("is-compact");
      }

      const utilityActions = heroFooter.createDiv({ cls: "daily-dashboard-hero-utility-actions" });
      createIconButton(utilityActions, viewModeMeta.icon, `View mode ${viewModeMeta.label}. Switch to ${viewModeMeta.nextLabel}.`, async () => this.cycleViewMode());
      createIconButton(utilityActions, "keyboard", "Show dashboard keyboard shortcuts", async () => {
        this.openShortcutHelpFlow();
      });
      createIconButton(utilityActions, "sliders-horizontal", "Customize dashboard layout", async () => {
        this.openLayoutCustomizationFlow();
      });
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "bar-chart-3", "Weekly report", async () => this.plugin.generateWeeklyReport());
      createIconButton(utilityActions, "line-chart", "Monthly report", async () => this.plugin.generateMonthlyReport());
      createIconButton(utilityActions, "trophy", "Gamification report", async () => this.plugin.generateGamificationReport());
      createIconButton(utilityActions, "refresh-cw", "Sync repeating", async () => this.plugin.syncRepeatingProjectTasks(true));

      const latestUndoAction = this.pendingUndoActions[this.pendingUndoActions.length - 1] ?? null;
      if (latestUndoAction && settings.showUndoNotifications) {
        const undoBanner = page.createDiv({ cls: "daily-dashboard-undo-banner" });
        const undoCopy = undoBanner.createDiv({ cls: "daily-dashboard-stack" });
        undoCopy.createEl("strong", { text: "Undo last dashboard action" });
        undoCopy.createEl("span", { cls: "daily-dashboard-row-meta", text: latestUndoAction.label });
        if (this.pendingUndoActions.length > 1) {
          undoCopy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `${this.pendingUndoActions.length - 1} earlier undo action${this.pendingUndoActions.length - 1 === 1 ? "" : "s"} still available.`
          });
        }
        const undoActions = undoBanner.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(undoActions, "Undo", async () => this.undoPendingAction(), true, "rotate-ccw");
        createButton(undoActions, "Dismiss", async () => this.dismissPendingUndo(), false, "x");
      }

      const grid = page.createDiv({ cls: "daily-dashboard-grid" });
      const createGridCard = (title: string, description: string, options: CardVisualOptions): HTMLElement => this.registerGridCard(
        createCard(grid, title, description, options),
        title,
        gridCardBindings,
        layoutByKey
      );

      const weekBoardCard = createGridCard("Week At A Glance", "See the week as stacked tracked time instead of relying on memory and rough impressions.", {
        icon: "calendar-range",
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
        WEEK_AT_A_GLANCE_SEGMENTS.forEach((segment) => {
          this.renderWeekBarSegment(cylinder, segment.kind, day.minutesByKind[segment.kind] ?? 0);
        });
        cylinder.createDiv({ cls: "daily-dashboard-week-cylinder-overlay" });

        const labels = column.createDiv({ cls: "daily-dashboard-week-labels" });
        labels.createEl("strong", { text: day.label.toUpperCase() });
        labels.createEl("span", { text: `${Number.parseInt(day.date.slice(-2), 10)}` });
      });

      const weekLegend = weekBoardCard.createDiv({ cls: "daily-dashboard-week-legend" });
      WEEK_AT_A_GLANCE_SEGMENTS.forEach((segment) => {
        this.renderWeekLegendItem(weekLegend, segment.label, segment.kind);
      });

      const weeklyAgendaCard = createGridCard("Weekly Agenda", "See the actual week load instead of guessing from one day at a time.", {
        icon: "calendar-days",
        eyebrow: "Planning",
        tone: "capture",
        tag: weeklyAgenda.reduce((sum, day) => sum + day.events.length, 0) > 0 ? "Live" : "Clear"
      });
      const weeklyAgendaSummary = weeklyAgendaCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(weeklyAgendaSummary, `${weeklyAgenda.reduce((sum, day) => sum + day.events.length, 0)} events`, weeklyAgenda.some((day) => day.events.length > 0) ? "capture" : "neutral");
      createSemanticChip(weeklyAgendaSummary, `${weeklyAgenda.filter((day) => day.events.length > 0).length} busy days`, weeklyAgenda.filter((day) => day.events.length > 0).length >= 4 ? "alert" : "neutral");
      const weeklyAgendaList = weeklyAgendaCard.createDiv({ cls: "daily-dashboard-project-list" });
      weeklyAgenda.forEach((day) => {
        const row = weeklyAgendaList.createDiv({ cls: "daily-dashboard-project-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-stack" });
        const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
        createSemanticChip(chipRow, day.shortLabel, day.isToday ? "focus" : "neutral");
        createSemanticChip(chipRow, day.events.length > 0 ? `${day.events.length} item${day.events.length === 1 ? "" : "s"}` : "Open", day.events.length > 0 ? "capture" : "done");
        copy.createEl("strong", { text: day.label });
        if (day.events.length === 0) {
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: "No calendar blocks or reminders on this day yet." });
        } else {
          day.events.slice(0, 3).forEach((event) => {
            copy.createEl("span", {
              cls: "daily-dashboard-row-meta",
              text: `${event.allDay ? (event.date === event.endDate ? "All day" : `${event.date} -> ${event.endDate} all day`) : (event.date === event.endDate ? `${event.startTime}${event.endTime ? `-${event.endTime}` : ""}` : `${event.date} ${event.startTime} -> ${event.endDate}${event.endTime ? ` ${event.endTime}` : ""}`)} • ${event.title}${event.projectName ? ` • ${event.projectName}` : ""}${event.notes ? ` • ${event.notes}` : ""}`
            });
          });
          if (day.events.length > 3) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `+${day.events.length - 3} more item${day.events.length - 3 === 1 ? "" : "s"}` });
          }
        }

        const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(actions, "Add", async () => {
          new CalendarEventModal(this.app, this.plugin, day.date).open();
        }, false, "plus-circle");
      });

      const dayState = this.plugin.getDayState();
      const logicalDayInsights = this.plugin.getLogicalDayInsights();
      const sleepInsights = this.plugin.getSleepInsights();
      const timeAllocationInsights = this.plugin.getTimeAllocationInsights(todayEntry.date);
      const aiStatus = this.plugin.getAiStatus();
      const trackedSleepMinutes = this.plugin.getTrackedSleepMinutes(todayEntry);
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const trackedRelaxMinutes = this.plugin.getTrackedRelaxMinutes(todayEntry);
      const trackedBreakMinutes = this.plugin.getTrackedBreakMinutes(todayEntry);
      const trackedPoopMinutes = this.plugin.getTrackedPoopMinutes(todayEntry);
      const trackedActivityMinutes = this.plugin.getTrackedActivityMinutes(todayEntry);
      const trackedPoopCount = this.plugin.getTrackedPoopCount(todayEntry);
      const activeWorkSession = todayEntry.workSessions.find((session) => session.end === null) ?? null;
      const activeNapSession = todayEntry.napSessions.find((session) => session.end === null) ?? null;
      const activeRelaxSession = todayEntry.relaxSessions.find((session) => session.end === null) ?? null;
      const activeBreakSession = todayEntry.breakSessions.find((session) => session.end === null) ?? null;
      const activePoopSession = todayEntry.poopSessions.find((session) => session.end === null) ?? null;
      const activeActivitySession = this.plugin.getActiveActivitySession(undefined, todayEntry);
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
              : activeActivitySession
                ? activeActivitySession.label
              : dayState.status === "in-progress"
                ? "Idle"
                : "Offline";
      const dayToggleLabel = dayState.status === "in-progress" ? "End day" : "Begin day";
      const dayToggleIcon = dayState.status === "in-progress" ? "moon-star" : "sunrise";
      const dayToggleAction = dayState.status === "in-progress"
        ? async () => this.plugin.endLogicalDay()
        : async () => this.plugin.beginLogicalDay();

      const sessionDeckCard = createCard(page, "Session Deck", "Keep timers visible and one click away so session tracking stays practical during the day.", {
        icon: "timer-reset",
        eyebrow: "Live",
        tone: "capture",
        tag: activeModeLabel
      });
      const sessionDeckSummary = sessionDeckCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(sessionDeckSummary, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(sessionDeckSummary, activeModeLabel, activeActivitySession ? DASHBOARD_ACTIVITY_TRACKERS.find((item) => item.kind === activeActivitySession.kind)?.tone ?? "neutral" : activePoopSession ? "log" : activeBreakSession ? "alert" : activeWorkSession ? "capture" : activeNapSession ? "alert" : activeRelaxSession ? "health" : "neutral");
      createSemanticChip(sessionDeckSummary, `Tracked ${formatMinutesAsHours(trackedWorkMinutes + trackedNapMinutes + trackedRelaxMinutes + trackedBreakMinutes + trackedPoopMinutes + trackedActivityMinutes)}`, "capture");
      const sessionDeckToolbar = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const sessionProjectSelect = sessionDeckToolbar.createEl("select", { cls: "daily-dashboard-input" });
      const emptyProjectOption = sessionProjectSelect.createEl("option", { text: "Work project" });
      emptyProjectOption.value = "";
      projects.forEach((project) => {
        const option = sessionProjectSelect.createEl("option", { text: project.name });
        option.value = project.name;
      });
      if (!projects.some((project) => project.name === this.selectedSessionProjectName)) {
        this.selectedSessionProjectName = "";
      }
      sessionProjectSelect.value = this.selectedSessionProjectName;
      sessionProjectSelect.addEventListener("change", () => {
        this.selectedSessionProjectName = sessionProjectSelect.value;
      });
      const sessionDeckActions = sessionDeckToolbar.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(sessionDeckActions, dayToggleLabel, dayToggleAction, dayState.status !== "in-progress", dayToggleIcon);
      createButton(sessionDeckActions, "Pause into break", async () => this.plugin.pauseAllAndStartBreak(), false, "pause");
      const sessionDeckGrid = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-deck-grid" });
      const createSessionDeckButton = (label: string, detail: string, icon: string, tone: DashboardTone, isActive: boolean, onClick: () => Promise<void>): void => {
        const button = sessionDeckGrid.createEl("button", { cls: "daily-dashboard-session-button" });
        button.type = "button";
        button.toggleClass("is-active", isActive);
        button.addClass(`is-${tone}`);
        const iconEl = button.createSpan({ cls: "daily-dashboard-session-button-icon" });
        setIcon(iconEl, icon);
        const copy = button.createSpan({ cls: "daily-dashboard-session-button-copy" });
        copy.createEl("strong", { text: label });
        copy.createEl("span", { cls: "daily-dashboard-row-meta", text: detail });
        button.addEventListener("click", () => {
          void onClick();
        });
      };
      createSessionDeckButton(activeWorkSession ? "Stop Work" : "Start Work", activeWorkSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedWorkMinutes)} today${this.selectedSessionProjectName ? ` • ${this.selectedSessionProjectName}` : ""}`, activeWorkSession ? "square" : "play", "capture", Boolean(activeWorkSession), async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession("", this.selectedSessionProjectName));
      createSessionDeckButton(activeNapSession ? "Stop Nap" : "Start Nap", activeNapSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedNapMinutes)} today`, activeNapSession ? "alarm-clock-off" : "bed-single", "alert", Boolean(activeNapSession), async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(""));
      createSessionDeckButton(activeRelaxSession ? "Stop Relax" : "Start Relax", activeRelaxSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeRelaxSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedRelaxMinutes)} today`, activeRelaxSession ? "square" : "coffee", "health", Boolean(activeRelaxSession), async () => activeRelaxSession ? this.plugin.stopRelaxSession() : this.plugin.startRelaxSession(""));
      createSessionDeckButton(activeBreakSession ? "Stop Break" : "Start Break", activeBreakSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeBreakSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedBreakMinutes)} today`, activeBreakSession ? "square" : "pause", "alert", Boolean(activeBreakSession), async () => activeBreakSession ? this.plugin.stopBreakSession() : this.plugin.startBreakSession(""));
      createSessionDeckButton(activePoopSession ? "Stop Poop" : "Start Poop", activePoopSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(new Date())))}` : `${trackedPoopCount}x • ${formatMinutesAsHours(trackedPoopMinutes)}`, activePoopSession ? "square" : "bath", "log", Boolean(activePoopSession), async () => activePoopSession ? this.plugin.stopPoopSession() : this.plugin.startPoopSession(""));
      DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
        const activeTrackerSession = activeActivitySession?.kind === tracker.kind ? activeActivitySession : null;
        createSessionDeckButton(activeTrackerSession ? `Stop ${tracker.label}` : `Start ${tracker.label}`, activeTrackerSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeTrackerSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(this.plugin.getTrackedActivityMinutes(todayEntry, tracker.kind))} today`, activeTrackerSession ? "square" : tracker.icon, tracker.tone, Boolean(activeTrackerSession), async () => activeTrackerSession ? this.plugin.stopActivitySession(tracker.kind) : this.plugin.startActivitySession(tracker.kind));
      });

      const dayFlowCard = createGridCard("Day Flow", "Control when your real day begins and ends so late nights stay on the right log date.", {
        icon: "sun-moon",
        eyebrow: "Cycle",
        tone: "focus",
        tag: dayState.status === "in-progress" ? "In Progress" : dayState.status === "ended" ? "Ended" : "Idle"
      });
      const dayFlowStatus = dayFlowCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(dayFlowStatus, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(dayFlowStatus, dayState.status === "in-progress" ? "Day active" : dayState.status === "ended" ? "Day ended" : "Day not started", dayState.status === "in-progress" ? "focus" : dayState.status === "ended" ? "done" : "neutral");
      createSemanticChip(dayFlowStatus, activeModeLabel, activePoopSession ? "alert" : activeBreakSession ? "alert" : activeWorkSession ? "capture" : activeNapSession ? "alert" : activeRelaxSession ? "health" : "neutral");
      createSemanticChip(dayFlowStatus, logicalDayInsights.isRollover ? "Past midnight" : "Same calendar day", logicalDayInsights.isRollover ? "alert" : "neutral");
      createSemanticChip(
        dayFlowStatus,
        logicalDayInsights.hasActiveSession
          ? "Session active"
          : logicalDayInsights.inactiveMinutes !== null
            ? `Inactive ${formatMinutesAsHours(logicalDayInsights.inactiveMinutes)}`
            : "No activity yet",
        logicalDayInsights.hasActiveSession ? "capture" : logicalDayInsights.inactiveMinutes !== null && logicalDayInsights.inactiveMinutes >= 120 ? "alert" : "neutral"
      );

      const dayPromptSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-prompts", "Auto prompts", "Automatic nudges help you end an inactive day cleanly and warn when you are still logging to yesterday after midnight.");
      if (logicalDayInsights.prompts.length === 0) {
        dayPromptSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No automatic day-end or rollover prompts right now." });
      } else {
        logicalDayInsights.prompts.forEach((prompt) => {
          const row = dayPromptSection.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, prompt.kind === "late-night-warning" ? "Rollover" : "Inactivity", prompt.tone);
          copy.createEl("strong", { text: prompt.title });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: prompt.description });

          const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(actions, "End day", async () => this.plugin.endLogicalDay(), false, "moon-star");
          createButton(actions, "Repair day", async () => this.plugin.openLogicalDayRepairFlow(), false, "wrench");
        });
      }

      const dayFlowMetrics = this.createCollapsibleSubsection(dayFlowCard, "day-flow-metrics", "Tracked metrics", "Wake, sleep, live sessions, and session totals for the active logical day.");
      const dayFlowGrid = dayFlowMetrics.createDiv({ cls: "daily-dashboard-dayflow-grid" });
      this.renderDayMetric(dayFlowGrid, "Wake", todayEntry.wakeTime || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Sleep", todayEntry.sleepTime || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Day start", todayEntry.dayStartedAt || "Not started yet");
      this.renderDayMetric(dayFlowGrid, "Day end", todayEntry.dayEndedAt || "Not ended yet");
      this.renderDayMetric(dayFlowGrid, "Tracked sleep", formatMinutesAsHours(trackedSleepMinutes));
      this.renderDayMetric(dayFlowGrid, "Last activity", logicalDayInsights.lastActivityAt ? formatSyncTimestamp(logicalDayInsights.lastActivityAt) : "No activity yet");
      this.renderDayMetric(dayFlowGrid, "Inactive for", logicalDayInsights.hasActiveSession ? "Live session active" : logicalDayInsights.inactiveMinutes !== null ? formatMinutesAsHours(logicalDayInsights.inactiveMinutes) : "No activity yet");
      this.renderDayMetric(dayFlowGrid, "Last edited", formatSyncTimestamp(todayEntry.lastEditedAt));
      this.renderDayMetric(dayFlowGrid, "Archived tasks", `${todayEntry.completedTasks.length}`);

      const bowelSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-bowel", "Bowel tracking", "Keep bowel sessions, duration, and quality tags together instead of mixing them into the generic metrics summary.");
      const bowelSummary = bowelSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(bowelSummary, `${trackedPoopCount} session${trackedPoopCount === 1 ? "" : "s"}`, trackedPoopCount > 0 ? "alert" : "neutral");
      createSemanticChip(bowelSummary, `Tracked ${formatMinutesAsHours(trackedPoopMinutes)}`, trackedPoopMinutes > 0 ? "alert" : "neutral");
      createSemanticChip(bowelSummary, activePoopSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(new Date())))}` : "No live session", activePoopSession ? "alert" : "neutral");
      if (todayEntry.poopSessions.length === 0) {
        bowelSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No bowel sessions tracked for this logical day yet." });
      } else {
        const bowelQualityList = bowelSection.createDiv({ cls: "daily-dashboard-project-list" });
        todayEntry.poopSessions.slice().reverse().slice(0, 5).forEach((session) => {
          const row = bowelQualityList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `Bowel session ${session.start.slice(11, 16)}${session.end ? `-${session.end.slice(11, 16)}` : ""}` });
          row.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Duration ${session.end ? formatMinutesAsHours(getMinutesBetween(session.start, session.end)) : "In progress"} • Quality: ${todayEntry.poopQualityByStart[session.start] || "Not tagged"}`
          });
          const controls = row.createDiv({ cls: "daily-dashboard-habit-controls" });
          ["easy", "normal", "strained", "urgent", "loose"].forEach((quality) => {
            const button = controls.createEl("button", {
              cls: todayEntry.poopQualityByStart[session.start] === quality ? "daily-dashboard-step is-active" : "daily-dashboard-step",
              text: quality
            });
            button.type = "button";
            button.addEventListener("click", () => {
              void this.plugin.updatePoopQuality(session.start, todayEntry.poopQualityByStart[session.start] === quality ? "" : quality);
            });
          });
        });
      }

      const timeAllocationSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-allocation", "Time allocation", "See where today is accounted for, what is still untracked, and why the unknown bucket is large when it is.");
      const allocationChips = timeAllocationSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(allocationChips, `Unknown ${formatMinutesAsHours(timeAllocationInsights.fullDayUnknownMinutes)}`, timeAllocationInsights.fullDayUnknownMinutes >= 360 ? "alert" : "neutral");
      createSemanticChip(allocationChips, timeAllocationInsights.awakeUnknownMinutes !== null ? `Untracked awake ${formatMinutesAsHours(timeAllocationInsights.awakeUnknownMinutes)}` : "Awake window unknown", (timeAllocationInsights.awakeUnknownMinutes ?? 0) >= 180 ? "alert" : timeAllocationInsights.awakeUnknownMinutes !== null ? "neutral" : "log");
      createSemanticChip(allocationChips, `Tracked awake ${formatMinutesAsHours(timeAllocationInsights.trackedAwakeMinutes)}`, "capture");
      const allocationGrid = timeAllocationSection.createDiv({ cls: "daily-dashboard-dayflow-grid daily-dashboard-dayflow-grid--allocation" });
      this.renderDayMetric(allocationGrid, "Awake window", timeAllocationInsights.awakeWindowMinutes !== null ? formatMinutesAsHours(timeAllocationInsights.awakeWindowMinutes) : "Not enough timestamps");
      this.renderDayMetric(allocationGrid, "Tracked awake", formatMinutesAsHours(timeAllocationInsights.trackedAwakeMinutes));
      this.renderDayMetric(allocationGrid, "Full-day unknown", formatMinutesAsHours(timeAllocationInsights.fullDayUnknownMinutes));
      this.renderDayMetric(allocationGrid, "Sleep total", formatMinutesAsHours(timeAllocationInsights.sleepMinutes));
      const allocationBuckets = timeAllocationSection.createDiv({ cls: "daily-dashboard-chip-row" });
      timeAllocationInsights.buckets
        .sort((left, right) => right.minutes - left.minutes)
        .forEach((bucket) => {
          createSemanticChip(allocationBuckets, `${bucket.label} ${formatMinutesAsHours(bucket.minutes)}`, bucket.tone);
        });
      if (timeAllocationInsights.diagnostics.length > 0) {
        const diagnosisList = timeAllocationSection.createDiv({ cls: "daily-dashboard-project-list" });
        timeAllocationInsights.diagnostics.forEach((diagnosis) => {
          const row = diagnosisList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: diagnosis });
        });
      }

      const timelineSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-live-strip", "Live timeline", "See the current logical day as a strip of tracked sessions so gaps and overlaps are obvious immediately.");
      this.renderTimelineStrip(
        timelineSection,
        this.buildTimelineSessions(todayEntry),
        todayEntry.date,
        dayState.status === "in-progress" && dayState.activeDate === todayEntry.date ? formatDateTimeKey(new Date()) : (todayEntry.dayEndedAt || todayEntry.sleepTime || formatDateTimeKey(new Date())),
        "No tracked sessions yet for this logical day."
      );

      const routineSection = this.createCollapsibleSubsection(dayFlowCard, "day-flow-routines", "Routine windows", "Recurring prompts tied to time windows so the dashboard can nudge the right routine at the right part of the day.");
      const routineTemplates = this.plugin.getRoutineTemplates();
      const dismissedRoutineIds = getDismissedRoutineState(todayEntry.date);
      const currentMinutes = getClockMinutes(new Date());
      const visibleRoutines = routineTemplates.filter((template) => !dismissedRoutineIds.has(template.id));
      if (visibleRoutines.length === 0) {
        routineSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No routine templates left for this day. Add definitions in settings or clear daily dismissals tomorrow." });
      } else {
        const routineList = routineSection.createDiv({ cls: "daily-dashboard-project-list" });
        visibleRoutines.forEach((template) => {
          const startMinutes = getClockMinutes(template.startTime);
          const endMinutes = getClockMinutes(template.endTime);
          const isActiveWindow = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
          const isUpcoming = currentMinutes < startMinutes;
          const row = routineList.createDiv({ cls: "daily-dashboard-project-row" });
          const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, `${template.startTime}-${template.endTime}`, isActiveWindow ? "focus" : isUpcoming ? "neutral" : "done");
          createSemanticChip(chipRow, isActiveWindow ? "Due now" : isUpcoming ? "Later today" : "Window passed", isActiveWindow ? "alert" : isUpcoming ? "neutral" : "done");
          row.createEl("strong", { text: template.label });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: isActiveWindow ? "Inside the active time window." : isUpcoming ? `Starts in ${formatMinutesAsHours(Math.max(0, startMinutes - currentMinutes))}.` : "Still available as a reference, but the target window has already passed." });
          const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(actions, "Queue next up", async () => this.plugin.addNextUpFocusItem({ text: template.label }), false, "plus-circle");
          createButton(actions, "Done today", async () => {
            setDismissedRoutine(todayEntry.date, template.id);
            await this.render();
          }, false, "check");
        });
      }

      const focusCard = createGridCard("Top 3 For Today", "Keep today concrete with just three active focus items.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const dismissedReminderIds = getDismissedReminderState(todayEntry.date);
      const focusDisplayItems = this.plugin.getFocusDisplayItems(calendarSnapshot)
        .filter((item) => item.kind !== "reminder" || !dismissedReminderIds.has(item.id));
      const activeFocusCount = todayEntry.todayFocus.filter((item) => item.status !== "done").length;
      if (suggestedTop3.length > 0) {
        const suggestedSection = this.createCollapsibleSubsection(focusCard, "focus-suggestions", "Suggested Top 3", "Generate today from calendar commitments, stale projects, and due work instead of staring at a blank list.");
        const suggestionActions = suggestedSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(suggestionActions, "Use best fit", async () => {
          const openSlots = Math.max(0, 3 - activeFocusCount);
          for (const candidate of suggestedTop3.slice(0, openSlots)) {
            await this.plugin.addTodayFocusItemWithDetails({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
          }
          await this.render();
        }, activeFocusCount >= 3, "sparkles");

        const suggestionList = suggestedSection.createDiv({ cls: "daily-dashboard-project-list" });
        suggestedTop3.forEach((candidate) => {
          const row = suggestionList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, this.getSuggestedTop3SourceLabel(candidate), this.getSuggestedTop3Tone(candidate));
          if (candidate.estimateMinutes) {
            createSemanticChip(chipRow, formatMinutesAsHours(candidate.estimateMinutes), "neutral");
          }
          copy.createEl("strong", { text: candidate.text });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: candidate.reason });
          if (candidate.notes) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: candidate.notes });
          }
          const controls = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(controls, "Top 3", async () => {
            await this.plugin.addTodayFocusItemWithDetails({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
            await this.render();
          }, activeFocusCount >= 3, "plus-circle");
          createButton(controls, "Next Up", async () => {
            await this.plugin.addNextUpFocusItem({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
            await this.render();
          }, false, "list-plus");
          createButton(controls, "Block", async () => {
            await this.plugin.addFocusBlockToCalendar({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes,
              date: candidate.calendarDate ?? todayEntry.date
            });
            await this.render();
          }, false, "calendar-plus");
        });
      }
      const focusList = focusCard.createDiv({ cls: "daily-dashboard-focus-list" });
      focusCard.createEl("span", { cls: "daily-dashboard-row-meta", text: "Drag Top 3 rows to reprioritize them without deleting and recreating items." });
      if (focusDisplayItems.length === 0) {
        const emptyState = focusList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No focus items yet. Pull one from a project or let AI draft your starting plan." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "AI morning brief", async () => this.plugin.generateAiMorningStartupBrief(), false, "sparkles");
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
              const relatedProjectName = item.projectName || this.selectedSessionProjectName;
              createButton(controls, `Start${relatedProjectName ? ` • ${relatedProjectName}` : ""}`, async () => this.plugin.startTodayFocusItem(focusIndex, "", relatedProjectName), false, "play");
            }
            if (!isEditingFocus) {
              createButton(controls, "Details", async () => {
                new FocusCaptureModal(this.app, {
                  mode: "edit",
                  todayHasTop3Capacity: true,
                  availableProjectNames: projects.map((project) => project.name),
                  initialText: item.text,
                  initialProjectName: item.projectName,
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
              createButton(controls, "Block", async () => {
                await this.plugin.addFocusBlockToCalendar({
                  text: item.text,
                  notes: item.notes,
                  estimateMinutes: item.estimateMinutes,
                  date: todayEntry.date
                });
                await this.render();
              }, item.status === "done", "calendar-plus");
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
                const removedItem = cloneTodayFocusItem(item);
                void this.runDestructiveAction(
                  `Removed Top 3 item \"${item.text}\".`,
                  async () => this.plugin.removeTodayFocusItem(focusIndex),
                  async () => this.plugin.restoreTodayFocusItem(removedItem, focusIndex)
                );
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
      const focusProjectSelect = focusAddRow.createEl("select", { cls: "daily-dashboard-input" });
      const focusNoProjectOption = focusProjectSelect.createEl("option", { text: "No project" });
      focusNoProjectOption.value = "";
      projects.forEach((project) => {
        const option = focusProjectSelect.createEl("option", { text: project.name });
        option.value = project.name;
      });
      focusProjectSelect.value = this.selectedFocusProjectName;
      focusProjectSelect.addEventListener("change", () => {
        this.selectedFocusProjectName = focusProjectSelect.value;
      });
      const focusButton = focusAddRow.createEl("button", { cls: "daily-dashboard-primary-button", text: "Add" });
      focusButton.type = "button";
      const submitFocus = async (): Promise<void> => {
        const value = focusInput.value.trim();
        if (!value) {
          return;
        }
        await this.plugin.addTodayFocusItemWithDetails({ text: value, projectName: this.selectedFocusProjectName });
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
              item.projectName ? `Project ${item.projectName}` : "No project",
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
          createButton(controls, "Block", async () => {
            await this.plugin.addFocusBlockToCalendar({
              text: item.text,
              notes: item.notes,
              estimateMinutes: item.estimateMinutes,
              date: todayEntry.date
            });
            await this.render();
          }, false, "calendar-plus");
          createButton(controls, "Edit", async () => {
            new FocusCaptureModal(this.app, {
              mode: "capture",
              todayHasTop3Capacity: true,
              availableProjectNames: projects.map((project) => project.name),
              initialText: item.text,
              initialProjectName: item.projectName,
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
            const removedItem = cloneNextUpFocusItem(item);
            await this.runDestructiveAction(
              `Removed queued item \"${item.text}\".`,
              async () => this.plugin.removeNextUpFocusItem(index),
              async () => this.plugin.restoreNextUpFocusItem(removedItem, index)
            );
          }, false, "x");
        });
      }
      const nextUpActions = nextUpSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(nextUpActions, "Add next up", async () => {
        new FocusCaptureModal(this.app, {
          mode: "capture",
          todayHasTop3Capacity: true,
          availableProjectNames: projects.map((project) => project.name),
          initialDestination: "next-up",
          submitLabel: "Queue item",
          onSubmit: async (payload) => {
            await this.plugin.addNextUpFocusItem(payload);
            await this.render();
          }
        }).open();
      }, false, "list-plus");
      this.renderMonthlyCalendar(focusCalendarSection, todayEntry.date, settings.calendarEnabled);

      const stateCard = createGridCard("Vitals", "Log mood, energy, symptoms, and friction while the day is still readable.", {
        icon: "activity",
        eyebrow: "State",
        tone: "state",
        tag: "Context"
      });
      const moodTimelineSection = this.createCollapsibleSubsection(stateCard, "state-mood-timeline", "Mood timeline", "Track mood as it changes through the day and label the feeling instead of relying on one final score.");
      const moodSummary = moodTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(moodSummary, todayEntry.moodCheckIns.length > 0 ? `${todayEntry.moodCheckIns.length} check-ins` : "No check-ins", todayEntry.moodCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(moodSummary, moodCheckInAverage ? `Avg ${moodCheckInAverage}/5` : "No average yet", moodCheckInAverage ? "health" : "neutral");
      createSemanticChip(moodSummary, latestMoodCheckIn?.feeling ? latestMoodCheckIn.feeling : "No feeling logged", latestMoodCheckIn?.feeling ? "focus" : "neutral");
      const moodInputRow = moodTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--state-checkin" });
      const moodFeelingInput = moodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Feeling label, e.g. calm, flat, wired" }
      });
      const moodNoteInput = moodInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note for this mood check-in" }
      });
      const moodButtons = moodTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = moodButtons.createEl("button", { cls: "daily-dashboard-step", text: `${score}` });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addMoodCheckIn(score, moodFeelingInput.value, moodNoteInput.value).then(async () => {
            moodFeelingInput.value = "";
            moodNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.moodCheckIns.length === 0) {
        moodTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: todayEntry.moodScore > 0 ? `Legacy mood summary: ${todayEntry.moodScore}/5. Start timeline check-ins to replace single-score tracking.` : "No mood timeline yet. Use a feeling label and a 1-5 score to log how the day actually felt." });
      } else {
        const moodList = moodTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.moodCheckIns.slice(0, 6).forEach((item, index) => {
          const row = moodList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 mood${item.feeling ? ` • ${item.feeling}` : ""}` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeMoodCheckIn(index);
          });
        });
      }

      const energyTimelineSection = this.createCollapsibleSubsection(stateCard, "state-energy-timeline", "Energy timeline", "Drop quick energy check-ins through the day instead of relying on one end-of-day memory.");
      const energySummary = energyTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(energySummary, todayEntry.energyCheckIns.length > 0 ? `${todayEntry.energyCheckIns.length} check-ins` : "No check-ins", todayEntry.energyCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(energySummary, energyCheckInAverage ? `Avg ${energyCheckInAverage}/5` : "No average yet", energyCheckInAverage ? "health" : "neutral");
      createSemanticChip(energySummary, latestEnergyCheckIn ? `Latest ${latestEnergyCheckIn.score}/5` : "No latest yet", latestEnergyCheckIn ? "focus" : "neutral");
      const energyInputRow = energyTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--energy" });
      const energyNoteInput = energyInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note for this check-in" }
      });
      const energyButtons = energyTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = energyButtons.createEl("button", {
          cls: "daily-dashboard-step",
          text: `${score}`
        });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addEnergyCheckIn(score, energyNoteInput.value).then(async () => {
            energyNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.energyCheckIns.length === 0) {
        energyTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: "No energy timeline yet. Use the 1-5 buttons to log the current state with an optional note." });
      } else {
        const energyList = energyTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.energyCheckIns.slice(0, 6).forEach((item, index) => {
          const row = energyList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 energy` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeEnergyCheckIn(index);
          });
        });
      }

      const anxietyTimelineSection = this.createCollapsibleSubsection(stateCard, "state-anxiety-timeline", "Anxiety timeline", "Log anxiety spikes or calm resets as they happen instead of compressing the whole day into one number.");
      const anxietySummary = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(anxietySummary, todayEntry.anxietyCheckIns.length > 0 ? `${todayEntry.anxietyCheckIns.length} check-ins` : "No check-ins", todayEntry.anxietyCheckIns.length > 0 ? "state" : "neutral");
      createSemanticChip(anxietySummary, anxietyCheckInAverage ? `Avg ${anxietyCheckInAverage}/5` : "No average yet", anxietyCheckInAverage ? "alert" : "neutral");
      createSemanticChip(anxietySummary, latestAnxietyCheckIn ? `Latest ${latestAnxietyCheckIn.score}/5` : "No latest yet", latestAnxietyCheckIn ? "alert" : "neutral");
      const anxietyInputRow = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--energy" });
      const anxietyNoteInput = anxietyInputRow.createEl("input", {
        cls: "daily-dashboard-input",
        attr: { type: "text", placeholder: "Optional note about what is driving this level" }
      });
      const anxietyButtons = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-habit-controls" });
      for (let score = 1; score <= 5; score += 1) {
        const button = anxietyButtons.createEl("button", { cls: "daily-dashboard-step", text: `${score}` });
        button.type = "button";
        button.addEventListener("click", () => {
          void this.plugin.addAnxietyCheckIn(score, anxietyNoteInput.value).then(async () => {
            anxietyNoteInput.value = "";
            await this.render();
          });
        });
      }
      if (todayEntry.anxietyCheckIns.length === 0) {
        anxietyTimelineSection.createDiv({ cls: "daily-dashboard-row-meta", text: todayEntry.anxietyScore > 0 ? `Legacy anxiety summary: ${todayEntry.anxietyScore}/5. Start timeline check-ins to replace single-score tracking.` : "No anxiety timeline yet. Use the 1-5 buttons with an optional note when anxiety changes." });
      } else {
        const anxietyList = anxietyTimelineSection.createDiv({ cls: "daily-dashboard-food-list" });
        todayEntry.anxietyCheckIns.slice(0, 6).forEach((item, index) => {
          const row = anxietyList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--energy" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.score}/5 anxiety` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.loggedAt || "Time unknown" });
          if (item.note) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.note });
          }
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: renderScore(item.score) });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            void this.plugin.removeAnxietyCheckIn(index);
          });
        });
      }

      stateCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Friction log" });
      const frictionInput = stateCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      frictionInput.value = todayEntry.frictionLog;
      frictionInput.placeholder = "Blockers, pain points, context switching, or anything that made the day harder.";
      frictionInput.addEventListener("change", () => {
        void this.plugin.updateFrictionLog(frictionInput.value);
      });

      const symptomsSection = this.createCollapsibleSubsection(stateCard, "state-symptoms", "Symptoms", "Track pain, symptoms, and likely triggers before the context gets flattened later.");
      const symptomSummary = symptomsSection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(symptomSummary, todayEntry.symptomLog.length > 0 ? `${todayEntry.symptomLog.length} logged` : "No symptoms", todayEntry.symptomLog.length > 0 ? "health" : "neutral");
      createSemanticChip(symptomSummary, todayEntry.symptomLog[0] ? `${todayEntry.symptomLog[0].severity}/5 latest` : "No severity yet", todayEntry.symptomLog[0] ? "alert" : "neutral");
      const symptomForm = symptomsSection.createDiv({ cls: "daily-dashboard-stacked-form" });
      const symptomInput = symptomForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Headache, nausea, back pain..." } });
      const symptomMeta = symptomForm.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
      const symptomSeverity = symptomMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", max: "5", value: "3" } });
      const symptomNote = symptomMeta.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional trigger or context" } });
      const symptomButtons = symptomsSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(symptomButtons, "Log symptom", async () => {
        await this.plugin.addSymptomEntry(symptomInput.value, Number(symptomSeverity.value), symptomNote.value);
        symptomInput.value = "";
        symptomSeverity.value = "3";
        symptomNote.value = "";
      }, false, "heart-pulse");
      const symptomList = symptomsSection.createDiv({ cls: "daily-dashboard-project-list" });
      if (todayEntry.symptomLog.length === 0) {
        symptomList.createDiv({ cls: "daily-dashboard-empty-state", text: "No symptoms or pain logged today." });
      } else {
        todayEntry.symptomLog.slice(0, 10).forEach((item, index) => {
          const row = symptomList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `${item.symptom} • ${item.severity}/5` });
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: `${item.loggedAt}${item.note ? ` • ${item.note}` : ""}` });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("click", () => {
            const removedItem = { ...item } satisfies SymptomEntry;
            void this.runDestructiveAction(
              `Removed symptom entry \"${item.symptom}\".`,
              async () => this.plugin.removeSymptomEntry(index),
              async () => this.plugin.restoreSymptomEntry(removedItem, index)
            );
          });
        });
      }

      const gamificationCard = createGridCard("Gamification Center", "Turn execution, health, consistency, recovery, and planning into auditable scores instead of vague impressions.", {
        icon: "trophy",
        eyebrow: "Scores",
        tone: "done",
        tag: gamificationSummary.model === "deterministic" ? "Deterministic" : "Scored"
      });
      const gamificationSummaryRow = gamificationCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(gamificationSummaryRow, `Today ${gamificationSummary.today.score}/100 ${gamificationSummary.today.grade}`, gamificationSummary.today.score >= 80 ? "done" : gamificationSummary.today.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Week ${gamificationSummary.week.score}/100 ${gamificationSummary.week.grade}`, gamificationSummary.week.score >= 80 ? "done" : gamificationSummary.week.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Month ${gamificationSummary.month.score}/100 ${gamificationSummary.month.grade}`, gamificationSummary.month.score >= 80 ? "done" : gamificationSummary.month.score >= 60 ? "state" : "alert");
      createSemanticChip(gamificationSummaryRow, `Streak ${gamificationSummary.currentStreak}`, gamificationSummary.currentStreak >= 3 ? "focus" : "neutral");
      createSemanticChip(gamificationSummaryRow, `Best ${gamificationSummary.bestStreak}`, gamificationSummary.bestStreak >= 5 ? "done" : "neutral");
      const gamificationStats = gamificationCard.createDiv({ cls: "daily-dashboard-dayflow-grid daily-dashboard-dayflow-grid--recovery" });
      this.renderDayMetric(gamificationStats, "Personal best", `${gamificationSummary.personalBestDayScore}/100`);
      this.renderDayMetric(gamificationStats, "Best day", gamificationSummary.personalBestDayLabel);
      this.renderDayMetric(gamificationStats, "Recovery run", `${gamificationSummary.recoveryFromLowScoreDays} days`);
      this.renderDayMetric(gamificationStats, "Low-score line", `${gamificationSummary.lowScoreThreshold}/100`);
      const gamificationSnapshots = gamificationCard.createDiv({ cls: "daily-dashboard-gamification-snapshots" });
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.today);
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.week);
      renderGamificationSnapshotCard(gamificationSnapshots, gamificationSummary.month);
      const gamificationActions = gamificationCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(gamificationActions, "Gamification report", async () => this.plugin.generateGamificationReport(), false, "trophy");
      createButton(gamificationActions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");

      const habitsCard = createGridCard("Habits", "Repeatables with misses and timing kept visible.", {
        icon: "check-square",
        eyebrow: "Routines",
        tone: "state",
        tag: "Track"
      });
      const habitActions = habitsCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(habitActions, "Add habit", async () => this.plugin.openAddHabitFlow(), false, "plus-circle");
      const habitSummary = getHabitWeightedCompletion(todayEntry, this.plugin.getHabitDefinitions());
      const habitSummaryChips = habitsCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(habitSummaryChips, `${habitSummary.percentage}% weighted completion`, habitSummary.percentage >= 80 ? "done" : habitSummary.percentage >= 55 ? "state" : "alert");
      createSemanticChip(habitSummaryChips, `${todayEntry.missedHabits.length} misses`, todayEntry.missedHabits.length === 0 ? "done" : "alert");
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit, habitIndex) => {
        const currentValue = todayEntry.habits[habit.id] ?? 0;
        const habitEvents = todayEntry.habitEvents[habit.id] ?? [];
        const inWindowCount = countHabitEventsInWindow(habitEvents, habit.completionWindow);
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        copy.createEl("strong", { text: habit.label });
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${currentValue}/${habit.target} done • ${this.plugin.getHabitStreak(habit.id)} due-day streak • best ${this.plugin.getHabitBestStreak(habit.id)} • ${formatHabitCadenceLabel(habit.cadence)} • ${formatHabitWindowLabel(habit.completionWindow)} • difficulty ${habit.difficultyWeight}/3${isHabitDueOnDate(habit, todayEntry.date) ? "" : " • not due today"}`
        });
        if (habitEvents.length > 0) {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Today at ${habitEvents.map((item) => item.slice(11)).join(", ")} • in-window ${inWindowCount}/${habitEvents.length}`
          });
        } else {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `${formatHabitCadenceLabel(habit.cadence)} • Window ${formatHabitWindowLabel(habit.completionWindow)} • no completions yet${isHabitDueOnDate(habit, todayEntry.date) ? "" : " • not due today"}`
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
          const removedHabit = { ...habit };
          if (this.plugin.getHabitDefinitions().length <= 1) {
            void this.plugin.removeHabitDefinition(habit.id);
            return;
          }

          void this.runDestructiveAction(
            `Removed habit \"${habit.label}\".`,
            async () => this.plugin.removeHabitDefinition(habit.id),
            async () => this.plugin.restoreHabitDefinition(removedHabit, habitIndex)
          );
        });
        if (currentValue < habit.target || (todayEntry.habitMissNotes[habit.id] ?? "").length > 0) {
          const missNote = row.createEl("input", {
            cls: "daily-dashboard-input",
            attr: { type: "text", placeholder: `Miss note for ${habit.label}` }
          });
          missNote.value = todayEntry.habitMissNotes[habit.id] ?? "";
          missNote.addEventListener("change", () => {
            void this.plugin.updateHabitMissNote(habit.id, missNote.value);
          });
        }
      });

      const foodCard = createGridCard("Consumables", "Track drinks, food, medication, and supplements in one place with usable amounts and timestamps.", {
        icon: "utensils-crossed",
        eyebrow: "Body",
        tone: "log",
        tag: "Log"
      });
      const measurementSystem = settings.measurementSystem;
      const intakeEntries = todayEntry.intakeLog;
      const consumableSummary = Array.from(
        intakeEntries.reduce((groups, item) => {
          const key = `${item.kind}::${item.label.toLowerCase()}::${item.unit.toLowerCase()}`;
          const current = groups.get(key) ?? { ...item, totalAmount: 0, count: 0 };
          current.totalAmount += item.amount;
          current.count += 1;
          current.loggedAt = current.loggedAt > item.loggedAt ? current.loggedAt : item.loggedAt;
          groups.set(key, current);
          return groups;
        }, new Map<string, IntakeEntry & { totalAmount: number; count: number }>()).values()
      );
      const intakeForm = foodCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const intakeKind = intakeForm.createEl("select", { cls: "daily-dashboard-input" });
      [["drink", "Drink"], ["food", "Food"], ["medication", "Medication"], ["supplement", "Supplement"]].forEach(([value, label]) => {
        const option = intakeKind.createEl("option", { text: label });
        option.value = value;
      });
      const intakeLabel = intakeForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "What did you have?" } });
      const intakeMeta = intakeForm.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
      const intakeAmount = intakeMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0.1", step: "0.1", value: "1" } });
      const intakeUnit = intakeMeta.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "mL, can, slice, pill, serving" } });
      intakeUnit.value = getDefaultIntakeUnit(intakeKind.value, measurementSystem);
      intakeKind.addEventListener("change", () => {
        intakeUnit.value = getDefaultIntakeUnit(intakeKind.value, measurementSystem);
      });
      const intakeNote = intakeForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional note" } });
      const intakeButtons = foodCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(intakeButtons, "Add entry", async () => {
        const resolvedUnit = resolveIntakeUnitValue(intakeUnit.value, intakeKind.value, measurementSystem);
        await this.plugin.addIntakeEntry(intakeKind.value, intakeLabel.value, Number(intakeAmount.value), resolvedUnit, intakeNote.value);
        intakeLabel.value = "";
        intakeAmount.value = "1";
        intakeUnit.value = getDefaultIntakeUnit(intakeKind.value, measurementSystem);
        intakeNote.value = "";
      }, false, "plus-circle");
      createButton(intakeButtons, "Save preset", async () => {
        const trimmedLabel = intakeLabel.value.trim();
        const trimmedUnit = resolveIntakeUnitValue(intakeUnit.value, intakeKind.value, measurementSystem);
        if (!trimmedLabel || !trimmedUnit) {
          return;
        }

        const nextPreset = buildIntakeQuickPreset({
          kind: intakeKind.value,
          label: trimmedLabel,
          amount: Number(intakeAmount.value),
          unit: trimmedUnit
        });
        const nextPresets = [...settings.intakeQuickPresets.filter((preset) => preset.id !== nextPreset.id), nextPreset];
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          intakeQuickPresets: nextPresets
        });
        await this.render();
      }, false, "bookmark-plus");
      const foodInsight = foodCard.createDiv({ cls: "daily-dashboard-score-block daily-dashboard-food-insight" });
      foodInsight.createEl("strong", { text: "Diet insight" });
      foodInsight.createEl("span", {
        cls: "daily-dashboard-habit-meta",
        text: todayEntry.dietInsight || "Run a quick AI pass to estimate calories and flag the biggest nutrition signals for today."
      });
      const foodInsightActions = foodInsight.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(foodInsightActions, aiStatus.busy ? "Analyzing..." : "Analyze diet", async () => this.plugin.generateDailyDietInsight(), true, "sparkles");
      if (settings.intakeQuickPresets.length > 0) {
        const intakePresetRow = foodCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-intake-presets" });
        settings.intakeQuickPresets.forEach((preset) => {
          const presetWrap = intakePresetRow.createDiv({ cls: "daily-dashboard-inline-action-pair" });
          createButton(presetWrap, formatIntakeQuickPresetButtonLabel(preset), async () => {
            await this.plugin.addIntakeEntry(preset.kind, preset.label, preset.amount, preset.unit);
          }, false, getIntakePresetIcon(preset.kind));
          const removeButton = presetWrap.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-inline-remove-button" });
          removeButton.type = "button";
          removeButton.ariaLabel = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          removeButton.title = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          setIcon(removeButton, "x");
          removeButton.addEventListener("click", () => {
            void this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              intakeQuickPresets: this.plugin.getSettings().intakeQuickPresets.filter((item) => item.id !== preset.id)
            }).then(async () => this.render());
          });
        });
      }
      const intakeList = foodCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (intakeEntries.length === 0) {
        const emptyState = intakeList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No consumables logged yet today. Use one flow for drinks, food, meds, and supplements so totals stay analyzable." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Water", async () => this.plugin.addIntakeEntry("drink", "Water", measurementSystem === "metric" ? 250 : 8, getDefaultIntakeUnit("drink", measurementSystem)), false, "glass-water");
        createButton(emptyActions, "Meal", async () => this.plugin.addIntakeEntry("food", "Meal", 1, "serving"), false, "utensils-crossed");
        createButton(emptyActions, "Medication", async () => this.plugin.addIntakeEntry("medication", "Medication", 1, "pill"), false, "pill");
      } else {
        intakeEntries.slice(0, 18).forEach((item, index) => {
          const row = intakeList.createDiv({ cls: "daily-dashboard-food-row" });
          row.addClass("daily-dashboard-food-row--compact");
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: `${item.kind} • ${item.label}` });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `${item.amount} ${item.unit} • ${item.loggedAt || "Time unknown"}${item.note ? ` • ${item.note}` : ""}` });
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          const amountInput = amountSlot.createEl("input", {
            cls: "daily-dashboard-amount-input",
            attr: { type: "number", min: "0.1", step: "0.1", value: `${item.amount}`, ariaLabel: `Amount for ${item.label}` }
          });
          amountInput.addEventListener("change", () => {
            void this.plugin.updateIntakeEntryAmount(index, Number(amountInput.value));
          });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          setIcon(removeButton, "x");
          removeButton.addEventListener("click", () => {
            const removedItem = { ...item } satisfies IntakeEntry;
            void this.runDestructiveAction(
              `Removed ${item.kind} entry \"${item.label}\".`,
              async () => this.plugin.removeIntakeEntry(index),
              async () => this.plugin.restoreIntakeEntry(removedItem, index)
            );
          });
        });
      }

      const weightUnitLabel = settings.measurementSystem === "metric" ? "kg" : "lb";
      const weightHistory = this.plugin.getAllEntries().filter((entry) => typeof entry.bodyWeight === "number");
      const latestLoggedWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].bodyWeight : null;
      const earliestWeightForTrend = weightHistory.length > 1 ? weightHistory[Math.max(0, weightHistory.length - 7)].bodyWeight : null;
      const currentWeight = todayEntry.bodyWeight ?? latestLoggedWeight;
      const targetWeight = settings.weightGoalTarget > 0 ? settings.weightGoalTarget : null;
      const weightDelta = currentWeight !== null && targetWeight !== null ? Number((targetWeight - currentWeight).toFixed(1)) : null;
      const weightTrendDelta = currentWeight !== null && earliestWeightForTrend !== null ? Number((currentWeight - earliestWeightForTrend).toFixed(1)) : null;
      const todayExerciseMinutes = todayEntry.exerciseLog.reduce((sum, item) => sum + item.durationMinutes, 0) + this.plugin.getTrackedActivityMinutes(todayEntry, "exercise");
      const latestExerciseSession = this.plugin.getActiveActivitySession("exercise", todayEntry);
      const exerciseSuggestions: string[] = [];
      if (todayExerciseMinutes > 0 && todayEntry.intakeLog.filter((item) => item.kind === "drink").length === 0) {
        exerciseSuggestions.push("Hydration is missing relative to today's training load.");
      }
      if (todayExerciseMinutes >= 45 && todayEntry.intakeLog.filter((item) => item.kind === "food").length === 0) {
        exerciseSuggestions.push("No recovery meal is logged after a meaningful training block.");
      }
      if (todayExerciseMinutes >= 30 && sleepInsights.debtMinutes >= 180) {
        exerciseSuggestions.push("Sleep debt is high, so recovery work matters more than adding intensity.");
      }
      if (todayExerciseMinutes >= 30 && getHabitWeightedCompletion(todayEntry, this.plugin.getHabitDefinitions()).percentage < 55) {
        exerciseSuggestions.push("Training happened, but the rest of the habit stack is lagging behind recovery-wise.");
      }
      if (weightDelta !== null) {
        if (settings.weightGoalMode === "lose" && weightDelta < 0) {
          exerciseSuggestions.push(`You are ${Math.abs(weightDelta)} ${weightUnitLabel} above the target. Favor consistent training plus logged intake over bigger swings.`);
        } else if (settings.weightGoalMode === "gain" && weightDelta > 0) {
          exerciseSuggestions.push(`You are ${weightDelta} ${weightUnitLabel} below the target. Recovery meals and consistent lifting matter more than random volume.`);
        } else if (settings.weightGoalMode === "maintain" && Math.abs(weightDelta) >= 3) {
          exerciseSuggestions.push(`Weight is drifting ${Math.abs(weightDelta)} ${weightUnitLabel} away from the maintenance target.`);
        }
      }
      const exerciseCard = createGridCard("Exercise & Weight", "Keep training organized and line it up with body-weight goals, recovery, and intake signals.", {
        icon: "dumbbell",
        eyebrow: "Training",
        tone: "health",
        tag: latestExerciseSession ? "Live" : "Recovery"
      });
      const exerciseSummary = exerciseCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(exerciseSummary, `${formatMinutesAsHours(todayExerciseMinutes)} today`, todayExerciseMinutes >= 30 ? "done" : todayExerciseMinutes > 0 ? "health" : "neutral");
      createSemanticChip(exerciseSummary, currentWeight !== null ? `${currentWeight} ${weightUnitLabel}` : "No weight logged", currentWeight !== null ? "focus" : "neutral");
      createSemanticChip(exerciseSummary, targetWeight !== null ? `${settings.weightGoalMode} to ${targetWeight} ${weightUnitLabel}` : "No target", targetWeight !== null ? "capture" : "neutral");
      createSemanticChip(exerciseSummary, weightTrendDelta !== null ? `${weightTrendDelta > 0 ? "+" : ""}${weightTrendDelta} ${weightUnitLabel} / 7 entries` : "No trend yet", weightTrendDelta !== null ? "log" : "neutral");
      const exerciseGoalForm = exerciseCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const exerciseGoalRow = exerciseGoalForm.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const bodyWeightInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", step: "0.1", placeholder: `Today's ${weightUnitLabel}` } });
      bodyWeightInput.value = todayEntry.bodyWeight !== null ? `${todayEntry.bodyWeight}` : "";
      const targetWeightInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0", step: "0.1", placeholder: `Target ${weightUnitLabel}` } });
      targetWeightInput.value = targetWeight !== null ? `${targetWeight}` : "";
      const goalModeSelect = exerciseGoalRow.createEl("select", { cls: "daily-dashboard-input" });
      [["lose", "Lose"], ["maintain", "Maintain"], ["gain", "Gain"]].forEach(([value, label]) => {
        const option = goalModeSelect.createEl("option", { text: label });
        option.value = value;
      });
      goalModeSelect.value = settings.weightGoalMode;
      const weeklyRateInput = exerciseGoalRow.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0", step: "0.1", placeholder: `Weekly ${weightUnitLabel}` } });
      weeklyRateInput.value = `${settings.weightGoalWeeklyRate}`;
      const goalActions = exerciseCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(goalActions, "Save weight goal", async () => {
        await this.plugin.updateBodyWeight(bodyWeightInput.value.trim().length > 0 ? Number(bodyWeightInput.value) : null);
        await this.plugin.updateSettings({
          ...this.plugin.getSettings(),
          weightGoalTarget: Number(targetWeightInput.value || 0),
          weightGoalMode: goalModeSelect.value === "lose" || goalModeSelect.value === "gain" ? goalModeSelect.value : "maintain",
          weightGoalWeeklyRate: Number(weeklyRateInput.value || DEFAULT_SETTINGS.weightGoalWeeklyRate)
        });
        await this.render();
      }, false, "scale");
      createButton(goalActions, latestExerciseSession ? "Stop live exercise" : "Start live exercise", async () => latestExerciseSession ? this.plugin.stopActivitySession("exercise") : this.plugin.startActivitySession("exercise"), latestExerciseSession !== null, latestExerciseSession ? "square" : "play");
      const exerciseForm = exerciseCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      const exerciseLabelInput = exerciseForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Lift, run, walk, mobility, intervals..." } });
      const exerciseMeta = exerciseForm.createDiv({ cls: "daily-dashboard-session-toolbar" });
      const exerciseDurationInput = exerciseMeta.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "1", step: "5", value: latestExerciseSession ? `${Math.max(5, getMinutesBetween(latestExerciseSession.start, formatDateTimeKey(new Date())))}` : "30" } });
      const exerciseIntensitySelect = exerciseMeta.createEl("select", { cls: "daily-dashboard-input" });
      [["easy", "Easy"], ["moderate", "Moderate"], ["hard", "Hard"]].forEach(([value, label]) => {
        const option = exerciseIntensitySelect.createEl("option", { text: label });
        option.value = value;
      });
      const exerciseNoteInput = exerciseForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional note about focus, volume, pain, or effort" } });
      const exerciseActions = exerciseCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(exerciseActions, "Log exercise", async () => {
        await this.plugin.addExerciseEntry(
          exerciseLabelInput.value,
          Number(exerciseDurationInput.value || 0),
          (exerciseIntensitySelect.value === "easy" || exerciseIntensitySelect.value === "hard" ? exerciseIntensitySelect.value : "moderate") as ExerciseIntensity,
          exerciseNoteInput.value,
          latestExerciseSession?.start ?? ""
        );
        exerciseLabelInput.value = "";
        exerciseDurationInput.value = latestExerciseSession ? `${Math.max(5, getMinutesBetween(latestExerciseSession.start, formatDateTimeKey(new Date())))}` : "30";
        exerciseIntensitySelect.value = "moderate";
        exerciseNoteInput.value = "";
      }, false, "plus-circle");
      const exerciseGuidance = exerciseCard.createDiv({ cls: "daily-dashboard-project-list" });
      if (exerciseSuggestions.length === 0) {
        exerciseGuidance.createDiv({ cls: "daily-dashboard-empty-state", text: "No immediate recovery warnings. Keep training and intake consistent enough to make the trend readable." });
      } else {
        exerciseSuggestions.forEach((item) => {
          const row = exerciseGuidance.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: item });
        });
      }
      const exerciseList = exerciseCard.createDiv({ cls: "daily-dashboard-food-list" });
      if (todayEntry.exerciseLog.length === 0) {
        exerciseList.createDiv({ cls: "daily-dashboard-empty-state", text: "No exercise logged today." });
      } else {
        todayEntry.exerciseLog.slice(0, 10).forEach((item, index) => {
          const row = exerciseList.createDiv({ cls: "daily-dashboard-food-row daily-dashboard-food-row--compact" });
          const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
          copy.createEl("strong", { text: item.label });
          copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `${formatMinutesAsHours(item.durationMinutes)} • ${item.intensity} • ${item.loggedAt}${item.note ? ` • ${item.note}` : ""}` });
          const amountSlot = row.createDiv({ cls: "daily-dashboard-food-amount-slot" });
          amountSlot.createEl("span", { cls: "daily-dashboard-habit-meta", text: item.linkedSessionStart ? "Timed" : "Manual" });
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          setIcon(removeButton, "x");
          removeButton.addEventListener("click", () => {
            void this.plugin.removeExerciseEntry(index);
          });
        });
      }

      const notesCard = createGridCard("Sleep And Notes", "Sleep, dreams, and daily notes in one recovery block.", {
        icon: "moon-star",
        eyebrow: "Recovery",
        tone: "log",
        tag: "Journal"
      });
      this.renderScoreControl(notesCard, "Wake quality", todayEntry.wakeQualityScore, (value) => this.plugin.updateWakeQualityScore(value));
      const recoverySection = this.createCollapsibleSubsection(notesCard, "sleep-recovery-summary", "Recovery summary", "Track whether sleep quantity and timing are holding steady over the last week.");
      const recoveryChips = recoverySection.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Debt ${formatMinutesAsHours(sleepInsights.debtMinutes)}` : "No debt data", sleepInsights.debtMinutes >= 180 ? "alert" : sleepInsights.nightsTracked > 0 ? "health" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `${sleepInsights.consistencyScore}/100 ${sleepInsights.consistencyLabel}` : "No consistency data", sleepInsights.consistencyScore >= 70 ? "done" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Avg ${formatMinutesAsHours(sleepInsights.averageSleepMinutes)}` : "No average sleep yet", sleepInsights.averageSleepMinutes >= 420 ? "health" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      createSemanticChip(recoveryChips, sleepInsights.nightsTracked > 0 ? `Recovery ${sleepInsights.averageRecoveryScore}/100 ${sleepInsights.recoveryLabel}` : "No recovery data", sleepInsights.averageRecoveryScore >= 70 ? "done" : sleepInsights.nightsTracked > 0 ? "alert" : "neutral");
      const recoveryGrid = recoverySection.createDiv({ cls: "daily-dashboard-dayflow-grid daily-dashboard-dayflow-grid--recovery" });
      this.renderDayMetric(recoveryGrid, "Nights tracked", `${sleepInsights.nightsTracked}`);
      this.renderDayMetric(recoveryGrid, "Sleep target", formatMinutesAsHours(sleepInsights.targetMinutes));
      this.renderDayMetric(recoveryGrid, "Avg bedtime", sleepInsights.averageBedtime || "Not enough data");
      this.renderDayMetric(recoveryGrid, "Avg wake", sleepInsights.averageWakeTime || "Not enough data");
      this.renderDayMetric(recoveryGrid, "Avg recovery", sleepInsights.nightsTracked > 0 ? `${sleepInsights.averageRecoveryScore}/100` : "No data");
      if (sleepInsights.recentNights.length > 0) {
        const recentNights = recoverySection.createDiv({ cls: "daily-dashboard-project-list" });
        sleepInsights.recentNights.slice().reverse().forEach((night) => {
          const row = recentNights.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("strong", { text: `${night.date} • ${formatMinutesAsHours(night.sleepMinutes)}` });
          row.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Bed ${night.bedtime || "unknown"} • Wake ${night.wakeTime || "unknown"} • Wake quality ${night.wakeQualityScore > 0 ? `${night.wakeQualityScore}/5` : "not logged"} • Recovery ${night.recoveryScore}/100 ${night.recoveryLabel}`
          });
        });
      }
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Sleep log" });
      const sleepInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      sleepInput.value = todayEntry.sleepLog;
      sleepInput.placeholder = "Bedtime, wake time, sleep quality, naps, anything worth tracking.";
      this.initializePersistentTextarea(sleepInput, "sleep-log");
      sleepInput.addEventListener("change", () => {
        void this.plugin.updateSleepLog(sleepInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Dream log" });
      const dreamInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      dreamInput.value = todayEntry.dreamLog;
      dreamInput.placeholder = "Dream fragments, themes, symbols, emotions, or recurring patterns you want the AI to analyze later.";
      this.initializePersistentTextarea(dreamInput, "dream-log");
      dreamInput.addEventListener("change", () => {
        void this.plugin.updateDreamLog(dreamInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Notes for today" });
      const notesInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      notesInput.value = todayEntry.notes;
      notesInput.placeholder = "Wins, blockers, symptoms, context, or anything worth remembering later.";
      this.initializePersistentTextarea(notesInput, "daily-notes");
      notesInput.addEventListener("change", () => {
        void this.plugin.updateDailyNotes(notesInput.value);
      });
      const adaptivePrompts = this.plugin.getAdaptiveReflectionPrompts(todayEntry.date);
      if (adaptivePrompts.length > 0) {
        notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Adaptive reflection prompts" });
        const promptList = notesCard.createDiv({ cls: "daily-dashboard-ai-suggestions" });
        adaptivePrompts.forEach((prompt) => {
          const row = promptList.createDiv({ cls: "daily-dashboard-project-row" });
          row.createEl("span", { text: prompt });
        });
      }
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "What helped today?" });
      const helpedInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      helpedInput.value = todayEntry.helpedToday;
      helpedInput.placeholder = "Small things that improved the day, energy, focus, or recovery.";
      this.initializePersistentTextarea(helpedInput, "helped-today");
      helpedInput.addEventListener("change", () => {
        void this.plugin.updateReflection("helped", helpedInput.value);
      });
      notesCard.createEl("label", { cls: "daily-dashboard-field-label", text: "What hurt today?" });
      const hurtInput = notesCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      hurtInput.value = todayEntry.hurtToday;
      hurtInput.placeholder = "Stressors, pain, missed habits, interruptions, or anything that dragged the day down.";
      this.initializePersistentTextarea(hurtInput, "hurt-today");
      hurtInput.addEventListener("change", () => {
        void this.plugin.updateReflection("hurt", hurtInput.value);
      });

      const timelineCard = createGridCard("Timeline Search", "Search across tasks, sessions, logs, and calendar events from one place instead of hopping between cards.", {
        icon: "scan-search",
        eyebrow: "History",
        tone: "log",
        tag: `${timelineResults.length} matches`
      });
      const timelinePresetRow = timelineCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      const presetSelect = timelinePresetRow.createEl("select", { cls: "daily-dashboard-input" });
      const defaultPresetOption = presetSelect.createEl("option", { text: "Saved dashboard filters" });
      defaultPresetOption.value = "";
      savedDashboardFilters.forEach((filter) => {
        const option = presetSelect.createEl("option", { text: filter.name });
        option.value = filter.name;
        option.selected = filter.name === this.selectedSavedFilterName;
      });
      presetSelect.addEventListener("change", () => {
        if (!presetSelect.value) {
          this.selectedSavedFilterName = "";
          setDashboardSelectedFilterName("");
          return;
        }

        this.applySavedDashboardFilter(presetSelect.value);
        void this.render();
      });
      createButton(timelinePresetRow, "Save current", async () => {
        this.saveCurrentDashboardFilter();
        await this.render();
      }, false, "save");
      createButton(timelinePresetRow, "Delete saved", async () => {
        this.deleteSelectedDashboardFilter();
        await this.render();
      }, false, "trash-2");
      createButton(timelinePresetRow, "Reset", async () => {
        this.resetDashboardFilters();
        await this.render();
      }, false, "rotate-ccw");

      const timelineFilterGrid = timelineCard.createDiv({ cls: "daily-dashboard-stacked-form" });
      this.createFilterInput(timelineFilterGrid, "Keyword", this.timelineFilters.keyword, (value) => {
        this.timelineFilters.keyword = value;
        void this.render();
      });
      const timelineProjectFilter = timelineFilterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allTimelineProjectsOption = timelineProjectFilter.createEl("option", { text: "All projects" });
      allTimelineProjectsOption.value = "";
      projects.forEach((project) => {
        const option = timelineProjectFilter.createEl("option", { text: project.name });
        option.value = project.name;
        option.selected = project.name === this.timelineFilters.project;
      });
      timelineProjectFilter.addEventListener("change", () => {
        this.timelineFilters.project = timelineProjectFilter.value;
        void this.render();
      });
      const timelineTagFilter = timelineFilterGrid.createEl("select", { cls: "daily-dashboard-input" });
      const allTimelineTagsOption = timelineTagFilter.createEl("option", { text: "All tags" });
      allTimelineTagsOption.value = "";
      SESSION_TAG_OPTIONS.forEach((tag) => {
        const option = timelineTagFilter.createEl("option", { text: tag });
        option.value = tag;
        option.selected = tag === this.timelineFilters.tag;
      });
      timelineTagFilter.addEventListener("change", () => {
        this.timelineFilters.tag = timelineTagFilter.value;
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "From date (YYYY-MM-DD)", this.timelineFilters.fromDate, (value) => {
        this.timelineFilters.fromDate = value;
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "To date (YYYY-MM-DD)", this.timelineFilters.toDate, (value) => {
        this.timelineFilters.toDate = value;
        void this.render();
      });
      const notesOnlyLabel = timelineFilterGrid.createEl("label", { cls: "daily-dashboard-row-meta" });
      const notesOnlyCheckbox = notesOnlyLabel.createEl("input", { attr: { type: "checkbox" } });
      notesOnlyCheckbox.checked = this.timelineFilters.onlyWithNotes;
      notesOnlyCheckbox.addEventListener("change", () => {
        this.timelineFilters.onlyWithNotes = notesOnlyCheckbox.checked;
        void this.render();
      });
      notesOnlyLabel.appendText(" Only show items with notes or descriptive detail");
      const timelineKindRow = timelineCard.createDiv({ cls: "daily-dashboard-chip-row" });
      ([
        { key: "task", label: "Tasks" },
        { key: "session", label: "Sessions" },
        { key: "calendar", label: "Calendar" },
        { key: "log", label: "Logs" }
      ] satisfies Array<{ key: TimelineSearchKind; label: string }>).forEach((item) => {
        const button = timelineKindRow.createEl("button", {
          cls: this.timelineFilters.kinds.includes(item.key) ? "daily-dashboard-filter-chip is-active" : "daily-dashboard-filter-chip",
          text: item.label
        });
        button.type = "button";
        button.addEventListener("click", () => {
          if (this.timelineFilters.kinds.includes(item.key)) {
            this.timelineFilters.kinds = this.timelineFilters.kinds.filter((candidate) => candidate !== item.key);
          } else {
            this.timelineFilters.kinds = [...this.timelineFilters.kinds, item.key];
          }
          if (this.timelineFilters.kinds.length === 0) {
            this.timelineFilters.kinds = ["task", "session", "calendar", "log"];
          }
          void this.render();
        });
      });
      const timelineSummary = timelineCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "task").length} tasks`, timelineResults.some((item) => item.kind === "task") ? "done" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "session").length} sessions`, timelineResults.some((item) => item.kind === "session") ? "capture" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "calendar").length} calendar`, timelineResults.some((item) => item.kind === "calendar") ? "focus" : "neutral");
      createSemanticChip(timelineSummary, `${timelineResults.filter((item) => item.kind === "log").length} logs`, timelineResults.some((item) => item.kind === "log") ? "log" : "neutral");
      const timelineActions = timelineCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(timelineActions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");
      createButton(timelineActions, "Monthly report", async () => this.plugin.generateMonthlyReport(), false, "line-chart");
      const timelineList = timelineCard.createDiv({ cls: "daily-dashboard-completed-list" });
      if (timelineResults.length === 0) {
        timelineList.createDiv({ cls: "daily-dashboard-empty-state", text: "No timeline entries match the current filters." });
      } else {
        timelineResults.slice(0, 60).forEach((result) => {
          const row = timelineList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, result.kind, result.tone);
          createSemanticChip(chipRow, result.date, "log");
          if (result.project) {
            createSemanticChip(chipRow, result.project, "neutral");
          }
          if (result.tag) {
            createSemanticChip(chipRow, result.tag, this.getSessionTagTone(result.tag));
          }
          copy.createEl("strong", { text: result.title });
          copy.createEl("span", { text: result.summary });
          if (result.detail) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: result.detail });
          }
        });
      }

      const heatmapCard = createGridCard("Heatmaps", "See work, sleep, and habit density across recent days instead of inferring patterns from memory.", {
        icon: "layout-grid",
        eyebrow: "Heatmaps",
        tone: "capture",
        tag: "84 days"
      });
      const heatmapShell = heatmapCard.createDiv({ cls: "daily-dashboard-heatmap-stack" });
      this.renderHeatmapMetric(heatmapShell, "Work", "Tracked work minutes per day", this.buildHeatmapSeries("work"));
      this.renderHeatmapMetric(heatmapShell, "Sleep", "Tracked sleep minutes per day", this.buildHeatmapSeries("sleep"));
      this.renderHeatmapMetric(heatmapShell, "Habits", "Weighted habit completion percentage per day", this.buildHeatmapSeries("habits"));

      const aiCard = createGridCard("AI Workspace", "Plan, review, and ask grounded questions against your dashboard and vault without leaving the page.", {
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
      aiActionsPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Run focused planning, diagnostic, synthesis, and comparison workflows without leaving the dashboard." });
      const aiActions = aiActionsPanel.createDiv({ cls: "daily-dashboard-ai-action-grid" });
      createButton(aiActions, "Morning brief", async () => this.plugin.generateAiMorningStartupBrief(), false, "sunrise");
      createButton(aiActions, "Shutdown summary", async () => this.plugin.generateAiShutdownSummary(), false, "moon-star");
      createButton(aiActions, "Weekly planning", async () => this.plugin.generateAiWeeklyPlanningAssistant(), false, "bar-chart-3");
      createButton(aiActions, "Risk scan", async () => this.plugin.generateAiProjectRiskScanner(), false, "triangle-alert");
      createButton(aiActions, "Anomalies", async () => this.plugin.generateAiAnomalyDetectionReport(), false, "activity");
      createButton(aiActions, "Compare periods", async () => this.plugin.generateAiPeriodComparisonReport(), false, "git-compare-arrows");
      createButton(aiActions, "Project synthesis", async () => this.plugin.generateAiProjectSynthesis(), false, "network");
      createButton(aiActions, "Why felt off", async () => this.plugin.generateAiWhyTodayFeltOff(), false, "brain-circuit");
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

        if (latestArtifact.nextActions.length > 0) {
          latestPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Concrete actions" });
          const nextActionList = latestPanel.createDiv({ cls: "daily-dashboard-ai-suggestions" });
          latestArtifact.nextActions.forEach((item) => {
            const row = nextActionList.createDiv({ cls: "daily-dashboard-project-row" });
            row.createEl("span", { text: item });
          });
        }

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

      const projectsCard = createGridCard("Project Health", "Score projects by backlog, staleness, output, and momentum.", {
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
          .sort((left, right) => {
            const recencyDelta = getProjectLastWorkedSortKey(right).localeCompare(getProjectLastWorkedSortKey(left));
            if (recencyDelta !== 0) {
              return recencyDelta;
            }

            return right.healthScore - left.healthScore;
          })
          .slice(0, projectsExpanded ? 10 : 6)
          .forEach((project) => {
            const row = projectList.createDiv({ cls: projectsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
            const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 75 ? "focus" : project.healthScore >= 50 ? "state" : "alert");
            createSemanticChip(chipRow, project.trend, project.trend === "up" ? "done" : project.trend === "down" ? "alert" : "neutral");
            createSemanticChip(chipRow, project.projectState === "active" ? "Active" : project.projectState === "incubating" ? "Incubating" : "Someday", project.projectState === "active" ? "neutral" : "log");
            row.createEl("strong", { text: `${project.name} • ${project.healthScore}` });
            row.createEl("span", { text: `${project.healthLabel} • ${project.openCount} open • ${project.completionsThisWeek} this week • ${project.completionsThisMonth} this month • ${project.trend} • ${project.status}` });
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Last worked: ${project.lastCompletedAt ?? "No archived activity yet"}` });
            renderProjectMomentum(row, project);
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Next action: ${project.nextAction}` });
            if (projectsExpanded && project.healthReasons.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Why: ${project.healthReasons.join(" • ")}` });
            }
            if (projectsExpanded && project.overdueTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue: ${project.overdueTasks.slice(0, 2).map((task) => task.text).join(" • ")}` });
            }
            if (projectsExpanded && project.dueSoonTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Due soon: ${project.dueSoonTasks.slice(0, 2).map((task) => `${task.text} (${task.dueDate})`).join(" • ")}` });
            }
            if (projectsExpanded && project.blockedTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" • ")}` });
            }
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

      const alertsCard = createGridCard("Stale Work And Cleanup", "Catch stale projects, vague tasks, duplicates, and empty sections.", {
        icon: "triangle-alert",
        eyebrow: "Triage",
        tone: "alert",
        tag: "Attention"
      });
      const alertsExpanded = this.isSectionExpanded("cleanup-details");
      const alertsList = alertsCard.createDiv({ cls: "daily-dashboard-project-list" });
      const alertLines = [
        ...overdueTasks.slice(0, 5).map((item) => `Overdue: ${item.project} -> ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`),
        ...dueSoonTasks.slice(0, 5).map((item) => `Due soon: ${item.project} -> ${item.task.text}${item.task.dueDate ? ` (${item.task.dueDate})` : ""}`),
        ...blockedTasks.slice(0, 5).map((item) => `Blocked: ${item.project} -> ${item.task.text}${item.task.blockedReason ? ` (${item.task.blockedReason})` : ""}`),
        ...staleProjects.slice(0, 5).map((project) => `Stale project: ${project.name} (${project.staleDays} days)`),
        ...breakdownCandidates.slice(0, 5).map((item) => `Needs breakdown: ${item.project} -> ${item.task}`)
      ];
      if (alertLines.length === 0 && cleanupProjects.length === 0 && cleanupSuggestions.length === 0) {
        alertsList.createDiv({ cls: "daily-dashboard-empty-state", text: "No stale-work or cleanup issues detected right now." });
      } else {
        cleanupSuggestions.slice(0, alertsExpanded ? cleanupSuggestions.length : 3).forEach((item) => {
          const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
          const copy = row.createDiv({ cls: "daily-dashboard-stack" });
          const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
          createSemanticChip(chipRow, item.projectName, "neutral");
          createSemanticChip(chipRow, item.kind.replace(/-/g, " "), item.kind === "stale-project" || item.kind === "overdue-tasks" ? "alert" : "state");
          copy.createEl("strong", { text: item.summary });
          if (item.detail) {
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: item.detail });
          }
          const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(actions, item.actionLabel, async () => this.handleCleanupSuggestionAction(item.action), false, item.action === "open-cleanup-note" ? "sparkles" : "file-text");
          createButton(actions, "Dismiss", async () => this.plugin.dismissCleanupSuggestion(item.id), false, "x");
        });

        if (alertsExpanded && cleanupProjects.length > 0) {
        cleanupProjects
          .sort((left, right) => getProjectIssueCount(right) - getProjectIssueCount(left))
          .slice(0, 10)
          .forEach((project) => {
            const row = alertsList.createDiv({ cls: "daily-dashboard-project-row" });
            const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, `${getProjectIssueCount(project)} issue${getProjectIssueCount(project) === 1 ? "" : "s"}`, getProjectIssueCount(project) >= 4 ? "alert" : "state");
            createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 50 ? "state" : "alert");
            createSemanticChip(chipRow, project.projectState === "active" ? "Active" : project.projectState === "incubating" ? "Incubating" : "Someday", project.projectState === "active" ? "neutral" : "log");
            row.createEl("strong", { text: project.name });
            row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Next action: ${project.nextAction}` });
            if (project.staleDays !== null) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Stale: ${project.staleDays} day${project.staleDays === 1 ? "" : "s"} since completion` });
            }
            if (project.breakdownTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Needs breakdown: ${project.breakdownTasks.slice(0, 3).join(" • ")}` });
            }
            if (project.duplicateTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Duplicates: ${project.duplicateTasks.slice(0, 3).join(" • ")}` });
            }
            if (project.emptySections.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Empty sections: ${project.emptySections.join(" • ")}` });
            }
            if (project.overdueTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue: ${project.overdueTasks.slice(0, 2).map((task) => task.text).join(" • ")}` });
            }
            if (project.blockedTasks.length > 0) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked: ${project.blockedTasks.slice(0, 2).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" • ")}` });
            }
          });
        } else {
        alertLines.slice(0, alertsExpanded ? alertLines.length : 6).forEach((line) => {
          const row = alertsList.createDiv({ cls: alertsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
          row.createEl("span", { text: line });
        });
        }
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      if (alertLines.length > 6 || cleanupSuggestions.length > 3 || cleanupProjects.length > 0) {
        createButton(alertActions, alertsExpanded ? "Show summary" : "Show details", async () => this.toggleSectionExpanded("cleanup-details"), false, alertsExpanded ? "chevrons-up" : "chevrons-down");
      }
      createButton(alertActions, "Cleanup note", async () => this.plugin.showCleanupSuggestions(), false, "sparkles");
      createButton(alertActions, "Offload references", async () => this.plugin.offloadProjectReferences(true), false, "move-right");

      this.applyGridLayout(grid, gridCardBindings, layoutByKey);

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
      time.createEl("strong", { text: this.formatCalendarDayLabel(new Date(event.start), event.allDay, new Date(event.end)) });
      time.createEl("span", { text: this.formatCalendarTimeLabel(new Date(event.start), new Date(event.end), event.allDay) });

      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [event.projectName || "", event.leadSummary, event.notes || (event.warningLevel === "warning" ? "Within warning window" : "Scheduled")]
          .filter((value) => value.length > 0)
          .join(" • ")
      });

      const chips = row.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(chips, event.warningLevel === "warning" ? "Soon" : "Later", event.warningLevel === "warning" ? "alert" : "neutral");
      if (event.leadSummary) {
        createSemanticChip(chips, event.leadSummary, "focus");
      }
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
        item.calendarLeadSummary || "",
        item.calendarNotes || "From calendar"
      ].filter((value) => value.length > 0).join(" • ");
    }

    return [
      item.projectName ? `Project ${item.projectName}` : "No project",
      item.status === "done" ? "Done" : item.isActive ? "Working on" : "Queued",
      `${formatMinutesAsHours(item.trackedMinutes)} tracked`,
      item.completedAt ? `completed ${item.completedAt.slice(11)}` : ""
    ].filter((value) => value.length > 0).join(" • ");
  }

  private getSuggestedTop3SourceLabel(candidate: SuggestedTop3Candidate): string {
    switch (candidate.source) {
      case "calendar":
        return "Calendar";
      case "overdue":
        return "Overdue";
      case "due-soon":
        return "Due soon";
      case "repeating":
        return "Repeating";
      case "stale":
        return "Stale work";
      default:
        return "Suggested";
    }
  }

  private getSuggestedTop3Tone(candidate: SuggestedTop3Candidate): DashboardTone {
    switch (candidate.source) {
      case "calendar":
        return "capture";
      case "overdue":
        return "alert";
      case "due-soon":
        return "focus";
      case "repeating":
        return "log";
      case "stale":
        return "health";
      default:
        return "neutral";
    }
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
    const title = header.createDiv({ cls: "daily-dashboard-calendar-toolbar-copy" });
    title.createEl("strong", { text: currentMonth.toLocaleDateString([], { month: "long", year: "numeric" }) });
    const controls = header.createDiv({ cls: "daily-dashboard-calendar-nav" });
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
      time.createEl("strong", { text: event.date === event.endDate ? (event.startTime || "All day") : `${event.date} -> ${event.endDate}` });
      time.createEl("span", { text: event.endTime || (event.startTime ? (event.date === event.endDate ? "No end" : `ends ${event.endDate}`) : event.date === event.endDate ? "Runs all day" : "Runs all day across multiple days") });

      const copy = row.createDiv({ cls: "daily-dashboard-calendar-copy" });
      copy.createEl("strong", { text: event.title });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [
          `Category ${event.category}`,
          event.prepMinutes > 0 ? `Prep ${event.prepMinutes}m` : "",
          event.travelMinutes > 0 ? `Travel ${event.travelMinutes}m` : "",
          event.notes || "No notes",
          event.isException ? `${event.exceptionKind === "move" ? "Moved once" : event.exceptionKind === "cancel" ? "Cancelled once" : "Skipped once"} from ${event.originalDate}` : ""
        ].filter((value) => value.length > 0).join(" • ")
      });

      const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      if (event.isRecurring) {
        createButton(actions, "Edit once", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId, event.originalDate).open(), false, "pencil");
        createButton(actions, "Edit series", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId).open(), false, "notebook-pen");
        createButton(actions, event.isException ? "Restore once" : "Skip once", async () => {
          if (event.isException) {
            await this.plugin.clearCalendarOccurrenceException(event.sourceEventId, event.originalDate);
          } else {
            await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "skip");
          }
          await this.render();
        }, false, event.isException ? "rotate-ccw" : "skip-forward");
        createButton(actions, "Cancel once", async () => {
          await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "cancel");
          await this.render();
        }, false, "circle-off");
        createButton(actions, "Delete series", async () => this.plugin.removeCalendarEvent(event.sourceEventId), false, "trash-2");
      } else {
        createButton(actions, "Edit", async () => new CalendarEventModal(this.app, this.plugin, selectedDate, event.sourceEventId).open(), false, "pencil");
        createButton(actions, "Delete", async () => this.plugin.removeCalendarEvent(event.sourceEventId), false, "trash-2");
      }
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

  private formatCalendarDayLabel(date: Date, allDay: boolean, endDate?: Date): string {
    if (allDay) {
      if (endDate && formatDateKey(date) !== formatDateKey(endDate)) {
        return `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} -> ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;
      }

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
      return formatDateKey(start) === formatDateKey(end)
        ? "All day"
        : `All day • ${start.toLocaleDateString([], { month: "short", day: "numeric" })} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }

    const sameDay = formatDateKey(start) === formatDateKey(end);
    const startLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endLabel = end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) {
      return `${startLabel} - ${endLabel}`;
    }

    return `${start.toLocaleDateString([], { month: "short", day: "numeric" })} ${startLabel} - ${end.toLocaleDateString([], { month: "short", day: "numeric" })} ${endLabel}`;
  }

  private renderDayMetric(parent: HTMLElement, label: string, value: string): HTMLElement {
    const metric = parent.createDiv({ cls: "daily-dashboard-day-metric" });
    metric.createEl("span", { cls: "daily-dashboard-habit-meta", text: label });
    metric.createEl("strong", { text: value });
    return metric;
  }

  private buildTimelineSessions(entry: ReturnType<DailyDashboardPlugin["getTodayEntry"]>): TimelineStripSession[] {
    return [
      ...entry.workSessions.map((session, index) => ({ id: `work-${index}-${session.start}`, kind: "work" as const, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag })),
      ...entry.napSessions.map((session, index) => ({ id: `nap-${index}-${session.start}`, kind: "nap" as const, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag })),
      ...entry.relaxSessions.map((session, index) => ({ id: `relax-${index}-${session.start}`, kind: "relax" as const, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag })),
      ...entry.breakSessions.map((session, index) => ({ id: `break-${index}-${session.start}`, kind: "break" as const, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag })),
      ...entry.poopSessions.map((session, index) => ({ id: `poop-${index}-${session.start}`, kind: "poop" as const, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag })),
      ...entry.activitySessions.map((session, index) => ({ id: `${session.kind}-${index}-${session.start}`, kind: session.kind, start: session.start, end: session.end ?? formatDateTimeKey(new Date()), tag: session.tag }))
    ].sort((left, right) => left.start.localeCompare(right.start));
  }

  private renderTimelineStrip(parent: HTMLElement, sessions: TimelineStripSession[], date: string, fallbackEnd: string, emptyText: string): void {
    if (sessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }

    const parsedSessions = sessions
      .map((session) => ({
        ...session,
        startDate: new Date(session.start.replace(" ", "T")),
        endDate: new Date((session.end || fallbackEnd).replace(" ", "T"))
      }))
      .filter((session) => !Number.isNaN(session.startDate.getTime()) && !Number.isNaN(session.endDate.getTime()) && session.endDate.getTime() > session.startDate.getTime());

    if (parsedSessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }

    const startBoundary = new Date(`${date}T00:00:00`);
    const endBoundary = new Date(`${date}T23:59:00`);
    const totalSpan = endBoundary.getTime() - startBoundary.getTime();
    const legend = parent.createDiv({ cls: "daily-dashboard-chip-row" });
    [
      { kind: "work", label: "Work", tone: "capture" },
      { kind: "nap", label: "Nap", tone: "health" },
      { kind: "relax", label: "Relax", tone: "health" },
      { kind: "break", label: "Break", tone: "alert" },
      { kind: "poop", label: "Poop", tone: "log" },
      ...DASHBOARD_ACTIVITY_TRACKERS
    ].forEach((item) => {
      if (parsedSessions.some((session) => session.kind === item.kind)) {
        createSemanticChip(legend, item.label, item.tone as DashboardTone);
      }
    });

    const strip = parent.createDiv({ cls: "daily-dashboard-timeline-strip" });
    parsedSessions.forEach((session) => {
      const segment = strip.createDiv({ cls: `daily-dashboard-timeline-segment is-${session.kind}` });
      const left = ((session.startDate.getTime() - startBoundary.getTime()) / totalSpan) * 100;
      const width = ((session.endDate.getTime() - session.startDate.getTime()) / totalSpan) * 100;
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${session.end.slice(11, 16)}${session.tag ? ` • ${session.tag}` : ""}`;
    });

    const scale = parent.createDiv({ cls: "daily-dashboard-timeline-scale" });
    ["00:00", "06:00", "12:00", "18:00", "24:00"].forEach((label) => {
      scale.createEl("span", { text: label });
    });
  }

  private getTimelineSearchResults(): TimelineSearchResult[] {
    const entries = this.plugin.getAllEntries();
    const todayKey = formatDateKey(new Date());
    const lastEntryKey = entries[entries.length - 1]?.date ?? todayKey;
    const defaultStart = entries[0]?.date ?? formatDateKey(new Date(Date.now() - (90 * 24 * 60 * 60 * 1000)));
    const defaultEnd = formatDateKey(new Date(Math.max(new Date(`${lastEntryKey}T00:00:00`).getTime(), Date.now() + (180 * 24 * 60 * 60 * 1000))));
    const fromDate = this.timelineFilters.fromDate || defaultStart;
    const toDate = this.timelineFilters.toDate || defaultEnd;
    const entryMap = new Map(entries.map((entry) => [entry.date, entry]));
    const nextEntryMap = new Map(entries.map((entry, index) => [entry.date, entries[index + 1]]));
    const keyword = this.timelineFilters.keyword.trim().toLowerCase();

    const results: TimelineSearchResult[] = [];

    entries
      .filter((entry) => entry.date >= fromDate && entry.date <= toDate)
      .forEach((entry) => {
        entry.completedTasks.forEach((task, index) => {
          results.push({
            id: `task-${entry.date}-${index}-${task.archivedAt}`,
            date: task.archivedAt.slice(0, 10),
            sortKey: task.archivedAt,
            kind: "task",
            title: task.text,
            summary: `${task.project} • ${task.section}`,
            detail: task.note?.trim() ?? "",
            tone: "done",
            project: task.project,
            tag: ""
          });
        });

        this.pushTimelineSessionResults(results, entry.date, "work", entry.workSessions);
        this.pushTimelineSessionResults(results, entry.date, "nap", entry.napSessions);
        this.pushTimelineSessionResults(results, entry.date, "relax", entry.relaxSessions);
        this.pushTimelineSessionResults(results, entry.date, "break", entry.breakSessions);
        this.pushTimelineSessionResults(results, entry.date, "poop", entry.poopSessions);
        DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
          this.pushTimelineSessionResults(results, entry.date, tracker.kind, entry.activitySessions.filter((session) => session.kind === tracker.kind));
        });

        entry.moodCheckIns.forEach((item, index) => {
          results.push({
            id: `mood-${entry.date}-${index}-${item.loggedAt}`,
            date: entry.date,
            sortKey: item.loggedAt || `${entry.date} 23:59`,
            kind: "log",
            title: `Mood • ${item.feeling || `${item.score}/5`}`,
            summary: `Mood ${item.score}/5`,
            detail: item.note.trim(),
            tone: item.score >= 4 ? "done" : item.score >= 3 ? "state" : "alert",
            project: "",
            tag: ""
          });
        });

        entry.energyCheckIns.forEach((item, index) => {
          results.push({
            id: `energy-${entry.date}-${index}-${item.loggedAt}`,
            date: entry.date,
            sortKey: item.loggedAt || `${entry.date} 23:59`,
            kind: "log",
            title: `Energy • ${item.score}/5`,
            summary: "Energy check-in",
            detail: item.note.trim(),
            tone: item.score >= 4 ? "done" : item.score >= 3 ? "state" : "alert",
            project: "",
            tag: ""
          });
        });

        entry.anxietyCheckIns.forEach((item, index) => {
          results.push({
            id: `anxiety-${entry.date}-${index}-${item.loggedAt}`,
            date: entry.date,
            sortKey: item.loggedAt || `${entry.date} 23:59`,
            kind: "log",
            title: `Anxiety • ${item.score}/5`,
            summary: "Anxiety check-in",
            detail: item.note.trim(),
            tone: item.score >= 4 ? "alert" : "state",
            project: "",
            tag: ""
          });
        });

        this.pushTimelineLogResult(results, entry.date, "friction", "Friction log", entry.frictionLog, "alert");
        this.pushTimelineLogResult(results, entry.date, "sleep", "Sleep log", entry.sleepLog, "health");
        this.pushTimelineLogResult(results, entry.date, "dream", "Dream log", entry.dreamLog, "log");
        this.pushTimelineLogResult(results, entry.date, "notes", "Daily notes", entry.notes, "neutral");
        this.pushTimelineLogResult(results, entry.date, "helped", "What helped today", entry.helpedToday, "done");
        this.pushTimelineLogResult(results, entry.date, "hurt", "What hurt today", entry.hurtToday, "alert");

        entry.symptomLog.forEach((item, index) => {
          results.push({
            id: `symptom-${entry.date}-${index}-${item.loggedAt}`,
            date: entry.date,
            sortKey: item.loggedAt || `${entry.date} 23:59`,
            kind: "log",
            title: `Symptom • ${item.symptom}`,
            summary: `Severity ${item.severity}/5`,
            detail: item.note.trim(),
            tone: item.severity >= 4 ? "alert" : "log",
            project: "",
            tag: ""
          });
        });

        entry.intakeLog.forEach((item, index) => {
          results.push({
            id: `intake-${entry.date}-${index}-${item.loggedAt}`,
            date: entry.date,
            sortKey: item.loggedAt || `${entry.date} 23:59`,
            kind: "log",
            title: `${item.kind === "food" ? "Food" : "Consumable"} • ${item.label}`,
            summary: `${item.kind} • ${item.amount} ${item.unit}`,
            detail: item.note.trim(),
            tone: item.kind === "medication" ? "alert" : "health",
            project: "",
            tag: ""
          });
        });

        const nextEntry = nextEntryMap.get(entry.date);
        const sleepMinutes = getSleepMinutesForDay(entry, nextEntry);
        if (sleepMinutes > 0) {
          results.push({
            id: `sleep-metric-${entry.date}`,
            date: entry.date,
            sortKey: `${entry.date} 23:58`,
            kind: "log",
            title: "Sleep metric",
            summary: `${formatMinutesAsHours(sleepMinutes)} tracked sleep`,
            detail: entry.wakeTime || entry.sleepTime ? `Bed ${entry.sleepTime || "unknown"} • Wake ${nextEntry?.wakeTime || entry.wakeTime || "unknown"}` : "",
            tone: "health",
            project: "",
            tag: ""
          });
        }
      });

    this.plugin.getCalendarOccurrencesBetween(fromDate, toDate).forEach((event) => {
      results.push({
        id: `calendar-${event.id}`,
        date: event.date,
        sortKey: `${event.date} ${event.startTime || "00:00"}`,
        kind: "calendar",
        title: event.title,
        summary: [event.category, event.projectName, event.startTime ? `${event.startTime}${event.endTime ? `-${event.endTime}` : ""}` : "All day"].filter((value) => value.length > 0).join(" • "),
        detail: event.notes.trim(),
        tone: event.category === "work" ? "capture" : event.category === "health" ? "health" : "focus",
        project: event.projectName,
        tag: ""
      });
    });

    return results
      .filter((result) => this.timelineFilters.kinds.includes(result.kind))
      .filter((result) => !this.timelineFilters.project || result.project === this.timelineFilters.project)
      .filter((result) => !this.timelineFilters.tag || result.tag.toLowerCase() === this.timelineFilters.tag.toLowerCase())
      .filter((result) => !this.timelineFilters.onlyWithNotes || result.detail.trim().length > 0)
      .filter((result) => !keyword || `${result.title} ${result.summary} ${result.detail} ${result.project} ${result.tag}`.toLowerCase().includes(keyword))
      .sort((left, right) => right.sortKey.localeCompare(left.sortKey));
  }

  private pushTimelineSessionResults(results: TimelineSearchResult[], date: string, kind: "work" | "nap" | "relax" | "break" | "poop" | ActivitySessionKind, sessions: WorkSession[]): void {
    sessions.forEach((session, index) => {
      const start = session.start.slice(11, 16);
      const endRaw = session.end ?? formatDateTimeKey(new Date());
      const end = endRaw.slice(11, 16);
      const minutes = Math.max(0, getMinutesBetween(session.start, endRaw));
      const trackerMeta = DASHBOARD_ACTIVITY_TRACKERS.find((item) => item.kind === kind);
      const label = trackerMeta?.label ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
      results.push({
        id: `${kind}-${date}-${index}-${session.start}`,
        date,
        sortKey: session.start,
        kind: "session",
        title: `${label} session`,
        summary: `${start}-${end} • ${formatMinutesAsHours(minutes)}`,
        detail: session.tag.trim() ? `Tag ${session.tag.trim()}` : "",
        tone: trackerMeta?.tone ?? (kind === "work" ? "capture" : kind === "poop" ? "log" : kind === "break" ? "alert" : "health"),
        project: "",
        tag: session.tag.trim()
      });
    });
  }

  private pushTimelineLogResult(results: TimelineSearchResult[], date: string, suffix: string, title: string, value: string, tone: TimelineSearchResult["tone"]): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    results.push({
      id: `${suffix}-${date}`,
      date,
      sortKey: `${date} 23:59`,
      kind: "log",
      title,
      summary: this.truncateTimelineText(trimmed, 120),
      detail: trimmed,
      tone,
      project: "",
      tag: ""
    });
  }

  private truncateTimelineText(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
  }

  private buildHeatmapSeries(kind: "work" | "sleep" | "habits"): Array<{ date: string; value: number; label: string }> {
    const entries = this.plugin.getAllEntries();
    const today = new Date();
    const days = 84;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const entryMap = new Map(entries.map((entry) => [entry.date, entry]));
    const nextEntryMap = new Map(entries.map((entry, index) => [entry.date, entries[index + 1]]));
    const habitDefinitions = this.plugin.getHabitDefinitions();

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const entry = entryMap.get(dateKey);
      if (!entry) {
        return { date: dateKey, value: 0, label: "No data" };
      }

      if (kind === "work") {
        const minutes = getTrackedWorkMinutes(entry);
        return { date: dateKey, value: Math.min(1, minutes / 240), label: `${formatMinutesAsHours(minutes)} work` };
      }

      if (kind === "sleep") {
        const minutes = getSleepMinutesForDay(entry, nextEntryMap.get(dateKey));
        return { date: dateKey, value: Math.min(1, minutes / 540), label: `${formatMinutesAsHours(minutes)} sleep` };
      }

      const completion = getHabitWeightedCompletion(entry, habitDefinitions).percentage;
      return { date: dateKey, value: Math.min(1, completion / 100), label: `${completion}% habits` };
    });
  }

  private renderHeatmapMetric(parent: HTMLElement, title: string, description: string, values: Array<{ date: string; value: number; label: string }>): void {
    const section = parent.createDiv({ cls: "daily-dashboard-heatmap-metric" });
    const header = section.createDiv({ cls: "daily-dashboard-score-header" });
    header.createEl("strong", { text: title });
    header.createEl("span", { cls: "daily-dashboard-row-meta", text: description });
    const grid = section.createDiv({ cls: "daily-dashboard-heatmap-grid" });
    values.forEach((item) => {
      const cell = grid.createDiv({ cls: this.getHeatmapCellClass(item.value) });
      cell.title = `${item.date} • ${item.label}`;
    });
    const summary = section.createDiv({ cls: "daily-dashboard-chip-row" });
    const average = values.length > 0 ? Math.round((values.reduce((sum, item) => sum + item.value, 0) / values.length) * 100) : 0;
    const strongest = values.reduce((best, item) => item.value > best.value ? item : best, values[0] ?? { date: "", value: 0, label: "No data" });
    createSemanticChip(summary, `Average ${average}%`, average >= 60 ? "done" : average >= 35 ? "focus" : "neutral");
    createSemanticChip(summary, strongest.date ? `Peak ${strongest.date}` : "No peak", strongest.value >= 0.7 ? "capture" : "neutral");
  }

  private getHeatmapCellClass(value: number): string {
    if (value >= 0.8) {
      return "daily-dashboard-heatmap-cell is-4";
    }
    if (value >= 0.6) {
      return "daily-dashboard-heatmap-cell is-3";
    }
    if (value >= 0.35) {
      return "daily-dashboard-heatmap-cell is-2";
    }
    if (value > 0) {
      return "daily-dashboard-heatmap-cell is-1";
    }
    return "daily-dashboard-heatmap-cell is-0";
  }

  private resetDashboardFilters(): void {
    this.timelineFilters = {
      keyword: "",
      project: "",
      tag: "",
      kinds: ["task", "session", "calendar", "log"],
      fromDate: "",
      toDate: "",
      onlyWithNotes: false
    };
    this.selectedSavedFilterName = "";
    setDashboardSelectedFilterName("");
  }

  private saveCurrentDashboardFilter(): void {
    const suggestedName = this.selectedSavedFilterName || `Filter ${formatDateKey(new Date())}`;
    const name = window.prompt("Name this dashboard filter preset:", suggestedName)?.trim() ?? "";
    if (!name) {
      return;
    }

    const filters = getSavedDashboardFilters().filter((item) => item.name !== name);
    filters.push({
      name,
      workLogFilters: {
        project: this.timelineFilters.project,
        keyword: this.timelineFilters.keyword,
        fromDate: this.timelineFilters.fromDate,
        toDate: this.timelineFilters.toDate
      },
      timelineFilters: {
        ...this.timelineFilters,
        kinds: [...this.timelineFilters.kinds]
      }
    });
    setSavedDashboardFilters(filters.sort((left, right) => left.name.localeCompare(right.name)));
    this.selectedSavedFilterName = name;
    setDashboardSelectedFilterName(name);
  }

  private applySavedDashboardFilter(name: string): void {
    const filter = getSavedDashboardFilters().find((item) => item.name === name);
    if (!filter) {
      return;
    }

    this.timelineFilters = {
      ...filter.timelineFilters,
      keyword: filter.timelineFilters.keyword || filter.workLogFilters.keyword,
      project: filter.timelineFilters.project || filter.workLogFilters.project,
      fromDate: filter.timelineFilters.fromDate || filter.workLogFilters.fromDate,
      toDate: filter.timelineFilters.toDate || filter.workLogFilters.toDate,
      kinds: filter.timelineFilters.kinds.length > 0 ? [...filter.timelineFilters.kinds] : ["task", "session", "calendar", "log"]
    };
    this.selectedSavedFilterName = filter.name;
    setDashboardSelectedFilterName(filter.name);
  }

  private deleteSelectedDashboardFilter(): void {
    if (!this.selectedSavedFilterName) {
      return;
    }

    const nextFilters = getSavedDashboardFilters().filter((item) => item.name !== this.selectedSavedFilterName);
    setSavedDashboardFilters(nextFilters);
    this.selectedSavedFilterName = "";
    setDashboardSelectedFilterName("");
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

  private initializePersistentTextarea(textarea: HTMLTextAreaElement, storageKey: string): void {
    const storedHeight = getDashboardTextareaHeight(storageKey);
    if (storedHeight) {
      textarea.style.height = storedHeight;
    }

    const persistHeight = (): void => {
      setDashboardTextareaHeight(storageKey, `${textarea.offsetHeight}px`);
    };

    textarea.addEventListener("mouseup", persistHeight);
    textarea.addEventListener("touchend", persistHeight);
  }

  private getCurrentWeekTimeBoard(): Array<{
    label: string;
    date: string;
    minutesByKind: Record<string, number>;
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
      const minutesByKind: Record<string, number> = {
        sleep: sleepMinutes,
        work: entry ? this.plugin.getTrackedWorkMinutes(entry) : 0,
        nap: entry ? this.plugin.getTrackedNapMinutes(entry) : 0,
        relax: entry ? this.plugin.getTrackedRelaxMinutes(entry) : 0,
        break: entry ? this.plugin.getTrackedBreakMinutes(entry) : 0,
        poop: entry ? this.plugin.getTrackedPoopMinutes(entry) : 0,
        unknown: entry ? this.plugin.getTimeAllocationInsights(entry.date).fullDayUnknownMinutes : Math.max(0, 1440 - sleepMinutes)
      };
      DASHBOARD_ACTIVITY_TRACKERS.forEach((tracker) => {
        minutesByKind[tracker.kind] = entry ? this.plugin.getTrackedActivityMinutes(entry, tracker.kind) : 0;
      });

      return {
        label,
        date: dateKey,
        minutesByKind,
        isToday: dateKey === formatDateKey(today),
        isActiveLogicalDay: dateKey === activeLogicalDate
      };
    });
  }

  private renderWeekBarSegment(parent: HTMLElement, tone: string, minutes: number): void {
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

  private renderWeekLegendItem(parent: HTMLElement, label: string, tone: string): void {
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
  private editingOccurrenceOriginalDate: string | null;
  private titleValue = "";
  private endDateValue = "";
  private startTimeValue = "";
  private endTimeValue = "";
  private prepMinutesValue = "0";
  private travelMinutesValue = "0";
  private categoryValue: CalendarEventCategory = "personal";
  private projectNameValue = "";
  private projectNotePathValue = "";
  private notesValue = "";
  private repeatCadenceValue: CalendarRepeatCadence = "none";
  private repeatUntilValue = "";

  constructor(app: App, plugin: DailyDashboardPlugin, date: string, editingEventId: string | null = null, editingOccurrenceOriginalDate: string | null = null) {
    super(app);
    this.plugin = plugin;
    this.date = date;
    this.initialDate = date;
    this.editingEventId = editingEventId;
    this.editingOccurrenceOriginalDate = editingOccurrenceOriginalDate;
  }

  onOpen(): void {
    this.hydrateEditingState();
    this.setTitle(`Calendar Events • ${this.date}`);
    void this.renderContent();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async renderContent(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    const projectChoices = await this.plugin.getCalendarProjectOptions();

    const existingEvents = this.plugin.getCalendarEventsForDate(this.date);
    if (existingEvents.length > 0) {
      contentEl.createEl("h3", { text: "Existing events" });
      existingEvents.forEach((event) => {
        new Setting(contentEl)
          .setName(event.title)
          .setDesc([
            event.date === event.endDate ? event.startTime || "All day" : `${event.date} -> ${event.endDate}`,
            event.endTime ? `to ${event.endTime}` : "",
            event.prepMinutes > 0 ? `prep ${event.prepMinutes}m` : "",
            event.travelMinutes > 0 ? `travel ${event.travelMinutes}m` : "",
            `category ${event.category}`,
            event.projectName ? `project ${event.projectName}` : "",
            event.isRecurring ? `repeats ${event.repeatCadence}${event.repeatUntil ? ` until ${event.repeatUntil}` : ""}` : "",
            event.isException ? `${event.exceptionKind === "move" ? "moved" : event.exceptionKind} once from ${event.originalDate}` : "",
            event.notes
          ].filter((value) => value.length > 0).join(" • "))
          .addButton((button) => {
            button.setButtonText(event.isRecurring ? "Edit once" : "Edit").onClick(() => {
              this.editingEventId = event.sourceEventId;
              this.editingOccurrenceOriginalDate = event.isRecurring ? event.originalDate : null;
              this.date = event.date;
              this.endDateValue = event.endDate;
              this.titleValue = event.title;
              this.startTimeValue = event.startTime;
              this.endTimeValue = event.endTime;
              this.prepMinutesValue = `${event.prepMinutes}`;
              this.travelMinutesValue = `${event.travelMinutes}`;
              this.categoryValue = event.category;
              this.projectNameValue = event.projectName;
              this.projectNotePathValue = event.projectNotePath;
              this.notesValue = event.notes;
              if (!event.isRecurring) {
                this.repeatCadenceValue = "none";
                this.repeatUntilValue = "";
              }
              void this.renderContent();
            });
          });
        if (event.isRecurring) {
          new Setting(contentEl)
            .setName("")
            .addButton((button) => {
              button.setButtonText("Edit series").onClick(() => {
                const sourceEvent = this.plugin.getCalendarEventEntry(event.sourceEventId);
                if (!sourceEvent) {
                  return;
                }

                this.editingEventId = sourceEvent.id;
                this.editingOccurrenceOriginalDate = null;
                this.date = sourceEvent.date;
                this.endDateValue = sourceEvent.endDate;
                this.titleValue = sourceEvent.title;
                this.startTimeValue = sourceEvent.startTime;
                this.endTimeValue = sourceEvent.endTime;
                this.prepMinutesValue = `${sourceEvent.prepMinutes}`;
                this.travelMinutesValue = `${sourceEvent.travelMinutes}`;
                this.categoryValue = sourceEvent.category;
                this.projectNameValue = sourceEvent.projectName;
                this.projectNotePathValue = sourceEvent.projectNotePath;
                this.notesValue = sourceEvent.notes;
                this.repeatCadenceValue = sourceEvent.repeatCadence;
                this.repeatUntilValue = sourceEvent.repeatUntil;
                void this.renderContent();
              });
            })
            .addButton((button) => {
              button.setButtonText(event.isException ? "Restore once" : "Skip once").onClick(async () => {
                if (event.isException) {
                  await this.plugin.clearCalendarOccurrenceException(event.sourceEventId, event.originalDate);
                } else {
                  await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "skip");
                }
                if (this.editingOccurrenceOriginalDate === event.originalDate) {
                  this.clearEditingState();
                }
                await this.renderContent();
              });
            })
            .addButton((button) => {
              button.setButtonText("Cancel once").onClick(async () => {
                await this.plugin.applyCalendarOccurrenceException(event.sourceEventId, event.originalDate, "cancel");
                if (this.editingOccurrenceOriginalDate === event.originalDate) {
                  this.clearEditingState();
                }
                await this.renderContent();
              });
            })
            .addButton((button) => {
              button.setButtonText("Delete series").onClick(async () => {
                await this.plugin.removeCalendarEvent(event.sourceEventId);
                if (this.editingEventId === event.sourceEventId) {
                  this.clearEditingState();
                }
                await this.renderContent();
              });
            });
        } else {
          new Setting(contentEl)
            .setName("")
            .addButton((button) => {
              button.setButtonText("Delete").onClick(async () => {
                await this.plugin.removeCalendarEvent(event.sourceEventId);
                if (this.editingEventId === event.sourceEventId) {
                  this.clearEditingState();
                }
                await this.renderContent();
              });
            });
        }
      });
    }

    contentEl.createEl("h3", { text: this.editingOccurrenceOriginalDate ? `Edit occurrence from ${this.editingOccurrenceOriginalDate}` : this.editingEventId ? "Edit event" : "Add event" });

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
      .setName("End date")
      .setDesc("Same day unless this spans multiple days.")
      .addText((text) => {
        text
          .setPlaceholder("2026-04-01")
          .setValue(this.endDateValue || this.date)
          .onChange((value) => {
            this.endDateValue = value.trim();
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
      .setName("Category")
      .setDesc("Used to group calendar context across the dashboard.")
      .addDropdown((dropdown) => {
        dropdown.addOption("work", "Work");
        dropdown.addOption("health", "Health");
        dropdown.addOption("errands", "Errands");
        dropdown.addOption("social", "Social");
        dropdown.addOption("personal", "Personal");
        dropdown.setValue(this.categoryValue);
        dropdown.onChange((value) => {
          this.categoryValue = value === "work" || value === "health" || value === "errands" || value === "social" ? value : "personal";
        });
      });

    const projectChoiceListId = `daily-dashboard-calendar-projects-${this.initialDate.replace(/[^a-z0-9]/gi, "-")}-${this.editingEventId ?? "new"}`;
    const projectChoiceList = contentEl.createEl("datalist", { attr: { id: projectChoiceListId } });
    projectChoices.forEach((project) => {
      const option = projectChoiceList.createEl("option");
      option.value = project.name;
      option.label = project.wikiLink;
    });

    new Setting(contentEl)
      .setName("Project")
      .setDesc(this.projectNotePathValue
        ? `Linked to ${this.projectNotePathValue.replace(/\.md$/i, "")}.`
        : "Optional. Pick a known project or type a custom project name.")
      .addText((text) => {
        text
          .setPlaceholder("Optional project link")
          .setValue(this.projectNameValue)
          .onChange((value) => {
            this.setProjectSelection(value, projectChoices);
          });
        text.inputEl.setAttribute("list", projectChoiceListId);
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
      .setName("Prep minutes")
      .setDesc("How early prep should start before the event begins.")
      .addText((text) => {
        text
          .setPlaceholder("0")
          .setValue(this.prepMinutesValue)
          .onChange((value) => {
            this.prepMinutesValue = value.trim();
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
      });

    new Setting(contentEl)
      .setName("Travel minutes")
      .setDesc("Extra lead time before the event for travel.")
      .addText((text) => {
        text
          .setPlaceholder("0")
          .setValue(this.travelMinutesValue)
          .onChange((value) => {
            this.travelMinutesValue = value.trim();
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
      });

    if (!this.editingOccurrenceOriginalDate) {
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
            void this.renderContent();
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
    } else {
      contentEl.createEl("p", {
        cls: "daily-dashboard-row-meta",
        text: "This edits only the selected occurrence. Series recurrence rules stay unchanged."
      });
    }

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(this.editingEventId ? "Save changes" : "Add event").setCta().onClick(async () => {
          const input = {
            title: this.titleValue,
            date: this.date,
            endDate: this.endDateValue || this.date,
            startTime: this.startTimeValue,
            endTime: this.endTimeValue,
            prepMinutes: Number(this.prepMinutesValue || 0),
            travelMinutes: Number(this.travelMinutesValue || 0),
            category: this.categoryValue,
            projectName: this.projectNameValue,
            projectNotePath: this.projectNotePathValue,
            notes: this.notesValue,
            repeatCadence: this.repeatCadenceValue,
            repeatUntil: this.repeatUntilValue
          };

          if (this.editingEventId && this.editingOccurrenceOriginalDate) {
            await this.plugin.updateCalendarOccurrence(this.editingEventId, this.editingOccurrenceOriginalDate, input);
          } else if (this.editingEventId) {
            await this.plugin.updateCalendarEvent(this.editingEventId, input);
          } else {
            await this.plugin.addCalendarEvent(input);
          }
          this.clearEditingState();
          await this.renderContent();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("rotate-ccw").setTooltip("Reset form").onClick(() => {
          this.clearEditingState();
          void this.renderContent();
        });
      })
      .addExtraButton((button) => {
        button.setIcon("x").setTooltip("Close").onClick(() => {
          this.close();
        });
      });
  }

  private setProjectSelection(value: string, projectChoices: Array<{ name: string; notePath: string }>): void {
    this.projectNameValue = value.trim();
    const match = projectChoices.find((project) => project.name.toLowerCase() === this.projectNameValue.toLowerCase());
    this.projectNotePathValue = this.projectNameValue && match ? match.notePath : "";
  }

  private hydrateEditingState(): void {
    if (!this.editingEventId) {
      return;
    }

    if (this.editingOccurrenceOriginalDate) {
      const occurrence = this.plugin.getCalendarEventsForDate(this.date)
        .find((event) => event.sourceEventId === this.editingEventId && event.originalDate === this.editingOccurrenceOriginalDate);
      if (!occurrence) {
        this.clearEditingState();
        return;
      }

      this.date = occurrence.date;
      this.endDateValue = occurrence.endDate;
      this.titleValue = occurrence.title;
      this.startTimeValue = occurrence.startTime;
      this.endTimeValue = occurrence.endTime;
      this.prepMinutesValue = `${occurrence.prepMinutes}`;
      this.travelMinutesValue = `${occurrence.travelMinutes}`;
      this.categoryValue = occurrence.category;
      this.projectNameValue = occurrence.projectName;
      this.projectNotePathValue = occurrence.projectNotePath;
      this.notesValue = occurrence.notes;
      return;
    }

    const event = this.plugin.getCalendarEventEntry(this.editingEventId);
    if (!event) {
      this.clearEditingState();
      return;
    }

    this.date = event.date;
    this.endDateValue = event.endDate;
    this.titleValue = event.title;
    this.startTimeValue = event.startTime;
    this.endTimeValue = event.endTime;
    this.prepMinutesValue = `${event.prepMinutes}`;
    this.travelMinutesValue = `${event.travelMinutes}`;
    this.categoryValue = event.category;
    this.projectNameValue = event.projectName;
    this.projectNotePathValue = event.projectNotePath;
    this.notesValue = event.notes;
    this.repeatCadenceValue = event.repeatCadence;
    this.repeatUntilValue = event.repeatUntil;
  }

  private clearEditingState(): void {
    this.editingEventId = null;
    this.editingOccurrenceOriginalDate = null;
    this.date = this.initialDate;
    this.titleValue = "";
    this.endDateValue = this.initialDate;
    this.startTimeValue = "";
    this.endTimeValue = "";
    this.prepMinutesValue = "0";
    this.travelMinutesValue = "0";
    this.categoryValue = "personal";
    this.projectNameValue = "";
    this.projectNotePathValue = "";
    this.notesValue = "";
    this.repeatCadenceValue = "none";
    this.repeatUntilValue = "";
  }
}

export class DashboardLayoutModal extends Modal {
  private options: DashboardLayoutModalOptions;
  private cards: DashboardLayoutCardState[];
  private draggedCardKey: string | null = null;

  constructor(app: App, options: DashboardLayoutModalOptions) {
    super(app);
    this.options = options;
    this.cards = normalizeDashboardCardLayoutState(options.cards);
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-layout-modal");
    this.setTitle("Customize Dashboard Layout");
    this.renderContent();
  }

  onClose(): void {
    this.modalEl.removeClass("daily-dashboard-layout-modal");
    this.contentEl.empty();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Reorder cards, hide sections you do not use, and pin the few cards that should always rise to the top. Pinned cards still respect their relative order."
    });

    const list = contentEl.createDiv({ cls: "daily-dashboard-layout-list" });
    sortDashboardLayoutCardsByOrder(this.cards).forEach((card, index, orderedCards) => {
      const row = list.createDiv({ cls: "daily-dashboard-layout-row" });
      row.draggable = true;
      if (card.hidden) {
        row.addClass("is-hidden");
      }
      if (card.pinned) {
        row.addClass("is-pinned");
      }
      row.addEventListener("dragstart", (event) => {
        this.draggedCardKey = card.key;
        row.addClass("is-dragging");
        event.dataTransfer?.setData("text/plain", card.key);
      });
      row.addEventListener("dragover", (event) => {
        if (!this.draggedCardKey || this.draggedCardKey === card.key) {
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
        if (!this.draggedCardKey || this.draggedCardKey === card.key) {
          return;
        }

        this.moveCardToIndex(this.draggedCardKey, index);
        this.draggedCardKey = null;
        this.renderContent();
      });
      row.addEventListener("dragend", () => {
        this.draggedCardKey = null;
        row.removeClass("is-dragging");
        row.removeClass("is-drop-target");
      });

      const copy = row.createDiv({ cls: "daily-dashboard-stack" });
      copy.createEl("strong", { text: `${index + 1}. ${card.title}` });
      copy.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: [card.pinned ? "Pinned" : "Standard order", card.hidden ? "Hidden" : "Visible", card.width === "full" ? "Full width" : card.width === "half" ? "Half width" : "Default width"].join(" • ")
      });

      const controls = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      const widthSelect = controls.createEl("select", { cls: "daily-dashboard-input" });
      [["default", "Default width"], ["half", "Half width"], ["full", "Full width"]].forEach(([value, label]) => {
        const option = widthSelect.createEl("option", { text: label });
        option.value = value;
      });
      widthSelect.value = card.width;
      widthSelect.addEventListener("change", () => {
        this.cards = this.cards.map((candidate) => candidate.key === card.key
          ? { ...candidate, width: widthSelect.value === "half" || widthSelect.value === "full" ? widthSelect.value : "default" }
          : candidate);
      });
      createButton(controls, card.pinned ? "Unpin" : "Pin", async () => {
        this.togglePinned(card.key);
        this.renderContent();
      }, false, "pin");
      createButton(controls, card.hidden ? "Show" : "Hide", async () => {
        this.toggleHidden(card.key);
        this.renderContent();
      }, false, card.hidden ? "eye" : "eye-off");
    });

    const preview = contentEl.createDiv({ cls: "daily-dashboard-chip-row" });
    const orderedPreview = sortDashboardLayoutCards(this.cards).filter((card) => !card.hidden);
    createSemanticChip(preview, `${orderedPreview.length} visible`, orderedPreview.length > 0 ? "done" : "alert");
    createSemanticChip(preview, `${this.cards.filter((card) => card.pinned).length} pinned`, this.cards.some((card) => card.pinned) ? "focus" : "neutral");
    createSemanticChip(preview, `${this.cards.filter((card) => card.hidden).length} hidden`, this.cards.some((card) => card.hidden) ? "log" : "neutral");

    const footer = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(footer, "Reset defaults", async () => {
      this.cards = DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
      this.renderContent();
    }, false, "rotate-ccw");
    createButton(footer, "Apply layout", async () => {
      const normalized = normalizeDashboardCardLayoutState(this.cards);
      await this.options.onApply(normalized);
      this.close();
    }, true, "check");
    createButton(footer, "Cancel", async () => {
      this.close();
    }, false, "x");
  }

  private moveCardToIndex(cardKey: string, targetIndex: number): void {
    const ordered = sortDashboardLayoutCardsByOrder(this.cards);
    const index = ordered.findIndex((card) => card.key === cardKey);
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const next = ordered.map((card) => ({ ...card }));
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    this.cards = normalizeDashboardCardLayoutState(next.map((card, orderedIndex) => ({ ...card, order: orderedIndex })));
  }

  private togglePinned(cardKey: string): void {
    this.cards = this.cards.map((card) => card.key === cardKey ? { ...card, pinned: !card.pinned } : card);
  }

  private toggleHidden(cardKey: string): void {
    this.cards = this.cards.map((card) => card.key === cardKey ? { ...card, hidden: !card.hidden } : card);
  }
}

export class DashboardShortcutHelpModal extends Modal {
  onOpen(): void {
    this.setTitle("Dashboard Keyboard Shortcuts");
    const { contentEl } = this;
    contentEl.empty();

    DASHBOARD_SHORTCUTS.forEach((shortcut) => {
      new Setting(contentEl)
        .setName(shortcut.label)
        .setDesc(`${shortcut.keys} • ${shortcut.description}`);
    });

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Shortcuts only fire while focus is inside the dashboard and never while you are typing in an input, textarea, or select field."
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FirstRunSetupWizardModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private stepIndex = 0;
  private settingsValue: DashboardSettings;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
    this.settingsValue = { ...plugin.getSettings() };
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-setup-modal");
    this.renderContent();
  }

  onClose(): void {
    this.modalEl.removeClass("daily-dashboard-setup-modal");
    this.contentEl.empty();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(`First-Run Setup • Step ${this.stepIndex + 1} of 4`);

    const intro = contentEl.createDiv({ cls: "daily-dashboard-setup-intro" });
    intro.createEl("strong", { text: FIRST_RUN_SETUP_STEPS[this.stepIndex].title });
    intro.createEl("span", { cls: "daily-dashboard-row-meta", text: FIRST_RUN_SETUP_STEPS[this.stepIndex].description });

    const progress = contentEl.createDiv({ cls: "daily-dashboard-chip-row" });
    FIRST_RUN_SETUP_STEPS.forEach((step, index) => {
      createSemanticChip(progress, `${index + 1}. ${step.shortLabel}`, index === this.stepIndex ? "focus" : index < this.stepIndex ? "done" : "neutral");
    });

    switch (this.stepIndex) {
      case 0:
        this.renderIdentityStep(contentEl);
        break;
      case 1:
        this.renderProjectWorkflowStep(contentEl);
        break;
      case 2:
        this.renderTrackingStep(contentEl);
        break;
      default:
        this.renderAiStep(contentEl);
        break;
    }

    const footer = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(footer, "Close for now", async () => {
      await this.plugin.snoozeFirstRunSetupWizard(12);
      this.close();
    }, false, "x");
    if (this.stepIndex > 0) {
      createButton(footer, "Back", async () => {
        this.stepIndex -= 1;
        this.renderContent();
      }, false, "arrow-left");
    }
    if (this.stepIndex < FIRST_RUN_SETUP_STEPS.length - 1) {
      createButton(footer, "Next", async () => {
        this.stepIndex += 1;
        this.renderContent();
      }, true, "arrow-right");
    } else {
      createButton(footer, "Save and open dashboard", async () => {
        await this.plugin.updateSettings(this.settingsValue);
        await this.plugin.completeFirstRunSetupWizard();
        await this.plugin.activateDashboardView();
        this.close();
      }, true, "check");
    }
  }

  private renderIdentityStep(parent: HTMLElement): void {
    new Setting(parent)
      .setName("Dashboard title")
      .setDesc("Shown in the hero area at the top of the dashboard.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dashboardTitle)
          .setValue(this.settingsValue.dashboardTitle)
          .onChange((value) => {
            this.settingsValue.dashboardTitle = value.trim() || DEFAULT_SETTINGS.dashboardTitle;
          });
      });

    new Setting(parent)
      .setName("Daily log folder")
      .setDesc("Where readable per-day markdown logs are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.dailyLogFolder)
          .setValue(this.settingsValue.dailyLogFolder)
          .onChange((value) => {
            this.settingsValue.dailyLogFolder = value.trim() || DEFAULT_SETTINGS.dailyLogFolder;
          });
      });
  }

  private renderProjectWorkflowStep(parent: HTMLElement): void {
    new Setting(parent)
      .setName("Master task hub path")
      .setDesc("The markdown note used for project health, quick add, promotion, and cleanup workflows.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.masterTodoPath)
          .setValue(this.settingsValue.masterTodoPath)
          .onChange((value) => {
            this.settingsValue.masterTodoPath = value.trim() || DEFAULT_SETTINGS.masterTodoPath;
          });
      });

    new Setting(parent)
      .setName("Project notes folder")
      .setDesc("Where new project notes will be created by the dashboard intake flow.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.projectNotesFolder)
          .setValue(this.settingsValue.projectNotesFolder)
          .onChange((value) => {
            this.settingsValue.projectNotesFolder = value.trim() || DEFAULT_SETTINGS.projectNotesFolder;
          });
      });

    const tips = parent.createDiv({ cls: "daily-dashboard-ai-suggestions" });
    [
      "Point the plugin at the same master task hub you already use for active project checklists.",
      "If you do not have one yet, keep the default path and create the note later from the dashboard flows."
    ].forEach((tip) => {
      const row = tips.createDiv({ cls: "daily-dashboard-project-row" });
      row.createEl("span", { text: tip });
    });
  }

  private renderTrackingStep(parent: HTMLElement): void {
    new Setting(parent)
      .setName("Weekly report folder")
      .setDesc("Where generated weekly summaries should be written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.weeklyReportFolder)
          .setValue(this.settingsValue.weeklyReportFolder)
          .onChange((value) => {
            this.settingsValue.weeklyReportFolder = value.trim() || DEFAULT_SETTINGS.weeklyReportFolder;
          });
      });

    new Setting(parent)
      .setName("Monthly report folder")
      .setDesc("Where generated monthly summaries should be written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.monthlyReportFolder)
          .setValue(this.settingsValue.monthlyReportFolder)
          .onChange((value) => {
            this.settingsValue.monthlyReportFolder = value.trim() || DEFAULT_SETTINGS.monthlyReportFolder;
          });
      });

    new Setting(parent)
      .setName("Export folder")
      .setDesc("Where markdown and CSV dashboard exports should land.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.exportFolder)
          .setValue(this.settingsValue.exportFolder)
          .onChange((value) => {
            this.settingsValue.exportFolder = value.trim() || DEFAULT_SETTINGS.exportFolder;
          });
      });

    new Setting(parent)
      .setName("Enable calendar")
      .setDesc("Turns on recurring events, reminders, and agenda cards.")
      .addToggle((toggle) => {
        toggle.setValue(this.settingsValue.calendarEnabled).onChange((value) => {
          this.settingsValue.calendarEnabled = value;
        });
      });

    new Setting(parent)
      .setName("Calendar document path")
      .setDesc("Markdown file used to mirror dashboard calendar data for review and AI context.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.calendarDocumentPath)
          .setValue(this.settingsValue.calendarDocumentPath)
          .onChange((value) => {
            this.settingsValue.calendarDocumentPath = value.trim() || DEFAULT_SETTINGS.calendarDocumentPath;
          });
      });
  }

  private renderAiStep(parent: HTMLElement): void {
    new Setting(parent)
      .setName("AI output folder")
      .setDesc("Where AI-generated markdown notes should be written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiOutputFolder)
          .setValue(this.settingsValue.aiOutputFolder)
          .onChange((value) => {
            this.settingsValue.aiOutputFolder = value.trim() || DEFAULT_SETTINGS.aiOutputFolder;
          });
      });

    new Setting(parent)
      .setName("AI key source")
      .setDesc("Environment variable is safer if you already keep the key outside plugin data.")
      .addDropdown((dropdown) => {
        dropdown.addOption("settings", "Stored in plugin settings");
        dropdown.addOption("env", "Environment variable");
        dropdown.setValue(this.settingsValue.aiApiKeySource);
        dropdown.onChange((value) => {
          this.settingsValue.aiApiKeySource = value === "env" ? "env" : "settings";
          this.renderContent();
        });
      });

    if (this.settingsValue.aiApiKeySource === "env") {
      new Setting(parent)
        .setName("Environment variable name")
        .setDesc("The environment variable the plugin will read for the API key.")
        .addText((text) => {
          text
            .setPlaceholder(DEFAULT_SETTINGS.aiApiKeyEnvVar)
            .setValue(this.settingsValue.aiApiKeyEnvVar)
            .onChange((value) => {
              this.settingsValue.aiApiKeyEnvVar = value.trim() || DEFAULT_SETTINGS.aiApiKeyEnvVar;
            });
        });
    } else {
      new Setting(parent)
        .setName("AI API key")
        .setDesc("Optional. Leave blank if you want to configure AI later.")
        .addText((text) => {
          text
            .setPlaceholder("sk-...")
            .setValue(this.settingsValue.aiApiKey)
            .onChange((value) => {
              this.settingsValue.aiApiKey = value.trim();
            });
          text.inputEl.type = "password";
        });
    }

    new Setting(parent)
      .setName("AI model")
      .setDesc("Default chat model for dashboard AI workflows.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiModel)
          .setValue(this.settingsValue.aiModel)
          .onChange((value) => {
            this.settingsValue.aiModel = value.trim() || DEFAULT_SETTINGS.aiModel;
          });
      });
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
        ["Planning", "Active", "Parked", "Blocked", "Incubating", "Someday"].forEach((status) => dropdown.addOption(status, status));
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

    const timelineSection = contentEl.createDiv({ cls: "daily-dashboard-repair-timeline" });
    timelineSection.createEl("h3", { text: "Manual timeline editor" });
    timelineSection.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Edit the actual tracked sessions for work, naps, relax, breaks, and bowel tracking. When a session exists here, its minute override is cleared on apply so reports use the repaired timeline."
    });
    this.renderRepairTimelineEditor(timelineSection);

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

  private renderTimelineStrip(parent: HTMLElement, sessions: TimelineStripSession[], date: string, fallbackEnd: string, emptyText: string): void {
    if (sessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }

    const parsedSessions = sessions
      .map((session) => ({
        ...session,
        startDate: new Date(session.start.replace(" ", "T")),
        endDate: new Date((session.end || fallbackEnd).replace(" ", "T"))
      }))
      .filter((session) => !Number.isNaN(session.startDate.getTime()) && !Number.isNaN(session.endDate.getTime()) && session.endDate.getTime() > session.startDate.getTime());

    if (parsedSessions.length === 0) {
      parent.createDiv({ cls: "daily-dashboard-row-meta", text: emptyText });
      return;
    }

    const startBoundary = new Date(`${date}T00:00:00`);
    const endBoundary = new Date(`${date}T23:59:00`);
    const totalSpan = endBoundary.getTime() - startBoundary.getTime();
    const strip = parent.createDiv({ cls: "daily-dashboard-timeline-strip" });
    parsedSessions.forEach((session) => {
      const segment = strip.createDiv({ cls: `daily-dashboard-timeline-segment is-${session.kind}` });
      const left = ((session.startDate.getTime() - startBoundary.getTime()) / totalSpan) * 100;
      const width = ((session.endDate.getTime() - session.startDate.getTime()) / totalSpan) * 100;
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${session.end.slice(11, 16)}${session.tag ? ` • ${session.tag}` : ""}`;
    });

    const scale = parent.createDiv({ cls: "daily-dashboard-timeline-scale" });
    ["00:00", "06:00", "12:00", "18:00", "24:00"].forEach((label) => {
      scale.createEl("span", { text: label });
    });
  }

  private renderRepairTimelineEditor(parent: HTMLElement): void {
    const sessionKinds: Array<{ kind: RepairTimelineSessionKind; label: string; tone: DashboardTone }> = [
      { kind: "work", label: "Work", tone: "capture" },
      { kind: "nap", label: "Nap", tone: "health" },
      { kind: "relax", label: "Relax", tone: "health" },
      { kind: "break", label: "Break", tone: "alert" },
      { kind: "poop", label: "Poop", tone: "log" }
    ];

    const groupedSessions = sessionKinds.map((config) => ({
      ...config,
      sessions: this.state.timelineSessions.filter((session) => session.kind === config.kind)
    }));

    this.renderTimelineStrip(
      parent,
      this.state.timelineSessions.map((session) => ({ ...session, end: session.end || session.start })),
      this.state.date,
      this.state.dayEndedAt || this.state.sleepTime || this.state.dayStartedAt || this.state.wakeTime,
      "No timeline sessions in this repair draft yet."
    );

    groupedSessions.forEach((group) => {
      const block = parent.createDiv({ cls: "daily-dashboard-score-block" });
      const header = block.createDiv({ cls: "daily-dashboard-score-header" });
      header.createEl("strong", { text: group.label });
      createSemanticChip(header, `${group.sessions.length} session${group.sessions.length === 1 ? "" : "s"}`, group.tone);

      if (group.sessions.length === 0) {
        block.createDiv({ cls: "daily-dashboard-row-meta", text: `No ${group.label.toLowerCase()} sessions in this repair draft.` });
      }

      group.sessions.forEach((session) => {
        const row = block.createDiv({ cls: "daily-dashboard-repair-session-row" });
        const startInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "datetime-local" }
        });
        startInput.value = this.toDateTimeLocalValue(session.start);
        startInput.addEventListener("change", () => {
          session.start = startInput.value.trim();
        });

        const endInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "datetime-local" }
        });
        endInput.value = this.toDateTimeLocalValue(session.end);
        endInput.addEventListener("change", () => {
          session.end = endInput.value.trim();
        });

        const tagInput = row.createEl("input", {
          cls: "daily-dashboard-input",
          attr: { type: "text", placeholder: "Optional tag" }
        });
        tagInput.value = session.tag;
        tagInput.addEventListener("change", () => {
          session.tag = tagInput.value.trim();
        });

        const removeButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
        removeButton.type = "button";
        removeButton.addEventListener("click", () => {
          this.state.timelineSessions = this.state.timelineSessions.filter((candidate) => candidate.id !== session.id);
          this.onOpen();
        });
      });

      const addButtonRow = block.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(addButtonRow, `Add ${group.label}`, async () => {
        this.state.timelineSessions = [
          ...this.state.timelineSessions,
          this.createRepairTimelineSession(group.kind)
        ];
        this.onOpen();
      }, false, "plus");
    });
  }

  private createRepairTimelineSession(kind: RepairTimelineSessionKind): RepairTimelineSession {
    const baseStart = this.state.dayStartedAt || this.state.wakeTime || `${this.state.date} 09:00`;
    const [datePart, timePart = "09:00"] = baseStart.split(" ");
    const [hourText, minuteText] = timePart.split(":");
    const nextHour = `${Math.min(23, Number(hourText) + 1)}`.padStart(2, "0");
    return {
      id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      start: `${datePart} ${`${hourText ?? "09"}`.padStart(2, "0")}:${`${minuteText ?? "00"}`.padStart(2, "0")}`,
      end: `${datePart} ${nextHour}:${`${minuteText ?? "00"}`.padStart(2, "0")}`,
      tag: ""
    };
  }
}

interface TimelineStripSession {
  id: string;
  kind: RepairTimelineSessionKind | ActivitySessionKind;
  start: string;
  end: string;
  tag: string;
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

  private formatTodoTaskMeta(task: TodoTaskSummary): string {
    return [
      task.section,
      task.dueDate ? `Due ${task.dueDate}` : "",
      task.isOverdue ? "Overdue" : task.isDueSoon ? "Due soon" : "",
      task.blockedReason ? `Blocked: ${task.blockedReason}` : "",
      task.unblockDate ? `Unblock ${task.unblockDate}` : ""
    ].filter((value) => value.length > 0).join(" • ");
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
      ...selectedProject?.nowTaskDetails ?? [],
      ...selectedProject?.nextTaskDetails ?? [],
      ...(selectedProject?.breakdownTasks ?? []).map((task) => ({
        text: task,
        rawText: task,
        section: "Breakdown",
        dueDate: "",
        blockedReason: "",
        unblockDate: "",
        isBlocked: false,
        isDueSoon: false,
        isOverdue: false
      }))
    ].slice(0, 20);

    if (candidateTasks.length === 0) {
      contentEl.createEl("p", { text: "No promotable tasks found for this project." });
    } else {
      candidateTasks.forEach((task) => {
        new Setting(contentEl)
          .setName(task.text)
          .setDesc(this.formatTodoTaskMeta(task))
          .addButton((button) => {
            button.setButtonText("Promote").setCta().onClick(async () => {
              await this.plugin.promoteTaskToToday(this.selectedProjectName, task.text);
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
  private selectedProjectName: string;

  constructor(app: App, plugin: DailyDashboardPlugin, options: ProjectReviewOption[]) {
    super(app);
    this.plugin = plugin;
    this.options = options;
    this.selectedProjectName = options[0]?.projectName ?? "";
  }

  onOpen(): void {
    this.setTitle("Open Project Review Mode");
    const { contentEl } = this;
    contentEl.empty();

    if (this.options.length > 1) {
      new Setting(contentEl)
        .setName("Project")
        .setDesc("Choose which project to open in review mode.")
        .addDropdown((dropdown) => {
          this.options.forEach((option) => dropdown.addOption(option.projectName, option.projectName));
          dropdown.setValue(this.selectedProjectName);
          dropdown.onChange((value) => {
            this.selectedProjectName = value;
            this.onOpen();
          });
        });
    }

    const selectedOption = this.options.find((option) => option.projectName === this.selectedProjectName) ?? this.options[0];
    if (!selectedOption) {
      contentEl.createEl("p", { text: "No project notes found for review mode." });
      return;
    }

    const hero = contentEl.createDiv({ cls: "daily-dashboard-project-review-panel" });
    hero.createEl("h3", { text: selectedOption.projectName });
    const chipRow = hero.createDiv({ cls: "daily-dashboard-chip-row" });
    createSemanticChip(chipRow, selectedOption.healthLabel, selectedOption.healthScore >= 75 ? "focus" : selectedOption.healthScore >= 50 ? "state" : "alert");
    createSemanticChip(chipRow, selectedOption.projectState === "active" ? "Active" : selectedOption.projectState === "incubating" ? "Incubating" : "Someday", selectedOption.projectState === "active" ? "neutral" : "log");
    createSemanticChip(chipRow, selectedOption.status, "capture");
    hero.createEl("p", { cls: "daily-dashboard-row-meta", text: selectedOption.notePath });
    hero.createEl("p", { cls: "daily-dashboard-row-meta", text: `Next action: ${selectedOption.nextAction}` });
    renderProjectMomentum(hero, selectedOption);

    const details = contentEl.createDiv({ cls: "daily-dashboard-project-list" });
    if (selectedOption.healthReasons.length > 0) {
      const row = details.createDiv({ cls: "daily-dashboard-project-row" });
      row.createEl("strong", { text: "Health signals" });
      row.createEl("span", { cls: "daily-dashboard-row-meta", text: selectedOption.healthReasons.join(" • ") });
    }
    const pressureRow = details.createDiv({ cls: "daily-dashboard-project-row" });
    pressureRow.createEl("strong", { text: "Task pressure" });
    pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue ${selectedOption.overdueTasks.length} • Due soon ${selectedOption.dueSoonTasks.length} • Blocked ${selectedOption.blockedTasks.length}` });
    if (selectedOption.overdueTasks.length > 0) {
      pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Overdue tasks: ${selectedOption.overdueTasks.slice(0, 3).map((task) => task.text).join(" • ")}` });
    }
    if (selectedOption.blockedTasks.length > 0) {
      pressureRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Blocked tasks: ${selectedOption.blockedTasks.slice(0, 3).map((task) => task.blockedReason ? `${task.text} (${task.blockedReason})` : task.text).join(" • ")}` });
    }
    if (selectedOption.duplicateTasks.length > 0 || selectedOption.emptySections.length > 0) {
      const cleanupRow = details.createDiv({ cls: "daily-dashboard-project-row" });
      cleanupRow.createEl("strong", { text: "Cleanup signals" });
      if (selectedOption.duplicateTasks.length > 0) {
        cleanupRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Duplicates: ${selectedOption.duplicateTasks.slice(0, 5).join(" • ")}` });
      }
      if (selectedOption.emptySections.length > 0) {
        cleanupRow.createEl("span", { cls: "daily-dashboard-row-meta", text: `Empty sections: ${selectedOption.emptySections.join(" • ")}` });
      }
    }

    const actions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(actions, "Open split view", async () => {
      await this.plugin.openProjectReviewMode(selectedOption);
      this.close();
    }, true, "layout-panel-left");
    createButton(actions, "Structured review", async () => {
      await this.plugin.openStructuredProjectReview(selectedOption);
      this.close();
    }, false, "clipboard-list");

    const list = contentEl.createDiv({ cls: "daily-dashboard-project-list" });
    this.options.forEach((option) => {
      new Setting(list)
        .setName(option.projectName)
        .setDesc(`${option.healthLabel} • ${option.completionsThisWeek} this week • ${option.status}`)
        .addButton((button) => {
          button.setButtonText(option.projectName === selectedOption.projectName ? "Selected" : "Select").setCta().onClick(() => {
            this.selectedProjectName = option.projectName;
            this.onOpen();
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
    containerEl.addClass("daily-dashboard-settings-tab");
    containerEl.createEl("h2", { text: "Daily Dashboard" });

    new Setting(containerEl)
      .setName("Setup wizard")
      .setDesc("Launch the guided setup flow again if you want to re-walk the initial dashboard configuration.")
      .addButton((button) => {
        button.setButtonText("Open wizard").setCta().onClick(() => {
          void this.plugin.openFirstRunSetupWizard();
        });
      });

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
      .setName("Export folder")
      .setDesc("Where markdown summaries and CSV metric dumps are written.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.exportFolder)
          .setValue(settings.exportFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              exportFolder: value.trim() || DEFAULT_SETTINGS.exportFolder
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

    containerEl.createEl("h3", { text: "Tracking" });

    new Setting(containerEl)
      .setName("Measurement system")
      .setDesc("Controls default liquid units and quick-add presets for hydration or similar tracked amounts.")
      .addDropdown((dropdown) => {
        dropdown.addOption("imperial", "Imperial (oz, cup)");
        dropdown.addOption("metric", "Metric (mL)");
        dropdown.setValue(settings.measurementSystem);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            measurementSystem: value === "metric" ? "metric" : "imperial"
          });
        });
      });

    new Setting(containerEl)
      .setName("Weight goal target")
      .setDesc("Used by the exercise card to compare logged body weight against the current goal.")
      .addText((text) => {
        text
          .setPlaceholder("0")
          .setValue(`${settings.weightGoalTarget}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              weightGoalTarget: Math.max(Number(value.trim() || 0), 0)
            });
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.step = "0.1";
      });

    new Setting(containerEl)
      .setName("Weight goal mode")
      .setDesc("Choose whether current training should bias toward losing, maintaining, or gaining weight.")
      .addDropdown((dropdown) => {
        dropdown.addOption("lose", "Lose");
        dropdown.addOption("maintain", "Maintain");
        dropdown.addOption("gain", "Gain");
        dropdown.setValue(settings.weightGoalMode);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            weightGoalMode: value === "lose" || value === "gain" ? value : "maintain"
          });
        });
      });

    new Setting(containerEl)
      .setName("Weekly weight pace")
      .setDesc("Target rate of change per week for the current goal, using the active measurement system.")
      .addText((text) => {
        text
          .setPlaceholder(`${DEFAULT_SETTINGS.weightGoalWeeklyRate}`)
          .setValue(`${settings.weightGoalWeeklyRate}`)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              weightGoalWeeklyRate: Math.max(Number(value.trim() || DEFAULT_SETTINGS.weightGoalWeeklyRate), 0)
            });
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.step = "0.1";
      });

    new Setting(containerEl)
      .setName("Show undo notifications")
      .setDesc("Keep the undo stack active while choosing whether the dashboard shows the undo banner after destructive actions.")
      .addToggle((toggle) => {
        toggle.setValue(settings.showUndoNotifications).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            showUndoNotifications: value
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
      .setName("AI prompt templates")
      .setDesc("Optional local workflow instructions. Use [workflow-key] headings such as [morning-startup-brief] or [project-risk-scanner], then write the extra instructions below each heading.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder(DEFAULT_SETTINGS.aiPromptTemplates)
          .setValue(settings.aiPromptTemplates)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiPromptTemplates: value
            });
          });

        textArea.inputEl.rows = 14;
        textArea.inputEl.cols = 36;
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
      .setDesc("One habit per line using Habit Name|Target Count|Window|Cadence|Weight|Anchor Date. Older shorter lines still work.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Take pills|1|morning|daily|2\nWater plants|1|anytime|every-other-day|1\nTrash night|1|evening|weekly|1|2026-04-01")
          .setValue(settings.habitDefinitions.map((habit) => `${habit.label}|${habit.target}|${habit.completionWindow}|${habit.cadence}|${habit.difficultyWeight}|${habit.anchorDate}`).join("\n"))
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              habitDefinitions: parseHabitDefinitions(value)
            });
          });

        textArea.inputEl.rows = 8;
        textArea.inputEl.cols = 36;
      });

    new Setting(containerEl)
      .setName("Habit automations")
      .setDesc("One automation per line using Habit Name|Kind|Label|Amount|Unit|Optional Note. Each time the habit count increases, matching consumables are logged at that timestamp.")
      .addTextArea((textArea) => {
        const habitLabelById = new Map(settings.habitDefinitions.map((habit) => [habit.id, habit.label]));
        textArea
          .setPlaceholder("Take pills|medication|Vyvanse|1|capsule\nTake pills|supplement|Vitamin D|1|softgel")
          .setValue(settings.habitAutomations.map((automation) => `${habitLabelById.get(automation.habitId) ?? automation.habitId}|${automation.intakeKind}|${automation.label}|${automation.amount}|${automation.unit}|${automation.note}`).join("\n"))
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              habitAutomations: parseHabitAutomations(value, this.plugin.getHabitDefinitions())
            });
          });

        textArea.inputEl.rows = 6;
        textArea.inputEl.cols = 36;
      });

    new Setting(containerEl)
      .setName("Routine templates")
      .setDesc("One routine per line using Label|HH:MM|HH:MM. These appear in Day Flow when their time window is due or coming up.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Morning meds|06:00|09:00\nLunch reset|12:00|14:00\nEvening shutdown|20:00|22:30")
          .setValue(settings.routineTemplates)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              routineTemplates: value
            });
          });

        textArea.inputEl.rows = 6;
        textArea.inputEl.cols = 36;
      });
  }
}

type DashboardLayoutCardState = {
  key: string;
  title: string;
  order: number;
  hidden: boolean;
  pinned: boolean;
  width: "default" | "half" | "full";
};

type DashboardLayoutCardBinding = {
  key: string;
  card: HTMLElement;
};

type DashboardCardDropPosition = "before" | "after";

type DashboardLayoutModalOptions = {
  cards: DashboardLayoutCardState[];
  onApply: (cards: DashboardLayoutCardState[]) => Promise<void>;
};

type DashboardShortcutDefinition = {
  keys: string;
  label: string;
  description: string;
};

type DashboardUndoAction = {
  label: string;
  undo: () => Promise<void>;
};

type FirstRunSetupStep = {
  shortLabel: string;
  title: string;
  description: string;
};

const DASHBOARD_CARD_COLLAPSE_STORAGE_KEY = "daily-dashboard-collapsed-cards";
const DASHBOARD_EXPANDED_SECTIONS_STORAGE_KEY = "daily-dashboard-expanded-sections";
const DASHBOARD_VIEW_MODE_STORAGE_KEY = "daily-dashboard-view-mode";
const DASHBOARD_COLLAPSED_SUBSECTIONS_STORAGE_KEY = "daily-dashboard-collapsed-subsections";
const DASHBOARD_DISMISSED_REMINDERS_STORAGE_KEY = "daily-dashboard-dismissed-reminders";
const DASHBOARD_SELECTED_SESSION_TAG_STORAGE_KEY = "daily-dashboard-selected-session-tag";
const DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY = "daily-dashboard-dismissed-routines";
const DASHBOARD_SAVED_FILTERS_STORAGE_KEY = "daily-dashboard-saved-filters";
const DASHBOARD_SELECTED_FILTER_STORAGE_KEY = "daily-dashboard-selected-filter";
const DASHBOARD_CARD_LAYOUT_STORAGE_KEY = "daily-dashboard-card-layout";
const DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY = "daily-dashboard-textarea-heights";

const DEFAULT_DASHBOARD_LAYOUT_CARDS: DashboardLayoutCardState[] = [
  { key: "week-at-a-glance", title: "Week At A Glance", order: 0, hidden: false, pinned: false, width: "full" },
  { key: "weekly-agenda", title: "Weekly Agenda", order: 1, hidden: false, pinned: false, width: "full" },
  { key: "day-flow", title: "Day Flow", order: 2, hidden: false, pinned: true, width: "full" },
  { key: "top-3-for-today", title: "Top 3 For Today", order: 3, hidden: false, pinned: false, width: "default" },
  { key: "state-and-friction", title: "Vitals", order: 4, hidden: false, pinned: false, width: "default" },
  { key: "gamification-center", title: "Gamification Center", order: 5, hidden: false, pinned: false, width: "default" },
  { key: "habits", title: "Habits", order: 6, hidden: false, pinned: false, width: "default" },
  { key: "food-log", title: "Consumables", order: 7, hidden: false, pinned: false, width: "default" },
  { key: "exercise-weight", title: "Exercise & Weight", order: 8, hidden: false, pinned: false, width: "default" },
  { key: "sleep-and-notes", title: "Sleep And Notes", order: 9, hidden: false, pinned: false, width: "default" },
  { key: "timeline-search", title: "Timeline Search", order: 10, hidden: false, pinned: false, width: "default" },
  { key: "heatmaps", title: "Heatmaps", order: 11, hidden: false, pinned: false, width: "default" },
  { key: "ai-workspace", title: "AI Workspace", order: 12, hidden: false, pinned: false, width: "full" },
  { key: "project-health", title: "Project Health", order: 13, hidden: false, pinned: false, width: "default" },
  { key: "stale-work-and-cleanup", title: "Stale Work And Cleanup", order: 14, hidden: false, pinned: false, width: "default" }
];

const DASHBOARD_SHORTCUTS: DashboardShortcutDefinition[] = [
  { keys: "Alt+Shift+V", label: "Cycle view mode", description: "Switch between mobile, compact, and widescreen modes." },
  { keys: "Alt+Shift+L", label: "Open layout editor", description: "Customize card order, pinned cards, and hidden cards." },
  { keys: "Alt+Shift+N", label: "Create project", description: "Open the new-project flow from anywhere inside the dashboard." },
  { keys: "Alt+Shift+W", label: "Weekly review", description: "Generate the weekly review note." },
  { keys: "Alt+Shift+R", label: "Refresh dashboard", description: "Rerender the dashboard with the latest state." },
  { keys: "Alt+Shift+F", label: "Quick capture focus", description: "Open the fast focus-capture flow." },
  { keys: "Alt+Shift+A", label: "Ask AI", description: "Open the dashboard ask-AI modal." },
  { keys: "Alt+Shift+S", label: "Sync repeating tasks", description: "Run repeating-task sync against the project hub." },
  { keys: "Alt+Shift+Z", label: "Undo last action", description: "Undo the most recent dashboard destructive action even if the banner is hidden." },
  { keys: "Alt+Shift+?", label: "Show shortcut help", description: "Open this shortcut list." }
];

const FIRST_RUN_SETUP_STEPS: FirstRunSetupStep[] = [
  {
    shortLabel: "Identity",
    title: "Name the dashboard and log destination",
    description: "Start with the title and daily-log location so the dashboard writes somewhere intentional from day one."
  },
  {
    shortLabel: "Projects",
    title: "Connect the project workflow",
    description: "Point the plugin at the master task hub and project-notes folder used for health, quick add, and cleanup flows."
  },
  {
    shortLabel: "Tracking",
    title: "Confirm reporting and calendar paths",
    description: "Set the output folders for weekly, monthly, and export files, then decide whether the calendar should be active immediately."
  },
  {
    shortLabel: "AI",
    title: "Choose the AI defaults",
    description: "Pick where AI notes go and whether the plugin should read its key from settings or an environment variable."
  }
];

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

function renderGamificationSnapshotCard(parent: HTMLElement, snapshot: GamificationSummary["today"]): void {
  const card = parent.createDiv({ cls: "daily-dashboard-score-block daily-dashboard-gamification-card" });
  const header = card.createDiv({ cls: "daily-dashboard-score-header" });
  header.createEl("strong", { text: `${snapshot.label} • ${snapshot.score}/100 ${snapshot.grade}` });
  header.createEl("span", { cls: "daily-dashboard-row-meta", text: snapshot.comparisonText });
  const chipRow = card.createDiv({ cls: "daily-dashboard-chip-row" });
  snapshot.highlights.slice(0, 3).forEach((item) => createSemanticChip(chipRow, item, "done"));
  snapshot.cautions.slice(0, 3).forEach((item) => createSemanticChip(chipRow, item, "alert"));
  const categoryList = card.createDiv({ cls: "daily-dashboard-momentum" });
  snapshot.categories.forEach((category) => {
    const row = categoryList.createDiv({ cls: "daily-dashboard-gamification-row" });
    const copy = row.createDiv({ cls: "daily-dashboard-stack" });
    copy.createEl("strong", { text: `${category.label} • ${category.score}/100` });
    copy.createEl("span", { cls: "daily-dashboard-row-meta", text: category.summary });
    if (category.details.length > 0) {
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: category.details.join(" • ") });
    }
    const trackRow = row.createDiv({ cls: "daily-dashboard-momentum-row" });
    trackRow.createSpan({ cls: "daily-dashboard-momentum-label", text: "Score" });
    const track = trackRow.createDiv({ cls: "daily-dashboard-momentum-track" });
    const fill = track.createDiv({ cls: "daily-dashboard-momentum-fill" });
    fill.addClass(`is-${category.tone === "done" ? "done" : category.tone === "alert" ? "alert" : category.tone === "log" ? "log" : "focus"}`);
    fill.style.width = `${Math.max((category.score / category.maxScore) * 100, category.score > 0 ? 10 : 0)}%`;
    trackRow.createSpan({ cls: "daily-dashboard-momentum-value", text: `${category.score}` });
  });
}

function renderProjectMomentum(parent: HTMLElement, project: Pick<TodoProjectSummary, "completionsPreviousWeek" | "completionsThisWeek" | "completionsThisMonth">): void {
  const maxValue = Math.max(project.completionsPreviousWeek, project.completionsThisWeek, project.completionsThisMonth, 1);
  const wrap = parent.createDiv({ cls: "daily-dashboard-momentum" });
  renderMomentumBar(wrap, "Prev week", project.completionsPreviousWeek, maxValue, "log");
  renderMomentumBar(wrap, "This week", project.completionsThisWeek, maxValue, project.completionsThisWeek >= project.completionsPreviousWeek ? "done" : "alert");
  renderMomentumBar(wrap, "Month", project.completionsThisMonth, maxValue, "focus");
}

function renderMomentumBar(parent: HTMLElement, label: string, value: number, maxValue: number, tone: "focus" | "done" | "alert" | "log"): void {
  const row = parent.createDiv({ cls: "daily-dashboard-momentum-row" });
  row.createSpan({ cls: "daily-dashboard-momentum-label", text: label });
  const track = row.createDiv({ cls: "daily-dashboard-momentum-track" });
  const fill = track.createDiv({ cls: "daily-dashboard-momentum-fill" });
  fill.addClass(`is-${tone}`);
  fill.style.width = `${Math.max((value / maxValue) * 100, value > 0 ? 10 : 0)}%`;
  row.createSpan({ cls: "daily-dashboard-momentum-value", text: `${value}` });
}

function getProjectIssueCount(project: Pick<TodoProjectSummary, "staleDays" | "duplicateTasks" | "emptySections" | "breakdownTasks" | "overdueTasks" | "blockedTasks">): number {
  return (project.staleDays !== null ? 1 : 0)
    + project.duplicateTasks.length
    + project.emptySections.length
    + project.breakdownTasks.length
    + project.overdueTasks.length
    + project.blockedTasks.length;
}

function getProjectLastWorkedSortKey(project: Pick<TodoProjectSummary, "lastCompletedAt">): string {
  return project.lastCompletedAt ?? "";
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

function getDashboardSelectedFilterName(): string {
  try {
    return window.localStorage.getItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function setDashboardSelectedFilterName(name: string): void {
  try {
    if (!name.trim()) {
      window.localStorage.removeItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(DASHBOARD_SELECTED_FILTER_STORAGE_KEY, name.trim());
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getSavedDashboardFilters(): SavedDashboardFilter[] {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_SAVED_FILTERS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is SavedDashboardFilter => Boolean(item && typeof item === "object" && typeof item.name === "string"))
      .map((item) => ({
        name: item.name.trim(),
        workLogFilters: {
          project: item.workLogFilters?.project?.trim?.() ?? "",
          keyword: item.workLogFilters?.keyword?.trim?.() ?? "",
          fromDate: item.workLogFilters?.fromDate?.trim?.() ?? "",
          toDate: item.workLogFilters?.toDate?.trim?.() ?? ""
        },
        timelineFilters: {
          keyword: item.timelineFilters?.keyword?.trim?.() ?? "",
          project: item.timelineFilters?.project?.trim?.() ?? "",
          tag: item.timelineFilters?.tag?.trim?.() ?? "",
          kinds: Array.isArray(item.timelineFilters?.kinds)
            ? item.timelineFilters.kinds.filter((kind): kind is TimelineSearchKind => kind === "task" || kind === "session" || kind === "calendar" || kind === "log")
            : ["task", "session", "calendar", "log"],
          fromDate: item.timelineFilters?.fromDate?.trim?.() ?? "",
          toDate: item.timelineFilters?.toDate?.trim?.() ?? "",
          onlyWithNotes: Boolean(item.timelineFilters?.onlyWithNotes)
        }
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

function setSavedDashboardFilters(filters: SavedDashboardFilter[]): void {
  try {
    window.localStorage.setItem(DASHBOARD_SAVED_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getDashboardCardLayoutState(): DashboardLayoutCardState[] {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_CARD_LAYOUT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
    }

    const parsed = JSON.parse(stored);
    return normalizeDashboardCardLayoutState(Array.isArray(parsed) ? parsed : []);
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT_CARDS.map((card) => ({ ...card }));
  }
}

function setDashboardCardLayoutState(cards: DashboardLayoutCardState[]): void {
  try {
    window.localStorage.setItem(DASHBOARD_CARD_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeDashboardCardLayoutState(cards)));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function normalizeDashboardCardLayoutState(cards: unknown[]): DashboardLayoutCardState[] {
  const storedByKey = new Map<string, Partial<DashboardLayoutCardState>>();
  cards.forEach((card) => {
    if (!card || typeof card !== "object") {
      return;
    }

    const candidate = card as Partial<DashboardLayoutCardState>;
    if (typeof candidate.key !== "string") {
      return;
    }

    storedByKey.set(candidate.key, candidate);
  });

  return DEFAULT_DASHBOARD_LAYOUT_CARDS
    .map((card) => {
      const stored = storedByKey.get(card.key);
      return {
        key: card.key,
        title: card.title,
        order: typeof stored?.order === "number" && Number.isFinite(stored.order) ? stored.order : card.order,
        hidden: Boolean(stored?.hidden),
        pinned: typeof stored?.pinned === "boolean" ? stored.pinned : card.pinned,
        width: stored?.width === "half" || stored?.width === "full" ? stored.width : card.width
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((card, index) => ({ ...card, order: index }));
}

function getDashboardTextareaHeights(): Record<string, string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((item): item is [string, string] => typeof item[0] === "string" && typeof item[1] === "string" && item[1].trim().length > 0)
    );
  } catch {
    return {};
  }
}

function getDashboardTextareaHeight(key: string): string {
  return getDashboardTextareaHeights()[key] ?? "";
}

function setDashboardTextareaHeight(key: string, height: string): void {
  try {
    const current = getDashboardTextareaHeights();
    if (height.trim().length === 0) {
      delete current[key];
    } else {
      current[key] = height.trim();
    }
    window.localStorage.setItem(DASHBOARD_TEXTAREA_HEIGHTS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage failures and keep textareas usable.
  }
}

function getDefaultIntakeUnit(kind: string, measurementSystem: "imperial" | "metric"): string {
  if (kind === "drink") {
    return measurementSystem === "metric" ? "mL" : "oz";
  }

  if (kind === "medication") {
    return "pill";
  }

  return "serving";
}

function resolveIntakeUnitValue(unit: string, kind: string, measurementSystem: "imperial" | "metric"): string {
  const trimmedUnit = unit.trim();
  return trimmedUnit.length > 0 ? trimmedUnit : getDefaultIntakeUnit(kind, measurementSystem);
}

function buildIntakeQuickPreset(input: { kind: string; label: string; amount: number; unit: string }): IntakeQuickPreset {
  const label = input.label.trim();
  const unit = input.unit.trim();
  const amount = Math.min(Math.max(Number(input.amount) || 1, 0.1), 9999);
  const kind = input.kind === "food" || input.kind === "supplement" || input.kind === "medication" || input.kind === "drink" ? input.kind : "drink";
  const slug = `${kind}-${label.toLowerCase()}-${amount}-${unit.toLowerCase()}`
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return {
    id: slug,
    kind,
    label,
    amount,
    unit
  };
}

function formatIntakeQuickPresetButtonLabel(preset: IntakeQuickPreset): string {
  return `${preset.label} ${preset.amount} ${preset.unit}`;
}

function getIntakePresetIcon(kind: IntakeQuickPreset["kind"]): string {
  if (kind === "food") {
    return "utensils-crossed";
  }
  if (kind === "supplement" || kind === "medication") {
    return "pill";
  }
  return "glass-water";
}

function sortDashboardLayoutCards(cards: DashboardLayoutCardState[]): DashboardLayoutCardState[] {
  return [...cards].sort((left, right) => {
    const pinDelta = Number(right.pinned) - Number(left.pinned);
    if (pinDelta !== 0) {
      return pinDelta;
    }

    const orderDelta = left.order - right.order;
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

function sortDashboardLayoutCardsByOrder(cards: DashboardLayoutCardState[]): DashboardLayoutCardState[] {
  return [...cards].sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

function cloneTodayFocusItem(item: TodayFocusItem): TodayFocusItem {
  return {
    ...item,
    workSessions: item.workSessions.map((session) => ({ ...session }))
  };
}

function cloneNextUpFocusItem(item: NextUpFocusItem): NextUpFocusItem {
  return {
    ...item
  };
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
  projectName?: string;
  notes?: string;
  estimateMinutes?: number | null;
  destination: FocusCaptureDestination;
};

type FocusCaptureModalOptions = {
  mode: "capture" | "edit";
  todayHasTop3Capacity: boolean;
  availableProjectNames?: string[];
  initialText?: string;
  initialProjectName?: string;
  initialNotes?: string;
  initialEstimateMinutes?: number | null;
  initialDestination?: FocusCaptureDestination;
  submitLabel?: string;
  onSubmit: (payload: FocusCapturePayload) => Promise<void>;
};

export class FocusCaptureModal extends Modal {
  private options: FocusCaptureModalOptions;
  private textValue: string;
  private projectNameValue: string;
  private notesValue: string;
  private estimateValue: string;
  private destinationValue: FocusCaptureDestination;

  constructor(app: App, options: FocusCaptureModalOptions) {
    super(app);
    this.options = options;
    this.textValue = options.initialText ?? "";
    this.projectNameValue = options.initialProjectName ?? "";
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
      .setName("Related project")
      .setDesc("Optional project link for this focus item. Leave blank if it stands on its own.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "No project");
        [...new Set((this.options.availableProjectNames ?? []).filter((name) => name.trim().length > 0))]
          .sort((left, right) => left.localeCompare(right))
          .forEach((name) => {
            dropdown.addOption(name, name);
          });
        dropdown.setValue(this.projectNameValue);
        dropdown.onChange((value) => {
          this.projectNameValue = value;
        });
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
      projectName: this.projectNameValue.trim(),
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
  private completionWindow = "anytime";
  private cadence = "daily";
  private difficultyWeight = "1";

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
      .setName("Completion window")
      .setDesc("Optional preferred time of day for the habit.")
      .addDropdown((dropdown) => {
        HABIT_WINDOW_OPTIONS.forEach((window) => dropdown.addOption(window, window === "before-bed" ? "Before bed" : `${window.charAt(0).toUpperCase()}${window.slice(1)}`));
        dropdown.setValue(this.completionWindow);
        dropdown.onChange((value) => {
          this.completionWindow = value;
        });
      });

    new Setting(contentEl)
      .setName("Cadence")
      .setDesc("Choose whether this habit is due daily, every other day, or weekly.")
      .addDropdown((dropdown) => {
        HABIT_CADENCE_OPTIONS.forEach((cadence) => dropdown.addOption(cadence, formatHabitCadenceLabel(cadence)));
        dropdown.setValue(this.cadence);
        dropdown.onChange((value) => {
          this.cadence = value;
        });
      });

    new Setting(contentEl)
      .setName("Difficulty weight")
      .setDesc("Higher weights make the habit count more in weighted completion and recovery scoring.")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue(this.difficultyWeight)
          .onChange((value) => {
            this.difficultyWeight = value;
          });
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "3";
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Add habit").setCta().onClick(async () => {
          await this.plugin.addHabitDefinition(this.habitName, Number(this.targetCount), this.completionWindow, Number(this.difficultyWeight), this.cadence);
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

function getDismissedRoutineState(date: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY);
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

function setDismissedRoutine(date: string, routineId: string): void {
  try {
    const stored = window.localStorage.getItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) as Record<string, string[]> : {};
    const current = new Set(Array.isArray(parsed[date]) ? parsed[date] : []);
    current.add(routineId);
    parsed[date] = Array.from(current);
    window.localStorage.setItem(DASHBOARD_DISMISSED_ROUTINES_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage failures and keep the dashboard usable.
  }
}

function getClockMinutes(value: string | Date): number {
  if (value instanceof Date) {
    return (value.getHours() * 60) + value.getMinutes();
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function getDashboardCardLayoutKey(title: string): string {
  const normalized = toClassSlug(title);
  if (normalized === "consumables") {
    return "food-log";
  }
  if (normalized === "state-symptoms-and-friction" || normalized === "vitals") {
    return "state-and-friction";
  }
  if (normalized === "patterns" || normalized === "heatmaps") {
    return "heatmaps";
  }
  return normalized;
}

function getDashboardCardGridColumn(key: string, config: DashboardLayoutCardState | undefined, viewMode: DashboardViewMode): string {
  if (viewMode === "mobile") {
    return "1 / -1";
  }

  if (config?.width === "full") {
    return "1 / -1";
  }

  if (config?.width === "half") {
    return viewMode === "widescreen" ? "span 9" : "span 6";
  }

  if (viewMode === "widescreen") {
    if (key === "weekly-agenda" || key === "ai-workspace" || key === "day-flow") {
      return "span 18";
    }
    if (key === "weekly-agenda" || key === "gamification-center" || key === "timeline-search" || key === "heatmaps") {
      return "span 9";
    }
    return "span 6";
  }

  if (key === "weekly-agenda" || key === "day-flow" || key === "ai-workspace") {
    return "1 / -1";
  }

  return "span 6";
}