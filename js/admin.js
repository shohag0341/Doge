// Admin Panel System
let adminVisible = false;

function showAdminPanel() {
    if (!currentUser?.is_admin) {
        showToast('⛔ Access denied');
        return;
    }
    adminVisible = true;
    document.getElementById('adminPanel').classList.remove('hidden');
    showAdminTab('users');
}

function closeAdmin() {
    adminVisible = false;
    document.getElementById('adminPanel').classList.add('hidden');
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    switch (tab) {
        case 'users': loadAdminUsers(); break;
        case 'packages': loadAdminPackages(); break;
        case 'tasks': loadAdminTasks(); break;
        case 'requests': loadPurchaseRequests(); break;
        case 'withdrawals': loadAdminWithdrawals(); break;
        case 'settings': loadAdminSettings(); break;
    }
}

async function loadAdminUsers() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: users, error } = await db.getAllUsers();
        if (error) throw error;

        if (users) {
            adminContent.innerHTML = `
                <h3>👥 User Management (${users.length})</h3>
                <div class="admin-search" style="margin: 15px 0;">
                    <input type="text" placeholder="Search users..." onkeyup="searchUsers(this.value)"
                           style="width: 100%; padding: 12px; border: 2px solid #333; border-radius: 10px;
                                  background: var(--card-background); color: var(--text-primary);">
                </div>
                <div id="adminUserList">
                    ${users.slice(0, 50).map(user => `
                        <div class="address-item user-item">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${user.first_name || ''} ${user.last_name || ''}</strong><br>
                                    <small>@${user.username || 'N/A'}</small><br>
                                    <small>ID: ${user.telegram_id}</small>
                                </div>
                                <div style="text-align: right;">
                                    <div>Balance: ${parseFloat(user.balance || 0).toFixed(2)} DOGE</div>
                                    <div>Mined: ${parseFloat(user.total_mined || 0).toFixed(2)} DOGE</div>
                                    <div style="margin-top: 5px;">
                                        <button onclick="toggleUserBan(${user.telegram_id}, ${!user.is_banned})" class="btn-secondary">
                                            ${user.is_banned ? '✅ Unban' : '🚫 Ban'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Admin users loading error:', error);
        adminContent.innerHTML = '<p>Failed to load users</p>';
    }
}

function searchUsers(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('.user-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? 'block' : 'none';
    });
}

async function toggleUserBan(userId, banStatus) {
    try {
        const result = await callEdgeFunction('admin-toggle-ban', { userId: userId, banStatus: banStatus });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Operation failed: ' + err);
            return;
        }
        showToast(banStatus ? '✅ User banned' : '✅ User unbanned');
        loadAdminUsers();
    } catch (error) {
        console.error('User ban error:', error);
        showToast('❌ Operation failed');
    }
}

