import { isArray, isObject } from "@vue/shared";
import { createVNode, isVNode } from "./vnode";

/**
// type
h('div')

// type + props
h('div', {})

// type + children
h('div', []) // array
h('div', 'foo') // text
h('div', h('br')) // vnode

// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
*/

export function h(type: any, propsOrChildren?: any, children?: any) {
  const l = arguments.length;
  // type + props || type + children
  if (l === 2) {
    // props || vnode
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // vnode
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      // props
      return createVNode(type, propsOrChildren, null);
    }
    // string
    return createVNode(type, null, propsOrChildren);
  } else {
    // type + props + children
    if (l === 3) {
      if (isVNode(children)) {
        children = [children];
      }
    }
    // type + props + children + children + ...
    else if (l > 3) {
      children = Array.from(arguments).slice(2);
    }
    // l == 1
    return createVNode(type, propsOrChildren, children);
  }
}
