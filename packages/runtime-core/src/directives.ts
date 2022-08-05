import { isFunction, log } from "@vue/shared";
import { traverse } from "./apiWatch";
import { VNode } from "./vnode";

export interface DirectiveBinding {
  value: any;
  oldValue: any | null;
  arg?: string;
  modifiers: any;
  dir: ObjectDirective;
}

export type DirectiveHook = (
  el: any,
  binding: DirectiveBinding,
  vnode: VNode,
  prevVNode: VNode | null
) => void;

export interface ObjectDirective {
  /**
   * 在绑定元素的 attribute 或事件监听器被应用之前调用。在指令需要附加在普通的 v-on 事件监听器调用前的事件监听器中时，这很有用。
   */
  created?: DirectiveHook;
  /**
   * 当指令第一次绑定到元素并且在挂载父组件之前调用。
   */
  beforeMount?: DirectiveHook;
  /**
   * 在绑定元素的父组件被挂载后调用。
   */
  mounted?: DirectiveHook;
  /**
   * 在更新包含组件的 VNode 之前调用。
   */
  beforeUpdate?: DirectiveHook;
  /**
   * 在包含组件的 VNode 及其子组件的 VNode 更新后调用。
   */
  updated?: DirectiveHook;
  beforeUnmount?: DirectiveHook;
  unmounted?: DirectiveHook;
  deep?: boolean;
}

// 为vnode添加指令
export const withDirectives = (
  vnode: VNode,
  // dir 指令, value 指令绑定的值, arg 指令绑定的参数, modifiers
  directives: Array<
    [
      ObjectDirective,
      any,
      string,
      { trim?: boolean; lazy?: boolean; number?: boolean }
    ]
  >
) => {
  const bindings: DirectiveBinding[] = vnode.dirs || (vnode.dirs = []);
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = {}] = directives[i];
    // 如果传入的指令是函数，则mounted和updated都是这个函数
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir,
      } as ObjectDirective;
    }
    if (dir.deep) {
      traverse(value);
    }
    bindings.push({
      value,
      oldValue: undefined,
      dir,
      arg,
      modifiers,
    });
  }
  return vnode;
};

// 触发元素绑定的指令
export const invokeDirectiveHook = (
  vnode: VNode,
  prevVNode: VNode | null,
  name: keyof ObjectDirective
) => {
  const bindings = vnode.dirs!;
  const oldBindings = prevVNode && prevVNode.dirs;
  // 触发所有绑定的指令的name对应的回调
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    if (oldBindings) {
      binding.oldValue = oldBindings[i].value;
    }
    const hook = binding.dir[name] as DirectiveHook | undefined;
    if (hook) {
      log(
        false,
        "开始触发",
        vnode.el,
        "上绑定的指令: ",
        binding,
        "，阶段为：",
        name
      );
      hook(vnode.el, binding, vnode, prevVNode);
    }
  }
};