async function loadPurchaseRequests() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: requests, error } = await supabase
            .from('purchase_requests')
            .select(`*, users:user_id (telegram_id, first_name, username), packages:package_id (name, price, mining_rate, duration_days)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (requests && requests.length > 0) {
            const pending = requests.filter(r => r.status === 'pending');
            const approved = requests.filter(r => r.status === 'approved');
            const rejected = requests.filter(r => r.status === 'rejected');

            adminContent.innerHTML = `
                <h3>💳 Purchase Requests</h3>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--warning-color);">⏳ Pending (${pending.length})</h4>
                    ${pending.map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div style="flex: 1;">
                                    <strong>${req.users?.first_name || 'User'}</strong>
                                    <small>@${req.users?.username || 'N/A'}</small><br>
                                    <small>User ID: ${req.user_id}</small><br>
                                    <strong>Package: ${req.packages?.name || 'N/A'}</strong><br>
                                    <small>Price: $${req.package_price}</small><br>
                                    <small style="word-break: break-all;">Reference: ${req.reference_id}</small>
                                    ${req.tx_hash ? `<br><small style="word-break: break-all;">Tx Hash: ${req.tx_hash}</small>` : ''}<br>
                                    <small>Date: ${new Date(req.created_at).toLocaleString()}</small>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                                    <button onclick="approvePurchase(${req.id})" class="btn-primary" style="padding: 8px 15px; font-size: 12px;">✅ Approve</button>
                                    <button onclick="rejectPurchase(${req.id})" class="btn-secondary" style="padding: 8px 15px; font-size: 12px; color: var(--danger-color);">❌ Reject</button>
                                </div>
                            </div>
                        </div>
                    `).join('') || '<p>No pending requests</p>'}
                </div>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--success-color);">✅ Approved (${approved.length})</h4>
                    ${approved.slice(0, 10).map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--success-color); opacity: 0.7;">
                            <strong>${req.users?.first_name || 'User'}</strong> - ${req.packages?.name || 'N/A'}<br>
                            <small>Approved: ${new Date(req.updated_at || req.created_at).toLocaleString()}</small>
                        </div>
                    `).join('') || '<p>No approved requests</p>'}
                </div>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--danger-color);">❌ Rejected (${rejected.length})</h4>
                    ${rejected.slice(0, 10).map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--danger-color); opacity: 0.7;">
                            <strong>${req.users?.first_name || 'User'}</strong> - ${req.packages?.name || 'N/A'}<br>
                            <small>Rejected: ${new Date(req.updated_at || req.created_at).toLocaleString()}</small>
                        </div>
                    `).join('') || '<p>No rejected requests</p>'}
                </div>
            `;
        } else {
            adminContent.innerHTML = '<p>No purchase requests</p>';
        }
    } catch (error) {
        console.error('Purchase requests loading error:', error);
        adminContent.innerHTML = '<p>Failed to load purchase requests</p>';
    }
}



