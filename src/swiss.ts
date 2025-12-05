// Swiss.ts v2.8 (TypeScript)
// ---------------------------------------------
(function () {
  //
  // Types
  //
  type ActionKind = "toggle" | "add" | "remove" | "run" | "event";

  interface BaseAction {
    type: ActionKind;
  }

  interface ClassAction extends BaseAction {
    type: "toggle" | "add" | "remove";
    selector: string;
    classNames: string[];
  }

  interface RunAction extends BaseAction {
    type: "run";
    js: string;
  }

  interface EventAction extends BaseAction {
    type: "event";
    name: string;
  }

  type ParsedAction = ClassAction | RunAction | EventAction;

  interface InitialClassState {
    el: Element;
    className: string;
    hasClass: boolean;
  }

  //
  // Utility: split on delimiters, but ignore those inside quotes or parentheses.
  //
  function splitOutside(str: string, delimiters: string[]): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar: string | null = null;
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
  function parseActions(str: string): ParsedAction[] {
    if (!str) return [];

    const parts = splitOutside(str, [" ", ";"]);

    return parts
      .map<ParsedAction | null>((part) => {
        const runMatch = part.match(/^run:(.+)$/);
        if (runMatch) {
          return { type: "run", js: runMatch[1] };
        }

        const evMatch = part.match(/^event:(.+)$/);
        if (evMatch) {
          return { type: "event", name: evMatch[1] };
        }

        const bracketMatch = part.match(/^(\w+)\[(.+?)\]\((.+?)\)$/);
        if (bracketMatch) {
          const [, typeRaw, selectorRaw, rawClassList] = bracketMatch;
          const type = typeRaw as ActionKind;
          const classNames = splitOutside(rawClassList, [" "])
            .map((c) => c.trim())
            .filter(Boolean);

          if (type === "toggle" || type === "add" || type === "remove") {
            return {
              type,
              selector: selectorRaw.trim(),
              classNames,
            };
          }

          console.warn("Swiss: unsupported action type in bracket syntax:", type);
          return null;
        }

        const oldMatch = part.match(/^(\w+):(.+?)\((.+?)\)$/);
        if (oldMatch) {
          const [, typeRaw, selectorRaw, rawClassList] = oldMatch;
          const type = typeRaw as ActionKind;
          const classNames = splitOutside(rawClassList, [" "])
            .map((c) => c.trim())
            .filter(Boolean);

          if (type === "toggle" || type === "add" || type === "remove") {
            return {
              type,
              selector: selectorRaw.trim(),
              classNames,
            };
          }

          console.warn("Swiss: unsupported action type in legacy syntax:", type);
          return null;
        }

        console.warn("Swiss: invalid action format:", part);
        return null;
      })
      .filter((a): a is ParsedAction => Boolean(a));
  }

  //
  // Build initial class state for reset-on-resize
  //
  function getInitialState(el: Element, actions: ParsedAction[]): InitialClassState[] {
    const state: InitialClassState[] = [];

    actions.forEach((action) => {
      if (
        action.type === "toggle" ||
        action.type === "add" ||
        action.type === "remove"
      ) {
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

  function restoreState(initial: InitialClassState[]): void {
    initial.forEach((item) => {
      if (item.hasClass) item.el.classList.add(item.className);
      else item.el.classList.remove(item.className);
    });
  }

  //
  // Resolve selector (supports "this")
  //
  function resolveTargets(el: Element, selector: string): Element[] {
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
  function runAction(el: Element, action: ParsedAction): void {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const targets = resolveTargets(el, action.selector);
        targets.forEach((t) => {
          action.classNames.forEach((cls) => {
            if (action.type === "toggle") {
              t.classList.toggle(cls);
            } else if (action.type === "add") {
              t.classList.add(cls);
            } else {
              t.classList.remove(cls);
            }
          });
        });
        break;
      }

      case "run": {
        try {
          // eslint-disable-next-line no-new-func
          new Function(action.js)();
        } catch (e) {
          console.error("Swiss run: error:", e);
        }
        break;
      }

      case "event": {
        const customEvent = new CustomEvent(action.name, { bubbles: true });
        (el as HTMLElement).dispatchEvent(customEvent);
        break;
      }
    }
  }

  //
  // Initialise a single Swiss element
  //
  function initElement(el: Element): void {
    const htmlEl = el as HTMLElement;

    const actionString = htmlEl.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);
    const hasActions = actions.length > 0;

    const whenActiveSelector = htmlEl.getAttribute("data-swiss-if");
    const stopProp = htmlEl.hasAttribute("data-swiss-stop-propagation");
    const when = htmlEl.getAttribute("data-swiss-when");
    const restoreOnResize = htmlEl.hasAttribute("data-swiss-reset-on-resize");

    const events: string[] =
      hasActions && htmlEl.hasAttribute("data-swiss-on")
        ? (htmlEl.getAttribute("data-swiss-on") || "")
            .split(/\s+/)
            .filter(Boolean)
        : hasActions
        ? ["click"]
        : [];

    let initialState: InitialClassState[] | null = null;
    let active = false;

    function isActive(): boolean {
      if (!whenActiveSelector) return true;
      const target = document.querySelector(whenActiveSelector);
      return target ? target.matches(whenActiveSelector) : false;
    }

    function handler(_e: Event): void {
      if (!isActive()) return;
      actions.forEach((a) => runAction(htmlEl, a));
    }

    function outsideListener(e: MouseEvent | TouchEvent): void {
      if (!isActive()) return;

      const target = e.target as Element | null;
      if (!target) return;

      // Ignore inside clicks
      if (htmlEl.contains(target)) return;

      // Ignore clicks originating from another Swiss-action element
      const otherSwiss = target.closest("[data-swiss]");
      if (otherSwiss) return;

      handler(e);
    }

    function enable(): void {
      if (active) return;
      active = true;

      if (stopProp) {
        htmlEl.addEventListener("click", (e: MouseEvent) => {
          // Only stop propagation when clicking the element itself,
          // not its children (so child buttons still work)
          if (e.target === htmlEl) e.stopPropagation();
        });
      }

      if (hasActions) {
        initialState = getInitialState(htmlEl, actions);

        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.addEventListener("mousedown", outsideListener);
            document.addEventListener("touchstart", outsideListener);
          } else {
            htmlEl.addEventListener(ev, handler as EventListener);
          }
        });
      }
    }

    function disable(): void {
      if (!active) return;
      active = false;

      if (hasActions) {
        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.removeEventListener("mousedown", outsideListener);
            document.removeEventListener("touchstart", outsideListener);
          } else {
            htmlEl.removeEventListener(ev, handler as EventListener);
          }
        });

        if (restoreOnResize && initialState) {
          restoreState(initialState);
        }
      }
    }

    function evaluate(): void {
      if (!when) {
        enable();
        return;
      }

      const mq = window.matchMedia(when);
      mq.matches ? enable() : disable();
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
  function initAll(): void {
    document
      .querySelectorAll(
        "[data-swiss], [data-swiss-stop-propagation], [data-swiss-on='clickOutside']"
      )
      .forEach(initElement);
  }

  if (document.readyState !== "loading") {
    initAll();
  } else {
    document.addEventListener("DOMContentLoaded", initAll);
  }
})();
