// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"StyleVars.js":[function(require,module,exports) {
// Increment a min breakpoint value by one to get the max
function set_bp_max(min_val) {
  return "".concat(parseInt(min_val, 10) + 1, "px");
}

var bp_min = {
  xs: "480px",
  sm: "600px",
  md: "900px",
  lg: "1200px",
  "lg-xl": "1450px",
  xl: "1850px",
  xxl: "2250px"
};
var bp_max = {
  xs: set_bp_max(bp_min.xs),
  sm: set_bp_max(bp_min.sm),
  md: set_bp_max(bp_min.md),
  lg: set_bp_max(bp_min.lg),
  "lg-xl": set_bp_max(bp_min["lg-xl"]),
  xl: set_bp_max(bp_min.xl),
  xxl: set_bp_max(bp_min.xxl)
};
module.exports = {
  bp_min: bp_min,
  bp_max: bp_max
};
},{}],"dswiss.js":[function(require,module,exports) {
"use strict";

var _StyleVars = _interopRequireDefault(require("./StyleVars"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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
// swiss
// -------------------------------------
function swiss(el) {
  console.log("swiss");
  var opts;
  var target = null;

  function is_supported_classlist_action(action) {
    var supported_classlist_actions = ["toggle", "add", "remove"];
    return supported_classlist_actions.includes(action);
  } // item_settings
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
      trigger_event: null
    }; // set_opt
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
  } // toggle_class_names
  // -------------------------------------


  function toggle_class_names(element, action, class_string) {
    var class_names = class_string.split(" ");
    class_names.forEach(function (class_name) {
      return element.classList[action](class_name);
    });
  } // set_classes
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
      var f = new Function(opts.run);
      f();
    }

    if (opts.trigger_event) {
      console.log("trigger", opts.trigger_event);
      el.dispatchEvent(new CustomEvent(opts.trigger_event));
    }
  } // reset_classes
  // -------------------------------------


  function reset_classes() {
    var this_classlist_action = opts.this_initial_state ? "add" : "remove";
    var target_classlist_action = opts.target_initial_state ? "add" : "remove";

    if (opts.this_class) {
      toggle_class_names(el, this_classlist_action, opts.this_class);
    }

    if (opts.target_class && target) {
      toggle_class_names(target, target_classlist_action, opts.target_class);
    }
  } // bind & unbind
  // -------------------------------------


  function bind() {
    el.addEventListener(opts.event_type, set_classes);
  }

  function unbind() {
    el.removeEventListener(opts.event_type, set_classes);
  } // bp_acitve
  // -------------------------------------


  function bp_active() {
    var bp_is_active = false;

    if (opts.bp_max) {
      bp_is_active = window.matchMedia("(max-width:".concat(_StyleVars.default.bp_max[opts.bp_max], ")")).matches;
    }

    if (opts.bp_min) {
      bp_is_active = window.matchMedia("(min-width:".concat(_StyleVars.default.bp_min[opts.bp_min], ")")).matches;
    }

    return bp_is_active;
  } // bind_or_unbind_listeners_based_on_bp
  // -------------------------------------


  function bind_or_unbind_listeners_based_on_bp() {
    if (bp_active()) {
      bind();
    } else {
      unbind();
      reset_classes();
    }
  } // store_initial_state
  // -------------------------------------


  function store_initial_state() {
    if (opts.this_class) {
      // Later, swiss may automatically unload itself (e.g. depending on breakpoint)
      // - to do this, save whether the classes were initially present on the element
      //   before swiss ran.
      var this_classes = opts.this_class.split(" ");
      opts.this_initial_state = el.classList.contains(this_classes[0]);
    }

    if (opts.target_class && target) {
      var target_classes = opts.target_class.split(" ");
      opts.target_initial_state = target.classList.contains(target_classes[0]);
    }
  } // init
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
} // init_all
// ------------------------------------


function init_all() {
  console.log("init_all");
  var items = Array.from(document.querySelectorAll("[data-swiss]"));
  console.log(items);
  items.forEach(swiss);
}

