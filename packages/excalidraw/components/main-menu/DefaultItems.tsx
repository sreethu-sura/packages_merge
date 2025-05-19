import { getShortcutFromShortcutName } from "../../actions/shortcuts";
import { useI18n } from "../../i18n";
import {
  useExcalidrawSetAppState,
  useExcalidrawActionManager,
  useExcalidrawElements,
  useAppProps,
} from "../App";
import {
  boltIcon,
  DeviceDesktopIcon,
  ExportIcon,
  ExportImageIcon,
  HelpIcon,
  LoadIcon,
  MoonIcon,
  save,
  searchIcon,
  SunIcon,
  TrashIcon,
  usersIcon,
  PdfIcon,
  CsvIcon,
  SettingsIcon,
} from "../icons";
import { GithubIcon, DiscordIcon, XBrandIcon } from "../icons";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import DropdownMenuItemLink from "../dropdownMenu/DropdownMenuItemLink";
import {
  actionClearCanvas,
  actionLoadScene,
  actionSaveToActiveFile,
  actionShortcuts,
  actionToggleSearchMenu,
  actionToggleTheme,
  actionSaveToPdf,
  actionExportToCsv,
} from "../../actions";
import { ActionManager } from "../../actions/manager";
import clsx from "clsx";
import { activeConfirmDialogAtom } from "../ActiveConfirmDialog";
import { useSetAtom } from "../../editor-jotai";
import { useUIAppState } from "../../context/ui-appState";
import { openConfirmModal } from "../OverwriteConfirm/OverwriteConfirmState";
import Trans from "../Trans";
import DropdownMenuItemContentRadio from "../dropdownMenu/DropdownMenuItemContentRadio";
import { THEME } from "../../constants";
import type { Theme } from "../../element/types";
import { trackEvent } from "../../analytics";
import "./DefaultItems.scss";
import { actionSettings } from "../../actions/actionSettings";

export const LoadScene = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const elements = useExcalidrawElements();

  if (!actionManager.isActionEnabled(actionLoadScene)) {
    return null;
  }

  const handleSelect = async () => {
    // Skip confirmation dialog and directly execute the action
    actionManager.executeAction(actionLoadScene);
  };

  return (
    <DropdownMenuItem
      icon={LoadIcon}
      onSelect={handleSelect}
      data-testid="load-button"
      shortcut={getShortcutFromShortcutName("loadScene")}
      aria-label={t("buttons.load")}
    >
      {t("buttons.load")}
    </DropdownMenuItem>
  );
};
LoadScene.displayName = "LoadScene";

export const SaveToActiveFile = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionSaveToActiveFile)) {
    return null;
  }

  return (
    <DropdownMenuItem
      shortcut={getShortcutFromShortcutName("saveScene")}
      data-testid="save-button"
      onSelect={() => actionManager.executeAction(actionSaveToActiveFile)}
      icon={save}
      aria-label={`${t("buttons.save")}`}
    >{`${t("buttons.save")}`}</DropdownMenuItem>
  );
};
SaveToActiveFile.displayName = "SaveToActiveFile";

export const SaveAsImage = () => {
  const setAppState = useExcalidrawSetAppState();
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      icon={ExportImageIcon}
      data-testid="image-export-button"
      onSelect={() => setAppState({ openDialog: { name: "imageExport" } })}
      shortcut={getShortcutFromShortcutName("imageExport")}
      aria-label={t("buttons.exportImage")}
    >
      {t("buttons.exportImage")}
    </DropdownMenuItem>
  );
};
SaveAsImage.displayName = "SaveAsImage";

export const SaveToPdf = () => {
  const actionManager = useExcalidrawActionManager();
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      icon={PdfIcon}
      onSelect={() => {
        actionManager.executeAction(actionSaveToPdf);
      }}
      aria-label="Save to PDF"
    >
      Save to PDF
    </DropdownMenuItem>
  );
};
SaveToPdf.displayName = "SaveToPdf";

export const ExportToCsv = () => {
  const actionManager = useExcalidrawActionManager();
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      icon={CsvIcon}
      onSelect={() => {
        actionManager.executeAction(actionExportToCsv);
      }}
      aria-label="Save to CSV"
    >
      Save to CSV
    </DropdownMenuItem>
  );
};
ExportToCsv.displayName = "ExportToCsv";

export const Settings = (opts?: { className?: string }) => {
  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      data-testid="settings-menu-item"
      icon={SettingsIcon}
      onSelect={() => actionManager.executeAction(actionSettings)}
      aria-label="Settings"
    >
      Settings
    </DropdownMenuItem>
  );
};
Settings.displayName = "Settings";

export const CommandPalette = (opts?: { className?: string }) => {
  const setAppState = useExcalidrawSetAppState();
  const { t } = useI18n();

  return (
    <DropdownMenuItem
      icon={boltIcon}
      data-testid="command-palette-button"
      onSelect={() => {
        trackEvent("command_palette", "open", "menu");
        setAppState({ openDialog: { name: "commandPalette" } });
      }}
      shortcut={getShortcutFromShortcutName("commandPalette")}
      aria-label={t("commandPalette.title")}
      className={opts?.className}
    >
      {t("commandPalette.title")}
    </DropdownMenuItem>
  );
};
CommandPalette.displayName = "CommandPalette";

export const SearchMenu = (opts?: { className?: string }) => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      icon={searchIcon}
      data-testid="search-menu-button"
      onSelect={() => {
        actionManager.executeAction(actionToggleSearchMenu);
      }}
      shortcut={getShortcutFromShortcutName("searchMenu")}
      aria-label={t("search.title")}
      className={opts?.className}
    >
      {t("search.title")}
    </DropdownMenuItem>
  );
};
SearchMenu.displayName = "SearchMenu";

