require("dotenv").config();

const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;
const SERVER_NAME = process.env.SERVER_NAME || "";

let restartCount = 0;
let onlineMonitorInterval = null;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeClick(elementHandle) {
    if (!elementHandle) return false;

    try {
        await elementHandle.evaluate(el => el.click());
        return true;
    } catch {
        try {
            await elementHandle.click();
            return true;
        } catch {
            return false;
        }
    }
}
async function dismissPopups(page) {
    try {
        await page.evaluate(() => {
            const closeSelectors = [
                '.continue-prompt-text',
                'button[aria-label="Close"]',
                '.btn-close',
                '.close-button',
                '#dismiss-button',
                '.fa-times', 
                'div[role="button"] i.fa-remove'
            ];

            closeSelectors.forEach(sel => {
                const elements = document.querySelectorAll(sel);
                elements.forEach(el => {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        el.click();
                    }
                });
            });

            
            if (document.body.style.overflow === 'hidden') {
                document.body.style.overflow = 'auto';
            }

            const xpath = "//.[node()='Close' or contains(text(), 'Close')]";
            const result = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null);
            let node = result.iterateNext();
            
            while (node) {
                if (node.offsetWidth > 0 && node.offsetHeight > 0 && node.offsetWidth < 500) {
                    node.click();
                }
                node = result.iterateNext();
            }
        });
    } catch (e) {
        
    }
}
function startGlobalWatcher(page) {
    let isWorking = false;

    setInterval(async () => {
        if (isWorking) return;
        isWorking = true;

        try {
            const adblockBtn = await page.$('::-p-xpath(//div[contains(text(), "Continue with adblocker anyway")])');
            if (adblockBtn) {
                const box = await adblockBtn.boundingBox();
                if (box) {
                    console.log('🛡️ [Watcher] Found Adblock Wall');
                    await randomDelay(1000, 2000);
                    await adblockBtn.click({ force: true });
                    isWorking = false;
                    return; 
                }
            }

            await dismissPopups(page);
            const closeXpath = '::-p-xpath(//*[self::div or self::button or self::span][contains(translate(text(), "CLOSE", "close"), "close")])';
            const closeBtn = await page.$(closeXpath);
            
            if (closeBtn) {
                const box = await closeBtn.boundingBox();
                if (box) {
                    console.log("🎯 [Watcher] Found 'Close' text, clicking...");
                    await humanClick(page, closeXpath);
                }
            }

        } catch (e) {
        } finally {
            isWorking = false;
        }
    }, Math.floor(Math.random() * 2000) + 2000);

    console.log("[WATCHER] Stealth Mode Enabled");
}
async function detectState(page) {
    try {
        
        if (page.isClosed()) return "UNKNOWN";

        const bodyText = await page.evaluate(() => document.body.innerText);
        const statusEl = await page.$('.statuslabel-label');
        if (
            await page.$(".server-end-countdown") ||
            bodyText.includes("Online")
        ) {
            return "ONLINE";
        }

        if (statusEl) {
            const status = await page.evaluate(
                el => el.innerText.trim(),
                statusEl
            );

            console.log("[RAW STATUS]", status);
            const text = status.toLowerCase();

            if (text.includes("waiting")) return "QUEUE";
            if (text.includes("preparing")) return "PREPARING";
            if (text.includes("starting")) return "STARTING";
            if (text.includes("stopping")) return "STOPPING";
        }
        if (
            bodyText.includes("Waiting in queue") ||
            bodyText.includes("Position in queue") ||
            bodyText.includes("Estimated waiting time") ||
            bodyText.includes("ca.")
        ) {
            return "QUEUE";
        }
        const startBtn = await page.$("#start");
        if (startBtn && await startBtn.boundingBox()) {
            return "SERVER";
        }
        if (await page.$(".server-name")) {
            return "DASHBOARD";
        }
        if (
            await page.$(".username") &&
            await page.$(".password")
        ) {
            return "LOGIN";
        }
        const ready = await page.evaluate(() => document.readyState);
        if (ready !== "complete") {
            return "LOADING";
        }

        return "UNKNOWN";

    } catch {
        return "LOADING";
    }
}

