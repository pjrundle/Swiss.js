// Swiss.js v2.8
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
        const runMatch = part.match(/^run:(.+)$/);
        if (runMatch) return { type: "run", js: runMatch[1] };

        const evMatch = part.match(/^event:(.+)$/);
        if (evMatch) return { type: "event", name: evMatch[1] };

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
  // Build initial class state for reset-on-resize
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

  function restoreState(initial) {
    initial.forEach((item) => {
      if (item.hasClass) item.el.classList.add(item.className);
      else item.el.classList.remove(item.className);
    });
  }


  //
  // Resolve selector (supports "this")
  //
  function resolveTargets(el, selector) {
    if (selector === "this") return [el];

    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      console.warn("Swiss: invalid selector:", selector);
      return [];
    }
  }


  //
  // Execute an action
  //
  function runAction(el, action) {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const targets = resolveTargets(el, action.selector);
        targets.forEach((t) =>
          action.classNames.forEach((cls) => t.classList[action.type](cls))
        );
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
  // Initialise a single Swiss element
  //
  function initElement(el) {
    const actionString = el.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);
    const hasActions = actions.length > 0;

    const whenActiveSelector = el.getAttribute("data-swiss-if");
    const stopProp = el.hasAttribute("data-swiss-stop-propagation");
    const when = el.getAttribute("data-swiss-when");
    const restoreOnResize = el.hasAttribute("data-swiss-reset-on-resize");

    const events =
      hasActions && el.hasAttribute("data-swiss-on")
        ? el.getAttribute("data-swiss-on").split(/\s+/).filter(Boolean)
        : hasActions
        ? ["click"]
        : [];

    let initialState = null;
    let active = false;

    function isActive() {
      if (!whenActiveSelector) return true;
      const target = document.querySelector(whenActiveSelector);
      return target ? target.matches(whenActiveSelector) : false;
    }

    function handler(e) {
      if (!isActive()) return;
      actions.forEach((a) => runAction(el, a));
    }

    function enable() {
      if (active) return;
      active = true;

      if (stopProp) {
        el.addEventListener("click", (e) => {
          if (e.target === el) e.stopPropagation();
        });
      }

      if (hasActions) {
        initialState = getInitialState(el, actions);
        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.addEventListener("mousedown", outsideListener);
            document.addEventListener("touchstart", outsideListener);
          } else {
            el.addEventListener(ev, handler);
          }
        });
      }
    }

    function disable() {
      if (!active) return;
      active = false;

      if (hasActions) {
        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.removeEventListener("mousedown", outsideListener);
            document.removeEventListener("touchstart", outsideListener);
          } else {
            el.removeEventListener(ev, handler);
          }
        });

        if (restoreOnResize && initialState) restoreState(initialState);
      }
    }

    function outsideListener(e) {
      if (!isActive()) return;

      // Ignore inside clicks
      if (el.contains(e.target)) return;

      // Ignore clicks originating from another Swiss-action element
      const otherSwiss = e.target.closest("[data-swiss]");
      if (otherSwiss) return;

      handler(e);
    }

    function evaluate() {
      if (!when) return enable();
      window.matchMedia(when).matches ? enable() : disable();
    }

    // Begin
    if (hasActions || stopProp) {
      evaluate();
      if (when || restoreOnResize) {
        window.addEventListener("resize", evaluate);
      }
    }
  }


  //
  // Initialise all Swiss-bound elements
  //
  function initAll() {
    document
      .querySelectorAll("[data-swiss], [data-swiss-stop-propagation], [data-swiss-on='clickOutside']")
      .forEach(initElement);
  }

  if (document.readyState !== "loading") initAll();
  else document.addEventListener("DOMContentLoaded", initAll);

})();
