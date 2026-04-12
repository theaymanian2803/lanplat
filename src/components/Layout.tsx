import { ReactNode } from 'react'
import Navbar from './Navbar'

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background flex flex-col w-full">
    <Navbar />
    {/* w-full with no max-width constraint allows it to take the entire screen */}
    <main className="flex-1 w-full px-4 sm:px-6 lg:px-20 py-6">{children}</main>
  </div>
)

export default Layout
