// Spin Wheel — deposit-balance-only gambling feature
let spinSegments = [];
let spinConfigData = { min_bet: 1, max_bet: 100 };
let spinInProgress = false;
let wheelRotation = 0;

// ============ LOAD ============
async function loadSpinWheel() {
    try {
        const { data: segments } = await supabase
            .from('spin_segments').select('*').eq('is_active', true).order('sort_order');
        const { data: config } = await supabase
            .from('spin_config').select('*').eq('id', 1).single();

        spinSegments = computeSegmentAngles(segments || []);
        spinConfigData = config || spinConfigData;

        renderSpinTab();
    } catch (error) {
        console.error('Spin wheel load error:', error);
        const container = document.getElementById('spinContent');
        if (container) container.innerHTML = '<p style="text-align:center; color: var(--danger-color);">Failed to load spin wheel</p>';
    }
}

function computeSegmentAngles(segments) {
    const totalWeight = segments.reduce((sum, s) => sum + Number(s.weight), 0) || 1;
    let cursor = 0;
    return segments.map(seg => {
        const sliceAngle = 360 * Number(seg.weight) / totalWeight;
        const start = cursor;
        const end = cursor + sliceAngle;
        cursor = end;
        return Object.assign({}, seg, { startAngle: start, endAngle: end, sliceAngle: sliceAngle });
    });
}

// ============ RENDER MAIN TAB ============
function renderSpinTab() {
    const container = document.getElementById('spinContent');
    if (!container) return;

    const depositBalance = parseFloat((currentUser && currentUser.deposit_balance) || 0);

    container.innerHTML = `
        <div class="balance-hero" style="margin-bottom: 15px;">
            <div class="balance-hero-label"><span class="live-dot"></span> Deposit Balance</div>
            <div class="balance-hero-figure">
                <span id="depositBalanceDisplay">${depositBalance.toFixed(2)}</span>
                <span class="balance-hero-unit">DOGE</span>
            </div>
            <div class="balance-hero-footer">
                <button onclick="showDepositForm()" class="btn-secondary" style="flex:1; margin-right: 8px; background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.3);">➕ Deposit</button>
                <button onclick="showWithdrawDepositForm()" class="btn-secondary" style="flex:1; background: rgba(255,255,255,0.15); color: #fff; border-color: rgba(255,255,255,0.3);">📤 Withdraw</button>
            </div>
        </div>

        <div class="mining-container">
            <div id="spinWheelSvgContainer"></div>

            <div style="margin: 20px 0;">
                <label style="font-size: 13px; color: var(--text-secondary); display: block; margin-bottom: 8px;">Bet Amount (DOGE)</label>
                <input type="number" id="spinBetAmount" min="${spinConfigData.min_bet}" max="${spinConfigData.max_bet}"
                       step="0.1" value="${spinConfigData.min_bet}"
                       oninput="updatePotentialWinnings()"
                       style="width: 100%; padding: 14px; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary); font-size: 18px; font-weight: 700; text-align: center;">

                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button onclick="setQuickBet(${spinConfigData.min_bet})" class="btn-secondary" style="flex:1; padding: 8px;">Min</button>
                    <button onclick="setQuickBet(${(spinConfigData.min_bet + spinConfigData.max_bet) / 4})" class="btn-secondary" style="flex:1; padding: 8px;">25%</button>
                    <button onclick="setQuickBet(${(spinConfigData.min_bet + spinConfigData.max_bet) / 2})" class="btn-secondary" style="flex:1; padding: 8px;">50%</button>
                    <button onclick="setQuickBet(${spinConfigData.max_bet})" class="btn-secondary" style="flex:1; padding: 8px;">Max</button>
                </div>

                <p id="spinMaxWin" style="text-align: center; color: var(--text-secondary); font-size: 13px; margin-top: 10px;"></p>
            </div>

            <button id="spinButton" onclick="performSpin()" class="btn-primary big-btn">🎰 SPIN</button>
        </div>

        <div class="mining-container" style="margin-top: 15px;">
            <h3 style="font-size: 15px; margin-bottom: 10px;">🕓 Recent Spins</h3>
            <div id="spinHistoryList"></div>
        </div>
    `;

    renderWheelSVG();
    updatePotentialWinnings();
    loadSpinHistory();
}

