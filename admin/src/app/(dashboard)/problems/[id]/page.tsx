import { notFound } from "next/navigation";
import {
  getFullProblem,
  getProblemTestCases,
  getCommonTemplate,
} from "@/lib/api/problems";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProblemForm } from "../_components/problem-form";
import { ProblemDeleteButton } from "../_components/problem-delete-button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type {
  FullProblemResponse,
  TestCaseItem,
  TestCaseResponse,
  CommonProblemTemplateResponse,
} from "@/types/problem";

interface ProblemDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProblemDetailPage({ params }: ProblemDetailPageProps) {
  const { id } = await params;
  const problemId = parseInt(id, 10);

  if (isNaN(problemId)) {
    notFound();
  }

  let fullProblem: FullProblemResponse | null = null;
  try {
    fullProblem = await getFullProblem(problemId);
  } catch {
    notFound();
  }

  if (!fullProblem || !fullProblem.problem) {
    notFound();
  }

  // Fetch test cases from both DB table and CommonProblemTemplate
  const [dbTestCasesResult, commonTemplateResult] = await Promise.allSettled([
    getProblemTestCases(problemId),
    getCommonTemplate(problemId),
  ]);

  const dbTestCases: TestCaseResponse[] =
    dbTestCasesResult.status === "fulfilled" ? dbTestCasesResult.value : [];
  const commonTemplate: CommonProblemTemplateResponse | null =
    commonTemplateResult.status === "fulfilled" ? commonTemplateResult.value : null;

  // Determine initial run (sample) test cases
  let initialRunTestCases: TestCaseItem[] = [];
  if (commonTemplate?.run_test_cases && commonTemplate.run_test_cases.length > 0) {
    initialRunTestCases = commonTemplate.run_test_cases.map((tc) => ({
      input: tc.input || "",
      expected_output: tc.expected_output || "",
      is_sample: true,
      weight: tc.weight,
    }));
  } else if (dbTestCases.length > 0) {
    const samples = dbTestCases.filter((tc) => tc.is_sample);
    if (samples.length > 0) {
      initialRunTestCases = samples.map((tc) => ({
        input: tc.input || "",
        expected_output: tc.expected_output || "",
        is_sample: true,
        weight: tc.weight,
      }));
    }
  }

  // Fallback to fullProblem.run_test_cases if still empty
  if (
    initialRunTestCases.length === 0 &&
    fullProblem.run_test_cases &&
    fullProblem.run_test_cases.length > 0
  ) {
    initialRunTestCases = fullProblem.run_test_cases.map((tc) => ({
      input: tc.input || "",
      expected_output: tc.expected_output || "",
      is_sample: true,
      weight: tc.weight,
    }));
  }

  // Determine initial submit (hidden) test cases
  let initialSubmitTestCases: TestCaseItem[] = [];
  if (commonTemplate?.submit_test_cases && commonTemplate.submit_test_cases.length > 0) {
    initialSubmitTestCases = commonTemplate.submit_test_cases.map((tc) => ({
      input: tc.input || "",
      expected_output: tc.expected_output || "",
      is_sample: false,
      weight: tc.weight,
    }));
  } else if (dbTestCases.length > 0) {
    const hidden = dbTestCases.filter((tc) => !tc.is_sample);
    if (hidden.length > 0) {
      initialSubmitTestCases = hidden.map((tc) => ({
        input: tc.input || "",
        expected_output: tc.expected_output || "",
        is_sample: false,
        weight: tc.weight,
      }));
    }
  }

  const { problem, templates, test_cases_count } = fullProblem;
  const totalTestCasesCount =
    initialRunTestCases.length + initialSubmitTestCases.length > 0
      ? initialRunTestCases.length + initialSubmitTestCases.length
      : dbTestCases.length > 0
      ? dbTestCases.length
      : test_cases_count;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title={`#${problem.id} — ${problem.title}`}
        description={`Authoring and configuration view for problem #${problem.id}.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Problems", href: "/problems" },
          { label: `#${problem.id}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge type="difficulty" value={problem.difficulty} />
            <StatusBadge type="problem_status" value={problem.status} />
            <div className="h-4 w-px bg-zinc-800 mx-1" />
            <ProblemDeleteButton
              problemId={problem.id}
              problemTitle={problem.title}
              redirectAfterDelete
            />
          </div>
        }
      />

      {/* Metadata Overview Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Total Test Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-200">
              {totalTestCasesCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Sample Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-200">
              {initialRunTestCases.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Hidden Cases
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold font-mono text-zinc-200">
              {initialSubmitTestCases.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
              Last Updated
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xs font-mono text-zinc-300 mt-1">
              {formatDate(problem.updated_at || problem.created_at)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form with Sample & Hidden Test Cases */}
      <ProblemForm
        initialData={fullProblem}
        initialRunTestCases={initialRunTestCases}
        initialSubmitTestCases={initialSubmitTestCases}
        isEdit={true}
      />

      {/* Existing Templates Inspection */}
      {templates.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Configured Starter Boilerplates ({templates.length})
          </h2>
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.language}
                className="rounded border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="text-xs font-mono font-semibold text-zinc-300 uppercase mb-1">
                  {tpl.language}
                </div>
                <pre className="text-[11px] font-mono text-zinc-400 bg-zinc-900/50 p-2 rounded overflow-x-auto">
                  {tpl.boilerplate_code || "// No custom starter boilerplate defined"}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
