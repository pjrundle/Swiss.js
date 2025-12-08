//
// Swiss.ts v3.1 — Class + Attribute Actions, Media Conditions, ClickOutside, Reset Semantics
// ------------------------------------------------------------------------------------------
(function () {
  //
  // TYPES
  //
  type TActionKind = "toggle" | "add" | "remove" | "run" | "event";

  interface TBaseClassAttrAction {
    type: "toggle" | "add" | "remove";
    selector: string;
  }

  interface TClassAction extends TBaseClassAttrAction {
    classNames: string[];
    attrs?: undefined;
  }

  interface TAttrMap {
    [key: string]: string | null;
  }

  interface TAttrAction extends TBaseClassAttrAction {
    attrs: TAttrMap;
    classNames?: undefined;
  }

  interface TComboAction extends TBaseClassAttrAction {
    classNames: string[];
    attrs: TAttrMap;
  }

  interface TRunAction {
    type: "run";
    js: string;
  }

  interface TEventAction {
    type: "event";
    name: string;
  }

  type TParsedAction =
    | TClassAction
    | TAttrAction
    | TComboAction
    | TRunAction
    | TEventAction;

  interface TInitialClassState {
    el: Element;
    className: string;
    hasClass: boolean;
  }

  interface TInitialAttrState {
    el: Element;
    attr: string;
    value: string | null;
  }

  type TInitialState = (TInitialClassState | TInitialAttrState)[];

  //
  // Utility: split ignoring quotes + parentheses
  //
  function splitOutside(str: string, delims: string[]): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quote: string | null = null;
    let parenDepth = 0;
    const D = new Set(delims);

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const isQuote = c === '"' || c === "'";

      if (isQuote && !inQuotes) {
        inQuotes = true;
        quote = c;
        current += c;
        continue;
      }
      if (isQuote && inQuotes && c === quote) {
        inQuotes = false;
        quote = null;
        current += c;
        continue;
      }

      if (!inQuotes) {
        if (c === "(") parenDepth++;
        else if (c === ")" && parenDepth > 0) parenDepth--;

        if (parenDepth === 0 && D.has(c)) {
          if (current.trim()) parts.push(current.trim());
          current = "";
          continue;
        }
      }
      current += c;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  //
  // Parse attr block: {data-x:true aria-label:value}
  //
  function parseAttrBlock(block: string): TAttrMap {
    const attrs: TAttrMap = {};
    const inside = block.slice(1, -1).trim();
    if (!inside) return attrs;

    const tokens = splitOutside(inside, [" "]);
    tokens.forEach((token) => {
      if (!token.includes(":")) {
        attrs[token] = null;
        return;
      }
      const [attr, rawValue] = token.split(":");
      attrs[attr] = rawValue;
    });

    return attrs;
  }

  //
  // Parse actions
  //
  function parseActions(str: string): TParsedAction[] {
    if (!str) return [];
    const parts = splitOutside(str, [" ", ";"]);

    return parts
      .map<TParsedAction | null>((part) => {
        // run:
        const runMatch = part.match(/^run:(.+)$/);
        if (runMatch) return { type: "run", js: runMatch[1] };

        // event:
        const eventMatch = part.match(/^event:(.+)$/);
        if (eventMatch) return { type: "event", name: eventMatch[1] };

        // type[selector](payload)
        const match = part.match(/^(\w+)\[(.+?)\]\((.+?)\)$/);
        if (!match) {
          console.warn("Swiss: invalid action format", part);
          return null;
        }

        const [, rawType, selectorRaw, payloadRaw] = match;
        const type = rawType as TActionKind;
        if (!["toggle", "add", "remove"].includes(type)) {
          console.warn("Swiss: unsupported action type", rawType);
          return null;
        }

        const selector = selectorRaw.trim();
        const payload = payloadRaw.trim();

        const classNames: string[] = [];
        let attrs: TAttrMap = {};

        const tokens = splitOutside(payload, [" "]);
        tokens.forEach((token) => {
          if (token.startsWith("{") && token.endsWith("}")) {
            const map = parseAttrBlock(token);
            attrs = { ...attrs, ...map };
          } else {
            classNames.push(token);
          }
        });

        const hasClasses = classNames.length > 0;
        const hasAttrs = Object.keys(attrs).length > 0;

        if (hasClasses && hasAttrs) {
          return {
            type,
            selector,
            classNames,
            attrs,
          } as TComboAction;
        }

        if (hasAttrs) {
          return {
            type,
            selector,
            attrs,
          } as TAttrAction;
        }

        return {
          type,
          selector,
          classNames,
        } as TClassAction;
      })
      .filter((a): a is TParsedAction => Boolean(a));
  }

  //
  // Resolve target elements
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
  // Record initial state
  //
  function getInitialState(
    el: Element,
    actions: TParsedAction[],
  ): TInitialState {
    const out: TInitialState = [];

    actions.forEach((action) => {
      if (
        action.type === "toggle" ||
        action.type === "add" ||
        action.type === "remove"
      ) {
        const targets = resolveTargets(el, action.selector);
        const hasAttrs = "attrs" in action;
        const hasClasses = "classNames" in action;

        targets.forEach((target) => {
          if (hasAttrs) {
            const attrs = (action as TAttrAction | TComboAction).attrs;
            for (const attr in attrs) {
              const value = target.getAttribute(attr);
              out.push({
                el: target,
                attr,
                value: value !== null ? value : null,
              });
            }
          }
          if (hasClasses) {
            const classNames = (action as TClassAction | TComboAction)
              .classNames;
            classNames.forEach((cls) => {
              out.push({
                el: target,
                className: cls,
                hasClass: target.classList.contains(cls),
              });
            });
          }
        });
      }
    });

    return out;
  }

  //
  // Restore recorded state
  //
  function restoreState(initial: TInitialState): void {
    initial.forEach((item) => {
      if ("className" in item) {
        if (item.hasClass) item.el.classList.add(item.className);
        else item.el.classList.remove(item.className);
      } else {
        if (item.value === null) item.el.removeAttribute(item.attr);
        else item.el.setAttribute(item.attr, item.value);
      }
    });
  }

  //
  // Execute action
  //
  function runAction(el: Element, action: TParsedAction): void {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const hasAttrs = "attrs" in action;
        const hasClasses = "classNames" in action;
        const targets = resolveTargets(el, action.selector);

        //
        // COMBO
        //
        if (hasAttrs && hasClasses) {
          const a = action as TComboAction;
          targets.forEach((t) => {
            // classes
            a.classNames.forEach((cls) => {
              if (a.type === "toggle") t.classList.toggle(cls);
              else if (a.type === "add") t.classList.add(cls);
              else t.classList.remove(cls);
            });

            // attrs
            for (const attr in a.attrs) {
              const raw = a.attrs[attr];

              if (a.type === "remove") {
                t.removeAttribute(attr);
                continue;
              }

              if (a.type === "toggle") {
                if (raw && raw.includes("|")) {
                  const [left, right] = raw.split("|");
                  const cur = t.getAttribute(attr);
                  t.setAttribute(attr, cur === left ? right : left);
                  continue;
                }

                if (raw === null) {
                  if (t.hasAttribute(attr)) t.removeAttribute(attr);
                  else t.setAttribute(attr, "");
                  continue;
                }

                if (t.getAttribute(attr) === raw) t.removeAttribute(attr);
                else t.setAttribute(attr, raw);
                continue;
              }

              if (a.type === "add") {
                if (raw === null) t.setAttribute(attr, "");
                else t.setAttribute(attr, raw);
              }
            }
          });
          return;
        }

        //
        // ATTR-ONLY
        //
        if (hasAttrs) {
          const a = action as TAttrAction;
          targets.forEach((t) => {
            for (const attr in a.attrs) {
              const raw = a.attrs[attr];

              if (a.type === "remove") {
                t.removeAttribute(attr);
                continue;
              }

              if (a.type === "toggle") {
                if (raw && raw.includes("|")) {
                  const [left, right] = raw.split("|");
                  const cur = t.getAttribute(attr);
                  t.setAttribute(attr, cur === left ? right : left);
                  continue;
                }

                if (raw === null) {
                  if (t.hasAttribute(attr)) t.removeAttribute(attr);
                  else t.setAttribute(attr, "");
                  continue;
                }

                if (t.getAttribute(attr) === raw) t.removeAttribute(attr);
                else t.setAttribute(attr, raw);
                continue;
              }

              if (a.type === "add") {
                if (raw === null) t.setAttribute(attr, "");
                else t.setAttribute(attr, raw);
              }
            }
          });
          return;
        }

        //
        // CLASS-ONLY
        //
        const c = action as TClassAction;
        targets.forEach((t) => {
          c.classNames.forEach((cls) => {
            if (c.type === "toggle") t.classList.toggle(cls);
            else if (c.type === "add") t.classList.add(cls);
            else t.classList.remove(cls);
          });
        });
        return;
      }

      case "run":
        try {
          new Function(action.js)();
        } catch (e) {
          console.error("Swiss run error:", e);
        }
        return;

      case "event":
        el.dispatchEvent(new CustomEvent(action.name, { bubbles: true }));
        return;
    }
  }

  //
  // INIT SINGLE ELEMENT
  //
  function initElement(el: Element): void {
    const htmlEl = el as HTMLElement;

    const actionStr = htmlEl.getAttribute("data-swiss") || "";
    const actions = parseActions(actionStr);
    const hasActions = actions.length > 0;

    const stopProp = htmlEl.hasAttribute("data-swiss-stop-propagation");
    const whenSelector = htmlEl.getAttribute("data-swiss-if");
    const whenMedia = htmlEl.getAttribute("data-swiss-when");
    const resetOnResize = htmlEl.hasAttribute("data-swiss-reset-on-resize");
    const resetWhenDisabled = htmlEl.hasAttribute(
      "data-swiss-reset-when-disabled",
    );

    const events =
      hasActions && htmlEl.hasAttribute("data-swiss-on")
        ? htmlEl.getAttribute("data-swiss-on")!.split(/\s+/).filter(Boolean)
        : hasActions
          ? ["click"]
          : [];

    let initialState: TInitialState | null = null;
    let active = false;

    let lastWidth = window.innerWidth;

    function conditionActive(): boolean {
      if (!whenSelector) return true;
      const match = document.querySelector(whenSelector);
      return Boolean(match && match.matches(whenSelector));
    }

    function handler(_e: Event): void {
      if (!conditionActive()) return;
      actions.forEach((a) => runAction(htmlEl, a));
    }

    function outsideListener(e: MouseEvent | TouchEvent): void {
      if (!conditionActive()) return;

      const target = e.target as Element | null;
      if (!target) return;

      if (htmlEl.contains(target)) return;
      if (target.closest("[data-swiss]")) return;

      handler(e);
    }

    function enable(): void {
      if (active) return;
      active = true;

      if (stopProp) {
        htmlEl.addEventListener("click", (e) => {
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
            htmlEl.addEventListener(ev, handler);
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
            htmlEl.removeEventListener(ev, handler);
          }
        });

        if (resetWhenDisabled && initialState) {
          restoreState(initialState);
        }
      }
    }

    function evaluateMedia(): void {
      if (!whenMedia) {
        enable();
        return;
      }

      const match = window.matchMedia(whenMedia).matches;
      if (match) enable();
      else disable();
    }

    function handleResize(): void {
      const w = window.innerWidth;

      if (resetOnResize && active && initialState) {
        if (w !== lastWidth) {
          restoreState(initialState);
        }
      }

      lastWidth = w;

      if (whenMedia) evaluateMedia();
    }

    if (hasActions || stopProp) {
      evaluateMedia();
      if (whenMedia || resetOnResize) {
        window.addEventListener("resize", handleResize);
      }
    }
  }

  //
  // INIT ALL
  //
  function initAll(): void {
    document
      .querySelectorAll(
        "[data-swiss], [data-swiss-stop-propagation], [data-swiss-on='clickOutside']",
      )
      .forEach(initElement);
  }

  if (document.readyState !== "loading") initAll();
  else document.addEventListener("DOMContentLoaded", initAll);
})();
