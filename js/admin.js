// Admin Panel System
let adminVisible = false;

// ============ SHOW ADMIN PANEL ============
function showAdminPanel() {
    if (!currentUser?.is_admin) {
        showToast('⛔ অ্যাক্সেস অস্বীকৃত');
        return;
    }
    
    adminVisible = true;
    document.getElementById('adminPanel').classList.remove('hidden');
    showAdminTab('users');
}

// ============ CLOSE ADMIN PANEL ============
function closeAdmin() {
    adminVisible = false;
    document.getElementById('adminPanel').classList.add('hidden');
}

// ============ SHOW ADMIN TAB ============
function showAdminTab(tab) {
    // Update active tab
    document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.remove('active');
    });
    event.target.classList.add('active');
    
    switch (tab) {
        case 'users':
            loadAdminUsers();
            break;
        case 'packages':
            loadAdminPackages();
            break;
        case 'tasks':
            loadAdminTasks();
            break;
        case 'settings':
            loadAdminSettings();
            break;
    }
}

// ============ LOAD ADMIN USERS ============
async function loadAdminUsers() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>লোড হচ্ছে...</p>';
    
    try {
        const { data: users, error } = await db.getAllUsers();
        
        if (users) {
            adminContent.innerHTML = `
                <h3>👥 ইউজার ম্যানেজমেন্ট (${users.length} জন)</h3>
                <div class="admin-search" style="margin: 15px 0;">
                    <input type="text" placeholder="ইউজার খুঁজুন..." onkeyup="searchUsers(this.value)" 
                           style="width: 100%; padding: 12px; border: 2px solid #333; border-radius: 10px; 
                                  background: var(--card-background); color: var(--text-primary);">
                </div>
                <div id="adminUserList">
                    ${users.slice(0, 50).map(user => `
                        <div class="address-item user-item">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${user.first_name} ${user.last_name || ''}</strong>
                                    <br>
                                    <small>@${user.username || 'N/A'}</small>
                                    <br>
                                    <small>ID: ${user.telegram_id}</small>
                                </div>
                                <div style="text-align: right;">
                                    <div>Balance: ${parseFloat(user.balance).toFixed(2)} DOGE</div>
                                    <div>Mined: ${parseFloat(user.total_mined).toFixed(2)} DOGE</div>
                                    <div style="margin-top: 5px;">
                                        <button onclick="toggleUserBan(${user.telegram_id}, ${!user.is_banned})" class="btn-secondary">
                                            ${user.is_banned ? '✅ আনব্যান' : '🚫 ব্যান'}
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
        adminContent.innerHTML = '<p>ইউজার লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ SEARCH USERS ============
function searchUsers(query) {
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
    });
}

// ============ TOGGLE USER BAN ============
async function toggleUserBan(userId, banStatus) {
    try {
        await db.updateUser(userId, { is_banned: banStatus });
        showToast(banStatus ? '✅ ইউজার ব্যান হয়েছে' : '✅ ইউজার আনব্যান হয়েছে');
        loadAdminUsers();
    } catch (error) {
        console.error('User ban error:', error);
        showToast('❌ অপারেশন সম্পন্ন করা যায়নি');
    }
}

