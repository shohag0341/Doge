// Admin Panel — Deposit Requests
async function loadAdminDeposits() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: requests, error } = await supabase
            .from('deposit_requests')
            .select(`*, users:user_id (telegram_id, first_name, username)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const all = requests || [];
        const pending = all.filter(r => r.status === 'pending');
        const approved = all.filter(r => r.status === 'approved');
        const rejected = all.filter(r => r.status === 'rejected');

        const renderPending = (r) => `
            <div class="address-item" style="border-left: 4px solid var(--warning-color);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <strong>${r.users?.first_name || 'User'}</strong>
                        <small>@${r.users?.username || 'N/A'}</small><br>
                        <small>User ID: ${r.user_id}</small><br>
                        <strong>${parseFloat(r.amount).toFixed(2)} USDT</strong><br>
                        <small style="word-break: break-all;">Reference: ${r.reference_id}</small>
                        ${r.tx_hash ? `<br><small style="word-break: break-all;">Tx Hash: ${r.tx_hash}</small>` : ''}<br>
                        <small>Date: ${new Date(r.created_at).toLocaleString()}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                        <button onclick="approveDeposit(${r.id})" class="btn-primary" style="padding: 8px 15px; font-size: 12px;">✅ Approve</button>
                        <button onclick="rejectDeposit(${r.id})" class="btn-secondary" style="padding: 8px 15px; font-size: 12px; color: var(--danger-color);">❌ Reject</button>
                    </div>
                </div>
            </div>
        `;

        const renderDone = (r, color) => `
            <div class="address-item" style="border-left: 4px solid ${color}; opacity: 0.8;">
                <strong>${r.users?.first_name || 'User'}</strong> — ${parseFloat(r.amount).toFixed(2)} USDT<br>
                ${r.status === 'rejected' && r.reason ? `<small style="color: var(--danger-color);">Reason: ${r.reason}</small><br>` : ''}
                <small>${new Date(r.updated_at || r.created_at).toLocaleString()}</small>
            </div>
        `;

        adminContent.innerHTML = `
            <h3>💵 Deposit Requests</h3>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--warning-color);">⏳ Pending (${pending.length})</h4>
                ${pending.map(renderPending).join('') || '<p>No pending deposits</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--success-color);">✅ Approved (${approved.length})</h4>
                ${approved.slice(0, 10).map(r => renderDone(r, 'var(--success-color)')).join('') || '<p>No approved deposits</p>'}
            </div>
            <div style="margin: 20px 0;">
                <h4 style="color: var(--danger-color);">❌ Rejected (${rejected.length})</h4>
                ${rejected.slice(0, 10).map(r => renderDone(r, 'var(--danger-color)')).join('') || '<p>No rejected deposits</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Deposit requests loading error:', error);
        adminContent.innerHTML = '<p>Failed to load deposit requests</p>';
    }
}

async function approveDeposit(requestId) {
    if (!confirm('Approve this deposit? This will credit the user\'s deposit balance.')) return;
    try {
        const result = await callEdgeFunction('admin-manage-deposits', { action: 'approve', requestId: requestId });
        if (!result.ok) {
            showToast('❌ Failed to approve: ' + ((result.data && result.data.error) || 'unknown error'));
            return;
        }
        showToast('✅ Deposit approved');
        loadAdminDeposits();
    } catch (error) {
        console.error('Deposit approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectDeposit(requestId) {
    const reason = prompt('Reason for rejecting this deposit (shown to the user):');
    if (reason === null) return;
    if (!reason.trim()) {
        showToast('⚠️ A reason is required');
        return;
    }
    try {
        const result = await callEdgeFunction('admin-manage-deposits', { action: 'reject', requestId: requestId, reason: reason.trim() });
        if (!result.ok) {
            showToast('❌ Failed to reject: ' + ((result.data && result.data.error) || 'unknown error'));
            return;
        }
        showToast('❌ Deposit rejected');
        loadAdminDeposits();
    } catch (error) {
        console.error('Deposit rejection error:', error);
        showToast('❌ Failed to reject');
    }
}
