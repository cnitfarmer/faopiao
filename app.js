// 初始化 PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

// 应用状态
const state = {
    files: [], // 存储上传的文件信息 { file, name, type, pages: [] }
    currentStep: 1,
    currentPreviewPage: 0, // 当前预览页码（从0开始）
    previewCache: new Map(), // 缓存渲染的页面图像
    settings: {
        orientation: 'portrait',
        rows: 2,
        cols: 1,
        margin: 10,
        gap: 5,
        showBorder: false,
        showCutLine: false,
        showPageNumber: false
    }
};

// A4 尺寸 (单位: 点, 72点=1英寸, A4=210mm x 297mm)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MM_TO_PT = 2.83465;

// DOM 元素
const elements = {
    uploadArea: document.getElementById('upload-area'),
    fileInput: document.getElementById('file-input'),
    fileList: document.getElementById('file-list'),
    fileItems: document.getElementById('file-items'),
    fileCount: document.getElementById('file-count'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    nextStep1: document.getElementById('next-step1'),
    prevStep2: document.getElementById('prev-step2'),
    nextStep2: document.getElementById('next-step2'),
    restartBtn: document.getElementById('restart-btn'),
    downloadBtn: document.getElementById('download-btn'),
    // 预览相关元素
    previewCanvas: document.getElementById('preview-canvas'),
    previewLoading: document.getElementById('preview-loading'),
    prevPreviewPage: document.getElementById('prev-preview-page'),
    nextPreviewPage: document.getElementById('next-preview-page'),
    currentPreviewPage: document.getElementById('current-preview-page'),
    totalPreviewPages: document.getElementById('total-preview-pages'),
    perPageCount: document.getElementById('per-page-count'),
    totalPages: document.getElementById('total-pages'),
    // 结果相关元素
    processing: document.getElementById('processing'),
    resultSuccess: document.getElementById('result-success'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    resultInvoiceCount: document.getElementById('result-invoice-count'),
    resultPageCount: document.getElementById('result-page-count')
};

// 步骤面板
const panels = {
    step1: document.getElementById('step1-panel'),
    step2: document.getElementById('step2-panel'),
    step3: document.getElementById('step3-panel')
};

// 初始化
function init() {
    setupEventListeners();
    updatePreview();
}

// 设置事件监听
function setupEventListeners() {
    // 上传区域点击
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());

    // 文件选择
    elements.fileInput.addEventListener('change', handleFileSelect);

    // 拖放
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // 清空全部
    elements.clearAllBtn.addEventListener('click', clearAllFiles);

    // 步骤导航
    elements.nextStep1.addEventListener('click', () => goToStep(2));
    elements.prevStep2.addEventListener('click', () => goToStep(1));
    elements.nextStep2.addEventListener('click', startMerge);
    elements.restartBtn.addEventListener('click', restart);
    elements.downloadBtn.addEventListener('click', downloadMergedPDF);

    // 设置变更
    document.querySelectorAll('input[name="orientation"]').forEach(input => {
        input.addEventListener('change', (e) => {
            state.settings.orientation = e.target.value;
            updatePreview();
        });
    });

    ['rows', 'cols', 'margin', 'gap'].forEach(id => {
        const el = document.getElementById(id);
        const handler = (e) => {
            state.settings[id] = parseInt(e.target.value) || 1;
            updatePreview();
        };
        el.addEventListener('change', handler);
        el.addEventListener('input', handler);
    });

    ['show-border', 'show-cut-line', 'show-page-number'].forEach(id => {
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        document.getElementById(id).addEventListener('change', (e) => {
            state.settings[key] = e.target.checked;
            state.previewCache.clear(); // 清除缓存以重新渲染
            renderPreviewPage();
        });
    });

    // 预览页面导航
    elements.prevPreviewPage.addEventListener('click', () => {
        if (state.currentPreviewPage > 0) {
            state.currentPreviewPage--;
            renderPreviewPage();
        }
    });

    elements.nextPreviewPage.addEventListener('click', () => {
        const totalPagesNeeded = getTotalPreviewPages();
        if (state.currentPreviewPage < totalPagesNeeded - 1) {
            state.currentPreviewPage++;
            renderPreviewPage();
        }
    });
}

// 处理文件选择
function handleFileSelect(e) {
    handleFiles(e.target.files);
    e.target.value = ''; // 重置以便重新选择相同文件
}

// 处理文件
async function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ext === 'pdf' || ext === 'ofd';
    });

    if (validFiles.length === 0) {
        alert('请选择 PDF 或 OFD 格式的文件');
        return;
    }

    for (const file of validFiles) {
        const ext = file.name.toLowerCase().split('.').pop();
        const fileInfo = {
            file,
            name: file.name,
            type: ext,
            size: formatFileSize(file.size),
            pages: []
        };

        try {
            if (ext === 'pdf') {
                await loadPDFPages(fileInfo);
            } else if (ext === 'ofd') {
                await loadOFDPages(fileInfo);
            }
            state.files.push(fileInfo);
        } catch (error) {
            console.error(`加载文件 ${file.name} 失败:`, error);
            alert(`加载文件 ${file.name} 失败: ${error.message}`);
        }
    }

    updateFileList();
    updatePreview();
}