// ============ LOAD ADMIN PACKAGES ============
async function loadAdminPackages() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>লোড হচ্ছে...</p>';
    
    try {
        const { data: packages, error } = await db.getPackages();
        
        adminContent.innerHTML = `
            <h3>📦 প্যাকেজ ম্যানেজমেন্ট</h3>
            <button onclick="showAddPackageForm()" class="btn-primary" style="margin: 10px 0;">
                ➕ নতুন প্যাকেজ
            </button>
            <div id="packageList">
                ${packages.map(pkg => `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${pkg.name}</strong>
                                <br>
                                <small>Price: $${pkg.price}</small>
                                <br>
                                <small>Rate: ${pkg.mining_rate}x | Duration: ${pkg.duration_days} days</small>
                                <br>
                                <small>Bonus: ${pkg.bonus_doge} DOGE</small>
                            </div>
                            <div>
                                <button onclick="deletePackage(${pkg.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>কোনো প্যাকেজ নেই</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Admin packages loading error:', error);
        adminContent.innerHTML = '<p>প্যাকেজ লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ SHOW ADD PACKAGE FORM ============
function showAddPackageForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <h3>➕ নতুন প্যাকেজ</h3>
        <form onsubmit="addPackage(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="pkgName" placeholder="প্যাকেজ নাম" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgPrice" placeholder="মূল্য ($)" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgRate" placeholder="মাইনিং রেট (x)" step="0.1" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgDuration" placeholder="সময়কাল (দিন)" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="number" id="pkgBonus" placeholder="বোনাস DOGE" step="0.01" 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="pkgDesc" placeholder="বিবরণ" 
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);"></textarea>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">সেভ করুন</button>
                <button type="button" onclick="loadAdminPackages()" class="btn-secondary">বাতিল</button>
            </div>
        </form>
    `;
}

// ============ ADD PACKAGE ============
async function addPackage(event) {
    event.preventDefault();
    
    const packageData = {
        name: document.getElementById('pkgName').value,
        price: parseFloat(document.getElementById('pkgPrice').value),
        mining_rate: parseFloat(document.getElementById('pkgRate').value),
        duration_days: parseInt(document.getElementById('pkgDuration').value),
        bonus_doge: parseFloat(document.getElementById('pkgBonus').value) || 0,
        description: document.getElementById('pkgDesc').value,
        is_active: true,
        created_at: new Date().toISOString()
    };
    
    try {
        await db.createPackage(packageData);
        showToast('✅ প্যাকেজ তৈরি হয়েছে');
        loadAdminPackages();
    } catch (error) {
        console.error('Package creation error:', error);
        showToast('❌ প্যাকেজ তৈরি করা যায়নি');
    }
}

// ============ DELETE PACKAGE ============
async function deletePackage(packageId) {
    if (!confirm('আপনি কি এই প্যাকেজটি ডিলিট করতে চান?')) return;
    
    try {
        await db.deletePackage(packageId);
        showToast('✅ প্যাকেজ ডিলিট হয়েছে');
        loadAdminPackages();
    } catch (error) {
        console.error('Package deletion error:', error);
        showToast('❌ প্যাকেজ ডিলিট করা যায়নি');
    }
}

// ============ LOAD ADMIN TASKS ============
async function loadAdminTasks() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>লোড হচ্ছে...</p>';
    
    try {
        const { data: tasks, error } = await db.getTasks();
        
        adminContent.innerHTML = `
            <h3>📋 টাস্ক ম্যানেজমেন্ট</h3>
            <button onclick="showAddTaskForm()" class="btn-primary" style="margin: 10px 0;">
                ➕ নতুন টাস্ক
            </button>
            <div id="taskList">
                ${tasks.map(task => `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${task.title}</strong>
                                <br>
                                <small>Reward: ${task.reward} DOGE</small>
                                ${task.link ? `<br><small>Link: ${task.link}</small>` : ''}
                            </div>
                            <div>
                                <button onclick="deleteTask(${task.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>কোনো টাস্ক নেই</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Admin tasks loading error:', error);
        adminContent.innerHTML = '<p>টাস্ক লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ SHOW ADD TASK FORM ============
function showAddTaskForm() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <h3>➕ নতুন টাস্ক</h3>
        <form onsubmit="addTask(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <input type="text" id="taskTitle" placeholder="টাস্ক শিরোনাম" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <textarea id="taskDesc" placeholder="বিবরণ" 
                      style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);"></textarea>
            <input type="number" id="taskReward" placeholder="রিওয়ার্ড (DOGE)" step="0.01" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="url" id="taskLink" placeholder="লিংক (ঐচ্ছিক)" 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">সেভ করুন</button>
                <button type="button" onclick="loadAdminTasks()" class="btn-secondary">বাতিল</button>
            </div>
        </form>
    `;
}

// ============ ADD TASK ============
async function addTask(event) {
    event.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDesc').value,
        reward: parseFloat(document.getElementById('taskReward').value),
        link: document.getElementById('taskLink').value,
        is_active: true,
        created_at: new Date().toISOString()
    };
    
    try {
        await db.createTask(taskData);
        showToast('✅ টাস্ক তৈরি হয়েছে');
        loadAdminTasks();
    } catch (error) {
        console.error('Task creation error:', error);
        showToast('❌ টাস্ক তৈরি করা যায়নি');
    }
}

// ============ DELETE TASK ============
async function deleteTask(taskId) {
    if (!confirm('আপনি কি এই টাস্কটি ডিলিট করতে চান?')) return;
    
    try {
        await db.deleteTask(taskId);
        showToast('✅ টাস্ক ডিলিট হয়েছে');
        loadAdminTasks();
    } catch (error) {
        console.error('Task deletion error:', error);
        showToast('❌ টাস্ক ডিলিট করা যায়নি');
    }
}

