// client/src/utils/locale.js
//
// Maps an i18next language code to the BCP-47 locale used by Intl /
// toLocaleString, so dates and numbers follow the selected UI language.

export const getLocale = (lang) => (lang?.startsWith("bn") ? "bn-BD" : "en-US");