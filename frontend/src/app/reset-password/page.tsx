'use client';

import { useBrowserSearch, useClientReady } from "@/hooks/use-browser-state";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { ArrowLeft,CheckCircle2,KeyRound,Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect,useState,type FormEvent } from 'react';

type ApiError = { response?: { data?: { detail?: string; new_password?: string[] } } };

export default function ResetPasswordPage() {
  const params = new URLSearchParams(useBrowserSearch());
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const linkReady = useClientReady();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/users/password-reset/confirm/', {
        uid,
        token,
        new_password: password,
      });
      setComplete(true);
    } catch (requestError) {
      const data = (requestError as ApiError).response?.data;
      setError(data?.new_password?.join(' ') || data?.detail || 'Could not reset the password. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link href="/login" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>

        {complete ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-700" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Password updated</h1>
            <p className="text-sm leading-6 text-slate-600">Your new password is ready. Sign in with it to access SmartLivestock.</p>
            <Button asChild className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : !linkReady ? (
          <p className="py-8 text-center text-sm text-slate-600">Checking your reset link…</p>
        ) : !uid || !token ? (
          <div className="space-y-4 text-center">
            <KeyRound className="mx-auto size-10 text-amber-600" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Reset link unavailable</h1>
            <p className="text-sm leading-6 text-slate-600">This link is incomplete. Request a new password reset link from the sign-in page.</p>
            <Button asChild className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
              <Link href="/login">Return to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-2">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900"><KeyRound className="size-5" /></div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Choose a new password</h1>
              <p className="text-sm leading-6 text-slate-600">Use a password you have not used for this account before.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
              </div>
              {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
              <Button type="submit" disabled={loading} className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
                {loading ? <><Loader2 className="mr-2 size-4 animate-spin" /> Updating password…</> : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
