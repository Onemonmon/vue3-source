import { EMPTY_OBJ, isString, ShapeFlags } from "@vue/shared";
import {
  isSameVNodeType,
  VNode,
  Text,
  isVNode,
  createVNode,
  VNodeChildAtom,
} from "./vnode";

/**
 * 操作节点的方法
 */
export type RenderOptions = {
  // 设置属性
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  // 插入
  insert: (el: Element | Text, parent: Element, anchor: Element | null) => void;
  // 删除
  remove: (el: Element) => void;
  // 创建元素节点
  createElement: (type: string) => Element;
  // 创建文本节点
  createText: (text: string) => Text;
  // 设置元素节点文本
  setElementText: (el: Element, text: string) => void;
  // 设置文本节点文本
  setText: (el: Element, text: string) => void;
  // 获取父节点
  parentNode: (el: Element) => ParentNode | null;
  // 获取兄弟节点
  siblingNode: (el: Element) => ChildNode | null;
  // 获取节点
  querySelector: (selector: string) => Element | null;
};

export type RootRenderFunction = (
  vnode: VNode | null,
  container: RenderNode
) => void;

export type Renderer = {
  render: RootRenderFunction;
};

export type CreateRenderer = (options: RenderOptions) => Renderer;

export type RenderNode = Element & {
  [key: string]: any;
};

/**
 * 创建自定义渲染器（与平台无关，操作节点的方法由外部传入）
 * @param options RenderOptions 操作节点的方法
 */