async function doLogin(page) {
    console.log("[STATE] LOGIN");

    const loginInput = await page.$(".username");

    if (!loginInput) {
        console.log("[LOGIN] Session may already exist");
        return;
    }

    await page.click(".username", { clickCount: 3 });
    await page.type(".username", ATERNOS_USER);

    await page.click(".password", { clickCount: 3 });
    await page.type(".password", ATERNOS_PASS);

    await Promise.all([
        await humanClick(page, ".login-button"),
        page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    console.log("[LOGIN] Success");
}


async function openServer(page) {
    console.log("[STATE] DASHBOARD");
    await page.waitForSelector(".server-name", { timeout: 15000 });
    const servers = await page.$$(".server-name");

    for (const el of servers) {
        const text = await page.evaluate(node => node.innerText, el);
        if (text && (SERVER_NAME === "" || text.includes(SERVER_NAME))) {
            console.log("[ACTION] Opening server:", text);
            await el.click();
            await page.bringToFront();
            await page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => {});
            return true;
        }
    }
    return false;
}


async function clickStart(page) {
    console.log("[STATE] SERVER");
    
    
    await page.waitForSelector("#start", { visible: true, timeout: 10000 }).catch(() => {});

    const status = await page.evaluate(() => document.querySelector('.statuslabel-label')?.innerText || "");
    if (!status.includes("Offline")) {
        console.log("[INFO] Server is not Offline (Current: " + status + ")");
        return;
    }
    await randomDelay(1000, 2000);
    console.log("[ACTION] Attempting to click Start");
    const startClicked = await humanClick(page, "#start");

    if (startClicked) {
        try {
            const confirmBtn = await page.waitForSelector("#confirm, .btn-success", { visible: true, timeout: 10000 });
            if (confirmBtn) {
                await randomDelay(1000, 2000);
                await humanClick(page, "#confirm, .btn-success");
                console.log("[ACTION] Confirm Start Clicked");
            }
        } catch (e) {
            console.log("[INFO] Confirm button did not appear");
        }
    }
}


async function handleQueue(page) {
    console.log("[STATE] QUEUE");

    try {
        const bodyText = await page.evaluate(() => document.body.innerText);

        if (bodyText.includes("Waiting in queue")) {
            console.log("[INFO] Server is in queue, waiting...");
        }

        const confirmBtn = await page.$('#confirm');

        if (confirmBtn) {
        const box = await confirmBtn.boundingBox();
            if (box) {
                console.log("[ACTION] Confirm queue now!");
                await humanClick(page, "#confirm");
                return;
            }
        }

        const queueTime = await page.evaluate(() => {
            const el = document.querySelector('.queue-time, .queue-position');
            return el ? el.innerText.trim() : null;
        });

        if (queueTime) {
            console.log("[QUEUE]", queueTime);
        }

    } catch (err) {
        console.log("[QUEUE ERROR]", err.message);
    }
}

async function isOnline(page) {
    console.log("[STATE] ONLINE");

    if (onlineMonitorInterval) return;

    onlineMonitorInterval = setInterval(async () => {
        try {
            const time = await page.evaluate(() => {
                const el = document.querySelector(".server-end-countdown");
                return el ? el.innerText.trim() : null;
            });

            if (!time) return;

            console.log("[COUNTDOWN]", time);

            const parts = time.split(":").map(Number);

            if (parts.length !== 2) return;

            const total = (parts[0] * 60) + parts[1];

            if (total < 20) {
                console.log("[ACTION] Auto Restart");

                const restartBtn = await page.$("#restart");

                if (restartBtn) {
                    await humanClick(page, "#restart");
                    restartCount++;
                    console.log("[INFO] Restart Count:", restartCount);
                }
            }

        } catch (err) {
            console.log("[ONLINE ERROR]", err.message);
        }
    }, 15000);
}


function stopAllHelpers() {

    if (onlineMonitorInterval) {
        clearInterval(onlineMonitorInterval);
        onlineMonitorInterval = null;
    }
}


/**
 * @param {number} min
 * @param {number} max
 */
async function randomDelay(min = 1500, max = 4000) {
    const jitter = Math.random() * (max - min) + min;
    console.log(`[WAIT] Sleeping for ${(jitter / 1000).toFixed(2)}s...`);
    return new Promise(r => setTimeout(r, jitter));
}
async function humanClick(page, selector) {
    try {
        const element = await page.waitForSelector(selector, { visible: true, timeout: 10000 });
        const rect = await element.boundingBox();
        if (rect) {
            const x = rect.x + (Math.random() * rect.width * 0.8) + (rect.width * 0.1);
            const y = rect.y + (Math.random() * rect.height * 0.8) + (rect.height * 0.1);
            await page.mouse.move(x, y, { steps: 10 });
            await page.mouse.click(x, y);
            console.log(`[ACTION] Human-clicked on ${selector}`);
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}


module.exports = {
    startGlobalWatcher,

    detectState,
    doLogin,
    openServer,
    clickStart,
    handleQueue,
    isOnline,

    stopAllHelpers
};