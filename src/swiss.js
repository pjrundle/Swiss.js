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
      } else if (!inQuotes && (char === ' ' || char === ';')) {
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

    return parts.map(part => {
      // Check for run: and event: first (before checking for parentheses pattern)
      const runMatch = part.match(/^run:(.+)$/);
      if (runMatch) {
        return { type: "run", js: runMatch[1] };
      }

      const eventMatch = part.match(/^event:(.+)$/);
      if (eventMatch) {
        return { type: "event", name: eventMatch[1] };
      }

      // e.g. "toggle:this(active)" - only match if it's NOT run: or event:
      const match = part.match(/^(\w+):(.+?)\((.+?)\)$/);
      if (match) {
        const [, type, selector, className] = match;
        return {
          type,
          selector,
          className
        };
      }

      console.warn("Swiss: invalid action format:", part);
      return null;
    }).filter(Boolean);
  }

  // Get initial class state for restoring
  function getInitialState(el, actions) {
    const state = [];

    actions.forEach(action => {
      if (["toggle", "add", "remove"].includes(action.type)) {
        const targets = resolveTargets(el, action.selector);

        targets.forEach(t => {
          state.push({
            el: t,
            className: action.className,
            hasClass: t.classList.contains(action.className)
          });
        });
      }
    });

    return state;
  }

  // Restore classes based on initial state
  function restoreState(initial) {
    initial.forEach(item => {
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
        targets.forEach(t => t.classList[action.type](action.className));
        break;
      }

      case "run": {
        try {
          // sandboxed eval using Function
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

  // Main initializer for one element
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

      events.forEach(ev => {
        el.addEventListener(ev, handler);
      });
    }

    function disable() {
      if (!active) return;
      active = false;

      events.forEach(ev => {
        el.removeEventListener(ev, handler);
      });

      if (restoreOnResize && initialState) {
        restoreState(initialState);
      }
    }

    function handler(e) {
      actions.forEach(action => runAction(el, action));
    }

    // Apply breakpoint / media query logic
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

  // Init all elements with data-swiss
  function initAll() {
    const elements = document.querySelectorAll("[data-swiss]");
    elements.forEach(initElement);
  }

  // Auto-init on DOM load
  if (document.readyState !== "loading") {
    initAll();
  } else {
    document.addEventListener("DOMContentLoaded", initAll);
  }
})();
