// Leaderboard System
let currentLeaderboardPeriod = 'all';

// ============ LOAD LEADERBOARD ============
async function loadLeaderboard(period = 'all') {
    currentLeaderboardPeriod = period;
    
    try {
        const leaderboardContainer = document.getElementById('leaderboardList');
        
        // Show loading
        leaderboardContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">লোড হচ্ছে...</p>';
        
        // Get top users
        const { data: users, error } = await db.getLeaderboard(period);
        
        if (users && users.length > 0) {
            // Sort based on period
            let sortedUsers;
            switch (period) {
                case 'daily':
                    sortedUsers = users.sort((a, b) => parseFloat(b.daily_mined || 0) - parseFloat(a.daily_mined || 0));
                    break;
                case 'weekly':
                    sortedUsers = users.sort((a, b) => parseFloat(b.weekly_mined || 0) - parseFloat(a.weekly_mined || 0));
                    break;
                case 'monthly':
                    sortedUsers = users.sort((a, b) => parseFloat(b.monthly_mined || 0) - parseFloat(a.monthly_mined || 0));
                    break;
                default:
                    sortedUsers = users.sort((a, b) => parseFloat(b.total_mined || 0) - parseFloat(a.total_mined || 0));
            }
            
            leaderboardContainer.innerHTML = sortedUsers.slice(0, 20).map((user, index) => {
                const rank = index + 1;
                const earnings = period === 'daily' ? parseFloat(user.daily_mined || 0) :
                                period === 'weekly' ? parseFloat(user.weekly_mined || 0) :
                                period === 'monthly' ? parseFloat(user.monthly_mined || 0) :
                                parseFloat(user.total_mined || 0);
                
                // Mask username for privacy
                const maskedUsername = maskUsername(user.username);
                const maskedName = maskName(user.first_name);
                
                const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                
                return `
                    <div class="leaderboard-item">
                        <div class="rank ${rank <= 3 ? 'rank-' + rank : ''}">${rankIcon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: bold;">
                                ${maskedName} <small>@${maskedUsername}</small>
                            </div>
                            <div style="color: var(--text-secondary); font-size: 12px;">
                                ID: ${maskUserId(user.telegram_id)}
                            </div>
                        </div>
                        <div style="color: var(--secondary-color); font-weight: bold;">
                            ${earnings.toFixed(2)} DOGE
                        </div>
                    </div>
                `;
            }).join('');
            
        } else {
            leaderboardContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">কোনো ইউজার নেই</p>';
        }
    } catch (error) {
        console.error('Leaderboard loading error:', error);
        document.getElementById('leaderboardList').innerHTML = 
            '<p style="text-align: center; color: var(--danger-color);">লিডারবোর্ড লোড করতে সমস্যা হয়েছে</p>';
    }
}

// ============ FILTER LEADERBOARD ============
function filterLeaderboard(period) {
    // Update active filter button
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    loadLeaderboard(period);
}

// ============ MASKING FUNCTIONS ============
function maskUsername(username) {
    if (!username) return 'anonymous';
    if (username.length <= 4) return username;
    return username.slice(0, 2) + '***' + username.slice(-2);
}

function maskName(name) {
    if (!name) return 'User';
    if (name.length <= 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function maskUserId(id) {
    const idStr = id.toString();
    if (idStr.length <= 4) return '***';
    return idStr.slice(0, 3) + '****' + idStr.slice(-3);
}
