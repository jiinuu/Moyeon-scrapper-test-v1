import React, { useState } from 'react';
import { Search, Network, Database, ExternalLink, Loader2, Info, Share2, Layers, AlertTriangle } from 'lucide-react';
import NetworkGraph from './components/NetworkGraph';
import { searchPolicies, structurePolicyData } from './services/geminiService';
import { GraphData, PolicyNode, ProcessingStatus, Source } from './types';

// Initial Mock Data to show before search
const INITIAL_DATA: GraphData = {
  nodes: [
    { id: 'AnsanCity', label: 'Ansan City', group: 'Organization', description: 'The local government body.' },
    { id: 'Foreigners', label: 'Foreign Residents', group: 'Beneficiary', description: 'People residing in Ansan from other countries.' },
    { id: 'SupportCenter', label: 'Migrant Support Center', group: 'Organization', description: 'Provides legal and daily life support.' },
    { id: 'Visa', label: 'Visa Support', group: 'Policy', description: 'Assistance with E-9, F-4, etc.' },
  ],
  links: [
    { source: 'AnsanCity', target: 'SupportCenter', relation: 'funds' },
    { source: 'SupportCenter', target: 'Foreigners', relation: 'supports' },
    { source: 'SupportCenter', target: 'Visa', relation: 'provides' },
  ]
};

const App: React.FC = () => {
  const [query, setQuery] = useState('Ansan foreign resident policies');
  const [status, setStatus] = useState<ProcessingStatus>({ step: 'idle', message: 'Ready to search' });
  const [graphData, setGraphData] = useState<GraphData>(INITIAL_DATA);
  const [selectedNode, setSelectedNode] = useState<PolicyNode | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [rawSummary, setRawSummary] = useState<string>("");
  const [viewMode, setViewMode] = useState<'graph' | 'summary'>('graph');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Reset UI
    setSelectedNode(null);
    setStatus({ step: 'searching', message: 'Searching current Ansan policies...' });
    
    try {
      // Step 1: Search
      const searchResult = await searchPolicies(query);
      setSources(searchResult.sources);
      setRawSummary(searchResult.text);

      setStatus({ step: 'structuring', message: 'Building ontology network...' });

      // Step 2: Structure
      const structuredData = await structurePolicyData(searchResult.text);
      setGraphData(structuredData);

      setStatus({ step: 'complete', message: 'Visualization ready.' });

    } catch (error: any) {
      let errorMessage = 'An error occurred. Please try again.';
      
      // Detailed error check
      if (error.message?.includes('429') || error.status === 429) {
        errorMessage = 'Too many requests. Please wait a minute and try again (Quota Exceeded).';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      setStatus({ step: 'error', message: errorMessage });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Ansan Policy Nexus</h1>
            <p className="text-xs text-slate-500">AI-Powered Policy Ontology Agent</p>
          </div>
        </div>
        
        {/* API Key Warning */}
        {!process.env.API_KEY && (
           <span className="text-red-500 text-sm font-semibold bg-red-50 px-3 py-1 rounded-full">
             Missing API_KEY in env
           </span>
        )}
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Controls & Info */}
        <aside className="w-96 flex flex-col border-r border-slate-200 bg-slate-50 z-10 shadow-lg">
          
          {/* Search Section */}
          <div className="p-6 border-b border-slate-200">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Research Topic</label>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="e.g., Ansan Visa Support"
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
              <button
                type="submit"
                disabled={status.step === 'searching' || status.step === 'structuring'}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status.step === 'searching' || status.step === 'structuring' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Generate Ontology</span>
                  </>
                )}
              </button>
            </form>

            {/* Status Indicator */}
            <div className={`mt-4 flex items-start space-x-2 text-sm p-3 rounded-lg ${
              status.step === 'error' ? 'bg-red-50 border border-red-200' : 'bg-transparent'
            }`}>
              {status.step === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  status.step === 'complete' ? 'bg-green-500' :
                  status.step === 'idle' ? 'bg-slate-300' : 'bg-blue-500 animate-pulse'
                }`} />
              )}
              <span className={`break-words ${status.step === 'error' ? 'text-red-700' : 'text-slate-600'}`}>
                {status.message}
              </span>
            </div>
          </div>

          {/* Node Detail / Summary Panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedNode ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center space-x-2 mb-3">
                   <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                     ${selectedNode.group === 'Policy' ? 'bg-blue-100 text-blue-800' : 
                       selectedNode.group === 'Organization' ? 'bg-red-100 text-red-800' : 
                       selectedNode.group === 'Beneficiary' ? 'bg-green-100 text-green-800' : 
                       'bg-purple-100 text-purple-800'}`}>
                     {selectedNode.group}
                   </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">{selectedNode.label}</h2>
                <div className="prose prose-sm prose-slate">
                  <p className="text-slate-600 leading-relaxed">
                    {selectedNode.description || "No specific description available for this entity."}
                  </p>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Related Connections</h3>
                  <ul className="space-y-2">
                    {graphData.links
                      .filter((l: any) => l.source.id === selectedNode.id || l.target.id === selectedNode.id)
                      .map((l: any, idx) => {
                        const isSource = l.source.id === selectedNode.id;
                        const other = isSource ? l.target : l.source;
                        return (
                          <li key={idx} className="text-sm flex items-start space-x-2">
                            <span className="text-slate-400">
                              {isSource ? '→' : '←'}
                            </span>
                            <span>
                              <span className="font-medium text-slate-700">{l.relation}</span>
                              <span className="text-slate-500 mx-1">with</span>
                              <button 
                                onClick={() => setSelectedNode(other)}
                                className="text-blue-600 hover:underline"
                              >
                                {other.label}
                              </button>
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a node in the graph to view details.</p>
              </div>
            )}
          </div>
          
          {/* Sources Section (Sticky Bottom) */}
          {sources.length > 0 && (
            <div className="p-4 bg-slate-100 border-t border-slate-200 text-xs">
              <h3 className="font-bold text-slate-700 mb-2 flex items-center">
                <Database className="w-3 h-3 mr-1" /> Verified Sources
              </h3>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {sources.map((source, idx) => (
                  <li key={idx}>
                    <a href={source.uri} target="_blank" rel="noreferrer" className="flex items-center text-blue-600 hover:underline truncate">
                      <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" />
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Right Content: Visualization */}
        <main className="flex-1 flex flex-col relative bg-slate-50">
          {/* View Toggles */}
          <div className="absolute top-4 left-4 z-10 flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
             <button 
               onClick={() => setViewMode('graph')}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'graph' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               Graph View
             </button>
             <button 
               onClick={() => setViewMode('summary')}
               className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
             >
               Text Summary
             </button>
          </div>

          <div className="flex-1 p-4 h-full">
            {viewMode === 'graph' ? (
               <NetworkGraph data={graphData} onNodeClick={setSelectedNode} />
            ) : (
               <div className="w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 overflow-y-auto">
                 <h2 className="text-2xl font-bold mb-6 text-slate-800">Policy Summary</h2>
                 {rawSummary ? (
                   <div className="prose prose-blue max-w-none">
                     <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                       {rawSummary}
                     </pre>
                   </div>
                 ) : (
                   <p className="text-slate-500 italic">No summary generated yet. Run a search to generate.</p>
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
