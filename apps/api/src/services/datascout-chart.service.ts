import { prisma } from "../lib/prisma";

export type ChartType = "bar" | "line" | "pie" | "radar";

export interface ExtractedDataset {
  title: string;
  headers: string[];
  rows: Record<string, string | number>[];
  numericColumns: string[];
  categoryColumn: string;
  units?: string;
}

export interface ColumnStatistics {
  columnName: string;
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
}

export interface ChartSpec {
  chartId: string;
  sessionId?: string;
  title: string;
  chartType: ChartType;
  xAxisKey: string;
  yAxisKeys: string[];
  units?: string;
  data: Record<string, string | number>[];
  statistics: ColumnStatistics[];
}

export class DataScoutService {
  /**
   * Parses raw text, Markdown tables, or CSV data into a structured dataset.
   */
  public static extractTabularData(text: string, datasetTitle?: string): ExtractedDataset {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    
    // 1. Try parsing Markdown Table syntax (| Header 1 | Header 2 |)
    const tableLines = lines.filter((l) => l.startsWith("|") && l.endsWith("|"));
    if (tableLines.length >= 2) {
      const headerLine = tableLines[0];
      const headers = headerLine
        .split("|")
        .slice(1, -1)
        .map((h) => h.trim());

      const dataLines = tableLines.slice(1).filter((l) => !/^\|[\s:\|-]+\|$/.test(l));

      const rows: Record<string, string | number>[] = [];
      dataLines.forEach((line) => {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());

        if (cells.length === headers.length) {
          const rowObj: Record<string, string | number> = {};
          headers.forEach((header, idx) => {
            const rawVal = cells[idx];
            const numVal = parseFloat(rawVal.replace(/[^0-9.-]/g, ""));
            rowObj[header] = !isNaN(numVal) && /^[\$€£%]?\s*-?\d+(?:\.\d+)?%?\s*$/.test(rawVal) ? numVal : rawVal;
          });
          rows.push(rowObj);
        }
      });

      if (rows.length > 0) {
        return this.buildDatasetFromRows(datasetTitle || "Extracted Table Dataset", headers, rows);
      }
    }

    // 2. Try CSV syntax (Comma/Tab separated lines with numbers)
    const csvLines = lines.filter((l) => l.includes(",") || l.includes("\t"));
    if (csvLines.length >= 2) {
      const delimiter = csvLines[0].includes("\t") ? "\t" : ",";
      const headers = csvLines[0].split(delimiter).map((h) => h.trim());
      const rows: Record<string, string | number>[] = [];

      csvLines.slice(1).forEach((line) => {
        const cells = line.split(delimiter).map((c) => c.trim());
        if (cells.length === headers.length) {
          const rowObj: Record<string, string | number> = {};
          headers.forEach((header, idx) => {
            const rawVal = cells[idx];
            const numVal = parseFloat(rawVal.replace(/[^0-9.-]/g, ""));
            rowObj[header] = !isNaN(numVal) && /^[\$€£%]?\s*-?\d+(?:\.\d+)?%?\s*$/.test(rawVal) ? numVal : rawVal;
          });
          rows.push(rowObj);
        }
      });

      if (rows.length > 0) {
        return this.buildDatasetFromRows(datasetTitle || "Extracted CSV Dataset", headers, rows);
      }
    }

    // 3. Fallback: Key-Value numerical pairs parsing ("Category: 12.5")
    const kvPairs: Record<string, string | number>[] = [];
    const kvRegex = /^([A-Za-z0-9\s_-]+)[:=]\s*([\$€£%]?\s*-?\d+(?:\.\d+)?%?)$/;
    lines.forEach((line) => {
      const match = line.match(kvRegex);
      if (match) {
        const key = match[1].trim();
        const numVal = parseFloat(match[2].replace(/[^0-9.-]/g, ""));
        if (!isNaN(numVal)) {
          kvPairs.push({ Label: key, Value: numVal });
        }
      }
    });

