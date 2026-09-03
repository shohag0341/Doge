// Referral System
var referralModalVisible = false;
var referralCodeFromURL = null;

function showReferralModal() {
    if (!currentUser || referralModalVisible) return;
    if (currentUser.referred_by) return;

    referralModalVisible = true;

    if (referralCodeFromURL) {
        var input = document.getElementById('referralInput');
        if (input) input.value = referralCodeFromURL;
    }

    var modal = document.getElementById('referralModal');
    if (modal) modal.classList.remove('hidden');
}

function hideReferralModal() {
    var modal = document.getElementById('referralModal');
    if (modal) modal.classList.add('hidden');
    referralModalVisible = false;
}

function getStartParam() {
    var startParam = null;

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        startParam = window.Telegram.WebApp.initDataUnsafe.start_param || null;
    }

    if (!startParam) {
        try {
            var urlParams = new URLSearchParams(window.location.search);
            startParam = urlParams.get('start') || urlParams.get('tgWebAppStartParam');
        } catch (e) {}
    }

    if (!startParam && window.location.hash) {
        try {
            var hash = window.location.hash.replace(/^#/, '');
            var hashParams = new URLSearchParams(hash);
            startParam = hashParams.get('tgWebAppStartParam') || hashParams.get('start');
        } catch (e) {}
    }

    return startParam;
}

async function checkReferralParam() {
    var startParam = getStartParam();

    if (startParam && startParam.indexOf('ref_') === 0) {
        referralCodeFromURL = startParam.replace('ref_', '');

        if (currentUser && !currentUser.referred_by && referralCodeFromURL) {
            var ok = await applyReferral(referralCodeFromURL, true);
            if (!ok) {
                showReferralModal();
            }
        }
    }
}

async function applyReferral(referralId, isAuto) {
    if (!referralId || !currentUser) return false;

    referralId = String(referralId).trim();

    if (referralId === String(currentUser.telegram_id)) {
        if (!isAuto) showToast('You cannot use your own ID');
        return false;
    }

    if (currentUser.referred_by) {
        if (!isAuto) showToast('You already used a referral');
        hideReferralModal();
        updateEnterReferralBox();
        return true;
    }

    try {
        var refResult = await db.getUser(parseInt(referralId, 10));
        var referrer = refResult.data;

        if (!referrer) {
            if (!isAuto) showToast('Invalid Referral ID');
            return false;
        }

        if (referrer.is_banned) {
            if (!isAuto) showToast('This user is banned');
            return false;
        }

        var addResult = await db.addReferral(referrer.telegram_id, currentUser.telegram_id);
        if (addResult && addResult.error) {
            console.error('addReferral error:', addResult.error);
        }

        await db.updateUser(currentUser.telegram_id, {
            referred_by: referrer.telegram_id
        });

        var newCount = (referrer.referral_count || 0) + 1;
        await db.updateUser(referrer.telegram_id, {
            referral_count: newCount
        });

        var settingsResult = await db.getSettings();
        var settings = settingsResult.data;
        var reward = (settings && settings.referral_reward != null)
            ? parseFloat(settings.referral_reward)
            : 1;

        if (reward > 0) {
            await db.updateMining(currentUser.telegram_id, reward);
            await db.updateMining(referrer.telegram_id, reward);

            await db.createTransaction({
                user_id: currentUser.telegram_id,
                type: 'referral',
                amount: reward,
                status: 'completed',
                created_at: new Date().toISOString()
            });

            await db.createTransaction({
                user_id: referrer.telegram_id,
                type: 'referral',
                amount: reward,
                status: 'completed',
                created_at: new Date().toISOString()
            });
        }

        currentUser.referred_by = referrer.telegram_id;
        hideReferralModal();
        updateEnterReferralBox();
        showToast('Referral successful! +' + reward + ' DOGE');
        await refreshUserData();
        await loadReferralList();
        return true;
    } catch (error) {
        console.error('Referral apply error:', error);
        if (!isAuto) showToast('Referral failed');
        return false;
    }
}

async function submitReferral() {
    var input = document.getElementById('referralInput');
    var referralId = input ? input.value.trim() : '';

    if (!referralId) {
        showToast('Please enter Referral ID');
        return;
    }

    await applyReferral(referralId, false);
}

