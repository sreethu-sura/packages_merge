import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { serializeLibraryAsJSON } from "../data/json";
import { t } from "../i18n";
import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  UIAppState,
} from "../types";
import { arrayToMap } from "../utils";
import Stack from "./Stack";
import { MIME_TYPES } from "../constants";
import Spinner from "./Spinner";
import { duplicateElements } from "../element/newElement";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";

import "./LibraryMenuItems.scss";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

// Helper function to determine if an item is a rack
const isRackItem = (item: LibraryItem) => {
  // Check if the item has a category metadata property
  if (item.metadata?.category === "rack") {
    return true;
  }
  // Fallback to ID check (existing behavior)
  return item.id?.toLowerCase().includes("rack") || false;
};

// Helper to check if an item belongs to a custom category
const isCustomCategoryItem = (item: LibraryItem, categoryName: string) => {
  return (
    item.metadata?.category === "custom" &&
    item.metadata?.customCategory === categoryName
  );
};

// Helper to determine if an item has no category or an unknown category
const isOtherItem = (item: LibraryItem) => {
  // If there's no metadata or category, it's "Other"
  if (!item.metadata || !item.metadata.category) {
    return true;
  }
  // If the category is not one of the defined types, it's "Other"
  return !["rack", "non-rack", "custom"].includes(item.metadata.category);
};

