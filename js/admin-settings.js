// Admin Panel — Global Settings
async function loadAdminSettings() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: settings, error } = await db.getSettings();
        if (error) throw error;

        if (settings) {
            adminContent.innerHTML = `
                <h3>⚙️ Settings</h3>
                <form onsubmit="updateSettings(event)" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    <label>Mining Rate (DOGE / hour)</label>
                    <input type="number" id="settingMiningRate" value="${settings.base_mining_rate}" step="0.001"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Daily Check-in Reward (DOGE)</label>
                    <input type="number" id="settingDailyReward" value="${settings.daily_checkin_reward}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Referral Reward (DOGE)</label>
                    <input type="number" id="settingReferralReward" value="${settings.referral_reward}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Minimum Withdraw — Mining Balance (DOGE)</label>
                    <input type="number" id="settingMinWithdraw" value="${settings.min_withdraw}" step="1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Withdraw Fee — Mining Balance (%)</label>
                    <input type="number" id="settingWithdrawFee" value="${settings.withdraw_fee}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Minimum Withdraw — Deposit Balance (USDT)</label>
                    <input type="number" id="settingMinWithdrawUsdt" value="${settings.min_withdraw_usdt}" step="1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <label>Withdraw Fee — Deposit Balance (%)</label>
                    <input type="number" id="settingWithdrawFeeUsdt" value="${settings.withdraw_fee_usdt}" step="0.1"
                           style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                    <button type="submit" class="btn-primary">Save Settings</button>
                </form>
                <h3 style="margin-top: 30px;">💳 USDT Wallet Addresses</h3>
                <div id="adminWalletAddresses" style="margin-top: 15px;"></div>
                <button onclick="showWalletAddressForm()" class="btn-primary" style="margin: 10px 0;">➕ Add Address</button>
            `;
            loadAdminWalletAddresses();
        }
    } catch (error) {
        console.error('Admin settings loading error:', error);
        adminContent.innerHTML = '<p>Failed to load settings</p>';
    }
}

async function updateSettings(event) {
    event.preventDefault();
    const settings = {
        base_mining_rate: parseFloat(document.getElementById('settingMiningRate').value),
        daily_checkin_reward: parseFloat(document.getElementById('settingDailyReward').value),
        referral_reward: parseFloat(document.getElementById('settingReferralReward').value),
        min_withdraw: parseFloat(document.getElementById('settingMinWithdraw').value),
        withdraw_fee: parseFloat(document.getElementById('settingWithdrawFee').value),
        min_withdraw_usdt: parseFloat(document.getElementById('settingMinWithdrawUsdt').value),
        withdraw_fee_usdt: parseFloat(document.getElementById('settingWithdrawFeeUsdt').value)
    };
    try {
        const result = await callEdgeFunction('admin-update-settings', { settings: settings });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to update settings: ' + err);
            return;
        }
        showToast('✅ Settings updated');
        loadAdminSettings();
    } catch (error) {
        console.error('Settings update error:', error);
        showToast('❌ Failed to update settings');
    }
}
