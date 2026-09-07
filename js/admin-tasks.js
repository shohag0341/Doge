// Admin Panel — Task Management
let adminTasksCache = [];

async function loadAdminTasks() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: tasks, error } = await db.getTasks();
        if (error) throw error;

        adminTasksCache = tasks || [];

        adminContent.innerHTML = `
            <h3>📋 Task Management</h3>
            <button onclick="showTaskForm()" class="btn-primary" style="margin: 10px 0;">➕ New Task</button>
            <div id="taskList">
                ${(tasks || []).map(task => `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${task.title}</strong><br>
                                <small>Type: ${task.type === 'telegram' ? '📢 Telegram' : '🌐 Website'} | Reward: ${task.reward} DOGE</small>
                                ${task.link ? `<br><small>Link: ${task.link}</small>` : ''}
                                ${task.chat_id ? `<br><small>Chat ID: ${task.chat_id}</small>` : ''}
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button onclick="showTaskForm(${task.id})" class="btn-secondary">✏️</button>
                                <button onclick="deleteTask(${task.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>No tasks found</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Admin tasks loading error:', error);
        adminContent.innerHTML = '<p>Failed to load tasks</p>';
    }
}

// Pass a taskId to edit an existing task; call with no argument to create a new one.
function showTaskForm(taskId) {
    const task = taskId ? adminTasksCache.find(t => t.id === taskId) : null;
    const adminContent = document.getElementById('adminContent');
    const labelStyle = 'font-size: 13px; color: var(--text-secondary); margin-bottom: -8px; font-weight: 500;';
    const inputStyle = 'padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);';
    adminContent.innerHTML = `
        <h3>${task ? '✏️ Edit Task' : '➕ New Task'}</h3>
        <form onsubmit="saveTask(event, ${task ? task.id : 'null'})" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <label style="${labelStyle}">Task Title</label>
            <input type="text" id="taskTitle" placeholder="e.g. Join our channel" required value="${task ? task.title : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Description (optional)</label>
            <textarea id="taskDesc" placeholder="Shown to users under the title"
                      style="${inputStyle}">${task ? (task.description || '') : ''}</textarea>
            <label style="${labelStyle}">Reward (DOGE)</label>
            <input type="number" id="taskReward" placeholder="e.g. 0.5" step="0.01" required value="${task ? task.reward : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Task Type</label>
            <select id="taskType" onchange="toggleChatIdField()" required
                    style="${inputStyle}">
                <option value="website" ${task && task.type === 'website' ? 'selected' : ''}>🌐 Website Visit</option>
                <option value="telegram" ${task && task.type === 'telegram' ? 'selected' : ''}>📢 Telegram Group / Channel</option>
            </select>
            <label style="${labelStyle}">Link</label>
            <input type="url" id="taskLink" placeholder="Website URL or t.me/..." required value="${task ? (task.link || '') : ''}"
                   style="${inputStyle}">
            <div id="chatIdField" style="display: ${task && task.type === 'telegram' ? 'flex' : 'none'}; flex-direction: column; gap: 8px;">
                <label style="${labelStyle}">Chat ID (required for Telegram)</label>
                <input type="text" id="taskChatId" placeholder="@channelusername or -100xxxxxxxxxx" value="${task ? (task.chat_id || '') : ''}"
                       style="${inputStyle} width: 100%;">
                <small style="color: var(--text-secondary); font-size: 12px; display: block;">
                    The bot must be an admin in the group/channel. You can get the Chat ID using @userinfobot.
                </small>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminTasks()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

function toggleChatIdField() {
    const type = document.getElementById('taskType')?.value;
    const field = document.getElementById('chatIdField');
    if (field) field.style.display = type === 'telegram' ? 'block' : 'none';
}

async function saveTask(event, taskId) {
    event.preventDefault();
    const taskType = document.getElementById('taskType').value;
    const chatIdInput = document.getElementById('taskChatId');
    const chatId = chatIdInput ? chatIdInput.value.trim() : null;

    if (taskType === 'telegram' && !chatId) {
        showToast('⚠️ Chat ID is required for Telegram tasks');
        return;
    }

    const taskData = {
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDesc').value.trim(),
        reward: parseFloat(document.getElementById('taskReward').value),
        link: document.getElementById('taskLink').value.trim(),
        type: taskType,
        chat_id: taskType === 'telegram' ? chatId : null
    };

    const isEdit = taskId !== null && taskId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-tasks', isEdit
            ? { action: 'edit', taskId: taskId, task: taskData }
            : { action: 'create', task: taskData });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} task: ` + err);
            return;
        }
        showToast(isEdit ? '✅ Task updated' : '✅ Task created successfully');
        loadAdminTasks();
    } catch (error) {
        console.error('Task save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} task`);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-tasks', { action: 'delete', taskId: taskId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to delete task: ' + err);
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This task has completion history — it was deactivated instead of deleted'
            : '✅ Task deleted');
        loadAdminTasks();
    } catch (error) {
        console.error('Task deletion error:', error);
        showToast('❌ Failed to delete task');
    }
}
