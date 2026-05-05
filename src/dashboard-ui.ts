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
import { formatMinutesAsHours, getMinutesBetween, getSleepMinutesForDay, getTrackedWorkMinutes, getTrackedWorkMinutesByProject } from "./dashboard-logs";
import { splitMultilineInput } from "./dashboard-todo";
import {
  ACTIVITY_SESSION_KIND_OPTIONS,
  CORE_SESSION_TRACKER_OPTIONS,
  DEFAULT_SETTINGS,
  HABIT_CADENCE_OPTIONS,
  HABIT_WINDOW_OPTIONS,
  IMAGE_EXTENSIONS,
  SESSION_TAG_OPTIONS,
  VIEW_TYPE_DASH_KANBAN,
  VIEW_TYPE_DAILY_DASHBOARD,
  type ResearchGroundingMode,
  type CalendarEventOccurrence,
  type CalendarEventCategory,
  type CalendarRepeatCadence,
  type CalendarSnapshot,
  type CardVisualOptions,
  type CreateProjectInput,
  type DayRepairInput,
  type DashKanbanCard,
  type DashKanbanProjectBoard,
  type DashKanbanWorkspaceSnapshot,
  type DashboardKanbanDensity,
  type DashboardDocumentationEntry,
  type DashboardKanbanFocusFilter,
  type DashboardKanbanTheme,
  type DashboardKanbanThemeDefinition,
  type DashboardKanbanViewMode,
  type ActivitySessionKind,
  type DashboardFocusDisplayItem,
  type DashboardNotificationItem,
  type DashboardSettings,
  type DashboardTone,
  type DashboardViewMode,
  type ExerciseIntensity,
  type FinanceSubscriptionEntry,
  type GamificationSummary,
  type HabitDefinition,
  type IntakeEntry,
  type IntakeQuickPreset,
  type KanbanBoardTemplate,
  type KanbanLaneDefinition,
  type KanbanLane,
  type KanbanLaneOption,
  type NextUpFocusItem,
  type ProjectReviewOption,
  type QuickAddState,
  type RepairTimelineSession,
  type RepairTimelineSessionKind,
  type SavedDashboardFilter,
  type SessionTrackerDefinition,
  type BudgetCategory,
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

const DASHBOARD_ACTIVITY_TRACKER_ICON_MAP: Record<string, string> = {
  work: "play",
  nap: "bed-single",
  relax: "coffee",
  break: "pause",
  poop: "bath",
  exercise: "dumbbell",
  reading: "book-open",
  gaming: "gamepad-2",
  hobbies: "shapes",
  hygiene: "shower-head",
  cooking: "chef-hat",
  errand: "shopping-bag",
  commute: "car-front",
  social: "users",
  chores: "house"
};

const WEEK_AT_A_GLANCE_SEGMENTS = [
  { kind: "sleep", label: "Sleep" },
  { kind: "work", label: "Work" },
  { kind: "nap", label: "Nap" },
  { kind: "relax", label: "Relax" },
  { kind: "break", label: "Break" },
  { kind: "poop", label: "Poop" },
  { kind: "unknown", label: "Unknown" }
] as const;

function kanbanTemplateSupportsLaneCategories(template: KanbanBoardTemplate | null | undefined): boolean {
  return Boolean(template?.laneDefinitions.some((lane) => lane.categoryLabel.trim().length > 0 || lane.categoryTag.trim().length > 0));
}

function formatKanbanPriorityLabel(priority: string): string {
  const normalized = priority.trim().toLowerCase();
  if (!normalized) {
    return "No priority";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)} priority`;
}

function getKanbanPriorityTone(priority: string): string {
  const normalized = priority.trim().toLowerCase();
  return normalized === "urgent" || normalized === "high" || normalized === "medium" || normalized === "low"
    ? normalized
    : "none";
}

type KanbanDueDateDraftParts = {
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  meridiem: "AM" | "PM";
};

function parseKanbanDueDateDraft(value: string): KanbanDueDateDraftParts {
  const trimmed = value.trim();
  const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (!dateMatch) {
    return {
      month: "",
      day: "",
      year: "",
      hour: "",
      minute: "",
      meridiem: "AM"
    };
  }

  return {
    month: dateMatch[1] ?? "",
    day: dateMatch[2] ?? "",
    year: dateMatch[3] ?? "",
    hour: dateMatch[4] ?? "",
    minute: dateMatch[5] ?? "",
    meridiem: dateMatch[6]?.toUpperCase() === "PM" ? "PM" : "AM"
  };
}

function formatKanbanDueDateDraft(parts: KanbanDueDateDraftParts): string {
  const month = parts.month.replace(/\D/g, "").slice(0, 2);
  const day = parts.day.replace(/\D/g, "").slice(0, 2);
  const year = parts.year.replace(/\D/g, "").slice(0, 4);
  const hour = parts.hour.replace(/\D/g, "").slice(0, 2);
  const minute = parts.minute.replace(/\D/g, "").slice(0, 2);

  if (!month && !day && !year) {
    return "";
  }

  let formatted = `${month}/${day}/${year}`;
  if (month.length < 2 || day.length < 2 || year.length < 4) {
    return formatted.replace(/\/+$/g, "");
  }

  if (hour.length === 2 && minute.length === 2) {
    formatted += ` ${hour}:${minute} ${parts.meridiem}`;
  }

  return formatted;
}

function hasKanbanDueDateDateValue(parts: KanbanDueDateDraftParts): boolean {
  return parts.month.length > 0 || parts.day.length > 0 || parts.year.length > 0;
}

function isKanbanDueDateComplete(parts: KanbanDueDateDraftParts): boolean {
  return parts.month.length === 2 && parts.day.length === 2 && parts.year.length === 4;
}

function hasKanbanDueTimeValue(parts: KanbanDueDateDraftParts): boolean {
  return parts.hour.length > 0 || parts.minute.length > 0;
}

function isKanbanDueTimeComplete(parts: KanbanDueDateDraftParts): boolean {
  return parts.hour.length === 2 && parts.minute.length === 2;
}

const KANBAN_PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

const KANBAN_EFFORT_OPTIONS = ["15m", "30m", "45m", "1h", "2h", "Half day"];

function getSubscriptionMonthlyEquivalent(subscription: FinanceSubscriptionEntry): number {
  if (subscription.kind !== "recurring") {
    return 0;
  }

  return subscription.cost / Math.max(subscription.intervalMonths, 1);
}

function getSubscriptionAnnualizedCost(subscription: FinanceSubscriptionEntry): number {
  if (subscription.kind !== "recurring") {
    return 0;
  }

  return getSubscriptionMonthlyEquivalent(subscription) * 12;
}

function formatFinanceAmount(amount: number, currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: amount >= 100 ? 0 : 2
      }).format(amount);
    } catch {
      // Fall through to plain formatting below.
    }
  }

  return `${normalizedCurrency || "$"} ${amount.toFixed(amount >= 100 ? 0 : 2)}`;
}

function formatSubscriptionCycle(subscription: FinanceSubscriptionEntry): string {
  if (subscription.kind === "one-time") {
    return "One-time";
  }

  if (subscription.intervalMonths === 1) {
    return "Monthly";
  }

  if (subscription.intervalMonths === 12) {
    return "Yearly";
  }

  return `Every ${subscription.intervalMonths} months`;
}

function getDaysUntilDate(dateText: string, referenceDate: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText.trim())) {
    return null;
  }

  const target = new Date(`${dateText}T00:00:00`);
  const reference = new Date(`${formatDateKey(referenceDate)}T00:00:00`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) {
    return null;
  }

  return Math.round((target.getTime() - reference.getTime()) / 86_400_000);
}

export class DailyDashboardView extends ItemView {
  private static readonly AUTO_REFRESH_MS = 30 * 60 * 1000;
  private static readonly TIMELINE_RESULTS_PER_PAGE = 10;
  private static readonly CLEANUP_RESULTS_PER_PAGE = 10;

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
  private timelinePage = 1;
  private cleanupPage = 1;
  private draggedHabitIndex: number | null = null;
  private quickAddState: QuickAddState = {
    projectName: "",
    sectionName: "",
    taskText: ""
  };
  private draggedLayoutCardKey: string | null = null;
  private suppressNextCardToggle = false;
  private selectedSessionProjectName = "";
  private selectedSavedFilterName = getDashboardSelectedFilterName();
  private calendarCursorDate = new Date();
  private selectedCalendarDate = formatDateKey(new Date());
  private pendingUndoActions: DashboardUndoAction[] = [];
  private notificationPanelOpen = false;
  private quickAddPanelOpen = false;
  private aiQuestionDraft = "";
  private expandedHabitMissNotes = new Set<string>();
  private selectedGamificationWindow: "today" | "week" | "month" = "today";
  private selectedBudgetingTab: "overview" | "subscriptions" | "budget" = "overview";
  private weekAtAGlanceOffset = 0;
  private budgetCategoryDraft = "";
  private draggedSessionDeckTrackerId: string | null = null;
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
    return "Obsidian DASH - Daily Action & System Hub";
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

  private openDocumentationCenterFlow(): void {
    new DashboardDocumentationModal(this.app, this.plugin).open();
  }

  private openShortcutHelpFlow(): void {
    new DashboardShortcutHelpModal(this.app).open();
  }

  private openAiReferenceNotesFlow(): void {
    new AiReferenceNotesModal(this.app, this.plugin).open();
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
      this.syncQuickAddSelection(this.quickAddState.projectName);
    }
    await this.render();
  }

  private getQuickAddSections(projectName: string): string[] {
    if (!projectName.trim()) {
      return [];
    }

    return this.plugin.getKanbanLaneOptions(projectName)
      .filter((lane) => !lane.done)
      .map((lane) => (lane.targetSection || lane.label).trim())
      .filter((section, index, array) => section.length > 0 && array.indexOf(section) === index);
  }

  private syncQuickAddSelection(projectName: string): void {
    const sections = this.getQuickAddSections(projectName);
    if (!projectName.trim() || sections.length === 0) {
      this.quickAddState.sectionName = "";
      return;
    }

    if (!sections.includes(this.quickAddState.sectionName)) {
      this.quickAddState.sectionName = sections[0];
    }
  }

  private async submitQuickAddTask(): Promise<void> {
    const text = this.quickAddState.taskText.trim();
    const sections = this.getQuickAddSections(this.quickAddState.projectName);
    const targetSection = sections.includes(this.quickAddState.sectionName)
      ? this.quickAddState.sectionName
      : sections[0] ?? "";
    if (!text || !this.quickAddState.projectName || !targetSection) {
      return;
    }

    await this.plugin.addTaskToProject(this.quickAddState.projectName, targetSection, text);
    this.quickAddState.taskText = "";
    this.quickAddPanelOpen = false;
    await this.render();
  }

  private updateTimelineFilters(nextFilters: TimelineSearchFilters): void {
    this.timelineFilters = nextFilters;
    this.timelinePage = 1;
  }

  private setTimelinePage(nextPage: number): void {
    this.timelinePage = Math.max(1, nextPage);
  }

  private setCleanupPage(nextPage: number): void {
    this.cleanupPage = Math.max(1, nextPage);
  }

  private getPaginatedItems<T>(items: T[], requestedPage: number, pageSize: number): {
    items: T[];
    page: number;
    totalPages: number;
    totalItems: number;
    startItem: number;
    endItem: number;
  } {
    const totalItems = items.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const startIndex = (page - 1) * pageSize;
    const pageItems = items.slice(startIndex, startIndex + pageSize);

    return {
      items: pageItems,
      page,
      totalPages,
      totalItems,
      startItem: totalItems === 0 ? 0 : startIndex + 1,
      endItem: totalItems === 0 ? 0 : startIndex + pageItems.length
    };
  }

  private renderPaginationControls(
    parent: HTMLElement,
    pagination: { page: number; totalPages: number; totalItems: number; startItem: number; endItem: number },
    onNavigate: (page: number) => Promise<void>
  ): void {
    if (pagination.totalItems === 0 || pagination.totalPages <= 1) {
      return;
    }

    const footer = parent.createDiv({ cls: "daily-dashboard-pagination" });
    const chips = footer.createDiv({ cls: "daily-dashboard-chip-row" });
    createSemanticChip(chips, `Page ${pagination.page} of ${pagination.totalPages}`, "focus");
    createSemanticChip(chips, `${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems}`, "neutral");

    const actions = footer.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
    const previousButton = actions.createEl("button", { cls: "daily-dashboard-secondary-button" });
    previousButton.type = "button";
    previousButton.disabled = pagination.page <= 1;
    const previousIcon = previousButton.createSpan({ cls: "daily-dashboard-button-icon" });
    setIcon(previousIcon, "chevron-left");
    previousButton.createSpan({ cls: "daily-dashboard-button-label", text: "Previous" });
    previousButton.addEventListener("click", () => {
      void onNavigate(pagination.page - 1);
    });

    const nextButton = actions.createEl("button", { cls: "daily-dashboard-secondary-button" });
    nextButton.type = "button";
    nextButton.disabled = pagination.page >= pagination.totalPages;
    nextButton.createSpan({ cls: "daily-dashboard-button-label", text: "Next" });
    const nextIcon = nextButton.createSpan({ cls: "daily-dashboard-button-icon" });
    setIcon(nextIcon, "chevron-right");
    nextButton.addEventListener("click", () => {
      void onNavigate(pagination.page + 1);
    });
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
      task.unblockDate ? `Unblock ${task.unblockDate}` : "",
      task.effort ? `Effort ${task.effort}` : "",
      task.energy ? `Energy ${task.energy}` : "",
      task.executionContext ? `Context ${task.executionContext}` : "",
      task.trigger ? `Trigger ${task.trigger}` : "",
      task.minimumStep ? `Minimum step: ${task.minimumStep}` : ""
    ].filter((value) => value.length > 0).join(" • ");
  }

  private getSessionTrackers(): SessionTrackerDefinition[] {
    return this.plugin.getSessionTrackers();
  }

  private getVisibleSessionTrackers(): SessionTrackerDefinition[] {
    return this.plugin.getVisibleSessionTrackers();
  }

  private getActivitySessionTrackers(): SessionTrackerDefinition[] {
    return this.plugin.getActivitySessionTrackers();
  }

  private getSessionTrackerTone(trackerId: string): DashboardTone {
    const normalized = trackerId.trim().toLowerCase();
    if (normalized === "work") {
      return "capture";
    }
    if (normalized === "nap" || normalized === "relax") {
      return "health";
    }
    if (normalized === "break") {
      return "alert";
    }
    if (normalized === "poop" || normalized === "chores" || normalized === "commute") {
      return "log";
    }
    if (normalized === "exercise" || normalized === "hygiene") {
      return "health";
    }
    if (normalized === "reading" || normalized === "social" || normalized === "gaming") {
      return "focus";
    }
    if (normalized === "cooking" || normalized === "errand") {
      return "alert";
    }
    if (normalized === "chores" || normalized === "commute") {
      return "log";
    }
    return "neutral";
  }

  private getSessionTrackerIcon(trackerId: string): string {
    return DASHBOARD_ACTIVITY_TRACKER_ICON_MAP[trackerId.trim().toLowerCase()] || "circle";
  }

  private getSessionTrackerLabel(trackerId: string): string {
    return this.plugin.getSessionTracker(trackerId)?.label || formatActivitySessionLabel(trackerId);
  }

  private getSessionTrackerColor(trackerId: string): string {
    return this.plugin.getSessionTracker(trackerId)?.color || "#6e829d";
  }

  private buildGradientFromColor(color: string): string {
    return `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 68%, black))`;
  }

  private async reorderSessionDeckTrackers(draggedTrackerId: string, targetTrackerId: string, position: "before" | "after"): Promise<void> {
    const trackers = this.getSessionTrackers().map((tracker) => ({ ...tracker }));
    const draggedIndex = trackers.findIndex((tracker) => tracker.id === draggedTrackerId);
    const targetIndex = trackers.findIndex((tracker) => tracker.id === targetTrackerId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return;
    }

    const [draggedTracker] = trackers.splice(draggedIndex, 1);
    const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const insertionIndex = position === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
    trackers.splice(Math.max(0, Math.min(insertionIndex, trackers.length)), 0, draggedTracker);
    await this.plugin.updateSessionTrackers(trackers);
    await this.render();
  }

  private getGamificationState(score: number, tone: DashboardTone): { label: string; tone: DashboardTone } {
    if (tone === "done" || score >= 80) {
      return { label: "Winning", tone: "done" };
    }
    if (tone === "focus" || tone === "capture" || score >= 60) {
      return { label: "Strong", tone: "focus" };
    }
    if (tone === "alert" || score < 35) {
      return { label: "Attention", tone: "alert" };
    }
    if (tone === "log" || score < 50) {
      return { label: "Watch", tone: "state" };
    }
    return { label: "Stable", tone: "neutral" };
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

  async render(): Promise<void> {
    try {
      const { contentEl } = this;
      const todayEntry = this.plugin.getTodayEntry();
      const todoSnapshot = await this.plugin.getTodoSnapshot();
      const settings = this.plugin.getSettings();
      const financeData = this.plugin.getFinanceData();
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
      const paginatedTimelineResults = this.getPaginatedItems(
        timelineResults,
        this.timelinePage,
        DailyDashboardView.TIMELINE_RESULTS_PER_PAGE
      );
      this.timelinePage = paginatedTimelineResults.page;
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
      this.syncQuickAddSelection(this.quickAddState.projectName);
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
      const heroTitle = heroCopy.createEl("h1", { cls: "daily-dashboard-hero-title" });
      heroTitle.createEl("span", { cls: "daily-dashboard-hero-title-line daily-dashboard-hero-title-line--brand", text: "Obsidian DASH" });
      heroTitle.createEl("span", { cls: "daily-dashboard-hero-title-line daily-dashboard-hero-title-line--subtitle", text: "Daily Action & System Hub" });

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
        const quickAddSections = this.getQuickAddSections(this.quickAddState.projectName);
        popoverCopy.createEl("span", {
          cls: "daily-dashboard-row-meta",
          text: projects.length > 0
            ? quickAddSections.length > 0
              ? `Capture straight into ${quickAddSections.join(", ")}.`
              : "This project does not expose any active lanes yet."
            : "Create a project first so there is somewhere to send the task."
        });
        if (projects.length === 0) {
          const emptyState = quickAddPopover.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
          emptyState.createEl("span", { text: "No projects are available yet. Create your first project or point DASH at a populated Master Task Hub first." });
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
            this.syncQuickAddSelection(projectSelect.value);
            void this.render();
          });
          const sectionSelect = quickAddForm.createEl("select", { cls: "daily-dashboard-input" });
          quickAddSections.forEach((section) => {
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
          window.setTimeout(() => {
            taskInput.focus();
            taskInput.select();
          }, 0);
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
      createIconButton(utilityActions, "book-open", "Open DASH documentation", async () => {
        this.openDocumentationCenterFlow();
      });
      createIconButton(utilityActions, "keyboard", "Show dashboard keyboard shortcuts", async () => {
        this.openShortcutHelpFlow();
      });
      createIconButton(utilityActions, "sliders-horizontal", "Customize dashboard layout", async () => {
        this.openLayoutCustomizationFlow();
      });
      createIconButton(utilityActions, "notebook-pen", "Weekly review", async () => this.plugin.generateWeeklyReview());
      createIconButton(utilityActions, "triangle-alert", "Recurring friction patterns", async () => this.plugin.generateRecurringFrictionPatternsNote(true));
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
      const visibleSessionTrackers = this.getVisibleSessionTrackers();

      const weekBoardCard = createGridCard("Week At A Glance", "See the week as stacked tracked time instead of relying on memory and rough impressions.", {
        icon: "calendar-range",
        eyebrow: "Week",
        tone: "health",
        tag: "Visual"
      });
      const weekBoardSegments = [
        WEEK_AT_A_GLANCE_SEGMENTS[0],
        ...visibleSessionTrackers.map((tracker) => ({ kind: tracker.id, label: tracker.label })),
        WEEK_AT_A_GLANCE_SEGMENTS[WEEK_AT_A_GLANCE_SEGMENTS.length - 1]
      ];
      const weekBoardDays = this.getCurrentWeekTimeBoard(this.weekAtAGlanceOffset);
      const weekBoardNavigation = weekBoardCard.createDiv({ cls: "daily-dashboard-week-navigation" });
      const previousWeekButton = weekBoardNavigation.createEl("button", { cls: "daily-dashboard-week-nav-button", text: "‹" });
      previousWeekButton.type = "button";
      previousWeekButton.ariaLabel = "Previous week";
      previousWeekButton.title = "Previous week";
      previousWeekButton.addEventListener("click", () => {
        this.weekAtAGlanceOffset -= 1;
        void this.requestRefresh();
      });
      weekBoardNavigation.createEl("strong", { text: this.getWeekAtAGlanceRangeLabel(weekBoardDays) });
      const nextWeekButton = weekBoardNavigation.createEl("button", { cls: "daily-dashboard-week-nav-button", text: "›" });
      nextWeekButton.type = "button";
      nextWeekButton.ariaLabel = "Newer week";
      nextWeekButton.title = "Newer week";
      nextWeekButton.disabled = this.weekAtAGlanceOffset >= 0;
      nextWeekButton.addEventListener("click", () => {
        if (this.weekAtAGlanceOffset >= 0) {
          return;
        }
        this.weekAtAGlanceOffset = Math.min(0, this.weekAtAGlanceOffset + 1);
        void this.requestRefresh();
      });
      const weekBoard = weekBoardCard.createDiv({ cls: "daily-dashboard-week-strip" });
      const weekStage = weekBoard.createDiv({ cls: "daily-dashboard-week-stage" });
      weekStage.createDiv({ cls: "daily-dashboard-week-platform" });
      const weekBars = weekStage.createDiv({ cls: "daily-dashboard-week-bars" });
      weekBoardDays.forEach((day) => {
        const column = weekBars.createDiv({ cls: "daily-dashboard-week-column" });
        if (day.isToday) {
          column.addClass("is-today");
        }
        if (day.isActiveLogicalDay) {
          column.addClass("is-active-logical-day");
          column.createDiv({ cls: "daily-dashboard-week-active-indicator", text: "Active" });
        }

        const cylinder = column.createDiv({ cls: "daily-dashboard-week-cylinder" });
        weekBoardSegments.forEach((segment) => {
          this.renderWeekBarSegment(cylinder, segment.kind, day.minutesByKind[segment.kind] ?? 0, visibleSessionTrackers.find((tracker) => tracker.id === segment.kind)?.color);
        });
        cylinder.createDiv({ cls: "daily-dashboard-week-cylinder-overlay" });

        const labels = column.createDiv({ cls: "daily-dashboard-week-labels" });
        labels.createEl("strong", { text: day.label.toUpperCase() });
        labels.createEl("span", { text: `${Number.parseInt(day.date.slice(-2), 10)}` });
      });

      const weekLegend = weekBoardCard.createDiv({ cls: "daily-dashboard-week-legend" });
      weekBoardSegments.forEach((segment) => {
        this.renderWeekLegendItem(weekLegend, segment.label, segment.kind, visibleSessionTrackers.find((tracker) => tracker.id === segment.kind)?.color);
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
      const aiStatus = this.plugin.getAiStatus();
      const trackedWorkMinutes = this.plugin.getTrackedWorkMinutes(todayEntry);
      const trackedNapMinutes = this.plugin.getTrackedNapMinutes(todayEntry);
      const trackedRelaxMinutes = this.plugin.getTrackedRelaxMinutes(todayEntry);
      const trackedBreakMinutes = this.plugin.getTrackedBreakMinutes(todayEntry);
      const trackedPoopMinutes = this.plugin.getTrackedPoopMinutes(todayEntry);
      const trackedActivityMinutes = this.plugin.getTrackedActivityMinutes(todayEntry);
      const trackedPoopCount = this.plugin.getTrackedPoopCount(todayEntry);
      const trackedWorkByProject = getTrackedWorkMinutesByProject(todayEntry);
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
      createSemanticChip(sessionDeckSummary, activeModeLabel, activeActivitySession ? this.getSessionTrackerTone(activeActivitySession.kind) : activePoopSession ? "log" : activeBreakSession ? "alert" : activeWorkSession ? "capture" : activeNapSession ? "alert" : activeRelaxSession ? "health" : "neutral");
      createSemanticChip(sessionDeckSummary, `Logical date ${todayEntry.date}`, "neutral");
      createSemanticChip(sessionDeckSummary, logicalDayInsights.isRollover ? "Past midnight" : "Same calendar day", logicalDayInsights.isRollover ? "alert" : "neutral");
      createSemanticChip(
        sessionDeckSummary,
        logicalDayInsights.hasActiveSession
          ? "Session active"
          : logicalDayInsights.inactiveMinutes !== null
            ? `Inactive ${formatMinutesAsHours(logicalDayInsights.inactiveMinutes)}`
            : "No activity yet",
        logicalDayInsights.hasActiveSession ? "capture" : logicalDayInsights.inactiveMinutes !== null && logicalDayInsights.inactiveMinutes >= 120 ? "alert" : "neutral"
      );
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
      const sessionProjectSummaryRow = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-project-summary" });
      const sessionProjectSummary = sessionProjectSummaryRow.createDiv({ cls: "daily-dashboard-stack" });
      sessionProjectSummary.createEl("span", {
        cls: "daily-dashboard-row-meta",
        text: activeWorkSession
          ? `Current work session: ${activeWorkSession.projectName.trim() || "Unassigned"}`
          : trackedWorkByProject.length > 0
            ? "Today's work is already being grouped by project in the daily log."
            : "Choose a project before starting work if you want today's time split by project."
      });
      if (trackedWorkByProject.length > 0) {
        const sessionProjectChips = sessionProjectSummary.createDiv({ cls: "daily-dashboard-chip-row" });
        trackedWorkByProject.slice(0, 4).forEach((item) => {
          createSemanticChip(sessionProjectChips, `${item.projectName} ${formatMinutesAsHours(item.minutes)}`, item.projectName === "Unassigned" ? "neutral" : "capture");
        });
        if (trackedWorkByProject.length > 4) {
          sessionProjectSummary.createEl("span", { cls: "daily-dashboard-row-meta", text: `+${trackedWorkByProject.length - 4} more project buckets in today's log.` });
        }
      }
      const customizeSessionDeckButton = sessionProjectSummaryRow.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-session-customize-button" });
      customizeSessionDeckButton.type = "button";
      customizeSessionDeckButton.ariaLabel = "Customize Session Deck";
      customizeSessionDeckButton.title = "Customize Session Deck";
      const customizeSessionDeckIcon = customizeSessionDeckButton.createSpan({ cls: "daily-dashboard-button-icon" });
      setIcon(customizeSessionDeckIcon, "sliders-horizontal");
      customizeSessionDeckButton.addEventListener("click", () => {
        new SessionDeckCustomizationModal(this.app, this.plugin).open();
      });
      const sessionDeckGrid = sessionDeckCard.createDiv({ cls: "daily-dashboard-session-deck-grid" });
      const sessionDeckDropPreview = sessionDeckGrid.createDiv({ cls: "daily-dashboard-session-drop-preview" });
      sessionDeckDropPreview.detach();
      let sessionDeckDropTarget: { trackerId: string; position: "before" | "after" } | null = null;
      let suppressNextSessionDeckClick = false;
      const commitSessionDeckDrop = (): void => {
        const dropTarget = sessionDeckDropTarget;
        clearSessionDeckPreview();
        const draggedTrackerId = this.draggedSessionDeckTrackerId;
        this.draggedSessionDeckTrackerId = null;
        if (!draggedTrackerId || !dropTarget || draggedTrackerId === dropTarget.trackerId) {
          return;
        }

        void this.reorderSessionDeckTrackers(draggedTrackerId, dropTarget.trackerId, dropTarget.position);
      };
      const clearSessionDeckPreview = (): void => {
        sessionDeckDropTarget = null;
        sessionDeckDropPreview.detach();
      };
      sessionDeckDropPreview.addEventListener("dragover", (event) => {
        if (!this.draggedSessionDeckTrackerId) {
          return;
        }

        event.preventDefault();
      });
      sessionDeckDropPreview.addEventListener("drop", (event) => {
        if (!this.draggedSessionDeckTrackerId) {
          return;
        }

        event.preventDefault();
        commitSessionDeckDrop();
      });
      const createSessionDeckButton = (trackerId: string, label: string, detail: string, icon: string, tone: DashboardTone, isActive: boolean, onClick: () => Promise<void>, accentColor?: string): void => {
        const button = sessionDeckGrid.createEl("button", { cls: "daily-dashboard-session-button" });
        button.type = "button";
        button.draggable = true;
        button.toggleClass("is-active", isActive);
        button.addClass(`is-${tone}`);
        if (accentColor) {
          button.style.setProperty("--daily-dashboard-session-accent", accentColor);
          button.addClass("has-custom-accent");
        }
        const iconEl = button.createSpan({ cls: "daily-dashboard-session-button-icon" });
        setIcon(iconEl, icon);
        const copy = button.createSpan({ cls: "daily-dashboard-session-button-copy" });
        copy.createEl("strong", { text: label });
        copy.createEl("span", { cls: "daily-dashboard-row-meta", text: detail });
        button.addEventListener("dragstart", (event) => {
          this.draggedSessionDeckTrackerId = trackerId;
          suppressNextSessionDeckClick = true;
          button.addClass("is-dragging");
          event.dataTransfer?.setData("text/plain", trackerId);
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
          }
        });
        button.addEventListener("dragover", (event) => {
          if (!this.draggedSessionDeckTrackerId || this.draggedSessionDeckTrackerId === trackerId) {
            return;
          }

          event.preventDefault();
          const rect = button.getBoundingClientRect();
          const horizontal = sessionDeckGrid.clientWidth > 420;
          const position = horizontal
            ? event.clientX < rect.left + rect.width / 2 ? "before" : "after"
            : event.clientY < rect.top + rect.height / 2 ? "before" : "after";
          sessionDeckDropTarget = { trackerId, position };
          if (position === "before") {
            sessionDeckGrid.insertBefore(sessionDeckDropPreview, button);
          } else {
            sessionDeckGrid.insertBefore(sessionDeckDropPreview, button.nextSibling);
          }
        });
        button.addEventListener("drop", (event) => {
          event.preventDefault();
          button.removeClass("is-dragging");
          commitSessionDeckDrop();
        });
        button.addEventListener("dragend", () => {
          this.draggedSessionDeckTrackerId = null;
          button.removeClass("is-dragging");
          clearSessionDeckPreview();
          window.setTimeout(() => {
            suppressNextSessionDeckClick = false;
          }, 0);
        });
        button.addEventListener("click", () => {
          if (suppressNextSessionDeckClick) {
            return;
          }
          void onClick();
        });
      };
      sessionDeckGrid.addEventListener("dragover", (event) => {
        if (!this.draggedSessionDeckTrackerId) {
          return;
        }

        event.preventDefault();

        if (event.target === sessionDeckGrid) {
          const visibleTrackers = this.getVisibleSessionTrackers();
          const lastTracker = visibleTrackers[visibleTrackers.length - 1];
          if (!lastTracker) {
            return;
          }

          sessionDeckDropTarget = { trackerId: lastTracker.id, position: "after" };
          sessionDeckGrid.appendChild(sessionDeckDropPreview);
        }
      });
      sessionDeckGrid.addEventListener("drop", (event) => {
        if (!this.draggedSessionDeckTrackerId) {
          return;
        }

        event.preventDefault();
        commitSessionDeckDrop();
      });
      sessionDeckGrid.addEventListener("dragleave", (event) => {
        if (event.target === sessionDeckGrid && !sessionDeckGrid.contains(event.relatedTarget as Node | null)) {
          clearSessionDeckPreview();
        }
      });
      visibleSessionTrackers.forEach((tracker) => {
        if (tracker.id === "work") {
          createSessionDeckButton(tracker.id, activeWorkSession ? "Stop Work" : "Start Work", activeWorkSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeWorkSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedWorkMinutes)} today${this.selectedSessionProjectName ? ` • ${this.selectedSessionProjectName}` : ""}`, activeWorkSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activeWorkSession), async () => activeWorkSession ? this.plugin.stopWorkSession() : this.plugin.startWorkSession("", this.selectedSessionProjectName), tracker.color);
          return;
        }
        if (tracker.id === "nap") {
          createSessionDeckButton(tracker.id, activeNapSession ? "Stop Nap" : "Start Nap", activeNapSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeNapSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedNapMinutes)} today`, activeNapSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activeNapSession), async () => activeNapSession ? this.plugin.stopNapSession() : this.plugin.startNapSession(""), tracker.color);
          return;
        }
        if (tracker.id === "relax") {
          createSessionDeckButton(tracker.id, activeRelaxSession ? "Stop Relax" : "Start Relax", activeRelaxSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeRelaxSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedRelaxMinutes)} today`, activeRelaxSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activeRelaxSession), async () => activeRelaxSession ? this.plugin.stopRelaxSession() : this.plugin.startRelaxSession(""), tracker.color);
          return;
        }
        if (tracker.id === "break") {
          createSessionDeckButton(tracker.id, activeBreakSession ? "Stop Break" : "Start Break", activeBreakSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeBreakSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(trackedBreakMinutes)} today`, activeBreakSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activeBreakSession), async () => activeBreakSession ? this.plugin.stopBreakSession() : this.plugin.startBreakSession(""), tracker.color);
          return;
        }
        if (tracker.id === "poop") {
          createSessionDeckButton(tracker.id, activePoopSession ? "Stop Poop" : "Start Poop", activePoopSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activePoopSession.start, formatDateTimeKey(new Date())))}` : `${trackedPoopCount}x • ${formatMinutesAsHours(trackedPoopMinutes)}`, activePoopSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activePoopSession), async () => activePoopSession ? this.plugin.stopPoopSession() : this.plugin.startPoopSession(""), tracker.color);
          return;
        }

        const activeTrackerSession = activeActivitySession?.kind === tracker.id ? activeActivitySession : null;
        createSessionDeckButton(tracker.id, activeTrackerSession ? `Stop ${tracker.label}` : `Start ${tracker.label}`, activeTrackerSession ? `Live ${formatMinutesAsHours(getMinutesBetween(activeTrackerSession.start, formatDateTimeKey(new Date())))}` : `${formatMinutesAsHours(this.plugin.getTrackedActivityMinutes(todayEntry, tracker.id))} today`, activeTrackerSession ? "square" : this.getSessionTrackerIcon(tracker.id), this.getSessionTrackerTone(tracker.id), Boolean(activeTrackerSession), async () => activeTrackerSession ? this.plugin.stopActivitySession(tracker.id) : this.plugin.startActivitySession(tracker.id), tracker.color);
      });

      const focusCard = createGridCard("Action Queue", "Triage queued work, reminders, routines, and calendar context from one place.", {
        icon: "target",
        eyebrow: "Execution",
        tone: "focus",
        tag: "Focus"
      });
      const routineSection = this.createCollapsibleSubsection(focusCard, "focus-routines", "Routine cues", "Keep active or upcoming routine windows beside the rest of the execution stack.");
      const routineTemplates = this.plugin.getRoutineTemplates();
      const dismissedRoutineIds = getDismissedRoutineState(todayEntry.date);
      const currentMinutes = getClockMinutes(new Date());
      const visibleRoutines = routineTemplates.filter((template) => !dismissedRoutineIds.has(template.id));
      const pendingRoutines = visibleRoutines
        .map((template) => ({
          template,
          startMinutes: getClockMinutes(template.startTime),
          endMinutes: getClockMinutes(template.endTime)
        }))
        .filter(({ endMinutes }) => currentMinutes <= endMinutes)
        .sort((left, right) => left.startMinutes - right.startMinutes);
      if (pendingRoutines.length === 0) {
        routineSection.createDiv({ cls: "daily-dashboard-row-meta", text: visibleRoutines.length === 0 ? "No routine templates left for this day. Add definitions in settings or clear daily dismissals tomorrow." : "No active or upcoming routine windows left for today." });
      } else {
        const routineList = routineSection.createDiv({ cls: "daily-dashboard-project-list" });
        pendingRoutines.forEach(({ template, startMinutes, endMinutes }) => {
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
      const dismissedReminderIds = getDismissedReminderState(todayEntry.date);
      const reminderItems = (calendarSnapshot?.reminders ?? [])
        .map((reminder) => ({
          reminder,
          id: `reminder-${reminder.id}-${reminder.start}`
        }))
        .filter(({ id }) => !dismissedReminderIds.has(id));
      if (suggestedTop3.length > 0) {
        const suggestedSection = this.createCollapsibleSubsection(focusCard, "focus-suggestions", "Suggested focus", "Generate a short queue from calendar commitments, stale projects, and due work instead of staring at a blank list.");
        const suggestionActions = suggestedSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(suggestionActions, "Queue best fit", async () => {
          for (const candidate of suggestedTop3.slice(0, 3)) {
            await this.plugin.addNextUpFocusItem({
              text: candidate.text,
              notes: candidate.notes,
              estimateMinutes: candidate.estimateMinutes
            });
          }
          await this.render();
        }, false, "sparkles");

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
      const reminderSection = this.createCollapsibleSubsection(focusCard, "focus-reminders", "Reminders", "Review upcoming calendar pressure and queue what actually deserves follow-through.");
      if (reminderItems.length === 0) {
        const emptyState = reminderSection.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--compact" });
        emptyState.createEl("span", { text: "No upcoming reminder items right now." });
      } else {
        const reminderList = reminderSection.createDiv({ cls: "daily-dashboard-focus-list" });
        reminderItems.forEach(({ reminder, id }) => {
          const row = reminderList.createDiv({ cls: `daily-dashboard-focus-row is-reminder is-${reminder.warningLevel}` });
          const copy = row.createDiv({ cls: "daily-dashboard-focus-copy" });
          copy.createEl("strong", { text: reminder.title });
          copy.createEl("span", {
            cls: "daily-dashboard-habit-meta",
            text: this.getFocusDisplayMeta({
              kind: "reminder",
              id,
              sourceEventId: reminder.id,
              text: reminder.title,
              status: "reminder",
              workSessions: [],
              completedAt: null,
              trackedMinutes: 0,
              isActive: false,
              calendarDate: reminder.date,
              calendarStart: reminder.start,
              calendarEnd: reminder.end,
              calendarLeadSummary: reminder.leadSummary,
              allDay: reminder.allDay,
              calendarNotes: [this.plugin.renderCalendarProjectLink(reminder.projectName, reminder.projectNotePath), reminder.notes]
                .filter((value) => value.trim().length > 0)
                .join(" • "),
              repeatCadence: reminder.repeatCadence,
              warningLevel: reminder.warningLevel
            })
          });
          const reminderNotes = [this.plugin.renderCalendarProjectLink(reminder.projectName, reminder.projectNotePath), reminder.notes]
            .filter((value) => value.trim().length > 0)
            .join(" • ");
          if (reminderNotes) {
            copy.createEl("span", {
              cls: "daily-dashboard-row-meta",
              text: reminderNotes
            });
          }

          const controls = row.createDiv({ cls: "daily-dashboard-focus-controls" });
          createButton(controls, "Queue", async () => {
            await this.plugin.addNextUpFocusItem({
              text: reminder.title,
              notes: reminder.notes,
              estimateMinutes: this.plugin.getCalendarReminderEstimateMinutes(reminder.start, reminder.end, reminder.allDay)
            });
            clearDismissedReminder(todayEntry.date, id);
            await this.render();
          }, true, "list-plus");
          createButton(controls, "Dismiss", async () => {
            setDismissedReminder(todayEntry.date, id);
            await this.render();
          }, false, "bell-off");
          createButton(controls, "Calendar", async () => {
            new CalendarEventModal(this.app, this.plugin, reminder.date ?? todayEntry.date, reminder.id ?? null).open();
          }, false, "calendar-days");
        });
      }
      const nextUpItems = this.plugin.getNextUpFocusItems(todayEntry.date);
      const nextUpSection = this.createCollapsibleSubsection(focusCard, "focus-next-up", "Next Up", "Keep overflow queued and ready to pull when you actually need it.");
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
              availableProjectNames: projects.map((project) => project.name),
              initialText: item.text,
              initialProjectName: item.projectName,
              initialNotes: item.notes,
              initialEstimateMinutes: item.estimateMinutes,
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
          availableProjectNames: projects.map((project) => project.name),
          submitLabel: "Queue item",
          onSubmit: async (payload) => {
            await this.plugin.addNextUpFocusItem(payload);
            await this.render();
          }
        }).open();
      }, false, "list-plus");
      const focusCalendarSection = this.createCollapsibleSubsection(focusCard, "focus-calendar", "Calendar", "Keep the monthly planner nearby without making the action queue too tall.");
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

      const bowelSection = this.createCollapsibleSubsection(stateCard, "state-bowel", "Bowel tracking", "Keep bowel sessions, duration, and quality tags with the rest of the body-state logging.");
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

      stateCard.createEl("label", { cls: "daily-dashboard-field-label", text: "Friction log" });
      const frictionInput = stateCard.createEl("textarea", { cls: "daily-dashboard-textarea" });
      frictionInput.value = todayEntry.frictionLog;
      frictionInput.placeholder = "Blockers, pain points, context switching, or anything that made the day harder.";
      frictionInput.addEventListener("change", () => {
        void this.plugin.updateFrictionLog(frictionInput.value);
      });

      const gamificationCard = createGridCard("Gamification Center", "Turn execution, health, consistency, recovery, and planning into auditable scores instead of vague impressions.", {
        icon: "trophy",
        eyebrow: "Scores",
        tone: "done",
        tag: gamificationSummary.model === "deterministic" ? "Deterministic" : "Scored",
        secondaryTag: "Experimental",
        secondaryTagTone: "alert"
      });
      const gamificationSummaryRow = gamificationCard.createDiv({ cls: "daily-dashboard-chip-row" });
      createSemanticChip(gamificationSummaryRow, `Streak ${gamificationSummary.currentStreak}`, gamificationSummary.currentStreak >= 3 ? "focus" : "neutral");
      createSemanticChip(gamificationSummaryRow, `Best ${gamificationSummary.bestStreak}`, gamificationSummary.bestStreak >= 5 ? "done" : "neutral");
      createSemanticChip(gamificationSummaryRow, `Personal best ${gamificationSummary.personalBestDayScore}/100`, gamificationSummary.personalBestDayScore >= 85 ? "done" : "focus");
      createSemanticChip(gamificationSummaryRow, `Low-score line ${gamificationSummary.lowScoreThreshold}/100`, "alert");
      const gamificationTabs = gamificationCard.createDiv({ cls: "daily-dashboard-gamification-tabs" });
      ([
        { key: "today", label: "Daily", snapshot: gamificationSummary.today },
        { key: "week", label: "Weekly", snapshot: gamificationSummary.week },
        { key: "month", label: "Monthly", snapshot: gamificationSummary.month }
      ] as const).forEach((item) => {
        const button = gamificationTabs.createEl("button", {
          cls: this.selectedGamificationWindow === item.key ? "daily-dashboard-gamification-tab is-active" : "daily-dashboard-gamification-tab"
        });
        button.type = "button";
        button.createEl("span", { text: item.label });
        button.createEl("strong", { text: `${item.snapshot.score}` });
        button.addEventListener("click", () => {
          this.selectedGamificationWindow = item.key;
          void this.render();
        });
      });
      const activeSnapshot = this.selectedGamificationWindow === "week"
        ? gamificationSummary.week
        : this.selectedGamificationWindow === "month"
          ? gamificationSummary.month
          : gamificationSummary.today;
      const overallGamificationState = this.getGamificationState(activeSnapshot.score, activeSnapshot.score >= gamificationSummary.lowScoreThreshold ? "focus" : "alert");
      const gamificationStage = gamificationCard.createDiv({ cls: "daily-dashboard-gamification-stage" });
      const gamificationHero = gamificationStage.createDiv({ cls: "daily-dashboard-gamification-hero" });
      const gamificationHeroCopy = gamificationHero.createDiv({ cls: "daily-dashboard-stack" });
      gamificationHeroCopy.createEl("strong", { text: activeSnapshot.label });
      gamificationHeroCopy.createEl("span", { cls: "daily-dashboard-row-meta", text: activeSnapshot.comparisonText });
      const heroState = gamificationHero.createDiv({ cls: "daily-dashboard-gamification-state-block" });
      heroState.createEl("span", { cls: `daily-dashboard-semantic-chip is-${overallGamificationState.tone}`, text: overallGamificationState.label });
      const heroBadge = gamificationHero.createDiv({ cls: "daily-dashboard-gamification-score-block" });
      heroBadge.createEl("span", { cls: "daily-dashboard-row-meta", text: activeSnapshot.grade });
      heroBadge.createEl("strong", { text: `${activeSnapshot.score}/100` });
      const gamificationStats = gamificationStage.createDiv({ cls: "daily-dashboard-gamification-stat-grid" });
      this.renderDayMetric(gamificationStats, "Top category", [...activeSnapshot.categories].sort((left, right) => right.score - left.score)[0]?.label ?? "None");
      this.renderDayMetric(gamificationStats, "Weakest category", [...activeSnapshot.categories].sort((left, right) => left.score - right.score)[0]?.label ?? "None");
      this.renderDayMetric(gamificationStats, "Recovery run", `${gamificationSummary.recoveryFromLowScoreDays} days`);
      this.renderDayMetric(gamificationStats, "Best day", gamificationSummary.personalBestDayLabel);
      const categoryList = gamificationStage.createDiv({ cls: "daily-dashboard-gamification-category-grid" });
      activeSnapshot.categories.forEach((category) => {
        const categoryState = this.getGamificationState(category.maxScore > 0 ? Math.round((category.score / category.maxScore) * 100) : 0, category.tone === "done" ? "done" : category.tone === "alert" ? "alert" : category.tone === "log" ? "state" : "focus");
        const row = categoryList.createDiv({ cls: "daily-dashboard-score-block daily-dashboard-gamification-category-card" });
        const rowHeader = row.createDiv({ cls: "daily-dashboard-gamification-category-header" });
        rowHeader.createEl("strong", { text: category.label });
        rowHeader.createEl("span", { cls: `daily-dashboard-semantic-chip is-${categoryState.tone}`, text: categoryState.label });
        rowHeader.createEl("span", { cls: "daily-dashboard-row-meta daily-dashboard-gamification-category-score", text: `${category.score}/${category.maxScore}` });
        row.createEl("span", { cls: "daily-dashboard-row-meta", text: category.summary });
        const track = row.createDiv({ cls: "daily-dashboard-momentum-track" });
        const fill = track.createDiv({ cls: "daily-dashboard-momentum-fill" });
        fill.addClass(`is-${category.tone === "done" ? "done" : category.tone === "alert" ? "alert" : category.tone === "log" ? "log" : "focus"}`);
        fill.style.width = `${Math.max((category.score / category.maxScore) * 100, category.score > 0 ? 10 : 0)}%`;
        if (category.details.length > 0) {
          row.createEl("span", { cls: "daily-dashboard-row-meta", text: category.details.slice(0, 2).join(" • ") });
        }
      });
      const gamificationActions = gamificationCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      createButton(gamificationActions, "Gamification report", async () => this.plugin.generateGamificationReport(), false, "trophy");
      createButton(gamificationActions, "Weekly report", async () => this.plugin.generateWeeklyReport(), false, "bar-chart-3");

      if (settings.budgetingEnabled) {
        const categoryById = new Map(financeData.budgetCategories.map((category) => [category.id, category]));
        const visibleSubscriptions = financeData.subscriptions.filter((subscription) => subscription.status !== "archived");
        const recurringSubscriptions = visibleSubscriptions.filter((subscription) => subscription.kind === "recurring" && subscription.status !== "canceled");
        const otherSubscriptions = visibleSubscriptions.filter((subscription) => subscription.kind === "one-time" || subscription.status === "canceled");
        const activeSubscriptions = visibleSubscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trial" || subscription.status === "paused");
        const dueSoonSubscriptions = visibleSubscriptions.filter((subscription) => {
          const daysUntilRenewal = getDaysUntilDate(subscription.renewalDate);
          return daysUntilRenewal !== null && daysUntilRenewal >= 0 && daysUntilRenewal <= 30;
        });
        const monthlyRecurringTotal = recurringSubscriptions.reduce((sum, subscription) => sum + getSubscriptionMonthlyEquivalent(subscription), 0);
        const yearlyRecurringTotal = recurringSubscriptions.reduce((sum, subscription) => sum + getSubscriptionAnnualizedCost(subscription), 0);
        const costliestSubscription = [...recurringSubscriptions].sort((left, right) => getSubscriptionMonthlyEquivalent(right) - getSubscriptionMonthlyEquivalent(left))[0] ?? null;
        const paymentMethodCounts = activeSubscriptions.reduce((counts, subscription) => {
          const key = subscription.paymentMethod.trim() || "Unknown";
          counts.set(key, (counts.get(key) ?? 0) + 1);
          return counts;
        }, new Map<string, number>());
        const currencyCounts = visibleSubscriptions.reduce((counts, subscription) => {
          const key = subscription.currency.trim() || "USD";
          counts.set(key, (counts.get(key) ?? 0) + 1);
          return counts;
        }, new Map<string, number>());
        const totalBudgetTarget = financeData.budgetCategories.reduce((sum, category) => sum + category.monthlyTarget, 0);
        const committedByCategory = financeData.budgetCategories.reduce((totals, category) => {
          totals.set(category.id, recurringSubscriptions
            .filter((subscription) => subscription.categoryId === category.id)
            .reduce((sum, subscription) => sum + getSubscriptionMonthlyEquivalent(subscription), 0));
          return totals;
        }, new Map<string, number>());
        const budgetingCard = createGridCard("Budgeting", "Keep recurring costs, practical monthly targets, and renewal pressure visible without turning the dashboard into a full accounting app.", {
          icon: "wallet-cards",
          eyebrow: "Money",
          tone: "focus",
          tag: activeSubscriptions.length > 0 ? "Live" : "Optional",
          secondaryTag: "Experimental",
          secondaryTagTone: "alert"
        });
        const budgetingSummary = budgetingCard.createDiv({ cls: "daily-dashboard-chip-row" });
        createSemanticChip(budgetingSummary, `${activeSubscriptions.length} active`, activeSubscriptions.length > 0 ? "focus" : "neutral");
        createSemanticChip(budgetingSummary, `${dueSoonSubscriptions.length} due soon`, dueSoonSubscriptions.length > 0 ? "alert" : "neutral");
        createSemanticChip(budgetingSummary, formatFinanceAmount(monthlyRecurringTotal, "USD"), monthlyRecurringTotal > 0 ? "capture" : "neutral");

        const budgetingActions = budgetingCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(budgetingActions, "Generate snapshot", async () => {
          await this.plugin.generateMonthlyFinanceSnapshot(true);
        }, false, "file-text");
        createButton(budgetingActions, "Generate review", async () => {
          await this.plugin.generateMonthlyFinanceReview(true);
        }, false, "clipboard-list");

        const budgetingTabs = budgetingCard.createDiv({ cls: "daily-dashboard-gamification-tabs" });
        const availableBudgetingTabs = [
          { key: "overview", label: "Overview", metric: `${activeSubscriptions.length}` },
          ...(settings.subscriptionsTrackerEnabled ? [{ key: "subscriptions", label: "Subscriptions", metric: `${visibleSubscriptions.length}` }] : []),
          { key: "budget", label: "Budget", metric: `${financeData.budgetCategories.length}` }
        ] as Array<{ key: "overview" | "subscriptions" | "budget"; label: string; metric: string }>;
        if (!availableBudgetingTabs.some((tab) => tab.key === this.selectedBudgetingTab)) {
          this.selectedBudgetingTab = availableBudgetingTabs[0]?.key ?? "overview";
        }
        availableBudgetingTabs.forEach((tab) => {
          const button = budgetingTabs.createEl("button", {
            cls: this.selectedBudgetingTab === tab.key ? "daily-dashboard-gamification-tab is-active" : "daily-dashboard-gamification-tab"
          });
          button.type = "button";
          button.createEl("span", { text: tab.label });
          button.createEl("strong", { text: tab.metric });
          button.addEventListener("click", () => {
            this.selectedBudgetingTab = tab.key;
            void this.render();
          });
        });

        if (this.selectedBudgetingTab === "overview") {
          const overviewGrid = budgetingCard.createDiv({ cls: "daily-dashboard-gamification-stat-grid" });
          this.renderDayMetric(overviewGrid, "Monthly recurring", formatFinanceAmount(monthlyRecurringTotal, "USD"));
          this.renderDayMetric(overviewGrid, "Yearly recurring", formatFinanceAmount(yearlyRecurringTotal, "USD"));
          this.renderDayMetric(overviewGrid, "Costliest", costliestSubscription ? `${costliestSubscription.name} • ${formatFinanceAmount(getSubscriptionMonthlyEquivalent(costliestSubscription), "USD")}` : "None");
          this.renderDayMetric(overviewGrid, "Budget target", formatFinanceAmount(totalBudgetTarget, "USD"));

          const overviewLists = budgetingCard.createDiv({ cls: "daily-dashboard-budget-overview-grid" });
          const recurringBlock = overviewLists.createDiv({ cls: "daily-dashboard-score-block" });
          const recurringHeader = recurringBlock.createDiv({ cls: "daily-dashboard-score-header" });
          recurringHeader.createEl("strong", { text: "Recurring pressure" });
          createSemanticChip(recurringHeader, `${recurringSubscriptions.length} tracked`, recurringSubscriptions.length > 0 ? "capture" : "neutral");
          if (recurringSubscriptions.length === 0) {
            recurringBlock.createDiv({ cls: "daily-dashboard-empty-state", text: "No recurring subscriptions yet. Add a few and the overview will start surfacing monthly pressure, renewals, and cost concentration." });
          } else {
            const list = recurringBlock.createDiv({ cls: "daily-dashboard-project-list" });
            recurringSubscriptions.slice(0, 6).forEach((subscription) => {
              const row = list.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
              row.createEl("strong", { text: subscription.name });
              const renewalMeta = getDaysUntilDate(subscription.renewalDate);
              row.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: `${formatSubscriptionCycle(subscription)} • ${formatFinanceAmount(subscription.cost, subscription.currency)}${renewalMeta !== null ? ` • renews in ${renewalMeta}d` : ""}`
              });
            });
          }

          const methodsBlock = overviewLists.createDiv({ cls: "daily-dashboard-score-block" });
          const methodsHeader = methodsBlock.createDiv({ cls: "daily-dashboard-score-header" });
          methodsHeader.createEl("strong", { text: "Methods and currencies" });
          createSemanticChip(methodsHeader, `${paymentMethodCounts.size} methods`, paymentMethodCounts.size > 0 ? "state" : "neutral");
          const methodChips = methodsBlock.createDiv({ cls: "daily-dashboard-chip-row" });
          if (paymentMethodCounts.size === 0) {
            createSemanticChip(methodChips, "No payment methods yet", "neutral");
          } else {
            [...paymentMethodCounts.entries()].sort((left, right) => right[1] - left[1]).forEach(([method, count]) => {
              createSemanticChip(methodChips, `${method} ${count}`, "state");
            });
          }
          const currencyChips = methodsBlock.createDiv({ cls: "daily-dashboard-chip-row" });
          if (currencyCounts.size === 0) {
            createSemanticChip(currencyChips, "No currencies yet", "neutral");
          } else {
            [...currencyCounts.entries()].sort((left, right) => right[1] - left[1]).forEach(([currency, count]) => {
              createSemanticChip(currencyChips, `${currency} ${count}`, "capture");
            });
          }
        }

        if (this.selectedBudgetingTab === "subscriptions") {
          const subscriptionActions = budgetingCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
          createButton(subscriptionActions, "Add subscription", async () => {
            new FinanceSubscriptionModal(this.app, this.plugin, financeData.budgetCategories).open();
          }, true, "plus-circle");
          createButton(subscriptionActions, "Add one-time", async () => {
            new FinanceSubscriptionModal(this.app, this.plugin, financeData.budgetCategories, undefined, "one-time").open();
          }, false, "receipt-text");

          const recurringSection = budgetingCard.createDiv({ cls: "daily-dashboard-score-block" });
          const recurringHeader = recurringSection.createDiv({ cls: "daily-dashboard-score-header" });
          recurringHeader.createEl("strong", { text: "Recurring" });
          createSemanticChip(recurringHeader, `${recurringSubscriptions.length} tracked`, recurringSubscriptions.length > 0 ? "capture" : "neutral");
          const recurringList = recurringSection.createDiv({ cls: "daily-dashboard-project-list" });
          if (recurringSubscriptions.length === 0) {
            recurringList.createDiv({ cls: "daily-dashboard-empty-state", text: "No recurring subscriptions yet." });
          } else {
            recurringSubscriptions.forEach((subscription) => {
              const row = recurringList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
              const copy = row.createDiv({ cls: "daily-dashboard-stack" });
              copy.createEl("strong", { text: subscription.name });
              const daysUntilRenewal = getDaysUntilDate(subscription.renewalDate);
              copy.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: `${formatFinanceAmount(subscription.cost, subscription.currency)} • ${formatSubscriptionCycle(subscription)} • ${subscription.paymentMethod || "Method unknown"}`
              });
              copy.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: `${categoryById.get(subscription.categoryId)?.label ?? "Other"} • ${subscription.status}${daysUntilRenewal !== null ? ` • renews in ${daysUntilRenewal}d` : ""}`
              });
              const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
              createButton(actions, "Edit", async () => {
                new FinanceSubscriptionModal(this.app, this.plugin, financeData.budgetCategories, subscription).open();
              }, false, "pencil");
              createButton(actions, "Remove", async () => {
                await this.runDestructiveAction(
                  `Removed subscription \"${subscription.name}\".`,
                  async () => this.plugin.removeFinanceSubscription(subscription.id),
                  async () => this.plugin.saveFinanceSubscription(subscription)
                );
              }, false, "trash-2");
            });
          }

          const otherSection = budgetingCard.createDiv({ cls: "daily-dashboard-score-block" });
          const otherHeader = otherSection.createDiv({ cls: "daily-dashboard-score-header" });
          otherHeader.createEl("strong", { text: "One-time and canceled" });
          createSemanticChip(otherHeader, `${otherSubscriptions.length} tracked`, otherSubscriptions.length > 0 ? "state" : "neutral");
          const otherList = otherSection.createDiv({ cls: "daily-dashboard-project-list" });
          if (otherSubscriptions.length === 0) {
            otherList.createDiv({ cls: "daily-dashboard-empty-state", text: "No one-time or canceled entries yet." });
          } else {
            otherSubscriptions.forEach((subscription) => {
              const row = otherList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-project-row--dense" });
              row.createEl("strong", { text: subscription.name });
              row.createEl("span", {
                cls: "daily-dashboard-row-meta",
                text: `${formatFinanceAmount(subscription.cost, subscription.currency)} • ${subscription.kind === "one-time" ? "One-time" : subscription.status} • ${subscription.paymentMethod || "Method unknown"}`
              });
            });
          }
        }

        if (this.selectedBudgetingTab === "budget") {
          const budgetGrid = budgetingCard.createDiv({ cls: "daily-dashboard-gamification-stat-grid" });
          const committedRecurring = financeData.budgetCategories.reduce((sum, category) => sum + (committedByCategory.get(category.id) ?? 0), 0);
          this.renderDayMetric(budgetGrid, "Target total", formatFinanceAmount(totalBudgetTarget, "USD"));
          this.renderDayMetric(budgetGrid, "Committed recurring", formatFinanceAmount(committedRecurring, "USD"));
          this.renderDayMetric(budgetGrid, "Headroom", formatFinanceAmount(Math.max(totalBudgetTarget - committedRecurring, 0), "USD"));
          this.renderDayMetric(budgetGrid, "Categories", `${financeData.budgetCategories.length}`);

          const categoryAddRow = budgetingCard.createDiv({ cls: "daily-dashboard-inline-form daily-dashboard-inline-form--food" });
          const categoryInput = categoryAddRow.createEl("input", {
            cls: "daily-dashboard-input",
            attr: { type: "text", placeholder: "Add a budget category" }
          });
          categoryInput.value = this.budgetCategoryDraft;
          categoryInput.addEventListener("input", () => {
            this.budgetCategoryDraft = categoryInput.value;
          });
          categoryInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void this.plugin.addBudgetCategory(this.budgetCategoryDraft).then((added) => {
                if (added) {
                  this.budgetCategoryDraft = "";
                }
              });
            }
          });
          createButton(categoryAddRow, "Add category", async () => {
            const added = await this.plugin.addBudgetCategory(this.budgetCategoryDraft);
            if (added) {
              this.budgetCategoryDraft = "";
            }
          }, false, "plus");

          const budgetList = budgetingCard.createDiv({ cls: "daily-dashboard-project-list" });
          financeData.budgetCategories.forEach((category) => {
            const committed = committedByCategory.get(category.id) ?? 0;
            const row = budgetList.createDiv({ cls: "daily-dashboard-project-row daily-dashboard-budget-category-row" });
            const copy = row.createDiv({ cls: "daily-dashboard-stack" });
            const chipRow = copy.createDiv({ cls: "daily-dashboard-chip-row" });
            createSemanticChip(chipRow, category.label, "focus");
            createSemanticChip(chipRow, `${financeData.subscriptions.filter((subscription) => subscription.categoryId === category.id && subscription.kind === "recurring" && subscription.status !== "canceled").length} linked`, committed > 0 ? "capture" : "neutral");
            copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `Committed recurring ${formatFinanceAmount(committed, "USD")}` });
            const controls = row.createDiv({ cls: "daily-dashboard-budget-category-controls" });
            const targetInput = controls.createEl("input", { cls: "daily-dashboard-amount-input", attr: { type: "number", min: "0", step: "1" } });
            targetInput.value = `${category.monthlyTarget}`;
            targetInput.addEventListener("change", () => {
              void this.plugin.updateBudgetCategoryTarget(category.id, Number(targetInput.value));
            });
            const removeButton = controls.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Remove" });
            removeButton.type = "button";
            removeButton.addEventListener("click", () => {
              void this.runDestructiveAction(
                `Removed budget category \"${category.label}\".`,
                async () => this.plugin.removeBudgetCategory(category.id),
                async () => this.plugin.saveBudgetCategory(category)
              );
            });
          });
        }
      }

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
      habitsCard.createEl("span", { cls: "daily-dashboard-row-meta", text: "Drag habit rows to reorder the stack." });
      const habitList = habitsCard.createDiv({ cls: "daily-dashboard-habit-list" });
      this.plugin.getHabitDefinitions().forEach((habit, habitIndex) => {
        const currentValue = todayEntry.habits[habit.id] ?? 0;
        const habitEvents = todayEntry.habitEvents[habit.id] ?? [];
        const inWindowCount = countHabitEventsInWindow(habitEvents, habit.completionWindow);
        const row = habitList.createDiv({ cls: "daily-dashboard-habit-row" });
        row.draggable = true;
        row.addClass("is-draggable");
        row.addEventListener("dragstart", (event) => {
          this.draggedHabitIndex = habitIndex;
          row.addClass("is-dragging");
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", `${habitIndex}`);
          }
        });
        row.addEventListener("dragover", (event) => {
          if (this.draggedHabitIndex === null || this.draggedHabitIndex === habitIndex) {
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
          const draggedIndex = this.draggedHabitIndex;
          this.draggedHabitIndex = null;
          if (draggedIndex === null || draggedIndex === habitIndex) {
            return;
          }

          void this.plugin.reorderHabitDefinitions(draggedIndex, habitIndex).then(async (changed) => {
            if (changed) {
              await this.render();
            }
          });
        });
        row.addEventListener("dragend", () => {
          this.draggedHabitIndex = null;
          row.removeClass("is-dragging");
          row.removeClass("is-drop-target");
        });
        const copy = row.createDiv({ cls: "daily-dashboard-habit-copy" });
        const habitMissNoteValue = todayEntry.habitMissNotes[habit.id] ?? "";
        const habitMissExpanded = this.expandedHabitMissNotes.has(habit.id);
        copy.addClass("is-clickable");
        copy.role = "button";
        copy.tabIndex = 0;
        copy.addEventListener("click", () => {
          void this.plugin.openEditHabitFlow(habit.id);
        });
        copy.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void this.plugin.openEditHabitFlow(habit.id);
          }
        });
        copy.createEl("strong", { text: habit.label });
        const metaChips = copy.createDiv({ cls: "daily-dashboard-chip-row daily-dashboard-habit-chip-row" });
        createSemanticChip(metaChips, `${currentValue}/${habit.target}`, currentValue >= habit.target ? "done" : "neutral");
        createSemanticChip(metaChips, formatHabitCadenceLabel(habit.cadence), "neutral");
        createSemanticChip(metaChips, formatHabitWindowLabel(habit.completionWindow), "neutral");
        if (!isHabitDueOnDate(habit, todayEntry.date)) {
          createSemanticChip(metaChips, "Not due", "log");
        }
        copy.createEl("span", {
          cls: "daily-dashboard-habit-meta",
          text: `${this.plugin.getHabitStreak(habit.id)} streak • best ${this.plugin.getHabitBestStreak(habit.id)} • weight ${habit.difficultyWeight}/3`
        });
        if (habitEvents.length > 0) {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: `Today ${habitEvents.map((item) => item.slice(11)).join(", ")} • in window ${inWindowCount}/${habitEvents.length}`
          });
        } else {
          copy.createEl("span", {
            cls: "daily-dashboard-row-meta",
            text: isHabitDueOnDate(habit, todayEntry.date) ? "No completions logged yet today." : "Not due today."
          });
        }
        const controls = row.createDiv({ cls: "daily-dashboard-habit-controls daily-dashboard-habit-row-controls" });
        const topControls = controls.createDiv({ cls: "daily-dashboard-habit-top-controls" });
        const countButtons = topControls.createDiv({ cls: "daily-dashboard-habit-step-group" });
        for (let index = 1; index <= habit.target; index += 1) {
          const stepButton = countButtons.createEl("button", {
            cls: index <= currentValue ? "daily-dashboard-step is-active" : "daily-dashboard-step",
            text: `${index}`
          });
          stepButton.type = "button";
          stepButton.addEventListener("click", () => {
            const nextValue = currentValue === index ? index - 1 : index;
            void this.plugin.updateHabitValue(habit.id, nextValue);
          });
        }
        const topUtilityButtons = topControls.createDiv({ cls: "daily-dashboard-habit-utility-group" });
        const bottomControls = controls.createDiv({ cls: "daily-dashboard-habit-bottom-controls" });
        if (currentValue < habit.target || habitMissNoteValue.length > 0 || habitMissExpanded) {
          const missToggleButton = bottomControls.createEl("button", {
            cls: habitMissExpanded || habitMissNoteValue.length > 0 ? "daily-dashboard-ghost-button is-active" : "daily-dashboard-ghost-button",
            text: habitMissNoteValue.length > 0 ? "Edit miss note" : "Why missed"
          });
          missToggleButton.type = "button";
          missToggleButton.addEventListener("click", () => {
            if (this.expandedHabitMissNotes.has(habit.id)) {
              this.expandedHabitMissNotes.delete(habit.id);
            } else {
              this.expandedHabitMissNotes.add(habit.id);
            }
            void this.render();
          });
        }
        const removeButton = topUtilityButtons.createEl("button", { cls: "daily-dashboard-remove-button" });
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
        if (habitMissExpanded) {
          const missNoteWrap = row.createDiv({ cls: "daily-dashboard-habit-miss-note" });
          missNoteWrap.createEl("span", { cls: "daily-dashboard-row-meta", text: "Why was this missed? Keep it short so repeated patterns stay easy to scan later." });
          const missNote = missNoteWrap.createEl("input", {
            cls: "daily-dashboard-input",
            attr: { type: "text", placeholder: `Miss note for ${habit.label}` }
          });
          missNote.value = habitMissNoteValue;
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
      const syncDefaultIntakeUnit = (): void => {
        const defaultUnit = getDefaultIntakeUnit(intakeKind.value, measurementSystem);
        intakeUnit.value = defaultUnit;
        intakeUnit.dataset.defaultUnit = defaultUnit;
      };
      const getResolvedIntakeUnit = (): string => {
        return resolveIntakeUnitValue(intakeUnit.value || intakeUnit.dataset.defaultUnit || "", intakeKind.value, measurementSystem);
      };
      syncDefaultIntakeUnit();
      intakeKind.addEventListener("change", () => {
        syncDefaultIntakeUnit();
      });
      const intakeNote = intakeForm.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Optional note" } });
      const intakeButtons = foodCard.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(intakeButtons, "Add entry", async () => {
        const resolvedUnit = getResolvedIntakeUnit();
        await this.plugin.addIntakeEntry(intakeKind.value, intakeLabel.value, Number(intakeAmount.value), resolvedUnit, intakeNote.value);
        intakeLabel.value = "";
        intakeAmount.value = "1";
        syncDefaultIntakeUnit();
        intakeNote.value = "";
        await this.render();
      }, false, "plus-circle");
      createButton(intakeButtons, aiStatus.busy ? "Analyzing..." : "Analyze diet", async () => this.plugin.generateDailyDietInsight(), true, "sparkles");
      createButton(intakeButtons, "Save preset", async () => {
        const trimmedLabel = intakeLabel.value.trim();
        const trimmedUnit = getResolvedIntakeUnit();
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
      const foodInsight = foodCard.createDiv({ cls: "daily-dashboard-row-meta" });
      foodInsight.setText(todayEntry.dietInsight || "Run Analyze diet when you want a quick AI pass on calories and nutrition signals for today.");
      if (settings.intakeQuickPresets.length > 0) {
        const intakePresetSection = this.createCollapsibleSubsection(foodCard, "consumables-presets", "Presets", "Keep one-tap consumables nearby without leaving them expanded all the time.");
        const intakePresetRow = intakePresetSection.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-intake-presets" });
        settings.intakeQuickPresets.forEach((preset) => {
          const presetWrap = intakePresetRow.createDiv({ cls: "daily-dashboard-inline-action-pair" });
          createButton(presetWrap, formatIntakeQuickPresetButtonLabel(preset), async () => {
            await this.plugin.addIntakeEntry(preset.kind, preset.label, preset.amount, preset.unit);
            await this.render();
          }, false, getIntakePresetIcon(preset.kind));
          const removeButton = presetWrap.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-inline-remove-button daily-dashboard-consumable-remove-button" });
          removeButton.type = "button";
          removeButton.ariaLabel = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          removeButton.title = `Remove preset ${formatIntakeQuickPresetButtonLabel(preset)}`;
          removeButton.setText("×");
          removeButton.addEventListener("click", () => {
            void this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              intakeQuickPresets: this.plugin.getSettings().intakeQuickPresets.filter((item) => item.id !== preset.id)
            }).then(async () => this.render());
          });
        });
      }
      const intakeLogSection = this.createCollapsibleSubsection(foodCard, "consumables-entry-log", "Entry log", "Review, edit, and remove the consumables already logged for today.");
      const intakeList = intakeLogSection.createDiv({ cls: "daily-dashboard-food-list" });
      if (intakeEntries.length === 0) {
        const emptyState = intakeList.createDiv({ cls: "daily-dashboard-empty-state daily-dashboard-empty-state--actionable" });
        emptyState.createEl("span", { text: "No consumables logged yet today. Use one flow for drinks, food, meds, and supplements so totals stay analyzable." });
        const emptyActions = emptyState.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
        createButton(emptyActions, "Water", async () => {
          await this.plugin.addIntakeEntry("drink", "Water", measurementSystem === "metric" ? 250 : 8, getDefaultIntakeUnit("drink", measurementSystem));
          await this.render();
        }, false, "glass-water");
        createButton(emptyActions, "Meal", async () => {
          await this.plugin.addIntakeEntry("food", "Meal", 1, "serving");
          await this.render();
        }, false, "utensils-crossed");
        createButton(emptyActions, "Medication", async () => {
          await this.plugin.addIntakeEntry("medication", "Medication", 1, "pill");
          await this.render();
        }, false, "pill");
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
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-consumable-remove-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          removeButton.setText("×");
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
          const removeButton = row.createEl("button", { cls: "daily-dashboard-icon-button daily-dashboard-consumable-remove-button", attr: { "aria-label": `Remove ${item.label}`, title: `Remove ${item.label}` } });
          removeButton.type = "button";
          removeButton.setText("×");
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
      const adaptivePrompts = this.plugin.getAdaptiveReflectionPrompts(todayEntry.date);
      if (adaptivePrompts.length > 0) {
        const reflectionSection = this.createCollapsibleSubsection(notesCard, "sleep-notes-adaptive-reflections", "Adaptive reflection prompts", "Review the day with prompts based on the actual sleep, notes, habit, friction, and energy context already logged.");
        const promptList = reflectionSection.createDiv({ cls: "daily-dashboard-ai-suggestions" });
        adaptivePrompts.forEach((prompt) => {
          const row = promptList.createDiv({ cls: "daily-dashboard-project-row" });
          row.createEl("span", { text: prompt });
        });
      }

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
        this.updateTimelineFilters({
          ...this.timelineFilters,
          keyword: value
        });
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
        this.updateTimelineFilters({
          ...this.timelineFilters,
          project: timelineProjectFilter.value
        });
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
        this.updateTimelineFilters({
          ...this.timelineFilters,
          tag: timelineTagFilter.value
        });
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "From date (YYYY-MM-DD)", this.timelineFilters.fromDate, (value) => {
        this.updateTimelineFilters({
          ...this.timelineFilters,
          fromDate: value
        });
        void this.render();
      });
      this.createFilterInput(timelineFilterGrid, "To date (YYYY-MM-DD)", this.timelineFilters.toDate, (value) => {
        this.updateTimelineFilters({
          ...this.timelineFilters,
          toDate: value
        });
        void this.render();
      });
      const notesOnlyLabel = timelineFilterGrid.createEl("label", { cls: "daily-dashboard-row-meta" });
      const notesOnlyCheckbox = notesOnlyLabel.createEl("input", { attr: { type: "checkbox" } });
      notesOnlyCheckbox.checked = this.timelineFilters.onlyWithNotes;
      notesOnlyCheckbox.addEventListener("change", () => {
        this.updateTimelineFilters({
          ...this.timelineFilters,
          onlyWithNotes: notesOnlyCheckbox.checked
        });
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
          const nextKinds = this.timelineFilters.kinds.includes(item.key)
            ? this.timelineFilters.kinds.filter((candidate) => candidate !== item.key)
            : [...this.timelineFilters.kinds, item.key];

          if (this.timelineFilters.kinds.includes(item.key)) {
            this.updateTimelineFilters({
              ...this.timelineFilters,
              kinds: nextKinds.length > 0 ? nextKinds : ["task", "session", "calendar", "log"]
            });
          } else {
            this.updateTimelineFilters({
              ...this.timelineFilters,
              kinds: nextKinds
            });
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
        paginatedTimelineResults.items.forEach((result) => {
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
      this.renderPaginationControls(timelineCard, paginatedTimelineResults, async (page) => {
        this.setTimelinePage(page);
        await this.render();
      });

      const heatmapCard = createGridCard("Heatmaps", "See work, sleep, and habit density across recent days instead of inferring patterns from memory.", {
        icon: "layout-grid",
        eyebrow: "Patterns",
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
      const aiActionsHeader = aiActionsPanel.createDiv({ cls: "daily-dashboard-ai-panel-header" });
      const aiActionsCopy = aiActionsHeader.createDiv({ cls: "daily-dashboard-stack" });
      aiActionsCopy.createEl("strong", { text: "Workflows" });
      aiActionsCopy.createEl("span", { cls: "daily-dashboard-row-meta", text: "Run focused planning, diagnostic, synthesis, and comparison workflows without leaving the dashboard." });
      createIconButton(aiActionsHeader, "library", "Open AI reference notes", async () => this.openAiReferenceNotesFlow());
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
      aiAskPanel.createEl("label", { cls: "daily-dashboard-field-label", text: "Ask AI or capture a research question" });
      aiAskPanel.createEl("span", { cls: "daily-dashboard-row-meta", text: "Ask AI stays in dashboard/vault mode. Write wiki notes creates durable knowledge-base notes from the question. Open research modal lets you add context before running it." });
      const aiQuestion = aiAskPanel.createEl("textarea", { cls: "daily-dashboard-textarea daily-dashboard-ai-question" });
      aiQuestion.placeholder = "What needs attention first? Which project is dragging hardest? What am I underestimating right now?";
      aiQuestion.value = this.aiQuestionDraft;
      aiQuestion.addEventListener("input", () => {
        this.aiQuestionDraft = aiQuestion.value;
      });
      aiQuestion.rows = 4;
      const aiQuestionActions = aiAskPanel.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact daily-dashboard-ai-actions" });
      createButton(aiQuestionActions, "Ask", async () => this.plugin.askAiQuestion(this.aiQuestionDraft), true, "message-square");
      createButton(aiQuestionActions, "Write notes", async () => this.plugin.askResearchQuestionAndWriteWikiNotes({ question: this.aiQuestionDraft, generateBrief: true, generateAnswer: true, groundingMode: "vault-plus-web" }), false, "notebook-pen");
      createButton(aiQuestionActions, "Research", async () => this.plugin.openAskResearchQuestionFlow(this.aiQuestionDraft), false, "library-big");
      createButton(aiQuestionActions, "Ask modal", async () => this.plugin.openAskAiFlow(), false, "panel-top-open");
      createButton(aiQuestionActions, "Reindex", async () => this.plugin.rebuildAiNoteIndex(true), false, "database-zap");

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
            const addButton = row.createEl("button", { cls: "daily-dashboard-ghost-button", text: "Queue next up" });
            addButton.type = "button";
            addButton.addEventListener("click", () => {
              void this.plugin.addNextUpFocusItem({ text: item });
            });
          });
        }
      } else {
        latestPanel.createDiv({ cls: "daily-dashboard-ai-empty-state", text: "No AI notes yet. AI is optional. Configure it only when you want it, then run a workflow or ask a question to create the first output." });
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
        projectList.createDiv({ cls: "daily-dashboard-empty-state", text: "No project data found in the configured Master Task Hub. Finish first-run setup or add a few project headings and active sections there first." });
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
            if (projectsExpanded && project.projectSummary) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Summary: ${project.projectSummary}` });
            }
            if (projectsExpanded && project.whyItMatters) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Why it matters: ${project.whyItMatters}` });
            }
            if (projectsExpanded && project.definitionOfDone) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Definition of done: ${project.definitionOfDone}` });
            }
            if (projectsExpanded && project.lastReview) {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Last review: ${project.lastReview}` });
            }
            if (projectsExpanded && project.waitingOn && project.waitingOn.toLowerCase() !== "none") {
              row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Waiting on: ${project.waitingOn}` });
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
      const cleanupRenderers: Array<(parent: HTMLElement) => void> = [];
      if (alertLines.length === 0 && cleanupProjects.length === 0 && cleanupSuggestions.length === 0) {
        alertsList.createDiv({ cls: "daily-dashboard-empty-state", text: "No stale-work or cleanup issues detected right now." });
      } else {
        cleanupSuggestions.slice(0, alertsExpanded ? cleanupSuggestions.length : 3).forEach((item) => {
          cleanupRenderers.push((parent) => {
            const row = parent.createDiv({ cls: "daily-dashboard-project-row" });
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
        });

        if (alertsExpanded && cleanupProjects.length > 0) {
          cleanupProjects
            .sort((left, right) => getProjectIssueCount(right) - getProjectIssueCount(left))
            .forEach((project) => {
              cleanupRenderers.push((parent) => {
                const row = parent.createDiv({ cls: "daily-dashboard-project-row" });
                const chipRow = row.createDiv({ cls: "daily-dashboard-chip-row" });
                createSemanticChip(chipRow, `${getProjectIssueCount(project)} issue${getProjectIssueCount(project) === 1 ? "" : "s"}`, getProjectIssueCount(project) >= 4 ? "alert" : "state");
                createSemanticChip(chipRow, project.healthLabel, project.healthScore >= 50 ? "state" : "alert");
                createSemanticChip(chipRow, project.projectState === "active" ? "Active" : project.projectState === "incubating" ? "Incubating" : "Someday", project.projectState === "active" ? "neutral" : "log");
                row.createEl("strong", { text: project.name });
                row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Next action: ${project.nextAction}` });
                if (project.projectSummary) {
                  row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Summary: ${project.projectSummary}` });
                }
                if (project.waitingOn && project.waitingOn.toLowerCase() !== "none") {
                  row.createEl("span", { cls: "daily-dashboard-row-meta", text: `Waiting on: ${project.waitingOn}` });
                }
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
            });
        } else {
          alertLines.slice(0, alertsExpanded ? alertLines.length : 6).forEach((line) => {
            cleanupRenderers.push((parent) => {
              const row = parent.createDiv({ cls: alertsExpanded ? "daily-dashboard-project-row" : "daily-dashboard-project-row daily-dashboard-project-row--dense" });
              row.createEl("span", { text: line });
            });
          });
        }

        const paginatedCleanupRows = this.getPaginatedItems(
          cleanupRenderers,
          this.cleanupPage,
          DailyDashboardView.CLEANUP_RESULTS_PER_PAGE
        );
        this.cleanupPage = paginatedCleanupRows.page;
        paginatedCleanupRows.items.forEach((renderRow) => {
          renderRow(alertsList);
        });
        this.renderPaginationControls(alertsCard, paginatedCleanupRows, async (page) => {
          this.setCleanupPage(page);
          await this.render();
        });
      }
      const alertActions = alertsCard.createDiv({ cls: "daily-dashboard-actions-inline" });
      if (alertLines.length > 6 || cleanupSuggestions.length > 3 || cleanupProjects.length > 0) {
        createButton(alertActions, alertsExpanded ? "Show summary" : "Show details", async () => {
          this.cleanupPage = 1;
          await this.toggleSectionExpanded("cleanup-details");
        }, false, alertsExpanded ? "chevrons-up" : "chevrons-down");
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
      this.getVisibleSessionTrackers().map((tracker) => ({ kind: tracker.id, label: tracker.label, tone: this.getSessionTrackerTone(tracker.id) })).forEach((item) => {
      if (parsedSessions.some((session) => session.kind === item.kind)) {
        createSemanticChip(legend, item.label, item.tone as DashboardTone);
      }
    });

    const strip = parent.createDiv({ cls: "daily-dashboard-timeline-strip" });
    parsedSessions.forEach((session) => {
      const segment = strip.createDiv({ cls: `daily-dashboard-timeline-segment is-${session.kind}` });
      if (!["work", "nap", "relax", "break", "poop"].includes(session.kind)) {
        segment.style.background = this.getSessionTrackerColor(session.kind);
      }
      const left = ((session.startDate.getTime() - startBoundary.getTime()) / totalSpan) * 100;
      const width = ((session.endDate.getTime() - session.startDate.getTime()) / totalSpan) * 100;
      const displayEnd = session.end ?? formatDateTimeKey(session.endDate);
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${displayEnd.slice(11, 16)}${session.tag ? ` • ${session.tag}` : ""}`;
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
        this.getActivitySessionTrackers().forEach((tracker) => {
          this.pushTimelineSessionResults(results, entry.date, tracker.id, entry.activitySessions.filter((session) => session.kind === tracker.id));
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
      const tracker = this.plugin.getSessionTracker(kind);
      const label = tracker?.label ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
      results.push({
        id: `${kind}-${date}-${index}-${session.start}`,
        date,
        sortKey: session.start,
        kind: "session",
        title: `${label} session`,
        summary: `${start}-${end} • ${formatMinutesAsHours(minutes)}`,
        detail: session.tag.trim() ? `Tag ${session.tag.trim()}` : "",
        tone: tracker ? this.getSessionTrackerTone(tracker.id) : (kind === "work" ? "capture" : kind === "poop" ? "log" : kind === "break" ? "alert" : "health"),
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
    this.updateTimelineFilters({
      keyword: "",
      project: "",
      tag: "",
      kinds: ["task", "session", "calendar", "log"],
      fromDate: "",
      toDate: "",
      onlyWithNotes: false
    });
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

    this.updateTimelineFilters({
      ...filter.timelineFilters,
      keyword: filter.timelineFilters.keyword || filter.workLogFilters.keyword,
      project: filter.timelineFilters.project || filter.workLogFilters.project,
      fromDate: filter.timelineFilters.fromDate || filter.workLogFilters.fromDate,
      toDate: filter.timelineFilters.toDate || filter.workLogFilters.toDate,
      kinds: filter.timelineFilters.kinds.length > 0 ? [...filter.timelineFilters.kinds] : ["task", "session", "calendar", "log"]
    });
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

  private getCurrentWeekTimeBoard(weekOffset = 0): Array<{
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
    start.setDate(start.getDate() - currentDayIndex + (weekOffset * 7));
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
      this.getActivitySessionTrackers().forEach((tracker) => {
        minutesByKind[tracker.id] = entry ? this.plugin.getTrackedActivityMinutes(entry, tracker.id) : 0;
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

  private renderWeekBarSegment(parent: HTMLElement, tone: string, minutes: number, color?: string): void {
    if (minutes <= 0) {
      return;
    }

    const segment = parent.createDiv({ cls: `daily-dashboard-week-segment is-${tone}` });
    if (color) {
      segment.style.background = this.buildGradientFromColor(color);
    }
    segment.style.height = `${(minutes / 1440) * 100}%`;
    segment.ariaLabel = `${tone} ${this.formatWeekBarValue(minutes)}`;

    const label = segment.createEl("span", { text: this.formatWeekBarValue(minutes) });
    if (minutes < 120) {
      label.addClass("is-compact");
    }
  }

  private renderWeekLegendItem(parent: HTMLElement, label: string, tone: string, color?: string): void {
    const item = parent.createDiv({ cls: "daily-dashboard-week-legend-item" });
    const dot = item.createDiv({ cls: `daily-dashboard-week-legend-dot is-${tone}` });
    if (color) {
      dot.style.background = color;
    }
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

  private getWeekAtAGlanceRangeLabel(days: Array<{ date: string }>): string {
    const firstDay = days[0]?.date ?? "";
    const lastDay = days[days.length - 1]?.date ?? "";
    if (!firstDay || !lastDay) {
      return "Week view";
    }

    return `${firstDay.slice(5)} to ${lastDay.slice(5)}`;
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

export class SessionDeckCustomizationModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private trackers: SessionTrackerDefinition[];
  private draggedTrackerId: string | null = null;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
    this.trackers = plugin.getSessionTrackers().map((tracker) => ({ ...tracker }));
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-layout-modal");
    this.setTitle("Customize Session Deck");
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
      text: "Choose which session buttons appear, reorder them, rename them, and assign colors that flow into the week view. Hidden trackers still preserve historical data."
    });

    const list = contentEl.createDiv({ cls: "daily-dashboard-layout-list" });
    this.trackers.forEach((tracker, index) => {
      const row = list.createDiv({ cls: "daily-dashboard-layout-row" });
      if (!tracker.visible) {
        row.addClass("is-hidden");
      }
      const dragHandle = row.createDiv({ cls: "daily-dashboard-layout-drag-handle" });
      dragHandle.draggable = true;
      dragHandle.ariaLabel = `Drag ${tracker.label}`;
      setIcon(dragHandle, "grip-vertical");
      dragHandle.addEventListener("dragstart", (event) => {
        this.draggedTrackerId = tracker.id;
        row.addClass("is-dragging");
        event.dataTransfer?.setData("text/plain", tracker.id);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
      });
      row.addEventListener("dragover", (event) => {
        if (!this.draggedTrackerId || this.draggedTrackerId === tracker.id) {
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
        if (!this.draggedTrackerId || this.draggedTrackerId === tracker.id) {
          return;
        }

        this.moveTrackerToIndex(this.draggedTrackerId, index);
        this.draggedTrackerId = null;
        this.renderContent();
      });
      row.addEventListener("dragend", () => {
        this.draggedTrackerId = null;
        row.removeClass("is-dragging");
        row.removeClass("is-drop-target");
      });

      const copy = row.createDiv({ cls: "daily-dashboard-stack" });
      copy.createEl("strong", { text: `${index + 1}. ${tracker.label}` });
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: `${tracker.visible ? "Visible" : "Hidden"} • ${tracker.id}` });
      const editor = copy.createDiv({ cls: "daily-dashboard-session-tracker-editor" });
      const labelInput = editor.createEl("input", { cls: "daily-dashboard-input", attr: { type: "text", placeholder: "Tracker label" } });
      labelInput.value = tracker.label;
      labelInput.addEventListener("change", () => {
        tracker.label = labelInput.value.trim() || tracker.label;
        copy.querySelector("strong")?.setText(`${index + 1}. ${tracker.label}`);
      });
      const colorInput = editor.createEl("input", { cls: "daily-dashboard-color-input", attr: { type: "color" } });
      colorInput.value = tracker.color;
      colorInput.addEventListener("input", () => {
        tracker.color = colorInput.value;
      });

      const controls = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(controls, "Up", async () => {
        this.moveTrackerToIndex(tracker.id, Math.max(0, index - 1));
        this.renderContent();
      }, false, "arrow-up");
      createButton(controls, "Down", async () => {
        this.moveTrackerToIndex(tracker.id, Math.min(this.trackers.length - 1, index + 1));
        this.renderContent();
      }, false, "arrow-down");
      createButton(controls, tracker.visible ? "Hide" : "Show", async () => {
        tracker.visible = !tracker.visible;
        this.renderContent();
      }, false, tracker.visible ? "eye-off" : "eye");
      const canDelete = !DEFAULT_SETTINGS.sessionTrackers.some((defaultTracker) => defaultTracker.id === tracker.id);
      if (canDelete) {
        createButton(controls, "Delete", async () => {
          this.trackers = this.trackers.filter((candidate) => candidate.id !== tracker.id);
          this.renderContent();
        }, false, "trash-2");
      }
    });

    const footer = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(footer, "Add custom", async () => {
      const nextId = this.createCustomTrackerId("custom-session");
      this.trackers.push({ id: nextId, label: "Custom session", color: "#7d9df5", visible: true });
      this.renderContent();
    }, false, "plus-circle");
    createButton(footer, "Reset defaults", async () => {
      this.trackers = DEFAULT_SETTINGS.sessionTrackers.map((tracker) => ({ ...tracker }));
      this.renderContent();
    }, false, "rotate-ccw");
    createButton(footer, "Apply", async () => {
      await this.plugin.updateSessionTrackers(this.trackers.map((tracker) => ({
        ...tracker,
        id: this.normalizeTrackerId(tracker.id || tracker.label),
        label: tracker.label.trim() || "Custom session"
      })));
      this.close();
    }, true, "check");
  }

  private moveTrackerToIndex(trackerId: string, targetIndex: number): void {
    const index = this.trackers.findIndex((tracker) => tracker.id === trackerId);
    if (index < 0 || targetIndex < 0 || targetIndex >= this.trackers.length) {
      return;
    }

    const [tracker] = this.trackers.splice(index, 1);
    this.trackers.splice(targetIndex, 0, tracker);
  }

  private createCustomTrackerId(baseLabel: string): string {
    const baseId = this.normalizeTrackerId(baseLabel);
    let nextId = baseId;
    let suffix = 2;
    while (this.trackers.some((tracker) => tracker.id === nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return nextId;
  }

  private normalizeTrackerId(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom-session";
  }
}

export class DashboardDocumentationModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private query = "";
  private entries: DashboardDocumentationEntry[];

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
    this.entries = plugin.getDocumentationCenterEntries();
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-layout-modal");
    this.setTitle("DASH Documentation");
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
      text: "Search the user guides, open the right note directly, and keep the docs in the vault instead of buried in repo planning files."
    });

    const quickActions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline" });
    createButton(quickActions, "Start here", async () => {
      await this.plugin.openDocumentationHomeNote();
      this.close();
    }, true, "book-open");
    createButton(quickActions, "FAQ", async () => {
      await this.plugin.openDocumentationFaqNote();
      this.close();
    }, false, "circle-help");
    createButton(quickActions, "Refresh docs", async () => {
      await this.plugin.refreshDocumentationNotes(true);
      this.entries = this.plugin.getDocumentationCenterEntries();
      this.renderContent();
    }, false, "refresh-cw");

    const searchInput = contentEl.createEl("input", {
      cls: "daily-dashboard-input",
      attr: { type: "search", placeholder: "Search docs, features, workflows, and common questions" }
    });
    searchInput.value = this.query;
    searchInput.addEventListener("input", () => {
      this.query = searchInput.value;
      this.renderContent();
    });

    const normalizedQuery = this.query.trim().toLowerCase();
    const filteredEntries = this.entries.filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [entry.title, entry.description, entry.section, entry.path, ...entry.keywords]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const summary = contentEl.createDiv({ cls: "daily-dashboard-chip-row" });
    createSemanticChip(summary, `${filteredEntries.length} results`, filteredEntries.length > 0 ? "focus" : "neutral");
    createSemanticChip(summary, `${new Set(filteredEntries.map((entry) => entry.section)).size} sections`, "log");

    if (filteredEntries.length === 0) {
      contentEl.createDiv({
        cls: "daily-dashboard-empty-state",
        text: "No documentation pages matched that search. Try a feature name like Kanban, AI, reports, quick start, or FAQ."
      });
      return;
    }

    let currentSection = "";
    filteredEntries.forEach((entry) => {
      if (entry.section !== currentSection) {
        currentSection = entry.section;
        contentEl.createEl("h4", { text: currentSection });
      }

      const row = contentEl.createDiv({ cls: "daily-dashboard-layout-row" });
      const copy = row.createDiv({ cls: "daily-dashboard-stack" });
      copy.createEl("strong", { text: entry.title });
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: entry.description });
      copy.createEl("span", { cls: "daily-dashboard-row-meta", text: entry.path });

      const actions = row.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
      createButton(actions, "Open", async () => {
        await this.plugin.openDocumentationPage(entry.id);
        this.close();
      }, true, "arrow-up-right");
    });

    window.setTimeout(() => {
      searchInput.focus();
      searchInput.setSelectionRange(this.query.length, this.query.length);
    }, 0);
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

export class AiReferenceNotesModal extends Modal {
  private plugin: DailyDashboardPlugin;

  constructor(app: App, plugin: DailyDashboardPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("AI Reference Notes");

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "These notes feed the AI context layer. They are not workflows, so they stay out of the main action grid and open only on demand."
    });

    const notes: Array<{ label: string; description: string; open: () => Promise<void> }> = [
      { label: "Basic Information", description: "Stable facts and long-lived constraints.", open: async () => this.plugin.openBasicInformationNote() },
      { label: "AI Guardrails", description: "Rules for tone, behavior, and decision style.", open: async () => this.plugin.openAiGuardrailsNote() },
      { label: "Current Season", description: "Temporary priorities and present-phase constraints.", open: async () => this.plugin.openCurrentSeasonNote() },
      { label: "Dependencies", description: "People, blockers, and external coordination context.", open: async () => this.plugin.openPeopleDependenciesNote() },
      { label: "Decision Journal", description: "Important decisions and their reasoning.", open: async () => this.plugin.openDecisionJournalNote() },
      { label: "System Map", description: "How the vault and support notes fit together.", open: async () => this.plugin.openSystemMapNote() }
    ];

    notes.forEach((note) => {
      new Setting(contentEl)
        .setName(note.label)
        .setDesc(note.description)
        .addButton((button) => {
          button.setButtonText("Open");
          button.onClick(() => {
            void note.open();
            this.close();
          });
        });
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
    createButton(footer, "Skip setup", async () => {
      await this.plugin.completeFirstRunSetupWizard();
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
        await this.plugin.ensureCoreSupportNotesExist();
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
      .setName("Basic information note path")
      .setDesc("This note is created automatically and gives AI a durable place for age, height, interests, preferences, and other stable context.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.basicInfoNotePath)
          .setValue(this.settingsValue.basicInfoNotePath)
          .onChange((value) => {
            this.settingsValue.basicInfoNotePath = value.trim() || DEFAULT_SETTINGS.basicInfoNotePath;
          });
      });

    new Setting(parent)
      .setName("Include basic information in AI")
      .setDesc("Keep this on if you want AI workflows to automatically read the Basic Information note when it exists.")
      .addToggle((toggle) => {
        toggle.setValue(this.settingsValue.includeBasicInfoInAi).onChange((value) => {
          this.settingsValue.includeBasicInfoInAi = value;
        });
      });

    new Setting(parent)
      .setName("AI Guardrails note path")
      .setDesc("Operational instructions for how AI should reason, write, and prioritize when helping inside this system.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiGuardrailsNotePath)
          .setValue(this.settingsValue.aiGuardrailsNotePath)
          .onChange((value) => {
            this.settingsValue.aiGuardrailsNotePath = value.trim() || DEFAULT_SETTINGS.aiGuardrailsNotePath;
          });
      });

    new Setting(parent)
      .setName("Include AI Guardrails in AI")
      .setDesc("Inject the AI Guardrails note into AI requests so behavior rules stay durable and explicit.")
      .addToggle((toggle) => {
        toggle.setValue(this.settingsValue.includeAiGuardrailsInAi).onChange((value) => {
          this.settingsValue.includeAiGuardrailsInAi = value;
        });
      });

    new Setting(parent)
      .setName("Current Season note path")
      .setDesc("Short-lived priorities, constraints, and review questions for the current operating season.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.currentSeasonNotePath)
          .setValue(this.settingsValue.currentSeasonNotePath)
          .onChange((value) => {
            this.settingsValue.currentSeasonNotePath = value.trim() || DEFAULT_SETTINGS.currentSeasonNotePath;
          });
      });

    new Setting(parent)
      .setName("Include Current Season in AI")
      .setDesc("Inject the Current Season note into AI requests so current priorities and constraints stay in scope.")
      .addToggle((toggle) => {
        toggle.setValue(this.settingsValue.includeCurrentSeasonInAi).onChange((value) => {
          this.settingsValue.includeCurrentSeasonInAi = value;
        });
      });

    new Setting(parent)
      .setName("People / External Dependencies note path")
      .setDesc("Optional note for recurring outside blockers, dependency owners, and stable coordination context.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.peopleDependenciesNotePath)
          .setValue(this.settingsValue.peopleDependenciesNotePath)
          .onChange((value) => {
            this.settingsValue.peopleDependenciesNotePath = value.trim() || DEFAULT_SETTINGS.peopleDependenciesNotePath;
          });
      });

    new Setting(parent)
      .setName("Include People / External Dependencies in AI")
      .setDesc("Turn this on if outside blockers are common enough that AI should automatically read this note during planning and review.")
      .addToggle((toggle) => {
        toggle.setValue(this.settingsValue.includePeopleDependenciesInAi).onChange((value) => {
          this.settingsValue.includePeopleDependenciesInAi = value;
        });
      });

    new Setting(parent)
      .setName("Decision Journal note path")
      .setDesc("Lightweight running record of important choices and why they were made.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.decisionJournalNotePath)
          .setValue(this.settingsValue.decisionJournalNotePath)
          .onChange((value) => {
            this.settingsValue.decisionJournalNotePath = value.trim() || DEFAULT_SETTINGS.decisionJournalNotePath;
          });
      });

    new Setting(parent)
      .setName("System Map note path")
      .setDesc("High-level map of which notes hold action, context, history, and review material.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.systemMapNotePath)
          .setValue(this.settingsValue.systemMapNotePath)
          .onChange((value) => {
            this.settingsValue.systemMapNotePath = value.trim() || DEFAULT_SETTINGS.systemMapNotePath;
          });
      });

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
      .setName("Knowledge base raw folder")
      .setDesc("Where clipped source notes, paper captures, and other raw research material should live.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseRawFolder)
          .setValue(this.settingsValue.knowledgeBaseRawFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseRawFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseRawFolder;
          });
      });

    new Setting(parent)
      .setName("Knowledge base source summaries folder")
      .setDesc("Compiled per-source summaries written from raw material into the wiki layer.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseSourcesFolder)
          .setValue(this.settingsValue.knowledgeBaseSourcesFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseSourcesFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseSourcesFolder;
          });
      });

    new Setting(parent)
      .setName("Knowledge base concept folder")
      .setDesc("Merged concept notes that synthesize claims across multiple source summaries.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseConceptsFolder)
          .setValue(this.settingsValue.knowledgeBaseConceptsFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseConceptsFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseConceptsFolder;
          });
      });

    new Setting(parent)
      .setName("Knowledge base index folder")
      .setDesc("Topic maps, question lists, glossaries, and other navigation notes for the compiled wiki.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseIndexesFolder)
          .setValue(this.settingsValue.knowledgeBaseIndexesFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseIndexesFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseIndexesFolder;
          });
      });

    new Setting(parent)
      .setName("Knowledge base outputs folder")
      .setDesc("Answer notes, syntheses, briefs, and other derived markdown outputs should be written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseOutputsFolder)
          .setValue(this.settingsValue.knowledgeBaseOutputsFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseOutputsFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseOutputsFolder;
          });
      });

    new Setting(parent)
      .setName("Knowledge base assets folder")
      .setDesc("Local images and supporting files referenced by knowledge-base notes.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseAssetsFolder)
          .setValue(this.settingsValue.knowledgeBaseAssetsFolder)
          .onChange((value) => {
            this.settingsValue.knowledgeBaseAssetsFolder = value.trim() || DEFAULT_SETTINGS.knowledgeBaseAssetsFolder;
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
  private templates: KanbanBoardTemplate[];
  private themes: DashboardKanbanThemeDefinition[];

  constructor(app: App, plugin: DailyDashboardPlugin, categories: string[]) {
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.templates = this.plugin.getKanbanBoardTemplates();
    this.themes = this.plugin.getKanbanThemeDefinitions();
    const defaultTemplateId = this.templates[0]?.templateId ?? "execution-default";
    const defaultThemeId = this.themes[0]?.themeId ?? "dark";
    const defaultTemplate = this.templates.find((template) => template.templateId === defaultTemplateId) ?? null;
    this.state = {
      projectName: "",
      categoryName: categories[0] ?? "Projects",
      status: "Planning",
      focus: "",
      kanbanTemplateId: defaultTemplateId,
      kanbanTheme: defaultThemeId,
      kanbanShowLaneCategories: kanbanTemplateSupportsLaneCategories(defaultTemplate),
      useCustomKanban: false
    };
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-project-modal");
    this.setTitle("Create Project And Project Note");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Project name")
      .setDesc("Used for the master todo section and the new project note name.")
      .addText((text) => {
        text
          .setPlaceholder("New Project")
          .setValue(this.state.projectName)
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
          .setValue(this.categories.includes(this.state.categoryName) ? "" : this.state.categoryName)
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
      .setName("Kanban template")
      .setDesc("Pick a starting board shape for this project. Enable custom if you want to tune it immediately after creation.")
      .addDropdown((dropdown) => {
        this.templates.forEach((template) => dropdown.addOption(template.templateId, template.name));
        dropdown.setValue(this.state.kanbanTemplateId);
        dropdown.onChange((value) => {
          const template = this.templates.find((candidate) => candidate.templateId === value) ?? null;
          this.state.kanbanTemplateId = value;
          if (!this.state.useCustomKanban) {
            this.state.kanbanShowLaneCategories = kanbanTemplateSupportsLaneCategories(template);
          }
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Custom board")
      .setDesc("Open board settings right after project creation so you can rename lanes, switch layout, or reshape the board.")
      .addToggle((toggle) => {
        toggle.setValue(this.state.useCustomKanban);
        toggle.onChange((value) => {
          this.state.useCustomKanban = value;
          if (!value) {
            const template = this.templates.find((candidate) => candidate.templateId === this.state.kanbanTemplateId) ?? null;
            this.state.kanbanShowLaneCategories = kanbanTemplateSupportsLaneCategories(template);
          }
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Board theme")
      .setDesc("Sets the starting Kanban board palette for this project.")
      .addDropdown((dropdown) => {
        this.themes.forEach((theme) => dropdown.addOption(theme.themeId, theme.name));
        dropdown.setValue(this.state.kanbanTheme);
        dropdown.onChange((value) => {
          this.state.kanbanTheme = value as DashboardKanbanTheme;
        });
      });

    new Setting(contentEl)
      .setName("Use swimlane categories")
      .setDesc("Only enable category bands when the project actually needs grouped swimlanes. Standard boards keep this off.")
      .addToggle((toggle) => {
        toggle.setValue(this.state.kanbanShowLaneCategories);
        toggle.onChange((value) => {
          this.state.kanbanShowLaneCategories = value;
        });
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
    this.modalEl.removeClass("daily-dashboard-project-modal");
    this.contentEl.empty();
  }
}

class KanbanVaultImagePickerModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private query = "";
  private readonly onChoose: (path: string) => Promise<void>;

  constructor(app: App, plugin: DailyDashboardPlugin, onChoose: (path: string) => Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.onChoose = onChoose;
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-vault-image-modal");
    this.setTitle("Link Vault Image");
    this.render();
  }

  onClose(): void {
    this.modalEl.removeClass("daily-dashboard-vault-image-modal");
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const allImages = this.plugin.getAvailableKanbanImagePaths();
    const normalizedQuery = this.query.trim().toLowerCase();
    const filteredImages = normalizedQuery
      ? allImages.filter((image) => image.path.toLowerCase().includes(normalizedQuery) || image.name.toLowerCase().includes(normalizedQuery))
      : allImages;

    const search = contentEl.createEl("input", {
      cls: "daily-dashboard-input daily-dashboard-vault-image-search",
      attr: {
        type: "search",
        placeholder: "Search vault images by name or path"
      }
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.render();
    });

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Choose an existing vault image to link without duplicating the file."
    });

    const list = contentEl.createDiv({ cls: "daily-dashboard-vault-image-list" });
    if (filteredImages.length === 0) {
      list.createEl("p", {
        cls: "daily-dashboard-row-meta",
        text: allImages.length === 0 ? "No supported image files were found in the vault." : "No images matched that search."
      });
    } else {
      filteredImages.slice(0, 200).forEach((image) => {
        const button = list.createEl("button", { cls: "daily-dashboard-vault-image-row" });
        button.type = "button";
        button.createEl("strong", { cls: "daily-dashboard-vault-image-name", text: image.name });
        button.createEl("span", { cls: "daily-dashboard-vault-image-path", text: image.path });
        button.addEventListener("click", () => {
          void this.onChoose(image.path).then(() => this.close());
        });
      });

      if (filteredImages.length > 200) {
        list.createEl("p", {
          cls: "daily-dashboard-row-meta",
          text: `Showing the first 200 of ${filteredImages.length} matching images. Refine the search to narrow the list.`
        });
      }
    }

    window.setTimeout(() => search.focus(), 0);
  }
}

class KanbanPhotoUploadModal extends Modal {
  private readonly onUpload: (files: File[]) => Promise<void>;

  constructor(app: App, onUpload: (files: File[]) => Promise<void>) {
    super(app);
    this.onUpload = onUpload;
  }

  onOpen(): void {
    this.modalEl.addClass("daily-dashboard-vault-image-modal");
    this.setTitle("Upload Card Image");
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "Choose a local image file to copy into the project's Kanban attachment folder."
    });

    const fileInput = contentEl.createEl("input", {
      cls: "daily-dashboard-input daily-dashboard-file-input",
      attr: {
        type: "file",
        accept: "image/*",
        multiple: "multiple"
      }
    });

    const selectionMeta = contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "No images selected yet."
    });
    fileInput.addEventListener("change", () => {
      const count = fileInput.files?.length ?? 0;
      selectionMeta.setText(count === 0
        ? "No images selected yet."
        : count === 1
          ? `1 image selected: ${fileInput.files?.[0]?.name ?? "image"}`
          : `${count} images selected.`);
    });

    const actions = contentEl.createDiv({ cls: "daily-dashboard-actions-inline daily-dashboard-actions-inline--compact" });
    const uploadButton = actions.createEl("button", { cls: "mod-cta", text: "Attach images" });
    uploadButton.type = "button";
    uploadButton.addEventListener("click", () => {
      const selected = Array.from(fileInput.files ?? []);
      if (selected.length === 0) {
        new Notice("Choose one or more image files first.");
        return;
      }

      void this.onUpload(selected).then(() => this.close());
    });

    const cancelButton = actions.createEl("button", { text: "Cancel" });
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.modalEl.removeClass("daily-dashboard-vault-image-modal");
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

  private toDateTimeLocalValue(value: string | null): string {
    if (!value?.trim()) {
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
      const displayEnd = session.end ?? formatDateTimeKey(session.endDate);
      segment.style.left = `${Math.max(0, left)}%`;
      segment.style.width = `${Math.max(0.75, width)}%`;
      segment.title = `${session.kind} ${session.start.slice(11, 16)}-${displayEnd.slice(11, 16)}${session.tag ? ` • ${session.tag}` : ""}`;
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
          session.end = endInput.value.trim() || null;
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
  end: string | null;
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
      task.unblockDate ? `Unblock ${task.unblockDate}` : "",
      task.effort ? `Effort ${task.effort}` : "",
      task.energy ? `Energy ${task.energy}` : "",
      task.executionContext ? `Context ${task.executionContext}` : "",
      task.trigger ? `Trigger ${task.trigger}` : "",
      task.minimumStep ? `Minimum step: ${task.minimumStep}` : ""
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
        effort: "",
        energy: "",
        executionContext: "",
        trigger: "",
        minimumStep: "",
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

export class KanbanQuickAddModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private projects: TodoProjectSummary[];
  private selectedProjectName: string;
  private selectedLane: string;
  private taskText: string;

  constructor(app: App, plugin: DailyDashboardPlugin, projects: TodoProjectSummary[], initial?: { projectName?: string; lane?: string }) {
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.selectedProjectName = projects.find((project) => project.name === initial?.projectName)?.name ?? projects[0]?.name ?? "";
    const defaultLane = this.plugin.getKanbanLaneOptions(this.selectedProjectName).find((option) => !option.done && !option.unmapped)?.laneKey ?? "now";
    this.selectedLane = initial?.lane && this.plugin.getKanbanLaneOptions(this.selectedProjectName).some((option) => option.laneKey === initial.lane || option.targetSection === initial.lane)
      ? (this.plugin.getKanbanLaneOptions(this.selectedProjectName).find((option) => option.laneKey === initial.lane || option.targetSection === initial.lane)?.laneKey ?? defaultLane)
      : defaultLane;
    this.taskText = "";
  }

  private getLaneOptions(): KanbanLaneOption[] {
    return this.plugin.getKanbanLaneOptions(this.selectedProjectName).filter((option) => !option.done);
  }

  onOpen(): void {
    this.setTitle("Kanban Quick Add Task");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Project")
      .setDesc("Choose which project board should receive the new task.")
      .addDropdown((dropdown) => {
        this.projects.forEach((project) => dropdown.addOption(project.name, project.name));
        dropdown.setValue(this.selectedProjectName);
        dropdown.onChange((value) => {
          this.selectedProjectName = value;
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Lane")
      .setDesc("This maps directly back to the matching Master Task Hub section.")
      .addDropdown((dropdown) => {
        const laneOptions = this.getLaneOptions();
        laneOptions.forEach((lane) => dropdown.addOption(lane.laneKey, lane.categoryLabel ? `${lane.categoryLabel} • ${lane.label}` : lane.helperText ? `${lane.label} (${lane.helperText})` : lane.label));
        if (!laneOptions.some((lane) => lane.laneKey === this.selectedLane)) {
          this.selectedLane = laneOptions[0]?.laneKey || "now";
        }
        dropdown.setValue(this.selectedLane);
        dropdown.onChange((value) => {
          this.selectedLane = value;
        });
      });

    new Setting(contentEl)
      .setName("Task text")
      .setDesc("Keep it concrete. The task will be inserted into the Master Task Hub and then mirrored into the Kanban Hub.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Ship the next Kanban improvement")
          .setValue(this.taskText)
          .onChange((value) => {
            this.taskText = value;
          });
        textArea.inputEl.rows = 4;
        window.setTimeout(() => textArea.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Add task").setCta().onClick(async () => {
          if (!this.selectedProjectName.trim() || !this.taskText.trim()) {
            new Notice("Project and task text are required.");
            return;
          }

          await this.plugin.addKanbanTask(this.selectedProjectName, this.selectedLane, this.taskText);
          new Notice("Kanban task added.");
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

export class DashKanbanBoardSettingsModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private projects: TodoProjectSummary[];
  private templates: KanbanBoardTemplate[];
  private themes: DashboardKanbanThemeDefinition[];
  private selectedProjectName: string;
  private selectedTemplateId: string;
  private showInHub = true;
  private boardHeight = 420;
  private collapsedInHub = false;
  private showLaneCategories = false;
  private stickyHeaders = false;
  private theme: DashboardKanbanTheme = "dark";
  private laneDefinitions: KanbanLaneDefinition[] = [];
  private laneOverridesExpanded = false;

  constructor(app: App, plugin: DailyDashboardPlugin, projects: TodoProjectSummary[], initialProjectName = "") {
    super(app);
    this.plugin = plugin;
    this.projects = projects;
    this.templates = this.plugin.getKanbanBoardTemplates();
    this.themes = this.plugin.getKanbanThemeDefinitions();
    this.selectedProjectName = projects.find((project) => project.name === initialProjectName)?.name ?? projects[0]?.name ?? "";
    this.selectedTemplateId = this.templates[0]?.templateId ?? "execution-default";
    this.theme = this.themes[0]?.themeId ?? "dark";
    this.loadProjectDraft(this.selectedProjectName);
  }

  private loadProjectDraft(projectName: string): void {
    const configuration = this.plugin.getKanbanBoardConfiguration(projectName);
    const fallbackTemplate = this.templates.find((template) => template.templateId === configuration.templateId)
      ?? this.templates[0];
    this.selectedProjectName = projectName;
    this.selectedTemplateId = fallbackTemplate?.templateId ?? "execution-default";
    this.showInHub = configuration.showInHub;
    this.boardHeight = configuration.boardHeight;
    this.collapsedInHub = configuration.collapsedInHub;
    this.showLaneCategories = configuration.showLaneCategories;
    this.stickyHeaders = configuration.stickyHeaders;
    this.theme = configuration.theme;
    this.laneDefinitions = this.cloneLaneDefinitions(
      configuration.laneDefinitions.length > 0
        ? configuration.laneDefinitions
        : fallbackTemplate?.laneDefinitions ?? []
    );
  }

  private getSelectedTemplate(): KanbanBoardTemplate | null {
    return this.templates.find((template) => template.templateId === this.selectedTemplateId) ?? this.templates[0] ?? null;
  }

  private laneDefinitionsMatch(left: KanbanLaneDefinition[], right: KanbanLaneDefinition[]): boolean {
    return JSON.stringify(left.map(({ mappedSections, ...lane }) => lane)) === JSON.stringify(right.map(({ mappedSections, ...lane }) => lane));
  }

  private isCurrentTemplateCustom(): boolean {
    const template = this.getSelectedTemplate();
    if (!template || this.laneDefinitions.length === 0) {
      return false;
    }

    return !this.laneDefinitionsMatch(this.normalizeDraftLanes(), template.laneDefinitions);
  }

  private cloneLaneDefinitions(lanes: KanbanLaneDefinition[]): KanbanLaneDefinition[] {
    return lanes.map((lane) => ({
      laneKey: lane.laneKey,
      label: lane.label,
      helperText: lane.helperText,
      columnKey: lane.columnKey,
      categoryKey: lane.categoryKey,
      categoryLabel: lane.categoryLabel,
      categorySubtitle: lane.categorySubtitle,
      categoryColor: lane.categoryColor,
      categoryTag: lane.categoryTag,
      ruleType: lane.ruleType,
      mappedSections: [...lane.mappedSections],
      done: lane.done
    }));
  }

  private buildLaneKey(label: string, fallbackKey: string): string {
    const normalized = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || fallbackKey || `lane-${Date.now()}`;
  }

  private normalizeDraftLanes(): KanbanLaneDefinition[] {
    return this.laneDefinitions
      .map((lane, index) => {
        const label = lane.label.trim();
        const helperText = lane.helperText.trim();
        const categoryLabel = lane.categoryLabel.trim();
        const mappedSections = lane.mappedSections.map((section) => section.trim()).filter(Boolean);
        const done = lane.done;
        const ruleType: KanbanLaneDefinition["ruleType"] = done ? "completion-state" : mappedSections.length > 0 ? "hub-section" : "custom";
        return {
          laneKey: lane.laneKey.trim() || this.buildLaneKey(label, `lane-${index + 1}`),
          label,
          helperText,
          columnKey: lane.columnKey.trim() || this.buildLaneKey(label, lane.laneKey || `column-${index + 1}`),
          categoryKey: this.buildLaneKey(categoryLabel, lane.categoryKey || `group-${index + 1}`),
          categoryLabel,
          categorySubtitle: lane.categorySubtitle.trim(),
          categoryColor: lane.categoryColor.trim(),
          categoryTag: lane.categoryTag.trim().toLowerCase(),
          ruleType,
          mappedSections,
          done
        };
      })
      .filter((lane) => lane.label.length > 0);
  }

  private moveLane(fromIndex: number, toIndex: number): void {
    if (toIndex < 0 || toIndex >= this.laneDefinitions.length || fromIndex === toIndex) {
      return;
    }

    const next = [...this.laneDefinitions];
    const [lane] = next.splice(fromIndex, 1);
    if (!lane) {
      return;
    }

    next.splice(toIndex, 0, lane);
    this.laneDefinitions = next;
    this.onOpen();
  }

  private renderThemePreviewStrip(parent: HTMLElement): void {
    const strip = parent.createDiv({ cls: "dash-kanban-theme-preview-strip" });
    this.themes.forEach((theme) => {
      const button = strip.createEl("button", {
        cls: `dash-kanban-theme-preview${this.theme === theme.themeId ? " is-selected" : ""}`,
        attr: {
          "aria-pressed": this.theme === theme.themeId ? "true" : "false"
        }
      });
      button.type = "button";
      button.title = theme.description ? `${theme.name}: ${theme.description}` : theme.name;
      button.style.setProperty("--dash-kanban-theme-preview-board", theme.preview.board);
      button.style.setProperty("--dash-kanban-theme-preview-primary", theme.preview.primary);
      button.style.setProperty("--dash-kanban-theme-preview-secondary", theme.preview.secondary);
      button.style.setProperty("--dash-kanban-theme-preview-surface", theme.preview.surface);
      const swatch = button.createDiv({ cls: "dash-kanban-theme-preview-swatch" });
      swatch.createSpan({ cls: "dash-kanban-theme-preview-chip is-primary" });
      swatch.createSpan({ cls: "dash-kanban-theme-preview-chip is-secondary" });
      swatch.createSpan({ cls: "dash-kanban-theme-preview-chip is-surface" });
      const copy = button.createDiv({ cls: "dash-kanban-theme-preview-copy" });
      copy.createEl("strong", { text: theme.name });
      copy.createEl("span", { text: theme.description || "Custom Kanban theme" });
      button.addEventListener("click", () => {
        this.theme = theme.themeId;
        this.onOpen();
      });
    });
  }

  onOpen(): void {
    this.setTitle("DASH Kanban Board Settings");
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dash-kanban-board-settings-modal");

    new Setting(contentEl)
      .setName("Project")
      .setDesc("Choose which project board you want to configure.")
      .addDropdown((dropdown) => {
        this.projects.forEach((project) => dropdown.addOption(project.name, project.name));
        dropdown.setValue(this.selectedProjectName);
        dropdown.onChange((value) => {
          this.loadProjectDraft(value);
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Template")
      .setDesc("Pick a starting template. Changing it resets the current lane draft to that template.")
      .addDropdown((dropdown) => {
        this.templates.forEach((template) => dropdown.addOption(template.templateId, template.name));
        if (this.isCurrentTemplateCustom()) {
          dropdown.addOption("custom", "Custom");
          dropdown.setValue("custom");
        } else {
          dropdown.setValue(this.selectedTemplateId);
        }
        dropdown.onChange((value) => {
          if (value === "custom") {
            return;
          }
          this.selectedTemplateId = value;
          const template = this.getSelectedTemplate();
          this.laneDefinitions = this.cloneLaneDefinitions(template?.laneDefinitions ?? []);
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Show in All Projects")
      .setDesc("Hide project boards you do not want in the multi-project workspace.")
      .addToggle((toggle) => {
        toggle.setValue(this.showInHub);
        toggle.onChange((value) => {
          this.showInHub = value;
        });
      });

    new Setting(contentEl)
      .setName("Board height")
      .setDesc("Sets the lane viewport height before cards begin scrolling inside each lane. The board corner drag handle uses the same height.")
      .addText((text) => {
        text.setValue(`${this.boardHeight}`).onChange((value) => {
          this.boardHeight = Math.min(Math.max(Math.round(Number(value || 420)), 260), 900);
        });
        text.inputEl.type = "number";
        text.inputEl.min = "260";
        text.inputEl.max = "900";
        text.inputEl.step = "10";
      });

    new Setting(contentEl)
      .setName("Collapsed in All Projects")
      .setDesc("Use this as the default collapsed state when the board appears in the multi-project workspace.")
      .addToggle((toggle) => {
        toggle.setValue(this.collapsedInHub);
        toggle.onChange((value) => {
          this.collapsedInHub = value;
        });
      });

    new Setting(contentEl)
      .setName("Board theme")
      .setDesc("Applies a project-specific board palette without changing the rest of DASH.")
      .addDropdown((dropdown) => {
        this.themes.forEach((theme) => dropdown.addOption(theme.themeId, theme.name));
        dropdown.setValue(this.theme);
        dropdown.onChange((value) => {
          this.theme = value as DashboardKanbanTheme;
        });
      });

    const themePreviewSection = contentEl.createDiv({ cls: "dash-kanban-settings-section dash-kanban-settings-section--preview" });
    this.renderThemePreviewStrip(themePreviewSection);

    new Setting(contentEl)
      .setName("Show swimlane categories")
      .setDesc("Turn category bands on only for boards that actually need grouped swimlanes.")
      .addToggle((toggle) => {
        toggle.setValue(this.showLaneCategories);
        toggle.onChange((value) => {
          this.showLaneCategories = value;
        });
      });

    new Setting(contentEl)
      .setName("Sticky orientation headers")
      .setDesc("Keep matrix stage headers pinned near the top and swimlane row headers pinned while you scroll larger boards.")
      .addToggle((toggle) => {
        toggle.setValue(this.stickyHeaders);
        toggle.onChange((value) => {
          this.stickyHeaders = value;
        });
      });

    const template = this.getSelectedTemplate();
    if (template?.description) {
      contentEl.createEl("p", { cls: "setting-item-description", text: template.description });
    }

    const lanesSection = contentEl.createEl("details", { cls: "dash-kanban-settings-section dash-kanban-settings-collapsible" });
    lanesSection.open = this.laneOverridesExpanded;

    const lanesSummary = lanesSection.createEl("summary", { cls: "dash-kanban-settings-collapsible-summary" });
    const lanesSummaryCopy = lanesSummary.createDiv({ cls: "dash-kanban-settings-collapsible-copy" });
    lanesSummaryCopy.createEl("strong", { text: "Lane Overrides" });
    lanesSummaryCopy.createEl("span", {
      text: `${this.laneDefinitions.length} lane${this.laneDefinitions.length === 1 ? "" : "s"}${this.isCurrentTemplateCustom() ? " · custom layout" : " · template layout"}`
    });
    const lanesHint = lanesSummary.createEl("span", {
      cls: "dash-kanban-settings-collapsible-hint",
      text: this.laneOverridesExpanded ? "Collapse" : "Expand"
    });
    lanesSection.addEventListener("toggle", () => {
      this.laneOverridesExpanded = lanesSection.open;
      lanesHint.setText(lanesSection.open ? "Collapse" : "Expand");
    });

    const lanesBody = lanesSection.createDiv({ cls: "dash-kanban-settings-collapsible-body" });
    lanesBody.createEl("p", {
      cls: "setting-item-description",
      text: "Edit labels, helper text, mapped Master Task Hub sections, and whether a lane counts as done. Blank mapped sections create custom lanes."
    });

    this.laneDefinitions.forEach((lane, index) => {
      const row = lanesBody.createDiv({ cls: "dash-kanban-settings-lane" });
      row.createEl("h4", { text: `Lane ${index + 1}` });

      new Setting(row)
        .setName("Label")
        .addText((text) => {
          text.setValue(lane.label).onChange((value) => {
            this.laneDefinitions[index].label = value;
          });
        });

      new Setting(row)
        .setName("Helper text")
        .addText((text) => {
          text.setValue(lane.helperText).onChange((value) => {
            this.laneDefinitions[index].helperText = value;
          });
        });

      new Setting(row)
        .setName("Category band")
        .setDesc("Lanes with the same category render together under one colored board band.")
        .addText((text) => {
          text.setValue(lane.categoryLabel).onChange((value) => {
            this.laneDefinitions[index].categoryLabel = value;
          });
        });

      new Setting(row)
        .setName("Category color")
        .setDesc("Hex color for the category band, such as #d63131 or #3041d7.")
        .addText((text) => {
          text.setValue(lane.categoryColor).onChange((value) => {
            this.laneDefinitions[index].categoryColor = value;
          });
        });

      new Setting(row)
        .setName("Category tag")
        .setDesc("Optional hashtag used to assign tasks into this swimlane band, such as bug, feature, or expedite.")
        .addText((text) => {
          text.setValue(lane.categoryTag).onChange((value) => {
            this.laneDefinitions[index].categoryTag = value.replace(/^#/, "");
          });
        });

      new Setting(row)
        .setName("Mapped sections")
        .setDesc("Comma-separated Master Task Hub section names, such as Now, Next, Waiting.")
        .addText((text) => {
          text.setValue(lane.mappedSections.join(", ")).onChange((value) => {
            this.laneDefinitions[index].mappedSections = value.split(",").map((item) => item.trim()).filter(Boolean);
          });
        });

      new Setting(row)
        .setName("Done lane")
        .setDesc("Dropping a card here completes and archives it through the Master Task Hub flow.")
        .addToggle((toggle) => {
          toggle.setValue(lane.done);
          toggle.onChange((value) => {
            this.laneDefinitions[index].done = value;
          });
        });

      const actions = row.createDiv({ cls: "dash-kanban-settings-lane-actions" });
      const upButton = actions.createEl("button", { text: "Up" });
      upButton.addEventListener("click", () => this.moveLane(index, index - 1));
      const downButton = actions.createEl("button", { text: "Down" });
      downButton.addEventListener("click", () => this.moveLane(index, index + 1));
      const removeButton = actions.createEl("button", { text: "Remove" });
      removeButton.addEventListener("click", () => {
        this.laneDefinitions = this.laneDefinitions.filter((_, laneIndex) => laneIndex !== index);
        this.onOpen();
      });
    });

    const laneButtons = lanesBody.createDiv({ cls: "dash-kanban-settings-lane-actions is-footer" });
    const addLaneButton = laneButtons.createEl("button", { cls: "mod-cta", text: "Add lane" });
    addLaneButton.addEventListener("click", () => {
      this.laneDefinitions = [
        ...this.laneDefinitions,
        {
          laneKey: `lane-${this.laneDefinitions.length + 1}`,
          label: "New Lane",
          helperText: "",
          columnKey: `lane-${this.laneDefinitions.length + 1}`,
          categoryKey: "",
          categoryLabel: "Workflow",
          categorySubtitle: "",
          categoryColor: "",
          categoryTag: "",
          ruleType: "custom",
          mappedSections: [],
          done: false
        }
      ];
      this.onOpen();
    });
    const resetButton = laneButtons.createEl("button", { text: "Reset to template" });
    resetButton.addEventListener("click", () => {
      const currentTemplate = this.getSelectedTemplate();
      this.laneDefinitions = this.cloneLaneDefinitions(currentTemplate?.laneDefinitions ?? []);
      this.onOpen();
    });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Save board settings").setCta().onClick(async () => {
          const laneDefinitions = this.normalizeDraftLanes();
          if (laneDefinitions.length === 0) {
            new Notice("At least one lane is required.");
            return;
          }

          await this.plugin.saveKanbanBoardConfiguration({
            projectName: this.selectedProjectName,
            templateId: this.selectedTemplateId,
            showInHub: this.showInHub,
            laneDefinitions,
            boardHeight: this.boardHeight,
            collapsedInHub: this.collapsedInHub,
            showLaneCategories: this.showLaneCategories,
            stickyHeaders: this.stickyHeaders,
            theme: this.theme
          });
          new Notice("Kanban board settings saved.");
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

export class KanbanTaskEditModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private projects: TodoProjectSummary[];
  private selectedProjectName: string;
  private selectedTaskId: string;
  private selectedLane: string;
  private taskText: string;

  constructor(app: App, plugin: DailyDashboardPlugin, projects: TodoProjectSummary[], initial?: { projectName?: string; taskId?: string }) {
    super(app);
    this.plugin = plugin;
    this.projects = projects.filter((project) => this.getEditableTasks(project).length > 0);
    this.selectedProjectName = this.projects.find((project) => project.name === initial?.projectName)?.name ?? this.projects[0]?.name ?? "";
    this.selectedTaskId = initial?.taskId ?? "";
    this.selectedLane = this.plugin.getKanbanLaneOptions(this.selectedProjectName).find((option) => !option.done && !option.unmapped)?.laneKey ?? "now";
    this.taskText = "";
    this.syncSelectionFromTask();
  }

  private isSupportedKanbanImageFile(file: File | null | undefined): file is File {
    if (!file) {
      return false;
    }

    const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
    return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
  }

  private async attachPastedImages(event: ClipboardEvent): Promise<void> {
    const files = Array.from(event.clipboardData?.items ?? [])
      .map((item) => item.kind === "file" ? item.getAsFile() : null)
      .filter((file): file is File => this.isSupportedKanbanImageFile(file));
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    let attachedCount = 0;
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const attached = await this.plugin.uploadKanbanTaskPhoto(this.selectedProjectName, this.selectedTaskId, file.name, bytes);
      if (attached) {
        attachedCount += 1;
      }
    }

    if (attachedCount > 0) {
      new Notice(`Attached ${attachedCount} image${attachedCount === 1 ? "" : "s"} to the card.`);
    }
  }

  private getLaneOptions(): KanbanLaneOption[] {
    return this.plugin.getKanbanLaneOptions(this.selectedProjectName).filter((option) => !option.done);
  }

  private getEditableTasks(project: TodoProjectSummary): TodoTaskSummary[] {
    return [
      ...project.nowTaskDetails,
      ...project.nextTaskDetails,
      ...project.laterTaskDetails,
      ...project.waitingTaskDetails,
      ...project.parkingLotTaskDetails
    ].filter((task) => task.taskId.trim().length > 0);
  }

  private getSelectedProject(): TodoProjectSummary | null {
    return this.projects.find((project) => project.name === this.selectedProjectName) ?? null;
  }

  private getSelectedTask(): TodoTaskSummary | null {
    return this.getEditableTasks(this.getSelectedProject() ?? { } as TodoProjectSummary)
      .find((task) => task.taskId === this.selectedTaskId) ?? null;
  }

  private findLaneOptionForTask(task: TodoTaskSummary): KanbanLaneOption | null {
    const laneOptions = this.getLaneOptions();
    const taskTags = Array.from(task.rawText.matchAll(/(?:^|\s)#([A-Za-z0-9/_-]+)/g)).map((match) => match[1].trim().toLowerCase());

    return laneOptions.find((option) => {
      const matchesSection = option.targetSection.toLowerCase() === task.section.toLowerCase()
        || option.label.toLowerCase() === (task.kanbanLane || task.section).toLowerCase();
      if (!matchesSection) {
        return false;
      }

      const peerTaggedLanes = laneOptions.filter((candidate) => candidate.targetSection.toLowerCase() === option.targetSection.toLowerCase() && candidate.categoryTag.trim().length > 0);
      if (!option.categoryTag.trim()) {
        return !peerTaggedLanes.some((candidate) => taskTags.includes(candidate.categoryTag.trim().toLowerCase()));
      }

      if (taskTags.includes(option.categoryTag.trim().toLowerCase())) {
        return true;
      }

      const taskHasPeerTag = peerTaggedLanes.some((candidate) => taskTags.includes(candidate.categoryTag.trim().toLowerCase()));
      return !taskHasPeerTag && peerTaggedLanes[0]?.laneKey === option.laneKey;
    }) ?? null;
  }

  private syncSelectionFromTask(): void {
    const project = this.getSelectedProject();
    const tasks = project ? this.getEditableTasks(project) : [];
    if (tasks.length === 0) {
      this.selectedTaskId = "";
      this.taskText = "";
      this.selectedLane = "now";
      return;
    }

    const selectedTask = tasks.find((task) => task.taskId === this.selectedTaskId) ?? tasks[0];
    this.selectedTaskId = selectedTask.taskId;
    this.taskText = selectedTask.text;
    const laneOptions = this.getLaneOptions();
    const matchingLane = this.findLaneOptionForTask(selectedTask);
    this.selectedLane = matchingLane?.laneKey || laneOptions[0]?.laneKey || "now";
    if (!laneOptions.some((option) => option.laneKey === this.selectedLane)) {
      this.selectedLane = laneOptions[0]?.laneKey || "now";
    }
  }

  private formatTaskMeta(task: TodoTaskSummary): string {
    return [
      task.section,
      task.isOverdue ? "Overdue" : task.isDueSoon ? "Due soon" : "",
      task.dueDate ? `Due ${task.dueDate}` : "",
      task.blockedReason ? `Blocked: ${task.blockedReason}` : "",
      task.unblockDate ? `Unblock ${task.unblockDate}` : "",
      task.effort ? `Effort ${task.effort}` : "",
      task.energy ? `Energy ${task.energy}` : "",
      task.executionContext ? `Context ${task.executionContext}` : "",
      task.trigger ? `Trigger ${task.trigger}` : "",
      task.minimumStep ? `Minimum step: ${task.minimumStep}` : ""
    ].filter((value) => value.length > 0).join(" • ");
  }

  onOpen(): void {
    this.setTitle("Edit Kanban Task");
    const { contentEl } = this;
    contentEl.empty();

    if (this.projects.length === 0) {
      contentEl.createEl("p", { text: "No editable Kanban tasks were found in the current Master Task Hub." });
      return;
    }

    const selectedProject = this.getSelectedProject();
    const tasks = selectedProject ? this.getEditableTasks(selectedProject) : [];
    const selectedTask = tasks.find((task) => task.taskId === this.selectedTaskId) ?? tasks[0] ?? null;
    if (!selectedTask) {
      contentEl.createEl("p", { text: "No editable Kanban tasks were found for the selected project." });
      return;
    }

    new Setting(contentEl)
      .setName("Project")
      .setDesc("Switch projects to edit a different board task.")
      .addDropdown((dropdown) => {
        this.projects.forEach((project) => dropdown.addOption(project.name, project.name));
        dropdown.setValue(this.selectedProjectName);
        dropdown.onChange((value) => {
          this.selectedProjectName = value;
          this.syncSelectionFromTask();
          this.onOpen();
        });
      });

    new Setting(contentEl)
      .setName("Task")
      .setDesc("Pick the board item you want to rewrite or move.")
      .addDropdown((dropdown) => {
        tasks.forEach((task) => dropdown.addOption(task.taskId, `${task.kanbanLane || task.section}: ${task.text.slice(0, 80)}`));
        dropdown.setValue(this.selectedTaskId);
        dropdown.onChange((value) => {
          this.selectedTaskId = value;
          this.syncSelectionFromTask();
          this.onOpen();
        });
      });

    contentEl.createEl("p", { cls: "daily-dashboard-row-meta", text: this.formatTaskMeta(selectedTask) || "No extra task metadata recorded." });

    new Setting(contentEl)
      .setName("Task text")
      .setDesc("This updates the task label while preserving existing task metadata annotations. Paste an image here to attach it to the card.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Refine the task wording")
          .setValue(this.taskText)
          .onChange((value) => {
            this.taskText = value;
          });
        textArea.inputEl.rows = 4;
        textArea.inputEl.addEventListener("paste", (event) => {
          void this.attachPastedImages(event);
        });
        window.setTimeout(() => textArea.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Lane")
      .setDesc("Moving out of Waiting strips blocking annotations; moving into Waiting preserves any existing ones.")
      .addDropdown((dropdown) => {
        const laneOptions = this.getLaneOptions();
        laneOptions.forEach((lane) => dropdown.addOption(lane.laneKey, lane.categoryLabel ? `${lane.categoryLabel} • ${lane.label}` : lane.helperText ? `${lane.label} (${lane.helperText})` : lane.label));
        if (!laneOptions.some((lane) => lane.laneKey === this.selectedLane)) {
          this.selectedLane = laneOptions[0]?.laneKey || "now";
        }
        dropdown.setValue(this.selectedLane);
        dropdown.onChange((value) => {
          this.selectedLane = value;
        });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Save task").setCta().onClick(async () => {
          const saved = await this.plugin.editKanbanTask(this.selectedProjectName, this.selectedTaskId, this.taskText, this.selectedLane);
          if (!saved) {
            return;
          }

          new Notice("Kanban task updated.");
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

export class AskResearchQuestionModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private question = "";
  private additionalContext = "";
  private generateBrief = true;
  private generateAnswer = true;
  private groundingMode: ResearchGroundingMode = "vault-plus-web";

  constructor(app: App, plugin: DailyDashboardPlugin, initialQuestion = "") {
    super(app);
    this.plugin = plugin;
    this.question = initialQuestion;
  }

  onOpen(): void {
    this.setTitle("Ask Research Question And Write Wiki Notes");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Question")
      .setDesc("Ask something you want to preserve as a reusable knowledge-base brief, teaching note, or both.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("What does full body tightness and mild panic after a deep yawn usually mean?")
          .setValue(this.question)
          .onChange((value) => {
            this.question = value;
          });
        textArea.inputEl.rows = 5;
        window.setTimeout(() => textArea.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Context and constraints")
      .setDesc("Optional: audience, experience level, app/framework, examples to cover, or any boundary for the answer.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Explain it plainly, include likely mechanisms, call out uncertainty, and note when real medical advice is needed.")
          .setValue(this.additionalContext)
          .onChange((value) => {
            this.additionalContext = value;
          });
        textArea.inputEl.rows = 5;
      });

    new Setting(contentEl)
      .setName("Generate research brief")
      .setDesc("Short summary note for quick review later.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.generateBrief)
          .onChange((value) => {
            this.generateBrief = value;
          });
      });

    new Setting(contentEl)
      .setName("Generate detailed answer note")
      .setDesc("Longer teaching-oriented note with mechanisms, caveats, and wiki hooks.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.generateAnswer)
          .onChange((value) => {
            this.generateAnswer = value;
          });
      });

    new Setting(contentEl)
      .setName("Grounding mode")
      .setDesc(`Controls whether research questions use your full indexed vault context only, vault context plus model knowledge, or vault context plus live web search. Research model: ${this.plugin.getSettings().researchAiModel}`)
      .addDropdown((dropdown) => {
        dropdown.addOption("vault-only", "Vault only");
        dropdown.addOption("vault-plus-model", "Vault + model knowledge");
        dropdown.addOption("vault-plus-web", "Vault + web search");
        dropdown.setValue(this.groundingMode);
        dropdown.onChange((value) => {
          this.groundingMode = value === "vault-only" || value === "vault-plus-model" ? value : "vault-plus-web";
        });
      });

    contentEl.createEl("p", {
      cls: "daily-dashboard-row-meta",
      text: "This workflow can now run in vault-only, vault-plus-model, or vault-plus-web mode. Use the research model setting if you want a stronger model than the default dashboard AI model."
    });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText("Write wiki notes").setCta().onClick(async () => {
          if (!this.question.trim()) {
            new Notice("Enter a research question first.");
            return;
          }

          if (!this.generateBrief && !this.generateAnswer) {
            new Notice("Enable at least one output before running the workflow.");
            return;
          }

          await this.plugin.askResearchQuestionAndWriteWikiNotes({
            question: this.question,
            additionalContext: this.additionalContext,
            generateBrief: this.generateBrief,
            generateAnswer: this.generateAnswer,
            groundingMode: this.groundingMode
          });
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

export class FinanceSubscriptionModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private categories: BudgetCategory[];
  private state: FinanceSubscriptionEntry;
  private forcedKind: "recurring" | "one-time" | null;

  constructor(
    app: App,
    plugin: DailyDashboardPlugin,
    categories: BudgetCategory[],
    existing?: FinanceSubscriptionEntry,
    forcedKind: "recurring" | "one-time" | null = null
  ) {
    super(app);
    this.plugin = plugin;
    this.categories = categories;
    this.forcedKind = forcedKind;
    this.state = existing
      ? { ...existing }
      : {
          id: "",
          name: "",
          cost: 0,
          currency: "USD",
          intervalMonths: forcedKind === "one-time" ? 1 : 1,
          paymentMethod: "",
          startedOn: "",
          renewalDate: "",
          status: forcedKind === "one-time" ? "active" : "active",
          kind: forcedKind ?? "recurring",
          categoryId: categories[0]?.id ?? "other",
          notes: "",
          cancelUrl: ""
        };
  }

  onOpen(): void {
    this.setTitle(this.state.id ? "Edit Subscription" : "Add Subscription");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Name")
      .setDesc("Service or charge name shown in the subscriptions tracker.")
      .addText((text) => {
        text
          .setPlaceholder("Spotify Premium")
          .setValue(this.state.name)
          .onChange((value) => {
            this.state.name = value;
          });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Type")
      .setDesc("Recurring subscriptions affect monthly recurring totals. One-time items stay visible without distorting recurring cost math.")
      .addDropdown((dropdown) => {
        dropdown.addOption("recurring", "Recurring");
        dropdown.addOption("one-time", "One-time");
        dropdown.setValue(this.state.kind);
        dropdown.setDisabled(Boolean(this.forcedKind));
        dropdown.onChange((value) => {
          this.state.kind = value === "one-time" ? "one-time" : "recurring";
        });
      });

    new Setting(contentEl)
      .setName("Status")
      .setDesc("Use trial, paused, canceled, or archived so the tracker can separate live pressure from historical clutter.")
      .addDropdown((dropdown) => {
        ["active", "trial", "paused", "canceled", "archived"].forEach((status) => dropdown.addOption(status, status.charAt(0).toUpperCase() + status.slice(1)));
        dropdown.setValue(this.state.status);
        dropdown.onChange((value) => {
          this.state.status = value === "trial" || value === "paused" || value === "canceled" || value === "archived" ? value : "active";
        });
      });

    new Setting(contentEl)
      .setName("Amount")
      .setDesc("The raw charge amount before monthly normalization.")
      .addText((text) => {
        text
          .setPlaceholder("0")
          .setValue(this.state.cost > 0 ? `${this.state.cost}` : "")
          .onChange((value) => {
            this.state.cost = Math.max(Number(value.trim() || 0), 0);
          });
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.step = "0.01";
      })
      .addText((text) => {
        text
          .setPlaceholder("USD")
          .setValue(this.state.currency)
          .onChange((value) => {
            this.state.currency = (value.trim() || "USD").toUpperCase();
          });
      });

    new Setting(contentEl)
      .setName("Billing interval in months")
      .setDesc("Use 1 for monthly, 6 for every six months, and 12 for yearly.")
      .addText((text) => {
        text
          .setPlaceholder("1")
          .setValue(`${this.state.intervalMonths}`)
          .onChange((value) => {
            this.state.intervalMonths = Math.max(1, Math.round(Number(value.trim() || 1)));
          });
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "120";
      });

    new Setting(contentEl)
      .setName("Payment method")
      .setDesc("Used by the overview to show payment-method concentration.")
      .addText((text) => {
        text
          .setPlaceholder("Card, PayPal, Apple Pay, Crypto")
          .setValue(this.state.paymentMethod)
          .onChange((value) => {
            this.state.paymentMethod = value;
          });
      });

    new Setting(contentEl)
      .setName("Category")
      .setDesc("Used to compare recurring commitments against your simple monthly category targets.")
      .addDropdown((dropdown) => {
        this.categories.forEach((category) => dropdown.addOption(category.id, category.label));
        dropdown.setValue(this.state.categoryId);
        dropdown.onChange((value) => {
          this.state.categoryId = value;
        });
      });

    new Setting(contentEl)
      .setName("Started on")
      .setDesc("Optional start date for reference.")
      .addText((text) => {
        text
          .setValue(this.state.startedOn)
          .onChange((value) => {
            this.state.startedOn = value.trim();
          });
        text.inputEl.type = "date";
      });

    new Setting(contentEl)
      .setName("Next renewal")
      .setDesc("Optional. Used for due-soon surfacing in the overview and subscriptions tab.")
      .addText((text) => {
        text
          .setValue(this.state.renewalDate)
          .onChange((value) => {
            this.state.renewalDate = value.trim();
          });
        text.inputEl.type = "date";
      });

    new Setting(contentEl)
      .setName("Cancel URL")
      .setDesc("Optional link or path to the cancellation page or account settings screen.")
      .addText((text) => {
        text
          .setPlaceholder("https://...")
          .setValue(this.state.cancelUrl)
          .onChange((value) => {
            this.state.cancelUrl = value.trim();
          });
      });

    new Setting(contentEl)
      .setName("Notes")
      .setDesc("Any friction, annual-renewal warning, trial context, or cancellation note worth keeping visible.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("Annual renewal in February. Cancel from account settings, not billing page.")
          .setValue(this.state.notes)
          .onChange((value) => {
            this.state.notes = value;
          });
        textArea.inputEl.rows = 4;
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText(this.state.id ? "Save subscription" : "Add subscription").setCta().onClick(async () => {
          if (!this.state.name.trim()) {
            new Notice("Subscription name is required.");
            return;
          }

          await this.plugin.saveFinanceSubscription({
            ...this.state,
            kind: this.forcedKind ?? this.state.kind,
            intervalMonths: Math.max(1, this.state.intervalMonths)
          });
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
    containerEl.createEl("h2", { text: "Obsidian DASH - Daily Action & System Hub" });

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

    new Setting(containerEl)
      .setName("Generated document tags")
      .setDesc("Comma or line-separated tags added to plugin-created markdown files so logs, reports, AI notes, and exports are easier to filter and graph.")
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder("daily-dashboard\ndaily-dashboard/generated")
          .setValue(settings.generatedDocumentTags)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              generatedDocumentTags: value
            });
          });

        textArea.inputEl.rows = 3;
        textArea.inputEl.cols = 36;
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

    containerEl.createEl("h3", { text: "Budgeting" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Budgeting is still experimental in the public beta. Keep it off unless you want to test the current finance workflow."
    });

    new Setting(containerEl)
      .setName("Enable budgeting section (Experimental)")
      .setDesc("Show the budgeting card in the dashboard with overview, subscriptions, and budget tabs. This area is still beta-state and may keep changing.")
      .addToggle((toggle) => {
        toggle.setValue(settings.budgetingEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            budgetingEnabled: value
          });
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Enable subscriptions tracker")
      .setDesc("Keep the subscriptions tab visible inside budgeting. This can stay on even if you only want recurring-charge tracking.")
      .addToggle((toggle) => {
        toggle.setValue(settings.subscriptionsTrackerEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            subscriptionsTrackerEnabled: value
          });
          this.display();
        });
      });

    containerEl.createEl("h3", { text: "Kanban" });

    new Setting(containerEl)
      .setName("Enable Kanban foundations")
      .setDesc("Keep the Kanban Hub path and related note-generation workflow visible in settings while Kanban remains an optional companion to the Master Task Hub.")
      .addToggle((toggle) => {
        toggle.setValue(settings.kanbanEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            kanbanEnabled: value
          });
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Kanban Hub path")
      .setDesc("Generated markdown board note that mirrors the Master Task Hub into per-project Kanban lanes.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.kanbanHubPath)
          .setValue(settings.kanbanHubPath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              kanbanHubPath: value.trim() || DEFAULT_SETTINGS.kanbanHubPath
            });
          });
      });

    new Setting(containerEl)
      .setName("Kanban board notes folder")
      .setDesc("Optional generated per-project board notes live here when you refresh board-note artifacts.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.kanbanBoardNotesFolder)
          .setValue(settings.kanbanBoardNotesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              kanbanBoardNotesFolder: value.trim() || DEFAULT_SETTINGS.kanbanBoardNotesFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Obsidian Kanban compatibility mode")
      .setDesc("Write generated project board notes with `kanban-plugin: board` frontmatter so the Obsidian Kanban plugin can open them as boards.")
      .addToggle((toggle) => {
        toggle.setValue(settings.kanbanPluginCompatibilityMode).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            kanbanPluginCompatibilityMode: value
          });
        });
      });

    new Setting(containerEl)
      .setName("Kanban auto-sync listeners")
      .setDesc("Watch generated Kanban notes for manual edits and sync them back into the Master Task Hub with repair notices when task ids drift.")
      .addToggle((toggle) => {
        toggle.setValue(settings.kanbanAutoSyncEnabled).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            kanbanAutoSyncEnabled: value
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

    new Setting(containerEl)
      .setName("Notification sound")
      .setDesc("Play a short sound when the dashboard raises a new reminder or logical-day notice. Turn it off here if you only want visual notices.")
      .addDropdown((dropdown) => {
        dropdown.addOption("off", "Off");
        dropdown.addOption("chime", "Chime");
        dropdown.addOption("ping", "Ping");
        dropdown.addOption("alert", "Alert");
        dropdown.setValue(settings.notificationSound);
        dropdown.onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            notificationSound: value === "off" || value === "ping" || value === "alert" ? value : "chime"
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
      .setName("Research AI model")
      .setDesc("Used by direct research-question wiki workflows. Recommended default: gpt-4.1 or another stronger model than the dashboard coaching model.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.researchAiModel)
          .setValue(settings.researchAiModel)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              researchAiModel: value.trim() || DEFAULT_SETTINGS.researchAiModel
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
      .setName("Research web search API URL")
      .setDesc("Used when the research grounding mode includes web search. Defaults to the OpenAI Responses API.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.researchResponsesApiUrl)
          .setValue(settings.researchResponsesApiUrl)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              researchResponsesApiUrl: value.trim() || DEFAULT_SETTINGS.researchResponsesApiUrl
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
      .setName("Knowledge base raw folder")
      .setDesc("Clipped articles, research captures, and other raw material are stored here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseRawFolder)
          .setValue(settings.knowledgeBaseRawFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseRawFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseRawFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Knowledge base source summaries folder")
      .setDesc("Compiled per-source notes live here so raw captures and structured summaries stay separate.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseSourcesFolder)
          .setValue(settings.knowledgeBaseSourcesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseSourcesFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseSourcesFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Knowledge base concept folder")
      .setDesc("Cross-source concept notes and durable idea pages belong here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseConceptsFolder)
          .setValue(settings.knowledgeBaseConceptsFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseConceptsFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseConceptsFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Knowledge base index folder")
      .setDesc("Topic maps, open-question lists, and other navigation notes belong here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseIndexesFolder)
          .setValue(settings.knowledgeBaseIndexesFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseIndexesFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseIndexesFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Knowledge base outputs folder")
      .setDesc("Generated research answers, syntheses, and maintenance notes are written here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseOutputsFolder)
          .setValue(settings.knowledgeBaseOutputsFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseOutputsFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseOutputsFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Knowledge base assets folder")
      .setDesc("Non-markdown files referenced by the research wiki should be kept here.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.knowledgeBaseAssetsFolder)
          .setValue(settings.knowledgeBaseAssetsFolder)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              knowledgeBaseAssetsFolder: value.trim() || DEFAULT_SETTINGS.knowledgeBaseAssetsFolder
            });
          });
      });

    new Setting(containerEl)
      .setName("Basic information note path")
      .setDesc("Reusable personal context note for AI. The command palette can create or open this template, and AI requests can include it automatically.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.basicInfoNotePath)
          .setValue(settings.basicInfoNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              basicInfoNotePath: value.trim() || DEFAULT_SETTINGS.basicInfoNotePath
            });
          });
      });

    new Setting(containerEl)
      .setName("Include basic information in AI")
      .setDesc("Inject the Basic Information note into AI context when it exists, so long-term facts do not need to be repeated in each prompt.")
      .addToggle((toggle) => {
        toggle.setValue(settings.includeBasicInfoInAi).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            includeBasicInfoInAi: value
          });
        });
      });

    new Setting(containerEl)
      .setName("AI Guardrails note path")
      .setDesc("Durable instructions for how AI should behave inside your system.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.aiGuardrailsNotePath)
          .setValue(settings.aiGuardrailsNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              aiGuardrailsNotePath: value.trim() || DEFAULT_SETTINGS.aiGuardrailsNotePath
            });
          });
      });

    new Setting(containerEl)
      .setName("Include AI Guardrails in AI")
      .setDesc("Automatically inject the AI Guardrails note so workflows inherit your preferred tone and operating rules.")
      .addToggle((toggle) => {
        toggle.setValue(settings.includeAiGuardrailsInAi).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            includeAiGuardrailsInAi: value
          });
        });
      });

    new Setting(containerEl)
      .setName("Current Season note path")
      .setDesc("Temporary priorities, constraints, and active review questions for the present season.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.currentSeasonNotePath)
          .setValue(settings.currentSeasonNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              currentSeasonNotePath: value.trim() || DEFAULT_SETTINGS.currentSeasonNotePath
            });
          });
      });

    new Setting(containerEl)
      .setName("Include Current Season in AI")
      .setDesc("Automatically inject the Current Season note so AI stays aligned with the current phase, not just historical context.")
      .addToggle((toggle) => {
        toggle.setValue(settings.includeCurrentSeasonInAi).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            includeCurrentSeasonInAi: value
          });
        });
      });

    new Setting(containerEl)
      .setName("People / External Dependencies note path")
      .setDesc("Optional support note for outside blockers, dependency owners, and durable coordination context.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.peopleDependenciesNotePath)
          .setValue(settings.peopleDependenciesNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              peopleDependenciesNotePath: value.trim() || DEFAULT_SETTINGS.peopleDependenciesNotePath
            });
          });
      });

    new Setting(containerEl)
      .setName("Include People / External Dependencies in AI")
      .setDesc("Automatically inject this note when outside coordination or vendor blockers are common enough to affect planning quality.")
      .addToggle((toggle) => {
        toggle.setValue(settings.includePeopleDependenciesInAi).onChange(async (value) => {
          await this.plugin.updateSettings({
            ...this.plugin.getSettings(),
            includePeopleDependenciesInAi: value
          });
        });
      });

    new Setting(containerEl)
      .setName("Decision Journal note path")
      .setDesc("Reference note for important decisions and revisit points.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.decisionJournalNotePath)
          .setValue(settings.decisionJournalNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              decisionJournalNotePath: value.trim() || DEFAULT_SETTINGS.decisionJournalNotePath
            });
          });
      });

    new Setting(containerEl)
      .setName("System Map note path")
      .setDesc("Reference note that maps where action, context, and history live.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.systemMapNotePath)
          .setValue(settings.systemMapNotePath)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.getSettings(),
              systemMapNotePath: value.trim() || DEFAULT_SETTINGS.systemMapNotePath
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
      .setDesc("One routine per line using Label|HH:MM|HH:MM. These drive notifications and compact routine cues in Session Deck when their time window is due or coming up.")
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
  { key: "top-3-for-today", title: "Action Queue", order: 2, hidden: false, pinned: false, width: "default" },
  { key: "state-and-friction", title: "Vitals", order: 3, hidden: false, pinned: false, width: "default" },
  { key: "gamification-center", title: "Gamification Center", order: 4, hidden: false, pinned: false, width: "default" },
  { key: "habits", title: "Habits", order: 5, hidden: false, pinned: false, width: "default" },
  { key: "food-log", title: "Consumables", order: 6, hidden: false, pinned: false, width: "default" },
  { key: "exercise-weight", title: "Exercise & Weight", order: 7, hidden: false, pinned: false, width: "default" },
  { key: "sleep-and-notes", title: "Sleep And Notes", order: 8, hidden: false, pinned: false, width: "default" },
  { key: "timeline-search", title: "Timeline Search", order: 9, hidden: false, pinned: false, width: "default" },
  { key: "budgeting", title: "Budgeting", order: 10, hidden: false, pinned: false, width: "default" },
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
    if (options.secondaryTag) {
      createSemanticChip(controls, options.secondaryTag, options.secondaryTagTone ?? "alert");
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
  button.addEventListener("mousedown", (event) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      event.preventDefault();
    }
  });
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

type FocusCapturePayload = {
  text: string;
  projectName?: string;
  notes?: string;
  estimateMinutes?: number | null;
};

type FocusCaptureModalOptions = {
  mode: "capture" | "edit";
  availableProjectNames?: string[];
  initialText?: string;
  initialProjectName?: string;
  initialNotes?: string;
  initialEstimateMinutes?: number | null;
  submitLabel?: string;
  onSubmit: (payload: FocusCapturePayload) => Promise<void>;
};

export class FocusCaptureModal extends Modal {
  private options: FocusCaptureModalOptions;
  private textValue: string;
  private projectNameValue: string;
  private notesValue: string;
  private estimateValue: string;

  constructor(app: App, options: FocusCaptureModalOptions) {
    super(app);
    this.options = options;
    this.textValue = options.initialText ?? "";
    this.projectNameValue = options.initialProjectName ?? "";
    this.notesValue = options.initialNotes ?? "";
    this.estimateValue = options.initialEstimateMinutes && options.initialEstimateMinutes > 0
      ? `${options.initialEstimateMinutes}`
      : "";
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

    await this.options.onSubmit({
      text,
      projectName: this.projectNameValue.trim(),
      notes: this.notesValue.trim(),
      estimateMinutes: estimateMinutes === null ? null : Math.round(estimateMinutes)
    });
    this.close();
  }
}

export class DashKanbanView extends ItemView {
  private plugin: DailyDashboardPlugin;
  private searchText = "";
  private dragCard: { projectName: string; taskId: string; laneKey: string } | null = null;
  private suppressCardClickUntil = 0;
  private activeLaneDropTarget: HTMLElement | null = null;
  private activeCardDropTarget: HTMLElement | null = null;
  private selectedCardKey: { projectName: string; taskId: string } | null = null;
  private quickAddDraft: { projectName: string; laneKey: string; taskText: string } | null = null;
  private priorityPickerKey: { projectName: string; taskId: string } | null = null;
  private duePickerKey: { projectName: string; taskId: string } | null = null;
  private effortPickerKey: { projectName: string; taskId: string } | null = null;
  private photoPickerKey: { projectName: string; taskId: string } | null = null;
  private cardPopoverAnchorPoint: { type: "priority" | "due" | "effort" | "photo"; projectName: string; taskId: string; x: number; y: number } | null = null;
  private popoverLayerEl: HTMLElement | null = null;
  private photoCardIndices = new Map<string, number>();
  private collapsedPhotoCards = new Set<string>();
  private detailEditState: {
    projectName: string;
    taskId: string;
    taskText: string;
    lane: string;
    priority: string;
    dueDate: string;
    blockedReason: string;
    effort: string;
    executionContext: string;
  } | null = null;
  private isRefreshing = false;

  constructor(leaf: WorkspaceLeaf, plugin: DailyDashboardPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DASH_KANBAN;
  }

  getDisplayText(): string {
    return "DASH Kanban";
  }

  getIcon(): string {
    return "kanban-square";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("dash-kanban-view");
    this.ensurePopoverLayer();
    await this.requestRefresh();
  }

  async onClose(): Promise<void> {
    this.destroyPopoverLayer();
    this.contentEl.empty();
    this.contentEl.removeClass("dash-kanban-view");
  }

  private matchesCardKey(key: { projectName: string; taskId: string } | null, projectName: string, taskId: string): boolean {
    return !!key && key.projectName === projectName && key.taskId === taskId;
  }

  private getPhotoCardStateKey(projectName: string, taskId: string): string {
    return `${projectName}::${taskId}`;
  }

  private getPhotoCardIndex(projectName: string, taskId: string, photoCount: number): number {
    if (photoCount <= 1) {
      return 0;
    }

    const key = this.getPhotoCardStateKey(projectName, taskId);
    const currentIndex = this.photoCardIndices.get(key) ?? 0;
    const normalizedIndex = ((currentIndex % photoCount) + photoCount) % photoCount;
    if (normalizedIndex !== currentIndex) {
      this.photoCardIndices.set(key, normalizedIndex);
    }
    return normalizedIndex;
  }

  private setPhotoCardIndex(projectName: string, taskId: string, nextIndex: number, photoCount: number): void {
    const key = this.getPhotoCardStateKey(projectName, taskId);
    if (photoCount <= 1) {
      this.photoCardIndices.delete(key);
      return;
    }

    const normalizedIndex = ((nextIndex % photoCount) + photoCount) % photoCount;
    this.photoCardIndices.set(key, normalizedIndex);
  }

  private cyclePhotoCard(projectName: string, taskId: string, photoCount: number, direction: -1 | 1): void {
    const currentIndex = this.getPhotoCardIndex(projectName, taskId, photoCount);
    this.setPhotoCardIndex(projectName, taskId, currentIndex + direction, photoCount);
    void this.requestRefresh();
  }

  private togglePhotoCardCollapsed(projectName: string, taskId: string): void {
    const key = this.getPhotoCardStateKey(projectName, taskId);
    if (this.collapsedPhotoCards.has(key)) {
      this.collapsedPhotoCards.delete(key);
    } else {
      this.collapsedPhotoCards.add(key);
    }
    void this.requestRefresh();
  }

  private isPhotoCardCollapsed(projectName: string, taskId: string): boolean {
    return this.collapsedPhotoCards.has(this.getPhotoCardStateKey(projectName, taskId));
  }

  private isCardEditing(projectName: string, taskId: string): boolean {
    return this.matchesCardKey(this.selectedCardKey, projectName, taskId)
      && this.matchesCardKey(this.detailEditState ? { projectName: this.detailEditState.projectName, taskId: this.detailEditState.taskId } : null, projectName, taskId);
  }

  private clearCardPopovers(): void {
    this.priorityPickerKey = null;
    this.duePickerKey = null;
    this.effortPickerKey = null;
    this.photoPickerKey = null;
    this.cardPopoverAnchorPoint = null;
  }

  private setCardPopoverAnchorPoint(type: "priority" | "due" | "effort" | "photo", projectName: string, taskId: string, event: MouseEvent): void {
    this.cardPopoverAnchorPoint = {
      type,
      projectName,
      taskId,
      x: event.clientX,
      y: event.clientY
    };
  }

  private getCardPopoverAnchorPoint(type: "priority" | "due" | "effort" | "photo", projectName: string, taskId: string): { x: number; y: number } | null {
    if (!this.cardPopoverAnchorPoint) {
      return null;
    }

    return this.cardPopoverAnchorPoint.type === type
      && this.cardPopoverAnchorPoint.projectName === projectName
      && this.cardPopoverAnchorPoint.taskId === taskId
      ? { x: this.cardPopoverAnchorPoint.x, y: this.cardPopoverAnchorPoint.y }
      : null;
  }

  private getViewDocument(): Document {
    return this.contentEl.ownerDocument;
  }

  private ensurePopoverLayer(ownerDocument: Document = this.getViewDocument()): HTMLElement {
    if (this.popoverLayerEl?.isConnected) {
      if (this.popoverLayerEl.ownerDocument === ownerDocument) {
        return this.popoverLayerEl;
      }

      this.destroyPopoverLayer();
    }

    const layer = ownerDocument.createElement("div");
    layer.className = "dash-kanban-popover-layer";
    ownerDocument.body.appendChild(layer);
    this.popoverLayerEl = layer;
    return layer;
  }

  private clearPopoverLayer(): void {
    this.popoverLayerEl?.empty();
  }

  private destroyPopoverLayer(): void {
    this.popoverLayerEl?.remove();
    this.popoverLayerEl = null;
  }

  private setLaneDropTarget(target: HTMLElement | null): void {
    if (this.activeLaneDropTarget === target) {
      return;
    }
    this.activeLaneDropTarget?.removeClass("is-drop-target");
    this.activeLaneDropTarget = target;
    this.activeLaneDropTarget?.addClass("is-drop-target");
  }

  private setCardDropTarget(target: HTMLElement | null): void {
    if (this.activeCardDropTarget === target) {
      return;
    }
    this.activeCardDropTarget?.removeClass("is-drop-target");
    this.activeCardDropTarget = target;
    this.activeCardDropTarget?.addClass("is-drop-target");
  }

  private clearDragTargets(): void {
    this.setLaneDropTarget(null);
    this.setCardDropTarget(null);
  }

  private appendCardFooterPill(parent: HTMLElement, label: string, value: string, kind: "neutral" | "priority" | "due" | "effort" | "done" = "neutral"): void {
    if (!value.trim()) {
      return;
    }
    const pill = document.createElement("span");
    pill.className = "dash-kanban-card-meta-pill";
    pill.dataset.kind = kind;
    const labelEl = document.createElement("strong");
    labelEl.textContent = label;
    pill.appendChild(labelEl);
    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    pill.appendChild(valueEl);
    parent.appendChild(pill);
  }

  private appendCardLabel(parent: HTMLElement, label: string, value: string, kind: "priority" | "due" | "effort" | "done" | "blocked" | "photo", state = ""): void {
    if (!value.trim()) {
      return;
    }
    const pill = document.createElement("span");
    pill.className = "dash-kanban-card-label";
    pill.dataset.kind = kind;
    if (state) {
      pill.dataset.state = state;
    }
    if (kind === "priority") {
      pill.dataset.priority = getKanbanPriorityTone(value);
    }
    const labelEl = document.createElement("strong");
    labelEl.textContent = label;
    pill.appendChild(labelEl);
    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    pill.appendChild(valueEl);
    parent.appendChild(pill);
  }

  private positionCardPopover(popover: HTMLElement, anchor: HTMLElement, preferBelow: boolean, anchorPoint: { x: number; y: number } | null = null): void {
    const positionOnce = () => {
      if (!popover.isConnected || !anchor.isConnected) {
        return false;
      }

      const ownerDocument = anchor.ownerDocument;

      popover.style.visibility = "hidden";
      popover.style.position = "fixed";
      popover.style.left = "0px";
      popover.style.top = "0px";

      const viewportRect = ownerDocument.documentElement.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const horizontalPadding = 12;
      const verticalGap = 8;
      const maxWidth = Math.max(180, viewportRect.width - horizontalPadding * 2);
      const width = Math.min(popoverRect.width || 240, maxWidth);
      const pointX = anchorPoint?.x ?? (anchorRect.left + anchorRect.width / 2);
      const pointY = anchorPoint?.y ?? (preferBelow ? anchorRect.bottom : anchorRect.top);
      const leftLimit = viewportRect.left + horizontalPadding;
      const rightLimit = viewportRect.right - horizontalPadding;
      const topLimit = viewportRect.top + horizontalPadding;
      const bottomLimit = viewportRect.bottom - horizontalPadding;
      const canAlignToPointerRight = pointX + width <= rightLimit;
      const canAlignToPointerLeft = pointX - width >= leftLimit;
      let viewportLeft = pointX;

      if (!canAlignToPointerRight && canAlignToPointerLeft) {
        viewportLeft = pointX - width;
      }

      viewportLeft = Math.max(leftLimit, Math.min(rightLimit - width, viewportLeft));

      let viewportTop = preferBelow
        ? pointY + verticalGap
        : pointY - popoverRect.height - verticalGap;

      if (viewportTop < topLimit) {
        viewportTop = (anchorPoint?.y ?? anchorRect.bottom) + verticalGap;
      }
      if (viewportTop + popoverRect.height > bottomLimit) {
        viewportTop = Math.max(topLimit, (anchorPoint?.y ?? anchorRect.top) - popoverRect.height - verticalGap);
      }

      popover.style.width = `${width}px`;
      popover.style.left = `${viewportLeft}px`;
      popover.style.top = `${viewportTop}px`;
      popover.style.visibility = "visible";
      return true;
    };

    const ownerWindow = anchor.ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      let remainingFrames = 12;
      const tick = () => {
        const positioned = positionOnce();
        if (!positioned) {
          return;
        }
        remainingFrames -= 1;
        if (remainingFrames > 0) {
          ownerWindow.requestAnimationFrame(tick);
        }
      };
      tick();
    }, 0);
  }

  private createDueSeparator(value = "/"): HTMLElement {
    const separator = document.createElement("span");
    separator.className = "dash-kanban-due-separator";
    separator.textContent = value;
    return separator;
  }

  private mountCardPopover(popover: HTMLElement): void {
    this.ensurePopoverLayer(this.getViewDocument()).appendChild(popover);
  }

  private closeInlineCardEditor(): void {
    this.selectedCardKey = null;
    this.detailEditState = null;
    this.clearCardPopovers();
  }

  async requestRefresh(): Promise<void> {
    if (this.isRefreshing) {
      return;
    }

    this.isRefreshing = true;
    try {
      await this.renderBoard();
    } finally {
      this.isRefreshing = false;
    }
  }
  private async renderBoard(): Promise<void> {
    const snapshot = await this.plugin.getDashKanbanWorkspaceSnapshot();
    const viewState = this.plugin.getKanbanViewState();
    this.ensurePopoverLayer(this.getViewDocument());
    this.clearPopoverLayer();
    this.contentEl.empty();
    this.contentEl.addClass("dash-kanban-view");

    const shell = this.contentEl.createDiv({ cls: `dash-kanban-shell is-${viewState.density} is-${viewState.mode}` });
    const activeShellTheme = this.getActiveShellTheme(snapshot, viewState);
    if (activeShellTheme) {
      shell.dataset.theme = activeShellTheme;
    }
    shell.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".dash-kanban-card, .dash-kanban-quick-add, .dash-kanban-lane-rename")) {
        return;
      }
      if (!this.selectedCardKey && !this.priorityPickerKey && !this.duePickerKey && !this.effortPickerKey && !this.photoPickerKey) {
        return;
      }
      this.closeInlineCardEditor();
      void this.requestRefresh();
    });
    if (!snapshot || snapshot.projects.length === 0) {
      const emptyState = shell.createDiv({ cls: "dash-kanban-empty-state" });
      emptyState.createEl("h2", { text: "DASH Kanban needs a Master Task Hub" });
      emptyState.createEl("p", { text: "Point the plugin at a real Master Task Hub note before opening the board." });
      const openButton = emptyState.createEl("button", { cls: "mod-cta", text: "Open Master Task Hub" });
      openButton.addEventListener("click", () => {
        void this.plugin.openMasterTodo();
      });
      return;
    }

    this.renderHeader(shell, snapshot, viewState);
    if (snapshot.repairCount > 0) {
      this.renderRepairBanner(shell, snapshot.repairCount);
    }
    const visibleProjects = this.getVisibleProjects(snapshot, viewState);
    this.getSelectedCard(visibleProjects);

    if (visibleProjects.length === 0) {
      const emptyState = shell.createDiv({ cls: "dash-kanban-empty-state is-filtered" });
      emptyState.createEl("h3", { text: "No matching cards" });
      emptyState.createEl("p", { text: "Try clearing the search or switching projects." });
      return;
    }

    const workspace = shell.createDiv({ cls: `dash-kanban-workspace is-${viewState.mode} is-${viewState.density}` });
    visibleProjects.forEach((project) => {
      this.renderProjectBoard(workspace, project, viewState.mode, viewState.density);
    });
  }

  private getActiveShellTheme(
    snapshot: DashKanbanWorkspaceSnapshot,
    viewState: { mode: DashboardKanbanViewMode; selectedProjectName: string }
  ): DashboardKanbanTheme | "" {
    if (viewState.mode !== "single-project") {
      return "";
    }

    const activeProject = snapshot.projects.find((project) => project.projectName === viewState.selectedProjectName)
      ?? snapshot.projects[0]
      ?? null;
    return activeProject?.theme ?? "";
  }

  private getSelectedCard(projects: DashKanbanProjectBoard[]): { project: DashKanbanProjectBoard; card: DashKanbanCard } | null {
    if (!this.selectedCardKey) {
      return null;
    }

    for (const project of projects) {
      if (project.projectName !== this.selectedCardKey.projectName) {
        continue;
      }

      for (const lane of project.lanes) {
        const card = lane.cards.find((candidate) => candidate.taskId === this.selectedCardKey?.taskId);
        if (card) {
          return { project, card };
        }
      }
    }

    this.selectedCardKey = null;
    this.detailEditState = null;
    return null;
  }

  private syncDetailEditState(project: DashKanbanProjectBoard, card: DashKanbanCard): void {
    if (this.detailEditState
      && this.detailEditState.projectName === project.projectName
      && this.detailEditState.taskId === card.taskId) {
      return;
    }

    this.detailEditState = {
      projectName: project.projectName,
      taskId: card.taskId,
      taskText: card.text,
      lane: card.laneKey,
      priority: card.priority,
      dueDate: card.dueDate,
      blockedReason: card.blockedReason,
      effort: card.effort,
      executionContext: card.executionContext
    };
  }

  private getEditableLaneChoices(projectName: string, currentLane: string): Array<{ value: string; label: string }> {
    const choices = this.plugin.getKanbanLaneOptions(projectName)
      .filter((option) => !option.done)
      .map((option) => ({
        value: option.laneKey,
        label: option.categoryLabel ? `${option.categoryLabel} • ${option.label}` : option.helperText ? `${option.label} (${option.helperText})` : option.label
      }));

    if (!choices.some((choice) => choice.value === currentLane) && currentLane.trim()) {
      choices.unshift({ value: currentLane, label: currentLane });
    }

    return choices;
  }

  private getDefaultQuickAddLane(projectName: string): string {
    return this.plugin.getKanbanLaneOptions(projectName).find((option) => !option.done)?.laneKey ?? "next";
  }

  private openInlineQuickAdd(projectName: string, laneKey = ""): void {
    const normalizedProject = projectName.trim();
    if (!normalizedProject) {
      return;
    }

    this.quickAddDraft = {
      projectName: normalizedProject,
      laneKey: laneKey.trim() || this.getDefaultQuickAddLane(normalizedProject),
      taskText: ""
    };
    void this.requestRefresh();
  }

  private async submitInlineQuickAdd(): Promise<void> {
    const draft = this.quickAddDraft;
    if (!draft || !draft.taskText.trim()) {
      return;
    }

    await this.plugin.addKanbanTask(draft.projectName, draft.laneKey, draft.taskText);
    this.quickAddDraft = null;
    await this.requestRefresh();
  }

  private async saveCardDraft(project: DashKanbanProjectBoard, card: DashKanbanCard, overrides: Partial<{
    taskText: string;
    lane: string;
    priority: string;
    dueDate: string;
    blockedReason: string;
    effort: string;
    executionContext: string;
  }> = {}, options: { preserveEditState?: boolean } = {}): Promise<void> {
    const draft = this.detailEditState
      && this.detailEditState.projectName === project.projectName
      && this.detailEditState.taskId === card.taskId
      ? this.detailEditState
      : {
          projectName: project.projectName,
          taskId: card.taskId,
          taskText: card.text,
          lane: card.laneKey,
          priority: card.priority,
          dueDate: card.dueDate,
          blockedReason: card.blockedReason,
          effort: card.effort,
          executionContext: card.executionContext
        };
    const payload = {
      taskText: overrides.taskText ?? draft.taskText,
      lane: overrides.lane ?? draft.lane,
      priority: overrides.priority ?? draft.priority,
      dueDate: overrides.dueDate ?? draft.dueDate,
      blockedReason: overrides.blockedReason ?? draft.blockedReason,
      effort: overrides.effort ?? draft.effort,
      executionContext: overrides.executionContext ?? draft.executionContext
    };
    const saved = await this.plugin.updateKanbanTaskDetails(project.projectName, card.taskId, payload);
    if (!saved) {
      return;
    }

    this.clearCardPopovers();
    if (options.preserveEditState) {
      this.detailEditState = {
        projectName: project.projectName,
        taskId: card.taskId,
        taskText: payload.taskText,
        lane: payload.lane,
        priority: payload.priority,
        dueDate: payload.dueDate,
        blockedReason: payload.blockedReason,
        effort: payload.effort,
        executionContext: payload.executionContext
      };
    } else {
      this.detailEditState = null;
    }
    await this.requestRefresh();
  }

  private canReorderCardWithinLane(lane: DashKanbanProjectBoard["lanes"][number], draggedTaskId: string, targetCard: DashKanbanCard): boolean {
    const draggedCard = lane.cards.find((candidate) => candidate.taskId === draggedTaskId);
    if (!draggedCard || draggedCard.taskId === targetCard.taskId) {
      return false;
    }

    return draggedCard.priority.trim().toLowerCase() === targetCard.priority.trim().toLowerCase();
  }

  private async reorderCardWithinLane(project: DashKanbanProjectBoard, lane: DashKanbanProjectBoard["lanes"][number], draggedTaskId: string, targetTaskId: string): Promise<void> {
    const draggedCard = lane.cards.find((candidate) => candidate.taskId === draggedTaskId);
    const targetCard = lane.cards.find((candidate) => candidate.taskId === targetTaskId);
    if (!draggedCard || !targetCard) {
      return;
    }

    const matchingPriorityCards = lane.cards.filter((candidate) => candidate.priority.trim().toLowerCase() === draggedCard.priority.trim().toLowerCase());
    const orderedIds = matchingPriorityCards.map((candidate) => candidate.taskId).filter((taskId) => taskId !== draggedTaskId);
    const targetIndex = orderedIds.indexOf(targetTaskId);
    if (targetIndex < 0) {
      return;
    }

    orderedIds.splice(targetIndex, 0, draggedTaskId);
    await this.plugin.updateKanbanLaneCardOrder(project.projectName, lane.laneKey, orderedIds);
  }

  private renderDetailPanel(parent: HTMLElement, project: DashKanbanProjectBoard, card: DashKanbanCard): void {
    this.syncDetailEditState(project, card);
    const panel = parent.createDiv({ cls: "dash-kanban-detail-panel" });
    const header = panel.createDiv({ cls: "dash-kanban-detail-header" });
    const copy = header.createDiv({ cls: "dash-kanban-detail-copy" });
    copy.createEl("div", { cls: "dash-kanban-kicker", text: project.projectName });
    copy.createEl("h2", { text: card.text });
    if (card.notePreview) {
      copy.createEl("p", { cls: "dash-kanban-card-note", text: card.notePreview });
    }

    const closeButton = panel.createEl("button", { cls: "dash-kanban-detail-close", text: "Close" });
    closeButton.addEventListener("click", () => {
      this.selectedCardKey = null;
      this.detailEditState = null;
      void this.requestRefresh();
    });

    const chips = panel.createDiv({ cls: "dash-kanban-detail-chips" });
    createSemanticChip(chips, card.laneLabel, "capture");
    createSemanticChip(chips, project.templateName, "neutral");
    if (card.priority) {
      createSemanticChip(chips, formatKanbanPriorityLabel(card.priority), card.priority === "urgent" || card.priority === "high" ? "alert" : "state");
    }
    if (card.isOverdue) {
      createSemanticChip(chips, "Overdue", "alert");
    } else if (card.isDueSoon) {
      createSemanticChip(chips, "Due soon", "capture");
    }
    if (card.isBlocked) {
      createSemanticChip(chips, "Blocked", "alert");
    }
    if (card.dueDate) {
      createSemanticChip(chips, `Due ${card.dueDate}`, card.isOverdue ? "alert" : "neutral");
    }
    if (card.assignee) {
      createSemanticChip(chips, `@${card.assignee}`, "state");
    }

    const infoGrid = panel.createDiv({ cls: "dash-kanban-detail-grid" });
    this.renderDetailField(infoGrid, "Current section", card.sectionName);
    this.renderDetailField(infoGrid, "Priority", card.priority);
    this.renderDetailField(infoGrid, "Context", card.executionContext);
    this.renderDetailField(infoGrid, "Effort", card.effort);
    this.renderDetailField(infoGrid, "Energy", card.energy);
    this.renderDetailField(infoGrid, "Trigger", card.trigger);
    this.renderDetailField(infoGrid, "Minimum step", card.minimumStep);
    this.renderDetailField(infoGrid, "Blocked reason", card.blockedReason);
    this.renderDetailField(infoGrid, "Unblock date", card.unblockDate);
    this.renderDetailField(infoGrid, "Tags", card.tags.length > 0 ? card.tags.map((tag) => `#${tag}`).join(", ") : "");

    const actions = panel.createDiv({ cls: "dash-kanban-detail-actions" });
    actions.append(
      this.createHeaderButton("pen-square", "Edit card", () => {
        void this.plugin.openKanbanTaskEditFlow(project.projectName, card.taskId);
      }),
      this.createHeaderButton("check", "Complete", () => {
        void this.plugin.completeKanbanTask(project.projectName, card.taskId);
      }),
      this.createHeaderButton("plus-square", "Add sibling", () => {
        void this.plugin.openKanbanQuickAddFlow(project.projectName, card.laneKey);
      }),
      this.createHeaderButton("trash-2", "Delete", () => {
        const confirmed = window.confirm(`Delete "${card.text}" from ${project.projectName}?`);
        if (!confirmed) {
          return;
        }
        this.selectedCardKey = null;
        this.detailEditState = null;
        void this.plugin.deleteKanbanTask(project.projectName, card.taskId);
      })
    );

    if (!card.done && this.detailEditState && this.detailEditState.projectName === project.projectName && this.detailEditState.taskId === card.taskId) {
      const quickEdit = panel.createDiv({ cls: "dash-kanban-inline-editor" });
      quickEdit.createEl("h3", { text: "Quick edit" });
      quickEdit.createEl("p", {
        cls: "dash-kanban-card-note",
        text: "Rewrite the task or move it to another active lane without leaving the board."
      });

      const editorGrid = quickEdit.createDiv({ cls: "dash-kanban-inline-editor-grid" });
      const textField = editorGrid.createDiv({ cls: "dash-kanban-inline-field is-wide" });
      textField.createEl("span", { cls: "dash-kanban-detail-label", text: "Task text" });
      const textArea = textField.createEl("textarea", { cls: "dash-kanban-inline-textarea" });
      textArea.value = this.detailEditState.taskText;
      textArea.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.taskText = textArea.value;
      });

      const laneField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      laneField.createEl("span", { cls: "dash-kanban-detail-label", text: "Lane" });
      const laneSelect = laneField.createEl("select", { cls: "dash-kanban-inline-select" });
      const laneChoices = this.getEditableLaneChoices(project.projectName, this.detailEditState.lane);
      laneChoices.forEach((choice) => {
        laneSelect.add(new Option(choice.label, choice.value, choice.value === this.detailEditState?.lane, choice.value === this.detailEditState?.lane));
      });
      laneSelect.value = this.detailEditState.lane;
      laneSelect.addEventListener("change", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.lane = laneSelect.value;
      });

      const priorityField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      priorityField.createEl("span", { cls: "dash-kanban-detail-label", text: "Priority" });
      const prioritySelect = priorityField.createEl("select", { cls: "dash-kanban-inline-select" });
      [["", "None"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]].forEach(([value, label]) => {
        prioritySelect.add(new Option(label, value, value === this.detailEditState?.priority, value === this.detailEditState?.priority));
      });
      prioritySelect.value = this.detailEditState.priority;
      prioritySelect.addEventListener("change", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.priority = prioritySelect.value;
      });

      const dueField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      dueField.createEl("span", { cls: "dash-kanban-detail-label", text: "Due date" });
      const dueInput = dueField.createEl("input", { cls: "dash-kanban-inline-select", type: "date" });
      dueInput.value = this.detailEditState.dueDate;
      dueInput.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.dueDate = dueInput.value;
      });

      const blockedField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      blockedField.createEl("span", { cls: "dash-kanban-detail-label", text: "Blocked reason" });
      const blockedInput = blockedField.createEl("input", { cls: "dash-kanban-inline-select", type: "text" });
      blockedInput.value = this.detailEditState.blockedReason;
      blockedInput.placeholder = "Waiting on asset, approval, reply";
      blockedInput.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.blockedReason = blockedInput.value;
      });

      const effortField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      effortField.createEl("span", { cls: "dash-kanban-detail-label", text: "Effort" });
      const effortInput = effortField.createEl("input", { cls: "dash-kanban-inline-select", type: "text" });
      effortInput.value = this.detailEditState.effort;
      effortInput.placeholder = "15m, 1h, small";
      effortInput.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.effort = effortInput.value;
      });

      const contextField = editorGrid.createDiv({ cls: "dash-kanban-inline-field" });
      contextField.createEl("span", { cls: "dash-kanban-detail-label", text: "Context" });
      const contextInput = contextField.createEl("input", { cls: "dash-kanban-inline-select", type: "text" });
      contextInput.value = this.detailEditState.executionContext;
      contextInput.placeholder = "Desk, phone, writing, coding";
      contextInput.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.executionContext = contextInput.value;
      });

      const editorActions = quickEdit.createDiv({ cls: "dash-kanban-detail-actions" });
      editorActions.append(
        this.createHeaderButton("save", "Save changes", () => {
          const draft = this.detailEditState;
          if (!draft) {
            return;
          }
          void (async () => {
            const saved = await this.plugin.updateKanbanTaskDetails(project.projectName, card.taskId, {
              taskText: draft.taskText,
              lane: draft.lane,
              priority: draft.priority,
              dueDate: draft.dueDate,
              blockedReason: draft.blockedReason,
              effort: draft.effort,
              executionContext: draft.executionContext
            });
            if (!saved) {
              return;
            }
            this.detailEditState = null;
            await this.requestRefresh();
          })();
        }),
        this.createHeaderButton("rotate-ccw", "Reset", () => {
          this.detailEditState = {
            projectName: project.projectName,
            taskId: card.taskId,
            taskText: card.text,
            lane: card.laneKey,
            priority: card.priority,
            dueDate: card.dueDate,
            blockedReason: card.blockedReason,
            effort: card.effort,
            executionContext: card.executionContext
          };
          void this.requestRefresh();
        })
      );
    }

    const links = panel.createDiv({ cls: "dash-kanban-detail-actions" });
    links.append(
      this.createHeaderButton("file-text", "Open hub", () => {
        void this.plugin.openMasterTodo();
      })
    );
    if (project.notePath) {
      links.append(this.createHeaderButton("folder-open", "Open note", () => {
        void this.plugin.openNoteByPath(project.notePath);
      }));
    }
  }

  private renderDetailField(parent: HTMLElement, label: string, value: string): void {
    if (!value.trim()) {
      return;
    }

    const field = parent.createDiv({ cls: "dash-kanban-detail-field" });
    field.createEl("span", { cls: "dash-kanban-detail-label", text: label });
    field.createEl("strong", { text: value });
  }

  private renderRepairBanner(parent: HTMLElement, repairCount: number): void {
    const banner = parent.createDiv({ cls: "dash-kanban-repair-banner" });
    const copy = banner.createDiv({ cls: "dash-kanban-repair-copy" });
    copy.createEl("strong", { text: `${repairCount} Kanban repair item${repairCount === 1 ? "" : "s"} need review` });
    copy.createEl("p", {
      cls: "dash-kanban-card-note",
      text: "Open the repair report when tasks drift, mappings go stale, or older artifacts need to be compared against current board state."
    });

    const actions = banner.createDiv({ cls: "dash-kanban-detail-actions" });
    actions.append(
      this.createHeaderButton("wrench", "Open repair report", () => {
        void this.plugin.generateKanbanRepairReport(true);
      }),
      this.createHeaderButton("refresh-cw", "Repair foundations", () => {
        void this.plugin.repairKanbanFoundations(true);
      })
    );
  }

  private renderHeader(parent: HTMLElement, snapshot: DashKanbanWorkspaceSnapshot, viewState: { mode: DashboardKanbanViewMode; selectedProjectName: string; showDone: boolean; focusFilter: DashboardKanbanFocusFilter; density: DashboardKanbanDensity; headerCollapsed: boolean }): void {
    const header = parent.createDiv({ cls: `dash-kanban-header${viewState.headerCollapsed ? " is-collapsed" : ""}` });
    const searchQuery = this.searchText.trim().toLowerCase();
    const filterCounts = this.getFocusFilterCounts(this.getSearchedProjects(this.getScopedProjects(snapshot, viewState), searchQuery));

    if (viewState.headerCollapsed) {
      const hero = header.createDiv({ cls: "dash-kanban-hero is-collapsed" });
      const collapsedTop = hero.createDiv({ cls: "dash-kanban-collapsed-top" });
      const copy = collapsedTop.createDiv({ cls: "dash-kanban-hero-copy" });
      copy.createEl("div", { cls: "dash-kanban-kicker", text: "DASH BOARD WORKSPACE" });
      copy.createEl("h1", { cls: "dash-kanban-title", text: "Kanban" });
      const collapsedControls = collapsedTop.createDiv({ cls: "dash-kanban-collapsed-controls" });
      const actionRow = collapsedControls.createDiv({ cls: "dash-kanban-action-row dash-kanban-collapsed-action-row" });
      actionRow.append(
        this.createHeaderButton("folder-plus", "New project", () => {
          void this.plugin.openCreateProjectFlow();
        }),
        this.createHeaderButton("plus", "Add card", () => {
          const targetProject = snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
          this.openInlineQuickAdd(targetProject);
        }),
        this.createHeaderButton("pen-square", "Edit card", () => {
          const targetProject = this.selectedCardKey?.projectName || snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
          if (this.selectedCardKey?.taskId) {
            void this.plugin.openKanbanTaskEditFlow(targetProject, this.selectedCardKey.taskId);
            return;
          }
          void this.plugin.openKanbanTaskEditFlow(targetProject);
        }),
        this.createHeaderButton("file-stack", "Open hub", () => {
          void this.plugin.openMasterTodo();
        }),
        this.createHeaderButton("sliders-horizontal", "Board settings", () => {
          const targetProject = snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
          void this.plugin.openDashKanbanBoardSettings(targetProject);
        }),
        this.createHeaderButton("database-zap", "Cleanup registry", () => {
          void this.plugin.pruneStaleKanbanRegistryEntries(true);
        })
      );
      const collapseButton = document.createElement("button");
      collapseButton.type = "button";
      collapseButton.className = "dash-kanban-header-button dash-kanban-collapse-button dash-kanban-collapse-button--icon";
      collapseButton.ariaLabel = "Expand header";
      collapseButton.title = "Expand header";
      setIcon(collapseButton, "chevron-down");
      collapseButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      collapseButton.addEventListener("click", () => {
        void this.plugin.updateKanbanViewState({ headerCollapsed: false });
      });
      collapsedControls.appendChild(collapseButton);

      const collapsedBottom = hero.createDiv({ cls: "dash-kanban-collapsed-bottom" });
      const summary = collapsedBottom.createDiv({ cls: "dash-kanban-summary" });
      createSemanticChip(summary, `${snapshot.totalProjects} projects`, "focus");
      createSemanticChip(summary, `${snapshot.totalCards} cards`, "capture");
      createSemanticChip(summary, viewState.mode === "all-projects" ? "All projects" : "Single project", "neutral");
      createSemanticChip(summary, viewState.focusFilter === "all"
        ? "All work"
        : viewState.focusFilter === "attention"
          ? "Attention"
          : viewState.focusFilter === "blocked"
            ? "Blocked"
            : "Due", "state");
      createSemanticChip(summary, viewState.showDone ? "Done visible" : "Done hidden", viewState.showDone ? "done" : "neutral");
      if (snapshot.repairCount > 0) {
        createSemanticChip(summary, `${snapshot.repairCount} repair`, "alert");
      }

      return;
    }

    const hero = header.createDiv({ cls: `dash-kanban-hero is-${viewState.mode}` });
    const heroTop = hero.createDiv({ cls: "dash-kanban-hero-top" });
    const copy = heroTop.createDiv({ cls: "dash-kanban-hero-copy" });
    copy.createEl("div", { cls: "dash-kanban-kicker", text: "DASH BOARD WORKSPACE" });
    copy.createEl("h1", { cls: "dash-kanban-title", text: "Kanban" });
    copy.createEl("p", {
      cls: "dash-kanban-subtitle",
      text: viewState.mode === "single-project"
        ? "Single-project mode gives one board more breathing room while still staying anchored to the Master Task Hub."
        : "Portfolio mode keeps multiple projects readable without turning the board into a wall of equally loud controls."
    });

    const summary = hero.createDiv({ cls: "dash-kanban-summary dash-kanban-summary--hero" });
    createSemanticChip(summary, `${snapshot.totalProjects} projects`, "focus");
    createSemanticChip(summary, `${snapshot.totalCards} cards`, "capture");
    createSemanticChip(summary, viewState.mode === "all-projects" ? "All projects" : "Single project", "neutral");
    createSemanticChip(summary, viewState.focusFilter === "all"
      ? "All work"
      : viewState.focusFilter === "attention"
        ? "Attention filter"
        : viewState.focusFilter === "blocked"
          ? "Blocked filter"
          : "Due filter", "state");
    createSemanticChip(summary, viewState.showDone ? "Done visible" : "Done hidden", viewState.showDone ? "done" : "neutral");
    if (snapshot.repairCount > 0) {
      createSemanticChip(summary, `${snapshot.repairCount} repair`, "alert");
    }

    const controls = header.createDiv({ cls: `dash-kanban-controls is-${viewState.mode}` });
    if (viewState.headerCollapsed) {
      controls.addClass("is-collapsed");
    }
    const controlsTop = controls.createDiv({ cls: "dash-kanban-controls-top" });
    const primaryGroup = controlsTop.createDiv({ cls: "dash-kanban-control-cluster is-primary" });
    primaryGroup.createEl("span", { cls: "dash-kanban-control-label", text: "Create & edit" });
      const primaryActions = primaryGroup.createDiv({ cls: "dash-kanban-action-row dash-kanban-action-row--group dash-kanban-primary-action-row" });
    primaryActions.append(
      this.createHeaderButton("folder-plus", "New project", () => {
        void this.plugin.openCreateProjectFlow();
      }),
      this.createHeaderButton("plus", "Add card", () => {
        const targetProject = snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
        this.openInlineQuickAdd(targetProject);
      }),
      this.createHeaderButton("pen-square", "Edit card", () => {
        const targetProject = this.selectedCardKey?.projectName || snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
        if (this.selectedCardKey?.taskId) {
          void this.plugin.openKanbanTaskEditFlow(targetProject, this.selectedCardKey.taskId);
          return;
        }
        void this.plugin.openKanbanTaskEditFlow(targetProject);
      })
    );

    const boardGroup = controlsTop.createDiv({ cls: "dash-kanban-control-cluster is-board" });
    boardGroup.createEl("span", { cls: "dash-kanban-control-label", text: "Board" });
      const boardActions = boardGroup.createDiv({ cls: "dash-kanban-action-row dash-kanban-action-row--group dash-kanban-board-action-row" });
    boardActions.append(
      this.createHeaderButton("file-stack", "Open hub", () => {
        void this.plugin.openMasterTodo();
      }),
      this.createHeaderButton("sliders-horizontal", "Board settings", () => {
        const targetProject = snapshot.selectedProjectName || snapshot.projects[0]?.projectName || "";
        void this.plugin.openDashKanbanBoardSettings(targetProject);
      }),
      this.createHeaderButton("database-zap", "Cleanup registry", () => {
        void this.plugin.pruneStaleKanbanRegistryEntries(true);
      })
    );

    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "dash-kanban-header-button dash-kanban-collapse-button dash-kanban-collapse-button--icon dash-kanban-collapse-button--controls";
    collapseButton.ariaLabel = "Collapse header";
    collapseButton.title = "Collapse header";
    setIcon(collapseButton, "chevron-up");
    collapseButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    collapseButton.addEventListener("click", () => {
      void this.plugin.updateKanbanViewState({ headerCollapsed: true });
    });
    controlsTop.appendChild(collapseButton);

    const viewGroup = controls.createDiv({ cls: "dash-kanban-control-cluster is-view" });
    viewGroup.createEl("span", { cls: "dash-kanban-control-label", text: "View & filter" });

    const viewTopRow = viewGroup.createDiv({ cls: "dash-kanban-view-row is-top" });
    const viewBottomRow = viewGroup.createDiv({ cls: "dash-kanban-view-row is-bottom" });

    const searchWrapper = viewTopRow.createDiv({ cls: "dash-kanban-search" });
    const searchIcon = searchWrapper.createSpan({ cls: "dash-kanban-search-icon" });
    setIcon(searchIcon, "search");
    const searchInput = searchWrapper.createEl("input", {
      type: "search",
      placeholder: "Search cards, tags, assignees, projects"
    });
    searchInput.value = this.searchText;
    searchInput.addEventListener("input", () => {
      this.searchText = searchInput.value;
      void this.requestRefresh();
    });

    const modeToggle = viewTopRow.createDiv({ cls: "dash-kanban-mode-toggle" });
    modeToggle.append(
      this.createToggleButton("All Projects", viewState.mode === "all-projects", async () => {
        await this.plugin.updateKanbanViewState({ mode: "all-projects" });
      }),
      this.createToggleButton("Single Project", viewState.mode === "single-project", async () => {
        await this.plugin.updateKanbanViewState({ mode: "single-project" });
      })
    );

    const projectSelect = viewTopRow.createEl("select", { cls: "dash-kanban-project-select" });
    snapshot.projects.forEach((project) => {
      projectSelect.add(new Option(project.projectName, project.projectName, project.projectName === snapshot.selectedProjectName, project.projectName === snapshot.selectedProjectName));
    });
    projectSelect.value = snapshot.selectedProjectName;
    projectSelect.addEventListener("change", () => {
      void this.plugin.updateKanbanViewState({ selectedProjectName: projectSelect.value });
    });

    const focusRow = viewBottomRow.createDiv({ cls: "dash-kanban-focus-row" });
    focusRow.append(
      this.createToggleButton(`All ${filterCounts.all}`, viewState.focusFilter === "all", async () => {
        await this.plugin.updateKanbanViewState({ focusFilter: "all" });
      }),
      this.createToggleButton(`Attention ${filterCounts.attention}`, viewState.focusFilter === "attention", async () => {
        await this.plugin.updateKanbanViewState({ focusFilter: "attention" });
      }),
      this.createToggleButton(`Blocked ${filterCounts.blocked}`, viewState.focusFilter === "blocked", async () => {
        await this.plugin.updateKanbanViewState({ focusFilter: "blocked" });
      }),
      this.createToggleButton(`Due ${filterCounts.due}`, viewState.focusFilter === "due", async () => {
        await this.plugin.updateKanbanViewState({ focusFilter: "due" });
      })
    );

    const densityToggle = viewBottomRow.createDiv({ cls: "dash-kanban-mode-toggle dash-kanban-density-toggle" });
    densityToggle.append(
      this.createToggleButton("Comfortable", viewState.density === "comfortable", async () => {
        await this.plugin.updateKanbanViewState({ density: "comfortable" });
      }),
      this.createToggleButton("Dense", viewState.density === "compact", async () => {
        await this.plugin.updateKanbanViewState({ density: "compact" });
      })
    );

    const doneToggle = viewBottomRow.createEl("label", { cls: "dash-kanban-checkbox" });
    const doneInput = doneToggle.createEl("input", { type: "checkbox" });
    doneInput.checked = viewState.showDone;
    doneInput.addEventListener("change", () => {
      void this.plugin.updateKanbanViewState({ showDone: doneInput.checked });
    });
    doneToggle.createSpan({ text: "Show done" });
  }

  private getScopedProjects(snapshot: DashKanbanWorkspaceSnapshot, viewState: { mode: DashboardKanbanViewMode; selectedProjectName: string; showDone: boolean }): DashKanbanProjectBoard[] {
    const baseProjects = viewState.mode === "single-project"
      ? snapshot.projects.filter((project) => project.projectName === snapshot.selectedProjectName)
      : snapshot.projects;

    return baseProjects.map((project) => ({
      ...project,
      lanes: project.lanes
        .filter((lane) => viewState.showDone || !lane.done)
        .map((lane) => ({
          ...lane,
          cards: [...lane.cards],
          cardCount: lane.cards.length
        }))
    }));
  }

  private getSearchedProjects(projects: DashKanbanProjectBoard[], query: string): DashKanbanProjectBoard[] {
    return projects
      .map((project) => ({
        ...project,
        lanes: project.lanes.map((lane) => {
          const cards = lane.cards.filter((card) => this.matchesCardSearch(project, card, query));
          return {
            ...lane,
            cards,
            cardCount: cards.length
          };
        })
      }))
      .filter((project) => !query || project.projectName.toLowerCase().includes(query) || project.lanes.some((lane) => lane.cards.length > 0));
  }

  private getFocusFilterCounts(projects: DashKanbanProjectBoard[]): Record<DashboardKanbanFocusFilter, number> {
    const cards = projects.flatMap((project) => project.lanes.flatMap((lane) => lane.cards));
    return {
      all: cards.length,
      attention: cards.filter((card) => this.matchesFocusFilter(card, "attention")).length,
      blocked: cards.filter((card) => this.matchesFocusFilter(card, "blocked")).length,
      due: cards.filter((card) => this.matchesFocusFilter(card, "due")).length
    };
  }

  private getVisibleProjects(snapshot: DashKanbanWorkspaceSnapshot, viewState: { mode: DashboardKanbanViewMode; selectedProjectName: string; showDone: boolean; focusFilter: DashboardKanbanFocusFilter }): DashKanbanProjectBoard[] {
    const searchedProjects = this.getSearchedProjects(this.getScopedProjects(snapshot, viewState), this.searchText.trim().toLowerCase());

    return searchedProjects
      .map((project) => ({
        ...project,
        lanes: project.lanes.map((lane) => {
          const cards = lane.cards.filter((card) => this.matchesFocusFilter(card, viewState.focusFilter));
          return {
            ...lane,
            cards,
            cardCount: cards.length
          };
        })
      }));
  }

  private matchesFocusFilter(card: DashKanbanCard, filter: DashboardKanbanFocusFilter): boolean {
    if (filter === "all") {
      return true;
    }

    if (filter === "blocked") {
      return card.isBlocked;
    }

    if (filter === "due") {
      return card.isDueSoon || card.isOverdue;
    }

    return card.isBlocked || card.isDueSoon || card.isOverdue;
  }

  private matchesCardSearch(project: DashKanbanProjectBoard, card: DashKanbanCard, query: string): boolean {
    if (!query) {
      return true;
    }

    return [
      project.projectName,
      project.templateName,
      card.text,
      card.notePreview,
      card.priority,
      card.assignee,
      card.dueDate,
      card.blockedReason,
      card.executionContext,
      ...card.tags
    ].some((value) => value.toLowerCase().includes(query));
  }

  private getProjectLaneGroups(project: DashKanbanProjectBoard): Array<{ key: string; label: string; subtitle: string; color: string; lanes: DashKanbanProjectBoard["lanes"] }> {
    const groups: Array<{ key: string; label: string; subtitle: string; color: string; lanes: DashKanbanProjectBoard["lanes"] }> = [];
    project.lanes.forEach((lane) => {
      const key = lane.categoryKey || lane.laneKey;
      const existing = groups.find((group) => group.key === key);
      if (existing) {
        existing.lanes.push(lane);
        return;
      }

      groups.push({
        key,
        label: lane.categoryLabel,
        subtitle: lane.categorySubtitle,
        color: lane.categoryColor,
        lanes: [lane]
      });
    });
    return groups;
  }

  private activateMatrixColumnRename(container: HTMLElement, project: DashKanbanProjectBoard, columnKey: string, currentLabel: string): void {
    if (!columnKey || container.querySelector(".dash-kanban-lane-rename")) {
      return;
    }

    const existingRow = container.querySelector(".dash-kanban-matrix-column-title-row");
    if (!existingRow) {
      return;
    }

    existingRow.remove();
    const form = document.createElement("div");
    form.className = "dash-kanban-lane-rename";
    container.prepend(form);

    const input = document.createElement("input");
    input.className = "dash-kanban-lane-rename-input";
    input.type = "text";
    input.value = currentLabel;
    form.appendChild(input);

    const saveButton = document.createElement("button");
    saveButton.className = "dash-kanban-card-action dash-kanban-lane-rename-action";
    saveButton.type = "button";
    saveButton.ariaLabel = "Save swimlane title";
    saveButton.title = "Save swimlane title";
    setIcon(saveButton, "check");
    form.appendChild(saveButton);

    const cancelButton = document.createElement("button");
    cancelButton.className = "dash-kanban-card-action dash-kanban-lane-rename-action";
    cancelButton.type = "button";
    cancelButton.ariaLabel = "Cancel swimlane rename";
    cancelButton.title = "Cancel swimlane rename";
    setIcon(cancelButton, "x");
    form.appendChild(cancelButton);

    const submit = () => {
      const nextLabel = input.value.trim();
      if (!nextLabel || nextLabel === currentLabel) {
        void this.requestRefresh();
        return;
      }

      void (async () => {
        await this.plugin.renameKanbanColumn(project.projectName, columnKey, nextLabel);
        await this.requestRefresh();
      })();
    };

    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        void this.requestRefresh();
      }
    });
    saveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      submit();
    });
    cancelButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.requestRefresh();
    });

    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  private getProjectLaneColumns(project: DashKanbanProjectBoard): Array<{ key: string; label: string; helperText: string }> {
    const columns: Array<{ key: string; label: string; helperText: string }> = [];
    project.lanes.forEach((lane) => {
      const key = lane.columnKey || lane.laneKey;
      if (columns.some((column) => column.key === key)) {
        return;
      }

      columns.push({
        key,
        label: lane.label,
        helperText: lane.helperText
      });
    });
    return columns;
  }

  private renderSharedColumnBoard(parent: HTMLElement, project: DashKanbanProjectBoard, mode: DashboardKanbanViewMode, density: DashboardKanbanDensity): void {
    const matrix = parent.createDiv({ cls: `dash-kanban-matrix is-${mode} is-${density}` });
    const columns = this.getProjectLaneColumns(project);
    const rows = this.getProjectLaneGroups(project);
    matrix.style.setProperty("--dash-kanban-matrix-columns", `${Math.max(columns.length, 1)}`);

    const headerSpacer = matrix.createDiv({ cls: "dash-kanban-matrix-corner" });
    if (rows.some((row) => row.label.trim().length > 0)) {
      headerSpacer.createSpan({ text: "Swimlane" });
    }

      columns.forEach((column, columnIndex) => {
      const header = matrix.createDiv({ cls: "dash-kanban-matrix-column-header" });
      header.style.setProperty("--dash-kanban-column-index", `${columnIndex + 1}`);
      const headerTop = header.createDiv({ cls: "dash-kanban-matrix-column-top" });
      const headerTitleRow = headerTop.createDiv({ cls: "dash-kanban-matrix-column-title-row" });
      const headerTitleButton = headerTitleRow.createEl("button", { cls: "dash-kanban-matrix-column-title", text: column.label });
      headerTitleButton.type = "button";
      headerTitleButton.title = `Rename ${column.label}`;
      headerTitleButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activateMatrixColumnRename(headerTop, project, column.key, column.label);
      });
      headerTitleButton.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.activateMatrixColumnRename(headerTop, project, column.key, column.label);
      });
      const headerEditButton = headerTitleRow.createEl("button", { cls: "dash-kanban-matrix-column-edit", attr: { "aria-label": `Rename ${column.label}` } });
      headerEditButton.type = "button";
      headerEditButton.title = `Rename ${column.label}`;
      setIcon(headerEditButton, "pencil");
      headerEditButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      headerEditButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activateMatrixColumnRename(headerTop, project, column.key, column.label);
      });
      headerTop.createEl("span", { cls: "dash-kanban-matrix-column-kicker", text: `Stage ${columnIndex + 1}` });
      if (column.helperText) {
        header.createEl("p", { text: column.helperText });
      }
    });

    rows.forEach((row) => {
      const rowHeader = matrix.createDiv({ cls: "dash-kanban-matrix-row-header" });
      const rowCardCount = row.lanes.reduce((sum, lane) => sum + lane.cardCount, 0);
      if (row.color) {
        rowHeader.style.setProperty("--dash-kanban-category-color", row.color);
      }
      const rowHeaderTop = rowHeader.createDiv({ cls: "dash-kanban-matrix-row-top" });
      const rowHeaderLabels = rowHeaderTop.createDiv({ cls: "dash-kanban-matrix-row-labels" });
      rowHeaderLabels.createEl("strong", { text: row.label || "Board" });
      if (row.subtitle) {
        rowHeaderLabels.createEl("p", { text: row.subtitle });
      }
      rowHeaderTop.createEl("span", { cls: "dash-kanban-matrix-row-count", text: `${rowCardCount} card${rowCardCount === 1 ? "" : "s"}` });

      columns.forEach((column) => {
        const lane = row.lanes.find((candidate) => (candidate.columnKey || candidate.laneKey) === column.key) ?? null;
        if (!lane) {
          const emptyCell = matrix.createDiv({ cls: "dash-kanban-matrix-empty-cell is-structural" });
          emptyCell.createEl("strong", { text: column.label });
          emptyCell.createSpan({ text: "This stage is not used in this swimlane." });
          return;
        }

        this.renderLane(matrix, project, lane, { extraClass: "is-matrix-cell", showTitle: false });
      });
    });
  }

  private activateLaneRename(titleButton: HTMLButtonElement, project: DashKanbanProjectBoard, lane: DashKanbanProjectBoard["lanes"][number]): void {
    const header = titleButton.parentElement;
    if (!header || header.querySelector(".dash-kanban-lane-rename")) {
      return;
    }

    titleButton.remove();
    const form = document.createElement("div");
    form.className = "dash-kanban-lane-rename";
    header.prepend(form);

    const input = document.createElement("input");
    input.className = "dash-kanban-lane-rename-input";
    input.type = "text";
    input.value = lane.label;
    form.appendChild(input);

    const saveButton = document.createElement("button");
    saveButton.className = "dash-kanban-card-action dash-kanban-lane-rename-action";
    saveButton.type = "button";
    saveButton.ariaLabel = "Save lane title";
    saveButton.title = "Save lane title";
    setIcon(saveButton, "check");
    form.appendChild(saveButton);

    const cancelButton = document.createElement("button");
    cancelButton.className = "dash-kanban-card-action dash-kanban-lane-rename-action";
    cancelButton.type = "button";
    cancelButton.ariaLabel = "Cancel lane rename";
    cancelButton.title = "Cancel lane rename";
    setIcon(cancelButton, "x");
    form.appendChild(cancelButton);

    const submit = () => {
      const nextLabel = input.value.trim();
      if (!nextLabel || nextLabel === lane.label) {
        void this.requestRefresh();
        return;
      }
      void (async () => {
        await this.plugin.renameKanbanLane(project.projectName, lane.laneKey, nextLabel);
        await this.requestRefresh();
      })();
    };

    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        void this.requestRefresh();
      }
    });
    saveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      submit();
    });
    cancelButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.requestRefresh();
    });

    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  private bindProjectCollapse(header: HTMLElement, project: DashKanbanProjectBoard, mode: DashboardKanbanViewMode): void {
    if (mode !== "all-projects") {
      return;
    }

    const toggle = () => {
      void this.plugin.updateKanbanBoardPresentation(project.projectName, { collapsedInHub: !project.collapsedInHub });
    };

    header.addClass("is-clickable");
    header.tabIndex = 0;
    header.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, label")) {
        return;
      }
      toggle();
    });
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      toggle();
    });
  }

  private bindProjectResize(handle: HTMLElement, board: HTMLElement, project: DashKanbanProjectBoard): void {
    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = project.boardHeight;

      const onMove = (moveEvent: MouseEvent) => {
        const nextHeight = Math.min(Math.max(Math.round(startHeight + (moveEvent.clientY - startY)), 260), 900);
        board.style.setProperty("--dash-kanban-board-height", `${nextHeight}px`);
      };

      const onUp = (upEvent: MouseEvent) => {
        const nextHeight = Math.min(Math.max(Math.round(startHeight + (upEvent.clientY - startY)), 260), 900);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        void this.plugin.updateKanbanBoardPresentation(project.projectName, { boardHeight: nextHeight });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  }

  private queueTextInputFocus(input: HTMLInputElement | HTMLTextAreaElement, selectAll = false): void {
    const focusInput = () => {
      input.focus();
      if (selectAll && typeof input.select === "function") {
        input.select();
        return;
      }

      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    };

    window.setTimeout(focusInput, 0);
    window.setTimeout(() => {
      if (document.activeElement !== input) {
        focusInput();
      }
    }, 40);
  }

  private renderProjectBoard(parent: HTMLElement, project: DashKanbanProjectBoard, mode: DashboardKanbanViewMode, density: DashboardKanbanDensity): void {
    const isCollapsedInWorkspace = project.collapsedInHub && mode === "all-projects";
    const board = parent.createDiv({ cls: `dash-kanban-project-board is-${mode}${isCollapsedInWorkspace ? " is-collapsed" : ""}${project.usesSharedColumnLayout ? " is-matrix-board" : ""}${project.usesSharedColumnLayout && density === "compact" ? " is-dense-matrix" : ""}${project.stickyHeaders ? " has-sticky-headers" : ""}` });
    board.dataset.theme = project.theme;
    board.style.setProperty("--dash-kanban-board-height", `${project.boardHeight}px`);
    const visibleCards = project.lanes.flatMap((lane) => lane.cards);
    const blockedCount = visibleCards.filter((card) => card.isBlocked && !card.done).length;
    const dueCount = visibleCards.filter((card) => !card.done && (card.isDueSoon || card.isOverdue)).length;
    const boardHeader = board.createDiv({ cls: "dash-kanban-project-header" });
    this.bindProjectCollapse(boardHeader, project, mode);
    const collapseButton = boardHeader.createEl("button", { cls: "dash-kanban-project-collapse-button" });
    collapseButton.type = "button";
    collapseButton.ariaLabel = isCollapsedInWorkspace ? `Expand ${project.projectName}` : `Collapse ${project.projectName}`;
    collapseButton.title = isCollapsedInWorkspace ? "Expand project" : "Collapse project";
    setIcon(collapseButton, isCollapsedInWorkspace ? "chevron-right" : "chevron-down");
    collapseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.plugin.updateKanbanBoardPresentation(project.projectName, { collapsedInHub: !project.collapsedInHub });
    });
    const heading = boardHeader.createDiv({ cls: "dash-kanban-project-heading" });
    heading.createEl("h2", { text: project.projectName });
    const summaryText = mode === "single-project"
      ? (project.projectSummary.trim() || project.focus.trim())
      : "";
    if (summaryText) {
      heading.createEl("p", { cls: "dash-kanban-project-summary", text: summaryText });
    }
    const headingMeta = heading.createDiv({ cls: "dash-kanban-project-context" });
    headingMeta.createEl("span", { cls: "dash-kanban-project-context-item", text: project.templateName });
    headingMeta.createEl("span", { cls: "dash-kanban-project-context-item", text: project.status || (project.projectState === "active" ? "Active" : project.projectState) });
    if (project.archivedCount > 0) {
      headingMeta.createEl("span", { cls: "dash-kanban-project-context-item", text: `${project.archivedCount} archived` });
    }

    const projectMeta = boardHeader.createDiv({ cls: "dash-kanban-project-meta" });
    createSemanticChip(projectMeta, project.healthLabel, project.healthScore >= 75 ? "done" : project.healthScore >= 50 ? "neutral" : "alert");
    createSemanticChip(projectMeta, `${project.openCount} open`, "neutral");
    if (blockedCount > 0) {
      createSemanticChip(projectMeta, `${blockedCount} blocked`, "alert");
    }
    if (dueCount > 0) {
      createSemanticChip(projectMeta, `${dueCount} due`, visibleCards.some((card) => card.isOverdue) ? "alert" : "capture");
    }

    if (!isCollapsedInWorkspace) {
      const boardActions = boardHeader.createDiv({ cls: "dash-kanban-project-actions" });
      boardActions.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      boardActions.append(
        this.createHeaderButton("sliders-horizontal", "Settings", () => {
          void this.plugin.openDashKanbanBoardSettings(project.projectName);
        })
      );
      boardActions.querySelectorAll(".dash-kanban-header-button").forEach((button) => button.addClass("is-secondary"));
      if (project.notePath) {
        boardActions.append(this.createHeaderButton("folder-open", "Note", () => {
          void this.plugin.openNoteByPath(project.notePath);
        }));
        boardActions.lastElementChild?.addClass("is-secondary");
      }
      boardActions.append(this.createHeaderButton("trash-2", "Delete", () => {
        const confirmed = window.confirm(`Delete \"${project.projectName}\" from the Master Task Hub and remove its project note?`);
        if (!confirmed) {
          return;
        }

        if (this.selectedCardKey?.projectName === project.projectName) {
          this.selectedCardKey = null;
          this.detailEditState = null;
          this.clearCardPopovers();
        }

        void this.plugin.deleteProjectAndNote(project.projectName).then(async (deleted) => {
          if (deleted) {
            await this.requestRefresh();
          }
        });
      }));
      boardActions.lastElementChild?.addClass("is-secondary");
      boardActions.lastElementChild?.addClass("is-danger");
    }

    if (isCollapsedInWorkspace) {
      return;
    }

    const body = board.createDiv({ cls: "dash-kanban-project-body" });
    if (project.showLaneCategories && project.usesSharedColumnLayout) {
      this.renderSharedColumnBoard(body, project, mode, density);
    } else {
      const groups = project.showLaneCategories
        ? this.getProjectLaneGroups(project)
        : [{ key: "board", label: "", subtitle: "", color: "", lanes: project.lanes }];
    groups.forEach((group) => {
      const category = body.createDiv({ cls: "dash-kanban-category-section" });
      if (group.label) {
        const categoryHeader = category.createDiv({ cls: "dash-kanban-category-header" });
        if (group.color) {
          categoryHeader.style.setProperty("--dash-kanban-category-color", group.color);
        }
        categoryHeader.createEl("span", { text: group.label.toUpperCase() });
        if (group.subtitle) {
          categoryHeader.createEl("small", { text: group.subtitle });
        }
      }

      const lanes = category.createDiv({ cls: `dash-kanban-lanes is-${mode}` });
      group.lanes.forEach((lane) => {
        this.renderLane(lanes, project, lane);
      });
    });
    }

    const resizeHandle = board.createDiv({ cls: "dash-kanban-board-resizer" });
    resizeHandle.createSpan({ text: "Drag to resize board height" });
    this.bindProjectResize(resizeHandle, board, project);
  }

  private renderLane(parent: HTMLElement, project: DashKanbanProjectBoard, lane: DashKanbanProjectBoard["lanes"][number], options: { extraClass?: string; showTitle?: boolean } = {}): void {
    const extraClass = options.extraClass ?? "";
    const showTitle = options.showTitle ?? true;
    const hasSelectedCardInLane = Boolean(this.selectedCardKey
      && this.selectedCardKey.projectName === project.projectName
      && lane.cards.some((candidate) => candidate.taskId === this.selectedCardKey?.taskId));
    const hasSelectedCardElsewhere = Boolean(this.selectedCardKey
      && this.selectedCardKey.projectName === project.projectName
      && !hasSelectedCardInLane);
    const laneBlockedCount = lane.cards.filter((card) => !card.done && card.isBlocked).length;
    const laneDueCount = lane.cards.filter((card) => !card.done && (card.isDueSoon || card.isOverdue)).length;
    const laneOverdueCount = lane.cards.filter((card) => !card.done && card.isOverdue).length;
    const laneCardCount = lane.cards.length;
    const laneEl = parent.createDiv({ cls: `dash-kanban-lane${lane.done ? " is-done" : ""}${hasSelectedCardInLane ? " is-focused" : ""}${hasSelectedCardElsewhere ? " is-muted" : ""}${extraClass ? ` ${extraClass}` : ""}` });
    laneEl.dataset.project = project.projectName;
    laneEl.dataset.section = lane.targetSection;
    laneEl.dataset.category = toClassSlug(lane.categoryLabel || lane.categoryTag || lane.label || "lane");
    laneEl.dataset.heat = laneOverdueCount > 0 ? "overdue" : laneBlockedCount > 0 ? "blocked" : laneDueCount > 0 ? "due" : "calm";
    if (lane.categoryColor) {
      laneEl.style.setProperty("--dash-kanban-lane-accent", lane.categoryColor);
    }
    const header = laneEl.createDiv({ cls: `dash-kanban-lane-header${showTitle ? "" : " is-titleless"}` });
    const titleWrap = header.createDiv({ cls: "dash-kanban-lane-title-wrap" });
    if (showTitle) {
      const titleRow = titleWrap.createDiv({ cls: "dash-kanban-lane-title-row" });
      const titleButton = titleRow.createEl("button", { cls: "dash-kanban-lane-title", text: lane.label });
      titleButton.type = "button";
      titleButton.title = `Rename ${lane.label}`;
      titleButton.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        this.activateLaneRename(titleButton, project, lane);
      });
      titleButton.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.activateLaneRename(titleButton, project, lane);
      });
      const renameButton = titleRow.createEl("button", { cls: "dash-kanban-lane-edit", attr: { "aria-label": `Rename ${lane.label}` } });
      renameButton.type = "button";
      renameButton.title = `Rename ${lane.label}`;
      setIcon(renameButton, "pencil");
      renameButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.activateLaneRename(titleButton, project, lane);
      });
      if (lane.helperText) {
        titleWrap.createEl("p", { cls: "dash-kanban-lane-helper", text: lane.helperText });
      }
    }
    const laneTools = header.createDiv({ cls: "dash-kanban-lane-tools" });
    if (!showTitle) {
      const headerSummary = [lane.label.trim(), lane.helperText.trim()].filter((value) => value.length > 0).join(" - ");
      if (headerSummary) {
        header.title = headerSummary;
      }
    }
    const addButton = laneTools.createEl("button", { cls: "dash-kanban-card-action dash-kanban-lane-add", attr: { "aria-label": `Add card to ${lane.label}` } });
    addButton.type = "button";
    setIcon(addButton, "plus");
    addButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.openInlineQuickAdd(project.projectName, lane.laneKey);
    });
    const laneCount = laneTools.createSpan({ cls: "dash-kanban-lane-count", text: `${lane.cardCount}` });
    laneCount.title = `${lane.cardCount} card${lane.cardCount === 1 ? "" : "s"}`;
    if (laneBlockedCount > 0 || laneDueCount > 0) {
      const heat = laneTools.createDiv({ cls: "dash-kanban-lane-heat", attr: { "aria-label": `Lane attention summary for ${lane.label}` } });
      if (laneBlockedCount > 0) {
        const blocked = heat.createSpan({ cls: `dash-kanban-lane-heat-pill${laneBlockedCount > 0 ? " is-blocked" : ""}`, text: `${laneBlockedCount}` });
        blocked.title = `${laneBlockedCount} blocked card${laneBlockedCount === 1 ? "" : "s"}`;
      }
      if (laneDueCount > 0) {
        const due = heat.createSpan({ cls: `dash-kanban-lane-heat-pill${laneOverdueCount > 0 ? " is-overdue" : " is-due"}`, text: `${laneDueCount}` });
        due.title = laneOverdueCount > 0
          ? `${laneOverdueCount} overdue and ${Math.max(0, laneDueCount - laneOverdueCount)} due-soon card${laneDueCount === 1 ? "" : "s"}`
          : `${laneDueCount} due-soon card${laneDueCount === 1 ? "" : "s"}`;
      }
    }

    if (this.quickAddDraft?.projectName === project.projectName && this.quickAddDraft.laneKey === lane.laneKey) {
      const composer = laneEl.createDiv({ cls: "dash-kanban-quick-add" });
      const input = composer.createEl("textarea", {
        cls: "dash-kanban-quick-add-input",
        attr: { placeholder: `Add a card to ${lane.label}` }
      });
      input.value = this.quickAddDraft.taskText;
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("input", () => {
        if (!this.quickAddDraft) {
          return;
        }
        this.quickAddDraft.taskText = input.value;
        input.style.height = "auto";
        input.style.height = `${Math.max(input.scrollHeight, 42)}px`;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void this.submitInlineQuickAdd();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          this.quickAddDraft = null;
          void this.requestRefresh();
        }
      });
      const composerActions = composer.createDiv({ cls: "dash-kanban-quick-add-actions" });
      composerActions.append(
        this.createInlineEditorButton("Add", () => {
          void this.submitInlineQuickAdd();
        }, true),
        this.createInlineEditorButton("Cancel", () => {
          this.quickAddDraft = null;
          void this.requestRefresh();
        })
      );
      window.setTimeout(() => {
        input.style.height = "auto";
        input.style.height = `${Math.max(input.scrollHeight, 42)}px`;
      }, 0);
      this.queueTextInputFocus(input);
    }

    const cards = laneEl.createDiv({ cls: "dash-kanban-card-stack" });
    cards.dataset.dropLabel = lane.done ? `Drop into ${lane.label}` : `Drop in ${lane.label}`;
    laneEl.addEventListener("dragover", (event) => {
      if (!lane.targetSection || !this.dragCard) {
        return;
      }
      event.preventDefault();
      this.setLaneDropTarget(laneEl);
    });
    laneEl.addEventListener("drop", (event) => {
      event.preventDefault();
      this.clearDragTargets();
      const dragged = this.dragCard;
      this.dragCard = null;
      if (!dragged || !lane.targetSection) {
        return;
      }
      if (dragged.projectName !== project.projectName) {
        void this.plugin.transferKanbanTask(dragged.projectName, project.projectName, dragged.taskId, lane.laneKey);
        return;
      }
      void this.plugin.moveKanbanTask(project.projectName, dragged.taskId, lane.laneKey);
    });

    if (lane.cards.length === 0) {
      const emptyState = cards.createDiv({ cls: "dash-kanban-lane-empty-state" });
      emptyState.createEl("span", { cls: "dash-kanban-lane-empty-kicker", text: lane.done ? "Done lane" : "Open stage" });
      emptyState.createEl("strong", { cls: "dash-kanban-lane-empty-title", text: lane.done ? "Nothing finished here yet" : `No cards in ${lane.label}` });
      emptyState.createEl("p", { cls: "dash-kanban-lane-empty", text: lane.done ? "Completed work will collect here when cards are checked off." : "Drop work here or start a card directly inside this stage." });
      if (!lane.done) {
        const emptyIcon = emptyState.createDiv({ cls: "dash-kanban-lane-empty-icon" });
        setIcon(emptyIcon, laneCardCount === 0 ? "plus-square" : "sparkles");
        const emptyAction = emptyState.createEl("button", { cls: "dash-kanban-lane-empty-action", text: `Add card` });
        emptyAction.type = "button";
        emptyAction.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        emptyAction.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openInlineQuickAdd(project.projectName, lane.laneKey);
        });
      }
      return;
    }

    lane.cards.forEach((card) => {
      cards.append(this.renderCard(project, lane, card));
    });
  }

  private renderCard(project: DashKanbanProjectBoard, lane: DashKanbanProjectBoard["lanes"][number], card: DashKanbanCard): HTMLElement {
    const cardEl = document.createElement("article");
    const isSelected = this.matchesCardKey(this.selectedCardKey, project.projectName, card.taskId);
    const resolvedPriority = card.priority;
    const resolvedDueDate = card.dueDate;
    const resolvedEffort = card.effort;
    const photoPaths = card.photoPaths;
    const activePhotoIndex = this.getPhotoCardIndex(project.projectName, card.taskId, photoPaths.length);
    const activePhotoPath = photoPaths[activePhotoIndex] || "";
    const activePhotoUrl = activePhotoPath ? this.plugin.getKanbanTaskPhotoResourcePath(activePhotoPath) : "";
    const photosCollapsed = this.isPhotoCardCollapsed(project.projectName, card.taskId);
    const priorityTone = getKanbanPriorityTone(resolvedPriority);
    const cardIndex = lane.cards.findIndex((candidate) => candidate.taskId === card.taskId);
    const preferPopoverBelow = cardIndex >= 0 && cardIndex < 2;
    const blockedSummary = (card.blockedReason ?? "").replace(/\s+/g, " ").trim();
    const blockedLabel = blockedSummary.length > 34
      ? `${blockedSummary.slice(0, 31).trimEnd()}...`
      : blockedSummary || "Needs unblock";
    cardEl.className = `dash-kanban-card${card.done ? " is-done" : ""}${card.isOverdue ? " is-overdue" : ""}${card.isBlocked ? " is-blocked" : ""}${card.isDueSoon ? " is-due-soon" : ""}${isSelected ? " is-selected" : ""}`;
    cardEl.dataset.priority = priorityTone;
    cardEl.draggable = card.taskId.trim().length > 0 && !this.isCardEditing(project.projectName, card.taskId);

    const selectCard = (): void => {
      if (this.matchesCardKey(this.selectedCardKey, project.projectName, card.taskId)) {
        return;
      }
      this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
      this.clearCardPopovers();
      this.detailEditState = null;
      void this.requestRefresh();
    };

    const editCard = (): void => {
      this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
      this.clearCardPopovers();
      this.syncDetailEditState(project, card);
      void this.requestRefresh();
    };

    cardEl.addEventListener("click", () => {
      if (Date.now() < this.suppressCardClickUntil) {
        return;
      }
      selectCard();
    });
    cardEl.addEventListener("dragstart", (event) => {
      this.suppressCardClickUntil = Date.now() + 250;
      this.clearDragTargets();
      this.dragCard = { projectName: project.projectName, taskId: card.taskId, laneKey: lane.laneKey };
      cardEl.addClass("is-dragging");
      event.dataTransfer?.setData("text/plain", `${project.projectName}:${card.taskId}`);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });
    cardEl.addEventListener("dragend", () => {
      this.dragCard = null;
      this.suppressCardClickUntil = Date.now() + 250;
      this.clearDragTargets();
      cardEl.removeClass("is-photo-drop-target");
      cardEl.removeClass("is-dragging");
    });
    cardEl.addEventListener("dragover", (event) => {
      const droppedImages = this.getImageFilesFromDataTransfer(event.dataTransfer);
      if (droppedImages.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        cardEl.addClass("is-photo-drop-target");
        return;
      }

      cardEl.removeClass("is-photo-drop-target");
      if (!this.dragCard || this.dragCard.projectName !== project.projectName || this.dragCard.laneKey !== lane.laneKey) {
        return;
      }
      if (!this.canReorderCardWithinLane(lane, this.dragCard.taskId, card)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.setCardDropTarget(cardEl);
    });
    cardEl.addEventListener("dragleave", (event) => {
      if (!cardEl.contains(event.relatedTarget as Node | null)) {
        cardEl.removeClass("is-photo-drop-target");
      }
    });
    cardEl.addEventListener("drop", (event) => {
      const droppedImages = this.getImageFilesFromDataTransfer(event.dataTransfer);
      cardEl.removeClass("is-photo-drop-target");
      if (droppedImages.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        void this.attachImageFilesToCard(project.projectName, card.taskId, droppedImages).then((attachedCount) => {
          if (attachedCount > 0) {
            new Notice(`Attached ${attachedCount} image${attachedCount === 1 ? "" : "s"} to the card.`);
          }
        });
        return;
      }

      if (!this.dragCard || this.dragCard.projectName !== project.projectName || this.dragCard.laneKey !== lane.laneKey) {
        return;
      }
      if (!this.canReorderCardWithinLane(lane, this.dragCard.taskId, card)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const dragged = this.dragCard;
      this.dragCard = null;
      this.clearDragTargets();
      void this.reorderCardWithinLane(project, lane, dragged.taskId, card.taskId);
    });

    const top = document.createElement("div");
    top.className = "dash-kanban-card-top";
    if (card.assignee) {
      const assignee = document.createElement("span");
      assignee.className = "dash-kanban-card-assignee";
      assignee.textContent = card.assignee.slice(0, 2).toUpperCase();
      top.appendChild(assignee);
    }

    const toneRow = document.createElement("div");
    toneRow.className = "dash-kanban-card-tones";
    top.appendChild(toneRow);
    if (card.done) {
      createSemanticChip(toneRow, "Done", "done");
    } else {
      if (card.isOverdue) {
        createSemanticChip(toneRow, "Overdue", "alert");
      } else if (card.isDueSoon) {
        createSemanticChip(toneRow, "Due soon", "capture");
      }
      if (card.isBlocked) {
        createSemanticChip(toneRow, "Blocked", "alert");
      }
    }
    if (toneRow.childElementCount > 0) {
      top.appendChild(toneRow);
    }
    if (top.childElementCount > 0) {
      cardEl.appendChild(top);
    }

    const body = document.createElement("div");
    body.className = "dash-kanban-card-body";
    cardEl.appendChild(body);

    if (isSelected && this.isCardEditing(project.projectName, card.taskId) && this.detailEditState) {
      const editor = document.createElement("div");
      editor.className = "dash-kanban-inline-editor is-card-editor";
      body.appendChild(editor);

      const textArea = document.createElement("textarea");
      textArea.className = "dash-kanban-inline-textarea dash-kanban-card-editor-text";
      textArea.value = this.detailEditState.taskText;
      textArea.addEventListener("click", (event) => event.stopPropagation());
      textArea.addEventListener("input", () => {
        if (!this.detailEditState) {
          return;
        }
        this.detailEditState.taskText = textArea.value;
        textArea.style.height = "auto";
        textArea.style.height = `${Math.max(textArea.scrollHeight, 68)}px`;
      });
      textArea.addEventListener("paste", (event) => {
        void this.handleCardImagePaste(event, project.projectName, card.taskId);
      });
      editor.appendChild(textArea);

      editor.createEl("p", {
        cls: "dash-kanban-card-editor-hint",
        text: "Paste an image here or drop one anywhere on the card to attach it."
      });

      if (card.notePreview) {
        const note = document.createElement("p");
        note.className = "dash-kanban-card-note";
        note.textContent = card.notePreview;
        editor.appendChild(note);
      }

      const editorActions = document.createElement("div");
      editorActions.className = "dash-kanban-quick-add-actions";
      editor.appendChild(editorActions);
      editorActions.append(
        this.createInlineEditorButton("Save", () => {
          void this.saveCardDraft(project, card);
        }, true),
        this.createInlineEditorButton("Reset", () => {
          this.detailEditState = {
            projectName: project.projectName,
            taskId: card.taskId,
            taskText: card.text,
            lane: card.laneKey,
            priority: card.priority,
            dueDate: card.dueDate,
            blockedReason: card.blockedReason,
            effort: card.effort,
            executionContext: card.executionContext
          };
          this.clearCardPopovers();
          void this.requestRefresh();
        }),
        this.createInlineEditorButton("Close", () => {
          this.closeInlineCardEditor();
          void this.requestRefresh();
        })
      );

      window.setTimeout(() => {
        textArea.focus();
        textArea.style.height = "auto";
        textArea.style.height = `${Math.max(textArea.scrollHeight, 68)}px`;
      }, 0);
    } else {
      const content = document.createElement("div");
      content.className = "dash-kanban-card-content";
      content.addEventListener("click", (event) => {
        event.stopPropagation();
        editCard();
      });

      const title = document.createElement("h4");
      title.className = "dash-kanban-card-title";
      title.textContent = card.text;
      content.appendChild(title);

      if (card.notePreview) {
        const note = document.createElement("p");
        note.className = "dash-kanban-card-note";
        note.textContent = card.notePreview;
        content.appendChild(note);
      }

      const statusRow = document.createElement("div");
      statusRow.className = "dash-kanban-card-status-row";
      if (!card.done && resolvedDueDate) {
        this.appendCardLabel(statusRow, card.isOverdue ? "Overdue" : "Due", resolvedDueDate, "due", card.isOverdue ? "overdue" : card.isDueSoon ? "due-soon" : "");
      }
      if (!card.done && resolvedEffort) {
        this.appendCardLabel(statusRow, "Effort", resolvedEffort, "effort");
      }
      if (!card.done && card.isBlocked) {
        this.appendCardLabel(statusRow, "Blocked", blockedLabel, "blocked");
      }
      if (statusRow.childElementCount > 0) {
        content.appendChild(statusRow);
      }

      body.appendChild(content);
    }

    if (activePhotoUrl) {
      const media = document.createElement("div");
      media.className = "dash-kanban-card-media";
      const gallery = document.createElement("div");
      gallery.className = `dash-kanban-card-photo-strip${photosCollapsed ? " is-collapsed" : ""}${photoPaths.length > 1 ? " has-multiple" : ""}`;

      if (photosCollapsed) {
        const compactButton = document.createElement("button");
        compactButton.className = "dash-kanban-card-photo-compact";
        compactButton.type = "button";
        compactButton.ariaLabel = photoPaths.length > 1
          ? `Expand ${photoPaths.length} attached images`
          : "Expand attached image";
        compactButton.title = photoPaths.length > 1
          ? `Expand ${photoPaths.length} attached images`
          : "Expand attached image";
        compactButton.addEventListener("click", (event) => {
          event.stopPropagation();
          this.togglePhotoCardCollapsed(project.projectName, card.taskId);
        });

        photoPaths.slice(0, 3).forEach((path, index) => {
          const thumbUrl = this.plugin.getKanbanTaskPhotoResourcePath(path);
          const thumb = document.createElement("span");
          thumb.className = `dash-kanban-card-photo-compact-thumb${index === activePhotoIndex ? " is-active" : ""}`;
          if (thumbUrl) {
            const image = document.createElement("img");
            image.src = thumbUrl;
            image.alt = path;
            thumb.appendChild(image);
          } else {
            setIcon(thumb, "image");
          }
          compactButton.appendChild(thumb);
        });

        const compactMeta = compactButton.createSpan({ cls: "dash-kanban-card-photo-compact-meta" });
        compactMeta.createEl("strong", { text: `${photoPaths.length}` });
        compactMeta.createEl("span", { text: photoPaths.length === 1 ? "image" : "images" });
        compactButton.addEventListener("contextmenu", (event) => {
          event.preventDefault();
        });
        gallery.appendChild(compactButton);
      } else {
        const previewShell = document.createElement("div");
        previewShell.className = "dash-kanban-card-photo-shell";
        const previewButton = document.createElement("button");
        previewButton.className = "dash-kanban-card-photo-preview";
        previewButton.type = "button";
        previewButton.ariaLabel = photoPaths.length > 1 ? `Open image ${activePhotoIndex + 1} of ${photoPaths.length}` : "Open attached photo";
        previewButton.title = photoPaths.length > 1 ? `Open image ${activePhotoIndex + 1} of ${photoPaths.length}` : "Open attached photo";
        previewButton.addEventListener("click", (event) => {
          event.stopPropagation();
          this.openKanbanPhoto(activePhotoPath);
        });
        const previewImage = document.createElement("img");
        previewImage.className = "dash-kanban-card-photo-image";
        previewImage.src = activePhotoUrl;
        previewImage.alt = `${card.text} photo ${activePhotoIndex + 1}`;
        previewImage.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.copyKanbanPhotoToClipboard(activePhotoPath);
        });
        previewButton.appendChild(previewImage);
        const openHint = previewButton.createSpan({ cls: "dash-kanban-card-photo-open-hint" });
        openHint.ariaHidden = "true";
        setIcon(openHint, "expand");

        const collapseHint = previewButton.createEl("button", { cls: "dash-kanban-card-photo-collapse-hint" });
        collapseHint.type = "button";
        collapseHint.ariaLabel = "Collapse photo previews";
        collapseHint.title = "Collapse photo previews";
        setIcon(collapseHint, "panel-top-close");

        collapseHint.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.togglePhotoCardCollapsed(project.projectName, card.taskId);
        });

        const status = previewButton.createSpan({ cls: "dash-kanban-card-photo-status" });
        status.createEl("strong", { text: `${activePhotoIndex + 1}/${photoPaths.length}` });
        if (photoPaths.length > 1) {
          status.createEl("span", { text: "Use arrows" });
        }

        previewShell.appendChild(previewButton);

        if (photoPaths.length > 1) {
          const previousButton = document.createElement("button");
          previousButton.className = "dash-kanban-card-photo-nav is-previous";
          previousButton.type = "button";
          previousButton.ariaLabel = "Show previous image";
          previousButton.title = "Show previous image";
          previousButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.cyclePhotoCard(project.projectName, card.taskId, photoPaths.length, -1);
          });
          setIcon(previousButton, "chevron-left");
          previewShell.appendChild(previousButton);

          const nextButton = document.createElement("button");
          nextButton.className = "dash-kanban-card-photo-nav is-next";
          nextButton.type = "button";
          nextButton.ariaLabel = "Show next image";
          nextButton.title = "Show next image";
          nextButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.cyclePhotoCard(project.projectName, card.taskId, photoPaths.length, 1);
          });
          setIcon(nextButton, "chevron-right");
          previewShell.appendChild(nextButton);
        }

        gallery.appendChild(previewShell);

      }

      media.appendChild(gallery);
      body.appendChild(media);
    }

    const metaRow = document.createElement("div");
    metaRow.className = "dash-kanban-card-meta";
    if (card.energy) {
      createSemanticChip(metaRow, `Energy ${card.energy}`, "health");
    }
    if (card.trigger) {
      createSemanticChip(metaRow, `Trigger ${card.trigger}`, "capture");
    }
    card.tags.forEach((tag) => {
      createSemanticChip(metaRow, `#${tag}`, "neutral");
    });
    if (metaRow.childElementCount > 0) {
      body.appendChild(metaRow);
    }

    if (card.done) {
      const resolution = document.createElement("div");
      resolution.className = "dash-kanban-card-resolution";
      const resolutionLabel = document.createElement("strong");
      resolutionLabel.className = "dash-kanban-card-resolution-label";
      resolutionLabel.textContent = "Completed";
      resolution.appendChild(resolutionLabel);
      if (card.completedAt) {
        const resolutionValue = document.createElement("span");
        resolutionValue.className = "dash-kanban-card-resolution-value";
        resolutionValue.textContent = card.completedAt;
        resolution.appendChild(resolutionValue);
      }
      body.appendChild(resolution);
    }

    const footer = document.createElement("div");
    footer.className = "dash-kanban-card-footer";
    body.appendChild(footer);
    const footerInfo = document.createElement("div");
    footerInfo.className = "dash-kanban-card-footer-info";
    footer.appendChild(footerInfo);
    if (resolvedPriority) {
      this.appendCardFooterPill(footerInfo, "Priority", formatKanbanPriorityLabel(resolvedPriority).replace(/ priority$/i, ""), "priority");
    }
    if (card.assignee) {
      this.appendCardFooterPill(footerInfo, "Owner", `@${card.assignee}`);
    }

    const actionWrap = document.createElement("div");
    actionWrap.className = "dash-kanban-card-footer-tools";
    footer.appendChild(actionWrap);

    const actions = document.createElement("div");
    actions.className = "dash-kanban-card-actions";
    actionWrap.appendChild(actions);
    const priorityButton = this.createCardActionButton("flag", formatKanbanPriorityLabel(resolvedPriority), (event) => {
        event.stopPropagation();
        this.setCardPopoverAnchorPoint("priority", project.projectName, card.taskId, event);
        this.priorityPickerKey = this.priorityPickerKey?.projectName === project.projectName && this.priorityPickerKey.taskId === card.taskId
          ? null
          : { projectName: project.projectName, taskId: card.taskId };
        this.duePickerKey = null;
        this.effortPickerKey = null;
        this.photoPickerKey = null;
        this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
        void this.requestRefresh();
      });
    const dueButton = this.createCardActionButton("calendar", resolvedDueDate ? `${card.isOverdue ? "Overdue" : "Due"} ${resolvedDueDate}` : "Set due date", (event) => {
        event.stopPropagation();
        this.setCardPopoverAnchorPoint("due", project.projectName, card.taskId, event);
        this.duePickerKey = this.duePickerKey?.projectName === project.projectName && this.duePickerKey.taskId === card.taskId
          ? null
          : { projectName: project.projectName, taskId: card.taskId };
        this.priorityPickerKey = null;
        this.effortPickerKey = null;
        this.photoPickerKey = null;
        this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
        void this.requestRefresh();
      });
    const effortButton = this.createCardActionButton("timer", resolvedEffort ? `Effort ${resolvedEffort}` : "Set effort", (event) => {
        event.stopPropagation();
        this.setCardPopoverAnchorPoint("effort", project.projectName, card.taskId, event);
        this.effortPickerKey = this.effortPickerKey?.projectName === project.projectName && this.effortPickerKey.taskId === card.taskId
          ? null
          : { projectName: project.projectName, taskId: card.taskId };
        this.priorityPickerKey = null;
        this.duePickerKey = null;
        this.photoPickerKey = null;
        this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
        void this.requestRefresh();
      });
    const photoButton = this.createCardActionButton("image", photoPaths.length > 0 ? `Manage photos (${photoPaths.length})` : "Attach photos", (event) => {
        event.stopPropagation();
        this.setCardPopoverAnchorPoint("photo", project.projectName, card.taskId, event);
        this.photoPickerKey = this.photoPickerKey?.projectName === project.projectName && this.photoPickerKey.taskId === card.taskId
          ? null
          : { projectName: project.projectName, taskId: card.taskId };
        this.priorityPickerKey = null;
        this.duePickerKey = null;
        this.effortPickerKey = null;
        this.selectedCardKey = { projectName: project.projectName, taskId: card.taskId };
        void this.requestRefresh();
      });
    const completeButton = this.createCardActionButton("check", "Complete card", (event) => {
        event.stopPropagation();
        void this.plugin.completeKanbanTask(project.projectName, card.taskId);
      });
    const deleteButton = this.createCardActionButton("trash-2", "Delete card", (event) => {
        event.stopPropagation();
        const confirmed = window.confirm(`Delete "${card.text}" from ${project.projectName}?`);
        if (!confirmed) {
          return;
        }
        if (this.selectedCardKey?.projectName === project.projectName && this.selectedCardKey?.taskId === card.taskId) {
          this.selectedCardKey = null;
        }
        this.clearCardPopovers();
        this.detailEditState = null;
        void this.plugin.deleteKanbanTask(project.projectName, card.taskId);
      });
    const actionButtons = [priorityButton, dueButton, effortButton, photoButton];
    if (!card.done) {
      actionButtons.push(completeButton);
    }
    actionButtons.push(deleteButton);
    actions.append(...actionButtons);

    if (this.matchesCardKey(this.priorityPickerKey, project.projectName, card.taskId)) {
      const picker = document.createElement("div");
      picker.className = `dash-kanban-card-popover dash-kanban-priority-picker${preferPopoverBelow ? " is-below" : ""}`;
      picker.addEventListener("click", (event) => event.stopPropagation());
      KANBAN_PRIORITY_OPTIONS.forEach(({ value, label }) => {
        const button = document.createElement("button");
        button.className = `dash-kanban-priority-option${(this.detailEditState?.projectName === project.projectName && this.detailEditState?.taskId === card.taskId ? this.detailEditState.priority : resolvedPriority) === value ? " is-active" : ""}`;
        button.type = "button";
        button.dataset.priority = value || "none";
        button.textContent = label;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          void this.saveCardDraft(project, card, { priority: value }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        });
        picker.appendChild(button);
      });
      this.mountCardPopover(picker);
      this.positionCardPopover(picker, priorityButton, preferPopoverBelow, this.getCardPopoverAnchorPoint("priority", project.projectName, card.taskId));
    }

    if (this.matchesCardKey(this.duePickerKey, project.projectName, card.taskId)) {
      const picker = document.createElement("div");
      picker.className = `dash-kanban-card-popover dash-kanban-meta-popover dash-kanban-due-popover${preferPopoverBelow ? " is-below" : ""}`;
      picker.addEventListener("click", (event) => event.stopPropagation());
      const label = document.createElement("span");
      label.className = "dash-kanban-detail-label";
      label.textContent = "Due";
      picker.appendChild(label);
      const helper = document.createElement("p");
      helper.className = "dash-kanban-due-helper";
      helper.textContent = "Date is required. Time is optional.";
      picker.appendChild(helper);
      const initialValue = this.isCardEditing(project.projectName, card.taskId) && this.detailEditState ? this.detailEditState.dueDate : resolvedDueDate;
      const dueParts = parseKanbanDueDateDraft(initialValue);
      const fields: HTMLInputElement[] = [];
      const fieldRow = document.createElement("div");
      fieldRow.className = "dash-kanban-due-fields";
      picker.appendChild(fieldRow);

      const dateGroup = document.createElement("div");
      dateGroup.className = "dash-kanban-due-group is-date";
      fieldRow.appendChild(dateGroup);

      const timeGroup = document.createElement("div");
      timeGroup.className = "dash-kanban-due-group is-time";
      fieldRow.appendChild(timeGroup);

      const canSaveDueDate = () => isKanbanDueDateComplete(dueParts) && (!hasKanbanDueTimeValue(dueParts) || isKanbanDueTimeComplete(dueParts));

      const syncSaveState = (saveButton: HTMLButtonElement) => {
        saveButton.disabled = !canSaveDueDate();
      };

      const focusFieldAt = (index: number) => {
        const target = fields[index];
        if (!target) {
          return;
        }
        window.setTimeout(() => {
          target.focus();
          target.select();
        }, 0);
      };

      const bindSegmentField = (
        input: HTMLInputElement,
        key: keyof Pick<KanbanDueDateDraftParts, "month" | "day" | "year" | "hour" | "minute">,
        maxLength: number,
        fieldIndex: number,
        nextIndex?: number,
        previousIndex?: number
      ) => {
        fields[fieldIndex] = input;
        input.addEventListener("input", () => {
          const sanitized = input.value.replace(/\D/g, "").slice(0, maxLength);
          if (input.value !== sanitized) {
            input.value = sanitized;
          }
          dueParts[key] = sanitized;
          syncSaveState(saveButton);
          if (sanitized.length === maxLength && typeof nextIndex === "number") {
            focusFieldAt(nextIndex);
          }
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0 && input.value.length === 0 && typeof previousIndex === "number") {
            event.preventDefault();
            focusFieldAt(previousIndex);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (canSaveDueDate()) {
              void this.saveCardDraft(project, card, { dueDate: formatKanbanDueDateDraft(dueParts) }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
            }
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            this.duePickerKey = null;
            void this.requestRefresh();
          }
        });
      };

      const monthInput = document.createElement("input");
      monthInput.className = "dash-kanban-popover-input dash-kanban-due-input is-month";
      monthInput.type = "text";
      monthInput.placeholder = "MM";
      monthInput.inputMode = "numeric";
      monthInput.maxLength = 2;
      monthInput.value = dueParts.month;
      dateGroup.appendChild(monthInput);
      dateGroup.appendChild(this.createDueSeparator());

      const dayInput = document.createElement("input");
      dayInput.className = "dash-kanban-popover-input dash-kanban-due-input is-day";
      dayInput.type = "text";
      dayInput.placeholder = "DD";
      dayInput.inputMode = "numeric";
      dayInput.maxLength = 2;
      dayInput.value = dueParts.day;
      dateGroup.appendChild(dayInput);
      dateGroup.appendChild(this.createDueSeparator());

      const yearInput = document.createElement("input");
      yearInput.className = "dash-kanban-popover-input dash-kanban-due-input is-year";
      yearInput.type = "text";
      yearInput.placeholder = "YYYY";
      yearInput.inputMode = "numeric";
      yearInput.maxLength = 4;
      yearInput.value = dueParts.year;
      dateGroup.appendChild(yearInput);

      const timeLabel = document.createElement("span");
      timeLabel.className = "dash-kanban-due-time-label";
      timeLabel.textContent = "Optional";
      timeGroup.appendChild(timeLabel);

      const hourInput = document.createElement("input");
      hourInput.className = "dash-kanban-popover-input dash-kanban-due-input is-hour";
      hourInput.type = "text";
      hourInput.placeholder = "HH";
      hourInput.inputMode = "numeric";
      hourInput.maxLength = 2;
      hourInput.value = dueParts.hour;
      timeGroup.appendChild(hourInput);
      timeGroup.appendChild(this.createDueSeparator(":"));

      const minuteInput = document.createElement("input");
      minuteInput.className = "dash-kanban-popover-input dash-kanban-due-input is-minute";
      minuteInput.type = "text";
      minuteInput.placeholder = "MM";
      minuteInput.inputMode = "numeric";
      minuteInput.maxLength = 2;
      minuteInput.value = dueParts.minute;
      timeGroup.appendChild(minuteInput);

      const meridiemSelect = document.createElement("select");
      meridiemSelect.className = "dash-kanban-due-meridiem";
      meridiemSelect.append(
        new Option("AM", "AM"),
        new Option("PM", "PM")
      );
      meridiemSelect.value = dueParts.meridiem;
      meridiemSelect.addEventListener("change", () => {
        dueParts.meridiem = meridiemSelect.value === "PM" ? "PM" : "AM";
      });
      meridiemSelect.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (canSaveDueDate()) {
            void this.saveCardDraft(project, card, { dueDate: formatKanbanDueDateDraft(dueParts) }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          this.duePickerKey = null;
          void this.requestRefresh();
        }
      });
      timeGroup.appendChild(meridiemSelect);

      const pickerActions = document.createElement("div");
      pickerActions.className = "dash-kanban-popover-actions";
      picker.appendChild(pickerActions);
      const saveButton = this.createInlineEditorButton("Save", () => {
        if (!canSaveDueDate()) {
          return;
        }
        void this.saveCardDraft(project, card, { dueDate: formatKanbanDueDateDraft(dueParts) }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
      }, true);
      pickerActions.append(
        saveButton,
        this.createInlineEditorButton("Clear", () => {
          void this.saveCardDraft(project, card, { dueDate: "" }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        })
      );
      bindSegmentField(monthInput, "month", 2, 0, 1);
      bindSegmentField(dayInput, "day", 2, 1, 2, 0);
      bindSegmentField(yearInput, "year", 4, 2, 3, 1);
      bindSegmentField(hourInput, "hour", 2, 3, 4, 2);
      bindSegmentField(minuteInput, "minute", 2, 4, undefined, 3);
      syncSaveState(saveButton);
      this.mountCardPopover(picker);
      this.positionCardPopover(picker, dueButton, preferPopoverBelow, this.getCardPopoverAnchorPoint("due", project.projectName, card.taskId));
      focusFieldAt(hasKanbanDueDateDateValue(dueParts) ? (dueParts.month.length >= 2 ? (dueParts.day.length >= 2 ? (dueParts.year.length >= 4 ? 3 : 2) : 1) : 0) : 0);
    }

    if (this.matchesCardKey(this.effortPickerKey, project.projectName, card.taskId)) {
      const picker = document.createElement("div");
      picker.className = `dash-kanban-card-popover dash-kanban-meta-popover${preferPopoverBelow ? " is-below" : ""}`;
      picker.addEventListener("click", (event) => event.stopPropagation());
      const label = document.createElement("span");
      label.className = "dash-kanban-detail-label";
      label.textContent = "Effort";
      picker.appendChild(label);
      const options = document.createElement("div");
      options.className = "dash-kanban-effort-options";
      KANBAN_EFFORT_OPTIONS.forEach((value) => {
        options.appendChild(this.createPopoverOptionButton(value, () => {
          void this.saveCardDraft(project, card, { effort: value }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        }));
      });
      picker.appendChild(options);
      const input = document.createElement("input");
      input.className = "dash-kanban-popover-input";
      input.type = "text";
      input.placeholder = "15m, 1h, 2h";
      input.value = this.isCardEditing(project.projectName, card.taskId) && this.detailEditState ? this.detailEditState.effort : resolvedEffort;
      picker.appendChild(input);
      const pickerActions = document.createElement("div");
      pickerActions.className = "dash-kanban-popover-actions";
      picker.appendChild(pickerActions);
      pickerActions.append(
        this.createInlineEditorButton("Save", () => {
          void this.saveCardDraft(project, card, { effort: input.value.trim() }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        }, true),
        this.createInlineEditorButton("Clear", () => {
          void this.saveCardDraft(project, card, { effort: "" }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        })
      );
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.saveCardDraft(project, card, { effort: input.value.trim() }, { preserveEditState: this.isCardEditing(project.projectName, card.taskId) });
        }
        if (event.key === "Escape") {
          event.preventDefault();
          this.effortPickerKey = null;
          void this.requestRefresh();
        }
      });
      this.mountCardPopover(picker);
      this.positionCardPopover(picker, effortButton, preferPopoverBelow, this.getCardPopoverAnchorPoint("effort", project.projectName, card.taskId));
      window.setTimeout(() => input.focus(), 0);
    }

    if (this.matchesCardKey(this.photoPickerKey, project.projectName, card.taskId)) {
      const picker = document.createElement("div");
      picker.className = `dash-kanban-card-popover dash-kanban-photo-popover${preferPopoverBelow ? " is-below" : ""}`;
      picker.addEventListener("click", (event) => event.stopPropagation());

      const label = document.createElement("span");
      label.className = "dash-kanban-detail-label";
      label.textContent = "Photos";
      picker.appendChild(label);

      const photoList = document.createElement("div");
      photoList.className = "dash-kanban-photo-list";
      picker.appendChild(photoList);

      if (photoPaths.length === 0) {
        photoList.createEl("p", { cls: "dash-kanban-photo-empty", text: "No photos attached yet." });
      } else {
        photoPaths.forEach((path) => {
          const resourcePath = this.plugin.getKanbanTaskPhotoResourcePath(path);
          const fileName = path.split("/").pop() || path;
          const item = photoList.createDiv({ cls: "dash-kanban-photo-item" });
          const thumbButton = item.createEl("button", { cls: "dash-kanban-photo-thumb-button" });
          thumbButton.type = "button";
          thumbButton.title = path;
          thumbButton.ariaLabel = `Open ${fileName}`;
          thumbButton.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          thumbButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openKanbanPhoto(path);
          });
          if (resourcePath) {
            const image = document.createElement("img");
            image.className = "dash-kanban-photo-thumb";
            image.src = resourcePath;
            image.alt = path;
            image.addEventListener("contextmenu", (event) => {
              event.preventDefault();
              event.stopPropagation();
              void this.copyKanbanPhotoToClipboard(path);
            });
            thumbButton.appendChild(image);
          } else {
            setIcon(thumbButton, "image");
          }

          const detailsButton = item.createEl("button", { cls: "dash-kanban-photo-name-button" });
          detailsButton.type = "button";
          detailsButton.title = path;
          detailsButton.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          detailsButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openKanbanPhoto(path);
          });
          detailsButton.createEl("span", { cls: "dash-kanban-photo-name", text: fileName });
          detailsButton.createEl("span", { cls: "dash-kanban-photo-meta", text: "Open image" });

          const removeButton = item.createEl("button", { cls: "dash-kanban-photo-remove", text: "Remove" });
          removeButton.type = "button";
          removeButton.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          removeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            removeButton.disabled = true;
            item.addClass("is-removing");
            void this.removePhotoFromCard(project.projectName, card.taskId, path).finally(() => {
              if (!item.isConnected) {
                return;
              }

              removeButton.disabled = false;
              item.removeClass("is-removing");
            });
          });
        });
      }

      const pickerActions = document.createElement("div");
      pickerActions.className = "dash-kanban-popover-actions";
      picker.appendChild(pickerActions);
      pickerActions.append(
        this.createInlineEditorButton("Upload", () => {
          void this.uploadPhotoForCard(project.projectName, card.taskId);
        }, true),
        this.createInlineEditorButton("Link vault image", () => {
          void this.attachExistingPhotoToCard(project.projectName, card.taskId);
        })
      );

      this.mountCardPopover(picker);
      this.positionCardPopover(picker, photoButton, preferPopoverBelow, this.getCardPopoverAnchorPoint("photo", project.projectName, card.taskId));
    }

    return cardEl;
  }

  private createHeaderButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "dash-kanban-header-button";
    button.type = "button";
    const iconEl = document.createElement("span");
    iconEl.className = "dash-kanban-button-icon";
    button.appendChild(iconEl);
    setIcon(iconEl, icon);
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    button.appendChild(labelEl);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", onClick);
    return button;
  }

  private createCardActionButton(icon: string, label: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "dash-kanban-card-action";
    button.type = "button";
    button.ariaLabel = label;
    button.title = label;
    setIcon(button, icon);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", onClick);
    return button;
  }

  private openKanbanPhoto(path: string): void {
    void this.plugin.openKanbanTaskPhoto(path);
  }

  private async copyKanbanPhotoToClipboard(path: string): Promise<void> {
    const resourcePath = this.plugin.getKanbanTaskPhotoResourcePath(path);
    const clipboardApi = navigator.clipboard as Clipboard & { write?: (data: ClipboardItem[]) => Promise<void> };
    if (!resourcePath || typeof clipboardApi?.write !== "function" || typeof ClipboardItem === "undefined") {
      new Notice("Image copy is not supported in this environment.");
      return;
    }

    try {
      const response = await fetch(resourcePath);
      const blob = await response.blob();
      await clipboardApi.write([
        new ClipboardItem({
          [blob.type || "image/png"]: blob
        })
      ]);
      new Notice("Image copied to clipboard.");
    } catch (error) {
      console.warn("DASH Kanban could not copy image to clipboard", error);
      new Notice("Could not copy that image to the clipboard.");
    }
  }

  private isSupportedKanbanImageFile(file: File | null | undefined): file is File {
    if (!file) {
      return false;
    }

    const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
    return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(extension);
  }

  private getImageFilesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
    if (!dataTransfer) {
      return [];
    }

    return Array.from(dataTransfer.files).filter((file) => this.isSupportedKanbanImageFile(file));
  }

  private getImageFilesFromClipboard(dataTransfer: DataTransfer | null): File[] {
    if (!dataTransfer) {
      return [];
    }

    const files = Array.from(dataTransfer.items)
      .map((item) => item.kind === "file" ? item.getAsFile() : null)
      .filter((file): file is File => this.isSupportedKanbanImageFile(file));

    return files.length > 0 ? files : this.getImageFilesFromDataTransfer(dataTransfer);
  }

  private async attachImageFilesToCard(projectName: string, taskId: string, files: Iterable<File>): Promise<number> {
    const imageFiles = Array.from(files).filter((file) => this.isSupportedKanbanImageFile(file));
    if (imageFiles.length === 0) {
      return 0;
    }

    const payload = await Promise.all(imageFiles.map(async (file) => ({
      originalFileName: file.name,
      bytes: await file.arrayBuffer()
    })));
    const attachedCount = (await this.plugin.uploadMultipleKanbanTaskPhotos(projectName, taskId, payload)).length;

    if (attachedCount > 0) {
      await this.requestRefresh();
    }
    return attachedCount;
  }

  private async handleCardImagePaste(event: ClipboardEvent, projectName: string, taskId: string): Promise<void> {
    const files = this.getImageFilesFromClipboard(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const attachedCount = await this.attachImageFilesToCard(projectName, taskId, files);
    if (attachedCount > 0) {
      new Notice(`Attached ${attachedCount} image${attachedCount === 1 ? "" : "s"} to the card.`);
    }
  }

  private async attachExistingPhotoToCard(projectName: string, taskId: string): Promise<void> {
    new KanbanVaultImagePickerModal(this.app, this.plugin, async (imagePath) => {
      const attached = await this.plugin.attachExistingKanbanTaskPhoto(projectName, taskId, imagePath);
      if (!attached) {
        return;
      }

      await this.requestRefresh();
    }).open();
  }

  private async uploadPhotoForCard(projectName: string, taskId: string): Promise<void> {
    new KanbanPhotoUploadModal(this.app, async (selectedFiles) => {
      const attachedCount = await this.attachImageFilesToCard(projectName, taskId, selectedFiles);
      if (attachedCount > 0) {
        new Notice(`Attached ${attachedCount} image${attachedCount === 1 ? "" : "s"} to the card.`);
      }
    }).open();
  }

  private async removePhotoFromCard(projectName: string, taskId: string, path: string): Promise<void> {
    const removed = await this.plugin.removeKanbanTaskPhoto(projectName, taskId, path);
    if (!removed) {
      return;
    }

    await this.requestRefresh();
    new Notice("Removed image from the card.");
  }

  private createInlineEditorButton(label: string, onClick: () => void, cta = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `dash-kanban-inline-button${cta ? " mod-cta" : ""}`;
    button.type = "button";
    button.textContent = label;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private createPopoverOptionButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "dash-kanban-popover-option";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  private createToggleButton(label: string, active: boolean, onClick: () => Promise<void>): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `dash-kanban-toggle-button${active ? " is-active" : ""}`;
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      void onClick();
    });
    return button;
  }
}

