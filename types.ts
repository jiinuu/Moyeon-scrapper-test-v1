export interface PolicyNode {
  id: string;
  label: string;
  group: 'Policy' | 'Organization' | 'Beneficiary' | 'Requirement' | 'Concept' | 'Table' | 'Column' | 'DataPoint';
  description?: string;
  radius?: number; // For visualization
  x?: number; // D3 coordinate
  y?: number; // D3 coordinate
}

export interface PolicyLink {
  source: string | PolicyNode; // D3 converts string ID to object
  target: string | PolicyNode;
  relation: string;
}

export interface GraphData {
  nodes: PolicyNode[];
  links: PolicyLink[];
}

export interface Source {
  title: string;
  uri: string;
}

export interface ProcessingStatus {
  step: 'idle' | 'planning' | 'searching' | 'structuring' | 'complete' | 'error';
  message: string;
}

export interface DataTable {
  id: string;
  name: string;
  category: string; // e.g., 'Employment', 'Welfare'
  source: string; // e.g., 'Ansan City Hall'
  format: 'CSV' | 'XLSX' | 'JSON' | 'API';
  columns: string[];
  rows: Record<string, any>[];
  description?: string;
  collectedAt: string;
}

export interface ScrapingStep {
  id: number;
  targetSite: string;
  method: 'API Call' | 'HTML Parsing' | 'File Download (XLS/CSV)' | 'Comment Mining';
  dataTarget: string; // What to look for
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs: string[];
}

export interface ScrapingPlan {
  topic: string;
  strategy: string;
  steps: ScrapingStep[];
}

export interface OrchestrationTask {
  id: string;
  name: string;
  schedule: 'Daily' | 'Weekly' | 'Real-time';
  lastRun: string;
  nextRun: string;
  status: 'Active' | 'Paused' | 'Error';
  datasetId: string;
}