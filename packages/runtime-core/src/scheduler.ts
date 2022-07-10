const queue: Function[] = [];
let isFlushing = false;
const resolvePromise = Promise.resolve();

export const queueJob = (job: Function) => {
  // 同一个组件的更新任务会被过滤
  if (!queue.includes(job)) {
    queue.push(job);
  }
  // 不同组件的更新任务 批处理
  if (!isFlushing) {
    isFlushing = true;
    resolvePromise.then(async () => {
      for (let i = 0; i < queue.length; i++) {
        const job = queue[i];
        job();
      }
      queue.length = 0;
      isFlushing = false;
    });
  }
};
