import React, { useCallback, useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { t } from "../i18n";
import { useApp, useExcalidrawSetAppState } from "./App";
import { libraryItemsAtom } from "../data/library";
import { useAtom } from "../editor-jotai";
import type { LibraryItem } from "../types";
import { performReplaceWithLibraryItem } from "../actions/actionReplaceWithLibraryItem";
import { getSelectedElements } from "../scene";
import "./ReplaceWithLibraryItemDialog.scss";
import { LibraryUnit } from "./LibraryUnit";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";
import type { SvgCache } from "../hooks/useLibraryItemSvg";
import { useUIAppState } from "../context/ui-appState";

export const ReplaceWithLibraryItemDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const app = useApp();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const [libraryItemsData] = useAtom(libraryItemsAtom);
  const { svgCache } = useLibraryCache();

  // Get the selected elements to replace
  const selectedElements = getSelectedElements(
    app.scene.getNonDeletedElements(),
    { selectedElementIds: appState.selectedElementIds },
    { includeBoundTextElement: true },
  );

  const handleSelectItem = useCallback(
    (libraryItem: LibraryItem) => {
      if (selectedElements.length > 0) {
        const { appState: newAppState } = performReplaceWithLibraryItem(
          libraryItem,
          selectedElements,
          app,
        );

        // Apply the new state properly
        setAppState((prevState) => ({
          ...prevState,
          selectedElementIds: newAppState.selectedElementIds,
          openDialog: null,
        }));
      }
    },
    [selectedElements, app, setAppState],
  );

  // Render nothing if loading or no items
  if (libraryItemsData.status === "loading" || selectedElements.length === 0) {
    return (
      <Dialog
        onCloseRequest={onClose}
        title={t("labels.replaceWithLibraryItem")}
        className="replace-with-library-item-dialog"
      >
        <div className="replace-with-library-item-dialog__loading">
          {t("labels.libraryLoadingMessage")}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.replaceWithLibraryItem")}
      className="replace-with-library-item-dialog"
    >
      {libraryItemsData.libraryItems.length === 0 ? (
        <div className="replace-with-library-item-dialog__empty">
          {t("library.noItems")}
        </div>
      ) : (
        <div className="replace-with-library-item-dialog__items">
          {libraryItemsData.libraryItems.map((item) => (
            <div
              key={item.id}
              className="replace-with-library-item-dialog__item"
              onClick={() => handleSelectItem(item)}
            >
              <LibraryUnit
                id={item.id}
                elements={item.elements}
                isPending={false}
                onClick={() => handleSelectItem(item)}
                selected={false}
                onToggle={() => {}}
                onDrag={() => {}}
                svgCache={svgCache}
                name={item.name}
                libraryItem={item}
              />
              {item.name && (
                <div className="replace-with-library-item-dialog__item-name">
                  {item.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
};
