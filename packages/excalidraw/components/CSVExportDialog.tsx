import React, { useState, useEffect, useRef } from "react";
import { Dialog } from "./Dialog";
import type { NonDeletedExcalidrawElement } from "../element/types";
import type { AppState, BinaryFiles } from "../types";
import { t } from "../i18n";
import { exportToCsv } from "../data/exportToCsv";
import { serializeAsJSON } from "../data/json";
import { Switch } from "./Switch";
import { FilledButton } from "./FilledButton";
import clsx from "clsx";

import "./CSVExportDialog.scss";

// Don't use t() for these strings yet - we'll use literal values until they're added to the translation system
const CSV_EXPORT_DIALOG = {
  title: "CSV Export Options",
  description:
    "Select the properties you want to include in the CSV file and arrange them in the desired order.",
  availableProperties: "Available Properties",
  columnOrder: "Column Order",
  noProperties: "No properties selected",
  exportButton: "Export",
  exportToCSV: "Export to CSV",
  filterEmptyValues: "Filter rows with empty values for this property",
};

// Standard properties that all elements have
const STANDARD_PROPERTIES = [
  { id: "id", label: "ID", includeByDefault: false },
  { id: "type", label: "Type", includeByDefault: true },
  { id: "boundText", label: "Bound Text", includeByDefault: true },
  { id: "x", label: "X Position", includeByDefault: false },
  { id: "y", label: "Y Position", includeByDefault: false },
  { id: "width", label: "Width", includeByDefault: false },
  { id: "height", label: "Height", includeByDefault: false },
  { id: "angle", label: "Angle", includeByDefault: false },
  { id: "connectedto", label: "Connected To", includeByDefault: true },
  { id: "center_x_feet", label: "Centered X (feet)", includeByDefault: true },
  { id: "center_y_feet", label: "Centered Y (feet)", includeByDefault: true },
];

// For our property type
interface CSVPropertyOption {
  id: string;
  label: string;
  includeByDefault: boolean;
  filterEmpty?: boolean;
}

type CSVExportDialogProps = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  onCloseRequest: () => void;
  onExportToCsv: (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
    selectedProperties: { id: string; label: string }[],
    options?: { includeNullValues: boolean },
  ) => void;
  appName: string;
};

