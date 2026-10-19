import { ReactNode } from "react";

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden w-1/2 flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
            BF
          </span>
          <span className="text-sm font-semibold">Benevolent Fund Platform</span>
        </div>
        <div>
          <h2 className="mb-3 text-3xl font-semibold leading-tight">
            Transparent giving,
            <br />
            verified on-chain.
          </h2>
          <p className="max-w-sm text-sm text-white/70">
            Every contribution and disbursement is written to an immutable Hyperledger Fabric ledger, with an
            ML-predicted impact level shown to you before the funds ever move.
          </p>
        </div>
        <div />
      </div>

      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-sm font-bold text-white">
              BF
            </span>
          </div>
          <h1 className="text-center text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mb-8 mt-1.5 text-center text-sm text-slate-500">{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  );
}
