import React, { useEffect, useState, useRef } from "react";
import { Dialog } from "./Dialog";
import { t } from "../i18n";
import DialogActionButton from "./DialogActionButton";
import { ExcalidrawElement } from "../element/types";
import clsx from "clsx";
import "./SelectSimilarDialog.scss";

interface SelectSimilarDialogProps {
  onClose: () => void;
  onSelectProperties: (selectedProperties: string[]) => void;
  properties: string[];
  referenceElement: ExcalidrawElement;
}

export const SelectSimilarDialog = ({
  onClose,
  onSelectProperties,
  properties,
  referenceElement,
}: SelectSimilarDialogProps) => {
  const [selectedProps, setSelectedProps] = useState<Record<string, boolean>>({});
  const firstCheckboxRef = useRef<HTMLInputElement>(null);

  const handleConfirm = () => {
    const selected = Object.entries(selectedProps)
      .filter(([_, isSelected]) => isSelected)
      .map(([prop]) => prop);
    
    onSelectProperties(selected);
  };

  const toggleProperty = (property: string, checked: boolean) => {
    setSelectedProps((prev) => ({
      ...prev,
      [property]: checked,
    }));
  };

  // Focus the first checkbox on mount
  useEffect(() => {
    if (firstCheckboxRef.current) {
      firstCheckboxRef.current.focus();
    }
  }, []);

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.selectSimilarProperties")}
      size="small"
      className="select-similar-dialog"
    >
      <p className="select-similar-dialog-description">
        {t("labels.selectPropertiesToMatch")}
      </p>

      <div className="select-similar-dialog-property-list">
        {properties.map((property, index) => {
          // Find matching value in the reference element
          let displayValue: string | undefined;
          if (referenceElement.customData) {
            const matchingKey = Object.keys(referenceElement.customData).find(
              (key) => key.toLowerCase() === property.toLowerCase()
            );
            if (matchingKey) {
              displayValue = `${referenceElement.customData[matchingKey]}`;
            }
          }

          return (
            <div 
              key={property}
              className={clsx("select-similar-dialog-property-row", {
                "is-selected": selectedProps[property]
              })}
            >
              <label className="select-similar-dialog-property-label">
                <input
                  type="checkbox"
                  ref={index === 0 ? firstCheckboxRef : null}
                  checked={!!selectedProps[property]}
                  onChange={(e) => toggleProperty(property, e.target.checked)}
                />
                <span className="select-similar-dialog-property-name">
                  {property}
                </span>
                {displayValue && (
                  <span className="select-similar-dialog-property-value">
                    : {displayValue}
                  </span>
                )}
              </label>
            </div>
          );
        })}
      </div>

      <div className="select-similar-dialog-buttons">
        <DialogActionButton label={t("buttons.cancel")} onClick={onClose} />
        <DialogActionButton
          label={t("buttons.confirm")}
          onClick={handleConfirm}
          actionType="primary"
        />
      </div>
    </Dialog>
  );
}; 