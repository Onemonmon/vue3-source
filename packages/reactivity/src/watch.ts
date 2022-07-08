import { isFunction, isObject } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { isReactive } from "./reactive";

function traverse(target: Record<string, any>, set: Set<any> = new Set()) {
  if (!isObject(target)) {
    return target;
  }
  // 解决循环引用
  if (set.has(target)) {
    return target;
  }
  set.add(target);
  for (let key in target) {
    traverse(target[key]);
  }
  return target;
}

export function watch(
  source: any,
  cb: (newValue?: any, oldValue?: any, onCleanup?: Function) => void,
  options?: { deep?: boolean; immediate?: boolean }
) {
  let getter: Function;
  if (isReactive(source)) {
    // 如果是一个响应式对象，需要遍历其中的属性，读取属性就会进行依赖收集
    getter = () => traverse(source);
  } else if (isFunction(source)) {
    getter = source;
  } else {
    return;
  }
  let oldValue: any;
  let newValue: any;
  let cleanup: Function;
  function onCleanup(fn: Function) {
    cleanup = fn;
  }
  const effect = new ReactiveEffect(getter, () => {
    // getter中的值改变时，会触发该调度器
    if (cleanup) {
      cleanup();
    }
    oldValue = newValue;
    newValue = effect.run();
    cb(newValue, oldValue, onCleanup);
  });
  newValue = effect.run();
}
