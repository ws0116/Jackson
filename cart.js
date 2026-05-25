// ── JACKSON充值中心 - 核心购物车与结算逻辑脚本 (js/cart.js) ──

// ── Storage 仓储管理 ────────────────────────────────────────────────────
const CART_KEY = 'jackson_cart';
const ORDER_KEY = 'jackson_last_order';

function getCart()      { try { return JSON.parse(sessionStorage.getItem(CART_KEY)||'[]'); } catch { return []; } }
function saveCart(cart) { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function cartTotal()    { return getCart().reduce((s,i)=>s+i.price*i.qty,0); }
function cartCount()    { return getCart().reduce((s,i)=>s+i.qty,0); }

// ── Add / Remove 商品添加与移除 ───────────────────────────────────────────────
function addToCart(id, game, name, price) {
  const cart = getCart();
  const idx  = cart.findIndex(i=>i.id===id);
  if(idx>-1) cart[idx].qty++;
  else cart.push({id, game, name, price, qty:1});
  saveCart(cart);
  refreshUI();
}

function removeFromCart(id) {
  const cart = getCart();
  const idx  = cart.findIndex(i=>i.id===id);
  if(idx===-1) return;
  cart[idx].qty--;
  if(cart[idx].qty<=0) cart.splice(idx,1);
  saveCart(cart);
  refreshUI();
}

function changeQty(id, delta) {
  const cart = getCart();
  const idx  = cart.findIndex(i=>i.id===id);
  if(idx===-1) return;
  cart[idx].qty += delta;
  if(cart[idx].qty<=0) cart.splice(idx,1);
  saveCart(cart);
  refreshUI();
}

// ── 清空购物车功能 ────────────────────────────────────────────────────────
function clearCart() {
  if (confirm('确定要清空购物车吗？')) {
    saveCart([]);
    sessionStorage.setItem('jackson_cart_cleared', '1'); // 标记已清空，供返回页检测
    refreshUI();
  }
}

// ── UI 强制刷新控制器 (解决返回上一页依然被选中的核心) ─────────────────────────
function refreshUI() {
  updateCartBar();
  syncCards();
  if(typeof renderCartPage === 'function') renderCartPage();
}

// ── Cart Bar 底部购物车浮条更新 ───────────────────────────────────────────────────
function updateCartBar() {
  const count = cartCount();
  const total = cartTotal();
  document.querySelectorAll('.cart-bar').forEach(bar => {
    const badge = bar.querySelector('.cart-badge');
    const tot   = bar.querySelector('.cart-total');
    if (badge) badge.textContent = count;
    if (tot)   tot.textContent   = 'RM ' + total.toFixed(2);
    bar.style.opacity = count > 0 ? '1' : '0.5';
  });
}

// ── Sync card UI 同步商品卡片上的数量与高亮状态 ──────────────────────────────────────────────
function syncCards() {
  const cart = getCart();
  document.querySelectorAll('.product-card[data-id], .product-list-item[data-id]').forEach(el => {
    const id   = el.dataset.id;
    const item = cart.find(i=>i.id===id);
    const qty  = item ? item.qty : 0;
    
    // 强制更新卡片的选中框状态
    el.classList.toggle('selected', qty > 0);
    
    // 强制更新加减按钮与数量显示
    const controls = el.querySelector('.card-controls, .list-controls');
    if(controls) {
      const minusBtn = controls.querySelector('.remove-btn');
      const qtyNum   = controls.querySelector('.qty-num');
      const addBtn   = controls.querySelector('.add-btn');
      if(qty > 0) {
        if(minusBtn) minusBtn.style.display = 'flex';
        if(qtyNum)   { qtyNum.style.display = 'flex'; qtyNum.textContent = qty; }
        if(addBtn)   addBtn.style.borderRadius = '0 8px 8px 0';
      } else {
        if(minusBtn) minusBtn.style.display = 'none';
        if(qtyNum)   qtyNum.style.display   = 'none';
        if(addBtn)   addBtn.style.borderRadius = '8px';
      }
    }
    
    // 强制更新右上角的小角标
    const badge = el.querySelector('.badge');
    if(badge) { 
      badge.textContent = qty; 
      badge.style.display = qty > 0 ? '' : 'none'; 
    }
  });
}

// ── Detect game from cart 从购物车自动识别当前游戏种类 ──────────────────────────────────────
function detectGame() {
  const cart = getCart();
  if(!cart.length) return '';
  const g = cart[0].game || '';
  return g.replace(/[\(（][^)）]*[\)）]/g,'').trim();
}

