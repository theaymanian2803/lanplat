import { KeyRound, Library, TrendingUp } from 'lucide-react'

const STEPS = [
  {
    icon: Library,
    title: 'Choose a language',
    body: 'Pick it here and the vault opens already filtered to it. Your media, your words, your drills — nothing else in the way.',
  },
  {
    icon: KeyRound,
    title: 'Unlock the vault',
    body: 'The vault stays closed until you enter your access code. Nothing is loaded from the database until it is entered.',
  },
  {
    icon: TrendingUp,
    title: 'Let the schedule run',
    body: 'Every word you save gets a review date. The quiz only ever shows what is due, so a session is never a waste of ten minutes.',
  },
]

export const LandingHowItWorks = () => (
  <section id="how" className="scroll-mt-20 border-t border-border/40 py-16">
    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
      How it works
    </p>
    <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
      Three steps, then you are studying
    </h2>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, index) => (
        <div
          key={title}
          className="rounded-2xl border border-border/40 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/5">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Step {index + 1}
            </span>
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  </section>
)
