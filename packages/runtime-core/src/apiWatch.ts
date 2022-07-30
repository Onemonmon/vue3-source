import {
  EMPTY_OBJ,
  isArray,
  isFunction,
  isObject,
  isPlainObject,
  log,
} from "@vue/shared";
import { ReactiveEffect, isReactive, isRef } from "@vue/reactivity";
import { ReactiveFlags } from "packages/reactivity/src/baseHandler";
import { queuePreFlushCb } from "./scheduler";

export type WatchOptions = {
  deep?: boolean;
  immediate?: boolean;
  flush?: string;
};
export type WatchCallback = (
  newValue?: any,
  oldValue?: any,
  onCleanup?: Function
) => void;

function traverse(target: Record<string, any>, seen: Set<any> = new Set()) {
  // 不是对象，或不需要代理
  if (!isObject(target) || target[ReactiveFlags.SKIP]) {
    return target;
  }
  // 解决循环引用
  if (seen.has(target)) {
    return target;
  }
  seen.add(target);
  if (isRef(target)) {
    traverse(target.value, seen);
  } else if (isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      traverse(target[i], seen);
    }
  } else if (isPlainObject(target)) {
    for (let key in target) {
      traverse(target[key], seen);
    }
  }
  return target;
}

const INITIAL_WATCHER_VALUE = {};

export function doWatch(
  source: any,
  cb: WatchCallback | null,
  { deep, immediate, flush }: WatchOptions = EMPTY_OBJ,
  logHide: boolean = false
) {
  // 构造getter函数
  let getter: () => any;
  // 是否监听数组
  let isMultiSource = false;
  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => source;
    // 如果是一个响应式对象，会默认deep遍历其中的属性，读取属性就会进行依赖收集
    deep = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    getter = () =>
      source.map((s: any) => {
        if (isRef(s)) {
          return s.value;
        } else if (isReactive(s)) {
          // 如果是一个响应式对象，需要遍历其中的属性，读取属性就会进行依赖收集
          return traverse(s);
        } else if (isFunction(s)) {
          return s();
        }
      });
  } else if (isFunction(source)) {
    getter = () => source();
  } else {
    return;
  }
  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }
  log(logHide, "\n执行watch函数，创建getter");
  let cleanup: Function;
  function onCleanup(fn: Function) {
    cleanup = fn;
  }
  let oldValue: any = isMultiSource ? [] : INITIAL_WATCHER_VALUE;
  const job = () => {
    if (cleanup) {
      cleanup();
    }
    if (cb) {
      log(logHide, "执行getter获取新值...");
      const newValue = effect.run();
      log(logHide, "触发watch的回调函数...");
      cb(
        newValue,
        oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
        onCleanup
      );
      oldValue = newValue;
    }
  };
  let scheduler = () => {};
  if (flush === "sync") {
    scheduler = job;
  } else {
    // flush默认pre，在组件更新之前执行
    // props导致的组件更新，会在更新props之前触发flushPreFlushCbs
    // state导致的组件更新，由于watch代码写在return前，因此watch的依赖会比render的依赖先触发，因此也会先执行queuePreFlushCb
    scheduler = () => queuePreFlushCb(job);
  }
  // getter中的值改变时，会触发该调度器
  const effect = new ReactiveEffect(getter, scheduler);
  if (cb) {
    if (immediate) {
      job();
    } else {
      // 执行一次getter，收集依赖
      oldValue = effect.run();
    }
  }
}

export function watch(
  source: any,
  cb: WatchCallback,
  watchOptions?: WatchOptions
) {
  doWatch(source, cb, watchOptions);
}
