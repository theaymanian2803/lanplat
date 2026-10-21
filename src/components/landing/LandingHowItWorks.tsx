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
  <section id="how" className="scroll-mt-20 border-t border-border py-16">
    <h2 className="max-w-2xl text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">
      Three steps, then you are studying
    </h2>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, index) => (
        <div
          key={title}
          className="rounded-sm border border-border bg-card p-5 transition-colors hover:border-primary/40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-primary/30 bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Step {index + 1}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-bold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  </section>
)
