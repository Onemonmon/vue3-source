## 源码项目搭建

1. npm i pnpm -g

2. pnpm init

3. 新建 pnpm-workspace.yaml 文件，用于指定当前项目为 pnpm 的 monorepo 环境

4. 新建 .npmrc 文件解决 pnpm 的幽灵依赖问题

5. pnpm install vue -w 安装项目公共依赖 vue
