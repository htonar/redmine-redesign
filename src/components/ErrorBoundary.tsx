import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Заголовок fallback-UI. По умолчанию - общая формулировка. */
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Ловит ошибки рендера в поддереве и показывает единообразный fallback с
 * возможностью повторить (сбросить состояние и перерендерить детей) - вместо
 * падения всего экрана из-за сбоя в одном виджете/странице (issue #8).
 *
 * React 19 не даёт hook-API для error boundaries - только классовый
 * компонент (getDerivedStateFromError/componentDidCatch).
 *
 * Ловит только ошибки рендера (JS-исключения), не async/network-ошибки - те
 * уже обрабатываются существующими `isLoading`/`error` полями хуков через
 * `Alert`. Это независимый защитный слой на случай неожиданного краша.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary поймал ошибку рендера:", error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/20 bg-card px-4 py-10 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {this.props.title ?? "Не удалось отобразить содержимое"}
            </p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            Повторить
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
