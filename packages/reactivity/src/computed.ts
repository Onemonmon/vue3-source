import { isFunction, log } from "@vue/shared";
import { ReactiveEffect, trackEffect, triggerEffect } from "./effect";

let logHide = false;
class ComputedRefImpl {
  private effect: ReactiveEffect;
  private _dirty: boolean = true; // 缓存标识
  private _value: any;
  private __v_isReadonly: boolean = true;
  private __v_isRef: boolean = true;
  private dep: Set<ReactiveEffect> = new Set();
  constructor(getter: Function, public setter: Function) {
    // 收集computed中依赖的属性，属性值改变时重新触发getter
    this.effect = new ReactiveEffect(getter, () => {
      // 依赖改变后会进入调度器
      if (!this._dirty) {
        log(
          logHide,
          "computed内部依赖的值改变，开始触发使用到该computed的effect"
        );
        this._dirty = true;
        // 需要触发依赖该computed的effect
        triggerEffect(this.dep);
      }
    });
  }
  get value() {
    log(logHide, "获取computed.value，开始收集使用到该computed的effect");
    // 需要收集依赖该computed的effect
    trackEffect(this.dep);
    if (this._dirty) {
      // 获取 computed.value 时，如果依赖改变了，需要重新执行 effect.run
      this._dirty = false;
      this._value = this.effect.run();
    }
    return this._value;
  }
  set value(newValue) {
    this.setter(newValue);
  }
}

export function computed(params: any) {
  log(logHide, "执行computed函数，初始化getter和setter...");
  // 先拆分 getter 和 setter
  const onlyGetter = isFunction(params);
  let getter: Function;
  let setter: Function;
  if (onlyGetter) {
    getter = params;
    setter = () => {
      log(logHide, "no setter");
    };
  } else {
    getter = params.get;
    setter = params.set;
  }
  return new ComputedRefImpl(getter, setter);
}
