import { useState, type ReactNode } from 'react'

import { isUnlocked } from '@/lib/access'
import { AccessCodeForm } from './AccessCodeForm'

/**
 * Re-exported for the existing sign-out call site. The gate itself now lives in
 * RequireAccess, which is a route-layout guard rather than a children wrapper.
 */
export { ACCESS_STORAGE_KEY } from '@/lib/access'

const AccessGate = ({ children }: { children: ReactNode }) => {
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <>{children}</>

  return <AccessCodeForm onUnlock={() => setUnlocked(true)} />
}

export default AccessGate
