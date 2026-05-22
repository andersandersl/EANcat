import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';

import { submitSignupInterest } from '../api';

type CreateAccountModalProps = {
  onClose: () => void;
};

function inferNameFromEmail(email: string): string {
  const local = (email.split('@')[0] || '').replace(/[._-]+/g, ' ').trim();
  if (local.length >= 2) return local;
  return 'Website lead';
}

export default function CreateAccountModal({ onClose }: CreateAccountModalProps) {
  const [email, setEmail] = useState('');
  const [companyVatNumber, setCompanyVatNumber] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !companyVatNumber) return;

    setState('sending');
    try {
      await submitSignupInterest({
        name: inferNameFromEmail(email),
        email: email.trim(),
        companyVatNumber: companyVatNumber.trim(),
        marketingConsent: true,
      });
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[hsl(220_14%_89%)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(220_14%_89%)]">
          <h2 className="text-base font-semibold text-[hsl(222_47%_8%)]">Create account</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md hover:bg-[hsl(220_14%_93%)] cursor-pointer transition-colors text-[hsl(220_12%_40%)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {state === 'done' ? (
            <div className="text-center py-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-emerald-600 text-lg">✓</span>
              </div>
              <p className="font-semibold text-[hsl(222_47%_8%)]">Thanks for your request!</p>
              <p className="text-sm text-[hsl(220_12%_40%)] mt-1">We will get back to you soon.</p>
              <button onClick={onClose} className="mt-4 text-sm text-[hsl(221_92%_55%)] hover:underline cursor-pointer">Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-[hsl(220_12%_40%)]">
                Enter your work email and EU VAT number to request account access.
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[hsl(222_47%_8%)]" htmlFor="create-account-email">Email address</label>
                <input
                  ref={inputRef}
                  id="create-account-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full border border-[hsl(220_14%_89%)] rounded-md px-3 py-2 text-sm text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[hsl(222_47%_8%)]" htmlFor="create-account-vat">Company EU VAT number</label>
                <input
                  id="create-account-vat"
                  type="text"
                  value={companyVatNumber}
                  onChange={(e) => setCompanyVatNumber(e.target.value)}
                  placeholder="SE123456789001"
                  required
                  className="w-full border border-[hsl(220_14%_89%)] rounded-md px-3 py-2 text-sm text-[hsl(222_47%_8%)] placeholder:text-[hsl(220_12%_60%)] focus:outline-none focus:ring-2 focus:ring-[hsl(221_92%_55%)] focus:border-transparent"
                />
              </div>

              {state === 'error' && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  Could not submit request. Please try again.
                </p>
              )}

              <button
                type="submit"
                disabled={state === 'sending'}
                className="w-full py-2.5 text-sm font-medium text-white bg-[hsl(221_92%_55%)] rounded-md hover:bg-[hsl(221_92%_48%)] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {state === 'sending' ? 'Sending...' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
