import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Brain, Database, Globe, LayoutDashboard, ListChecks, Play, X } from 'lucide-react'
import { markOnboardingDone } from '@/lib/onboarding'
import { useOpenSettingsDialog } from '@/lib/settingsDialog'
import { Button } from '@/components/ui/button'

interface Step {
  selector: string
  icon: ReactNode
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="dashboard-heading"]',
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: 'Dashboard',
    description:
      'Your video library. Filter videos by language, or click any card to open the Study Room and start learning.',
  },
  {
    selector: '[data-tour="add-video"]',
    icon: <Play className="h-5 w-5" />,
    title: 'Add videos',
    description:
      'Click Add Video, paste a YouTube URL, give it a title, and pick a language. It appears in your library instantly.',
  },
  {
    selector: '[data-tour="nav-vocab"]',
    icon: <BookOpen className="h-5 w-5" />,
    title: 'Vocabulary Bank',
    description:
      'Add words while watching a video or from the Vocab Bank page. Each word feeds your flashcards for review.',
  },
  {
    selector: '[data-tour="nav-quiz"]',
    icon: <Brain className="h-5 w-5" />,
    title: 'Quizzes',
    description:
      'The Flashcard Quiz turns your vocabulary into spaced-repetition flashcards — the more you study, the better it schedules reviews.',
  },
  {
    selector: '[data-tour="nav-languages"]',
    icon: <Globe className="h-5 w-5" />,
    title: 'Languages',
    description:
      'Add languages on the Languages page. They power the filters on the Dashboard and the labels on your videos and words.',
  },
  {
    selector: '[data-tour="nav-lessons"]',
    icon: <ListChecks className="h-5 w-5" />,
    title: 'Lessons',
    description:
      'Create structured lessons with rich-text parts — perfect for planning a study path.',
  },
  {
    selector: '[data-tour="connect-button"]',
    icon: <Database className="h-5 w-5" />,
    title: 'Connect your own database',
    description:
      'This site runs on a shared demo database. Click Connect to set up your own free Turso database so your data stays private.',
  },
]

const TOOLTIP_WIDTH = 336
const TOOLTIP_HEIGHT = 224

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface OnboardingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const OnboardingDialog = ({ open, onOpenChange }: OnboardingDialogProps) => {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const openSettings = useOpenSettingsDialog()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    if (open && location.pathname !== '/') navigate('/')
  }, [open, location.pathname, navigate])

  const measure = useCallback(() => {
    if (!open) return
    const el = document.querySelector<HTMLElement>(STEPS[step].selector)
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [open, step])

  useLayoutEffect(() => {
    measure()
    const observer = new MutationObserver(measure)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  useEffect(() => {
    if (!open) return
    const el = document.querySelector<HTMLElement>(STEPS[step].selector)
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, step])

  if (!open) return null

  const handleClose = () => {
    markOnboardingDone()
    onOpenChange(false)
  }

  const placeBelow = rect !== null && rect.top + rect.height + TOOLTIP_HEIGHT + 24 <= window.innerHeight
  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, 16), window.innerWidth - TOOLTIP_WIDTH - 16)
    : 16
  const tooltipTop = rect
    ? placeBelow
      ? rect.top + rect.height + 24
      : rect.top - TOOLTIP_HEIGHT - 24
    : 16

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label="Welcome tour">
      <div className="absolute inset-0 bg-black/60" />

      {rect && (
        <div
          data-tour-spotlight
          className="absolute rounded-lg border-2 border-primary bg-background/10 pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      )}

      <div
        className="absolute z-10 bg-card text-card-foreground border border-border/50 rounded-xl shadow-2xl pointer-events-auto"
        style={{ width: TOOLTIP_WIDTH, left: tooltipLeft, top: tooltipTop }}>
        <div
          className={`absolute h-3 w-3 rotate-45 border-border/50 bg-card ${
            placeBelow ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'
          }`}
          style={{
            left: Math.min(Math.max(rect ? rect.left + rect.width / 2 - 6 : 16, 20), TOOLTIP_WIDTH - 26),
          }}
        />

        <button
          onClick={handleClose}
          aria-label="Skip tour"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 text-primary">
              {current.icon}
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {step + 1} / {STEPS.length}
            </span>
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-5 bg-primary' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold leading-snug">{current.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}>
              Back
            </Button>
            {isLast ? (
              <Button
                size="sm"
                onClick={() => {
                  handleClose()
                  openSettings()
                }}
                className="text-sm font-semibold">
                Open database settings
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="text-sm font-semibold">
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingDialog