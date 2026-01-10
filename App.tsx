import React, { useState } from 'react';
import { Search, Network, Database, ExternalLink, Loader2, Info, Layers, AlertTriangle, Table as TableIcon, Plus, FileSpreadsheet, BarChart3, Settings, Play, Pause, Clock, CheckCircle2, Server, Download, FileText, ArrowRight, Zap } from 'lucide-react';
import NetworkGraph from './components/NetworkGraph';
import { searchPolicies, structurePolicyData, generateStatisticalData, generateSchemaGraph, createScrapingPlan } from './services/geminiService';
import { GraphData, PolicyNode, ProcessingStatus, Source, DataTable, ScrapingPlan, OrchestrationTask } from './types';

// Initial Mock Data
const INITIAL_GRAPH: GraphData = {
  nodes: [
    { id: 'AnsanCity', label: '안산시청', group: 'Organization', description: '지역 정부 기관' },
    { id: 'Foreigners', label: '외국인 주민', group: 'Beneficiary', description: '안산에 거주하는 외국 국적자' },
  ],
  links: [
    { source: 'AnsanCity', target: 'Foreigners', relation: '관리한다' },
  ]
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'policy' | 'data' | 'orchestration'>('policy');

  // Policy State
  const [query, setQuery] = useState('안산시 외국인 지원 정책');
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: '검색 준비 완료' });
  const [graphData, setGraphData] = useState<GraphData>(INITIAL_GRAPH);
  const [selectedNode, setSelectedNode] = useState<PolicyNode | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [rawSummary, setRawSummary] = useState<string>("");
  const [viewMode, setViewMode] = useState<'graph' | 'summary' | 'table'>('graph');

  // Data Studio State
  const [dataQuery, setDataQuery] = useState('안산시 국적별 외국인 현황');
  const [tables, setTables] = useState<DataTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ScrapingPlan | null>(null);

  // Orchestration State
  const [tasks, setTasks] = useState<OrchestrationTask[]>([
    { id: 't1', name: '외국인 인구 통계 수집', schedule: 'Daily', lastRun: '2023-10-24 09:00', nextRun: '2023-10-25 09:00', status: 'Active', datasetId: 'd1' },
    { id: 't2', name: '고용 허가제 변동 사항 크롤링', schedule: 'Weekly', lastRun: '2023-10-20 14:00', nextRun: '2023-10-27 14:00', status: 'Paused', datasetId: 'd2' }
  ]);

  const handlePolicySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSelectedNode(null);
    setStatus({ step: 'searching', message: '정책 데이터 검색 중...' });
    try {
      const searchResult = await searchPolicies(query);
      setSources(searchResult.sources);
      setRawSummary(searchResult.text);
      setStatus({ step: 'structuring', message: '지식 그래프 생성 중...' });
      const structuredData = await structurePolicyData(searchResult.text);
      setGraphData(structuredData);
      setStatus({ step: 'complete', message: '시각화 완료.' });
      setViewMode('graph');
    } catch (error: any) {
      handleError(error);
    }
  };

  const handleScrapingPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataQuery.trim()) return;
    setStatus({ step: 'planning', message: '수집 전략 수립 중...' });
    setCurrentPlan(null);
    try {
      const plan = await createScrapingPlan(dataQuery);
      setCurrentPlan(plan);
      setStatus({ step: 'idle', message: '수집 계획 승인 대기 중' });
    } catch (error: any) {
      handleError(error);
    }
  };

  const executeScraping = async () => {
    if (!currentPlan) return;
    setStatus({ step: 'searching', message: '에이전트 실행 중...' });
    try {
      for (const step of currentPlan.steps) {
         await new Promise(r => setTimeout(r, 600)); 
      }
      const newTable = await generateStatisticalData(currentPlan.topic, currentPlan.strategy);
      const updatedTables = [...tables, newTable];
      setTables(updatedTables);
      setSelectedTableId(newTable.id);
      const newTask: OrchestrationTask = {
        id: `task-${Date.now()}`,
        name: `${currentPlan.topic} 자동 수집`,
        schedule: 'Weekly',
        lastRun: new Date().toLocaleString(),
        nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString(),
        status: 'Active',
        datasetId: newTable.id
      };
      setTasks(prev => [...prev, newTask]);
      setStatus({ step: 'structuring', message: '데이터 관계 분석 중...' });
      const schemaGraph = await generateSchemaGraph(updatedTables);
      setGraphData(schemaGraph);
      setStatus({ step: 'complete', message: '완료.' });
      setViewMode('table');
      setCurrentPlan(null);
    } catch (error: any) {
      handleError(error);
    }
  };

  const handleError = (error: any) => {
    let errorMessage = '오류 발생';
    if (error.message?.includes('429')) errorMessage = 'API 한도 초과';
    else if (error.message) errorMessage = error.message;
    setStatus({ step: 'error', message: errorMessage });
  };

  // UI Components helpers
  const TabButton = ({ mode, icon: Icon, label }: { mode: 'policy' | 'data' | 'orchestration', icon: any, label: string }) => (
    <button
      onClick={() => { setAppMode(mode); setViewMode(mode === 'policy' ? 'graph' : 'table'); }}
      className={`relative px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 flex items-center space-x-2
        ${appMode === mode ? 'bg-black text-white shadow-lg shadow-black/10 scale-105' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5] font-sans selection:bg-black selection:text-white">
      {/* Navbar - Floating style */}
      <header className="px-8 py-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <div className="bg-black text-white p-2.5 rounded-xl shadow-xl shadow-black/10">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Policy Nexus</h1>
            <p className="text-xs font-medium text-slate-500 mt-1 tracking-wide">AI AGENT FOR ANSAN CITY</p>
          </div>
        </div>

        <div className="hidden md:flex bg-white p-1.5 rounded-full shadow-sm border border-slate-200">
          <TabButton mode="policy" icon={Search} label="정책 검색" />
          <TabButton mode="data" icon={Database} label="데이터 스튜디오" />
          <TabButton mode="orchestration" icon={Server} label="오케스트레이션" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-6">
        
        {/* Left Control Panel - Card Style */}
        <aside className="w-[420px] flex flex-col bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden z-10 transition-all hover:shadow-md duration-500">
          
          {/* Top Section: Inputs */}
          <div className="p-8 pb-4">
            {appMode === 'policy' ? (
              <form onSubmit={handlePolicySearch} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Research Topic</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 text-lg font-medium pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent focus:bg-white focus:border-black focus:ring-0 transition-all placeholder:text-slate-300 group-hover:bg-slate-100"
                      placeholder="주제를 입력하세요..."
                    />
                    <Search className="w-6 h-6 text-slate-400 absolute left-4 top-4 transition-colors group-hover:text-slate-600" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={status.step === 'searching' || status.step === 'structuring'}
                  className="w-full py-4 rounded-full bg-black text-white font-bold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center space-x-2 shadow-xl shadow-black/10"
                >
                  {status.step === 'searching' || status.step === 'structuring' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>PROCESSING...</span></>
                  ) : (
                    <><Zap className="w-4 h-4" /><span>ANALYZE</span></>
                  )}
                </button>
              </form>
            ) : appMode === 'data' ? (
              <form onSubmit={handleScrapingPlan} className="space-y-6">
                 <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Target Data</label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={dataQuery}
                      onChange={(e) => setDataQuery(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 text-lg font-medium pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent focus:bg-white focus:border-emerald-600 focus:ring-0 transition-all placeholder:text-slate-300 group-hover:bg-slate-100"
                      placeholder="데이터 주제 입력..."
                    />
                    <FileSpreadsheet className="w-6 h-6 text-slate-400 absolute left-4 top-4 transition-colors group-hover:text-slate-600" />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={status.step === 'planning'}
                  className="w-full py-4 rounded-full bg-emerald-600 text-white font-bold text-sm tracking-wide hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-xl shadow-emerald-600/20"
                >
                  {status.step === 'planning' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>PLANNING...</span></>
                  ) : (
                    <><Plus className="w-4 h-4" /><span>CREATE AGENT</span></>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Server className="w-8 h-8 text-slate-400" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900">System Status</h3>
                 <p className="text-sm text-slate-500 mt-2">All systems operational</p>
              </div>
            )}

            {/* Status Pill */}
            <div className="mt-6 flex justify-center">
              <div className={`px-4 py-2 rounded-full text-xs font-bold flex items-center space-x-2 transition-all duration-300
                ${status.step === 'error' ? 'bg-red-50 text-red-600' : 
                  status.step === 'idle' ? 'bg-slate-50 text-slate-400' : 
                  'bg-blue-50 text-blue-600 animate-pulse'}`}>
                {status.step === 'error' ? <AlertTriangle className="w-3 h-3" /> : 
                 status.step === 'idle' ? <div className="w-2 h-2 rounded-full bg-slate-400"/> : 
                 <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{status.message}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Bottom Section: Content List */}
          <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
            
            {/* 1. DATA PLANS */}
            {appMode === 'data' && currentPlan && (
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6">
                 <div className="flex justify-between items-start mb-4">
                   <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">PLAN READY</span>
                 </div>
                 <h3 className="font-bold text-slate-900 mb-2">{currentPlan.topic}</h3>
                 <p className="text-xs text-slate-500 mb-4">{currentPlan.strategy}</p>
                 <div className="space-y-3 mb-5">
                   {currentPlan.steps.map(step => (
                     <div key={step.id} className="flex items-center text-xs">
                       <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-400 mr-3 shadow-sm">{step.id}</div>
                       <span className="text-slate-700">{step.targetSite}</span>
                       <ArrowRight className="w-3 h-3 mx-2 text-slate-300" />
                       <span className="text-slate-500">{step.method}</span>
                     </div>
                   ))}
                 </div>
                 <button onClick={executeScraping} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors flex items-center justify-center space-x-2">
                   <Play className="w-3 h-3" /> <span>RUN AGENT</span>
                 </button>
              </div>
            )}

            {/* 2. DATA LAKE */}
            {appMode === 'data' && tables.length > 0 && (
              <div className="space-y-3">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Data Lake</h3>
                 {tables.map(table => (
                   <div key={table.id} onClick={() => {setSelectedTableId(table.id); setViewMode('table')}} 
                     className={`p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] group
                     ${selectedTableId === table.id ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-100 hover:border-emerald-100 hover:shadow-sm'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedTableId === table.id ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            <TableIcon className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-800">{table.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{table.format}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pl-10">
                         <span>{new Date(table.collectedAt).toLocaleDateString()}</span>
                         <span>{table.rows.length} rows</span>
                      </div>
                   </div>
                 ))}
              </div>
            )}

            {/* 3. POLICY DETAILS */}
            {appMode === 'policy' && (
              selectedNode ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-3
                     ${selectedNode.group === 'Policy' ? 'bg-blue-100 text-blue-700' : 
                       selectedNode.group === 'Organization' ? 'bg-red-100 text-red-700' : 
                       'bg-green-100 text-green-700'}`}>
                     {selectedNode.group}
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">{selectedNode.label}</h2>
                  <div className="prose prose-sm prose-slate mb-6">
                    <p>{selectedNode.description || "No description provided."}</p>
                  </div>
                  
                  {sources.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Verified Sources</h4>
                      <ul className="space-y-2">
                        {sources.slice(0, 3).map((s, i) => (
                          <li key={i}>
                            <a href={s.uri} target="_blank" rel="noreferrer" className="flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium truncate bg-blue-50 p-2 rounded-lg transition-colors hover:bg-blue-100">
                              <ExternalLink className="w-3 h-3 mr-2 flex-shrink-0" />
                              <span className="truncate">{s.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <Info className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Select a node to explore</p>
                </div>
              )
            )}

            {/* 4. ORCHESTRATION TASKS */}
            {appMode === 'orchestration' && (
              <div className="space-y-4">
                 {tasks.map(task => (
                   <div key={task.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all">
                      <div className={`absolute top-0 left-0 w-1 h-full ${task.status === 'Active' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <div className="pl-4">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-slate-800 text-sm">{task.name}</h4>
                          {task.status === 'Active' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                        </div>
                        <p className="text-xs text-slate-400 mb-3">{task.schedule} Schedule</p>
                        <div className="flex items-center space-x-4 text-[10px] text-slate-500 font-medium bg-slate-50 p-2 rounded-lg">
                           <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1 text-slate-400"/> Last: {task.lastRun.split(' ')[0]}</span>
                           <span className="flex items-center"><Clock className="w-3 h-3 mr-1 text-slate-400"/> Next: {task.nextRun.split(' ')[0]}</span>
                        </div>
                      </div>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Area - Visualization Canvas */}
        <main className="flex-1 flex flex-col relative rounded-[2rem] overflow-hidden shadow-sm bg-white border border-slate-100">
          
          {/* Floating View Toggles */}
          <div className="absolute top-6 left-6 z-10 flex space-x-2">
             <button 
               onClick={() => setViewMode('graph')}
               className={`h-10 px-4 rounded-full text-xs font-bold transition-all flex items-center space-x-2 border
               ${viewMode === 'graph' ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
             >
               <Network className="w-3 h-3" /> <span>GRAPH</span>
             </button>
             {appMode === 'policy' && (
                <button 
                onClick={() => setViewMode('summary')}
                className={`h-10 px-4 rounded-full text-xs font-bold transition-all flex items-center space-x-2 border
                ${viewMode === 'summary' ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                <FileText className="w-3 h-3" /> <span>SUMMARY</span>
              </button>
             )}
             {(appMode === 'data' || appMode === 'orchestration') && (
                <button 
                onClick={() => setViewMode('table')}
                className={`h-10 px-4 rounded-full text-xs font-bold transition-all flex items-center space-x-2 border
                ${viewMode === 'table' ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                <TableIcon className="w-3 h-3" /> <span>TABLE</span>
              </button>
             )}
          </div>

          <div className="flex-1 h-full">
            {viewMode === 'graph' && (
               <NetworkGraph data={graphData} onNodeClick={setSelectedNode} />
            )}

            {viewMode === 'summary' && (
               <div className="w-full h-full p-12 overflow-y-auto bg-white">
                 <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold mb-8 text-slate-900 tracking-tight">Executive Summary</h2>
                    <div className="prose prose-slate prose-lg max-w-none">
                     <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-8">
                       {rawSummary || "No summary generated."}
                     </pre>
                    </div>
                 </div>
               </div>
            )}

            {viewMode === 'table' && (
               <div className="w-full h-full flex flex-col bg-white">
                 {selectedTableId ? (
                   (() => {
                     const table = tables.find(t => t.id === selectedTableId);
                     if (!table) return null;
                     return (
                       <>
                        <div className="p-8 border-b border-slate-100 flex justify-between items-end">
                          <div>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mb-3 inline-block">{table.category || 'General'}</span>
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{table.name}</h2>
                            <p className="text-sm text-slate-500 mt-2">{table.description}</p>
                          </div>
                          <button className="h-10 px-5 bg-slate-900 text-white rounded-full text-xs font-bold flex items-center space-x-2 hover:bg-black transition-colors">
                            <Download className="w-3 h-3" /> <span>EXPORT CSV</span>
                          </button>
                        </div>
                        <div className="flex-1 overflow-auto p-8">
                           <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <table className="w-full text-sm text-left text-slate-600">
                               <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                 <tr>
                                   {table.columns.map(col => (
                                     <th key={col} className="px-6 py-4 font-bold tracking-wider">
                                       {col}
                                     </th>
                                   ))}
                                 </tr>
                               </thead>
                               <tbody>
                                 {table.rows.map((row, idx) => (
                                   <tr key={idx} className="bg-white border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                                     {table.columns.map(col => (
                                       <td key={`${idx}-${col}`} className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                                         {row[col]}
                                       </td>
                                     ))}
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                        </div>
                       </>
                     );
                   })()
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300">
                     <TableIcon className="w-20 h-20 mb-6 opacity-20" />
                     <p className="text-lg font-medium text-slate-400">Select a dataset to view</p>
                   </div>
                 )}
               </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;