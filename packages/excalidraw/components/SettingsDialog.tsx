import React, { useEffect } from "react";
import { Dialog } from "./Dialog";
import "./SettingsDialog.scss";
import {
  useExcalidrawAppState,
  useExcalidrawSetAppState,
  useExcalidrawElements,
} from "./App";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { mutateElement } from "../element/mutateElement";

const Section = (props: { title: string; children: React.ReactNode }) => (
  <>
    <h3>{props.title}</h3>
    <div className="SettingsDialog__islands-container">{props.children}</div>
  </>
);

interface SettingsDialogProps {
  onClose: () => void;
  closeOnClickOutside?: boolean;
}

export const SettingsDialog = ({ onClose }: SettingsDialogProps) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();

  const [coordinateScale, setCoordinateScale] = React.useState(
    appState.coordinateScale || 62.5
  );

  const [rackNumbering, setRackNumbering] = React.useState(
    appState.rackNumberingDirection || "top-down"
  );
  const [rowNumbering, setRowNumbering] = React.useState(
    appState.rowNumberingDirection || "left-right"
  );
  const [numberingGroupParameter, setNumberingGroupParameter] = React.useState(
    appState.numberingGroupParameter || "Frame"
  );
  const [parameterInputValue, setParameterInputValue] = React.useState(
    numberingGroupParameter !== "none" ? numberingGroupParameter : ""
  );

  // Track frame-specific direction settings
  const [frameDirectionSettings, setFrameDirectionSettings] = React.useState(
    appState.frameDirectionSettings || {}
  );

  // State for adding a new parameter-specific direction
  const [newParameterValue, setNewParameterValue] = React.useState("");
  const [newFrameRowDirection, setNewFrameRowDirection] =
    React.useState("left-right");
  const [newFrameRackDirection, setNewFrameRackDirection] =
    React.useState("top-down");

  // State for parameter values from canvas
  const [availableParameterValues, setAvailableParameterValues] =
    React.useState<string[]>([]);

  // Migration effect - run once to convert any "Frame id" to "Frame" in elements
  useEffect(() => {
    try {
      const nonDeletedElements = getNonDeletedElements(elements);
      let migrationPerformed = false;

      nonDeletedElements.forEach((element) => {
        try {
          if (element.customData && "Frame id" in element.customData) {
            const frameIdValue = element.customData["Frame id"];

            // Create/update "Frame" even if frameIdValue is empty to ensure we don't lose the property
            const newCustomData = { ...element.customData };

            // Set the "Frame" property with the value from "Frame id" or a default value if empty
            newCustomData["Frame"] = frameIdValue || "Frame";

            // Remove the old "Frame id" property
            delete newCustomData["Frame id"];

            // Update the element's customData
            mutateElement(
              element,
              {
                customData: newCustomData,
              },
              false
            );

            migrationPerformed = true;
          }
        } catch (err) {
          console.error(
            "Error migrating Frame id property for element:",
            element.id,
            err
          );
        }
      });

      // If we migrated any elements, ensure we're using "Frame" as the parameter
      if (migrationPerformed && numberingGroupParameter === "Frame id") {
        setNumberingGroupParameter("Frame");
        setParameterInputValue("Frame");
        setAppState({
          numberingGroupParameter: "Frame",
        });
      }
    } catch (err) {
      console.error("Error in migration effect:", err);
    }
    // Only run on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get all unique values for the current parameter from elements
  useEffect(() => {
    if (numberingGroupParameter === "none") {
      setAvailableParameterValues([]);
      return;
    }

    const nonDeletedElements = getNonDeletedElements(elements);
    const uniqueParamValues = new Set<string>();

    // For Frame parameter, extract all frame ids (both built-in and custom)
    if (numberingGroupParameter === "Frame") {
      // Get built-in frameId values
      nonDeletedElements.forEach((element) => {
        if (element.frameId && element.frameId.trim()) {
          uniqueParamValues.add(element.frameId);
        }
        // Also add frame elements themselves
        if (element.type === "frame") {
          uniqueParamValues.add(element.id);
        }
      });

      // Only check for "Frame" in customData (case insensitive), not "Frame id"
      nonDeletedElements.forEach((element) => {
        if (element.customData) {
          const matchingKey = Object.keys(element.customData).find(
            (key) =>
              key.toLowerCase() === "frame" && key.toLowerCase() !== "frame id"
          );

          if (matchingKey && element.customData[matchingKey]) {
            const paramValue = String(element.customData[matchingKey]);
            if (paramValue.trim()) {
              uniqueParamValues.add(paramValue);
            }
          }
        }
      });
    }
    // For all other custom parameters, extract values from customData
    else if (numberingGroupParameter.toLowerCase() === "frame id") {
      // If user explicitly selects "Frame id", redirect to "Frame" instead
      setNumberingGroupParameter("Frame");
      setParameterInputValue("Frame");
      setAppState({
        numberingGroupParameter: "Frame",
      });
      return;
    } else {
      nonDeletedElements.forEach((element) => {
        if (element.customData) {
          // Find the parameter value case-insensitively
          const matchingKey = Object.keys(element.customData).find(
            (key) => key.toLowerCase() === numberingGroupParameter.toLowerCase()
          );

          if (matchingKey && element.customData[matchingKey]) {
            const paramValue = String(element.customData[matchingKey]);
            if (paramValue.trim()) {
              uniqueParamValues.add(paramValue);
            }
          }
        }
      });
    }

    const paramValues = Array.from(uniqueParamValues);
    setAvailableParameterValues(paramValues);

    // Reset the selected parameter value if it no longer exists in the available values
    if (newParameterValue && !paramValues.includes(newParameterValue)) {
      setNewParameterValue("");
    }
  }, [numberingGroupParameter, elements, newParameterValue, setAppState]);

  // Update app state when settings change
  const updateNumberingGroupParameter = (value: string) => {
    setNumberingGroupParameter(value);
    setAppState({
      numberingGroupParameter: value,
    });

    // Reset parameter value when changing parameter
    setNewParameterValue("");
  };

  // Update rack numbering direction in app state
  const updateRackNumberingDirection = (direction: string) => {
    setRackNumbering(direction);
    setAppState({
      rackNumberingDirection: direction,
    });
  };

  // Update row numbering direction in app state
  const updateRowNumberingDirection = (direction: string) => {
    setRowNumbering(direction);
    setAppState({
      rowNumberingDirection: direction,
    });
  };

  // Handle parameter input change
  const handleParameterInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setParameterInputValue(e.target.value);
  };

  // Apply the parameter input value
  const applyParameterInput = () => {
    if (parameterInputValue.trim()) {
      updateNumberingGroupParameter(parameterInputValue.trim());
    }
  };

  // Handle enter key press on input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      applyParameterInput();
    }
  };

  // Update frame direction settings in app state
  const updateFrameDirectionSettings = (
    settings: Record<string, { row: string; rack: string }>
  ) => {
    setFrameDirectionSettings(settings);
    setAppState({
      frameDirectionSettings: settings,
    });
  };

  // Add a new parameter-specific direction setting
  const addParameterDirectionSetting = () => {
    if (newParameterValue) {
      const paramValue = newParameterValue;
      const updatedSettings = {
        ...frameDirectionSettings,
        [paramValue]: {
          row: newFrameRowDirection,
          rack: newFrameRackDirection,
        },
      };
      updateFrameDirectionSettings(updatedSettings);
      setNewParameterValue("");
    }
  };

  // Remove a parameter-specific direction setting
  const removeParameterDirectionSetting = (paramValue: string) => {
    const updatedSettings = { ...frameDirectionSettings };
    delete updatedSettings[paramValue];
    updateFrameDirectionSettings(updatedSettings);
  };

  // Update a specific parameter's direction setting
  const updateParameterDirection = (
    paramValue: string,
    type: "row" | "rack",
    direction: string
  ) => {
    if (frameDirectionSettings[paramValue]) {
      const updatedSettings = {
        ...frameDirectionSettings,
        [paramValue]: {
          ...frameDirectionSettings[paramValue],
          [type]: direction,
        },
      };
      updateFrameDirectionSettings(updatedSettings);
    }
  };

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={"Settings"}
        className={"SettingsDialog"}
      >
        {/* Close Button at Top Right */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 1,
          }}
        >
          <button
            className="SettingsDialog__btn"
            onClick={handleClose}
            style={{
              fontWeight: "500",
              padding: "6px 12px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <Section title={"Numbering Configuration"}>
          <div
            className="SettingsDialog__content-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            {/* Rack Numbering */}
            <div>
              <div
                style={{
                  marginBottom: "6px",
                  fontWeight: "500",
                  fontSize: "13px",
                }}
              >
                Rack Numbering Direction
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className="SettingsDialog__btn"
                  style={
                    rackNumbering === "top-down"
                      ? { backgroundColor: "#57B9FF" }
                      : {}
                  }
                  onClick={() => updateRackNumberingDirection("top-down")}
                >
                  Top-Down
                </button>

                <button
                  className="SettingsDialog__btn"
                  style={
                    rackNumbering === "down-top"
                      ? { backgroundColor: "#57B9FF" }
                      : {}
                  }
                  onClick={() => updateRackNumberingDirection("down-top")}
                >
                  Down-Top
                </button>
              </div>
            </div>

            {/* Row Numbering */}
            <div>
              <div
                style={{
                  marginBottom: "6px",
                  fontWeight: "500",
                  fontSize: "13px",
                }}
              >
                Row Numbering Direction
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className="SettingsDialog__btn"
                  style={
                    rowNumbering === "left-right"
                      ? { backgroundColor: "#57B9FF" }
                      : {}
                  }
                  onClick={() => updateRowNumberingDirection("left-right")}
                >
                  Left-Right
                </button>

                <button
                  className="SettingsDialog__btn"
                  style={
                    rowNumbering === "right-left"
                      ? { backgroundColor: "#57B9FF" }
                      : {}
                  }
                  onClick={() => updateRowNumberingDirection("right-left")}
                >
                  Right-Left
                </button>
              </div>
            </div>
          </div>

          {/* Add clarification about global settings */}
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginBottom: "16px",
              backgroundColor: "#f8f8f8",
              padding: "8px",
              borderRadius: "4px",
              borderLeft: "3px solid #ccc",
            }}
          >
            These are the global direction settings that apply to all elements
            that don't have any custom parameter for grouping.
          </div>

          {/* Numbering Group */}
          <div
            className="SettingsDialog__content-row"
            style={{ marginBottom: "16px" }}
          >
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "500",
                fontSize: "13px",
              }}
            >
              Numbering Groups
            </div>
            <div
              style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}
            >
              Group elements for independent numbering by parameter. Common
              choices include "Frame" or any custom data parameter.
            </div>

            <div
              className="SettingsDialog__input-row"
              style={{
                display: "flex",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                className="SettingsDialog__input"
                placeholder="Enter parameter name (e.g. Frame)"
                value={parameterInputValue}
                onChange={handleParameterInputChange}
                onKeyDown={handleInputKeyDown}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  flex: "1",
                  fontSize: "13px",
                  outline:
                    numberingGroupParameter === parameterInputValue
                      ? "2px solid #57B9FF"
                      : "none",
                }}
              />
              <button
                className="SettingsDialog__btn"
                onClick={applyParameterInput}
                style={{
                  backgroundColor:
                    numberingGroupParameter === parameterInputValue
                      ? "#57B9FF"
                      : undefined,
                  padding: "6px 10px",
                  fontSize: "13px",
                }}
              >
                Apply
              </button>
            </div>

            {numberingGroupParameter !== "none" && (
              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                Currently grouping by:{" "}
                <strong>{numberingGroupParameter}</strong>
              </div>
            )}
          </div>

          {/* Parameter-specific Direction Settings */}
          {numberingGroupParameter !== "none" && (
            <div className="SettingsDialog__parameter-settings">
              <div
                className="SettingsDialog__content-row"
                style={{ borderTop: "1px solid #eee", paddingTop: "16px" }}
              >
                <div
                  style={{
                    marginBottom: "6px",
                    fontWeight: "500",
                    fontSize: "13px",
                  }}
                >
                  Parameter-specific Direction Settings (Work in Progress -
                  Don't Use)
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "8px",
                  }}
                >
                  Configure directions for individual {numberingGroupParameter}{" "}
                  values. Elements not associated with any{" "}
                  {numberingGroupParameter} value will use the global direction
                  settings above.
                </div>

                {/* Add new parameter setting */}
                <div
                  className="SettingsDialog__add-parameter"
                  style={{
                    display: "flex",
                    gap: "6px",
                    marginBottom: "10px",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={newParameterValue}
                    onChange={(e) => setNewParameterValue(e.target.value)}
                    className="SettingsDialog__select"
                    style={{ flex: 1, padding: "6px 10px", fontSize: "13px" }}
                  >
                    <option value="">
                      Select {numberingGroupParameter} value
                    </option>
                    {availableParameterValues.length === 0 ? (
                      <option value="" disabled>
                        No {numberingGroupParameter} values found in canvas
                      </option>
                    ) : (
                      availableParameterValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))
                    )}
                  </select>

                  <select
                    value={newFrameRowDirection}
                    onChange={(e) => setNewFrameRowDirection(e.target.value)}
                    className="SettingsDialog__select"
                    style={{ padding: "6px", fontSize: "13px" }}
                  >
                    <option value="left-right">Row: L→R</option>
                    <option value="right-left">Row: R→L</option>
                  </select>

                  <select
                    value={newFrameRackDirection}
                    onChange={(e) => setNewFrameRackDirection(e.target.value)}
                    className="SettingsDialog__select"
                    style={{ padding: "6px", fontSize: "13px" }}
                  >
                    <option value="top-down">Rack: T→D</option>
                    <option value="down-top">Rack: D→T</option>
                  </select>

                  <button
                    className="SettingsDialog__btn"
                    onClick={addParameterDirectionSetting}
                    style={{ padding: "6px 10px", fontSize: "13px" }}
                    disabled={!newParameterValue}
                  >
                    Add
                  </button>
                </div>

                {/* List of parameter-specific settings */}
                <div
                  style={{
                    maxHeight: "150px",
                    overflowY: "auto",
                    border:
                      Object.entries(frameDirectionSettings).length > 0
                        ? "1px solid #eee"
                        : "none",
                    borderRadius: "4px",
                  }}
                >
                  {Object.entries(frameDirectionSettings).length === 0 ? (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        fontStyle: "italic",
                        padding: "8px 0",
                      }}
                    >
                      No parameter-specific settings configured
                    </div>
                  ) : (
                    Object.entries(frameDirectionSettings).map(
                      ([paramValue, directions]) => (
                        <div
                          key={paramValue}
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center",
                            padding: "6px",
                            borderBottom: "1px solid #eee",
                            fontSize: "13px",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              fontWeight: "500",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {paramValue}
                          </div>

                          <select
                            value={directions.row}
                            onChange={(e) =>
                              updateParameterDirection(
                                paramValue,
                                "row",
                                e.target.value
                              )
                            }
                            className="SettingsDialog__select"
                            style={{ padding: "4px", fontSize: "12px" }}
                          >
                            <option value="left-right">L→R</option>
                            <option value="right-left">R→L</option>
                          </select>

                          <select
                            value={directions.rack}
                            onChange={(e) =>
                              updateParameterDirection(
                                paramValue,
                                "rack",
                                e.target.value
                              )
                            }
                            className="SettingsDialog__select"
                            style={{ padding: "4px", fontSize: "12px" }}
                          >
                            <option value="top-down">T→D</option>
                            <option value="down-top">D→T</option>
                          </select>

                          <button
                            className="SettingsDialog__btn"
                            onClick={() =>
                              removeParameterDirectionSetting(paramValue)
                            }
                            style={{
                              padding: "4px 6px",
                              backgroundColor: "transparent",
                              color: "#ff4d4f",
                              border: "1px solid #ff4d4f",
                              fontSize: "12px",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </Section>

        <Section title={"Scale"}>
          <div>
            <div
              style={{
                marginBottom: "6px",
                fontWeight: "500",
                fontSize: "13px",
              }}
            >
              Coordinate Scale (px to ft)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="number"
                className="SettingsDialog__input"
                value={coordinateScale}
                min="1"
                step="0.1"
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    setCoordinateScale(value);
                    setAppState({
                      coordinateScale: value,
                    });
                  }
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  width: "80px",
                  fontSize: "13px",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                Default: 62.5 (125px = 2ft)
              </div>
            </div>
          </div>
        </Section>
      </Dialog>
    </>
  );
};
