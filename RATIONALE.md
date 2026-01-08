## Why Swiss.js?

Swiss.js exists because, in a lot of real projects, **you don’t need a framework — you just need a few things done cleanly**.

- Toggling classes.
- Opening and closing menus.
- Responding to scroll or clicks outside.
- Sprinkling interactivity onto otherwise static pages.

Over time, those small needs tend to turn into:

- scattered `feature-x.js` files
- duplicated event listeners
- ad-hoc DOM queries
- fragile one-off logic

Swiss.js is an attempt to handle those basics **once**, in a way that stays readable, explicit, and easy to reason about.

---

## The “feature-x.js” problem

On many teams, small interactions start out innocently enough:

- toggle a class here
- open a menu there
- close something on outside click

Over time, this often turns into a pattern like:

- `menu.js`
- `dropdown.js`
- `header-interactions.js`
- `feature-x.js`
- `feature-x-v2.js`

Each written slightly differently, by different people, at different times.

The problems compound quickly:

- everyone has their own way of wiring events
- behaviour is scattered across multiple files
- it’s unclear whether a class is used for styling, behaviour, or both
- designers are afraid to remove classes “just in case”
- simple UI changes require tracing JavaScript to understand side effects
- nobody is quite sure what’s safe to delete

None of this is dramatic — but it creates friction, slows teams down, and makes front-end codebases feel brittle.

Swiss.js exists largely to avoid that outcome.

By expressing small behaviours directly in markup:

- the behaviour is visible where it applies
- there’s no mystery about what a class does
- interactions are easier to audit
- removing or changing UI becomes safer
- teams converge on a shared, predictable pattern

Swiss.js doesn’t prevent you from writing `feature-x.js` files.
But it _does_ change what those files are for.

Instead of dozens of small, bespoke scripts handling trivial, repeated interactions, you tend to end up with:

- far fewer custom JavaScript files
- focused on behaviour that actually needs logic
- doing real work, rather than glue code

In other words, Swiss.js doesn’t eliminate JavaScript — it helps **contain it**.

> Swiss.js works best when JavaScript becomes the exception, not the default.

---

## Why not Alpine / React / Vue?

Frameworks like Alpine, React, Vue, etc. are excellent tools — **when you actually need a component model, state, or reactivity**.

But many projects don’t.

Swiss.js is aimed at situations where:

- you’re working with static HTML or server-rendered templates
- the page structure already exists
- you want small, local interactions
- you don’t want a build step
- you don’t want to introduce a mental model larger than the problem

In those cases, a framework can feel like overkill — not because it’s “bad”, but because it solves a _different_ class of problems.

Swiss.js deliberately avoids:

- state management
- reactivity
- lifecycle abstractions
- component hierarchies

Instead, it focuses on **imperative DOM effects**, expressed declaratively in HTML.

---

## Why attributes?

HTML attributes turn out to be a very good place to express small interactions:

- they live next to the markup they affect
- they’re visible to designers and non-JS specialists
- they’re easy to copy, paste, and modify
- they don’t require understanding a framework’s internals

Swiss.js leans into this by making actions explicit:

```html
data-swiss="remove[.tab](active) add(active)"
```

There’s no hidden state, no magic bindings — just:

- what happens
- to what
- when an event fires

---

## Real-world origins

Swiss.js grew out of work on large, long-lived front-end codebases under real constraints:

- mixed skill levels across teams
- designers needing to add or adjust interactions
- environments where adding a framework wasn’t always possible or desirable
- the need to keep behaviour obvious and auditable

In those contexts, the goal wasn’t to be clever — it was to be **predictable, boring, and robust**.

Swiss.js reflects that philosophy:

- explicit over implicit
- readable over terse
- boring over magical

---

## What Swiss.js is (and isn’t)

**Swiss.js is:**

- a small declarative layer for DOM manipulation
- good at menus, tabs, modals, scroll effects, and simple UI state
- friendly to static sites, CMS templates, and embedded custom code
- something you can understand by reading the HTML

**Swiss.js is not:**

- a replacement for React, Vue, or Alpine
- a component framework
- a state management solution
- trying to “win” against anything

If you need a framework, you should use one.

If you just need the basics handled cleanly, Swiss.js might be enough.

---

## The goal

The goal of Swiss.js is simple:

> **Make small interactions easy to add, easy to read, and easy to remove.**

Nothing more.
