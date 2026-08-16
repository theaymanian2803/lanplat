import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Loader2, PlugZap, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetTursoClient, testTursoConnection } from '@/integrations/turso/client'
import {
  clearTursoConfig,
  getTursoConfig,
  isUsingCustomConfig,
  saveTursoConfig,
} from '@/lib/tursoConfig'

interface TursoSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

export const TursoSettingsDialog = ({ open, onOpenChange }: TursoSettingsDialogProps) => {
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<TestStatus>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      const cfg = getTursoConfig()
      setUrl(cfg.url)
      setToken(cfg.token)
      setStatus('idle')
      setError('')
    }
  }, [open])

  const handleSave = async () => {
    const trimmedUrl = url.trim()
    const trimmedToken = token.trim()
    if (!trimmedUrl || !trimmedToken) {
      setStatus('error')
      setError('Please fill in both the URL and the token.')
      return
    }
    setStatus('testing')
    const result = await testTursoConnection(trimmedUrl, trimmedToken)
    if (result.ok) {
      saveTursoConfig({ url: trimmedUrl, token: trimmedToken })
      resetTursoClient()
      setStatus('ok')
      toast.success('Connected to your database. Reloading…')
      setTimeout(() => window.location.reload(), 700)
    } else {
      setStatus('error')
      setError(result.message)
      toast.error(result.message)
    }
  }

  const handleReset = () => {
    clearTursoConfig()
    resetTursoClient()
    toast.success('Back to the demo database. Reloading…')
    setTimeout(() => window.location.reload(), 700)
  }

  const usingCustom = isUsingCustomConfig()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Database Settings
          </DialogTitle>
          <DialogDescription>
            This app works right out of the box with demo data. Connect your own Turso database to
            use it with your own data instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${usingCustom ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {usingCustom ? 'Your database' : 'Demo database — shared demo data'}
          </div>

          <div className="space-y-2">
            <Label htmlFor="turso-url" className="font-mono text-xs">
              Database URL
            </Label>
            <Input
              id="turso-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="libsql://your-database.turso.io"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="turso-token" className="font-mono text-xs">
              Auth Token
            </Label>
            <Input
              id="turso-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIs…"
              type="password"
              autoComplete="off"
            />
          </div>

          <a
            href="https://turso.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <PlugZap className="h-3.5 w-3.5" />
            Don't have a database? Create a free one at turso.tech
          </a>

          {status === 'testing' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Testing connection…
            </div>
          )}
          {status === 'ok' && (
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected — reloading…
            </div>
          )}
          {status === 'error' && error && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {usingCustom && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset to demo
            </Button>
          )}
          <Button onClick={handleSave} disabled={status === 'testing'} className="gap-2">
            {status === 'testing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save &amp; Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