// 加载 PDF 页面
async function loadPDFPages(fileInfo) {
    const arrayBuffer = await fileInfo.file.arrayBuffer();
    // 存储为 Uint8Array 副本，避免 ArrayBuffer detach 问题
    fileInfo.pdfData = new Uint8Array(arrayBuffer);
    
    const pdf = await pdfjsLib.getDocument({ 
        data: fileInfo.pdfData.slice(),
        verbosity: 0  // 减少控制台输出
    }).promise;
    fileInfo.pdfDoc = pdf;
    
    for (let i = 1; i <= pdf.numPages; i++) {
        fileInfo.pages.push({
            pageNum: i,
            type: 'pdf'
        });
    }
    
    console.log(`加载PDF成功: ${fileInfo.name}, ${pdf.numPages}页`);
}

// 加载 OFD 页面 (OFD是ZIP格式，包含XML和图片)
async function loadOFDPages(fileInfo) {
    const arrayBuffer = await fileInfo.file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    fileInfo.ofdZip = zip;
    
    // 解析 OFD 结构
    // OFD 文件结构: OFD.xml -> Document_N/Document.xml -> Pages/Page_N/Content.xml
    const ofdXml = await zip.file('OFD.xml')?.async('string');
    if (!ofdXml) {
        throw new Error('无效的 OFD 文件');
    }

    // 查找所有文档
    const docDirs = [];
    zip.forEach((relativePath, file) => {
        const match = relativePath.match(/^(Doc_\d+)\//);
        if (match && !docDirs.includes(match[1])) {
            docDirs.push(match[1]);
        }
    });

    if (docDirs.length === 0) {
        // 尝试其他常见的目录结构
        zip.forEach((relativePath, file) => {
            if (relativePath.includes('Document.xml')) {
                const dir = relativePath.split('/')[0];
                if (!docDirs.includes(dir)) {
                    docDirs.push(dir);
                }
            }
        });
    }

    // 遍历每个文档，提取页面图片
    for (const docDir of docDirs) {
        // 查找该文档中的所有图片资源
        const imageFiles = [];
        zip.forEach((relativePath, file) => {
            if (relativePath.startsWith(docDir) && /\.(png|jpg|jpeg|bmp)$/i.test(relativePath)) {
                imageFiles.push({ path: relativePath, file });
            }
        });

        // 如果找到图片，按顺序添加为页面
        if (imageFiles.length > 0) {
            imageFiles.sort((a, b) => a.path.localeCompare(b.path));
            for (const img of imageFiles) {
                const imageData = await img.file.async('base64');
                const ext = img.path.split('.').pop().toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                
                fileInfo.pages.push({
                    type: 'ofd-image',
                    imageData: `data:${mimeType};base64,${imageData}`
                });
            }
        }
    }

    // 如果没有找到图片，尝试渲染页面内容
    if (fileInfo.pages.length === 0) {
        // 简化处理：查找所有嵌入的印章或签章图片
        const allImages = [];
        zip.forEach((relativePath, file) => {
            if (/\.(png|jpg|jpeg|bmp)$/i.test(relativePath)) {
                allImages.push({ path: relativePath, file });
            }
        });

        if (allImages.length > 0) {
            allImages.sort((a, b) => a.path.localeCompare(b.path));
            for (const img of allImages) {
                const imageData = await img.file.async('base64');
                const ext = img.path.split('.').pop().toLowerCase();
                const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                
                fileInfo.pages.push({
                    type: 'ofd-image',
                    imageData: `data:${mimeType};base64,${imageData}`
                });
            }
        } else {
            // 如果仍然没有图片，标记为需要转换
            fileInfo.pages.push({
                type: 'ofd-xml',
                message: 'OFD 矢量内容'
            });
        }
    }
}

// 更新文件列表显示
function updateFileList() {
    if (state.files.length === 0) {
        elements.fileList.style.display = 'none';
        elements.nextStep1.disabled = true;
        return;
    }

    elements.fileList.style.display = 'block';
    elements.nextStep1.disabled = false;
    elements.fileCount.textContent = state.files.length;

    elements.fileItems.innerHTML = state.files.map((file, index) => `
        <div class="file-item">
            <div class="file-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>
            <div class="file-item-info">
                <div class="file-item-name">${escapeHtml(file.name)}</div>
                <div class="file-item-size">${file.size} · ${file.pages.length} 页</div>
            </div>
            <button class="file-item-remove" onclick="removeFile(${index})" title="移除">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `).join('');
}

// 移除单个文件
function removeFile(index) {
    state.files.splice(index, 1);
    updateFileList();
    updatePreview();
}

// 清空所有文件
function clearAllFiles() {
    state.files = [];
    updateFileList();
    updatePreview();
}

// 更新预览
function updatePreview() {
    const { rows, cols } = state.settings;
    const perPage = rows * cols;
    const totalInvoices = getTotalPages();
    const totalPagesNeeded = Math.ceil(totalInvoices / perPage) || 1;

    elements.perPageCount.textContent = perPage;
    elements.totalPages.textContent = totalPagesNeeded;

    // 重置预览页码
    state.currentPreviewPage = 0;
    state.previewCache.clear();
    
    // 渲染预览
    renderPreviewPage();
}

// 获取预览总页数
function getTotalPreviewPages() {
    const { rows, cols } = state.settings;
    const perPage = rows * cols;
    const totalInvoices = getTotalPages();
    return Math.ceil(totalInvoices / perPage) || 1;
}

// 渲染预览页面
async function renderPreviewPage() {
    const canvas = elements.previewCanvas;
    const ctx = canvas.getContext('2d');
    const { rows, cols, margin, gap, orientation, showBorder, showCutLine, showPageNumber } = state.settings;
    
    const isLandscape = orientation === 'landscape';
    const pageWidth = isLandscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = isLandscape ? A4_WIDTH : A4_HEIGHT;
    
    // 设置Canvas尺寸（使用较高的缩放比例以获得清晰的预览）
    const scale = 1.0;
    canvas.width = pageWidth * scale;
    canvas.height = pageHeight * scale;
    
    // 白色背景
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const marginPt = margin * MM_TO_PT * scale;
    const gapPt = gap * MM_TO_PT * scale;
    
    const contentWidth = canvas.width - marginPt * 2;
    const contentHeight = canvas.height - marginPt * 2;
    const cellWidth = (contentWidth - gapPt * (cols - 1)) / cols;
    const cellHeight = (contentHeight - gapPt * (rows - 1)) / rows;
    
    const perPage = rows * cols;
    const allPages = getAllPages();
    const totalPagesNeeded = getTotalPreviewPages();
    
    // 更新导航按钮状态
    elements.prevPreviewPage.disabled = state.currentPreviewPage <= 0;
    elements.nextPreviewPage.disabled = state.currentPreviewPage >= totalPagesNeeded - 1;
    elements.currentPreviewPage.textContent = state.currentPreviewPage + 1;
    elements.totalPreviewPages.textContent = totalPagesNeeded;
    
    if (allPages.length === 0) {
        // 没有文件时显示占位符
        ctx.fillStyle = '#f5f5f5';
        ctx.strokeStyle = '#d9d9d9';
        ctx.setLineDash([5, 5]);
        
        for (let i = 0; i < perPage; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = marginPt + col * (cellWidth + gapPt);
            const y = marginPt + row * (cellHeight + gapPt);
            
            ctx.fillRect(x, y, cellWidth, cellHeight);
            ctx.strokeRect(x, y, cellWidth, cellHeight);
            
            // 显示占位文字
            ctx.fillStyle = '#999';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`发票 ${i + 1}`, x + cellWidth / 2, y + cellHeight / 2);
            ctx.fillStyle = '#f5f5f5';
        }
        ctx.setLineDash([]);
        return;
    }
    
    // 显示加载状态
    elements.previewLoading.style.display = 'flex';
    
    try {
        // 渲染当前页面的发票
        for (let i = 0; i < perPage; i++) {
            const invoiceIndex = state.currentPreviewPage * perPage + i;
            if (invoiceIndex >= allPages.length) break;
            
            const { fileInfo, page } = allPages[invoiceIndex];
            
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = marginPt + col * (cellWidth + gapPt);
            const y = marginPt + row * (cellHeight + gapPt);
            
            try {
                // 获取或渲染页面图像
                const pageImage = await getPageImage(fileInfo, page);
                
                if (pageImage) {
                    // 计算缩放和居中
                    const imgScale = Math.min(cellWidth / pageImage.width, cellHeight / pageImage.height);
                    const scaledWidth = pageImage.width * imgScale;
                    const scaledHeight = pageImage.height * imgScale;
                    const offsetX = (cellWidth - scaledWidth) / 2;
                    const offsetY = (cellHeight - scaledHeight) / 2;
                    
                    ctx.drawImage(pageImage, x + offsetX, y + offsetY, scaledWidth, scaledHeight);
                }
            } catch (err) {
                console.error('渲染页面失败:', err);
                // 显示错误占位符
                ctx.fillStyle = '#ffebee';
                ctx.fillRect(x, y, cellWidth, cellHeight);
                ctx.fillStyle = '#f44336';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('加载失败', x + cellWidth / 2, y + cellHeight / 2);
            }
            
            // 绘制边框
            if (showBorder) {
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 1;
                ctx.setLineDash([]);
                ctx.strokeRect(x, y, cellWidth, cellHeight);
            }
            
            // 绘制裁剪虚线
            if (showCutLine) {
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x, y, cellWidth, cellHeight);
                ctx.setLineDash([]);
            }
        }
        
        // 绘制页码
        if (showPageNumber) {
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${state.currentPreviewPage + 1} / ${totalPagesNeeded}`, canvas.width / 2, canvas.height - 10);
        }
    } finally {
        elements.previewLoading.style.display = 'none';
    }
}

// 获取所有页面
function getAllPages() {
    const allPages = [];
    for (const fileInfo of state.files) {
        for (const page of fileInfo.pages) {
            allPages.push({ fileInfo, page });
        }
    }
    return allPages;
}

// 获取页面图像（带缓存）
async function getPageImage(fileInfo, page) {
    const cacheKey = `${fileInfo.name}-${page.pageNum || 'img'}-${page.type}`;
    
    if (state.previewCache.has(cacheKey)) {
        return state.previewCache.get(cacheKey);
    }
    
    let image = null;
    
    if (page.type === 'pdf') {
        image = await renderPdfPageToImage(fileInfo, page.pageNum);
    } else if (page.type === 'ofd-image') {
        image = await loadImage(page.imageData);
    }
    
    if (image) {
        state.previewCache.set(cacheKey, image);
    }
    
    return image;
}

// 渲染PDF页面到图像
async function renderPdfPageToImage(fileInfo, pageNum) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: fileInfo.pdfData.slice() }).promise;
        const page = await pdf.getPage(pageNum);
        
        const viewport = page.getViewport({ scale: 1.5 });
        
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = viewport.width;
        offscreenCanvas.height = viewport.height;
        
        const ctx = offscreenCanvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        return offscreenCanvas;
    } catch (err) {
        console.error('渲染PDF页面失败:', err);
        return null;
    }
}

// 加载图片
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// 获取总页数
function getTotalPages() {
    return state.files.reduce((sum, file) => sum + file.pages.length, 0);
}

// 步骤导航
function goToStep(step) {
    state.currentStep = step;
    
    // 更新步骤指示器
    document.querySelectorAll('.step').forEach((el, index) => {
        el.classList.remove('active', 'completed');
        if (index + 1 < step) {
            el.classList.add('completed');
        } else if (index + 1 === step) {
            el.classList.add('active');
        }
    });

    // 显示对应面板
    Object.values(panels).forEach(panel => panel.style.display = 'none');
    panels[`step${step}`].style.display = 'block';
    
    // 进入第二步时渲染预览
    if (step === 2) {
        state.currentPreviewPage = 0;
        state.previewCache.clear();
        renderPreviewPage();
    }
}

// 开始合并
async function startMerge() {
    goToStep(3);
    elements.processing.style.display = 'flex';
    elements.resultSuccess.style.display = 'none';
    
    try {
        await mergePDFs();
    } catch (error) {
        console.error('合并失败:', error);
        alert('合并失败: ' + error.message);
        goToStep(2);
    }
}

// 合并 PDF
async function mergePDFs() {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const { rows, cols, margin, gap, orientation, showBorder, showCutLine, showPageNumber } = state.settings;
    
    const isLandscape = orientation === 'landscape';
    const pageWidth = isLandscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = isLandscape ? A4_WIDTH : A4_HEIGHT;
    
    const marginPt = margin * MM_TO_PT;
    const gapPt = gap * MM_TO_PT;
    
    // 计算每个发票的可用空间
    const contentWidth = pageWidth - marginPt * 2;
    const contentHeight = pageHeight - marginPt * 2;
    const cellWidth = (contentWidth - gapPt * (cols - 1)) / cols;
    const cellHeight = (contentHeight - gapPt * (rows - 1)) / rows;
    
    const perPage = rows * cols;
    const allPages = [];
    
    // 收集所有页面
    for (const fileInfo of state.files) {
        for (const page of fileInfo.pages) {
            allPages.push({ fileInfo, page });
        }
    }
    
    const totalPagesNeeded = Math.ceil(allPages.length / perPage);
    
    // 创建新的 PDF 文档
    const mergedPdf = await PDFDocument.create();
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
    
    let processed = 0;
    
    for (let pageIndex = 0; pageIndex < totalPagesNeeded; pageIndex++) {
        const newPage = mergedPdf.addPage([pageWidth, pageHeight]);
        
        for (let i = 0; i < perPage; i++) {
            const invoiceIndex = pageIndex * perPage + i;
            if (invoiceIndex >= allPages.length) break;
            
            const { fileInfo, page } = allPages[invoiceIndex];
            
            // 计算位置 (从左上角开始)
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = marginPt + col * (cellWidth + gapPt);
            const y = pageHeight - marginPt - (row + 1) * cellHeight - row * gapPt;
            
            try {
                if (page.type === 'pdf') {
                    // 嵌入 PDF 页面 - 使用 slice() 创建副本，忽略加密
                    const srcPdf = await PDFDocument.load(fileInfo.pdfData.slice(), { 
                        ignoreEncryption: true 
                    });
                    const [embeddedPage] = await mergedPdf.embedPdf(srcPdf, [page.pageNum - 1]);
                    
                    const dims = embeddedPage.scale(1);
                    const scale = Math.min(cellWidth / dims.width, cellHeight / dims.height);
                    const scaledWidth = dims.width * scale;
                    const scaledHeight = dims.height * scale;
                    
                    // 居中
                    const offsetX = (cellWidth - scaledWidth) / 2;
                    const offsetY = (cellHeight - scaledHeight) / 2;
                    
                    newPage.drawPage(embeddedPage, {
                        x: x + offsetX,
                        y: y + offsetY,
                        width: scaledWidth,
                        height: scaledHeight
                    });
                    
                    console.log(`嵌入页面成功: ${fileInfo.name} 第${page.pageNum}页, 尺寸: ${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)}`);
                } else if (page.type === 'ofd-image') {
                    // 嵌入图片
                    const imageBytes = await fetch(page.imageData).then(r => r.arrayBuffer());
                    let image;
                    if (page.imageData.includes('image/png')) {
                        image = await mergedPdf.embedPng(imageBytes);
                    } else {
                        image = await mergedPdf.embedJpg(imageBytes);
                    }
                    
                    const scale = Math.min(cellWidth / image.width, cellHeight / image.height);
                    const scaledWidth = image.width * scale;
                    const scaledHeight = image.height * scale;
                    
                    const offsetX = (cellWidth - scaledWidth) / 2;
                    const offsetY = (cellHeight - scaledHeight) / 2;
                    
                    newPage.drawImage(image, {
                        x: x + offsetX,
                        y: y + offsetY,
                        width: scaledWidth,
                        height: scaledHeight
                    });
                }
            } catch (err) {
                console.error('处理页面失败:', err);
            }
            
            // 绘制边框
            if (showBorder) {
                newPage.drawRectangle({
                    x: x,
                    y: y,
                    width: cellWidth,
                    height: cellHeight,
                    borderColor: rgb(0.8, 0.8, 0.8),
                    borderWidth: 0.5
                });
            }
            
            // 绘制裁剪虚线
            if (showCutLine) {
                const dashLength = 5;
                const dashGap = 3;
                
                // 绘制虚线边框
                for (let dx = 0; dx < cellWidth; dx += dashLength + dashGap) {
                    const lineWidth = Math.min(dashLength, cellWidth - dx);
                    // 顶部
                    newPage.drawLine({
                        start: { x: x + dx, y: y + cellHeight },
                        end: { x: x + dx + lineWidth, y: y + cellHeight },
                        thickness: 0.5,
                        color: rgb(0.6, 0.6, 0.6),
                        dashArray: [2, 2]
                    });
                    // 底部
                    newPage.drawLine({
                        start: { x: x + dx, y: y },
                        end: { x: x + dx + lineWidth, y: y },
                        thickness: 0.5,
                        color: rgb(0.6, 0.6, 0.6),
                        dashArray: [2, 2]
                    });
                }
            }
            
            processed++;
            updateProgress(processed / allPages.length * 100);
        }
        
        // 绘制页码
        if (showPageNumber) {
            const pageNumText = `${pageIndex + 1} / ${totalPagesNeeded}`;
            const textWidth = font.widthOfTextAtSize(pageNumText, 10);
            newPage.drawText(pageNumText, {
                x: (pageWidth - textWidth) / 2,
                y: 20,
                size: 10,
                font: font,
                color: rgb(0.5, 0.5, 0.5)
            });
        }
    }
    
    // 保存合并后的 PDF
    state.mergedPdfBytes = await mergedPdf.save();
    
    // 显示结果
    elements.processing.style.display = 'none';
    elements.resultSuccess.style.display = 'flex';
    elements.resultInvoiceCount.textContent = allPages.length;
    elements.resultPageCount.textContent = totalPagesNeeded;
}

// 更新进度
function updateProgress(percent) {
    elements.progressFill.style.width = percent + '%';
    elements.progressText.textContent = Math.round(percent) + '%';
}

// 下载合并后的 PDF
function downloadMergedPDF() {
    if (!state.mergedPdfBytes) return;
    
    const blob = new Blob([state.mergedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `发票合并_${formatDate(new Date())}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 重新开始
function restart() {
    state.files = [];
    state.mergedPdfBytes = null;
    updateFileList();
    updatePreview();
    goToStep(1);
}

// 工具函数
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(date) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 启动应用
init();
