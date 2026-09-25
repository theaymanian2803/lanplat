import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { isUnlocked } from '@/lib/access'
import { AccessCodeForm } from './AccessCodeForm'

/**
 * Route-layout guard. Rendered as `<Route element={<RequireAccess />}>` so every gated
 * page is declared once, and a locked visitor who deep-links to any of them still lands
 * on the page they asked for after unlocking.
 */
const RequireAccess = () => {
  const [unlocked, setUnlocked] = useState(isUnlocked)

  if (unlocked) return <Outlet />

  return <AccessCodeForm onUnlock={() => setUnlocked(true)} />
}

export default RequireAccess
