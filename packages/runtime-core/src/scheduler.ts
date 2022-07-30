// 组件更新任务队列
const queue: Function[] = [];
// 前置更新相关
const pendingPreFlushCbs: Function[] = [];
let activePreFlushCbs: Function[] | null = null;

// 当前是否有正在执行的任务
let isFlushing = false;
// 当前是否有正在等待执行的任务
let isFlushPending = false;
let currentFlushPromise = null;
const resolvePromise = Promise.resolve();

export const queueJob = (job: Function) => {
  // 同一个组件的更新任务会被过滤
  if (!queue.includes(job)) {
    queue.push(job);
  }
  queueFlush();
};

export const queueCb = (cb: Function, pendingQueue: Function[]) => {
  if (!pendingQueue.includes(cb)) {
    pendingQueue.push(cb);
  }
  queueFlush();
};

export const queuePreFlushCb = (cb: Function) => {
  queueCb(cb, pendingPreFlushCbs);
};

// 不同组件的更新任务 批处理
export const queueFlush = () => {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvePromise.then(flushJobs);
  }
};

export const flushPreFlushCbs = () => {
  if (pendingPreFlushCbs.length) {
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)];
    pendingPreFlushCbs.length = 0;
    for (let i = 0; i < activePreFlushCbs.length; i++) {
      activePreFlushCbs[i]();
    }
    activePreFlushCbs = null;
    flushPreFlushCbs();
  }
};

export const flushJobs = () => {
  isFlushing = true;
  isFlushPending = false;
  // 先执行前置更新
  flushPreFlushCbs();
  // queue
  try {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      job();
    }
  } finally {
    queue.length = 0;
    // flushPostFlushCbs
    isFlushing = false;
    currentFlushPromise = null;
    // 有些任务可能会在更新期间进入队列，因此需要递归执行
    if (queue.length || pendingPreFlushCbs.length) {
      flushJobs();
    }
  }
};
