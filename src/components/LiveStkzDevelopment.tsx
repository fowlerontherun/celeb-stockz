import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  ReceiptPoundSterling,
  ShieldCheck,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type LaunchCheck = {
  key: string;
  label: string;
  complete: boolean;
  completedAt: string | null;
};

type LedgerEntry = {
  type: string;
  grossAmountGbp: number;
  feeAmountGbp: number;
  netAmountGbp: number;
  status: string;
  reference: string | null;
  createdAt: string;
};

type DevelopmentData = {
  checks: LaunchCheck[];
  ledger: {
    settledEntries: number;
    totalFeesGbp: number;
    entries: LedgerEntry[];
  };
};

export function LiveStkzDevelopment() {
  const [data, setData] = useState<DevelopmentData | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/internal/live-stkz", {
        credentials: "include",
      });
      const payload = (await response.json()) as DevelopmentData & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(payload.statusMessage ?? "Could not load launch progress.");
      }

      setData(payload);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not load launch progress.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateCheck = async (check: LaunchCheck) => {
    setUpdatingKey(check.key);

    try {
      const response = await fetch(`/api/internal/live-stkz/checks/${check.key}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ complete: !check.complete }),
      });
      const result = (await response.json()) as {
        complete?: boolean;
        statusMessage?: string;
      };

      if (!response.ok || typeof result.complete !== "boolean") {
        throw new Error(result.statusMessage ?? "Could not update this launch check.");
      }

      setData((current) =>
        current
          ? {
              ...current,
              checks: current.checks.map((item) =>
                item.key === check.key
                  ? {
                      ...item,
                      complete: result.complete!,
                      completedAt: result.complete ? new Date().toISOString() : null,
                    }
                  : item,
              ),
            }
          : current,
      );
      showSuccess(result.complete ? "Launch check marked complete." : "Launch check reopened.");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update this launch check.",
      );
    } finally {
      setUpdatingKey(null);
    }
  };

  if (!data) {
    return (
      <section className="mt-7 grid min-h-40 place-items-center rounded-[28px] border border-white/10 bg-[#211230]">
        <LoaderCircle className="animate-spin text-[#c99bff]" />
      </section>
    );
  }

  const completedCount = data.checks.filter((check) => check.complete).length;

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <article className="rounded-[28px] border border-[#c99bff]/25 bg-[#211230] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">
              <ShieldCheck size={16} /> Admin launch tracker
            </p>
            <h2 className="font-display mt-2 text-2xl font-black">
              {completedCount} of {data.checks.length} gates complete
            </h2>
          </div>
          <span className="rounded-xl bg-[#7c3aed]/20 px-3 py-2 text-xs font-black text-[#d8c1ff]">
            Payments off
          </span>
        </div>

        <div className="mt-5 space-y-2">
          {data.checks.map((check) => (
            <button
              key={check.key}
              type="button"
              disabled={updatingKey === check.key}
              onClick={() => void updateCheck(check)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                check.complete
                  ? "border-[#62e7b6]/30 bg-[#183b33]"
                  : "border-white/10 bg-white/[.04] hover:bg-white/[.07]"
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  check.complete
                    ? "bg-[#62e7b6] text-[#112b24]"
                    : "border border-white/20 text-[#9f90ac]"
                }`}
              >
                {updatingKey === check.key ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : check.complete ? (
                  <CheckCircle2 size={16} />
                ) : null}
              </span>
              <span className="text-sm font-bold">{check.label}</span>
            </button>
          ))}
        </div>
      </article>

      <article className="rounded-[28px] border border-[#ffd17b]/25 bg-[#2a1b32] p-5 sm:p-7">
        <div className="flex items-center gap-2 text-[#ffd17b]">
          <ReceiptPoundSterling size={20} />
          <p className="text-xs font-extrabold uppercase tracking-[.16em]">
            Live fee ledger
          </p>
        </div>
        <h2 className="font-display mt-2 text-2xl font-black">
          £{data.ledger.totalFeesGbp.toFixed(2)} tracked
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#d9c9d9]">
          The ledger is ready for auditable live-trade fee records after launch approval. No payments or entries have been created.
        </p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-xs font-bold text-[#cdbccc]">Settled transactions</p>
          <p className="font-display mt-1 text-3xl font-black">
            {data.ledger.settledEntries}
          </p>
        </div>
        {data.ledger.entries.length > 0 && (
          <div className="mt-4 space-y-2">
            {data.ledger.entries.map((entry) => (
              <div key={`${entry.reference}-${entry.createdAt}`} className="rounded-xl bg-white/[.05] p-3 text-xs">
                <p className="font-black capitalize">{entry.type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-[#d9c9d9]">
                  £{entry.grossAmountGbp.toFixed(2)} · fee £{entry.feeAmountGbp.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}