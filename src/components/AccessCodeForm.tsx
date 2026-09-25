import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { unlock } from '@/lib/access'
import { DEFAULT_ACCESS_CODE, getAccessCode, isCustomAccessCode } from '@/lib/accessCode'

interface AccessCodeFormProps {
  /** Called after the flag is written, so the caller can render the page. */
  onUnlock: () => void
}

export const AccessCodeForm = ({ onUnlock }: AccessCodeFormProps) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (value === getAccessCode()) {
      unlock()
      onUnlock()
      return
    }
    setError(true)
    setValue('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/5 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-3xl tracking-tight text-primary">
            LingoVault
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter the access code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="Access code"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(false)
              }}
              className={error ? 'border-destructive focus-visible:ring-destructive/30' : ''}
            />
            <p className="text-xs text-muted-foreground font-mono">
              {isCustomAccessCode()
                ? 'Access code set by the owner'
                : `Demo access code: ${DEFAULT_ACCESS_CODE}`}
            </p>
            {error && (
              <p className="text-xs text-destructive font-mono">Incorrect code, try again.</p>
            )}
            <Button
              type="submit"
              disabled={!value}
              className="w-full gap-2 text-sm font-semibold"
              size="lg">
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
