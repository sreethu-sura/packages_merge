import type { StaticCanvasAppState, AppState } from "../types";

import type { StaticCanvasRenderConfig } from "../scene/types";

import { THEME, THEME_FILTER } from "../constants";
import { COORDINATE_SCALE } from "../utils";

export const fillCircle = (
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke = true,
) => {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  if (stroke) {
    context.stroke();
  }
};

export const getNormalizedCanvasDimensions = (
  canvas: HTMLCanvasElement,
  scale: number,
): [number, number] => {
  // When doing calculations based on canvas width we should used normalized one
  return [canvas.width / scale, canvas.height / scale];
};

export const bootstrapCanvas = ({
  canvas,
  scale,
  normalizedWidth,
  normalizedHeight,
  theme,
  isExporting,
  viewBackgroundColor,
  insertModeEnabled,
}: {
  canvas: HTMLCanvasElement;
  scale: number;
  normalizedWidth: number;
  normalizedHeight: number;
  theme?: AppState["theme"];
  isExporting?: StaticCanvasRenderConfig["isExporting"];
  viewBackgroundColor?: StaticCanvasAppState["viewBackgroundColor"];
  insertModeEnabled?: boolean;
}): CanvasRenderingContext2D => {
  const context = canvas.getContext("2d")!;

  context.setTransform(1, 0, 0, 1, 0, 0);
  
  // Apply scale
  context.scale(scale, scale);
  
  // Remove the Y-axis flip for now - let's revert to default canvas coordinates
  // to fix the invisible elements issue
  // context.scale(1, -1);
  // context.translate(0, -normalizedHeight);

  if (isExporting && theme === THEME.DARK) {
    context.filter = THEME_FILTER;
  }
  
  // Always clear the entire canvas to prevent ghost impressions
  context.clearRect(0, 0, normalizedWidth, normalizedHeight);

  // Paint background
  if (typeof viewBackgroundColor === "string") {
    context.save();
    
    // Apply a subtle tint when in insert mode
    if (insertModeEnabled) {
      // Create a light blue tint for insert mode
      context.fillStyle = viewBackgroundColor === "transparent" 
        ? "rgba(200, 225, 255, 0.15)" // If transparent, add a light blue
        : addColorTint(viewBackgroundColor, "rgba(200, 225, 255, 0.15)");
    } else {
      context.fillStyle = viewBackgroundColor;
    }
    
    context.fillRect(0, 0, normalizedWidth, normalizedHeight);
    context.restore();
  }

  return context;
};

// Helper function to add a tint to a base color
const addColorTint = (baseColor: string, tintColor: string): string => {
  // For simplicity, we're just adding a light blue tint
  // A more complex implementation could blend the colors
  return tintColor;
}
