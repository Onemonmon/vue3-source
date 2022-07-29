const queue: Function[] = [];
let isFlushing = false;
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

// 不同组件的更新任务 批处理
export const queueFlush = () => {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvePromise.then(flushJob);
  }
};

export const flushJob = () => {
  isFlushing = true;
  // flushPreFlushCbs
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
  }
};