// ============ LOAD ADMIN SETTINGS ============
async function loadAdminSettings() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>লোড হচ্ছে...</p>';
    
    try {
        const { data: settings, error } = await db.getSettings();
        
        if (settings) {
            adminContent.innerHTML = `
                <h3>⚙️ সেটিংস</h3>
                <form onsubmit="updateSettings(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    <label>মাইনিং রেট (DOGE/ঘন্টা)</label>
                    <input type="number" id="settingMiningRate" value="${settings.base_mining_rate}" step="0.001" 
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    
                    <label>ডেইলি চেক-ইন রিওয়ার্ড (DOGE)</label>
                    <input type="number" id="settingDailyReward" value="${settings.daily_checkin_reward}" step="0.1" 
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    
                    <label>রেফারেল রিওয়ার্ড (DOGE)</label>
                    <input type="number" id="settingReferralReward" value="${settings.referral_reward}" step="0.1" 
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    
                    <label>ন্যূনতম উইথড্র (DOGE)</label>
                    <input type="number" id="settingMinWithdraw" value="${settings.min_withdraw}" step="1" 
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    
                    <label>উইথড্র ফি (%)</label>
                    <input type="number" id="settingWithdrawFee" value="${settings.withdraw_fee}" step="0.1" 
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    
                    <button type="submit" class="btn-primary">সেভ করুন</button>
                </form>
                
                <h3 style="margin-top: 30px;">💳 USDT Wallet Addresses</h3>
                <div id="adminWalletAddresses" style="margin-top: 15px;"></div>
                <button onclick="showAddWalletAddressForm()" class="btn-primary" style="margin: 10px 0;">
                    ➕ নতুন অ্যাড্রেস
                </button>
            `;
            
            loadAdminWalletAddresses();
        }
    } catch (error) {
        console.error('Admin settings loading error:', error);
        adminContent.innerHTML = '<p>সেটিংস লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ LOAD ADMIN WALLET ADDRESSES ============
async function loadAdminWalletAddresses() {
    try {
        const { data: addresses, error } = await db.getWalletAddresses();
        const container = document.getElementById('adminWalletAddresses');
        
        if (addresses && addresses.length > 0) {
            container.innerHTML = addresses.map(addr => `
                <div class="address-item">
                    <strong>${addr.network_name}</strong>
                    <br>
                    <small>${addr.address}</small>
                    <br>
                    <button onclick="deleteWalletAddress(${addr.id})" class="btn-secondary" style="margin-top: 5px;">🗑️</button>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p>কোনো অ্যাড্রেস নেই</p>';
        }
    } catch (error) {
        console.error('Admin wallet addresses loading error:', error);
    }
}

// ============ SHOW ADD WALLET ADDRESS FORM ============
function showAddWalletAddressForm() {
    const container = document.getElementById('adminWalletAddresses');
    container.innerHTML = `
        <form onsubmit="addWalletAddress(event)" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="walletNetwork" placeholder="নেটওয়ার্ক নাম (যেমন: BEP20)" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <input type="text" id="walletAddress" placeholder="USDT অ্যাড্রেস" required 
                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
            <button type="submit" class="btn-primary">সেভ করুন</button>
        </form>
    `;
}

// ============ ADD WALLET ADDRESS ============
async function addWalletAddress(event) {
    event.preventDefault();
    
    const addressData = {
        network_name: document.getElementById('walletNetwork').value,
        address: document.getElementById('walletAddress').value,
        is_active: true,
        created_at: new Date().toISOString()
    };
    
    try {
        await db.createWalletAddress(addressData);
        showToast('✅ অ্যাড্রেস যোগ হয়েছে');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address creation error:', error);
        showToast('❌ অ্যাড্রেস যোগ করা যায়নি');
    }
}

// ============ DELETE WALLET ADDRESS ============
async function deleteWalletAddress(addressId) {
    if (!confirm('আপনি কি এই অ্যাড্রেসটি ডিলিট করতে চান?')) return;
    
    try {
        await db.deleteWalletAddress(addressId);
        showToast('✅ অ্যাড্রেস ডিলিট হয়েছে');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address deletion error:', error);
        showToast('❌ অ্যাড্রেস ডিলিট করা যায়নি');
    }
}

// ============ UPDATE SETTINGS ============
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
        showToast('✅ সেটিংস আপডেট হয়েছে');
        loadAdminSettings();
    } catch (error) {
        console.error('Settings update error:', error);
        showToast('❌ সেটিংস আপডেট করা যায়নি');
    }
}
