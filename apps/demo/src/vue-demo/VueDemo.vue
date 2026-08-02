<script setup lang="ts">
import { ref } from "vue";
import {
  provideVirtualSearch,
  SearchPanel,
  useFindShortcut,
} from "virtual-search/vue";
import VirtualDirectory from "./VirtualDirectory.vue";
import "./styles.css";

const searchRoot = ref<HTMLElement | null>(null);
const search = provideVirtualSearch({
  root: searchRoot,
  inputValueHighlighting: { mode: "overlay", zIndex: 19 },
});
useFindShortcut({ search });

const baseUrl = import.meta.env.BASE_URL;
</script>

<template>
  <div class="vue-demo-shell">
    <SearchPanel class="vue-search-panel" viewport-anchor="top" />

    <button class="vue-open-search" type="button" @click="search.open">
      <span>Open page search</span>
      <kbd>⌘ F</kbd>
    </button>

    <header class="demo-site-header demo-site-header--light">
      <a class="demo-site-brand" :href="baseUrl">
        <span class="demo-site-brand-mark">VS</span>
        <span>
          <strong>Virtual Search</strong>
          <small>Browser Find laboratory</small>
        </span>
      </a>
      <nav class="demo-site-nav" aria-label="Demo pages">
        <a :href="baseUrl"><i>01</i>Features</a>
        <a :href="`${baseUrl}diff/`"><i>02</i>Performance</a>
        <span aria-current="page"><i>03</i>Vue</span>
      </nav>
      <a
        class="demo-site-source"
        href="https://github.com/kamikaz1k/virtual-search"
      >GitHub <span aria-hidden="true">↗</span></a>
    </header>

    <main ref="searchRoot" class="vue-demo-main">

      <header class="vue-hero">
        <div class="vue-hero-copy">
          <span class="vue-framework-mark">Vue 3 × Virtual Search</span>
          <h1>Search beyond<br><em>the rendered frame.</em></h1>
          <p>
            A native-like Find surface connected through Vue composables.
            Every customer is searchable, although this page only mounts the
            handful of rows currently in view.
          </p>
          <button type="button" class="vue-hero-action" @click="search.open">
            Search this page
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        <aside class="vue-proof-card" aria-label="Suggested demo search">
          <span class="vue-proof-label">Suggested query</span>
          <strong>Alice</strong>
          <p>Appears throughout the virtual directory below.</p>
          <dl>
            <div><dt>Framework</dt><dd>Vue 3</dd></div>
            <div><dt>Virtualizer</dt><dd>TanStack</dd></div>
            <div><dt>Mounted rows</dt><dd>≈ 14</dd></div>
          </dl>
        </aside>
      </header>

      <section class="vue-static-proof" aria-labelledby="vue-static-title">
        <span class="vue-eyebrow">Ordinary DOM / automatic</span>
        <h2 id="vue-static-title">One search surface, two sources.</h2>
        <p>
          This ordinary paragraph is indexed directly from the document. The
          <strong>Juniper Relay</strong> phrase proves static content remains in
          document order alongside records supplied by the virtualizer.
        </p>
        <label>
          <span>Input-value overlay specimen</span>
          <input value="Juniper Relay" readonly aria-label="Input-value overlay specimen">
        </label>
      </section>

      <VirtualDirectory />

    </main>

    <footer class="demo-site-footer demo-site-footer--light">
      <div class="demo-site-footer-brand">
        <span class="demo-site-brand-mark">VS</span>
        <strong>Virtual Search</strong>
      </div>
      <p>Native-like page search across DOM and virtualized content.</p>
      <nav aria-label="Demo pages">
        <a :href="baseUrl">Features</a>
        <a :href="`${baseUrl}diff/`">Performance</a>
        <span aria-current="page">Vue</span>
      </nav>
      <span class="demo-site-footer-note">Open source experiment · 2026</span>
    </footer>
  </div>
</template>
