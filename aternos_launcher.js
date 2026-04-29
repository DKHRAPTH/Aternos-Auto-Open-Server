require('dotenv').config();
const {
    startGlobalWatcher,
    detectState,
    doLogin,
    openServer,
    clickStart,
    handleQueue,
    isOnline
} = require('./helpers');const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let currentState = 'BOOT';
let busy = false;

function setState(newState) {
    if (currentState === newState) return;

    currentState = newState;
    console.log(`\n[STATE] => ${newState}`);
}

function startStateEngine(page) {
    setInterval(async () => {
        if (busy) return;
        busy = true;

        try {
            const state = await detectState(page);

            switch (state) {
                case 'LOGIN':
                    setState('LOGIN');
                    await doLogin(page);
                    break;

                case 'DASHBOARD':
                    setState('DASHBOARD');
                    await openServer(page);
                    break;

                case 'SERVER':
                    setState('SERVER');
                    await clickStart(page);
                    break;

                case 'QUEUE':
                    setState('QUEUE');
                    await handleQueue(page);
                    break;

                case "PREPARING":
                    console.log("Preparing...");
                    break;    
                            
                case 'ONLINE':
                    setState('ONLINE');
                    await isOnline(page);
                    break;

                case "STARTING": 
                    console.log("Starting..."); 
                    break;

                case "STOPPING": 
                    console.log("Stopping..."); 
                    break;

                case 'LOADING':
                    break;
                default:
                    setState('UNKNOWN');
                    console.log('[INFO] Waiting page / Unknown content...');
                    break;
            }

        } catch (err) {
            console.log('[ENGINE ERROR]', err.message);
        }
        busy = false;
    }, 1000);
}

async function aternosAutomation() {
    const browser = await puppeteer.launch({
        headless: false,//Set to true if you run on server without GUI
        userDataDir: './aternos_session',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
        const newPage = await target.page();
        if (!newPage) return;

        try {
            const url = newPage.url();
            if (url === 'about:blank' || !url.includes('aternos.org')) {
                console.log(`[ANTIPUP] Detected pop-up: ${url}`);
                await new Promise(r => setTimeout(r, 1000)); 
                if (!newPage.isClosed()) {
                    await newPage.close().catch(() => {});
                    console.log(`[ANTIPUP] Closed successfully`);
                }
            }
        } catch (err) {
            console.log(`[ANTIPUP] Handled safe closure`);
        }
    }
});
    
    
    try {
        console.log('[BOOT] Starting browser...');
        
        
        console.log('[1/3] Opening Aternos...');
        await page.goto('https://aternos.org/servers/', {
            waitUntil: 'networkidle2'
        });
        
        startGlobalWatcher(page);
        
        console.log('[2/3] Starting State Engine...');
        startStateEngine(page);

        console.log('[3/3] Automation Running...');

    } catch (err) {
        console.log('[FATAL ERROR]', err.message);
    }
}

aternosAutomation();