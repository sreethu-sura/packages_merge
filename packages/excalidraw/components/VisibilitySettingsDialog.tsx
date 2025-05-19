import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import "./VisibilitySettingsDialog.scss";
import clsx from "clsx";
import DialogActionButton from "./DialogActionButton";
import { t } from "../i18n";

interface SettingsDialogProps {
  onClose: () => void;
  onSelectProperties: (
    selectedProperties: Map<string, Map<string, boolean>>
  ) => void;
  properties: Map<string, Map<string, boolean>>;
}

export const VisibilitySettingsDialog = ({
  onClose,
  onSelectProperties,
  properties,
}: SettingsDialogProps) => {
  // {category: {property: true/false}}
  const [selectedProps, setSelectedProps] = useState<
    Map<string, Map<string, boolean>>
  >(new Map());
  const [selectAll, setSelectAll] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const memoizedSelectedProps = useMemo(() => {
    const newSelectedProps = new Map<string, Map<string, boolean>>();
    properties.forEach((values, category) => {
      newSelectedProps.set(category, new Map(values));
    });
    return newSelectedProps;
  }, [properties]);

  const allSelected = useMemo(() => {
    return Array.from(memoizedSelectedProps.values()).every((values) =>
      Array.from(values.values()).every((value) => value)
    );
  }, [memoizedSelectedProps]);

  useEffect(() => {
    setSelectedProps(memoizedSelectedProps);
    setSelectAll(allSelected);
  }, [memoizedSelectedProps, allSelected]);

  useEffect(() => {
    // if all values are selected, set selectAll to true, and vice versa
    const allSelected = Array.from(selectedProps.values()).every((values) =>
      Array.from(values.values()).every((value) => value)
    );
    setSelectAll(allSelected);
  }, [selectedProps]);

  const handleConfirm = () => {
    onSelectProperties(selectedProps);
    onClose();
  };

  const toggleProperty = useCallback(
    (key: string, value: string, checked: boolean) => {
      setSelectedProps((prev) => {
        const newProps = new Map(prev);
        const categoryMap = new Map(newProps.get(key));
        categoryMap.set(value, checked);
        newProps.set(key, categoryMap);
        return newProps;
      });
    },
    []
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectedProps((prevSelectedProps) => {
      const newSelectedProps = new Map(prevSelectedProps);
      newSelectedProps.forEach((values, category) => {
        values.forEach((_, key) => {
          values.set(key, checked);
        });
      });
      return newSelectedProps;
    });
  }, []);

  const toggleCategoryExpand = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.visibilitySettings")}
      size="small"
      className="visibility-settings-dialog"
    >
      {selectedProps.size === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "100%",
          }}
        >
          No properties available to select
        </div>
      ) : (
        <>
          <div className="visibility-settings-dialog-selections">
            {/* Select All Button */}
            <div className="visibility-settings-dialog-property-select-all">
              <label className="visibility-settings-dialog-property-label">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                <span className="visibility-settings-dialog-property-name">
                  {t("labels.selectAll")}
                </span>
              </label>
            </div>

            <div className="visibility-settings-dialog-property-list">
              {Array.from(selectedProps.entries()).map(
                ([category, mapValues]) => (
                  <PropertyGroup
                    key={category}
                    category={category}
                    values={Array.from(mapValues.entries())}
                    toggleProperty={toggleProperty}
                    isExpanded={expandedCategories.has(category)}
                    toggleExpand={() => toggleCategoryExpand(category)}
                  />
                )
              )}
            </div>
          </div>

          <div className="visibility-settings-dialog-buttons">
            <DialogActionButton label={t("buttons.cancel")} onClick={onClose} />
            <DialogActionButton
              label={t("buttons.confirm")}
              onClick={handleConfirm}
              actionType="primary"
            />
          </div>
        </>
      )}
    </Dialog>
  );
};

const PropertyGroup = React.memo(
  ({
    category,
    values,
    toggleProperty,
    isExpanded,
    toggleExpand,
  }: {
    category: string;
    values: [string, boolean][];
    toggleProperty: (key: string, value: string, checked: boolean) => void;
    isExpanded: boolean;
    toggleExpand: () => void;
  }) => {
    // Check if all properties in the category are selected
    const allSelected = values.every(([, value]) => value);
    const selectedCount = values.filter(([, value]) => value).length;

    // Handle toggling the category checkbox
    const toggleCategory = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const checked = e.target.checked;
      values.forEach(([key]) => toggleProperty(category, key, checked));
    };

    return (
      <div className="visibility-settings-dialog-property-group">
        <div
          className="visibility-settings-dialog-property-header"
          onClick={toggleExpand}
        >
          <div className="visibility-settings-dialog-category-label">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleCategory}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="visibility-settings-dialog-category-name">
              {category}
              {values.length > 0 && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    marginLeft: "0.5rem",
                    opacity: 0.7,
                  }}
                >
                  ({selectedCount}/{values.length})
                </span>
              )}
            </span>
            <span
              className="visibility-settings-dialog-category-toggle"
              style={{
                transform: isExpanded ? "rotate(0deg)" : "rotate(180deg)",
              }}
            >
              ▼
            </span>
          </div>
        </div>
        {isExpanded && (
          <div className="visibility-settings-dialog-property-values">
            {values
              .sort((a, b) =>
                a[0].localeCompare(b[0], undefined, {
                  numeric: true,
                  sensitivity: "base",
                })
              )
              .map(([key, value]) => (
                <div
                  key={key}
                  className={clsx("visibility-settings-dialog-property-row", {
                    "is-selected": value,
                  })}
                >
                  <label className="visibility-settings-dialog-property-label">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) =>
                        toggleProperty(category, key, e.target.checked)
                      }
                    />
                    <span className="visibility-settings-dialog-property-name">
                      {key}
                    </span>
                  </label>
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }
);
