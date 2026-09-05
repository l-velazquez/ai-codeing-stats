import { describe, expect, it } from "vitest";
import { scanStats } from "./scanner";

describe.skipIf(process.env.RUN_LOCAL_SCAN !== "1")("local transcript integration", () => {
  it("scans installed providers into a coherent snapshot", async () => {
    const snapshot = await scanStats("30d");
    expect(snapshot.sources.length).toBeGreaterThan(0);
    expect(snapshot.summary.cost).toBeGreaterThanOrEqual(0);
    expect(snapshot.summary.totalTokens).toBeGreaterThanOrEqual(0);
    expect(snapshot.daily.length).toBeGreaterThanOrEqual(29);

    console.log(
      JSON.stringify(
        {
          summary: snapshot.summary,
          sources: snapshot.sources,
          topModels: snapshot.models.slice(0, 8).map((model) => ({
            provider: model.provider,
            model: model.model,
            cost: model.cost,
            tokens: model.totalTokens,
            sessions: model.sessions,
            priced: model.priced,
          })),
          topProjects: snapshot.projects.slice(0, 5).map((project) => ({
            name: project.name,
            cost: project.cost,
            tokens: project.tokens,
            sessions: project.sessions,
          })),
        },
        null,
        2,
      ),
    );
  }, 120_000);
});
