/*
 * Copyright © 2024. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

import * as d3 from "d3";

/**
 * Map of supported color scheme names to D3 interpolators.
 * Includes diverging, sequential, and single-hue schemes.
 */
const colorSchemeMap: Record<string, (t: number) => string> = {
    // Diverging
    PiYG: d3.interpolatePiYG,
    RdYlGn: d3.interpolateRdYlGn,
    RdBu: d3.interpolateRdBu,
    BrBG: d3.interpolateBrBG,
    PRGn: d3.interpolatePRGn,
    RdYlBu: d3.interpolateRdYlBu,
    Spectral: d3.interpolateSpectral,

    // Sequential (single hue)
    Blues: d3.interpolateBlues,
    Greens: d3.interpolateGreens,
    Oranges: d3.interpolateOranges,
    Reds: d3.interpolateReds,
    Purples: d3.interpolatePurples,
    Greys: d3.interpolateGreys,

    // Sequential (multi-hue)
    Viridis: d3.interpolateViridis,
    Inferno: d3.interpolateInferno,
    Magma: d3.interpolateMagma,
    Plasma: d3.interpolatePlasma,
    Turbo: d3.interpolateTurbo,
    YlGnBu: d3.interpolateYlGnBu,
    YlOrRd: d3.interpolateYlOrRd,
    BuGn: d3.interpolateBuGn,
    BuPu: d3.interpolateBuPu,
    GnBu: d3.interpolateGnBu,
    OrRd: d3.interpolateOrRd,
    PuBu: d3.interpolatePuBu,
    PuRd: d3.interpolatePuRd,
    RdPu: d3.interpolateRdPu,
    YlGn: d3.interpolateYlGn,
    YlOrBr: d3.interpolateYlOrBr,
};

/**
 * Get a D3 color interpolator by name.
 * Falls back to PiYG if the name is not recognized.
 */
export function getColorInterpolator(name: string): (t: number) => string {
    return colorSchemeMap[name] || d3.interpolatePiYG;
}

/**
 * Get the list of all available color scheme names.
 */
export function getAvailableSchemes(): string[] {
    return Object.keys(colorSchemeMap);
}