// ── Checkout Sheet 结算弹窗组件 ─────────────────────────────────────────────
function openCheckout() {
  const overlay = document.getElementById('checkoutOverlay');
  if(overlay) { overlay.classList.add('open'); renderCheckoutForm(); }
}

function closeCheckout() {
  const overlay = document.getElementById('checkoutOverlay');
  if(overlay) overlay.classList.remove('open');
}

function renderCheckoutForm() {
  const content = document.getElementById('checkoutContent');
  if(!content) return;
  const cart  = getCart();
  const total = cartTotal();

  // 按游戏+平台分组（安卓和苹果分开各一个区）
  const gameGroups = {};
  cart.forEach(c => {
    let groupKey = c.game;
    // 和平精英和王者荣耀：安卓和苹果分开
    if (c.id.startsWith('hpjy-and-')) groupKey = '和平精英(安卓)';
    else if (c.id.startsWith('hpjy-ios-')) groupKey = '和平精英(苹果)';
    else if (c.id.startsWith('wzry-and-')) groupKey = '王者荣耀(安卓)';
    else if (c.id.startsWith('wzry-ios-')) groupKey = '王者荣耀(苹果)';
    if (!gameGroups[groupKey]) gameGroups[groupKey] = [];
    gameGroups[groupKey].push(c);
  });
  const gameKeys = Object.keys(gameGroups);

  function platformForGame(gameName, items) {
    // 先从 groupKey 名称判断
    if (gameName.includes('(安卓)')) return { key: 'android', label: '🤖 安卓 (Android)' };
    if (gameName.includes('(苹果)')) return { key: 'ios',     label: '🍎 苹果 (iOS)' };
    const id = items[0].id || '';
    if (id.includes('-and-'))          return { key: 'android', label: '🤖 安卓 (Android)' };
    if (id.includes('-ios-'))          return { key: 'ios',     label: '🍎 苹果 (iOS)' };
    if (gameName.includes('无畏契约')) return { key: 'pc',      label: '💻 PC (电脑)' };
    return { key: 'android', label: '🤖 安卓 (Android)' };
  }

  function gameFormSection(gameName, items, idx) {
    const platform = platformForGame(gameName, items);
    const isWzry   = gameName.includes('王者荣耀');
    const isWwqy   = gameName.includes('无畏契约');
    const isPC     = platform.key === 'pc';

    // wwqy: show dual buttons; hpjy/wzry: auto-detected from groupKey, show readonly label; pc: fixed PC
    const isPlatformAutoDetected = gameName.includes('(安卓)') || gameName.includes('(苹果)');
    let sysField;
    if (isPlatformAutoDetected) {
      // Platform is baked into the groupKey — show readonly
      const sysEmoji = platform.key === 'ios' ? '🍎' : '🤖';
      const sysText  = platform.key === 'ios' ? '苹果 (iOS)' : '安卓 (Android)';
      sysField = `
        <div class="co-field">
          <label>系统</label>
          <input type="text" value="${sysEmoji} ${sysText}" readonly style="opacity:0.85;cursor:default;background:var(--bg3);">
          <input type="hidden" id="f-system-${idx}" value="${sysEmoji} ${sysText}">
          <input type="hidden" id="f-system-key-${idx}" value="${platform.key}">
        </div>`;
    } else if (isPC && !isWwqy) {
      sysField = `
        <input type="hidden" id="f-system-${idx}" value="💻 PC (电脑)">
        <input type="hidden" id="f-system-key-${idx}" value="pc">`;
    } else if (isWwqy) {
      // 无畏契约: show dual buttons, default android
      const defKey = platform.key === 'ios' ? 'ios' : 'android';
      sysField = `
        <div class="co-field">
          <label>系统</label>
          <div style="display:flex;gap:8px;">
            <button type="button" id="sys-btn-android-${idx}" onclick="selectSystem('android',${idx})"
              style="flex:1;padding:10px 8px;border-radius:10px;border:2px solid ${defKey==='android'?'var(--pink)':'var(--border)'};background:${defKey==='android'?'rgba(255,77,141,0.15)':'var(--bg3)'};color:${defKey==='android'?'var(--pink-lite)':'var(--text-dim)'};font-size:14px;font-weight:700;cursor:pointer;transition:all 0.18s;font-family:inherit;">🤖 安卓</button>
            <button type="button" id="sys-btn-ios-${idx}" onclick="selectSystem('ios',${idx})"
              style="flex:1;padding:10px 8px;border-radius:10px;border:2px solid ${defKey==='ios'?'var(--pink)':'var(--border)'};background:${defKey==='ios'?'rgba(255,77,141,0.15)':'var(--bg3)'};color:${defKey==='ios'?'var(--pink-lite)':'var(--text-dim)'};font-size:14px;font-weight:700;cursor:pointer;transition:all 0.18s;font-family:inherit;">🍎 苹果</button>
          </div>
          <input type="hidden" id="f-system-${idx}" value="${platform.label}">
          <input type="hidden" id="f-system-key-${idx}" value="${defKey}">
        </div>`;
    } else {
      // hpjy / wzry without explicit platform suffix (fallback): auto-detected, readonly
      const sysEmoji = platform.key === 'ios' ? '🍎' : '🤖';
      const sysText  = platform.key === 'ios' ? '苹果 (iOS)' : '安卓 (Android)';
      sysField = `
        <div class="co-field">
          <label>系统</label>
          <input type="text" value="${sysEmoji} ${sysText}" readonly style="opacity:0.85;cursor:default;background:var(--bg3);">
          <input type="hidden" id="f-system-${idx}" value="${sysEmoji} ${sysText}">
          <input type="hidden" id="f-system-key-${idx}" value="${platform.key}">
        </div>`;
    }

    // Clean game name (strip platform suffix for order message)
    const cleanGame = gameName.replace('(安卓)', '').replace('(苹果)', '').trim();
    const platformLabel = gameName.includes('(安卓)') ? '🤖 安卓' : gameName.includes('(苹果)') ? '🍎 苹果' : '';

    return `
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:700;color:var(--pink-lite);margin-bottom:12px;">🎮 ${cleanGame}${platformLabel ? ' · ' + platformLabel : ''}</div>
        <input type="hidden" id="f-game-${idx}" value="${cleanGame}">
        ${isWzry ? `<div class="co-field"><label>大区 <span style="color:var(--text-dim);font-weight:400">（王者荣耀请填写）</span></label><input type="text" id="f-daqu-${idx}" placeholder="例: 100区 暗夜猫娘"></div>` : ''}
        ${sysField}
        <div class="co-field">
          <label>充值方式 <span class="req">*</span></label>
          <select id="f-method-${idx}" onchange="showRechargeGuide(${idx})">
            <option value="">-- 请选择 --</option>
            ${(()=>{
              const isIOS = gameName.includes('(苹果)');
              const isHpjy = gameName.includes('和平精英');
              // 王者苹果: 链接充值 only
              // 和平苹果: 链接充值 only (no 扫码)
              // 王者安卓: 扫码 + 好友代付 + 链接
              // 其他: 扫码 + 链接
              if (isIOS) {
                return '<option value="link">链接充值</option>';
              }
              let opts = '<option value="scan">扫码充值</option>';
              if (isWzry) opts += '<option value="friend">好友代付</option>';
              opts += '<option value="link">链接充值</option>';
              return opts;
            })()}
          </select>
        </div>
        <div id="rechargeGuide-${idx}"></div>
        <div class="co-field">
          <label>游戏名字 (游戏内昵称) <span class="req">*</span></label>
          <input type="text" id="f-nick-${idx}" placeholder="请输入游戏内昵称">
        </div>
        <div class="co-field">
          <label>微信名字 <span class="req">*</span></label>
          <input type="text" id="f-wx-${idx}" placeholder="请输入微信名字">
        </div>
        <div class="co-field">
          <label>备注 (可选)</label>
          <textarea id="f-remark-${idx}" placeholder="其他说明..." style="min-height:60px;"></textarea>
        </div>
      </div>`;
  }

  content.innerHTML = `
    <div class="co-header">
      <div class="co-title">🛒 确认订单</div>
      <button class="co-close" onclick="closeCheckout()">✕</button>
    </div>
    <div class="co-order-summary">
      ${cart.map(c=>`
        <div class="co-item">
          <span>${c.game} ${c.name}</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--pink-lite);font-weight:700">RM ${(c.price*c.qty).toFixed(2)}</span>
            <div style="display:flex;align-items:center;gap:0;background:var(--bg3);border-radius:16px;border:1px solid var(--border)">
              <button onclick="changeQty('${c.id}',-1)" style="width:28px;height:28px;border:none;background:transparent;color:var(--pink-lite);font-size:16px;font-weight:700;cursor:pointer;border-radius:16px 0 0 16px;display:flex;align-items:center;justify-content:center">−</button>
              <span style="min-width:22px;text-align:center;font-size:13px;font-weight:700;color:var(--text)">${c.qty}</span>
              <button onclick="changeQty('${c.id}',1)" style="width:28px;height:28px;border:none;background:transparent;color:var(--pink-lite);font-size:16px;font-weight:700;cursor:pointer;border-radius:0 16px 16px 0;display:flex;align-items:center;justify-content:center">+</button>
            </div>
          </div>
        </div>`).join('')}
      <div class="co-total-row" style="margin-bottom:4px"><span>合计</span><span class="co-total-amt">RM ${total.toFixed(2)}</span></div>
      ${(()=>{
        const groupPts = {};
        const groupOrder = [];
        cart.forEach(c => {
          let gk;
          if      (c.id.startsWith('hpjy-and-')) gk = '🤖 和平安卓';
          else if (c.id.startsWith('hpjy-ios-')) gk = '🍎 和平苹果';
          else if (c.id.startsWith('wzry-and-')) gk = '🤖 王者安卓';
          else if (c.id.startsWith('wzry-ios-')) gk = '🍎 王者苹果';
          else if (c.id.startsWith('wwqy-'))     gk = '🎯 无畏契约';
          else gk = c.game;
          const m = c.name.match(/(\d+)\s*点卷/);
          const pts = m ? parseInt(m[1]) * c.qty : 0;
          if (pts > 0) {
            if (!groupPts[gk]) { groupPts[gk] = 0; groupOrder.push(gk); }
            groupPts[gk] += pts;
          }
        });
        const rows = groupOrder.map(gk =>
          `<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);padding-top:4px;"><span>点卷 · ${gk}</span><span style="color:var(--pink-lite);font-weight:700">${groupPts[gk].toLocaleString()} 点卷</span></div>`
        ).join('');
        const totalPts2 = Object.values(groupPts).reduce((a,b)=>a+b,0);
        if (!totalPts2) return '';
        return `<div style="border-top:1px solid var(--border);padding-top:6px;">${rows}</div>`;
      })()}
    </div>
    <div class="co-form">
      <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:14px;">📋 填写个人信息</div>
      ${gameKeys.map((g,i) => gameFormSection(g, gameGroups[g], i)).join('')}
    </div>
    <button class="co-submit-btn" onclick="submitOrder()">✅ 提交订单</button>
    <button class="co-back-btn" onclick="closeCheckout()">← 继续选购</button>`;

  content.dataset.gameCount = gameKeys.length;
  content.dataset.gameKeys  = JSON.stringify(gameKeys);
}


// ── 系统切换：安卓 / 苹果 ────────────────────────────────────────────────────
function selectSystem(key, idx) {
  const labelMap = { android: '🤖 安卓 (Android)', ios: '🍎 苹果 (iOS)', pc: '💻 PC (电脑)' };
  const fSys    = document.getElementById('f-system-' + idx);
  const fSysKey = document.getElementById('f-system-key-' + idx);
  if (fSys)    fSys.value    = labelMap[key] || key;
  if (fSysKey) fSysKey.value = key;

  ['android','ios'].forEach(k => {
    const btn = document.getElementById('sys-btn-' + k + '-' + idx);
    if (!btn) return;
    const active = (k === key);
    btn.style.borderColor = active ? 'var(--pink)'           : 'var(--border)';
    btn.style.background  = active ? 'rgba(255,77,141,0.15)' : 'var(--bg3)';
    btn.style.color       = active ? 'var(--pink-lite)'      : 'var(--text-dim)';
  });

  // Rebuild method options when system changes (important for 无畏契约)
  const methodSelect = document.getElementById('f-method-' + idx);
  if (methodSelect) {
    const gameInput = document.getElementById('f-game-' + idx);
    const game = gameInput ? gameInput.value : '';
    const isIOS = (key === 'ios');
    const isWzry = game.includes('王者荣耀');
    const prevVal = methodSelect.value;
    // Rebuild options
    let optsHtml = '<option value="">-- 请选择 --</option>';
    if (isIOS) {
      optsHtml += '<option value="link">链接充值</option>';
    } else {
      optsHtml += '<option value="scan">扫码充值</option>';
      if (isWzry) optsHtml += '<option value="friend">好友代付</option>';
      optsHtml += '<option value="link">链接充值</option>';
    }
    methodSelect.innerHTML = optsHtml;
    // Restore previous selection if still valid
    if (prevVal && methodSelect.querySelector(`option[value="${prevVal}"]`)) {
      methodSelect.value = prevVal;
    } else {
      methodSelect.value = '';
      const box = document.getElementById('rechargeGuide-' + idx);
      if (box) box.innerHTML = '';
    }
    if (methodSelect.value) showRechargeGuide(idx);
  }
}

// ── 核心逻辑：动态规则控制与链接内容注入 ──────────────────────────────────────
function showRechargeGuide(idx) {
  const methodSelect = document.getElementById('f-method-' + idx);
  const sysKeyInput  = document.getElementById('f-system-key-' + idx);
  const box          = document.getElementById('rechargeGuide-' + idx);
  const gameInput    = document.getElementById('f-game-' + idx);

  if(!methodSelect || !sysKeyInput || !box || !gameInput) return;

  const v    = methodSelect.value;
  const sys  = sysKeyInput.value;
  const game = gameInput.value;

  if (v === 'friend' && !game.includes('王者荣耀')) {
    alert('⚠️ 好友代付只适用于【王者荣耀】！');
    methodSelect.value = ''; box.innerHTML = ''; return;
  }
  if (v === 'friend' && game.includes('王者荣耀') && sys !== 'android') {
    alert('⚠️ 王者荣耀好友代付只支持【安卓系统】！');
    methodSelect.value = ''; box.innerHTML = ''; return;
  }
  if (v === 'scan' && sys === 'ios' && (game.includes('王者荣耀') || game.includes('和平精英'))) {
    alert('⚠️ 王者荣耀及和平精英的【苹果 (iOS) 系统】不支持扫码充值！');
    methodSelect.value = ''; box.innerHTML = ''; return;
  }

  const guides = {
    scan:   `📱 <b>扫码充值：</b>我们将发送充值二维码，您在游戏内扫码即可完成充值。<img src="img/两手机扫码.jpeg" alt="扫码充值示例" style="width:60%;max-width:220px;border-radius:10px;margin-top:10px;display:block;">`,
    friend: `👥 <b>好友代付：</b>请在游戏内添加我们的账号为好友，然后发起代付请求。<img src="img/好友代付.jpeg" alt="好友代付示例" style="width:60%;max-width:220px;border-radius:10px;margin-top:10px;display:block;">`,
    link:   `🔗 <b>链接充值须知：</b><br>充值的号复制到微信打开此链接，点进去：<br><b>第一步：</b>交易记录<br><b>第二步：</b>右上角三个点…<br><b>第三步：</b>复制链接<br><b>第四步：</b>粘贴对话框，发送给我。<br><a href="https://pay.qq.com/h5/index.shtml?m=buy&c=qqacct_save&wechat=1&style=wechat&pf=__mds_wx_qb&r=0.21898486205113632#/mycenter" target="_blank" style="color:var(--accent);display:inline-block;margin-top:6px;word-break:break-all;">https://pay.qq.com/h5/index.shtml...</a>`,
  };
  box.innerHTML = v ? `<div class="co-guide">${guides[v]}</div>` : '';
}

