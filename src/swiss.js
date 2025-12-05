//
// swiss.js - can:
//
// - Add or remove classes on a target or the same element
// - Dispatch a custom event
// - Call a function
//
//
// Data attributes ---------------------------------------------------------------------------------
//
//   Required:
//     data-swiss
//
//
//   Event type:
//     data-swiss-event-type    - string: any valid js event. e.g 'mouseenter', 'click'
//                                            (Default: 'click')
//
//
//   Class manipulation:
//     data-swiss-this-class   - string: manipulate class/classes on the same element
//                                           e.g 'my-active-class', 'o-100 scale-10'
//     data-swiss-target       - string: the #id of another element to target
//                                           for class manipulation
//     data-swiss-target-class - string: class to add to the target el specified
//                                           by data-swiss-target
//
//
//   Trigger event:
//     data-swiss-trigger-event - string: Trigger a customEvent on the same element
//                                            e.g 'image-set/init-lazy-wrapper'
//
//
//   Run a function:
//     data-swiss-run - string: e.g 'window.dispatchEvent(new CustomEvent('your-event'))'
//
//
//   Optional:
//     data-swiss-classlist-action - string: toggle|add|remove (default: 'toggle')
//     data-swiss-bp-min           - string: bind swiss events "ABOVE" the 'sm|md...'
//                                               breakpoint (defined in scss)
//     data-swiss-bp-max           - string: bind swiss events "BELOW" the 'sm|md...'
//                                               breakpoint (defined in scss)
//     data-swiss-reset-resize     - bool:   reset all the class toggling that has been done
//                                               on resize

// styleVars - breakpoint definitions
// -------------------------------------

function set_bp_max(min_val) {
  return `${parseInt(min_val, 10) + 1}px`;
}

const bp_min = {
  xs: "480px",
  sm: "600px",
  md: "900px",
  lg: "1200px",
  "lg-xl": "1450px",
  xl: "1850px",
  xxl: "2250px",
};

const bp_max = {
  xs: set_bp_max(bp_min.xs),
  sm: set_bp_max(bp_min.sm),
  md: set_bp_max(bp_min.md),
  lg: set_bp_max(bp_min.lg),
  "lg-xl": set_bp_max(bp_min["lg-xl"]),
  xl: set_bp_max(bp_min.xl),
  xxl: set_bp_max(bp_min.xxl),
};

const styleVars = {
  bp_min,
  bp_max,
};

// swiss
// -------------------------------------

function swiss(el) {
  console.log("swiss");

  let opts;
  let target = null;

  function is_supported_classlist_action(action) {
    const supported_classlist_actions = ["toggle", "add", "remove"];
    return supported_classlist_actions.includes(action);
  }

  // item_settings
  // -------------------------------------

  function item_settings() {
    opts = {
      classlist_action: "toggle",
      this_class: null,
      this_initial_state: null,
      target_class: null,
      target: null,
      target_initial_state: null,
      event_type: "click",
      resize_reset: false,
      bp_min: null,
      bp_max: null,
      run: null,
      trigger_event: null,
    };

    // set_opt
    // -------------------------------------

    function set_opt(opt_name, attr) {
      if (el.hasAttribute(attr)) {
        opts[opt_name] = el.getAttribute(attr);
      }
    }
    set_opt("classlist_action", "data-swiss-classlist_action");
    set_opt("this_class", "data-swiss-this-class");
    set_opt("target_class", "data-swiss-target-class");
    set_opt("target", "data-swiss-target");
    set_opt("bp_min", "data-swiss-bp-min");
    set_opt("bp_max", "data-swiss-bp-max");
    set_opt("event_type", "data-swiss-event-type");
    set_opt("reset_resize", "data-swiss-reset-resize");
    set_opt("run", "data-swiss-run");
    set_opt("trigger_event", "data-swiss-trigger-event");
  }

  // toggle_class_names
  // -------------------------------------

  function toggle_class_names(element, action, class_string) {
    const class_names = class_string.split(" ");
    class_names.forEach((class_name) => element.classList[action](class_name));
  }

  // set_classes
  // -------------------------------------

  function set_classes() {
    if (opts.this_class) {
      toggle_class_names(el, opts.classlist_action, opts.this_class);
    }

    if (opts.target_class && target) {
      toggle_class_names(target, opts.classlist_action, opts.target_class);
    }

    if (opts.classlist_action !== "toggle") {
      unbind();
    }

    if (opts.run) {
      const f = new Function(opts.run);
      f();
    }

    if (opts.trigger_event) {
      console.log("trigger", opts.trigger_event);
      el.dispatchEvent(new CustomEvent(opts.trigger_event));
    }
  }

  // reset_classes
  // -------------------------------------

  function reset_classes() {
    const this_classlist_action = opts.this_initial_state ? "add" : "remove";
    const target_classlist_action = opts.target_initial_state
      ? "add"
      : "remove";

    if (opts.this_class) {
      toggle_class_names(el, this_classlist_action, opts.this_class);
    }

    if (opts.target_class && target) {
      toggle_class_names(target, target_classlist_action, opts.target_class);
    }
  }

  // bind & unbind
  // -------------------------------------

  function bind() {
    el.addEventListener(opts.event_type, set_classes);
  }

  function unbind() {
    el.removeEventListener(opts.event_type, set_classes);
  }

  // bp_acitve
  // -------------------------------------

  function bp_active() {
    let bp_is_active = false;
    if (opts.bp_max) {
      bp_is_active = window.matchMedia(
        `(max-width:${styleVars.bp_max[opts.bp_max]})`
      ).matches;
    }
    if (opts.bp_min) {
      bp_is_active = window.matchMedia(
        `(min-width:${styleVars.bp_min[opts.bp_min]})`
      ).matches;
    }
    return bp_is_active;
  }

  // bind_or_unbind_listeners_based_on_bp
  // -------------------------------------

  function bind_or_unbind_listeners_based_on_bp() {
    if (bp_active()) {
      bind();
    } else {
      unbind();
      reset_classes();
    }
  }

  // store_initial_state
  // -------------------------------------

  function store_initial_state() {
    if (opts.this_class) {
      // Later, swiss may automatically unload itself (e.g. depending on breakpoint)
      // - to do this, save whether the classes were initially present on the element
      //   before swiss ran.

      const this_classes = opts.this_class.split(" ");
      opts.this_initial_state = el.classList.contains(this_classes[0]);
    }

    if (opts.target_class && target) {
      const target_classes = opts.target_class.split(" ");
      opts.target_initial_state = target.classList.contains(target_classes[0]);
    }
  }

  // init
  // -------------------------------------

  function init() {
    item_settings(el);

    console.log(opts);

    if (!is_supported_classlist_action(opts.classlist_action)) {
      return;
    }

    if (opts.target) {
      target = document.getElementById(opts.target);
    }

    store_initial_state();

    if (opts.resize_reset) {
      window.addEventListener("resize", reset_classes);
    }

    if (opts.bp_min || opts.bp_max) {
      window.addEventListener("resize", bind_or_unbind_listeners_based_on_bp);
      bind_or_unbind_listeners_based_on_bp();
    } else {
      bind();
    }
  }
  init();
}

// init_all
// ------------------------------------

function init_all() {
  console.log("init_all");
  const items = Array.from(document.querySelectorAll("[data-swiss]"));
  console.log(items);
  items.forEach(swiss);
}
init_all();
