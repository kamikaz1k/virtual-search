import { createApp } from "vue";
import VueDemo from "./VueDemo.vue";

export function mountVueDemo(element: Element): void {
  createApp(VueDemo).mount(element);
}