export const Help = () => {
  const { t } = useI18n();

  const actionManager = useExcalidrawActionManager();

  return (
    <DropdownMenuItem
      data-testid="help-menu-item"
      icon={HelpIcon}
      onSelect={() => actionManager.executeAction(actionShortcuts)}
      shortcut="?"
      aria-label={t("helpDialog.title")}
    >
      {t("helpDialog.title")}
    </DropdownMenuItem>
  );
};
Help.displayName = "Help";

export const ClearCanvas = () => {
  const { t } = useI18n();

  const setActiveConfirmDialog = useSetAtom(activeConfirmDialogAtom);
  const actionManager = useExcalidrawActionManager();

  if (!actionManager.isActionEnabled(actionClearCanvas)) {
    return null;
  }

  return (
    <DropdownMenuItem
      icon={TrashIcon}
      onSelect={() => setActiveConfirmDialog("clearCanvas")}
      data-testid="clear-canvas-button"
      aria-label={t("buttons.clearReset")}
    >
      {t("buttons.clearReset")}
    </DropdownMenuItem>
  );
};
ClearCanvas.displayName = "ClearCanvas";

export const ToggleTheme = (
  props:
    | {
        allowSystemTheme: true;
        theme: Theme | "system";
        onSelect: (theme: Theme | "system") => void;
      }
    | {
        allowSystemTheme?: false;
        onSelect?: (theme: Theme) => void;
      },
) => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();
  const shortcut = getShortcutFromShortcutName("toggleTheme");

  if (!actionManager.isActionEnabled(actionToggleTheme)) {
    return null;
  }

  if (props?.allowSystemTheme) {
    return (
      <DropdownMenuItemContentRadio
        name="theme"
        value={props.theme}
        onChange={(value: Theme | "system") => props.onSelect(value)}
        choices={[
          {
            value: THEME.LIGHT,
            label: SunIcon,
            ariaLabel: `${t("buttons.lightMode")} - ${shortcut}`,
          },
          {
            value: THEME.DARK,
            label: MoonIcon,
            ariaLabel: `${t("buttons.darkMode")} - ${shortcut}`,
          },
          {
            value: "system",
            label: DeviceDesktopIcon,
            ariaLabel: t("buttons.systemMode"),
          },
        ]}
      >
        {t("labels.theme")}
      </DropdownMenuItemContentRadio>
    );
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => {
        // do not close the menu when changing theme
        event.preventDefault();

        if (props?.onSelect) {
          props.onSelect(
            appState.theme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
          );
        } else {
          return actionManager.executeAction(actionToggleTheme);
        }
      }}
      icon={appState.theme === THEME.DARK ? SunIcon : MoonIcon}
      data-testid="toggle-dark-mode"
      shortcut={shortcut}
      aria-label={
        appState.theme === THEME.DARK
          ? t("buttons.lightMode")
          : t("buttons.darkMode")
      }
    >
      {appState.theme === THEME.DARK
        ? t("buttons.lightMode")
        : t("buttons.darkMode")}
    </DropdownMenuItem>
  );
};
ToggleTheme.displayName = "ToggleTheme";

export const ChangeCanvasBackground = () => {
  const { t } = useI18n();
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();
  const appProps = useAppProps();

  if (
    appState.viewModeEnabled ||
    !appProps.UIOptions.canvasActions.changeViewBackgroundColor
  ) {
    return null;
  }
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div
        data-testid="canvas-background-label"
        style={{ fontSize: ".75rem", marginBottom: ".5rem" }}
      >
        {t("labels.canvasBackground")}
      </div>
      <div style={{ padding: "0 0.625rem" }}>
        {actionManager.renderAction("changeViewBackgroundColor")}
      </div>
    </div>
  );
};
ChangeCanvasBackground.displayName = "ChangeCanvasBackground";

export const Export = () => {
  const { t } = useI18n();
  const setAppState = useExcalidrawSetAppState();
  return (
    <DropdownMenuItem
      icon={ExportIcon}
      onSelect={() => {
        setAppState({ openDialog: { name: "jsonExport" } });
      }}
      data-testid="json-export-button"
      aria-label={t("buttons.export")}
    >
      {t("buttons.export")}
    </DropdownMenuItem>
  );
};
Export.displayName = "Export";

export const Socials = () => {
  const { t } = useI18n();

  return (
    <>
      <DropdownMenuItemLink
        icon={GithubIcon}
        href="https://github.com/excalidraw/excalidraw"
        aria-label="GitHub"
      >
        GitHub
      </DropdownMenuItemLink>
      <DropdownMenuItemLink
        icon={XBrandIcon}
        href="https://x.com/excalidraw"
        aria-label="X"
      >
        {t("labels.followUs")}
      </DropdownMenuItemLink>
      <DropdownMenuItemLink
        icon={DiscordIcon}
        href="https://discord.gg/UexuTaE"
        aria-label="Discord"
      >
        {t("labels.discordChat")}
      </DropdownMenuItemLink>
    </>
  );
};
Socials.displayName = "Socials";

export const LiveCollaborationTrigger = ({
  onSelect,
  isCollaborating,
}: {
  onSelect: () => void;
  isCollaborating: boolean;
}) => {
  const { t } = useI18n();
  return (
    <DropdownMenuItem
      data-testid="collab-button"
      icon={usersIcon}
      className={clsx({
        "active-collab": isCollaborating,
      })}
      onSelect={onSelect}
    >
      {t("labels.liveCollaboration")}
    </DropdownMenuItem>
  );
};

LiveCollaborationTrigger.displayName = "LiveCollaborationTrigger";
