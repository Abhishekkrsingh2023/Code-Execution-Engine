"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, Code, FileText, CheckCircle2 } from "lucide-react";
import { createProblemAction, updateProblemAction } from "./actions";
import type {
  ProblemDifficulty,
  ProblemStatus,
  FullProblemResponse,
  TestCaseItem,
  ProblemTemplateItem,
} from "@/types/problem";

interface ProblemFormProps {
  initialData?: FullProblemResponse | null;
  initialRunTestCases?: TestCaseItem[];
  initialSubmitTestCases?: TestCaseItem[];
  isEdit?: boolean;
}

export function ProblemForm({
  initialData,
  initialRunTestCases,
  initialSubmitTestCases,
  isEdit = false,
}: ProblemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Core problem fields
  const [title, setTitle] = useState(initialData?.problem?.title || "");
  const [description, setDescription] = useState(initialData?.problem?.description || "");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>(
    initialData?.problem?.difficulty || "easy"
  );
  const [category, setCategory] = useState(initialData?.problem?.category || "Algorithms");
  const [topic, setTopic] = useState(initialData?.problem?.topic || "array");
  const [timeLimit, setTimeLimit] = useState(initialData?.problem?.time_limit || 2.0);
  const [memoryLimit, setMemoryLimit] = useState(initialData?.problem?.memory_limit || 256);
  const [status, setStatus] = useState<ProblemStatus>(
    initialData?.problem?.status || "published"
  );

  // Test cases: Run (Sample)
  const [runTestCases, setRunTestCases] = useState<TestCaseItem[]>(
    initialRunTestCases && initialRunTestCases.length > 0
      ? initialRunTestCases
      : initialData?.run_test_cases && initialData.run_test_cases.length > 0
      ? initialData.run_test_cases
      : [{ input: "2 7 11 15\n9", expected_output: "0 1", is_sample: true }]
  );

  // Test cases: Submit (Hidden)
  const [submitTestCases, setSubmitTestCases] = useState<TestCaseItem[]>(
    initialSubmitTestCases && initialSubmitTestCases.length > 0
      ? initialSubmitTestCases
      : [
          { input: "3 2 4\n6", expected_output: "1 2", is_sample: false },
          { input: "3 3\n6", expected_output: "0 1", is_sample: false },
        ]
  );

  // Language Templates
  const [templates, setTemplates] = useState<ProblemTemplateItem[]>(
    initialData?.templates && initialData.templates.length > 0
      ? initialData.templates.map((t) => ({
          language: t.language,
          boilerplate_code: t.boilerplate_code,
        }))
      : [
          {
            language: "python",
            boilerplate_code: "def solution(nums, target):\n    # Write code here\n    pass\n",
          },
          {
            language: "cpp",
            boilerplate_code: "#include <vector>\nusing namespace std;\n\nvector<int> solution(vector<int>& nums, int target) {\n    // Write code here\n}\n",
          },
        ]
  );

  const addRunTestCase = () => {
    setRunTestCases([...runTestCases, { input: "", expected_output: "", is_sample: true }]);
  };

  const removeRunTestCase = (index: number) => {
    setRunTestCases(runTestCases.filter((_, i) => i !== index));
  };

  const updateRunTestCase = (index: number, field: "input" | "expected_output", val: string) => {
    const updated = [...runTestCases];
    updated[index] = { ...updated[index], [field]: val };
    setRunTestCases(updated);
  };

  const addSubmitTestCase = () => {
    setSubmitTestCases([
      ...submitTestCases,
      { input: "", expected_output: "", is_sample: false },
    ]);
  };

  const removeSubmitTestCase = (index: number) => {
    setSubmitTestCases(submitTestCases.filter((_, i) => i !== index));
  };

  const updateSubmitTestCase = (index: number, field: "input" | "expected_output", val: string) => {
    const updated = [...submitTestCases];
    updated[index] = { ...updated[index], [field]: val };
    setSubmitTestCases(updated);
  };

  const addTemplate = () => {
    setTemplates([...templates, { language: "java", boilerplate_code: "" }]);
  };

  const removeTemplate = (index: number) => {
    setTemplates(templates.filter((_, i) => i !== index));
  };

  const updateTemplate = (index: number, field: "language" | "boilerplate_code", val: string) => {
    const updated = [...templates];
    updated[index] = { ...updated[index], [field]: val };
    setTemplates(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }

    if (!description.trim() || description.length < 5) {
      setError("Description statement must be at least 5 characters.");
      return;
    }

    startTransition(async () => {
      if (isEdit && initialData?.problem?.id) {
        const res = await updateProblemAction(
          initialData.problem.id,
          {
            title: title.trim(),
            description: description.trim(),
            difficulty,
            category: category.trim(),
            topic: topic.trim(),
            time_limit: Number(timeLimit),
            memory_limit: Number(memoryLimit),
            status,
          },
          {
            run_test_cases: runTestCases.filter(
              (tc) => tc.input.trim() || tc.expected_output.trim()
            ),
            submit_test_cases: submitTestCases.filter(
              (tc) => tc.input.trim() || tc.expected_output.trim()
            ),
          }
        );

        if (res.success) {
          router.push(`/problems/${initialData.problem.id}`);
          router.refresh();
        } else {
          setError(res.error || "Update failed");
        }
      } else {
        const res = await createProblemAction({
          title: title.trim(),
          description: description.trim(),
          difficulty,
          category: category.trim(),
          topic: topic.trim(),
          time_limit: Number(timeLimit),
          memory_limit: Number(memoryLimit),
          status,
          run_test_cases: runTestCases.filter(
            (tc) => tc.input.trim() || tc.expected_output.trim()
          ),
          submit_test_cases: submitTestCases.filter(
            (tc) => tc.input.trim() || tc.expected_output.trim()
          ),
          templates: templates.filter((tpl) => tpl.language.trim()),
        });

        if (res.success && res.problemId) {
          router.push(`/problems/${res.problemId}`);
        } else {
          setError(res.error || "Failed to create problem");
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Basic Metadata */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Problem Details
        </h2>

        <div>
          <Label htmlFor="title" required>
            Problem Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. Two Sum"
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="description" required>
            Problem Statement (Markdown supported)
          </Label>
          <Textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Describe the problem, input format, output format, and constraints..."
            disabled={isPending}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="difficulty" required>
              Difficulty
            </Label>
            <Select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as ProblemDifficulty)}
              disabled={isPending}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="category" required>
              Category
            </Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              placeholder="e.g. Algorithms"
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="topic" required>
              Topic Tag
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              placeholder="e.g. array, graph"
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="status" required>
              Publication Status
            </Label>
            <Select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProblemStatus)}
              disabled={isPending}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="unpublished">Unpublished</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <Label htmlFor="time_limit" required>
              Execution Time Limit (seconds)
            </Label>
            <Input
              id="time_limit"
              type="number"
              step="0.1"
              min="0.1"
              max="30.0"
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseFloat(e.target.value))}
              required
              disabled={isPending}
            />
          </div>

          <div>
            <Label htmlFor="memory_limit" required>
              Memory Limit (MB)
            </Label>
            <Input
              id="memory_limit"
              type="number"
              min="16"
              max="2048"
              value={memoryLimit}
              onChange={(e) => setMemoryLimit(parseInt(e.target.value, 10))}
              required
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {/* Sample / Run Test Cases — ALWAYS VISIBLE & EDITABLE */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Sample / Run Test Cases ({runTestCases.length})
            </h2>
            <p className="text-[11px] text-zinc-500">
              Visible to users during problem solving for &quot;Run Code&quot;.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRunTestCase}
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Case
          </Button>
        </div>

        <div className="space-y-3">
          {runTestCases.map((tc, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>Sample Case #{idx + 1}</span>
                {runTestCases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRunTestCase(idx)}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Standard Input</Label>
                  <Textarea
                    rows={2}
                    value={tc.input}
                    onChange={(e) => updateRunTestCase(idx, "input", e.target.value)}
                    placeholder="Input data"
                    className="font-mono text-xs"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <Label>Expected Output</Label>
                  <Textarea
                    rows={2}
                    value={tc.expected_output}
                    onChange={(e) => updateRunTestCase(idx, "expected_output", e.target.value)}
                    placeholder="Expected output"
                    className="font-mono text-xs"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hidden / Submit Test Cases — ALWAYS VISIBLE & EDITABLE */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Hidden / Submit Test Cases ({submitTestCases.length})
            </h2>
            <p className="text-[11px] text-zinc-500">
              Evaluated on official submission to verify user solution correctness.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSubmitTestCase}
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Submit Case
          </Button>
        </div>

        <div className="space-y-3">
          {submitTestCases.map((tc, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>Hidden Case #{idx + 1}</span>
                {submitTestCases.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubmitTestCase(idx)}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Standard Input</Label>
                  <Textarea
                    rows={2}
                    value={tc.input}
                    onChange={(e) => updateSubmitTestCase(idx, "input", e.target.value)}
                    placeholder="Input data"
                    className="font-mono text-xs"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <Label>Expected Output</Label>
                  <Textarea
                    rows={2}
                    value={tc.expected_output}
                    onChange={(e) => updateSubmitTestCase(idx, "expected_output", e.target.value)}
                    placeholder="Expected output"
                    className="font-mono text-xs"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Language Starter Templates */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Code className="h-4 w-4" />
              Language Starter Templates ({templates.length})
            </h2>
            <p className="text-[11px] text-zinc-500">
              Initial code pre-filled in editor for each programming language.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTemplate}
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Language
          </Button>
        </div>

        <div className="space-y-3">
          {templates.map((tpl, idx) => (
            <div
              key={idx}
              className="rounded border border-zinc-800 bg-zinc-950/60 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="w-40">
                  <Label>Language</Label>
                  <Select
                    value={tpl.language}
                    onChange={(e) => updateTemplate(idx, "language", e.target.value)}
                    disabled={isPending}
                  >
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="java">Java</option>
                  </Select>
                </div>
                {templates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTemplate(idx)}
                    className="text-red-400 hover:text-red-300 self-end mb-2 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div>
                <Label>Boilerplate Code</Label>
                <Textarea
                  rows={4}
                  value={tpl.boilerplate_code || ""}
                  onChange={(e) => updateTemplate(idx, "boilerplate_code", e.target.value)}
                  placeholder="// Starter template..."
                  className="font-mono text-xs"
                  disabled={isPending}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={isPending} disabled={isPending}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {isEdit ? "Save Problem Changes" : "Create & Publish Problem"}
        </Button>
      </div>
    </form>
  );
}
