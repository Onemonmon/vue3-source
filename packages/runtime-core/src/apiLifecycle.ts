import {
  ComponentInternalInstance,
  currentInstance,
  LifecycleHooks,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";

// 使用工厂模式创建生命周期函数，生命周期函数在setup上运行时，会绑定currentInstance
const createHook =
  (type: LifecycleHooks) =>
  (hook: Function, target = currentInstance) =>
    injectHook(type, hook, target);

// 包装hook与currentInstance，使得hook在触发时使用的是正确的组件实例
const injectHook = (
  type: LifecycleHooks,
  hook: Function & { __weh?: Function },
  target = currentInstance
) => {
  if (target) {
    // 声明周期只有在setup中才能运行
    // 每个类型的生命周期hook会被保存在同一个数组中，一起触发
    const hooks = target[type] || (target[type] = []);
    const wrappedHook =
      hook.__weh ||
      (hook.__weh = () => {
        // 利用闭包将其与当前实例关联起来
        setCurrentInstance(target);
        hook();
        unsetCurrentInstance();
      });
    hooks.push(wrappedHook);
    return wrappedHook;
  }
};
// 这些生命周期函数在一开始就已经创建好了，每当在组件内调用，就会与当前组件实例绑定
export const onMounted = createHook(LifecycleHooks.MOUNTED);
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT);
export const onUpdated = createHook(LifecycleHooks.UPDATED);
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE);
