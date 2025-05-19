import { EyeIcon, EyeSlashIcon } from "../components/icons"; 
import { newElementWith } from "../element/mutateElement";
import { isFrameLikeElement } from "../element/typeChecks";
import type { ExcalidrawElement } from "../element/types";
import { KEYS } from "../keys";
import { getSelectedElements } from "../scene";
import { StoreAction } from "../store";
import { arrayToMap } from "../utils";
import { register } from "./register";

const shouldHide = (elements: readonly ExcalidrawElement[]) =>
  elements.every((el) => !el.hidden);

export const actionToggleElementVisibility = register({
  name: "toggleElementVisibility",
  label: (elements, appState, app) => {
    const selected = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: false,
    });
    if (selected.length === 1 && !isFrameLikeElement(selected[0])) {
      return selected[0].hidden
        ? "labels.elementVisibility.show"
        : "labels.elementVisibility.hide";
    }

    return shouldHide(selected)
      ? "labels.elementVisibility.hideAll"
      : "labels.elementVisibility.showAll";
  },
  icon: (appState, elements) => {
    const selectedElements = getSelectedElements(elements, appState);
    return shouldHide(selectedElements) ? EyeSlashIcon : EyeIcon;
  },
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.length > 0;
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements({
      selectedElementIds: appState.selectedElementIds,
      includeBoundTextElement: true,
      includeElementsInFrames: true,
    });

    if (!selectedElements.length) {
      return false;
    }

    const nextHiddenState = shouldHide(selectedElements);
    const selectedElementsMap = arrayToMap(selectedElements);

    return {
      elements: elements.map((element) => {
        if (!selectedElementsMap.has(element.id)) {
          return element;
        }
        return newElementWith(element, { hidden: nextHiddenState });
      }),
      appState : {
        ...appState,
        selectedElementIds: {},        
      },
      storeAction: StoreAction.CAPTURE,
    };
  },
  keyTest: (event) => {
    return (
      event.key.toLowerCase() === "h" &&
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey
    );
  },
});

export const actionShowAllElements = register({
  name: "showAllElements",
  paletteName: "Show all elements",
  trackEvent: { category: "canvas" },
  viewMode: false,
  icon: EyeIcon,
  predicate: (elements) => {
    // debugger;
    return true
  },
  perform: (elements, appState) => {
    // debugger;
    return {
      elements: elements.map((element) => {
        if (!element.hidden) {
          return element;
        }
        return newElementWith(element, { hidden: false });
      }),
      appState,
      storeAction: StoreAction.CAPTURE,
    };
  },
  label: "labels.elementVisibility.showAll",
});