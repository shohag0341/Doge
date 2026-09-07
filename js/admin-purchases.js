// Admin Panel — Package Purchase Requests
async function loadPurchaseRequests() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: requests, error } = await supabase
            .from('purchase_requests')
            .select(`*, users:user_id (telegram_id, first_name, username), packages:package_id (name, price, mining_rate, duration_days)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (requests && requests.length > 0) {
            const pending = requests.filter(r => r.status === 'pending');
            const approved = requests.filter(r => r.status === 'approved');
            const rejected = requests.filter(r => r.status === 'rejected');

            adminContent.innerHTML = `
                <h3>💳 Purchase Requests</h3>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--warning-color);">⏳ Pending (${pending.length})</h4>
                    ${pending.map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--warning-color);">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div style="flex: 1;">
                                    <strong>${req.users?.first_name || 'User'}</strong>
                                    <small>@${req.users?.username || 'N/A'}</small><br>
                                    <small>User ID: ${req.user_id}</small><br>
                                    <strong>Package: ${req.packages?.name || 'N/A'}</strong><br>
                                    <small>Price: $${req.package_price}</small><br>
                                    <small style="word-break: break-all;">Reference: ${req.reference_id}</small>
                                    ${req.tx_hash ? `<br><small style="word-break: break-all;">Tx Hash: ${req.tx_hash}</small>` : ''}<br>
                                    <small>Date: ${new Date(req.created_at).toLocaleString()}</small>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px;">
                                    <button onclick="approvePurchase(${req.id})" class="btn-primary" style="padding: 8px 15px; font-size: 12px;">✅ Approve</button>
                                    <button onclick="rejectPurchase(${req.id})" class="btn-secondary" style="padding: 8px 15px; font-size: 12px; color: var(--danger-color);">❌ Reject</button>
                                </div>
                            </div>
                        </div>
                    `).join('') || '<p>No pending requests</p>'}
                </div>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--success-color);">✅ Approved (${approved.length})</h4>
                    ${approved.slice(0, 10).map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--success-color); opacity: 0.7;">
                            <strong>${req.users?.first_name || 'User'}</strong> - ${req.packages?.name || 'N/A'}<br>
                            <small>Approved: ${new Date(req.updated_at || req.created_at).toLocaleString()}</small>
                        </div>
                    `).join('') || '<p>No approved requests</p>'}
                </div>
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--danger-color);">❌ Rejected (${rejected.length})</h4>
                    ${rejected.slice(0, 10).map(req => `
                        <div class="address-item" style="border-left: 4px solid var(--danger-color); opacity: 0.7;">
                            <strong>${req.users?.first_name || 'User'}</strong> - ${req.packages?.name || 'N/A'}<br>
                            <small>Rejected: ${new Date(req.updated_at || req.created_at).toLocaleString()}</small>
                        </div>
                    `).join('') || '<p>No rejected requests</p>'}
                </div>
            `;
        } else {
            adminContent.innerHTML = '<p>No purchase requests</p>';
        }
    } catch (error) {
        console.error('Purchase requests loading error:', error);
        adminContent.innerHTML = '<p>Failed to load purchase requests</p>';
    }
}

// SECURITY: admin status is now checked server-side inside the Edge
// Function (against the ADMIN_TELEGRAM_IDS secret), not just by this
// panel being reachable in the browser. Package stacking also happens
// via user_packages + sync_user_mining_rate() in the DB.
async function approvePurchase(requestId) {
    if (!confirm('Are you sure you want to approve this purchase request?')) return;

    try {
        const result = await callEdgeFunction('admin-approve-purchase', { requestId: requestId });

        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to approve: ' + err);
            return;
        }

        showToast('✅ Purchase approved! Package activated');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase approval error:', error);
        showToast('❌ Failed to approve');
    }
}

async function rejectPurchase(requestId) {
    if (!confirm('Are you sure you want to reject this purchase request?')) return;
    const reason = prompt('Reason for rejecting (optional, shown to the user):') || '';

    try {
        const result = await callEdgeFunction('admin-reject-purchase', { requestId: requestId, reason: reason.trim() });

        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to reject: ' + err);
            return;
        }

        showToast('❌ Purchase rejected');
        loadPurchaseRequests();
    } catch (error) {
        console.error('Purchase rejection error:', error);
        showToast('❌ Failed to reject');
    }
}
