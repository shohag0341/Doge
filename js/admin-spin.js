// Admin Panel — Spin Wheel Settings
let adminSpinSegmentsCache = [];

async function loadAdminSpinSettings() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<p>Loading...</p>';

    try {
        const result = await callEdgeFunction('admin-manage-spin-settings', { action: 'get_config' });
        if (!result.ok) {
            adminContent.innerHTML = '<p>Failed to load spin settings</p>';
            return;
        }

        adminSpinSegmentsCache = result.data.segments || [];
        const config = result.data.config || {};
        const rtp = result.data.rtp_percent;

        const { data: history } = await supabase.from('spin_history').select('bet_amount, payout');
        const totalWagered = (history || []).reduce((sum, h) => sum + Number(h.bet_amount), 0);
        const totalPaid = (history || []).reduce((sum, h) => sum + Number(h.payout), 0);
        const netProfit = totalWagered - totalPaid;
        const profitColor = netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';

        adminContent.innerHTML = `
            <h3>🎰 Spin Wheel Settings</h3>

            <div class="address-item" style="border-left: 4px solid ${profitColor};">
                <strong>House P&L (all-time, real results)</strong><br>
                <small>Total Wagered: ${totalWagered.toFixed(2)} USDT</small><br>
                <small>Total Paid Out: ${totalPaid.toFixed(2)} USDT</small><br>
                <strong style="color: ${profitColor};">Net: ${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} USDT</strong><br>
                <small>Theoretical RTP (current config): ${rtp}% | House edge: ${(100 - rtp).toFixed(2)}%</small>
            </div>

            <h4 style="margin-top: 25px;">Bet Limits</h4>
            <form onsubmit="saveSpinConfig(event)" style="display: flex; flex-direction: column; gap: 12px;">
                <label style="font-size: 13px; color: var(--text-secondary);">Min Bet (USDT)</label>
                <input type="number" id="spinMinBet" value="${config.min_bet}" step="0.1"
                       style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <label style="font-size: 13px; color: var(--text-secondary);">Max Bet (USDT)</label>
                <input type="number" id="spinMaxBet" value="${config.max_bet}" step="0.1"
                       style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <label style="font-size: 13px; color: var(--text-secondary);">Cooldown Between Spins (seconds)</label>
                <input type="number" id="spinCooldown" value="${config.cooldown_seconds}" step="1"
                       style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <label style="font-size: 13px; color: var(--text-secondary);">Daily Win Cap (optional, USDT — leave blank for no cap)</label>
                <input type="number" id="spinDailyCap" value="${config.daily_win_cap != null ? config.daily_win_cap : ''}" step="0.1"
                       style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);">
                <button type="submit" class="btn-primary">Save Limits</button>
            </form>

            <h4 style="margin-top: 25px;">Wheel Segments</h4>
            <button onclick="showSpinSegmentForm()" class="btn-primary" style="margin: 10px 0;">➕ New Segment</button>
            <div id="segmentList">
                ${adminSpinSegmentsCache.map(seg => `
                    <div class="address-item" style="${!seg.is_active ? 'opacity: 0.5;' : ''}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="display:inline-block; width:14px; height:14px; border-radius:4px; background:${seg.color}; margin-right:6px; vertical-align: middle;"></span>
                                <strong>${seg.label}</strong> ${!seg.is_active ? '<small>(inactive)</small>' : ''}<br>
                                <small>Multiplier: ${seg.multiplier}x | Weight: ${seg.weight}</small>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button onclick="showSpinSegmentForm(${seg.id})" class="btn-secondary">✏️</button>
                                <button onclick="deleteSpinSegment(${seg.id})" class="btn-secondary">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') || '<p>No segments configured</p>'}
            </div>
        `;
    } catch (error) {
        console.error('Spin settings loading error:', error);
        adminContent.innerHTML = '<p>Failed to load spin settings</p>';
    }
}

function calculatePreviewRtp() {
    const active = adminSpinSegmentsCache.filter(s => s.is_active !== false);
    const totalWeight = active.reduce((sum, s) => sum + Number(s.weight), 0);
    if (totalWeight <= 0) return 0;
    const ev = active.reduce((sum, s) => sum + (Number(s.weight) / totalWeight) * Number(s.multiplier), 0);
    return (ev * 100).toFixed(2);
}

// Live preview: recompute what the wheel's overall RTP WOULD become if
// this segment's multiplier/weight were saved as currently typed,
// without actually saving anything yet.
function updateRtpPreview() {
    const previewEl = document.getElementById('rtpPreview');
    if (!previewEl) return;

    const multiplierInput = document.getElementById('segMultiplier');
    const weightInput = document.getElementById('segWeight');
    const multiplier = parseFloat(multiplierInput && multiplierInput.value);
    const weight = parseFloat(weightInput && weightInput.value);

    if (!Number.isFinite(multiplier) || !Number.isFinite(weight) || weight <= 0) {
        previewEl.textContent = "Saving this will change the wheel's overall RTP — check the Spin Settings screen after saving.";
        return;
    }

    // Figure out which segment (if any) is being edited, so its old
    // values are excluded and replaced by what's currently typed.
    const editingIdMatch = document.querySelector('form[onsubmit^="saveSpinSegment"]')?.getAttribute('onsubmit') || '';
    const idMatch = editingIdMatch.match(/saveSpinSegment\(event,\s*(\d+|null)\)/);
    const editingId = idMatch && idMatch[1] !== 'null' ? parseInt(idMatch[1], 10) : null;

    const others = adminSpinSegmentsCache.filter(s => s.is_active !== false && s.id !== editingId);
    const combined = others.concat([{ multiplier: multiplier, weight: weight }]);

    const totalWeight = combined.reduce((sum, s) => sum + Number(s.weight), 0);
    const ev = totalWeight > 0
        ? combined.reduce((sum, s) => sum + (Number(s.weight) / totalWeight) * Number(s.multiplier), 0)
        : 0;
    const rtp = (ev * 100).toFixed(2);

    previewEl.textContent = `Resulting wheel RTP if saved: ${rtp}% (House edge: ${(100 - ev * 100).toFixed(2)}%)`;
    previewEl.style.color = ev > 1 ? 'var(--danger-color)' : 'var(--text-secondary)';
    if (ev > 1) {
        previewEl.textContent += ' — ⚠️ this would make the house lose money on average!';
    }
}

// Pass a segmentId to edit an existing segment; call with no argument to create a new one.
function showSpinSegmentForm(segmentId) {
    const seg = segmentId ? adminSpinSegmentsCache.find(s => s.id === segmentId) : null;
    const adminContent = document.getElementById('adminContent');
    const labelStyle = 'font-size: 13px; color: var(--text-secondary); margin-bottom: -8px; font-weight: 500;';
    const inputStyle = 'padding: 12px; border: 2px solid #333; border-radius: 10px; background: var(--card-background); color: var(--text-primary);';

    adminContent.innerHTML = `
        <h3>${seg ? '✏️ Edit Segment' : '➕ New Segment'}</h3>
        <form onsubmit="saveSpinSegment(event, ${seg ? seg.id : 'null'})" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
            <label style="${labelStyle}">Label (shown on the wheel)</label>
            <input type="text" id="segLabel" placeholder="e.g. 2x" required value="${seg ? seg.label : ''}" style="${inputStyle}">
            <label style="${labelStyle}">Multiplier (0 = lose bet, 1 = break even, 2 = double, ...)</label>
            <input type="number" id="segMultiplier" placeholder="e.g. 2" step="0.1" required value="${seg ? seg.multiplier : ''}"
                   style="${inputStyle}" oninput="updateRtpPreview()">
            <label style="${labelStyle}">Weight (relative probability — bigger = more likely AND bigger slice)</label>
            <input type="number" id="segWeight" placeholder="e.g. 10, or 0.0001 for a very rare segment" step="any" min="0.0001" required value="${seg ? seg.weight : ''}"
                   style="${inputStyle}" oninput="updateRtpPreview()">
            <label style="${labelStyle}">Slice Color</label>
            <input type="color" id="segColor" value="${seg ? seg.color : '#14B8A6'}" style="${inputStyle} height: 48px;">
            ${seg ? `
            <label style="${labelStyle}">Status</label>
            <select id="segActive" style="${inputStyle}">
                <option value="true" ${seg.is_active ? 'selected' : ''}>Active</option>
                <option value="false" ${!seg.is_active ? 'selected' : ''}>Inactive</option>
            </select>` : ''}
            <p id="rtpPreview" style="font-size: 13px; color: var(--text-secondary);">
                Saving this will change the wheel's overall RTP — check the Spin Settings screen after saving.
            </p>
            <div style="display: flex; gap: 10px;">
                <button type="submit" class="btn-primary">Save</button>
                <button type="button" onclick="loadAdminSpinSettings()" class="btn-secondary">Cancel</button>
            </div>
        </form>
    `;
}

async function saveSpinSegment(event, segmentId) {
    event.preventDefault();
    const segment = {
        label: document.getElementById('segLabel').value.trim(),
        multiplier: parseFloat(document.getElementById('segMultiplier').value),
        weight: parseFloat(document.getElementById('segWeight').value),
        color: document.getElementById('segColor').value,
    };
    const activeSel = document.getElementById('segActive');
    if (activeSel) segment.is_active = activeSel.value === 'true';

    const isEdit = segmentId !== null && segmentId !== undefined;
    try {
        const result = await callEdgeFunction('admin-manage-spin-settings', isEdit
            ? { action: 'edit_segment', segmentId: segmentId, segment: segment }
            : { action: 'create_segment', segment: segment });
        if (!result.ok) {
            showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} segment: ` + ((result.data && result.data.error) || 'unknown error'));
            return;
        }
        showToast(isEdit ? '✅ Segment updated' : '✅ Segment created');
        loadAdminSpinSettings();
    } catch (error) {
        console.error('Segment save error:', error);
        showToast(`❌ Failed to ${isEdit ? 'update' : 'create'} segment`);
    }
}

