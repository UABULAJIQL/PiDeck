import type { AppLanguageMode } from "../../shared/types";
import { enUS } from "./i18n/enUS";
import { zhCN, type TranslationKey } from "./i18n/zhCN";

export type { TranslationKey };

export type SupportedLocale = "zh-CN" | "en-US" | "pseudo";

type Params = Record<string, string | number | boolean | null | undefined>;

function makePseudoDictionary(
  source: Record<TranslationKey, string>,
): Record<TranslationKey, string> {
  const entries = Object.entries(source).map(([key, value]) => {
    const tail =
      value.length > 8
        ? ` ${value.slice(0, Math.ceil(value.length * 0.35))}`
        : "";
    return [key, `[!! ${value}${tail} !!]`];
  });
  return Object.fromEntries(entries) as Record<TranslationKey, string>;
}

const dictionaries: Record<SupportedLocale, Record<TranslationKey, string>> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  pseudo: makePseudoDictionary(enUS),
};

let currentLocale: SupportedLocale = resolveLocale("system");

export function resolveLocale(
  mode: AppLanguageMode,
  systemLanguage = typeof navigator === "undefined"
    ? "en-US"
    : navigator.language,
): SupportedLocale {
  if (mode === "zh-CN" || mode === "en-US" || mode === "pseudo") return mode;
  return systemLanguage.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function setI18nLocale(locale: SupportedLocale) {
  currentLocale = locale;
}

export function t(key: TranslationKey, params?: Params) {
  const dictionary = dictionaries[currentLocale] ?? dictionaries["en-US"];
  let text = dictionary[key] ?? dictionaries["en-US"][key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value == null ? match : String(value);
  });
}
