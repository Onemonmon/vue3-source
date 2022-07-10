import { reactive } from "@vue/reactivity";
import { hasOwn } from "@vue/shared";
import { initProps } from "./componentProps";
import { VNode, VNodeChildAtom } from "./vnode";

export type Component = {
  name?: string;
  props?: Record<string, any>;
  data?: () => Record<string, any>;
  render?: () => VNodeChildAtom | VNodeChildAtom[];
};

export type ComponentInternalInstance = {
  data: Record<string, any> | null; // 响应式数据
  vnode: VNode; // 组件对应的虚拟节点
  subTree: VNode | null; // 渲染的组件内容对应的虚拟节点
  isMounted: boolean; // 是否已经挂载
  update: Function | null; // 强制更新组件内容的方法
  propsOptions: Record<string, any> | null;
  props: Record<string, any> | null;
  attrs: Record<string, any> | null;
  proxy: any | null; // 代理对象，代理data、props、attrs
  render: Function | null;
};

// 创建组件实例
export const createComponentInstance = (vnode: VNode) => {
  const instance: ComponentInternalInstance = {
    data: null,
    vnode,
    subTree: null,
    isMounted: false,
    update: null,
    propsOptions: (vnode.type as Component).props || {},
    props: null,
    attrs: null,
    proxy: null,
    render: null,
  };
  return instance;
};

export const publicPropertiesMap: Record<string, any> = {
  $attrs: (i: ComponentInternalInstance) => i.attrs,
};

const PublicInstanceProxyHandlers: ProxyHandler<any> = {
  get(target, key) {
    const { data, props } = target;
    const _key = key as string;
    if (data && hasOwn(data, _key)) {
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
    const { data, props, attrs } = target;
    const _key = key as string;
    if (data && hasOwn(data, _key)) {
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
export const setupComponent = (instance: ComponentInternalInstance) => {
  const { props, type } = instance.vnode;
  initProps(instance, props);
  // 为组件实例创建代理对象
  instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);
  // 将data变成响应式
  const { data = () => ({}), render = () => {} } = type as Component;
  instance.data = reactive(data.call(instance.proxy));
  instance.render = render;
};
