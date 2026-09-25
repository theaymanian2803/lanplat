import { Link } from 'react-router-dom'

import { landingModules } from '@/landing/modules'

export const LandingFooter = () => (
  <footer className="border-t border-border/40">
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="font-display text-lg font-semibold tracking-tight text-primary">
            LingoVault
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            A single place for the words, lessons and drills you collect while learning a
            language.
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            Modules
          </p>
          <ul className="mt-3 space-y-2">
            {landingModules.map((module) => (
              <li key={module.id}>
                <Link
                  to={module.to}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {module.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-10 border-t border-border/40 pt-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
        LingoVault
      </p>
    </div>
  </footer>
)
