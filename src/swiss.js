// Swiss.js v2.6
// ---------------------------------------------
(function () {

  //
  // Utility: split on delimiters, but ignore those inside quotes or parentheses.
  //
  function splitOutside(str, delimiters) {
    const parts = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = null;
    let parenDepth = 0;
    const delims = new Set(delimiters);

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
        if (char === "(") parenDepth++;
        else if (char === ")" && parenDepth > 0) parenDepth--;

        if (parenDepth === 0 && delims.has(char)) {
          if (current.trim()) parts.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }


  //
  // Parse actions inside data-swiss="..."
  //
  function parseActions(str) {
    if (!str) return [];

    const parts = splitOutside(str, [" ", ";"]);

    return parts
      .map((part) => {
        // run:JS
        const runMatch = part.match(/^run:(.+)$/);
        if (runMatch) {
          return { type: "run", js: runMatch[1] };
        }

        // event:name
        const evMatch = part.match(/^event:(.+)$/);
        if (evMatch) {
          return { type: "event", name: evMatch[1] };
        }

        // New syntax: toggle[selector](class tokens)
        const bracketMatch = part.match(/^(\w+)\[(.+?)\]\((.+?)\)$/);
        if (bracketMatch) {
          const [, type, selectorRaw, rawClassList] = bracketMatch;
          const classNames = splitOutside(rawClassList, [" "])
            .map((c) => c.trim())
            .filter(Boolean);

          return {
            type,
            selector: selectorRaw.trim(),
            classNames,
          };
        }

        // Backward-compatible syntax: toggle:this(...)
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
  // Build initial class state (for reset-on-resize)
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
  // Restore to initial state
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
  // Resolve selector (supports "this")
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
          new Function(action.js)();
        } catch (e) {
          console.error("Swiss run: error:", e);
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
  // Initialise one element with Swiss behaviour
  //
  function initElement(el) {
    const actionString = el.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);

    const hasActions = actions.length > 0;
    const stopProp = el.hasAttribute("data-swiss-stop-propagation");
    const when = el.getAttribute("data-swiss-when");
    const restoreOnResize = el.hasAttribute("data-swiss-reset-on-resize");

    // Whether this element should be initialized at all:
    const shouldInit = hasActions || stopProp;

    if (!shouldInit) return;

    // Default "on" events to click, but ONLY for action elements.
    const events = hasActions
      ? (el.getAttribute("data-swiss-on") || "click")
          .split(/\s+/)
          .filter(Boolean)
      : []; // stop-prop only → no events.


    let initialState = null;
    let active = false;

    function handler() {
      actions.forEach((a) => runAction(el, a));
    }

    function enable() {
      if (active) return;
      active = true;

      // Stop propagation behaviour
      if (stopProp) {
        el.addEventListener(
          "click",
          (e) => e.stopPropagation(),
          true // capture phase ensures early stop
        );
      }

      if (hasActions) {
        initialState = getInitialState(el, actions);
        events.forEach((ev) => {
          el.addEventListener(ev, handler);
        });
      }
    }

    function disable() {
      if (!active) return;
      active = false;

      if (hasActions) {
        events.forEach((ev) => {
          el.removeEventListener(ev, handler);
        });

        if (restoreOnResize && initialState) {
          restoreState(initialState);
        }
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

    if (when || restoreOnResize) {
      window.addEventListener("resize", evaluate);
    }
  }


  //
  // Initialise all elements with:
  // - data-swiss
  // - data-swiss-stop-propagation
  //
  function initAll() {
    document
      .querySelectorAll("[data-swiss], [data-swiss-stop-propagation]")
      .forEach(initElement);
  }

  if (document.readyState !== "loading") {
    initAll();
  } else {
    document.addEventListener("DOMContentLoaded", initAll);
  }
})();
