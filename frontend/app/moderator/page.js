"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import AccessDenied from "@/components/AccessDenied";
import ProblemMarkdown from "@/components/ProblemMarkdown";
import ConfirmModal from "@/components/ConfirmModal";

const DEFAULT_PYTHON_TEMPLATE = `"""
Write your solution here.
Read inputs from standard input if required.
"""
`;

const DEFAULT_CPP_TEMPLATE = `
/*
Write your solution here.
Read inputs from standard input if required.
*/
`;

const DEFAULT_JAVA_TEMPLATE = `
/*
Write your solution here.
Read inputs from standard input if required.

Note: Write the class Main.
*/
`;

const DEFAULT_C_TEMPLATE = `
/*
Write your solution here.
Read inputs from standard input if required.
*/
`;

export default function ModeratorPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const isAuthorized = isAdmin || isModerator;

  // ───────────────────────────────────────────────────────────────────────────
  // Problems List State
  // ───────────────────────────────────────────────────────────────────────────
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsTotal, setProblemsTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 15;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");

  // Notification / Alert
  const [toast, setToast] = useState(null); // { type: "success" | "error", message: string }

  // Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    onConfirm: () => {},
  });

  const showToast = (message, type = "success") => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Modals State
  // ───────────────────────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [showTestSuiteModal, setShowTestSuiteModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("basics"); // "basics" | "statement" | "tests" | "templates"
  const [previewMarkdown, setPreviewMarkdown] = useState(false);

  // Selected Problem for Inspect/Edit
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [fullProblemData, setFullProblemData] = useState(null);
  const [fullProblemLoading, setFullProblemLoading] = useState(false);

  // Creation / Edit Form State
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty: "easy",
    category: "Algorithms",
    topic: "array",
    time_limit: 2.0,
    memory_limit: 256,
    status: "published",
    run_test_cases: [
      { input: "5\n1 2 3 4 5", expected_output: "15" }
    ],
    submit_test_cases: [
      { input: "5\n1 2 3 4 5", expected_output: "15" },
      { input: "3\n10 20 30", expected_output: "60" }
    ],
    templates: {
      python: DEFAULT_PYTHON_TEMPLATE,
      cpp: DEFAULT_CPP_TEMPLATE,
      java: DEFAULT_JAVA_TEMPLATE,
      c: DEFAULT_C_TEMPLATE,
    },
  });

  // Test Suite editor state (for existing problem)
  const [testSuiteForm, setTestSuiteForm] = useState({
    problem_id: null,
    problem_statement: "",
    time_limit: 2.0,
    run_test_cases: [],
    submit_test_cases: [],
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch Problems
  // ───────────────────────────────────────────────────────────────────────────
  const fetchProblems = useCallback(async () => {
    if (!isAuthorized) return;
    setProblemsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", page * limit);
      params.set("limit", limit);
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (topicFilter) params.set("topic", topicFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await api.get(`/api-v1/problems?${params.toString()}`);
      setProblems(res?.problems || []);
      setProblemsTotal(res?.total || 0);
    } catch (err) {
      showToast(err.message || "Failed to load problems.", "error");
    } finally {
      setProblemsLoading(false);
    }
  }, [isAuthorized, page, difficultyFilter, statusFilter, topicFilter, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!authLoading && isAuthorized) {
        fetchProblems();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [authLoading, isAuthorized, fetchProblems]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const total = problemsTotal;
    const published = problems.filter((p) => p.status === "published").length;
    const drafts = problems.filter((p) => p.status === "draft" || p.status === "unpublished").length;
    const easyCount = problems.filter((p) => p.difficulty === "easy").length;
    const medCount = problems.filter((p) => p.difficulty === "medium").length;
    const hardCount = problems.filter((p) => p.difficulty === "hard").length;
    return { total, published, drafts, easyCount, medCount, hardCount };
  }, [problems, problemsTotal]);

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Quick Status Change
  // ───────────────────────────────────────────────────────────────────────────
  const handleQuickStatusChange = async (problemId, newStatus) => {
    try {
      await api.patch(`/api-v1/problems/${problemId}/status`, {
        status: newStatus,
      });
      // Optimistic update
      setProblems((prev) =>
        prev.map((p) => (p.id === problemId ? { ...p, status: newStatus } : p))
      );
      showToast(`Problem #${problemId} status updated to ${newStatus}.`);
    } catch (err) {
      showToast(err.message || "Failed to update problem status.", "error");
      fetchProblems();
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Delete Problem
  // ───────────────────────────────────────────────────────────────────────────
  const handleDeleteProblem = (problemId, title) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Problem?",
      message: `Are you sure you want to delete problem #${problemId}: "${title}"?\nThis action will soft-delete the challenge.`,
      confirmText: "Delete Problem",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/problems/${problemId}`);
          showToast(`Problem #${problemId} successfully deleted.`);
          fetchProblems();
        } catch (err) {
          showToast(err.message || "Failed to delete problem.", "error");
        }
      },
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Inspect Full Problem
  // ───────────────────────────────────────────────────────────────────────────
  const handleInspectProblem = async (problem) => {
    setSelectedProblem(problem);
    setShowInspectModal(true);
    setFullProblemLoading(true);
    setFullProblemData(null);

    try {
      const res = await api.get(`/api-v1/problems/${problem.id}/full`);
      setFullProblemData(res);
    } catch (err) {
      showToast(err.message || "Unable to retrieve complete problem details.", "error");
    } finally {
      setFullProblemLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Open Create Modal
  // ───────────────────────────────────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    setFormData({
      title: "",
      description: "",
      difficulty: "easy",
      category: "Algorithms",
      topic: "array",
      time_limit: 2.0,
      memory_limit: 256,
      status: "published",
      run_test_cases: [
        { input: "5\n1 2 3 4 5", expected_output: "15" }
      ],
      submit_test_cases: [
        { input: "5\n1 2 3 4 5", expected_output: "15" },
        { input: "3\n10 20 30", expected_output: "60" }
      ],
      templates: {
        python: DEFAULT_PYTHON_TEMPLATE,
        cpp: DEFAULT_CPP_TEMPLATE,
        java: DEFAULT_JAVA_TEMPLATE,
        c: DEFAULT_C_TEMPLATE,
      },
    });
    setFormError("");
    setActiveModalTab("basics");
    setPreviewMarkdown(false);
    setShowCreateModal(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Open Edit Modal
  // ───────────────────────────────────────────────────────────────────────────
  const handleOpenEditModal = (problem) => {
    setSelectedProblem(problem);
    setFormData({
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      category: problem.category,
      topic: problem.topic,
      time_limit: problem.time_limit,
      memory_limit: problem.memory_limit,
      status: problem.status,
      run_test_cases: [],
      submit_test_cases: [],
      templates: {},
    });
    setFormError("");
    setActiveModalTab("basics");
    setShowEditModal(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: Open Test Suite & Templates Modal
  // ───────────────────────────────────────────────────────────────────────────
  const handleOpenTestSuiteModal = async (problem) => {
    setSelectedProblem(problem);
    setShowTestSuiteModal(true);
    setFullProblemLoading(true);

    try {
      // Try to load common template if exists
      let templateData = null;
      try {
        templateData = await api.get(`/api-v1/problems/templates/common/${problem.id}`);
      } catch {
        // Fallback to /full
        const full = await api.get(`/api-v1/problems/${problem.id}/full`);
        templateData = {
          problem_id: problem.id,
          problem_statement: full.problem?.description || problem.description,
          time_limit: full.problem?.time_limit || problem.time_limit,
          run_test_cases: full.run_test_cases || [],
          submit_test_cases: [],
        };
      }

      setTestSuiteForm({
        problem_id: problem.id,
        problem_statement: templateData.problem_statement || problem.description,
        time_limit: templateData.time_limit || problem.time_limit,
        run_test_cases: Array.isArray(templateData.run_test_cases) && templateData.run_test_cases.length > 0
          ? templateData.run_test_cases
          : [{ input: "", expected_output: "" }],
        submit_test_cases: Array.isArray(templateData.submit_test_cases) && templateData.submit_test_cases.length > 0
          ? templateData.submit_test_cases
          : [{ input: "", expected_output: "" }],
      });
    } catch (err) {
      showToast(err.message || "Failed to load test suite.", "error");
    } finally {
      setFullProblemLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Form Submission: Create Full Problem
  // ───────────────────────────────────────────────────────────────────────────
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError("");

    try {
      // Validate test cases
      const validRunCases = formData.run_test_cases.filter(
        (tc) => tc.input.trim() || tc.expected_output.trim()
      );
      const validSubmitCases = formData.submit_test_cases.filter(
        (tc) => tc.input.trim() || tc.expected_output.trim()
      );

      if (validRunCases.length === 0) {
        throw new Error("At least one sample run test case is required.");
      }
      if (validSubmitCases.length === 0) {
        throw new Error("At least one judge submit test case is required.");
      }

      // Format templates
      const templatesList = [];
      if (formData.templates.python) {
        templatesList.push({ language: "python", boilerplate_code: formData.templates.python });
      }
      if (formData.templates.cpp) {
        templatesList.push({ language: "cpp", boilerplate_code: formData.templates.cpp });
      }
      if (formData.templates.java) {
        templatesList.push({ language: "java", boilerplate_code: formData.templates.java });
      }
      if (formData.templates.c) {
        templatesList.push({ language: "c", boilerplate_code: formData.templates.c });
      }

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
        category: formData.category.trim() || "Algorithms",
        topic: formData.topic.trim() || "General",
        time_limit: parseFloat(formData.time_limit),
        memory_limit: parseInt(formData.memory_limit, 10),
        status: formData.status,
        run_test_cases: validRunCases.map((tc) => ({
          input: tc.input,
          expected_output: tc.expected_output,
          is_sample: true,
          weight: 1.0,
        })),
        submit_test_cases: validSubmitCases.map((tc) => ({
          input: tc.input,
          expected_output: tc.expected_output,
          is_sample: false,
          weight: 1.0,
        })),
        templates: templatesList,
      };

      const res = await api.post("/api-v1/problems/full", payload);
      showToast(`Challenge "${res.problem?.title || formData.title}" published successfully!`);
      setShowCreateModal(false);
      fetchProblems();
    } catch (err) {
      setFormError(err.message || "Failed to create problem.");
    } finally {
      setFormSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Form Submission: Edit Problem Metadata
  // ───────────────────────────────────────────────────────────────────────────
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProblem) return;
    setFormSaving(true);
    setFormError("");

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
        category: formData.category.trim() || "Algorithms",
        topic: formData.topic.trim() || "General",
        time_limit: parseFloat(formData.time_limit),
        memory_limit: parseInt(formData.memory_limit, 10),
        status: formData.status,
      };

      await api.patch(`/api-v1/problems/${selectedProblem.id}`, payload);
      showToast(`Problem #${selectedProblem.id} updated successfully.`);
      setShowEditModal(false);
      fetchProblems();
    } catch (err) {
      setFormError(err.message || "Failed to update problem.");
    } finally {
      setFormSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Form Submission: Save Test Suite & Common Template
  // ───────────────────────────────────────────────────────────────────────────
  const handleSaveTestSuite = async (e) => {
    e.preventDefault();
    if (!selectedProblem) return;
    setFormSaving(true);
    setFormError("");

    try {
      const payload = {
        problem_id: selectedProblem.id,
        problem_statement: testSuiteForm.problem_statement || selectedProblem.description,
        time_limit: parseFloat(testSuiteForm.time_limit) || 2.0,
        run_test_cases: testSuiteForm.run_test_cases.filter(
          (tc) => tc.input || tc.expected_output
        ),
        submit_test_cases: testSuiteForm.submit_test_cases.filter(
          (tc) => tc.input || tc.expected_output
        ),
      };

      await api.post("/api-v1/problems/templates/common", payload);
      showToast(`Test suite for problem #${selectedProblem.id} updated successfully.`);
      setShowTestSuiteModal(false);
      fetchProblems();
    } catch (err) {
      setFormError(err.message || "Failed to update test suite.");
    } finally {
      setFormSaving(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Dynamic Test Case Handlers
  // ───────────────────────────────────────────────────────────────────────────
  const addRunTestCase = () => {
    setFormData((prev) => ({
      ...prev,
      run_test_cases: [...prev.run_test_cases, { input: "", expected_output: "" }],
    }));
  };

  const removeRunTestCase = (idx) => {
    setFormData((prev) => ({
      ...prev,
      run_test_cases: prev.run_test_cases.filter((_, i) => i !== idx),
    }));
  };

  const addSubmitTestCase = () => {
    setFormData((prev) => ({
      ...prev,
      submit_test_cases: [...prev.submit_test_cases, { input: "", expected_output: "" }],
    }));
  };

  const removeSubmitTestCase = (idx) => {
    setFormData((prev) => ({
      ...prev,
      submit_test_cases: prev.submit_test_cases.filter((_, i) => i !== idx),
    }));
  };

  // Dynamic test cases for test suite modal
  const addTestSuiteRunCase = () => {
    setTestSuiteForm((prev) => ({
      ...prev,
      run_test_cases: [...prev.run_test_cases, { input: "", expected_output: "" }],
    }));
  };

  const removeTestSuiteRunCase = (idx) => {
    setTestSuiteForm((prev) => ({
      ...prev,
      run_test_cases: prev.run_test_cases.filter((_, i) => i !== idx),
    }));
  };

  const addTestSuiteSubmitCase = () => {
    setTestSuiteForm((prev) => ({
      ...prev,
      submit_test_cases: [...prev.submit_test_cases, { input: "", expected_output: "" }],
    }));
  };

  const removeTestSuiteSubmitCase = (idx) => {
    setTestSuiteForm((prev) => ({
      ...prev,
      submit_test_cases: prev.submit_test_cases.filter((_, i) => i !== idx),
    }));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Guard Check
  // ───────────────────────────────────────────────────────────────────────────
  if (!authLoading && !isAuthorized) {
    return <AccessDenied requiredRole="moderator" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md text-xs font-medium transition-all ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-700 text-rose-200"
              : "bg-emerald-950/90 border-emerald-700 text-emerald-200"
          }`}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#0a0d14] via-[#0d121f] to-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Moderator Studio
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/60">
              {user?.role}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Verified Curator
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Curate algorithmic problems, configure test case suites, manage boilerplate language templates, and publish programming challenges to Code0.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <Link
              href="/admin"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0e1322] hover:bg-[#131a30] text-amber-300 border border-amber-500/30 transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Admin Console</span>
            </Link>
          )}

          <button
            type="button"
            onClick={fetchProblems}
            disabled={problemsLoading}
            className="p-2 rounded-xl text-xs font-medium bg-[#0e1322] hover:bg-[#131a30] text-slate-300 border border-white/10 transition-colors"
            title="Refresh problem listings"
          >
            <svg
              className={`w-4 h-4 ${problemsLoading ? "animate-spin text-indigo-400" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all flex items-center space-x-1.5 active:scale-98"
          >
            <span>+</span>
            <span>Create Problem</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 shadow-md shadow-black/30">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
            Total Problems
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {metrics.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Across all categories
          </div>
        </div>

        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 shadow-md shadow-black/30">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
            Live Published
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {metrics.published}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Available in solver
          </div>
        </div>

        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 shadow-md shadow-black/30">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
            Drafts & Unpub
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {metrics.drafts}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Pending curation
          </div>
        </div>

        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 shadow-md shadow-black/30">
          <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
            Difficulty Ratio
          </div>
          <div className="text-sm font-bold text-slate-200 font-mono mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400">{metrics.easyCount}E</span>
            <span className="text-slate-600">/</span>
            <span className="text-amber-400">{metrics.medCount}M</span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400">{metrics.hardCount}H</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Easy / Med / Hard
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-lg shadow-black/30">
        <div className="flex-1 min-w-[240px] max-w-md">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by title, topic, or keyword..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="w-full bg-[#080b13] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>

          <input
            type="text"
            placeholder="Topic (e.g. array, dp)"
            value={topicFilter}
            onChange={(e) => {
              setTopicFilter(e.target.value);
              setPage(0);
            }}
            className="w-32 bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {(searchQuery || difficultyFilter || statusFilter || topicFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDifficultyFilter("");
                setStatusFilter("");
                setTopicFilter("");
                setPage(0);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Problems Table */}
      <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
        {problemsLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : problems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#0d121f] text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-white/[0.08]">
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4">Title & Topic</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Limits</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {problems.map((p) => {
                  const difficultyColor =
                    p.difficulty === "easy"
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                      : p.difficulty === "medium"
                      ? "bg-amber-950/60 text-amber-400 border-amber-800/40"
                      : "bg-rose-950/60 text-rose-400 border-rose-800/40";

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">
                        #{p.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleInspectProblem(p)}
                            className="text-left hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
                          >
                            {p.title}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 font-mono">
                            {p.topic || "general"}
                          </span>
                          <span>•</span>
                          <span>{p.category || "Algorithms"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-md text-[10px] font-bold border ${difficultyColor}`}
                        >
                          {p.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                        <div>{p.time_limit}s</div>
                        <div className="text-[10px] text-slate-500">{p.memory_limit} MB</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={p.status}
                          onChange={(e) => handleQuickStatusChange(p.id, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold uppercase border bg-[#0b0f17] transition-all cursor-pointer ${
                            p.status === "published"
                              ? "text-emerald-400 border-emerald-800/60"
                              : p.status === "draft"
                              ? "text-amber-400 border-amber-800/60"
                              : "text-slate-400 border-slate-700"
                          }`}
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="unpublished">Unpublished</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleInspectProblem(p)}
                            className="px-2.5 py-1 rounded-lg bg-[#0e1322] hover:bg-[#151c33] text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-medium transition-all"
                            title="Inspect complete problem details"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTestSuiteModal(p)}
                            className="px-2.5 py-1 rounded-lg bg-[#0e1322] hover:bg-[#151c33] text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-medium transition-all"
                            title="Configure test cases & templates"
                          >
                            Test Suite
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-all"
                            title="Edit metadata"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProblem(p.id, p.title)}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-[11px] font-medium border border-rose-800/40 transition-all"
                            title="Delete problem"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="text-3xl">📝</div>
            <div className="text-sm font-semibold text-white">No challenges found</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No problems match the current filter criteria. Try adjusting your query or create a new challenge.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              + Create Problem
            </button>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-[#0d121f] border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-white">
              {problemsTotal > 0 ? page * limit + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-white">
              {Math.min((page + 1) * limit, problemsTotal)}
            </span>{" "}
            of <span className="font-semibold text-white">{problemsTotal}</span> problems
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-[#080b13] border border-white/10 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-slate-200"
            >
              Previous
            </button>
            <span className="px-2 text-slate-300 font-mono">
              Page {page + 1} of {Math.max(1, Math.ceil(problemsTotal / limit))}
            </span>
            <button
              type="button"
              disabled={(page + 1) * limit >= problemsTotal}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-[#080b13] border border-white/10 hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-slate-200"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Create Problem (Multi-step / Tabbed) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/90">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <div>
                <h3 className="text-base font-bold text-white">
                  Create New Programming Challenge
                </h3>
                <p className="text-[11px] text-slate-400">
                  Atomic creation with test suite and multi-language boilerplate templates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs inside modal */}
            <div className="flex border-b border-white/[0.08] px-6 bg-[#080b13] text-xs">
              <button
                type="button"
                onClick={() => setActiveModalTab("basics")}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeModalTab === "basics"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                1. Metadata & Limits
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("statement")}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeModalTab === "statement"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                2. Problem Statement (Markdown)
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("tests")}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeModalTab === "tests"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                3. Test Suite ({formData.run_test_cases.length} Run, {formData.submit_test_cases.length} Judge)
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab("templates")}
                className={`py-3 px-3 font-semibold border-b-2 transition-colors ${
                  activeModalTab === "templates"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                4. Starter Templates
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB: BASICS */}
              {activeModalTab === "basics" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      Problem Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Valid Anagram or Maximum Subarray"
                      className="w-full px-3.5 py-2.5 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Difficulty
                      </label>
                      <select
                        value={formData.difficulty}
                        onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Publication Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="published">Published (Live immediately)</option>
                        <option value="draft">Draft (Curator review only)</option>
                        <option value="unpublished">Unpublished</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Topic Tag (Data Structure / Paradigm)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                        placeholder="e.g. array, tree, string, dynamic-programming"
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Category Classification
                      </label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g. Algorithms or Data Structures"
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Execution Time Limit (seconds)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10.0"
                        required
                        value={formData.time_limit}
                        onChange={(e) => setFormData({ ...formData, time_limit: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Default: 2.0 seconds
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Execution Memory Limit (MB)
                      </label>
                      <input
                        type="number"
                        min="16"
                        max="1024"
                        required
                        value={formData.memory_limit}
                        onChange={(e) => setFormData({ ...formData, memory_limit: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Default: 256 MB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: STATEMENT */}
              {activeModalTab === "statement" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase">
                      Problem Statement & Constraints (Markdown Supported) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setPreviewMarkdown(!previewMarkdown)}
                      className="px-2.5 py-1 rounded bg-[#0e1322] hover:bg-[#151c33] border border-white/10 text-xs text-indigo-400 font-medium transition-colors"
                    >
                      {previewMarkdown ? "Edit Raw Markdown" : "👁️ Preview Render"}
                    </button>
                  </div>

                  {previewMarkdown ? (
                    <div className="p-4 bg-[#090d16] border border-white/10 rounded-xl min-h-[300px] max-h-[450px] overflow-y-auto">
                      <ProblemMarkdown content={formData.description || "*No description provided yet.*"} />
                    </div>
                  ) : (
                    <textarea
                      required
                      rows={12}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="# Problem Statement&#10;&#10;Given an array of integers...&#10;&#10;### Examples&#10;**Input:** `[2, 7, 11, 15]`, `target = 9`&#10;**Output:** `[0, 1]`&#10;&#10;### Constraints&#10;- `2 <= nums.length <= 10^4`&#10;- `-10^9 <= nums[i] <= 10^9`"
                      className="w-full px-3.5 py-3 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-slate-100 font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                </div>
              )}

              {/* TAB: TEST SUITE */}
              {activeModalTab === "tests" && (
                <div className="space-y-6">
                  {/* Sample Run Test Cases */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Sample Run Test Cases (Visible in Solver)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          These cases are executed when users click &ldquo;Run Code&rdquo;.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addRunTestCase}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-medium"
                      >
                        + Add Sample Case
                      </button>
                    </div>

                    {formData.run_test_cases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#080b13] border border-white/[0.06] rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Sample Case #{idx + 1}
                          </span>
                          {formData.run_test_cases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRunTestCase(idx)}
                              className="text-rose-400 hover:text-rose-300 text-xs"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Input</span>
                            <textarea
                              rows={2}
                              value={tc.input}
                              onChange={(e) => {
                                const updated = [...formData.run_test_cases];
                                updated[idx].input = e.target.value;
                                setFormData({ ...formData, run_test_cases: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-slate-200"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Expected Output</span>
                            <textarea
                              rows={2}
                              value={tc.expected_output}
                              onChange={(e) => {
                                const updated = [...formData.run_test_cases];
                                updated[idx].expected_output = e.target.value;
                                setFormData({ ...formData, run_test_cases: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hidden Judge Submit Test Cases */}
                  <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Judge Submit Test Cases (Hidden Automated Grading)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          These cases are executed when users click &ldquo;Submit Code&rdquo;.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addSubmitTestCase}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-medium"
                      >
                        + Add Judge Case
                      </button>
                    </div>

                    {formData.submit_test_cases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-[#080b13] border border-white/[0.06] rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Judge Case #{idx + 1}
                          </span>
                          {formData.submit_test_cases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSubmitTestCase(idx)}
                              className="text-rose-400 hover:text-rose-300 text-xs"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Input</span>
                            <textarea
                              rows={2}
                              value={tc.input}
                              onChange={(e) => {
                                const updated = [...formData.submit_test_cases];
                                updated[idx].input = e.target.value;
                                setFormData({ ...formData, submit_test_cases: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-slate-200"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">Expected Output</span>
                            <textarea
                              rows={2}
                              value={tc.expected_output}
                              onChange={(e) => {
                                const updated = [...formData.submit_test_cases];
                                updated[idx].expected_output = e.target.value;
                                setFormData({ ...formData, submit_test_cases: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: TEMPLATES */}
              {activeModalTab === "templates" && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Provide boilerplate starter code for solvers in each supported programming language.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-indigo-400 block mb-1">
                        Python 3 Starter Template
                      </span>
                      <textarea
                        rows={5}
                        value={formData.templates.python}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: { ...formData.templates, python: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs font-mono text-slate-200"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-indigo-400 block mb-1">
                        C++ Starter Template
                      </span>
                      <textarea
                        rows={6}
                        value={formData.templates.cpp}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: { ...formData.templates, cpp: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs font-mono text-slate-200"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-indigo-400 block mb-1">
                        Java Starter Template
                      </span>
                      <textarea
                        rows={6}
                        value={formData.templates.java}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: { ...formData.templates, java: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs font-mono text-slate-200"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-indigo-400 block mb-1">
                        C Starter Template
                      </span>
                      <textarea
                        rows={6}
                        value={formData.templates.c}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: { ...formData.templates, c: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeModalTab !== "basics" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeModalTab === "statement") setActiveModalTab("basics");
                        if (activeModalTab === "tests") setActiveModalTab("statement");
                        if (activeModalTab === "templates") setActiveModalTab("tests");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0e1322] text-xs font-medium text-slate-300 hover:text-white"
                    >
                      ← Back
                    </button>
                  )}
                  {activeModalTab !== "templates" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeModalTab === "basics") setActiveModalTab("statement");
                        if (activeModalTab === "statement") setActiveModalTab("tests");
                        if (activeModalTab === "tests") setActiveModalTab("templates");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0e1322] border border-white/10 text-xs font-medium text-indigo-400 hover:text-white"
                    >
                      Next Step →
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {formSaving ? "Publishing Challenge..." : "Publish Challenge"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Edit Problem Metadata */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showEditModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <h3 className="text-base font-bold text-white">
                Edit Problem #{selectedProblem.id}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Difficulty
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Time Limit (s)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    required
                    value={formData.time_limit}
                    onChange={(e) => setFormData({ ...formData, time_limit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Memory Limit (MB)
                  </label>
                  <input
                    type="number"
                    min="16"
                    max="1024"
                    required
                    value={formData.memory_limit}
                    onChange={(e) => setFormData({ ...formData, memory_limit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Description (Markdown)
                </label>
                <textarea
                  rows={6}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono leading-relaxed resize-y"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {formSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: Inspect Full Problem */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showInspectModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">
                  Problem #{selectedProblem.id}
                </span>
                <h3 className="text-base font-bold text-white">
                  {selectedProblem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {fullProblemLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Retrieving complete problem definition...
                </div>
              ) : (
                <>
                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-slate-800 text-slate-200">
                      {selectedProblem.difficulty}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                      {selectedProblem.topic || "General"}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                      {selectedProblem.status}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px] ml-auto">
                      Limit: {selectedProblem.time_limit}s • {selectedProblem.memory_limit}MB
                    </span>
                  </div>

                  {/* Statement */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Problem Statement
                    </h4>
                    <div className="p-4 bg-[#090d16] border border-white/[0.06] rounded-xl">
                      <ProblemMarkdown
                        content={
                          fullProblemData?.problem?.description || selectedProblem.description || ""
                        }
                      />
                    </div>
                  </div>

                  {/* Run Test Cases */}
                  {fullProblemData?.run_test_cases && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Sample Run Test Cases ({fullProblemData.run_test_cases.length})
                      </h4>
                      <div className="space-y-2">
                        {fullProblemData.run_test_cases.map((tc, i) => (
                          <div
                            key={i}
                            className="p-3 bg-[#080b13] border border-white/[0.06] rounded-xl grid grid-cols-2 gap-3 text-xs font-mono"
                          >
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase block mb-0.5">
                                Input
                              </span>
                              <pre className="text-slate-300 whitespace-pre-wrap">{tc.input || "(empty)"}</pre>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase block mb-0.5">
                                Expected Output
                              </span>
                              <pre className="text-emerald-400 whitespace-pre-wrap">{tc.expected_output}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Language Templates Count */}
                  {fullProblemData?.templates && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Boilerplate Templates Available
                      </h4>
                      <div className="flex gap-2">
                        {fullProblemData.templates.map((tpl) => (
                          <span
                            key={tpl.language}
                            className="px-2 py-1 rounded bg-[#080b13] border border-white/10 text-xs font-mono text-indigo-300"
                          >
                            {tpl.language}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-3 border-t border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <Link
                href={`/problems/${selectedProblem.id}`}
                target="_blank"
                className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 flex items-center gap-1"
              >
                <span>Launch in Solver Playground</span>
                <span>↗</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowInspectModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: Test Suite & Common Template Configuration */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showTestSuiteModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <div>
                <h3 className="text-base font-bold text-white">
                  Test Suite & Judge Cases for #{selectedProblem.id}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Update test runner cases and hidden grading suite via common template endpoint.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTestSuiteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTestSuite} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              {/* Sample Run Test Cases */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Sample Run Test Cases
                  </h4>
                  <button
                    type="button"
                    onClick={addTestSuiteRunCase}
                    className="px-2.5 py-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium"
                  >
                    + Add Run Case
                  </button>
                </div>

                {testSuiteForm.run_test_cases.map((tc, idx) => (
                  <div key={idx} className="p-3 bg-[#080b13] border border-white/[0.06] rounded-xl space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Case #{idx + 1}</span>
                      {testSuiteForm.run_test_cases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTestSuiteRunCase(idx)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <textarea
                        rows={2}
                        placeholder="Input"
                        value={tc.input}
                        onChange={(e) => {
                          const updated = [...testSuiteForm.run_test_cases];
                          updated[idx].input = e.target.value;
                          setTestSuiteForm({ ...testSuiteForm, run_test_cases: updated });
                        }}
                        className="w-full px-2 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-white"
                      />
                      <textarea
                        rows={2}
                        placeholder="Expected Output"
                        value={tc.expected_output}
                        onChange={(e) => {
                          const updated = [...testSuiteForm.run_test_cases];
                          updated[idx].expected_output = e.target.value;
                          setTestSuiteForm({ ...testSuiteForm, run_test_cases: updated });
                        }}
                        className="w-full px-2 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Hidden Submit Cases */}
              <div className="space-y-3 pt-4 border-t border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Hidden Judge Submit Test Cases
                  </h4>
                  <button
                    type="button"
                    onClick={addTestSuiteSubmitCase}
                    className="px-2.5 py-1 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium"
                  >
                    + Add Judge Case
                  </button>
                </div>

                {testSuiteForm.submit_test_cases.map((tc, idx) => (
                  <div key={idx} className="p-3 bg-[#080b13] border border-white/[0.06] rounded-xl space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Judge Case #{idx + 1}</span>
                      {testSuiteForm.submit_test_cases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTestSuiteSubmitCase(idx)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <textarea
                        rows={2}
                        placeholder="Input"
                        value={tc.input}
                        onChange={(e) => {
                          const updated = [...testSuiteForm.submit_test_cases];
                          updated[idx].input = e.target.value;
                          setTestSuiteForm({ ...testSuiteForm, submit_test_cases: updated });
                        }}
                        className="w-full px-2 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-white"
                      />
                      <textarea
                        rows={2}
                        placeholder="Expected Output"
                        value={tc.expected_output}
                        onChange={(e) => {
                          const updated = [...testSuiteForm.submit_test_cases];
                          updated[idx].expected_output = e.target.value;
                          setTestSuiteForm({ ...testSuiteForm, submit_test_cases: updated });
                        }}
                        className="w-full px-2 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTestSuiteModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {formSaving ? "Saving Test Suite..." : "Save Test Suite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmModal
        {...confirmDialog}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
