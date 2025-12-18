;(function () {
  /*
  |--------------------------------------------------------------------------
  | Types
  |--------------------------------------------------------------------------
  */

  type TBaseClassOrAttrActionType = "toggle" | "add" | "remove"

  type TActionOptions = {
    delay?: number
    debounce?: number
    [key: string]: unknown
  }

  type TAttrMap = {
    [key: string]: string | null
  }

  type TRunAction = {
    type: "run"
    js: string
    options?: TActionOptions
  }

  type TEventAction = {
    type: "event"
    eventNames: string[] // supports event(foo bar baz)
    options?: TActionOptions
  }

  type TParsedAction =
    | TClassAction
    | TAttrAction
    | TComboAction
    | TRunAction
    | TEventAction

  type TInitialClassState = {
    el: Element
    className: string
    hasClass: boolean
  }

  type TInitialAttrState = {
    el: Element
    attr: string
    value: string | null
  }

  type TInitialState = (TInitialClassState | TInitialAttrState)[]

  interface TBaseClassOrAttrAction {
    type: TBaseClassOrAttrActionType
    selector: string
    options?: TActionOptions
  }

  interface TClassAction extends TBaseClassOrAttrAction {
    classNames: string[]
    attrs?: undefined
  }

  interface TAttrAction extends TBaseClassOrAttrAction {
    attrs: TAttrMap
    classNames?: undefined
  }

  interface TComboAction extends TBaseClassOrAttrAction {
    classNames: string[]
    attrs: TAttrMap
  }

  /*
  |--------------------------------------------------------------------------
  | Constants
  |--------------------------------------------------------------------------
  */

  const DEFAULT_DEBOUNCE_MS = 100
  const DEFAULT_INTERSECTION_THRESHOLD = 0

  /*
  |--------------------------------------------------------------------------
  | Utils
  |--------------------------------------------------------------------------
  */

  function isClassOrAttrActionType(
    actionType: string,
  ): actionType is TBaseClassOrAttrActionType {
    return ["toggle", "add", "remove"].includes(actionType)
  }

  function hasClassNames(
    action: TParsedAction,
  ): action is TClassAction | TComboAction {
    return "classNames" in action
  }

  function hasAttrs(
    action: TParsedAction,
  ): action is TAttrAction | TComboAction {
    return "attrs" in action
  }

  /**
   * Expand event shorthands (e.g., "hover" -> "mouseenter mouseleave")
   */
  function expandEventShorthands(events: string[]): string[] {
    const expanded: string[] = []
    events.forEach((event) => {
      if (event === "hover") {
        expanded.push("mouseenter", "mouseleave")
      } else {
        expanded.push(event)
      }
    })
    return expanded
  }

  /**
   * Find matching closing parenthesis, respecting quotes
   * Returns index of closing paren, or -1 if unbalanced
   */
  function findClosingParen(str: string, startIndex: number): number {
    let depth = 1
    let inQuotes = false
    let quote: string | null = null

    for (let i = startIndex; i < str.length; i++) {
      const c = str[i]
      const isQ = c === '"' || c === "'"

      if (isQ && !inQuotes) {
        inQuotes = true
        quote = c
        continue
      }
      if (isQ && inQuotes && c === quote) {
        inQuotes = false
        quote = null
        continue
      }

      if (!inQuotes) {
        if (c === "(") depth++
        else if (c === ")") {
          depth--
          if (depth === 0) {
            return i
          }
        }
      }
    }

    return -1 // unbalanced
  }

  /*
  |--------------------------------------------------------------------------
  | Parsers
  |--------------------------------------------------------------------------
  */

  /**
   * Split a string on delimiters, ignoring content inside () and quotes
   */
  function getParts(str: string, delims: string[]) {
    const out: string[] = []
    let curr = ""
    let depth = 0
    let inQuotes = false
    let quote: string | null = null
    const delimiterSet = new Set(delims)

    for (let i = 0; i < str.length; i++) {
      const c = str[i]
      const isQ = c === '"' || c === "'"

      if (isQ && !inQuotes) {
        inQuotes = true
        quote = c
        curr += c
        continue
      }
      if (isQ && inQuotes && c === quote) {
        inQuotes = false
        quote = null
        curr += c
        continue
      }

      if (!inQuotes) {
        if (c === "(") depth++
        else if (c === ")" && depth > 0) depth--

        if (depth === 0 && delimiterSet.has(c)) {
          if (curr.trim()) out.push(curr.trim())
          curr = ""
          continue
        }
      }

      curr += c
    }

    if (curr.trim()) out.push(curr.trim())
    return out
  }

  function parseAttrBlock(block: string) {
    const contents = block.slice(1, -1).trim()
    const out: TAttrMap = {}
    if (!contents) return out

    const parts = getParts(contents, [" "])
    parts.forEach((part) => {
      if (!part.includes(":")) {
        out[part] = null
        return
      }
      const [k, v] = part.split(":")
      out[k] = v
    })

    return out
  }

  function parseOptionsBlock(s: string) {
    const contents = s.slice(1, -1).trim()
    const opts: TActionOptions = {}
    if (!contents) return opts

    const parts = getParts(contents, [" "])
    parts.forEach((part) => {
      const [k, v] = part.split(":")
      if (!k) return

      if (k === "delay") {
        const n = Number(v)
        if (!Number.isNaN(n)) opts.delay = n
        return
      }

      if (k === "debounce") {
        const n = Number(v)
        if (!Number.isNaN(n)) opts.debounce = n
        return
      }

      opts[k] = v ?? true
    })

    return opts
  }

  function parseRunBlock(part: string): TRunAction | null {
    if (!part.startsWith("run(")) return null

    const start = "run(".length
    const closingIndex = findClosingParen(part, start)

    if (closingIndex === -1) {
      console.warn("Swiss: unbalanced parentheses in run()", part)
      return null
    }

    const js = part.slice(start, closingIndex)

    let options: TActionOptions | undefined
    const rest = part.slice(closingIndex + 1).trim()

    if (rest) {
      if (rest.startsWith("(") && rest.endsWith(")")) {
        options = parseOptionsBlock(rest)
      } else {
        console.warn("Swiss: invalid options block in run()", part)
      }
    }

    return { type: "run", js, options }
  }

  function parseEventBlock(part: string): TEventAction | null {
    if (!part.startsWith("event(")) return null
    if (!part.endsWith(")") && !part.includes(")(")) {
      console.warn("Swiss: invalid event() syntax:", part)
      return null
    }

    const start = "event(".length
    const closingIndex = findClosingParen(part, start)

    if (closingIndex === -1) {
      console.warn("Swiss: unbalanced parentheses in event()", part)
      return null
    }

    const payload = part.slice(start, closingIndex).trim()
    if (!payload) {
      console.warn("Swiss: empty event() payload:", part)
      return null
    }

    const eventNames = getParts(payload, [" "])
    let options: TActionOptions | undefined

    const rest = part.slice(closingIndex + 1).trim()
    if (rest) {
      if (rest.startsWith("(") && rest.endsWith(")")) {
        options = parseOptionsBlock(rest)
      } else {
        console.warn("Swiss: invalid options block in event()", part)
      }
    }

    return { type: "event", eventNames, options }
  }

  /**
   * Parse the data-swiss attribute into a list of actions
   */
  function parseDataSwissActionsAttr(raw: string): TParsedAction[] {
    if (!raw) return []

    return getParts(raw, [" ", ";"])
      .map<TParsedAction | null>((block) => {
        // 1) run(...)
        if (block.startsWith("run(")) {
          return parseRunBlock(block)
        }

        // 2) event(...)
        if (block.startsWith("event(")) {
          return parseEventBlock(block)
        }

        // 3) class/attr actions:
        //    type[selector](payload)(options?) or type(payload)(options?)
        //    If selector is omitted, defaults to "this"
        const match = block.match(
          /^(\w+)(?:\[(.+?)\])?\((.+?)\)(?:\((.+?)\))?$/,
        )
        if (!match) {
          console.warn("Swiss: invalid action format:", block)
          return null
        }

        const [, rawType, selRaw, payloadRaw, optsRaw] = match
        if (!isClassOrAttrActionType(rawType)) {
          console.warn("Swiss: unsupported action type:", rawType)
          return null
        }

        const selector = selRaw ? selRaw.trim() : "this"
        const payload = payloadRaw.trim()

        const classNames: string[] = []
        let attrs: TAttrMap = {}
        const parts = getParts(payload, [" "])

        parts.forEach((t) => {
          if (t.startsWith("{") && t.endsWith("}")) {
            attrs = { ...attrs, ...parseAttrBlock(t) }
          } else {
            classNames.push(t)
          }
        })

        const options = optsRaw ? parseOptionsBlock(`(${optsRaw})`) : undefined

        const hasClassAction = classNames.length > 0
        const hasAttrAction = Object.keys(attrs).length > 0
        const hasComboAction = hasClassAction && hasAttrAction

        if (hasComboAction) {
          return {
            type: rawType,
            selector,
            classNames,
            attrs,
            options,
          } as TComboAction
        }
        if (hasAttrAction) {
          return {
            type: rawType,
            selector,
            attrs,
            options,
          } as TAttrAction
        }
        return {
          type: rawType,
          selector,
          classNames,
          options,
        } as TClassAction
      })
      .filter((x): x is TParsedAction => Boolean(x))
  }

  /**
   * Parse all data-swiss attributes from an element
   */
  function parseElementAttributes(elHtml: HTMLElement) {
    const raw = elHtml.getAttribute("data-swiss") || ""
    const actions = parseDataSwissActionsAttr(raw)
    const hasActions = actions.length > 0

    const eventsRaw =
      hasActions && elHtml.hasAttribute("data-swiss-on")
        ? elHtml.getAttribute("data-swiss-on")!.split(/\s+/).filter(Boolean)
        : hasActions
          ? ["click"]
          : []
    const events = expandEventShorthands(eventsRaw)

    return {
      raw,
      actions,
      hasActions,
      events,
      stopProp: elHtml.hasAttribute("data-swiss-stop-propagation"),
      ifElSelector: elHtml.getAttribute("data-swiss-if"),
      whenMedia: elHtml.getAttribute("data-swiss-when"),
      resetOnResize: elHtml.hasAttribute("data-swiss-reset-on-resize"),
      resetWhenDisabled: elHtml.hasAttribute("data-swiss-reset-when-disabled"),
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Selectors
  |--------------------------------------------------------------------------
  */

  /**
   * Resolve a selector to a list of elements
   * Supports both global selectors (e.g., "#id", ".class") and relative selectors (e.g., ">div", "+.sibling")
   */
  function resolveTargets(el: Element, sel: string): Element[] {
    // console.log("Swiss: resolving selector:", sel)
    if (sel === "this") return [el]
    try {
      // Relative selectors: start with >, +, or ~

      if (sel.startsWith(">")) {
        // Use :scope prefix to make querySelector relative to the current element
        return Array.from(el.querySelectorAll(`:scope${sel}`))
      }

      if (sel.startsWith("+")) {
        const sibling = el.nextElementSibling
        if (!sibling) return []
        return sibling.matches(sel.slice(1)) ? [sibling] : []
      }

      if (sel.startsWith("~")) {
        const out: Element[] = []
        let sib = el.nextElementSibling
        const matchSel = sel.slice(1)

        while (sib) {
          if (sib.matches(matchSel)) out.push(sib)
          sib = sib.nextElementSibling
        }
        return out
      }

      // Global selectors (IDs, classes, complex selectors)
      return Array.from(document.querySelectorAll(sel))
    } catch {
      console.warn("Swiss: bad selector:", sel)
      return []
    }
  }

  /*
  |--------------------------------------------------------------------------
  | State Tracking
  |--------------------------------------------------------------------------
  */

  function getElementInitialState(
    el: Element,
    actions: TParsedAction[],
  ): TInitialState {
    const out: TInitialState = []

    actions.forEach((a) => {
      if (!("selector" in a)) return // run/event have no selector

      const els = resolveTargets(el, a.selector)

      els.forEach((el) => {
        if (hasAttrs(a)) {
          for (const attr in a.attrs) {
            const v = el.getAttribute(attr)
            out.push({ el: el, attr, value: v })
          }
        }

        if (hasClassNames(a)) {
          for (const c of a.classNames) {
            out.push({
              el: el,
              className: c,
              hasClass: el.classList.contains(c),
            })
          }
        }
      })
    })

    return out
  }

  function restoreElementStateToInitial(initialState: TInitialState) {
    initialState.forEach((item) => {
      if ("className" in item) {
        if (item.hasClass) item.el.classList.add(item.className)
        else item.el.classList.remove(item.className)
      } else {
        if (item.value === null) item.el.removeAttribute(item.attr)
        else item.el.setAttribute(item.attr, item.value)
      }
    })
  }

  /*
  |--------------------------------------------------------------------------
  | Actions
  |--------------------------------------------------------------------------
  */

  function applyClassAction(
    target: Element,
    actionType: TBaseClassOrAttrActionType,
    classNames: string[],
  ) {
    classNames.forEach((cls) => {
      if (actionType === "toggle") target.classList.toggle(cls)
      else if (actionType === "add") target.classList.add(cls)
      else target.classList.remove(cls)
    })
  }

  function applyAttrAction(
    target: Element,
    actionType: TBaseClassOrAttrActionType,
    attrs: TAttrMap,
  ) {
    for (const attr in attrs) {
      const raw = attrs[attr]

      if (actionType === "remove") {
        target.removeAttribute(attr)
        continue
      }

      if (actionType === "toggle") {
        if (raw && raw.includes("|")) {
          const [l, r] = raw.split("|")
          const cur = target.getAttribute(attr)
          target.setAttribute(attr, cur === l ? r : l)
          continue
        }

        if (raw === null) {
          if (target.hasAttribute(attr)) target.removeAttribute(attr)
          else target.setAttribute(attr, "")
          continue
        }

        if (target.getAttribute(attr) === raw) target.removeAttribute(attr)
        else target.setAttribute(attr, raw)
        continue
      }

      if (actionType === "add") {
        if (raw === null) target.setAttribute(attr, "")
        else target.setAttribute(attr, raw)
      }
    }
  }

  function runActionImmediate(el: Element, action: TParsedAction) {
    switch (action.type) {
      case "toggle":
      case "add":
      case "remove": {
        const els = resolveTargets(el, action.selector)

        els.forEach((el) => {
          if (hasClassNames(action)) {
            applyClassAction(el, action.type, action.classNames)
          }
          if (hasAttrs(action)) {
            applyAttrAction(el, action.type, action.attrs)
          }
        })
        return
      }

      case "run":
        try {
          new Function(action.js)()
        } catch (err) {
          console.error("Swiss run error:", err)
        }
        return

      case "event":
        action.eventNames.forEach((name) => {
          el.dispatchEvent(new CustomEvent(name, { bubbles: true }))
        })
        return
    }
  }

  function runActionWithDelay(
    action: TParsedAction,
    exec: (a: TParsedAction) => void,
  ) {
    const delay = action.options?.delay
    if (delay && delay > 0) {
      setTimeout(() => exec(action), delay)
    } else {
      exec(action)
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Enter/Exit Observer
  |--------------------------------------------------------------------------
  */

  const enterExitMap = new WeakMap<
    Element,
    { entered: boolean; timers: Map<TParsedAction, number> }
  >()

  function executeActionsWithTiming(
    el: Element,
    actions: TParsedAction[],
    rec: { entered: boolean; timers: Map<TParsedAction, number> },
  ) {
    actions.forEach((a) => {
      const debounceEnabled =
        a.options?.debounce !== undefined ? a.options.debounce > 0 : true // default ON for enter/exit

      const delayMs = typeof a.options?.delay === "number" ? a.options.delay : 0
      const debounceMs =
        typeof a.options?.debounce === "number"
          ? a.options.debounce
          : DEFAULT_DEBOUNCE_MS

      const executeAction = () => {
        if (delayMs > 0) setTimeout(() => runActionImmediate(el, a), delayMs)
        else runActionImmediate(el, a)
      }

      if (debounceEnabled) {
        const existing = rec.timers.get(a)
        if (existing) clearTimeout(existing)

        const id = window.setTimeout(executeAction, debounceMs)
        rec.timers.set(a, id)
      } else {
        executeAction()
      }
    })
  }

  function handleEnterExit(
    el: Element,
    events: string[],
    actions: TParsedAction[],
    entry: IntersectionObserverEntry,
  ) {
    if (!events.includes("enter") && !events.includes("exit")) return

    let rec = enterExitMap.get(el)
    if (!rec) {
      rec = { entered: false, timers: new Map() }
      enterExitMap.set(el, rec)
    }

    const isVisible = entry.isIntersecting

    // ENTER: fire only when we transition into visible at least once
    if (isVisible) {
      if (rec.entered) return

      rec.entered = true

      if (events.includes("enter")) {
        executeActionsWithTiming(el, actions, rec)
      }
    }

    // EXIT: fire only on visible → not visible transitions
    if (!isVisible && rec.entered) {
      rec.entered = false

      if (events.includes("exit")) {
        executeActionsWithTiming(el, actions, rec)
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Init Element
  |--------------------------------------------------------------------------
  */

  function initElement(el: Element) {
    const elHtml = el as HTMLElement

    const {
      actions,
      hasActions,
      events,
      stopProp,
      ifElSelector,
      whenMedia,
      resetOnResize,
      resetWhenDisabled,
    } = parseElementAttributes(elHtml)

    let initialState: TInitialState | null = null
    let active = false

    function conditionActive() {
      if (!ifElSelector) return true
      const m = document.querySelector(ifElSelector)
      return !!(m && m.matches(ifElSelector))
    }

    function actionHandler() {
      if (!conditionActive()) return
      actions.forEach((a) =>
        runActionWithDelay(a, (act) => runActionImmediate(elHtml, act)),
      )
    }

    function outsideListener(e: MouseEvent | TouchEvent) {
      if (!conditionActive()) return

      const target = e.target as Element | null
      if (!target) return

      // inside the element itself
      if (elHtml.contains(target)) return

      // explicit ignore selector
      const ignore = elHtml.getAttribute("data-swiss-on-click-outside-ignore")

      if (ignore) {
        // Support multiple selectors separated by commas
        // e.g., ".menu-item, .some-other-class" or ".menu-item .some-other-class"
        const shouldIgnoreElements = Array.from(
          document.querySelectorAll(ignore),
        )

        const shouldIgnore = shouldIgnoreElements.some((el) =>
          el.contains(target),
        )

        if (shouldIgnore) return
      }

      actionHandler()
    }

    function enable() {
      if (active) return
      active = true

      if (stopProp) {
        elHtml.addEventListener("click", (e) => {
          if (e.target === elHtml) e.stopPropagation()
        })
      }

      if (hasActions) {
        initialState = getElementInitialState(elHtml, actions)

        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.addEventListener("mousedown", outsideListener)
            document.addEventListener("touchstart", outsideListener)
          } else if (["enter", "exit"].includes(ev)) {
            // handled via IntersectionObserver
          } else {
            elHtml.addEventListener(ev, actionHandler)
          }
        })
      }
    }

    function disable() {
      if (!active) return
      active = false

      if (hasActions) {
        events.forEach((ev) => {
          if (ev === "clickOutside") {
            document.removeEventListener("mousedown", outsideListener)
            document.removeEventListener("touchstart", outsideListener)
          } else if (["enter", "exit"].includes(ev)) {
            // observer cleanup is handled via GC
          } else {
            elHtml.removeEventListener(ev, actionHandler)
          }
        })

        if (resetWhenDisabled && initialState)
          restoreElementStateToInitial(initialState)
      }
    }

    function evaluate() {
      if (!whenMedia || window.matchMedia(whenMedia).matches) enable()
      else disable()
    }

    // ENTER/EXIT observer setup
    if (events.includes("enter") || events.includes("exit")) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === elHtml) {
              handleEnterExit(elHtml, events, actions, entry)
            }
          })
        },
        { threshold: DEFAULT_INTERSECTION_THRESHOLD },
      )

      observer.observe(elHtml)
    }

    // BOOT
    if (hasActions || stopProp) {
      evaluate()

      // media-query driven enable/disable
      if (whenMedia) {
        window.addEventListener("resize", evaluate)
      }

      // reset-on-resize always restores initial on ANY resize
      if (resetOnResize) {
        window.addEventListener("resize", () => {
          if (initialState) restoreElementStateToInitial(initialState)
        })
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Init All
  |--------------------------------------------------------------------------
  */

  /**
   * Init all elements with data-swiss attributes
   */
  function initAll() {
    document
      .querySelectorAll(
        "[data-swiss], [data-swiss-stop-propagation], [data-swiss-on='clickOutside']",
      )
      .forEach(initElement)
  }

  if (document.readyState !== "loading") initAll()
  else document.addEventListener("DOMContentLoaded", initAll)
})()
