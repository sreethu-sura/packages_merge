import { useState } from "react";
import { mutateElement } from "../../element/mutateElement";
import type { ExcalidrawElement } from "../../element/types";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";
import { PlusIcon, checkIcon } from "../icons";
import { t } from "../../i18n";
import { Stats } from ".";
import clsx from "clsx";
import { isFrameLikeElement } from "../../element/typeChecks";

import "./CustomProperties.scss";

interface CustomPropertiesProps {
  element: ExcalidrawElement;
  scene: Scene;
  appState: AppState;
}

const CustomProperties = ({
  element,
  scene,
  appState,
}: CustomPropertiesProps) => {
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");

  // Get all selected elements
  const selectedElementIds = appState.selectedElementIds || {};
  const selectedElements = Object.keys(selectedElementIds)
    .map((id) => scene.getNonDeletedElementsMap().get(id))
    .filter(Boolean) as ExcalidrawElement[];

  // If multi-selection, we need to find all unique property names across elements
  // and determine if any have mixed values
  const isMultiSelection = selectedElements.length > 1;

  // Get aggregated custom properties across all selected elements
  interface PropertyInfo {
    value: string | null;
    isMixed: boolean;
    originalKey: string;
  }

  const aggregatedProperties: Record<string, PropertyInfo> = {};

  if (isMultiSelection) {
    // Create a case-insensitive mapping of keys
    const lowercaseKeyMap = new Map<string, string>();

    // First pass: collect all property keys with case-insensitive mapping
    selectedElements.forEach((elem) => {
      if (elem.customData) {
        Object.keys(elem.customData).forEach((key) => {
          const lowercaseKey = key.toLowerCase();

          // Store the first occurrence's original casing
          if (!lowercaseKeyMap.has(lowercaseKey)) {
            lowercaseKeyMap.set(lowercaseKey, key);
          }

          const mappedKey = lowercaseKeyMap.get(lowercaseKey)!;

          if (!aggregatedProperties[mappedKey]) {
            aggregatedProperties[mappedKey] = {
              value: elem.customData?.[key] as string,
              isMixed: false,
              originalKey: key,
            };
          } else if (
            key === aggregatedProperties[mappedKey].originalKey &&
            elem.customData?.[key] !== aggregatedProperties[mappedKey].value
          ) {
            // Same exact key name but different values
            aggregatedProperties[mappedKey].isMixed = true;
          }
        });
      }
    });

    // Second pass: check for mixed values
    selectedElements.forEach((elem) => {
      if (!elem.customData) return;

      lowercaseKeyMap.forEach((originalKey, lowercaseKey) => {
        // Find if this element has any variant of this key (case-insensitive)
        const elementKeys = Object.keys(elem.customData || {}).filter(
          (k) => k.toLowerCase() === lowercaseKey,
        );

        if (elementKeys.length === 0) {
          // Property doesn't exist in this element
          aggregatedProperties[originalKey].isMixed = true;
        } else {
          // Check if any of the matching keys have different values
          const hasDifferentValue = elementKeys.some(
            (elementKey) =>
              elem.customData?.[elementKey] !==
              aggregatedProperties[originalKey].value,
          );

          if (hasDifferentValue) {
            // Property exists but has different value
            aggregatedProperties[originalKey].isMixed = true;
          }
        }
      });
    });
  } else {
    // Single element selection - use existing behavior
    const customProperties = element.customData || {};
    Object.entries(customProperties).forEach(([key, value]) => {
      aggregatedProperties[key] = {
        value: value as string,
        isMixed: false,
        originalKey: key,
      };
    });
  }

  const handleAddProperty = () => {
    if (!newPropertyName.trim()) return;

    // Check for case-insensitive property match
    const existingPropertyKey = selectedElements.some((elem) => {
      if (!elem.customData) return false;
      return Object.keys(elem.customData).some(
        (key) => key.toLowerCase() === newPropertyName.toLowerCase(),
      );
    });

    if (existingPropertyKey) {
      // Ask for confirmation before overwriting
      if (
        !window.confirm(
          t("labels.overwritePropertyName", { name: newPropertyName }),
        )
      ) {
        return;
      }
    }

    // Apply to all selected elements
    selectedElements.forEach((elem) => {
      const latestElement = scene.getNonDeletedElementsMap().get(elem.id);
      if (!latestElement) return;

      // Check if there's an existing property with same name but different case
      let existingKey: string | undefined;
      if (latestElement.customData) {
        existingKey = Object.keys(latestElement.customData).find(
          (key) => key.toLowerCase() === newPropertyName.toLowerCase(),
        );
      }

      const newCustomData = latestElement.customData
        ? { ...latestElement.customData }
        : {};

      // If there's an existing key with different case, delete it
      if (existingKey && existingKey !== newPropertyName) {
        delete newCustomData[existingKey as keyof typeof newCustomData];
      }

      mutateElement(latestElement, {
        customData: {
          ...newCustomData,
          [newPropertyName]: newPropertyValue,
        },
      });
    });

    setNewPropertyName("");
    setNewPropertyValue("");
    setIsAddingProperty(false);
  };

  const handleCancelAdd = () => {
    setIsAddingProperty(false);
    setNewPropertyName("");
    setNewPropertyValue("");
  };

  const handleUpdateProperty = (key: string, value: string) => {
    // Apply to all selected elements
    selectedElements.forEach((elem) => {
      const latestElement = scene.getNonDeletedElementsMap().get(elem.id);
      if (!latestElement) return;

      // Check if we're updating the "Frame" property and the element is in a frame
      if (key.toLowerCase() === "frame" && latestElement.frameId) {
        // Get the frame element
        const frameElement = scene
          .getNonDeletedElementsMap()
          .get(latestElement.frameId);

        // If frame exists and is a frame element, update its name
        if (frameElement && isFrameLikeElement(frameElement)) {
          mutateElement(
            frameElement,
            {
              name: value || null,
            },
            false,
          );

          // Also update all other elements in this frame
          const elementsInFrame = Array.from(
            scene.getNonDeletedElementsMap().values(),
          ).filter((el) => el.frameId === frameElement.id && el.id !== elem.id);

          for (const frameChild of elementsInFrame) {
            // Find if this element has the "Frame" property (case-insensitive)
            if (frameChild.customData) {
              const frameKey = Object.keys(frameChild.customData).find(
                (k) => k.toLowerCase() === "frame",
              );

              if (frameKey) {
                const childCustomData = { ...frameChild.customData };
                childCustomData[frameKey] = value;

                mutateElement(
                  frameChild,
                  {
                    customData: childCustomData,
                  },
                  false,
                );
              }
            }
          }
        }
      }

      // Find if this element has any variant of this key (case-insensitive)
      if (latestElement.customData) {
        const matchingKeys = Object.keys(latestElement.customData).filter(
          (k) => k.toLowerCase() === key.toLowerCase(),
        );

        // Create a new customData object with the updated properties
        const newCustomData = { ...latestElement.customData };

        // If we found matching keys, update them all to the same value
        if (matchingKeys.length > 0) {
          matchingKeys.forEach((matchingKey) => {
            newCustomData[matchingKey] = value;
          });

          mutateElement(latestElement, {
            customData: newCustomData,
          });
        } else {
          // If no matching keys exist, add with the original key name
          mutateElement(latestElement, {
            customData: {
              ...latestElement.customData,
              [key]: value,
            },
          });
        }
      } else {
        // No custom data exists yet
        mutateElement(latestElement, {
          customData: {
            [key]: value,
          },
        });
      }
    });
  };

  const handleDeleteProperty = (key: string) => {
    // Delete from all selected elements
    selectedElements.forEach((elem) => {
      const latestElement = scene.getNonDeletedElementsMap().get(elem.id);
      if (!latestElement || !latestElement.customData) return;

      // Find if this element has any variant of this key (case-insensitive)
      const matchingKeys = Object.keys(latestElement.customData).filter(
        (k) => k.toLowerCase() === key.toLowerCase(),
      );

      if (matchingKeys.length > 0) {
        const newCustomData = { ...latestElement.customData };

        // Delete all matching keys
        matchingKeys.forEach((matchingKey) => {
          delete newCustomData[matchingKey as keyof typeof newCustomData];
        });

        mutateElement(latestElement, {
          customData: newCustomData,
        });
      }
    });
  };

  return (
    <Stats.StatsRows>
      <div className="stats-custom-properties-wrapper">
        <Stats.StatsRow>
          <button
            type="button"
            className="custom-properties-add-button"
            onClick={() => setIsAddingProperty(true)}
            title={t("buttons.addProperty")}
          >
            {PlusIcon}
          </button>
        </Stats.StatsRow>

        {Object.entries(aggregatedProperties).map(
          ([key, { value, isMixed }]) => (
            <div key={key} className="custom-property-container">
              <div className="custom-property-label">{key}</div>
              <input
                type="text"
                value={isMixed ? "Mixed" : (value as string)}
                onChange={(e) => handleUpdateProperty(key, e.target.value)}
                className={clsx("custom-property-input", {
                  "custom-property-mixed": isMixed,
                })}
                placeholder={isMixed ? "Mixed" : ""}
              />
              <button
                className="custom-property-delete"
                onClick={() => handleDeleteProperty(key)}
                title={t("buttons.delete")}
              >
                ×
              </button>
            </div>
          ),
        )}

        {isAddingProperty && (
          <div className="custom-property-container custom-property-container-new">
            <input
              type="text"
              placeholder="Name"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              className="custom-property-label custom-property-label-editable"
              autoFocus
            />
            <input
              type="text"
              placeholder="Value"
              value={newPropertyValue}
              onChange={(e) => setNewPropertyValue(e.target.value)}
              className="custom-property-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddProperty();
                } else if (e.key === "Escape") {
                  handleCancelAdd();
                }
              }}
            />
            <div className="custom-property-actions">
              <button
                className="custom-property-confirm"
                onClick={handleAddProperty}
                title={t("buttons.save")}
              >
                {checkIcon}
              </button>
              <button
                className="custom-property-delete"
                onClick={handleCancelAdd}
                title={t("buttons.cancel")}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {!isAddingProperty && Object.keys(aggregatedProperties).length === 0 && (
          <Stats.StatsRow>
            <div className="custom-properties-empty">
              {t("labels.noCustomProperties")}
            </div>
          </Stats.StatsRow>
        )}
      </div>
    </Stats.StatsRows>
  );
};

export default CustomProperties;
