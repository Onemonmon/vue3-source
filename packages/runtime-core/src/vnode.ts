import {
  isObject,
  isString,
  ShapeFlags,
  isArray,
  PatchFlags,
} from "@vue/shared";
import { Component, ComponentInternalInstance } from "./component";
import { RawSlots } from "./componentSlots";
import { DirectiveBinding } from "./directives";

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
  dynamicChildren: VNode[] | null;
  dynamicProps: string[] | null;
  el: Element | Text | null;
  shapeFlag: number;
  patchFlag: number;
  /**
   * VNode是一个组件时,会保存组件实例
   */
  component: ComponentInternalInstance | null;
  /**
   * 指令
   */
  dirs: DirectiveBinding[] | null;
};

export const isSameVNodeType = (n1: VNode, n2: VNode) =>
  n1.type === n2.type && n1.key === n2.key;

export const isVNode = (target: any) =>
  target ? target.__v_isVNode === true : false;

export const normalizeVNode = (vnode: VNode | string) => {
  if (isVNode(vnode)) {
    return vnode as VNode;
  }
  return createVNode(Text, null, vnode as string);
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
  children: VNodeChildren,
  patchFlag: PatchFlags = 0,
  dynamicProps: string[] | null = null,
  isBlockNode: boolean = false
) => {
  const vnode: VNode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    children,
    dynamicChildren: null,
    dynamicProps,
    key: props && props.key,
    el: null,
    shapeFlag: isString(type)
      ? ShapeFlags.ELEMENT
      : isObject(type) // 组件的type就是组件对象
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0,
    patchFlag,
    component: null,
    dirs: null,
  };
  // 判断children的类型
  // 1. 文本
  // 2. 数组
  // 2. 对象 => 插槽
  if (children) {
    normalizeChildren(vnode, children);
  }
  // 已经是block节点，就不能再收集自己了
  if (!isBlockNode && currentBlock && patchFlag > 0) {
    currentBlock.push(vnode);
  }
  return vnode;
};

let currentBlock: VNode[] | null = null;
// 为了形成block tree
const blockStack: (VNode[] | null)[] = [];

// disableTracking 只有在 v-for 创建了 Block Fragment 的时候才会是 true
// 此时 Block Fragment 的 chidren 必须全量更新，因为没办法确定循环的数组长度
export const openBlock = (disableTracking = false) => {
  blockStack.push((currentBlock = disableTracking ? null : []));
};

export const closeBlock = () => {
  blockStack.pop();
  currentBlock = blockStack[blockStack.length - 1];
};

// 为VNode打个标识patchFlag
export const createElementBlock = (
  type: VNodeTypes,
  props: Record<string, any> | null,
  children: VNodeChildren,
  patchFlag: PatchFlags,
  dynamicProps: string[] | null = null
) => {
  return setupBlock(
    createVNode(type, props, children, patchFlag, dynamicProps, true)
  );
};

const setupBlock = (vnode: VNode) => {
  vnode.dynamicChildren = currentBlock;
  closeBlock();
  // 此时如果还存在currentBlock，说明父级也是个block，把当前vnode作为它的一个dynamicChild
  if (currentBlock) {
    currentBlock.push(vnode);
  }
  return vnode;
};

export const createTextVNode = (text: string = " ", patchFlag = 0) => {
  return createVNode(Text, null, text, patchFlag);
};

export const createElementVNode = createVNode;
