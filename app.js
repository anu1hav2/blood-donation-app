/**
 * app.js
 * Frontend application controller.
 * Manages UI routing, rendering, chart generation, CSV reports, and roles coordination.
 */

(function () {
  // App State
  let state = {
    user: null,
    profile: null,
    activeView: "dashboard",
    theme: "dark",
    notifications: []
  };

  // DOM Elements Cache
  const el = {
    authView: document.getElementById("auth-view"),
    appView: document.getElementById("app-view"),
    
    // Cards
    loginCard: document.getElementById("login-card"),
    signupCard: document.getElementById("signup-card"),
    forgotCard: document.getElementById("forgot-card"),
    
    // Forms
    loginForm: document.getElementById("login-form"),
    signupForm: document.getElementById("signup-form"),
    forgotFormOtp: document.getElementById("forgot-form-otp"),
    forgotFormReset: document.getElementById("forgot-form-reset"),
    donationLogForm: document.getElementById("donation-log-form"),
    requestBloodForm: document.getElementById("request-blood-form"),
    inventoryEditForm: document.getElementById("inventory-edit-form"),
    profileEditForm: document.getElementById("profile-edit-form"),
    
    // Fields
    signupRole: document.getElementById("signup-role"),
    roleExtraFields: document.getElementById("role-extra-fields"),
    donorFields: document.getElementById("donor-fields"),
    recipientFields: document.getElementById("recipient-fields"),
    forgotOtpCode: document.getElementById("forgot-otp-code"),
    otpDemoAlert: document.getElementById("otp-demo-alert"),
    
    // Sidebar & Profile
    navItems: document.querySelectorAll(".nav-item"),
    avatarLetter: document.getElementById("avatar-letter"),
    profileDisplayName: document.getElementById("profile-display-name"),
    profileDisplayRole: document.getElementById("profile-display-role"),
    
    // Header Actions
    pageTitleText: document.getElementById("page-title-text"),
    bellBtn: document.getElementById("bell-btn"),
    bellCounter: document.getElementById("bell-counter"),
    notifDropdown: document.getElementById("notif-dropdown"),
    notificationsListContainer: document.getElementById("notifications-list-container"),
    btnClearNotifications: document.getElementById("btn-clear-notifications"),
    themeToggleBtn: document.getElementById("theme-toggle-btn"),
    btnLogout: document.getElementById("btn-logout"),
    btnDownloadReport: document.getElementById("btn-download-report"),
    
    // View Panels
    panels: {
      dashboard: document.getElementById("panel-dashboard"),
      history: document.getElementById("panel-donor-history"),
      camps: document.getElementById("panel-search-camps"),
      requests: document.getElementById("panel-blood-requests"),
      inventory: document.getElementById("panel-inventory"),
      "bank-requests": document.getElementById("panel-bank-requests"),
      "search-donors": document.getElementById("panel-search-donors"),
      profile: document.getElementById("panel-profile")
    },
    
    // Specific Lists / Elements
    dashboardStatsGrid: document.getElementById("dashboard-stats-grid"),
    inventoryDialsContainer: document.getElementById("inventory-dials-container"),
    recentActivitiesTimeline: document.getElementById("recent-activities-timeline"),
    donorHistoryTableBody: document.getElementById("donor-history-table-body"),
    campsListContainer: document.getElementById("camps-list-container"),
    reqBankSelector: document.getElementById("req-blood-bank"),
    reqBankSelectorGroup: document.getElementById("req-bank-selector-group"),
    recipientRequestsTableBody: document.getElementById("recipient-requests-table-body"),
    inventoryGridEditor: document.getElementById("inventory-grid-editor"),
    bankRequestsTableBody: document.getElementById("bank-requests-table-body"),
    searchDonorsResultsTable: document.getElementById("search-donors-results-table"),
    
    // Dev Panel
    demoControllerPanel: document.getElementById("demo-controller-panel"),
    demoHeaderBtn: document.getElementById("demo-header-btn"),
    demoBodyPanel: document.getElementById("demo-body-panel"),
    demoToggleIcon: document.getElementById("demo-toggle-icon"),
    demoBtns: document.querySelectorAll(".demo-btn"),
    demoBtnClearDb: document.getElementById("demo-btn-clear-db"),
    demoBtnTriggerNotif: document.getElementById("demo-btn-trigger-notif")
  };

  // Helper: Toast alerts
  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `glass toast-alert ${type}`;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.padding = "16px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = "9999";
    toast.style.color = "white";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
    toast.style.transition = "all 0.3s ease";
    
    if (type === "success") {
      toast.style.background = "rgba(16, 185, 129, 0.9)";
      toast.style.border = "1px solid #10b981";
      toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    } else {
      toast.style.background = "rgba(230, 57, 70, 0.9)";
      toast.style.border = "1px solid #e63946";
      toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Initial App Setup
  async function init() {
    // Check Dark/Light Mode Preference
    const savedTheme = localStorage.getItem("bdms_theme") || "dark";
    setTheme(savedTheme);

    // Initial Database Check
    window.db.init();

    // Check Auth session
    const response = await window.api.auth.me();
    if (response.status === 200 && response.data) {
      state.user = response.data.user;
      state.profile = response.data.profile;
      setupAppShell();
      navigateTo("dashboard");
    } else {
      showAuthCard("login");
    }

    // Refresh notifications count periodically
    pollNotifications();
  }

  // Set Theme Colors
  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem("bdms_theme", theme);
    if (theme === "light") {
      document.body.classList.add("light-mode");
      el.themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.body.classList.remove("light-mode");
      el.themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
  }

  // Show App views
  function setupAppShell() {
    el.authView.classList.add("hidden");
    el.appView.classList.remove("hidden");

    // Profile Details
    el.profileDisplayName.textContent = state.user.name;
    el.profileDisplayRole.textContent = state.user.role.replace("_", " ");
    el.avatarLetter.textContent = state.user.name.charAt(0).toUpperCase();

    // Hide all role-specific sidebar navigation items
    document.getElementById("nav-donor-history").classList.add("hidden");
    document.getElementById("nav-search-camps").classList.add("hidden");
    document.getElementById("nav-blood-requests").classList.add("hidden");
    document.getElementById("nav-inventory").classList.add("hidden");
    document.getElementById("nav-bank-requests").classList.add("hidden");

    // Enable role-specific items
    if (state.user.role === "donor") {
      document.getElementById("nav-donor-history").classList.remove("hidden");
      document.getElementById("nav-search-camps").classList.remove("hidden");
    } else if (state.user.role === "recipient" || state.user.role === "hospital") {
      document.getElementById("nav-blood-requests").classList.remove("hidden");
    } else if (state.user.role === "blood_bank") {
      document.getElementById("nav-inventory").classList.remove("hidden");
      document.getElementById("nav-bank-requests").classList.remove("hidden");
    }
    
    loadNotifications();
  }

  // Routing Handler
  function navigateTo(viewName) {
    state.activeView = viewName;

    // Remove active class from navs
    el.navItems.forEach(item => item.classList.remove("active"));

    // Activate current
    const activeNav = Array.from(el.navItems).find(item => {
      const link = item.querySelector("a");
      return link && link.getAttribute("href") === `#${viewName}`;
    });
    if (activeNav) activeNav.classList.add("active");

    // Title
    let title = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    if (viewName === "bank-requests") title = "Pending Requests";
    if (viewName === "search-donors") title = "Search Registered Donors";
    if (viewName === "camps") title = "Donation Camps";
    if (viewName === "history") title = "My Donation History";
    el.pageTitleText.textContent = title;

    // Show/Hide Panels
    Object.keys(el.panels).forEach(key => {
      if (key === viewName) {
        el.panels[key].classList.remove("hidden");
      } else {
        el.panels[key].classList.add("hidden");
      }
    });

    // Toggle export button visibility
    if (viewName === "dashboard" && state.user.role === "blood_bank") {
      el.btnDownloadReport.classList.remove("hidden");
    } else {
      el.btnDownloadReport.classList.add("hidden");
    }

    // Trigger View Data Loading
    loadViewData(viewName);
  }

  // Load view-specific records
  async function loadViewData(viewName) {
    try {
      if (viewName === "dashboard") {
        await loadDashboardData();
      } else if (viewName === "history") {
        await loadDonationHistory();
      } else if (viewName === "camps") {
        await loadCampsData();
      } else if (viewName === "requests") {
        await loadRequestsData();
      } else if (viewName === "inventory") {
        await loadInventoryEditorData();
      } else if (viewName === "bank-requests") {
        await loadBankRequestsData();
      } else if (viewName === "search-donors") {
        await loadSearchDonorsData();
      } else if (viewName === "profile") {
        loadProfileFormData();
      }
    } catch (e) {
      showToast(e.message, "danger");
    }
  }

  // --- VIEW RENDERING ENGINE ---

  // 1. DASHBOARD LOAD
  async function loadDashboardData() {
    el.dashboardStatsGrid.innerHTML = "";
    el.inventoryDialsContainer.innerHTML = "";
    
    if (state.user.role === "admin") {
      await loadAdminDashboard();
    } else if (state.user.role === "donor") {
      await loadDonorDashboard();
    } else if (state.user.role === "recipient") {
      await loadRecipientDashboard();
    } else if (state.user.role === "blood_bank") {
      await loadBloodBankDashboard();
    } else if (state.user.role === "hospital") {
      await loadHospitalDashboard();
    }
  }

  // ADMIN DASHBOARD
  async function loadAdminDashboard() {
    const statsResponse = await window.api.admin.getStats();
    if (statsResponse.status !== 200) return;
    const s = statsResponse.data;

    // Renders Stats Grid
    el.dashboardStatsGrid.innerHTML = `
      <div class="stats-card glass primary">
        <div class="stats-icon"><i class="fa-solid fa-users"></i></div>
        <div class="stats-info">
          <span class="stats-val">${s.totalDonors}</span>
          <span class="stats-label">Total Donors</span>
        </div>
      </div>
      <div class="stats-card glass secondary">
        <div class="stats-icon"><i class="fa-solid fa-hand-holding-droplet"></i></div>
        <div class="stats-info">
          <span class="stats-val">${s.totalRequests}</span>
          <span class="stats-label">Total Requests</span>
        </div>
      </div>
      <div class="stats-card glass success">
        <div class="stats-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div class="stats-info">
          <span class="stats-val">${s.successfulDonations}</span>
          <span class="stats-label">Successful Donations</span>
        </div>
      </div>
      <div class="stats-card glass warning">
        <div class="stats-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="stats-info">
          <span class="stats-val">${s.emergencyRequests}</span>
          <span class="stats-label">Emergency Requests</span>
        </div>
      </div>
    `;

    // Render SVG Inventory Progress Dials
    renderInventoryDials(s.groupInventory);

    // Renders recent activity logs
    renderActivitiesTimeline(s.recentActivities);

    // Replace the main chart title & inject tab panels for Admin utilities
    el.dashboardMainChartTitle.innerHTML = `
      <span>System Resource Management</span>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-secondary btn-sm admin-tab active" data-tab="stock">Inventory Stock</button>
        <button class="btn btn-secondary btn-sm admin-tab" data-tab="users">User accounts</button>
        <button class="btn btn-secondary btn-sm admin-tab" data-tab="approvals">Approvals</button>
      </div>
    `;

    // Hook tab switches
    document.querySelectorAll(".admin-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const mode = tab.dataset.tab;
        
        if (mode === "stock") {
          renderInventoryDials(s.groupInventory);
        } else if (mode === "users") {
          renderAdminUsersList();
        } else if (mode === "approvals") {
          renderAdminApprovalsList();
        }
      });
    });
  }

  // DONOR DASHBOARD
  async function loadDonorDashboard() {
    const profile = state.profile;
    const eligibility = profile.eligibility;

    // Donor info stats
    el.dashboardStatsGrid.innerHTML = `
      <div class="stats-card glass primary">
        <div class="stats-icon"><i class="fa-solid fa-droplet"></i></div>
        <div class="stats-info">
          <span class="stats-val">${profile.bloodGroup}</span>
          <span class="stats-label">My Blood Group</span>
        </div>
      </div>
      <div class="stats-card glass secondary">
        <div class="stats-icon"><i class="fa-solid fa-weight-scale"></i></div>
        <div class="stats-info">
          <span class="stats-val">${profile.weight} kg</span>
          <span class="stats-label">Current Weight</span>
        </div>
      </div>
      <div class="stats-card glass success">
        <div class="stats-icon"><i class="fa-solid fa-calendar-check"></i></div>
        <div class="stats-info">
          <span class="stats-val">${profile.lastDonationDate ? new Date(profile.lastDonationDate).toLocaleDateString() : "Never"}</span>
          <span class="stats-label">Last Donation Date</span>
        </div>
      </div>
      <div class="stats-card glass ${eligibility.eligible ? 'success' : 'warning'}">
        <div class="stats-icon"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="stats-info">
          <span class="stats-val">${eligibility.eligible ? 'Eligible' : 'Ineligible'}</span>
          <span class="stats-label">Donation Status</span>
        </div>
      </div>
    `;

    // Render eligibility alert card on top of dials container
    el.inventoryDialsContainer.innerHTML = `
      <div style="width: 100%;">
        <div class="eligibility-alert ${eligibility.eligible ? 'eligible' : 'ineligible'}">
          <div class="eligibility-icon">
            <i class="fa-solid ${eligibility.eligible ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
          </div>
          <div class="eligibility-text">
            <h4>${eligibility.eligible ? 'You are eligible to donate!' : 'You cannot donate blood at this time'}</h4>
            <p>${eligibility.reason}</p>
          </div>
        </div>
        
        <h4 style="margin: 24px 0 16px 0; font-size: 16px;">Open Match Requests in Your Area</h4>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Requester</th>
                <th>Units</th>
                <th>Fulfillment Center</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="donor-dashboard-matches">
              <tr><td colspan="5" class="notif-empty">Searching for matching open requests...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Renders active matching requests
    const reqResponse = await window.api.requests.list();
    if (reqResponse.status === 200) {
      const matchTbody = document.getElementById("donor-dashboard-matches");
      const list = reqResponse.data;
      if (list.length === 0) {
        matchTbody.innerHTML = `<tr><td colspan="5" class="notif-empty">No matching blood requests found at this time.</td></tr>`;
      } else {
        matchTbody.innerHTML = list.map(r => `
          <tr>
            <td><span class="badge ${r.requestType === 'emergency' ? 'emergency' : 'normal'}">${r.requestType}</span></td>
            <td>${r.requesterName}</td>
            <td>${r.unitsNeeded} Bags</td>
            <td>${r.location}</td>
            <td>
              <button class="btn btn-primary btn-sm accept-req-btn" data-id="${r.id}" data-bg="${r.bloodGroup}">
                <i class="fa-solid fa-hand-holding-droplet"></i> Accept
              </button>
            </td>
          </tr>
        `).join('');

        // Attach listeners
        document.querySelectorAll(".accept-req-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const reqId = btn.dataset.id;
            const bg = btn.dataset.bg;
            if (!eligibility.eligible) {
              showToast(`Eligibility blocked: ${eligibility.reason}`, "danger");
              return;
            }

            // Log donation
            const donRes = await window.api.donations.create({ campName: `Direct Match Request #${reqId}` });
            if (donRes.status === 200) {
              // Direct complete request via admin update simulation
              const reqs = window.db.get("blood_requests");
              const targetReq = reqs.find(rq => rq.id === Number(reqId));
              if (targetReq) {
                // If direct donor matched, subtract standard 1 unit, or complete
                const updatedQty = Math.max(0, targetReq.unitsNeeded - 1);
                window.db.update("blood_requests", targetReq.id, { 
                  unitsNeeded: updatedQty,
                  status: updatedQty === 0 ? "completed" : "pending"
                });
                
                // Add notification to requester
                window.db.insert("notifications", {
                  userId: targetReq.requesterId,
                  message: `Donor ${state.user.name} has accepted your request. 1 unit of ${bg} donated.`,
                  type: "approval",
                  isRead: false
                });
              }

              showToast("Thank you! Your donation was logged successfully.", "success");
              loadDashboardData();
            } else {
              showToast(donRes.error, "danger");
            }
          });
        });
      }
    }

    // Recent Timeline
    const activities = window.db.get("donations")
      .filter(d => d.donorId === profile.id)
      .map(d => ({
        time: d.donationDate,
        type: 'donation',
        text: `Donated 1 unit of ${d.bloodGroup} at ${d.campName} (${d.status})`
      }));
    renderActivitiesTimeline(activities.slice(-5).reverse());
  }

  // RECIPIENT DASHBOARD
  async function loadRecipientDashboard() {
    const requests = window.db.get("blood_requests").filter(r => r.requesterId === state.user.id);
    const pendingCount = requests.filter(r => r.status === "pending").length;
    const completedCount = requests.filter(r => r.status === "completed").length;

    el.dashboardStatsGrid.innerHTML = `
      <div class="stats-card glass primary">
        <div class="stats-icon"><i class="fa-solid fa-droplet"></i></div>
        <div class="stats-info">
          <span class="stats-val">${state.profile.bloodGroup || "N/A"}</span>
          <span class="stats-label">My Blood Group</span>
        </div>
      </div>
      <div class="stats-card glass secondary">
        <div class="stats-icon"><i class="fa-solid fa-hand-holding-droplet"></i></div>
        <div class="stats-info">
          <span class="stats-val">${requests.length}</span>
          <span class="stats-label">Total Requests Made</span>
        </div>
      </div>
      <div class="stats-card glass success">
        <div class="stats-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div class="stats-info">
          <span class="stats-val">${completedCount}</span>
          <span class="stats-label">Fulfilled Requests</span>
        </div>
      </div>
      <div class="stats-card glass warning">
        <div class="stats-icon"><i class="fa-solid fa-clock"></i></div>
        <div class="stats-info">
          <span class="stats-val">${pendingCount}</span>
          <span class="stats-label">Pending Requests</span>
        </div>
      </div>
    `;

    // Render blood stock levels SVG dial (Aggregated global)
    el.inventoryDialsContainer.innerHTML = `<h4 style="width: 100%; margin-bottom: 12px; font-size: 14px;">Total Global Bank Inventory Stock</h4>`;
    const inventory = window.db.get("blood_inventory").filter(i => {
      const bank = window.db.query("blood_banks", b => b.userId === i.bloodBankId)[0];
      return bank && bank.isApproved;
    });
    const globStock = {};
    ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].forEach(bg => globStock[bg] = 0);
    inventory.forEach(i => globStock[i.bloodGroup] += i.unitsAvailable);
    renderInventoryDials(globStock);

    // Renders active timeline
    const activities = requests.map(r => ({
      time: r.createdAt,
      type: r.requestType === 'emergency' ? 'emergency' : 'request',
      text: `Requested ${r.unitsNeeded} units of ${r.bloodGroup} (${r.status})`
    }));
    renderActivitiesTimeline(activities.slice(-5).reverse());
  }

  // BLOOD BANK DASHBOARD
  async function loadBloodBankDashboard() {
    const invList = window.db.query("blood_inventory", i => i.bloodBankId === state.user.id);
    const totalBags = invList.reduce((acc, curr) => acc + curr.unitsAvailable, 0);

    const bankReqs = window.db.get("blood_requests").filter(r => r.bloodBankId === state.user.id);
    const pendingReqs = bankReqs.filter(r => r.status === "pending").length;

    el.dashboardStatsGrid.innerHTML = `
      <div class="stats-card glass primary">
        <div class="stats-icon"><i class="fa-solid fa-boxes-stacked"></i></div>
        <div class="stats-info">
          <span class="stats-val">${totalBags} Bags</span>
          <span class="stats-label">Total Inventory Stock</span>
        </div>
      </div>
      <div class="stats-card glass secondary">
        <div class="stats-icon"><i class="fa-solid fa-envelope-open-text"></i></div>
        <div class="stats-info">
          <span class="stats-val">${pendingReqs}</span>
          <span class="stats-label">Pending Requests</span>
        </div>
      </div>
      <div class="stats-card glass success">
        <div class="stats-icon"><i class="fa-solid fa-location-dot"></i></div>
        <div class="stats-info">
          <span class="stats-val" style="font-size: 16px;">${state.profile.location}</span>
          <span class="stats-label">Fulfillment Center</span>
        </div>
      </div>
      <div class="stats-card glass warning">
        <div class="stats-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <div class="stats-info">
          <span class="stats-val">Verified</span>
          <span class="stats-label">Approval status</span>
        </div>
      </div>
    `;

    // Render local inventory stock
    const localStock = {};
    invList.forEach(i => localStock[i.bloodGroup] = i.unitsAvailable);
    renderInventoryDials(localStock);

    // Bank timeline
    const activities = bankReqs.map(r => ({
      time: r.createdAt,
      type: r.requestType === 'emergency' ? 'emergency' : 'request',
      text: `${r.requesterName} requested ${r.unitsNeeded} bags of ${r.bloodGroup} (${r.status})`
    }));
    renderActivitiesTimeline(activities.slice(-5).reverse());
  }

  // HOSPITAL DASHBOARD
  async function loadHospitalDashboard() {
    const requests = window.db.get("blood_requests").filter(r => r.requesterId === state.user.id);
    const emergencyCount = requests.filter(r => r.requestType === "emergency").length;
    const completedCount = requests.filter(r => r.status === "completed").length;

    el.dashboardStatsGrid.innerHTML = `
      <div class="stats-card glass primary">
        <div class="stats-icon"><i class="fa-solid fa-hospital"></i></div>
        <div class="stats-info">
          <span class="stats-val" style="font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${state.user.name}</span>
          <span class="stats-label">Facility</span>
        </div>
      </div>
      <div class="stats-card glass secondary">
        <div class="stats-icon"><i class="fa-solid fa-cart-flatbed-suitcases"></i></div>
        <div class="stats-info">
          <span class="stats-val">${requests.length}</span>
          <span class="stats-label">Requests Placed</span>
        </div>
      </div>
      <div class="stats-card glass success">
        <div class="stats-icon"><i class="fa-solid fa-circle-check"></i></div>
        <div class="stats-info">
          <span class="stats-val">${completedCount}</span>
          <span class="stats-label">Fulfilled orders</span>
        </div>
      </div>
      <div class="stats-card glass warning">
        <div class="stats-icon"><i class="fa-solid fa-kit-medical"></i></div>
        <div class="stats-info">
          <span class="stats-val">${emergencyCount}</span>
          <span class="stats-label">Emergency Requests</span>
        </div>
      </div>
    `;

    // Render targeted blood banks inventory
    el.inventoryDialsContainer.innerHTML = `<h4 style="width: 100%; margin-bottom: 12px; font-size: 14px;">Total Global Bank Inventory Stock</h4>`;
    const inventory = window.db.get("blood_inventory").filter(i => {
      const bank = window.db.query("blood_banks", b => b.userId === i.bloodBankId)[0];
      return bank && bank.isApproved;
    });
    const globStock = {};
    ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].forEach(bg => globStock[bg] = 0);
    inventory.forEach(i => globStock[i.bloodGroup] += i.unitsAvailable);
    renderInventoryDials(globStock);

    // Timeline
    const activities = requests.map(r => ({
      time: r.createdAt,
      type: r.requestType === 'emergency' ? 'emergency' : 'request',
      text: `Requested ${r.unitsNeeded} bags of ${r.bloodGroup} from blood bank (${r.status})`
    }));
    renderActivitiesTimeline(activities.slice(-5).reverse());
  }

  // --- SVG DIALS GENERATOR ---
  function renderInventoryDials(stockData) {
    el.inventoryDialsContainer.innerHTML = "";
    
    Object.keys(stockData).forEach(bg => {
      const qty = stockData[bg];
      
      // Calculate circle circumference properties
      const radius = 28;
      const circ = 2 * Math.PI * radius;
      // Cap max representation at 30 bags for scale
      const percent = Math.min(qty / 30, 1);
      const strokeDashoffset = circ - (percent * circ);

      // Color coding (Low stock alert)
      let colorClass = "var(--success)";
      if (qty === 0) colorClass = "var(--primary)";
      else if (qty < 5) colorClass = "var(--warning)";

      const card = document.createElement("div");
      card.className = "dial-card glass";
      card.innerHTML = `
        <div class="dial-bg">
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r="${radius}" fill="none" stroke="var(--panel-border)" stroke-width="4"></circle>
            <circle cx="35" cy="35" r="${radius}" fill="none" stroke="${colorClass}" stroke-width="5" 
              stroke-dasharray="${circ}" stroke-dashoffset="${strokeDashoffset}" 
              stroke-linecap="round" transform="rotate(-90 35 35)"></circle>
          </svg>
          <span class="dial-text" style="color: ${colorClass};">${bg}</span>
        </div>
        <div class="dial-qty-label">${qty} Bags</div>
      `;
      el.inventoryDialsContainer.appendChild(card);
    });
  }

  // --- TIMELINE BUILDER ---
  function renderActivitiesTimeline(activities) {
    el.recentActivitiesTimeline.innerHTML = "";
    if (!activities || activities.length === 0) {
      el.recentActivitiesTimeline.innerHTML = `<div class="notif-empty">No recent activity logged.</div>`;
      return;
    }

    activities.forEach(act => {
      const item = document.createElement("div");
      item.className = `timeline-item ${act.type}`;
      item.innerHTML = `
        <div class="timeline-marker">
          <div class="timeline-circle"></div>
          <div class="timeline-line"></div>
        </div>
        <div class="timeline-content">
          <div class="timeline-text">${act.text}</div>
          <div class="timeline-time">${new Date(act.time).toLocaleTimeString()} - ${new Date(act.time).toLocaleDateString()}</div>
        </div>
      `;
      el.recentActivitiesTimeline.appendChild(item);
    });
  }

  // --- ADMIN USER LIST ---
  async function renderAdminUsersList() {
    const listRes = await window.api.admin.usersList();
    if (listRes.status !== 200) return;

    el.inventoryDialsContainer.innerHTML = `
      <div style="width: 100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:15px;">Registered Accounts Directory</h4>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Details</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${listRes.data.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'emergency' : 'normal'}">${u.role.replace('_', ' ')}</span></td>
                  <td>${u.detail || '-'}</td>
                  <td><span class="badge ${u.status}">${u.status}</span></td>
                  <td>
                    ${u.role !== 'admin' ? `
                      <button class="btn btn-secondary btn-sm toggle-block-btn" data-id="${u.id}" data-status="${u.status}">
                        ${u.status === 'active' ? '<i class="fa-solid fa-user-slash"></i> Block' : '<i class="fa-solid fa-user-check"></i> Unblock'}
                      </button>
                    ` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook buttons
    document.querySelectorAll(".toggle-block-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = btn.dataset.id;
        const curStatus = btn.dataset.status;
        const nextStatus = curStatus === "active" ? "blocked" : "active";

        const updateRes = await window.api.admin.updateUserStatus(id, { status: nextStatus });
        if (updateRes.status === 200) {
          showToast(`User status updated to ${nextStatus}`, "success");
          renderAdminUsersList();
        } else {
          showToast(updateRes.error, "danger");
        }
      });
    });
  }

  // --- ADMIN APPROVALS LIST ---
  async function renderAdminApprovalsList() {
    const listRes = await window.api.admin.usersList();
    if (listRes.status !== 200) return;

    // Filter blood banks and hospitals that are not verified/approved yet
    const pendingList = listRes.data.filter(u => (u.role === "blood_bank" || u.role === "hospital") && !u.isApproved);

    el.inventoryDialsContainer.innerHTML = `
      <div style="width: 100%;">
        <h4 style="font-size:15px; margin-bottom:12px;">Pending Facilities Verification Approvals</h4>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${pendingList.length === 0 ? `
                <tr><td colspan="6" class="notif-empty">No facility verification approvals pending.</td></tr>
              ` : pendingList.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td>${u.name}</td>
                  <td>${u.email}</td>
                  <td><span class="badge normal">${u.role.replace('_', ' ')}</span></td>
                  <td>${u.detail}</td>
                  <td>
                    <button class="btn btn-primary btn-sm approve-facility-btn" data-id="${u.id}" style="background:var(--success); border-color:var(--success);">
                      <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button class="btn btn-secondary btn-sm reject-facility-btn" data-id="${u.id}">
                      <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Hook actions
    document.querySelectorAll(".approve-facility-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const res = await window.api.admin.updateUserStatus(id, { isApproved: true });
        if (res.status === 200) {
          showToast("Facility approved successfully", "success");
          renderAdminApprovalsList();
        }
      });
    });

    document.querySelectorAll(".reject-facility-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        // Mock rejection delete from DB or keep as status false. Here we delete user
        window.db.delete("users", Number(id));
        showToast("Facility registration rejected and removed.", "warning");
        renderAdminApprovalsList();
      });
    });
  }


  // 2. MY DONATION HISTORY (DONOR)
  async function loadDonationHistory() {
    const listRes = await window.api.donations.list();
    if (listRes.status !== 200) return;

    const tbody = el.donorHistoryTableBody;
    tbody.innerHTML = "";

    const list = listRes.data;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="notif-empty">No donation records found. Go to "Search Camps" to log your first donation!</td></tr>`;
      return;
    }

    list.forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${d.id}</td>
        <td>${new Date(d.donationDate).toLocaleDateString()}</td>
        <td>${d.campName}</td>
        <td><span class="badge normal" style="font-size:12px;">${d.bloodGroup}</span></td>
        <td>${d.units}</td>
        <td><span class="badge ${d.status}">${d.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 3. DONATION CAMPS VIEW (DONOR)
  async function loadCampsData() {
    const campsRes = await window.api.donors.getCamps();
    if (campsRes.status !== 200) return;

    el.campsListContainer.innerHTML = "";
    campsRes.data.forEach(camp => {
      const card = document.createElement("div");
      card.className = "glass";
      card.style.padding = "16px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";
      card.innerHTML = `
        <div>
          <h4 style="font-weight:600; margin-bottom:4px; font-size:15px; color:var(--primary);"><i class="fa-solid fa-hospital-user"></i> ${camp.name}</h4>
          <p style="font-size:12px; color:var(--text-muted); margin-bottom:4px;"><i class="fa-solid fa-location-dot"></i> ${camp.location}</p>
          <p style="font-size:12px;"><i class="fa-solid fa-calendar-day"></i> ${camp.date} &nbsp;|&nbsp; <i class="fa-solid fa-clock"></i> ${camp.time}</p>
        </div>
        <button class="btn btn-secondary btn-sm log-camp-donation-btn" data-camp="${camp.name}">
          Donate here
        </button>
      `;
      el.campsListContainer.appendChild(card);
    });

    // Hook campaign buttons
    document.querySelectorAll(".log-camp-donation-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        el.donationLogForm.querySelector("select").value = btn.dataset.camp;
        showToast(`Camp selected: ${btn.dataset.camp}. Submit the form to log.`, "success");
      });
    });
  }

  // 4. BLOOD REQUESTS FOR RECIPIENT & HOSPITAL
  async function loadRequestsData() {
    const reqRes = await window.api.requests.list();
    if (reqRes.status !== 200) return;

    // Renders active tracker table
    const tbody = el.recipientRequestsTableBody;
    tbody.innerHTML = "";

    const list = reqRes.data;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="notif-empty">No active or historic requests logged. Use the form to submit a new request.</td></tr>`;
    } else {
      list.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${new Date(r.createdAt).toLocaleDateString()}</td>
          <td><span class="badge normal" style="font-size:12px;">${r.bloodGroup}</span></td>
          <td>${r.unitsNeeded} Bags</td>
          <td><span class="badge ${r.requestType === 'emergency' ? 'emergency' : 'normal'}">${r.requestType}</span></td>
          <td><span class="badge ${r.status}">${r.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Populate Target Blood Banks select list
    el.reqBankSelector.innerHTML = '<option value="">-- Post to General Network (Local Banks) --</option>';
    const banks = window.db.get("blood_banks").filter(b => b.isApproved);
    banks.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.userId;
      opt.textContent = `${b.name} (${b.location})`;
      el.reqBankSelector.appendChild(opt);
    });

    // Hide targeted selector for normal recipients, show only for hospitals
    if (state.user.role === "hospital") {
      el.reqBankSelectorGroup.classList.remove("hidden");
    } else {
      el.reqBankSelectorGroup.classList.add("hidden");
    }
  }

  // 5. INVENTORY EDITOR (BLOOD BANK)
  async function loadInventoryEditorData() {
    const invRes = await window.api.inventory.get();
    if (invRes.status !== 200) return;

    el.inventoryGridEditor.innerHTML = "";
    invRes.data.forEach(item => {
      const editorBlock = document.createElement("div");
      editorBlock.className = "form-group glass";
      editorBlock.style.padding = "16px";
      editorBlock.style.textAlign = "center";
      editorBlock.innerHTML = `
        <h4 style="margin-bottom:8px; font-weight:600; font-size:16px; color:var(--primary);">${item.bloodGroup}</h4>
        <div style="display:flex; justify-content:center; align-items:center; gap:10px;">
          <button type="button" class="btn btn-secondary btn-sm inv-minus" data-group="${item.bloodGroup}">-</button>
          <input type="number" class="form-control inv-val" data-group="${item.bloodGroup}" value="${item.unitsAvailable}" style="width:70px; text-align:center; padding:6px;" min="0">
          <button type="button" class="btn btn-secondary btn-sm inv-plus" data-group="${item.bloodGroup}">+</button>
        </div>
      `;
      el.inventoryGridEditor.appendChild(editorBlock);
    });

    // Hook +/- buttons
    document.querySelectorAll(".inv-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const bg = btn.dataset.group;
        const input = document.querySelector(`.inv-val[data-group="${bg}"]`);
        input.value = Math.max(0, Number(input.value) - 1);
      });
    });
    
    document.querySelectorAll(".inv-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const bg = btn.dataset.group;
        const input = document.querySelector(`.inv-val[data-group="${bg}"]`);
        input.value = Number(input.value) + 1;
      });
    });
  }

  // 6. PENDING REQUESTS MANAGER (BLOOD BANK)
  async function loadBankRequestsData() {
    const reqsRes = await window.api.requests.list();
    if (reqsRes.status !== 200) return;

    const tbody = el.bankRequestsTableBody;
    tbody.innerHTML = "";

    const list = reqsRes.data;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="notif-empty">Inbox is empty. No patient or hospital requests found.</td></tr>`;
      return;
    }

    list.forEach(r => {
      const isPending = r.status === "pending";
      const isApproved = r.status === "approved";
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
        <td>${r.requesterName} <br> <span style="font-size:10px; color:var(--text-muted);">${r.requesterType}</span></td>
        <td>${r.requesterType}</td>
        <td><span class="badge normal">${r.bloodGroup}</span></td>
        <td>${r.unitsNeeded} Bags</td>
        <td><span class="badge ${r.requestType === 'emergency' ? 'emergency' : 'normal'}">${r.requestType}</span></td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>
          ${isPending ? `
            <button class="btn btn-primary btn-sm approve-req-btn" data-id="${r.id}" style="background:var(--success); border-color:var(--success);">
              <i class="fa-solid fa-thumbs-up"></i> Approve
            </button>
            <button class="btn btn-secondary btn-sm reject-req-btn" data-id="${r.id}">
              <i class="fa-solid fa-thumbs-down"></i> Reject
            </button>
          ` : ''}
          ${isApproved ? `
            <button class="btn btn-primary btn-sm complete-req-btn" data-id="${r.id}" style="background:var(--secondary); border-color:var(--secondary);">
              <i class="fa-solid fa-truck-ramp-box"></i> Complete / Dispatch
            </button>
          ` : ''}
          ${(!isPending && !isApproved) ? '-' : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Hook buttons
    document.querySelectorAll(".approve-req-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const res = await window.api.requests.updateStatus(id, "approved");
        if (res.status === 200) {
          showToast("Request approved. Inventory stock reserved.", "success");
          loadBankRequestsData();
        } else {
          showToast(res.error, "danger");
        }
      });
    });

    document.querySelectorAll(".reject-req-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const res = await window.api.requests.updateStatus(id, "rejected");
        if (res.status === 200) {
          showToast("Request rejected.", "warning");
          loadBankRequestsData();
        }
      });
    });

    document.querySelectorAll(".complete-req-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const res = await window.api.requests.updateStatus(id, "completed");
        if (res.status === 200) {
          showToast("Order dispatched and completed! Inventory stock updated.", "success");
          loadBankRequestsData();
        } else {
          showToast(res.error, "danger");
        }
      });
    });
  }

  // 7. SEARCH REGISTERED DONORS VIEW
  async function loadSearchDonorsData() {
    const bg = document.getElementById("search-blood-group").value;
    const loc = document.getElementById("search-location-input").value;

    const res = await window.api.donors.search(bg, loc);
    if (res.status !== 200) return;

    const tbody = el.searchDonorsResultsTable;
    tbody.innerHTML = "";

    const list = res.data;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="notif-empty">No matching active donors found. Try modifying filters.</td></tr>`;
      return;
    }

    list.forEach(d => {
      const isElig = d.eligibility.eligible;
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight:600;">${d.name}</td>
        <td><span class="badge normal" style="font-size:12px; font-weight:700;">${d.bloodGroup}</span></td>
        <td>${d.location}</td>
        <td><i class="fa-solid fa-phone"></i> ${d.phone} <br> <i class="fa-solid fa-envelope"></i> ${d.email}</td>
        <td><span class="badge ${isElig ? 'approved' : 'pending'}">${isElig ? 'Ready / Eligible' : 'Ineligible'}</span></td>
        <td style="font-size:13px; color:var(--text-muted);">${d.age} / ${d.gender}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 8. PROFILE VIEW MANAGEMENT
  function loadProfileFormData() {
    const user = state.user;
    const profile = state.profile;

    document.getElementById("profile-name").value = user.name;
    document.getElementById("profile-email").value = user.email;
    document.getElementById("profile-phone").value = profile.phone || "";
    document.getElementById("profile-location").value = profile.location || "";

    // Toggle forms
    document.getElementById("profile-donor-fields").classList.add("hidden");
    document.getElementById("profile-recipient-fields").classList.add("hidden");

    if (user.role === "donor") {
      document.getElementById("profile-donor-fields").classList.remove("hidden");
      document.getElementById("profile-blood").value = profile.bloodGroup;
      document.getElementById("profile-gender").value = profile.gender;
      document.getElementById("profile-age").value = profile.age;
      document.getElementById("profile-weight").value = profile.weight;
      document.getElementById("profile-last-donation").value = profile.lastDonationDate ? profile.lastDonationDate.split('T')[0] : "";
    } else if (user.role === "recipient") {
      document.getElementById("profile-recipient-fields").classList.remove("hidden");
      document.getElementById("profile-recipient-blood").value = profile.bloodGroup;
    }
  }


  // --- NOTIFICATIONS MANAGEMENT ---
  async function loadNotifications() {
    const res = await window.api.notifications.list();
    if (res.status === 200) {
      state.notifications = res.data;
      
      const unread = state.notifications.filter(n => !n.isRead);
      if (unread.length > 0) {
        el.bellCounter.textContent = unread.length;
        el.bellCounter.classList.remove("hidden");
      } else {
        el.bellCounter.classList.add("hidden");
      }

      // Renders list
      el.notificationsListContainer.innerHTML = "";
      if (state.notifications.length === 0) {
        el.notificationsListContainer.innerHTML = `<div class="notif-empty">All caught up! No notifications.</div>`;
        return;
      }

      state.notifications.forEach(n => {
        const item = document.createElement("div");
        item.className = `notif-item ${n.isRead ? '' : 'unread'}`;
        item.dataset.id = n.id;
        item.innerHTML = `
          <div>${n.message}</div>
          <span class="notif-time">${new Date(n.createdAt).toLocaleTimeString()} - ${new Date(n.createdAt).toLocaleDateString()}</span>
        `;
        el.notificationsListContainer.appendChild(item);

        // Click to read
        item.addEventListener("click", async () => {
          if (!n.isRead) {
            await window.api.notifications.markAsRead(n.id);
            loadNotifications();
          }
        });
      });
    }
  }

  // Periodic Polling Simulation
  function pollNotifications() {
    setInterval(() => {
      if (state.user) {
        loadNotifications();
      }
    }, 10000);
  }

  // --- CSV INVENTORY REPORT EXPORTER ---
  function exportInventoryReport() {
    if (state.user.role !== "blood_bank") return;
    const invRecords = window.db.query("blood_inventory", i => i.bloodBankId === state.user.id);
    
    // Construct CSV String
    let csv = "SaveLives Blood Bank Inventory Report\n";
    csv += `Facility Name: ${state.user.name}\n`;
    csv += `Generated Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
    csv += "Blood Group,Units Available,Status\n";
    
    invRecords.forEach(i => {
      let status = "Adequate";
      if (i.unitsAvailable === 0) status = "CRITICAL OUT OF STOCK";
      else if (i.unitsAvailable < 5) status = "Low Stock Alert";
      
      csv += `${i.bloodGroup},${i.unitsAvailable},${status}\n`;
    });

    // Create Download Link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Inventory_Report_${state.user.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report generated and downloaded.", "success");
  }


  // --- AUTH SUB-CARDS RENDERING ---
  function showAuthCard(cardType) {
    el.authView.classList.remove("hidden");
    el.appView.classList.add("hidden");
    
    el.loginCard.classList.add("hidden");
    el.signupCard.classList.add("hidden");
    el.forgotCard.classList.add("hidden");
    
    if (cardType === "login") el.loginCard.classList.remove("hidden");
    else if (cardType === "signup") el.signupCard.classList.remove("hidden");
    else if (cardType === "forgot") el.forgotCard.classList.remove("hidden");
  }


  // --- EVENT LISTENERS & FORMS HANDLERS ---

  // Auth Card Switches
  document.getElementById("btn-goto-signup").addEventListener("click", (e) => { e.preventDefault(); showAuthCard("signup"); });
  document.getElementById("btn-goto-login").addEventListener("click", (e) => { e.preventDefault(); showAuthCard("login"); });
  document.getElementById("btn-goto-forgot").addEventListener("click", (e) => { e.preventDefault(); showAuthCard("forgot"); });
  document.getElementById("btn-goto-login-from-forgot").addEventListener("click", (e) => { e.preventDefault(); showAuthCard("login"); });

  // Signup fields display toggling
  el.signupRole.addEventListener("change", (e) => {
    const val = e.target.value;
    el.donorFields.classList.add("hidden");
    el.recipientFields.classList.add("hidden");
    
    if (val === "donor") {
      el.donorFields.classList.remove("hidden");
    } else if (val === "recipient") {
      el.recipientFields.classList.remove("hidden");
    }
  });

  // Login Submit
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    const res = await window.api.auth.login(email, pass);
    if (res.status === 200) {
      state.user = res.data.user;
      
      // Load profile info
      const meRes = await window.api.auth.me();
      state.profile = meRes.data.profile;

      setupAppShell();
      navigateTo("dashboard");
      showToast(`Welcome back, ${state.user.name}!`, "success");
    } else {
      showToast(res.error, "danger");
    }
  });

  // Signup Submit
  el.signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = el.signupRole.value;
    const payload = {
      name: document.getElementById("signup-name").value,
      email: document.getElementById("signup-email").value,
      password: document.getElementById("signup-password").value,
      role: role,
      location: document.getElementById("signup-location").value,
      phone: document.getElementById("signup-phone").value
    };

    if (role === "donor") {
      payload.bloodGroup = document.getElementById("signup-blood").value;
      payload.gender = document.getElementById("signup-gender").value;
      payload.age = document.getElementById("signup-age").value;
      payload.weight = document.getElementById("signup-weight").value;
    } else if (role === "recipient") {
      payload.bloodGroup = document.getElementById("signup-recipient-blood").value;
    }

    const res = await window.api.auth.register(payload);
    if (res.status === 200) {
      showToast(res.data.message, "success");
      showAuthCard("login");
    } else {
      showToast(res.error, "danger");
    }
  });

  // Forgot password flow
  el.forgotFormOtp.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value;
    const res = await window.api.auth.forgotPassword(email);
    
    if (res.status === 200) {
      showToast(res.data.message, "success");
      // Display simulated OTP inside UI for ease of demo
      el.otpDemoAlert.innerHTML = `<i class="fa-solid fa-code"></i> Developer Mode: Use simulated OTP code: <b>${res.data.otp}</b>`;
      
      el.forgotFormOtp.classList.add("hidden");
      el.forgotFormReset.classList.remove("hidden");
    } else {
      showToast(res.error, "danger");
    }
  });

  el.forgotFormReset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value;
    const otp = el.forgotOtpCode.value;
    const newPass = document.getElementById("forgot-new-password").value;

    const res = await window.api.auth.resetPasswordWithOtp(email, otp, newPass);
    if (res.status === 200) {
      showToast(res.data.message, "success");
      showAuthCard("login");
      // Reset forms back
      el.forgotFormOtp.classList.remove("hidden");
      el.forgotFormReset.classList.add("hidden");
      el.forgotFormOtp.reset();
      el.forgotFormReset.reset();
    } else {
      showToast(res.error, "danger");
    }
  });

  // Log Donation Submit
  el.donationLogForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const camp = document.getElementById("donation-camp").value;
    const res = await window.api.donations.create({ campName: camp });
    if (res.status === 200) {
      showToast("Donation logged. Profile eligibility recalculated.", "success");
      el.donationLogForm.reset();
      navigateTo("history");
    } else {
      showToast(res.error, "danger");
    }
  });

  // Blood Request Submit
  el.requestBloodForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      bloodGroup: document.getElementById("req-blood-group").value,
      unitsNeeded: document.getElementById("req-units").value,
      location: document.getElementById("req-location").value,
      requestType: document.getElementById("req-type").value,
      bloodBankId: el.reqBankSelector.value || null
    };

    const res = await window.api.requests.create(payload);
    if (res.status === 200) {
      showToast("Blood request published successfully.", "success");
      el.requestBloodForm.reset();
      loadRequestsData();
    } else {
      showToast(res.error, "danger");
    }
  });

  // Inventory Stocks Save
  el.inventoryEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const items = [];
    document.querySelectorAll(".inv-val").forEach(input => {
      items.push({
        bloodGroup: input.dataset.group,
        unitsAvailable: input.value
      });
    });

    const res = await window.api.inventory.update(items);
    if (res.status === 200) {
      showToast(res.data.message, "success");
      navigateTo("dashboard");
    } else {
      showToast(res.error, "danger");
    }
  });

  // Profile Save Changes
  el.profileEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("profile-name").value,
      phone: document.getElementById("profile-phone").value,
      location: document.getElementById("profile-location").value
    };

    if (state.user.role === "donor") {
      payload.bloodGroup = document.getElementById("profile-blood").value;
      payload.gender = document.getElementById("profile-gender").value;
      payload.age = document.getElementById("profile-age").value;
      payload.weight = document.getElementById("profile-weight").value;
      payload.lastDonationDate = document.getElementById("profile-last-donation").value || null;
    } else if (state.user.role === "recipient") {
      payload.bloodGroup = document.getElementById("profile-recipient-blood").value;
    }

    const res = await window.api.profile.update(payload);
    if (res.status === 200) {
      showToast(res.data.message, "success");
      // Refresh current states
      const meRes = await window.api.auth.me();
      state.user = meRes.data.user;
      state.profile = meRes.data.profile;
      setupAppShell();
      navigateTo("dashboard");
    } else {
      showToast(res.error, "danger");
    }
  });

  // Nav Router hooks
  el.navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      const link = item.querySelector("a");
      if (link) {
        const view = link.getAttribute("href").substring(1);
        navigateTo(view);
      }
    });
  });

  // Bell Dropdown Show/Hide
  el.bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    el.notifDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    el.notifDropdown.classList.add("hidden");
  });

  el.btnClearNotifications.addEventListener("click", async (e) => {
    e.stopPropagation();
    // Mark all as read locally
    const unread = state.notifications.filter(n => !n.isRead);
    for (const n of unread) {
      await window.api.notifications.markAsRead(n.id);
    }
    loadNotifications();
    showToast("Notifications cleared", "success");
  });

  // Search filter
  document.getElementById("btn-trigger-search").addEventListener("click", () => {
    loadSearchDonorsData();
  });

  // Theme Toggle click
  el.themeToggleBtn.addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  // Export report
  el.btnDownloadReport.addEventListener("click", () => {
    exportInventoryReport();
  });

  // Logout click
  el.btnLogout.addEventListener("click", async () => {
    await window.api.auth.logout();
    state.user = null;
    state.profile = null;
    showToast("Logged out successfully", "success");
    showAuthCard("login");
  });


  // --- FLOATING DEV PANEL HOOKS ---

  // Collapse/Expand developer panel
  el.demoHeaderBtn.addEventListener("click", () => {
    el.demoBodyPanel.classList.toggle("hidden");
    const isHidden = el.demoBodyPanel.classList.contains("hidden");
    el.demoToggleIcon.className = isHidden ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
  });

  // Quick Switch logins
  el.demoBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      const res = await window.api.auth.login(email, "password123");
      if (res.status === 200) {
        state.user = res.data.user;
        const meRes = await window.api.auth.me();
        state.profile = meRes.data.profile;
        setupAppShell();
        navigateTo("dashboard");
        showToast(`Impersonated ${state.user.name} (${state.user.role})`, "success");
      } else {
        showToast(res.error, "danger");
      }
    });
  });

  // Reset database simulation
  el.demoBtnClearDb.addEventListener("click", () => {
    if (confirm("Reset local storage database and reload seed data?")) {
      window.db.clearAll();
      showToast("Database reset with seed data", "success");
      setTimeout(() => window.location.reload(), 800);
    }
  });

  // Mock live alert notification
  el.demoBtnTriggerNotif.addEventListener("click", () => {
    if (!state.user) {
      showToast("Log in first to receive notification", "danger");
      return;
    }

    const types = ["emergency", "request_alert", "reminder", "approval"];
    const type = types[Math.floor(Math.random() * types.length)];
    const messages = {
      emergency: `Urgent: Emergency request matching your profile in your location!`,
      request_alert: `New blood donation drive scheduled near your area next week.`,
      reminder: `Donation Reminder: You have met the 90-day window and can donate blood today.`,
      approval: `System Alert: Security settings updated for matching location protocols.`
    };

    window.db.insert("notifications", {
      userId: state.user.id,
      message: messages[type],
      type: type,
      isRead: false
    });

    loadNotifications();
    showToast("Mock alert notification injected!", "success");
  });

  // Start the application
  window.onload = init;
})();
