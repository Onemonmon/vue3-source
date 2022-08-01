export interface SchedulerJob extends Function {
  id?: number;
}

// 组件更新任务队列
const queue: SchedulerJob[] = [];
// 当前执行的更新任务
let flushIndex = 0;

// 前置更新相关
const pendingPreFlushCbs: SchedulerJob[] = [];
let activePreFlushCbs: SchedulerJob[] | null = null;

// 当前是否有正在执行的任务
let isFlushing = false;
// 当前是否有正在等待执行的任务
let isFlushPending = false;
let currentFlushPromise = null;
const resolvePromise = Promise.resolve();

export const invalidateJob = (job: SchedulerJob) => {
  // 当前更新任务在queue中的索引
  const i = queue.indexOf(job);
  // 如果queue中存在子组件非props改变的更新任务，且此时父组件也有对应更新任务，则删除子组件的更新任务避免重复更新
  if (i > flushIndex) {
    queue.splice(i, 1);
  }
};

export const queueJob = (job: SchedulerJob) => {
  // 同一个组件的更新任务会被过滤
  if (!queue.includes(job)) {
    queue.push(job);
  }
  queueFlush();
};

export const queueCb = (cb: SchedulerJob, pendingQueue: SchedulerJob[]) => {
  if (!pendingQueue.includes(cb)) {
    pendingQueue.push(cb);
  }
  queueFlush();
};

export const queuePreFlushCb = (cb: SchedulerJob) => {
  queueCb(cb, pendingPreFlushCbs);
};

// 组件的更新任务 批处理
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

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id;

export const flushJobs = () => {
  isFlushing = true;
  isFlushPending = false;
  // 先执行前置更新
  flushPreFlushCbs();
  // 更新前对更新队列重新排序（根据job.id从小到大排序，id越小优先级越高）
  // 1. 确保父组件的更新优先于子组件
  // 2. 父组件更新期间，如果子组件被卸载了，则可以直接跳过该子组件的更新
  queue.sort((a, b) => getId(a) - getId(b));
  // 执行组件的更新队列queue
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      job();
    }
  } finally {
    queue.length = 0;
    flushIndex = 0;
    // flushPostFlushCbs
    isFlushing = false;
    currentFlushPromise = null;
    // 有些任务可能会在更新期间进入队列，因此需要递归执行
    if (queue.length || pendingPreFlushCbs.length) {
      flushJobs();
    }
  }
};
