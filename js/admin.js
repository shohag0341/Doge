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
        await db.updateUser(userId, { is_banned: banStatus });
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



async function approvePurchase(requestId) {
    if (!confirm('Are you sure you want to approve this purchase request?')) return;

    try {
        const { data: request, error: fetchError } = await supabase
            .from('purchase_requests').select('*').eq('id', requestId).single();

        if (fetchError || !request) {
            showToast('❌ Request not found');
            return;
        }

        const { data: pkg, error: pkgError } = await supabase
            .from('packages').select('*').eq('id', request.package_id).single();

        if (pkgError || !pkg) {
            showToast('❌ Package not found');
            return;
        }

        const { data: user, error: userError } = await db.getUser(request.user_id);
        if (userError || !user) {
            showToast('❌ User not found');
            return;
        }

        // FIX (গ): if the user already has an active (non-expired)
        // package, stack the new one on top instead of overwriting it:
        // - mining_rate keeps compounding (unchanged behavior)
        // - duration is ADDED on top of the remaining time left on the
        //   current package, instead of replacing the expiry outright
        // - active_package keeps a combined name so it's visible that
        //   more than one package is stacked
        const now = Date.now();
        const existingExpiry = user.package_expiry ? new Date(user.package_expiry).getTime() : 0;
        const hasActivePackage = existingExpiry > now;

        const newMiningRate = (user.mining_rate || 0.01) * pkg.mining_rate;

        const newDurationMs = pkg.duration_days * 86400000;
        const expiryBase = hasActivePackage ? existingExpiry : now;
        const newExpiry = new Date(expiryBase + newDurationMs).toISOString();

        const newActivePackageName = (hasActivePackage && user.active_package)
            ? `${user.active_package} + ${pkg.name}`
            : pkg.name;

        await db.updateUser(request.user_id, {
            mining_rate: newMiningRate,
            active_package: newActivePackageName,
            package_expiry: newExpiry
        });

        if (pkg.bonus_doge > 0) {
            await db.updateMining(request.user_id, pkg.bonus_doge);
        }

        await supabase.from('purchase_requests')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', requestId);

        showToast('✅ Purchase approved! Package activated');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectPurchase(requestId) {
    if (!confirm('Are you sure you want to reject this purchase request?')) return;

    try {
        await supabase.from('purchase_requests')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('id', requestId);
        showToast('❌ Purchase rejected');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase rejection error:', error);
        showToast('❌ Failed to reject');
    }
}

async function loadAdminPackages() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: packages, error } = await db.getPackages();
        if (error) throw error;

        adminContent.innerHTML = `
            <h3>📦 Package Management</h3>
            <button onclick="showAddPackageForm()" class="btn-primary" style="margin: 10px 0;">➕ New Package</button>
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
                            <div>
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

function showAddPackageForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <h3>➕ New Package</h3>
        <form onsubmit="addPackage(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="pkgName" placeholder="Package name" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgPrice" placeholder="Price ($)" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgRate" placeholder="Mining rate (x)" step="0.1" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgDuration" placeholder="Duration (days)" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgBonus" placeholder="Bonus DOGE" step="0.01"
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="pkgDesc" placeholder="Description"
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);"></textarea>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminPackages()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function addPackage(event) {
    event.preventDefault();
    const packageData = {
        name: document.getElementById('pkgName').value.trim(),
        price: parseFloat(document.getElementById('pkgPrice').value),
        mining_rate: parseFloat(document.getElementById('pkgRate').value),
        duration_days: parseInt(document.getElementById('pkgDuration').value),
        bonus_doge: parseFloat(document.getElementById('pkgBonus').value) || 0,
        description: document.getElementById('pkgDesc').value.trim(),
        is_active: true,
        created_at: new Date().toISOString()
    };
    try {
        await db.createPackage(packageData);
        showToast('✅ Package created');
        loadAdminPackages();
    } catch (error) {
        console.error('Package creation error:', error);
        showToast('❌ Failed to create package');
    }
}

async function deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
        await db.deletePackage(packageId);
        showToast('✅ Package deleted');
        loadAdminPackages();
    } catch (error) {
        console.error('Package deletion error:', error);
        showToast('❌ Failed to delete package');
    }
}


async function loadAdminTasks() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: tasks, error } = await db.getTasks();
        if (error) throw error;

        adminContent.innerHTML = `
            <h3>📋 Task Management</h3>
            <button onclick="showAddTaskForm()" class="btn-primary" style="margin: 10px 0;">➕ New Task</button>
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
                            <div>
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

function showAddTaskForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <h3>➕ New Task</h3>
        <form onsubmit="addTask(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="taskTitle" placeholder="Task title" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="taskDesc" placeholder="Description (optional)"
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);"></textarea>
            <input type="number" id="taskReward" placeholder="Reward (DOGE)" step="0.01" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <label style="font-size: 14px; color: var(--text-secondary);">Task Type</label>
            <select id="taskType" onchange="toggleChatIdField()" required
                    style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <option value="website">🌐 Website Visit</option>
                <option value="telegram">📢 Telegram Group / Channel</option>
            </select>
            <input type="url" id="taskLink" placeholder="Link (website or t.me/...)" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <div id="chatIdField" style="display: none;">
                <label style="font-size: 14px; color: var(--text-secondary);">Chat ID (required for Telegram)</label>
                <input type="text" id="taskChatId" placeholder="@channelusername or -100xxxxxxxxxx"
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

