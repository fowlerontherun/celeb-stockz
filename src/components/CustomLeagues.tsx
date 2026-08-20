import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Copy,
  Crown,
  Eye,
  LoaderCircle,
  LogOut,
  Plus,
  Shield,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type LeagueSummary = {
  id: string;
  name: string;
  description: string;
  role: string;
  memberCount: number;
  isOwner: boolean;
  joinedAt: string;
};

type LeaderboardEntry = {
  traderId: string;
  name: string;
  nickname: string | null;
  role: string;
  joinedAt: string;
  netWorth: number;
  profitLoss: number;
  isCurrentUser: boolean;
  rank: number;
};

type LeagueDetail = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  myRole: string;
  isOwner: boolean;
  leaderboard: LeaderboardEntry[];
};

export function CustomLeagues() {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagueDetail, setLeagueDetail] = useState<LeagueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);

  // Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [leagueDescription, setLeagueDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const loadLeagues = useCallback(async () => {
    try {
      const response = await fetch("/api/leagues", { credentials: "include" });
      const data = (await response.json()) as { leagues?: LeagueSummary[]; statusMessage?: string };

      if (!response.ok || !data.leagues) {
        throw new Error(data.statusMessage ?? "Could not load leagues.");
      }

      setLeagues(data.leagues);
      if (data.leagues.length > 0 && !selectedLeagueId) {
        setSelectedLeagueId(data.leagues[0].id);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load leagues.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedLeagueId]);

  const loadLeagueDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const response = await fetch(`/api/leagues/${id}`, { credentials: "include" });
      const data = (await response.json()) as { league?: LeagueDetail; statusMessage?: string };

      if (!response.ok || !data.league) {
        throw new Error(data.statusMessage ?? "Could not load league details.");
      }

      setLeagueDetail(data.league);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load league details.");
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeagues();
  }, [loadLeagues]);

  useEffect(() => {
    if (selectedLeagueId) {
      void loadLeagueDetail(selectedLeagueId);
    }
  }, [selectedLeagueId, loadLeagueDetail]);

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leagueName.trim().length < 3) {
      showError("League name must be at least 3 characters.");
      return;
    }

    setIsActionBusy(true);
    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: leagueName, description: leagueDescription }),
      });
      const data = (await response.json()) as { id?: string; statusMessage?: string };

      if (!response.ok || !data.id) {
        throw new Error(data.statusMessage ?? "Could not create league.");
      }

      showSuccess(`League "${leagueName}" created!`);
      setLeagueName("");
      setLeagueDescription("");
      setShowCreateModal(false);
      setSelectedLeagueId(data.id);
      await loadLeagues();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not create league.");
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      showError("Please enter an invite code.");
      return;
    }

    setIsActionBusy(true);
    try {
      const response = await fetch("/api/leagues/join", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = (await response.json()) as { leagueId?: string; statusMessage?: string };

      if (!response.ok || !data.leagueId) {
        throw new Error(data.statusMessage ?? "Could not join league.");
      }

      showSuccess("Joined league successfully!");
      setJoinCode("");
      setShowJoinModal(false);
      setSelectedLeagueId(data.leagueId);
      await loadLeagues();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not join league.");
    } finally {
      setIsActionBusy(false);
    }
  };

  const createInviteCode = async (leagueId: string) => {
    setIsActionBusy(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/invites`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { code?: string; statusMessage?: string };

      if (!response.ok || !data.code) {
        throw new Error(data.statusMessage ?? "Could not generate invite code.");
      }

      await navigator.clipboard.writeText(data.code);
      showSuccess(`Invite code ${data.code} copied! Share it with friends.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not generate invite.");
    } finally {
      setIsActionBusy(false);
    }
  };

  const handleLeaveOrDelete = async (leagueId: string, isOwner: boolean) => {
    const confirmMsg = isOwner
      ? "Are you sure you want to delete this league? All members will be removed."
      : "Are you sure you want to leave this league?";

    if (!window.confirm(confirmMsg)) return;

    setIsActionBusy(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Action failed.");
      }

      showSuccess(isOwner ? "League deleted." : "You have left the league.");
      setSelectedLeagueId(null);
      setLeagueDetail(null);
      await loadLeagues();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not process request.");
    } finally {
      setIsActionBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-64 place-items-center">
        <LoaderCircle className="animate-spin text-[#c99bff]" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Custom Competitions
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Player Leagues
          </h1>
          <p className="mt-2 text-sm text-[#b8a9c4]">
            Create private leagues with friends, track custom leaderboards, and battle for the season crown.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-[#e6d8ff] transition hover:bg-white/10"
          >
            <Shield size={14} /> Join with code
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#9361f5]"
          >
            <Plus size={15} /> Create league
          </button>
        </div>
      </div>

      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#211230] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-black text-white">Create Custom League</h2>
            <p className="mt-1 text-xs text-[#c4b4d0]">
              Start your own competition and invite traders with a shareable code.
            </p>

            <form onSubmit={handleCreateLeague} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                  League Name
                </label>
                <input
                  type="text"
                  required
                  value={leagueName}
                  maxLength={60}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="e.g. Wall Street of Pop"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#c99bff]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                  Description (Optional)
                </label>
                <textarea
                  value={leagueDescription}
                  maxLength={280}
                  onChange={(e) => setLeagueDescription(e.target.value)}
                  placeholder="What is this league about?"
                  className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm text-white outline-none focus:border-[#c99bff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-[#c4b4d0] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionBusy || leagueName.trim().length < 3}
                  className="rounded-xl bg-[#7c3aed] px-5 py-2.5 text-xs font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
                >
                  {isActionBusy ? "Creating…" : "Create League"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join League Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#211230] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-black text-white">Join League</h2>
            <p className="mt-1 text-xs text-[#c4b4d0]">
              Enter the 8-character invitation code provided by the league commissioner.
            </p>

            <form onSubmit={handleJoinLeague} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                  Invitation Code
                </label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 font-mono text-sm font-bold tracking-widest text-white outline-none focus:border-[#c99bff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-[#c4b4d0] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionBusy || !joinCode.trim()}
                  className="rounded-xl bg-[#7c3aed] px-5 py-2.5 text-xs font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
                >
                  {isActionBusy ? "Joining…" : "Join League"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {leagues.length === 0 ? (
        <div className="mt-8 rounded-[28px] border border-dashed border-white/15 bg-white/[.02] p-10 text-center">
          <Trophy size={36} className="mx-auto text-[#ffd17b] opacity-80" />
          <h2 className="font-display mt-4 text-2xl font-black">No leagues joined yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#b8a9c4]">
            Create your first trading league to compete with your circle, or join an existing league using an invite code.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-black text-white hover:bg-[#9361f5]"
            >
              Create your league
            </button>
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-[#e6d8ff] hover:bg-white/10"
            >
              Enter invite code
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          {/* Leagues List */}
          <div className="space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
              Your leagues ({leagues.length})
            </p>

            {leagues.map((league) => {
              const isSelected = league.id === selectedLeagueId;

              return (
                <div
                  key={league.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedLeagueId(league.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedLeagueId(league.id);
                  }}
                  className={`cursor-pointer rounded-[24px] border p-5 transition ${
                    isSelected
                      ? "border-[#c99bff] bg-[#291740] shadow-lg"
                      : "border-white/10 bg-[#1e112f] hover:border-white/20 hover:bg-[#231438]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-black text-white">{league.name}</h3>
                      {league.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#c4b4d0]">
                          {league.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
                        league.isOwner
                          ? "bg-[#ffd17b]/20 text-[#ffd17b]"
                          : "bg-[#7c3aed]/20 text-[#c99bff]"
                      }`}
                    >
                      {league.isOwner ? "Commissioner" : "Member"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-[#a99ab7]">
                    <span className="flex items-center gap-1 font-bold">
                      <Users size={14} className="text-[#c99bff]" />
                      {league.memberCount} {league.memberCount === 1 ? "trader" : "traders"}
                    </span>
                    <span className="text-[11px] font-semibold text-[#c99bff]">
                      View Standings →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* League Detail & Standings Leaderboard */}
          <div>
            {isDetailLoading ? (
              <div className="grid min-h-72 place-items-center rounded-[28px] border border-white/10 bg-[#1e112f]">
                <LoaderCircle className="animate-spin text-[#c99bff]" />
              </div>
            ) : leagueDetail ? (
              <section className="rounded-[28px] border border-white/10 bg-[#1e112f] p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#ffd17b]/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#ffd17b]">
                        {leagueDetail.isOwner ? "Commissioner" : "Member"}
                      </span>
                      <span className="text-xs text-[#a99ab7]">
                        {leagueDetail.leaderboard.length} traders
                      </span>
                    </div>
                    <h2 className="font-display mt-2 text-2xl font-black text-white sm:text-3xl">
                      {leagueDetail.name}
                    </h2>
                    {leagueDetail.description && (
                      <p className="mt-1 text-sm text-[#c4b4d0]">{leagueDetail.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void createInviteCode(leagueDetail.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd17b] px-3.5 py-2 text-xs font-black text-[#3d2a00] hover:bg-[#ffe29c] disabled:opacity-50"
                    >
                      <Copy size={13} />
                      Invite Code
                    </button>
                    <button
                      type="button"
                      disabled={isActionBusy}
                      onClick={() => void handleLeaveOrDelete(leagueDetail.id, leagueDetail.isOwner)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#ff7282]/30 px-3 py-2 text-xs font-bold text-[#ff9ca5] hover:bg-[#ff7282]/10 disabled:opacity-50"
                    >
                      {leagueDetail.isOwner ? <Trash2 size={13} /> : <LogOut size={13} />}
                      {leagueDetail.isOwner ? "Delete" : "Leave"}
                    </button>
                  </div>
                </div>

                {/* Standings List */}
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-[.14em] text-[#a99ab7]">
                    <span>Rank · Trader</span>
                    <span>Net Worth</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {leagueDetail.leaderboard.map((trader) => {
                      const isTop3 = trader.rank <= 3;
                      const rankColor =
                        trader.rank === 1
                          ? "#ffd17b"
                          : trader.rank === 2
                          ? "#bd9cff"
                          : trader.rank === 3
                          ? "#6ce0bd"
                          : "#a99ab7";

                      return (
                        <div
                          key={trader.traderId}
                          className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                            trader.isCurrentUser
                              ? "border-[#c99bff]/50 bg-[#7c3aed]/15"
                              : "border-white/5 bg-white/[.03]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-black"
                              style={{ backgroundColor: `${rankColor}20`, color: rankColor }}
                            >
                              {trader.rank === 1 ? (
                                <Crown size={18} fill="currentColor" />
                              ) : (
                                trader.rank
                              )}
                            </span>

                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#513266] font-display text-sm font-black text-white">
                              {trader.name[0]?.toUpperCase() ?? "T"}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-display text-sm font-black text-white">
                                  {trader.name}
                                </p>
                                {trader.nickname && (
                                  <span className="rounded bg-[#ffd17b]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ffd17b]">
                                    NICK
                                  </span>
                                )}
                                {trader.isCurrentUser && (
                                  <span className="rounded bg-[#7c3aed]/30 px-1.5 py-0.5 text-[9px] font-black text-[#d8c1ff]">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p
                                className={`text-[11px] font-bold ${
                                  trader.profitLoss >= 0 ? "text-[#62e7b6]" : "text-[#ff9ca5]"
                                }`}
                              >
                                {trader.profitLoss >= 0 ? "+" : ""}
                                {trader.profitLoss.toLocaleString(undefined, {
                                  maximumFractionDigits: 2,
                                })}{" "}
                                STKZ P&L
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="font-display text-base font-black text-white sm:text-lg">
                              {trader.netWorth.toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-[10px] font-bold text-[#a99ab7]">STKZ</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : (
              <div className="grid h-72 place-items-center rounded-[28px] border border-white/10 bg-[#1e112f] text-sm text-[#a99ab7]">
                Select a league from the list to view its standings
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}