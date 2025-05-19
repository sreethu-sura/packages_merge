import {
  ExportIcon,
  questionCircle,
  saveAs,
  PdfIcon,
  CsvIcon,
} from "../components/icons";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { loadFromJSON, saveAsJSON } from "../data";
import { resaveAsImageWithScene } from "../data/resave";
import { t } from "../i18n";
import { useDevice } from "../components/App";
import { KEYS } from "../keys";
import { register } from "./register";
import { CheckboxItem } from "../components/CheckboxItem";
import { getExportSize } from "../scene/export";
import { DEFAULT_EXPORT_PADDING, EXPORT_SCALES, THEME } from "../constants";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getNonDeletedElements } from "../element";
import { isImageFileHandle } from "../data/blob";
import { nativeFileSystemSupported, fileSave } from "../data/filesystem";
import type { Theme } from "../element/types";
import { exportToCsv } from "../data/exportToCsv";
import { serializeAsJSON } from "../data/json";
import "../components/ToolIcon.scss";
import { StoreAction } from "../store";

export const actionChangeProjectName = register({
  name: "changeProjectName",
  label: "labels.fileTitle",
  trackEvent: false,
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, name: value },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ appState, updateData, appProps, data, app }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={app.getName()}
      onChange={(name: string) => updateData(name)}
      ignoreFocus={data?.ignoreFocus ?? false}
    />
  ),
});

export const actionChangeExportScale = register({
  name: "changeExportScale",
  label: "imageExportDialog.scale",
  trackEvent: { category: "export", action: "scale" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ elements: allElements, appState, updateData }) => {
    const elements = getNonDeletedElements(allElements);
    const exportSelected = isSomeElementSelected(elements, appState);
    const exportedElements = exportSelected
      ? getSelectedElements(elements, appState)
      : elements;

    return (
      <>
        {EXPORT_SCALES.map((s) => {
          const [width, height] = getExportSize(
            exportedElements,
            DEFAULT_EXPORT_PADDING,
            s,
          );

          const scaleButtonTitle = `${t(
            "imageExportDialog.label.scale",
          )} ${s}x (${width}x${height})`;

          return (
            <ToolButton
              key={s}
              size="small"
              type="radio"
              icon={`${s}x`}
              name="export-canvas-scale"
              title={scaleButtonTitle}
              aria-label={scaleButtonTitle}
              id="export-canvas-scale"
              checked={s === appState.exportScale}
              onChange={() => updateData(s)}
            />
          );
        })}
      </>
    );
  },
});

export const actionChangeExportBackground = register({
  name: "changeExportBackground",
  label: "imageExportDialog.label.withBackground",
  trackEvent: { category: "export", action: "toggleBackground" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportBackground}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.withBackground")}
    </CheckboxItem>
  ),
});

export const actionChangeExportEmbedScene = register({
  name: "changeExportEmbedScene",
  label: "imageExportDialog.tooltip.embedScene",
  trackEvent: { category: "export", action: "embedScene" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportEmbedScene}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.embedScene")}
      <Tooltip label={t("imageExportDialog.tooltip.embedScene")} long={true}>
        <div className="excalidraw-tooltip-icon">{questionCircle}</div>
      </Tooltip>
    </CheckboxItem>
  ),
});

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  label: "buttons.save",
  icon: ExportIcon,
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.saveToActiveFile &&
      !!appState.fileHandle &&
      !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, value, app) => {
    const fileHandleExists = !!appState.fileHandle;

    try {
      const { fileHandle } = isImageFileHandle(appState.fileHandle)
        ? await resaveAsImageWithScene(
            elements,
            appState,
            app.files,
            app.getName(),
          )
        : await saveAsJSON(elements, appState, app.files, app.getName());

      return {
        storeAction: StoreAction.NONE,
        appState: {
          ...appState,
          fileHandle,
          toast: fileHandleExists
            ? {
                message: fileHandle?.name
                  ? t("toast.fileSavedToFilename").replace(
                      "{filename}",
                      `"${fileHandle.name}"`,
                    )
                  : t("toast.fileSaved"),
              }
            : null,
        },
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return { storeAction: StoreAction.NONE };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event[KEYS.CTRL_OR_CMD] && !event.shiftKey,
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  label: "exportDialog.disk_title",
  icon: ExportIcon,
  viewMode: true,
  trackEvent: { category: "export" },
  perform: async (elements, appState, value, app) => {
    try {
      const { fileHandle } = await saveAsJSON(
        elements,
        {
          ...appState,
          fileHandle: null,
        },
        app.files,
        app.getName(),
      );
      return {
        storeAction: StoreAction.NONE,
        appState: {
          ...appState,
          openDialog: null,
          fileHandle,
          toast: { message: t("toast.fileSaved"), duration: 2000 },
        },
      };
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error(error);
      } else {
        console.warn(error);
      }
      return { storeAction: StoreAction.NONE };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.S && event.shiftKey && event[KEYS.CTRL_OR_CMD],
  PanelComponent: ({ updateData }) => (
    <ToolButton
      type="button"
      icon={saveAs}
      title={t("buttons.saveAs")}
      aria-label={t("buttons.saveAs")}
      showAriaLabel={useDevice().editor.isMobile}
      hidden={!nativeFileSystemSupported}
      onClick={() => updateData(null)}
      data-testid="save-as-button"
    />
  ),
});

export const actionLoadScene = register({
  name: "loadScene",
  label: "buttons.load",
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return (
      !!app.props.UIOptions.canvasActions.loadScene && !appState.viewModeEnabled
    );
  },
  perform: async (elements, appState, _, app) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
        files,
      } = await loadFromJSON(appState, elements);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        files,
        storeAction: StoreAction.CAPTURE,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.warn(error);
        return false;
      }
      return {
        elements,
        appState: { ...appState, errorMessage: error.message },
        files: app.files,
        storeAction: StoreAction.NONE,
      };
    }
  },
  keyTest: (event) => event[KEYS.CTRL_OR_CMD] && event.key === KEYS.O,
});

