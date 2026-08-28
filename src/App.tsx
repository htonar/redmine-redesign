import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LoginPage } from "@/pages/LoginPage";
import { AppLayout } from "@/pages/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { IssuesPage } from "@/pages/IssuesPage";
import { IssueDetailPage } from "@/pages/IssueDetailPage";
import { TimeTrackingPage } from "@/pages/TimeTrackingPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { FilesPage } from "@/pages/FilesPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SearchPage } from "@/pages/SearchPage";

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

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/issues" replace />} />
        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:id" element={<IssueDetailPage />} />
        <Route path="/time" element={<TimeTrackingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route
          path="/integrations"
          element={<Navigate to="/settings" replace />}
        />
        <Route path="*" element={<Navigate to="/issues" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppGate />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
