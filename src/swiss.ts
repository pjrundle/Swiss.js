//
// Swiss.ts v3 — enter/exit, debounce, delay, attrs, reset-on-resize / reset-when-disabled
// ---------------------------------------------------------------------------------------
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
    name: string;
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
  function isClassOrAttrActionType(t: string): t is TBaseClassOrAttrActionType {
    return t === "toggle" || t === "add" || t === "remove";
  }

  function splitOutside(str: string, delims: string[]): string[] {
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

  function parseOptionsBlock(s: string): TActionOptions {
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

  //
  // PARSE data-swiss
  //
  function parseActions(raw: string): TParsedAction[] {
    if (!raw) return [];

    return splitOutside(raw, [" ", ";"])
      .map<TParsedAction | null>((part) => {
        //
        // run:
        //
        const runMatch = part.match(/^run:(.+?)(\(.+?\))?$/);
        if (runMatch) {
          const js = runMatch[1];
          const opts = runMatch[2] ? parseOptionsBlock(runMatch[2]) : undefined;
          return { type: "run", js, options: opts };
        }

        //
        // event:
        //
        const evMatch = part.match(/^event:(.+?)(\(.+?\))?$/);
        if (evMatch) {
          const name = evMatch[1];
          const opts = evMatch[2] ? parseOptionsBlock(evMatch[2]) : undefined;
          return { type: "event", name, options: opts };
        }

        //
        // class/attr
        //
        const match = part.match(/^(\w+)\[(.+?)\]\((.+?)\)(?:\((.+?)\))?$/);
        if (!match) {
          console.warn("Swiss: invalid action:", part);
          return null;
        }

        const [, rawType, selRaw, payloadRaw, optsRaw] = match;
        if (!isClassOrAttrActionType(rawType)) {
          console.warn("Swiss: unsupported type:", rawType);
          return null;
        }

        const selector = selRaw.trim();
        const tokens = splitOutside(payloadRaw.trim(), [" "]);
        const classNames: string[] = [];
        let attrs: TAttrMap = {};

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
      if (!("selector" in a)) return;
      const tgs = resolveTargets(el, a.selector);

      const hasC = "classNames" in a;
      const hasA = "attrs" in a;

      tgs.forEach((t) => {
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

  function restoreState(initial: TInitialState) {
    initial.forEach((i) => {
      if ("className" in i) {
        if (i.hasClass) i.el.classList.add(i.className);
        else i.el.classList.remove(i.className);
      } else {
        if (i.value === null) i.el.removeAttribute(i.attr);
        else i.el.setAttribute(i.attr, i.value);
      }
    });
  }

  //
  // ACTION EXECUTION
  //
  function runActionImmediate(el: Element, action: TParsedAction) {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const tgs = resolveTargets(el, action.selector);
        const hasC = "classNames" in action;
        const hasA = "attrs" in action;

        if (hasC && hasA) {
          const a = action as TComboAction;
          tgs.forEach((t) => {
            a.classNames.forEach((cls) => {
              if (a.type === "toggle") t.classList.toggle(cls);
              else if (a.type === "add") t.classList.add(cls);
              else t.classList.remove(cls);
            });

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
                } else if (raw === null) {
                  if (t.hasAttribute(attr)) t.removeAttribute(attr);
                  else t.setAttribute(attr, "");
                } else {
                  if (t.getAttribute(attr) === raw) t.removeAttribute(attr);
                  else t.setAttribute(attr, raw);
                }
              } else if (a.type === "add") {
                if (raw === null) t.setAttribute(attr, "");
                else t.setAttribute(attr, raw);
              }
            }
          });
          return;
        }

        if (hasA) {
          const a = action as TAttrAction;
          tgs.forEach((t) => {
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
                } else if (raw === null) {
                  if (t.hasAttribute(attr)) t.removeAttribute(attr);
                  else t.setAttribute(attr, "");
                } else {
                  if (t.getAttribute(attr) === raw) t.removeAttribute(attr);
                  else t.setAttribute(attr, raw);
                }
              } else if (a.type === "add") {
                if (raw === null) t.setAttribute(attr, "");
                else t.setAttribute(attr, raw);
              }
            }
          });
          return;
        }

        const c = action as TClassAction;
        tgs.forEach((t) => {
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
        } catch (err) {
          console.error("Swiss run error:", err);
        }
        return;

      case "event":
        el.dispatchEvent(new CustomEvent(action.name, { bubbles: true }));
        return;
    }
  }

  function runActionWithDelay(
    el: Element,
    action: TParsedAction,
    exec: (a: TParsedAction) => void,
  ) {
    const d = action.options?.delay;
    if (d && d > 0) {
      setTimeout(() => exec(action), d);
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

    //
    // ENTER: only on true transitions into visibility (but we allow the
    // "first time visible" event as a natural transition).
    //
    if (isVisible) {
      if (!rec.entered) {
        rec.entered = true;

        if (events.includes("enter")) {
          actions.forEach((a) => {
            const debounceEnabled =
              a.options?.debounce !== undefined ? a.options.debounce > 0 : true; // default ON for enter/exit

            const delayMs =
              typeof a.options?.delay === "number" ? a.options.delay : 0;
            const debMs =
              typeof a.options?.debounce === "number"
                ? a.options.debounce
                : 100;

            if (debounceEnabled) {
              const existing = rec!.timers.get(a);
              if (existing) clearTimeout(existing);

              const id = window.setTimeout(() => {
                if (delayMs > 0) {
                  setTimeout(() => runActionImmediate(el, a), delayMs);
                } else {
                  runActionImmediate(el, a);
                }
              }, debMs);

              rec!.timers.set(a, id);
            } else {
              if (delayMs > 0) {
                setTimeout(() => runActionImmediate(el, a), delayMs);
              } else {
                runActionImmediate(el, a);
              }
            }
          });
        }
      }
      return;
    }

    //
    // EXIT: only on transitions from visible → not visible
    //
    if (!isVisible && rec.entered) {
      rec.entered = false;

      if (events.includes("exit")) {
        actions.forEach((a) => {
          const debounceEnabled =
            a.options?.debounce !== undefined ? a.options.debounce > 0 : true;
          const delayMs =
            typeof a.options?.delay === "number" ? a.options.delay : 0;
          const debMs =
            typeof a.options?.debounce === "number" ? a.options.debounce : 100;

          if (debounceEnabled) {
            const existing = rec!.timers.get(a);
            if (existing) clearTimeout(existing);

            const id = window.setTimeout(() => {
              if (delayMs > 0) {
                setTimeout(() => runActionImmediate(el, a), delayMs);
              } else {
                runActionImmediate(el, a);
              }
            }, debMs);

            rec!.timers.set(a, id);
          } else {
            if (delayMs > 0) {
              setTimeout(() => runActionImmediate(el, a), delayMs);
            } else {
              runActionImmediate(el, a);
            }
          }
        });
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
    const whenSelector = elHtml.getAttribute("data-swiss-if");
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

    let initial: TInitialState | null = null;
    let active = false;

    function conditionActive() {
      if (!whenSelector) return true;
      const m = document.querySelector(whenSelector);
      return !!(m && m.matches(whenSelector));
    }

    function triggerAllActions() {
      if (!conditionActive()) return;
      actions.forEach((a) =>
        runActionWithDelay(elHtml, a, (act) => runActionImmediate(elHtml, act)),
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
        initial = getInitialState(elHtml, actions);

        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.addEventListener("mousedown", outsideListener);
            document.addEventListener("touchstart", outsideListener);
          } else if (ev === "enter" || ev === "exit") {
            // handled by IntersectionObserver below
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
          } else if (ev === "enter" || ev === "exit") {
            // IntersectionObserver disconnect is handled by GC;
            // we don't need explicit off here.
          } else {
            elHtml.removeEventListener(ev, handler);
          }
        });

        // Only restore on disable if explicitly asked:
        if (resetWhenDisabled && initial) restoreState(initial);
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

    //
    // ENTER/EXIT observer setup
    //
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

    //
    // BOOT
    //
    if (hasActions || stopProp) {
      evaluate();

      // Media-driven enable/disable:
      if (whenMedia) {
        window.addEventListener("resize", evaluate);
      }

      // Reset on ANY resize, irrespective of whenMedia:
      if (resetOnResize) {
        window.addEventListener("resize", () => {
          if (initial) restoreState(initial);
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
