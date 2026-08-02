<script setup lang="ts">
import { useVirtualizer } from "@tanstack/vue-virtual";
import { computed, ref, shallowRef } from "vue";
import {
  callbackVirtualizerAdapter,
  useVirtualSearchRegion,
} from "virtual-search/vue";
import { standardDataset, type Customer } from "../data";

const scrollElement = ref<HTMLElement | null>(null);
const customers = shallowRef<readonly Customer[]>(standardDataset.customers);
const virtualizer = useVirtualizer(computed(() => ({
  count: customers.value.length,
  estimateSize: () => 72,
  getScrollElement: () => scrollElement.value,
  overscan: 7,
})));
const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
const region = useVirtualSearchRegion({
  id: "vue-customer-directory",
  anchorRef: scrollElement,
  items: customers,
  getKey: customer => customer.id,
  getSearchParts: customer => [
    { id: "name", text: customer.name },
    { id: "email", text: customer.email },
    { id: "city", text: customer.city },
  ],
  virtualizer: callbackVirtualizerAdapter((index, options) => {
    virtualizer.value.scrollToIndex(index, { align: options.align });
  }),
});

function customerAt(index: number): Customer | undefined {
  return customers.value[index];
}
</script>

<template>
  <section class="vue-directory" aria-labelledby="vue-directory-title">
    <header class="vue-directory-header">
      <div>
        <span class="vue-eyebrow">TanStack Vue Virtual / region 01</span>
        <h2 id="vue-directory-title">Customer signal index</h2>
      </div>
      <div class="vue-record-count">
        <strong>{{ customers.length.toLocaleString() }}</strong>
        <span>records</span>
      </div>
    </header>

    <div
      ref="scrollElement"
      v-bind="region.regionAttrs"
      class="vue-virtual-surface"
      data-testid="vue-customer-directory"
    >
      <div class="vue-virtual-track" :style="{ height: `${totalSize}px` }">
        <template v-for="virtualRow in virtualRows" :key="virtualRow.key">
          <article
            v-if="customerAt(virtualRow.index)"
            v-bind="region.itemAttrs(customerAt(virtualRow.index)!.id)"
            class="vue-customer-row"
            :data-index="virtualRow.index"
            :style="{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }"
          >
            <span class="vue-row-number">
              {{ String(virtualRow.index + 1).padStart(4, "0") }}
            </span>
            <strong
              v-bind="region.partAttrs(customerAt(virtualRow.index)!.id, 'name')"
            >
              {{ customerAt(virtualRow.index)!.name }}
            </strong>
            <span
              v-bind="region.partAttrs(customerAt(virtualRow.index)!.id, 'email')"
              class="vue-row-email"
            >
              {{ customerAt(virtualRow.index)!.email }}
            </span>
            <span
              v-bind="region.partAttrs(customerAt(virtualRow.index)!.id, 'city')"
              class="vue-row-city"
            >
              {{ customerAt(virtualRow.index)!.city }}
            </span>
          </article>
        </template>
      </div>
    </div>
  </section>
</template>
