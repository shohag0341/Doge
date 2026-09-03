// Wallet System
let depositVisible = false;
let withdrawVisible = false;
let walletAddresses = [];

// ============ LOAD WALLET ADDRESSES ============
async function loadWalletAddresses() {
    try {
        const { data: addresses, error } = await db.getWalletAddresses();
        
        if (addresses && addresses.length > 0) {
            walletAddresses = addresses;
        } else {
            walletAddresses = [];
        }
    } catch (error) {
        console.error('Wallet addresses loading error:', error);
        walletAddresses = [];
    }
}

// ============ SHOW DEPOSIT SECTION ============
async function showDeposit() {
    depositVisible = !depositVisible;
    withdrawVisible = false;
    
    document.getElementById('depositSection').classList.toggle('hidden', !depositVisible);
    document.getElementById('withdrawSection').classList.add('hidden');
    
    if (depositVisible) {
        await loadWalletAddresses();
        displayDepositAddresses();
    }
}

// ============ SHOW WITHDRAW SECTION ============
function showWithdraw() {
    withdrawVisible = !withdrawVisible;
    depositVisible = false;
    
    document.getElementById('withdrawSection').classList.toggle('hidden', !withdrawVisible);
    document.getElementById('depositSection').classList.add('hidden');
}

// ============ DISPLAY DEPOSIT ADDRESSES ============
function displayDepositAddresses() {
    const addressesContainer = document.getElementById('depositAddresses');
    
    if (walletAddresses.length === 0) {
        addressesContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">কোনো ডিপোজিট অ্যাড্রেস নেই</p>';
        return;
    }
    
    addressesContainer.innerHTML = walletAddresses.map(addr => `
        <div class="address-item">
            <div class="network-name">${addr.network_name}</div>
            <div class="address-value">${addr.address}</div>
            <button onclick="copyAddress('${addr.address}')" class="btn-secondary" style="margin-top: 10px; width: 100%;">
                📋 অ্যাড্রেস কপি করুন
            </button>
        </div>
    `).join('');
}

// ============ COPY ADDRESS ============
async function copyAddress(address) {
    try {
        await navigator.clipboard.writeText(address);
        showToast('✅ অ্যাড্রেস কপি হয়েছে!');
    } catch (error) {
        // Fallback
        showToast('অ্যাড্রেস: ' + address);
    }
}

// ============ REQUEST WITHDRAW ============
async function requestWithdraw() {
    const address = document.getElementById('withdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    
    // Validation
    if (!address) {
        showToast('⚠️ Wallet address দিন');
        return;
    }
    
    if (!amount || isNaN(amount)) {
        showToast('⚠️ সঠিক পরিমাণ দিন');
        return;
    }
    
    // Get settings for minimum withdraw
    const { data: settings } = await db.getSettings();
    const minWithdraw = settings?.min_withdraw || 10;
    
    if (amount < minWithdraw) {
        showToast(`⚠️ ন্যূনতম ${minWithdraw} DOGE প্রয়োজন`);
        return;
    }
    
    if (amount > currentUser.balance) {
        showToast('⚠️ অপর্যাপ্ত ব্যালেন্স');
        return;
    }
    
    try {
        // Calculate fee
        const withdrawFee = settings?.withdraw_fee || 0.5;
        const fee = (amount * withdrawFee) / 100;
        const totalDeduction = amount + fee;
        
        // Create withdraw request
        await db.createTransaction({
            user_id: currentUser.telegram_id,
            type: 'withdraw',
            amount: amount,
            fee: fee,
            address: address,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        
        // Deduct from balance
        await db.updateUser(currentUser.telegram_id, {
            balance: currentUser.balance - totalDeduction
        });
        
        showToast('✅ উইথড্র রিকোয়েস্ট সাবমিট হয়েছে');
        
        // Clear form
        document.getElementById('withdrawAddress').value = '';
        document.getElementById('withdrawAmount').value = '';
        
        // Hide withdraw section
        withdrawVisible = false;
        document.getElementById('withdrawSection').classList.add('hidden');
        
        // Refresh data
        await refreshUserData();
        await loadTransactions();
        
    } catch (error) {
        console.error('Withdraw error:', error);
        showToast('❌ উইথড্র প্রসেসিং এ সমস্যা হয়েছে');
    }
}

// ============ LOAD TRANSACTIONS ============
async function loadTransactions() {
    try {
        const { data: transactions, error } = await db.getUserTransactions(currentUser.telegram_id);
        
        if (transactions && transactions.length > 0) {
            const transactionList = document.getElementById('transactionList');
            
            transactionList.innerHTML = transactions.slice(0, 20).map(tx => {
                const typeIcon = tx.type === 'deposit' ? '📥' : 
                                tx.type === 'withdraw' ? '📤' : 
                                tx.type === 'mining' ? '⛏️' : 
                                tx.type === 'task' ? '📋' : '🔗';
                
                const statusColor = tx.status === 'completed' ? 'var(--success-color)' : 
                                   tx.status === 'pending' ? 'var(--warning-color)' : 
                                   'var(--danger-color)';
                
                const typeName = tx.type === 'deposit' ? 'ডিপোজিট' : 
                                tx.type === 'withdraw' ? 'উইথড্র' : 
                                tx.type === 'mining' ? 'মাইনিং' : 
                                tx.type === 'task' ? 'টাস্ক' : 'রেফারেল';
                
                return `
                    <div class="address-item">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${typeIcon} ${typeName}</span>
                            <span style="color: ${statusColor}; font-size: 12px;">
                                ${tx.status.toUpperCase()}
                            </span>
                        </div>
                        <div style="margin-top: 5px; font-weight: bold; color: var(--secondary-color);">
                            ${parseFloat(tx.amount).toFixed(2)} DOGE
                        </div>
                        ${tx.fee > 0 ? `<div style="font-size: 12px; color: var(--text-secondary);">Fee: ${tx.fee} DOGE</div>` : ''}
                        ${tx.address ? `<div style="font-size: 12px; color: var(--text-secondary); word-break: break-all;">To: ${tx.address}</div>` : ''}
                        <small style="color: var(--text-secondary); display: block; margin-top: 5px;">
                            ${new Date(tx.created_at).toLocaleString('bn-BD')}
                        </small>
                    </div>
                `;
            }).join('');
            
        } else {
            document.getElementById('transactionList').innerHTML = 
                '<p style="text-align: center; color: var(--text-secondary);">কোনো লেনদেন নেই</p>';
        }
    } catch (error) {
        console.error('Transaction loading error:', error);
        document.getElementById('transactionList').innerHTML = 
            '<p style="text-align: center; color: var(--danger-color);">লেনদেন লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ LOAD WALLET DATA ============
async function loadWalletData() {
    await Promise.all([
        loadTransactions(),
        loadWalletAddresses()
    ]);
}