async function loadAdminWithdrawals() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: txs, error } = await supabase
            .from('transactions')
            .select(`*, users:user_id (telegram_id, first_name, username)`)
            .eq('type', 'withdraw')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const all = txs || [];
        const pending = all.filter(t => t.status === 'pending');
        const completed = all.filter(t => t.status === 'completed');
        const rejected = all.filter(t => t.status === 'rejected');

        const renderPending = (t) => `
            <div class="address-item" style="border-left: 4px solid var(--warning-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <strong>${t.users?.first_name || 'User'}</strong>
                        <small>@${t.users?.username || 'N/A'}</small><br>
                        <small>User ID: ${t.user_id}</small><br>
                        <strong>${parseFloat(t.amount).toFixed(4)} DOGE</strong>
                        <small>(fee: ${parseFloat(t.fee || 0).toFixed(4)})</small><br>
                        <small style="word-break: break-all;">Address: ${t.address || 'N/A'}</small><br>
                        <button onclick="copyAddress('${t.address}')" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; margin-top: 4px;">📋 Copy Address</button><br>
                        <small>Date: ${new Date(t.created_at).toLocaleString()}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                        <button onclick="approveWithdraw(${t.id})" class="btn-primary" style="padding: 8px 15px; font-size: 12px;">✅ Approve</button>
                        <button onclick="rejectWithdraw(${t.id})" class="btn-secondary" style="padding: 8px 15px; font-size: 12px; color: var(--danger-color);">❌ Reject</button>
                    </div>
                </div>
            </div>
        `;

        const renderDone = (t, color) => `
            <div class="address-item" style="border-left: 4px solid ${color}; opacity: 0.85;">
                <strong>${t.users?.first_name || 'User'}</strong> — ${parseFloat(t.amount).toFixed(4)} DOGE<br>
                <small style="word-break: break-all;">Address: ${t.address || 'N/A'}</small><br>
                ${t.status === 'rejected' && t.reason ? `<small style="color: var(--danger-color);">Reason: ${t.reason}</small><br>` : ''}
                <small>${new Date(t.processed_at || t.created_at).toLocaleString()}</small>
            </div>
        `;

        adminContent.innerHTML = `
            <h3>📤 Withdraw Requests</h3>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--warning-color);">⏳ Pending (${pending.length})</h4>
                ${pending.map(renderPending).join('') || '<p>No pending withdrawals</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--success-color);">✅ Completed (${completed.length})</h4>
                ${completed.slice(0, 10).map(t => renderDone(t, 'var(--success-color)')).join('') || '<p>No completed withdrawals</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--danger-color);">❌ Rejected (${rejected.length})</h4>
                ${rejected.slice(0, 10).map(t => renderDone(t, 'var(--danger-color)')).join('') || '<p>No rejected withdrawals</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Withdrawals loading error:', error);
        adminContent.innerHTML = '<p>Failed to load withdrawals</p>';
    }
}

async function approveWithdraw(transactionId) {
    if (!confirm('Confirm that you have sent this payout? This marks the withdrawal as completed.')) return;

    try {
        const result = await callEdgeFunction('admin-manage-withdrawals', { action: 'approve', transactionId: transactionId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to approve: ' + err);
            return;
        }
        showToast('✅ Withdraw approved');
        loadAdminWithdrawals();
    } catch (error) {
        console.error('Withdraw approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectWithdraw(transactionId) {
    const reason = prompt('Reason for rejecting this withdrawal (shown to the user):');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast('⚠️ A reason is required');
        return;
    }

    try {
        const result = await callEdgeFunction('admin-manage-withdrawals', { action: 'reject', transactionId: transactionId, reason: reason.trim() });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to reject: ' + err);
            return;
        }
        showToast('❌ Withdraw rejected, balance refunded');
        loadAdminWithdrawals();
    } catch (error) {
        console.error('Withdraw rejection error:', error);
        showToast('❌ Failed to reject');
    }
}

// SECURITY: admin status is now checked server-side inside the Edge
// Function (against the ADMIN_TELEGRAM_IDS secret), not just by this
// panel being reachable in the browser. Package stacking (FIX গ) also
// now happens via user_packages + sync_user_mining_rate() in the DB.
async function approvePurchase(requestId) {
    if (!confirm('Are you sure you want to approve this purchase request?')) return;

    try {
        const result = await callEdgeFunction('admin-approve-purchase', { requestId: requestId });

        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to approve: ' + err);
            return;
        }

        showToast('✅ Purchase approved! Package activated');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectPurchase(requestId) {
    if (!confirm('Are you sure you want to reject this purchase request?')) return;
    const reason = prompt('Reason for rejecting (optional, shown to the user):') || '';

    try {
        const result = await callEdgeFunction('admin-reject-purchase', { requestId: requestId, reason: reason.trim() });

        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to reject: ' + err);
            return;
        }

        showToast('❌ Purchase rejected');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase rejection error:', error);
        showToast('❌ Failed to reject');
    }
}

let adminPackagesCache = [];

async function loadAdminPackages() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: packages, error } = await db.getPackages();
        if (error) throw error;

        adminPackagesCache = packages || [];

        adminContent.innerHTML = `
            <h3>📦 Package Management</h3>
            <button onclick="showPackageForm()" class="btn-primary" style="margin: 10px 0;">➕ New Package</button>
            <div id="packageList">
                ${(packages || []).map(pkg => `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${pkg.name}</strong><br>
                                <small>Price: $${pkg.price}</small><br>
                                <small>Rate: ${pkg.mining_rate}x | Duration: ${pkg.duration_days} days</small><br>
                                <small>Bonus: ${pkg.bonus_doge || 0} DOGE</small>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button onclick="showPackageForm(${pkg.id})" class="btn-secondary">✏️</button>
                                <button onclick="deletePackage(${pkg.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>No packages found</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Admin packages loading error:', error);
        adminContent.innerHTML = '<p>Failed to load packages</p>';
    }
}

// Pass a packageId to edit an existing package; call with no argument to create a new one.
function showPackageForm(packageId) {
    const pkg = packageId ? adminPackagesCache.find(p => p.id === packageId) : null;
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <h3>${pkg ? '✏️ Edit Package' : '➕ New Package'}</h3>
        <form onsubmit="savePackage(event, ${pkg ? pkg.id : 'null'})" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="pkgName" placeholder="Package name" required value="${pkg ? pkg.name : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgPrice" placeholder="Price ($)" required value="${pkg ? pkg.price : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgRate" placeholder="Mining rate (x)" step="0.1" required value="${pkg ? pkg.mining_rate : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgDuration" placeholder="Duration (days)" required value="${pkg ? pkg.duration_days : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgBonus" placeholder="Bonus DOGE" step="0.01" value="${pkg ? (pkg.bonus_doge || 0) : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="pkgDesc" placeholder="Description"
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">${pkg ? (pkg.description || '') : ''}</textarea>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminPackages()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function savePackage(event, packageId) {
    event.preventDefault();
    const packageData = {
        name: document.getElementById('pkgName').value.trim(),
        price: parseFloat(document.getElementById('pkgPrice').value),
        mining_rate: parseFloat(document.getElementById('pkgRate').value),
        duration_days: parseInt(document.getElementById('pkgDuration').value),
        bonus_doge: parseFloat(document.getElementById('pkgBonus').value) || 0,
        description: document.getElementById('pkgDesc').value.trim()
    };
    const isEdit = packageId !== null && packageId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-packages', isEdit
            ? { action: 'edit', packageId: packageId, package: packageData }
            : { action: 'create', package: packageData });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} package: ` + err);
            return;
        }
        showToast(isEdit ? '✅ Package updated' : '✅ Package created');
        loadAdminPackages();
    } catch (error) {
        console.error('Package save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} package`);
    }
}

