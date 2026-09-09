// Admin Panel — Core (open/close, tab switching, user management)
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
        case 'deposits': loadAdminDeposits(); break;
        case 'spinsettings': loadAdminSpinSettings(); break;
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
