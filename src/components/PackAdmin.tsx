import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle, PackageOpen, Save } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type Pack = {
  id: number;
  name: string;
  price_gbp: string | number;
  available_at: string | null;
  is_published: boolean;
  member_count: number;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PackAdmin() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    void fetch("/api/internal/packs", { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as {
          packs?: Pack[];
          statusMessage?: string;
        };

        if (!response.ok || !data.packs) {
          throw new Error(data.statusMessage ?? "Could not load celebrity packs.");
        }

        setPacks(data.packs);
      })
      .catch((error: Error) => showError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  const updatePack = (id: number, changes: Partial<Pack>) => {
    setPacks((current) =>
      current.map((pack) =>
        pack.id === id ? { ...pack, ...changes } : pack,
      ),
    );
  };

  const savePack = async (pack: Pack) => {
    const priceGbp = Number(pack.price_gbp);

    if (!Number.isFinite(priceGbp) || priceGbp < 0) {
      showError("Enter a valid pack price.");
      return;
    }

    setSavingId(pack.id);

    try {
      const response = await fetch(`/api/internal/packs/${pack.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          priceGbp,
          availableAt: pack.available_at,
          isPublished: pack.is_published,
        }),
      });
      const data = (await response.json()) as {
        price_gbp?: string;
        available_at?: string | null;
        is_published?: boolean;
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save this pack.");
      }

      updatePack(pack.id, {
        price_gbp: data.price_gbp ?? priceGbp,
        available_at: data.available_at ?? pack.available_at,
        is_published: data.is_published ?? pack.is_published,
      });
      showSuccess(`${pack.name} has been updated.`);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not save this pack.",
      );
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="mt-7 grid min-h-48 place-items-center rounded-[28px] border border-white/10 bg-[#211230]">
        <LoaderCircle className="animate-spin text-[#c99bff]" />
      </section>
    );
  }

  return (
    <section className="mt-7 rounded-[28px] border border-[#ffd17b]/25 bg-[#211230] p-5 sm:p-7">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
        <PackageOpen size={16} /> Pack release manager
      </p>
      <h2 className="font-display mt-2 text-2xl font-black">
        Celebrity pack availability
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c4b4d0]">
        Every pack starts at £1.99 and remains unavailable until you publish it
        and its release time has arrived. Player unlocks are ready for a future
        payment connection.
      </p>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {packs.map((pack) => {
          const saving = savingId === pack.id;
          const isLive =
            pack.is_published &&
            (!pack.available_at ||
              new Date(pack.available_at).getTime() <= Date.now());

          return (
            <article
              key={pack.id}
              className="rounded-2xl border border-white/10 bg-[#160c25] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                    Pack {pack.id} · {pack.member_count} markets
                  </p>
                  <h3 className="font-display mt-1 text-xl font-black">
                    {pack.name}
                  </h3>
                </div>
                <span
                  className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                    isLive
                      ? "bg-[#183b33] text-[#62e7b6]"
                      : "bg-white/[.06] text-[#a99ab7]"
                  }`}
                >
                  {isLive ? "LIVE" : "HIDDEN"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[7rem_1fr]">
                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                  Price
                  <div className="mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-[#211230]">
                    <span className="px-3 py-3 text-sm font-black text-[#ffd17b]">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pack.price_gbp}
                      onChange={(event) =>
                        updatePack(pack.id, {
                          price_gbp: event.target.value,
                        })
                      }
                      className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm font-black text-white outline-none"
                    />
                  </div>
                </label>

                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                  Available from
                  <div className="relative mt-2">
                    <CalendarDays
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c99bff]"
                    />
                    <input
                      type="datetime-local"
                      value={toLocalDateTime(pack.available_at)}
                      onChange={(event) =>
                        updatePack(pack.id, {
                          available_at: event.target.value
                            ? new Date(event.target.value).toISOString()
                            : null,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#211230] py-3 pl-9 pr-3 text-sm font-bold text-white outline-none focus:border-[#a97cff]"
                    />
                  </div>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updatePack(pack.id, {
                      is_published: !pack.is_published,
                    })
                  }
                  className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                    pack.is_published
                      ? "bg-[#183b33] text-[#62e7b6]"
                      : "border border-white/10 bg-white/[.04] text-[#c4b4d0]"
                  }`}
                >
                  {pack.is_published ? "Published" : "Not published"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void savePack(pack)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {saving ? "Saving…" : "Save pack"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}