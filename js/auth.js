// Telegram Authentication
var currentUser = null;
var telegramUser = null;

async function initAuth() {
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
            // Real Telegram session — the raw initData string is what
            // gets signature-verified server-side in the Edge Function.
            await authenticateUser();
        } else {
            // No real Telegram session available (e.g. opened outside
            // Telegram, or during local development). We can no longer
            // fabricate a signed-in test user, because the server now
            // requires a real, Telegram-signed initData string.
            showError('Please open this app from Telegram');
        }
    } catch (error) {
        console.error('Auth error:', error);
        showError('Authentication failed');
    }
}

async function authenticateUser() {
    try {
        var result = await callEdgeFunction('telegram-auth', {});

        if (!result.ok) {
            if (result.data && result.data.error === 'banned') {
                currentUser = result.data.user;
                showToast('Your account has been banned');
                return;
            }
            console.error('Auth error:', result.data);
            showError('Authentication failed');
            return;
        }

        currentUser = result.data.user;
        await updateUserInfo(currentUser);
        console.log('Authenticated:', currentUser.first_name);

        if (currentUser.is_admin) {
            showAdminButton();
        }

        // Referral: prefer the server-verified start_param over the
        // client-side Telegram.WebApp.initDataUnsafe value.
        if (!currentUser.referred_by) {
            if (result.data.startParam && result.data.startParam.indexOf('ref_') === 0) {
                var refId = result.data.startParam.replace('ref_', '');
                await applyReferral(refId, true);
            } else if (result.data.isNewUser) {
                showReferralModal();
            }
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
        // Read-only, so this can stay a direct table read.
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