// ── Submit Order 提交订单与终极防呆卡口 ───────────────────────────────────────────
function submitOrder() {
  const content = document.getElementById('checkoutContent');
  const gameKeys = content ? JSON.parse(content.dataset.gameKeys || '[]') : [];

  // 安卓+苹果允许同时下单（每个区有独立微信名字和备注）

  // 验证每个游戏分区
  const methodMap = { scan:'扫码充值', friend:'好友代付', link:'链接充值' };
  const gameInfos = [];

  for (let i = 0; i < gameKeys.length; i++) {
    const game   = (document.getElementById('f-game-' + i)||{}).value || '';
    const daqu   = (document.getElementById('f-daqu-' + i)||{}).value?.trim() || '';
    const sysKey = (document.getElementById('f-system-key-' + i)||{}).value || 'android';
    const sys    = (document.getElementById('f-system-' + i)||{}).value || '';
    const method = (document.getElementById('f-method-' + i)||{}).value || '';
    const nick   = (document.getElementById('f-nick-' + i)||{}).value?.trim() || '';
    const wx     = (document.getElementById('f-wx-' + i)||{}).value?.trim() || '';
    const remark = (document.getElementById('f-remark-' + i)||{}).value?.trim() || '';

    if (!method) { alert(`请为【${game}】选择充值方式！`); return; }
    if (!nick)   { alert(`请填写【${game}】的游戏昵称！`); return; }
    if (!wx)     { alert(`请填写【${game}】的微信名字！`); return; }

    if (method === 'friend' && !game.includes('王者荣耀')) { alert('❌ 好友代付只适用于【王者荣耀】！'); return; }
    if (method === 'friend' && game.includes('王者荣耀') && sysKey !== 'android') { alert('❌ 王者荣耀好友代付只支持【安卓系统】！'); return; }
    if (method === 'scan' && sysKey === 'ios' && (game.includes('王者荣耀') || game.includes('和平精英'))) { alert('❌ 苹果 (iOS) 系统不支持扫码充值！'); return; }

    gameInfos.push({ game, daqu, sysKey, sys, method, nick, wx, remark });
  }

  const cart  = getCart();
  const total = cartTotal();
  const items = cart.map(c => `• ${c.game} ${c.name} x${c.qty} = RM ${(c.price*c.qty).toFixed(2)}`).join('\n');

  // Per-group 点卷 breakdown
  const ptsGroups = {};
  const ptsGroupOrder = [];
  cart.forEach(c => {
    let gk;
    if      (c.id.startsWith('hpjy-and-')) gk = '和平安卓';
    else if (c.id.startsWith('hpjy-ios-')) gk = '和平苹果';
    else if (c.id.startsWith('wzry-and-')) gk = '王者安卓';
    else if (c.id.startsWith('wzry-ios-')) gk = '王者苹果';
    else if (c.id.startsWith('wwqy-'))     gk = '无畏契约';
    else gk = c.game;
    const m = c.name.match(/(\d+)\s*点卷/);
    const pts = m ? parseInt(m[1]) * c.qty : 0;
    if (pts > 0) {
      if (!ptsGroups[gk]) { ptsGroups[gk] = 0; ptsGroupOrder.push(gk); }
      ptsGroups[gk] += pts;
    }
  });
  const msgLines = ['📦 *新订单*', '', items, '', `💰 合计: RM ${total.toFixed(2)}`, ''];

  gameInfos.forEach(info => {
    msgLines.push(`🎮 游戏: ${info.game}`);
    if (info.daqu) msgLines.push(`🌏 大区: ${info.daqu}`);
    msgLines.push(`🖥 系统: ${info.sys}`);
    msgLines.push(`💳 充值方式: ${methodMap[info.method]}`);
    msgLines.push(`👤 游戏名字: ${info.nick}`);
    msgLines.push(`💬 微信名字: ${info.wx}`);
    // 点卷统计：找出属于这个 game+platform 的点卷
    const gkMatch = info.game.includes('和平精英') && info.sysKey === 'android' ? '和平安卓'
                  : info.game.includes('和平精英') && info.sysKey === 'ios'     ? '和平苹果'
                  : info.game.includes('王者荣耀') && info.sysKey === 'android' ? '王者安卓'
                  : info.game.includes('王者荣耀') && info.sysKey === 'ios'     ? '王者苹果'
                  : info.game.includes('无畏契约')                              ? '无畏契约'
                  : info.game;
    if (ptsGroups[gkMatch]) msgLines.push(`🎯 点卷: ${ptsGroups[gkMatch].toLocaleString()} 点卷`);
    if (info.remark) msgLines.push(`📝 备注: ${info.remark}`);
    msgLines.push('');
  });

  const msg   = msgLines.join('\n');
  const waUrl = `https://wa.me/601150419895?text=${encodeURIComponent(msg)}`;

  sessionStorage.setItem(ORDER_KEY, JSON.stringify({
    cart, total,
    game: gameInfos.map(g=>g.game).join(' + '),
    daqu: gameInfos[0]?.daqu || '',
    system: gameInfos.map(g=>g.sys).join(' / '),
    method: gameInfos.map(g=>methodMap[g.method]).join(' / '),
    nick: gameInfos.map(g=>g.nick).join(' / '),
    wx: gameInfos.map(g=>g.wx).join(' / '),
    remark: gameInfos.map(g=>g.remark).filter(Boolean).join(' / '),
    msg, waUrl, items
  }));

  saveCart([]);
  refreshUI();
  window.location.href = 'success.html';
}

