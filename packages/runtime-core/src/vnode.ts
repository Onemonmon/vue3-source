import { isObject, isString, ShapeFlags, isArray } from "@vue/shared";
import { Component, ComponentInternalInstance } from "./component";
import { RawSlots } from "./componentSlots";

export const Text = Symbol("Text");
export const Fragment = Symbol("Fragment");

export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Fragment;

export type VNodeChildAtom = string | VNode;

export type VNodeChildren = VNodeChildAtom[] | string | RawSlots | null;

export type VNode = {
  __v_isVNode: true;
  __v_skip: true;
  type: VNodeTypes;
  props: Record<string, any> | null;
  key: string | number | symbol | null;
  children: VNodeChildren;
  el: Element | Text | null;
  shapeFlag: number;
  patchFlag: number;
  /**
   * VNode是一个组件时,会保存组件实例
   */
  component: ComponentInternalInstance | null;
};

export const isSameVNodeType = (n1: VNode, n2: VNode) =>
  n1.type === n2.type && n1.key === n2.key;

export const isVNode = (target: any) =>
  target ? target.__v_isVNode === true : false;

export const normalizeVNode = (vnode: VNode | string) => {
  if (isVNode(vnode)) {
    return vnode as VNode;
  } else {
    return createVNode(Text, null, vnode as string);
  }
};

export const normalizeChildren = (vnode: VNode, children: VNodeChildren) => {
  let type = 0;
  if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN;
  } else if (isObject(children)) {
    type = ShapeFlags.SLOTS_CHILDREN;
  } else {
    children = String(children);
    type = ShapeFlags.TEXT_CHILDREN;
  }
  vnode.shapeFlag |= type;
  vnode.children = children;
};

/**
 * 创建虚拟节点
 * @param type VNodeTypes
 * @param props 属性
 * @param children 子节点VNodeChildren
 * @returns VNode
 */
export const createVNode = (
  type: VNodeTypes,
  props: Record<string, any> | null,
  children: VNodeChildren
) => {
  const vnode: VNode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    children,
    key: props && props.key,
    el: null,
    shapeFlag: isString(type)
      ? ShapeFlags.ELEMENT
      : isObject(type) // 组件的type就是组件对象
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0,
    patchFlag: 0,
    component: null,
  };
  // 判断children的类型
  // 1. 文本
  // 2. 数组
  // 2. 对象 => 插槽
  if (children) {
    normalizeChildren(vnode, children);
  }
  return vnode;
};
