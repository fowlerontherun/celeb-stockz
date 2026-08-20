import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, RotateCcw, Save, Sparkles, UserRound } from "lucide-react";
import { authClient, useAuthSession } from "@/lib/auth-client";
import { showError, showSuccess } from "@/utils/toast";

type ProfileData = {
  display_name: string;
  nickname: string;
  address: string;
  phone_number: string;
};

export default function Profile() {
  const { data: session } = useAuthSession();
  const [profile, setProfile] = useState<ProfileData>({
    display_name: "",
    nickname: "",
    address: "",
    phone_number: "",
  });
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setEmail(session?.user.email ?? "");
    void fetch("/api/profile", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your profile.");
        return response.json() as Promise<ProfileData>;
      })
      .then((data) =>
        setProfile((current) => ({
          ...data,
          display_name: data.display_name || session?.user.name || current.display_name,
          nickname: data.nickname || current.nickname || "",
        })),
      )
      .catch((error: Error) => showError(error.message));
  }, [session?.user.email, session?.user.name]);

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: profile.display_name,
          nickname: profile.nickname,
          address: profile.address,
          phoneNumber: profile.phone_number,
        }),
      });
      const data = (await response.json()) as { statusMessage?: string };
      if (!response.ok) throw new Error(data.statusMessage ?? "Could not save your profile.");
      showSuccess("Profile details and trading nickname saved.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmail = async () => {
    if (!email || email === session?.user.email) {
      showError("Enter a different email address.");
      return;
    }

    try {
      const client = authClient as unknown as {
        changeEmail: (input: { newEmail: string; callbackURL: string }) => Promise<{ error?: { message?: string } }>;
      };
      const result = await client.changeEmail({
        newEmail: email,
        callbackURL: `${window.location.origin}/profile`,
      });
      if (result.error) throw new Error(result.error.message ?? "Could not update your email.");
      showSuccess("Check your new inbox to confirm the email change.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not update your email.");
    }
  };

  const resetAccount = async () => {
    if (!window.confirm("Reset your test account? This permanently clears all holdings and trade history.")) return;

    setIsResetting(true);
    try {
      const response = await fetch("/api/account-reset", {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { balanceStkz?: number; statusMessage?: string };
      if (!response.ok) throw new Error(data.statusMessage ?? "Could not reset your test account.");
      window.dispatchEvent(new Event("wallet:updated"));
      showSuccess(`Practice account reset to ${data.balanceStkz?.toLocaleString()} STKZ.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not reset your test account.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-bold text-[#c99bff] hover:text-white">← Back to markets</Link>
        <div className="mt-8 flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#7c3aed]"><UserRound size={26} /></div>
          <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">Account settings</p><h1 className="font-display text-3xl font-black">Your profile & identity</h1></div>
        </div>

        <section className="mt-8 rounded-[28px] border border-[#ffd17b]/30 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#ffd17b]">
            <Sparkles size={18} />
            <h2 className="font-display text-xl font-black">Trading Nickname & Handle</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#c4b4d0]">
            Your nickname is displayed on public leaderboards, rankings, clubs, and custom league standings.
          </p>

          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-[.12em] text-[#ffd17b]">
              Player Nickname
              <input
                type="text"
                maxLength={30}
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                placeholder="e.g. WallStreetWolf, StarTrader99"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 font-display text-base font-black text-white outline-none focus:border-[#ffd17b]"
              />
            </label>
            <p className="mt-1.5 text-[11px] text-[#a99ab7]">
              Preview on leaderboard: <strong className="text-white">{profile.nickname || profile.display_name || "Trader"}</strong>
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <h2 className="font-display text-xl font-black">Personal details</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Full Name<input value={profile.display_name} onChange={(event) => setProfile({ ...profile, display_name: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 outline-none focus:border-[#a97cff]" /></label>
            <label className="text-sm font-bold">Phone number<input value={profile.phone_number} onChange={(event) => setProfile({ ...profile, phone_number: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 outline-none focus:border-[#a97cff]" /></label>
          </div>
          <label className="mt-4 block text-sm font-bold">Address<textarea value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 outline-none focus:border-[#a97cff]" /></label>
          <button onClick={() => void saveProfile()} disabled={isSaving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-black text-white hover:bg-[#9361f5] disabled:opacity-50"><Save size={16} />{isSaving ? "Saving…" : "Save details & nickname"}</button>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <h2 className="font-display text-xl font-black">Sign-in details</h2>
          <label className="mt-5 block text-sm font-bold">Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 outline-none focus:border-[#a97cff]" /></label>
          <button onClick={() => void updateEmail()} className="mt-4 rounded-xl border border-[#c99bff]/40 px-5 py-3 text-sm font-black text-[#e6d8ff]">Update email</button>
          <Link to="/auth/forgot-password" className="mt-4 flex w-fit items-center gap-2 text-sm font-bold text-[#c99bff] hover:text-white"><KeyRound size={16} />Change password securely</Link>
        </section>

        <section className="mt-5 rounded-[28px] border border-[#ffd17b]/30 bg-[#2e1832] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">Live account</p>
          <h2 className="font-display mt-2 text-xl font-black">Start fresh</h2>
          <p className="mt-2 text-sm leading-6 text-[#d8c9d8]">Empty your portfolio and trade history, then restore your 10,000 STKZ test balance.</p>
          <button onClick={() => void resetAccount()} disabled={isResetting} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff7282] px-5 py-3 text-sm font-black text-[#401b2d] disabled:opacity-50"><RotateCcw size={16} />{isResetting ? "Resetting…" : "Reset test account"}</button>
        </section>
      </div>
    </main>
  );
}