function copyOrder() {
  const el = document.getElementById('copyText');
  if(!el) return;
  const text = el.innerText;
  navigator.clipboard.writeText(text).then(()=>{
    const btn = document.getElementById('copyBtn');
    btn.textContent='✅ 已复制！'; btn.classList.add('copied');
    setTimeout(()=>{ btn.textContent='📋 复制订单信息'; btn.classList.remove('copied'); },2500);
  }).catch(()=>{
    const r=document.createRange(); r.selectNode(el);
    window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
    document.execCommand('copy');
  });
}

// ── Init 全局初始化 ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshUI();
  const overlay = document.getElementById('checkoutOverlay');
  if(overlay) overlay.addEventListener('click', e=>{ if(e.target===overlay) closeCheckout(); });
});

// ── 彻底禁用 BFCache：离开页面时注册 unload，让浏览器放弃缓存此页 ──────────────
// unload 事件的存在会让所有主流浏览器（包括 Safari/微信）放弃 BFCache
window.addEventListener('unload', function() {});

// ── pageshow 兜底：如果 BFCache 侥幸生效，强制 reload ────────────────────────
window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    // persisted=true 说明从 BFCache 恢复，强制完整刷新
    window.location.reload(true);
  } else {
    refreshUI();
  }
});

// ── visibilitychange 兜底 ────────────────────────────────────────────────
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    refreshUI();
  }
});
// ── WeChat 弹窗：点击后弹出微信号并自动复制 ──────────────────────────────────
function openWechat() {
  const wxId = 'jackson66399';
  // 尝试复制到剪贴板
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(wxId).catch(()=>{});
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = wxId; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
    } catch(e){}
  }
  // 显示弹窗
  let modal = document.getElementById('wechatModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'wechatModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
    modal.innerHTML = `
      <div style="background:var(--bg2,#1a1a2e);border:1px solid var(--border,#2a2a3e);border-radius:20px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
        <div style="width:56px;height:56px;border-radius:50%;background:#07C160;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px">💚</div>
        <div style="font-size:17px;font-weight:800;color:var(--text,#fff);margin-bottom:6px">添加微信</div>
        <div style="font-size:13px;color:var(--text-dim,#aaa);margin-bottom:16px">微信号已复制到剪贴板</div>
        <div style="background:var(--bg3,#0d0d1a);border:1px solid var(--border,#2a2a3e);border-radius:12px;padding:14px 16px;margin-bottom:18px">
          <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:var(--pink-lite,#ff6eb0)">${wxId}</div>
        </div>
        <div style="font-size:12px;color:var(--text-dim,#aaa);margin-bottom:18px;line-height:1.6">请打开微信 → 搜索以上微信号 → 添加好友</div>
        <button id="wechatCopyBtn" onclick="(function(){
          if(navigator.clipboard){navigator.clipboard.writeText('${wxId}').catch(()=>{})}
          var b=document.getElementById('wechatCopyBtn');
          b.textContent='✅ 已复制！';b.style.background='linear-gradient(135deg,#34c759,#28a745)';
          setTimeout(function(){b.textContent='📋 再次复制微信号';b.style.background='';},2000);
        })()" style="width:100%;padding:12px;background:linear-gradient(135deg,#07C160,#05a050);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;font-family:inherit">📋 再次复制微信号</button>
        <button onclick="document.getElementById('wechatModal').style.display='none'" style="width:100%;padding:11px;background:transparent;border:1px solid var(--border,#2a2a3e);color:var(--text-dim,#aaa);border-radius:12px;font-size:14px;cursor:pointer;font-family:inherit">关闭</button>
      </div>`;
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.style.display='none'; });
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
    // reset copy button
    const btn = document.getElementById('wechatCopyBtn');
    if(btn){ btn.textContent='📋 再次复制微信号'; btn.style.background=''; }
  }
}