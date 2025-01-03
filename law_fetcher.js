class LawFetcher {
    constructor() {
        this.baseUrl = 'https://flk.npc.gov.cn/api/';
        this.failedPages = new Map(); // 存储加载失败的页码及重试次数
        this.maxRetries = 3; // 最大重试次数
    }

    async fetchPageData(page = 1, isRetry = false) {
        const params = new URLSearchParams({
            page: page,
            type: '',
            searchType: 'title;vague',
            sortTr: 'f_bbrq_s;desc',
            gbrqStart: '',
            gbrqEnd: '',
            sxrqStart: '',
            sxrqEnd: '',
            sort: 'true',
            last: 'true',
            size: '10',
            _: Date.now()
        });

        try {
            console.log(`Requesting page ${page}...`);
            
            // 根据是否是重试阶段设置不同的超时时间
            const timeout = isRetry ? 10000 : 5000;  // 重试时使用 10 秒超时
            
            // 创建一个超时 Promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时')), timeout);
            });

            // 创建实际的请求 Promise
            const fetchPromise = fetch(`${this.baseUrl}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Origin': 'https://flk.npc.gov.cn',
                    'Referer': 'https://flk.npc.gov.cn'
                },
                mode: 'cors'
            });

            // 使用 Promise.race 竞争，谁先完成就用谁的结果
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            
            if (!data || !data.result || !data.result.data) {
                console.error('Invalid data structure:', data);
                throw new Error('Invalid data structure received from server');
            }
            
            console.log(`Successfully received page ${page} data`);
            return data.result.data;
        } catch (error) {
            console.error(`获取第${page}页数据时出错:`, error);
            if (error.message === '请求超时') {
                console.error(`第${page}页请求超时 (${isRetry ? '重试阶段' : '首次获取'})`);
            } else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                console.error('网络连接失败，请检查服务器是否正在运行');
            }
            throw error;
        }
    }

    async fetchAllData(progressCallback, pageRange = null) {
        const allData = [];
        let page = pageRange ? pageRange.start : 1;
        let hasMoreData = true;
        const endPage = pageRange ? pageRange.end : null;
        
        // 计算总页数
        const totalPages = endPage ? (endPage - page + 1) : 100;
        
        // 第一轮加载
        while (hasMoreData) {
            if (endPage !== null && page > endPage) {
                break;
            }

            if (progressCallback) {
                const currentProgress = ((page - (pageRange ? pageRange.start : 1)) / totalPages) * 100;
                progressCallback(page, totalPages, currentProgress);
            }
            
            console.log(`正在获取第${page}页数据...`);
            try {
                const pageData = await this.fetchPageData(page);
                
                if (pageData.length === 0) {
                    hasMoreData = false;
                    console.log('没有更多数据了');
                    break;
                }
                
                allData.push(...pageData);
                console.log(`当前已获取 ${allData.length} 条数据`);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                page++;
            } catch (error) {
                console.error(`获取第${page}页数据时出错:`, error);
                this.failedPages.set(page, 1); // 记录失败页码，初始重试次数为1
                progressCallback(page, totalPages, null, `第${page}页加载失败，将在完成后重试`);
                page++;
                continue;
            }
        }

        // 处理失败的页面
        if (this.failedPages.size > 0) {
            progressCallback(null, null, null, '开始重试加载失败的页面...');
            
            while (this.failedPages.size > 0 && [...this.failedPages.values()].some(retries => retries < this.maxRetries)) {
                const failedEntries = [...this.failedPages.entries()];
                
                for (const [failedPage, retries] of failedEntries) {
                    if (retries >= this.maxRetries) continue;
                    
                    try {
                        progressCallback(null, null, null, `正在重试第${failedPage}页（第${retries}次重试）...`);
                        const pageData = await this.fetchPageData(failedPage, true);
                        
                        if (pageData.length > 0) {
                            allData.push(...pageData);
                            this.failedPages.delete(failedPage);
                            progressCallback(null, null, null, `第${failedPage}页重试成功`);
                        }
                    } catch (error) {
                        this.failedPages.set(failedPage, retries + 1);
                        progressCallback(null, null, null, `第${failedPage}页第${retries}次重试失败`);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // 最终失败统计
            const finalFailures = [...this.failedPages.entries()]
                .filter(([_, retries]) => retries >= this.maxRetries)
                .map(([page]) => page);
                
            if (finalFailures.length > 0) {
                progressCallback(null, null, null, 
                    `完成加载，但以下页面始终无法加载：${finalFailures.join(', ')}`);
            } else {
                progressCallback(null, null, null, '所有失败页面重试成功');
            }
        }

        return allData;
    }

    displayData(data, targetId = 'fetchedData') {
        console.log(`开始显示数据，共 ${data.length} 条`);
        
        const resultDiv = document.getElementById(targetId);
        if (!resultDiv) {
            console.error(`找不到目标元素: ${targetId}`);
            return;
        }

        try {
            // 创建表格元素
            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            
            // 创建表头
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            ['序号', 'ID', '标题', '制定机关', '法律性质', '公布日期', '实施日期', '时效性'].forEach(text => {
                const th = document.createElement('th');
                th.textContent = text;
                th.style.border = '1px solid black';
                th.style.padding = '8px';
                // 设置列宽
                switch(text) {
                    case '序号':
                        th.style.width = '60px';
                        break;
                    case 'ID':
                        th.style.width = '80px';
                        break;
                    case '法律性质':
                        th.style.width = '100px';
                        break;
                    case '公布日期':
                    case '实施日期':
                        th.style.width = '100px';
                        break;
                    case '时效性':
                        th.style.width = '80px';
                        break;
                }
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // 创建表体
            const tbody = document.createElement('tbody');
            data.forEach((item, index) => {
                const row = document.createElement('tr');
                
                // 添加序号单元格
                const indexCell = document.createElement('td');
                indexCell.textContent = index + 1;
                indexCell.style.border = '1px solid black';
                indexCell.style.padding = '8px';
                indexCell.style.textAlign = 'center';
                row.appendChild(indexCell);
                
                // 添加 ID 单元格
                const idCell = document.createElement('td');
                const idLink = document.createElement('a');
                idLink.href = `https://flk.npc.gov.cn/detail2.html?${item.id || ''}`;
                idLink.textContent = item.id || '暂无ID';
                idLink.target = '_blank'; // 在新标签页中打开
                idLink.style.textDecoration = 'none'; // 移除下划线
                idLink.style.color = '#1976D2'; // 链接颜色
                idLink.style.cursor = 'pointer'; // 鼠标指针样式

                // 鼠标悬停效果
                idLink.addEventListener('mouseover', function() {
                    this.style.textDecoration = 'underline';
                    this.style.color = '#1565C0';
                });
                idLink.addEventListener('mouseout', function() {
                    this.style.textDecoration = 'none';
                    this.style.color = '#1976D2';
                });

                idCell.style.border = '1px solid black';
                idCell.style.padding = '8px';
                idCell.style.textAlign = 'center';
                idCell.appendChild(idLink);
                row.appendChild(idCell);
                
                // 添加其他数据单元格
                [
                    item.title, 
                    item.office, 
                    item.type,
                    item.publish,
                    item.expiry,
                    this.getStatusText(item.status)
                ].forEach((text, cellIndex) => {
                    const td = document.createElement('td');
                    td.textContent = text || '暂无数据';
                    td.style.border = '1px solid black';
                    td.style.padding = '8px';
                    
                    // 为某些列设置居中对齐
                    if (cellIndex >= 2) { // 从法律性质列开始居中对齐
                        td.style.textAlign = 'center';
                    }
                    
                    // 为时效性添加颜色标识
                    if (cellIndex === 5) { // 时效性列
                        switch(item.status) {
                            case '1':
                                td.style.color = '#4CAF50'; // 绿色表示有效
                                break;
                            case '3':
                                td.style.color = '#FFA500'; // 橙色表示尚未生效
                                break;
                            case '7':
                                td.style.color = '#999'; // 灰色表示空值
                                break;
                        }
                    }
                    
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            
            // 清空并显示结果
            resultDiv.innerHTML = '';
            resultDiv.appendChild(table);
            
            console.log('数据显示完成');
        } catch (error) {
            console.error('显示数据时出错:', error);
            resultDiv.innerHTML = `<div style="color: red;">显示数据时出错: ${error.message}</div>`;
        }
    }

    saveToJson(data, filename = 'laws_data.json') {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 添加状态转换方法
    getStatusText(status) {
        switch(status) {
            case '1':
                return '有效';
            case '3':
                return '尚未生效';
            case '7':
                return '';
            default:
                return '未知状态';
        }
    }
} 