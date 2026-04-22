'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  // Fechar com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Trava o scroll de fundo enquanto o modal está aberto
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div
          className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <div
          className={cn(
            'relative w-full bg-card rounded-2xl shadow-2xl overflow-hidden',
            'max-h-[min(90dvh,900px)] flex flex-col min-h-0',
            sizeClass[size],
            className,
          )}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-foreground pr-4">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="btn-icon btn text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    ),
    document.body,
  )
}
