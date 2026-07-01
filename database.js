/**
 * database.js
 * Simulated Relational Database stored in localStorage.
 * Automatically initializes schemas and pre-populates with realistic seed data if empty.
 */

(function () {
  const DB_PREFIX = "bdms_db_";

  const Schemas = {
    users: [],
    donors: [],
    recipients: [],
    blood_banks: [],
    hospitals: [],
    blood_requests: [],
    donations: [],
    blood_inventory: [],
    notifications: []
  };

  // Helper to load table
  function getTable(tableName) {
    const data = localStorage.getItem(DB_PREFIX + tableName);
    return data ? JSON.parse(data) : [];
  }

  // Helper to save table
  function saveTable(tableName, data) {
    localStorage.setItem(DB_PREFIX + tableName, JSON.stringify(data));
  }

  // Generate simple unique numeric ID
  function generateId(tableName) {
    const table = getTable(tableName);
    if (table.length === 0) return 1;
    return Math.max(...table.map(row => row.id || 0)) + 1;
  }

  // Export functions to global scope
  window.db = {
    get: getTable,
    save: saveTable,
    insert: function (tableName, record) {
      const table = getTable(tableName);
      record.id = generateId(tableName);
      record.createdAt = new Date().toISOString();
      table.push(record);
      saveTable(tableName, table);
      return record;
    },
    update: function (tableName, id, updates) {
      const table = getTable(tableName);
      const index = table.findIndex(row => row.id === Number(id) || row.id === id);
      if (index === -1) return null;
      table[index] = { ...table[index], ...updates, updatedAt: new Date().toISOString() };
      saveTable(tableName, table);
      return table[index];
    },
    delete: function (tableName, id) {
      const table = getTable(tableName);
      const filtered = table.filter(row => row.id !== Number(id) && row.id !== id);
      saveTable(tableName, filtered);
      return true;
    },
    query: function (tableName, predicate) {
      return getTable(tableName).filter(predicate);
    },
    clearAll: function() {
      Object.keys(Schemas).forEach(table => {
        localStorage.removeItem(DB_PREFIX + table);
      });
      this.init(true);
    },
    init: function (force = false) {
      // Check if db is already initialized
      const isInitialized = localStorage.getItem(DB_PREFIX + "initialized");
      if (isInitialized && !force) {
        return;
      }

      console.log("Initializing database with seed data...");
      
      // Let's seed initial data
      // For passwords, we will store pre-computed SHA-256 hashes for simplicity.
      // Pre-computed hash for password "password123":
      // "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2"
      
      const seedUsers = [
        { id: 1, name: "System Admin", email: "admin@blood.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "admin", status: "active", createdAt: new Date().toISOString() },
        { id: 2, name: "John Donor", email: "donor@blood.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "donor", status: "active", createdAt: new Date().toISOString() },
        { id: 3, name: "Mary Recipient", email: "recipient@blood.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "recipient", status: "active", createdAt: new Date().toISOString() },
        { id: 4, name: "City Central Blood Bank", email: "bank@blood.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "blood_bank", status: "active", createdAt: new Date().toISOString() },
        { id: 5, name: "St. Jude Hospital", email: "hospital@blood.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "hospital", status: "active", createdAt: new Date().toISOString() },
        
        // Additional seed users
        { id: 6, name: "Jane Smith", email: "jane@donor.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "donor", status: "active", createdAt: new Date().toISOString() },
        { id: 7, name: "Metro General Hospital", email: "metro@hospital.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "hospital", status: "active", createdAt: new Date().toISOString() },
        { id: 8, name: "Red Cross Blood Bank", email: "redcross@bank.com", passwordHash: "ef92b778bafe771e89245b89ecdec08a4c79010f7950d178554c461bd31d1db2", role: "blood_bank", status: "pending", createdAt: new Date().toISOString() } // pending approval
      ];

      const seedDonors = [
        { id: 1, userId: 2, bloodGroup: "A+", age: 28, gender: "Male", weight: 75, location: "New York, NY", phone: "555-0199", lastDonationDate: "2026-03-10T10:00:00Z" },
        { id: 2, userId: 6, bloodGroup: "O-", age: 34, gender: "Female", weight: 62, location: "New York, NY", phone: "555-0144", lastDonationDate: "2026-05-25T10:00:00Z" }
      ];

      const seedRecipients = [
        { id: 1, userId: 3, bloodGroup: "B+", location: "New York, NY", phone: "555-0122" }
      ];

      const seedBloodBanks = [
        { id: 1, userId: 4, name: "City Central Blood Bank", location: "New York, NY", phone: "555-0100", isApproved: true },
        { id: 2, userId: 8, name: "Red Cross Blood Bank", location: "Chicago, IL", phone: "555-0200", isApproved: false }
      ];

      const seedHospitals = [
        { id: 1, userId: 5, name: "St. Jude Hospital", location: "New York, NY", phone: "555-0150", isApproved: true },
        { id: 2, userId: 7, name: "Metro General Hospital", location: "Chicago, IL", phone: "555-0250", isApproved: true }
      ];

      const seedBloodInventory = [
        // City Central Blood Bank inventory
        { id: 1, bloodBankId: 1, bloodGroup: "A+", unitsAvailable: 15, lastUpdated: new Date().toISOString() },
        { id: 2, bloodBankId: 1, bloodGroup: "A-", unitsAvailable: 4, lastUpdated: new Date().toISOString() },
        { id: 3, bloodBankId: 1, bloodGroup: "B+", unitsAvailable: 10, lastUpdated: new Date().toISOString() },
        { id: 4, bloodBankId: 1, bloodGroup: "B-", unitsAvailable: 2, lastUpdated: new Date().toISOString() },
        { id: 5, bloodBankId: 1, bloodGroup: "O+", unitsAvailable: 25, lastUpdated: new Date().toISOString() },
        { id: 6, bloodBankId: 1, bloodGroup: "O-", unitsAvailable: 1, lastUpdated: new Date().toISOString() }, // critical low
        { id: 7, bloodBankId: 1, bloodGroup: "AB+", unitsAvailable: 8, lastUpdated: new Date().toISOString() },
        { id: 8, bloodBankId: 1, bloodGroup: "AB-", unitsAvailable: 3, lastUpdated: new Date().toISOString() },
        // Red Cross Blood Bank inventory
        { id: 9, bloodBankId: 2, bloodGroup: "A+", unitsAvailable: 20, lastUpdated: new Date().toISOString() },
        { id: 10, bloodBankId: 2, bloodGroup: "O-", unitsAvailable: 8, lastUpdated: new Date().toISOString() }
      ];

      const seedBloodRequests = [
        { 
          id: 1, 
          requesterId: 3, // Mary Recipient (userId 3, recipientId 1)
          requesterType: "recipient", 
          requesterName: "Mary Recipient", 
          bloodGroup: "B+", 
          unitsNeeded: 3, 
          requestType: "normal", 
          location: "New York, NY", 
          status: "pending", 
          bloodBankId: null,
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
        },
        { 
          id: 2, 
          requesterId: 5, // St. Jude Hospital (userId 5, hospitalId 1)
          requesterType: "hospital", 
          requesterName: "St. Jude Hospital", 
          bloodGroup: "O-", 
          unitsNeeded: 2, 
          requestType: "emergency", 
          location: "New York, NY", 
          status: "pending", 
          bloodBankId: 1, // Requested from City Central Bank
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
        },
        { 
          id: 3, 
          requesterId: 7, // Metro General Hospital
          requesterType: "hospital", 
          requesterName: "Metro General Hospital", 
          bloodGroup: "A+", 
          unitsNeeded: 5, 
          requestType: "normal", 
          location: "Chicago, IL", 
          status: "completed", 
          bloodBankId: 2,
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() 
        }
      ];

      const seedDonations = [
        { id: 1, donorId: 1, donorName: "John Donor", bloodGroup: "A+", units: 1, donationDate: "2026-03-10T10:00:00Z", campName: "Central Blood Drive", status: "completed" },
        { id: 2, donorId: 2, donorName: "Jane Smith", bloodGroup: "O-", units: 1, donationDate: "2026-05-25T10:00:00Z", campName: "St. Jude Campus Camp", status: "completed" }
      ];

      const seedNotifications = [
        { id: 1, userId: 2, message: "Urgent: O- Emergency request from St. Jude Hospital matches your area.", type: "emergency", isRead: false, createdAt: new Date().toISOString() },
        { id: 2, userId: 4, message: "New Emergency blood request received from St. Jude Hospital.", type: "request_alert", isRead: false, createdAt: new Date().toISOString() },
        { id: 3, userId: 8, message: "Welcome! Your Blood Bank profile is pending administrator approval.", type: "approval", isRead: false, createdAt: new Date().toISOString() }
      ];

      saveTable("users", seedUsers);
      saveTable("donors", seedDonors);
      saveTable("recipients", seedRecipients);
      saveTable("blood_banks", seedBloodBanks);
      saveTable("hospitals", seedHospitals);
      saveTable("blood_inventory", seedBloodInventory);
      saveTable("blood_requests", seedBloodRequests);
      saveTable("donations", seedDonations);
      saveTable("notifications", seedNotifications);
      
      localStorage.setItem(DB_PREFIX + "initialized", "true");
      console.log("Database initialized successfully!");
    }
  };

  // Run initialization
  window.db.init();
})();
