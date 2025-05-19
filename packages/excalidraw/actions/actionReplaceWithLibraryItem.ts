import { register } from "./register";
import { t } from "../i18n";
import { StoreAction } from "../store";
import { mutateElement } from "../element/mutateElement";
import { duplicateElements } from "../element/newElement";
import { getElementAbsoluteCoords } from "../element";
import { getSelectedElements } from "../scene";
import type { LibraryItem } from "../types";
import type { AppClassProperties } from "../types";
import type { NonDeletedExcalidrawElement, ElementsMap } from "../element/types";

export const actionReplaceWithLibraryItem = register({
  name: "replaceWithLibraryItem",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    // Get the selected element to replace
    const selectedElements = getSelectedElements(
      elements,
      { selectedElementIds: appState.selectedElementIds },
      { includeBoundTextElement: true, includeElementsInFrames: true }
    );
    
    if (selectedElements.length < 1) {
      return {
        storeAction: StoreAction.NONE,
        appState: {
          ...appState,
          errorMessage: t("errors.replaceWithLibraryItemError"),
        },
      };
    }

    // Use a custom dialog implementation
    return {
      storeAction: StoreAction.NONE,
      appState: {
        ...appState,
        openDialog: {
          name: "replaceWithLibraryItem",
        } as any, // Cast to any since this is a custom dialog not in the type definition
      },
    };
  },
  label: "labels.replaceWithLibraryItem",
  predicate: (elements, appState) => {
    // Enable for any number of selected elements (at least one)
    const selectedElements = getSelectedElements(
      elements,
      { selectedElementIds: appState.selectedElementIds },
      { includeBoundTextElement: true }
    );
    return selectedElements.length > 0;
  },
});

// Helper function to perform the actual replacement
// This will be called from the UI component that displays the library items
export const performReplaceWithLibraryItem = (
  libraryItem: LibraryItem,
  selectedElements: NonDeletedExcalidrawElement[],
  app: AppClassProperties
) => {
  const libraryElements = duplicateElements(libraryItem.elements, {
    randomizeSeed: true,
  });

  // Calculate the center point of all selected elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  // Get the bounding box of all selected elements
  const elementsMap: ElementsMap = new Map();
  selectedElements.forEach(element => {
    elementsMap.set(element.id, element);
  });
  
  // Get the IDs of elements we're going to replace (for later filtering)
  const selectedElementIds = selectedElements.map(element => element.id);
  
  selectedElements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
    
    // Mark all selected elements as deleted
    mutateElement(element, { isDeleted: true });
  });
  
  // Calculate center of the bounding box for selected elements
  const selectionCenterX = (minX + maxX) / 2;
  const selectionCenterY = (minY + maxY) / 2;
  
  // Get the frameId from the first selected element (if they're in different frames, we'll use the first one)
  const frameId = selectedElements.length > 0 ? selectedElements[0].frameId : null;

  // Calculate the bounding box of the library elements to find their center
  let libMinX = Infinity;
  let libMinY = Infinity;
  let libMaxX = -Infinity;
  let libMaxY = -Infinity;
  
  // Create new elements map for library elements
  const libElementsMap: ElementsMap = new Map();
  
  // First pass: store elements in map for coordinate calculation
  libraryElements.forEach(element => {
    libElementsMap.set(element.id, element);
  });
  
  // Second pass: calculate bounding box
  libraryElements.forEach(element => {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, libElementsMap);
    libMinX = Math.min(libMinX, x1);
    libMinY = Math.min(libMinY, y1);
    libMaxX = Math.max(libMaxX, x2);
    libMaxY = Math.max(libMaxY, y2);
  });
  
  // Calculate center of the library elements
  const libraryCenterX = (libMinX + libMaxX) / 2;
  const libraryCenterY = (libMinY + libMaxY) / 2;
  
  // Calculate the translation to apply
  const translateX = selectionCenterX - libraryCenterX;
  const translateY = selectionCenterY - libraryCenterY;
  
  // Position the library elements centered on the center of the selection
  const newElements = libraryElements.map(element => {
    return {
      ...element,
      x: element.x + translateX,
      y: element.y + translateY,
      frameId,
    };
  });

  // Get all current elements excluding the ones we're replacing
  const currentElements = app.scene.getElementsIncludingDeleted().filter(
    element => !selectedElementIds.includes(element.id)
  );
  
  // Add new elements to the scene, but exclude the elements we're replacing
  app.scene.replaceAllElements([
    ...currentElements,
    ...newElements,
  ]);
  
  // Create a properly typed selectedElementIds object
  const selectedElementIdsObj: Readonly<{ [id: string]: true }> = newElements.reduce(
    (acc, element) => {
      acc[element.id] = true;
      return acc;
    }, 
    {} as { [id: string]: true }
  );
  
  return {
    appState: {
      selectedElementIds: selectedElementIdsObj,
    },
    storeAction: StoreAction.CAPTURE,
  };
}; 