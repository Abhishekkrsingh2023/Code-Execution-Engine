import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyLeaderboardRank } from "@/lib/api/leaderboard";
import { getMySubmissions } from "@/lib/api/submissions";
import { ProfileEditForm } from "./_components/profile-edit-form";
import { SubmissionsHistory } from "./_components/submissions-history";
import { Footer } from "@/components/shared/footer";
import { Trophy, CheckCircle, Award, CheckCircle2, Shield, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Profile & Account Settings — Code0",
  description: "View and manage your Code0 platform profile, credentials, and performance statistics.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/profile");
  }

  const rankData = await getMyLeaderboardRank();
  const submissionsData = await getMySubmissions({ limit: 50 }).catch(() => ({
    total: 0,
    skip: 0,
    limit: 50,
    submissions: [],
  }));

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <div className="flex-1 flex flex-col justify-between overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
      {/* Profile Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              {user.name || user.username}
            </h1>
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              @{user.username}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1 capitalize px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--card)] font-medium">
              <Shield className="w-3 h-3 text-[var(--brand)]" />
              <span>{user.role}</span>
            </span>

            {user.is_email_verified && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {memberSince}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Platform Statistics */}
      <div>
        <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--muted-foreground)] mb-3">
          Platform Performance Statistics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
              <span className="text-xs font-medium">Global Rank</span>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--foreground)]">
              {rankData?.rank ? `#${rankData.rank}` : "Unranked"}
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Based on score & solved count</span>
          </div>

          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
              <span className="text-xs font-medium">Total Score</span>
              <Award className="w-4 h-4 text-[var(--brand)]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--foreground)]">
              {rankData?.total_score ?? user.total_score ?? 0}
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Points accumulated</span>
          </div>

          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
              <span className="text-xs font-medium">Problems Solved</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--foreground)]">
              {rankData?.problems_solved ?? user.problems_solved ?? 0}
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Unique challenges passed</span>
          </div>

          <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
              <span className="text-xs font-medium">Total Submissions</span>
              <Award className="w-4 h-4 text-[var(--muted-foreground)]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--foreground)]">
              {rankData?.submissions_count ?? submissionsData.total ?? 0}
            </div>
            <span className="text-[10px] text-[var(--muted-foreground)] mt-1">Official evaluations attempted</span>
          </div>
        </div>
      </div>

      {/* Submission History Section */}
      <SubmissionsHistory
        initialSubmissions={submissionsData.submissions}
        total={submissionsData.total}
      />

      {/* Edit Profile Section */}
      <ProfileEditForm user={user} />
      </div>

      <Footer />
    </div>
  );
}

