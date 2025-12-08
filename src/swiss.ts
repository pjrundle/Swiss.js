//
// Swiss.ts v3 — with attribute + options block (delay) support
// --------------------------------------------------------------
(function () {
  //
  // TYPES
  //
  type TActionType = "toggle" | "add" | "remove" | "run" | "event";

  type TBaseClassOrAttrActionType = "toggle" | "add" | "remove";

  interface TBaseClassAttrAction {
    type: TBaseClassOrAttrActionType;
    selector: string;
    options?: TActionOptions;
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
    options?: TActionOptions;
  }

  interface TEventAction {
    type: "event";
    name: string;
    options?: TActionOptions;
  }

  interface TActionOptions {
    delay?: number;
    [key: string]: unknown;
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
  // Utility: check if a string is a valid class or attr action type
  //
  function isClassOrAttrActionType(
    type: string,
  ): type is TBaseClassOrAttrActionType {
    return ["toggle", "add", "remove"].includes(type);
  }

  //
  // Utility: split ignoring quotes + parentheses
  //
  function splitOutside(str: string, delims: string[]): string[] {
    const out: string[] = [];
    let curr = "";
    let inQuotes = false;
    let quote: string | null = null;
    let depth = 0;

    const D = new Set(delims);

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const isQuote = c === '"' || c === "'";

      if (isQuote && !inQuotes) {
        inQuotes = true;
        quote = c;
        curr += c;
        continue;
      }

      if (isQuote && inQuotes && quote === c) {
        inQuotes = false;
        quote = null;
        curr += c;
        continue;
      }

      if (!inQuotes) {
        if (c === "(") depth++;
        else if (c === ")" && depth > 0) depth--;

        if (depth === 0 && D.has(c)) {
          if (curr.trim()) out.push(curr.trim());
          curr = "";
          continue;
        }
      }

      curr += c;
    }

    if (curr.trim()) out.push(curr.trim());
    return out;
  }

  //
  // Parse attribute block: {foo:true aria-expanded:false}
  //
  function parseAttrBlock(block: string): TAttrMap {
    const inside = block.slice(1, -1).trim();
    const out: TAttrMap = {};
    if (!inside) return out;

    const tokens = splitOutside(inside, [" "]);
    tokens.forEach((t) => {
      if (!t.includes(":")) {
        out[t] = null;
        return;
      }
      const [k, v] = t.split(":");
      out[k] = v;
    });

    return out;
  }

  //
  // Parse options block: (delay:200 foo:bar)
  //
  function parseOptionsBlock(block: string): TActionOptions {
    const inside = block.slice(1, -1).trim();
    const opts: TActionOptions = {};

    if (!inside) return opts;

    const tokens = splitOutside(inside, [" "]);
    tokens.forEach((t) => {
      const [k, v] = t.split(":");
      if (!k) return;

      if (k === "delay") {
        const num = Number(v);
        if (!Number.isNaN(num)) opts.delay = num;
        return;
      }

      // store raw values for now
      opts[k] = v ?? true;
    });

    return opts;
  }

  //
  // Parse Swiss actions from `data-swiss`
  //
  function parseActions(str: string): TParsedAction[] {
    if (!str) return [];

    const parts = splitOutside(str, [" ", ";"]);

    return parts
      .map<TParsedAction | null>((part) => {
        //
        // 1) run:
        //
        const runMatch = part.match(/^run:(.+?)(\(.+?\))?$/);
        if (runMatch) {
          const js = runMatch[1];
          const optsBlock = runMatch[2];
          const options = optsBlock ? parseOptionsBlock(optsBlock) : undefined;
          return { type: "run", js, options };
        }

        //
        // 2) event:
        //
        const eventMatch = part.match(/^event:(.+?)(\(.+?\))?$/);
        if (eventMatch) {
          const name = eventMatch[1];
          const optsBlock = eventMatch[2];
          const options = optsBlock ? parseOptionsBlock(optsBlock) : undefined;
          return { type: "event", name, options };
        }

        //
        // 3) class/attr actions:
        //    type[selector](payload)(options?)
        //
        const actionRegex = /^(\w+)\[(.+?)\]\((.+?)\)(?:\((.+?)\))?$/;
        const match = part.match(actionRegex);

        if (!match) {
          console.warn("Swiss: invalid action format:", part);
          return null;
        }

        const [, rawType, selectorRaw, payloadRaw, optsRaw] = match;

        const type = rawType as TActionType;
        if (!["toggle", "add", "remove"].includes(type)) {
          console.warn("Swiss: unsupported action type:", rawType);
          return null;
        }

        const selector = selectorRaw.trim();
        const payload = payloadRaw.trim();

        const classNames: string[] = [];
        let attrs: TAttrMap = {};
        const tokens = splitOutside(payload, [" "]);

        tokens.forEach((t) => {
          if (t.startsWith("{") && t.endsWith("}")) {
            attrs = { ...attrs, ...parseAttrBlock(t) };
          } else {
            classNames.push(t);
          }
        });

        const options = optsRaw ? parseOptionsBlock(`(${optsRaw})`) : undefined;

        const hasClasses = classNames.length > 0;
        const hasAttrs = Object.keys(attrs).length > 0;

        if (hasClasses && hasAttrs && isClassOrAttrActionType(type)) {
          const a: TComboAction = {
            type,
            selector,
            classNames,
            attrs,
            options,
          };
          return a;
        }
        if (hasAttrs && isClassOrAttrActionType(type)) {
          const a: TAttrAction = {
            type,
            selector,
            attrs,
            options,
          };
          return a;
        }
        const a: TClassAction = {
          type: type as TBaseClassOrAttrActionType,
          selector,
          classNames,
          options,
        };
        return a;
      })
      .filter((x): x is TParsedAction => Boolean(x));
  }

  //
  // Resolve selector
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
  // Track initial state
  //
  function getInitialState(
    el: Element,
    actions: TParsedAction[],
  ): TInitialState {
    const out: TInitialState = [];

    actions.forEach((action) => {
      if (!("selector" in action)) return;

      const targets = resolveTargets(el, action.selector);
      const hasAttrs = "attrs" in action;
      const hasClasses = "classNames" in action;

      targets.forEach((t) => {
        if (hasAttrs) {
          const attrs = (action as TAttrAction | TComboAction).attrs;
          for (const attr in attrs) {
            const v = t.getAttribute(attr);
            out.push({
              el: t,
              attr,
              value: v !== null ? v : null,
            });
          }
        }

        if (hasClasses) {
          const cls = (action as TClassAction | TComboAction).classNames;
          cls.forEach((className) => {
            out.push({
              el: t,
              className,
              hasClass: t.classList.contains(className),
            });
          });
        }
      });
    });

    return out;
  }

  //
  // Restore initial
  //
  function restoreState(initial: TInitialState) {
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
  // Run one action with optional delay
  //
  function runActionWithDelay(
    el: Element,
    action: TParsedAction,
    runNow: (a: TParsedAction) => void,
  ) {
    const delay = action.options?.delay;
    if (delay && delay > 0) {
      setTimeout(() => runNow(action), delay);
    } else {
      runNow(action);
    }
  }

  //
  // Run action (immediate)
  //
  function runActionImmediate(el: Element, action: TParsedAction): void {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const targets = resolveTargets(el, action.selector);
        const hasAttrs = "attrs" in action;
        const hasClasses = "classNames" in action;

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
                  const [l, r] = raw.split("|");
                  const cur = t.getAttribute(attr);
                  t.setAttribute(attr, cur === l ? r : l);
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
        // ATTR ONLY
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
                  const [l, r] = raw.split("|");
                  const cur = t.getAttribute(attr);
                  t.setAttribute(attr, cur === l ? r : l);
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
        // CLASS ONLY
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

      //
      // RUN
      //
      case "run":
        try {
          new Function(action.js)();
        } catch (e) {
          console.error("Swiss run error:", e);
        }
        return;

      //
      // EVENT
      //
      case "event":
        el.dispatchEvent(new CustomEvent(action.name, { bubbles: true }));
        return;
    }
  }

  //
  // INIT ELEMENT
  //
  function initElement(el: Element): void {
    const htmlEl = el as HTMLElement;

    const actionString = htmlEl.getAttribute("data-swiss") || "";
    const actions = parseActions(actionString);
    const hasActions = actions.length > 0;

    const stopProp = htmlEl.hasAttribute("data-swiss-stop-propagation");
    const whenSelector = htmlEl.getAttribute("data-swiss-if");
    const whenMedia = htmlEl.getAttribute("data-swiss-when");
    const resetOnResize = htmlEl.hasAttribute("data-swiss-reset-on-resize");

    const events =
      hasActions && htmlEl.hasAttribute("data-swiss-on")
        ? htmlEl.getAttribute("data-swiss-on")!.split(/\s+/).filter(Boolean)
        : hasActions
          ? ["click"]
          : [];

    let initialState: TInitialState | null = null;
    let active = false;

    function conditionActive(): boolean {
      if (!whenSelector) return true;
      const match = document.querySelector(whenSelector);
      return Boolean(match && match.matches(whenSelector));
    }

    function handler(_e: Event) {
      if (!conditionActive()) return;
      actions.forEach((a) =>
        runActionWithDelay(htmlEl, a, (action) =>
          runActionImmediate(htmlEl, action),
        ),
      );
    }

    function outsideListener(e: MouseEvent | TouchEvent) {
      if (!conditionActive()) return;
      const target = e.target as Element | null;
      if (!target) return;
      if (htmlEl.contains(target)) return;
      if (target.closest("[data-swiss]")) return;

      handler(e);
    }

    function enable() {
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

    function disable() {
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

        if (resetOnResize && initialState) restoreState(initialState);
      }
    }

    function evaluate() {
      if (!whenMedia) {
        enable();
        return;
      }
      const matches = window.matchMedia(whenMedia).matches;
      if (matches) enable();
      else disable();
    }

    if (hasActions || stopProp) {
      evaluate();
      if (whenMedia || resetOnResize) {
        window.addEventListener("resize", evaluate);
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
