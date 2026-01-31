# 发票合并打印工具

一款轻量级的浏览器端发票合并打印工具，支持批量处理 PDF 和 OFD 格式的发票文件，并按照自定义排版方式合并到 A4 纸上，方便批量打印。

## ✨ 功能特性

- 📄 **多格式支持**：支持 PDF 和 OFD 格式的发票文件
- 🔄 **批量处理**：支持拖拽上传、多选文件，批量合并
- 📐 **灵活排版**：自定义行列数、页边距、发票间距
- 🔍 **实时预览**：第二步提供排版预览，所见即所得
- 🖨️ **打印优化**：支持横向/纵向排版，可选边框、裁剪线、页码
- 🔒 **本地处理**：所有文件处理均在浏览器本地完成，不上传服务器，保证数据安全
- 📦 **零依赖安装**：纯静态网页，无需后端服务，双击即可使用

## 🚀 快速开始

### 使用方法

1. **直接使用**  
   双击打开 `index.html` 文件，或使用本地服务器运行。

2. **通过本地服务器运行（推荐）**  
   ```bash
   # 使用 Python
   python -m http.server 8000
   
   # 或使用 Node.js (需安装 http-server)
   npx http-server -p 8000
   ```
   然后在浏览器中访问 `http://localhost:8000`

### 操作步骤

1. **上传发票文件**  
   - 点击上传区域或拖拽文件到页面
   - 支持同时选择多个 PDF/OFD 文件
   - 可查看已上传文件列表，并单独移除

2. **设置排版方式**  
   - 选择打印方向（纵向/横向）
   - 设置每页行数和列数（如：2 行 1 列，每页放 2 张发票）
   - 调整页边距和发票间距
   - 可选显示边框、裁剪虚线、页码
   - 实时预览排版效果

3. **下载合并后的 PDF**  
   - 点击"开始合并"，系统自动生成合并后的 PDF
   - 下载文件名格式：`发票合并_YYYYMMDD.pdf`

## 📂 项目结构

```
fapiao/
├── index.html          # 主页面
├── style.css           # 样式文件
├── app.js              # 核心逻辑
├── lib/                # 本地 JavaScript 库
│   ├── pdf.min.js      # PDF.js (PDF 渲染)
│   ├── pdf.worker.min.js  # PDF.js Worker
│   ├── pdf-lib.min.js  # pdf-lib (PDF 生成)
│   └── jszip.min.js    # JSZip (OFD 解析)
└── README.md           # 项目说明
```

## 🛠️ 技术栈

- **前端框架**：纯 HTML + CSS + JavaScript（ES6+）
- **PDF 处理**：
  - [PDF.js](https://github.com/mozilla/pdf.js) - 渲染 PDF 到 Canvas
  - [pdf-lib](https://github.com/Hopding/pdf-lib) - 生成和合并 PDF
- **OFD 解析**：[JSZip](https://github.com/Stuk/jszip) - 解压 OFD 文件（ZIP 格式）

> **安全说明**：所有第三方库均已下载到 `lib/` 目录本地化存储，避免远程 CDN 引用带来的安全风险。

## 🎯 核心功能说明

### 1. 文件解析
- **PDF 文件**：使用 PDF.js 解析并渲染每一页
- **OFD 文件**：解压 ZIP 包，提取内部图片资源作为页面内容

### 2. 排版计算
- 根据用户设置的行列数、边距、间距计算每张发票的尺寸
- 自动缩放并居中显示每张发票
- 支持横向和纵向两种 A4 排版方式

### 3. 预览功能
- 实时渲染预览页面，支持分页浏览
- 使用 Canvas 绘制预览效果
- 支持缓存机制，提升渲染性能

### 4. PDF 合并
- 使用 pdf-lib 创建新的 PDF 文档
- 逐页嵌入原始发票内容
- 支持添加边框、裁剪线、页码等辅助元素

## 📋 常见问题

### Q1: OFD 文件显示不正常？
部分 OFD 文件包含矢量图形而非图片资源，当前版本仅支持提取内嵌图片。建议将 OFD 转换为 PDF 后再使用。

### Q2: 如何调整发票大小？
通过调整"每页行数"和"每页列数"来控制单张发票的大小。例如：
- 2 行 1 列 = 每张发票占半页
- 3 行 2 列 = 每张发票占 1/6 页

### Q3: 文件是否会上传到服务器？
不会。所有文件处理均在浏览器本地完成，不涉及网络传输，确保数据安全。

### Q4: 支持哪些浏览器？
推荐使用现代浏览器（Chrome、Edge、Firefox、Safari 最新版本）。不支持 IE 浏览器。

## 🔧 本地开发

如需修改代码或二次开发：

1. **克隆或下载项目**
2. **直接编辑文件**  
   - `index.html` - 页面结构
   - `style.css` - 样式调整
   - `app.js` - 功能逻辑
3. **刷新浏览器查看效果**

### 更新依赖库

如需更新本地 JavaScript 库：

```bash
# 创建 lib 目录（如果不存在）
mkdir lib

# 下载最新版本（替换版本号）
# PDF.js
curl -o lib/pdf.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
curl -o lib/pdf.worker.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js

# pdf-lib
curl -o lib/pdf-lib.min.js https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js

# JSZip
curl -o lib/jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
```

> **注意**：更新库版本后，需同步修改 `app.js` 中的 `workerSrc` 路径（如果更改了文件名）。

## 📦 打包为桌面应用

如需打包为 Windows/macOS/Linux 桌面应用，推荐使用以下方案：

### 方案 1: Electron（最主流）
- 优点：成熟稳定，跨平台
- 缺点：体积较大（~100MB）

### 方案 2: Tauri（推荐轻量化）
- 优点：体积小（~5MB），性能好
- 缺点：需配置 Rust 环境

### 方案 3: WebView2 封装
- 优点：极简轻量，依赖系统浏览器内核
- 缺点：需要一些原生代码

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，欢迎反馈。

---

**享受高效的发票合并体验！** 🎉
