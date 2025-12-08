//
// Swiss.ts v3 — classes, attrs, run(), event(), delay, debounce, enter/exit,
// reset-on-resize + reset-when-disabled
// -----------------------------------------------------------------------------
(function () {
  //
  // TYPES
  //
  type TBaseClassOrAttrActionType = "toggle" | "add" | "remove";

  interface TActionOptions {
    delay?: number;
    debounce?: number;
    [key: string]: unknown;
  }

  interface TBaseClassOrAttrAction {
    type: TBaseClassOrAttrActionType;
    selector: string;
    options?: TActionOptions;
  }

  interface TClassAction extends TBaseClassOrAttrAction {
    classNames: string[];
    attrs?: undefined;
  }

  interface TAttrMap {
    [key: string]: string | null;
  }

  interface TAttrAction extends TBaseClassOrAttrAction {
    attrs: TAttrMap;
    classNames?: undefined;
  }

  interface TComboAction extends TBaseClassOrAttrAction {
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
    names: string[]; // supports event(foo bar baz)
    options?: TActionOptions;
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
  // HELPERS
  //
  function isClassOrAttrActionType(
    actionType: string,
  ): actionType is TBaseClassOrAttrActionType {
    return ["toggle", "add", "remove"].includes(actionType);
  }

  // Split a string on delimiters, ignoring content inside () and quotes
  function splitOutside(str: string, delims: string[]) {
    const out: string[] = [];
    let curr = "";
    let depth = 0;
    let inQuotes = false;
    let quote: string | null = null;
    const D = new Set(delims);

    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const isQ = c === '"' || c === "'";

      if (isQ && !inQuotes) {
        inQuotes = true;
        quote = c;
        curr += c;
        continue;
      }
      if (isQ && inQuotes && c === quote) {
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

  function parseAttrBlock(block: string) {
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

  function parseOptionsBlock(s: string) {
    const inside = s.slice(1, -1).trim();
    const opts: TActionOptions = {};
    if (!inside) return opts;

    const tokens = splitOutside(inside, [" "]);
    tokens.forEach((t) => {
      const [k, v] = t.split(":");
      if (!k) return;

      if (k === "delay") {
        const n = Number(v);
        if (!Number.isNaN(n)) opts.delay = n;
        return;
      }

      if (k === "debounce") {
        const n = Number(v);
        if (!Number.isNaN(n)) opts.debounce = n;
        return;
      }

      opts[k] = v ?? true;
    });

    return opts;
  }

  // Parse run(...) with balanced parentheses, optional (options)
  function parseRunPart(part: string): TRunAction | null {
    if (!part.startsWith("run(")) return null;

    let i = "run(".length;
    let depth = 1;
    let inQuotes = false;
    let quote: string | null = null;
    const len = part.length;

    // Find the matching closing ) for the JS payload
    for (; i < len; i++) {
      const c = part[i];
      const isQ = c === '"' || c === "'";

      if (isQ && !inQuotes) {
        inQuotes = true;
        quote = c;
        continue;
      }
      if (isQ && inQuotes && c === quote) {
        inQuotes = false;
        quote = null;
        continue;
      }

      if (!inQuotes) {
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) {
            break;
          }
        }
      }
    }

    if (depth !== 0) {
      console.warn("Swiss: unbalanced parentheses in run()", part);
      return null;
    }

    const js = part.slice("run(".length, i);

    let options: TActionOptions | undefined;
    const rest = part.slice(i + 1).trim();

    if (rest) {
      if (rest.startsWith("(") && rest.endsWith(")")) {
        options = parseOptionsBlock(rest);
      } else {
        console.warn("Swiss: invalid options block in run()", part);
      }
    }

    return { type: "run", js, options };
  }

  // Parse event(...) with simple tokenised payload, optional (options)
  function parseEventPart(part: string): TEventAction | null {
    if (!part.startsWith("event(")) return null;
    if (!part.endsWith(")") && !part.includes(")(")) {
      console.warn("Swiss: invalid event() syntax:", part);
      return null;
    }

    // We support: event(payload) or event(payload)(options)
    // Find first closing ) after "event("
    const start = "event(".length;
    let i = start;
    let depth = 1;
    const len = part.length;

    for (; i < len; i++) {
      const c = part[i];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) {
      console.warn("Swiss: unbalanced parentheses in event()", part);
      return null;
    }

    const payload = part.slice(start, i).trim();
    if (!payload) {
      console.warn("Swiss: empty event() payload:", part);
      return null;
    }

    const names = splitOutside(payload, [" "]);
    let options: TActionOptions | undefined;

    const rest = part.slice(i + 1).trim();
    if (rest) {
      if (rest.startsWith("(") && rest.endsWith(")")) {
        options = parseOptionsBlock(rest);
      } else {
        console.warn("Swiss: invalid options block in event()", part);
      }
    }

    return { type: "event", names, options };
  }

  //
  // PARSE data-swiss
  //
  function parseActions(raw: string): TParsedAction[] {
    if (!raw) return [];

    return splitOutside(raw, [" ", ";"])
      .map<TParsedAction | null>((part) => {
        // 1) run(...)
        if (part.startsWith("run(")) {
          return parseRunPart(part);
        }

        // 2) event(...)
        if (part.startsWith("event(")) {
          return parseEventPart(part);
        }

        // 3) class/attr actions:
        //    type[selector](payload)(options?)
        const match = part.match(/^(\w+)\[(.+?)\]\((.+?)\)(?:\((.+?)\))?$/);
        if (!match) {
          console.warn("Swiss: invalid action format:", part);
          return null;
        }

        const [, rawType, selRaw, payloadRaw, optsRaw] = match;
        if (!isClassOrAttrActionType(rawType)) {
          console.warn("Swiss: unsupported action type:", rawType);
          return null;
        }

        const selector = selRaw.trim();
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

        const hasC = classNames.length > 0;
        const hasA = Object.keys(attrs).length > 0;

        if (hasC && hasA) {
          const a: TComboAction = {
            type: rawType,
            selector,
            classNames,
            attrs,
            options,
          };
          return a;
        }
        if (hasA) {
          return {
            type: rawType,
            selector,
            attrs,
            options,
          } as TAttrAction;
        }
        return {
          type: rawType,
          selector,
          classNames,
          options,
        } as TClassAction;
      })
      .filter((x): x is TParsedAction => Boolean(x));
  }

  //
  // selectors
  //
  function resolveTargets(el: Element, sel: string): Element[] {
    if (sel === "this") return [el];
    try {
      return Array.from(document.querySelectorAll(sel));
    } catch {
      console.warn("Swiss: bad selector:", sel);
      return [];
    }
  }

  //
  // initial state tracking
  //
  function getInitialState(
    el: Element,
    actions: TParsedAction[],
  ): TInitialState {
    const out: TInitialState = [];

    actions.forEach((a) => {
      if (!("selector" in a)) return; // run/event have no selector

      const els = resolveTargets(el, a.selector);
      const hasC = "classNames" in a;
      const hasA = "attrs" in a;

      els.forEach((t) => {
        if (hasA) {
          const attrs = (a as TAttrAction | TComboAction).attrs;
          for (const attr in attrs) {
            const v = t.getAttribute(attr);
            out.push({ el: t, attr, value: v !== null ? v : null });
          }
        }

        if (hasC) {
          const cls = (a as TClassAction | TComboAction).classNames;
          cls.forEach((c) =>
            out.push({
              el: t,
              className: c,
              hasClass: t.classList.contains(c),
            }),
          );
        }
      });
    });

    return out;
  }

  function restoreState(initialState: TInitialState) {
    initialState.forEach((item) => {
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
  // ACTION EXECUTION
  //
  function applyClassAction(
    target: Element,
    actionType: TBaseClassOrAttrActionType,
    classNames: string[],
  ) {
    classNames.forEach((cls) => {
      if (actionType === "toggle") target.classList.toggle(cls);
      else if (actionType === "add") target.classList.add(cls);
      else target.classList.remove(cls);
    });
  }

  function applyAttrAction(
    target: Element,
    actionType: TBaseClassOrAttrActionType,
    attrs: TAttrMap,
  ) {
    for (const attr in attrs) {
      const raw = attrs[attr];

      if (actionType === "remove") {
        target.removeAttribute(attr);
        continue;
      }

      if (actionType === "toggle") {
        if (raw && raw.includes("|")) {
          const [l, r] = raw.split("|");
          const cur = target.getAttribute(attr);
          target.setAttribute(attr, cur === l ? r : l);
          continue;
        }

        if (raw === null) {
          if (target.hasAttribute(attr)) target.removeAttribute(attr);
          else target.setAttribute(attr, "");
          continue;
        }

        if (target.getAttribute(attr) === raw) target.removeAttribute(attr);
        else target.setAttribute(attr, raw);
        continue;
      }

      if (actionType === "add") {
        if (raw === null) target.setAttribute(attr, "");
        else target.setAttribute(attr, raw);
      }
    }
  }

  function runActionImmediate(el: Element, action: TParsedAction) {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const els = resolveTargets(el, action.selector);

        els.forEach((t) => {
          if ("classNames" in action) {
            const classNames = (action as TClassAction | TComboAction)
              .classNames;
            applyClassAction(t, action.type, classNames);
          }
          if ("attrs" in action) {
            const attrs = (action as TAttrAction | TComboAction).attrs;
            applyAttrAction(t, action.type, attrs);
          }
        });
        return;
      }

      case "run":
        try {
          new Function(action.js)();
        } catch (err) {
          console.error("Swiss run error:", err);
        }
        return;

      case "event":
        action.names.forEach((name) => {
          el.dispatchEvent(new CustomEvent(name, { bubbles: true }));
        });
        return;
    }
  }

  function runActionWithDelay(
    action: TParsedAction,
    exec: (a: TParsedAction) => void,
  ) {
    const delay = action.options?.delay;
    if (delay && delay > 0) {
      setTimeout(() => exec(action), delay);
    } else {
      exec(action);
    }
  }

  //
  // ENTER / EXIT OBSERVER STATE
  //
  const enterExitMap = new WeakMap<
    Element,
    { entered: boolean; timers: Map<TParsedAction, number> }
  >();

  function executeActionsWithTiming(
    el: Element,
    actions: TParsedAction[],
    rec: { entered: boolean; timers: Map<TParsedAction, number> },
  ) {
    actions.forEach((a) => {
      const debounceEnabled =
        a.options?.debounce !== undefined ? a.options.debounce > 0 : true; // default ON for enter/exit

      const delayMs =
        typeof a.options?.delay === "number" ? a.options.delay : 0;
      const debounceMs =
        typeof a.options?.debounce === "number" ? a.options.debounce : 100;

      if (debounceEnabled) {
        const existing = rec.timers.get(a);
        if (existing) clearTimeout(existing);

        const id = window.setTimeout(() => {
          if (delayMs > 0) {
            setTimeout(() => runActionImmediate(el, a), delayMs);
          } else {
            runActionImmediate(el, a);
          }
        }, debounceMs);

        rec.timers.set(a, id);
      } else {
        if (delayMs > 0) {
          setTimeout(() => runActionImmediate(el, a), delayMs);
        } else {
          runActionImmediate(el, a);
        }
      }
    });
  }

  function handleEnterExit(
    el: Element,
    events: string[],
    actions: TParsedAction[],
    entry: IntersectionObserverEntry,
  ) {
    if (!events.includes("enter") && !events.includes("exit")) return;

    let rec = enterExitMap.get(el);
    if (!rec) {
      rec = { entered: false, timers: new Map() };
      enterExitMap.set(el, rec);
    }

    const isVisible = entry.isIntersecting;

    // ENTER: fire only when we transition into visible at least once
    if (isVisible) {
      if (rec.entered) return;

      rec.entered = true;

      if (events.includes("enter")) {
        executeActionsWithTiming(el, actions, rec!);
      }
    }

    // EXIT: fire only on visible → not visible transitions
    if (!isVisible && rec.entered) {
      rec.entered = false;

      if (events.includes("exit")) {
        executeActionsWithTiming(el, actions, rec!);
      }
    }
  }

  //
  // INIT ELEMENT
  //
  function initElement(el: Element) {
    const elHtml = el as HTMLElement;

    const raw = elHtml.getAttribute("data-swiss") || "";
    const actions = parseActions(raw);
    const hasActions = actions.length > 0;

    const stopProp = elHtml.hasAttribute("data-swiss-stop-propagation");
    const ifElSelector = elHtml.getAttribute("data-swiss-if");
    const whenMedia = elHtml.getAttribute("data-swiss-when");
    const resetOnResize = elHtml.hasAttribute("data-swiss-reset-on-resize");
    const resetWhenDisabled = elHtml.hasAttribute(
      "data-swiss-reset-when-disabled",
    );

    const events =
      hasActions && elHtml.hasAttribute("data-swiss-on")
        ? elHtml.getAttribute("data-swiss-on")!.split(/\s+/).filter(Boolean)
        : hasActions
          ? ["click"]
          : [];

    let initialState: TInitialState | null = null;
    let active = false;

    function conditionActive() {
      if (!ifElSelector) return true;
      const m = document.querySelector(ifElSelector);
      return !!(m && m.matches(ifElSelector));
    }

    function triggerAllActions() {
      if (!conditionActive()) return;
      actions.forEach((a) =>
        runActionWithDelay(a, (act) => runActionImmediate(elHtml, act)),
      );
    }

    function handler(_e: Event) {
      triggerAllActions();
    }

    function outsideListener(e: MouseEvent | TouchEvent) {
      if (!conditionActive()) return;
      const t = e.target as Element | null;
      if (!t) return;
      if (elHtml.contains(t)) return;
      if (t.closest("[data-swiss]")) return;
      triggerAllActions();
    }

    function enable() {
      if (active) return;
      active = true;

      if (stopProp) {
        elHtml.addEventListener("click", (e) => {
          if (e.target === elHtml) e.stopPropagation();
        });
      }

      if (hasActions) {
        initialState = getInitialState(elHtml, actions);

        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.addEventListener("mousedown", outsideListener);
            document.addEventListener("touchstart", outsideListener);
          } else if (ev === "enter" || ev === "exit") {
            // handled via IntersectionObserver
          } else {
            elHtml.addEventListener(ev, handler);
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
          } else if (["enter", "exit"].includes(ev)) {
            // observer cleanup is handled via GC
          } else {
            elHtml.removeEventListener(ev, handler);
          }
        });

        if (resetWhenDisabled && initialState) restoreState(initialState);
      }
    }

    function evaluate() {
      if (!whenMedia) {
        enable();
        return;
      }

      const match = window.matchMedia(whenMedia).matches;
      if (match) enable();
      else disable();
    }

    // ENTER/EXIT observer setup
    if (events.includes("enter") || events.includes("exit")) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === elHtml) {
              handleEnterExit(elHtml, events, actions, entry);
            }
          });
        },
        { threshold: 0 },
      );

      observer.observe(elHtml);
    }

    // BOOT
    if (hasActions || stopProp) {
      evaluate();

      // media-query driven enable/disable
      if (whenMedia) {
        window.addEventListener("resize", evaluate);
      }

      // reset-on-resize always restores initial on ANY resize
      if (resetOnResize) {
        window.addEventListener("resize", () => {
          if (initialState) restoreState(initialState);
        });
      }
    }
  }

  //
  // INIT ALL
  //
  function initAll() {
    document
      .querySelectorAll(
        "[data-swiss], [data-swiss-stop-propagation], [data-swiss-on='clickOutside']",
      )
      .forEach(initElement);
  }

  if (document.readyState !== "loading") initAll();
  else document.addEventListener("DOMContentLoaded", initAll);
})();
