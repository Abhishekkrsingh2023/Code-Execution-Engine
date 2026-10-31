"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import MarkdownPreview from "./MarkdownPreview";

const DEFAULT_PYTHON_TEMPLATE = `def solve():
    # Write your solution here
    pass

if __name__ == '__main__':
    solve()
`;

const DEFAULT_CPP_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}
`;

const DEFAULT_JAVA_TEMPLATE = `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Write your solution here
    }
}
`;

const DEFAULT_C_TEMPLATE = `#include <stdio.h>

int main() {
    // Write your solution here
    return 0;
}
`;

export default function ProblemManager({ showToast, setConfirmDialog }) {
  const [problems, setProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  // Filters
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit" | "inspect"
  const [modalTab, setModalTab] = useState("basics"); // "basics" | "statement" | "tests" | "templates"
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty: "easy",
    category: "Algorithms",
    topic: "array",
    time_limit: 2.0,
    memory_limit: 256,
    status: "published",
    run_test_cases: [{ input: "5\n1 2 3 4 5", expected_output: "15" }],
    submit_test_cases: [
      { input: "5\n1 2 3 4 5", expected_output: "15" },
      { input: "3\n10 20 30", expected_output: "60" },
    ],
    templates: {
      python: DEFAULT_PYTHON_TEMPLATE,
      cpp: DEFAULT_CPP_TEMPLATE,
      java: DEFAULT_JAVA_TEMPLATE,
      c: DEFAULT_C_TEMPLATE,
    },
  });

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", page * limit);
      params.set("limit", limit);
      if (search.trim()) params.set("search", search.trim());
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await api.get(`/api-v1/problems?${params.toString()}`);
      setProblems(res?.problems || []);
      setTotal(res?.total || 0);
    } catch (err) {
      showToast?.(err.message || "Failed to retrieve problem catalog.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, difficultyFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      difficulty: "easy",
      category: "Algorithms",
      topic: "array",
      time_limit: 2.0,
      memory_limit: 256,
      status: "published",
      run_test_cases: [{ input: "5\n1 2 3 4 5", expected_output: "15" }],
      submit_test_cases: [
        { input: "5\n1 2 3 4 5", expected_output: "15" },
        { input: "3\n10 20 30", expected_output: "60" },
      ],
      templates: {
        python: DEFAULT_PYTHON_TEMPLATE,
        cpp: DEFAULT_CPP_TEMPLATE,
        java: DEFAULT_JAVA_TEMPLATE,
        c: DEFAULT_C_TEMPLATE,
      },
    });
    setModalTab("basics");
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setShowModal(true);
  };

  const openEditModal = async (prob) => {
    setSelectedProblemId(prob.id);
    setModalMode("edit");
    setModalTab("basics");
    setShowModal(true);

    try {
      const full = await api.get(`/api-v1/problems/${prob.id}/full`);
      const p = full?.problem || prob;
      setFormData({
        title: p.title || "",
        description: p.description || "",
        difficulty: p.difficulty || "easy",
        category: p.category || "Algorithms",
        topic: p.topic || "array",
        time_limit: p.time_limit || 2.0,
        memory_limit: p.memory_limit || 256,
        status: p.status || "published",
        run_test_cases: full?.run_test_cases?.length
          ? full.run_test_cases
          : [{ input: "", expected_output: "" }],
        submit_test_cases: full?.submit_test_cases?.length
          ? full.submit_test_cases
          : [{ input: "", expected_output: "" }],
        templates: {
          python: full?.templates?.python || DEFAULT_PYTHON_TEMPLATE,
          cpp: full?.templates?.cpp || DEFAULT_CPP_TEMPLATE,
          java: full?.templates?.java || DEFAULT_JAVA_TEMPLATE,
          c: full?.templates?.c || DEFAULT_C_TEMPLATE,
        },
      });
    } catch {
      // Fallback to basic problem data
      setFormData((prev) => ({
        ...prev,
        title: prob.title || "",
        description: prob.description || "",
        difficulty: prob.difficulty || "easy",
        category: prob.category || "Algorithms",
        topic: prob.topic || "array",
        time_limit: prob.time_limit || 2.0,
        memory_limit: prob.memory_limit || 256,
        status: prob.status || "published",
      }));
    }
  };

  const handleSaveProblem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modalMode === "create") {
        await api.post("/api-v1/problems/full", formData);
        showToast?.("Problem created and published successfully!", "success");
      } else {
        await api.patch(`/api-v1/problems/${selectedProblemId}`, {
          title: formData.title,
          description: formData.description,
          difficulty: formData.difficulty,
          category: formData.category,
          topic: formData.topic,
          time_limit: formData.time_limit,
          memory_limit: formData.memory_limit,
          status: formData.status,
        });
        showToast?.("Problem details updated successfully!", "success");
      }
      setShowModal(false);
      fetchProblems();
    } catch (err) {
      showToast?.(err.message || "Failed to commit problem.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (problemId, newStatus) => {
    try {
      await api.patch(`/api-v1/problems/${problemId}/status`, {
        status: newStatus,
      });
      showToast?.(`Problem status updated to ${newStatus}.`, "success");
      fetchProblems();
    } catch (err) {
      showToast?.(err.message || "Failed to update problem status.", "error");
    }
  };

  const handleDeleteProblem = (prob) => {
    setConfirmDialog?.({
      isOpen: true,
      title: "Archive / Delete Problem",
      message: `Are you sure you want to delete problem #${prob.id} "${prob.title}"? This will remove it from the public problem catalog.`,
      confirmText: "Delete Problem",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/problems/${prob.id}`);
          showToast?.(`Problem #${prob.id} deleted successfully.`, "success");
          fetchProblems();
        } catch (err) {
          showToast?.(err.message || "Failed to delete problem.", "error");
        }
      },
    });
  };

  // Test Case list helpers
  const updateRunTest = (index, field, value) => {
    const updated = [...formData.run_test_cases];
    updated[index][field] = value;
    setFormData({ ...formData, run_test_cases: updated });
  };

  const addRunTest = () => {
    setFormData({
      ...formData,
      run_test_cases: [
        ...formData.run_test_cases,
        { input: "", expected_output: "" },
      ],
    });
  };

  const removeRunTest = (index) => {
    const updated = formData.run_test_cases.filter((_, i) => i !== index);
    setFormData({ ...formData, run_test_cases: updated });
  };

  const updateSubmitTest = (index, field, value) => {
    const updated = [...formData.submit_test_cases];
    updated[index][field] = value;
    setFormData({ ...formData, submit_test_cases: updated });
  };

  const addSubmitTest = () => {
    setFormData({
      ...formData,
      submit_test_cases: [
        ...formData.submit_test_cases,
        { input: "", expected_output: "" },
      ],
    });
  };

  const removeSubmitTest = (index) => {
    const updated = formData.submit_test_cases.filter((_, i) => i !== index);
    setFormData({ ...formData, submit_test_cases: updated });
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Problem Management & Authoring</h1>
          <p className="page-subtitle">
            Create, calibrate, edit, and configure problem statements, test cases, and starter templates.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
        >
          <svg
            style={{ width: "16px", height: "16px" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Author New Problem
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <div className="search-input-wrap">
            <svg
              className="search-icon-svg"
              style={{ width: "16px", height: "16px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search problems by title, topic..."
              className="form-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <select
            className="form-select"
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing <strong>{problems.length}</strong> of <strong>{total}</strong> problems
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Problem Title</th>
              <th>Difficulty</th>
              <th>Category / Topic</th>
              <th>Limits</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-muted)" }}>Loading problem catalog...</div>
                </td>
              </tr>
            ) : problems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-dim)" }}>
                    No problems match the specified query and filters.
                  </div>
                </td>
              </tr>
            ) : (
              problems.map((prob) => (
                <tr key={prob.id}>
                  <td style={{ fontWeight: 700, color: "var(--text-dim)" }}>
                    #{prob.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                      {prob.title}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${prob.difficulty || "easy"}`}>
                      {prob.difficulty}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
                      {prob.category || "Algorithms"} / {prob.topic || "General"}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {prob.time_limit || 2}s / {prob.memory_limit || 256}MB
                    </span>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.775rem" }}
                      value={prob.status}
                      onChange={(e) => handleStatusChange(prob.id, e.target.value)}
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        gap: "0.5rem",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(prob)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteProblem(prob)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination-bar">
          <div>
            Page <strong>{page + 1}</strong> of{" "}
            <strong>{Math.max(1, Math.ceil(total / limit))}</strong>
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={(page + 1) * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Authoring & Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveProblem} className="modal-form">
              <div className="modal-header">
                <h2 className="modal-title">
                  {modalMode === "create"
                    ? "Author New Problem"
                    : `Edit Problem #${selectedProblemId}`}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="modal-tab-bar">
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === "basics" ? "active" : ""}`}
                  onClick={() => setModalTab("basics")}
                >
                  1. Basic Info & Limits
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === "statement" ? "active" : ""}`}
                  onClick={() => setModalTab("statement")}
                >
                  2. Statement & Markdown
                </button>
                {modalMode === "create" && (
                  <>
                    <button
                      type="button"
                      className={`modal-tab-btn ${modalTab === "tests" ? "active" : ""}`}
                      onClick={() => setModalTab("tests")}
                    >
                      3. Test Cases Suite
                    </button>
                    <button
                      type="button"
                      className={`modal-tab-btn ${
                        modalTab === "templates" ? "active" : ""
                      }`}
                      onClick={() => setModalTab("templates")}
                    >
                      4. Language Templates
                    </button>
                  </>
                )}
              </div>

              <div className="modal-body">
                {/* TAB 1: Basics */}
                {modalTab === "basics" && (
                  <div>
                    <div className="form-group">
                      <label className="form-label">Problem Title</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        style={{ width: "100%" }}
                        placeholder="e.g. Invert Binary Tree"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Difficulty</label>
                        <select
                          className="form-select"
                          style={{ width: "100%" }}
                          value={formData.difficulty}
                          onChange={(e) =>
                            setFormData({ ...formData, difficulty: e.target.value })
                          }
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{ width: "100%" }}
                          placeholder="Algorithms, Data Structures..."
                          value={formData.category}
                          onChange={(e) =>
                            setFormData({ ...formData, category: e.target.value })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Topic Tag</label>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{ width: "100%" }}
                          placeholder="array, dynamic-programming, tree..."
                          value={formData.topic}
                          onChange={(e) =>
                            setFormData({ ...formData, topic: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Time Limit (seconds)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10.0"
                          required
                          className="form-input"
                          style={{ width: "100%" }}
                          value={formData.time_limit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              time_limit: parseFloat(e.target.value) || 2.0,
                            })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Memory Limit (MB)</label>
                        <input
                          type="number"
                          min="16"
                          max="1024"
                          required
                          className="form-input"
                          style={{ width: "100%" }}
                          value={formData.memory_limit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              memory_limit: parseInt(e.target.value, 10) || 256,
                            })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Publication Status</label>
                        <select
                          className="form-select"
                          style={{ width: "100%" }}
                          value={formData.status}
                          onChange={(e) =>
                            setFormData({ ...formData, status: e.target.value })
                          }
                        >
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Statement */}
                {modalTab === "statement" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1.25rem",
                    }}
                  >
                    <div>
                      <label className="form-label">
                        Problem Statement (Markdown Supported)
                      </label>
                      <textarea
                        className="form-textarea"
                        style={{
                          width: "100%",
                          height: "360px",
                          fontFamily: "monospace",
                        }}
                        placeholder="Write clear problem description, inputs, outputs, constraints, examples..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="form-label">Live Preview</label>
                      <div style={{ height: "360px", overflowY: "auto" }}>
                        <MarkdownPreview content={formData.description} />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Test Cases */}
                {modalTab === "tests" && modalMode === "create" && (
                  <div>
                    {/* Run Test Cases */}
                    <div style={{ marginBottom: "2rem" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
                            Public Run Test Cases (Visible to Solvers)
                          </h3>
                          <span
                            style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                          >
                            Used when user runs sample tests before final submission.
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={addRunTest}
                        >
                          + Add Run Test
                        </button>
                      </div>

                      {formData.run_test_cases.map((tc, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(11, 14, 22, 0.6)",
                            padding: "0.85rem",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "var(--accent-primary)",
                              }}
                            >
                              Sample Test #{idx + 1}
                            </span>
                            {formData.run_test_cases.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRunTest(idx)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#f87171",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.75rem",
                            }}
                          >
                            <div>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                                Standard Input (stdin)
                              </label>
                              <textarea
                                className="form-textarea"
                                style={{
                                  width: "100%",
                                  height: "70px",
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                }}
                                value={tc.input}
                                onChange={(e) =>
                                  updateRunTest(idx, "input", e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                                Expected Output (stdout)
                              </label>
                              <textarea
                                className="form-textarea"
                                style={{
                                  width: "100%",
                                  height: "70px",
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                }}
                                value={tc.expected_output}
                                onChange={(e) =>
                                  updateRunTest(idx, "expected_output", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Submit Test Cases */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
                            Hidden Evaluation Test Cases (Judging Suite)
                          </h3>
                          <span
                            style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                          >
                            Evaluated upon final submission for verdict calculation.
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={addSubmitTest}
                        >
                          + Add Evaluation Test
                        </button>
                      </div>

                      {formData.submit_test_cases.map((tc, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(11, 14, 22, 0.6)",
                            padding: "0.85rem",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "var(--color-success)",
                              }}
                            >
                              Judge Test #{idx + 1}
                            </span>
                            {formData.submit_test_cases.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSubmitTest(idx)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#f87171",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.75rem",
                            }}
                          >
                            <div>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                                Standard Input (stdin)
                              </label>
                              <textarea
                                className="form-textarea"
                                style={{
                                  width: "100%",
                                  height: "70px",
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                }}
                                value={tc.input}
                                onChange={(e) =>
                                  updateSubmitTest(idx, "input", e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: "0.7rem" }}>
                                Expected Output (stdout)
                              </label>
                              <textarea
                                className="form-textarea"
                                style={{
                                  width: "100%",
                                  height: "70px",
                                  fontFamily: "monospace",
                                  fontSize: "0.8rem",
                                }}
                                value={tc.expected_output}
                                onChange={(e) =>
                                  updateSubmitTest(idx, "expected_output", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 4: Templates */}
                {modalTab === "templates" && modalMode === "create" && (
                  <div>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--text-muted)",
                        marginBottom: "1.25rem",
                      }}
                    >
                      Define starter scaffolding code presented to users when they open the solver IDE.
                    </p>

                    <div className="form-group">
                      <label className="form-label">Python Starter Template</label>
                      <textarea
                        className="code-editor-area"
                        rows={6}
                        value={formData.templates.python}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: {
                              ...formData.templates,
                              python: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">C++ Starter Template</label>
                      <textarea
                        className="code-editor-area"
                        rows={6}
                        value={formData.templates.cpp}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: {
                              ...formData.templates,
                              cpp: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Java Starter Template</label>
                      <textarea
                        className="code-editor-area"
                        rows={6}
                        value={formData.templates.java}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: {
                              ...formData.templates,
                              java: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">C Starter Template</label>
                      <textarea
                        className="code-editor-area"
                        rows={6}
                        value={formData.templates.c}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            templates: {
                              ...formData.templates,
                              c: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.title.trim()}
                  className="btn btn-primary"
                >
                  {saving
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Problem"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
