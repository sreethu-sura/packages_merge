import type { ExcalidrawElement} from "../element/types";
import { FontFamilyValues } from "../element/types";
import type { AppState, BinaryFiles, UIAppState } from "../types";
import jsPDF from "jspdf";
// Import svg plugin
import { svg2pdf } from "svg2pdf.js";
import { exportToSvg } from "../scene/export";
import { FONT_FAMILY } from "../constants";

/**
 * Exports the selected elements to a PDF file.
 * If a frame is selected, only elements within that frame will be exported.
 * Uses SVG as an intermediate step for better rendering quality.
 */
export const exportToPdf = async (
    elements: readonly ExcalidrawElement[],
    appState: UIAppState & { exportingFrame?: AppState["exportingFrame"] },
    files: BinaryFiles,
): Promise<Blob> => {
    try {
        const frame = appState.exportingFrame;
        console.log("Export PDF - frame:", frame ? frame.id : "none");
        
        // Create PDF with the frame dimensions or canvas dimensions
        const pdfFormat = frame 
            ? [frame.width, frame.height]
            : [appState.width, appState.height];
        
        console.log("PDF dimensions (px):", pdfFormat);
        
        // Determine orientation based on whether width > height
        const orientation = pdfFormat[0] > pdfFormat[1] ? "landscape" : "portrait";
        console.log("PDF orientation:", orientation);
        
        // Convert px to mm (approx 0.264583 mm per pixel)
        const PX_TO_MM = 0.264583;
        const pdfWidth = pdfFormat[0] * PX_TO_MM;
        const pdfHeight = pdfFormat[1] * PX_TO_MM;
        
        console.log("PDF dimensions (mm):", [pdfWidth, pdfHeight]);
        
        // Create a new PDF document
        const pdf = new jsPDF({
            orientation: orientation,
            unit: "mm",
            format: [pdfWidth, pdfHeight],
            putOnlyUsedFonts: true,
            compress: true
        });

        if (!elements.length) {
            console.log("Export PDF - No elements to export");
            return pdf.output("blob");
        }

        console.log("Export PDF - Total elements:", elements.length);

        // First export to SVG for better quality
        const svgElement = await exportToSvg(
            elements,
            {
                exportBackground: appState.exportBackground,
                exportWithDarkMode: appState.exportWithDarkMode,
                viewBackgroundColor: appState.viewBackgroundColor,
                exportEmbedScene: false,
                exportScale: 1,
            },
            files,
            {
                exportingFrame: frame || null,
                renderEmbeddables: true,
            }
        );

        console.log("Successfully generated SVG, converting to PDF...");
        
        // Standard fonts like Helvetica and Courier are already included in PDF by default
        // and don't need to be explicitly added with addFont
        
        // Before conversion, modify SVG to use standard PDF fonts
        replaceCustomFontsInSvg(svgElement);
        
        // Use svg2pdf.js to convert SVG directly to PDF
        await svg2pdf(svgElement, pdf, {
            width: pdfWidth,
            height: pdfHeight,
            x: 0,
            y: 0,
        });
        
        console.log("PDF generation complete");

        return pdf.output("blob");
    } catch (err) {
        console.error("Error in exportToPdf:", err);
        throw new Error(`PDF export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
};

/**
 * Helper function to replace custom Excalidraw fonts with PDF-compatible ones in the SVG
 */
function replaceCustomFontsInSvg(svgElement: SVGSVGElement) {
    // Find all text elements in the SVG
    const textElements = svgElement.querySelectorAll('text');
    
    textElements.forEach(textElement => {
        const fontFamily = textElement.getAttribute('font-family');
        
        // Replace custom fonts with standard ones
        if (fontFamily) {
            if (fontFamily.includes('Virgil')) {
                textElement.setAttribute('font-family', 'Helvetica');
            } else if (fontFamily.includes('Cascadia')) {
                textElement.setAttribute('font-family', 'Courier');
            }
        }
    });
    
    // Also replace any font-family styles
    const styleElements = svgElement.querySelectorAll('style');
    
    styleElements.forEach(styleElement => {
        let cssText = styleElement.textContent || '';
        
        // Replace font references in CSS
        cssText = cssText.replace(/font-family:\s*['"]?Virgil['"]?/g, 'font-family: "Helvetica"');
        cssText = cssText.replace(/font-family:\s*['"]?Cascadia['"]?/g, 'font-family: "Courier"');
        
        styleElement.textContent = cssText;
    });
}



