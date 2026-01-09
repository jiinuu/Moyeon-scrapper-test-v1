import { GoogleGenAI, Type } from "@google/genai";
import { GraphData, Source } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Step 1: Search for information using Gemini with Google Search Grounding.
 */
export const searchPolicies = async (query: string): Promise<{ text: string; sources: Source[] }> => {
  try {
    const model = 'gemini-3-pro-preview'; 
    
    // We strictly use Google Search tool here
    const response = await ai.models.generateContent({
      model: model,
      contents: `Search thoroughly for official and recent policies, welfare programs, visa regulations, and support systems for foreign residents living in Ansan City (Ansan-si), South Korea. 
      Focus on data from the Ansan City Hall, Ansan Migrant Community Service Center, and relevant government bodies.
      Summarize the findings in detail, covering:
      1. Visa and Residency types supported.
      2. Welfare benefits (healthcare, childcare, emergency support).
      3. Legal and labor rights support.
      4. Educational and cultural integration programs.
      
      User Query Context: ${query}`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 1024 } // Allow some thinking for search strategy
      },
    });

    const text = response.text || "No detailed text returned.";
    
    // Extract sources from grounding metadata
    const sources: Source[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
          });
        }
      });
    }

    // Remove duplicates based on URI
    const uniqueSources = sources.filter((v, i, a) => a.findIndex(v2 => v2.uri === v.uri) === i);

    return { text, sources: uniqueSources };

  } catch (error) {
    console.error("Search Error:", error);
    throw new Error("Failed to search for policy data.");
  }
};

/**
 * Step 2: Convert the raw text into a structured Node/Link Ontology using JSON schema.
 */
export const structurePolicyData = async (rawText: string): Promise<GraphData> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash is sufficient for text-to-json extraction
      contents: `You are an expert Data Architect and Ontologist. 
      Analyze the following text describing policies for foreign residents in Ansan City.
      Construct a knowledge graph/ontology.
      
      Create 'nodes' representing specific Policies, Organizations (like Ansan City Hall, Support Centers), Beneficiaries (e.g., Migrant Workers, Marriage Immigrants), Requirements (e.g., E-9 Visa), or Key Concepts.
      Create 'links' representing the relationship between them (e.g., 'provides', 'is_eligible_for', 'manages', 'requires').

      Text to Analyze:
      ${rawText.substring(0, 20000)}`, // Truncate if too long, though Flash context is large
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Unique short ID, no spaces preferably" },
                  label: { type: Type.STRING, description: "Human readable name" },
                  group: { 
                    type: Type.STRING, 
                    enum: ['Policy', 'Organization', 'Beneficiary', 'Requirement', 'Concept'] 
                  },
                  description: { type: Type.STRING, description: "Short description of the node" }
                },
                required: ["id", "label", "group"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING, description: "ID of the source node" },
                  target: { type: Type.STRING, description: "ID of the target node" },
                  relation: { type: Type.STRING, description: "Name of relationship (e.g., 'provides')" }
                },
                required: ["source", "target", "relation"]
              }
            }
          },
          required: ["nodes", "links"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No JSON generated.");
    
    return JSON.parse(jsonText) as GraphData;

  } catch (error) {
    console.error("Structuring Error:", error);
    throw new Error("Failed to structure data into ontology.");
  }
};
