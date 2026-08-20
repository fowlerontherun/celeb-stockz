import type { ReactNode } from "react";
import { Activity, Database, LockKeyhole, PackageOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/operations", label: "Operations", icon: Activity },
  { to: "/operations/packs", label: "Celebrity packs", icon: PackageOpen },
  { to: "/operations/providers", label: "Data providers", icon: Database },
  { to: "/operations/live-stkz", label: "Live STKZ launch", icon: LockKeyhole },
];

export function OperationsShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <>
      <nav
        aria-label="Control center sections"
        className="sticky top-0 z-40 border-b border-white/10 bg-[#120b20]/95 px-5 py-3 backdrop-blur sm:px-8 lg:px-12"
      >
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/operations"
                ? pathname === to
                : pathname.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition sm:text-sm ${
                  active
                    ? "bg-[#7c3aed] text-white shadow-lg"
                    : "border border-white/10 bg-white/[.04] text-[#c4b4d0] hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}