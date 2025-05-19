import { LockedIcon, UnlockedIcon } from "../components/icons";
import { newElementWith } from "../element/mutateElement";
import type { ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import { arrayToMap } from "../utils";
import { register } from "./register";

// Helper function to check if an element has the "Rack" custom property or type="Rack"
const hasRackTypeProperty = (element: ExcalidrawElement): boolean => {
  return (
    element.customData !== undefined && 
    (
      // Check for a key named "rack" in customData
      Object.keys(element.customData).some(
        key => key.toLowerCase() === "rack"
      ) ||
      // Check for customData.type === "Rack"
      element.customData.type === "Rack"
    )
  );
};

// Helper function to check if rack number is currently locked
const isRackNumberLocked = (element: ExcalidrawElement): boolean => {
  return (
    element.customData !== undefined && 
    element.customData["rackNumberLocked"] === true
  );
};

// Helper function to determine if we should lock or unlock
const shouldLockRackNumber = (elements: readonly ExcalidrawElement[]) =>
  elements.some((el) => !isRackNumberLocked(el));

export const actionLockRackNumber = register({
  name: "lockRackNumber",
  label: (elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });
    
    // If only one element is selected, show a specific label
    if (selected.length === 1 && hasRackTypeProperty(selected[0])) {
      return isRackNumberLocked(selected[0])
        ? "labels.rackNumber.unlock"
        : "labels.rackNumber.lock";
    }

    // Otherwise show a label for locking/unlocking all
    return shouldLockRackNumber(selected)
      ? "labels.rackNumber.lockAll"
      : "labels.rackNumber.unlockAll";
  },
  icon: (appState, elements) => {
    const selectedElements = getSelectedElements(elements, appState);
    return shouldLockRackNumber(selectedElements) ? LockedIcon : UnlockedIcon;
  },
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    // Only enable this action if at least one selected element has the rack property
    return selectedElements.some(hasRackTypeProperty);
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });

    // Filter to only include rack elements
    const rackElements = selectedElements.filter(hasRackTypeProperty);
    
    if (rackElements.length === 0) {
      return false;
    }

    const nextLockState = shouldLockRackNumber(rackElements);
    const rackElementsMap = arrayToMap(rackElements);
    
    return {
      elements: elements.map((element) => {
        if (!rackElementsMap.has(element.id)) {
          return element;
        }

        // Set the rack number lock state in the custom data
        return newElementWith(element, { 
          customData: {
            ...element.customData,
            rackNumberLocked: nextLockState
          }
        });
      }),
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) => {
    return (
      event.key.toLowerCase() === "k" &&
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey
    );
  },
}); 