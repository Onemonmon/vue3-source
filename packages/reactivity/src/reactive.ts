import { isObject } from "@vue/shared";
import { ReactiveFlags, mutableHandlers } from "./baseHandler";
import { activeEffect } from "./effect";

const reactiveMap = new WeakMap();
/**
 * reactive
 * @param target 需要处理成响应式的对象
 */
export function reactive(target) {
  if (!isObject(target)) {
    return;
  }

  // 对象被代理过则直接返回自身
  // 此处访问 target.__v_isReactive，如果对象被代理过则会触发 Proxy.get 返回 true
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target;
  }

  // reactiveMap 实现同一个对象被代理多次时，返回的是同一个代理
  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  const proxy = new Proxy(target, mutableHandlers);
  reactiveMap.set(target, proxy);
  return proxy;
}
