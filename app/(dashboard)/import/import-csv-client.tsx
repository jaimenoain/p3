"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { parseCsvMutation, type ParseCsvResult } from "../actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MappingTriageClient } from "./mapping-triage-client";

function ResultContent({ result }: { result: ParseCsvResult }) {
  if (!result.ok) {
    return (
      <div
        className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3"
        role="alert"
      >
        <p className="text-sm font-medium text-destructive">{result.error}</p>
      </div>
    );
  }
  return (
    <pre className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs tabular-nums">
      {JSON.stringify(result.rows, null, 2)}
    </pre>
  );
}

export function ImportCsvClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseCsvResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setLoading(true);
    setResult(null);
    parseCsvMutation(formData).then((res) => {
      setResult(res);
      setLoading(false);
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  return (
    <div className="w-full max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold text-primary">Import Bank CSV</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Upload a CSV file to preview parsed rows. Only USD currency is supported; files with other currency markers will be rejected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept=".csv"
              className="sr-only"
              id="csv-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLoading(true);
                setResult(null);
                const formData = new FormData();
                formData.set("file", file);
                parseCsvMutation(formData).then((res) => {
                  setResult(res);
                  setLoading(false);
                });
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20 hover:border-muted-foreground/30 hover:bg-muted/30"
              }`}
              aria-label="Drop CSV file or click to choose"
            >
              {loading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Parsing file…
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Drop your CSV here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    .csv only · USD only
                  </p>
                </>
              )}
            </div>
          </div>

          {result !== null && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Parsed output
              </h2>
              <ResultContent result={result} />
              {result.ok && (
                <p className="text-xs text-muted-foreground">
                  {result.rows.length} row{result.rows.length !== 1 ? "s" : ""} · Headers: {result.headers.join(", ")}
                </p>
              )}
            </section>
          )}
        </CardContent>
      </Card>

      <MappingTriageClient
        key={result?.ok ? `parsed-${result.rows.length}` : "mock"}
        initialRows={result?.ok ? result.rows : undefined}
        headers={result?.ok ? result.headers : undefined}
      />
    </div>
  );
}
