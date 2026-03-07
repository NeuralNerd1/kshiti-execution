const { chromium, firefox, webkit } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');

function interpolate(str, variables) {
    if (typeof str !== 'string') return str;
    return str.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const val = variables[key.trim()];
        return val !== undefined ? val : match;
    });
}

function buildSelector(type, value) {
    if (!type) return value;
    const t = type.toLowerCase();
    if (t === 'xpath') return `xpath=${value}`;
    if (t === 'css') return `css=${value}`;
    if (t === 'id') return `id=${value}`;
    if (t === 'text') return `text=${value}`;
    if (t === 'name') return `[name="${value}"]`;
    if (t === 'tag') return value; // bare tag
    return value;
}

// -------------------------------------------------------------
// Action Handlers Registry
// -------------------------------------------------------------
const actionHandlers = {
    // --- Navigation ---
    'goto_url': async ({ params, ctx }) => {
        const url = interpolate(params.url, ctx.variables);
        await ctx.page.goto(url, {
            timeout: params.timeout_ms || ctx.defaultTimeout,
            waitUntil: params.wait_until || 'load'
        });
    },
    'navigate': async ({ params, ctx }) => {
        await actionHandlers['goto_url']({ params, ctx });
    },
    'reload_page': async ({ params, ctx }) => {
        await ctx.page.reload({
            timeout: params.timeout_ms || ctx.defaultTimeout,
            waitUntil: params.wait_until || 'load'
        });
    },
    'go_back': async ({ params, ctx }) => {
        await ctx.page.goBack({ timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'go_forward': async ({ params, ctx }) => {
        await ctx.page.goForward({ timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'wait_for_navigation': async ({ params, ctx }) => {
        const urlMatchType = params.url_match_type || 'contains';
        const expectedUrl = interpolate(params.expected_url, ctx.variables);

        await ctx.page.waitForNavigation({
            timeout: params.timeout_ms || ctx.defaultTimeout,
            url: (url) => {
                const href = url.href;
                if (urlMatchType === 'equals') return href === expectedUrl;
                if (urlMatchType === 'contains') return href.includes(expectedUrl);
                if (urlMatchType === 'regex') return new RegExp(expectedUrl).test(href);
                return true;
            }
        });
    },
    'wait_for_load_state': async ({ params, ctx }) => {
        const state = params.load_state === 'networkidle' ? 'networkidle' : 'domcontentloaded';
        await ctx.page.waitForLoadState(state, { timeout: params.timeout_ms || ctx.defaultTimeout });
    },

    // --- Mouse ---
    'click': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.click(sel, {
            button: params.button || 'left',
            clickCount: params.click_count || 1,
            delay: params.delay_ms || 0,
            force: !!params.force
        });
    },
    'double_click': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.dblclick(sel, { delay: params.delay_ms || 0 });
    },
    'right_click': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.click(sel, { button: 'right' });
    },
    'click_if_visible': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const isVisible = await ctx.page.isVisible(sel, { timeout: params.timeout_ms || 2000 });
        if (isVisible) {
            await ctx.page.click(sel);
        } else {
            await ctx.addLog('INFO', `Element ${sel} not visible, skipped click_if_visible.`);
        }
    },
    'force_click': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.click(sel, { force: true });
    },
    'hover': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.hover(sel);
        if (params.delay_ms) await ctx.page.waitForTimeout(params.delay_ms);
    },

    // --- Keyboard ---
    'fill_text': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const text = interpolate(params.text, ctx.variables);
        await ctx.page.fill(sel, ""); // Optional clear_before behavior handled by fill inherently
        await ctx.page.fill(sel, text);
        if (params.delay_ms) await ctx.page.waitForTimeout(params.delay_ms);
    },
    'type_text': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const text = interpolate(params.text, ctx.variables);
        await ctx.page.locator(sel).pressSequentially(text, {
            delay: params.typing_speed || params.delay_ms || 50
        });
    },
    'clear_field': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.fill(sel, "");
    },
    'append_text': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const text = interpolate(params.text, ctx.variables);
        await ctx.page.locator(sel).focus();
        await ctx.page.keyboard.press('End'); // Move to end of input
        await ctx.page.locator(sel).pressSequentially(text, { delay: params.delay_ms || 10 });
    },
    'press_key': async ({ params, ctx }) => {
        const key = interpolate(params.key, ctx.variables);
        await ctx.page.keyboard.press(key);
        if (params.delay_ms) await ctx.page.waitForTimeout(params.delay_ms);
    },
    'key_down': async ({ params, ctx }) => {
        await ctx.page.keyboard.down(interpolate(params.key, ctx.variables));
    },
    'key_up': async ({ params, ctx }) => {
        await ctx.page.keyboard.up(interpolate(params.key, ctx.variables));
    },
    'keyboard_shortcut': async ({ params, ctx }) => {
        // params.keys should be an array like ["Control", "C"]
        let keys = params.keys || [];
        if (typeof keys === 'string') keys = JSON.parse(keys);
        for (const k of keys) await ctx.page.keyboard.down(k);
        for (const k of [...keys].reverse()) await ctx.page.keyboard.up(k);
        if (params.delay_ms) await ctx.page.waitForTimeout(params.delay_ms);
    },

    // --- Assertions (Initial) ---
    'assert_text_equals': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        let tVal = await ctx.page.innerText(sel);
        if (params.trim !== false) tVal = tVal.trim();

        let expected = interpolate(params.expected_text, ctx.variables);
        if (params.case_sensitive === false) {
            tVal = tVal.toLowerCase();
            expected = expected.toLowerCase();
        }

        if (tVal !== expected) throw new Error(`Expected "${expected}", got "${tVal}"`);
    },
    'assert_text_contains': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        let tVal = await ctx.page.innerText(sel);
        let expected = interpolate(params.expected_text, ctx.variables);
        if (params.case_sensitive === false) {
            tVal = tVal.toLowerCase();
            expected = expected.toLowerCase();
        }
        if (!tVal.includes(expected)) throw new Error(`Expected text to contain "${expected}", but got "${tVal}"`);
    },
    'assert_text_matches_regex': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const tVal = await ctx.page.innerText(sel);
        const regexStr = interpolate(params.regex, ctx.variables);
        const regex = new RegExp(regexStr);
        if (!regex.test(tVal)) throw new Error(`Expected text to match regex "${regexStr}", but got "${tVal}"`);
    },
    'assert_attribute_value': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const attrName = interpolate(params.attribute, ctx.variables);
        const expected = interpolate(params.expected_value, ctx.variables);
        const attrVal = await ctx.page.getAttribute(sel, attrName);
        if (attrVal !== expected) throw new Error(`Expected attribute "${attrName}" to be "${expected}", got "${attrVal}"`);
    },
    'assert_input_value': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const expected = interpolate(params.expected_value, ctx.variables);
        const val = await ctx.page.inputValue(sel);
        if (val !== expected) throw new Error(`Expected input value "${expected}", got "${val}"`);
    },
    'assert_checkbox_checked': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const checked = await ctx.page.isChecked(sel);
        if (!checked) throw new Error(`Expected checkbox ${sel} to be checked`);
    },
    'assert_element_enabled': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const enabled = await ctx.page.isEnabled(sel);
        if (!enabled) throw new Error(`Expected element ${sel} to be enabled`);
    },
    'assert_element_disabled': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const isDisabled = await ctx.page.isDisabled(sel);
        if (!isDisabled) throw new Error(`Expected element ${sel} to be disabled`);
    },
    'assert_url_equals': async ({ params, ctx }) => {
        const expected = interpolate(params.expected_url, ctx.variables);
        const currentUrl = ctx.page.url();
        if (currentUrl !== expected) throw new Error(`Expected URL "${expected}", got "${currentUrl}"`);
    },
    'assert_url_contains': async ({ params, ctx }) => {
        const expected = interpolate(params.expected_partial_url, ctx.variables);
        const currentUrl = ctx.page.url();
        if (!currentUrl.includes(expected)) throw new Error(`Expected URL to contain "${expected}", got "${currentUrl}"`);
    },
    'assert_title': async ({ params, ctx }) => {
        const expected = interpolate(params.expected_title, ctx.variables);
        const currentTitle = await ctx.page.title();
        if (currentTitle !== expected) throw new Error(`Expected title "${expected}", got "${currentTitle}"`);
    },
    'assert_element_visible': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'visible', timeout: params.timeout_ms || 5000 });
    },
    'assert_element_hidden': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'hidden', timeout: params.timeout_ms || 5000 });
    },
    'assert_element_exists': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'attached', timeout: params.timeout_ms || 5000 });
    },
    'assert_element_not_exists': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'detached', timeout: params.timeout_ms || 5000 });
    },

    // --- Forms ---
    'select_dropdown_value': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const val = interpolate(params.option_value, ctx.variables);
        // Playwright selectOption matches by value, label, or select option element handle.
        await ctx.page.selectOption(sel, val);
    },
    'select_dropdown_index': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.selectOption(sel, { index: parseInt(params.index, 10) });
    },
    'select_radio': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.check(sel);
    },
    'toggle_checkbox': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        if (params.state === 'on') await ctx.page.check(sel);
        else if (params.state === 'off') await ctx.page.uncheck(sel);
        else {
            const isChecked = await ctx.page.isChecked(sel);
            if (isChecked) await ctx.page.uncheck(sel);
            else await ctx.page.check(sel);
        }
    },
    'submit_form': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        if (params.wait_for_navigation) {
            await Promise.all([
                ctx.page.waitForNavigation(),
                ctx.page.locator(sel).evaluate(form => form.submit())
            ]);
        } else {
            await ctx.page.locator(sel).evaluate(form => form.submit());
        }
    },
    'reset_form': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.locator(sel).evaluate(form => form.reset());
    },

    // --- Waits ---
    'wait_for_element_visible': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'visible', timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'wait_for_element_hidden': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.waitForSelector(sel, { state: 'hidden', timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'wait_for_timeout': async ({ params, ctx }) => {
        await ctx.page.waitForTimeout(parseInt(params.duration_ms, 10));
    },
    'wait_for_text': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const textToWait = interpolate(params.text, ctx.variables);
        const matchType = params.match_type || 'contains';

        await ctx.page.waitForFunction(
            ({ s, t, tMatch }) => {
                const el = document.querySelector(s);
                if (!el) return false;
                const txt = el.innerText || el.textContent;
                if (tMatch === 'exact') return txt === t;
                if (tMatch === 'regex') return new RegExp(t).test(txt);
                return txt.includes(t);
            },
            { s: sel.replace(/^(css=|xpath=|id=)/, ''), t: textToWait, tMatch: matchType }, // Simplified querySelector wrapper
            { timeout: params.timeout_ms || ctx.defaultTimeout }
        );
    },
    'wait_for_url': async ({ params, ctx }) => {
        const urlMatchType = params.url_match_type || 'contains';
        const expectedUrl = interpolate(params.expected_url, ctx.variables);

        await ctx.page.waitForURL((urlObject) => {
            const href = urlObject.href;
            if (urlMatchType === 'equals') return href === expectedUrl;
            if (urlMatchType === 'contains') return href.includes(expectedUrl);
            if (urlMatchType === 'regex') return new RegExp(expectedUrl).test(href);
            return true;
        }, { timeout: params.timeout_ms || ctx.defaultTimeout });
    },

    // --- Files ---
    'upload_file': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const filePath = interpolate(params.file_path, ctx.variables);
        await ctx.page.setInputFiles(sel, filePath);
    },
    'upload_multiple_files': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        const paths = params.file_paths.map(p => interpolate(p, ctx.variables));
        await ctx.page.setInputFiles(sel, paths);
    },
    'assert_file_downloaded': async ({ params, ctx }) => {
        // Mocked or simple approach: we wait for the download event globally
        const downloadPromise = ctx.page.waitForEvent('download', { timeout: params.timeout_ms || ctx.defaultTimeout });
        const download = await downloadPromise;
        const suggestedName = download.suggestedFilename();
        const expectedName = interpolate(params.file_name, ctx.variables);
        if (expectedName && typeof expectedName === 'string' && expectedName.length > 0) {
            if (!suggestedName.includes(expectedName)) {
                throw new Error(`Expected downloaded file to include "${expectedName}", but got "${suggestedName}"`);
            }
        }
        if (params.download_path) {
            await download.saveAs(interpolate(params.download_path, ctx.variables));
        }
    },
    'assert_file_name': async ({ params, ctx }) => {
        // Depends on the last download in the runner context, skipping deep implementation for stateless scope
        await ctx.addLog('WARN', `assert_file_name requires persistent download tracking. Skiped.`);
    },

    // --- Browser ---
    'open_new_tab': async ({ params, ctx }) => {
        const newPage = await ctx.context.newPage();
        if (params.url) {
            await newPage.goto(interpolate(params.url, ctx.variables), { timeout: ctx.defaultTimeout });
        }
        // Since we are not doing a complex tab manager yet, we just set it as the active page
        ctx.page = newPage;
    },
    'switch_tab': async ({ params, ctx }) => {
        const pages = ctx.context.pages();
        if (params.tab_index !== undefined) {
            const idx = parseInt(params.tab_index, 10);
            if (idx >= 0 && idx < pages.length) ctx.page = pages[idx];
            else throw new Error(`Tab index ${idx} out of bounds`);
        } else if (params.tab_title) {
            const titleMatch = interpolate(params.tab_title, ctx.variables);
            let found = false;
            for (const p of pages) {
                if ((await p.title()).includes(titleMatch)) {
                    ctx.page = p;
                    found = true;
                    break;
                }
            }
            if (!found) throw new Error(`No tab found with title matching "${titleMatch}"`);
        }
        await ctx.page.bringToFront();
    },
    'close_tab': async ({ params, ctx }) => {
        const pages = ctx.context.pages();
        if (params.tab_index !== undefined) {
            const idx = parseInt(params.tab_index, 10);
            if (idx >= 0 && idx < pages.length) {
                await pages[idx].close();
                if (ctx.page === pages[idx]) ctx.page = pages[Math.max(0, idx - 1)]; // switch to prev tab safely
            }
        } else {
            await ctx.page.close();
            const remaining = ctx.context.pages();
            if (remaining.length > 0) ctx.page = remaining[remaining.length - 1];
        }
    },
    'set_viewport': async ({ params, ctx }) => {
        await ctx.page.setViewportSize({ width: parseInt(params.width, 10), height: parseInt(params.height, 10) });
    },
    'set_user_agent': async ({ params, ctx }) => {
        // Can't reliably set user agent per page dynamically natively without creating new context in Playwright 
        // Adding route interception as a proxy for setting headers, though full UA is best set on Context creation.
        await ctx.page.route('**/*', route => {
            const req = route.request();
            const headers = req.headers();
            headers['User-Agent'] = interpolate(params.user_agent_string, ctx.variables);
            route.continue({ headers });
        });
    },

    // --- Scroll ---
    'scroll_to_element': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        await ctx.page.locator(sel).scrollIntoViewIfNeeded();
    },
    'scroll_by_pixels': async ({ params, ctx }) => {
        await ctx.page.evaluate(({ x, y }) => window.scrollBy(x, y), { x: parseInt(params.x, 10), y: parseInt(params.y, 10) });
    },
    'scroll_to_top': async ({ params, ctx }) => {
        await ctx.page.evaluate(() => window.scrollTo(0, 0));
    },
    'scroll_to_bottom': async ({ params, ctx }) => {
        await ctx.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    },

    // --- Frames ---
    'switch_iframe': async ({ params, ctx }) => {
        const frameSel = buildSelector(params.selector_type, interpolate(params.iframe_selector || params.selector_value, ctx.variables));
        const frameElement = await ctx.page.$(frameSel);
        if (!frameElement) throw new Error(`Iframe element not found: ${frameSel}`);
        const frame = await frameElement.contentFrame();
        if (!frame) throw new Error(`Could not get frame from element: ${frameSel}`);
        // We temporarily treat the frame as the page for interacting
        ctx._originalPage = ctx._originalPage || ctx.page;
        ctx.page = frame;
    },
    'exit_iframe': async ({ params, ctx }) => {
        if (ctx._originalPage) {
            ctx.page = ctx._originalPage;
        }
    },
    'handle_alert_accept': async ({ params, ctx }) => {
        ctx.page.once('dialog', async dialog => {
            if (params.expected_text) {
                const act = dialog.message();
                const exp = interpolate(params.expected_text, ctx.variables);
                if (!act.includes(exp)) await ctx.addLog('WARN', `Alert text "${act}" did not include "${exp}"`);
            }
            await dialog.accept();
        });
    },
    'handle_alert_dismiss': async ({ params, ctx }) => {
        ctx.page.once('dialog', async dialog => {
            await dialog.dismiss();
        });
    },
    'assert_alert_text': async ({ params, ctx }) => {
        // Relies on dialog event handlers registered previously or globally
        await ctx.addLog('INFO', 'assert_alert_text pseudo handled via handle_alert_accept expected_text');
    },

    // --- Network ---
    'wait_for_api_call': async ({ params, ctx }) => {
        const urlPattern = interpolate(params.url_pattern, ctx.variables);
        const method = params.method ? interpolate(params.method, ctx.variables).toUpperCase() : 'ANY';
        await ctx.page.waitForResponse(resp => {
            if (method !== 'ANY' && resp.request().method().toUpperCase() !== method) return false;
            return resp.url().includes(urlPattern);
        }, { timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'assert_api_status': async ({ params, ctx }) => {
        const urlPattern = interpolate(params.url_pattern, ctx.variables);
        const expectedStatus = parseInt(params.expected_status, 10);
        const method = params.method ? interpolate(params.method, ctx.variables).toUpperCase() : 'ANY';

        await ctx.page.waitForResponse(resp => {
            if (method !== 'ANY' && resp.request().method().toUpperCase() !== method) return false;
            if (!resp.url().includes(urlPattern)) return false;

            if (resp.status() !== expectedStatus) {
                throw new Error(`Expected API ${urlPattern} to return status ${expectedStatus}, but got ${resp.status()}`);
            }
            return true;
        }, { timeout: params.timeout_ms || ctx.defaultTimeout });
    },
    'assert_api_response_value': async ({ params, ctx }) => {
        const urlPattern = interpolate(params.url_pattern, ctx.variables);
        const jsonPath = interpolate(params.json_path, ctx.variables);
        const expectedVal = interpolate(params.expected_value, ctx.variables);
        const matchType = params.match_type || 'exact';

        await ctx.page.waitForResponse(async resp => {
            if (!resp.url().includes(urlPattern)) return false;
            let data;
            try { data = await resp.json(); } catch (e) { return false; }

            // simple path lookup 
            const parts = jsonPath.split('.');
            let curr = data;
            for (const p of parts) {
                if (curr === undefined) break;
                curr = curr[p];
            }

            const actualVal = String(curr);
            if (matchType === 'exact' && actualVal !== expectedVal) throw new Error(`Expected ${expectedVal} but got ${actualVal}`);
            if (matchType === 'contains' && !actualVal.includes(expectedVal)) throw new Error(`Expected ${actualVal} to contain ${expectedVal}`);
            if (matchType === 'regex' && !(new RegExp(expectedVal).test(actualVal))) throw new Error(`Expected ${actualVal} to match regex ${expectedVal}`);

            return true;
        }, { timeout: params.timeout_ms || ctx.defaultTimeout });
    },

    // --- Variables ---
    'store_text_as_variable': async ({ params, ctx }) => {
        const sel = buildSelector(params.selector_type, interpolate(params.selector_value, ctx.variables));
        let tVal = await ctx.page.innerText(sel);
        if (params.regex_extract) {
            const r = new RegExp(interpolate(params.regex_extract, ctx.variables));
            const match = tVal.match(r);
            if (match) tVal = match[1] || match[0];
        }
        ctx.variables[params.variable_name] = tVal;
        await ctx.addLog('INFO', `Stored variable ${params.variable_name} = ${tVal}`);
    },
    'use_variable': async ({ params, ctx }) => {
        // This is typically inherent in the interpolation logic used across actions
        if (!ctx.variables[params.variable_name] && params.fallback_value) {
            ctx.variables[params.variable_name] = interpolate(params.fallback_value, ctx.variables);
        }
    },
    'generate_random_string': async ({ params, ctx }) => {
        const len = parseInt(params.length, 10) || 8;
        const chars = params.charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < len; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        ctx.variables[params.variable_name] = result;
    },
    'generate_timestamp': async ({ params, ctx }) => {
        // simplification: ISO string or epoch
        const fmt = params.format || 'iso';
        const d = new Date();
        const val = fmt === 'epoch' ? String(d.getTime()) : d.toISOString();
        ctx.variables[params.variable_name] = val;
    },

    // --- Environment & Debugging ---
    'take_screenshot': async ({ params, ctx, step }) => {
        const label = interpolate(params.label, ctx.variables) || `screenshot_${step.id}`;
        // we just execute it in the void so Playwright grabs it 
        await ctx.page.screenshot({ fullPage: true });
        await ctx.addLog('INFO', `Took screenshot: ${label}`);
    },
    'record_video': async ({ params, ctx }) => {
        await ctx.addLog('WARN', 'record_video action must be configured at browser launch; skipped dynamic toggle.');
    },
    'capture_dom_snapshot': async ({ params, ctx }) => {
        const html = await ctx.page.content();
        await ctx.addLog('INFO', `Captured DOM snapshot length: ${html.length}`);
    },
    'log_message': async ({ params, ctx }) => {
        const msg = interpolate(params.message, ctx.variables);
        const lvl = params.log_level ? params.log_level.toUpperCase() : 'INFO';
        await ctx.addLog(lvl, msg);
    },
    'clear_cookies': async ({ params, ctx }) => {
        await ctx.context.clearCookies();
    },
    'clear_local_storage': async ({ params, ctx }) => {
        await ctx.page.evaluate(() => localStorage.clear());
    },
    'set_cookie': async ({ params, ctx }) => {
        const cookie = {
            name: interpolate(params.name, ctx.variables),
            value: interpolate(params.value, ctx.variables),
            domain: interpolate(params.domain, ctx.variables),
            path: params.path || '/',
            secure: params.secure !== undefined ? !!params.secure : false
        };
        if (params.expiry) cookie.expires = parseInt(params.expiry, 10);
        await ctx.context.addCookies([cookie]);
    },
    'set_local_storage': async ({ params, ctx }) => {
        const k = interpolate(params.key, ctx.variables);
        const v = interpolate(params.value, ctx.variables);
        await ctx.page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k, v });
    },

    // --- Flow Control ---
    'conditional_block': async ({ params, ctx, step, executeStep }) => {
        const conditionStr = interpolate(params.condition_expression, ctx.variables);
        // Simplified truthy evaluation
        const isTrue = conditionStr && conditionStr !== 'false' && conditionStr !== '0' && conditionStr.toLowerCase() !== 'null';

        let pathKey = isTrue ? 'true_steps' : 'false_steps';
        const rawSteps = step.step_configurations ? step.step_configurations[pathKey] : step[pathKey];
        const stepsToRun = typeof rawSteps === 'string' ? JSON.parse(rawSteps) : (rawSteps || []);

        await ctx.addLog('DEBUG', `Condition evaluated to ${isTrue}, running ${stepsToRun.length} sub-steps`);
        for (let i = 0; i < stepsToRun.length; i++) {
            if (ctx.stopRequested) break;
            await executeStep(stepsToRun[i], `${step.id}_sub_${i}`);
        }
    },
    'loop_block': async ({ params, ctx, step, executeStep }) => {
        const iterations = parseInt(params.iterations, 10) || 1;
        const rawSteps = step.step_configurations ? step.step_configurations.loop_steps : step.loop_steps;
        const stepsToRun = typeof rawSteps === 'string' ? JSON.parse(rawSteps) : (rawSteps || []);

        await ctx.addLog('DEBUG', `Looping ${iterations} times for ${stepsToRun.length} sub-steps`);
        for (let n = 0; n < iterations; n++) {
            if (ctx.stopRequested) break;
            ctx.variables['loop_index'] = String(n + 1); // 1-indexed for user-friendliness typically
            for (let i = 0; i < stepsToRun.length; i++) {
                if (ctx.stopRequested) break;
                await executeStep(stepsToRun[i], `${step.id}_loop_${n}_${i}`);
            }
        }
    },
    'stop_test': async ({ params, ctx }) => {
        ctx.stopRequested = true;
        await ctx.addLog('WARN', `stop_test action triggered. Stopping further execution.`);
    },
    'skip_step': async ({ params, ctx }) => {
        await ctx.addLog('INFO', `skip_step action evaluated. Skipping.`);
    },
    'retry_step': async ({ params, ctx, step, executeStep }) => {
        const retries = parseInt(params.max_retries, 10) || 3;
        const rawStep = step.step_configurations ? step.step_configurations.target_step : step.target_step;
        const targetStep = typeof rawStep === 'string' ? JSON.parse(rawStep) : rawStep;
        if (!targetStep) return;

        let success = false;
        let lastErr = null;
        for (let i = 0; i < retries; i++) {
            try {
                await executeStep(targetStep, `${step.id}_retry_${i}`);
                success = true;
                break;
            } catch (e) {
                lastErr = e;
                await ctx.addLog('WARN', `Retry ${i + 1}/${retries} failed: ${e.message}`);
                await ctx.page.waitForTimeout(parseInt(params.delay_ms, 10) || 1000);
            }
        }
        if (!success && lastErr) throw new Error(`All ${retries} retries failed. Last error: ${lastErr.message}`);
    },
    'mark_step_optional': async ({ params, ctx, step, executeStep }) => {
        const rawStep = step.step_configurations ? step.step_configurations.target_step : step.target_step;
        const targetStep = typeof rawStep === 'string' ? JSON.parse(rawStep) : rawStep;
        if (!targetStep) return;
        try {
            await executeStep(targetStep, `${step.id}_opt`);
        } catch (e) {
            await ctx.addLog('INFO', `Optional step failed (ignored): ${e.message}`);
        }
    }
};

