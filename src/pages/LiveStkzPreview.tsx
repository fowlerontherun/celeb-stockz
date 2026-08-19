import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CircleAlert,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  PoundSterling,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { LiveStkzDevelopment } from "@/components/LiveStkzDevelopment";

type AccessState = "loading" | "allowed" | "denied";

export default function LiveStkzPreview() {
  const [access, setAccess] = useState<AccessState>("loading");

  useEffect(() => {
    void fetch("/api/internal/market-operations", {
      credentials: "include",
    })
      .then((response) => setAccess(response.ok ? "allowed" : "denied"))
      .catch(() => setAccess("denied"));
  }, []);

  if (access === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] px-5 text-[#fff8f2]">
        <section className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#211230] p-7 text-center">
          <LockKeyhole className="mx-auto text-[#ff9ca5]" size={28} />
          <h1 className="font-display mt-4 text-2xl font-black">
            Admin access required
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
            The Live STKZ preview is only available to approved administrators.
          </p>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#7c3aed] px-4 py-3 text-sm font-black text-white">
            Back to markets
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <Link to="/operations" className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] transition hover:text-white">
          <ArrowLeft size={16} />
          Back to market control center
        </Link>

        <header className="mt-8 rounded-[30px] border border-[#ffd17b]/30 bg-[#291a35] p-6 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
                <LockKeyhole size={15} />
                Admin development preview
              </p>
              <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">
                Live STKZ is <span className="text-[#ff7282]">coming soon.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#dccce1] sm:text-base">
                This is the planned paid experience only. No real-money purchases, cash balances, withdrawals, or live trading are active in the app.
              </p>
            </div>
            <span className="rounded-xl border border-[#ffd17b]/30 bg-[#ffd17b]/10 px-3 py-2 text-xs font-black text-[#ffe2a3]">
              DEVELOPMENT ONLY
            </span>
          </div>
        </header>

        <section className="mt-7 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-[28px] border border-white/10 bg-[#211230] p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7c3aed] text-white">
                <WalletCards size={23} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#c99bff]">Planned starter bundle</p>
                <h2 className="font-display mt-1 text-2xl font-black">1,000 Live STKZ</h2>
              </div>
            </div>
            <div className="mt-7 rounded-2xl bg-[#160c25] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-sm font-bold text-[#d8c8e1]">Bundle price</span>
                <span className="flex items-center gap-1 font-display text-2xl font-black"><PoundSterling size={19} />10.00</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/10 py-4">
                <span className="text-sm font-bold text-[#d8c8e1]">Platform fee · 2%</span>
                <span className="font-display text-xl font-black text-[#ffd17b]">£0.20</span>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm font-black">Customer total</span>
                <span className="font-display text-3xl font-black text-[#62e7b6]">£10.20</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#b9a9c5]">
              The proposed model credits 1,000 Live STKZ for £10 and displays the 2% platform fee separately. The same fee model is planned for each completed Live STKZ trade.
            </p>
          </article>

          <article className="rounded-[28px] border border-[#ff7282]/30 bg-[#2e1830] p-6 sm:p-7">
            <div className="flex items-center gap-3 text-[#ffb2bc]">
              <CircleAlert size={22} />
              <p className="text-xs font-extrabold uppercase tracking-[.16em]">Launch gate</p>
            </div>
            <h2 className="font-display mt-3 text-2xl font-black">Not ready for customers</h2>
            <p className="mt-3 text-sm leading-6 text-[#dfc9d7]">
              Do not accept money or advertise this feature until payment, legal, identity, tax, safety, and customer-support controls are approved for every launch location.
            </p>
            <div className="mt-6 rounded-2xl border border-[#ff7282]/20 bg-black/10 p-4">
              <div className="flex items-center gap-2 text-[#ffb2bc]">
                <CreditCard size={16} />
                <p className="text-sm font-black">Payments remain disabled</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#d5baca]">
                No provider keys or checkout actions are connected in this preview.
              </p>
            </div>
          </article>
        </section>

        <LiveStkzDevelopment />

        <section className="mt-7 rounded-[28px] border border-[#c99bff]/25 bg-[#211230] p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <ReceiptText className="text-[#c99bff]" size={21} />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#c99bff]">Planned transaction policy</p>
              <h2 className="font-display mt-1 text-2xl font-black">Fee visibility by design</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#cdbdd6]">
            Every future checkout and trade confirmation should show the bundle or trade amount, the 2% platform fee, the total charged, and the resulting Live STKZ balance before a customer confirms. The fee must never be hidden inside a quoted market price.
          </p>
        </section>
      </div>
    </main>
  );
}