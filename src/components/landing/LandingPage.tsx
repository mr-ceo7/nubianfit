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
import { NubianFitBrand } from '../common/NubianFitBrand';
import { portalHref } from '../../config/portal';

/*
 * Marketing site. Everything wrapped in <Placeholder> is copy the business still has to supply
 * (coach bio and portrait, pricing, contact details) and renders with a dashed outline until replaced.
 */

/*
 * Photos: Unsplash licence (free commercial use, no attribution required), self-hosted in
 * public/images/landing as WebP. Sources: hero WiKEnlt6Z3U (Alora Griffiths), step-apply
 * vf8WO2KlnmE (Sergio Kian), step-plan 5p8vhHUEEgY (Vitaly Gariev), step-train 2rZ4nhCdQNc
 * (Rahul Gupta), break -8lajF7J8T0 (Gold's Gym Nepal), coach-backdrop pKze3waMYVw (Crosby Hinze).
 */
const img = (name: string, widths: number[]) => ({
  src: `/images/landing/${name}-${widths[widths.length - 1]}.webp`,
  srcSet: widths.map(w => `/images/landing/${name}-${w}.webp ${w}w`).join(', '),
});

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
  { title: 'Apply', body: 'Tell us your goals, schedule and training history.', photo: 'step-apply', alt: 'A coach going through a new client\'s details on his phone' },
  { title: 'Get your plan', body: 'Your coach builds your program and habits.', photo: 'step-plan', alt: 'A coach walking a client through her plan on a tablet' },
  { title: 'Train & check in', body: 'Log workouts in the app; your coach adjusts as you progress.', photo: 'step-train', alt: 'A man doing push-ups in his living room' },
];

export const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
    {/* Nav */}
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <NubianFitBrand size="md" />
        </a>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          <a href="#how" className="hidden sm:inline text-slate-300 hover:text-white">How it works</a>
          <a href="#coach" className="hidden sm:inline text-slate-300 hover:text-white">Meet Yusuf</a>
          <a href="#pricing" className="hidden sm:inline text-slate-300 hover:text-white">Pricing</a>
          <a href={portalHref('client')} className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white font-medium">
            Sign in
          </a>
          <a href={portalHref('client', { mode: 'join' })} className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition">
            Start Training
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
            <a href={portalHref('client', { mode: 'join' })} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition">
              Start training <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#how" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-white font-semibold transition">
              How it works
            </a>
          </div>
        </div>
        <img
          {...img('hero', [800, 1600])}
          sizes="(min-width: 1152px) 552px, (min-width: 768px) 48vw, 100vw"
          width={1600}
          height={1200}
          fetchPriority="high"
          alt="A coach spotting a client through a heavy barbell squat"
          className="w-full aspect-[4/3] object-cover rounded-3xl border border-slate-800 bg-slate-900"
        />
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
              <img
                {...img(step.photo, [480, 800])}
                sizes="(min-width: 1152px) 360px, 32vw"
                width={800}
                height={600}
                loading="lazy"
                alt={step.alt}
                className="w-full aspect-[4/3] object-cover rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 mb-3 sm:mb-4"
              />
              <div className="mx-auto w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center">
                {i + 1}
              </div>
              <h3 className="mt-3 text-sm sm:text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Section break */}
      <img
        {...img('break', [1200, 2400])}
        sizes="100vw"
        width={2400}
        height={1000}
        loading="lazy"
        alt="Two people training side by side on bench presses in a bright gym"
        className="w-full h-48 sm:h-72 lg:h-96 object-cover bg-slate-900"
      />

      {/* Coach */}
      <section id="coach" className="bg-slate-900/60 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20 grid md:grid-cols-[300px_1fr] gap-8 sm:gap-12 items-center">
          <div className="relative">
            <img
              {...img('coach-yusuf-hassan', [400, 800])}
              sizes="(min-width: 768px) 300px, 80vw"
              width={800}
              height={800}
              loading="lazy"
              alt="Coach Yusuf Hassan in the gym"
              className="w-full max-w-[300px] mx-auto aspect-square object-cover rounded-3xl border border-slate-700/80 shadow-2xl bg-slate-900 ring-1 ring-white/10"
            />
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase text-emerald-400 font-bold">
              Founder & Head Coach
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Yusuf Hassan
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed text-sm sm:text-base max-w-2xl">
              Coaching grounded in progressive strength, functional biomechanics, and relentless consistency.
              Yusuf works directly with athletes to build raw strength, optimize recovery and nutrition, and eliminate guesswork from daily training.
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-800/80">
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400">Focus</p>
                <p className="text-xs sm:text-sm font-semibold text-white mt-1">Strength & Hypertrophy</p>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400">Method</p>
                <p className="text-xs sm:text-sm font-semibold text-white mt-1">Periodized Progression</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-400">Format</p>
                <p className="text-xs sm:text-sm font-semibold text-white mt-1">Direct 1-on-1 Coaching</p>
              </div>
            </div>
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
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Ready to train with NubianFit?</h2>
              <p className="text-sm text-slate-950/80 mt-1">Open the athlete app, sign in or create your profile, and save it to your home screen.</p>
            </div>
          </div>
          <a href={portalHref('client', { mode: 'join' })} className="shrink-0 px-5 py-3 rounded-xl bg-slate-950 text-emerald-400 font-bold transition hover:bg-slate-900">
            Open Athlete App
          </a>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center text-xs text-slate-400">
        <div className="flex flex-col gap-2">
          <NubianFitBrand size="sm" />
          <p>© {new Date().getFullYear()} NubianFit. All rights reserved.</p>
        </div>
        <p>
          Head Coach: Yusuf Hassan · coach@nubianfit.com
        </p>
      </div>
    </footer>
  </div>
);
