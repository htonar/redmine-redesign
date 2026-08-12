import { useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/StatCard'

const PROJECTS = ['Monobank App', 'Power Box', 'Gazprom', '42 Calendar']

function App() {
  const [activeNavId, setActiveNavId] = useState('activity')
  const [currentProject, setCurrentProject] = useState(PROJECTS[0])

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        activeNavId={activeNavId}
        onNavigate={setActiveNavId}
        projects={PROJECTS}
        currentProject={currentProject}
        onProjectChange={setCurrentProject}
        user={{ name: 'Gary Johnston', initials: 'GJ' }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Задачи в этом году"
            value={643}
            trend={9.2}
            trendPeriodLabel="за 31 день"
          />
          <StatCard label="Открытые задачи" value={15} trend={-3.4} />
          <StatCard label="Создано задач" value={3} />
          <StatCard label="Просроченные" value={2} trend={-12} />
        </div>
      </AppShell>
    </TooltipProvider>
  )
}

export default App
