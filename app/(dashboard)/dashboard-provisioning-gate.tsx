"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { provisionTenantAction } from "./actions";

export function DashboardProvisioningGate() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    provisionTenantAction().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50">
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="mt-4 text-sm font-medium text-muted-foreground">
        Setting up your workspace...
      </p>
    </div>
  );
}
