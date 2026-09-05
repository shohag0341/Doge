// Daily Check-in System
let lastCheckinDate = null;

// ============ DAILY CHECK-IN ============
// SECURITY: the reward, the once-per-day check, and the transaction
// record are now all handled server-side by the daily-checkin Edge
// Function, using the DB's last_checkin value — not the client's.
async function dailyCheckin() {
    try {
        const result = await callEdgeFunction('daily-checkin', {});

        if (!result.ok) {
            if (result.data && result.data.error === 'already_checked_in') {
                lastCheckinDate = new Date().toDateString();
                document.getElementById('dailyCheckinBtn').innerHTML = '✅ Checked In';
                document.getElementById('dailyCheckinBtn').disabled = true;
                showToast('✅ Already checked in today');
                return;
            }
            showToast('❌ Failed to check in');
            return;
        }

        const dailyReward = result.data.reward || 0;
        lastCheckinDate = new Date().toDateString();

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