export type CategoryType = "rack" | "non-rack" | "custom" | "other";

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (
    elements: LibraryItem["elements"],
    category?: CategoryType,
    customCategory?: string,
    name?: string,
  ) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
}) {
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // State for custom categories
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [showCategoryInput, setShowCategoryInput] = useState<boolean>(false);
  const [categoryError, setCategoryError] = useState<string>("");

  // State for item name input
  const [itemName, setItemName] = useState<string>("");

  // State for pending item category selection
  const [selectedCategory, setSelectedCategory] = useState<{
    type: CategoryType;
    name?: string;
  }>({ type: "rack" });

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();
  const unpublishedItems = useMemo(
    () => libraryItems.filter((item) => item.status !== "published"),
    [libraryItems],
  );

  // Split items into Racks and Non-Racks categories
  const rackItems = useMemo(
    () => unpublishedItems.filter((item) => isRackItem(item)),
    [unpublishedItems],
  );

  const nonRackItems = useMemo(
    () =>
      unpublishedItems.filter(
        (item) =>
          !isRackItem(item) &&
          !isOtherItem(item) &&
          (!item.metadata?.category || item.metadata?.category === "non-rack"),
      ),
    [unpublishedItems],
  );

  // Other category items (no category specified or unknown category)
  const otherItems = useMemo(
    () => unpublishedItems.filter((item) => isOtherItem(item)),
    [unpublishedItems],
  );

  // Get custom category items
  const getCustomCategoryItems = useCallback(
    (categoryName: string) => {
      return unpublishedItems.filter((item) =>
        isCustomCategoryItem(item, categoryName),
      );
    },
    [unpublishedItems],
  );

  const showBtn = !libraryItems.length && !pendingElements.length;

  const isLibraryEmpty = !pendingElements.length && !unpublishedItems.length;

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);

      const orderedItems = [...unpublishedItems];

      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= rangeStart && idx <= rangeEnd) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );

          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [lastSelectedItem, onSelectItems, selectedItems, unpublishedItems],
  );

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements(item.elements, { randomizeSeed: true }),
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON(getInsertedElements(id)),
      );
    },
    [getInsertedElements],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }

      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  // Handle adding to selected category
  const handleAddToCategory = useCallback(() => {
    if (selectedCategory.type === "custom" && !selectedCategory.name) {
      return; // Don't add if no custom category name is selected
    }

    if (selectedCategory.type === "rack") {
      onAddToLibrary(pendingElements, "rack", undefined, itemName || undefined);
    } else if (selectedCategory.type === "non-rack") {
      onAddToLibrary(
        pendingElements,
        "non-rack",
        undefined,
        itemName || undefined,
      );
    } else if (selectedCategory.type === "other") {
      onAddToLibrary(
        pendingElements,
        "other",
        undefined,
        itemName || undefined,
      );
    } else if (selectedCategory.type === "custom" && selectedCategory.name) {
      onAddToLibrary(
        pendingElements,
        "custom",
        selectedCategory.name,
        itemName || undefined,
      );
    }

    // Clear the name input after adding to library
    setItemName("");
  }, [pendingElements, onAddToLibrary, selectedCategory, itemName]);

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const itemsRenderedPerBatch =
    svgCache.size >= libraryItems.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  const renderNoItemsMessage = () => (
    <div className="library-menu-items__no-items">
      <div className="library-menu-items__no-items__label">
        {t("library.noItems")}
      </div>
      <div className="library-menu-items__no-items__hint">
        {t("library.hint_emptyLibrary")}
      </div>
    </div>
  );

  // Handle adding a new category
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      setCategoryError("Category name cannot be empty");
      return;
    }

    if (customCategories.includes(newCategoryName.trim())) {
      setCategoryError("Category already exists");
      return;
    }

    setCustomCategories([...customCategories, newCategoryName.trim()]);
    setNewCategoryName("");
    setShowCategoryInput(false);
    setCategoryError("");
  };

  // Add to Library UI for pending elements
  const renderAddToLibraryUI = () => {
    if (!pendingElements.length) return null;

    return (
      <div className="pending-library-items">
        <div className="library-menu-items-container__header">
          {"Pending Elements"}
        </div>
        <LibraryMenuSectionGrid>
          <LibraryMenuSection
            itemsRenderedPerBatch={itemsRenderedPerBatch}
            items={[{ id: null, elements: pendingElements }]}
            onItemSelectToggle={onItemSelectToggle}
            onItemDrag={onItemDrag}
            onClick={() => {}} // No action on click for pending elements
            isItemSelected={isItemSelected}
            svgCache={svgCache}
          />
        </LibraryMenuSectionGrid>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "12px 0",
            gap: "12px",
          }}
        >
          {/* Name input field */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Name:</span>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={t("labels.nameYourLibraryItem")}
              style={{
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid var(--color-primary)",
                flex: 1,
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Add to:</span>
            <select
              value={
                selectedCategory.type === "custom"
                  ? `custom:${selectedCategory.name}`
                  : selectedCategory.type
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === "rack") {
                  setSelectedCategory({ type: "rack" });
                } else if (value === "non-rack") {
                  setSelectedCategory({ type: "non-rack" });
                } else if (value === "other") {
                  setSelectedCategory({ type: "other" });
                } else if (value.startsWith("custom:")) {
                  const categoryName = value.replace("custom:", "");
                  setSelectedCategory({
                    type: "custom",
                    name: categoryName,
                  });
                }
              }}
              style={{
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid var(--color-primary)",
                flex: 1,
              }}
            >
              <option value="rack">Racks</option>
              <option value="non-rack">Non-Racks</option>
              <option value="other">Other</option>
              {customCategories.map((category) => (
                <option key={category} value={`custom:${category}`}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button
            className="library-menu-control-button"
            onClick={handleAddToCategory}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid var(--color-primary)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Add to Library
          </button>
        </div>
      </div>
    );
  };

  // Category management UI at the bottom
  const renderCategoryManagement = () => {
    return (
      <div
        style={{
          marginTop: "20px",
          borderTop: "1px solid var(--color-primary-darker)",
          paddingTop: "16px",
          width: "100%",
          paddingLeft: "var(--container-padding-x)",
          paddingRight: "var(--container-padding-x)",
          boxSizing: "border-box",
        }}
      >
        {showCategoryInput ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "8px",
              border: "1px solid var(--color-primary)",
              borderRadius: "4px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Enter category name"
              style={{
                padding: "8px",
                borderRadius: "4px",
                border: categoryError ? "1px solid red" : "1px solid #ccc",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            {categoryError && (
              <div style={{ color: "red", fontSize: "0.8em" }}>
                {categoryError}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
                width: "100%",
              }}
            >
              <button
                onClick={handleAddCategory}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid var(--color-primary)",
                  background: "transparent",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowCategoryInput(false);
                  setNewCategoryName("");
                  setCategoryError("");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  background: "transparent",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCategoryInput(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "4px",
              border: "1px solid var(--color-primary)",
              background: "transparent",
              cursor: "pointer",
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>+</span> Add Category
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length || unpublishedItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          flex: 1,
          marginBottom: 0,
          width: "100%",
          overflowX: "hidden",
          overflowY: "auto",
        }}
        ref={libraryContainerRef}
      >
        {/* Main Personal Library Heading */}
        <div
          className="library-menu-items-container__header"
          style={{
            fontSize: "1.2em",
            fontWeight: "bold",
            padding: "8px 0 12px 0",
            borderBottom: "2px solid var(--color-primary)",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          {"Personal Library"}
          <LibraryDropdownMenu
            selectedItems={selectedItems}
            onSelectItems={onSelectItems}
            className="library-menu-dropdown-container--in-heading"
          />
        </div>

        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: "var(--container-padding-y)",
              right: "var(--container-padding-x)",
              transform: "translateY(50%)",
            }}
          >
            <Spinner />
          </div>
        )}

        {renderAddToLibraryUI()}

        {/* Racks Section */}
        <>
          <div
            className="library-menu-items-container__header"
            style={{ width: "100%" }}
          >
            {"Racks"}
          </div>
          {!rackItems.length ? (
            renderNoItemsMessage()
          ) : (
            <div style={{ width: "100%" }}>
              <LibraryMenuSectionGrid>
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={rackItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              </LibraryMenuSectionGrid>
            </div>
          )}
        </>

        {/* Non-Racks Section */}
        <>
          <div
            className="library-menu-items-container__header"
            style={{ width: "100%" }}
          >
            {"Non-Racks"}
          </div>
          {!nonRackItems.length ? (
            renderNoItemsMessage()
          ) : (
            <div style={{ width: "100%" }}>
              <LibraryMenuSectionGrid>
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={nonRackItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              </LibraryMenuSectionGrid>
            </div>
          )}
        </>

        {/* Other Section */}
        <>
          <div
            className="library-menu-items-container__header"
            style={{ width: "100%" }}
          >
            {"Other"}
          </div>
          {!otherItems.length ? (
            renderNoItemsMessage()
          ) : (
            <div style={{ width: "100%" }}>
              <LibraryMenuSectionGrid>
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={otherItems}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onItemClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              </LibraryMenuSectionGrid>
            </div>
          )}
        </>

        {/* Custom Category Sections */}
        {customCategories.map((category) => {
          const categoryItems = getCustomCategoryItems(category);
          return (
            <React.Fragment key={category}>
              <div
                className="library-menu-items-container__header"
                style={{ width: "100%" }}
              >
                {category}
              </div>
              {!categoryItems.length ? (
                renderNoItemsMessage()
              ) : (
                <div style={{ width: "100%" }}>
                  <LibraryMenuSectionGrid>
                    <LibraryMenuSection
                      itemsRenderedPerBatch={itemsRenderedPerBatch}
                      items={categoryItems}
                      onItemSelectToggle={onItemSelectToggle}
                      onItemDrag={onItemDrag}
                      onClick={onItemClick}
                      isItemSelected={isItemSelected}
                      svgCache={svgCache}
                    />
                  </LibraryMenuSectionGrid>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {renderCategoryManagement()}

        {showBtn && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          ></LibraryMenuControlButtons>
        )}
      </Stack.Col>
    </div>
  );
}
