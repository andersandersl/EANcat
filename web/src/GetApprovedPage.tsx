import { useState } from 'react';
import type { FormEvent } from 'react';
import PageTopBar from './PageTopBar';
import SiteFooter from './SiteFooter';
import { useDocumentMeta } from './useDocumentMeta';

type FormState = {
  firstName: string;
  lastName: string;
  company: string;
  vatNumber: string;
  website: string;
  email: string;
  phone: string;
};

const INITIAL_FORM: FormState = {
  firstName: '',
  lastName: '',
  company: '',
  vatNumber: '',
  website: '',
  email: '',
  phone: '',
};

export default function GetApprovedPage() {
  useDocumentMeta({
    title: 'Get Approved to Join EANrunner',
    description:
      'Request access to EANrunner. Submit your business details to start onboarding products and activating supplier catalogs faster.',
    path: '/get-approved',
  });

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-[hsl(222_47%_10%)]">
      <PageTopBar />

      <main className="mx-auto w-full max-w-[980px] px-4 py-10">
        <section className="rounded-2xl border border-[hsl(220_16%_88%)] bg-[linear-gradient(180deg,hsl(220_24%_99%),hsl(220_20%_97%))] px-6 py-7 shadow-[0_10px_28px_rgb(18_32_74/0.08)] sm:px-8">
          <h1 className="text-4xl font-bold leading-tight text-[hsl(222_47%_10%)]">Get approved</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(220_14%_34%)]">
            Please fill out the form below and we will get back to you as soon as possible.
          </p>

          <form onSubmit={onSubmit} className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">First name</span>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Last name</span>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Company</span>
              <input
                required
                value={form.company}
                onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">VAT number</span>
              <input
                value={form.vatNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, vatNumber: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Website</span>
              <input
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(220_12%_46%)]">Phone number</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[hsl(220_16%_86%)] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(221_92%_55%)]"
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-lg border border-[hsl(221_72%_72%)] bg-[hsl(221_84%_95%)] px-5 text-sm font-semibold text-[hsl(221_72%_32%)] hover:brightness-95"
              >
                See if you qualify
              </button>
            </div>

            {submitted && (
              <p className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Thanks. Your request is ready. Next step is wiring this form to your backend endpoint or email service.
              </p>
            )}
          </form>
        </section>

        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
