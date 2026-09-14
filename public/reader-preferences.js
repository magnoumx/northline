(function () {
  "use strict";

  var key = "northline-reader-preferences:v4";
  var legacyKey = "reader-preferences:v2";
  var root = document.documentElement;
  var defaults = {
    textSize: "comfortable",
    readingWidth: "balanced",
    theme: "system",
    reduceMotion: false,
    highContrast: false,
  };

  function readJson(storageKey) {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function oneOf(value, choices, fallback) {
    return choices.indexOf(value) === -1 ? fallback : value;
  }

  var saved = readJson(key);
  var legacy = readJson(legacyKey);
  var legacySize =
    legacy.textSize === "larger"
      ? "large"
      : legacy.textSize === "default"
        ? "comfortable"
        : legacy.textSize;
  var textSize = oneOf(
    saved.textSize || legacySize,
    ["compact", "comfortable", "large", "extra-large"],
    defaults.textSize,
  );
  var readingWidth = oneOf(
    saved.readingWidth,
    ["narrow", "balanced", "wide"],
    defaults.readingWidth,
  );
  var theme = oneOf(
    saved.theme,
    ["system", "light", "dark"],
    window.localStorage.getItem("northline-theme") || defaults.theme,
  );
  root.dataset.readerSize = textSize;
  root.dataset.readerWidth = readingWidth;
  root.dataset.readerMotion = saved.reduceMotion === true ? "reduce" : "system";
  root.dataset.readerContrast =
    saved.highContrast === true ? "high" : "system";
  root.dataset.theme = theme === "system" ? "dark" : theme;
  root.dataset.readerReady = "true";
})();
