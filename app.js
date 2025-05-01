// Initialize Telegram WebApp and Bot Connection
const webapp = window.Telegram.WebApp;
webapp.ready();

// Set theme
webapp.setHeaderColor('#0F172A');
webapp.MainButton.hide();

// Get Telegram user info
const telegramUser = webapp.initDataUnsafe?.user || null;
const botToken = webapp.initDataUnsafe?.bot?.token;

// Constants
const API_ENDPOINT = 'https://api.tonvault.com';
const REFRESH_INTERVAL = 30000; // 30 seconds
const PRICE_REFRESH_INTERVAL = 10000; // 10 seconds
const TON_DECIMALS = 9;

// DOM Elements
const elements = {
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    walletAddress: document.getElementById('walletAddress'),
    userRank: document.getElementById('userRank'),
    rankText: document.getElementById('rankText'),
    tonBalance: document.getElementById('tonBalance'),
    networkName: document.getElementById('networkName'),
    tonPrice: document.getElementById('tonPrice'),
    priceChange: document.getElementById('priceChange'),
    currentStake: document.getElementById('currentStake'),
    stakeRate: document.getElementById('stakeRate'),
    totalEarned: document.getElementById('totalEarned'),
    nextReward: document.getElementById('nextReward'),
    rewardProgress: document.getElementById('rewardProgress'),
    timeToReward: document.getElementById('timeToReward'),
    apyValue: document.getElementById('apyValue'),
    totalStaked: document.getElementById('totalStaked'),
    validatorCount: document.getElementById('validatorCount'),
    networkShare: document.getElementById('networkShare'),
    totalReferrals: document.getElementById('totalReferrals'),
    referralEarnings: document.getElementById('referralEarnings'),
    referralHistory: document.getElementById('referralHistory'),
    referrerDetails: document.getElementById('referrerDetails'),
    rankList: document.getElementById('rankList'),
    totalUsers: document.getElementById('totalUsers'),
    totalStakedGlobal: document.getElementById('totalStakedGlobal'),
    eventsList: document.getElementById('eventsList'),
    sections: {
        home: document.getElementById('homeSection'),
        network: document.getElementById('networkSection'),
        rank: document.getElementById('rankSection'),
        news: document.getElementById('newsSection')
    },
    connectButton: document.getElementById('connectWallet')
};

// State Management
let state = {
    user: null,
    wallet: null,
    staking: null,
    price: null,
    network: null,
    referrals: null,
    rankings: null,
    news: null
};

