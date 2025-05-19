import React from "react";
import { getFormValue } from "../actions/actionProperties";
import { t } from "../i18n";
import "./Range.scss";

export type RangeProps = {
  updateData: (value: number) => void;
  appState: any;
  elements: any;
  testId?: string;
};

export const Range = ({
  updateData,
  appState,
  elements,
  testId,
}: RangeProps) => {
  const value = getFormValue(
    elements,
    appState,
    (element) => element.opacity,
    true,
    appState.currentItemOpacity,
  );

  return (
    <label className="control-label">
      {t("labels.opacity")}
      <div className="range-wrapper">
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          onChange={(event) => {
            updateData(+event.target.value);
          }}
          value={value}
          className="range-input"
          data-testid={testId}
        />
        <div className="range-value">{value}</div>
      </div>
    </label>
  );
};
