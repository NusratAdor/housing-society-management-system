// client/src/hooks/usePageTitle.js

import { useEffect } from "react";

const BASE_TITLE = "GOMCS";
const SEPARATOR  = " | ";

const usePageTitle = (pageTitle) => {
  useEffect(() => {
    const previous = document.title;

    document.title = pageTitle
      ? `${pageTitle}${SEPARATOR}${BASE_TITLE}`
      : BASE_TITLE;

    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
};

export default usePageTitle;