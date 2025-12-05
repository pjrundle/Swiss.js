// Swiss.js v2.4
// ---------------------------------------------
(function () {
  //
  // Helper: split on given delimiters, but ignore those
  // inside quotes or parentheses.
  //
  function splitOutside(str, delimiters) {
    const parts = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = null;
    let parenDepth = 0;
    const delimSet = new Set(delimiters);

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const isQuote = char === '"' || char === "'";

      if (isQuote && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
        continue;
      }

      if (isQuote && inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = null;
        current += char;
        continue;
      }

      if (!inQuotes) {
        if (char === "(") {
          parenDepth++;
        } else if (char === ")" && parenDepth > 0) {
          parenDepth--;
        }

        if (parenDepth === 0 && delimSet.has(char)) {
          if (current.trim()) {
            parts.push(current.trim());
          }
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  //
  // Parse actions inside data-swiss="..."
  //
  function parseActions(str) {
    if (!str) return [];

    // Split actions on space/semicolon, but not inside quotes/paren
    const parts = splitOutside(str, [" ", ";"]);

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

        // New syntax: toggle[selector](classA classB ...)
        const bracketMatch = part.match(/^(\w+)\[(.+?)\]\((.+?)\)$/);
        if (bracketMatch) {
          const [, type, selectorRaw, rawClassList] = bracketMatch;

          // Space-delimited classes, but don't break inside rgba(...)
          const classNames = splitOutside(rawClassList, [" "])
            .map((c) => c.trim())
            .filter(Boolean);

          return {
            type,
            selector: selectorRaw.trim(),
            classNames,
          };
        }

        // Backwards compat: toggle:this(...)
        const oldMatch = part.match(/^(\w+):(.+?)\((.+?)\)$/);
        if (oldMatch) {
          const [, type, selectorRaw, rawClassList] = oldMatch;

          const classNames = splitOutside(rawClassList, [" "])
            .map((c) => c.trim())
            .filter(Boolean);

          return {
            type,
            selector: selectorRaw.trim(),
            classNames,
          };
        }

        console.warn("Swiss: invalid action format:", part);
        return null;
      })
      .filter(Boolean);
  }

  //
  // Build initial state for restore functionality
  //
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

  //
  // Restore classes back to initial
  //
  function restoreState(initial) {
    initial.forEach((item) => {
      if (item.hasClass) {
        item.el.classList.add(item.className);
      } else {
        item.el.classList.remove(item.className);
      }
    });
  }

  //
  // Resolve selector (supports [this])
  //
  function resolveTargets(el, selector) {
    if (selector === "this") return [el];

    try {
      return Array.from(document.querySelectorAll(selector));
    } catch (e) {
      console.warn("Swiss: invalid selector:", selector);
      return [];
    }
  }

  //
  // Execute a single action
  //
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

  //
  // Init a single element
  //
  function initElement(el) {
    const actionString = el.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);
    if (actions.length === 0) return;

    const eventString = el.getAttribute("data-swiss-on") || "click";
    const events = eventString.split(/\s+/).filter(Boolean);

    const wantsClickOutside = events.includes("clickOutside");

    const when = el.getAttribute("data-swiss-when");
    const restoreOnResize = el.hasAttribute("data-swiss-reset-on-resize");

    let initialState = null;
    let active = false;

    function handler() {
      actions.forEach((action) => runAction(el, action));
    }

    function outsideHandler(e) {
      if (!el.contains(e.target)) {
        actions.forEach((action) => runAction(el, action));
      }
    }

    function enable() {
      if (active) return;
      active = true;

      initialState = getInitialState(el, actions);

      if (wantsClickOutside) {
        document.addEventListener("click", outsideHandler, true);
      } else {
        events.forEach(ev => {
          el.addEventListener(ev, handler);
        });
      }
    }

    function disable() {
      if (!active) return;
      active = false;

      if (wantsClickOutside) {
        document.removeEventListener("click", outsideHandler, true);
      } else {
        events.forEach(ev => {
          el.removeEventListener(ev, handler);
        });
      }

      if (restoreOnResize && initialState) {
        restoreState(initialState);
      }
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

    if (when || restoreOnResize || wantsClickOutside) {
      window.addEventListener("resize", evaluate);
    }
  }


  //
  // Init all data-swiss elements
  //
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
