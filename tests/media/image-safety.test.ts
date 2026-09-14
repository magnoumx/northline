import { describe, expect, it } from "vitest";
import { inspectEditorialImage } from "../../lib/media/image-safety";

describe("editorial image safety", () => {
  it("refuses the surgical photograph that reached a live article", () => {
    // Observed in production: a correctly licensed intraoperative photograph
    // was published above a health story because licence was the only test.
    const verdict = inspectEditorialImage({
      title: "File:Laparoscopic hysterectomy uterus.jpg",
      description: "Intraoperative view during a laparoscopic hysterectomy",
      category: "HEALTH",
    });
    expect(verdict.publishable).toBe(false);
    expect(verdict.reason).toMatch(
      /hysterectomy|surgical|laparoscopic|intraoperative/u,
    );
  });

  it("refuses imagery of the dead regardless of category", () => {
    for (const description of [
      "An autopsy specimen photographed in the laboratory",
      "The corpse was recovered from the site",
    ]) {
      expect(
        inspectEditorialImage({ title: "File:x.jpg", description }).publishable,
      ).toBe(false);
    }
  });

  it("refuses explicit imagery", () => {
    expect(
      inspectEditorialImage({
        title: "File:Nude study.jpg",
        description: "A nude figure study",
      }).publishable,
    ).toBe(false);
  });

  it("holds health and science stories to a higher bar", () => {
    const clinical = {
      title: "File:Cell diagram.jpg",
      description: "A medical illustration of the affected tissue",
    };
    expect(
      inspectEditorialImage({ ...clinical, category: "HEALTH" }).publishable,
    ).toBe(false);
    // The same picture is unremarkable beside a technology story.
    expect(
      inspectEditorialImage({ ...clinical, category: "TECHNOLOGY" })
        .publishable,
    ).toBe(true);
  });

  it("still allows ordinary news photographs", () => {
    for (const candidate of [
      {
        title: "File:Mathieu van der Poel 2026.jpg",
        description: "Van der Poel racing during the Tour de France",
        category: "SPORTS",
      },
      {
        title: "File:US Capitol building.jpg",
        description: "The Capitol photographed from the east lawn",
        category: "US_NEWS",
      },
    ]) {
      expect(inspectEditorialImage(candidate).publishable, candidate.title).toBe(
        true,
      );
    }
  });

  it("matches whole words, not fragments", () => {
    // "cooperation" contains "operation"; "breastplate" contains "breast".
    expect(
      inspectEditorialImage({
        title: "File:Summit.jpg",
        description: "A photograph marking international cooperation",
      }).publishable,
    ).toBe(true);
  });
});
