import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContestForm } from "../app/(dashboard)/contests/_components/contest-form";
import type { ContestResponse } from "../types/contest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock actions
vi.mock("../app/(dashboard)/contests/_components/actions", () => ({
  createContestAction: vi.fn().mockResolvedValue({ success: true, contestId: 1 }),
  updateContestAction: vi.fn().mockResolvedValue({ success: true }),
  searchProblemsAction: vi.fn().mockResolvedValue([
    { id: 101, title: "Two Sum", difficulty: "easy" },
    { id: 102, title: "Median of Arrays", difficulty: "hard" },
  ]),
}));

const mockContest: ContestResponse = {
  id: 42,
  title: "Weekly Contest 42",
  description: "Test contest description",
  start_time: "2026-11-10T10:00:00Z",
  end_time: "2026-11-10T12:00:00Z",
  duration_seconds: 7200,
  status: "upcoming",
  penalty_minutes: 20,
  participant_count: 5,
  problem_count: 2,
  is_registered: false,
  created_by: null,
  created_at: "2026-11-09T00:00:00Z",
  server_time: "2026-11-09T12:00:00Z",
  problems: [
    { id: 1, problem_id: 101, title: "Problem One", difficulty: "easy", points: 100, position: 1 },
    { id: 2, problem_id: 102, title: "Problem Two", difficulty: "medium", points: 100, position: 2 },
  ],
};

describe("ContestForm Component", () => {
  it("renders contest form in creation mode with default values", () => {
    render(<ContestForm />);

    expect(screen.getByLabelText(/Contest Title/i)).toBeDefined();
    expect(screen.getByLabelText(/Wrong Attempt Penalty/i)).toBeDefined();
    expect((screen.getByLabelText(/Wrong Attempt Penalty/i) as HTMLInputElement).value).toBe("20");
    expect(screen.getByText(/Create Contest/i)).toBeDefined();
  });

  it("renders pre-filled fields in upcoming edit mode", () => {
    render(<ContestForm contest={mockContest} />);

    expect((screen.getByLabelText(/Contest Title/i) as HTMLInputElement).value).toBe("Weekly Contest 42");
    expect(screen.getByText("Problem One")).toBeDefined();
    expect(screen.getByText("Problem Two")).toBeDefined();
    expect(screen.getByText("P1")).toBeDefined();
    expect(screen.getByText("P2")).toBeDefined();
    expect(screen.getByText(/Save Changes/i)).toBeDefined();
  });

  it("reorders problems using Move Up and Move Down buttons", () => {
    render(<ContestForm contest={mockContest} />);

    // Problem One is P1, Problem Two is P2
    const moveDownButtons = screen.getAllByTitle("Move Down");
    expect(moveDownButtons.length).toBe(2);

    // Click move down on first problem (P1)
    fireEvent.click(moveDownButtons[0]);

    // Now Problem Two should be first
    const problemLabels = screen.getAllByText(/Problem (One|Two)/);
    expect(problemLabels[0].textContent).toBe("Problem Two");
    expect(problemLabels[1].textContent).toBe("Problem One");
  });

  it("removes a problem when remove button is clicked", () => {
    render(<ContestForm contest={mockContest} />);

    const removeButtons = screen.getAllByTitle("Remove Problem");
    expect(removeButtons.length).toBe(2);

    // Remove first problem
    fireEvent.click(removeButtons[0]);

    // Only Problem Two remains
    expect(screen.queryByText("Problem One")).toBeNull();
    expect(screen.getByText("Problem Two")).toBeDefined();
    expect(screen.getByText("P1")).toBeDefined();
  });

  it("locks timing and problems when contest is live (Rule 7)", () => {
    const liveContest: ContestResponse = {
      ...mockContest,
      status: "live",
    };

    render(<ContestForm contest={liveContest} />);

    // Shows Live banner
    expect(screen.getByText(/Contest is currently Live/i)).toBeDefined();

    // Title is editable
    const titleInput = screen.getByLabelText(/Contest Title/i) as HTMLInputElement;
    expect(titleInput.disabled).toBe(false);

    // Schedule inputs and penalty are disabled
    const startInput = screen.getByLabelText(/Start Time/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/End Time/i) as HTMLInputElement;
    const penaltyInput = screen.getByLabelText(/Wrong Attempt Penalty/i) as HTMLInputElement;

    expect(startInput.disabled).toBe(true);
    expect(endInput.disabled).toBe(true);
    expect(penaltyInput.disabled).toBe(true);

    // Search and reorder buttons are not rendered
    expect(screen.queryByTitle("Move Down")).toBeNull();
    expect(screen.queryByTitle("Remove Problem")).toBeNull();
    expect(screen.queryByText(/Search & Add Problem/i)).toBeNull();
  });

  it("displays locked state when contest has ended", () => {
    const endedContest: ContestResponse = {
      ...mockContest,
      status: "ended",
    };

    render(<ContestForm contest={endedContest} />);

    expect(screen.getAllByText(/Contest has Ended/i).length).toBeGreaterThan(0);
    // Save button should not exist
    expect(screen.queryByText(/Save Changes/i)).toBeNull();
  });

  it("validates that end_time must be after start_time", () => {
    render(<ContestForm />);

    const titleInput = screen.getByLabelText(/Contest Title/i);
    const startInput = screen.getByLabelText(/Start Time/i);
    const endInput = screen.getByLabelText(/End Time/i);

    fireEvent.change(titleInput, { target: { value: "Invalid Dates Contest" } });
    fireEvent.change(startInput, { target: { value: "2026-11-10T12:00" } });
    fireEvent.change(endInput, { target: { value: "2026-11-10T10:00" } });

    const submitBtn = screen.getByText(/Create Contest/i);
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Contest end time must be strictly after start time/i)).toBeDefined();
  });
});
