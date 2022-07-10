export let activeEffect: ReactiveEffect | undefined = undefined;

/**
 * cleanupEffect 清楚effect收集的依赖
 */
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  deps.forEach((dep) => {
    dep.delete(effect);
  });
  deps.length = 0;
}

/**
 * 创建一个响应式的effect,用于扩展fn,使得当依赖的数据改变时,会重新执行
 */
export class ReactiveEffect {
  public active = true;
  public parent: ReactiveEffect | undefined = undefined; // 父级effect,解决effect嵌套
  public deps: Set<ReactiveEffect>[] = []; // 记录依赖的属性
  constructor(public fn: Function, public scheduler?: Function) {}
  run() {
    // 非激活状态,不需要进行依赖收集
    if (!this.active) {
      return this.fn();
    }
    // 解决多个effect修改同一个属性导致的嵌套问题
    let parent = activeEffect;
    while (parent) {
      // 如果外层的effect中已经含有当前的effect,则当前effect不执行
      if (parent === this) {
        return;
      }
      parent = parent.parent;
    }
    // 否则进行依赖收集,将activeEffect与依赖的属性关联起来
    try {
      // 保存父级effect
      this.parent = activeEffect;
      // 暴露全局的当前被激活的effect
      activeEffect = this;
      // 需要清理之前收集的依赖
      cleanupEffect(this);
      return this.fn();
    } finally {
      // 返回父级 effect
      activeEffect = this.parent;
      this.parent = undefined;
    }
  }
  stop() {
    if (this.active) {
      this.active = false;
      // 需要清理之前收集的依赖
      cleanupEffect(this);
    }
  }
}

/**
 * effect
 * @param fn 执行的副作用,当状态改变时会重新执行
 * @param options 可以配置调度器
 */
export function effect(fn: Function, options: { scheduler?: Function } = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler);
  // 默认先执行一次
  _effect.run();
  const runner: any = () => _effect.run();
  runner.effect = _effect;
  return runner;
}

/**
 * Q:
 *   当存在effect嵌套时会出现问题!
 *   effect(() => {
 *     state.name        // name => e1, activeEffect = e1
 *     effect(() => {
 *       state.age       // age => e2, activeEffect = e2
 *     })
 *     state.other       // other => e1, activeEffect = undefined ×
 *   })
 * A:
 *   老版本使用栈stack存放activeEffect,每次获取栈顶作为当前activeEffect
 *   activeEffect = this => stack.push(this)
 *   activeEffect = undefined => stack.pop()
 *
 *   新版本使用类似树结构存放activeEffect,增加parent属性指向父effect
 */

const targetMap: WeakMap<
  Record<string, any>,
  Map<string | symbol, Set<ReactiveEffect>>
> = new WeakMap();
/**
 * track 收集依赖的属性
 * @param target 属性所在的响应式对象
 * @param type get/set
 * @param key 属性
 */
export function track(target: Record<string, any>, key: string | symbol) {
  // 不在effect中被访问的属性不收集
  if (!activeEffect) {
    return;
  }
  // 如何保存activeEffect与属性的关联关系?
  // WeakMap = { target: Map({ key: Set([effect]) }) }
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()));
  }
  let dep = depsMap.get(key);
  if (!dep) {
    depsMap.set(key, (dep = new Set()));
  }
  trackEffect(dep);
}

export function trackEffect(dep: Set<ReactiveEffect>) {
  if (!activeEffect) {
    return;
  }
  // 一个effect里用了多次同一个属性,手动去重(性能)
  const shouldTrack = !dep.has(activeEffect);
  if (shouldTrack) {
    // 属性记录关联的effect
    dep.add(activeEffect);
    // effect记录依赖的属性 => 清理effect
    activeEffect.deps.push(dep);
  }
}

/**
 * trigger 依赖的属性值更新,触发对应effect
 * @param target 属性所在的响应式对象
 * @param type get/set
 * @param key 属性
 * @param value 值
 * @param oldValue 旧值
 */
export function trigger(target: Record<string, any>, key: string | symbol) {
  // 从 targetMap 中根据 target 找到对应的 depsMap
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    // 当前的 target 没有再模板中使用
    return;
  }
  const effects = depsMap.get(key);
  effects && triggerEffect(effects);
}

export function triggerEffect(effects: Set<ReactiveEffect>) {
  [...effects].forEach((effect) => {
    // 当 effect 中存在修改依赖的属性的代码时,会无限调用 effect,需要屏蔽后续的 effect
    if (effect !== activeEffect) {
      if (effect.scheduler) {
        // 用户传入自定义调度器
        effect.scheduler();
      } else {
        effect.run();
      }
    }
  });
}
