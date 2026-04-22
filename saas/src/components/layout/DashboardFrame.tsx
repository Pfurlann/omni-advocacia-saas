'use client'

import { cn } from '@/lib/utils'
import { SidebarNavProvider, useSidebarNav } from '@/contexts/SidebarNavContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

function NavColumn() {
  const { expanded } = useSidebarNav()
  return (
    <div
      className={cn(
        'shrink-0 transition-[width] duration-200 ease-out',
        'border-r border-white/[0.06]',
        expanded ? 'w-[220px]' : 'w-[4.5rem]',
      )}
    >
      <Sidebar compact={!expanded} />
    </div>
  )
}

function FrameInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavColumn />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export function DashboardFrame({ children }: { children: React.ReactNode }) {
  return (
    <SidebarNavProvider>
      <FrameInner>{children}</FrameInner>
    </SidebarNavProvider>
  )
}