// ============ WHEEL SVG ============
function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = (endAngle - startAngle) <= 180 ? '0' : '1';
    return [
        'M', cx, cy,
        'L', start.x, start.y,
        'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
        'L', cx, cy
    ].join(' ');
}

function renderWheelSVG(betAmount) {
    const container = document.getElementById('spinWheelSvgContainer');
    if (!container || spinSegments.length === 0) return;

    const cx = 150, cy = 150, r = 145;
    const bet = betAmount || 0;

    let inner = '';
    spinSegments.forEach(function (seg) {
        const d = describeArc(cx, cy, r, seg.startAngle, seg.endAngle);
        const mid = (seg.startAngle + seg.endAngle) / 2;
        const labelPos = polarToCartesian(cx, cy, r * 0.62, mid);
        const labelText = bet > 0
            ? (Number(seg.multiplier) > 0 ? (bet * Number(seg.multiplier)).toFixed(1) : 'LOSE')
            : seg.label;

        inner += `<path d="${d}" fill="${seg.color}" stroke="#fff" stroke-width="2"/>`;
        inner += `<text x="${labelPos.x}" y="${labelPos.y}" fill="#fff" font-size="12" font-weight="700"
                        text-anchor="middle" dominant-baseline="middle"
                        transform="rotate(${mid}, ${labelPos.x}, ${labelPos.y})">${labelText}</text>`;
    });

    container.innerHTML = `
        <div style="position: relative; width: 280px; height: 280px; margin: 10px auto;">
            <div style="position:absolute; top:-8px; left:50%; transform:translateX(-50%) rotate(180deg); z-index:5; font-size:26px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));">🔻</div>
            <svg id="spinWheelSvg" viewBox="0 0 300 300"
                 style="width:100%; height:100%; border-radius:50%; box-shadow: 0 12px 30px -8px rgba(11,79,73,0.5); transform: rotate(${wheelRotation}deg); transition: transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99);">
                ${inner}
                <circle cx="150" cy="150" r="24" fill="#0B4F49" stroke="#fff" stroke-width="3"/>
            </svg>
        </div>
    `;
}

// ============ LIVE BET PREVIEW ============
function updatePotentialWinnings() {
    const betInput = document.getElementById('spinBetAmount');
    const bet = parseFloat(betInput && betInput.value) || 0;

    renderWheelSVG(bet);

    let maxMultiplier = 0;
    spinSegments.forEach(function (s) {
        if (Number(s.multiplier) > maxMultiplier) maxMultiplier = Number(s.multiplier);
    });

    const maxWinEl = document.getElementById('spinMaxWin');
    if (maxWinEl) {
        maxWinEl.textContent = bet > 0
            ? `Max possible win: ${(bet * maxMultiplier).toFixed(2)} DOGE`
            : '';
    }
}

function setQuickBet(amount) {
    const betInput = document.getElementById('spinBetAmount');
    if (!betInput) return;
    const clamped = Math.max(spinConfigData.min_bet, Math.min(spinConfigData.max_bet, amount));
    betInput.value = clamped.toFixed(2);
    updatePotentialWinnings();
}

// ============ SPIN ACTION ============
function spinToAngle(targetAngleDeg) {
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const neededMod = (360 - targetAngleDeg + 360) % 360;
    let delta = neededMod - currentMod;
    if (delta <= 0) delta += 360;
    wheelRotation += delta + (6 * 360);

    const svg = document.getElementById('spinWheelSvg');
    if (svg) svg.style.transform = `rotate(${wheelRotation}deg)`;
}

