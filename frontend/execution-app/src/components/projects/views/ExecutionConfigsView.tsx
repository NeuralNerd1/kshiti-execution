"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { getExecutionConfig, saveExecutionConfig } from "@/services/executionService";

// --- Types for our Configuration State ---
type ConfigState = {
    // Browser & Runtime
    defaultBrowser: "Chrome" | "Firefox" | "Edge";
    browserVersion: string;
    headlessDefault: boolean;
    disableExtensions: boolean;
    incognitoMode: boolean;
    disableCache: boolean;
    viewportSize: string;
    localeSetting: string;
    timezoneOverride: string;

    // Performance & Resource Limits
    maxExecutionTimeTest: string;
    maxExecutionTimeSuite: string;
    maxStepTimeout: string;
    pageLoadTimeout: string;
    implicitWaitDefault: string;
    explicitWaitDefault: string;
    idleBrowserTimeout: string;

    // Parallel Execution Controls
    parallelThreadsAllowed: boolean;
    maxParallelTests: number;
    parallelBy: "Test Case" | "Suite";
    isolateBrowserPerThread: boolean;

    // Retry & Stability Controls
    retryCount: number;
    retryDelay: number;
    autoRefreshPageOnRetry: boolean;
    autoRestartBrowserOnRetry: boolean;
    markTestAsBugAfterRetries: number;
    markTestAsFlakyAfterRetries: number;

    // Failure Handling Strategy
    failFast: boolean;
    screenshotOnFailureOnly: boolean;
    screenshotOnEveryStep: boolean;
    captureDomSnapshotOnFailure: boolean;
    captureVideoRecording: boolean;

    // Logging & Observability Controls
    loggingLevel: "All" | "Info" | "Debug" | "Trace" | "Error";
    maskSensitiveValuesInLogs: boolean;
    enableStepLevelLogging: boolean;
    enableBrowserUIRenderingLogs: boolean;
    captureConsoleLogsOnFailure: boolean;
    captureNetworkLogsOnFailure: boolean;
    enableDevToolsLogging: boolean;
    logDomBeforeAction: boolean;
    logElementLocatorStrategyUsed: boolean;
    logFallbackLocatorAttempts: boolean;
    logExecutionTimeline: boolean;
    enablePerformanceMetricsCapture: boolean;
    logNetworkRequestTiming: boolean;

    // Reporting Behavior Per Environment
    markEnvironmentNameInReport: boolean;
    includeEnvironmentVariablesSnapshot: boolean;
    includeBrowserConfigSnapshot: boolean;
    includeExecutionCapabilitySnapshot: boolean;
    includeRetryHistory: boolean;
    includeRunnerIdInReport: boolean;

    // Security & Isolation Controls
    runInIsolatedContainer: boolean;

    // Runner & Infrastructure Controls
    fallbackRunnerStrategy: string;
    killStaleExecutionAfterTime: string;

    // Data & State Handling
    resetBrowserStateBeforeEachTest: boolean;
    clearCookiesBeforeTest: boolean;
    clearLocalStorage: boolean;
};

const DEFAULT_CONFIG: ConfigState = {
    // Browser
    defaultBrowser: "Chrome", browserVersion: "Latest", headlessDefault: true,
    disableExtensions: true, incognitoMode: false, disableCache: false,
    viewportSize: "1920x1080", localeSetting: "en-US", timezoneOverride: "UTC",

    // Performance
    maxExecutionTimeTest: "5m", maxExecutionTimeSuite: "30m", maxStepTimeout: "30s",
    pageLoadTimeout: "60s", implicitWaitDefault: "5s", explicitWaitDefault: "15s",
    idleBrowserTimeout: "2m",

    // Parallel
    parallelThreadsAllowed: false, maxParallelTests: 2, parallelBy: "Test Case",
    isolateBrowserPerThread: true,

    // Retry
    retryCount: 0, retryDelay: 5, autoRefreshPageOnRetry: false,
    autoRestartBrowserOnRetry: false, markTestAsBugAfterRetries: 3,
    markTestAsFlakyAfterRetries: 2,

    // Failure
    failFast: false, screenshotOnFailureOnly: true, screenshotOnEveryStep: false,
    captureDomSnapshotOnFailure: false, captureVideoRecording: false,

    // Logging
    loggingLevel: "Info", maskSensitiveValuesInLogs: true, enableStepLevelLogging: false,
    enableBrowserUIRenderingLogs: false, captureConsoleLogsOnFailure: true,
    captureNetworkLogsOnFailure: false, enableDevToolsLogging: false,
    logDomBeforeAction: false, logElementLocatorStrategyUsed: true,
    logFallbackLocatorAttempts: false, logExecutionTimeline: true,
    enablePerformanceMetricsCapture: false, logNetworkRequestTiming: false,

    // Reporting
    markEnvironmentNameInReport: true, includeEnvironmentVariablesSnapshot: false,
    includeBrowserConfigSnapshot: true, includeExecutionCapabilitySnapshot: true,
    includeRetryHistory: true, includeRunnerIdInReport: false,

    // Security
    runInIsolatedContainer: false,

    // Runner
    fallbackRunnerStrategy: "Default Group", killStaleExecutionAfterTime: "15m",

    // Data
    resetBrowserStateBeforeEachTest: true, clearCookiesBeforeTest: true,
    clearLocalStorage: true
};

