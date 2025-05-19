import {
    SettingsIcon,
  } from "../components/icons";
  import { register } from "./register";
  import type { Theme } from "../element/types";
  import "../components/ToolIcon.scss";
  import { StoreAction } from "../store";
  export const actionSettings = register({
    name: "settings",
    label: "Settings",
    icon: SettingsIcon,
    trackEvent: { category: "settings"},
    predicate: (elements, appState, props, app) => {
      return !appState.viewModeEnabled; // Ensure not in view-only mode
    },
    perform: async (_elements, appState, _, { focusContainer }) => {
      try {
        if (appState.openDialog?.name === "settings") {
          focusContainer();
        }
        return {
          appState: {
            ...appState,
            openDialog:
              appState.openDialog?.name === "settings"
                ? null
                : {
                    name: "settings",
                  },
          },
          storeAction: StoreAction.NONE,
        };
        // Convert canvas to PDF
        // const pdfBlob = await exportToPdf(elements, appState, app.files);
        // // Trigger file download
        // const fileName = `${app.getName()}.pdf`;
        // const downloadFile = (blob: Blob, fileName: string) => {
        //   const link = document.createElement("a");
        //   link.href = URL.createObjectURL(blob);
        //   link.download = fileName;
        //   link.click();
        //   URL.revokeObjectURL(link.href);
        // };
        // downloadFile(pdfBlob, fileName);
        // return {
        //   storeAction: StoreAction.NONE,
        //   appState: {
        //     ...appState,
        //     toast: {
        //       message: `Saved to ${fileName}`,
        //     },
        //   },
        // };
      } catch (error) {
        console.error("Failed to save as PDF:", error);
        return { storeAction: StoreAction.NONE };
      }
    },
    // keyTest: (event) =>
    //   event.key === KEYS.P && event[KEYS.CTRL_OR_CMD] && !event.shiftKey, // Optional: Add a keyboard shortcut
  });