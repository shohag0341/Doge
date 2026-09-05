// Mining System
let miningActive = false;
let miningInterval = null;
let miningStartTime = null;
let miningRate = 0.01;       // effective rate actually used for calculations
let baseMiningRate = 0.01;   // FIX (খ): admin-configured basic rate, kept separate
let miningTimerInterval = null;

// ============ LOAD SETTINGS ============
async function loadMiningSettings() {
    try {
        const { data: settings, error } = await db.getSettings();
        if (settings) {
            baseMiningRate = settings.base_mining_rate || 0.01;

            // FIX (খ): don't blindly overwrite miningRate with the base
            // rate — if this user has an active package with a higher
            // mining_rate, keep using that instead. This is what gets
            // shown and what startMining() will save.
            miningRate = (currentUser && currentUser.mining_rate) || baseMiningRate;
            document.getElementById('miningRate').textContent = miningRate + ' DOGE/hour';
        }
    } catch (error) {
        console.error('Mining settings loading error:', error);
    }
}

// ============ CHECK MINING STATUS ============
async function checkMiningStatus() {
    try {
        if (currentUser?.mining_active && currentUser?.mining_start_time) {
            const startTime = new Date(currentUser.mining_start_time).getTime();
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            const maxMiningTime = 12 * 3600000; // 12 hours in ms
            
            if (elapsedTime >= maxMiningTime) {
                // Mining time expired, auto-stop
                await autoStopMining();
                return false;
            } else {
                // Mining still active
                miningActive = true;
                miningStartTime = startTime;
                miningRate = currentUser.mining_rate || miningRate;
                
                document.getElementById('startMiningBtn').innerHTML = '💰 Claim';
                document.getElementById('miningStatus').textContent = '⛏️ Mining in progress...';
                document.querySelector('.doge-coin').style.animation = 'float 1s ease-in-out infinite';
                
                if (!miningInterval) {
                    miningInterval = setInterval(updateMiningProgress, 1000);
                }
                
                // Start timer to check for auto-stop
                startMiningTimer();
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Mining status check error:', error);
        return false;
    }
}

// ============ START MINING TIMER ============
function startMiningTimer() {
    if (miningTimerInterval) {
        clearInterval(miningTimerInterval);
    }
    
    miningTimerInterval = setInterval(async () => {
        if (miningActive && miningStartTime) {
            const elapsedTime = Date.now() - miningStartTime;
            const maxMiningTime = 12 * 3600000; // 12 hours
            
            if (elapsedTime >= maxMiningTime) {
                await autoStopMining();
            }
        }
    }, 60000); // Check every minute
}

// ============ AUTO STOP MINING ============
// SECURITY: reuses claim-mining — by the time this fires, 12h have
// definitely elapsed (checked server-side too), so it will succeed and
// pay out the same way a manual claim would.
async function autoStopMining() {
    try {
        miningActive = false;
        clearInterval(miningInterval);
        clearInterval(miningTimerInterval);
        miningInterval = null;
        miningTimerInterval = null;

        const result = await callEdgeFunction('claim-mining', {});

        const reward = (result.ok && result.data && result.data.reward) || 0;

        // Update UI
        document.getElementById('startMiningBtn').innerHTML = '⛏️ Start Mining';
        document.getElementById('miningStatus').textContent = 'Mining finished! Click to start again';
        document.querySelector('.doge-coin').style.animation = 'float 3s ease-in-out infinite';
        document.getElementById('miningProgressBar').style.width = '0%';

        if (reward > 0) {
            showToast(`✅ 12-hour mining complete! +${reward.toFixed(4)} DOGE`);
        }
        await refreshUserData();

    } catch (error) {
        console.error('Auto stop mining error:', error);
    }
}

// ============ TOGGLE MINING ============
async function toggleMining() {
    if (!miningActive) {
        await startMining();
    } else {
        // Show claim button (not stop button)
        await claimMining();
    }
}

// ============ START MINING ============
// SECURITY: mining_active/mining_start_time/mining_rate are now written
// server-side by the start-mining Edge Function (using the DB clock and
// a server-computed effective rate), not directly from the browser.
async function startMining() {
    try {
        const result = await callEdgeFunction('start-mining', {});

        if (!result.ok) {
            const errMsg = (result.data && result.data.error) || 'unknown error';
            showToast('❌ Could not start mining: ' + errMsg);
            return;
        }

        miningRate = result.data.mining_rate;
        miningActive = true;
        miningStartTime = new Date(result.data.mining_start_time).getTime();

        document.getElementById('startMiningBtn').innerHTML = '💰 Claim';
        document.getElementById('miningStatus').textContent = '⛏️ Mining in progress...';

        document.querySelector('.doge-coin').style.animation = 'float 1s ease-in-out infinite';

        miningInterval = setInterval(updateMiningProgress, 1000);
        startMiningTimer();

        showToast('⛏️ Mining started! Will run for 12 hours');

    } catch (error) {
        console.error('Mining start error:', error);
        showToast('❌ Failed to start mining');
        miningActive = false;
    }
}

// ============ CLAIM MINING ============
// FIX (ক) + SECURITY: the 12-hour wait and the reward payout are now
// both enforced/executed server-side by the claim-mining Edge Function,
// using the DB's mining_start_time. The client can no longer bypass the
// wait or forge a reward amount by editing local JS state.
async function claimMining() {
    try {
        if (!miningActive || !miningStartTime) {
            return;
        }

        const result = await callEdgeFunction('claim-mining', {});

        if (!result.ok) {
            if (result.data && result.data.error === 'too_early') {
                const remainingMs = result.data.remaining_ms || 0;
                const remainingHours = Math.floor(remainingMs / 3600000);
                const remainingMinutes = Math.floor((remainingMs % 3600000) / 60000);
                showToast(`⏳ Claim available after 12 hours. Remaining: ${remainingHours}h ${remainingMinutes}m`);
                return;
            }
            showToast('❌ Failed to claim');
            return;
        }

        miningActive = false;
        clearInterval(miningInterval);
        clearInterval(miningTimerInterval);
        miningInterval = null;
        miningTimerInterval = null;

        const reward = result.data.reward || 0;
        if (reward > 0) {
            showToast(`✅ Claimed! +${reward.toFixed(4)} DOGE`);
        }

        // Update UI
        document.getElementById('startMiningBtn').innerHTML = '⛏️ Start Mining';
        document.getElementById('miningStatus').textContent = 'Click to start mining';
        document.querySelector('.doge-coin').style.animation = 'float 3s ease-in-out infinite';
        document.getElementById('miningProgressBar').style.width = '0%';

        await refreshUserData();

    } catch (error) {
        console.error('Mining claim error:', error);
        showToast('❌ Failed to claim');
    }
}

// ============ UPDATE MINING PROGRESS ============
function updateMiningProgress() {
    const currentTime = Date.now();
    const totalDuration = 12 * 3600000; // 12 hours in ms
    const elapsedTime = currentTime - miningStartTime;
    const progress = Math.min((elapsedTime / totalDuration) * 100, 100);
    
    document.getElementById('miningProgressBar').style.width = progress + '%';
    
    // Update live mining stats
    const miningDuration = elapsedTime / 3600000;
    const currentReward = miningDuration * miningRate;
    
    // Show remaining time
    const remainingTime = Math.max(totalDuration - elapsedTime, 0);
    const remainingHours = Math.floor(remainingTime / 3600000);
    const remainingMinutes = Math.floor((remainingTime % 3600000) / 60000);

    // FIX (ক): once 12 hours are complete, make it clear the claim is
    // now ready instead of implying the user can already claim earlier.
    const startBtn = document.getElementById('startMiningBtn');
    if (remainingTime <= 0) {
        if (startBtn) startBtn.innerHTML = '💰 Claim Now';
        document.getElementById('miningStatus').textContent =
            `✅ Ready to claim: ${currentReward.toFixed(4)} DOGE`;
    } else {
        if (startBtn) startBtn.innerHTML = '⏳ Mining...';
        document.getElementById('miningStatus').textContent =
            `⛏️ ${currentReward.toFixed(4)} DOGE | Remaining: ${remainingHours}h ${remainingMinutes}m`;
    }
}

// ============ LOAD UPGRADE PACKAGES ============
async function loadUpgradePackages() {
    try {
        const { data: packages, error } = await db.getPackages();
        
        if (packages && packages.length > 0) {
            const packagesContainer = document.getElementById('upgradePackages');
            packagesContainer.innerHTML = packages.map(pkg => `
                <div class="package-card">
                    <h3>${pkg.name}</h3>
                    <p>${pkg.description || ''}</p>
                    <div class="package-price">$${pkg.price}</div>
                    <ul>
                        <li>⛏️ Mining Rate: ${pkg.mining_rate}x</li>
                        <li>⏱️ Duration: ${pkg.duration_days} days</li>
                        ${pkg.bonus_doge > 0 ? `<li>⚡ Bonus: ${pkg.bonus_doge} DOGE</li>` : ''}
                    </ul>
                    <button onclick="showPurchaseForm(${pkg.id})" class="btn-primary">
                        Buy
                    </button>
                </div>
            `).join('');
        } else {
            document.getElementById('upgradePackages').innerHTML = 
                '<p style="text-align: center; color: var(--text-secondary);">No packages available</p>';
        }
    } catch (error) {
        console.error('Package loading error:', error);
    }
}

// ============ SHOW PURCHASE FORM ============
async function showPurchaseForm(packageId) {
    try {
        // Get package details
        const { data: pkg, error } = await supabase
            .from('packages')
            .select('*')
            .eq('id', packageId)
            .single();
        
        if (pkg) {
            // Get wallet addresses for payment
            const { data: addresses, error: addrError } = await db.getWalletAddresses();
            
            if (addresses && addresses.length > 0) {
                // Show purchase modal
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.id = 'purchaseModal';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
                        <h2>💳 Package Purchase</h2>
                        <div style="margin: 15px 0;">
                            <h3>${pkg.name}</h3>
                            <p style="font-size: 24px; font-weight: bold; color: var(--secondary-color);">
                                $${pkg.price}
                            </p>
                        </div>
                        
                        <div style="text-align: left; margin: 15px 0;">
                            <p style="color: var(--text-secondary); margin-bottom: 10px;">
                                Send USDT to any of the networks below:
                            </p>
                            ${addresses.map(addr => `
                                <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 10px; margin-bottom: 10px;">
                                    <strong>${addr.network_name}</strong>
                                    <p style="font-size: 12px; word-break: break-all; margin: 5px 0;">${addr.address}</p>
                                    <button onclick="copyAddress('${addr.address}')" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">
                                        📋 Copy
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        
                        <form onsubmit="submitPackagePurchase(event, ${pkg.id}, ${pkg.price})" style="display: flex; flex-direction: column; gap: 15px;">
                            <input type="text" id="purchaseReference" placeholder="Your Wallet Address or Binance ID" required 
                                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: transparent; color: var(--text-primary);">
                            
                            <input type="text" id="purchaseTxHash" placeholder="Transaction Hash (optional)" 
                                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: transparent; color: var(--text-primary);">
                            
                            <div style="display: flex; gap: 10px;">
                                <button type="submit" class="btn-primary" style="flex: 1;">Submit</button>
                                <button type="button" onclick="closePurchaseForm()" class="btn-secondary" style="flex: 1;">Cancel</button>
                            </div>
                        </form>
                    </div>
                `;
                
                document.body.appendChild(modal);
            } else {
                showToast('❌ No payment address available');
            }
        }
    } catch (error) {
        console.error('Purchase form error:', error);
        showToast('❌ Could not open payment form');
    }
}

// ============ CLOSE PURCHASE FORM ============
function closePurchaseForm() {
    const modal = document.getElementById('purchaseModal');
    if (modal) {
        modal.remove();
    }
}

// ============ SUBMIT PACKAGE PURCHASE ============
async function submitPackagePurchase(event, packageId, packagePrice) {
    event.preventDefault();
    
    const reference = document.getElementById('purchaseReference').value.trim();
    const txHash = document.getElementById('purchaseTxHash').value.trim();
    
    if (!reference) {
        showToast('⚠️ Enter Reference ID');
        return;
    }
    
    try {
        // Create purchase request in database
        await supabase
            .from('purchase_requests')
            .insert([{
                user_id: currentUser.telegram_id,
                package_id: packageId,
                package_price: packagePrice,
                reference_id: reference,
                tx_hash: txHash || null,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);
        
        closePurchaseForm();
        showToast('✅ Payment submitted! Package will activate after admin approval');
        
    } catch (error) {
        console.error('Package purchase submit error:', error);
        showToast('❌ Could not submit');
    }
}

// ============ CHECK PACKAGE EXPIRY ============
// SECURITY: package expiry (mining_rate reset, clearing active_package)
// is now handled server-side — either by the pg_cron job calling
// expire_user_packages(), or the next time sync_user_mining_rate() runs
// (e.g. after a new purchase approval). This function no longer writes
// to the users table directly; it just refreshes the local view so the
// UI reflects whatever the server has already computed.
async function checkPackageExpiry() {
    if (currentUser?.package_expiry) {
        const expiryDate = new Date(currentUser.package_expiry);
        const now = new Date();

        if (expiryDate < now) {
            await refreshUserData();
            if (!currentUser?.active_package) {
                showToast('ℹ️ Your package has expired');
            }
        }
    }
}
