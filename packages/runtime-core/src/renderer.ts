import { ReactiveEffect } from "@vue/reactivity";
import {
  EMPTY_OBJ,
  invokeArrayFns,
  isArray,
  log,
  PatchFlags,
  ShapeFlags,
} from "@vue/shared";
import {
  flushPreFlushCbs,
  invalidateJob,
  queueJob,
  SchedulerJob,
} from "./scheduler";
import {
  Component,
  ComponentInternalInstance,
  createComponentInstance,
  renderComponentRoot,
  setupComponent,
} from "./component";
import {
  isSameVNodeType,
  VNode,
  Text,
  Fragment,
  VNodeChildAtom,
  normalizeVNode,
} from "./vnode";
import { hasPropsChanged, updateProps } from "./componentProps";
import { invokeDirectiveHook } from "./directives";

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
    anchor: Element | Text | null = null,
    optimized: boolean = !!n2.dynamicChildren,
    logHide: boolean = false
  ) => {
    log(logHide, "\n开始执行patch...");
    log(logHide, "老节点为：", n1, "，新节点为：", n2);
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
        processFragment(n1, n2, container, optimized);
        break;
      default:
        // render(h('div', 'lalala'), app)
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(n1, n2, container, anchor, optimized);
        }
        // render(h(VueComponent), app)
        else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          processComponent(n1, n2, container, optimized);
        }
    }
  };

  // 处理组件
  const processComponent = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    optimized: boolean
  ) => {
    if (n1 === null) {
      mountComponent(n2, container, optimized);
    } else {
      // 组件更新更新的是props
      updateComponent(n1, n2, optimized);
    }
  };

  const shouldUpdateComponent = (n1: VNode, n2: VNode) => {
    const { props: prevProps, children: prevChildren } = n1;
    const { props: nextProps, children: nextChildren, dirs: nextDirs } = n2;
    // 有指令需要强制更新
    if (nextDirs) {
      return true;
    }
    // 有插槽需要更新
    if (prevChildren || nextChildren) return true;
    if (prevProps === nextProps) return false;
    if (prevProps === null) return !!nextProps;
    return hasPropsChanged(prevProps, nextProps || {});
  };

  // 更新组件，在组件的props发生改变时才会触发（注：如果属性是个对象，但只有对象里的某个属性改变时，不会触发这里，而是直接执行componentUpdateFn）
  const updateComponent = (
    n1: VNode,
    n2: VNode,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    log(logHide, "\n开始执行updateComponent更新组件...");
    // 对于元素复用的是dom节点，组件复用的是实例
    const instance = (n2.component = n1.component) as ComponentInternalInstance;
    // 判断组件是否需要更新
    if (shouldUpdateComponent(n1, n2)) {
      // 将新的vnode放到实例的next属性
      instance.next = n2;
      // 在更新父组件的时候可能会一起更新子组件，因此更新完父组件后，如果子组件也在queue里，则不需要执行
      invalidateJob(instance.update!);
      // 需要更新，直接调用更新方法
      instance.update && instance.update();
    } else {
      n2.el = n1.el;
      instance.vnode = n2;
    }
  };

  const updateComponentPreRender = (
    instance: ComponentInternalInstance,
    nextVNode: VNode
  ) => {
    instance.vnode = nextVNode;
    instance.next = null;
    // 更新组件属性
    updateProps(nextVNode.props, instance.props as Record<string, any>);
    // 更新组件插槽
    // 组件属性更新可能会触发pre-flush watchers
    flushPreFlushCbs();
  };

  const setupRenderEffect = (
    instance: ComponentInternalInstance,
    initialVNode: VNode,
    container: Element,
    logHide: boolean = false
  ) => {
    // 组件挂载&更新，组件内部state改变时，会直接进来这里
    const componentUpdateFn = () => {
      // 挂载
      if (!instance.isMounted) {
        const { bm, m, vnode } = instance;
        const componentName = (vnode.type as Component).name;
        log(logHide, "开始执行componentUpdateFn挂载组件", componentName);
        // 触发onBeforeMount注册的hooks
        if (bm) {
          invokeArrayFns(bm);
        }
        log(logHide, "开始执行render并收集依赖...");
        const subTree = (instance.subTree = renderComponentRoot(instance));
        log(logHide, "render执行完毕，获取要挂载的虚拟节点，开始进行patch...");
        patch(null, subTree as VNode, container);
        initialVNode.el = subTree.el;
        instance.isMounted = true;
        // 触发onMounted注册的hooks
        if (m) {
          invokeArrayFns(m);
        }
        log(logHide, componentName, "组件完成挂载", instance);
      }
      // 更新
      else {
        let { next, bu, u, vnode, render, proxy } = instance;
        const componentName = (vnode.type as Component).name;
        if (next) {
          log(
            logHide,
            componentName,
            "组件接收的props改变，开始执行componentUpdateFn更新组件..."
          );
          // 更新组件的属性
          updateComponentPreRender(instance, next);
        } else {
          log(
            logHide,
            componentName,
            "组件内部state改变，或则props中某个对象的属性改变，开始执行componentUpdateFn更新组件..."
          );
          next = vnode;
        }
        // 触发onBeforeUpdate注册的hooks
        if (bu) {
          invokeArrayFns(bu);
        }
        log(logHide, "执行render并收集依赖...");
        const nextTree = renderComponentRoot(instance);
        const prevTree = instance.subTree;
        instance.subTree = nextTree;
        log(logHide, "render执行完毕，获取要更新的虚拟节点，开始进行patch...");
        patch(prevTree, nextTree as VNode, container);
        next.el = nextTree.el;
        // 触发onUpdated注册的hooks
        if (u) {
          invokeArrayFns(u);
        }
        log(logHide, componentName, "组件完成更新", instance);
      }
    };
    log(
      logHide,
      "开始执行setupRenderEffect为组件创建副作用，并执行update对组件进行挂载"
    );
    // 触发effect会执行调度函数
    const effect = new ReactiveEffect(componentUpdateFn, () =>
      queueJob(update)
    );
    const update: SchedulerJob = (instance.update = () => effect.run());
    update.id = instance.uid;
    // 先执行一次componentUpdateFn，会进行依赖收集
    update();
  };

  // 挂载组件
  const mountComponent = (
    vnode: VNode,
    container: Element,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    const componentName = (vnode.type as Component).name;
    log(logHide, "\n开始执行mountComponent准备挂载组件", componentName, "...");
    // 1. 创建组件实例
    const instance = (vnode.component = createComponentInstance(vnode));
    log(logHide, "开始执行createComponentInstance初始化组件实例");
    // 2. 为组件实例赋值，调用setup
    setupComponent(instance);
    // 3. 创建effect
    setupRenderEffect(instance, vnode, container);
  };

  // 处理文本节点
  const processText = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    logHide: boolean = false
  ) => {
    log(logHide, "\n开始执行processText处理文本...");
    if (n1 === null) {
      // 挂载
      const el = (n2.el = hostCreateText(n2.children as string));
      hostInsert(el, container, null);
      log(logHide, "文本创建完成", el);
    } else {
      // 更新，复用节点，直接修改文本
      const el = (n2.el = n1.el as Element);
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children as string);
        log(logHide, "文本更新完成", el);
      }
    }
  };

  // 处理Fragment Fragment的children只能是数组
  const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    log(logHide, "\n开始执行processFragment处理Fragment...");
    if (n1 === null) {
      if (!isArray(n2.children)) {
        return;
      }
      mountChildren(n2.children as VNodeChildAtom[], container, optimized);
    } else {
      patchChildren(n1, n2, container, optimized);
    }
  };

  // 处理元素节点
  const processElement = (
    n1: VNode | null,
    n2: VNode,
    container: Element,
    anchor: Element | Text | null = null,
    optimized: boolean
  ) => {
    if (n1 === null) {
      mountElement(n2, container, anchor, optimized);
    } else {
      // 此时 n1 n2 isSameVNodeType
      patchElement(n1, n2, optimized);
    }
  };

  // 复用节点 比较元素属性、children
  const patchElement = (
    n1: VNode,
    n2: VNode,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    log(logHide, "开始执行patchElement更新元素...");
    log(logHide, "老元素：", n1, "新元素：", n2);
    // 复用节点
    const el = (n2.el = n1.el as Element);
    const { dynamicChildren, dynamicProps, patchFlag, dirs } = n2;
    const oldProps = n1.props || EMPTY_OBJ;
    const newProps = n2.props || EMPTY_OBJ;
    // 挂载beforeUpdate指令
    if (dirs) {
      invokeDirectiveHook(n2, n1, "beforeUpdate");
    }
    // 比较children
    if (dynamicChildren) {
      // 有dynamicChildren会进行靶向更新，但元素的子节点只有一个文本节点时，不会进这里，会走下面的单独更新
      patchBlockChildren(n1.dynamicChildren!, dynamicChildren, el);
    } else if (!optimized) {
      // 全量更新
      patchChildren(n1, n2, el, optimized);
    }
    if (patchFlag > 0) {
      // 优化props
      if (patchFlag & PatchFlags.FULL_PROPS) {
        patchProps(el, oldProps, newProps);
      } else {
        if (patchFlag & PatchFlags.CLASS) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, "class", null, newProps.class);
          }
        }
        if (patchFlag & PatchFlags.STYLE) {
          hostPatchProp(el, "style", oldProps.style, newProps.style);
        }
        if (patchFlag & PatchFlags.PROPS) {
          // 到了这个分支，dynamicProps必定有值
          for (let i = 0; i < dynamicProps!.length; i++) {
            const key = dynamicProps![i];
            const prev = oldProps[key];
            const next = newProps[key];
            if (prev !== next) {
              hostPatchProp(el, key, prev, next);
            }
          }
        }
      }
      // 只有单个动态文本节点时，单独优化
      if (patchFlag & PatchFlags.TEXT) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children as string);
        }
      }
    } else if (!optimized) {
      // 全量比较属性
      patchProps(el, oldProps, newProps);
    }
    // 挂载updated指令
    if (dirs) {
      invokeDirectiveHook(n2, n1, "updated");
    }
    log(logHide, "元素更新完成", el);
  };

  const patchProps = (
    el: Element,
    oldProps: any,
    newProps: any,
    logHide: boolean = false
  ) => {
    if (newProps !== oldProps) {
      log(
        logHide,
        "开始比较元素的属性，老属性：",
        oldProps,
        "，新属性：",
        newProps
      );
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

  const patchBlockChildren = (
    oldChildren: VNode[],
    newChildren: VNode[],
    container: Element
  ) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldNode = oldChildren[i];
      const newNode = newChildren[i];
      patch(oldNode, newNode, container, null, true);
    }
  };

  const patchChildren = (
    n1: VNode,
    n2: VNode,
    container: Element,
    optimized: boolean,
    logHide: boolean = false
  ) => {
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
    log(logHide, "开始执行patchChildren比较子节点...");
    log(logHide, "老子节点：", c1, "新子节点：：", c2);
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
        mountChildren(c2 as VNodeChildAtom[], container, optimized);
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
      const n2 = (c2[i] = normalizeVNode(c2[i]));
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
      const n2 = (c2[i] = normalizeVNode(c2[e2]));
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
        const n2 = (c2[i] = normalizeVNode(c2[e2]));
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
        const nextChild = (c2[i] = normalizeVNode(c2[i]));
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
          patch(prevChild, c2[newIndex] as VNode, container);
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
        const nextChild = c2[nextIndex] as VNode;
        const anchor =
          nextIndex + 1 < l2 ? (c2[nextIndex + 1] as VNode).el : null;
        // 挂载新节点
        if (newIndexToOldIndexMap[i] === 0) {
          patch(null, nextChild, container, anchor);
        }
        // 需要移动
        else if (moved) {
          if (i !== sequence[j]) {
            // 需要移动
            hostInsert(nextChild.el as Element, container, anchor);
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
    anchor: Element | Text | null = null,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    log(logHide, "开始执行mountElement挂载元素：", vnode);
    const { props, shapeFlag, children, dirs } = vnode;
    const el = (vnode.el = hostCreateElement(vnode.type as string));
    // 创建子节点
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 子元素为数组
      mountChildren(children as VNodeChildAtom[], el, optimized);
    } else if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 子元素为文本
      hostSetElementText(el, children as string);
    }
    if (dirs) {
      invokeDirectiveHook(vnode, null, "created");
    }
    // 创建属性
    if (props) {
      for (let key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    // 挂载beforeMount指令
    if (dirs) {
      invokeDirectiveHook(vnode, null, "beforeMount");
    }
    // 插入
    hostInsert(el, container, anchor);
    // 挂载mounted指令
    if (dirs) {
      invokeDirectiveHook(vnode, null, "mounted");
    }
    log(logHide, "元素挂载完成", el);
  };

  // 挂载子节点（数组）
  const mountChildren = (
    children: VNodeChildAtom[],
    container: Element,
    optimized: boolean,
    logHide: boolean = false
  ) => {
    log(logHide, "开始执行mountChildren循环调用patch挂载子节点...", children);
    for (let i = 0; i < children.length; i++) {
      // 子节点可能是 VNode | string，统一包装成VNode
      const child = (children[i] = normalizeVNode(children[i]));
      patch(null, child, container, null, optimized);
    }
  };

  // 渲染函数
  const render: RootRenderFunction = (
    vnode,
    container,
    logHide: boolean = false
  ) => {
    log(logHide, "开始执行渲染器的render函数...");
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
// log(logHide, getSequence([3, 2, 8, 9, 5, 6, 11, 12, 4]));
