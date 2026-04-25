require('dotenv').config();
const { removeAds, bypassAdblockWarning, startGlobalWatcher} = require('./helpers');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;
const SERVER_NAME = process.env.SERVER_NAME;
let restartCount = 0;

async function aternosAutomation() {
    const browser = await puppeteer.launch({
        headless: false, // Set to true for local development
        userDataDir: './aternos_session',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    const watcher = startGlobalWatcher(page);

    await page.setRequestInterception(true);

    const ads_remove = removeAds(page);

    try {
        console.log('[1/5] Entering Aternos');
        await page.goto('https://aternos.org/servers/', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 5000));

        const loginInput = await page.$('.username');
        if (loginInput) {
            console.log('[2/5] Login sequence started');
            await page.type('.username', ATERNOS_USER);
            await page.type('.password', ATERNOS_PASS);
            await Promise.all([
                page.click('.login-button'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
        } else {
            console.log('[2/5] Login skipped: Session active');
        }

        console.log('[3/5] Selecting server:', SERVER_NAME);
        await page.waitForSelector('.server-name', { timeout: 10000 });
        const servers = await page.$$('.server-name');
        for (const el of servers) {
            const text = await page.evaluate(n => n.innerText, el);
            if (text && text.includes(SERVER_NAME)) {
                await el.click();
                await page.waitForNavigation({ waitUntil: 'networkidle2' });
                break;
            }
        }

        console.log('[4/5] Checking server status');
        const status = await page.evaluate(() => document.body.innerText);
        if (status.includes('Offline')) {
            console.log('[4/5] Status: Offline. Clicking Start');
            await page.click('#start');
            try {
                await page.waitForSelector('.btn-success', { visible: true, timeout: 5000 });
                await page.click('.btn-success');
            } catch (e) {
                console.log('[WARNING] Confirm button not found or not required');
            }
        }

        console.log('[5/5] Monitoring system activated');
        setInterval(async () => {
            try {
                const time = await page.evaluate(() => {
                    const el = document.querySelector('.server-end-countdown');
                    return el ? el.innerText.trim() : null;
                });

                if (time) {
                    console.log('[INFO] Countdown:', time);
                    const [m, s] = time.split(':').map(Number);
                    if ((m * 60) + s < 20) {
                        console.log('[ACTION] Restarting server');
                        await page.click('#restart');
                        restartCount++;
                        console.log(`[INFO] Restart count: ${restartCount}`);
                    }
                }
            } catch (e) {
                console.log('[ERROR] Monitor loop error');
            }
        }, 15000);

    } catch (err) {
        console.log('[FATAL ERROR]', err.message);
    }
}

aternosAutomation();