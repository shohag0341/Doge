// Admin Panel — Withdraw Requests
async function loadAdminWithdrawals() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: txs, error } = await supabase
            .from('transactions')
            .select(`*, users:user_id (telegram_id, first_name, username)`)
            .eq('type', 'withdraw')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const all = txs || [];
        const pending = all.filter(t => t.status === 'pending');
        const completed = all.filter(t => t.status === 'completed');
        const rejected = all.filter(t => t.status === 'rejected');

        const renderPending = (t) => `
            <div class="address-item" style="border-left: 4px solid var(--warning-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <strong>${t.users?.first_name || 'User'}</strong>
                        <small>@${t.users?.username || 'N/A'}</small><br>
                        <small>User ID: ${t.user_id}</small><br>
                        <span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: ${t.balance_source === 'deposit' ? 'var(--secondary-color)' : 'var(--primary-color)'}; color: #fff;">${t.balance_source === 'deposit' ? '🎰 Deposit balance' : '⛏️ Mining balance'}</span><br>
                        <strong>${parseFloat(t.amount).toFixed(4)} ${t.balance_source === 'deposit' ? 'USDT' : 'DOGE'}</strong>
                        <small>(fee: ${parseFloat(t.fee || 0).toFixed(4)})</small><br>
                        <small style="word-break: break-all;">Address: ${t.address || 'N/A'}</small><br>
                        <button onclick="copyAddress('${t.address}')" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; margin-top: 4px;">📋 Copy Address</button><br>
                        <small>Date: ${new Date(t.created_at).toLocaleString()}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                        <button onclick="approveWithdraw(${t.id})" class="btn-primary" style="padding: 8px 15px; font-size: 12px;">✅ Approve</button>
                        <button onclick="rejectWithdraw(${t.id})" class="btn-secondary" style="padding: 8px 15px; font-size: 12px; color: var(--danger-color);">❌ Reject</button>
                    </div>
                </div>
            </div>
        `;

        const renderDone = (t, color) => `
            <div class="address-item" style="border-left: 4px solid ${color}; opacity: 0.85;">
                <strong>${t.users?.first_name || 'User'}</strong> — ${parseFloat(t.amount).toFixed(4)} ${t.balance_source === 'deposit' ? 'USDT' : 'DOGE'}<br>
                <small style="word-break: break-all;">Address: ${t.address || 'N/A'}</small><br>
                ${t.status === 'rejected' && t.reason ? `<small style="color: var(--danger-color);">Reason: ${t.reason}</small><br>` : ''}
                <small>${new Date(t.processed_at || t.created_at).toLocaleString()}</small>
            </div>
        `;

        adminContent.innerHTML = `
            <h3>📤 Withdraw Requests</h3>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--warning-color);">⏳ Pending (${pending.length})</h4>
                ${pending.map(renderPending).join('') || '<p>No pending withdrawals</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--success-color);">✅ Completed (${completed.length})</h4>
                ${completed.slice(0, 10).map(t => renderDone(t, 'var(--success-color)')).join('') || '<p>No completed withdrawals</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--danger-color);">❌ Rejected (${rejected.length})</h4>
                ${rejected.slice(0, 10).map(t => renderDone(t, 'var(--danger-color)')).join('') || '<p>No rejected withdrawals</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Withdrawals loading error:', error);
        adminContent.innerHTML = '<p>Failed to load withdrawals</p>';
    }
}

async function approveWithdraw(transactionId) {
    if (!confirm('Confirm that you have sent this payout? This marks the withdrawal as completed.')) return;

    try {
        const result = await callEdgeFunction('admin-manage-withdrawals', { action: 'approve', transactionId: transactionId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to approve: ' + err);
            return;
        }
        showToast('✅ Withdraw approved');
        loadAdminWithdrawals();
    } catch (error) {
        console.error('Withdraw approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectWithdraw(transactionId) {
    const reason = prompt('Reason for rejecting this withdrawal (shown to the user):');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast('⚠️ A reason is required');
        return;
    }

    try {
        const result = await callEdgeFunction('admin-manage-withdrawals', { action: 'reject', transactionId: transactionId, reason: reason.trim() });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to reject: ' + err);
            return;
        }
        showToast('❌ Withdraw rejected, balance refunded');
        loadAdminWithdrawals();
    } catch (error) {
        console.error('Withdraw rejection error:', error);
        showToast('❌ Failed to reject');
    }
}
