// Telegram Authentication
var currentUser = null;
var telegramUser = null;

async function initAuth() {
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            telegramUser = window.Telegram.WebApp.initDataUnsafe
                ? window.Telegram.WebApp.initDataUnsafe.user
                : null;

            if (telegramUser) {
                await authenticateUser(telegramUser);
            } else {
                var testUser = {
                    id: 123456789,
                    username: 'test_user',
                    first_name: 'Test',
                    last_name: 'User'
                };
                await authenticateUser(testUser);
            }
        } else {
            var testUser2 = {
                id: 123456789,
                username: 'test_user',
                first_name: 'Test',
                last_name: 'User'
            };
            await authenticateUser(testUser2);
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Authentication failed');
    }
}

async function authenticateUser(tgUser) {
    try {
        console.log('Authenticating user:', tgUser);

        var result = await db.getUser(tgUser.id);
        var existingUser = result.data;

        if (existingUser) {
            currentUser = existingUser;

            if (
                SUPABASE_CONFIG.adminIds.includes(tgUser.id.toString()) &&
                !currentUser.is_admin
            ) {
                await db.updateUser(tgUser.id, { is_admin: true });
                currentUser.is_admin = true;
            }

            await updateUserInfo(existingUser);
            console.log('Existing user logged in:', existingUser.first_name);

            // Existing user not yet referred → try auto referral from link
            if (!currentUser.referred_by) {
                await checkReferralParam();
            }
        } else {
            var isAdmin = SUPABASE_CONFIG.adminIds.includes(tgUser.id.toString());

            var newUser = {
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

            var createResult = await db.createUser(newUser);
            var createdUser = createResult.data;
            var createError = createResult.error;

            if (createdUser) {
                currentUser = createdUser;
                await updateUserInfo(createdUser);
                console.log('New user created:', createdUser.first_name);

                // Check if came from referral link
                var startParam = null;
                if (
                    window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe
                ) {
                    startParam = window.Telegram.WebApp.initDataUnsafe.start_param || null;
                }

                if (startParam && startParam.indexOf('ref_') === 0) {
                    // Came via referral link → auto apply, no modal
                    await checkReferralParam();
                } else {
                    // No referral link → show modal for manual entry
                    showReferralModal();
                }
            } else {
                console.error('User creation error:', createError);
            }
        }

        if (currentUser && currentUser.is_admin) {
            showAdminButton();
        }

        if (currentUser && currentUser.is_banned) {
            showToast('Your account has been banned');
            return;
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showError('Authentication failed');
    }
}

function updateUserInfo(user) {
    var nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.first_name || user.username || 'User';

    var avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
        avatarEl.src = user.photo_url || 'https://via.placeholder.com/40';
    }

    var balanceEl = document.getElementById('balance');
    if (balanceEl) balanceEl.textContent = parseFloat(user.balance || 0).toFixed(2);

    var walletBalanceEl = document.getElementById('walletBalance');
    if (walletBalanceEl) {
        walletBalanceEl.textContent = parseFloat(user.balance || 0).toFixed(2);
    }

    var totalMinedEl = document.getElementById('totalMined');
    if (totalMinedEl) {
        totalMinedEl.textContent = parseFloat(user.total_mined || 0).toFixed(2) + ' DOGE';
    }

    var referralCountEls = document.querySelectorAll('#referralCount');
    for (var i = 0; i < referralCountEls.length; i++) {
        referralCountEls[i].textContent = (user.referral_count || 0) + ' users';
    }

    var completedTasksEl = document.getElementById('completedTasks');
    if (completedTasksEl) {
        completedTasksEl.textContent = (user.completed_tasks || 0) + ' tasks';
    }

    var lifetimeMiningEl = document.getElementById('lifetimeMining');
    if (lifetimeMiningEl) {
        lifetimeMiningEl.textContent = parseFloat(user.total_mined || 0).toFixed(2) + ' DOGE';
    }

    // Referral link with bot username from config
    var botUsername =
        SUPABASE_CONFIG && SUPABASE_CONFIG.botUsername
            ? SUPABASE_CONFIG.botUsername
            : 'YourBotUsername';

    var referralLinkEl = document.getElementById('referralLink');
    if (referralLinkEl) {
        referralLinkEl.value =
            'https://t.me/' + botUsername + '?start=ref_' + user.telegram_id;
    }

    var referralIdEl = document.getElementById('referralId');
    if (referralIdEl) {
        referralIdEl.value = user.telegram_id.toString();
    }

    var miningRateEl = document.getElementById('miningRate');
    if (miningRateEl) {
        var currentMiningRate = user.mining_rate || 0.01;
        miningRateEl.textContent = currentMiningRate + ' DOGE/hour';
    }
}

function showAdminButton() {
    var settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.innerHTML = '👑';
        settingsBtn.onclick = showAdminPanel;
        settingsBtn.style.color = '#ffd700';
    }
}

async function refreshUserData() {
    try {
        if (!currentUser) return;
        var result = await db.getUser(currentUser.telegram_id);
        if (result.data) {
            currentUser = result.data;
            updateUserInfo(result.data);
        }
    } catch (error) {
        console.error('User data refresh error:', error);
    }
}

function showToast(message) {
    var existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText =
        'position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);' +
        'background: rgba(0, 0, 0, 0.9); color: white; padding: 12px 20px;' +
        'border-radius: 25px; font-size: 14px; z-index: 3000;' +
        'animation: slideUp 0.3s ease; white-space: nowrap; max-width: 90%; text-align: center;';

    document.body.appendChild(toast);

    setTimeout(function () {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(function () {
            toast.remove();
        }, 300);
    }, 3000);
}

function showError(message) {
    showToast('❌ ' + message);
}
