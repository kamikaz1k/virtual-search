# Virtual Search

Native-like find-in-page across ordinary DOM content and records that have not
been mounted by a virtualizer. Virtual Search includes framework-agnostic core,
React, and Vue entry points in one package.

## Install only what you use

The framework and virtualizer integrations are optional peers. Installing the
core package does not install React, Vue, or TanStack Virtual.

```sh
# Framework-agnostic core
npm install virtual-search

# React (omit react and react-dom if your app already has them)
npm install virtual-search react react-dom

# Vue (omit vue if your app already has it)
npm install virtual-search vue

# TanStack React Virtual adapter
npm install virtual-search react react-dom @tanstack/react-virtual

# Vue + TanStack Virtual (uses the callback adapter)
npm install virtual-search vue @tanstack/vue-virtual
```

The React Window and React Virtuoso adapters use structural ref types, so they
do not add runtime dependencies. Install the virtualizer your application uses:

```sh
npm install virtual-search react react-dom react-window
# or
npm install virtual-search react react-dom react-virtuoso
```

## Entry points

```ts
import { createVirtualSearch } from "virtual-search";
import { VirtualSearchProvider } from "virtual-search/react";
import { provideVirtualSearch } from "virtual-search/vue";
import { tanstackVirtualAdapter } from "virtual-search/tanstack";
import { reactWindowAdapter } from "virtual-search/react-window";
import { reactVirtuosoAdapter } from "virtual-search/react-virtuoso";
```

See the [full documentation](https://github.com/kamikaz1k/virtual-search#readme)
and [live demos](https://kamikaz1k.github.io/virtual-search/).
