import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { Client, InvoiceItem, Company } from "../types";

// We define the structure we want the AI to extract
const updateInvoiceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cliente: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING, description: "Nombre completo o razón social del cliente" },
        numero: { type: Type.STRING, description: "Número de documento (DNI o RUC)" },
        tipo_doc: { type: Type.STRING, description: "Tipo de documento. '1' para DNI (8 dígitos), '6' para RUC (11 dígitos)." },
        direccion: { type: Type.STRING, description: "Dirección del cliente (opcional)" },
      },
    },
    items: {
      type: Type.ARRAY,
      description: "Lista de productos o servicios a facturar",
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion: { type: Type.STRING, description: "Descripción del producto o servicio" },
          cantidad: { type: Type.NUMBER, description: "Cantidad del item" },
          precio: { type: Type.NUMBER, description: "Precio unitario del item" },
        },
        required: ["descripcion", "cantidad", "precio"],
      },
    },
  },
};

const updateInvoiceTool: FunctionDeclaration = {
  name: "updateInvoice",
  description: "Actualiza los datos de la factura (cliente e items) basándose en la solicitud del usuario. Si la información es parcial, rellena lo que tengas.",
  parameters: updateInvoiceSchema,
};

const tools: Tool[] = [{ functionDeclarations: [updateInvoiceTool] }];

// Dynamic System Instruction generator
const createSystemInstruction = (company: Company) => `
Eres un asistente experto en facturación electrónica para "${company.razon_social}".
Tu objetivo es ayudar al usuario a generar una factura extrayendo información de su lenguaje natural.

Datos de la empresa (NO preguntar por esto, ya lo sabes):
- RUC: ${company.ruc}
- Razón Social: ${company.razon_social}
- Moneda: ${company.moneda}

Reglas:
1. Debes extraer información del CLIENTE (Nombre, DNI/RUC) y los ITEMS (Descripción, Cantidad, Precio).
2. Si el usuario menciona "factura por diseño" y no da precio, ASUME un precio razonable o pregunta (ej: "curso de diseño" = 100.00). Si no da cantidad, asume 1.
3. SIEMPRE llama a la función 'updateInvoice' si detectas CUALQUIER dato nuevo relevante (cliente o items).
4. Si faltan datos obligatorios (Nombre Cliente, Número Documento, o Items), responde amablemente pidiendo SOLO lo que falta.
5. Los DNI tienen 8 dígitos (tipo_doc = "1"). Los RUC tienen 11 dígitos (tipo_doc = "6").
6. Sé breve y profesional.
`;

let chatSession: any = null;
let currentCompanyJson: string = "";

export const resetSession = () => {
  chatSession = null;
  currentCompanyJson = "";
};

const initializeChat = (company: Company) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: createSystemInstruction(company),
      tools: tools,
    },
  });
  currentCompanyJson = JSON.stringify(company);
};

export interface AgentResponse {
  text: string;
  dataUpdates?: {
    cliente?: Partial<Client>;
    items?: InvoiceItem[];
  };
}

export const sendMessageToAgent = async (message: string, company: Company): Promise<AgentResponse> => {
  // Initialize or Re-initialize if company settings changed
  if (!chatSession || JSON.stringify(company) !== currentCompanyJson) {
    initializeChat(company);
  }

  try {
    const result = await chatSession.sendMessage({ message });
    
    let responseText = "";
    let extractedData: any = {};

    // Check for function calls
    const candidates = result.candidates;
    if (candidates && candidates[0]) {
      const parts = candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.text) {
          responseText += part.text;
        }
        
        if (part.functionCall) {
            const fc = part.functionCall;
            if (fc.name === 'updateInvoice') {
                // Merge arguments into extractedData
                const args = fc.args as any;
                extractedData = { ...extractedData, ...args };
                
                await chatSession.sendToolResponse({
                    functionResponses: [{
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Factura actualizada exitosamente." }
                    }]
                });
            }
        }
      }
    }

    // If text is empty (sometimes model just calls function), add a default
    if (!responseText && Object.keys(extractedData).length > 0) {
        responseText = "He actualizado los datos de la factura.";
    }

    return {
      text: responseText || "Entendido.",
      dataUpdates: Object.keys(extractedData).length > 0 ? extractedData : undefined
    };

  } catch (error) {
    console.error("Error in Gemini communication:", error);
    return {
      text: "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.",
    };
  }
};