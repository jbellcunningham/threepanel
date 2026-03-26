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

type NumericFieldStats = {
  label: string;
  type: "number";
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  latest: number | null;
};

type DropdownFieldStats = {
  label: string;
  type: "dropdown";
  count: number;
  topValues: Array<{
    value: string;
    count: number;
  }>;
};

type BooleanFieldStats = {
  label: string;
  type: "boolean";
  count: number;
  trueCount: number;
  falseCount: number;
};

type TrackerFieldStats = NumericFieldStats | DropdownFieldStats | BooleanFieldStats;

type TimeSeriesPoint = {
  date: string;
  value: number;
};

type TrackerTimeSeries = Record<string, TimeSeriesPoint[]>;

type StatsResponse = {
  trackerId: string;
  trackerTitle: string;
  entryCount: number;
  lastEntryAt: string | null;
  fields: Record<string, TrackerFieldStats>;
  timeSeries: TrackerTimeSeries;
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

    // 5) Build stats response
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
    };

    // 6) Compute stats by field type
    for (const field of schema.fields ?? []) {
      if (field.type === "number") {
        const numericValues = tracker.entries
          .map((entry) => getEntryFieldValue(entry.data, field.id))
          .map((value) => toNumber(value))
          .filter((value): value is number => value !== null);

        const latest = [...tracker.entries]
          .reverse()
          .map((entry) => toNumber(getEntryFieldValue(entry.data, field.id)))
          .find((value): value is number => value !== null);

        const count = numericValues.length;
        const sum = numericValues.reduce((total, value) => total + value, 0);

        stats.fields[field.id] = {
          label: field.label,
          type: "number",
          count,
          avg: count > 0 ? roundNumber(sum / count) : null,
          min: count > 0 ? roundNumber(Math.min(...numericValues)) : null,
          max: count > 0 ? roundNumber(Math.max(...numericValues)) : null,
          latest: latest !== undefined ? roundNumber(latest) : null,
        };

        // choose the first date field from the schema, if one exists
        // current behavior: first schema date field drives the series x-axis
        // fallback behavior: entry.createdAt when schema date is missing or invalid
        const dateField = (schema.fields ?? []).find((f) => f.type === "date") ?? null;
        const dateFieldId = dateField ? dateField.id : null;

	stats.timeSeries[field.id] = tracker.entries
	  .map((entry) => {
	    // Try date value from the entry's own data first (if a date field exists)
	    let pointDateIso: string;

      if (dateFieldId) {
        try {
          const rawDate = (entry.data as any)?.[dateFieldId]

          if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            pointDateIso = rawDate
          } else {
            const parsed = rawDate ? new Date(rawDate) : null

            if (parsed && !isNaN(parsed.getTime())) {
              pointDateIso = parsed.toISOString()
            } else {
              // fallback to createdAt if rawDate missing / invalid
              pointDateIso = entry.createdAt.toISOString()
            }
          }
        } catch {
          // In case of any unexpected shape, fallback to createdAt
          pointDateIso = entry.createdAt.toISOString()
        }
      } else {
        // No date field in schema — always use createdAt
        pointDateIso = entry.createdAt.toISOString()
      }

	    const numericValue = toNumber(getEntryFieldValue(entry.data, field.id));

	    if (numericValue === null) {
	      return null;
	    }

	    return {
	      date: pointDateIso,
	      value: numericValue,
              createdAt: entry.createdAt.toISOString(),
	    };
	  })
	  .filter((point): point is TimeSeriesPoint => point !== null)

	.sort((a, b) => {
	  const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();

	  if (dateDiff !== 0) {
	    return dateDiff;
	  }

	  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	})
	.map(({ date, value }) => ({
	  date,
	  value,
	}));
        continue;
      }

      if (field.type === "dropdown") {
        const values = tracker.entries
          .map((entry) => getEntryFieldValue(entry.data, field.id))
          .map((value) => toNonEmptyString(value))
          .filter((value): value is string => value !== null);

        const valueCounts = new Map<string, number>();

        for (const value of values) {
          valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
        }

        const topValues = Array.from(valueCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count;
            }

            return a.value.localeCompare(b.value);
          });

        stats.fields[field.id] = {
          label: field.label,
          type: "dropdown",
          count: values.length,
          topValues,
        };

        continue;
      }

      if (field.type === "boolean") {
        const booleanValues = tracker.entries
          .map((entry) => getEntryFieldValue(entry.data, field.id))
          .map((value) => toBoolean(value))
          .filter((value): value is boolean => value !== null);

        const trueCount = booleanValues.filter((value) => value === true).length;
        const falseCount = booleanValues.filter((value) => value === false).length;

        stats.fields[field.id] = {
          label: field.label,
          type: "boolean",
          count: booleanValues.length,
          trueCount,
          falseCount,
        };
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
