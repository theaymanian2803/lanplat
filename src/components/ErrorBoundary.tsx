import { Button } from '@/components/ui/button'
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkLoadError'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error:', error, info.componentStack)
    // A stale shell cannot load its old hashed chunks; reloading is the only way back.
    // The helper throttles itself so a broken deploy cannot cause a reload loop.
    if (isChunkLoadError(error)) reloadForNewVersion()
  }

  handleReload = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      const staleBuild = isChunkLoadError(this.state.error)
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-lg">
            <p className="text-sm font-semibold text-destructive mb-2">
              {staleBuild ? 'A new version is available' : 'Something went wrong'}
            </p>
            <p className="text-xs text-muted-foreground mb-6 break-words">
              {staleBuild
                ? 'LingoVault was updated while this page was open. Reload to continue.'
                : this.state.error.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              {!staleBuild && (
                <Button variant="outline" size="sm" onClick={this.handleReload}>
                  Try again
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary