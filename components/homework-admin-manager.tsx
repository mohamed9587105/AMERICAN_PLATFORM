"use client";
import { richHtml } from "@/lib/sanitize-rich-html";
import Link from "next/link";
import AdminPageHelp from "@/components/admin-page-help";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/rich-text-editor";
import SmartQuestionStudio from "@/components/smart-question-studio";
import ExamQuestionBuilderV615 from "@/components/exam-question-builder-v615";
import {homeworkMediaUploadError} from "@/lib/homework-media-upload-error";
import { readSpreadsheet, loadSpreadsheetEngine } from "@/lib/safe-spreadsheet";
import { universalRowsToQuestions } from "@/lib/universal-question-import";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  HOMEWORK_STORAGE_KEY,
  HOMEWORK_SUBMISSIONS_KEY,
  homeworkCourses,
  modeArabic,
  statusArabic,
  type HomeworkCourse,
  type HomeworkItem,
  type HomeworkMode,
  type HomeworkQuestion,
  type HomeworkStatus,
  type HomeworkSupportType,
  type HomeworkModuleConfig,
  supportArabic,
} from "@/lib/homework";
import { readLargeJson, writeLargeJson } from "@/lib/large-client-storage";
import { reconcileHomeworkDirectory } from "@/lib/homework-directory";
import {ADMIN_SHARED_SYNC_EVENT,type AdminSharedSyncEvent} from "@/lib/admin-shared-sync";
import { sameCourse } from "@/lib/course-isolation";
import {
  homeworkAdminPublications,
  homeworkPublicationId,
  homeworkPublicationMembers,
  updateHomeworkPublication,
} from "@/lib/homework-publications";
import {
  assignmentBankQuestionsForCourse,
  bankQuestionToAssignmentQuestion,
} from "@/lib/question-bank-assignment";

const HOMEWORK_ACTIVE_DRAFT_KEY =
  "american-platform-homework-active-draft-v304";
const HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY =
  "american-platform-homework-active-draft-mirror-v435";
const HOMEWORK_ACTIVE_DRAFT_SESSION_KEY =
  "american-platform-homework-active-draft-session-v435";
const HOMEWORK_V442_JOURNAL_A = "american-platform-homework-v442-journal-a";
const HOMEWORK_V442_JOURNAL_B = "american-platform-homework-v442-journal-b";
const HOMEWORK_V442_JOURNAL_PTR = "american-platform-homework-v442-journal-ptr";
const HOMEWORK_KNOWN_SERVER_IDS_KEY = "american-platform-homework-known-server-ids-v1";
const HOMEWORK_DIRECTORY_PAGE_SIZE = 25;

/** Fetch every page: the server deliberately caps each response to avoid
 * silently hiding older assignments behind the database row limit. */
async function fetchSharedHomeworkDirectory(): Promise<
  { mode: "database" | "local"; items: HomeworkItem[] }
> {
  const items: HomeworkItem[] = [];
  for (let offset = 0; offset < 50000; offset += HOMEWORK_DIRECTORY_PAGE_SIZE) {
    const response = await fetch(`/api/admin/homework-directory?offset=${offset}`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(String(data?.error || `HOMEWORK_DIRECTORY_HTTP_${response.status}`));
    }
    if (data.mode === "local") return { mode: "local", items: [] };
    if (data.mode !== "database" || !Array.isArray(data.items)) {
      throw new Error("INVALID_HOMEWORK_DIRECTORY_RESPONSE");
    }
    items.push(...data.items);
    if (!data.hasMore) return { mode: "database", items };
    if (data.items.length !== HOMEWORK_DIRECTORY_PAGE_SIZE || data.nextOffset !== offset + HOMEWORK_DIRECTORY_PAGE_SIZE) {
      throw new Error("INVALID_HOMEWORK_DIRECTORY_PAGINATION");
    }
  }
  throw new Error("HOMEWORK_DIRECTORY_TOO_LARGE");
}

function readKnownServerHomeworkIds(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(HOMEWORK_KNOWN_SERVER_IDS_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveKnownServerHomeworkIds(ids: ReadonlySet<string>) {
  try { localStorage.setItem(HOMEWORK_KNOWN_SERVER_IDS_KEY, JSON.stringify([...ids])); } catch {}
}
const readV442Journal = () => {
  if (typeof window === "undefined") return null;
  const out: any[] = [];
  for (const key of [HOMEWORK_V442_JOURNAL_A, HOMEWORK_V442_JOURNAL_B]) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      if (v?.homework) out.push(v);
    } catch {}
  }
  return (
    out.sort((a, b) => Number(b?.savedAt || 0) - Number(a?.savedAt || 0))[0] ||
    null
  );
};
const compactHomeworkForEmergency = (hw: HomeworkItem): HomeworkItem => ({
  ...hw,
  questions: (hw.questions || []).map((q) => ({
    ...q,
    supportUrl: q.supportUrl?.startsWith("data:") ? "" : q.supportUrl,
    explanationImageUrl: q.explanationImageUrl?.startsWith("data:")
      ? ""
      : q.explanationImageUrl,
    explanationFileUrl: q.explanationFileUrl?.startsWith("data:")
      ? ""
      : q.explanationFileUrl,
  })),
});
const writeV442Journal = (envelope: any) => {
  if (typeof window === "undefined") return false;
  const current =
    localStorage.getItem(HOMEWORK_V442_JOURNAL_PTR) === "a" ? "a" : "b";
  const next = current === "a" ? "b" : "a";
  const key = next === "a" ? HOMEWORK_V442_JOURNAL_A : HOMEWORK_V442_JOURNAL_B;
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
    localStorage.setItem(HOMEWORK_V442_JOURNAL_PTR, next);
    return true;
  } catch {}
  // If embedded media exhausts browser quota, never lose the module/question structure.
  try {
    const emergency = {
      ...envelope,
      homework: compactHomeworkForEmergency(envelope.homework),
      emergencyCompact: true,
    };
    localStorage.setItem(key, JSON.stringify(emergency));
    localStorage.setItem(HOMEWORK_V442_JOURNAL_PTR, next);
    return true;
  } catch {
    return false;
  }
};
const employees = [
  "team SAT",
  "team EST",
  "team ACT",
  "team Beginners 1",
  "team Beginners 2",
  "Platform Manager",
];
const courseVisualClass = (course: string) =>
  `course-${course.toLowerCase().replace(/\s+/g, "-")}`;