// Format Utilities
const formatTON = (amount) => {
    const tons = amount / Math.pow(10, TON_DECIMALS);
    return parseFloat(tons).toFixed(2);
};
const formatUSD = (amount) => `$${parseFloat(amount).toFixed(2)}`;
const formatPercent = (percent) => `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
const formatAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};
const formatDate = (date) => new Date(date).toLocaleDateString();

// Bot API Interface
const botAPI = {
    async getUserData(userId) {
        try {
            const response = await fetch(`${API_ENDPOINT}/bot/user/${userId}`, {
                headers: {
                    'Authorization': `Bot ${botToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data from bot');
            }
            
            const data = await response.json();
            return {
                walletAddress: data.wallet_address,
                rank: data.rank,
                experience: data.experience,
                totalStaked: data.total_staked,
                referrals: data.referrals,
                joinDate: data.join_date
            };
        } catch (error) {
            console.error('Bot API Error:', error);
            return null;
        }
    },

    async getWalletBalance(address) {
        try {
            const response = await fetch(`${API_ENDPOINT}/bot/wallet/${address}/balance`, {
                headers: {
                    'Authorization': `Bot ${botToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch wallet balance from bot');
            }
            
            const data = await response.json();
            return data.balance; // in nanoTONs
        } catch (error) {
            console.error('Bot API Error:', error);
            return 0;
        }
    }
};

// Price API Interface
const priceAPI = {
    async getTONPrice() {
        try {
            console.log('Fetching TON price...');
            const response = await fetch('/api/price/ton', {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Price API request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('Price data received:', data);

            if (!data['the-open-network']) {
                throw new Error('Invalid price data format');
            }

            return {
                price: data['the-open-network'].usd,
                change24h: data['the-open-network'].usd_24h_change
            };
        } catch (error) {
            console.error('Failed to fetch TON price:', error);
            return null;
        }
    }
};

// UI Updates
const updateUI = {
    user(userData) {
        if (!userData) return;
        elements.userAvatar.src = userData.avatar || 'assets/default-avatar.png';
        elements.userName.textContent = userData.name || 'Connect Wallet';
        elements.walletAddress.textContent = userData.wallet ? formatAddress(userData.wallet) : '0x000...000';
    },

    wallet(walletData) {
        if (!walletData) return;
        elements.tonBalance.textContent = formatTON(walletData.balance);
    },

    network(networkData) {
        if (!networkData) return;
        elements.networkName.textContent = networkData.name;
        elements.validatorCount.textContent = networkData.validators;
        elements.networkShare.textContent = formatPercent(networkData.share);
    },

    staking(stakingData) {
        if (!stakingData) return;
        elements.currentStake.textContent = formatTON(stakingData.currentStake);
        elements.totalStaked.textContent = formatTON(stakingData.totalStaked);
        elements.totalEarned.textContent = formatTON(stakingData.totalEarned);
        elements.nextReward.textContent = formatTON(stakingData.nextReward);
        elements.timeToReward.textContent = formatTimeRemaining(stakingData.timeToNextReward);
        elements.stakeRate.textContent = `${formatPercent(stakingData.dailyRate)} daily`;
        elements.apyValue.textContent = formatPercent(stakingData.apy);
        
        // Update progress bar
        const progress = (stakingData.timeToNextReward / stakingData.rewardInterval) * 100;
        elements.rewardProgress.style.width = `${progress}%`;
    },

    price(priceData) {
        const priceElement = elements.tonPrice;
        const changeElement = elements.priceChange;

        if (!priceData) {
            priceElement.textContent = '$0.00';
            changeElement.textContent = '0.00%';
            changeElement.className = 'price-change';
            return;
        }

        // Get current price for comparison
        const oldPrice = parseFloat(priceElement.textContent.replace('$', '')) || 0;
        const newPrice = priceData.price;

        // Update with animation if price changed
        if (oldPrice !== newPrice) {
            priceElement.style.transition = 'color 0.3s ease';
            priceElement.style.color = newPrice > oldPrice ? 'var(--accent-green)' : 'var(--accent-blue)';

            priceElement.textContent = formatUSD(newPrice);
            changeElement.textContent = formatPercent(priceData.change24h);
            changeElement.className = `price-change ${priceData.change24h >= 0 ? 'positive' : 'negative'}`;

            setTimeout(() => {
                priceElement.style.color = '';
            }, 300);
        }
    },

    referrals(referralData) {
        if (!referralData) return;
        
        // Update referral stats
        elements.totalReferrals.textContent = referralData.totalReferrals;
        elements.referralEarnings.textContent = formatTON(referralData.totalEarnings);

        // Update referral history
        elements.referralHistory.innerHTML = referralData.referrals.map(referral => `
            <div class="referral-item">
                <img src="${referral.avatar || 'assets/default-avatar.png'}" alt="Referral" class="referral-avatar">
                <div class="referral-info">
                    <div class="referral-name">${referral.name}</div>
                    <div class="referral-date">${formatDate(referral.date)}</div>
                </div>
                <div class="referral-amount">+${formatTON(referral.earnings)} TON</div>
            </div>
        `).join('');

        // Update referrer details
        if (referralData.referrer) {
            elements.referrerDetails.innerHTML = `
                <div class="referral-item">
                    <img src="${referralData.referrer.avatar || 'assets/default-avatar.png'}" alt="Referrer" class="referral-avatar">
                    <div class="referral-info">
                        <div class="referral-name">${referralData.referrer.name}</div>
                        <div class="referral-date">Referred on ${formatDate(referralData.referrer.date)}</div>
                    </div>
                </div>
            `;
        } else {
            elements.referrerDetails.innerHTML = `
                <div class="referral-item">
                    <div class="referral-info">
                        <div class="referral-name">No referrer</div>
                    </div>
                </div>
            `;
        }
    },

    rankings(rankingsData) {
        if (!rankingsData) return;
        
        elements.rankList.innerHTML = rankingsData.rankings.map((rank, index) => `
            <div class="rank-item">
                <div class="rank-position">${index + 1}</div>
                <div class="rank-user">
                    <img src="${rank.avatar || 'assets/default-avatar.png'}" alt="User" class="rank-avatar">
                    <div class="rank-details">
                        <div class="rank-name">${rank.name}</div>
                        <div class="rank-stake">${formatTON(rank.staked)} TON staked</div>
                    </div>
                </div>
                <div class="rank-amount">+${formatTON(rank.earnings)} TON</div>
            </div>
        `).join('');
    },

    news(newsData) {
        if (!newsData) return;
        
        // Update global stats
        elements.totalUsers.textContent = newsData.totalUsers.toLocaleString();
        elements.totalStakedGlobal.textContent = formatTON(newsData.totalStaked);

        // Update events
        elements.eventsList.innerHTML = newsData.events.map(event => `
            <div class="event-item">
                <div class="event-title">${event.title}</div>
                <div class="event-date">${formatDate(event.date)}</div>
                <div class="event-description">${event.description}</div>
            </div>
        `).join('');

        // Update social links
        document.querySelector('.social-link.telegram').href = newsData.socialLinks.telegram;
        document.querySelector('.social-link.whatsapp').href = newsData.socialLinks.whatsapp;
        document.querySelector('.social-link.youtube').href = newsData.socialLinks.youtube;
        document.querySelector('.social-link.twitter').href = newsData.socialLinks.twitter;
    }
};

// Navigation
const handleNavigation = (targetSectionId) => {
    console.log('Navigating to section:', targetSectionId);
    
    // Remove active class from all sections
    Object.values(elements.sections).forEach(section => {
        section.classList.remove('active');
    });
    
    // Add active class to target section
    const targetSection = elements.sections[targetSectionId.replace('Section', '')];
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update navigation buttons
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.section === targetSectionId) {
            nav.classList.add('active');
        }
    });
};

// Event Listeners
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const targetSection = e.currentTarget.dataset.section;
        console.log('Nav item clicked:', targetSection);
        handleNavigation(targetSection);
    });
});

// Rank Filters
const setupRankFilters = () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update button states
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show loading state
            const rankList = elements.rankList;
            rankList.innerHTML = '<div class="loading">Loading rankings...</div>';
            
            try {
                // Get rankings for selected period
                const period = btn.textContent.toLowerCase();
                const rankingsData = await api.getRankingsData(period);
                
                if (rankingsData && rankingsData.rankings) {
                    updateUI.rankings(rankingsData);
                } else {
                    rankList.innerHTML = '<div class="error">Failed to load rankings</div>';
                }
            } catch (error) {
                console.error('Failed to load rankings:', error);
                rankList.innerHTML = '<div class="error">Failed to load rankings</div>';
            }
        });
    });
};

// Wallet Connection
let walletAddress = null;

const connectWallet = async () => {
    try {
        if (!window.TonConnect) {
            throw new Error('TonConnect not available');
        }

        const connector = new window.TonConnect();
        const walletConnectionData = await connector.connect();
        
        if (walletConnectionData && walletConnectionData.address) {
            walletAddress = walletConnectionData.address;
            
            // Fetch user data including rank
            const userData = await api.getUserData();
            
            // Update UI with user data
            updateUserProfile(userData);
            
            // Fetch initial balance
            await updateWalletBalance();
            
            // Start refresh intervals
            setInterval(updateWalletBalance, REFRESH_INTERVAL);
            setInterval(async () => {
                const updatedUserData = await api.getUserData();
                updateUserProfile(updatedUserData);
            }, REFRESH_INTERVAL);

            // Store wallet address
            localStorage.setItem('walletAddress', walletAddress);
        }
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        elements.userName.textContent = 'Connection Failed';
        setTimeout(() => updateUserProfile(), 2000);
    }
};

const updateWalletBalance = async () => {
    if (!walletAddress) return;

    try {
        const response = await fetch(`${API_ENDPOINT}/wallet/${walletAddress}/balance`);
        if (!response.ok) throw new Error('Failed to fetch balance');
        
        const data = await response.json();
        const balance = data.balance; // Assuming balance is in nanoTONs
        
        // Update the balance display with animation
        const balanceElement = elements.tonBalance;
        const oldBalance = parseFloat(balanceElement.textContent);
        const newBalance = parseFloat(formatTON(balance));
        
        if (oldBalance !== newBalance) {
            balanceElement.style.transition = 'color 0.3s ease';
            balanceElement.style.color = newBalance > oldBalance ? 'var(--accent-green)' : 'var(--accent-blue)';
            
            balanceElement.textContent = formatTON(balance);
            
            setTimeout(() => {
                balanceElement.style.color = 'var(--text-primary)';
            }, 300);
        }
    } catch (error) {
        console.error('Failed to update wallet balance:', error);
    }
};

// Check for existing wallet connection on startup
const checkExistingWallet = () => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
        walletAddress = savedAddress;
        elements.walletAddress.textContent = formatAddress(walletAddress);
        elements.connectButton.classList.add('connected');
        updateUserProfile();
        updateWalletBalance();
    }
};

// Update user profile with real-time bot data
const updateUserProfile = async () => {
    if (!telegramUser) {
        console.error('No Telegram user data available');
        return;
    }

    try {
        // Get user data from bot
        const userData = await botAPI.getUserData(telegramUser.id);
        
        // Update avatar and name
        elements.userAvatar.src = telegramUser.photo_url || 'assets/default-avatar.png';
        elements.userName.textContent = telegramUser.username ? 
            '@' + telegramUser.username : 
            (telegramUser.first_name + (telegramUser.last_name ? ' ' + telegramUser.last_name : ''));

        if (userData) {
            // Update wallet address if available
            if (userData.walletAddress) {
                walletAddress = userData.walletAddress;
                elements.walletAddress.textContent = formatAddress(walletAddress);
                elements.connectButton.classList.add('connected');
                
                // Fetch and update balance
                const balance = await botAPI.getWalletBalance(walletAddress);
                elements.tonBalance.textContent = formatTON(balance);
            }

            // Update rank
            if (userData.rank) {
                elements.rankText.textContent = userData.rank;
                elements.userRank.style.display = 'flex';
            } else {
                elements.userRank.style.display = 'none';
            }

            // Store user data in state
            state.user = userData;
        } else {
            // Reset to default state if no user data
            elements.walletAddress.textContent = '0x000...000';
            elements.userName.textContent = 'Connect Wallet';
            elements.userRank.style.display = 'none';
            elements.tonBalance.textContent = '0.00';
        }
    } catch (error) {
        console.error('Failed to update user profile:', error);
    }
};

// Event Handlers
document.getElementById('connectWallet').addEventListener('click', connectWallet);

// Data Refresh
const refreshData = async () => {
    const [
        userData,
        walletData,
        stakingData,
        networkData,
        referralData,
        rankingsData,
        newsData
    ] = await Promise.all([
        api.getUserData(),
        api.getWalletData(),
        api.getStakingData(),
        api.getNetworkData(),
        api.getReferralData(),
        api.getRankingsData(),
        api.getNewsData()
    ]);

    state = {
        user: userData || state.user,
        wallet: walletData || state.wallet,
        staking: stakingData || state.staking,
        price: state.price,
        network: networkData || state.network,
        referrals: referralData || state.referrals,
        rankings: rankingsData || state.rankings,
        news: newsData || state.news
    };

    updateUI.user(state.user);
    updateUI.wallet(state.wallet);
    updateUI.staking(state.staking);
    updateUI.network(state.network);
    updateUI.referrals(state.referrals);
    updateUI.rankings(state.rankings);
    updateUI.news(state.news);
};

// Price Update Function
const updatePrice = async () => {
    try {
        console.log('Updating TON price...');
        const priceData = await priceAPI.getTONPrice();
        console.log('Price data received:', priceData);
        
        if (priceData && typeof priceData.price === 'number') {
            state.price = priceData;
            updateUI.price(priceData);
            console.log('Price updated successfully:', priceData.price);
        } else {
            console.error('Invalid price data received:', priceData);
        }
    } catch (error) {
        console.error('Error in updatePrice:', error);
    }
};

// Start periodic updates
const startRealTimeUpdates = () => {
    // Initial update
    updateUserProfile();
    updatePrice();
    
    // Set up periodic updates
    setInterval(updateUserProfile, REFRESH_INTERVAL);
    setInterval(updatePrice, PRICE_REFRESH_INTERVAL);
};

// Initialize
const init = async () => {
    console.log('Initializing app...');
    
    if (!telegramUser) {
        console.error('No Telegram user data available');
        return;
    }
    
    // Start real-time updates
    startRealTimeUpdates();
    
    // Initial data refresh
    await refreshData();
    
    // Start main data refresh interval
    setInterval(refreshData, REFRESH_INTERVAL);
    
    // Set initial active section
    handleNavigation('homeSection');
    
    // Check for existing wallet connection
    checkExistingWallet();
};

// Start the app
init(); 
