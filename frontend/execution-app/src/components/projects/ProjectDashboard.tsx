"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { getProjectRuns } from "@/services/executionService";
import {
    BarChart3,
    Activity,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    TrendingUp,
    Calendar,
    ChevronRight,
    RefreshCw,
    AlertCircle,
    PieChart,
    Target,
    LineChart,
    ShieldCheck
} from "lucide-react";

// --- Types ---
type RunData = {
    runId: string;
    suiteName: string;
    status: string;
    startTime: string;
    durationMs: number;
    testsPassed: number;
    testsFailed: number;
};

// --- Sub-Components ---

const MetricCard = ({ title, value, subValue, icon: Icon, trend, trendType }: any) => (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '10px', color: 'var(--primary)' }}>
                <Icon size={20} />
            </div>
            {trend && (
                <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: trendType === 'up' ? 'var(--success)' : 'var(--error)',
                    padding: '4px 8px',
                    background: trendType === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '20px'
                }}>
                    {trend}
                </div>
            )}
        </div>
        <div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{subValue}</div>
        </div>
        <div style={{
            position: 'absolute', bottom: '-20px', right: '-20px', width: '80px', height: '80px',
            background: 'var(--primary-glow)', filter: 'blur(40px)', borderRadius: '50%', opacity: 0.4
        }} />
    </div>
);

const ChartContainer = ({ title, children, subtitle, style = {}, minHeight = '220px' }: { title: string, children: React.ReactNode, subtitle?: string, style?: any, minHeight?: string }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', ...style }}>
        <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
            {subtitle && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight }}>
            {children}
        </div>
    </div>
);

// --- Custom Donut Chart ---
const DonutChart = ({ passed, failed, running }: { passed: number, failed: number, running: number }) => {
    const [hovered, setHovered] = useState<string | null>(null);
    const total = passed + failed + running || 1;
    const pPerc = (passed / total) * 100;
    const fPerc = (failed / total) * 100;
    const rPerc = (running / total) * 100;
    const radius = 40;
    const C = 2 * Math.PI * radius;
    const fOffset = (pPerc / 100) * C;
    const rOffset = ((pPerc + fPerc) / 100) * C;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', height: '100%' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--border)" strokeWidth="8" />
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--success)" strokeWidth={hovered === 'passed' ? "10" : "8"}
                        strokeDasharray={`${(pPerc / 100) * C} ${C}`} strokeDashoffset="0" strokeLinecap="round"
                        onMouseEnter={() => setHovered('passed')} onMouseLeave={() => setHovered(null)} style={{ transition: '0.2s', cursor: 'pointer' }} />
                    {fPerc > 0 && (
                        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--error)" strokeWidth={hovered === 'failed' ? "10" : "8"}
                            strokeDasharray={`${(fPerc / 100) * C} ${C}`} strokeDashoffset={-fOffset} strokeLinecap="round"
                            onMouseEnter={() => setHovered('failed')} onMouseLeave={() => setHovered(null)} style={{ transition: '0.2s', cursor: 'pointer' }} />
                    )}
                    {rPerc > 0 && (
                        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="var(--warning)" strokeWidth={hovered === 'running' ? "10" : "8"}
                            strokeDasharray={`${(rPerc / 100) * C} ${C}`} strokeDashoffset={-rOffset} strokeLinecap="round"
                            onMouseEnter={() => setHovered('running')} onMouseLeave={() => setHovered(null)} style={{ transition: '0.2s', cursor: 'pointer' }} />
                    )}
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{hovered ? (hovered === 'passed' ? passed : hovered === 'failed' ? failed : running) : Math.round(pPerc) + '%'}</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{hovered || 'Passing'}</div>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['passed', 'failed', 'running'].map((type) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: hovered && hovered !== type ? 0.3 : 1 }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '3px', background: type === 'passed' ? 'var(--success)' : type === 'failed' ? 'var(--error)' : 'var(--warning)' }} />
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{type}: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{type === 'passed' ? passed : type === 'failed' ? failed : running}</span></div>
                    </div>
                ))}
            </div>
        </div>
    );
};



