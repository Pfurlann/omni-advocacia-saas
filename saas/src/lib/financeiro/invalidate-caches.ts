import type { QueryClient } from '@tanstack/react-query'

/** Invalida consultas de KPI, lançamentos, fluxo, DFC, AP/AR e tabelas fiscais. */
export function invalidateModuloFinanceiro(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['lancamentos'] })
  void qc.invalidateQueries({ queryKey: ['fin-fluxo'] })
  void qc.invalidateQueries({ queryKey: ['fin-dfc'] })
  void qc.invalidateQueries({ queryKey: ['fin-ap-ar'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  void qc.invalidateQueries({ queryKey: ['plano-contas'] })
  void qc.invalidateQueries({ queryKey: ['fiscal-cfop'] })
  void qc.invalidateQueries({ queryKey: ['notas-fiscais'] })
  void qc.invalidateQueries({ queryKey: ['fin-allocacao-custos'] })
  void qc.invalidateQueries({ queryKey: ['processos-lanc-select'] })
}
