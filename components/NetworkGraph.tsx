import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, PolicyNode, PolicyLink } from '../types';

interface NetworkGraphProps {
  data: GraphData;
  onNodeClick: (node: PolicyNode) => void;
}

// Google Labs-inspired Palette
const GROUP_COLORS = {
  'Policy': '#4285F4',      // Google Blue
  'Organization': '#EA4335', // Google Red
  'Beneficiary': '#34A853',  // Google Green
  'Requirement': '#FBBC04',  // Google Yellow
  'Concept': '#A142F4',      // Purple
  'Table': '#202124',        // Dark Grey (Data)
  'Column': '#5F6368',       // Medium Grey
  'DataPoint': '#DADCE0'     // Light Grey
};

const GROUP_NAMES_KR: Record<string, string> = {
  'Policy': '정책 (Policy)',
  'Organization': '기관 (Org)',
  'Beneficiary': '대상 (User)',
  'Requirement': '요건 (Req)',
  'Concept': '개념 (Concept)',
  'Table': '데이터셋 (Table)',
  'Column': '속성 (Column)',
  'DataPoint': '값 (Value)'
};

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(45));

    // Links
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#E2E8F0")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.6);

    // Link Labels
    const linkLabel = g.append("g")
      .attr("class", "link-labels")
      .selectAll("text")
      .data(links)
      .enter().append("text")
      .text(d => d.relation)
      .attr("font-size", "10px")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("fill", "#94A3B8")
      .attr("text-anchor", "middle")
      .attr("dy", -6)
      .style("pointer-events", "none");

    // Nodes container
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      });

    // Node Shadows for depth
    node.append("circle")
      .attr("r", 24)
      .attr("fill", "black")
      .attr("opacity", 0.05)
      .attr("cx", 2)
      .attr("cy", 2);

    // Node Circles
    node.append("circle")
      .attr("r", 24)
      .attr("fill", "white") // White background for cleanliness
      .attr("stroke", d => GROUP_COLORS[d.group] || '#94a3b8')
      .attr("stroke-width", 4)
      .transition().duration(500)
      .attr("r", 24);

    // Icons or Initials could go here, for now just a colored dot or simple indicator
    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => GROUP_COLORS[d.group] || '#94a3b8');

    // Labels
    node.append("text")
      .text(d => d.label)
      .attr("x", 0)
      .attr("y", 42)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-weight", "600")
      .attr("fill", "#1E293B")
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 4px rgba(255,255,255,0.8)");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkLabel
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();
  }, [data, dimensions, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative overflow-hidden rounded-[2rem] border border-slate-100 shadow-sm">
      <svg ref={svgRef} width="100%" height="100%" className="touch-none"></svg>
      
      {/* Legend - Floating Card Style */}
      <div className="absolute bottom-6 right-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/50 text-xs z-10 transition-transform hover:scale-105">
        <h4 className="font-bold mb-3 text-slate-900 tracking-tight">DATA MAP</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Object.entries(GROUP_COLORS)
            .filter(([group]) => data.nodes.some(n => n.group === group))
            .map(([group, color]) => (
            <div key={group} className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full mr-2 ring-1 ring-white shadow-sm" style={{ backgroundColor: color }}></span>
              <span className="text-slate-600 font-medium">{GROUP_NAMES_KR[group] || group}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetworkGraph;