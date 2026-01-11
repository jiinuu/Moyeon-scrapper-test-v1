import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { GraphData, Source, DataTable, ScrapingPlan } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper function to retry API calls with exponential backoff
 */
async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isRateLimit = 
      error.status === 429 || 
      error.code === 429 || 
      error.message?.includes('429') || 
      error.message?.includes('Quota') ||
      error.message?.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit && retries > 0) {
      console.warn(`API 한도 초과. ${delay}ms 후 재시도합니다... (남은 시도: ${retries}회)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

/**
 * Step 1: Search Policy (Korean)
 */
export const searchPolicies = async (query: string): Promise<{ text: string; sources: Source[] }> => {
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `대한민국 안산시(Ansan-si)의 외국인 거주자 관련 정책, 복지 프로그램, 비자 규정 및 지원 시스템에 대해 공식적이고 최신 정보를 검색하세요.
      안산시청, 안산시 외국인 주민 지원센터 및 관련 정부 기관의 데이터를 중심으로 하세요.
      
      다음 내용을 포함하여 **반드시 한국어로** 상세히 요약하세요:
      1. 지원되는 비자 및 거주 유형.
      2. 복지 혜택 (의료, 보육, 긴급 지원).
      3. 법률 및 노동 권리 지원.
      4. 교육 및 문화 통합 프로그램.
      
      사용자 질문: ${query}`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 512 } 
      },
    }));

    const text = response.text || "상세 정보를 가져오지 못했습니다.";
    
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

    const uniqueSources = sources.filter((v, i, a) => a.findIndex(v2 => v2.uri === v.uri) === i);

    return { text, sources: uniqueSources };

  } catch (error) {
    console.error("검색 오류:", error);
    throw error;
  }
};

/**
 * Step 2: Structure Data (Korean Graph)
 */
export const structurePolicyData = async (rawText: string): Promise<GraphData> => {
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `당신은 전문 데이터 아키텍트이자 온톨로지 전문가입니다.
      안산시 외국인 정책에 대한 다음 텍스트를 분석하여 지식 그래프를 구성하세요.
      **모든 라벨과 설명은 한국어로 출력해야 합니다.**
      
      다음과 같은 '노드'를 생성하세요:
      - 정책, 조직(예: 안산시청, 지원센터), 수혜자(예: 이주노동자, 결혼이민자), 자격요건(예: E-9 비자), 핵심 개념.
      
      다음과 같은 '링크'를 생성하세요:
      - 관계 (예: '제공한다', '자격이_있다', '관리한다', '필요로_한다').

      분석할 텍스트:
      ${rawText.substring(0, 15000)}`,
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
                  id: { type: Type.STRING, description: "고유 ID (영어 권장)" },
                  label: { type: Type.STRING, description: "사람이 읽을 수 있는 이름 (한국어)" },
                  group: { 
                    type: Type.STRING, 
                    enum: ['Policy', 'Organization', 'Beneficiary', 'Requirement', 'Concept'] 
                  },
                  description: { type: Type.STRING, description: "설명 (한국어)" }
                },
                required: ["id", "label", "group"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  relation: { type: Type.STRING, description: "관계 이름 (한국어)" }
                },
                required: ["source", "target", "relation"]
              }
            }
          },
          required: ["nodes", "links"]
        }
      }
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("JSON 생성 실패");
    
    return JSON.parse(jsonText) as GraphData;

  } catch (error) {
    console.error("구조화 오류:", error);
    throw error;
  }
};

/**
 * New: Create a Scraping Plan (Korean)
 */
export const createScrapingPlan = async (query: string): Promise<ScrapingPlan> => {
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `당신은 지능형 데이터 수집 에이전트입니다. 사용자가 요청한 주제("${query}")에 대해 데이터를 수집하기 위한 전략을 수립하세요.
      
      1. 안산시청, 통계청, 이주민 커뮤니티 등 어떤 사이트를 공략할지 결정하세요.
      2. 엑셀(XLS)/CSV 다운로드가 가능한지, 댓글 마이닝이 필요한지, 단순 HTML 파싱이 필요한지 판단하세요.
      3. 3~5단계의 구체적인 실행 계획을 수립하세요.
      
      **모든 내용은 한국어로 작성하세요.**`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            strategy: { type: Type.STRING, description: "전반적인 수집 전략 요약" },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  targetSite: { type: Type.STRING },
                  method: { type: Type.STRING, enum: ['API Call', 'HTML Parsing', 'File Download (XLS/CSV)', 'Comment Mining'] },
                  dataTarget: { type: Type.STRING, description: "수집하려는 구체적 데이터 (예: 외국인 인구 통계표)" },
                  status: { type: Type.STRING, enum: ['pending'] },
                  logs: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["id", "targetSite", "method", "dataTarget"]
              }
            }
          },
          required: ["topic", "strategy", "steps"]
        }
      }
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("계획 생성 실패");
    return JSON.parse(jsonText) as ScrapingPlan;
  } catch (error) {
    console.error("플래닝 오류:", error);
    throw error;
  }
}

/**
 * Generate Statistical Data (Data Studio) - Korean
 */
export const generateStatisticalData = async (query: string, sourceContext?: string): Promise<DataTable> => {
  try {
    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `당신은 데이터 엔지니어입니다. 주제: "${query}"에 대한 통계 데이터를 생성하세요.
      
      1. 안산시 혹은 관련 기관에서 실제로 제공할 법한 CSV/Excel 데이터를 시뮬레이션하여 생성하세요.
      2. **컬럼명과 데이터 내용은 반드시 한국어여야 합니다.**
      3. 데이터 출처(Source)는 구체적인 기관명(예: 안산시청 외국인주민지원과)을 명시하세요.
      4. **'rows'는 'columns'의 순서에 맞는 값(Value)들의 배열(Array)이어야 합니다.** (객체 아님)
      5. 문맥: ${sourceContext || '일반 수집'}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            source: { type: Type.STRING },
            format: { type: Type.STRING, enum: ['CSV', 'XLSX', 'JSON', 'API'] },
            description: { type: Type.STRING },
            columns: { type: Type.ARRAY, items: { type: Type.STRING } },
            rows: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              } 
            },
            collectedAt: { type: Type.STRING }
          },
          required: ["id", "name", "category", "source", "format", "columns", "rows"]
        }
      }
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("데이터 생성 실패");
    const data = JSON.parse(jsonText);
    data.collectedAt = new Date().toISOString(); // Timestamp
    return data as DataTable;
  } catch (error) {
    console.error("통계 생성 오류:", error);
    throw error;
  }
};

