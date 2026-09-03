// Tasks System
let userTasks = [];
let taskCompletionInProgress = false;

// ============ LOAD TASKS ============
async function loadTasks() {
    try {
        const tasksContainer = document.getElementById('tasksList');
        
        // Show loading state
        tasksContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">লোড হচ্ছে...</p>';
        
        // Get all active tasks
        const { data: tasks, error } = await db.getTasks();
        
        if (tasks && tasks.length > 0) {
            // Get user's completed tasks
            const { data: userTaskData, error: userTaskError } = await db.getUserTasks(currentUser.telegram_id);
            userTasks = userTaskData ? userTaskData.map(t => t.task_id) : [];
            
            tasksContainer.innerHTML = '';
            
            tasks.forEach(task => {
                const isCompleted = userTasks.includes(task.id);
                
                const taskCard = document.createElement('div');
                taskCard.className = 'task-card';
                taskCard.innerHTML = `
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    <div class="task-reward">💰 ${task.reward} DOGE</div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        ${task.link ? `
                            <a href="${task.link}" target="_blank" class="btn-primary" style="text-decoration: none; flex: 1;">
                                🔗 কমপ্লিট করুন
                            </a>
                        ` : ''}
                        
                        <button onclick="verifyTask(${task.id})" 
                                class="${isCompleted ? 'btn-secondary' : 'btn-primary'}"
                                ${isCompleted ? 'disabled' : ''}
                                style="flex: 1;">
                            ${isCompleted ? '✅ সম্পন্ন হয়েছে' : '✓ Verify'}
                        </button>
                    </div>
                `;
                
                tasksContainer.appendChild(taskCard);
            });
            
        } else {
            tasksContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">কোনো টাস্ক নেই</p>';
        }
    } catch (error) {
        console.error('Task loading error:', error);
        document.getElementById('tasksList').innerHTML = 
            '<p style="text-align: center; color: var(--danger-color);">টাস্ক লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ VERIFY TASK ============
async function verifyTask(taskId) {
    if (taskCompletionInProgress) return;
    taskCompletionInProgress = true;
    
    try {
        // Check if already completed
        if (userTasks.includes(taskId)) {
            showToast('ℹ️ এই টাস্ক ইতিমধ্যে সম্পন্ন হয়েছে');
            return;
        }
        
        // Get task details
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('is_active', true)
            .single();
        
        if (!task) {
            showToast('❌ টাস্ক পাওয়া যায়নি');
            return;
        }
        
        // Add task completion record
        await db.completeTask(currentUser.telegram_id, taskId);
        
        // Add reward to user's balance
        await db.updateMining(currentUser.telegram_id, task.reward);
        
        // Update user's completed tasks count
        await db.updateUser(currentUser.telegram_id, {
            completed_tasks: (currentUser.completed_tasks || 0) + 1
        });
        
        // Create transaction record
        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'task',
            amount: task.reward,
            status: 'completed',
            created_at: new Date().toISOString()
        });
        
        // Add to local completed tasks
        userTasks.push(taskId);
        
        showToast(`✅ টাস্ক সম্পন্ন! +${task.reward} DOGE`);
        
        // Refresh user data and tasks
        await refreshUserData();
        await loadTasks();
        
    } catch (error) {
        console.error('Task verification error:', error);
        showToast('❌ টাস্ক ভেরিফাই করা যায়নি');
    } finally {
        taskCompletionInProgress = false;
    }
}

// ============ LOAD USER TASKS ============
async function loadUserTasks() {
    try {
        const { data: tasks, error } = await db.getUserTasks(currentUser.telegram_id);
        
        if (tasks) {
            userTasks = tasks.map(t => t.task_id);
        }
    } catch (error) {
        console.error('User tasks loading error:', error);
    }
}

// ============ CHECK TASK COMPLETION STATUS ============
function isTaskCompleted(taskId) {
    return userTasks.includes(taskId);
}

// ============ GET COMPLETED TASKS COUNT ============
function getCompletedTasksCount() {
    return userTasks.length;
}
