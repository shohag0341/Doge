// Telegram Authentication
let currentUser = null;
let telegramUser = null;

async function initAuth() {
    try {
        // Get Telegram user data
        if (window.Telegram && window.Telegram.WebApp) {
            telegramUser = window.Telegram.WebApp.initDataUnsafe?.user;
            
            if (telegramUser) {
                await authenticateUser(telegramUser);
            } else {
                // For testing without Telegram
                const testUser = {
                    id: 123456789,
                    username: 'test_user',
                    first_name: 'Test',
                    last_name: 'User'
                };
                await authenticateUser(testUser);
            }
        } else {
            // For local testing
            const testUser = {
                id: 123456789,
                username: 'test_user',
                first_name: 'Test',
                last_name: 'User'
            };
            await authenticateUser(testUser);
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Authentication failed');
    }
}

async function authenticateUser(tgUser) {
    try {
        console.log('🔍 Authenticating user:', tgUser);
        console.log('👑 Admin IDs:', SUPABASE_CONFIG.adminIds);
        console.log('📱 Current user ID:', tgUser.id.toString());
        console.log('✅ Is admin?', SUPABASE_CONFIG.adminIds.includes(tgUser.id.toString()));
        
        // Check if user exists
        const { data: existingUser, error: fetchError } = await db.getUser(tgUser.id);
        
        if (existingUser) {
            currentUser = existingUser;
            
            // Force update admin status if needed
            if (SUPABASE_CONFIG.adminIds.includes(tgUser.id.toString()) && !currentUser.is_admin) {
                await db.updateUser(tgUser.id, { is_admin: true });
                currentUser.is_admin = true;
            }
            
            await updateUserInfo(existingUser);
            console.log('✅ Existing user logged in:', existingUser.first_name);
            console.log('👑 Admin status:', currentUser.is_admin);
        } else {
            // Check if admin
            const isAdmin = SUPABASE_CONFIG.adminIds.includes(tgUser.id.toString());
            console.log('👑 New user admin status:', isAdmin);
            
            // Create new user
            const newUser = {
                telegram_id: tgUser.id,
                username: tgUser.username || '',
                first_name: tgUser.first_name || '',
                last_name: tgUser.last_name || '',
                balance: 0,
                total_mined: 0,
                daily_mined: 0,
                weekly_mined: 0,
                monthly_mined: 0,
                is_admin: isAdmin,
                created_at: new Date().toISOString()
            };
            
            const { data: createdUser, error: createError } = await db.createUser(newUser);
            
            if (createdUser) {
                currentUser = createdUser;
                await updateUserInfo(createdUser);
                console.log('✅ New user created:', createdUser.first_name);
                console.log('👑 Admin status:', createdUser.is_admin);
                
                // Show referral modal for new users
                showReferralModal();
            } else {
                console.error('User creation error:', createError);
            }
        }
        
        // Check if admin and show admin button
        if (currentUser?.is_admin) {
            console.log('✅ Admin button showing');
            showAdminButton();
        } else {
            console.log('❌ Not admin, hiding admin button');
        }
        
        // Check if banned
        if (currentUser?.is_banned) {
            showToast('⛔ আপনার অ্যাকাউন্ট ব্যান করা হয়েছে');
            return;
        }
        
        // Check referral param from URL
        checkReferralParam();
        
    } catch (error) {
        console.error('Authentication error:', error);
        showError('Authentication failed');
    }
}

function updateUserInfo(user) {
    document.getElementById('userName').textContent = user.first_name || user.username;
    document.getElementById('userAvatar').src = user.photo_url || 'https://via.placeholder.com/40';
    document.getElementById('balance').textContent = parseFloat(user.balance || 0).toFixed(2);
    document.getElementById('walletBalance').textContent = parseFloat(user.balance || 0).toFixed(2);
    document.getElementById('totalMined').textContent = parseFloat(user.total_mined || 0).toFixed(2) + ' DOGE';
    document.getElementById('referralCount').textContent = (user.referral_count || 0) + ' জন';
    document.getElementById('completedTasks').textContent = (user.completed_tasks || 0) + ' টি';
    document.getElementById('lifetimeMining').textContent = parseFloat(user.total_mined || 0).toFixed(2) + ' DOGE';
    
    // Update referral link
    document.getElementById('referralLink').value = `https://t.me/YourBotUsername?start=ref_${user.telegram_id}`;
    
    // Update referral ID
    document.getElementById('referralId').value = user.telegram_id.toString();
    
    // Update mining rate display
    const currentMiningRate = user.mining_rate || 0.01;
    document.getElementById('miningRate').textContent = currentMiningRate + ' DOGE/ঘন্টা';
}

function showAdminButton() {
    console.log('👑 Showing admin button');
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.innerHTML = '👑';
        settingsBtn.onclick = showAdminPanel;
        settingsBtn.style.color = '#ffd700';
    }
}

async function refreshUserData() {
    try {
        const { data: userData, error } = await db.getUser(currentUser.telegram_id);
        if (userData) {
            currentUser = userData;
            updateUserInfo(userData);
        }
    } catch (error) {
        console.error('User data refresh error:', error);
    }
}

// Toast Notification System
function showToast(message) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 3000;
        animation: slideUp 0.3s ease;
        white-space: nowrap;
        max-width: 90%;
        text-align: center;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    showToast('❌ ' + message);
}
