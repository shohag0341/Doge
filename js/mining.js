// Mining System
let miningActive = false;
let miningInterval = null;
let miningStartTime = null;
let miningRate = 0.01; // Default rate, will be loaded from settings

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

// ============ TOGGLE MINING ============
async function toggleMining() {
    if (!miningActive) {
        await startMining();
    } else {
        await stopMining();
    }
}

// ============ START MINING ============
async function startMining() {
    try {
        miningActive = true;
        miningStartTime = Date.now();
        
        document.getElementById('startMiningBtn').innerHTML = '⏸️ মাইনিং বন্ধ করুন';
        document.getElementById('miningStatus').textContent = '⛏️ মাইনিং চলছে...';
        
        // Start mining animation
        document.querySelector('.doge-coin').style.animation = 'float 1s ease-in-out infinite';
        
        // Start mining interval
        miningInterval = setInterval(updateMiningProgress, 1000);
        
        // Update mining status in database
        await db.updateUser(currentUser.telegram_id, {
            mining_active: true,
            mining_start_time: new Date().toISOString()
        });
        
        showToast('⛏️ মাইনিং শুরু হয়েছে!');
        
    } catch (error) {
        console.error('Mining start error:', error);
        showToast('❌ মাইনিং শুরু করতে সমস্যা হয়েছে');
        miningActive = false;
    }
}

// ============ STOP MINING ============
async function stopMining() {
    try {
        miningActive = false;
        clearInterval(miningInterval);
        miningInterval = null;
        
        document.getElementById('startMiningBtn').innerHTML = '⛏️ মাইনিং শুরু করুন';
        document.getElementById('miningStatus').textContent = 'মাইনিং শুরু করতে ক্লিক করুন';
        document.querySelector('.doge-coin').style.animation = 'float 3s ease-in-out infinite';
        document.getElementById('miningProgressBar').style.width = '0%';
        
        // Calculate mining rewards
        const miningDuration = (Date.now() - miningStartTime) / 3600000; // Hours
        const reward = miningDuration * miningRate;
        
        if (reward > 0) {
            await db.updateMining(currentUser.telegram_id, reward);
            
            // Create transaction record
            await db.createTransaction({
                user_id: currentUser.telegram_id,
                type: 'mining',
                amount: reward,
                status: 'completed',
                created_at: new Date().toISOString()
            });
            
            showToast(`💰 ${reward.toFixed(4)} DOGE মাইনিং হয়েছে!`);
        }
        
        // Update mining status in database
        await db.updateUser(currentUser.telegram_id, {
            mining_active: false,
            mining_start_time: null
        });
        
        // Refresh user data
        await refreshUserData();
        
    } catch (error) {
        console.error('Mining stop error:', error);
        showToast('❌ মাইনিং বন্ধ করতে সমস্যা হয়েছে');
    }
}

// ============ UPDATE MINING PROGRESS ============
function updateMiningProgress() {
    const currentTime = Date.now();
    const totalDuration = 24 * 3600000; // 24 hours in ms
    const elapsedTime = currentTime - miningStartTime;
    const progress = Math.min((elapsedTime / totalDuration) * 100, 100);
    
    document.getElementById('miningProgressBar').style.width = progress + '%';
    
    // Update live mining stats
    const miningDuration = elapsedTime / 3600000;
    const currentReward = miningDuration * miningRate;
    document.getElementById('miningStatus').textContent = 
        `⛏️ মাইনিং চলছে... ${currentReward.toFixed(4)} DOGE`;
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
                    <button onclick="purchasePackage(${pkg.id})" class="btn-primary">
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

// ============ PURCHASE PACKAGE ============
async function purchasePackage(packageId) {
    try {
        // Get package details
        const { data: pkg, error } = await supabase
            .from('packages')
            .select('*')
            .eq('id', packageId)
            .single();
        
        if (pkg) {
            // Confirm purchase
            if (!confirm(`আপনি কি "${pkg.name}" প্যাকেজটি $${pkg.price} দিয়ে কিনতে চান?`)) {
                return;
            }
            
            // Show payment processing
            showToast('💳 পেমেন্ট প্রসেসিং...');
            
            // In production, integrate payment gateway here
            // For demo, auto-activate package after 2 seconds
            setTimeout(async () => {
                // Update user's mining rate
                const newMiningRate = miningRate * pkg.mining_rate;
                
                await db.updateUser(currentUser.telegram_id, {
                    mining_rate: newMiningRate,
                    active_package: pkg.name,
                    package_expiry: new Date(Date.now() + pkg.duration_days * 86400000).toISOString()
                });
                
                // Add bonus if any
                if (pkg.bonus_doge > 0) {
                    await db.updateMining(currentUser.telegram_id, pkg.bonus_doge);
                }
                
                // Create transaction record
                await db.createTransaction({
                    user_id: currentUser.telegram_id,
                    type: 'package_purchase',
                    amount: pkg.price,
                    status: 'completed',
                    created_at: new Date().toISOString()
                });
                
                miningRate = newMiningRate;
                
                showToast(`🎉 "${pkg.name}" প্যাকেজ সক্রিয় হয়েছে!`);
                await refreshUserData();
                await loadMiningSettings();
                
            }, 2000);
        }
    } catch (error) {
        console.error('Package purchase error:', error);
        showToast('❌ প্যাকেজ কেনা সম্ভব হয়নি');
    }
}

// ============ CHECK PACKAGE EXPIRY ============
async function checkPackageExpiry() {
    if (currentUser?.package_expiry) {
        const expiryDate = new Date(currentUser.package_expiry);
        const now = new Date();
        
        if (expiryDate < now) {
            // Package expired, reset mining rate
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
