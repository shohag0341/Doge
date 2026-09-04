// Daily Check-in System
let lastCheckinDate = null;

// ============ DAILY CHECK-IN ============
async function dailyCheckin() {
    try {
        // Refresh user data first so we check against the server's real last_checkin,
        // not just an in-memory flag that resets on page reload
        await refreshUserData();

        const today = new Date().toDateString();

        // Check if already checked in today (server-verified)
        if (currentUser?.last_checkin && new Date(currentUser.last_checkin).toDateString() === today) {
            lastCheckinDate = today;
            document.getElementById('dailyCheckinBtn').innerHTML = '✅ Checked In';
            document.getElementById('dailyCheckinBtn').disabled = true;
            showToast('✅ Already checked in today');
            return;
        }
        
        // Get daily reward from settings
        const { data: settings } = await db.getSettings();
        const dailyReward = settings?.daily_checkin_reward || 0.5;
        
        // Add daily reward
        await db.updateMining(currentUser.telegram_id, dailyReward);
        
        // Create transaction record
        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'daily_checkin',
            amount: dailyReward,
            status: 'completed',
            created_at: new Date().toISOString()
        });
        
        // Update last check-in date
        lastCheckinDate = today;
        await db.updateUser(currentUser.telegram_id, {
            last_checkin: new Date().toISOString()
        });
        
        // Update UI
        document.getElementById('dailyCheckinBtn').innerHTML = '✅ Checked In';
        document.getElementById('dailyCheckinBtn').disabled = true;
        
        showToast(`🎉 Daily Reward! +${dailyReward} DOGE`);
        
        await refreshUserData();
        
    } catch (error) {
        console.error('Daily check-in error:', error);
        showToast('❌ Failed to check in');
    }
}

// ============ CHECK DAILY STATUS ============
async function checkDailyStatus() {
    try {
        if (currentUser?.last_checkin) {
            const lastCheckin = new Date(currentUser.last_checkin);
            const today = new Date();
            
            if (lastCheckin.toDateString() === today.toDateString()) {
                lastCheckinDate = today.toDateString();
                document.getElementById('dailyCheckinBtn').innerHTML = '✅ Checked In';
                document.getElementById('dailyCheckinBtn').disabled = true;
            } else {
                document.getElementById('dailyCheckinBtn').innerHTML = 'Check-in';
                document.getElementById('dailyCheckinBtn').disabled = false;
            }
        } else {
            document.getElementById('dailyCheckinBtn').innerHTML = 'Check-in';
            document.getElementById('dailyCheckinBtn').disabled = false;
        }
    } catch (error) {
        console.error('Daily status check error:', error);
    }
}