const blankQuestion = (): HomeworkQuestion => ({
  id: `Q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  prompt: "",
  choices: ["", "", "", ""],
  correctIndex: 0,
  points: 1,
  explanation: "",
  type: "mcq",
  supportType: "none",
  supportText: "",
  supportUrl: "",
  supportCaption: "",
  contentGroupId: "",
});
const toLocalDateTime = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const blankHomework = (): HomeworkItem => {
  const now = new Date();
  const due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  return {
    id: `HW-${Date.now()}`,
    title: "",
    course: "SAT",
    mode: "flex",
    status: "draft",
    employee: employees[0],
    section: "Reading",
    lesson: "",
    targetGroup: "All Students",
    opensAt: toLocalDateTime(now),
    dueAt: toLocalDateTime(due),
    instructions: "",
    attempts: 2,
    showResult: true,
    showAnswers: "after_submit",
    questions: [blankQuestion()],
    moduleConfigs: [
      {
        number: 1,
        title: "Module 1",
        section: "Reading",
        breakMinutes: 0,
        shuffleQuestions: false,
        allowReview: true,
      },
    ],
    createdAt: new Date().toISOString().slice(0, 10),
  };
};

export default function HomeworkAdminManager({
  fullScreen = false,
  initialId = "",
  initialAllCourses = false,
}: {
  fullScreen?: boolean;
  initialId?: string;
  initialAllCourses?: boolean;
}) {
  const router = useRouter();
  // The admin directory must never paint demo assignments while the real
  // browser-backed list is hydrating. Painting defaultHomeworks here caused
  // expired demo records to flash in HISTORY and then disappear after refresh.
  const [items, setItems] = useState<HomeworkItem[]>([]),
    [editing, setEditing] = useState<HomeworkItem>(blankHomework),
    [filter, setFilter] = useState<HomeworkCourse | "ALL">("ALL"),
    [query, setQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "upcoming" | "completed" | "archived">("ALL"),
    [tab, setTab] = useState<"list" | "editor" | "results">("list"),
    [toast, setToast] = useState(""),
    [submissions, setSubmissions] = useState<any[]>([]),
    [submissionQuery, setSubmissionQuery] = useState("");
  const [directoryMode, setDirectoryMode] = useState<"loading" | "database" | "local" | "error">("loading");
  const [directoryRefreshing, setDirectoryRefreshing] = useState(false);
  const [localOnlyIds, setLocalOnlyIds] = useState<Set<string>>(() => new Set());
  const knownServerIdsRef = useRef<Set<string>>(new Set());
  const markHomeworksSynced = (homeworks: readonly HomeworkItem[]) => {
    const known = knownServerIdsRef.current;
    for (const homework of homeworks) {
      known.add(homework.id);
    }
    saveKnownServerHomeworkIds(known);
    setLocalOnlyIds((current) => {
      if (!homeworks.some((homework) => current.has(homework.id))) return current;
      const next = new Set(current);
      for (const homework of homeworks) next.delete(homework.id);
      return next;
    });
  };
  const [submissionCourseFilter, setSubmissionCourseFilter] = useState<string>("ALL");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [fileImporting, setFileImporting] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [fileImportReport, setFileImportReport] = useState<{
    name: string;
    total: number;
    added: number;
    errors: number;
  } | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [homeworkModuleSettingsOpen, setHomeworkModuleSettingsOpen] =
    useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [dragQuestionIndex, setDragQuestionIndex] = useState<number | null>(
    null,
  );
  const [expandedHomeworkId, setExpandedHomeworkId] = useState<string | null>(
    null,
  );
  const [completedModalId, setCompletedModalId] = useState<string | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<any | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLimit, setArchiveLimit] = useState(10);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [resultHomeworkId, setResultHomeworkId] = useState<string | null>(null);
  const [builderStep, setBuilderStep] = useState<
    "info" | "questions" | "assign" | "review" | null
  >(null);
  const [activeHomeworkModule, setActiveHomeworkModule] = useState(1);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleTimed, setNewModuleTimed] = useState(false);
  const [newModuleDuration, setNewModuleDuration] = useState(30);
  const [newModuleHasBreak, setNewModuleHasBreak] = useState(false);
  const [newModuleBreakMinutes, setNewModuleBreakMinutes] = useState(5);
  const [publishAllCourses, setPublishAllCourses] = useState(Boolean(initialAllCourses));
  const [saveAction, setSaveAction] = useState<
    "idle" | "saving" | "publishing" | "scheduling"
  >("idle");
  const [itemAction, setItemAction] = useState<{
    id: string;
    kind: "republish" | "delete";
  } | null>(null);
  const [selectedHomeworkIds, setSelectedHomeworkIds] = useState<
    Record<string, boolean>
  >({});
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    source: "archive" | "history" | "active" | "mixed";
  } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{
    kind: "archive" | "republish";
    ids: string[];
  } | null>(null);
  const [bulkActionBusy, setBulkActionBusy] = useState<
    "archive" | "republish" | "duplicate" | null
  >(null);
  const [bulkActionError, setBulkActionError] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<{
    kind: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const saveActionRef = useRef(false);
  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [homeworkDraftReady, setHomeworkDraftReady] = useState(false);
  const [homeworkItemsReady, setHomeworkItemsReady] = useState(false);
  const homeworkDraftReadyRef = useRef(false);
  const latestEditingRef = useRef<HomeworkItem>(editing);
  const latestQuestionIndexRef = useRef(activeQuestionIndex);
  const latestModuleRef = useRef(activeHomeworkModule);
  // Keep unload/refresh handlers pointed at the newest state.
  // Do this during render so a browser refresh cannot observe an older React effect closure.
  latestEditingRef.current = editing;
  latestQuestionIndexRef.current = activeQuestionIndex;
  latestModuleRef.current = activeHomeworkModule;
  homeworkDraftReadyRef.current = homeworkDraftReady;
  const [questionBankOpen, setQuestionBankOpen] = useState(false);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankItems, setQuestionBankItems] = useState<any[]>([]);
  const [questionBankSelected, setQuestionBankSelected] = useState<
    Record<string, boolean>
  >({});
  const [questionBankQuery, setQuestionBankQuery] = useState("");
  const [questionBankSkill, setQuestionBankSkill] = useState("ALL");
  const [questionBankDifficulty, setQuestionBankDifficulty] = useState("ALL");
  const [questionBankDomain, setQuestionBankDomain] = useState("ALL");
  const [questionBankSubSkill, setQuestionBankSubSkill] = useState("ALL");
  const [questionBankPreviewId, setQuestionBankPreviewId] = useState("");
  const [assignmentDirectory, setAssignmentDirectory] = useState<{
    groups: any[];
    students: any[];
  }>({ groups: [], students: [] });
  const assignmentTargets = useMemo(
    () => [
      { value: "All Students", label: `All ${editing.course} students` },
      ...assignmentDirectory.groups
        .filter(
          (group) =>
            group.active !== false && sameCourse(group.course, editing.course),
        )
        .map((group) => ({
          value: `group:${group.id}`,
          label: `Group · ${group.name}`,
        })),
      ...assignmentDirectory.students
        .filter(
          (student) =>
            student.isActive !== false &&
            sameCourse(student.course, editing.course),
        )
        .map((student) => ({
          value: `student:${student.id}`,
          label: `Student · ${student.name} · ${student.code}`,
        })),
    ],
    [assignmentDirectory, editing.course],
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/admin/groups", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/all-students", { cache: "no-store" }).then((r) =>
        r.json(),
      ),
    ])
      .then(([groupData, studentData]) => {
        if (active)
          setAssignmentDirectory({
            groups: Array.isArray(groupData?.items) ? groupData.items : [],
            students: Array.isArray(studentData?.students)
              ? studentData.students
              : [],
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let restoredSynchronously = false;
    setHomeworkDraftReady(false);
    setHomeworkItemsReady(false);
    (async () => {
      try {
        // Opening "New Homework" must always create a clean assignment. Give the
        // new draft its own URL immediately so a refresh can still restore this
        // exact draft without reopening an older homework.
        if (fullScreen && !initialId) {
          const fresh = blankHomework();
          setEditing(fresh);
          setActiveQuestionIndex(0);
          setActiveHomeworkModule(1);
          setPublishAllCourses(false);
          setTab("editor");
          restoredSynchronously = true;
          setHomeworkDraftReady(true);
          try {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("id", fresh.id);
            window.history.replaceState(
              window.history.state,
              "",
              nextUrl.toString(),
            );
          } catch {}
        }
        // V440: restore the synchronous browser mirrors BEFORE waiting for IndexedDB/network.
        // Never render a blank builder while durable storage is still opening.
        let mirrorEnvelope: any = null,
          legacyMirrorEnvelope: any = null,
          sessionEnvelope: any = null;
        const v442Envelope: any = readV442Journal();
        try {
          mirrorEnvelope = JSON.parse(
            localStorage.getItem(HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY) || "null",
          );
        } catch {}
        try {
          legacyMirrorEnvelope = JSON.parse(
            localStorage.getItem(
              "american-platform-homework-active-draft-mirror-v434",
            ) || "null",
          );
        } catch {}
        try {
          sessionEnvelope = JSON.parse(
            sessionStorage.getItem(HOMEWORK_ACTIVE_DRAFT_SESSION_KEY) || "null",
          );
        } catch {}
        const fastCandidates = [
          v442Envelope,
          mirrorEnvelope,
          legacyMirrorEnvelope,
          sessionEnvelope,
        ]
          .filter(Boolean)
          .sort(
            (a: any, b: any) =>
              Number(b?.savedAt || 0) - Number(a?.savedAt || 0),
          );
        const fastEnvelope = fastCandidates[0] || null;
        if (
          fullScreen &&
          !!initialId &&
          fastEnvelope?.homework &&
          fastEnvelope.homework.id === initialId
        ) {
          const fastHw = fastEnvelope.homework as HomeworkItem;
          setEditing(fastHw);
          setPublishAllCourses(Boolean(fastHw.publicationGroupId));
          setActiveQuestionIndex(
            Math.max(
              0,
              Math.min(
                Number(fastEnvelope?.activeQuestionIndex || 0),
                Math.max(0, fastHw.questions.length - 1),
              ),
            ),
          );
          setActiveHomeworkModule(
            Math.max(
              1,
              Number(
                fastEnvelope?.activeModule ||
                  fastHw.moduleConfigs?.[0]?.number ||
                  fastHw.questions?.[0]?.moduleNumber ||
                  1,
              ),
            ),
          );
          setTab("editor");
          restoredSynchronously = true;
          // With readiness stored in React state (not a mutable ref), this is safe:
          // React commits the recovered homework and ready=true in the same render.
          // The autosave effect from the initial blank render still sees ready=false.
          setHomeworkDraftReady(true);
        }

        // Durable reconciliation happens after the instant mirror restore.
        const [saved, storedDraftEnvelope, shared] = await Promise.all([
          readLargeJson<HomeworkItem[]>(HOMEWORK_STORAGE_KEY, []),
          readLargeJson<any>(HOMEWORK_ACTIVE_DRAFT_KEY, null),
          fetchSharedHomeworkDirectory().catch((error: unknown) => ({ mode: "error" as const, error })),
        ]);
        if (cancelled) return;
        // A fresh builder draft is recoverable through the draft journal, but it
        // must not become a real homework list item before Save or Publish.
        let directoryItems = saved;
        if (shared.mode === "database") {
          const reconciled = reconcileHomeworkDirectory(shared.items, saved, readKnownServerHomeworkIds());
          directoryItems = reconciled.items;
          knownServerIdsRef.current = reconciled.knownServerIds;
          saveKnownServerHomeworkIds(reconciled.knownServerIds);
          setLocalOnlyIds(reconciled.localOnlyIds);
          // A remote deletion never becomes a new local draft merely because
          // another administrator still has an outdated browser cache.
          await writeLargeJson(HOMEWORK_STORAGE_KEY, directoryItems).catch(() => {
            // Server data remains displayable even if this browser denies storage.
          });
          setDirectoryMode("database");
        } else {
          // The browser copy is a recovery source, not proof of server publication.
          setLocalOnlyIds(new Set(saved.map((item) => item.id)));
          setDirectoryMode(shared.mode === "local" ? "local" : "error");
        }
        if (cancelled) return;
        setItems(directoryItems);
        if (fullScreen && initialId) {
          const selected = directoryItems.find((item) => item.id === initialId);
          if (selected) {
            setPublishAllCourses(homeworkPublicationMembers(directoryItems, selected).length > 1);
          }
        }
        setHomeworkItemsReady(true);
        const candidates = [
          v442Envelope,
          storedDraftEnvelope,
          mirrorEnvelope,
          legacyMirrorEnvelope,
          sessionEnvelope,
        ].filter(Boolean);
        const draftEnvelope =
          candidates.sort(
            (a: any, b: any) =>
              Number(b?.savedAt || 0) - Number(a?.savedAt || 0),
          )[0] || null;
        if (fullScreen && !restoredSynchronously) {
          const found = initialId
            ? directoryItems.find((x) => x.id === initialId)
            : null;
          const draftItem = draftEnvelope?.homework as HomeworkItem | undefined;
          const canRestore =
            !!draftItem && !!initialId && draftItem.id === initialId;
          if (canRestore || found) {
            const restored = canRestore ? draftItem : structuredClone(found!);
            setEditing(restored);
            setPublishAllCourses(homeworkPublicationMembers(directoryItems, restored).length > 1);
            setActiveQuestionIndex(
              Math.max(
                0,
                Math.min(
                  Number(
                    canRestore ? draftEnvelope?.activeQuestionIndex || 0 : 0,
                  ),
                  Math.max(0, restored.questions.length - 1),
                ),
              ),
            );
            setActiveHomeworkModule(
              Math.max(
                1,
                Number(
                  canRestore
                    ? draftEnvelope?.activeModule
                    : restored.moduleConfigs?.[0]?.number ||
                        restored.questions?.[0]?.moduleNumber ||
                        1,
                ),
              ),
            );
            setTab("editor");
          } else {
            setEditing(blankHomework());
            setActiveQuestionIndex(0);
            setActiveHomeworkModule(1);
            setTab("editor");
          }
          setHomeworkDraftReady(true);
        }
        // If a synchronous mirror was restored, durable storage is background-only.
        // It must never overwrite the live editor tens of seconds later with an older snapshot.
        // Do not bulk-resend every homework while the builder opens. Each explicit
        // save synchronizes only the assignment that actually changed.
        void refreshHomeworkSubmissions();
      } catch {
        if (!cancelled) {
          setDirectoryMode("error");
          setHomeworkItemsReady(true);
        }
        // If durable storage fails, keep any mirror already restored. Only create blank when no recovery exists.
        if (fullScreen && !restoredSynchronously) {
          setEditing(blankHomework());
          setActiveQuestionIndex(0);
          setActiveHomeworkModule(1);
          setPublishAllCourses(false);
          setTab("editor");
          setHomeworkDraftReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullScreen, initialId]);

  useEffect(() => {
    if (!fullScreen || !editing.id || !homeworkDraftReady) return;
    setDraftDirty(true);
    const draft = {
      ...editing,
      status:
        editing.status === "published"
          ? editing.status
          : ("draft" as HomeworkStatus),
    };
    const envelope = {
      homework: draft,
      activeQuestionIndex,
      activeModule: activeHomeworkModule,
      savedAt: Date.now(),
    };
    writeV442Journal(envelope);
    try {
      const serialized = JSON.stringify(envelope);
      localStorage.setItem(HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY, serialized);
      sessionStorage.setItem(HOMEWORK_ACTIVE_DRAFT_SESSION_KEY, serialized);
    } catch {}
    const timer = setTimeout(() => {
      (async () => {
        try {
          await writeLargeJson(HOMEWORK_ACTIVE_DRAFT_KEY, envelope);
          // Autosave ONLY the private editor draft. Never mutate the shared
          // directory (or replace a colleague's version) until explicit Save.
          setAutoSavedAt(
            new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
          setDraftDirty(false);
        } catch {}
      })();
    }, 120);
    return () => clearTimeout(timer);
  }, [editing, fullScreen, activeQuestionIndex, activeHomeworkModule]);

  useEffect(() => {
    if (!fullScreen) return;
    const flushDraft = () => {
      // Never flush the initial blank React state before draft hydration finishes.
      // React Strict Mode intentionally mounts/cleans up effects once in development;
      // without this guard that cleanup could overwrite the real saved draft with blankHomework().
      if (!homeworkDraftReadyRef.current) return;
      const current = latestEditingRef.current;
      if (!current?.id) return;
      try {
        const draft = {
          ...current,
          status:
            current.status === "published"
              ? current.status
              : ("draft" as HomeworkStatus),
        };
        const envelope = {
          homework: draft,
          activeQuestionIndex: latestQuestionIndexRef.current,
          activeModule: latestModuleRef.current,
          savedAt: Date.now(),
        };
        writeV442Journal(envelope);
        const serialized = JSON.stringify(envelope);
        localStorage.setItem(HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY, serialized);
        sessionStorage.setItem(HOMEWORK_ACTIVE_DRAFT_SESSION_KEY, serialized);
        void writeLargeJson(HOMEWORK_ACTIVE_DRAFT_KEY, envelope).catch(
          () => {},
        );
      } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") flushDraft();
    };
    window.addEventListener("beforeunload", flushDraft);
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("offline", flushDraft);
    window.addEventListener("online", flushDraft);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      // Do NOT flush from effect cleanup. In React Strict Mode the cleanup runs once
      // immediately after mount as a development safety check, before async hydration
      // has necessarily completed. Flushing here can destroy the real draft.
      // Real refresh/close is already covered by beforeunload/pagehide, while every
      // editor mutation is persisted synchronously by commitEditing().
      window.removeEventListener("beforeunload", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("offline", flushDraft);
      window.removeEventListener("online", flushDraft);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fullScreen]);

  const persistActiveDraftNow = (
    next: HomeworkItem,
    options?: { activeModule?: number; activeQuestionIndex?: number },
  ) => {
    if (!fullScreen || !next?.id || !homeworkDraftReadyRef.current) return;
    const nextQuestionIndex = Math.max(
      0,
      Number(options?.activeQuestionIndex ?? activeQuestionIndex),
    );
    const nextModule = Math.max(
      1,
      Number(options?.activeModule ?? activeHomeworkModule),
    );
    // Update the emergency refs before any React state transition.
    latestEditingRef.current = next;
    latestQuestionIndexRef.current = nextQuestionIndex;
    latestModuleRef.current = nextModule;
    const draft = {
      ...next,
      status:
        next.status === "published" ? next.status : ("draft" as HomeworkStatus),
    };
    const envelope = {
      homework: draft,
      activeQuestionIndex: nextQuestionIndex,
      activeModule: nextModule,
      savedAt: Date.now(),
    };
    writeV442Journal(envelope);
    try {
      const serialized = JSON.stringify(envelope);
      localStorage.setItem(HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY, serialized);
      sessionStorage.setItem(HOMEWORK_ACTIVE_DRAFT_SESSION_KEY, serialized);
    } catch {}
    // Start the durable IndexedDB write immediately at the mutation boundary.
    // This avoids losing the last module/question when a refresh happens before React effects run.
    void writeLargeJson(HOMEWORK_ACTIVE_DRAFT_KEY, envelope).catch(() => {});
  };
  const commitEditing = (
    next: HomeworkItem,
    options?: { activeModule?: number; activeQuestionIndex?: number },
  ) => {
    persistActiveDraftNow(next, options);
    setEditing(next);
  };

  useEffect(() => {
    if (
      !fullScreen ||
      typeof navigator === "undefined" ||
      !("storage" in navigator)
    )
      return;
    try {
      void navigator.storage.persist?.().catch(() => false);
    } catch {}
  }, [fullScreen]);
  useEffect(
    () => () => {
      if (saveFeedbackTimerRef.current)
        clearTimeout(saveFeedbackTimerRef.current);
    },
    [],
  );

  const syncHomeworkItems = async (changed: HomeworkItem[]) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      Math.max(10_000, changed.length * 1_000),
    );
    try {
      const payload =
        changed.length === 1
          ? { homework: changed[0] }
          : { homeworks: changed };
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true || data?.mode !== "database")
        throw new Error(
          data?.error || "HOMEWORK_NOT_SAVED_ON_SERVER",
        );
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  };
  const persist = async (
    next: HomeworkItem[],
    changed: HomeworkItem[] = next,
  ) => {
    // The local copy is emergency recovery only; a successful Save or Publish
    // must await confirmation from the central database.
    setItems(next);
    try {
      await writeLargeJson(HOMEWORK_STORAGE_KEY, next);
      const result = await syncHomeworkItems(changed);
      markHomeworksSynced(changed);
      return result;
    } catch (e: any) {
      setLocalOnlyIds((previous) => new Set([...previous, ...changed.map((homework) => homework.id)]));
      notify(
        `Server synchronization failed; check the browser recovery copy: ${e?.name === "AbortError" ? "server timeout" : e?.message || "Unknown error"}`,
      );
      throw e;
    }
  };

  const refreshDirectory = async () => {
    if (directoryRefreshing || saveActionRef.current || bulkActionBusy || itemAction) return;
    setDirectoryRefreshing(true);
    try {
      const shared = await fetchSharedHomeworkDirectory();
      if (shared.mode !== "database") throw new Error("HOMEWORK_DATABASE_NOT_CONFIGURED");
      if (saveActionRef.current) return;
      const reconciled = reconcileHomeworkDirectory(shared.items, items, knownServerIdsRef.current);
      knownServerIdsRef.current = reconciled.knownServerIds;
      saveKnownServerHomeworkIds(reconciled.knownServerIds);
      setLocalOnlyIds(reconciled.localOnlyIds);
      setItems(reconciled.items);
      setDirectoryMode("database");
      setSharedHomeworkWaiting(false);
      await writeLargeJson(HOMEWORK_STORAGE_KEY, reconciled.items).catch(() => {});
    } catch {
      setDirectoryMode("error");
      notify("The central homework list could not be refreshed. Your local recovery copy is unchanged.");
    } finally {
      setDirectoryRefreshing(false);
    }
  };

  // A change made by another authorized administrator refreshes the central
  // list. Never replace a draft or race an in-flight Save/Publish.
  const pendingSharedHomework = useRef(false);
  const [sharedHomeworkWaiting,setSharedHomeworkWaiting]=useState(false);
  useEffect(() => {
    const onShared = (event: Event) => {
      const detail = (event as CustomEvent<AdminSharedSyncEvent>).detail;
      if (!detail?.permissions?.includes("homework")) return;
      pendingSharedHomework.current = true;
      if(fullScreen||tab!=="list")setSharedHomeworkWaiting(true);
      if (!fullScreen && tab === "list" && directoryMode === "database" &&
          !directoryRefreshing && !saveActionRef.current && !bulkActionBusy && !itemAction) {
        pendingSharedHomework.current = false;
        void refreshDirectory();
      }
    };
    window.addEventListener(ADMIN_SHARED_SYNC_EVENT, onShared);
    return () => window.removeEventListener(ADMIN_SHARED_SYNC_EVENT, onShared);
  }, [fullScreen, tab, directoryMode, directoryRefreshing, bulkActionBusy, itemAction, items]);
  useEffect(() => {
    if (fullScreen || tab !== "list" || directoryMode !== "database" ||
        directoryRefreshing || !pendingSharedHomework.current || saveActionRef.current || bulkActionBusy || itemAction) return;
    pendingSharedHomework.current = false;
    void refreshDirectory();
  }, [fullScreen, tab, directoryMode, directoryRefreshing, bulkActionBusy, itemAction]);

  useEffect(() => {
    if (fullScreen || directoryMode !== "database" || tab !== "list") return;
    // Refresh when the owner returns to an already-open admin tab. Never
    // overwrite an in-progress editor or a write with background polling.
    let lastChecked = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastChecked < 30_000) return;
      lastChecked = Date.now();
      void refreshDirectory();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fullScreen, directoryMode, tab, items, directoryRefreshing, bulkActionBusy, itemAction]);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };
  const refreshHomeworkSubmissions = async () => {
    let localRows: any[] = [];
    try {
      const parsed = JSON.parse(
        localStorage.getItem(HOMEWORK_SUBMISSIONS_KEY) || "[]",
      );
      if (Array.isArray(parsed)) localRows = parsed;
    } catch {}
    try {
      const response = await fetch("/api/admin/submissions?kind=homework", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      const serverRows =
        response.ok && Array.isArray(data?.submissions) ? data.submissions : [];
      const merged = new Map<string, any>();
      for (const row of [...localRows, ...serverRows]) {
        const assignmentId = String(row.homeworkId || row.assignmentId || "");
        const studentId = String(
          row.studentId || row.student || "local-student",
        );
        if (assignmentId) merged.set(`${assignmentId}:${studentId}`, row);
      }
      setSubmissions(
        [...merged.values()].sort(
          (a, b) =>
            new Date(b.submittedAt || 0).getTime() -
            new Date(a.submittedAt || 0).getTime(),
        ),
      );
    } catch {
      setSubmissions(localRows);
    }
  };
  useEffect(() => {
    if (fullScreen || tab !== "results") return;
    void refreshHomeworkSubmissions();
    const refresh = () => void refreshHomeworkSubmissions();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 12_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [fullScreen, tab]);
  const showSaveFeedback = (
    kind: "success" | "error",
    title: string,
    message: string,
  ) => {
    if (saveFeedbackTimerRef.current)
      clearTimeout(saveFeedbackTimerRef.current);
    setSaveFeedback({ kind, title, message });
    saveFeedbackTimerRef.current = setTimeout(
      () => setSaveFeedback(null),
      4200,
    );
  };
  const adminPublications = useMemo(() => homeworkAdminPublications(items), [items]);
  const publicationMembers = (item: HomeworkItem) =>
    homeworkPublicationMembers(items, item);
  const publicationCourses = (item: HomeworkItem) =>
    publicationMembers(item).map((member) => member.course);
  const publicationLabel = (item: HomeworkItem) => {
    const courses = publicationCourses(item);
    return courses.length > 1 ? `All Courses (${courses.length})` : item.course;
  };
  const publicationStudentCount = (item: HomeworkItem, courseFilter = "ALL"): number | null => {
    if (!assignmentDirectory.students.length) return null;
    const courses = new Set(publicationCourses(item).filter((course) =>
      courseFilter === "ALL" || course === courseFilter));
    const ids = new Set(assignmentDirectory.students
      .filter((student) => student.isActive !== false &&
        [...courses].some((course) => sameCourse(student.course, course)))
      .map((student) => String(student.id)));
    return ids.size;
  };
  const courseSubmissionFilters = (item: HomeworkItem) => {
    const members = publicationMembers(item);
    if (members.length < 2) return null;
    const counts = publicationSubmissions(item);
    return (
      <div className="hw-group-course-filter" aria-label="Filter submissions by course">
        <button type="button" className={submissionCourseFilter === "ALL" ? "active" : ""}
          onClick={() => setSubmissionCourseFilter("ALL")}>All Courses ({counts.length})</button>
        {members.map((member) => (
          <button type="button" key={member.id}
            className={submissionCourseFilter === member.course ? "active" : ""}
            onClick={() => setSubmissionCourseFilter(member.course)}>
            {member.course} ({counts.filter((row: any) => String(row.homeworkId || row.assignmentId || "") === member.id).length})
          </button>
        ))}
      </div>
    );
  };
  const publicationSubmissions = (item: HomeworkItem) => {
    const ids = new Set(publicationMembers(item).map((member) => member.id));
    return submissions.filter((row: any) =>
      ids.has(String(row.homeworkId || row.assignmentId || "")),
    );
  };
  const visible = useMemo(
    () =>
      homeworkAdminPublications(items, filter).filter((item) =>
        homeworkPublicationMembers(items, item).some((member) =>
          `${member.title} ${member.employee} ${member.course} ${member.section || ""} ${member.lesson || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
      ),
    [items, filter, query],  );

  const publishProblems = () => {
    const problems: {
      type: string;
      message: string;
      questionIndex?: number;
      module?: number;
    }[] = [];
    const strip = (v: any) =>
      String(v || "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim();
    if (!strip(editing.title))
      problems.push({
        type: "homework",
        message: "Homework name is required.",
      });
    if (!editing.targetGroup)
      problems.push({ type: "assign", message: "Select target students." });
    const open = editing.opensAt ? new Date(editing.opensAt).getTime() : 0;
    const due = editing.dueAt ? new Date(editing.dueAt).getTime() : 0;
    if (open && due && due <= open)
      problems.push({
        type: "assign",
        message: "Due date must be after Opens date.",
      });
    const moduleNums = Array.from(
      new Set([
        ...(editing.moduleConfigs || []).map((c) => Number(c.number || 1)),
        ...editing.questions.map((q) => Number(q.moduleNumber || 1)),
      ]),
    ).sort((a, b) => a - b);
    const maxModule = Math.max(1, ...moduleNums);
    for (let m = 1; m <= maxModule; m++) {
      const qs = editing.questions.filter(
        (q) => Number(q.moduleNumber || 1) === m,
      );
      if (!qs.length)
        problems.push({
          type: "module",
          module: m,
          message: `${moduleConfig(m).title} has no questions.`,
        });
      const cfg = moduleConfig(m);
      if (!strip(cfg.title))
        problems.push({
          type: "module",
          module: m,
          message: `Module ${m} needs a name.`,
        });
    }
    editing.questions.forEach((q, i) => {
      if (!strip(q.prompt))
        problems.push({
          type: "question",
          questionIndex: i,
          module: Number(q.moduleNumber || 1),
          message: `Question ${i + 1}: question text is empty.`,
        });
      if (q.type !== "written") {
        if (!Array.isArray(q.choices) || q.choices.length < 2)
          problems.push({
            type: "question",
            questionIndex: i,
            module: Number(q.moduleNumber || 1),
            message: `Question ${i + 1}: add at least 2 choices.`,
          });
        else if (q.choices.some((c) => !strip(c)))
          problems.push({
            type: "question",
            questionIndex: i,
            module: Number(q.moduleNumber || 1),
            message: `Question ${i + 1}: one or more choices are empty.`,
          });
        if (
          !Number.isInteger(q.correctIndex) ||
          q.correctIndex < 0 ||
          q.correctIndex >= q.choices.length
        )
          problems.push({
            type: "question",
            questionIndex: i,
            module: Number(q.moduleNumber || 1),
            message: `Question ${i + 1}: choose a valid correct answer.`,
          });
      }
      if (q.supportType === "passage" && !strip(q.supportText))
        problems.push({
          type: "question",
          questionIndex: i,
          module: Number(q.moduleNumber || 1),
          message: `Question ${i + 1}: passage is empty.`,
        });
      if (q.supportType === "pdf" && !q.supportUrl)
        problems.push({
          type: "question",
          questionIndex: i,
          module: Number(q.moduleNumber || 1),
          message: `Question ${i + 1}: PDF file is missing.`,
        });
      if (
        (q.supportType === "image" || q.supportType === "diagram") &&
        !q.supportUrl
      )
        problems.push({
          type: "question",
          questionIndex: i,
          module: Number(q.moduleNumber || 1),
          message: `Question ${i + 1}: image/diagram is missing.`,
        });
    });
    return problems;
  };
  const finishSaveAction = () => {
    saveActionRef.current = false;
    setSaveAction("idle");
  };
  const save = async (
    status?: HomeworkStatus,
    intent: "save" | "publish" | "schedule" = "save",
  ): Promise<boolean> => {
    if (saveActionRef.current) return false;
    if (!homeworkItemsReady) {
      notify("The shared homework directory is still loading. Please save after it finishes.");
      return false;
    }
    const action =
      intent === "publish"
        ? "publishing"
        : intent === "schedule"
          ? "scheduling"
          : "saving";
    if (saveFeedbackTimerRef.current)
      clearTimeout(saveFeedbackTimerRef.current);
    saveActionRef.current = true;
    setSaveAction(action);
    setSaveFeedback(null);
    const failedTitle =
      intent === "publish"
        ? "Publish not completed"
        : intent === "schedule"
          ? "Schedule not completed"
          : "Save not completed";
    if (!editing.title.trim()) {
      notify("Enter homework name first.");
      showSaveFeedback(
        "error",
        failedTitle,
        "Enter a homework name, then try again.",
      );
      setBuilderStep("info");
      finishSaveAction();
      return false;
    }
    if (!editing.questions.length) {
      notify("Select at least one question.");
      showSaveFeedback(
        "error",
        failedTitle,
        "Add at least one question, then try again.",
      );
      setBuilderStep(null);
      finishSaveAction();
      return false;
    }
    if (status === "published" || status === "scheduled") {
      const problems = publishProblems();
      if (problems.length) {
        const first = problems[0];
        notify(
          `Cannot ${status === "published" ? "publish" : "schedule"}: ${problems.length} issue${problems.length === 1 ? "" : "s"} need fixing.`,
        );
        showSaveFeedback(
          "error",
          failedTitle,
          `${problems.length} issue${problems.length === 1 ? "" : "s"} must be fixed before continuing.`,
        );
        if (first.questionIndex !== undefined) {
          setActiveQuestionIndex(first.questionIndex);
          setActiveHomeworkModule(first.module || 1);
          setBuilderStep(null);
        } else if (first.type === "assign") setBuilderStep("assign");
        else if (first.type === "module") {
          setActiveHomeworkModule(first.module || 1);
          setBuilderStep("questions");
        } else setBuilderStep("review");
        finishSaveAction();
        return false;
      }
    }
    const nextItem: HomeworkItem = {
      ...editing,
      status: status || editing.status,
      estimatedMinutes: undefined,
      timeLimitMinutes: undefined,
      moduleConfigs: (editing.moduleConfigs || []).map((config) => ({
        ...config,
        durationMinutes: Number(config.durationMinutes || 0) > 0 ? Number(config.durationMinutes) : undefined,
        breakMinutes: Math.max(0, Number(config.breakMinutes || 0)),
      })),
    };
    try {
      persistActiveDraftNow(nextItem, {
        activeQuestionIndex,
        activeModule: activeHomeworkModule,
      });
      if (fullScreen) {
        try {
          localStorage.setItem(
            HOMEWORK_ACTIVE_DRAFT_MIRROR_KEY,
            JSON.stringify({
              homework: nextItem,
              activeQuestionIndex,
              activeModule: activeHomeworkModule,
              savedAt: Date.now(),
            }),
          );
        } catch {}
      }
      const fanOut =
        publishAllCourses && (status === "published" || status === "scheduled");
      const groupedEdit =
        publishAllCourses && homeworkPublicationMembers(items, nextItem).length > 1;
      let nextItems: HomeworkItem[];
      let activeItem = nextItem;
      let changedItems: HomeworkItem[] = [nextItem];
      if (fanOut || groupedEdit) {
        ({ nextItems, changedItems, activeItem } = updateHomeworkPublication(
          items, nextItem, nextItem.status, homeworkCourses,
        ));
      } else {
        nextItems = items.some((x) => x.id === nextItem.id)
          ? items.map((x) => (x.id === nextItem.id ? nextItem : x))
          : [nextItem, ...items];
      }
      const sync = await persist(nextItems, changedItems);
      setEditing(activeItem);
      setAutoSavedAt(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      setDraftDirty(false);
      if (intent === "publish")
        showSaveFeedback(
          "success",
          "Published successfully",
          fanOut
            ? `The homework is now published to all ${homeworkCourses.length} courses.`
            : "The homework is now available to the selected students.",
        );
      else if (intent === "schedule")
        showSaveFeedback(
          "success",
          "Scheduled successfully",
          fanOut
            ? `The homework is scheduled for all ${homeworkCourses.length} courses.`
            : "The homework schedule has been saved successfully.",
        );
      else
        showSaveFeedback(
          "success",
          "Saved successfully",
          "All homework changes have been saved and synchronized.",
        );
      return true;
    } catch {
      showSaveFeedback(
        "error",
        failedTitle,
        "A local recovery copy is protected, but server synchronization was not confirmed. Try again.",
      );
      return false;
    } finally {
      finishSaveAction();
    }
  };
  const saveCurrent = () => save(editing.status, "save");
  const previewCurrent = async () => {
    const ok = await saveCurrent();
    if (ok)
      router.push(
        `/homework/session?id=${encodeURIComponent(editing.id)}&preview=admin`,
      );
  };
  const startNewHomework = () => {
    if (saveActionRef.current) return;
    // Keep an existing saved assignment up to date, but never promote an
    // unsaved recovery draft into the homework list automatically.
    const current = structuredClone(editing);
    const currentIsSaved = items.some((item) => item.id === current.id);
    if (currentIsSaved) {
      const protectedItems = items.map((item) =>
        item.id === current.id ? current : item,
      );
      setItems(protectedItems);
      void writeLargeJson(HOMEWORK_STORAGE_KEY, protectedItems).catch(() => {});
    }
    persistActiveDraftNow(current, {
      activeQuestionIndex,
      activeModule: activeHomeworkModule,
    });

    const fresh = blankHomework();
    setActiveQuestionIndex(0);
    setActiveHomeworkModule(1);
    setPublishAllCourses(false);
    setBuilderStep("info");
    setQuestionBankOpen(false);
    setAddModuleOpen(false);
    setHomeworkModuleSettingsOpen(false);
    setShowIssues(false);
    setSaveFeedback(null);
    setAutoSavedAt("");
    persistActiveDraftNow(fresh, { activeQuestionIndex: 0, activeModule: 1 });
    setEditing(fresh);
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("id", fresh.id);
      window.history.replaceState(window.history.state, "", nextUrl.toString());
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("New homework created. Your previous homework remains saved.");
  };
  const edit = (x: HomeworkItem) => {
    setEditing(structuredClone(x));
    setTab("editor");
  };
  const addQ = () => {
    const nextQ = { ...blankQuestion(), moduleNumber: activeHomeworkModule };
    const next = [...editing.questions, nextQ];
    const nextEditing = { ...editing, questions: next };
    commitEditing(nextEditing, { activeQuestionIndex: next.length - 1 });
    setActiveQuestionIndex(next.length - 1);
  };
  const contentSource = (q: HomeworkQuestion) =>
    q.contentGroupId
      ? editing.questions.find((x) => x.contentGroupId === q.contentGroupId)
      : undefined;
  const addQuestionSameContent = (idx: number) => {
    const source = editing.questions[idx];
    const groupId = source.contentGroupId || `CG-${Date.now()}`;
    const currentQuestions = editing.questions.map((x, n) =>
      n === idx ? { ...x, contentGroupId: groupId } : x,
    );
    const next = {
      ...blankQuestion(),
      contentGroupId: groupId,
      supportType: source.supportType,
      supportText: source.supportText,
      supportUrl: source.supportUrl,
      supportCaption: source.supportCaption,
      moduleNumber: Number(source.moduleNumber || activeHomeworkModule || 1),
    };
    currentQuestions.splice(idx + 1, 0, next);
    commitEditing(
      { ...editing, questions: currentQuestions },
      { activeQuestionIndex: idx + 1 },
    );
    setActiveQuestionIndex(idx + 1);
    notify("Question saved and a new question opened on the same content");
  };
  const addNewContentQuestion = (
    idx: number,
    type: HomeworkSupportType = "passage",
  ) => {
    const source = editing.questions[idx];
    const qs = [...editing.questions];
    qs[idx] = { ...source };
    const next = {
      ...blankQuestion(),
      supportType: type,
      contentGroupId: `CG-${Date.now()}`,
      moduleNumber: Number(source.moduleNumber || activeHomeworkModule || 1),
    };
    qs.splice(idx + 1, 0, next);
    commitEditing(
      { ...editing, questions: qs },
      { activeQuestionIndex: idx + 1 },
    );
    setActiveQuestionIndex(idx + 1);
    notify("Question saved and new content opened");
  };
  const saveHomeworkQuestionAndContinue = (
    idx: number,
    alreadySaved = false,
  ) => {
    const source = editing.questions[idx];
    if (!source) return;
    const savedAt = new Date().toISOString();
    const moduleNo = Number(source.moduleNumber || activeHomeworkModule || 1);

    if (alreadySaved) {
      const updated = editing.questions.map((item, n) =>
        n === idx ? ({ ...item, builderSavedAt: savedAt } as any) : item,
      );
      commitEditing(
        { ...editing, questions: updated },
        { activeModule: moduleNo, activeQuestionIndex: idx },
      );
      notify("✓ Question updated successfully");
      return;
    }

    const groupId = source.contentGroupId || `CG-${Date.now()}`;
    const currentQuestions = editing.questions.map((item, n) =>
      n === idx
        ? ({ ...item, contentGroupId: groupId, builderSavedAt: savedAt } as any)
        : item,
    );
    const next = {
      ...blankQuestion(),
      moduleNumber: moduleNo,
      contentGroupId: groupId,
      supportType: source.supportType,
      supportText: source.supportText,
      supportUrl: source.supportUrl,
      supportCaption: source.supportCaption,
    };
    currentQuestions.splice(idx + 1, 0, next);
    commitEditing(
      { ...editing, questions: currentQuestions },
      { activeModule: moduleNo, activeQuestionIndex: idx + 1 },
    );
    setActiveHomeworkModule(moduleNo);
    setActiveQuestionIndex(idx + 1);
    notify("✓ Question saved · same Passage/PDF kept for the next question");
  };
  const openHomeworkSavedQuestionForReview = (idx: number) => {
    const item = editing.questions[idx];
    if (!item) return;
    const moduleNo = Number(item.moduleNumber || 1);
    setActiveHomeworkModule(moduleNo);
    setActiveQuestionIndex(idx);
  };
  const updateSharedContent = (
    idx: number,
    patch: Partial<HomeworkQuestion>,
  ) => {
    const source = editing.questions[idx];
    if (!source.contentGroupId) {
      updateQ(idx, patch);
      return;
    }
    const qs = editing.questions.map((x) =>
      x.contentGroupId === source.contentGroupId ? { ...x, ...patch } : x,
    );
    commitEditing({ ...editing, questions: qs });
  };
  const updateQ = (idx: number, patch: Partial<HomeworkQuestion>) => {
    const q = [...editing.questions];
    q[idx] = { ...q[idx], ...patch };
    commitEditing({ ...editing, questions: q });
  };
  const removeQ = (idx: number) => {
    const next = editing.questions.filter((_, i) => i !== idx);
    const nextIndex = Math.max(
      0,
      Math.min(activeQuestionIndex, next.length - 1),
    );
    commitEditing(
      { ...editing, questions: next },
      { activeQuestionIndex: nextIndex },
    );
    setActiveQuestionIndex(nextIndex);
  };
  const addChoice = (qIdx: number) => {
    const q = editing.questions[qIdx];
    const choices = [
      ...q.choices,
      `Choice ${String.fromCharCode(65 + q.choices.length)}`,
    ];
    updateQ(qIdx, { choices });
  };
  const updateChoice = (qIdx: number, cIdx: number, value: string) => {
    const q = editing.questions[qIdx];
    const choices = [...q.choices];
    choices[cIdx] = value;
    updateQ(qIdx, { choices });
  };
  const removeChoice = (qIdx: number, cIdx: number) => {
    const q = editing.questions[qIdx];
    if (q.choices.length <= 2) {
      notify("Each question must contain at least two answer choices");
      return;
    }
    const choices = q.choices.filter((_, i) => i !== cIdx);
    let correctIndex = q.correctIndex;
    if (cIdx === q.correctIndex) correctIndex = 0;
    else if (cIdx < q.correctIndex)
      correctIndex = Math.max(0, q.correctIndex - 1);
    updateQ(qIdx, { choices, correctIndex });
  };
  const moveQ = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= editing.questions.length) return;
    const qs = [...editing.questions];
    const tmp = qs[idx];
    qs[idx] = qs[to];
    qs[to] = tmp;
    commitEditing({ ...editing, questions: qs });
  };
  const moveQInsideHomeworkModule = (idx: number, dir: -1 | 1) => {
    const moduleNo = Number(editing.questions[idx]?.moduleNumber || activeHomeworkModule || 1);
    const indexes = editing.questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => Number(question.moduleNumber || 1) === moduleNo)
      .map(({ index }) => index);
    const local = indexes.indexOf(idx);
    const targetLocal = local + dir;
    if (local < 0 || targetLocal < 0 || targetLocal >= indexes.length) return;
    const target = indexes[targetLocal];
    const qs = [...editing.questions];
    [qs[idx], qs[target]] = [qs[target], qs[idx]];
    commitEditing(
      { ...editing, questions: qs },
      { activeModule: moduleNo, activeQuestionIndex: target },
    );
    setActiveHomeworkModule(moduleNo);
    setActiveQuestionIndex(target);
  };
  const reorderQ = (from: number, to: number) => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= editing.questions.length ||
      to >= editing.questions.length
    )
      return;
    const qs = [...editing.questions];
    const [moved] = qs.splice(from, 1);
    qs.splice(to, 0, moved);
    commitEditing({ ...editing, questions: qs }, { activeQuestionIndex: to });
    setActiveQuestionIndex(to);
    setDragQuestionIndex(null);
    notify(`Question moved to position ${to + 1}`);
  };
  const duplicateQ = (idx: number) => {
    const source = editing.questions[idx];
    const copy = {
      ...structuredClone(source),
      id: `${source.id}-COPY-${Date.now()}`,
    };
    const qs = [...editing.questions];
    qs.splice(idx + 1, 0, copy);
    commitEditing({ ...editing, questions: qs });
  };
  const plain = (html = "") =>
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
  const qIssue = (q: HomeworkQuestion) =>
    !plain(q.prompt)
      ? "Question text is missing"
      : q.type !== "written" &&
          (!Array.isArray(q.choices) || q.choices.length < 2)
        ? "At least 2 choices are required"
        : q.type !== "written" && q.choices.some((c) => !plain(String(c)))
          ? "One or more choices are empty"
          : q.type !== "written" &&
              (!Number.isInteger(q.correctIndex) ||
                q.correctIndex < 0 ||
                q.correctIndex >= q.choices.length)
            ? "Correct answer is missing"
            : q.supportType === "passage" && !plain(q.supportText || "")
              ? "Passage is empty"
              : q.supportType === "pdf" && !q.supportUrl
                ? "PDF file is missing"
                : (q.supportType === "image" || q.supportType === "diagram") &&
                    !q.supportUrl
                  ? "Image / diagram is missing"
                  : "";
  const qState = (q: HomeworkQuestion) => {
    const issue = qIssue(q);
    if (!issue) return "complete";
    if (!plain(q.prompt)) return "error";
    return "warning";
  };
  const issues = editing.questions
    .map((q, i) => ({ i, msg: qIssue(q) }))
    .filter((x) => x.msg);
  const totalPoints = editing.questions.reduce(
    (sum, q) => sum + (Number(q.points) || 0),
    0,
  );
  const activeQuestion = editing.questions[activeQuestionIndex];
  const homeworkModules = Array.from(
    new Set([
      ...(editing.moduleConfigs || []).map((c) => Number(c.number || 1)),
      ...editing.questions.map((q) => Number(q.moduleNumber || 1)),
      1,
    ]),
  ).sort((a, b) => a - b);
  const homeworkModuleCount = Math.max(1, ...homeworkModules);
  const moduleQuestionIndexes = editing.questions
    .map((q, i) => ({ q, i }))
    .filter((x) => Number(x.q.moduleNumber || 1) === activeHomeworkModule)
    .map((x) => x.i);
  const setHomeworkModule = (m: number) => {
    setActiveHomeworkModule(m);
    const first = editing.questions.findIndex(
      (q) => Number(q.moduleNumber || 1) === m,
    );
    setActiveQuestionIndex(first >= 0 ? first : 0);
  };
  const openAddHomeworkModule = () => {
    const m = homeworkModuleCount + 1;
    setNewModuleTitle(`Module ${m}`);
    setNewModuleTimed(false);
    setNewModuleDuration(30);
    setNewModuleHasBreak(false);
    setNewModuleBreakMinutes(5);
    setAddModuleOpen(true);
  };
  const createHomeworkModule = () => {
    const m = homeworkModuleCount + 1;
    const title = newModuleTitle.trim() || `Module ${m}`;
    const configs = homeworkModules.map((n) => moduleConfig(n));
    commitEditing(
      {
        ...editing,
        moduleConfigs: [
          ...configs,
          {
            number: m,
            title,
            section: editing.section || "Reading",
            durationMinutes: newModuleTimed ? Math.max(1, Number(newModuleDuration) || 1) : undefined,
            breakMinutes: newModuleHasBreak ? Math.max(1, Number(newModuleBreakMinutes) || 1) : 0,
            shuffleQuestions: false,
            allowReview: true,
          },
        ],
      },
      { activeModule: m },
    );
    setActiveHomeworkModule(m);
    setAddModuleOpen(false);
    setHomeworkModuleSettingsOpen(false);
    notify(`${title} created — 0 questions`);
  };
  const moduleConfig = (m: number): HomeworkModuleConfig => {
    const found = editing.moduleConfigs?.find((x) => Number(x.number) === m);
    return found
      ? { ...found, breakMinutes: Math.max(0, Number(found.breakMinutes || 0)) }
      : {
          number: m,
          title: `Module ${m}`,
          section: editing.section || "Reading",
          durationMinutes: undefined,
          breakMinutes: 0,
          shuffleQuestions: false,
          allowReview: true,
        };
  };
  const updateModuleConfig = (
    m: number,
    patch: Partial<HomeworkModuleConfig>,
  ) => {
    const current = homeworkModules.map((n) => moduleConfig(n));
    const exists = current.some((x) => x.number === m);
    const next = (exists ? current : [...current, moduleConfig(m)]).map((x) =>
      x.number === m
        ? {
            ...x,
            ...patch,
            number: m,
          }
        : x,
    );
    commitEditing({
      ...editing,
      estimatedMinutes: undefined,
      timeLimitMinutes: undefined,
      moduleConfigs: next,
    });
  };

  const normalizeModuleState = (
    questions: HomeworkQuestion[],
    configs: HomeworkModuleConfig[],
  ) => {
    const nums = Array.from(
      new Set([
        ...(configs || []).map((c) => Number(c.number || 1)),
        ...questions.map((q) => Number(q.moduleNumber || 1)),
      ]),
    ).sort((a, b) => a - b);
    const safeNums = nums.length ? nums : [1];
    const map = new Map(safeNums.map((old, i) => [old, i + 1]));
    const qs = questions.map((q) => ({
      ...q,
      moduleNumber: map.get(Number(q.moduleNumber || 1)) || 1,
    }));
    const cs = safeNums.map((old, i) => ({
      ...((configs || []).find((c) => Number(c.number) === old) ||
        moduleConfig(old)),
      number: i + 1,
    }));
    return { questions: qs, moduleConfigs: cs };
  };
  const duplicateHomeworkModule = (m: number) => {
    const source = editing.questions.filter(
      (q) => Number(q.moduleNumber || 1) === m,
    );
    const newNum = homeworkModuleCount + 1;
    const copies = source.map((q, i) => ({
      ...structuredClone(q),
      id: `${q.id}-M${newNum}-COPY-${Date.now()}-${i}`,
      moduleNumber: newNum,
      contentGroupId: q.contentGroupId
        ? `${q.contentGroupId}-M${newNum}-${Date.now()}`
        : "",
    }));
    const cfg = {
      ...moduleConfig(m),
      number: newNum,
      title: `${moduleConfig(m).title} Copy`,
    };
    const nextQuestions = [...editing.questions, ...copies];
    commitEditing(
      {
        ...editing,
        questions: nextQuestions,
        moduleConfigs: [...homeworkModules.map((n) => moduleConfig(n)), cfg],
      },
      {
        activeModule: newNum,
        activeQuestionIndex: copies.length
          ? editing.questions.length
          : activeQuestionIndex,
      },
    );
    setActiveHomeworkModule(newNum);
    if (copies.length) setActiveQuestionIndex(editing.questions.length);
    notify(`Duplicated ${moduleConfig(m).title}`);
  };
  const deleteHomeworkModule = (m: number) => {
    if (homeworkModules.length <= 1) {
      notify("At least one module is required.");
      return;
    }
    const count = editing.questions.filter(
      (q) => Number(q.moduleNumber || 1) === m,
    ).length;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete ${moduleConfig(m).title}${count ? ` and its ${count} question${count === 1 ? "" : "s"}` : ""}?`,
      )
    )
      return;
    const remaining = editing.questions.filter(
      (q) => Number(q.moduleNumber || 1) !== m,
    );
    const configs = homeworkModules
      .map((n) => moduleConfig(n))
      .filter((c) => Number(c.number) !== m);
    const normalized = normalizeModuleState(remaining, configs);
    const nextModules = normalized.moduleConfigs.map((c) => Number(c.number));
    const nextActive = Math.max(1, Math.min(m, Math.max(1, ...nextModules)));
    commitEditing({ ...editing, ...normalized }, { activeModule: nextActive });
    setActiveHomeworkModule(nextActive);
    const first = normalized.questions.findIndex(
      (q) => Number(q.moduleNumber || 1) === nextActive,
    );
    setActiveQuestionIndex(first >= 0 ? first : 0);
    notify("Module deleted.");
  };
  const moveHomeworkModule = (m: number, dir: -1 | 1) => {
    const index = homeworkModules.indexOf(m);
    const targetIndex = index + dir;
    if (index < 0 || targetIndex < 0 || targetIndex >= homeworkModules.length)
      return;
    const to = homeworkModules[targetIndex];
    const qs = editing.questions.map((q) => {
      const n = Number(q.moduleNumber || 1);
      return { ...q, moduleNumber: n === m ? to : n === to ? m : n };
    });
    const cfgs = homeworkModules
      .map((n) => moduleConfig(n))
      .map((c) => ({
        ...c,
        number: c.number === m ? to : c.number === to ? m : c.number,
      }))
      .sort((a, b) => a.number - b.number);
    commitEditing(
      { ...editing, questions: qs, moduleConfigs: cfgs },
      { activeModule: to },
    );
    setActiveHomeworkModule(to);
    const first = qs.findIndex((q) => Number(q.moduleNumber || 1) === to);
    setActiveQuestionIndex(first >= 0 ? first : 0);
  };
  const applyTypography = (
    scope: "module" | "all",
    kind: "passage" | "question",
  ) => {
    if (!activeQuestion) return;
    const patch =
      kind === "passage"
        ? {
            passageFontFamily: activeQuestion.passageFontFamily || "Arial",
            passageFontSize: activeQuestion.passageFontSize || 18,
            passageFontWeight: activeQuestion.passageFontWeight || 400,
            passageFontStyle: activeQuestion.passageFontStyle || "normal",
            passageTextAlign: activeQuestion.passageTextAlign || "left",
          }
        : {
            questionFontFamily: activeQuestion.questionFontFamily || "Arial",
            questionFontSize: activeQuestion.questionFontSize || 18,
            questionFontWeight: activeQuestion.questionFontWeight || 600,
            questionFontStyle: activeQuestion.questionFontStyle || "normal",
            questionTextAlign: activeQuestion.questionTextAlign || "left",
          };
    const qs = editing.questions.map((q) =>
      scope === "all" || Number(q.moduleNumber || 1) === activeHomeworkModule
        ? { ...q, ...patch }
        : q,
    );
    commitEditing({ ...editing, questions: qs });
    notify(
      `${kind === "passage" ? "Passage" : "Question"} font applied to ${scope === "all" ? "all homework questions" : moduleConfig(activeHomeworkModule).title}.`,
    );
  };

  const createHomeworkCopy = async (
    x: HomeworkItem,
    {
      openEditor = false,
      reassign = false,
    }: { openEditor?: boolean; reassign?: boolean } = {},
  ) => {
    const copy = {
      ...structuredClone(x),
      id: `${x.id}-COPY-${Date.now().toString().slice(-6)}`,
      title: `${x.title} — ${reassign ? "reassigned copy" : "copy"}`,
      status: "draft" as HomeworkStatus,
      createdAt: new Date().toISOString().slice(0, 10),
      publicationGroupId: undefined,
    };
    try {
      await persist([copy, ...items], [copy]);
      notify(
        reassign
          ? "A new reassignable copy was created"
          : "Homework duplicated successfully",
      );
      if (openEditor)
        router.push(`/homework-builder?id=${encodeURIComponent(copy.id)}`);
    } catch {}
    return copy;
  };
  const duplicate = (x: HomeworkItem) => {
    void createHomeworkCopy(x);
  };
  const archive = async (x: HomeworkItem) => {
    if (itemAction || bulkActionBusy) return;
    const members = publicationMembers(x);
    const ids = new Set(members.map((member) => member.id));
    const archived = members.map((member) => ({
      ...member, status: "archived" as HomeworkStatus,
    }));
    setBulkActionBusy("archive");
    try {
      await persist(items.map((item) =>
        ids.has(item.id) ? archived.find((member) => member.id === item.id)! : item,
      ), archived);
      notify("Homework archived for all assigned courses");
    } catch {
      showSaveFeedback("error", "Archive failed", "The server did not confirm archiving. Try again.");
    } finally {
      setBulkActionBusy(null);
    }
  };
  const republishArchived = async (x: HomeworkItem) => {
    if (itemAction) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Publish "${x.title}" again?\n\nA fresh homework will open now and remain available for 3 days. Previous submissions will stay attached only to the archived copy.`,
      )
    )
      return;
    const now = new Date(),
      due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const source = publicationMembers(x);
    const newGroupId = `${homeworkPublicationId(x)}-REPUBLISH-${Date.now()}`;
    const republished = source.map((member, index): HomeworkItem => ({
      ...structuredClone(member),
      id: `${newGroupId}-${index + 1}`,
      status: "published",
      opensAt: toLocalDateTime(now),
      dueAt: toLocalDateTime(due),
      createdAt: now.toISOString().slice(0, 10),
      publicationGroupId: source.length > 1 ? newGroupId : undefined,
    }));
    setItemAction({ id: x.id, kind: "republish" });
    try {
      await persist([...republished, ...items], republished);
      setExpandedHomeworkId(null);
      notify("Homework published again for students");
      showSaveFeedback(
        "success",
        "Published again successfully",
        "A fresh homework is now visible to the selected students for the next 3 days.",
      );
    } catch {
      showSaveFeedback(
        "error",
        "Publish again failed",
        "The archived homework was not changed. Check the connection and try again.",
      );
    } finally {
      setItemAction(null);
    }
  };
  const requestHomeworkDelete = (
    homeworks: HomeworkItem[],
    source: "archive" | "history" | "active" | "mixed",
  ) => {
    if (itemAction || bulkActionBusy) return;
    const ids = Array.from(
      new Set(homeworks.flatMap((homework) =>
        publicationMembers(homework).map((member) => member.id),
      ).filter(Boolean)),
    );
    if (!ids.length) return;
    setDeleteError("");
    setDeleteConfirm({ ids, source });
  };
  const deleteHomeworkPermanently = (
    x: HomeworkItem,
    source: "archive" | "history",
  ) => requestHomeworkDelete([x], source);
  const confirmHomeworkDelete = async () => {
    if (!deleteConfirm || itemAction) return;
    const ids = deleteConfirm.ids.filter((id) =>
      items.some((item) => item.id === id),
    );
    if (!ids.length) {
      setDeleteConfirm(null);
      return;
    }
    const idSet = new Set(ids);
    setDeleteError("");
    setItemAction({ id: ids.length === 1 ? ids[0] : "bulk", kind: "delete" });
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        Math.max(15_000, ids.length * 1_500),
      );
      let response: Response;
      try {
        response = await fetch("/api/admin/assignments?kind=homework", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "homework", ids }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false)
        throw new Error(data?.detail || data?.error || "DELETE_FAILED");
      const nextItems = items.filter((item) => !idSet.has(item.id));
      const nextSubmissions = submissions.filter(
        (row: any) =>
          !idSet.has(String(row.homeworkId || row.assignmentId || "")),
      );
      setItems(nextItems);
      setSubmissions(nextSubmissions);
      await writeLargeJson(HOMEWORK_STORAGE_KEY, nextItems);
      try {
        const local = JSON.parse(
          localStorage.getItem(HOMEWORK_SUBMISSIONS_KEY) || "[]",
        );
        if (Array.isArray(local))
          localStorage.setItem(
            HOMEWORK_SUBMISSIONS_KEY,
            JSON.stringify(
              local.filter(
                (row: any) =>
                  !idSet.has(String(row.homeworkId || row.assignmentId || "")),
              ),
            ),
          );
      } catch {}
      setSelectedHomeworkIds((previous) => {
        const next = { ...previous };
        for (const id of ids) {
          delete next[id];
          const member = items.find((item) => item.id === id);          if (member) delete next[homeworkPublicationId(member)];
        }
        return next;
      });
      setExpandedHomeworkId(null);
      setCompletedModalId(null);
      setResultHomeworkId(null);
      setDeleteConfirm(null);
      notify(
        ids.length === 1
          ? "Homework deleted"
          : `${ids.length} homework items deleted`,
      );
      showSaveFeedback(
        "success",
        ids.length === 1 ? "Homework deleted" : "Homework items deleted",
        ids.length === 1
          ? "The homework and its linked records were permanently removed."
          : `${ids.length} homework items and their linked records were permanently removed.`,
      );
    } catch (error: any) {
      const message =
        error?.name === "AbortError"
          ? "The server took too long to confirm deletion. Nothing was removed; please try again."
          : "Nothing was removed. Check the connection and try again.";
      setDeleteError(message);
      showSaveFeedback("error", "Delete failed", message);
    } finally {
      setItemAction(null);
    }
  };
  const requestBulkHomeworkAction = (
    kind: "archive" | "republish",
    homeworks: HomeworkItem[],
  ) => {
    if (itemAction || bulkActionBusy) return;
    const ids = Array.from(
      new Set(homeworks.map((homework) => homework.id).filter(Boolean)),
    );
    if (!ids.length) return;
    setBulkActionError("");
    setBulkActionConfirm({ kind, ids });
  };
  const confirmBulkHomeworkAction = async () => {
    if (!bulkActionConfirm || bulkActionBusy || itemAction) return;
    const selected = bulkActionConfirm.ids
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is HomeworkItem => Boolean(item));
    const membersById = new Map<string, HomeworkItem>();
    for (const member of selected.flatMap((item) => publicationMembers(item))) {
      membersById.set(member.id, member);
    }
    const members = [...membersById.values()];
    const actionable =
      bulkActionConfirm.kind === "archive"
        ? members.filter((item) => item.status !== "archived")
        : members.filter((item) => item.status === "archived");
    if (!actionable.length) {
      setBulkActionConfirm(null);
      return;
    }
    setBulkActionBusy(bulkActionConfirm.kind);
    setBulkActionError("");
    try {
      if (bulkActionConfirm.kind === "archive") {
        const ids = new Set(actionable.map((item) => item.id));
        const archivedItems = actionable.map((item) => ({
          ...item,
          status: "archived" as HomeworkStatus,
        }));
        const archivedById = new Map(
          archivedItems.map((item) => [item.id, item]),
        );
        await persist(
          items.map((item) =>
            ids.has(item.id) ? archivedById.get(item.id)! : item,
          ),
          archivedItems,
        );
        notify(
          `${archivedItems.length} homework item${archivedItems.length === 1 ? "" : "s"} archived`,
        );
        showSaveFeedback(
          "success",
          "Homework archived",
          `${archivedItems.length} selected homework item${archivedItems.length === 1 ? " was" : "s were"} moved to the archive.`,
        );
      } else {
        const now = new Date(),
          due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          stamp = Date.now();
        const groupIds = new Map<string, string>();
        const republished = actionable.map((item, index): HomeworkItem => {
          const sourceId = homeworkPublicationId(item);
          if (!groupIds.has(sourceId)) groupIds.set(sourceId, `${sourceId}-REPUBLISH-${stamp}`);
          return {
            ...structuredClone(item),
            id: `${groupIds.get(sourceId)}-${index + 1}`,
            status: "published",
            opensAt: toLocalDateTime(now),
            dueAt: toLocalDateTime(due),
            createdAt: now.toISOString().slice(0, 10),
            publicationGroupId: publicationMembers(item).length > 1
              ? groupIds.get(sourceId) : undefined,
          };
        });
        await persist([...republished, ...items], republished);
        notify(
          `${republished.length} archived homework item${republished.length === 1 ? "" : "s"} published again`,
        );
        showSaveFeedback(
          "success",
          "Homework published again",
          `${republished.length} fresh homework cop${republished.length === 1 ? "y is" : "ies are"} now visible for the next 3 days.`,
        );
      }
      setSelectedHomeworkIds({});
      setExpandedHomeworkId(null);
      setCompletedModalId(null);
      setBulkActionConfirm(null);
    } catch (error: any) {
      const message =
        error?.name === "AbortError"
          ? "The server took too long to finish this action. Please try again."
          : "The action could not be completed. Check the connection and try again.";
      setBulkActionError(message);
      showSaveFeedback("error", "Bulk action failed", message);
    } finally {
      setBulkActionBusy(null);
    }
  };
  const duplicateSelectedHomework = async (homeworks: HomeworkItem[]) => {
    if (itemAction || bulkActionBusy || !homeworks.length) return;
    setBulkActionBusy("duplicate");
    try {
      const stamp = Date.now();
      const copies = homeworks.map((item, index): HomeworkItem => ({
        ...structuredClone(item),
        id: `${item.id}-COPY-${stamp}-${index + 1}`,
        title: `${item.title} — copy`,
        status: "draft",
        createdAt: new Date().toISOString().slice(0, 10),
        publicationGroupId: undefined,
      }));
      await persist([...copies, ...items], copies);
      setSelectedHomeworkIds({});
      notify(
        `${copies.length} homework item${copies.length === 1 ? "" : "s"} duplicated`,
      );
      showSaveFeedback(
        "success",
        "Homework duplicated",
        `${copies.length} editable draft cop${copies.length === 1 ? "y was" : "ies were"} created successfully.`,
      );
    } catch (error: any) {
      showSaveFeedback(
        "error",
        "Duplicate failed",
        error?.name === "AbortError"
          ? "The server took too long to duplicate the selected homework."
          : "The selected homework could not be duplicated. Check the connection and try again.",
      );
    } finally {
      setBulkActionBusy(null);
    }
  };

  const uploadHomeworkMedia = async (
    file: File,
    kind:
      | "homework-support"
      | "homework-explanation-video"
      | "homework-explanation-file"
      | "homework-explanation-image",
  ) => {
    setMediaUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/admin/question-media", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url)
        throw new Error(homeworkMediaUploadError(data, res.status));
      return String(data.url);
    } finally {
      setMediaUploading(false);
    }
  };
  const importQuestionsFile = async (file?: File) => {
    if (!file) return;
    setFileImporting(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop() || "";
      let rows: any[] = [];
      if (ext === "json") {
        const raw = JSON.parse(await file.text());
        rows = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.questions)
            ? raw.questions
            : Array.isArray(raw?.items)
              ? raw.items
              : [raw];
      } else if (["xlsx", "xls", "csv"].includes(ext)) {
        const {workbook:wb,XLSX} = await readSpreadsheet(await file.arrayBuffer());
        const sh = wb.SheetNames[0];
        if (!sh) throw new Error("The file does not contain a worksheet");
        rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { defval: "" }) as any[];
      } else throw new Error("use Excel or CSV or JSON");
      const parsed = universalRowsToQuestions(rows, editing.course);
      const currentModule = 1;
      const existing = new Set(editing.questions.map((q: any) => String(q.id)));
      const mapped: HomeworkQuestion[] = parsed.questions.map(
        (q: any, i: number) =>
          ({
            id: existing.has(q.id) ? `${q.id}-FILE-${Date.now()}-${i}` : q.id,
            prompt: q.prompt,
            choices: q.choices,
            correctIndex: q.correctIndex,
            points: 1,
            explanation: q.explanation,
            type: "mcq",
            supportType: q.pdfUrl ? "pdf" : q.passage ? "passage" : "none",
            supportText: q.passage,
            supportUrl: q.pdfUrl,
            supportCaption: "",
            domain: q.domain,
            skill: q.skill,
            difficulty: q.difficulty,
            moduleNumber: q.moduleNumber || currentModule,
          }) as HomeworkQuestion,
      );
      if (!mapped.length) {
        notify(
          `Some questions could not be imported. ${parsed.errors.length} rows need review`,
        );
        setFileImportReport({
          name: file.name,
          total: parsed.total,
          added: 0,
          errors: parsed.errors.length,
        });
        return;
      }
      commitEditing(
        { ...editing, questions: [...editing.questions, ...mapped] },
        { activeQuestionIndex: editing.questions.length },
      );
      setActiveQuestionIndex(editing.questions.length);
      setFileImportReport({
        name: file.name,
        total: parsed.total,
        added: mapped.length,
        errors: parsed.errors.length,
      });
      notify(
        `Imported ${mapped.length} questions automatically${parsed.errors.length ? ` · ${parsed.errors.length} sf needs review` : ""}`,
      );
    } catch (e: any) {
      notify(`failed import file: ${e?.message || "Error"}`);
    } finally {
      setFileImporting(false);
    }
  };
  const downloadQuestionImportTemplate = async () => {
    const XLSX=await loadSpreadsheetEngine();
    const ws = XLSX.utils.json_to_sheet([
      {
        id: "Q-001",
        exam: editing.course,
        section: "Reading",
        module: 1,
        domain: "",
        skill: "",
        difficulty: "MEDIUM",
        passage: "Passage text",
        pdfUrl: "",
        question: "Question text",
        choiceA: "A",
        choiceB: "B",
        choiceC: "C",
        choiceD: "D",
        correctAnswer: "B",
        explanation: "Explanation",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "question-import-template.xlsx");
  };
  const importQuestionBank = async () => {
    setQuestionBankOpen(true);
    setQuestionBankLoading(true);
    setQuestionBankSelected({});
    setQuestionBankQuery("");
    setQuestionBankSkill("ALL");
    setQuestionBankDomain("ALL");
    setQuestionBankSubSkill("ALL");
    setQuestionBankDifficulty("ALL");
    setQuestionBankPreviewId("");
    try {
      const res = await fetch("/api/admin/question-bank", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "LOAD_FAILED");
      const raw = Array.isArray(data.questions) ? data.questions : [];
      const existing = new Set(editing.questions.map((q) => String(q.id)));
      const source = assignmentBankQuestionsForCourse(raw, editing.course)
        .filter((q: any) => !existing.has(String(q.id)));
      setQuestionBankItems(source);
      if (!source.length)
        notify(
          `No unused ${editing.course} questions are currently available in the Central Question Bank.`,
        );
    } catch (e: any) {
      notify(`Failed to load Central Question Bank: ${e?.message || "Error"}`);
      setQuestionBankItems([]);
    } finally {
      setQuestionBankLoading(false);
    }
  };
  const addSelectedQuestionBankQuestions = () => {
    const picked = questionBankItems.filter(
      (q: any) => questionBankSelected[String(q.id)],
    );
    if (!picked.length) {
      notify("Select at least one question first.");
      return;
    }
    const mapped: HomeworkQuestion[] = picked.map((q: any) =>
      bankQuestionToAssignmentQuestion(q, activeHomeworkModule),
    );
    const firstIndex = editing.questions.length;
    commitEditing({ ...editing, questions: [...editing.questions, ...mapped] });
    setActiveQuestionIndex(firstIndex);
    setQuestionBankOpen(false);
    setQuestionBankSelected({});
    notify(
      `Added ${mapped.length} selected question${mapped.length === 1 ? "" : "s"} from Question Bank.`,
    );
  };

  return (
    <main
      className={`hw-admin-page admin-homework-v405 admin-homework-v426 ${fullScreen ? "hw-builder-fullscreen" : ""}`}
      dir="ltr"
    >
      {" "}
      {fullScreen ? null : (
        <header className="hw-admin-hero simple">
          <div>
            <span className="hw496-live-pill">
              <i /> Assignment Command Center
            </span>
            <small>ACADEMIC OPERATIONS / HOMEWORK</small>
            <h1>Homework Management</h1>
            <p>
              Create, schedule, publish and monitor every assignment from one
              focused workspace.
            </p>
          </div>
          <div className="hw426-hero-actions">
            <AdminPageHelp helpKey="homework"/>
            <Link className="hw-new-homework" href="/homework-builder">
              <span>＋</span> New Homework
            </Link>
          </div>
        </header>
      )}{" "}
      {sharedHomeworkWaiting && (
        <div className="hw-admin-sync-banner" role="status">Another administrator updated homework while this editor was open. Your unsaved work is preserved; the shared directory will refresh when you return to the list.</div>
      )}
      {!fullScreen && homeworkItemsReady && directoryMode === "local" && (
        <div className="hw-admin-sync-banner" role="alert">
          Central homework storage is not configured. Work on this device cannot be shared with other administrators.
        </div>
      )}
      {homeworkItemsReady && directoryMode === "database" && localOnlyIds.size > 0 && (
        <div className="hw-admin-sync-banner" role="status">
          {localOnlyIds.size} browser-only homework record(s) were preserved for recovery. They are not published on the server; open one and Save to sync it explicitly.
        </div>
      )}
      {!fullScreen && (
        <>
          <section className="hw-admin-kpis">
            <article>
              <span>▦</span>
              <div>
                <small>Total Homework</small>
                <b>{adminPublications.length}</b>
                <em>All assignments</em>
              </div>
            </article>
            <article>
              <span>●</span>
              <div>
                <small>Published</small>
                <b>{adminPublications.filter((x) => x.status === "published" && publicationMembers(x).every((member) => !localOnlyIds.has(member.id))).length}</b>
                <em>Visible to students</em>
              </div>
            </article>
            <article>
              <span>◷</span>
              <div>
                <small>Scheduled</small>
                <b>{adminPublications.filter((x) => x.status === "scheduled").length}</b>
                <em>Waiting to open</em>
              </div>
            </article>
            <article>
              <span>✓</span>
              <div>
                <small>Submissions</small>
                <b>{submissions.length}</b>
                <em>Recorded attempts</em>
              </div>
            </article>
          </section>{" "}
          <div className="hw-admin-tabs">
            <button
              className={tab === "list" ? "active" : ""}
              onClick={() => setTab("list")}
            >
              Homework
            </button>
            <Link
              className={`hw-prepare-tab ${tab === "editor" ? "active" : ""}`}
              href="/homework-builder"
            >
              <span>✦</span> Homework Setup
            </Link>
            <button
              className={tab === "results" ? "active" : ""}
              onClick={() => setTab("results")}
            >
              Submissions
            </button>
          </div>
        </>
      )}{" "}
      {tab === "list" && !fullScreen && (
        <section className="hw-admin-panel hw-admin-board-panel">
          <div className="hw-admin-filters">
            <div className="hw496-filter-heading">
              <span>⌕</span>
              <div>
                <small>ASSIGNMENT DIRECTORY</small>
                <b>Find and organize homework</b>
              </div>
            </div>
            <div className="hw496-filter-controls">
              <input
                aria-label="Search homework"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, staff, section or lesson..."
              />
              <select
                aria-label="Filter homework by course"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="ALL">All Courses</option>
                {homeworkCourses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter homework by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <button className="hw-directory-refresh" type="button" onClick={() => void refreshDirectory()} disabled={directoryRefreshing || !homeworkItemsReady}>
                {directoryRefreshing ? "Refreshing…" : "↻ Refresh shared homework"}
              </button>
            </div>
          </div>
          {(() => {
            if (!homeworkItemsReady) {
              return (
                <div className="hw-board-empty" role="status">
                  Loading homework…
                </div>
              );
            }
            const now = Date.now();
            const archived = visible.filter((x) => x.status === "archived");
            const ended = visible.filter(
              (x) =>
                x.status !== "archived" &&
                (x.status === "closed" || new Date(x.dueAt).getTime() < now),
            );
            const live = visible.filter(
              (x) => x.status !== "archived" && !ended.includes(x),
            );
            const archiveMatches = archived.filter((x) =>
              `${x.title} ${x.employee} ${x.course} ${x.section || ""} ${x.lesson || ""}`
                .toLowerCase()
                .includes(archiveQuery.toLowerCase()),
            );
            const archiveShown = archiveMatches.slice(0, archiveLimit);
            const renderCard = (x: HomeworkItem) => {
              const opens = new Date(x.opensAt).getTime(),
                due = new Date(x.dueAt).getTime();
              const phase =
                x.status === "archived"
                  ? "archived"
                  : due < now || x.status === "closed"
                    ? "completed"
                    : opens > now || x.status === "scheduled"
                      ? "upcoming"
                      : "active";
              const real = publicationSubmissions(x);
              const totalStudents = publicationStudentCount(x);
              const submitted = real.length;
              const pct = Math.max(
                0,
                Math.min(100, totalStudents ? Math.round((submitted / totalStudents) * 100) : 0),
              );
              const phaseLabel =
                phase === "active"
                  ? "Active Now"
                  : phase === "upcoming"
                    ? "Upcoming"
                    : phase === "archived"
                      ? "Archived"
                      : "Completed";
              const expanded = expandedHomeworkId === x.id;
              const isCompleted = phase === "completed";
              const selected = Boolean(selectedHomeworkIds[homeworkPublicationId(x)]);
              const browserOnly = publicationMembers(x).some((member) => localOnlyIds.has(member.id));
              return (
                <article
                  className={`hw-premium-card hw-collapsible ${courseVisualClass(x.course)} ${phase} ${expanded ? "is-open" : "is-closed"} ${selected ? "is-selected" : ""}`}
                  key={x.id}
                >
                  <label
                    className="hw-homework-select"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        setSelectedHomeworkIds((previous) => ({
                          ...previous,
                          [homeworkPublicationId(x)]: event.target.checked,
                        }))
                      }
                      aria-label={`Select ${x.title} for bulk actions`}
                    />
                    <span aria-hidden="true">✓</span>
                  </label>
                  <button
                    type="button"
                    className="hw-card-summary"
                    onClick={() =>
                      phase !== "archived"
                        ? (setSubmissionCourseFilter("ALL"), setCompletedModalId(x.id))
                        : (setSubmissionCourseFilter("ALL"), setExpandedHomeworkId(expanded ? null : x.id))
                    }
                    aria-expanded={phase !== "archived" ? false : expanded}
                  >
                    <span className="hw-summary-main">
                      <span className="hw-summary-title-row">
                        <strong>{x.title}</strong>
                        <i className={`hw-phase-chip ${phase}`}>{phaseLabel}</i>
                      </span>
                      <small>
                        {publicationLabel(x)} <b>•</b> {x.section || "No Section"} <b>•</b>{" "}
                        {x.questions.length} question
                        {x.questions.length === 1 ? "" : "s"}
                      </small>
                      {isCompleted && (
                        <span className="hw-completed-mini">
                          {submitted} / {totalStudents ?? "—"} students {totalStudents !== null ? `• ${pct}% submitted` : "submitted"}
                        </span>
                      )}
                    </span>
                    <span className="hw-summary-side">
                      <span>
                        <small>
                          {phase === "completed" || phase === "archived"
                            ? "Ended"
                            : "Opens / Due"}
                        </small>
                        <strong>
                          {new Date(x.dueAt).toLocaleString("en-US", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </strong>
                      </span>
                      <i className="hw-expand-icon">
                        {phase !== "archived" ? "↗" : expanded ? "−" : "+"}
                      </i>
                    </span>
                  </button>
                  {expanded && phase === "archived" && (
                    <div className="hw-card-expanded">
                      <div className="hw-premium-card-top">
                        <div className="hw-course-chip">{x.course}</div>
                        <i className={`hw-phase-chip ${phase}`}>{phaseLabel}</i>
                      </div>
                      <p>
                        {x.section || "No Section"} <b>•</b>{" "}
                        {x.lesson || "No Lesson"} <b>•</b> {x.questions.length}{" "}
                        question
                      </p>
                      <div className="hw-card-meta">
                        <span>
                          <small>Assigned by</small>
                          <strong>{x.employee}</strong>
                        </span>
                        <span>
                          <small>Opens</small>
                          <strong>
                            {new Date(x.opensAt).toLocaleString("en-US", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                        </span>
                        <span>
                          <small>Due</small>
                          <strong>
                            {new Date(x.dueAt).toLocaleString("en-US", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </strong>
                        </span>
                      </div>
                      <div className="hw-submit-compact">
                        <span>Submissions</span>
                        <strong>
                          {submitted} / {totalStudents ?? "—"} students
                        </strong>
                        <small>{totalStudents !== null ? `${pct}% submitted` : "Enrolment count unavailable"}</small>
                      </div>
                      <div
                        className={`hw-card-actions ${phase === "archived" ? "hw-archive-actions" : ""}`}
                      >
                        <Link
                          className="primary"
                          href={`/homework-builder?id=${encodeURIComponent(x.id)}`}
                        >
                          Open / Edit
                        </Link>
                        <Link
                          href={`/homework/session?id=${encodeURIComponent(x.id)}&preview=admin`}
                        >
                          Preview
                        </Link>
                        <button onClick={() => duplicate(x)}>Duplicate</button>
                        {phase === "archived" ? (
                          <>
                            <button
                              className="restore"
                              disabled={Boolean(itemAction)}
                              onClick={() => void republishArchived(x)}
                            >
                              {itemAction?.id === x.id &&
                              itemAction.kind === "republish"
                                ? "Publishing…"
                                : "Publish Again"}
                            </button>
                            <button
                              className="delete-permanent"
                              disabled={Boolean(itemAction)}
                              onClick={() =>
                                void deleteHomeworkPermanently(x, "archive")
                              }
                            >
                              {itemAction?.id === x.id &&
                              itemAction.kind === "delete"
                                ? "Deleting…"
                                : "Delete Permanently"}
                            </button>
                          </>
                        ) : (
                          <button
                            className="archive"
                            onClick={() => archive(x)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            };
            const selectedRows = adminPublications.filter(
              (item) => selectedHomeworkIds[homeworkPublicationId(item)],
            );
            const selectedIds = selectedRows.map((item) => item.id);
            const shownRows = [...live, ...ended, ...archiveShown];
            const allShownSelected =
              shownRows.length > 0 &&
              shownRows.every((item) => selectedHomeworkIds[homeworkPublicationId(item)]);
            const archiveableRows = selectedRows.filter(
              (item) => item.status !== "archived",
            );
            const republishableRows = selectedRows.filter(
              (item) => item.status === "archived",
            );
            const setRowsSelected = (rows: HomeworkItem[], value: boolean) =>
              setSelectedHomeworkIds((previous) => {
                const next = { ...previous };
                for (const row of rows) next[homeworkPublicationId(row)] = value;
                return next;
              });
            const selectedSource: "archive" | "history" | "active" | "mixed" =
              selectedRows.every((item) => item.status === "archived")
                ? "archive"
                : selectedRows.every(
                      (item) =>
                        item.status !== "archived" &&
                        (item.status === "closed" ||
                          new Date(item.dueAt).getTime() < now),
                    )
                  ? "history"
                  : selectedRows.every(
                        (item) =>
                          item.status !== "archived" &&
                          item.status !== "closed" &&
                          new Date(item.dueAt).getTime() >= now,
                      )
                    ? "active"
                    : "mixed";
            return (
              <>
                <div
                  className={`hw-bulk-toolbar ${selectedIds.length ? "has-selection" : ""}`}
                >
                  <div>
                    <span>✓</span>
                    <p>
                      <b>Bulk Homework Actions</b>
                      <small>
                        {selectedIds.length
                          ? `${selectedIds.length} selected — choose an action`
                          : "Mark any homework to select it"}
                      </small>
                    </p>
                  </div>
                  <div className="hw-bulk-toolbar-actions">
                    <button
                      type="button"
                      disabled={
                        !shownRows.length ||
                        Boolean(itemAction) ||
                        Boolean(bulkActionBusy)
                      }
                      onClick={() =>
                        setRowsSelected(shownRows, !allShownSelected)
                      }
                    >
                      {allShownSelected
                        ? "Unselect All Shown"
                        : "Select All Shown"}
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedHomeworkIds({})}
                      >
                        Clear Selection
                      </button>
                    )}
                    {selectedIds.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="archive-selected"
                          disabled={
                            !archiveableRows.length ||
                            Boolean(itemAction) ||
                            Boolean(bulkActionBusy)
                          }
                          onClick={() =>
                            requestBulkHomeworkAction(
                              "archive",
                              archiveableRows,
                            )
                          }
                        >
                          {bulkActionBusy === "archive"
                            ? "Archiving…"
                            : `Archive Selected (${archiveableRows.length})`}
                        </button>
                        <button
                          type="button"
                          className="restore-selected"
                          disabled={
                            !republishableRows.length ||
                            Boolean(itemAction) ||
                            Boolean(bulkActionBusy)
                          }
                          onClick={() =>
                            requestBulkHomeworkAction(
                              "republish",
                              republishableRows,
                            )
                          }
                        >
                          {bulkActionBusy === "republish"
                            ? "Publishing…"
                            : `Publish Again (${republishableRows.length})`}
                        </button>
                        <button
                          type="button"
                          className="duplicate-selected"
                          disabled={
                            Boolean(itemAction) || Boolean(bulkActionBusy)
                          }
                          onClick={() =>
                            void duplicateSelectedHomework(selectedRows)
                          }
                        >
                          {bulkActionBusy === "duplicate"
                            ? "Duplicating…"
                            : `Duplicate Selected (${selectedIds.length})`}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={
                            Boolean(itemAction) || Boolean(bulkActionBusy)
                          }
                          onClick={() =>
                            requestHomeworkDelete(selectedRows, selectedSource)
                          }
                        >
                          Delete Selected ({selectedIds.length})
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="hw592-homework-directory">
                  <div className="hw592-directory-head">
                    <span>Homework</span>
                    <span>Course</span>
                    <span>Questions</span>
                    <span>Status</span>
                    <span>Due date</span>
                    <span>Submissions</span>
                    <span>Actions</span>
                  </div>
                  <div className="hw592-directory-body">
                    {shownRows
                      .filter((x) => {
                        if (statusFilter === "ALL") return true;
                        if (x.status === "archived") return statusFilter === "archived";
                        const opens = new Date(x.opensAt).getTime();
                        const due = new Date(x.dueAt).getTime();
                        const phase =
                          due < now || x.status === "closed"
                            ? "completed"
                            : opens > now || x.status === "scheduled"
                              ? "upcoming"
                              : "active";
                        return phase === statusFilter;
                      })
                      .map((x) => {
                        const opens = new Date(x.opensAt).getTime();
                        const due = new Date(x.dueAt).getTime();
                        const phase =
                          x.status === "archived"
                            ? "archived"
                            : due < now || x.status === "closed"
                              ? "completed"
                              : opens > now || x.status === "scheduled"
                                ? "upcoming"
                                : "active";
                        const phaseLabel = phase === "active" ? "Active" : phase === "upcoming" ? "Upcoming" : phase === "completed" ? "Completed" : "Archived";
                        const real = publicationSubmissions(x);
                        const selected = Boolean(selectedHomeworkIds[homeworkPublicationId(x)]);
                        const browserOnly = publicationMembers(x).some((member) => localOnlyIds.has(member.id));
                        return (
                          <article key={x.id} className={`hw592-directory-row ${selected ? "is-selected" : ""}`}>
                            <label className="hw592-row-select">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) =>
                                  setSelectedHomeworkIds((previous) => ({ ...previous, [homeworkPublicationId(x)]: event.target.checked }))
                                }
                              />
                            </label>
                            <div className="hw592-row-title">
                              <strong>{x.title}</strong>
                              <small>{x.section || "No Section"}{x.lesson ? ` • ${x.lesson}` : ""}</small>
                            </div>
                            <div className="hw592-row-course"><span>{publicationLabel(x)}</span></div>
                            <div className="hw592-row-number"><b>{x.questions.length}</b></div>
                            <div><i className={`hw-phase-chip ${phase}`}>{phaseLabel}</i></div>
                            <div className="hw592-row-date">
                              <strong>{new Date(x.dueAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}</strong>
                              <small>{new Date(x.dueAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</small>
                            </div>
                            <div className="hw592-row-submissions"><b>{real.length}</b><small>received</small></div>
                            <div className="hw592-row-actions">
                              <Link className="primary" href={`/homework-builder?id=${encodeURIComponent(x.id)}`}>Open</Link>
                              <Link href={`/homework/session?id=${encodeURIComponent(x.id)}&preview=admin`}>Preview</Link>
                              <button type="button" onClick={() => duplicate(x)}>Duplicate</button>
                              {phase === "archived" ? (
                                <button type="button" className="restore" disabled={Boolean(itemAction)} onClick={() => void republishArchived(x)}>Publish Again</button>
                              ) : (
                                <button type="button" className="archive" onClick={() => archive(x)}>Archive</button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    {!shownRows.filter((x) => {
                      if (statusFilter === "ALL") return true;
                      if (x.status === "archived") return statusFilter === "archived";
                      const opens = new Date(x.opensAt).getTime();
                      const due = new Date(x.dueAt).getTime();
                      const phase = due < now || x.status === "closed" ? "completed" : opens > now || x.status === "scheduled" ? "upcoming" : "active";
                      return phase === statusFilter;
                    }).length && <div className="hw-board-empty">No homework matches these filters.</div>}
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}{" "}
      {!fullScreen &&
        completedModalId &&
        (() => {
          const x = items.find((i) => i.id === completedModalId);
          if (!x) return null;
          const allReal = publicationSubmissions(x);
          const real = allReal.filter((row: any) => submissionCourseFilter === "ALL" ||
            items.find((item) => item.id === String(row.homeworkId || row.assignmentId || ""))?.course === submissionCourseFilter);
          const totalStudents = publicationStudentCount(x, submissionCourseFilter);
          const submitted = real.length;
          const missing = totalStudents === null ? null : Math.max(0, totalStudents - submitted);
          const scores = real
            .map((r: any) =>
              Number(r.total) > 0
                ? Math.round((Number(r.score || 0) / Number(r.total)) * 100)
                : Number(r.percent || 0),
            )
            .filter((n: number) => Number.isFinite(n));
          const avg = scores.length
            ? Math.round(
                scores.reduce((a: number, b: number) => a + b, 0) /
                  scores.length,
              )
            : null;
          const highest = scores.length ? Math.max(...scores) : null;
          const latest = real
            .slice()
            .sort(
              (a: any, b: any) =>
                new Date(b.submittedAt || 0).getTime() -
                new Date(a.submittedAt || 0).getTime(),
            )[0];
          return (
            <div
              className="hw-details-backdrop"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setCompletedModalId(null);
              }}
            >
              <section
                className="hw-details-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Homework student activity: ${x.title}`}
              >
                <header className="hw-details-head">
                  <div>
                    <small>
                      {new Date(x.dueAt).getTime() < Date.now() ||                      x.status === "closed"
                        ? "COMPLETED HOMEWORK"
                        : "LIVE HOMEWORK"}{" "}
                      / STUDENT ACTIVITY
                    </small>
                    <h2>{x.title}</h2>
                    <p>
                      {publicationLabel(x)} • {x.section || "No Section"} •{" "}
                      {x.lesson || "No Lesson"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="hw-details-close"
                    onClick={() => setCompletedModalId(null)}
                  >
                    ×
                  </button>
                </header>
                {courseSubmissionFilters(x)}
                <div className="hw-details-body">
                  <div className="hw-details-overview">
                    <article>
                      <small>Assigned by</small>
                      <strong>{x.employee}</strong>
                    </article>
                    <article>
                      <small>Questions</small>
                      <strong>{x.questions.length}</strong>
                    </article>
                    <article>
                      <small>Opens</small>
                      <strong>
                        {new Date(x.opensAt).toLocaleString("en-US")}
                      </strong>
                    </article>
                    <article>
                      <small>Ended</small>
                      <strong>
                        {new Date(x.dueAt).toLocaleString("en-US")}
                      </strong>
                    </article>
                  </div>
                  <div className="hw-details-kpis">
                    <article>
                      <span>✓</span>
                      <div>
                        <small>Submitted</small>
                        <strong>
                          {submitted} / {totalStudents ?? "—"}
                        </strong>
                        <em>
                          {totalStudents === null
                            ? "Enrolment count unavailable"
                            : `${totalStudents ? Math.round((submitted / totalStudents) * 100) : 0}% of assigned students`}
                        </em>
                      </div>
                    </article>
                    <article>
                      <span>○</span>
                      <div>
                        <small>Not Submitted</small>
                        <strong>{missing ?? "—"}</strong>
                        <em>Students still missing</em>
                      </div>
                    </article>
                    <article>
                      <span>★</span>
                      <div>
                        <small>Average Score</small>
                        <strong>{avg === null ? "—" : `${avg}%`}</strong>
                        <em>
                          {scores.length
                            ? `Highest ${highest}%`
                            : "No scored submissions"}
                        </em>
                      </div>
                    </article>
                    <article>
                      <span>◷</span>
                      <div>
                        <small>Latest Submission</small>
                        <strong>
                          {latest?.submittedAt
                            ? new Date(latest.submittedAt).toLocaleDateString(
                                "en-US",
                              )
                            : "—"}
                        </strong>
                        <em>{latest?.student || "No submission yet"}</em>
                      </div>
                    </article>
                  </div>
                  <div className="hw-details-section">
                    <div className="hw-details-section-head">
                      <div>
                        <small>ASSIGNMENT INFORMATION</small>
                        <h3>Homework setup</h3>
                      </div>
                    </div>
                    <div className="hw-details-grid">
                      <span>
                        <small>Target Group</small>
                        <b>{x.targetGroup || "All Students"}</b>
                      </span>
                      <span>
                        <small>Attempts</small>
                        <b>{x.attempts}</b>
                      </span>
                      <span>
                        <small>Mode</small>
                        <b>{modeArabic[x.mode] || x.mode}</b>
                      </span>
                      <span>
                        <small>Show Result</small>
                        <b>{x.showResult ? "Yes" : "No"}</b>
                      </span>
                      <span>
                        <small>Answers</small>
                        <b>{x.showAnswers}</b>
                      </span>
                    </div>
                    {x.instructions && (
                      <div className="hw-details-instructions">
                        <small>Instructions</small>
                        <p>{x.instructions}</p>
                      </div>
                    )}
                  </div>
                  <div className="hw-details-section">
                    <div className="hw-details-section-head">
                      <div>
                        <small>RECENT ACTIVITY</small>
                        <h3>Student submissions & scores</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedModalId(null);
                          setTab("results");
                          setResultHomeworkId(x.id);
                        }}
                      >
                        View all submissions
                      </button>
                    </div>
                    <div className="hw-details-submissions">
                      {real.length ? (
                        real.map((row: any, n: number) => (
                          <article
                            key={`${x.id}-modal-${n}`}
                            className="hw445-submission-row"
                          >
                            <div>
                              <b>{row.student || "Student"}</b>
                              <small>{items.find((item) => item.id === row.homeworkId)?.course || x.course} · </small>
                              <small>
                                {row.submittedAt
                                  ? new Date(row.submittedAt).toLocaleString(
                                      "en-US",
                                    )
                                  : "—"}
                              </small>
                            </div>
                            <strong>
                              {Number(row.total) > 0
                                ? Math.round(
                                    (Number(row.score || 0) /
                                      Number(row.total)) *
                                      100,
                                  )
                                : Number(row.percent || 0)}
                              %
                            </strong>
                            <span>
                              {Number(row.score || 0)} /{" "}
                              {Number(row.total || x.questions.length || 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setReviewSubmission({ homework: items.find((item) => item.id === row.homeworkId) || x, row })
                              }
                            >
                              Review Answers
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className="hw-details-empty">
                          No recorded submissions for this homework yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <footer className="hw-details-actions">
                  <Link
                    href={`/homework/session?id=${encodeURIComponent(x.id)}&preview=admin`}
                  >
                    Preview Homework
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedModalId(null);
                      setTab("results");
                      setResultHomeworkId(x.id);
                    }}
                  >
                    View Submissions
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      void createHomeworkCopy(x, { openEditor: true })
                    }
                  >
                    Duplicate & Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void createHomeworkCopy(x, {
                        openEditor: true,
                        reassign: true,
                      })
                    }
                  >
                    Reassign / Publish Again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      archive(x);
                      setCompletedModalId(null);
                    }}
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    className="danger permanent"
                    disabled={Boolean(itemAction)}
                    onClick={() => void deleteHomeworkPermanently(x, "history")}
                  >
                    {itemAction?.id === x.id && itemAction.kind === "delete"
                      ? "Deleting…"
                      : "Delete from History"}
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}{" "}
      {(tab === "editor" || fullScreen) && (
        <>
          <section className="hw272-shell">
            <section className="v268-builder-top hw308-homework-exam-copy">
              <div className="v268-builder-heading">
                <div className="v268-builder-heading-main">
                  <Link
                    className="hw457-builder-back"
                    href="/admin/homework"
                    aria-label="Back to Homework Management"
                  >
                    ← <span>Back to Homework</span>
                  </Link>
                  <div className="v268-builder-title-copy">
                    <small>HOMEWORK BUILDER</small>
                    <h1>{editing.title || "New Homework"}</h1>
                    <span className="v268-saved-dot">●</span>
                    <em>
                      {autoSavedAt
                        ? `Saved ${autoSavedAt}`
                        : "Simple workspace"}
                    </em>
                  </div>
                </div>
                <div className="v268-top-actions">
                  <button
                    type="button"
                    className="hw495-create-new"
                    disabled={saveAction !== "idle"}
                    onClick={startNewHomework}
                  >
                    <span>＋</span> Create New Homework
                  </button>
                  {editing.id && (
                    <button type="button" onClick={previewCurrent}>
                      Preview as Student
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary"
                    disabled={saveAction !== "idle"}
                    onClick={saveCurrent}
                  >
                    {saveAction === "saving"
                      ? "Saving…"
                      : saveFeedback?.kind === "success" &&
                          saveFeedback.title.startsWith("Saved")
                        ? "✓ Saved"
                        : "Save"}
                  </button>
                  <button
                    type="button"
                    className="publish"
                    onClick={() => setBuilderStep("review")}
                  >
                    Publish
                  </button>
                </div>
              </div>

              <div className="v295-step-buttons">
                <button
                  type="button"
                  className="basic"
                  onClick={() => setBuilderStep("info")}
                >
                  <b>1</b>
                  <span>
                    <strong>Basic Info</strong>
                    <small>Homework details & rules</small>
                  </span>
                  <i>›</i>
                </button>
                <button
                  type="button"
                  className="questions"
                  onClick={() => {
                    setBuilderStep(null);
                    window.setTimeout(
                      () =>
                        document
                          .getElementById("hw308-question-workspace")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      40,
                    );
                  }}
                >
                  <b>2</b>
                  <span>
                    <strong>Questions</strong>
                    <small>Create & edit questions</small>
                  </span>
                  <i>›</i>
                </button>
                <button
                  type="button"
                  className="assign"
                  onClick={() => setBuilderStep("assign")}
                >
                  <b>3</b>
                  <span>
                    <strong>Assign Students</strong>
                    <small>Students & schedule</small>
                  </span>
                  <i>›</i>
                </button>
                <button
                  type="button"
                  className="review"
                  onClick={() => setBuilderStep("review")}
                >
                  <b>4</b>
                  <span>
                    <strong>Review & Publish</strong>
                    <small>Final check & publish</small>
                  </span>
                  <i>›</i>
                </button>
              </div>

              <div className="v291-modulebar">
                <div className="v268-module-tabs">
                  {homeworkModules.map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={activeHomeworkModule === m ? "active" : ""}
                      onClick={() => setHomeworkModule(m)}
                    >
                      <b>{moduleConfig(m).title}</b>
                      <small>
                        {
                          editing.questions.filter(
                            (q) => Number(q.moduleNumber || 1) === m,
                          ).length
                        }{" "}
                        questions · {Number(moduleConfig(m).durationMinutes||0)>0?`⏱ ${Number(moduleConfig(m).durationMinutes)}m`:"Untimed"}{Number(moduleConfig(m).breakMinutes||0)>0?` · ☕ ${Number(moduleConfig(m).breakMinutes)}m`:""}
                      </small>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="add"
                    onClick={openAddHomeworkModule}
                  >
                    + Add Module
                  </button>
                </div>
                <div className="v291-module-actions">
                  <button
                    type="button"
                    className="bank-primary"
                    onClick={importQuestionBank}
                  >
                    ＋ Question Bank
                  </button>
                  <label className="compact-import">
                    ⇧ Import File
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.json"
                      disabled={fileImporting}
                      onChange={(e) => {
                        const input = e.currentTarget;
                        const f = input.files?.[0];
                        importQuestionsFile(f);
                        input.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowIssues((v) => !v)}
                  >
                    ⚙ Question Settings
                  </button>
                  <button
                    type="button"
                    className="module-settings-btn"
                    onClick={() => setHomeworkModuleSettingsOpen((v) => !v)}
                  >
                    ⚙ Module Settings
                  </button>
                  <span>{homeworkModules.some((m)=>Number(moduleConfig(m).durationMinutes||0)>0)?"Module timing enabled":"Untimed homework"}</span>
                </div>
              </div>
            </section>

            {builderStep === "info" && (
              <div
                className="v295-step-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setBuilderStep(null);
                }}
              >
                <section className="v295-step-modal step-basic">
                  <header>
                    <div>
                      <small>HOMEWORK BUILDER · STEP 1</small>
                      <h2>Basic Information</h2>
                      <p>
                        Set the homework identity, course and student
                        instructions.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="close"
                      onClick={() => setBuilderStep(null)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="v295-step-body">
                    <div className="v295-form-grid">
                      <label className="wide">
                        Homework Name
                        <input
                          value={editing.title}
                          onChange={(e) =>
                            commitEditing({ ...editing, title: e.target.value })
                          }
                          placeholder="Example: SAT Reading — Week 4"
                        />
                      </label>
                      <label>
                        Course
                        <select
                          value={
                            publishAllCourses ? "ALL_COURSES" : editing.course
                          }
                          onChange={(e) => {
                            const all = e.target.value === "ALL_COURSES";
                            if (!all && homeworkPublicationMembers(items, editing).length > 1) {
                              notify("Duplicate the homework first to create a separate course assignment.");
                              return;
                            }
                            setPublishAllCourses(all);
                            if (all)
                              commitEditing({
                                ...editing,
                                targetGroup: "All Students",
                              });
                            else
                              commitEditing({
                                ...editing,
                                course: e.target.value as HomeworkCourse,
                              });
                          }}
                        >
                          <option value="ALL_COURSES">
                            All Courses — Publish to Everyone
                          </option>
                          {homeworkCourses.map((c) => (
                            <option key={c} value={c} disabled={homeworkPublicationMembers(items, editing).length > 1}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <small className="hw498-course-hint">
                          {publishAllCourses
                            ? "One homework in administration, available to all five courses. Existing student submissions remain linked to their course."
                            : `This homework will be assigned only to ${editing.course}.`}
                        </small>
                      </label>
                      <label>
                        Section
                        <input
                          value={editing.section || ""}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              section: e.target.value,
                            })
                          }
                          placeholder="Reading / Writing"
                        />
                      </label>
                      <label>
                        Lesson Name
                        <input
                          value={editing.lesson || ""}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              lesson: e.target.value,
                            })
                          }
                          placeholder="Lesson name"
                        />
                      </label>
                      <label>
                        Responsible Staff
                        <select
                          value={editing.employee}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              employee: e.target.value,
                            })
                          }
                        >
                          {employees.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label className="wide">
                        Student Instructions
                        <textarea
                          value={editing.instructions}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              instructions: e.target.value,
                            })
                          }
                          placeholder="Enter clear instructions for the student..."
                        />
                      </label>
                    </div>
                  </div>
                  <footer>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setBuilderStep(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="save-next"
                      disabled={saveAction !== "idle"}
                      onClick={async () => {
                        const ok = await saveCurrent();
                        if (ok) setBuilderStep(null);
                      }}
                    >
                      {saveAction === "saving" ? "Saving…" : "Save"}
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {addModuleOpen && (
              <div
                className="hw435-module-create-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setAddModuleOpen(false);
                }}
              >
                <section
                  className="hw435-module-create-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Create homework module"
                >
                  <header>
                    <div>
                      <small>HOMEWORK STRUCTURE</small>
                      <h2>Create New Module</h2>
                      <p>
                        Create the module first. Questions are added separately
                        after creation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddModuleOpen(false)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="hw435-module-create-body">
                    <label>
                      Module Name
                      <input
                        autoFocus
                        value={newModuleTitle}
                        onChange={(e) => setNewModuleTitle(e.target.value)}
                        placeholder={`Module ${homeworkModuleCount + 1}`}
                      />
                    </label>
                    <div className="hw592-module-timing-grid">
                      <div className={`hw592-setting-card ${newModuleTimed?"active":""}`}>
                        <div className="hw592-setting-head">
                          <div><b>⏱ Module Timer</b><span>Choose whether this module has a countdown.</span></div>
                          <input type="checkbox" checked={newModuleTimed} onChange={(e)=>setNewModuleTimed(e.target.checked)}/>
                        </div>
                        {newModuleTimed&&<label>Time limit (minutes)<input type="number" min={1} max={300} value={newModuleDuration} onChange={(e)=>setNewModuleDuration(Math.max(1,Number(e.target.value)||1))}/></label>}
                      </div>
                      <div className={`hw592-setting-card ${newModuleHasBreak?"active":""}`}>
                        <div className="hw592-setting-head">
                          <div><b>☕ Break After Module</b><span>Add a timed break before the next module starts.</span></div>
                          <input type="checkbox" checked={newModuleHasBreak} onChange={(e)=>setNewModuleHasBreak(e.target.checked)}/>
                        </div>
                        {newModuleHasBreak&&<label>Break duration (minutes)<input type="number" min={1} max={60} value={newModuleBreakMinutes} onChange={(e)=>setNewModuleBreakMinutes(Math.max(1,Number(e.target.value)||1))}/></label>}
                      </div>
                    </div>
                    <div className="hw435-module-create-note">
                      <b>0 questions on creation</b>
                      <span>
                        Add questions later with + Add New Question, Question
                        Bank, or Import File.
                      </span>
                    </div>
                  </div>
                  <footer>
                    <button
                      type="button"
                      onClick={() => setAddModuleOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={createHomeworkModule}
                    >
                      Create Module
                    </button>
                  </footer>
                </section>
              </div>
            )}

            <section
              id="hw308-question-workspace"
              className="hw-builder-questions exam-v286-questions hw308-homework-question-area"
            >
              {showIssues && (
                <section className="v291-question-settings">
                  <div className="head">
                    <div>
                      <small>QUESTION SETTINGS</small>
                      <h3>Metadata & Learning Analysis</h3>
                    </div>
                    <button type="button" onClick={() => setShowIssues(false)}>
                      ×
                    </button>
                  </div>
                  {editing.questions[activeQuestionIndex] &&
                    (() => {
                      const q = editing.questions[activeQuestionIndex];
                      const idx = activeQuestionIndex;
                      return (
                        <div className="grid">
                          <label>
                            Module
                            <select
                              value={Number(q.moduleNumber || 1)}
                              onChange={(e) => {
                                const m = Number(e.target.value);
                                updateQ(idx, { moduleNumber: m });
                                setActiveHomeworkModule(m);
                              }}
                            >
                              {homeworkModules.map((m) => (
                                <option key={m} value={m}>
                                  Module {m}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Domain
                            <input
                              value={q.domain || ""}
                              onChange={(e) =>
                                updateQ(idx, { domain: e.target.value })
                              }
                              placeholder="Reading / Writing"
                            />
                          </label>
                          <label>
                            Skill
                            <input
                              value={q.skill || ""}
                              onChange={(e) =>
                                updateQ(idx, { skill: e.target.value })
                              }
                              placeholder="Main Idea"
                            />
                          </label>
                          <label>
                            Sub-skill
                            <input
                              value={q.subSkill || ""}
                              onChange={(e) =>
                                updateQ(idx, { subSkill: e.target.value })
                              }
                              placeholder="Evidence / Inference"
                            />
                          </label>
                          <label>
                            Difficulty
                            <select
                              value={q.difficulty || "MEDIUM"}
                              onChange={(e) =>
                                updateQ(idx, {
                                  difficulty: e.target.value as any,
                                })
                              }
                            >
                              <option value="EASY">Easy</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HARD">Hard</option>
                            </select>
                          </label>
                          <label>
                            Learning Level
                            <select
                              value={q.learningLevel || "FOUNDATION"}
                              onChange={(e) =>
                                updateQ(idx, {
                                  learningLevel: e.target.value as any,
                                })
                              }
                            >
                              <option value="FOUNDATION">Foundation</option>
                              <option value="ADVANCED">Advanced</option>
                            </select>
                          </label>
                          <label className="wide">
                            Error Pattern / Review Tag
                            <input
                              value={q.errorPattern || ""}
                              onChange={(e) =>
                                updateQ(idx, { errorPattern: e.target.value })
                              }
                              placeholder="Why students usually miss this question"
                            />
                          </label>
                        </div>
                      );
                    })()}
                  {activeQuestion && (
                    <div className="hw273-font-controls">
                      <div className="font-card">
                        <div className="font-head">
                          <b>Passage Font</b>
                          <small>
                            Controls Passage text for admin preview and student
                            view
                          </small>
                        </div>
                        <div className="font-grid">
                          <label>
                            Font
                            <select
                              value={
                                activeQuestion.passageFontFamily || "Arial"
                              }
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  passageFontFamily: e.target.value,
                                })
                              }
                            >
                              <option>Arial</option>
                              <option>Tahoma</option>
                              <option>Georgia</option>
                              <option>Times New Roman</option>
                              <option>Verdana</option>
                              <option>Trebuchet MS</option>
                            </select>
                          </label>
                          <label>
                            Size
                            <input
                              type="number"
                              min={12}
                              max={36}
                              value={activeQuestion.passageFontSize || 18}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  passageFontSize: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label>
                            Weight
                            <select
                              value={activeQuestion.passageFontWeight || 400}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  passageFontWeight: Number(e.target.value),
                                })
                              }
                            >
                              <option value={400}>Regular</option>
                              <option value={500}>Medium</option>
                              <option value={600}>Semi Bold</option>
                              <option value={700}>Bold</option>
                            </select>
                          </label>
                          <label>
                            Style
                            <select
                              value={
                                activeQuestion.passageFontStyle || "normal"
                              }
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  passageFontStyle: e.target.value as any,
                                })
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="italic">Italic</option>
                            </select>
                          </label>
                          <label>
                            Align
                            <select
                              value={activeQuestion.passageTextAlign || "left"}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  passageTextAlign: e.target.value as any,
                                })
                              }
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                              <option value="justify">Justify</option>
                            </select>
                          </label>
                        </div>
                        <div className="font-apply">
                          <button
                            type="button"
                            onClick={() => applyTypography("module", "passage")}
                          >
                            Apply to this Module
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTypography("all", "passage")}
                          >
                            Apply to All Homework
                          </button>
                        </div>
                      </div>
                      <div className="font-card">
                        <div className="font-head">
                          <b>Question Font</b>
                          <small>
                            Controls question text for admin preview and student
                            view
                          </small>
                        </div>
                        <div className="font-grid">
                          <label>
                            Font
                            <select
                              value={
                                activeQuestion.questionFontFamily || "Arial"
                              }
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  questionFontFamily: e.target.value,
                                })
                              }
                            >
                              <option>Arial</option>
                              <option>Tahoma</option>
                              <option>Georgia</option>
                              <option>Times New Roman</option>
                              <option>Verdana</option>
                              <option>Trebuchet MS</option>
                            </select>
                          </label>
                          <label>
                            Size
                            <input
                              type="number"
                              min={12}
                              max={36}
                              value={activeQuestion.questionFontSize || 18}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  questionFontSize: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label>
                            Weight
                            <select
                              value={activeQuestion.questionFontWeight || 600}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  questionFontWeight: Number(e.target.value),
                                })
                              }
                            >
                              <option value={400}>Regular</option>
                              <option value={500}>Medium</option>
                              <option value={600}>Semi Bold</option>
                              <option value={700}>Bold</option>
                            </select>
                          </label>
                          <label>
                            Style
                            <select
                              value={
                                activeQuestion.questionFontStyle || "normal"
                              }
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  questionFontStyle: e.target.value as any,
                                })
                              }
                            >
                              <option value="normal">Normal</option>
                              <option value="italic">Italic</option>
                            </select>
                          </label>
                          <label>
                            Align
                            <select
                              value={activeQuestion.questionTextAlign || "left"}
                              onChange={(e) =>
                                updateQ(activeQuestionIndex, {
                                  questionTextAlign: e.target.value as any,
                                })
                              }
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                              <option value="justify">Justify</option>
                            </select>
                          </label>
                        </div>
                        <div className="font-apply">                          <button
                            type="button"
                            onClick={() =>
                              applyTypography("module", "question")
                            }
                          >
                            Apply to this Module
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTypography("all", "question")}
                          >
                            Apply to All Homework
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {homeworkModuleSettingsOpen && (
                <section
                  id="hw273-module-settings"
                  className="v291-question-settings hw308-module-settings-copy"
                >
                  <div className="hw273-module-settings-head">
                    <div>
                      <small>MODULE SETTINGS</small>
                      <h3>{moduleConfig(activeHomeworkModule).title}</h3>
                      <p>
                        {moduleQuestionIndexes.length} questions ·{" "}
                        {moduleQuestionIndexes.reduce(
                          (sum, i) =>
                            sum + Number(editing.questions[i]?.points || 0),
                          0,
                        )}{" "}
                        points · {Number(moduleConfig(activeHomeworkModule).durationMinutes||0)>0?`${Number(moduleConfig(activeHomeworkModule).durationMinutes)} min timed`:"untimed"}{Number(moduleConfig(activeHomeworkModule).breakMinutes||0)>0?` · ${Number(moduleConfig(activeHomeworkModule).breakMinutes)} min break`:" · no break"}
                      </p>
                    </div>
                    <div className="hw275-module-manage">
                      <button
                        type="button"
                        title="Move module left"
                        disabled={
                          homeworkModules.indexOf(activeHomeworkModule) <= 0
                        }
                        onClick={() =>
                          moveHomeworkModule(activeHomeworkModule, -1)
                        }
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        title="Move module right"
                        disabled={
                          homeworkModules.indexOf(activeHomeworkModule) >=
                          homeworkModules.length - 1
                        }
                        onClick={() =>
                          moveHomeworkModule(activeHomeworkModule, 1)
                        }
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          duplicateHomeworkModule(activeHomeworkModule)
                        }
                      >
                        ⧉ Duplicate
                      </button>
                      <button
                        type="button"
                        className="delete"
                        onClick={() =>
                          deleteHomeworkModule(activeHomeworkModule)
                        }
                      >
                        🗑 Delete
                      </button>
                      <span>Module {activeHomeworkModule}</span>
                    </div>
                  </div>
                  <div className="hw273-module-settings-grid">
                    <label>
                      Module Name
                      <input
                        value={moduleConfig(activeHomeworkModule).title}
                        onChange={(e) =>
                          updateModuleConfig(activeHomeworkModule, {
                            title: e.target.value,
                          })
                        }
                        placeholder={`Module ${activeHomeworkModule}`}
                      />
                    </label>
                    <label>
                      Section
                      <input
                        value={moduleConfig(activeHomeworkModule).section || ""}
                        onChange={(e) =>
                          updateModuleConfig(activeHomeworkModule, {
                            section: e.target.value,
                          })
                        }
                        placeholder="Reading / Writing / Vocabulary"
                      />
                    </label>
                    <div className="hw592-inline-setting">
                      <label className="toggle">
                        <span>Timed Module</span>
                        <input type="checkbox" checked={Number(moduleConfig(activeHomeworkModule).durationMinutes||0)>0} onChange={(e)=>updateModuleConfig(activeHomeworkModule,{durationMinutes:e.target.checked?Math.max(1,Number(moduleConfig(activeHomeworkModule).durationMinutes||30)):undefined})}/>
                      </label>
                      {Number(moduleConfig(activeHomeworkModule).durationMinutes||0)>0&&<label>Time (minutes)<input type="number" min={1} max={300} value={Number(moduleConfig(activeHomeworkModule).durationMinutes||30)} onChange={(e)=>updateModuleConfig(activeHomeworkModule,{durationMinutes:Math.max(1,Number(e.target.value)||1)})}/></label>}
                    </div>
                    <div className="hw592-inline-setting">
                      <label className="toggle">
                        <span>Break After Module</span>
                        <input type="checkbox" checked={Number(moduleConfig(activeHomeworkModule).breakMinutes||0)>0} onChange={(e)=>updateModuleConfig(activeHomeworkModule,{breakMinutes:e.target.checked?Math.max(1,Number(moduleConfig(activeHomeworkModule).breakMinutes||5)):0})}/>
                      </label>
                      {Number(moduleConfig(activeHomeworkModule).breakMinutes||0)>0&&<label>Break (minutes)<input type="number" min={1} max={60} value={Number(moduleConfig(activeHomeworkModule).breakMinutes||5)} onChange={(e)=>updateModuleConfig(activeHomeworkModule,{breakMinutes:Math.max(1,Number(e.target.value)||1)})}/></label>}
                    </div>
                    <label className="toggle">
                      <span>Shuffle Questions</span>
                      <input
                        type="checkbox"
                        checked={
                          !!moduleConfig(activeHomeworkModule).shuffleQuestions
                        }
                        onChange={(e) =>
                          updateModuleConfig(activeHomeworkModule, {
                            shuffleQuestions: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <label className="toggle">
                      <span>Allow Review</span>
                      <input
                        type="checkbox"
                        checked={
                          moduleConfig(activeHomeworkModule).allowReview !==
                          false
                        }
                        onChange={(e) =>
                          updateModuleConfig(activeHomeworkModule, {
                            allowReview: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              )}
              <div className="v629-homework-exam-question-builder">
                <ExamQuestionBuilderV615
                  questions={editing.questions}
                  activeIndex={activeQuestionIndex}
                  visibleIndexes={moduleQuestionIndexes}
                  moduleLabel={moduleConfig(activeHomeworkModule).title || `Module ${activeHomeworkModule}`}
                  moduleLabels={Object.fromEntries(
                    homeworkModules.map((moduleNo) => [
                      moduleNo,
                      moduleConfig(moduleNo).title || `Module ${moduleNo}`,
                    ]),
                  )}
                  lesson={editing.lesson}
                  onSelect={setActiveQuestionIndex}
                  onAdd={addQ}
                  onPatch={(i, patch) => updateQ(i, patch)}
                  onPatchShared={(i, patch) => updateSharedContent(i, patch)}
                  onDuplicate={duplicateQ}
                  onDelete={removeQ}
                  onMove={moveQInsideHomeworkModule}
                  onSaveQuestion={saveHomeworkQuestionAndContinue}
                  onAddNewContent={addNewContentQuestion}
                  onReviewSelect={openHomeworkSavedQuestionForReview}
                  onDeleteModule={deleteHomeworkModule}
                />
              </div>
            </section>

            {builderStep === "assign" && (
              <div
                className="v295-step-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setBuilderStep(null);
                }}
              >
                <section className="v295-step-modal step-assign">
                  <header>
                    <div>
                      <small>HOMEWORK BUILDER · STEP 3</small>
                      <h2>Assign Students</h2>
                      <p>
                        Choose students, dates, attempts and result visibility.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="close"
                      onClick={() => setBuilderStep(null)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="v295-step-body">
                    <div className="v295-form-grid">
                      <label className="wide">
                        Target Students
                        <select
                          disabled={publishAllCourses}
                          value={
                            publishAllCourses
                              ? "All Students"
                              : editing.targetGroup || "All Students"
                          }
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              targetGroup: e.target.value,
                            })
                          }
                        >
                          {publishAllCourses ? (
                            <option value="All Students">
                              All students in every course
                            </option>
                          ) : (
                            <>
                              {!assignmentTargets.some(
                                (option) =>
                                  option.value ===
                                  (editing.targetGroup || "All Students"),
                              ) && (
                                <option value={editing.targetGroup}>
                                  {editing.targetGroup}
                                </option>
                              )}
                              {assignmentTargets.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </label>
                      <label>
                        Responsible Staff
                        <select
                          value={editing.employee}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              employee: e.target.value,
                            })
                          }
                        >
                          {employees.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Open Date
                        <input
                          type="datetime-local"
                          value={editing.opensAt}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              opensAt: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Due Date
                        <input
                          type="datetime-local"
                          value={editing.dueAt}
                          onChange={(e) =>
                            commitEditing({ ...editing, dueAt: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Attempts
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={editing.attempts}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              attempts: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Show Result
                        <select
                          value={editing.showResult ? "yes" : "no"}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              showResult: e.target.value === "yes",
                            })
                          }
                        >
                          <option value="yes">After submission</option>
                          <option value="no">Hide result</option>
                        </select>
                      </label>
                      <label>
                        Correct Answers
                        <select
                          value={editing.showAnswers || "after_submit"}
                          onChange={(e) =>
                            commitEditing({
                              ...editing,
                              showAnswers: e.target.value as any,
                            })
                          }
                        >
                          <option value="after_submit">After submission</option>
                          <option value="after_due">After due date</option>
                          <option value="never">Never</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <footer>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setBuilderStep(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="save-next"
                      disabled={saveAction !== "idle"}
                      onClick={async () => {
                        const ok = await saveCurrent();
                        if (ok) setBuilderStep(null);
                      }}
                    >
                      {saveAction === "saving" ? "Saving…" : "Save"}
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {builderStep === "review" && (
              <div
                className="v295-step-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setBuilderStep(null);
                }}
              >
                <section className="v295-step-modal step-review">
                  <header>
                    <div>
                      <small>HOMEWORK BUILDER · STEP 4</small>
                      <h2>Review & Publish</h2>
                      <p>
                        Review the homework and publish when everything is
                        ready.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="close"
                      onClick={() => setBuilderStep(null)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="v295-step-body">
                    <div className="v295-review">
                      <div className="v295-review-kpis">
                        <article>
                          <small>Homework</small>
                          <b>{editing.title || "Untitled Homework"}</b>
                        </article>
                        <article>
                          <small>Course</small>
                          <b>
                            {publishAllCourses
                              ? "All Courses (5)"
                              : editing.course}
                          </b>
                        </article>
                        <article>
                          <small>Modules</small>
                          <b>{homeworkModuleCount}</b>
                        </article>
                        <article>
                          <small>Questions</small>
                          <b>{editing.questions.length}</b>
                        </article>
                        <article>
                          <small>Total Points</small>
                          <b>{totalPoints}</b>
                        </article>
                        <article
                          className={publishProblems().length ? "bad" : "good"}
                        >
                          <small>Readiness</small>
                          <b>
                            {publishProblems().length
                              ? `${publishProblems().length} issues`
                              : "Ready ✓"}
                          </b>
                        </article>
                      </div>
                      {publishProblems().length > 0 && (
                        <div className="v295-blockers">
                          {publishProblems()
                            .slice(0, 12)
                            .map((x, n) => (
                              <button
                                type="button"
                                key={`${x.type}-${n}`}
                                onClick={() => {
                                  if (x.questionIndex !== undefined) {
                                    setActiveQuestionIndex(x.questionIndex);
                                    setActiveHomeworkModule(x.module || 1);
                                    setBuilderStep(null);
                                    window.setTimeout(
                                      () =>
                                        document
                                          .getElementById(
                                            "hw308-question-workspace",
                                          )
                                          ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          }),
                                      40,
                                    );
                                  } else if (x.type === "assign")
                                    setBuilderStep("assign");
                                  else if (x.type === "module") {
                                    setActiveHomeworkModule(x.module || 1);
                                    setBuilderStep(null);
                                  } else setBuilderStep("info");
                                }}
                              >
                                <b>
                                  {x.questionIndex !== undefined
                                    ? `Question ${x.questionIndex + 1}`
                                    : x.module
                                      ? `Module ${x.module}`
                                      : x.type === "assign"
                                        ? "Assignment"
                                        : "Homework"}
                                </b>
                                <span>{x.message}</span>
                                <i>Fix →</i>
                              </button>
                            ))}
                        </div>
                      )}
                      <div className="v295-publish-actions">
                        {editing.id && (
                          <button
                            type="button"
                            className="preview"
                            onClick={previewCurrent}
                          >
                            👁 Preview as Student
                          </button>
                        )}
                        <button
                          type="button"
                          className="draft"
                          disabled={saveAction !== "idle"}
                          onClick={saveCurrent}
                        >
                          {saveAction === "saving"
                            ? "◌ Saving…"
                            : saveFeedback?.kind === "success" &&
                                saveFeedback.title.startsWith("Saved")
                              ? "✓ Saved"
                              : "💾 Save Draft"}
                        </button>
                        <button
                          type="button"
                          className="schedule"
                          disabled={saveAction !== "idle"}
                          onClick={() => save("scheduled", "schedule")}
                        >
                          {saveAction === "scheduling"
                            ? "◌ Scheduling…"
                            : saveFeedback?.kind === "success" &&
                                saveFeedback.title === "Scheduled successfully"
                              ? "✓ Scheduled"
                              : "🗓 Schedule"}
                        </button>
                        <button
                          type="button"
                          className="publish"
                          disabled={
                            publishProblems().length > 0 ||
                            saveAction !== "idle"
                          }
                          onClick={() => save("published", "publish")}
                        >
                          {saveAction === "publishing"
                            ? "◌ Publishing…"
                            : saveFeedback?.kind === "success" &&
                                saveFeedback.title === "Published successfully"
                              ? "✓ Published"
                              : "➤ Publish for Students"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <footer>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setBuilderStep(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="save-next"
                      disabled={saveAction !== "idle"}
                      onClick={async () => {
                        const ok = await saveCurrent();
                        if (ok) setBuilderStep(null);
                      }}
                    >
                      {saveAction === "saving" ? "Saving…" : "Save"}
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {questionBankOpen && (
              <div
                className="hw274-bank-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setQuestionBankOpen(false);
                }}
              >
                <section className="hw274-bank-modal">
                  <header>
                    <div>
                      <small>CENTRAL QUESTION BANK</small>
                      <h2>Choose Questions</h2>
                      <p>
                        {editing.course} · approved compatible questions only. Nothing is added until you select and confirm.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuestionBankOpen(false)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="hw274-bank-filters hw275-bank-filters">
                    <label className="search">
                      Search
                      <input
                        value={questionBankQuery}
                        onChange={(e) => setQuestionBankQuery(e.target.value)}
                        placeholder="Search question, domain, skill..."
                      />
                    </label>
                    <label>
                      Domain
                      <select
                        value={questionBankDomain}
                        onChange={(e) => setQuestionBankDomain(e.target.value)}
                      >
                        <option value="ALL">All Domains</option>
                        {Array.from(
                          new Set(
                            questionBankItems
                              .map((q: any) => String(q.domain || "").trim())
                              .filter(Boolean),
                          ),
                        )
                          .sort()
                          .map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Skill
                      <select
                        value={questionBankSkill}
                        onChange={(e) => setQuestionBankSkill(e.target.value)}
                      >
                        <option value="ALL">All Skills</option>
                        {Array.from(
                          new Set(
                            questionBankItems
                              .map((q: any) => String(q.skill || "").trim())
                              .filter(Boolean),
                          ),
                        )
                          .sort()
                          .map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Sub-skill
                      <select
                        value={questionBankSubSkill}
                        onChange={(e) =>
                          setQuestionBankSubSkill(e.target.value)
                        }
                      >
                        <option value="ALL">All Sub-skills</option>
                        {Array.from(
                          new Set(
                            questionBankItems
                              .map((q: any) => String(q.subSkill || "").trim())
                              .filter(Boolean),
                          ),
                        )
                          .sort()
                          .map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Difficulty
                      <select
                        value={questionBankDifficulty}
                        onChange={(e) =>
                          setQuestionBankDifficulty(e.target.value)
                        }
                      >
                        <option value="ALL">All Levels</option>
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                    </label>
                  </div>
                  {(() => {
                    const filtered = questionBankItems.filter((q: any) => {
                      const hay =
                        `${q.prompt || ""} ${q.skill || ""} ${q.domain || ""} ${q.subSkill || ""}`.toLowerCase();
                      return (
                        (!questionBankQuery.trim() ||
                          hay.includes(
                            questionBankQuery.toLowerCase().trim(),
                          )) &&
                        (questionBankDomain === "ALL" ||
                          String(q.domain || "") === questionBankDomain) &&
                        (questionBankSkill === "ALL" ||
                          String(q.skill || "") === questionBankSkill) &&
                        (questionBankSubSkill === "ALL" ||
                          String(q.subSkill || "") === questionBankSubSkill) &&
                        (questionBankDifficulty === "ALL" ||
                          String(q.difficulty || "MEDIUM") ===
                            questionBankDifficulty)
                      );
                    });
                    const selectedCount =
                      Object.values(questionBankSelected).filter(
                        Boolean,
                      ).length;
                    const preview = questionBankItems.find(
                      (q: any) => String(q.id) === questionBankPreviewId,
                    );
                    return (
                      <>
                        <div className="hw274-bank-summary">
                          <span>
                            <b>{filtered.length}</b> visible
                          </span>
                          <span>
                            <b>{selectedCount}</b> selected
                          </span>
                          <span>
                            Adding to{" "}
                            <b>{moduleConfig(activeHomeworkModule).title}</b>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const allSelected =
                                filtered.length > 0 &&
                                filtered.every(
                                  (q: any) =>
                                    questionBankSelected[String(q.id)],
                                );
                              const next = { ...questionBankSelected };
                              filtered.forEach((q: any) => {
                                next[String(q.id)] = !allSelected;
                              });
                              setQuestionBankSelected(next);
                            }}
                          >
                            {filtered.length > 0 &&
                            filtered.every(
                              (q: any) => questionBankSelected[String(q.id)],
                            )
                              ? "Clear Visible"
                              : "Select All Visible"}
                          </button>
                        </div>
                        <div
                          className={`hw275-bank-body ${preview ? "has-preview" : ""}`}
                        >
                          <div className="hw274-bank-list">
                            {questionBankLoading ? (
                              <div className="loading">
                                Loading Question Bank…
                              </div>
                            ) : filtered.length ? (
                              filtered.map((q: any) => {
                                const id = String(q.id);
                                const usedCount = items.filter(
                                  (hw) =>
                                    hw.id !== editing.id &&
                                    hw.questions.some(
                                      (x) =>
                                        String(
                                          x.sourceBankQuestionId || x.id,
                                        ) === id,
                                    ),
                                ).length;
                                return (
                                  <div
                                    className={`hw275-bank-row ${questionBankSelected[id] ? "selected" : ""}`}
                                    key={id}
                                  >
                                    <button
                                      type="button"
                                      className="select-question"
                                      onClick={() =>
                                        setQuestionBankSelected((prev) => ({
                                          ...prev,
                                          [id]: !prev[id],
                                        }))
                                      }
                                    >
                                      <span className="check">
                                        {questionBankSelected[id] ? "✓" : ""}
                                      </span>
                                      <span className="question">
                                        <strong>
                                          {plain(String(q.prompt || "")).slice(
                                            0,
                                            180,
                                          ) || "Untitled question"}
                                        </strong>
                                        <small>
                                          {q.domain || "General"} ·{" "}
                                          {q.skill || "No skill"}
                                          {q.subSkill
                                            ? ` · ${q.subSkill}`
                                            : ""}{" "}
                                          · {q.difficulty || "MEDIUM"}
                                          {usedCount
                                            ? ` · Used in ${usedCount} homework${usedCount === 1 ? "" : "s"}`
                                            : " · Not used before"}
                                        </small>
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className="preview-question"
                                      onClick={() =>
                                        setQuestionBankPreviewId(id)
                                      }
                                    >
                                      Preview
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="empty">
                                No questions match these filters.
                              </div>
                            )}
                          </div>
                          {preview && (
                            <aside className="hw275-bank-preview">
                              <div className="head">
                                <div>
                                  <small>QUESTION PREVIEW</small>
                                  <h3>{preview.domain || "Question Bank"}</h3>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setQuestionBankPreviewId("")}
                                >
                                  ×
                                </button>
                              </div>
                              {preview.passage && (
                                <div
                                  className="passage"
                                  dangerouslySetInnerHTML={richHtml(
                                    String(preview.passage),
                                  )}
                                />
                              )}
                              <div
                                className="prompt"
                                dangerouslySetInnerHTML={richHtml(
                                  String(preview.prompt || ""),
                                )}
                              />
                              {Array.isArray(preview.choices) && (
                                <div className="choices">
                                  {preview.choices.map((c: any, n: number) => (
                                    <div key={n}>
                                      <b>{String.fromCharCode(65 + n)}</b>
                                      <span>{String(c?.text ?? c ?? "")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <dl>
                                <div>
                                  <dt>Domain</dt>
                                  <dd>{preview.domain || "—"}</dd>
                                </div>
                                <div>
                                  <dt>Skill</dt>
                                  <dd>{preview.skill || "—"}</dd>
                                </div>
                                <div>
                                  <dt>Sub-skill</dt>
                                  <dd>{preview.subSkill || "—"}</dd>
                                </div>
                                <div>
                                  <dt>Difficulty</dt>
                                  <dd>{preview.difficulty || "MEDIUM"}</dd>
                                </div>
                              </dl>
                            </aside>
                          )}
                        </div>
                        <footer>
                          <button
                            type="button"
                            className="cancel"
                            onClick={() => setQuestionBankOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="add"
                            disabled={!selectedCount}
                            onClick={addSelectedQuestionBankQuestions}
                          >
                            Add Selected Questions ({selectedCount})
                          </button>
                        </footer>
                      </>
                    );
                  })()}
                </section>
              </div>
            )}
          </section>
        </>
      )}{" "}
      {tab === "results" && (
        <section className="hw-admin-panel hw446-submissions hw447-submissions">
          {(() => {
            const rows = adminPublications
              .filter((x) => x.status !== "archived")
              .map((x) => {
                const real = publicationSubmissions(x);
                const scores = real
                  .map((r: any) =>
                    Number(r.total) > 0
                      ? Math.round(
                          (Number(r.score || 0) / Number(r.total)) * 100,
                        )
                      : Number(r.percent || 0),
                  )
                  .filter(Number.isFinite);
                const now = Date.now();
                const due = new Date(x.dueAt).getTime();
                const opens = new Date(x.opensAt).getTime();
                const phase =
                  due < now || x.status === "closed"
                    ? "completed"
                    : opens > now || x.status === "scheduled"
                      ? "upcoming"
                      : "active";
                return {
                  x,
                  real,
                  avg: scores.length
                    ? Math.round(
                        scores.reduce((a: number, b: number) => a + b, 0) /
                          scores.length,
                      )
                    : null,
                  phase,
                };
              });
            const shown = rows.filter((r) =>
              `${r.x.title} ${publicationCourses(r.x).join(" ")} ${r.x.section || ""} ${r.x.lesson || ""}`
                .toLowerCase()
                .includes(submissionQuery.toLowerCase()),
            );
            return (
              <>
                <header className="hw446-head hw447-head">
                  <div>
                    <small>HOMEWORK SUBMISSIONS</small>
                    <h2>Compact Homework Submission List</h2>
                    <p>
                      Click a homework strip to open its students. Click any
                      student to review the full submission.
                    </p>
                  </div>
                  <button type="button" onClick={() => void refreshHomeworkSubmissions()}>
                    ↻ Refresh Submissions
                  </button>
                </header>
                <div className="hw446-search hw447-search">
                  <input
                    value={submissionQuery}
                    onChange={(e) => setSubmissionQuery(e.target.value)}
                    placeholder="Search homework, course, section or lesson..."
                  />
                  <span>{shown.length} homework</span>
                </div>
                <div className="hw447-strip-list">
                  {shown.map(({ x, real, avg, phase }) => (
                    <button
                      type="button"
                      key={x.id}
                      className={`hw447-strip ${phase}`}
                      onClick={() => { setSubmissionCourseFilter("ALL"); setResultHomeworkId(x.id); }}
                    >
                      <span className={`hw447-dot ${phase}`}></span>
                      <span className="hw447-title">
                        <b>{x.title || "Untitled Homework"}</b>
                        <small>
                          {publicationLabel(x)} • {x.section || "No Section"}
                        </small>
                      </span>
                      <span className="hw447-date">
                        <small>Due</small>
                        <b>
                          {new Date(x.dueAt).toLocaleDateString("en-US", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </b>
                      </span>
                      <span className="hw447-count">
                        <small>Submitted</small>
                        <b>{real.length}</b>
                      </span>
                      <span className="hw447-average">
                        <small>Average</small>
                        <b>{avg === null ? "—" : `${avg}%`}</b>
                      </span>
                      <span className={`hw447-status ${phase}`}>
                        {phase === "active"
                          ? "Active"
                          : phase === "upcoming"
                            ? "Upcoming"
                            : "Completed"}
                      </span>
                      <i>›</i>
                    </button>                  ))}
                </div>
                {!shown.length && (
                  <div className="hw446-empty page">
                    <b>No homework matches your search</b>
                    <span>
                      Try another homework name, course, section or lesson.
                    </span>
                  </div>
                )}
                {resultHomeworkId &&
                  (() => {
                    const x = items.find((i) => i.id === resultHomeworkId);
                    if (!x) return null;
                    const real = publicationSubmissions(x)
                      .filter((row: any) => submissionCourseFilter === "ALL" ||
                        items.find((item) => item.id === String(row.homeworkId || row.assignmentId || ""))?.course === submissionCourseFilter)
                      .slice()
                      .sort(
                        (a: any, b: any) =>
                          new Date(b.submittedAt || 0).getTime() -
                          new Date(a.submittedAt || 0).getTime(),
                      );
                    return (
                      <div
                        className="hw447-backdrop"
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget)
                            setResultHomeworkId(null);
                        }}
                      >
                        <section
                          className="hw447-students-modal"
                          role="dialog"
                          aria-modal="true"
                        >
                          <header>
                            <div>
                              <small>HOMEWORK STUDENTS</small>
                              <h2>{x.title}</h2>
                              <p>
                                {publicationLabel(x)} • {x.section || "No Section"} • Due{" "}
                                {new Date(x.dueAt).toLocaleString("en-US")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setResultHomeworkId(null)}
                            >
                              ×
                            </button>
                          </header>
                          {courseSubmissionFilters(x)}
                          <div className="hw447-modal-summary">
                            <span>
                              <small>Submitted</small>
                              <b>{real.length}</b>
                            </span>
                            <span>
                              <small>Questions</small>
                              <b>{x.questions.length}</b>
                            </span>
                            <span>
                              <small>Attempts</small>
                              <b>{x.attempts}</b>
                            </span>
                          </div>
                          {real.length ? (
                            <div className="hw447-students-list">
                              {real.map((row: any, n: number) => {
                                const pct =
                                  Number(row.total) > 0
                                    ? Math.round(
                                        (Number(row.score || 0) /
                                          Number(row.total)) *
                                          100,
                                      )
                                    : Number(row.percent || 0);
                                return (
                                  <button
                                    type="button"
                                    key={`${x.id}-popup-${n}`}
                                    onClick={() =>
                                      setReviewSubmission({ homework: items.find((item) => item.id === row.homeworkId) || x, row })
                                    }
                                  >
                                    <span className="hw447-avatar">
                                      {String(row.student || "S")
                                        .slice(0, 1)
                                        .toUpperCase()}
                                    </span>
                                    <span className="hw447-student-name">
                                      <b>{row.student || "Student"}</b>
                                      <small>{items.find((item) => item.id === row.homeworkId)?.course || x.course} · </small>
                                      <small>
                                        {row.submittedAt
                                          ? new Date(
                                              row.submittedAt,
                                            ).toLocaleString("en-US")
                                          : "Submitted"}
                                      </small>
                                    </span>
                                    <span className="hw447-score">
                                      <small>Score</small>
                                      <b>
                                        {Number(row.score || 0)} /{" "}
                                        {Number(
                                          row.total || x.questions.length || 0,
                                        )}
                                      </b>
                                    </span>
                                    <span className="hw447-percent">
                                      <small>Grade</small>
                                      <b>{Number.isFinite(pct) ? pct : 0}%</b>
                                    </span>
                                    <i>Review answers ›</i>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="hw446-empty">
                              <b>No student submissions yet</b>
                              <span>
                                Student names, grades and answers will appear
                                here after submission.
                              </span>
                            </div>
                          )}
                        </section>
                      </div>
                    );
                  })()}
              </>
            );
          })()}
        </section>
      )}{" "}
      {reviewSubmission &&
        (() => {
          const x = reviewSubmission.homework as HomeworkItem;
          const row = reviewSubmission.row || {};
          const answers = row.answers;
          const pct =
            Number(row.total) > 0
              ? Math.round((Number(row.score || 0) / Number(row.total)) * 100)
              : Number(row.percent || 0);
          return (
            <div
              className="hw445-review-backdrop"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setReviewSubmission(null);
              }}
            >
              <section
                className="hw445-review-modal"
                role="dialog"
                aria-modal="true"
              >
                <header>
                  <div>
                    <small>STUDENT SUBMISSION REVIEW</small>
                    <h2>{row.student || "Student"}</h2>
                    <p>
                      {x.title} • {x.course} •{" "}
                      {row.submittedAt
                        ? new Date(row.submittedAt).toLocaleString("en-US")
                        : "Submitted"}
                    </p>
                  </div>
                  <button onClick={() => setReviewSubmission(null)}>×</button>
                </header>
                <div className="hw445-review-kpis">
                  <article>
                    <small>Score</small>
                    <b>
                      {Number(row.score || 0)} /{" "}
                      {Number(row.total || x.questions.length || 0)}
                    </b>
                  </article>
                  <article>
                    <small>Percentage</small>
                    <b>{Number.isFinite(pct) ? pct : 0}%</b>
                  </article>
                  <article>
                    <small>Questions</small>
                    <b>{x.questions.length}</b>
                  </article>
                  <article>
                    <small>Status</small>
                    <b>Submitted</b>
                  </article>
                </div>
                <div className="hw445-answer-list">
                  {x.questions.map((q: any, i: number) => {
                    const a = Array.isArray(answers)
                      ? answers[i]
                      : answers && typeof answers === "object"
                        ? (answers[String(q.id)] ?? answers[String(i)] ?? answers[i])
                        : undefined;
                    const correct = Number(q.correctIndex);
                    const answered = a !== null && a !== undefined;
                    const ok = answered && Number(a) === correct;
                    return (
                      <article
                        key={q.id || i}
                        className={
                          ok ? "correct" : answered ? "wrong" : "missing"
                        }
                      >
                        <div className="hw445-qhead">
                          <b>Question {i + 1}</b>
                          <span>
                            {ok
                              ? "✓ Correct"
                              : answered
                                ? "✕ Incorrect"
                                : "— Not answered"}
                          </span>
                          <em>
                            {ok ? Number(q.points || 1) : 0} /{" "}
                            {Number(q.points || 1)} pt
                          </em>
                        </div>
                        <div
                          className="hw445-prompt"
                          dangerouslySetInnerHTML={richHtml(
                            q.prompt || `Question ${i + 1}`,
                          )}
                        />
                        <div className="hw445-answer-grid">
                          <div>
                            <small>Student answer</small>
                            <strong>
                              {answered
                                ? (q.choices?.[Number(a)] ?? String(a))
                                : "No answer"}
                            </strong>
                          </div>
                          <div>
                            <small>Correct answer</small>
                            <strong>
                              {q.choices?.[correct] ?? String(correct)}
                            </strong>
                          </div>
                        </div>
                        {q.explanation && (
                          <div className="hw445-explanation">
                            <small>Explanation</small>
                            <div
                              dangerouslySetInnerHTML={richHtml(q.explanation)}
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          );
        })()}
      {!fullScreen &&
        bulkActionConfirm &&
        (() => {
          const selected = bulkActionConfirm.ids
            .map((id) => items.find((item) => item.id === id))
            .filter((item): item is HomeworkItem => Boolean(item));
          if (!selected.length) return null;
          const isArchive = bulkActionConfirm.kind === "archive";
          const busy = bulkActionBusy === bulkActionConfirm.kind;
          return (
            <div
              className="hw-program-confirm-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) {
                  setBulkActionConfirm(null);
                  setBulkActionError("");
                }
              }}
            >
              <section
                className={`hw-program-confirm bulk-operation ${bulkActionConfirm.kind}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="hw-bulk-confirm-title"
                aria-describedby="hw-bulk-confirm-description"
              >
                <div className="hw-program-confirm-icon" aria-hidden="true">
                  {isArchive ? "⇩" : "↻"}
                </div>
                <div className="hw-program-confirm-copy">
                  <small>
                    {isArchive ? "BULK ARCHIVE" : "BULK PUBLISH AGAIN"}
                  </small>
                  <h2 id="hw-bulk-confirm-title">
                    {isArchive
                      ? `Archive ${selected.length} homework item${selected.length === 1 ? "" : "s"}?`
                      : `Publish ${selected.length} archived homework item${selected.length === 1 ? "" : "s"} again?`}
                  </h2>
                  <p id="hw-bulk-confirm-description">
                    {isArchive
                      ? "The selected homework will be hidden from students and moved to the archive. You can publish it again later."
                      : "A fresh published copy of each selected homework will open now for 3 days. Existing archived records and submissions will remain unchanged."}
                  </p>
                </div>
                <div className="hw-program-confirm-list">
                  {selected.slice(0, 5).map((item) => (
                    <span key={item.id}>
                      <b>{item.title || "Untitled Homework"}</b>
                      <small>
                        {item.course} • {item.section || "No Section"}
                      </small>
                    </span>
                  ))}
                  {selected.length > 5 && (
                    <em>
                      + {selected.length - 5} more selected homework items
                    </em>
                  )}
                </div>
                {bulkActionError && (
                  <div className="hw-program-confirm-error" role="alert">
                    {bulkActionError}
                  </div>
                )}
                <footer>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setBulkActionConfirm(null);
                      setBulkActionError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => void confirmBulkHomeworkAction()}
                  >
                    {busy ? (
                      <>
                        <i /> {isArchive ? "Archiving…" : "Publishing…"}
                      </>
                    ) : isArchive ? (
                      `Archive ${selected.length} Homework Item${selected.length === 1 ? "" : "s"}`
                    ) : (
                      `Publish ${selected.length} Again`
                    )}
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}
      {!fullScreen &&
        deleteConfirm &&
        (() => {
          const selected = deleteConfirm.ids
            .map((id) => items.find((item) => item.id === id))
            .filter((item): item is HomeworkItem => Boolean(item));
          if (!selected.length) return null;
          const relatedSubmissions = submissions.filter((row: any) =>
            deleteConfirm.ids.includes(
              String(row.homeworkId || row.assignmentId || ""),
            ),
          ).length;
          const deleting = itemAction?.kind === "delete";
          const locationLabel =
            deleteConfirm.source === "archive"
              ? "the archive"
              : deleteConfirm.source === "history"
                ? "completed history"
                : deleteConfirm.source === "active"
                  ? "current and upcoming homework"
                  : "homework management";
          return (
            <div
              className="hw-program-confirm-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) {
                  setDeleteConfirm(null);
                  setDeleteError("");
                }
              }}
            >
              <section
                className="hw-program-confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="hw-delete-confirm-title"
                aria-describedby="hw-delete-confirm-description"
              >
                <div className="hw-program-confirm-icon" aria-hidden="true">
                  !
                </div>
                <div className="hw-program-confirm-copy">
                  <small>PERMANENT DELETE</small>
                  <h2 id="hw-delete-confirm-title">
                    Delete{" "}
                    {selected.length === 1
                      ? "this homework"
                      : `${selected.length} homework items`}
                    ?
                  </h2>
                  <p id="hw-delete-confirm-description">
                    The selected{" "}
                    {selected.length === 1 ? "homework" : "homework items"} will
                    be permanently removed from {locationLabel}. This action
                    cannot be undone.
                  </p>
                </div>
                <div className="hw-program-confirm-list">
                  {selected.slice(0, 5).map((item) => (
                    <span key={item.id}>
                      <b>{item.title || "Untitled Homework"}</b>
                      <small>
                        {item.course} • {item.section || "No Section"}
                      </small>
                    </span>
                  ))}
                  {selected.length > 5 && (
                    <em>
                      + {selected.length - 5} more selected homework items
                    </em>
                  )}
                </div>
                {relatedSubmissions > 0 && (
                  <div className="hw-program-confirm-warning">
                    <b>
                      {relatedSubmissions} linked student submission
                      {relatedSubmissions === 1 ? "" : "s"}
                    </b>
                    <span>
                      These submission records will be deleted with the selected
                      homework.
                    </span>
                  </div>
                )}
                {deleteError && (
                  <div className="hw-program-confirm-error" role="alert">
                    {deleteError}
                  </div>
                )}
                <footer>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteConfirm(null);
                      setDeleteError("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={deleting}
                    onClick={() => void confirmHomeworkDelete()}
                  >
                    {deleting ? (
                      <>
                        <i /> Deleting {selected.length}…
                      </>
                    ) : selected.length === 1 ? (
                      "Delete Permanently"
                    ) : (
                      `Delete ${selected.length} Homework Items`
                    )}
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}
      {!fullScreen &&
        expandedHomeworkId &&
        (() => {
          const x = items.find((item) => item.id === expandedHomeworkId);
          if (!x || x.status !== "archived") return null;
          const real = publicationSubmissions(x).filter((row: any) => submissionCourseFilter === "ALL" ||
            items.find((item) => item.id === String(row.homeworkId || row.assignmentId || ""))?.course === submissionCourseFilter);
          const totalStudents = publicationStudentCount(x, submissionCourseFilter);
          const submitted = real.length;
          const submissionRate = totalStudents
            ? Math.round((submitted / totalStudents) * 100)
            : 0;
          return (
            <div
              className="hw-details-backdrop hw-archive-details-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setExpandedHomeworkId(null);
              }}
            >
              <section
                className="hw-details-modal hw-archive-details-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Archived homework details: ${x.title}`}
              >
                <header className="hw-details-head hw-archive-details-head">
                  <div>
                    <small>ARCHIVED HOMEWORK / DETAILS</small>
                    <h2>{x.title}</h2>
                    <p>
                      {publicationLabel(x)} • {x.section || "No Section"} •{" "}
                      {x.lesson || "No Lesson"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="hw-details-close"
                    onClick={() => setExpandedHomeworkId(null)}
                    aria-label="Close archived homework details"
                  >
                    ×
                  </button>
                </header>
                {courseSubmissionFilters(x)}
                <div className="hw-details-body">
                  <div className="hw-details-overview">
                    <article>
                      <small>Assigned by</small>
                      <strong>{x.employee}</strong>
                    </article>
                    <article>
                      <small>Questions</small>
                      <strong>{x.questions.length}</strong>
                    </article>
                    <article>
                      <small>Opened</small>
                      <strong>
                        {new Date(x.opensAt).toLocaleString("en-US")}
                      </strong>
                    </article>
                    <article>
                      <small>Ended</small>
                      <strong>
                        {new Date(x.dueAt).toLocaleString("en-US")}
                      </strong>
                    </article>
                  </div>
                  <div className="hw-details-kpis hw-archive-details-kpis">
                    <article>
                      <span>▣</span>
                      <div>
                        <small>Status</small>
                        <strong>Archived</strong>
                        <em>Hidden from students</em>
                      </div>
                    </article>
                    <article>
                      <span>✓</span>
                      <div>
                        <small>Submitted</small>
                        <strong>
                          {submitted} / {totalStudents ?? "—"}
                        </strong>
                        <em>{totalStudents === null ? "Enrolment count unavailable" : `${submissionRate}% of assigned students`}</em>
                      </div>
                    </article>
                    <article>
                      <span>◎</span>
                      <div>
                        <small>Target</small>
                        <strong>{publicationLabel(x)}</strong>
                        <em>
                          {publicationLabel(x)} • {x.section || "All Sections"}
                        </em>
                      </div>
                    </article>
                    <article>
                      <span>↻</span>
                      <div>
                        <small>Publish Again</small>
                        <strong>Fresh copy</strong>
                        <em>Previous records stay archived</em>
                      </div>
                    </article>
                  </div>
                  <div className="hw-details-section">
                    <div className="hw-details-section-head">
                      <div>
                        <small>ASSIGNMENT INFORMATION</small>
                        <h3>Homework setup</h3>
                      </div>
                    </div>
                    <div className="hw-details-grid">
                      <span>
                        <small>Attempts</small>
                        <b>{x.attempts}</b>
                      </span>
                      <span>
                        <small>Mode</small>
                        <b>{modeArabic[x.mode] || x.mode}</b>
                      </span>
                      <span>
                        <small>Show Result</small>
                        <b>{x.showResult ? "Yes" : "No"}</b>
                      </span>
                      <span>
                        <small>Answers</small>
                        <b>{x.showAnswers}</b>
                      </span>
                      <span>
                        <small>Course</small>
                        <b>{publicationLabel(x)}</b>
                      </span>
                      <span>
                        <small>Section</small>
                        <b>{x.section || "All Sections"}</b>
                      </span>
                    </div>
                    {x.instructions && (
                      <div className="hw-details-instructions">
                        <small>Instructions</small>
                        <p>{x.instructions}</p>
                      </div>
                    )}
                  </div>
                  <div className="hw-details-section">
                    <div className="hw-details-section-head">
                      <div>
                        <small>ARCHIVED ACTIVITY</small>
                        <h3>Student submissions & scores</h3>
                      </div>
                    </div>
                    <div className="hw-details-submissions">
                      {real.length ? (
                        real.map((row: any, index: number) => (
                          <article
                            key={`${x.id}-archive-modal-${index}`}
                            className="hw445-submission-row"
                          >
                            <div>
                              <b>{row.student || "Student"}</b>
                              <small>{items.find((item) => item.id === row.homeworkId)?.course || x.course} · </small>
                              <small>
                                {row.submittedAt
                                  ? new Date(row.submittedAt).toLocaleString(
                                      "en-US",
                                    )
                                  : "—"}
                              </small>
                            </div>
                            <strong>
                              {Number(row.total) > 0
                                ? Math.round(
                                    (Number(row.score || 0) /
                                      Number(row.total)) *
                                      100,
                                  )
                                : Number(row.percent || 0)}
                              %
                            </strong>
                            <span>
                              {Number(row.score || 0)} /{" "}
                              {Number(row.total || x.questions.length || 0)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedHomeworkId(null);
                                setReviewSubmission({ homework: items.find((item) => item.id === row.homeworkId) || x, row });
                              }}
                            >
                              Review Answers
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className="hw-details-empty">
                          No recorded submissions for this archived homework.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <footer className="hw-details-actions hw-archive-modal-actions">
                  <button
                    type="button"
                    onClick={() => setExpandedHomeworkId(null)}
                  >
                    Close
                  </button>
                  <Link
                    href={`/homework-builder?id=${encodeURIComponent(x.id)}`}
                  >
                    Open / Edit
                  </Link>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setExpandedHomeworkId(null);
                      void createHomeworkCopy(x, { openEditor: true });
                    }}
                  >
                    Duplicate & Edit
                  </button>
                  <button
                    type="button"
                    className="restore"
                    disabled={Boolean(itemAction)}
                    onClick={() => void republishArchived(x)}
                  >
                    {itemAction?.id === x.id && itemAction.kind === "republish"
                      ? "Publishing…"
                      : "Publish Again"}
                  </button>
                  <button
                    type="button"
                    className="danger permanent"
                    disabled={Boolean(itemAction)}
                    onClick={() => void deleteHomeworkPermanently(x, "archive")}
                  >
                    {itemAction?.id === x.id && itemAction.kind === "delete"
                      ? "Deleting…"
                      : "Delete Permanently"}
                  </button>
                </footer>
              </section>
            </div>
          );
        })()}
      {saveAction !== "idle" && (
        <div className="hw-save-progress" role="status" aria-live="assertive">
          <i />
          <b>
            {saveAction === "publishing"
              ? "Publishing homework…"
              : saveAction === "scheduling"
                ? "Scheduling homework…"
                : "Saving homework…"}
          </b>
        </div>
      )}{" "}
      {saveFeedback && (
        <div
          className={`hw-save-feedback ${saveFeedback.kind}`}
          role="status"
          aria-live="assertive"
        >
          <i>{saveFeedback.kind === "success" ? "✓" : "!"}</i>
          <div>
            <b>{saveFeedback.title}</b>
            <span>{saveFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            aria-label="Close save confirmation"
          >
            ×
          </button>
        </div>
      )}{" "}
      {toast && (
        <div className="hw-admin-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}{" "}
    </main>
  );
}