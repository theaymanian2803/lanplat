import { useState } from 'react'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ShieldCheck } from 'lucide-react'

const ACCESS_CODE = '123123123'
const STORAGE_KEY = 'lingovault_unlocked'

const isUnlocked = () => sessionStorage.getItem(STORAGE_KEY) === '1'

const AccessGate = ({ children }: { children: ReactNode }) => {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <>{children}</>

  const handleSubmit = () => {
    if (value === ACCESS_CODE) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
      setValue('')
    }
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
          <div className="space-y-3">
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value) handleSubmit()
              }}
              className={error ? 'border-destructive focus-visible:ring-destructive/30' : ''}
            />
            {error && (
              <p className="text-xs text-destructive font-mono">Incorrect code, try again.</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!value}
              className="w-full gap-2 text-sm font-semibold"
              size="lg">
              Unlock
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AccessGate
