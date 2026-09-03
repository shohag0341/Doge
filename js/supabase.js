// Supabase Client Initialization
let supabase;

async function initSupabase() {
    try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        
        supabase = createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        
        console.log('✅ Supabase connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Supabase connection error:', error);
        return false;
    }
}

// Database Helper Functions
const db = {
    // ============ USER OPERATIONS ============
    async createUser(userData) {
        return await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
    },
    
    async getUser(userId) {
        return await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', userId)
            .single();
    },
    
    async updateUser(userId, updates) {
        return await supabase
            .from('users')
            .update(updates)
            .eq('telegram_id', userId);
    },
    
    async getAllUsers() {
        return await supabase
            .from('users')
            .select('*')
            .order('total_mined', { ascending: false });
    },
    
    // ============ MINING OPERATIONS ============
    async updateMining(userId, amount) {
        return await supabase.rpc('update_mining', {
            user_id_param: userId,
            amount_param: amount
        });
    },
    
    // ============ REFERRAL OPERATIONS ============
    async addReferral(referrerId, newUserId) {
        return await supabase
            .from('referrals')
            .insert([{
                referrer_id: referrerId,
                referred_id: newUserId,
                reward_paid: false
            }]);
    },
    
    async getReferrals(userId) {
        return await supabase
            .from('referrals')
            .select('*')
            .eq('referrer_id', userId);
    },
    
    // ============ TASK OPERATIONS ============
    async getTasks() {
        return await supabase
            .from('tasks')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
    },
    
    async createTask(taskData) {
        return await supabase
            .from('tasks')
            .insert([taskData])
            .select()
            .single();
    },
    
    async updateTask(taskId, updates) {
        return await supabase
            .from('tasks')
            .update(updates)
            .eq('id', taskId);
    },
    
    async deleteTask(taskId) {
        return await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);
    },
    
    // ============ USER TASK OPERATIONS ============
    async getUserTasks(userId) {
        return await supabase
            .from('user_tasks')
            .select('task_id')
            .eq('user_id', userId);
    },
    
    async completeTask(userId, taskId) {
        return await supabase
            .from('user_tasks')
            .insert([{
                user_id: userId,
                task_id: taskId
            }]);
    },
    
    // ============ PACKAGE OPERATIONS ============
    async getPackages() {
        return await supabase
            .from('packages')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });
    },
    
    async createPackage(packageData) {
        return await supabase
            .from('packages')
            .insert([packageData])
            .select()
            .single();
    },
    
    async updatePackage(packageId, updates) {
        return await supabase
            .from('packages')
            .update(updates)
            .eq('id', packageId);
    },
    
    async deletePackage(packageId) {
        return await supabase
            .from('packages')
            .delete()
            .eq('id', packageId);
    },
    
    // ============ TRANSACTION OPERATIONS ============
    async createTransaction(transactionData) {
        return await supabase
            .from('transactions')
            .insert([transactionData])
            .select()
            .single();
    },
    
    async getUserTransactions(userId) {
        return await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
    },
    
    // ============ LEADERBOARD OPERATIONS ============
    async getLeaderboard(period = 'all') {
        let query = supabase
            .from('users')
            .select('telegram_id, username, first_name, total_mined, daily_mined, weekly_mined, monthly_mined')
            .order('total_mined', { ascending: false })
            .limit(100);
        
        return await query;
    },
    
    // ============ SETTINGS OPERATIONS ============
    async getSettings() {
        return await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();
    },
    
    async updateSettings(updates) {
        return await supabase
            .from('settings')
            .update(updates)
            .eq('id', 1);
    },
    
    // ============ WALLET ADDRESS OPERATIONS ============
    async getWalletAddresses() {
        return await supabase
            .from('wallet_addresses')
            .select('*')
            .eq('is_active', true)
            .order('id', { ascending: true });
    },
    
    async createWalletAddress(addressData) {
        return await supabase
            .from('wallet_addresses')
            .insert([addressData])
            .select()
            .single();
    },
    
    async updateWalletAddress(addressId, updates) {
        return await supabase
            .from('wallet_addresses')
            .update(updates)
            .eq('id', addressId);
    },
    
    async deleteWalletAddress(addressId) {
        return await supabase
            .from('wallet_addresses')
            .delete()
            .eq('id', addressId);
    }
};
