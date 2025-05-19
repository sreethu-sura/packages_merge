import { CODES, KEYS } from "../keys";
import { register } from "./register";
import type { AppState, UIAppState } from "../types";
import { InsertModeIcon, NormalModeIcon } from "../components/icons";
import { StoreAction } from "../store";

export const actionToggleMode = register({
  name: "toggleMode",
  icon: (appState: UIAppState) =>
    appState.insertModeEnabled ? InsertModeIcon : NormalModeIcon,
  keywords: ["mode", "insert", "normal"],
  label: "labels.insertMode",
  viewMode: true,
  trackEvent: {
    category: "canvas",
  },
  predicate: (elements, appState) => true,
  checked: (appState) => appState.insertModeEnabled,
  perform: (elements, appState) => {
    console.log("Toggling insert mode:", !appState.insertModeEnabled);
    return {
      appState: {
        ...appState,
        insertModeEnabled: !appState.insertModeEnabled,
      },
      commitToHistory: false,
      storeAction: StoreAction.NONE,
    };
  },
  keyTest: (event) =>
    event.altKey &&
    event.code === CODES.I &&
    !event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey,
});