export default function ProjectDashboard() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const projectId = params?.project_id as string;
    const companySlug = params?.company_slug as string;
    const basePath = pathname?.includes('/local/') ? `/local/projects/${projectId}` : `/company/${companySlug}/projects/${projectId}`;
    const [runs, setRuns] = useState<RunData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);

    const fetchData = async (silent = false) => {
        if (!projectId) return;
        try { if (!silent) setIsRefreshing(true); setRuns(await getProjectRuns(projectId) || []); } catch { } finally { setLoading(false); setIsRefreshing(false); }
    };
    useEffect(() => { fetchData(); const interval = setInterval(() => fetchData(true), 5000); return () => clearInterval(interval); }, [projectId]);

    const stats = useMemo(() => {
        const total = runs.length;
        if (!total) return { passRate: 0, totalTests: 0, avgDuration: "0s", activeRuns: 0, passed: 0, failed: 0 };
        const passed = runs.filter(r => r.status === 'PASSED').length;
        const running = runs.filter(r => r.status === 'RUNNING').length;
        const passRate = Math.round((passed / (total - running || 1)) * 100);
        const totalTests = runs.reduce((acc, r) => acc + (r.testsPassed || 0) + (r.testsFailed || 0), 0);
        const totalDur = runs.reduce((acc, r) => acc + (r.durationMs || 0), 0);
        const avgMs = totalDur / total;
        return { passRate, totalTests: totalTests.toLocaleString(), avgDuration: avgMs > 60000 ? `${(avgMs / 60000).toFixed(1)}m` : `${(avgMs / 1000).toFixed(1)}s`, activeRuns: running, passed, failed: runs.filter(r => r.status === 'FAILED').length };
    }, [runs]);

    const distributionData = useMemo(() => {
        const last7 = runs.slice(0, 7).reverse();
        const maxVal = Math.max(...last7.map(r => (r.testsPassed || 0) + (r.testsFailed || 0)), 10);
        return last7.map(r => {
            const total = (r.testsPassed || 0) + (r.testsFailed || 0);
            return { id: r.runId, suite: r.suiteName, passed: r.testsPassed || 0, failed: r.testsFailed || 0, height: `${(total / maxVal) * 100}%`, passHeight: total === 0 ? '0%' : `${((r.testsPassed || 0) / total) * 100}%` };
        });
    }, [runs]);

    if (loading) return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px', gap: '20px' }}>
        <div className="spinner-primary" style={{ width: '32px', height: '32px' }} /><div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading analytics...</div>
    </div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: 1200, paddingBottom: '40px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>Project Insights</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span className="live-indicator"></span><span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LIVE ANALYTICS ACTIVE</span>
                    </div>
                </div>
                <button onClick={() => fetchData()} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} disabled={isRefreshing}>
                    <RefreshCw size={11} style={{ marginRight: '6px', animation: isRefreshing ? 'spin 1.5s linear infinite' : 'none' }} /> SYNC
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <MetricCard title="System Health" value={`${stats.passRate}%`} icon={ShieldCheck} trend="+4%" trendType="up" subValue="Success rate index" />
                <MetricCard title="Total Volume" value={runs.length} icon={Activity} subValue={`${stats.totalTests} tests run`} />
                <MetricCard title="Avg Latency" value={stats.avgDuration} icon={Clock} subValue="Throughput speed" />
                <MetricCard title="Live Streams" value={stats.activeRuns} icon={Zap} trend={stats.activeRuns > 0 ? "LIVE" : ""} trendType="up" subValue="Concurrent nodes" />
            </div>

            {/* Primary Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '16px' }}>
                <ChartContainer title="Success Velocity" subtitle="Batch distribution (Last 7)." minHeight="160px" style={{ padding: '20px' }}>
                    <div style={{ height: '140px', display: 'flex', alignItems: 'flex-end', gap: '10px', padding: '10px 10px 25px 10px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                        {distributionData.map((d, i) => (
                            <div key={i} style={{ flex: 1, height: d.height, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: 'pointer' }} onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                                <div style={{ width: '100%', height: '100%', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '3px 3px 1px 1px', position: 'absolute' }} />
                                <div style={{ width: '100%', height: d.passHeight, background: 'linear-gradient(to top, var(--success), #34d399)', borderRadius: d.passHeight === '100%' ? '3px 3px 1px 1px' : '0 0 1px 1px', zIndex: 2 }} />
                                {hoveredBar === i && (
                                    <div style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', padding: '8px', borderRadius: '6px', border: '1px solid var(--primary-glow)', zIndex: 10, minWidth: '100px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>{d.suite}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '4px' }}><span>Passed:</span><span style={{ color: 'var(--success)', fontWeight: 700 }}>{d.passed}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}><span>Failed:</span><span style={{ color: 'var(--error)', fontWeight: 700 }}>{d.failed}</span></div>
                                    </div>
                                )}
                                <div style={{ position: 'absolute', bottom: '-20px', left: 0, right: 0, textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)' }}>R{runs.length - distributionData.length + i + 1}</div>
                            </div>
                        ))}
                    </div>
                </ChartContainer>

                <ChartContainer title="Fleet Status" subtitle="Fleet run states." minHeight="160px" style={{ padding: '20px' }}>
                    <DonutChart passed={stats.passed} failed={stats.failed} running={stats.activeRuns} />
                </ChartContainer>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>System Feed</h3><button onClick={() => router.push(`${basePath}/summary-board`)} style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer' }}>ALL</button></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        {runs.slice(0, 3).map(r => (
                            <div key={r.runId} onClick={() => router.push(`${basePath}/summary-board`)} className="activity-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                <div style={{ padding: '4px', borderRadius: '5px', background: r.status === 'PASSED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: r.status === 'PASSED' ? 'var(--success)' : 'var(--error)' }}>{r.status === 'PASSED' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}</div>
                                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.suiteName}</div><div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{(r.testsPassed || 0) + (r.testsFailed || 0)} tests</div></div>
                                <ChevronRight size={10} style={{ opacity: 0.3 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* System Integrity (Engine Heuristics) Row */}
            <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                    <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${stats.passRate}, 100`} strokeLinecap="round" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.passRate}</div>
                        <div style={{ fontSize: '6px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Health</div>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>System Integrity Analysis</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Operational stability is currently at <span style={{ color: 'var(--success)', fontWeight: 700 }}>{stats.passRate}%</span>.
                        Average execution latency is <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{stats.avgDuration}</span> based on the latest <span style={{ fontWeight: 700 }}>{runs.length}</span> batches.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', minWidth: '100px' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reliability</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>OPTIMAL</div>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drift</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>0.01%</div>
                    </div>
                </div>
            </div>

            <div dangerouslySetInnerHTML={{ __html: `<style>.activity-item:hover { transform: translateX(2px); background: rgba(255, 255, 255, 0.05) !important; border-color: var(--primary) !important; }.live-indicator { width: 5px; height: 5px; background: var(--success); border-radius: 50%; display: inline-block; animation: blink 2s infinite; } @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>` }} />
        </div>

    );
}
