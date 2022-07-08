import { isObject } from "@vue/shared";
import { ReactiveEffect, trackEffect, triggerEffect } from "./effect";
import { reactive } from "./reactive";

/**
 * 将对象变成响应式
 */
function toReactive(target: any) {
  return isObject(target) ? reactive(target) : target;
}

class RefImpl {
  private _value: any;
  private __v_isRef: boolean = true;
  private dep: Set<ReactiveEffect> = new Set();
  constructor(public _rawValue: any) {
    this._value = toReactive(_rawValue);
  }
  get value() {
    // 收集依赖
    trackEffect(this.dep);
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this._rawValue) {
      this._value = toReactive(newValue);
      this._rawValue = newValue;
      // 触发effect
      triggerEffect(this.dep);
    }
  }
}

export function ref(target: any) {
  return new RefImpl(target);
}
