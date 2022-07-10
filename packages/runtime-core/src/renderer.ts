import { reactive, ReactiveEffect } from "@vue/reactivity";
import { EMPTY_OBJ, hasOwn, isArray, ShapeFlags } from "@vue/shared";
import { queueJob } from "./scheduler";
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  setupComponent,
} from "./component";
import {
  isSameVNodeType,
  VNode,
  Text,
  Fragment,
  isVNode,
  createVNode,
  VNodeChildAtom,
  normalizeVNode,
} from "./vnode";
import { initProps } from "./componentProps";

/**
 * 操作节点的方法
 */
export type RenderOptions = {
  // 设置属性
  patchProp: (el: Element, key: string, prevValue: any, nextValue: any) => void;
  // 插入
  insert: (
    el: Element | Text,
    parent: Element,
    anchor: Element | Text | null
  ) => void;
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

  const unmountChildren = (children: VNode[]) => {
    for (let i = 0; i < children.length; i++) {
      unmount(children[i]);
    }
  };

  // 核心函数 进行元素比对 => 挂载 更新
  const patch = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    anchor: Element | Text | null = null
  ) => {
    if (n1 === n2) return;
    // 如果元素类型不同，直接卸载旧元素，挂载新元素
    if (n1 && !isSameVNodeType(n1, n2)) {
      // 卸载旧元素
      unmount(n1);
      // 下面代码会判断为需要挂载新元素
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      // render(h(Text, 'lalala'), app)
      case Text:
        processText(n1, n2, container);
        break;
      // render(h(Fragment, ['lalala']), app)
      case Fragment:
        processFragment(n1, n2, container);
        break;
      default:
        // render(h('div', 'lalala'), app)
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor);
        }
        // render(h(VueComponent), app)
        else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container);
        }
    }
  };

  // 处理组件
  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: Element
  ) => {
    if (n1 === null) {
      mountComponent(n2, container);
    } else {
      // patchComponent()
    }
  };

  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    container: Element
  ) => {
    const { render, proxy } = instance;
    // 组件 挂载 & 更新
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        // 挂载
        const subTree = render && render.call(proxy);
        patch(null, subTree as VNode, container);
        instance.subTree = subTree;
        instance.isMounted = true;
      } else {
        // 更新
        const subTree = render && render.call(proxy);
        patch(instance.subTree, subTree as VNode, container);
        instance.subTree = subTree;
      }
    };
    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(update)
    );
    const update = (instance.update = () => effect.run());
    update();
  };

  // 挂载组件
  const mountComponent = (vnode: VNode, container: Element) => {
    // 1. 创建组件实例
    const instance = (vnode.component = createComponentInstance(vnode));
    // 2. 为组件实例赋值
    setupComponent(instance);
    // 3. 创建effect
    setupRenderEffect(instance, container);
  };

  // 处理文本节点
  const processText = (n1: VNode | null, n2: VNode, container: Element) => {
    if (n1 === null) {
      // 挂载
      const el = (n2.el = hostCreateText(n2.children as string));
      hostInsert(el, container, null);
    } else {
      // 更新，复用节点，直接修改文本
      const el = (n2.el = n1.el as Element);
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children as string);
      }
    }
  };

  // 处理Fragment Fragment的children只能是数组
  const processFragment = (n1: VNode | null, n2: VNode, container: Element) => {
    if (n1 === null) {
      if (!isArray(n2.children)) {
        return;
      }
      mountChildren(n2.children as VNodeChildAtom[], container);
    } else {
      patchChildren(n1, n2, container);
    }
  };

  // 处理元素节点
  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    anchor: Element | Text | null = null
  ) => {
    if (n1 === null) {
      mountElement(n2, container, anchor);
    } else {
      // 此时 n1 n2 isSameVNodeType
      patchElement(n1, n2);
    }
  };

  // 复用节点 比较元素属性、children
  const patchElement = (n1: VNode, n2: VNode) => {
    // 复用节点
    const el = (n2.el = n1.el as Element);
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    // 比较属性
    patchProps(el, oldProps, newProps);
    // 比较children
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
    const { shapeFlag: prevShapFlag } = n1;
    const { shapeFlag } = n2;
    // 新 = 文本 | 空
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN || c2 === null) {
      // 旧 = 数组 卸载数组
      if (prevShapFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[]);
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
    // 3. 从头部和尾部分别进行比较，patch相同的节点后，可能出现3中情况
    // 3.1 只剩下新节点需要挂载 common sequence + mount
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
    // 3.2 只剩下老节点需要卸载 common sequence + unmount
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
    // 3.3 其他情况 unknown sequence
    // a b [c d e i] f g
    // a b [e c d i h] f g
    // i = 2, e1 = 5, e2 = 6
    else {
      const s1 = i;
      const s2 = i;
      // 3.3.1 为新children构建映射表 Map1<key:index>
      // {e => 2, c => 3, d => 4, i => 5, h => 6}
      const keyToNewIndexMap = new Map<any, number>();
      for (i = s2; i <= e2; i++) {
        const nextChild = normalizeVNode(c2[i]);
        keyToNewIndexMap.set(nextChild.key, i);
      }
      // 新节点是否需要移动
      let moved = false;
      // 新节点的最大索引
      let maxNexIndexSoFar = 0;
      // 当前已比对过的新节点数量
      let patched = 0;
      // 需要比对的新节点的长度
      const toBePatched = e2 - s2 + 1;
      // 3.3.2 构建新老节点的index的映射表 Map2<newIndex, oldIndex>
      // 能根据oldKey从映射表Map1中找到值，说明oldKey节点可以复用
      // [0, 0, 0, 0, 0] => [5, 3, 4, 6, 0]
      const newIndexToOldIndexMap = new Array(toBePatched);
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
      // 构建newIndexToOldIndexMap
      for (i = s1; i <= e1; i++) {
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
          newIndexToOldIndexMap[newIndex - s2] = i + 1;
          patch(prevChild, normalizeVNode(c2[newIndex]), container);
          patched++;
        }
      }
      // 进行节点移动和挂载
      // 获取newIndexToOldIndexMap的最长递增序列 [5, 3, 4, 6, 0] => [1, 2, 3] => c d i 不需要移动
      const sequence = getSequence(newIndexToOldIndexMap);
      let j = sequence.length - 1;
      // 从后往前插入
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = i + s2;
        const nextChild = c2[nextIndex];
        const anchor =
          nextIndex + 1 < l2 ? normalizeVNode(c2[nextIndex + 1]).el : null;
        // 挂载新节点
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild as VNode, container, anchor);
        }
        // 需要移动
        else if (moved) {
          if (i !== sequence[j]) {
            // 需要移动
            hostInsert((nextChild as VNode).el as Element, container, anchor);
          } else {
            // 不需要移动
            j--;
          }
        }
      }
    }
  };

  // 创建元素节点
  const mountElement = (
    vnode: VNode,
    container: Element,
    anchor: Element | Text | null = null
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
    // 插入
    hostInsert(el, container, anchor);
  };

  // 挂载子节点（数组）
  const mountChildren = (children: VNodeChildAtom[], container: Element) => {
    for (let i = 0; i < children.length; i++) {
      // 子节点可能是 VNode | string，统一包装成VNode
      const child = normalizeVNode(children[i]);
      patch(null, child, container);
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
      // 挂载和更新
      patch(container._vnode || null, vnode, container);
    }
    container._vnode = vnode;
  };

  return {
    render,
  };
};

