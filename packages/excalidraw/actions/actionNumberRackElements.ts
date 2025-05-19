import { register } from "./register";
import { t } from "../i18n";
import type { ExcalidrawElement} from "../element/types";
import { ExcalidrawRectangleElement, ExcalidrawTextElement } from "../element/types";
import { newTextElement } from "../element/newElement";
import { mutateElement } from "../element/mutateElement";
import { getCommonBounds } from "../element/bounds";
import { FONT_FAMILY } from "../constants";
import { StoreAction } from "../store";
import { getNonDeletedElements } from "../element";
import { getBoundTextElement, getContainerElement } from "../element/textElement";
import { getLineHeight } from "../fonts";
import { KEYS } from "../keys";
import type { AppState } from "../types";

// Helper function to check if an element has the "Rack" custom property
const hasRackProperty = (element: ExcalidrawElement): boolean => {
  return (
    element.customData !== undefined && 
    (
      Object.keys(element.customData).some(
        key => key.toLowerCase() === "rack"
      ) ||
      // Check for customData.type === "Rack"
      element.customData.type === "Rack"
    )
  );
};

// Helper function to group elements by rows
const groupElementsByRow = (
  elements: ExcalidrawElement[],
  rackNumberingDirection: string = "top-down",
  rowNumberingDirection: string = "left-right"
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
  
  // Sort each row's elements according to rowNumberingDirection
  return rows.map(row => row.sort((a, b) => 
    rowNumberingDirection === "left-right"
      ? a.x - b.x    // left to right
      : b.x - a.x    // right to left (original behavior)
  ));
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
export const actionNumberRackElements = register({
  name: "numberRackElements",
  label: "labels.numberRackElements",
  trackEvent: { category: "element" },
  keyTest: (event) => !event.altKey && !event.shiftKey && !event[KEYS.CTRL_OR_CMD] && event.key === "n",
  predicate: (elements) => {
    // Enable this action if there's at least one element with "Rack" custom property
    return elements.some(hasRackProperty);
  },
  perform: (elements, appState, _, app) => {
    try {
      const scene = app.scene;
      if (!scene) return false;
      
      const nonDeletedElements = getNonDeletedElements(elements);
      
      // Find all elements with "Rack" custom property
      const rackElements = nonDeletedElements.filter(hasRackProperty);
      
      if (rackElements.length === 0) {
        return false;
      }
      
      // Create a map to track which elements need to be added or updated
      const elementsToAdd: ExcalidrawElement[] = [];
      const elementsToUpdate: ExcalidrawElement[] = [];
      
      // First, check if there are any bound text elements that need to be removed
      // This handles the case where a rectangle might have multiple bound text elements
      const elementsMap = scene.getNonDeletedElementsMap();
      const elementsToRemove: string[] = [];
      
      // Check if we need to group by a parameter
      const parameterName = appState.numberingGroupParameter || "none";
      const rackNumberingDirection = appState.rackNumberingDirection || "top-down";
      const rowNumberingDirection = appState.rowNumberingDirection || "left-right";
      
      if (parameterName === "none") {
        // Original behavior - group by rows across the whole canvas
        const rows = groupElementsByRow(rackElements, rackNumberingDirection, rowNumberingDirection);
        
        // Number each rectangle in each row
        rows.forEach(row => {
          try {
            numberRackElementsInRow(row, elementsMap, elementsToAdd, elementsToUpdate, elementsToRemove, rowNumberingDirection);
          } catch (err) {
            console.error("Error numbering rack elements in row:", err);
          }
        });
      } else {
        // Group by the specified parameter
        const parameterGroups = groupElementsByParameter(rackElements, parameterName);
        
        // For each parameter group, group by rows and number independently
        Object.values(parameterGroups).forEach(groupElements => {
          try {
            const rows = groupElementsByRow(groupElements, rackNumberingDirection, rowNumberingDirection);
            
            // Number each rectangle in each row
            rows.forEach(row => {
              try {
                numberRackElementsInRow(row, elementsMap, elementsToAdd, elementsToUpdate, elementsToRemove, rowNumberingDirection);
              } catch (err) {
                console.error("Error numbering rack elements in row:", err);
              }
            });
          } catch (err) {
            console.error("Error processing parameter group:", err);
          }
        });
      }
      
      // Return the updated elements, filtering out any elements that need to be removed
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
      console.error("Error in actionNumberRackElements:", err);
      return false;
    }
  },
});

// Helper function to number rack elements in a row
const numberRackElementsInRow = (
  row: ExcalidrawElement[],
  elementsMap: Map<string, ExcalidrawElement>,
  elementsToAdd: ExcalidrawElement[],
  elementsToUpdate: ExcalidrawElement[],
  elementsToRemove: string[],
  rowNumberingDirection: string = "left-right"
) => {
  try {
    // Sort row elements by x position according to the direction
    const sortedRow = [...row].sort((a, b) => 
      rowNumberingDirection === "left-right"
        ? a.x - b.x    // left to right
        : b.x - a.x    // right to left
    );
    
    // Get locked elements (these will maintain their current numbers)
    const lockedElements = sortedRow.filter(
      el => el.customData && el.customData["rackNumberLocked"] === true
    );
    
    // Get unlocked elements (these will be numbered sequentially)
    const unlockedElements = sortedRow.filter(
      el => !el.customData || el.customData["rackNumberLocked"] !== true
    );
    
    // Create a map of locked element positions to their numbers
    const lockedPositionsMap = new Map<number, string>();
    
    // Process locked elements first
    lockedElements.forEach(el => {
      // Find the index of this element in the sorted row
      const index = sortedRow.findIndex(item => item.id === el.id);
      
      if (index !== -1 && el.customData && el.customData["rack number"]) {
        // Store the position and number
        lockedPositionsMap.set(index, el.customData["rack number"].toString());
        
        // Update the locked element (just to ensure consistency)
        updateRackElementNumber(
          el,
          el.customData["rack number"].toString(),
          elementsMap,
          elementsToAdd,
          elementsToUpdate,
          elementsToRemove
        );
      }
    });
    
    // Now handle unlocked elements
    let currentNumber = 1;
    
    // Process elements in their sorted order
    for (let i = 0; i < sortedRow.length; i++) {
      const element = sortedRow[i];
      
      // Skip locked elements, they're already processed
      if (element.customData && element.customData["rackNumberLocked"] === true) {
        // If this is a locked element, update the current number for subsequent elements
        const lockedNum = parseInt(element.customData["rack number"]?.toString() || "0");
        if (!isNaN(lockedNum)) {
          // Set the next number to be one after this locked number
          currentNumber = lockedNum + 1;
        }
        continue;
      }
      
      // Find the next locked position after this one
      let nextLockedPos = -1;
      let nextLockedNum = -1;
      
      for (const [pos, num] of lockedPositionsMap.entries()) {
        if (pos > i) {
          nextLockedPos = pos;
          nextLockedNum = parseInt(num);
          break;
        }
      }
      
      // Update the unlocked element
      updateRackElementNumber(
        element,
        currentNumber.toString(),
        elementsMap,
        elementsToAdd,
        elementsToUpdate,
        elementsToRemove
      );
      
      // Increment for the next element
      currentNumber++;
      
      // If the next number would conflict with an upcoming locked number,
      // adjust to continue from after the locked number
      if (nextLockedPos !== -1 && !isNaN(nextLockedNum) && currentNumber >= nextLockedNum) {
        currentNumber = nextLockedNum + 1;
      }
    }
  } catch (err) {
    console.error("Error in numberRackElementsInRow:", err);
  }
};

// Helper function to update a rack element with a specific number
const updateRackElementNumber = (
  rect: ExcalidrawElement,
  number: string,
  elementsMap: Map<string, ExcalidrawElement>,
  elementsToAdd: ExcalidrawElement[],
  elementsToUpdate: ExcalidrawElement[],
  elementsToRemove: string[]
) => {
  // Find the existing rack number key with original case or use "Rack Number" as default
  let rackNumberKey = "Rack Number";
  if (rect.customData) {
    const existingKey = Object.keys(rect.customData).find(key => 
      key.toLowerCase() === "rack number"
    );
    if (existingKey) {
      rackNumberKey = existingKey;
    }
  }

  // Check if the element already has a rack number custom data (case insensitive)
  const hasExistingRackNumber = rect.customData && 
    Object.keys(rect.customData).some(key => 
      key.toLowerCase() === "rack number" && 
      rect.customData?.[key] !== undefined
    );

  // Update the rack number in custom data using the original case
  const updatedCustomData = {
    ...rect.customData,
    [rackNumberKey]: number
  };
  
  // Update the element with the new custom data to ensure consistency
  let updatedRect = {
    ...rect,
    customData: updatedCustomData
  };
  
  // Check if the rectangle already has bound text
  const existingTextElement = getBoundTextElement(rect, elementsMap);
  
  // Check if the rectangle has multiple bound text elements
  if (rect.boundElements) {
    const textBindings = rect.boundElements.filter(el => el.type === "text");
    
    // If there are multiple text bindings, we need to remove the extras
    if (textBindings.length > 1) {
      // Keep the first one, mark others for removal
      for (let i = 1; i < textBindings.length; i++) {
        elementsToRemove.push(textBindings[i].id);
      }
      
      // Update the rectangle to only have one text binding
      updatedRect = {
        ...rect,
        customData: updatedCustomData,
        boundElements: rect.boundElements.filter(el => 
          el.type !== "text" || el.id === textBindings[0].id
        ),
      };
    }
  }
  
  // Always push the updated rect to elementsToUpdate
  // Replace any existing update for this element
  const existingUpdateIndex = elementsToUpdate.findIndex(e => e.id === rect.id);
  if (existingUpdateIndex >= 0) {
    elementsToUpdate[existingUpdateIndex] = updatedRect as ExcalidrawElement;
  } else {
    elementsToUpdate.push(updatedRect as ExcalidrawElement);
  }
  
  // Only create or update text element if needed
  if (existingTextElement) {
    // Update existing text
    const updatedTextElement = {
      ...existingTextElement,
      text: number,
      originalText: number,
    };
    elementsToUpdate.push(updatedTextElement);
  } else {
    // Check if we're already tracking this element in updates
    const hasExistingBinding = updatedRect.boundElements?.some(b => b.type === "text");
    
    // Only create a new text element if we don't have an existing rack number or binding
    if (!hasExistingRackNumber || !hasExistingBinding) {
      // Create new text element
      const textElement = newTextElement({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        fontSize: 20,
        fontFamily: FONT_FAMILY.Helvetica,
        text: number,
        originalText: number,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: rect.id,
        lineHeight: getLineHeight(FONT_FAMILY.Helvetica),
      });
      
      // Add the text element to the list of elements to add
      elementsToAdd.push(textElement);
      
      // Update the rectangle to reference the text element
      updatedRect = {
        ...updatedRect,
        boundElements: [
          ...(updatedRect.boundElements || []),
          { type: "text" as const, id: textElement.id },
        ],
      };
      
      // Replace the updated rect in elementsToUpdate
      const updatedIndex = elementsToUpdate.findIndex(e => e.id === rect.id);
      if (updatedIndex >= 0) {
        elementsToUpdate[updatedIndex] = updatedRect as ExcalidrawElement;
      } else {
        elementsToUpdate.push(updatedRect as ExcalidrawElement);
      }
    }
  }
};
