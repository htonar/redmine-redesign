import { StatCard } from "@/components/StatCard";

/**
 * Обзорный дашборд - сейчас статичный демо-контент (см. docs/design.md,
 * блок "UI Elements"). Вторичен по приоритету, см. CLAUDE.md - сначала
 * реальные данные должны появиться в списке задач и учете времени.
 */
export function DashboardPage() {
  return (
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
  );
}
