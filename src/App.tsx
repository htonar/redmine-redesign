import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/StatCard";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/LoginPage";

const PROJECTS = ["Monobank App", "Power Box", "Gazprom", "42 Calendar"];

function initials(firstname: string, lastname: string): string {
  return `${firstname[0] ?? ""}${lastname[0] ?? ""}`.toUpperCase();
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const [activeNavId, setActiveNavId] = useState("activity");
  const [currentProject, setCurrentProject] = useState(PROJECTS[0]);

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <AppShell
        activeNavId={activeNavId}
        onNavigate={setActiveNavId}
        projects={PROJECTS}
        currentProject={currentProject}
        onProjectChange={setCurrentProject}
        user={{
          name: `${user.firstname} ${user.lastname}`,
          initials: initials(user.firstname, user.lastname),
        }}
        onLogout={logout}
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
  );
}

function AppGate() {
  const { status } = useAuth();

  if (status === "restoring") {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Загрузка...
      </div>
    );
  }

  if (status === "anonymous" || status === "authenticating") {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

export default App;
