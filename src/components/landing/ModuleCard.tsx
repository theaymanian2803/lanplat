import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { getLangBadgeClasses } from '@/lib/langColors'
import type { LandingModule } from '@/landing/types'

interface ModuleCardProps {
  module: LandingModule
  /** The language the visitor picked, shown as a badge. Null before they choose. */
  languageName?: string | null
}

export const ModuleCard = ({ module, languageName }: ModuleCardProps) => {
  const Icon = module.icon

  return (
    <Link
      to={module.to}
      className="group flex flex-col rounded-2xl border border-border/40 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 transition-transform duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5 text-primary" />
        </span>
        {languageName ? (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${getLangBadgeClasses(
              languageName
            )}`}>
            {languageName}
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{module.title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {module.description}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 transition-colors group-hover:text-primary">
        {module.cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