export const actionExportWithDarkMode = register({
  name: "exportWithDarkMode",
  label: "imageExportDialog.label.darkMode",
  trackEvent: { category: "export", action: "toggleTheme" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportWithDarkMode: value },
      storeAction: StoreAction.NONE,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "-45px",
        marginBottom: "10px",
      }}
    >
      <DarkModeToggle
        value={appState.exportWithDarkMode ? THEME.DARK : THEME.LIGHT}
        onChange={(theme: Theme) => {
          updateData(theme === THEME.DARK);
        }}
        title={t("imageExportDialog.label.darkMode")}
      />
    </div>
  ),
});

export const actionSaveToPdf = register({
  name: "saveToPdf",
  label: "Save to PDF",
  icon: PdfIcon, // You'll need to import or create a PDF icon
  trackEvent: { category: "export" },
  predicate: (elements, appState, props, app) => {
    return !appState.viewModeEnabled; // Ensure not in view-only mode
  },
  perform: async (elements, appState, value, app) => {
    // Use the App to show the frame selector dialog
    app.setState({
      openDialog: {
        name: "frameSelectorForPdf",
      },
    });

    return {
      storeAction: StoreAction.NONE,
    };
  },
  keyTest: (event) =>
    event.key === KEYS.P && event[KEYS.CTRL_OR_CMD] && !event.shiftKey, // Optional: Add a keyboard shortcut
});

export const actionExportToCsv = register({
  name: "exportToCsv",
  label: "Save to CSV",
  icon: CsvIcon,
  trackEvent: { category: "export" },
  predicate: (elements, appState) => {
    // Enable CSV export only if not in view-only mode
    return !appState.viewModeEnabled;
  },
  perform: async (elements, appState, value, app) => {
    if (value && value.selectedProperties) {
      try {
        console.log("[DEBUG] CSV export started with selected properties");
        console.log("[DEBUG] Native FS supported:", nativeFileSystemSupported ? "YES" : "NO");
        
        // Step 1: Save data as JSON first
        const jsonData = serializeAsJSON(
          elements,
          appState,
          app.files,
          "local",
        );
        const parsedData = JSON.parse(jsonData); // Parse JSON for CSV conversion

        // Step 2: Generate CSV from JSON with selected properties
        const csvBlob = await exportToCsv(
          parsedData.elements,
          appState,
          app.files,
          value.selectedProperties,
          value.options, // Pass options including includeNullValues
        );
        
        console.log("[DEBUG] CSV generated, size:", csvBlob.size, "bytes");
        console.log("[DEBUG] About to call fileSave for CSV - watch for the file system dialog");

        // Step 3: Use fileSave instead of URL and link
        const fileName = `${app.getName()}`;
        
        try {
          await fileSave(csvBlob, {
            name: fileName,
            extension: "csv",
            description: "CSV Document",
          });
          
          console.log("[DEBUG] CSV file save completed successfully");
          
          return {
            storeAction: StoreAction.NONE,
            appState: {
              ...appState,
              toast: { message: `Saved to ${fileName}.csv`, duration: 2000 },
            },
          };
        } catch (saveError: any) {
          console.error("[DEBUG] Error saving CSV file:", saveError);
          
          // If it's an abort error (user cancellation), just log it
          if (saveError?.name === "AbortError") {
            console.log("[DEBUG] CSV save operation cancelled by user");
            return { storeAction: StoreAction.NONE };
          }
          
          // Otherwise show an error message
          return {
            storeAction: StoreAction.NONE,
            appState: {
              ...appState,
              errorMessage: `Failed to export CSV: ${
                saveError.message || "Unknown error"
              }`,
            },
          };
        }
      } catch (error) {
        console.error("[DEBUG] Failed to export CSV:", error);
        return { 
          storeAction: StoreAction.NONE,
          appState: {
            ...appState,
            errorMessage: `Failed to create CSV: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        };
      }
    } else {
      // Show the CSV export dialog
      return {
        storeAction: StoreAction.NONE,
        appState: {
          ...appState,
          openDialog: { name: "csvExport" },
        },
      };
    }
  },
  keyTest: (event) => event.key === "C" && event.ctrlKey && event.shiftKey,
});
