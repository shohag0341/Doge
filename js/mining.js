// Mining System
let miningActive = false;
let miningInterval = null;
let miningStartTime = null;
let miningRate = 0.01;
let miningTimerInterval = null;

// ============ LOAD SETTINGS ============
async function loadMiningSettings() {
    try {
        const { data: settings, error } = await db.getSettings();
        if (settings) {
            miningRate = settings.base_mining_rate || 0.01;
            document.getElementById('miningRate').textContent = miningRate + ' DOGE/ঘন্টা';
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
                
                document.getElementById('startMiningBtn').innerHTML = '💰 Claim করুন';
                document.getElementById('miningStatus').textContent = '⛏️ মাইনিং চলছে...';
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
async function autoStopMining() {
    try {
        miningActive = false;
        clearInterval(miningInterval);
        clearInterval(miningTimerInterval);
        miningInterval = null;
        miningTimerInterval = null;
        
        // Calculate reward for 12 hours
        const reward = 12 * miningRate;
        
        if (reward > 0) {
            await db.updateMining(currentUser.telegram_id, reward);
            
            await db.createTransaction({
                user_id: currentUser.telegram_id,
                type: 'mining',
                amount: reward,
                status: 'completed',
                created_at: new Date().toISOString()
            });
        }
        
        // Update UI
        document.getElementById('startMiningBtn').innerHTML = '⛏️ মাইনিং শুরু করুন';
        document.getElementById('miningStatus').textContent = 'মাইনিং শেষ হয়েছে! আবার শুরু করতে ক্লিক করুন';
        document.querySelector('.doge-coin').style.animation = 'float 3s ease-in-out infinite';
        document.getElementById('miningProgressBar').style.width = '0%';
        
        // Update database
        await db.updateUser(currentUser.telegram_id, {
            mining_active: false,
            mining_start_time: null
        });
        
        showToast(`✅ ১২ ঘণ্টার মাইনিং শেষ! +${reward.toFixed(4)} DOGE`);
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
async function startMining() {
    try {
        miningActive = true;
        miningStartTime = Date.now();
        
        document.getElementById('startMiningBtn').innerHTML = '💰 Claim করুন';
        document.getElementById('miningStatus').textContent = '⛏️ মাইনিং চলছে...';
        
        // Start mining animation
        document.querySelector('.doge-coin').style.animation = 'float 1s ease-in-out infinite';
        
        // Start mining interval
        miningInterval = setInterval(updateMiningProgress, 1000);
        
        // Start timer for auto-stop
        startMiningTimer();
        
        // Update mining status in database
        await db.updateUser(currentUser.telegram_id, {
            mining_active: true,
            mining_start_time: new Date().toISOString(),
            mining_rate: miningRate
        });
        
        showToast('⛏️ মাইনিং শুরু হয়েছে! ১২ ঘণ্টা চলবে');
        
    } catch (error) {
        console.error('Mining start error:', error);
        showToast('❌ মাইনিং শুরু করতে সমস্যা হয়েছে');
        miningActive = false;
    }
}

// ============ CLAIM MINING ============
async function claimMining() {
    try {
        miningActive = false;
        clearInterval(miningInterval);
        clearInterval(miningTimerInterval);
        miningInterval = null;
        miningTimerInterval = null;
        
        // Calculate reward
        const miningDuration = (Date.now() - miningStartTime) / 3600000; // Hours
        const reward = miningDuration * miningRate;
        
        if (reward > 0) {
            await db.updateMining(currentUser.telegram_id, reward);
            
            await db.createTransaction({
                user_id: currentUser.telegram_id,
                type: 'mining',
                amount: reward,
                status: 'completed',
                created_at: new Date().toISOString()
            });
            
            showToast(`✅ Claimed! +${reward.toFixed(4)} DOGE`);
        }
        
        // Update UI
        document.getElementById('startMiningBtn').innerHTML = '⛏️ মাইনিং শুরু করুন';
        document.getElementById('miningStatus').textContent = 'মাইনিং শুরু করতে ক্লিক করুন';
        document.querySelector('.doge-coin').style.animation = 'float 3s ease-in-out infinite';
        document.getElementById('miningProgressBar').style.width = '0%';
        
        // Update database
        await db.updateUser(currentUser.telegram_id, {
            mining_active: false,
            mining_start_time: null
        });
        
        await refreshUserData();
        
    } catch (error) {
        console.error('Mining claim error:', error);
        showToast('❌ Claim করতে সমস্যা হয়েছে');
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
    
    document.getElementById('miningStatus').textContent = 
        `⛏️ ${currentReward.toFixed(4)} DOGE | বাকি: ${remainingHours}h ${remainingMinutes}m`;
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
                        কিনুন
                    </button>
                </div>
            `).join('');
        } else {
            document.getElementById('upgradePackages').innerHTML = 
                '<p style="text-align: center; color: var(--text-secondary);">কোনো প্যাকেজ নেই</p>';
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
                                নিচের যেকোনো network-এ USDT পাঠান:
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
                            <input type="text" id="purchaseReference" placeholder="আপনার Wallet Address বা Binance ID" required 
                                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: transparent; color: var(--text-primary);">
                            
                            <input type="text" id="purchaseTxHash" placeholder="Transaction Hash (ঐচ্ছিক)" 
                                   style="padding: 12px; border: 2px solid #333; border-radius: 10px; background: transparent; color: var(--text-primary);">
                            
                            <div style="display: flex; gap: 10px;">
                                <button type="submit" class="btn-primary" style="flex: 1;">সাবমিট করুন</button>
                                <button type="button" onclick="closePurchaseForm()" class="btn-secondary" style="flex: 1;">বাতিল</button>
                            </div>
                        </form>
                    </div>
                `;
                
                document.body.appendChild(modal);
            } else {
                showToast('❌ কোনো payment address নেই');
            }
        }
    } catch (error) {
        console.error('Purchase form error:', error);
        showToast('❌ পেমেন্ট ফর্ম খোলা যায়নি');
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
        showToast('⚠️ Reference ID দিন');
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
        showToast('✅ পেমেন্ট সাবমিট হয়েছে! Admin approval-এর পর package activate হবে');
        
    } catch (error) {
        console.error('Package purchase submit error:', error);
        showToast('❌ সাবমিট করা যায়নি');
    }
}

// ============ CHECK PACKAGE EXPIRY ============
async function checkPackageExpiry() {
    if (currentUser?.package_expiry) {
        const expiryDate = new Date(currentUser.package_expiry);
        const now = new Date();
        
        if (expiryDate < now) {
            const { data: settings } = await db.getSettings();
            await db.updateUser(currentUser.telegram_id, {
                mining_rate: settings?.base_mining_rate || 0.01,
                active_package: null,
                package_expiry: null
            });
            
            showToast('ℹ️ আপনার প্যাকেজের মেয়াদ শেষ হয়েছে');
            await refreshUserData();
        }
    }
}
