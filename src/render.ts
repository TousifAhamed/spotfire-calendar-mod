/*
 * Copyright © 2024. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import * as d3 from "d3";
import { CalendarDataPoint } from "./data";
import { getColorInterpolator } from "./colorSchemes";

/**
 * Configuration for the calendar chart rendering.
 */
export interface CalendarConfig {
    /** Available width in pixels */
    width: number;
    /** Available height in pixels */
    height: number;
    /** D3 color scheme name (e.g., "PiYG", "RdYlGn", "Blues") */
    colorScheme: string;
    /** Start of the week: "monday" or "sunday" */
    weekStart: "monday" | "sunday";
    /** Whether to display month labels */
    showMonthLabels: boolean;
    /** Whether to display day-of-week labels */
    showDayLabels: boolean;
    /** Whether there are marked rows in the data */
    hasMarkedRows: boolean;
    /** Custom min color hex (empty string = use color scheme) */
    customMinColor: string;
    /** Custom max color hex (empty string = use color scheme) */
    customMaxColor: string;
    /** Set of day-of-week indices (0=Sun..6=Sat) to hide */
    hiddenDays: Set<number>;
    /** Whether to show ISO week numbers */
    showWeekNumbers: boolean;
}

/**
 * Styling information from Spotfire theme.
 */
export interface StylingInfo {
    /** Background color hex code */
    backgroundColor: string;
    /** Font family from Spotfire theme */
    fontFamily: string;
    /** Font size in pixels */
    fontSize: number;
    /** Font color from Spotfire theme */
    fontColor: string;
    /** Whether we're in dark theme mode */
    isDarkTheme: boolean;
    /** Line color for separators and borders */
    lineColor: string;
}

/**
 * Internal structure for a year group.
 */
interface YearGroup {
    year: number;
    dataMap: Map<string, CalendarDataPoint>;
}

/** Persistent SVG container */
const modContainer = d3.select("#mod-container");

/**
 * Main calendar rendering function.
 * Creates a GitHub-style / D3-style year-over-year calendar heatmap.
 */
