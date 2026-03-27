/**
 * /src/app/api/tracker/[id]/stats/route.ts
 *
 * Task 4:
 * - Auth check
 * - Tracker ownership check
 * - Load tracker + entries
 * - Compute numeric field stats
 * - Compute dropdown field counts
 * - Compute boolean field counts
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateTrackerStatistics } from '@/lib/trackerStatsCalculator'

/**
 * Types
 */

type TrackerFieldType = "text" | "textarea" | "number" | "boolean" | "date" | "dropdown";

type TrackerField = {
  id: string;
  label: string;
  type: TrackerFieldType;
  required?: boolean;
};

type TrackerSchema = {
  version?: number;
  fields?: TrackerField[];
};

type StatsResponse = {
  trackerId: string;
  trackerTitle: string;
  entryCount: number;
  lastEntryAt: string | null;
  fields: Record<string, {
    label: string;
    type: "number" | "dropdown" | "boolean" | "text" | "textarea" | "date";
    count?: number;
    latest?: number | null;
    sum?: number | null;
    avg?: number | null;
    min?: number | null;
    max?: number | null;
    trueCount?: number;
    falseCount?: number;
    topValues?: Array<{
      value: string;
      count: number;
    }>;
  }>;
  timeSeries: Record<string, Array<{
    date: string;
    value: number;
  }>>;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Helpers
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSchema(value: unknown): TrackerSchema {
  if (!isPlainObject(value)) {
    return { version: 1, fields: [] };
  }

  const fields = Array.isArray(value.fields) ? value.fields : [];

  return {
    version: typeof value.version === "number" ? value.version : 1,
    fields: fields.filter((field): field is TrackerField => {
      return (
        isPlainObject(field) &&
        typeof field.id === "string" &&
        typeof field.label === "string" &&
        typeof field.type === "string"
      );
    }),
  };
}

function getEntryFieldValue(data: unknown, fieldId: string): unknown {
  if (!isPlainObject(data)) {
    return undefined;
  }

  return data[fieldId];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function roundNumber(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Number(value.toFixed(2));
}

/**
 * GET
 */

export async function GET(_request: Request, context: RouteContext) {
  try {
    // 1) Require authenticated user
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Read tracker id from route params
    const { id } = await context.params;

    // 3) Load tracker and ensure it belongs to current user
    const tracker = await prisma.trackerItem.findFirst({
      where: {
        id,
        userId: user.id,
        type: 'tracker',
      },
      include: {
        entries: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            data: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tracker) {
      return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
    }

    // 4) Parse schema
    const schema = parseSchema(tracker.schema);

    // 5) Recalculate statistics from source-of-truth entries
    const calculated = calculateTrackerStatistics(schema, tracker.entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      data: isPlainObject(entry.data) ? entry.data : null,
    })))

    const stats: StatsResponse = {
      trackerId: tracker.id,
      trackerTitle: tracker.title,
      entryCount: tracker.entries.length,
      lastEntryAt:
        tracker.entries.length > 0
          ? tracker.entries[tracker.entries.length - 1].createdAt.toISOString()
          : null,
      fields: {},
      timeSeries: {},
    }

    for (const field of schema.fields ?? []) {
      const fieldStats = calculated.fields[field.id]

      if (!fieldStats) {
        continue
      }

      stats.fields[field.id] = {
        label: field.label,
        type: field.type,
        count: fieldStats.count,
        latest: fieldStats.latest,
        sum: fieldStats.sum,
        avg: fieldStats.avg,
        min: fieldStats.min,
        max: fieldStats.max,
        trueCount: fieldStats.trueCount,
        falseCount: fieldStats.falseCount,
        topValues: fieldStats.topValues,
      }

      if (fieldStats.timeSeries?.length) {
        stats.timeSeries[field.id] = fieldStats.timeSeries
      }
    }
    return NextResponse.json(stats);
  } catch (error) {
    console.error("GET /api/tracker/[id]/stats error:", error);

    return NextResponse.json(
      { error: "Failed to load tracker stats" },
      { status: 500 }
    );
  }
}
