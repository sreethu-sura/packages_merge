import { EXPORT_DATA_TYPES, VERSIONS } from "../constants";
import { t } from "../i18n";
import type { ExcalidrawProps, LibraryItem, UIAppState } from "../types";
import type { ExcalidrawElement } from "../element/types";
import { EditIcon } from "./icons";
import { ToolButton } from "./ToolButton";
import { useCallback, useEffect, useRef } from "react";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";

type EditLibraryItemButtonProps = {
  libraryItem: LibraryItem;
  onSave: (updatedItem: LibraryItem) => void;
  theme: UIAppState["theme"];
};

const EditLibraryItemButton = ({
  libraryItem,
  onSave,
  theme,
}: EditLibraryItemButtonProps) => {
  // Reference to maintain active edit windows
  const editWindowRef = useRef<Window | null>(null);
  const { deleteItemsFromLibraryCache } = useLibraryCache();

  // Event listener for messages from edit window
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data.type === "libraryItemUpdate" &&
        event.data.libraryItemId === libraryItem.id
      ) {
        try {
          // Get the updated elements from the edit window
          const updatedElements = event.data.elements;
          
          // Update version nonces for all elements to force recognition of changes
          const elementsWithUpdatedVersions = updatedElements.map((element: ExcalidrawElement) => ({
            ...element,
            // Generate a new versionNonce to ensure the change is detected
            versionNonce: Math.random(),
          }));
          
          // Create updated item with new elements and updated timestamp to force change detection
          const updatedItem: LibraryItem = {
            ...libraryItem,
            elements: elementsWithUpdatedVersions,
            name: event.data.name || libraryItem.name,
            // Ensure the created timestamp is updated to trigger detection of changes
            created: Date.now(),
          };

          // Clear the cache for this item to update the preview
          deleteItemsFromLibraryCache([updatedItem.id]);

          console.log("Saving updated library item:", updatedItem);
          
          // Update the library
          onSave(updatedItem);
        } catch (error) {
          console.error("Error updating library item:", error);
        }

        // Close the editor window
        if (event.source) {
          (event.source as Window).close();
        }

        // Clear the window reference
        editWindowRef.current = null;
      }
    },
    [libraryItem, onSave, deleteItemsFromLibraryCache],
  );

  // Set up and clean up event listener
  useEffect(() => {
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      // Close edit window if component unmounts
      if (editWindowRef.current) {
        editWindowRef.current.close();
        editWindowRef.current = null;
      }
    };
  }, [handleMessage]);

  const handleEditClick = useCallback(() => {
    // Don't open multiple edit windows for the same item
    if (editWindowRef.current) {
      editWindowRef.current.focus();
      return;
    }

    // Create a data object to send to the new window
    const data = {
      type: EXPORT_DATA_TYPES.excalidraw,
      version: VERSIONS.excalidraw,
      source: window.location.origin,
      elements: libraryItem.elements,
      appState: {
        theme,
        viewBackgroundColor: "#ffffff",
      },
      libraryItem: {
        id: libraryItem.id,
        name: libraryItem.name || "",
        status: libraryItem.status,
        created: libraryItem.created,
        metadata: libraryItem.metadata,
      },
    };

    // Convert data to base64 to avoid URL length issues
    const base64Data = btoa(encodeURIComponent(JSON.stringify(data)));

    // Open a new window with just this element for editing
    const editWindow = window.open(
      `${window.location.origin}?editLibraryItem=true&data=${base64Data}`,
      `edit_library_item_${libraryItem.id}`,
      "width=1000,height=800",
    );

    if (editWindow) {
      editWindowRef.current = editWindow;

      // Clear reference if window is closed
      editWindow.onbeforeunload = () => {
        editWindowRef.current = null;
      };
    }
  }, [libraryItem, theme]);

  return (
    <ToolButton
      type="button"
      icon={EditIcon}
      title={t("buttons.edit")}
      aria-label={t("buttons.edit")}
      onClick={handleEditClick}
      className="library-unit__edit-button"
      data-testid="edit-library-item"
    />
  );
};

export default EditLibraryItemButton;
