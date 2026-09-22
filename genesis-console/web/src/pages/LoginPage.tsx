import { useEffect, useRef, useState, type FormEvent } from "react";
import { redirect, useSearchParams, type LoaderFunctionArgs } from "react-router";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Moon, Sun } from "lucide-react";
import { getSession, safeReturnTo } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";

export async function loginLoader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request.signal);
  if (session.authenticated) return redirect(safeReturnTo(new URL(request.url).searchParams.get("returnTo")));
  return null;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const username = useRef<HTMLInputElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const theme = useTheme();

  useEffect(() => {
    document.title = "Sign in · Genesis";
    if (window.matchMedia("(min-width: 1024px)").matches) username.current?.focus();
    return () => { document.title = "Genesis Console"; };
  }, []);
  useEffect(() => { if (error) errorMessage.current?.focus(); }, [error]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "Username or password is incorrect. Try again." : response.status === 429 ? "Too many attempts. Wait a minute, then try again." : "Sign-in is unavailable. Please try again.");
        return;
      }
      window.location.replace(safeReturnTo(params.get("returnTo")));
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-layout">
      <a href="#sign-in" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-20 focus:rounded focus:bg-[var(--card)] focus:p-3">Skip to sign in</a>
      <section className="login-brand" aria-label="About Genesis">
        <div className="relative">
          <img src="/logo.svg" alt="Genesis" width="156" height="40" className="h-10 w-auto" />
          <p className="mt-2 text-xs text-zinc-400">by AlphaBravo</p>
        </div>
        <div className="relative space-y-5">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-white">Your Kubernetes stack.<br /><span className="text-emerald-400">A clearer view.</span></h2>
          <p className="max-w-md text-lg leading-relaxed text-zinc-400">See what’s deployed, understand what’s changed, and keep your Genesis environment in view.</p>
        </div>
        <div className="relative space-y-5">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-400">
            {["Deployment insights", "Configuration comparison", "Image scanning"].map((label) => <li key={label} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />{label}</li>)}
          </ul>
          <p className="text-xs text-zinc-500">Developed by <a href="https://alphabravo.io" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white">AlphaBravo</a></p>
        </div>
      </section>
      <section id="sign-in" className="login-form-panel" aria-labelledby="login-title">
        <button type="button" aria-label={`Appearance ${theme.preference}`} onClick={theme.cycle} className="absolute top-5 right-5 inline-flex size-10 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--off)] hover:text-[var(--foreground)]">
          {theme.resolved === "dark" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
        </button>
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center lg:hidden">
            <img src="/logo.svg" alt="Genesis" width="156" height="40" className="h-10 w-auto" />
            <p className="mt-2 text-xs text-[var(--muted)]">by AlphaBravo</p>
          </div>
          <div className="space-y-2 text-center lg:text-left">
            <h1 id="login-title" className="text-2xl font-semibold tracking-tight">Sign in to Genesis</h1>
            <p className="text-sm text-[var(--muted)]">Welcome back. Enter your credentials to continue.</p>
          </div>
          <form onSubmit={signIn} className="space-y-5" aria-busy={pending}>
            {error ? <p id="login-error" ref={errorMessage} tabIndex={-1} role="alert" className="rounded-lg border border-[var(--danger)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <input ref={username} id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={256} placeholder="Your username…" aria-describedby={error ? "login-error" : undefined} className="login-input" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required maxLength={4096} placeholder="Your password…" aria-describedby={error ? "login-error" : undefined} className="login-input pr-12" />
                <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-[var(--muted)] hover:text-[var(--foreground)]">
                  {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={pending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60">
              {pending ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Signing in…</> : <>Sign in<ArrowRight className="size-4" aria-hidden /></>}
            </button>
          </form>
          <p className="text-center text-xs leading-relaxed text-[var(--muted)]">Need access? Contact your Genesis administrator.</p>
        </div>
      </section>
    </main>
  );
}