init_all();
console.log("running");
},{"./StyleVars":"StyleVars.js"}],"../../../../../.npm-global/lib/node_modules/parcel/src/builtins/hmr-runtime.js":[function(require,module,exports) {
var global = arguments[3];
var OVERLAY_ID = '__parcel__error__overlay__';
var OldModule = module.bundle.Module;

function Module(moduleName) {
  OldModule.call(this, moduleName);
  this.hot = {
    data: module.bundle.hotData,
    _acceptCallbacks: [],
    _disposeCallbacks: [],
    accept: function (fn) {
      this._acceptCallbacks.push(fn || function () {});
    },
    dispose: function (fn) {
      this._disposeCallbacks.push(fn);
    }
  };
  module.bundle.hotData = null;
}

module.bundle.Module = Module;
var checkedAssets, assetsToAccept;
var parent = module.bundle.parent;

if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== 'undefined') {
  var hostname = "" || location.hostname;
  var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  var ws = new WebSocket(protocol + '://' + hostname + ':' + "57095" + '/');

  ws.onmessage = function (event) {
    checkedAssets = {};
    assetsToAccept = [];
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      var handled = false;
      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          var didAccept = hmrAcceptCheck(global.parcelRequire, asset.id);

          if (didAccept) {
            handled = true;
          }
        }
      }); // Enable HMR for CSS by default.

      handled = handled || data.assets.every(function (asset) {
        return asset.type === 'css' && asset.generated.js;
      });

      if (handled) {
        console.clear();
        data.assets.forEach(function (asset) {
          hmrApply(global.parcelRequire, asset);
        });
        assetsToAccept.forEach(function (v) {
          hmrAcceptRun(v[0], v[1]);
        });
      } else if (location.reload) {
        // `location` global exists in a web worker context but lacks `.reload()` function.
        location.reload();
      }
    }

    if (data.type === 'reload') {
      ws.close();

      ws.onclose = function () {
        location.reload();
      };
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
      removeErrorOverlay();
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + data.error.stack);
      removeErrorOverlay();
      var overlay = createErrorOverlay(data);
      document.body.appendChild(overlay);
    }
  };
}

function removeErrorOverlay() {
  var overlay = document.getElementById(OVERLAY_ID);

  if (overlay) {
    overlay.remove();
  }
}

function createErrorOverlay(data) {
  var overlay = document.createElement('div');
  overlay.id = OVERLAY_ID; // html encode message and stack trace

  var message = document.createElement('div');
  var stackTrace = document.createElement('pre');
  message.innerText = data.error.message;
  stackTrace.innerText = data.error.stack;
  overlay.innerHTML = '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' + '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' + '<span style="top: 2px; margin-left: 5px; position: relative;">🚨</span>' + '<div style="font-size: 18px; font-weight: bold; margin-top: 20px;">' + message.innerHTML + '</div>' + '<pre>' + stackTrace.innerHTML + '</pre>' + '</div>';
  return overlay;
}

function getParents(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];

      if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) {
        parents.push(k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAcceptCheck(bundle, id) {
  var modules = bundle.modules;

  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAcceptCheck(bundle.parent, id);
  }

  if (checkedAssets[id]) {
    return;
  }

  checkedAssets[id] = true;
  var cached = bundle.cache[id];
  assetsToAccept.push([bundle, id]);

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    return true;
  }

  return getParents(global.parcelRequire, id).some(function (id) {
    return hmrAcceptCheck(global.parcelRequire, id);
  });
}

function hmrAcceptRun(bundle, id) {
  var cached = bundle.cache[id];
  bundle.hotData = {};

  if (cached) {
    cached.hot.data = bundle.hotData;
  }

  if (cached && cached.hot && cached.hot._disposeCallbacks.length) {
    cached.hot._disposeCallbacks.forEach(function (cb) {
      cb(bundle.hotData);
    });
  }

  delete bundle.cache[id];
  bundle(id);
  cached = bundle.cache[id];

  if (cached && cached.hot && cached.hot._acceptCallbacks.length) {
    cached.hot._acceptCallbacks.forEach(function (cb) {
      cb();
    });

    return true;
  }
}
},{}]},{},["../../../../../.npm-global/lib/node_modules/parcel/src/builtins/hmr-runtime.js","dswiss.js"], null)
//# sourceMappingURL=/dswiss.33189e28.js.map