"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

type Entry = {
  id: string;
  customer: string;
  job_name: string;
  amount: number;
  direction: "in" | "out";
  created_at: string;
};

const demoEntries: Entry[] = [
  { id: "1", customer: "Harris & Co.", job_name: "Bathroom fit-off", amount: 4850, direction: "in", created_at: new Date().toISOString() },
  { id: "2", customer: "Mia Turner", job_name: "Switchboard upgrade", amount: 2380, direction: "in", created_at: new Date().toISOString() },
  { id: "3", customer: "Monthly costs", job_name: "Wages, stock & overheads", amount: 18420, direction: "out", created_at: new Date().toISOString() },
  { id: "4", customer: "Northside Dental", job_name: "Lighting install", amount: 21370, direction: "in", created_at: new Date().toISOString() },
];

const money = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export default function Home() {
  const [supabase] = useState(getSupabase);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user || !supabase) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    supabase
      .from("money_entries")
      .select("id, customer, job_name, amount, direction, created_at")
      .gte("created_at", monthStart.toISOString())
      .order("created_at", { ascending: false })
      .then(({ data }) => setEntries((data as Entry[]) ?? []));
  }, [user, supabase]);

  async function sendLogin(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setNotice("Demo mode is ready — use the button below.");
      return;
    }
    setBusy(true);
    setNotice("");
    // One form for both: sign in, and if the account doesn't exist yet, create it.
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error?.code === "invalid_credentials") {
      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp.error?.code === "user_already_exists") setNotice("Wrong password for that email.");
      else if (signUp.error) setNotice(signUp.error.message);
      else if (!signUp.data.session) setNotice("Check your inbox to confirm your email, then sign in.");
    } else if (signIn.error) {
      setNotice(signIn.error.message);
    }
    setBusy(false);
  }

  function enterDemo() {
    setEntries(demoEntries);
    setDemo(true);
  }

  async function addJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const job = {
      customer: String(form.get("customer")).trim(),
      job_name: String(form.get("job")).trim(),
      amount: Number(form.get("price")),
      direction: "in" as const,
    };

    if (!user || !supabase) {
      setEntries((current) => [{ ...job, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...current]);
      setSheetOpen(false);
      return;
    }

    setBusy(true);
    setNotice("");
    const { data, error } = await supabase
      .from("money_entries")
      .insert({ ...job, user_id: user.id })
      .select("id, customer, job_name, amount, direction, created_at")
      .single();
    setBusy(false);
    if (error) {
      setNotice(`Couldn't save that job: ${error.message}`);
      return;
    }
    setEntries((current) => [data as Entry, ...current]);
    setSheetOpen(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setDemo(false);
    setEntries([]);
    setNotice("");
  }

  if (loading) return <main className="loading">Loading your month…</main>;
  if (!user && !demo) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={busy} notice={notice} onSubmit={sendLogin} onDemo={enterDemo} />;

  const income = entries.filter((item) => item.direction === "in").reduce((sum, item) => sum + Number(item.amount), 0);
  const outgoing = entries.filter((item) => item.direction === "out").reduce((sum, item) => sum + Number(item.amount), 0);
  const profit = income - outgoing;
  const jobs = entries.filter((item) => item.direction === "in");
  const firstName = user?.email?.split("@")[0].split(/[._-]/)[0] || "Jack";
  const month = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(new Date());

  return (
    <main className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="user-actions">
          <span className="avatar">{firstName.charAt(0).toUpperCase()}</span>
          <button className="text-button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="dashboard">
        <div className="intro">
          <div>
            <p className="eyebrow">{month}</p>
            <h1>G&apos;day, {firstName}.</h1>
          </div>
          <span className={`status ${profit >= 0 ? "positive" : "negative"}`}>
            <i /> {profit >= 0 ? "In the black" : "Needs attention"}
          </span>
        </div>

        <section className={`money-card ${profit < 0 ? "loss" : ""}`}>
          <p className="card-label">This month</p>
          <div className="profit-row">
            <div>
              <span>Profit</span>
              <strong>{money.format(profit)}</strong>
            </div>
            <span className="trend">{profit >= 0 ? "↗" : "↘"}</span>
          </div>
          <div className="totals">
            <div><span>Money in</span><b>{money.format(income)}</b></div>
            <div><span>Money out</span><b>{money.format(outgoing)}</b></div>
          </div>
        </section>

        <button className="job-button" onClick={() => setSheetOpen(true)}>
          <span className="plus">+</span>
          <span><b>Job done</b><small>Get it off your mind</small></span>
          <span className="arrow">→</span>
        </button>

        <section className="latest">
          <div className="section-title"><h2>Jobs done</h2><span>{jobs.length} this month</span></div>
          {jobs.length ? (
            jobs.map((job) => (
              <div className="job-row" key={job.id}>
                <span className="job-mark">✓</span>
                <div><b>{job.customer}</b><small>{job.job_name}</small></div>
                <strong>+{money.format(job.amount)}</strong>
              </div>
            ))
          ) : (
            <p className="empty">No jobs added yet. Make the first one count.</p>
          )}
        </section>
      </section>

      {sheetOpen && (
        <div className="sheet-backdrop" onMouseDown={() => setSheetOpen(false)}>
          <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="job-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div><p className="eyebrow">Money in</p><h2 id="job-title">Job done.</h2></div>
              <button className="close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={addJob}>
              <label>Customer<input name="customer" placeholder="e.g. Sarah Wilson" autoFocus required /></label>
              <label>What was the job?<input name="job" placeholder="e.g. Hot water install" required /></label>
              <label>Price<div className="price-input"><span>$</span><input name="price" type="number" inputMode="decimal" min="1" step="0.01" placeholder="0" required /></div></label>
              <button className="save-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Add money in"} <span>→</span></button>
              {notice && <p className="notice error">{notice}</p>}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function Login({ email, setEmail, password, setPassword, busy, notice, onSubmit, onDemo }: {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  busy: boolean;
  notice: string;
  onSubmit: (event: FormEvent) => void;
  onDemo: () => void;
}) {
  return (
    <main className="login-page">
      <section className="login-card">
        <Logo />
        <div className="login-copy">
          <p className="eyebrow">One login. The whole business.</p>
          <h1>Know where you stand.</h1>
          <p>Money in, money out, and what&apos;s left. Nothing else in the way.</p>
        </div>
        <form onSubmit={onSubmit} className="login-form">
          <label>Work email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourbusiness.com.au" autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6+ characters" autoComplete="current-password" minLength={6} required /></label>
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <span>→</span></button>
          <small className="hint">New here? Same form — we&apos;ll set you up.</small>
        </form>
        {notice && <p className="notice">{notice}</p>}
        <button className="demo-button" onClick={onDemo}>View demo workspace</button>
        <p className="slogan">Out-simple them.</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="art-copy"><span>ONE CLEAR NUMBER</span><strong>$10,180</strong><p>IN THE BLACK</p></div>
        <div className="orb orb-one" /><div className="orb orb-two" />
      </aside>
    </main>
  );
}

function Logo() {
  return <div className="logo"><span>SV</span><b>SITE VIP</b></div>;
}
