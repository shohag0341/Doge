// Admin Panel — USDT Wallet Addresses
let adminWalletCache = [];

async function loadAdminWalletAddresses() {
    try {
        const { data: addresses, error } = await db.getWalletAddresses();
        const container = document.getElementById('adminWalletAddresses');
        if (!container) return;

        adminWalletCache = addresses || [];

        if (addresses && addresses.length > 0) {
            container.innerHTML = addresses.map(addr => `
                <div class="address-item">
                    <strong>${addr.network_name}</strong><br>
                    <small>${addr.address}</small><br>
                    <div style="display: flex; gap: 6px; margin-top: 5px;">
                        <button onclick="showWalletAddressForm(${addr.id})" class="btn-secondary">✏️</button>
                        <button onclick="deleteWalletAddress(${addr.id})" class="btn-secondary">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p>No addresses found</p>';
        }
    } catch (error) {
        console.error('Admin wallet addresses loading error:', error);
    }
}

// Pass an addressId to edit an existing address; call with no argument to add a new one.
function showWalletAddressForm(addressId) {
    const addr = addressId ? adminWalletCache.find(a => a.id === addressId) : null;
    const container = document.getElementById('adminWalletAddresses');
    if (!container) return;
    const labelStyle = 'font-size: 13px; color: var(--text-secondary); margin-bottom: -4px; font-weight: 500;';
    const inputStyle = 'padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);';
    container.innerHTML = `
        <form onsubmit="saveWalletAddress(event, ${addr ? addr.id : 'null'})" style="display: flex; flex-direction: column; gap: 10px;">
            <label style="${labelStyle}">Network Name</label>
            <input type="text" id="walletNetwork" placeholder="e.g. USDT (BEP20)" required value="${addr ? addr.network_name : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Wallet Address</label>
            <input type="text" id="walletAddress" placeholder="e.g. 0xABC123..." required value="${addr ? addr.address : ''}"
                   style="${inputStyle}">
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminWalletAddresses()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function saveWalletAddress(event, addressId) {
    event.preventDefault();
    const addressData = {
        network_name: document.getElementById('walletNetwork').value.trim(),
        address: document.getElementById('walletAddress').value.trim()
    };
    const isEdit = addressId !== null && addressId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-wallet', isEdit
            ? { action: 'edit', addressId: addressId, wallet: addressData }
            : { action: 'create', wallet: addressData });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast(`❌ Failed to ${isEdit ? 'update' : 'add'} address: ` + err);
            return;
        }
        showToast(isEdit ? '✅ Address updated' : '✅ Address added');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'add'} address`);
    }
}

async function deleteWalletAddress(addressId) {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-wallet', { action: 'delete', addressId: addressId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to delete address: ' + err);
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This address is referenced elsewhere — it was deactivated instead of deleted'
            : '✅ Address deleted');
        loadAdminWalletAddresses();
    } catch (error) {
        console.error('Wallet address deletion error:', error);
        showToast('❌ Failed to delete address');
    }
}
