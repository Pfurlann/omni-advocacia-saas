'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/** "1" = barra com texto (expandida), "0" = só ícones (compacta) — nunca some por completo */
const STORAGE_KEY = 'omni:sidebar-nav-expanded'

type Ctx = {
  /** Barra larga com rótulos (vs. faixa estreita só com ícones) */
  expanded: boolean
  setExpanded: (v: boolean) => void
  toggle: () => void
  /** @deprecated use expanded */
  open: boolean
  setOpen: (v: boolean) => void
}

const SidebarNavContext = createContext<Ctx | null>(null)

export function SidebarNavProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpandedState] = useState(true)

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('omni:sidebar-nav-open')
      if (v === '0') setExpandedState(false)
    } catch { /* */ }
  }, [])

  const setExpanded = useCallback((v: boolean) => {
    setExpandedState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch { /* */ }
  }, [])

  const setOpen = setExpanded

  const toggle = useCallback(() => {
    setExpandedState(e => {
      const n = !e
      try {
        localStorage.setItem(STORAGE_KEY, n ? '1' : '0')
      } catch { /* */ }
      return n
    })
  }, [])

  const v = useMemo(
    () => ({ expanded, setExpanded, toggle, open: expanded, setOpen: setExpanded }),
    [expanded, setExpanded, toggle],
  )
  return <SidebarNavContext.Provider value={v}>{children}</SidebarNavContext.Provider>
}

export function useSidebarNav() {
  const c = useContext(SidebarNavContext)
  if (!c) {
    return {
      expanded: true,
      setExpanded: () => {},
      toggle: () => {},
      open: true,
      setOpen: () => {},
    }
  }
  return c
}
