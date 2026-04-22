import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

// ─── Input ────────────────────────────────────────────────────────────────────
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('form-input', className)} {...props} />
  ),
)
Input.displayName = 'Input'

// ─── Select ───────────────────────────────────────────────────────────────────
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn('form-select', className)} {...props} />
  ),
)
Select.displayName = 'Select'

// ─── Textarea ─────────────────────────────────────────────────────────────────
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('form-textarea', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

// ─── Label ────────────────────────────────────────────────────────────────────
export function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('form-label', className)} {...props}>
      {children}
    </label>
  )
}

// ─── FormError ────────────────────────────────────────────────────────────────
export function FormError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="form-error">{children}</p>
}

// ─── SearchInput — input com ícone de lupa embutido ──────────────────────────
interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}
export function SearchInput({ className, icon, ...props }: SearchInputProps) {
  return (
    <div className="search-wrap">
      <span className="search-icon">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        )}
      </span>
      <input className={cn('search-input', className)} {...props} />
    </div>
  )
}
