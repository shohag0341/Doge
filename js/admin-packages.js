// Admin Panel — Package Management
let adminPackagesCache = [];

async function loadAdminPackages() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const { data: packages, error } = await db.getPackages();
        if (error) throw error;

        adminPackagesCache = packages || [];

        adminContent.innerHTML = `
            <h3>📦 Package Management</h3>
            <button onclick="showPackageForm()" class="btn-primary" style="margin: 10px 0;">➕ New Package</button>
            <div id="packageList">
                ${(packages || []).map(pkg => `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${pkg.name}</strong><br>
                                <small>Price: $${pkg.price}</small><br>
                                <small>Rate: ${pkg.mining_rate}x | Duration: ${pkg.duration_days} days</small><br>
                                <small>Bonus: ${pkg.bonus_doge || 0} DOGE</small>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button onclick="showPackageForm(${pkg.id})" class="btn-secondary">✏️</button>
                                <button onclick="deletePackage(${pkg.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>No packages found</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Admin packages loading error:', error);
        adminContent.innerHTML = '<p>Failed to load packages</p>';
    }
}

// Pass a packageId to edit an existing package; call with no argument to create a new one.
function showPackageForm(packageId) {
    const pkg = packageId ? adminPackagesCache.find(p => p.id === packageId) : null;
    const adminContent = document.getElementById('adminContent');
    const labelStyle = 'font-size: 13px; color: var(--text-secondary); margin-bottom: -8px; font-weight: 500;';
    const inputStyle = 'padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);';
    adminContent.innerHTML = `
        <h3>${pkg ? '✏️ Edit Package' : '➕ New Package'}</h3>
        <form onsubmit="savePackage(event, ${pkg ? pkg.id : 'null'})" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <label style="${labelStyle}">Package Name</label>
            <input type="text" id="pkgName" placeholder="e.g. Starter Pack" required value="${pkg ? pkg.name : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Price ($)</label>
            <input type="number" id="pkgPrice" placeholder="e.g. 10" required value="${pkg ? pkg.price : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Mining Rate Multiplier (x)</label>
            <input type="number" id="pkgRate" placeholder="e.g. 2" step="0.1" required value="${pkg ? pkg.mining_rate : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Duration (days)</label>
            <input type="number" id="pkgDuration" placeholder="e.g. 30" required value="${pkg ? pkg.duration_days : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Bonus DOGE (one-time, optional)</label>
            <input type="number" id="pkgBonus" placeholder="e.g. 5" step="0.01" value="${pkg ? (pkg.bonus_doge || 0) : ''}"
                   style="${inputStyle}">
            <label style="${labelStyle}">Description</label>
            <textarea id="pkgDesc" placeholder="Shown to users on the package card"
                      style="${inputStyle}">${pkg ? (pkg.description || '') : ''}</textarea>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminPackages()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function savePackage(event, packageId) {
    event.preventDefault();
    const packageData = {
        name: document.getElementById('pkgName').value.trim(),
        price: parseFloat(document.getElementById('pkgPrice').value),
        mining_rate: parseFloat(document.getElementById('pkgRate').value),
        duration_days: parseInt(document.getElementById('pkgDuration').value),
        bonus_doge: parseFloat(document.getElementById('pkgBonus').value) || 0,
        description: document.getElementById('pkgDesc').value.trim()
    };
    const isEdit = packageId !== null && packageId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-packages', isEdit
            ? { action: 'edit', packageId: packageId, package: packageData }
            : { action: 'create', package: packageData });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} package: ` + err);
            return;
        }
        showToast(isEdit ? '✅ Package updated' : '✅ Package created');
        loadAdminPackages();
    } catch (error) {
        console.error('Package save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} package`);
    }
}

async function deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-packages', { action: 'delete', packageId: packageId });
        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Failed to delete package: ' + err);
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This package has purchase history — it was deactivated instead of deleted'
            : '✅ Package deleted');
        loadAdminPackages();
    } catch (error) {
        console.error('Package deletion error:', error);
        showToast('❌ Failed to delete package');
    }
}