    if (kvPairs.length > 0) {
      return this.buildDatasetFromRows(datasetTitle || "Extracted Series Dataset", ["Label", "Value"], kvPairs);
    }

    // Default empty fallback dataset
    return {
      title: datasetTitle || "Empty Dataset",
      headers: ["Category", "Value"],
      rows: [],
      numericColumns: [],
      categoryColumn: "Category",
    };
  }

  /**
   * Constructs an ExtractedDataset helper identifying category vs numeric columns.
   */
  private static buildDatasetFromRows(
    title: string,
    headers: string[],
    rows: Record<string, string | number>[]
  ): ExtractedDataset {
    const numericColumns: string[] = [];
    let categoryColumn = headers[0];

    headers.forEach((header) => {
      const isNumeric = rows.length > 0 && rows.every((r) => typeof r[header] === "number");
      if (isNumeric) {
        numericColumns.push(header);
      } else {
        categoryColumn = header;
      }
    });

    // Extract unit hint from column header (e.g., "Revenue ($M)" -> "$M", "Growth (%)" -> "%")
    let units: string | undefined;
    const unitMatch = headers.join(" ").match(/\(([^)]+)\)/);
    if (unitMatch) {
      units = unitMatch[1];
    }

    return {
      title,
      headers,
      rows,
      numericColumns,
      categoryColumn,
      units,
    };
  }

  /**
   * Computes statistical summary metrics for a numerical column.
   */
  public static computeStatistics(columnName: string, values: number[]): ColumnStatistics {
    if (values.length === 0) {
      return { columnName, count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = Math.round((sum / count) * 100) / 100;

    let median = 0;
    const mid = Math.floor(count / 2);
    if (count % 2 === 0) {
      median = Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
    } else {
      median = sorted[mid];
    }
    const min = sorted[0];
    const max = sorted[count - 1];

    return { columnName, count, sum: Math.round(sum * 100) / 100, mean, median, min, max };
  }

  /**
   * Generates a declarative chart specification from raw text or structured dataset.
   */
  public static generateChartSpec(
    textOrDataset: string | ExtractedDataset,
    preferredType?: ChartType,
    title?: string,
    sessionId?: string
  ): ChartSpec {
    const dataset =
      typeof textOrDataset === "string"
        ? this.extractTabularData(textOrDataset, title)
        : textOrDataset;

    const chartType: ChartType = preferredType || (dataset.rows.length <= 5 ? "pie" : "bar");
    const xAxisKey = dataset.categoryColumn;
    const yAxisKeys = dataset.numericColumns.length > 0 ? dataset.numericColumns : ["Value"];

    const statistics: ColumnStatistics[] = yAxisKeys.map((col) => {
      const numbers = dataset.rows.map((r) => r[col]).filter((v): v is number => typeof v === "number");
      return this.computeStatistics(col, numbers);
    });

    const chartId = `chart-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      chartId,
      sessionId,
      title: title || dataset.title,
      chartType,
      xAxisKey,
      yAxisKeys,
      units: dataset.units,
      data: dataset.rows,
      statistics,
    };
  }

  /**
   * Scans a research session's evidence items, extracting tabular data and persisting chart specs in report/evidence metadata.
   */
  public static async processSessionCharts(sessionId: string, userId: string): Promise<ChartSpec[]> {
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { evidence: true },
    });

    if (!session || session.userId !== userId) {
      throw new Error(`Research session with ID '${sessionId}' not found.`);
    }

    const charts: ChartSpec[] = [];

    for (const item of session.evidence) {
      const dataset = this.extractTabularData(item.content, `Evidence Data (${item.id.slice(0, 8)})`);
      if (dataset.rows.length > 0 && dataset.numericColumns.length > 0) {
        const spec = this.generateChartSpec(dataset, "bar", dataset.title, sessionId);
        charts.push(spec);

        // Store chart spec into Evidence metadata
        await prisma.evidence.update({
          where: { id: item.id },
          data: {
            metadata: {
              ...(item.metadata as any),
              chartSpec: spec as any,
            },
          },
        });
      }
    }

    return charts;
  }
}