async function deleteSpinSegment(segmentId) {
    if (!confirm('Delete this wheel segment?')) return;
    try {
        const result = await callEdgeFunction('admin-manage-spin-settings', { action: 'delete_segment', segmentId: segmentId });
        if (!result.ok) {
            showToast('❌ Failed to delete: ' + ((result.data && result.data.error) || 'unknown error'));
            return;
        }
        showToast(result.data && result.data.deactivated
            ? 'ℹ️ This segment has spin history — deactivated instead of deleted'
            : '✅ Segment deleted');
        loadAdminSpinSettings();
    } catch (error) {
        console.error('Segment deletion error:', error);
        showToast('❌ Failed to delete segment');
    }
}

async function saveSpinConfig(event) {
    event.preventDefault();
    const config = {
        min_bet: parseFloat(document.getElementById('spinMinBet').value),
        max_bet: parseFloat(document.getElementById('spinMaxBet').value),
        cooldown_seconds: parseInt(document.getElementById('spinCooldown').value, 10),
        daily_win_cap: document.getElementById('spinDailyCap').value || null,
    };
    try {
        const result = await callEdgeFunction('admin-manage-spin-settings', { action: 'update_config', config: config });
        if (!result.ok) {
            showToast('❌ Failed to update limits: ' + ((result.data && result.data.error) || 'unknown error'));
            return;
        }
        showToast('✅ Bet limits updated');
        loadAdminSpinSettings();
    } catch (error) {
        console.error('Config save error:', error);
        showToast('❌ Failed to update limits');
    }
}
