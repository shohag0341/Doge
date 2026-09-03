// Referral System
let referralModalVisible = false;
let referralCodeFromURL = null;

// ============ REFERRAL MODAL ============
function showReferralModal() {
    if (!currentUser || referralModalVisible) return;
    referralModalVisible = true;
    
    // Check if referral code came from URL
    if (referralCodeFromURL) {
        document.getElementById('referralInput').value = referralCodeFromURL;
    }
    
    document.getElementById('referralModal').classList.remove('hidden');
}

function hideReferralModal() {
    document.getElementById('referralModal').classList.add('hidden');
    referralModalVisible = false;
}

// ============ CHECK URL FOR REFERRAL ============
function checkReferralParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    
    if (startParam && startParam.startsWith('ref_')) {
        referralCodeFromURL = startParam.replace('ref_', '');
        
        // If user is new and hasn't been referred yet, show modal with pre-filled ID
        if (currentUser && !currentUser.referred_by) {
            showReferralModal();
        }
    }
}

// ============ SUBMIT REFERRAL ============
async function submitReferral() {
    const referralId = document.getElementById('referralInput').value.trim();
    
    if (!referralId) {
        showToast('⚠️ Referral ID লিখুন');
        return;
    }
    
    // Check if user is trying to use their own ID
    if (referralId === currentUser.telegram_id.toString()) {
        showToast('❌ নিজের ID ব্যবহার করা যাবে না');
        return;
    }
    
    // Check if user is already referred
    if (currentUser.referred_by) {
        showToast('ℹ️ আপনি ইতিমধ্যে রেফার করেছেন');
        hideReferralModal();
        return;
    }
    
    try {
        // Check if referral ID exists
        const { data: referrer, error: fetchError } = await db.getUser(parseInt(referralId));
        
        if (referrer) {
            // Check if referrer is banned
            if (referrer.is_banned) {
                showToast('❌ এই ইউজার ব্যান করা হয়েছে');
                return;
            }
            
            // Add referral record
            await db.addReferral(referrer.telegram_id, currentUser.telegram_id);
            
            // Update current user's referred_by
            await db.updateUser(currentUser.telegram_id, {
                referred_by: referrer.telegram_id
            });
            
            // Update referrer's referral count
            await db.updateUser(referrer.telegram_id, {
                referral_count: (referrer.referral_count || 0) + 1
            });
            
            // Get referral reward from settings
            const { data: settings, error: settingsError } = await db.getSettings();
            const referralReward = settings?.referral_reward || 1;
            
            // Reward new user
            await db.updateMining(currentUser.telegram_id, referralReward);
            
            // Reward referrer
            await db.updateMining(referrer.telegram_id, referralReward);
            
            // Create transaction records
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
            
            showToast(`🎉 রেফারেল সফল! +${referralReward} DOGE পেয়েছেন`);
            hideReferralModal();
            
            // Refresh user data
            await refreshUserData();
            
        } else {
            showToast('❌ ভুল Referral ID');
        }
    } catch (error) {
        console.error('Referral error:', error);
        showToast('❌ রেফারেল প্রসেসিং এ সমস্যা হয়েছে');
    }
}

// ============ SKIP REFERRAL ============
function skipReferral() {
    hideReferralModal();
    showToast('ℹ️ রেফারেল স্কিপ করা হয়েছে');
}

// ============ COPY REFERRAL LINK ============
async function copyReferralLink() {
    const linkInput = document.getElementById('referralLink');
    const link = linkInput.value;
    
    try {
        await navigator.clipboard.writeText(link);
        showToast('✅ রেফারেল লিংক কপি হয়েছে!');
    } catch (error) {
        // Fallback for older browsers
        linkInput.select();
        document.execCommand('copy');
        showToast('✅ রেফারেল লিংক কপি হয়েছে!');
    }
}

// ============ COPY REFERRAL ID ============
async function copyReferralId() {
    const referralId = currentUser.telegram_id.toString();
    
    try {
        await navigator.clipboard.writeText(referralId);
        showToast('✅ রেফারেল ID কপি হয়েছে!');
    } catch (error) {
        // Fallback
        showToast('Referral ID: ' + referralId);
    }
}

// ============ UPDATE REFERRAL INFO ============
function updateReferralInfo(user) {
    // Update referral link
    const botUsername = window.Telegram?.WebApp?.initDataUnsafe?.user?.username || 'YourBotUsername';
    const referralLink = `https://t.me/YourBotUsername?start=ref_${user.telegram_id}`;
    
    document.getElementById('referralLink').value = referralLink;
    
    // Update referral count display
    document.getElementById('referralCount').textContent = (user.referral_count || 0) + ' জন';
}
