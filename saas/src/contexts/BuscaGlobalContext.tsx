'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { BuscaGlobalModal } from '@/components/layout/BuscaGlobalModal'

type Ctx = {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const BuscaGlobalContext = createContext<Ctx | null>(null)

export function useBuscaGlobal() {
  const v = useContext(BuscaGlobalContext)
  if (!v) throw new Error('useBuscaGlobal só dentro do BuscaGlobalProvider')
  return v
}

/** Versão segura fora do provider (ex.: testes) — no-op. */
export function useBuscaGlobalOptional(): Ctx | null {
  return useContext(BuscaGlobalContext)
}

export function BuscaGlobalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])

  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      if (el.getAttribute('role') === 'textbox') return true
      return false
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const typing = isTypingTarget(e.target)

      const stop = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }

      // F3: em muitos Macs o SO usa F3 p/ Mission Control — nem sempre o browser recebe o evento.
      if (e.key === 'F3' || e.code === 'F3') {
        stop()
        setOpen(true)
        return
      }

      // ⌘K / Ctrl+K: em alguns browsers o atalho é reservado (ex.: barra/omnibox) e o evento não chega
      // à página — use ⌘⇧K / Ctrl+Shift+K como reserva, ou a tecla / ou o botão Busca.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        stop()
        setOpen(v => !v)
        return
      }

      // “Quick find” (tecla /) fora de campo; `e.code` ajuda com layouts de teclado variados
      if (
        !typing
        && (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide')
        && !e.metaKey
        && !e.ctrlKey
        && !e.altKey
      ) {
        stop()
        setOpen(true)
      }
    }
    // `document` + captura: recebe cedo, antes da maioria dos handlers da página; stopImmediate
    // reduz a chance de o atalho ser “comido” por outro handler no mesmo nó.
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [])

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])

  return (
    <BuscaGlobalContext.Provider value={value}>
      {children}
      <BuscaGlobalModal open={open} onClose={() => setOpen(false)} />
    </BuscaGlobalContext.Provider>
  )
}
