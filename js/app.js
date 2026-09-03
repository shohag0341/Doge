// Main App Logic
let appInitialized = false;

// Tab Management
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const tabContent = document.getElementById(tabName + 'Content');
    const tabButton = document.getElementById(tabName + 'Tab');
    
    if (tabContent && tabButton) {
        tabContent.classList.remove('hidden');
        tabButton.classList.add('active');
        
        // Load tab-specific data
        switch (tabName) {
            case 'home':
                loadHomeData();
                break;
            case 'mining':
                loadMiningData();
                break;
            case 'tasks':
                loadTasks();
                break;
            case 'wallet':
                loadWalletData();
                break;
            case 'leaderboard':
                loadLeaderboard();
                break;
        }
    }
}

function loadHomeData() {
    refreshUserData();
    checkDailyStatus();
}

function loadMiningData() {
    loadMiningSettings();
    loadUpgradePackages();
    checkPackageExpiry();
    
    // Check if mining is active
    if (currentUser && currentUser.mining_active) {
        miningActive = true;
        miningStartTime = new Date(currentUser.mining_start_time).getTime();
        document.getElementById('startMiningBtn').innerHTML = '⏸️ মাইনিং বন্ধ করুন';
        document.getElementById('miningStatus').textContent = '⛏️ মাইনিং চলছে...';
        
        if (!miningInterval) {
            miningInterval = setInterval(updateMiningProgress, 1000);
        }
    }
}

function loadWalletData() {
    loadTransactions();
    loadWalletAddresses();
}

function showSettings() {
    if (currentUser?.is_admin) {
        showAdminPanel();
    } else {
        showToast('⚙️ সেটিংস শীঘ্রই আসছে');
    }
}

// Add CSS animations for toast
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
    
    @keyframes slideDown {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, 20px); }
    }
`;
document.head.appendChild(styleSheet);

// Initialize App
async function initApp() {
    try {
        // Show loading screen
        document.getElementById('loadingScreen').classList.remove('hidden');
        
        // Initialize Supabase
        const supabaseReady = await initSupabase();
        
        if (!supabaseReady) {
            showError('সার্ভার সংযোগ স্থাপন করা যায়নি');
            document.getElementById('loadingScreen').classList.add('hidden');
            return;
        }
        
        // Initialize authentication
        await initAuth();
        
        // Load initial data
        await loadInitialData();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            
            // Show home tab by default
            showTab('home');
            
            appInitialized = true;
        }, 1000);
        
    } catch (error) {
        console.error('App initialization error:', error);
        showError('অ্যাপ লোড করতে সমস্যা হয়েছে');
        document.getElementById('loadingScreen').classList.add('hidden');
    }
}

// Load all initial data
async function loadInitialData() {
    try {
        await Promise.all([
            loadMiningSettings(),
            loadUserTasks(),
            loadWalletAddresses()
        ]);
        
        console.log('✅ Initial data loaded');
    } catch (error) {
        console.error('Initial data loading error:', error);
    }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
