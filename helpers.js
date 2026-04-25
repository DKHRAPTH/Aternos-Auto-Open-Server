async function removeAds(page) {
    await page.evaluate(() => {
        const adSelectors = [
            '.ad-container', '.ad-slot', '[id^="google_ads"]', 
            '.fc-ab-root', '.btn-close', 'ins.adsbygoogle'
        ];
        adSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        const startBtn = document.querySelector('#start');
        if (startBtn) startBtn.style.zIndex = "9999";
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

    return setInterval(async () => {
        if (isClicking) return;

        try {
            // Find Adblock button with XPath
            const adblockBtn = await page.$('::-p-xpath(//div[contains(text(), "Continue with adblocker anyway")])');
            
            if (adblockBtn) {
                const isVisible = await adblockBtn.boundingBox();
                if (isVisible) {
                    isClicking = true;
                    console.log('[WATCHER] Detected Adblock wall, clicking bypass...');
                    
                    await adblockBtn.click({ force: true });
                    await new Promise(r => setTimeout(r, 3000));
                    isClicking = false;
                }
            }
            const closeBtn = await page.$('.btn-close, .ai-close, #close-button');
            if (closeBtn) {
                await closeBtn.click({ force: true });
            }

        } catch (e) {
            isClicking = false;
        }
    }, 1000);
}

module.exports = { removeAds, bypassAdblockWarning, startGlobalWatcher };