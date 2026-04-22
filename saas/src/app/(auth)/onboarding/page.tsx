import { redirect } from 'next/navigation'

/** Rota antiga do assistente de cadastro; mantida para links salvos. */
export default function OnboardingPage() {
  redirect('/configuracoes')
}
