document.addEventListener('DOMContentLoaded', () => {
    // 元素
    const statusDot = document.getElementById('status-indicator');
    const connectionText = document.getElementById('connection-text');
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const topicInput = document.getElementById('topic-input');
    const subscribeBtn = document.getElementById('subscribe-btn');
    const topicsList = document.getElementById('topics');
    const devicesContainer = document.getElementById('devices-container');

    // 全局变量
    let client = null;
    const subscribedTopics = new Set();
    const deviceData = {};
    const deviceCards = {};
    let selectedUser = '';

    // MQTT代理配置
    const mqttConfig = {
        host: '47.98.39.99',
        port: 8083,
        path: '/mqtt',
        clientId: `mqtt_dashboard_${Date.now()}`
    };

    // 连接MQTT代理
    connectBtn.addEventListener('click', () => {
        // 你可以根据服务器实际情况切换 ws:// 或 wss://
        const connectUrl = `wss://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`;
        // const connectUrl = `wss://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`;

        try {
            client = mqtt.connect(connectUrl, {
                clientId: mqttConfig.clientId,
                clean: true,
                reconnectPeriod: 5000,
                connectTimeout: 30 * 1000
            });

            // 更新UI
            connectBtn.disabled = true;
            connectionText.textContent = '正在连接...';

            // 监听连接事件
            client.on('connect', () => {
                console.log('MQTT连接成功!');
                statusDot.classList.add('connected');
                connectionText.textContent = '已连接';
                disconnectBtn.disabled = false;

                // 重新订阅所有主题
                subscribedTopics.forEach(topic => {
                    client.subscribe(topic);
                });

                // 默认订阅一些主题
                if (subscribedTopics.size === 0) {
                    subscribeToTopic('031666');
                    subscribeToTopic('#');
                }
            });

            // 监听消息事件
            client.on('message', (topic, message) => {
                try {
                    console.log(`收到消息: ${topic} - ${message.toString()}`);

                    // 解析消息
                    let payload;
                    try {
                        payload = JSON.parse(message.toString());
                    } catch (e) {
                        payload = message.toString();
                    }

                    // 确定设备ID
                    const parts = topic.split('/');
                    const deviceId = parts.length > 1 ? parts[1] : topic;

                    // 更新设备数据
                    deviceData[deviceId] = {
                        value: payload,
                        timestamp: new Date().toLocaleString(),
                        topic: topic
                    };

                    // 更新UI
                    updateDeviceDisplay();
                } catch (error) {
                    console.error('处理消息时出错:', error);
                }
            });

            // 监听错误事件
            client.on('error', (error) => {
                console.error('MQTT错误:', error);
                statusDot.classList.remove('connected');
                connectionText.textContent = `连接错误: ${error.message}`;
            });

            // 监听断开连接事件
            client.on('close', () => {
                console.log('MQTT连接已关闭');
                statusDot.classList.remove('connected');
                connectionText.textContent = '已断开连接';
                connectBtn.disabled = false;
                disconnectBtn.disabled = true;
            });

        } catch (error) {
            console.error('创建MQTT客户端时出错:', error);
            alert(`连接错误: ${error.message}`);
        }
    });

    // 断开连接
    disconnectBtn.addEventListener('click', () => {
        if (client && client.connected) {
            client.end();
            disconnectBtn.disabled = true;
            connectBtn.disabled = false;
        }
    });

    // 订阅主题
    subscribeBtn.addEventListener('click', () => {
        const topic = topicInput.value.trim();
        if (!topic) {
            alert('请输入要订阅的主题');
            return;
        }

        subscribeToTopic(topic);
        topicInput.value = '';
    });

    function subscribeToTopic(topic) {
        if (subscribedTopics.has(topic)) {
            alert(`已经订阅了主题 "${topic}"`);
            return;
        }

        if (client && client.connected) {
            client.subscribe(topic, (err) => {
                if (!err) {
                    addTopicToList(topic);
                } else {
                    alert(`订阅主题 "${topic}" 失败: ${err.message}`);
                }
            });
        } else {
            // 如果客户端未连接，仅添加到列表，稍后连接时会订阅
            addTopicToList(topic);
        }
    }

    function addTopicToList(topic) {
        subscribedTopics.add(topic);

        const li = document.createElement('li');
        li.innerHTML = `
            <span>${topic}</span>
            <button class="unsubscribe-btn" data-topic="${topic}">取消订阅</button>
        `;
        topicsList.appendChild(li);

        // 添加取消订阅事件
        const unsubBtn = li.querySelector('.unsubscribe-btn');
        unsubBtn.addEventListener('click', () => {
            unsubscribeFromTopic(topic);
            li.remove();
        });
    }

    function unsubscribeFromTopic(topic) {
        if (client && client.connected) {
            client.unsubscribe(topic);
        }
        subscribedTopics.delete(topic);
    }

    function updateDeviceDisplay() {
        // 遍历所有设备数据，并局部更新相关设备的卡片
        Object.entries(deviceData).forEach(([deviceId, dataObj]) => {
            const data = dataObj.value;

            // 判断是否匹配筛选条件
            if (selectedUser && data.username !== selectedUser) {
                // 如果不是目标用户，显示目标用户的卡片
                const targetUserData = Object.values(deviceData).find(d => d.value.username === selectedUser);
                if (targetUserData) {
                    const cardHTML = renderDeviceCardHTML(targetUserData.value);
                    if (cardHTML) {
                        if (deviceCards[deviceId]) {
                            deviceCards[deviceId].innerHTML = `
                                <div style="margin-bottom:16px;">
                                    ${cardHTML}
                                </div>
                            `;
                            deviceCards[deviceId].style.display = 'block';
                        } else {
                            const card = document.createElement('div');
                            card.style.marginBottom = '16px';
                            card.innerHTML = cardHTML;
                            deviceCards[deviceId] = card;
                            devicesContainer.appendChild(card);
                        }
                    }
                }
            } else {
                // 对于目标用户或未设置筛选条件的记录
                const cardHTML = renderDeviceCardHTML(data);
                if (cardHTML) {
                    if (deviceCards[deviceId]) {
                        deviceCards[deviceId].innerHTML = `
                            <div style="margin-bottom:16px;">
                                ${cardHTML}
                            </div>
                        `;
                        deviceCards[deviceId].style.display = 'block';
                    } else {
                        const card = document.createElement('div');
                        card.style.marginBottom = '16px';
                        card.innerHTML = cardHTML;
                        deviceCards[deviceId] = card;
                        devicesContainer.appendChild(card);
                    }
                }
            }
        });
    }

    // 辅助函数，返回卡片HTML字符串
    function renderDeviceCardHTML(data) {
        return `
            <div class="device-card">
                <div class="device-header">
                    <span class="device-name"><i class="bi bi-cpu"></i> ${data.username ?? '--'}</span>
                    <span class="device-status ${data.online ? 'online' : 'offline'}">
                        <i class="bi bi-circle-fill"></i> ${data.online ? '在线' : '离线'}
                    </span>
                </div>
                <div class="device-metrics">
                    <div class="metric-card">
                        <div class="metric-icon heart-rate-icon"><i class="bi bi-heart-pulse-fill"></i></div>
                        <div class="metric-label">心率</div>
                        <div class="metric-value metric-normal">${data.heartRate ?? '--'}</div>
                        <div class="metric-unit">BPM</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon spo2-icon"><i class="bi bi-droplet-fill"></i></div>
                        <div class="metric-label">血氧</div>
                        <div class="metric-value metric-normal">${data.spo2 ?? '--'}</div>
                        <div class="metric-unit">%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon fatigue-icon"><i class="bi bi-battery-half"></i></div>
                        <div class="metric-label">疲劳</div>
                        <div class="metric-value metric-warning">${data.fatigue ?? '--'}</div>
                        <div class="metric-unit"></div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon bp-icon"><i class="bi bi-activity"></i></div>
                        <div class="metric-label">血压</div>
                        <div class="metric-value metric-normal">${data.systolic ?? '--'}/${data.diastolic ?? '--'}</div>
                        <div class="metric-unit">mmHg</div>
                    </div>
                </div>
            </div>
        `;
    }

    document.getElementById('filter-btn').addEventListener('click', () => {
        selectedUser = document.getElementById('user-filter').value.trim();
        updateDeviceDisplay();
    });
});