// UI Components for Fields
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div style={{ marginBottom: "32px", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.02)" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)", fontWeight: 600 }}>{title}</h3>
        </div>
        <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
            {children}
        </div>
    </div>
);

const FieldLayout = ({ label, description, children, disabled = false }: { label: string, description?: string, children: React.ReactNode, disabled?: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{label}</label>
            {disabled && <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", color: "var(--text-muted)" }}>COMING SOON</span>}
        </div>
        {description && <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", lineHeight: 1.4 }}>{description}</div>}
        <div>{children}</div>
    </div>
);

const Select = ({ value, options, onChange, disabled }: { value: string, options: string[], onChange: (val: string) => void, disabled?: boolean }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: disabled ? "rgba(0,0,0,0.2)" : "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px", outline: "none", cursor: disabled ? "not-allowed" : "pointer" }}
    >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
);

const Input = ({ type = "text", value, onChange, placeholder, disabled }: { type?: string, value: string | number, onChange: (val: string) => void, placeholder?: string, disabled?: boolean }) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", background: disabled ? "rgba(0,0,0,0.2)" : "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "14px", outline: "none", cursor: disabled ? "not-allowed" : "text" }}
    />
);

const Toggle = ({ checked, onChange, labelDisabled = "Disabled", labelEnabled = "Enabled", disabled }: { checked: boolean, onChange: () => void, labelDisabled?: string, labelEnabled?: string, disabled?: boolean }) => (
    <button
        type="button"
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        style={{
            display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "8px",
            background: checked ? "rgba(99, 102, 241, 0.1)" : "rgba(255, 255, 255, 0.05)",
            border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`,
            color: checked ? "var(--primary-light)" : "var(--text-muted)", cursor: disabled ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 500, transition: "all 0.2s"
        }}
    >
        <div style={{
            width: "36px", height: "18px", borderRadius: "9px", background: checked ? "var(--primary)" : "var(--border-hover)",
            position: "relative", transition: "all 0.2s"
        }}>
            <div style={{
                width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "2px",
                left: checked ? "20px" : "2px", transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
            }} />
        </div>
        {checked ? labelEnabled : labelDisabled}
    </button>
);

export default function ExecutionConfigsView() {
    const params = useParams();
    const projectId = params?.project_id as string;

    const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // --- Fetch initial configs ---
    useEffect(() => {
        if (!projectId) return;

        const loadConfig = async () => {
            try {
                const data = await getExecutionConfig(projectId);
                // Merge loaded data with DEFAULT_CONFIG to ensure new missing keys exist
                setConfig(prev => ({ ...prev, ...data }));
            } catch (err) {
                console.error("Failed to fetch config, using defaults", err);
            } finally {
                setIsLoadingInit(false);
            }
        };
        loadConfig();
    }, [projectId]);

    // --- Helpers for inputs ---
    const handleToggle = (key: keyof ConfigState) => {
        setConfig(prev => ({ ...prev, [key]: !prev[key as keyof ConfigState] }));
    };

    const handleChange = (key: keyof ConfigState, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };


    const handleSaveConfirm = async () => {
        setIsSaving(true);
        try {
            await saveExecutionConfig(projectId, config);
            toast.success("Configurations saved successfully!");
            setShowConfirmModal(false);
        } catch (err) {
            toast.error("Failed to save configurations");
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingInit) {
        return <div style={{ display: "flex", justifyContent: "center", padding: "40px", color: "var(--text-muted)" }}>Loading Configurations...</div>;
    }

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "60px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: "28px", color: "var(--text-primary)", fontWeight: 700, letterSpacing: "-0.02em" }}>Execution Configurations</h1>
                    <p style={{ margin: "8px 0 0 0", color: "var(--text-muted)", fontSize: "15px" }}>
                        Configure default settings, browser behaviors, parallel execution, and limits for this project.
                    </p>
                </div>
            </div>

            {/* --- SECTIONS --- */}

            <Section title="Browser & Runtime Configuration">
                <FieldLayout label="Default Browser" description="Which browser should be used to run the automated test.">
                    <Select value={config.defaultBrowser} options={["Chrome", "Firefox", "Edge", "Webkit"]} onChange={(v) => handleChange("defaultBrowser", v)} />
                </FieldLayout>
                <FieldLayout label="Browser Version" description="Latest uses newest version, Fixed uses specific version for stability." disabled>
                    <Input value={config.browserVersion} onChange={(v) => handleChange("browserVersion", v)} placeholder="e.g. Latest or 118.0.1" disabled />
                </FieldLayout>
                <FieldLayout label="Headless Default" description="Faster execution with no visible browser.">
                    <Toggle checked={config.headlessDefault} onChange={() => handleToggle("headlessDefault")} labelEnabled="Yes" labelDisabled="No" />
                </FieldLayout>
                <FieldLayout label="Disable Extensions" description="Prevents installed browser extensions from interfering." disabled>
                    <Toggle checked={config.disableExtensions} onChange={() => handleToggle("disableExtensions")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Incognito Mode" description="Fresh session every time. No previous data restored." disabled>
                    <Toggle checked={config.incognitoMode} onChange={() => handleToggle("incognitoMode")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Disable Cache" description="Always loads fresh content, preventing false positives." disabled>
                    <Toggle checked={config.disableCache} onChange={() => handleToggle("disableCache")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Viewport Size" description="Defines screen resolution (Width x Height)." disabled>
                    <Input value={config.viewportSize} onChange={(v) => handleChange("viewportSize", v)} placeholder="e.g. 1920x1080" disabled />
                </FieldLayout>
                <FieldLayout label="Locale / Language Setting" description="Sets language of the browser interface." disabled>
                    <Input value={config.localeSetting} onChange={(v) => handleChange("localeSetting", v)} placeholder="e.g. en-US" disabled />
                </FieldLayout>
                <FieldLayout label="Timezone Override" description="Changes browser timezone to simulate different regions." disabled>
                    <Input value={config.timezoneOverride} onChange={(v) => handleChange("timezoneOverride", v)} placeholder="e.g. UTC" disabled />
                </FieldLayout>
            </Section>

            <Section title="Performance & Resource Limits">
                <FieldLayout label="Max Execution Time (Per Test Case)" description="Maximum allowed time for a single test to run." disabled>
                    <Input value={config.maxExecutionTimeTest} onChange={(v) => handleChange("maxExecutionTimeTest", v)} placeholder="e.g. 5m" disabled />
                </FieldLayout>
                <FieldLayout label="Max Execution Time (Per Suite)" description="Total allowed runtime for an entire test suite." disabled>
                    <Input value={config.maxExecutionTimeSuite} onChange={(v) => handleChange("maxExecutionTimeSuite", v)} placeholder="e.g. 30m" disabled />
                </FieldLayout>
                <FieldLayout label="Max Step Timeout" description="Maximum time allowed for a single action step." disabled>
                    <Input value={config.maxStepTimeout} onChange={(v) => handleChange("maxStepTimeout", v)} placeholder="e.g. 30s" disabled />
                </FieldLayout>
                <FieldLayout label="Page Load Timeout" description="Maximum time allowed for webpage to fully load." disabled>
                    <Input value={config.pageLoadTimeout} onChange={(v) => handleChange("pageLoadTimeout", v)} placeholder="e.g. 60s" disabled />
                </FieldLayout>
                <FieldLayout label="Implicit Wait Default" description="Default waiting time before declaring element not found." disabled>
                    <Input value={config.implicitWaitDefault} onChange={(v) => handleChange("implicitWaitDefault", v)} placeholder="e.g. 5s" disabled />
                </FieldLayout>
                <FieldLayout label="Explicit Wait Default" description="Default time to wait for a specific condition." disabled>
                    <Input value={config.explicitWaitDefault} onChange={(v) => handleChange("explicitWaitDefault", v)} placeholder="e.g. 15s" disabled />
                </FieldLayout>
                <FieldLayout label="Idle Browser Timeout" description="Closes browser if idle for too long." disabled>
                    <Input value={config.idleBrowserTimeout} onChange={(v) => handleChange("idleBrowserTimeout", v)} placeholder="e.g. 2m" disabled />
                </FieldLayout>
            </Section>

            <Section title="Parallel Execution Controls">
                <FieldLayout label="Parallel Threads Allowed" description="Determines whether multiple tests can run simultaneously." disabled>
                    <Toggle checked={config.parallelThreadsAllowed} onChange={() => handleToggle("parallelThreadsAllowed")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Max Parallel Tests" description="How many individual test cases can run at the same time." disabled>
                    <Input type="number" value={config.maxParallelTests} onChange={(v) => handleChange("maxParallelTests", Number(v))} disabled />
                </FieldLayout>
                <FieldLayout label="Parallel By" description="Runs each test case independently or by suite." disabled>
                    <Select value={config.parallelBy} options={["Test Case", "Suite"]} onChange={(v) => handleChange("parallelBy", v)} disabled />
                </FieldLayout>
                <FieldLayout label="Isolate Browser Per Thread" description="Ensures each parallel thread gets its own independent browser." disabled>
                    <Toggle checked={config.isolateBrowserPerThread} onChange={() => handleToggle("isolateBrowserPerThread")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
            </Section>

            <Section title="Retry & Stability Controls">
                <FieldLayout label="Retry Count (Per Test)" description="Number of times a failed test should automatically retry." disabled>
                    <Input type="number" value={config.retryCount} onChange={(v) => handleChange("retryCount", Number(v))} disabled />
                </FieldLayout>
                <FieldLayout label="Retry Delay (Seconds)" description="Wait time before retrying a failed test." disabled>
                    <Input type="number" value={config.retryDelay} onChange={(v) => handleChange("retryDelay", Number(v))} disabled />
                </FieldLayout>
                <FieldLayout label="Auto-Refresh Page On Retry" description="Refreshes page before retry attempt." disabled>
                    <Toggle checked={config.autoRefreshPageOnRetry} onChange={() => handleToggle("autoRefreshPageOnRetry")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Auto-Restart Browser On Retry" description="Restarts browser completely before retry." disabled>
                    <Toggle checked={config.autoRestartBrowserOnRetry} onChange={() => handleToggle("autoRestartBrowserOnRetry")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Mark Test as Bug after X Retries" description="Marks test as BUG if it does not pass." disabled>
                    <Input type="number" value={config.markTestAsBugAfterRetries} onChange={(v) => handleChange("markTestAsBugAfterRetries", Number(v))} disabled />
                </FieldLayout>
                <FieldLayout label="Mark Test as Flaky after X Retries" description="Marks test unstable if it passes only after retries." disabled>
                    <Input type="number" value={config.markTestAsFlakyAfterRetries} onChange={(v) => handleChange("markTestAsFlakyAfterRetries", Number(v))} disabled />
                </FieldLayout>
            </Section>

            <Section title="Failure Handling Strategy">
                <FieldLayout label="Fail Fast (Stop Suite on First Failure)" description="Stops entire test suite immediately when a failure occurs." disabled>
                    <Toggle checked={config.failFast} onChange={() => handleToggle("failFast")} disabled />
                </FieldLayout>
                <FieldLayout label="Screenshot On Failure Only" description="Capture screenshot only when test fails." disabled>
                    <Toggle checked={config.screenshotOnFailureOnly} onChange={() => handleToggle("screenshotOnFailureOnly")} labelEnabled="Selected" labelDisabled="Unselected" disabled />
                </FieldLayout>
                <FieldLayout label="Screenshot On Every Step" description="Capture screenshot after each action." disabled>
                    <Toggle checked={config.screenshotOnEveryStep} onChange={() => handleToggle("screenshotOnEveryStep")} labelEnabled="Selected" labelDisabled="Unselected" disabled />
                </FieldLayout>
                <FieldLayout label="Capture DOM Snapshot On Failure" description="Save HTML structure when failure occurs." disabled>
                    <Toggle checked={config.captureDomSnapshotOnFailure} onChange={() => handleToggle("captureDomSnapshotOnFailure")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Capture Video Recording" description="Record entire test execution as video." disabled>
                    <Toggle checked={config.captureVideoRecording} onChange={() => handleToggle("captureVideoRecording")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
            </Section>

            <Section title="Logging & Observability Controls">
                <FieldLayout label="Logging Level" description="Detail level of execution logs.">
                    <Select value={config.loggingLevel} options={["All", "Info", "Debug", "Trace", "Error"]} onChange={(v) => handleChange("loggingLevel", v)} />
                </FieldLayout>
                <FieldLayout label="Mask Sensitive Values in Logs" description="Hides passwords, tokens, and sensitive information." disabled>
                    <Toggle checked={config.maskSensitiveValuesInLogs} onChange={() => handleToggle("maskSensitiveValuesInLogs")} disabled />
                </FieldLayout>
                <FieldLayout label="Enable Step-Level Logging" description="Logs each action step executed in automation." disabled>
                    <Toggle checked={config.enableStepLevelLogging} onChange={() => handleToggle("enableStepLevelLogging")} disabled />
                </FieldLayout>
                <FieldLayout label="Enable Browser UI Rendering Logs" description="Captures technical logs about how the page is drawn." disabled>
                    <Toggle checked={config.enableBrowserUIRenderingLogs} onChange={() => handleToggle("enableBrowserUIRenderingLogs")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Capture Console Logs On Failure" description="Collect browser console messages when failure happens.">
                    <Toggle checked={config.captureConsoleLogsOnFailure} onChange={() => handleToggle("captureConsoleLogsOnFailure")} labelEnabled="Yes" labelDisabled="No" />
                </FieldLayout>
                <FieldLayout label="Capture Network Logs On Failure" description="Stores API/network traffic logs on failure." disabled>
                    <Toggle checked={config.captureNetworkLogsOnFailure} onChange={() => handleToggle("captureNetworkLogsOnFailure")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Enable DevTools Logging" description="Captures detailed console and network logs from dev tools." disabled>
                    <Toggle checked={config.enableDevToolsLogging} onChange={() => handleToggle("enableDevToolsLogging")} labelEnabled="Yes" labelDisabled="No" disabled />
                </FieldLayout>
                <FieldLayout label="Log DOM Before Action" description="Captures page structure before performing an action." disabled>
                    <Toggle checked={config.logDomBeforeAction} onChange={() => handleToggle("logDomBeforeAction")} disabled />
                </FieldLayout>
                <FieldLayout label="Log Element Locator Strategy Used" description="Logs which locator method was used to find element." disabled>
                    <Toggle checked={config.logElementLocatorStrategyUsed} onChange={() => handleToggle("logElementLocatorStrategyUsed")} disabled />
                </FieldLayout>
                <FieldLayout label="Log Fallback Locator Attempts" description="Logs attempts when primary locator fails." disabled>
                    <Toggle checked={config.logFallbackLocatorAttempts} onChange={() => handleToggle("logFallbackLocatorAttempts")} disabled />
                </FieldLayout>
                <FieldLayout label="Log Execution Timeline" description="Records time taken for each step and entire test." disabled>
                    <Toggle checked={config.logExecutionTimeline} onChange={() => handleToggle("logExecutionTimeline")} disabled />
                </FieldLayout>
                <FieldLayout label="Enable Performance Metrics Capture" description="Captures page load time and rendering metrics." disabled>
                    <Toggle checked={config.enablePerformanceMetricsCapture} onChange={() => handleToggle("enablePerformanceMetricsCapture")} disabled />
                </FieldLayout>
                <FieldLayout label="Log Network Request Timing" description="Logs duration of API/network calls triggered by UI." disabled>
                    <Toggle checked={config.logNetworkRequestTiming} onChange={() => handleToggle("logNetworkRequestTiming")} disabled />
                </FieldLayout>
            </Section>

            <Section title="Reporting Behavior Per Environment">
                <FieldLayout label="Mark Environment Name In Report" description="Clearly displays which environment (Dev/QA/Prod) ran." disabled>
                    <Toggle checked={config.markEnvironmentNameInReport} onChange={() => handleToggle("markEnvironmentNameInReport")} disabled />
                </FieldLayout>
                <FieldLayout label="Include Environment Variables Snapshot" description="Includes configuration variables used during execution." disabled>
                    <Toggle checked={config.includeEnvironmentVariablesSnapshot} onChange={() => handleToggle("includeEnvironmentVariablesSnapshot")} disabled />
                </FieldLayout>
                <FieldLayout label="Include Browser Config Snapshot" description="Includes browser configuration details in report." disabled>
                    <Toggle checked={config.includeBrowserConfigSnapshot} onChange={() => handleToggle("includeBrowserConfigSnapshot")} disabled />
                </FieldLayout>
                <FieldLayout label="Include Execution Capability Snapshot" description="Records execution settings like parallelism and retries." disabled>
                    <Toggle checked={config.includeExecutionCapabilitySnapshot} onChange={() => handleToggle("includeExecutionCapabilitySnapshot")} disabled />
                </FieldLayout>
                <FieldLayout label="Include Retry History" description="Displays retry attempts and outcomes in report." disabled>
                    <Toggle checked={config.includeRetryHistory} onChange={() => handleToggle("includeRetryHistory")} disabled />
                </FieldLayout>
                <FieldLayout label="Include Runner ID In Report" description="Displays which runner machine executed the test." disabled>
                    <Toggle checked={config.includeRunnerIdInReport} onChange={() => handleToggle("includeRunnerIdInReport")} disabled />
                </FieldLayout>
            </Section>

            <Section title="Security & Isolation Controls">
                <FieldLayout label="Run in Isolated Container" description="Runs automation inside a separate isolated environment." disabled>
                    <Toggle checked={config.runInIsolatedContainer} onChange={() => handleToggle("runInIsolatedContainer")} disabled />
                </FieldLayout>
            </Section>

            <Section title="Runner & Infrastructure Controls">
                <FieldLayout label="Fallback Runner Strategy" description="Select fallback runner group if primary runner fails." disabled>
                    <Input value={config.fallbackRunnerStrategy} onChange={(v) => handleChange("fallbackRunnerStrategy", v)} disabled />
                </FieldLayout>
                <FieldLayout label="Kill Stale Execution After X Time" description="Automatically terminates tests running beyond reasonable duration." disabled>
                    <Input value={config.killStaleExecutionAfterTime} onChange={(v) => handleChange("killStaleExecutionAfterTime", v)} placeholder="e.g. 15m" disabled />
                </FieldLayout>
            </Section>

            <Section title="Data & State Handling">
                <FieldLayout label="Reset Browser State Before Each Test" description="Ensures each test starts with a completely fresh session." disabled>
                    <Toggle checked={config.resetBrowserStateBeforeEachTest} onChange={() => handleToggle("resetBrowserStateBeforeEachTest")} disabled />
                </FieldLayout>
                <FieldLayout label="Clear Cookies Before Test" description="Deletes stored cookies before starting a test." disabled>
                    <Toggle checked={config.clearCookiesBeforeTest} onChange={() => handleToggle("clearCookiesBeforeTest")} disabled />
                </FieldLayout>
                <FieldLayout label="Clear Local Storage" description="Removes data stored in browser local storage." disabled>
                    <Toggle checked={config.clearLocalStorage} onChange={() => handleToggle("clearLocalStorage")} disabled />
                </FieldLayout>
            </Section>

            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", marginBottom: "32px" }}>
                <button
                    onClick={() => setShowConfirmModal(true)}
                    className="btn btn-primary"
                    style={{ padding: "12px 32px", fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save Configurations
                </button>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
                }}>
                    <div style={{
                        background: "var(--bg-primary)", padding: "32px", borderRadius: "16px",
                        maxWidth: "400px", width: "100%", border: "1px solid var(--border)",
                        boxShadow: "0 24px 48px rgba(0,0,0,0.5)"
                    }}>
                        <h2 style={{ margin: "0 0 12px 0", fontSize: "20px", color: "var(--text-primary)" }}>Save Configurations?</h2>
                        <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
                            Are you sure you want to apply these execution configurations to the project? They will affect all upcoming test runs.
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="btn btn-ghost"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveConfirm}
                                className="btn btn-primary"
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : "Confirm & Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
