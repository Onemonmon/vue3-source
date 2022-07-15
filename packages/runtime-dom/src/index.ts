import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";
import { createRenderer, Renderer, RenderOptions } from "@vue/runtime-core";

const rendererOptions = Object.assign(nodeOps, { patchProp });

let renderer: Renderer;

export const render: Renderer["render"] = (...args) => {
  renderer = renderer || createRenderer(rendererOptions);
  return renderer.render(...args);
};

export * from "@vue/runtime-core";
export * from "@vue/reactivity";
