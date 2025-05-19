import type {
    ExcalidrawLinearElement,
    ExcalidrawTextElement,
    NonDeletedExcalidrawElement,
} from "../element/types";
import type { AppState, BinaryFiles } from "../types";

export type CSVPropertyConfig = {
    id: string;
    label: string;
    filterEmpty?: boolean;
};

export const exportToCsv = async (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    selectedProperties?: CSVPropertyConfig[],
    options?: { includeNullValues: boolean }
): Promise<Blob> => {
    // Default to including null values if not specified
    const globalIncludeNullValues = options?.includeNullValues ?? true;
    
    // Calculate scale factor: 125 pixels = 2 feet
    const PIXELS_TO_FEET = 2 / 125; // feet per pixel

    // Find the reference circle for coordinate system origin
    const referenceCircle = elements.find(element => element.type === "ellipse");
    
    // Calculate reference point (circle center or canvas origin if no circle)
    let refX = 0;
    let refY = 0;
    
    if (referenceCircle) {
        refX = referenceCircle.x + referenceCircle.width / 2;
        refY = referenceCircle.y + referenceCircle.height / 2;
    }
    // No need to throw error when circle not found - we'll use (0,0) by default

    // 1. Create a lookup for text elements: id -> originalText (or text)
    const textMap = new Map<string, string>();
    for (const element of elements) {
        if (element.type === "text") {
            const textEl = element as ExcalidrawTextElement;
            textMap.set(element.id, textEl.originalText ?? textEl.text ?? "");
        }
    }

    // 2. Build a map: elementId => set of connected shape IDs (ignoring arrows)
    const connections = new Map<string, Set<string>>();
    for (const element of elements) {
        if (element.type !== "arrow") {
            connections.set(element.id, new Set());
        }
    }

    // 3. Populate shape-to-shape connections by examining arrows
    for (const element of elements) {
        if (element.type === "arrow") {
            const arrow = element as ExcalidrawLinearElement;
            const startId = arrow.startBinding?.elementId;
            const endId = arrow.endBinding?.elementId;
            if (startId && endId) {
                if (connections.has(startId) && connections.has(endId)) {
                    connections.get(startId)!.add(endId);
                    connections.get(endId)!.add(startId);
                }
            }
        }
    }

    // 4. Collect all unique custom property keys across all elements
    // Use a Map to maintain case-insensitive uniqueness while preserving original casing
    const customPropertyKeyMap = new Map<string, string>(); // lowercase -> original case
    for (const element of elements) {
        if (element.customData) {
            Object.keys(element.customData).forEach(key => {
                const lowerKey = key.toLowerCase();
                // Keep the first occurrence's casing
                if (!customPropertyKeyMap.has(lowerKey)) {
                    customPropertyKeyMap.set(lowerKey, key);
                }
            });
        }
    }

    // 5. Define CSV columns (including angle, connectedto, real-world coordinates & custom properties)
    let headers: string[];
    
    if (selectedProperties && selectedProperties.length > 0) {
        // If specific properties were selected, use those
        headers = selectedProperties.map(prop => prop.id);
    } else {
        // Default headers if none were specified
        headers = [
            "id",
            "type",
            "boundText",
            "x",
            "y",
            "width",
            "height",
            "angle",
            "connectedto",
            "center_x_feet",
            "center_y_feet",
            ...Array.from(customPropertyKeyMap.values()),
        ];
    }
    
    const csvRows = [headers.join(",")];

    // 6. Build each CSV row
    for (const element of elements) {
        if (element.isDeleted) {
            continue; // skip deleted
        }

        // Calculate values for all possible properties first
        const valuesMap = new Map<string, string>();

        // Basic properties
        valuesMap.set("id", element.id);
        valuesMap.set("type", element.type);
        valuesMap.set("x", element.x.toString());
        valuesMap.set("y", element.y.toString());
        valuesMap.set("width", element.width.toString());
        valuesMap.set("height", element.height.toString());
        valuesMap.set("angle", element.angle.toString());

        // Bound text
        let boundTextVal = "";
        if (element.type !== "text" && element.boundElements?.length) {
            const foundTexts: string[] = [];
            for (const boundEl of element.boundElements) {
                if (boundEl.type === "text" && boundEl.id) {
                    // look up the text element
                    const text = textMap.get(boundEl.id);
                    if (text) {
                        foundTexts.push(text);
                    }
                }
            }
            boundTextVal = foundTexts.join("; ");
        }
        valuesMap.set("boundText", JSON.stringify(boundTextVal)); // wrap in JSON.stringify to handle commas/newlines

        // connectedto
        let connectedToStr = "";
        if (element.type !== "arrow") {
            const connectedIds = Array.from(connections.get(element.id) ?? []);
            connectedToStr = connectedIds.join(";");
        }
        valuesMap.set("connectedto", connectedToStr);

        // Calculate center coordinates relative to reference circle
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        
        // Convert to relative coordinates (in pixels) then to feet
        const relativeX = centerX - refX;
        const relativeY = refY - centerY; // Invert Y axis to match typical CAD coordinate system
        const centerXFeet = (relativeX * PIXELS_TO_FEET).toFixed(3);
        const centerYFeet = (relativeY * PIXELS_TO_FEET).toFixed(3);
        
        valuesMap.set("center_x_feet", centerXFeet);
        valuesMap.set("center_y_feet", centerYFeet);

        // Custom properties
        if (element.customData) {
            customPropertyKeyMap.forEach((originalKey, lowerKey) => {
                let value = "";
                // Find the property value by checking all keys case-insensitively
                const matchingKey = Object.keys(element.customData!).find(
                    k => k.toLowerCase() === lowerKey
                );
                if (matchingKey) {
                    value = element.customData![matchingKey];
                }
                valuesMap.set(originalKey, JSON.stringify(value)); // Wrap in JSON.stringify to handle commas/newlines
            });
        }

        // Now build the row using only the selected properties in the specified order
        const rowData = headers.map((header, index) => {
            return valuesMap.get(header) || "";
        });

        // Check if any property with filterEmpty enabled has an empty value
        let shouldSkipRow = false;
        
        if (selectedProperties) {
            for (let i = 0; i < selectedProperties.length; i++) {
                const property = selectedProperties[i];
                if (property.filterEmpty) {
                    const value = rowData[i]; // Get the value at the same index
                    
                    // Check if this value is empty
                    if (
                        value === "" || 
                        value === '""' || // For empty JSON strings
                        value === "undefined" || 
                        value === "null"
                    ) {
                        shouldSkipRow = true;
                        break; // Skip this row
                    }
                }
            }
        }
        
        // If any properties flagged for filtering have empty values, skip this row
        if (shouldSkipRow) {
            continue;
        }

        csvRows.push(rowData.join(","));
    }

    // 7. Create CSV blob
    const csvString = csvRows.join("\n");
    return new Blob([csvString], { type: "text/csv" });
};