async function performSpin() {
    if (spinInProgress) return;

    const betInput = document.getElementById('spinBetAmount');
    const bet = parseFloat(betInput && betInput.value);

    if (!bet || bet <= 0) {
        showToast('⚠️ Enter a valid bet amount');
        return;
    }
    if (bet < spinConfigData.min_bet || bet > spinConfigData.max_bet) {
        showToast(`⚠️ Bet must be between ${spinConfigData.min_bet} and ${spinConfigData.max_bet} DOGE`);
        return;
    }
    if (bet > parseFloat((currentUser && currentUser.deposit_balance) || 0)) {
        showToast('⚠️ Insufficient deposit balance');
        return;
    }

    spinInProgress = true;
    const spinBtn = document.getElementById('spinButton');
    if (spinBtn) spinBtn.disabled = true;

    try {
        const result = await callEdgeFunction('spin-wheel', { betAmount: bet });

        if (!result.ok) {
            spinInProgress = false;
            if (spinBtn) spinBtn.disabled = false;
            const err = (result.data && result.data.error) || 'unknown';
            if (err === 'cooldown') {
                showToast(`⏳ Please wait ${Math.ceil((result.data.remaining_ms || 0) / 1000)}s before spinning again`);
            } else if (err === 'insufficient_deposit_balance') {
                showToast('⚠️ Insufficient deposit balance');
            } else if (err === 'bet_out_of_range') {
                showToast(`⚠️ Bet must be between ${result.data.min_bet} and ${result.data.max_bet} DOGE`);
            } else {
                showToast('❌ Spin failed: ' + err);
            }
            return;
        }

        const winningSegment = spinSegments.find(function (s) { return s.id === result.data.segment_id; });
        if (winningSegment) {
            const padding = Math.min(4, winningSegment.sliceAngle / 4);
            const target = winningSegment.startAngle + padding + Math.random() * (winningSegment.sliceAngle - 2 * padding);
            spinToAngle(target);
        }

        setTimeout(function () {
            spinInProgress = false;
            if (spinBtn) spinBtn.disabled = false;

            const payout = result.data.payout;
            const net = payout - bet;

            if (net > 0) {
                showToast(`🎉 ${result.data.label}! You won ${payout.toFixed(2)} DOGE!`);
            } else if (net === 0) {
                showToast(`😐 ${result.data.label} — you broke even.`);
            } else {
                showToast(`😢 ${result.data.label} — better luck next time!`);
            }

            if (currentUser) currentUser.deposit_balance = result.data.new_balance;
            const balEl = document.getElementById('depositBalanceDisplay');
            if (balEl) balEl.textContent = parseFloat(result.data.new_balance).toFixed(2);

            loadSpinHistory();
        }, 4700);
    } catch (error) {
        console.error('Spin error:', error);
        spinInProgress = false;
        if (spinBtn) spinBtn.disabled = false;
        showToast('❌ Spin failed');
    }
}