async function addTask(event) {
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
        chat_id: taskType === 'telegram' ? chatId : null,
        is_active: true,
        created_at: new Date().toISOString()
    };

    try {
        await db.createTask(taskData);
        showToast('✅ Task created successfully');
        loadAdminTasks();
    } catch (error) {
        console.error('Failed to create task:', error);
        showToast('❌ Failed to create task');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
        await db.deleteTask(taskId);
        showToast('✅ Task deleted');
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
                <button onclick="showAddWalletAddressForm()" class="btn-primary" style="margin: 10px 0;">➕ Add Address</button>
            `;
            loadAdminWalletAddresses();
        }
    } catch (error) {
        console.error('Admin settings loading error:', error);
        adminContent.innerHTML = '<p>Failed to load settings</p>';
    }
}

async function loadAdminWalletAddresses() {
    try {
        const { data: addresses, error } = await db.getWalletAddresses();
        const container = document.getElementById('adminWalletAddresses');
        if (!container) return;

        if (addresses && addresses.length > 0) {
            container.innerHTML = addresses.map(addr => `
                <div class="address-item">
                    <strong>${addr.network_name}</strong><br>
                    <small>${addr.address}</small><br>
                    <button onclick="deleteWalletAddress(${addr.id})" class="btn-secondary" style="margin-top: 5px;">🗑️</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p>No addresses found</p>';
        }
    } catch (error) {
        console.error('Admin wallet addresses loading error:', error);
    }
}

function showAddWalletAddressForm() {
    const container = document.getElementById('adminWalletAddresses');
    if (!container) return;
    container.innerHTML = `
        <form onsubmit="addWalletAddress(event)" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="walletNetwork" placeholder="Network name (e.g. BEP20)" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="text" id="walletAddress" placeholder="USDT address" required
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <button type="submit" class="btn-primary">Save</button>
        </form>
    `;
}

async function addWalletAddress(event) {
    event.preventDefault();
    const addressData = {
        network_name: document.getElementById('walletNetwork').value.trim(),
        address: document.getElementById('walletAddress').value.trim(),
        is_active: true,
        created_at: new Date().toISOString()
    };
    try {
        await db.createWalletAddress(addressData);
        showToast('✅ Address added');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address creation error:', error);
        showToast('❌ Failed to add address');
    }
}

async function deleteWalletAddress(addressId) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
        await db.deleteWalletAddress(addressId);
        showToast('✅ Address deleted');
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
        await db.updateSettings(settings);
        showToast('✅ Settings updated');
        loadAdminSettings();
    } catch (error) {
        console.error('Settings update error:', error);
        showToast('❌ Failed to update settings');
    }
                }

    
