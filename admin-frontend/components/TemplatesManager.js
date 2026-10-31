"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export default function TemplatesManager({ showToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    problem_id: "",
    problem_statement: "",
    time_limit: 2.0,
    run_test_cases: [{ input: "5\n1 2 3 4 5", expected_output: "15" }],
    submit_test_cases: [{ input: "5\n1 2 3 4 5", expected_output: "15" }],
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api-v1/problems/templates/common");
      setTemplates(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast?.(err.message || "Failed to load common templates.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api-v1/problems/templates/common", {
        problem_id: parseInt(formData.problem_id, 10),
        problem_statement: formData.problem_statement,
        time_limit: parseFloat(formData.time_limit),
        run_test_cases: formData.run_test_cases,
        submit_test_cases: formData.submit_test_cases,
      });
      showToast?.("Common problem template registered successfully!", "success");
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      showToast?.(err.message || "Failed to save template.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Common Problem Templates & Test Suites</h1>
          <p className="page-subtitle">
            Configure standardized problem statements and evaluation test suites reusable across challenges.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormData({
              problem_id: "",
              problem_statement: "",
              time_limit: 2.0,
              run_test_cases: [{ input: "", expected_output: "" }],
              submit_test_cases: [{ input: "", expected_output: "" }],
            });
            setShowModal(true);
          }}
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
          Register Common Template
        </button>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          Loading registered templates...
        </div>
      ) : templates.length === 0 ? (
        <div
          className="glass-panel"
          style={{ padding: "3rem", textAlign: "center", color: "var(--text-dim)" }}
        >
          <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            No common problem templates configured yet.
          </div>
          <p style={{ fontSize: "0.85rem" }}>
            Register standardized templates to sync test-cases and boilerplates.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {templates.map((tpl, i) => (
            <div key={i} className="glass-panel" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                  Problem #{tpl.problem_id}
                </div>
                <span className="badge badge-info">
                  Time Limit: {tpl.time_limit || 2.0}s
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  marginBottom: "1rem",
                  maxHeight: "80px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {tpl.problem_statement || "No statement specified"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "0.85rem",
                  fontSize: "0.8rem",
                  color: "var(--text-dim)",
                }}
              >
                <span>
                  Sample Tests: {tpl.run_test_cases?.length || 0}
                </span>
                <span>•</span>
                <span>
                  Judge Tests: {tpl.submit_test_cases?.length || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateTemplate} className="modal-form">
              <div className="modal-header">
                <h2 className="modal-title">Register Common Problem Template</h2>
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

              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Problem ID</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="form-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. 1"
                      value={formData.problem_id}
                      onChange={(e) =>
                        setFormData({ ...formData, problem_id: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Execution Time Limit (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
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
                </div>

                <div className="form-group">
                  <label className="form-label">Problem Statement</label>
                  <textarea
                    required
                    rows={4}
                    className="form-textarea"
                    style={{ width: "100%" }}
                    placeholder="Enter full statement description..."
                    value={formData.problem_statement}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        problem_statement: e.target.value,
                      })
                    }
                  />
                </div>
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
                  disabled={saving || !formData.problem_id}
                  className="btn btn-primary"
                >
                  {saving ? "Registering..." : "Register Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
