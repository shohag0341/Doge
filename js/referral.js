// Referral System
var referralModalVisible = false;
var referralCodeFromURL = null;

function showReferralModal() {
    if (!currentUser || referralModalVisible) return;
    referralModalVisible = true;

    if (referralCodeFromURL) {
        var input = document.getElementById('referralInput');
        if (input) input.value = referralCodeFromURL;
    }

    document.getElementById('referralModal').classList.remove('hidden');
}

function hideReferralModal() {
    document.getElementById('referralModal').classList.add('hidden');
    referralModalVisible = false;
}

function checkReferralParam() {
    var startParam = null;

    // Telegram Mini App start param (most important)
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        startParam = window.Telegram.WebApp.initDataUnsafe.start_param || null;
    }

    // Fallback: URL query
    if (!startParam) {
        try {
            var urlParams = new URLSearchParams(window.location.search);
            startParam = urlParams.get('start') || urlParams.get('tgWebAppStartParam');
        } catch (e) {}
    }

    // Fallback: hash
    if (!startParam && window.location.hash) {
        try {
            var hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
            startParam = hashParams.get('tgWebAppStartParam') || hashParams.get('start');
        } catch (e) {}
    }

    if (startParam && startParam.indexOf('ref_') === 0) {
        referralCodeFromURL = startParam.replace('ref_', '');

        if (currentUser && !currentUser.referred_by && referralCodeFromURL) {
            // Auto apply if came from referral link
            autoApplyReferral(referralCodeFromURL);
        }
    }
}

async function autoApplyReferral(referralId) {
    if (!referralId || !currentUser) return;
    if (currentUser.referred_by) return;
    if (referralId === currentUser.telegram_id.toString()) return;

    try {
        var result = await db.getUser(parseInt(referralId, 10));
        var referrer = result.data;

        if (!referrer) return;
        if (referrer.is_banned) return;

        await db.addReferral(referrer.telegram_id, currentUser.telegram_id);

        await db.updateUser(currentUser.telegram_id, {
            referred_by: referrer.telegram_id
        });

        await db.updateUser(referrer.telegram_id, {
            referral_count: (referrer.referral_count || 0) + 1
        });

        var settingsResult = await db.getSettings();
        var settings = settingsResult.data;
        var referralReward = (settings && settings.referral_reward) ? settings.referral_reward : 1;

        await db.updateMining(currentUser.telegram_id, referralReward);
        await db.updateMining(referrer.telegram_id, referralReward);

        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'referral',
            amount: referralReward,
            status: 'completed',
            created_at: new Date().toISOString()
        });

        await db.createTransaction({
            user_id: referrer.telegram_id,
            type: 'referral',
            amount: referralReward,
            status: 'completed',
            created_at: new Date().toISOString()
        });

        currentUser.referred_by = referrer.telegram_id;
        hideReferralModal();
        showToast('Referral successful! +' + referralReward + ' DOGE');
        await refreshUserData();
    } catch (error) {
        console.error('Auto referral error:', error);
        // If auto fails, still show modal so user can enter manually
        showReferralModal();
    }
}

async function submitReferral() {
    var input = document.getElementById('referralInput');
    var referralId = input ? input.value.trim() : '';

    if (!referralId) {
        showToast('Please enter Referral ID');
        return;
    }

    if (referralId === currentUser.telegram_id.toString()) {
        showToast('You cannot use your own ID');
        return;
    }

    if (currentUser.referred_by) {
        showToast('You already used a referral');
        hideReferralModal();
        return;
    }

    try {
        var result = await db.getUser(parseInt(referralId, 10));
        var referrer = result.data;

        if (!referrer) {
            showToast('Invalid Referral ID');
            return;
        }

        if (referrer.is_banned) {
            showToast('This user is banned');
            return;
        }

        await db.addReferral(referrer.telegram_id, currentUser.telegram_id);

        await db.updateUser(currentUser.telegram_id, {
            referred_by: referrer.telegram_id
        });

        await db.updateUser(referrer.telegram_id, {
            referral_count: (referrer.referral_count || 0) + 1
        });

        var settingsResult = await db.getSettings();
        var settings = settingsResult.data;
        var referralReward = (settings && settings.referral_reward) ? settings.referral_reward : 1;

        await db.updateMining(currentUser.telegram_id, referralReward);
        await db.updateMining(referrer.telegram_id, referralReward);

        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'referral',
            amount: referralReward,
            status: 'completed',
            created_at: new Date().toISOString()
        });

        await db.createTransaction({
            user_id: referrer.telegram_id,
            type: 'referral',
            amount: referralReward,
            status: 'completed',
            created_at: new Date().toISOString()
        });

        currentUser.referred_by = referrer.telegram_id;
        showToast('Referral successful! +' + referralReward + ' DOGE');
        hideReferralModal();
        await refreshUserData();
    } catch (error) {
        console.error('Referral error:', error);
        showToast('Referral processing failed');
    }
}

function skipReferral() {
    hideReferralModal();
    showToast('Referral skipped');
}

async function copyReferralLink() {
    var linkInput = document.getElementById('referralLink');
    var link = linkInput ? linkInput.value : '';

    try {
        await navigator.clipboard.writeText(link);
        showToast('Referral link copied!');
    } catch (error) {
        if (linkInput) {
            linkInput.select();
            document.execCommand('copy');
        }
        showToast('Referral link copied!');
    }
}

async function copyReferralId() {
    var referralId = currentUser.telegram_id.toString();

    try {
        await navigator.clipboard.writeText(referralId);
        showToast('Referral ID copied!');
    } catch (error) {
        showToast('Referral ID: ' + referralId);
    }
}

function updateReferralInfo(user) {
    var botUsername = (SUPABASE_CONFIG && SUPABASE_CONFIG.botUsername) ? SUPABASE_CONFIG.botUsername : 'YourBotUsername';
    var referralLink = 'https://t.me/' + botUsername + '?start=ref_' + user.telegram_id;

    var linkEl = document.getElementById('referralLink');
    if (linkEl) linkEl.value = referralLink;

    var countEls = document.querySelectorAll('#referralCount');
    for (var i = 0; i < countEls.length; i++) {
        countEls[i].textContent = (user.referral_count || 0) + ' users';
    }
}

function getReferralLink(userId) {
    var botUsername = (SUPABASE_CONFIG && SUPABASE_CONFIG.botUsername) ? SUPABASE_CONFIG.botUsername : 'YourBotUsername';
    return 'https://t.me/' + botUsername + '?start=ref_' + userId;
}
