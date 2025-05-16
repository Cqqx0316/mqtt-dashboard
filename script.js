document.addEventListener('DOMContentLoaded', () => {
    // 元素
    const statusDot = document.getElementById('status-indicator');
    const connectionText = document.getElementById('connection-text');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
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
    
    // MQTT代理配置
    const mqttConfig = {
        host: 'r3e5f9b6.ala.cn-hangzhou.emqxsl.cn',
        port: 8084,
        path: '/mqtt',
        clientId: `mqtt_dashboard_${Date.now()}`
    };
    
    // 连接MQTT代理
    connectBtn.addEventListener('click', () => {
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }
        
        const connectUrl = `wss://${mqttConfig.host}:${mqttConfig.port}${mqttConfig.path}`;
        
        try {
            client = mqtt.connect(connectUrl, {
                clientId: mqttConfig.clientId,
                username: username,
                password: password,
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
                    subscribeToTopic('testtopic/#');
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
        // 清空容器
        while (devicesContainer.children.length > 1) {
            devicesContainer.removeChild(devicesContainer.lastChild);
        }
        
        // 添加所有设备数据
        Object.entries(deviceData).forEach(([deviceId, data]) => {
            const deviceCard = document.createElement('div');
            deviceCard.className = 'device-card';
            deviceCard.innerHTML = `
                <h3>
                    ${deviceId}
                    <small>(${data.topic})</small>
                </h3>
                <div class="data-content">
                    ${typeof data.value === 'object' 
                        ? `<pre>${JSON.stringify(data.value, null, 2)}</pre>`
                        : `<div>${data.value}</div>`}
                </div>
                <div class="timestamp">更新时间: ${data.timestamp}</div>
            `;
            devicesContainer.appendChild(deviceCard);
        });
    }
});