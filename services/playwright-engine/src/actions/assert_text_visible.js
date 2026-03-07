module.exports = async function (params, context) {
    const { page, interpolate, buildSelector } = context;
    const defaultTimeout = parseInt(context.config?.maxStepTimeout) * 1000 || 30000;

    const expected = interpolate(params.expected_text || params.text);

    if (params.selector_type && params.selector_value) {
        // Assert text is visible within a specific element
        const selector = buildSelector(params.selector_type, params.selector_value);
        const element = await page.waitForSelector(selector, {
            state: 'visible',
            timeout: params.timeout_ms || defaultTimeout
        });

        const text = await element.textContent();
        const caseSensitive = params.case_sensitive !== false;
        const actual = caseSensitive ? (text || '') : (text || '').toLowerCase();
        const expectedCmp = caseSensitive ? expected : expected.toLowerCase();

        if (!actual.includes(expectedCmp)) {
            throw new Error(
                `Text visibility assertion failed: expected "${expected}" to be visible in element "${params.selector_value}", but got "${(text || '').trim()}"`
            );
        }
    } else {
        // Assert text is visible anywhere on the page
        const textSelector = `text=${expected}`;
        await page.waitForSelector(textSelector, {
            state: 'visible',
            timeout: params.timeout_ms || defaultTimeout
        });
    }
};