// 3 2 8 9 5 6 11 12 4
// 1. 当前项比索引结果集的最后一项大，则直接push进索引结果集
// 2. 当前项比索引结果集的最后一项小，则通过二分查找在索引结果集中找到第一个比当前项大的项，替换成当前项
// 3. 从索引结果集中的最后一项开始往前溯源
function getSequence(arr: number[]) {
  const len = arr.length;
  const p = new Array(len).fill(-1); // 用于追溯
  const indexResult = [0]; // 索引结果集，默认为第一个，存放的是arr中数据的索引值
  let lastIndex = 0; // 索引结果集中的最后一项
  for (let i = 0; i < len; i++) {
    const arrI = arr[i];
    if (arrI !== 0) {
      lastIndex = indexResult[indexResult.length - 1];
      const lastI = arr[lastIndex];
      // 1. 当前项比索引结果集的最后一项大，则直接push进结果
      if (lastI < arrI) {
        // push前，需要记录当前push的项的前一个索引值
        p[i] = lastIndex;
        indexResult.push(i);
      }
      // 2. 当前项比索引结果集的最后一项小，则通过二分查找在索引结果集中找到第一个比当前项大的项，替换成当前项
      else {
        let start = 0;
        let end = indexResult.length - 1;
        while (start < end) {
          const mid = (start + end) >> 1;
          const cur = arr[indexResult[mid]];
          if (cur > arrI) {
            end = mid;
          } else {
            start = mid + 1;
          }
        }
        // 替换前，需要记录当前替换的项的前一个索引值
        indexResult[start] = i;
        if (start > 0) {
          p[i] = indexResult[start - 1];
        }
      }
    }
  }
  // p记录了每一项进入结果集时，它的前一项的值（索引值） p [-1, -1, 1, 2, 1, 4, 5, 6, 1]
  // 开始溯源 indexResult [1, 8, 5, 6, 7]
  let i = indexResult.length - 1; // 4
  // 从尾巴开始，因为最后一项肯定是最大的
  let last = indexResult[i]; // 7
  // p[7] = 6
  // p[6] = 5
  // p[5] = 4
  // p[4] = 1
  while (i > 0) {
    indexResult[i] = last;
    last = p[last];
    i--;
  }
  return indexResult;
}

// 3 [0] [-1]
// 2 [1] [-1, -1]
// 2 8 [1, 2] [-1, -1, 1]
// 2 8 9 [1, 2, 3] [-1, -1, 1, 2]
// 2 5 9 [1, 4, 3] [-1, -1, 1, 2, 1]
// 2 5 6 [1, 4, 5] [-1, -1, 1, 2, 1, 4]
// 2 5 6 11 [1, 4, 5, 6] [-1, -1, 1, 2, 1, 4, 5]
// 2 5 6 11 12 [1, 4, 5, 6, 7] [-1, -1, 1, 2, 1, 4, 5, 6]
// 2 4 6 11 12 [1, 8, 5, 6, 7] [-1, -1, 1, 2, 1, 4, 5, 6, 1]
// console.log(getSequence([3, 2, 8, 9, 5, 6, 11, 12, 4]));
