import { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { isFrameLikeElement } from "../element/typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
} from "../element/types";
import { getNonDeletedElements } from "../element";
import { t } from "../i18n";
import DialogActionButton from "./DialogActionButton";
import "./FrameSelector.scss";

interface FrameSelectorProps {
  elements: readonly ExcalidrawElement[];
  onClose: () => void;
  onSelectFrame: (frame: ExcalidrawFrameLikeElement) => void;
}

export const FrameSelector = ({
  elements,
  onClose,
  onSelectFrame,
}: FrameSelectorProps) => {
  const [frames, setFrames] = useState<ExcalidrawFrameLikeElement[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  useEffect(() => {
    // Get all frames from the canvas
    const allFrames = getNonDeletedElements(elements).filter(
      (element): element is ExcalidrawFrameLikeElement =>
        isFrameLikeElement(element),
    );

    setFrames(allFrames);
    if (allFrames.length > 0) {
      setSelectedFrameId(allFrames[0].id);
    }
  }, [elements]);

  const handleSelectFrame = () => {
    const selectedFrame = frames.find((frame) => frame.id === selectedFrameId);
    if (selectedFrame) {
      onSelectFrame(selectedFrame);
    }
    onClose();
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("labels.selectFrame")}
      className="frame-selector"
      size="small"
    >
      <div className="frame-selector-content">
        {frames.length > 0 ? (
          <>
            <div className="frame-list">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className={`frame-item ${
                    selectedFrameId === frame.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedFrameId(frame.id)}
                >
                  {frame.name || `Frame ${frame.id.slice(0, 4)}`}
                </div>
              ))}
            </div>
            <div className="frame-selector-buttons">
              <DialogActionButton
                className="export-button"
                label={t("buttons.export")}
                onClick={handleSelectFrame}
                type="button"
                actionType="primary"
                disabled={!selectedFrameId}
              />
              <DialogActionButton
                label={t("buttons.cancel")}
                onClick={onClose}
                type="button"
              />
            </div>
          </>
        ) : (
          <div className="no-frames-message">
            {t("labels.noFrames")}
            <DialogActionButton
              label={t("buttons.close")}
              onClick={onClose}
              type="button"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
};