/**
 * Generate Schema Graph (Korean)
 */
export const generateSchemaGraph = async (tables: DataTable[]): Promise<GraphData> => {
  try {
    const tableSummaries = tables.map(t => ({
      name: t.name,
      columns: t.columns,
      description: t.description
    }));

    const response = await retryWithBackoff<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `당신은 데이터베이스 아키텍트입니다. 다음 테이블 스키마들을 분석하여 ERD(개체 관계 다이어그램) 지식 그래프를 생성하세요.
      **라벨과 관계명은 한국어로 출력하세요.**
      
      노드 타입: 'Table', 'Column', 'Concept'.
      관계 타입: '포함한다(has_column)', '관련됨(relates_to)', '측정함(measures)'.

      스키마 목록:
      ${JSON.stringify(tableSummaries, null, 2)}`,
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
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  group: { type: Type.STRING, enum: ['Table', 'Column', 'Concept'] },
                  description: { type: Type.STRING }
                },
                required: ["id", "label", "group"]
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  relation: { type: Type.STRING }
                },
                required: ["source", "target", "relation"]
              }
            }
          },
          required: ["nodes", "links"]
        }
      }
    }));

    const jsonText = response.text;
    if (!jsonText) throw new Error("그래프 생성 실패");
    return JSON.parse(jsonText) as GraphData;

  } catch (error) {
    console.error("스키마 그래프 오류:", error);
    throw error;
  }
};