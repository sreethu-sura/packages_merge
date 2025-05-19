import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { t } from "../i18n";
import type { LibraryItem} from "../types";
import { UIAppState } from "../types";
import { exportToSvg } from "../scene/export";
import { useApp } from "./App";
import { ToolButton } from "./ToolButton";
import { KEYS } from "../keys";
import "./EditLibraryItemModal.scss";

interface EditLibraryItemModalProps {
  libraryItem: LibraryItem | null;
  onClose: () => void;
  onSave: (updatedItem: LibraryItem) => void;
}

export const EditLibraryItemModal = ({
  libraryItem,
  onClose,
  onSave,
}: EditLibraryItemModalProps) => {
  const app = useApp();
  const [itemName, setItemName] = useState("");
  const svgRef = useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (libraryItem) {
      // Set the item name
      setItemName(libraryItem.name || "");

      // Generate SVG preview
      setIsRendering(true);
      setRenderError(null);
      renderSvgPreview();
    }
  }, [libraryItem]);

  const renderSvgPreview = async () => {
    if (!libraryItem || !svgRef.current) {
      setIsRendering(false);
      return;
    }

    try {
      const svg = await exportToSvg(
        libraryItem.elements,
        {
          viewBackgroundColor: "#ffffff",
          exportBackground: true,
        },
        null,
        {
          skipInliningFonts: true,
        },
      );

      if (svgRef.current) {
        svgRef.current.innerHTML = "";
        svgRef.current.appendChild(svg);
      }
    } catch (error) {
      console.error("Error rendering SVG preview:", error);
      setRenderError(
        (error as Error)?.message || "Failed to render item preview",
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleSave = () => {
    if (!libraryItem) return;

    // Create an updated library item with the new name but same elements
    const updatedItem = {
      ...libraryItem,
      name: itemName,
    };

    onSave(updatedItem);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      onClose();
    } else if (event.key === KEYS.ENTER && event.ctrlKey) {
      handleSave();
    }
  };

  if (!libraryItem) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.editLibraryItem")}
      size="wide"
      closeOnClickOutside={true}
    >
      <div className="library-item-editor" onKeyDown={handleKeyDown}>
        <div className="library-item-editor__preview">
          {isRendering ? (
            <div className="library-item-editor__loading">
              {t("labels.loadingScene")}...
            </div>
          ) : renderError ? (
            <div className="library-item-editor__error">{renderError}</div>
          ) : (
            <div ref={svgRef} className="library-item-editor__svg-preview" />
          )}
        </div>
        <div className="library-item-editor__form">
          <div className="library-item-editor__name">
            <label htmlFor="library-item-name">
              {t("publishDialog.itemName")}
              <span aria-hidden="true" className="required">
                *
              </span>
            </label>
            <input
              type="text"
              id="library-item-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={t("publishDialog.itemName")}
              autoFocus
            />
          </div>
          <div className="library-item-editor__buttons">
            <ToolButton
              type="button"
              title={t("buttons.cancel")}
              aria-label={t("buttons.cancel")}
              label={t("buttons.cancel")}
              onClick={onClose}
              data-testid="cancel-library-item-edit"
            />
            <ToolButton
              type="button"
              title={t("buttons.save")}
              aria-label={t("buttons.save")}
              label={t("buttons.save")}
              onClick={handleSave}
              data-testid="save-library-item-edit"
              className="library-item-editor__save-button"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
