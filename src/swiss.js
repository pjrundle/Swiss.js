// Swiss.js v2
// ---------------------------------------------
(function () {

  // Parse actions inside data-swiss="..."
  function parseActions(str) {
    if (!str) return [];

    // Split by spaces/semicolons, but respect quoted strings
    const parts = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const isQuote = char === '"' || char === "'";

      if (isQuote && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (isQuote && inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = null;
        current += char;
      } else if (!inQuotes && (char === " " || char === ";")) {
        if (current.trim()) {
          parts.push(current.trim());
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts
      .map((part) => {
        // run:JS
        const runMatch = part.match(/^run:(.+)$/);
        if (runMatch) {
          return { type: "run", js: runMatch[1] };
        }

        // event:name
        const eventMatch = part.match(/^event:(.+)$/);
        if (eventMatch) {
          return { type: "event", name: eventMatch[1] };
        }

        // toggle:this(a, b)
        const match = part.match(/^(\w+):(.+?)\((.+?)\)$/);
        if (match) {
          const [, type, selector, rawClassList] = match;

          // Support multiple classes: (a, b, c)
          const classNames = rawClassList
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);

          return {
            type,
            selector,
            classNames,
          };
        }

        console.warn("Swiss: invalid action format:", part);
        return null;
      })
      .filter(Boolean);
  }

  // Get initial states
  function getInitialState(el, actions) {
    const state = [];

    actions.forEach((action) => {
      if (["toggle", "add", "remove"].includes(action.type)) {
        const targets = resolveTargets(el, action.selector);

        targets.forEach((t) => {
          action.classNames.forEach((cls) => {
            state.push({
              el: t,
              className: cls,
              hasClass: t.classList.contains(cls),
            });
          });
        });
      }
    });

    return state;
  }

  // Restore classes
  function restoreState(initial) {
    initial.forEach((item) => {
      if (item.hasClass) {
        item.el.classList.add(item.className);
      } else {
        item.el.classList.remove(item.className);
      }
    });
  }

  // Resolve selector
  function resolveTargets(el, selector) {
    if (selector === "this") return [el];
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (e) {
      console.warn("Swiss: invalid selector:", selector);
      return [];
    }
  }

  // Execute an action
  function runAction(el, action) {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const targets = resolveTargets(el, action.selector);

        targets.forEach((t) => {
          action.classNames.forEach((cls) => {
            t.classList[action.type](cls);
          });
        });

        break;
      }

      case "run": {
        try {
          const fn = new Function(action.js);
          fn();
        } catch (e) {
          console.error("Swiss: error in run:", e);
        }
        break;
      }

      case "event": {
        el.dispatchEvent(new CustomEvent(action.name, { bubbles: true }));
        break;
      }
    }
  }

  // Init one element
  function initElement(el) {
    const actionString = el.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);
    if (actions.length === 0) return;

    const events = (el.getAttribute("data-swiss-on") || "click")
      .split(/\s+/)
      .filter(Boolean);

    const when = el.getAttribute("data-swiss-when");
    const restoreOnResize = el.hasAttribute("data-swiss-reset-on-resize");

    let initialState = null;
    let active = false;

    function enable() {
      if (active) return;
      active = true;

      initialState = getInitialState(el, actions);

      events.forEach((ev) => {
        el.addEventListener(ev, handler);
      });
    }

    function disable() {
      if (!active) return;
      active = false;

      events.forEach((ev) => {
        el.removeEventListener(ev, handler);
      });

      if (restoreOnResize && initialState) {
        restoreState(initialState);
      }
    }

    function handler() {
      actions.forEach((action) => runAction(el, action));
    }

    function evaluate() {
      if (!when) {
        enable();
        return;
      }

      const matches = window.matchMedia(when).matches;
      matches ? enable() : disable();
    }

    evaluate();

    if (when || restoreOnResize) {
      window.addEventListener("resize", evaluate);
    }
  }

  // Init all elements
  function initAll() {
    const elements = document.querySelectorAll("[data-swiss]");
    elements.forEach(initElement);
  }

  if (document.readyState !== "loading") {
    initAll();
  } else {
    document.addEventListener("DOMContentLoaded", initAll);
  }
})();
