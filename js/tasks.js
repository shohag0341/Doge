// Tasks System
let userTasks = [];
let taskCompletionInProgress = false;
const websiteTimers = {};

async function loadTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading...</p>';

    try {
        const { data: tasks, error } = await db.getTasks();
        if (error) throw error;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No tasks available</p>';
            return;
        }

        const { data: userTaskData } = await db.getUserTasks(currentUser.telegram_id);
        userTasks = userTaskData ? userTaskData.map(t => t.task_id) : [];

        const pendingTasks = tasks.filter(task => !userTasks.includes(task.id));

        if (pendingTasks.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">All tasks completed 🎉</p>';
            return;
        }

        container.innerHTML = '';

        pendingTasks.forEach(task => {
            const card = document.createElement('div');
            card.className = 'task-card';
            card.id = `task-card-${task.id}`;

            const taskType = task.type || 'website';

            if (taskType === 'telegram') {
                card.innerHTML = renderTelegramTask(task);
            } else {
                card.innerHTML = renderWebsiteTask(task);
            }

            container.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load tasks:', err);
        container.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Failed to load tasks</p>';
    }
}

function renderTelegramTask(task) {
    return `
        <div class="task-title">${escapeHtml(task.title)}</div>
        \( {task.description ? `<div class="task-description"> \){escapeHtml(task.description)}</div>` : ''}
        <div class="task-reward">💰 ${task.reward} DOGE</div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            ${task.link ? `
                <a href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer"
                   class="btn-primary" style="text-decoration: none; text-align: center;">
                    📢 Join Group / Channel
                </a>
            ` : ''}
            <button id="verify-btn-\( {task.id}" class="btn-primary" onclick="verifyTelegramTask( \){task.id})">
                ✓ Verify & Claim
            </button>
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; text-align: center;">
            Join first, then press Verify
        </p>
    `;
}

function renderWebsiteTask(task) {
    return `
        <div class="task-title">${escapeHtml(task.title)}</div>
        \( {task.description ? `<div class="task-description"> \){escapeHtml(task.description)}</div>` : ''}
        <div class="task-reward">💰 ${task.reward} DOGE</div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            ${task.link ? `
                <a href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer"
                   class="btn-primary" style="text-decoration: none; text-align: center;"
                   onclick="startWebsiteTimer(${task.id})">
                    🔗 Visit Website
                </a>
            ` : ''}
            <button id="claim-btn-${task.id}" class="btn-secondary" disabled style="opacity: 0.5;"
                    onclick="claimWebsiteTask(${task.id})">
                ⏱ Wait 10 seconds...
            </button>
        </div>
    `;
}

function startWebsiteTimer(taskId) {
    if (websiteTimers[taskId]) return;

    const btn = document.getElementById(`claim-btn-${taskId}`);
    if (!btn) return;

    let remaining = 10;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = `⏱ Wait ${remaining} seconds...`;

    websiteTimers[taskId] = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(websiteTimers[taskId]);
            delete websiteTimers[taskId];
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.className = 'btn-primary';
            btn.textContent = '✓ Claim Reward';
        } else {
            btn.textContent = `⏱ Wait ${remaining} seconds...`;
        }
    }, 1000);
}

async function claimWebsiteTask(taskId) {
    if (taskCompletionInProgress) return;

    if (websiteTimers[taskId]) {
        showToast('⚠️ Please wait for the timer to finish');
        return;
    }

    const btn = document.getElementById(`claim-btn-${taskId}`);
    if (btn && btn.disabled) {
        showToast('⚠️ Visit the website first and wait for the timer');
        return;
    }

    await completeTask(taskId);
}

async function verifyTelegramTask(taskId) {
    if (taskCompletionInProgress) return;
    taskCompletionInProgress = true;

    const btn = document.getElementById(`verify-btn-${taskId}`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Checking...';
    }

    try {
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('is_active', true)
            .single();

        if (taskError || !task) {
            showToast('❌ Task not found');
            return;
        }

        if (!task.chat_id) {
            showToast('❌ Chat ID is missing for this task');
            return;
        }

        const { data, error } = await supabase.functions.invoke('verify-telegram-join', {
            body: {
                user_id: currentUser.telegram_id,
                chat_id: task.chat_id,
                task_id: taskId
            }
        });

        if (error) {
            console.error('Edge Function error:', error);
            showToast('❌ Verification service unavailable');
            return;
        }

        if (data?.is_member === true) {
            await completeTask(taskId, true);
        } else {
            showToast('❌ You have not joined the group/channel yet');
        }
    } catch (err) {
        console.error('Telegram verification failed:', err);
        showToast('❌ Verification failed');
    } finally {
        taskCompletionInProgress = false;
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✓ Verify & Claim';
        }
    }
}

async function completeTask(taskId, alreadyVerified = false) {
    if (taskCompletionInProgress && !alreadyVerified) return;
    taskCompletionInProgress = true;

    try {
        if (userTasks.includes(taskId)) {
            showToast('ℹ️ This task is already completed');
            return;
        }

        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('is_active', true)
            .single();

        if (taskError || !task) {
            showToast('❌ Task not found');
            return;
        }

        await db.completeTask(currentUser.telegram_id, taskId);
        await db.updateMining(currentUser.telegram_id, task.reward);
        await db.updateUser(currentUser.telegram_id, {
            completed_tasks: (currentUser.completed_tasks || 0) + 1
        });
        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'task',
            amount: task.reward,
            status: 'completed',
            created_at: new Date().toISOString()
        });

        userTasks.push(taskId);
        showToast(`✅ Task completed! +${task.reward} DOGE`);

        const card = document.getElementById(`task-card-${taskId}`);
        if (card) {
            card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateX(24px)';
            setTimeout(() => {
                card.remove();
                if (document.querySelectorAll('.task-card').length === 0) {
                    const list = document.getElementById('tasksList');
                    if (list) {
                        list.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">All tasks completed 🎉</p>';
                    }
                }
            }, 350);
        }

        await refreshUserData();
    } catch (err) {
        console.error('Task completion error:', err);
        showToast('❌ Failed to complete task');
    } finally {
        taskCompletionInProgress = false;
    }
}

async function loadUserTasks() {
    try {
        const { data } = await db.getUserTasks(currentUser.telegram_id);
        userTasks = data ? data.map(t => t.task_id) : [];
    } catch (err) {
        console.error('Failed to load user tasks:', err);
    }
}

function isTaskCompleted(taskId) {
    return userTasks.includes(taskId);
}

function getCompletedTasksCount() {
    return userTasks.length;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