async function submitHomeReferral() {
    var input = document.getElementById('homeReferralInput');
    var referralId = input ? input.value.trim() : '';

    if (!referralId) {
        showToast('Please enter Referral ID');
        return;
    }

    var ok = await applyReferral(referralId, false);
    if (ok && input) {
        input.value = '';
    }
}

function skipReferral() {
    hideReferralModal();
    updateEnterReferralBox();
    showToast('Referral skipped');
}

async function copyReferralLink() {
    var linkInput = document.getElementById('referralLink');
    var link = linkInput ? linkInput.value : '';

    try {
        await navigator.clipboard.writeText(link);
        showToast('Referral link copied!');
    } catch (e) {
        if (linkInput) {
            linkInput.select();
            document.execCommand('copy');
        }
        showToast('Referral link copied!');
    }
}

async function copyReferralId() {
    if (!currentUser) return;
    var referralId = String(currentUser.telegram_id);

    try {
        await navigator.clipboard.writeText(referralId);
        showToast('Referral ID copied!');
    } catch (e) {
        showToast('Referral ID: ' + referralId);
    }
}

function updateReferralInfo(user) {
    if (!user) return;

    var botUsername =
        SUPABASE_CONFIG && SUPABASE_CONFIG.botUsername
            ? SUPABASE_CONFIG.botUsername
            : 'YourBotUsername';

    var linkEl = document.getElementById('referralLink');
    if (linkEl) {
        linkEl.value = 'https://t.me/' + botUsername + '?start=ref_' + user.telegram_id;
    }

    var idEl = document.getElementById('referralId');
    if (idEl) idEl.value = String(user.telegram_id);

    var countEls = document.querySelectorAll('#referralCount');
    for (var i = 0; i < countEls.length; i++) {
        countEls[i].textContent = String(user.referral_count || 0);
    }

    loadReferralExtras();
    updateEnterReferralBox();
}

function updateEnterReferralBox() {
    var box = document.getElementById('enterReferralBox');
    if (!box) return;

    if (currentUser && !currentUser.referred_by) {
        box.classList.remove('hidden');
    } else {
        box.classList.add('hidden');
    }
}

async function loadReferralExtras() {
    try {
        var settingsResult = await db.getSettings();
        var settings = settingsResult.data;
        var reward = (settings && settings.referral_reward != null)
            ? settings.referral_reward
            : 1;

        var rewardEl = document.getElementById('referralRewardDisplay');
        if (rewardEl) rewardEl.textContent = reward;

        await loadReferralList();
    } catch (e) {
        console.error('loadReferralExtras error:', e);
    }
}

async function loadReferralList() {
    var listEl = document.getElementById('referralList');
    if (!listEl || !currentUser) return;

    listEl.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 13px;">Loading...</p>';

    try {
        var refResult = await db.getReferrals(currentUser.telegram_id);
        var rows = refResult.data || [];

        if (!rows.length) {
            listEl.innerHTML =
                '<p style="text-align: center; color: var(--text-secondary); font-size: 13px;">No referrals yet. Share your link!</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var referredId = row.referred_id;

            var userResult = await db.getUser(referredId);
            var u = userResult.data;

            var name = 'User';
            var username = '';
            if (u) {
                name = u.first_name || u.username || 'User';
                username = u.username ? '@' + u.username : '';
            }

            html +=
                '<div class="address-item" style="margin-bottom: 8px;">' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<div>' +
                '<strong>' + escapeReferralHtml(name) + '</strong> ' +
                '<small>' + escapeReferralHtml(username) + '</small><br>' +
                '<small style="color: var(--text-secondary);">ID: ' + referredId + '</small>' +
                '</div>' +
                '<div style="color: var(--success-color); font-size: 12px;">Joined</div>' +
                '</div></div>';
        }

        listEl.innerHTML = html;

        var countEls = document.querySelectorAll('#referralCount');
        for (var j = 0; j < countEls.length; j++) {
            countEls[j].textContent = String(rows.length);
        }
    } catch (e) {
        console.error('loadReferralList error:', e);
        listEl.innerHTML =
            '<p style="text-align: center; color: var(--danger-color); font-size: 13px;">Failed to load list</p>';
    }
}

function escapeReferralHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getReferralLink(userId) {
    var botUsername =
        SUPABASE_CONFIG && SUPABASE_CONFIG.botUsername
            ? SUPABASE_CONFIG.botUsername
            : 'YourBotUsername';
    return 'https://t.me/' + botUsername + '?start=ref_' + userId;
}
