import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-800 to-brand-900 px-4 py-8 sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-white">
          <img src="/favicon.svg" alt="" className="size-11 rounded-xl ring-2 ring-white/30" />
          <div>
            <p className="text-xl font-bold tracking-tight">CivicLink</p>
            <p className="text-sm text-brand-100">Sol Plaatje Municipality</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-slate-600">{subtitle}</p>
          {children}
        </div>
        <div className="mt-5 text-center text-sm text-brand-100">{footer}</div>
      </div>
    </div>
  );
}