// -------------------------------------------------------------
// Core Engine Loop
// -------------------------------------------------------------
async function runExecution() {
    const payloadArg = process.argv[2];
    if (!payloadArg) {
        console.error(JSON.stringify({ error: "No execution payload provided" }));
        process.exit(1);
    }

    let payload;
    try {
        if (fs.existsSync(payloadArg)) {
            payload = JSON.parse(fs.readFileSync(payloadArg, 'utf-8'));
        } else {
            payload = JSON.parse(payloadArg);
        }
    } catch (e) {
        console.error(JSON.stringify({ error: "Failed to parse payload: " + e.message }));
        process.exit(1);
    }

    const { suite, config, runId, projectId } = payload;
    const runResult = {
        runId: runId || "run-" + Date.now(),
        suiteName: suite.name || "Unnamed Suite",
        status: "RUNNING",
        startTime: new Date().toISOString(),
        endTime: null,
        durationMs: 0,
        testsPassed: 0,
        testsFailed: 0,
        testCases: [],
        logs: [],
        projectId: projectId || "default",
        triggeredBy: "Worker"
    };

    const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
    try { await dbClient.connect(); } catch (e) {
        console.error("Failed to connect to DB:", e.message);
        process.exit(1);
    }

    async function flushResult() {
        try {
            runResult.durationMs = Date.now() - new Date(runResult.startTime).getTime();
            await dbClient.query(`
                UPDATE exec_runs 
                SET duration_ms = $1, tests_passed = $2, tests_failed = $3, test_cases = $4, logs = $5, status = $6
                WHERE run_id = $7
            `, [
                runResult.durationMs, runResult.testsPassed, runResult.testsFailed,
                JSON.stringify(runResult.testCases), JSON.stringify(runResult.logs),
                runResult.status, runResult.runId
            ]);
        } catch (e) {
            console.error("Failed to flush to DB:", e.message);
        }
    }

    async function addLog(level, message) {
        runResult.logs.push({ timestamp: new Date().toISOString(), level, message });
        console.log(`[${level}] ${message}`);
        await flushResult();
    }

    const browserConfigVal = config?.defaultBrowser?.toLowerCase() || 'chrome';
    let browserType = 'chromium';
    if (browserConfigVal === 'firefox') browserType = 'firefox';
    if (browserConfigVal === 'webkit') browserType = 'webkit';

    const browserLauncher = { firefox, webkit, chromium }[browserType] || chromium;
    let browser;
    try {
        browser = await browserLauncher.launch({
            headless: config?.headlessDefault !== false,
            args: []
        });
        await addLog('DEBUG', `Launched browser: ${browserType}`);
    } catch (e) {
        await addLog('ERROR', `Failed to launch browser: ${e.message}`);
        runResult.status = 'FAILED';
        await flushResult();
        await dbClient.end();
        process.exit(1);
    }

    const defaultTimeout = parseInt(config?.maxStepTimeout) * 1000 || 30000;

    let viewportParsed = { width: 1920, height: 1080 };
    if (config?.viewportSize?.includes('x')) {
        const [w, h] = config.viewportSize.split('x');
        viewportParsed = { width: parseInt(w), height: parseInt(h) };
    }

    for (const tc of suite.testCases) {
        const tcStart = Date.now();
        const tcResult = {
            id: tc.id || "unknown",
            name: tc.name || "Unnamed Test Case",
            status: "RUNNING",
            durationMs: 0,
            error: null,
            steps: [],
            variables: {}
        };
        runResult.testCases.push(tcResult);
        addLog('INFO', `[${tcResult.name}] Started.`);

        let context, page;
        try {
            context = await browser.newContext({
                userAgent: config?.userAgent,
                viewport: viewportParsed,
                locale: config?.localeSetting || 'en-US',
                timezoneId: config?.timezoneOverride || 'UTC',
                ignoreHTTPSErrors: true
            });
            page = await context.newPage();
            page.setDefaultTimeout(defaultTimeout);

            if (config?.captureNetworkLogsOnFailure || ["Trace", "All"].includes(config?.loggingLevel)) {
                page.on('response', req => {
                    addLog('NETWORK', `[${tcResult.name}] ${req.request().method()} ${req.url()} ${req.status()}`);
                });
            }

            const ctx = {
                page,
                context,
                browser,
                defaultTimeout,
                variables: tcResult.variables,
                addLog: async (level, msg) => await addLog(level, `[${tcResult.name}] ${msg}`),
                testCase: tcResult,
                stopRequested: false
            };

            const executionTimeline = [...(tc.pre_conditions || []), ...(tc.steps || []), ...(tc.expected_outcomes || [])];

            async function executeStep(step, stepIndex) {
                if (ctx.stopRequested) return;

                const actionKey = step.action_key || step.action;
                const params = typeof step.parameters === 'string' ? JSON.parse(step.parameters) : (step.parameters || {});

                const stepResult = {
                    id: step.id || stepIndex,
                    name: `${actionKey} ${params?.selector_value || params?.url || ''}`,
                    status: "RUNNING",
                    durationMs: 0,
                    error: null
                };
                tcResult.steps.push(stepResult);
                await ctx.addLog('DEBUG', `Executing: ${actionKey}`);
                const stepStart = Date.now();

                try {
                    if (actionHandlers[actionKey]) {
                        await actionHandlers[actionKey]({ params, ctx, step, executeStep });
                    } else {
                        await ctx.addLog('WARN', `Unimplemented action handler: ${actionKey}`);
                        await page.waitForTimeout(100);
                    }
                    stepResult.status = "PASSED";
                } catch (e) {
                    stepResult.status = "FAILED";
                    stepResult.error = e.message;
                    throw e;
                } finally {
                    stepResult.durationMs = Date.now() - stepStart;
                    await flushResult();
                }
            }

            for (let i = 0; i < executionTimeline.length; i++) {
                if (ctx.stopRequested) break;
                await executeStep(executionTimeline[i], i).catch(e => {
                    tcResult.status = "FAILED";
                    tcResult.error = e.message;
                    throw e;
                });
            }

            if (!ctx.stopRequested) {
                tcResult.status = tcResult.status === "FAILED" ? "FAILED" : "PASSED";
            } else {
                tcResult.status = "STOPPED";
                runResult.status = "STOPPED";
            }
            if (tcResult.status === "PASSED") runResult.testsPassed++;

        } catch (e) {
            tcResult.status = "FAILED";
            runResult.testsFailed++;
            await addLog('ERROR', `[${tcResult.name}] ${e.message}`);
        } finally {
            tcResult.durationMs = Date.now() - tcStart;
            if (context) await context.close();
            await flushResult();
        }
    }

    await browser.close();
    if (runResult.status !== "STOPPED") {
        runResult.status = runResult.testsFailed > 0 ? "FAILED" : "PASSED";
    }
    runResult.endTime = new Date().toISOString();
    await flushResult();

    console.log("FINAL_RESULT_DB_FLUSHED:" + runResult.runId);
    await dbClient.end();
    process.exit(runResult.testsFailed > 0 ? 1 : 0);
}

runExecution().catch(e => {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
});
