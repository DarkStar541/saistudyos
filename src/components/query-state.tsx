import { Button } from "@/components/ui/button";

type Props = {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
};

export function QueryState({ loading, error, onRetry, loadingLabel = "Loading…" }: Props) {
  if (loading) {
    return <div role="status" className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">{loadingLabel}</div>;
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Please try again.";
    return (
      <div role="alert" className="rounded-xl border border-border bg-card px-4 py-6">
        <p className="text-sm font-medium">We couldn’t load this page.</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {onRetry && <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }
  return null;
}