// ============ HISTORY ============
async function loadSpinHistory() {
    const container = document.getElementById('spinHistoryList');
    if (!container || !currentUser) return;

    try {
        const { data } = await supabase
            .from('spin_history')
            .select('*')
            .eq('user_id', currentUser.telegram_id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!data || data.length === 0) {
            container.innerHTML = '<p style="text-align:center; color: var(--text-secondary); font-size: 13px;">No spins yet</p>';
            return;
        }

        container.innerHTML = data.map(function (h) {
            const net = h.payout - h.bet_amount;
            const color = net >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
            return `
                <div class="address-item" style="padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${h.segment_label}</span>
                        <strong style="color: ${color};">${net >= 0 ? '+' : ''}${net.toFixed(2)} DOGE</strong>
                    </div>
                    <small style="color: var(--text-secondary);">Bet: ${parseFloat(h.bet_amount).toFixed(2)} | ${new Date(h.created_at).toLocaleString()}</small>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Spin history error:', error);
    }
}

// ============ DEPOSIT ============
async function showDepositForm() {
    try {
        const { data: addresses } = await db.getWalletAddresses();

        if (!addresses || addresses.length === 0) {
            showToast('❌ No deposit address available');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'depositModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 480px; max-height: 80vh; overflow-y: auto;">
                <h2>💵 Deposit</h2>
                <p style="text-align: left; margin: 10px 0;">Send USDT to any address below, then submit the form with your reference.</p>
                ${addresses.map(addr => `
                    <div style="background: var(--page-background); padding: 10px; border-radius: 12px; margin-bottom: 10px; text-align: left;">
                        <strong>${addr.network_name}</strong>
                        <p style="font-size: 12px; word-break: break-all; margin: 5px 0;">${addr.address}</p>
                        <button onclick="copyAddress('${addr.address}')" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">📋 Copy</button>
                    </div>
                `).join('')}
                <form onsubmit="submitDepositRequest(event)" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <input type="number" id="depositAmount" placeholder="Amount (USDT)" step="0.01" required
                           style="padding: 12px; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary);">
                    <input type="text" id="depositReference" placeholder="Your Wallet Address or Binance ID" required
                           style="padding: 12px; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary);">
                    <input type="text" id="depositTxHash" placeholder="Transaction Hash (optional)"
                           style="padding: 12px; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary);">
                    <div style="display: flex; gap: 10px;">
                        <button type="submit" class="btn-primary" style="flex:1;">Submit</button>
                        <button type="button" onclick="closeDepositForm()" class="btn-secondary" style="flex:1;">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Deposit form error:', error);
        showToast('❌ Could not open deposit form');
    }
}

function closeDepositForm() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.remove();
}

async function submitDepositRequest(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const reference = document.getElementById('depositReference').value.trim();
    const txHash = document.getElementById('depositTxHash').value.trim();

    if (!amount || amount <= 0) { showToast('⚠️ Enter a valid amount'); return; }
    if (!reference) { showToast('⚠️ Enter a reference'); return; }

    try {
        const result = await callEdgeFunction('request-deposit', { amount: amount, reference: reference, txHash: txHash });
        if (!result.ok) {
            showToast('❌ ' + ((result.data && result.data.error) || 'Failed to submit'));
            return;
        }
        closeDepositForm();
        showToast('✅ Deposit request submitted! Waiting for admin approval');
    } catch (error) {
        console.error('Deposit submit error:', error);
        showToast('❌ Could not submit deposit');
    }
}

// ============ DEPOSIT-BALANCE WITHDRAW ============
function showWithdrawDepositForm() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'depositWithdrawModal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>📤 Withdraw (Deposit Balance)</h2>
            <p>Available: ${parseFloat((currentUser && currentUser.deposit_balance) || 0).toFixed(2)} DOGE</p>
            <input type="text" id="depositWithdrawAddress" placeholder="Wallet Address"
                   style="width: 100%; padding: 12px; margin: 10px 0; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary);">
            <input type="number" id="depositWithdrawAmount" placeholder="Amount"
                   style="width: 100%; padding: 12px; margin: 10px 0; border: 1.5px solid #DCEEEA; border-radius: 12px; background: var(--page-background); color: var(--text-primary);">
            <div class="modal-buttons">
                <button onclick="requestDepositWithdraw()" class="btn-primary">Submit</button>
                <button onclick="closeDepositWithdrawForm()" class="btn-secondary">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeDepositWithdrawForm() {
    const modal = document.getElementById('depositWithdrawModal');
    if (modal) modal.remove();
}

async function requestDepositWithdraw() {
    const address = document.getElementById('depositWithdrawAddress').value.trim();
    const amount = parseFloat(document.getElementById('depositWithdrawAmount').value);

    if (!address) { showToast('⚠️ Enter wallet address'); return; }
    if (!amount || isNaN(amount)) { showToast('⚠️ Enter a valid amount'); return; }

    try {
        const result = await callEdgeFunction('request-withdraw', { address: address, amount: amount, balanceType: 'deposit' });

        if (!result.ok) {
            const err = (result.data && result.data.error) || 'unknown';
            if (err === 'below_minimum') {
                showToast(`⚠️ Minimum ${result.data.min_withdraw} DOGE required`);
            } else if (err === 'insufficient_balance') {
                showToast('⚠️ Insufficient balance');
            } else if (err === 'withdraw_already_pending') {
                showToast('⚠️ You already have a pending withdraw for this balance');
            } else {
                showToast('❌ ' + err);
            }
            return;
        }

        closeDepositWithdrawForm();
        showToast('✅ Withdraw request submitted');
        await refreshUserData();
        const balEl = document.getElementById('depositBalanceDisplay');
        if (balEl && currentUser) balEl.textContent = parseFloat(currentUser.deposit_balance || 0).toFixed(2);
    } catch (error) {
        console.error('Deposit withdraw error:', error);
        showToast('❌ Error processing withdraw');
    }
                             }
                                            