export const CSVExportDialog = ({
  elements,
  appState,
  files,
  onCloseRequest,
  onExportToCsv,
  appName,
}: CSVExportDialogProps) => {
  // Extract all unique custom property keys across all elements
  const customPropertyKeyMap = new Map<string, string>(); // lowercase -> original case
  for (const element of elements) {
    if (element.customData) {
      Object.keys(element.customData).forEach((key) => {
        const lowerKey = key.toLowerCase();
        // Keep the first occurrence's casing
        if (!customPropertyKeyMap.has(lowerKey)) {
          customPropertyKeyMap.set(lowerKey, key);
        }
      });
    }
  }

  // Convert custom properties to our property format
  const customProperties: CSVPropertyOption[] = Array.from(
    customPropertyKeyMap.values(),
  ).map((key) => ({
    id: key,
    label: key,
    includeByDefault: true,
  }));

  // Combine standard and custom properties
  const allProperties: CSVPropertyOption[] = [
    ...STANDARD_PROPERTIES,
    ...customProperties,
  ];

  // State for selected properties
  const [selectedProperties, setSelectedProperties] = useState<
    CSVPropertyOption[]
  >(allProperties.filter((prop) => prop.includeByDefault));

  // State for column order
  const [columnOrder, setColumnOrder] = useState<string[]>(
    allProperties.filter((prop) => prop.includeByDefault).map((p) => p.id),
  );

  // Refs for drag implementation
  const dragItem = useRef<number | null>(null);
  const dragItemNode = useRef<HTMLDivElement | null>(null);

  // State for tracking drag operation
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedOverItem, setDraggedOverItem] = useState<string | null>(null);

  // Clean up drag state when component unmounts
  useEffect(() => {
    return () => {
      dragItem.current = null;
      dragItemNode.current = null;
    };
  }, []);

  // Toggle property selection
  const toggleProperty = (property: CSVPropertyOption) => {
    const isSelected = selectedProperties.some((p) => p.id === property.id);

    if (isSelected) {
      setSelectedProperties(
        selectedProperties.filter((p) => p.id !== property.id),
      );
      setColumnOrder(columnOrder.filter((id) => id !== property.id));
    } else {
      // When adding a property, initialize it with filterEmpty: false
      const newProperty = { ...property, filterEmpty: false };
      setSelectedProperties([...selectedProperties, newProperty]);
      setColumnOrder([...columnOrder, property.id]);
    }
  };

  // Direct drag handlers (more reliable than HTML5 Drag and Drop in some browsers)
  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement>,
    index: number,
    id: string,
  ) => {
    dragItemNode.current = e.currentTarget;
    dragItemNode.current.addEventListener("dragend", handleDragEnd);
    dragItem.current = index;

    setDraggedItem(id);

    // Set a small timeout to allow visual update before adding the dragging class
    setTimeout(() => {
      if (dragItemNode.current) {
        dragItemNode.current.classList.add(
          "CSVExportDialog__order-item--dragging",
        );
      }
    }, 0);
  };

  const handleDragEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    targetIndex: number,
    id: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragItem.current === targetIndex || draggedItem === id) return;

    e.currentTarget.classList.add("CSVExportDialog__order-item--dragover");
    setDraggedOverItem(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnd = (e?: Event) => {
    if (dragItemNode.current) {
      dragItemNode.current.removeEventListener("dragend", handleDragEnd);
      dragItemNode.current.classList.remove(
        "CSVExportDialog__order-item--dragging",
      );
      dragItemNode.current = null;
    }

    // Clear all dragover classes
    document
      .querySelectorAll(".CSVExportDialog__order-item--dragover")
      .forEach((item) => {
        item.classList.remove("CSVExportDialog__order-item--dragover");
      });

    dragItem.current = null;
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  const handleDrop = (
    e: React.MouseEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragItem.current === null) return;
    if (dragItem.current === targetIndex) return;

    // Get the actual indices from column order
    const sourceIndex = dragItem.current;

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const newOrder = [...columnOrder];
      const [removed] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      setColumnOrder(newOrder);
    }

    handleDragEnd();
  };

  // Legacy handlers for HTML5 Drag and Drop API
  const handleLegacyDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    id: string,
  ) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  // Move a column up in the order
  const moveUp = (index: number) => {
    if (index > 0) {
      const newOrder = [...columnOrder];
      const temp = newOrder[index];
      newOrder[index] = newOrder[index - 1];
      newOrder[index - 1] = temp;
      setColumnOrder(newOrder);
    }
  };

  // Move a column down in the order
  const moveDown = (index: number) => {
    if (index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      const temp = newOrder[index];
      newOrder[index] = newOrder[index + 1];
      newOrder[index + 1] = temp;
      setColumnOrder(newOrder);
    }
  };

  // Build the final list of properties in the specified order
  const getOrderedProperties = () => {
    return columnOrder
      .map((id) => selectedProperties.find((p) => p.id === id))
      .filter(Boolean) as { id: string; label: string }[];
  };

  return (
    <Dialog
      onCloseRequest={onCloseRequest}
      title={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {CSV_EXPORT_DIALOG.title}
          <button
            className="CSVExportDialog__close-button"
            onClick={onCloseRequest}
            title="Close dialog"
            aria-label="Close dialog"
            type="button"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      }
      className="CSVExportDialog"
      size="regular"
    >
      <div className="CSVExportDialog__content">
        <div className="CSVExportDialog__columns">
          <div className="CSVExportDialog__property-selector">
            <h3>{CSV_EXPORT_DIALOG.availableProperties}</h3>
            <div className="CSVExportDialog__property-list">
              {allProperties.map((property) => {
                const isSelected = selectedProperties.some(
                  (p) => p.id === property.id,
                );

                return (
                  <div
                    key={property.id}
                    className={clsx("CSVExportDialog__property-item", {
                      "CSVExportDialog__property-item--selected": isSelected,
                    })}
                  >
                    <div className="CSVExportDialog__property-item-main">
                      <Switch
                        name={`property-${property.id}`}
                        checked={isSelected}
                        onChange={() => toggleProperty(property)}
                      />
                      <label>{property.label}</label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="CSVExportDialog__filter-selector">
            <h3>Remove Null Value Rows</h3>
            <div className="CSVExportDialog__filter-list">
              {allProperties.map((property) => {
                const isSelected = selectedProperties.some(
                  (p) => p.id === property.id,
                );

                // Find the property in selectedProperties to get filterEmpty value
                const selectedProperty = selectedProperties.find(
                  (p) => p.id === property.id,
                );
                const filterEmpty = selectedProperty?.filterEmpty || false;

                return (
                  <div
                    key={property.id}
                    className={clsx("CSVExportDialog__filter-item", {
                      "CSVExportDialog__filter-item--selected": isSelected,
                      "CSVExportDialog__filter-item--empty": !isSelected,
                    })}
                  >
                    {isSelected ? (
                      <>
                        <Switch
                          name={`filter-empty-${property.id}`}
                          checked={filterEmpty}
                          onChange={(checked) => {
                            const updatedProperties = selectedProperties.map(
                              (p) =>
                                p.id === property.id
                                  ? { ...p, filterEmpty: checked }
                                  : p,
                            );
                            setSelectedProperties(updatedProperties);
                          }}
                        />
                        <label
                          htmlFor={`filter-empty-${property.id}`}
                          className="filter-label"
                          title={property.label}
                        >
                          {property.label}
                        </label>
                      </>
                    ) : (
                      <div className="CSVExportDialog__filter-item-placeholder" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="CSVExportDialog__column-order">
            <h3>
              {CSV_EXPORT_DIALOG.columnOrder} ({selectedProperties.length})
            </h3>
            {selectedProperties.length > 0 ? (
              <div className="CSVExportDialog__order-list">
                {columnOrder
                  .map((id) => selectedProperties.find((p) => p.id === id))
                  .filter(Boolean)
                  .map((property, index) => {
                    if (!property) return null;
                    return (
                      <div
                        key={property.id}
                        className={`CSVExportDialog__order-item ${
                          draggedItem === property.id
                            ? "CSVExportDialog__order-item--dragging"
                            : ""
                        } ${
                          draggedOverItem === property.id
                            ? "CSVExportDialog__order-item--dragover"
                            : ""
                        }`}
                        draggable
                        onDragStart={(e) =>
                          handleLegacyDragStart(e, property.id)
                        }
                        onDragOver={handleDragOver}
                        onDragEnter={(e) =>
                          handleDragEnter(e, index, property.id)
                        }
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <div
                          className="CSVExportDialog__drag-handle"
                          title="Drag to reorder"
                          onMouseDown={(e) =>
                            handleDragStart(e, index, property.id)
                          }
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M4 6C4.55228 6 5 5.55228 5 5C5 4.44772 4.55228 4 4 4C3.44772 4 3 4.44772 3 5C3 5.55228 3.44772 6 4 6Z"
                              fill="currentColor"
                            />
                            <path
                              d="M4 9C4.55228 9 5 8.55228 5 8C5 7.44772 4.55228 7 4 7C3.44772 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9Z"
                              fill="currentColor"
                            />
                            <path
                              d="M4 12C4.55228 12 5 11.5523 5 11C5 10.4477 4.55228 10 4 10C3.44772 10 3 10.4477 3 11C3 11.5523 3.44772 12 4 12Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 6C8.55228 6 9 5.55228 9 5C9 4.44772 8.55228 4 8 4C7.44772 4 7 4.44772 7 5C7 5.55228 7.44772 6 8 6Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 9C8.55228 9 9 8.55228 9 8C9 7.44772 8.55228 7 8 7C7.44772 7 7 7.44772 7 8C7 8.55228 7.44772 9 8 9Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 12C8.55228 12 9 11.5523 9 11C9 10.4477 8.55228 10 8 10C7.44772 10 7 10.4477 7 11C7 11.5523 7.44772 12 8 12Z"
                              fill="currentColor"
                            />
                          </svg>
                        </div>
                        <span>{property.label}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="CSVExportDialog__no-properties">
                {CSV_EXPORT_DIALOG.noProperties}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="CSVExportDialog__actions">
        <FilledButton
          label={CSV_EXPORT_DIALOG.exportButton}
          onClick={() => {
            onExportToCsv(elements, appState, files, getOrderedProperties(), {
              includeNullValues: false,
            });
            onCloseRequest();
          }}
          aria-disabled={selectedProperties.length === 0}
        >
          {CSV_EXPORT_DIALOG.exportToCSV}
        </FilledButton>
      </div>
    </Dialog>
  );
};
