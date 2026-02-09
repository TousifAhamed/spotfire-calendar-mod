/*
 * Copyright © 2024. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

/**
 * Calendar data point representing a single day with a value.
 */
export interface CalendarDataPoint {
    /** The date for this data point */
    date: Date;
    /** The numeric value for this date */
    value: number;
    /** A formatted string representation of the value */
    formattedValue: string;
    /** A formatted string representation of the date */
    formattedDate: string;
    /** Whether this row is marked/selected */
    isMarked: boolean;
    /** Reference to the original Spotfire DataViewRow for marking */
    row: Spotfire.DataViewRow;
    /** Color from the color axis if provided */
    color?: string;
}

/**
 * Parse Spotfire DataViewRows into CalendarDataPoint objects.
 * Attempts to extract a Date from the "Date" categorical axis and
 * a numeric value from the "Value" continuous axis.
 */
export function parseCalendarData(rows: Spotfire.DataViewRow[]): CalendarDataPoint[] {
    const dataPoints: CalendarDataPoint[] = [];

    for (const row of rows) {
        try {
            // Get the date value from the categorical "Date" axis
            const dateValue = row.categorical("Date");
            const dateStr = dateValue.formattedValue();

            // Try to parse the date from the formatted string
            const parsedDate = parseDate(dateStr);
            if (!parsedDate || isNaN(parsedDate.getTime())) {
                continue; // Skip rows without valid dates
            }

            // Get the numeric value from the continuous "Value" axis
            const continuousValue = row.continuous<number>("Value");
            const numericValue = continuousValue.value();
            if (numericValue == null || isNaN(numericValue)) {
                continue; // Skip rows without valid values
            }

            // Get color information if available
            let color: string | undefined;
            try {
                const colorInfo = row.color();
                color = colorInfo.hexCode;
            } catch {
                // Color axis may not be configured
            }

            dataPoints.push({
                date: parsedDate,
                value: numericValue,
                formattedValue: continuousValue.formattedValue(),
                formattedDate: dateStr,
                isMarked: row.isMarked(),
                row: row,
                color: color
            });
        } catch {
            // Skip rows that cause errors (e.g., misconfigured axes)
            continue;
        }
    }

    return dataPoints;
}

/**
 * Attempt to parse a date string in various common formats.
 */
function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.trim() === "") {
        return null;
    }

    // Try native Date parsing first
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d;
    }

    // Try common date formats
    // DD/MM/YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10) - 1;
        const year = parseInt(dmyMatch[3], 10);
        return new Date(year, month, day);
    }

    // YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        return new Date(year, month, day);
    }

    return null;
}
