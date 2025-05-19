import { EyeIcon, EyeSlashIcon } from "../components/icons";
import { getNonDeletedElements } from "../element";
import type { ExcalidrawElement } from "../element/types";
import { StoreAction } from "../store";
import { register } from "./register";

/**
 * Collects all unique custom properties from all elements in the canvas - both key and value
 */
export const getAllCustomPropertiesWithValues = (
  elements: readonly ExcalidrawElement[],
  existingPropertiesMap: Map<string, Map<string, boolean>>
): Map<string, Map<string, boolean>> => {
  // const propertySet = new Map(existingPropertiesMap); // Clone the existing map

  elements.forEach((element) => {
    if (element.customData) {
      Object.entries(element.customData).forEach(([key, value]) => {
        if (!existingPropertiesMap.has(key)) {
          existingPropertiesMap.set(key, new Map<string, boolean>());
        }

        const categoryMap = existingPropertiesMap.get(key)!;
        if (!categoryMap.has(value)) {
          categoryMap.set(value, true); // Default to true for new values
        }
      });
    }
  });
  return existingPropertiesMap;
};

/**
 * Show elements with the same custom properties based on selected properties
 * And hide the rest
 */
const showElementsWithSelectedProperties = (
  elements: readonly ExcalidrawElement[],
  selectedProperties: Map<string, Map<string, boolean>>
): ExcalidrawElement[] => {
  const hiddenElementIds = new Set<string>();
  if (selectedProperties.size === 0) {
    return [];
  }

  const containersWithUpdatedVisibility = elements.map((element) => {
    // Check if the element has ANY of the selected properties
    // even if not all of properties of the element are selected
    // if any of the selected properties match, hide the element
    if (!element.customData) {
      return { ...element, hidden: false };
    }
    let toHide = false;
    for (const [key, value] of Object.entries(element.customData)) {
      if (
        selectedProperties.has(key) &&
        selectedProperties.get(key)?.has(value) &&
        selectedProperties.get(key)?.get(value) === false
      ) {
        // Hide this element
        toHide = true;
        break;
      }
    }
    if (toHide) {
      hiddenElementIds.add(element.id);
    }
    return {
      ...element,
      hidden: toHide,
    };
  });

  // Second pass: hide texts that are bound to hidden elements
  const allElementsWithUpdatedVisibility = containersWithUpdatedVisibility.map(
    (element) => {
      if (
        element.type === "text" &&
        "containerId" in element &&
        element.containerId &&
        hiddenElementIds.has(element.containerId)
      ) {
        return {
          ...element,
          hidden: true,
        };
      }
      return element;
    }
  );

  return allElementsWithUpdatedVisibility as ExcalidrawElement[];
};

/**
 * Custom type for the selectSimilar dialog
 */
declare global {
  interface Window {
    EXCALIDRAW_VISIBILITYSETTINGS_DIALOG: {
      properties: Map<string, Map<string, boolean>>;
      onSelectProperties: (
        properties: Map<string, Map<string, boolean>>
      ) => void;
    };
  }
}

// Make sure the dialog data object exists and is initialized
if (typeof window !== "undefined") {
  window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG =
    window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG || {
      properties: new Map<string, Map<string, boolean>>(),
      onSelectProperties: () => {},
    };
}

export const actionVisibilitySettings = register({
  name: "visibilitySettings",
  label: "labels.visibilitySettings",
  trackEvent: { category: "canvas" },
  predicate: (elements) => {
    // debugger;
    return true;
  },
  perform: async (elements, appState, _, app) => {
    const nonDeletedElements = getNonDeletedElements(elements);
    // Get all unique custom property keys from all elements
    const allPropertiesWithValues = getAllCustomPropertiesWithValues(
      nonDeletedElements,
      window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG.properties
    );

    // Create a promise that will be resolved when the user selects properties
    const selectedPropertiesPromise = new Promise<
      Map<string, Map<string, boolean>>
    >((resolve) => {
      // Store the reference element and properties in the global object
      window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG = {
        properties: allPropertiesWithValues,
        onSelectProperties: (selectedProperties) => {
          resolve(selectedProperties);
        },
      };

      // Open the dialog
      app.setOpenDialog({ name: "visibilitySettings" });
    });

    // Wait for the user to select properties
    const selectedProperties = await selectedPropertiesPromise;
    if (selectedProperties.size === 0) {
      return false;
    }

    window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG.properties = selectedProperties;
    // console.log(window.EXCALIDRAW_VISIBILITYSETTINGS_DIALOG.properties);

    const selectedElementsWithSimilarProperties =
      showElementsWithSelectedProperties(
        nonDeletedElements,
        selectedProperties
      );

    // Select elements with the same custom property values
    return {
      elements: selectedElementsWithSimilarProperties,
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
});
