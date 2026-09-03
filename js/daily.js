// Daily Check-in System
let lastCheckinDate = null;

// ============ DAILY CHECK-IN ============
async function dailyCheckin() {
    try {
        const today = new Date().toDateString();
        
        // Check if already checked in today
        if (lastCheckinDate === today) {
            showToast('✅ আজ ইতিমধ্যে চেক-ইন করেছেন');
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
        document.getElementById('dailyCheckinBtn').innerHTML = '✅ চেক-ইন সম্পন্ন';
        document.getElementById('dailyCheckinBtn').disabled = true;
        
        showToast(`🎉 দৈনিক রিওয়ার্ড! +${dailyReward} DOGE`);
        
        await refreshUserData();
        
    } catch (error) {
        console.error('Daily check-in error:', error);
        showToast('❌ চেক-ইন করতে সমস্যা হয়েছে');
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
                document.getElementById('dailyCheckinBtn').innerHTML = '✅ চেক-ইন সম্পন্ন';
                document.getElementById('dailyCheckinBtn').disabled = true;
            } else {
                document.getElementById('dailyCheckinBtn').innerHTML = 'চেক-ইন করুন';
                document.getElementById('dailyCheckinBtn').disabled = false;
            }
        } else {
            document.getElementById('dailyCheckinBtn').innerHTML = 'চেক-ইন করুন';
            document.getElementById('dailyCheckinBtn').disabled = false;
        }
    } catch (error) {
        console.error('Daily status check error:', error);
    }
}