export function renderCalendar(
    container: HTMLDivElement,
    data: CalendarDataPoint[],
    config: CalendarConfig,
    styling: StylingInfo,
    mod: Spotfire.Mod,
    dataView: Spotfire.DataView
): void {
    // ─── Layout constants (static) ─────────────────────────────────
    const yearLabelWidth = config.showDayLabels ? 45 : 10;
    const monthLabelHeight = config.showMonthLabels ? 18 : 0;
    const weekNumberHeight = config.showWeekNumbers ? 14 : 0;
    const topLabelHeight = monthLabelHeight + weekNumberHeight;
    const dayLabelWidth = config.showDayLabels ? 20 : 0;
    // Legend uses ~30px vertical space (12px bar + padding/margins)
    const legendHeight = 30;

    // Compute visible day indices (in week-order, not hidden)
    const allDayIndicesInOrder = config.weekStart === "monday"
        ? [1, 2, 3, 4, 5, 6, 0]  // Mon..Sun as JS day indices
        : [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat
    const visibleDayIndices = allDayIndicesInOrder.filter(d => !config.hiddenDays.has(d));
    const visibleDayCount = visibleDayIndices.length || 1; // Ensure at least 1 to avoid division by zero
    const weeksInYear = 53;

    // ─── Group data by year ────────────────────────────────────────
    const yearGroups = groupByYear(data);
    const yearCount = Math.max(1, yearGroups.length);

    // Compute cell dimensions - separate width and height for independent scaling
    const { cellWidth, cellHeight } = computeCellDimensions({
        width: config.width,
        height: config.height,
        weeksInYear,
        yearLabelWidth,
        dayLabelWidth,
        legendHeight,
        topLabelHeight,
        yearCount,
        visibleDayCount
    });

    // Cell padding scales with the smaller dimension
    const cellPadding = Math.max(0.5, Math.min(2, Math.min(cellWidth, cellHeight) * 0.1));

    const yearHeight = cellHeight * visibleDayCount + topLabelHeight + 8;
    const chartWidth = yearLabelWidth + dayLabelWidth + cellWidth * weeksInYear + 10;
    const totalHeight = yearCount * yearHeight + legendHeight + 10;

    // ─── Color scale ───────────────────────────────────────────────
    const allValues = data.map((d) => d.value);
    const colorScale = buildColorScale(allValues, config.colorScheme, data, config.customMinColor, config.customMaxColor);

    // ─── Clear and rebuild SVG ─────────────────────────────────────
    container.innerHTML = "";

    const svg = d3
        .select(container)
        .append("svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("width", config.width)
        .attr("height", config.height)
        .attr("viewBox", `0 0 ${config.width} ${config.height}`)
        .attr("style", `background-color: ${styling.backgroundColor}; font-family: ${styling.fontFamily}; display: block;`);
    
    // Main group (no offset - chart fills available space)
    const mainG = svg.append("g");

    // ─── Helper functions for week day count ───────────────────────
    const timeWeek = config.weekStart === "monday" ? d3.utcMonday : d3.utcSunday;

    // Map from JS day index (0=Sun..6=Sat) to the visible row position
    // Returns -1 if the day is hidden
    const dayRowMap = new Map<number, number>();
    visibleDayIndices.forEach((jsDay, row) => {
        dayRowMap.set(jsDay, row);
    });

    const countDay = (jsDayIndex: number): number => {
        const row = dayRowMap.get(jsDayIndex);
        return row !== undefined ? row : -1;
    };

    const allDayLabels =
        config.weekStart === "monday"
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Filtered day labels for visible days only
    const visibleDayLabels = visibleDayIndices.map(jsDay => {
        const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return names[jsDay];
    });

    const formatMonth = d3.utcFormat("%b");

    // ─── Render each year ──────────────────────────────────────────
    yearGroups.forEach((yearGroup, yi) => {
        const yearG = mainG
            .append("g")
            .attr("transform", `translate(${yearLabelWidth}, ${yi * yearHeight + legendHeight + 5})`);

        // Year label
        yearG
            .append("text")
            .attr("class", "year-label")
            .attr("x", -yearLabelWidth + 4)
            .attr("y", topLabelHeight + (visibleDayCount * cellHeight) / 2)
            .attr("dy", "0.35em")
            .attr("font-size", `${styling.fontSize}px`)
            .attr("fill", styling.fontColor)
            .text(yearGroup.year.toString());

        // Day-of-week labels (only visible days)
        if (config.showDayLabels) {
            const dayLabelG = yearG.append("g").attr("class", "day-labels");
            visibleDayLabels.forEach((label, vi) => {
                // Show every other for compactness, but if few days show all
                if (visibleDayCount <= 5 || vi % 2 === 0) {
                    dayLabelG
                        .append("text")
                        .attr("class", "day-label")
                        .attr("x", dayLabelWidth - 4)
                        .attr("y", topLabelHeight + vi * cellHeight + cellHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "end")
                        .attr("fill", styling.fontColor)
                        .attr("font-size", `${Math.max(9, styling.fontSize - 2)}px`)
                        .text(label);
                }
            });
        }

        // Calendar cells group
        const cellsG = yearG
            .append("g")
            .attr("transform", `translate(${dayLabelWidth}, ${topLabelHeight})`);

        // Generate all days for this year
        const yearStart = new Date(Date.UTC(yearGroup.year, 0, 1));
        const yearEnd = new Date(Date.UTC(yearGroup.year, 11, 31));
        const allDaysRaw = d3.utcDays(yearStart, d3.utcDay.offset(yearEnd, 1));

        // Filter out hidden days
        const allDays = allDaysRaw.filter(d => !config.hiddenDays.has(d.getUTCDay()));

        // Render cells
        const cells = cellsG
            .selectAll("rect")
            .data(allDays)
            .enter()
            .append("rect")
            .attr("class", (d) => {
                const key = dateKey(d);
                const dp = yearGroup.dataMap.get(key);
                let cls = "calendar-cell";
                if (!dp) cls += " empty";
                if (dp && config.hasMarkedRows && dp.isMarked) cls += " marked";
                if (dp && config.hasMarkedRows && !dp.isMarked) cls += " dimmed";
                return cls;
            })
            .attr("width", Math.max(1, cellWidth - cellPadding))
            .attr("height", Math.max(1, cellHeight - cellPadding))
            .attr("x", (d) => timeWeek.count(d3.utcYear(d), d) * cellWidth)
            .attr("y", (d) => countDay(d.getUTCDay()) * cellHeight)
            .attr("rx", 2)
            .attr("ry", 2)
            .attr("fill", (d) => {
                const key = dateKey(d);
                const dp = yearGroup.dataMap.get(key);
                if (!dp) return styling.isDarkTheme ? "#333" : "#eee";
                if (dp.color) return dp.color;
                return colorScale(dp.value);
            })
            .on("click", function (_event: MouseEvent, d: Date) {
                const key = dateKey(d);
                const dp = yearGroup.dataMap.get(key);
                if (dp) {
                    dp.row.mark(_event.ctrlKey ? "Toggle" : "Replace");
                }
            })
            .on("mouseenter", function (_event: MouseEvent, d: Date) {
                const key = dateKey(d);
                const dp = yearGroup.dataMap.get(key);
                if (dp) {
                    mod.controls.tooltip.show(buildTooltipContent(dp));
                }
            })
            .on("mouseleave", function () {
                mod.controls.tooltip.hide();
            });

        // ─── Drag-to-select (rectangular selection) ─────────────────
        let dragStartPoint: { x: number; y: number } | null = null;
        let selectionRect: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;

        cellsG
            .on("mousedown", function (event: MouseEvent) {
                // Only start drag on left mouse button, not on individual cell clicks
                if (event.button !== 0) return;
                const [mx, my] = d3.pointer(event);
                dragStartPoint = { x: mx, y: my };

                // Create selection rectangle overlay
                selectionRect = cellsG
                    .append("rect")
                    .attr("class", "selection-rect")
                    .attr("x", mx)
                    .attr("y", my)
                    .attr("width", 0)
                    .attr("height", 0)
                    .attr("fill", styling.isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,100,200,0.15)")
                    .attr("stroke", styling.isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,100,200,0.5)")
                    .attr("stroke-width", 1)
                    .attr("pointer-events", "none");
            })
            .on("mousemove", function (event: MouseEvent) {
                if (!dragStartPoint || !selectionRect) return;
                const [mx, my] = d3.pointer(event);
                const x = Math.min(dragStartPoint.x, mx);
                const y = Math.min(dragStartPoint.y, my);
                const w = Math.abs(mx - dragStartPoint.x);
                const h = Math.abs(my - dragStartPoint.y);
                selectionRect
                    .attr("x", x)
                    .attr("y", y)
                    .attr("width", w)
                    .attr("height", h);
            })
            .on("mouseup", function (event: MouseEvent) {
                if (!dragStartPoint || !selectionRect) return;
                const [mx, my] = d3.pointer(event);
                const x1 = Math.min(dragStartPoint.x, mx);
                const y1 = Math.min(dragStartPoint.y, my);
                const x2 = Math.max(dragStartPoint.x, mx);
                const y2 = Math.max(dragStartPoint.y, my);

                // Only treat as drag selection if the rectangle is meaningful (> 5px)
                if (x2 - x1 > 5 || y2 - y1 > 5) {
                    // Find all cells within the selection rectangle
                    const rowsToMark: Spotfire.DataViewRow[] = [];
                    cells.each(function (d: Date) {
                        const cx = timeWeek.count(d3.utcYear(d), d) * cellWidth;
                        const cy = countDay(d.getUTCDay()) * cellHeight;
                        const cellCenterX = cx + (cellWidth - cellPadding) / 2;
                        const cellCenterY = cy + (cellHeight - cellPadding) / 2;
                        if (cellCenterX >= x1 && cellCenterX <= x2 && cellCenterY >= y1 && cellCenterY <= y2) {
                            const key = dateKey(d);
                            const dp = yearGroup.dataMap.get(key);
                            if (dp) {
                                rowsToMark.push(dp.row);
                            }
                        }
                    });

                    if (rowsToMark.length > 0) {
                        // Mark all selected rows; use Ctrl for additive selection
                        const markMode = event.ctrlKey ? "Toggle" : "Replace";
                        for (const row of rowsToMark) {
                            row.mark(markMode);
                        }
                    }
                }

                // Clean up
                selectionRect.remove();
                selectionRect = null;
                dragStartPoint = null;
            })
            .on("mouseleave.drag", function () {
                // Cancel drag if mouse leaves the cells area
                if (selectionRect) {
                    selectionRect.remove();
                    selectionRect = null;
                    dragStartPoint = null;
                }
            });

        // Month outlines / separators
        const monthsInYear = d3.utcMonths(
            new Date(Date.UTC(yearGroup.year, 0, 1)),
            new Date(Date.UTC(yearGroup.year + 1, 0, 1))
        );

        cellsG
            .selectAll(".month-path")
            .data(monthsInYear)
            .enter()
            .append("path")
            .attr("class", "month-path")
            .attr("stroke", styling.lineColor)
            .attr("d", (t) => pathMonth(t, cellWidth, cellHeight, visibleDayCount, countDay, timeWeek, visibleDayIndices));

        // Month labels along the top
        if (config.showMonthLabels) {
            const monthLabelG = yearG
                .append("g")
                .attr("transform", `translate(${dayLabelWidth}, 0)`);

            monthsInYear.forEach((monthDate) => {
                const weekOffset = timeWeek.count(d3.utcYear(monthDate), monthDate);
                monthLabelG
                    .append("text")
                    .attr("class", "month-label")
                    .attr("x", weekOffset * cellWidth + 2)
                    .attr("y", monthLabelHeight - 4)
                    .attr("fill", styling.fontColor)
                    .attr("font-size", `${Math.max(9, styling.fontSize - 2)}px`)
                    .text(formatMonth(monthDate));
            });
        }

        // Week numbers below month labels (above cells)
        if (config.showWeekNumbers) {
            const weekNumG = yearG
                .append("g")
                .attr("transform", `translate(${dayLabelWidth}, ${monthLabelHeight})`);

            // Gather unique week offsets for the year
            const yearStartDate = new Date(Date.UTC(yearGroup.year, 0, 1));
            const yearEndDate = new Date(Date.UTC(yearGroup.year, 11, 31));
            const weeksSet = new Set<number>();
            const weekDates = new Map<number, Date>();

            d3.utcDays(yearStartDate, d3.utcDay.offset(yearEndDate, 1)).forEach(day => {
                const w = timeWeek.count(d3.utcYear(day), day);
                if (!weeksSet.has(w)) {
                    weeksSet.add(w);
                    weekDates.set(w, day);
                }
            });

            weeksSet.forEach(w => {
                const sampleDate = weekDates.get(w)!;
                const isoWeek = getISOWeekNumber(sampleDate);
                weekNumG
                    .append("text")
                    .attr("class", "week-number")
                    .attr("x", w * cellWidth + (cellWidth - cellPadding) / 2)
                    .attr("y", weekNumberHeight - 2)
                    .attr("text-anchor", "middle")
                    .attr("fill", styling.fontColor)
                    .attr("font-size", `${Math.max(7, styling.fontSize - 4)}px`)
                    .attr("opacity", 0.5)
                    .text(isoWeek.toString());
            });
        }
    });

    // ─── Color Legend ──────────────────────────────────────────────
    renderLegend(mainG, allValues, colorScale, config, chartWidth, data, styling);

    // ─── Background click to clear marking ─────────────────────────
    svg.on("click", function (event: MouseEvent) {
        if ((event.target as Element).tagName === "svg") {
            dataView.clearMarking();
        }
    });
}

/**
 * Compute optimal cell dimensions based on available window dimensions.
 * Returns separate width and height to allow cells to stretch independently.
 */
function computeCellDimensions(args: {
    width: number;
    height: number;
    weeksInYear: number;
    yearLabelWidth: number;
    dayLabelWidth: number;
    legendHeight: number;
    topLabelHeight: number;
    yearCount: number;
    visibleDayCount: number;
}): { cellWidth: number; cellHeight: number } {
    const {
        width,
        height,
        weeksInYear,
        yearLabelWidth,
        dayLabelWidth,
        legendHeight,
        topLabelHeight,
        yearCount,
        visibleDayCount
    } = args;

    const minCell = 1;
    const maxCell = 100;

    const rightPadding = 10;
    const verticalPadding = 10;
    const perYearFixed = topLabelHeight + 8;

    // Calculate cell width to fill available horizontal space
    const availableWidth = width - yearLabelWidth - dayLabelWidth - rightPadding;
    let cellWidth = (Number.isFinite(availableWidth) && availableWidth > 0)
        ? ((availableWidth - 2) / weeksInYear)
        : maxCell;
    cellWidth = Math.max(minCell, Math.min(maxCell, cellWidth));
    if (!Number.isFinite(cellWidth)) cellWidth = minCell;

    // Calculate cell height to fill available vertical space
    const availableHeight = height - legendHeight - verticalPadding;
    let cellHeight = (Number.isFinite(availableHeight) && availableHeight > 0 && visibleDayCount > 0)
        ? (((availableHeight - 2) / Math.max(1, yearCount) - perYearFixed) / visibleDayCount)
        : maxCell;
    cellHeight = Math.max(minCell, Math.min(maxCell, cellHeight));
    if (!Number.isFinite(cellHeight)) cellHeight = minCell;

    return { cellWidth, cellHeight };
}

/**
 * Group data points by year, sorted in reverse chronological order.
 */
function groupByYear(data: CalendarDataPoint[]): YearGroup[] {
    const groupMap = new Map<number, Map<string, CalendarDataPoint>>();

    for (const dp of data) {
        const year = dp.date.getUTCFullYear();
        if (!groupMap.has(year)) {
            groupMap.set(year, new Map());
        }
        const yearMap = groupMap.get(year)!;
        const key = dateKey(dp.date);
        // If multiple values for the same day, keep the last one
        yearMap.set(key, dp);
    }

    const groups: YearGroup[] = [];
    for (const [year, dataMap] of groupMap) {
        groups.push({ year, dataMap });
    }

    // Sort years in reverse chronological order (newest first)
    groups.sort((a, b) => b.year - a.year);
    return groups;
}

/**
 * Create a unique key for a date (YYYY-MM-DD).
 */
function dateKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Build a color scale for the data values.
 * Uses a diverging scale if values span both positive and negative,
 * otherwise uses a sequential scale.
 */
function buildColorScale(
    values: number[],
    schemeName: string,
    data: CalendarDataPoint[],
    customMinColor: string,
    customMaxColor: string
): (value: number) => string {
    // If all data points have explicit colors from the color axis, use those
    if (data.every((d) => d.color != null)) {
        return (_value: number) => "#ccc"; // Fallback; actual color used from data point
    }

    const extent = d3.extent(values) as [number, number];
    const [minVal, maxVal] = extent;

    // If custom colors are provided, use a linear RGB interpolation
    if (customMinColor && customMaxColor) {
        const scale = d3.scaleLinear<string>()
            .domain([minVal, maxVal])
            .range([customMinColor, customMaxColor])
            .interpolate(d3.interpolateRgb);
        return (value: number) => scale(value);
    }

    const interpolator = getColorInterpolator(schemeName);

    // Check if we have both positive and negative values (diverging)
    if (minVal < 0 && maxVal > 0) {
        const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
        return d3.scaleSequential(interpolator).domain([-absMax, absMax]) as unknown as (value: number) => string;
    }

    // Sequential scale
    return d3.scaleSequential(interpolator).domain([minVal, maxVal]) as unknown as (value: number) => string;
}

/**
 * Draw the month separator path (thin line to the left of each month).
 * Based on the D3 calendar example approach.
 */
function pathMonth(
    t: Date,
    cellWidth: number,
    cellHeight: number,
    visibleDayCount: number,
    countDay: (i: number) => number,
    timeWeek: d3.CountableTimeInterval,
    visibleDayIndices: number[]
): string {
    const d = countDay(t.getUTCDay());
    const w = timeWeek.count(d3.utcYear(t), t);

    // If the day is hidden or at position 0, draw a simple vertical line
    if (d <= 0) {
        return `M${w * cellWidth},0V${visibleDayCount * cellHeight}`;
    }

    return `M${(w + 1) * cellWidth},0V${d * cellHeight}H${w * cellWidth}V${visibleDayCount * cellHeight}`;
}

/**
 * Get ISO 8601 week number for a UTC date.
 */
function getISOWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Set to nearest Thursday (ISO weeks start on Monday, week 1 contains Jan 4)
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
}

/**
 * Build tooltip content string for a data point.
 */
function buildTooltipContent(dp: CalendarDataPoint): string {
    return `${dp.formattedDate}\nValue: ${dp.formattedValue}`;
}

/**
 * Render a color legend at the top of the chart.
 */
function renderLegend(
    svg: d3.Selection<SVGGElement | SVGSVGElement, unknown, null, undefined>,
    values: number[],
    colorScale: (value: number) => string,
    config: CalendarConfig,
    chartWidth: number,
    data: CalendarDataPoint[],
    styling: StylingInfo
): void {
    // Skip legend if color axis provides explicit colors
    if (data.every((d) => d.color != null)) {
        return;
    }

    const legendWidth = Math.max(120, Math.min(200, Math.floor(config.width - 40)));
    const legendHeight = 12;
    // Center legend based on chart width (not container width, since mainG is centered)
    const legendX = (chartWidth - legendWidth) / 2;
    const legendY = 4;

    const legendG = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`);

    // Create gradient definition
    const defs = svg.append("defs");
    const gradientId = "calendar-legend-gradient";
    const gradient = defs
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%");

    const extent = d3.extent(values) as [number, number];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const val = extent[0] + t * (extent[1] - extent[0]);
        gradient
            .append("stop")
            .attr("offset", `${t * 100}%`)
            .attr("stop-color", colorScale(val));
    }

    // Legend bar
    legendG
        .append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("fill", `url(#${gradientId})`);

    // Min label
    legendG
        .append("text")
        .attr("x", -4)
        .attr("y", legendHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", `${Math.max(9, styling.fontSize - 2)}px`)
        .attr("fill", styling.fontColor)
        .text(formatValue(extent[0]));

    // Max label
    legendG
        .append("text")
        .attr("x", legendWidth + 4)
        .attr("y", legendHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .attr("font-size", `${Math.max(9, styling.fontSize - 2)}px`)
        .attr("fill", styling.fontColor)
        .text(formatValue(extent[1]));
}

/**
 * Format a number for legend display.
 */
function formatValue(val: number): string {
    if (Math.abs(val) >= 1000000) {
        return d3.format(".2s")(val);
    }
    if (Math.abs(val) >= 100) {
        return d3.format(",.0f")(val);
    }
    if (Math.abs(val) < 0.01) {
        return d3.format(".2e")(val);
    }
    return d3.format(".2f")(val);
}
