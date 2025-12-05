# 🛠️ Swiss.js

A tiny Javascript utility for declaratively adding, removing and toggling classes — plus custom events and click-outside handling — using HTML data attributes.

Perfect for prototyping, sprinkling interactivity into static sites, and reducing scattered JS in non-React/Vue projects.

---

## ✨ Features

* **Declarative syntax** – Add behaviour directly in HTML using `data-swiss`.
* **Toggle classes (self or others)** – `toggle[this](bg-color:accent)`, `add[#menu](opacity:0)`
* **Multiple targets & multiple classes**
* **Event binding with `data-swiss-on`** – Click, hover, mouseenter/mouseleave, and more.
* **`clickOutside` built in** – Close menus, modals, popovers without manual wiring.
* **Conditional actions with `data-swiss-if`** – Only run logic when a selector matches.
* **Run inline JS** – `run:alert('Hello!')`
* **Dispatch custom events** – `event:myCustomEvent`

No framework required. No build step required. Just drop it in.

---

## 📦 Installation

### Via script tag

```html
<script src="src/swiss.js"></script>
```

### Via npm

```bash
npm install swissjs
```

Then:

```js
import "swissjs";
```

Swiss auto-initialises on DOM ready.

---

## 🧠 How it works

Swiss reads `data-swiss` attributes and attaches behaviour by:

* Parsing actions
* Binding event listeners
* Applying class changes
* Running inline JS when needed
* Monitoring conditions via CSS selectors

No global state, no virtual DOM. Just simple DOM behaviour.

---

## 🚀 Quick Examples

### 1. Toggle a class on itself

```html
<div
  class="bg-color:accent"
  data-swiss="toggle[this](bg-color:accent color:accent)"
>
  Click
</div>
```

### 2. Toggle class on another element

```html
<div
  data-swiss="
    toggle[#target](bg-color:accent)
    toggle[this](color:accent)
  "
>
  Click
</div>

<div id="target" class="bg-color:accent">
  Target
</div>
```

### 3. Hover to toggle class

```html
<div
  data-swiss="toggle[this](color:accent)"
  data-swiss-on="mouseenter mouseleave"
>
  Hover
</div>
```

### 4. Trigger an alert

```html
<div
  data-swiss="run:alert('Hello from Swiss.js!')"
>
  Click
</div>
```

### 5. Dispatch a custom event

```html
<button
  id="trigger"
  data-swiss="event:myEvent"
>
  Click
</button>

// then somewhere in your code, something like:
<script>
document.getElementById('trigger')
  .addEventListener('myEvent', () => console.log('Custom event fired!'));
</script>
```

---

## 🪟 Click Outside (modals, menus, popovers)

Swiss includes a built-in `clickOutside` event for closing UI elements easily.

### Example modal

#### Open Button

```html
<button
  data-swiss="
    remove[#modal](opacity:0 pointer-events:none)
    add[#modal](modal-is-active)
  "
>
  Open Modal
</button>
```

#### Overlay + Content

```html
<div id="modal"
     class="opacity:0 pointer-events:none fixed inset:0 bg:rgba(0,0,0,0.5) transition:opacity|0.1s ease flex center">

  // Modal Content
  <div
       data-swiss="
         add[#modal](opacity:0 pointer-events:none)
         remove[#modal](modal-is-active)"
       data-swiss-on="clickOutside"
       data-swiss-if="#modal.modal-is-active" // only when #modal has .modal-is-active class
  >

    <button
      data-swiss="
        add[#modal](opacity:0 pointer-events:none)
        remove[#modal](modal-is-active)
      "
    >
      Close
    </button>

    <p>Some modal content…</p>

  </div>
</div>
```

### Why this works

* `clickOutside` fires only when clicking *outside* the element it's defined on.
* `data-swiss-if` ensures actions run only when modal is open.
* Clicking inside modal content does **not** close it.
* But clicking the close button **does**.
* Clicking the "overlay" closes modal as it’s outside the element with `clickOutside`.

A robust modal primitive — without writing JS.

---

## 🧩 Syntax Overview

### Action Format

```
[actionType][selector](className className2 ...)
```

Examples:

* `toggle[this](my-class text-red)`
* `add[#menu](is-open)`
* `remove[.item](is-active)`

### Supported action types

| Action       | Description                 |
| ------------ | --------------------------- |
| `toggle`     | Toggles one or more classes |
| `add`        | Adds class(es)              |
| `remove`     | Removes class(es)           |
| `run:js`     | Runs inline JS              |
| `event:name` | Dispatches a custom event   |

---

## 🎛 Event Binding

Use `data-swiss-on`:

```html
data-swiss-on="click"
data-swiss-on="mouseenter mouseleave"
data-swiss-on="clickOutside"
```

If omitted, Swiss defaults to `click`.

---

## ⚡ Conditional Execution

### `data-swiss-if="selector"`

Actions run only when the selector matches at least one element.

```html
data-swiss-if="#modal.modal-is-active"
```

Useful for modals, menus, drawers, and stateful UI.

---

## 🧪 Reset on Resize

```html
data-swiss-reset-on-resize
```

Swiss restores initial class state when resizing the window — helpful for breakpoint-sensitive UI.

---

## 📦 File Size & Performance

Swiss is tiny:

* ~2 KB minified
* Zero dependencies
* No runtime DOM mutation unless events fire
* Ideal for static sites, CMS templates, and quick prototypes

---

## 🛠 When to use Swiss.js

Swiss shines when the alternative is writing repetitive DOM event code:

```js
document.querySelector('.menu-btn').addEventListener('click', () => {
  document.getElementById('menu').classList.toggle('open');
});
```

With Swiss, this becomes:

```html
data-swiss="toggle[#menu](open)"
```

Perfect for:

* Static sites
* Wordpress / Laravel Blade
* HTML prototypes
* Design system demos
* CMS-driven sites

---

## ❤️ Contributing

Swiss.js is intentionally simple. If you'd like to propose extensions (state helpers, media-query conditions, plugin hooks), open an issue.

---

## 📄 License

MIT License.
