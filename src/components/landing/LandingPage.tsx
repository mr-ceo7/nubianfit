import React from 'react';
import {
  Dumbbell,
  CalendarDays,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import { NubianFitLogo } from '../common/NubianFitLogo';
import { portalHref } from '../../config/portal';

/*
 * Marketing site. Everything wrapped in <Placeholder> is copy the business still has to supply
 * (coach bio, pricing, contact details, photos) and renders with a dashed outline until replaced.
 */

const Placeholder: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-block border border-dashed border-amber-500/60 bg-amber-500/5 rounded px-1.5 ${className}`}>
    {children}
  </span>
);

const FEATURES = [
  { icon: Dumbbell, title: 'Personal programs', body: 'Training blocks written for your goal, experience and equipment.' },
  { icon: CalendarDays, title: 'Your week, planned', body: 'Every session lands on your calendar with sets, reps and rest times.' },
  { icon: TrendingUp, title: 'Progress you can see', body: 'Weight, measurements, photos and personal records in one place.' },
  { icon: MessageSquare, title: 'Direct line to your coach', body: 'Ask questions and get feedback on every workout you log.' },
];

const STEPS = [
  { title: 'Apply', body: 'Tell us your goals, schedule and training history.' },
  { title: 'Get your plan', body: 'Your coach builds your program and habits.' },
  { title: 'Train & check in', body: 'Log workouts in the app; your coach adjusts as you progress.' },
];

export const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
    {/* Nav */}
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <NubianFitLogo className="h-8 w-8" />
          <span className="font-logo text-lg tracking-wide">
            <span className="text-logo-nubian">NUBIAN</span>
            <span className="text-logo-fit">FIT</span>
          </span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          <a href="#how" className="hidden sm:inline text-slate-300 hover:text-white">How it works</a>
          <a href="#pricing" className="hidden sm:inline text-slate-300 hover:text-white">Pricing</a>
          <a href={portalHref('client')} className="px-3 py-1.5 rounded-lg text-slate-200 hover:text-white font-semibold">
            Client login
          </a>
          <a href={portalHref('coach')} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold">
            Coaches
          </a>
        </nav>
      </div>
    </header>

    <main id="top">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-14 pb-16 sm:pt-24 sm:pb-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Online fitness coaching</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-white">
            Coaching that fits your life, with a coach in your pocket.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-md">
            A personal training plan, a coach who checks your work, and an app that keeps you on track between sessions.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#pricing" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold">
              Start coaching <ArrowRight className="w-4 h-4" />
            </a>
            <a href={portalHref('client')} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-white font-semibold">
              I already have a coach
            </a>
          </div>
        </div>
        <div className="aspect-[4/3] rounded-3xl border border-dashed border-amber-500/60 bg-slate-900 flex items-center justify-center text-center p-6">
          <p className="text-sm text-slate-400">
            <Placeholder>Hero photo: coach training a client (landscape, 1600×1200)</Placeholder>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Everything between you and your goal</h2>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 sm:p-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="mt-3 text-sm sm:text-base font-bold text-white">{title}</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">How it works</h2>
        <ol className="mt-10 grid grid-cols-3 gap-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="text-center">
              <div className="mx-auto w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center">
                {i + 1}
              </div>
              <h3 className="mt-3 text-sm sm:text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Coach */}
      <section className="bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-[280px_1fr] gap-8 items-center">
          <div className="aspect-square rounded-3xl border border-dashed border-amber-500/60 bg-slate-950 flex items-center justify-center p-6 text-center">
            <p className="text-sm text-slate-400"><Placeholder>Coach portrait (square)</Placeholder></p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Meet your coach</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white"><Placeholder>Coach name</Placeholder></h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              <Placeholder className="block">
                Two or three sentences about the coach: background, certifications, who they help and the results clients get.
              </Placeholder>
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center">Coaching plans</h2>
        <p className="mt-2 text-center text-slate-400 text-sm">Online payment is coming soon. For now, contact us to join.</p>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {['Plan one', 'Plan two', 'Plan three'].map((plan, i) => (
            <div
              key={plan}
              className={`rounded-2xl border p-4 sm:p-6 bg-slate-900 ${i === 1 ? 'border-emerald-500' : 'border-slate-800'} ${i === 2 ? 'col-span-2 lg:col-span-1' : ''}`}
            >
              <h3 className="text-sm sm:text-base font-bold text-white"><Placeholder>{plan} name</Placeholder></h3>
              <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-white"><Placeholder>KES —</Placeholder></p>
              <p className="text-xs text-slate-400">per month</p>
              <ul className="mt-4 space-y-2 text-xs sm:text-sm text-slate-300">
                {['What is included', 'Check-in frequency', 'Support level'].map(item => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <Placeholder>{item}</Placeholder>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* App CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-emerald-500 p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <Smartphone className="w-8 h-8 text-slate-950 shrink-0" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Already coached with us?</h2>
              <p className="text-sm text-slate-950/80 mt-1">Open the app, sign in with your email, and add it to your home screen.</p>
            </div>
          </div>
          <a href={portalHref('client')} className="shrink-0 px-5 py-3 rounded-xl bg-slate-950 text-emerald-400 font-bold">
            Open the app
          </a>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-3 justify-between text-xs text-slate-400">
        <p>© {new Date().getFullYear()} NubianFit</p>
        <p>
          Contact: <Placeholder>email@yourdomain</Placeholder> · <Placeholder>+254 …</Placeholder>
        </p>
      </div>
    </footer>
  </div>
);
