import { KanbanBoard } from '@/components/kanban/KanbanBoard'

export default function KanbanPage() {
  return (
    <div className="h-full flex flex-col min-h-0">
      <h1 className="sr-only">Kanban</h1>
      <div className="flex-1 min-h-0 flex flex-col">
        <KanbanBoard />
      </div>
    </div>
  )
}
