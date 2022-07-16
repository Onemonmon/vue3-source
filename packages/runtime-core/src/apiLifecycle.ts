import {
  currentInstance,
  LifecycleHooks,
  setCurrentInstance,
  unsetCurrentInstance,
} from "./component";

// 使用工厂模式创建生命周期的hook
// hook需要在对应的实例上运行
const createHook =
  (type: LifecycleHooks, target = currentInstance) =>
  (hook: Function) =>
    injectHook(type, hook, target);

// 包装hooks
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

export const onMounted = createHook(LifecycleHooks.MOUNTED);
export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT);
export const onUpdated = createHook(LifecycleHooks.UPDATED);
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE);