async function deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-packages', { action: 'delete', packageId: packageId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to delete package: ' + err);
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This package has purchase history — it was deactivated instead of deleted'
            : '✅ Package deleted');
        loadAdminPackages();
    } catch (error) {
        console.error('Package deletion error:', error);
        showToast('❌ Failed to delete package');
    }
}


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
    adminContent.innerHTML = `
        <h3>${task ? '✏️ Edit Task' : '➕ New Task'}</h3>
        <form onsubmit="saveTask(event, ${task ? task.id : 'null'})" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="taskTitle" placeholder="Task title" required value="${task ? task.title : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="taskDesc" placeholder="Description (optional)"
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">${task ? (task.description || '') : ''}</textarea>
            <input type="number" id="taskReward" placeholder="Reward (DOGE)" step="0.01" required value="${task ? task.reward : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <label style="font-size: 14px; color: var(--text-secondary);">Task Type</label>
            <select id="taskType" onchange="toggleChatIdField()" required
                    style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <option value="website" ${task && task.type === 'website' ? 'selected' : ''}>🌐 Website Visit</option>
                <option value="telegram" ${task && task.type === 'telegram' ? 'selected' : ''}>📢 Telegram Group / Channel</option>
            </select>
            <input type="url" id="taskLink" placeholder="Link (website or t.me/...)" required value="${task ? (task.link || '') : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <div id="chatIdField" style="display: ${task && task.type === 'telegram' ? 'block' : 'none'};">
                <label style="font-size: 14px; color: var(--text-secondary);">Chat ID (required for Telegram)</label>
                <input type="text" id="taskChatId" placeholder="@channelusername or -100xxxxxxxxxx" value="${task ? (task.chat_id || '') : ''}"
                       style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary); width: 100%;">
                <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 6px;">
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

async function loadAdminSettings() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: settings, error } = await db.getSettings();
        if (error) throw error;

        if (settings) {
            adminContent.innerHTML = `
                <h3>⚙️ Settings</h3>
                <form onsubmit="updateSettings(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    <label>Mining Rate (DOGE / hour)</label>
                    <input type="number" id="settingMiningRate" value="${settings.base_mining_rate}" step="0.001"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Daily Check-in Reward (DOGE)</label>
                    <input type="number" id="settingDailyReward" value="${settings.daily_checkin_reward}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Referral Reward (DOGE)</label>
                    <input type="number" id="settingReferralReward" value="${settings.referral_reward}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Minimum Withdraw (DOGE)</label>
                    <input type="number" id="settingMinWithdraw" value="${settings.min_withdraw}" step="1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Withdraw Fee (%)</label>
                    <input type="number" id="settingWithdrawFee" value="${settings.withdraw_fee}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <button type="submit" class="btn-primary">Save Settings</button>
                </form>
                <h3 style="margin-top: 30px;">💳 USDT Wallet Addresses</h3>
                <div id="adminWalletAddresses" style="margin-top: 15px;"></div>
                <button onclick="showWalletAddressForm()" class="btn-primary" style="margin: 10px 0;">➕ Add Address</button>
            `;
            loadAdminWalletAddresses();
        }
    } catch (error) {
        console.error('Admin settings loading error:', error);
        adminContent.innerHTML = '<p>Failed to load settings</p>';
    }
}

let adminWalletCache = [];

async function loadAdminWalletAddresses() {
    try {
        const { data: addresses, error } = await db.getWalletAddresses();
        const container = document.getElementById('adminWalletAddresses');
        if (!container) return;

        adminWalletCache = addresses || [];

        if (addresses && addresses.length > 0) {
            container.innerHTML = addresses.map(addr => `
                <div class="address-item">
                    <strong>${addr.network_name}</strong><br>
                    <small>${addr.address}</small><br>
                    <div style="display: flex; gap: 6px; margin-top: 5px;">
                        <button onclick="showWalletAddressForm(${addr.id})" class="btn-secondary">✏️</button>
                        <button onclick="deleteWalletAddress(${addr.id})" class="btn-secondary">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p>No addresses found</p>';
        }
    } catch (error) {
        console.error('Admin wallet addresses loading error:', error);
    }
}

