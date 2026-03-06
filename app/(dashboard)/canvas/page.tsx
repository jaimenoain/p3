import { getScenarioBlocksAction } from "../actions";
import { ProjectionCanvasClient } from "./canvas-client";

export default async function ProjectionCanvasPage() {
  const result = await getScenarioBlocksAction();

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Projection Canvas
        </h1>
        <p className="text-sm text-destructive max-w-md">
          {result.error}
        </p>
      </div>
    );
  }

  return (
    <ProjectionCanvasClient
      scenarioId={result.scenarioId}
      initialBlocks={result.blocks}
    />
  );
}
