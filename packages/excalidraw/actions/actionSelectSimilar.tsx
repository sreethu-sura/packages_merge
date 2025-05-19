import { register } from "./register";
import { t } from "../i18n";
import type { ExcalidrawElement } from "../element/types";
import { getNonDeletedElements } from "../element";
import { KEYS } from "../keys";
import type { AppState } from "../types";
import { AppClassProperties } from "../types";
import { StoreAction } from "../store";
import React from "react";

/**
 * Collects all unique custom properties from all elements in the canvas
 */
const getAllCustomProperties = (
  elements: readonly ExcalidrawElement[]
): string[] => {
  const propertySet = new Set<string>();
  
  elements.forEach((element) => {
    if (element.customData) {
      Object.keys(element.customData).forEach((key) => {
        propertySet.add(key);
      });
    }
  });
  
  return Array.from(propertySet).sort();
};

/**
 * Checks if two elements have the same value for a given custom property
 * Case insensitive matching for property keys
 */
const hasSameCustomPropertyValue = (
  element1: ExcalidrawElement,
  element2: ExcalidrawElement,
  propertyKey: string
): boolean => {
  if (!element1.customData || !element2.customData) {
    return false;
  }
  
  // Find matching keys (case-insensitive)
  const key1 = Object.keys(element1.customData).find(
    (key) => key.toLowerCase() === propertyKey.toLowerCase()
  );
  
  const key2 = Object.keys(element2.customData).find(
    (key) => key.toLowerCase() === propertyKey.toLowerCase()
  );
  
  if (!key1 || !key2) {
    return false;
  }
  
  return element1.customData[key1] === element2.customData[key2];
};

/**
 * Selects elements with similar custom properties based on selected properties and reference element
 */
const selectElementsWithSimilarProperties = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  referenceElement: ExcalidrawElement,
  selectedProperties: string[]
): AppState => {
  if (selectedProperties.length === 0) {
    return appState;
  }
  
  const selectedElementIds: Record<string, true> = {};
  
  elements.forEach((element) => {
    // For each property, check if it matches the reference element
    const matchesAllProperties = selectedProperties.every((propertyKey) =>
      hasSameCustomPropertyValue(referenceElement, element, propertyKey)
    );
    
    if (matchesAllProperties) {
      selectedElementIds[element.id] = true;
    }
  });
  
  return {
    ...appState,
    selectedElementIds,
  };
};

/**
 * Custom type for the selectSimilar dialog
 */
declare global {
  interface Window {
    EXCALIDRAW_SELECTSIMILAR_DIALOG: {
      properties: string[];
      referenceElement: ExcalidrawElement | null;
      onSelectProperties: (properties: string[]) => void;
    };
  }
}

// Make sure the dialog data object exists and is initialized
if (typeof window !== "undefined") {
  window.EXCALIDRAW_SELECTSIMILAR_DIALOG = window.EXCALIDRAW_SELECTSIMILAR_DIALOG || {
    properties: [],
    referenceElement: null,
    onSelectProperties: () => {},
  };
}

// Add the action to the types.ts ActionName type
export const actionSelectSimilar = register({
  name: "selectSimilar",
  label: "labels.selectSimilar",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    // Only enable if there's exactly one element selected and it has custom properties
    const selectedElementIds = Object.keys(appState.selectedElementIds || {});
    if (selectedElementIds.length !== 1) {
      return false;
    }
    
    const selectedElement = elements.find((el) => el.id === selectedElementIds[0]);
    return !!selectedElement?.customData && 
           Object.keys(selectedElement.customData).length > 0;
  },
  perform: async (elements, appState, _, app) => {
    const nonDeletedElements = getNonDeletedElements(elements);
    
    // Get the currently selected element (should be exactly one)
    const selectedElementIds = Object.keys(appState.selectedElementIds || {});
    if (selectedElementIds.length !== 1) {
      return false;
    }
    
    const referenceElement = nonDeletedElements.find(
      (el) => el.id === selectedElementIds[0]
    );
    
    if (!referenceElement || !referenceElement.customData) {
      return false;
    }
    
    // Get all unique custom property keys from all elements
    const allProperties = getAllCustomProperties(nonDeletedElements);
    if (allProperties.length === 0) {
      return false;
    }
    
    // Create a promise that will be resolved when the user selects properties
    const selectedPropertiesPromise = new Promise<string[]>((resolve) => {
      // Store the reference element and properties in the global object
      window.EXCALIDRAW_SELECTSIMILAR_DIALOG = {
        properties: allProperties,
        referenceElement,
        onSelectProperties: (selectedProperties) => {
          resolve(selectedProperties);
        },
      };
      
      // Open the dialog
      app.setOpenDialog({ name: "selectSimilar" });
    });
    
    // Wait for the user to select properties
    const selectedProperties = await selectedPropertiesPromise;
    
    if (selectedProperties.length === 0) {
      return false;
    }
    
    // Select elements with the same custom property values
    return {
      elements,
      appState: selectElementsWithSimilarProperties(
        nonDeletedElements,
        appState,
        referenceElement,
        selectedProperties
      ),
      storeAction: StoreAction.CAPTURE,
    };
  },
}); 