export const createRenderer: CreateRenderer = (options) => {
  const {
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    createElement: hostCreateElement,
    createText: hostCreateText,
    setElementText: hostSetElementText,
    setText: hostSetText,
    parentNode: hostParentNode,
    siblingNode: hostSiblingNode,
    querySelector: hostQuerySelector,
  } = options;

  // 卸载元素
  const unmount = (vnode: VNode) => {
    hostRemove(vnode.el as Element);
  };

  const unmountChildren = (children: VNodeChildAtom[]) => {};

  // 核心函数 进行元素比对 => 挂载 更新
  const patch = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    anchor: Element | null = null
  ) => {
    if (n1 === n2) return;
    // 如果元素类型不同，直接卸载旧元素，挂载新元素
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 卸载旧元素
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        processText(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        }
    }
  };

  // 处理文本节点
  const processText = (n1: VNode | null, n2: VNode, container: Element) => {
    if (n1 === null) {
      hostInsert(hostCreateText(n2.children as string), container, null);
    } else {
      // 复用节点，直接修改文本
      const el = (n2.el = n2.el as Element);
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children as string);
      }
    }
  };

  // 处理元素节点
  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    anchor: Element | null = null
  ) => {
    if (n1 === null) {
      mountElement(n2, container, anchor);
    } else {
      patchElement(n1, n2);
    }
  };

  // 复用节点 比较元素属性、children
  const patchElement = (n1: VNode, n2: VNode) => {
    const el = n1.el as Element;
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    patchProps(el, oldProps, newProps);
    patchChildren(n1, n2, el);
  };

  const patchProps = (el: Element, oldProps: any, newProps: any) => {
    if (newProps !== oldProps) {
      // 添加新属性
      if (newProps !== EMPTY_OBJ) {
        for (let key in newProps) {
          hostPatchProp(el, key, oldProps[key], newProps[key]);
        }
      }
      // 删除旧属性
      if (oldProps !== EMPTY_OBJ) {
        for (let key in oldProps) {
          if (!newProps[key]) {
            hostPatchProp(el, key, oldProps[key], null);
          }
        }
      }
    }
  };

  const patchChildren = (n1: VNode, n2: VNode, container: Element) => {
    // 新     旧
    // 文本   数组     卸载数组，设置文本
    // 文本   文本     设置文本
    // 文本   空       设置文本
    // 数组   数组     DIFF
    // 数组   文本     清除文本，挂载数组
    // 数组   空       挂载数组
    // 空     数组     卸载数组
    // 空     文本     清除文本
    // 空     空       NODO
    const c1 = n1.children;
    const c2 = n2.children;
    const { shapeFlag: prevShapFlag } = n2;
    const { shapeFlag } = n2;
    // 新 = 文本 | 空
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN || c2 === null) {
      // 旧 = 数组 卸载数组
      if (prevShapFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c2 as VNodeChildAtom[]);
      }
      // 设置文本
      else if (c1 !== c2) {
        hostSetElementText(container, c2 as string);
      }
    }
    // 新 = 数组
    else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 旧 = 数组 DIFF
      if (prevShapFlag & ShapeFlags.ARRAY_CHILDREN) {
        patchKeyedChildren(c1 as VNode[], c2 as VNodeChildAtom[], container);
      }
      // 旧 = 文本 | 空
      else {
        // 旧 = 文本 清除文本
        if (prevShapFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, "");
        }
        // 挂载数组
        mountChildren(c2 as VNodeChildAtom[], container);
      }
    }
  };

  // DIFF
  const patchKeyedChildren = (
    c1: VNode[],
    c2: VNodeChildAtom[],
    container: Element
  ) => {
    let i = 0;
    const l2 = c2.length;
    let e1 = c1.length - 1;
    let e2 = c2.length - 1;
    // 1. sync from start
    // (a b) c
    // (a b) d e
    while (i < e1 && i < e2) {
      const n1 = c1[i];
      const n2 = normalizeVNode(c2[i]);
      if (isSameVNodeType(n1, n2)) {
        // 相同类型的节点 => patch 复用
        patch(n1, n2, container);
        i++;
      } else {
        break;
      }
    }
    // 2. sync from end
    // a (b c)
    // d e (b c)
    while (e1 >= i && e2 >= i) {
      const n1 = c1[e1];
      const n2 = normalizeVNode(c2[e2]);
      if (isSameVNodeType(n1, n2)) {
        patch(n1, n2, container);
        e1--;
        e2--;
      } else {
        break;
      }
    }
    // 3. common sequence + mount
    // (a b)
    // (a b) c d
    // i = 2, e1 = 1, e2 = 3
    // (a b)
    // c d (a b)
    // i = 0, e1 = -1, e2 = 1
    if (i > e1 && i <= e2) {
      while (i <= e2) {
        // 判断e2后面是否还有节点 有节点的话需要当作插入的参照物
        const nextPos = e2 + 1;
        const anchor =
          nextPos < c2.length ? normalizeVNode(c2[nextPos]).el : null;
        const n2 = normalizeVNode(c2[e2]);
        patch(null, n2, container, anchor);
        i++;
      }
    }
    // 4. common sequence + unmount
    // (a b) c d
    // (a b)
    // i = 2, e1 = 3, e2 = 1
    // a b (b c)
    // (b c)
    // i = 0, e1 = 1, e2 = -1
    else if (i <= e1 && i > e2) {
      while (i <= e1) {
        unmount(c1[i]);
        i++;
      }
    }
    // 5. unknown sequence
    // a b [c d e] f g
    // a b [e d c h] f g
    // i = 2, e1 = 4, e2 = 5
    else {
      const s1 = i;
      const s2 = i;
      // 为新children构建 key:index 的map
      const keyToNewIndexMap = new Map<any, number>();
      for (i = s2; i <= e2; i++) {
        const nextChild = normalizeVNode(c2[i]);
        keyToNewIndexMap.set(nextChild.key, i);
      }
      // 遍历老children中需要比对的元素
      // 新节点是否需要移动
      let moved = false;
      // 新节点的最大索引
      let maxNexIndexSoFar = 0;
      // 当前已比对过的新节点数量
      let patched = 0;
      // 需要比对的新节点的长度
      const toBePatched = e2 - s2 + 1;
      // 新老节点的index的对应关系Map<newIndex, oldIndex>
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      // 构建newIndexToOldIndexMap
      for (i = s1; i < e1; i++) {
        const prevChild = c1[i];
        // 当新节点全比对完后，老chilren还有剩余，则剩余的都是需要卸载的
        if (patched >= toBePatched) {
          unmount(prevChild);
          continue;
        }
        // 新节点的索引
        let newIndex = keyToNewIndexMap.get(prevChild.key);
        // 没找到 说明需要卸载该老元素
        if (newIndex === undefined) {
          unmount(prevChild);
        }
        // 从老children中找到了key相同的节点
        else {
          // 记录新节点最大索引
          if (newIndex >= maxNexIndexSoFar) {
            maxNexIndexSoFar = newIndex;
          }
          // 新节点所在的索引值 小于 最大索引
          // 说明后面的节点跑到前面去了，需要移动
          else {
            moved = true;
          }
          newIndexToOldIndexMap[i] = newIndex;
          patch(prevChild, normalizeVNode(c2[newIndex]), container);
          patched++;
        }
      }
      // 进行节点移动和挂载
      // 最长递增序列
    }
  };

  const mountElement = (
    vnode: VNode,
    container: Element,
    anchor: Element | null = null
  ) => {
    const { props, shapeFlag, children } = vnode;
    const el = (vnode.el = hostCreateElement(vnode.type as string));
    // 创建子节点
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子元素为数组
      mountChildren(children as VNodeChildAtom[], el);
    } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子元素为文本
      hostSetElementText(el, children as string);
    }
    // 创建属性
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    hostInsert(el, container, anchor);
  };

  const mountChildren = (children: VNodeChildAtom[], container: Element) => {
    for (let i = 0; i < children.length; i++) {
      const child = normalizeVNode(children[i]);
      patch(null, child, container);
    }
  };

  const normalizeVNode = (vnode: VNode | string) => {
    if (isVNode(vnode)) {
      return vnode as VNode;
    } else {
      return createVNode(Text, null, vnode as string);
    }
  };

  // 渲染函数
  const render: RootRenderFunction = (vnode, container) => {
    if (vnode === null) {
      // 卸载
      if (container._vnode) {
        unmount(container._vnode);
      }
    } else {
      // 进行patch
      patch(container._vnode || null, vnode, container);
    }
    container._vnode = vnode;
  };

  return {
    render,
  };
};
