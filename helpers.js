async function removeAds(page) {
    await page.setRequestInterception(true);

    page.on('request', (request) => {
        const url = request.url();

        const adBlockList = [
            'googleads',
            'doubleclick',
            'adservice',
            'adnxs',
            'carbonads',
            'quantserve',
            'popads',
            'analytics',
            'facebook'
        ];

        const isAd = adBlockList.some(adUrl => url.includes(adUrl));

        if (isAd) {
            request.abort();
        } else {
            request.continue();
        }
    });
}

async function bypassAdblockWarning(page) {
    console.log('[WARNING] Checking for Adblock wall');
    try {
        const adblockBtn = await page.waitForSelector('::-p-xpath(//div[contains(text(), "Continue with adblocker anyway")])', { timeout: 5000 });
        if (adblockBtn) {
            console.log('[ACTION] Bypassing Adblock wall');
            await adblockBtn.click({ force: true });
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.log('[INFO] Adblock wall not found');
    }
}

/**
 * Auto clicker to bypass adblock walls
 * @param {object} page - Puppeteer Page Object
 */
function startGlobalWatcher(page) {
    let isClicking = false;
    const globalWatcher = setInterval(async () => {
        if (isClicking) return; // ถ้ากำลังกดอยู่ ให้ข้ามรอบนี้ไปก่อน

        try {
            const adblockBtn = await page.$('::-p-xpath(//div[contains(text(), "Continue with adblocker anyway")])');
            
            if (adblockBtn) {
                const isVisible = await adblockBtn.boundingBox();
                
                if (isVisible) {
                    isClicking = true;
                    console.log('🛡️ [Global Watcher] เจอของจริง! กำลังกดยืนยัน...');
                    
                    await adblockBtn.click({ force: true });
                    await new Promise(r => setTimeout(r, 3000));
                    isClicking = false;
                }
            }
        } catch (e) {
            isClicking = false;
        }
    }, 1000);
}

module.exports = { removeAds, bypassAdblockWarning, startGlobalWatcher };