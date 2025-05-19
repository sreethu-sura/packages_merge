import { register } from "./register";
import { t } from "../i18n";
import type { ExcalidrawElement } from "../element/types";
import { StoreAction } from "../store";
import { getNonDeletedElements } from "../element";
import { KEYS } from "../keys";

// Import the individual numbering actions to reuse their functionality
import { actionNumberRackElements } from "./actionNumberRackElements";
import { actionNumberRowElements } from "./actionNumberRowElements";

// Helper function to check if an element has the "Row" custom property or "Rack" property
const hasRowOrRackProperty = (element: ExcalidrawElement): boolean => {
  if (!element.customData) return false;
  
  const keys = Object.keys(element.customData).map(key => key.toLowerCase());
  
  return (
    // Check for rack property
    keys.some(key => key === "rack") ||
    // Check for customData.type === "Rack"
    element.customData.type === "Rack" ||
    // Check for row properties
    (keys.some(key => key === "row") && keys.some(key => key === "row value"))
  );
};

// Add the action name to the ActionName type in types.ts
export const actionNumberRowAndRackElements = register({
  name: "numberRowAndRackElements", // Now defined in ActionName type
  label: "labels.numberRowAndRackElements",
  trackEvent: { category: "element" },
  icon: null, // Can be added later if needed
  keyTest: event => !event.altKey && !event.shiftKey && !event[KEYS.CTRL_OR_CMD] && event.key === "b",
  predicate: elements => {
    // Check if there are elements with either Row or Rack properties
    return elements.some(hasRowOrRackProperty);
  },
  perform: (elements, appState, _, app) => {
    // First perform rack numbering (right to left)
    const rackResult = actionNumberRackElements.perform(elements, appState, _, app);
    
    // If rack numbering failed or returned false, just try row numbering
    if (rackResult === false) {
      return actionNumberRowElements.perform(elements, appState, _, app);
    }
    
    // If rack numbering succeeded, use its result to perform row numbering
    // Cast the elements to the expected type for the row numbering action
    const rowResult = actionNumberRowElements.perform(
      rackResult.elements as typeof elements, 
      rackResult.appState, 
      _, 
      app
    );
    
    // If row numbering failed, return the rack result
    if (rowResult === false) {
      return rackResult;
    }
    
    // Return the final result after both operations
    return rowResult;
  },
});
