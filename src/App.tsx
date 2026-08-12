import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { AppLayout } from "@/pages/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { IssuesPage } from "@/pages/IssuesPage";
import { TimeTrackingPage } from "@/pages/TimeTrackingPage";

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
        <Route path="/time" element={<TimeTrackingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/issues" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppGate />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