export class AddHabitModal extends Modal {
  private plugin: DailyDashboardPlugin;
  private existingHabit: HabitDefinition | null;
  private habitName = "";
  private targetCount = "1";
  private completionWindow = "anytime";
  private cadence = "daily";
  private difficultyWeight = "1";

  constructor(app: App, plugin: DailyDashboardPlugin, habit?: HabitDefinition) {
    super(app);
    this.plugin = plugin;
    this.existingHabit = habit ?? null;
    if (habit) {
      this.habitName = habit.label;
      this.targetCount = `${habit.target}`;
      this.completionWindow = habit.completionWindow;
      this.cadence = habit.cadence;
      this.difficultyWeight = `${habit.difficultyWeight}`;
    }
  }

  onOpen(): void {
    this.setTitle(this.existingHabit ? "Edit Habit" : "Add Habit");
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName("Habit name")
      .setDesc("Shown in the dashboard and saved in habit definitions.")
      .addText((text) => {
        text
          .setPlaceholder("Drink water")
          .setValue(this.habitName)
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
          if (this.existingHabit) {
            await this.plugin.updateHabitDefinition(this.existingHabit.id, {
              label: this.habitName,
              target: Number(this.targetCount),
              completionWindow: this.completionWindow,
              difficultyWeight: Number(this.difficultyWeight),
              cadence: this.cadence
            });
          } else {
            await this.plugin.addHabitDefinition(this.habitName, Number(this.targetCount), this.completionWindow, Number(this.difficultyWeight), this.cadence);
          }
          this.close();
        });
        button.setButtonText(this.existingHabit ? "Save habit" : "Add habit");
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
  if (normalized === "execution-hub" || normalized === "action-queue") {
    return "top-3-for-today";
  }
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
    if (key === "weekly-agenda" || key === "ai-workspace") {
      return "span 18";
    }
    if (key === "weekly-agenda" || key === "gamification-center" || key === "timeline-search" || key === "heatmaps") {
      return "span 9";
    }
    return "span 6";
  }

  if (key === "weekly-agenda" || key === "ai-workspace") {
    return "1 / -1";
  }

  return "span 6";
}