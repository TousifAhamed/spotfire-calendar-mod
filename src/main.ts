/*
 * Copyright © 2024. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import { renderCalendar, CalendarConfig, StylingInfo } from "./render";
import { parseCalendarData, CalendarDataPoint } from "./data";
import { getAvailableSchemes } from "./colorSchemes";

/**
 * Initialize the Spotfire Mod API and set up the read-render loop.
 */
Spotfire.initialize(async (mod: Spotfire.Mod) => {
    /**
     * Get the render context - must be called in the initialize callback
     * so Spotfire waits for render to complete during export.
     */
    const context = mod.getRenderContext();

    /**
     * Create a reader that listens to data, window size, and mod property changes.
     */
    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize(),
        mod.property<string>("colorScheme"),
        mod.property<string>("weekStart"),
        mod.property<boolean>("showMonthLabels"),
        mod.property<boolean>("showDayLabels"),
        mod.property<string>("customMinColor"),
        mod.property<string>("customMaxColor"),
        mod.property<string>("hiddenDays"),
        mod.property<boolean>("showWeekNumbers")
    );

    /**
     * Subscribe to changes and kick off the read-render loop.
     */
    reader.subscribe(render);

    /**
     * Main render function called whenever data or properties change.
     */
    async function render(
        dataView: Spotfire.DataView,
        windowSize: Spotfire.Size,
        colorSchemeProp: Spotfire.ModProperty<string>,
        weekStartProp: Spotfire.ModProperty<string>,
        showMonthLabelsProp: Spotfire.ModProperty<boolean>,
        showDayLabelsProp: Spotfire.ModProperty<boolean>,
        customMinColorProp: Spotfire.ModProperty<string>,
        customMaxColorProp: Spotfire.ModProperty<string>,
        hiddenDaysProp: Spotfire.ModProperty<string>,
        showWeekNumbersProp: Spotfire.ModProperty<boolean>
    ) {
        /**
         * Check for errors in the data view configuration.
         */
        const errors = await dataView.getErrors();
        if (errors.length > 0) {
            mod.controls.errorOverlay.show(errors);
            return;
        }
        mod.controls.errorOverlay.hide();

        /**
         * Validate we have a container element.
         */
        const container = document.querySelector<HTMLDivElement>("#mod-container");
        if (!container) {
            mod.controls.errorOverlay.show(
                "Failed to find the DOM node with id #mod-container."
            );
            return;
        }

        /**
         * Check row count to prevent excessive rendering.
         */
        const rowCount = await dataView.rowCount();
        if (rowCount === undefined) {
            // Data view has errors
            return;
        }

        const MAX_ROWS = 100000;
        if (rowCount > MAX_ROWS) {
            mod.controls.errorOverlay.show(
                `Too many data points (${rowCount}). Maximum supported: ${MAX_ROWS}.`
            );
            return;
        }

        /**
         * Get all data rows.
         */
        const allRows = await dataView.allRows();
        if (allRows == null) {
            // Data view has expired
            return;
        }

        /**
         * Check if marking is active and get marking info.
         */
        const hasMarkedRows = allRows.some(row => row.isMarked());

        /**
         * Parse the data rows into calendar data points.
         */
        const dataPoints: CalendarDataPoint[] = parseCalendarData(allRows);

        if (dataPoints.length === 0) {
            container.innerHTML = '<div class="no-data-message">No valid date data found. Ensure the Date axis has date values.</div>';
            context.signalRenderComplete();
            return;
        }

        /**
         * Extract styling information from the render context for Spotfire theme support.
         */
        const styling = context.styling;
        const generalStyling = styling.general;
        const scaleStyling = styling.scales;

        /**
         * Get background color - handle different API versions.
         * Newer API returns Color object with hexCode, older returns string.
         */
        const bgColorRaw = generalStyling.backgroundColor;
        const bgColor = typeof bgColorRaw === "string" 
            ? bgColorRaw 
            : (bgColorRaw as { hexCode: string }).hexCode || "#ffffff";
        const isDarkTheme = isColorDark(bgColor);

        /**
         * Get font color similarly.
         */
        const fontColorRaw = generalStyling.font.color;
        const fontColor = typeof fontColorRaw === "string"
            ? fontColorRaw
            : (fontColorRaw as { hexCode: string }).hexCode || "#333333";

        /**
         * Get line color from scale styling.
         */
        const lineColorRaw = scaleStyling.line.stroke;
        const lineColor = typeof lineColorRaw === "string"
            ? lineColorRaw
            : (lineColorRaw as { hexCode: string }).hexCode || "#666666";

        /**
         * Build styling info for the renderer.
         */
        const stylingInfo: StylingInfo = {
            backgroundColor: bgColor,
            fontFamily: generalStyling.font.fontFamily,
            fontSize: generalStyling.font.fontSize,
            fontColor: fontColor,
            isDarkTheme: isDarkTheme,
            lineColor: lineColor
        };

        /**
         * Build configuration from mod properties.
         */
        const hiddenDaysStr = hiddenDaysProp.value() || "";
        const hiddenDaysSet = new Set(
            hiddenDaysStr.split(",").map(s => s.trim()).filter(s => s.length > 0).map(Number)
        );

        const config: CalendarConfig = {
            width: windowSize.width,
            height: windowSize.height,
            colorScheme: colorSchemeProp.value() || "PiYG",
            weekStart: (weekStartProp.value() as "monday" | "sunday") || "sunday",
            showMonthLabels: showMonthLabelsProp.value() !== false,
            showDayLabels: showDayLabelsProp.value() !== false,
            hasMarkedRows: hasMarkedRows,
            customMinColor: customMinColorProp.value() || "",
            customMaxColor: customMaxColorProp.value() || "",
            hiddenDays: hiddenDaysSet,
            showWeekNumbers: showWeekNumbersProp.value() === true
        };

        /**
         * Render the calendar chart.
         */
        renderCalendar(container, dataPoints, config, stylingInfo, mod, dataView);

        /**
         * Render the settings gear icon.
         */
        renderSettingsButton(container, config, stylingInfo, {
            colorSchemeProp,
            weekStartProp,
            showMonthLabelsProp,
            showDayLabelsProp,
            customMinColorProp,
            customMaxColorProp,
            hiddenDaysProp,
            showWeekNumbersProp
        }, context.isEditing);

        /**
         * Signal that the mod is ready for export.
         */
        context.signalRenderComplete();
    }

    /**
     * Render the settings gear button (only visible in edit mode).
     */
    function renderSettingsButton(
        container: HTMLDivElement,
        config: CalendarConfig,
        styling: StylingInfo,
        props: {
            colorSchemeProp: Spotfire.ModProperty<string>;
            weekStartProp: Spotfire.ModProperty<string>;
            showMonthLabelsProp: Spotfire.ModProperty<boolean>;
            showDayLabelsProp: Spotfire.ModProperty<boolean>;
            customMinColorProp: Spotfire.ModProperty<string>;
            customMaxColorProp: Spotfire.ModProperty<string>;
            hiddenDaysProp: Spotfire.ModProperty<string>;
            showWeekNumbersProp: Spotfire.ModProperty<boolean>;
        },
        isEditing: boolean
    ) {
        // Remove any previous settings elements
        const oldBtn = container.querySelector(".settings-btn");
        if (oldBtn) oldBtn.remove();
        const oldPanel = container.querySelector(".settings-panel");
        if (oldPanel) oldPanel.remove();

        if (!isEditing) return;

        // --- Gear Button ---
        const btn = document.createElement("div");
        btn.className = "settings-btn";
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="${styling.fontColor}"><path d="M10 13a3 3 0 100-6 3 3 0 000 6zm7.93-2.49a1.09 1.09 0 00-.84-.5l-.43-.04a6.94 6.94 0 00-.56-1.35l.27-.33a1.09 1.09 0 00-.07-.98 8.03 8.03 0 00-1.07-1.07 1.09 1.09 0 00-.98-.07l-.33.27a6.94 6.94 0 00-1.35-.56l-.04-.43a1.09 1.09 0 00-.5-.84A8.08 8.08 0 0010 5c-.53 0-1.04.05-1.53.14a1.09 1.09 0 00-.5.84l-.04.43a6.94 6.94 0 00-1.35.56l-.33-.27a1.09 1.09 0 00-.98.07c-.4.3-.76.66-1.07 1.07a1.09 1.09 0 00-.07.98l.27.33a6.94 6.94 0 00-.56 1.35l-.43.04a1.09 1.09 0 00-.84.5A8.08 8.08 0 003 10c0 .53.05 1.04.14 1.53a1.09 1.09 0 00.84.5l.43.04c.13.48.32.93.56 1.35l-.27.33a1.09 1.09 0 00.07.98c.3.4.66.76 1.07 1.07.3.2.65.24.98.07l.33-.27c.42.24.87.43 1.35.56l.04.43c.05.38.24.7.5.84.49.09 1 .14 1.53.14s1.04-.05 1.53-.14c.26-.14.45-.46.5-.84l.04-.43c.48-.13.93-.32 1.35-.56l.33.27c.33.17.68.13.98-.07.4-.3.76-.66 1.07-1.07.2-.3.24-.65.07-.98l-.27-.33c.24-.42.43-.87.56-1.35l.43-.04c.38-.05.7-.24.84-.5.09-.49.14-1 .14-1.53s-.05-1.04-.14-1.53z"/></svg>`;
        btn.title = "Calendar Settings";
        container.appendChild(btn);

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const existingPanel = container.querySelector(".settings-panel");
            if (existingPanel) {
                existingPanel.remove();
                return;
            }
            openSettingsPanel(container, config, styling, props);
        });
    }

    /**
     * Open the settings panel with all configuration options.
     */
    function openSettingsPanel(
        container: HTMLDivElement,
        config: CalendarConfig,
        styling: StylingInfo,
        props: {
            colorSchemeProp: Spotfire.ModProperty<string>;
            weekStartProp: Spotfire.ModProperty<string>;
            showMonthLabelsProp: Spotfire.ModProperty<boolean>;
            showDayLabelsProp: Spotfire.ModProperty<boolean>;
            customMinColorProp: Spotfire.ModProperty<string>;
            customMaxColorProp: Spotfire.ModProperty<string>;
            hiddenDaysProp: Spotfire.ModProperty<string>;
            showWeekNumbersProp: Spotfire.ModProperty<boolean>;
        }
    ) {
        const panel = document.createElement("div");
        panel.className = "settings-panel";

        const containerWidth = Math.max(0, Math.floor(container.getBoundingClientRect().width));
        const maxPanelWidth = containerWidth > 0 ? Math.max(180, containerWidth - 40) : 320;
        const minPanelWidth = Math.min(260, maxPanelWidth);

        const bgColor = styling.isDarkTheme ? "#2d2d2d" : "#ffffff";
        const borderColor = styling.isDarkTheme ? "#555" : "#ccc";
        const textColor = styling.fontColor;
        panel.style.cssText = `
            position: absolute; top: 4px; right: 30px; z-index: 100;
            background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px;
            padding: 12px 16px; min-width: ${minPanelWidth}px; max-width: ${maxPanelWidth}px; box-sizing: border-box; max-height: 90vh; overflow-y: auto;
            font-family: ${styling.fontFamily}; font-size: 12px; color: ${textColor};
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        `;

        // Header
        const header = document.createElement("div");
        header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-weight:600; font-size:13px;";
        header.textContent = "Calendar Settings";
        const closeBtn = document.createElement("span");
        closeBtn.textContent = "\u2715";
        closeBtn.style.cssText = "cursor:pointer; font-size:14px; padding:2px 4px;";
        closeBtn.addEventListener("click", () => panel.remove());
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // ─── Section: Color Scheme ──────────────────────────────
        panel.appendChild(createSectionLabel("Color Scheme", textColor));

        const schemeSelect = document.createElement("select");
        schemeSelect.style.cssText = inputStyle(styling);
        const schemes = getAvailableSchemes();
        schemes.forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            if (name === config.colorScheme) opt.selected = true;
            schemeSelect.appendChild(opt);
        });
        schemeSelect.addEventListener("change", () => {
            props.colorSchemeProp.set(schemeSelect.value);
        });
        panel.appendChild(schemeSelect);

        // ─── Section: Custom Colors ────────────────────────────
        panel.appendChild(createSectionLabel("Custom Gradient Colors", textColor));
        panel.appendChild(createDescription("Set both to override the scheme above", styling));

        const colorRow = document.createElement("div");
        colorRow.style.cssText = "display:flex; gap:8px; align-items:center; margin-bottom:8px;";

        const minColorWrap = createColorPicker("Min", config.customMinColor || "#ffffff", (val) => {
            props.customMinColorProp.set(val);
        }, styling);
        const maxColorWrap = createColorPicker("Max", config.customMaxColor || "#ff0000", (val) => {
            props.customMaxColorProp.set(val);
        }, styling);
        colorRow.appendChild(minColorWrap);
        colorRow.appendChild(maxColorWrap);

        const clearColorsBtn = document.createElement("button");
        clearColorsBtn.textContent = "Clear";
        clearColorsBtn.style.cssText = `font-size:11px; padding:2px 8px; cursor:pointer; border:1px solid ${borderColor}; border-radius:3px; background:transparent; color:${textColor};`;
        clearColorsBtn.addEventListener("click", () => {
            props.customMinColorProp.set("");
            props.customMaxColorProp.set("");
        });
        colorRow.appendChild(clearColorsBtn);
        panel.appendChild(colorRow);

        // ─── Section: Display Options ──────────────────────────
        panel.appendChild(createSectionLabel("Display Options", textColor));

        panel.appendChild(createCheckbox("Show Month Labels", config.showMonthLabels, (v) => {
            props.showMonthLabelsProp.set(v);
        }, styling));

        panel.appendChild(createCheckbox("Show Day Labels", config.showDayLabels, (v) => {
            props.showDayLabelsProp.set(v);
        }, styling));

        panel.appendChild(createCheckbox("Show Week Numbers", config.showWeekNumbers, (v) => {
            props.showWeekNumbersProp.set(v);
        }, styling));

        // ─── Section: Week Start ───────────────────────────────
        panel.appendChild(createSectionLabel("Week Start", textColor));
        const weekSelect = document.createElement("select");
        weekSelect.style.cssText = inputStyle(styling);
        [["sunday", "Sunday"], ["monday", "Monday"]].forEach(([val, lbl]) => {
            const opt = document.createElement("option");
            opt.value = val;
            opt.textContent = lbl;
            if (val === config.weekStart) opt.selected = true;
            weekSelect.appendChild(opt);
        });
        weekSelect.addEventListener("change", () => {
            props.weekStartProp.set(weekSelect.value);
        });
        panel.appendChild(weekSelect);

        // ─── Section: Visible Days ─────────────────────────────
        panel.appendChild(createSectionLabel("Visible Days", textColor));
        panel.appendChild(createDescription("Uncheck days you want to hide", styling));

        const allDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        allDayNames.forEach((name, index) => {
            const isHidden = config.hiddenDays.has(index);
            panel.appendChild(createCheckbox(name, !isHidden, (checked) => {
                const currentHidden = new Set(config.hiddenDays);
                if (checked) {
                    currentHidden.delete(index);
                } else {
                    currentHidden.add(index);
                }
                const val = Array.from(currentHidden).sort().join(",");
                props.hiddenDaysProp.set(val);
            }, styling));
        });

        container.appendChild(panel);
    }

    /** Helper: section label */
    function createSectionLabel(text: string, color: string): HTMLDivElement {
        const el = document.createElement("div");
        el.textContent = text;
        el.style.cssText = `font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; margin:10px 0 4px; color:${color}; opacity:0.7;`;
        return el;
    }

    /** Helper: description text */
    function createDescription(text: string, styling: StylingInfo): HTMLDivElement {
        const el = document.createElement("div");
        el.textContent = text;
        el.style.cssText = `font-size:10px; color:${styling.fontColor}; opacity:0.5; margin-bottom:4px;`;
        return el;
    }

    /** Helper: input style string */
    function inputStyle(styling: StylingInfo): string {
        const bg = styling.isDarkTheme ? "#3a3a3a" : "#f5f5f5";
        const border = styling.isDarkTheme ? "#555" : "#ccc";
        return `width:100%; padding:4px 6px; font-size:12px; border:1px solid ${border}; border-radius:3px; background:${bg}; color:${styling.fontColor}; margin-bottom:8px; box-sizing:border-box;`;
    }

    /** Helper: checkbox with label */
    function createCheckbox(label: string, checked: boolean, onChange: (v: boolean) => void, styling: StylingInfo): HTMLDivElement {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor:pointer;";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = checked;
        cb.style.cssText = "cursor:pointer; margin:0;";
        cb.addEventListener("change", () => onChange(cb.checked));
        const lbl = document.createElement("label");
        lbl.textContent = label;
        lbl.style.cssText = `cursor:pointer; font-size:12px; color:${styling.fontColor};`;
        lbl.addEventListener("click", () => { cb.checked = !cb.checked; onChange(cb.checked); });
        row.appendChild(cb);
        row.appendChild(lbl);
        return row;
    }

    /** Helper: color picker with label */
    function createColorPicker(label: string, value: string, onChange: (v: string) => void, styling: StylingInfo): HTMLDivElement {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:2px;";
        const lbl = document.createElement("span");
        lbl.textContent = label;
        lbl.style.cssText = `font-size:10px; color:${styling.fontColor};`;
        const input = document.createElement("input");
        input.type = "color";
        input.value = value || "#ffffff";
        input.style.cssText = "width:36px; height:24px; border:none; cursor:pointer; padding:0;";
        input.addEventListener("input", () => onChange(input.value));
        wrap.appendChild(lbl);
        wrap.appendChild(input);
        return wrap;
    }

    /**
     * Determine if a hex color is dark based on luminance.
     * Used to detect if we're in dark theme mode.
     */
    function isColorDark(hexColor: string): boolean {
        // Remove # if present
        const hex = hexColor.replace("#", "");
        
        // Parse RGB values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Calculate relative luminance using sRGB
        // Formula from WCAG 2.0
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // If luminance < 0.5, it's a dark color
        return luminance < 0.5;
    }
});