// Pass an addressId to edit an existing address; call with no argument to add a new one.
function showWalletAddressForm(addressId) {
    const addr = addressId ? adminWalletCache.find(a => a.id === addressId) : null;
    const container = document.getElementById('adminWalletAddresses');
    if (!container) return;
    container.innerHTML = `
        <form onsubmit="saveWalletAddress(event, ${addr ? addr.id : 'null'})" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="walletNetwork" placeholder="Network name (e.g. BEP20)" required value="${addr ? addr.network_name : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="text" id="walletAddress" placeholder="USDT address" required value="${addr ? addr.address : ''}"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminWalletAddresses()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function saveWalletAddress(event, addressId) {
    event.preventDefault();
    const addressData = {
        network_name: document.getElementById('walletNetwork').value.trim(),
        address: document.getElementById('walletAddress').value.trim()
    };
    const isEdit = addressId !== null && addressId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-wallet', isEdit
            ? { action: 'edit', addressId: addressId, wallet: addressData }
            : { action: 'create', wallet: addressData });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast(`❌ Failed to ${isEdit ? 'update' : 'add'} address: ` + err);
            return;
        }
        showToast(isEdit ? '✅ Address updated' : '✅ Address added');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'add'} address`);
    }
}

async function deleteWalletAddress(addressId) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-wallet', { action: 'delete', addressId: addressId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to delete address: ' + err);
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This address is referenced elsewhere — it was deactivated instead of deleted'
            : '✅ Address deleted');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address deletion error:', error);
        showToast('❌ Failed to delete address');
    }
}

async function updateSettings(event) {
    event.preventDefault();
    const settings = {
        base_mining_rate: parseFloat(document.getElementById('settingMiningRate').value),
        daily_checkin_reward: parseFloat(document.getElementById('settingDailyReward').value),
        referral_reward: parseFloat(document.getElementById('settingReferralReward').value),
        min_withdraw: parseFloat(document.getElementById('settingMinWithdraw').value),
        withdraw_fee: parseFloat(document.getElementById('settingWithdrawFee').value)
    };
    try {
        const result = await callEdgeFunction('admin-update-settings', { settings: settings });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to update settings: ' + err);
            return;
        }
        showToast('✅ Settings updated');
        loadAdminSettings();
    } catch (error) {
        console.error('Settings update error:', error);
        showToast('❌ Failed to update settings');
    }
    }
