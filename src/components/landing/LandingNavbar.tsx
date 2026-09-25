import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'

import { Button } from '@/components/ui/button'

const ANCHORS = [
  { href: '#languages', label: 'Languages' },
  { href: '#modules', label: 'Modules' },
  { href: '#how', label: 'How it works' },
]

export const LandingNavbar = () => (
  <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="font-display text-xl font-semibold tracking-tight text-primary">
        LingoVault
      </Link>
      <div className="hidden items-center gap-1 md:flex">
        {ANCHORS.map((anchor) => (
          <a
            key={anchor.href}
            href={anchor.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            {anchor.label}
          </a>
        ))}
      </div>
      <Button asChild size="sm" className="gap-2 font-semibold">
        <Link to="/dashboard">
          <LockKeyhole className="h-3.5 w-3.5" />
          Enter the vault
        </Link>
      </Button>
    </div>
  </nav>
)
