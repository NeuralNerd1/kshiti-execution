module.exports = async function (params, context) {
    const { page, interpolate, buildSelector } = context;
    const defaultTimeout = parseInt(context.config?.maxStepTimeout) * 1000 || 30000;

    const selector = buildSelector(params.selector_type, params.selector_value);
    const element = await page.waitForSelector(selector, {
        state: 'attached',
        timeout: params.timeout_ms || defaultTimeout
    });

    const text = await element.textContent();
    const expected = interpolate(params.expected_text);

    const caseSensitive = params.case_sensitive !== false;
    const actual = caseSensitive ? text : (text || '').toLowerCase();
    const expectedCmp = caseSensitive ? expected : expected.toLowerCase();

    if (!actual || !actual.includes(expectedCmp)) {
        throw new Error(
            `Text assertion failed: expected element "${params.selector_value}" to contain "${expected}", but got "${(text || '').trim()}"`
        );
    }
};
