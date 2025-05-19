import { register } from "./register";
import { t } from "../i18n";
import type { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { mutateElement } from "../element/mutateElement";
import { StoreAction } from "../store";
import { getNonDeletedElements } from "../element";
import { KEYS } from "../keys";
import { newTextElement } from "../element/newElement";
import { FONT_FAMILY } from "../constants";
import { getLineHeight } from "../fonts";
import { getBoundTextElement, getContainerElement } from "../element/textElement";
import type { AppState } from "../types";

// Helper function to check if an element has the "Row" custom property
const hasRowProperty = (element: ExcalidrawElement): boolean => {
  return (
    element.customData !== undefined && 
    Object.keys(element.customData).some(
      key => key.toLowerCase() === "row"
    ) &&
    Object.keys(element.customData).some(
      key => key.toLowerCase() === "row value"
    )
  );
};

// Helper function to check if an element has the "Rack" custom property
const hasRackProperty = (element: ExcalidrawElement): boolean => {
  return (
    element.customData !== undefined && 
    Object.keys(element.customData).some(
      key => key.toLowerCase() === "rack"
    )
  );
};

// Helper function to get the row value of an element
const getRowValue = (element: ExcalidrawElement): number => {
  if (!element.customData) return 0;
  
  const rowValueKey = Object.keys(element.customData).find(
    key => key.toLowerCase() === "row value"
  );
  
  if (!rowValueKey) return 0;
  
  const value = element.customData[rowValueKey];
  
  // Handle both string and numeric values
  if (typeof value === "string") {
    return parseInt(value, 10) || 0;
  } else if (typeof value === "number") {
    return value;
  }
  
  return 0;
};

// Helper function to group elements by rows based on Y position
const groupElementsByRow = (
  elements: ExcalidrawElement[],
  rackNumberingDirection: string = "top-down"
): ExcalidrawElement[][] => {
  // Sort elements by y position according to rackNumberingDirection
  const sortedByY = [...elements].sort((a, b) =>
    rackNumberingDirection === "top-down"
      ? a.y - b.y    // top to bottom
      : b.y - a.y    // bottom to top
  );
  
  const rows: ExcalidrawElement[][] = [];
  let currentRow: ExcalidrawElement[] = [];
  let currentRowY: number | null = null;
  
  // Group elements that are approximately in the same row (y position)
  const ROW_THRESHOLD = 20; // Tolerance for considering elements in the same row
  
  sortedByY.forEach(element => {
    if (currentRowY === null) {
      // First element
      currentRowY = element.y;
      currentRow.push(element);
    } else if (Math.abs(element.y - currentRowY) <= ROW_THRESHOLD) {
      // Element is in the same row
      currentRow.push(element);
    } else {
      // Element is in a new row
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [element];
      currentRowY = element.y;
    }
  });
  
  // Add the last row if it has elements
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
};

// Helper function to group elements by a custom parameter
const groupElementsByParameter = (
  elements: ExcalidrawElement[], 
  parameterName: string
): Record<string, ExcalidrawElement[]> => {
  const groups: Record<string, ExcalidrawElement[]> = {};
  const normalizedParamName = parameterName.trim();
  
  elements.forEach(element => {
    if (element.customData) {
      // Find parameter name case-insensitively
      const matchingKey = Object.keys(element.customData).find(
        key => key.toLowerCase() === normalizedParamName.toLowerCase()
      );
      
      if (matchingKey) {
        // If we find a matching key, use its value to group elements
        const paramValue = element.customData[matchingKey]?.toString() || "undefined";
        if (!groups[paramValue]) {
          groups[paramValue] = [];
        }
        groups[paramValue].push(element);
      } else {
        // No matching parameter, add to "undefined" group
        if (!groups["undefined"]) {
          groups["undefined"] = [];
        }
        groups["undefined"].push(element);
      }
    } else {
      // For elements that don't have custom data, group them separately
      if (!groups["undefined"]) {
        groups["undefined"] = [];
      }
      groups["undefined"].push(element);
    }
  });
  
  return groups;
};

// Add the action name to the ActionName type in types.ts
export const actionNumberRowElements = register({
  name: "numberRowElements",
  label: "labels.numberRowElements",
  trackEvent: { category: "element" },
  keyTest: (event) => !event.altKey && !event.shiftKey && !event[KEYS.CTRL_OR_CMD] && event.key === "r",
  predicate: (elements) => {
    // Enable this action if there's at least one element with "Row" and "Row Value" custom properties
    return elements.some(hasRowProperty);
  },
  perform: (elements, appState, _, app) => {
    try {
      const nonDeletedElements = getNonDeletedElements(elements);
      
      // Find all elements with "Row" and "Row Value" custom properties
      const rowElements = nonDeletedElements.filter(hasRowProperty);
      
      if (rowElements.length === 0) {
        return false;
      }
      
      // Find all existing row label text elements
      const existingRowLabels = nonDeletedElements.filter(element => 
        element.type === "text" && 
        (element as ExcalidrawTextElement).text.match(/^Row \d+/) !== null
      );
      
      // Create a map of bound text elements for faster lookup
      const boundTextMap = new Map<string, ExcalidrawTextElement>();
      nonDeletedElements.forEach(element => {
        if (element.type === "text" && "containerId" in element && element.containerId) {
          boundTextMap.set(element.containerId, element as ExcalidrawTextElement);
        }
      });
      
      // Create arrays to track elements to update and add
      const elementsToUpdate: ExcalidrawElement[] = [];
      const elementsToAdd: ExcalidrawElement[] = [];
      const elementsToRemove: string[] = [];
      
      // Keep track of row labels that are still in use
      const usedRowLabelIds: Set<string> = new Set();
      
      // Create a map of elements for faster lookup
      const elementsMap = new Map(
        nonDeletedElements.map(element => [element.id, element])
      );
      
      // Check if we need to group by a parameter
      const parameterName = appState.numberingGroupParameter || "none";
      const rackNumberingDirection = appState.rackNumberingDirection || "top-down";
      const rowNumberingDirection = appState.rowNumberingDirection || "left-right";
      const frameDirectionSettings = appState.frameDirectionSettings || {};
      
      // Add safeguards to ensure values are never blank
      const effectiveParameterName = parameterName.trim() === "" ? "none" : parameterName;
      const effectiveRackDirection = ["top-down", "down-top"].includes(rackNumberingDirection) 
                                    ? rackNumberingDirection 
                                    : "top-down";
      const effectiveRowDirection = ["left-right", "right-left"].includes(rowNumberingDirection) 
                                   ? rowNumberingDirection 
                                   : "left-right";
      
      console.log(`Using numbering settings: parameter=${effectiveParameterName}, rackDir=${effectiveRackDirection}, rowDir=${effectiveRowDirection}`);
      
      try {
        if (effectiveParameterName === "none") {
          // Original behavior - group and number rows across the whole canvas
          const rows = groupElementsByRow(rowElements, effectiveRackDirection);
          
          // First process row numbering
          processRowsForNumbering(
            rows, 
            boundTextMap, 
            elementsMap, 
            elementsToAdd, 
            elementsToUpdate, 
            elementsToRemove, 
            usedRowLabelIds,
            effectiveRowDirection
          );
          
        
        } else {
          // Group by the specified parameter
          const parameterGroups = groupElementsByParameter(rowElements, effectiveParameterName);
          
          // For each parameter group, group by rows and number independently
          Object.entries(parameterGroups).forEach(([paramValue, groupElements]) => {
            try {
              // If the parameter is Frame or Frame id and we have custom directions for this frame
              let groupRackDirection = effectiveRackDirection;
              let groupRowDirection = effectiveRowDirection;
              
              // Check if we have frame-specific settings for this frame
              const hasFrameSpecificSettings = (effectiveParameterName === "Frame" || effectiveParameterName === "Frame id") && 
                                             frameDirectionSettings[paramValue] !== undefined;
              
              if (hasFrameSpecificSettings) {
                // Apply frame-specific directions
                groupRackDirection = frameDirectionSettings[paramValue].rack;
                groupRowDirection = frameDirectionSettings[paramValue].row;
                console.log(`APPLYING FRAME-SPECIFIC DIRECTION for ${paramValue}: row=${groupRowDirection}, rack=${groupRackDirection}`);
                
                // Force the direction to be applied by setting a special flag
                // This ensures it won't be overridden
                const frameSpecificRows = groupElementsByRow(groupElements, groupRackDirection);
                
                console.log(`Applying frame-specific numbering to frame ${paramValue} with ${frameSpecificRows.length} rows`);
                console.log(`Direction: row=${groupRowDirection}, rack=${groupRackDirection}`);
                
                // Process row numbering with the frame-specific row direction
                processRowsForNumbering(
                  frameSpecificRows, 
                  boundTextMap, 
                  elementsMap, 
                  elementsToAdd, 
                  elementsToUpdate, 
                  elementsToRemove, 
                  usedRowLabelIds,
                  groupRowDirection
                );
                
               
              } else {
                console.log(`Using global direction for ${paramValue}: row=${effectiveRowDirection}, rack=${effectiveRackDirection}`);
                
                // Group elements by row first
                const rows = groupElementsByRow(groupElements, effectiveRackDirection);
                
                // Process row numbering with the global row direction
                processRowsForNumbering(
                  rows, 
                  boundTextMap, 
                  elementsMap, 
                  elementsToAdd, 
                  elementsToUpdate, 
                  elementsToRemove, 
                  usedRowLabelIds,
                  effectiveRowDirection
                );
                
          
              }
            } catch (err) {
              console.error("Error processing parameter group for row numbering:", err);
            }
          });
        }
      } catch (err) {
        console.error("Error in row numbering logic:", err);
      }
      
      // Add any existing row labels that are no longer used to the elements to remove list
      existingRowLabels.forEach(label => {
        if (!usedRowLabelIds.has(label.id)) {
          elementsToRemove.push(label.id);
        }
      });
      
      // Return the updated elements
      return {
        elements: [
          ...nonDeletedElements
            .filter(element => !elementsToRemove.includes(element.id))
            .map(element => {
              const updatedElement = elementsToUpdate.find(e => e.id === element.id);
              return updatedElement || element;
            }),
          ...elementsToAdd,
        ],
        appState,
        storeAction: StoreAction.CAPTURE,
      };
    } catch (err) {
      console.error("Error in actionNumberRowElements:", err);
      return false;
    }
  },
});

// Helper function to process rows for numbering
const processRowsForNumbering = (
  rows: ExcalidrawElement[][],
  boundTextMap: Map<string, ExcalidrawTextElement>,
  elementsMap: Map<string, ExcalidrawElement>,
  elementsToAdd: ExcalidrawElement[],
  elementsToUpdate: ExcalidrawElement[],
  elementsToRemove: string[],
  usedRowLabelIds: Set<string>,
  rowNumberingDirection: string = "left-right"
) => {
  try {
    console.log(`Starting processRowsForNumbering with direction: ${rowNumberingDirection}`);
    
    // Calculate row numbers from top to bottom, considering Row Value
    let currentRowNumber = 1;
    let lastNonZeroRowNumber = 1; // Keep track of the last non-zero row number
    
    // For right-to-left numbering, we need to pre-sort each row
    const processRows = rows.map(row => {
      if (rowNumberingDirection === "right-left") {
        // For right-to-left, sort elements from right to left
        return [...row].sort((a, b) => b.x - a.x);
      }
      // For left-to-right, keep original order but ensure sorted by x position
      return [...row].sort((a, b) => a.x - b.x);
    });
    
    processRows.forEach((row, rowIndex) => {
      try {
        // Always process the row
        // Find the maximum row value in this row (we'll use this for incrementing)
        // Default to 1 if all elements have row value 0
        const rowValues = row.map(element => getRowValue(element));
        const maxRowValue = rowValues.every(val => val === 0) ? 0 : Math.max(...rowValues);
        
        // Special handling for row value 0
        let rowNumberForDisplay = currentRowNumber;
        if (maxRowValue === 0) {
          if (rowIndex === 0) {
            // First row with row value 0, display as Row 0
            rowNumberForDisplay = 0;
          } else {
            // Not first row with row value 0, use the last non-zero row number
            rowNumberForDisplay = lastNonZeroRowNumber;
          }
        }
        
        // Find the leftmost or rightmost element in the row to place the row number label
        // based on the rowNumberingDirection parameter
        const edgeElement = row.length > 0 ? row[0] : null;
        if (edgeElement) {
          console.log(`Edge element position: x=${edgeElement.x}, dir=${rowNumberingDirection}`);
        }
        
        // Check if any element in this row has the "Rack" property
        const hasRackInRow = row.some(element => hasRackProperty(element));
        
        // Process elements in the order they appear in the pre-sorted row
        // This ensures right-to-left numbering works correctly
        console.log(`Processing ${row.length} elements with direction ${rowNumberingDirection}`);
        
        row.forEach((element, index) => {
          try {
            // Find the row key in a case-insensitive way
            const rowKey = element.customData ? 
              Object.keys(element.customData).find(key => key.toLowerCase() === "row") : undefined;
            
            if (rowKey) {
              // Get the row value for this element
              const rowValue = getRowValue(element);
              
              // Determine the row number to store in the custom property
              let rowNumberToStore = currentRowNumber;
              
              // For Row Value 0, use 0 if it's the first row, or the last non-zero row number if there are rows before
              if (rowValue === 0) {
                if (rowIndex === 0) {
                  // This is the first row and row value is 0, use 0
                  rowNumberToStore = 0;
                } else {
                  // There are rows before, use the last non-zero row number
                  rowNumberToStore = lastNonZeroRowNumber;
                }
              }
              
              // Log element position and assigned row number
              console.log(`Element at x=${element.x.toFixed(2)}, assigned row number: ${rowNumberToStore}, direction: ${rowNumberingDirection}`);
              
              // ALWAYS update the row number in the custom data
              const updatedCustomData = {
                ...element.customData,
                [rowKey]: rowNumberToStore.toString()
              };
              
              // Create the updated element with the new custom data
              let updatedElement = {
                ...element,
                customData: updatedCustomData
              } as ExcalidrawElement;
              
              // If this element doesn't have "Rack" and there's no rack in the row,
              // we'll show the row number as a bound text
              if (!hasRackProperty(element) && !hasRackInRow) {
                try {
                  // Check if the element already has bound text
                  // First check our map for faster lookup
                  let existingTextElement = boundTextMap.get(element.id) || undefined;
                  
                  // If not found in our map, use the slower lookup method
                  if (existingTextElement === undefined) {
                    const boundElement = getBoundTextElement(element, elementsMap);
                    existingTextElement = boundElement || undefined;
                  }
                  
                  // Determine the text to display based on row value
                  let rowText = "";
                  
                  if (rowValue === 0) {
                    if (rowIndex === 0) {
                      // First row with row value 0, display Row 0
                      rowText = `Row 0`;
                    } else {
                      // Not first row, use the last non-zero row number
                      rowText = `Row ${lastNonZeroRowNumber}`;
                    }
                  } else if (rowValue === 2) {
                    // For Row Value 2, show both the current row and next row
                    rowText = `Row ${currentRowNumber}, Row ${currentRowNumber + 1}`;
                  } else {
                    // For Row Value 1 or any other value, show the current row
                    rowText = `Row ${currentRowNumber}`;
                  }
                  
                  if (existingTextElement) {
                    // Update existing text
                    const updatedTextElement = {
                      ...existingTextElement,
                      text: rowText,
                      originalText: rowText,
                    };
                    elementsToUpdate.push(updatedTextElement);
                    
                    // Mark this text element as still in use
                    usedRowLabelIds.add(existingTextElement.id);
                  } else {
                    // Create new text element
                    const textElement = newTextElement({
                      x: element.x + element.width / 2,
                      y: element.y + element.height / 2,
                      fontSize: 20,
                      fontFamily: FONT_FAMILY.Helvetica,
                      text: rowText,
                      originalText: rowText,
                      textAlign: "center",
                      verticalAlign: "middle",
                      containerId: element.id,
                      lineHeight: getLineHeight(FONT_FAMILY.Helvetica),
                      // For Row Value 2, make the text element wider to fit both row numbers
                      width: rowValue === 2 ? 200 : undefined,
                    });
                    
                    // Add the text element to the list of elements to add
                    elementsToAdd.push(textElement);
                    
                    // Mark this text element as still in use
                    usedRowLabelIds.add(textElement.id);
                    
                    // Create a new element with updated boundElements
                    updatedElement = {
                      ...updatedElement,
                      boundElements: [
                        ...(updatedElement.boundElements || []),
                        { type: "text" as const, id: textElement.id },
                      ]
                    };
                  }
                } catch (err) {
                  console.error("Error handling bound text for row element:", err);
                }
              }
              
              // Always add the updated element to elementsToUpdate
              // Check if we already added an update for this element
              const existingUpdateIndex = elementsToUpdate.findIndex(e => e.id === element.id);
              if (existingUpdateIndex >= 0) {
                elementsToUpdate[existingUpdateIndex] = updatedElement;
              } else {
                elementsToUpdate.push(updatedElement);
              }
            }
          } catch (err) {
            console.error("Error updating row element:", err);
          }
        });
        
        // If any element in this row has the "Rack" property,
        // create or update a text label to the left or right of the row based on rowNumberingDirection
        if (hasRackInRow && edgeElement) {
          try {
            // Find the maximum row value in this row
            const maxRowValueInRow = Math.max(...row.map(element => getRowValue(element)));
            
            // Determine the text to display based on the maximum row value
            let rowText = "";
            
            if (maxRowValueInRow === 0) {
              if (rowIndex === 0) {
                // First row with row value 0, display Row 0
                rowText = `Row 0`;
              } else {
                // Not first row, use the last non-zero row number
                rowText = `Row ${lastNonZeroRowNumber}`;
              }
            } else if (maxRowValueInRow === 2) {
              // For Row Value 2, show both the current row and next row
              rowText = `Row ${currentRowNumber}, Row ${currentRowNumber + 1}`;
            } else {
              // For Row Value 1 or any other value, show the current row
              rowText = `Row ${currentRowNumber}`;
            }
            
            // Place label to the left or right based on rowNumberingDirection parameter
            const rowLabelPosition = { 
              x: rowNumberingDirection === "left-right" 
                ? edgeElement.x - 60  // Place to the left if numbering left-to-right
                : edgeElement.x + edgeElement.width + 60,  // Place to the right if numbering right-to-left
              y: edgeElement.y + edgeElement.height / 2 
            };
            
            console.log(`Row label position for direction ${rowNumberingDirection}:`, 
              {x: rowLabelPosition.x, y: rowLabelPosition.y, 
               elementX: edgeElement.x, elementWidth: edgeElement.width});
            
            // Data-driven approach: Look for row labels by position rather than text content
            const existingRowLabel = Array.from(elementsMap.values()).find(element => {
              if (element.type !== "text") return false;
              
              // Check position proximity
              const isNearPosition = (
                Math.abs(element.x - rowLabelPosition.x) < 30 &&
                Math.abs(element.y - rowLabelPosition.y) < 30
              );
              
              // Check if it's a row label (starts with "Row ")
              const isRowLabel = (element as ExcalidrawTextElement).text.startsWith("Row ");
              
              return isNearPosition && isRowLabel;
            }) as ExcalidrawTextElement | undefined;
            
            if (existingRowLabel) {
              // Update the existing row label
              const updatedRowLabel = {
                ...existingRowLabel,
                text: rowText,
                originalText: rowText,
                textAlign: rowNumberingDirection === "left-right" ? "right" : "left", // Ensure text alignment matches numbering direction
              };
              elementsToUpdate.push(updatedRowLabel);
              
              // Mark this row label as still in use
              usedRowLabelIds.add(existingRowLabel.id);
            } else {
              // Create a new text element for the row label
              const rowLabelElement = newTextElement({
                x: rowLabelPosition.x,
                y: rowLabelPosition.y,
                fontSize: 20,
                fontFamily: FONT_FAMILY.Helvetica,
                text: rowText,
                originalText: rowText,
                textAlign: rowNumberingDirection === "left-right" ? "right" : "left",
                verticalAlign: "middle",
                lineHeight: getLineHeight(FONT_FAMILY.Helvetica),
                // For Row Value 2, make the text element wider to fit both row numbers
                width: maxRowValueInRow === 2 ? 200 : undefined,
              });
              
              // Add the row label to the list of elements to add
              elementsToAdd.push(rowLabelElement);
              
              // Mark this row label as still in use
              usedRowLabelIds.add(rowLabelElement.id);
            }
          } catch (err) {
            console.error("Error creating/updating row label:", err);
          }
        }
        
        // Increment the current row number based on the maximum row value in this row
        if (maxRowValue === 2) {
          // For Row Value 2, increment by 2 (skip the next row number)
          currentRowNumber += 2;
          lastNonZeroRowNumber = currentRowNumber - 1; // Update the last non-zero row number
        } else if (maxRowValue === 1) {
          // For Row Value 1, increment by 1 (default behavior)
          currentRowNumber += 1;
          lastNonZeroRowNumber = currentRowNumber - 1; // Update the last non-zero row number
        } else {
          // For Row Value 0
          if (rowIndex === 0) {
            // First row with value 0, set currentRowNumber to 1 for the next row
            currentRowNumber = 1;
            // lastNonZeroRowNumber stays at initial value
          } else {
            // Not first row with value 0, don't increment
            // Keep currentRowNumber the same to maintain consecutive numbering
            // Don't update lastNonZeroRowNumber
          }
        }
      } catch (err) {
        console.error("Error processing row for numbering:", err);
      }
    });
  } catch (err) {
    console.error("Error in processRowsForNumbering:", err);
  }
};
