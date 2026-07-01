/**
 * api.js
 * Mock API layer. Simulates network requests with latency,
 * validates input, and enforces role-based authorization using simulated JWT.
 */

(function () {
  const LATENCY_MS = 250; // Mock network delay

  // Simulated latency wrapper
  function mockFetch(resolver) {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await resolver();
          resolve({ status: 200, data: result });
        } catch (error) {
          console.warn("API Error:", error);
          resolve({ status: error.status || 500, error: error.message });
        }
      }, LATENCY_MS);
    });
  }

  // Get current active token user payload
  async function getCurrentUser() {
    const token = localStorage.getItem("bdms_jwt_token");
    if (!token) return null;
    const payload = await window.cryptoHelper.verifyJWT(token);
    if (!payload) {
      localStorage.removeItem("bdms_jwt_token");
    }
    return payload;
  }

  // Helper to enforce auth and roles
  async function requireAuth(allowedRoles = []) {
    const user = await getCurrentUser();
    if (!user) {
      const err = new Error("Authentication required");
      err.status = 401;
      throw err;
    }
    
    // Check status in DB to ensure they aren't blocked since token issuance
    const dbUser = window.db.query("users", u => u.id === user.id)[0];
    if (!dbUser || dbUser.status === "blocked") {
      localStorage.removeItem("bdms_jwt_token");
      const err = new Error("User account is blocked or inactive");
      err.status = 403;
      throw err;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      const err = new Error("Access denied: insufficient permissions");
      err.status = 403;
      throw err;
    }
    return dbUser;
  }

  // Generate automated matching notifications for donors
  function notifyMatchingDonors(bloodRequest) {
    const donors = window.db.get("donors");
    const users = window.db.get("users");
    
    // Filter matching donors (blood group and location)
    const matchingDonors = donors.filter(d => {
      // Check location match (simple string contains)
      const locMatch = d.location.toLowerCase().includes(bloodRequest.location.toLowerCase()) || 
                       bloodRequest.location.toLowerCase().includes(d.location.toLowerCase());
      return d.bloodGroup === bloodRequest.bloodGroup && locMatch;
    });

    matchingDonors.forEach(donor => {
      window.db.insert("notifications", {
        userId: donor.userId,
        message: `New ${bloodRequest.requestType === 'emergency' ? 'EMERGENCY ' : ''}request for ${bloodRequest.bloodGroup} in ${bloodRequest.location} (${bloodRequest.unitsNeeded} units).`,
        type: bloodRequest.requestType === 'emergency' ? 'emergency' : 'request_alert',
        isRead: false
      });
    });
  }

  // Calculate donor eligibility details
  function checkDonorEligibility(donor) {
    if (!donor) return { eligible: false, reason: "No profile found" };
    if (donor.age < 18 || donor.age > 65) {
      return { eligible: false, reason: "Age must be between 18 and 65 years" };
    }
    if (donor.weight < 50) {
      return { eligible: false, reason: "Weight must be at least 50 kg" };
    }
    if (!donor.lastDonationDate) {
      return { eligible: true, daysRemaining: 0, reason: "Eligible (no prior donations logged)" };
    }

    const lastDate = new Date(donor.lastDonationDate);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    if (lastDate > ninetyDaysAgo) {
      const diffTime = Math.abs(lastDate - ninetyDaysAgo);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { 
        eligible: false, 
        daysRemaining: diffDays, 
        reason: `Must wait 90 days between donations. Days remaining: ${diffDays}` 
      };
    }

    return { eligible: true, daysRemaining: 0, reason: "Eligible to donate" };
  }

  // Export API actions
  window.api = {
    auth: {
      login: (email, password) => mockFetch(async () => {
        if (!email || !password) throw new Error("Email and password are required");
        const users = window.db.get("users");
        const hashedPassword = await window.cryptoHelper.hashPassword(password);
        
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!user || user.passwordHash !== hashedPassword) {
          throw new Error("Invalid email or password");
        }
        if (user.status === "blocked") {
          throw new Error("Your account has been blocked by the administrator");
        }

        // Additional checks for blood bank / hospital approval
        if (user.role === "blood_bank") {
          const bank = window.db.query("blood_banks", b => b.userId === user.id)[0];
          if (bank && !bank.isApproved) {
            throw new Error("Your Blood Bank registration is pending administrator approval.");
          }
        }
        if (user.role === "hospital") {
          const hosp = window.db.query("hospitals", h => h.userId === user.id)[0];
          if (hosp && !hosp.isApproved) {
            throw new Error("Your Hospital registration is pending administrator approval.");
          }
        }

        const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
        const token = await window.cryptoHelper.generateJWT(tokenPayload);
        localStorage.setItem("bdms_jwt_token", token);
        return { token, user: tokenPayload };
      }),

      register: (registrationData) => mockFetch(async () => {
        const { name, email, password, role, ...roleData } = registrationData;
        if (!name || !email || !password || !role) {
          throw new Error("Name, email, password, and role are required");
        }

        const users = window.db.get("users");
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error("Email is already registered");
        }

        const hashedPassword = await window.cryptoHelper.hashPassword(password);
        
        // Build new user entry
        // For blood banks and hospitals, their approval status starts as false
        const userStatus = (role === "admin" || role === "donor" || role === "recipient") ? "active" : "active"; 
        
        const newUser = window.db.insert("users", {
          name,
          email,
          passwordHash: hashedPassword,
          role,
          status: "active"
        });

        // Insert role-specific profile data
        if (role === "donor") {
          window.db.insert("donors", {
            userId: newUser.id,
            bloodGroup: roleData.bloodGroup,
            age: Number(roleData.age),
            gender: roleData.gender,
            weight: Number(roleData.weight),
            location: roleData.location || "Unknown",
            phone: roleData.phone || "",
            lastDonationDate: roleData.lastDonationDate || null
          });
        } else if (role === "recipient") {
          window.db.insert("recipients", {
            userId: newUser.id,
            bloodGroup: roleData.bloodGroup,
            location: roleData.location || "Unknown",
            phone: roleData.phone || ""
          });
        } else if (role === "blood_bank") {
          window.db.insert("blood_banks", {
            userId: newUser.id,
            name,
            location: roleData.location || "Unknown",
            phone: roleData.phone || "",
            isApproved: false // Admin approval required
          });
          // Insert default empty inventory for this bank
          const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
          bloodGroups.forEach(bg => {
            window.db.insert("blood_inventory", {
              bloodBankId: newUser.id, // linked to user.id representing the bank profile
              bloodGroup: bg,
              unitsAvailable: 0
            });
          });
          // Insert notification to admin
          const admins = window.db.query("users", u => u.role === "admin");
          admins.forEach(adm => {
            window.db.insert("notifications", {
              userId: adm.id,
              message: `New Blood Bank registration: ${name} is pending verification.`,
              type: "approval",
              isRead: false
            });
          });
        } else if (role === "hospital") {
          window.db.insert("hospitals", {
            userId: newUser.id,
            name,
            location: roleData.location || "Unknown",
            phone: roleData.phone || "",
            isApproved: false // Admin approval required
          });
          // Insert notification to admin
          const admins = window.db.query("users", u => u.role === "admin");
          admins.forEach(adm => {
            window.db.insert("notifications", {
              userId: adm.id,
              message: `New Hospital registration: ${name} is pending verification.`,
              type: "approval",
              isRead: false
            });
          });
        }

        return { success: true, message: "Registration successful. You can log in." };
      }),

      forgotPassword: (email) => mockFetch(async () => {
        if (!email) throw new Error("Email is required");
        const user = window.db.query("users", u => u.email.toLowerCase() === email.toLowerCase())[0];
        if (!user) throw new Error("Email not found in our database");
        
        // In a real system, we'd email an OTP. Here, we'll return a simulated success payload with OTP code
        const simulatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save to system log or notify (mock)
        console.log(`Simulated OTP for ${email}: ${simulatedOtp}`);
        
        // Save OTP temporarily in session/localstorage
        localStorage.setItem(`bdms_otp_${email}`, simulatedOtp);
        
        return { success: true, message: `Simulated OTP verification sent to ${email}`, otp: simulatedOtp };
      }),

      resetPasswordWithOtp: (email, otp, newPassword) => mockFetch(async () => {
        if (!email || !otp || !newPassword) throw new Error("All fields are required");
        const savedOtp = localStorage.getItem(`bdms_otp_${email}`);
        if (savedOtp !== otp) {
          throw new Error("Invalid verification code (OTP)");
        }

        const user = window.db.query("users", u => u.email.toLowerCase() === email.toLowerCase())[0];
        if (!user) throw new Error("User no longer exists");

        const hashedPassword = await window.cryptoHelper.hashPassword(newPassword);
        window.db.update("users", user.id, { passwordHash: hashedPassword });
        
        // Cleanup OTP
        localStorage.removeItem(`bdms_otp_${email}`);
        return { success: true, message: "Password updated successfully." };
      }),

      logout: () => {
        localStorage.removeItem("bdms_jwt_token");
        return Promise.resolve({ status: 200, data: true });
      },

      me: () => mockFetch(async () => {
        const payload = await getCurrentUser();
        if (!payload) return null;
        
        const user = window.db.query("users", u => u.id === payload.id)[0];
        if (!user || user.status === "blocked") return null;

        let profile = null;
        if (user.role === "donor") {
          profile = window.db.query("donors", d => d.userId === user.id)[0];
          if (profile) profile.eligibility = checkDonorEligibility(profile);
        } else if (user.role === "recipient") {
          profile = window.db.query("recipients", r => r.userId === user.id)[0];
        } else if (user.role === "blood_bank") {
          profile = window.db.query("blood_banks", b => b.userId === user.id)[0];
        } else if (user.role === "hospital") {
          profile = window.db.query("hospitals", h => h.userId === user.id)[0];
        }

        return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, profile };
      })
    },

    profile: {
      update: (profileData) => mockFetch(async () => {
        const user = await requireAuth();
        
        // Update user record
        window.db.update("users", user.id, { name: profileData.name });
        
        if (user.role === "donor") {
          const donor = window.db.query("donors", d => d.userId === user.id)[0];
          if (donor) {
            window.db.update("donors", donor.id, {
              bloodGroup: profileData.bloodGroup,
              age: Number(profileData.age),
              gender: profileData.gender,
              weight: Number(profileData.weight),
              location: profileData.location,
              phone: profileData.phone,
              lastDonationDate: profileData.lastDonationDate || donor.lastDonationDate
            });
          }
        } else if (user.role === "recipient") {
          const rec = window.db.query("recipients", r => r.userId === user.id)[0];
          if (rec) {
            window.db.update("recipients", rec.id, {
              bloodGroup: profileData.bloodGroup,
              location: profileData.location,
              phone: profileData.phone
            });
          }
        } else if (user.role === "blood_bank") {
          const bank = window.db.query("blood_banks", b => b.userId === user.id)[0];
          if (bank) {
            window.db.update("blood_banks", bank.id, {
              location: profileData.location,
              phone: profileData.phone
            });
          }
        } else if (user.role === "hospital") {
          const hosp = window.db.query("hospitals", h => h.userId === user.id)[0];
          if (hosp) {
            window.db.update("hospitals", hosp.id, {
              location: profileData.location,
              phone: profileData.phone
            });
          }
        }

        return { success: true, message: "Profile updated successfully" };
      })
    },

    donors: {
      search: (bloodGroup, location) => mockFetch(async () => {
        await requireAuth();
        const donors = window.db.get("donors");
        const users = window.db.get("users");

        return donors
          .filter(d => {
            const matchesBg = !bloodGroup || d.bloodGroup === bloodGroup;
            const matchesLoc = !location || d.location.toLowerCase().includes(location.toLowerCase());
            
            // Check if user is active (not blocked)
            const u = users.find(usr => usr.id === d.userId);
            const isActive = u && u.status === "active";

            return matchesBg && matchesLoc && isActive;
          })
          .map(d => {
            const u = users.find(usr => usr.id === d.userId);
            return {
              id: d.id,
              name: u ? u.name : "Anonymous",
              email: u ? u.email : "",
              bloodGroup: d.bloodGroup,
              location: d.location,
              phone: d.phone,
              gender: d.gender,
              age: d.age,
              eligibility: checkDonorEligibility(d)
            };
          });
      }),

      getCamps: () => mockFetch(async () => {
        // Mock static donation camps
        return [
          { id: 1, name: "City Center Donation Drive", location: "New York, NY", date: "2026-07-10", time: "09:00 AM - 04:00 PM", organizer: "City Central Blood Bank" },
          { id: 2, name: "Annual Hospital Camp", location: "New York, NY", date: "2026-07-18", time: "10:00 AM - 06:00 PM", organizer: "St. Jude Hospital" },
          { id: 3, name: "Suburban Blood Drive", location: "Brooklyn, NY", date: "2026-07-25", time: "08:00 AM - 02:00 PM", organizer: "Red Cross" },
          { id: 4, name: "Metro Center Camp", location: "Chicago, IL", date: "2026-07-15", time: "09:00 AM - 05:00 PM", organizer: "Metro General Hospital" }
        ];
      })
    },

    requests: {
      create: (requestData) => mockFetch(async () => {
        const user = await requireAuth(["recipient", "hospital"]);
        
        let requesterName = user.name;
        
        const newRequest = window.db.insert("blood_requests", {
          requesterId: user.id,
          requesterType: user.role,
          requesterName: requesterName,
          bloodGroup: requestData.bloodGroup,
          unitsNeeded: Number(requestData.unitsNeeded),
          requestType: requestData.requestType || "normal", // 'normal' or 'emergency'
          location: requestData.location,
          status: "pending",
          bloodBankId: requestData.bloodBankId ? Number(requestData.bloodBankId) : null
        });

        // Notify matching donors
        notifyMatchingDonors(newRequest);

        // If emergency hospital request, notify targeted blood bank specifically
        if (user.role === "hospital" && requestData.bloodBankId) {
          window.db.insert("notifications", {
            userId: Number(requestData.bloodBankId), // User ID of the blood bank
            message: `Emergency request for ${requestData.bloodGroup} (${requestData.unitsNeeded} units) submitted by ${user.name}.`,
            type: "request_alert",
            isRead: false
          });
        }

        return { success: true, data: newRequest };
      }),

      list: () => mockFetch(async () => {
        const user = await requireAuth();
        const requests = window.db.get("blood_requests");

        // Return requests based on role
        if (user.role === "recipient" || user.role === "hospital") {
          // View their own requests
          return requests.filter(r => r.requesterId === user.id);
        } else if (user.role === "blood_bank") {
          // View requests targeting this bank or general requests matching location
          const bankProfile = window.db.query("blood_banks", b => b.userId === user.id)[0];
          return requests.filter(r => {
            const matchesBank = r.bloodBankId === user.id;
            const isGeneral = !r.bloodBankId;
            const matchesLoc = bankProfile && (
              r.location.toLowerCase().includes(bankProfile.location.toLowerCase()) ||
              bankProfile.location.toLowerCase().includes(r.location.toLowerCase())
            );
            return matchesBank || (isGeneral && matchesLoc);
          });
        } else if (user.role === "donor") {
          // Donors view public pending requests in their area that match their blood group
          const donorProfile = window.db.query("donors", d => d.userId === user.id)[0];
          if (!donorProfile) return [];
          
          return requests.filter(r => {
            const matchesBg = r.bloodGroup === donorProfile.bloodGroup;
            const matchesLoc = r.location.toLowerCase().includes(donorProfile.location.toLowerCase()) || 
                               donorProfile.location.toLowerCase().includes(r.location.toLowerCase());
            return matchesBg && matchesLoc && r.status === "pending";
          });
        } else if (user.role === "admin") {
          // Admin sees everything
          return requests;
        }
        return [];
      }),

      updateStatus: (requestId, status) => mockFetch(async () => {
        const user = await requireAuth(["blood_bank", "admin"]);
        const request = window.db.query("blood_requests", r => r.id === Number(requestId))[0];
        if (!request) throw new Error("Blood request not found");

        // Validate changes
        if (status === "approved" || status === "completed") {
          // If approved/completed by blood bank, check if they have enough inventory
          if (user.role === "blood_bank") {
            const inventory = window.db.query("blood_inventory", i => i.bloodBankId === user.id && i.bloodGroup === request.bloodGroup)[0];
            
            // Only enforce inventory deduction for completed approvals
            if (status === "approved" && (!inventory || inventory.unitsAvailable < request.unitsNeeded)) {
              throw new Error(`Insufficient inventory in ${request.bloodGroup}. Available: ${inventory ? inventory.unitsAvailable : 0} units.`);
            }
            
            if (status === "completed" && request.status !== "completed") {
              if (inventory) {
                const newQty = Math.max(0, inventory.unitsAvailable - request.unitsNeeded);
                window.db.update("blood_inventory", inventory.id, {
                  unitsAvailable: newQty,
                  lastUpdated: new Date().toISOString()
                });
              }
            }
          }
        }

        const updated = window.db.update("blood_requests", request.id, { status });

        // Notify the requester
        window.db.insert("notifications", {
          userId: request.requesterId,
          message: `Your request for ${request.bloodGroup} (${request.unitsNeeded} units) has been ${status}.`,
          type: "approval",
          isRead: false
        });

        return { success: true, data: updated };
      })
    },

    donations: {
      create: (donationData) => mockFetch(async () => {
        const user = await requireAuth(["donor"]);
        const donorProfile = window.db.query("donors", d => d.userId === user.id)[0];
        if (!donorProfile) throw new Error("Donor profile not found");
        
        // Check eligibility
        const eligibility = checkDonorEligibility(donorProfile);
        if (!eligibility.eligible) {
          throw new Error(`Ineligible to donate: ${eligibility.reason}`);
        }

        const newDonation = window.db.insert("donations", {
          donorId: donorProfile.id,
          donorName: user.name,
          bloodGroup: donorProfile.bloodGroup,
          units: 1, // standard single unit
          donationDate: new Date().toISOString(),
          campName: donationData.campName || "Walk-in Donation",
          status: "pending"
        });

        // Update lastDonationDate in profile
        window.db.update("donors", donorProfile.id, {
          lastDonationDate: new Date().toISOString()
        });

        // Trigger notification to user
        window.db.insert("notifications", {
          userId: user.id,
          message: `Donation scheduled. Thank you for your donation of 1 unit of ${donorProfile.bloodGroup}!`,
          type: "reminder",
          isRead: false
        });

        // Automatically allocate to a blood bank inventory if accepted (in mock we auto-approve standard walk-ins)
        // Let's find first approved blood bank in the donor's area to allocate units
        const donorLoc = donorProfile.location.split(",")[0].trim().toLowerCase();
        const banks = window.db.get("blood_banks").filter(b => b.isApproved);
        const localBank = banks.find(b => b.location.toLowerCase().includes(donorLoc)) || banks[0];

        if (localBank) {
          const inv = window.db.query("blood_inventory", i => i.bloodBankId === localBank.userId && i.bloodGroup === donorProfile.bloodGroup)[0];
          if (inv) {
            window.db.update("blood_inventory", inv.id, {
              unitsAvailable: inv.unitsAvailable + 1,
              lastUpdated: new Date().toISOString()
            });
            window.db.update("donations", newDonation.id, { status: "completed" });
            
            // Notify blood bank of new stock
            window.db.insert("notifications", {
              userId: localBank.userId,
              message: `New donation received: 1 unit of ${donorProfile.bloodGroup} added to your inventory from ${user.name}.`,
              type: "request_alert",
              isRead: false
            });
          }
        }

        return { success: true, data: newDonation };
      }),

      list: () => mockFetch(async () => {
        const user = await requireAuth();
        const donations = window.db.get("donations");

        if (user.role === "donor") {
          const profile = window.db.query("donors", d => d.userId === user.id)[0];
          if (!profile) return [];
          return donations.filter(d => d.donorId === profile.id);
        } else if (user.role === "admin" || user.role === "blood_bank") {
          return donations;
        }
        return [];
      })
    },

    inventory: {
      get: () => mockFetch(async () => {
        const user = await requireAuth();
        const inventory = window.db.get("blood_inventory");

        if (user.role === "blood_bank") {
          return inventory.filter(i => i.bloodBankId === user.id);
        } else {
          // Public or non-bank users view aggregated inventory grouped by bank
          const banks = window.db.get("blood_banks").filter(b => b.isApproved);
          return inventory.map(item => {
            const bank = banks.find(b => b.userId === item.bloodBankId);
            return {
              ...item,
              bankName: bank ? bank.name : "Unknown Bank",
              location: bank ? bank.location : "Unknown Location"
            };
          }).filter(item => item.bankName !== "Unknown Bank");
        }
      }),

      update: (items) => mockFetch(async () => {
        const user = await requireAuth(["blood_bank"]);
        
        items.forEach(item => {
          const invRecord = window.db.query("blood_inventory", i => i.bloodBankId === user.id && i.bloodGroup === item.bloodGroup)[0];
          if (invRecord) {
            window.db.update("blood_inventory", invRecord.id, {
              unitsAvailable: Math.max(0, Number(item.unitsAvailable)),
              lastUpdated: new Date().toISOString()
            });
          } else {
            window.db.insert("blood_inventory", {
              bloodBankId: user.id,
              bloodGroup: item.bloodGroup,
              unitsAvailable: Math.max(0, Number(item.unitsAvailable))
            });
          }
        });

        return { success: true, message: "Inventory updated successfully" };
      })
    },

    notifications: {
      list: () => mockFetch(async () => {
        const user = await getCurrentUser();
        if (!user) return [];
        return window.db.query("notifications", n => n.userId === user.id).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      }),

      markAsRead: (id) => mockFetch(async () => {
        const user = await requireAuth();
        window.db.update("notifications", Number(id), { isRead: true });
        return { success: true };
      })
    },

    admin: {
      getStats: () => mockFetch(async () => {
        await requireAuth(["admin"]);

        const users = window.db.get("users");
        const requests = window.db.get("blood_requests");
        const donations = window.db.get("donations");
        const inventory = window.db.get("blood_inventory");

        // Aggregated stats
        const totalDonors = users.filter(u => u.role === "donor").length;
        const totalRequests = requests.length;
        const successfulDonations = donations.filter(d => d.status === "completed").length;
        const emergencyRequests = requests.filter(r => r.requestType === "emergency").length;

        // Group inventory by blood group
        const groupInventory = {};
        ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].forEach(bg => {
          groupInventory[bg] = 0;
        });

        inventory.forEach(item => {
          if (groupInventory[item.bloodGroup] !== undefined) {
            groupInventory[item.bloodGroup] += item.unitsAvailable;
          }
        });

        // Recent activities timeline
        const recentActivities = [];
        
        // Add requests to activities
        requests.slice(-3).forEach(r => {
          recentActivities.push({
            time: r.createdAt,
            type: r.requestType === 'emergency' ? 'emergency' : 'request',
            text: `${r.requesterName} requested ${r.unitsNeeded} units of ${r.bloodGroup} (${r.status})`
          });
        });

        // Add completed donations to activities
        donations.slice(-3).forEach(d => {
          recentActivities.push({
            time: d.donationDate,
            type: 'donation',
            text: `${d.donorName} donated 1 unit of ${d.bloodGroup} (${d.status})`
          });
        });

        recentActivities.sort((a,b) => new Date(b.time) - new Date(a.time));

        return {
          totalDonors,
          totalRequests,
          successfulDonations,
          emergencyRequests,
          groupInventory,
          recentActivities: recentActivities.slice(0, 5)
        };
      }),

      usersList: () => mockFetch(async () => {
        await requireAuth(["admin"]);
        const users = window.db.get("users");
        const donors = window.db.get("donors");
        const recipients = window.db.get("recipients");
        const banks = window.db.get("blood_banks");
        const hospitals = window.db.get("hospitals");

        return users.map(u => {
          let detail = "";
          let isApproved = true;

          if (u.role === "donor") {
            const p = donors.find(d => d.userId === u.id);
            detail = p ? `${p.bloodGroup}, ${p.location}` : "";
          } else if (u.role === "recipient") {
            const p = recipients.find(r => r.userId === u.id);
            detail = p ? `${p.bloodGroup}, ${p.location}` : "";
          } else if (u.role === "blood_bank") {
            const p = banks.find(b => b.userId === u.id);
            detail = p ? p.location : "";
            isApproved = p ? p.isApproved : false;
          } else if (u.role === "hospital") {
            const p = hospitals.find(h => h.userId === u.id);
            detail = p ? p.location : "";
            isApproved = p ? p.isApproved : false;
          }

          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            detail,
            isApproved,
            createdAt: u.createdAt
          };
        });
      }),

      updateUserStatus: (targetUserId, updates) => mockFetch(async () => {
        await requireAuth(["admin"]);
        const target = window.db.query("users", u => u.id === Number(targetUserId))[0];
        if (!target) throw new Error("User not found");

        if (updates.status) {
          window.db.update("users", target.id, { status: updates.status });
        }

        if (updates.hasOwnProperty("isApproved")) {
          if (target.role === "blood_bank") {
            const profile = window.db.query("blood_banks", b => b.userId === target.id)[0];
            if (profile) {
              window.db.update("blood_banks", profile.id, { isApproved: updates.isApproved });
              
              // Notify the blood bank user
              window.db.insert("notifications", {
                userId: target.id,
                message: `Your Blood Bank registration has been ${updates.isApproved ? "APPROVED" : "REJECTED"} by the administrator.`,
                type: "approval",
                isRead: false
              });
            }
          } else if (target.role === "hospital") {
            const profile = window.db.query("hospitals", h => h.userId === target.id)[0];
            if (profile) {
              window.db.update("hospitals", profile.id, { isApproved: updates.isApproved });
              
              // Notify the hospital user
              window.db.insert("notifications", {
                userId: target.id,
                message: `Your Hospital registration has been ${updates.isApproved ? "APPROVED" : "REJECTED"} by the administrator.`,
                type: "approval",
                isRead: false
              });
            }
          }
        }

        return { success: true };
      })
    }
  };
})();
