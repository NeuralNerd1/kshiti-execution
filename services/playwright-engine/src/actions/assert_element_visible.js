module.exports = async function (params, context) {
    const { page, buildSelector } = context;
    const defaultTimeout = parseInt(context.config?.maxStepTimeout) * 1000 || 30000;

    const selector = buildSelector(params.selector_type, params.selector_value);
    await page.waitForSelector(selector, {
        state: 'visible',
        timeout: params.timeout_ms || defaultTimeout
    });
};
