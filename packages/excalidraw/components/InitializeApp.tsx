import React, { useEffect, useState } from "react";

import { LoadingMessage } from "./LoadingMessage";
import type { Language } from "../i18n";
import { defaultLang, languages, setLanguage } from "../i18n";
import type { Theme } from "../element/types";

interface Props {
  langCode: Language["code"];
  children: React.ReactElement;
  theme?: Theme;
}

export const InitializeApp = (props: Props) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateLang = async () => {
      // Always use English regardless of props.langCode
      await setLanguage(defaultLang);
      setLoading(false);
    };
    updateLang();
  }, []); // Remove props.langCode dependency

  return loading ? <LoadingMessage theme={props.theme} /> : props.children;
};
