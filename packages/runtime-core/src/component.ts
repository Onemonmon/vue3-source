import { proxyRef, reactive } from "@vue/reactivity";
import { hasOwn, isFunction, isObject, log } from "@vue/shared";
import { SchedulerJob } from "vue";
import { emit } from "./componentEmits";
import { initProps } from "./componentProps";
import { initSlots, RawSlots } from "./componentSlots";
import { VNode, VNodeChildAtom } from "./vnode";

type InternalRenderFunction = () => VNodeChildAtom | VNodeChildAtom[];

export type Component = {
  name?: string;
  props?: Record<string, any>;
  data?: () => Record<string, any>;
  render?: InternalRenderFunction;
  setup?: (
    props: Record<string, any>,
    setupContext?: SetupContext
  ) => object | InternalRenderFunction;
};

export const enum LifecycleHooks {
  BEFORE_MOUNT = "bm",
  MOUNTED = "m",
  BEFORE_UPDATE = "bu",
  UPDATED = "u",
}

export type EmitFn = (eventName: string, ...args: any) => any;

export type SetupContext = {
  emit: EmitFn;
  slots: RawSlots;
};

export type LifecycleHook<TFn = Function> = TFn[];

export type ComponentInternalInstance = {
  uid: number; // 用于更新的优化
  data: Record<string, any> | null; // 响应式数据
  setupState: Record<string, any> | null; // setup响应式数据
  vnode: VNode; // 组件对应的虚拟节点
  type: Component;
  next: VNode | null; // 组件更新后的虚拟节点
  subTree: VNode | null; // 渲染的组件内容对应的虚拟节点
  isMounted: boolean; // 是否已经挂载
  update: SchedulerJob | null; // 强制更新组件内容的方法
  propsOptions: Record<string, any> | null;
  props: Record<string, any> | null;
  attrs: Record<string, any> | null;
  slots: RawSlots | null;
  proxy: any | null; // 代理对象，代理data、props、attrs
  render: Function | null;
  [LifecycleHooks.BEFORE_MOUNT]: LifecycleHook | null;
  [LifecycleHooks.BEFORE_UPDATE]: LifecycleHook | null;
  [LifecycleHooks.MOUNTED]: LifecycleHook | null;
  [LifecycleHooks.UPDATED]: LifecycleHook | null;
  emit: EmitFn | null; // 触发组件自定义事件
};

export let currentInstance: ComponentInternalInstance | null = null;

export const setCurrentInstance = (instance: ComponentInternalInstance) =>
  (currentInstance = instance);

export const unsetCurrentInstance = () => (currentInstance = null);

export const getCurrentInstance = () => currentInstance;

let uid = 0;

// 创建组件实例
export const createComponentInstance = (vnode: VNode) => {
  const instance: ComponentInternalInstance = {
    uid: uid++,
    data: null,
    setupState: null,
    vnode,
    type: vnode.type as Component,
    next: null,
    subTree: null,
    isMounted: false,
    update: null,
    propsOptions: (vnode.type as Component).props || {},
    props: null,
    attrs: null,
    slots: null,
    proxy: null,
    render: null,
    bm: null,
    bu: null,
    m: null,
    u: null,
    emit: null,
  };
  instance.emit = emit.bind(null, instance);
  return instance;
};

export const publicPropertiesMap: Record<string, any> = {
  $attrs: (i: ComponentInternalInstance) => i.attrs,
  $slots: (i: ComponentInternalInstance) => i.slots,
};

const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(target, key) {
    const { data, props, setupState } = target;
    const _key = key as string;
    if (setupState && hasOwn(setupState, _key)) {
      return setupState[key];
    } else if (data && hasOwn(data, _key)) {
      return data[_key];
    } else if (props && hasOwn(props, _key)) {
      return props[_key];
    }
    // 获取 $attrs $slots ...
    const getter = publicPropertiesMap[_key];
    if (getter) {
      return getter(target);
    }
  },
  set(target, key, value) {
    const { data, props, setupState } = target;
    const _key = key as string;
    if (setupState && hasOwn(setupState, _key)) {
      setupState[_key] = value;
    } else if (data && hasOwn(data, _key)) {
      data[_key] = value;
    } else if (props && hasOwn(props, _key)) {
      // 设置props属性xx的时候会警报 this.xx = xx
      // 但是通过instance.props.xx还是可以修改
      console.warn(`Attempting to mutate prop "${_key}". Props are readonly.`);
      return false;
    }
    return true;
  },
};

// 为组件实例赋值
export const setupComponent = (
  instance: ComponentInternalInstance,
  logHide: boolean = false
) => {
  log(logHide, "开始执行setupComponent构造组件实例的内容");
  const { props, type, children } = instance.vnode;
  log(logHide, "开始初始化组件属性：", props);
  initProps(instance, props);
  log(logHide, "开始初始化组件插槽：", children);
  initSlots(instance, children);
  // 为组件实例创建代理对象，最终编译后都是通过_cxt.xxx获取数据，然后代理到具体的props或者state
  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);
  log(logHide, "为组件实例创建代理对象：", instance.proxy);
  // 将data变成响应式
  const { data = () => ({}), setup } = type as Component;
  instance.data = reactive(data.call(instance.proxy));
  if (setup) {
    // 如果setup中用到了后面的参数，则创建setup上下文setupContext
    const setupContext =
      setup.length > 1 ? createSetupContext(instance) : undefined;
    // 设置当前实例 供生命周期使用
    setCurrentInstance(instance);
    log(logHide, "开始执行setup", currentInstance);
    // 执行setup
    const setupResult = setup(
      instance.props as Record<string, any>,
      setupContext
    );
    unsetCurrentInstance();
    handleSetupResult(instance, setupResult);
  }
  finishComponentSetup(instance);
  log(logHide, "组件实例构造完成：", instance);
};

export const handleSetupResult = (
  instance: ComponentInternalInstance,
  setupResult: unknown,
  logHide: boolean = false
) => {
  if (isFunction(setupResult)) {
    log(logHide, "setup返回的是render函数，直接将其设为组件实例的render函数");
    instance.render = setupResult as InternalRenderFunction;
  } else if (isObject(setupResult)) {
    log(logHide, "setup返回的是state数据，将数据进行脱ref处理");
    instance.setupState = proxyRef(setupResult as object);
  }
};

export const finishComponentSetup = (instance: ComponentInternalInstance) => {
  if (instance.render === null) {
    const Component = instance.type;
    if (Component.render) {
      instance.render = Component.render;
    } else {
      console.warn(`Component is missing render function.`);
    }
  }
};

export const createSetupContext = (
  instance: ComponentInternalInstance
): SetupContext => {
  return {
    emit: instance.emit as EmitFn,
    slots: instance.slots || {},
  };
};

export const renderComponentRoot = (instance: ComponentInternalInstance) => {
  const { proxy, render, vnode } = instance;
  const result = render!.call(proxy, proxy);
  // 组件的指令绑定在subTree的根节点
  if (vnode.dirs) {
    result.dirs = result.dirs ? result.dirs.concat(vnode.dirs) : vnode.dirs;
  }
  return result;
};
