export interface PolicyNode {
  id: string;
  label: string;
  group: 'Policy' | 'Organization' | 'Beneficiary' | 'Requirement' | 'Concept';
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
  step: 'idle' | 'searching' | 'structuring' | 'complete' | 'error';
  message: string;
}
